/* js/anthropic-gateway-client.js

   V3 Phase 2 Round 32(2026-08-07) 이전: 브라우저는 api.anthropic.com을 절대 직접
   호출하지 않고, 이 파일이 유일한 통로로 Browser → localhost:8910(Atlas Node
   Gateway) → Anthropic 경로만 썼다. API Key는 서버 환경변수로만 관리됐다.

   Round 32: 사용자가 명시적으로 "각자 자기 API 키를 쓰는 방식(A안)"을 선택했다
   — 서버 인프라 비용 없이 GitHub Pages 같은 정적 호스팅만으로 동작하게 하기
   위해서다. js/atlas-user-api-key.js에 사용자가 자신의 Anthropic API 키를
   저장해 뒀으면, 이제 이 파일이 그 키로 api.anthropic.com을 브라우저에서 직접
   호출한다(anthropic-dangerous-direct-browser-access 헤더 — Anthropic이 "Bring
   Your Own Key" 클라이언트 앱을 위해 공식적으로 지원하는 방식, 2024년 8월
   발표: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/).
   사용자 키가 없으면 기존 로컬 Gateway 경로를 그대로 쓴다(운영자 본인 테스트용
   — 삭제하지 않고 그대로 둔다, 회귀 없음). 두 경로 모두 호출부(G.generate)가
   반환하는 모양은 완전히 동일하다(Anthropic Messages API 원본 JSON) — 기존
   파싱 코드(data.content 등)는 어느 경로든 손댈 필요가 없다. */

window.AtlasAnthropicGateway = window.AtlasAnthropicGateway || {};

(function(G){
  var BASE = '/api/anthropic-gateway';
  var ANTHROPIC_DIRECT_URL = 'https://api.anthropic.com/v1/messages';
  var ANTHROPIC_VERSION = '2023-06-01';
  var statusCache = { reachable:false, configured:false, checked:false, trialUsed:false, subscribed:false };

  function ownKey(){ return window.AtlasUserApiKey ? window.AtlasUserApiKey.getAnthropicKey() : ''; }
  /* 2026-08-13: 실제 회원가입/로그인이 생기면서 "무료체험 1회"는 이제 익명
     세션 쿠키가 아니라 로그인한 실제 계정 기준으로 서버가 판단한다
     (server/image-gateway.js /api/auth/*, 무료체험 게이팅은 outline 호출
     시점에서 검사). js/application.js가 저장해둔 JWT를 Authorization 헤더로
     실어 보내야 서버가 어느 계정인지 알 수 있다 — application.js가 이
     파일보다 나중에 로드되지만, 실제 호출은 항상 사용자 조작(버튼 클릭) 이후
     비동기로 일어나므로 그때는 이미 로드가 끝나 있어 안전하다. */
  function authHeader(){
    var token = (typeof atlasGetAuthToken==='function') ? atlasGetAuthToken() : null;
    return token ? { Authorization: 'Bearer '+token } : {};
  }

  /* 페이지 로드 시 한 번 조회해 캐시한다 — isConfigured()/isReachable()는 동기
     함수여야 UI 렌더링(checkCvReady 등)에서 바로 쓸 수 있다. 사용자 키가 있으면
     서버에 물어볼 필요 자체가 없다 — 즉시 "연결됨"으로 확정한다(로컬 서버가
     없어도, 심지어 GitHub Pages처럼 서버가 존재하지 않는 곳에서도 정확하다). */
  G.refreshStatus = function(){
    if(ownKey()){
      /* 본인 키가 있으면 체험 횟수 제한 자체가 무의미하다(자기 키로 무제한
         호출 가능) — trialUsed는 항상 false로 보고한다. */
      statusCache = { reachable:true, configured:true, checked:true, mode:'own-key', trialUsed:false, subscribed:false };
      return Promise.resolve(statusCache);
    }
    var url = new URL(BASE+'/status', window.AtlasGatewayBaseUrl.resolve()).href;
    return fetch(url, { headers: authHeader() }).then(function(res){
      return res.text().then(function(raw){
        var body;
        try{ body = JSON.parse(raw); }
        catch(parseErr){
          console.error('[AtlasAnthropicGateway] /status did not return JSON — wrong origin/port, or a different server is answering this URL.', { url: url, httpStatus: res.status, bodyPreview: raw.slice(0,200) });
          throw parseErr;
        }
        if(!res.ok){
          console.error('[AtlasAnthropicGateway] /status responded with a non-OK HTTP status.', { url: url, httpStatus: res.status, body: body });
        }
        return body;
      });
    }).then(function(body){
      statusCache = { reachable:true, configured: !!body.configured, checked:true, mode:'gateway', trialUsed: !!body.trialUsed, subscribed: !!body.subscribed };
      return statusCache;
    }).catch(function(err){
      console.error('[AtlasAnthropicGateway] gateway unreachable at '+url+' — is `node server/image-gateway.js` actually the process serving THIS page (same host:port)?', err && err.message);
      statusCache = { reachable:false, configured:false, checked:true, mode:'gateway', trialUsed:false, subscribed:false };
      return statusCache;
    });
  };
  G.getStatusCache = function(){ return statusCache; };
  G.isConfigured = function(){ return !!statusCache.configured; };
  G.isReachable = function(){ return !!statusCache.reachable; };

  /* 서버가 재시도(최대 2회)까지 마치는 데 걸릴 수 있는 최악의 시간(챕터/목차/
     부록 타임아웃 300s × 3회 시도 + backoff, server/providers/
     anthropic-text-provider.js chapterTimeoutMs)보다 넉넉히 큰 값으로
     클라이언트 측 안전장치를 둔다. 이게 없으면 서버가 응답 없이 멈췄을 때
     fetch가 영원히 pending 상태로 남아 호출 버튼이 영구적으로 비활성
     상태로 고정된다(실제 사용자 버그 리포트로 발견됨: "자료 분석 & 제목
     후보 만들기"를 눌러도 반응이 없음). 2026-08-19: 서버 쪽 타임아웃을
     180s→300s로 늘리면서 이 값도 함께 늘렸다 — 그대로 뒀으면 서버가
     아직 재시도 중인데 클라이언트가 먼저 끊어버려 더 헷갈리는 오류
     메시지("AI 서버 응답이 너무 오래 걸림")로 실제 원인(부록 타임아웃)이
     가려질 뻔했다. */
  var CLIENT_TIMEOUT_MS = 960000;

  /* 두 경로(사용자 본인 키로 직접 호출 / 로컬 Gateway 경유) 모두 최종적으로
     { ok, status, body } 모양 하나로 맞춘 뒤, 이 함수 하나가 성공/실패 처리를
     공통으로 담당한다 — 실패 시 던지는 Error의 모양(status/errorType/
     rawErrorBody)이 두 경로에서 완전히 동일해야, 이 함수를 호출하는 기존
     코드(에러 메시지 표시 등)를 손대지 않아도 되기 때문이다. */
  function handleResult(r){
    if(!r.ok){
      var errBody = (r.body && r.body.error) || {};
      console.error('[AtlasAnthropicGateway] generate failed', { status: errBody.status || r.status, type: errBody.type, message: errBody.message, raw: errBody.raw });
      var msg = errBody.message || 'AI 서버 오류 ('+r.status+')';
      var e = new Error(msg);
      e.status = errBody.status || r.status;
      e.errorType = errBody.type;
      e.errorCode = errBody.code;
      e.rawErrorBody = errBody.raw;
      throw e;
    }
    return r.body;
  }

  /* V3 Phase 2 Round 32: 사용자 본인 Anthropic API 키로 api.anthropic.com을
     브라우저에서 직접 호출한다(서버 없이 GitHub Pages만으로 동작). Anthropic이
     공식 지원하는 "Bring Your Own Key" 브라우저 접근 방식 —
     anthropic-dangerous-direct-browser-access 헤더가 없으면 Anthropic이 브라우저
     Origin의 요청을 CORS로 차단한다(의도적인 이름 — "위험을 이해하고 직접 쓴다"는
     동의 표시). 실패 응답은 Anthropic 원본 {type:'error', error:{type,message}}
     모양이므로, Gateway 경로와 동일한 {error:{status,type,message,raw}}로 다시
     감싸 handleResult()를 그대로 재사용한다. */
  function generateDirect(payload, apiKey){
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timedOut = false;
    var timer = controller ? setTimeout(function(){ timedOut = true; controller.abort(); }, CLIENT_TIMEOUT_MS) : null;
    return fetch(ANTHROPIC_DIRECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: payload.model, max_tokens: payload.max_tokens, system: payload.system, messages: payload.messages }),
      signal: controller ? controller.signal : undefined
    }).catch(function(err){
      if(timedOut){
        var te = new Error('AI 응답이 너무 오래 걸려 요청을 중단했습니다. 다시 시도해주세요.');
        te.gatewayTimeout = true;
        throw te;
      }
      console.error('[AtlasAnthropicGateway] direct Anthropic call failed (network)', err && err.message);
      var e = new Error('네트워크 오류로 AI 서버(Anthropic)에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.');
      e.gatewayUnreachable = true;
      throw e;
    }).then(function(res){
      if(timer)clearTimeout(timer);
      return res.json().then(function(body){ return { ok: res.ok, status: res.status, body: body }; }).catch(function(){
        return { ok: res.ok, status: res.status, body: null };
      });
    }).then(function(r){
      if(r.ok) return r;
      var anthropicError = (r.body && r.body.error) || {};
      var friendly = anthropicError.type==='authentication_error' ? '설정에 입력하신 Anthropic API 키가 올바르지 않습니다. 키를 다시 확인해주세요.'
        : anthropicError.type==='permission_error' ? 'Anthropic API 키에 이 모델을 쓸 권한이 없습니다.'
        : anthropicError.type==='rate_limit_error' ? 'Anthropic API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
        : anthropicError.type==='overloaded_error' ? 'Anthropic 서버가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.'
        : (anthropicError.message || 'Anthropic 서버 오류 ('+r.status+')');
      return { ok:false, status:r.status, body:{ error: { status:r.status, type:anthropicError.type, message:friendly, raw:r.body } } };
    });
  }

  /* 실제 Anthropic 호출은 이 함수 하나로만 이루어진다. payload는
     { model, max_tokens, system, messages } — Anthropic Messages API 바디와 동일한
     모양이며, 두 경로(직접 호출/Gateway 경유) 모두 그대로 전달만 한다. 응답은
     Anthropic 원본 JSON(data.content 등)을 그대로 반환해 기존 파싱 코드를
     바꾸지 않아도 되게 한다. 사용자가 Settings에 자신의 API 키를 넣어 뒀으면
     그 즉시 직접 호출로 전환되고(서버 불필요), 아니면 기존처럼 로컬 Gateway를
     거친다(서버가 응답하지 않으면 "AI 서버가 실행되지 않았습니다."로 통일해
     무한 로딩 대신 항상 명확한 실패로 귀결시킨다). */
  G.generate = function(payload){
    var key = ownKey();
    if(key) return generateDirect(payload, key).then(handleResult);

    var url = new URL(BASE+'/generate', window.AtlasGatewayBaseUrl.resolve()).href;
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timedOut = false;
    var timer = controller ? setTimeout(function(){ timedOut = true; controller.abort(); }, CLIENT_TIMEOUT_MS) : null;
    return fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeader()),
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).catch(function(err){
      if(timedOut){
        console.error('[AtlasAnthropicGateway] generate timed out after '+CLIENT_TIMEOUT_MS+'ms with no response from gateway.', url);
        var te = new Error('AI 서버 응답이 너무 오래 걸려 요청을 중단했습니다. 다시 시도해주세요.');
        te.gatewayTimeout = true;
        throw te;
      }
      console.error('[AtlasAnthropicGateway] gateway unreachable at '+url+' — is `node server/image-gateway.js` actually the process serving THIS page (same host:port)?', err && err.message);
      var e = new Error('AI 서버가 실행되지 않았습니다.');
      e.gatewayUnreachable = true;
      throw e;
    }).then(function(res){
      if(timer)clearTimeout(timer);
      return res.json().then(function(body){ return { ok: res.ok, status: res.status, body: body }; }).catch(function(){
        return { ok: res.ok, status: res.status, body: null };
      });
    }).then(handleResult);
  };
})(window.AtlasAnthropicGateway);
