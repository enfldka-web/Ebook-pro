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
