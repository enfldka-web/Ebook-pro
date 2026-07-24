/* thumbnail-intelligence-2.js — Milestone 3.2 Phase 9: Thumbnail Intelligence 2.0
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §12 Post Generation Quality Check, design.md

   이 모듈은 새 Engine이 아니다. Marketing Copy를 다시 만들지 않고, 제목을 자동으로
   바꾸지 않고, Thumbnail Blueprint/BrandProfile을 수정하지 않고, Renderer를 수정하지
   않는다. 이미 생성된 Thumbnail Preview(#ts-preview-canvas)를 "읽기 전용"으로 측정해
   품질을 평가하고 개선 제안을 만드는 것만 담당한다.

   기존 Thumbnail Intelligence v1(js/thumbnail-intelligence.js)의 Hook/색상/레이아웃/
   스타일 "추천" 기능은 이 Phase의 문제 대상이 아니므로 전혀 건드리지 않는다. 이 파일은
   오직 "Quality Score(총점/카테고리별 점수/Hard Fail/개선 제안)"만 새로 담당하며, v1의
   renderIntelligenceSection()이 이 결과를 가져다 쓰도록 연결된다.

   측정 원칙: 문자열 길이 추정이 아니라 실제 렌더링된 DOM(getBoundingClientRect,
   getComputedStyle, Range.getClientRects)을 읽는다. Fallback Renderer(Phase 7.1)와
   Claude Style Renderer(Phase 8/8.1) 둘 다 평가할 수 있어야 하므로, 두 Renderer의
   내부 구현을 몰라도 되도록 "이미 알고 있는 값"(state.mainTitle/cta/badge 텍스트)과
   실제로 일치하는 DOM 요소를 찾는 방식으로 식별한다(제목=state.mainTitle과 겹치는
   가장 안쪽 요소, CTA=state.cta로 시작하는 가장 안쪽 요소, Badge=활성 Hook 텍스트와
   완전히 같은 요소) — 폰트 크기만으로 추측하지 않는다("FLAT" 같은 시스템 라벨과
   실제 판매 Badge를 혼동하지 않기 위함, 요구사항 §12). */

window.ThumbnailIntelligence2 = window.ThumbnailIntelligence2 || {};

(function(TI2){

  var VERSION = '2.1';
  TI2.VERSION = VERSION;

  var WEIGHTS = {
    headlineReadability: 20,
    visualHierarchy: 15,
    layoutBalance: 15,
    contrastColor: 10,
    patternEffectiveness: 10,
    ctaVisibility: 8,
    badgeClarity: 5,
    visualAnchorQuality: 7,
    brandConsistency: 5,
    mobileReadability: 5
  };
  TI2.WEIGHTS = WEIGHTS; // 합계 100 — docs/design.md·Engine Spec와 충돌 없어 사용자 제시안을 그대로 채택.

  /* ══════════════════════════════════════════════════════════════
     공용 순수 헬퍼
     ══════════════════════════════════════════════════════════════ */

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function len(s){ return String(s||'').trim().length; }

  function relLuminanceHex(hex){
    var m = /#([0-9a-fA-F]{6})/.exec(hex||'');
    if(!m) return 0.5;
    var v = m[1];
    var r=parseInt(v.substr(0,2),16)/255, g=parseInt(v.substr(2,2),16)/255, b=parseInt(v.substr(4,2),16)/255;
    function ch(c){ return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
    return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b);
  }
  function relLuminanceRgb(rgb){
    function ch(c){ c=c/255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
    return 0.2126*ch(rgb.r)+0.7152*ch(rgb.g)+0.0722*ch(rgb.b);
  }
  function contrastRatio(lumA, lumB){
    var lighter = Math.max(lumA, lumB), darker = Math.min(lumA, lumB);
    return (lighter+0.05)/(darker+0.05);
  }
  TI2._pure = { relLuminanceHex: relLuminanceHex, relLuminanceRgb: relLuminanceRgb, contrastRatio: contrastRatio };

  function parseCssColor(str){
    if(!str) return null;
    var m6 = /#([0-9a-fA-F]{6})/.exec(str);
    if(m6){
      var v=m6[1];
      return { r:parseInt(v.substr(0,2),16), g:parseInt(v.substr(2,2),16), b:parseInt(v.substr(4,2),16) };
    }
    var mrgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(str);
    if(mrgb) return { r:+mrgb[1], g:+mrgb[2], b:+mrgb[3] };
    return null;
  }
  TI2._pure.parseCssColor = parseCssColor;

  /* 테마 배경(bg)이 그라데이션 문자열이라 단일 background-color로 읽을 수 없다.
     그라데이션 안의 두 색상 stop을 추출해 평균 밝기로 근사한다 — 실제 대비 계산이
     아니라 "썸네일용 시각 평가"를 위한 근사치임을 보고서에 명시한다(요구사항 §9). */
  function backgroundLuminanceApprox(bgCss){
    var hexes = String(bgCss||'').match(/#[0-9a-fA-F]{6}/g) || [];
    if(!hexes.length) return 0.1; // 기본 다크 배경 가정(결정적 fallback)
    var sum = 0;
    hexes.forEach(function(h){ sum += relLuminanceHex(h); });
    return sum / hexes.length;
  }
  TI2._pure.backgroundLuminanceApprox = backgroundLuminanceApprox;

  function textOverlap(a, b){
    a = String(a||'').trim(); b = String(b||'').trim();
    if(!a || !b) return false;
    return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
  }
  TI2._pure.textOverlap = textOverlap;

  function rectsOverlap(a, b){
    if(!a || !b) return false;
    return !(a.right <= a.left ? true : b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top);
  }
  // 위 한 줄 표현이 헷갈릴 수 있어 명시적으로 다시 정의한다(가독성 우선).
  function overlaps(a, b){
    if(!a || !b) return false;
    return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  }
  TI2._pure.overlaps = overlaps;

  function rectArea(r){ return r ? Math.max(0, r.width) * Math.max(0, r.height) : 0; }
  function rectContainedIn(inner, outer, tolerance){
    tolerance = tolerance || 0.5;
    if(!inner || !outer) return false;
    return inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance
      && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
  }
  TI2._pure.rectContainedIn = rectContainedIn;

  /* ══════════════════════════════════════════════════════════════
     DOM 측정 (impure — document가 있을 때만 동작). 순수 계산 함수(TI2.computeScore)와
     완전히 분리해, Node 환경에서는 이 함수 없이도 합성 measurements 객체로 계산
     로직만 단위 테스트할 수 있게 한다.
     ══════════════════════════════════════════════════════════════ */

  function findShortestMatch(all, predicate){
    var candidates = all.filter(predicate);
    if(!candidates.length) return null;
    /* 후보 중 다른 후보를 자손으로 포함하는 요소(= 바깥쪽 position wrapper)는
       제외한다. 예: 부제가 없을 때 헤드라인 div를 감싸는 바깥 wrapper의
       textContent가 헤드라인 div 자체와 완전히 같아져 길이로 구분이 안 되는
       경우가 있다 — 항상 "가장 안쪽(리프에 가까운)" 요소를 실제 헤드라인/배지/
       CTA로 선택해야 실제 렌더링된 폰트 크기를 정확히 읽는다. */
    var leaves = candidates.filter(function(el){
      return !candidates.some(function(other){ return other!==el && el.contains(other); });
    });
    var pool = leaves.length ? leaves : candidates;
    pool.sort(function(a,b){ return a.textContent.trim().length - b.textContent.trim().length; });
    return pool[0];
  }

  function findHeadlineEl(canvas, mainTitle){
    if(!len(mainTitle)) return null;
    var all = Array.prototype.slice.call(canvas.querySelectorAll('div'));
    return findShortestMatch(all, function(el){
      var t = el.textContent.trim();
      return t.length>0 && textOverlap(mainTitle, t);
    });
  }
  function findCtaEl(canvas, ctaText){
    if(!len(ctaText)) return null;
    var all = Array.prototype.slice.call(canvas.querySelectorAll('div'));
    var expected = String(ctaText).trim();
    return findShortestMatch(all, function(el){
      return el.textContent.trim().indexOf(expected) === 0;
    });
  }
  function findBadgeEl(canvas, badgeText){
    if(!len(badgeText)) return null;
    var all = Array.prototype.slice.call(canvas.querySelectorAll('div'));
    var expected = String(badgeText).trim();
    return findShortestMatch(all, function(el){ return el.textContent.trim() === expected; });
  }
  function findSubtitleEl(canvas, subtitle, excludeEls){
    if(!len(subtitle)) return null;
    var all = Array.prototype.slice.call(canvas.querySelectorAll('div'));
    return findShortestMatch(all, function(el){
      if(excludeEls.indexOf(el)>=0) return false;
      var t = el.textContent.trim();
      return t.length>0 && textOverlap(subtitle, t);
    });
  }

  function countRenderedLines(el){
    if(!el || typeof document==='undefined') return 1;
    try{
      var range = document.createRange();
      range.selectNodeContents(el);
      var rects = Array.prototype.slice.call(range.getClientRects());
      var tops = [];
      rects.forEach(function(r){
        if(r.width<=0 && r.height<=0) return;
        var found = tops.some(function(t){ return Math.abs(t-r.top) < 4; });
        if(!found) tops.push(r.top);
      });
      return Math.max(1, tops.length);
    }catch(e){ return 1; }
  }

  /* 배경/텍스트/장식을 제외한 "시각 앵커(Mockup)" 영역을 근사한다: 캔버스 대비
     90% 미만 면적을 차지하는 절대배치 요소 중 헤드라인/부제/배지/CTA가 아닌 것들의
     합집합 bounding box. 완전한 식별이 아니라 최선 근사(best-effort)임을 보고서에
     명시한다 — 텍스트 요소처럼 state 값과 정확히 대조할 "정답 문자열"이 없기 때문. */
  function findMockupRegion(canvas, excludeEls){
    var canvasRect = canvas.getBoundingClientRect();
    var canvasArea = rectArea(canvasRect);
    var all = Array.prototype.slice.call(canvas.querySelectorAll('div,svg'));
    var candidates = all.filter(function(el){
      if(excludeEls.indexOf(el) >= 0) return false;
      if(excludeEls.some(function(ex){ return ex.contains && ex.contains(el); })) return false;
      if(excludeEls.some(function(ex){ return el.contains && el.contains(ex); })) return false;
      var r = el.getBoundingClientRect();
      var area = rectArea(r);
      if(area <= 0) return false;
      if(area >= canvasArea*0.92) return false; // 배경/텍스처/비네트 전체 레이어 제외
      if(len(el.textContent) > 0 && el.children.length===0) return false; // 남은 순수 텍스트 leaf 제외
      return true;
    });
    if(!candidates.length) return { rect:null, elementCount:0 };
    var minLeft=Infinity, minTop=Infinity, maxRight=-Infinity, maxBottom=-Infinity;
    candidates.forEach(function(el){
      var r = el.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left); minTop = Math.min(minTop, r.top);
      maxRight = Math.max(maxRight, r.right); maxBottom = Math.max(maxBottom, r.bottom);
    });
    return {
      rect: { left:minLeft, top:minTop, right:maxRight, bottom:maxBottom, width:maxRight-minLeft, height:maxBottom-minTop },
      elementCount: candidates.length
    };
  }

  function scaledReadability(fontSize, scale, thresholds){
    var scaled = fontSize * scale;
    return { scaledSize: scaled, readable: scaled >= thresholds };
  }

  /* 실제 라이브 DOM(#ts-preview-canvas)에서 measurements 객체를 만든다. 이 함수만
     document에 접근한다 — 나머지 계산은 전부 이 결과만 받는 순수 함수다. */
  TI2.measureFromDom = function(canvas, state, blueprintRender){
    if(!canvas || typeof document==='undefined') return null;
    var canvasRect = canvas.getBoundingClientRect();
    var mainTitle = state.mainTitle||'';
    var ctaText = state.cta||'';
    var badgeText = state.customHook || (state.hooks && state.hooks[state.selectedHookIndex]) || (state.hooks && state.hooks[0]) || '';
    var subtitleText = state.subtitle||'';

    var headlineEl = findHeadlineEl(canvas, mainTitle);
    var ctaEl = findCtaEl(canvas, ctaText);
    var badgeEl = findBadgeEl(canvas, badgeText);
    var excludeForSub = [headlineEl, ctaEl, badgeEl].filter(Boolean);
    var subtitleEl = findSubtitleEl(canvas, subtitleText, excludeForSub);

    function measureText(el){
      if(!el) return null;
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        fontSize: parseFloat(cs.fontSize)||0,
        color: cs.color,
        fontWeight: parseFloat(cs.fontWeight)||400,
        rect: { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height }
      };
    }

    var headline = measureText(headlineEl);
    if(headline) headline.lines = countRenderedLines(headlineEl);
    var cta = measureText(ctaEl);
    var badge = measureText(badgeEl);
    var subtitle = measureText(subtitleEl);

    var excludeForMockup = [headlineEl, ctaEl, badgeEl, subtitleEl].filter(Boolean);
    var mockup = findMockupRegion(canvas, excludeForMockup);

    var noticeEl = canvas.parentElement ? canvas.parentElement.querySelector('.ts-title-shorten-notice') : null;

    return {
      canvasWidth: Math.round(canvasRect.width),
      canvasHeight: Math.round(canvasRect.height),
      canvasRect: { left:canvasRect.left, top:canvasRect.top, right:canvasRect.right, bottom:canvasRect.bottom, width:canvasRect.width, height:canvasRect.height },
      headline: headline,
      subtitle: subtitle,
      badge: badge,
      cta: cta,
      mockup: mockup,
      needsManualShorten: !!noticeEl
    };
  };

  /* ══════════════════════════════════════════════════════════════
     Phase 9.1: Score Calibration & Consistency Fix
     기준 문서: 사용자 지시(Phase 9.1) — rawScore/totalScore 분리, 카테고리 status
     (evaluated/not-evaluable/not-applicable), reasons/suggestions에 issueCode·
     severity·deduction을 명시해 "감점 사유"와 "실제 점수"가 항상 기계적으로
     일치하도록 한다(score = maxScore - Σdeduction, 임의 보정 없음).
     ══════════════════════════════════════════════════════════════ */

  var SEVERITY_ORDER = { critical:4, major:3, minor:2, info:1 };
  function mkReason(severity, message, deduction, issueCode){
    return { severity: severity, message: message, deduction: deduction||0, issueCode: issueCode||null };
  }
  function mkSuggestion(issueCode, message, category, severity){
    return { issueCode: issueCode, message: message, category: category, priority: SEVERITY_ORDER[severity]||1 };
  }

  /* status: 'evaluated'(실제 채점) | 'not-evaluable'(데이터 부족으로 판단 불가) |
     'not-applicable'(요소가 의도적으로 없어 채점 대상 자체가 아님).
     score는 reasons[].deduction 합계로만 결정한다 — "이유는 있는데 점수는 그대로"인
     불일치를 구조적으로 없앤다. */
  function cat(max, reasons, suggestions, status){
    reasons = reasons || []; suggestions = suggestions || [];
    var deduction = reasons.reduce(function(sum,r){ return sum + (r.deduction||0); }, 0);
    var score = clamp(Math.round(max - deduction), 0, max);
    return { score: score, maxScore: max, status: status||'evaluated', reasons: reasons, suggestions: suggestions };
  }
  function notApplicable(max){ return { score:max, maxScore:max, status:'not-applicable', reasons:[], suggestions:[] }; }
  function notEvaluable(max, ratio, message){
    ratio = typeof ratio==='number' ? ratio : 0.6;
    return { score: Math.round(max*ratio), maxScore:max, status:'not-evaluable', reasons:[mkReason('info', message, 0, null)], suggestions:[] };
  }

  function scoreHeadlineReadability(M, ctx){
    var max = WEIGHTS.headlineReadability;
    var h = M.headline;
    if(!h) return cat(max, [mkReason('critical','제목(Headline) 요소를 찾지 못했습니다 — 제목이 비어있을 수 있습니다.', max, 'HEADLINE_MISSING')], [mkSuggestion('HEADLINE_MISSING','메인 제목을 입력하세요.','headlineReadability','critical')]);
    var reasons = [], suggestions = [];
    if(!rectContainedIn(h.rect, M.canvasRect)){
      reasons.push(mkReason('critical','제목이 캔버스 밖으로 벗어나거나 잘려 보입니다(가장 심각한 문제).', max, 'HEADLINE_CLIPPED'));
      suggestions.push(mkSuggestion('HEADLINE_CLIPPED','제목 표시 폭 또는 폰트 크기를 조정해 캔버스 안에 완전히 들어오게 하세요.','headlineReadability','critical'));
      return cat(max, reasons, suggestions);
    }
    if(h.lines===3){
      reasons.push(mkReason('minor','제목이 3줄로 표시되어 있습니다.', 4, 'HEADLINE_LINES_EXCESS'));
      suggestions.push(mkSuggestion('HEADLINE_LINES_EXCESS','제목이 3줄이며 '+Math.round(h.fontSize)+'px입니다. 2줄로 줄이거나 폰트 크기를 조정하세요.','headlineReadability','minor'));
    } else if(h.lines>=4){
      reasons.push(mkReason('major','제목이 '+h.lines+'줄로 표시되어 있어 한눈에 읽기 어렵습니다.', 10, 'HEADLINE_LINES_EXCESS'));
      suggestions.push(mkSuggestion('HEADLINE_LINES_EXCESS','제목을 2줄 이내로 표시하세요 — 현재 '+h.lines+'줄입니다.','headlineReadability','major'));
    }
    if(h.fontSize < 26){
      var d = clamp(Math.round((26-h.fontSize)*1.2), 4, 14);
      reasons.push(mkReason(d>=10?'major':'minor','제목 폰트 크기가 '+Math.round(h.fontSize)+'px로 작습니다(26px 미만).', d, 'HEADLINE_FONT_TOO_SMALL'));
      suggestions.push(mkSuggestion('HEADLINE_FONT_TOO_SMALL','제목 폰트 크기를 26px 이상으로 조정하세요(현재 '+Math.round(h.fontSize)+'px).','headlineReadability', d>=10?'major':'minor'));
    }
    if(M.needsManualShorten){
      reasons.push(mkReason('minor','제목이 2줄 안에 자연스럽게 들어가지 않아 "수동 축약 필요" 안내가 표시되었습니다.', 6, 'HEADLINE_MANUAL_SHORTEN'));
      suggestions.push(mkSuggestion('HEADLINE_MANUAL_SHORTEN','제목을 더 짧은 표현으로 직접 다듬으면 2줄에 자연스럽게 들어갈 수 있습니다.','headlineReadability','minor'));
    }
    return cat(max, reasons, suggestions);
  }

  function scoreVisualHierarchy(M, ctx){
    var max = WEIGHTS.visualHierarchy;
    var h = M.headline, c = M.cta, b = M.badge, mk = M.mockup;
    if(!h) return notEvaluable(max, 0.3, '제목 요소가 없어 시각 위계를 평가할 수 없습니다.');
    var reasons=[], suggestions=[];
    var maxTextSize = Math.max(h.fontSize, c?c.fontSize:0, b?b.fontSize:0);
    if(h.fontSize < maxTextSize - 0.01){
      reasons.push(mkReason('major','제목이 가장 강한 요소가 아닙니다.', 6, 'VISUAL_HIERARCHY_HEADLINE_WEAK'));
      suggestions.push(mkSuggestion('VISUAL_HIERARCHY_HEADLINE_WEAK','제목 폰트 크기를 CTA/Badge보다 크게 유지하세요.','visualHierarchy','major'));
    }
    if(c && c.fontSize > h.fontSize){
      reasons.push(mkReason('major','CTA가 제목보다 커서 시각적으로 경쟁합니다.', 5, 'VISUAL_HIERARCHY_CTA_TOO_STRONG'));
      suggestions.push(mkSuggestion('VISUAL_HIERARCHY_CTA_TOO_STRONG','CTA 폰트 크기 또는 강조를 제목보다 낮추세요.','visualHierarchy','major'));
    }
    if(b && c && b.fontSize > c.fontSize){
      reasons.push(mkReason('minor','Badge가 CTA보다 강조되어 있습니다.', 3, 'VISUAL_HIERARCHY_BADGE_TOO_STRONG'));
      suggestions.push(mkSuggestion('VISUAL_HIERARCHY_BADGE_TOO_STRONG','Badge 크기를 CTA보다 작게 조정하세요.','visualHierarchy','minor'));
    }
    if(mk && mk.rect && overlaps(mk.rect, h.rect)){
      reasons.push(mkReason('major','Mockup/시각 요소가 제목과 겹쳐 방해합니다.', 4, 'MOCKUP_HEADLINE_OVERLAP'));
      suggestions.push(mkSuggestion('MOCKUP_HEADLINE_OVERLAP','Mockup 위치를 제목과 겹치지 않게 옮기세요.','visualHierarchy','major'));
    }
    return cat(max, reasons, suggestions);
  }

  function scoreLayoutBalance(M, ctx){
    var max = WEIGHTS.layoutBalance;
    var h=M.headline, c=M.cta, b=M.badge, sub=M.subtitle;
    var reasons=[], suggestions=[];
    var pairs = [
      ['제목','CTA', h&&h.rect, c&&c.rect, 'LAYOUT_OVERLAP_CTA_HEADLINE'],
      ['제목','Badge', h&&h.rect, b&&b.rect, 'LAYOUT_OVERLAP_BADGE_HEADLINE'],
      ['CTA','Badge', c&&c.rect, b&&b.rect, 'LAYOUT_OVERLAP_CTA_BADGE'],
      ['제목','부제', h&&h.rect, sub&&sub.rect, 'LAYOUT_OVERLAP_SUBTITLE_HEADLINE']
    ];
    pairs.forEach(function(p){
      if(p[2] && p[3] && overlaps(p[2], p[3])){
        reasons.push(mkReason('major', p[0]+'와(과) '+p[1]+'이(가) 서로 겹칩니다.', 4, p[4]));
        suggestions.push(mkSuggestion(p[4], '겹치는 요소('+p[0]+'/'+p[1]+')의 위치나 여백을 조정해 서로 침범하지 않게 하세요.', 'layoutBalance', 'major'));
      }
    });
    [['제목',h,'LAYOUT_OUT_OF_CANVAS'],['CTA',c,'LAYOUT_OUT_OF_CANVAS'],['Badge',b,'LAYOUT_OUT_OF_CANVAS']].forEach(function(pair){
      var el = pair[1];
      if(el && el.rect && !rectContainedIn(el.rect, M.canvasRect)){
        reasons.push(mkReason('critical', pair[0]+' 요소가 캔버스 밖으로 벗어났습니다.', 4, pair[2]));
        suggestions.push(mkSuggestion(pair[2], pair[0]+' 위치를 캔버스 안으로 조정하세요.','layoutBalance','critical'));
      }
    });
    if(c && c.rect){
      var edgeMargin = Math.min(
        c.rect.left - M.canvasRect.left, M.canvasRect.right - c.rect.right,
        c.rect.top - M.canvasRect.top, M.canvasRect.bottom - c.rect.bottom
      );
      if(edgeMargin < 4){
        reasons.push(mkReason('minor','CTA가 캔버스 가장자리에 지나치게 붙어 있습니다.', 3, 'CTA_EDGE_MARGIN_TOO_SMALL'));
        suggestions.push(mkSuggestion('CTA_EDGE_MARGIN_TOO_SMALL','CTA 주변 여백을 조금 더 확보하세요.','layoutBalance','minor'));
      }
    }
    return cat(max, reasons, suggestions);
  }

  function textContrastCheck(bgLum, el){
    if(!el) return { ratio:null };
    var textColor = parseCssColor(el.color);
    if(!textColor) return { ratio:null };
    return { ratio: contrastRatio(relLuminanceRgb(textColor), bgLum) };
  }
  function labelOf(key){
    return { headline:'제목', cta:'CTA', badge:'Badge', subtitle:'부제' }[key] || key;
  }
  var CONTRAST_ISSUE_CODE = { headline:'CONTRAST_HEADLINE_LOW', cta:'CONTRAST_CTA_LOW', badge:'CONTRAST_BADGE_LOW', subtitle:'CONTRAST_SUBTITLE_LOW' };

  function scoreContrastColor(M, ctx){
    var max = WEIGHTS.contrastColor;
    var reasons=[], suggestions=[];
    var weights = { headline:4, cta:2, badge:2, subtitle:2 };
    /* CTA는 캔버스 배경이 아니라 accent 색으로 "채워진 버튼" 위에 텍스트가 올라간다
       (두 Renderer 모두 solid/거의 solid accent 배경) — accent 배경 휘도를 기준으로
       대비를 계산해야 실제 시인성과 일치한다. Badge는 반투명 accent 오버레이라
       캔버스 배경 근사치를 그대로 쓴다. */
    var bgLumByKey = { headline: ctx.bgLuminance, subtitle: ctx.bgLuminance, badge: ctx.bgLuminance, cta: (typeof ctx.accentLuminance==='number' ? ctx.accentLuminance : ctx.bgLuminance) };
    ['headline','cta','badge','subtitle'].forEach(function(key){
      var el = M[key];
      var w = weights[key];
      if(!el) return; // 없는 요소는 감점하지 않음(Never Guess) — reasons에도 올리지 않는다.
      var check = textContrastCheck(bgLumByKey[key], el);
      if(check.ratio===null) return;
      var code = CONTRAST_ISSUE_CODE[key];
      if(check.ratio >= 4.5) return;
      if(check.ratio >= 3){
        reasons.push(mkReason('minor', labelOf(key)+' 대비가 다소 낮습니다(비율 '+check.ratio.toFixed(2)+').', Math.round(w*0.5), code));
      } else {
        reasons.push(mkReason('major', labelOf(key)+' 대비가 낮아 시인성이 떨어집니다(비율 '+check.ratio.toFixed(2)+').', w, code));
      }
      suggestions.push(mkSuggestion(code, labelOf(key)+' 텍스트 색상 또는 배경 대비를 높이세요(비율 '+check.ratio.toFixed(2)+').','contrastColor', check.ratio<3?'major':'minor'));
    });
    return cat(max, reasons, suggestions);
  }

  var PATTERN_KEYS = ['center-text','icon-focus','comparison','left-image','right-image','top-banner'];
  function scorePatternEffectiveness(M, ctx){
    var max = WEIGHTS.patternEffectiveness;
    var layoutId = ctx.layoutId;
    if(PATTERN_KEYS.indexOf(layoutId) === -1){
      return notEvaluable(max, 0.7, '이 레이아웃은 6개 표준 Pattern 밖이라 세부 기준을 적용할 수 없습니다.');
    }
    var reasons=[], suggestions=[];
    var mk = M.mockup;
    var mkExists = !!(mk && mk.rect && mk.elementCount>0);
    var full = max; // 감점 방식으로 통일: 만점에서 실제 결함만큼 뺀다.
    if(layoutId==='center-text'){
      if(!mkExists){ reasons.push(mkReason('minor','그래픽 앵커(비대칭 장식)가 약합니다.', 3, 'MOCKUP_EMPTY_PLACEHOLDER')); suggestions.push(mkSuggestion('MOCKUP_EMPTY_PLACEHOLDER','중앙 텍스트 주변에 작은 그래픽 앵커를 배치하세요.','patternEffectiveness','minor')); }
      if(M.headline && mkExists && overlaps(M.headline.rect, mk.rect)){ reasons.push(mkReason('major','그래픽 앵커가 제목과 겹칩니다.', 3, 'MOCKUP_HEADLINE_OVERLAP')); }
    } else if(layoutId==='icon-focus'){
      if(!mkExists){ reasons.push(mkReason('major','아이콘/시각 앵커를 찾지 못했습니다.', 7, 'MOCKUP_EMPTY_PLACEHOLDER')); suggestions.push(mkSuggestion('MOCKUP_EMPTY_PLACEHOLDER','아이콘 영역에 정보형 시각 요소를 배치하세요.','patternEffectiveness','major')); }
      else if(mk.elementCount<2){ reasons.push(mkReason('minor','아이콘이 단순 장식(단일 원)에 가깝습니다.', 4, 'MOCKUP_TOO_SIMPLE')); suggestions.push(mkSuggestion('MOCKUP_TOO_SIMPLE','아이콘을 체크리스트/단계 등 정보형 구성으로 보강하세요.','patternEffectiveness','minor')); }
    } else if(layoutId==='comparison'){
      if(!mkExists){ reasons.push(mkReason('major','Before/After 비교 구조를 찾지 못했습니다.', 8, 'MOCKUP_EMPTY_PLACEHOLDER')); suggestions.push(mkSuggestion('MOCKUP_EMPTY_PLACEHOLDER','Before/After 카드와 중앙 전환 요소를 배치하세요.','patternEffectiveness','major')); }
      else if(mk.elementCount<2){ reasons.push(mkReason('minor','Before/After 비교 구조가 약합니다.', 3, 'MOCKUP_TOO_SIMPLE')); }
    } else if(layoutId==='left-image' || layoutId==='right-image'){
      if(!mkExists){ reasons.push(mkReason('major','Mockup을 찾지 못했습니다.', 7, 'MOCKUP_EMPTY_PLACEHOLDER')); suggestions.push(mkSuggestion('MOCKUP_EMPTY_PLACEHOLDER','Mockup 영역에 시각 요소를 배치하세요.','patternEffectiveness','major')); }
      else if(mk.elementCount<3){ reasons.push(mkReason('minor','Mockup 내부 시각 요소가 3개 미만으로 Placeholder처럼 보일 수 있습니다.', 4, 'MOCKUP_TOO_SIMPLE')); suggestions.push(mkSuggestion('MOCKUP_TOO_SIMPLE','Mockup 내부에 최소 3개 이상의 시각 요소를 구성하세요.','patternEffectiveness','minor')); }
    } else if(layoutId==='top-banner'){
      var hasMid = mkExists && mk.rect.top > M.canvasRect.top+150 && mk.rect.bottom < M.canvasRect.bottom-80;
      if(!hasMid){ reasons.push(mkReason('major','상단 배너 아래 중단부에 시각 앵커가 부족해 빈 공간처럼 보일 수 있습니다.', 4, 'MOCKUP_EMPTY_PLACEHOLDER')); suggestions.push(mkSuggestion('MOCKUP_EMPTY_PLACEHOLDER','배너와 CTA 사이 중단부에 시각 앵커를 배치하세요.','patternEffectiveness','major')); }
    }
    return cat(full, reasons, suggestions);
  }

  function scoreCtaVisibility(M, ctx){
    var max = WEIGHTS.ctaVisibility;
    var c = M.cta;
    var ctaIntendedEmpty = !len(ctx.state.cta) && !(ctx.blueprint && len(ctx.blueprint.cta));
    if(!c){
      if(ctaIntendedEmpty) return notApplicable(max);
      return cat(max, [mkReason('major','CTA 문구가 설정되어 있지 않습니다.', Math.round(max*0.7), 'CTA_MISSING_UNEXPECTED')], [mkSuggestion('CTA_MISSING_UNEXPECTED','CTA 문구를 추가하면 클릭 유도에 도움이 됩니다.','ctaVisibility','major')]);
    }
    var reasons=[], suggestions=[];
    if(M.headline && overlaps(c.rect, M.headline.rect)){
      reasons.push(mkReason('critical','CTA가 제목과 겹칩니다.', 6, 'CTA_HEADLINE_OVERLAP'));
      suggestions.push(mkSuggestion('CTA_HEADLINE_OVERLAP','CTA 위치를 제목과 겹치지 않게 옮기세요.','ctaVisibility','critical'));
    }
    if(M.headline && c.fontSize >= M.headline.fontSize){
      reasons.push(mkReason('major','CTA가 제목보다 크거나 같아 시각적으로 경쟁합니다.', 3, 'VISUAL_HIERARCHY_CTA_TOO_STRONG'));
      suggestions.push(mkSuggestion('VISUAL_HIERARCHY_CTA_TOO_STRONG','CTA 폰트 크기를 제목보다 작게 유지하세요.','ctaVisibility','major'));
    }
    if(!rectContainedIn(c.rect, M.canvasRect)){
      reasons.push(mkReason('critical','CTA가 캔버스 밖으로 벗어났습니다.', 5, 'LAYOUT_OUT_OF_CANVAS'));
      suggestions.push(mkSuggestion('LAYOUT_OUT_OF_CANVAS','CTA 위치를 캔버스 안으로 조정하세요.','ctaVisibility','critical'));
    }
    if(c.fontSize < 12){
      reasons.push(mkReason('minor','CTA 글자 크기가 작아 가독성이 떨어질 수 있습니다.', 2, 'CTA_FONT_TOO_SMALL'));
      suggestions.push(mkSuggestion('CTA_FONT_TOO_SMALL','CTA 글자 크기를 12px 이상으로 조정하세요.','ctaVisibility','minor'));
    }
    var check = textContrastCheck(typeof ctx.accentLuminance==='number' ? ctx.accentLuminance : ctx.bgLuminance, c);
    if(check.ratio!==null && check.ratio < 4.5){
      reasons.push(mkReason(check.ratio<3?'major':'minor','CTA 대비가 낮아 시인성이 떨어집니다(비율 '+check.ratio.toFixed(2)+').', check.ratio<3?3:1, CONTRAST_ISSUE_CODE.cta));
      suggestions.push(mkSuggestion(CONTRAST_ISSUE_CODE.cta,'CTA 텍스트 색상 또는 배경 대비를 높이세요(비율 '+check.ratio.toFixed(2)+').','ctaVisibility', check.ratio<3?'major':'minor'));
    }
    return cat(max, reasons, suggestions);
  }

  function scoreBadgeClarity(M, ctx){
    var max = WEIGHTS.badgeClarity;
    var b = M.badge;
    var badgeIntendedEmpty = !len(ctx.state.customHook) && !(ctx.state.hooks && ctx.state.hooks.length);
    if(!b){
      if(badgeIntendedEmpty) return notApplicable(max);
      return cat(max, [mkReason('minor','Badge(Hook) 요소를 찾지 못했습니다.', Math.round(max*0.6), 'BADGE_MISSING_UNEXPECTED')], []);
    }
    var reasons=[], suggestions=[];
    if(M.headline && overlaps(b.rect, M.headline.rect)){
      reasons.push(mkReason('major','Badge가 제목과 겹칩니다.', 2, 'BADGE_HEADLINE_OVERLAP'));
      suggestions.push(mkSuggestion('BADGE_HEADLINE_OVERLAP','Badge 위치를 제목과 겹치지 않게 옮기세요.','badgeClarity','major'));
    }
    if(M.cta && b.fontSize > M.cta.fontSize){
      reasons.push(mkReason('minor','Badge가 CTA보다 시각적으로 강합니다.', 1, 'VISUAL_HIERARCHY_BADGE_TOO_STRONG'));
      suggestions.push(mkSuggestion('VISUAL_HIERARCHY_BADGE_TOO_STRONG','Badge 글자 크기를 CTA보다 작게 유지하세요.','badgeClarity','minor'));
    }
    if(b.text.length > 30){
      reasons.push(mkReason('minor','Badge 문구가 다소 깁니다('+b.text.length+'자).', 1, 'BADGE_TOO_LONG'));
      suggestions.push(mkSuggestion('BADGE_TOO_LONG','Badge 문구를 30자 이내로 줄이세요.','badgeClarity','minor'));
    }
    /* Badge 대비도 이 카테고리 책임 범위 안에서 별도로 감점한다(Contrast & Color와
       동일 issueCode를 공유해 Priority Improvements에서는 한 번만 표시되지만,
       "Badge 대비가 낮다"는 사유가 실제로 Badge Clarity 점수에도 반영되게 한다 —
       Phase 9 검증에서 발견된 "이유는 있는데 해당 카테고리는 만점" 불일치 수정). */
    var check = textContrastCheck(ctx.bgLuminance, b);
    if(check.ratio!==null && check.ratio < 4.5){
      var d = check.ratio<3 ? 2 : 1;
      reasons.push(mkReason(check.ratio<3?'major':'minor','Badge 대비가 낮아 식별이 어려울 수 있습니다(비율 '+check.ratio.toFixed(2)+').', d, CONTRAST_ISSUE_CODE.badge));
      suggestions.push(mkSuggestion(CONTRAST_ISSUE_CODE.badge,'Badge 텍스트 색상 또는 배경 대비를 높이세요(비율 '+check.ratio.toFixed(2)+').','badgeClarity', check.ratio<3?'major':'minor'));
    }
    return cat(max, reasons, suggestions);
  }

  function scoreVisualAnchorQuality(M, ctx){
    var max = WEIGHTS.visualAnchorQuality;
    var mk = M.mockup;
    var LAYOUTS_EXPECTING_MOCKUP = ['icon-focus','comparison','left-image','right-image','top-banner'];
    var expectsMockup = LAYOUTS_EXPECTING_MOCKUP.indexOf(ctx.layoutId) >= 0;
    if(!mk || !mk.rect || mk.elementCount===0){
      if(!expectsMockup) return notApplicable(max); // center-text 등은 앵커가 선택적 요소
      return cat(max, [mkReason('major','Mockup/시각 앵커가 비어 있어 Placeholder처럼 보입니다.', Math.round(max*0.8), 'MOCKUP_EMPTY_PLACEHOLDER')], [mkSuggestion('MOCKUP_EMPTY_PLACEHOLDER','이 레이아웃에는 최소한의 시각 앵커를 배치하세요.','visualAnchorQuality','major')]);
    }
    var reasons=[], suggestions=[];
    // richness 보너스 없이 만점에서 시작 — 리치니스가 부족하면 감점하는 방식으로 통일.
    var richnessDeficit = clamp(3 - mk.elementCount, 0, 3);
    if(richnessDeficit>0){
      reasons.push(mkReason('minor','Mockup 내부 시각 요소가 부족합니다('+mk.elementCount+'개).', richnessDeficit, 'MOCKUP_TOO_SIMPLE'));
    }
    if(M.headline && overlaps(mk.rect, M.headline.rect)){
      reasons.push(mkReason('major','Mockup이 제목을 방해합니다.', 3, 'MOCKUP_HEADLINE_OVERLAP'));
      suggestions.push(mkSuggestion('MOCKUP_HEADLINE_OVERLAP','Mockup 위치를 제목과 겹치지 않게 옮기세요.','visualAnchorQuality','major'));
    }
    var area = rectArea(mk.rect), canvasArea = rectArea(M.canvasRect);
    var ratio = canvasArea ? area/canvasArea : 0;
    if(ratio < 0.02){
      reasons.push(mkReason('minor','시각 앵커가 너무 희미하거나 작습니다.', 1, 'MOCKUP_TOO_FAINT'));
      suggestions.push(mkSuggestion('MOCKUP_TOO_FAINT','시각 앵커의 크기를 조금 키우세요.','visualAnchorQuality','minor'));
    }
    return cat(max, reasons, suggestions);
  }

  function scoreBrandConsistency(M, ctx){
    var max = WEIGHTS.brandConsistency;
    var bp = ctx.brandProfile, br = ctx.blueprintRender;
    if(!bp || !br || !br.colorStrategy){
      return notEvaluable(max, 0.5, 'BrandProfile 또는 Blueprint 정보가 없어 일관성을 평가할 수 없습니다.');
    }
    var expected = String(bp.brandStrategy||'').toLowerCase();
    var actual = String(br.colorStrategy||'').toLowerCase();
    if(expected && actual && expected===actual) return cat(max, [], []);
    return cat(max, [mkReason('major','Renderer의 colorStrategy("'+actual+'")가 BrandProfile.brandStrategy("'+bp.brandStrategy+'")와 다릅니다.', Math.round(max*0.6), 'BRAND_STRATEGY_MISMATCH')],
      [mkSuggestion('BRAND_STRATEGY_MISMATCH','BrandProfile.brandStrategy에 맞는 Renderer mood가 적용되는지 확인하세요.','brandConsistency','major')]);
  }

  function scoreMobileReadability(M, ctx){
    var max = WEIGHTS.mobileReadability;
    if(!M.headline) return notEvaluable(max, 0, '제목이 없어 모바일 가독성을 평가할 수 없습니다.');
    var reasons=[], suggestions=[];
    var at200 = scaledReadability(M.headline.fontSize, 200/652, 8);
    var at326 = scaledReadability(M.headline.fontSize, 326/652, 13);
    if(!at200.readable){
      reasons.push(mkReason('major','약 200px 축소 시 제목이 읽기 어려울 수 있습니다(스케일 폰트 '+at200.scaledSize.toFixed(1)+'px).', 2, 'HEADLINE_FONT_TOO_SMALL'));
      suggestions.push(mkSuggestion('HEADLINE_FONT_TOO_SMALL','제목 폰트 크기를 키우거나 텍스트 밀도를 낮추세요.','mobileReadability','major'));
    } else if(!at326.readable){
      reasons.push(mkReason('minor','약 326px 축소 시 제목이 다소 읽기 어려울 수 있습니다.', 1, 'HEADLINE_FONT_TOO_SMALL'));
    }
    if(M.badge){
      var badgeAt200 = scaledReadability(M.badge.fontSize, 200/652, 5);
      if(!badgeAt200.readable){
        reasons.push(mkReason('major','모바일(약 200px) 축소 시 Badge가 식별되지 않을 수 있습니다(스케일 폰트 '+badgeAt200.scaledSize.toFixed(1)+'px).', 2, 'MOBILE_BADGE_UNREADABLE'));
        suggestions.push(mkSuggestion('MOBILE_BADGE_UNREADABLE','Badge 글자 크기를 1단계 높이세요.','mobileReadability','major'));
      }
    }
    return cat(max, reasons, suggestions);
  }

  /* ══════════════════════════════════════════════════════════════
     Hard Fail 판정
     ══════════════════════════════════════════════════════════════ */
  function computeHardFails(M, ctx){
    var fails = [];
    if(M.canvasWidth!==652 || M.canvasHeight!==488){
      fails.push({ code:'canvas-size', message:'Preview 크기가 652×488이 아닙니다('+M.canvasWidth+'×'+M.canvasHeight+').' });
    }
    if(M.headline && !rectContainedIn(M.headline.rect, M.canvasRect)){
      fails.push({ code:'headline-clipped', message:'제목이 캔버스 밖으로 벗어나거나 잘렸습니다.' });
    }
    if(M.cta && !rectContainedIn(M.cta.rect, M.canvasRect)){
      fails.push({ code:'cta-out-of-canvas', message:'CTA가 캔버스 밖으로 벗어났습니다.' });
    }
    if(M.headline && M.cta && overlaps(M.headline.rect, M.cta.rect)){
      fails.push({ code:'cta-headline-overlap', message:'CTA와 제목이 겹칩니다.' });
    }
    if(M.headline && M.badge && overlaps(M.headline.rect, M.badge.rect)){
      fails.push({ code:'badge-headline-overlap', message:'Badge와 제목이 겹칩니다.' });
    }
    if(ctx.mutationCheck && ctx.mutationCheck.mutated){
      fails.push({ code:'immutable-violation', message:'읽기 전용 입력이 평가 중 변경되었습니다: '+ctx.mutationCheck.what });
    }
    return fails;
  }

  /* ══════════════════════════════════════════════════════════════
     총점/등급/평가 신뢰도/강점/우선 개선사항
     ══════════════════════════════════════════════════════════════ */

  var CATEGORY_ORDER = ['headlineReadability','visualHierarchy','layoutBalance','contrastColor','patternEffectiveness','ctaVisibility','badgeClarity','visualAnchorQuality','brandConsistency','mobileReadability'];
  var CATEGORY_SCORERS = {
    headlineReadability: scoreHeadlineReadability,
    visualHierarchy: scoreVisualHierarchy,
    layoutBalance: scoreLayoutBalance,
    contrastColor: scoreContrastColor,
    patternEffectiveness: scorePatternEffectiveness,
    ctaVisibility: scoreCtaVisibility,
    badgeClarity: scoreBadgeClarity,
    visualAnchorQuality: scoreVisualAnchorQuality,
    brandConsistency: scoreBrandConsistency,
    mobileReadability: scoreMobileReadability
  };
  var CATEGORY_LABELS = {
    headlineReadability:'Headline Readability', visualHierarchy:'Visual Hierarchy', layoutBalance:'Layout Balance',
    contrastColor:'Contrast & Color', patternEffectiveness:'Pattern Effectiveness', ctaVisibility:'CTA Visibility',
    badgeClarity:'Badge Clarity', visualAnchorQuality:'Mockup/Visual Anchor Quality', brandConsistency:'BrandProfile Consistency',
    mobileReadability:'Mobile Thumbnail Readability'
  };
  TI2.CATEGORY_LABELS = CATEGORY_LABELS;

  var COVERAGE_LABEL = { full:'충분함', partial:'일부 데이터 부족', limited:'제한적' };
  function coverageLabelFor(coverage){
    if(coverage>=90) return COVERAGE_LABEL.full;
    if(coverage>=60) return COVERAGE_LABEL.partial;
    return COVERAGE_LABEL.limited;
  }

  function gradeFor(total, hasHardFail){
    if(hasHardFail) return 'needs-improvement';
    if(total>=95) return 'excellent';
    if(total>=85) return 'good';
    if(total>=70) return 'fair';
    if(total>=50) return 'poor';
    return 'needs-improvement';
  }

  /* Hard Fail 개수가 많을수록 상한을 더 낮춘다(1건=49점 상한, 2건=34점, 3건+=19점) —
     "최대 49점"이라는 상한 규칙을 지키면서도 Hard Fail 1건과 2건 이상의 심각도
     차이가 총점에서도 구분되게 한다(요구사항 §8 F/G 구분). */
  function hardFailCap(count){
    return Math.max(10, 49 - (count-1)*15);
  }

  /* ctx = { state, brandProfile, marketingCopy, blueprint, blueprintRender, rendererMode, layoutId, pattern, mutationCheck } */
  TI2.computeScore = function(M, ctx){
    ctx = ctx || {};
    ctx.layoutId = ctx.layoutId || (ctx.state && ctx.state.layoutId) || 'center-text';
    ctx.bgLuminance = typeof ctx.bgLuminance==='number' ? ctx.bgLuminance : 0.15;
    ctx.state = ctx.state || {};

    var categories = {};
    var rawScore = 0;
    var notEvaluableCount = 0;
    CATEGORY_ORDER.forEach(function(key){
      var result = CATEGORY_SCORERS[key](M, ctx);
      categories[key] = result;
      rawScore += result.score;
      if(result.status==='not-evaluable') notEvaluableCount++;
    });
    rawScore = clamp(Math.round(rawScore), 0, 100);

    var hardFails = computeHardFails(M, ctx);
    var evaluationCoverage = Math.round(100 * (CATEGORY_ORDER.length - notEvaluableCount) / CATEGORY_ORDER.length);

    // 카테고리 전체에서 issueCode 기준으로 중복 제거한 Priority Improvements를 먼저
    // 계산한다(95점 이상 자격 조건 중 "Priority Improvement 최대 1개"를 판단하려면
    // 최종 개수가 필요하기 때문).
    var ranked = CATEGORY_ORDER.map(function(key){
      return { key:key, label:CATEGORY_LABELS[key], ratio: categories[key].score/categories[key].maxScore, status: categories[key].status, reasons:categories[key].reasons, suggestions:categories[key].suggestions };
    });
    var allSuggestions = [];
    CATEGORY_ORDER.forEach(function(key){ categories[key].suggestions.forEach(function(s){ allSuggestions.push(s); }); });
    var seenIssueCodes = {};
    var priorityImprovements = allSuggestions
      .slice()
      .sort(function(a,b){ return b.priority - a.priority; })
      .filter(function(s){
        var code = s.issueCode || s.message;
        if(seenIssueCodes[code]) return false;
        seenIssueCodes[code] = true;
        return true;
      })
      .slice(0,5);

    var topStrengths = ranked.slice().filter(function(r){ return r.status==='evaluated' && r.reasons.length===0; })
      .sort(function(a,b){ return b.ratio-a.ratio; }).slice(0,3)
      .map(function(r){ return r.label+'이(가) 우수합니다.'; });

    // rawScore: 10개 카테고리 순수 합계(디버그/상세 설명용, 항상 보존).
    // totalScore: 사용자에게 표시되는 최종 점수 — Hard Fail 상한과 "평가 불가 항목이
    // 있으면 95점 이상 불가" 규칙, "95점 이상은 Priority Improvement 1개 이하"
    // 규칙을 적용한다. 무조건 숫자를 빼는 방식이 아니라 실제 발견된 결함/데이터
    // 공백에 의해서만 상한이 걸린다.
    var totalScore = rawScore;
    var hardFailLimited = false;
    if(hardFails.length>0){
      var cap = hardFailCap(hardFails.length);
      if(totalScore > cap){ totalScore = cap; hardFailLimited = true; }
    } else {
      if(notEvaluableCount>0 && totalScore>=95) totalScore = 94;
      if(priorityImprovements.length>1 && totalScore>=95) totalScore = 94;
    }
    totalScore = clamp(Math.round(totalScore), 0, 100);

    var grade = gradeFor(totalScore, hardFails.length>0);

    return {
      version: VERSION,
      rawScore: rawScore,
      totalScore: totalScore,
      hardFailLimited: hardFailLimited,
      grade: grade,
      evaluationCoverage: evaluationCoverage,
      evaluationConfidenceLabel: coverageLabelFor(evaluationCoverage),
      rendererMode: ctx.rendererMode || null,
      pattern: ctx.pattern || ctx.layoutId,
      categories: categories,
      hardFails: hardFails,
      topStrengths: topStrengths,
      priorityImprovements: priorityImprovements,
      measurements: {
        headlineLines: M.headline ? M.headline.lines : null,
        headlineFontSize: M.headline ? Math.round(M.headline.fontSize) : null,
        canvasWidth: M.canvasWidth, canvasHeight: M.canvasHeight,
        needsManualShorten: !!M.needsManualShorten,
        overlaps: hardFails.filter(function(f){ return /overlap/.test(f.code); }).map(function(f){ return f.code; })
      }
    };
  };

  /* ══════════════════════════════════════════════════════════════
     Orchestrator — DOM 측정 + 채점을 한 번에 수행. document가 없으면(Node 테스트)
     ctx.measurements를 직접 주입해 계산 로직만 검증할 수 있다.
     ══════════════════════════════════════════════════════════════ */
  TI2.evaluate = function(ctx){
    ctx = ctx || {};
    var M = ctx.measurements;
    if(!M && typeof document!=='undefined'){
      var canvas = document.getElementById('ts-preview-canvas');
      if(canvas) M = TI2.measureFromDom(canvas, ctx.state||{}, ctx.blueprintRender);
    }
    if(!M) return null;

    if(typeof TS_COLOR_THEMES!=='undefined' && ctx.state && ctx.state.colorId){
      var theme = TS_COLOR_THEMES.filter(function(t){ return t.id===ctx.state.colorId; })[0];
      if(theme){
        ctx.bgLuminance = backgroundLuminanceApprox(theme.bg);
        ctx.accentLuminance = relLuminanceHex(theme.accent);
      }
    }
    ctx.layoutId = (ctx.state && ctx.state.layoutId) || 'center-text';
    ctx.pattern = (ctx.blueprint && ctx.blueprint.pattern) || ctx.layoutId;

    var result = TI2.computeScore(M, ctx);

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      var bpNote = (ctx.brandProfile && ctx.brandProfile.brandStrategy)
        ? ('BrandProfile.brandStrategy가 '+ctx.brandProfile.brandStrategy+'이므로 이에 맞는 시각 언어(헤드라인 크기·Mockup 테마·CTA 강도)가 적용되었는지를 기준으로 평가했습니다.')
        : 'BrandProfile 정보 없이 평가했습니다.';
      AtlasReasoningService.reason({
        source: 'ThumbnailIntelligence2',
        rawScore: result.rawScore,
        totalScore: result.totalScore,
        grade: result.grade,
        hardFails: result.hardFails.map(function(f){ return f.code; }),
        reason: bpNote,
        timestamp: Date.now()
      });
    }

    return result;
  };

})(window.ThumbnailIntelligence2);
