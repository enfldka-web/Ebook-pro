/* js/atlas-gateway-base-url.js — Atlas는 정적 호스팅(GitHub Pages)에서 열리고,
   Gateway(회원가입/로그인/전자책 생성 등)는 별도로 Render에 배포된 Node 서버
   (atlas-image-gateway)다. 상대경로를 쓰면 페이지가 열린 도메인
   (enfldka-web.github.io) 자신에게 요청이 나가버려서 항상 실패하므로, GitHub
   Pages에서는 반드시 실제 Render 서버 주소를 명시적으로 가리켜야 한다.

   로컬 개발(localhost/127.0.0.1)에서는 기존처럼 로컬 Gateway(8910 포트)를
   가리킨다 — Gateway 자신이 8910에서 정적 파일도 함께 서빙하는 정상적인
   사용법(권장)에서는 window.location이 이미 8910이므로 동작이 전혀 바뀌지
   않고, 프론트엔드를 별도 정적 서버로 여는 경우에도 항상 올바르게 8910을
   가리킨다. */

window.AtlasGatewayBaseUrl = window.AtlasGatewayBaseUrl || {};

(function(G){
  var GITHUB_PAGES_HOST = 'enfldka-web.github.io';
  var PRODUCTION_GATEWAY_URL = 'https://atlas-image-gateway.onrender.com';
  var LOCAL_GATEWAY_PORT = '8910';

  G.resolve = function(){
    var host = window.location.hostname;
    if(host === GITHUB_PAGES_HOST) return PRODUCTION_GATEWAY_URL;
    if(host === 'localhost' || host === '127.0.0.1') return 'http://'+host+':'+LOCAL_GATEWAY_PORT;
    return window.location.origin; // 알 수 없는 다른 호스트는 같은 origin으로 안전하게 폴백
  };
})(window.AtlasGatewayBaseUrl);
