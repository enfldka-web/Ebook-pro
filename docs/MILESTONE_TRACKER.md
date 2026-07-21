# Atlas Milestone Tracker

관련 문서: [Master Roadmap](./MASTER_ROADMAP.md) · [Feature Backlog](./FEATURE_BACKLOG.md) · [Changelog](./CHANGELOG.md)

상태 값은 아래 5개로 통일합니다: **완료 / 진행 중 / 예정 / 후보 / 보류**

---

| Milestone | 이름 | 상태 | Branch / PR | 주요 범위 |
|---|---|---|---|---|
| 1 | Frontend Modularization | 완료 | `claude/milestone-1-modularization` / PR #1 | CSS/JS 분리, 문서화, Playwright QA |
| 2 | Thumbnail Studio v1 | 완료 | `claude/milestone-2-thumbnail-studio` / PR #2 | 템플릿 8종, 색상/레이아웃/스타일, Live Preview, Prompt Builder, PNG/JPG Export, 저장/불러오기 |
| 2.5 | Thumbnail Intelligence v1 | 완료 | `claude/milestone-2.5-thumbnail-intelligence` / PR #3 | 결정적 점수, 개선 제안, 규칙 기반 추천, 추천 적용, 실제 CTR 예측 아님 |
| 2.6 | Before/After Comparison | 후보 | 없음 | 아직 미착수 — Milestone 2.5 사전 분석에서 다음 후보로만 기록됨 |
| 3 | Sales Page Studio v1 | 완료(병합 대기) | `claude/milestone-3-sales-page-studio` / PR 생성 대기 | 섹션 구조 빌더(8종), 텍스트 편집, 색상 테마/카드 레이아웃, Live Preview, 개별 PNG/전체 ZIP Export, 저장/불러오기 |

---

## Milestone 1 — Frontend Modularization

- **상태**: 완료
- **Branch/PR**: `claude/milestone-1-modularization` → PR #1 (main에 병합됨, 병합 커밋 `6752b07`)
- **완료 기준**: 원본 `index.html`(4,232줄)을 기능 손실 없이 `css/`·`js/` 파일로 분리, 분리 전후 내용이 diff 상 동일함을 확인
- **결과**:
  - `css/styles.css`, `js/renderers.js`, `js/application.js`, `js/bootstrap.js` 생성
  - 원본 4개 `<script>` 블록을 원래 순서를 유지한 채 3개 파일로 재구성
  - 중복 정의된 `getRandomTheme` 함수는 이번 Milestone에서 정리하지 않고 원본 그대로 유지(별도 리팩터링 단계로 이연)
- **실제 미검증 사항**: 없음(코드 재배치만 수행, 로직 변경 없음)
- **회귀 테스트 결과**: Playwright로 4단계(CSS→renderers→application→bootstrap) 분리 직후마다 콘솔 오류 확인, 14개 필수 기능 항목 중 10개 실제 확인, 4개(API 키 필요 항목)는 부분 확인
- **관련 문서**: [Milestone 1 완료 보고서](./MILESTONE_1_COMPLETION_REPORT.md), [Manual QA Checklist](./MANUAL_QA_CHECKLIST.md)

## Milestone 2 — Thumbnail Studio v1

- **상태**: 완료
- **Branch/PR**: `claude/milestone-2-thumbnail-studio` → PR #2 (main에 병합됨, 병합 커밋 `f39ee9f`)
- **완료 기준**: 결과 화면에서 새 Thumbnail Studio 진입 → Hook 선택/편집 → 템플릿·색상·레이아웃·스타일 선택 → Live Preview → Prompt 생성 → PNG/JPG Export → 프로젝트 저장/불러오기까지 전체 흐름이 실제 브라우저에서 동작
- **결과**:
  - `js/thumbnail-studio.js`, `js/thumbnail-studio-io.js` 신규
  - 템플릿 8종(20종까지 확장 가능한 데이터 구조), 색상 6종, 레이아웃 6종(템플릿과 독립 선택), 이미지 스타일 6종
  - PNG/JPG 다운로드 파일이 실제로 652×488px임을 바이너리 헤더 직접 파싱으로 확인
  - `atlasCollectDraft`/`atlasLoadDraft`에 `thumbnailStudio` 필드 추가(기존 필드는 무변경, 구버전 draft 호환 확인)
- **실제 미검증 사항**:
  - Hook Generator는 fallback 데이터만 사용 — 실제 Claude API 호출 미검증
  - `html2canvas`는 이 개발 환경의 CDN 차단으로 실제 라이브러리 렌더링을 검증하지 못하고, 스텁으로 다운로드 파이프라인만 검증함
- **회귀 테스트 결과**: 최종 통합 Playwright 테스트 28개 항목(신규 기능 + 기존 기능 회귀 + 콘솔 오류 확인) 전부 통과
- **관련 문서**: [Milestone 2 완료 보고서](./MILESTONE_2_COMPLETION_REPORT.md)

## Milestone 2.5 — Thumbnail Intelligence v1

- **상태**: 완료
- **Branch/PR**: `claude/milestone-2.5-thumbnail-intelligence` → PR #3 (main에 병합됨, 병합 커밋 `1a81f20`)
- **완료 기준**: Thumbnail Studio 화면에 분석 패널이 추가되어 총점·항목별 점수·개선 제안·추천이 표시되고, 추천을 적용하면 기존 Thumbnail Studio 상태와 Live Preview가 즉시 갱신됨
- **결과**:
  - `js/thumbnail-intelligence.js` 신규(8개 항목, 총 100점, 전부 순수 함수 — 같은 입력에는 항상 같은 점수)
  - Hook/색상/레이아웃/스타일 추천 — 전부 규칙 기반, 실제 Claude API 미호출
  - 추천 적용은 기존 `ThumbnailStudio.*` 메서드에 위임(신규 상태 변경 로직 없음)
  - 점수·추천·개선 제안은 저장하지 않고 매번 재계산(저장 스키마 변경 없음)
- **실제 미검증 사항**:
  - Hook 추천은 규칙 기반(fallback)이며 실제 Claude API 기반 추천은 구현하지 않음
  - Visual Contrast 항목은 현재 6개 색상 테마가 전부 어두운 배경이라 점수 편차가 작을 수 있음(설계 시 이미 인지된 한계)
- **회귀 테스트 결과**: 최종 통합 Playwright 테스트 29개 항목(신규 Intelligence 기능 + 기존 Thumbnail Studio v1/썸네일/상세페이지/로그인/API 키 회귀) 전부 통과. 개발 중 버그 2건 발견·수정·재검증(상세는 [Bug Tracker](./BUG_TRACKER.md) 참고)
- **관련 문서**: [Milestone 2.5 완료 보고서](./MILESTONE_2_5_COMPLETION_REPORT.md)

## Milestone 2.6 — Before/After Comparison

- **상태**: 후보
- **Branch/PR**: 없음
- **배경**: Milestone 2.5 사전 분석 단계에서 "적용 전/후 비교 화면"을 만들지, 이번 Milestone에 포함할지 검토했고, 범위 확대를 피하기 위해 다음 Milestone 후보로 분리하기로 결정함(사용자 승인 완료).
- **현재 상태**: 사전 분석도 아직 시작하지 않음. 착수 여부와 시점 미정.

## Milestone 3 — Sales Page Studio v1

- **상태**: 완료(병합 대기 — 403으로 직접 push 불가, ZIP을 통한 GitHub Desktop 반영 대기)
- **Branch/PR**: `claude/milestone-3-sales-page-studio` (Atlas 운영 문서 v1.0이 병합된 `main`, 커밋 `71229b7`에서 분기). PR 번호는 병합 후 갱신 예정
- **완료 기준**: 결과 화면에서 새 Sales Page Studio 진입 → 섹션 On/Off·순서 변경 → 문구 편집 → 템플릿·색상·카드 레이아웃 선택 → Live Preview → 개별 PNG/전체 ZIP 다운로드 → 프로젝트 저장/불러오기까지 전체 흐름이 실제 브라우저에서 동작
- **결과**:
  - `js/sales-page-studio.js`, `js/sales-page-studio-io.js` 신규
  - 기본 섹션 8종(hero/pain/solution/toc/benefits/beforeAfter/targetAudience/cta), 색상 테마 6종(기존 상세페이지 카드뉴스 테마를 시각 기준으로 재사용), 카드 레이아웃 6종(섹션 타입별 허용 목록으로 관리)
  - 개별 PNG 다운로드 파일이 실제로 1080×1350px임을 바이너리 헤더 직접 파싱으로 확인(기존 `dlSpSlide`와 동일한 `scale:2` 파라미터 재사용)
  - 전체 ZIP 다운로드는 활성 섹션 수와 ZIP 내부 파일 수가 항상 일치함을 확인, 순서 변경/On-Off 변경 후 재검증
  - `atlasCollectDraft`/`atlasLoadDraft`에 `salesPageStudio` 필드 추가(기존 필드는 무변경, 구버전 draft 호환 확인), 전자책이 바뀌면 `sourceEbookKey` 불일치로 자동 재초기화
- **실제 미검증 사항**:
  - `html2canvas`/`JSZip`은 이 개발 환경의 CDN 차단으로 실제 라이브러리 렌더링을 검증하지 못하고, 스텁으로 다운로드 파이프라인·픽셀 크기·ZIP 파일 개수만 검증함
  - 실제 Claude API 기반 판매 문구 생성은 이번 v1 범위 밖(규칙 기반 초기 매핑만 구현)
- **회귀 테스트 결과**: 기존 "썸네일 + 상세페이지"(9장 카드뉴스, 크몽 썸네일/리스팅), Thumbnail Studio, Thumbnail Intelligence 전부 회귀 없음을 Playwright로 확인. 7개 Phase마다 실제 클릭·입력 기반 검증, 콘솔 오류 없음(CDN 차단 관련 네트워크 오류만 존재)
- **관련 문서**: [Milestone 3 완료 보고서](./MILESTONE_3_COMPLETION_REPORT.md)
