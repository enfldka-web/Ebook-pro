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
      /* V3 Phase 2 Round 11: 사용자가 첨부한 Golden Reference(실제 크몽/전자책
         마켓 판매 썸네일)는 4개 테마 전부 "장면 사진"이 아니라 "상품 자체의
         스튜디오 제품샷"이다 — 인물/사무실/일상 장면이 등장하는 예시가 단
         하나도 없었다(확인됨). Publisher Premium은 그중에서도 실제 3D 책
         표지 목업이 단색/그라데이션 스튜디오 배경 위에 단독으로 떠 있는
         "제품 사진" 그 자체다 — "편집적 사진"이 아니라 "책 제품샷"으로
         재정의한다. */
      /* V3 Phase 2 Round 19: 사용자가 첨부한 "Atlas V3 썸네일 테마 예시 이미지"
         20장 그리드(다운로드용 레퍼런스)를 재분석한 결과, Publisher Premium은
         책 목업 단독이 아니라 "책 + 작고 절제된 소품 하나"(빈티지 알람시계,
         화분 잎사귀, 만년필, 커피잔+받침)가 함께 있는 데스크 프로덕트샷이었다
         — Round 17에서 "nothing else sharing the frame"으로 소품까지 전부
         금지한 건 이 레퍼런스와 어긋난다(당시엔 "아이콘 2개가 경쟁하는" 버그와
         "소품 하나가 책을 보조하는" 정상 구성을 구분하지 못하고 통째로 막았음).
         이제 책이 항상 명확한 주인공이라는 전제 하에 소품 1개까지만 허용한다. */
      creativeDirection: {
        cameraOverride: 'a static, perfectly level studio product shot, camera locked on-axis with generous symmetrical negative space, absolutely no dynamic tilt, motion blur, or dramatic angle',
        styleOverride: 'a single professional 3D book-cover product render as the clear, dominant hero, floating on a clean, richly saturated solid color or deep-toned gradient studio background (such as deep navy, charcoal, emerald, or burgundy — never pastel, cream, beige, washed-out, or low-saturation tones) — optionally paired with exactly one small, tasteful complementary prop placed to one side (such as a vintage alarm clock, a single potted plant leaf, a fountain pen, or a coffee cup and saucer), always much smaller in scale and clearly secondary in visual weight to the book, no cluttered scene, no busy room setting, no human figures, no people, no faces, no hands, no body parts anywhere in the frame, restrained and quietly confident, gallery-quality production value',
        /* V3 Phase 2 Round 17: 실제 GPT Image 결과물에서 (1) 인물 사진이 나오고
           (2) 파스텔/크림톤 배경이 반복되는 문제가 실측으로 확인됐다 — 원인은
           금지 문구가 지금까지 style 산문(prose) 안에만 있었고, 실제로 별도
           "Avoid:" негative 채널(provider-neutral-prompt-composer.js)에는 전혀
           전달되지 않았기 때문이다(campaign 레벨 negativePrompt만 쓰였고, 그마저
           NEGATIVE_TERM_LIMIT=6에 걸려 앞 6개 항목만 살아남는 구조였음 — 둘 다
           같이 고쳤다). negativePromptAddition은 이 테마의 negativePrompt 맨
           앞에 우선 삽입되어 잘리지 않고 실제로 전달된다(applyThemeToScene 참고,
           Sales Page 경로에는 적용하지 않음 — 일부 Sales Page 역할은 인물이
           필요할 수 있으므로 썸네일 전용). */
        negativePromptAddition: 'human figures, people, faces, hands, body parts, photographs of people, pastel colors, cream background, beige background, muted colors, washed-out colors'
      },
      sceneModifiers: {
        composition: ', editorial book-cover composition, a single confident product-mockup anchor centered with generous negative space around it — at most one small supporting prop may sit to one side, restrained and minimal, no clutter',
        productMockup: ', rendered as a clean professional hardcover book or tablet-display mockup as the dominant hero object — at most one small supporting prop (such as a clock, a plant, a pen, or a cup) may share the frame, always clearly secondary in size and focus to the book',
        safeArea: ', with a calm uncluttered band reserved for small, restrained typography'
      },
      overlay: {
        preferredSafeAreaName: 'bottom',
        titleScale: 1.00,
        maxLines: 2,
        badgeShow: false,
        ctaShow: false,
        decorativeLimit: 'minimal',
        whitespaceScale: 1.15,
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
      /* Golden Reference의 Problem Solver 예시(블로그 수익/영어 회화/상세페이지/
         집중력/SEO)는 전부 "단색 배경 + 하나의 큼직한 플랫 벡터 아이콘 또는
         일러스트"다(화살표+동전, 말풍선, 장바구니+그래프, 과녁, 돋보기+그래프) —
         사진이 아니라 일러스트/아이콘 그래픽이다. */
      /* V3 Phase 2 Round 19: 레퍼런스 그리드의 Problem Solver 5개 예시(화살표+동전,
         말풍선+STEP123, 장바구니+상승 그래프, 과녁+체크마크, 돋보기+막대그래프)는
         전부 "완전히 단일 도형 하나"가 아니라 "긴밀하게 연결된 최대 2개 요소가
         합쳐져 하나의 아이디어처럼 읽히는 아이콘"이다 — Round 17의 "오직 하나의
         원시 도형만"이라는 제약은 이 레퍼런스보다 더 엄격했다(실제 버그였던
         "서로 무관한 아이콘 2개가 경쟁"하는 것과, "하나의 이야기를 이루는 2개
         요소"를 구분해 후자는 허용한다). */
      creativeDirection: {
        cameraOverride: 'a flat, slightly dynamic diagonal graphic-design layout suggesting forward momentum, no camera angle or lens simulation, no depth of field, no photographic tilt',
        styleOverride: 'bold flat vector icon illustration — one single cohesive icon graphic built from at most two tightly integrated elements that together read as one unified idea at a glance (for example: an arrow rising through stacked coins, a shopping cart beside a rising bar chart, a target with checkmarks, a speech bubble with a simple numbered step sequence, or a magnifying glass over a bar chart). Never combine two unrelated or visually competing icons. Rendered large and centered, on a solid, richly saturated background color (such as deep orange, vivid teal, strong red, or royal blue — never pastel, cream, beige, muted, or washed-out tones), no photography, no realistic scene, no lifestyle setting, no human figures, no people, no faces, no hands, no body parts, clean modern marketplace-listing graphic-design energy',
        negativePromptAddition: 'human figures, people, faces, hands, body parts, photographs of people, pastel colors, cream background, beige background, muted colors, washed-out colors, two unrelated separate icons, cluttered multiple symbols'
      },
      sceneModifiers: {
        composition: ', clear problem-to-solution visual hierarchy, one single cohesive icon graphic as the only focal point (at most two tightly related elements forming one idea) — do not add an unrelated second icon or graphic element, ample dedicated space for a bold promise-led headline',
        productMockup: ', visually merged into the single cohesive icon graphic already described in the style direction — do not introduce a separate, unrelated icon or object',
        safeArea: ', with a strong high-contrast band reserved for a bold promise-led headline and a clear call to action'
      },
      overlay: {
        preferredSafeAreaName: 'bottom',
        titleScale: 1.40,
        maxLines: 2,
        badgeShow: true,
        ctaShow: true,
        decorativeLimit: 'moderate',
        whitespaceScale: 0.88,
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
      /* Golden Reference의 Bestseller Editorial 예시(체스 말, 뇌 일러스트, 빛이
         들어오는 문, 산 정상, 금박 리본)는 인물이 아니라 "타이포그래피를 뒷받침하는
         상징적 단일 오브젝트(사진 또는 파인라인 일러스트) 하나"다 — 장면이 아니라
         상징이다. */
      /* V3 Phase 2 Round 19: 레퍼런스 그리드의 Bestseller Editorial 5개 예시는
         전부 어둡고 진한 톤이 아니었다 — 체스 말(밝은 오프화이트), 뇌 일러스트
         (따뜻한 탄/베이지)처럼 주제(심리·성찰)에 따라 의도적으로 따뜻한 아이보리
         /고급 종이 톤을 쓰는 경우도 있었고, 문/산/리본은 짙은 브론즈·네이비·
         블랙이었다 — Round 17에서 cream/beige를 이 테마에도 통째로 금지한 건
         과했다(실제 문제였던 "탁하고 저채도로 흐릿하게 나오는 것"과, "의도적으로
         선택한 따뜻한 아이보리 톤"은 다르다 — 후자는 대비가 뚜렷하면 이 테마의
         정당한 스타일이다). */
      creativeDirection: {
        cameraOverride: 'a locked, perfectly centered magazine-cover shot, camera level with no tilt, framed exactly like a bestseller book-cover photoshoot',
        styleOverride: 'modern nonfiction bestseller book-cover art — choose exactly ONE single symbolic object (a chess piece, OR a fine-line illustration, OR a doorway, OR a mountain peak, OR a ribbon — never combine more than one) rendered as a quiet supporting visual behind dominant typography, confident editorial authority. Use a sophisticated color palette matched to the topic\'s mood — either a rich, deep tone (charcoal, bronze, deep navy, black) or a warm ivory/aged-paper tone — always with strong, clean tonal contrast between the symbolic object and the background, never a flat, washed-out, or low-contrast pastel. No busy scene, no lifestyle setting, no human figures, no people, no faces, no hands, no body parts, avoids a generic AI-art look',
        negativePromptAddition: 'human figures, people, faces, hands, body parts, photographs of people, pastel colors, muted colors, washed-out colors, low-contrast colors, multiple symbolic objects combined'
      },
      sceneModifiers: {
        composition: ', book-cover-first composition with one confident central symbolic anchor — whether that anchor is the product mockup itself or a symbolic graphic, keep it singular, intentional, and free of clutter',
        productMockup: ', treated as the same single deliberate, confident symbolic anchor described above — not a second additional graphic',
        safeArea: ', with a bold dominant zone sized for large-scale display typography'
      },
      overlay: {
        preferredSafeAreaName: 'bottom',
        titleScale: 1.65,
        maxLines: 2,
        badgeShow: true,
        ctaShow: false,
        decorativeLimit: 'moderate',
        whitespaceScale: 0.92,
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
      /* Golden Reference의 Marketplace Impact 예시(ChatGPT/엑셀/프리미어 프로/
         스마트스토어/블로그)는 전부 "단색 비비드 배경 + 화면 중앙의 큼직한 앱
         아이콘/픽토그램 하나"다 — 사진이 전혀 없다. 목록 크기에서도 즉시
         인식되는 것이 핵심이라 사진보다 아이콘이 실제로 더 유리하다. */
      /* V3 Phase 2 Round 19: 레퍼런스 그리드의 Marketplace Impact 5개 예시(ChatGPT/
         엑셀/프리미어 프로/스마트스토어/블로그)는 5개 중 3개가 흰색/거의 흰색
         배경 위에 브랜드 컬러 아이콘 하나였다(항상 비비드 단색 배경이 아니었음)
         — 목록 크기에서 즉시 인식되는 게 핵심이라는 이 테마의 목적상 흰 배경도
         정당한 선택지다. Round 17의 "항상 비비드 색 배경"은 이 레퍼런스보다
         좁은 제약이었다 — 이제 흰 배경/비비드 배경 둘 다 허용한다. */
      creativeDirection: {
        cameraOverride: 'a flat, perfectly frontal graphic-design layout, no camera angle or lens simulation, no depth of field, no dynamic tilt',
        styleOverride: 'exactly ONE single large, bold flat icon or simple app-style pictogram — never two or more icons together — centered on either a clean white/near-white background or a solid, richly saturated vivid brand-relevant color background (such as hot pink, electric blue, deep purple, or vivid green) — never a pastel, cream, beige, muted, or washed-out tone. Ultra-simple high-CTR marketplace-listing graphic design, punchy contrast, instant category recognition even at a tiny size, no photography, no realistic scene, no human figures, no people, no faces, no hands, no body parts',
        negativePromptAddition: 'human figures, people, faces, hands, body parts, photographs of people, pastel colors, cream background, beige background, muted colors, washed-out colors, multiple icons combined'
      },
      sceneModifiers: {
        composition: ', compact high-clarity composition optimized for a small marketplace listing thumbnail, one single dominant flat icon as the only focal hierarchy — do not add a second icon, readable even at reduced display size',
        productMockup: ', rendered as the same single bold flat icon or pictogram already described in the style direction — not an additional separate icon, clearly recognizable and prominent even when the image is shown small',
        safeArea: ', with a compact high-contrast band for short bold text that stays legible at small listing sizes'
      },
      overlay: {
        preferredSafeAreaName: 'bottomTight',
        titleScale: 1.15,
        maxLines: 2,
        badgeShow: true,
        ctaShow: true,
        decorativeLimit: 'minimal',
        whitespaceScale: 0.78,
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
      /* V3 Phase 2 Round 17: prose 안의 "no human figures" 같은 부정 지시는
         실제 생성 결과에서 무시되는 사례가 실측으로 확인됐다 — 반드시 별도
         negativePrompt("Avoid:" 라인)에도 같은 제약을 넣어야 한다. 캠페인
         레벨 negativePrompt(sharedBrief.negativeInstructions)를 지우지 않고
         맨 앞에 이 테마의 항목을 붙인다 — provider-neutral-prompt-composer.js의
         trimNegative가 앞 N개만 남기므로, 맨 앞에 있어야 실제로 살아남는다. */
      if(cd.negativePromptAddition){
        scene.negativePrompt = scene.negativePrompt
          ? (cd.negativePromptAddition + ', ' + scene.negativePrompt)
          : cd.negativePromptAddition;
      }
    }
    scene.thumbnailThemeId = theme.id;
    return scene;
  };

  /* Atlas Product Workflow Redesign (Round 12) — Thumbnail-to-Sales-Page
     테마 연속성. 사용자가 Stage4에서 고른 썸네일 테마가 Stage5 상세페이지
     생성에도 "같은 하나의 판매 캠페인"으로 그대로 이어져야 한다는 요구사항의
     실제 구현이다. 새 시각 규칙을 발명하지 않고, 이미 검증된 theme.creativeDirection
     (camera/style override)을 상세페이지 Scene에도 동일하게 적용한다 — 썸네일과
     상세페이지가 항상 같은 카메라 언어/연출 방향을 쓰게 되어 "하나의 캠페인처럼
     보인다"는 요구를 코드 재사용만으로 만족한다(새 디자인 판단 없음). composition/
     productMockup/safeArea 접미사는 archetype/role마다 의미가 달라 상세페이지에는
     적용하지 않는다(썸네일 전용 문구이므로) — camera/style만 재사용한다.

     V3 Phase 2 Round 27: 사용자가 실제로 확인한 뒤 "선택한 썸네일 스타일과
     상세페이지가 동일하게 나와야 한다"고 명시적으로 재요구했다 — camera/style
     프롬프트 문구만 재사용하고 negativePromptAddition은 빼둔 채였던 이전 버전은
     실제로는 "산문에만 있는 지시"였다(Round 17에서 실측으로 확인된 바로 그
     패턴 — 산문 속 "no human figures"는 무시되고, 별도 Avoid 채널에 있어야
     실제로 지켜진다). 즉 상세페이지도 진짜로 같은 테마 스타일을 지키게
     하려면 이 negativePromptAddition을 썸네일과 동일하게 넣어야 한다 — 이제
     빼지 않고 그대로 적용한다(썸네일 전용이라는 이전 판단을 실사용 피드백으로
     번복). 일부 역할(pain/beforeAfter/targetAudience 등)의 mainSubject가
     인물을 언급할 수 있으나, Avoid 채널이 실제로 우선 적용되는 채널이므로
     결과적으로 4개 테마 전부가 원래 정체성대로(인물 없는 제품/아이콘 중심)
     상세페이지에서도 지켜진다 — 이것이 바로 "동일한 스타일"이 실제로 의미하는
     바다. */
  TTE.applyThemeToSalesPageScene = function(baseScene, themeId){
    var theme = TTE.getTheme(themeId);
    var scene = Object.assign({}, baseScene);
    var cd = theme.creativeDirection;
    if(cd){
      if(cd.cameraOverride) scene.camera = cd.cameraOverride;
      if(cd.styleOverride) scene.style = cd.styleOverride;
      if(cd.negativePromptAddition){
        scene.negativePrompt = scene.negativePrompt
          ? (cd.negativePromptAddition + ', ' + scene.negativePrompt)
          : cd.negativePromptAddition;
      }
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

  /* V3 Phase 2 Round 30: 테마별 예시 이미지 파일 경로 — STEP2 미리보기(js/
     ai-planner.js)와 STEP4 실제 썸네일 후보(js/image-generation-ui.js)가
     정확히 같은 5개 파일을 같은 순서로 참조해야 "미리 본 예시 = 실제 결과"가
     보장된다(사용자가 실측으로 발견한 "선택한 예시와 생성 결과가 다르다"는
     불일치의 근본 수정 — 두 화면이 각자 따로 계산하지 않고 이 한 곳만 본다). */
  var THEME_ASSET_BASE = { publisherPremium:'publisher-premium', problemSolver:'problem-solver', bestsellerEditorial:'bestseller-editorial', marketplaceImpact:'marketplace-impact' };
  TTE.themeAssetBase = function(themeId){
    var theme = TTE.getTheme(themeId);
    return THEME_ASSET_BASE[theme.id] || THEME_ASSET_BASE[TTE.DEFAULT_THEME_ID];
  };
  TTE.themeExampleFiles = function(themeId){
    var base = TTE.themeAssetBase(themeId);
    return [base+'.png', base+'-2.png', base+'-3.png', base+'-4.png', base+'-5.png'];
  };

})(window.AtlasThumbnailThemeEngine);
