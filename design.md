# Atlas Design Bible v1

## 프로젝트

Atlas AI eBook Studio

이 문서는 디자인 명세만 담는다 — Brand Theme, UI, 컴포넌트, 레이아웃, 디자인
시스템 규칙. Atlas가 왜 존재하는지, 어떤 철학으로 판단하는지는 이 문서의
역할이 아니다. 그 내용은 `ATLAS_CONSTITUTION.md`, `ATLAS_PRODUCT_VISION.md`,
`.claude/skills/atlas-business-bible/SKILL.md`를 참고한다.

---

# Design Principles

## 1. Beautiful by Default

사용자가 디자인를 몰라도
기본값만으로 완성도 높은 결과가 나온다.

복잡한 설정을 강요하지 않는다.

---

## 2. Brand First

모든 화면은

- 전자책
- 썸네일
- 상세페이지
- Export 결과

가 하나의 브랜드처럼 보여야 한다.

UI와 결과물이 서로 다른 디자인이면 안 된다.

---

## 3. Preview First

설정보다

Preview가 중요하다.

항상

Preview가 화면에서 가장 중요한 요소가 되어야 한다.

---

## 4. One Click

클릭 수를 최소화한다.

사용자는

브랜드 하나만 선택하면

폰트

색상

버튼

카드

썸네일

상세페이지

가 자동으로 적용되어야 한다.

---

## 5. Premium SaaS

관리자 페이지처럼 만들지 않는다.

목표 UX

- Canva
- Gamma
- Framer
- Apple

---

# Brand Themes

현재

- Premium
- Study Note
- Handwriting

향후

- Business
- Creator
- Minimal
- Finance
- Healthcare
- Education

---

# Theme Rules

## Premium

느낌

- 고급
- 전문가
- AI
- 투자
- 부업

색상

- Black
- Charcoal
- Gold
- Ivory

폰트

Heading

Noto Serif KR

Body

Pretendard

Accent

Pretendard Bold

금지

- 보라색 버튼
- 네온 효과
- 과도한 Glow

---

## Study Note

느낌

- 공부노트
- 플래너
- 건강
- 자기계발
- 육아

색상

- Ivory
- Beige
- Brown
- Sage
- Yellow

필수 요소

- 줄노트
- Dot Grid
- 포스트잇
- 체크리스트
- 형광펜
- 책갈피

폰트

Heading

Noto Serif KR

Body

Pretendard

Accent

Poor Story

금지

- 다크 카드
- 검정 배경

---

## Handwriting

느낌

- 다이어리
- 루틴
- 감성
- 기록
- 메모

색상

- Warm Ivory
- Dusty Pink
- Warm Brown
- Soft Blue

필수 요소

- 손그림 밑줄
- 마스킹테이프
- 메모
- 스티커
- 손글씨 포인트

폰트

Heading

Noto Serif KR

Body

Pretendard

Accent

Single Day

금지

- 본문 전체 필기체
- 유아용 디자인

---

# Layout Rules

왼쪽

설정

오른쪽

Preview

Preview는
항상 가장 크게 보여야 한다.

---

# Theme Cards

텍스트 버튼 사용 금지.

반드시 카드 형태.

카드 안에는

- 실제 Thumbnail
- 실제 Sales Page
- Font Pair
- Color Palette
- 추천 분야

를 포함한다.

---

# Animation

허용

- Fade
- Hover
- Scale

150~220ms

금지

- Bounce
- 과도한 Glow
- 지속적인 움직임

---

# Typography

본문

Pretendard

기본

필기체는

- Badge
- 메모
- 강조 문구

에만 사용한다.

본문 전체 필기체 금지.

---

# Export Rule

Preview와 Export 결과는 동일해야 한다.

Preview만 예쁘고

Export가 다르면 안 된다.

---

# 개발 규칙

새로운 UI를 만들기 전에

반드시

design.md를 먼저 읽는다.

이 문서와 충돌하는 디자인은 구현하지 않는다.

애매하면

반드시 사용자에게 먼저 질문한다.

임의로 디자인을 변경하지 않는다.
