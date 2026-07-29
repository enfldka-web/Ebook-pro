/* shared/image-provider-registry.js — Phase 14: Provider-Neutral Image Engine Foundation

   Image Engine이 특정 Provider(Claude Design/GPT Image/Gemini/FLUX 등)를 하드코딩하지
   않도록, Provider를 등록/조회/선택하는 단일 Registry를 둔다. Engine 코드는 항상
   AtlasImageProviderRegistry.get(id) 또는 .getDefault()로만 Provider를 얻는다.

   Provider 인터페이스(각 Provider 파일이 구현해야 하는 것):
   { id, displayName, capabilities, isConfigured(), validateRequest(request),
     generate(request, extra), cancel(jobId), normalizeResponse(raw) } */

window.AtlasImageProviderRegistry = window.AtlasImageProviderRegistry || {};

(function(R){

  var REQUIRED_METHODS = ['isConfigured', 'validateRequest', 'generate', 'cancel', 'normalizeResponse'];

  var providers = {};
  var defaultProviderId = null;

  function isValidProvider(provider){
    if(!provider || !provider.id || !provider.displayName || !provider.capabilities) return false;
    return REQUIRED_METHODS.every(function(m){ return typeof provider[m]==='function'; });
  }

  /* 등록 — 잘못된 형태의 Provider는 조용히 무시하지 않고 false를 반환해 호출자가
     즉시 알아챌 수 있게 한다(잘못 만들어진 Provider가 나중에야 발견되는 것을 방지). */
  R.register = function(provider){
    if(!isValidProvider(provider)) return false;
    providers[provider.id] = provider;
    if(!defaultProviderId || provider.isDefault===true) defaultProviderId = provider.id;
    return true;
  };

  R.get = function(id){ return providers[id] || null; };

  R.list = function(){ return Object.keys(providers).map(function(id){ return providers[id]; }); };

  R.getDefault = function(){ return defaultProviderId ? providers[defaultProviderId] : null; };

  R.setDefault = function(id){
    if(!providers[id]) return false;
    defaultProviderId = id;
    return true;
  };

  /* 테스트 전용 — 각 테스트 파일이 독립된 Registry 상태에서 시작할 수 있도록 초기화한다.
     실제 런타임(index.html)에서는 페이지 로드당 한 번씩만 Provider 파일들이 register()를
     호출하므로 reset()을 호출할 일이 없다. */
  R.reset = function(){ providers = {}; defaultProviderId = null; };

})(window.AtlasImageProviderRegistry);
