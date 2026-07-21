# Milestone 3 완료 보고서 — Sales Page Studio v1

관련 문서: [Architecture](./ARCHITECTURE.md) · [Current Features](./CURRENT_FEATURES.md) · [Changelog](./CHANGELOG.md) · [Milestone Tracker](./MILESTONE_TRACKER.md) · [Bug Tracker](./BUG_TRACKER.md)

## 1. 최신 main 확인

구현 시작 전 아래 순서로 확인했습니다.

```
git fetch origin
git switch main
git pull origin main
git status   → working tree clean, 미커밋 변경 없음
git log --oneline -7
```

```
71229b7 Merge pull request #4 from enfldka-web/claude/docs-atlas-operations-v1
31470c7 Atlas operations documentation v1
1a81f20 Merge pull request #3 from enfldka-web/claude/milestone-2.5-thumbnail-intelligence
5d4887d Milestone 2.5 Thumbnail Intelligence v1
f39ee9f Merge pull request #2 from enfldka-web/claude/milestone-2-thumbnail-studio
411554b Milestone 2 Thumbnail Studio v1
6752b07 Merge pull request #1 from enfldka-web/claude/milestone-1-modularization
```

로컬 `main`과 `origin/main`이 `71229b7`로 완전히 동일함을 확인했고, 미커밋 변경사항이나 충돌은
없었습니다.

## 2. Branch

`claude/milestone-3-sales-page-studio` (위 `71229b7`에서 새로 분기, 기존 로컬 브랜치를 이어서 쓰지 않음)

## 3. Commit

`b0a01cb` — "Milestone 3 Sales Page Studio v1" (13 files changed, 1082 insertions(+), 18 deletions(-))

## 4. 변경 파일

| 파일 | 구분 | 내용 |
|---|---|---|
| `js/sales-page-studio.js` | 신규 | `window.SalesPageStudio` — 상태 초기화, 섹션 8종, On/Off·순서 변경·선택, 텍스트 편집, 테마/레이아웃 선택, 카드 렌더링, 전체/부분 render |
| `js/sales-page-studio-io.js` | 신규 | 기존 ebook/sales → sections 매핑(순수 함수), 파일명 생성, 개별 PNG Export, 전체 ZIP Export |
| `index.html` | 최소 수정 | 결과 화면에 "📄 Sales Page Studio" 버튼 1개, 신규 화면 `#cv-salespagestudio-state`(`#sps-root`), script 2줄 |
| `css/styles.css` | 최소 수정 | 파일 끝에 `sps-` 접두사 클래스 추가(기존 클래스 무수정) |
| `js/application.js` | 최소 수정(3줄) | `atlasCollectDraft`/`atlasLoadDraft`에 `salesPageStudio` 필드 추가 |
| `docs/ARCHITECTURE.md`, `docs/CURRENT_FEATURES.md`, `docs/CHANGELOG.md`, `docs/MILESTONE_TRACKER.md`, `docs/FEATURE_BACKLOG.md`, `docs/RELEASE_NOTES.md`, `docs/BUG_TRACKER.md` | 최소 수정 | Milestone 3 섹션/항목 추가 |
| `docs/MILESTONE_3_COMPLETION_REPORT.md` | 신규 | 본 문서 |

**절대 수정하지 않은 것**: `renderCvSalesPage`, `showSalesThemeModal`, `checkAndShowSales`, `showCvSales`,
`hideCvSales`, `dlSpSlide`, `dlAllSlides`, `downloadSelectedSpSlides`, `downloadKmongLongPage`,
`renderKmongThumbnails`, `renderKmongListing`, 기존 9장 카드뉴스, 기존 4개 썸네일, 기존 "썸네일 +
상세페이지" 화면, `bootstrap.js` 몽키패치, 기존 Prompt Engine, `APP.ebook.sales` 스키마, Thumbnail
Studio, Thumbnail Intelligence.

## 5. 구현된 섹션 8개

`hero`(히어로) · `pain`(문제 공감) · `solution`(해결책) · `toc`(목차) · `benefits`(핵심 장점) ·
`beforeAfter`(비포/애프터) · `targetAudience`(추천 대상) · `cta`(마무리). FAQ는 지시대로 v1에서 구현하지
않았고 `docs/FEATURE_BACKLOG.md`의 BL-030으로 후속 후보에 기록했습니다.

## 6. 상태 구조

```js
APP.salesPageStudio = {
  version: 1,
  sourceEbookKey: '',   // 제목|부제목|챕터수 로 결정적 생성
  themeId: 'navy-gold', // 6종 색상 테마
  selectedSectionId: 'hero-1',
  sections: [ {id, type, enabled, order, title, body, badge, cta, layoutId, ...} ]
};
```

**분석 보고서 대비 조정**: `templateId`와 `colorId`는 v1에서 완전히 같은 역할(6가지 색상 테마 선택)이라
`themeId` 하나로 통합했습니다. 템플릿(전체 디자인)과 카드 레이아웃(섹션별 정보 배치)은 서로 다른
개념으로 유지했고, 카드 레이아웃은 섹션마다 독립적인 `layoutId`로 남아 있습니다. `beforeAfter` 섹션만
`body` 대신 `beforeText`/`afterText` 두 개의 텍스트 필드를 추가로 가집니다(비포/애프터를 각각 여러 줄로
입력해야 해서 필드를 분리).

`order`는 전체 섹션 목록(활성/비활성 모두) 기준으로 정규화되며, 위/아래 이동은 전체 목록 안에서의 인접
위치 교환입니다. 목록의 첫 번째/마지막 위치에서는 해당 방향 버튼이 비활성화되어 더 이상 이동할 수
없습니다.

## 7. 기존 sales 데이터 매핑 방식

`sales-page-studio-io.js`의 `buildSectionsFromEbook(ebook)`(순수 함수, DOM/전역 상태에 부수효과 없음)이
최초 진입 시 1회 아래처럼 매핑합니다.

| 섹션 | 매핑 소스 | 데이터 없을 때 fallback |
|---|---|---|
| hero | `sales.hook`→title, `sales.subhook`→body, `ebook.category`→badge | `ebook.title`, `ebook.subtitle/description` |
| pain | `sales.pains[]`→body(줄바꿈 목록) | 하드코딩 3항목(기존 렌더러와 동일한 기본 문구 스타일) |
| solution | `sales.solution`→body | `ebook.description` |
| toc | `ebook.chapters` (읽기 전용, 실제 렌더 시점에 직접 참조) | 챕터 없으면 `enabled:false`로 시작 |
| benefits | `sales.learnings[]` 또는 챕터 제목 목록 | 하드코딩 3항목 |
| beforeAfter | `sales.before[]`/`sales.after[]` | 하드코딩 각 3항목 |
| targetAudience | `ebook.targetReader`(콤마/줄바꿈 분리) | 하드코딩 3항목 |
| cta | `sales.finalPush`→title | `'지금 바로 시작하세요'` |

실제 Claude API를 새로 호출하지 않고, 전부 기존에 이미 생성되어 있는 데이터를 규칙 기반으로 재배치만
했습니다. 매핑 이후에는 `APP.ebook`/`APP.ebook.sales`를 다시 쓰지 않으며, 섹션 데이터 자체가 사용자
편집 결과로 취급됩니다.

## 8. 템플릿·색상·레이아웃

- **색상 테마 6종**(`SPS_THEMES`): 네이비 골드·차콜 민트·크림 바이올렛·코랄 에너지·골드 럭셔리·파스텔
  핑크 — 기존 상세페이지 카드뉴스 테마를 시각 기준으로만 재사용한 전용 데이터 배열이며, `renderCvSalesPage`
  내부의 `THEMES` 변수는 참조하지 않습니다.
- **카드 레이아웃 6종**: `text-center`·`text-left`·`icon-list`·`split`·`comparison`·`checklist` — 섹션
  타입별로 허용되는 레이아웃만 선택 가능하도록 `SPS_SECTION_DEFS.allowedLayouts`로 데이터화했습니다
  (예: `beforeAfter`는 `comparison`/`split`만, `toc`는 `text-left`/`checklist`만).

## 9. 저장·불러오기 호환 방식

Thumbnail Studio의 `thumbnailStudio` 필드와 동일한 패턴으로 `atlasCollectDraft`에 `salesPageStudio:
APP.salesPageStudio||null` 1개 필드만 추가했습니다(총 3줄 변경: 수집 1줄, 복원 1줄, `SalesPageStudio.init()`
호출 1줄). 구버전 드래프트(필드 없음)를 불러오면 `SalesPageStudio.init()`이 현재 `APP.ebook` 데이터로
안전한 기본 상태를 새로 만들어 오류 없이 로드됩니다. 전자책이 바뀌면(`sourceEbookKey` 불일치) 이전
프로젝트의 문구가 새 전자책에 남지 않도록 자동으로 재초기화됩니다.

## 10. 개별 PNG 실제 크기

기존 `dlSpSlide`와 동일한 `html2canvas(el,{scale:2,useCORS:true,allowTaint:true})` 파라미터를 그대로
재사용했습니다. 카드 자체가 `width:540px;height:675px`(CSS)로 고정되어 있어, Export 결과물은 항상
**1080×1350px**입니다. Playwright 테스트에서 다운로드된 PNG 파일의 IHDR 청크를 직접 파싱해 실제
1080×1350px임을 확인했습니다.

## 11. ZIP 파일 수·이름·순서

활성화된 섹션만, 현재 화면 순서대로 순차 캡처해 JSZip으로 묶습니다. 8개 섹션이 모두 켜져 있을 때
ZIP 내부 파일이 정확히 8개이며, 이름은 `sales-01-hero.png`부터 `sales-08-cta.png`까지 현재 활성 섹션
순서 기준으로 번호가 매겨짐을 확인했습니다. 섹션 하나를 비활성화한 뒤 재생성하면 ZIP 파일 수가 7개로
정확히 줄어드는 것도 확인했습니다. 일부 카드 캡처가 실패하면 ZIP을 생성하지 않고 오류로 보고합니다
(부분 성공을 전체 성공으로 보고하지 않음).

## 12. Playwright 단계별 결과

| Phase | 내용 | 결과 |
|---|---|---|
| 1 | 화면 골격, 진입/복귀, 기존 화면 회귀 | 통과 — 버튼 6개 정상 공존, 진입/복귀 정상 |
| 2 | 상태·기본 섹션 8개·데이터 매핑·구조 빌더 | 통과 — 8개 행, 기본 선택 hero, On/Off·순서 이동·경계 가드 정상 |
| 3 | 텍스트 편집·테마·레이아웃·Live Preview | 통과 — 입력 중 포커스 유지 확인, 테마/레이아웃 active 표시 확인, TOC 실제 챕터 표시 확인 |
| 4 | 저장/불러오기 | 통과 — 저장→새로고침→복원 값 일치, 구버전 draft 호환, 전자책 변경 시 자동 재초기화 |
| 5 | 개별 PNG Export | 통과 — 1080×1350px 실측 확인, html2canvas 미로드 오류 처리 확인 |
| 6 | 전체 ZIP Export | 통과 — 파일 수/이름/순서 확인, On/Off 반영 확인, JSZip 미로드 오류 처리 확인 |
| 7 | 전체 회귀 + 콘솔 오류 | 통과 — 아래 13, 14 참고 |

## 13. 기존 기능 회귀 결과

Playwright로 아래를 모두 확인했으며, 전부 정상(회귀 없음)입니다.

- 기존 "🛒 썸네일 + 상세페이지" 버튼 → 테마 모달 → 9장 카드뉴스 렌더 → 기존 크몽 썸네일/리스팅 렌더
- 🎯 Thumbnail Studio 진입/편집/미리보기, Thumbnail Intelligence 분석 패널 정상 표시
- 결과 화면의 6개 액션 버튼(새 프로젝트/Word 저장/썸네일+상세페이지/Thumbnail Studio/Sales Page
  Studio/필요한 부분만 수정)이 전부 정상 공존

## 14. 콘솔 오류

`ReferenceError`/`TypeError`/`SyntaxError` 없음. 관측된 콘솔 오류는 전부 이 개발 샌드박스가
`cdnjs.cloudflare.com`(JSZip/html2canvas) 및 Google Fonts 접근을 차단해서 발생하는
`ERR_TUNNEL_CONNECTION_FAILED`/`ERR_CONNECTION_RESET`/404이며, 애플리케이션 로직과 무관합니다(기존
Milestone들과 동일한 환경 제약).

## 15. 실제 API 미검증 사항

- 유효한 Anthropic API 키가 없어, 이번 Milestone과 무관하게 전자책/판매 문구 실제 AI 생성 경로 자체가
  검증된 적이 없습니다(Sales Page Studio는애초에 실제 API를 호출하지 않고 규칙 기반 매핑만 사용).
- `html2canvas`/`JSZip`은 CDN 차단으로 실제 라이브러리 렌더링을 검증하지 못했고, 기존 Milestone들과
  동일하게 스텁(stub) 함수로 파이프라인(옵션 전달, 파일 생성, 정확한 픽셀 크기, ZIP 파일 개수)만
  검증했습니다. 실제 라이브러리로 렌더링된 이미지/ZIP 품질은 인터넷이 연결된 실제 사용자 환경에서 별도
  확인이 필요합니다.

## 16. 발견하고 수정한 버그

애플리케이션 코드에서 발견된 버그는 없습니다. 개발 중 발견한 문제 1건은 테스트 스크립트 자체의
문제였습니다(`docs/BUG_TRACKER.md`의 "테스트 스크립트 문제" 섹션 참고): 커스텀 토글 스위치의 실제
`<input type="checkbox">`가 `opacity:0`으로 숨겨져 있어 Playwright가 이를 직접 클릭하면 "not visible"로
판단하는 문제 — 실제 사용자는 스위치 전체(`<label>`)를 클릭하므로 앱 동작 자체는 정상이며, 테스트
스크립트에서 클릭 대상을 `<label class="sps-toggle">`로 바꿔 해결했습니다.

## 17. 남은 제한사항

- FAQ 섹션 없음(v1 범위 밖, `BL-030`)
- 섹션 순서 변경은 위/아래 버튼만 지원, Drag & Drop 없음(`BL-031`)
- Sales Page Studio 전용 품질 점수/추천(Sales Page Intelligence) 없음(`BL-032`)
- 실제 `html2canvas`/`JSZip` 렌더링 품질은 인터넷이 연결된 실제 환경에서 별도 확인 필요
- 모바일 화면에서의 실사용성은 데스크톱 우선 반응형 CSS만 적용되어 있어 추가 검증 필요

## 18. 후속 Milestone 후보

- Milestone 2.6 Before/After Comparison(기존 후보, 착수 여부 미정)
- Sales Page Studio FAQ 섹션 추가(`BL-030`)
- Sales Page Intelligence(`BL-032`) — Thumbnail Intelligence 패턴 재사용 검토 가능

## 19. git status

```
On branch claude/milestone-3-sales-page-studio
nothing to commit, working tree clean
```

커밋 `b0a01cb` 이후 추가 변경 없음.

## 20. Push 결과

`git push -u origin claude/milestone-3-sales-page-studio` 실행 결과, 과거 Milestone 1~4와 동일하게
`403 The requested URL returned error: 403`(Resource not accessible by integration)으로 실패했습니다.
지시에 따라 재시도하지 않았습니다. 현재 커밋(`b0a01cb`) 기준 GitHub Desktop 반영용 ZIP은 생성
가능하며, 필요 시 안내해 드립니다.
