/* marketing-copy-engine.js — Milestone 3.2 Phase 3: Marketing Copy Engine
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §6 Marketing Copy Engine

   승인된 immutable BrandProfile을 입력으로 받아 Thumbnail Engine/Sales Page Engine이
   함께 쓸 Marketing Copy Asset Pool을 만든다. 판매 전략이나 BrandProfile을 새로
   판단하거나 수정하지 않는다 — 오직 BrandProfile.* 속성(brandStrategy/badgeTone/
   headlineTone/ctaTone/faqStyle/socialProofStyle/informationDensity)만 읽기 전용으로
   소비한다. Brand Pack 이름(premium/studyNote/handwriting)으로는 어디서도 분기하지
   않는다 — brandPackId는 Reasoning Service 기록용 식별자로만 지나간다.

   내부 구조(각 함수는 독립적으로 테스트 가능하도록 분리):
     Input Normalizer → Promise Generator → Headline/Hook Generator → Badge Generator
     → CTA Generator → Benefit Generator → FAQ Generator → Trust/Scarcity Guard
     → Asset Pool Builder → Reasoning Service

   안전 규칙(코드 전체에서 지켜야 하는 불변식):
   - 실제 근거 없는 매출/수익 보장 문구를 만들지 않는다.
   - 가짜 후기, 가짜 리뷰 숫자, 가짜 자격/인증을 만들지 않는다.
   - Trust/Scarcity/Urgency는 실제 근거(input.evidence)가 있을 때만 채우고,
     없으면 null + 이유 문자열로 남긴다(빈 채로 두는 것이 기본값).
   - 이 앱에는 아직 후기/판매량/마감일을 입력하는 화면이 없으므로, 현재는
     input.evidence가 항상 비어 있고 Trust/Scarcity/Urgency는 항상 비워진다 —
     이는 버그가 아니라 "근거 없이 만들어내지 않는다"는 규칙이 정확히 동작하는 것이다.

   구현하지 않는 것: Thumbnail/Sales Page Engine의 레이아웃·섹션 자동 배치, 실제 Claude
   API 호출, 외부 시장 실시간 검색, Learning Engine, Session Memory, A/B 테스트, CTR 학습,
   BrandProfile 수정, 새 Brand Pack/Studio. */

window.AtlasMarketingCopyEngine = window.AtlasMarketingCopyEngine || {};

(function(MCE){

  /* ── 1. Input Normalizer ──
     BrandProfile 밖에서 들어오는 입력(상품/주제 정보, 사용자 입력, evidence)을
     한 곳에서 정리한다. evidence가 없으면(현재 항상 없음) 빈 객체로 취급한다. */
  MCE.inputNormalizer = function(rawInput){
    rawInput = rawInput || {};
    return {
      topic: rawInput.topic||'', target: rawInput.target||'', pain: rawInput.pain||'',
      angle: rawInput.angle||'', title: rawInput.title||'', subtitle: rawInput.subtitle||'',
      evidence: rawInput.evidence||{}
    };
  };

  /* ── 2. Promise Generator ──
     Headline과 (아직 구현되지 않은) Thumbnail/Sales Page Hero가 공유할 단 하나의
     핵심 약속 문장. 이 값은 Asset Pool의 metadata.promise로도 그대로 노출되어,
     이후 Thumbnail/Sales Page Engine이 동일한 promise를 재사용할 수 있게 한다. */
  MCE.promiseGenerator = function(input){
    var topic = input.topic || (input.title||'이 상품');
    return input.angle ? (topic+' — '+input.angle) : topic;
  };

  /* ── 3. Headline/Hook Generator ──
     BrandProfile.headlineTone 값(문자열) 기준으로만 분기한다 — Brand Pack 이름으로
     분기하지 않는다. 여기 없는 headlineTone 값이 들어오면 임의로 지어내지 않고
     promise를 그대로 headline으로 사용하는 중립 기본값을 쓴다(Never Guess). */
  var HEADLINE_BY_TONE = {
    '단정적/전문가 톤': function(promise){ return promise+', 전문가 수준으로 완성합니다.'; },
    '설명적/근거 제시 톤': function(promise){ return promise+', 근거를 하나씩 확인하며 완성합니다.'; },
    '대화체/친근 톤': function(promise){ return promise+', 우리 함께 시작해요.'; }
  };
  var SUBHEADLINE_BY_TONE = {
    '단정적/전문가 톤': function(input){ return input.pain?('더 이상 "'+input.pain+'"로 흔들리지 않습니다.'):'전문가 기준으로 다시 설계했습니다.'; },
    '설명적/근거 제시 톤': function(input){ return input.pain?('"'+input.pain+'", 이제 근거 있는 방법으로 해결합니다.'):'근거를 하나씩 짚어가며 설명합니다.'; },
    '대화체/친근 톤': function(input){ return input.pain?('"'+input.pain+'", 저도 똑같이 겪었어요.'):'같은 마음으로 하나씩 함께 해요.'; }
  };
  var HOOK_BY_TONE = {
    '단정적/전문가 톤': '전문가처럼, 지금 바로.',
    '설명적/근거 제시 톤': '근거부터 확인하고 시작하세요.',
    '대화체/친근 톤': '나만 몰랐던 이야기, 같이 나눠요.'
  };
  MCE.headlineHookGenerator = function(promise, input, brandProfile){
    var tone = brandProfile.headlineTone;
    var headlineFn = HEADLINE_BY_TONE[tone];
    var subFn = SUBHEADLINE_BY_TONE[tone];
    return {
      headline: headlineFn ? headlineFn(promise) : promise,
      subheadline: subFn ? subFn(input) : '',
      hook: HOOK_BY_TONE[tone] || promise
    };
  };

  /* ── 4. Badge Generator ── BrandProfile.badgeTone 값으로만 결정한다. */
  var BADGE_BY_TONE = {
    '권위/한정': '전문가 검증',
    '신뢰/근거': '근거 기반',
    '친근/공감': '함께하는 이야기'
  };
  MCE.badgeGenerator = function(brandProfile){
    return BADGE_BY_TONE[brandProfile.badgeTone] || brandProfile.badgeTone || '';
  };

  /* ── 5. CTA Generator ──
     BrandProfile.ctaTone 값으로 문구를 정하되, 동사(verb)는 별도로 뽑아 Asset Pool
     전체에서 하나로 고정할 수 있게 metadata에 남긴다(§4 안전 규칙 "CTA 동사 고정"). */
  var CTA_BY_TONE = {
    '자신감 있는 명령형': { text:'지금 시작하세요', verb:'시작' },
    '안심시키는 제안형': { text:'편하게 시작해보세요', verb:'시작' },
    '다정한 권유형': { text:'함께 시작해봐요', verb:'시작' }
  };
  MCE.ctaGenerator = function(brandProfile){
    return CTA_BY_TONE[brandProfile.ctaTone] || { text:brandProfile.ctaTone||'시작하세요', verb:'시작' };
  };

  /* ── 6. Benefit Generator ──
     BrandProfile.informationDensity(높음/중간/낮음)로 개수만 조절한다 — 문구 자체는
     실제 입력(pain/angle)이 있을 때만 그것을 반영하고, 없으면 일반적인 문장을 쓴다
     (존재하지 않는 실적/수치를 지어내지 않는다). */
  var BENEFIT_COUNT_BY_DENSITY = { '높음':5, '중간':4, '낮음':3 };
  MCE.benefitGenerator = function(input, brandProfile){
    var count = BENEFIT_COUNT_BY_DENSITY[brandProfile.informationDensity] || 3;
    var pool = [
      input.pain ? ('더 이상 "'+input.pain+'" 때문에 시간을 낭비하지 않습니다.') : '핵심만 빠르게 확인할 수 있습니다.',
      input.angle ? ('"'+input.angle+'" 방식으로 바로 적용할 수 있습니다.') : '바로 적용 가능한 방법을 담았습니다.',
      '전체 과정을 순서대로 따라가기만 하면 됩니다.',
      '한 번 배우면 계속 재사용할 수 있습니다.',
      '필요한 부분만 골라 바로 찾아볼 수 있게 구성했습니다.'
    ];
    return pool.slice(0, count);
  };

  /* ── 7. FAQ Generator ──
     BrandProfile.faqStyle 값으로 개수와 문구 스타일을 함께 정한다. "근거/출처 중심"
     (Trust)이 세 스타일 중 가장 많은 5개를 갖는다 — 신뢰 구축 전략은 반박이 아니라
     설명량으로 신뢰를 쌓기 때문이다. */
  var FAQ_TEMPLATES_BY_STYLE = {
    '반박 대응 중심': [
      { q:'이미 다른 방법을 시도해봤는데도 효과가 있을까요?', a:'기존 방식과 다르게 접근하기 때문에 처음 시도하시는 분도 바로 적용할 수 있습니다.' },
      { q:'시간이 오래 걸리지 않나요?', a:'핵심만 정리되어 있어 필요한 부분만 빠르게 확인할 수 있습니다.' },
      { q:'초보자도 가능한가요?', a:'단계별로 구성되어 있어 처음 시작하는 분도 따라올 수 있습니다.' }
    ],
    '근거/출처 중심': [
      { q:'이 방법의 근거는 무엇인가요?', a:'각 단계의 배경과 이유를 본문에서 함께 설명합니다.' },
      { q:'실제로 검증된 내용인가요?', a:'검증 가능한 절차와 기준을 본문에 함께 제공합니다.' },
      { q:'제 상황에도 적용되나요?', a:'상황별로 다르게 적용하는 방법을 함께 안내합니다.' },
      { q:'단계별로 확인할 수 있나요?', a:'각 단계마다 확인할 수 있는 체크리스트를 포함합니다.' },
      { q:'추가로 궁금한 점은 어떻게 하나요?', a:'본문 안내에 따라 다음 단계로 이어갈 수 있습니다.' }
    ],
    '공감/후기 중심': [
      { q:'저도 같은 고민을 하고 있는데 도움이 될까요?', a:'비슷한 고민에서 출발한 이야기라 공감하며 따라올 수 있습니다.' },
      { q:'감성적인 내용만 있고 실용성은 없나요?', a:'이야기와 함께 실제로 적용할 수 있는 부분도 담았습니다.' },
      { q:'꾸준히 이어갈 수 있을까요?', a:'부담 없이 하나씩 시작할 수 있도록 구성했습니다.' },
      { q:'나만의 방식으로 바꿔도 되나요?', a:'제시된 방법을 각자의 상황에 맞게 바꿔서 사용할 수 있습니다.' }
    ]
  };
  MCE.faqGenerator = function(brandProfile){
    var templates = FAQ_TEMPLATES_BY_STYLE[brandProfile.faqStyle] || [];
    return templates.slice();
  };

  /* ── 8. Trust/Scarcity Guard ──
     input.evidence에 실제 근거가 있을 때만 채운다. 이 앱은 아직 후기/판매량/마감일을
     입력받는 화면이 없으므로 evidence는 항상 비어 있고, 아래는 항상 withheld 경로를
     탄다 — 가짜 후기·리뷰 숫자·마감 임박 문구를 만들지 않기 위한 의도된 동작이다. */
  MCE.trustScarcityGuard = function(input, brandProfile){
    var evidence = input.evidence || {};
    var out = { trust:null, scarcity:null, urgency:null, trustWithheldReason:null, scarcityWithheldReason:null, urgencyWithheldReason:null };
    if(evidence.testimonials || evidence.salesData){
      out.trust = brandProfile.socialProofStyle+' 기준으로 확인된 근거를 반영한 Trust 문구';
    } else {
      out.trustWithheldReason = '실제 후기·판매 데이터가 없어 Trust 문구를 비워둡니다.';
    }
    if(evidence.limitedQuantity){
      out.scarcity = '실제 한정 수량 근거를 반영한 Scarcity 문구';
    } else {
      out.scarcityWithheldReason = '실제 수량 제한 근거가 없어 Scarcity를 비워둡니다.';
    }
    if(evidence.deadline){
      out.urgency = '실제 마감 일정('+evidence.deadline+') 기준 Urgency 문구';
    } else {
      out.urgencyWithheldReason = '실제 마감 일정이 없어 Urgency를 비워둡니다.';
    }
    return out;
  };

  /* ── 9. Asset Pool Builder ── */
  MCE.assetPoolBuilder = function(promise, headlineHook, badge, cta, benefits, faqs, guard, brandProfile){
    return {
      headline: headlineHook.headline,
      subheadline: headlineHook.subheadline,
      hook: headlineHook.hook,
      badge: badge,
      cta: cta.text,
      benefits: benefits,
      faqs: faqs,
      trust: guard.trust,
      scarcity: guard.scarcity,
      urgency: guard.urgency,
      metadata: {
        promise: promise,
        ctaVerb: cta.verb,
        brandPackId: brandProfile.brandPackId,
        brandStrategy: brandProfile.brandStrategy,
        faqStyle: brandProfile.faqStyle,
        socialProofStyleApplied: brandProfile.socialProofStyle,
        trustWithheldReason: guard.trustWithheldReason,
        scarcityWithheldReason: guard.scarcityWithheldReason,
        urgencyWithheldReason: guard.urgencyWithheldReason,
        timestamp: Date.now()
      }
    };
  };

  /* ── Reason Generator (Reasoning Service에 전달할 문장) ── */
  MCE.reasonGenerator = function(brandProfile, pool){
    var reasons = [];
    reasons.push('BrandProfile.headlineTone("'+brandProfile.headlineTone+'")에 따라 Headline/Subheadline/Hook 톤을 정했습니다.');
    reasons.push('BrandProfile.badgeTone("'+brandProfile.badgeTone+'")에 따라 Badge 문구를 "'+pool.badge+'"로 정했습니다.');
    reasons.push('BrandProfile.ctaTone("'+brandProfile.ctaTone+'")에 따라 CTA 문구와 동사("'+pool.metadata.ctaVerb+'")를 Asset Pool 전체에 고정했습니다.');
    reasons.push('BrandProfile.faqStyle("'+brandProfile.faqStyle+'")에 따라 FAQ '+pool.faqs.length+'개를 생성했습니다.');
    reasons.push(pool.trust ? ('BrandProfile.socialProofStyle("'+brandProfile.socialProofStyle+'") 기준 근거가 확인되어 Trust 문구를 채웠습니다.') : pool.metadata.trustWithheldReason);
    if(!pool.scarcity) reasons.push(pool.metadata.scarcityWithheldReason);
    if(!pool.urgency) reasons.push(pool.metadata.urgencyWithheldReason);
    return reasons;
  };

  /* ── Orchestrator ──
     BrandProfile은 읽기 전용으로만 사용하고 절대 수정하지 않는다. 완성된 Asset Pool에
     대한 근거는 Reasoning Service에 한 번 기록한다. */
  MCE.run = function(brandProfile, rawInput){
    if(!brandProfile) return null;
    var input = MCE.inputNormalizer(rawInput);
    var promise = MCE.promiseGenerator(input);
    var headlineHook = MCE.headlineHookGenerator(promise, input, brandProfile);
    var badge = MCE.badgeGenerator(brandProfile);
    var cta = MCE.ctaGenerator(brandProfile);
    var benefits = MCE.benefitGenerator(input, brandProfile);
    var faqs = MCE.faqGenerator(brandProfile);
    var guard = MCE.trustScarcityGuard(input, brandProfile);
    var pool = MCE.assetPoolBuilder(promise, headlineHook, badge, cta, benefits, faqs, guard, brandProfile);
    var reasons = MCE.reasonGenerator(brandProfile, pool);

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source:'MarketingCopyEngine',
        brandPackId: brandProfile.brandPackId,
        headline: pool.headline,
        badge: pool.badge,
        cta: pool.cta,
        faqCount: pool.faqs.length,
        trustWithheld: !pool.trust,
        scarcityWithheld: !pool.scarcity,
        urgencyWithheld: !pool.urgency,
        reasons: reasons,
        timestamp: pool.metadata.timestamp
      });
    }

    return pool;
  };

})(window.AtlasMarketingCopyEngine);
