/* js/image-generation-ui.js — Phase 14/15/15.2: Image Production UI

   Phase 14: Provider-neutral Image Engine(Scene/Prompt/Provider/Overlay/Export).
   Phase 15: 실제 OpenAI GPT Image Provider 연결 + Queue(동시 생성 2)/Retry/Cancel.
   Phase 15.1: Generate 버튼의 최종 워크플로 폴리시(Mock 리허설 포함).
   Phase 15.2: Creative Director UI & Concept-First Workflow — Generate 전에 먼저
   판매 전략 5개(Thumbnail)/장면 9개(Sales Page)를 "기획"하고 사용자에게 보여준
   뒤에만 실제 이미지 생성으로 넘어간다. 사용자는 Prompt 원문을 기본 화면에서
   보지 않는다 — 전략/장면/이유만 본다. 기존 Queue/Overlay/Download/OpenAI Provider
   구조는 전혀 바꾸지 않는다(재사용만). */

window.AtlasImageProductionUI = window.AtlasImageProductionUI || {};

(function(UI){
  var S = window.AtlasImageProductionState;
  var IE = window.AtlasImageEngine;
  var OE = window.AtlasOverlayEngine;
  var Registry = window.AtlasImageProviderRegistry;
  var CDA = window.AtlasCreativeDirectorAdapter;

  function x(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  var THUMB_SAFE_AREA_RECT = { x:0, y:0.62, w:1, h:0.38 };
  var SALES_PAGE_SAFE_AREA_RECT = { x:0, y:0.80, w:1, h:0.20 };
  var PRIMARY_PROVIDER_ID = 'openai-gpt-image';
  var MAX_AUTO_REPLAN_ATTEMPTS = 3;

  /* 현재 승인된 카테고리/브랜드전략/Creative Campaign을 한 곳에서 읽는다 — plan/
     replan/generate가 전부 이 값을 공유한다. */
  function campaignContext(){
    var AIP = window.AtlasAIPlanner;
    var cc = AIP && AIP.state && AIP.state.creativeCampaign;
    if(!cc) return null;
    var category = (AIP.state.visualPromptSet && AIP.state.visualPromptSet.visualStrategy && AIP.state.visualPromptSet.visualStrategy.category) || 'neutral';
    var brandStrategy = APP.brandProfile ? APP.brandProfile.brandStrategy : (AIP.state.selectedBrandPackId ? AIP.brandProfileDefaults[AIP.state.selectedBrandPackId].brandStrategy : null);
    return { creativeCampaign: cc, category: category, brandStrategy: brandStrategy };
  }

  /* CCE.productTruthExtractor/audienceInsightDirector가 기대하는 input 모양을
     ai-planner.js의 computeMarketingCopyForSelection()과 동일한 소스(APP.titleAnalysis
     ||APP.smartAnalysis)에서 조립한다 — 재계산이 아니라 이미 승인된 값을 그대로 읽는다. */
  function productAndAudienceInsight(ctx){
    var CCE = window.AtlasCreativeCampaignEngine;
    var AIP = window.AtlasAIPlanner;
    var analysis = APP.titleAnalysis || APP.smartAnalysis || {};
    var input = {
      topic: analysis.topic||'', targetAudience: analysis.target||'', marketingCopy: APP.marketingCopy,
      brandProfile: APP.brandProfile, visualPromptSet: AIP.state.visualPromptSet
    };
    var productTruth = CCE.productTruthExtractor(input);
    var audienceInsight = CCE.audienceInsightDirector(input, ctx.category);
    return { productTruth: productTruth, audienceInsight: audienceInsight };
  }

  /* ── 초기화: 이 시점에는 아직 아무 것도 기획하지 않는다("Generate" 전에 사용자가
     [썸네일 크리에이티브 5개 기획]을 직접 눌러야 한다) — OpenAI Provider 준비
     상태만 미리 확인해 둔다. ── */
  UI.populate = function(){
    var st = S.get(); if(!st) return;
    UI.refreshProviderStatus();
    UI.render();
  };

  UI.refreshProviderStatus = function(){
    var st = S.get(); if(!st) return Promise.resolve();
    var openai = window.AtlasOpenAIImageProvider;
    if(!openai || !openai.refreshStatus) { st.providerStatusChecked = true; UI.render(); return Promise.resolve(); }
    return openai.refreshStatus().then(function(status){
      st.providerStatusChecked = true;
      if(status.configured && !st.selectedProviderId) st.selectedProviderId = PRIMARY_PROVIDER_ID;
      UI.render();
    });
  };

  UI.effectivePrimaryProviderId = function(){
    var st = S.get();
    var sel = st && st.selectedProviderId;
    if(sel === 'mock') return 'mock';
    var openai = window.AtlasOpenAIImageProvider;
    var openaiReady = !!(openai && openai.isConfigured && openai.isConfigured());
    if(sel === PRIMARY_PROVIDER_ID || !sel) return openaiReady ? PRIMARY_PROVIDER_ID : null;
    return null;
  };

  UI.setProvider = function(providerId){
    var st = S.get(); if(!st) return;
    st.selectedProviderId = providerId;
    UI.render();
  };

  /* ══════════════════════════════════════════════════════════════
     Creative Director — Concept-First Planning (§6: 이미지 API 호출 없음, 비용 없음)
     ══════════════════════════════════════════════════════════════ */

  /* §14: 5개 Concept 조건(중복/다양성) 미달이면 이미지 생성 전에 자동 재기획한다.
     점수 시스템이 아니라 조건 충족 여부만 본다. */
  UI.planThumbnailConcepts = function(){
    var st = S.get(); if(!st) return;
    var ctx = campaignContext(); if(!ctx) return;
    var insight = productAndAudienceInsight(ctx);
    var concepts = CDA.buildThumbnailConcepts(ctx.creativeCampaign, ctx.category, ctx.brandStrategy, insight.productTruth, insight.audienceInsight);

    var attempts = 0;
    var validation = CDA.validateThumbnailConceptSet(concepts);
    while(!validation.ok && attempts < MAX_AUTO_REPLAN_ATTEMPTS){
      /* 조건을 못 채운 원인이 되는 첫 Concept부터 순서대로 재기획을 시도한다. */
      concepts.forEach(function(c){ CDA.replanThumbnailConcept(c, ctx.creativeCampaign, ctx.category, ctx.brandStrategy, insight.productTruth, insight.audienceInsight); });
      validation = CDA.validateThumbnailConceptSet(concepts);
      attempts++;
    }

    st.creativeDirector.thumbnailConcepts = concepts;
    st.creativeDirector.thumbnailPlanStatus = 'planned';
    st.creativeDirector.lastPlannedAt = Date.now();
    UI.render();
  };

  UI.planSalesPageScenes = function(){
    var st = S.get(); if(!st) return;
    var ctx = campaignContext(); if(!ctx) return;
    var scenes = CDA.buildSalesPageDirectorScenes(ctx.creativeCampaign, ctx.category, ctx.brandStrategy);

    var attempts = 0;
    var validation = CDA.validateSalesPageSceneSet(scenes);
    while(!validation.ok && attempts < MAX_AUTO_REPLAN_ATTEMPTS){
      scenes.forEach(function(s){ CDA.replanSalesPageScene(s, ctx.creativeCampaign, ctx.category, ctx.brandStrategy); });
      validation = CDA.validateSalesPageSceneSet(scenes);
      attempts++;
    }

    st.creativeDirector.salesPageScenes = scenes;
    st.creativeDirector.salesPagePlanStatus = 'planned';
    st.creativeDirector.lastPlannedAt = Date.now();
    UI.render();
  };

  /* Phase 17.1: STEP4 "상품을 더 크게/인물 제거/더 고급스럽게/더 밝게" 버튼 —
     새 평가/점수 Engine을 추가하지 않고, 이미 Provider-neutral Prompt Composer가
     참조하는 기존 scene 필드(productMockup/negativePrompt/style/lighting)에 고정
     문구만 덧붙인 뒤 기존 generateThumbnail()을 그대로 재사용해 새 Version을
     만든다 — Prompt 구조 자체는 바꾸지 않는다. */
  var STYLE_MODIFIERS = {
    'bigger-product': { field:'productMockup', suffix:', product mockup significantly larger and more prominent, filling most of the frame' },
    'remove-person': { field:'negativePrompt', suffix:', people, human figures, hands, faces' },
    'more-premium': { field:'style', suffix:', more premium and luxurious visual style' },
    'brighter': { field:'lighting', suffix:', brighter overall exposure, more light' }
  };
  UI.applyStyleModifierAndRegenerate = function(conceptId, modifierKey){
    var card = conceptById(conceptId); if(!card || !card._engineScene) return;
    var mod = STYLE_MODIFIERS[modifierKey]; if(!mod) return;
    var scene = card._engineScene;
    scene[mod.field] = String(scene[mod.field]||'') + mod.suffix;
    UI.generateThumbnail(conceptId);
  };

  /* §7: Concept 자체를 재기획한다 — 다른 Strategy Type으로 바꾸지 않고, 기존
     결과(resultIds/갤러리)는 삭제하지 않는다. */
  UI.replanThumbnailConcept = function(conceptId){
    var st = S.get(); var ctx = campaignContext(); if(!st || !ctx) return;
    var card = conceptById(conceptId); if(!card) return;
    var insight = productAndAudienceInsight(ctx);
    CDA.replanThumbnailConcept(card, ctx.creativeCampaign, ctx.category, ctx.brandStrategy, insight.productTruth, insight.audienceInsight);
    UI.render();
  };

  UI.replanSalesPageScene = function(pageNumber){
    var st = S.get(); var ctx = campaignContext(); if(!st || !ctx) return;
    var page = pageByNumber(pageNumber); if(!page) return;
    CDA.replanSalesPageScene(page, ctx.creativeCampaign, ctx.category, ctx.brandStrategy);
    UI.render();
  };

  function conceptById(conceptId){
    var st = S.get();
    return (st.creativeDirector.thumbnailConcepts||[]).filter(function(c){ return c.conceptId===conceptId; })[0] || null;
  }
  function pageByNumber(pageNumber){
    var st = S.get();
    return (st.creativeDirector.salesPageScenes||[]).filter(function(p){ return p.pageNumber===pageNumber; })[0] || null;
  }

  function pushResult(list, response){ list.push(response); }

  /* ══════════════════════════════════════════════════════════════
     이미지 생성 — Concept이 기획된 뒤에만 의미가 있다(card._engineScene은 planning
     단계에서 이미 만들어져 있다 — 여기서 다시 계산하지 않는다).
     ══════════════════════════════════════════════════════════════ */
  UI.generateThumbnail = function(conceptId, providerIdOverride){
    var st = S.get(); var card = conceptById(conceptId); if(!card || !card._engineScene) return;
    var providerId = providerIdOverride || st.selectedProviderId;
    if(!providerId) return;
    var request = IE.buildRequest(card._engineScene, providerId);
    var submission = IE.submit(request, providerId);
    st.thumbnail.inFlightByConcept = st.thumbnail.inFlightByConcept || {};
    st.thumbnail.inFlightByConcept[conceptId] = { jobId: submission.jobId, providerId: providerId, status:'processing' };
    card.generationStatus = 'processing';
    UI.render();
    submission.promise.then(function(resp){
      if(st.thumbnail.inFlightByConcept[conceptId] && st.thumbnail.inFlightByConcept[conceptId].jobId===submission.jobId) delete st.thumbnail.inFlightByConcept[conceptId];
      card.generationStatus = resp.status;
      if(resp.status==='completed'){ pushResult(st.thumbnail.results, Object.assign({ conceptId:conceptId }, resp)); card.resultIds.push(resp.jobId); }
      else if(resp.status==='failed') st.errors.push({ assetType:'thumbnail', conceptId: conceptId, error: resp.error });
      UI.render();
    });
  };

  UI.cancelThumbnail = function(conceptId){
    var st = S.get();
    if(st.thumbnailQueue){
      var queueItem = st.thumbnailQueue.items()[conceptId];
      if(queueItem && queueItem.status==='queued'){ st.thumbnailQueue.cancelPending(conceptId); UI.render(); return; }
    }
    var inFlight = (st.thumbnail.inFlightByConcept||{})[conceptId];
    if(!inFlight) return;
    IE.cancel(inFlight.jobId, inFlight.providerId);
  };

  /* §10: 기존 Queue(동시 생성 2)를 그대로 재사용한다(새 Queue 아님). Concept이
     기획되지 않았으면(§6) 아무 것도 하지 않는다 — 버튼도 render()에서 비활성화된다. */
  UI.generateThumbnails = function(){
    var st = S.get(); if(!st) return;
    if(st.creativeDirector.thumbnailPlanStatus!=='planned') return;
    var providerId = UI.effectivePrimaryProviderId();
    if(!providerId) { UI.render(); return; }
    var queue = window.AtlasImageGenerationQueue.createQueue(2);
    st.thumbnailQueue = queue;
    st.thumbnail.inFlightByConcept = {};
    st.creativeDirector.thumbnailConcepts.forEach(function(card){
      queue.enqueue(card.conceptId, function(){
        var request = IE.buildRequest(card._engineScene, providerId);
        var submission = IE.submit(request, providerId);
        st.thumbnail.inFlightByConcept[card.conceptId] = { jobId: submission.jobId, providerId: providerId, status:'processing' };
        card.generationStatus = 'processing';
        UI.render();
        return submission;
      }, function(item){
        delete st.thumbnail.inFlightByConcept[card.conceptId];
        card.generationStatus = item.status;
        if(item.status==='completed'){ pushResult(st.thumbnail.results, Object.assign({ conceptId:card.conceptId }, item.response)); card.resultIds.push(item.response.jobId); }
        else if(item.status==='failed') st.errors.push({ assetType:'thumbnail', conceptId: card.conceptId, error: item.response&&item.response.error });
        UI.render();
      });
    });
    UI.render();
  };

  /* Phase 14/15 회귀 + 리허설: Mock을 강제 사용한다. 아직 기획되지 않았으면 먼저
     기획한 뒤(비용 없음) 생성한다(테스트 편의 — 실제 Provider 흐름은 항상 기획을
     먼저 요구하는 §6 규칙을 그대로 따른다). */
  UI.generateAllThumbnailsMock = function(){
    var st = S.get(); if(!st) return;
    if(st.creativeDirector.thumbnailPlanStatus!=='planned') UI.planThumbnailConcepts();
    st.creativeDirector.thumbnailConcepts.forEach(function(card){ UI.generateThumbnail(card.conceptId, 'mock'); });
  };

  UI.generateSalesPage = function(pageNumber, providerIdOverride){
    var st = S.get(); var page = pageByNumber(pageNumber); if(!page || !page._engineScene) return;
    var providerId = providerIdOverride || st.selectedProviderId;
    if(!providerId) return;
    var request = IE.buildRequest(page._engineScene, providerId);
    var submission = IE.submit(request, providerId);
    st.salesPage.inFlightByPage = st.salesPage.inFlightByPage || {};
    st.salesPage.inFlightByPage[pageNumber] = { jobId: submission.jobId, providerId: providerId, status:'processing' };
    page.generationStatus = 'processing';
    UI.render();
    submission.promise.then(function(resp){
      if(st.salesPage.inFlightByPage[pageNumber] && st.salesPage.inFlightByPage[pageNumber].jobId===submission.jobId) delete st.salesPage.inFlightByPage[pageNumber];
      page.generationStatus = resp.status;
      if(resp.status==='completed'){
        st.salesPage.resultsByPage[pageNumber] = st.salesPage.resultsByPage[pageNumber] || [];
        pushResult(st.salesPage.resultsByPage[pageNumber], Object.assign({ pageNumber:pageNumber }, resp));
        page.resultIds.push(resp.jobId);
      } else if(resp.status==='failed') st.errors.push({ assetType:'sales-page', pageNumber: pageNumber, error: resp.error });
      UI.render();
    });
  };

  UI.cancelSalesPage = function(pageNumber){
    var st = S.get();
    if(st.salesPageQueue){
      var queueItem = st.salesPageQueue.items()[pageNumber];
      if(queueItem && queueItem.status==='queued'){ st.salesPageQueue.cancelPending(pageNumber); UI.render(); return; }
    }
    var inFlight = (st.salesPage.inFlightByPage||{})[pageNumber];
    if(!inFlight) return;
    IE.cancel(inFlight.jobId, inFlight.providerId);
  };

  UI.generateSalesPages = function(){
    var st = S.get(); if(!st) return;
    if(st.creativeDirector.salesPagePlanStatus!=='planned') return;
    var providerId = UI.effectivePrimaryProviderId();
    if(!providerId) { UI.render(); return; }
    var queue = window.AtlasImageGenerationQueue.createQueue(2);
    st.salesPageQueue = queue;
    st.salesPage.inFlightByPage = {};
    st.creativeDirector.salesPageScenes.forEach(function(page){
      queue.enqueue(page.pageNumber, function(){
        var request = IE.buildRequest(page._engineScene, providerId);
        var submission = IE.submit(request, providerId);
        st.salesPage.inFlightByPage[page.pageNumber] = { jobId: submission.jobId, providerId: providerId, status:'processing' };
        page.generationStatus = 'processing';
        UI.render();
        return submission;
      }, function(item){
        delete st.salesPage.inFlightByPage[page.pageNumber];
        page.generationStatus = item.status;
        if(item.status==='completed'){
          st.salesPage.resultsByPage[page.pageNumber] = st.salesPage.resultsByPage[page.pageNumber] || [];
          pushResult(st.salesPage.resultsByPage[page.pageNumber], Object.assign({ pageNumber:page.pageNumber }, item.response));
          page.resultIds.push(item.response.jobId);
        } else if(item.status==='failed') st.errors.push({ assetType:'sales-page', pageNumber: page.pageNumber, error: item.response&&item.response.error });
        UI.render();
      });
    });
    UI.render();
  };

  UI.generateAllSalesPagesMock = function(){
    var st = S.get(); if(!st) return;
    if(st.creativeDirector.salesPagePlanStatus!=='planned') UI.planSalesPageScenes();
    st.creativeDirector.salesPageScenes.forEach(function(page){ UI.generateSalesPage(page.pageNumber, 'mock'); });
  };

  /* ── Manual Import: 실제 File → Image → 치수 디코딩(Phase 13 CF 패턴과 동일) ── */
  function decodeAndImport(file, onReady){
    var objectUrl = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){ onReady({ mimeType:file.type, width:img.naturalWidth, height:img.naturalHeight, dataUrl:objectUrl }); };
    img.onerror = function(){ onReady({ mimeType:file.type, width:0, height:0, dataUrl:objectUrl }); };
    img.src = objectUrl;
  }

  UI.onThumbnailFileSelected = function(conceptId, inputEl){
    var file = inputEl.files && inputEl.files[0]; if(!file) return;
    var st = S.get(); var card = conceptById(conceptId); if(!card || !card._engineScene) return;
    decodeAndImport(file, function(importPayload){
      var request = IE.buildRequest(card._engineScene, 'manual-import');
      var submission = IE.submit(request, 'manual-import', importPayload);
      submission.promise.then(function(resp){
        card.generationStatus = resp.status;
        if(resp.status==='completed'){ pushResult(st.thumbnail.results, Object.assign({ conceptId:conceptId }, resp)); card.resultIds.push(resp.jobId); }
        else st.errors.push({ assetType:'thumbnail', conceptId: conceptId, error: resp.error });
        UI.render();
      });
    });
  };

  UI.onSalesPageFileSelected = function(pageNumber, inputEl){
    var file = inputEl.files && inputEl.files[0]; if(!file) return;
    var st = S.get(); var page = pageByNumber(pageNumber); if(!page || !page._engineScene) return;
    decodeAndImport(file, function(importPayload){
      var request = IE.buildRequest(page._engineScene, 'manual-import');
      var submission = IE.submit(request, 'manual-import', importPayload);
      submission.promise.then(function(resp){
        page.generationStatus = resp.status;
        if(resp.status==='completed'){
          st.salesPage.resultsByPage[pageNumber] = st.salesPage.resultsByPage[pageNumber] || [];
          pushResult(st.salesPage.resultsByPage[pageNumber], Object.assign({ pageNumber:pageNumber }, resp));
          page.resultIds.push(resp.jobId);
        } else st.errors.push({ assetType:'sales-page', pageNumber: pageNumber, error: resp.error });
        UI.render();
      });
    });
  };

  /* ── 후보 선택 + 한글 Overlay 적용 + Export (Phase14 그대로) ── */
  UI.selectThumbnailResult = function(jobId){
    var st = S.get(); st.thumbnail.selectedResultId = jobId; UI.render();
  };
  UI.selectSalesPageResult = function(pageNumber, jobId){
    var st = S.get();
    st.salesPage._selectedByPage = st.salesPage._selectedByPage || {};
    st.salesPage._selectedByPage[pageNumber] = jobId;
    UI.render();
  };

  function approvedThumbnailCopy(){
    var mc = APP.marketingCopy || {};
    return { headline: mc.headline||'', subheadline: mc.subheadline||'', badge: mc.badge||'', cta: (mc.cta&&mc.cta.text)||mc.cta||'' };
  }
  function storyboardPageByNumber(pageNumber){
    var AIP = window.AtlasAIPlanner;
    var cc = AIP && AIP.state && AIP.state.creativeCampaign;
    if(!cc || !cc.salesPageStoryboard) return null;
    return cc.salesPageStoryboard.filter(function(p){ return p.pageNumber===pageNumber; })[0] || null;
  }
  function approvedSalesPageCopy(storyboardPage){
    var ac = (storyboardPage && storyboardPage.approvedCopy) || {};
    return { headline: ac.headline||'', subheadline: ac.subheadline||'', badge: storyboardPage?storyboardPage.role:'', cta: (typeof ac.cta==='string'?ac.cta:'') };
  }

  function loadImageFromUrl(url, cb){
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function(){ cb(img); };
    img.onerror = function(){ cb(null); };
    img.src = url;
  }

  /* Phase 17.1: "카피만 변경" — customCopy가 있으면(사용자가 STEP4에서 직접 수정한
     문구) 그 값으로, 없으면 기존처럼 승인된 Marketing Copy로 오버레이한다. 이미지
     재생성 없이 같은 배경에 새 문구만 다시 입힌다 — Overlay Engine은 그대로 재사용. */
  UI.applyThumbnailOverlay = function(customCopy){
    var st = S.get();
    var result = (st.thumbnail.results||[]).filter(function(r){ return r.jobId===st.thumbnail.selectedResultId; })[0];
    if(!result) return;
    loadImageFromUrl(result.image.objectUrl, function(img){
      var composite = OE.composeThumbnailOverlay(img, customCopy||approvedThumbnailCopy(), THUMB_SAFE_AREA_RECT, {});
      st.thumbnail.finalComposite = { dataUrl: composite.dataUrl, width: composite.width, height: composite.height, sourceJobId: result.jobId, sourceType: result.image.sourceType };
      UI.render();
    });
  };

  UI.applyThumbnailOverlayWithCopy = function(){
    function v(id){ var el=document.getElementById(id); return el?el.value:''; }
    UI.applyThumbnailOverlay({ headline:v('ipe-thumb-copy-headline'), subheadline:v('ipe-thumb-copy-subheadline'), badge:v('ipe-thumb-copy-badge'), cta:v('ipe-thumb-copy-cta') });
  };

  UI.applySalesPageOverlay = function(pageNumber, customCopy){
    var st = S.get();
    var jobId = (st.salesPage._selectedByPage||{})[pageNumber];
    var list = st.salesPage.resultsByPage[pageNumber] || [];
    var result = list.filter(function(r){ return r.jobId===jobId; })[0];
    if(!result) return;
    var storyboardPage = storyboardPageByNumber(pageNumber);
    loadImageFromUrl(result.image.objectUrl, function(img){
      var composite = OE.composeSalesPageOverlay(img, customCopy||approvedSalesPageCopy(storyboardPage), SALES_PAGE_SAFE_AREA_RECT, {});
      st.salesPage.finalComposites[pageNumber] = { dataUrl: composite.dataUrl, width: composite.width, height: composite.height, sourceJobId: result.jobId, sourceType: result.image.sourceType };
      UI.render();
    });
  };

  UI.applySalesPageOverlayWithCopy = function(pageNumber){
    function v(id){ var el=document.getElementById(id); return el?el.value:''; }
    UI.applySalesPageOverlay(pageNumber, { headline:v('ipe-sp-copy-headline-'+pageNumber), subheadline:v('ipe-sp-copy-subheadline-'+pageNumber), badge:v('ipe-sp-copy-badge-'+pageNumber), cta:v('ipe-sp-copy-cta-'+pageNumber) });
  };

  function downloadDataUrl(dataUrl, fileName){
    var a = document.createElement('a'); a.href = dataUrl; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  function dataUrlToJpeg(dataUrl, cb){
    var img = new Image();
    img.onload = function(){
      var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(img,0,0);
      cb(c.toDataURL('image/jpeg', 0.92));
    };
    img.src = dataUrl;
  }

  UI.downloadThumbnail = function(format){
    var st = S.get(); var fc = st.thumbnail.finalComposite; if(!fc) return;
    if(format==='jpg') dataUrlToJpeg(fc.dataUrl, function(jpegUrl){ downloadDataUrl(jpegUrl, 'thumbnail_652x488.jpg'); });
    else downloadDataUrl(fc.dataUrl, 'thumbnail_652x488.png');
  };
  UI.downloadSalesPage = function(pageNumber, format){
    var st = S.get(); var fc = st.salesPage.finalComposites[pageNumber]; if(!fc) return;
    var base = 'sales_page_'+String(pageNumber).padStart(2,'0')+'_1080x1350';
    if(format==='jpg') dataUrlToJpeg(fc.dataUrl, function(jpegUrl){ downloadDataUrl(jpegUrl, base+'.jpg'); });
    else downloadDataUrl(fc.dataUrl, base+'.png');
  };

  UI.downloadAllSalesPagesZip = function(){
    var st = S.get();
    var finals = st.salesPage.finalComposites || {};
    var keys = Object.keys(finals);
    if(!keys.length || typeof JSZip==='undefined') return;
    var zip = new JSZip();
    keys.forEach(function(k){
      var dataUrl = finals[k].dataUrl;
      var base64 = dataUrl.split(',')[1];
      zip.file('sales_page_'+String(k).padStart(2,'0')+'_1080x1350.png', base64, { base64:true });
    });
    zip.generateAsync({ type:'blob' }).then(function(blob){
      var url = URL.createObjectURL(blob);
      downloadDataUrl(url, 'sales_page_all.zip');
      URL.revokeObjectURL(url);
    });
  };

  /* ══════════════════════════════════════════════════════════════
     렌더링 — Creative Director 카드(§5/§8): 전략/장면/카메라/구도/상품 역할/이유를
     기본 화면에 보여주고, Prompt/Scene JSON은 <details>(고급 정보) 안에서만 노출한다.
     ══════════════════════════════════════════════════════════════ */
  function mockBanner(sourceType){
    if(sourceType!=='mock') return '';
    var provider = Registry.get('mock');
    return '<div style="font-size:11px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:4px 8px;margin-top:6px">'+x(provider?provider.mockLabel:'테스트용 Mock 결과이며 실제 AI 생성 이미지가 아닙니다.')+'</div>';
  }

  function providerStatusBannerHtml(){
    var openai = window.AtlasOpenAIImageProvider;
    var cache = openai && openai.getStatusCache ? openai.getStatusCache() : { checked:false, configured:false };
    if(!cache.checked) return '<div style="font-size:12px;color:var(--a2-text-faint)">이미지 생성 서버 상태를 확인하는 중입니다...</div>';
    if(cache.configured) return '<div style="font-size:11px;font-weight:700;color:#166534;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 10px">GPT Image 사용 가능 — 오늘 '+x(cache.dailyUsed)+'/'+x(cache.dailyLimit)+'장 · 이번 달 '+x(cache.monthlyUsed)+'/'+x(cache.monthlyLimit)+'장 사용</div>';
    return '<div style="font-size:11px;font-weight:700;color:#991b1b;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:6px 10px">이미지 생성 서버 설정이 필요합니다. (관리자: OPENAI_API_KEY 환경변수를 설정해주세요)</div>';
  }

  function limitExceededBannerHtml(){
    var openai = window.AtlasOpenAIImageProvider;
    var cache = openai && openai.getStatusCache ? openai.getStatusCache() : {};
    if(!cache.configured) return '';
    if(cache.dailyLimit!=null && cache.dailyUsed>=cache.dailyLimit) return '<div style="font-size:12px;font-weight:700;color:#991b1b;margin-top:6px">오늘 이미지 생성 한도를 모두 사용했습니다.</div>';
    if(cache.monthlyLimit!=null && cache.monthlyUsed>=cache.monthlyLimit) return '<div style="font-size:12px;font-weight:700;color:#991b1b;margin-top:6px">이번 달 이미지 생성 한도를 모두 사용했습니다.</div>';
    return '';
  }

  function providerSelectorHtml(){
    var st = S.get();
    var providers = Registry.list();
    return '<select id="ipe-provider-select" class="a2-input" style="max-width:260px" onchange="AtlasImageProductionUI.setProvider(this.value)">'
      + '<option value="">(선택 안 함)</option>'
      + providers.map(function(p){ return '<option value="'+x(p.id)+'"'+(st.selectedProviderId===p.id?' selected':'')+'>'+x(p.displayName)+'</option>'; }).join('')
      + '</select>';
  }

  function progressLineHtml(queue, label){
    if(!queue) return '';
    var p = queue.progress();
    if(p.done>=p.total) return '';
    return '<div style="font-size:12px;font-weight:700;margin-top:6px">'+x(label)+' 생성 중 '+p.done+' / '+p.total+'</div>';
  }

  /* Atlas Redesign Phase 2: label/color map centralized into
     AtlasStateSystem.processingBadge (js/atlas-state-system.js) — this stays
     as a thin wrapper so existing call sites are untouched. */
  function cardStatusBadge(status){
    return window.AtlasStateSystem ? AtlasStateSystem.processingBadge(status) : '';
  }

  function thumbnailCardHtml(card){
    var st = S.get();
    var conceptId = card.conceptId;
    var results = (st.thumbnail.results||[]).filter(function(r){ return r.conceptId===conceptId; });
    var providerId = st.selectedProviderId;
    var inFlight = (st.thumbnail.inFlightByConcept||{})[conceptId];
    var queueItem = st.thumbnailQueue ? st.thumbnailQueue.items()[conceptId] : null;
    var isQueued = !inFlight && queueItem && queueItem.status==='queued';
    var lastError = (st.errors||[]).filter(function(e){ return e.assetType==='thumbnail' && e.conceptId===conceptId; }).slice(-1)[0];
    var displayStatus = inFlight ? 'processing' : (isQueued ? 'queued' : (results.length ? 'completed' : card.generationStatus));
    var galleryHtml = results.map(function(r,idx){
      var selected = st.thumbnail.selectedResultId===r.jobId;
      return '<div style="display:inline-block;margin:4px;text-align:center">'
        + '<img src="'+x(r.image.objectUrl)+'" style="width:130px;height:97px;object-fit:cover;border-radius:6px;border:2px solid '+(selected?'#4f46e5':'var(--a2-border)')+';cursor:pointer" onclick="AtlasImageProductionUI.selectThumbnailResult(\''+x(r.jobId)+'\')"/>'
        + mockBanner(r.image.sourceType)
        + '<div style="font-size:10px;font-weight:800;color:var(--a2-text-faint)">Version '+(idx+1)+(selected?' · 선택됨':'')+'</div>'
        + '</div>';
    }).join('');
    var actionsHtml = '';
    if(inFlight){
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.cancelThumbnail(\''+x(conceptId)+'\')">취소</button>';
    } else if(isQueued){
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.cancelThumbnail(\''+x(conceptId)+'\')">취소</button>';
    } else if(providerId==='manual-import'){
      actionsHtml = '<input type="file" accept="image/png,image/jpeg,image/webp" onchange="AtlasImageProductionUI.onThumbnailFileSelected(\''+x(conceptId)+'\', this)"/>';
    } else if(providerId){
      /* Atlas Redesign Phase 2 (Retry state): a prior failure relabels the
         same action as an explicit retry instead of a generic "다시 생성",
         so recovery reads as recovery. Trigger condition (lastError && !inFlight)
         is the same data already computed above — no new logic, just a label. */
      var isThumbRetry = lastError && !inFlight;
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.generateThumbnail(\''+x(conceptId)+'\')">'+(isThumbRetry?(window.AtlasStateSystem?AtlasStateSystem.retryLabel():'다시 시도'):(results.length?'다시 생성':'이 Concept 생성'))+'</button>'
        + (results.length && !isThumbRetry ? ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.generateThumbnail(\''+x(conceptId)+'\')">배경만 변경</button>' : '');
    }
    actionsHtml += ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.replanThumbnailConcept(\''+x(conceptId)+'\')">이 Concept 다시 기획</button>';
    if(results.length && providerId && providerId!=='manual-import'){
      actionsHtml += ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applyStyleModifierAndRegenerate(\''+x(conceptId)+'\',\'bigger-product\')">상품을 더 크게</button>'
        + ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applyStyleModifierAndRegenerate(\''+x(conceptId)+'\',\'remove-person\')">인물 제거</button>'
        + ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applyStyleModifierAndRegenerate(\''+x(conceptId)+'\',\'more-premium\')">더 고급스럽게</button>'
        + ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applyStyleModifierAndRegenerate(\''+x(conceptId)+'\',\'brighter\')">더 밝게</button>';
    }

    return '<div class="ipe-card" style="border:1px solid var(--a2-border);border-radius:10px;padding:12px;margin-top:10px">'
      + '<div style="font-weight:700;font-size:13px">전략: '+x(card.strategyLabel)+' '+cardStatusBadge(displayStatus)+'</div>'
      + '<div style="font-size:12px;margin-top:6px"><b>판매 각도:</b> '+x(card.salesAngle)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>핵심 장면:</b> '+x(card.visualEvent)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>상품 역할:</b> '+x(card.productRole)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>카메라:</b> '+x(card.camera)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>구도:</b> '+x(card.composition.name)+' — '+x(card.composition.description)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>조명:</b> '+x(card.lighting)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>텍스트 Safe Area:</b> '+x(card.safeArea)+'</div>'
      + '<div style="font-size:12px;margin-top:4px;color:var(--a2-text-faint)"><b>왜 이 전략인가:</b> '+x(card.whyThisCanSell)+'</div>'
      + (card.revisionNumber>1 ? '<div style="font-size:11px;color:var(--a2-text-faint);margin-top:4px">재기획 '+ (card.revisionNumber-1) +'회 · Revision '+card.revisionNumber+'</div>' : '')
      + (lastError && !inFlight ? (window.AtlasStateSystem?AtlasStateSystem.errorMessage(lastError.error&&lastError.error.message||'생성에 실패했습니다.'):'') : '')
      + '<details style="margin-top:6px"><summary style="font-size:11px;color:var(--a2-text-faint);cursor:pointer">고급 정보(Prompt/Scene)</summary>'
      + '<textarea readonly style="width:100%;min-height:120px;font-family:monospace;font-size:10px;margin-top:6px">'+x(card._engineScene?IE.composePrompt(card._engineScene):'')+'</textarea></details>'
      + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+actionsHtml+'</div>'
      + (results.length
          ? '<div style="font-size:11px;color:var(--a2-text-faint);margin-top:4px">결과 '+results.length+'개</div>'
          : ((inFlight||isQueued) ? '' : (window.AtlasStateSystem?AtlasStateSystem.noResults({text:'아직 생성된 결과가 없습니다. 위 버튼으로 첫 결과를 생성해보세요.'}):'')))
      + (galleryHtml?('<div style="margin-top:8px">'+galleryHtml+'</div>'):'')
      + '</div>';
  }

  function salesPageCardHtml(page){
    var st = S.get();
    var pageNumber = page.pageNumber;
    var results = st.salesPage.resultsByPage[pageNumber] || [];
    var providerId = st.selectedProviderId;
    var inFlight = (st.salesPage.inFlightByPage||{})[pageNumber];
    var queueItem = st.salesPageQueue ? st.salesPageQueue.items()[pageNumber] : null;
    var isQueued = !inFlight && queueItem && queueItem.status==='queued';
    var lastError = (st.errors||[]).filter(function(e){ return e.assetType==='sales-page' && e.pageNumber===pageNumber; }).slice(-1)[0];
    var selectedJobId = (st.salesPage._selectedByPage||{})[pageNumber];
    var displayStatus = inFlight ? 'processing' : (isQueued ? 'queued' : (results.length ? 'completed' : page.generationStatus));
    var galleryHtml = results.map(function(r,idx){
      var selected = selectedJobId===r.jobId;
      return '<div style="display:inline-block;margin:4px;text-align:center">'
        + '<img src="'+x(r.image.objectUrl)+'" style="width:96px;height:120px;object-fit:cover;border-radius:6px;border:2px solid '+(selected?'#4f46e5':'var(--a2-border)')+';cursor:pointer" onclick="AtlasImageProductionUI.selectSalesPageResult('+pageNumber+', \''+x(r.jobId)+'\')"/>'
        + mockBanner(r.image.sourceType)
        + '<div style="font-size:10px;font-weight:800;color:var(--a2-text-faint)">Version '+(idx+1)+(selected?' · 선택됨':'')+'</div>'
        + '</div>';
    }).join('');
    var fc = st.salesPage.finalComposites[pageNumber];
    var actionsHtml = '';
    if(inFlight){
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.cancelSalesPage('+pageNumber+')">취소</button>';
    } else if(isQueued){
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.cancelSalesPage('+pageNumber+')">취소</button>';
    } else if(providerId==='manual-import'){
      actionsHtml = '<input type="file" accept="image/png,image/jpeg,image/webp" onchange="AtlasImageProductionUI.onSalesPageFileSelected('+pageNumber+', this)"/>';
    } else if(providerId){
      /* Atlas Redesign Phase 2 (Retry state): same pattern as thumbnailCardHtml. */
      var isSpRetry = lastError && !inFlight;
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.generateSalesPage('+pageNumber+')">'+(isSpRetry?(window.AtlasStateSystem?AtlasStateSystem.retryLabel():'다시 시도'):(results.length?'다시 생성':'이 장 생성'))+'</button>'
        + (results.length && !isSpRetry ? ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.generateSalesPage('+pageNumber+')">배경만 변경</button>' : '');
    }
    actionsHtml += ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.replanSalesPageScene('+pageNumber+')">재기획</button>';
    var copyEditHtml = '';
    if(selectedJobId){
      actionsHtml += ' <button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applySalesPageOverlay('+pageNumber+')">한글 오버레이 적용</button>';
      var approvedCopy = approvedSalesPageCopy(storyboardPageByNumber(pageNumber));
      copyEditHtml = '<details style="margin-top:8px"><summary style="font-size:11px;color:var(--a2-text-faint);cursor:pointer">카피만 변경</summary>'
        + '<div style="margin-top:6px;display:grid;gap:6px;max-width:340px">'
        + '<input class="a2-input" id="ipe-sp-copy-headline-'+pageNumber+'" placeholder="헤드라인" value="'+x(approvedCopy.headline)+'"/>'
        + '<input class="a2-input" id="ipe-sp-copy-subheadline-'+pageNumber+'" placeholder="서브헤드라인" value="'+x(approvedCopy.subheadline)+'"/>'
        + '<input class="a2-input" id="ipe-sp-copy-badge-'+pageNumber+'" placeholder="배지" value="'+x(approvedCopy.badge)+'"/>'
        + '<input class="a2-input" id="ipe-sp-copy-cta-'+pageNumber+'" placeholder="CTA" value="'+x(approvedCopy.cta)+'"/>'
        + '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applySalesPageOverlayWithCopy('+pageNumber+')">카피만 변경 적용(재생성 없음)</button>'
        + '</div></details>';
    }

    return '<div class="ipe-card" style="border:1px solid var(--a2-border);border-radius:10px;padding:12px;margin-top:10px">'
      + '<div style="font-weight:700;font-size:13px">'+pageNumber+'장 · '+x(page.role)+' '+cardStatusBadge(displayStatus)+'</div>'
      + '<div style="font-size:12px;margin-top:6px"><b>판매 목적:</b> '+x(page.salesPurpose)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>실제 장면:</b> '+x(page.visualEvent)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>상품 역할:</b> '+x(page.productRole)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>카메라:</b> '+x(page.camera)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>구도:</b> '+x(page.composition.name)+' — '+x(page.composition.description)+'</div>'
      + '<div style="font-size:12px;margin-top:4px"><b>정보 밀도:</b> '+x(page.informationDensity)+'</div>'
      + '<div style="font-size:12px;margin-top:4px;color:var(--a2-text-faint)"><b>왜 이 장이 필요한가:</b> '+x(page.whyThisPageExists)+'</div>'
      + (lastError && !inFlight ? (window.AtlasStateSystem?AtlasStateSystem.errorMessage(lastError.error&&lastError.error.message||'생성에 실패했습니다.'):'') : '')
      + '<details style="margin-top:6px"><summary style="font-size:11px;color:var(--a2-text-faint);cursor:pointer">고급 정보(Prompt/Scene)</summary>'
      + '<textarea readonly style="width:100%;min-height:110px;font-family:monospace;font-size:10px;margin-top:6px">'+x(page._engineScene?IE.composePrompt(page._engineScene):'')+'</textarea></details>'
      + '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+actionsHtml+'</div>'
      + copyEditHtml
      + (results.length
          ? '<div style="font-size:11px;color:var(--a2-text-faint);margin-top:4px">결과 '+results.length+'개</div>'
          : ((inFlight||isQueued) ? '' : (window.AtlasStateSystem?AtlasStateSystem.noResults({text:'아직 생성된 결과가 없습니다. 위 버튼으로 첫 결과를 생성해보세요.'}):'')))
      + (galleryHtml?('<div style="margin-top:8px">'+galleryHtml+'</div>'):'')
      + (fc ? ('<div style="margin-top:8px"><img src="'+x(fc.dataUrl)+'" style="width:120px;border-radius:6px;border:1px solid var(--a2-border)"/>'
          + '<div style="margin-top:4px"><button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.downloadSalesPage('+pageNumber+',\'png\')">PNG 다운로드</button> '
          + '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.downloadSalesPage('+pageNumber+',\'jpg\')">JPG 다운로드</button></div></div>') : '')
      + '</div>';
  }

  UI.render = function(){
    var st = S.get(); if(!st) return;
    var thumbWrap = document.getElementById('ipe-thumb-list');
    var spWrap = document.getElementById('ipe-sp-list');
    if(!thumbWrap || !spWrap) return;

    var statusBanner = document.getElementById('ipe-provider-status-banner');
    if(statusBanner) statusBanner.innerHTML = providerStatusBannerHtml() + limitExceededBannerHtml();

    var thumbPlanned = st.creativeDirector.thumbnailPlanStatus==='planned';
    var spPlanned = st.creativeDirector.salesPagePlanStatus==='planned';
    var effectiveProviderId = UI.effectivePrimaryProviderId();

    var thumbGenerateBtn = document.getElementById('ipe-thumb-generate-btn');
    if(thumbGenerateBtn) thumbGenerateBtn.disabled = !effectiveProviderId || !thumbPlanned;
    var spGenerateBtn = document.getElementById('ipe-sp-generate-btn');
    if(spGenerateBtn) spGenerateBtn.disabled = !effectiveProviderId || !spPlanned;
    /* Atlas Redesign Phase 2 (Disabled state): same condition already used
       above to disable the buttons — only the visible reason is new. */
    var thumbReason = document.getElementById('ipe-thumb-generate-reason');
    if(thumbReason) thumbReason.innerHTML = (!window.AtlasStateSystem) ? '' :
      (!effectiveProviderId ? AtlasStateSystem.disabledReason('이미지 생성 방식이 설정되지 않았습니다. 위 안내를 확인해주세요.')
        : (!thumbPlanned ? AtlasStateSystem.disabledReason('먼저 [썸네일 크리에이티브 5개 기획]을 눌러주세요.', 'info') : ''));
    var spReason = document.getElementById('ipe-sp-generate-reason');
    if(spReason) spReason.innerHTML = (!window.AtlasStateSystem) ? '' :
      (!effectiveProviderId ? AtlasStateSystem.disabledReason('이미지 생성 방식이 설정되지 않았습니다. 위 안내를 확인해주세요.')
        : (!spPlanned ? AtlasStateSystem.disabledReason('먼저 [상세페이지 9장 기획]을 눌러주세요.', 'info') : ''));

    var thumbProgress = document.getElementById('ipe-thumb-progress');
    if(thumbProgress) thumbProgress.innerHTML = progressLineHtml(st.thumbnailQueue, '썸네일');
    var spProgress = document.getElementById('ipe-sp-progress');
    if(spProgress) spProgress.innerHTML = progressLineHtml(st.salesPageQueue, '상세페이지');

    var providerSel = document.getElementById('ipe-provider-select-wrap');
    if(providerSel) providerSel.innerHTML = providerSelectorHtml();

    var advancedInfo = document.getElementById('ipe-advanced-info');
    if(advancedInfo){
      var openai = window.AtlasOpenAIImageProvider;
      var cache = openai && openai.getStatusCache ? openai.getStatusCache() : {};
      advancedInfo.innerHTML = '<div style="font-size:11px;color:var(--a2-text-faint)">'
        + 'Provider 상태: '+(cache.configured?'준비됨':'미설정')+' · 모델: '+x(cache.model||'-')+' · 품질: '+x(cache.quality||'-')+'<br>'
        + '예상 생성 장수: 썸네일 '+(st.creativeDirector.thumbnailConcepts||[]).length+'장 · 상세페이지 '+(st.creativeDirector.salesPageScenes||[]).length+'장<br>'
        + '사용량: 오늘 '+x(cache.dailyUsed)+'/'+x(cache.dailyLimit)+' · 이번 달 '+x(cache.monthlyUsed)+'/'+x(cache.monthlyLimit)
        + '</div>';
    }

    thumbWrap.innerHTML = thumbPlanned
      ? st.creativeDirector.thumbnailConcepts.map(thumbnailCardHtml).join('')
      : '<div style="font-size:12px;color:var(--a2-text-faint)">아직 기획되지 않았습니다. [썸네일 크리에이티브 5개 기획]을 눌러주세요.</div>';

    var thumbSelected = st.thumbnail.selectedResultId;
    var thumbOverlayBtn = document.getElementById('ipe-thumb-overlay-actions');
    if(thumbOverlayBtn){
      if(thumbSelected){
        var tCopy = approvedThumbnailCopy();
        thumbOverlayBtn.innerHTML = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applyThumbnailOverlay()">한글 오버레이 적용</button>'
          + '<details style="margin-top:8px"><summary style="font-size:11px;color:var(--a2-text-faint);cursor:pointer">카피만 변경</summary>'
          + '<div style="margin-top:6px;display:grid;gap:6px;max-width:340px">'
          + '<input class="a2-input" id="ipe-thumb-copy-headline" placeholder="헤드라인" value="'+x(tCopy.headline)+'"/>'
          + '<input class="a2-input" id="ipe-thumb-copy-subheadline" placeholder="서브헤드라인" value="'+x(tCopy.subheadline)+'"/>'
          + '<input class="a2-input" id="ipe-thumb-copy-badge" placeholder="배지" value="'+x(tCopy.badge)+'"/>'
          + '<input class="a2-input" id="ipe-thumb-copy-cta" placeholder="CTA" value="'+x(tCopy.cta)+'"/>'
          + '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.applyThumbnailOverlayWithCopy()">카피만 변경 적용(재생성 없음)</button>'
          + '</div></details>'
          + (st.thumbnail.finalComposite ? (
              '<div style="margin-top:8px"><img src="'+x(st.thumbnail.finalComposite.dataUrl)+'" style="width:200px;border-radius:8px;border:1px solid var(--a2-border)"/></div>'
              + '<div style="margin-top:6px"><button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.downloadThumbnail(\'png\')">PNG 다운로드</button> '
              + '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.downloadThumbnail(\'jpg\')">JPG 다운로드</button></div>'
            ) : '');
      } else {
        thumbOverlayBtn.innerHTML = '<div style="font-size:11px;color:var(--a2-text-faint)">먼저 위에서 후보 이미지를 선택하세요.</div>';
      }
    }

    spWrap.innerHTML = spPlanned
      ? st.creativeDirector.salesPageScenes.map(salesPageCardHtml).join('')
      : '<div style="font-size:12px;color:var(--a2-text-faint)">아직 기획되지 않았습니다. [상세페이지 9장 기획]을 눌러주세요.</div>';

    var zipBtn = document.getElementById('ipe-sp-zip-btn');
    var noComposites = Object.keys(st.salesPage.finalComposites||{}).length===0;
    if(zipBtn) zipBtn.disabled = noComposites;
    /* Atlas Redesign Phase 2 (Disabled state): same noComposites condition. */
    var zipReason = document.getElementById('ipe-sp-zip-reason');
    if(zipReason) zipReason.innerHTML = (noComposites && window.AtlasStateSystem)
      ? AtlasStateSystem.disabledReason('아직 한글 오버레이가 적용된 상세페이지가 없습니다. 각 카드에서 [한글 오버레이 적용]을 먼저 눌러주세요.', 'info') : '';
  };

})(window.AtlasImageProductionUI);
