/* js/image-provider-openai.js — Phase 15: OpenAI GPT Image Provider (browser 측)

   Phase 15 당시: 실제 OpenAI API Key는 이 파일 어디에도 없었다 — 이 Provider는
   Atlas Server Gateway(server/image-gateway.js)에만 fetch()로 요청하고, Gateway가
   OpenAI를 대신 호출했다.

   V3 Phase 2 Round 32(2026-08-07): 사용자가 "각자 자기 API 키를 쓰는 방식(A안)"을
   선택했다 — js/atlas-user-api-key.js에 사용자 본인의 OpenAI API 키가 저장되어
   있으면, 이 Provider가 api.openai.com/v1/images/generations를 브라우저에서 직접
   호출한다(서버 불필요, GitHub Pages만으로 동작). gpt-image 계열 모델은 응답을
   URL이 아니라 data[0].b64_json(base64 원본 데이터)로 직접 돌려주므로, 예전
   DALL-E 시절 흔했던 "생성된 이미지 URL이 다른 도메인이라 CORS로 못 읽는" 문제가
   애초에 발생하지 않는다 — 응답 JSON 자체에 이미지 바이트가 들어있다. 사용자 키가
   없으면 기존 로컬 Gateway 경로를 그대로 쓴다(운영자 본인 테스트용, 삭제하지 않음
   — 회귀 없음). Phase 14의 ImageProvider Contract(isConfigured/validateRequest/
   generate/cancel/normalizeResponse)를 Mock/Manual Import Provider와 동일한
   모양으로 구현해 Provider Registry에 등록한다 — Image Engine/UI 코드는 이
   Provider를 다른 Provider와 전혀 다르게 취급하지 않는다(두 호출 경로 모두
   완전히 같은 Contract 응답 모양을 반환하므로). */

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

  var GATEWAY_PATH = '/api/image-gateway';
  /* GitHub Pages 같은 정적 호스팅에는 Node 서버가 없다 — 상대경로를 쓰면 요청이
     그 페이지의 도메인 자신에게 나가버려 항상 실패한다(실제로 발견된 버그).
     js/atlas-gateway-base-url.js의 resolve()로 실제 Gateway origin을 구한다. */
  function gatewayUrl(path){ return new URL(GATEWAY_PATH+path, window.AtlasGatewayBaseUrl.resolve()).href; }
  var inFlightControllers = {};
  var jobCounter = 0;

  var OPENAI_DIRECT_URL = 'https://api.openai.com/v1/images/generations';
  var DIRECT_MODEL = 'gpt-image-2';
  var DIRECT_QUALITY = 'medium';
  function ownKey(){ return window.AtlasUserApiKey ? window.AtlasUserApiKey.getOpenAIKey() : ''; }

  /* 서버 /status를 페이지 로드 시 한 번 조회해 캐시한다 — isConfigured()는 기존
     Provider들과 동일하게 동기 함수여야 하므로, 실제 조회는 refreshStatus()가
     비동기로 먼저 끝내 두고 isConfigured()는 그 캐시만 읽는다.
     V3 Phase 2 Round 32: 사용자 본인 OpenAI 키가 있으면 서버에 물어볼 필요가
     없다 — 즉시 "연결됨"으로 확정한다(일일/월간 한도는 서버가 추적해 주던
     값이라, 본인 키 모드에서는 알 수 없다는 뜻의 null로 남긴다 — 실제로는
     OpenAI 본인 계정 대시보드에서 확인해야 하는 값이므로 여기서 지어내지
     않는다). */
  var statusCache = { configured:false, model:null, quality:null, dailyUsed:null, dailyLimit:null, monthlyUsed:null, monthlyLimit:null, checked:false };

  P.refreshStatus = function(){
    if(ownKey()){
      statusCache = { configured:true, model:DIRECT_MODEL, quality:DIRECT_QUALITY, dailyUsed:null, dailyLimit:null, monthlyUsed:null, monthlyLimit:null, checked:true, mode:'own-key' };
      return Promise.resolve(statusCache);
    }
    return fetch(gatewayUrl('/status')).then(function(res){ return res.json(); }).then(function(body){
      statusCache = Object.assign({ checked:true, mode:'gateway' }, body);
      return statusCache;
    }).catch(function(){
      statusCache = { configured:false, checked:true, mode:'gateway' };
      return statusCache;
    });
  };
  P.getStatusCache = function(){ return statusCache; };

  P.isConfigured = function(){ return !!statusCache.configured; };

  P.validateRequest = function(request){ return C.validateRequest(request); };

  /* server/providers/openai-image-provider.js의 buildOpenAIPrompt/sizeForAssetType과
     의도적으로 동일한 문구·크기를 쓴다 — 두 경로(직접 호출/Gateway 경유)가
     같은 프롬프트 규칙을 따라야 결과 품질이 갈리지 않는다. */
  function buildOpenAIPrompt(providerNeutralPrompt){
    return providerNeutralPrompt
      + '\nDo not render any Korean text, any embedded text, random letters, logos, or watermarks. '
      + 'Leave the specified safe area completely clean — Atlas will add all Korean text later.';
  }
  function sizeForAssetType(assetType){ return assetType==='sales-page' ? '1024x1536' : '1536x1024'; }

  function friendlyOpenAIError(status, errBody){
    var code = errBody && errBody.code;
    var type = errBody && errBody.type;
    if(status===401 || code==='invalid_api_key') return '설정에 입력하신 OpenAI API 키가 올바르지 않습니다. 키를 다시 확인해주세요.';
    if(status===403) return 'OpenAI API 키에 이미지 생성 권한이 없습니다.';
    if(status===429 || type==='insufficient_quota') return 'OpenAI API 사용량 한도를 초과했거나 요금제 크레딧이 부족합니다.';
    if(status>=500) return 'OpenAI 서버가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.';
    return (errBody && errBody.message) || ('OpenAI 서버 오류 ('+status+')');
  }

  function normalizeGatewayJson(json, request, jobId){
    /* 서버가 이미 Contract.createResponse()로 정규화해 보내므로 그대로 신뢰하되,
       필드 누락에 대비해 한 번 더 createResponse를 통과시킨다(방어적). */
    return C.createResponse(Object.assign({ requestId: request.requestId, jobId: jobId, providerId: P.id }, json));
  }

  /* V3 Phase 2 Round 32: 사용자 본인 OpenAI 키로 api.openai.com을 브라우저에서
     직접 호출한다 — server/providers/openai-image-provider.js의 실제 요청/응답
     처리(buildRequestBody/decodeOpenAIImage)와 동일한 규칙을 그대로 따른다.
     성공/실패 모두 Gateway 경로와 완전히 같은 Contract 응답 모양으로 맞춘다. */
  function generateDirect(request, jobId, apiKey, controller){
    var size = sizeForAssetType(request.assetType);
    var body = {
      model: DIRECT_MODEL,
      prompt: buildOpenAIPrompt((request.prompt && request.prompt.positive) || ''),
      size: size,
      quality: DIRECT_QUALITY,
      output_format: 'png',
      background: 'opaque',
      n: 1
    };
    return fetch(OPENAI_DIRECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+apiKey },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    }).then(function(res){
      return res.json().then(function(json){ return { status: res.status, ok: res.ok, json: json }; });
    }).then(function(result){
      if(!result.ok){
        var errBody = (result.json && result.json.error) || {};
        console.error('[AtlasOpenAIImageProvider] direct OpenAI call failed', { status: result.status, type: errBody.type, code: errBody.code });
        return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'failed',
          error: { message: friendlyOpenAIError(result.status, errBody), code: errBody.code || 'openai_error' } });
      }
      var item = result.json && result.json.data && result.json.data[0];
      if(!item || !item.b64_json){
        return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'failed',
          error: { message:'생성된 이미지를 읽을 수 없습니다. 다시 시도해주세요.', code:'decode_failed' } });
      }
      var dims = size.split('x');
      return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'completed',
        image: { mimeType:'image/png', width:parseInt(dims[0],10), height:parseInt(dims[1],10), objectUrl: 'data:image/png;base64,'+item.b64_json, sourceType:'generated' },
        usage: { costAvailable:false } });
    });
  }

  P.generate = function(request, extra){
    jobCounter++;
    var jobId = 'openai-job-'+jobCounter+'-'+Date.now();
    var controller = (typeof AbortController!=='undefined') ? new AbortController() : null;
    if(controller) inFlightControllers[jobId] = controller;

    var key = ownKey();
    var promise = (key ? generateDirect(request, jobId, key, controller) : fetch(gatewayUrl('/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: jobId, request: request }),
      signal: controller ? controller.signal : undefined
    }).then(function(res){
      return res.json().then(function(json){ return normalizeGatewayJson(json, request, jobId); });
    })).catch(function(err){
      delete inFlightControllers[jobId];
      if(err && err.name==='AbortError'){
        return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'cancelled' });
      }
      return C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'failed',
        error: { message: key ? '네트워크 오류로 OpenAI 서버에 연결하지 못했습니다.' : '네트워크 오류로 이미지 생성 서버에 연결하지 못했습니다.', code:'network_error' } });
    }).then(function(resp){ delete inFlightControllers[jobId]; return resp; });

    return { jobId: jobId, promise: promise };
  };

  P.cancel = function(jobId){
    var controller = inFlightControllers[jobId];
    if(!controller) return false;
    controller.abort();
    delete inFlightControllers[jobId];
    /* 직접 호출 모드(사용자 본인 키)는 알릴 로컬 서버가 없다 — controller.abort()
       만으로 실제 취소는 이미 끝난다. Gateway 모드에서만 서버에도 취소를 알린다. */
    if(!ownKey()) fetch(gatewayUrl('/cancel'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jobId: jobId }) }).catch(function(){});
    return true;
  };

  P.normalizeResponse = function(raw){ return raw; };

  if(window.AtlasImageProviderRegistry) window.AtlasImageProviderRegistry.register(P);

})(window.AtlasOpenAIImageProvider);
