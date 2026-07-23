/* brand-strategy-engine.js — Milestone 3.2 Phase 2: Brand Strategy Engine
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §2 Brand Strategy Engine

   내부 구조는 사용자가 제안한 확장 가능한 파이프라인을 그대로 따른다:

     Input → Signal Extractor → Score Calculator → Decision Engine
           → Confidence Calculator → Reason Generator → Reasoning Service.reason()

   각 단계는 독립 함수로 분리되어 있다 — 나중에 실제 AI 모델을 붙이더라도
   Signal Extractor만 교체하면 되고, Score Calculator/Decision Engine/Confidence
   Calculator/Reason Generator는 그대로 재사용할 수 있어야 한다는 것이 이 구조의
   목적이다. 이번 Phase는 규칙 기반(rule-based)으로만 구현하며, 새로운 AI 호출은
   전혀 추가하지 않는다 — 여기서 쓰는 입력(제목 후보의 type/scores, 자료 분석
   결과의 topic/target/pain/angle)은 모두 기존 화면(Title Studio)이 이미 만들어
   둔 데이터이고, 이 Engine은 그 데이터를 규칙에 따라 재조합할 뿐이다.

   2026-07 보정: Confidence를 "선택 전략 점수 / 전체 점수 합"만으로 계산하면 신호가
   단 하나만 있어도(다른 전략이 전부 0이면) 100%가 나오는 문제가 있었다. 이제
   Confidence는 (1) 실제로 확보된 증거의 절대량(Evidence Strength)과 (2) 1위/2위
   전략의 점수 차이(Decision Margin)를 함께 반영한다. 또한 신호가 전혀 없을 때
   Trust로 임의 대체하던 것도 Never Guess 위반이라 제거했다 — 이제 strategy는
   `null`이 될 수 있고, 그 경우 Planner는 반드시 사용자에게 직접 선택하게 한다.

   구현하지 않는 것: Marketing Copy Engine, Thumbnail Engine, Sales Page Engine,
   Learning Engine, Session Memory, 새로운 AI 자동 생성. */

window.AtlasBrandStrategyEngine = window.AtlasBrandStrategyEngine || {};

(function(BSE){

  /* docs/ATLAS_AI_ENGINE_SPECIFICATION.md §2 "Brand Strategy → Brand Pack 매핑" 표.
     이 세 값(Authority/Trust/Relationship) 밖의 전략은 만들지 않는다. */
  var STRATEGIES = ['Authority','Trust','Relationship'];
  var STRATEGY_TO_BRAND_PACK = { Authority:'premium', Trust:'studyNote', Relationship:'handwriting' };
  BSE.strategyToBrandPackId = function(strategy){ return STRATEGY_TO_BRAND_PACK[strategy] || null; };

  /* 신호 판단 키워드의 기본 축은 design.md/atlas-business-bible이 이미 정의한 Brand
     Pack별 "추천 분야"(design-system.js의 theme.recommendedFor)다. 여기에 각 전략의
     사업적 의미(atlas-business-bible: Authority=고가 정당화, Trust=신뢰 구축,
     Relationship=팬 만들기)에 직접 속하는 동의어를 보태 실제 입력 문장을 더 안정적으로
     인식하게 한다 — 새로운 분류 기준이 아니라, 이미 승인된 세 전략의 의미를 더 촘촘히
     인식하기 위한 사전 확장이다. */
  var FALLBACK_RECOMMENDED_FOR = { premium:'AI · 부업 · 재테크 · 비즈니스', studyNote:'공부 · 자기계발 · 육아 · 건강', handwriting:'다이어리 · 에세이 · 루틴 기록' };
  function keywordsFor(brandPackId){
    var theme=(typeof AtlasDesignSystem!=='undefined'&&AtlasDesignSystem.getTheme)?AtlasDesignSystem.getTheme(brandPackId):null;
    var text=(theme&&theme.recommendedFor)||FALLBACK_RECOMMENDED_FOR[brandPackId]||'';
    return text.split('·').map(function(s){return s.trim();}).filter(Boolean);
  }
  var EXTRA_STRATEGY_KEYWORDS = {
    Authority: ['투자','전문가','고가','실적','수익','성장','커리어','창업','프리미엄'],
    Trust: ['학습','체크리스트','단계별','초보자','습관','정리','근거','검증'],
    Relationship: ['루틴','기록','경험','팔로워','공감','감성','위로','일상']
  };
  var STRATEGY_KEYWORDS = {};
  STRATEGIES.forEach(function(strategy){
    STRATEGY_KEYWORDS[strategy] = keywordsFor(STRATEGY_TO_BRAND_PACK[strategy]).concat(EXTRA_STRATEGY_KEYWORDS[strategy]);
  });
  BSE.strategyKeywords = STRATEGY_KEYWORDS;

  /* 제목 후보는 이미 자체 AI 분석에서 유형(궁금증형/문제공감형/실전형/검색형/
     신뢰형/프리미엄형)을 분류해 둔 상태다 — 이 Engine은 그 기존 분류를 시장
     포지셔닝 신호 하나로 추가 반영할 뿐, 새로 분류하지 않는다. */
  var TITLE_TYPE_TO_STRATEGY = { '프리미엄형':'Authority', '신뢰형':'Trust', '실전형':'Trust', '검색형':'Trust', '문제공감형':'Relationship', '궁금증형':'Relationship' };
  BSE.titleTypeToStrategy = TITLE_TYPE_TO_STRATEGY;
  var TITLE_TYPE_MARKET_BONUS = 2;

  function zeroScores(){ return { Authority:0, Trust:0, Relationship:0 }; }
  function keywordScore(text){
    var scores=zeroScores();
    if(!text) return scores;
    STRATEGIES.forEach(function(strategy){
      STRATEGY_KEYWORDS[strategy].forEach(function(kw){ if(kw && text.indexOf(kw)>-1) scores[strategy]++; });
    });
    return scores;
  }
  function clamp01(n){ return Math.max(0, Math.min(1, n)); }

  /* ── 1. Signal Extractor ──
     상품 분석/시장 분석/타겟 분석 세 가지를, 실제로 화면에 존재하는 데이터
     (Title Studio의 analysis.topic/target/pain/angle, 선택된 제목 후보의
     type/scores)에서 뽑아 Category/Market/Target Signal 세 벡터로 만든다. */
  BSE.signalExtractor = function(input){
    input = input || {};
    var categorySignal = keywordScore([input.topic, input.angle].filter(Boolean).join(' '));
    var marketSignal = keywordScore([input.pain, input.sourceSummary].filter(Boolean).join(' '));
    if(input.titleType && TITLE_TYPE_TO_STRATEGY[input.titleType]){
      marketSignal[TITLE_TYPE_TO_STRATEGY[input.titleType]] += TITLE_TYPE_MARKET_BONUS;
    }
    var targetSignal = keywordScore(input.target||'');
    return { category:categorySignal, market:marketSignal, target:targetSignal };
  };

  /* ── 2. Score Calculator ──
     세 Signal을 하나의 전략별 점수로 합산한다. 가중치는 Constitution Article 5
     (Product First — "무엇을 만드는가"가 가장 먼저)를 따라 Category Signal(상품이
     무엇인지)에 가장 큰 비중을, Target Signal(누구에게)에 가장 작은 비중을 둔다. */
  var WEIGHTS = { category:0.5, market:0.3, target:0.2 };
  BSE.scoreCalculator = function(signals){
    var scores=zeroScores();
    STRATEGIES.forEach(function(strategy){
      scores[strategy] = (signals.category[strategy]*WEIGHTS.category)
        + (signals.market[strategy]*WEIGHTS.market)
        + (signals.target[strategy]*WEIGHTS.target);
    });
    return scores;
  };

  /* ── Confidence 정규화 상수 (매직 넘버를 여기 한 곳에 모은다) ──
     MAX_*_EVIDENCE는 "이 정도 키워드/보너스가 모이면 해당 신호원은 더 늘어나도
     의미가 크지 않다"고 보는 실무적 상한이다. 이 상한 기준으로 실제 점수를
     0~1로 정규화한 뒤 clamp하므로, 상한을 넘는 극단적 입력도 안전하게 1로
     수렴한다(overflow로 확신도가 100%를 넘거나 깨지지 않는다). */
  var MAX_CATEGORY_EVIDENCE = 3;
  var MAX_MARKET_EVIDENCE = 4; // 키워드 최대 2개 + titleType 일치 보너스(+2) 가정
  var MAX_TARGET_EVIDENCE = 2;
  var MAX_PLAUSIBLE_WEIGHTED_SCORE = (MAX_CATEGORY_EVIDENCE*WEIGHTS.category) + (MAX_MARKET_EVIDENCE*WEIGHTS.market) + (MAX_TARGET_EVIDENCE*WEIGHTS.target);

  var CONFIDENCE_WEIGHT_EVIDENCE = 0.6;
  var CONFIDENCE_WEIGHT_MARGIN = 0.4;

  /* ── Brand Pack 자동 선택(원클릭 승인) 임계치 ──
     아래 네 조건을 모두 만족해야만 AI Planner가 후보를 자동 선택한다. confidence
     하나만으로 판단하지 않는다 — 증거가 약하거나(evidenceStrength), 1위/2위 전략이
     팽팽하면(decisionMargin) confidence가 우연히 임계값을 넘더라도 자동 선택하지
     않는다. */
  var AUTO_SELECT_MIN_CONFIDENCE = 60;
  var AUTO_SELECT_MIN_EVIDENCE_STRENGTH = 0.5;
  var AUTO_SELECT_MIN_DECISION_MARGIN = 0.35;
  BSE.autoSelectThresholds = {
    minConfidence: AUTO_SELECT_MIN_CONFIDENCE,
    minEvidenceStrength: AUTO_SELECT_MIN_EVIDENCE_STRENGTH,
    minDecisionMargin: AUTO_SELECT_MIN_DECISION_MARGIN
  };

  /* ── 3. Decision Engine ──
     가장 점수가 높은 전략 하나를 고른다. 아무 신호도 없으면(전부 0) 더 이상 임의로
     하나를 만들어내지 않는다(Never Guess) — strategy를 null로 두고 Confidence
     Calculator/Reason Generator가 "판단 보류" 경로를 타게 한다. */
  BSE.decisionEngine = function(scores){
    var sorted = STRATEGIES.slice().sort(function(a,b){ return scores[b]-scores[a]; });
    var total = STRATEGIES.reduce(function(sum,s){ return sum+scores[s]; }, 0);
    if(total<=0) return { strategy:null, runnerUp:null, noSignal:true };
    return { strategy:sorted[0], runnerUp:sorted[1], noSignal:false };
  };

  /* ── 4. Confidence Calculator ──
     evidenceStrength = 선택된 전략의 점수를 "완전한 증거"기준(MAX_PLAUSIBLE_WEIGHTED_SCORE)
     대비 얼마나 채웠는지(0~1). decisionMargin = 1위와 2위 점수 차이를 같은 기준으로
     정규화한 값(0~1) — 1위/2위가 비슷하면 0에 가까워진다. confidence는 이 둘의
     가중 평균이므로, 신호가 하나뿐이라 1위/2위 차이는 크더라도(margin↑) 증거 자체가
     약하면(evidence↓) 100%에 도달하지 못한다. 신호가 전혀 없으면(noSignal) 확신할
     근거가 없다는 뜻이므로 전부 0으로 둔다 — 낮은 숫자를 숨기지 않는다(Never Hide). */
  BSE.confidenceCalculator = function(scores, decision){
    if(decision.noSignal) return { confidence:0, evidenceStrength:0, decisionMargin:0 };
    var topScore = scores[decision.strategy];
    var secondScore = decision.runnerUp ? scores[decision.runnerUp] : 0;
    var evidenceStrength = clamp01(topScore/MAX_PLAUSIBLE_WEIGHTED_SCORE);
    var decisionMargin = clamp01((topScore-secondScore)/MAX_PLAUSIBLE_WEIGHTED_SCORE);
    var confidence = Math.round((evidenceStrength*CONFIDENCE_WEIGHT_EVIDENCE + decisionMargin*CONFIDENCE_WEIGHT_MARGIN)*100);
    return { confidence:confidence, evidenceStrength:evidenceStrength, decisionMargin:decisionMargin };
  };

  var HOLD_REASON_TEXT = '근거 부족으로 자동 판단 보류';

  /* ── 5. Reason Generator ──
     Decision Engine과 Confidence Calculator가 이미 내린 결론을 "왜 그렇게
     됐는지" 사람이 읽을 수 있는 문장으로만 바꾼다 — 여기서 새로운 판단을
     추가하지 않는다. */
  BSE.reasonGenerator = function(input, signals, scores, decision, conf){
    var reasons=[];
    if(decision.noSignal){
      reasons.push(HOLD_REASON_TEXT);
      return reasons;
    }
    var strategy=decision.strategy;
    if(signals.category[strategy]>0){
      reasons.push('상품 주제/차별화 각도에서 "'+STRATEGY_KEYWORDS[strategy].filter(function(kw){return (input.topic||'').indexOf(kw)>-1||(input.angle||'').indexOf(kw)>-1;}).join(', ')+'" 신호가 감지되어 Category Signal이 '+strategy+' 쪽으로 기울었습니다.');
    }
    if(input.titleType && TITLE_TYPE_TO_STRATEGY[input.titleType]===strategy){
      reasons.push('선택한 제목 유형("'+input.titleType+'")이 '+strategy+' 포지셔닝과 일치해 Market Signal이 강화되었습니다.');
    }
    if(signals.target[strategy]>0){
      reasons.push('타겟 독자 설명에서도 '+strategy+' 관련 신호가 확인되어 Target Signal이 더해졌습니다.');
    }
    if(!reasons.length){
      reasons.push(strategy+' 전략의 점수가 근소한 차이로 가장 높아 선택되었습니다.');
    }
    reasons.push('Evidence Strength '+Math.round(conf.evidenceStrength*100)+'%, Decision Margin '+Math.round(conf.decisionMargin*100)+'%로 계산되어 Confidence '+conf.confidence+'%가 산출되었습니다.');
    if(conf.evidenceStrength<AUTO_SELECT_MIN_EVIDENCE_STRENGTH){
      reasons.push('확보된 증거가 자동 선택 기준(Evidence Strength '+Math.round(AUTO_SELECT_MIN_EVIDENCE_STRENGTH*100)+'% 이상)에 못 미쳐 Brand Pack이 자동 선택되지 않았습니다.');
    } else if(conf.decisionMargin<AUTO_SELECT_MIN_DECISION_MARGIN){
      reasons.push('2위 전략("'+decision.runnerUp+'")과 점수 차이가 크지 않아(Decision Margin 기준 미달) Brand Pack이 자동 선택되지 않았습니다.');
    }
    return reasons;
  };

  /* ── Orchestrator ──
     위 다섯 단계를 순서대로 실행하고, 완성된 BrandStrategyResult를 Reasoning
     Service에 정확히 한 번만 기록한다(§3 "Reason() 한 번만 호출"). */
  BSE.run = function(input){
    var signals = BSE.signalExtractor(input);
    var scores = BSE.scoreCalculator(signals);
    var decision = BSE.decisionEngine(scores);
    var conf = BSE.confidenceCalculator(scores, decision);
    var reasons = BSE.reasonGenerator(input, signals, scores, decision, conf);

    var strategy = decision.noSignal ? null : decision.strategy;
    var recommendedBrandPackId = decision.noSignal ? null : STRATEGY_TO_BRAND_PACK[strategy];
    var holdReason = decision.noSignal ? HOLD_REASON_TEXT : null;
    var autoRecommended = !decision.noSignal
      && conf.confidence>=AUTO_SELECT_MIN_CONFIDENCE
      && conf.evidenceStrength>=AUTO_SELECT_MIN_EVIDENCE_STRENGTH
      && conf.decisionMargin>=AUTO_SELECT_MIN_DECISION_MARGIN;

    var result = {
      strategy: strategy,
      recommendedBrandPackId: recommendedBrandPackId,
      confidence: conf.confidence,
      evidenceStrength: conf.evidenceStrength,
      decisionMargin: conf.decisionMargin,
      autoRecommended: autoRecommended,
      holdReason: holdReason,
      reasons: reasons,
      signals: { category:signals.category, market:signals.market, target:signals.target, scores:scores },
      timestamp: Date.now()
    };

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source:'BrandStrategyEngine',
        strategy: result.strategy,
        confidence: result.confidence,
        evidenceStrength: result.evidenceStrength,
        decisionMargin: result.decisionMargin,
        signals: result.signals,
        autoRecommended: result.autoRecommended,
        holdReason: result.holdReason,
        reasons: result.reasons,
        timestamp: result.timestamp
      });
    }

    return result;
  };

})(window.AtlasBrandStrategyEngine);
