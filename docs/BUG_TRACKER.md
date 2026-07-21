# Atlas Bug Tracker

관련 문서: [Milestone Tracker](./MILESTONE_TRACKER.md) · [Manual QA Checklist](./MANUAL_QA_CHECKLIST.md)

## 심각도

- Critical / High / Medium / Low

## 상태

- Open / Investigating / Fixed / Verified / Deferred / Won't Fix

---

## 해결된 버그

| ID | 제목 | 발견 Milestone | 심각도 | 상태 | 재현 방법 | 원인 | 해결 내용 | 검증 | 관련 Commit/PR |
|---|---|---|---|---|---|---|---|---|---|
| BUG-001 | Thumbnail Studio 색상/레이아웃/스타일 선택 시 active 표시 미갱신 | Milestone 2 | Medium | Verified | 색상/레이아웃/스타일 칩을 클릭하면 내부 상태와 미리보기는 바뀌지만, 클릭한 칩 자체의 선택 표시(테두리/체크)가 갱신되지 않음 | `TS.selectColor`/`selectLayout`/`selectStyle`이 미리보기만 다시 그리는 `renderPreviewOnly()`를 호출하고 있어 컨트롤 패널 자체가 재렌더링되지 않음 | 세 함수 모두 패널 전체를 다시 그리는 `TS.render()`를 호출하도록 수정(텍스트 입력 필드는 타이핑 포커스 보존을 위해 `renderPreviewOnly()` 유지) | Playwright로 각 칩의 active 클래스가 상태와 일치하는지 재검증 | PR #2 (커밋 `411554b`) |
| BUG-002 | Hook 추천 적용 후 "직접 수정" 입력창 표시 미갱신 | Milestone 2.5 | Low | Verified | Thumbnail Intelligence의 추천 Hook "적용" 버튼 클릭 → 내부 상태와 미리보기는 정확히 바뀌지만 Hook 섹션의 "직접 수정" 입력창에는 표시되지 않음 | `ThumbnailStudio.setCustomHook`이 타이핑 중 포커스 보존을 위해 미리보기만 다시 그리는 가벼운 경로(`renderPreviewOnly`)를 사용 — 외부(추천 패널)에서 프로그래밍 방식으로 호출한 경우 입력창 자체는 갱신되지 않음 | `ThumbnailIntelligence.applyRecommendation`이 Hook 적용 시 `setCustomHook()` 호출 뒤 `ThumbnailStudio.render()`(전체 재렌더)도 함께 호출하도록 수정 | Playwright로 적용 후 입력창 값이 실제 적용된 문구와 일치하는지 재검증 | PR #3 (커밋 `5d4887d`) |
| BUG-003 | Thumbnail Intelligence가 잘못된 전역 참조로 항상 빈 상태를 평가 | Milestone 2.5 | High | Verified | Thumbnail Studio를 열고 어떤 입력을 하든 분석 패널의 점수가 항상 동일(46점)하게 표시됨 | `thumbnail-intelligence.js`에서 `ThumbnailStudio.state`를 가리키려던 코드가 `TS.state`를 참조 — `TS`는 `thumbnail-studio.js` 내부 즉시실행함수(IIFE)의 지역 매개변수일 뿐 전역에 존재하지 않아, 항상 빈 객체(`{}`)로 폴백됨 | `ThumbnailStudio.state`로 참조 수정 | Playwright로 실제 입력값에 따라 점수가 정확히 변하는지(재현성 포함) 재검증, 스크린샷 육안 확인 병행 | PR #3 (커밋 `5d4887d`) |

## 테스트 스크립트 문제 (앱 버그 아님, 별도 기록)

아래는 개발 중 Playwright 테스트가 실패했던 사례이나, 원인이 애플리케이션 코드가 아니라 테스트
스크립트의 잘못된 가정/선택자였던 것으로 확인되어 앱 버그 목록과 분리해 기록합니다.

- Milestone 1 QA: `atlasSaveDraft`/`atlasLoadDraft`가 애초에 `projectName`을 저장하지 않는데, 테스트가
  이를 저장한다고 잘못 가정하여 실패 — 실제 저장 필드(`lockedTitle` 등)로 재검증해 통과 확인
- Milestone 1 QA: `clearApiKey()`가 `confirm()` 다이얼로그를 여는데, Playwright가 다이얼로그를 기본적으로
  자동 취소해서 삭제가 안 된 것처럼 보였음 — 다이얼로그를 수락하도록 핸들러를 추가해 재검증
- Milestone 2/2.5 QA: "← 전자책으로" 같은 동일 텍스트 버튼이 여러 화면(예: 기존 상세페이지 화면과
  신규 Thumbnail Studio 화면)에 각각 존재해, 범위를 좁히지 않은 선택자가 다른 화면의 숨겨진 버튼을
  잘못 찾은 사례 — 선택자를 해당 화면으로 한정해 해결

## 현재 Open Bugs

현재 확인된 미해결 기능 버그 없음. 단, 아래 검증 필요 항목은 버그가 아니라 기술적 한계 또는 검증
필요 항목으로 추적합니다.

## 검증 필요 항목 (Known Limitation / Verification Needed)

| 항목 | 구분 | 내용 |
|---|---|---|
| html2canvas 실제 CDN 로드 환경 품질 확인 | Verification Needed | 이 개발 샌드박스는 `cdnjs.cloudflare.com` 접근이 차단되어 있어, PNG/JPG Export는 스텁(대역) 함수로 파이프라인(크기·다운로드)만 검증했습니다. 실제 라이브러리로 렌더링된 이미지 품질은 인터넷이 연결된 실제 사용자 환경에서 별도 확인이 필요합니다. |
| 실제 Claude API 기반 Hook 추천 미검증 | Known Limitation | Hook Generator(Milestone 2)와 Hook 추천(Milestone 2.5)은 전부 규칙/fallback 기반이며, 유효한 Anthropic API 키가 없어 실제 AI 응답 경로 자체가 검증된 적이 없습니다. |
| 브라우저별 Export 품질 확인 | Verification Needed | 지금까지의 검증은 Chromium(Playwright) 한 브라우저에서만 이루어졌습니다. Safari/Firefox 등 다른 브라우저에서의 html2canvas 동작은 확인되지 않았습니다. |
| 모바일 레이아웃 추가 검증 | Verification Needed | Thumbnail Studio/Intelligence는 데스크톱 우선으로 설계되었고 최소한의 반응형 CSS만 있습니다. 실제 모바일 기기에서의 사용성은 검증되지 않았습니다. |
