# Atlas Decision Log

모든 큰 결정은 이 문서 하나에만 기록한다. 각 항목은 **Decision / Reason /
Expected Effect** 형식을 따른다. 날짜 순서대로 아래에 추가한다.

---

## 1. Atlas Design System v1 도입 (Brand Pack: Premium / Study Note / Handwriting)

**Decision**: 사용자가 브랜드 하나를 고르면 전자책·썸네일·상세페이지에 동시에
적용되는 Brand Pack 시스템(Premium/Study Note/Handwriting)을 도입한다.

**Reason**: 디자인 지식이 없는 사용자도 클릭 한 번으로 일관된 브랜드를 가진
결과물을 만들 수 있어야 한다(Product Principle "클릭은 최소, 완성도는 최대").

**Expected Effect**: Thumbnail Studio와 Sales Page Studio가 서로 다른 화면이
아니라 하나의 브랜드로 묶여 보인다.

---

## 2. Brand Pack을 색상 테마가 아니라 Brand Strategy로 재정의

**Decision**: Premium/Study Note/Handwriting을 "색상 테마"가 아니라 각각
"고가 정당화 / 신뢰 구축 / 팬 만들기"라는 판매 전략으로 재정의한다.

**Reason**: Atlas가 기억되어야 하는 이유는 색이나 그라데이션이 아니라 "5분
만에 판매 가능한 상품이 나온다"는 경험이어야 하며, Brand Pack 선택은 색상
선택이 아니라 판매 전략 선택이어야 한다.

**Expected Effect**: Theme Card가 "이 브랜드를 고르면 어떻게 팔리는가"를
보여주는 판매 전략 카드로 기능한다.

---

## 3. ATLAS_CONSTITUTION.md 도입

**Decision**: Skill보다 상위에, 절대 변하지 않는 Atlas의 존재 이유만 담는
Constitution을 별도 문서로 분리한다.

**Reason**: Business Bible을 포함한 모든 Skill도 결국 더 근본적인 하나의
기준으로 수렴해야 하며, 그 기준은 Skill이 아니라 문서 형태로 고정되어야
한다.

**Expected Effect**: 어떤 Skill/문서가 서로 어긋나 보일 때 되돌아갈 단 하나의
최종 기준이 생긴다.

---

## 4. atlas-business-bible / product-bible / design-bible / coding-bible / qa-bible 5개 Skill 체계 도입

**Decision**: "왜 만드는가 → 무엇을 만들 것인가 → 어떻게 보여야 하는가 →
어떻게 구현하는가 → 무엇을 검증하는가" 순서로 판단하는 5개 Skill 체계를
도입한다.

**Reason**: Atlas는 수개월간 이어지는 장기 프로젝트라 세션이 바뀌어도 항상
같은 기준으로 판단해야 하며, 매번 같은 맥락을 프롬프트로 반복 설명하지
않아야 한다.

**Expected Effect**: 새 세션에서도 Skill 호출만으로 이전과 동일한 기준이
자동으로 적용된다.

---

## 5. M3.1v4 Premium SaaS 디자인 리팩토링

**Decision**: 좌측 설정 / 우측 Preview의 sticky 2열 레이아웃과 Tab 시스템,
강화된 Brand Card로 Thumbnail Studio·Sales Page Studio를 리팩토링한다.

**Reason**: 기존 "설정→설정→설정→미리보기" 세로 스택 구조가 개발자 도구
느낌을 줬고, Preview가 화면의 중심이 되지 못했다(Constitution Article 5
Product First 위반 상태였음).

**Expected Effect**: Preview가 항상 보이는 상태로 작업하며, Canva/Gamma/
Framer/Apple 수준의 UX 완성도를 갖춘다.

---

## 6. M3.2 Premium Polish + 밝은 테마 텍스트 가독성 수정

**Decision**: Preview 강조, Brand Card 레이어링, 테마별 폴리시(Study Note
스프링 제본, Handwriting 다이어리 디테일)를 추가하고, QA 중 발견한 밝은
테마 텍스트 가독성 버그를 수정한다.

**Reason**: QA 과정에서 Study Note/Handwriting처럼 밝은 배경의 Brand Pack에
다크 UI 기본 색상이 그대로 남아 카드 제목·태그라인 등 텍스트가 거의 보이지
않는 버그가 발견됐다.

**Expected Effect**: 모든 Brand Pack에서 텍스트 가독성이 확보되고, Brand
Card/Preview의 시각적 완성도가 높아진다.

---

## 7. Atlas 운영 문서 체계를 6개 루트 문서 + 5개 Skill로 최종 확정

**Decision**: 프로젝트 루트 문서를 `ATLAS_PRD.md`, `ATLAS_CONSTITUTION.md`,
`ATLAS_PRODUCT_VISION.md`, `ATLAS_ROADMAP.md`, `ATLAS_DECISION_LOG.md`,
`design.md` 6개로, `.claude/skills/`를 5개 Bible Skill로 확정하고 이후
새로운 운영 문서를 추가하지 않는다.

**Reason**: 문서가 여러 곳에 분산되면 어느 문서가 최종 기준인지 혼란이
생긴다. 목표는 문서를 많이 만드는 것이 아니라 최소 개수로 최대한 명확한
구조를 만드는 것이다.

**Expected Effect**: 누구든 `ATLAS_PRD.md` 하나만 열어도 정해진 순서대로
전체 판단 체계를 파악할 수 있고, 이후 작업은 새 문서 생성이 아니라 기존
문서의 확장·개선만으로 이어진다.
