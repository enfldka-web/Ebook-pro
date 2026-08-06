/* js/thumbnail-theme-engine.js — V3 Phase 2 Round 2: Selectable Thumbnail Theme
   System.

   Atlas 썸네일 테마는 "선택 가능한, 안정적인 디자인 규칙 묶음"이다 — 매 생성마다
   달라지는 5개 Creative Director Concept(문제 중심/상품 중심/인물 스토리/비포·애프터/
   증거와 과정, js/creative-director-adapter.js STRATEGIES)과는 다른 개념이다.
   Concept이 "이 책을 어떤 각도로 보여줄까"라면, Theme은 "그 각도를 어떤 상업적
   스타일로 조판할까"다. 사용자가 테마 하나를 고르면 5개 Concept 전부가 같은
   테마 규칙 위에서 생성된다.

   Theme과 Brand Pack(js/design-system.js)은 서로 다른, 독립적인 축이다:
   - Theme(이 파일) = 구도/정보 위계/목업 배치/텍스트 위치/상업적 제시 전략
   - Brand Pack = 색 무드/타이포그래피 성격/장식 언어/일러스트 무드
   Brand Pack은 Theme이 정한 레이아웃/위계를 절대 깨지 않는다(색과 장식만 관여).

   V3 Phase 2 Round 4: 실제 판매 중인 커머셜 썸네일(크몽/스마트스토어류) 다수를
   비교 분석해 공통 원칙(헤드라인 내 숫자 강조, 더 지배적인 헤드라인 크기)을
   4개 테마 각각에 그 테마의 정체성에 맞는 정도로만 반영했다 — 4개 테마를 하나로
   합치거나 서로 비슷하게 만드는 것이 아니라, 각자의 개성은 그대로 둔 채 품질만
   전체적으로 끌어올린다. titleScale은 테마마다 그 전부터 있던 상대적 크기
   순서(Publisher Premium이 가장 절제됨 < Marketplace Impact/Problem Solver
   중간 < Bestseller Editorial이 가장 지배적)를 유지한 채 소폭 상향했다.
   numberEmphasis(신규)는 헤드라인 안의 숫자만 accentHex로 강조하는 옵션이다 —
   Publisher Premium은 "차분하고 요란한 그래픽 요소 없음" 정체성을 지키기 위해
   끈다.

   순수 함수만 담는다(DOM 없음) — Node에서 독립적으로 테스트 가능하다. 실제
   Canvas 합성(js/atlas-overlay-engine.js)과 Scene 조립(js/creative-director-
   adapter.js)은 이 파일이 반환하는 "규칙"만 읽어 쓸 뿐, 이 파일은 다른 어떤
   모듈도 직접 호출하지 않는다(단방향 의존). */

window.AtlasThumbnailThemeEngine = window.AtlasThumbnailThemeEngine || {};

(function(TTE){

  /* Atlas 실전 디지털 상품(크몽류 실용 가이드)이 핵심 포지셔닝이므로, 옛 프로젝트에
     테마가 없을 때(thumbnailThemeId 없음)의 안전한 기본값은 "문제 해결형"이다. */
  TTE.DEFAULT_THEME_ID = 'problemSolver';

  /* 각 테마의 sceneModifiers는 실제 이미지 생성 Scene의 기존 필드(composition/
     productMockup/style/safeArea)에 덧붙일 "영문 문구"만 담는다 — 새 필드를
     추가하지 않고, js/provider-neutral-prompt-composer.js가 이미 참조하는
     14개 화이트리스트 필드 구조를 그대로 재사용한다(STYLE_MODIFIERS 패턴과 동일,
     image-generation-ui.js:142-147 기존 선례). */
  TTE.THEMES = [
    {
      id: 'publisherPremium',
      name: 'Publisher Premium',
      nameKo: '퍼블리셔 프리미엄',
      oneLiner: '출판사가 낸 전문 서적 같은 신뢰감',
      useCase: '프리미엄 가이드, 전문 지식, 비즈니스 전자책',
      /* V3 Phase 2 Round 7: creativeDirection은 archetype이 만든 일반적인 camera/
         style를 통째로 대체하는(덧붙이는 게 아니라) 이 테마만의 진짜 창작 방향이다
         — "Luxury / Minimal / Editorial / Premium publishing"(사용자가 지정한
         정확한 방향). 이전까지 4개 테마는 camera/style을 archetype library에서
         그대로 물려받고 composition/productMockup/style에만 장식 문구를 덧붙였을
         뿐이라, 실제 AI 이미지 생성 단계에서는 4개 테마가 사실상 같은 사진을
         요청하고 있었다(확인된 핵심 결함) — 이제 테마가 카메라 언어 자체를 정한다. */
      creativeDirection: {
        cameraOverride: 'a static, perfectly level hero shot, camera locked on-axis with generous symmetrical negative space, absolutely no dynamic tilt, motion blur, or dramatic angle',
        styleOverride: 'luxury minimalist editorial photography styled like a premium publishing-house campaign — restrained, sophisticated, quietly confident, gallery-quality production value, no busy or loud visual elements anywhere in the frame'
      },
      sceneModifiers: {
        composition: ', editorial book-cover composition, a single confident visual anchor centered with generous negative space around it, restrained and minimal, no clutter',
        productMockup: ', rendered as a clean professional hardcover book or tablet-display mockup, nothing else sharing the frame',
        safeArea: ', with a calm uncluttered band reserved for small, restrained typography'
      },
      overlay: {
        preferredSafeAreaName: 'bottom',
        titleScale: 0.85,
        maxLines: 2,
        badgeShow: false,
        ctaShow: false,
        decorativeLimit: 'minimal',
        whitespaceScale: 1.25,
        numberEmphasis: false
      },
      fallbackLongTitle: 'shrink headline gently, never show a badge/CTA to compensate — the quiet composition is the point',
      fallbackComplexBackground: 'prefer the calmest region even if it means a smaller text band; never force a busy area'
    },
    {
      id: 'problemSolver',
      name: 'Problem Solver',
      nameKo: '문제 해결형',
      oneLiner: '독자의 문제와 실용적 가치를 3초 안에 전달',
      useCase: '실전 가이드, 하우투 전자책, 페인포인트 중심 상품',
      /* "Transformation / Before vs After / Action / Practical / Solution-focused" */
      creativeDirection: {
        cameraOverride: 'a dynamic 45-degree angle with a slight low tilt, camera positioned to capture motion and momentum, energetic and practical framing',
        styleOverride: 'bold contemporary transformation photography with clear before-and-after storytelling energy, high clarity, practical and action-oriented commercial mood, confident and energetic'
      },
      sceneModifiers: {
        composition: ', clear problem-to-solution visual hierarchy, one dominant focal point, ample dedicated space for a bold promise-led headline',
        productMockup: ', shown supporting the problem-solution story, not the sole focus of the frame',
        safeArea: ', with a strong high-contrast band reserved for a bold promise-led headline and a clear call to action'
      },
      overlay: {
        preferredSafeAreaName: 'bottom',
        titleScale: 1.12,
        maxLines: 2,
        badgeShow: true,
        ctaShow: true,
        decorativeLimit: 'moderate',
        whitespaceScale: 0.95,
        numberEmphasis: true
      },
      fallbackLongTitle: 'shrink headline first; drop CTA before the headline ever becomes illegible (existing engine priority)',
      fallbackComplexBackground: 'adapt safe-area placement freely — clarity of the promise matters more than a fixed position'
    },
    {
      id: 'bestsellerEditorial',
      name: 'Bestseller Editorial',
      nameKo: '베스트셀러 에디토리얼',
      oneLiner: '전문적으로 디자인된 베스트셀러 느낌',
      useCase: '인사이트, 전략, 마인드셋, 교육 상품',
      /* "Bookstore bestseller / Dominant typography / Authority / Publishing".
         V3 Phase 2 Round 7 fix: 이전 composition 문구("a literal product photo
         가 아니라...")는 product-as-hero archetype처럼 실제로 상품을 프레임의
         주인공으로 요구하는 Composition Director 출력과 정면으로 모순됐다(같은
         프롬프트 안에서 Style/Composition/Product가 서로 다른 그림을 요청하는
         확인된 버그) — 어떤 archetype과 짝지어져도 모순되지 않도록 "그 시각적
         중심이 상품이든 상징 그래픽이든" 형태로 바꿨다. */
      creativeDirection: {
        cameraOverride: 'a locked, perfectly centered magazine-cover shot, camera level with no tilt, framed exactly like a bestseller book-cover photoshoot',
        styleOverride: 'modern nonfiction bestseller book-cover photography, dominant typography-first sensibility, confident editorial authority, sophisticated limited color palette, avoids a generic AI-art look'
      },
      sceneModifiers: {
        composition: ', book-cover-first composition with one confident central visual anchor — whether that anchor is the product mockup itself or a symbolic graphic, keep it singular, intentional, and free of clutter',
        productMockup: ', treated as a deliberate, confident visual anchor rather than a casual product shot',
        safeArea: ', with a bold dominant zone sized for large-scale display typography'
      },
      overlay: {
        preferredSafeAreaName: 'bottom',
        titleScale: 1.22,
        maxLines: 2,
        badgeShow: true,
        ctaShow: false,
        decorativeLimit: 'moderate',
        whitespaceScale: 1.0,
        numberEmphasis: true
      },
      fallbackLongTitle: 'shrink headline before ever hiding it — the headline typography IS the cover, not a caption on top of one',
      fallbackComplexBackground: 'prefer the region that keeps the central graphic concept fully visible'
    },
    {
      id: 'marketplaceImpact',
      name: 'Marketplace Impact',
      nameKo: '마켓플레이스 임팩트',
      oneLiner: '작은 목록 썸네일로 보여도 선명한 상품 인지',
      useCase: '한국 디지털 상품 마켓플레이스, 크리에이터 플랫폼',
      /* "Marketplace listing / Commercial / High CTR / Digital product / Conversion-first" */
      creativeDirection: {
        cameraOverride: 'a tight, immediate commercial product framing, camera close enough that the subject reads instantly even at a small size, no wasted peripheral space',
        styleOverride: 'high-CTR marketplace-listing commercial photography, punchy contrast, instant product-category recognition, optimized for a crowded browsing grid'
      },
      sceneModifiers: {
        composition: ', compact high-clarity composition optimized for a small marketplace listing thumbnail, a clear focal hierarchy readable even at reduced display size',
        productMockup: ', clearly recognizable and prominent even when the image is shown small',
        safeArea: ', with a compact high-contrast band for short bold text that stays legible at small listing sizes'
      },
      overlay: {
        preferredSafeAreaName: 'bottomTight',
        titleScale: 0.88,
        maxLines: 2,
        badgeShow: true,
        ctaShow: true,
        decorativeLimit: 'minimal',
        whitespaceScale: 0.85,
        numberEmphasis: true
      },
      fallbackLongTitle: 'shrink aggressively; the engine drops CTA before subheadline (same priority as every other theme) — short bold recognition matters more than a full sentence at listing size',
      fallbackComplexBackground: 'always prefer the calmest compact band — listing-size legibility overrides visual variety'
    }
  ];

  var THEMES_BY_ID = {};
  TTE.THEMES.forEach(function(t){ THEMES_BY_ID[t.id] = t; });

  /* 알 수 없거나 없는 themeId(구버전 프로젝트)는 항상 안전한 기본 테마로
     떨어진다 — 로딩/내보내기가 절대 깨지지 않는다. */
  TTE.getTheme = function(themeId){
    return THEMES_BY_ID[themeId] || THEMES_BY_ID[TTE.DEFAULT_THEME_ID];
  };

  /* 마침표 뒤에 콤마로 시작하는 접미사를 그냥 이어붙이면 "...typography., with
     a calm..." 같은 구두점 깨짐이 생긴다(확인된 버그) — 접미사를 붙이기 전에
     원본 문장의 마지막 마침표를 제거해 항상 자연스러운 콤마 이어짐이 되게 한다. */
  function appendClause(base, suffix){
    var trimmed = String(base || '').replace(/[.\s]+$/, '');
    return trimmed + suffix;
  }

  /* 순수 함수 — baseScene을 변경하지 않고 새 객체를 반환한다. 테마를 바꿔도
     이전 테마의 문구가 누적되지 않도록, 항상 "손대지 않은 원본 Scene"에서
     다시 계산한다(호출자는 card._baseEngineScene처럼 원본을 별도 보관해야 함).

     V3 Phase 2 Round 7: camera/style은 더 이상 archetype 출력에 문구를 덧붙이지
     않는다 — theme.creativeDirection이 있으면 통째로 대체한다(테마가 실제로
     다른 카메라/연출을 요청해야 4개 테마가 실제로 다른 이미지를 만든다는 요구
     사항). composition/productMockup/safeArea는 여전히 archetype이 정한 장면
     구조 위에 이 테마의 상업적 표현 방식만 덧붙이는 접미사로 남는다. */
  TTE.applyThemeToScene = function(baseScene, themeId){
    var theme = TTE.getTheme(themeId);
    var scene = Object.assign({}, baseScene);
    var mods = theme.sceneModifiers;
    ['composition', 'productMockup', 'safeArea'].forEach(function(field){
      var suffix = mods[field];
      if(!suffix) return;
      if(field === 'composition' && scene.composition && typeof scene.composition === 'object'){
        scene.composition = Object.assign({}, scene.composition, { description: appendClause(scene.composition.description, suffix) });
      }else{
        scene[field] = appendClause(scene[field], suffix);
      }
    });
    var cd = theme.creativeDirection;
    if(cd){
      if(cd.cameraOverride) scene.camera = cd.cameraOverride;
      if(cd.styleOverride) scene.style = cd.styleOverride;
    }
    scene.thumbnailThemeId = theme.id;
    return scene;
  };

  /* Overlay Engine에 넘길 테마 규칙만 뽑는다 — 색은 절대 포함하지 않는다(색은
     항상 실제 이미지 픽셀에서만 나온다는 atlas-overlay-engine.js의 원칙 유지). */
  TTE.getOverlayOptions = function(themeId){
    var theme = TTE.getTheme(themeId);
    return Object.assign({ themeId: theme.id }, theme.overlay);
  };

})(window.AtlasThumbnailThemeEngine);
