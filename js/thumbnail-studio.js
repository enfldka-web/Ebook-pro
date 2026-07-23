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
  {id:'icon-focus',  name:'아이콘형'}
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
      promptManuallyEdited: false
    };
  }

  TS.state = defaultState();

  function syncToApp(){
    if(typeof APP!=='undefined') APP.thumbnailStudio = TS.state;
  }

  /* Milestone 3.2 Phase 4: Thumbnail Engine 2.0 연결.
     기존 Thumbnail Studio 코드/템플릿/레이아웃은 전혀 삭제하거나 바꾸지 않는다 — Engine이
     만든 Blueprint(js/thumbnail-engine.js)를 "새 프로젝트의 기본값"으로만 반영한다.
     Blueprint의 pattern은 이미 TS_LAYOUTS에 있는 6개 layoutId 중 3개(comparison/
     icon-focus/left-image — 현재 3개 Brand Pack이 실제로 도달하는 값)에 대응한다.
     colorStrategy도 기존 TS_COLOR_THEMES 중 하나로 매핑한다. 둘 다 사용자가 이미 고른
     기존 값(TS.state가 APP.thumbnailStudio에서 복원되는 경우)은 절대 덮어쓰지 않는다. */
  var LAYOUT_ID_BY_BLUEPRINT_PATTERN = {
    'Comparison':'comparison', 'Icon Focus':'icon-focus', 'Left Image':'left-image',
    'Right Image':'right-image', 'Center Text':'center-text', 'Top Banner':'center-text'
  };
  var COLOR_ID_BY_BLUEPRINT_STRATEGY = { authority:'black', trust:'blue', relationship:'orange' };

  TS.init = function(){
    if(typeof APP!=='undefined' && APP.thumbnailStudio){
      TS.state = APP.thumbnailStudio;
    } else {
      TS.state = defaultState();
      if(typeof APP!=='undefined' && APP.ebook){
        if(!TS.state.mainTitle) TS.state.mainTitle = APP.ebook.title||'';
        if(!TS.state.subtitle) TS.state.subtitle = APP.ebook.subtitle||'';
      }
      if(typeof APP!=='undefined' && APP.thumbnailBlueprint){
        var bp=APP.thumbnailBlueprint;
        if(LAYOUT_ID_BY_BLUEPRINT_PATTERN[bp.pattern]) TS.state.layoutId=LAYOUT_ID_BY_BLUEPRINT_PATTERN[bp.pattern];
        if(COLOR_ID_BY_BLUEPRINT_STRATEGY[bp.colorStrategy]) TS.state.colorId=COLOR_ID_BY_BLUEPRINT_STRATEGY[bp.colorStrategy];
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

  function renderLayoutBody(layoutId, ct, hook, title, sub, cta){
    var accent=ct.accent, textc=ct.text;
    var themeId = (typeof AtlasDesignSystem!=='undefined') ? AtlasDesignSystem.state.themeId : null;
    var underline = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.titleUnderline) ? AtlasDesignSystem.titleUnderline(themeId) : '';
    var titleBlock='<div style="font-size:34px;line-height:1.18;font-weight:900;color:var(--ads-text-primary,'+textc+');word-break:keep-all;font-family:var(--ads-heading-font,inherit)">'+x(title||'메인 제목을 입력하세요')+'</div>'
      + underline
      +'<div style="font-size:16px;margin-top:12px;color:var(--ads-text-secondary,'+textc+');opacity:.82;word-break:keep-all;font-family:var(--ads-body-font,inherit)">'+x(sub||'')+'</div>';
    var hookBadge='<div style="display:inline-block;padding:5px 12px;border-radius:100px;background:var(--ads-primary-soft,'+accent+'33);border:1px solid var(--ads-primary,'+accent+');color:var(--ads-primary,'+accent+');font-size:12px;font-weight:800;margin-bottom:14px;font-family:var(--ads-accent-font,inherit)">'+x(hook||'후킹 문구')+'</div>';
    var ctaBlock=cta?'<div style="margin-top:18px;font-size:13px;font-weight:800;color:var(--ads-primary,'+accent+');font-family:var(--ads-accent-font,inherit)">'+x(cta)+' →</div>':'';

    if(layoutId==='left-image'){
      return '<div style="position:absolute;left:40px;top:60px;bottom:60px;width:160px;border-radius:16px;border:1px solid var(--ads-border,'+accent+'55);background:rgba(255,255,255,.06);z-index:1"></div>'
        +'<div style="position:absolute;left:230px;right:40px;top:60px;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
    }
    if(layoutId==='right-image'){
      return '<div style="position:absolute;right:40px;top:60px;bottom:60px;width:160px;border-radius:16px;border:1px solid var(--ads-border,'+accent+'55);background:rgba(255,255,255,.06);z-index:1"></div>'
        +'<div style="position:absolute;left:40px;right:230px;top:60px;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
    }
    if(layoutId==='center-text'){
      return '<div style="position:absolute;left:40px;right:40px;top:50%;transform:translateY(-50%);text-align:center;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
    }
    if(layoutId==='number-focus'){
      return '<div style="position:absolute;left:40px;top:50px;font-size:110px;font-weight:900;color:var(--ads-primary-soft,'+accent+'33);z-index:1">01</div>'
        +'<div style="position:absolute;left:40px;right:40px;bottom:60px;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
    }
    if(layoutId==='comparison'){
      return '<div style="position:absolute;left:40px;top:60px;bottom:60px;right:326px;border-right:1px dashed var(--ads-border,'+accent+'55);z-index:1">'
        +'<div style="font-size:11px;font-weight:800;color:var(--ads-primary,'+accent+')">BEFORE</div></div>'
        +'<div style="position:absolute;right:40px;top:60px;bottom:60px;left:326px;z-index:1">'
        +'<div style="font-size:11px;font-weight:800;color:var(--ads-primary,'+accent+')">AFTER</div></div>'
        +'<div style="position:absolute;left:40px;right:40px;bottom:60px;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
    }
    if(layoutId==='icon-focus'){
      return '<div style="position:absolute;right:60px;top:70px;width:130px;height:130px;border-radius:50%;background:var(--ads-primary-soft,'+accent+'33);border:1px solid var(--ads-primary,'+accent+');z-index:1"></div>'
        +'<div style="position:absolute;left:40px;right:230px;top:60px;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
    }
    return '<div style="position:absolute;left:40px;right:40px;top:60px;z-index:1">'+hookBadge+titleBlock+ctaBlock+'</div>';
  }

  TS.renderPreview = function(){
    var host = document.getElementById('ts-preview');
    if(!host) return;
    var ct = colorTheme();
    var hook = activeHookText();
    var title = TS.state.mainTitle;
    var sub = TS.state.subtitle;
    var cta = TS.state.cta;
    var themeId = (typeof AtlasDesignSystem!=='undefined') ? AtlasDesignSystem.state.themeId : null;
    var deco = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.cardDecoration) ? AtlasDesignSystem.cardDecoration(themeId) : '';
    host.innerHTML =
      '<div id="ts-preview-canvas" style="width:652px;height:488px;flex-shrink:0;aspect-ratio:4/3;position:relative;overflow:hidden;border-radius:12px;background:var(--ads-bg,'+ct.bg+');font-family:var(--ads-body-font,Pretendard,\'Noto Sans KR\',sans-serif);box-sizing:border-box;box-shadow:var(--ads-shadow,none)">'
      + deco
      +'<div style="position:absolute;left:40px;top:24px;font-size:10px;font-weight:800;letter-spacing:1.5px;color:var(--ads-primary,'+ct.accent+');z-index:1">'+x(styleBadge())+'</div>'
      +renderLayoutBody(TS.state.layoutId, ct, hook, title, sub, cta)
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
      {id:'layout', label:'레이아웃', content: renderTemplateGallery() + renderLayoutSection() + renderStyleSection()},
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
function tsSelectStyle(id){ ThumbnailStudio.selectStyle(id); }
