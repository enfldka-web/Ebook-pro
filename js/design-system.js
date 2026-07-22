/* design-system.js — Milestone 3.1: Atlas Design System v1 (design.md 기준 정식 구현) */
/* 기존 Thumbnail Studio/Sales Page Studio의 로직·데이터 구조는 전혀 건드리지 않는다.
   순수 디자인 레이어(CSS 변수 + 브랜드 테마 선택 카드 UI + 카드 데코레이션/아이콘 helper)만
   추가한다. design.md의 "Brand First" 원칙에 따라 테마 선택은 스튜디오별로 따로 저장하지
   않고 하나의 공유 상태(ADS.state.themeId)로 관리해, 브랜드 하나를 고르면 Thumbnail Studio와
   Sales Page Studio 양쪽에 동시에 적용된다. 프로젝트 저장에는 APP.brandTheme(신규 최상위
   필드 1개)로만 반영하고, 기존 APP.thumbnailStudio/APP.salesPageStudio 스키마는 건드리지 않는다. */

window.AtlasDesignSystem = window.AtlasDesignSystem || {};

(function(ADS){

  /* 오늘 범위: Premium / Study Note / Handwriting 3종만(design.md "현재" 목록). Business/Creator/
     Minimal/Health/Finance/Parenting은 "향후" 목록 — 이번 작업에서 구현하지 않는다. 새 외부 폰트는
     추가하지 않고, index.html에 이미 로드되어 있는 폰트만 재사용한다: Pretendard, Noto Serif KR,
     Poor Story, Single Day. */
  ADS.themes = {
    premium: {
      id:'premium', name:'✨ Premium', tagline:'고급 · 전문적',
      recommendedFor:'AI · 부업 · 재테크 · 비즈니스',
      tags:['Business','Finance','AI/부업'],
      notePattern:'frame', decorationStyle:'editorial-gold-frame', listStyle:'bullet',
      icons:['⭐','📈','🔒','💎'],
      tokens:{
        background:'#0b0b0d', workspaceBackground:'#0b0b0d', previewBackground:'#141318',
        surface:'#17151b', surfaceSecondary:'#201e25',
        primary:'#C9A227', primarySoft:'rgba(201,162,39,.16)', accent:'#E8D9B0',
        buttonText:'#0b0b0d',
        textPrimary:'#F5F1E8', textSecondary:'rgba(245,241,232,.62)',
        border:'rgba(201,162,39,.35)', shadow:'0 10px 28px rgba(0,0,0,.45)', radius:'14px',
        headingFont:"'Noto Serif KR',serif",
        bodyFont:"'Pretendard','Noto Sans KR',sans-serif",
        accentFont:"'Pretendard','Noto Sans KR',sans-serif"
      },
      palette:['#0b0b0d','#C9A227','#E8D9B0','#F5F1E8']
    },
    studyNote: {
      id:'studyNote', name:'📓 Study Note', tagline:'공부 노트 · 플래너',
      recommendedFor:'공부 · 자기계발 · 육아 · 건강',
      tags:['자기계발','Health','플래너'],
      notePattern:'dotgrid', decorationStyle:'paper-planner', listStyle:'checkbox',
      icons:['📖','✏️','✅','⏰'],
      tokens:{
        background:'#FBF4E4', workspaceBackground:'#FBF4E4', previewBackground:'#FFFDF7',
        surface:'#FFFDF7', surfaceSecondary:'#F3E7CE',
        primary:'#8A5A34', primarySoft:'rgba(138,90,52,.14)', accent:'#F2C744',
        buttonText:'#FFFDF7',
        textPrimary:'#3B2A1A', textSecondary:'rgba(59,42,26,.65)',
        border:'rgba(138,90,52,.25)', shadow:'0 8px 20px rgba(120,90,50,.15)', radius:'12px',
        headingFont:"'Noto Serif KR',serif",
        bodyFont:"'Pretendard','Noto Sans KR',sans-serif",
        accentFont:"'Poor Story',cursive"
      },
      palette:['#FBF4E4','#8A5A34','#F2C744','#3B2A1A']
    },
    handwriting: {
      id:'handwriting', name:'🖊 Handwriting', tagline:'다이어리 · 감성 에세이',
      recommendedFor:'다이어리 · 에세이 · 루틴 기록',
      tags:['다이어리','에세이','SNS/Story'],
      notePattern:'diary', decorationStyle:'diary-warm', listStyle:'doodle',
      icons:['📔','📷','💗','📌'],
      tokens:{
        background:'#FBF1EA', workspaceBackground:'#FBF1EA', previewBackground:'#FFF9F6',
        surface:'#FFFFFF', surfaceSecondary:'#F7E4E1',
        primary:'#B5715A', primarySoft:'rgba(181,113,90,.14)', accent:'#8FAFC7',
        buttonText:'#FFFFFF',
        textPrimary:'#4A3B34', textSecondary:'rgba(74,59,52,.65)',
        border:'rgba(181,113,90,.25)', shadow:'0 8px 22px rgba(120,90,70,.15)', radius:'16px',
        headingFont:"'Noto Serif KR',serif",
        bodyFont:"'Pretendard','Noto Sans KR',sans-serif",
        accentFont:"'Single Day',cursive"
      },
      palette:['#FBF1EA','#B5715A','#8FAFC7','#4A3B34']
    }
  };

  /* Font Preview용 실제 한글 예문 (design.md Typography 섹션) */
  var FONT_SAMPLE = { heading:'성공하는 전자책 작성법', body:'오늘부터 시작하는 작은 습관', accent:'초보자를 위한 실전 가이드' };
  ADS.fontSample = FONT_SAMPLE;

  /* ── 공유 Brand Pack 상태 ──
     design.md "Brand First": 브랜드 하나를 고르면 Thumbnail Studio와 Sales Page Studio 양쪽에
     동시에 적용되어야 하므로, 스튜디오별로 나누지 않고 themeId 하나만 공유한다.
     scope('ts'|'sps')는 CSS 변수를 어느 root(#ts-root/#sps-root)에 적용할지 구분하는
     용도로만 남아 있고, "선택된 테마가 무엇인가"는 항상 공유 상태 하나를 본다. */
  ADS.state = { themeId:null };
  var ROOT_ID = { ts:'ts-root', sps:'sps-root' };
  var VAR_KEYS = ['bg','workspace-bg','preview-bg','surface','surface-2','primary','primary-soft','accent','button-text','text-primary','text-secondary','border','shadow','radius','heading-font','body-font','accent-font'];

  ADS.getTheme = function(themeId){ return ADS.themes[themeId] || null; };
  ADS.getActiveTheme = function(){ return ADS.getTheme(ADS.state.themeId); };

  function syncToApp(){
    if(typeof APP!=='undefined') APP.brandTheme = { version:1, themeId: ADS.state.themeId };
  }
  ADS.syncToApp = syncToApp;

  /* CSS 변수를 지정한 스튜디오의 root 엘리먼트(#ts-root/#sps-root)에 적용한다.
     TS.render()/SPS.render()는 root.innerHTML만 다시 쓰므로, root 자신의 style/class/data
     속성은 재렌더 후에도 그대로 유지된다 — 별도 재적용 로직 불필요.
     themeId는 항상 공유 상태(ADS.state.themeId)로 취급하며, 이 함수를 호출한다고 해서
     scope별로 다른 테마가 저장되지는 않는다(레거시 시제품과의 핵심 차이). */
  ADS.applyTheme = function(scope, themeId){
    var root = document.getElementById(ROOT_ID[scope]);
    var theme = ADS.getTheme(themeId);
    ADS.state.themeId = theme ? themeId : null;
    if(!root) return;
    if(!theme){
      root.classList.remove('ads-scope');
      root.removeAttribute('data-ads-theme');
      VAR_KEYS.forEach(function(k){ root.style.removeProperty('--ads-'+k); });
      return;
    }
    var t = theme.tokens;
    root.classList.add('ads-scope');
    root.setAttribute('data-ads-theme', themeId);
    root.style.setProperty('--ads-bg', t.background);
    root.style.setProperty('--ads-workspace-bg', t.workspaceBackground);
    root.style.setProperty('--ads-preview-bg', t.previewBackground);
    root.style.setProperty('--ads-surface', t.surface);
    root.style.setProperty('--ads-surface-2', t.surfaceSecondary);
    root.style.setProperty('--ads-primary', t.primary);
    root.style.setProperty('--ads-primary-soft', t.primarySoft);
    root.style.setProperty('--ads-accent', t.accent);
    root.style.setProperty('--ads-button-text', t.buttonText);
    root.style.setProperty('--ads-text-primary', t.textPrimary);
    root.style.setProperty('--ads-text-secondary', t.textSecondary);
    root.style.setProperty('--ads-border', t.border);
    root.style.setProperty('--ads-shadow', t.shadow);
    root.style.setProperty('--ads-radius', t.radius);
    root.style.setProperty('--ads-heading-font', t.headingFont);
    root.style.setProperty('--ads-body-font', t.bodyFont);
    root.style.setProperty('--ads-accent-font', t.accentFont);
  };

  /* 두 studio root 모두에 현재 공유 테마를 적용(존재하는 root만, 화면이 열려 있지 않아도 안전).
     프로젝트 불러오기 직후처럼 아직 어느 studio도 렌더링되지 않은 시점에도 호출 가능하다. */
  ADS.applyThemeToAllScopes = function(themeId){
    ADS.applyTheme('ts', themeId);
    ADS.applyTheme('sps', themeId);
  };

  /* scope 인자 없이 호출 — Thumbnail Studio든 Sales Page Studio든 어느 화면에서 선택해도
     동일하게 양쪽에 반영된다. 이미 적용된 테마를 다시 클릭해도 "해제"하지 않고 그대로 유지한다
     (design.md는 브랜드 "해제" 동작을 요구하지 않으며, 토글식 해제는 한쪽 화면에서 이미 선택된
     테마를 다른 화면에서 다시 클릭했을 때 의도치 않게 꺼지는 문제가 있어 제거함). */
  ADS.selectTheme = function(themeId){
    ADS.applyThemeToAllScopes(themeId);
    syncToApp();
    /* .state가 아직 없는 studio(이번 세션에서 한 번도 열지 않아 init()이 실행된 적 없는 경우)는
       render()를 호출하지 않는다 — 다음에 그 studio를 열 때 SPS.init()/TS.init()이 이미
       세팅된 공유 테마를 그대로 읽어 정확히 반영하므로 지금 억지로 그릴 필요가 없다. */
    if(typeof ThumbnailStudio!=='undefined' && ThumbnailStudio.state && typeof ThumbnailStudio.render==='function') ThumbnailStudio.render();
    if(typeof SalesPageStudio!=='undefined' && SalesPageStudio.state && typeof SalesPageStudio.render==='function') SalesPageStudio.render();
  };

  /* 프로젝트 불러오기 전용: 상태만 조용히 복원(두 studio 모두 아직 렌더링 전일 수 있으므로
     render() 재호출 없이 root의 CSS 변수만 세팅). 실제 화면 내용은 이후 사용자가 해당 studio를
     열 때 TS.render()/SPS.render()가 이미 세팅된 CSS 변수를 그대로 사용해 정확히 그려진다. */
  ADS.restoreTheme = function(themeId){
    ADS.applyThemeToAllScopes(ADS.getTheme(themeId) ? themeId : null);
  };

  /* ── 목록 아이콘: 테마마다 실제로 다른 목록 형태를 쓰도록(불릿/체크박스/두들 순환) ── */
  var DOODLE_ICONS = ['♡','✦','☘'];
  ADS.listIcon = function(themeId, index){
    var theme = ADS.getTheme(themeId);
    var style = theme ? theme.listStyle : 'bullet';
    if(style==='checkbox') return '☑';
    if(style==='doodle') return DOODLE_ICONS[(index||0)%DOODLE_ICONS.length];
    return '•';
  };

  /* ── 카드 데코레이션: 테마별 배경 장식(카드 콘텐츠 뒤에 z-index:0으로 깔림, Export에도 그대로 포함됨 —
     선택 테두리/편집 표시와 달리 이건 "카드 자체의 디자인"이라 Export에 포함되는 게 의도된 동작). ── */
  ADS.cardDecoration = function(themeId){
    var theme = ADS.getTheme(themeId);
    if(!theme) return '';
    var pattern = theme.notePattern;
    if(pattern==='frame'){
      /* 은은한 전체 테두리 + 대각선 코너 브래킷(에디토리얼 갤러리 액자 느낌) — Glow 없이
         "고급스러움"만 남도록 opacity를 낮게 유지한다. */
      return '<div style="position:absolute;inset:14px;border:1px solid var(--ads-primary);border-radius:8px;opacity:.32;z-index:0;pointer-events:none"></div>'
        + '<div style="position:absolute;top:26px;left:26px;width:14px;height:14px;border-top:1px solid var(--ads-primary);border-left:1px solid var(--ads-primary);opacity:.7;z-index:0;pointer-events:none"></div>'
        + '<div style="position:absolute;bottom:26px;right:26px;width:14px;height:14px;border-bottom:1px solid var(--ads-primary);border-right:1px solid var(--ads-primary);opacity:.7;z-index:0;pointer-events:none"></div>';
    }
    if(pattern==='dotgrid'){
      /* 실제 종이 노트 느낌 강화: 도트 그리드 + 얇은 가로 줄(공책 줄) + 왼쪽 마진 라인(스프링
         제본처럼 작은 구멍 점열을 더해 "플래너" 느낌 강화) + 페이퍼클립 + 형광펜으로 칠한 듯한
         스티키 메모. 과하지 않게 opacity를 낮게 유지한다(M3.2 Theme Polish로 제본 구멍만 추가). */
      var spiralHoles = '';
      for(var sh=70; sh<440; sh+=42){
        spiralHoles += '<div style="position:absolute;top:'+sh+'px;left:46px;width:6px;height:6px;border-radius:50%;background:var(--ads-preview-bg,transparent);border:1px solid var(--ads-border);opacity:.5;z-index:0;pointer-events:none"></div>';
      }
      return '<div style="position:absolute;inset:0;z-index:0;pointer-events:none;background-image:radial-gradient(var(--ads-primary) 1px,transparent 1px),repeating-linear-gradient(180deg,transparent,transparent 27px,var(--ads-border) 27px,var(--ads-border) 28px);background-size:20px 20px,100% 28px;opacity:.14"></div>'
        + '<div style="position:absolute;top:0;bottom:0;left:52px;width:1px;background:var(--ads-primary);opacity:.16;z-index:0;pointer-events:none"></div>'
        + spiralHoles
        + '<div style="position:absolute;top:10px;right:16px;font-size:20px;opacity:.5;transform:rotate(8deg);z-index:0;pointer-events:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.15))">📎</div>'
        + '<div style="position:absolute;bottom:16px;right:18px;width:62px;height:50px;background:var(--ads-accent);opacity:.6;border-radius:2px;transform:rotate(-6deg);box-shadow:0 6px 14px rgba(0,0,0,.15);z-index:0;pointer-events:none"></div>'
        + '<div style="position:absolute;bottom:22px;right:26px;width:42px;height:5px;background:rgba(255,255,255,.55);transform:rotate(-6deg);z-index:0;pointer-events:none"></div>';
    }
    if(pattern==='diary'){
      /* 20-40대도 부담 없는 다이어리 감성: 마스킹 테이프 + 손그림 밑줄(titleUnderline)은 유지하되
         하트/별은 크기와 opacity를 낮춰 장식으로만 남기고, 연필 아이콘을 더해 "필기감"을 준다.
         M3.2 Theme Polish: 자주 넘겨본 다이어리처럼 살짝 접힌 페이지 모서리(dog-ear)를
         우측 하단에 은은하게 추가해 "감성 다이어리" 느낌을 더 살린다. */
      /* M3.2 Handwriting 마무리 다듬기(Study Note와는 손대지 않고 분리):
         1) 마스킹테이프를 비대칭으로(왼쪽으로 치우치고 더 기울어지게) 배치해 "실제로 급하게
            붙인 종이" 느낌을 준다. 2) 모서리 접힘을 더 크고 뚜렷하게 키운다. 하트/별/연필
            갯수·위치는 그대로 유지(추가 스티커 금지 지침). */
      return '<div style="position:absolute;top:-7px;left:14px;width:64px;height:19px;background:repeating-linear-gradient(48deg,var(--ads-accent),var(--ads-accent) 6px,rgba(255,255,255,.72) 6px,rgba(255,255,255,.72) 12px);opacity:.58;transform:rotate(-8deg);z-index:0;pointer-events:none;border-radius:1px;box-shadow:0 3px 6px rgba(0,0,0,.1)"></div>'
        + '<div style="position:absolute;bottom:20px;left:24px;font-size:17px;opacity:.32;color:var(--ads-primary);z-index:0;pointer-events:none">♡</div>'
        + '<div style="position:absolute;bottom:27px;right:30px;font-size:14px;opacity:.28;color:var(--ads-accent);z-index:0;pointer-events:none">✦</div>'
        + '<div style="position:absolute;bottom:15px;right:16px;font-size:15px;opacity:.3;color:var(--ads-primary);z-index:0;pointer-events:none">✎</div>'
        + '<div style="position:absolute;bottom:0;right:0;width:0;height:0;border-style:solid;border-width:0 0 40px 40px;border-color:transparent transparent var(--ads-surface-2) transparent;opacity:.85;z-index:0;pointer-events:none;filter:drop-shadow(-3px -3px 4px rgba(0,0,0,.14))"></div>';
    }
    return '';
  };

  /* 손으로 그린 밑줄(Handwriting 전용) — 제목 바로 아래처럼 내용에 인접한 위치에만 붙이는
     콘텐츠 인접형 장식이라 카드 배경 데코와 분리해 별도 helper로 제공한다.
     M3.2: 곡선 하나로 매끈하게 흐르던 기존 밑줄 대신, 굴곡이 더 불규칙한 경로 + 살짝
     어긋나게 겹친 옅은 두 번째 선(손으로 두 번 그은 듯한 느낌)으로 자연스러움을 더한다. */
  ADS.titleUnderline = function(themeId){
    var theme = ADS.getTheme(themeId);
    if(!theme || theme.notePattern!=='diary') return '';
    return '<svg width="150" height="16" viewBox="0 0 150 16" style="display:block;margin-top:-6px;margin-bottom:8px" preserveAspectRatio="none">'
      +'<path d="M3 9 Q20 4 39 8 T77 6.5 Q99 10.5 121 6 T147 8.5" stroke="var(--ads-primary)" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      +'<path d="M4 11 Q23 6.5 41 9.5 T80 9 Q101 12 123 7.5 T146 10" stroke="var(--ads-primary)" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".4"/></svg>';
  };

  /* ── 접이식 섹션 (native <details>, 별도 JS 토글 로직 불필요) ── */
  ADS.collapsible = function(id, title, contentHtml, openByDefault){
    return '<details class="ads-collapsible"'+(openByDefault?' open':'')+' id="'+id+'">'
      + '<summary class="ads-collapsible-summary">'+title+'</summary>'
      + '<div class="ads-collapsible-body">'+contentHtml+'</div>'
      + '</details>';
  };

  /* ── Tab 그룹: 설정 패널이 지나치게 길어지지 않도록 한다(design.md "설정 UI" 섹션).
     tabs: [{id,label,content}]. 순수 표시 전환만 담당하는 최소 상태(모듈 지역 변수)이며,
     TS.state/SPS.state/저장 스키마에는 전혀 영향을 주지 않는다 — 탭 위치는 저장되지 않고
     항상 첫 번째 탭으로 시작한다. */
  var tabActiveIndex = {};
  ADS.renderTabs = function(groupId, tabs){
    if(tabActiveIndex[groupId]==null) tabActiveIndex[groupId] = 0;
    var active = tabActiveIndex[groupId];
    var barHtml = tabs.map(function(t,i){
      return '<button type="button" class="ads-tab-btn'+(i===active?' active':'')+'" onclick="adsShowTab(\''+groupId+'\','+i+')">'+t.label+'</button>';
    }).join('');
    var panelsHtml = tabs.map(function(t,i){
      return '<div class="ads-tab-panel" data-tab-group="'+groupId+'" data-tab-index="'+i+'" style="display:'+(i===active?'block':'none')+'">'+t.content+'</div>';
    }).join('');
    return '<div class="ads-tabs" id="ads-tabs-'+groupId+'">'
      + '<div class="ads-tab-bar">'+barHtml+'</div>'
      + '<div class="ads-tab-panels">'+panelsHtml+'</div>'
      + '</div>';
  };
  ADS.showTab = function(groupId, index){
    tabActiveIndex[groupId] = index;
    var bar = document.querySelector('#ads-tabs-'+groupId+' .ads-tab-bar');
    if(bar){
      Array.prototype.forEach.call(bar.children, function(btn,i){ btn.classList.toggle('active', i===index); });
    }
    document.querySelectorAll('.ads-tab-panel[data-tab-group="'+groupId+'"]').forEach(function(p){
      p.style.display = (Number(p.getAttribute('data-tab-index'))===index) ? 'block' : 'none';
    });
  };

  /* ── Theme Card용 미니어처: 실제 카드처럼 보이는 축소 목업. 실제 Thumbnail/SalesPage 렌더
     파이프라인을 재사용하지 않고(상호 의존 방지), 이 모듈 안에서 토큰만으로 독립적으로 그린다.
     Thumbnail 미니어처는 반드시 4:3 비율(실제 Export 규격과 동일 비율)로 그린다.
     M3.2 Premium Polish: Study Note/Handwriting은 실제 카드 데코(ADS.cardDecoration)와 같은
     시각 언어(도트그리드/워시테이프)를 축소판에도 넣어 "카드 안에서도 같은 브랜드 세계"로
     보이게 한다. Premium은 기존 수준을 유지하고 손대지 않는다. ── */
  function miniDecoration(theme){
    if(theme.notePattern==='dotgrid'){
      return '<div style="position:absolute;inset:0;background-image:radial-gradient('+theme.tokens.primary+' 1px,transparent 1px);background-size:9px 9px;opacity:.13;pointer-events:none"></div>'
        + '<div style="position:absolute;top:4px;right:6px;font-size:10px;opacity:.55;transform:rotate(8deg);pointer-events:none">📎</div>';
    }
    if(theme.notePattern==='diary'){
      return '<div style="position:absolute;top:-3px;left:12px;width:26px;height:9px;background:'+theme.tokens.accent+';opacity:.6;transform:rotate(-4deg);border-radius:1px;pointer-events:none"></div>';
    }
    return '';
  }
  ADS.miniThumbnail = function(theme){
    var t = theme.tokens;
    return '<div class="ads-mini ads-mini-thumb" style="background:'+t.background+'">'
      + miniDecoration(theme)
      + '<div class="ads-mini-badge" style="background:'+t.primarySoft+';color:'+t.primary+';border-color:'+t.primary+'">EBOOK</div>'
      + '<div class="ads-mini-title" style="color:'+t.textPrimary+';font-family:'+t.headingFont+'">퇴근 후 2시간<br/>부업 시작하기</div>'
      + '<div class="ads-mini-cta" style="background:'+t.primary+';color:'+t.buttonText+'">지금 시작 →</div>'
      + '</div>';
  };

  ADS.miniSalesCard = function(theme, variant){
    var t = theme.tokens;
    var inner;
    if(variant==='list'){
      inner = '<div class="ads-mini-title ads-mini-title-sm" style="color:'+t.textPrimary+';font-family:'+t.headingFont+'">핵심 장점</div>'
        + [0,1,2].map(function(i){
            return '<div class="ads-mini-row" style="background:'+t.surfaceSecondary+';color:'+t.textPrimary+'"><span style="color:'+t.primary+'">'+ADS.listIcon(theme.id,i)+'</span> 포인트 '+(i+1)+'</div>';
          }).join('');
    } else {
      inner = '<div class="ads-mini-badge" style="background:'+t.primarySoft+';color:'+t.primary+';border-color:'+t.primary+'">HOOK</div>'
        + '<div class="ads-mini-title ads-mini-title-sm" style="color:'+t.textPrimary+';font-family:'+t.headingFont+'">이렇게 시작했습니다</div>'
        + '<div class="ads-mini-cta ads-mini-cta-sm" style="background:'+t.primary+';color:'+t.buttonText+'">읽어보기</div>';
    }
    /* 종이/다이어리 테마는 두 번째(list) 카드에 아주 미세한 회전을 줘 "쌓여있는 메모"처럼
       레이어감을 준다 — Premium은 회전 없이 반듯하게 유지(고급/에디토리얼 톤 유지). */
    var layerTilt = (variant==='list' && (theme.notePattern==='dotgrid'||theme.notePattern==='diary'))
      ? ';transform:rotate('+(theme.notePattern==='dotgrid'?'-1.2deg':'1.4deg')+')' : '';
    return '<div class="ads-mini ads-mini-sales" style="background:'+t.surface+';border-color:'+t.border+layerTilt+'">'+miniDecoration(theme)+inner+'</div>';
  };

  /* UI Elements/Badge/Icons 범례 — Theme Card 하단에 실제 버튼/뱃지/아이콘 스타일을 미리 보여준다. */
  function themeLegendHtml(theme){
    var t = theme.tokens;
    var icons = (theme.icons||[]).map(function(ic){ return '<span class="ads-legend-icon">'+ic+'</span>'; }).join('');
    return '<div class="ads-card-legend">'
      + '<span class="ads-legend-btn ads-legend-btn-primary" style="background:'+t.primary+';color:'+t.buttonText+'">Primary</span>'
      + '<span class="ads-legend-btn ads-legend-btn-ghost" style="border-color:'+t.border+';color:'+t.textPrimary+'">Ghost</span>'
      + '<span class="ads-legend-badge" style="background:'+t.primarySoft+';color:'+t.primary+';border-color:'+t.primary+'">Badge</span>'
      + '<span class="ads-legend-icons">'+icons+'</span>'
      + '</div>';
  }

  function themeCardHtml(scope, theme){
    var active = ADS.state.themeId===theme.id;
    var previews = '<div class="ads-card-previews">'
      + ADS.miniThumbnail(theme)
      + '<div class="ads-card-previews-sales">'+ADS.miniSalesCard(theme,'hero')+ADS.miniSalesCard(theme,'list')+'</div>'
      + '</div>';
    var palette = '<div class="ads-palette">'+theme.palette.map(function(c){return '<span class="ads-dot" style="background:'+c+'"></span>';}).join('')+'</div>';
    var fontSample = '<div class="ads-font-sample" style="font-family:'+theme.tokens.headingFont+'">'+FONT_SAMPLE.heading+'</div>';
    var tags = '<div class="ads-card-tags">'+(theme.tags||[]).map(function(tg){
      return '<span class="ads-card-tag" style="background:'+theme.tokens.primarySoft+';color:'+theme.tokens.primary+'">'+tg+'</span>';
    }).join('')+'</div>';
    /* Brand Card 완성도: Study Note/Handwriting 카드에는 "종이가 살짝 겹쳐 쌓인" 듯한
       입체감을 ::before 레이어로 더한다(hover/active box-shadow와 별개 레이어라 서로
       간섭하지 않는다). Premium은 손대지 않고 기존 절제된 카드 그대로 유지한다. */
    var paperClass = (theme.notePattern==='dotgrid') ? ' ads-card-paper ads-card-paper-warm'
      : (theme.notePattern==='diary') ? ' ads-card-paper ads-card-paper-rose' : '';
    return '<div class="ads-theme-card'+paperClass+(active?' active':'')+'" onclick="adsSelectTheme(\''+theme.id+'\')">'
      + (active ? '<div class="ads-card-badge" style="background:'+theme.tokens.primary+';color:'+theme.tokens.buttonText+'">✓ 적용됨</div>' : '')
      + previews
      + '<div class="ads-card-name">'+theme.name+'</div>'
      + '<div class="ads-card-tagline">'+theme.tagline+'</div>'
      + tags
      + '<div class="ads-card-recommend">추천: '+theme.recommendedFor+'</div>'
      + palette
      + fontSample
      + themeLegendHtml(theme)
      + '</div>';
  }

  ADS.renderThemeSelectorSection = function(scope){
    var cards = Object.keys(ADS.themes).map(function(k){ return themeCardHtml(scope, ADS.themes[k]); }).join('');
    return '<div class="ads-section" id="ads-theme-cards-'+scope+'">'
      + '<div class="ads-section-title">브랜드 디자인 테마 <span class="ads-section-sub">(시제품 3종 · Business/Creator/Minimal/Health/Finance/Parenting은 다음 확장)</span></div>'
      + '<div class="ads-theme-grid">'+cards+'</div>'
      + '</div>';
  };

  ADS.renderFontPairComparison = function(scope){
    var cols = Object.keys(ADS.themes).map(function(k){
      var th = ADS.themes[k];
      return '<div class="ads-font-col">'
        + ADS.miniSalesCard(th,'hero')
        + '<div class="ads-font-col-name">'+th.name+'</div>'
        + '<div class="ads-font-row"><span class="ads-font-tag">제목</span><span style="font-family:'+th.tokens.headingFont+'">'+FONT_SAMPLE.heading+'</span></div>'
        + '<div class="ads-font-row"><span class="ads-font-tag">본문</span><span style="font-family:'+th.tokens.bodyFont+'">'+FONT_SAMPLE.body+'</span></div>'
        + '<div class="ads-font-row"><span class="ads-font-tag">포인트</span><span style="font-family:'+th.tokens.accentFont+'">'+FONT_SAMPLE.accent+'</span></div>'
        + '</div>';
    }).join('');
    return '<div class="ads-section" id="ads-font-compare-'+scope+'">'
      + '<div class="ads-section-title">Font Pair &amp; 테마별 Preview 비교</div>'
      + '<div class="ads-font-compare-grid">'+cols+'</div>'
      + '</div>';
  };

})(window.AtlasDesignSystem);

function adsSelectTheme(themeId){ AtlasDesignSystem.selectTheme(themeId); }
function adsShowTab(groupId, index){ AtlasDesignSystem.showTab(groupId, index); }
