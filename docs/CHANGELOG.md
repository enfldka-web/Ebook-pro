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

---

## Milestone 2 — Thumbnail Studio v1 (신규 기능, 기존 기능 무변경)

브랜치: `claude/milestone-2-thumbnail-studio` (Milestone 1이 병합된 최신 `main`, 커밋 `6752b07`에서 분기)

### 변경 내용

1. **`index.html` 수정**
   - `#cv-result-state` 액션 버튼 줄에 `🎯 Thumbnail Studio` 버튼 추가 (기존 `🛒 썸네일 + 상세페이지`,
     `🪄 필요한 부분만 수정` 버튼은 그대로 유지)
   - 새 전용 화면 `<div id="cv-thumbstudio-state">` 골격 추가 (기존 최상위 화면과 동일한 show/hide 방식)
   - `<script src="js/thumbnail-studio.js">`, `<script src="js/thumbnail-studio-io.js">`를
     `bootstrap.js` 뒤에 추가
2. **`css/styles.css` 수정** — 파일 끝에 "THUMBNAIL STUDIO (Milestone 2)" 섹션 추가(신규 클래스만,
   기존 규칙 수정 없음)
3. **`js/application.js` 수정** (최소 diff, 2줄)
   - `atlasCollectDraft()`가 반환하는 객체에 `thumbnailStudio:APP.thumbnailStudio||null` 필드 추가
     (기존 필드 이름/순서/값 변경 없음)
   - `atlasLoadDraft()`에 `thumbnailStudio` 필드 복원 로직 2줄 추가, 없으면 `ThumbnailStudio.init()`이
     기본값으로 대체
4. **`js/thumbnail-studio.js` 신규** — 상태(`window.ThumbnailStudio`, `APP.thumbnailStudio`),
   진입/종료, Hook Generator(fallback), Text Builder, Template Gallery(8개), Color Theme(6개),
   Layout(6개, 템플릿과 독립 선택), 이미지 스타일(6개), Live Preview(652×488)
5. **`js/thumbnail-studio-io.js` 신규** — Prompt Builder(순수 함수 `buildThumbnailPrompt`로 UI 로직과
   분리), Prompt 복사/직접수정, PNG/JPG Export(기존 html2canvas 재사용, `scale:1`로 652×488 실측 크기 보장)

### 이번 Milestone에서 하지 않은 것

- 실제 이미지 생성 API(DALL·E 등) 연동 — 이미지 스타일 선택은 Prompt 텍스트에만 반영됨
- Hook Generator의 실제 Claude API 연동 — fallback 데이터 배열(`TS_HOOK_FALLBACKS`)만 사용
- 20개 템플릿 하드코딩 — 8개만 구현, 데이터 배열 구조로 20개까지 확장 가능하게 설계
- 기존 `renderKmongThumbnails`/`renderCvSalesPage`/`checkAndShowSales`/`showSalesThemeModal`/
  `window._kmThumbSelected` 수정 — 전부 원본 그대로 유지, Thumbnail Studio는 완전히 병렬인 새 화면
- bootstrap.js 몽키패치 IIFE에 새 훅 추가 — 하지 않음(중첩 몽키패치 회피)
- 저장/결제/백엔드/상세페이지 스튜디오 — 범위 밖

### 개발 중 발견하고 즉시 수정한 문제

- Phase 3 구현 중, 색상/레이아웃/이미지 스타일을 선택하면 내부 상태와 미리보기는 정확히 바뀌지만
  해당 컨트롤 자체의 "선택됨" 표시(active 클래스)가 갱신되지 않는 버그를 스크린샷 육안 확인으로
  발견함. `TS.selectColor`/`selectLayout`/`selectStyle`이 미리보기만 다시 그리는
  `renderPreviewOnly()`를 호출하고 있어 컨트롤 패널 자체는 재렌더링되지 않았던 것이 원인이었음.
  세 함수 모두 전체 패널을 다시 그리는 `TS.render()`를 호출하도록 수정하고 재검증해 해결함(텍스트
  입력 필드는 타이핑 포커스 보존을 위해 계속 `renderPreviewOnly()`를 사용하도록 구분함).

### 검증 방법 및 결과 (요약, 상세는 완료 보고서 참고)

- 6개 Phase(HTML 골격 → 상태/템플릿 → Hook/텍스트/색상/레이아웃/스타일/미리보기 → Prompt/Export →
  저장·불러오기 → 문서/전체 회귀)마다 Playwright(Chromium)로 실제 클릭·입력 기반 검증
- 최종 통합 테스트 28개 항목(신규 기능 22개 + 기존 기능 회귀 4개 + 콘솔 오류 확인 2개) 전부 통과
- PNG/JPG 다운로드 파일을 바이너리 헤더(IHDR/SOF0) 직접 파싱해 정확히 652×488px임을 확인
- `html2canvas`는 이 개발 샌드박스가 CDN(cdnjs.cloudflare.com) 접근을 차단하고 있어 실제 라이브러리로는
  검증하지 못했고, 스텁(stub) 함수로 대체해 **다운로드 파이프라인 자체**(옵션 전달, 파일 생성, 크기)만
  검증함. 실제 `html2canvas`로 렌더링된 이미지 품질은 인터넷이 연결된 환경(사용자 실제 배포 환경)에서
  별도 확인이 필요함.
- 유효한 Anthropic API 키가 없어 Hook Generator의 실제 AI 호출은 검증하지 못했으며, fallback 데이터로
  UI 동작만 확인함
