# Atlas AI Engine Specification (v2 FINAL)

관련 문서: [`ATLAS_CONSTITUTION.md`](../ATLAS_CONSTITUTION.md) ·
[`.claude/skills/atlas-business-bible/SKILL.md`](../.claude/skills/atlas-business-bible/SKILL.md) ·
[`.claude/skills/atlas-product-bible/SKILL.md`](../.claude/skills/atlas-product-bible/SKILL.md) ·
[`.claude/skills/atlas-design-bible/SKILL.md`](../.claude/skills/atlas-design-bible/SKILL.md) ·
[`.claude/skills/atlas-coding-bible/SKILL.md`](../.claude/skills/atlas-coding-bible/SKILL.md) ·
[`.claude/skills/atlas-qa-bible/SKILL.md`](../.claude/skills/atlas-qa-bible/SKILL.md)

**역할 구분**: 이 문서는 Atlas의 AI가 "무엇을, 왜, 어떤 순서로" 판단하는지를
정의하는 내부 Decision Engine(두뇌) 명세다. `atlas-business-bible`이
"왜"(판매 전략의 근거)를, `atlas-product-bible`이 "무엇을"(기능 범위)을,
`atlas-design-bible`이 "어떻게 보이게"를 담당한다면, 이 문서는 그 세 판단이
실제로 AI 내부에서 어떤 파이프라인과 규칙으로 실행되는지를 담당한다.

**문서 위치(읽는 순서)**: `ATLAS_CONSTITUTION` → `atlas-business-bible` →
`atlas-product-bible` → `atlas-design-bible` → Engine 2.0 Market
Research(근거) → **이 문서(AI가 어떻게, 그리고 왜 판단하는가)** →
`atlas-coding-bible` / `atlas-qa-bible`

**버전 상태**: v2 FINAL — 2026-07-23 기준으로 구조 확정. 이후 확장은
새 문서 생성이 아니라 이 문서의 개정으로만 이루어진다.

---

## 1. Engine Architecture (FINAL)

```
입력(주제/PLR/파일/URL/유튜브)
      ↓
상품 분석 → 시장 분석 → 타겟 분석
      ↓
Brand Strategy Engine ──Reason()──▶ [Reasoning Service]
      ↓
AI Planner
      ↓
사용자 승인
      ↓
Brand Profile 생성
      ↓
Marketing Copy Engine ──Reason()──▶ [Reasoning Service]
      ↓
Thumbnail Engine ──Reason()──▶ [Reasoning Service]
      ↓
Sales Page Engine ──Reason()──▶ [Reasoning Service]
      ↓
Pre Generation Quality Check
      ↓
Generation
      ↓
Post Generation Quality Check ──Reason()──▶ [Reasoning Service]
      ↓
Self Review
      ↓
Learning Engine (Session Memory)
      ↓
Export
```

Brand Profile은 Atlas 전체에서 가장 중요한 Domain Object다. 모든 Engine은
Brand Profile을 공유하지만, 오직 하나의 단계(Brand Profile 생성)만 이
객체를 만들 수 있다. 이 규칙은 Atlas의 일관성, 확장성, 예측 가능성을
보장하는 핵심 아키텍처 원칙이다.

---

## 2. Brand Strategy Engine

| 항목 | 내용 |
|---|---|
| 역할 | 상품/시장/타겟 분석 결과를 바탕으로 세 가지 판매 전략(Authority/Trust/Relationship) 중 하나를 판단한다 |
| 입력 | 상품 분석, 시장 분석, 타겟 분석 결과 |
| 출력 | 판단된 Brand Strategy + Reasoning Service에 전달할 근거 |
| 참조 문서 | `atlas-business-bible`(전략 정의), Engine 2.0 Market Research(Cialdini 근거) |
| 실패 시 행동 | 판단 confidence가 임계값 미만이면 단독 확정하지 않고 AI Planner로 넘겨 사용자에게 후보를 제시한다 |
| 책임 경계 | 색상, 폰트, 카피 문구는 절대 이 단계에서 결정하지 않는다. 오직 전략(Authority/Trust/Relationship)만 결정한다 |

**Brand Strategy → Brand Pack 매핑**

| Brand Strategy | Brand Pack |
|---|---|
| Authority (고가 정당화) | Premium |
| Trust (신뢰 구축) | Study Note |
| Relationship (팬 만들기) | Handwriting |

---

## 3. Reasoning Service

Reasoning Service는 파이프라인의 한 단계가 아니라, 여러 Engine이
`Reason()` 호출을 통해 사용하는 **교차 서비스(cross-cutting service)**다.

- **호출 주체**: Brand Strategy Engine, Marketing Copy Engine, Thumbnail
  Engine, Sales Page Engine, Post Generation Quality Check
- **기록 형식**: 구조화된 Reason 객체 — Brand Strategy Reason, Marketing
  Copy Reason, Thumbnail Pattern Reason, Sales Page Structure Reason,
  Quality Score Reason
- **설명 방식**: 반드시 `BrandProfile.*` 속성을 인용해서 설명한다(예:
  "BrandProfile의 ctaTone이 Authority이기 때문에"). Brand Pack 이름
  ("Premium이라서")으로 설명하지 않는다.
- **하지 않는 일**: 새로운 판단을 하지 않는다. 점수를 매기지 않는다.
  콘텐츠를 생성하지 않는다. Brand Profile을 수정하지 않는다. 오직 이미
  내려진 판단을 기록하고 설명한다.
- **Explainable AI 원칙**: Atlas는 항상 "왜 Premium인가", "왜 Pattern
  B인가", "왜 FAQ를 줄였는가", "왜 CTA를 바꿨는가"에 답할 수 있어야 한다.

---

## 4. AI Planner

AI Planner는 Brand Strategy Engine의 판단이 실제 생성 단계로 넘어가기 전에
거치는 **필수 승인 게이트**다.

**Planner Report 형식**

1. 상품 추천 요약
2. 판매 전략
3. Brand Pack 추천 — 이유 출처: Reasoning Service
4. FAQ 전략 요약
5. CTA 전략 요약
6. 추천 Thumbnail Pattern
7. 추천 Sales Page 구조
8. 주의사항

- **High confidence**: 원클릭 승인 UI 제공
- **Low confidence**: 2개 후보를 제시하고 사용자가 선택
- **거절/수정**: Brand Strategy Engine으로 되돌아가 재판단한다
- AI Planner는 자체적으로 설명을 만들지 않는다. 모든 근거 설명은
  Reasoning Service를 인용한다.

---

## 5. Brand Profile 생성

기존 "Brand Pack 결정" 단계는 "Brand Profile 생성"으로 명칭을 변경한다.

- 사용자가 승인한 전략을 하나의 객체(Brand Profile)로 패키징하는 단계다.
- 이 단계는 새로운 AI 판단을 하지 않는다. 순수 패키징(packaging)이다.
- Implementation Readiness: **READY**

### Brand Profile 스키마 (11개 필드)

| 필드 | 설명 |
|---|---|
| `brandPackId` | Brand Pack 식별자(premium / study-note / handwriting) |
| `brandStrategy` | Authority / Trust / Relationship |
| `badgeTone` | 배지 문구 톤 |
| `headlineTone` | 헤드라인 톤 |
| `ctaTone` | CTA 문구 톤 |
| `faqStyle` | FAQ 구성 방식 |
| `socialProofStyle` | 사회적 증거 표현 방식 |
| `informationDensity` | 정보 밀도(높음/중간/낮음) |
| `layoutPreference` | 레이아웃 선호(숫자중심/아이콘중심/목업중심/텍스트중심) |
| `thumbnailPattern` | 추천 썸네일 패턴 |
| `salesPagePreference` | 상세페이지 섹션 강조 우선순위 |

### Brand Pack별 기본값

| 필드 | Premium (Authority) | Study Note (Trust) | Handwriting (Relationship) |
|---|---|---|---|
| brandStrategy | Authority | Trust | Relationship |
| badgeTone | 권위/한정 | 신뢰/근거 | 친근/공감 |
| headlineTone | 단정적/전문가 톤 | 설명적/근거 제시 톤 | 대화체/친근 톤 |
| ctaTone | 자신감 있는 명령형 | 안심시키는 제안형 | 다정한 권유형 |
| faqStyle | 반박 대응 중심 | 근거/출처 중심 | 공감/후기 중심 |
| socialProofStyle | 숫자/권위자 인용 | 데이터/스크린샷 | 실사용 후기/스토리 |
| informationDensity | 높음 | 중간 | 낮음 |
| layoutPreference | 숫자중심 | 텍스트중심 | 목업중심 |
| thumbnailPattern | 비교형/숫자형 | 아이콘형 | 좌우이미지형 |
| salesPagePreference | Authority/Solution 강조 | FAQ/Social Proof 강조 | Hero/Benefits 강조 |

### Brand Profile Immutable Rule

- Brand Profile은 생성된 이후 **절대 수정되지 않는다.**
- 전략을 바꿔야 한다면, Brand Strategy Engine → Reasoning Service → AI
  Planner → 사용자 승인 → **새로운** Brand Profile 생성이라는 전체
  사이클을 처음부터 다시 거쳐야 한다.
- 아래 모든 소비 Engine은 Brand Profile에 대해 **Read-Only**다:
  Marketing Copy Engine, Thumbnail Engine, Sales Page Engine, Pre
  Generation Quality Check, Post Generation Quality Check, Self Review,
  Learning Engine

### Brand Profile Single Source of Truth (Implementation Notes)

- 모든 소비 Engine은 오직 이 하나의 Brand Profile 객체만 참조한다.
- 어떤 Engine도 Brand Pack 이름으로 분기(branching)하지 않는다. 오직
  `BrandProfile.*` 속성만으로 판단한다.
- 어떤 Engine도 내부적으로 Brand Profile을 새로 만들거나 수정하지 않는다.
- 항상 동일한 공유 인스턴스를 참조한다.

---

## 6. Marketing Copy Engine

- Thumbnail Engine과 Sales Page Engine이 공통으로 사용할 카피 자산 풀을
  생성한다: Headline, Hook, CTA, Badge, FAQ, Benefit, Scarcity, Urgency,
  Trust
- 파이프라인 상 Thumbnail Engine/Sales Page Engine보다 **먼저** 실행된다.
- **하드 규칙**: Scarcity/Urgency/Trust 문구는 실제 근거(evidence) 없이
  임의로 만들어내지 않는다. 근거가 없으면 해당 슬롯은 비워둔다.
- `BrandProfile.*` 속성(badgeTone, headlineTone, ctaTone, faqStyle,
  socialProofStyle)만 참조하여 톤을 결정한다.

---

## 7. Thumbnail Engine

**결정 순서**: Pattern → Hook/Badge → title/subtitle → CTA → 숫자 →
색상 → 이미지 스타일 → 여백(whitespace) 검증

- 오직 `BrandProfile.*` 속성만 참조한다. Brand Pack 이름으로 분기하지
  않는다.
- **Pattern 선택 규칙**(변경 없음): 숫자중심(number-focus), 비교형
  (comparison), 아이콘중심(icon-focus), 좌우이미지형
  (left-right-image), 중앙텍스트형(center-text)

---

## 8. Sales Page Engine

**고정 섹션 순서**: Hero → Problem → Authority/Solution → Benefits →
Social Proof → FAQ → CTA

- 섹션 순서는 고정이며, `BrandProfile.*` 속성에 따라 각 섹션의 강조/비중만
  조정한다.
- Thumbnail Engine과 동일하게 오직 `BrandProfile.*` 속성만 참조한다.

---

## 9. Layout Decision Engine (공용)

Thumbnail Engine과 Sales Page Engine이 공용으로 사용하는 레이아웃 선택
로직이다.

- 숫자중심(number-centric)
- 아이콘중심(icon-centric)
- 목업중심(mockup-centric)
- 텍스트중심(text-centric)

선택 조건은 `BrandProfile.layoutPreference`를 기준으로 한다.

---

## 10. Pre Generation Quality Check

실제 렌더링 이전, **계획(plan) 단계**에서 이진(binary) 하드 규칙을
검사한다.

- 제목이 2줄을 초과하는가
- FAQ가 최소 개수 미만인가
- CTA 동사가 전략과 불일치하는가
- Brand 색상/폰트 충돌이 있는가
- Trust/Scarcity 문구에 근거가 없는가

발견 시 자동 보정하거나 생성을 차단한다. 점수를 매기지 않는다.

---

## 11. Generation

순수 렌더링 실행 단계다. 새로운 판단을 하지 않는다.

---

## 12. Post Generation Quality Check

실제로 생성된 결과물을 대상으로 점수를 매긴다: 가독성, 판매력, Brand
일관성, 신뢰도, 시선 흐름, CTA 일관성, 정보 밀도

- 낮은 점수가 나온 경우 반드시 Reasoning Service를 통해
  `BrandProfile.*` 기반 근거를 함께 제시해야 한다.

---

## 13. Self Review

Post Generation Quality Check가 개별 결과물 각각을 점수화하는 것과
달리, Self Review는 결과물 간 **교차 일관성**을 이진 체크리스트로
검사한다.

- Brand Pack이 전체에 일관되게 적용되었는가
- Thumbnail과 Sales Page가 서로 약속한 내용이 일치하는가
- CTA가 일관되는가
- FAQ 최소 기준을 충족하는가
- Trust/Social Proof 문구가 정직한가(근거 없이 과장하지 않았는가)
- Export 스펙이 정확한가

---

## 14. Learning Engine (Session Memory 범위)

**현재 범위(Session Memory만)**:

- 같은 프로젝트/세션 내에서 사용자의 override 선택을 기억한다.
- Reasoning과 결과를 함께 저장한다.

**명시적으로 제외되는 범위** (Milestone 5+ 이후로만 언급, 현재 상세 설계
없음):

- CTR(클릭률) 추적
- 전역/세션 간/다중 사용자 학습
- 자동 최적화
- 자동 가중치 조정

---

## 15. Export

- 규격은 변경 없음: Thumbnail 652×488(4:3), Sales Page 1080×1350
- Preview == Export 원칙 유지
- 순수 렌더링이며 어떤 판단도 하지 않는다

---

## 16. Responsibility Matrix

| Engine | 전략결정 | Brand Profile 생성 | Brand Profile 수정 | 카피생성 | 레이아웃결정 | 채점 | 학습 | 근거기록 |
|---|---|---|---|---|---|---|---|---|
| Brand Strategy Engine | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(Reason 요청) |
| AI Planner | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌(Reasoning Service 인용만) |
| Brand Profile 생성 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Marketing Copy Engine | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅(Reason 요청) |
| Thumbnail Engine | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅(Reason 요청) |
| Sales Page Engine | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅(Reason 요청) |
| Pre Generation Quality Check | ❌ | ❌ | ❌ | ❌ | ❌ | ❌(binary 검사만) | ❌ | ❌ |
| Generation | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Post Generation Quality Check | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅(Reason 요청) |
| Self Review | ❌ | ❌ | ❌ | ❌ | ❌ | ❌(binary 체크리스트) | ❌ | ❌ |
| Learning Engine | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(Session Memory만) | ❌ |
| Reasoning Service | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅(기록/설명 전담) |

Brand Profile 수정 열은 모든 행에서 ❌다. Brand Profile 생성 단계 자신도
생성 이후에는 수정 권한이 없다. 변경이 필요하면 항상 새 Brand Profile을
새로 생성한다.

---

## 17. Implementation Readiness

| Engine | 상태 | 비고 |
|---|---|---|
| Brand Strategy Engine | PARTIAL | 전략 판단 로직은 있으나 confidence 임계값 기준 미구현 |
| AI Planner | NOT READY | Planner Report UI/승인 플로우 미구현 |
| Brand Profile 생성 | READY | 순수 패키징 단계로 즉시 구현 가능 |
| Marketing Copy Engine | PARTIAL | 카피 자산 풀 구조는 정의됐으나 Scarcity/Urgency 근거 검증 로직 미구현 |
| Thumbnail Engine | PARTIAL | Pattern 로직은 기존 Thumbnail Intelligence v1에 있으나 BrandProfile 참조로 전환 필요 |
| Sales Page Engine | PARTIAL | 섹션 구조는 있으나 BrandProfile 기반 강조 조정 미구현 |
| Quality Engine (Pre/Post) | PARTIAL | Post 채점 기준 일부 존재, Pre 단계 하드 규칙 미구현 |
| Learning Engine | NOT READY (의도적) | Session Memory 범위조차 아직 구현 시작 전, 의도적으로 후순위 |

---

## 18. Implementation Guideline

**구현 순서(항상 앞에서 뒤로만, 역순 추론 금지)**:

```
Product → Strategy → Brand Profile → Marketing Copy → Thumbnail / Sales Page → Export
```

- 이 순서를 거꾸로 추론해서 구현하지 않는다(예: Thumbnail 먼저 만들고
  Brand Profile을 나중에 끼워 맞추지 않는다).
- 각 단계는 반드시 이전 단계의 출력을 입력으로 사용한다.
- 각 단계는 자신의 입력을 재해석해서 새로운 전략을 만들지 않는다.
- 각 단계는 상위 단계의 판단을 임의로 변경하지 않는다.
- 각 단계는 하위 단계의 역할을 대신 수행하지 않는다.

**Implementation Rules (공통 4원칙)**:

1. 입력을 그대로 소비한다(consume input) — 재해석하지 않는다.
2. 새로운 전략을 발명하지 않는다 — Brand Strategy Engine만 전략을 정한다.
3. 상위 단계의 결정을 변경하지 않는다 — 특히 Brand Profile은 불변이다.
4. 하위 단계의 역할을 대신하지 않는다 — 각 Engine은 자신의 책임 경계
   안에서만 판단한다.

---

*이 문서는 Atlas AI Engine Specification v2의 최종 확정본이다. 이후
확장이나 수정은 새 문서 생성이 아니라 이 문서의 개정으로만 이루어진다.*
