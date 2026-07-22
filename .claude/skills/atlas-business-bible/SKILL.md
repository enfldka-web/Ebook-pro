---
name: atlas-business-bible
description: >
  Atlas AI eBook Studio의 최상위 비즈니스 철학. "무엇을 만드는가"가 아니라
  "왜 만드는가"를 정의하며, atlas-product-bible/atlas-design-bible/
  atlas-coding-bible/atlas-qa-bible보다 먼저 참조되어야 하는 근본 기준이다.
  Atlas의 목적은 예쁜 UI나 전자책 생성기가 아니라 사용자가 가장 빠르게 판매
  가능한 디지털 상품을 만들고 실제로 판매하도록 돕는 것이다. "이 기능이
  판매 성공률을 높이는가?"가 모든 판단의 첫 질문이다. Atlas는 브랜드가 아니라
  사용자의 브랜드를 만드는 플랫폼이며, Atlas UI는 절제되고 사용자의 결과물
  (전자책·썸네일·상세페이지)이 항상 화면의 주인공이어야 한다(Atlas는 무대가
  아니라 조명). Product Experience는 화면이 아니라 아이디어→자료준비→전자책
  생성→썸네일 생성→상세페이지 생성→최종 검토→판매 시작→판매 후 개선으로
  이어지는 사용자의 전체 비즈니스 여정이다. Brand Pack(Premium/Study Note/
  Handwriting)은 색상 테마가 아니라 Brand Strategy(고가 정당화/신뢰 구축/팬
  만들기)다. Visual Identity는 Product→Brand→Visual 순서의 마지막 결과여야
  하며 출발점이 되면 안 된다. 새 기능 제안, 우선순위 판단, 로드맵 논의, Brand
  Pack의 의미 논의, UI가 사용자 결과물보다 튀는지 판단할 때 — 그리고 다른 어떤
  Atlas 판단을 내리기 전이라도 — 언급 없이도 가장 먼저 참조한다. 구체적 제품
  정의는 `atlas-product-bible`, 디자인 규칙은 `atlas-design-bible`, 개발
  절차는 `atlas-coding-bible`, 품질 검증은 `atlas-qa-bible`을 따른다. 없는
  판단이 필요하거나 지시와 충돌하면 추측하지 말고 먼저 질문한다.
---

# Atlas Business Bible

## 이 스킬의 위치
`atlas-product-bible`이 "무엇을 만들 것인가"를 정의한다면, 이 스킬은 **"왜
그것을 만드는가"**를 정의한다. 이 스킬은 다른 모든 Atlas Skill보다 먼저
참조되어야 하며, Product/Design/Coding/QA의 모든 판단 기준이 된다.

판단 순서:
```
atlas-business-bible   (왜)
        ↓
atlas-product-bible    (무엇을)
        ↓
atlas-design-bible     (어떻게 보이게)
        ↓
atlas-coding-bible     (어떻게 안전하게 구현)
        ↓
atlas-qa-bible         (실제로 통과했는가)
```

## Atlas의 존재 이유
Atlas의 목적은 예쁜 UI를 만드는 것이 아니다. 전자책 생성기가 되는 것도 아니다.

**Atlas의 목적은 사용자가 가장 빠르게 판매 가능한 디지털 상품을 만들고 실제로
판매하도록 돕는 것이다.**

모든 기능은 "이 기능이 사용자의 판매 성공률을 높이는가?"를 가장 먼저 질문해야
한다. 판매 성공률을 높이지 못하는 기능은 아무리 예쁘고 완성도가 높아도
우선순위가 아니다.

## Atlas는 무대가 아니라 조명이다
Atlas는 브랜드가 아니다. Atlas는 **사용자의 브랜드를 만드는 플랫폼**이다.

Atlas 자신의 브랜드는 항상 절제되어야 한다. 사용자가 만든 전자책, 썸네일,
상세페이지 — 이 세 가지가 항상 화면의 주인공이어야 한다. Atlas는 무대가
아니라 조명이다. 배우는 Atlas가 아니라 사용자가 만든 결과물이다.

## Product Experience는 화면이 아니라 여정이다
Product Experience는 UI 흐름이 아니라 **사용자의 비즈니스 경험**이다. 항상
아래 전체 여정을 기준으로 판단한다.

```
아이디어 → 자료 준비 → 전자책 생성 → 썸네일 생성
→ 상세페이지 생성 → 최종 검토 → 판매 시작 → 판매 후 개선
```

Studio(Thumbnail Studio, Sales Page Studio 등)는 목적이 아니라 이 여정을 위한
**도구**일 뿐이다. 어떤 기능/화면을 설계하든, 그것이 이 여정 전체에서 어느
지점에 있는지, 그 지점의 목적에 실제로 복무하는지를 먼저 확인한다.

## Brand Pack은 디자인 테마가 아니라 Brand Strategy다
Brand Pack은 색상을 선택하는 기능이 아니라 **판매 전략을 선택하는 기능**이다.

- **Premium** = 높은 가격을 정당화하는 브랜드
- **Study Note** = 신뢰를 쌓아 구매를 만드는 브랜드
- **Handwriting** = 팬을 만들고 재구매를 만드는 브랜드

각 Brand Pack의 색/폰트/장식 같은 구체적 구현 규칙은 `atlas-design-bible`이
관리하지만, 그 규칙들이 왜 존재하는지 — 어떤 판매 심리를 위해 설계됐는지 —
는 이 스킬이 정의한다.

## Visual Identity는 항상 마지막 결과다
Visual Identity(색, 레이아웃, 카피톤, 인터랙션)는 Product Experience와 Brand
Strategy가 먼저 정해진 뒤에 나오는 **결과**여야 한다. Visual Identity 때문에
Product Experience가 바뀌면 안 된다.

```
Product Experience → Brand Strategy → Visual Identity
```

이 순서를 절대 바꾸지 않는다. "일단 예쁘게 만들고 나중에 의미를 붙이는" 접근은
Atlas의 철학과 반대다.

## 모든 기능 제안/구현 전에 던지는 5가지 질문
새로운 기능을 제안하거나 구현하기 전에 항상 아래를 먼저 확인한다.

1. 사용자의 판매 성공률을 높이는가?
2. 사용자의 결과물이 더 돋보이는가?
3. Atlas가 아니라 사용자의 브랜드가 더 강해지는가?
4. 사용자의 시간을 줄여주는가?
5. 판매까지의 단계를 줄여주는가?

위 질문 중 하나라도 "아니오"라면 그 기능은 다시 검토한다. 구체적인 기능
우선순위 판단(디자인 품질, 기존 UX 보존, 로드맵 정합성 등 더 세부적인 기준)은
`atlas-product-bible`의 Decision Rule을 따르되, 그 전에 이 5가지 질문을 먼저
통과해야 한다.

## 이 스킬에 담지 않는 것
이 스킬은 변하지 않는 비즈니스 철학만 담는다. 아래는 절대 이 스킬에 포함하지
않으며, 각각 해당 Skill/문서가 관리한다.

- 현재 구현 상태, 마일스톤, 버그 → `docs/` 및 각 작업의 완료 보고서
- 구체적 제품 정의, 목표 사용자, 기능 우선순위 세부 기준 → `atlas-product-bible`
- 색상값, 폰트, 레이아웃, 애니메이션, Export 규격 등 디자인 규칙 →
  `atlas-design-bible`
- Git 규칙, Phase 개발, 코드 구현 방식 → `atlas-coding-bible`
- QA 절차, 테스트 방법, 완료 보고 형식 → `atlas-qa-bible`
- UI, 파일명, 함수명, 기술 구현 세부사항 → 해당 코드/문서

## 관련 스킬
- **`atlas-business-bible`(이 스킬)** — 왜 만드는가 (최상위 철학)
- **`atlas-product-bible`** — 무엇을 만들 것인가
- **`atlas-design-bible`** — 어떻게 보여야 하는가
- **`atlas-coding-bible`** — 어떻게 안전하게 구현할까
- **`atlas-qa-bible`** — 실제로 통과했는가

다섯 스킬은 서로 대체하지 않는다. 항상 이 스킬을 가장 먼저 참조하고, 그 다음
나머지 네 스킬을 순서대로 적용한다.
