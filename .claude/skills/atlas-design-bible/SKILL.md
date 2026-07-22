---
name: atlas-design-bible
description: >
  Atlas AI eBook Studio의 공식 디자인 시스템(design.md)을 그대로 인코딩한 스킬.
  Brand Theme(Premium/Study Note/Handwriting), Design Principles(Beautiful by
  Default/Brand First/Preview First/One Click/Premium SaaS/UX First), 테마별
  색상·폰트·필수/금지 요소, 레이아웃 규칙, Theme Card 규칙, 애니메이션 제한,
  타이포그래피 규칙, "Preview == Export" 불변식, Never Guess 규칙을 포함한다.
  Thumbnail Studio, Sales Page Studio, Brand Theme/Brand Pack 시스템, 향후 신규
  Studio, 신규 Brand Theme(Business/Creator/Minimal/Finance/Healthcare/Education)
  등 Atlas 프로젝트의 시각적/UI/디자인 작업이라면 사용자가 "design.md"나 "디자인
  시스템"을 언급하지 않아도 반드시 이 스킬을 사용한다. 이보다 먼저
  `atlas-business-bible`(왜 이 디자인 규칙이 존재하는지, 예: Brand Pack별 판매
  전략)을 참조해야 한다. 이 스킬에 없는 판단이 필요하거나 사용자의 명시적
  지시와 충돌하면, 임의로 추측하지 말고 먼저 사용자에게 질문한다.
---

# Atlas Design Bible

## 원본 문서
이 스킬은 프로젝트 루트의 `design.md`(Atlas Design Bible v1)를 기반으로 하며,
정합성 점검(핵심 철학 문구, Premium SaaS UX 목표, 향후 Brand Theme 목록)을 거쳐
`design.md`와 동일한 기준으로 맞춰져 있다. Never Guess/UX First는 design.md에는
없는 이 스킬만의 보강 원칙이다. 앞으로 이 스킬과 `design.md`가 다시 어긋나 보이면
임의로 어느 한쪽을 따르지 말고 사용자에게 먼저 확인한다 — 문서 우선순위는
`atlas-coding-bible`의 "문서/지시 우선순위" 절을 따른다.

## 핵심 철학
Atlas는 단순한 전자책 생성기가 아니다. 전자책을 **기획하고, 작성하고,
디자인하고, 판매**할 수 있도록 도와주는 AI Publishing SaaS다. 사용자는 하나의
전자책만 만드는 것이 아니라 하나의 브랜드를 구축한다. 모든 UI 판단은 이 철학을
기준으로 한다.

## Design Principles
1. **Beautiful by Default** — 사용자가 디자인을 몰라도 기본값만으로 완성도 높은 결과가 나와야 한다. 복잡한 설정을 강요하지 않는다.
2. **Brand First** — 전자책·썸네일·상세페이지·Export 결과가 하나의 브랜드처럼 보여야 한다. UI와 실제 결과물의 디자인이 달라서는 안 된다.
3. **Preview First** — 설정보다 Preview가 중요하다. Preview는 항상 화면에서 가장 큰/중요한 요소여야 한다.
4. **One Click** — 브랜드 하나만 고르면 폰트·색상·버튼·카드·썸네일·상세페이지가 전부 자동 적용되어야 한다. 클릭 수를 최소화한다.
5. **Premium SaaS** — 관리자 페이지처럼 만들지 않는다. 목표 UX 철학은 Canva, Gamma, Framer, Apple.
6. **UX First** — 새 기능을 추가하는 것보다 기존 기능을 더 쉽고 직관적으로 만드는 것을 우선한다. 기능을 더할지 고민될 때는 먼저 "이미 있는 기능을 더 쉽게 만들 방법은 없는가"를 검토한다.

## Never Guess (가장 중요한 행동 규칙)
디자인 판단이 애매하거나, 이 스킬/`design.md`에 명시되지 않은 케이스이거나,
사용자의 기존 지시와 충돌할 가능성이 있으면 **절대 임의로 추측해서 결정하지
않는다.** 반드시 먼저 사용자에게 질문한다. "그럴듯해 보여서"라는 이유로 규칙에
없는 색상, 폰트, 레이아웃, 새 Brand Theme, 새 장식 요소를 만들어내지 않는다.

## Brand Themes
- **현재 구현됨**: Premium / Study Note / Handwriting
- **향후 (아직 구현하지 않음, 요청 없이 임의로 추가 금지)**: Business / Creator / Minimal / Finance / Healthcare / Education

## Theme Rules

### Premium
- 느낌: 고급 · 전문가 · AI · 투자 · 부업
- 색상: Black / Charcoal / Gold / Ivory
- 폰트: Heading = Noto Serif KR · Body = Pretendard · Accent = Pretendard Bold
- 금지: 보라색 버튼, 네온 효과, 과도한 Glow

### Study Note
- 느낌: 공부노트 · 플래너 · 건강 · 자기계발 · 육아
- 색상: Ivory / Beige / Brown / Sage / Yellow
- 필수 요소: 줄노트, Dot Grid, 포스트잇, 체크리스트, 형광펜, 책갈피
- 폰트: Heading = Noto Serif KR · Body = Pretendard · Accent = Poor Story
- 금지: 다크 카드, 검정 배경

### Handwriting
- 느낌: 다이어리 · 루틴 · 감성 · 기록 · 메모
- 색상: Warm Ivory / Dusty Pink / Warm Brown / Soft Blue
- 필수 요소: 손그림 밑줄, 마스킹테이프, 메모, 스티커, 손글씨 포인트
- 폰트: Heading = Noto Serif KR · Body = Pretendard · Accent = Single Day
- 금지: 본문 전체 필기체, 유아용 디자인

## Layout Rules
왼쪽 = 설정, 오른쪽 = Preview. Preview는 항상 가장 크게 보여야 한다.

## Theme Cards
텍스트 버튼 사용 금지 — 반드시 카드 형태. 카드 안에는 실제 Thumbnail, 실제 Sales
Page, Font Pair, Color Palette, 추천 분야를 모두 포함해야 한다.

## Animation
허용: Fade, Hover, Scale (150~220ms). 금지: Bounce, 과도한 Glow, 지속적인 움직임.

## Typography
본문 기본은 Pretendard. 필기체 폰트는 Badge · 메모 · 강조 문구에만 쓴다. 본문 전체를
필기체로 쓰지 않는다.

## Export Rule (가장 중요한 디자인 규칙)
**Preview와 Export 결과는 반드시 동일해야 한다.** Preview만 예쁘고 실제 다운로드되는
PNG/JPG/ZIP이 다른 디자인이면 그 작업은 실패한 것이다. 새 CSS/레이아웃을 추가할 때는
항상 "이 변경이 실제 Export되는 DOM 엘리먼트의 크기·색을 그대로 유지하는가"를 먼저
검증한다 (예: 컨테이너를 좁히는 대신 카드 자체가 줄어들지 않게 하고 가로 스크롤을 허용).

## 관련 스킬
- **`atlas-business-bible`** — 이 디자인 규칙들이 왜 존재하는지(예: Brand
  Pack별 색/장식이 어떤 판매 전략을 위한 것인지는 이 스킬이 정의)
- **`atlas-product-bible`** — 애초에 이 기능/방향이 맞는지
- **`atlas-coding-bible`** — 이 디자인을 어떻게 안전하게 구현할지(Git/Phase/
  검증/문서화)
- **`atlas-qa-bible`** — 구현 결과가 이 디자인 규칙을 실제로 만족하는지 검증

다섯 스킬은 서로 대체하지 않는다. business-bible을 가장 먼저 참조하고,
디자인이 포함된 작업이면 이 스킬만으로 끝내지 말고 위 스킬들도 함께 사용한다.

## 이 스킬을 사용할 때의 행동 규칙
1. 새 UI를 만들기 전에 위 규칙을 이미 읽은 것으로 간주하고 적용한다 — 이 스킬이
   곧 design.md(+ 승인된 갱신 사항)이므로 별도로 design.md를 다시 읽을 필요는
   없다(단, 이 스킬과 design.md가 어긋나 보이면 실제 design.md를 확인한다).
2. 이 문서와 충돌하는 디자인은 구현하지 않는다.
3. **Never Guess**: 애매하거나 이 문서에 없는 케이스는 임의로 결정하지 말고
   반드시 사용자에게 먼저 질문한다.
4. **UX First**: 새 기능 추가보다 기존 기능을 더 쉽고 직관적으로 만드는 것을
   우선 검토한다.
5. 기존 기능/로직/Export 크기(Thumbnail 652×488 · 4:3, Sales Page 기준 DOM
   540×675 · 실제 Export 1080×1350)는 디자인 작업으로 절대 바꾸지 않는다 — 이
   스킬은 디자인 규칙이지 기능 변경 권한이 아니다. 이 규격은 현재 승인된 Atlas
   제품 사양이다. 향후 사용자가 규격 변경 또는 다중 규격 지원을 승인하면 관련
   Skill과 `design.md`를 함께 갱신해야 한다.
