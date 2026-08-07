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
var fs = require('fs');

/* .env 로딩을 CLI 플래그(package.json의 --env-file-if-exists)에만 의존하지 않는다 —
   실제 발견된 버그: `node server/image-gateway.js`를 직접 실행하면(=npm start를 거치지
   않으면) 그 플래그가 아예 전달되지 않아 .env가 조용히 무시되고, API Key가 실제로
   .env에 있어도 configured:false로 남는다. 새 의존성(dotenv) 없이, 이 파일이 시작될
   때 직접 .env를 읽어 process.env에 채워 넣는다 — 어떤 방식으로 실행하든(node 직접
   실행/npm start/다른 Node 버전) 항상 동작한다. 이미 셸에 설정된 실제 환경변수는
   덮어쓰지 않는다(우선순위 유지, dotenv의 기본 동작과 동일). */
(function loadDotEnvIfPresent(){
  var envPath = path.join(__dirname, '..', '.env');
  var raw;
  try{ raw = fs.readFileSync(envPath, 'utf8'); }
  catch(e){ return; } /* .env가 없으면 조용히 넘어간다 — 실제 셸 환경변수만으로 운영하는 경우도 있다 */
  raw.split('\n').forEach(function(line){
    line = line.replace(/\r$/, '').trim();
    if(!line || line.charAt(0) === '#') return;
    var eq = line.indexOf('=');
    if(eq === -1) return;
    var key = line.slice(0, eq).trim();
    var value = line.slice(eq + 1).trim();
    if(/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    if(key && !(key in process.env)) process.env[key] = value;
  });
})();

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

  /* Atlas는 GitHub Pages 같은 정적 호스팅에서도 열릴 수 있다 — 그 페이지의 origin과
     이 로컬 Gateway(http://localhost:8910)는 서로 다른 origin이므로, 허용 목록에
     있는 Origin에서 온 요청에는 CORS 헤더를 붙여준다(신규 npm 의존성 없이 직접
     구현 — 이 프로젝트는 의존성을 최소로 유지한다).

     실제 버그 리포트(로컬 재현): Atlas 프론트엔드를 Gateway(8910)와 다른 포트의
     로컬 정적 서버(예: localhost:8080)로 열면, js/atlas-gateway-base-url.js의
     resolve()가 이제(수정됨) 항상 실제 Gateway origin(localhost:8910)을
     정확히 가리키지만 — 이 허용 목록이 정확히 "https://enfldka-web.github.io"
     문자열만 허용했기 때문에 localhost:8080에서 온 요청은 CORS로 차단되어
     브라우저가 응답을 읽지 못했다(Settings가 "AI 서버가 실행되지 않았습니다"로
     표시된 실제 두 번째 원인 — resolve() 하나만 고치는 것으로는 부족했다).
     이 서버는 로컬 단일 사용자 서버이므로(주석 §83 참고), 어떤 포트로 열든
     localhost/127.0.0.1에서 온 요청은 항상 신뢰할 수 있다 — 특정 포트 번호를
     하드코딩하는 대신 "localhost/127.0.0.1 origin이면 전부 허용"으로 한 번에
     해결한다(다른 사용자가 8080이 아닌 3000/5500 등 다른 포트를 써도 동작). */
  var CORS_ALLOWED_ORIGINS = (env.ATLAS_CORS_ALLOWED_ORIGINS || 'https://enfldka-web.github.io').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  var LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  function isAllowedOrigin(origin){
    return !!origin && (LOCAL_ORIGIN_RE.test(origin) || CORS_ALLOWED_ORIGINS.indexOf(origin) !== -1);
  }

  var app = express();
  app.use(function(req, res, next){
    var origin = req.headers.origin;
    if(isAllowedOrigin(origin)){
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if(req.method==='OPTIONS') return res.sendStatus(204);
    next();
  });
  /* 200kb는 이미지 생성 요청(프롬프트 텍스트만)에는 충분하지만, 같은 게이트웨이가
     처리하는 /api/anthropic-gateway/generate는 업로드된 PDF/Word 문서에서 추출한
     본문 전체를 요청 본문에 실어 보낸다 — 실제 전자책 원고 분량에서는 200kb를
     쉽게 넘겨 Anthropic에 도달하기도 전에 Express가 413으로 거부한다(실제 발견된
     버그). 로컬 단일 사용자 서버라 더 넉넉한 한도가 안전하다. */
  app.use(express.json({ limit:'20mb' }));
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
    /* outline(목차/서문/서론/결론/7개 챕터 브리핑/부록 제목/저작권/판매 카피)과
       appendices(체크리스트/도구 비교표/실행 플랜 3개)는 모두 max_tokens가
       chapter 못지않게 크다(실제 Windows에서 각각 6000/5000으로는 부족해
       응답이 중간에 잘려 JSON이 깨지는 문제가 재현됨) — 같은 넉넉한 타임아웃을
       적용한다. */
    var timeoutMs = (callType==='chapter'||callType==='outline'||callType==='appendices') ? acfg.chapterTimeoutMs : acfg.timeoutMs;
    safeLog('anthropic-generate-start', { callType: callType, model: requestBody.model, max_tokens: requestBody.max_tokens, timeoutMs: timeoutMs });
    anthropicProvider.generateWithRetry(requestBody, { env: env, fetchImpl: fetchImpl, timeoutMs: timeoutMs }).then(function(result){
      if(!result.success){
        /* Anthropic이 실제로 반환한 error.type/error.message/response body를 절대
           숨기지 않는다 — 예전처럼 "요청 내용에 문제가 있습니다" 같은 뭉뚱그린
           한국어 메시지로 감싸지 않는다(디버깅 불가능했던 원인). API Key 값
           자체만 여전히 로그/응답 어디에도 남기지 않는다(Anthropic 에러 바디에는
           애초에 키 값이 포함되지 않는다). */
        var anthropicError = (result.data && result.data.error) || null;
        console.error('[image-gateway] anthropic-generate-failed', {
          callType: callType,
          status: result.status,
          type: anthropicError && anthropicError.type,
          message: anthropicError && anthropicError.message,
          errorKind: result.errorKind,
          retries: result.retries,
          body: result.data || null
        });
        var httpStatus = result.status || 502;
        return res.status(httpStatus>=400&&httpStatus<600?httpStatus:502).json({
          error: {
            status: result.status || null,
            type: (anthropicError && anthropicError.type) || result.errorKind,
            message: (anthropicError && anthropicError.message) || (result.errorKind==='network_error' ? '네트워크 오류로 Anthropic 서버에 연결하지 못했습니다.' : result.errorKind==='timeout' ? '응답 시간이 초과되었습니다.' : 'AI 응답 생성에 실패했습니다.'),
            raw: result.data || null
          }
        });
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
