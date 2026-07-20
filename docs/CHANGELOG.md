# CHANGELOG

## Milestone 1 — 개발 기반 정리 (구조 분리, 기능 변경 없음)

브랜치: `claude/milestone-1-modularization` (origin/main 커밋 `7cddd11`에서 새로 분기)

**브랜치 이력 안내**: 이전에 진행했던 프로젝트 분석 작업은 별도 브랜치
(`claude/atlas-ebook-project-analysis-8wydjo`)의 `PROJECT_ANALYSIS.md` 커밋에만 있으며,
이 마일스톤 브랜치에는 포함되어 있지 않습니다. 즉 분석 커밋과 이번 모듈화 커밋은 서로 다른
브랜치/이력으로 완전히 분리되어 있습니다.

### 변경 내용

1. **CSS 분리**: `index.html`의 `<style>...</style>` 블록(819줄)을 내용 변경 없이
   `css/styles.css`로 이동하고, 원래 위치에 `<link rel="stylesheet" href="css/styles.css"/>`를
   삽입했습니다.
2. **JS 분리 (원본 script 블록 단위)**: `index.html`에 있던 4개의 `<script>` 블록을 원본
   순서를 유지한 채 3개 파일로 옮겼습니다.
   - `js/renderers.js` ← 첫 번째 큰 `<script>` 블록 (1297줄, 원본과 diff 결과 동일 확인)
   - `js/application.js` ← 두 번째 큰 `<script>` 블록 (1571줄, 원본과 diff 결과 동일 확인)
   - `js/bootstrap.js` ← 마지막 두 개의 소형 `<script>` 블록을 원래 순서 그대로 이어붙임 (27줄,
     원본과 diff 결과 동일 확인)
   - `index.html`에는 `<script src="js/renderers.js">` → `<script src="js/application.js">`
     → `<script src="js/bootstrap.js">` 순서로 참조를 남겼습니다 (원본 실행 순서와 동일).
3. **문서 4종 추가**: `docs/ARCHITECTURE.md`, `docs/CURRENT_FEATURES.md`,
   `docs/MANUAL_QA_CHECKLIST.md`, `docs/CHANGELOG.md` (본 파일)

### 이번 단계에서 하지 않은 것 (의도적으로 범위 밖으로 둠)

- 함수 내부 로직, 변수명, 문구, 이벤트 처리 방식, API 호출 방식 — **전혀 변경하지 않음**
- 중복된 `getRandomTheme` 함수 — 원본 그대로 두 곳에 유지 (제거하지 않음)
- 기능별(feature-level) 세분화 — 처음에는 16개 파일로 세분화했으나, 로드 순서 위험(전역 함수/변수
  의존성, 몽키패치 IIFE)을 이유로 **작업 중 폐기**하고 원본 script 블록 단위 3분할로 축소함
- `tests/` 폴더 생성 — 실제 테스트 코드가 없어 이번 단계에서는 만들지 않음. 실제 테스트 결과는
  `docs/MANUAL_QA_CHECKLIST.md`에 기록함

### 검증 방법 및 결과 (요약, 상세는 MANUAL_QA_CHECKLIST.md)

- 각 분리 단계(CSS → renderers.js → application.js → bootstrap.js)마다 로컬 서버 + 헤드리스
  브라우저(Playwright/Chromium)로 즉시 재실행하여 콘솔에서 `ReferenceError`/`SyntaxError`/자체
  파일 404가 없는지 확인 후 다음 단계로 진행함
- 분리된 3개 JS 파일 각각 `node --check`로 문법 검증 통과
- 분리된 3개 JS 파일 내용을 원본 백업과 `diff`로 대조해 **바이트 단위로 동일함**을 확인
- 14개 필수 기능 항목 중 10개는 실제 브라우저 조작/함수 호출로 확인, 4개는 API 키가 필요해
  부분 확인(렌더링 함수 자체는 확인, 실제 AI 응답은 미확인)으로 표기

### 백업

- 작업 시작 전 원본 `index.html`을 세션 스크래치패드(레포 외부)에 복사해 이중 확인용으로 보관함.
  단, 이 복사본은 세션 종료 시 사라질 수 있는 임시 보관소이므로 **원본 보호의 근거로 삼지 않음**.
  원본 보호의 실제 근거는 `main` 브랜치의 git 이력(커밋 `7cddd11`)입니다.
