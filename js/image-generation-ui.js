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
  var TTE = window.AtlasThumbnailThemeEngine;
  var CE = window.AtlasThumbnailCompositionEngine;

  function x(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  var THUMB_SAFE_AREA_RECT = { x:0, y:0.62, w:1, h:0.38 };
  var SALES_PAGE_SAFE_AREA_RECT = { x:0, y:0.80, w:1, h:0.20 };
  var PRIMARY_PROVIDER_ID = 'openai-gpt-image';
  var MAX_AUTO_REPLAN_ATTEMPTS = 3;

  /* V3 Phase 2 Round 30: "썸네일의 글씨체도 수정되도록 해" — index.html에 실제로
     로드되어 있는 폰트만 고른다(새 CDN 의존성을 추가하지 않는다, Never Guess).
     Round 31(2026-08-07): "글씨체가 좀더 있었으면 좋겠어" 요청으로 목록을
     늘렸다 — 전부 실제 존재하는 Google Fonts 한글 폰트를 index.html에 함께
     추가해 뒀다(index.html의 Google Fonts <link> 주석 참고). 이 샌드박스는
     fonts.googleapis.com 자체가 차단돼 있어 실제 로딩은 검증하지 못했다 —
     사용자 실제 브라우저에서 확인이 필요하다는 점을 숨기지 않는다. */
  var THUMB_FONT_OPTIONS = [
    { key:'pretendard', label:'Pretendard (기본, 고딕)', css:"'Pretendard', -apple-system, sans-serif" },
    { key:'notoSerif', label:'Noto Serif KR (명조)', css:"'Noto Serif KR', serif" },
    { key:'blackHan', label:'검은고딕 (Black Han Sans, 임팩트)', css:"'Black Han Sans', sans-serif" },
    { key:'doHyeon', label:'도현 (Do Hyeon, 굵은 라운드)', css:"'Do Hyeon', sans-serif" },
    { key:'jua', label:'주아 (Jua, 통통한 고딕)', css:"'Jua', sans-serif" },
    { key:'gowunDodum', label:'고운돋움 (모던 산세리프)', css:"'Gowun Dodum', sans-serif" },
    { key:'stylish', label:'스타일리쉬 (Stylish)', css:"'Stylish', sans-serif" },
    { key:'songMyung', label:'송명 (Song Myung, 붓글씨체 세리프)', css:"'Song Myung', serif" },
    { key:'brush', label:'붓글씨 (Nanum Brush Script)', css:"'Nanum Brush Script', cursive" },
    { key:'poor', label:'Poor Story (손글씨)', css:"'Poor Story', cursive" },
    { key:'melody', label:'Hi Melody (손글씨)', css:"'Hi Melody', cursive" },
    { key:'single', label:'Single Day (손글씨)', css:"'Single Day', cursive" },
    { key:'gaegu', label:'개구쟁이 (Gaegu, 캐주얼 손글씨)', css:"'Gaegu', cursive" },
    { key:'dokdo', label:'동해 독도 (East Sea Dokdo, 손글씨)', css:"'East Sea Dokdo', cursive" },
    { key:'sunflower', label:'해바라기 (Sunflower)', css:"'Sunflower', sans-serif" }
  ];
  function thumbFontCss(key){
    var found = THUMB_FONT_OPTIONS.filter(function(f){ return f.key===key; })[0];
    return found ? found.css : null;
  }

  /* V3 Phase 2 Round 34(2026-08-08): 사용자 실측 버그 — 글씨체를 바꿔도 렌더링
     결과가 그대로였다. 원인: Google Fonts는 <link>로 CSS만 미리 받아둘 뿐,
     실제 폰트 파일(woff2)은 그 폰트가 "실제로 화면에 쓰일 때"에만 지연 로드된다
     (브라우저 표준 동작). 이 폰트들은 어디에도 실제 DOM 텍스트로 쓰인 적이 없고
     오직 <canvas> 안의 ctx.font로만 쓰이는데, ctx.fillText()는 폰트 파일이 아직
     안 받아졌으면 로드를 기다려주지 않고 그 순간 즉시 폴백 폰트로 그려버린다
     (Canvas + @font-face의 잘 알려진 표준 함정 — document.fonts.load()로 명시적
     으로 기다려야 한다). 이미 로드된 폰트(Pretendard 등)를 다시 불러도 즉시
     resolve되므로 항상 호출해도 안전하다. */
  function ensureFontLoaded(cssFamily){
    if(!cssFamily || typeof document==='undefined' || !document.fonts || !document.fonts.load) return Promise.resolve();
    var weightedSizes = ['16px', 'bold 16px', '600 16px', '800 16px'];
    return Promise.all(weightedSizes.map(function(spec){
      try{ return document.fonts.load(spec+' '+cssFamily).catch(function(){}); }
      catch(e){ return Promise.resolve(); }
    })).catch(function(){ /* 폰트 로드가 실패해도 기존 폴백 폰트로 계속 진행한다 */ });
  }

  /* 현재 승인된 카테고리/브랜드전략/Creative Campaign을 한 곳에서 읽는다 — plan/
     replan/generate가 전부 이 값을 공유한다. */
  /* 실제 발견된 버그: AIP.state.creativeCampaign은 AIP.approve() 호출 시점에만
     메모리에 채워지고, atlasLoadDraft()는 이 값을 AIP.state로 복원하지 않는다
     (오직 APP.creativeCampaign에만 복원함 — atlasCollectDraft/atlasLoadDraft,
     js/application.js). 그래서 전자책까지 다 만든 뒤 페이지를 새로고침하거나
     저장된 프로젝트를 불러와서 STEP4(썸네일)로 오면, AIP.state.creativeCampaign이
     비어 있어 이 함수가 조용히 null을 반환하고 — planThumbnailConcepts()/
     generateThumbnails()가 아무 안내도 없이 그냥 아무 일도 하지 않았다("썸네일
     생성 버튼을 눌러도 아무 액션이 없다"는 실제 사용자 버그 리포트의 원인).
     AIP.state.creativeCampaign이 없으면 이미 저장되어 있는 APP.creativeCampaign
     으로 대체한다 — AIP.approve()가 승인 시점에 이미 APP.creativeCampaign에도
     같은 값을 저장해 두므로(js/ai-planner.js) 새 계산이 아니라 이미 있는 값을
     읽기만 하는 것이다. */
  function campaignContext(){
    var AIP = window.AtlasAIPlanner;
    var cc = (AIP && AIP.state && AIP.state.creativeCampaign) || APP.creativeCampaign;
    if(!cc) return null;
    var visualPromptSet = AIP && AIP.state && AIP.state.visualPromptSet;
    var category = (visualPromptSet && visualPromptSet.visualStrategy && visualPromptSet.visualStrategy.category) || 'neutral';
    var selectedBrandPackId = AIP && AIP.state && AIP.state.selectedBrandPackId;
    var brandStrategy = APP.brandProfile ? APP.brandProfile.brandStrategy : (selectedBrandPackId ? AIP.brandProfileDefaults[selectedBrandPackId].brandStrategy : null);
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

  /* V3 Phase 2 Round 8: Commercial Concept Engine이 "이 책을 클릭하게 만드는
     시각적 아이디어"를 판단할 때 쓰는 추가 실제 신호(마케팅 문구 전체 + 실제
     챕터의 framework/timeline/comparisonTable) — 승인된 값을 그대로 읽기만
     한다(재계산 없음, Ebook Engine 자체는 건드리지 않음).
     V3 Phase 2 Round 9: topic/targetAudience 원문도 함께 넘긴다 — Product
     Marketing Engine이 "이 책에 실제로 입력된 문구인지, 카테고리 기본값인지"를
     구분하는 데 필요하다(productTruth/audienceInsight는 이미 카테고리 기본값으로
     대체된 뒤라 그 구분이 사라져 있다). */
  function commercialConceptSignals(){
    var analysis = APP.titleAnalysis || APP.smartAnalysis || {};
    return {
      marketingCopy: APP.marketingCopy || {}, chapters: (APP.ebook && APP.ebook.chapters) || [],
      topic: analysis.topic || '', targetAudience: analysis.target || ''
    };
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
    var concepts = CDA.buildThumbnailConcepts(ctx.creativeCampaign, ctx.category, ctx.brandStrategy, insight.productTruth, insight.audienceInsight, commercialConceptSignals());

    var attempts = 0;
    var validation = CDA.validateThumbnailConceptSet(concepts);
    while(!validation.ok && attempts < MAX_AUTO_REPLAN_ATTEMPTS){
      /* 조건을 못 채운 원인이 되는 첫 Concept부터 순서대로 재기획을 시도한다. */
      concepts.forEach(function(c){ CDA.replanThumbnailConcept(c, ctx.creativeCampaign, ctx.category, ctx.brandStrategy, insight.productTruth, insight.audienceInsight); });
      validation = CDA.validateThumbnailConceptSet(concepts);
      attempts++;
    }

    /* V3 Phase 2 Round 2: 5개 Concept 전부에 현재 선택된 Thumbnail Theme을
       적용한다 — CDA.buildThumbnailConcepts/replanThumbnailConcept는 테마를
       전혀 모른 채(순수 Concept 다양성만 책임짐) card._baseEngineScene을
       만들고, 실제 이미지 생성에 쓰이는 card._engineScene은 항상 이 원본에서
       테마 규칙을 적용해 다시 계산한다(applyConceptsThumbnailTheme, 아래). */
    st.creativeDirector.thumbnailConcepts = concepts;
    UI.applyThumbnailThemeToConcepts();
    st.creativeDirector.thumbnailPlanStatus = 'planned';
    st.creativeDirector.lastPlannedAt = Date.now();
    UI.render();
  };

  /* ── V3 Phase 2 Round 2: Selectable Thumbnail Theme System ──
     Theme은 Concept(문제 중심/상품 중심/...)과 다른 축이다 — Concept이 "어떤
     각도로 보여줄까"라면 Theme은 "그 각도를 어떤 상업적 스타일로 조판할까"다.
     구버전 저장본에는 APP.thumbnailThemeId가 없을 수 있으므로 TTE.getTheme이
     항상 안전한 기본 테마로 떨어진다(js/thumbnail-theme-engine.js). */
  UI.getSelectedThumbnailThemeId = function(){
    if(typeof APP!=='undefined' && APP.thumbnailThemeId) return APP.thumbnailThemeId;
    return TTE ? TTE.DEFAULT_THEME_ID : null;
  };

  /* 이미 기획된 모든 Concept의 card._engineScene을 "현재 선택된 테마"로 다시
     계산한다 — 항상 손대지 않은 card._baseEngineScene에서 새로 계산하므로
     테마를 여러 번 바꿔도 이전 테마 문구가 누적되지 않는다. */
  UI.applyThumbnailThemeToConcepts = function(){
    var st = S.get(); if(!st || !TTE) return;
    var themeId = UI.getSelectedThumbnailThemeId();
    (st.creativeDirector.thumbnailConcepts||[]).forEach(function(card){
      if(card._baseEngineScene) card._engineScene = TTE.applyThemeToScene(card._baseEngineScene, themeId);
    });
  };

  UI.selectThumbnailTheme = function(themeId){
    if(typeof APP==='undefined' || !TTE || !TTE.getTheme(themeId)) return;
    APP.thumbnailThemeId = TTE.getTheme(themeId).id;
    UI.applyThumbnailThemeToConcepts();
    if(typeof atlasSaveDraft==='function') atlasSaveDraft(false);
    UI.render();
  };

  /* Atlas Product Workflow Redesign (Round 12): Stage4에서 선택한 썸네일
     테마(APP.thumbnailThemeId)를 그대로 넘겨 상세페이지가 같은 시각 캠페인을
     쓰게 한다(js/thumbnail-theme-engine.js TTE.applyThemeToSalesPageScene). */
  UI.planSalesPageScenes = function(){
    var st = S.get(); if(!st) return;
    var ctx = campaignContext();
    if(!ctx){
      showToast('error','전자책 기획 정보를 찾을 수 없습니다. [전자책으로] 돌아가 [썸네일 만들기]를 다시 눌러 스타일을 선택한 뒤 이어서 시도해주세요.',6000);
      return;
    }
    var themeId = UI.getSelectedThumbnailThemeId();
    var scenes = CDA.buildSalesPageDirectorScenes(ctx.creativeCampaign, ctx.category, ctx.brandStrategy, themeId);

    var attempts = 0;
    var validation = CDA.validateSalesPageSceneSet(scenes);
    while(!validation.ok && attempts < MAX_AUTO_REPLAN_ATTEMPTS){
      scenes.forEach(function(s){ CDA.replanSalesPageScene(s, ctx.creativeCampaign, ctx.category, ctx.brandStrategy, themeId); });
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
    CDA.replanSalesPageScene(page, ctx.creativeCampaign, ctx.category, ctx.brandStrategy, UI.getSelectedThumbnailThemeId());
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
  /* V3 Phase 2 Round 30: 기본 5개 후보(generateThumbnailsFromThemeExamples)는
     이제 STEP2 예시 파일을 그대로 쓰지만, 이 함수(개별 카드 "다시 생성")는
     예시를 벗어난 새로운 대안이 필요할 때를 위해 실제 GPT Image 호출 경로를
     그대로 유지한다(엔진 자체는 전혀 바뀌지 않음) — 다만 결과가 도착하면
     다른 모든 후보와 똑같이 즉시 자동으로 실제 제목/카피를 입힌다(일관성:
     화면에 보이는 모든 후보는 항상 완성본이어야 한다). */
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
      if(resp.status==='completed'){
        var result = Object.assign({ conceptId:conceptId }, resp);
        pushResult(st.thumbnail.results, result);
        card.resultIds.push(resp.jobId);
        composeAndStoreThumbnailResult(result, null, function(){ UI.render(); });
      }
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

  /* V3 Phase 2 Round 11: 사용자가 실제 화면(1단계 캠페인 컨셉 선택 + 2단계
     후보 5개 생성 카드마다 카메라/톤/재기획 버튼)을 보고 "썸네일 기획 단계를
     없애고 테마 선택 → 예시 몇 개만 보여달라"고 명시적으로 요청했다(Golden
     Reference 두 번째 이미지처럼). Commercial Concept Engine(Round 8)/Product
     Marketing Engine(Round 9)은 그대로 내부에서만 계속 동작한다 — 그 결과가
     실제로 더 나은 이미지를 만든다는 사실 자체는 검증됐고, 사용자가 원한 것은
     "그 판단 과정을 화면에 노출하지 말라"는 것이지 "그 판단을 하지 말라"는
     것이 아니다(명시적으로 확인됨). 기획(planThumbnailConcepts)과 생성
     (generateThumbnails)을 사용자에게는 하나의 버튼으로 합친다. */
  UI.generateThumbnailsSimple = function(){
    var st = S.get(); if(!st) return;
    if(st.creativeDirector.thumbnailPlanStatus!=='planned') UI.planThumbnailConcepts();
    /* 실제 발견된 버그: campaignContext()가 null이면 planThumbnailConcepts()가
       조용히 아무 것도 하지 않고 리턴해 버튼을 눌러도 아무 반응이 없었다(위
       campaignContext() 주석 참고) — 이제는 항상 눈에 보이는 안내를 준다. */
    if(st.creativeDirector.thumbnailPlanStatus!=='planned'){
      showToast('error','전자책 기획 정보를 찾을 수 없습니다. [전자책으로] 돌아가 [썸네일 만들기]를 다시 눌러 스타일을 선택한 뒤 이어서 시도해주세요.',6000);
      return;
    }
    UI.generateAllThumbnailsWithAi();
  };

  /* V3 Phase 2 Round 35(2026-08-08): 사용자가 실측으로 확인한 문제 — Round 30
     방식(아래 generateThumbnailsFromThemeExamples)이 STEP2 스타일 예시 이미지를
     배경으로 그대로 재사용하다 보니, 부업 주제 전자책인데 배경은 "프리미어 프로
     영상편집" 같은 무관한 예시 그림 위에 실제 제목/카피만 얹힌 것처럼 보였다
     ("실제 이미지상 내에서 제목이랑 관련 내용들로 바뀌어야 한다"는 명시적
     요청). 사용자에게 트레이드오프(스타일 미리보기와 실제 결과가 달라질 수
     있음, 후보마다 실제 GPT Image 비용 발생)를 설명한 뒤, "5개 전부 AI로 자동
     생성"을 명시적으로 선택받아 기본 경로를 다시 실제 AI 생성으로 되돌린다.
     Round 30의 정적 예시 재사용 함수(generateThumbnailsFromThemeExamples,
     아래)는 삭제하지 않고 그대로 남겨둔다 — 더 이상 기본 경로에서 호출되지
     않을 뿐, 필요하면 그대로 복원할 수 있다. */
  UI.generateAllThumbnailsWithAi = function(){
    var st = S.get(); if(!st) return;
    var providerId = UI.effectivePrimaryProviderId();
    if(!providerId){
      showToast('error','이미지 생성 방식이 설정되지 않았습니다. 위 안내를 확인해주세요.');
      return;
    }
    (st.creativeDirector.thumbnailConcepts||[]).forEach(function(card){
      UI.generateThumbnail(card.conceptId, providerId);
    });
  };

  /* V3 Phase 2 Round 30(2026-08-07, 더 이상 기본 경로 아님 — 위 Round 35 설명
     참고): 당시엔 STEP2에서 보여준 테마 예시 이미지와 STEP4에서 실제로 생성되는
     배경이 매번 달라 "미리보기와 결과가 다르다"는 문제가 있었고, 그 해결로
     기본 5개 후보가 AI 재호출 없이 STEP2에서 보여준 그 5개 예시 파일(TTE.
     themeExampleFiles, assets/thumbnail-themes/)을 배경으로 그대로 쓰도록
     만들었다. 지금은 이 함수가 기본 경로에서 호출되지 않지만, 구현 자체는
     보존한다(Never Delete). 없는 예시 파일(사용자가 아직 채우지 않은 -2~-5.png)
     은 조용히 건너뛴다(가짜로 채우지 않는다, Never Guess). */
  UI.generateThumbnailsFromThemeExamples = function(){
    var st = S.get(); if(!st) return;
    var themeId = UI.getSelectedThumbnailThemeId();
    var files = TTE ? TTE.themeExampleFiles(themeId) : [];
    var cards = st.creativeDirector.thumbnailConcepts || [];
    st.thumbnail.selectedResultId = null;
    st.thumbnail.finalComposite = null;
    /* 5개 파일이 동시에(병렬로) 로드되므로 "가장 먼저 끝난 것"이 기본 선택이
       되면 매번 달라질 수 있다 — 항상 첫 번째 카드(대표 예시, -2/-3 접미사가
       없는 파일)가 기본 선택이 되도록 로드가 끝나기 전에 미리 확정해 둔다. */
    var firstJobId = (files[0] && cards[0]) ? ('theme-example-0-'+Date.now()) : null;
    if(firstJobId) st.thumbnail.selectedResultId = firstJobId;
    var pending = 0, anyLoaded = false;
    cards.forEach(function(card, idx){
      var file = files[idx]; if(!file) return;
      pending++;
      var jobId = (idx===0 && firstJobId) ? firstJobId : 'theme-example-'+idx+'-'+Date.now();
      var result = { jobId: jobId, conceptId: card.conceptId, image: { objectUrl: 'assets/thumbnail-themes/'+file, sourceType: 'theme-example' } };
      composeAndStoreThumbnailResult(result, null, function(composite){
        pending--;
        if(composite){
          anyLoaded = true;
          pushResult(st.thumbnail.results, result);
          card.resultIds.push(jobId);
          card.generationStatus = 'completed';
        }
        if(pending===0){
          if(!anyLoaded){
            showToast('error','선택한 스타일의 예시 이미지 파일을 찾을 수 없습니다. assets/thumbnail-themes/ 폴더에 이미지가 있는지 확인해주세요.',6000);
          }else{
            /* firstJobId로 미리 확정해 둔 기본 선택이 실제로는 로드 실패한
               파일이었을 수 있다(예: 대표 파일은 없는데 -2.png만 있는 경우) —
               최종적으로 selectedResultId가 실제 존재하는 결과를 가리키지
               않으면 성공한 결과 중 첫 번째로 대체한다. */
            var stillValid = (st.thumbnail.results||[]).some(function(r){ return r.jobId===st.thumbnail.selectedResultId; });
            if(!stillValid){
              var first = (st.thumbnail.results||[])[0];
              if(first) UI.selectThumbnailResult(first.jobId);
            }
          }
        }
        UI.render();
      });
    });
    UI.render();
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
  /* V3 Phase 2 Round 30: 후보마다 이미 자체 compositeDataUrl(실제 제목이 입혀진
     완성본)을 갖고 있으므로, 후보를 바꿔 고르면 재계산 없이 그 값을 그대로
     finalComposite로 옮기기만 하면 된다(다운로드/리스팅 화면이 계속 finalComposite
     하나만 보는 기존 계약 유지). 아직 합성이 끝나지 않은 후보(드묾, 예: 실제
     GPT Image로 막 재생성한 직후)를 고르면 finalComposite는 그 합성이 끝나는
     즉시(composeAndStoreThumbnailResult) 자동으로 채워진다. */
  UI.selectThumbnailResult = function(jobId){
    var st = S.get(); st.thumbnail.selectedResultId = jobId;
    var result = (st.thumbnail.results||[]).filter(function(r){ return r.jobId===jobId; })[0];
    if(result && result.compositeDataUrl){
      st.thumbnail.finalComposite = { dataUrl: result.compositeDataUrl, width: result.compositeWidth, height: result.compositeHeight, sourceJobId: result.jobId, sourceType: result.image.sourceType };
    }
    UI.render();
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

  /* V3 Phase 2 Round 30: 사용자가 실측으로 확인한 문제 — 썸네일 후보 5장이
     텍스트 없는 배경 그림으로만 보였고, 별도로 "한글 오버레이 적용"을 눌러야만
     실제 제목/카피가 들어갔다("썸네일에 아무런 글도 없다"는 실제 버그 리포트).
     이제는 후보가 만들어지는 즉시(선택을 기다리지 않고) 이 함수가 자동으로
     실제 제목/카피를 입혀 result.compositeDataUrl에 저장한다 — 사용자가 보는
     5장은 처음부터 완성품이다. 결과 객체(result)를 직접 변형(mutate)한다 —
     이미 st.thumbnail.results 배열에 들어있는 그 객체 참조와 동일해야 화면이
     다시 그려질 때 바로 반영된다. */
  function composeAndStoreThumbnailResult(result, customCopy, cb){
    var st = S.get();
    var ctx = campaignContext();
    var themeId = UI.getSelectedThumbnailThemeId();
    var themeOverlayOpts = TTE ? TTE.getOverlayOptions(themeId) : {};
    var layoutFamily = CE ? CE.pickLayoutFamily(themeId, result.jobId) : null;
    var fontFamily = thumbFontCss(st.thumbnail.overlayFontFamily);
    /* Round 34: 실제로 그리기 전에 선택된 글씨체 파일이 로드됐는지 먼저 확인한다
       (위 ensureFontLoaded 설명 참고) — 이게 없으면 글씨체를 바꿔도 항상 폴백
       폰트로만 그려졌다. */
    ensureFontLoaded(fontFamily).then(function(){
      loadImageFromUrl(result.image.objectUrl, function(img){
        if(!img){ if(cb) cb(null); return; }
        var composite = OE.composeThumbnailOverlayIntelligent(img, customCopy||approvedThumbnailCopy(), THUMB_SAFE_AREA_RECT, Object.assign({ brandStrategy: ctx && ctx.brandStrategy, layoutFamily: layoutFamily, fontFamily: fontFamily }, themeOverlayOpts));
        result.compositeDataUrl = composite.dataUrl;
        result.compositeWidth = composite.width;
        result.compositeHeight = composite.height;
        /* 이 result가 현재 선택된 후보라면(또는 아직 아무것도 선택되지 않았다면
           이 result를 첫 선택으로 삼는다) finalComposite도 함께 갱신한다 —
           STEP5/리스팅 다운로드가 계속 finalComposite 하나만 읽어도 되도록
           기존 계약(js/application.js 리스팅 화면, downloadThumbnail)을 그대로
           지킨다. */
        if(!st.thumbnail.selectedResultId) st.thumbnail.selectedResultId = result.jobId;
        if(st.thumbnail.selectedResultId===result.jobId){
          st.thumbnail.finalComposite = { dataUrl: composite.dataUrl, width: composite.width, height: composite.height, sourceJobId: result.jobId, sourceType: result.image.sourceType, themeId: themeOverlayOpts.themeId, layoutFamilyId: layoutFamily && layoutFamily.id };
        }
        if(cb) cb(composite);
      });
    });
  }

  /* Phase 17.1: "카피만 변경" — customCopy가 있으면(사용자가 STEP4에서 직접 수정한
     문구) 그 값으로, 없으면 기존처럼 승인된 Marketing Copy로 오버레이한다. 이미지
     재생성 없이 같은 배경에 새 문구만 다시 입힌다 — Overlay Engine은 그대로 재사용. */
  /* V3 Phase 2 — Thumbnail Intelligence Engine: uses composeThumbnailOverlayIntelligent
     (js/atlas-overlay-engine.js) instead of the plain composeThumbnailOverlay —
     real dominant-color/adaptive-safe-area image analysis, orphan-safe headline
     wrapping, and Brand-Pack-aware badge/CTA geometry. applySalesPageOverlay
     below is untouched and keeps calling composeSalesPageOverlay exactly as
     before — Sales Page Engine is not part of this change. */
  /* V3 Phase 2 Round 30: composeAndStoreThumbnailResult로 통합 — 로직 중복 없이
     같은 결과 객체를 그대로 다시 합성하고(선택된 후보 자체의 compositeDataUrl도
     함께 갱신), finalComposite는 그 헬퍼가 "현재 선택된 결과면" 자동으로 맞춰
     준다. 폰트/테마 옵션도 항상 헬퍼 하나에서만 계산되므로 여기서 다시 어긋날
     일이 없다. */
  UI.applyThumbnailOverlay = function(customCopy){
    var st = S.get();
    var result = (st.thumbnail.results||[]).filter(function(r){ return r.jobId===st.thumbnail.selectedResultId; })[0];
    if(!result) return;
    composeAndStoreThumbnailResult(result, customCopy, function(){ UI.render(); });
  };

  UI.applyThumbnailOverlayWithCopy = function(){
    function v(id){ var el=document.getElementById(id); return el?el.value:''; }
    UI.applyThumbnailOverlay({ headline:v('ipe-thumb-copy-headline'), subheadline:v('ipe-thumb-copy-subheadline'), badge:v('ipe-thumb-copy-badge'), cta:v('ipe-thumb-copy-cta') });
  };

  /* V3 Phase 2 Round 30: 사용자 요구 — "썸네일의 글씨체도 수정되도록 해".
     이미 index.html에 로드되어 있는 폰트(THUMB_FONT_OPTIONS)만 선택할 수 있고,
     고르면 재생성 없이 현재 선택된 후보에 즉시 다시 입힌다(카피만 변경과 같은
     "재계산 없이 다시 그리기" 패턴). */
  UI.setThumbnailOverlayFont = function(fontKey){
    var st = S.get(); if(!st) return;
    st.thumbnail.overlayFontFamily = fontKey || null;
    UI.applyThumbnailOverlay();
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
    /* 사용자 요청으로 일일/월간 생성 한도를 제거했다(server/image-usage-store.js
       checkLimit) — dailyLimit/monthlyLimit이 항상 null이므로 더 이상 가짜
       "X/한도" 형태로 표시하지 않고 실제 사용량만 보여준다. */
    if(cache.configured) return '<div style="font-size:11px;font-weight:700;color:#166534;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:6px 10px">GPT Image 사용 가능 — 오늘 '+x(cache.dailyUsed)+'장 · 이번 달 '+x(cache.monthlyUsed)+'장 생성함</div>';
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

  /* V3 Phase 2 Round 11: 사용자가 실제 화면을 보고 "판매 각도/카메라/구도/조명/
     텍스트 Safe Area/왜 이 전략인가/Prompt" 같은 기획 메타데이터와 "이 Concept
     다시 기획/상품을 더 크게/인물 제거/더 고급스럽게/더 밝게" 같은 개별 조작
     버튼을 화면에서 완전히 없애 달라고 명시적으로 요청했다 — Concept 자체는
     여전히 내부에서(planThumbnailConcepts) 그대로 계산되지만, 카드에는 결과
     이미지와 최소한의 재생성 동작만 남긴다(Golden Reference처럼 "테마 하나 →
     예시 몇 개"로 보이게). 상태/큐/선택/재시도 로직은 전혀 바꾸지 않는다. */
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
    var galleryHtml = results.map(function(r){
      var selected = st.thumbnail.selectedResultId===r.jobId;
      /* V3 Phase 2 Round 30: 이제 배경마다 실제 제목/카피가 자동으로 입혀진
         compositeDataUrl을 즉시 갖고 있으므로, 있으면 그것을(완성본) 보여주고
         아직 합성이 끝나지 않은 드문 순간에만 배경 원본을 임시로 보여준다. */
      var srcUrl = r.compositeDataUrl || r.image.objectUrl;
      /* V3 Phase 2 Round 34: 사용자 실측 버그 — 후보가 150×112(652×488의 약 23%)
         로 표시돼, 실제 크기에 맞춰 그려진 헤드라인/뱃지/CTA 글자가 함께
         4배 이상 축소되며 뭉개져 보였다("글자가 다 가려 보인다"는 리포트의
         실제 원인 — 오버레이 엔진 자체의 겹침 버그가 아니라 미리보기가 너무
         작아 읽을 수 없었던 것, 원본 해상도 합성 결과로 직접 확인함). 원본과
         동일한 4:3 비율을 유지하며 2배(300×224)로 키운다. */
      return '<div style="display:inline-block;margin:4px;text-align:center">'
        + '<img src="'+x(srcUrl)+'" style="width:300px;height:224px;object-fit:cover;border-radius:8px;border:2px solid '+(selected?'#4f46e5':'var(--a2-border)')+';cursor:pointer" onclick="AtlasImageProductionUI.selectThumbnailResult(\''+x(r.jobId)+'\')"/>'
        + mockBanner(r.image.sourceType)
        + (selected ? '<div style="font-size:10px;font-weight:800;color:#4f46e5;margin-top:2px">선택됨</div>' : '')
        + '</div>';
    }).join('');
    var actionsHtml = '';
    if(inFlight || isQueued){
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.cancelThumbnail(\''+x(conceptId)+'\')">취소</button>';
    } else if(providerId==='manual-import'){
      actionsHtml = '<input type="file" accept="image/png,image/jpeg,image/webp" onchange="AtlasImageProductionUI.onThumbnailFileSelected(\''+x(conceptId)+'\', this)"/>';
    } else if(providerId){
      /* Atlas Redesign Phase 2 (Retry state): a prior failure relabels the
         same action as an explicit retry instead of a generic "다시 생성",
         so recovery reads as recovery. Trigger condition (lastError && !inFlight)
         is the same data already computed above — no new logic, just a label. */
      var isThumbRetry = lastError && !inFlight;
      actionsHtml = '<button class="a2-btn a2-btn-secondary" onclick="AtlasImageProductionUI.generateThumbnail(\''+x(conceptId)+'\')">'+(isThumbRetry?(window.AtlasStateSystem?AtlasStateSystem.retryLabel():'다시 시도'):(results.length?'다시 생성':'생성'))+'</button>';
    }

    return '<div class="ipe-card" style="border:1px solid var(--a2-border);border-radius:10px;padding:10px;margin-top:8px;display:inline-block;vertical-align:top">'
      + (displayStatus==='processing'||displayStatus==='queued' ? cardStatusBadge(displayStatus) : '')
      + (lastError && !inFlight ? (window.AtlasStateSystem?AtlasStateSystem.errorMessage(lastError.error&&lastError.error.message||'생성에 실패했습니다.'):'') : '')
      + (galleryHtml
          ? ('<div style="margin-top:4px">'+galleryHtml+'</div>')
          : ((inFlight||isQueued) ? '' : (window.AtlasStateSystem?AtlasStateSystem.noResults({text:'아직 생성되지 않았습니다.'}):'')))
      + '<div style="margin-top:6px">'+actionsHtml+'</div>'
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

  function themeAssetFile(themeId){
    return { publisherPremium:'publisher-premium.png', problemSolver:'problem-solver.png', bestsellerEditorial:'bestseller-editorial.png', marketplaceImpact:'marketplace-impact.png' }[themeId] || 'problem-solver.png';
  }

  /* V3 Phase 2 Round 22: 테마를 고르는 화면(카드 그리드, 클릭 시 재선택)은
     AI Planner(js/ai-planner.js renderCandidates)로 옮겼다 — 여기서는 이미
     정해진 테마를 읽기 전용으로 보여주기만 한다(재선택 UI 중복 금지, "선택은
     한 곳에서만" 원칙). 2026-08-07: 이 Planner 화면 자체가 전자책 생성 이후
     ·이 STEP4 진입 직전으로 옮겨졌다(atlasGoToThumbnailStage). Planner를
     거치지 않고 옛 저장본을 이어서 여는 경우에도 TTE.getTheme의 안전한
     기본값 폴백 덕분에 항상 유효한 테마 이름이 표시된다. */
  function selectedThemeReadoutHtml(){
    if(!TTE) return '';
    var themeId = UI.getSelectedThumbnailThemeId();
    var t = TTE.getTheme(themeId);
    return '<div class="ipe-theme-readout">'
      + '<img src="assets/thumbnail-themes/'+themeAssetFile(t.id)+'" alt="'+x(t.name)+' 미리보기" class="ipe-theme-readout-img"/>'
      + '<div class="ipe-theme-readout-body">'
      + '<div class="ipe-theme-readout-label">선택된 스타일</div>'
      + '<div class="ipe-theme-readout-name">'+x(t.nameKo)+'</div>'
      + '<div class="ipe-theme-readout-oneliner">'+x(t.oneLiner)+'</div>'
      + '</div></div>';
  }

  UI.render = function(){
    var st = S.get(); if(!st) return;
    var thumbWrap = document.getElementById('ipe-thumb-list');
    var spWrap = document.getElementById('ipe-sp-list');
    if(!thumbWrap || !spWrap) return;

    var themeReadoutWrap = document.getElementById('ipe-selected-theme-readout');
    if(themeReadoutWrap) themeReadoutWrap.innerHTML = selectedThemeReadoutHtml();

    var statusBanner = document.getElementById('ipe-provider-status-banner');
    if(statusBanner) statusBanner.innerHTML = providerStatusBannerHtml() + limitExceededBannerHtml();

    var thumbPlanned = st.creativeDirector.thumbnailPlanStatus==='planned';
    var spPlanned = st.creativeDirector.salesPagePlanStatus==='planned';
    var effectiveProviderId = UI.effectivePrimaryProviderId();

    var thumbGenerateBtn = document.getElementById('ipe-thumb-generate-btn');
    /* V3 Phase 2 Round 11: 기획(planThumbnailConcepts)이 더 이상 별도 사용자
       버튼이 아니라 generateThumbnailsSimple() 내부의 숨은 첫 단계이므로,
       thumbPlanned 여부로 이 버튼을 막지 않는다 — Provider만 준비되면 항상
       누를 수 있다. */
    if(thumbGenerateBtn) thumbGenerateBtn.disabled = !effectiveProviderId;
    var spGenerateBtn = document.getElementById('ipe-sp-generate-btn');
    if(spGenerateBtn) spGenerateBtn.disabled = !effectiveProviderId || !spPlanned;
    /* Atlas Redesign Phase 2 (Disabled state): same condition already used
       above to disable the buttons — only the visible reason is new. */
    var thumbReason = document.getElementById('ipe-thumb-generate-reason');
    if(thumbReason) thumbReason.innerHTML = (!window.AtlasStateSystem) ? '' :
      (!effectiveProviderId ? AtlasStateSystem.disabledReason('이미지 생성 방식이 설정되지 않았습니다. 위 안내를 확인해주세요.') : '');
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
      : '<div style="font-size:12px;color:var(--a2-text-faint)">아직 생성되지 않았습니다. [썸네일 생성]을 눌러주세요.</div>';

    /* V3 Phase 2 Round 30: 후보마다 이미 실제 제목/카피가 자동으로 입혀져
       있으므로(compositeDataUrl), 별도의 "한글 오버레이 적용" 버튼은 더 이상
       필요 없다 — 카피를 바꾸고 싶을 때만 쓰는 "카피만 변경"과, 글씨체를
       바꾸는 폰트 선택기만 남긴다(사용자 요구: "썸네일의 글씨체도 수정되도록
       해"). 폰트를 바꾸면 재생성 없이 선택된 후보에 즉시 다시 입힌다. */
    var thumbSelected = st.thumbnail.selectedResultId;
    var thumbOverlayBtn = document.getElementById('ipe-thumb-overlay-actions');
    if(thumbOverlayBtn){
      if(thumbSelected){
        var tCopy = approvedThumbnailCopy();
        var curFont = st.thumbnail.overlayFontFamily || 'pretendard';
        var fontOptionsHtml = THUMB_FONT_OPTIONS.map(function(f){
          return '<option value="'+x(f.key)+'"'+(f.key===curFont?' selected':'')+'>'+x(f.label)+'</option>';
        }).join('');
        thumbOverlayBtn.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          + '<label style="font-size:11px;color:var(--a2-text-faint);font-weight:700">글씨체</label>'
          + '<select class="a2-input" style="max-width:220px" onchange="AtlasImageProductionUI.setThumbnailOverlayFont(this.value)">'+fontOptionsHtml+'</select>'
          + '</div>'
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
