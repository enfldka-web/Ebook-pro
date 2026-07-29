/* js/image-provider-manual-import.js — Phase 14: Manual Import Image Provider

   목적: Claude Design, ChatGPT 이미지, Gemini, FLUX 등 어디에서 생성했든, 사용자가
   직접 만든 실제 이미지 파일(PNG/JPG/WebP)을 Atlas로 가져와 나머지 파이프라인
   (Overlay → Export)에 그대로 태울 수 있게 한다. 이 Provider는 이미지를 "생성"하지
   않는다 — 실제 파일 디코딩(FileReader/Image 객체)은 브라우저 전용이라 여기서 하지
   않고, 호출자(js/image-engine.js, 브라우저 런타임)가 이미 읽어낸 결과만 받는다.

   generate(request, importPayload) 의 importPayload:
   { mimeType, width, height, dataUrl, sourceFileName } — 전부 호출자가 이미 디코딩해서
   넘긴 값이다. 이렇게 분리해야 Node 테스트에서도(실제 브라우저 Image 디코딩 없이)
   MIME 검증/치수 확인/정규화 로직을 독립적으로 검증할 수 있다. */

window.AtlasManualImportProvider = window.AtlasManualImportProvider || {};

(function(P){
  var C = window.AtlasImageGenerationContract;

  var ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  P.id = 'manual-import';
  P.displayName = '외부에서 만든 이미지 가져오기 (Manual Import)';
  P.allowedMimeTypes = ALLOWED_MIME_TYPES;
  P.capabilities = {
    textToImage: false, imageToImage: false, referenceImage: false,
    negativePrompt: false, seed: false,
    aspectRatios: ['any'],
    maximumImagesPerRequest: 1,
    supportsConsistencyReference: false,
    supportsTransparentBackground: true
  };

  P.isConfigured = function(){ return true; };

  P.validateRequest = function(request){ return C.validateRequest(request); };

  /* 업로드된 파일 자체의 검증 — MIME 위반은 거부(reject)하고, 규격(치수) 불일치는
     경고로만 남긴다(외부 Provider가 정확히 652×488/1080×1350로 생성해 준다는 보장이
     없으므로, Atlas가 임의로 강제 리사이즈하지 않고 사실을 그대로 알린다 — 실제
     크롭/리사이즈가 필요하면 Overlay 단계에서 처리한다). */
  P.validateImportPayload = function(request, importPayload){
    var errors = [];
    var warnings = [];
    if(!importPayload) errors.push('가져올 이미지 데이터가 없습니다.');
    else {
      if(ALLOWED_MIME_TYPES.indexOf(importPayload.mimeType) === -1){
        errors.push('허용되지 않는 파일 형식입니다: '+importPayload.mimeType+' (PNG/JPG/WebP만 가능)');
      }
      if(!importPayload.dataUrl) errors.push('이미지 데이터(dataUrl)가 없습니다.');
      if(typeof importPayload.width !== 'number' || importPayload.width <= 0) errors.push('이미지 width를 확인할 수 없습니다.');
      if(typeof importPayload.height !== 'number' || importPayload.height <= 0) errors.push('이미지 height를 확인할 수 없습니다.');
      if(request && importPayload.width && importPayload.height && request.width && request.height){
        if(importPayload.width !== request.width || importPayload.height !== request.height){
          warnings.push('업로드한 이미지 규격('+importPayload.width+'x'+importPayload.height+')이 요청 규격('+request.width+'x'+request.height+')과 다릅니다. Overlay 단계에서 확인해주세요.');
        }
      }
    }
    return { valid: errors.length===0, errors: errors, warnings: warnings };
  };

  var jobCounter = 0;

  /* Manual Import는 대기열/외부 네트워크 호출이 없으므로 즉시 완료된다 — 그래도
     다른 Provider와 동일하게 { jobId, promise } 형태를 반환해 image-engine.js가
     Provider 종류와 무관하게 동일한 방식으로 다룰 수 있게 한다. */
  P.generate = function(request, importPayload){
    jobCounter++;
    var jobId = 'manual-import-job-'+jobCounter+'-'+Date.now();
    var reqValidation = C.validateRequest(request);
    var payloadValidation = P.validateImportPayload(request, importPayload);
    if(!reqValidation.valid || !payloadValidation.valid){
      var errors = reqValidation.errors.concat(payloadValidation.errors);
      var failed = C.createResponse({
        requestId: request && request.requestId, jobId: jobId, providerId: P.id, status:'failed',
        error: { message:'Manual Import 검증 실패', details: errors },
        safety: { blocked:true, reason: errors.join(' / ') }
      });
      return { jobId: jobId, promise: Promise.resolve(failed) };
    }
    var completed = C.createResponse({
      requestId: request.requestId, jobId: jobId, providerId: P.id, status:'completed',
      image: {
        mimeType: importPayload.mimeType, width: importPayload.width, height: importPayload.height,
        objectUrl: importPayload.dataUrl, sourceType:'manual-import'
      },
      usage: { costAvailable:false },
      error: payloadValidation.warnings.length ? null : null
    });
    completed.warnings = payloadValidation.warnings;
    return { jobId: jobId, promise: Promise.resolve(completed) };
  };

  /* Manual Import는 비동기 대기 상태가 없어 취소 대상이 없다 — 항상 false. */
  P.cancel = function(){ return false; };

  P.normalizeResponse = function(raw){ return raw; };

  if(window.AtlasImageProviderRegistry) window.AtlasImageProviderRegistry.register(P);

})(window.AtlasManualImportProvider);
