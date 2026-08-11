/* server/image-gateway.js — 2026-08-10: 사용자 지시로 상세페이지(Sales Page
   Studio)/썸네일 스튜디오 전체가 전면 삭제되면서 한때 이 서버가 서빙하던
   범용 다중 자산 OpenAI Images API 프록시(Contract/validator/Registry 기반)도
   함께 삭제됐었다. 2026-08-11: 전자책 완성 후 고정 4테마 썸네일 배경 이미지
   생성 기능이 다시 필요해져, 그 옛 파이프라인 전체가 아니라 꼭 필요한 절반
   (openaiProvider/rateLimiter, /api/image-gateway/*)만 최소 범위로 복원했다 —
   임의 프롬프트를 받는 범용 Contract/Registry/Composition Engine은 다시 만들지
   않는다(4개 고정 프롬프트만 필요하므로 그 무게가 불필요).
   session/trial 관리(image-usage-store.js)는 이미지 생성 전용이 아니라
   Anthropic 무료 체험 1회 게이트에도 쓰이는 공유 모듈이라 그대로 유지한다.

   선택한 구조: 순수 Node.js + Express. 이 프로젝트는 지금까지 빌드 도구/서버가 전혀
   없는 정적 프론트엔드였고(package.json도 없었음), Vercel/Netlify/Cloudflare Worker
   전용 설정 파일이나 배포 이력이 전혀 없어 특정 호스팅 벤더를 가정할 근거가 없다.
   Express는 (1) 의존성 1개로 정적 파일 서빙 + API 라우팅을 한 프로세스에서 모두
   해결하고, (2) 로컬 개발 서버(지금까지 python -m http.server로 임시 대체하던 것)를
   그대로 대체할 수 있고, (3) 특정 클라우드 벤더에 종속되지 않아 이후 어떤 배포
   환경(VPS/Docker/Render/Railway, 또는 필요하면 서버리스 핸들러로 감싸는 것)에도
   옮기기 쉽다 — 그래서 이번 Phase에서는 이 방식 하나만 선택했다. */

var express = require('express');
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

var usageStoreModule = require('./image-usage-store.js');
var anthropicProvider = require('./providers/anthropic-text-provider.js');
var openaiProvider = require('./providers/openai-image-provider.js');
var imageRateLimiter = require('./image-rate-limiter.js');

/* 2026-08-11: 썸네일 4테마(베스트셀러 에디토리얼/마켓플레이스 임팩트/문제 해결형/
   퍼블리셔 프리미엄) 배경 이미지 생성용 고정 프롬프트. 사용자가 실제로 GPT
   이미지 생성으로 만든 참고 이미지 4장(파일명이 이 4개 테마와 정확히 일치)의
   실제 내용을 확인해 반영했다 — 책+램프(베스트셀러)/쇼핑카트(마켓플레이스)/
   퍼즐+돋보기(문제 해결형)/왕관+월계관(퍼블리셔 프리미엄). 한글 텍스트는 이미지
   안에 넣지 않는다(OpenAI 이미지 생성이 한글 텍스트를 정확히 그리지 못함) —
   제목/부제/배지는 Atlas가 이 이미지를 배경으로 깔고 CSS로 얹는다. */
var THUMB_AI_THEME_PROMPTS = {
  bestseller: 'A warm, moody editorial still-life photograph of a neat stack of hardcover books on a dark wooden desk, illuminated by a classic brass desk lamp casting warm golden light, deep navy background, dramatic soft shadows, premium bestseller book-cover photography, cinematic lighting.',
  marketplace: 'A friendly flat-illustration style shopping cart filled with colorful shopping bags, warm cream and beige background, soft shadow beneath the cart, clean minimal commercial e-commerce illustration, vibrant orange and blue accent colors.',
  problem: 'A bold flat-illustration of a large jigsaw puzzle piece being examined by a magnifying glass, deep forest green background, clean modern vector-style illustration, confident problem-solving visual metaphor.',
  publisher: 'A luxurious illustration of a golden crown resting above a laurel wreath, deep navy background with subtle gold sparkle particles, premium majestic publishing-house emblem style, elegant symmetrical composition, soft golden rim light.'
};
var THUMB_AI_THEME_IDS = Object.keys(THUMB_AI_THEME_PROMPTS);

function createApp(opts){
  opts = opts || {};
  var env = opts.env || process.env;
  var fetchImpl = opts.fetchImpl; /* 테스트 전용 주입 — 프로덕션에서는 undefined(전역 fetch 사용) */
  var usageStore = usageStoreModule.createUsageStore(env);
  var thumbSemaphore = imageRateLimiter.createSemaphore(parseInt(env.OPENAI_IMAGE_MAX_CONCURRENCY, 10) || 2);

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

  /* ── Anthropic Text Gateway — 자료 분석/제목 생성/전자책 생성/부분 재생성 등
     브라우저가 필요로 하는 모든 Anthropic Messages API 호출은 이 경로 하나만
     거친다. API Key는 서버 프로세스 환경변수에서만 읽고 브라우저로 전달하지
     않는다(구조: Browser → localhost:8910 → Node → Anthropic). */
  app.get('/api/anthropic-gateway/status', function(req, res){
    var sessionUser = getSessionUser(req, res);
    var trialCheck = usageStore.checkTrialAllowed(sessionUser.userId);
    res.json({ configured: anthropicProvider.isConfigured(env), trialUsed: !trialCheck.allowed });
  });

  app.post('/api/anthropic-gateway/generate', function(req, res){
    var body = req.body || {};
    if(!anthropicProvider.isConfigured(env)){
      return res.status(503).json({ error: { message:'AI 서버에 Anthropic API 키가 설정되지 않았습니다.', code:'not_configured' } });
    }
    if(!Array.isArray(body.messages) || !body.messages.length){
      return res.status(400).json({ error: { message:'요청 형식이 올바르지 않습니다.', code:'invalid_request' } });
    }
    var callType = body.callType || 'general';
    var sessionUser = getSessionUser(req, res);
    /* "1회 무료 체험"은 전자책 본문 생성이 시작되는 시점(outline 호출, 전자책당
       정확히 1번만 발생)에서만 검사한다 — 제목 분석(callType 없음)이나 개별
       chapter/appendices 재시도는 체험 횟수를 소모하지 않는다(하나의 전자책을
       만드는 도중 재시도 때마다 막히면 안 되므로). */
    if(callType === 'outline'){
      var trialCheck = usageStore.checkTrialAllowed(sessionUser.userId);
      if(!trialCheck.allowed){
        return res.status(403).json({ error: { message:'무료 체험(1회)을 이미 사용하셨습니다. 구독 후 계속 이용해주세요.', code:'trial_exhausted' } });
      }
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
      if(callType === 'outline') usageStore.recordTrialUsed(sessionUser.userId);
      safeLog('anthropic-generate-success', { callType: callType, retries: result.retries });
      res.json(result.data);
    }).catch(function(err){
      safeLog('anthropic-generate-unexpected-error', { message: err && err.message });
      res.status(500).json({ error: { message:'예기치 않은 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* ── 썸네일 4테마 배경 이미지 생성 — 사용자가 각 카드에서 "AI 이미지 생성"을
     직접 눌렀을 때만 호출된다(자동 4장 생성 없음, 비용 통제). themeId는 4개
     고정값 중 하나만 허용 — 임의 프롬프트를 받지 않는다(내부 기획 문서 유출
     위험이 애초에 없는 구조). */
  app.get('/api/image-gateway/status', function(req, res){
    res.json({ configured: openaiProvider.isConfigured(env) });
  });

  app.post('/api/image-gateway/generate', function(req, res){
    var themeId = (req.body || {}).themeId;
    if(THUMB_AI_THEME_IDS.indexOf(themeId) === -1){
      return res.status(400).json({ error: { message:'알 수 없는 테마입니다.', code:'invalid_theme' } });
    }
    if(!openaiProvider.isConfigured(env)){
      return res.status(503).json({ error: { message:'AI 서버에 OpenAI API 키가 설정되지 않았습니다.', code:'not_configured' } });
    }
    var cfg = openaiProvider.config(env);
    safeLog('openai-generate-start', { themeId: themeId, model: cfg.model });
    thumbSemaphore.acquire().then(function(release){
      openaiProvider.generateWithRetry(THUMB_AI_THEME_PROMPTS[themeId], {
        env: env, fetchImpl: fetchImpl, size: '1536x1024'
      }).then(function(result){
        release();
        if(!result.success){
          var apiError = (result.data && result.data.error) || null;
          console.error('[image-gateway] openai-generate-failed', {
            themeId: themeId, status: result.status, errorKind: result.errorKind,
            message: apiError && apiError.message, retries: result.retries
          });
          var httpStatus = result.status || 502;
          return res.status(httpStatus>=400&&httpStatus<600?httpStatus:502).json({
            error: {
              message: (apiError && apiError.message) || (result.errorKind==='network_error' ? '네트워크 오류로 이미지 생성 서버에 연결하지 못했습니다.' : result.errorKind==='timeout' ? '응답 시간이 초과되었습니다.' : '이미지 생성에 실패했습니다.'),
              code: result.errorKind
            }
          });
        }
        var imageDataUrl = openaiProvider.decodeOpenAIImage(result.data);
        if(!imageDataUrl){
          return res.status(502).json({ error: { message:'이미지 생성 응답을 해석하지 못했습니다.', code:'decode_failed' } });
        }
        safeLog('openai-generate-success', { themeId: themeId, retries: result.retries });
        res.json({ imageDataUrl: imageDataUrl });
      }).catch(function(err){
        release();
        safeLog('openai-generate-unexpected-error', { themeId: themeId, message: err && err.message });
        res.status(500).json({ error: { message:'예기치 않은 오류가 발생했습니다.', code:'internal_error' } });
      });
    });
  });

  return { app: app, usageStore: usageStore };
}

if(require.main === module){
  var port = process.env.PORT || 8910;
  var built = createApp();
  built.app.listen(port, function(){
    console.log('Atlas Gateway listening on http://localhost:'+port+' (Anthropic configured: '+anthropicProvider.isConfigured(process.env)+')');
  });
}

module.exports = { createApp: createApp };
