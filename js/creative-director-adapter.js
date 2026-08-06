/* js/creative-director-adapter.js — Phase 15.2: Creative Director UI & Concept-First
   Generation Workflow

   Generate 버튼을 누르기 전에 사용자가 먼저 "어떤 판매 전략으로 이미지가
   만들어지는지"를 봐야 한다. 이 파일은 Phase 12.4 Creative Campaign Engine과
   Phase 14 English Scene/Camera/Composition/Lighting/Visual Style Director가
   이미 계산해 둔 데이터를 UI에서 쓰기 좋은 모양(Thumbnail Concept 카드 5개/
   Sales Page 카드 9개)으로 조립만 한다 — CCE 자체는 전혀 재작성하지 않는다
   (새 계산 없음, 읽기 전용 재사용만). 점수 시스템은 만들지 않고, 중복·필수
   다양성 조건만 검사한다. */

window.AtlasCreativeDirectorAdapter = window.AtlasCreativeDirectorAdapter || {};

(function(A){

  /* 5개 고정 판매 전략 — bigIdeaGenerator의 카테고리별 자동 top-5 랭킹과 무관하게
     항상 이 5개를 제공한다(archetypeId는 CCE.buildConceptForArchetype으로 직접 지정). */
  A.STRATEGIES = [
    { strategyType:'problem-led', archetypeId:'tension-and-release', strategyLabel:'문제 중심' },
    { strategyType:'product-hero', archetypeId:'product-as-hero', strategyLabel:'상품 중심' },
    { strategyType:'human-story', archetypeId:'human-story', strategyLabel:'인물 스토리' },
    { strategyType:'before-after', archetypeId:'before-and-after', strategyLabel:'비포·애프터' },
    { strategyType:'proof-or-process', archetypeId:'proof-and-process', strategyLabel:'증거와 과정' }
  ];

  var SAFE_AREA_BY_STRATEGY = {
    'problem-led':'우측 상단 텍스트 공간', 'product-hero':'하단 전체 텍스트 공간',
    'human-story':'상단 텍스트 공간', 'before-after':'좌측 상단 텍스트 공간', 'proof-or-process':'우측 하단 텍스트 공간'
  };

  /* V3 Phase 2 Round 7: assetLabel은 실제 이미지 생성 Provider에게 보내는 영문
     Scene의 일부라(js/provider-neutral-prompt-composer.js) card.strategyLabel(한국어,
     UI 표시용)을 그대로 쓰면 "Do not render any Korean text" 지시와 정면으로
     충돌하는 한국어가 프롬프트 안에 섞여 들어간다(발견된 버그) — 같은 5개 전략을
     가리키는 영문 라벨을 별도로 둔다. */
  var STRATEGY_LABEL_EN = {
    'problem-led':'Problem-Led', 'product-hero':'Product Hero',
    'human-story':'Human Story', 'before-after':'Before & After', 'proof-or-process':'Proof & Process'
  };

  function cameraLabelFrom(cameraLanguage){
    if(!cameraLanguage) return '';
    return cameraLanguage.angle+'('+cameraLanguage.lens+', '+cameraLanguage.style+')';
  }
  function compositionLabelFrom(compositionPattern){
    if(!compositionPattern) return { name:'', description:'' };
    return { name: compositionPattern.pattern, description: compositionPattern.description };
  }

  /* ── Thumbnail Concept 5개 ──
     V3 Phase 2 Round 8: extraSignals({ marketingCopy, chapters })는 Commercial
     Concept Engine(js/commercial-concept-engine.js)이 "무엇을 보여줄지"를 실제
     책 신호로 판단하기 위한 추가 입력이다 — 선택 인자이며 없어도(구버전 호출부)
     Concept Engine이 안전한 기본형(productHero)으로 떨어진다. */
  A.buildThumbnailConcepts = function(creativeCampaign, category, brandStrategy, productTruth, audienceInsight, extraSignals){
    var CCE = window.AtlasCreativeCampaignEngine;
    var cr = (creativeCampaign && creativeCampaign.campaignConsistency) || {};
    var lighting = CCE.lightingColorDirector(brandStrategy, cr.recurringPalette||'', cr.recurringLighting||'', category);
    var env = CCE.environmentDirector(category);
    var mockup = CCE.productMockupDirector(category, brandStrategy);
    var subject = CCE.subjectDirector(category);

    /* V3 Phase 2 Round 8: 이 책의 5개 Concept 카드 전체에 걸쳐 이미 선택된
       Commercial Concept Family를 누적한다 — 같은 책은 흔히 하나의 강한 신호
       (예: 숫자 하나)만 갖고 있어, 점수만 보면 5장 전부가 같은 Family로
       수렴할 수 있다(실제 확인된 문제). ACE.generateConcepts에 전달해 이미
       쓰인 Family에는 소폭 감점을 줌으로써, 5개 카드가 실제로 서로 다른
       Concept을 시도하도록 유도한다(강제 배제는 아님 — 근거가 압도적으로
       강하면 다시 선택될 수 있다). */
    var usedConceptFamilies = [];
    return A.STRATEGIES.map(function(strategyDef, index){
      var concept = CCE.buildConceptForArchetype(strategyDef.archetypeId, category, productTruth, audienceInsight);
      var mainSubject = concept.subjectRole==='product-led' ? mockup.mockupType : (subject.subjectRequired ? subject.subjectDescription : mockup.mockupType);
      var card = {
        conceptId: 'director-concept-'+(index+1),
        revisionNumber: 1,
        strategyType: strategyDef.strategyType,
        strategyLabel: strategyDef.strategyLabel,
        archetypeId: strategyDef.archetypeId,
        salesAngle: concept.bigIdea,
        targetEmotion: concept.emotionalHook,
        visualEvent: concept.visualEvent,
        mainSubject: mainSubject,
        subjectRole: concept.subjectRole,
        productRole: concept.productRole,
        environment: env.location+', '+env.atmosphere+' 분위기',
        camera: cameraLabelFrom(concept.cameraLanguage),
        composition: compositionLabelFrom(concept.compositionPattern),
        lighting: lighting.lightingType+' · 지배색 '+(lighting.paletteRole.dominant||'캠페인 공통 팔레트'),
        palette: lighting.paletteRole.dominant || '',
        visualStyle: CCE.visualStyleDirector(strategyDef.archetypeId),
        safeArea: SAFE_AREA_BY_STRATEGY[strategyDef.strategyType],
        whyThisCanSell: concept.whyItStopsTheScroll,
        generationStatus: 'planned',
        resultIds: [],
        revisions: []
      };
      card.revisions.push(snapshotThumbnailRevision(card));
      /* 실제 이미지 생성에 쓰이는 영문 Scene은 archetypeId에만 매여 있어(Phase 14
         Director는 결정론적) 재기획으로 표시 문구가 바뀌어도 다시 계산할 필요가
         없다 — 생성 다양성은 항상 이 값으로 보장된다.
         V3 Phase 2 Round 2: _baseEngineScene은 어떤 Thumbnail Theme도 적용되지
         않은 원본을 보관한다 — js/thumbnail-theme-engine.js의 applyThumbnailToScene은
         항상 이 원본에서 다시 계산하므로(누적 없음), 사용자가 테마를 여러 번
         바꿔도 이전 테마의 문구가 섞이지 않는다. _engineScene은 "현재 선택된
         테마가 적용된" 값이며, 최초에는 원본과 동일하다(테마 적용은
         image-generation-ui.js UI.planThumbnailConcepts/selectThumbnailTheme가
         맡는다 — 이 함수는 테마를 전혀 알지 못한다). */
      card._baseEngineScene = A.buildThumbnailEngineScene(card, creativeCampaign, category, brandStrategy, productTruth, audienceInsight, extraSignals, usedConceptFamilies);
      card._engineScene = card._baseEngineScene;
      usedConceptFamilies.push(card._baseEngineScene.commercialConcept);
      return card;
    });
  };

  function snapshotThumbnailRevision(card){
    return {
      revisionNumber: card.revisionNumber, salesAngle: card.salesAngle, visualEvent: card.visualEvent,
      camera: card.camera, composition: card.composition, createdAt: Date.now()
    };
  }

  /* ── Concept 재기획: Strategy Type(=archetypeId)은 그대로 두고, CCE가 이미
     가지고 있는 "같은 archetype의 또 다른 데이터 소스"로 salesAngle/visualEvent/
     camera/composition을 새로 제안한다(새 텍스트를 창작하지 않음 — 전부 CCE
     원본 데이터). 홀수 리비전은 Phase 12.4 Korean 스타일 카메라/구도
     (concept.cameraLanguage/compositionPattern) + bigIdea를, 짝수 리비전은
     Phase 14 English Director(sceneDirector/cameraDirector/compositionDirectorV2)
     + whyItStopsTheScroll 기반 문구를 사용해 서로 다른 실제 데이터로 교대한다. */
  A.replanThumbnailConcept = function(card, creativeCampaign, category, brandStrategy, productTruth, audienceInsight){
    var CCE = window.AtlasCreativeCampaignEngine;
    var concept = CCE.buildConceptForArchetype(card.archetypeId, category, productTruth, audienceInsight);
    card.revisionNumber = (card.revisionNumber||1) + 1;
    var useAlternate = card.revisionNumber % 2 === 0;
    if(useAlternate){
      /* 짝수 리비전: Phase 14 English Director(같은 archetype의 다른 CCE 데이터 소스)로
         교체해 실제로 다른 Camera/Composition을 제안한다 — 새 텍스트를 창작하지 않는다. */
      card.salesAngle = '이 전략이 통하는 이유: '+concept.whyItStopsTheScroll;
      card.visualEvent = concept.sceneStory;
      card.camera = CCE.cameraDirector(card.archetypeId);
      var altComposition = CCE.compositionDirectorV2(card.archetypeId);
      card.composition = { name: altComposition.name, description: altComposition.description };
    } else {
      card.salesAngle = concept.bigIdea;
      card.visualEvent = concept.visualEvent;
      card.camera = cameraLabelFrom(concept.cameraLanguage);
      card.composition = compositionLabelFrom(concept.compositionPattern);
    }
    card.targetEmotion = concept.emotionalHook;
    card.whyThisCanSell = concept.whyItStopsTheScroll;
    card.revisions.push(snapshotThumbnailRevision(card));
    /* 기존 결과(resultIds)/생성 상태는 건드리지 않는다 — 재기획은 다음 생성부터 반영된다. */
    return card;
  };

  /* ── Thumbnail Concept 5개 품질 검사(점수 아님, 중복/다양성 조건만) ── */
  A.validateThumbnailConceptSet = function(concepts){
    var issues = [];
    function uniqueCount(values){ return new Set(values).size; }
    var strategyTypes = concepts.map(function(c){ return c.strategyType; });
    if(uniqueCount(strategyTypes) !== concepts.length) issues.push('Strategy Type이 중복되었습니다.');
    var cameras = concepts.map(function(c){ return c.camera; });
    if(uniqueCount(cameras) !== concepts.length) issues.push('Camera가 중복되었습니다.');
    var compositions = concepts.map(function(c){ return c.composition && c.composition.name; });
    if(uniqueCount(compositions) !== concepts.length) issues.push('Composition이 중복되었습니다.');
    var visualEvents = concepts.map(function(c){ return c.visualEvent; });
    if(uniqueCount(visualEvents) !== concepts.length) issues.push('Visual Event가 중복되었습니다.');
    var productRoles = concepts.map(function(c){ return c.productRole; });
    if(uniqueCount(productRoles) < Math.min(3, concepts.length)) issues.push('Product Role 다양성이 부족합니다(최소 3종 필요).');
    var hasProductLed = concepts.some(function(c){ return c.subjectRole==='product-led'; });
    var hasHumanCentered = concepts.some(function(c){ return c.subjectRole!=='product-led'; });
    if(!hasProductLed || !hasHumanCentered) issues.push('Human-centered와 Product-centered Concept이 모두 포함되어야 합니다.');
    var safeAreas = concepts.map(function(c){ return c.safeArea; });
    if(uniqueCount(safeAreas) < Math.min(3, concepts.length)) issues.push('Safe Area 위치 다양성이 부족합니다(최소 3종 필요).');
    return { ok: issues.length===0, issues: issues };
  };

  /* Creative Director Concept 카드(한국어 표시용)를 실제 이미지 생성 파이프라인
     (image-engine.js의 buildRequest/composePrompt, 변경 없음)이 기대하는 영문
     "scene" 모양으로 변환한다 — Phase 14 English Director를 그대로 재사용만
     한다(재계산 없음). Safe Area/Negative Prompt는 캠페인 전체가 공유하는 값이라
     (Phase 12.2 일관성 규칙) thumbnailBriefs[0]에서 그대로 가져온다 — Concept 마다
     conceptId가 다르더라도 값 자체는 캠페인 전체에서 동일하다. */
  A.buildThumbnailEngineScene = function(card, creativeCampaign, category, brandStrategy, productTruth, audienceInsight, extraSignals, usedFamilies){
    var CCE = window.AtlasCreativeCampaignEngine;
    var ACE = window.AtlasCommercialConceptEngine;
    var IE = window.AtlasImageEngine;
    var sharedBrief = (creativeCampaign.thumbnailBriefs||[])[0] || {};
    var labelEn = STRATEGY_LABEL_EN[card.strategyType] || 'Concept';

    /* V3 Phase 2 Round 8: Prompt를 쓰기 전에 "무엇을 보여줄지"부터 결정한다 —
       Book → Commercial Concept Engine → Creative Director → Art Director.
       Round 7까지는 이 지점에서 곧바로 category+archetypeId 라이브러리 값을
       읽었다(Prompt Builder가 아이디어까지 스스로 만드는 구조). 이제 그 결정은
       ACE.run()이 먼저 내리고, 여기서는 그 결과(artDirection)를 그대로 옮겨
       담기만 한다 — Prompt Builder는 여전히 손대지 않는다(번역만 계속함).
       card._conceptDebug은 UI에 노출하지 않는 내부 값이다 — Round 8 검증/완료
       보고에서 "어떤 Concept이 선택됐고 무엇이 왜 기각됐는지"를 그대로 확인할
       수 있도록 보관한다. */
    var input = Object.assign({ productTruth: productTruth, audienceInsight: audienceInsight }, extraSignals || {});
    var direction = ACE.run(card.archetypeId, category, brandStrategy, input, usedFamilies);
    card._conceptDebug = direction;

    var quant = direction.signals.number;
    var visualEvent = direction.artDirection.visualEvent;
    /* numberHero Concept 자체가 이미 숫자를 시각적 중심으로 삼으므로, 다른
       Concept이 선택됐을 때만 Round 7의 보조 숫자 신호를 덧붙인다(중복 방지). */
    if(direction.concepts.selected.family !== 'numberHero' && quant.hasSignal){
      visualEvent += '. Include '+quant.phraseEn;
    }
    return {
      assetType: 'thumbnail',
      conceptId: card.conceptId,
      conceptName: labelEn,
      assetLabel: 'Thumbnail Concept — '+labelEn,
      archetypeId: card.archetypeId,
      commercialConcept: direction.concepts.selected.family,
      visualEvent: visualEvent,
      mainSubject: direction.artDirection.mainSubject,
      productMockup: direction.artDirection.productMockup,
      environment: CCE.environmentLibrary(category),
      camera: direction.artDirection.camera,
      composition: direction.artDirection.composition,
      lighting: direction.artDirection.lighting,
      style: CCE.visualStyleDirector(card.archetypeId),
      palette: (sharedBrief.lightingAndColor && sharedBrief.lightingAndColor.paletteRole && sharedBrief.lightingAndColor.paletteRole.dominant) || '',
      safeArea: sharedBrief.safeArea || '',
      negativePrompt: sharedBrief.negativeInstructions || '',
      emotionalDirection: direction.artDirection.emotion || card.targetEmotion || '',
      width: (IE && IE.THUMBNAIL_SIZE && IE.THUMBNAIL_SIZE.width) || 652,
      height: (IE && IE.THUMBNAIL_SIZE && IE.THUMBNAIL_SIZE.height) || 488
    };
  };

  /* ── Sales Page 9장 — 실제 이미지 생성 Scene(영문)은 기존 IE.buildSalesPageScenes를
     그대로 재사용하고(재계산/재작성 없음), 이 함수는 그 결과에 한국어 표시용 필드
     (판매 목적/실제 장면/왜 이 장이 필요한지/정보 밀도 등)만 얹는다. ── */
  var SALES_PURPOSE_BY_ROLE = {
    hero:'상품과 핵심 약속을 한눈에 전달', pain:'독자가 처한 현실에 공감하게 만든다',
    beforeAfter:'기존 방식으로 해결되지 않는 문제를 심화시킨다', solution:'기존과 다른 해결 원리를 보여준다',
    toc:'전자책 내부 구성과 사용 경험을 미리 보여준다', benefits:'실제로 포함된 자료를 구체적으로 보여준다',
    targetAudience:'독자가 읽은 뒤의 변화를 상상하게 만든다', faq:'남은 불안을 해소한다', cta:'행동을 유도하고 상품을 다시 각인시킨다'
  };
  var WHY_THIS_PAGE_EXISTS_BY_ROLE = {
    hero:'상품과 핵심 약속을 첫 화면에서 각인시켜 이후 페이지를 계속 읽게 만듭니다.',
    pain:'독자가 처한 현실을 먼저 보여줘 "내 이야기"처럼 느끼게 합니다.',
    beforeAfter:'기존 방식으로는 풀리지 않는 문제를 구체적으로 각인시켜 다음 해결책에 대한 기대를 높입니다.',
    solution:'다른 방식과 무엇이 다른지 보여줘 이 전자책을 선택해야 할 이유를 만듭니다.',
    toc:'실제 전자책 내부 구성을 미리 보여줘 무엇을 받는지 명확히 알게 합니다.',
    benefits:'실제로 포함된 자료를 구체적으로 보여줘 가치를 체감시킵니다.',
    targetAudience:'이 전자책을 읽은 뒤의 변화를 보여줘 독자가 자신의 미래를 상상하게 합니다.',
    faq:'남은 불안과 의문을 해소해 구매를 망설이는 마지막 장벽을 낮춥니다.',
    cta:'지금 행동해야 하는 이유를 제시하고 상품을 다시 각인시켜 구매로 이어지게 합니다.'
  };
  var INFO_DENSITY_BY_ROLE = { hero:'낮음', pain:'중간', beforeAfter:'중간', solution:'중간', toc:'높음', benefits:'높음', targetAudience:'중간', faq:'높음', cta:'낮음' };
  var EMOTION_DIRECTION_BY_ROLE = { hero:'확신', pain:'공감', beforeAfter:'대비 인식', solution:'기대감', toc:'신뢰', benefits:'만족', targetAudience:'자기 확신', faq:'안심', cta:'행동 결심' };

  A.buildSalesPageDirectorScenes = function(creativeCampaign, category, brandStrategy){
    var CCE = window.AtlasCreativeCampaignEngine;
    var IE = window.AtlasImageEngine;
    var roleKeys = CCE.SALES_PAGE_ROLE_KEYS || [];
    var engineScenes = IE.buildSalesPageScenes(creativeCampaign, category, brandStrategy);
    return creativeCampaign.salesPageStoryboard.map(function(page, i){
      var roleKey = roleKeys[i];
      var engineScene = engineScenes[i];
      return {
        pageNumber: page.pageNumber,
        revisionNumber: 1,
        role: page.role,
        roleKey: roleKey,
        salesPurpose: page.communicationGoal || SALES_PURPOSE_BY_ROLE[roleKey],
        sceneGoal: page.narrativeBeat,
        visualEvent: page.subjectAction,
        subjectAction: page.subjectAction,
        productRole: page.productAppearance,
        camera: engineScene.camera,
        composition: engineScene.composition,
        lighting: page.lightingAndColor ? (page.lightingAndColor.lightingType+' · '+page.lightingAndColor.paletteRole.dominant) : '',
        informationDensity: INFO_DENSITY_BY_ROLE[roleKey] || '중간',
        emotionalDirection: EMOTION_DIRECTION_BY_ROLE[roleKey] || '',
        transitionFromPrevious: page.transitionFromPrevious,
        transitionToNext: page.transitionToNext,
        whyThisPageExists: WHY_THIS_PAGE_EXISTS_BY_ROLE[roleKey] || '',
        generationStatus: 'planned',
        resultIds: [],
        revisions: [],
        _engineScene: engineScene
      };
    });
  };

  /* 상세페이지 재기획: role(=archetype 대응 개념)은 그대로 두고, CCE가 이미 가진
     "같은 역할의 또 다른 데이터 소스"로 Camera/Composition을 새로 제안한다.
     홀수↔짝수 리비전이 Phase 14 English Director(salesPageCameraDirector 등, 실제
     이미지 생성에도 쓰이는 값)와 Phase 12.2 shotType 기반 Korean 카메라 상세
     (원본 storyboard의 cameraDetail/roleComposition)를 서로 교대한다 — 새 텍스트를
     창작하지 않고 전부 CCE 원본 데이터다. */
  A.replanSalesPageScene = function(page, creativeCampaign, category, brandStrategy){
    var CCE = window.AtlasCreativeCampaignEngine;
    var original = (creativeCampaign.salesPageStoryboard||[]).filter(function(p){ return p.pageNumber===page.pageNumber; })[0];
    page.revisions.push({ revisionNumber: page.revisionNumber||1, camera: page.camera, composition: page.composition, createdAt: Date.now() });
    page.revisionNumber = (page.revisionNumber||1) + 1;
    var useAlternate = page.revisionNumber % 2 === 0;
    if(useAlternate && original && original.cameraDetail){
      page.camera = original.cameraDetail.distance+' — '+original.cameraDetail.subjectEmphasis;
      page.composition = { name:'Role Composition', description: original.roleComposition||original.composition.dominantZone };
    } else {
      var camera = CCE.salesPageCameraDirector(page.roleKey);
      var composition = CCE.salesPageCompositionDirector(page.roleKey);
      page.camera = camera;
      page.composition = { name: composition.name, description: composition.description };
    }
    if(page._engineScene){ page._engineScene.camera = CCE.salesPageCameraDirector(page.roleKey); page._engineScene.composition = CCE.salesPageCompositionDirector(page.roleKey); }
    return page;
  };

  function shotDistanceFromCamera(cameraText){
    var t = String(cameraText||'').toLowerCase();
    if(/wide|overhead|top-down/.test(t)) return 'wide';
    if(/close-up|macro/.test(t)) return 'close';
    return 'medium';
  }

  A.validateSalesPageSceneSet = function(scenes){
    var issues = [];
    function uniqueCount(values){ return new Set(values).size; }
    var roles = scenes.map(function(s){ return s.roleKey; });
    if(uniqueCount(roles) !== scenes.length) issues.push('Role이 중복되었습니다.');
    var visualEvents = scenes.map(function(s){ return s.visualEvent; });
    if(uniqueCount(visualEvents) !== scenes.length) issues.push('Visual Event가 중복되었습니다.');
    var cameras = scenes.map(function(s){ return s.camera; });
    if(uniqueCount(cameras) < 4) issues.push('Camera 다양성이 부족합니다(최소 4종 필요).');
    var shotDistances = scenes.map(function(s){ return shotDistanceFromCamera(s.camera); });
    if(uniqueCount(shotDistances) < 3) issues.push('Shot distance 다양성이 부족합니다(최소 3종 필요).');
    var productRoles = scenes.map(function(s){ return s.productRole; });
    if(uniqueCount(productRoles) < 4) issues.push('Product role 다양성이 부족합니다(최소 4종 필요).');
    var hero = scenes.filter(function(s){ return s.roleKey==='hero'; })[0];
    var cta = scenes.filter(function(s){ return s.roleKey==='cta'; })[0];
    if(hero && cta && hero.visualEvent===cta.visualEvent) issues.push('Hero와 CTA의 장면이 동일합니다.');
    var beforeAfter = scenes.filter(function(s){ return s.roleKey==='beforeAfter'; })[0];
    var targetAudience = scenes.filter(function(s){ return s.roleKey==='targetAudience'; })[0];
    if(beforeAfter && targetAudience && beforeAfter.emotionalDirection===targetAudience.emotionalDirection) issues.push('Problem과 Transformation의 감정 방향이 동일합니다.');
    var toc = scenes.filter(function(s){ return s.roleKey==='toc'; })[0];
    var faq = scenes.filter(function(s){ return s.roleKey==='faq'; })[0];
    if(toc && faq && toc.composition && faq.composition && toc.composition.name===faq.composition.name) issues.push('Contents와 FAQ의 구도가 동일합니다.');
    return { ok: issues.length===0, issues: issues };
  };

})(window.AtlasCreativeDirectorAdapter);
