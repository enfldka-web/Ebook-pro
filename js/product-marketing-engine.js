/* js/product-marketing-engine.js — V3 Phase 2 Round 9: Product Marketing Engine.

   Book → Product Marketing Engine → Commercial Concept Engine → Creative Director →
   Art Director → ... Round 8의 Commercial Concept Engine은 "어떤 Family가 이 책에서
   실제로 성립하는가"를 판단했지만, 그 판단이 가독성 점수(FAMILY_BASE_CLARITY)와
   같은 숫자 안에 섞여 있었다 — 실제로 확인된 버그: numberHero가 processShowcase보다
   항상 이겼는데, 이유는 "이 책의 진짜 강한 판매 포인트라서"가 아니라 "숫자가 작은
   화면에서 더 잘 읽혀서"였다. 이 파일은 "무엇을 팔지"를 순전히 마케팅 기준으로만
   먼저 결정한다 — 가독성/구도는 전혀 관여하지 않는다(그건 여전히 Commercial
   Concept Engine의 몫). Never Guess 원칙: 실제 신호가 없으면 그 hero 후보는
   marketingStrength 0으로 떨어진다 — 절대 지어내지 않는다.

   순수 함수만 담는다(DOM 없음, Node에서 독립적으로 테스트 가능). window.
   AtlasCreativeCampaignEngine과 window.AtlasCommercialConceptEngine의 읽기 전용
   신호 추출(extractSignals/quantifiedPromiseSignal)만 재사용한다 — 새 신호를
   추가로 계산하지 않는다. Sales Page Engine과는 무관하다(Thumbnail 전용). */

window.AtlasProductMarketingEngine = window.AtlasProductMarketingEngine || {};

(function(PME){

  /* 11개 고정 Hero 후보 — "이 전자책의 무엇을 주인공으로 세울까"의 전체 어휘.
     사용자가 지정한 예시 그대로: 숫자/변화/사람/AI/프레임워크/워크플로우/책 자체/
     결과물/감정/문제/근거. */
  PME.HERO_TYPES = ['number','transformation','person','ai','framework','workflow','book','result','emotion','problem','proof'];

  var AI_KEYWORD_RE = /\bAI\b|인공지능|챗지피티|ChatGPT|GPT/i;
  /* 단위가 시간/금액/비율처럼 구체적일수록 "진짜 약속"처럼 느껴진다 — 막연한 개수
     단위보다 신뢰도가 높다고 판단한다(순수 마케팅 판단, 가독성과 무관). */
  var CREDIBLE_UNITS = { 'hours':true,'minutes':true,'days':true,'weeks':true,'months':true,'years':true,
    'units of 10,000 KRW':true,'units of 100 million KRW':true,'percent':true };

  function candidate(heroType, hasRealSignal, strength, sellingPoint, emotionalTrigger, curiosityTrigger, rationaleKo){
    return {
      heroType: heroType,
      hasRealSignal: !!hasRealSignal,
      marketingStrength: hasRealSignal ? strength : 0,
      sellingPoint: sellingPoint || '',
      emotionalTrigger: emotionalTrigger || '',
      curiosityTrigger: curiosityTrigger || '',
      rationaleKo: rationaleKo
    };
  }

  /* input = { productTruth, audienceInsight, marketingCopy, chapters, topic, targetAudience }.
     topic/targetAudience는 이 책에 실제로 입력된 원문 그대로(카테고리 기본값이
     아니라 이 책 고유의 문구인지 판별하는 데만 쓴다 — productTruth/audienceInsight는
     이미 카테고리 기본값으로 대체된 뒤라 이 구분이 사라져 있다). */
  PME.rankHeroCandidates = function(input){
    input = input || {};
    var ACE = window.AtlasCommercialConceptEngine;
    var signals = ACE.extractSignals(input);
    var pt = input.productTruth || {};
    var ai = input.audienceInsight || {};
    var topic = input.topic || '';
    var targetAudience = input.targetAudience || '';

    var candidates = [];

    candidates.push(candidate('number', signals.hasNumber,
      (signals.hasNumber && CREDIBLE_UNITS[signals.number.unitEn]) ? 92 : 78,
      signals.hasNumber ? (signals.number.number + (signals.number.unitEn ? (' ' + signals.number.unitEn) : '')) : '',
      '구체적 숫자가 주는 신뢰감', '"정말 그 숫자가 가능할까?"라는 호기심',
      signals.hasNumber ? '이 책이 실제로 약속하는 구체적 숫자가 있다' : '이 책의 약속 문구에서 추출 가능한 실제 숫자가 없다'));

    /* transformation: productTruth.transformation은 항상 채워진 카테고리 템플릿이라
       (Round 7~8에서 이미 확인된 함정) 실제 신호로 인정하지 않는다 — 진짜 책별
       신호인 hasTimeline만 근거로 삼는다. */
    candidates.push(candidate('transformation', signals.hasTimeline, 74,
      signals.hasTimeline ? (signals.timelineStepCount + '단계 실제 타임라인') : '',
      '눈에 보이는 변화가 주는 만족감', '"나도 저렇게 될 수 있을까?"',
      signals.hasTimeline ? '이 책의 실제 타임라인 데이터가 있다' : '이 책에 실제 타임라인 데이터가 없다(카테고리 기본 문구만으로는 근거로 인정하지 않는다)'));

    /* person: targetAudience가 실제로 입력됐는지가 기준 — 비어 있으면
       audienceInsightDirector가 카테고리 기본 persona로 대체했다는 뜻이라
       "이 책 고유의" 신호로 보지 않는다. */
    var personReal = !!targetAudience;
    candidates.push(candidate('person', personReal, 68,
      personReal ? targetAudience : '',
      '나와 닮은 사람이 주는 공감', '"나와 같은 상황이네"',
      personReal ? '이 책의 실제 타깃 독자 문구가 있다' : '이 책에 실제로 입력된 타깃 독자 정보가 없어 카테고리 기본값뿐이다'));

    var aiReal = AI_KEYWORD_RE.test(topic) || AI_KEYWORD_RE.test(pt.corePromise || '');
    candidates.push(candidate('ai', aiReal, 80,
      aiReal ? 'AI' : '',
      'AI가 대신 해준다는 안도감', '"AI가 진짜 이걸 할 수 있어?"',
      aiReal ? '이 책의 실제 주제/약속 문구에 AI가 실제로 등장한다' : '이 책의 실제 문구에 AI 관련 키워드가 없다'));

    candidates.push(candidate('framework', signals.hasFramework, 66,
      signals.hasFramework ? (signals.frameworkStepCount + '단계 프레임워크') : '',
      '체계가 주는 신뢰감', '"이게 진짜 될까?"에 대한 근거',
      signals.hasFramework ? '이 책의 실제 프레임워크 데이터가 있다' : '이 책에 실제 프레임워크 데이터가 없다'));

    /* workflow: framework보다 더 구체적인 주장(3단계 이상의 실전 과정)이라 근거
       기준을 더 엄격하게 잡는다. */
    var workflowReal = signals.hasFramework && signals.frameworkStepCount >= 3;
    candidates.push(candidate('workflow', workflowReal, 70,
      workflowReal ? (signals.frameworkStepCount + '단계 실전 과정') : '',
      '단계별로 실제로 해낼 수 있다는 확신', '"저 과정을 나도 따라할 수 있을까?"',
      workflowReal ? '이 책의 실제 프레임워크가 3단계 이상의 실전 과정으로 구성돼 있다' : '실전 과정으로 부를 만큼 충분한 단계 데이터가 없다'));

    candidates.push(candidate('result', signals.benefitsCount >= 1, 60,
      signals.benefitsCount >= 1 ? (signals.benefitsCount + '개 실제 혜택') : '',
      '얻게 될 결과물이 주는 확신', '"그래서 정확히 뭘 얻는데?"',
      signals.benefitsCount >= 1 ? '이 책이 제시하는 실제 혜택 문구가 있다' : '이 책의 실제 혜택 문구가 없다'));

    /* emotion: audienceInsightDirector의 심리 필드(hiddenFrustration 등)는
       현재 항상 카테고리 기본값에서만 나온다(이 책 고유의 실제 신호가 아님) —
       그래서 실제 신호가 있다고 주장하지 않고, 늘 낮은 강도의 "바닥" 후보로만
       둔다(0으로 완전히 죽이지는 않는다 — 감정 자체는 항상 어느 정도 유효하다). */
    candidates.push(candidate('emotion', true, 40,
      ai.hiddenFrustration || '', '심리적 공감', '"내 얘기 같다"',
      '심리 데이터는 현재 카테고리 기본값에서만 나와(이 책 고유의 실제 신호 아님) 강한 후보로 인정하지 않는다'));

    /* problem: coreProblem이 실제 topic 문구를 인용해 만들어졌는지로 판별한다
       (productTruthExtractor: topic이 있으면 "…"을 아직 해결하지 못해… 형태로
       실제 topic을 그대로 인용한다). */
    var problemReal = /^"/.test(pt.coreProblem || '');
    candidates.push(candidate('problem', true, problemReal ? 72 : 45,
      problemReal ? topic : '', '내 문제를 정확히 짚어주는 느낌', '"내 얘기를 어떻게 알았지?"',
      problemReal ? '이 책의 실제 주제 문구를 근거로 문제를 구체적으로 짚는다' : '카테고리 기본 문제 서술만 가능하다(이 책 고유의 실제 주제 근거 없음)'));

    candidates.push(candidate('book', true, 35, '', '완성된 결과물이 주는 신뢰', '',
      '항상 성립하는 기본 후보 — 다른 실제 신호가 없을 때의 안전한 바닥'));

    var proofReal = signals.hasComparisonTable || signals.benefitsCount >= 3;
    candidates.push(candidate('proof', proofReal, 76, '',
      '근거가 주는 확신', '"진짜 효과가 있다는 증거가 뭔데?"',
      proofReal ? '이 책이 제시하는 실제 근거/비교 데이터가 있다' : '한눈에 보여줄 만큼 근거 데이터가 충분하지 않다'));

    candidates.sort(function(a, b){ return b.marketingStrength - a.marketingStrength; });
    return candidates;
  };

})(window.AtlasProductMarketingEngine);
