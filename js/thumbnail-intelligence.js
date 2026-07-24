/* thumbnail-intelligence.js — Milestone 2.5: Thumbnail Intelligence v1 (신규, 기존 코드 무수정) */
/* 전역 네임스페이스: window.ThumbnailIntelligence. onclick 래퍼는 꼭 필요한 최소 개수만 노출한다.
   점수는 실제 CTR/매출 예측이 아니라 내부 휴리스틱 품질 평가이며, 모든 계산은 순수 함수로
   (동일 입력 → 동일 출력, 난수 없음) 구현한다. */

window.ThumbnailIntelligence = window.ThumbnailIntelligence || {};

(function(TI){

  /* ── 공용 헬퍼 (전부 순수 함수) ── */

  function len(s){ return String(s||'').trim().length; }

  // kmongSafeText(renderers.js)가 감지하는 과장/보장 표현 기준을 참고해, 이 모듈 전용으로
  // 결합도 없이 별도로 정의한다(기존 함수를 호출하거나 수정하지 않음).
  var BANNED_CLAIM_PATTERNS = [
    /100\s*%/i,
    /무조건|반드시\s*성공|확실한\s*수익|수익\s*보장|매출\s*보장|자동\s*수익|평생\s*수익/,
    /누구나\s*(?:쉽게|가능|성공)/,
    /\d[\d,]*\s*(?:만|억|천)?\s*원\s*(?:벌기|버는|수익|매출|달성)/
  ];
  function hasBannedClaim(text){
    var t = String(text||'');
    return BANNED_CLAIM_PATTERNS.some(function(p){ return p.test(t); });
  }

  var STRONG_KEYWORDS = ['초보','지금','평생','실패','전략','핵심','방법','줄이는','없는','시작','단계','노하우','실전'];
  function hasStrongSignal(hook){
    var t = String(hook||'');
    if(hasBannedClaim(t)) return false; // 과장/보장 표현은 가점 요소로 인정하지 않음
    if(/\d/.test(t)) return true;
    return STRONG_KEYWORDS.some(function(k){ return t.indexOf(k) >= 0; });
  }

  function tokens(s){
    return String(s||'').split(/\s+/).map(function(t){return t.trim();}).filter(Boolean);
  }
  function overlapRatio(a, b){
    var ta = tokens(a), tb = tokens(b);
    if(!ta.length || !tb.length) return 0;
    var setB = {}; tb.forEach(function(t){ setB[t]=true; });
    var common = ta.filter(function(t){ return setB[t]; }).length;
    return common / Math.max(ta.length, tb.length);
  }

  function activeHookText(state){
    if(!state) return '';
    if(state.customHook) return state.customHook;
    return (state.hooks && state.hooks[state.selectedHookIndex]) || (state.hooks && state.hooks[0]) || '';
  }

  /* ── A. Hook Strength (20점) ── */
  function scoreHookStrength(state){
    var hook = activeHookText(state);
    if(!len(hook)) return 0;
    var s = 10;
    var n = len(hook);
    if(n >= 4 && n <= 20) s += 5;
    if(hasStrongSignal(hook)) s += 5;
    return Math.min(20, s);
  }

  /* ── B. Readability (15점) — 개별 문구의 읽기 쉬움 ── */
  function scoreReadability(state){
    var s = 15;
    var title = state.mainTitle||'', hook = activeHookText(state), sub = state.subtitle||'', cta = state.cta||'';
    if(len(title) > 20) s -= 3;
    if(len(hook) > 20) s -= 2;
    if(len(sub) > 32) s -= 2;
    if(len(cta) > 15) s -= 2;
    // 공백 없이 지나치게 긴 연속 문자열(16자 이상)이 있으면 추가 감점
    if([title,hook,sub,cta].some(function(t){ return /\S{16,}/.test(t); })) s -= 2;
    return Math.max(0, s);
  }

  /* ── C. Message Clarity (15점) ── */
  function scoreMessageClarity(state){
    var s = 5;
    var title = state.mainTitle||'', hook = activeHookText(state), sub = state.subtitle||'', cta = state.cta||'';
    if(overlapRatio(title, hook) < 0.4) s += 5;
    if(len(sub) > 0 || len(cta) > 0) s += 3;
    if(len(sub) > 0 && overlapRatio(title, sub) < 0.5) s += 2;
    return Math.min(15, s);
  }

  /* ── D. Layout Balance (15점) ── */
  var LAYOUT_TITLE_RANGE = {
    'center-text':  [4,14],
    'left-image':   [6,18],
    'right-image':  [6,18],
    'number-focus': [4,12],
    'comparison':   [6,16],
    'icon-focus':   [4,14]
  };
  function scoreLayoutBalance(state){
    var layoutId = state.layoutId || 'center-text';
    var range = LAYOUT_TITLE_RANGE[layoutId] || [4,18];
    var n = len(state.mainTitle);
    var base;
    if(n === 0){ base = 6; }
    else if(n >= range[0] && n <= range[1]){ base = 13; }
    else {
      var dist = n < range[0] ? (range[0]-n) : (n-range[1]);
      base = Math.max(0, 13 - dist);
    }
    var hookAndTitle = (state.mainTitle||'') + ' ' + activeHookText(state);
    var bonus = 0;
    if(layoutId==='number-focus' && /\d/.test(hookAndTitle)) bonus = 2;
    else if(layoutId==='comparison' && /비교|vs|전후|before|after/i.test(hookAndTitle)) bonus = 2;
    return Math.min(15, base + bonus);
  }

  /* ── E. Text Length (10점) — 전체 문구 총량만 평가 ── */
  function scoreTextLength(state){
    var total = len(state.mainTitle) + len(state.subtitle) + len(activeHookText(state)) + len(state.cta);
    if(total === 0) return 0;
    if(total <= 19) return 6;
    if(total <= 60) return 10;
    if(total <= 75) return 7;
    if(total <= 90) return 4;
    return 1;
  }

  /* ── F. Visual Contrast (10점) — 배경/텍스트 대비를 결정적으로 계산 ── */
  function hexToRgb(hex){
    var m = /#([0-9a-fA-F]{6})/.exec(hex||'');
    if(!m) return {r:15,g:15,b:25}; // 매칭 실패 시 기본 다크 배경 가정(결정적 fallback)
    var v = m[1];
    return { r: parseInt(v.substr(0,2),16), g: parseInt(v.substr(2,2),16), b: parseInt(v.substr(4,2),16) };
  }
  function relLuminance(rgb){
    function ch(c){ c = c/255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
    return 0.2126*ch(rgb.r) + 0.7152*ch(rgb.g) + 0.0722*ch(rgb.b);
  }
  function scoreVisualContrast(state){
    var themes = (typeof TS_COLOR_THEMES!=='undefined') ? TS_COLOR_THEMES : [];
    var theme = themes.filter(function(c){return c.id===state.colorId;})[0] || themes[0];
    if(!theme) return 7;
    var bgRgb = hexToRgb(theme.bg);
    var bgLum = relLuminance(bgRgb);
    var whiteLum = 1; // 현재 모든 테마의 텍스트색이 흰색으로 고정되어 있음(TS_COLOR_THEMES 참고)
    var ratio = (whiteLum + 0.05) / (bgLum + 0.05);
    // 어두운 배경 + 흰 텍스트 조합이라 전 테마가 비교적 높은 대비를 갖는다(점수 편차가 작을 수 있음).
    if(ratio >= 7) return 10;
    if(ratio >= 4.5) return 9;
    if(ratio >= 3) return 7;
    return 4; // 기준 미달일 때만 크게 감점
  }

  /* ── G. Audience Fit (10점) — 과도한 감점 금지, category 없으면 제목/부제로 보조 판단 ── */
  var URGENCY_KEYWORDS = ['지금','마감','한정','경고','긴급','오늘까지','품절'];
  var CATEGORY_COLOR_MAP = [
    { test: /금융|재테크|비즈니스|창업|부업|투자/, colors: ['blue','black'], label:'금융·비즈니스 주제에는 신뢰감 있는 색상이 잘 맞습니다.' },
    { test: /건강|다이어트|운동|생활|습관/, colors: ['green','blue'], label:'건강·생활 주제에는 안정감 있는 색상이 잘 맞습니다.' },
    { test: /창작|자기계발|글쓰기|취미|에세이/, colors: ['purple','orange'], label:'창작·자기계발 주제에는 개성 있는 색상이 잘 맞습니다.' }
  ];
  function scoreAudienceFit(state, ebook){
    var text = ((ebook&&ebook.category)||'') + ' ' + ((ebook&&ebook.title)||'') + ' ' + ((ebook&&ebook.subtitle)||'');
    var hasUrgency = URGENCY_KEYWORDS.some(function(k){ return text.indexOf(k) >= 0; });
    if(hasUrgency){
      return (state.colorId==='red' || state.colorId==='orange') ? 10 : 7;
    }
    var matched = CATEGORY_COLOR_MAP.filter(function(row){ return row.test.test(text); })[0];
    if(!matched) return 7; // 카테고리/제목/부제 어디서도 신호를 못 찾으면 중립
    if(matched.colors.indexOf(state.colorId) >= 0) return 10;
    return 5; // 신호는 있으나 추천군과 다른 선택 — 일반적으로 덜 권장(과도한 감점 금지)
  }

  /* ── H. Style Consistency (5점) ── */
  var LAYOUT_STYLE_COMPAT = {
    'left-image':   { good: ['photo','3d'],        neutral: ['business','flat'] },
    'right-image':  { good: ['photo','3d'],        neutral: ['business','flat'] },
    'center-text':  { good: ['minimal','korean'],  neutral: ['flat'] },
    'icon-focus':   { good: ['minimal','korean'],  neutral: ['flat'] },
    'number-focus': { good: ['business','flat'],   neutral: ['3d'] },
    'comparison':   { good: ['business','flat'],   neutral: ['3d'] },
    'top-banner':   { good: ['business','korean'], neutral: ['flat'] }
  };
  function scoreStyleConsistency(state){
    var rule = LAYOUT_STYLE_COMPAT[state.layoutId];
    if(!rule) return 0; // 알 수 없는 layoutId — 명백한 구조 불일치로 취급
    if(rule.good.indexOf(state.styleId) >= 0) return 5;
    if(rule.neutral.indexOf(state.styleId) >= 0) return 3;
    return 1; // 덜 적합하지만 "명백한 불일치"는 아님
  }

  /* ── 총점 ── */
  TI.score = function(state, ebook){
    state = state || {};
    var breakdown = {
      hookStrength:     scoreHookStrength(state),
      readability:      scoreReadability(state),
      messageClarity:   scoreMessageClarity(state),
      layoutBalance:    scoreLayoutBalance(state),
      textLength:       scoreTextLength(state),
      visualContrast:   scoreVisualContrast(state),
      audienceFit:      scoreAudienceFit(state, ebook),
      styleConsistency: scoreStyleConsistency(state)
    };
    var total = Object.keys(breakdown).reduce(function(sum,k){ return sum + breakdown[k]; }, 0);
    var band = total>=90 ? '매우 강한 구성' : total>=75 ? '좋은 구성, 일부 개선 가능' : total>=60 ? '보통, 가독성과 후킹 개선 필요' : '재구성 권장';
    return { total: total, breakdown: breakdown, band: band };
  };

  /* ── 개선 제안 (순수 함수) — 점수가 낮은 항목부터, 현재 상태 값을 반영해 최대 4개 ── */
  function layoutDisplayName(layoutId){
    var layouts = (typeof TS_LAYOUTS!=='undefined') ? TS_LAYOUTS : [];
    var l = layouts.filter(function(v){return v.id===layoutId;})[0];
    return l ? l.name : (layoutId||'현재 레이아웃');
  }
  function colorDisplayName(colorId){
    var themes = (typeof TS_COLOR_THEMES!=='undefined') ? TS_COLOR_THEMES : [];
    var c = themes.filter(function(v){return v.id===colorId;})[0];
    return c ? c.name : (colorId||'현재 색상');
  }
  function commonTokens(a,b){
    var tb = {}; tokens(b).forEach(function(t){ tb[t]=true; });
    return tokens(a).filter(function(t){ return tb[t]; });
  }

  var SUGGESTION_BUILDERS = {
    hookStrength: function(state){
      var hook = activeHookText(state), n = len(hook);
      if(!n) return 'Hook 문구가 비어 있습니다. 클릭을 유도할 짧은 문구를 추가해보세요.';
      if(n > 20) return 'Hook이 '+n+'자로 다소 길어 후킹력이 약해질 수 있습니다. 4~20자 내외를 권장합니다.';
      if(!hasStrongSignal(hook)) return 'Hook("'+hook+'")에 구체적인 숫자나 강한 표현이 부족합니다.';
      return null;
    },
    readability: function(state){
      var title=state.mainTitle||'', hook=activeHookText(state), sub=state.subtitle||'', cta=state.cta||'';
      if(len(title) > 20) return '메인 제목이 '+len(title)+'자로 길어 모바일에서 읽기 어려울 수 있습니다.';
      if(len(sub) > 32) return '부제목이 '+len(sub)+'자로 다소 깁니다. 32자 이내를 권장합니다.';
      if(len(hook) > 20) return 'Hook이 '+len(hook)+'자로 길어 가독성이 떨어질 수 있습니다.';
      if(len(cta) > 15) return 'CTA 문구가 '+len(cta)+'자로 다소 깁니다. 15자 이내를 권장합니다.';
      return null;
    },
    messageClarity: function(state){
      var title=state.mainTitle||'', hook=activeHookText(state);
      var common = commonTokens(title, hook);
      if(common.length && overlapRatio(title,hook) >= 0.4) return '제목과 Hook이 비슷한 표현("'+common.join(', ')+'")을 반복하고 있습니다.';
      if(!len(state.subtitle) && !len(state.cta)) return '부제목이나 CTA가 없어 메시지가 다소 불명확할 수 있습니다.';
      return null;
    },
    layoutBalance: function(state){
      var range = LAYOUT_TITLE_RANGE[state.layoutId] || [4,18];
      var n = len(state.mainTitle);
      if(n < range[0]) return '현재 레이아웃("'+layoutDisplayName(state.layoutId)+'")에는 제목이 '+n+'자로 다소 짧습니다. '+range[0]+'~'+range[1]+'자 내외를 권장합니다.';
      if(n > range[1]) return '현재 레이아웃("'+layoutDisplayName(state.layoutId)+'")에는 제목이 '+n+'자로 다소 깁니다. '+range[0]+'~'+range[1]+'자 내외를 권장합니다.';
      return null;
    },
    textLength: function(state){
      var total = len(state.mainTitle)+len(state.subtitle)+len(activeHookText(state))+len(state.cta);
      if(total === 0) return '입력된 텍스트가 없습니다. 제목과 Hook을 먼저 채워주세요.';
      if(total > 75) return '전체 텍스트가 '+total+'자로 많아 한눈에 들어오지 않을 수 있습니다.';
      if(total < 20) return '전체 텍스트가 '+total+'자로 적어 정보 전달이 부족할 수 있습니다.';
      return null;
    },
    visualContrast: function(){ return '배경과 텍스트의 대비가 약해 시인성이 떨어질 수 있습니다.'; },
    audienceFit: function(state){ return '현재 선택한 색상("'+colorDisplayName(state.colorId)+'")이 콘텐츠 주제와 다소 어울리지 않을 수 있습니다.'; },
    styleConsistency: function(state){ return '현재 레이아웃과 이미지 스타일("'+state.styleId+'")의 조합이 다소 어색할 수 있습니다.'; }
  };

  TI.suggestImprovements = function(result, state, ebook){
    state = state || {};
    var items = BREAKDOWN_ORDER.map(function(key){
      var max = BREAKDOWN_LABELS[key][1];
      var val = result.breakdown[key];
      return { key:key, ratio: val/max };
    }).filter(function(item){ return item.ratio < 0.7; })
      .sort(function(a,b){ return a.ratio - b.ratio; });

    var out = [];
    for(var i=0; i<items.length && out.length<4; i++){
      var builder = SUGGESTION_BUILDERS[items[i].key];
      var msg = builder ? builder(state, ebook) : null;
      if(msg) out.push(msg);
    }
    return out;
  };

  /* ══════════════════════════════════════════════════════════════
     추천 기능 (Hook/색상/레이아웃/스타일) — 전부 결정적(난수 없음),
     실제 Claude API를 호출하지 않는 규칙 기반 구현.
     ══════════════════════════════════════════════════════════════ */

  function stableHash(str){
    var h = 0;
    str = String(str||'');
    for(var i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) >>> 0; }
    return h;
  }

  // Studio v1의 TS_HOOK_FALLBACKS(재생성용, 무작위 셔플)와는 별개의 풀 —
  // Intelligence의 "추천"은 항상 결정적이어야 하므로 분리한다.
  var HOOK_RECOMMEND_POOL = [
    {text:'초보도 바로 적용하는', tag:'beginner'},
    {text:'처음 시작할 때 꼭 알아야 할', tag:'beginner'},
    {text:'기초부터 차근차근 배우는', tag:'beginner'},
    {text:'시간을 줄여주는 핵심 방법', tag:'time'},
    {text:'바쁜 사람을 위한 빠른 정리', tag:'time'},
    {text:'실패를 줄이는 실전 전략', tag:'failure'},
    {text:'흔한 실수를 피하는', tag:'failure'},
    {text:'한 번 정리하면 계속 써먹는', tag:'numeric'},
    {text:'단계별로 정리한', tag:'numeric'},
    {text:'전문가가 알려주는', tag:'authority'},
    {text:'검증된 방법으로 배우는', tag:'authority'},
    {text:'실전에서 바로 써먹는', tag:'general'},
    {text:'누구보다 빠르게 이해하는', tag:'general'},
    {text:'제대로 정리된', tag:'general'},
    {text:'차근차근 따라 하는', tag:'beginner'}
  ];
  var HOOK_ANGLE_KEYWORDS = {
    beginner: /초보|입문|처음|기초/,
    time: /시간|빠르게|바쁜/,
    failure: /실패|실수|위험/,
    numeric: /\d/,
    authority: /전문가|검증|공식/
  };

  TI.recommendHook = function(ebook){
    var text = ((ebook&&ebook.title)||'') + ' ' + ((ebook&&ebook.subtitle)||'') + ' ' + ((ebook&&ebook.category)||'');
    var matchedTags = Object.keys(HOOK_ANGLE_KEYWORDS).filter(function(tag){ return HOOK_ANGLE_KEYWORDS[tag].test(text); });
    var prioritized = HOOK_RECOMMEND_POOL.filter(function(h){ return matchedTags.indexOf(h.tag) >= 0; });
    var rest = HOOK_RECOMMEND_POOL.filter(function(h){ return matchedTags.indexOf(h.tag) < 0; });
    var seed = rest.length ? (stableHash(text||'default') % rest.length) : 0;
    var rotated = rest.slice(seed).concat(rest.slice(0, seed)); // 셔플이 아니라 결정적 회전 — 재현성 보장
    var combined = prioritized.concat(rotated);
    var picked = [], seen = {};
    combined.forEach(function(h){ if(picked.length<5 && !seen[h.text]){ seen[h.text]=true; picked.push(h.text); } });
    return picked;
  };

  TI.recommendColor = function(ebook){
    var text = ((ebook&&ebook.category)||'') + ' ' + ((ebook&&ebook.title)||'') + ' ' + ((ebook&&ebook.subtitle)||'');
    var hasUrgency = URGENCY_KEYWORDS.some(function(k){ return text.indexOf(k) >= 0; });
    if(hasUrgency) return { primary:'red', secondary:'orange', reason:'제목/부제에서 긴급성 신호가 감지되어 주의를 끄는 색상을 추천합니다.' };
    var matched = CATEGORY_COLOR_MAP.filter(function(row){ return row.test.test(text); })[0];
    if(matched) return { primary:matched.colors[0], secondary:matched.colors[1], reason:matched.label };
    return { primary:'blue', secondary:'black', reason:'뚜렷한 주제 신호를 찾지 못해 범용적으로 무난한 색상을 추천합니다.' };
  };

  TI.recommendLayout = function(state, ebook){
    state = state || {};
    var title = state.mainTitle || (ebook&&ebook.title) || '';
    var combined = title + ' ' + activeHookText(state);
    if(/비교|vs|전후|before|after/i.test(combined)) return { layoutId:'comparison', reason:'비교를 나타내는 표현이 있어 비교형 레이아웃을 추천합니다.' };
    if(/\d/.test(combined)) return { layoutId:'number-focus', reason:'숫자가 포함되어 있어 숫자 강조형 레이아웃을 추천합니다.' };
    if(len(title) > 18) {
      var side = state.layoutId==='right-image' ? 'right-image' : 'left-image';
      return { layoutId: side, reason:'제목이 길어 이미지와 텍스트를 분리하는 레이아웃을 추천합니다.' };
    }
    return { layoutId:'center-text', reason:'제목이 짧고 단순해 중앙 텍스트 레이아웃이 잘 어울립니다.' };
  };

  var STYLE_RECOMMEND_MAP = [
    { test:/비즈니스|재테크|창업|마케팅|금융/, styleId:'business', reason:'전문적이고 신뢰감 있는 톤이 비즈니스 주제에 잘 맞습니다.' },
    { test:/개발|IT|디지털|테크|프로그래밍/, styleId:'3d', reason:'기술 콘텐츠는 입체적인 이미지가 눈에 잘 띕니다.' },
    { test:/자기계발|에세이|라이프스타일|생활/, styleId:'minimal', reason:'차분한 톤이 자기계발·에세이 독자에게 신뢰를 줍니다.' }
  ];
  TI.recommendStyle = function(ebook){
    var text = ((ebook&&ebook.category)||'') + ' ' + ((ebook&&ebook.title)||'');
    var matched = STYLE_RECOMMEND_MAP.filter(function(r){ return r.test.test(text); })[0];
    if(matched) return { styleId:matched.styleId, reason:matched.reason };
    return { styleId:'flat', reason:'범용적으로 무난한 스타일입니다.' };
  };

  /* ── 적용: 새 상태 변경 로직을 만들지 않고 기존 ThumbnailStudio 메서드에 위임한다.
     그 메서드들이 이미 render()/renderPreviewOnly()를 호출하고, 그 안에서 다시
     refreshIntelligence()를 호출하므로 Preview 갱신과 점수 재계산이 자동으로 이어진다. ── */
  TI.applyRecommendation = function(type, value){
    if(typeof ThumbnailStudio==='undefined') return;
    if(type==='hook' && typeof ThumbnailStudio.setCustomHook==='function'){
      ThumbnailStudio.setCustomHook(value);
      // setCustomHook은 입력 중 포커스 보존을 위해 Preview만 다시 그리므로(renderPreviewOnly),
      // 외부에서 적용한 경우에는 "직접 수정" 입력창 표시값도 최신 상태로 보이도록 전체 패널을 다시 그린다.
      if(typeof ThumbnailStudio.render==='function') ThumbnailStudio.render();
    }
    else if(type==='color' && typeof ThumbnailStudio.selectColor==='function') ThumbnailStudio.selectColor(value);
    else if(type==='layout' && typeof ThumbnailStudio.selectLayout==='function') ThumbnailStudio.selectLayout(value);
    else if(type==='style' && typeof ThumbnailStudio.selectStyle==='function') ThumbnailStudio.selectStyle(value);
  };

  // 내부 헬퍼도 재사용/테스트 가능하도록 노출(순수 함수라 외부에서 호출해도 부작용 없음)
  TI._internal = { activeHookText: activeHookText, overlapRatio: overlapRatio, hasBannedClaim: hasBannedClaim };

  /* ══════════════════════════════════════════════════════════════
     UI 렌더링 — 접이식 상세 상태는 모듈 내부 변수로만 관리한다
     (localStorage/APP.thumbnailStudio에 저장하지 않음 — 저장/불러오기 원칙 7번).
     ══════════════════════════════════════════════════════════════ */
  var detailsOpen = false;

  var BREAKDOWN_LABELS = {
    hookStrength:     ['Hook Strength', 20],
    readability:      ['Readability', 15],
    messageClarity:   ['Message Clarity', 15],
    layoutBalance:    ['Layout Balance', 15],
    textLength:       ['Text Length', 10],
    visualContrast:   ['Visual Contrast', 10],
    audienceFit:      ['Audience Fit', 10],
    styleConsistency: ['Style Consistency', 5]
  };
  var BREAKDOWN_ORDER = ['hookStrength','readability','messageClarity','layoutBalance','textLength','visualContrast','audienceFit','styleConsistency'];

  function esc(s){ return typeof x==='function' ? x(s) : String(s||''); }

  function renderBreakdown(breakdown){
    return '<div class="ti-breakdown">' + BREAKDOWN_ORDER.map(function(key){
      var label = BREAKDOWN_LABELS[key][0], max = BREAKDOWN_LABELS[key][1], val = breakdown[key];
      var pct = Math.round((val/max)*100);
      return '<div class="ti-bd-row"><span class="ti-bd-label">'+esc(label)+'</span>'
        +'<div class="ti-bd-bar"><div class="ti-bd-bar-fill" style="width:'+pct+'%"></div></div>'
        +'<span class="ti-bd-val">'+val+' / '+max+'</span></div>';
    }).join('') + '</div>';
  }

  TI.renderSuggestionsHtml = function(result, state, ebook){
    var list = TI.suggestImprovements(result, state, ebook);
    if(!list.length) return '';
    return '<div class="ti-suggest-title">개선 제안</div><ul class="ti-suggest-list">'
      + list.map(function(msg){ return '<li>'+esc(msg)+'</li>'; }).join('') + '</ul>';
  };

  function jsAttrEscape(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

  TI.renderRecommendationsHtml = function(state, ebook){
    var hookRecs = TI.recommendHook(ebook);
    var colorRec = TI.recommendColor(ebook);
    var layoutRec = TI.recommendLayout(state, ebook);
    var styleRec = TI.recommendStyle(ebook);
    var html = '<div class="ti-suggest-title">추천</div><div class="ti-rec-grid">';

    html += '<div class="ti-rec-row" style="flex-direction:column;align-items:stretch;gap:6px">'
      + '<div class="ti-rec-main">추천 Hook</div>'
      + hookRecs.map(function(h){
          return '<div style="display:flex;align-items:center;gap:8px">'
            + '<span style="flex:1;font-size:11px;color:#e2e8f0">'+esc(h)+'</span>'
            + '<button class="ti-rec-apply" onclick="tiApplyHook(\''+jsAttrEscape(h)+'\')">적용</button></div>';
        }).join('')
      + '</div>';

    html += '<div class="ti-rec-row"><div class="ti-rec-main">추천 색상: '+esc(colorDisplayName(colorRec.primary))+' / '+esc(colorDisplayName(colorRec.secondary))
      + '<span class="ti-rec-reason">'+esc(colorRec.reason)+'</span></div>'
      + '<button class="ti-rec-apply" onclick="tiApplyColor(\''+jsAttrEscape(colorRec.primary)+'\')">적용</button></div>';

    html += '<div class="ti-rec-row"><div class="ti-rec-main">추천 레이아웃: '+esc(layoutDisplayName(layoutRec.layoutId))
      + '<span class="ti-rec-reason">'+esc(layoutRec.reason)+'</span></div>'
      + '<button class="ti-rec-apply" onclick="tiApplyLayout(\''+jsAttrEscape(layoutRec.layoutId)+'\')">적용</button></div>';

    html += '<div class="ti-rec-row"><div class="ti-rec-main">추천 스타일: '+esc(styleRec.styleId)
      + '<span class="ti-rec-reason">'+esc(styleRec.reason)+'</span></div>'
      + '<button class="ti-rec-apply" onclick="tiApplyStyle(\''+jsAttrEscape(styleRec.styleId)+'\')">적용</button></div>';

    html += '</div>';
    return html;
  };

  function currentStateAndEbook(){
    var state = (typeof ThumbnailStudio!=='undefined' && ThumbnailStudio.state) ? ThumbnailStudio.state : {};
    var ebook = (typeof APP!=='undefined' && APP.ebook) ? APP.ebook : null;
    return { state: state, ebook: ebook };
  }

  /* ── Milestone 3.2 Phase 9: Thumbnail Intelligence 2.0 연결 ──
     총점/등급/카테고리별 상세/Hard Fail/Top Strengths/Priority Improvements는
     이제 js/thumbnail-intelligence-2.js(ThumbnailIntelligence2)의 실제 DOM 측정
     기반 평가 결과를 사용한다. Hook/색상/레이아웃/스타일 "추천" 기능(TI.recommend*,
     renderRecommendationsHtml)은 이 Phase의 문제 대상이 아니므로 그대로 재사용한다.
     TI.score()/TI.suggestImprovements() 등 v1 함수 자체는 삭제하지 않는다(다른
     코드가 참조할 가능성을 막지 않기 위함) — 단, 화면에 보이는 점수는 2.0으로
     교체한다(이번 Phase의 목적 자체가 "낡은 점수 기준 재설계"이기 때문). */
  /* Milestone 3.2 Phase 9.1: Score Calibration & Consistency Fix — 5단계 등급으로
     세분화(95+/85+/70+/50+/그 미만)해 우수·보통·미완성 결과가 실제로 구분되게 한다. */
  var GRADE_LABELS = {
    'excellent':'매우 우수', 'good':'좋음, 1~2개 개선점 존재', 'fair':'사용 가능, 개선 필요',
    'poor':'여러 항목 수정 필요', 'needs-improvement':'수정 필요'
  };
  var STATUS_BADGE_LABEL = { 'not-evaluable':'평가 불가', 'not-applicable':'해당 없음' };

  function renderHardFailBanner(result){
    if(!result.hardFails || !result.hardFails.length) return '';
    var limitNote = result.hardFailLimited
      ? ('<div class="ti-hardfail-limit">카테고리 원점수(Raw Score)는 '+result.rawScore+'점이지만, Hard Fail '+result.hardFails.length+'건으로 최종 점수(Final Score)가 '+result.totalScore+'점으로 제한되었습니다.</div>')
      : '';
    return '<div class="ti-hardfail-banner"><div class="ti-hardfail-title">⚠ Hard Fail ('+result.hardFails.length+'건) — 먼저 해결해야 합니다</div><ul class="ti-hardfail-list">'
      + result.hardFails.map(function(f){ return '<li>'+esc(f.message)+'</li>'; }).join('') + '</ul>'
      + limitNote + '</div>';
  }

  function renderRawFinalRow(result){
    if(result.rawScore===result.totalScore) return '';
    return '<div class="ti-rawfinal-row">Raw Score '+result.rawScore+'점 → Final Score <b>'+result.totalScore+'점</b>'
      + (result.hardFailLimited ? ' (Hard Fail로 제한됨)' : ' (평가 신뢰도/개선사항 기준 적용)') + '</div>';
  }

  function renderCoverageRow(result){
    return '<div class="ti-coverage-row">평가 범위: <b>'+esc(result.evaluationConfidenceLabel)+'</b> (evaluationCoverage '+result.evaluationCoverage+'%)'
      + (result.evaluationCoverage<100 ? ' — 일부 전략 데이터가 없어 관련 카테고리는 완전히 평가되지 않았습니다.' : '') + '</div>';
  }

  function renderCategoryDetail(result){
    return '<div class="ti-breakdown">' + CATEGORY_ORDER_UI.map(function(key){
      var c = result.categories[key];
      if(!c) return '';
      var label = (typeof ThumbnailIntelligence2!=='undefined' && ThumbnailIntelligence2.CATEGORY_LABELS) ? ThumbnailIntelligence2.CATEGORY_LABELS[key] : key;
      var pct = c.maxScore ? Math.round((c.score/c.maxScore)*100) : 0;
      var statusBadge = STATUS_BADGE_LABEL[c.status] ? ('<span class="ti-status-badge">'+esc(STATUS_BADGE_LABEL[c.status])+'</span>') : '';
      var reasonsHtml = c.reasons.length ? ('<ul class="ti-cat-reasons">'+c.reasons.map(function(r){
        var sevClass = 'ti-sev-'+(r.severity||'info');
        return '<li class="'+sevClass+'">'+esc(r.message)+'</li>';
      }).join('')+'</ul>') : '';
      return '<div class="ti-bd-row"><span class="ti-bd-label">'+esc(label)+statusBadge+'</span>'
        +'<div class="ti-bd-bar"><div class="ti-bd-bar-fill" style="width:'+pct+'%"></div></div>'
        +'<span class="ti-bd-val">'+c.score+' / '+c.maxScore+'</span></div>'
        + reasonsHtml;
    }).join('') + '</div>';
  }
  var CATEGORY_ORDER_UI = ['headlineReadability','visualHierarchy','layoutBalance','contrastColor','patternEffectiveness','ctaVisibility','badgeClarity','visualAnchorQuality','brandConsistency','mobileReadability'];

  function renderStrengthsAndImprovements(result){
    var html = '';
    if(result.topStrengths && result.topStrengths.length){
      html += '<div class="ti-suggest-title">핵심 강점</div><ul class="ti-strengths-list">'
        + result.topStrengths.map(function(s){ return '<li>'+esc(s)+'</li>'; }).join('') + '</ul>';
    }
    if(result.priorityImprovements && result.priorityImprovements.length){
      html += '<div class="ti-suggest-title">우선 개선사항</div><ul class="ti-suggest-list">'
        + result.priorityImprovements.map(function(s){ return '<li>'+esc(s.message)+'</li>'; }).join('') + '</ul>';
    }
    return html;
  }

  function evaluateV2(){
    if(typeof ThumbnailIntelligence2==='undefined' || typeof ThumbnailIntelligence2.evaluate!=='function') return null;
    var state = (typeof ThumbnailStudio!=='undefined' && ThumbnailStudio.state) ? ThumbnailStudio.state : {};
    var brandProfile = (typeof APP!=='undefined' && APP.brandProfile) ? APP.brandProfile : null;
    var blueprint = (typeof APP!=='undefined' && APP.thumbnailBlueprint) ? APP.thumbnailBlueprint : null;
    return ThumbnailIntelligence2.evaluate({
      state: state,
      brandProfile: brandProfile,
      marketingCopy: (typeof APP!=='undefined' && APP.marketingCopy) ? APP.marketingCopy : null,
      blueprint: blueprint,
      blueprintRender: state.blueprintRender,
      rendererMode: state.rendererMode || 'fallback'
    });
  }

  function buildPanelInnerHtml(){
    var ctx = currentStateAndEbook();
    var v2 = evaluateV2();
    var toggleLabel = detailsOpen ? '▲ 자세히 숨기기' : '▼ 자세히 보기 (항목별 점수·개선 제안·추천)';

    if(!v2){
      // v2 계산에 필요한 Preview DOM이 아직 없는 극히 드문 순간(레거시 안전장치) —
      // 화면이 비지 않도록 최소한의 대기 상태만 보여준다. 실제 값은 다음 refreshIntelligence()에서 채워진다.
      return '<div class="ti-summary-row"><div class="ti-score-circle">–</div><div class="ti-summary-text">'
        + '<div class="ti-summary-title">Thumbnail Score · 계산 대기 중</div>'
        + '<div class="ti-disclaimer">Preview가 준비되면 자동으로 계산됩니다.</div></div></div>';
    }

    var detailsHtml = '';
    if(detailsOpen){
      /* Hard Fail은 항상 Priority Improvements보다 먼저 표시한다(요구사항: 해결해야
         할 Hard Fail 목록을 우선 개선사항보다 위에). Raw/Final Score와 평가 범위는
         Hard Fail 배너 바로 아래, 카테고리 상세 위에 둔다. */
      detailsHtml += renderHardFailBanner(v2);
      detailsHtml += renderRawFinalRow(v2);
      detailsHtml += renderCoverageRow(v2);
      detailsHtml += renderCategoryDetail(v2);
      detailsHtml += renderStrengthsAndImprovements(v2);
      detailsHtml += (typeof TI.renderRecommendationsHtml==='function') ? TI.renderRecommendationsHtml(ctx.state, ctx.ebook) : '';
    }
    var gradeLabel = GRADE_LABELS[v2.grade] || v2.grade;
    var oneLiner = (v2.hardFails.length ? ('Hard Fail '+v2.hardFails.length+'건 발견 — ') : '') + gradeLabel;
    return '<div class="ti-summary-row">'
      +'<div class="ti-score-circle ti-grade-'+esc(v2.grade)+'">'+v2.totalScore+'</div>'
      +'<div class="ti-summary-text">'
      +'<div class="ti-summary-title">Thumbnail Score · '+esc(oneLiner)+'</div>'
      +'<div class="ti-disclaimer">Thumbnail Score 2.0은 실제 렌더링된 Preview(제목 줄 수·폰트 크기·요소 배치·대비 등)를 측정한 내부 품질 점수입니다. 실제 클릭률, 판매량 또는 매출을 예측하거나 보장하지 않습니다.</div>'
      +'</div></div>'
      +'<button class="ts-btn ti-toggle-btn" id="ti-toggle-btn" onclick="tiToggleDetails()">'+toggleLabel+'</button>'
      +'<div id="ti-details" class="ti-details">'+detailsHtml+'</div>';
  }

  TI.renderIntelligenceSection = function(){
    return '<div class="ts-section" id="ti-panel">'+buildPanelInnerHtml()+'</div>';
  };

  TI.refreshIntelligence = function(){
    var panel = document.getElementById('ti-panel');
    if(!panel) return;
    panel.innerHTML = buildPanelInnerHtml();
  };

  TI.toggleDetails = function(){
    detailsOpen = !detailsOpen;
    TI.refreshIntelligence();
  };

})(window.ThumbnailIntelligence);

function tiToggleDetails(){ ThumbnailIntelligence.toggleDetails(); }
function tiApplyHook(text){ ThumbnailIntelligence.applyRecommendation('hook', text); }
function tiApplyColor(id){ ThumbnailIntelligence.applyRecommendation('color', id); }
function tiApplyLayout(id){ ThumbnailIntelligence.applyRecommendation('layout', id); }
function tiApplyStyle(id){ ThumbnailIntelligence.applyRecommendation('style', id); }
