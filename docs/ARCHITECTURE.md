# ARCHITECTURE — Milestone 1 (구조 정리)

이 문서는 Milestone 1(개발 기반 정리) 작업 후의 파일 구조와, 왜 이렇게 나눴는지를 설명합니다.
**주의: 이번 단계는 물리적 파일 분리만 수행했으며, 함수 내부 로직/변수명/이벤트 처리/API 호출 방식은 원본과 100% 동일합니다.**

## 디렉터리 구조

```
/
├── index.html          (마크업 + <link>/<script src> 참조만 남음)
├── css/
│   └── styles.css       원본 <style>...</style> 내용을 그대로 이동 (수정 없음)
├── js/
│   ├── renderers.js      원본 첫 번째 큰 <script> 블록을 그대로 이동
│   ├── application.js    원본 두 번째 큰 <script> 블록을 그대로 이동
│   └── bootstrap.js       원본 마지막 두 개의 소형 <script> 블록을 원래 순서 그대로 이어붙임
└── docs/
    ├── ARCHITECTURE.md
    ├── CURRENT_FEATURES.md
    ├── MANUAL_QA_CHECKLIST.md
    └── CHANGELOG.md
```

## 왜 3개 JS 파일로만 나눴는가

최초 계획은 기능별로 16개 파일(core/services/renderers/features/app)까지 세분화하는 것이었으나,
**사용자 검토 과정에서 폐기**했습니다. 이 코드베이스는:

- 모든 함수가 `var`/전역 `function` 선언으로 되어 있어 모듈 시스템(import/export)이 없고,
- 전역 상태 객체 `APP` 하나를 모든 기능이 공유하며,
- 파일 끝에 `renderCvEbook`/`renderCvSalesPage`를 **몽키패치하는 즉시실행 함수(IIFE)**가 있어
  스크립트 로드 순서에 민감합니다.

이런 상태에서 세분화된 다수 파일로 나누면 로드 순서 실수로 `ReferenceError`가 날 위험이 커집니다.
그래서 Milestone 1에서는 **원본에 이미 존재하던 4개의 `<script>` 블록 경계를 그대로 따라** 안전하게
3개 파일(`renderers.js`, `application.js`, `bootstrap.js`)로만 나눴습니다. 각 파일은 원본의 해당
블록 내용을 한 글자도 바꾸지 않고 그대로 옮긴 것입니다(diff로 검증 완료, 아래 CHANGELOG 참조).

## 스크립트 로드 순서 (반드시 이 순서를 유지해야 함)

```html
<script src="js/renderers.js"></script>
<script src="js/application.js"></script>
<script src="js/bootstrap.js"></script>
```

- `renderers.js`: `renderCvEbook`, `renderCvSalesPage`, `renderKmongThumbnails`, `renderKmongListing` 등
  렌더링/유틸 함수들 (원본에서도 항상 가장 먼저 로드되던 블록).
- `application.js`: 전역 상태 `APP`, 페이지 전환(`showPage`/`showApp`), 인증, 대시보드, 컨버터 워크플로우,
  Claude API 호출, localStorage 접근 함수 전부 포함 (원본 두 번째 블록).
- `bootstrap.js`: 마지막에 실행되어야 하는 두 조각을 원래 순서 그대로 포함합니다.
  1. `window.addEventListener('load', ...)` — 저장된 프로젝트 자동 불러오기
  2. `renderCvEbook`/`renderCvSalesPage`를 감싸 품질 코치(`renderAtlasQuality`)를 자동 호출하도록
     패치하는 즉시실행 함수(IIFE). **이 IIFE는 `renderCvEbook`/`renderCvSalesPage`가 이미 정의된
     뒤(즉 `renderers.js` 로드 후)에만 실행되어야 하므로, `bootstrap.js`는 항상 마지막에 로드해야 합니다.**

## 알려진 기존 구조적 특징 (이번 단계에서 변경하지 않음)

- `getRandomTheme` 함수가 `renderers.js`와 `bootstrap.js`... 정확히는 원본과 동일하게 `renderers.js`
  내부(구 46행)와 원본 두 번째 블록(현재 `application.js` 내부, 구 4161행)에 **중복 정의**되어 있습니다.
  두 정의는 완전히 동일하며, 나중 것이 앞의 것을 덮어쓸 뿐 동작에는 영향이 없습니다. 이번 단계에서는
  일부러 정리하지 않았고, 별도 리팩터링 단계에서 처리하기로 결정했습니다.
- CSS는 인라인 `style=` 속성(HTML 내 322회)과 `<style>` 블록이 공존하는 구조 그대로입니다. 이번 단계는
  `<style>` 블록만 파일로 옮겼을 뿐, 인라인 스타일 정리는 범위 밖입니다.
- 인증(로그인/회원가입), API 키 저장, localStorage 데이터 구조는 전혀 변경하지 않았습니다.

## 다음 단계 후보 (이번 Milestone 범위 밖, 실행하지 않음)

- `application.js`를 기능별로 더 세분화 (단, 몽키패치 IIFE 의존성 등 로드 순서를 사전에 전수 조사한 뒤 진행)
- 중복 `getRandomTheme` 정리
- 인라인 스타일/이벤트 핸들러를 CSS 클래스·이벤트 리스너로 전환

---

# Milestone 2 추가분 — Thumbnail Studio v1

## 신규 파일 및 로드 순서

```html
<script src="js/renderers.js"></script>
<script src="js/application.js"></script>
<script src="js/bootstrap.js"></script>
<script src="js/thumbnail-studio.js"></script>      ← 신규
<script src="js/thumbnail-studio-io.js"></script>    ← 신규
```

기존 3개 뒤에 로드하는 이유: `thumbnail-studio.js`가 `APP`(application.js), `atlasSetWorkspaceStage`
(application.js), `x`/`showToast`(renderers.js) 등 기존 전역을 참조하기 때문입니다. 새 2개 파일은
서로 강하게 결합되어 있으므로(`thumbnail-studio-io.js`가 `thumbnail-studio.js`의 `TS.state`,
`TS_COLOR_THEMES`를 참조) 항상 이 순서로 함께 로드해야 합니다.

- `thumbnail-studio.js`: 상태 초기화(`window.ThumbnailStudio`, `APP.thumbnailStudio`), 진입/종료,
  Hook Generator, Thumbnail Text Builder, Template Gallery(`THUMB_TEMPLATES`, 8개), Color Theme
  (`TS_COLOR_THEMES`), Layout Engine(`TS_LAYOUTS`), 이미지 스타일(`TS_IMAGE_STYLES`), Live Preview
  렌더링(`TS.renderPreview`).
- `thumbnail-studio-io.js`: Prompt 생성(순수 함수 `TS.buildPrompt`, DOM/전역 상태에 의존하지 않음),
  Prompt UI(자동 생성·직접 수정·복사), Export(PNG/JPG, 기존 html2canvas 재사용, 652×488 scale:1로 캡처).

## 전역 네임스페이스

Thumbnail Studio의 모든 로직은 `window.ThumbnailStudio`(단축 `TS`) 객체 아래에 있습니다. 기존 코드베이스는
전역 함수를 150개 가까이 그대로 나열하는 방식이라, 새 기능까지 같은 방식으로 늘리면 충돌 위험과
탐색 난이도가 함께 커집니다. `onclick`/`oninput`에서 호출해야 하는 것만 최소 래퍼 함수(`tsOpen`,
`tsSelectTemplate`, `tsSelectColor` 등, 전부 `ts` 접두사)로 전역에 노출하고, 실제 로직은 전부
`ThumbnailStudio.*` 메서드 안에 있습니다.

## 기존 코드와의 접점 (읽기만 함, 수정 없음)

- `APP` 객체 — `APP.thumbnailStudio` 하위 필드로만 상태를 저장(최상위 필드 추가 없음)
- `atlasSetWorkspaceStage('sales', ...)` — Thumbnail Studio 진입 시 기존 "5단계·판매 디자인" 스텝을
  그대로 사용(새 워크스페이스 단계를 추가하지 않음)
- `showToast`, `x()`, `getApiKey` 등 core 유틸 — 그대로 호출
- `atlasCollectDraft`/`atlasLoadDraft`(application.js) — `thumbnailStudio` 필드 1개만 추가(기존 필드
  순서/이름 변경 없음). 구버전 draft(필드 없음)를 불러오면 `ThumbnailStudio.init()`이 기본값으로
  대체하므로 오류 없이 동작함.
- `html2canvas` — 기존 `downloadKmongThumbnail`과 동일한 호출 패턴 재사용, 단 캡처 대상은 새 DOM
  (`#ts-preview-canvas`)이며 `scale:1`로 캡처해 다운로드 파일이 정확히 652×488px이 되도록 함(기존
  크몽 엔진은 `scale:2`로 더 높은 해상도를 우선하는 별개 정책이며 그대로 둠).

## 건드리지 않은 것 (기존 썸네일/상세페이지 흐름과 완전 분리)

`renderKmongThumbnails`, `renderCvSalesPage`, `checkAndShowSales`, `showSalesThemeModal`,
`window._kmThumbSelected`, `#cv-thumb-body`, `#cv-sp-body`, bootstrap.js의 몽키패치 IIFE — 전부 한 글자도
수정하지 않았습니다. Thumbnail Studio는 `#cv-thumbstudio-state`라는 완전히 새로운 화면에서 동작하며,
기존 "🛒 썸네일 + 상세페이지" 버튼과 그 흐름은 그대로 남아 있습니다.
