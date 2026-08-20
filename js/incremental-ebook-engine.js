/* js/incremental-ebook-engine.js — 전자책을 한 번의 거대한 Anthropic 호출로 만들지
   않고, 목차 → 챕터별 생성(7개, 순차) → 부록 생성 → 최종 병합 순서로 나눠서
   만든다. 각 단계는 별도의 작은 Anthropic 호출이므로 초장시간 단일 연결에서
   발생하던 timeout/network_error 위험이 사라지고, 챕터 단위로 진행률을 실시간
   표시하거나 중지/재개할 수 있다.

   Prompt 품질은 기존 startGenerate()의 [분량과 구성]/[사실성과 안전]/[크몽 판매 카피]
   지시문을 그대로(문구 변경 없이) 각 호출에 나눠 재사용한다 — 생성 "방식"만
   incremental로 바뀌고, 실제로 AI에게 요구하는 내용/기준은 동일하다.

   Creative Campaign Engine은 이 엔진의 중간 산출물(outline/개별 챕터)을 전혀
   참조하지 않는다 — AI Planner 단계(AIP.approve())에서 이미 확정되어 있고,
   최종 병합된 APP.ebook만 이후 판매디자인 단계에서 사용된다. */

window.AtlasIncrementalEbookEngine = window.AtlasIncrementalEbookEngine || {};

(function(E){
  E.TOTAL_CHAPTERS = 7;
  E.CHAPTER_TYPES = ['문제 해부형','사례 분석형','단계별 실행형','개념 전환형','도구·자원형','심화 전략형','종합 실행형'];

  /* Atlas V3 Phase 1 — Ebook Generation Quality: 프롬프트에 실제로 어떤 버전의
     규칙이 쓰였는지 로그로 추적할 수 있게 하는 최소한의 버전 식별자다. 새 문서
     체계나 UI를 만들지 않는다 — callGateway()의 기존 콘솔 로그 한 줄에 실어
     보내는 것으로 충분하다(요구된 "유지보수에 실제로 도움되는 최소 구현"). */
  E.PROMPT_VERSION = 'ebook-gen-v3.1';

  var FACTUALITY_RULES = `[사실성과 안전]
- 사용자가 제공하지 않은 저자의 실제 경험, 판매 실적, 구매후기, 통계는 창작하지 않습니다.
- 특정 인물의 사례가 필요하면 가상 사례임을 본문 안에서 명시합니다.
- 최신 정보가 필요한 도구·정책은 확실하지 않으면 확인 필요라고 씁니다.
- 법률, 의료, 세무, 금융처럼 시점에 따라 달라지는 전문 판단이 필요한 내용은 확정된 사실처럼 단정하지 말고, 일반 원칙 중심으로 서술하며 필요 시 전문가 확인을 권합니다.
- 예시나 가상 시나리오는 반드시 "예를 들어", "가상의 경우" 등으로 실제 사례·데이터와 구분되게 표현합니다.`;

  var SALES_COPY_RULES = `[크몽 판매 카피]
- 구체적인 수익 금액, 매출 금액, 성장률, 달성 기간을 후킹과 상세페이지 문구에 사용하지 않습니다.
- 보장·무조건·100%·누구나 성공·자동수익 등의 표현을 사용하지 않습니다.
- testimonials는 반드시 빈 배열입니다.
- 가격·정가·할인액 필드는 생성하지 않습니다.
- hook은 핵심 불편을 찌르는 짧은 문장으로 작성합니다.
- pains, solution, learnings, benefits, before, after는 각각 구체적인 문장 배열로 작성합니다.`;

  /* Atlas V3 Phase 1 — 신규: 그동안 어떤 프롬프트에도 명시적으로 없던 "AI가 쓴
     티가 나는 문체"를 막는 규칙. 기존 ATLAS_SYSTEM_PROMPT의 [문체] 절이 큰
     방향("과장보다 명확성")만 다뤘다면, 이 규칙은 실제로 반복 관찰되는 구체적인
     패턴(상투어/공허한 도입-결론/수사 의문문 남발)을 짚어 outline·챕터·부록
     생성 전체에 공유한다 — 한 곳에서만 고치면 모든 단계에 반영된다. */
  /* 2026-08-18: 사용자 지시 — "돈 내고 아깝지 않은" 전자책이 되려면 문체가
     자연스러운 것과 별개로, 초보자가 실제로 따라 할 수 있는 실행 밀도가
     있어야 한다. 기존 규칙(FACTUALITY_RULES/WRITING_STYLE_RULES)은 사실성과
     AI 티 제거는 다루지만, "설명이 충분히 쉬운가"·"행동지침이 실제로 실행
     가능한가"는 다루지 않았다 — actionItems/actionBox가 "노력하세요" 같은
     추상적 문구로 채워져도 걸러내는 규칙이 없었다. 이 공유 규칙을 outline·
     챕터·부록·부분 재생성 모두에 동일하게 적용한다(기존 규칙 블록과 같은
     패턴 — 문구 내용만 새로 추가, 스키마/함수 시그니처는 변경 없음). */
  var PRACTICALITY_RULES = `[초보자 실행 가능성 — "따라만 하면 되는" 밀도]
- 이 책의 독자는 이 주제에 대해 사전 지식이 없을 수 있다고 가정합니다. 전문 용어나 줄임말을 처음 쓸 때는 반드시 한 문장으로 무슨 뜻인지 풀어서 설명한 뒤 사용합니다.
- "노력하세요", "꾸준히 하세요", "찾아보세요", "적절히 활용하세요" 같은 추상적인 지시로 문단을 끝내지 않습니다 — 무엇을, 어떤 순서로, 어떻게 하는지 구체적인 절차로 풀어씁니다.
- actionItems, actionBox, 부록 체크리스트는 독자가 책을 덮고 바로 따라 할 수 있을 만큼 구체적이어야 합니다. "적절한 도구를 찾으세요"가 아니라 어떤 종류의 도구를, 어떤 기준으로 고르고, 무엇부터 확인해야 하는지까지 씁니다.
- 도구·서비스·자료를 언급할 때는 실제로 존재가 확인된 것만 구체적인 이름으로 씁니다. 확신이 없으면 "~계열의 도구", "~유형의 서비스"처럼 카테고리로 안내하고, 없는 서비스명이나 존재를 확인할 수 없는 상품명을 지어내지 않습니다(FACTUALITY_RULES와 동일한 Never-Guess 원칙).
- 실행 단계를 안내할 때는 "무엇을 하는지"뿐 아니라 "왜 이 순서로 해야 하는지"도 함께 설명합니다 — 방법만 나열하고 이유를 생략하지 않습니다.
- 같은 개념을 설명 없이 반복해서 언급하지 않습니다. 처음 등장할 때 확실히 설명하고, 이후에는 그 설명을 전제로 자연스럽게 사용합니다.
- 이 책을 산 사람이 "돈 낸 만큼 실제로 뭔가를 할 수 있게 됐다"고 느낄 수 있는 밀도로 씁니다 — 같은 내용을 다른 표현으로 반복해 분량만 채우지 않습니다. 분량을 채워야 한다면 새로운 각도의 설명·예시·주의사항을 추가하지, 이미 한 말을 되풀이하지 않습니다.`;

  var WRITING_STYLE_RULES = `[문체 — AI 생성 티 제거]
- "단순히", "결국", "중요합니다", "사실", "이제", "바로 지금" 같은 상투적 필러 표현을 남발하지 않습니다.
- 모든 챕터를 똑같은 도입("~에 대해 알아보겠습니다")이나 결론("~하시기 바랍니다")으로 시작·마무리하지 않습니다. 챕터마다 다른 방식으로 시작하고 끝맺습니다.
- 수사 의문문("~일까요?")을 문단마다 반복하지 않습니다. 필요한 곳에서만 절제해서 씁니다.
- 근거 없는 공허한 동기부여 문구("당신도 할 수 있습니다", "포기하지 마세요")를 채우기용으로 쓰지 않습니다.
- 같은 문장 구조·리듬을 문단마다 반복하지 않습니다(예: 매 문단을 "먼저 ~합니다. 그다음 ~합니다."로 시작).
- 내용이 없는데 소제목만 늘리지 않습니다.
- 어색한 번역체 대신 실제 한국어 화자가 쓰는 자연스러운 문장으로 씁니다.
- 책 전체에서 같은 개념·용어는 항상 같은 이름으로 부릅니다(예: 한 챕터에서 "체크리스트"라 부른 것을 다른 챕터에서 "점검표"로 바꿔 부르지 않습니다).`;

  /* Atlas V3 Phase 1 — 신규: 원천 자료(파일/URL/복수자료)가 있을 때 그것을
     "주된 사실 근거"로 취급하고, 주제만 입력됐을 때는 불확실한 사실 주장을
     피하라는 규칙. 이전에는 이런 지시가 [분량과 구성] 절 안에 섞여 있거나
     multi 모드의 ebookModeWrapperPrefix()에만(그것도 outline 호출 한 번에만)
     존재했다 — 챕터·부록 생성 시점에는 전혀 전달되지 않았다. 공유 규칙으로
     승격해 outline/챕터/부록 모두에 동일하게 적용한다. */
  var SOURCE_GROUNDING_RULES = `[원천 자료 근거]
- 사용자가 파일·URL·복수자료를 제공했다면 그 내용을 가장 우선하는 사실 근거로 삼고, 명확한 근거 없이 그 내용과 반대되는 주장을 쓰지 않습니다.
- 원천 자료에 없는 정보를 새로 지어내 채우지 않습니다 — 빈틈은 일반적인 원칙이나 "확인이 필요합니다" 같은 표현으로 채웁니다.
- 원천 자료에서 나온 정보(고유명사, 수치, 용어, 제약조건)와 일반적인 배경지식·예시를 독자가 구분할 수 있게 씁니다.
- 주제만 입력되고 원천 자료가 없는 경우, 최신성·법률·의료·금융·통계처럼 검증이 필요한 주장은 확정된 사실처럼 쓰지 말고 신중한 표현을 사용합니다.`;

  /* 해외 PLR/외국 교육 자료 현지화. ebookModeWrapperPrefix()(js/application.js)
     에는 이미 "직역하지 말라"는 지시가 있었지만, 그 지시는 outline 호출 한 번
     에만 전달됐고(챕터·부록 생성 시점에는 원본 자료가 재첨부돼도 이 지시문
     자체는 함께 오지 않았다), 내용도 "직역 금지"에 그쳐 기관·법률·통화·사례
     같은 구체적인 항목을 무엇으로 바꿔야 하는지는 전혀 지시하지 않았다. 이
     규칙을 공유 규칙으로 승격해 outline·챕터·부록·부분 재생성 모두에
     동일하게 적용한다. 이미지 판별 로직을 새로 만들지 않는다 — 원천 자료가
     영어 PLR/외국 자료인지는 실제 자료를 읽는 모델 스스로 판단하게 한다
     (코드로 언어 감지를 억지로 만드는 것보다 신뢰할 수 있고, 새 AI 호출도
     필요 없다). Never-Guess 항목은 이 지시로 새로 생기는 위험(기관·법률·수치를
     "한국 것으로 바꾸다가" 틀린 사실을 지어낼 위험)을 막기 위해 있다 — 기존
     FACTUALITY_RULES/SOURCE_GROUNDING_RULES의 Never-Guess 원칙과 일치시킨다.

     Atlas V3 — Korean Market Adaptation Enhancement: 위 최초 버전은 "사실
     항목 치환"(기관명·법률·통화·날짜)에 집중돼 있었다. 이번 확장은 같은 블록
     "안에" 새 절을 추가해, 사실이 아니라 "느낌"의 문제(구매 행동·학습 방식·
     크리에이터 워크플로·플랫폼 관례처럼 사실 치환만으로는 안 잡히는 것)까지
     다루게 한다 — 별도 블록을 새로 만들지 않고 기존 KOREAN_LOCALIZATION_RULES
     하나만 수정한다(요구사항: "두 번째 로컬라이제이션 시스템을 만들지 않는다").
     "무조건 다 바꾸지 마라"/"국제적으로 중요한 서비스는 유지" 절은 기존 규칙에
     없던 새 판단 기준이라 신규 추가했고, "프레임워크/방법론은 절대 바꾸지
     않는다"는 기존 "핵심 아이디어와 논리 구조는 보존" 문장을 프레임워크 스키마
     필드(챕터의 framework 필드)까지 명시적으로 포함하도록 구체화했다. 재작성된
     예시의 사실성 항목은 기존 FACTUALITY_RULES("가상 사례임을 본문 안에서
     명시")를 로컬라이징 맥락에서 다시 한번 짚어 이 블록만 읽어도 빠짐없이
     지키게 한 것이지, 새 규칙을 만든 게 아니다 — 두 규칙은 서로 다른 표현으로
     같은 원칙을 말하고 있어 하나로 합치는 리팩토링은 하지 않았다(리스크 대비
     실익이 낮다: FACTUALITY_RULES는 모든 생성에 적용되는 일반 규칙이고, 여기는
     "로컬라이징한 예시"라는 좁은 맥락에 특화된 재강조라 문맥이 다르다).

     추가 반영: 마켓플레이스 예시 절을 "발행 채널 인지"로 한 단계 더 구체화했다
     — Atlas가 만드는 전자책의 실제 목적지(한국 디지털 상품 마켓플레이스)를
     명시해 예시·워크플로 선택의 기준을 분명히 하되, 바로 다음 줄에 "특정
     플랫폼의 정책·수수료·정산주기 같은 사실은 지어내지 않는다"는 방지 문구를
     붙였다 — 발행 채널을 구체적으로 언급하면 모델이 그 채널의 세부 정책까지
     안다고 착각해 지어낼 위험이 함께 커지므로, 이 위험을 상쇄하는 문장을
     반드시 같은 자리에 짝지어 둔다(Never-Guess는 이 파일 전체에서 일관되게
     "무엇을 하라"와 "무엇을 지어내지 말라"를 항상 같은 항목 안에 짝지어 두는
     방식으로 지켜지고 있다 — 예: SOURCE_GROUNDING_RULES, 위 Never-Guess
     항목들도 같은 패턴). */
  var KOREAN_LOCALIZATION_RULES = `[해외 자료 현지화 및 한국 시장 적응]
업로드되었거나 참고한 원천 자료가 영어 PLR이거나 한국이 아닌 국가의 교육 자료로 보인다면:

사실 치환:
- 문장을 그대로 직역하지 않습니다. 한국 독자를 위해 다시 씁니다.
- 외국 기관·서비스 명칭은 적절할 때 그에 대응하는 한국의 기관·서비스로 바꿉니다.
- 법률, 세금, 금융, 의료, 교육 제도와 관련된 예시는 한국의 실제 제도를 기준으로 바꿉니다.
- 예시, 비유, 사례는 한국 상황에 맞게 바꿉니다.
- 통화, 단위, 날짜 표기는 한국의 표기 관행(원, 미터법, 연-월-일 등)으로 바꿉니다.

시장 감각 적응(사실 치환만으로는 부족한 부분 — 해당하는 경우에만):
- 구매 행동: 해외 결제·구독 관행 대신 한국 소비자의 실제 구매·결제 방식(예: 간편결제, 정기구독보다 1회성 구매 선호 경향 등)에 맞게 서술합니다.
- 학습 방식: 한국 독자의 학습 관습(단계별 실행 가이드, 체크리스트 선호 등)에 맞게 설명 방식을 조정합니다.
- 크리에이터 워크플로: 해외 창작자 도구·관행이 아니라 한국 디지털 상품 판매자가 실제로 거치는 절차를 기준으로 씁니다.
- 마켓플레이스·크리에이터 플랫폼·전자책/디지털 상품 생태계: 이 책이 실제로 향하는 발행 채널을 염두에 둡니다 — Atlas로 만드는 전자책은 한국 디지털 상품 마켓플레이스(예: 크몽 등 재능·지식 판매 플랫폼)에 판매될 목적으로 만들어지므로, 예시·워크플로는 한국 크리에이터가 실제로 디지털 상품을 기획·제작·마케팅·판매하는 흐름을 반영하는 쪽을 우선합니다.
- 다만 특정 플랫폼의 구체적인 규정·정책·수수료율·정산 주기 같은 사실은 지어내지 않습니다 — 확인되지 않은 특정 마켓플레이스 정책을 사실처럼 단정하지 말고, 특정 플랫폼에 검증되지 않은 세부사항을 결부시키는 대신 여러 플랫폼에 두루 적용되는 보편적인 크리에이터 워크플로(상품 기획 → 제작 → 리스팅 준비 → 마케팅 → 판매 → 고객 응대 같은 일반적 흐름)를 기준으로 씁니다.
- 계절적 예시: 외국의 절기·연휴·학사일정 예시는 한국의 계절·명절·학사일정 감각으로 바꿉니다.
- 용어와 표기: 업계 용어는 한국 디지털 콘텐츠 시장에서 실제로 쓰이는 표현을 쓰고, 어색한 번역투 대신 자연스러운 한국어 글쓰기 관례(문단 구성, 어투)를 따릅니다.

무엇을 바꾸지 않는지(과잉 로컬라이징 방지):
- 언급되는 모든 외국 제품·기업·서비스를 기계적으로 다 바꾸지 않습니다. 국제적으로 널리 쓰이거나 이 맥락에서 그 자체로 의미가 있는 서비스(예: 국경 없이 통용되는 글로벌 플랫폼)는 그대로 둡니다.
- 바꾸는 것이 오히려 정확성을 해친다면(그 서비스가 실제로 한국에 대응물이 없거나, 원문의 요지가 그 서비스 고유의 특징에 있다면) 원문을 그대로 유지합니다.
- 국가·문화와 무관하게 보편적으로 유효한 지식(예: 수학·과학 원리, 범용적인 방법론)은 그대로 둡니다.
- 프레임워크, 방법론, 교육적 논리 구조는 절대 바꾸지 않습니다 — 챕터의 framework 필드로 표현되는 체계·단계 구성 자체는 원저자의 것을 그대로 보존하고, 그 프레임워크를 설명하는 예시·용어·맥락만 한국 상황에 맞게 조정합니다.
- 원저자의 핵심 아이디어와 논리 구조는 보존하되, 이 책이 원래 한국 시장을 위해 기획·집필·출간된 것처럼 자연스럽게 느껴지게 씁니다.

사실 안전(Never-Guess, 예외 없음):
- 정확한 한국 대응 관계(기관명, 법률명, 세율·한도 같은 구체적 수치)를 확신할 수 없으면, 틀린 고유명사·수치를 지어내는 대신 일반적인 표현("관련 기관", "해당 세제", "관련 법령")을 씁니다.
- 한국의 기관, 세금 제도, 법적 요건, 의료 지침, 금융 규정, 통계, 협회·단체를 실제로 존재하는지 확인되지 않은 채로 지어내지 않습니다.
- 예시를 다시 쓸 때도 성공 사례, 구매 후기, 케이스 스터디를 새로 지어내지 않습니다. 예시가 꼭 필요하면 "예를 들어" 같은 표현으로 가상의 예시임을 분명히 밝힙니다.

원천 자료가 이미 한국 상황을 다루고 있거나 국가와 무관한 보편적 주제라면 이 규칙은 적용하지 않습니다.`;

  function ebookBlueprintGuidelines(){
    if(!APP.ebookBlueprint) return '';
    var ebp=APP.ebookBlueprint;
    var lines=['[승인된 전자책 생성 가이드라인]','','- 문체: '+ebp.toneGuideline,'- 정보 밀도: '+ebp.densityGuideline,'- CTA 적용 방식: '+ebp.ctaGuideline,'- FAQ 통합 방식: '+ebp.faqIntegrationGuideline,'- 핵심 Promise 일관성: '+ebp.crossConsistency.promise];
    if(ebp.crossConsistency.thumbnailPattern)lines.push('- Thumbnail Pattern과의 일관성: '+ebp.crossConsistency.thumbnailPattern);
    if(ebp.crossConsistency.salesPageLayoutStrategy)lines.push('- Sales Page 전략과의 일관성: '+ebp.crossConsistency.salesPageLayoutStrategy);
    lines.push('','[중요 규칙]','','- 위 가이드는 기존 전자책 구조를 변경하지 않는다.','- 원문에 없는 후기, 수치, 자격, 매출 보장을 생성하지 않는다.','- 기존 사용자 입력과 원천자료가 최우선 사실 근거다.');
    return lines.join('\n')+'\n\n';
  }

  /* ── 1) 목차/개요(Outline) ── 챕터 "본문"은 만들지 않고, 책 전체 뼈대(제목 주변
     필드/서문/서론/결론/판매카피/7개 챕터 브리핑)만 만든다. */
  E.buildOutlinePrompt = function(modeWrapperPrefix, market){
    market = market||'kr';
    var introLine = market==='global'
      ? '위 입력을 바탕으로 영어 전자책의 전체 개요와 해외 마켓(Gumroad·Etsy·Payhip 등) 판매용 카피 데이터를 작성하세요.'
      : '위 입력을 바탕으로 한국어 전자책의 전체 개요와 크몽 판매용 카피 데이터를 작성하세요.';
    return ebookBlueprintGuidelines()+(modeWrapperPrefix||'')+introLine+`
아직 각 챕터의 본문 전체를 쓰지 않습니다 — 챕터는 "브리핑"만 작성합니다(본문은 다음 단계에서 챕터별로 따로 작성됩니다).

[잠긴 제목 — 변경 금지]
제목: ${APP.lockedTitle}
부제목: ${APP.lockedSubtitle||''}
반환 JSON의 title과 subtitle은 위 문구를 정확히 사용하세요.
반드시 JSON 객체 하나만 반환하고 JSON 밖의 텍스트는 작성하지 마세요.

[분량과 구성]
- preface: 600자 이상
- intro: 800자 이상
- conclusion: 1200자 이상
- chapterBriefs: 정확히 7개, 문제 해부형, 사례 분석형, 단계별 실행형, 개념 전환형, 도구·자원형, 심화 전략형, 종합 실행형을 한 번씩 이 순서로 사용합니다.
- 각 chapterBrief는 해당 챕터에서 다룰 핵심 내용을 2~3문장으로 요약합니다(본문이 아니라 다음 단계 집필 지침).
- 7개 챕터는 문제 인식 → 이해 → 실행 → 응용의 흐름을 따르는 하나의 학습/변화 여정을 이루어야 합니다. 각 챕터는 서로 다른 소재·각도를 다뤄야 하며, 같은 조언을 제목만 바꿔 다른 챕터에서 반복하지 않습니다.
- 이 책이 실제로 약속하는 결과(제목·부제·description)와 각 챕터가 다루는 내용이 논리적으로 연결되어야 합니다 — 결과와 무관한 챕터로 분량만 채우지 않습니다.
- 책 전체에서 핵심 개념·용어의 이름을 통일하세요(뒤 챕터에서 같은 개념을 다른 이름으로 부르지 않도록, chapterBrief 단계에서부터 용어를 확정합니다).
- appendices: 정확히 3개 제목만 먼저 정합니다(본문은 다음 단계에서 작성).
- copyright.notice/disclaimer: "편집부", "편집팀", "고객센터", "출판사 문의" 등 내부 조직·연락 창구를 언급하지 마세요 — 저작권 표시와 이용 안내 문구만 작성합니다.

${FACTUALITY_RULES}

${SALES_COPY_RULES}

${WRITING_STYLE_RULES}

${PRACTICALITY_RULES}

${SOURCE_GROUNDING_RULES}

${market==='global'?'':KOREAN_LOCALIZATION_RULES}

아래 스키마를 정확히 따르세요.
{
  "title":"전자책 제목",
  "subtitle":"부제목",
  "author":"저자명",
  "category":"카테고리",
  "description":"책 소개",
  "targetReader":"구체적인 추천 독자 상황",
  "preface":"저자 서문. 사용자 입력에 실제 경험이 없으면 경험을 꾸며내지 말고 집필 배경과 문제의식 중심으로 작성",
  "intro":"서론",
  "conclusion":"핵심 정리와 실행 순서, 현실적인 응원",
  "chapterBriefs":[
    {"number":1,"title":"챕터 제목","type":"문제 해부형","summary":"이 챕터에서 다룰 핵심 내용 2~3문장"},
    {"number":2,"title":"챕터 제목","type":"사례 분석형","summary":"..."},
    {"number":3,"title":"챕터 제목","type":"단계별 실행형","summary":"..."},
    {"number":4,"title":"챕터 제목","type":"개념 전환형","summary":"..."},
    {"number":5,"title":"챕터 제목","type":"도구·자원형","summary":"..."},
    {"number":6,"title":"챕터 제목","type":"심화 전략형","summary":"..."},
    {"number":7,"title":"챕터 제목","type":"종합 실행형","summary":"..."}
  ],
  "appendixTitles":["핵심 실천 체크리스트","추천 도구와 참고 자료","실전 실행 플랜"],
  "copyright":{"year":"2026","publisher":"독립 출판","notice":"","disclaimer":"","contact":""},
  "sales":${E.salesSchemaString()}
}`;
  };

  /* Atlas V3 Phase 1 — 신규: 챕터 JSON 스키마 문자열을 별도 함수로 뽑아냈다.
     이전에는 이 스키마가 js/bootstrap.js의 부분 재생성 로직 안에 손으로 복사된
     두 번째 문자열로 따로 존재해, 한쪽만 고치면 다른 쪽이 조용히 stale해지는
     drift 위험이 있었다(Atlas V3 Phase 1 파이프라인 점검에서 확인됨). 이제
     전체 생성과 부분 재생성 모두 이 함수 하나만 호출한다 — 스키마는 항상
     하나의 소스에서만 나온다. */
  E.chapterSchemaString = function(brief){
    return '{"number":'+brief.number+',"title":"챕터 제목","content":"'+brief.type+' 본문(3500자 이상)","summary":"챕터 요약 2~3문장","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"],"framework":{"name":"체계 이름","steps":[{"title":"단계 제목","description":"단계 설명"}]},"timeline":[{"stage":"1단계","label":"단계 이름","description":"설명"}],"comparisonTable":{"title":"비교 제목","headers":["기준","A","B"],"rows":[["기준1","A 값","B 값"]]}}';
  };

  /* ── 2) 챕터별 생성(7회 반복) ── 이미 완성된 outline의 해당 chapterBrief만 그
     챕터의 집필 지침으로 쓰고, 나머지 챕터와 내용이 겹치지 않도록 전체 개요도
     참고 정보로 함께 전달한다. */
  E.buildChapterPrompt = function(outline, brief, market){
    market = market||'kr';
    var otherBriefs = outline.chapterBriefs.filter(function(b){return b.number!==brief.number;})
      .map(function(b){return b.number+'장 ('+b.type+'): '+b.title+' — '+b.summary;}).join('\n');
    return ebookBlueprintGuidelines()+`아래는 이미 확정된 전자책의 개요입니다. 이 중 ${brief.number}번째 챕터(${brief.type}) 하나만 본문으로 완성하세요.
다른 챕터와 겹치지 않게 하되, 이 챕터의 집필 지침(summary)에서 벗어나지 마세요. 다른 챕터에서 이미 다룬 조언을 제목이나 표현만 바꿔 반복하지 마세요 — 겹치는 소재라면 이 챕터만의 새로운 각도를 찾으세요.
반드시 JSON 객체 하나만 반환하고 JSON 밖의 텍스트는 작성하지 마세요.

[전자책 정보]
제목: ${outline.title}
부제목: ${outline.subtitle}
설명: ${outline.description}
추천 독자: ${outline.targetReader}

[이 챕터의 집필 지침]
${brief.number}번째 챕터 · 유형: ${brief.type}
제목(안): ${brief.title}
다룰 내용: ${brief.summary}

[다른 챕터 목록 — 내용 중복 방지용 참고]
${otherBriefs}

[분량과 구성]
- content: 3500자 이상
- 본문 안에서 설명(개념 정리)과 예시(구체적 사례)와 행동지침(무엇을 하라는 지시)을 독자가 구분할 수 있게 씁니다 — 세 가지를 뭉뚱그려 쓰지 않습니다.
- summary는 이 챕터의 핵심을 정리하는 2~3문장 요약입니다. keyPoints를 그대로 나열하지 말고, 새로운 한 단락으로 요약하세요. 모든 챕터에 필수입니다. summary는 반드시 이 챕터의 실제 본문 내용을 반영해야 합니다 — 본문에 없는 내용을 요약에 넣지 마세요.
- actionBox는 오늘 바로 할 수 있는 행동 하나입니다.
- keyPoints는 새로운 인사이트 3개입니다.
- actionItems는 구체적인 실행 단계 3개 이상입니다.
- framework는 이 챕터가 실제로 이름 붙일 수 있는 체계·모델·방법론을 설명할 때만 포함하세요(예: "3단계 검증 프레임워크"). 해당 없으면 framework 필드 자체를 응답에서 완전히 생략하세요. 포함할 경우 name과 3~5개의 steps(각 title+description)로 구성합니다.
- timeline은 이 챕터가 시간순 과정이나 여정을 설명할 때만 포함하세요(예: "첫 달 → 3개월 차 → 6개월 차"). 해당 없으면 timeline 필드 자체를 응답에서 완전히 생략하세요. 포함할 경우 3개 이상의 단계(각 stage+label+description)로 구성합니다.
- comparisonTable은 이 챕터가 실제로 두 가지 이상의 대상·선택지·전후 상태를 비교할 때만 포함하세요. 해당 없으면 comparisonTable 필드 자체를 응답에서 완전히 생략하세요. 포함할 경우 title, headers(비교 기준 열), rows(각 행)로 구성합니다.
- framework/timeline/comparisonTable을 실제로 다룰 내용이 없는데 억지로 만들어내지 마세요 — 이 챕터의 집필 지침(summary)과 본문 내용에 자연스럽게 존재하는 경우에만 포함합니다.

${FACTUALITY_RULES}

${WRITING_STYLE_RULES}

${PRACTICALITY_RULES}

${SOURCE_GROUNDING_RULES}

${market==='global'?'':KOREAN_LOCALIZATION_RULES}

아래 스키마를 정확히 따르세요(이 챕터 하나만). framework/timeline/comparisonTable은 해당 없으면 키 자체를 생략하세요(빈 값으로 채우지 마세요).
${E.chapterSchemaString(brief)}`;
  };

  /* ── 3) 부록 생성 ── outline이 이미 정해둔 3개 제목 그대로 본문만 채운다. */
  E.buildAppendicesPrompt = function(outline, market){
    market = market||'kr';
    var titles = outline.appendixTitles||['핵심 실천 체크리스트','추천 도구와 참고 자료','실전 실행 플랜'];
    return ebookBlueprintGuidelines()+`아래는 이미 확정된 전자책의 개요입니다. 부록 3개의 본문을 작성하세요(제목은 이미 정해져 있으니 그대로 사용).
반드시 JSON 배열 하나만 반환하고 배열 밖의 텍스트는 작성하지 마세요.

[전자책 정보]
제목: ${outline.title}
설명: ${outline.description}
추천 독자: ${outline.targetReader}

[분량과 구성]
- appendices: 정확히 3개
- 각 부록은 실제로 활용 가능한 구체적인 체크리스트/자료/계획으로 작성합니다.
- 세 부록은 서로 다른 목적을 가져야 합니다 — 같은 내용을 형식만 바꿔 반복하지 않습니다.

${FACTUALITY_RULES}

${WRITING_STYLE_RULES}

${PRACTICALITY_RULES}

${SOURCE_GROUNDING_RULES}

${market==='global'?'':KOREAN_LOCALIZATION_RULES}

아래 스키마를 정확히 따르세요.
[
  {"title":"${titles[0]}","content":"구체적 체크리스트"},
  {"title":"${titles[1]}","content":"도구별 특징, 사용법, 확인 시점"},
  {"title":"${titles[2]}","content":"단계별 실행 계획"}
]`;
  };

  /* Atlas V3 Phase 1 — 신규: outline 스키마 안의 sales 객체 모양도 챕터 스키마와
     같은 이유로 별도 함수로 뽑아, js/bootstrap.js의 부분 재생성("판매자료·후킹·
     FAQ" 옵션)이 outline 스키마와 항상 같은 모양을 쓰도록 한다. */
  E.salesSchemaString = function(){
    return '{"hook":"수치 없는 강력한 후킹 문장","subhook":"구체적인 상황을 묘사한 서브 후킹","pains":["고통1","고통2","고통3","고통4"],"solution":"이 책이 제공하는 해결 구조","learnings":["배울 내용1","배울 내용2","배울 내용3","배울 내용4"],"benefits":["혜택1","혜택2","혜택3","혜택4"],"before":["변화 전1","변화 전2","변화 전3"],"after":["변화 후1","변화 후2","변화 후3"],"testimonials":[],"faqs":[{"q":"질문1","a":"답변1"},{"q":"질문2","a":"답변2"},{"q":"질문3","a":"답변3"}],"finalPush":"과장 없는 최종 행동 유도 문장"}';
  };

  function extractResponseText(data){
    return (data.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
  }

  function stripBOM(s){ return s.length && s.charCodeAt(0)===0xFEFF ? s.slice(1) : s; }

  function contextAroundPosition(text, pos, radius){
    var start = Math.max(0, pos-radius);
    var end = Math.min(text.length, pos+radius);
    return text.slice(start, end);
  }

  /* Claude가 JSON 문자열 값 안에 이스케이프 없이 실제 줄바꿈/탭을 그대로 반환하는
     경우(실제로 확인된 원인 — "Expected ',' or ']'" 류 오류의 전형적인 원인)를
     고치기 위한 최소한의 상태기계형 sanitizer다. 문자열( " ~ " ) 내부에 있을 때만
     raw \n/\r/\t를 \\n/\\r/\\t로 이스케이프한다 — 문자열 밖의 JSON 구조는 건드리지
     않는다. */
  function escapeRawControlCharsInStrings(text){
    var out = '';
    var inString = false;
    var escapeNext = false;
    for(var i=0;i<text.length;i++){
      var ch = text[i];
      if(inString){
        if(escapeNext){ out += ch; escapeNext = false; continue; }
        if(ch === '\\'){ out += ch; escapeNext = true; continue; }
        if(ch === '"'){ out += ch; inString = false; continue; }
        if(ch === '\n'){ out += '\\n'; continue; }
        if(ch === '\r'){ out += '\\r'; continue; }
        if(ch === '\t'){ out += '\\t'; continue; }
        out += ch; continue;
      }
      if(ch === '"'){ inString = true; }
      out += ch;
    }
    return out;
  }

  /* 실제 Windows 실행에서 두 번째로 재현된 파싱 오류: 배열의 객체 요소 사이에서
     모델이 콤마를 빠뜨리는 경우("...}  {...]" 처럼 "}"뒤에 바로 "{"가 옴) —
     "Expected ',' or ']' after array element"가 문자열 밖(구조 경계)에서 발생하며,
     escapeRawControlCharsInStrings()는 문자열 내부만 다루므로 이 패턴은 고치지
     못한다. 유효한 JSON 문법상 닫는 토큰(}/]/닫는 문자열) 바로 뒤에 공백만 두고
     여는 토큰({/[/문자열)이 오는 경우는 항상 콤마 누락이다 — key 뒤에는 반드시
     ":"가 먼저 오므로 오탐하지 않는다.
     문자열 값 안에 우연히 "} {" 같은 텍스트가 그대로 들어있는 경우까지 건드리면
     안 되므로, 정규식이 아니라 escapeRawControlCharsInStrings()와 동일하게
     "지금 문자열 안인지"를 추적하는 상태기계로 구현한다 — 구조 토큰 사이에서만
     콤마를 삽입하고 문자열 내부 텍스트는 절대 건드리지 않는다. */
  function insertMissingCommasBetweenElements(text){
    var out = '';
    var inString = false;
    var escapeNext = false;
    var lastWasClosing = false;
    for(var i=0;i<text.length;i++){
      var ch = text[i];
      if(inString){
        out += ch;
        if(escapeNext){ escapeNext = false; }
        else if(ch === '\\'){ escapeNext = true; }
        else if(ch === '"'){ inString = false; lastWasClosing = true; }
        continue;
      }
      if(ch === '"'){ if(lastWasClosing) out += ','; out += ch; inString = true; lastWasClosing = false; continue; }
      if(ch === '{' || ch === '['){ if(lastWasClosing) out += ','; out += ch; lastWasClosing = false; continue; }
      if(ch === '}' || ch === ']'){ out += ch; lastWasClosing = true; continue; }
      if(ch === ',' || ch === ':'){ out += ch; lastWasClosing = false; continue; }
      if(/\s/.test(ch)){ out += ch; continue; }
      out += ch; lastWasClosing = false;
    }
    return out;
  }

  /* 실제 Windows 실행에서 세 번째로 재현된 파싱 오류: 챕터 본문(content) 안에서
     모델이 한국어 인용문("...?")을 JSON 문자열 안에 이스케이프 없이 그대로
     반환하는 경우. 예: "content":"...질문은 하나다. "수익이 ... 있는가?" 이것이..."
     — 안쪽의 raw "가 문자열을 조기 종료시켜 버려서 그 뒤에 오는 일반 텍스트가
     "Expected ',' or '}' after property value"를 유발한다.
     이런 raw "가 정말 문자열의 끝인지, 아니면 이스케이프를 빠뜨린 내부 인용
     부호인지는 그 다음에 오는 문자로 판별한다 — 유효한 JSON에서 문자열이 끝나면
     공백을 건너뛰고 반드시 ",", ":", "}", "]" 중 하나이거나 텍스트의 끝이어야
     한다. 그렇지 않다면(예: 바로 뒤에 다른 한글 텍스트가 이어짐) 그 "는 진짜
     종료가 아니라 이스케이프를 빠뜨린 것으로 보고 \"로 보정한다. */
  function escapeStrayQuotesInsideStrings(text){
    var out = '';
    var inString = false;
    var escapeNext = false;
    for(var i=0;i<text.length;i++){
      var ch = text[i];
      if(!inString){
        out += ch;
        if(ch === '"') inString = true;
        continue;
      }
      if(escapeNext){ out += ch; escapeNext = false; continue; }
      if(ch === '\\'){ out += ch; escapeNext = true; continue; }
      if(ch === '"'){
        var j = i+1;
        while(j < text.length && /\s/.test(text[j])) j++;
        var nextCh = j < text.length ? text[j] : '';
        var isRealClose = nextCh==='' || nextCh===','||nextCh===':'||nextCh==='}'||nextCh===']';
        if(isRealClose){ out += ch; inString = false; }
        else{ out += '\\"'; }
        continue;
      }
      out += ch;
    }
    return out;
  }

  /* 2026-08-13: 사용자 리포트 — 제목 후보(titles-interview, 배열 요소 12개)
     생성 중 "Expected ',' or ']' after array element"로 위 5단계 보정을 전부
     통과하고도 실패했다. 배열 요소 12개처럼 긴 배열을 반환할 때 모델이 가끔
     JSON 구조 밖에서 번호를 매기며 "생각을 정리"하다가 그 번호 매김이 실제
     JSON 배열 요소 사이에 섞여 들어가는 경우가 있다(예: "},\n2. {..." 처럼
     콤마 뒤에 마크다운 번호/글머리 기호가 낀 채로 다음 객체가 이어짐) — 콤마
     자체는 있으니 위의 콤마 보정(insertMissingCommasBetweenElements)으로는
     못 잡는다. 문자열 밖에서 "," 또는 "[" 바로 뒤에 번호("1.", "2)")나
     글머리 기호("-", "*", "•")가 오고, 그 뒤에 곧바로 실제 JSON 값이 시작되는
     토큰({, ", [)이 이어지는 경우에만 그 기호를 제거한다 — 문자열 내부 텍스트나
     진짜 값과 무관한 위치는 건드리지 않아 정상 JSON을 손상시키지 않는다. */
  function stripStrayListMarkersBetweenElements(text){
    var out = '';
    var inString = false;
    var escapeNext = false;
    var i = 0;
    while(i < text.length){
      var ch = text[i];
      if(inString){
        out += ch;
        if(escapeNext){ escapeNext = false; }
        else if(ch === '\\'){ escapeNext = true; }
        else if(ch === '"'){ inString = false; }
        i++; continue;
      }
      if(ch === '"'){ inString = true; out += ch; i++; continue; }
      if(ch === ',' || ch === '['){
        out += ch; i++;
        var j = i;
        while(j < text.length && /\s/.test(text[j])) j++;
        var whitespace = text.slice(i, j);
        var rest = text.slice(j);
        var m = rest.match(/^(\d{1,2}[.)]|[-*•])\s+/);
        if(m && /^[{"\[]/.test(rest.slice(m[0].length))){
          out += whitespace;
          i = j + m[0].length;
          continue;
        }
        out += whitespace;
        i = j;
        continue;
      }
      out += ch; i++;
    }
    return out;
  }

  /* §1/§2/§3/§4/§5/§6(사용자 요청) — 실제 Windows 실행에서 "Expected ',' or ']'..."
     파싱 오류가 재현되어 만든 견고화 로직이다.
     - 파싱 전 원문(raw)을 window.__atlasLastRawResponse[unitLabel]에 항상 보관한다
       (개발자 콘솔에서 언제든 실제 원문을 확인할 수 있다 — §1).
     - ```json/``` 코드펜스, BOM, 앞뒤 설명 문장을 제거하고 첫 여는 문자~마지막 닫는
       문자 사이만 후보로 삼는다(§4/§5).
     - 1차 파싱이 실패하면 실패 위치 주변 원문을 콘솔에 출력한다(§3).
     - 문자열 내부의 raw 개행/탭을 이스케이프하고 trailing comma를 제거해 2차
       파싱을 시도한다(§4) — 실제 Anthropic 응답이 이 패턴으로 깨지는 경우가 있다.
     - 그래도 실패하면 배열/객체 요소 사이의 누락된 콤마를 보정해 3차 파싱을
       시도한다(실제 Windows에서 두 번째로 재현된 원인).
     - 그래도 실패하면 문자열 내부의 이스케이프 안 된 인용부호를 보정해 4차
       파싱을 시도한다(실제 Windows에서 세 번째로 재현된 원인 — 챕터 본문 안의
       한국어 인용문).
     - 그래도 실패하면 콤마 보정 + 인용부호 보정을 함께 적용해 5차 파싱을
       시도한다(두 문제가 함께 발생하는 경우 대비).
     - 그래도 실패하면 원문 전체/실패 위치 주변을 로그로 남기고, 에러 객체에도
       원문을 실어(err.rawResponseText) 위쪽 catch에서 그대로 보여줄 수 있게 한다(§6). */
  function robustJsonParse(rawResponseText, openChar, closeChar, unitLabel){
    var raw = stripBOM(rawResponseText);
    window.__atlasLastRawResponse = window.__atlasLastRawResponse || {};
    window.__atlasLastRawResponse[unitLabel] = raw;

    var clean = raw.replace(/```json\s*/gi,'').replace(/```/g,'').trim();
    var s = clean.indexOf(openChar), e = clean.lastIndexOf(closeChar);
    if(s===-1||e===-1){
      console.error('[incremental-ebook] ['+unitLabel+'] JSON 시작/끝 문자를 찾을 수 없습니다. 원문 전체:', raw);
      var eNotFound = new Error(unitLabel+': 응답에서 JSON을 찾을 수 없습니다.');
      eNotFound.rawResponseText = raw;
      /* 사용자 화면에는 영문 JS 에러/개발자 콘솔 안내 없이 이 문구만 노출한다
         (원문 전체는 기존처럼 console.error와 window.__atlasLastRawResponse에
         그대로 남아있어 개발자는 그대로 확인 가능 — 숨기는 게 아니라 사용자
         화면 문구만 쉬운 말로 분리한다). */
      eNotFound.friendlyMessage = 'AI가 예상한 형식으로 응답하지 않았습니다. 대부분 일시적인 현상입니다.';
      throw eNotFound;
    }
    var candidate = clean.substring(s, e+1);

    function tryParse(text){
      try{ return { ok:true, value: JSON.parse(text) }; }
      catch(err){ return { ok:false, err: err }; }
    }

    var attempt1 = tryParse(candidate);
    if(attempt1.ok) return attempt1.value;

    console.error('[incremental-ebook] ['+unitLabel+'] 1차 JSON.parse 실패: '+attempt1.err.message);
    console.error('[incremental-ebook] ['+unitLabel+'] 원문 전체(파싱 전, response.text() 그대로):', raw);
    var posMatch1 = /position (\d+)/.exec(attempt1.err.message);
    if(posMatch1){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(원문 기준):', contextAroundPosition(candidate, parseInt(posMatch1[1],10), 200));
    }

    var sanitized = escapeRawControlCharsInStrings(candidate).replace(/,(\s*[}\]])/g, '$1');
    var attempt2 = tryParse(sanitized);
    if(attempt2.ok){
      console.warn('[incremental-ebook] ['+unitLabel+'] 문자열 내부 제어문자 이스케이프 후 2차 파싱 성공(모델이 JSON 문자열 안에 실제 줄바꿈을 이스케이프 없이 반환했을 가능성이 높습니다).');
      return attempt2.value;
    }

    console.error('[incremental-ebook] ['+unitLabel+'] 2차(정제 후) JSON.parse도 실패: '+attempt2.err.message);
    var posMatch2 = /position (\d+)/.exec(attempt2.err.message);
    if(posMatch2){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(정제 후 기준):', contextAroundPosition(sanitized, parseInt(posMatch2[1],10), 200));
    }

    var commaFixed = insertMissingCommasBetweenElements(sanitized);
    var attempt3 = tryParse(commaFixed);
    if(attempt3.ok){
      console.warn('[incremental-ebook] ['+unitLabel+'] 배열/객체 요소 사이 누락된 콤마 보정 후 3차 파싱 성공(모델이 배열 요소 사이에 콤마를 빠뜨렸을 가능성이 높습니다).');
      return attempt3.value;
    }

    console.error('[incremental-ebook] ['+unitLabel+'] 3차(콤마 보정 후) JSON.parse도 실패: '+attempt3.err.message);
    var posMatch3 = /position (\d+)/.exec(attempt3.err.message);
    if(posMatch3){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(콤마 보정 후 기준):', contextAroundPosition(commaFixed, parseInt(posMatch3[1],10), 200));
    }

    var quoteFixed = escapeStrayQuotesInsideStrings(sanitized);
    var attempt4 = tryParse(quoteFixed);
    if(attempt4.ok){
      console.warn('[incremental-ebook] ['+unitLabel+'] 문자열 내부 이스케이프 안 된 인용부호 보정 후 4차 파싱 성공(모델이 본문 안에서 인용문의 "를 이스케이프 없이 반환했을 가능성이 높습니다).');
      return attempt4.value;
    }

    console.error('[incremental-ebook] ['+unitLabel+'] 4차(인용부호 보정 후) JSON.parse도 실패: '+attempt4.err.message);
    var posMatch4 = /position (\d+)/.exec(attempt4.err.message);
    if(posMatch4){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(인용부호 보정 후 기준):', contextAroundPosition(quoteFixed, parseInt(posMatch4[1],10), 200));
    }

    var quoteAndCommaFixed = insertMissingCommasBetweenElements(quoteFixed);
    var attempt5 = tryParse(quoteAndCommaFixed);
    if(attempt5.ok){
      console.warn('[incremental-ebook] ['+unitLabel+'] 인용부호+콤마 보정을 함께 적용한 5차 파싱 성공.');
      return attempt5.value;
    }

    console.error('[incremental-ebook] ['+unitLabel+'] 5차(인용부호+콤마 보정 후) JSON.parse도 실패: '+attempt5.err.message);
    var posMatch5 = /position (\d+)/.exec(attempt5.err.message);
    if(posMatch5){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(5차 보정 후 기준):', contextAroundPosition(quoteAndCommaFixed, parseInt(posMatch5[1],10), 200));
    }

    /* 2026-08-13: 사용자 리포트로 추가한 6차 시도 — 긴 배열(예: 제목 후보
       12개)에서 모델이 배열 요소 사이에 마크다운 번호/글머리 기호를 흘려
       넣는 경우를 마지막으로 한 번 더 정리해본다. */
    var listMarkerFixed = stripStrayListMarkersBetweenElements(quoteAndCommaFixed);
    var attempt6 = tryParse(listMarkerFixed);
    if(attempt6.ok){
      console.warn('[incremental-ebook] ['+unitLabel+'] 배열 요소 사이 마크다운 번호/글머리 기호 제거 후 6차 파싱 성공(모델이 배열 요소 사이에 "1." 같은 목록 기호를 섞어 넣었을 가능성이 높습니다).');
      return attempt6.value;
    }

    console.error('[incremental-ebook] ['+unitLabel+'] 6차(목록 기호 제거 후) JSON.parse도 실패: '+attempt6.err.message);

    var eFinal = new Error(unitLabel+': JSON 파싱 실패 — '+attempt6.err.message+' (개발자 콘솔의 window.__atlasLastRawResponse.'+unitLabel+' 에서 원문 전체를 확인할 수 있습니다)');
    eFinal.rawResponseText = raw;
    eFinal.parseErrorMessage = attempt6.err.message;
    /* 사용자 화면용 쉬운 문구 — 위 e.message(영문 JS 에러+개발자 콘솔 안내)는
       계속 console.error/window.__atlasLastRawResponse로 남아있으니 개발자는
       그대로 원인 추적 가능. 화면에는 이 문구만 보여준다. */
    eFinal.friendlyMessage = 'AI가 만든 내용의 형식이 깨져서 처리하지 못했습니다. 응답이 도중에 끊겼거나 형식 오류가 있었을 가능성이 높습니다.';
    throw eFinal;
  }

  /* callGateway는 window.AtlasAnthropicGateway.generate()를 그대로 쓴다 — 새 Provider나
     새 Gateway 경로를 만들지 않는다(기존 Anthropic Gateway 재사용). callType은
     Anthropic에 보내는 값이 아니라, 서버가 유닛 종류별로(챕터는 더 짧게) 타임아웃을
     고르는 데만 쓰는 라우팅 힌트다. 실제 호출 전 max_tokens만 콘솔에 남기고
     Prompt 전문/API Key는 절대 출력하지 않는다. */
  function callGateway(promptText, maxTokens, callType, market){
    return buildApiContent(promptText).then(function(content){
      console.log('[incremental-ebook] calling Anthropic gateway — callType='+callType+', max_tokens='+maxTokens+', promptVersion='+E.PROMPT_VERSION);
      return window.AtlasAnthropicGateway.generate({
        model:'claude-sonnet-4-6', max_tokens:maxTokens, system:atlasSystemPromptFor(market||'kr'),
        callType: callType,
        messages:[{role:'user', content: content}]
      });
    });
  }

  /* outline은 제목/서문(600자+)/서론(800자+)/결론(1200자+)/7개 챕터 브리핑/부록
     제목/저작권/판매 카피(hook·pains·learnings·benefits·faqs 등)까지 한 번에
     담아야 해서 6000 max_tokens로는 부족했다 — 실제 Windows에서 응답이 배열
     중간에서 잘려 "Expected ',' or '}'" 파싱 오류로 재현된 원인. 16000으로
     늘려 잘리지 않게 한다(claude-sonnet-4-6 최대 출력 128K 대비 충분히 여유). */
  E.generateOutline = function(modeWrapperPrefix, market){
    return callGateway(E.buildOutlinePrompt(modeWrapperPrefix, market), 16000, 'outline', market).then(function(data){
      var text = extractResponseText(data);
      return robustJsonParse(text, '{', '}', 'outline');
    });
  };

  E.generateChapter = function(outline, brief, market){
    return callGateway(E.buildChapterPrompt(outline, brief, market), 9000, 'chapter', market).then(function(data){
      var text = extractResponseText(data);
      return robustJsonParse(text, '{', '}', 'chapter'+brief.number);
    });
  };

  /* 실제 Windows 실행에서 재현된 세 번째 종류의 실패: 부록 3개 각각이 실전
     체크리스트/도구 비교표/실행 플랜만큼 풍부한 분량이라 5000 max_tokens로는
     3개를 다 담기 전에 응답이 중간(두 번째 부록 도중)에서 잘렸다 — "Unterminated
     string"은 그 어떤 후처리 보정으로도 고칠 수 없는 진짜 truncation 신호다.
     목차와 동일하게 16000으로 늘려 잘리지 않게 한다. */
  E.generateAppendices = function(outline, market){
    return callGateway(E.buildAppendicesPrompt(outline, market), 16000, 'appendices', market).then(function(data){
      var text = extractResponseText(data);
      return robustJsonParse(text, '[', ']', 'appendices');
    });
  };

  /* ── 최종 병합 ── outline + 완료된 7개 챕터 + 부록을 기존 ebook 스키마와
     동일한 모양으로 합친다. 이 병합 결과만 Creative Campaign Engine/판매디자인이
     사용한다(중간 산출물은 절대 전달하지 않는다). */
  E.mergeFinalEbook = function(state){
    var o = state.outline;
    return {
      title: o.title, subtitle: o.subtitle, author: o.author, category: o.category,
      description: o.description, targetReader: o.targetReader,
      preface: o.preface, intro: o.intro,
      chapters: state.chapters.slice(),
      conclusion: o.conclusion,
      appendices: state.appendices.slice(),
      copyright: o.copyright, sales: o.sales
    };
  };

  /* Atlas V3 Phase 1 — 부분 재생성(js/bootstrap.js)이 전체 생성과 "동일한 스키마,
     품질 규칙, 용어, 대상 독자, 톤, 편집 구조"(요구사항)를 쓰도록, 이전까지 이
     IIFE 안에 private으로 갇혀 있던 공유 규칙·가이드라인·강건한 JSON 파서를
     외부에서 재사용할 수 있게 노출한다. 이 함수/문자열들의 "내용"은 전혀
     바뀌지 않았다 — 접근 범위만 넓어졌다. */
  E.FACTUALITY_RULES = FACTUALITY_RULES;
  E.SALES_COPY_RULES = SALES_COPY_RULES;
  E.WRITING_STYLE_RULES = WRITING_STYLE_RULES;
  E.PRACTICALITY_RULES = PRACTICALITY_RULES;
  E.SOURCE_GROUNDING_RULES = SOURCE_GROUNDING_RULES;
  E.KOREAN_LOCALIZATION_RULES = KOREAN_LOCALIZATION_RULES;
  E.ebookBlueprintGuidelines = ebookBlueprintGuidelines;
  E.robustJsonParse = robustJsonParse;

})(window.AtlasIncrementalEbookEngine);
