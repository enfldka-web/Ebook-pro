/* js/image-provider-openai.js — Phase 15: OpenAI GPT Image Provider (browser 측)

   실제 OpenAI API Key는 이 파일 어디에도 없다 — 이 Provider는 Atlas Server Gateway
   (server/image-gateway.js)에만 fetch()로 요청하고, Gateway가 OpenAI를 대신 호출한다.
   Phase 14의 ImageProvider Contract(isConfigured/validateRequest/generate/cancel/
   normalizeResponse)를 Mock/Manual Import Provider와 동일한 모양으로 구현해
   Provider Registry에 등록한다 — Image Engine/UI 코드는 이 Provider를 다른 Provider와
   전혀 다르게 취급하지 않는다. */

window.AtlasOpenAIImageProvider = window.AtlasOpenAIImageProvider || {};

(function(P){
  var C = window.AtlasImageGenerationContract;

  P.id = 'openai-gpt-image';
  P.displayName = 'GPT Image';
  P.capabilities = {
    textToImage: true, imageToImage: false, referenceImage: false,
    negativePrompt: false, /* OpenAI Images API에 별도 negative 파라미터가 없어 Prompt 문장 안에 자연어로 포함시킨다 */
    seed: false,
    aspectRatios: ['1536x1024', '1024x1536', '1024x1024'],
    maximumImagesPerRequest: 1,
    supportsConsistencyReference: false,
    supportsTransparentBackground: true
  };

  var GATEWAY_BASE = '/api/image-gateway';
  var inFlightControllers = {};
  var jobCounter = 0;

  /* 서버 /status를 페이지 로드 시 한 번 조회해 캐시한다 — isConfigured()는 기존
     Provider들과 동일하게 동기 함수여야 하므로, 실제 조회는 refreshStatus()가
     비동기로 먼저 끝내 두고 isConfigured()는 그 캐시만 읽는다. */
  var statusCache = { configured:false, model:null, quality:null, dailyUsed:null, dailyLimit:null, monthlyUsed:null, monthlyLimit:null, checked:false };

  P.refreshStatus = function(){
    return fetch(GATEWAY_BASE+'/status').then(function(res){ return res.json(); }).then(function(body){
      statusCache = Object.assign({ checked:true }, body);
      return statusCache;
    }).catch(function(){
      statusCache = { configured:false, checked:true };
      return statusCache;
    });
  };
  P.getStatusCache = function(){ return statusCache; };

  P.isConfigured = function(){ return !!statusCache.configured; };

  P.validateRequest = function(request){ return C.validateRequest(request); };

  function normalizeGatewayJson(json, request, jobId){
    /* 서버가 이미 Contract.createResponse()로 정규화해 보내므로 그대로 신뢰하되,
       필드 누락에 대비해 한 번 더 createResponse를 통과시킨다(방어적). */
    return C.createResponse(Object.assign({ requestId: request.requestId, jobId: jobId, providerId: P.id }, json));
  }

  P.generate = function(request, extra){
    jobCounter++;
    var jobId = 'openai-job-'+jobCounter+'-'+Date.now();
    var controller = (typeof AbortController!=='undefined') ? new AbortController() : null;
    if(controller) inFlightControllers[jobId] = controller;

    var promise = fetch(GATEWAY_BASE+'/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: jobId, request: request }),
      signal: controller ? controller.signal : undefined
    }).then(function(res){
      return res.json().then(function(json){ return normalizeGatewayJson(json, request, jobId); });
    }).catch(function(err){
      delete inFlightControllers[jobId];
      if(err && err.name==='AbortError'){
        return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'cancelled' });
      }
      return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'failed',
        error: { message:'네트워크 오류로 이미지 생성 서버에 연결하지 못했습니다.', code:'network_error' } });
    }).then(function(resp){ delete inFlightControllers[jobId]; return resp; });

    return { jobId: jobId, promise: promise };
  };

  P.cancel = function(jobId){
    var controller = inFlightControllers[jobId];
    if(!controller) return false;
    controller.abort();
    delete inFlightControllers[jobId];
    fetch(GATEWAY_BASE+'/cancel', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jobId: jobId }) }).catch(function(){});
    return true;
  };

  P.normalizeResponse = function(raw){ return raw; };

  if(window.AtlasImageProviderRegistry) window.AtlasImageProviderRegistry.register(P);

})(window.AtlasOpenAIImageProvider);
