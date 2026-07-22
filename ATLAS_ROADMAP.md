# Atlas Roadmap

관련 문서: [`docs/MASTER_ROADMAP.md`](./docs/MASTER_ROADMAP.md) ·
[`docs/MILESTONE_TRACKER.md`](./docs/MILESTONE_TRACKER.md) ·
[`ATLAS_DECISION_LOG.md`](./ATLAS_DECISION_LOG.md)

**역할 구분**: 이 문서는 장기 전략과 Milestone 단위 진행 상태를 한눈에 보는
요약본이다. Phase별 세부 계획, 위험 요소, 완료 기준 같은 세부 운영 기록과
추적은 `docs/MASTER_ROADMAP.md`와 `docs/MILESTONE_TRACKER.md`가 담당한다.
이 문서는 항상 저장소의 실제 상태(특히 main 반영 여부)와 일치해야 한다.

---

## 현재 (완료, main 반영 완료)

- **Milestone 1** — Frontend Modularization (main 반영 완료)
- **Milestone 2** — Thumbnail Studio v1 + Milestone 2.5 Thumbnail Intelligence v1 (main 반영 완료)
- **Milestone 3** — Sales Page Studio v1 (main 반영 완료, PR #5)
- **Milestone 3.1** — Atlas Design System v1 (Brand Pack: Premium / Study Note /
  Handwriting, `APP.brandTheme` 공유 상태) — main 반영 완료
- **Milestone 3.1v4** — Premium SaaS 디자인 리팩토링(좌측 설정/우측 Preview
  sticky 2열 레이아웃, Tab 시스템, Brand Card 강화) — main 반영 완료
- **Milestone 3.2** — Premium Polish(Preview 강조, Brand Card 레이어링,
  테마별 폴리시, 밝은 테마 텍스트 가독성 수정) — main 반영 완료
- **Atlas Constitution** — main 반영 완료
- **Atlas Skill 5종**(business/product/design/coding/qa bible) — main 반영 완료

## 다음 (착수 전)

- **Milestone 3.3** — 범위 미정, 사전 분석 필요

## 미래 (방향성만 확정, 세부 범위는 확정 아님)

- **Milestone 4** — SaaS 서버 인프라(실제 서버 인증, 사용자 계정/DB, API 키
  서버 보관)
- **Milestone 5** — 결제/구독 및 운영 체계
- **Milestone 6** — 정식 출시(모니터링, 온보딩, 고객지원)
- **Milestone 7 이후** — 신규 Studio 확장(Cover Studio, Image Studio,
  Marketing Studio, Writing Studio, Analytics 등) — 구체적 범위는
  `atlas-product-bible`의 Long-term Vision을 따르며, 사용자 요청 없이
  임의로 앞당겨 구현하지 않는다.

---

## 이 로드맵을 읽는 방법

"완료"는 실제로 코드가 작성되고 Playwright로 검증된 것을 의미하며, main에
병합됐는지 여부는 항목마다 별도로 표시한다. "다음"과 "미래"는 확정된
일정이 아니라 우선순위 기반 방향이며, 각 Milestone 착수 전에는 항상 별도
사전 분석과 사용자 승인을 거친다.
