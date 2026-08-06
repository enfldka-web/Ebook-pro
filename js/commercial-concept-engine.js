/* js/commercial-concept-engine.js — V3 Phase 2 Round 8: Commercial Concept Engine.

   지금까지(Round 1~7)는 Book → Thumbnail Theme → Prompt Builder → AI Image →
   Overlay라는 파이프라인이었다 — Theme이 "어떻게 보여줄지"는 정했지만, "무엇을
   보여줄지"는 여전히 category+archetypeId 조합의 고정 라이브러리 값이었다(Round 7
   진단에서 확인). 이 파일은 Prompt Builder보다 앞에 새 의사결정 계층 3개를
   추가한다:

     Book → Commercial Concept Engine → Creative Director → Art Director →
     Prompt Builder → AI Image → Overlay

   Commercial Concept Engine(ACE)은 "이 전자책을 클릭하게 만들 가장 강력한 시각적
   아이디어는 무엇인가?"라는 질문에 프롬프트를 쓰기 전에 먼저 답한다. 이 책의 실제
   신호(제목/약속/타깃/숫자/프레임워크/타임라인/비교표/혜택 개수 등 — Round 7의
   quantifiedPromiseSignal과 같은 원칙으로, 한국어 자유 문장 번역 없이 안전하게
   판별 가능한 신호만 사용)를 검사해 여러 개의 실제 Concept 후보를 만들고, 마켓플레이스
   가독성/실제 신호 근거량을 기준으로 점수를 매겨 약한 Concept은 버리고 가장 강한
   Concept 하나만 Creative Director에게 넘긴다.

   Theme(js/thumbnail-theme-engine.js)은 그대로 유지된다 — Concept이 "무엇을"
   결정하면 Theme은 여전히 "어떻게"(카메라 언어/스타일, Round 7에서 이미 테마별로
   완전히 분리됨)를 결정한다. 같은 Concept이 테마마다 다르게 실행된다.

   순수 함수만 담는다(DOM 없음, Node에서 독립적으로 테스트 가능) — 다른 어떤 모듈도
   직접 호출하지 않고 window.AtlasCreativeCampaignEngine의 이미 존재하는 읽기 전용
   헬퍼(quantifiedPromiseSignal/environmentLibrary/productMockupEn/mainSubjectEn/
   lightingDirector)만 재사용한다(재계산 없음, CCE 자체 수정 없음 — Sales Page가
   의존하는 함수는 하나도 건드리지 않는다). */

window.AtlasCommercialConceptEngine = window.AtlasCommercialConceptEngine || {};

(function(ACE){

  /* 이 점수 미만이면 "약한 Concept"으로 자동 기각한다. Family 자체의 기본
     가독성(FAMILY_BASE_CLARITY, 작은 마켓플레이스 썸네일 크기에서 얼마나 즉시
     읽히는지) + 이 Concept이 실제로 근거로 삼은 책 신호 개수(realSignalCount) —
     신호 없이 억지로 만든 Concept은 절대 통과하지 못한다. */
  ACE.REJECT_THRESHOLD = 60;

  /* 163x122 마켓플레이스 축소 시 각 구조가 얼마나 즉시 읽히는지의 기본값 —
     복잡한 구성(과정/대시보드)일수록 낮다, 단일 초점(숫자/상품)일수록 높다. */
  var FAMILY_BASE_CLARITY = {
    numberHero: 92,
    productHero: 88,
    protagonist: 85,
    beforeAfter: 80,
    processShowcase: 65,
    dashboardShowcase: 55
  };

  /* 각 archetype(=기존 5개 판매 전략)이 시도할 수 있는 Concept Family 후보 목록.
     productHero는 모든 archetype에 공통으로 포함해, 다른 신호가 전혀 없어도
     Concept Engine이 항상 최소 하나의 강한 Concept을 만들 수 있도록 보장한다
     (허약한 Concept을 그럴듯하게 지어내는 대신, 신호가 부족하면 정직하게
     "상품 자체를 주인공으로" 라는 검증된 기본형으로 떨어진다). */
  var FAMILY_BY_ARCHETYPE = {
    'tension-and-release': ['protagonist', 'numberHero', 'productHero'],
    'product-as-hero': ['productHero', 'numberHero', 'dashboardShowcase'],
    'human-story': ['protagonist', 'beforeAfter', 'productHero'],
    'before-and-after': ['beforeAfter', 'numberHero', 'protagonist', 'productHero'],
    'proof-and-process': ['processShowcase', 'dashboardShowcase', 'numberHero', 'productHero']
  };

  /* ══════════════════ 1. Signal Extractor ══════════════════
     실제 이 책의 신호만 모은다 — 없으면 지어내지 않고 false/0으로 남긴다. */
  ACE.extractSignals = function(input){
    input = input || {};
    var CCE = window.AtlasCreativeCampaignEngine;
    var pt = input.productTruth || {};
    var ai = input.audienceInsight || {};
    var mc = input.marketingCopy || {};
    var chapters = input.chapters || [];

    var frameworkStepCount = 0, timelineStepCount = 0, hasComparisonTable = false;
    chapters.forEach(function(ch){
      if(ch && ch.framework && ch.framework.steps) frameworkStepCount += ch.framework.steps.length;
      if(ch && ch.timeline) timelineStepCount += ch.timeline.length;
      if(ch && ch.comparisonTable && ch.comparisonTable.rows && ch.comparisonTable.rows.length) hasComparisonTable = true;
    });

    var quant = CCE.quantifiedPromiseSignal(pt);
    var benefitsCount = (mc.benefits || []).length;

    return {
      number: quant,
      hasNumber: quant.hasSignal,
      frameworkStepCount: frameworkStepCount,
      hasFramework: frameworkStepCount > 0,
      timelineStepCount: timelineStepCount,
      hasTimeline: timelineStepCount > 0,
      hasComparisonTable: hasComparisonTable,
      benefitsCount: benefitsCount,
      hasUrgency: !!mc.urgency,
      hasTransformation: !!pt.transformation,
      hasHiddenFrustration: !!ai.hiddenFrustration,
      corePromise: pt.corePromise || '',
      coreProblem: pt.coreProblem || '',
      transformation: pt.transformation || '',
      primaryAudience: ai.primaryAudience || ''
    };
  };

  /* ══════════════════ 2. Concept Generators ══════════════════
     각 Family가 이 책에서 실제로 근거를 찾았는지(requiredSignalOk)와, 근거로 삼은
     신호 개수(realSignalCount, 점수의 signalBonus로 이어짐)를 함께 반환한다.
     visualIdeaEn은 Creative Director/Art Director가 그대로 이어받는 핵심 시각
     아이디어 한 문장(영문, 프롬프트에 직접 들어갈 재료) — 이 함수들이 "무엇을
     보여줄지"를 결정하는 지점이다. */
  var CONCEPT_GENERATORS = {
    numberHero: function(signals){
      var ok = signals.hasNumber;
      return {
        family: 'numberHero', requiredSignalOk: ok, realSignalCount: ok ? 2 : 0,
        rationaleKo: ok ? ('이 책이 실제로 약속하는 숫자("'+signals.number.number+(signals.number.unitEn?(' '+signals.number.unitEn):'')+'")를 시각적 중심으로 삼는다') : '이 책의 약속 문구에서 추출 가능한 실제 숫자가 없다',
        visualIdeaEn: 'the promised figure ('+(ok?signals.number.number:'')+(ok&&signals.number.unitEn?(' '+signals.number.unitEn):'')+') rendered as the single dominant visual anchor of the frame, as a graphic shape or object count — never as literal readable text or digits'
      };
    },
    protagonist: function(signals){
      var ok = signals.hasHiddenFrustration;
      return {
        family: 'protagonist', requiredSignalOk: ok, realSignalCount: ok ? 2 : 1,
        rationaleKo: ok ? ('이 책의 실제 타깃 독자가 겪는 문제가 풀리는 순간') : '독자 정보가 약해 일반적인 인물 장면 정도로만 성립한다',
        visualIdeaEn: 'the real target reader captured at the exact moment their problem visibly eases or resolves'
      };
    },
    beforeAfter: function(signals){
      /* productTruth.transformation은 항상 채워져 있는 카테고리 템플릿 문자열이다
         (Round 7에서 진단된 것과 같은 함정 — book마다 달라지지 않는다) — "실제
         신호"로 취급하면 안 된다. 진짜 책별 신호인 hasTimeline(실제 챕터의
         타임라인 데이터)만 필수 조건으로 삼는다. */
      var ok = signals.hasTimeline;
      return {
        family: 'beforeAfter', requiredSignalOk: ok, realSignalCount: ok ? 2 : 0,
        rationaleKo: ok ? '이 책의 실제 타임라인 데이터를 변화(before → after) 구조로 보여준다' : '이 책에 실제 타임라인 데이터가 없다(범주 템플릿 문구만으로는 근거로 인정하지 않는다)',
        visualIdeaEn: 'a clean split-frame contrasting the real before-state and after-state this book promises'
      };
    },
    processShowcase: function(signals){
      var ok = signals.hasFramework;
      return {
        family: 'processShowcase', requiredSignalOk: ok, realSignalCount: ok ? Math.min(2, signals.frameworkStepCount) : 0,
        rationaleKo: ok ? ('이 책의 실제 단계별 프레임워크('+signals.frameworkStepCount+'단계)를 시각적 과정으로 보여준다') : '이 책에 실제 단계별 프레임워크 데이터가 없다',
        visualIdeaEn: 'the book\'s real step-by-step framework shown as a visible sequence or workflow captured mid-progress'
      };
    },
    dashboardShowcase: function(signals){
      var ok = signals.hasComparisonTable || signals.benefitsCount >= 3;
      return {
        family: 'dashboardShowcase', requiredSignalOk: ok, realSignalCount: (signals.hasComparisonTable?1:0)+(signals.benefitsCount>=3?1:0),
        rationaleKo: ok ? '이 책이 실제로 제시하는 여러 근거/이점을 한눈에 보여주는 보드 형태' : '한눈에 요약할 만큼 근거/이점 신호가 충분하지 않다',
        visualIdeaEn: 'a dashboard-like arrangement summarizing several of the book\'s real benefits or evidence points at a glance'
      };
    },
    productHero: function(){
      return {
        family: 'productHero', requiredSignalOk: true, realSignalCount: 1,
        rationaleKo: '항상 성립하는 검증된 기본형 — 전자책 자체를 단일 주인공으로 보여준다',
        visualIdeaEn: 'the ebook itself standing alone as a single confident hero object, catching the light, with no other objects nearby'
      };
    }
  };

  /* V3 Phase 2 Round 9: 각 Concept Family가 대응하는 Product Marketing Engine
     Hero Type — PME.rankHeroCandidates()의 marketingStrength를 이 Family의
     "판매 강도"로 그대로 가져온다(재계산 없음, 단방향 의존). */
  var HERO_TYPE_BY_FAMILY = {
    numberHero: 'number', protagonist: 'person', beforeAfter: 'transformation',
    processShowcase: 'framework', dashboardShowcase: 'proof', productHero: 'book'
  };
  function marketingStrengthFor(family, heroCandidates){
    if(!heroCandidates) return null;
    var heroType = HERO_TYPE_BY_FAMILY[family];
    var match = heroCandidates.filter(function(h){ return h.heroType === heroType; })[0];
    return match ? match.marketingStrength : 0;
  }

  /* productHero는 "항상 통과하는 안전한 바닥"이지 "선호되는 선택"이 아니다.
     Round 8에서 발견된 근본 원인: 가독성 점수(FAMILY_BASE_CLARITY)와 신호
     보너스가 한 숫자 안에 섞여 있어, "가독성이 좋아서"가 "실제로 더 강한
     판매 포인트라서"를 조용히 이겼다(예: numberHero가 processShowcase보다
     항상 이겼는데 이유는 진짜 프레임워크가 약해서가 아니라 숫자가 작은
     화면에서 더 잘 읽혀서였다). Product Marketing Engine이 있으면 마케팅
     강도가 순위를 지배하고(85%), 가독성은 근소한 차이를 가를 때만 쓰는
     보조 기준(15%)이 된다 — 이 두 축을 구조적으로 분리하는 것이 Round 9의
     핵심이다. PME 없이 호출되면(하위 호환) Round 8 방식 그대로 동작한다. */
  function scoreConcept(c, usedFamilies, heroCandidates){
    var base = FAMILY_BASE_CLARITY[c.family] || 60;
    var marketingStrength = marketingStrengthFor(c.family, heroCandidates);
    var blended;
    if(marketingStrength === null){
      var signalBonus = Math.min(20, c.realSignalCount * 7);
      var weakFallbackPenalty = (c.family === 'productHero' && c.realSignalCount <= 1) ? 25 : 0;
      blended = base + signalBonus - weakFallbackPenalty;
    } else {
      blended = marketingStrength * 0.85 + base * 0.15;
    }
    /* 이 책의 5개 Concept 카드(=5개 archetype) 전체가 같은 신호(예: 하나의
       숫자)를 공유하는 경우가 흔하다 — 매번 점수만 보면 numberHero가 5장
       전부를 휩쓸어, "5개의 서로 다른 Concept"이라는 Atlas의 기존 보장(Round
       1~2)이 실제 이미지 생성 단계에서 조용히 무너진다(직접 확인된 문제 —
       검증 갤러리에서 한 책의 5장 중 4장이 동일한 Concept으로 수렴했다).
       이미 다른 카드가 선택한 Family에는 소폭 감점을 줘, 신호가 여러 Concept
       후보에 걸쳐 있을 때는 각 카드가 서로 다른 Family로 퍼지도록 유도한다 —
       단, 감점은 "압도적으로 강한 근거"까지 뒤집지는 않도록 재사용 횟수에
       비례해서만 커진다(1번 더 쓰일 때마다 추가 감점 — 매번 같은 감점이면
       이미 2번 선택된 Family가 계속 이기는 경우가 실제로 있었다). */
    var usedCount = usedFamilies ? usedFamilies.filter(function(f){ return f === c.family; }).length : 0;
    var diversityPenalty = usedCount * 14;
    return Math.round(blended - diversityPenalty);
  }

  /* ══════════════════ 3. Concept Selection (generate → score → reject → choose) ══════════════════
     usedFamilies: 같은 책의 다른 Concept 카드가 이미 선택한 Family 목록(선택
     인자) — 카드 간 다양성을 유도하는 점수 보정에만 쓰이고, Family 자체를
     막지는 않는다.
     heroCandidates: PME.rankHeroCandidates()의 결과(선택 인자) — 이 Family에
     대응하는 Hero Type의 marketingStrength가 0이면, CCE 자체 판단과 무관하게
     이 Family를 기각한다(PME의 거부권 — "가독성은 괜찮아도 이 책에 이 Hero를
     뒷받침할 실제 판매 신호가 없다"). */
  ACE.generateConcepts = function(archetypeId, signals, usedFamilies, heroCandidates){
    var families = FAMILY_BY_ARCHETYPE[archetypeId] || FAMILY_BY_ARCHETYPE['product-as-hero'];
    var candidates = families.map(function(fam){
      var c = CONCEPT_GENERATORS[fam](signals);
      var marketingStrength = marketingStrengthFor(fam, heroCandidates);
      if(marketingStrength !== null && marketingStrength <= 0){
        c.requiredSignalOk = false;
        c.rationaleKo = 'Product Marketing Engine이 이 Family에 대응하는 실제 판매 신호를 찾지 못했다 — ' + c.rationaleKo;
      }
      c.score = scoreConcept(c, usedFamilies, heroCandidates);
      return c;
    });
    var passes = function(c){ return c.requiredSignalOk && c.score >= ACE.REJECT_THRESHOLD; };
    var accepted = candidates.filter(passes);
    var rejected = candidates.filter(function(c){ return !passes(c); });
    if(!accepted.length){
      /* 이 지점에 도달하면 안 되지만(productHero가 항상 통과해야 함), 방어적으로
         한 번 더 보장한다 — Concept Engine은 절대 빈 결과를 내지 않는다. */
      var fallback = CONCEPT_GENERATORS.productHero(signals);
      fallback.score = scoreConcept(fallback, usedFamilies);
      accepted = [fallback];
    }
    accepted.sort(function(a,b){ return b.score - a.score; });
    return { selected: accepted[0], accepted: accepted, rejected: rejected, allCandidates: candidates };
  };

  /* ══════════════════ 4. Creative Director ══════════════════
     선택된 Concept "하나만" 받는다 — 다른 후보를 다시 들여다보지 않는다(요구사항
     그대로). 카메라 앵글/상품 역할/감정/조명을 결정한다. */
  var CAMERA_BY_FAMILY = {
    numberHero: 'a tight, shallow-depth-of-field shot centered on the numeric motif',
    protagonist: 'an eye-level natural shot capturing a genuine human moment',
    beforeAfter: 'a wide split-frame shot, camera locked level, dividing the scene in two',
    processShowcase: 'a top-down or 45-degree overhead shot revealing the sequence of steps',
    dashboardShowcase: 'a straight-on flat-lay or screen-facing shot revealing multiple elements at once',
    productHero: 'a close-up product shot with shallow depth of field'
  };
  var PRODUCT_ROLE_BY_FAMILY = {
    numberHero: 'symbolic', protagonist: 'supporting', beforeAfter: 'supporting',
    processShowcase: 'supporting', dashboardShowcase: 'supporting', productHero: 'hero'
  };
  var EMOTION_BY_FAMILY = {
    numberHero: 'confident, results-driven excitement',
    protagonist: 'genuine relief and quiet confidence',
    beforeAfter: 'satisfying, visibly earned contrast',
    processShowcase: 'clear, capable momentum',
    dashboardShowcase: 'trustworthy, evidence-backed confidence',
    productHero: 'quiet premium confidence'
  };

  ACE.creativeDirector = function(concept, signals, category, brandStrategy){
    var CCE = window.AtlasCreativeCampaignEngine;
    return {
      family: concept.family,
      cameraAngle: CAMERA_BY_FAMILY[concept.family],
      productRole: PRODUCT_ROLE_BY_FAMILY[concept.family],
      emotion: EMOTION_BY_FAMILY[concept.family],
      lighting: CCE.lightingDirector(brandStrategy),
      storytellingLine: concept.visualIdeaEn
    };
  };

  /* ══════════════════ 5. Art Director ══════════════════
     Creative Direction을 실제 구도(Family → 구체적 Composition)와 피사체로
     번역한다. mainSubject는 productRole에 따라 상품(hero/symbolic) 또는 인물
     (supporting, human-led)로 갈라진다 — CCE의 기존 영문 카테고리 라이브러리
     (mainSubjectEn/productMockupEn/environmentLibrary, Sales Page와 공유되는
     읽기 전용 함수)를 그대로 재사용할 뿐 새로 계산하지 않는다. */
  var COMPOSITION_BY_FAMILY = {
    numberHero: { name: 'Number Hero Showcase', description: 'the promised number rendered as a bold, simple graphic anchor with one supporting object nearby, everything else stripped away' },
    protagonist: { name: 'Protagonist Moment', description: 'a hero shot of the real target reader at the exact moment of relief or accomplishment' },
    beforeAfter: { name: 'Split Comparison', description: 'a clean split-frame comparing the real before-state and after-state this book promises' },
    processShowcase: { name: 'Process Showcase', description: 'the real step-by-step framework shown as a visible sequence or workflow in progress' },
    dashboardShowcase: { name: 'Proof Dashboard', description: 'a dashboard-like arrangement summarizing the book\'s real benefits or evidence at a glance' },
    productHero: { name: 'Product Hero Showcase', description: 'the ebook itself as a single confident hero object, catching the light, with no other objects nearby' }
  };

  ACE.artDirector = function(creativeDirection, signals, category){
    var CCE = window.AtlasCreativeCampaignEngine;
    var isProductLed = creativeDirection.productRole === 'hero' || creativeDirection.productRole === 'symbolic';
    var mainSubject = isProductLed
      ? CCE.productMockupEn(category)
      : CCE.mainSubjectEn({ subjectRole: 'human-led', archetypeId: null }, category);
    return {
      composition: COMPOSITION_BY_FAMILY[creativeDirection.family],
      camera: creativeDirection.cameraAngle,
      mainSubject: mainSubject,
      productMockup: CCE.productMockupEn(category),
      visualEvent: creativeDirection.storytellingLine,
      emotion: creativeDirection.emotion,
      lighting: creativeDirection.lighting
    };
  };

  /* ══════════════════ 6. Orchestrator ══════════════════
     js/creative-director-adapter.js가 호출하는 단일 진입점 — Book → Concept →
     Creative Director → Art Director 전체를 한 번에 실행하고, 완료 보고/검증에
     쓸 수 있도록 각 단계의 산출물(수락/기각된 Concept 포함)을 모두 반환한다. */
  /* V3 Phase 2 Round 9: Book → Product Marketing Engine → Commercial Concept
     Engine → ... PME가 있으면(js/product-marketing-engine.js가 로드된 정상
     경로) 가장 먼저 실행해 "무엇을 팔지"를 순수 마케팅 기준으로 정하고, 그
     결과(heroCandidates)를 generateConcepts에 넘겨 가독성 점수가 마케팅
     판단을 조용히 뒤집지 못하게 한다. PME가 없으면(구버전 호출부/테스트)
     Round 8 방식 그대로 동작한다(하위 호환, generateConcepts 내부에서 처리). */
  ACE.run = function(archetypeId, category, brandStrategy, input, usedFamilies){
    var signals = ACE.extractSignals(input);
    var PME = window.AtlasProductMarketingEngine;
    var heroCandidates = PME ? PME.rankHeroCandidates(input) : null;
    var conceptResult = ACE.generateConcepts(archetypeId, signals, usedFamilies, heroCandidates);
    var creativeDirection = ACE.creativeDirector(conceptResult.selected, signals, category, brandStrategy);
    var artDirection = ACE.artDirector(creativeDirection, signals, category);
    return {
      signals: signals,
      heroCandidates: heroCandidates,
      concepts: conceptResult,
      creativeDirection: creativeDirection,
      artDirection: artDirection
    };
  };

})(window.AtlasCommercialConceptEngine);
