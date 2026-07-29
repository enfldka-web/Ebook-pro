/* js/image-engine.js — Phase 14: Provider-Neutral Image Engine (orchestrator)

   파이프라인: Ebook Engine → Ebook Analysis(Creative Campaign Engine, 기존) →
   Thumbnail/Sales Page Scene Director(이 파일) → Prompt Composer(provider-neutral-
   prompt-composer.js) → Image Engine Layer(이 파일, Provider Registry 경유) →
   Overlay Engine(atlas-overlay-engine.js) → Export(image-generation-ui.js).

   이 파일은 Phase 12.4/14의 Creative Campaign Engine이 이미 계산해 둔 Scene/Event/
   Camera/Composition/Lighting/Visual Style 데이터를 읽기 전용으로 재사용만 한다
   (재계산하지 않음, CCE 자체는 수정하지 않음). Claude Design 같은 특정 Provider
   이름을 이 파일 어디에도 하드코딩하지 않는다 — Provider 선택은 항상
   AtlasImageProviderRegistry를 통한다. */

window.AtlasImageEngine = window.AtlasImageEngine || {};

(function(IE){
  var C = window.AtlasImageGenerationContract;
  var PC = window.AtlasProviderNeutralPromptComposer;
  var Registry = window.AtlasImageProviderRegistry;

  IE.THUMBNAIL_SIZE = { width:652, height:488 };
  IE.SALES_PAGE_SIZE = { width:1080, height:1350 };

  /* ── Scene Layer ── */

  /* 5개 Thumbnail Concept 각각의 Scene을 만든다. 5개가 서로 다른 Visual Event/Main
     Subject/Camera/Composition/Environment/Emotional Direction을 갖도록 CCE Phase 14
     English Director를 archetypeId별로 그대로 재사용한다(색/배치만 바꾸는 것이 아님). */
  IE.buildThumbnailScenes = function(creativeCampaign, category, brandStrategy){
    var CCE = window.AtlasCreativeCampaignEngine;
    if(!creativeCampaign || !creativeCampaign.bigIdeas) return [];
    var briefsById = {};
    (creativeCampaign.thumbnailBriefs||[]).forEach(function(b){ briefsById[b.conceptId] = b; });
    return creativeCampaign.bigIdeas.map(function(concept){
      var brief = briefsById[concept.conceptId] || {};
      var archetypeId = concept.archetypeId;
      return {
        assetType: 'thumbnail',
        conceptId: concept.conceptId,
        conceptName: concept.conceptName,
        assetLabel: 'Thumbnail Concept — '+concept.conceptName,
        archetypeId: archetypeId,
        visualEvent: CCE.sceneDirector(archetypeId, category),
        mainSubject: CCE.mainSubjectEn(concept, category),
        productMockup: CCE.productMockupEn(category),
        environment: CCE.environmentLibrary(category),
        camera: CCE.cameraDirector(archetypeId),
        composition: CCE.compositionDirectorV2(archetypeId),
        lighting: CCE.lightingDirector(brandStrategy),
        style: CCE.visualStyleDirector(archetypeId),
        palette: (brief.lightingAndColor && brief.lightingAndColor.paletteRole && brief.lightingAndColor.paletteRole.dominant) || '',
        safeArea: brief.safeArea || '',
        negativePrompt: brief.negativeInstructions || '',
        emotionalDirection: concept.emotionalHook || '',
        width: IE.THUMBNAIL_SIZE.width, height: IE.THUMBNAIL_SIZE.height
      };
    });
  };

  /* 9개 Sales Page Scene — 동일 상품/목업/주인공 정체성/팔레트/조명/Visual DNA를
     유지하되(캠페인 전체 통일된 primaryMedium/lighting 재사용), Scene/Camera/
     Composition/Shot distance/Product role/Information density는 역할마다 다르게
     CCE의 Sales Page Director 9종을 그대로 재사용한다. */
  IE.buildSalesPageScenes = function(creativeCampaign, category, brandStrategy){
    var CCE = window.AtlasCreativeCampaignEngine;
    if(!creativeCampaign || !creativeCampaign.salesPageStoryboard) return [];
    var roleKeys = CCE.SALES_PAGE_ROLE_KEYS || [];
    var subjectRequired = CCE.subjectDirector(category).subjectRequired;
    return creativeCampaign.salesPageStoryboard.map(function(page, i){
      var roleKey = roleKeys[i];
      return {
        assetType: 'sales-page',
        pageNumber: page.pageNumber,
        role: page.role,
        roleKey: roleKey,
        assetLabel: 'Sales Page Page '+page.pageNumber+' — '+page.role,
        visualEvent: CCE.salesPageSceneDirector(roleKey, category),
        mainSubject: CCE.salesPageMainSubjectEn(roleKey, category, subjectRequired),
        productMockup: CCE.productMockupEn(category),
        environment: CCE.environmentLibrary(category),
        camera: CCE.salesPageCameraDirector(roleKey),
        composition: CCE.salesPageCompositionDirector(roleKey),
        lighting: CCE.lightingDirector(brandStrategy),
        style: creativeCampaign.primaryMedium,
        palette: (page.lightingAndColor && page.lightingAndColor.paletteRole && page.lightingAndColor.paletteRole.dominant) || '',
        safeArea: (page.safeArea && page.safeArea.phrase) || '',
        negativePrompt: page.negativeInstructions || '',
        width: IE.SALES_PAGE_SIZE.width, height: IE.SALES_PAGE_SIZE.height
      };
    });
  };

  /* ── Prompt Layer ── */
  IE.composePrompt = function(scene){
    return scene.assetType==='sales-page' ? PC.composeSalesPagePrompt(scene) : PC.composeThumbnailPrompt(scene);
  };

  /* ── Image Engine Layer ── */
  var jobs = {}; /* jobId -> normalized response (최신 상태) */
  var requestCounter = 0;

  IE.buildRequest = function(scene, providerId){
    requestCounter++;
    var requestId = 'req-'+requestCounter+'-'+Date.now();
    var positivePrompt = IE.composePrompt(scene);
    return C.createRequest({
      requestId: requestId, providerId: providerId,
      assetType: scene.assetType, assetId: scene.conceptId || scene.pageNumber,
      conceptId: scene.conceptId || null, pageNumber: (typeof scene.pageNumber==='number'?scene.pageNumber:null),
      role: scene.role || scene.assetLabel,
      width: scene.width, height: scene.height,
      aspectRatio: scene.assetType==='sales-page' ? '4:5' : '4:3',
      scene: {
        visualEvent: scene.visualEvent, mainSubject: scene.mainSubject, environment: scene.environment,
        productMockup: scene.productMockup, camera: scene.camera, composition: scene.composition,
        lighting: scene.lighting, palette: scene.palette, style: scene.style, safeArea: scene.safeArea
      },
      prompt: { positive: positivePrompt, negative: scene.negativePrompt||'', noEmbeddedText:true },
      overlay: {},
      consistency: {},
      metadata: { category: scene.category||null, brandStrategy: scene.brandStrategy||null, createdAt: Date.now() }
    });
  };

  /* Provider를 Registry에서 찾아 요청을 제출한다. manual-import는 importPayload가
     반드시 필요하다(다른 Provider는 undefined로 전달돼도 무방). 반환값은
     { jobId, promise } — promise는 정규화된 최종 Response로 resolve된다. jobs{}에도
     최신 상태를 계속 기록해 getJob(jobId)로 폴링할 수 있게 한다. */
  IE.submit = function(request, providerId, importPayload){
    var provider = Registry.get(providerId);
    if(!provider){
      var noProviderResp = C.createResponse({ requestId: request.requestId, providerId: providerId, status:'failed', error:{ message:'등록되지 않은 Provider입니다: '+providerId } });
      return { jobId:null, promise: Promise.resolve(noProviderResp) };
    }
    var validation = provider.validateRequest(request);
    if(!validation.valid){
      var invalidResp = C.createResponse({ requestId: request.requestId, providerId: providerId, status:'failed', error:{ message:'요청 검증 실패', details: validation.errors } });
      return { jobId:null, promise: Promise.resolve(invalidResp) };
    }
    var result = provider.generate(request, importPayload);
    jobs[result.jobId] = C.createResponse({ requestId: request.requestId, jobId: result.jobId, providerId: providerId, status:'processing' });
    result.promise = result.promise.then(function(resp){ jobs[result.jobId] = resp; return resp; });
    return result;
  };

  IE.cancel = function(jobId, providerId){
    var provider = Registry.get(providerId);
    if(!provider) return false;
    var cancelled = provider.cancel(jobId);
    if(cancelled && jobs[jobId]) jobs[jobId] = C.createResponse({ requestId: jobs[jobId].requestId, jobId: jobId, providerId: providerId, status:'cancelled' });
    return cancelled;
  };

  IE.getJob = function(jobId){ return jobs[jobId] || null; };

  IE.reset = function(){ jobs = {}; requestCounter = 0; };

})(window.AtlasImageEngine);
