/* thumbnail-studio.js — Milestone 2: Thumbnail Studio v1 (신규 기능, 기존 코드 무수정) */
/* 전역 네임스페이스: window.ThumbnailStudio. onclick/oninput에서 쓰이는 전역 함수는 ts* 래퍼만 노출한다. */

window.ThumbnailStudio = window.ThumbnailStudio || {};

/* Phase 2: 템플릿 데이터 (8개, 20개로 확장 가능한 구조).
   layout은 6종 레이아웃 값 중 하나를 참조한다 (여러 템플릿이 같은 layout을 공유할 수 있음 —
   레이아웃 렌더 로직은 templateId가 아니라 layout 값 기준으로 한 번만 구현한다).
   템플릿 선택은 layoutId의 "기본값"만 정하며, 사용자가 레이아웃을 별도로 다시 선택하면
   layoutId만 바뀌고 templateId(색상 프리셋 등 다른 메타데이터 출처)는 그대로 유지된다. */
var THUMB_TEMPLATES = [
  {id:'left-dark',      name:'좌측 이미지 · 우측 텍스트 (다크)', layout:'left-image',   previewBg:'linear-gradient(135deg,#0b1020,#152b52)', previewAccent:'#f5c451'},
  {id:'right-gradient', name:'우측 이미지 · 좌측 텍스트 (그라데이션)', layout:'right-image',  previewBg:'linear-gradient(135deg,#4f46e5,#9333ea 55%,#ec4899)', previewAccent:'#ffffff'},
  {id:'center-bold',    name:'중앙 대형 제목',                 layout:'center-text',  previewBg:'linear-gradient(135deg,#111417,#1c2128)', previewAccent:'#2dd4bf'},
  {id:'number-focus',   name:'숫자 강조형',                    layout:'number-focus', previewBg:'linear-gradient(135deg,#120805,#3a1208)', previewAccent:'#e84a1f'},
  {id:'comparison',     name:'비교형 (Before/After)',          layout:'comparison',   previewBg:'linear-gradient(135deg,#0f172a,#1e293b)', previewAccent:'#38bdf8'},
  {id:'icon-focus',     name:'아이콘 중심형',                  layout:'icon-focus',   previewBg:'linear-gradient(135deg,#1a0616,#6b21a8)', previewAccent:'#f472b6'},
  {id:'minimal',        name:'미니멀형',                       layout:'center-text',  previewBg:'#faf9f7',                                  previewAccent:'#111827'},
  {id:'business',       name:'비즈니스형',                     layout:'left-image',   previewBg:'linear-gradient(135deg,#0f172a,#334155)', previewAccent:'#e2e8f0'}
];

/* Phase 3: Hook fallback 데이터 — 실제 Claude API 미연동(v1 범위 밖). 명확히 fallback임을
   state.hookSource='fallback'으로 표시한다. */
var TS_HOOK_FALLBACKS = [
  '초보도 가능한','지금 시작해야 하는','한 번 배우면 평생 쓰는','실패 없는 실전 노하우','돈 되는 핵심 전략',
  '아무도 알려주지 않은','하루 10분이면 충분한','생각보다 훨씬 쉬운','바로 써먹는','놓치면 후회하는'
];

var TS_COLOR_THEMES = [
  {id:'blue',   name:'Blue',   bg:'linear-gradient(135deg,#0f172a,#1d4ed8)', accent:'#60a5fa', text:'#ffffff'},
  {id:'red',    name:'Red',    bg:'linear-gradient(135deg,#1a0a0a,#b91c1c)', accent:'#f87171', text:'#ffffff'},
  {id:'orange', name:'Orange', bg:'linear-gradient(135deg,#1c1008,#c2410c)', accent:'#fb923c', text:'#ffffff'},
  {id:'black',  name:'Black',  bg:'linear-gradient(135deg,#000000,#1f2937)', accent:'#e5e7eb', text:'#ffffff'},
  {id:'green',  name:'Green',  bg:'linear-gradient(135deg,#052e16,#15803d)', accent:'#4ade80', text:'#ffffff'},
  {id:'purple', name:'Purple', bg:'linear-gradient(135deg,#1e1b4b,#7e22ce)', accent:'#c084fc', text:'#ffffff'}
];

var TS_LAYOUTS = [
  {id:'left-image',  name:'좌측 이미지 · 우측 텍스트'},
  {id:'right-image', name:'우측 이미지 · 좌측 텍스트'},
  {id:'center-text', name:'중앙 텍스트'},
  {id:'number-focus',name:'숫자 강조'},
  {id:'comparison',  name:'비교형'},
  {id:'icon-focus',  name:'아이콘형'},
  {id:'top-banner',  name:'상단 배너형'}
];

/* 이미지 스타일: v1에서는 실제 이미지 생성 API를 호출하지 않는다(요구사항 원칙 9).
   Prompt Builder(Phase 4)의 입력으로만 쓰이되, 라이브 프리뷰에는 작은 스타일 배지로만
   "즉시 반영"되어 요구사항 F(모든 변경이 미리보기에 즉시 반영)도 함께 만족시킨다. */
var TS_IMAGE_STYLES = [
  {id:'flat',     name:'Flat Illustration', badge:'▲ FLAT'},
  {id:'photo',    name:'Photo',             badge:'📷 PHOTO'},
  {id:'3d',       name:'3D',                badge:'◈ 3D'},
  {id:'minimal',  name:'Minimal',           badge:'― MINIMAL'},
  {id:'business', name:'Business',          badge:'💼 BIZ'},
  {id:'korean',   name:'Korean',            badge:'🇰🇷 KOREAN'}
];

(function(TS){

  function defaultState(){
    return {
      hooks: TS_HOOK_FALLBACKS.slice(0,5),
      hookSource: 'fallback',
      selectedHookIndex: 0,
      customHook: '',
      mainTitle: '',
      subtitle: '',
      cta: '',
      templateId: null,
      colorId: 'blue',
      layoutId: 'center-text',
      styleId: 'flat',
      prompt: '',
      promptManuallyEdited: false,
      /* Milestone 3.2 Phase 7: Thumbnail Engine 2.0 Blueprint의 렌더링 전용 속성
         (textAlignment/textWeight/negativeSpace/visualHierarchy/highlightWords/
         iconStyle/imageStyle/backgroundStyle). null이면(레거시 저장본, Blueprint 없이
         생성된 프로젝트) 기존 렌더링 그대로 동작한다 — js/thumbnail-blueprint-adapter.js
         참고. Studio 자체는 이 값을 재판단하지 않고 그대로 렌더링에만 사용한다. */
      blueprintRender: null,
      /* Milestone 3.2 Phase 8: 'fallback'(Phase 7.1 HTML/CSS Renderer, 기본값·항상
         유지) | 'claude-style'(Phase 8 Claude Style Renderer, js/thumbnail-claude-
         style-renderer.js). 레거시 저장본에는 이 필드가 없으므로 defaultState()의
         'fallback'이 안전한 기본값이 된다 — 기존 동작을 절대 바꾸지 않는다. */
      rendererMode: 'fallback'
    };
  }

  TS.state = defaultState();

  function syncToApp(){
    if(typeof APP!=='undefined') APP.thumbnailStudio = TS.state;
  }

  /* Milestone 3.2 Phase 4/7: Thumbnail Engine 2.0 연결.
     기존 Thumbnail Studio 코드/템플릿/레이아웃은 전혀 삭제하거나 바꾸지 않는다 — Engine이
     만든 Blueprint(js/thumbnail-engine.js)를 "새 프로젝트의 기본값"으로만 반영한다.
     Pattern→layoutId, brandStrategy→colorId 매핑은 js/thumbnail-blueprint-adapter.js가
     소유한다(중복 테이블 금지, 단일 출처). 사용자가 이미 고른 기존 값(TS.state가
     APP.thumbnailStudio에서 복원되는 경우)은 절대 덮어쓰지 않는다 — 아래 블록은 전부
     "새 프로젝트(=APP.thumbnailStudio가 아직 없음)"일 때만 실행된다. */
  TS.init = function(){
    if(typeof APP!=='undefined' && APP.thumbnailStudio){
      TS.state = APP.thumbnailStudio;
      /* Phase 8: rendererMode 필드가 없는 레거시 저장본(Phase 8 이전에 저장됨)은
         'fallback'으로 정규화한다 — 기존 렌더링 결과를 절대 바꾸지 않는다. */
      if(!TS.state.rendererMode) TS.state.rendererMode = 'fallback';
    } else {
      TS.state = defaultState();
      var TBA = (typeof AtlasThumbnailBlueprintAdapter!=='undefined') ? AtlasThumbnailBlueprintAdapter : null;
      if(typeof APP!=='undefined' && APP.thumbnailBlueprint && TBA){
        var bp=APP.thumbnailBlueprint;
        var layoutId = TBA.layoutIdForPattern(bp.pattern);
        var colorId = TBA.colorIdForStrategy(bp.colorStrategy);
        if(layoutId) TS.state.layoutId = layoutId;
        if(colorId) TS.state.colorId = colorId;
        /* Headline/Badge/CTA는 Marketing Copy Engine → Thumbnail Engine을 거쳐 이미
           확정된 값을 그대로 가져온다 — 새 카피를 만들지 않는다. Badge는 기존
           "Hook" 슬롯(hookBadge pill)을 그대로 재사용해 customHook 기본값으로 채운다
           (새 Badge UI를 따로 만들지 않음 — 기존 구조 재사용). */
        if(!TS.state.mainTitle && bp.headline) TS.state.mainTitle = bp.headline;
        if(!TS.state.subtitle && bp.subheadline) TS.state.subtitle = bp.subheadline;
        if(!TS.state.cta && bp.cta) TS.state.cta = bp.cta;
        if(!TS.state.customHook && bp.badge) TS.state.customHook = bp.badge;
        TS.state.blueprintRender = TBA.deriveRenderProps(bp);
      }
      if(typeof APP!=='undefined' && APP.ebook){
        if(!TS.state.mainTitle) TS.state.mainTitle = APP.ebook.title||'';
        if(!TS.state.subtitle) TS.state.subtitle = APP.ebook.subtitle||'';
      }
      syncToApp();
    }
  };

  function activeHookText(){
    if(TS.state.customHook) return TS.state.customHook;
    return TS.state.hooks[TS.state.selectedHookIndex] || TS.state.hooks[0] || '';
  }

  /* ── Hook Generator ── */
  function renderHookSection(){
    var cards = TS.state.hooks.map(function(h,i){
      var active = (i===TS.state.selectedHookIndex) && !TS.state.customHook;
      return '<div class="ts-hook-card'+(active?' active':'')+'" onclick="tsSelectHook('+i+')">'+x(h)+(active?' <span class="ts-tpl-check">✓</span>':'')+'</div>';
    }).join('');
    return '<div class="ts-section">'
      +'<div class="ts-section-title">Hook 문구 추천 <span class="ts-section-sub">(fallback 데이터 — 실제 AI 호출 아님)</span></div>'
      +'<div class="ts-hook-grid">'+cards+'</div>'
      +'<div class="ts-row">'
      +'<button class="ts-btn" onclick="tsRegenerateHooks()">↻ 재생성</button>'
      +'<input class="ts-input" id="ts-custom-hook" placeholder="직접 수정" value="'+x(TS.state.customHook)+'" oninput="tsSetCustomHook(this.value)"/>'
      +'</div></div>';
  }

  TS.selectHook = function(i){
    TS.state.selectedHookIndex = i;
    TS.state.customHook = '';
    syncToApp(); TS.render();
  };
  TS.setCustomHook = function(v){
    TS.state.customHook = v;
    syncToApp(); TS.renderPreviewOnly();
  };
  TS.regenerateHooks = function(){
    // fallback 데이터 셔플로 "재생성"을 시뮬레이션 (실제 Claude API 미호출 — v1 범위 밖)
    var pool = TS_HOOK_FALLBACKS.slice();
    for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=pool[i];pool[i]=pool[j];pool[j]=tmp;}
    TS.state.hooks = pool.slice(0,5);
    TS.state.hookSource = 'fallback';
    TS.state.selectedHookIndex = 0;
    TS.state.customHook = '';
    syncToApp(); TS.render();
  };

  /* ── Thumbnail Text Builder ── */
  function renderTextBuilder(){
    return '<div class="ts-section">'
      +'<div class="ts-section-title">텍스트 편집</div>'
      +'<div class="ts-field"><label>메인 제목</label><input class="ts-input" id="ts-main-title" value="'+x(TS.state.mainTitle)+'" oninput="tsSetField(\'mainTitle\',this.value)"/></div>'
      +'<div class="ts-field"><label>부제목</label><input class="ts-input" id="ts-subtitle" value="'+x(TS.state.subtitle)+'" oninput="tsSetField(\'subtitle\',this.value)"/></div>'
      +'<div class="ts-field"><label>CTA / 보조 문구</label><input class="ts-input" id="ts-cta" value="'+x(TS.state.cta)+'" placeholder="예: 지금 확인하기" oninput="tsSetField(\'cta\',this.value)"/></div>'
      +'</div>';
  }

  TS.setField = function(key, v){
    TS.state[key] = v;
    syncToApp(); TS.renderPreviewOnly();
  };

  /* ── Template Gallery (Phase 2) ── */
  function templateCardHtml(t){
    var active = TS.state.templateId === t.id;
    return '<div class="ts-tpl-card'+(active?' active':'')+'" onclick="tsSelectTemplate(\''+t.id+'\')">'
      +'<div class="ts-tpl-swatch" style="background:'+t.previewBg+'">'
      +'<div class="ts-tpl-swatch-bar" style="background:'+t.previewAccent+'"></div>'
      +'</div>'
      +'<div class="ts-tpl-name">'+x(t.name)+(active?' <span class="ts-tpl-check">✓</span>':'')+'</div>'
      +'</div>';
  }
  function renderTemplateGallery(){
    return '<div class="ts-section">'
      +'<div class="ts-section-title">템플릿 갤러리 <span class="ts-section-sub">('+THUMB_TEMPLATES.length+'개, 추후 확장 가능)</span></div>'
      +'<div class="ts-tpl-grid">'+THUMB_TEMPLATES.map(templateCardHtml).join('')+'</div>'
      +'</div>';
  }
  TS.selectTemplate = function(id){
    var t = THUMB_TEMPLATES.filter(function(v){return v.id===id;})[0];
    if(!t) return;
    TS.state.templateId = id;
    TS.state.layoutId = t.layout;
    syncToApp(); TS.render();
  };

  /* ── Color Theme ── */
  function renderColorSection(){
    var chips = TS_COLOR_THEMES.map(function(c){
      var active = TS.state.colorId===c.id;
      return '<div class="ts-color-chip'+(active?' active':'')+'" style="background:'+c.bg+'" onclick="tsSelectColor(\''+c.id+'\')" title="'+x(c.name)+'">'+(active?'✓':'')+'</div>';
    }).join('');
    return '<div class="ts-section"><div class="ts-section-title">색상 테마</div><div class="ts-color-row">'+chips+'</div></div>';
  }
  TS.selectColor = function(id){
    TS.state.colorId = id;
    syncToApp(); TS.render();
  };

  /* ── Layout Engine (템플릿과 별개로 직접 선택 가능) ── */
  function renderLayoutSection(){
    var opts = TS_LAYOUTS.map(function(l){
      var active = TS.state.layoutId===l.id;
      return '<button class="ts-chip-btn'+(active?' active':'')+'" onclick="tsSelectLayout(\''+l.id+'\')">'+x(l.name)+'</button>';
    }).join('');
    return '<div class="ts-section"><div class="ts-section-title">레이아웃</div><div class="ts-row ts-wrap">'+opts+'</div></div>';
  }
  TS.selectLayout = function(id){
    TS.state.layoutId = id;
    syncToApp(); TS.render();
  };

  /* ── Milestone 3.2 Phase 8: Renderer 모드 선택 (Fallback ↔ Claude Style) ──
     둘 다 같은 #ts-preview-canvas(652×488)에 그리므로 Preview==Export가 그대로
     유지된다. 기본값은 항상 'fallback'이며, 이 선택은 사용자 편집처럼 그대로
     저장/복원된다(APP.thumbnailStudio 전체가 하나의 JSON으로 저장되므로 별도
     배선 없이 기존 저장 구조에 자연스럽게 포함된다). */
  function renderRendererModeSection(){
    var modes = [ {id:'fallback', name:'Fallback (HTML/CSS)'}, {id:'claude-style', name:'Claude Style'} ];
    var opts = modes.map(function(m){
      var active = (TS.state.rendererMode||'fallback')===m.id;
      return '<button class="ts-chip-btn'+(active?' active':'')+'" onclick="tsSelectRendererMode(\''+m.id+'\')">'+x(m.name)+'</button>';
    }).join('');
    return '<div class="ts-section"><div class="ts-section-title">렌더러 <span class="ts-section-sub">(둘 다 652×488 Export 동일)</span></div><div class="ts-row ts-wrap">'+opts+'</div></div>';
  }
  TS.selectRendererMode = function(mode){
    TS.state.rendererMode = (mode==='claude-style') ? 'claude-style' : 'fallback';
    syncToApp(); TS.render();
  };

  /* ── 이미지 스타일 (Prompt Builder 입력 + 미리보기 배지) ── */
  function renderStyleSection(){
    var opts = TS_IMAGE_STYLES.map(function(s){
      var active = TS.state.styleId===s.id;
      return '<button class="ts-chip-btn'+(active?' active':'')+'" onclick="tsSelectStyle(\''+s.id+'\')">'+x(s.name)+'</button>';
    }).join('');
    return '<div class="ts-section"><div class="ts-section-title">이미지 스타일 <span class="ts-section-sub">(Prompt에 반영, 실제 이미지 생성 없음)</span></div><div class="ts-row ts-wrap">'+opts+'</div></div>';
  }
  TS.selectStyle = function(id){
    TS.state.styleId = id;
    syncToApp(); TS.render();
  };

  /* ── Live Preview (652×488 고정 비율, export 대상과 동일 구조) ── */
  function colorTheme(){
    return TS_COLOR_THEMES.filter(function(c){return c.id===TS.state.colorId;})[0] || TS_COLOR_THEMES[0];
  }
  function styleBadge(){
    return (TS_IMAGE_STYLES.filter(function(s){return s.id===TS.state.styleId;})[0]||TS_IMAGE_STYLES[0]).badge;
  }

  /* Milestone 3.2 Phase 7: Blueprint의 headlinePosition/badgePosition/ctaPosition을
     그대로 다시 부르는 대신, js/thumbnail-engine.js의 POSITION_BY_PATTERN과 1:1로
     대응하는 layoutId 기준 표를 둔다(사용자가 Layout을 수동으로 다시 고르면 그
     layoutId 기준 위치를 따라야 하므로 layoutId가 단일 출처다 — Blueprint는 이
     표의 "기본 선택값"만 정해줄 뿐). number-focus는 Blueprint가 도달하지 않는
     수동 전용 옵션이라 기존 구조를 그대로 둔다. */
  var POSITION_BY_LAYOUT_ID = {
    'comparison':  { headlinePosition:'top',    badgePosition:'top-left',  ctaPosition:'bottom' },
    'icon-focus':  { headlinePosition:'center', badgePosition:'top-right', ctaPosition:'bottom' },
    'left-image':  { headlinePosition:'right',  badgePosition:'top-right', ctaPosition:'bottom-right' },
    'right-image': { headlinePosition:'left',   badgePosition:'top-left',  ctaPosition:'bottom-left' },
    'center-text': { headlinePosition:'center', badgePosition:'top-left',  ctaPosition:'bottom' },
    'top-banner':  { headlinePosition:'center', badgePosition:'top-center',ctaPosition:'bottom' }
  };

  /* layoutId별 제목 텍스트가 실제로 놓이는 컬럼 폭(px) — 이미지 placeholder가
     차지하는 옆 컬럼(230px)을 뺀 실제 가용폭을 Headline 폰트 맞춤 계산에 넘긴다
     (Phase 7.1: "제목 영역의 폭... 함께 조정"). */
  var TEXT_COLUMN_WIDTH_BY_LAYOUT = {
    'left-image': 652-230-40, 'right-image': 652-230-40, 'icon-focus': 652-230-40
  };

  function renderLayoutBody(layoutId, ct, hook, title, sub, cta, br){
    var accent=ct.accent, textc=ct.text;
    var TBA = (typeof AtlasThumbnailBlueprintAdapter!=='undefined') ? AtlasThumbnailBlueprintAdapter : null;
    br = br || {};
    var textAlignment = br.textAlignment || 'center';
    var fontWeight = TBA ? TBA.textWeightCss(br.textWeight) : 900;
    var inset = TBA ? TBA.negativeSpaceInset(br.negativeSpace) : 40;
    var sizes = TBA ? TBA.hierarchySizes(br.visualHierarchy) : {headline:34,subheadline:16,badge:12,cta:13};
    var availableWidth = (TEXT_COLUMN_WIDTH_BY_LAYOUT[layoutId] || (652-inset*2));
    var headlineSize = TBA ? TBA.fitHeadlineFontSize(title, availableWidth, {maxSize:sizes.headline}) : sizes.headline;
    var showSubtitle = TBA ? TBA.shouldShowSubtitle(title) : true;
    var subSize = TBA ? TBA.autoFitSubtitleSize(sub, sizes.subheadline) : sizes.subheadline;
    var imageBoxCss = TBA ? TBA.imageBoxStyle(br.imageStyle, accent) : ('border:1px solid var(--ads-border,'+accent+'55);background:rgba(255,255,255,.06)');
    var badgeSize = TBA ? TBA.fitBadgeFontSize(hook, sizes.badge) : sizes.badge;
    var badgeMaxWidth = TBA ? TBA.fitBadgeMaxWidth(hook) : 200;
    var ctaTextColor = TBA ? TBA.ctaTextColorFor(accent) : '#0c0c1a';

    var themeId = (typeof AtlasDesignSystem!=='undefined') ? AtlasDesignSystem.state.themeId : null;
    var underline = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.titleUnderline) ? AtlasDesignSystem.titleUnderline(themeId) : '';

    /* Phase 7.1: 폭 인지형 폰트 맞춤(TBA.fitHeadlineFontSize)이 2~3줄 안에 들어오도록
       이미 계산했으므로, 여기서는 강제 line-clamp/overflow:hidden으로 "잘라내지"
       않는다("제목 잘림 금지") — 자연스러운 줄바꿈만 허용한다. */
    var titleHtml = (TBA && title) ? TBA.highlightedTitleHtml(title, br.highlightWords, x) : x(title||'메인 제목을 입력하세요');
    var titleGroup='<div style="font-size:'+headlineSize+'px;line-height:1.22;font-weight:'+fontWeight+';color:var(--ads-text-primary,'+textc+');word-break:keep-all;font-family:var(--ads-heading-font,inherit);text-align:'+textAlignment+'">'+titleHtml+'</div>'
      + underline
      + (showSubtitle && sub ? ('<div style="font-size:'+subSize+'px;margin-top:10px;color:var(--ads-text-secondary,'+textc+');opacity:.82;word-break:keep-all;font-family:var(--ads-body-font,inherit);text-align:'+textAlignment+';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+x(sub)+'</div>') : '');
    /* Badge: 옅은 pill(태그형) — CTA(버튼형)보다 강조도를 낮춰 계층을 분리한다. */
    var badgeHtml='<div style="display:inline-block;max-width:'+badgeMaxWidth+'px;padding:6px 14px;border-radius:100px;background:var(--ads-primary-soft,'+accent+'2e);border:1px solid var(--ads-primary,'+accent+'99);color:var(--ads-primary,'+accent+');font-size:'+badgeSize+'px;font-weight:700;font-family:var(--ads-accent-font,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+x(hook||'후킹 문구')+'</div>';
    /* CTA: 실제 액션 버튼처럼 — 배경을 채우고 대비 색 텍스트를 사용해 Badge보다 뚜렷하게 만든다. */
    var ctaHtml=cta?('<div style="display:inline-block;padding:10px 20px;border-radius:9px;background:var(--ads-primary,'+accent+');color:'+ctaTextColor+';font-size:'+sizes.cta+'px;font-weight:800;font-family:var(--ads-accent-font,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;box-shadow:0 6px 16px '+accent+'4a">'+x(cta)+' →</div>'):'';

    /* position 키워드(top/bottom/left/right/top-left/top-right/top-center/
       bottom-left/bottom-right) → 절대 위치 CSS. Badge/CTA 각각 독립적으로
       배치해 headlinePosition/badgePosition/ctaPosition을 실제로 반영한다. */
    function boxCss(pos, extra){
      extra = extra || '';
      switch(pos){
        case 'top-left':     return 'position:absolute;top:'+inset+'px;left:'+inset+'px;text-align:left;'+extra;
        case 'top-right':    return 'position:absolute;top:'+inset+'px;right:'+inset+'px;text-align:right;'+extra;
        case 'top-center':   return 'position:absolute;top:'+inset+'px;left:'+inset+'px;right:'+inset+'px;text-align:center;'+extra;
        case 'bottom-left':  return 'position:absolute;bottom:'+inset+'px;left:'+inset+'px;text-align:left;'+extra;
        case 'bottom-right': return 'position:absolute;bottom:'+inset+'px;right:'+inset+'px;text-align:right;'+extra;
        case 'bottom':       return 'position:absolute;bottom:'+inset+'px;left:'+inset+'px;right:'+inset+'px;text-align:center;'+extra;
        case 'top':          return 'position:absolute;top:'+inset+'px;left:'+inset+'px;right:'+inset+'px;text-align:center;'+extra;
        default:              return 'position:absolute;top:'+inset+'px;left:'+inset+'px;right:'+inset+'px;text-align:center;'+extra;
      }
    }

    var pos = POSITION_BY_LAYOUT_ID[layoutId];

    if(layoutId==='left-image'){
      var imgL = TBA ? TBA.imageMockupHtml(br.imageStyle, br.iconStyle, accent) : '';
      return '<div style="position:absolute;left:'+inset+'px;top:'+(inset+20)+'px;bottom:'+(inset+20)+'px;width:170px;border-radius:16px;'+imageBoxCss+';overflow:hidden;z-index:1">'+imgL+'</div>'
        +'<div style="'+boxCss(pos.badgePosition)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:240px;right:'+inset+'px;top:'+(inset+50)+'px;z-index:1">'+titleGroup+'</div>'
        +'<div style="'+boxCss(pos.ctaPosition)+'z-index:2">'+ctaHtml+'</div>';
    }
    if(layoutId==='right-image'){
      var imgR = TBA ? TBA.imageMockupHtml(br.imageStyle, br.iconStyle, accent) : '';
      return '<div style="position:absolute;right:'+inset+'px;top:'+(inset+20)+'px;bottom:'+(inset+20)+'px;width:170px;border-radius:16px;'+imageBoxCss+';overflow:hidden;z-index:1">'+imgR+'</div>'
        +'<div style="'+boxCss(pos.badgePosition)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:240px;top:'+(inset+50)+'px;z-index:1">'+titleGroup+'</div>'
        +'<div style="'+boxCss(pos.ctaPosition)+'z-index:2">'+ctaHtml+'</div>';
    }
    if(layoutId==='center-text'){
      return '<div style="'+boxCss(pos.badgePosition)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:50%;transform:translateY(-50%);z-index:1">'+titleGroup+'</div>'
        +'<div style="'+boxCss(pos.ctaPosition)+'z-index:2">'+ctaHtml+'</div>';
    }
    if(layoutId==='top-banner'){
      /* Phase 7.1: 배너와 본문 사이를 그라데이션 페이드로 자연스럽게 연결하고
         (하드 컷 라인 제거), 하단에도 은은한 글로우를 대칭으로 배치해 캔버스 전체가
         하나의 구성으로 읽히게 한다 — 배너 아래 큰 빈 공간이 "끊어져 보이지" 않도록
         중앙에 아주 옅은 원형 장식을 하나 더해 위/아래를 시각적으로 잇는다. */
      return '<div style="position:absolute;left:0;right:0;top:0;height:172px;background:linear-gradient(180deg,'+accent+'22,'+accent+'08 78%,transparent);z-index:0"></div>'
        +'<div style="position:absolute;left:0;right:0;bottom:0;height:190px;background:radial-gradient(ellipse at 50% 100%,'+accent+'1e,transparent 72%);z-index:0"></div>'
        +'<div style="position:absolute;left:50%;top:320px;transform:translate(-50%,-50%);width:190px;height:190px;border-radius:50%;border:1px solid '+accent+'22;z-index:0"></div>'
        +'<div style="'+boxCss(pos.badgePosition)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:'+(inset+54)+'px;z-index:1">'+titleGroup+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:198px;height:1px;background:linear-gradient(90deg,transparent,'+accent+'40,transparent);z-index:1"></div>'
        +'<div style="'+boxCss(pos.ctaPosition)+'z-index:2">'+ctaHtml+'</div>';
    }
    if(layoutId==='number-focus'){
      return '<div style="position:absolute;left:'+inset+'px;top:50px;font-size:110px;font-weight:900;color:var(--ads-primary-soft,'+accent+'33);z-index:1">01</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;bottom:'+inset+'px;z-index:1">'+badgeHtml+titleGroup+ctaHtml+'</div>';
    }
    if(layoutId==='comparison'){
      var cmp = TBA ? TBA.comparisonPanelsHtml(accent, Math.min(260, Math.floor((652-inset*2-56)/2))) : {before:'',after:'',arrow:''};
      return '<div style="'+boxCss(pos.badgePosition)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:'+(inset+40)+'px;z-index:1;text-align:'+textAlignment+'">'+titleGroup+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;top:196px;z-index:1">'+cmp.before+'</div>'
        +'<div style="position:absolute;left:50%;top:250px;transform:translate(-50%,-50%);z-index:2">'+cmp.arrow+'</div>'
        +'<div style="position:absolute;right:'+inset+'px;top:196px;z-index:1">'+cmp.after+'</div>'
        +'<div style="'+boxCss(pos.ctaPosition)+'z-index:2">'+ctaHtml+'</div>';
    }
    if(layoutId==='icon-focus'){
      var iconMockup = TBA ? TBA.iconMockupHtml(br.iconStyle, accent, 140) : '';
      return '<div style="position:absolute;right:56px;top:64px;z-index:1">'+iconMockup+'</div>'
        +'<div style="position:absolute;top:'+inset+'px;right:236px;text-align:right;z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:230px;top:50%;transform:translateY(-50%);z-index:1">'+titleGroup+'</div>'
        +'<div style="'+boxCss(pos.ctaPosition)+'z-index:2">'+ctaHtml+'</div>';
    }
    return '<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:'+inset+'px;z-index:1">'+badgeHtml+titleGroup+ctaHtml+'</div>';
  }

  TS.renderPreview = function(){
    var host = document.getElementById('ts-preview');
    if(!host) return;
    var ct = colorTheme();
    var br = TS.state.blueprintRender;
    var themeId = (typeof AtlasDesignSystem!=='undefined') ? AtlasDesignSystem.state.themeId : null;
    var deco = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.cardDecoration) ? AtlasDesignSystem.cardDecoration(themeId) : '';
    var inner;
    var manualShortenNotice = '';
    /* Milestone 3.2 Phase 8: rendererMode==='claude-style'일 때만 새 Renderer를
       쓴다. 기본값은 항상 'fallback'이라 Phase 7.1 결과는 손대지 않는다.
       Phase 8.1: buildCanvasInnerHtml은 {html, needsManualShorten} 객체를
       반환한다 — needsManualShorten이 true여도 원본 mainTitle은 전혀 바뀌지
       않으며, 안내는 #ts-preview-canvas "바깥"(형제 요소)에만 그려 Export에는
       절대 포함되지 않는다. */
    if(TS.state.rendererMode==='claude-style' && typeof AtlasClaudeStyleRenderer!=='undefined'){
      var built = AtlasClaudeStyleRenderer.buildCanvasInnerHtml(TS.state, ct, br, styleBadge(), x);
      inner = built.html;
      if(built.needsManualShorten){
        manualShortenNotice = '<div class="ts-title-shorten-notice">⚠ 제목 수동 축약 필요 — 현재 제목이 2줄 안에 자연스럽게 들어가지 않습니다. 원문은 변경되지 않았으니, 아래 제목 입력창에서 직접 더 짧은 표현으로 다듬어 주세요.</div>';
      }
    } else {
      var hook = activeHookText();
      var title = TS.state.mainTitle;
      var sub = TS.state.subtitle;
      var cta = TS.state.cta;
      var TBA = (typeof AtlasThumbnailBlueprintAdapter!=='undefined') ? AtlasThumbnailBlueprintAdapter : null;
      var bpDeco = (TBA && br) ? TBA.backgroundDecoration(br.backgroundStyle, ct.accent) : '';
      /* Phase 7.1: 배경 깊이 — Blueprint 유무와 무관하게 항상 절제된 텍스처를 한 겹
         더해 "넓은 단색 배경"으로 보이지 않게 한다(backgroundStyle 없으면 neutral 텍스처). */
      var depthDeco = TBA ? TBA.depthTexture(br ? br.backgroundStyle : 'neutral', ct.accent) : '';
      inner = depthDeco + bpDeco
        +'<div style="position:absolute;left:40px;top:24px;font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--ads-primary,'+ct.accent+');z-index:1">'+x(styleBadge())+'</div>'
        +renderLayoutBody(TS.state.layoutId, ct, hook, title, sub, cta, br);
    }
    /* #ts-preview는 display:flex(row)로 캔버스를 가운데 정렬하는 공용 컨테이너다
       (Fallback Renderer도 공유). 안내 문구를 캔버스의 "형제"로 두되 flex row 안에서
       나란히 눌리지 않도록, 캔버스+안내를 함께 감싸는 column 래퍼 하나만 새로 만든다
       — #ts-preview 자체의 공용 CSS는 건드리지 않는다. */
    host.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:stretch;width:652px;max-width:100%">'
      + '<div id="ts-preview-canvas" style="width:652px;height:488px;flex-shrink:0;aspect-ratio:4/3;position:relative;overflow:hidden;border-radius:12px;background:var(--ads-bg,'+ct.bg+');font-family:var(--ads-body-font,Pretendard,\'Noto Sans KR\',sans-serif);box-sizing:border-box;box-shadow:var(--ads-shadow,none)">'
      + deco
      + inner
      +'</div>'
      + manualShortenNotice
      +'</div>';
  };

  /* 텍스트/색상/레이아웃/스타일처럼 프리뷰만 다시 그리면 되는 변경은 전체 root를 다시
     만들지 않고 프리뷰만 갱신해 입력 포커스가 끊기지 않게 한다(특히 텍스트 입력 중). */
  TS.renderPreviewOnly = function(){
    TS.renderPreview();
    if(typeof TS.renderPromptOnly==='function') TS.renderPromptOnly();
    if(typeof ThumbnailIntelligence!=='undefined' && typeof ThumbnailIntelligence.refreshIntelligence==='function') ThumbnailIntelligence.refreshIntelligence();
  };

  TS.render = function(){
    var root = document.getElementById('ts-root');
    if(!root) return;
    var tabs = [
      {id:'text',   label:'텍스트',   content: renderTextBuilder() + renderHookSection()},
      {id:'layout', label:'레이아웃', content: renderRendererModeSection() + renderTemplateGallery() + renderLayoutSection() + renderStyleSection()},
      {id:'color',  label:'색상',     content: renderColorSection()},
      {id:'font',   label:'폰트',     content: (typeof AtlasDesignSystem!=='undefined' && typeof AtlasDesignSystem.renderFontPairComparison==='function')?AtlasDesignSystem.renderFontPairComparison('ts'):''},
      {id:'prompt', label:'Prompt',   content: (typeof TS.renderPromptSection==='function'?TS.renderPromptSection():'')}
    ];
    var tabsHtml = (typeof AtlasDesignSystem!=='undefined' && typeof AtlasDesignSystem.renderTabs==='function')
      ? AtlasDesignSystem.renderTabs('ts', tabs)
      : tabs.map(function(t){return t.content;}).join('');
    root.innerHTML =
      '<div class="ts-studio-grid">'
      +'<div class="ts-studio-controls">'
        +(typeof AtlasDesignSystem!=='undefined' && typeof AtlasDesignSystem.renderThemeSelectorSection==='function'?AtlasDesignSystem.renderThemeSelectorSection('ts'):'')
        +tabsHtml
      +'</div>'
      +'<div class="ts-studio-preview"><div class="ts-section-title">실시간 미리보기 (652×488)</div><div id="ts-preview"></div>'
        +(typeof TS.renderExportSection==='function'?TS.renderExportSection():'')
        +(typeof ThumbnailIntelligence!=='undefined' && typeof ThumbnailIntelligence.renderIntelligenceSection==='function'?ThumbnailIntelligence.renderIntelligenceSection():'')
      +'</div>'
      +'</div>';
    TS.renderPreview();
    if(typeof TS.renderPromptOnly==='function') TS.renderPromptOnly();
    /* Milestone 3.2 Phase 9: renderIntelligenceSection()은 root.innerHTML 조립 시점
       (TS.renderPreview() 이전)에 이미 한 번 호출되어 #ts-preview-canvas가 아직
       없는 상태로 그려졌을 수 있다. Thumbnail Intelligence 2.0은 실제 Preview DOM을
       측정해야 하므로, 캔버스가 실제로 그려진 지금 다시 한번 갱신한다(#ti-panel은
       위 root.innerHTML에 이미 존재하므로 refreshIntelligence()가 그 자리를
       그대로 갱신할 뿐 — 새 UI 위치를 만들지 않는다). */
    if(typeof ThumbnailIntelligence!=='undefined' && typeof ThumbnailIntelligence.refreshIntelligence==='function') ThumbnailIntelligence.refreshIntelligence();
  };

  TS.open = function(){
    TS.init();
    var resultState = document.getElementById('cv-result-state');
    var studioState = document.getElementById('cv-thumbstudio-state');
    if(resultState) resultState.style.display = 'none';
    if(studioState) studioState.style.display = '';
    if(typeof atlasSetWorkspaceStage==='function'){
      atlasSetWorkspaceStage('sales', {coach:'Thumbnail Studio에서 후킹 문구·템플릿·색상을 선택해 썸네일을 만들어보세요.'});
    }
    TS.render();
  };

  TS.close = function(){
    var resultState = document.getElementById('cv-result-state');
    var studioState = document.getElementById('cv-thumbstudio-state');
    if(studioState) studioState.style.display = 'none';
    if(resultState) resultState.style.display = '';
  };

})(window.ThumbnailStudio);

function tsOpen(){ ThumbnailStudio.open(); }
function tsClose(){ ThumbnailStudio.close(); }
function tsSelectTemplate(id){ ThumbnailStudio.selectTemplate(id); }
function tsSelectHook(i){ ThumbnailStudio.selectHook(i); }
function tsSetCustomHook(v){ ThumbnailStudio.setCustomHook(v); }
function tsRegenerateHooks(){ ThumbnailStudio.regenerateHooks(); }
function tsSetField(key,v){ ThumbnailStudio.setField(key,v); }
function tsSelectColor(id){ ThumbnailStudio.selectColor(id); }
function tsSelectLayout(id){ ThumbnailStudio.selectLayout(id); }
function tsSelectRendererMode(mode){ ThumbnailStudio.selectRendererMode(mode); }
function tsSelectStyle(id){ ThumbnailStudio.selectStyle(id); }
