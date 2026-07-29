/* js/atlas-gateway-base-url.js — Atlas는 정적 호스팅(GitHub Pages 등)에서도 열릴 수
   있다. 그런 곳에는 Node 서버가 없으므로, Gateway(OpenAI/Anthropic) 호출은 반드시
   사용자가 로컬에서 띄운 http://localhost:8910 을 가리켜야 한다 — 상대경로를 쓰면
   페이지가 열린 도메인(예: enfldka-web.github.io) 자신에게 요청이 나가버려서
   항상 실패한다(실제로 발견된 버그). localhost/127.0.0.1에서 직접 연 경우에는
   지금까지처럼 같은 origin을 그대로 쓴다. */

window.AtlasGatewayBaseUrl = window.AtlasGatewayBaseUrl || {};

(function(G){
  var GITHUB_PAGES_HOST = 'enfldka-web.github.io';
  var LOCAL_GATEWAY_ORIGIN = 'http://localhost:8910';

  G.resolve = function(){
    var host = window.location.hostname;
    if(host === GITHUB_PAGES_HOST) return LOCAL_GATEWAY_ORIGIN;
    if(host === 'localhost' || host === '127.0.0.1') return window.location.origin;
    return window.location.origin; // 알 수 없는 다른 호스트는 같은 origin으로 안전하게 폴백
  };
})(window.AtlasGatewayBaseUrl);
