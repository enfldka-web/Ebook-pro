/* sales-page-studio.js — Milestone 3: Sales Page Studio v1 (신규 기능, 기존 코드 무수정) */
/* 전역 네임스페이스: window.SalesPageStudio. onclick/oninput에서 쓰이는 전역 함수는 sps* 래퍼만 노출한다.
   기존 renderCvSalesPage/showSalesThemeModal/dlSpSlide 등은 절대 호출·수정하지 않는다. */

window.SalesPageStudio = window.SalesPageStudio || {};

/* ── 섹션 타입 정의 (v1 8종, FAQ 제외) ──
   fields: 좌측 편집 패널에 표시할 필드 목록. 'beforeText'/'afterText'는 beforeAfter 전용. */
var SPS_SECTION_DEFS = [
  {type:'hero',           label:'히어로',        defaultLayoutId:'text-center', allowedLayouts:['text-center','text-left','split'],   fields:['title','body','badge','cta']},
  {type:'pain',            label:'문제 공감',      defaultLayoutId:'icon-list',   allowedLayouts:['text-left','icon-list'],              fields:['title','body','badge']},
  {type:'solution',        label:'해결책',        defaultLayoutId:'text-left',   allowedLayouts:['text-left','text-center','split'],    fields:['title','body','cta']},
  {type:'toc',             label:'목차',          defaultLayoutId:'checklist',   allowedLayouts:['text-left','checklist'],              fields:['title']},
  {type:'benefits',        label:'핵심 장점',      defaultLayoutId:'icon-list',   allowedLayouts:['checklist','icon-list'],              fields:['title','body']},
  {type:'beforeAfter',     label:'비포 / 애프터',  defaultLayoutId:'comparison',  allowedLayouts:['comparison','split'],                 fields:['title','beforeText','afterText','cta']},
  {type:'targetAudience',  label:'추천 대상',      defaultLayoutId:'checklist',   allowedLayouts:['checklist','icon-list'],              fields:['title','body']},
  {type:'cta',             label:'마무리 CTA',    defaultLayoutId:'text-center', allowedLayouts:['text-center','split'],                fields:['title','body','cta']}
];

var SPS_LAYOUT_LABELS = {
  'text-center':'중앙 정렬', 'text-left':'좌측 정렬', 'icon-list':'아이콘 리스트',
  'split':'분할형', 'comparison':'비교형', 'checklist':'체크리스트'
};

/* ── 컬러 테마 (기존 renderCvSalesPage THEMES 6종을 시각 기준으로만 재사용, 내부 변수는 참조하지 않음) ──
   templateId/colorId는 역할이 동일해 themeId 하나로 통합했다(완료 보고서에 사유 기재). */
var SPS_THEMES = [
  {id:'navy-gold',     name:'📘 네이비 골드',   bg:'#0d1b2a', text:'#ffffff', sub:'rgba(255,255,255,.72)', accent:'#D4A843', accentSoft:'rgba(212,168,67,.16)', panel:'rgba(255,255,255,.05)', panelBorder:'rgba(255,255,255,.12)'},
  {id:'charcoal-mint', name:'🌿 차콜 민트',     bg:'#111417', text:'#f5faf9', sub:'rgba(245,250,249,.68)', accent:'#2DD4BF', accentSoft:'rgba(45,212,191,.16)', panel:'rgba(255,255,255,.05)', panelBorder:'rgba(255,255,255,.12)'},
  {id:'cream-violet',  name:'💜 크림 바이올렛', bg:'#faf9f7', text:'#1e1633', sub:'rgba(30,22,51,.62)',    accent:'#7C3AED', accentSoft:'rgba(124,58,237,.12)', panel:'rgba(124,58,237,.06)', panelBorder:'rgba(124,58,237,.18)'},
  {id:'coral-energy',  name:'🔥 코랄 에너지',   bg:'#1a0800', text:'#fff8f5', sub:'rgba(255,248,245,.68)', accent:'#E84A1F', accentSoft:'rgba(232,74,31,.18)',  panel:'rgba(255,255,255,.05)', panelBorder:'rgba(255,255,255,.12)'},
  {id:'gold-luxury',   name:'✨ 골드 럭셔리',   bg:'#0d0b05', text:'#fffdf0', sub:'rgba(255,253,240,.68)', accent:'#D4A843', accentSoft:'rgba(212,168,67,.18)', panel:'rgba(255,255,255,.05)', panelBorder:'rgba(255,255,255,.12)'},
  {id:'pastel-pink',   name:'🌸 파스텔 핑크',   bg:'#FFF0F5', text:'#5A0028', sub:'rgba(90,0,40,.62)',     accent:'#C2005A', accentSoft:'rgba(194,0,90,.12)',  panel:'rgba(194,0,90,.05)', panelBorder:'rgba(194,0,90,.18)'}
];

(function(SPS){

  function sectionDef(type){
    for(var i=0;i<SPS_SECTION_DEFS.length;i++){ if(SPS_SECTION_DEFS[i].type===type) return SPS_SECTION_DEFS[i]; }
    return SPS_SECTION_DEFS[0];
  }
  SPS.sectionDef = sectionDef;

  function theme(id){
    for(var i=0;i<SPS_THEMES.length;i++){ if(SPS_THEMES[i].id===id) return SPS_THEMES[i]; }
    return SPS_THEMES[0];
  }
  SPS.theme = theme;

  function syncToApp(){
    if(typeof APP!=='undefined') APP.salesPageStudio = SPS.state;
  }
  SPS.syncToApp = syncToApp;

  function normalizeOrder(){
    SPS.state.sections.sort(function(a,b){ return (a.order||0)-(b.order||0); });
    SPS.state.sections.forEach(function(s,i){ s.order = i+1; });
  }
  SPS.normalizeOrder = normalizeOrder;

  SPS.init = function(){
    var ebook = (typeof APP!=='undefined' && APP.ebook) || null;
    var key = (typeof SPS.computeEbookKey==='function') ? SPS.computeEbookKey(ebook) : '';
    if(typeof APP!=='undefined' && APP.salesPageStudio && APP.salesPageStudio.sourceEbookKey===key && key){
      SPS.state = APP.salesPageStudio;
    } else {
      var sections = (typeof SPS.buildSectionsFromEbook==='function') ? SPS.buildSectionsFromEbook(ebook) : [];
      SPS.state = {
        version: 1,
        sourceEbookKey: key,
        themeId: 'navy-gold',
        selectedSectionId: sections.length ? sections[0].id : 'hero',
        sections: sections
      };
      normalizeOrder();
      syncToApp();
    }
  };

  /* ── 구조 빌더: 선택 / On-Off / 순서 변경 ── */
  SPS.selectSection = function(id){
    SPS.state.selectedSectionId = id;
    syncToApp(); SPS.render();
  };

  SPS.toggleSection = function(id){
    var s = SPS.state.sections.filter(function(v){return v.id===id;})[0];
    if(!s) return;
    s.enabled = !s.enabled;
    syncToApp(); SPS.render();
  };

  function indexOfId(id){
    for(var i=0;i<SPS.state.sections.length;i++){ if(SPS.state.sections[i].id===id) return i; }
    return -1;
  }

  SPS.moveUp = function(id){
    normalizeOrder();
    var idx = indexOfId(id);
    if(idx<=0) return;
    var arr = SPS.state.sections;
    var tmp = arr[idx-1].order; arr[idx-1].order = arr[idx].order; arr[idx].order = tmp;
    normalizeOrder();
    syncToApp(); SPS.render();
  };

  SPS.moveDown = function(id){
    normalizeOrder();
    var idx = indexOfId(id);
    if(idx<0 || idx>=SPS.state.sections.length-1) return;
    var arr = SPS.state.sections;
    var tmp = arr[idx+1].order; arr[idx+1].order = arr[idx].order; arr[idx].order = tmp;
    normalizeOrder();
    syncToApp(); SPS.render();
  };

  /* ── 텍스트 편집 (입력 중에는 부분 렌더로 포커스 유지) ── */
  SPS.setField = function(id, key, v){
    var s = SPS.state.sections.filter(function(sec){return sec.id===id;})[0];
    if(!s) return;
    s[key] = v;
    syncToApp(); SPS.renderPreviewOnly();
  };

  /* ── 테마 / 레이아웃 (전체 재렌더, active 표시 갱신 필요) ── */
  SPS.selectTheme = function(id){
    SPS.state.themeId = id;
    syncToApp(); SPS.render();
  };

  SPS.selectLayout = function(sectionId, layoutId){
    var s = SPS.state.sections.filter(function(sec){return sec.id===sectionId;})[0];
    if(!s) return;
    var def = sectionDef(s.type);
    if(def.allowedLayouts.indexOf(layoutId)<0) return;
    s.layoutId = layoutId;
    syncToApp(); SPS.render();
  };

  function linesOf(text){
    return String(text||'').split('\n').map(function(s){return s.trim();}).filter(Boolean);
  }

  /* ── 좌측: 섹션 구조 빌더 ──
     order는 전체 목록(활성/비활성 모두) 기준으로 정규화되고, 위/아래 이동은 전체 목록 안에서의
     인접 스왑이다. 비활성 섹션도 목록에는 항상 표시하되(요구사항), 첫/마지막 위치에서는 해당
     방향 버튼을 비활성화해 더 이상 이동할 수 없게 한다. */
  function renderStructureList(){
    var sorted = SPS.state.sections.slice().sort(function(a,b){return a.order-b.order;});
    var rows = sorted.map(function(s,idx){
      var def = sectionDef(s.type);
      var selected = s.id===SPS.state.selectedSectionId;
      var atTop = idx===0;
      var atBottom = idx===sorted.length-1;
      return '<div class="sps-structure-row'+(selected?' selected':'')+(s.enabled?'':' disabled')+'" onclick="spsSelectSection(\''+s.id+'\')">'
        +'<label class="sps-toggle" onclick="event.stopPropagation()">'
          +'<input type="checkbox" '+(s.enabled?'checked':'')+' onchange="spsToggleSection(\''+s.id+'\')"/><span></span>'
        +'</label>'
        +'<span class="sps-structure-label">'+x(def.label)+'</span>'
        +'<div class="sps-structure-btns">'
          +'<button title="위로" onclick="event.stopPropagation();spsMoveUp(\''+s.id+'\')" '+(atTop?'disabled':'')+'>▲</button>'
          +'<button title="아래로" onclick="event.stopPropagation();spsMoveDown(\''+s.id+'\')" '+(atBottom?'disabled':'')+'>▼</button>'
        +'</div>'
      +'</div>';
    }).join('');
    return '<div class="sps-section"><div class="sps-section-title">섹션 구조 <span class="sps-hint">(On/Off · 순서 변경)</span></div>'
      +'<div class="sps-structure-list">'+rows+'</div></div>';
  }

  /* ── 좌측: 선택된 섹션 편집 (타입별로 필요한 필드만 표시) ── */
  function field(label, id, key, val, tag){
    if(tag==='textarea'){
      return '<div class="sps-field"><label>'+label+'</label><textarea class="sps-input sps-textarea" id="'+id+'" oninput="spsSetField(\''+SPS.state.selectedSectionId+'\',\''+key+'\',this.value)">'+x(val)+'</textarea></div>';
    }
    return '<div class="sps-field"><label>'+label+'</label><input class="sps-input" id="'+id+'" value="'+x(val)+'" oninput="spsSetField(\''+SPS.state.selectedSectionId+'\',\''+key+'\',this.value)"/></div>';
  }

  function renderEditor(){
    var s = SPS.state.sections.filter(function(v){return v.id===SPS.state.selectedSectionId;})[0];
    if(!s) return '<div class="sps-section"><div class="sps-empty-preview">선택된 섹션이 없습니다.</div></div>';
    var def = sectionDef(s.type);
    var listHint = ['benefits','targetAudience','pain'].indexOf(s.type)>=0 ? ' <span class="sps-hint">(한 줄에 하나씩)</span>' : '';
    var fieldsHtml = def.fields.map(function(f){
      if(f==='title') return field('제목','sps-f-title',f,s.title,'input');
      if(f==='body') return field('본문'+listHint,'sps-f-body',f,s.body,'textarea');
      if(f==='badge') return field('배지','sps-f-badge',f,s.badge,'input');
      if(f==='cta') return field('CTA','sps-f-cta',f,s.cta,'input');
      if(f==='beforeText') return field('비포 <span class="sps-hint">(한 줄에 하나씩)</span>','sps-f-before',f,s.beforeText,'textarea');
      if(f==='afterText') return field('애프터 <span class="sps-hint">(한 줄에 하나씩)</span>','sps-f-after',f,s.afterText,'textarea');
      return '';
    }).join('');
    var tocNote = s.type==='toc' ? '<div class="sps-hint sps-toc-note">목차 섹션은 전자책의 실제 챕터 데이터를 그대로 사용합니다. 챕터가 없으면 카드에 안내 문구만 표시됩니다.</div>' : '';
    var layoutOpts = def.allowedLayouts.map(function(l){
      var active = s.layoutId===l;
      return '<button class="sps-chip-btn'+(active?' active':'')+'" onclick="spsSelectLayout(\''+s.id+'\',\''+l+'\')">'+x(SPS_LAYOUT_LABELS[l]||l)+'</button>';
    }).join('');
    return '<div class="sps-section"><div class="sps-section-title">'+x(def.label)+' 편집</div>'
      + fieldsHtml + tocNote
      + '<div class="sps-field-label">카드 레이아웃</div><div class="sps-row sps-wrap">'+layoutOpts+'</div>'
      +'</div>';
  }

  /* ── 좌측: 테마(색상) 선택 ── */
  function renderThemeSection(){
    var chips = SPS_THEMES.map(function(t){
      var active = SPS.state.themeId===t.id;
      return '<button class="sps-theme-chip'+(active?' active':'')+'" style="background:'+t.bg+';color:'+t.text+';border-color:'+(active?t.accent:'transparent')+'" onclick="spsSelectTheme(\''+t.id+'\')">'+(active?'✓ ':'')+x(t.name)+'</button>';
    }).join('');
    return '<div class="sps-section"><div class="sps-section-title">템플릿 · 색상 테마</div><div class="sps-row sps-wrap">'+chips+'</div></div>';
  }

  /* ── 우측: 카드(540×675) 내부 HTML — Export 대상 DOM과 동일한 구조를 그대로 사용한다.
     모든 색상은 var(--ads-*, 기존 SPS_THEMES 색상) 형태로 감싸, 브랜드 테마가 선택되면
     카드 자체(배경·뱃지·목록·CTA)가 실제로 다시 스킨되고, 선택되지 않았을 때는 기존 동작과
     완전히 동일하다(폴백 = 기존 값). Export 대상 DOM과 Live Preview DOM이 같은 엘리먼트이므로
     Export 결과에도 동일한 토큰이 그대로 반영된다. ── */
  function cardInner(section, th, ebook){
    var themeId = (typeof AtlasDesignSystem!=='undefined') ? AtlasDesignSystem.state.themeId : null;
    var underline = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.titleUnderline) ? AtlasDesignSystem.titleUnderline(themeId) : '';
    var badgeHtml = section.badge ? '<div style="display:inline-block;padding:4px 12px;border-radius:100px;background:var(--ads-primary-soft,'+th.accentSoft+');border:1px solid var(--ads-primary,'+th.accent+');color:var(--ads-primary,'+th.accent+');font-size:12px;font-weight:800;margin-bottom:14px;font-family:var(--ads-accent-font,inherit)">'+x(section.badge)+'</div>' : '';
    var titleHtml = '<h2 style="font-size:28px;font-weight:900;line-height:1.28;color:var(--ads-text-primary,'+th.text+');word-break:keep-all;margin:0 0 12px;font-family:var(--ads-heading-font,inherit)">'+x(section.title||'')+'</h2>' + underline;
    var ctaHtml = section.cta ? '<div style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:100px;background:var(--ads-primary,'+th.accent+');color:var(--ads-button-text,#fff);font-weight:800;font-size:13px;font-family:var(--ads-accent-font,inherit)">'+x(section.cta)+' →</div>' : '';

    var bodyHtml = '';
    if(section.type==='toc'){
      var chapters = (ebook && ebook.chapters) || [];
      if(!chapters.length){
        bodyHtml = '<div style="font-size:13px;color:var(--ads-text-secondary,'+th.sub+')">챕터 데이터가 없습니다.</div>';
      } else {
        bodyHtml = '<div style="display:flex;flex-direction:column;gap:9px">'+chapters.slice(0,7).map(function(c,i){
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 13px;background:var(--ads-surface-2,'+th.panel+');border:1px solid var(--ads-border,'+th.panelBorder+');border-radius:10px">'
            +'<div style="width:24px;height:24px;border-radius:7px;background:var(--ads-primary,'+th.accent+');color:var(--ads-button-text,#fff);font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(i+1)+'</div>'
            +'<div style="font-size:13px;font-weight:700;color:var(--ads-text-primary,'+th.text+');word-break:keep-all">'+x(c.title||'')+'</div></div>';
        }).join('')+'</div>';
      }
    } else if(section.type==='beforeAfter'){
      var beforeArr = linesOf(section.beforeText);
      var afterArr = linesOf(section.afterText);
      function col(label, arr, tone){
        var tcolor = tone==='after' ? 'var(--ads-primary,'+th.accent+')' : 'var(--ads-text-secondary,'+th.sub+')';
        return '<div style="flex:1;padding:13px;background:var(--ads-surface-2,'+th.panel+');border:1px solid var(--ads-border,'+th.panelBorder+');border-radius:12px">'
          +'<div style="font-size:10px;font-weight:900;letter-spacing:1px;color:'+tcolor+';margin-bottom:8px">'+label+'</div>'
          +(arr.length ? arr.slice(0,5).map(function(l){return '<div style="font-size:12px;color:var(--ads-text-primary,'+th.text+');margin-bottom:6px;line-height:1.5">'+(tone==='after'?'✓ ':'– ')+x(l)+'</div>';}).join('') : '<div style="font-size:11px;color:var(--ads-text-secondary,'+th.sub+')">내용 없음</div>')
          +'</div>';
      }
      bodyHtml = (section.layoutId==='split')
        ? '<div style="display:flex;flex-direction:column;gap:10px">'+col('BEFORE',beforeArr,'before')+col('AFTER',afterArr,'after')+'</div>'
        : '<div style="display:flex;gap:10px">'+col('BEFORE',beforeArr,'before')+col('AFTER',afterArr,'after')+'</div>';
    } else if(section.layoutId==='icon-list' || section.layoutId==='checklist'){
      var arr = linesOf(section.body);
      bodyHtml = arr.length
        ? '<div style="display:flex;flex-direction:column;gap:8px">'+arr.slice(0,6).map(function(l,i){
            var icon = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.listIcon) ? AtlasDesignSystem.listIcon(themeId,i) : (section.layoutId==='checklist'?'✓':'•');
            return '<div style="display:flex;align-items:flex-start;gap:9px;padding:9px 13px;background:var(--ads-surface-2,'+th.panel+');border:1px solid var(--ads-border,'+th.panelBorder+');border-radius:10px">'
              +'<div style="color:var(--ads-primary,'+th.accent+');font-weight:900;font-size:13px;flex-shrink:0">'+icon+'</div>'
              +'<div style="font-size:12px;color:var(--ads-text-primary,'+th.text+');line-height:1.5;word-break:keep-all">'+x(l)+'</div></div>';
          }).join('')+'</div>'
        : '<div style="font-size:12px;color:var(--ads-text-secondary,'+th.sub+')">내용을 입력해주세요.</div>';
    } else if(section.layoutId==='comparison'){
      var all = linesOf(section.body);
      var half = Math.ceil(all.length/2);
      bodyHtml = '<div style="display:flex;gap:10px;font-size:12px;color:var(--ads-text-primary,'+th.text+');line-height:1.7;word-break:keep-all">'
        +'<div style="flex:1">'+all.slice(0,half).map(x).join('<br>')+'</div>'
        +'<div style="flex:1">'+all.slice(half).map(x).join('<br>')+'</div></div>';
    } else {
      bodyHtml = '<div style="font-size:13px;color:var(--ads-text-secondary,'+th.sub+');line-height:1.75;word-break:keep-all;white-space:pre-line">'+x(section.body||'')+'</div>';
    }

    var centered = section.layoutId==='text-center';
    return '<div style="position:relative;z-index:1;padding:34px 28px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;'
      +(centered?'text-align:center;align-items:center;justify-content:center':'text-align:left;align-items:flex-start;justify-content:flex-start')
      +';gap:2px">'
      + badgeHtml + titleHtml + bodyHtml + ctaHtml
      +'</div>';
  }

  function cardShell(section, th, innerHtml, orderDisplay, total){
    var def = sectionDef(section.type);
    var themeId = (typeof AtlasDesignSystem!=='undefined') ? AtlasDesignSystem.state.themeId : null;
    var deco = (typeof AtlasDesignSystem!=='undefined' && AtlasDesignSystem.cardDecoration) ? AtlasDesignSystem.cardDecoration(themeId) : '';
    return '<div class="sps-card" id="sps-card-'+section.id+'" style="width:540px;height:675px;position:relative;overflow:hidden;box-sizing:border-box;background:var(--ads-bg,'+th.bg+');font-family:var(--ads-body-font,\'Noto Sans KR\',\'Apple SD Gothic Neo\',\'Malgun Gothic\',sans-serif)">'
      + deco
      + '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:var(--ads-primary,'+th.accent+');z-index:2"></div>'
      + innerHtml
      + '<div style="position:absolute;bottom:14px;left:28px;right:28px;display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:700;color:var(--ads-text-secondary,'+th.sub+');z-index:2">'
        + '<span>'+x(def.label)+'</span><span>'+orderDisplay+' / '+total+'</span>'
      + '</div></div>';
  }

  /* 선택 테두리·PNG 버튼은 래퍼(sps-preview-wrap)에만 존재한다 — html2canvas는 항상
     #sps-card-<id>(래퍼 바깥, 실제 카드 자체)만 캡처하므로 Export 이미지에는 포함되지 않는다. */
  function previewCardWrap(section, th, ebook, orderDisplay, total, selected){
    var inner = cardInner(section, th, ebook);
    return '<div class="sps-preview-wrap'+(selected?' selected':'')+'" id="sps-wrap-'+section.id+'">'
      + '<div class="sps-preview-label">'+x(sectionDef(section.type).label)+(selected?' <span class="sps-editing-badge">편집 중</span>':'')+'</div>'
      + cardShell(section, th, inner, orderDisplay, total)
      + '<button class="sps-card-dl" onclick="spsExportSectionPNG(\''+section.id+'\', this)">⬇ PNG</button>'
      +'</div>';
  }

  function renderPreviewList(){
    var host = document.getElementById('sps-preview-list');
    if(!host) return;
    var th = theme(SPS.state.themeId);
    var ebook = (typeof APP!=='undefined' && APP.ebook) || {};
    var enabledOrdered = SPS.state.sections.filter(function(s){return s.enabled;}).sort(function(a,b){return a.order-b.order;});
    if(!enabledOrdered.length){
      host.innerHTML = '<div class="sps-empty-preview">활성화된 섹션이 없습니다. 왼쪽 섹션 구조에서 하나 이상 켜주세요.</div>';
      return;
    }
    host.innerHTML = enabledOrdered.map(function(s,i){
      return previewCardWrap(s, th, ebook, i+1, enabledOrdered.length, s.id===SPS.state.selectedSectionId);
    }).join('');
  }

  function renderExportBar(){
    return '<div class="sps-export-row">'
      + '<button class="sps-btn sps-btn-primary" id="sps-export-zip" onclick="spsExportAllZip(this)">⬇ 전체 ZIP 다운로드</button>'
      + '<span class="sps-hint">개별 카드는 각 카드 아래의 PNG 버튼을 사용하세요.</span>'
      +'</div>';
  }

  /* ── 전체 render(좌측+우측 모두 재구성) — 템플릿/색상/레이아웃/순서/On-Off/섹션 선택 시 사용 ── */
  SPS.render = function(){
    var root = document.getElementById('sps-root');
    if(!root) return;
    var detailTabs = [
      {id:'color', label:'색상', content: renderThemeSection()},
      {id:'font',  label:'폰트', content: (typeof AtlasDesignSystem!=='undefined' && typeof AtlasDesignSystem.renderFontPairComparison==='function'?AtlasDesignSystem.renderFontPairComparison('sps'):'')}
    ];
    var detailSection = (typeof AtlasDesignSystem!=='undefined' && typeof AtlasDesignSystem.renderTabs==='function')
      ? AtlasDesignSystem.renderTabs('sps-detail', detailTabs)
      : detailTabs.map(function(t){return t.content;}).join('');
    root.innerHTML = '<div class="sps-studio-grid">'
      + '<div class="sps-studio-controls">'
        + renderStructureList()
        + (typeof AtlasDesignSystem!=='undefined' && typeof AtlasDesignSystem.renderThemeSelectorSection==='function'?AtlasDesignSystem.renderThemeSelectorSection('sps'):'')
        + renderEditor()
        + detailSection
      + '</div>'
      + '<div class="sps-studio-preview">'
        + '<div class="sps-section-title">전체 미리보기 <span class="sps-hint">(카드 540×675 · Export 기준 크기)</span></div>'
        + renderExportBar()
        + '<div id="sps-preview-list"></div>'
      + '</div>'
      +'</div>';
    renderPreviewList();
  };

  /* ── 부분 render(우측 Preview만 재구성) — 텍스트 타이핑 중 좌측 입력 포커스를 보존한다 ── */
  SPS.renderPreviewOnly = function(){
    renderPreviewList();
  };

  SPS.open = function(){
    SPS.init();
    var resultState = document.getElementById('cv-result-state');
    var studioState = document.getElementById('cv-salespagestudio-state');
    if(!SPS.state.sections || !SPS.state.sections.length){
      if(typeof showToast==='function') showToast('error','전자책을 먼저 생성해주세요.');
      return;
    }
    if(resultState) resultState.style.display = 'none';
    if(studioState) studioState.style.display = '';
    if(typeof atlasSetWorkspaceStage==='function'){
      atlasSetWorkspaceStage('sales', {coach:'Sales Page Studio에서 섹션을 구성하고 문구를 다듬어 상세페이지를 만들어보세요.'});
    }
    SPS.render();
  };

  SPS.close = function(){
    var resultState = document.getElementById('cv-result-state');
    var studioState = document.getElementById('cv-salespagestudio-state');
    if(studioState) studioState.style.display = 'none';
    if(resultState) resultState.style.display = '';
  };

})(window.SalesPageStudio);

function spsOpen(){ SalesPageStudio.open(); }
function spsClose(){ SalesPageStudio.close(); }
function spsSelectSection(id){ SalesPageStudio.selectSection(id); }
function spsToggleSection(id){ SalesPageStudio.toggleSection(id); }
function spsMoveUp(id){ SalesPageStudio.moveUp(id); }
function spsMoveDown(id){ SalesPageStudio.moveDown(id); }
function spsSetField(id,key,v){ SalesPageStudio.setField(id,key,v); }
function spsSelectTheme(id){ SalesPageStudio.selectTheme(id); }
function spsSelectLayout(sectionId,layoutId){ SalesPageStudio.selectLayout(sectionId,layoutId); }
