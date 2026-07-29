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
    return fetch(BASE+'/status').then(function(res){ return res.json(); }).then(function(body){
      statusCache = { reachable:true, configured: !!body.configured, checked:true };
      return statusCache;
    }).catch(function(){
      statusCache = { reachable:false, configured:false, checked:true };
      return statusCache;
    });
  };
  G.getStatusCache = function(){ return statusCache; };
  G.isConfigured = function(){ return !!statusCache.configured; };
  G.isReachable = function(){ return !!statusCache.reachable; };

  /* 실제 Anthropic 호출은 이 함수 하나로만 이루어진다. payload는
     { model, max_tokens, system, messages } — Anthropic Messages API 바디와 동일한
     모양이며, Gateway가 그대로 전달만 한다. 응답은 Anthropic 원본 JSON(data.content
     등)을 그대로 반환해 기존 파싱 코드를 바꾸지 않아도 되게 한다.
     Gateway 자체가 응답하지 않으면(서버 미실행) "AI 서버가 실행되지 않았습니다."로
     통일해 무한 로딩 대신 항상 명확한 실패로 귀결시킨다. */
  G.generate = function(payload){
    return fetch(BASE+'/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function(){
      var e = new Error('AI 서버가 실행되지 않았습니다.');
      e.gatewayUnreachable = true;
      throw e;
    }).then(function(res){
      return res.json().then(function(body){ return { ok: res.ok, status: res.status, body: body }; }).catch(function(){
        return { ok: res.ok, status: res.status, body: null };
      });
    }).then(function(r){
      if(!r.ok){
        var msg = (r.body && r.body.error && r.body.error.message) || 'AI 서버 오류 ('+r.status+')';
        var e = new Error(msg);
        e.status = r.status;
        e.errorType = r.body && r.body.error && r.body.error.code;
        throw e;
      }
      return r.body;
    });
  };
})(window.AtlasAnthropicGateway);
