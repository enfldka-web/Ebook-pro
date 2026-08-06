/* creative-campaign-engine.js — Milestone 3.2 Phase 12: Creative Campaign Engine
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md, Phase 12 사용자 스펙(2026-07)

   이 Engine은 이미지를 생성하지 않는다. 실제 Claude Design 생성 API를 호출하지도
   않는다. Phase 11.5의 AI Visual Prompt Engine(카테고리 분류/Style/Variant 호환도/
   Thumbnail Prompt 5개/Sales Page Prompt 9개/effectiveArtDirection/Safe Area/
   Visual DNA/consistencyCarryover/Negative Prompt) 결과는 전부 읽기 전용 입력으로만
   사용하고 절대 재계산하거나 mutate하지 않는다 — Creative Campaign Engine은 그 위에
   "광고 대행사 Creative Director/Art Director 수준의 캠페인 전략과 Claude Design
   제작 Brief"를 추가하는 상위 레이어다.

   내부 구조: Input Normalizer → Product Truth Extractor → Audience Insight
   Director → Campaign Positioning Director → Big Idea Generator → Visual Story
   Director → Subject Director → Environment Director → Product Mockup Director
   → Composition Director → Photography/Illustration(Medium) Director → Lighting
   and Color Director → Emotional Direction Director → Typography Overlay
   Director → Thumbnail Concept Director → Sales Page Storyboard Director →
   Claude Design Brief Builder → Campaign Consistency Director → Concept
   Evaluator → Reasoning Service.

   핵심 원칙(사용자 스펙 §3): 주제를 장식 요소로 나열하지 않는다("부업이니까 노트북과
   동전", "육아니까 체크리스트 아이콘" 같은 접근 금지). 대신 독자의 현재 상태 →
   전자책을 통한 변화 → 그 변화를 보여주는 한 장면을 먼저 설계한다. 이를 위해
   카테고리별로 "Big Idea 유형(archetype) 10종 풀에서 그 카테고리에 실제로 맞는
   5종을 점수化해 선택"하는 방식을 쓴다 — 모든 주제에 같은 5개 유형을 이름만 바꿔
   쓰지 않는다(ARCHETYPE_POOL + ARCHETYPE_PROFILE + CATEGORY_CREATIVE.profile의
   dot-product 선택).

   하지 않는 것(사용자 스펙 §24): 실제 이미지 생성 API 호출, 다른 이미지 Provider
   연결, HTML/CSS/SVG로 최종 광고 이미지 재현, Phase 10 Renderer 복구, 승인되지
   않은 카피 신규 생성, 근거 없는 매출/수익/후기/자격 생성, Phase 11.5 수정. */

window.AtlasCreativeCampaignEngine = window.AtlasCreativeCampaignEngine || {};

(function(CCE){

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
  function clamp10(n){ return clamp(Math.round(n*10)/10, 0, 10); }
  function cap1(s){ return s ? (String(s).charAt(0).toUpperCase()+String(s).slice(1)) : s; }
  function pick(obj, key, fallback){ return (obj && obj[key]!==undefined && obj[key]!==null) ? obj[key] : fallback; }

  /* 한글 조사(이/가, 을/를, 은/는, 와/과) 선택 — CATEGORY_CREATIVE의 각 필드(persona/
     currentState/heroObject 등)는 카테고리마다 마지막 글자의 받침 유무가 다르므로,
     조사를 고정 문자열로 이어붙이면 문법 오류가 생긴다(예: "직장인가" 대신 "직장인이").
     유니코드 한글 음절 블록(0xAC00~0xD7A3) 연산으로 받침 유무를 판별한다. */
  function hasBatchim(str){
    var s = String(str||'').trim();
    if(!s) return false;
    var code = s.charCodeAt(s.length-1);
    if(code<0xAC00||code>0xD7A3) return false;
    return (code-0xAC00)%28!==0;
  }
  function josaIGa(s){ return hasBatchim(s)?'이':'가'; }
  function josaEulReul(s){ return hasBatchim(s)?'을':'를'; }
  function josaEunNeun(s){ return hasBatchim(s)?'은':'는'; }
  function josaWaGwa(s){ return hasBatchim(s)?'과':'와'; }
  function josaEuroRo(s){
    var t = String(s||'').trim();
    if(!t) return '로';
    var code = t.charCodeAt(t.length-1);
    if(code<0xAC00||code>0xD7A3) return '로';
    var finalIdx = (code-0xAC00)%28;
    if(finalIdx===0 || finalIdx===8) return '로'; /* 받침 없음 또는 받침이 ㄹ */
    return '으로';
  }

  /* Phase 12.2 §2: 문법 검사 통과 여부를 고정 문자열 목록만으로 주장하지 않는다.
     실제 유니코드 받침 판별로 가/를/과/와/로 조사가 앞 글자의 받침 유무와
     일치하는지 전수 검사하고(문장 조립 과정에서 항상 발생 가능한 실수 클래스),
     그 위에 실제로 발견된 비문·boilerplate 문자열 목록도 함께 검사한다. */
  var JOSA_AGREEMENT_CHECKS = [
    { re: /([가-힣])가(?=[\s,.\)"'」]|$)/g, requireBatchim: false, label: '가(받침 없는 글자 뒤에만 와야 함)' },
    { re: /([가-힣])이(?=[\s,.\)"'」]|$)/g, requireBatchim: true, label: '이(받침 있는 글자 뒤에만 와야 함)' },
    { re: /([가-힣])를(?=[\s,.\)"'」]|$)/g, requireBatchim: false, label: '를(받침 없는 글자 뒤에만 와야 함)' },
    { re: /([가-힣])을(?=[\s,.\)"'」]|$)/g, requireBatchim: true, label: '을(받침 있는 글자 뒤에만 와야 함)' },
    { re: /([가-힣])과(?=[\s,.\)"'」]|$)/g, requireBatchim: true, label: '과(받침 있는 글자 뒤에만 와야 함)' },
    { re: /([가-힣])와(?=[\s,.\)"'」]|$)/g, requireBatchim: false, label: '와(받침 없는 글자 뒤에만 와야 함)' }
    /* 은/는은 의도적으로 접미사 정규식 스캔에서 제외한다: "-는"은 조사(topic
       marker)일 수도 있지만 "있는/하는/돕는/정하는"처럼 동사·형용사 관형사형
       어미로도 극히 흔하게 쓰여, 위치 기반 정규식으로는 정상적인 한국어 문장을
       대량으로 오탐(false positive)한다(실제로 이 문제로 finance positioning
       문장 등 정상 문장이 전부 위반으로 잘못 표시됨을 확인). 이 코드베이스는
       은/는을 문자열 접합으로 만드는 지점이 전혀 없다(josaEunNeun 헬퍼가 정의는
       되어 있지만 어디서도 호출되지 않음 — grep으로 확인) — 즉 은/는 접합 버그가
       발생할 수 있는 코드 경로 자체가 없다. 따라서 은/는은 소스 차원에서
       "josaEunNeun 헬퍼를 거치지 않은 하드코딩 접합이 없는지"로 검증한다
       (test_phase12_3_node.js의 정적 grep 검사). */
  ];
  var LANGUAGE_BAD_PHRASES = [
    '모습다가', '순간다가', '상태다가', '차 한 잔에서 보내는', '장면으로 전혀 다른 각도의 장면',
    '모습을 자신감 있는 자세로 마주하고 있는', '되고 싶어하는 모습', '구도 이라는', '전자책다',
    '모습를', '가이드을', '이전 장면에서 이어지는 흐름', '다음 장면으로 이어지는 흐름', '원하는 독자상에 대입',
    '함께 배치해 장면을 보강한다', '일정표을', '구도을', '대비을', '체크리스트을', '상태을', '페이지이', '체크리스트이'
  ];
  /* 접미사 위치 기반 조사 검사기는 형태소 분석이 아니므로 "창가/전문가/뭔가/요가/
     아이"처럼 마지막 글자가 우연히 조사와 같은 완성형 단어를 실제 조사 오류로
     오판할 수 있다. 실제 CATEGORY_CREATIVE 저작 어휘에서 확인된(또는 같은 패턴으로
     예견되는) 합성어만 한정적으로 예외 처리한다. */
  var LANGUAGE_CHECK_EXCEPTIONS = ['창가', '전문가', '뭔가', '요가', '누군가', '무언가', '아이', '나이', '모이', '놀이', '먹이', '오이'];
  function endsWithException(text, endPos){
    return LANGUAGE_CHECK_EXCEPTIONS.some(function(w){
      return text.slice(Math.max(0, endPos-w.length), endPos) === w;
    });
  }
  /* Phase 12.3 §3: 조사 검사기를 field 단위로 스캔해 실제 fieldPath를 남긴다
     (문자열 전체를 이어붙여 위치만 보고하던 방식은 어느 필드가 문제인지 알 수
     없어 재발 방지에 도움이 안 됐다). */
  function scanTextForViolations(text, watchPhrases){
    text = String(text||'');
    var out = [];
    JOSA_AGREEMENT_CHECKS.forEach(function(chk){
      chk.re.lastIndex = 0;
      var m;
      while((m = chk.re.exec(text))){
        var particleEnd = m.index + m[1].length + 1;
        if(endsWithException(text, particleEnd)) continue;
        var bc = hasBatchim(m[1]);
        if(bc!==chk.requireBatchim){
          out.push({ issueType: chk.label, offendingFragment: text.slice(Math.max(0,m.index-6), particleEnd) });
        }
      }
    });
    var euroRe = /([가-힣])로(?=[\s,.\)"'」]|$)/g;
    var m2;
    while((m2 = euroRe.exec(text))){
      var particleEnd2 = m2.index + m2[1].length + 1;
      if(endsWithException(text, particleEnd2)) continue;
      var code = m2[1].charCodeAt(0);
      if(code<0xAC00||code>0xD7A3) continue;
      var finalIdx = (code-0xAC00)%28;
      if(finalIdx!==0 && finalIdx!==8){
        out.push({ issueType: '로(받침 있으면 으로여야 함, ㄹ 받침 제외)', offendingFragment: text.slice(Math.max(0,m2.index-6), particleEnd2) });
      }
    }
    LANGUAGE_BAD_PHRASES.forEach(function(phrase){
      var idx = text.indexOf(phrase);
      if(idx>=0) out.push({ issueType: '금지된 비문/boilerplate 패턴: '+phrase, offendingFragment: phrase });
    });
    /* 동일 명사구가 이 필드 안에서 불필요하게 2회 이상 반복되는지(이번 run의 실제
       category 소재 어휘 기준으로만 검사 — 일반 한국어 사전 기반 아님) */
    (watchPhrases||[]).forEach(function(p){
      if(!p || p.length<4) return;
      var count = 0, idx = -1;
      while((idx = text.indexOf(p, idx+1))>=0) count++;
      if(count>=2) out.push({ issueType: '동일 명사구 반복(2회 이상)', offendingFragment: p });
    });
    return out;
  }
  /* fields: [{path, text, watchPhrases}]. checkedFieldCount는 실제로 텍스트가 있어
     검사된 필드 수만 센다(빈 필드 제외). violations:0일 때만 ok:true. */
  CCE.languageQualityCheck = function(fields){
    var list = Array.isArray(fields) ? fields : [{ path:'text', text:fields }];
    var violations = [];
    var checkedFieldCount = 0;
    list.forEach(function(f){
      if(!f || !f.text) return;
      checkedFieldCount++;
      var text = String(f.text);
      scanTextForViolations(text, f.watchPhrases).forEach(function(v){
        violations.push({ fieldPath: f.path||'', text: text, issueType: v.issueType, offendingFragment: v.offendingFragment });
      });
    });
    return { ok: violations.length===0, checkedFieldCount: checkedFieldCount, violations: violations };
  };

  /* ══════════════════════════════════════════════════════════════
     0. Category Creative Library — AVPE의 CATEGORY_LIBRARY(closure 비공개)와는
        별도로, "광고 장면 설계"에 필요한 더 풍부한 소재를 이 Engine 전용으로
        보유한다. AVPE의 카테고리 분류 결과(문자열 category 값)는 입력으로 그대로
        재사용하고, 여기서는 그 카테고리에 대한 "장면 재료"만 정의한다.
     ══════════════════════════════════════════════════════════════ */
  var CATEGORY_CREATIVE = {
    finance: {
      productType: '실행형 부업 로드맵 전자책',
      persona: '퇴근 후 한두 시간만 낼 수 있는 직장인',
      currentState: '무엇부터 시작할지 몰라 여러 정보를 뒤적이다 지쳐 있는 모습',
      transformedState: '순서가 정리된 계획표를 보며 다음 행동을 확신하는 모습',
      symbolicObject: '흩어진 메모들이 하나의 정돈된 로드맵 한 장으로 모이는 장면',
      heroObject: '체크리스트와 진행 표시가 담긴 전자책 표지 목업',
      setting: '퇴근 직후의 조용한 식탁, 노트북 옆에 정리된 일정표',
      visualRecognitionCues: ['정돈된 로드맵/체크리스트 형태', '차분한 저녁 조명', '신뢰감 있는 문서 레이아웃'],
      competitiveVisualAngle: '막연한 "돈 버는 이미지"가 아니라 "실행 순서가 보이는 이미지"로 차별화',
      premiumSignal: '군더더기 없는 문서형 레이아웃과 절제된 색 대비',
      trustSignal: '실제 진행 단계가 보이는 체크리스트/로드맵 형태',
      emotionalTone: '차분한 확신',
      hiddenFrustration: '여러 부업 정보를 저장만 해두고 정작 하나도 실행하지 못했다는 자책',
      desiredIdentity: '무엇을 먼저 해야 할지 스스로 판단할 수 있는 사람',
      purchaseTrigger: '또 저장만 하고 끝낼 바에는 순서표 하나라도 따라가 보자는 마음이 드는 순간',
      purchaseAnxiety: '과장된 수익 광고처럼 이번에도 시간과 돈만 쓰고 끝날까 봐 걱정',
      singleMindedMessage: '부업의 종류를 고르기 전에, 나에게 맞는 실행 순서부터 정한다',
      positioningStatement: '퇴근 후 낼 수 있는 시간이 제한된 직장인이 여러 부업 정보를 무작정 따라 하지 않고, 우선순위와 실행 순서를 먼저 정해 첫 단계부터 시작하도록 돕는 실행형 부업 로드맵 전자책이다.',
      subjectRequired: true,
      subjectNotes: '20~30대 한국인 직장인, 편안한 홈웨어 또는 캐주얼 셔츠, 과장된 미소 대신 집중한 표정',
      profile: { humanCentered:6, productCentered:6, abstract:3, emotional:5, authoritative:7 }
    },
    business: {
      productType: '실전 성장 전략 전자책',
      persona: '방향이 흔들리는 소규모 사업 운영자',
      currentState: '여러 계획이 뒤섞여 우선순위를 정하지 못하는 모습',
      transformedState: '하나의 명확한 성장 축을 손끝으로 짚어 보여주는 모습',
      symbolicObject: '흩어진 화살표들이 하나의 상승 곡선으로 정렬되는 장면',
      heroObject: '전략 플레이북과 체크리스트가 함께 놓인 목업',
      setting: '미니멀한 사무 공간, 정돈된 데스크 위 전략 문서',
      visualRecognitionCues: ['상승 곡선/그리드 요소', '절제된 오피스 톤', '전문적인 문서 배치'],
      competitiveVisualAngle: '화려한 성공 이미지 대신 "명확한 전략 한 장"으로 차별화',
      premiumSignal: '건축적인 라인과 여백',
      trustSignal: '단계별로 구조화된 전략 문서 형태',
      emotionalTone: '절제된 자신감',
      hiddenFrustration: '여러 전략 아이디어를 시도하다 정작 무엇에 집중해야 할지 흐려짐',
      desiredIdentity: '하나의 성장 축을 명확히 설명할 수 있는 운영자',
      purchaseTrigger: '이번 분기도 같은 자리에 머물러 있다는 것을 인정하게 되는 순간',
      purchaseAnxiety: '전략을 또 바꿔도 결국 실행이 흐지부지될까 봐 걱정',
      singleMindedMessage: '더 많은 전략이 아니라, 지금 집중할 단 하나의 축을 정한다',
      positioningStatement: '성장 방향이 흔들리는 소규모 사업 운영자가 여러 전략을 동시에 좇지 않고, 지금 집중할 단 하나의 축을 정해 실행에 옮기도록 돕는 실전 성장 전략 전자책이다.',
      subjectRequired: true,
      subjectNotes: '30~40대, 단정한 비즈니스 캐주얼, 확신에 찬 시선',
      profile: { humanCentered:5, productCentered:6, abstract:4, emotional:3, authoritative:8 }
    },
    technology: {
      productType: '실무 도구 활용 가이드 전자책',
      persona: '새 도구 앞에서 압도당하는 실무자',
      currentState: '너무 많은 설정과 옵션 속에서 무엇을 눌러야 할지 모르는 모습',
      transformedState: '하나의 단순한 워크플로우만 남기고 편안하게 작업하는 모습',
      symbolicObject: '복잡하게 얽힌 노드들이 하나의 선명한 경로로 정리되는 장면',
      heroObject: '워크플로우 다이어그램과 설정 가이드 목업',
      setting: '차분한 색 온도의 미니멀 워크스페이스',
      visualRecognitionCues: ['연결된 노드/경로 그래픽', '차가운 톤의 조명', '깔끔한 인터페이스 여백'],
      competitiveVisualAngle: '기능 나열이 아니라 "하나의 쉬운 경로"라는 인상으로 차별화',
      premiumSignal: '미니멀하고 정제된 라인 워크',
      trustSignal: '단계별로 표시된 설정 가이드',
      emotionalTone: '안도감',
      hiddenFrustration: '새 도구를 켤 때마다 옵션이 너무 많아 어디서부터 만져야 할지 모름',
      desiredIdentity: '필요한 기능만 골라 편하게 쓰는 사람',
      purchaseTrigger: '이번에도 설정만 만지다 시간을 다 썼다는 것을 깨닫는 순간',
      purchaseAnxiety: '결국 예전 방식으로 되돌아가고 배운 것이 무용지물이 될까 봐 걱정',
      singleMindedMessage: '모든 기능을 익히는 것이 아니라, 하나의 쉬운 경로만 남긴다',
      positioningStatement: '새 도구 앞에서 압도당하는 실무자가 모든 기능을 익히려 하지 않고, 꼭 필요한 하나의 워크플로우만 정해 편하게 적용하도록 돕는 실무 도구 활용 가이드 전자책이다.',
      subjectRequired: true,
      subjectNotes: '20~30대 실무자, 캐주얼한 톤, 편안해진 표정',
      profile: { humanCentered:5, productCentered:6, abstract:6, emotional:3, authoritative:6 }
    },
    health: {
      subjectRequired: true,
      productType: '생활 습관 개선 가이드 전자책',
      persona: '의욕은 있지만 꾸준히 이어가지 못하는 사람',
      currentState: '흐트러진 자세로 지친 하루를 마무리하는 모습',
      transformedState: '가벼운 스트레칭 후 편안하게 웃는 모습',
      symbolicObject: '흐릿했던 해가 점점 선명해지는 일출 장면',
      heroObject: '습관 기록 저널과 체크리스트 목업',
      setting: '아침 햇살이 드는 홈 웰니스 공간, 요가 매트 한 장',
      visualRecognitionCues: ['자연광', '요가 매트/저널', '가벼운 스트레칭 동작'],
      competitiveVisualAngle: '과장된 "다이어트 전후" 대신 "일상적인 회복"으로 차별화',
      premiumSignal: '자연광과 절제된 색감',
      trustSignal: '실제 습관 기록 형태의 체크리스트',
      emotionalTone: '가벼운 회복감',
      hiddenFrustration: '의욕은 여러 번 생겼지만 매번 며칠을 못 넘기고 흐지부지됨',
      desiredIdentity: '무리하지 않고도 꾸준히 이어가는 사람',
      purchaseTrigger: '몸이 예전 같지 않다는 것을 문득 느끼는 순간',
      purchaseAnxiety: '이번에도 작심삼일로 끝나고 시간만 들이고 효과는 없을까 봐 걱정',
      singleMindedMessage: '큰 변화가 아니라, 오늘 하루도 이어갈 수 있는 작은 습관을 만든다',
      positioningStatement: '의욕은 있지만 꾸준히 이어가지 못하는 사람이 무리한 계획을 세우지 않고, 오늘 할 수 있는 작은 습관부터 정해 하루하루 이어가도록 돕는 생활 습관 개선 가이드 전자책이다.',
      subjectNotes: '자연스러운 표정과 자세, 과장된 신체 변형 없음, 실제 운동 동작 기반',
      profile: { humanCentered:8, productCentered:3, abstract:3, emotional:8, authoritative:3 }
    },
    medical: {
      subjectRequired: false,
      productType: '실무 매뉴얼형 전자책',
      persona: '정확한 절차를 확인해야 하는 실무 담당자',
      currentState: '여러 문서에 흩어진 절차를 일일이 대조하는 모습',
      transformedState: '하나의 정리된 매뉴얼로 빠르게 확인하는 모습',
      symbolicObject: '여러 서류가 하나의 정돈된 매뉴얼로 정렬되는 장면',
      heroObject: '절차 매뉴얼과 체크리스트가 정돈되게 놓인 목업',
      setting: '정돈된 사무 데스크 위 참고 자료',
      visualRecognitionCues: ['정돈된 문서 스택', '중립적인 사무 톤', '체크리스트 형태'],
      competitiveVisualAngle: '의료 이미지(병원/의료진 연출)를 피하고 "문서·프로세스 신뢰성"으로 차별화',
      premiumSignal: '절제된 문서 레이아웃과 여백',
      trustSignal: '실제 절차가 드러나는 체크리스트 형태',
      emotionalTone: '차분한 신뢰',
      hiddenFrustration: '여러 문서를 오가며 같은 절차를 매번 다시 대조해야 하는 번거로움',
      desiredIdentity: '기준을 정확히 확인하고 실수 없이 처리하는 담당자',
      purchaseTrigger: '사소한 확인 누락으로 같은 작업을 다시 처리했던 경험이 반복될 때',
      purchaseAnxiety: '잘못 적용하면 책임 소재가 불분명해질까 봐 걱정',
      singleMindedMessage: '기억에 의존하지 않고, 확인 가능한 절차대로 처리한다',
      positioningStatement: '여러 문서를 오가며 절차를 대조해야 하는 실무 담당자가 기억에 의존하지 않고, 확인 가능한 기준을 정해 실수 없이 처리하도록 돕는 실무 매뉴얼형 전자책이다.',
      subjectNotes: '',
      prohibitedDepictions: ['의료 행위 연출', '환자·의료진 묘사', '의료 인증/자격 이미지'],
      profile: { humanCentered:2, productCentered:8, abstract:2, emotional:2, authoritative:8 }
    },
    parenting: {
      subjectRequired: true,
      productType: '초보 부모용 실행 체크리스트 전자책',
      persona: '처음 육아를 시작해 무엇을 챙겨야 할지 불안한 부모',
      currentState: '여러 육아 정보 사이에서 우선순위를 못 정해 초조한 모습',
      transformedState: '체크리스트를 짚어가며 안정적으로 하루를 준비하는 모습',
      symbolicObject: '흩어진 메모가 하나의 체크리스트로 정리되는 장면',
      heroObject: '육아 체크리스트와 일정표가 함께 놓인 목업',
      setting: '따뜻한 오전 햇살이 드는 아늑한 거실 한켠',
      visualRecognitionCues: ['체크리스트/일정표 형태', '따뜻한 오전 톤', '아늑한 생활감'],
      competitiveVisualAngle: '막연한 육아 행복 이미지 대신 "안정적으로 챙기는 체크리스트"로 차별화',
      premiumSignal: '따뜻하지만 정돈된 색감',
      trustSignal: '실제 체크리스트/일정표 형태',
      emotionalTone: '안심',
      hiddenFrustration: '너무 많은 정보 속에서 어떤 기준을 따라야 할지 갈피를 못 잡음',
      desiredIdentity: '오늘 필요한 것부터 놓치지 않고 챙기는 부모',
      purchaseTrigger: '이러다 정말 중요한 것을 빠뜨릴 것 같다는 불안이 차오르는 순간',
      purchaseAnxiety: '전문가 조언과 다른 사람 경험담이 뒤섞여 내 선택이 맞는지 확신이 안 서는 것',
      singleMindedMessage: '모든 정보를 다 아는 것이 아니라, 오늘 필요한 항목부터 놓치지 않는다',
      positioningStatement: '처음 육아를 시작해 무엇을 챙겨야 할지 불안한 부모가 모든 정보를 다 찾아보지 않고, 오늘 필요한 항목부터 정해 빠뜨리지 않도록 돕는 초보 부모용 실행 체크리스트 전자책이다.',
      subjectNotes: '부모(20~30대), 자연스러운 표정, 아이는 과장되게 묘사하지 않음(오해 소지 있는 연출 금지)',
      prohibitedDepictions: ['특정 건강 상태 오인 소지 있는 아이 묘사', '과장된 육아 완벽주의 연출'],
      profile: { humanCentered:7, productCentered:5, abstract:2, emotional:7, authoritative:4 }
    },
    education: {
      subjectRequired: true,
      productType: '학습 정리 가이드 전자책',
      persona: '방대한 내용 앞에서 무엇을 먼저 봐야 할지 막막한 학습자',
      currentState: '흩어진 자료들을 앞에 두고 막막해하는 모습',
      transformedState: '핵심만 정리된 노트를 보며 안정적으로 학습하는 모습',
      symbolicObject: '어지러운 페이지들이 하나의 정리된 노트로 모이는 장면',
      heroObject: '요약 노트와 체크리스트가 놓인 목업',
      setting: '차분한 조명의 책상, 잘 정돈된 학습 자료',
      visualRecognitionCues: ['정리 노트/플래시카드 형태', '차분한 학습 조명', '깔끔한 책상 구성'],
      competitiveVisualAngle: '방대한 분량 대신 "핵심만 정리된 한 장"으로 차별화',
      premiumSignal: '정제된 문서 톤과 여백',
      trustSignal: '단계별 학습 체크리스트',
      emotionalTone: '안정된 집중',
      hiddenFrustration: '방대한 자료 중 어디가 핵심인지 스스로 판단하기 어려움',
      desiredIdentity: '핵심만 짚어 효율적으로 학습하는 사람',
      purchaseTrigger: '마감이 다가오는데 정리가 하나도 안 된 상태를 자각하는 순간',
      purchaseAnxiety: '정리하는 데만 시간을 다 쓰고 정작 학습할 시간이 부족해질까 봐 걱정',
      singleMindedMessage: '모든 내용을 보는 것이 아니라, 핵심만 먼저 정리한다',
      positioningStatement: '방대한 자료 앞에서 막막한 학습자가 모든 내용을 다 보려 하지 않고, 핵심만 먼저 정리해 확인하도록 돕는 학습 정리 가이드 전자책이다.',
      subjectNotes: '학습자, 자연스러운 집중 표정',
      profile: { humanCentered:5, productCentered:7, abstract:3, emotional:4, authoritative:6 }
    },
    lifestyle: {
      subjectRequired: true,
      productType: '생활 정리 가이드 전자책',
      persona: '더 나은 일상 루틴을 원하는 사람',
      currentState: '정돈되지 않은 일상 속에서 여유를 찾지 못하는 모습',
      transformedState: '정돈된 루틴 속에서 여유롭게 하루를 시작하는 모습',
      symbolicObject: '흐트러진 물건들이 정돈된 구성으로 자리 잡는 장면',
      heroObject: '루틴 플래너와 체크리스트가 놓인 목업',
      setting: '햇살이 드는 정돈된 생활 공간',
      visualRecognitionCues: ['정돈된 생활 소품', '자연광', '루틴 플래너 형태'],
      competitiveVisualAngle: '완벽한 인테리어가 아니라 "실현 가능한 정돈"으로 차별화',
      premiumSignal: '절제되고 따뜻한 색감',
      trustSignal: '실제 루틴 체크리스트 형태',
      emotionalTone: '여유',
      hiddenFrustration: '정돈하고 싶지만 무엇부터 손대야 할지 늘 막막함',
      desiredIdentity: '완벽하지 않아도 편안하게 정돈된 하루를 사는 사람',
      purchaseTrigger: '미뤄뒀던 정리가 눈에 계속 밟히는 순간',
      purchaseAnxiety: '작심하고 시작해도 예전처럼 다시 흐트러질까 봐 걱정',
      singleMindedMessage: '완벽한 정리가 아니라, 실현 가능한 루틴부터 만든다',
      positioningStatement: '정돈되지 않은 일상 속에서 여유를 찾지 못하는 사람이 완벽한 정리를 목표로 하지 않고, 실현 가능한 루틴부터 정해 하루를 시작하도록 돕는 생활 정리 가이드 전자책이다.',
      subjectNotes: '자연스러운 일상 동작, 과장된 행복 연출 지양',
      profile: { humanCentered:7, productCentered:4, abstract:3, emotional:6, authoritative:4 }
    },
    household: {
      subjectRequired: false,
      productType: '생활비 절약 가이드 전자책',
      persona: '가계 지출을 더 효율적으로 관리하고 싶은 사람',
      currentState: '여러 항목의 지출이 뒤섞여 파악이 안 되는 상태',
      transformedState: '항목별로 정리된 표를 보며 안정적으로 관리하는 상태',
      symbolicObject: '흩어진 영수증/숫자가 하나의 정돈된 표로 정리되는 장면',
      heroObject: '가계부 체크리스트와 정리 표가 놓인 목업',
      setting: '정돈된 홈 데스크, 실제 사용감 있는 가계 자료',
      visualRecognitionCues: ['정돈된 표/체크리스트', '차분한 홈 톤', '실용적인 문서 구성'],
      competitiveVisualAngle: '막연한 절약 이미지 대신 "정리된 관리 표"로 차별화',
      premiumSignal: '절제된 문서형 레이아웃',
      trustSignal: '실제 관리 체크리스트 형태',
      emotionalTone: '안정',
      hiddenFrustration: '지출 항목이 뒤섞여 어디서 새는지 파악이 안 됨',
      desiredIdentity: '항목별로 정확히 파악하고 관리하는 사람',
      purchaseTrigger: '이번 달 카드값을 보고 뭔가 잘못됐다는 것을 직감하는 순간',
      purchaseAnxiety: '가계부를 써도 작심삼일로 끝나고 습관이 안 될까 봐 걱정',
      singleMindedMessage: '무조건 아끼는 것이 아니라, 새는 곳부터 먼저 막는다',
      positioningStatement: '지출 항목이 뒤섞여 파악이 안 되는 사람이 무조건 아끼려 하지 않고, 새는 곳부터 정확히 찾아 관리하도록 돕는 생활비 절약 가이드 전자책이다.',
      subjectNotes: '',
      profile: { humanCentered:3, productCentered:7, abstract:3, emotional:3, authoritative:5 }
    },
    energy: {
      subjectRequired: false,
      productType: '전기요금 절약 실행 가이드 전자책',
      persona: '여름철 전기요금이 부담스러운 1인 가구',
      currentState: '계량기 숫자가 자꾸 신경 쓰이는 답답한 상태',
      transformedState: '실행한 항목을 체크하며 안심하는 상태',
      symbolicObject: '뜨거운 열기가 점점 식어 시원하고 효율적인 상태로 바뀌는 장면',
      heroObject: '절약 체크리스트와 사용량 기록표가 놓인 목업',
      setting: '한여름 오후의 실내, 효율적으로 정돈된 생활 공간',
      visualRecognitionCues: ['온도/사용량을 암시하는 대비', '절제된 쿨톤', '체크리스트 형태'],
      competitiveVisualAngle: '막연한 "더위" 이미지 대신 "실행 체크리스트로 조절되는 상태"로 차별화',
      premiumSignal: '절제된 아이소메트릭 대비 구성',
      trustSignal: '실제 절약 체크리스트 형태',
      emotionalTone: '해소감',
      hiddenFrustration: '무조건 참거나 에어컨을 꺼버리는 방식은 며칠 못 가 다시 켜게 됨',
      desiredIdentity: '불편함 없이도 효율적으로 사용량을 조절할 줄 아는 사람',
      purchaseTrigger: '고지서를 열어보고 이번엔 정말 뭔가 바꿔야겠다고 마음먹는 순간',
      purchaseAnxiety: '괜히 불편함만 늘고 실제 절약 효과는 없을까 봐 걱정',
      singleMindedMessage: '무조건 참는 절약이 아니라, 효과가 큰 순서부터 먼저 조정한다',
      positioningStatement: '여름철 전기요금이 부담스러운 1인 가구가 무조건 참는 방식 대신, 효과가 큰 항목부터 정해 조정하도록 돕는 전기요금 절약 실행 가이드 전자책이다.',
      subjectNotes: '',
      profile: { humanCentered:2, productCentered:6, abstract:6, emotional:4, authoritative:5 }
    },
    emotional: {
      subjectRequired: true,
      productType: '감정 기록 가이드 전자책',
      persona: '하루의 감정을 정리하고 싶은 사람',
      currentState: '말하지 못한 감정을 혼자 안고 있는 조용한 순간',
      transformedState: '일기에 적어 내려간 뒤 한결 가벼워진 순간',
      symbolicObject: '작은 촛불이 조용한 글쓰기 공간을 은은하게 비추는 장면',
      heroObject: '다이어리와 감정 기록 시트가 놓인 목업',
      setting: '따뜻한 창가 조명이 드는 아늑한 책상 한켠, 차 한 잔',
      visualRecognitionCues: ['다이어리/기록 시트', '따뜻한 창가광', '아늑한 소품'],
      competitiveVisualAngle: '화려한 감성 대신 "조용히 정리되는 감정"으로 차별화',
      premiumSignal: '절제된 파스텔 톤과 따뜻한 질감',
      trustSignal: '실제 감정 기록 시트 형태',
      emotionalTone: '따뜻한 위로',
      hiddenFrustration: '막상 쓰려고 하면 무엇을 적어야 할지 몰라 페이지를 덮어버림',
      desiredIdentity: '억지로 짜내지 않아도 자연스럽게 감정을 꺼내는 사람',
      purchaseTrigger: '오늘도 그냥 넘기면 이 감정이 그대로 묻힐 것 같은 순간',
      purchaseAnxiety: '꾸준히 쓰지 못하는 자신을 또 탓하게 되거나, 기록이 숙제가 될까 봐 걱정',
      singleMindedMessage: '감정을 잘 쓰는 법이 아니라, 부담 없이 꺼내는 첫 문장을 만든다',
      positioningStatement: '하루의 감정을 정리하고 싶은 사람이 무엇을 써야 할지 고민하지 않고, 부담 없이 꺼낼 수 있는 첫 문장부터 시작하도록 돕는 감정 기록 가이드 전자책이다.',
      subjectNotes: '자연스러운 글쓰기 동작, 과장된 슬픔/기쁨 연출 지양',
      profile: { humanCentered:8, productCentered:3, abstract:3, emotional:9, authoritative:2 }
    },
    'self-development': {
      subjectRequired: true,
      productType: '목표 실행 가이드 전자책',
      persona: '목표는 있지만 꾸준히 이어가지 못하는 사람',
      currentState: '흩어진 다짐들 속에서 방향을 잃은 모습',
      transformedState: '체크된 목표 기록을 보며 나아가는 모습',
      symbolicObject: '흐릿한 지평선 너머로 선명해지는 길이 이어지는 장면',
      heroObject: '목표 기록 저널과 습관 체크리스트가 놓인 목업',
      setting: '아침 햇살이 드는 정돈된 홈 워크스페이스',
      visualRecognitionCues: ['목표 저널/체크리스트', '아침 톤', '정돈된 데스크'],
      competitiveVisualAngle: '막연한 동기부여 이미지 대신 "기록되는 실행"으로 차별화',
      premiumSignal: '절제된 아침 톤과 대각선 구도',
      trustSignal: '실제 습관 체크리스트 형태',
      emotionalTone: '전진하는 확신',
      hiddenFrustration: '목표는 세우지만 기록하지 않아 흐지부지 잊혀짐',
      desiredIdentity: '기록하며 꾸준히 나아가는 사람',
      purchaseTrigger: '올해도 작년과 똑같은 다짐을 반복하고 있다는 것을 깨닫는 순간',
      purchaseAnxiety: '이번에도 작심삼일로 끝나고 동기부여만으로는 부족할까 봐 걱정',
      singleMindedMessage: '의지력이 아니라, 기록되는 실행 구조로 나아간다',
      positioningStatement: '목표는 있지만 꾸준히 이어가지 못하는 사람이 의지력에만 기대지 않고, 기록되는 실행 구조를 만들어 나아가도록 돕는 목표 실행 가이드 전자책이다.',
      subjectNotes: '자연스러운 집중 표정',
      profile: { humanCentered:6, productCentered:5, abstract:4, emotional:6, authoritative:5 }
    },
    'professional-operations': {
      subjectRequired: false,
      productType: '실무 프로세스 가이드 전자책',
      persona: '정확한 절차와 기준이 필요한 실무 담당자',
      currentState: '여러 매뉴얼과 서류를 오가며 기준을 대조하는 모습',
      transformedState: '하나의 정리된 프로세스 문서로 빠르게 확인하는 모습',
      symbolicObject: '흩어진 서류들이 하나의 정돈된 프로세스 문서로 정렬되는 장면',
      heroObject: '실무 매뉴얼과 체크리스트가 정돈되게 쌓인 목업',
      setting: '정돈된 사무 데스크, 참고 서류와 체크리스트',
      visualRecognitionCues: ['정돈된 서류/체크리스트 스택', '중립적인 사무 톤', '구조화된 레이아웃'],
      competitiveVisualAngle: '일반적인 사무 이미지 대신 "검증된 프로세스 문서"라는 인상으로 차별화',
      premiumSignal: '절제된 문서형 레이아웃과 여백',
      trustSignal: '실제 절차가 드러나는 체크리스트 형태',
      emotionalTone: '차분한 신뢰',
      hiddenFrustration: '부서마다 요청 방식이 달라 매번 판단 기준이 흔들림',
      desiredIdentity: '누가 봐도 같은 결론에 도달하는 표준 절차로 일하는 담당자',
      purchaseTrigger: '승인·발주·재고 단계에서 예외 상황 하나 때문에 전체 일정이 꼬였던 경험',
      purchaseAnxiety: '개인 경험과 기억에 의존하다 보니 담당자가 바뀌면 처음부터 다시 헤매게 되는 것',
      singleMindedMessage: '개인의 기억이 아니라, 누구나 확인할 수 있는 절차로 일한다',
      positioningStatement: '정확한 절차와 기준이 필요한 실무 담당자가 개인의 기억에 의존하지 않고, 누구나 확인할 수 있는 표준 절차를 정해 일관되게 처리하도록 돕는 실무 프로세스 가이드 전자책이다.',
      subjectNotes: '',
      profile: { humanCentered:2, productCentered:8, abstract:2, emotional:2, authoritative:9 }
    },
    neutral: {
      subjectRequired: true,
      productType: '실행 가이드 전자책',
      persona: '실질적인 도움을 원하는 독자',
      currentState: '막연한 정보 속에서 방향을 찾지 못하는 모습',
      transformedState: '정리된 가이드를 손에 쥐고 안정적으로 나아가는 모습',
      symbolicObject: '흩어진 조각들이 하나의 선명한 그림으로 모이는 장면',
      heroObject: '가이드북과 체크리스트가 놓인 목업',
      setting: '차분한 조명의 정돈된 작업 공간',
      visualRecognitionCues: ['체크리스트/가이드 형태', '중립적인 톤', '정돈된 구성'],
      competitiveVisualAngle: '장식적 이미지 대신 "명확한 가이드"라는 인상으로 차별화',
      premiumSignal: '절제된 레이아웃',
      trustSignal: '실제 가이드 체크리스트 형태',
      emotionalTone: '안정된 확신',
      hiddenFrustration: '막연한 정보 속에서 무엇부터 해야 할지 판단하기 어려움',
      desiredIdentity: '실질적인 다음 행동을 아는 사람',
      purchaseTrigger: '더는 미루면 안 되겠다고 느끼는 순간',
      purchaseAnxiety: '이번에도 끝까지 실행하지 못할까 봐 걱정',
      singleMindedMessage: '많은 정보가 아니라, 다음 행동 하나를 명확히 한다',
      positioningStatement: '막연한 정보 속에서 방향을 찾지 못하는 독자가 모든 것을 다 알려 하지 않고, 다음 행동 하나를 명확히 정해 실행하도록 돕는 실행 가이드 전자책이다.',
      subjectNotes: '자연스러운 표정',
      profile: { humanCentered:5, productCentered:5, abstract:4, emotional:5, authoritative:5 }
    }
  };
  function creative(category){ return CATEGORY_CREATIVE[category] || CATEGORY_CREATIVE.neutral; }

  /* ══════════════════════════════════════════════════════════════
     1. Big Idea Archetype Pool — 10종 중 카테고리에 맞는 5종을 점수로 선택한다.
        모든 카테고리가 같은 5개를 쓰지 않도록, 카테고리 profile과 archetype
        profile을 dot-product해 순위를 매긴다.
     ══════════════════════════════════════════════════════════════ */
  var ARCHETYPE_POOL = [
    { id:'transformation-moment', name:'Transformation Moment', profile:{ humanCentered:8, productCentered:4, abstract:3, emotional:8, authoritative:4 } },
    { id:'tension-and-release',   name:'Tension and Release',   profile:{ humanCentered:7, productCentered:3, abstract:4, emotional:9, authoritative:3 } },
    { id:'aspirational-identity', name:'Aspirational Identity', profile:{ humanCentered:9, productCentered:3, abstract:3, emotional:7, authoritative:5 } },
    { id:'product-as-hero',       name:'Product as Hero',       profile:{ humanCentered:2, productCentered:9, abstract:3, emotional:4, authoritative:6 } },
    { id:'editorial-authority',   name:'Editorial Authority',   profile:{ humanCentered:4, productCentered:6, abstract:4, emotional:3, authoritative:9 } },
    { id:'human-story',           name:'Human Story',           profile:{ humanCentered:9, productCentered:2, abstract:2, emotional:9, authoritative:3 } },
    { id:'visual-metaphor',       name:'Visual Metaphor',       profile:{ humanCentered:2, productCentered:2, abstract:9, emotional:6, authoritative:5 } },
    { id:'before-and-after',      name:'Before and After',      profile:{ humanCentered:7, productCentered:5, abstract:3, emotional:7, authoritative:4 } },
    { id:'proof-and-process',     name:'Proof and Process',     profile:{ humanCentered:3, productCentered:7, abstract:3, emotional:3, authoritative:8 } },
    { id:'contrarian-insight',    name:'Contrarian Insight',    profile:{ humanCentered:5, productCentered:4, abstract:6, emotional:5, authoritative:8 } }
  ];
  var PROFILE_DIMS = ['humanCentered','productCentered','abstract','emotional','authoritative'];
  function dot(a, b){ return PROFILE_DIMS.reduce(function(s,d){ return s + (a[d]||0)*(b[d]||0); }, 0); }
  var ARCHETYPE_SCORE_MAX = (function(){
    var max = 0;
    ARCHETYPE_POOL.forEach(function(a){
      Object.keys(CATEGORY_CREATIVE).forEach(function(k){
        max = Math.max(max, dot(a.profile, CATEGORY_CREATIVE[k].profile));
      });
    });
    return max;
  })();

  /* ══════════════════════════════════════════════════════════════
     Phase 12.4: Creative Intelligence Engine — "문장을 만드는 것"에서 "장면을
     설계하는 것"으로 전환한다. 기존에는 archetype마다 손으로 쓴 sceneStory
     문장 하나만 있었고, 서로 다른 archetype이라도 결국 "사람이 전자책을 펼치는
     장면" 류로 수렴하는 문제가 있었다(Claude Design에 넣으면 거의 같은 이미지가
     나옴). 이를 archetype마다 서로 다른 4개 차원(Visual Event/Scene Skeleton/
     Camera Language/Composition Pattern)의 Creative Asset Library로 분리하고,
     Scene Story Generator가 이 4개를 조합해 최종 문장을 만든다 — "이어서/함께"
     같은 접속 템플릿을 쓰지 않고 하나의 완결된 장면 묘사를 만든다. */

  /* 1. Visual Event Library — archetype마다 전혀 다른 "사건"(camera-visible
     moment)을 정의한다. 카테고리 소재(c)는 그 사건의 구체적 내용만 채운다. */
  var VISUAL_EVENT_LIBRARY = {
    'transformation-moment': function(c){ return c.currentState+'이던 것이 '+c.transformedState+josaEuroRo(c.transformedState)+' 정리되는 순간'; },
    'tension-and-release': function(c){ return c.currentState+josaIGa(c.currentState)+' 주는 압박감이 '+c.heroObject+josaEulReul(c.heroObject)+' 마주하는 순간 풀리는 장면'; },
    'aspirational-identity': function(c){ return c.persona+josaIGa(c.persona)+' '+c.transformedState+'에 막 도달한, 그 첫 순간'; },
    'product-as-hero': function(c){ return c.heroObject+' 자체가 유일한 주인공으로 놓인 장면'; },
    'editorial-authority': function(c){ return '전문가가 정리한 '+c.heroObject+josaIGa(c.heroObject)+' 책상 위에 펼쳐진 순간'; },
    'human-story': function(c){ return c.persona+josaIGa(c.persona)+' '+c.setting+'에서 '+c.heroObject+josaEulReul(c.heroObject)+' 처음 펼치는 순간'; },
    'visual-metaphor': function(c){ return c.currentState+josaIGa(c.currentState)+' '+c.symbolicObject+' 하나로 명확해지는 순간'; },
    'before-and-after': function(c){ return c.currentState+josaWaGwa(c.currentState)+' 대비되는 '+c.transformedState+josaEulReul(c.transformedState)+' 한 화면에서 비교하는 순간'; },
    'proof-and-process': function(c){ return c.heroObject+josaEulReul(c.heroObject)+' 실제로 사용하는 단계가 하나씩 눈앞에 펼쳐지는 순간'; },
    'contrarian-insight': function(c){ return c.symbolicObject+'만 화면 한가운데 남고 나머지는 모두 비워진 장면'; }
  };
  /* 2. Scene Skeleton Library — 장면에 실제로 등장할 요소(피사체/오브젝트)만
     최소 개수로 나열한다. archetype마다 등장 요소 자체가 다르다(사람 유무,
     소품 개수, 대비 항목 등). */
  var SCENE_SKELETON_LIBRARY = {
    'transformation-moment': function(c){ return c.subjectRequired ? [c.persona, c.currentState, c.transformedState] : [c.currentState, c.transformedState]; },
    'tension-and-release': function(c){ return [c.currentState, c.heroObject]; },
    'aspirational-identity': function(c){ return [c.persona, c.transformedState]; },
    'product-as-hero': function(c){ return [c.heroObject]; },
    'editorial-authority': function(c){ return [c.heroObject, '정돈된 노트', '필기 소품']; },
    'human-story': function(c){ return [c.persona, c.setting, c.heroObject]; },
    'visual-metaphor': function(c){ return [c.symbolicObject]; },
    'before-and-after': function(c){ return [c.currentState, c.transformedState]; },
    'proof-and-process': function(c){ return [c.heroObject, '사용 단계 소품']; },
    'contrarian-insight': function(c){ return [c.symbolicObject, '빈 공간', '단일 강조 포인트']; }
  };
  /* 3. Camera Language Library — archetype마다 카메라 자체가 다르다(각도/렌즈/
     스타일). 고정 값(카테고리 무관) — 카메라 언어는 archetype의 정체성이지
     소재의 속성이 아니기 때문. */
  var CAMERA_LANGUAGE_LIBRARY = {
    'transformation-moment': { angle:'Split frame', lens:'35mm', style:'Dynamic motion' },
    'tension-and-release': { angle:'Tight frame loosening to wide', lens:'35mm', style:'High contrast' },
    'aspirational-identity': { angle:'Low angle', lens:'85mm', style:'Aspirational glow' },
    'product-as-hero': { angle:'Close-up', lens:'Macro', style:'Studio' },
    'editorial-authority': { angle:'Magazine framing', lens:'85mm', style:'Premium' },
    'human-story': { angle:'Eye level', lens:'50mm', style:'Natural' },
    'visual-metaphor': { angle:'Center frame', lens:'50mm', style:'Symbolic minimal' },
    'before-and-after': { angle:'Symmetrical split', lens:'50mm', style:'Comparative' },
    'proof-and-process': { angle:'Overhead', lens:'35mm', style:'Sequential documentary' },
    'contrarian-insight': { angle:'Negative space', lens:'35mm', style:'Unexpected crop' }
  };
  /* 4. Composition Pattern Library — archetype마다 레이아웃 자체가 다르다. */
  var COMPOSITION_PATTERN_LIBRARY = {
    'transformation-moment': { pattern:'Before/After Split', description:'화면이 전/후로 분할' },
    'tension-and-release': { pattern:'Asymmetric Balance', description:'한쪽은 밀집, 한쪽은 여백으로 대비' },
    'aspirational-identity': { pattern:'Low-angle Hero', description:'인물을 살짝 올려다보는 구도로 동경 강조' },
    'product-as-hero': { pattern:'Dominant Subject 90%', description:'상품이 프레임의 약 90%를 차지' },
    'editorial-authority': { pattern:'Golden Ratio', description:'황금비율 구도로 권위감 강조' },
    'human-story': { pattern:'Human Focus 70%', description:'인물이 프레임의 약 70%를 차지' },
    'visual-metaphor': { pattern:'Center Focus', description:'상징 오브젝트를 중앙에 단독 배치' },
    'before-and-after': { pattern:'Symmetrical Comparison', description:'좌우 대칭 비교 구도' },
    'proof-and-process': { pattern:'Sequential Grid', description:'단계별 요소를 격자로 배치' },
    'contrarian-insight': { pattern:'Large Negative Space', description:'대부분을 여백으로 비우고 한 지점만 강조' }
  };
  /* 5. Scene Ending Library — 장면을 마무리하는 짧은 종결 clause. archetype의
     "톤"을 마지막에 한 번 더 새긴다. */
  var SCENE_ENDING_LIBRARY = {
    'transformation-moment': '그 변화가 일어나는 찰나만을 담는다.',
    'tension-and-release': '해소의 순간 하나에만 초점을 맞춘다.',
    'aspirational-identity': '도달한 그 순간의 확신만을 담는다.',
    'product-as-hero': '그 외 요소는 담지 않는다.',
    'editorial-authority': '설명 없이 절제된 톤으로만 신뢰를 전달한다.',
    'human-story': '꾸며내지 않은 하루의 한 장면으로 담백하게 담는다.',
    'visual-metaphor': '설명적 요소 없이 은유 하나로만 전달한다.',
    'before-and-after': '두 상태의 차이만 즉시 체감되게 한다.',
    'proof-and-process': '과정의 순서만 명확히 드러낸다.',
    'contrarian-insight': '예상을 벗어나는 지점 하나에만 시선이 머물게 한다.'
  };
  /* Scene Story Generator — Visual Event + Scene Skeleton + Camera Language +
     Composition Pattern을 조합해 하나의 완결된 장면 묘사를 만든다("이어서"/
     "함께 배치해" 같은 접속 템플릿을 쓰지 않는다). */
  function generateSceneStory(archetypeId, c){
    var event = VISUAL_EVENT_LIBRARY[archetypeId](c);
    var skeleton = SCENE_SKELETON_LIBRARY[archetypeId](c) || [];
    var camera = CAMERA_LANGUAGE_LIBRARY[archetypeId];
    var composition = COMPOSITION_PATTERN_LIBRARY[archetypeId];
    var ending = SCENE_ENDING_LIBRARY[archetypeId];
    /* Visual Event 문장이 이미 언급한 요소를 Scene Skeleton에서 다시 나열하면
       같은 명사구가 한 문장 안에서 반복된다(실제로 발견된 버그) — Event에
       없는 요소만 Skeleton 절에 남긴다. 전부 중복이면 Skeleton 절 자체를
       생략한다(Event가 이미 요소를 전부 명시했으므로). */
    var uniqueSkeleton = skeleton.filter(function(item){ return item && event.indexOf(item)===-1; });
    var skeletonText = uniqueSkeleton.length ? uniqueSkeleton.join(', ')+'만 함께 화면에 놓이고, ' : '';
    return event+'. '+skeletonText+camera.angle+'('+camera.lens+', '+camera.style+') 카메라로 '+composition.pattern+'('+composition.description+') 구도를 이룬다. '+ending;
  }
  /* ARCHETYPE_SCENE_BUILDERS의 손으로 쓴 필드(archetypePrinciple/productRole/
     subjectRole/visualHook/emotionalHook/visualTension/whyItStopsTheScroll/
     risk)는 그대로 두고, sceneStory만 새 Scene Story Generator 결과로 교체하며
     visualEvent/sceneSkeleton/cameraLanguage/compositionPattern을 추가한다. */
  function buildArchetypeScene(archetypeId, c){
    var base = ARCHETYPE_SCENE_BUILDERS[archetypeId](c);
    base.visualEvent = VISUAL_EVENT_LIBRARY[archetypeId](c);
    base.sceneSkeleton = SCENE_SKELETON_LIBRARY[archetypeId](c) || [];
    base.cameraLanguage = CAMERA_LANGUAGE_LIBRARY[archetypeId];
    base.compositionPattern = COMPOSITION_PATTERN_LIBRARY[archetypeId];
    base.sceneStory = generateSceneStory(archetypeId, c);
    return base;
  }

  /* ══════════════════════════════════════════════════════════════
     Phase 14: Claude Design Native Workflow — Atlas는 "기획서"가 아니라
     Claude Design에 바로 붙여넣는 Prompt를 만든다. Claude Design은 영어
     Prompt를 받는 이미지 생성 엔진이므로, 여기서부터는 완전히 새로운
     영어(English) 데이터 레이어를 추가한다(기존 Phase 12.4의 한글
     VISUAL_EVENT_LIBRARY/SCENE_SKELETON_LIBRARY/CAMERA_LANGUAGE_LIBRARY/
     COMPOSITION_PATTERN_LIBRARY는 AI Planner 한글 UI 표시용으로 그대로
     둔다 — 삭제·변경하지 않는다). 이 절 아래는 오직 Claude Design Prompt
     Builder만을 위한 새 레이어다.

     Scene Director → Camera Director → Composition Director → Lighting
     Director → Visual Style Director → Claude Design Prompt Builder. */

  /* CATEGORY_EN — CATEGORY_CREATIVE(한글)와 1:1 대응하는 영어 서술 필드.
     Claude Design은 영어 Prompt를 받으므로, 여기서 새로 영어 소재를
     authored한다(자동 번역이 아니라 각 카테고리 의미를 그대로 옮겨 쓴
     것 — 기존 한글 CATEGORY_CREATIVE는 전혀 건드리지 않는다). */
  var CATEGORY_EN = {
    finance: { personaEn:'a Korean office worker who only has an hour or two free after work', currentStateEn:'overwhelmed and exhausted after scrolling through scattered side-income information, unsure where to start', transformedStateEn:'confidently reviewing a clearly organized action plan, sure of the next step', heroObjectEn:'an ebook cover workbook mockup with a checklist and progress markers', settingEn:'a quiet dining table right after work, with a tidy schedule sheet next to a laptop', symbolicObjectEn:'scattered notes converging into a single organized roadmap sheet' },
    business: { personaEn:'a small business owner whose growth direction keeps wavering', currentStateEn:'surrounded by mixed-up plans, unable to decide what to prioritize', transformedStateEn:'pointing confidently at one clear growth axis', heroObjectEn:'a strategy playbook mockup bundled with a checklist', settingEn:'a minimal office space with a tidy desk covered in strategy documents', symbolicObjectEn:'scattered arrows aligning into a single upward growth curve' },
    technology: { personaEn:'a professional overwhelmed by a new software tool', currentStateEn:'lost among too many settings and options, unsure what to click', transformedStateEn:'working comfortably with only one simple workflow left on screen', heroObjectEn:'a workflow diagram and setup guide mockup', settingEn:'a minimal workspace with calm, neutral-toned lighting', symbolicObjectEn:'tangled nodes resolving into a single clear path' },
    health: { personaEn:'someone motivated but struggling to stay consistent', currentStateEn:'slumped posture, exhausted at the end of the day', transformedStateEn:'smiling comfortably after a light stretch', heroObjectEn:'a habit journal and checklist mockup', settingEn:'a home wellness corner with morning sunlight and a single yoga mat', symbolicObjectEn:'a hazy sunrise gradually becoming clear and bright' },
    medical: { personaEn:'a staff member who must verify exact procedures', currentStateEn:'cross-checking scattered procedures across multiple documents', transformedStateEn:'quickly confirming everything in one organized manual', heroObjectEn:'a procedure manual and checklist mockup neatly arranged', settingEn:'a tidy office desk with reference materials', symbolicObjectEn:'scattered documents aligning into one organized manual' },
    parenting: { personaEn:'a new parent anxious about what to prepare', currentStateEn:'anxious and unable to prioritize among scattered parenting information', transformedStateEn:'calmly preparing the day while checking off a checklist', heroObjectEn:'a parenting checklist and schedule mockup placed together', settingEn:'a cozy living room corner with warm morning sunlight', symbolicObjectEn:'scattered notes organizing into a single checklist' },
    education: { personaEn:'a learner overwhelmed by a huge amount of material', currentStateEn:'staring blankly at scattered study materials', transformedStateEn:'studying steadily while reviewing a clean summary notebook', heroObjectEn:'a summary notebook and checklist mockup', settingEn:'a calmly lit desk with well-organized study materials', symbolicObjectEn:'messy pages gathering into one organized notebook' },
    lifestyle: { personaEn:'someone seeking a better daily routine', currentStateEn:'unable to find ease amid a disorganized daily life', transformedStateEn:'starting the day at ease within an organized routine', heroObjectEn:'a routine planner and checklist mockup', settingEn:'a tidy living space filled with sunlight', symbolicObjectEn:'scattered items settling into an organized arrangement' },
    household: { personaEn:'someone who wants to manage household spending more efficiently', currentStateEn:'confused by mixed-up household expenses across categories', transformedStateEn:'confidently managing a table organized by category', heroObjectEn:'a household budget checklist and summary table mockup', settingEn:'a tidy home desk with real, well-used household documents', symbolicObjectEn:'scattered receipts and numbers organizing into one tidy table' },
    energy: { personaEn:'a single-person household worried about summer electricity bills', currentStateEn:'uneasy, constantly checking the electric meter number', transformedStateEn:'relieved while checking off completed energy-saving actions', heroObjectEn:'an energy-saving checklist and usage log mockup', settingEn:'a well-organized living space on a hot summer afternoon', symbolicObjectEn:'intense heat gradually cooling into an efficient, comfortable state' },
    emotional: { personaEn:"someone who wants to make sense of the day's emotions", currentStateEn:'a quiet moment holding unspoken feelings alone', transformedStateEn:'a lighter moment after writing everything down in a journal', heroObjectEn:'a diary and emotion-tracking sheet mockup', settingEn:'a cozy desk corner by a warm window with a cup of tea', symbolicObjectEn:'a small candle softly lighting a quiet writing space' },
    'self-development': { personaEn:'someone with goals who struggles to stay consistent', currentStateEn:'lost among scattered resolutions', transformedStateEn:'moving forward while reviewing a checked-off goal log', heroObjectEn:'a goal journal and habit-checklist mockup', settingEn:'an organized home workspace with morning sunlight', symbolicObjectEn:'a hazy horizon resolving into a clear path ahead' },
    'professional-operations': { personaEn:'a staff member who needs exact procedures and standards', currentStateEn:'cross-referencing standards across multiple manuals and documents', transformedStateEn:'quickly confirming everything in one organized process document', heroObjectEn:'a stack of neatly arranged operations manuals and checklists', settingEn:'a tidy office desk with reference documents and a checklist', symbolicObjectEn:'scattered documents aligning into one organized process document' },
    neutral: { personaEn:'a reader looking for practical help', currentStateEn:'lost amid vague, scattered information', transformedStateEn:'moving forward steadily with an organized guide in hand', heroObjectEn:'a guidebook and checklist mockup', settingEn:'a calmly lit, organized workspace', symbolicObjectEn:'scattered fragments coming together into one clear picture' }
  };
  function creativeEn(category){ return CATEGORY_EN[category] || CATEGORY_EN.neutral; }
  /* Environment Library — CATEGORY_EN.settingEn을 그대로 노출한다(요청된
     "Environment Library"를 별도 이름으로 공식화). */
  var ENVIRONMENT_LIBRARY = CATEGORY_EN;
  CCE.environmentLibrary = function(category){ return creativeEn(category).settingEn; };

  /* 1. Scene Director — archetype마다 완전히 다른 "Visual Event"(카메라로 보이는
     구체적 사건)를 영어로 만든다. 문장이 아니라 "장면"이라는 요청에 맞춰
     항상 하나의 관찰 가능한 순간/행동으로 서술한다. */
  var SCENE_LIBRARY = {
    'transformation-moment': function(en){ return en.personaEn+' pausing mid-motion, setting aside scattered notes and picking up '+en.heroObjectEn+' at the exact turning point of change'; },
    'tension-and-release': function(en){ return en.personaEn+' exhaling in relief while opening '+en.heroObjectEn+', the tension of being '+en.currentStateEn+' visibly easing'; },
    'aspirational-identity': function(en){ return en.personaEn+' standing with quiet confidence, having just arrived at '+en.transformedStateEn+', '+en.heroObjectEn+' held closed in hand'; },
    'product-as-hero': function(en){ return en.heroObjectEn+' standing alone at the center of the frame, catching the light, with no other objects nearby'; },
    'editorial-authority': function(en){ return en.heroObjectEn+' laid open on a clean desk beside a notebook and pen, styled like an editorial still life'; },
    'human-story': function(en){ return en.personaEn+' sitting at '+en.settingEn+', quietly opening '+en.heroObjectEn+' for the first time'; },
    'visual-metaphor': function(en){ return en.symbolicObjectEn+', shown as the single subject of the frame with nothing else present'; },
    'before-and-after': function(en){ return en.personaEn+' shown twice side by side in one frame, once '+en.currentStateEn+' and once '+en.transformedStateEn; },
    'proof-and-process': function(en){ return en.heroObjectEn+' shown with its individual steps laid out in sequence, as if caught mid-use'; },
    'contrarian-insight': function(en){ return en.symbolicObjectEn+', placed alone in an otherwise empty frame, deliberately breaking from the expected scene'; }
  };
  CCE.sceneDirector = function(archetypeId, category){ return SCENE_LIBRARY[archetypeId](creativeEn(category)); };

  /* 2. Camera Director — archetype마다 완전히 다른 카메라 언어(각도/거리/움직임). */
  var CAMERA_LIBRARY = {
    'transformation-moment': '45-degree dynamic angle, positioned to capture the shift between two moments',
    'tension-and-release': 'over-the-shoulder shot with a slow push-in toward the point of release',
    'aspirational-identity': 'low-angle hero shot, camera looking slightly upward',
    'product-as-hero': 'close-up product shot with shallow depth of field',
    'editorial-authority': 'magazine cover commercial shot, camera locked level and centered',
    'human-story': 'eye-level natural candid shot',
    'visual-metaphor': 'macro shot isolating a single symbolic object',
    'before-and-after': 'wide split-frame shot dividing the scene in two',
    'proof-and-process': 'top-down overhead shot',
    'contrarian-insight': 'wide interior shot with dramatic negative space and an off-center subject'
  };
  CCE.cameraDirector = function(archetypeId){ return CAMERA_LIBRARY[archetypeId]; };

  /* 3. Composition Director — archetype마다 완전히 다른 레이아웃. */
  var COMPOSITION_LIBRARY = {
    'transformation-moment': { name:'Diagonal Flow', description:'a diagonal line leads the eye from the old state to the new state' },
    'tension-and-release': { name:'Left Focus', description:'weight concentrated on the left side, easing toward open space on the right' },
    'aspirational-identity': { name:'Centered Hero', description:'the subject centered and slightly below frame center for an upward, aspirational feel' },
    'product-as-hero': { name:'Product First', description:'the product mockup dominates the frame, all other elements minimized' },
    'editorial-authority': { name:'Golden Ratio', description:'golden-ratio framing for a refined, authoritative layout' },
    'human-story': { name:'Character First', description:'the person leads the frame, product placed naturally in their hands or nearby' },
    'visual-metaphor': { name:'Rule of Thirds', description:'the symbolic object placed on a rule-of-thirds intersection' },
    'before-and-after': { name:'Magazine Layout', description:'a clean magazine-style split comparing two halves of the frame' },
    'proof-and-process': { name:'Document First', description:'the document/mockup fills the foreground with steps visible in sequence' },
    'contrarian-insight': { name:'Off-Center Asymmetry', description:'the subject pushed off-center, leaving large deliberate negative space' }
  };
  CCE.compositionDirectorV2 = function(archetypeId){ return COMPOSITION_LIBRARY[archetypeId]; };

  /* 4. Lighting Director — Prompt Engineering이 아니라 실제 BrandStrategy별로
     조명 자체를 바꾼다(사용자 스펙 §Lighting Director 예시 그대로). */
  var LIGHTING_LIBRARY = {
    Authority: 'crisp commercial studio lighting with a strong directional key light and controlled shadows',
    Trust: 'soft, bright, even lighting that feels clean and reassuring',
    Relationship: 'warm natural window light with a soft golden glow',
    neutral: 'balanced natural daylight with gentle, even shadows'
  };
  CCE.lightingDirector = function(brandStrategy){ return LIGHTING_LIBRARY[brandStrategy] || LIGHTING_LIBRARY.neutral; };

  /* 5. Visual Style Director — 가장 중요한 부분. "Illustration/Mockup" 수준이
     아니라 Claude Design이 실제로 잘 만드는 것으로 알려진 10개 스타일 중
     archetype마다 하나를 confident하게 지정한다(Concept 탐색 단계인
     Thumbnail 5종은 스타일 자체도 서로 다르게 — 실제로 다른 이미지가
     나오게 하는 핵심 레버). Sales Page는 이미 확정된 한 Concept의 캠페인이므로
     기존처럼 primaryMedium(AVPE의 artDirection, 캠페인 전체 통일)을 그대로
     쓴다 — Phase 12.2에서 이미 검증된 "9장 Medium 통일" 요구를 깨지 않는다. */
  var VISUAL_STYLE_LIBRARY = {
    'transformation-moment': 'semi-realistic commercial illustration',
    'tension-and-release': 'commercial hero photograph',
    'aspirational-identity': 'luxury lifestyle photograph',
    'product-as-hero': 'Apple-style product shot',
    'editorial-authority': 'magazine cover illustration',
    'human-story': 'warm editorial lifestyle photograph',
    'visual-metaphor': 'premium infographic illustration',
    'before-and-after': 'minimal product advertisement',
    'proof-and-process': 'modern flat illustration',
    'contrarian-insight': 'premium editorial illustration'
  };
  CCE.visualStyleDirector = function(archetypeId){ return VISUAL_STYLE_LIBRARY[archetypeId]; };
  function articleFor(phrase){ return /^[aeiou]/i.test(phrase) ? 'an' : 'a'; }

  /* 6. Claude Design Prompt Builder — 기획서가 아니라 Claude Design에 바로
     붙여넣는 Prompt를 만든다. MAIN SUBJECT/ENVIRONMENT/CAMERA/COMPOSITION/
     LIGHTING/COLOR PALETTE/VISUAL STYLE/PRODUCT MOCKUP/VISUAL EVENT/SAFE
     AREA/NEGATIVE 11개 요소만 담는다. */
  function mainSubjectPhrase(concept, en){
    return concept.subjectRole==='product-led' ? en.heroObjectEn : en.personaEn;
  }
  /* Phase 14 (Provider-Neutral Image Engine): js/image-engine.js가 CCE 내부 English
     layer를 Provider-neutral scene 객체로 재조립할 때 쓰는 읽기 전용 접근자.
     private mainSubjectPhrase/creativeEn을 감싸기만 하고 새 로직은 없다. */
  CCE.mainSubjectEn = function(concept, category){ return mainSubjectPhrase(concept, creativeEn(category)); };
  CCE.productMockupEn = function(category){ return creativeEn(category).heroObjectEn; };
  CCE.claudeDesignPromptBuilder = function(concept, category, brandStrategy, colorDirection, safeAreaPhrase, negativePrompt){
    var en = creativeEn(category);
    var archetypeId = concept.archetypeId;
    var sceneEvent = CCE.sceneDirector(archetypeId, category);
    var camera = CCE.cameraDirector(archetypeId);
    var composition = CCE.compositionDirectorV2(archetypeId);
    var lighting = CCE.lightingDirector(brandStrategy);
    var visualStyle = CCE.visualStyleDirector(archetypeId);
    var mainSubject = mainSubjectPhrase(concept, en);

    var lines = [];
    lines.push('Create '+articleFor(visualStyle)+' '+visualStyle+'.');
    lines.push('');
    lines.push('Show the exact moment when '+sceneEvent+'.');
    lines.push('');
    lines.push('Main Subject:');
    lines.push(cap1(mainSubject)+'.');
    lines.push('');
    lines.push('Camera:');
    lines.push(cap1(camera)+'.');
    lines.push('');
    lines.push('Composition:');
    lines.push(composition.name+' — '+composition.description+'.');
    lines.push('');
    lines.push('Lighting:');
    lines.push(cap1(lighting)+'.');
    lines.push('');
    lines.push('Color Palette:');
    lines.push(cap1(colorDirection)+'.');
    lines.push('');
    lines.push('Product:');
    lines.push(cap1(en.heroObjectEn)+'.');
    lines.push('');
    lines.push('Environment:');
    lines.push(cap1(en.settingEn)+'.');
    lines.push('');
    lines.push(safeAreaPhrase);
    lines.push('');
    lines.push('Do not include any text inside the image.');
    lines.push('');
    lines.push('Negative:');
    lines.push(negativePrompt);
    return lines.join('\n');
  };

  /* 7. Sales Page Prompt Builder — 9장을 9개의 서로 다른 Story가 아니라 9개의
     서로 다른 Scene으로 만든다. Visual Style/Lighting은 캠페인 전체 통일(Phase 12.2
     "9장 Medium 통일" 요건 유지)이지만, Scene/Camera/Composition은 역할마다
     완전히 다르다. */
  var SALES_PAGE_SCENE_LIBRARY = {
    hero: function(en){ return en.heroObjectEn+' introduced as the hero of the frame, opening the promise of '+en.transformedStateEn; },
    pain: function(en){ return en.personaEn+' caught in the middle of being '+en.currentStateEn+', surrounded by scattered signs of that struggle'; },
    beforeAfter: function(en){ return en.personaEn+' shown split between '+en.currentStateEn+' on one side and '+en.transformedStateEn+' on the other'; },
    solution: function(en){ return en.symbolicObjectEn+' introduced as the new mechanism, standing apart from anything else in the frame'; },
    toc: function(en){ return en.heroObjectEn+' opened to reveal its internal pages and structure in close-up'; },
    benefits: function(en){ return 'the individual deliverables from '+en.heroObjectEn+' laid out in an organized flat-lay'; },
    targetAudience: function(en){ return en.personaEn+' actively using '+en.heroObjectEn+', visibly closer to '+en.transformedStateEn; },
    faq: function(en){ return 'a calm arrangement of documents and checklists conveying reassurance and trust'; },
    cta: function(en){ return en.heroObjectEn+' presented once more in a final decisive hero framing, echoing the opening shot'; }
  };
  CCE.salesPageSceneDirector = function(roleKey, category){ return SALES_PAGE_SCENE_LIBRARY[roleKey](creativeEn(category)); };

  var SALES_PAGE_CAMERA_BY_ROLE = {
    hero: 'wide hero shot, camera locked level and centered',
    pain: 'eye-level close shot, camera intimate and slightly unsteady',
    beforeAfter: 'wide split-frame shot dividing the scene in two',
    solution: 'macro shot isolating the new mechanism',
    toc: 'top-down overhead close-up',
    benefits: 'high-angle flat-lay shot',
    targetAudience: 'over-the-shoulder shot following natural hand movement',
    faq: 'eye-level static shot, calm and steady',
    cta: 'low-angle hero shot, camera looking slightly upward, echoing the opening frame'
  };
  CCE.salesPageCameraDirector = function(roleKey){ return SALES_PAGE_CAMERA_BY_ROLE[roleKey]; };

  var SALES_PAGE_COMPOSITION_BY_ROLE = {
    hero: { name:'Centered Hero', description:'the subject centered and dominant, establishing the campaign’s opening promise' },
    pain: { name:'Left Focus', description:'weight concentrated on the left side to convey unresolved tension' },
    beforeAfter: { name:'Magazine Layout', description:'a clean split comparing two halves of the frame' },
    solution: { name:'Rule of Thirds', description:'the new mechanism placed on a rule-of-thirds intersection, isolated from clutter' },
    toc: { name:'Document First', description:'the opened pages fill the foreground in sequence' },
    benefits: { name:'Golden Ratio', description:'the deliverables arranged in a golden-ratio flat-lay grid' },
    targetAudience: { name:'Character First', description:'the person leads the frame, product held naturally in hand' },
    faq: { name:'Off-Center Asymmetry', description:'the documents pushed off-center, leaving calm negative space' },
    cta: { name:'Diagonal Flow', description:'a diagonal line leading the eye back to the product, echoing the hero shot' }
  };
  CCE.salesPageCompositionDirector = function(roleKey){ return SALES_PAGE_COMPOSITION_BY_ROLE[roleKey]; };

  var SALES_PAGE_PRODUCT_LED_ROLES = { solution:true, toc:true, benefits:true, faq:true };
  function salesPageMainSubjectPhrase(roleKey, category, subjectRequired){
    var en = creativeEn(category);
    if(SALES_PAGE_PRODUCT_LED_ROLES[roleKey] || !subjectRequired) return en.heroObjectEn;
    return en.personaEn;
  }
  CCE.salesPageMainSubjectEn = function(roleKey, category, subjectRequired){ return salesPageMainSubjectPhrase(roleKey, category, subjectRequired); };

  CCE.claudeDesignSalesPagePromptBuilder = function(roleKey, category, brandStrategy, visualStyle, colorDirection, safeAreaPhrase, negativePrompt, subjectRequired){
    var en = creativeEn(category);
    var sceneEvent = CCE.salesPageSceneDirector(roleKey, category);
    var camera = CCE.salesPageCameraDirector(roleKey);
    var composition = CCE.salesPageCompositionDirector(roleKey);
    var lighting = CCE.lightingDirector(brandStrategy);
    var mainSubject = salesPageMainSubjectPhrase(roleKey, category, subjectRequired);

    var lines = [];
    lines.push('Create '+articleFor(visualStyle)+' '+visualStyle+'.');
    lines.push('');
    lines.push('Show the exact moment when '+sceneEvent+'.');
    lines.push('');
    lines.push('Main Subject:');
    lines.push(cap1(mainSubject)+'.');
    lines.push('');
    lines.push('Camera:');
    lines.push(cap1(camera)+'.');
    lines.push('');
    lines.push('Composition:');
    lines.push(composition.name+' — '+composition.description+'.');
    lines.push('');
    lines.push('Lighting:');
    lines.push(cap1(lighting)+'.');
    lines.push('');
    lines.push('Color Palette:');
    lines.push(cap1(colorDirection)+'.');
    lines.push('');
    lines.push('Product:');
    lines.push(cap1(en.heroObjectEn)+'.');
    lines.push('');
    lines.push('Environment:');
    lines.push(cap1(en.settingEn)+'.');
    lines.push('');
    lines.push(safeAreaPhrase);
    lines.push('');
    lines.push('Do not include any text inside the image.');
    lines.push('');
    lines.push('Negative:');
    lines.push(negativePrompt);
    return lines.join('\n');
  };

  /* 각 archetype이 카테고리 소재로부터 실제 장면 문장을 만드는 방식. subjectRequired가
     false인 카테고리에서 인물 중심 archetype이 뽑히면 subjectRole을 'product-led'로
     자동 전환한다(§8 Subject Director 원칙과 일치).

     Phase 12.1: bigIdea(전략 문장 — 왜 이 방식이 설득력 있는지)와 sceneStory(카메라에
     실제로 보이는 사건)를 서로 다른 문장으로 분리했다. archetype마다 visualTension
     (클릭을 만드는 시각적 긴장), whyItStopsTheScroll, risk도 전부 다르게 authored해
     "Archetype 이름만 다른 동일한 결과"가 되지 않게 했다. */
  var ARCHETYPE_SCENE_BUILDERS = {
    'transformation-moment': function(c){ return {
      archetypePrinciple: '결과만 보여주지 않고, 지금 상태에서 벗어나는 바로 그 순간을 보여주는 것이 가장 강한 설득이다.',
      sceneStory: c.currentState+'에 머물러 있던 '+c.persona+josaIGa(c.persona)+' '+c.transformedState+josaEulReul(c.transformedState)+' 향해 움직이기 시작하는 전환의 찰나를 포착한다.',
      productRole:'변화가 일어나도록 만든 계기', subjectRole: c.subjectRequired?'변화를 겪는 당사자':'product-led',
      visualHook: c.transformedState, emotionalHook: c.emotionalTone,
      visualTension:'변화 직전과 직후, 같은 인물의 표정·자세 차이',
      whyItStopsTheScroll:'결과만 나열하는 다른 이미지와 달리 "변화가 일어나는 순간" 자체를 보여줘 시선이 머무른다',
      risk:'변화의 순간이 미묘하면 정적인 인물 사진처럼 밋밋하게 보일 수 있다'
    }; },
    'tension-and-release': function(c){ return {
      archetypePrinciple: '문제를 해결하기 전에 그 문제가 주는 압박감부터 체감하게 만드는 것이 설득의 출발점이다.',
      sceneStory: c.currentState+josaIGa(c.currentState)+' 화면 전체를 채우고, 한쪽에 '+c.heroObject+josaIGa(c.heroObject)+' 조용히 놓여 해소의 실마리를 암시한다.',
      productRole:'긴장을 풀어주는 열쇠', subjectRole: c.subjectRequired?'긴장을 느끼는 당사자':'product-led',
      visualHook:'압박감과 여백 사이의 대비', emotionalHook:'긴장 이후 찾아오는 안도',
      visualTension:'화면을 채우는 압박감과 한켠의 해소 오브젝트 사이의 대비',
      whyItStopsTheScroll:'불편한 감정을 먼저 인정해주는 장면이라 "내 얘기"처럼 읽혀 멈추게 된다',
      risk:'압박감 표현이 과하면 불쾌하거나 부정적인 이미지로 읽힐 수 있다'
    }; },
    'aspirational-identity': function(c){ return {
      archetypePrinciple: '상품을 설명하기 전에, 그 상품을 쓴 뒤 도달하는 "되고 싶은 나"를 먼저 보여주는 것이 동경을 만든다.',
      sceneStory: c.persona+josaIGa(c.persona)+' '+c.transformedState+'에 이르러 확신에 찬 자세로 서 있는 장면을 담는다.',
      productRole:'그 모습에 도달하게 만든 도구', subjectRole: c.subjectRequired?'동경의 대상이 된 당사자':'product-led',
      visualHook: c.transformedState, emotionalHook:'지금의 나와 되고 싶은 나 사이의 동경',
      visualTension:'지금의 나와 동경하는 모습 사이의 거리감',
      whyItStopsTheScroll:'동경하는 모습을 구체적인 한 장면으로 먼저 보여줘 자신을 대입하게 만든다',
      risk:'동경하는 모습이 비현실적으로 과장되면 오히려 거리감을 만들 수 있다'
    }; },
    'product-as-hero': function(c){ return {
      archetypePrinciple: '사람이 아니라 상품 자체를 주인공으로 세워, 그 존재감만으로 신뢰를 전달한다.',
      sceneStory: c.heroObject+josaIGa(c.heroObject)+' 화면 중심을 차지하고, 주변은 의도적으로 비워 시선이 상품에만 머무르게 한다.',
      productRole:'장면의 주인공', subjectRole:'product-led',
      visualHook: c.heroObject, emotionalHook:'상품 자체에 대한 신뢰',
      visualTension:'압도적인 상품 존재감과 절제된 여백 사이의 대비',
      whyItStopsTheScroll:'인물 없이 상품 자체의 존재감으로 시선을 붙잡아, 인물 중심 이미지들 사이에서 오히려 눈에 띈다',
      risk:'인물이 없어 감정적 공감보다 정보 전달에 치우칠 수 있다'
    }; },
    'editorial-authority': function(c){ return {
      archetypePrinciple: '전문 매체 화보 같은 절제된 연출로, 설명하지 않고도 권위를 먼저 인정받는다.',
      sceneStory: c.heroObject+josaEulReul(c.heroObject)+' 잡지 화보처럼 정교하게 배치한 절제된 구도의 장면.',
      productRole:'권위를 상징하는 오브젝트', subjectRole: c.subjectRequired?'전문성을 드러내는 당사자':'product-led',
      visualHook:'절제된 에디토리얼 구도', emotionalHook: c.trustSignal,
      visualTension:'절제된 구도 안에 담긴 정보 밀도',
      whyItStopsTheScroll:'가벼운 홍보 이미지들 사이에서 매체 화보 같은 절제된 톤이 신뢰감으로 먼저 눈에 띈다',
      risk:'지나치게 절제되면 평범한 문서 사진처럼 밋밋하게 보일 수 있다'
    }; },
    'human-story': function(c){ return {
      archetypePrinciple: '독자와 닮은 한 사람의 실제 하루 속 한 순간을 통해 설명 없이 공감으로 접근한다.',
      sceneStory: c.persona+josaIGa(c.persona)+' '+c.setting+josaEulReul(c.setting)+' 배경으로 하루 중 한 순간을 자연스럽게 보내는 모습을 포착한다.',
      productRole:'그 삶에 자연스럽게 녹아든 도구', subjectRole: c.subjectRequired?'이야기 속 당사자':'product-led',
      visualHook: c.setting, emotionalHook: c.emotionalTone,
      visualTension:'연출되지 않은 듯한 생활감과 상품이 자연스럽게 놓인 배치 사이의 균형',
      whyItStopsTheScroll:'광고처럼 보이지 않는 자연스러운 순간이라 오히려 진짜처럼 느껴져 시선이 머무른다',
      risk:'장면이 너무 평범하면 특별히 시선을 끌 요소 없이 지나쳐질 수 있다'
    }; },
    'visual-metaphor': function(c){ return {
      archetypePrinciple: '문제와 해결을 직접 설명하지 않고, 하나의 은유적 장면으로 대신 보여준다.',
      sceneStory: c.symbolicObject+' 하나만으로 "'+c.currentState+'"에서 "'+c.transformedState+'"'+josaEuroRo(c.transformedState)+'의 변화를 암시한다.',
      productRole:'은유를 완성하는 상징', subjectRole:'product-led',
      visualHook: c.symbolicObject, emotionalHook:'은유가 주는 깨달음',
      visualTension:'구체적 설명 없이도 곧바로 읽히는 은유의 명료함',
      whyItStopsTheScroll:'설명적인 이미지들 사이에서 한 장의 은유적 장면이 호기심을 자극해 멈추게 한다',
      risk:'은유가 지나치게 추상적이면 무엇을 파는 상품인지 바로 읽히지 않을 수 있다'
    }; },
    'before-and-after': function(c){ return {
      archetypePrinciple: '문제 상태와 해결 이후 상태를 한 장면 안에서 나란히 대비시켜 효과를 즉시 체감시킨다.',
      sceneStory: '한 화면 안에 '+c.currentState+josaWaGwa(c.currentState)+' '+c.transformedState+josaEulReul(c.transformedState)+' 좌우로 나란히 배치해 대비시킨다.',
      productRole:'대비를 만드는 전환점', subjectRole: c.subjectRequired?'대비를 겪는 당사자':'product-led',
      visualHook:'좌우 전후 대비 구도', emotionalHook:'대비가 주는 확신',
      visualTension:'같은 인물·공간이 좌우로 확연히 달라 보이는 대비',
      whyItStopsTheScroll:'효과가 설명 없이 즉시 눈으로 비교되어 이해가 빠르다',
      risk:'대비가 과장되면 비현실적인 효과처럼 보일 위험이 있다'
    }; },
    'proof-and-process': function(c){ return {
      archetypePrinciple: '결과를 주장하지 않고, 검증 가능한 과정 자체를 보여줘 신뢰를 얻는다.',
      sceneStory: c.heroObject+josaWaGwa(c.heroObject)+' 함께 실제 사용 단계가 순서대로 펼쳐진 장면.',
      productRole:'검증 가능한 과정의 증거', subjectRole:'product-led',
      visualHook:'단계별로 드러나는 과정', emotionalHook: c.trustSignal,
      visualTension:'단계별로 나열된 요소들이 만드는 질서정연한 리듬',
      whyItStopsTheScroll:'막연한 약속이 아니라 검증 가능한 절차를 보여줘 신중한 구매자의 시선을 붙잡는다',
      risk:'과정 나열이 많아지면 오히려 복잡해 보여 피로감을 줄 수 있다'
    }; },
    'contrarian-insight': function(c){ return {
      archetypePrinciple: '흔히 예상하는 접근과 반대되는 관점을 제시해 호기심을 자극한다.',
      sceneStory: '일반적으로 기대하는 장면 대신, '+c.symbolicObject+josaEulReul(c.symbolicObject)+' 보여주며 전혀 다른 각도에서 이야기를 시작한다.',
      productRole:'통념을 뒤집는 근거', subjectRole: c.subjectRequired?'통념과 다른 선택을 한 당사자':'product-led',
      visualHook:'예상을 벗어나는 구도', emotionalHook:'뜻밖의 발견이 주는 흥미',
      visualTension:'예상했던 장면과 실제 장면 사이의 낙차',
      whyItStopsTheScroll:'뻔한 장면을 기대했던 시선이 예상 밖의 각도에 걸려 멈추게 된다',
      risk:'낯선 접근이 상품과의 연관성을 즉시 이해하기 어렵게 만들 수 있다'
    }; }
  };

  /* ══════════════════════════════════════════════════════════════
     2. Medium(Photography/Illustration) 분류 — AVPE의 10개 Style 이름을 그대로
        입력으로 받아(재계산하지 않고) 그 이름 자체의 의미로 photography/
        illustration을 분류한다.
     ══════════════════════════════════════════════════════════════ */
  var PHOTOGRAPHY_STYLES = { 'clean product advertising':true, 'realistic product mockup scene':true };
  var PHOTOGRAPHY_DIRECTION = {
    'clean product advertising': { cameraAngle:'eye-level, slightly above product', shotSize:'medium close-up', lensFeel:'85mm-equivalent commercial lens feel, minimal distortion', depthOfField:'shallow, product in crisp focus', focusPlane:'product surface', motion:'static, no motion blur', lightingSetup:'softbox key with subtle rim light', commercialReferenceLanguage:'clean e-commerce hero-shot commercial photography', realism:'high, photographic', retouchingLevel:'light, natural retouching only', texture:'crisp material detail' },
    'realistic product mockup scene': { cameraAngle:'three-quarter angle', shotSize:'medium shot including surrounding context', lensFeel:'35-50mm-equivalent lifestyle lens feel', depthOfField:'moderate, background softly blurred', focusPlane:'mockup surface', motion:'static, natural in-scene stillness', lightingSetup:'window-light-driven lifestyle lighting', commercialReferenceLanguage:'lifestyle commercial product photography', realism:'high, photographic', retouchingLevel:'light, natural retouching only', texture:'natural material and surface texture' }
  };
  var ILLUSTRATION_DIRECTION = {
    'premium editorial illustration': { illustrationTechnique:'refined editorial illustration with confident linework', lineQuality:'clean, deliberate line weight', shapeLanguage:'structured, magazine-cover-like shapes', materialFeel:'matte premium finish', depth:'layered with soft shadow depth', texture:'subtle fine grain', realism:'semi-realistic', editorialReferenceLanguage:'premium business-magazine editorial illustration' },
    'modern flat illustration': { illustrationTechnique:'modern flat vector illustration', lineQuality:'minimal outlines, shape-driven', shapeLanguage:'simplified geometric shapes', materialFeel:'flat matte color fields', depth:'minimal, implied through overlap', texture:'clean, grain-free', realism:'stylized', editorialReferenceLanguage:'modern SaaS/app marketing illustration' },
    'semi-realistic commercial illustration': { illustrationTechnique:'semi-realistic commercial illustration with soft rendering', lineQuality:'soft, painterly edges', shapeLanguage:'naturalistic human and object proportions', materialFeel:'soft matte render', depth:'moderate depth with soft shadow falloff', texture:'soft painterly texture', realism:'semi-realistic', editorialReferenceLanguage:'commercial lifestyle illustration' },
    'paper-cut editorial collage': { illustrationTechnique:'layered paper-cut collage illustration', lineQuality:'clean die-cut edges', shapeLanguage:'layered flat shapes with drop shadows', materialFeel:'paper texture with subtle shadow depth', depth:'distinct layered depth (paper stack feel)', texture:'visible paper grain', realism:'stylized', editorialReferenceLanguage:'editorial paper-craft collage illustration' },
    'soft 3D illustration': { illustrationTechnique:'soft 3D rendered illustration', lineQuality:'no hard lines, form-defined by shading', shapeLanguage:'rounded, toy-like geometric forms', materialFeel:'soft matte 3D render, clay-like', depth:'clear 3D depth with soft shadows', texture:'smooth rendered surface', realism:'stylized-3D', editorialReferenceLanguage:'modern soft-3D app marketing render' },
    'premium infographic illustration': { illustrationTechnique:'structured infographic illustration', lineQuality:'precise, ruler-clean lines', shapeLanguage:'grid-aligned geometric shapes and icons', materialFeel:'flat premium color fields', depth:'minimal, layout-driven', texture:'clean, grain-free', realism:'stylized', editorialReferenceLanguage:'premium data/process infographic illustration' },
    'warm lifestyle illustration': { illustrationTechnique:'warm lifestyle illustration', lineQuality:'soft rounded linework', shapeLanguage:'naturalistic, relaxed proportions', materialFeel:'soft matte warm render', depth:'gentle depth with warm ambient shadow', texture:'soft grain, warm texture', realism:'semi-realistic', editorialReferenceLanguage:'warm lifestyle-brand illustration' },
    'minimal conceptual art': { illustrationTechnique:'minimal conceptual illustration', lineQuality:'sparse, intentional linework', shapeLanguage:'abstract symbolic shapes', materialFeel:'flat or softly gradiented fields', depth:'flat with implied symbolic depth', texture:'clean, minimal', realism:'abstract', editorialReferenceLanguage:'minimal conceptual editorial illustration' }
  };
  function mediumDirector(effectiveArtDirection){
    if(PHOTOGRAPHY_STYLES[effectiveArtDirection]){
      var p = PHOTOGRAPHY_DIRECTION[effectiveArtDirection];
      return Object.assign({ medium:'photography' }, p);
    }
    var il = ILLUSTRATION_DIRECTION[effectiveArtDirection] || ILLUSTRATION_DIRECTION['modern flat illustration'];
    return Object.assign({ medium:'illustration' }, il);
  }
  CCE.mediumDirector = mediumDirector;

  /* Phase 12.2 §6: Sales Page 9장은 photography/illustration/3D/collage/
     infographic을 무분별하게 섞지 않는다 — Campaign마다 primaryMedium 하나를
     확정하고(AVPE Phase 11.5가 이미 계산해 둔 대표 스타일 strategy.artDirection을
     그대로 재사용 — 재계산 없음), 각 장은 그 Medium 안에서 카메라 앵글/거리/
     구도/정보 밀도/피사체 비중/조명 강도만 shotType·역할별로 바꾼다. */
  var SHOT_TYPE_CAMERA_DETAIL = {
    'wide-hero-shot':   { distance:'와이드 풀샷', infoDensity:'낮음(핵심 피사체 하나에 집중)', subjectEmphasis:'상품/인물이 구도의 중심을 차지' },
    'subject-focused':  { distance:'미디엄 샷', infoDensity:'중간', subjectEmphasis:'인물의 표정과 자세가 중심' },
    'product-closeup':  { distance:'클로즈업', infoDensity:'중간~높음(상품 디테일 강조)', subjectEmphasis:'상품이 프레임 대부분을 차지' },
    'process-shot':     { distance:'미디엄 와이드', infoDensity:'높음(여러 요소 나열)', subjectEmphasis:'자료/요소들이 고르게 분산' }
  };
  var ROLE_LIGHTING_INTENSITY = {
    hero:'강하고 확신에 찬 조명', pain:'낮고 가라앉은 조명', beforeAfter:'화면 좌우가 대비되는 조명',
    solution:'점차 밝아지는 상승형 조명', toc:'고르고 중립적인 조명', benefits:'따뜻하고 밝은 조명',
    targetAudience:'부드럽고 동경을 자아내는 조명', faq:'차분하고 안정적인 조명', cta:'Hero와 동일한 강하고 확신에 찬 조명'
  };

  /* ══════════════════════════════════════════════════════════════
     3. Lighting and Color Director — brandStrategy에 따라 조명/대비/재질/색온도가
        실제로 달라진다. AVPE의 recurringPalette/recurringLighting 문자열은 그대로
        재사용하고(재계산 없음), 여기서는 그것을 광고 조명 설계로 확장한다.
     ══════════════════════════════════════════════════════════════ */
  var LIGHTING_COLOR_BY_STRATEGY = {
    Authority: { lightingType:'dramatic directional studio lighting', keyLightDirection:'45-degree high key light', fillLight:'low-intensity fill to preserve contrast', rimLight:'subtle cool rim light for separation', contrastLevel:'high', shadowCharacter:'defined, controlled shadows', colorTemperature:'neutral-to-cool with warm gold accent', grading:'deep contrast grade with controlled highlights', premiumCue:'polished, high-contrast finish', emotionalCue:'confidence and authority' },
    Trust: { lightingType:'even, bright, shadow-soft lighting', keyLightDirection:'frontal soft key light', fillLight:'strong fill for even exposure', rimLight:'minimal, none required', contrastLevel:'low-to-moderate', shadowCharacter:'soft, minimal shadows', colorTemperature:'clean neutral-cool', grading:'flat, even grade with clear whites', premiumCue:'clarity and cleanliness', emotionalCue:'reassurance and clarity' },
    Relationship: { lightingType:'soft warm natural window light', keyLightDirection:'side window key light', fillLight:'warm ambient bounce fill', rimLight:'soft warm rim from window backlight', contrastLevel:'low', shadowCharacter:'soft, warm-toned shadows', colorTemperature:'warm', grading:'warm, gentle grade with lifted shadows', premiumCue:'warmth and approachability', emotionalCue:'comfort and connection' }
  };
  var NEUTRAL_LIGHTING_COLOR = { lightingType:'balanced soft natural lighting', keyLightDirection:'soft frontal key light', fillLight:'moderate fill', rimLight:'minimal', contrastLevel:'moderate', shadowCharacter:'soft, balanced shadows', colorTemperature:'neutral', grading:'balanced natural grade', premiumCue:'clean balance', emotionalCue:'approachability' };
  function lightingColorDirector(brandStrategy, recurringPalette, recurringLighting, category){
    var base = LIGHTING_COLOR_BY_STRATEGY[brandStrategy] || NEUTRAL_LIGHTING_COLOR;
    var c = creative(category);
    return Object.assign({
      paletteRole: {
        dominant: recurringPalette,
        secondary: '보조 색은 지배색과 같은 온도 계열에서 한 단계 옅은 톤을 사용',
        accent: '상품 목업 또는 핵심 오브젝트에만 제한적으로 사용하는 포인트 색',
        neutral: '배경은 지배색보다 채도를 낮춘 중립 톤',
        skinToneHandling: c.subjectRequired ? '자연스러운 피부 톤 유지, 팔레트에 맞춰 과도하게 색을 입히지 않음' : '해당 없음(인물 미등장)'
      }
    }, base);
  }
  CCE.lightingColorDirector = lightingColorDirector;

  /* ══════════════════════════════════════════════════════════════
     4. Subject / Environment / Product Mockup Directors
     ══════════════════════════════════════════════════════════════ */
  var SUBJECT_PROHIBITED = ['distorted hands or fingers','distorted or asymmetric facial features','identifiable real individual unless the user explicitly asked to include themselves','exaggerated stock-photo grin'];
  function subjectDirector(category){
    var c = creative(category);
    if(!c.subjectRequired){
      return { subjectRequired:false, reason:'이 주제는 인물 없이 상품/프로세스 중심(product-led 또는 conceptual scene)으로 표현하는 것이 메시지 전달에 더 적합합니다.' };
    }
    return {
      subjectRequired: true,
      subjectDescription: c.persona,
      ageRange: '20~40대',
      appearance: '한국인 피사체, 자연스러운 인상',
      wardrobe: '주제와 상황에 맞는 자연스러운 일상/업무 복장',
      bodyLanguage: '과장되지 않은 자연스러운 동작',
      facialExpression: '스톡사진식 과장된 미소 대신 상황에 맞는 자연스러운 표정',
      gazeDirection: '상품 또는 장면의 핵심 오브젝트를 향함',
      handAction: '실제 동작(쓰기/짚기/살펴보기 등 상황에 맞는 자연스러운 손동작)',
      relationshipToProduct: '상품을 실제로 사용하고 있는 자연스러운 관계',
      authenticityNotes: c.subjectNotes || '자연스러운 순간을 포착한 듯한 연출',
      prohibitedDepictions: (c.prohibitedDepictions||[]).concat(SUBJECT_PROHIBITED)
    };
  }
  CCE.subjectDirector = subjectDirector;

  function environmentDirector(category){
    var c = creative(category);
    return {
      location: c.setting,
      timeOfDay: /저녁|밤/.test(c.setting) ? '저녁' : /아침|오전/.test(c.setting) ? '아침' : '낮',
      spatialStory: c.setting+' — 장면의 모든 요소가 "'+c.transformedState+'"라는 메시지를 강화하도록 배치',
      foreground: c.heroObject,
      midground: c.subjectRequired ? c.persona+'의 동작' : '핵심 오브젝트 주변의 정돈된 소품',
      background: '메시지와 무관한 장식 요소를 배제한 단순하고 정돈된 배경',
      environmentalDetails: c.visualRecognitionCues,
      atmosphere: c.emotionalTone,
      realismLevel: '일상적이지만 정돈된 리얼리즘(과장된 연출 배제)',
      clutterPolicy: '판매 메시지와 무관한 장식 요소를 채우지 않는다 — 모든 소품은 메시지를 강화할 때만 포함'
    };
  }
  CCE.environmentDirector = environmentDirector;

  var MOCKUP_TYPE_BY_CATEGORY_HINT = {
    finance:'인쇄된 로드맵 워크북과 체크리스트', business:'전략 플레이북과 체크리스트 세트',
    technology:'노트북 화면 속 워크플로우 가이드', health:'습관 기록 저널과 체크리스트',
    medical:'인쇄된 절차 매뉴얼과 체크리스트', parenting:'인쇄된 체크리스트와 일정표',
    education:'요약 노트와 플래시카드 세트', lifestyle:'루틴 플래너와 체크리스트',
    household:'가계 관리 표와 체크리스트', energy:'절약 체크리스트와 사용량 기록표',
    emotional:'다이어리와 감정 기록 시트', 'self-development':'목표 기록 저널과 습관 체크리스트',
    'professional-operations':'인쇄된 실무 매뉴얼과 체크리스트 세트', neutral:'가이드북과 체크리스트'
  };
  function productMockupDirector(category, brandStrategy){
    var c = creative(category);
    var material = brandStrategy==='Authority' ? '매트 프리미엄 표지 재질과 두꺼운 워크북 용지'
      : brandStrategy==='Trust' ? '깔끔한 매트 표지와 표준 워크북 용지'
      : '따뜻한 질감의 표지와 손에 익은 노트 용지';
    return {
      mockupRequired: true,
      mockupType: MOCKUP_TYPE_BY_CATEGORY_HINT[category] || MOCKUP_TYPE_BY_CATEGORY_HINT.neutral,
      coverTreatment: '전자책 표지 디자인이 실제로 보이되, 텍스트는 추상적인 블록/라인으로만 암시(가짜 글자 생성 금지)',
      perspective: '살짝 기울어진 3/4 시점으로 두께와 재질이 드러나도록',
      material: material,
      thickness: '실제로 사용 가능한 워크북 수준의 적당한 두께감',
      screenOrPrintContext: /technology/.test(category) ? '노트북 또는 태블릿 화면 속 미리보기' : '인쇄된 실물 워크북/체크리스트',
      supportingMaterials: [c.heroObject, '체크 표시가 된 진행 체크리스트'],
      interaction: c.subjectRequired ? '인물이 자연스럽게 넘기거나 짚어보는 상호작용' : '별도 상호작용 없이 독립적으로 놓인 상태',
      lighting: '장면의 조명 방향과 일치하는 자연스러운 그림자',
      premiumDetails: ['은은한 엠보싱 느낌의 표지 질감', '정돈된 여백'],
      consistencyKey: c.heroObject
    };
  }
  CCE.productMockupDirector = productMockupDirector;

  /* ══════════════════════════════════════════════════════════════
     5. Composition Director — Thumbnail/Sales Page 모두 AVPE가 이미 계산한 Safe
        Area를 그대로 재사용한다(재계산 없음).
     ══════════════════════════════════════════════════════════════ */
  var SHOT_ZONE = {
    'wide-hero-shot': '전체 프레임을 아우르는 와이드 장면',
    'subject-focused': '피사체가 살짝 오프센터로 배치된 중심 구역',
    'product-closeup': '상품이 화면을 지배하는 타이트한 클로즈업 구역',
    'process-shot': '과정/자료가 균형 있게 배치된 구역'
  };
  function compositionDirector(canvas, shotType, safeArea, subjectRequired){
    var dominantZone = SHOT_ZONE[shotType] || SHOT_ZONE['subject-focused'];
    var eyeFlow = subjectRequired
      ? (shotType==='product-closeup' ? '상품 → Safe Area 순서로 시선 이동' : '피사체의 시선 → 상품/핵심 오브젝트 → Safe Area 순서로 시선 이동')
      : '핵심 오브젝트 → Safe Area 순서로 시선 이동';
    return {
      canvas: canvas,
      dominantZone: dominantZone,
      subjectPlacement: subjectRequired ? (shotType==='wide-hero-shot' ? '프레임 중앙에서 살짝 벗어난 위치, 여유 공간과 함께' : '프레임의 2/3 지점, Safe Area와 겹치지 않게') : '해당 없음(인물 미등장)',
      productPlacement: shotType==='product-closeup' ? '프레임 중심, 최대 크기로 강조' : '피사체와 자연스럽게 연결되는 위치, Safe Area 침범 금지',
      eyeFlow: eyeFlow,
      depthLayers: '전경(핵심 피사체/상품) · 중경(보조 동작/소품) · 배경(단순하고 정돈된 배경) 3단 구성',
      negativeSpace: 'Safe Area와 겹치는 구역은 의도적으로 비워 시각적 여백 확보',
      safeArea: safeArea,
      cropSafety: '축소 시에도 핵심 피사체/상품이 잘리지 않도록 프레임 안쪽 10% 여유 확보',
      mobileReadability: '작은 목록 썸네일 크기에서도 2~3초 안에 핵심 메시지가 인식되도록 단일 초점 유지',
      compositionDiagramText: '[좌상단 여백] — [핵심 피사체/상품 '+dominantZone+'] — [Safe Area: '+ (typeof safeArea==='string'?safeArea:(safeArea&&safeArea.phrase)||'') +']'
    };
  }
  CCE.compositionDirector = compositionDirector;

  /* ══════════════════════════════════════════════════════════════
     6. Emotional Direction / Typography Overlay Director
     ══════════════════════════════════════════════════════════════ */
  function emotionalDirectionDirector(moodContinuity, archetypeEmotionalHook){
    return {
      overallMood: moodContinuity,
      sceneSpecificEmotion: archetypeEmotionalHook,
      emotionalArc: '문제 인식 → 긴장 또는 공감 → 해소/확신으로 이어지는 감정 흐름을 유지'
    };
  }
  CCE.emotionalDirectionDirector = emotionalDirectionDirector;

  function typographyOverlayDirector(typographyDirection){
    return {
      typographyDirection: typographyDirection,
      overlayPolicy: '이미지 안에는 어떤 글자도 생성하지 않는다 — 모든 한글 Headline/Badge/CTA/본문 텍스트는 Atlas가 이미지 생성 이후 별도로 오버레이한다.',
      approvedTextSource: '오버레이할 텍스트는 반드시 Marketing Copy Engine이 이미 승인한 문구만 사용하고, 이 Engine이 새로 카피를 만들지 않는다.'
    };
  }
  CCE.typographyOverlayDirector = typographyOverlayDirector;

  /* ══════════════════════════════════════════════════════════════
     7. Input Normalizer / Product Truth / Audience Insight / Positioning
     ══════════════════════════════════════════════════════════════ */
  CCE.inputNormalizer = function(rawInput){
    rawInput = rawInput || {};
    return {
      topic: rawInput.topic || '',
      targetAudience: rawInput.targetAudience || '',
      sourceSummary: rawInput.sourceSummary || '',
      brandProfile: rawInput.brandProfile || null,
      marketingCopy: rawInput.marketingCopy || null,
      thumbnailBlueprint: rawInput.thumbnailBlueprint || null,
      salesPageBlueprint: rawInput.salesPageBlueprint || null,
      ebookBlueprint: rawInput.ebookBlueprint || null,
      visualPromptSet: rawInput.visualPromptSet || null
    };
  };

  /* Product Truth Extractor — 실제 입력에 없는 실적/수익/후기/자격을 만들지 않는다.
     tangibleDeliverables는 Marketing Copy의 실제 benefits/faqs에서만 뽑는다. */
  CCE.productTruthExtractor = function(input){
    var mc = input.marketingCopy || {};
    var category = (input.visualPromptSet && input.visualPromptSet.visualStrategy && input.visualPromptSet.visualStrategy.category) || 'neutral';
    var c = creative(category);
    var benefits = mc.benefits || [];
    var faqs = mc.faqs || [];
    var prohibitedClaims = [];
    if(!mc.trust) prohibitedClaims.push('검증된 후기/신뢰 지표 없음 — 후기·평점 이미지 요소 생성 금지');
    if(!mc.scarcity) prohibitedClaims.push('실제 수량 제한 근거 없음 — 품절 임박/한정 수량 이미지 요소 생성 금지');
    if(!mc.urgency) prohibitedClaims.push('실제 마감 일정 근거 없음 — 카운트다운/마감 임박 이미지 요소 생성 금지');
    prohibitedClaims.push('검증되지 않은 매출/수익 수치 이미지 요소 생성 금지');
    prohibitedClaims.push('실제 보유하지 않은 자격/인증 배지 생성 금지');
    return {
      productType: c.productType,
      coreProblem: input.topic ? ('"'+input.topic+'"을 아직 해결하지 못해 발생하는 '+c.currentState) : c.currentState,
      corePromise: mc.hook || mc.headline || c.transformedState,
      tangibleDeliverables: benefits.slice(),
      transformation: c.currentState+' → '+c.transformedState,
      proofElements: faqs.map(function(f){ return f.q; }),
      differentiators: [c.competitiveVisualAngle],
      readerObjections: faqs.map(function(f){ return f.q; }),
      emotionalReward: c.emotionalTone,
      prohibitedClaims: prohibitedClaims
    };
  };

  /* Phase 12.1: hiddenFrustration/desiredIdentity/purchaseTrigger/purchaseAnxiety를
     "무엇부터 해야 할지 모르는 상태" 같은 고정 템플릿이 아니라, CATEGORY_CREATIVE에
     카테고리별로 authored된 실제 심리·구매 상황을 그대로 사용한다 — 5개 검증 주제가
     서로 다른 문장을 갖도록 보장한다. */
  CCE.audienceInsightDirector = function(input, category){
    var c = creative(category);
    var primaryAudience = input.targetAudience || c.persona;
    return {
      primaryAudience: primaryAudience,
      currentSituation: c.currentState,
      visibleProblem: c.currentState,
      hiddenFrustration: c.hiddenFrustration,
      desiredIdentity: c.desiredIdentity,
      purchaseTrigger: c.purchaseTrigger,
      purchaseAnxiety: c.purchaseAnxiety,
      visualRecognitionCues: c.visualRecognitionCues,
      emotionalEntryPoint: c.emotionalTone,
      sophisticationLevel: (input.brandProfile && input.brandProfile.informationDensity==='높음') ? '정보에 익숙하고 근거를 따지는 편' : (input.brandProfile && input.brandProfile.informationDensity==='낮음') ? '복잡한 설명보다 감정적 공감을 먼저 원하는 편' : '적당한 설명과 근거를 함께 원하는 편'
    };
  };

  /* V3 Phase 2 Round 7: Quantified Promise Extractor — 썸네일 이미지 프롬프트가
     지금까지 category+archetype 조합에서만 나와, 서로 다른 두 전자책이 완전히
     동일한 프롬프트를 받는 것이 확인된 핵심 병목이었다. productTruth.corePromise/
     coreProblem은 이미 이 책의 실제 마케팅 문구(input.topic, mc.hook/headline)를
     담고 있는 유일한 진짜 책별 데이터지만 한국어 자유 문장이라 번역 없이는 영문
     이미지 프롬프트에 안전하게 넣을 수 없다(오번역 위험, Never Guess). 대신
     숫자+단위처럼 폐쇄형이라 안전하게 치환 가능한 부분만 뽑아 이미지가 "이 책만의
     실제 숫자"를 반영하게 한다 — 카테고리 템플릿이 아니라 이 상품의 진짜 약속에서
     나온 신호. 숫자를 못 찾으면 hasSignal:false를 반환하고 아무것도 지어내지
     않는다(Round 5 "Never fabricate evidence" 원칙 유지). */
  var QUANTITY_UNIT_EN = {
    '시간':'hours', '개월':'months', '가지':'items', '단계':'steps', '퍼센트':'percent',
    '만원':'units of 10,000 KRW', '억':'units of 100 million KRW', '퍼':'percent',
    '주':'weeks', '개':'items', '권':'books', '장':'pages', '배':'times', '일':'days',
    '년':'years', '분':'minutes', '%':'percent'
  };
  CCE.quantifiedPromiseSignal = function(productTruth){
    var pt = productTruth || {};
    var text = String(pt.corePromise||'')+' '+String(pt.coreProblem||'');
    var re = /([0-9]{1,4})\s*(시간|개월|가지|단계|퍼센트|만원|억|퍼|주|개|권|장|배|일|년|분|%)/;
    var m = re.exec(text);
    if(!m) return { hasSignal:false };
    var number = m[1];
    var unitEn = QUANTITY_UNIT_EN[m[2]] || '';
    return {
      hasSignal: true,
      number: number,
      unitEn: unitEn,
      phraseEn: 'a bold, simple numeric motif suggesting the figure '+number+(unitEn?(' in '+unitEn):'')+', worked subtly into the scene as a graphic shape, object count, or visual rhythm — never as literal readable text or digits'
    };
  };

  /* Phase 12.1: positioningStatement은 카테고리별로 손으로 작성한 자연스러운 한
     문장([누구에게]-[어떤 문제를]-[어떤 방식으로]-[어떤 변화로 연결하는지] 4단
     구조)을 그대로 쓴다 — 입력 필드를 프로그램으로 이어 붙이면 "모습를"류 조사
     오류나 "정한다 방식으로" 같은 비문이 생기기 쉬워, 실제 자연스러운 한국어
     문장 하나를 authored 데이터로 관리한다(campaignObjective처럼 단순 인용
     패턴만 프로그램으로 조립한다). singleMindedMessage도 카테고리별 authored된
     단 하나의 차별화 메시지를 그대로 쓴다("무엇부터 해야 할지 보여준다"를 모든
     주제에 반복하지 않는다). */
  CCE.campaignPositioningDirector = function(input, category, productTruth, audienceInsight){
    var c = creative(category);
    var brandStrategy = input.brandProfile && input.brandProfile.brandStrategy;
    return {
      campaignObjective: audienceInsight.primaryAudience+josaIGa(audienceInsight.primaryAudience)+' "'+audienceInsight.hiddenFrustration+'"에서 벗어나 첫 행동을 시작하게 만든다',
      positioningStatement: c.positioningStatement,
      singleMindedMessage: c.singleMindedMessage,
      reasonToBelieve: productTruth.tangibleDeliverables.length ? productTruth.tangibleDeliverables : [c.trustSignal],
      desiredResponse: audienceInsight.purchaseTrigger,
      competitiveVisualAngle: c.competitiveVisualAngle,
      premiumSignal: c.premiumSignal,
      trustSignal: c.trustSignal,
      emotionalTone: c.emotionalTone,
      brandStrategy: brandStrategy || null
    };
  };

  /* ══════════════════════════════════════════════════════════════
     8. Big Idea Generator — archetype 5종 선택 + Visual Story 확장.
        Phase 12.1: bigIdea(전략 문장)와 sceneStory(카메라 사건)를 서로 다른
        문자열로 분리했고, whyItStopsTheScroll/risk도 archetype마다 authored된
        서로 다른 문장을 그대로 쓴다("크몽/탈잉..." 고정 템플릿 제거).
     ══════════════════════════════════════════════════════════════ */
  /* Phase 12.2 §5: bigIdea는 archetype의 일반 설명(archetypePrinciple)이 아니라
     "이 상품"에 고유한 문장이어야 한다. 실제 Deliverable(productTruth.
     tangibleDeliverables[0])과 구체적 변화(c.currentState→c.transformedState)를
     항상 포함시켜(요구된 5개 항목 중 최소 2개: 실제 Deliverable + 독자가 얻는
     구체적 변화), archetype마다 다른 문장 구조로 배치한다 — 카테고리명만 바꾼
     공통 문장이 아니라, 실제 승인된 Marketing Copy의 benefits와 카테고리별
     현재/변화 상태가 실질적으로 대입된다. */
  function fallbackDeliverable(c){ return c.heroObject; }
  var PRODUCT_SPECIFIC_BIG_IDEA = {
    'transformation-moment': function(c,d){ return d+josaEulReul(d)+' 실제로 따라가면 '+c.currentState+'에서 '+c.transformedState+josaEuroRo(c.transformedState)+' 바뀐다는 것을 한 장면으로 보여준다.'; },
    'tension-and-release': function(c,d){ return c.currentState+josaIGa(c.currentState)+' 주는 압박감을 먼저 인정하고, '+d+josaEulReul(d)+' 통해 실제로 풀린다는 것을 보여준다.'; },
    'aspirational-identity': function(c,d){ return d+josaEulReul(d)+' 통해 '+c.persona+josaIGa(c.persona)+' 결국 '+c.transformedState+'에 도달하는 모습을 먼저 보여준다.'; },
    'product-as-hero': function(c,d){ return d+josaIGa(d)+' 그 자체로 '+c.transformedState+josaEulReul(c.transformedState)+' 만들어내는 핵심 도구임을 상품 중심 장면으로 증명한다.'; },
    'editorial-authority': function(c,d){ return d+josaEulReul(d)+' 절제된 화보 구도로 보여줘, 이 상품이 '+c.transformedState+'에 도달하도록 돕는다는 근거 있는 인상을 준다.'; },
    'human-story': function(c,d){ return c.persona+josaIGa(c.persona)+' 실제 하루 속에서 '+d+josaEulReul(d)+' 사용해 '+c.transformedState+'에 이르는 이야기를 전달한다.'; },
    'visual-metaphor': function(c,d){ return c.symbolicObject+josaEuroRo(c.symbolicObject)+' '+c.currentState+'에서 '+c.transformedState+josaEuroRo(c.transformedState)+'의 변화를 암시하고, 그 변화의 실체가 '+d+'임을 뒤이어 증명한다.'; },
    'before-and-after': function(c,d){ return c.currentState+josaWaGwa(c.currentState)+' '+c.transformedState+josaEulReul(c.transformedState)+' 나란히 대비시켜, '+d+josaIGa(d)+' 만든 실제 차이를 즉시 체감시킨다.'; },
    'proof-and-process': function(c,d){ return d+josaWaGwa(d)+' 함께 실제 사용 단계를 보여줘, '+c.transformedState+'에 이르는 과정이 검증 가능함을 증명한다.'; },
    'contrarian-insight': function(c,d){ return '일반적인 기대와 달리, '+d+josaIGa(d)+' 아니라 '+c.symbolicObject+josaIGa(c.symbolicObject)+' 진짜 변화의 열쇠라는 관점을 제시한다.'; }
  };

  /* Phase 12.2 이후 그대로인 per-archetype concept 조립 로직 — bigIdeaGenerator(카테고리
     profile과 가장 잘 맞는 상위 5개 archetype을 자동 랭킹)와, Phase 15.2의
     CCE.buildConceptForArchetype(호출자가 archetypeId를 직접 지정)이 이 하나의 헬퍼를
     공유한다. 로직 자체는 한 글자도 바뀌지 않았다 — bigIdeaGenerator의 인라인
     .map() 콜백을 그대로 옮겨 온 것뿐이다. */
  function buildConceptObject(a, index, c, productTruth, audienceInsight, deliverable){
    var scene = buildArchetypeScene(a.id, c);
    var conceptId = 'concept-'+(index+1);
    return {
      conceptId: conceptId,
      conceptName: a.name,
      archetypeId: a.id,
      archetypePrinciple: scene.archetypePrinciple,
      bigIdea: PRODUCT_SPECIFIC_BIG_IDEA[a.id](c, deliverable),
      campaignHeadlineIntent: '"'+productTruth.corePromise+'"라는 약속을, "'+a.name+'" 방식으로 전달하려는 의도(실제 헤드라인 문구는 승인된 Marketing Copy를 그대로 사용)',
      sceneStory: scene.sceneStory,
      visualEvent: scene.visualEvent,
      sceneSkeleton: scene.sceneSkeleton,
      cameraLanguage: scene.cameraLanguage,
      compositionPattern: scene.compositionPattern,
      visualHook: scene.visualHook,
      emotionalHook: scene.emotionalHook,
      productRole: scene.productRole,
      subjectRole: scene.subjectRole,
      visualTension: scene.visualTension,
      whyItStopsTheScroll: scene.whyItStopsTheScroll,
      whyItFitsTheAudience: audienceInsight.primaryAudience+'의 "'+audienceInsight.hiddenFrustration+'"에 직접 맞닿아 있다',
      differentiation: c.competitiveVisualAngle,
      risk: scene.risk,
      recommended: false,
      archetypeScore: dot(a.profile, c.profile),
      archetypeScoreMax: ARCHETYPE_SCORE_MAX,
      revisionHistory: []
    };
  }

  CCE.bigIdeaGenerator = function(category, productTruth, audienceInsight){
    var c = creative(category);
    var ranked = ARCHETYPE_POOL.map(function(a){
      return { archetype:a, score: dot(a.profile, c.profile) };
    }).sort(function(x,y){ return y.score-x.score; }).slice(0,5);
    /* 후속 수정: productTruth.tangibleDeliverables[0]은 Marketing Copy의 완전한
       문장형 benefit(예: "핵심만 빠르게 확인할 수 있습니다.")이라 조사를 붙여
       명사처럼 문장 중간에 끼워 넣으면 비문이 된다("...습니다.가 아니라" 등,
       실제 발견된 버그). PRODUCT_SPECIFIC_BIG_IDEA 템플릿은 명사구를 요구하므로
       카테고리의 실제 명사구 아티팩트(c.heroObject)만 사용한다. */
    var deliverable = fallbackDeliverable(c);

    return ranked.map(function(r, i){
      return buildConceptObject(r.archetype, i, c, productTruth, audienceInsight, deliverable);
    });
  };

  /* Phase 15.2: Creative Director Adapter(js/creative-director-adapter.js)가 "5개
     고정 판매 전략"(Problem-Led/Product-Hero/Human-Story/Before-After/Proof-or-Process)을
     항상 만들 수 있도록, bigIdeaGenerator의 top-5 자동 랭킹과 무관하게 특정
     archetypeId 하나에 대한 concept를 직접 만든다 — 데이터 소스와 로직은
     buildConceptObject() 하나로 완전히 동일하다(새 Engine 아님, 새 계산 없음). */
  CCE.buildConceptForArchetype = function(archetypeId, category, productTruth, audienceInsight){
    var c = creative(category);
    var archetype = ARCHETYPE_POOL.filter(function(a){ return a.id===archetypeId; })[0];
    if(!archetype) return null;
    var deliverable = fallbackDeliverable(c);
    return buildConceptObject(archetype, 0, c, productTruth, audienceInsight, deliverable);
  };

  /* ══════════════════════════════════════════════════════════════
     9. Thumbnail Concept Director — 5개 Big Idea 각각에 완성형 Thumbnail Brief
     ══════════════════════════════════════════════════════════════ */
  var THUMBNAIL_CANVAS = '652×488px';
  function claudeDesignThumbnailPrompt(concept, subject, environment, mockup, composition, medium, lighting, approvedCopy){
    var lines = [];
    lines.push('[Thumbnail Creative Brief — '+concept.conceptName+']');
    /* Phase 12.4 §6: "A professional editorial illustration..." 같은 스타일
       설명이 아니라 "Show the exact moment when..." 형태로 장면(사건)이 먼저
       오도록 만든다 — 연출 방식(medium)은 이 사건을 뒷받침하는 정보로 뒤에 온다. */
    if(concept.visualEvent) lines.push('Show the exact moment when: '+concept.visualEvent+'.');
    lines.push('장면: '+concept.sceneStory);
    if(subject.subjectRequired){
      lines.push('피사체: '+subject.subjectDescription+' ('+subject.ageRange+', '+subject.appearance+'), '+subject.bodyLanguage+', 표정: '+subject.facialExpression+', 시선: '+subject.gazeDirection+', 손동작: '+subject.handAction+'.');
    } else {
      lines.push('피사체 없음 — 상품/오브젝트 중심(product-led) 장면으로 연출.');
    }
    lines.push('환경: '+environment.location+', '+environment.atmosphere+' 분위기. 전경에 '+environment.foreground+', 배경은 '+environment.background+'.');
    lines.push('상품 표현: '+mockup.mockupType+', '+mockup.perspective+', '+mockup.material+'. 표지에는 실제 읽을 수 있는 글자를 넣지 말고 추상적인 블록/라인으로만 암시.');
    lines.push('구도: '+composition.dominantZone+', '+composition.eyeFlow+'. '+composition.negativeSpace+'.');
    lines.push('연출 방식('+medium.medium+'): '+(medium.medium==='photography' ? (medium.commercialReferenceLanguage+', '+medium.cameraAngle+', '+medium.depthOfField) : (medium.editorialReferenceLanguage+', '+medium.illustrationTechnique+', '+medium.shapeLanguage))+'.');
    lines.push('조명/색: '+lighting.lightingType+', 지배색 '+lighting.paletteRole.dominant+', '+lighting.emotionalCue+'.');
    lines.push('감정 목표: '+concept.emotionalHook+'.');
    lines.push('Safe Area: '+composition.safeArea+' — 이 영역은 비워두고 Atlas가 승인된 한글 텍스트("'+approvedCopy.headline+'")를 나중에 오버레이합니다. 이미지 안에 어떤 글자도 넣지 마세요.');
    lines.push('규격: '+THUMBNAIL_CANVAS+', 모바일 목록 축소 시에도 핵심 피사체가 2~3초 안에 인식되어야 합니다.');
    return lines.join('\n');
  }
  CCE.thumbnailConceptDirector = function(input, category, bigIdeas, negativeInstructions, thumbnailSafeArea){
    var brandStrategy = input.brandProfile && input.brandProfile.brandStrategy;
    var mc = input.marketingCopy || {};
    var approvedCopy = { headline: mc.headline||'', subheadline: mc.subheadline||'', badge: mc.badge||'', cta: (mc.cta && mc.cta.text) || mc.cta || '' };
    var recommendedArtDirection = (input.visualPromptSet && input.visualPromptSet.thumbnailPrompts && input.visualPromptSet.thumbnailPrompts[0] && input.visualPromptSet.thumbnailPrompts[0].effectiveArtDirection) || 'modern flat illustration';

    return bigIdeas.map(function(concept, i){
      var subject = subjectDirector(category);
      if(!subject.subjectRequired && concept.subjectRole!=='product-led'){
        concept.subjectRole = 'product-led'; /* 이 카테고리는 인물이 강제되지 않는다 */
      }
      var environment = environmentDirector(category);
      var mockup = productMockupDirector(category, brandStrategy);
      /* 5개 Concept가 서로 다른 Thumbnail Prompt와 대응되도록, i번째 Concept은 AVPE의
         i번째 Thumbnail Prompt의 effectiveArtDirection을 재사용한다(재계산 없음). */
      var avpeThumb = (input.visualPromptSet && input.visualPromptSet.thumbnailPrompts && input.visualPromptSet.thumbnailPrompts[i]) || null;
      var effectiveArtDirection = avpeThumb ? avpeThumb.effectiveArtDirection : recommendedArtDirection;
      var medium = mediumDirector(effectiveArtDirection);
      var lighting = lightingColorDirector(brandStrategy, (input.visualPromptSet && input.visualPromptSet.consistencyRules && input.visualPromptSet.consistencyRules.recurringPalette) || '', (input.visualPromptSet && input.visualPromptSet.consistencyRules && input.visualPromptSet.consistencyRules.recurringLighting) || '', category);
      var shotType = i%2===0 ? 'subject-focused' : 'product-closeup';
      if(concept.subjectRole==='product-led') shotType = 'product-closeup';
      var composition = compositionDirector(THUMBNAIL_CANVAS, shotType, thumbnailSafeArea, subject.subjectRequired);

      return {
        conceptId: concept.conceptId,
        campaignConcept: concept.conceptName,
        approvedCopy: approvedCopy,
        visualStory: concept.sceneStory,
        subject: subject,
        environment: environment,
        productMockup: mockup,
        composition: composition,
        mediumDirection: medium,
        lightingAndColor: lighting,
        safeArea: thumbnailSafeArea,
        emotionalGoal: concept.emotionalHook,
        visualHook: concept.visualHook,
        mandatoryElements: [mockup.mockupType, '승인된 배지 문구는 이미지가 아닌 오버레이로 처리'],
        optionalElements: subject.subjectRequired ? ['피사체의 자연스러운 손동작'] : ['보조 소품 1~2개'],
        exclusions: ['가짜 텍스트/숫자', '스톡사진식 과장된 미소', '경쟁 이미지에 흔한 평범한 카드형 레이아웃'],
        claudeDesignPrompt: claudeDesignThumbnailPrompt(concept, subject, environment, mockup, composition, medium, lighting, approvedCopy),
        claudeDesignNativePrompt: CCE.claudeDesignPromptBuilder(concept, category, brandStrategy, lighting.paletteRole.dominant, thumbnailSafeArea, negativeInstructions),
        negativeInstructions: negativeInstructions,
        evaluation: null /* Concept Evaluator가 채운다 */
      };
    });
  };

  /* ══════════════════════════════════════════════════════════════
     10. Sales Page Storyboard Director — AVPE의 9개 Sales Page Prompt(roleKey별
         effectiveArtDirection/safeArea/consistencyCarryover)를 그대로 읽기 전용
         입력으로 재사용하고, 그 위에 캠페인 스토리(narrativeBeat/전환/장면)를
         얹는다.
     ══════════════════════════════════════════════════════════════ */
  var STORYBOARD_ROLE_MAP = {
    hero:           { role:'Hero',            communicationGoal:'상품과 핵심 약속을 한눈에 전달', narrativeBeat:'상품과 핵심 약속', shotType:'wide-hero-shot' },
    pain:           { role:'Audience Reality', communicationGoal:'독자가 지금 처한 현실에 공감하게 만든다', narrativeBeat:'독자의 현재 상황', shotType:'subject-focused' },
    beforeAfter:    { role:'Problem Tension',  communicationGoal:'기존 방식으로는 해결되지 않는 문제를 심화시킨다', narrativeBeat:'문제의 심화', shotType:'subject-focused' },
    solution:       { role:'New Mechanism',    communicationGoal:'기존과 다른 해결 원리를 보여준다', narrativeBeat:'기존과 다른 해결 원리', shotType:'process-shot' },
    toc:            { role:'Product Experience', communicationGoal:'전자책 내부 구성과 사용 경험을 미리 보여준다', narrativeBeat:'전자책 내부와 사용 경험', shotType:'product-closeup' },
    benefits:       { role:'Deliverables',     communicationGoal:'실제로 포함된 자료를 구체적으로 보여준다', narrativeBeat:'실제 포함 자료', shotType:'process-shot' },
    targetAudience: { role:'Transformation',   communicationGoal:'독자가 자신을 이 모습에 대입해 변화를 상상하게 만든다', narrativeBeat:'읽은 뒤의 변화', shotType:'subject-focused' },
    faq:            { role:'Trust / FAQ',      communicationGoal:'남은 불안을 해소한다', narrativeBeat:'불안 해소', shotType:'process-shot' },
    cta:            { role:'CTA',              communicationGoal:'행동을 유도하고 상품을 다시 각인시킨다', narrativeBeat:'행동 유도와 상품 재확인', shotType:'wide-hero-shot' }
  };
  var STORYBOARD_ORDER = ['hero','pain','beforeAfter','solution','toc','benefits','targetAudience','faq','cta'];
  /* Phase 14: js/image-engine.js가 cc.salesPageStoryboard[i]에 대응하는 내부
     roleKey(salesPageSceneDirector/salesPageCameraDirector 등에 필요)를 얻기 위한
     읽기 전용 접근자 — STORYBOARD_ORDER 자체를 노출만 한다(새 데이터 없음). */
  CCE.SALES_PAGE_ROLE_KEYS = STORYBOARD_ORDER.slice();

  /* Phase 12.2 §7: "이전/다음 장면으로 이어지는 흐름" 같은 추상적 boilerplate 대신,
     인접한 두 장 사이에 실제로 무엇이(오브젝트) 어떻게 움직이고(움직임), 색/조명이
     어떻게 바뀌고(색 변화), 감정이 어떻게 바뀌는지(감정 변화)를 구체적으로 authored한다.
     STORYBOARD_ORDER의 인접한 8개 쌍(hero→pain, pain→beforeAfter, ...)마다 하나씩. */
  var TRANSITION_LINKS = [
    function(c){ return { object: c.heroObject, movement: '표지 목업을 비추던 카메라가 인물의 표정으로 서서히 좁혀짐(clip-in)', colorShift: '밝고 확신에 찬 톤에서 살짝 가라앉은 톤으로', emotionShift: '자신감에서 현실 인식으로' }; },
    function(c){ return { object: '문제 상황을 보여주던 소품', movement: '같은 공간이 화면 한가운데를 기준으로 둘로 갈라지는 듯한 분할 전환', colorShift: '가라앉은 톤이 화면 한쪽에서부터 점차 밝아짐', emotionShift: '현실 인식에서 대비 인식으로' }; },
    function(c){ return { object: c.symbolicObject, movement: '대비 장면의 밝은 쪽에서 상징적 오브젝트로 초점이 이동', colorShift: '대비의 밝은 톤이 그대로 이어짐', emotionShift: '대비 인식에서 기대감으로' }; },
    function(c){ return { object: c.heroObject, movement: '상징적 오브젝트에서 실제 상품 목업으로 초점이 전환', colorShift: '상징적 톤에서 실제 문서/제품 톤으로', emotionShift: '기대감에서 신뢰로' }; },
    function(c){ return { object: '목업 내부 페이지', movement: '목업 클로즈업에서 펼쳐진 자료 전체 샷으로 줌아웃', colorShift: '동일 톤 유지', emotionShift: '신뢰에서 만족으로' }; },
    function(c){ return { object: c.heroObject, movement: '펼쳐진 자료 샷에서 그 자료를 직접 확인하는 인물 샷으로 초점 이동', colorShift: '동일 톤 유지, 인물 쪽에 부드러운 하이라이트 추가', emotionShift: '만족에서 자기 확신으로' }; },
    function(c){ return { object: '문서/체크리스트', movement: '인물 샷에서 정돈된 문서 배치 샷으로 초점 이동', colorShift: '따뜻한 톤에서 차분한 톤으로', emotionShift: '자기 확신에서 안심으로' }; },
    function(c){ return { object: c.heroObject, movement: '문서 배치 샷에서 Hero 장면과 동일한 구도로 회귀(echo)', colorShift: '차분한 톤에서 Hero의 확신 톤으로 복귀', emotionShift: '안심에서 행동 결심으로' }; }
  ];
  function formatTransitionIn(link){ return '이전 장면에서: '+link.object+josaIGa(link.object)+' 중심 오브젝트로 이어지며, '+link.movement+'. 색/조명: '+link.colorShift+'. 감정: '+link.emotionShift+'.'; }
  function formatTransitionOut(link){ return '다음 장면으로: '+link.object+josaIGa(link.object)+' 다음 장의 핵심 오브젝트로 미리 암시되며, '+link.movement+'. 색/조명: '+link.colorShift+'. 감정: '+link.emotionShift+'.'; }

  function claudeDesignSalesPagePrompt(beat, subjectAction, productAppearance, composition, effectiveArtDirection, lighting, consistencyCarryover, safeArea){
    var lines = [];
    lines.push('['+beat.role+' — '+beat.narrativeBeat+']');
    lines.push('커뮤니케이션 목표: '+beat.communicationGoal);
    lines.push('장면: '+subjectAction);
    lines.push('상품 표현: '+productAppearance);
    lines.push('구도: '+composition.dominantZone+', '+composition.eyeFlow+'.');
    lines.push('스타일: '+effectiveArtDirection+'. 조명: '+lighting.lightingType+', 지배색 '+lighting.paletteRole.dominant+'.');
    lines.push('일관성 유지: '+consistencyCarryover.join(' | '));
    lines.push('Safe Area: '+(safeArea && safeArea.phrase ? safeArea.phrase : '')+' — 이미지 안에 어떤 글자도 넣지 마세요.');
    lines.push('규격: 1080×1350px.');
    return lines.join('\n');
  }

  CCE.salesPageStoryboardDirector = function(input, category, negativeInstructions, primaryMedium){
    var brandStrategy = input.brandProfile && input.brandProfile.brandStrategy;
    var c = creative(category);
    var mc = input.marketingCopy || {};
    var salesPrompts = (input.visualPromptSet && input.visualPromptSet.salesPagePrompts) || [];
    var byRole = {};
    salesPrompts.forEach(function(p){ byRole[p.roleKey] = p; });

    return STORYBOARD_ORDER.map(function(roleKey, i){
      var beat = STORYBOARD_ROLE_MAP[roleKey];
      var avpe = byRole[roleKey] || {};
      var subject = subjectDirector(category);
      var subjectAction;
      var heroSceneCore = subject.subjectRequired
        ? c.persona+josaIGa(c.persona)+' '+c.transformedState+josaEulReul(c.transformedState)+' 담은 광고 Hero 장면'
        : c.heroObject+josaIGa(c.heroObject)+' 프레임 중심에 놓인 광고 Hero 장면';
      if(roleKey==='hero') subjectAction = heroSceneCore;
      else if(roleKey==='pain') subjectAction = subject.subjectRequired ? c.persona+josaIGa(c.persona)+' '+c.currentState : c.currentState;
      else if(roleKey==='beforeAfter') subjectAction = c.currentState+josaWaGwa(c.currentState)+' '+c.transformedState+'의 대비';
      else if(roleKey==='solution') subjectAction = c.symbolicObject;
      else if(roleKey==='toc') subjectAction = c.heroObject+'의 내부 구성을 미리 보여주는 클로즈업';
      else if(roleKey==='benefits') subjectAction = '실제 포함 자료('+((input.marketingCopy&&input.marketingCopy.benefits)||[]).length+'개 항목)가 정돈되게 펼쳐진 장면';
      /* Phase 12.3 §10: "확인을 마치고 ~를 향해 다음 행동을 준비하는" 식으로
         같은 의미(다음 단계로 넘어감)를 두 번 말하지 않고, 한 번의 행동으로
         단순화한다(예: 첫 체크를 표시한 뒤 다음 행동을 준비하는 저녁 장면). */
      else if(roleKey==='targetAudience') subjectAction = subject.subjectRequired
        ? c.persona+josaIGa(c.persona)+' '+c.heroObject+josaEulReul(c.heroObject)+' 확인하며 첫 체크를 표시하고 다음 행동을 준비하는 장면'
        : c.heroObject+josaIGa(c.heroObject)+' 다음 단계를 준비하듯 정돈되게 놓인 장면';
      else if(roleKey==='faq') subjectAction = '정돈된 문서/체크리스트가 신뢰감 있게 배치된 장면';
      else subjectAction = heroSceneCore+'(도입부와 시각적으로 echo)';

      /* Phase 12.1: productAppearance가 9장 내내 동일한 문장("상품: {heroObject}")으로
         반복되지 않도록 역할별로 상품이 실제로 어떻게 보이는지를 다르게 authored한다. */
      var productAppearance;
      if(roleKey==='hero') productAppearance = c.heroObject+josaIGa(c.heroObject)+' 선명하게 드러남';
      else if(roleKey==='pain') productAppearance = '목업은 배경에 흐릿하게만 암시하고 문제 장면이 중심';
      else if(roleKey==='beforeAfter') productAppearance = c.heroObject+josaIGa(c.heroObject)+' 대비 장면 한쪽에 자연스럽게 등장';
      else if(roleKey==='solution') productAppearance = '목업을 직접 노출하지 않고 상징적 오브젝트로만 암시';
      else if(roleKey==='toc') productAppearance = c.heroObject+'의 내부 페이지 구성이 클로즈업으로 드러남';
      else if(roleKey==='benefits') productAppearance = c.heroObject+josaWaGwa(c.heroObject)+' 함께 포함 자료 전체가 펼쳐져 보임';
      else if(roleKey==='targetAudience') productAppearance = c.heroObject+josaEulReul(c.heroObject)+' 자연스럽게 손에 들고 있는 모습';
      else if(roleKey==='faq') productAppearance = '목업보다 문서/체크리스트 배치가 중심이고 목업은 보조적으로만 등장';
      else productAppearance = c.heroObject+josaIGa(c.heroObject)+' Hero 장면과 동일한 앵글로 다시 등장';

      var composition = compositionDirector('1080×1350px', beat.shotType, avpe.safeArea || null, subject.subjectRequired);
      /* Phase 12.1: AVPE(Phase 11.5)가 이미 계산해 둔 Role별 구도 문구("framed as ...")를
         재계산 없이 그대로 재사용해, 압축 Brief의 "구도" 표현이 9장 모두 서로 다르게
         만든다(shotType이 같은 역할끼리 CCE 자체 문구가 겹치는 문제를 해결). */
      var roleComposition = (avpe.prompt && (avpe.prompt.match(/framed as [\s\S]*?composition[^,.]*/)||[])[0]) || composition.dominantZone;
      var lighting = lightingColorDirector(brandStrategy, avpe.recurringPalette || '', avpe.recurringLighting || '', category);
      var consistencyCarryover = avpe.consistencyCarryover || [];
      /* Phase 12.2 §6: 9장 전부 primaryMedium 하나로 고정한다(캠페인 단위로 CCE.run()이
         이미 확정해 전달). AVPE(Phase 11.5)가 계산한 Role별 원래 값은 avpeRoleArtDirection
         에 그대로 남겨 투명하게 대조할 수 있게 한다 — AVPE 데이터 자체는 변경하지 않는다. */
      var effectiveArtDirection = primaryMedium;
      var avpeRoleArtDirection = avpe.effectiveArtDirection || null;
      var cameraDetail = SHOT_TYPE_CAMERA_DETAIL[beat.shotType];
      var lightingIntensity = ROLE_LIGHTING_INTENSITY[roleKey];

      return {
        pageNumber: i+1,
        role: beat.role,
        communicationGoal: beat.communicationGoal,
        narrativeBeat: beat.narrativeBeat,
        approvedCopy: roleKey==='hero' ? { headline: mc.headline||'', subheadline: mc.subheadline||'' } : roleKey==='cta' ? { cta: (mc.cta&&mc.cta.text)||mc.cta||'' } : roleKey==='faq' ? { faqs: mc.faqs||[] } : roleKey==='benefits' ? { benefits: mc.benefits||[] } : {},
        visualScene: subjectAction,
        subjectAction: subjectAction,
        productAppearance: productAppearance,
        composition: composition,
        roleComposition: roleComposition,
        effectiveArtDirection: effectiveArtDirection,
        avpeRoleArtDirection: avpeRoleArtDirection,
        cameraDetail: cameraDetail,
        lightingIntensity: lightingIntensity,
        lightingAndColor: lighting,
        consistencyCarryover: consistencyCarryover,
        safeArea: avpe.safeArea || null,
        transitionFromPrevious: i===0 ? '캠페인의 시작 — 이전 장면 없음(첫 장)' : formatTransitionIn(TRANSITION_LINKS[i-1](c)),
        transitionToNext: i===STORYBOARD_ORDER.length-1 ? '캠페인의 마무리 — 다음 장면 없음(마지막 장)' : formatTransitionOut(TRANSITION_LINKS[i](c)),
        claudeDesignPrompt: claudeDesignSalesPagePrompt(beat, subjectAction, productAppearance, composition, effectiveArtDirection, lighting, consistencyCarryover, avpe.safeArea),
        claudeDesignNativePrompt: CCE.claudeDesignSalesPagePromptBuilder(roleKey, category, brandStrategy, effectiveArtDirection, lighting.paletteRole.dominant, (avpe.safeArea && avpe.safeArea.phrase) || '', negativeInstructions, subject.subjectRequired),
        negativeInstructions: negativeInstructions
      };
    });
  };

  /* ══════════════════════════════════════════════════════════════
     11. Campaign Consistency Director — Phase 11.5의 Visual DNA를 그대로 읽어
         캠페인 전체(Thumbnail 5 + Sales Page 9)에 걸친 일관성을 요약한다.
     ══════════════════════════════════════════════════════════════ */
  CCE.campaignConsistencyDirector = function(input, thumbnailBriefs, salesPageStoryboard, primaryMedium){
    var cr = (input.visualPromptSet && input.visualPromptSet.consistencyRules) || {};
    var mockups = thumbnailBriefs.map(function(b){ return b.productMockup.mockupType; });
    var uniqueMockups = Array.from(new Set(mockups));
    var salesPageMediums = Array.from(new Set(salesPageStoryboard.map(function(p){ return p.effectiveArtDirection; })));
    return {
      visualDNA: cr.visualDNA || null,
      recurringSubject: cr.recurringSubject || null,
      recurringPalette: cr.recurringPalette || null,
      recurringLighting: cr.recurringLighting || null,
      recurringProductMockup: cr.recurringProductMockup || null,
      allowedArtDirectionChanges: cr.allowedArtDirectionChanges || [],
      forbiddenChanges: cr.forbiddenChanges || [],
      thumbnailMockupConsistency: uniqueMockups.length<=1 ? '5개 Concept 전부 동일한 상품 목업 사용' : '주의: Concept 간 목업 표현이 달라짐 — '+uniqueMockups.join(', '),
      primaryMedium: primaryMedium,
      salesPageMediumConsistency: salesPageMediums.length===1 ? '9장 전부 primaryMedium("'+primaryMedium+'") 하나로 고정됨' : '주의: Sales Page 9장 Medium이 통일되지 않음 — '+salesPageMediums.join(', ')
    };
  };

  /* ══════════════════════════════════════════════════════════════
     12. Concept Evaluator — 12개 기준, 고정 점수표가 아니라 archetype/category
         profile의 실제 dot-product 기반으로 계산한다.
     ══════════════════════════════════════════════════════════════ */
  var CRITERIA_WEIGHTS = {
    audienceRecognition:     { humanCentered:0.4, emotional:0.3, authoritative:0.1, productCentered:0.1, abstract:0.1 },
    problemRelevance:        { emotional:0.4, humanCentered:0.3, authoritative:0.1, productCentered:0.1, abstract:0.1 },
    productCommunication:    { productCentered:0.6, authoritative:0.2, humanCentered:0.1, emotional:0.05, abstract:0.05 },
    emotionalImpact:         { emotional:0.6, humanCentered:0.3, abstract:0.1 },
    scrollStoppingPower:     { abstract:0.3, emotional:0.3, humanCentered:0.2, productCentered:0.1, authoritative:0.1 },
    visualDistinctiveness:   { abstract:0.5, productCentered:0.2, humanCentered:0.2, authoritative:0.1 },
    brandFit:                { authoritative:0.5, productCentered:0.2, emotional:0.2, humanCentered:0.1 },
    premiumPerception:       { authoritative:0.6, productCentered:0.2, emotional:0.2 },
    mobileClarity:           { productCentered:0.3, humanCentered:0.3, authoritative:0.2, abstract:-0.2 },
    claudeDesignFeasibility: { productCentered:0.3, humanCentered:0.3, authoritative:0.2, abstract:-0.1, emotional:0.1 },
    campaignExpandability:   { authoritative:0.3, productCentered:0.3, humanCentered:0.2, emotional:0.2 }
  };
  var CRITERIA_KEYS = Object.keys(CRITERIA_WEIGHTS);
  /* 후속 수정: revisionHistory의 changesMade 문구는 사람이 읽는 텍스트이므로
     CRITERIA_WEIGHTS의 영문 키를 그대로 노출하지 않고 한글 라벨로 바꾼다. */
  var CRITERIA_KOREAN_LABEL = {
    audienceRecognition:'독자 인지도', problemRelevance:'문제 관련성', productCommunication:'상품 전달력',
    emotionalImpact:'감정적 임팩트', scrollStoppingPower:'스크롤 정지력', visualDistinctiveness:'시각적 차별성',
    brandFit:'브랜드 적합성', premiumPerception:'프리미엄 인상', mobileClarity:'모바일 가독성',
    claudeDesignFeasibility:'Claude Design 구현 가능성', campaignExpandability:'캠페인 확장성'
  };
  function koreanWeak(weak){ return weak.map(function(k){ return CRITERIA_KOREAN_LABEL[k]||k; }).join('/'); }
  var CLAIM_PATTERNS = [/\d+\s*(만원|원|%|퍼센트)/, /후기/, /보장/, /인증/, /수익\s*\d/];
  function truthfulnessScore(concept){
    var text = [concept.bigIdea, concept.sceneStory, concept.visualHook, concept.emotionalHook].join(' ');
    var violated = CLAIM_PATTERNS.some(function(re){ return re.test(text); });
    return violated ? 4 : 10;
  }
  function conceptProfile(archetypeId, category){
    var a = ARCHETYPE_POOL.filter(function(x){ return x.id===archetypeId; })[0];
    var c = creative(category);
    var out = {};
    PROFILE_DIMS.forEach(function(d){ out[d] = ((a?a.profile[d]:5) + c.profile[d]) / 2; });
    return out;
  }

  /* Phase 12.2 §3/§4: 낮은 점수를 그냥 통과시키지 않고, 실제로 약점 기준(criteria)을
     개선하는 재기획 루프를 돈다. 채점 기준(CRITERIA_WEIGHTS)이나 70/60/59 임계치는
     전혀 건드리지 않는다("점수를 억지로 올리지 않는다") — 대신 그 약점 기준에
     실제로 강한 다른 Archetype의 profile로 concept profile을 일부 블렌드하고
     (findRevisionTargetArchetype/blendProfile), 그 블렌드를 sceneStory에도 실제
     문장으로 반영해(장면을 재구성) 점수와 문장이 항상 같이 움직이게 한다. */
  /* 후속 수정(구조적 원인 대응): scrollStoppingPower/mobileClarity/
     productCommunication/claudeDesignFeasibility 4개 기준은 원래 archetype·
     category profile 벡터로만 계산되어 실제로 생성된 문장을 전혀 반영하지
     못했다("점수와 텍스트가 무관"). CRITERIA_WEIGHTS·70/60/59 임계치는 그대로
     두고, 이 4개 기준에 한해 실제 생성된 sceneStory/구도 데이터에서 결정적으로
     확인되는 조건이 "충족될 때만" 정해진 보너스를 더한다(조건 미충족 시 감점은
     하지 않는다 — 근거 없는 감점 금지). "프리미엄/고급/광고 느낌" 같은 추상
     형용사는 신호로 쓰지 않고, 실제 문자열에 구체적 명사(피사체/상품/환경)가
     등장하는지·요소 개수·Safe Area 반영 여부만 확인한다. */
  var CONTENT_SIGNAL_BONUS = 1.0;
  function contentQualitySignals(concept, thumbnailBrief, c){
    var scene = String(concept.sceneStory||'');
    var elementCount = 1 + (scene.match(/이어서/g)||[]).length;
    return {
      clearFocalSubject: !!((c.persona && scene.indexOf(c.persona)>-1) || (c.heroObject && scene.indexOf(c.heroObject)>-1)),
      productVisibleInScene: !!(c.heroObject && scene.indexOf(c.heroObject)>-1),
      mobileElementCountOk: elementCount<=2,
      safeAreaRespected: !!(thumbnailBrief && thumbnailBrief.safeArea && thumbnailBrief.composition && thumbnailBrief.composition.negativeSpace),
      tensionConcrete: !!(concept.visualTension && String(concept.visualTension).length>=8),
      compositionFeasible: !!((c.setting && scene.indexOf(c.setting)>-1) || (c.heroObject && scene.indexOf(c.heroObject)>-1))
    };
  }
  function scoreProfileAgainstCriteria(profile, concept, thumbnailBrief, c){
    var scores = {};
    CRITERIA_KEYS.forEach(function(k){
      var w = CRITERIA_WEIGHTS[k];
      var raw = PROFILE_DIMS.reduce(function(s,d){ return s + (w[d]||0)*profile[d]; }, 0);
      scores[k] = clamp10(raw);
    });
    scores.truthfulness = truthfulnessScore(concept);

    var appliedSignals = [];
    if(c){
      var sig = contentQualitySignals(concept, thumbnailBrief, c);
      if(sig.clearFocalSubject && sig.tensionConcrete){
        scores.scrollStoppingPower = clamp10(scores.scrollStoppingPower + CONTENT_SIGNAL_BONUS);
        appliedSignals.push('scrollStoppingPower: 한눈에 식별되는 중심 피사체 + 구체적 시각적 긴장 확인됨');
      }
      if(sig.mobileElementCountOk && sig.safeAreaRespected){
        scores.mobileClarity = clamp10(scores.mobileClarity + CONTENT_SIGNAL_BONUS);
        appliedSignals.push('mobileClarity: 핵심 요소 1~2개로 제한 + Safe Area 반영 확인됨');
      }
      if(sig.productVisibleInScene){
        scores.productCommunication = clamp10(scores.productCommunication + CONTENT_SIGNAL_BONUS);
        appliedSignals.push('productCommunication: 상품/제공 자료가 장면 문장에 구체적으로 등장');
      }
      if(sig.compositionFeasible){
        scores.claudeDesignFeasibility = clamp10(scores.claudeDesignFeasibility + CONTENT_SIGNAL_BONUS);
        appliedSignals.push('claudeDesignFeasibility: 구체적 피사체/환경이 장면 문장에 실재해 구현 가능');
      }
    }

    var rawScore = CRITERIA_KEYS.concat(['truthfulness']).reduce(function(s,k){ return s+scores[k]; }, 0);
    var maxScore = (CRITERIA_KEYS.length+1)*10;
    var normalizedScore = Math.round(rawScore/maxScore*100);
    var strengths = Object.keys(scores).filter(function(k){ return scores[k]>=7; }).map(function(k){ return k+' 강점('+scores[k]+'/10)'; });
    var risks = Object.keys(scores).filter(function(k){ return scores[k]<=4; }).map(function(k){ return k+' 약점('+scores[k]+'/10)'; });
    var weakestCriteria = CRITERIA_KEYS.slice().sort(function(a,b){ return scores[a]-scores[b]; }).slice(0,3);
    return { scores:scores, rawScore:rawScore, normalizedScore:normalizedScore, tier:scoreTier(normalizedScore), strengths:strengths, risks:risks, weakestCriteria:weakestCriteria, appliedSignals:appliedSignals };
  }
  /* CRITERIA_WEIGHTS 자체를 재사용해, 약점 기준들에 대해 가장 유리한 profile을 가진
     다른 Archetype을 찾는다(고정 매핑표 없이 동일한 평가 공식으로 탐색). */
  /* excludeIds가 ARCHETYPE_POOL 전체(10개)를 다 덮으면 후보가 없다 — null을
     반환해 호출부가 "더 빌려올 archetype이 없다"는 것을 알고 재기획을
     중단하게 한다(무작위로 중복 archetype을 다시 쓰지 않는다). */
  function findRevisionTargetArchetype(currentArchetypeId, weakCriteria, excludeIds){
    var exclude = [currentArchetypeId].concat(excludeIds||[]);
    var candidates = ARCHETYPE_POOL.filter(function(a){ return exclude.indexOf(a.id)===-1; });
    if(!candidates.length) return null;
    var scored = candidates.map(function(a){
      var fit = weakCriteria.reduce(function(sum, crit){
        var w = CRITERIA_WEIGHTS[crit] || {};
        return sum + PROFILE_DIMS.reduce(function(s,d){ return s + (w[d]||0)*a.profile[d]; }, 0);
      }, 0);
      return { archetype:a, fit:fit };
    }).sort(function(x,y){ return y.fit-x.fit; });
    return scored[0].archetype;
  }
  function blendProfile(base, target, ratio){
    var out = {};
    PROFILE_DIMS.forEach(function(d){ out[d] = base[d]*(1-ratio) + target[d]*ratio; });
    return out;
  }
  var REVISION_BLEND_RATIO = 0.3;
  var REVISION_MAX_ATTEMPTS = 2;
  /* Phase 12.4: 재기획 후보는 더 이상 손으로 쓴 6개 약점별 문장 템플릿이
     아니라, Scene Story Generator(Visual Event/Skeleton/Camera/Composition
     조합)가 만든 target archetype의 "완전히 다른 장면"을 그대로 후보로 쓴다.
     findRevisionTargetArchetype이 이미 약점 기준에 강한 archetype을 고르므로
     (weakness-informed), 그 archetype의 라이브러리 조합을 통째로 빌려오는 것이
     "문장 패치"가 아니라 "장면 재설계"에 해당한다(Phase 12.3의 accept/reject
     규율은 그대로 유지). */
  /* Phase 12.1 §6: 점수를 억지로 올리지 않는다 — 채점 방식(archetype/category
     profile dot-product)은 그대로 두고, 등급 판정만 명확한 기준으로 바꾼다.
     70점 이상만 "Claude Design 제작 추천 가능"(ready), 60~69점은 "수정 후
     제작"(revise), 59점 이하는 "추천 금지, 재기획 필요"(reject). 5개 Concept
     전부 70점 미만이면 억지로 하나를 추천하지 않고 recommendedConceptId를
     null로, recommendationStatus를 'needs-revision'으로 남긴다(CCE.run에서
     최종 판단). */
  var TIER_READY_MIN = 70, TIER_REVISE_MIN = 60;
  function scoreTier(normalizedScore){
    if(normalizedScore>=TIER_READY_MIN) return 'ready';
    if(normalizedScore>=TIER_REVISE_MIN) return 'revise';
    return 'reject';
  }
  var TIER_LABEL = { ready:'Claude Design 제작 추천 가능', revise:'수정 후 제작', reject:'추천 금지 — 재기획 필요' };

  /* Phase 12.3 §6: 70점 기준으로 Production을 차단하기 전에, Evaluator 자체가
     "정상적으로 구별하는지"부터 검증한다. CRITERIA_WEIGHTS/70·60·59 임계치는
     건드리지 않고, Gold/Acceptable/Poor 3개 수동 정의 Concept을 실제
     scoreProfileAgainstCriteria에 통과시켜 (1) Gold > Acceptable > Poor 순서가
     나오는지 (2) Gold가 70점 이상인지를 확인한다. 이 결과는 입력에 따라
     달라지지 않는 고정 자가진단이므로 모듈 로드 시 한 번만 계산해 캐시한다. */
  var CALIBRATION_FIXTURES = {
    gold: {
      profile: { humanCentered:8, productCentered:8, abstract:3, emotional:7, authoritative:8 },
      c: { persona:'퇴근 후 한두 시간만 낼 수 있는 직장인', heroObject:'체크리스트와 진행 표시가 담긴 전자책 표지 목업', setting:'퇴근 직후의 조용한 식탁' },
      concept: { bigIdea:'골드 기준 테스트', sceneStory:'퇴근 후 한두 시간만 낼 수 있는 직장인이 체크리스트와 진행 표시가 담긴 전자책 표지 목업을 확인하는 모습 하나로 담은 장면', visualHook:'단일 초점 장면', emotionalHook:'확신', visualTension:'혼란에서 확신으로 바뀌는 표정 변화' },
      thumbnailBrief: { safeArea:'하단 20%', composition:{ negativeSpace:'Safe Area와 겹치는 구역은 비움' } }
    },
    acceptable: {
      profile: { humanCentered:6, productCentered:6, abstract:4, emotional:4, authoritative:5 },
      c: { persona:'직장인', heroObject:'전자책 표지 목업', setting:'사무 공간' },
      concept: { bigIdea:'수용 가능 기준 테스트', sceneStory:'전자책 표지 목업이 놓인 장면', visualHook:'일반적인 구도', emotionalHook:'무난함', visualTension:'약간의 대비' },
      thumbnailBrief: null
    },
    poor: {
      profile: { humanCentered:3, productCentered:3, abstract:7, emotional:3, authoritative:3 },
      c: { persona:'인물', heroObject:'상품', setting:'배경' },
      concept: { bigIdea:'저품질 기준 테스트', sceneStory:'여러 소품과 장식 요소가 뒤섞인 장면', visualHook:'복잡한 구도', emotionalHook:'', visualTension:'' },
      thumbnailBrief: null
    }
  };
  function scoreCalibrationFixture(fx){
    return scoreProfileAgainstCriteria(fx.profile, fx.concept, fx.thumbnailBrief, fx.c).normalizedScore;
  }
  CCE.runEvaluatorCalibrationCheck = function(){
    var goldScore = scoreCalibrationFixture(CALIBRATION_FIXTURES.gold);
    var acceptableScore = scoreCalibrationFixture(CALIBRATION_FIXTURES.acceptable);
    var poorScore = scoreCalibrationFixture(CALIBRATION_FIXTURES.poor);
    var orderCorrect = goldScore>acceptableScore && acceptableScore>poorScore;
    var goldReachesReady = goldScore>=TIER_READY_MIN;
    return {
      ok: orderCorrect && goldReachesReady,
      goldScore: goldScore, acceptableScore: acceptableScore, poorScore: poorScore,
      orderCorrect: orderCorrect, goldReachesReady: goldReachesReady
    };
  };
  var EVALUATOR_CALIBRATION_RESULT = CCE.runEvaluatorCalibrationCheck();

  /* Phase 12.4 §7: Visual Diversity Validator — 같은 캠페인의 5개 Concept가
     Visual Event/Scene Skeleton/Camera/Composition/Scene Story 5개 차원에서
     서로 얼마나 겹치는지 실제로 측정한다. 임의 판단이 아니라 결정적 유사도
     계산: skeleton은 Jaccard 유사도, camera/composition은 정확히 같은 값인지
     (같으면 1, 다르면 0), event/sceneStory는 단어 overlap 비율. 5개 차원 평균이
     0.8(80%) 이상이면 "자동 Reject" 대상으로 표시한다. */
  function jaccardSimilarity(arrA, arrB){
    arrA = arrA||[]; arrB = arrB||[];
    if(!arrA.length && !arrB.length) return 1;
    var setB = {}; arrB.forEach(function(x){ setB[x]=true; });
    var inter = 0; arrA.forEach(function(x){ if(setB[x]) inter++; });
    var unionSet = {}; arrA.concat(arrB).forEach(function(x){ unionSet[x]=true; });
    var unionSize = Object.keys(unionSet).length;
    return unionSize===0 ? 1 : inter/unionSize;
  }
  function wordOverlapSimilarity(a, b){
    var wa = String(a||'').split(/[\s,.·()、]+/).filter(Boolean);
    var wb = String(b||'').split(/[\s,.·()、]+/).filter(Boolean);
    if(!wa.length || !wb.length) return 0;
    var setB = {}; wb.forEach(function(w){ setB[w]=true; });
    var common = wa.filter(function(w){ return setB[w]; }).length;
    return common/Math.max(wa.length, wb.length);
  }
  var DIVERSITY_REJECT_THRESHOLD = 0.8;
  CCE.visualDiversityValidator = function(concepts){
    var pairs = [];
    for(var i=0;i<concepts.length;i++){
      for(var j=i+1;j<concepts.length;j++){
        var a = concepts[i], b = concepts[j];
        var skeletonSim = jaccardSimilarity(a.sceneSkeleton, b.sceneSkeleton);
        var cameraSim = (a.cameraLanguage && b.cameraLanguage && a.cameraLanguage.angle===b.cameraLanguage.angle && a.cameraLanguage.lens===b.cameraLanguage.lens && a.cameraLanguage.style===b.cameraLanguage.style) ? 1 : 0;
        var compositionSim = (a.compositionPattern && b.compositionPattern && a.compositionPattern.pattern===b.compositionPattern.pattern) ? 1 : 0;
        var eventSim = wordOverlapSimilarity(a.visualEvent, b.visualEvent);
        var sceneSim = wordOverlapSimilarity(a.sceneStory, b.sceneStory);
        var similarity = (skeletonSim+cameraSim+compositionSim+eventSim+sceneSim)/5;
        pairs.push({ aId:a.conceptId, bId:b.conceptId, similarity: Math.round(similarity*1000)/1000,
          fields: { skeletonSim:skeletonSim, cameraSim:cameraSim, compositionSim:compositionSim, eventSim:eventSim, sceneSim:sceneSim },
          tooSimilar: similarity>=DIVERSITY_REJECT_THRESHOLD });
      }
    }
    /* 임계치를 넘는 쌍이 있으면 그 쌍 중 더 뒤에 뽑힌(archetype 적합도 순위가
       낮은) concept을 결정적으로 reject 대상으로 삼는다(무작위성 없음). */
    var rejectedConceptIds = [];
    pairs.forEach(function(p){
      if(p.tooSimilar && rejectedConceptIds.indexOf(p.bId)===-1) rejectedConceptIds.push(p.bId);
    });
    return { ok: rejectedConceptIds.length===0, pairs: pairs, rejectedConceptIds: rejectedConceptIds, threshold: DIVERSITY_REJECT_THRESHOLD };
  };

  /* Phase 12.4 §8: Concept Evaluator에 Creative Quality 보완 지표를 추가한다.
     기존 CRITERIA_WEIGHTS/rawScore/normalizedScore/tier(70·60·59 임계치) 계산은
     전혀 건드리지 않고, 별도의 creativeQuality 객체로만 부가한다(요청대로
     "기존 평가식을 무너뜨리지 않고 보완용으로만 사용"). */
  function computeCreativeQuality(concept, diversityResult){
    var pairSims = (diversityResult.pairs||[]).filter(function(p){ return p.aId===concept.conceptId || p.bId===concept.conceptId; }).map(function(p){ return p.similarity; });
    var avgSim = pairSims.length ? pairSims.reduce(function(s,x){return s+x;},0)/pairSims.length : 0;
    var visualDiversity = clamp10((1-avgSim)*10);

    var scene = String(concept.sceneStory||'');
    var hasSubjectOrProduct = !!(concept.sceneSkeleton && concept.sceneSkeleton.length);
    var hasConcreteMoment = /순간|장면|찰나|비교|정리되는|펼쳐진|도달한|풀리는/.test(scene);
    var narrativeClarity = clamp10((hasSubjectOrProduct?5:0)+(hasConcreteMoment?5:0));

    var memorabilityHits = 0;
    if(concept.visualEvent && concept.visualEvent.length>=10) memorabilityHits++;
    if(concept.compositionPattern) memorabilityHits++;
    if(concept.cameraLanguage) memorabilityHits++;
    var sceneMemorability = clamp10(memorabilityHits*(10/3));

    var feasibilityHits = 0;
    if(concept.sceneSkeleton && concept.sceneSkeleton.length<=3) feasibilityHits++;
    if(concept.cameraLanguage) feasibilityHits++;
    if(concept.compositionPattern) feasibilityHits++;
    if(!/여러 시간대|여러 상태/.test(scene)) feasibilityHits++;
    var claudeDesignGenerationConfidence = clamp10(feasibilityHits*2.5);

    var average = Math.round(((visualDiversity+narrativeClarity+sceneMemorability+claudeDesignGenerationConfidence)/4)*10)/10;
    return { visualDiversity:visualDiversity, narrativeClarity:narrativeClarity, sceneMemorability:sceneMemorability, claudeDesignGenerationConfidence:claudeDesignGenerationConfidence, average:average };
  }

  /* Phase 12.2 §3/§4: 최초 평가 → 70점 미만이면 약점 기준 분석 → 그 약점에 강한
     Archetype으로 profile을 실제로 블렌드하고 sceneStory도 그에 맞춰 재작성 →
     재평가, 최대 2회. bigIdeas 배열은 이번 run() 안에서 CCE가 직접 만든 결과물
     (외부 read-only 입력이 아님)이므로 여기서 sceneStory/revisionHistory를
     채워 넣는 것은 "AVPE 등 외부 입력을 mutate 금지" 규칙과 무관하다. */
  CCE.conceptEvaluator = function(bigIdeas, category, thumbnailBriefsById){
    var archetypeIdByName = {};
    ARCHETYPE_POOL.forEach(function(a){ archetypeIdByName[a.name] = a.id; });
    var c = creative(category);

    /* Phase 12.4 후속 수정: 서로 다른 concept이 재기획 중 같은 target
       archetype으로 수렴하면 두 concept의 장면(카메라·구도·스켈레톤·이벤트)이
       완전히 동일해져 Visual Diversity 자체가 깨진다(실제로 발견됨 — sim=1).
       이번 run 전체에서 "이미 어느 concept이 쓰고 있는 archetype"(자기 자신의
       원래 archetype 포함)을 전역으로 추적해 재기획 타겟에서 제외한다. */
    var campaignUsedArchetypeIds = bigIdeas.map(function(concept){ return archetypeIdByName[concept.conceptName]; });

    var evaluated = bigIdeas.map(function(concept){
      var archetypeId = archetypeIdByName[concept.conceptName];
      var thumbnailBrief = thumbnailBriefsById && thumbnailBriefsById[concept.conceptId];
      var profile = conceptProfile(archetypeId, category);
      var result = scoreProfileAgainstCriteria(profile, concept, thumbnailBrief, c);
      var revisionHistory = [];
      var usedTargetIds = [];

      var attempt = 0;
      while(result.tier!=='ready' && attempt<REVISION_MAX_ATTEMPTS){
        attempt++;
        var weak = result.weakestCriteria;
        var target = findRevisionTargetArchetype(archetypeId, weak, usedTargetIds.concat(campaignUsedArchetypeIds));
        if(!target){
          /* 캠페인 전체에서 빌려올 수 있는 archetype이 모두 소진됨 — 중복
             장면을 만들지 않고 정직하게 재기획을 중단한다. */
          revisionHistory.push({ attempt: attempt, weaknesses: weak, targetArchetype: null,
            candidateBefore: concept.sceneStory, candidateAfter: null,
            previousScore: result.normalizedScore, newScore: result.normalizedScore, accepted: false,
            note: '캠페인 내 다른 Concept이 이미 사용 중이지 않은 archetype이 더 없어 재기획을 중단했습니다(장면 중복 방지).' });
          break;
        }
        usedTargetIds.push(target.id);
        var previousScore = result.normalizedScore;
        var targetScene = buildArchetypeScene(target.id, c);
        var candidateBefore = concept.sceneStory;
        var candidateAfter = targetScene.sceneStory;
        var candidateProfile = blendProfile(profile, target.profile, REVISION_BLEND_RATIO);
        /* 채점은 후보(candidate) sceneStory로 임시 concept을 만들어 수행하고,
           newScore <= previousScore면 채택하지 않는다("재기획 후 점수 하락 후보
           채택 금지") — 이전 장면과 profile을 그대로 유지한다. */
        var candidateConcept = { conceptId: concept.conceptId, conceptName: concept.conceptName, bigIdea: concept.bigIdea, sceneStory: candidateAfter, visualHook: concept.visualHook, emotionalHook: concept.emotionalHook, visualTension: concept.visualTension };
        var candidateResult = scoreProfileAgainstCriteria(candidateProfile, candidateConcept, thumbnailBrief, c);
        var accepted = candidateResult.normalizedScore > previousScore;
        if(accepted){
          concept.sceneStory = candidateAfter;
          concept.visualEvent = targetScene.visualEvent;
          concept.sceneSkeleton = targetScene.sceneSkeleton;
          concept.cameraLanguage = targetScene.cameraLanguage;
          concept.compositionPattern = targetScene.compositionPattern;
          concept.archetypeId = target.id;
          profile = candidateProfile;
          result = candidateResult;
          campaignUsedArchetypeIds.push(target.id);
        }
        revisionHistory.push({
          attempt: attempt, weaknesses: weak, targetArchetype: target.name,
          candidateBefore: candidateBefore, candidateAfter: candidateAfter,
          previousScore: previousScore, newScore: candidateResult.normalizedScore, accepted: accepted
        });
      }
      concept.revisionHistory = revisionHistory;

      return {
        conceptId: concept.conceptId,
        rawScore: result.rawScore,
        normalizedScore: result.normalizedScore,
        tier: result.tier,
        tierLabel: TIER_LABEL[result.tier],
        strengths: result.strengths,
        risks: result.risks,
        revisionHistory: revisionHistory,
        appliedSignals: result.appliedSignals,
        reason: concept.conceptName+' 컨셉('+result.normalizedScore+'/100, '+TIER_LABEL[result.tier]+')은 '+concept.sceneStory+(result.risks.length?(' 낮은 항목: '+result.risks.join(', ')):'')
      };
    });

    /* Phase 12.4 §7: 5개 Concept의 최종 sceneStory/skeleton/camera/composition이
       전부 확정된 뒤(재기획 루프 종료 후) Visual Diversity를 검사한다. 80% 이상
       겹치는 쌍이 있으면 그 중 하나를 tier와 무관하게 강제로 'reject' 처리해
       추천/Production Brief 대상에서 제외한다("서로 다른 archetype인데 결국
       비슷한 장면"이 되는 문제를 점수와 별개로 걸러낸다). */
    var diversityResult = CCE.visualDiversityValidator(bigIdeas);
    evaluated.forEach(function(e){
      if(diversityResult.rejectedConceptIds.indexOf(e.conceptId)>=0){
        e.tier = 'reject';
        e.tierLabel = TIER_LABEL.reject+'(Visual Diversity 80% 이상 유사 — 자동 Reject)';
      }
    });

    var readyPool = evaluated.filter(function(e){ return e.tier==='ready'; });
    var top = readyPool.length ? readyPool.slice().sort(function(a,b){ return b.normalizedScore-a.normalizedScore; })[0] : null;

    var conceptById = {};
    bigIdeas.forEach(function(b){ conceptById[b.conceptId] = b; });

    return evaluated.map(function(e){
      return {
        conceptId: e.conceptId,
        rawScore: e.rawScore,
        normalizedScore: e.normalizedScore,
        tier: e.tier,
        tierLabel: e.tierLabel,
        strengths: e.strengths,
        risks: e.risks,
        revisionHistory: e.revisionHistory,
        appliedSignals: e.appliedSignals,
        creativeQuality: computeCreativeQuality(conceptById[e.conceptId], diversityResult),
        reason: e.reason,
        recommended: !!(top && e.conceptId===top.conceptId)
      };
    });
  };

  /* ══════════════════════════════════════════════════════════════
     13. Claude Design Brief Builder — Phase 12.1 §7/§8: 세 개의 압축된 텍스트로
         분리한다(Campaign Master Brief / Selected Thumbnail Production Brief /
         Sales Page 9-Page Production Brief). 내부 점수·rawScore·코드 필드명은
         넣지 않고, 반복되는 Visual DNA/Negative Instructions는 각 Brief마다
         한 번만 적는다. 길이 목표: Master 1,200~2,000자, Thumbnail 800~1,500자,
         Sales Page 9장 3,500~6,000자.
     ══════════════════════════════════════════════════════════════ */
  CCE.claudeDesignBriefBuilder = function(input, productTruth, audienceInsight, positioning, briefConcept, briefEval, recommendationStatus, campaignConsistency, briefThumbnail, salesPageStoryboard, negativeInstructions, allEvaluations, primaryMedium){
    var dna = campaignConsistency.visualDNA || {};

    /* A. Campaign Master Brief — Thumbnail 승인 여부와 무관하게 항상 생성 가능(§9). */
    var mL = [];
    mL.push('=== Campaign Master Brief ===');
    mL.push('상품: '+productTruth.productType+' — '+productTruth.corePromise);
    mL.push('독자: '+audienceInsight.primaryAudience+' · 숨은 좌절: '+audienceInsight.hiddenFrustration+' · 원하는 모습: '+audienceInsight.desiredIdentity);
    mL.push('구매 계기: '+audienceInsight.purchaseTrigger+' · 남은 불안: '+audienceInsight.purchaseAnxiety);
    mL.push('Positioning: '+positioning.positioningStatement);
    mL.push('Single-Minded Message: '+positioning.singleMindedMessage);
    mL.push('Reason to Believe: '+positioning.reasonToBelieve.join(' / '));
    mL.push('차별화 앵글: '+positioning.competitiveVisualAngle);
    mL.push('Primary Medium(캠페인 전체 통일): '+primaryMedium);
    mL.push('Visual DNA — 인물 '+dna.characterIdentity+' / 오브젝트 '+dna.objectLanguage+' / 재질 '+dna.materialLanguage+' / 형태 '+dna.shapeLanguage+' / 카메라 '+dna.cameraLanguage+' / 질감 '+dna.textureLanguage+' / 무드 '+dna.moodContinuity+'.');
    mL.push('Subject Bible: '+campaignConsistency.recurringSubject);
    mL.push('Product Mockup Bible: '+campaignConsistency.recurringProductMockup);
    mL.push('Palette/Lighting Bible: '+campaignConsistency.recurringPalette+' · '+campaignConsistency.recurringLighting);
    mL.push('Typography Overlay: 이미지 안에 어떤 글자도 넣지 않는다. 승인된 한글 텍스트는 Atlas가 나중에 오버레이한다.');
    mL.push('허용되는 변화: '+campaignConsistency.allowedArtDirectionChanges.join(' / '));
    mL.push('금지되는 변화: '+campaignConsistency.forbiddenChanges.join(' / '));
    mL.push('절대 금지: 검증되지 않은 수치·후기·자격·성과를 이미지에 넣지 않는다. 상세 Negative Instructions는 Sales Page Brief 하단 1회 참고.');
    var campaignMasterBrief = mL.join('\n');

    /* B. Selected Thumbnail Production Brief — Phase 12.2 §3/§9: 70점 이상(ready)
       후보가 있을 때만 생성한다. 없으면 null + 별도 BLOCKED 리포트만 만든다
       ("참고용 초안"을 Production Brief로 내보내지 않는다). */
    var selectedThumbnailProductionBrief = null;
    var thumbnailBlockedReport = null;
    if(recommendationStatus==='ready-for-production'){
      var tL = [];
      tL.push('=== Selected Thumbnail Production Brief ===');
      tL.push('Concept: '+briefConcept.conceptName+' · 상태: '+briefEval.tierLabel+'('+briefEval.normalizedScore+'/100)');
      tL.push('규격: 652×488px');
      tL.push('장면: '+briefConcept.sceneStory);
      tL.push('피사체: '+(briefThumbnail.subject.subjectRequired ? briefThumbnail.subject.subjectDescription+', '+briefThumbnail.subject.facialExpression : '인물 없음(product-led)'));
      tL.push('상품: '+briefThumbnail.productMockup.mockupType+', '+briefThumbnail.productMockup.coverTreatment);
      tL.push('구도: '+briefThumbnail.composition.dominantZone+', '+briefThumbnail.composition.eyeFlow);
      tL.push('연출('+briefThumbnail.mediumDirection.medium+'): '+(briefThumbnail.mediumDirection.medium==='photography'?briefThumbnail.mediumDirection.commercialReferenceLanguage:briefThumbnail.mediumDirection.editorialReferenceLanguage));
      tL.push('조명: '+briefThumbnail.lightingAndColor.lightingType+', 지배색 '+briefThumbnail.lightingAndColor.paletteRole.dominant);
      tL.push('Safe Area: '+briefThumbnail.safeArea);
      tL.push('승인된 Overlay 문구: 헤드라인 "'+briefThumbnail.approvedCopy.headline+'" (이미지에는 그리지 않고 Atlas가 오버레이)');
      tL.push('참고: 공통 Negative Instructions는 Sales Page Brief 하단 참고.');
      selectedThumbnailProductionBrief = tL.join('\n');
    } else {
      var bL = [];
      bL.push('=== Thumbnail Production BLOCKED ===');
      bL.push('productionBriefStatus: blocked');
      bL.push('사유: 2회 재기획 후에도 5개 Concept 전부 정규화 점수 70점 미만 — Claude Design Production Brief를 생성하지 않습니다(참고용 초안을 Production Brief로 내보내지 않습니다).');
      bL.push('');
      (allEvaluations||[]).forEach(function(e){
        bL.push('['+e.conceptId+'] '+e.tierLabel+'('+e.normalizedScore+'/100)');
        if(e.revisionHistory && e.revisionHistory.length){
          e.revisionHistory.forEach(function(rh){
            bL.push('  재기획 '+rh.attempt+'회차 — 약점: '+koreanWeak(rh.weaknesses)+' / 타겟: "'+rh.targetArchetype+'" / 점수: '+rh.previousScore+' → '+rh.newScore+' / 채택: '+(rh.accepted?'예(장면 교체됨)':'아니오(점수 하락 또는 무변화라 기존 장면 유지)'));
            bL.push('    새 장면 후보: '+rh.candidateAfter);
          });
        } else {
          bL.push('  재기획 이력 없음(이미 70점 이상이었거나 재기획 대상 아님)');
        }
      });
      bL.push('');
      bL.push('다음 단계: Big Idea 또는 장면을 다시 기획해 재실행하거나, Campaign Master Brief만으로 별도 컨셉 회의를 진행하세요.');
      thumbnailBlockedReport = bL.join('\n');
    }

    /* C. Sales Page 9-Page Production Brief — Visual DNA/Medium은 상단에서 1회만 언급 */
    var sL = [];
    sL.push('=== Sales Page 9-Page Production Brief ===');
    sL.push('전체 9장 공통 Visual DNA(장마다 반복 표기하지 않음): 주인공 '+campaignConsistency.recurringSubject+' / 팔레트 '+campaignConsistency.recurringPalette+' / 조명 '+campaignConsistency.recurringLighting+' / 목업 '+campaignConsistency.recurringProductMockup+'.');
    sL.push('전체 9장 Primary Medium(고정, 장마다 바꾸지 않음): '+primaryMedium+'. 장마다 카메라 거리/구도/정보 밀도/피사체 비중/조명 강도만 변경합니다.');
    salesPageStoryboard.forEach(function(p){
      sL.push('');
      sL.push(p.pageNumber+'. '+p.role+' — '+p.narrativeBeat);
      sL.push('목표: '+p.communicationGoal);
      sL.push('장면: '+p.visualScene);
      sL.push('상품: '+p.productAppearance);
      sL.push('구도: '+p.roleComposition+' · 거리: '+p.cameraDetail.distance+' · 정보 밀도: '+p.cameraDetail.infoDensity+' · 피사체 비중: '+p.cameraDetail.subjectEmphasis);
      sL.push('조명 강도: '+p.lightingIntensity+' · Safe Area: '+(p.safeArea?(p.safeArea.anchor+' '+p.safeArea.proportion):''));
      sL.push(p.transitionFromPrevious);
      sL.push(p.transitionToNext);
    });
    sL.push('');
    sL.push('공통 Negative Instructions(전체 9장 + Thumbnail 공통, 1회만 표기): '+negativeInstructions);
    var salesPage9PageBrief = sL.join('\n');

    return { campaignMasterBrief: campaignMasterBrief, selectedThumbnailProductionBrief: selectedThumbnailProductionBrief, thumbnailBlockedReport: thumbnailBlockedReport, salesPage9PageBrief: salesPage9PageBrief };
  };

  /* ══════════════════════════════════════════════════════════════
     14. Reason Generator + Orchestrator
     ══════════════════════════════════════════════════════════════ */
  function reasonGenerator(category, bigIdeas, evaluations, positioning, campaignConsistency, recommendationStatus, primaryMedium){
    var recommended = evaluations.filter(function(e){ return e.recommended; })[0];
    var reasons = [];
    reasons.push('카테고리("'+category+'")의 5속성 profile과 Big Idea Archetype 10종의 profile을 dot-product로 점수화해, 이 카테고리에 가장 적합한 5종("'+bigIdeas.map(function(b){return b.conceptName;}).join(', ')+'")을 선택했습니다 — 모든 주제에 같은 5개를 이름만 바꿔 쓰지 않습니다.');
    reasons.push('Positioning의 Single-Minded Message는 "'+positioning.singleMindedMessage+'" 하나로 고정했습니다.');
    var revisedCount = bigIdeas.filter(function(b){ return b.revisionHistory && b.revisionHistory.length>0; }).length;
    if(revisedCount>0){
      reasons.push(revisedCount+'개 Concept이 최초 평가에서 70점 미만이라 약점 기준에 강한 Archetype으로 profile을 일부 블렌드하고 장면을 보강하는 재기획을 거쳤습니다(최대 2회, 점수 임계치 자체는 바꾸지 않았습니다).');
    }
    if(recommended){
      reasons.push('Concept Evaluator가 12개 기준(오디언스 인식/문제 관련성/상품 전달력/감정 임팩트/스크롤 정지력/시각적 차별성/브랜드 적합성/프리미엄 인상/모바일 명료성/Claude Design 구현 가능성/캠페인 확장성/진실성)을 실제 Concept 속성 기반으로 계산해 "'+recommended.conceptId+'"를 추천했습니다(정규화 점수 '+recommended.normalizedScore+'/100, 70점 이상만 추천).');
    } else {
      reasons.push('재기획 2회 후에도 5개 Concept 전부 정규화 점수 70점 미만이라(수정 후 제작 또는 재기획 필요 등급) 억지로 하나를 추천하지 않았습니다 — recommendedConceptId는 null, recommendationStatus는 "'+recommendationStatus+'"이고 Thumbnail Production Brief는 생성하지 않았습니다(blocked).');
    }
    reasons.push('Sales Page 9장은 Primary Medium("'+primaryMedium+'")을 캠페인 전체에서 통일했습니다 — AVPE Role별 원래 값(avpeRoleArtDirection)은 참고용으로 남기되, 실제 Claude Design Brief에는 photography/illustration/3D/collage가 무분별하게 섞이지 않도록 하나의 Medium 안에서 카메라 앵글/거리/구도/정보 밀도/피사체 비중/조명 강도만 장마다 다르게 지시했습니다.');
    reasons.push('Thumbnail 5개의 Safe Area/consistencyCarryover와 Sales Page 9개의 Safe Area/consistencyCarryover는 Phase 11.5 AI Visual Prompt Engine의 계산 결과를 읽기 전용으로 그대로 재사용했고, 이 Engine에서 다시 계산하지 않았습니다.');
    reasons.push('Product Truth Extractor는 실제 승인된 Marketing Copy(hook/benefits/faqs)만 사용했고, 검증되지 않은 매출/후기/자격은 생성하지 않았습니다(prohibitedClaims에 명시).');
    return reasons;
  }

  CCE.run = function(rawInput){
    var input = CCE.inputNormalizer(rawInput);
    var category = (input.visualPromptSet && input.visualPromptSet.visualStrategy && input.visualPromptSet.visualStrategy.category) || 'neutral';
    var negativeInstructions = (input.visualPromptSet && input.visualPromptSet.thumbnailPrompts && input.visualPromptSet.thumbnailPrompts[0] && input.visualPromptSet.thumbnailPrompts[0].negativePrompt) || '';
    var thumbnailSafeArea = (input.visualPromptSet && input.visualPromptSet.thumbnailPrompts && input.visualPromptSet.thumbnailPrompts[0]) ?
      (input.visualPromptSet.thumbnailPrompts[0].prompt.match(/Leave clear negative space[^.]*\./)||[''])[0] : '';
    /* Phase 12.2 §6: Campaign 전체가 공유할 primaryMedium 하나를 확정한다.
       AVPE(Phase 11.5)가 이미 계산해 둔 대표 스타일(strategy.artDirection,
       Variant/Role 호환도 분기 이전의 대표값)을 그대로 재사용한다 — 재계산 없음. */
    var primaryMedium = (input.visualPromptSet && input.visualPromptSet.visualStrategy && input.visualPromptSet.visualStrategy.artDirection) || 'modern flat illustration';

    var productTruth = CCE.productTruthExtractor(input);
    var audienceInsight = CCE.audienceInsightDirector(input, category);
    var positioning = CCE.campaignPositioningDirector(input, category, productTruth, audienceInsight);
    var bigIdeas = CCE.bigIdeaGenerator(category, productTruth, audienceInsight);
    var thumbnailBriefs = CCE.thumbnailConceptDirector(input, category, bigIdeas, negativeInstructions, thumbnailSafeArea);
    var salesPageStoryboard = CCE.salesPageStoryboardDirector(input, category, negativeInstructions, primaryMedium);
    var campaignConsistency = CCE.campaignConsistencyDirector(input, thumbnailBriefs, salesPageStoryboard, primaryMedium);
    var thumbnailBriefsById = {};
    thumbnailBriefs.forEach(function(b){ thumbnailBriefsById[b.conceptId] = b; });
    var evaluations = CCE.conceptEvaluator(bigIdeas, category, thumbnailBriefsById);
    /* bigIdeas는 conceptEvaluator 내부에서 재기획 루프를 통해 이미 최종
       sceneStory/sceneSkeleton/cameraLanguage/compositionPattern으로 수렴한
       상태다 — 이 최종 상태 기준으로 다시 계산해도 순수 함수라 결과가 같다
       (Reasoning Service 호출과 무관, 결정론적 재현성에 영향 없음). */
    var campaignVisualDiversity = CCE.visualDiversityValidator(bigIdeas);

    var evalById = {};
    evaluations.forEach(function(e){ evalById[e.conceptId] = e; });
    bigIdeas.forEach(function(b){ var e = evalById[b.conceptId]; if(e){ b.recommended = e.recommended; b.tier = e.tier; } });
    thumbnailBriefs.forEach(function(b){ b.evaluation = evalById[b.conceptId] || null; });

    /* Phase 12.2 §3/§9: 재기획 루프(conceptEvaluator 내부)를 거친 뒤에도 70점
       이상(tier==='ready')이 하나도 없으면 productionBriefStatus를 'blocked'로
       표시하고 selectedThumbnailProductionBrief는 null로 남긴다 — "참고용 초안"을
       Production Brief로 내보내지 않는다. */
    var recommendedEval = evaluations.filter(function(e){ return e.recommended; })[0] || null;
    var recommendedConceptId = recommendedEval ? recommendedEval.conceptId : null;
    var recommendationStatus = recommendedEval ? 'ready-for-production' : 'needs-revision';
    var productionBriefStatus = recommendedEval ? 'generated' : 'blocked';
    var provisionalEval = evaluations.slice().sort(function(a,b){ return b.normalizedScore-a.normalizedScore; })[0];
    var provisionalConceptId = provisionalEval ? provisionalEval.conceptId : (bigIdeas[0] && bigIdeas[0].conceptId);
    var briefConceptId = recommendedConceptId || provisionalConceptId;
    var briefConcept = bigIdeas.filter(function(b){ return b.conceptId===briefConceptId; })[0] || bigIdeas[0];
    var briefEval = evalById[briefConceptId] || provisionalEval;
    var briefThumbnail = thumbnailBriefs.filter(function(b){ return b.conceptId===briefConceptId; })[0] || thumbnailBriefs[0];

    var briefs = CCE.claudeDesignBriefBuilder(input, productTruth, audienceInsight, positioning, briefConcept, briefEval, recommendationStatus, campaignConsistency, briefThumbnail, salesPageStoryboard, negativeInstructions, evaluations, primaryMedium);
    var reasons = reasonGenerator(category, bigIdeas, evaluations, positioning, campaignConsistency, recommendationStatus, primaryMedium);
    var timestamp = Date.now();

    /* Phase 12.3 §3: 문법 검사를 전체 텍스트를 이어붙인 한 덩어리가 아니라
       실제로 요구된 모든 필드를 fieldPath와 함께 개별 스캔한다 — bigIdea/
       sceneStory/revisionHistory 후보 문장/thumbnailBlockedReport/Sales Page
       9장 전체(visualScene/subjectAction/productAppearance/전환 문구)/Campaign
       Master Brief/Production Brief. watchPhrases로 카테고리 실제 소재 어휘가
       한 필드 안에서 불필요하게 반복되는지도 함께 검사한다. */
    var c = creative(category);
    var watchPhrases = [c.heroObject, c.symbolicObject, c.setting, c.persona, c.currentState, c.transformedState].filter(Boolean);
    var reviewFields = [
      { path:'positioning.positioningStatement', text: positioning.positioningStatement },
      { path:'positioning.singleMindedMessage', text: positioning.singleMindedMessage }
    ];
    bigIdeas.forEach(function(b, i){
      reviewFields.push({ path:'bigIdeas['+i+'].bigIdea', text: b.bigIdea, watchPhrases: watchPhrases });
      reviewFields.push({ path:'bigIdeas['+i+'].sceneStory', text: b.sceneStory, watchPhrases: watchPhrases });
      (b.revisionHistory||[]).forEach(function(rh, j){
        reviewFields.push({ path:'bigIdeas['+i+'].revisionHistory['+j+'].candidateAfter', text: rh.candidateAfter, watchPhrases: watchPhrases });
      });
    });
    salesPageStoryboard.forEach(function(p, i){
      reviewFields.push({ path:'salesPageStoryboard['+i+'].visualScene', text: p.visualScene, watchPhrases: watchPhrases });
      reviewFields.push({ path:'salesPageStoryboard['+i+'].subjectAction', text: p.subjectAction, watchPhrases: watchPhrases });
      reviewFields.push({ path:'salesPageStoryboard['+i+'].productAppearance', text: p.productAppearance, watchPhrases: watchPhrases });
      reviewFields.push({ path:'salesPageStoryboard['+i+'].transitionFromPrevious', text: p.transitionFromPrevious });
      reviewFields.push({ path:'salesPageStoryboard['+i+'].transitionToNext', text: p.transitionToNext });
    });
    reviewFields.push({ path:'campaignMasterBrief', text: briefs.campaignMasterBrief });
    reviewFields.push({ path:'salesPage9PageBrief', text: briefs.salesPage9PageBrief });
    if(briefs.selectedThumbnailProductionBrief) reviewFields.push({ path:'selectedThumbnailProductionBrief', text: briefs.selectedThumbnailProductionBrief });
    if(briefs.thumbnailBlockedReport) reviewFields.push({ path:'thumbnailBlockedReport', text: briefs.thumbnailBlockedReport });
    var languageQualityReport = CCE.languageQualityCheck(reviewFields);

    /* Phase 12.3 §6/§9: 70점 기준 이전에 Evaluator 자체가 calibrated인지 먼저
       확인한다. calibrated가 아니면 점수와 무관하게 blocked-by-evaluator.
       calibrated이고 점수가 나와도 문법 검사(languageQualityReport)를 통과하지
       못하면 blocked-by-content — "참고용 초안"을 ready로 내보내지 않는다. */
    var evaluatorStatus = EVALUATOR_CALIBRATION_RESULT.ok ? 'calibrated' : 'uncalibrated';
    var finalProductionBriefStatus;
    if(evaluatorStatus!=='calibrated'){
      finalProductionBriefStatus = 'blocked-by-evaluator';
    } else if(recommendedEval && languageQualityReport.ok){
      finalProductionBriefStatus = 'ready';
    } else {
      finalProductionBriefStatus = 'blocked-by-content';
    }
    var finalSelectedThumbnailProductionBrief = finalProductionBriefStatus==='ready' ? briefs.selectedThumbnailProductionBrief : null;
    var finalThumbnailBlockedReport = briefs.thumbnailBlockedReport;
    if(finalProductionBriefStatus!=='ready' && !finalThumbnailBlockedReport){
      var reasonLines = [];
      if(evaluatorStatus!=='calibrated') reasonLines.push('사유: Evaluator calibration 자가진단이 통과하지 못했습니다(evaluatorStatus: uncalibrated) — Gold>Acceptable>Poor 순서 또는 Gold의 70점 도달을 만족하지 못했습니다.');
      else reasonLines.push('사유: 점수는 70점 이상이었으나 languageQualityReport 문법 검사를 통과하지 못했습니다 — 위반 '+languageQualityReport.violations.length+'건. "참고용 초안"을 Production Brief로 내보내지 않습니다.');
      finalThumbnailBlockedReport = ['=== Thumbnail Production BLOCKED ===', 'productionBriefStatus: '+finalProductionBriefStatus].concat(reasonLines).join('\n');
    }

    var output = {
      version: '1.0',
      productTruth: productTruth,
      audienceInsight: audienceInsight,
      positioning: positioning,
      bigIdeas: bigIdeas,
      recommendedConceptId: recommendedConceptId,
      recommendationStatus: recommendationStatus,
      evaluatorStatus: evaluatorStatus,
      evaluatorCalibration: EVALUATOR_CALIBRATION_RESULT,
      productionBriefStatus: finalProductionBriefStatus,
      campaignVisualDiversity: campaignVisualDiversity,
      primaryMedium: primaryMedium,
      thumbnailBriefs: thumbnailBriefs,
      salesPageStoryboard: salesPageStoryboard,
      campaignConsistency: campaignConsistency,
      campaignMasterBrief: briefs.campaignMasterBrief,
      selectedThumbnailProductionBrief: finalSelectedThumbnailProductionBrief,
      thumbnailBlockedReport: finalProductionBriefStatus==='ready' ? null : finalThumbnailBlockedReport,
      salesPage9PageBrief: briefs.salesPage9PageBrief,
      claudeDesignProductionBrief: (finalSelectedThumbnailProductionBrief||finalThumbnailBlockedReport)+'\n\n'+briefs.salesPage9PageBrief,
      languageQualityReport: languageQualityReport,
      metadata: { category: category, generatedAt: timestamp }
    };

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source: 'CreativeCampaignEngine',
        category: category,
        recommendedConceptId: recommendedConceptId,
        recommendationStatus: recommendationStatus,
        evaluatorStatus: evaluatorStatus,
        productionBriefStatus: finalProductionBriefStatus,
        primaryMedium: primaryMedium,
        bigIdeaCount: bigIdeas.length,
        reasons: reasons,
        timestamp: timestamp
      });
    }

    return output;
  };

})(window.AtlasCreativeCampaignEngine);
