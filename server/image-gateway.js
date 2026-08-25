/* server/image-gateway.js — 2026-08-10: 사용자 지시로 상세페이지(Sales Page
   Studio)/썸네일 스튜디오 전체가 전면 삭제되면서 한때 이 서버가 서빙하던
   범용 다중 자산 OpenAI Images API 프록시(Contract/validator/Registry 기반)도
   함께 삭제됐었다. 2026-08-11: 전자책 완성 후 고정 4테마 썸네일 배경 이미지
   생성 기능이 다시 필요해져 절반만 복원했었으나, 2026-08-13: 사용자가
   "썸네일·상세페이지는 개인이 AI를 이용해서 만드는 게 낫다"고 다시 판단해
   이번엔 이미지 생성 기능 자체(/api/image-gateway/*, openaiProvider,
   image-rate-limiter.js)를 완전히 제거했다 — 클라이언트가 AI 호출 없이
   프롬프트 문자열만 조합해 보여주는 방식으로 대체됐다(js/application.js
   atlasBuildThumbnailPrompt/atlasBuildSalesPagePrompt 참고). 이 파일은 이제
   Anthropic 텍스트 생성 게이트웨이(/api/anthropic-gateway/*)만 서빙한다.
   session/trial 관리(image-usage-store.js)는 그대로 유지한다.

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

var anthropicProvider = require('./providers/anthropic-text-provider.js');
var tossProvider = require('./providers/toss-payments-provider.js');
var resendProvider = require('./providers/resend-email-provider.js');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var dbModule = require('./db.js');

var BCRYPT_ROUNDS = 10;
var JWT_EXPIRES_IN = '30d';
var SUBSCRIPTION_AMOUNT = 29000;
var BILLING_CHECK_INTERVAL_MS = 24*60*60*1000; /* 하루 1회 — next_billing_at이 지난 구독을 찾아 청구 */

function createApp(opts){
  opts = opts || {};
  var env = opts.env || process.env;
  var fetchImpl = opts.fetchImpl; /* 테스트 전용 주입 — 프로덕션에서는 undefined(전역 fetch 사용) */

  /* 2026-08-13: 실제 회원가입/로그인 + DB 기반 구독 상태. DATABASE_URL/
     JWT_SECRET이 없으면(로컬 개발 초기 설정 전, 또는 Render 대시보드에
     아직 값을 안 넣은 상태) 서버 전체가 죽지 않고 /api/auth/*·/api/payments/*
     라우트만 503으로 "설정되지 않음"을 알린다 — ANTHROPIC_API_KEY가 없을 때
     기존 라우트가 취하는 것과 같은 원칙(부분 기능 저하, 전체 크래시 아님).
     테스트에서는 opts.db(연결 문자열을 이미 주입한 db 인스턴스)를 직접
     넘겨 실제 로컬 Postgres를 붙이거나, opts.dbConnectionString으로 다른
     접속 문자열을 지정할 수 있다. */
  var db = opts.db || null;
  if(!db){
    var dbConnStr = opts.dbConnectionString || env.DATABASE_URL;
    if(dbConnStr){
      try{ db = dbModule.createDb({ connectionString: dbConnStr }); }
      catch(e){ console.error('[image-gateway] db-init-failed', e.message); db = null; }
    }
  }
  var JWT_SECRET = opts.jwtSecret || env.JWT_SECRET || null;
  /* 2026-08-14: 사용자(서비스 운영자 본인) 지시 — 관리자 계정은 무료체험
     1회 제한/구독 없이 항상 이용할 수 있어야 한다. Render 대시보드
     Environment 탭에서 본인이 직접 관리할 수 있게 DB 컬럼 대신 이메일
     허용목록 환경변수(ADMIN_EMAILS, 쉼표로 구분)로 둔다 — 대소문자/공백은
     무시하고 비교한다. */
  var ADMIN_EMAILS = String(env.ADMIN_EMAILS||'').split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean);
  function isAdminEmail(email){ return !!email && ADMIN_EMAILS.indexOf(String(email).toLowerCase())!==-1; }
  var dbReady = db ? db.ensureSchema().catch(function(e){
    console.error('[image-gateway] db-schema-init-failed', e.message);
    alertOps('DB 스키마 초기화 실패 — 서버 전체가 503으로 응답 중', { message: e.message });
    db = null; /* 스키마 준비 자체가 실패하면(접속 불가 등) 이후 쿼리도 다 실패할 것이므로 db를 비워 503으로 통일한다 */
  }) : Promise.resolve();

  function authConfigured(){ return !!(db && JWT_SECRET); }
  function issueToken(userId){ return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); }
  /* Authorization: Bearer <token> 헤더를 검증해 user id를 돌려준다 — 유효하지
     않거나 없으면 null. 예전의 쿠키 기반 익명 세션(atlas_session_id, 서버
     재시작 시 초기화되던 image-usage-store.js — 이제 삭제됨) 대신 토큰
     방식을 쓰는 이유: ATLAS_CORS_ALLOWED_ORIGINS로 크로스오리진(GitHub
     Pages↔Render) 배포가 이미 전제된 구조인데, 이 CORS 미들웨어가
     Access-Control-Allow-Credentials를
     보내지 않아 쿠키가 크로스오리진에서 안정적으로 오가지 못한다 —
     Authorization 헤더는 이 제약이 없다. */
  function verifyAuthHeader(req){
    var header = req.headers.authorization || '';
    var m = header.match(/^Bearer\s+(.+)$/);
    if(!m) return null;
    try{
      var payload = jwt.verify(m[1], JWT_SECRET);
      return payload && payload.sub ? payload.sub : null;
    }catch(e){ return null; }
  }
  function userPublicShape(userRow, subRow){
    return {
      id: userRow.id, email: userRow.email, name: userRow.name,
      trialUsed: !!userRow.trial_used,
      subscriptionStatus: (subRow && subRow.status) || 'inactive',
      // 2026-08-14: 구독 취소 기능 — 취소를 누르면 즉시 해지되지 않고 "이번
      // 결제 주기가 끝나는 날까지는 계속 이용, 그 다음부터 자동 해지"로
      // 동작한다(실제 SaaS들의 일반적인 방식이자 사용자가 이미 낸 돈만큼은
      // 계속 쓸 수 있어야 한다는 원칙). Settings 화면이 이 두 값으로 "다음
      // 결제일에 자동 해지 예정" 안내와 "구독 유지하기"(취소 철회) 버튼을
      // 보여줄지 판단한다.
      subscriptionCancelAtPeriodEnd: !!(subRow && subRow.cancel_at_period_end),
      subscriptionNextBillingAt: (subRow && subRow.next_billing_at) || null,
      // 2026-08-14: 사용자 지시 — 관리자 계정이면 화면에 "관리자"로 표시되어야
      // 한다. isAdminEmail()이 이미 무료체험 우회 판단에 쓰이는 그 함수 그대로다
      // (기준이 하나로 통일 — ADMIN_EMAILS에 있으면 우회도 되고 배지도 바뀐다).
      isAdmin: isAdminEmail(userRow.email)
    };
  }
  function fetchUserWithSub(userId){
    return db.query('SELECT * FROM users WHERE id=$1', [userId]).then(function(ur){
      var userRow = ur.rows[0];
      if(!userRow) return null;
      return db.query('SELECT * FROM subscriptions WHERE user_id=$1', [userId]).then(function(sr){
        return { userRow: userRow, subRow: sr.rows[0] || null };
      });
    });
  }

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
  /* 2026-08-14: 실제 재현된 버그 — 로그인 토큰(Authorization 헤더)이 이미
     저장된 브라우저에서는(재방문자 자동 로그인 /api/auth/me, 또는 로그인된
     채로 다른 요청을 보낼 때) atlasAuthFetch()가 모든 요청에 Authorization
     헤더를 붙이는데(js/application.js), 이 CORS 미들웨어가 지금까지
     Access-Control-Allow-Headers에 Content-Type만 허용해서 브라우저가
     preflight 단계에서 그 요청 자체를 통째로 막아버렸다(콘솔: "Request
     header field authorization is not allowed by Access-Control-Allow-Headers
     in preflight response") — 토큰이 없는 최초 로그인/가입은 Authorization을
     안 보내므로 우연히 통과했었을 뿐, 재방문자 자동 로그인은 배포된 사이트에서
     계속 조용히 실패하고 있었을 것이다. Authorization을 허용 목록에 추가한다. */
  app.use(function(req, res, next){
    var origin = req.headers.origin;
    if(isAllowedOrigin(origin)){
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
  /* 2026-08-21: 실제 SaaS 출시 전 점검에서 발견된 공백 — 서버 장애/결제
     실패가 console.log(safeLog)에만 남고 아무도 실시간으로 알 방법이
     없었다. Sentry 같은 전용 SDK를 새 의존성으로 추가하는 대신(이 파일
     전체가 지켜온 "직접 fetch 호출, SDK 의존성 추가 없음" 원칙 —
     resend-email-provider.js/toss-payments-provider.js와 동일), 범용
     웹훅 URL(OPS_ALERT_WEBHOOK_URL) 하나에 {text:...} 형태로 POST한다 —
     Slack/Discord Incoming Webhook이 이 형식을 그대로 받아들이므로 별도
     서비스 가입 없이(이미 쓰는 Slack/Discord만 있으면) 바로 동작한다.
     값이 없으면(설정 전) 조용히 아무 것도 하지 않는다 — 다른 선택적
     기능들과 동일한 원칙. 알림 자체가 실패해도(웹훅 URL이 잘못됐거나
     네트워크 문제) 원래 처리 흐름을 절대 막지 않는다(catch로 삼킴). */
  function alertOps(label, meta){
    if(!env.OPS_ALERT_WEBHOOK_URL) return;
    var f = fetchImpl || fetch;
    var msg = '[Atlas 운영 알림] '+label+' — '+JSON.stringify(meta||{});
    /* Slack Incoming Webhook은 "text" 키를, Discord Webhook은 "content" 키를
       메시지 본문으로 읽는다 — 서로 모르는 키는 조용히 무시하므로, 둘 다
       같이 보내면 어느 쪽 웹훅 URL을 넣든 추가 설정 없이 그대로 동작한다. */
    f(env.OPS_ALERT_WEBHOOK_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ text: msg, content: msg })
    }).catch(function(){});
  }

  /* 2026-08-13: "1회 무료 체험"이 예전엔 usageStore(메모리, 익명 세션 쿠키)
     기준이었다 — 서버 재시작 시 초기화되고 실제 계정과 무관했다. 이제 실제
     로그인 계정의 users.trial_used / subscriptions.status(DB, 영구 저장)를
     기준으로 판단한다. 구독 중(status==='active')이면 무료체험 소진 여부와
     무관하게 항상 허용한다. */
  function fetchTrialSubStatus(userId){
    return db.query('SELECT trial_used, email, deleted_at FROM users WHERE id=$1', [userId]).then(function(ur){
      var userRow = ur.rows[0];
      // 탈퇴 처리된 계정은 존재하지 않는 것과 동일하게 취급한다(아래 null
      // 처리와 합류) — 그렇지 않으면 탈퇴 후에도 유효한 토큰이 남아있는 한
      // trial_used:false로 다시 무료체험을 소모할 수 있는 구멍이 생긴다.
      if(!userRow || userRow.deleted_at) return null;
      // 관리자 이메일은 구독 중인 것과 동일하게 취급해 무료체험 제한을
      // 완전히 우회한다 — 아래 /generate의 outline 게이트도 이 값 하나만
      // 보고 판단하므로 별도 우회 분기를 추가할 필요가 없다.
      if(isAdminEmail(userRow.email)) return { trialUsed: false, subscribed: true };
      return db.query('SELECT status FROM subscriptions WHERE user_id=$1', [userId]).then(function(sr){
        var subRow = sr.rows[0];
        return { trialUsed: !!userRow.trial_used, subscribed: !!(subRow && subRow.status==='active') };
      });
    });
  }

  /* ── Anthropic Text Gateway — 자료 분석/제목 생성/전자책 생성/부분 재생성 등
     브라우저가 필요로 하는 모든 Anthropic Messages API 호출은 이 경로 하나만
     거친다. API Key는 서버 프로세스 환경변수에서만 읽고 브라우저로 전달하지
     않는다(구조: Browser → localhost:8910 → Node → Anthropic). */
  app.get('/api/anthropic-gateway/status', function(req, res){
    var configured = anthropicProvider.isConfigured(env);
    var userId = authConfigured() ? verifyAuthHeader(req) : null;
    if(!userId){
      /* 로그인 전이면 아직 생성 버튼 자체에 도달할 수 없으므로(클라이언트가
         로그인해야만 변환기 화면에 진입한다) trialUsed:false가 안전한 기본값
         — 실제 차단은 어차피 /generate가 인증을 다시 요구한다. */
      return res.json({ configured: configured, trialUsed: false, subscribed: false });
    }
    dbReady.then(function(){
      if(!db) return { trialUsed:false, subscribed:false };
      return fetchTrialSubStatus(userId).then(function(s){ return s || { trialUsed:false, subscribed:false }; });
    }).then(function(s){
      res.json({ configured: configured, trialUsed: s.trialUsed, subscribed: s.subscribed });
    }).catch(function(err){
      safeLog('status-check-error', { message: err && err.message });
      res.json({ configured: configured, trialUsed: false, subscribed: false });
    });
  });

  /* 2026-08-21: /api/anthropic-gateway/generate 요청 빈도 제한 — 실제 SaaS
     출시 전 점검에서 발견된 공백. 구독 중이면 canGenerate()가 무제한 호출을
     허용하는데, 짧은 시간에 반복 호출을 막을 장치가 전혀 없어 비용 남용
     위험이 있었다. 메모리 기반 슬라이딩 윈도우로 충분하다 — 서버 재시작
     시 초기화되는 것도(MVP 범위) 실질적 위협은 아니다: 남용의 핵심은
     "짧은 시간에 폭주"이지, 재시작 순간 카운터가 비는 것 자체가 새로운
     공격 경로가 되지는 않는다. 사용자별로 제한하는 게 이상적이지만, 이
     라우트는 outline 호출만 인증을 강제하고(§ 무료체험 게이트) chapter/
     appendices/review는 별도 인증 검사가 없다 — 다만 클라이언트는 로그인
     토큰이 있으면 모든 호출에 Authorization 헤더를 싣는다(js/anthropic-
     gateway-client.js authHeader()) 실제로는 거의 항상 userId를 얻을 수
     있다. 토큰이 전혀 없는 극히 드문 경우에만 전체 공유 버킷('anon')으로
     떨어진다 — Render 프록시 뒤에서 req.ip가 신뢰할 수 있는 값인지
     (trust proxy 설정) 확인 없이 IP 기준으로 나누면 오히려 여러 사용자를
     한 버킷으로 잘못 묶어 무고한 사용자를 막을 위험이 있어, 그 위험을
     감수하지 않는 더 단순하고 안전한 선택이다. */
  var GENERATE_RATE_WINDOW_MS = 10*60*1000;
  var GENERATE_RATE_MAX = 30;
  var generateRateLog = {};
  function checkGenerateRateLimit(key){
    var now = Date.now();
    var arr = (generateRateLog[key]||[]).filter(function(t){ return now-t < GENERATE_RATE_WINDOW_MS; });
    if(arr.length >= GENERATE_RATE_MAX){ generateRateLog[key] = arr; return false; }
    arr.push(now);
    generateRateLog[key] = arr;
    return true;
  }
  app.post('/api/anthropic-gateway/generate', function(req, res){
    var body = req.body || {};
    var rateLimitKey = (authConfigured() && verifyAuthHeader(req)) || 'anon';
    if(!checkGenerateRateLimit(rateLimitKey)){
      return res.status(429).json({ error: { message:'요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.', code:'rate_limited' } });
    }
    if(!anthropicProvider.isConfigured(env)){
      return res.status(503).json({ error: { message:'AI 서버에 Anthropic API 키가 설정되지 않았습니다.', code:'not_configured' } });
    }
    if(!Array.isArray(body.messages) || !body.messages.length){
      return res.status(400).json({ error: { message:'요청 형식이 올바르지 않습니다.', code:'invalid_request' } });
    }
    var callType = body.callType || 'general';

    function runGeneration(outlineUserId){
      var requestBody = {
        model: body.model || anthropicProvider.DEFAULT_MODEL,
        max_tokens: body.max_tokens || 4096,
        system: body.system,
        messages: body.messages
      };
      /* callType은 Anthropic에 보내는 requestBody에는 포함하지 않는다(유효한 API
         필드가 아님) — 서버가 유닛 종류별로 타임아웃만 다르게 고르는 데 쓴다.
         Prompt 전문/API Key는 여기서도 절대 로그에 남기지 않는다. */
      var acfg = anthropicProvider.config(env);
      /* outline(목차/서문/서론/결론/7개 챕터 브리핑/부록 제목/저작권/판매 카피)과
         appendices(체크리스트/도구 비교표/실행 플랜 3개)는 모두 max_tokens가
         chapter 못지않게 크다(실제 Windows에서 각각 6000/5000으로는 부족해
         응답이 중간에 잘려 JSON이 깨지는 문제가 재현됨) — 같은 넉넉한 타임아웃을
         적용한다. review(전체 원고 검수 — 서론+7챕터+결론을 통째로 되돌려 받음,
         max_tokens=32000)는 이 중에서도 가장 큰 응답이라 반드시 같은 목록에
         포함한다. */
      var timeoutMs = (callType==='chapter'||callType==='outline'||callType==='appendices'||callType==='review') ? acfg.chapterTimeoutMs : acfg.timeoutMs;
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
          /* network_error/timeout, 또는 Anthropic 쪽 5xx는 "이 요청 하나가
             잘못됨"이 아니라 인프라/업스트림 장애 신호다 — 실시간으로 알
             가치가 있는 경우만 골라 alertOps를 울린다(단순 4xx는 대개
             요청 자체의 문제라 매번 알림을 울리면 소음이 된다). */
          if(result.errorKind==='network_error' || result.errorKind==='timeout' || (result.status && result.status>=500)){
            alertOps('Anthropic 업스트림 장애('+(result.errorKind||result.status)+')', { callType: callType, status: result.status, errorKind: result.errorKind });
          }
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
        if(callType === 'outline' && outlineUserId){
          db.query('UPDATE users SET trial_used=true WHERE id=$1', [outlineUserId]).catch(function(e){
            safeLog('trial-mark-failed', { userId: outlineUserId, message: e && e.message });
          });
        }
        safeLog('anthropic-generate-success', { callType: callType, retries: result.retries });
        res.json(result.data);
      }).catch(function(err){
        safeLog('anthropic-generate-unexpected-error', { message: err && err.message });
        alertOps('전자책 생성 호출 중 예기치 않은 오류', { message: err && err.message });
        res.status(500).json({ error: { message:'예기치 않은 오류가 발생했습니다.', code:'internal_error' } });
      });
    }

    /* "1회 무료 체험"은 전자책 본문 생성이 시작되는 시점(outline 호출, 전자책당
       정확히 1번만 발생)에서만 검사한다 — 제목 분석(callType 없음)이나 개별
       chapter/appendices 재시도는 체험 횟수를 소모하지 않는다(하나의 전자책을
       만드는 도중 재시도 때마다 막히면 안 되므로). 실제 로그인 계정 기준이라
       인증이 반드시 필요하다 — 클라이언트는 이미 로그인해야만 이 화면에
       도달하므로 여기서 막히는 건 토큰 만료/변조 같은 비정상 상황뿐이다. */
    if(callType === 'outline'){
      if(!authConfigured()) return res.status(503).json({ error: { message:'회원 인증이 아직 설정되지 않았습니다.', code:'not_configured' } });
      var userId = verifyAuthHeader(req);
      if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
      dbReady.then(function(){
        if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
        return fetchTrialSubStatus(userId);
      }).then(function(s){
        if(!s) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
        if(!s.subscribed && s.trialUsed){
          return res.status(403).json({ error: { message:'무료 체험(1회)을 이미 사용하셨습니다. 구독 후 계속 이용해주세요.', code:'trial_exhausted' } });
        }
        runGeneration(userId);
      }).catch(function(err){
        if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
        safeLog('trial-check-error', { message: err && err.message });
        res.status(500).json({ error: { message:'무료체험 확인 중 오류가 발생했습니다.', code:'internal_error' } });
      });
    } else {
      runGeneration(null);
    }
  });

  /* 2026-08-14: 사용자 지시 — 회원가입이 이름/이메일/비밀번호만으로 너무
     간단하게 뚫려서, 실제로 그 이메일을 소유한 사람인지 6자리 인증번호로
     확인하는 단계를 추가한다. email_verifications 테이블에 이메일당 코드
     하나만 유지한다(재요청 시 UPSERT로 덮어씀) — 아직 계정이 생기기 전
     단계라 users와 독립적이다. 코드는 해시하지 않고 평문 저장하는데,
     bcrypt 해시 비용을 들일 만큼 가치 있는 비밀이 아니기 때문이다(6자리
     숫자, 10분 만료, 시도 5회 제한, 60초 재전송 제한으로 이미 충분히
     보호됨 — 실제 공격 표면은 "이메일 발신 자체를 흉내낼 수 있는가"이지
     "저장된 코드를 훔쳐볼 수 있는가"가 아니다). */
  var VERIFICATION_CODE_TTL_MS = 10*60*1000;
  var VERIFICATION_RESEND_COOLDOWN_MS = 60*1000;
  var VERIFICATION_MAX_ATTEMPTS = 5;
  function emailConfigured(){ return !!(db && resendProvider.isConfigured(env)); }
  app.post('/api/auth/send-verification', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'회원가입 기능이 아직 설정되지 않았습니다(DATABASE_URL/JWT_SECRET 필요).', code:'not_configured' } });
    if(!emailConfigured()) return res.status(503).json({ error: { message:'이메일 인증 기능이 아직 설정되지 않았습니다(RESEND_API_KEY 필요).', code:'not_configured' } });
    var body = req.body || {};
    var email = String(body.email || '').trim().toLowerCase();
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: { message:'올바른 이메일 주소를 입력해주세요.', code:'invalid_request' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message: 'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT id FROM users WHERE email=$1', [email]);
    }).then(function(existing){
      if(existing.rows.length) return Promise.reject({ httpStatus: 409, message:'이미 사용 중인 이메일입니다.', code:'email_taken' });
      return db.query('SELECT last_sent_at FROM email_verifications WHERE email=$1', [email]);
    }).then(function(prev){
      var prevRow = prev.rows[0];
      if(prevRow && (Date.now() - new Date(prevRow.last_sent_at).getTime()) < VERIFICATION_RESEND_COOLDOWN_MS){
        return Promise.reject({ httpStatus: 429, message:'인증번호를 너무 자주 요청했습니다. 잠시 후 다시 시도해주세요.', code:'rate_limited' });
      }
      var code = String(crypto.randomInt(100000, 1000000));
      var expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
      return db.query(
        'INSERT INTO email_verifications (email, code, attempts, expires_at, last_sent_at) VALUES ($1,$2,0,$3,now()) ' +
        'ON CONFLICT (email) DO UPDATE SET code=$2, attempts=0, expires_at=$3, last_sent_at=now()',
        [email, code, expiresAt]
      ).then(function(){
        return resendProvider.sendVerificationEmail({ env: env, fetchImpl: fetchImpl, to: email, code: code });
      }).then(function(sendResult){
        if(!sendResult.ok){
          safeLog('send-verification-email-failed', { status: sendResult.status, body: sendResult.data });
          return Promise.reject({ httpStatus: 502, message:'인증번호 이메일 발송에 실패했습니다.', code:'email_send_failed' });
        }
        res.json({ ok:true });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('send-verification-error', { message: err && err.message });
      res.status(500).json({ error: { message:'인증번호 발송 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* ── 실제 회원가입/로그인 — 2026-08-13: 기존 로그인은 브라우저
     localStorage에만 저장되는 가짜 계정(비밀번호도 btoa일 뿐 해시가 아님)
     이었고, 세션이 없으면 무조건 pro 유저로 자동 로그인시켜 로그인 화면
     자체를 우회했다. 이제 진짜 서버 검증 + bcrypt 해시 + Postgres 영구
     저장으로 바뀐다. 2026-08-14: 이메일 인증번호(code) 확인 단계 추가. */
  app.post('/api/auth/signup', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'회원가입 기능이 아직 설정되지 않았습니다(DATABASE_URL/JWT_SECRET 필요).', code:'not_configured' } });
    var body = req.body || {};
    var name = String(body.name || '').trim();
    var email = String(body.email || '').trim().toLowerCase();
    var password = String(body.password || '');
    var code = String(body.code || '').trim();
    if(!name || !email || !password || !code) return res.status(400).json({ error: { message:'이름, 이메일, 비밀번호, 인증번호를 모두 입력해주세요.', code:'invalid_request' } });
    if(password.length < 8) return res.status(400).json({ error: { message:'비밀번호는 8자 이상이어야 합니다.', code:'weak_password' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message: 'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT id FROM users WHERE email=$1', [email]);
    }).then(function(existing){
      if(existing.rows.length) return Promise.reject({ httpStatus: 409, message:'이미 사용 중인 이메일입니다.', code:'email_taken' });
      return db.query('SELECT code, attempts, expires_at FROM email_verifications WHERE email=$1', [email]);
    }).then(function(vr){
      var vrow = vr.rows[0];
      if(!vrow) return Promise.reject({ httpStatus: 400, message:'먼저 이메일로 인증번호를 받아주세요.', code:'verification_not_requested' });
      if(new Date(vrow.expires_at).getTime() < Date.now()) return Promise.reject({ httpStatus: 400, message:'인증번호가 만료되었습니다. 다시 요청해주세요.', code:'verification_expired' });
      if(vrow.attempts >= VERIFICATION_MAX_ATTEMPTS) return Promise.reject({ httpStatus: 400, message:'인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.', code:'verification_too_many_attempts' });
      if(vrow.code !== code){
        return db.query('UPDATE email_verifications SET attempts=attempts+1 WHERE email=$1', [email]).then(function(){
          return Promise.reject({ httpStatus: 400, message:'인증번호가 올바르지 않습니다.', code:'verification_mismatch' });
        });
      }
      return bcrypt.hash(password, BCRYPT_ROUNDS);
    }).then(function(hash){
      return db.query('INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING *', [email, hash, name]);
    }).then(function(ur){
      var userRow = ur.rows[0];
      return db.query('INSERT INTO subscriptions (user_id, status) VALUES ($1,$2) RETURNING *', [userRow.id, 'inactive']).then(function(sr){
        db.query('DELETE FROM email_verifications WHERE email=$1', [email]).catch(function(){});
        var token = issueToken(userRow.id);
        safeLog('auth-signup-success', { userId: userRow.id });
        res.json({ token: token, user: userPublicShape(userRow, sr.rows[0]) });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('auth-signup-error', { message: err && err.message });
      res.status(500).json({ error: { message:'회원가입 처리 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* 2026-08-21: 로그인 무차별 대입 방지 — 실제 SaaS 출시 전 점검에서 발견된
     공백. 이메일 인증번호(email_verifications.attempts, 5회 제한)에는
     이미 있던 보호장치가 로그인 자체에는 없어서 비밀번호를 무한히 계속
     틀려볼 수 있었다. 같은 문턱(5회)을 재사용하되, 잠그는 시간은 15분으로
     둔다(인증번호처럼 "다시 요청하면 리셋"이 아니라, 그 계정 소유자가
     아니면 그냥 기다리는 것 외에 우회 수단이 없어야 하므로 더 길게 잡음). */
  var LOGIN_MAX_ATTEMPTS = 5;
  var LOGIN_LOCKOUT_MS = 15*60*1000;
  app.post('/api/auth/login', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'로그인 기능이 아직 설정되지 않았습니다(DATABASE_URL/JWT_SECRET 필요).', code:'not_configured' } });
    var body = req.body || {};
    var email = String(body.email || '').trim().toLowerCase();
    var password = String(body.password || '');
    if(!email || !password) return res.status(400).json({ error: { message:'이메일과 비밀번호를 입력해주세요.', code:'invalid_request' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message: 'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT * FROM users WHERE email=$1', [email]);
    }).then(function(ur){
      var userRow = ur.rows[0];
      if(!userRow) return Promise.reject({ httpStatus: 401, message:'이메일 또는 비밀번호가 올바르지 않습니다.', code:'invalid_credentials' });
      if(userRow.login_locked_until && new Date(userRow.login_locked_until).getTime() > Date.now()){
        var minutesLeft = Math.max(1, Math.ceil((new Date(userRow.login_locked_until).getTime()-Date.now())/60000));
        return Promise.reject({ httpStatus: 429, message:'로그인 시도가 너무 많아 잠시 잠겼습니다. 약 '+minutesLeft+'분 후 다시 시도해주세요.', code:'login_locked' });
      }
      return bcrypt.compare(password, userRow.password_hash).then(function(ok){
        if(!ok){
          var nextAttempts = (userRow.failed_login_attempts||0)+1;
          var lockingNow = nextAttempts >= LOGIN_MAX_ATTEMPTS;
          var lockUntil = lockingNow ? new Date(Date.now()+LOGIN_LOCKOUT_MS) : null;
          return db.query('UPDATE users SET failed_login_attempts=$1, login_locked_until=$2 WHERE id=$3', [lockingNow?0:nextAttempts, lockUntil, userRow.id]).then(function(){
            if(lockingNow){
              return Promise.reject({ httpStatus: 429, message:'로그인 시도가 너무 많아 15분간 잠겼습니다. 잠시 후 다시 시도하거나 비밀번호를 재설정해주세요.', code:'login_locked' });
            }
            return Promise.reject({ httpStatus: 401, message:'이메일 또는 비밀번호가 올바르지 않습니다.', code:'invalid_credentials' });
          });
        }
        var resetAttempts = userRow.failed_login_attempts ? db.query('UPDATE users SET failed_login_attempts=0, login_locked_until=NULL WHERE id=$1', [userRow.id]) : Promise.resolve();
        return resetAttempts.then(function(){
          return db.query('SELECT * FROM subscriptions WHERE user_id=$1', [userRow.id]).then(function(sr){
            var token = issueToken(userRow.id);
            safeLog('auth-login-success', { userId: userRow.id });
            res.json({ token: token, user: userPublicShape(userRow, sr.rows[0]) });
          });
        });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('auth-login-error', { message: err && err.message });
      res.status(500).json({ error: { message:'로그인 처리 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  app.get('/api/auth/me', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'인증 기능이 아직 설정되지 않았습니다.', code:'not_configured' } });
    var userId = verifyAuthHeader(req);
    if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return fetchUserWithSub(userId);
    }).then(function(found){
      // 탈퇴 처리된 계정의 토큰이 아직 남아있어도(다른 탭 등) 더 이상 로그인
      // 상태로 취급하지 않는다 — delete-account 사용자 리포트: 탈퇴가 이
      // 토큰으로 재현되면 안 된다.
      if(!found || found.userRow.deleted_at) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
      res.json({ user: userPublicShape(found.userRow, found.subRow) });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('auth-me-error', { message: err && err.message });
      res.status(500).json({ error: { message:'사용자 정보를 불러오지 못했습니다.', code:'internal_error' } });
    });
  });

  /* ── 회원 탈퇴 — 2026-08-21: 실제 SaaS 출시 전 점검에서 발견된 공백. 개인
     정보처리방침 7항이 "회원 탈퇴를 통해 개인정보의 삭제를 요청할 수
     있습니다"라고 이미 약속하고 있는데 실제로는 탈퇴할 방법이 전혀 없었다.
     users 행 자체를 DELETE하지 않는다(server/db.js 주석 참고 — payments가
     user_id를 ON DELETE CASCADE로 참조하는데, 결제 기록은 전자상거래법상
     5년 보관 의무가 있어 함께 지워지면 안 됨). 대신:
     1) 개인 식별 정보(email/name/password_hash)를 재사용 불가능한 값으로
        덮어써 그 사람을 더 이상 식별할 수 없게 하고 deleted_at을 남긴다
        (이메일을 비식별화하므로 원래 이메일로 재가입도 다시 가능해진다 —
        일반적인 "탈퇴 후 재가입 가능" 기대와 일치).
     2) 구독 중이었다면 즉시 해지하고 billing_key를 지운다(탈퇴한 계정을
        계속 청구할 수는 없다 — 기존 "구독 취소"처럼 결제 주기 끝까지
        기다리지 않고 즉시 처리).
     비밀번호 재확인을 요구한다(body.password) — 로그아웃을 깜빡한 공유
     기기 등에서 세션만 탈취해 계정을 지워버리는 것을 막는, 이런 종류의
     파괴적 동작에 흔히 쓰이는 안전장치다. */
  app.post('/api/auth/delete-account', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'회원 탈퇴 기능이 아직 설정되지 않았습니다.', code:'not_configured' } });
    var userId = verifyAuthHeader(req);
    if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
    var body = req.body || {};
    var password = String(body.password || '');
    if(!password) return res.status(400).json({ error: { message:'본인 확인을 위해 현재 비밀번호를 입력해주세요.', code:'invalid_request' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT * FROM users WHERE id=$1', [userId]);
    }).then(function(ur){
      var userRow = ur.rows[0];
      if(!userRow || userRow.deleted_at) return Promise.reject({ httpStatus: 401, message:'로그인이 필요합니다.', code:'unauthorized' });
      return bcrypt.compare(password, userRow.password_hash).then(function(ok){
        if(!ok) return Promise.reject({ httpStatus: 401, message:'비밀번호가 올바르지 않습니다.', code:'invalid_credentials' });
        var anonymizedEmail = 'deleted_'+userId+'@deleted.atlas.local';
        return bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS).then(function(deadHash){
          return db.query(
            'UPDATE users SET email=$1, name=$2, password_hash=$3, deleted_at=now() WHERE id=$4',
            [anonymizedEmail, '탈퇴한 회원', deadHash, userId]
          );
        }).then(function(){
          return db.query('UPDATE subscriptions SET status=$1, billing_key=NULL, cancel_at_period_end=false, updated_at=now() WHERE user_id=$2', ['canceled', userId]);
        }).then(function(){
          safeLog('account-deleted', { userId: userId });
          res.json({ ok:true });
        });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('delete-account-error', { message: err && err.message });
      res.status(500).json({ error: { message:'회원 탈퇴 처리 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* ── 비밀번호 재설정 — 2026-08-21: 실제 SaaS 출시 전 점검에서 발견된 공백을
     메운다. 그동안 로그인 기능만 있고 비밀번호를 잊었을 때 복구할 방법이
     전혀 없어, 비밀번호를 잊은 실사용자는 그 계정을 영영 못 쓰게 되는
     상태였다(회원 탈퇴 기능도 아직 없어 재가입도 불가능했음). 흐름은 이메일
     인증(send-verification/signup)과 동일한 패턴 — 코드 발송 → 코드+새
     비밀번호로 교체. 다만 이메일이 가입돼 있지 않을 때도 항상 같은 성공
     응답을 준다("계정이 있다면 보냈습니다") — 응답 차이로 "이 이메일이
     가입돼 있는지"를 알아낼 수 없게 하기 위해서다(계정 존재 여부 열거
     공격 방지, 회원가입의 "이미 사용 중인 이메일입니다" 409와는 다른
     맥락 — 그쪽은 가입 자체를 막아야 하니 알려줄 수밖에 없지만, 비밀번호
     재설정은 굳이 알려줄 필요가 없다). */
  app.post('/api/auth/send-password-reset', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'비밀번호 재설정 기능이 아직 설정되지 않았습니다(DATABASE_URL/JWT_SECRET 필요).', code:'not_configured' } });
    if(!emailConfigured()) return res.status(503).json({ error: { message:'이메일 발송 기능이 아직 설정되지 않았습니다(RESEND_API_KEY 필요).', code:'not_configured' } });
    var body = req.body || {};
    var email = String(body.email || '').trim().toLowerCase();
    if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: { message:'올바른 이메일 주소를 입력해주세요.', code:'invalid_request' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message: 'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT id FROM users WHERE email=$1', [email]);
    }).then(function(ur){
      if(!ur.rows.length) return null; // 계정이 없어도 조용히 성공 처리(아래) — 존재 여부를 알려주지 않는다
      return db.query('SELECT last_sent_at FROM password_resets WHERE email=$1', [email]).then(function(prev){
        var prevRow = prev.rows[0];
        if(prevRow && (Date.now() - new Date(prevRow.last_sent_at).getTime()) < VERIFICATION_RESEND_COOLDOWN_MS){
          return Promise.reject({ httpStatus: 429, message:'인증번호를 너무 자주 요청했습니다. 잠시 후 다시 시도해주세요.', code:'rate_limited' });
        }
        var code = String(crypto.randomInt(100000, 1000000));
        var expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);
        return db.query(
          'INSERT INTO password_resets (email, code, attempts, expires_at, last_sent_at) VALUES ($1,$2,0,$3,now()) ' +
          'ON CONFLICT (email) DO UPDATE SET code=$2, attempts=0, expires_at=$3, last_sent_at=now()',
          [email, code, expiresAt]
        ).then(function(){
          return resendProvider.sendPasswordResetEmail({ env: env, fetchImpl: fetchImpl, to: email, code: code });
        }).then(function(sendResult){
          if(!sendResult.ok){
            safeLog('send-password-reset-email-failed', { status: sendResult.status, body: sendResult.data });
            return Promise.reject({ httpStatus: 502, message:'인증번호 이메일 발송에 실패했습니다.', code:'email_send_failed' });
          }
        });
      });
    }).then(function(){
      res.json({ ok:true, message:'해당 이메일로 가입된 계정이 있다면 인증번호를 보냈습니다.' });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('send-password-reset-error', { message: err && err.message });
      res.status(500).json({ error: { message:'인증번호 발송 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  app.post('/api/auth/reset-password', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'비밀번호 재설정 기능이 아직 설정되지 않았습니다(DATABASE_URL/JWT_SECRET 필요).', code:'not_configured' } });
    var body = req.body || {};
    var email = String(body.email || '').trim().toLowerCase();
    var code = String(body.code || '').trim();
    var newPassword = String(body.newPassword || '');
    if(!email || !code || !newPassword) return res.status(400).json({ error: { message:'이메일, 인증번호, 새 비밀번호를 모두 입력해주세요.', code:'invalid_request' } });
    if(newPassword.length < 8) return res.status(400).json({ error: { message:'비밀번호는 8자 이상이어야 합니다.', code:'weak_password' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message: 'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT code, attempts, expires_at FROM password_resets WHERE email=$1', [email]);
    }).then(function(vr){
      var vrow = vr.rows[0];
      if(!vrow) return Promise.reject({ httpStatus: 400, message:'먼저 이메일로 인증번호를 받아주세요.', code:'verification_not_requested' });
      if(new Date(vrow.expires_at).getTime() < Date.now()) return Promise.reject({ httpStatus: 400, message:'인증번호가 만료되었습니다. 다시 요청해주세요.', code:'verification_expired' });
      if(vrow.attempts >= VERIFICATION_MAX_ATTEMPTS) return Promise.reject({ httpStatus: 400, message:'인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.', code:'verification_too_many_attempts' });
      if(vrow.code !== code){
        return db.query('UPDATE password_resets SET attempts=attempts+1 WHERE email=$1', [email]).then(function(){
          return Promise.reject({ httpStatus: 400, message:'인증번호가 올바르지 않습니다.', code:'verification_mismatch' });
        });
      }
      return db.query('SELECT id FROM users WHERE email=$1', [email]);
    }).then(function(ur){
      var userRow = ur.rows[0];
      if(!userRow) return Promise.reject({ httpStatus: 400, message:'해당 이메일로 가입된 계정이 없습니다.', code:'user_not_found' });
      return bcrypt.hash(newPassword, BCRYPT_ROUNDS).then(function(hash){
        return db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, userRow.id]);
      }).then(function(){
        db.query('DELETE FROM password_resets WHERE email=$1', [email]).catch(function(){});
        safeLog('password-reset-success', { userId: userRow.id });
        res.json({ ok:true });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('reset-password-error', { message: err && err.message });
      res.status(500).json({ error: { message:'비밀번호 재설정 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* ── 토스페이먼츠 정기구독 — 2026-08-13: 카드 등록 1회(빌링키 발급) 후
     매달 서버가 자동으로 청구하는 진짜 정기구독. 시크릿 키는 여기서 절대
     브라우저로 전달하지 않는다(server/providers/toss-payments-provider.js
     안에서만 사용). */
  app.get('/api/payments/toss/config', function(req, res){
    var cfg = tossProvider.config(env);
    res.json({ clientKey: cfg.clientKey });
  });

  /* 2026-08-21: 결제 실패 알림 — best-effort로만 보낸다(이메일 발송 자체가
     실패해도 결제 실패 처리 흐름 자체를 막지 않는다, RESEND_API_KEY가
     없는 환경에서도 조용히 건너뛴다). */
  function notifyPaymentFailed(userId){
    if(!resendProvider.isConfigured(env)) return Promise.resolve();
    return db.query('SELECT email, name FROM users WHERE id=$1', [userId]).then(function(ur){
      var userRow = ur.rows[0];
      if(!userRow) return;
      return resendProvider.sendPaymentFailedEmail({ env: env, fetchImpl: fetchImpl, to: userRow.email, name: userRow.name }).then(function(sendResult){
        if(!sendResult.ok) safeLog('payment-failed-email-send-failed', { userId: userId, status: sendResult.status });
      });
    }).catch(function(e){ safeLog('payment-failed-email-error', { userId: userId, message: e && e.message }); });
  }
  function chargeAndAdvance(userId, sub){
    var orderId = 'sub_'+userId+'_'+Date.now();
    return tossProvider.chargeBilling({
      env: env, fetchImpl: fetchImpl,
      billingKey: sub.billing_key, customerKey: sub.customer_key || userId,
      amount: sub.plan_amount || SUBSCRIPTION_AMOUNT, orderId: orderId
    }).then(function(result){
      if(!result.ok){
        var errMsg = (result.data && result.data.message) || '결제 실패';
        safeLog('toss-charge-failed', { userId: userId, message: errMsg });
        alertOps('정기결제 청구 실패', { userId: userId, message: errMsg });
        return db.query('UPDATE subscriptions SET status=$1, updated_at=now() WHERE user_id=$2', ['past_due', userId]).then(function(){
          return db.query('INSERT INTO payments (user_id, order_id, amount, status) VALUES ($1,$2,$3,$4)', [userId, orderId, sub.plan_amount||SUBSCRIPTION_AMOUNT, 'failed']);
        }).then(function(){
          return notifyPaymentFailed(userId);
        }).then(function(){ return { ok:false }; });
      }
      var paymentKey = result.data && result.data.paymentKey;
      return db.query('UPDATE subscriptions SET status=$1, next_billing_at=now()+interval \'1 month\', updated_at=now() WHERE user_id=$2', ['active', userId]).then(function(){
        return db.query('INSERT INTO payments (user_id, order_id, payment_key, amount, status) VALUES ($1,$2,$3,$4,$5)', [userId, orderId, paymentKey, sub.plan_amount||SUBSCRIPTION_AMOUNT, 'paid']);
      }).then(function(){
        safeLog('toss-charge-success', { userId: userId, orderId: orderId });
        return { ok:true };
      });
    });
  }

  app.post('/api/payments/toss/billing-auth', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'결제 기능이 아직 설정되지 않았습니다.', code:'not_configured' } });
    var userId = verifyAuthHeader(req);
    if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
    var body = req.body || {};
    var authKey = body.authKey, customerKey = body.customerKey;
    if(!authKey || !customerKey) return res.status(400).json({ error: { message:'결제 요청 정보가 올바르지 않습니다.', code:'invalid_request' } });
    /* customerKey는 클라이언트가 자신의 로그인 user id로 만들어 보낸 값이다 —
       토큰이 가리키는 실제 계정과 일치하는지 한 번 더 검증한다(다른 사람의
       카드 등록 결과를 자기 계정에 갖다 붙이는 것을 방지, defense in depth). */
    if(customerKey !== userId) return res.status(403).json({ error: { message:'요청한 계정과 결제 정보가 일치하지 않습니다.', code:'customer_mismatch' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return tossProvider.issueBillingKey({ env: env, fetchImpl: fetchImpl, authKey: authKey, customerKey: customerKey });
    }).then(function(result){
      if(!result.ok){
        var errMsg = (result.data && result.data.message) || '카드 등록에 실패했습니다.';
        safeLog('toss-billing-auth-failed', { userId: userId, message: errMsg });
        return res.status(400).json({ error: { message: errMsg, code:'billing_auth_failed' } });
      }
      var billingKey = result.data.billingKey;
      return db.query(
        'UPDATE subscriptions SET billing_key=$1, customer_key=$2, plan_amount=$3, updated_at=now() WHERE user_id=$4',
        [billingKey, customerKey, SUBSCRIPTION_AMOUNT, userId]
      ).then(function(){
        /* 카드 등록 직후 첫 달 금액을 바로 청구한다(빌링키 발급 자체는
           과금이 아니다 — "구독 시작 = 지금 결제 + 다음 달 자동 갱신"이라는
           일반적인 SaaS 동작과 맞춘다). */
        return chargeAndAdvance(userId, { billing_key: billingKey, customer_key: customerKey, plan_amount: SUBSCRIPTION_AMOUNT });
      }).then(function(chargeResult){
        if(!chargeResult.ok){
          return res.status(402).json({ error: { message:'카드는 등록됐지만 첫 결제에 실패했습니다. 카드 정보를 확인해주세요.', code:'first_charge_failed' } });
        }
        safeLog('toss-subscribe-success', { userId: userId });
        res.json({ ok:true, subscriptionStatus:'active' });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('toss-billing-auth-error', { message: err && err.message });
      res.status(500).json({ error: { message:'결제 처리 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* 2026-08-14: 사용자 지시 — "구독 취소 기능이 아예 없다"는 실제 발견된
     공백을 메운다. 취소를 눌러도 그 자리에서 바로 카드가 잠기거나 서비스가
     끊기지 않는다 — cancel_at_period_end만 표시해두고, 이미 결제한 이번
     주기가 끝나는 next_billing_at 시점에 위 runDueBillingCycle/
     finalizeCancellation이 실제로 해지한다. 그 전이면 "구독 유지하기"로
     언제든 취소를 철회할 수 있다(아직 청구 전이므로 그냥 플래그만 되돌리면
     됨 — 별도 결제 로직 필요 없음). */
  app.post('/api/payments/toss/cancel', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'결제 기능이 아직 설정되지 않았습니다.', code:'not_configured' } });
    var userId = verifyAuthHeader(req);
    if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query("SELECT status, next_billing_at FROM subscriptions WHERE user_id=$1", [userId]);
    }).then(function(sr){
      var subRow = sr.rows[0];
      if(!subRow || subRow.status !== 'active') return Promise.reject({ httpStatus: 400, message:'현재 구독 중이 아닙니다.', code:'not_subscribed' });
      return db.query('UPDATE subscriptions SET cancel_at_period_end=true, updated_at=now() WHERE user_id=$1', [userId]).then(function(){
        safeLog('toss-subscription-cancel-requested', { userId: userId });
        res.json({ ok:true, subscriptionStatus:'active', cancelAtPeriodEnd:true, nextBillingAt: subRow.next_billing_at });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('toss-cancel-error', { message: err && err.message });
      res.status(500).json({ error: { message:'구독 취소 처리 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });
  app.post('/api/payments/toss/reactivate', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'결제 기능이 아직 설정되지 않았습니다.', code:'not_configured' } });
    var userId = verifyAuthHeader(req);
    if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query("SELECT status FROM subscriptions WHERE user_id=$1", [userId]);
    }).then(function(sr){
      var subRow = sr.rows[0];
      if(!subRow || subRow.status !== 'active') return Promise.reject({ httpStatus: 400, message:'되돌릴 취소 예약이 없습니다.', code:'not_subscribed' });
      return db.query('UPDATE subscriptions SET cancel_at_period_end=false, updated_at=now() WHERE user_id=$1', [userId]).then(function(){
        safeLog('toss-subscription-cancel-reverted', { userId: userId });
        res.json({ ok:true, subscriptionStatus:'active', cancelAtPeriodEnd:false });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('toss-reactivate-error', { message: err && err.message });
      res.status(500).json({ error: { message:'구독 재개 처리 중 오류가 발생했습니다.', code:'internal_error' } });
    });
  });

  /* ── 관리자 대시보드 — 2026-08-21: 실제 SaaS 출시 전 점검에서 발견된 공백.
     가입자/매출/실패 결제 현황을 보려면 DB를 직접 SQL로 조회해야 했다.
     별도 role 컬럼/권한 체계를 새로 만들지 않고, 무료체험 우회에 이미
     쓰이는 ADMIN_EMAILS/isAdminEmail() 기준을 그대로 재사용한다 — 이
     이메일로 가입한 계정만 통계를 볼 수 있다. */
  app.get('/api/admin/stats', function(req, res){
    if(!authConfigured()) return res.status(503).json({ error: { message:'인증 기능이 아직 설정되지 않았습니다.', code:'not_configured' } });
    var userId = verifyAuthHeader(req);
    if(!userId) return res.status(401).json({ error: { message:'로그인이 필요합니다.', code:'unauthorized' } });
    dbReady.then(function(){
      if(!db) throw { httpStatus: 503, message:'DB 연결에 실패했습니다.', code:'db_unavailable' };
      return db.query('SELECT email FROM users WHERE id=$1', [userId]);
    }).then(function(ur){
      var userRow = ur.rows[0];
      if(!userRow || !isAdminEmail(userRow.email)) return Promise.reject({ httpStatus: 403, message:'관리자 권한이 필요합니다.', code:'forbidden' });
      return Promise.all([
        db.query("SELECT count(*)::int AS c FROM users WHERE deleted_at IS NULL"),
        db.query("SELECT count(*)::int AS c FROM users WHERE deleted_at IS NULL AND created_at >= now() - interval '30 days'"),
        db.query("SELECT count(*)::int AS c FROM subscriptions WHERE status='active'"),
        db.query("SELECT count(*)::int AS c FROM subscriptions WHERE status='past_due'"),
        db.query("SELECT coalesce(sum(amount),0)::int AS s FROM payments WHERE status='paid' AND created_at >= date_trunc('month', now())"),
        db.query("SELECT coalesce(sum(amount),0)::int AS s FROM payments WHERE status='paid'"),
        db.query("SELECT p.id, p.amount, p.created_at, u.email FROM payments p JOIN users u ON u.id=p.user_id WHERE p.status='failed' ORDER BY p.created_at DESC LIMIT 10")
      ]).then(function(results){
        res.json({
          totalUsers: results[0].rows[0].c,
          newUsers30d: results[1].rows[0].c,
          activeSubscriptions: results[2].rows[0].c,
          pastDueSubscriptions: results[3].rows[0].c,
          revenueThisMonth: results[4].rows[0].s,
          revenueTotal: results[5].rows[0].s,
          recentFailedPayments: results[6].rows.map(function(r){ return { id:r.id, amount:r.amount, createdAt:r.created_at, email:r.email }; })
        });
      });
    }).catch(function(err){
      if(err && err.httpStatus) return res.status(err.httpStatus).json({ error: { message: err.message, code: err.code } });
      safeLog('admin-stats-error', { message: err && err.message });
      res.status(500).json({ error: { message:'통계를 불러오지 못했습니다.', code:'internal_error' } });
    });
  });

  /* 매달 자동 청구 스케줄러 — 실제 서버 프로세스 부팅 시(require.main===module)
     에서만 명시적으로 시작한다(아래 startBillingScheduler). 테스트에서
     createApp()을 호출할 때 자동으로 돌지 않게 해서, 테스트 중 실제 네트워크
     타이머가 우연히 겹쳐 실행되는 일이 없게 한다(fetchImpl이 안전장치로
     예외를 던지더라도,애초에 타이머 자체가 안 도는 게 더 확실하다). 실패
     시 재시도/알림 로직은 없다(MVP 범위) — status가 'past_due'로 표시만
     되고, 사용자가 Settings에서 재구독하면 다시 active로 돌아간다. */
  /* 2026-08-14: 구독 취소를 예약한(cancel_at_period_end=true) 계정은 이번
     결제일에 청구하지 않고 그대로 해지 처리한다 — "이미 낸 돈만큼(이번
     결제 주기 끝까지)은 계속 쓰고, 그 다음부터 자동 해지"라는 원칙을 실제로
     실행하는 지점이 여기다. */
  function finalizeCancellation(userId){
    return db.query('UPDATE subscriptions SET status=$1, billing_key=NULL, cancel_at_period_end=false, updated_at=now() WHERE user_id=$2', ['canceled', userId]).then(function(){
      safeLog('toss-subscription-canceled-finalized', { userId: userId });
    });
  }
  function runDueBillingCycle(){
    if(!db) return Promise.resolve();
    return db.query("SELECT user_id, billing_key, customer_key, plan_amount, cancel_at_period_end FROM subscriptions WHERE status='active' AND billing_key IS NOT NULL AND next_billing_at <= now()").then(function(r){
      return r.rows.reduce(function(chain, row){
        return chain.then(function(){
          var action = row.cancel_at_period_end ? finalizeCancellation(row.user_id) : chargeAndAdvance(row.user_id, row);
          return action.catch(function(e){
            safeLog('toss-scheduled-charge-error', { userId: row.user_id, message: e && e.message });
          });
        });
      }, Promise.resolve());
    });
  }
  function startBillingScheduler(){
    var timer = setInterval(function(){
      runDueBillingCycle().catch(function(e){ safeLog('toss-billing-cycle-error', { message: e && e.message }); });
    }, BILLING_CHECK_INTERVAL_MS);
    if(timer.unref) timer.unref();
    return timer;
  }

  return { app: app, db: db, runDueBillingCycle: runDueBillingCycle, startBillingScheduler: startBillingScheduler };
}

if(require.main === module){
  var port = process.env.PORT || 8910;
  var built = createApp();
  built.app.listen(port, function(){
    console.log('Atlas Gateway listening on http://localhost:'+port+' (Anthropic configured: '+anthropicProvider.isConfigured(process.env)+')');
  });
  if(built.db) built.startBillingScheduler();
}

module.exports = { createApp: createApp };
