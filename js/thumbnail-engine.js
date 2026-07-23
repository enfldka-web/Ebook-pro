/* thumbnail-engine.js — Milestone 3.2 Phase 4: Thumbnail Engine 2.0
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §7 Thumbnail Engine

   이 Engine은 이미지를 생성하지 않는다. Canvas/AI 이미지 호출/PNG/SVG/HTML 렌더링을
   전혀 하지 않는다 — 오직 "어떻게 배치해야 하는가"를 결정하는 Blueprint Generator다.
   실제 렌더링은 기존 Thumbnail Studio(js/thumbnail-studio.js, 삭제/수정하지 않음)가
   이 Blueprint를 기본값으로 소비한다.

   입력은 두 가지뿐이다:
   - BrandProfile(읽기 전용): thumbnailPattern, layoutPreference, badgeTone, headlineTone,
     informationDensity, brandStrategy — 이 6개 속성만 읽는다. Brand Pack 이름
     (premium/studyNote/handwriting)으로는 어디서도 분기하지 않는다.
   - Marketing Copy Asset Pool(읽기 전용): headline, subheadline, badge, cta,
     metadata.promise — 이 값들을 그대로 배치할 뿐, 새 카피를 만들지 않는다.

   구현하지 않는 것: 이미지/Canvas/AI 이미지 생성, Sales Page 결정, Marketing Copy 수정,
   BrandProfile 수정. */

window.AtlasThumbnailEngine = window.AtlasThumbnailEngine || {};

(function(TE){

  /* docs/ATLAS_AI_ENGINE_SPECIFICATION.md §7에서 정의한 6개 Pattern. 이 목록 밖의
     값은 만들지 않는다. */
  var PATTERNS = ['Center Text','Icon Focus','Comparison','Left Image','Right Image','Top Banner'];
  TE.patterns = PATTERNS.slice();

  /* ── 1. Input Normalizer ──
     BrandProfile에서 허용된 6개 속성만, Marketing Copy에서 허용된 4개 카피 + Promise만
     뽑아 정리한다. 여기 없는 값(예: BrandProfile.ctaTone, MarketingCopy.benefits)은
     이 Engine 어디에서도 참조하지 않는다. */
  TE.inputNormalizer = function(brandProfile, marketingCopy){
    brandProfile = brandProfile || {};
    marketingCopy = marketingCopy || {};
    return {
      thumbnailPattern: brandProfile.thumbnailPattern || '',
      layoutPreference: brandProfile.layoutPreference || '',
      badgeTone: brandProfile.badgeTone || '',
      headlineTone: brandProfile.headlineTone || '',
      informationDensity: brandProfile.informationDensity || '',
      brandStrategy: brandProfile.brandStrategy || '',
      headline: marketingCopy.headline || '',
      subheadline: marketingCopy.subheadline || '',
      badge: marketingCopy.badge || '',
      cta: marketingCopy.cta || '',
      promise: (marketingCopy.metadata && marketingCopy.metadata.promise) || ''
    };
  };

  /* ── 2. Pattern Decision ──
     BrandProfile.thumbnailPattern을 우선 사용한다. 여기 없는 값이 들어오면(Never Guess)
     6개 Pattern 중 가장 중립적인 "Center Text"로 안전하게 대체한다 — 임의의 다른
     Pattern을 지어내지 않는다. */
  var PATTERN_BY_THUMBNAIL_PATTERN = {
    '비교형/숫자형': 'Comparison',
    '아이콘형': 'Icon Focus',
    '좌우이미지형': 'Left Image'
  };
  var NEUTRAL_FALLBACK_PATTERN = 'Center Text';
  TE.patternDecision = function(input){
    return PATTERN_BY_THUMBNAIL_PATTERN[input.thumbnailPattern] || NEUTRAL_FALLBACK_PATTERN;
  };

  /* ── 3. Layout Influence (layoutPreference를 함께 반영) ──
     Pattern은 그대로 두고, 텍스트 정렬/여백 비율/시각 우선순위만 layoutPreference로
     조정한다 — "layoutPreference를 함께 반영합니다"는 Pattern을 바꾸는 것이 아니라
     Pattern 안에서의 배치 디테일을 바꾸는 것으로 해석했다(Pattern은 thumbnailPattern이
     "우선"이라는 조건과 모순되지 않기 위함). */
  var LAYOUT_INFLUENCE = {
    '숫자중심':  { textAlignment:'center', negativeSpace:'small',  visualHierarchy:['badge','headline','cta'] },
    '텍스트중심': { textAlignment:'left',   negativeSpace:'large',  visualHierarchy:['headline','subheadline','cta'] },
    '목업중심':  { textAlignment:'left',   negativeSpace:'medium', visualHierarchy:['image','headline','cta'] }
  };
  var NEUTRAL_LAYOUT_INFLUENCE = { textAlignment:'center', negativeSpace:'medium', visualHierarchy:['headline','badge','cta'] };
  TE.layoutInfluence = function(input){
    return LAYOUT_INFLUENCE[input.layoutPreference] || NEUTRAL_LAYOUT_INFLUENCE;
  };

  /* ── 4. Position Decision (Pattern 기준) ── */
  var POSITION_BY_PATTERN = {
    'Comparison':  { headlinePosition:'top',    badgePosition:'top-left',    ctaPosition:'bottom' },
    'Icon Focus':  { headlinePosition:'center', badgePosition:'top-right',   ctaPosition:'bottom' },
    'Left Image':  { headlinePosition:'right',  badgePosition:'top-right',   ctaPosition:'bottom-right' },
    'Right Image': { headlinePosition:'left',   badgePosition:'top-left',   ctaPosition:'bottom-left' },
    'Center Text': { headlinePosition:'center', badgePosition:'top-left',   ctaPosition:'bottom' },
    'Top Banner':  { headlinePosition:'center', badgePosition:'top-center', ctaPosition:'bottom' }
  };
  TE.positionDecision = function(pattern){
    return POSITION_BY_PATTERN[pattern] || POSITION_BY_PATTERN[NEUTRAL_FALLBACK_PATTERN];
  };

  /* ── 5. Color/Background Strategy (brandStrategy 기준) ──
     BrandProfile.brandStrategy(Authority/Trust/Relationship) 값을 그대로 소문자로
     내린 것이 colorStrategy다 — Brand Pack 이름이 아니라 전략 값을 그대로 쓴다. */
  var BACKGROUND_STYLE_BY_STRATEGY = { Authority:'dark-premium', Trust:'light-clean', Relationship:'warm-soft' };
  TE.colorStrategyDecision = function(input){
    var strategy = input.brandStrategy;
    return {
      colorStrategy: strategy ? strategy.toLowerCase() : 'neutral',
      backgroundStyle: BACKGROUND_STYLE_BY_STRATEGY[strategy] || 'neutral'
    };
  };

  /* ── 6. Icon/Image Style ── */
  var ICON_STYLE_BY_BADGE_TONE = { '권위/한정':'line', '신뢰/근거':'outline', '친근/공감':'hand-drawn' };
  var IMAGE_STYLE_BY_DENSITY = { '높음':'minimal', '중간':'balanced', '낮음':'warm' };
  TE.iconImageStyleDecision = function(input){
    return {
      iconStyle: ICON_STYLE_BY_BADGE_TONE[input.badgeTone] || 'line',
      imageStyle: IMAGE_STYLE_BY_DENSITY[input.informationDensity] || 'balanced'
    };
  };

  /* ── 7. Text Weight (headlineTone 기준) ── */
  var TEXT_WEIGHT_BY_HEADLINE_TONE = { '단정적/전문가 톤':'bold', '설명적/근거 제시 톤':'regular', '대화체/친근 톤':'medium' };
  TE.textWeightDecision = function(input){
    return TEXT_WEIGHT_BY_HEADLINE_TONE[input.headlineTone] || 'regular';
  };

  /* ── 8. Highlight Words ──
     Marketing Copy Engine이 만든 Promise(입력으로 허용된 5개 값 중 하나)에서만 뽑는다 —
     Headline 전체를 재해석하거나 새 단어를 만들지 않고, 이미 있는 Promise 문자열을
     토큰으로 나눠 마지막 핵심 어구(보통 차별화 각도 부분) 최대 2개를 그대로 가져온다. */
  TE.highlightWordsDecision = function(input){
    if(!input.promise) return [];
    var tokens = input.promise.split(/[\s—,·]+/).filter(function(t){ return t && t.length>=2; });
    return tokens.slice(-2);
  };

  /* ── 9. Blueprint Builder ── */
  TE.blueprintBuilder = function(input, pattern, layoutInfluence, position, colorInfo, iconImage, textWeight, highlightWords){
    return {
      pattern: pattern,
      layout: input.layoutPreference,
      headline: input.headline,
      subheadline: input.subheadline,
      badge: input.badge,
      cta: input.cta,
      headlinePosition: position.headlinePosition,
      badgePosition: position.badgePosition,
      ctaPosition: position.ctaPosition,
      textAlignment: layoutInfluence.textAlignment,
      textWeight: textWeight,
      iconStyle: iconImage.iconStyle,
      imageStyle: iconImage.imageStyle,
      colorStrategy: colorInfo.colorStrategy,
      backgroundStyle: colorInfo.backgroundStyle,
      highlightWords: highlightWords,
      negativeSpace: layoutInfluence.negativeSpace,
      visualHierarchy: layoutInfluence.visualHierarchy,
      metadata: {
        thumbnailPatternSource: input.thumbnailPattern,
        layoutPreferenceSource: input.layoutPreference,
        brandStrategy: input.brandStrategy,
        promise: input.promise,
        timestamp: Date.now()
      }
    };
  };

  /* ── Reason Generator ── */
  TE.reasonGenerator = function(input, blueprint){
    var reasons = [];
    reasons.push('BrandProfile.thumbnailPattern("'+input.thumbnailPattern+'")에 따라 Pattern을 "'+blueprint.pattern+'"로 정했습니다.');
    reasons.push('BrandProfile.layoutPreference("'+input.layoutPreference+'")를 반영해 Badge 위치를 "'+blueprint.badgePosition+'"로 정했습니다.');
    reasons.push('Pattern("'+blueprint.pattern+'")과 layoutPreference를 함께 반영해 Headline 배치를 "'+blueprint.headlinePosition+'"로 정했습니다.');
    reasons.push('BrandProfile.brandStrategy("'+input.brandStrategy+'")에 따라 Color Strategy를 "'+blueprint.colorStrategy+'"로 정했습니다.');
    reasons.push(blueprint.highlightWords.length
      ? ('Promise("'+input.promise+'")의 핵심 어구에서 강조 단어 "'+blueprint.highlightWords.join(', ')+'"를 선택했습니다.')
      : 'Promise가 비어 있어 강조 단어를 선택하지 않았습니다.');
    return reasons;
  };

  /* ── Orchestrator ──
     BrandProfile과 Marketing Copy 모두 읽기 전용으로만 쓰고 수정하지 않는다. 완성된
     Blueprint에 대한 근거를 Reasoning Service에 한 번 기록한다. */
  TE.run = function(brandProfile, marketingCopy){
    if(!brandProfile || !marketingCopy) return null;
    var input = TE.inputNormalizer(brandProfile, marketingCopy);
    var pattern = TE.patternDecision(input);
    var layoutInfluence = TE.layoutInfluence(input);
    var position = TE.positionDecision(pattern);
    var colorInfo = TE.colorStrategyDecision(input);
    var iconImage = TE.iconImageStyleDecision(input);
    var textWeight = TE.textWeightDecision(input);
    var highlightWords = TE.highlightWordsDecision(input);
    var blueprint = TE.blueprintBuilder(input, pattern, layoutInfluence, position, colorInfo, iconImage, textWeight, highlightWords);
    var reasons = TE.reasonGenerator(input, blueprint);

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source:'ThumbnailEngine',
        pattern: blueprint.pattern,
        badgePosition: blueprint.badgePosition,
        headlinePosition: blueprint.headlinePosition,
        colorStrategy: blueprint.colorStrategy,
        highlightWords: blueprint.highlightWords,
        reasons: reasons,
        timestamp: blueprint.metadata.timestamp
      });
    }

    return blueprint;
  };

})(window.AtlasThumbnailEngine);
