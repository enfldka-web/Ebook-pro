/* js/atlas-gateway-base-url.js — Atlas는 정적 호스팅(GitHub Pages, 그리고 거기
   연결된 커스텀 도메인)에서 열리고, Gateway(회원가입/로그인/전자책 생성 등)는
   별도로 Render에 배포된 Node 서버(atlas-image-gateway)다. 상대경로를 쓰면
   페이지가 열린 도메인 자신에게 요청이 나가버려서 항상 실패하므로, 정적
   호스팅 쪽에서는 반드시 실제 Render 서버 주소를 명시적으로 가리켜야 한다.

   로컬 개발(localhost/127.0.0.1)에서는 기존처럼 로컬 Gateway(8910 포트)를
   가리킨다 — Gateway 자신이 8910에서 정적 파일도 함께 서빙하는 정상적인
   사용법(권장)에서는 window.location이 이미 8910이므로 동작이 전혀 바뀌지
   않고, 프론트엔드를 별도 정적 서버로 여는 경우에도 항상 올바르게 8910을
   가리킨다.

   2026-08-18: 실제로 재현된 버그 — 이전 버전은 GitHub Pages 기본 주소
   (enfldka-web.github.io) 하나만 하드코딩해서 확인했다. atlas.jsgyeol.com
   커스텀 도메인을 연결한 뒤 그 주소로 접속하면 이 조건에 안 걸려 마지막
   폴백(window.location.origin, 즉 자기 자신)으로 떨어졌고, 그 도메인엔
   정적 파일만 있고 백엔드가 없어 로그인/회원가입이 전부 "서버에 연결하지
   못했습니다"로 실패했다. 도메인을 하나씩 나열하는 대신, "로컬 개발이
   아니면 항상 운영 Gateway를 가리킨다"로 뒤집어 앞으로 도메인이 또
   바뀌어도 이 파일을 다시 고칠 필요가 없게 한다. */

window.AtlasGatewayBaseUrl = window.AtlasGatewayBaseUrl || {};

(function(G){
  var PRODUCTION_GATEWAY_URL = 'https://atlas-image-gateway.onrender.com';
  var LOCAL_GATEWAY_PORT = '8910';

  G.resolve = function(){
    var host = window.location.hostname;
    if(host === 'localhost' || host === '127.0.0.1') return 'http://'+host+':'+LOCAL_GATEWAY_PORT;
    return PRODUCTION_GATEWAY_URL;
  };
})(window.AtlasGatewayBaseUrl);
