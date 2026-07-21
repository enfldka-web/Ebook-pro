# Atlas Master Roadmap

> 이 문서는 Atlas 전체 개발 방향과 Phase별 목표를 한눈에 보여주는 최상위 로드맵입니다.
> **확정된 일정표가 아니라 우선순위 기반 계획**이며, 각 Phase의 시작 시점은 이전 Phase의 결과에 따라 조정될 수 있습니다.

관련 문서: [Milestone Tracker](./MILESTONE_TRACKER.md) · [Feature Backlog](./FEATURE_BACKLOG.md) · [Product Vision](./PRODUCT_VISION.md)

---

## 프로젝트 현재 상태

- **현재 단계**: Phase 2 (Sales Asset Creation) 진행 중
- **최신 완료 Milestone**: Milestone 2.5 — Thumbnail Intelligence v1
- **다음 Milestone**: Milestone 3 — Sales Page Studio (사전 분석 예정, 아직 착수하지 않음)
- **현재 제품 형태**: 브라우저에서 직접 Claude API를 호출하는 클라이언트 전용 프로토타입 (서버/DB 없음, 로그인은 로컬 시뮬레이션)
- **목표 제품 형태**: 서버 인증·과금·사용량 관리를 갖춘 SaaS 제품

---

## Phase 1 — Foundation

- **Milestone**: Milestone 1 (Frontend Modularization)
- **상태**: 완료
- **목표**: 단일 `index.html` 4,232줄을 기능 손실 없이 `css/`, `js/` 파일로 물리적 분리
- **주요 산출물**: `css/styles.css`, `js/renderers.js`, `js/application.js`, `js/bootstrap.js`, `docs/ARCHITECTURE.md`
- **완료 기준**: 분리 전후 코드가 diff 상 동일, 기존 기능 전부 회귀 테스트 통과
- **선행 조건**: 없음
- **위험 요소**: 전역 함수/스크립트 로드 순서 의존성 — 실제로 낮은 위험으로 확인되어 완료됨
- **주요 결과**: 원본 script 블록 단위(3분할)로 안전하게 분리, Playwright 회귀 테스트 통과

---

## Phase 2 — Sales Asset Creation

콘텐츠(전자책 본문) 생성 이후, 판매에 필요한 시각 자료(썸네일·상세페이지)를 만들고 개선하는 단계입니다.

- **Milestone 2 — Thumbnail Studio v1**: 완료. 템플릿 8종, 색상/레이아웃/이미지 스타일 선택, Live Preview, Prompt Builder, PNG/JPG Export, 저장/불러오기.
- **Milestone 2.5 — Thumbnail Intelligence v1**: 완료. 결정적 품질 점수, 개선 제안, 규칙 기반 추천, 추천 적용.
- **Milestone 2.6 — Before/After Comparison**: 후보. 착수 여부 미결정.
- **Milestone 3 — Sales Page Studio**: 예정. 사전 분석 전.
  - 제안되는 하위 단계 (확정 아님, Milestone 3 사전 분석에서 재검토):
    - Milestone 3.1: 상세페이지 템플릿/레이아웃 데이터 구조
    - Milestone 3.2: 상세페이지 Live Preview + 문구 편집
    - Milestone 3.3: 상세페이지 PNG 묶음 Export
    - Milestone 3.5(제안): Sales Page Intelligence (Thumbnail Intelligence와 유사한 평가/추천)

| 항목 | 내용 |
|---|---|
| 상태 | 진행 중 |
| 목표 | 전자책 완성 후 판매에 필요한 시각 자산을 한 흐름에서 만들고 개선할 수 있게 함 |
| 주요 산출물 | Thumbnail Studio, Thumbnail Intelligence, (예정) Sales Page Studio |
| 완료 기준 | 결과 화면에서 썸네일과 상세페이지 모두 생성·수정·다운로드 가능, 각 기능에 대한 내부 품질 평가 제공 |
| 선행 조건 | Phase 1 완료 |
| 위험 요소 | 기존 "썸네일+상세페이지"(크몽 4종) 흐름과의 중복/혼선, 신규 기능이 늘어날수록 전역 네임스페이스 관리 부담 증가 |

---

## Phase 3 — Content Quality & Automation

전자책 본문 자체의 품질과 제작 효율을 높이는 단계입니다. 착수 시점 미정.

- 제안 항목 (Feature Backlog에서 우선순위 확정 필요):
  - Prompt Engine 개선 (현재 프롬프트 구조 재검토)
  - 전자책 품질 분석 확장 (현재 Quality Coach 고도화)
  - 한국형 로컬라이징 개선
  - 제목/목차/본문 품질 향상 (Title/Outline Intelligence)

| 항목 | 내용 |
|---|---|
| 상태 | 예정 (착수 전) |
| 목표 | 생성되는 전자책 본문 자체의 품질과 제작 효율 향상 |
| 주요 산출물 | 미정 — Backlog 항목 우선순위 확정 후 결정 |
| 완료 기준 | 미정 |
| 선행 조건 | Phase 2 핵심 기능 안정화 |
| 위험 요소 | 기존 Prompt Engine 변경 시 이미 생성된 프로젝트와의 호환성 |

---

## Phase 4 — SaaS Infrastructure

현재 클라이언트 전용 구조를 실제 서버 기반 SaaS로 전환하는 단계입니다. 착수 시점 미정.

- 제안 항목:
  - 실제 서버 인증 (현재는 브라우저 localStorage 기반 로그인 시뮬레이션)
  - 사용자 계정 및 데이터베이스
  - 서버 API 도입
  - API Key 서버 보관 (현재는 사용자가 자신의 Anthropic API 키를 브라우저에 직접 저장)
  - 사용량 제한 로직 실제 적용 (현재 `canGenerate()`는 항상 true 반환)
  - Trial/Pro 권한 체계 실제 구현

| 항목 | 내용 |
|---|---|
| 상태 | 예정 (착수 전) |
| 목표 | 클라이언트 전용 프로토타입을 서버 기반 다중 사용자 구조로 전환 |
| 주요 산출물 | 인증 서버, 사용자 DB, API 프록시 서버 |
| 완료 기준 | 로그인이 실제 서버 세션 기반으로 동작, API 키가 클라이언트에 노출되지 않음 |
| 선행 조건 | Phase 2·3의 핵심 기능이 안정화되어 재작업 범위가 명확할 것 |
| 위험 요소 | 이번 Phase는 기존 아키텍처(전역 상태, localStorage 기반 저장)에 대한 대규모 재작업을 수반함 — 별도의 상세 계획과 사용자 승인 필요 |

---

## Phase 5 — Billing & Operations

| 항목 | 내용 |
|---|---|
| 상태 | 예정 (착수 전) |
| 목표 | 실제 결제/구독 기반 운영 체계 구축 |
| 주요 산출물 | 결제 연동, 구독 관리, 관리자 Dashboard, 사용량 추적, 환불 프로세스, 이용약관/개인정보처리방침 |
| 완료 기준 | 미정 |
| 선행 조건 | Phase 4 완료 (서버 인증·계정 체계 필요) |
| 위험 요소 | 법적/정책적 검토 필요(약관, 결제 규정), 이 프로젝트 범위를 벗어나는 별도 검토 필요 |

## Phase 6 — Public Launch

| 항목 | 내용 |
|---|---|
| 상태 | 예정 (착수 전) |
| 목표 | 일반 사용자 대상 정식 출시 |
| 주요 산출물 | 배포 파이프라인, 모니터링, 오류 추적, 온보딩 플로우, 고객지원 채널, 출시 전 QA |
| 완료 기준 | 미정 |
| 선행 조건 | Phase 4·5 완료 |
| 위험 요소 | 트래픽/보안/장애 대응 체계 부재 — 이 문서 작성 시점 기준 전혀 준비되지 않음 |

---

## 이 로드맵을 읽는 방법

- "완료"는 실제로 코드가 병합되고 Playwright로 검증된 항목만을 의미합니다.
- Phase 3~6은 **아직 사전 분석조차 시작하지 않은 예정 단계**이며, 나열된 하위 항목은 방향성 제안일 뿐 확정된 작업 목록이 아닙니다.
- 각 Milestone 착수 전에는 항상 별도의 사전 분석 보고서를 작성하고 승인을 받습니다(지금까지의 Milestone 1·2·2.5와 동일한 절차).
