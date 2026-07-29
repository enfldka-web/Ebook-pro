/* server/image-gateway.js — Phase 15: Atlas Image Generation Gateway
   구조: Atlas Browser → Atlas Server Gateway(이 파일) → OpenAI Images API → Atlas Server
   → Browser. OpenAI API Key는 이 프로세스의 환경변수에서만 읽고, 어떤 응답에도
   그대로 노출하지 않는다.

   선택한 구조: 순수 Node.js + Express. 이 프로젝트는 지금까지 빌드 도구/서버가 전혀
   없는 정적 프론트엔드였고(package.json도 없었음), Vercel/Netlify/Cloudflare Worker
   전용 설정 파일이나 배포 이력이 전혀 없어 특정 호스팅 벤더를 가정할 근거가 없다.
   Express는 (1) 의존성 1개로 정적 파일 서빙 + API 라우팅을 한 프로세스에서 모두
   해결하고, (2) 로컬 개발 서버(지금까지 python -m http.server로 임시 대체하던 것)를
   그대로 대체할 수 있고, (3) 특정 클라우드 벤더에 종속되지 않아 이후 어떤 배포
   환경(VPS/Docker/Render/Railway, 또는 필요하면 서버리스 핸들러로 감싸는 것)에도
   옮기기 쉽다 — 그래서 이번 Phase에서는 이 방식 하나만 선택했다. */

var express = require('express');
var crypto = require('crypto');
var path = require('path');

var Contract = require('../shared/image-generation-contract.js');
var validator = require('./image-request-validator.js');
var rateLimiter = require('./image-rate-limiter.js');
var usageStoreModule = require('./image-usage-store.js');
var openaiProvider = require('./providers/openai-image-provider.js');
var anthropicProvider = require('./providers/anthropic-text-provider.js');

function createApp(opts){
  opts = opts || {};
  var env = opts.env || process.env;
  var fetchImpl = opts.fetchImpl; /* 테스트 전용 주입 — 프로덕션에서는 undefined(전역 fetch 사용) */
  var cfg = openaiProvider.config(env);
  var semaphore = rateLimiter.createSemaphore(cfg.maxConcurrency);
  var usageStore = usageStoreModule.createUsageStore(env);
  var abortControllers = {}; /* jobId -> AbortController (취소용) */

  var app = express();
  app.use(express.json({ limit:'200kb' }));
  app.use(express.static(path.join(__dirname, '..')));

  /* API Key/Prompt 원문을 로그에 남기지 않는다 — 요청 메타데이터만 남긴다. */
  function safeLog(label, meta){ console.log('[image-gateway] '+label, JSON.stringify(meta)); }

  function getSessionUser(req, res){
    var cookieHeader = req.headers.cookie || '';
    return usageStore.resolveSessionUser(cookieHeader, function(name, value){
      res.setHeader('Set-Cookie', name+'='+value+'; Path=/; HttpOnly; SameSite=Lax');
    });
  }

  app.get('/api/image-gateway/status', function(req, res){
    var configured = openaiProvider.isConfigured(env);
    var sessionUser = getSessionUser(req, res);
    var limitCheck = usageStore.checkLimit(sessionUser.userId, sessionUser.plan);
    res.json({
      configured: configured,
      model: cfg.model,
      quality: cfg.quality,
      maxConcurrency: cfg.maxConcurrency,
      plan: sessionUser.plan,
      dailyUsed: limitCheck.dailyUsed, dailyLimit: limitCheck.dailyLimit,
      monthlyUsed: limitCheck.monthlyUsed, monthlyLimit: limitCheck.monthlyLimit
    });
  });

  app.post('/api/image-gateway/generate', function(req, res){
    var jobId = (req.body && req.body.jobId) || ('server-job-'+crypto.randomUUID());
    var contractRequest = req.body && req.body.request;

    if(!openaiProvider.isConfigured(env)){
      return res.status(503).json(Contract.createResponse({ requestId: contractRequest&&contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
        error: { message:'이미지 생성 서버 설정이 필요합니다.', code:'not_configured' } }));
    }

    var contractCheck = Contract.validateRequest(contractRequest);
    if(!contractCheck.valid){
      return res.status(400).json(Contract.createResponse({ requestId: contractRequest&&contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
        error: { message:'요청 형식이 올바르지 않습니다.', code:'invalid_request' } }));
    }

    var sessionUser = getSessionUser(req, res);
    var limitCheck = usageStore.checkLimit(sessionUser.userId, sessionUser.plan);
    if(!limitCheck.allowed){
      return res.status(403).json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
        error: { message: limitCheck.message, code: limitCheck.reason } }));
    }

    var size = validator.sizeForAssetType(contractRequest.assetType);
    var openaiBody = { size: size, quality: cfg.quality, output_format:'png', background:'opaque', model: cfg.model, prompt: contractRequest.prompt.positive };
    var bodyValidation = validator.validateOpenAIRequestBody(openaiBody);
    if(!bodyValidation.valid){
      safeLog('invalid-openai-body', { jobId: jobId, errors: bodyValidation.errors });
      return res.status(400).json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
        error: { message:'생성 요청을 처리할 수 없습니다.', code:'invalid_prompt' } }));
    }

    var upstreamController = new AbortController();
    abortControllers[jobId] = upstreamController;
    var responseSent = false;
    var clientGone = false;
    /* req.on('close')가 아니라 res.on('close')를 쓴다 — req의 'close'는 Node/Express에서
       요청 바디를 다 읽은 시점에도 발생할 수 있어(실제로 발견된 버그: 응답을 보내기도
       전에 발생해 핸들러가 조용히 리턴하며 응답이 영원히 가지 않는 상태가 됨), 응답이
       실제로 끝난 뒤에만 발생하는 res의 'close'로 "클라이언트가 정말 연결을 끊었는가"를
       판단한다. */
    res.on('close', function(){
      if(!responseSent){ clientGone = true; upstreamController.abort(); }
    });

    safeLog('generate-start', { jobId: jobId, assetType: contractRequest.assetType, size: size });

    semaphore.acquire().then(function(release){
      openaiProvider.generateWithRetry(contractRequest.prompt.positive, {
        env: env, size: size, quality: cfg.quality, signal: upstreamController.signal, fetchImpl: fetchImpl
      }).then(function(result){
        release();
        delete abortControllers[jobId];
        if(clientGone) return;
        responseSent = true;

        if(result.errorKind==='cancelled'){
          usageStore.recordUsage(sessionUser.userId, { chargeable:false });
          return res.json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'cancelled' }));
        }
        if(!result.success){
          usageStore.recordUsage(sessionUser.userId, { chargeable:false });
          safeLog('generate-failed', { jobId: jobId, status: result.status, errorKind: result.errorKind, retries: result.retries });
          var httpStatus = result.status || 502;
          var userMessage = { invalid_request:'요청 내용에 문제가 있습니다.', auth_error:'이미지 생성 서버 인증에 실패했습니다.', permission_error:'이미지 생성 권한이 없습니다.', timeout:'이미지 생성 시간이 초과되었습니다. 다시 시도해주세요.', network_error:'네트워크 오류로 이미지 생성에 실패했습니다.' }[result.errorKind] || '이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
          return res.status(httpStatus>=400&&httpStatus<600?httpStatus:502).json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
            error: { message: userMessage, code: result.errorKind } }));
        }

        usageStore.recordUsage(sessionUser.userId, { chargeable:true });
        var dataUrl = openaiProvider.decodeOpenAIImage(result.data, 'image/png');
        if(!dataUrl){
          safeLog('decode-failed', { jobId: jobId });
          return res.status(502).json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
            error: { message:'생성된 이미지를 읽을 수 없습니다. 다시 시도해주세요.', code:'decode_failed' } }));
        }
        safeLog('generate-success', { jobId: jobId, retries: result.retries });
        var dims = size.split('x');
        res.json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'completed',
          image: { mimeType:'image/png', width:parseInt(dims[0],10), height:parseInt(dims[1],10), objectUrl: dataUrl, sourceType:'generated' },
          usage: { costAvailable:false } }));
      }).catch(function(err){
        /* 예상치 못한 예외가 나더라도 응답을 반드시 보낸다 — 여기서 실패하면 클라이언트가
           영원히 응답을 기다리게 되는 것이 실제로 발견된 버그였다(req.on('close') 오작동).
           Prompt/API Key는 로그에 남기지 않는다. */
        delete abortControllers[jobId];
        if(responseSent || clientGone) return;
        responseSent = true;
        safeLog('generate-unexpected-error', { jobId: jobId, message: err && err.message });
        res.status(500).json(Contract.createResponse({ requestId: contractRequest.requestId, jobId: jobId, providerId:'openai-gpt-image', status:'failed',
          error: { message:'예기치 않은 오류로 이미지 생성에 실패했습니다.', code:'internal_error' } }));
      });
    });
  });

  app.post('/api/image-gateway/cancel', function(req, res){
    var jobId = req.body && req.body.jobId;
    var controller = abortControllers[jobId];
    if(!controller) return res.json({ cancelled:false });
    controller.abort();
    delete abortControllers[jobId];
    res.json({ cancelled:true });
  });

  app.get('/api/image-gateway/usage', function(req, res){
    res.json(usageStore.getOperatorTotal());
  });

  /* ── Anthropic Text Gateway — 자료 분석/제목 생성/전자책 생성/부분 재생성 등
     브라우저가 필요로 하는 모든 Anthropic Messages API 호출은 이 경로 하나만
     거친다. API Key는 서버 프로세스 환경변수에서만 읽고 브라우저로 전달하지
     않는다(구조: Browser → localhost:8910 → Node → Anthropic). */
  app.get('/api/anthropic-gateway/status', function(req, res){
    res.json({ configured: anthropicProvider.isConfigured(env) });
  });

  app.post('/api/anthropic-gateway/generate', function(req, res){
    var body = req.body || {};
    if(!anthropicProvider.isConfigured(env)){
      return res.status(503).json({ error: { message:'AI 서버에 Anthropic API 키가 설정되지 않았습니다.', code:'not_configured' } });
    }
    if(!Array.isArray(body.messages) || !body.messages.length){
      return res.status(400).json({ error: { message:'요청 형식이 올바르지 않습니다.', code:'invalid_request' } });
    }
    var requestBody = {
      model: body.model || anthropicProvider.DEFAULT_MODEL,
      max_tokens: body.max_tokens || 4096,
      system: body.system,
      messages: body.messages
    };
    /* callType은 Anthropic에 보내는 requestBody에는 포함하지 않는다(유효한 API
       필드가 아님) — 서버가 유닛 종류별로 타임아웃만 다르게 고르는 데 쓴다.
       Prompt 전문/API Key는 여기서도 절대 로그에 남기지 않는다. */
    var callType = body.callType || 'general';
    var acfg = anthropicProvider.config(env);
    var timeoutMs = callType==='chapter' ? acfg.chapterTimeoutMs : acfg.timeoutMs;
    safeLog('anthropic-generate-start', { callType: callType, model: requestBody.model, max_tokens: requestBody.max_tokens, timeoutMs: timeoutMs });
    anthropicProvider.generateWithRetry(requestBody, { env: env, fetchImpl: fetchImpl, timeoutMs: timeoutMs }).then(function(result){
      if(!result.success){
        safeLog('anthropic-generate-failed', { callType: callType, status: result.status, errorKind: result.errorKind, retries: result.retries });
        var httpStatus = result.status || 502;
        var userMessage;
        if(result.errorKind==='auth_error') userMessage = '❌ API 키 오류 — AI 서버의 Anthropic API 키를 확인해주세요.';
        else if(result.errorKind==='permission_error') userMessage = '❌ 권한 오류 — 크레딧이 부족하거나 키가 만료됐을 수 있습니다.';
        else if(result.errorKind==='retryable' && result.status===429) userMessage = '❌ 요청 한도 초과 — 잠시 후(30초~1분) 다시 시도해주세요.';
        else if(result.errorKind==='retryable') userMessage = '❌ AI 서버 오류 — 잠시 후 다시 시도해주세요.';
        else if(result.errorKind==='timeout') userMessage = '응답 시간이 초과되었습니다. 다시 시도해주세요.';
        else if(result.errorKind==='network_error') userMessage = '네트워크 오류로 요청에 실패했습니다.';
        else if(result.errorKind==='invalid_request') userMessage = '요청 내용에 문제가 있습니다.';
        else userMessage = 'AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.';
        return res.status(httpStatus>=400&&httpStatus<600?httpStatus:502).json({ error: { message:userMessage, code:result.errorKind } });
      }
      safeLog('anthropic-generate-success', { callType: callType, retries: result.retries });
      res.json(result.data);
    }).catch(function(err){
      safeLog('anthropic-generate-unexpected-error', { message: err && err.message });
      res.status(500).json({ error: { message:'예기치 않은 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  return { app: app, usageStore: usageStore, semaphore: semaphore };
}

if(require.main === module){
  var port = process.env.PORT || 8910;
  var built = createApp();
  built.app.listen(port, function(){
    console.log('Atlas Image Gateway listening on http://localhost:'+port+' (OpenAI configured: '+openaiProvider.isConfigured(process.env)+', Anthropic configured: '+anthropicProvider.isConfigured(process.env)+')');
  });
}

module.exports = { createApp: createApp };
