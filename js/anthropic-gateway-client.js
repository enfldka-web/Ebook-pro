/* js/anthropic-gateway-client.js — 브라우저는 api.anthropic.com을 절대 직접 호출하지
   않는다. 이 파일이 유일한 통로다: Browser → localhost:8910(Atlas Node Gateway) →
   Anthropic. API Key는 이 파일 어디에도 없다 — 서버가 환경변수로만 들고 있다. */

window.AtlasAnthropicGateway = window.AtlasAnthropicGateway || {};

(function(G){
  var BASE = '/api/anthropic-gateway';
  var statusCache = { reachable:false, configured:false, checked:false };

  /* 페이지 로드 시 한 번 조회해 캐시한다 — isConfigured()/isReachable()는 동기
     함수여야 UI 렌더링(checkCvReady 등)에서 바로 쓸 수 있다. */
  G.refreshStatus = function(){
    var url = new URL(BASE+'/status', window.AtlasGatewayBaseUrl.resolve()).href;
    return fetch(url).then(function(res){
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
      statusCache = { reachable:true, configured: !!body.configured, checked:true };
      return statusCache;
    }).catch(function(err){
      console.error('[AtlasAnthropicGateway] gateway unreachable at '+url+' — is `node server/image-gateway.js` actually the process serving THIS page (same host:port)?', err && err.message);
      statusCache = { reachable:false, configured:false, checked:true };
      return statusCache;
    });
  };
  G.getStatusCache = function(){ return statusCache; };
  G.isConfigured = function(){ return !!statusCache.configured; };
  G.isReachable = function(){ return !!statusCache.reachable; };

  /* 서버가 재시도(최대 2회)까지 마치는 데 걸릴 수 있는 최악의 시간(챕터 타임아웃
     120s × 3회 시도 + backoff)보다 넉넉히 큰 값으로 클라이언트 측 안전장치를 둔다.
     이게 없으면 서버가 응답 없이 멈췄을 때 fetch가 영원히 pending 상태로 남아
     호출 버튼이 영구적으로 비활성 상태로 고정된다(실제 사용자 버그 리포트로 발견됨:
     "자료 분석 & 제목 후보 만들기"를 눌러도 반응이 없음). */
  var CLIENT_TIMEOUT_MS = 400000;

  /* 실제 Anthropic 호출은 이 함수 하나로만 이루어진다. payload는
     { model, max_tokens, system, messages } — Anthropic Messages API 바디와 동일한
     모양이며, Gateway가 그대로 전달만 한다. 응답은 Anthropic 원본 JSON(data.content
     등)을 그대로 반환해 기존 파싱 코드를 바꾸지 않아도 되게 한다.
     Gateway 자체가 응답하지 않으면(서버 미실행) "AI 서버가 실행되지 않았습니다."로
     통일해 무한 로딩 대신 항상 명확한 실패로 귀결시킨다. */
  G.generate = function(payload){
    var url = new URL(BASE+'/generate', window.AtlasGatewayBaseUrl.resolve()).href;
    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timedOut = false;
    var timer = controller ? setTimeout(function(){ timedOut = true; controller.abort(); }, CLIENT_TIMEOUT_MS) : null;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    }).then(function(r){
      if(!r.ok){
        var errBody = (r.body && r.body.error) || {};
        /* Anthropic이 실제로 반환한 status/type/message/raw body를 그대로 콘솔에
           남긴다 — API Key 값 자체는 여기에도, Anthropic 에러 바디에도 포함되지
           않는다. */
        console.error('[AtlasAnthropicGateway] generate failed', { status: errBody.status || r.status, type: errBody.type, message: errBody.message, raw: errBody.raw });
        var msg = errBody.message || 'AI 서버 오류 ('+r.status+')';
        var e = new Error(msg);
        e.status = errBody.status || r.status;
        e.errorType = errBody.type;
        e.rawErrorBody = errBody.raw;
        throw e;
      }
      return r.body;
    });
  };
})(window.AtlasAnthropicGateway);
