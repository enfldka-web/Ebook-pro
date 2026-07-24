/* thumbnail-claude-style-renderer.js — Milestone 3.2 Phase 8 / Phase 8.1: Claude Style Renderer
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md, design.md

   이것은 Claude Design을 호출하거나 자동 조작하는 기능이 아니다. Claude Design에서
   확인한 디자인 언어(Typography/Spacing/Layout/Component/Color Hierarchy/Visual
   Hierarchy)를 Atlas 내부 Renderer로 "이식"한 것 — 외부 서비스 호출이 전혀 없다.

   Phase 7.1의 HTML/CSS Fallback Renderer(js/thumbnail-blueprint-adapter.js +
   js/thumbnail-studio.js의 기존 renderLayoutBody)는 이 파일이 전혀 건드리지 않는다.
   이 Renderer는 완전히 추가적인 "다른 렌더 모드"이며, thumbnail-studio.js가
   TS.state.rendererMode 값에 따라 어느 쪽을 그릴지 선택할 뿐이다.

   BrandProfile/Marketing Copy/Thumbnail Blueprint는 전부 읽기 전용으로만 쓰고
   어디에서도 수정하지 않는다. 새 카피를 만들지 않고, Marketing Copy 값을 그대로
   출력만 한다. Brand Pack 이름으로 분기하지 않고 BrandProfile.brandStrategy가
   내려보낸 colorStrategy 값으로만 "분위기(mood)"를 결정한다.

   모든 render*() 함수는 순수 함수다(DOM/APP 접근 없음, 부작용 없음) — 독립적으로
   Node에서 테스트 가능하다.

   Phase 8.1: 시각 품질 정밀화. 제목 원문은 어디서도 변형하지 않는다 — Preview에만
   "2줄 우선 표시용" 텍스트를 계산하고, state.mainTitle/사용자 편집 입력은 항상
   원문 그대로 유지한다(별도 파일에서 보장, 이 파일은 표시용 계산만 한다). */

window.AtlasClaudeStyleRenderer = window.AtlasClaudeStyleRenderer || {};

(function(CSR){

  var SPACING = { xs:8, sm:16, md:24, lg:32, xl:48, xxl:64 };
  CSR.SPACING = SPACING;

  var TYPE_SCALE = { headline:40, subtitle:17, badge:11, cta:16 };
  CSR.TYPE_SCALE = TYPE_SCALE;

  var RADIUS = { sm:10, md:16, lg:22, pill:100 };
  CSR.RADIUS = RADIUS;

  /* Preview 안에서 제목이 2줄 안에 들어가지 않을 때 허용하는 절대 최소 크기.
     이보다 더 줄이지 않는다 — 대신 안전한 문장 경계 기반 축약을 시도한다. */
  var ABS_MIN_HEADLINE = 26;
  CSR.ABS_MIN_HEADLINE = ABS_MIN_HEADLINE;

  /* ── colorStrategy → Mood Preset ──
     Brand Pack 이름이 아니라 BrandProfile.brandStrategy에서 내려온 colorStrategy
     (authority/trust/relationship/neutral) 값만 읽는다. Phase 8.1: 색만 다른 게
     아니라 헤드라인 크기 범위/폰트/모형(mockup) 테마/CTA 크기까지 모두 다르게
     만들어 "완전히 다른 분위기"를 강화한다. */
  var MOOD_BY_STRATEGY = {
    authority: {
      cornerRadius:RADIUS.sm, shadow:'strong', texture:'grid',
      ctaShape:'rounded-rect', ctaSize:'compact', badgeStyle:'eyebrow',
      headlineWeight:900, letterSpacingHeadline:'-0.015em',
      headlineFont:'serif', headlineMax:52, headlineMin:46,
      mockupTheme:'report'
    },
    trust: {
      cornerRadius:RADIUS.md, shadow:'soft', texture:'paper',
      ctaShape:'pill', ctaSize:'medium', badgeStyle:'soft-pill',
      headlineWeight:700, letterSpacingHeadline:'0',
      headlineFont:'sans', headlineMax:44, headlineMin:38,
      mockupTheme:'checklist'
    },
    relationship: {
      cornerRadius:RADIUS.lg, shadow:'glow', texture:'grain',
      ctaShape:'pill', ctaSize:'invitation', badgeStyle:'soft-pill',
      headlineWeight:600, letterSpacingHeadline:'0',
      headlineFont:'sans', headlineMax:46, headlineMin:40,
      mockupTheme:'diary'
    },
    neutral: {
      cornerRadius:RADIUS.md, shadow:'soft', texture:'grain',
      ctaShape:'rounded-rect', ctaSize:'medium', badgeStyle:'soft-pill',
      headlineWeight:700, letterSpacingHeadline:'0',
      headlineFont:'sans', headlineMax:40, headlineMin:34,
      mockupTheme:'generic'
    }
  };
  CSR.moodFor = function(colorStrategy){ return MOOD_BY_STRATEGY[colorStrategy] || MOOD_BY_STRATEGY.neutral; };

  var CTA_SIZE = {
    compact:    { padY:10, padX:20, fontSize:14 },
    medium:     { padY:13, padX:24, fontSize:15 },
    invitation: { padY:14, padX:28, fontSize:15 }
  };

  /* ── Component: Shadow ── */
  CSR.renderShadow = function(intensity, accent){
    switch(intensity){
      case 'strong': return '0 20px 45px -12px '+accent+'55, 0 8px 16px -6px rgba(0,0,0,.45)';
      case 'glow':   return '0 16px 40px -10px '+accent+'40, 0 0 0 1px '+accent+'22';
      case 'soft':
      default:       return '0 10px 26px -10px '+accent+'35, 0 4px 10px -4px rgba(0,0,0,.3)';
    }
  };

  /* ── Component: Texture (noise/grain) ── */
  var NOISE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">'
    +'<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>'
    +'<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"/></filter>'
    +'<rect width="100%" height="100%" filter="url(#n)"/></svg>';
  var NOISE_DATA_URI = 'data:image/svg+xml,'+encodeURIComponent(NOISE_SVG);

  var TEXTURE_BUILDERS = {
    'grid':  function(accent){ return 'background-image:linear-gradient('+accent+'14 1px,transparent 1px),linear-gradient(90deg,'+accent+'14 1px,transparent 1px);background-size:34px 34px;opacity:.4'; },
    'paper': function(accent){ return 'background-image:radial-gradient(circle,'+accent+'16 1px,transparent 1.3px);background-size:20px 20px;opacity:.35'; },
    'grain': function(){ return 'background-image:url(&quot;'+NOISE_DATA_URI+'&quot;);background-size:120px 120px;opacity:.5;mix-blend-mode:overlay'; }
  };
  CSR.renderTexture = function(type, accent){
    var fn = TEXTURE_BUILDERS[type] || TEXTURE_BUILDERS.grain;
    return '<div style="position:absolute;inset:0;pointer-events:none;z-index:0;'+fn(accent)+'"></div>';
  };

  /* ── Component: Background (다층 구성) ──
     Phase 8.1: relationship(따뜻한 톤)은 accent 단색 조명만 얹으면 "채도 높은
     주황 한 덩어리"처럼 보이는 문제가 있어, 크림톤의 보조 glow를 하나 더 얹고
     grain 텍스처 비중을 살짝 높여 "따뜻한 그라데이션 + 부드러운 질감"으로
     만든다. 기존 테마 배경(TS_COLOR_THEMES)은 건드리지 않는다 — 그 위에 얹는
     장식 레이어만 조정한다. */
  CSR.renderBackground = function(ct, backgroundStyle, mood){
    var accent = ct.accent;
    var glowByStyle = {
      'dark-premium': 'radial-gradient(circle at 82% 12%,'+accent+'2c,transparent 58%)',
      'light-clean':  'radial-gradient(circle at 20% 0%,'+accent+'22,transparent 55%)',
      'warm-soft':    'radial-gradient(circle at 12% 92%,'+accent+'30,transparent 62%)',
      'neutral':      'radial-gradient(circle at 50% 0%,'+accent+'1c,transparent 60%)'
    };
    var glow = glowByStyle[backgroundStyle] || glowByStyle.neutral;
    var vignette = 'radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,0,0,.28) 100%)';
    var warmSoften = (mood && mood.mockupTheme==='diary')
      ? '<div style="position:absolute;inset:0;pointer-events:none;z-index:0;background:radial-gradient(circle at 70% 25%,rgba(255,241,220,.14),transparent 55%)"></div>'
      : '';
    return '<div style="position:absolute;inset:0;pointer-events:none;z-index:0;background:'+glow+'"></div>'
      + warmSoften
      + CSR.renderTexture(mood.texture, accent)
      + '<div style="position:absolute;inset:0;pointer-events:none;z-index:0;background:'+vignette+'"></div>';
  };

  /* ── Component: Badge ── */
  CSR.renderBadge = function(text, accent, mood, escFn, maxWidth){
    var esc = escFn || function(s){ return String(s||''); };
    maxWidth = maxWidth || 220;
    var label = esc(text||'');
    if(mood.badgeStyle==='eyebrow'){
      var fontFamily = mood.headlineFont==='serif' ? 'var(--ads-accent-font, "Noto Serif KR", Georgia, serif)' : 'var(--ads-accent-font,inherit)';
      return '<div style="display:inline-block;max-width:'+maxWidth+'px;color:'+accent+';font-size:'+(TYPE_SCALE.badge)+'px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:'+fontFamily+'">'+label+'</div>';
    }
    return '<div style="display:inline-block;max-width:'+maxWidth+'px;padding:6px 14px;border-radius:'+RADIUS.pill+'px;background:'+accent+'1f;color:'+accent+';font-size:'+TYPE_SCALE.badge+'px;font-weight:600;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--ads-accent-font,inherit)">'+label+'</div>';
  };

  /* ── Component: Highlight ── */
  CSR.renderHighlight = function(title, highlightWords, escFn){
    var TBA = (typeof AtlasThumbnailBlueprintAdapter!=='undefined') ? AtlasThumbnailBlueprintAdapter : null;
    if(!TBA) { var esc=escFn||function(s){return String(s||'');}; return esc(title); }
    var html = TBA.highlightedTitleHtml(title, highlightWords, escFn);
    return html.split('class="ts-highlight"').join('class="ts-highlight ts-highlight-underline"');
  };

  /* ── 제목 표시 텍스트 계산 (Phase 8.1 핵심 로직) ──
     - Marketing Copy 원문(title)은 절대 변형하지 않는다. 이 함수는 "Preview에
       어떤 문자열을 보여줄지"만 계산해서 반환하고, 호출 측(state.mainTitle)은
       전혀 건드리지 않는다.
     - 1차: 원문 그대로 2줄에 맞을 때까지 mood.headlineMax → ABS_MIN_HEADLINE(26)
       사이에서 폰트 크기를 줄인다.
     - 2차: 26px에서도 2줄이 안 되면, 원문에 이미 있는 em-dash(—)/comma(,) 경계
       에서만 "앞부분 핵심 + 그 안의 세부 핵심"을 잘라 후보 문장을 만든다.
       새 단어를 만들지 않는다 — 오직 원문의 부분 문자열만 사용한다.
     - 3차: 그래도 2줄에 안 들어가면 원문 전체를 26px로 그대로 반환하고
       needsManualShorten:true 를 반환한다(임의로 자르거나 줄여쓰지 않음 —
       사용자에게 "제목 수동 축약 필요"를 안내). */
  CSR.extractTitleSegments = function(title){
    var t = String(title||'');
    var candidates = [];
    var dashIdx = t.indexOf('—');
    var front = dashIdx > 0 ? t.slice(0, dashIdx).trim() : '';
    if(front) candidates.push(front);
    var base = front || t;
    var commaIdx = base.indexOf(',');
    if(commaIdx > 0){
      var core = base.slice(0, commaIdx).trim();
      if(core && candidates.indexOf(core)===-1) candidates.push(core);
    }
    return candidates;
  };

  var TITLE_CHAR_WIDTH_RATIO = 0.92;
  function estimateLines(text, size, availableWidth){
    var n = String(text||'').length;
    if(!n) return 1;
    var perLine = Math.max(1, Math.floor(availableWidth/(size*TITLE_CHAR_WIDTH_RATIO)));
    return Math.ceil(n/perLine);
  }

  CSR.fitDisplayTitle = function(title, availableWidth, mood){
    availableWidth = availableWidth || 400;
    var t = String(title||'');
    var maxSize = (mood && mood.headlineMax) || TYPE_SCALE.headline;
    if(!t) return { text:'', size:maxSize, needsManualShorten:false, segmented:false };

    var size;
    for(size=maxSize; size>=ABS_MIN_HEADLINE; size--){
      if(estimateLines(t, size, availableWidth)<=2){
        return { text:t, size:size, needsManualShorten:false, segmented:false };
      }
    }
    var segments = CSR.extractTitleSegments(t);
    for(var i=0;i<segments.length;i++){
      var seg = segments[i];
      for(size=maxSize; size>=ABS_MIN_HEADLINE; size--){
        if(estimateLines(seg, size, availableWidth)<=2){
          return { text:seg, size:size, needsManualShorten:false, segmented:true };
        }
      }
    }
    return { text:t, size:ABS_MIN_HEADLINE, needsManualShorten:true, segmented:false };
  };

  /* ── Component: Headline ──
     반환값이 문자열이 아니라 {html, needsManualShorten} 객체다 — Preview 밖(캔버스
     바깥)에 "제목 수동 축약 필요" 안내를 그리기 위해 상위 호출자가 이 플래그를
     읽어야 한다. Export 대상(#ts-preview-canvas) 안에는 이 안내를 절대 넣지 않는다
     (thumbnail-studio.js에서 캔버스의 형제 요소로만 그린다). */
  CSR.renderHeadline = function(title, availableWidth, mood, highlightWords, escFn, textAlign, textc){
    var esc = escFn || function(s){ return String(s||''); };
    var fit = CSR.fitDisplayTitle(title, availableWidth, mood);
    var lineHeight = fit.size>=32 ? 1.14 : 1.22;
    var fontFamily = mood.headlineFont==='serif'
      ? 'var(--ads-heading-font, "Noto Serif KR", Georgia, serif)'
      : 'var(--ads-heading-font,inherit)';
    var html = fit.text ? CSR.renderHighlight(fit.text, highlightWords, esc) : esc('메인 제목을 입력하세요');
    /* needsManualShorten일 때만 overflow-wrap:break-word를 추가한다 — 공백/구두점이
       전혀 없는 극단적인 원문(사실상 실제 Marketing Copy에서는 나오지 않음)이라도
       캔버스 밖으로 시각적으로 잘리지 않고 줄바꿈되게 하는 안전장치다. 이 경우에도
       텍스트는 100% 그대로 보이며 어떤 글자도 잘라내지 않는다("잘림 금지" 유지). */
    var wrapSafety = fit.needsManualShorten ? ';overflow-wrap:break-word' : '';
    var headlineHtml = '<div style="font-size:'+fit.size+'px;line-height:'+lineHeight+';font-weight:'+mood.headlineWeight+';letter-spacing:'+mood.letterSpacingHeadline+';color:var(--ads-text-primary,'+textc+');word-break:keep-all'+wrapSafety+';font-family:'+fontFamily+';text-align:'+textAlign+'">'+html+'</div>';
    var underline = (mood.mockupTheme==='diary' && fit.text) ? CSR.renderHandDrawnUnderline(textc==='#ffffff' ? '#ffffff' : textc, textAlign) : '';
    return { html: headlineHtml + underline, needsManualShorten: fit.needsManualShorten };
  };

  /* Relationship 전용: 손글씨 느낌의 물결 밑줄 — 새 문구가 아니라 순수 장식이다. */
  CSR.renderHandDrawnUnderline = function(color, textAlign){
    var justify = textAlign==='left' ? 'flex-start' : (textAlign==='right' ? 'flex-end' : 'center');
    return '<div style="display:flex;justify-content:'+justify+';margin-top:6px">'
      +'<svg width="120" height="12" viewBox="0 0 120 12" style="opacity:.55"><path d="M2 8 Q20 2 38 8 T74 8 T110 8" fill="none" stroke="'+color+'" stroke-width="2.4" stroke-linecap="round"/></svg>'
      +'</div>';
  };

  /* ── Component: Subtitle ── */
  CSR.renderSubtitle = function(sub, textAlign, textc){
    if(!sub) return '';
    var TBA = (typeof AtlasThumbnailBlueprintAdapter!=='undefined') ? AtlasThumbnailBlueprintAdapter : null;
    var size = TBA ? TBA.autoFitSubtitleSize(sub, TYPE_SCALE.subtitle) : TYPE_SCALE.subtitle;
    return '<div style="font-size:'+size+'px;line-height:1.5;margin-top:'+SPACING.sm+'px;color:var(--ads-text-secondary,'+textc+');opacity:.78;font-weight:400;word-break:keep-all;font-family:var(--ads-body-font,inherit);text-align:'+textAlign+';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+x(sub)+'</div>';
  };

  /* ── Component: CTA ──
     ctaSize(compact/medium/invitation)로 mood별 크기 차이를 낸다 — Authority는
     작고 단호하게, Trust는 중간, Relationship은 "둥근 초대장" 느낌으로 약간 더
     넓게. Badge(TYPE_SCALE.badge=11px)보다 항상 크게 유지된다. */
  CSR.renderCTA = function(cta, accent, textColor, mood){
    if(!cta) return '';
    var esc = function(s){ return String(s||''); };
    var radius = mood.ctaShape==='pill' ? RADIUS.pill : RADIUS.md;
    var shadow = CSR.renderShadow(mood.shadow==='strong'?'strong':'soft', accent);
    var sz = CTA_SIZE[mood.ctaSize] || CTA_SIZE.medium;
    return '<div style="display:inline-flex;align-items:center;gap:8px;padding:'+sz.padY+'px '+sz.padX+'px;border-radius:'+radius+'px;'
      +'background:linear-gradient(180deg,'+accent+'ff,'+accent+'d9);color:'+textColor+';font-size:'+sz.fontSize+'px;font-weight:800;'
      +'font-family:var(--ads-accent-font,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;'
      +'box-shadow:'+shadow+', inset 0 1px 0 rgba(255,255,255,.35)">'+esc(cta)+' <span style="font-weight:900">→</span></div>';
  };

  function checkDot(accent, filled, size){
    size = size || 16;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;flex-shrink:0;'
      +(filled ? ('background:'+accent+';color:#0c0c1a;box-shadow:0 0 10px '+accent+'70') : ('border:1.5px solid '+accent+'70;color:'+accent))
      +';font-size:'+Math.round(size*0.6)+'px;font-weight:900">'+(filled?'✓':'')+'</span>';
  }
  function bar(width, color, height, rounded){
    return '<div style="height:'+(height||9)+'px;border-radius:'+(rounded||6)+'px;width:'+width+'%;background:'+color+'"></div>';
  }

  /* ── Component: Mockup (Left/Right Image, Icon Focus용) ──
     Phase 8.1: mood.mockupTheme(report/checklist/diary/generic)에 따라 완전히
     다른 구성을 그린다 — 색상만 바꾼 동일한 카드가 아니다. 여전히 순수 CSS/SVG
     도형만 쓰고 실제 이미지나 외부 서비스는 전혀 쓰지 않는다. variant('left'|
     'right')는 Left/Right Image가 단순 좌우 반전이 되지 않도록 각도/강조 코너를
     다르게 준다. */
  CSR.renderMockup = function(kind, imageStyle, iconStyle, accent, mood, variant){
    var shadow = CSR.renderShadow(mood.shadow, accent);
    if(kind==='icon') return renderIconMockup(mood.mockupTheme, accent, mood, shadow);
    return renderImageMockup(mood.mockupTheme, accent, mood, shadow, variant);
  };

  function cornerBracket(pos, accent, size){
    size = size || 22;
    var isTop = pos==='tl' || pos==='tr';
    var isLeft = pos==='tl' || pos==='bl';
    var css = 'position:absolute;width:'+size+'px;height:'+size+'px;'
      + (isTop ? 'border-top:2px solid '+accent+'85;' : 'border-bottom:2px solid '+accent+'85;')
      + (isLeft ? 'border-left:2px solid '+accent+'85;' : 'border-right:2px solid '+accent+'85;')
      + (isTop ? 'top:0;' : 'bottom:0;') + (isLeft ? 'left:0;' : 'right:0;');
    return '<div style="'+css+'"></div>';
  }

  function renderImageMockup(theme, accent, mood, shadow, variant){
    var mirror = variant==='right';
    var tiltA = mirror ? 7 : -7;
    var tiltB = mirror ? -4 : 4;

    if(theme==='report'){
      // Authority: 얇은 선/코너 브래킷 + 상승형 막대 그래프 — "성과 보고서/프레임" 느낌.
      // variant에 따라 브래킷 대각선과 그래프 진행 방향을 반대로 둬 좌/우가 단순
      // 미러가 아니라 각자 다른 "읽는 방향"을 갖게 한다.
      var barFractions = mirror ? [0.92,0.68,0.5,0.32] : [0.32,0.5,0.68,0.92];
      var bars = barFractions.map(function(f){
        return '<div style="width:14%;height:'+Math.round(f*100)+'%;background:'+accent+';opacity:'+(0.4+f*0.5)+';border-radius:3px 3px 0 0"></div>';
      }).join('');
      var cA = mirror ? 'tr' : 'tl', cB = mirror ? 'bl' : 'br';
      return '<div style="position:relative;width:100%;height:100%;padding:10%;box-sizing:border-box">'
        +'<div style="position:absolute;inset:12%;border:1px solid '+accent+'40;border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.03);box-shadow:'+shadow+'">'
        + cornerBracket(cA, accent) + cornerBracket(cB, accent)
        +'<div style="position:absolute;left:14%;right:14%;top:14%;height:1px;background:'+accent+'55"></div>'
        +'<div style="position:absolute;left:14%;right:14%;bottom:16%;height:64%;display:flex;align-items:flex-end;gap:8%;flex-direction:'+(mirror?'row-reverse':'row')+'">'+bars+'</div>'
        +'</div></div>';
    }
    if(theme==='checklist'){
      // Trust: 단계 표시(step) + 체크리스트 행 3개 — 실제 정보 구조처럼 보이게.
      // variant에 따라 진행 방향(체크 완료 위치)을 반대로 둬 좌/우 눈길 흐름을 다르게 한다.
      var steps = mirror
        ? ('<div style="display:flex;align-items:center;gap:6px;margin-bottom:'+SPACING.sm+'px">'
          + checkDot(accent, false, 15) + '<div style="flex:1;height:2px;background:'+accent+'55"></div>'
          + checkDot(accent, true, 15) + '<div style="flex:1;height:2px;background:'+accent+'55"></div>'
          + checkDot(accent, true, 15) + '</div>')
        : ('<div style="display:flex;align-items:center;gap:6px;margin-bottom:'+SPACING.sm+'px">'
          + checkDot(accent, true, 15) + '<div style="flex:1;height:2px;background:'+accent+'55"></div>'
          + checkDot(accent, true, 15) + '<div style="flex:1;height:2px;background:'+accent+'55"></div>'
          + checkDot(accent, false, 15) + '</div>');
      var rowOrder = mirror ? [48,64,86] : [86,64,48];
      var rows = rowOrder.map(function(w,i){
        var checked = mirror ? (i>0) : (i<2);
        return '<div style="display:flex;align-items:center;gap:8px">'+checkDot(accent, checked, 15)+'<div style="flex:1">'+bar(w, accent+(checked?'a0':'55'))+'</div></div>';
      }).join('<div style="height:8px"></div>');
      return '<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center">'
        +'<div style="width:82%;border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.05);border:1px solid '+accent+'35;box-shadow:'+shadow+';padding:14%;box-sizing:border-box">'
        + steps + rows + '</div></div>';
    }
    if(theme==='diary'){
      // Relationship: 줄노트 텍스처 + 둥근 손글씨풍 라인 + 별 장식 — "다이어리/기록" 느낌.
      // variant에 따라 별 장식 위치와 카드 기울기를 반대 코너로 둬 좌/우가 다르게 보이게 한다.
      var lines = 'repeating-linear-gradient(transparent 0 22px,'+accent+'22 23px)';
      var handRows = (mirror ? [60,50,70] : [70,50,60]).map(function(w){ return '<div style="height:8px;border-radius:5px;width:'+w+'%;background:'+accent+'70"></div>'; }).join('<div style="height:12px"></div>');
      var starCorner = mirror ? 'left:-10px' : 'right:-10px';
      return '<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center">'
        +'<div style="position:relative;width:82%;height:76%;border-radius:'+mood.cornerRadius+'px;background:linear-gradient(160deg,'+accent+'20,'+accent+'08);border:1px solid '+accent+'40;box-shadow:'+shadow+';background-image:'+lines+';padding:14% 12%;box-sizing:border-box;transform:rotate('+(mirror?1.5:-1.5)+'deg)">'
        + handRows
        +'<div style="position:absolute;top:-10px;'+starCorner+';width:26px;height:26px;color:'+accent+';clip-path:polygon(50% 0%,63% 35%,100% 38%,72% 60%,82% 96%,50% 76%,18% 96%,28% 60%,0% 38%,37% 35%);background:'+accent+';box-shadow:0 0 12px '+accent+'80"></div>'
        +'</div></div>';
    }
    // generic/neutral: Phase 8 원형(겹친 카드 + 진행 바 + 완료 배지) 유지 — 안전한 기본값.
    var rows = [88,68,48].map(function(w,i){ return bar(w, accent+(i===0?'b0':'55'), 10); }).join('');
    return '<div style="position:relative;width:100%;height:100%">'
      +'<div style="position:absolute;inset:6% 14% 14% 6%;transform:rotate('+tiltA+'deg);border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.05);border:1px solid '+accent+'25"></div>'
      +'<div style="position:absolute;inset:10% 8% 8% 10%;transform:rotate('+tiltB+'deg);border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.04);border:1px solid '+accent+'30"></div>'
      +'<div style="position:absolute;inset:14%;border-radius:'+mood.cornerRadius+'px;background:rgba(10,10,20,.35);border:1px solid '+accent+'60;box-shadow:'+shadow+';padding:16%;box-sizing:border-box;display:flex;flex-direction:column;gap:'+SPACING.sm+'px;justify-content:center">'
      + rows
      +'<div style="margin-top:6px;width:28px;height:28px;border-radius:50%;background:'+accent+';display:flex;align-items:center;justify-content:center;font-size:13px;color:#0c0c1a;font-weight:900;box-shadow:0 0 14px '+accent+'80">✓</div>'
      +'</div></div>';
  }

  function renderIconMockup(theme, accent, mood, shadow){
    if(theme==='report'){
      // Authority: 게이지/다이얼 — 눈금 3개 + 바늘로 "성과 측정"을 표현.
      var ticks = [-40,0,40].map(function(deg){
        return '<div style="position:absolute;left:50%;top:6%;width:2px;height:12%;background:'+accent+'80;transform-origin:50% 400%;transform:translateX(-50%) rotate('+deg+'deg)"></div>';
      }).join('');
      return '<div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(from -120deg,'+accent+'55 0deg,'+accent+'15 216deg,transparent 216deg);box-shadow:'+shadow+';display:flex;align-items:center;justify-content:center;position:relative">'
        + ticks
        +'<div style="width:60%;height:60%;border-radius:50%;background:rgba(10,10,20,.55);border:1px solid '+accent+'60;display:flex;align-items:center;justify-content:center">'
        +'<div style="width:3px;height:34%;background:'+accent+';border-radius:2px;transform:rotate(24deg);transform-origin:50% 100%;box-shadow:0 0 10px '+accent+'80"></div>'
        +'</div></div>';
    }
    if(theme==='checklist'){
      // Trust: 체크리스트 + 검증 배지 + 구조를 한 컴포넌트에 결합 — 단일 원이 아니다.
      var miniRows = [70,50].map(function(w,i){ return '<div style="display:flex;align-items:center;gap:6px">'+checkDot(accent,true,12)+'<div style="flex:1">'+bar(w, accent+'80', 6)+'</div></div>'; }).join('<div style="height:6px"></div>');
      return '<div style="width:150px;height:150px;border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.05);border:1px solid '+accent+'40;box-shadow:'+shadow+';padding:16%;box-sizing:border-box;position:relative;display:flex;flex-direction:column;justify-content:center;gap:6px">'
        + miniRows
        +'<div style="position:absolute;right:-10px;bottom:-10px;width:38px;height:38px;border-radius:50%;background:'+accent+';display:flex;align-items:center;justify-content:center;color:#0c0c1a;font-weight:900;font-size:16px;box-shadow:0 0 16px '+accent+'80;border:2px solid rgba(255,255,255,.5)">✓</div>'
        +'</div>';
    }
    if(theme==='diary'){
      // Relationship: 따뜻한 원 + 별 장식 — 감성적 톤, 데이터 구조가 아니다.
      return '<div style="width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 35% 30%,'+accent+'45,'+accent+'10 70%);box-shadow:'+shadow+';display:flex;align-items:center;justify-content:center;position:relative">'
        +'<div style="width:60%;height:60%;border-radius:50%;border:2px solid '+accent+'60;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05)">'
        +'<div style="width:34%;height:34%;clip-path:polygon(50% 0%,63% 35%,100% 38%,72% 60%,82% 96%,50% 76%,18% 96%,28% 60%,0% 38%,37% 35%);background:'+accent+';box-shadow:0 0 16px '+accent+'80"></div>'
        +'</div></div>';
    }
    // generic/neutral: Phase 8 원형(동심원) 유지.
    return '<div style="width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 35% 30%,'+accent+'40,'+accent+'12 70%);box-shadow:'+shadow+';display:flex;align-items:center;justify-content:center">'
      +'<div style="width:64%;height:64%;border-radius:50%;border:2px solid '+accent+'70;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04)">'
      +'<div style="width:38%;height:38%;border-radius:50%;background:'+accent+';box-shadow:0 0 22px '+accent+'80"></div>'
      +'</div></div>';
  }

  /* ── Component: Comparison Panels ──
     Phase 8.1: BEFORE는 더 흐리게(대비 축소), AFTER는 더 강하게(그림자+테두리
     강화) 만들어 "변화"가 더 뚜렷이 보이도록 하고, 중앙 화살표를 키운다. */
  CSR.renderComparisonPanels = function(accent, panelWidth, mood){
    var shadow = CSR.renderShadow(mood.shadow, accent);
    var beforeRows = [72,56,42].map(function(w){ return '<div style="height:8px;border-radius:5px;width:'+w+'%;background:rgba(255,255,255,.12)"></div>'; }).join('');
    var afterRows = [92,76,62].map(function(w){ return '<div style="height:9px;border-radius:5px;width:'+w+'%;background:'+accent+'a0"></div>'; }).join('');
    return {
      before: '<div style="width:'+panelWidth+'px;border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.10);padding:'+SPACING.md+'px;box-sizing:border-box;display:flex;flex-direction:column;gap:'+SPACING.sm+'px;opacity:.82">'
        +'<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:rgba(255,255,255,.45);letter-spacing:.08em">'
        +'<span style="width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,.3);display:inline-flex;align-items:center;justify-content:center;font-size:10px">✕</span>BEFORE</div>'
        + beforeRows + '</div>',
      after: '<div style="width:'+panelWidth+'px;border-radius:'+mood.cornerRadius+'px;background:'+accent+'20;border:2px solid '+accent+'75;padding:'+SPACING.md+'px;box-sizing:border-box;display:flex;flex-direction:column;gap:'+SPACING.sm+'px;box-shadow:'+shadow+';transform:scale(1.04)">'
        +'<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:'+accent+';letter-spacing:.08em">'
        +'<span style="width:18px;height:18px;border-radius:50%;background:'+accent+';color:#0c0c1a;display:inline-flex;align-items:center;justify-content:center;font-size:10px">✓</span>AFTER</div>'
        + afterRows + '</div>',
      arrow: '<div style="width:52px;height:52px;border-radius:50%;background:'+accent+'26;border:1px solid '+accent+'55;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:'+accent+';box-shadow:'+shadow+'">→</div>'
    };
  };

  /* ── Component: 비대칭 그래픽 앵커 ──
     Center Text의 "의도된 여백"과 Top Banner의 중단부에 공통으로 재사용하는
     구조적 장식 컴포넌트다. mood.mockupTheme별로 형태가 달라 Authority=얇은
     프레임+막대, Trust=체크 그리드, Relationship=별+곡선, neutral=은은한 원.
     새 문구를 만들지 않는다 — 순수 도형/SVG만 사용한다. */
  CSR.renderAsymmetricAnchor = function(mood, accent, size){
    size = size || 120;
    if(mood.mockupTheme==='report'){
      return '<div style="position:relative;width:'+size+'px;height:'+Math.round(size*0.72)+'px;opacity:.9">'
        + cornerBracket('tl', accent, Math.round(size*0.22)) + cornerBracket('br', accent, Math.round(size*0.22))
        +'<div style="position:absolute;left:50%;bottom:8%;transform:translateX(-50%);display:flex;align-items:flex-end;gap:'+Math.round(size*0.05)+'px">'
        + [0.3,0.5,0.7,0.95].map(function(f){ return '<div style="width:'+Math.round(size*0.09)+'px;height:'+Math.round(size*0.5*f)+'px;background:'+accent+';opacity:'+(0.35+f*0.5)+';border-radius:2px"></div>'; }).join('')
        +'</div></div>';
    }
    if(mood.mockupTheme==='checklist'){
      var rows = [1,1,0].map(function(on,i){ return '<div style="display:flex;align-items:center;gap:'+Math.round(size*0.05)+'px">'+checkDot(accent, !!on, Math.round(size*0.14))+'<div style="width:'+Math.round(size*0.42)+'px;height:'+Math.round(size*0.06)+'px;border-radius:4px;background:'+accent+(on?'80':'35')+'"></div></div>'; }).join('<div style="height:'+Math.round(size*0.06)+'px"></div>');
      return '<div style="width:'+size+'px;border-radius:'+mood.cornerRadius+'px;background:rgba(255,255,255,.04);border:1px solid '+accent+'35;padding:'+Math.round(size*0.1)+'px;box-sizing:border-box;opacity:.9">'+rows+'</div>';
    }
    if(mood.mockupTheme==='diary'){
      return '<div style="position:relative;width:'+size+'px;height:'+size+'px;opacity:.85">'
        +'<svg width="'+size+'" height="'+size+'" viewBox="0 0 100 100"><path d="M6 60 Q30 30 50 55 T94 50" fill="none" stroke="'+accent+'" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>'
        +'<div style="position:absolute;top:6%;right:6%;width:'+Math.round(size*0.18)+'px;height:'+Math.round(size*0.18)+'px;background:'+accent+';clip-path:polygon(50% 0%,63% 35%,100% 38%,72% 60%,82% 96%,50% 76%,18% 96%,28% 60%,0% 38%,37% 35%);box-shadow:0 0 14px '+accent+'80"></div>'
        +'</div>';
    }
    return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;border:1px solid '+accent+'35;opacity:.7"></div>';
  };

  function x(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── 상단 좌측 이미지 스타일 라벨("FLAT" 등)이 Pattern 자체 Badge와 겹치지
     않도록 Badge 위치의 반대쪽 코너에 작게 배치한다(기능 자체는 유지 — Prompt
     Builder에 반영되는 실제 스타일 표시라 완전히 없애지 않고 축소/재배치만
     한다). */
  var OPPOSITE_CORNER = { 'top-left':'top-right', 'top-right':'top-left', 'top-center':'top-left' };
  function styleLabelBox(badgePos, inset){
    var corner = OPPOSITE_CORNER[badgePos] || 'top-right';
    if(corner==='top-right') return 'position:absolute;top:'+inset+'px;right:'+inset+'px;text-align:right;';
    return 'position:absolute;top:'+inset+'px;left:'+inset+'px;';
  }

  /* ── Component: Layout (시선 흐름 Headline → Mockup/Anchor → CTA) ──
     layoutId별로 Headline/Badge/Mockup(또는 Comparison/Anchor)/CTA를 조합한다.
     반환값은 {html, needsManualShorten} 객체다. */
  CSR.renderLayout = function(layoutId, ct, state, blueprintRender, escFn){
    var accent = ct.accent, textc = ct.text;
    var TBA = (typeof AtlasThumbnailBlueprintAdapter!=='undefined') ? AtlasThumbnailBlueprintAdapter : null;
    var br = blueprintRender || {};
    var mood = CSR.moodFor(br.colorStrategy);
    var textAlign = br.textAlignment || 'center';
    var inset = TBA ? TBA.negativeSpaceInset(br.negativeSpace) : SPACING.lg;
    var title = state.mainTitle;
    var sub = state.subtitle;
    var badgeText = state.customHook || (state.hooks && state.hooks[0]) || '';
    var ctaText = state.cta;
    var ctaTextColor = TBA ? TBA.ctaTextColorFor(accent) : '#0c0c1a';

    var TEXT_COLUMN_WIDTH = { 'left-image':652-240-inset, 'right-image':652-240-inset, 'icon-focus':652-240-inset };
    var availableWidth = TEXT_COLUMN_WIDTH[layoutId] || (652-inset*2);

    var headlineResult = CSR.renderHeadline(title, availableWidth, mood, br.highlightWords, escFn, textAlign, textc);
    var subtitleHtml = (TBA ? TBA.shouldShowSubtitle(title) : true) ? CSR.renderSubtitle(sub, textAlign, textc) : '';
    var badgeHtml = CSR.renderBadge(badgeText, accent, mood, escFn, 240);
    var ctaHtml = CSR.renderCTA(ctaText, accent, ctaTextColor, mood);

    var POSITION = {
      'comparison':  { badge:'top-left',  cta:'bottom' },
      'icon-focus':  { badge:'top-right', cta:'bottom' },
      'left-image':  { badge:'top-right', cta:'bottom-right' },
      'right-image': { badge:'top-left',  cta:'bottom-left' },
      'center-text': { badge:'top-left',  cta:'bottom' },
      'top-banner':  { badge:'top-center',cta:'bottom' }
    };
    var pos = POSITION[layoutId] || { badge:'top-left', cta:'bottom' };

    function box(p, extra){
      extra = extra||'';
      switch(p){
        case 'top-left':     return 'position:absolute;top:'+inset+'px;left:'+inset+'px;'+extra;
        case 'top-right':    return 'position:absolute;top:'+inset+'px;right:'+inset+'px;text-align:right;'+extra;
        case 'top-center':   return 'position:absolute;top:'+inset+'px;left:'+inset+'px;right:'+inset+'px;text-align:center;'+extra;
        case 'bottom-left':  return 'position:absolute;bottom:'+inset+'px;left:'+inset+'px;'+extra;
        case 'bottom-right': return 'position:absolute;bottom:'+inset+'px;right:'+inset+'px;text-align:right;'+extra;
        case 'bottom':       return 'position:absolute;bottom:'+inset+'px;left:'+inset+'px;right:'+inset+'px;text-align:center;'+extra;
        default:              return 'position:absolute;top:'+inset+'px;left:'+inset+'px;'+extra;
      }
    }

    var titleGroup = headlineResult.html + subtitleHtml;
    var needsManualShorten = headlineResult.needsManualShorten;
    var bodyHtml;

    if(layoutId==='left-image' || layoutId==='right-image'){
      var variant = layoutId==='left-image' ? 'left' : 'right';
      var mockup = CSR.renderMockup('image', br.imageStyle, br.iconStyle, accent, mood, variant);
      var mockupSide = layoutId==='left-image' ? 'left' : 'right';
      var textSide = layoutId==='left-image' ? ('left:240px;right:'+inset+'px') : ('left:'+inset+'px;right:240px');
      bodyHtml = '<div style="position:absolute;'+mockupSide+':'+inset+'px;top:'+(inset+16)+'px;bottom:'+(inset+16)+'px;width:180px;z-index:1">'+mockup+'</div>'
        +'<div style="'+box(pos.badge)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;'+textSide+';top:'+(inset+56)+'px;z-index:1">'+titleGroup+'</div>'
        +'<div style="'+box(pos.cta)+'z-index:2">'+ctaHtml+'</div>';
    } else if(layoutId==='icon-focus'){
      var iconMockup = CSR.renderMockup('icon', br.imageStyle, br.iconStyle, accent, mood);
      bodyHtml = '<div style="position:absolute;right:52px;top:60px;z-index:1">'+iconMockup+'</div>'
        +'<div style="position:absolute;top:'+inset+'px;right:224px;text-align:right;z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:230px;top:50%;transform:translateY(-50%);z-index:1">'+titleGroup+'</div>'
        +'<div style="'+box(pos.cta)+'z-index:2">'+ctaHtml+'</div>';
    } else if(layoutId==='comparison'){
      var panelW = Math.min(260, Math.floor((652-inset*2-64)/2));
      var cmp = CSR.renderComparisonPanels(accent, panelW, mood);
      bodyHtml = '<div style="'+box(pos.badge)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:'+(inset+38)+'px;z-index:1">'+titleGroup+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;top:206px;z-index:1">'+cmp.before+'</div>'
        +'<div style="position:absolute;left:50%;top:258px;transform:translate(-50%,-50%);z-index:2">'+cmp.arrow+'</div>'
        +'<div style="position:absolute;right:'+inset+'px;top:206px;z-index:1">'+cmp.after+'</div>'
        +'<div style="'+box(pos.cta)+'z-index:2">'+ctaHtml+'</div>';
    } else if(layoutId==='top-banner'){
      var anchor = CSR.renderAsymmetricAnchor(mood, accent, 128);
      bodyHtml = '<div style="position:absolute;left:0;right:0;top:0;height:176px;background:linear-gradient(180deg,'+accent+'26,'+accent+'0a 78%,transparent);z-index:0"></div>'
        +'<div style="'+box(pos.badge)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:'+(inset+56)+'px;z-index:1">'+titleGroup+'</div>'
        +'<div style="position:absolute;left:50%;top:322px;transform:translate(-50%,-50%);z-index:1">'+anchor+'</div>'
        +'<div style="'+box(pos.cta)+'z-index:2">'+ctaHtml+'</div>';
    } else if(layoutId==='number-focus'){
      bodyHtml = '<div style="position:absolute;left:'+inset+'px;top:44px;font-size:120px;font-weight:900;color:'+accent+'22;z-index:1">01</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;bottom:'+inset+'px;z-index:1">'+badgeHtml+'<div style="height:'+SPACING.sm+'px"></div>'+titleGroup+'<div style="height:'+SPACING.md+'px"></div>'+ctaHtml+'</div>';
    } else {
      // center-text (기본): 텍스트는 Blueprint의 textAlign을 그대로 따르되, 장식용
      // 비대칭 앵커를 반대쪽 여백에 얹어 "의도된 여백"을 만든다.
      var centerAnchor = CSR.renderAsymmetricAnchor(mood, accent, 108);
      bodyHtml = '<div style="'+box(pos.badge)+'z-index:2">'+badgeHtml+'</div>'
        +'<div style="position:absolute;right:'+Math.max(20,inset-8)+'px;bottom:'+Math.max(20,inset-8)+'px;z-index:0">'+centerAnchor+'</div>'
        +'<div style="position:absolute;left:'+inset+'px;right:'+inset+'px;top:50%;transform:translateY(-50%);z-index:1">'+titleGroup+'<div style="height:'+SPACING.lg+'px"></div><div style="text-align:'+textAlign+'">'+ctaHtml+'</div></div>';
    }

    return { html: bodyHtml, needsManualShorten: needsManualShorten };
  };

  /* ── Orchestrator: 캔버스 전체 조립 ──
     thumbnail-studio.js의 TS.renderPreview가 rendererMode==='claude-style'일 때
     호출한다. 반환값은 {html, needsManualShorten} 객체다 — html은 반드시
     #ts-preview-canvas 내부에만 삽입하고, needsManualShorten이 true면 캔버스
     "바깥"(형제 요소)에만 안내를 그려 Export에 절대 포함되지 않게 한다. */
  CSR.buildCanvasInnerHtml = function(state, ct, blueprintRender, styleBadgeText, escFn){
    var accent = ct.accent;
    var mood = CSR.moodFor(blueprintRender ? blueprintRender.colorStrategy : null);
    var bg = CSR.renderBackground(ct, blueprintRender ? blueprintRender.backgroundStyle : 'neutral', mood);
    var layoutId = state.layoutId;
    var layoutResult = CSR.renderLayout(layoutId, ct, state, blueprintRender, escFn);
    var POSITION_BADGE = {
      'comparison':'top-left','icon-focus':'top-right','left-image':'top-right',
      'right-image':'top-left','center-text':'top-left','top-banner':'top-center'
    };
    var badgePos = POSITION_BADGE[layoutId] || 'top-left';
    var inset = 16;
    var labelHtml = '<div style="'+styleLabelBox(badgePos, inset)+'font-size:9px;font-weight:800;letter-spacing:1.2px;color:'+accent+';z-index:1;opacity:.55">'+x(styleBadgeText||'')+'</div>';
    return {
      html: bg + labelHtml + layoutResult.html,
      needsManualShorten: layoutResult.needsManualShorten
    };
  };

})(window.AtlasClaudeStyleRenderer);
