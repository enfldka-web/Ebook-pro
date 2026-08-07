/* js/thumbnail-composition-engine.js — V3 Phase 2 Round 5: Composition Engine.

   지금까지의 Round(2~4)는 전부 타이포그래피/색/그림자 수준의 튜닝이었다 —
   4개 테마가 실제로는 전부 "이미지 위에 하단 텍스트 밴드 하나" 라는 같은
   구조를 공유하고, 크기/색/굵기만 달랐다. 사용자가 지적한 핵심 결함이 바로
   이것이다: "타이포그래피가 아니라 구도 자체가 달라져야 한다."

   이 파일은 각 Thumbnail Theme에 "여러 개의 Layout Family(레이아웃 계열)"를
   부여한다 — 같은 테마를 골라도 5개 Concept 전체가 매번 똑같은 구조로
   찍히지 않고, 그 테마 정체성 안에서 서로 다른 실제 시각 구조(목업 배치,
   피사체 배치, 텍스트 흐름, 정보 밀도, 보조 그래픽)로 나온다.

   핵심 장치: panelSide. 대부분의 Layout Family는 캔버스를 "사진 영역"과
   "실제 이미지 픽셀에서 뽑은 단색/그라데이션 패널 영역"으로 나눈다 — 이렇게
   하면 텍스트가 항상 색이 통제된 영역 위에 앉아 가독성이 구조적으로
   보장되고(적응형 밝기 분석에 기대지 않아도 됨), 동시에 "사진 왼쪽 절반 +
   텍스트 오른쪽 패널" 같은 실제로 다른 화면 구조가 나온다. panelSide:'none'
   인 Family(각 테마의 기존 기본형)는 기존 Round 1~4의 적응형 Safe Area
   로직을 그대로 쓴다 — 회귀 없음.

   V3 Phase 2 Round 6(아트 디렉션 개선): 실제 AI 배경 생성이 이 샌드박스에서
   막혀 있어(네트워크 차단, 계속 공개된 제약) "배경 사진 안에 책/태블릿이
   나오길 기대"할 수 없다 — 대신 mockupType으로 Atlas가 직접 그리는 벡터
   목업(책/태블릿/문서 묶음)을 각 Layout Family에 배치한다. 이렇게 하면 실제
   생성 결과와 무관하게 "이 전자책의 실물감"이 항상 보장된다. mockupRect는
   텍스트 영역과 겹치지 않도록 Family마다 미리 계산해 둔 위치다.

   순수 함수만 담는다(DOM 없음) — Node에서 독립적으로 테스트 가능하다. 실제
   Canvas 합성(js/atlas-overlay-engine.js)이 이 파일이 반환하는 "구조 규칙"만
   읽어 그린다. Theme(js/thumbnail-theme-engine.js)이 "이 테마가 쓸 수 있는
   Layout Family 목록"을 정의하고, 이 파일은 그 목록 자체(각 Family가
   구체적으로 어떤 구조인지)와 선택 로직만 담당한다 — 서로 다른 책임. */

window.AtlasThumbnailCompositionEngine = window.AtlasThumbnailCompositionEngine || {};

(function(CE){

  /* 테마별 Layout Family 목록. 각 테마는 최소 2개를 갖는다 — 하나는 기존
     "적응형 전체 사진 + 하단 텍스트 밴드"(panelSide:'none', Round 1~4 그대로),
     다른 하나는 그 테마의 상업적 정체성에 맞는 진짜 다른 구조다. */
  CE.LAYOUT_FAMILIES = {
    publisherPremium: [
      {
        id: 'quietBottom', name: '차분한 하단 배치',
        panelSide: 'none', textAlign: 'left', supportingGraphic: 'none',
        mockupType: 'book', mockupRect: { x: 0.58, y: 0.05, w: 0.40, h: 0.58 }
      },
      {
        id: 'framedCentered', name: '중앙 정렬 프레임',
        // 출판사 표지처럼: 사진은 위쪽 큰 영역에, 아래 여백 패널에 제목이
        // 가운데 정렬로 조용히 앉는다 — 목업이 항상 주인공, 텍스트는 캡션.
        panelSide: 'bottom', panelRatio: 0.30, panelColorMode: 'muted', textAlign: 'center', supportingGraphic: 'none',
        mockupType: 'book', mockupRect: { x: 0.30, y: 0.06, w: 0.40, h: 0.62 }
      }
    ],
    problemSolver: [
      {
        id: 'boldBottom', name: '볼드 하단 배치',
        panelSide: 'none', textAlign: 'left', supportingGraphic: 'checkArrow',
        mockupType: 'document', mockupRect: { x: 0.56, y: 0.04, w: 0.44, h: 0.50 }
      },
      {
        id: 'splitPanel', name: '좌우 분할 패널',
        // 문제(사진)는 왼쪽, 해결책(헤드라인+CTA)은 오른쪽 색 패널 — 실제
        // "문제→해결" 시각 흐름을 구조 자체로 표현한다.
        panelSide: 'right', panelRatio: 0.44, panelColorMode: 'accent', textAlign: 'left', supportingGraphic: 'dividerLine',
        mockupType: 'document', mockupRect: { x: 0.05, y: 0.24, w: 0.46, h: 0.54 }
      }
    ],
    bestsellerEditorial: [
      {
        id: 'dominantBottom', name: '지배적 하단 배치',
        // 베스트셀러 표지의 정체성은 "타이포그래피 자체가 표지"다 — 별도
        // 목업 아이콘을 얹는 대신, 캔버스 왼쪽 가장자리에 얇은 책등(스파인)
        // 선 하나만 그어 "이것 자체가 표지"라는 느낌을 은은하게 강화한다.
        panelSide: 'none', textAlign: 'left', supportingGraphic: 'spineLine', mockupType: 'none'
      },
      {
        id: 'centeredBand', name: '중앙 띠 배치',
        // 앨범/베스트셀러 표지처럼 제목이 캔버스 정중앙 띠에 앉고, 위아래로
        // 이미지가 보인다 — 상단/하단 어느 쪽에도 치우치지 않는 대칭 구도.
        // V3 Phase 2 Round 10: 0.34(166px)는 이 테마의 titleScale(1.65, 4개
        // 테마 중 가장 큼)이 실제로 지배적으로 나오기엔 너무 좁은 예산이었다
        // (실제 렌더링에서 확인 — 배지+헤드라인+서브헤드가 다른 Family의
        // 0.38 Safe Area보다도 좁은 공간에 눌려 자동 축소됐다) — "타이포그래피
        // 자체가 표지"라는 이 테마의 정체성에 맞게 띠 자체를 넓힌다.
        panelSide: 'centerBand', panelRatio: 0.52, panelColorMode: 'muted', textAlign: 'center', supportingGraphic: 'spineLine',
        mockupType: 'none'
      }
    ],
    marketplaceImpact: [
      {
        id: 'bottomTightCompact', name: '컴팩트 하단 배치',
        panelSide: 'none', textAlign: 'left', supportingGraphic: 'none',
        mockupType: 'tablet', mockupRect: { x: 0.55, y: 0.04, w: 0.43, h: 0.44 }
      },
      {
        id: 'cornerCard', name: '코너 카드 배치',
        // 실제 마켓플레이스 리스팅에서 흔한 패턴: 사진은 전체가 그대로 보이고,
        // 좌하단에 둥근 카드 하나만 얹어 정보를 압축해서 보여준다.
        panelSide: 'corner', cornerAnchor: 'bottomLeft', cornerRatio: { w: 0.58, h: 0.4 },
        panelColorMode: 'accent', textAlign: 'left', supportingGraphic: 'cornerAccent',
        mockupType: 'tablet', mockupRect: { x: 0.56, y: 0.04, w: 0.42, h: 0.42 }
      }
    ]
  };

  /* 문자열 seed(예: jobId, concept id)를 안정적으로 0~n-1 인덱스로 해시한다 —
     같은 Concept/이미지는 항상 같은 Layout Family를 쓰되(재생성해도 구조가
     흔들리지 않음), Concept마다는 실제로 다른 구조가 나오게 한다. */
  function stableHash(str){
    str = String(str||'');
    var h = 0;
    for(var i=0;i<str.length;i++){ h = ((h<<5)-h+str.charCodeAt(i))|0; }
    return Math.abs(h);
  }

  CE.getLayoutFamilies = function(themeId){
    return CE.LAYOUT_FAMILIES[themeId] || CE.LAYOUT_FAMILIES.problemSolver;
  };

  CE.pickLayoutFamily = function(themeId, seed){
    var families = CE.getLayoutFamilies(themeId);
    if(!seed) return families[0];
    var idx = stableHash(seed) % families.length;
    return families[idx];
  };

  CE.getLayoutFamilyById = function(themeId, familyId){
    var families = CE.getLayoutFamilies(themeId);
    var found = families.filter(function(f){ return f.id === familyId; })[0];
    return found || families[0];
  };

})(window.AtlasThumbnailCompositionEngine);
