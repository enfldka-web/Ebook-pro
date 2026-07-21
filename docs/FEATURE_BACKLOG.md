# Atlas Feature Backlog

관련 문서: [Master Roadmap](./MASTER_ROADMAP.md) · [Milestone Tracker](./MILESTONE_TRACKER.md)

## 운영 규칙

- 기능 아이디어는 즉시 개발하지 않고 먼저 이 Backlog에 기록합니다.
- 범위와 완료 기준이 없는 항목은 개발을 시작하지 않습니다.
- 현재 진행 중인 Milestone과 무관한 기능을 즉시 추가하지 않습니다.
- 우선순위는 사용자 가치, 기술 위험, 선행 조건을 기준으로 판단합니다.

## 우선순위 기준

- **P0**: 출시 또는 데이터 안전에 필수
- **P1**: 핵심 제품 가치
- **P2**: 중요 개선
- **P3**: 장기 후보 (현재 방향과 직접 관련 없거나 시기상조)

## 상태 기준

- 제안 / 분석 필요 / 승인 / 진행 중 / 완료 / 보류 / 제외

---

| ID | 기능명 | 설명 | 사용자 가치 | 우선순위 | 상태 | 선행 조건 | 목표 Milestone | 메모 |
|---|---|---|---|---|---|---|---|---|
| BL-001 | Sales Page Studio v1 | 상세페이지 전용 편집 화면 신설 | 판매 준비 자료를 한 화면에서 완성 | P1 | 분석 필요 | Thumbnail Studio 패턴 재사용 가능성 검토 | Milestone 3 | 다음 사전 분석 대상 |
| BL-002 | Sales Page Live Preview | 상세페이지 실시간 미리보기 | 즉시 결과 확인 | P1 | 분석 필요 | BL-001 | Milestone 3 | Thumbnail Studio의 Live Preview 패턴 참고 |
| BL-003 | 상세페이지 템플릿 | 상세페이지용 레이아웃/템플릿 데이터 | 다양한 스타일 선택 | P1 | 제안 | BL-001 | Milestone 3 | 템플릿 개수는 Milestone 3 사전 분석에서 결정 |
| BL-004 | 상세페이지 PNG 묶음 Export | 카드뉴스형 상세페이지를 이미지 묶음으로 다운로드 | 플랫폼 등록 편의성 | P2 | 제안 | BL-001, BL-002 | Milestone 3 | 기존 `dlAllSlides`(크몽 엔진) 재사용 가능성 검토 |
| BL-005 | 상세페이지 문구 편집 | 상세페이지 텍스트 직접 수정 | 결과 커스터마이징 | P1 | 제안 | BL-001 | Milestone 3 | Thumbnail Text Builder 패턴 참고 |
| BL-006 | Thumbnail Before/After | 추천 적용 전/후 비교 화면 | 개선 효과를 시각적으로 확인 | P2 | 후보 (Milestone 2.6) | Thumbnail Intelligence 완료(완료됨) | Milestone 2.6 | 상태는 [Milestone Tracker](./MILESTONE_TRACKER.md) 참고 |
| BL-007 | 실제 Claude Hook 추천 | Hook Generator/Intelligence를 실제 Claude API 기반으로 전환 | 더 정교한 추천 | P1 | 제안 | API 키 서버 보관 여부 결정(BL-018) 또는 클라이언트 키 사용 유지 결정 | 미정 | 현재는 규칙 기반(fallback)만 존재 |
| BL-008 | 실제 이미지 생성 API | AI 이미지 생성 API 연동 | 실제 이미지 포함 썸네일/상세페이지 | P2 | 제안 | 비용/정책 검토, 어떤 API를 쓸지 결정 | 미정 | 현재 Prompt Builder는 텍스트 프롬프트만 생성, 실제 이미지 생성 없음 |
| BL-009 | 전자책 제목 Intelligence | 제목 스튜디오에 점수/추천 패널 추가 | 제목 선택 근거 제공 | P2 | 제안 | Thumbnail Intelligence 패턴 재사용 검토 | 미정 | Phase 3 후보 |
| BL-010 | 목차 Intelligence | 챕터 구성 품질 평가 | 구성 개선 | P3 | 제안 | BL-009 | 미정 | Phase 3 후보 |
| BL-011 | 본문 Quality Coach 개선 | 기존 Quality Coach 점수 항목 확장 | 본문 품질 개선 | P2 | 제안 | 기존 Quality Coach 로직 분석 | 미정 | 기존 기능(완료됨) 개선 항목 — 신규 기능 아님 |
| BL-012 | DOCX Export 개선 | 기존 DOCX 다운로드 서식/구조 개선 | 결과물 완성도 | P3 | 제안 | 없음 | 미정 | DOCX Export 자체는 이미 존재(`downloadDocx`) — 개선 항목 |
| BL-013 | EPUB Export | EPUB 형식 내보내기 신규 추가 | 전자책 유통 채널 확대 | P2 | 제안 | 없음 | 미정 | 현재 EPUB Export 없음 |
| BL-014 | Prompt History | 사용자가 수정한 Prompt 이력 저장/조회 | 재사용성 | P3 | 제안 | 저장 스키마 확장 검토 | 미정 | |
| BL-015 | 프로젝트 목록 개선 | 대시보드/히스토리 목록의 검색·필터 강화 | 관리 편의성 | P2 | 제안 | 없음 | 미정 | 기본 목록 기능은 이미 존재(완료됨) — 개선 항목 |
| BL-016 | 자동 저장 확장 | 입력 필드 자동 저장 범위를 프로젝트 전체로 확장 | 데이터 손실 방지 | P2 | 제안 | 없음 | 미정 | 현재 일부 입력 필드만 자동 저장(`atlasBindDraftAutosave`) |
| BL-017 | 사용자 계정 | 실제 서버 기반 사용자 계정 | 다중 기기 접근, 데이터 보존 | P0 | 제안 | 서버 인프라(BL-019) | Phase 4 | 현재는 localStorage 기반 로그인 시뮬레이션 |
| BL-018 | 서버 인증 | 실제 로그인/세션 서버 구현 | 보안, 다중 사용자 지원 | P0 | 제안 | 없음(Phase 4 시작점) | Phase 4 | |
| BL-019 | API Key 서버 보관 | Anthropic API 키를 서버에서 관리 | 보안, 사용량 통제 | P0 | 제안 | BL-018 | Phase 4 | 현재 키가 브라우저에 그대로 저장됨(보안 위험, [Architecture](./ARCHITECTURE.md) 참고) |
| BL-020 | Trial 제한 실제 적용 | 무료 사용자 생성 횟수 실제 제한 | 과금 체계 기반 마련 | P1 | 제안 | BL-017 | Phase 4 | 현재 `canGenerate()`가 항상 true 반환(제한 없음) |
| BL-021 | Pro 권한 체계 | 유료 플랜별 기능 차등 | 수익화 기반 | P1 | 제안 | BL-020 | Phase 4 | |
| BL-022 | 결제/구독 | 실제 결제 연동 | 수익화 | P0 | 제안 | Phase 4 완료 | Phase 5 | |
| BL-023 | 관리자 Dashboard | 운영자용 사용자/사용량 관리 화면 | 운영 효율 | P1 | 제안 | BL-017, BL-022 | Phase 5 | |
| BL-024 | 사용량 및 비용 추적 | API 호출량/비용 모니터링 | 운영 비용 통제 | P1 | 제안 | BL-019 | Phase 5 | |
| BL-025 | 오류 모니터링 | 프로덕션 오류 추적 도구 연동 | 안정성 | P1 | 제안 | Phase 4 배포 구조 확정 | Phase 6 | |
| BL-026 | 고객 피드백 수집 | 사용자 피드백 채널 구축 | 제품 개선 근거 확보 | P2 | 제안 | 없음 | Phase 6 | |
| BL-027 | 팀 Workspace | 여러 사용자가 함께 쓰는 작업공간 | 협업 | P3 | 보류 | BL-017 | 미정 | 현재 방향(1인 사용자 중심)과 거리가 있어 보류 |
| BL-028 | 브랜드 색상 저장 | 사용자 지정 색상 프리셋 저장 | 개인화 | P3 | 제안 | 사용자 계정(BL-017) | 미정 | 계정 시스템 없이는 개인별 저장 의미가 제한적 |
| BL-029 | 사용자 템플릿 저장 | 사용자가 만든 템플릿 저장/재사용 | 개인화, 재사용성 | P3 | 제안 | 사용자 계정(BL-017) | 미정 | 위와 동일한 이유로 P3 |

---

## 우선순위 요약

- **P0 (4건)**: 사용자 계정, 서버 인증, API Key 서버 보관, 결제/구독 — 전부 Phase 4~5(SaaS 인프라·과금) 항목이며 아직 착수 전
- **P1 (9건)**: Sales Page Studio 관련 4건(Milestone 3 직접 대상), Trial/Pro 권한, 실제 Claude Hook 추천, 관리자 Dashboard, 사용량 추적
- **P2 (10건)**: 각종 기존 기능 개선 항목과 EPUB Export 등
- **P3 (6건)**: 팀 Workspace, 브랜드 색상 저장, 사용자 템플릿 저장 등 — 현재 1인 사용자 중심 방향과 맞지 않거나 계정 시스템 선행 필요

Milestone 3(Sales Page Studio) 착수 시 BL-001~BL-005를 우선 검토합니다.
