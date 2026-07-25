/* ai-visual-prompt-engine.js — Milestone 3.2 Phase 11: AI Visual Prompt Engine
   Phase 11.1: Visual Prompt Decision Quality Fix
   Phase 11.2: Prompt Quality Calibration
   Phase 11.3: Variant-Compatible Art Direction Fix
   Phase 11.4: Sales Page Prompt Compatibility & Language Fix
   Phase 11.5: Consistency Contract & Safe Area Final Fix
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md, Phase 11/11.1/11.2/11.3/11.4/11.5 사용자 스펙(2026-07)

   Phase 11.5에서 바뀐 것(Thumbnail Prompt의 Phase 11.3 결정과 Negative Prompt의
   Phase 11.4 결정은 전혀 건드리지 않았다):

   14) Consistency Rules와 Sales Page 역할별 effectiveArtDirection이 서로
       모순되던 문제를 해결했다. 이전 forbiddenChanges에는 "일러스트
       스타일(artDirection)을 장마다 바꾸지 않는다"가 있었는데, Phase 11.4부터
       Sales Page 9장은 역할에 맞게 서로 다른 effectiveArtDirection을 정당하게
       사용한다 — 이 두 규칙이 정면으로 충돌했다. 이제 "스타일은 역할에 따라
       바뀔 수 있지만, 같은 상품으로 보이도록 Visual DNA(주인공 외형·핵심
       팔레트·조명·목업 디자인·재질/질감·카메라 무드·감정 톤)는 유지한다"는
       구조로 재정의했다(consistencyRulesBuilder의 visualDNA/
       allowedArtDirectionChanges/forbiddenChanges, buildConsistencyCarryover).

   15) Sales Page Prompt 9개 각각에 consistencyCarryover 배열과 구조화된
       safeArea(anchor/proportion/approxPercent) 메타데이터를 추가했다 —
       향후 이미지 생성 API 레이어가 Prompt 본문을 파싱하지 않고도 일관성
       유지 조건을 바로 사용할 수 있도록 recurringPalette/recurringLighting/
       recurringSubject/recurringProductMockup도 각 Prompt 객체에 함께
       실었다.

   16) Safe Area 비율을 역할별 고정 anchor/proportion 표(모두 50% 이하,
       대부분 third~40 percent)로 다시 설계했다 — layoutStrategy에 따라
       Contents/Recommended For처럼 좌/우 두 옵션이 있는 역할만 선택이
       갈린다. "spanning about a two-thirds"/"a half" 같은 비문법적 구절을
       전부 제거하고 "spanning about one-third"/"spanning roughly 35
       percent"/"the right 40 percent" 같은 문법적으로 자연스러운 구절만
       사용한다.

   Phase 11.4에서 바뀐 것(Thumbnail Prompt의 baseArtDirection/effectiveArtDirection/
   artDirectionReason/Variant 호환도 결정은 전혀 건드리지 않았다 — VARIANT_STYLE_
   COMPATIBILITY, effectiveArtDirectionResolver의 동작은 Phase 11.3과 동일):

   9) Sales Page 9개 Role도 Thumbnail Variant와 같은 방식(호환도 표로 후보를
      거르고, 그 안에서 카테고리 적합도가 가장 높은 스타일을 고르는 2단계
      결정)으로 effectiveArtDirection을 갖는다. 이전에는 대표 스타일
      (baseArtDirection) 하나가 9장 전부에 그대로 적용되어 "추상적 은유
      장면 + realistic product mockup scene" 같은 충돌이 있었다. 결정
      알고리즘 자체(resolveEffectiveArtDirection)는 Thumbnail Variant와
      공유하고, Role별 호환도 표(ROLE_STYLE_COMPATIBILITY)만 새로 정의했다.

   10) Safe Area 문장 모순 제거 — 이전 버전은 anchor(위치: upper/lower/
       center)와 ratio(비율) 문구를 독립된 두 구절로 이어 붙였는데, ratio
       문구가 always "lower..."로 고정돼 있어 anchor가 upper/center일 때
       "upper portion... (roughly the lower two-thirds...)" 같은 모순이
       생겼다. 이제 위치와 비율을 하나의 일관된 구절로 합성한다("the upper
       third" / "the lower two-thirds" / "a central horizontal band
       spanning about a third of the frame").

   11) "Rendered as a X." 템플릿이 관사/가산명사 규칙에 안 맞는 두 스타일
       ("clean product advertising", "minimal conceptual art")에 대해서만
       예외 템플릿을 쓴다("Designed in a clean product-advertising style."
       / "Rendered as minimal conceptual art.") — 이 템플릿 함수는 Thumbnail/
       Sales Page 둘 다 공유하지만, 어떤 스타일이 선택되는지(결정 로직) 자체는
       바꾸지 않는다.

   12) Negative Prompt 카테고리 누출 방지 — secondaryCategories 중 우연히
       키워드 하나만 매칭된 "약한 오탐"(예: "감정 일기와 루틴 기록법"의
       self-development, "루틴" 한 단어뿐)은 그 카테고리의 추가 금지 항목을
       병합하지 않는다(evidenceSources 2개 이상 또는 매칭 키워드 2개 이상일
       때만 병합 — 예: "병원 구매담당자 실무 가이드"의 medical은 topic/
       targetAudience 두 필드에서 매칭되어 정당하게 병합된다). 또한
       self-development 카테고리 자체에서 education 전용 개념이었던 "exam
       cheating imagery"를 제거했다(애초에 의미상 맞지 않았다).

   13) Negative Prompt 중복 제거 — "fake medical certification"이 포함되면
       base 목록의 일반 표현 "fake certification"을 제거해 겹치지 않게 한다
       (NEGATIVE_SUPERSEDES 테이블, 문자열 기준 정확한 매칭).

   이 Engine은 이미지를 생성하지 않는다. HTML/CSS/SVG로 비주얼을 그리지도 않는다.
   외부 이미지 생성 API도 호출하지 않는다 — 오직 Atlas가 이미 갖고 있는 데이터를
   분석해, 고품질 이미지 생성 모델에 그대로 전달할 수 있는 구조화된 자연어
   프롬프트를 만드는 "이미지 생성 직전 단계"만 담당한다. 입력 객체는 전부 읽기
   전용이며 이 파일 어디에서도 수정하지 않는다.

   내부 구조(Phase 11부터 동일하게 유지): Input Normalizer → Visual Strategy
   Builder → Subject Director → Composition Director → Style Director
   → Lighting/Color Director → Text Safety Director → Negative Prompt Builder
   → Thumbnail Prompt Builder → Sales Page Prompt Builder → Prompt Variant
   Builder(평가) → Reasoning Service

   Phase 11.2에서 바뀐 것(점수/문장 품질만 교정 — 분류·스타일·평가의 판단 로직
   자체는 Phase 11.1 그대로 유지):

   1) 점수 범위 정규화 — 모든 criterion을 0~10으로 clamp한다(이전 버전은
      visualDistinctiveness가 11까지 나올 수 있었다). Variant 점수는
      {rawScore, normalizedScore, maxScore:100} 구조로 보존한다(criterion을
      전부 0~10으로 clamp한 뒤의 합이므로 rawScore와 normalizedScore는 항상
      같다 — 별도 정규화가 필요 없을 만큼 애초에 상한을 넘지 않게 만들었다).
      Style 점수는 원래 상한이 없는 내적(dot product) 방식이라 별도로
      0~100 정규화가 필요하다 — 모듈 로드 시 실제 STYLE_PROFILE×CATEGORY_
      PROFILE×전략×패턴×밀도 조합 전체에서 이론적 최댓값을 한 번 계산해
      normalizedScore = round(rawScore/최댓값*100)로 만든다(매직 넘버 없음).

   2) Category Confidence 보정 — evidenceSources(topic/targetAudience/
      sourceSummary/marketingCopy/thumbnailBlueprint 중 실제로 매칭이 있었던
      필드)를 기록하고, 독립 증거원 개수에 따라 상한을 둔다: 1개 이하 → 0.94,
      2개 → 0.95, 3개 이상(+키워드 4개 이상) → 0.99. confidence는 이 상한을
      절대 넘지 않으며, 왜 그 상한이 적용됐는지 confidenceNote로 남긴다(Never
      Hide). 이 Engine은 사용자가 카테고리를 직접 선택하는 경로가 없으므로
      1.0은 이 파이프라인에서 나오지 않는다(§2 "1.0은 사용자가 명시적으로
      선택한 경우"에 해당하는 입력 자체가 없음 — 정직하게 상한 0.99로 캡).

   3) Style/Variant 문장 결합 — "premium infographic illustration close-up
      product-advertising composition" 같은 기계적 연결을 없앴다. Composition
      (변형의 구도·초점)과 Art Direction(스타일)을 서로 다른 어휘 집합으로
      완전히 분리했다: Composition 문구는 스타일 이름을 전혀 포함하지 않는
      variant 전용 구도 표현만 쓰고, Art Direction은 "Rendered as a {style}."
      한 문장으로만 스타일을 명시한다 — 스타일 이름이 프롬프트 전체에서 정확히
      한 곳에만 등장하므로 구조적으로 충돌/중복이 발생하지 않는다.

   4) Prompt 문장 순서 — 모든 Prompt를 Main subject → Composition →
      Environment → Art direction → Palette/Lighting → Emotional goal →
      Safe area → Output size → Text restriction 9단계 고정 순서로 조립한다.
      Safe Area 문구와 "No embedded text" 문구는 각각 정확히 1회만 등장하도록
      Text Safety Director의 문장에서 "No embedded text" 접미사를 제거하고,
      그 표현은 9단계(Text restriction)에서만 담당한다.

   5) Negative Prompt 정리 — 공통 18개는 유지하되 카테고리별 추가 항목의
      표현이 서로 겹치지 않도록 정리했다(예: medical은 base의 "fake
      certification"과 중복되지 않게 "unsafe medical claims"만 추가).

   Phase 11.3에서 바뀐 것(Variant-Compatible Art Direction Fix):

   6) 주제 전체의 대표 스타일(baseArtDirection = strategy.artDirection) 하나를
      5개 Thumbnail Variant 전부에 그대로 재사용하면 "Bold Minimal
      Advertising"(단일 실루엣)에 "realistic product mockup scene"(사실적
      목업 촬영)이 붙는 등 의미 충돌이 생겼다. 이제 각 Variant는 자신만의
      effectiveArtDirection을 갖는다: Variant-Style 호환도 표(0~10, 구조적
      고정값)로 먼저 의미상 맞지 않는 스타일을 걸러내고(threshold 6), 그
      안에서 카테고리·BrandStrategy·Pattern·Density 기준 점수(styleDirector가
      이미 계산한 normalizedScore)가 가장 높은 스타일을 선택한다 — 하드코딩된
      1:1 매핑이 아니라 "의미상 호환되는 것들 중 이 주제에 가장 잘 맞는 것"을
      고르는 2단계 결정이다. 각 Thumbnail Prompt는 baseArtDirection/
      effectiveArtDirection/artDirectionReason을 함께 노출하고, 실제 Prompt
      문장에는 effectiveArtDirection만 사용한다. Sales Page Prompt는 이번
      Phase 범위 밖이라(사용자 스펙이 "Thumbnail Variant"로 명시) 대표 스타일
      (baseArtDirection)을 그대로 유지한다.

   7) Medical Negative Prompt 보강 — professional-operations가 주 카테고리이고
      medical이 2차 후보인 주제에서도 medical의 안전 항목이 반드시 포함되도록,
      negativePromptBuilder가 primaryCategory뿐 아니라 secondaryCategories의
      추가 항목까지 함께 병합한다(중복 제거).

   8) confidenceNote 강화 — 상한 수치만 말하지 않고 evidenceSources 개수,
      evidenceStrength, decisionMargin, 그리고 최종 confidence가 왜 그 값이
      됐는지(상한에 걸렸는지, 2위 카테고리와의 격차가 좁았는지)를 문장으로
      설명한다.

   구현하지 않는 것(이전 Phase와 동일): 실제 이미지 생성 API 호출, Claude
   Design 자동화, 외부 이미지 생성 API, Atlas Overlay Renderer(다음 Phase),
   BrandProfile/Marketing Copy/Blueprint 수정, 기존 Renderer 삭제/변경. */

window.AtlasAIVisualPromptEngine = window.AtlasAIVisualPromptEngine || {};

(function(AVPE){

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
  function clamp10(n){ return clamp(Math.round(n), 0, 10); }
  function clamp01(n){ return Math.max(0, Math.min(1, n)); }
  function cap1(s){ return s ? (s.charAt(0).toUpperCase()+s.slice(1)) : s; }

  /* ══════════════════════════════════════════════════════════════
     0. 카테고리 체계 — 14개 + neutral (Phase 11.1과 동일)
     ══════════════════════════════════════════════════════════════ */
  var CATEGORY_KEYS = ['finance','business','technology','health','medical','parenting','education','lifestyle','household','energy','emotional','self-development','professional-operations'];

  var CATEGORY_KEYWORDS = {
    finance: ['재테크','투자','금융','부동산','주식','경제','창업','부업','자산','저축','대출','펀드','수익'],
    business: ['비즈니스','마케팅','영업','경영','스타트업','브랜딩','사업','매출','고객전략'],
    technology: ['기술','소프트웨어','프로그래밍','코딩','개발','디지털','챗봇','인공지능','자동화','앱개발'],
    health: ['건강','헬스','운동','영양','수면','면역','웰빙'],
    medical: ['병원','의료','진료','환자','의사','간호','처방','진단'],
    parenting: ['육아','아이','부모','임신','출산','유아','자녀'],
    education: ['공부','학습','시험','자격증','어학','영어','수능','교육','강의'],
    lifestyle: ['라이프스타일','취미','여행','인테리어','패션','뷰티','일상'],
    household: ['살림','가계','생활비','가전','청소','정리정돈','주거','수도요금','가스요금','1인 가구','1인가구'],
    energy: ['전기요금','에너지','절약','전력','냉방','난방','전기세'],
    emotional: ['감성','에세이','일기','다이어리','힐링','위로','감정'],
    'self-development': ['자기계발','습관','목표','동기부여','생산성','시간관리','루틴'],
    'professional-operations': ['실무','담당자','구매','조달','운영','프로세스','업무','매뉴얼','가이드','체크리스트']
  };

  /* subject/environment/mockup/metaphor/boldSymbol/persona/problem/result —
     전부 특정 개인·브랜드를 지칭하지 않는 일반 장면 묘사. */
  var CATEGORY_LIBRARY = {
    finance: {
      subject: 'a Korean office worker reviewing a side-income roadmap on a laptop',
      environment: 'a tidy desk in a home office with soft evening light',
      mockup: 'an ebook cover mockup beside an organized weekly checklist notepad',
      metaphor: 'a rising staircase made of soft coin-toned light steps leading upward into the distance',
      boldSymbol: 'a single ascending bar-chart silhouette',
      persona: 'a busy office worker looking for extra income after work',
      problem: 'a quiet moment of financial stress, reviewing a shrinking budget with a concerned expression',
      result: 'a relaxed moment enjoying steady extra income and financial breathing room'
    },
    business: {
      subject: 'a professional presenting a business growth plan in a modern office',
      environment: 'a minimal office space with soft directional light',
      mockup: 'a business playbook beside a growth-checklist mockup',
      metaphor: 'a single steady upward growth line rendered in soft architectural light',
      boldSymbol: 'a single growth-line-and-briefcase silhouette',
      persona: 'a small business owner seeking practical growth strategy',
      problem: 'a stressed moment facing an unclear growth strategy amid scattered plans',
      result: 'a composed moment presenting a clear, structured growth plan'
    },
    technology: {
      subject: 'a professional working alongside an abstract digital-assistant interface on a laptop',
      environment: 'a minimal workspace with cool-toned ambient light',
      mockup: 'a workflow-diagram beside a setup-guide checklist mockup',
      metaphor: 'a glowing network of connected nodes forming a clear guiding path',
      boldSymbol: 'a single connected-node-network silhouette',
      persona: 'a professional exploring practical technology tools for daily work',
      problem: 'a confused moment facing too many unfamiliar tools or settings at once',
      result: 'an efficient moment using one clear, simple workflow with ease'
    },
    health: {
      subject: 'an adult practicing a simple home health routine, stretching or checking a wellness tracker',
      environment: 'a bright home wellness nook with natural light and a yoga mat',
      mockup: 'a wellness journal beside a habit-tracking checklist mockup',
      metaphor: 'a sunrise breaking over a calm horizon, symbolizing renewed energy',
      boldSymbol: 'a single pulse-line-and-heart silhouette',
      persona: 'a health-conscious adult balancing work and wellness',
      problem: 'feeling low-energy and inconsistent with basic health habits, a slightly slouched posture',
      result: 'a refreshed moment stretching with a relaxed, confident posture'
    },
    medical: {
      subject: 'a healthcare or administrative professional reviewing patient-care or hospital operations materials at a desk',
      environment: 'a well-organized clinical or hospital administrative office with calm lighting',
      mockup: 'a procedure checklist beside a reference-guide mockup',
      metaphor: 'a steady cross-shaped light mark symbolizing careful, reliable care',
      boldSymbol: 'a single medical-cross-and-clipboard silhouette',
      persona: 'a hospital operations professional seeking a clear, reliable reference',
      problem: 'a stressed moment facing unclear or inconsistent procedures without a clear reference',
      result: 'a composed moment following a clear, well-organized reference process'
    },
    parenting: {
      subject: 'a parent gently caring for a young child at home',
      environment: 'a soft-lit living room with parenting essentials nearby',
      mockup: 'a parenting checklist beside a printable daily-routine chart mockup',
      metaphor: 'two intertwined soft light shapes representing a parent and child walking forward together',
      boldSymbol: 'a single heart-and-hand silhouette',
      persona: 'a first-time parent seeking clear, reliable guidance',
      problem: 'a tired, overwhelmed moment juggling childcare without a clear routine',
      result: 'a calm moment of parent and child in an easy, predictable daily rhythm'
    },
    education: {
      subject: 'a student or lifelong learner studying at an organized desk with notes and an open book',
      environment: 'a calm study room with neatly arranged reference materials',
      mockup: 'an open notebook beside a structured study-plan checklist mockup',
      metaphor: 'a lit desk lamp illuminating a clear upward path made of stacked books',
      boldSymbol: 'a single open-book-and-checkmark silhouette',
      persona: 'a learner working toward a clear educational goal',
      problem: 'a frustrated moment surrounded by scattered notes and unclear study direction',
      result: 'a focused moment of clear understanding and steady progress'
    },
    lifestyle: {
      subject: 'an adult enjoying a simple, well-curated daily lifestyle moment at home',
      environment: 'a tastefully arranged living space with natural light',
      mockup: 'a lifestyle planning guide beside a simple checklist mockup',
      metaphor: 'a warm ray of light settling over a calm, well-arranged living space',
      boldSymbol: 'a single home-and-heart silhouette',
      persona: 'an adult who values a simple, well-curated everyday lifestyle',
      problem: 'a cluttered, unsettled moment reflecting a disorganized daily routine',
      result: 'a satisfied moment enjoying a simple, well-arranged daily life'
    },
    household: {
      subject: 'an adult managing household routines and bills at a kitchen table',
      environment: 'an organized home interior with practical household items nearby',
      mockup: 'a household budget sheet beside a routine-checklist mockup',
      metaphor: 'a balanced house-shaped light form symbolizing a well-managed home',
      boldSymbol: 'a single house-and-checklist silhouette',
      persona: 'an adult managing a household on a practical, everyday budget',
      problem: 'a stressed moment facing rising household bills without a clear plan',
      result: 'a relieved moment managing household costs with a clear plan'
    },
    energy: {
      subject: 'an adult checking home energy usage on a simple monitor or bill at home',
      environment: 'a modern home interior with visible everyday appliances',
      mockup: 'an energy-saving checklist beside a usage-tracking sheet mockup',
      metaphor: 'a glowing bulb dimming into an efficient, steady soft light',
      boldSymbol: 'a single lightbulb-and-leaf silhouette',
      persona: 'an adult looking to reduce household energy costs practically',
      problem: 'a concerned moment reviewing an unexpectedly high energy bill',
      result: 'a relieved moment after visibly reducing energy costs'
    },
    emotional: {
      subject: 'an adult writing quietly in a personal diary at a cozy desk',
      environment: 'a soft-lit nook with a cup of tea beside the diary',
      mockup: 'an open diary page beside a simple daily-mood-tracking sheet mockup',
      metaphor: 'a soft candle glow illuminating a quiet, private writing space',
      boldSymbol: 'a single open-diary-and-heart silhouette',
      persona: 'an adult who wants a gentle way to process daily emotions',
      problem: 'a quiet moment of unspoken emotional overwhelm, sitting alone with unfinished thoughts',
      result: 'a lighter moment of emotional clarity after writing things down'
    },
    'self-development': {
      subject: 'an adult reviewing a personal goal-tracking journal at a calm desk',
      environment: 'an organized home workspace with morning light',
      mockup: 'a goal-tracking journal beside a daily-habit checklist mockup',
      metaphor: 'an ascending staircase of soft light steps leading toward an open horizon',
      boldSymbol: 'a single upward-arrow silhouette',
      persona: 'an adult working on consistent personal growth habits',
      problem: 'a stagnant, unmotivated moment with an abandoned goal list',
      result: 'an energized moment of visible steady progress toward a personal goal'
    },
    'professional-operations': {
      subject: 'an operations or procurement professional reviewing a structured work process at a desk',
      environment: 'an organized professional office with reference documents nearby',
      mockup: 'an operations playbook beside a process-checklist mockup',
      metaphor: 'a steady, orderly flow of connected process steps rendered in soft light',
      boldSymbol: 'a single clipboard-and-workflow silhouette',
      persona: 'an operations or procurement professional seeking a clear, reliable process guide',
      problem: 'a stressed moment facing an unclear or inconsistent work process amid scattered documents',
      result: 'a composed moment following a clear, well-structured process'
    },
    neutral: {
      subject: 'an adult engaging thoughtfully with the subject matter at an organized desk',
      environment: 'a minimal, neutral workspace with soft natural light',
      mockup: 'an ebook cover mockup beside a simple checklist notepad',
      metaphor: 'a clear guiding light illuminating a simple upward path',
      boldSymbol: 'a single circular badge silhouette',
      persona: 'an adult interested in this topic, looking for a clear, trustworthy guide',
      problem: 'a quiet moment of uncertainty before finding a clear direction on this topic',
      result: 'a satisfied moment after gaining clarity and a clear next step'
    }
  };

  /* ══════════════════════════════════════════════════════════════
     1. Input Normalizer
     ══════════════════════════════════════════════════════════════ */
  AVPE.inputNormalizer = function(rawInput){
    rawInput = rawInput || {};
    var brandProfile = rawInput.brandProfile || null;
    return {
      topic: rawInput.topic || '',
      targetAudience: rawInput.targetAudience || '',
      sourceSummary: rawInput.sourceSummary || '',
      brandStrategy: (brandProfile && brandProfile.brandStrategy) || null,
      headlineTone: (brandProfile && brandProfile.headlineTone) || null,
      informationDensity: (brandProfile && brandProfile.informationDensity) || null,
      marketingCopy: rawInput.marketingCopy || null,
      thumbnailBlueprint: rawInput.thumbnailBlueprint || null,
      salesPageBlueprint: rawInput.salesPageBlueprint || null,
      ebookBlueprint: rawInput.ebookBlueprint || null,
      userAssets: rawInput.userAssets || []
    };
  };

  /* ══════════════════════════════════════════════════════════════
     2. 카테고리 분류(Evidence 기반) — Phase 11.2: evidenceSources[] 기록 +
        독립 증거원 개수 기반 confidence 상한 적용.
     ══════════════════════════════════════════════════════════════ */
  function marketingCopyText(mc){
    if(!mc) return '';
    var parts = [mc.headline, mc.subheadline, mc.hook, mc.badge];
    if(mc.benefits && mc.benefits.length) parts.push(mc.benefits.join(' '));
    if(mc.faqs && mc.faqs.length) parts.push(mc.faqs.map(function(f){ return (f.q||'')+' '+(f.a||''); }).join(' '));
    return parts.filter(Boolean).join(' ');
  }
  function blueprintText(thumbnailBlueprint){
    if(thumbnailBlueprint && thumbnailBlueprint.highlightWords && thumbnailBlueprint.highlightWords.length){
      return thumbnailBlueprint.highlightWords.join(' ');
    }
    return '';
  }

  var EVIDENCE_FIELD_WEIGHT = { topic:3, targetAudience:2, sourceSummary:1, marketingCopy:1, thumbnailBlueprint:1 };
  var MAX_CATEGORY_EVIDENCE = 8;
  var LOW_CONFIDENCE_THRESHOLD = 0.3;
  var SECONDARY_MIN_SCORE = 2;
  var CONFIDENCE_WEIGHT_EVIDENCE = 0.6;
  var CONFIDENCE_WEIGHT_MARGIN = 0.4;

  /* Phase 11.2: 독립 증거원(evidenceSources) 개수에 따른 confidence 상한.
     이 Engine에는 "사용자가 카테고리를 직접 선택"하는 경로가 없으므로 1.0은
     이 파이프라인에서 나오지 않는다 — 정직하게 절대 상한을 0.99로 둔다. */
  var ABSOLUTE_CONFIDENCE_CAP = 0.99;
  function confidenceCapFor(evidenceSourceCount, matchedKeywordCount){
    if(evidenceSourceCount<2) return { cap:0.94, note:'단일 입력원(또는 매칭 키워드 부족)이라 confidence 상한 0.94를 적용했습니다.' };
    if(evidenceSourceCount===2) return { cap:0.95, note:'독립 증거원이 2개이므로 confidence 상한 0.95를 적용했습니다.' };
    if(evidenceSourceCount>=3 && matchedKeywordCount>=4) return { cap:ABSOLUTE_CONFIDENCE_CAP, note:'독립 증거원 3개 이상 + 매칭 키워드 4개 이상의 강한 다중 증거로 confidence 상한 0.99를 적용했습니다.' };
    return { cap:0.95, note:'독립 증거원 3개 이상이지만 매칭 키워드가 충분하지 않아 confidence 상한 0.95를 적용했습니다.' };
  }

  AVPE.categoryEvidenceScanner = function(input){
    var fields = {
      topic: input.topic,
      targetAudience: input.targetAudience,
      sourceSummary: input.sourceSummary,
      marketingCopy: marketingCopyText(input.marketingCopy),
      thumbnailBlueprint: blueprintText(input.thumbnailBlueprint)
    };
    var scores = {}, signals = {}, sources = {};
    CATEGORY_KEYS.forEach(function(cat){ scores[cat]=0; signals[cat]=[]; sources[cat]=[]; });
    Object.keys(fields).forEach(function(fieldName){
      var text = fields[fieldName];
      if(!text) return;
      var weight = EVIDENCE_FIELD_WEIGHT[fieldName];
      CATEGORY_KEYS.forEach(function(cat){
        CATEGORY_KEYWORDS[cat].forEach(function(kw){
          if(text.indexOf(kw)>-1){
            scores[cat]+=weight;
            if(signals[cat].indexOf(kw)===-1) signals[cat].push(kw);
            if(sources[cat].indexOf(fieldName)===-1) sources[cat].push(fieldName);
          }
        });
      });
    });
    return { scores: scores, signals: signals, sources: sources };
  };

  AVPE.categoryClassifier = function(input){
    var evidence = AVPE.categoryEvidenceScanner(input);
    var ranked = CATEGORY_KEYS.slice().sort(function(a,b){ return evidence.scores[b]-evidence.scores[a]; });
    var topCategory = ranked[0];
    var topScore = evidence.scores[topCategory];
    var secondCategory = ranked[1];
    var secondScore = evidence.scores[secondCategory] || 0;

    if(topScore<=0){
      return {
        primaryCategory: 'neutral', secondaryCategories: [], confidence: 0,
        matchedSignals: [], evidenceSources: [], confidenceNote: '매칭된 카테고리 키워드가 전혀 없어 confidence 0으로 neutral 처리했습니다.',
        candidates: CATEGORY_KEYS.map(function(c){ return { category:c, score:0, matchedSignals:[] }; }),
        lowConfidenceFallback: false
      };
    }

    var evidenceStrength = clamp01(topScore/MAX_CATEGORY_EVIDENCE);
    var decisionMargin = clamp01((topScore-secondScore)/MAX_CATEGORY_EVIDENCE);
    var rawConfidence = (evidenceStrength*CONFIDENCE_WEIGHT_EVIDENCE + decisionMargin*CONFIDENCE_WEIGHT_MARGIN);
    var sourceCount = evidence.sources[topCategory].length;
    var keywordCount = evidence.signals[topCategory].length;
    var capInfo = confidenceCapFor(sourceCount, keywordCount);
    var confidence = Math.round(Math.min(rawConfidence, capInfo.cap, ABSOLUTE_CONFIDENCE_CAP)*100)/100;

    var otherRealCandidates = ranked.slice(1).filter(function(c){ return evidence.scores[c]>=SECONDARY_MIN_SCORE; }).slice(0,3);
    var candidates = ranked.filter(function(c){ return evidence.scores[c]>0; }).map(function(c){
      return { category:c, score:evidence.scores[c], matchedSignals:evidence.signals[c].slice(), evidenceSources:evidence.sources[c].slice() };
    });

    /* Phase 11.3: confidenceNote는 상한만 설명하지 않고 evidenceSources 개수,
       evidenceStrength/decisionMargin, 그리고 실제로 confidence를 낮추거나
       높인 원인(상한에 걸렸는지, 2위 카테고리와의 격차가 좁았는지)까지 설명한다. */
    var evPct = Math.round(evidenceStrength*100), marginPct = Math.round(decisionMargin*100);
    var noteParts = ['evidenceSources '+sourceCount+'개, evidenceStrength '+evPct+'%, decisionMargin '+marginPct+'%, 적용 상한 '+capInfo.cap+'.'];
    if(rawConfidence>capInfo.cap+0.001){
      noteParts.push('계산값('+Math.round(rawConfidence*100)/100+')이 상한을 초과해 '+capInfo.cap+'로 제한되었습니다.');
    } else if(secondScore>0){
      noteParts.push('"'+topCategory+'"과 "'+secondCategory+'"의 점수 차이가 '+(marginPct<50?'크지 않아':'뚜렷해')+'(decisionMargin '+marginPct+'%) 최종 confidence는 '+confidence+'로 계산되었습니다.');
    } else {
      noteParts.push('다른 카테고리와 매칭되는 신호가 없어 evidenceStrength만으로 confidence '+confidence+'가 계산되었습니다.');
    }
    var confidenceNote = noteParts.join(' ');

    if(confidence<LOW_CONFIDENCE_THRESHOLD){
      var weakCandidates = [topCategory].concat(otherRealCandidates).slice(0,3);
      return {
        primaryCategory: 'neutral', secondaryCategories: weakCandidates, confidence: confidence,
        matchedSignals: evidence.signals[topCategory].slice(), evidenceSources: evidence.sources[topCategory].slice(),
        confidenceNote: '확신도가 낮아('+confidence+') primaryCategory를 neutral로 판단을 보류했습니다. '+confidenceNote,
        candidates: candidates, lowConfidenceFallback: true
      };
    }

    return {
      primaryCategory: topCategory, secondaryCategories: otherRealCandidates, confidence: confidence,
      matchedSignals: evidence.signals[topCategory].slice(), evidenceSources: evidence.sources[topCategory].slice(),
      confidenceNote: confidenceNote, candidates: candidates, lowConfidenceFallback: false
    };
  };

  AVPE.categoryDetector = function(input){ return AVPE.categoryClassifier(input).primaryCategory; };

  /* ══════════════════════════════════════════════════════════════
     3. Style Director — 5속성 프로필 내적 + 가중 보너스(Phase 11.1과 동일한
        판단 로직). Phase 11.2: normalizedScore(0~100) 추가.
     ══════════════════════════════════════════════════════════════ */
  var STYLE_POOL = [
    'premium editorial illustration', 'modern flat illustration', 'semi-realistic commercial illustration',
    'paper-cut editorial collage', 'soft 3D illustration', 'clean product advertising',
    'premium infographic illustration', 'warm lifestyle illustration', 'minimal conceptual art',
    'realistic product mockup scene'
  ];
  var STYLE_PROFILE = {
    'premium editorial illustration':   { scene:8, document:4, abstract:5, warmth:4, premium:9 },
    'modern flat illustration':         { scene:6, document:5, abstract:6, warmth:5, premium:5 },
    'semi-realistic commercial illustration': { scene:9, document:4, abstract:3, warmth:6, premium:7 },
    'paper-cut editorial collage':      { scene:5, document:3, abstract:7, warmth:8, premium:5 },
    'soft 3D illustration':             { scene:6, document:6, abstract:5, warmth:7, premium:6 },
    'clean product advertising':        { scene:3, document:9, abstract:2, warmth:3, premium:8 },
    'premium infographic illustration': { scene:2, document:9, abstract:6, warmth:3, premium:7 },
    'warm lifestyle illustration':      { scene:8, document:3, abstract:3, warmth:9, premium:4 },
    'minimal conceptual art':           { scene:2, document:3, abstract:10, warmth:4, premium:6 },
    'realistic product mockup scene':   { scene:4, document:9, abstract:1, warmth:4, premium:8 }
  };
  var CATEGORY_PROFILE = {
    finance:      { scene:5, document:7, abstract:4, warmth:3, premium:8 },
    business:     { scene:4, document:8, abstract:4, warmth:3, premium:8 },
    technology:   { scene:4, document:5, abstract:7, warmth:3, premium:6 },
    health:       { scene:7, document:4, abstract:4, warmth:6, premium:4 },
    medical:      { scene:4, document:8, abstract:3, warmth:3, premium:7 },
    parenting:    { scene:8, document:3, abstract:2, warmth:9, premium:3 },
    education:    { scene:5, document:8, abstract:4, warmth:4, premium:5 },
    lifestyle:    { scene:8, document:3, abstract:3, warmth:8, premium:4 },
    household:    { scene:6, document:6, abstract:3, warmth:6, premium:4 },
    energy:       { scene:4, document:5, abstract:7, warmth:3, premium:5 },
    emotional:    { scene:6, document:2, abstract:5, warmth:9, premium:3 },
    'self-development':        { scene:6, document:4, abstract:7, warmth:5, premium:6 },
    'professional-operations': { scene:3, document:9, abstract:3, warmth:3, premium:7 },
    neutral:      { scene:5, document:5, abstract:5, warmth:5, premium:5 }
  };
  var STRATEGY_ATTR = { Authority:'premium', Trust:'document', Relationship:'warmth' };
  var PATTERN_ATTR = { 'Comparison':'document', 'Icon Focus':'document', 'Left Image':'scene', 'Right Image':'scene', 'Center Text':'abstract', 'Top Banner':'scene' };
  var STRATEGY_LIST = ['Authority','Trust','Relationship', null];
  var PATTERN_LIST = ['Comparison','Icon Focus','Left Image','Right Image','Center Text','Top Banner', null];
  var DENSITY_LIST = ['높음','중간','낮음', null];

  function styleScore(style, category, brandStrategy, thumbnailPattern, informationDensity){
    var p = STYLE_PROFILE[style];
    var c = CATEGORY_PROFILE[category] || CATEGORY_PROFILE.neutral;
    var base = p.scene*c.scene + p.document*c.document + p.abstract*c.abstract + p.warmth*c.warmth + p.premium*c.premium;
    var strategyAttr = STRATEGY_ATTR[brandStrategy];
    var strategyBonus = strategyAttr ? p[strategyAttr]*3 : 0;
    var patternAttr = PATTERN_ATTR[thumbnailPattern];
    var patternBonus = patternAttr ? p[patternAttr]*1.5 : 0;
    var densityBonus = informationDensity==='높음' ? p.document*1.5 : (informationDensity==='낮음' ? (p.scene+p.warmth)*0.75 : 0);
    return { total: base+strategyBonus+patternBonus+densityBonus, base:base, strategyBonus:strategyBonus, patternBonus:patternBonus, densityBonus:densityBonus };
  }

  /* Phase 11.2: 실제 정의된 프로필 표에서 도달 가능한 이론적 최댓값을 모듈
     로드 시 한 번 계산해 정규화 기준으로 쓴다(하드코딩된 매직 넘버 없음). */
  var STYLE_SCORE_MAX = (function(){
    var max = 1;
    STYLE_POOL.forEach(function(style){
      CATEGORY_KEYS.concat(['neutral']).forEach(function(cat){
        STRATEGY_LIST.forEach(function(strat){
          PATTERN_LIST.forEach(function(pat){
            DENSITY_LIST.forEach(function(dens){
              var s = styleScore(style, cat, strat, pat, dens).total;
              if(s>max) max = s;
            });
          });
        });
      });
    });
    return max;
  })();

  AVPE.styleDirector = function(brandStrategy, category, thumbnailPattern, informationDensity){
    var scored = STYLE_POOL.map(function(style){
      var s = styleScore(style, category, brandStrategy, thumbnailPattern, informationDensity);
      var rawScore = Math.round(s.total);
      var normalizedScore = clamp(Math.round(s.total/STYLE_SCORE_MAX*100), 0, 100);
      return {
        style:style, rawScore:rawScore, normalizedScore:normalizedScore, maxScore:100, score:normalizedScore,
        base:Math.round(s.base), strategyBonus:Math.round(s.strategyBonus), patternBonus:Math.round(s.patternBonus), densityBonus:Math.round(s.densityBonus)
      };
    }).sort(function(a,b){ return b.normalizedScore-a.normalizedScore; });
    return scored;
  };

  /* ══════════════════════════════════════════════════════════════
     3-b. Variant-Compatible Art Direction(Phase 11.3) — 주제 전체의 대표
        artDirection(baseArtDirection) 하나를 5개 Thumbnail Variant 전부에
        기계적으로 재사용하면, "Bold Minimal Advertising"(단일 실루엣)에
        "realistic product mockup scene"(사실적 목업 촬영) 같은 의미 충돌이
        생긴다. Variant마다 실제로 호환되는 스타일이 다르므로, 각 Variant는
        (a) Variant-Style 호환도(구조적으로 고정된 표, 0~10)로 먼저 후보를
        걸러내고, (b) 그 후보들 중 카테고리·BrandStrategy·Pattern·Density
        기준 점수(styleDirector가 이미 계산한 normalizedScore)가 가장 높은
        스타일을 effectiveArtDirection으로 고른다 — 하드코딩된 1:1 매핑이
        아니라 "호환 가능한 것들 중 이 주제에 가장 잘 맞는 것"을 고르는
        2단계 결정이다. */
  var VARIANT_COMPATIBLE_THRESHOLD = 6;
  var VARIANT_STYLE_COMPATIBILITY = {
    'editorial-illustration': {
      'premium editorial illustration':10, 'modern flat illustration':7, 'semi-realistic commercial illustration':8,
      'paper-cut editorial collage':6, 'soft 3D illustration':7, 'clean product advertising':3,
      'premium infographic illustration':5, 'warm lifestyle illustration':9, 'minimal conceptual art':3, 'realistic product mockup scene':2
    },
    'product-mockup-focus': {
      'premium editorial illustration':4, 'modern flat illustration':5, 'semi-realistic commercial illustration':6,
      'paper-cut editorial collage':3, 'soft 3D illustration':6, 'clean product advertising':9,
      'premium infographic illustration':7, 'warm lifestyle illustration':3, 'minimal conceptual art':2, 'realistic product mockup scene':10
    },
    'character-scene-focus': {
      'premium editorial illustration':7, 'modern flat illustration':6, 'semi-realistic commercial illustration':9,
      'paper-cut editorial collage':5, 'soft 3D illustration':7, 'clean product advertising':2,
      'premium infographic illustration':2, 'warm lifestyle illustration':10, 'minimal conceptual art':1, 'realistic product mockup scene':1
    },
    'conceptual-metaphor': {
      'premium editorial illustration':5, 'modern flat illustration':6, 'semi-realistic commercial illustration':3,
      'paper-cut editorial collage':8, 'soft 3D illustration':6, 'clean product advertising':2,
      'premium infographic illustration':8, 'warm lifestyle illustration':3, 'minimal conceptual art':10, 'realistic product mockup scene':1
    },
    'bold-minimal-advertising': {
      'premium editorial illustration':4, 'modern flat illustration':7, 'semi-realistic commercial illustration':2,
      'paper-cut editorial collage':5, 'soft 3D illustration':5, 'clean product advertising':9,
      'premium infographic illustration':9, 'warm lifestyle illustration':2, 'minimal conceptual art':9, 'realistic product mockup scene':1
    }
  };

  /* Phase 11.4: Sales Page 9개 Role용 호환도 표(사용자 스펙 §2의 역할별 권장
     방향을 상위 3개 항목 compat 9/8/7로 인코딩하고, 나머지 스타일은 그
     Role의 장면 성격(문서/광고 vs 장면/정서 vs 추상)에 맞춰 합리적으로
     채웠다). Thumbnail용 VARIANT_STYLE_COMPATIBILITY는 이 Phase에서 전혀
     수정하지 않는다. */
  var ROLE_STYLE_COMPATIBILITY = {
    hero: {
      'clean product advertising':9, 'realistic product mockup scene':9, 'premium editorial illustration':8,
      'modern flat illustration':6, 'semi-realistic commercial illustration':6, 'paper-cut editorial collage':4,
      'soft 3D illustration':6, 'premium infographic illustration':5, 'warm lifestyle illustration':5, 'minimal conceptual art':3
    },
    pain: {
      'warm lifestyle illustration':9, 'semi-realistic commercial illustration':9, 'premium editorial illustration':8,
      'modern flat illustration':5, 'paper-cut editorial collage':5, 'soft 3D illustration':6,
      'clean product advertising':2, 'premium infographic illustration':2, 'minimal conceptual art':2, 'realistic product mockup scene':1
    },
    beforeAfter: {
      'premium infographic illustration':9, 'premium editorial illustration':8, 'paper-cut editorial collage':8,
      'modern flat illustration':6, 'semi-realistic commercial illustration':4, 'soft 3D illustration':5,
      'clean product advertising':3, 'warm lifestyle illustration':3, 'minimal conceptual art':4, 'realistic product mockup scene':2
    },
    solution: {
      'premium infographic illustration':9, 'minimal conceptual art':9, 'soft 3D illustration':8,
      'premium editorial illustration':5, 'modern flat illustration':6, 'paper-cut editorial collage':5,
      'semi-realistic commercial illustration':3, 'clean product advertising':3, 'warm lifestyle illustration':3, 'realistic product mockup scene':2
    },
    toc: {
      'realistic product mockup scene':9, 'clean product advertising':9, 'premium infographic illustration':8,
      'soft 3D illustration':6, 'semi-realistic commercial illustration':5, 'premium editorial illustration':4,
      'modern flat illustration':5, 'paper-cut editorial collage':3, 'warm lifestyle illustration':2, 'minimal conceptual art':2
    },
    benefits: {
      'premium infographic illustration':9, 'soft 3D illustration':8, 'premium editorial illustration':8,
      'modern flat illustration':6, 'semi-realistic commercial illustration':5, 'warm lifestyle illustration':5,
      'clean product advertising':4, 'paper-cut editorial collage':4, 'minimal conceptual art':3, 'realistic product mockup scene':3
    },
    targetAudience: {
      'warm lifestyle illustration':9, 'semi-realistic commercial illustration':9, 'premium editorial illustration':8,
      'modern flat illustration':5, 'paper-cut editorial collage':4, 'soft 3D illustration':6,
      'clean product advertising':2, 'premium infographic illustration':2, 'minimal conceptual art':2, 'realistic product mockup scene':1
    },
    faq: {
      'clean product advertising':9, 'premium infographic illustration':9, 'realistic product mockup scene':8,
      'soft 3D illustration':5, 'premium editorial illustration':5, 'modern flat illustration':5,
      'semi-realistic commercial illustration':3, 'paper-cut editorial collage':3, 'warm lifestyle illustration':2, 'minimal conceptual art':3
    },
    cta: {
      'clean product advertising':9, 'realistic product mockup scene':9, 'premium editorial illustration':8,
      'modern flat illustration':6, 'semi-realistic commercial illustration':5, 'soft 3D illustration':5,
      'premium infographic illustration':5, 'paper-cut editorial collage':4, 'warm lifestyle illustration':4, 'minimal conceptual art':3
    }
  };

  /* 공용 코어: styleCandidates 중 호환도>=threshold인 후보를 걸러내고, 그
     안에서 카테고리 적합도(normalizedScore)가 가장 높은 것을 고른다. 호환
     후보가 하나도 없으면(방어적 경로) 호환도 자체가 가장 높은 스타일로
     대체한다. Thumbnail Variant와 Sales Page Role이 이 로직을 공유한다 —
     결정 알고리즘 자체는 동일하고 호환도 표만 다르다. */
  function resolveEffectiveArtDirection(baseArtDirection, styleCandidates, compatTable, threshold){
    var compatible = styleCandidates.filter(function(s){ return compatTable[s.style]>=threshold; });
    var pool = compatible.length ? compatible : styleCandidates.slice();
    var chosen = pool.slice().sort(function(a,b){
      var compatDiff = compatTable[b.style]-compatTable[a.style];
      if(!compatible.length && compatDiff!==0) return compatDiff; /* 방어 경로: 호환도만으로 정렬 */
      return b.normalizedScore-a.normalizedScore || compatTable[b.style]-compatTable[a.style];
    })[0];
    return { chosen: chosen, compatScore: compatTable[chosen.style], baseCompat: compatTable[baseArtDirection]||0 };
  }

  /* Thumbnail Variant용(Phase 11.3 그대로 — 외부 시그니처/동작 무변경). */
  AVPE.effectiveArtDirectionResolver = function(variantId, baseArtDirection, styleCandidates){
    var compatTable = VARIANT_STYLE_COMPATIBILITY[variantId];
    var r = resolveEffectiveArtDirection(baseArtDirection, styleCandidates, compatTable, VARIANT_COMPATIBLE_THRESHOLD);
    var reason = r.chosen.style===baseArtDirection
      ? ('대표 스타일("'+baseArtDirection+'")이 이 Variant와도 호환되어(호환도 '+r.compatScore+'/10) 그대로 사용했습니다.')
      : ('대표 스타일("'+baseArtDirection+'")은 이 Variant의 구도와 맞지 않아(호환도 '+r.baseCompat+'/10), 호환되는 스타일 중 카테고리 적합도가 가장 높은 "'+r.chosen.style+'"(호환도 '+r.compatScore+'/10, 카테고리 적합도 '+r.chosen.normalizedScore+'/100)을 대신 선택했습니다.');
    return { effectiveArtDirection: r.chosen.style, compatScore: r.compatScore, reason: reason };
  };

  /* Phase 11.4: Sales Page Role용. 동일한 코어 알고리즘을 Role 호환도 표로
     실행한다. */
  AVPE.effectiveArtDirectionResolverForRole = function(roleKey, roleLabel, baseArtDirection, styleCandidates){
    var compatTable = ROLE_STYLE_COMPATIBILITY[roleKey];
    var r = resolveEffectiveArtDirection(baseArtDirection, styleCandidates, compatTable, VARIANT_COMPATIBLE_THRESHOLD);
    var reason = r.chosen.style===baseArtDirection
      ? ('대표 스타일("'+baseArtDirection+'")이 "'+roleLabel+'" 역할과도 호환되어(호환도 '+r.compatScore+'/10) 그대로 사용했습니다.')
      : ('대표 스타일("'+baseArtDirection+'")은 "'+roleLabel+'" 역할의 장면과 맞지 않아(호환도 '+r.baseCompat+'/10), 호환되는 스타일 중 카테고리 적합도가 가장 높은 "'+r.chosen.style+'"(호환도 '+r.compatScore+'/10, 카테고리 적합도 '+r.chosen.normalizedScore+'/100)을 대신 선택했습니다.');
    return { effectiveArtDirection: r.chosen.style, compatScore: r.compatScore, reason: reason };
  };

  var EMOTIONAL_GOAL_BY_STRATEGY = {
    Authority: 'a feeling of confidence, expertise, and premium trust',
    Trust: 'a feeling of clarity, reassurance, and evidence-based confidence',
    Relationship: 'a feeling of warmth, empathy, and personal connection'
  };
  var NEUTRAL_EMOTIONAL_GOAL = 'a feeling of clarity and approachability';
  AVPE.emotionalGoalDirector = function(brandStrategy){
    return EMOTIONAL_GOAL_BY_STRATEGY[brandStrategy] || NEUTRAL_EMOTIONAL_GOAL;
  };

  var COLOR_BY_STRATEGY = {
    Authority: 'a deep navy and warm gold accent palette',
    Trust: 'a clean white and calm blue-gray palette',
    Relationship: 'a warm cream, soft coral, and muted pastel palette'
  };
  var LIGHTING_BY_STRATEGY = {
    Authority: 'dramatic, soft directional lighting with a subtle rim light',
    Trust: 'even, bright, clear lighting with soft shadows',
    Relationship: 'soft, warm natural window light'
  };
  var NEUTRAL_COLOR = 'a balanced neutral palette with one clear accent color';
  var NEUTRAL_LIGHTING = 'soft, even natural lighting';
  AVPE.lightingColorDirector = function(brandStrategy){
    return {
      colorDirection: COLOR_BY_STRATEGY[brandStrategy] || NEUTRAL_COLOR,
      lightingDirection: LIGHTING_BY_STRATEGY[brandStrategy] || NEUTRAL_LIGHTING
    };
  };

  var COMPOSITION_BY_CATEGORY = {
    finance: 'a desk-top angled composition with the laptop and roadmap sheet as anchor points',
    business: 'a low-angle composition emphasizing scale and upward momentum',
    technology: 'an isometric composition balancing the human subject and the abstract interface',
    health: 'a three-quarter view composition with the subject slightly off-center and soft foreground blur',
    medical: 'a desk-angled composition emphasizing structured reference materials',
    parenting: 'an eye-level composition centered on the parent-child interaction with soft symmetry',
    education: 'an overhead flat-lay composition of study materials with one clear focal point',
    lifestyle: 'an eye-level composition celebrating simple, well-arranged everyday living',
    household: 'a top-down flat-lay composition of household items and budget materials with balanced negative space',
    energy: 'an isometric composition contrasting a glowing element against a calm, efficient space',
    emotional: 'a close-up composition with soft shallow depth of field around the diary and hands',
    'self-development': 'a forward-looking three-quarter composition with strong diagonal leading lines toward the horizon',
    'professional-operations': 'an overhead flat-lay composition of process documents with one clear focal point',
    neutral: 'a balanced, centered composition with a clear single-subject focus and generous negative space'
  };
  AVPE.compositionDirector = function(category){
    return COMPOSITION_BY_CATEGORY[category] || COMPOSITION_BY_CATEGORY.neutral;
  };

  var TYPOGRAPHY_BY_HEADLINE_TONE = {
    '단정적/전문가 톤': 'a bold, high-contrast sans-serif Korean headline treatment with tight letter spacing',
    '설명적/근거 제시 톤': 'a clean, structured sans-serif Korean headline treatment with a clear text hierarchy',
    '대화체/친근 톤': 'a warm, rounded sans-serif Korean headline treatment with relaxed letter spacing'
  };
  var NEUTRAL_TYPOGRAPHY = 'a clean, legible sans-serif Korean headline treatment';
  AVPE.typographyDirector = function(headlineTone){
    return TYPOGRAPHY_BY_HEADLINE_TONE[headlineTone] || NEUTRAL_TYPOGRAPHY;
  };

  AVPE.subjectDirector = function(category){
    var lib = CATEGORY_LIBRARY[category] || CATEGORY_LIBRARY.neutral;
    return { visualSubject: lib.subject, environment: lib.environment };
  };

  /* ══════════════════════════════════════════════════════════════
     4. Visual Strategy Builder
     ══════════════════════════════════════════════════════════════ */
  AVPE.visualStrategyBuilder = function(input, categoryResult){
    var category = categoryResult.primaryCategory;
    var subject = AVPE.subjectDirector(category);
    var lighting = AVPE.lightingColorDirector(input.brandStrategy);
    var thumbnailPattern = (input.thumbnailBlueprint && input.thumbnailBlueprint.pattern) || null;
    var styleRanking = AVPE.styleDirector(input.brandStrategy, category, thumbnailPattern, input.informationDensity);
    return {
      category: category,
      primaryCategory: category,
      secondaryCategories: categoryResult.secondaryCategories,
      categoryConfidence: categoryResult.confidence,
      categoryEvidence: categoryResult.matchedSignals,
      evidenceSources: categoryResult.evidenceSources,
      confidenceNote: categoryResult.confidenceNote,
      categoryCandidates: categoryResult.candidates,
      audience: input.targetAudience || CATEGORY_LIBRARY[category].persona,
      emotionalGoal: AVPE.emotionalGoalDirector(input.brandStrategy),
      artDirection: styleRanking[0].style,
      styleCandidates: styleRanking,
      visualSubject: subject.visualSubject,
      environment: subject.environment,
      colorDirection: lighting.colorDirection,
      lightingDirection: lighting.lightingDirection,
      compositionDirection: AVPE.compositionDirector(category),
      typographyDirection: AVPE.typographyDirector(input.headlineTone)
    };
  };

  /* ══════════════════════════════════════════════════════════════
     5. Text Safety Director — Phase 11.2: "No embedded text" 접미사를
        제거했다(Thumbnail/Sales Page Prompt Builder의 Text Restriction
        단계에서 정확히 1회만 담당하도록 역할을 분리했다).
     ══════════════════════════════════════════════════════════════ */
  var POSITION_LABEL = {
    'center':'the center', 'top':'the upper area', 'bottom':'the lower area',
    'left':'the left side', 'right':'the right side',
    'top-left':'the upper-left corner', 'top-right':'the upper-right corner',
    'bottom-left':'the lower-left corner', 'bottom-right':'the lower-right corner',
    'top-center':'the upper-center area', 'bottom-center':'the lower-center area'
  };
  function posLabel(pos){ return POSITION_LABEL[pos] || 'a clear area'; }

  AVPE.textSafetyDirector = function(thumbnailBlueprint, salesPageBlueprint){
    var headlinePos = (thumbnailBlueprint && thumbnailBlueprint.headlinePosition) || 'center';
    var badgePos = (thumbnailBlueprint && thumbnailBlueprint.badgePosition) || 'top-left';
    var ctaPos = (thumbnailBlueprint && thumbnailBlueprint.ctaPosition) || 'bottom';
    var thumbnailSafeArea = 'Leave clear negative space in '+posLabel(headlinePos)+' for the headline, near '+posLabel(badgePos)+' for the badge, and near '+posLabel(ctaPos)+' for the CTA button, reserved for Atlas to overlay approved Korean text afterward.';

    /* Phase 11.5: 이전 버전(Phase 11.4)은 layoutStrategy 하나로 9개 역할
       전체의 비율을 정했고, 그 비율이 "two-thirds"/"half"까지 커질 수 있어
       Safe Area가 캔버스의 절반을 넘게 차지하거나("빈 캔버스"에 가까워짐),
       "spanning about a two-thirds"/"a half" 같은 비문법적 구절이 남아
       있었다. 이제 역할마다 권장 anchor/proportion 후보를 고정 표로 미리
       정의하고(모두 50% 이하), 좌/우 두 옵션이 있는 역할만 layoutStrategy로
       결정한다 — 항상 결정적이고, 항상 문법적으로 자연스럽다. */
    var layoutStrategy = (salesPageBlueprint && salesPageBlueprint.layoutStrategy) || null;
    var ROLE_SAFE_AREA_OPTIONS = {
      hero:           [{ anchor:'upper',  proportion:'third' },        { anchor:'left',  proportion:'40 percent' }, { anchor:'right', proportion:'40 percent' }],
      pain:           [{ anchor:'lower',  proportion:'third' },        { anchor:'right', proportion:'35 percent' }],
      beforeAfter:    [{ anchor:'center', proportion:'25 to 35 percent' }],
      solution:       [{ anchor:'lower',  proportion:'third' },        { anchor:'left',  proportion:'35 percent' }, { anchor:'right', proportion:'35 percent' }],
      toc:            [{ anchor:'left',   proportion:'35 to 40 percent' }, { anchor:'right', proportion:'35 to 40 percent' }],
      benefits:       [{ anchor:'lower',  proportion:'third' },        { anchor:'upper', proportion:'third' }],
      targetAudience: [{ anchor:'left',   proportion:'35 percent' },   { anchor:'right', proportion:'35 percent' }],
      faq:            [{ anchor:'center', proportion:'third' }],
      cta:            [{ anchor:'lower',  proportion:'third' },        { anchor:'right', proportion:'40 percent' }]
    };
    /* 모든 값이 50%를 넘지 않는다(third≈34%가 최대 근사치, 나머지는 25~40%). */
    var PROPORTION_APPROX_PERCENT = {
      'third': 34, '40 percent': 40, '35 percent': 35,
      '35 to 40 percent': 40, '25 to 35 percent': 35
    };
    function pickSafeAreaOption(roleKey, layout){
      var options = ROLE_SAFE_AREA_OPTIONS[roleKey] || ROLE_SAFE_AREA_OPTIONS.hero;
      if(options.length===1) return options[0];
      if(layout==='mockup-first') return options[0];
      if(layout==='grid-first') return options[options.length-1];
      return options[0];
    }
    function safeAreaPhrase(anchor, proportion){
      if(anchor==='upper') return 'the upper '+proportion+' of the frame';
      if(anchor==='lower') return 'the lower '+proportion+' of the frame';
      if(anchor==='left') return 'the left '+proportion+' of the frame';
      if(anchor==='right') return 'the right '+proportion+' of the frame';
      var spanPhrase = proportion==='third' ? 'about one-third' : 'roughly '+proportion;
      return 'a central horizontal band spanning '+spanPhrase+' of the frame';
    }
    function salesRoleSafeArea(roleKey, roleLabel){
      var opt = pickSafeAreaOption(roleKey, layoutStrategy);
      var phrase = 'Reserve '+safeAreaPhrase(opt.anchor, opt.proportion)+' as clean negative space for Atlas to overlay the "'+roleLabel+'" text afterward.';
      return { phrase: phrase, anchor: opt.anchor, proportion: opt.proportion, approxPercent: PROPORTION_APPROX_PERCENT[opt.proportion] };
    }
    return { thumbnailSafeArea: thumbnailSafeArea, salesRoleSafeArea: salesRoleSafeArea };
  };

  /* ══════════════════════════════════════════════════════════════
     6. Negative Prompt Builder — Phase 11.2: 카테고리별 추가 항목이 base
        목록과 겹치지 않도록 정리.
     ══════════════════════════════════════════════════════════════ */
  var NEGATIVE_BASE = [
    'illegible text','random letters','distorted hands','extra fingers','duplicated objects',
    'warped book mockup','cluttered layout','low contrast','cheap stock-image appearance',
    'childish clip art','generic presentation slide','empty placeholder','fake testimonial',
    'fake certification','revenue guarantee','watermark','logo','QR code'
  ];
  var NEGATIVE_EXTRA_BY_CATEGORY = {
    finance: ['guaranteed profit imagery','gambling imagery'],
    business: ['unrealistic luxury exaggeration'],
    technology: ['dystopian robot imagery'],
    health: ['unrealistic body transformation claims'],
    medical: ['unsafe medical claims','fake medical certification','misleading clinical results'],
    parenting: ['unsafe child depictions'],
    education: ['exam cheating imagery'],
    lifestyle: [],
    household: [],
    energy: ['unrealistic savings guarantee'],
    emotional: ['overly bleak imagery'],
    /* self-development는 "루틴/습관" 등 education과 무관한 신호로도 2차
       후보에 오를 수 있으므로, education 전용 개념인 "exam cheating
       imagery"를 여기 두지 않는다(Phase 11.4: 의미상 맞지 않는 카테고리에
       금지 문구를 얹지 않는다). */
    'self-development': [],
    'professional-operations': [],
    neutral: []
  };

  /* Phase 11.4: secondaryCategories 중 "약한 오탐"(우연히 키워드 하나만
     매칭된 카테고리)의 Negative Prompt 추가 항목까지 섞이지 않도록, 실제로
     의미 있는 증거(서로 다른 필드 2개 이상, 또는 매칭 키워드 2개 이상)가
     있는 2차 카테고리에서만 추가 항목을 병합한다. 예: "감정 일기와 루틴
     기록법"은 emotional이 주 카테고리, self-development가 "루틴" 키워드
     하나만으로 2차 후보에 오르는데 — 이 정도 근거로는 self-development의
     안전 문구(있다면)를 끌어오지 않는다. 반대로 "병원 구매담당자 실무
     가이드"의 medical은 topic/targetAudience 2개 필드에서 매칭되어(비록
     키워드는 1개뿐이라도) 실질적 증거로 인정하고 병합한다. */
  var NEGATIVE_MERGE_MIN_FIELDS = 2;
  var NEGATIVE_MERGE_MIN_KEYWORDS = 2;
  function qualifiesForNegativeMerge(candidate){
    if(!candidate) return true; /* 후보 정보가 없으면 안전하게 포함(과거 호출 호환) */
    return candidate.evidenceSources.length>=NEGATIVE_MERGE_MIN_FIELDS || candidate.matchedSignals.length>=NEGATIVE_MERGE_MIN_KEYWORDS;
  }
  /* 의미가 겹치는 일반/구체 항목 쌍 — 구체적인 표현이 포함되면 일반 표현은
     제거한다(예: medical 문맥에서는 "fake medical certification"만 남기고
     base의 "fake certification"은 뺀다). */
  var NEGATIVE_SUPERSEDES = { 'fake medical certification': ['fake certification'] };

  AVPE.negativePromptBuilder = function(category, secondaryCategories, categoryCandidates){
    var extra = (NEGATIVE_EXTRA_BY_CATEGORY[category] || []).slice();
    var candidateByName = {};
    (categoryCandidates||[]).forEach(function(c){ candidateByName[c.category]=c; });
    (secondaryCategories||[]).forEach(function(sec){
      if(!qualifiesForNegativeMerge(candidateByName[sec])) return;
      (NEGATIVE_EXTRA_BY_CATEGORY[sec] || []).forEach(function(item){
        if(extra.indexOf(item)===-1) extra.push(item);
      });
    });
    var base = NEGATIVE_BASE.slice();
    extra.forEach(function(item){
      (NEGATIVE_SUPERSEDES[item]||[]).forEach(function(superseded){
        var idx = base.indexOf(superseded);
        if(idx>=0) base.splice(idx,1);
      });
    });
    return base.concat(extra).join(', ');
  };

  /* ══════════════════════════════════════════════════════════════
     7. Thumbnail Prompt Builder — Phase 11.2: 9단계 고정 순서로 재조립.
        Composition(변형)과 Art Direction(스타일)이 서로 다른 어휘를 쓰므로
        구조적으로 단어가 겹치지 않는다.
     ══════════════════════════════════════════════════════════════ */
  var VARIANT_TYPES = [
    { id:'editorial-illustration', label:'Editorial Illustration' },
    { id:'product-mockup-focus', label:'Product Mockup Focus' },
    { id:'character-scene-focus', label:'Character/Scene Focus' },
    { id:'conceptual-metaphor', label:'Conceptual Metaphor' },
    { id:'bold-minimal-advertising', label:'Bold Minimal Advertising' }
  ];
  /* Composition(step2) — variant 전용 구도 표현. 스타일 이름을 절대 포함하지 않는다. */
  var VARIANT_COMPOSITION_PHRASE = {
    'editorial-illustration': 'framed as a wide establishing composition',
    'product-mockup-focus': 'framed as a close-up, product-focused composition',
    'character-scene-focus': 'framed as a mid-action storytelling composition',
    'conceptual-metaphor': 'framed as an abstract, symbolic composition',
    'bold-minimal-advertising': 'framed as a bold, minimal composition with ample surrounding empty space'
  };
  var VARIANT_HAS_ENVIRONMENT = { 'editorial-illustration':true, 'product-mockup-focus':true, 'character-scene-focus':true, 'conceptual-metaphor':false, 'bold-minimal-advertising':false };
  /* Text restriction(step9) — "No embedded text"가 정확히 한 번만 등장하고,
     변형별 안전 보조 문구가 뒤따른다. */
  var VARIANT_TEXT_RESTRICTION = {
    'editorial-illustration': 'No embedded text; keep the background free of any text.',
    'product-mockup-focus': 'No embedded text; product pages shown blank or with simple non-legible marks only.',
    'character-scene-focus': 'No embedded text; natural hands and anatomy, no distortion.',
    'conceptual-metaphor': 'No embedded text; no literal people or objects beyond the metaphor.',
    'bold-minimal-advertising': 'No embedded text; minimal geometric shapes only, no clutter.'
  };
  var MOBILE_LEGIBILITY = 'staying legible at small mobile thumbnail sizes';
  var DIMS_4_3 = '4:3 aspect ratio, 652×488px';

  /* Phase 11.4: "Rendered as a X." 템플릿을 모든 스타일에 기계적으로 적용하면
     "Rendered as a clean product advertising."처럼 관사/가산명사 규칙이
     맞지 않는 문장이 나온다("advertising"/"art"는 이 문맥에서 불가산). 스타일
     이름의 마지막 단어(illustration/collage/scene 등 가산명사)는 기존
     템플릿이 문법적으로 맞으므로 그대로 두고, 예외 2건만 별도 템플릿을 쓴다.
     Thumbnail/Sales Page 둘 다 이 헬퍼 하나를 공유한다 — 어떤 스타일이
     선택되는지(effectiveArtDirection 결정)는 전혀 바꾸지 않고, 이미 결정된
     스타일 이름을 문장으로 바꾸는 표현만 교정한다. */
  var RENDER_SENTENCE_OVERRIDE = {
    'clean product advertising': function(){ return 'Designed in a clean product-advertising style.'; },
    'minimal conceptual art': function(){ return 'Rendered as minimal conceptual art.'; }
  };
  function renderArtDirectionSentence(style){
    if(RENDER_SENTENCE_OVERRIDE[style]) return RENDER_SENTENCE_OVERRIDE[style]();
    return 'Rendered as a '+style+'.';
  }

  function mainSubjectForVariant(variantId, strategy, lib){
    if(variantId==='product-mockup-focus') return lib.mockup;
    if(variantId==='conceptual-metaphor') return lib.metaphor;
    if(variantId==='bold-minimal-advertising') return lib.boldSymbol;
    return strategy.visualSubject; /* editorial-illustration, character-scene-focus */
  }

  function buildThumbnailVariantPrompt(variantId, strategy, category, effectiveArtDirection){
    var lib = CATEGORY_LIBRARY[category] || CATEGORY_LIBRARY.neutral;
    var safeArea = strategy._thumbnailSafeArea;
    var mainSubject = mainSubjectForVariant(variantId, strategy, lib);
    var composition = VARIANT_COMPOSITION_PHRASE[variantId];
    var hasEnv = VARIANT_HAS_ENVIRONMENT[variantId];

    var s1 = cap1(mainSubject)+', '+composition+(hasEnv ? (', set in '+strategy.environment) : '')+'.';
    var s2 = renderArtDirectionSentence(effectiveArtDirection);
    var s3 = cap1(strategy.colorDirection)+', '+strategy.lightingDirection+'.';
    var s4 = 'Evokes '+strategy.emotionalGoal+'.';
    var s5 = safeArea;
    var s6 = DIMS_4_3+', '+MOBILE_LEGIBILITY+'.';
    var s7 = VARIANT_TEXT_RESTRICTION[variantId];

    return [s1,s2,s3,s4,s5,s6,s7].join(' ');
  }

  AVPE.thumbnailPromptBuilder = function(strategy, category, negativePrompt, thumbnailSafeArea){
    strategy = Object.assign({}, strategy, { _thumbnailSafeArea: thumbnailSafeArea });
    return VARIANT_TYPES.map(function(v, idx){
      var artDir = AVPE.effectiveArtDirectionResolver(v.id, strategy.artDirection, strategy.styleCandidates);
      return {
        id: 'thumb-'+(idx+1),
        variantType: v.id,
        variantLabel: v.label,
        baseArtDirection: strategy.artDirection,
        effectiveArtDirection: artDir.effectiveArtDirection,
        artDirectionReason: artDir.reason,
        prompt: buildThumbnailVariantPrompt(v.id, strategy, category, artDir.effectiveArtDirection),
        negativePrompt: negativePrompt,
        aspectRatio: '4:3',
        width: 652,
        height: 488
      };
    });
  };

  /* ══════════════════════════════════════════════════════════════
     8. Prompt Variant Evaluator — Phase 11.1의 10기준 판단 로직은 그대로
        유지하고, Phase 11.2: 모든 criterion을 0~10으로 clamp, totalScore를
        {rawScore, normalizedScore, maxScore:100} 구조로 보존한다(criterion을
        전부 clamp한 뒤 합산하므로 rawScore===normalizedScore이며 100을
        넘지 않는다 — 별도 스케일링이 필요 없을 만큼 상한을 원천 차단했다).
     ══════════════════════════════════════════════════════════════ */
  var STRUCTURAL_BASE = {
    'editorial-illustration':   { safeAreaQuality:8, mobileVisibility:6, generationFeasibility:8 },
    'product-mockup-focus':     { safeAreaQuality:8, mobileVisibility:8, generationFeasibility:9 },
    'character-scene-focus':    { safeAreaQuality:7, mobileVisibility:5, generationFeasibility:6 },
    'conceptual-metaphor':      { safeAreaQuality:8, mobileVisibility:7, generationFeasibility:7 },
    'bold-minimal-advertising': { safeAreaQuality:9, mobileVisibility:10, generationFeasibility:9 }
  };
  var VARIANT_SUBJECT_WEIGHT = {
    'editorial-illustration':   { scene:.40, document:.20, abstract:.15, warmth:.15, premium:.10 },
    'product-mockup-focus':     { scene:.05, document:.55, abstract:.05, warmth:.05, premium:.30 },
    'character-scene-focus':    { scene:.50, document:.05, abstract:.05, warmth:.35, premium:.05 },
    'conceptual-metaphor':      { scene:.05, document:.05, abstract:.70, warmth:.10, premium:.10 },
    'bold-minimal-advertising': { scene:.05, document:.15, abstract:.35, warmth:.05, premium:.40 }
  };
  var PRODUCT_COMM_MULTIPLIER = { 'editorial-illustration':.7, 'product-mockup-focus':1.0, 'character-scene-focus':.4, 'conceptual-metaphor':.25, 'bold-minimal-advertising':.5 };
  var EMOTIONAL_FIT_MULTIPLIER = { 'editorial-illustration':.9, 'product-mockup-focus':.4, 'character-scene-focus':1.0, 'conceptual-metaphor':.85, 'bold-minimal-advertising':.5 };
  var AUDIENCE_FIT_MODIFIER = { 'editorial-illustration':1, 'product-mockup-focus':0, 'character-scene-focus':2, 'conceptual-metaphor':-1, 'bold-minimal-advertising':-1 };
  var BRAND_FIT_TABLE = {
    Authority:    { 'editorial-illustration':7, 'product-mockup-focus':9, 'character-scene-focus':6, 'conceptual-metaphor':6, 'bold-minimal-advertising':8 },
    Trust:        { 'editorial-illustration':8, 'product-mockup-focus':8, 'character-scene-focus':6, 'conceptual-metaphor':8, 'bold-minimal-advertising':7 },
    Relationship: { 'editorial-illustration':7, 'product-mockup-focus':5, 'character-scene-focus':9, 'conceptual-metaphor':7, 'bold-minimal-advertising':5 }
  };
  var NEUTRAL_BRAND_FIT = { 'editorial-illustration':7, 'product-mockup-focus':7, 'character-scene-focus':7, 'conceptual-metaphor':7, 'bold-minimal-advertising':7 };
  var COMPOSITION_BUCKET_BY_CATEGORY = {
    finance:'flat-doc', business:'scene-shot', technology:'abstract-shot', health:'scene-shot',
    medical:'flat-doc', parenting:'scene-shot', education:'flat-doc', lifestyle:'scene-shot',
    household:'flat-doc', energy:'abstract-shot', emotional:'scene-shot', 'self-development':'scene-shot',
    'professional-operations':'flat-doc', neutral:'abstract-shot'
  };
  var VARIANT_COMPOSITION_BUCKET_SCORE = {
    'editorial-illustration':   { 'scene-shot':8, 'flat-doc':6, 'abstract-shot':6 },
    'product-mockup-focus':     { 'scene-shot':4, 'flat-doc':9, 'abstract-shot':5 },
    'character-scene-focus':    { 'scene-shot':9, 'flat-doc':3, 'abstract-shot':3 },
    'conceptual-metaphor':      { 'scene-shot':4, 'flat-doc':4, 'abstract-shot':9 },
    'bold-minimal-advertising': { 'scene-shot':5, 'flat-doc':5, 'abstract-shot':7 }
  };
  var VARIANT_DISTINCTIVENESS_BASE = { 'editorial-illustration':7, 'product-mockup-focus':6, 'character-scene-focus':7, 'conceptual-metaphor':10, 'bold-minimal-advertising':8 };

  function weightedSum(weights, profile){
    return weights.scene*profile.scene + weights.document*profile.document + weights.abstract*profile.abstract + weights.warmth*profile.warmth + weights.premium*profile.premium;
  }

  function evaluateVariant(variantId, category, brandStrategy, hasAudience){
    var c = CATEGORY_PROFILE[category] || CATEGORY_PROFILE.neutral;
    var structural = STRUCTURAL_BASE[variantId];

    var subjectFit = clamp10(weightedSum(VARIANT_SUBJECT_WEIGHT[variantId], c));
    var productBase = c.document*0.7 + c.premium*0.3;
    var productCommunication = clamp10(productBase*PRODUCT_COMM_MULTIPLIER[variantId]);
    var emotionalBase = c.warmth*0.6 + c.abstract*0.2 + (10-c.document)*0.2;
    var emotionalFit = clamp10(emotionalBase*EMOTIONAL_FIT_MULTIPLIER[variantId]);
    var audienceFit = clamp10((hasAudience?7:5) + AUDIENCE_FIT_MODIFIER[variantId]);
    var brandFit = clamp10((BRAND_FIT_TABLE[brandStrategy]||NEUTRAL_BRAND_FIT)[variantId]);
    var bucket = COMPOSITION_BUCKET_BY_CATEGORY[category] || 'abstract-shot';
    var compositionFit = clamp10(VARIANT_COMPOSITION_BUCKET_SCORE[variantId][bucket]);
    var visualDistinctiveness = clamp10(VARIANT_DISTINCTIVENESS_BASE[variantId] + (c.abstract>=7 && variantId==='conceptual-metaphor' ? 1 : 0));
    var safeAreaQuality = clamp10(structural.safeAreaQuality);
    var mobileVisibility = clamp10(structural.mobileVisibility);
    var generationFeasibility = clamp10(structural.generationFeasibility);

    var criteria = {
      subjectFit: subjectFit, audienceFit: audienceFit, emotionalFit: emotionalFit, brandFit: brandFit,
      compositionFit: compositionFit, safeAreaQuality: safeAreaQuality, mobileVisibility: mobileVisibility,
      visualDistinctiveness: visualDistinctiveness, generationFeasibility: generationFeasibility, productCommunication: productCommunication
    };
    var rawScore = Object.keys(criteria).reduce(function(sum,k){ return sum+criteria[k]; }, 0);
    var normalizedScore = clamp(rawScore, 0, 100);
    return { criteria: criteria, rawScore: rawScore, normalizedScore: normalizedScore, maxScore: 100 };
  }

  function variantReasons(variantLabel, evalResult){
    var c = evalResult.criteria;
    return [
      variantLabel+' — 주제 적합성(subjectFit) '+c.subjectFit+'/10, 타깃 적합성(audienceFit) '+c.audienceFit+'/10, 감정 목표 적합성(emotionalFit) '+c.emotionalFit+'/10 (카테고리 프로필 기반 실측).',
      'Brand 적합성(brandFit) '+c.brandFit+'/10, 구도 적합성(compositionFit) '+c.compositionFit+'/10, 시각적 차별성(visualDistinctiveness) '+c.visualDistinctiveness+'/10.',
      '텍스트 안전 영역(safeAreaQuality) '+c.safeAreaQuality+'/10, 모바일 가독성(mobileVisibility) '+c.mobileVisibility+'/10, 생성 가능성(generationFeasibility) '+c.generationFeasibility+'/10.',
      '상품 전달력(productCommunication) '+c.productCommunication+'/10 — 카테고리의 문서/전문자료 성격(documentNeed)이 높을수록, 이 변형이 실제로 상품을 보여주는 형식일수록 높아집니다(감정·서사 중심 주제에서는 구조적으로 낮게 계산됩니다).'
    ];
  }

  AVPE.promptVariantEvaluator = function(thumbnailPrompts, category, brandStrategy, hasAudience){
    var scored = thumbnailPrompts.map(function(p){
      var evalResult = evaluateVariant(p.variantType, category, brandStrategy, hasAudience);
      return Object.assign({}, p, {
        score: evalResult.normalizedScore, rawScore: evalResult.rawScore, normalizedScore: evalResult.normalizedScore, maxScore: evalResult.maxScore,
        criteria: evalResult.criteria, reasons: variantReasons(p.variantLabel, evalResult), recommended:false
      });
    });
    var bestIdx = 0;
    for(var i=1;i<scored.length;i++){ if(scored[i].normalizedScore>scored[bestIdx].normalizedScore) bestIdx=i; }
    scored[bestIdx].recommended = true;
    return scored;
  };

  /* ══════════════════════════════════════════════════════════════
     9. Sales Page Prompt Builder — Phase 11.2: 9단계 고정 순서, 스타일은
        "Rendered as a {style}." 한 문장에서만 등장.
     ══════════════════════════════════════════════════════════════ */
  var SALES_ROLES = [
    { key:'hero', label:'Hero' },
    { key:'pain', label:'Problem / Empathy' },
    { key:'beforeAfter', label:'Existing Method Failure' },
    { key:'solution', label:'Solution' },
    { key:'toc', label:'Contents' },
    { key:'benefits', label:'Benefits' },
    { key:'targetAudience', label:'Recommended For' },
    { key:'faq', label:'FAQ / Trust' },
    { key:'cta', label:'CTA' }
  ];
  var DIMS_SALES = '1080×1350px';
  /* Composition(step2) — role 전용 구도 표현. 스타일 이름을 포함하지 않는다. */
  var ROLE_COMPOSITION_PHRASE = {
    hero: 'framed as a strong, premium first-impression composition',
    pain: 'framed as an intimate, emotionally grounded composition',
    beforeAfter: 'framed as a split before/after comparison composition',
    solution: 'framed as a step-by-step transformation composition',
    toc: 'framed as a close-up documentary composition',
    benefits: 'framed as an outcome-focused composition',
    targetAudience: 'framed as a portrait-style composition',
    faq: 'framed as an orderly, structured grid composition',
    cta: 'framed as a confident closing composition echoing the Hero shot'
  };
  var ROLE_TEXT_RESTRICTION = {
    hero: 'No embedded text.',
    pain: 'No embedded text; no fake statistics or numbers of any kind.',
    beforeAfter: 'No embedded text; no fake performance numbers or exaggerated results.',
    solution: 'No embedded text.',
    toc: 'No embedded text; blank lines or simple non-legible placeholder marks only.',
    benefits: 'No embedded text.',
    targetAudience: 'No embedded text; natural anatomy, no distortion.',
    faq: 'No embedded text; no fake reviews, certification badges, or star ratings.',
    cta: 'No embedded text.'
  };

  function mainSubjectForRole(roleKey, strategy, lib){
    if(roleKey==='pain') return lib.problem;
    if(roleKey==='beforeAfter') return 'a cluttered, disorganized version of '+strategy.environment+' transforming into a calm, organized version of the same setting';
    if(roleKey==='solution') return lib.metaphor;
    if(roleKey==='toc') return lib.mockup;
    if(roleKey==='benefits') return lib.result;
    if(roleKey==='targetAudience') return lib.persona;
    if(roleKey==='faq') return 'neatly arranged documents, checklists, and organized information cards';
    if(roleKey==='cta') return cap1(strategy.visualSubject)+' with '+lib.mockup+' prominently displayed';
    return strategy.visualSubject; /* hero */
  }
  var ROLE_HAS_ENVIRONMENT = { hero:true, pain:true, beforeAfter:false, solution:false, toc:false, benefits:true, targetAudience:true, faq:false, cta:false };

  function buildSalesRolePrompt(roleKey, strategy, category, safeAreaPhrase, effectiveArtDirection){
    var lib = CATEGORY_LIBRARY[category] || CATEGORY_LIBRARY.neutral;
    var mainSubject = mainSubjectForRole(roleKey, strategy, lib);
    var composition = ROLE_COMPOSITION_PHRASE[roleKey];
    var hasEnv = ROLE_HAS_ENVIRONMENT[roleKey];

    var s1 = cap1(mainSubject)+', '+composition+(hasEnv ? (', set in '+strategy.environment) : '')+'.';
    var s2 = renderArtDirectionSentence(effectiveArtDirection);
    var s3 = cap1(strategy.colorDirection)+', '+strategy.lightingDirection+'.';
    var s4 = 'Evokes '+strategy.emotionalGoal+'.';
    var s5 = safeAreaPhrase;
    var s6 = DIMS_SALES+'.';
    var s7 = ROLE_TEXT_RESTRICTION[roleKey];

    return [s1,s2,s3,s4,s5,s6,s7].join(' ');
  }

  var SALES_ROLE_PROFILE = {
    hero:{ topicFit:9, brandConsistency:9, textSafeArea:8, generability:8 },
    pain:{ topicFit:8, brandConsistency:7, textSafeArea:7, generability:6 },
    beforeAfter:{ topicFit:8, brandConsistency:7, textSafeArea:7, generability:6 },
    solution:{ topicFit:8, brandConsistency:8, textSafeArea:8, generability:7 },
    toc:{ topicFit:8, brandConsistency:9, textSafeArea:8, generability:9 },
    benefits:{ topicFit:8, brandConsistency:8, textSafeArea:8, generability:7 },
    targetAudience:{ topicFit:7, brandConsistency:7, textSafeArea:7, generability:6 },
    faq:{ topicFit:7, brandConsistency:8, textSafeArea:8, generability:8 },
    cta:{ topicFit:9, brandConsistency:9, textSafeArea:8, generability:8 }
  };
  function salesRoleScore(profile){
    return clamp(Math.round((profile.topicFit+profile.brandConsistency+profile.textSafeArea+profile.generability)*2.5), 0, 100);
  }
  function salesRoleReasons(roleLabel, profile){
    return [
      roleLabel+' 역할 적합성 '+profile.topicFit+'/10 수준으로 평가되었습니다.',
      'BrandProfile 일관성(공유 주인공/팔레트/조명/스타일 유지) '+profile.brandConsistency+'/10, 텍스트 안전 영역 확보 '+profile.textSafeArea+'/10 수준입니다.',
      '실제 이미지 생성 모델의 생성 가능성 '+profile.generability+'/10 수준으로 평가되었습니다.'
    ];
  }

  AVPE.salesPagePromptBuilder = function(strategy, category, negativePrompt, salesRoleSafeArea, consistencyRules){
    var carryover = buildConsistencyCarryover(consistencyRules);
    return SALES_ROLES.map(function(role, idx){
      var profile = SALES_ROLE_PROFILE[role.key];
      var artDir = AVPE.effectiveArtDirectionResolverForRole(role.key, role.label, strategy.artDirection, strategy.styleCandidates);
      var safeAreaInfo = salesRoleSafeArea(role.key, role.label);
      return {
        pageNumber: idx+1,
        role: role.label,
        roleKey: role.key,
        baseArtDirection: strategy.artDirection,
        effectiveArtDirection: artDir.effectiveArtDirection,
        artDirectionReason: artDir.reason,
        prompt: buildSalesRolePrompt(role.key, strategy, category, safeAreaInfo.phrase, artDir.effectiveArtDirection),
        negativePrompt: negativePrompt,
        width: 1080,
        height: 1350,
        score: salesRoleScore(profile),
        reasons: salesRoleReasons(role.label, profile),
        recurringSubject: consistencyRules.recurringSubject,
        recurringPalette: consistencyRules.recurringPalette,
        recurringLighting: consistencyRules.recurringLighting,
        recurringProductMockup: consistencyRules.recurringProductMockup,
        consistencyCarryover: carryover,
        safeArea: safeAreaInfo
      };
    });
  };

  /* ══════════════════════════════════════════════════════════════
     10. 일관성 규칙(Consistency Rules) — Phase 11.5: Visual DNA 구조.
         Phase 11.4까지는 forbiddenChanges에 "일러스트 스타일(artDirection)을
         장마다 바꾸지 않는다"가 있었는데, 이는 Phase 11.4부터 Sales Page
         9장이 역할에 맞는 서로 다른 effectiveArtDirection을 정당하게
         쓰는 것과 정면으로 모순됐다. 이제 "스타일(effectiveArtDirection)은
         역할에 따라 바뀔 수 있지만, 같은 상품으로 보이도록 주인공 외형·
         핵심 팔레트·조명·목업 디자인·재질/질감·카메라 무드·감정 톤(Visual
         DNA)은 유지한다"는 계약으로 재정의한다.
     ══════════════════════════════════════════════════════════════ */
  var MATERIAL_LANGUAGE_BY_STRATEGY = {
    Authority: 'matte premium paper, brushed metal, and glass surfaces',
    Trust: 'clean matte paper and simple plastic surfaces',
    Relationship: 'warm textured paper, soft fabric, and wood-grain surfaces'
  };
  var NEUTRAL_MATERIAL_LANGUAGE = 'clean matte paper and simple neutral surfaces';
  var TEXTURE_LANGUAGE_BY_STRATEGY = {
    Authority: 'a crisp, high-contrast finish with subtle fine grain',
    Trust: 'a soft, even matte finish with minimal grain',
    Relationship: 'a soft-focus finish with gentle grain and warm highlights'
  };
  var NEUTRAL_TEXTURE_LANGUAGE = 'a clean, even finish with minimal grain';
  var CAMERA_LANGUAGE_BY_STRATEGY = {
    Authority: 'a sharp, confident depth of field with clean focal separation',
    Trust: 'an even, clear depth of field with balanced focus throughout',
    Relationship: 'a soft, shallow depth of field with warm bokeh'
  };
  var NEUTRAL_CAMERA_LANGUAGE = 'a balanced depth of field with clear focal separation';
  /* shapeLanguage는 브랜드가 아니라 카테고리(장면/문서/추상)에 따른 사물
     어휘이므로 Phase 11.1의 COMPOSITION_BUCKET_BY_CATEGORY를 재사용한다. */
  var SHAPE_LANGUAGE_BY_BUCKET = {
    'scene-shot': 'organic, rounded human and object silhouettes',
    'flat-doc': 'clean rectangular document and card shapes aligned to a grid',
    'abstract-shot': 'simple geometric shapes and flowing abstract forms'
  };

  function stripArticle(s){ return String(s).replace(/^(a|an)\s+/i, ''); }

  AVPE.consistencyRulesBuilder = function(strategy, category, brandStrategy){
    var lib = CATEGORY_LIBRARY[category] || CATEGORY_LIBRARY.neutral;
    var bucket = COMPOSITION_BUCKET_BY_CATEGORY[category] || COMPOSITION_BUCKET_BY_CATEGORY.neutral;
    return {
      recurringSubject: strategy.visualSubject,
      recurringPalette: strategy.colorDirection,
      recurringLighting: strategy.lightingDirection,
      recurringProductMockup: lib.mockup,
      visualDNA: {
        characterIdentity: lib.persona,
        objectLanguage: lib.mockup,
        materialLanguage: MATERIAL_LANGUAGE_BY_STRATEGY[brandStrategy] || NEUTRAL_MATERIAL_LANGUAGE,
        shapeLanguage: SHAPE_LANGUAGE_BY_BUCKET[bucket],
        cameraLanguage: CAMERA_LANGUAGE_BY_STRATEGY[brandStrategy] || NEUTRAL_CAMERA_LANGUAGE,
        textureLanguage: TEXTURE_LANGUAGE_BY_STRATEGY[brandStrategy] || NEUTRAL_TEXTURE_LANGUAGE,
        moodContinuity: strategy.emotionalGoal
      },
      allowedArtDirectionChanges: [
        '역할에 따라 effectiveArtDirection은 달라질 수 있다',
        'Hero/Problem/Solution/Contents 등 역할에 맞는 스타일 변화를 허용한다',
        '같은 팔레트·조명·주인공·목업 디자인은 유지한다'
      ],
      forbiddenChanges: [
        '주인공 외형을 임의로 바꾸지 않음',
        '전자책 표지·목업 디자인을 바꾸지 않음',
        '핵심 팔레트를 바꾸지 않음',
        '조명 방향과 분위기를 급격히 바꾸지 않음',
        '아이콘과 그래픽 언어를 서로 무관한 스타일로 바꾸지 않음'
      ]
    };
  };

  /* Sales Page Prompt마다 붙는 "무엇이 그대로 유지되는지" 배열 — Prompt
     본문을 길게 만들지 않고 메타데이터로 전달한다(Phase 11.5 §3/§6). */
  function buildConsistencyCarryover(consistencyRules){
    var dna = consistencyRules.visualDNA;
    return [
      'same protagonist appearance',
      'same '+stripArticle(consistencyRules.recurringPalette),
      'same '+consistencyRules.recurringLighting,
      'same '+stripArticle(consistencyRules.recurringProductMockup)+' design',
      'same '+stripArticle(dna.textureLanguage),
      'same '+stripArticle(dna.cameraLanguage),
      'same emotional tone: '+dna.moodContinuity
    ];
  }

  /* ══════════════════════════════════════════════════════════════
     11. Reason Generator + Orchestrator
     ══════════════════════════════════════════════════════════════ */
  AVPE.reasonGenerator = function(input, categoryResult, strategy, thumbnailPrompts, salesPagePrompts){
    var recommended = thumbnailPrompts.filter(function(p){ return p.recommended; })[0];
    var second = thumbnailPrompts.filter(function(p){ return !p.recommended; }).sort(function(a,b){return b.normalizedScore-a.normalizedScore;})[0];
    var styleTop = strategy.styleCandidates[0], styleSecond = strategy.styleCandidates[1];
    var reasons = [];

    if(categoryResult.lowConfidenceFallback){
      reasons.push('카테고리 신호가 약해(confidence '+categoryResult.confidence+') primaryCategory를 neutral로 판단을 보류했습니다. 실제로 매칭된 후보: '+(categoryResult.secondaryCategories.join(', ')||'없음')+'. '+strategy.confidenceNote);
    } else if(categoryResult.primaryCategory==='neutral'){
      reasons.push('topic/targetAudience/sourceSummary/Marketing Copy 전체에서 매칭된 카테고리 키워드가 없어 neutral로 분류했습니다(임의 추측 없음).');
    } else {
      reasons.push('카테고리를 "'+categoryResult.primaryCategory+'"로 판단했습니다(confidence '+categoryResult.confidence+', evidenceSources: '+categoryResult.evidenceSources.join(', ')+', 매칭 근거: '+categoryResult.matchedSignals.join(', ')+'). '+categoryResult.confidenceNote
        + (categoryResult.secondaryCategories.length ? (' 2차 후보: '+categoryResult.secondaryCategories.join(', ')+'.') : ''));
    }
    reasons.push('Style은 카테고리 5속성 프로필("'+categoryResult.primaryCategory+'")과 BrandProfile.brandStrategy("'+(input.brandStrategy||'없음')+'"), Thumbnail Pattern, Information Density를 함께 점수화해 "'+styleTop.style+'"(정규화 점수 '+styleTop.normalizedScore+'/100)을 선택했습니다'
      + (styleSecond ? ('. 2위는 "'+styleSecond.style+'"(점수 '+styleSecond.normalizedScore+', 격차 '+(styleTop.normalizedScore-styleSecond.normalizedScore)+')였습니다.') : '.'));
    reasons.push('카테고리 라이브러리에서 실제 topic/targetAudience를 반영한 메인 비주얼("'+strategy.visualSubject+'")과 환경("'+strategy.environment+'")을 선택했습니다.');
    reasons.push('BrandProfile.brandStrategy에 따라 색상을 "'+strategy.colorDirection+'", 조명을 "'+strategy.lightingDirection+'"로 정했습니다.');
    reasons.push('Composition(구도)과 Art Direction(스타일)을 서로 다른 문장·어휘로 분리해 "premium infographic illustration close-up product-advertising composition" 같은 기계적 중복 연결을 방지했습니다.');
    var effectiveSet = Array.from(new Set(thumbnailPrompts.map(function(p){ return p.effectiveArtDirection; })));
    reasons.push('대표 스타일("'+strategy.artDirection+'")을 5개 Variant에 그대로 재사용하지 않고, Variant별 호환도(0~10)와 카테고리 적합도를 함께 계산해 Variant마다 effectiveArtDirection을 따로 정했습니다(실제 사용된 스타일 '+effectiveSet.length+'종: '+effectiveSet.join(', ')+').');
    reasons.push('한글 문장을 이미지에 직접 그리게 하지 않기 위해 Thumbnail/Sales Page Blueprint의 실제 배치 값을 참조한 Text Safe Area를 모든 프롬프트에 적용했고, "No embedded text"는 각 프롬프트당 정확히 1회만 등장하도록 정리했습니다.');
    reasons.push('Negative Prompt에 기본 18개 금지 항목과 카테고리별 추가 항목을 적용해 가짜 후기·수치·인증·매출 보장 요소를 차단했습니다.');
    if(salesPagePrompts){
      var salesEffectiveSet = Array.from(new Set(salesPagePrompts.map(function(p){ return p.effectiveArtDirection; })));
      reasons.push('Sales Page 9장도 대표 스타일 하나로 고정하지 않고 Role별 호환도로 effectiveArtDirection을 따로 정했습니다(실제 사용된 스타일 '+salesEffectiveSet.length+'종: '+salesEffectiveSet.join(', ')+'). 다만 주인공 외형·핵심 팔레트·조명·목업 디자인 등 Visual DNA는 모든 장에서 동일하게 유지되며, 이는 Consistency Rules의 forbiddenChanges/allowedArtDirectionChanges로 명시했습니다.');
    }
    if(recommended){
      reasons.push('Thumbnail Prompt 5종을 10개 기준(0~10 clamp 후 합산, 0~100)으로 실측 평가한 결과 "'+recommended.variantLabel+'"(점수 '+recommended.normalizedScore+'/100)이 최고점을 받았습니다'
        + (second ? ('. 2위는 "'+second.variantLabel+'"(점수 '+second.normalizedScore+', 격차 '+(recommended.normalizedScore-second.normalizedScore)+')였습니다.') : '.'));
    }
    return reasons;
  };

  AVPE.run = function(rawInput){
    var input = AVPE.inputNormalizer(rawInput);
    var categoryResult = AVPE.categoryClassifier(input);
    var strategy = AVPE.visualStrategyBuilder(input, categoryResult);
    var safety = AVPE.textSafetyDirector(input.thumbnailBlueprint, input.salesPageBlueprint);
    var negativePrompt = AVPE.negativePromptBuilder(strategy.category, strategy.secondaryCategories, strategy.categoryCandidates);

    var consistencyRules = AVPE.consistencyRulesBuilder(strategy, strategy.category, input.brandStrategy);

    var thumbnailPromptsRaw = AVPE.thumbnailPromptBuilder(strategy, strategy.category, negativePrompt, safety.thumbnailSafeArea);
    var thumbnailPrompts = AVPE.promptVariantEvaluator(thumbnailPromptsRaw, strategy.category, input.brandStrategy, !!input.targetAudience);
    var salesPagePrompts = AVPE.salesPagePromptBuilder(strategy, strategy.category, negativePrompt, safety.salesRoleSafeArea, consistencyRules);
    var reasons = AVPE.reasonGenerator(input, categoryResult, strategy, thumbnailPrompts, salesPagePrompts);

    var recommended = thumbnailPrompts.filter(function(p){ return p.recommended; })[0];
    var timestamp = Date.now();

    var output = {
      version: '1.0',
      visualStrategy: strategy,
      thumbnailPrompts: thumbnailPrompts,
      salesPagePrompts: salesPagePrompts,
      consistencyRules: consistencyRules,
      metadata: {
        sourceBrandStrategy: input.brandStrategy,
        sourceThumbnailPattern: (input.thumbnailBlueprint && input.thumbnailBlueprint.pattern) || null,
        generatedAt: timestamp
      }
    };

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source: 'AIVisualPromptEngine',
        category: strategy.category,
        categoryConfidence: strategy.categoryConfidence,
        evidenceSources: strategy.evidenceSources,
        artDirection: strategy.artDirection,
        colorDirection: strategy.colorDirection,
        lightingDirection: strategy.lightingDirection,
        compositionDirection: strategy.compositionDirection,
        recommendedThumbnailId: recommended ? recommended.id : null,
        safetyMeasuresApplied: ['textSafetyDirector','negativePromptBuilder(18 base + category extras)'],
        reasons: reasons,
        timestamp: timestamp
      });
    }

    return output;
  };

})(window.AtlasAIVisualPromptEngine);
