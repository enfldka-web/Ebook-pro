/* sales-page-engine.js — Milestone 3.2 Phase 5: Sales Page Engine 2.0
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §8 Sales Page Engine

   이 Engine은 Blueprint만 만든다. HTML/Canvas/PNG/SVG/이미지 렌더링, Export를 전혀
   하지 않는다 — 실제 렌더링은 기존 Sales Page Studio(js/sales-page-studio.js, 삭제/
   수정하지 않음)가 이 Blueprint를 기본값으로 소비한다.

   내부 구조(요청된 순서 그대로, 각 함수는 독립적으로 테스트 가능):
     Input Normalizer → Section Decision → Section Order → Section Priority
     → Content Mapping → Layout Strategy → Visual Hierarchy
     → Sales Page Blueprint Builder → Reasoning Service

   입력은 두 가지뿐이다:
   - BrandProfile(읽기 전용): salesPagePreference, faqStyle, socialProofStyle,
     informationDensity, layoutPreference, brandStrategy — 이 6개 속성만 읽는다.
     Brand Pack 이름(premium/studyNote/handwriting)으로는 어디서도 분기하지 않는다.
   - Marketing Copy Asset Pool(읽기 전용): headline, subheadline, benefits, faqs,
     cta, trust, scarcity, urgency — 이 7개 값만 그대로 섹션에 배치한다. 새 카피를
     만들지 않는다(badge/hook 등 이 목록 밖의 값은 참조하지 않는다).

   구현하지 않는 것: HTML/Canvas/PNG/SVG 렌더링, Export, Thumbnail Engine 재판단,
   Marketing Copy 수정, BrandProfile 수정. */

window.AtlasSalesPageEngine = window.AtlasSalesPageEngine || {};

(function(SPE){

  /* docs/ATLAS_AI_ENGINE_SPECIFICATION.md §8 "고정 섹션 순서". 브랜드에 따라 순서가
     바뀌지 않는다 — 오직 강조/비중(Section Priority)만 바뀐다. */
  var SECTION_ORDER = ['Hero','Problem','Authority/Solution','Benefits','Social Proof','FAQ','CTA'];
  SPE.sectionOrder = function(){ return SECTION_ORDER.slice(); };

  /* ── 1. Input Normalizer ──
     BrandProfile에서 허용된 6개 속성, Marketing Copy에서 허용된 7개 값만 뽑는다. */
  SPE.inputNormalizer = function(brandProfile, marketingCopy){
    brandProfile = brandProfile || {};
    marketingCopy = marketingCopy || {};
    return {
      salesPagePreference: brandProfile.salesPagePreference || '',
      faqStyle: brandProfile.faqStyle || '',
      socialProofStyle: brandProfile.socialProofStyle || '',
      informationDensity: brandProfile.informationDensity || '',
      layoutPreference: brandProfile.layoutPreference || '',
      brandStrategy: brandProfile.brandStrategy || '',
      headline: marketingCopy.headline || '',
      subheadline: marketingCopy.subheadline || '',
      benefits: marketingCopy.benefits || [],
      faqs: marketingCopy.faqs || [],
      cta: marketingCopy.cta || '',
      trust: marketingCopy.trust || null,
      trustWithheldReason: (marketingCopy.metadata && marketingCopy.metadata.trustWithheldReason) || null,
      scarcity: marketingCopy.scarcity || null,
      scarcityWithheldReason: (marketingCopy.metadata && marketingCopy.metadata.scarcityWithheldReason) || null,
      urgency: marketingCopy.urgency || null,
      urgencyWithheldReason: (marketingCopy.metadata && marketingCopy.metadata.urgencyWithheldReason) || null
    };
  };

  /* ── 2. Section Decision ──
     7개 섹션은 항상 "존재"한다(고정 순서를 지키기 위해 섹션 자체를 빼지 않는다).
     다만 실제 콘텐츠가 없는 섹션(Social Proof/CTA 안의 Scarcity·Urgency)은
     hasContent:false로 표시한다 — Marketing Copy Engine이 이미 "근거 없으면 비워둔다"
     규칙을 지켰으므로, 이 Engine은 그 빈 상태를 그대로 전달할 뿐 새로 채우지 않는다. */
  SPE.sectionDecision = function(input){
    return {
      'Hero': { included:true, hasContent: !!input.headline },
      'Problem': { included:true, hasContent: !!input.subheadline },
      'Authority/Solution': { included:true, hasContent: !!(input.headline && input.benefits.length) },
      'Benefits': { included:true, hasContent: input.benefits.length>0 },
      'Social Proof': { included:true, hasContent: !!input.trust },
      'FAQ': { included:true, hasContent: input.faqs.length>0 },
      'CTA': { included:true, hasContent: !!input.cta }
    };
  };

  /* ── 3. Section Priority (BrandProfile.salesPagePreference 기준) ──
     "Authority/Solution 강조" / "FAQ/Social Proof 강조" / "Hero/Benefits 강조"
     문자열에서 실제로 강조할 섹션 이름만 뽑는다 — 표에 없는 문구가 들어오면 임의로
     아무 섹션이나 강조하지 않고 전부 normal로 둔다(Never Guess). */
  var PRIORITY_SECTIONS_BY_PREFERENCE = {
    'Authority/Solution 강조': ['Authority/Solution'],
    'FAQ/Social Proof 강조': ['FAQ','Social Proof'],
    'Hero/Benefits 강조': ['Hero','Benefits']
  };
  SPE.sectionPriority = function(input){
    var highlighted = PRIORITY_SECTIONS_BY_PREFERENCE[input.salesPagePreference] || [];
    var priority = {};
    SECTION_ORDER.forEach(function(name){ priority[name] = highlighted.indexOf(name)>-1 ? 'high' : 'normal'; });
    return priority;
  };

  /* ── 4. Content Mapping ──
     Marketing Copy Asset Pool의 7개 값을 7개 섹션에 그대로 배치한다. Sales Page
     Engine이 가진 카피 재료는 headline/subheadline/benefits/faqs/cta/trust/scarcity/
     urgency뿐이므로, 여기 없는 섹션 전용 문구(예: Problem 섹션만의 별도 카피)를
     새로 짓지 않고 이미 있는 값을 재사용한다 — subheadline은 Marketing Copy Engine
     템플릿 자체가 이미 "문제 인정" 문장이므로 Problem 섹션에 그대로 쓴다. */
  SPE.contentMapping = function(input){
    return {
      'Hero': { headline:input.headline, subheadline:input.subheadline, cta:input.cta },
      'Problem': { text:input.subheadline },
      'Authority/Solution': { headline:input.headline, primaryBenefit:input.benefits[0]||null },
      'Benefits': { benefits:input.benefits },
      'Social Proof': { trust:input.trust, withheldReason:input.trustWithheldReason },
      'FAQ': { faqs:input.faqs },
      'CTA': { cta:input.cta, scarcity:input.scarcity, scarcityWithheldReason:input.scarcityWithheldReason, urgency:input.urgency, urgencyWithheldReason:input.urgencyWithheldReason }
    };
  };

  /* ── 5. Layout Strategy (BrandProfile.layoutPreference 기준) ──
     페이지 전체 레이아웃 스타일과, Benefits/FAQ처럼 개수가 여러 개인 섹션의 배치
     방식을 정한다. */
  var LAYOUT_STRATEGY_BY_PREFERENCE = {
    '숫자중심':  { pageLayoutStyle:'grid-first',   benefitsLayout:'numbered-grid', faqLayout:'accordion-compact' },
    '텍스트중심': { pageLayoutStyle:'text-first',   benefitsLayout:'list',          faqLayout:'expanded-qna' },
    '목업중심':  { pageLayoutStyle:'mockup-first',  benefitsLayout:'card-grid',     faqLayout:'accordion-compact' }
  };
  var NEUTRAL_LAYOUT_STRATEGY = { pageLayoutStyle:'text-first', benefitsLayout:'list', faqLayout:'accordion-compact' };
  SPE.layoutStrategy = function(input){
    return LAYOUT_STRATEGY_BY_PREFERENCE[input.layoutPreference] || NEUTRAL_LAYOUT_STRATEGY;
  };

  /* ── 6. Visual Hierarchy ──
     Section Priority(high로 표시된 섹션)를 앞세운 시각 강조 순서. 실제 DOM/섹션
     순서(SECTION_ORDER, 고정)와는 다른 개념이다 — "어디를 먼저 봐야 하는가"이지
     "어디에 있는가"가 아니다. */
  SPE.visualHierarchy = function(priority){
    var high = SECTION_ORDER.filter(function(name){ return priority[name]==='high'; });
    var normal = SECTION_ORDER.filter(function(name){ return priority[name]!=='high'; });
    return high.concat(normal);
  };

  /* ── 7. Sales Page Blueprint Builder ── */
  SPE.blueprintBuilder = function(input, sections, priority, content, layout, hierarchy){
    var sectionList = SECTION_ORDER.map(function(name){
      return {
        name:name,
        included:sections[name].included,
        hasContent:sections[name].hasContent,
        priority:priority[name],
        content:content[name]
      };
    });
    return {
      sectionOrder: SECTION_ORDER.slice(),
      sections: sectionList,
      layoutStrategy: layout.pageLayoutStyle,
      benefitsLayout: layout.benefitsLayout,
      faqLayout: layout.faqLayout,
      visualHierarchy: hierarchy,
      metadata: {
        brandStrategy: input.brandStrategy,
        salesPagePreference: input.salesPagePreference,
        faqStyle: input.faqStyle,
        socialProofStyle: input.socialProofStyle,
        trustWithheldReason: input.trustWithheldReason,
        scarcityWithheldReason: input.scarcityWithheldReason,
        urgencyWithheldReason: input.urgencyWithheldReason,
        timestamp: Date.now()
      }
    };
  };

  /* ── Reason Generator ── */
  SPE.reasonGenerator = function(input, blueprint, priority){
    var reasons = [];
    var highlighted = SECTION_ORDER.filter(function(n){ return priority[n]==='high'; });
    reasons.push('BrandProfile.salesPagePreference("'+input.salesPagePreference+'")에 따라 '+(highlighted.length?('"'+highlighted.join(', ')+'" 섹션을'):'특정 섹션 없이 전체를')+' 강조했습니다.');
    reasons.push('섹션 순서는 §8 고정 순서("Hero → Problem → Authority/Solution → Benefits → Social Proof → FAQ → CTA")를 그대로 따랐습니다(브랜드와 무관하게 항상 동일).');
    reasons.push('BrandProfile.layoutPreference("'+input.layoutPreference+'")에 따라 페이지 레이아웃을 "'+blueprint.layoutStrategy+'"로, Benefits를 "'+blueprint.benefitsLayout+'"로 정했습니다.');
    reasons.push('BrandProfile.faqStyle("'+input.faqStyle+'")에 따라 FAQ '+input.faqs.length+'개를 FAQ 섹션에 그대로 배치했습니다.');
    var socialProofSection = blueprint.sections.filter(function(s){ return s.name==='Social Proof'; })[0];
    reasons.push(socialProofSection.hasContent
      ? ('BrandProfile.socialProofStyle("'+input.socialProofStyle+'") 기준 근거가 확인되어 Social Proof 섹션을 채웠습니다.')
      : ('Social Proof 섹션: '+input.trustWithheldReason));
    if(input.scarcityWithheldReason) reasons.push('CTA 섹션 Scarcity: '+input.scarcityWithheldReason);
    if(input.urgencyWithheldReason) reasons.push('CTA 섹션 Urgency: '+input.urgencyWithheldReason);
    return reasons;
  };

  /* ── Orchestrator ──
     BrandProfile과 Marketing Copy 모두 읽기 전용으로만 쓰고 수정하지 않는다. 완성된
     Blueprint에 대한 근거를 Reasoning Service에 한 번 기록한다. */
  SPE.run = function(brandProfile, marketingCopy){
    if(!brandProfile || !marketingCopy) return null;
    var input = SPE.inputNormalizer(brandProfile, marketingCopy);
    var sections = SPE.sectionDecision(input);
    var order = SPE.sectionOrder();
    var priority = SPE.sectionPriority(input);
    var content = SPE.contentMapping(input);
    var layout = SPE.layoutStrategy(input);
    var hierarchy = SPE.visualHierarchy(priority);
    var blueprint = SPE.blueprintBuilder(input, sections, priority, content, layout, hierarchy);
    var reasons = SPE.reasonGenerator(input, blueprint, priority);

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source:'SalesPageEngine',
        sectionOrder: order,
        layoutStrategy: blueprint.layoutStrategy,
        visualHierarchy: blueprint.visualHierarchy,
        reasons: reasons,
        timestamp: blueprint.metadata.timestamp
      });
    }

    return blueprint;
  };

})(window.AtlasSalesPageEngine);
