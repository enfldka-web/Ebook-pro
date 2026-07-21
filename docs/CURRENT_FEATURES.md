# CURRENT FEATURES — Atlas AI eBook Studio

Milestone 1(구조 정리) 시작 시점 기준으로, 코드에서 실제로 확인한 기능 목록입니다.
이번 마일스톤은 아래 기능 중 어느 것도 추가/삭제/변경하지 않았습니다.

## 인증 / 계정
- 랜딩 페이지
- 로그인 (계정이 없으면 자동 생성) / 회원가입 / 로그아웃
- 플랜 UI (FREE/BETA 배지 표시)

## 대시보드
- 통계 카드, 최근 생성한 전자책 목록
- 히스토리(내 전자책 목록), 설정 화면

## 전자책 생성 워크플로우
- 입력 방식 3종: 파일 업로드 / 주제 입력 / URL 입력 (+ 멀티 소스 추가)
- 스마트 인터뷰 (AI가 생성한 질문에 답변)
- 제목 스튜디오 (AI 제목 후보 선택)
- 생성 진행 화면 (진행률 표시)
- Claude API(`api.anthropic.com/v1/messages`) 호출로 전자책 본문 생성
  (서문/서론/7개 챕터/결론/부록)

## 결과 화면
- 결과 에디터 (`renderCvEbook`) — 리치에디터 툴바(폰트 크기, 이미지 삽입 등)
- 크몽 썸네일 자동 생성/선택/다운로드
- 상세페이지(판매페이지) 생성 (`renderCvSalesPage`) — 후킹, 페인포인트, FAQ, 후기 등
- 크몽 리스팅 문구 생성 + 정책(컴플라이언스) 자동 검사·수정
- "선택 부분만 재생성" 부분 편집 (`runAtlasPartialRegeneration`)
- AI 품질 코치 점수 (완성도/가독성/판매력/정책안전도)

## 저장/내보내기
- DOCX 다운로드, 슬라이드/상세페이지 PDF·이미지 다운로드 (JSZip, html2canvas)
- 프로젝트 임시저장/불러오기 (localStorage, `atlas_project_draft_v07`)

## 설정
- API 키 저장/삭제/테스트

## Thumbnail Studio v1 (Milestone 2 신규)
결과 화면(`#cv-result-state`)의 `🎯 Thumbnail Studio` 버튼으로 진입하는 신규 전용 화면(`#cv-thumbstudio-state`). 기존 "썸네일 + 상세페이지"(크몽 4종 미리보기) 흐름과는 완전히 분리된 병렬 기능이며, 서로의 코드/DOM/전역 상태를 공유하지 않는다.
- **Hook Generator**: fallback 문구 5개 추천, 선택, 재생성(셔플), 직접 수정 — 실제 Claude API 연동은 v1 범위 밖(fallback 데이터만 사용)
- **Thumbnail Text Builder**: 메인 제목/부제목/CTA 입력, 입력 즉시 미리보기 반영
- **Template Gallery**: 8개 템플릿(카드형 미리보기), 20개로 확장 가능한 데이터 배열 구조(`THUMB_TEMPLATES`)
- **Color Theme**: Blue/Red/Orange/Black/Green/Purple 6종, 데이터 배열(`TS_COLOR_THEMES`)로 관리
- **Layout Engine**: 좌측/우측 이미지, 중앙 텍스트, 숫자 강조, 비교형, 아이콘형 6종. 템플릿 선택과 독립적으로 재선택 가능(템플릿은 layout의 기본값만 제공)
- **이미지 스타일**: Flat Illustration/Photo/3D/Minimal/Business/Korean 6종 — 실제 이미지 생성 API 호출 없음, Prompt Builder와 미리보기 배지에만 반영
- **Live Preview**: 652×488 고정 비율, 텍스트·템플릿·색상·레이아웃·스타일 변경이 새로고침 없이 즉시 반영
- **Prompt Builder**: 제목·후킹·레이아웃·색상·스타일을 조합한 이미지 생성용 Prompt 자동 생성, 복사, 직접 수정 가능 (생성 로직은 `thumbnail-studio-io.js`에 UI와 분리되어 있음)
- **Export**: PNG/JPG 다운로드, 기존 html2canvas 재사용, 652×488 실측 크기로 생성
- **저장/불러오기 연동**: `APP.thumbnailStudio`가 프로젝트 임시저장에 포함됨. 구버전 저장 데이터(이 필드가 없는 경우)도 정상적으로 불러와지며 기본값으로 대체됨

## Thumbnail Intelligence v1 (Milestone 2.5 신규)
Thumbnail Studio의 실시간 미리보기 하단에 추가된 분석 패널(`window.ThumbnailIntelligence`). 총점은 항상 보이고, 상세 항목·개선 제안·추천은 접이식으로 펼쳐서 본다. **실제 클릭률/매출을 예측하거나 보장하지 않는 내부 휴리스틱 품질 평가**이며, 화면에도 이 문구를 항상 표시한다.
- **Thumbnail Score(총 100점)**: Hook Strength(20)·Readability(15)·Message Clarity(15)·Layout Balance(15)·Text Length(10)·Visual Contrast(10)·Audience Fit(10)·Style Consistency(5) — 전부 순수 함수로 계산되어 같은 입력에는 항상 같은 점수가 나옴(난수 없음)
- **점수 구간 문구**: 90~100 매우 강한 구성 / 75~89 좋은 구성 / 60~74 보통 / 0~59 재구성 권장
- **개선 제안**: 점수가 낮은 항목부터 최대 4개, 실제 글자 수·레이아웃 이름·중복 단어 등 현재 상태를 반영한 문장으로 표시
- **추천 Hook**: 실제 Claude API 호출 없이, Intelligence 전용 문구 풀에서 제목/부제/카테고리 키워드와 결정적 해시로 항상 같은 5개를 추천(무작위 셔플 아님)
- **추천 색상/레이아웃/스타일**: 카테고리·제목 키워드 기반 규칙, 각각 추천 이유 한 줄과 함께 표시
- **적용 버튼**: 각 추천 옆 "적용" 클릭 시 기존 `ThumbnailStudio.setCustomHook/selectColor/selectLayout/selectStyle`에 위임 — 별도 상태 변경 로직 없이 기존 메서드가 이미 처리하는 미리보기 갱신에 얹혀 점수/제안도 함께 자동 재계산됨
- **저장/불러오기**: 점수·추천·개선 제안은 저장하지 않고 항상 재계산. 사용자가 "적용"해서 바뀐 Thumbnail Studio 상태 자체는 기존 저장 기능으로 그대로 저장됨

---
(출처: `PROJECT_ANALYSIS.md`의 코드 분석 결과를 기준으로 재확인함, Milestone 2에서 Thumbnail Studio v1 섹션 추가, Milestone 2.5에서 Thumbnail Intelligence v1 섹션 추가)
