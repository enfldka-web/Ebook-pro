/* js/atlas-gateway-base-url.js — Atlas는 정적 호스팅(GitHub Pages 등)에서도 열릴 수
   있다. 그런 곳에는 Node 서버가 없으므로, Gateway(OpenAI/Anthropic) 호출은 반드시
   사용자가 로컬에서 띄운 http://localhost:8910 을 가리켜야 한다 — 상대경로를 쓰면
   페이지가 열린 도메인(예: enfldka-web.github.io) 자신에게 요청이 나가버려서
   항상 실패한다(실제로 발견된 버그).

   실제 버그 리포트(로컬 재현): Atlas 프론트엔드를 Gateway와 다른 포트(예:
   localhost:8080, 정적 서버)에서 열면 이전 코드는 "localhost면 같은 origin을
   그대로 쓴다"고 가정해 window.location.origin(=http://localhost:8080)을
   그대로 반환했다 — 하지만 실제 Gateway(node server/image-gateway.js)는
   8910에서만 떠 있으므로, 모든 /api/anthropic-gateway/status,
   /api/image-gateway/status 요청이 8080으로 나가 존재하지 않는 경로를 때리고
   실패했다(Settings가 "AI 서버가 실행되지 않았습니다"로 표시된 실제 원인).
   GitHub Pages 케이스와 원리가 완전히 같다 — "지금 이 페이지를 서비스하는
   origin"과 "실제 Gateway가 떠 있는 origin"이 다를 수 있다는 것. 그래서
   localhost/127.0.0.1에서도 항상 같은 호스트의 8910 포트를 명시적으로
   가리킨다 — Gateway 자신이 8910에서 정적 파일도 함께 서빙하는 정상적인
   사용법(권장)에서는 window.location이 이미 8910이므로 동작이 전혀 바뀌지
   않고, 프론트엔드를 별도 정적 서버로 여는 경우에도 항상 올바르게 8910을
   가리킨다. */

window.AtlasGatewayBaseUrl = window.AtlasGatewayBaseUrl || {};

(function(G){
  var GITHUB_PAGES_HOST = 'enfldka-web.github.io';
  var LOCAL_GATEWAY_PORT = '8910';

  G.resolve = function(){
    var host = window.location.hostname;
    if(host === GITHUB_PAGES_HOST) return 'http://localhost:'+LOCAL_GATEWAY_PORT;
    if(host === 'localhost' || host === '127.0.0.1') return 'http://'+host+':'+LOCAL_GATEWAY_PORT;
    return window.location.origin; // 알 수 없는 다른 호스트는 같은 origin으로 안전하게 폴백
  };
})(window.AtlasGatewayBaseUrl);
