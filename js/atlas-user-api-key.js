/* js/atlas-user-api-key.js — V3 Phase 2 Round 32 (2026-08-07)

   사용자가 명시적으로 선택한 방향(A안): Atlas는 서버가 API 비용을 대신 내주는
   SaaS가 아니라, "전자책을 만들 수 있게 해주는 프로그램"이다 — AI 호출 비용은
   각 사용자가 자신의 OpenAI/Anthropic API 키로 직접 낸다. 이 키는 오직 이
   브라우저의 localStorage에만 저장되고, Atlas 서버(있다면)나 다른 어떤 곳으로도
   전송되지 않는다 — js/anthropic-gateway-client.js와 js/image-provider-openai.js가
   이 키가 있으면 그 즉시 각 Provider(api.anthropic.com/api.openai.com)를
   브라우저에서 직접 호출하고, 없으면 기존처럼 Atlas Node Gateway(로컬 서버,
   운영자 본인 테스트용)를 거친다 — 기존 로컬 게이트웨이 경로는 전혀 삭제하지
   않았다(회귀 없음, Never-Delete 원칙). */

window.AtlasUserApiKey = window.AtlasUserApiKey || {};

(function(K){
  var LS_ANTHROPIC = 'atlas_user_anthropic_key';
  var LS_OPENAI = 'atlas_user_openai_key';

  function readKey(name){
    try{ return (localStorage.getItem(name) || '').trim(); }
    catch(e){ return ''; }
  }
  function writeKey(name, value){
    try{
      var v = String(value == null ? '' : value).trim();
      if(v) localStorage.setItem(name, v);
      else localStorage.removeItem(name);
    }catch(e){ /* localStorage 접근 불가(프라이빗 모드 등) — 조용히 무시, 저장만 안 될 뿐 앱은 계속 동작 */ }
  }

  K.getAnthropicKey = function(){ return readKey(LS_ANTHROPIC); };
  K.getOpenAIKey = function(){ return readKey(LS_OPENAI); };
  K.setAnthropicKey = function(v){ writeKey(LS_ANTHROPIC, v); };
  K.setOpenAIKey = function(v){ writeKey(LS_OPENAI, v); };
  K.hasAnthropicKey = function(){ return !!K.getAnthropicKey(); };
  K.hasOpenAIKey = function(){ return !!K.getOpenAIKey(); };

})(window.AtlasUserApiKey);
