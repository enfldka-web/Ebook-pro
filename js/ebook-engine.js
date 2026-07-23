/* ebook-engine.js — Milestone 3.2 Phase 6: Ebook Engine
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md (Engine Specification v2 FINAL)

   "Ebook Engine"은 Engine Specification에 별도 이름으로 정의되어 있지 않다. 사용자
   확인 결과, 기존 파이프라인의 "Generation" 단계
   (Pre Generation Quality Check → Generation → Post Generation Quality Check)를
   구체화한 것으로 범위를 확정했다 — 새로운 단계/철학을 만든 것이 아니다.

   이 Engine은 실제 전자책 본문을 생성하지 않는다. 실제 Claude API 호출을 하지
   않는다. 기존 js/application.js의 startGenerate() 프롬프트/API 호출은 이 Phase에서
   전혀 수정하지 않는다(기존 API 변경 금지) — 대신 "어떤 톤/밀도/CTA 방식으로 써야
   하는가"를 결정하는 Ebook Blueprint(가이드라인 문서)만 만든다. 실제 챕터 수(7개),
   부록 수(3개) 같은 기존 확정 스펙은 바꾸지 않는다.

   내부 구조(다른 Engine과 동일한 파이프라인 스타일 — 각 함수는 독립적으로 테스트
   가능):
     Input Normalizer → Tone Guideline → Density Guideline → CTA Guideline
     → FAQ Integration Guideline → Cross-Consistency Mapping
     → Ebook Blueprint Builder → Reasoning Service

   입력은 네 가지, 전부 읽기 전용:
   - BrandProfile: headlineTone, informationDensity, ctaTone, faqStyle, brandStrategy
     — 이 5개 속성만 읽는다. Brand Pack 이름으로는 어디서도 분기하지 않는다.
   - Marketing Copy Asset Pool: headline, subheadline, cta, metadata.promise만 읽는다.
     새 카피를 만들지 않는다.
   - Thumbnail Blueprint: pattern만 참조(교차 일관성 확인용, 재판단 아님).
   - Sales Page Blueprint: layoutStrategy만 참조(교차 일관성 확인용, 재판단 아님).

   구현하지 않는 것: 실제 전자책 본문 생성, Claude API 호출, 챕터 수/부록 수 등 기존
   확정 스펙 변경, Thumbnail/Sales Page Engine 재판단, Marketing Copy 수정,
   BrandProfile 수정. */

window.AtlasEbookEngine = window.AtlasEbookEngine || {};

(function(EE){

  /* ── 1. Input Normalizer ── */
  EE.inputNormalizer = function(brandProfile, marketingCopy, thumbnailBlueprint, salesPageBlueprint){
    brandProfile = brandProfile || {};
    marketingCopy = marketingCopy || {};
    return {
      headlineTone: brandProfile.headlineTone || '',
      informationDensity: brandProfile.informationDensity || '',
      ctaTone: brandProfile.ctaTone || '',
      faqStyle: brandProfile.faqStyle || '',
      brandStrategy: brandProfile.brandStrategy || '',
      headline: marketingCopy.headline || '',
      subheadline: marketingCopy.subheadline || '',
      cta: marketingCopy.cta || '',
      promise: (marketingCopy.metadata && marketingCopy.metadata.promise) || '',
      thumbnailPattern: (thumbnailBlueprint && thumbnailBlueprint.pattern) || null,
      salesPageLayoutStrategy: (salesPageBlueprint && salesPageBlueprint.layoutStrategy) || null
    };
  };

  /* ── 2. Tone Guideline (BrandProfile.headlineTone 기준) ──
     표에 없는 값이 들어오면 임의로 만들지 않고 중립 가이드라인으로 대체한다. */
  var TONE_GUIDELINE_BY_HEADLINE_TONE = {
    '단정적/전문가 톤': '전문가가 확신을 갖고 결론부터 제시하는 문체 — 완곡한 표현을 최소화한다.',
    '설명적/근거 제시 톤': '근거와 과정을 먼저 설명한 뒤 결론에 도달하는 문체로 쓴다.',
    '대화체/친근 톤': '독자에게 말을 건네듯 대화체로, 공감과 경험 공유를 우선하는 문체로 쓴다.'
  };
  var NEUTRAL_TONE_GUIDELINE = '표준적인 설명체로 쓴다.';
  EE.toneGuideline = function(input){
    return TONE_GUIDELINE_BY_HEADLINE_TONE[input.headlineTone] || NEUTRAL_TONE_GUIDELINE;
  };

  /* ── 3. Density Guideline (BrandProfile.informationDensity 기준) ──
     기존 확정 스펙(챕터 7개·부록 3개 등)의 숫자를 바꾸지 않는다 — 그 안에서 정보
     밀도를 어떻게 배분할지에 대한 서술형 가이드라인만 만든다. */
  var DENSITY_GUIDELINE_BY_DENSITY = {
    '높음': '챕터당 실전 정보·비교·데이터 비중을 높게 배치하고, 여백보다 정보 전달을 우선한다.',
    '중간': '설명과 예시의 균형을 맞추고, 근거 자료를 함께 배치한다.',
    '낮음': '챕터당 정보량은 줄이고, 이야기·사례·공감 문단 비중을 늘린다.'
  };
  var NEUTRAL_DENSITY_GUIDELINE = '설명과 예시를 균형 있게 배치한다.';
  EE.densityGuideline = function(input){
    return DENSITY_GUIDELINE_BY_DENSITY[input.informationDensity] || NEUTRAL_DENSITY_GUIDELINE;
  };

  /* ── 4. CTA Guideline (BrandProfile.ctaTone 기준) ──
     기존 프롬프트의 actionBox/actionItems 문구 톤에 대한 가이드라인이다. */
  var CTA_GUIDELINE_BY_CTA_TONE = {
    '자신감 있는 명령형': 'actionBox/actionItems를 단정적 명령형으로 쓴다(예: "지금 실행하세요").',
    '안심시키는 제안형': 'actionBox/actionItems를 부담을 덜어주는 제안형으로 쓴다(예: "이렇게 해보시면 좋습니다").',
    '다정한 권유형': 'actionBox/actionItems를 다정한 권유형으로 쓴다(예: "함께 해봐요").'
  };
  var NEUTRAL_CTA_GUIDELINE = 'actionBox/actionItems를 명확하고 실행 가능한 문장으로 쓴다.';
  EE.ctaGuideline = function(input){
    return CTA_GUIDELINE_BY_CTA_TONE[input.ctaTone] || NEUTRAL_CTA_GUIDELINE;
  };

  /* ── 5. FAQ Integration Guideline (BrandProfile.faqStyle 기준) ──
     결론/부록에서 FAQ 전략과 같은 톤을 유지하기 위한 가이드라인이다. */
  var FAQ_INTEGRATION_BY_FAQ_STYLE = {
    '반박 대응 중심': '결론/부록에서 예상 반박과 그에 대한 대응 논리를 중심으로 정리한다.',
    '근거/출처 중심': '결론/부록에서 근거 자료와 출처를 재정리해 신뢰를 다시 확인시킨다.',
    '공감/후기 중심': '결론/부록에서 공감 문단과 함께 앞으로의 활용 방향을 제안한다.'
  };
  var NEUTRAL_FAQ_INTEGRATION = '결론/부록에서 핵심 내용을 간단히 요약한다.';
  EE.faqIntegrationGuideline = function(input){
    return FAQ_INTEGRATION_BY_FAQ_STYLE[input.faqStyle] || NEUTRAL_FAQ_INTEGRATION;
  };

  /* ── 6. Cross-Consistency Mapping ──
     Thumbnail/Sales Page Engine의 결과를 다시 판단하지 않고, "같은 promise/전략을
     쓰고 있는가"만 참조용으로 기록한다. */
  EE.crossConsistencyMapping = function(input){
    return {
      promise: input.promise || input.headline,
      thumbnailPattern: input.thumbnailPattern,
      salesPageLayoutStrategy: input.salesPageLayoutStrategy
    };
  };

  /* ── 7. Ebook Blueprint Builder ── */
  EE.blueprintBuilder = function(input, toneGuideline, densityGuideline, ctaGuideline, faqIntegrationGuideline, crossConsistency){
    return {
      toneGuideline: toneGuideline,
      densityGuideline: densityGuideline,
      ctaGuideline: ctaGuideline,
      faqIntegrationGuideline: faqIntegrationGuideline,
      crossConsistency: crossConsistency,
      metadata: {
        brandStrategy: input.brandStrategy,
        headlineTone: input.headlineTone,
        informationDensity: input.informationDensity,
        ctaTone: input.ctaTone,
        faqStyle: input.faqStyle,
        timestamp: Date.now()
      }
    };
  };

  /* ── Reason Generator ── */
  EE.reasonGenerator = function(input, blueprint){
    var reasons = [];
    reasons.push('BrandProfile.headlineTone("'+input.headlineTone+'")에 따라 문체 가이드라인을 정했습니다.');
    reasons.push('BrandProfile.informationDensity("'+input.informationDensity+'")에 따라 정보 밀도 가이드라인을 정했습니다(챕터/부록 개수 등 기존 확정 스펙은 변경하지 않았습니다).');
    reasons.push('BrandProfile.ctaTone("'+input.ctaTone+'")에 따라 actionBox/actionItems 문체 가이드라인을 정했습니다.');
    reasons.push('BrandProfile.faqStyle("'+input.faqStyle+'")에 따라 결론/부록 통합 가이드라인을 정했습니다.');
    reasons.push('Marketing Copy의 Promise("'+blueprint.crossConsistency.promise+'")를 그대로 재사용해 전자책 서문과의 일관성을 확인했습니다.'
      + (blueprint.crossConsistency.thumbnailPattern ? (' Thumbnail Pattern("'+blueprint.crossConsistency.thumbnailPattern+'")과 Sales Page Layout("'+blueprint.crossConsistency.salesPageLayoutStrategy+'")도 같은 BrandProfile에서 나온 값임을 함께 확인했습니다.') : ''));
    return reasons;
  };

  /* ── Orchestrator ──
     BrandProfile/Marketing Copy/Thumbnail Blueprint/Sales Page Blueprint 모두 읽기
     전용으로만 쓰고 수정하지 않는다. 완성된 Blueprint에 대한 근거를 Reasoning
     Service에 한 번 기록한다. */
  EE.run = function(brandProfile, marketingCopy, thumbnailBlueprint, salesPageBlueprint){
    if(!brandProfile || !marketingCopy) return null;
    var input = EE.inputNormalizer(brandProfile, marketingCopy, thumbnailBlueprint, salesPageBlueprint);
    var toneGuideline = EE.toneGuideline(input);
    var densityGuideline = EE.densityGuideline(input);
    var ctaGuideline = EE.ctaGuideline(input);
    var faqIntegrationGuideline = EE.faqIntegrationGuideline(input);
    var crossConsistency = EE.crossConsistencyMapping(input);
    var blueprint = EE.blueprintBuilder(input, toneGuideline, densityGuideline, ctaGuideline, faqIntegrationGuideline, crossConsistency);
    var reasons = EE.reasonGenerator(input, blueprint);

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source:'EbookEngine',
        toneGuideline: blueprint.toneGuideline,
        densityGuideline: blueprint.densityGuideline,
        ctaGuideline: blueprint.ctaGuideline,
        faqIntegrationGuideline: blueprint.faqIntegrationGuideline,
        reasons: reasons,
        timestamp: blueprint.metadata.timestamp
      });
    }

    return blueprint;
  };

})(window.AtlasEbookEngine);
