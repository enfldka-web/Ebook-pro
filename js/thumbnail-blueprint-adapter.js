/* thumbnail-blueprint-adapter.js — Milestone 3.2 Phase 7: Thumbnail Rendering Integration
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §7 Thumbnail Engine, design.md

   새 Engine이 아니다. 새 전략/철학 판단을 하지 않는다. js/thumbnail-engine.js가 이미
   결정한 Thumbnail Blueprint 값을 Thumbnail Studio가 실제로 렌더링할 수 있는 CSS/DOM
   속성으로 "번역"만 하는 순수 함수 모음이다 — Brand Pack 이름으로 분기하지 않고,
   BrandProfile을 다시 읽거나 재판단하지 않으며, Blueprint/BrandProfile/Marketing Copy
   객체를 어디에서도 변형(mutate)하지 않는다.

   모든 함수는 입력 → 출력만 있는 순수 함수다(부작용 없음, DOM/APP 접근 없음). */

window.AtlasThumbnailBlueprintAdapter = window.AtlasThumbnailBlueprintAdapter || {};

(function(TBA){

  /* ── Blueprint.pattern → Thumbnail Studio layoutId ──
     6개 Pattern 전부 서로 다른 layoutId로 매핑한다. 'Top Banner'는 기존 6개 layoutId
     중 어디에도 대응하지 않아 새 layoutId('top-banner')를 하나 추가한다 — 새 Studio나
     새 Engine이 아니라 기존 "레이아웃 선택" 옵션을 하나 더 추가하는 것뿐이다. */
  TBA.LAYOUT_ID_BY_PATTERN = {
    'Comparison':'comparison', 'Icon Focus':'icon-focus', 'Left Image':'left-image',
    'Right Image':'right-image', 'Center Text':'center-text', 'Top Banner':'top-banner'
  };
  TBA.COLOR_ID_BY_STRATEGY = { authority:'black', trust:'blue', relationship:'orange' };

  /* 알 수 없는 Pattern/전략이 들어오면 null을 반환한다 — 호출 측이 기존 기본값을
     그대로 유지하도록(임의로 다른 값을 지어내지 않음, Never Guess). */
  TBA.layoutIdForPattern = function(pattern){ return TBA.LAYOUT_ID_BY_PATTERN[pattern] || null; };
  TBA.colorIdForStrategy = function(strategy){ return TBA.COLOR_ID_BY_STRATEGY[strategy] || null; };

  var NEGATIVE_SPACE_INSET = { small:24, medium:40, large:64 };
  TBA.negativeSpaceInset = function(v){ return NEGATIVE_SPACE_INSET[v] || NEGATIVE_SPACE_INSET.medium; };

  var TEXT_WEIGHT_CSS = { bold:900, regular:500, medium:700 };
  TBA.textWeightCss = function(v){ return TEXT_WEIGHT_CSS[v] || TEXT_WEIGHT_CSS.regular; };

  /* visualHierarchy(예: ['headline','badge','cta'])의 순서로 시각적 크기 우선순위를 매긴다.
     배열의 앞쪽일수록 더 크게 — 새 판단이 아니라 이미 Blueprint가 정한 순서를 폰트
     크기 차이로 "표현"만 한다. */
  var HIERARCHY_BASE_SIZE = { headline:34, subheadline:16, badge:12, cta:13 };
  TBA.hierarchySizes = function(visualHierarchy){
    var sizes = {};
    Object.keys(HIERARCHY_BASE_SIZE).forEach(function(k){ sizes[k] = HIERARCHY_BASE_SIZE[k]; });
    var order = Array.isArray(visualHierarchy) ? visualHierarchy : [];
    order.forEach(function(key,i){
      if(!(key in sizes)) return;
      var boost = i===0 ? 6 : (i===1 ? 2 : 0);
      sizes[key] = HIERARCHY_BASE_SIZE[key] + boost;
    });
    return sizes;
  };

  /* ── 자동 보정(요구사항 10, Phase 7.1 보강): 긴 제목/부제는 폰트 크기를 줄인다.
     실제 렌더링에서는 이 값과 별개로 CSS line-clamp를 항상 함께 적용해
     "3줄 초과" 자체를 만들지 않도록 이중 안전장치를 둔다. */
  TBA.autoFitHeadlineSize = function(title, baseSize){
    baseSize = baseSize || HIERARCHY_BASE_SIZE.headline;
    var n = String(title||'').length;
    if(n<=14) return baseSize;
    var reduced = baseSize - Math.round((n-14)*0.55);
    return Math.max(19, Math.min(baseSize, reduced));
  };
  TBA.autoFitSubtitleSize = function(sub, baseSize){
    baseSize = baseSize || HIERARCHY_BASE_SIZE.subheadline;
    var n = String(sub||'').length;
    if(n<=28) return baseSize;
    var reduced = baseSize - Math.round((n-28)*0.16);
    return Math.max(11, Math.min(baseSize, reduced));
  };

  /* ── Phase 7.1: 폭 인지형 Headline 맞춤 ──
     실제 렌더 영역 폭(availableWidth)을 받아 "2줄 이내"를 우선 목표로 폰트 크기를
     계산하고, 2줄로 안 되면 3줄까지만 허용한다(그 이상 줄이지 않는다 — 무조건 작게만
     만드는 방식 금지). 최소 크기(minSize)에서도 3줄을 넘으면 그 크기를 그대로 반환하고
     — 절대 line-clamp/overflow:hidden으로 잘라내지 않는다("제목 잘림 금지"). 한글
     기준 글자 폭을 fontSize의 약 0.92배로 근사한다(고정폭에 가까운 한글 특성 활용). */
  var HEADLINE_CHAR_WIDTH_RATIO = 0.92;
  TBA.fitHeadlineFontSize = function(title, availableWidth, opts){
    opts = opts || {};
    var maxSize = opts.maxSize || HIERARCHY_BASE_SIZE.headline;
    var minSize = opts.minSize || 22;
    var n = String(title||'').length;
    availableWidth = availableWidth || 400;
    if(!n) return maxSize;
    function linesAt(size){
      var perLine = Math.max(1, Math.floor(availableWidth/(size*HEADLINE_CHAR_WIDTH_RATIO)));
      return Math.ceil(n/perLine);
    }
    // 1차: 2줄 목표
    for(var size=maxSize; size>=minSize; size--){
      if(linesAt(size)<=2) return size;
    }
    // 2차: 2줄이 불가능하면 3줄까지 허용
    for(var size2=maxSize; size2>=minSize; size2--){
      if(linesAt(size2)<=3) return size2;
    }
    // 그래도 안 되면(극단적으로 긴 제목) 최소 크기 유지 — 잘라내지 않고 자연스럽게 더 흐르게 둔다.
    return minSize;
  };

  /* 제목이 아주 길 때는 부제를 숨겨 제목에 공간을 더 준다(문구 자체는 바꾸지 않음 —
     표시 여부만 조정). */
  TBA.shouldShowSubtitle = function(title){
    return String(title||'').length <= 42;
  };

  /* ── Phase 7.1: Badge 자동 보정 — ellipsis보다 패딩/폰트/최대폭을 먼저 조정 ── */
  TBA.fitBadgeFontSize = function(hook, baseSize){
    baseSize = baseSize || HIERARCHY_BASE_SIZE.badge;
    var n = String(hook||'').length;
    if(n<=14) return baseSize;
    return Math.max(10, baseSize - Math.round((n-14)*0.25));
  };
  TBA.fitBadgeMaxWidth = function(hook){
    var n = String(hook||'').length;
    return n<=14 ? 200 : Math.min(320, 200 + (n-14)*6);
  };

  /* ── Phase 7.1: CTA 대비 텍스트 색상 — Brand Theme accent 위에서 항상 읽히도록
     상대 휘도를 계산해 밝은 accent에는 어두운 글자, 어두운 accent에는 밝은 글자를
     선택한다(임의 색상이 아니라 accent 자체에서 유도한 흑/백 두 값만 사용). */
  function relLuminanceHex(hex){
    var m = /#([0-9a-fA-F]{6})/.exec(hex||'');
    if(!m) return 0.5;
    var v = m[1];
    var r=parseInt(v.substr(0,2),16)/255, g=parseInt(v.substr(2,2),16)/255, b=parseInt(v.substr(4,2),16)/255;
    function ch(c){ return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
    return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b);
  }
  TBA.ctaTextColorFor = function(accentHex){
    var lum = relLuminanceHex(accentHex);
    var contrastWithBlack = (lum+0.05)/0.05;
    var contrastWithWhite = 1.05/(lum+0.05);
    return contrastWithBlack >= contrastWithWhite ? '#0c0c1a' : '#ffffff';
  };

  /* ── Highlight Words(요구사항 7) ──
     - 제목에 실제로 존재하는 단어만 강조한다(존재하지 않으면 무시).
     - 항상 escFn으로 이스케이프한 뒤 조립한다 — 원본 문자열을 그대로 innerHTML에
       흘려보내지 않으므로 HTML injection이 불가능하다.
     - 강조 대상 글자 수 합이 제목 길이의 80% 이상이면(=사실상 전체 강조) 강조를
       생략해 "제목 전체가 강조되지 않도록" 제한한다.
     - 최대 2개까지만 강조한다(Thumbnail Engine이 이미 highlightWords를 최대 2개로
       제한하지만, 방어적으로 여기서도 한 번 더 자른다). */
  TBA.highlightedTitleHtml = function(title, highlightWords, escFn){
    var esc = escFn || function(s){ return String(s||''); };
    title = String(title||'');
    var words = (Array.isArray(highlightWords) ? highlightWords : [])
      .filter(function(w){ return w && typeof w==='string' && w.length>=2 && title.indexOf(w)>=0; })
      .slice(0,2);
    if(!title.length || !words.length) return esc(title);
    var totalLen = words.reduce(function(sum,w){ return sum+w.length; },0);
    if(totalLen/title.length >= 0.8) return esc(title);

    var segments = [{text:title, hl:false}];
    words.forEach(function(w){
      var next = [];
      segments.forEach(function(seg){
        if(seg.hl){ next.push(seg); return; }
        var idx = seg.text.indexOf(w);
        if(idx<0){ next.push(seg); return; }
        if(idx>0) next.push({text:seg.text.slice(0,idx), hl:false});
        next.push({text:seg.text.slice(idx, idx+w.length), hl:true});
        var rest = seg.text.slice(idx+w.length);
        if(rest) next.push({text:rest, hl:false});
      });
      segments = next;
    });
    return segments.map(function(seg){
      var escaped = esc(seg.text);
      return seg.hl ? ('<span class="ts-highlight">'+escaped+'</span>') : escaped;
    }).join('');
  };

  /* ── backgroundStyle → 배경 장식(brandStrategy 기반, 기존 AtlasDesignSystem 카드
     장식과는 별개의 레이어로 얹는다 — 기존 디자인 테마 장식을 대체하지 않음). ── */
  var BACKGROUND_DECORATIONS = {
    'dark-premium': function(accent){ return '<div style="position:absolute;inset:0;background:radial-gradient(circle at 85% 15%,'+accent+'26,transparent 55%);pointer-events:none;z-index:0"></div>'; },
    'light-clean':  function(accent){ return '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.06),transparent 42%);pointer-events:none;z-index:0"></div>'; },
    'warm-soft':    function(accent){ return '<div style="position:absolute;inset:0;background:radial-gradient(circle at 15% 88%,'+accent+'2b,transparent 60%);pointer-events:none;z-index:0"></div>'; },
    'neutral':      function(){ return ''; }
  };
  TBA.backgroundDecoration = function(backgroundStyle, accent){
    var fn = BACKGROUND_DECORATIONS[backgroundStyle] || BACKGROUND_DECORATIONS.neutral;
    return fn(accent);
  };

  /* ── iconStyle/imageStyle → 이미지·아이콘 placeholder 박스 스타일 ── */
  var ICON_BOX_STYLE = {
    'line':       function(accent){ return 'border:1px solid '+accent+'66;background:transparent'; },
    'outline':    function(accent){ return 'border:2px dashed '+accent+'88;background:'+accent+'12'; },
    'hand-drawn': function(accent){ return 'border:2px solid '+accent+'aa;background:'+accent+'16;border-radius:46% 54% 61% 39%/48% 42% 58% 52%'; }
  };
  TBA.iconBoxStyle = function(iconStyle, accent){
    var fn = ICON_BOX_STYLE[iconStyle] || ICON_BOX_STYLE.line;
    return fn(accent);
  };
  var IMAGE_BOX_FILL = {
    'minimal':  function(accent){ return 'background:rgba(255,255,255,.04);border:1px solid '+accent+'40'; },
    'balanced': function(accent){ return 'background:rgba(255,255,255,.07);border:1px solid '+accent+'55'; },
    'warm':     function(accent){ return 'background:'+accent+'22;border:1px solid '+accent+'55'; }
  };
  TBA.imageBoxStyle = function(imageStyle, accent){
    var fn = IMAGE_BOX_FILL[imageStyle] || IMAGE_BOX_FILL.balanced;
    return fn(accent);
  };

  /* ── Phase 7.1: 빈 이미지 영역 fallback visual ──
     외부 이미지/AI 이미지 없이 CSS만으로 "문서/체크리스트" 모티프의 겹친 카드
     mockup을 그린다 — 실제 최종 결과물처럼 보이는 장식이되, 사진인 척하지 않는다.
     Brand Theme accent 색상만 사용한다(임의 색상 금지). */
  TBA.imageMockupHtml = function(imageStyle, iconStyle, accent){
    var fill = IMAGE_BOX_FILL[imageStyle] || IMAGE_BOX_FILL.balanced;
    var iconBox = ICON_BOX_STYLE[iconStyle] || ICON_BOX_STYLE.line;
    var rows = [86,64,46].map(function(w,i){
      return '<div style="height:9px;border-radius:5px;width:'+w+'%;background:'+accent+(i===0?'99':'55')+'"></div>';
    }).join('');
    return '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">'
      +'<div style="position:relative;width:80%;height:66%">'
      +'<div style="position:absolute;inset:0;transform:rotate(-6deg);border-radius:14px;'+fill(accent)+'"></div>'
      +'<div style="position:absolute;inset:0;transform:rotate(4deg);border-radius:14px;background:rgba(255,255,255,.05);border:1px solid '+accent+'30"></div>'
      +'<div style="position:absolute;inset:9%;border-radius:11px;background:rgba(0,0,0,.22);border:1px solid '+accent+'55;padding:14%;box-sizing:border-box;display:flex;flex-direction:column;gap:9px;justify-content:center">'
      + rows
      +'<div style="margin-top:8px;width:26px;height:26px;border-radius:50%;'+iconBox(accent)+';display:flex;align-items:center;justify-content:center;font-size:12px;color:'+accent+'">✓</div>'
      +'</div></div></div>';
  };

  /* Icon Focus: 빈 원이 아니라 동심원("포커스/타겟") 모티프 — iconStyle을 실제로 반영한다. */
  TBA.iconMockupHtml = function(iconStyle, accent, size){
    size = size || 140;
    var box = ICON_BOX_STYLE[iconStyle] || ICON_BOX_STYLE.line;
    return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;'+box(accent)+';display:flex;align-items:center;justify-content:center">'
      +'<div style="width:68%;height:68%;border-radius:50%;border:2px solid '+accent+'55;display:flex;align-items:center;justify-content:center">'
      +'<div style="width:42%;height:42%;border-radius:50%;background:'+accent+'38;border:1px solid '+accent+'80"></div>'
      +'</div></div>';
  };

  /* ── Phase 7.1: Comparison 완성 — BEFORE(흐림/✕) / AFTER(강조/✓) 카드 + 방향 화살표.
     실제 수치나 성과를 만들지 않고, 구조적 대비(밝기·테두리·체크 아이콘)로만 "변화
     방향"을 표현한다. */
  TBA.comparisonPanelsHtml = function(accent, panelWidth){
    panelWidth = panelWidth || 260;
    var beforeRows = [70,55,40].map(function(w){
      return '<div style="height:7px;border-radius:4px;width:'+w+'%;background:rgba(255,255,255,.16)"></div>';
    }).join('');
    var afterRows = [88,72,58].map(function(w){
      return '<div style="height:7px;border-radius:4px;width:'+w+'%;background:'+accent+'80"></div>';
    }).join('');
    return {
      before: '<div style="width:'+panelWidth+'px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.14);padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:9px">'
        +'<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:rgba(255,255,255,.5);letter-spacing:.5px">'
        +'<span style="width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.35);display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:rgba(255,255,255,.6)">✕</span>BEFORE</div>'
        + beforeRows + '</div>',
      after: '<div style="width:'+panelWidth+'px;border-radius:14px;background:'+accent+'16;border:1px solid '+accent+'60;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:9px">'
        +'<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:'+accent+';letter-spacing:.5px">'
        +'<span style="width:16px;height:16px;border-radius:50%;background:'+accent+';color:#0c0c1a;display:inline-flex;align-items:center;justify-content:center;font-size:9px">✓</span>AFTER</div>'
        + afterRows + '</div>',
      arrow: '<div style="font-size:22px;font-weight:900;color:'+accent+'">→</div>'
    };
  };

  /* ── Phase 7.1: 배경 깊이 — backgroundStyle별로 다른 절제된 텍스처를 추가해
     "넓은 단색 배경"으로 보이지 않게 한다. Brand Theme accent만 사용한다. */
  var DEPTH_TEXTURES = {
    'dark-premium': function(accent){ return 'background-image:radial-gradient(circle,'+accent+'22 1px,transparent 1.4px);background-size:22px 22px;opacity:.5'; },
    'light-clean':  function(accent){ return 'background-image:linear-gradient('+accent+'12 1px,transparent 1px),linear-gradient(90deg,'+accent+'12 1px,transparent 1px);background-size:28px 28px;opacity:.35'; },
    'warm-soft':    function(accent){ return 'background-image:radial-gradient(circle,'+accent+'20 2px,transparent 2.4px);background-size:26px 26px;opacity:.4'; },
    'neutral':      function(accent){ return 'background-image:radial-gradient(circle,'+accent+'18 1px,transparent 1.4px);background-size:24px 24px;opacity:.3'; }
  };
  TBA.depthTexture = function(backgroundStyle, accent){
    var fn = DEPTH_TEXTURES[backgroundStyle] || DEPTH_TEXTURES.neutral;
    return '<div style="position:absolute;inset:0;pointer-events:none;z-index:0;'+fn(accent)+'"></div>';
  };

  /* ── Blueprint → Render Props ──
     입력 blueprint를 절대 변형하지 않는다(모든 필드는 새 객체/배열로 복사). null이면
     null을 반환해 호출 측이 "Blueprint 없음" 상태(기존 렌더링 그대로 유지)를 그대로
     처리하게 한다. */
  TBA.deriveRenderProps = function(blueprint){
    if(!blueprint) return null;
    return {
      textAlignment: blueprint.textAlignment || 'center',
      textWeight: blueprint.textWeight || 'regular',
      negativeSpace: blueprint.negativeSpace || 'medium',
      visualHierarchy: Array.isArray(blueprint.visualHierarchy) ? blueprint.visualHierarchy.slice() : [],
      highlightWords: Array.isArray(blueprint.highlightWords) ? blueprint.highlightWords.slice() : [],
      iconStyle: blueprint.iconStyle || 'line',
      imageStyle: blueprint.imageStyle || 'balanced',
      backgroundStyle: blueprint.backgroundStyle || 'neutral',
      /* Phase 7.1 Fallback Renderer는 이 필드를 쓰지 않는다(colorId를 TS.init()에서
         별도로 이미 결정) — Phase 8 Claude Style Renderer가 mood(분위기) 프리셋을
         고르는 데 쓴다. 추가만 했을 뿐 기존 동작에는 영향 없음. */
      colorStrategy: blueprint.colorStrategy || 'neutral'
    };
  };

})(window.AtlasThumbnailBlueprintAdapter);
