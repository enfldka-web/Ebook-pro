# MANUAL QA CHECKLIST — Milestone 1 (구조 정리 후 검증)

테스트 환경: 로컬 정적 서버(`python3 -m http.server`) + Playwright(사전 설치된 Chromium)를 이용한
실제 브라우저 렌더링/콘솔 로그 확인. 이 세션에는 유효한 Anthropic API 키가 없어, 실제 Claude API
호출이 필요한 항목은 "미확인"으로 표기했습니다. **실제로 수행하지 않은 테스트는 통과로 표기하지 않았습니다.**

## 단계별 콘솔 검증 (CSS 분리 → renderers.js → application.js → bootstrap.js, 각 단계마다 반복)

각 단계에서 아래 5가지를 확인했고, 4단계 모두 문제 없음을 확인했습니다.

| 확인 항목 | 결과 |
|---|---|
| ReferenceError | 없음 (4단계 전부) |
| SyntaxError (`node --check`로도 각 파일 검증) | 없음 |
| 자체 파일(css/js) 404 | 없음 — 3개 JS 파일 + CSS 파일 모두 200 OK로 로드됨 (서버 access log로 확인) |
| 미정의 함수 호출 | 없음 — 22개 핵심 전역 함수(`showPage`,`initApp`,`renderCvEbook` 등) 존재 확인 |
| 초기 화면 렌더링 실패 | 없음 — `#pg-landing`이 정상 표시됨 |

콘솔에 나타난 에러는 아래 4건뿐이며, 전부 **이번 리팩터링과 무관한 외부 자원 로드 실패**입니다
(원본 코드에도 동일한 URL로 존재하며, 이 샌드박스 환경이 외부 네트워크를 차단하기 때문에 발생):

- `cdnjs.cloudflare.com` JSZip / html2canvas 로드 실패 (`ERR_TUNNEL_CONNECTION_FAILED`)
- `fonts.googleapis.com` 폰트 2건 로드 실패 (`ERR_CONNECTION_RESET`)
- `/favicon.ico` 404 (원본에도 favicon 정의가 없어 브라우저가 자동 요청 후 실패 — 기존과 동일)

## 필수 확인 기능 14개 — 실제 테스트 결과

| # | 기능 | 결과 | 비고 |
|---|---|---|---|
| 1 | 랜딩 페이지 표시 | ✅ 확인 | `#pg-landing` 표시 확인 |
| 2 | 로그인 및 회원가입 화면 | ✅ 확인 | `showPage('auth','login')` 전환 확인 |
| 3 | 대시보드 이동 | ✅ 확인 | 로그인(신규 계정 자동 생성) 후 `#app-dashboard` 표시 확인 |
| 4 | 파일/주제/URL 입력 화면 | ✅ 확인 | 3개 탭 전환(`switchInputTab`) 정상 동작 |
| 5 | 스마트 인터뷰 | ⚠️ 부분 확인 | 합성 데이터로 `renderSmartInterview()` 직접 호출해 렌더링 확인. **AI가 실제 질문을 생성하는 API 호출 자체는 미확인** (API 키 필요) |
| 6 | 제목 스튜디오 | ⚠️ 부분 확인 | 합성 데이터로 `renderTitleStudio()` 직접 호출해 렌더링 확인. **AI 제목 생성 API 호출은 미확인** |
| 7 | 전자책 생성 화면 진입 | ⚠️ 부분 확인 | `#cv-process-state` DOM 존재만 확인. **실제 생성 진행/완료는 미확인** (API 키 필요) |
| 8 | 결과 에디터 | ✅ 확인 | 합성 전자책 데이터로 `renderCvEbook()` 호출, `#cv-edoc`에 정상 렌더링됨 |
| 9 | 썸네일 화면 | ✅ 확인 | 합성 데이터로 `renderKmongThumbnails()` 정상 동작 |
| 10 | 상세페이지 화면 | ✅ 확인 | 합성 데이터로 `renderCvSalesPage()`, `renderKmongListing()` 정상 동작. 품질 코치 몽키패치(bootstrap.js의 IIFE)가 `renderCvEbook` 호출 직후 `#atlas-quality-body`를 자동 갱신하는 것도 확인함 |
| 11 | 프로젝트 임시저장 및 불러오기 | ✅ 확인 | `atlasSaveDraft`/`atlasLoadDraft` 라운드트립 확인 (아래 "테스트 중 발견/수정한 문제" 참고 — 최초 자동 테스트 스크립트 실수를 바로잡은 뒤 통과) |
| 12 | API 키 저장 및 삭제 | ✅ 확인 | `setApiKey`/`getApiKey`/`clearApiKey` 라운드트립 확인 (아래 참고 — `confirm()` 다이얼로그 처리 후 통과) |
| 13 | 다운로드 버튼 | ⚠️ 부분 확인 | `downloadDocx`/`dlAllSlides`/`downloadKmongThumbnail`/`downloadKmongLongPage` 함수가 모두 정의되어 있음을 확인. **실제 파일 다운로드(브라우저 다운로드 이벤트)는 미확인** |
| 14 | 로그아웃 | ✅ 확인 | `doLogout()` 후 `#pg-landing`으로 정상 복귀 |

## 테스트 중 발견/수정한 문제 (숨기지 않고 기록)

자동 테스트 1차 실행에서 11번, 12번 항목이 **FAIL**로 나왔습니다. 원인을 조사한 결과 코드 문제가
아니라 **제 테스트 스크립트의 오류**였습니다:

- 11번: `atlasSaveDraft`/`atlasLoadDraft`는 애초에 `APP.projectName`을 저장/복원하지 않는 함수입니다
  (원본 코드에도 없는 동작). 제 테스트가 잘못된 가정으로 `projectName` 복원 여부를 확인했습니다.
  `APP.lockedTitle`처럼 실제로 저장/복원되는 값으로 다시 테스트해 통과를 확인했습니다.
- 12번: `clearApiKey()`는 원본 코드 그대로 `confirm('API 키를 삭제하시겠습니까?')`를 호출합니다.
  Playwright는 기본적으로 대화상자를 자동 취소하므로 `confirm()`이 `false`를 반환해 삭제가
  일어나지 않은 것으로 나왔습니다. 다이얼로그를 수락하도록 핸들러를 추가한 뒤 재검증해 통과를
  확인했습니다.

두 경우 모두 **원본과 동일한 기존 동작**이며, 이번 파일 분리로 인해 새로 생긴 문제가 아님을
`js/application.js`의 해당 함수 소스를 직접 확인해 검증했습니다.

## 미확인 항목 요약 (자동화 불가 — API 키 필요)

- 스마트 인터뷰의 실제 AI 질문 생성 (API 응답 성공 여부)
- 제목 스튜디오의 실제 AI 제목 후보 생성
- 전자책 실제 생성 완료(7개 챕터 등 본문 생성)까지의 전체 흐름
- 부분 재생성(`runAtlasPartialRegeneration`) 실제 API 응답
- 다운로드 버튼 클릭 시 실제 파일이 브라우저에 저장되는지 여부
