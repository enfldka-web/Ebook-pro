/* shared/image-generation-contract.js — Phase 14: Provider-Neutral Image Engine Foundation
   기준: Atlas는 특정 이미지 AI를 사용하는 앱이 아니라 Ebook Engine → Scene Director →
   Prompt Composer → Image Engine → Overlay Engine → Export Engine 파이프라인을 관리하는
   앱이다. 이 파일은 그 파이프라인의 Image Engine Layer와 Provider 사이에서 오가는
   요청/응답 데이터 구조를 하나로 고정한다 — 어떤 Provider(Mock/Manual Import/향후 실제
   외부 API)를 쓰든 이 계약(Contract)만 따르면 되고, Provider 고유 응답 포맷은 이 계약
   으로 정규화된 뒤에만 나머지 Atlas 코드에 전달된다.

   이 파일은 순수 함수만 담는다(DOM/네트워크 접근 없음) — Node에서 독립적으로
   테스트 가능하다. */

/* Phase 15: 서버(Express Gateway)에서도 이 동일 Contract를 require()로 재사용한다
   (Provider-neutral 계약을 브라우저/서버 양쪽에 중복 구현하지 않기 위함). window가
   없는 순수 Node 환경에서도 동작하도록 root를 안전하게 감지한다 — 기존처럼
   global.window=global을 미리 설정해 두는 브라우저/Node 테스트 하네스 방식은 그대로
   호환된다. */
var root = (typeof window!=='undefined') ? window : (typeof global!=='undefined' ? global : this);
root.AtlasImageGenerationContract = root.AtlasImageGenerationContract || {};

(function(C){

  C.ASSET_TYPES = ['thumbnail', 'sales-page'];
  C.JOB_STATUSES = ['queued', 'processing', 'completed', 'failed', 'cancelled'];
  C.IMAGE_SOURCE_TYPES = ['generated', 'manual-import', 'mock'];

  var REQUEST_SCENE_FIELDS = ['visualEvent', 'mainSubject', 'environment', 'productMockup', 'camera', 'composition', 'lighting', 'palette', 'style', 'safeArea'];
  var REQUEST_PROMPT_FIELDS = ['positive', 'negative', 'noEmbeddedText'];
  var REQUEST_OVERLAY_FIELDS = ['headline', 'subheadline', 'badge', 'cta', 'highlightWords', 'safeArea'];
  var REQUEST_CONSISTENCY_FIELDS = ['visualDNA', 'recurringSubject', 'recurringProductMockup', 'recurringPalette', 'recurringLighting'];
  var REQUEST_METADATA_FIELDS = ['topic', 'category', 'brandStrategy', 'createdAt'];

  function pick(source, fields){
    var out = {};
    fields.forEach(function(f){ out[f] = (source && source[f]!==undefined) ? source[f] : null; });
    return out;
  }

  /* Provider-neutral 요청 객체를 만든다. 호출자는 필요한 필드만 채워서 넘기면 되고,
     나머지는 안전한 기본값(null/빈 배열)으로 채워진다 — Provider마다 다른 필드
     누락 처리를 반복하지 않기 위함. */
  C.createRequest = function(fields){
    fields = fields || {};
    return {
      requestId: fields.requestId || null,
      providerId: fields.providerId || null,
      assetType: fields.assetType || null,
      assetId: fields.assetId || null,
      conceptId: fields.conceptId || null,
      pageNumber: (typeof fields.pageNumber==='number') ? fields.pageNumber : null,
      role: fields.role || null,
      width: (typeof fields.width==='number') ? fields.width : null,
      height: (typeof fields.height==='number') ? fields.height : null,
      aspectRatio: fields.aspectRatio || null,
      scene: pick(fields.scene, REQUEST_SCENE_FIELDS),
      prompt: (function(){
        var p = pick(fields.prompt, REQUEST_PROMPT_FIELDS);
        if(p.noEmbeddedText===null) p.noEmbeddedText = true;
        return p;
      })(),
      overlay: pick(fields.overlay, REQUEST_OVERLAY_FIELDS),
      consistency: pick(fields.consistency, REQUEST_CONSISTENCY_FIELDS),
      metadata: pick(fields.metadata, REQUEST_METADATA_FIELDS)
    };
  };

  /* 요청 검증 — Provider에 넘기기 전 공통으로 확인해야 하는 최소 조건만 확인한다.
     Provider별 추가 제약(예: aspectRatio 지원 여부)은 각 Provider의 validateRequest()가
     capabilities 기준으로 별도로 확인한다(이 함수가 대신하지 않음). */
  C.validateRequest = function(request){
    var errors = [];
    if(!request) { return { valid:false, errors:['request가 없습니다.'] }; }
    if(C.ASSET_TYPES.indexOf(request.assetType) === -1) errors.push('assetType은 '+C.ASSET_TYPES.join('/')+' 중 하나여야 합니다.');
    if(!request.providerId) errors.push('providerId가 필요합니다.');
    if(typeof request.width !== 'number' || request.width <= 0) errors.push('width는 양수여야 합니다.');
    if(typeof request.height !== 'number' || request.height <= 0) errors.push('height는 양수여야 합니다.');
    if(!request.scene || !request.scene.visualEvent) errors.push('scene.visualEvent가 필요합니다.');
    if(!request.scene || !request.scene.mainSubject) errors.push('scene.mainSubject가 필요합니다.');
    if(!request.prompt || !request.prompt.positive) errors.push('prompt.positive가 필요합니다.');
    if(request.prompt && request.prompt.noEmbeddedText !== true) errors.push('prompt.noEmbeddedText는 항상 true여야 합니다(이미지 내부 텍스트 금지 원칙).');
    return { valid: errors.length===0, errors: errors };
  };

  /* Provider 원본 응답을 UI에 직접 넘기지 않고 이 공통 응답 구조로만 정규화한다.
     Provider가 못 채운 필드는 안전한 기본값으로 남긴다. */
  C.createResponse = function(fields){
    fields = fields || {};
    var image = fields.image || {};
    var usage = fields.usage || {};
    var safety = fields.safety || {};
    return {
      requestId: fields.requestId || null,
      jobId: fields.jobId || null,
      providerId: fields.providerId || null,
      status: C.JOB_STATUSES.indexOf(fields.status)!==-1 ? fields.status : 'queued',
      image: {
        mimeType: image.mimeType || null,
        width: (typeof image.width==='number') ? image.width : null,
        height: (typeof image.height==='number') ? image.height : null,
        objectUrl: image.objectUrl || null,
        persistedReference: image.persistedReference || null,
        sourceType: C.IMAGE_SOURCE_TYPES.indexOf(image.sourceType)!==-1 ? image.sourceType : null
      },
      usage: {
        costAvailable: usage.costAvailable===true,
        estimatedCost: (typeof usage.estimatedCost==='number') ? usage.estimatedCost : null,
        actualCost: (typeof usage.actualCost==='number') ? usage.actualCost : null,
        currency: usage.currency || null
      },
      safety: {
        blocked: safety.blocked===true,
        reason: safety.reason || null
      },
      error: fields.error || null,
      timestamps: fields.timestamps || { createdAt: Date.now(), updatedAt: Date.now() }
    };
  };

  C.validateResponse = function(response){
    var errors = [];
    if(!response) return { valid:false, errors:['response가 없습니다.'] };
    if(C.JOB_STATUSES.indexOf(response.status)===-1) errors.push('status는 '+C.JOB_STATUSES.join('/')+' 중 하나여야 합니다.');
    if(response.status==='completed'){
      if(!response.image || !response.image.objectUrl && !response.image.persistedReference) errors.push('completed 상태는 image.objectUrl 또는 image.persistedReference 중 하나가 있어야 합니다.');
      if(!response.image || !response.image.sourceType) errors.push('completed 상태는 image.sourceType이 필요합니다.');
    }
    if(response.status==='failed' && !response.error) errors.push('failed 상태는 error가 필요합니다.');
    return { valid: errors.length===0, errors: errors };
  };

})(root.AtlasImageGenerationContract);

if(typeof module!=='undefined' && module.exports) module.exports = root.AtlasImageGenerationContract;
