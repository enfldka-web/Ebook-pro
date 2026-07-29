/* js/atlas-overlay-engine.js — Phase 14: Atlas Overlay Engine

   이미지 생성 AI가 한글 텍스트를 직접 그리게 하지 않는다(Prompt Composer가 항상
   "no embedded text" 지시를 포함한다) — 대신 Atlas가 생성/가져온 배경 이미지 위에
   승인된 Marketing Copy/Blueprint의 Headline/Subheadline/Badge/CTA만 Canvas로
   합성한다. 새 카피를 만들지 않는다 — approvedCopy에 없는 문구를 여기서 생성하지
   않는다.

   레이아웃 계산(줄바꿈/폰트 크기 자동 조절/대비 검사)은 DOM 없이도 동작하는 순수
   함수로 분리했다 — measureFn을 주입받아 Node에서도 독립적으로 테스트 가능하다.
   실제 Canvas 합성(composeThumbnailOverlay/composeSalesPageOverlay)만 브라우저
   전용이며, Preview와 Export가 항상 같은 이 함수를 거치도록 해 Preview==Export를
   보장한다. */

window.AtlasOverlayEngine = window.AtlasOverlayEngine || {};

(function(OE){

  /* ── 순수 레이아웃 계산 (Node 테스트 가능) ── */

  /* 단어 단위로 줄바꿈한다. measureFn(text)는 그 텍스트를 현재 폰트로 그렸을 때의
     픽셀 너비를 반환해야 한다(브라우저에서는 ctx.measureText(text).width). */
  OE.wrapLines = function(text, maxWidth, measureFn){
    var words = String(text||'').split(/\s+/).filter(Boolean);
    if(!words.length) return [];
    var lines = [];
    var current = words[0];
    for(var i=1;i<words.length;i++){
      var candidate = current+' '+words[i];
      if(measureFn(candidate) <= maxWidth) current = candidate;
      else { lines.push(current); current = words[i]; }
    }
    lines.push(current);
    return lines;
  };

  /* maxLines/maxWidth 안에 들어갈 때까지 폰트 크기를 minFontSize까지 1px씩 줄여본다.
     끝까지 못 맞추면 minFontSize를 그대로 쓰되 잘리지 않도록 줄 수를 maxLines로
     제한하고 마지막 줄에 말줄임(…)을 붙인다("잘림 방지" 요구 — 화면 밖으로 잘리는
     대신 텍스트 자체에 말줄임표를 남겨 사용자가 잘렸음을 알 수 있게 한다). */
  OE.fitFontSize = function(text, opts, measureFn){
    opts = opts || {};
    var maxWidth = opts.maxWidth || 1000;
    var maxLines = opts.maxLines || 2;
    var maxFontSize = opts.maxFontSize || 48;
    var minFontSize = opts.minFontSize || 14;
    for(var size=maxFontSize; size>=minFontSize; size--){
      var lines = OE.wrapLines(text, maxWidth, function(t){ return measureFn(t, size); });
      if(lines.length <= maxLines) return { fontSize:size, lines:lines, truncated:false };
    }
    var forced = OE.wrapLines(text, maxWidth, function(t){ return measureFn(t, minFontSize); }).slice(0, maxLines);
    if(forced.length){
      var last = forced[forced.length-1];
      forced[forced.length-1] = last.replace(/[.,!?]*$/, '') + '…';
    }
    return { fontSize:minFontSize, lines:forced, truncated:true };
  };

  /* WCAG 2.x 상대 휘도/대비율 계산 — hex는 '#rrggbb' 형태. */
  function srgbToLinear(c){ c = c/255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
  function relativeLuminance(hex){
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 0.2126*srgbToLinear(r) + 0.7152*srgbToLinear(g) + 0.0722*srgbToLinear(b);
  }
  OE.contrastRatio = function(hexA, hexB){
    var lA = relativeLuminance(hexA), lB = relativeLuminance(hexB);
    var lighter = Math.max(lA,lB), darker = Math.min(lA,lB);
    return (lighter+0.05) / (darker+0.05);
  };

  /* 배경색 대비 흰 글자/검은 글자 중 대비가 더 큰 쪽을 고른다(최소 4.5:1을 못
     맞추면 scrim을 추가로 어둡게/밝게 하라는 신호로 needsScrim=true를 반환). */
  OE.pickTextColor = function(backgroundHex){
    var white = OE.contrastRatio(backgroundHex, '#ffffff');
    var black = OE.contrastRatio(backgroundHex, '#000000');
    var color = white>=black ? '#ffffff' : '#000000';
    var ratio = Math.max(white, black);
    return { color: color, ratio: ratio, needsScrim: ratio < 4.5 };
  };

  /* safeAreaRect({x,y,w,h}, 0~1 비율)를 실제 canvas px 좌표로 변환한다. */
  OE.safeAreaToPixels = function(safeAreaRect, canvasWidth, canvasHeight){
    safeAreaRect = safeAreaRect || { x:0, y:0.78, w:1, h:0.22 };
    return {
      x: Math.round(safeAreaRect.x*canvasWidth), y: Math.round(safeAreaRect.y*canvasHeight),
      w: Math.round(safeAreaRect.w*canvasWidth), h: Math.round(safeAreaRect.h*canvasHeight)
    };
  };

  /* approvedCopy에서 이 Overlay가 실제로 그릴 필드만 화이트리스트로 뽑는다 — 여기
     없는 필드(예: 내부 평가 문구)는 절대 캔버스에 그리지 않는다. */
  OE.pickOverlayCopy = function(approvedCopy, fieldNames){
    approvedCopy = approvedCopy || {};
    var out = {};
    (fieldNames||['headline','subheadline','badge','cta']).forEach(function(f){ out[f] = approvedCopy[f] || ''; });
    return out;
  };

  /* ── 실제 Canvas 합성 (브라우저 전용) ──
     imageSource는 이미 로드된 HTMLImageElement 또는 canvas여야 한다(디코딩은 호출자
     책임 — js/image-engine.js). scrim은 대비가 부족할 때 반투명 어둡게/밝게 레이어를
     Safe Area 위에 얹는다. */
  function drawScrim(ctx, px, textColor){
    var dark = textColor==='#ffffff';
    var grad = ctx.createLinearGradient(px.x, px.y, px.x, px.y+px.h);
    var c = dark ? '0,0,0' : '255,255,255';
    grad.addColorStop(0, 'rgba('+c+',0)');
    grad.addColorStop(0.35, 'rgba('+c+',0.55)');
    grad.addColorStop(1, 'rgba('+c+',0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(px.x, px.y, px.w, px.h);
  }

  function composeOverlay(imageSource, approvedCopy, safeAreaRect, options){
    options = options || {};
    var width = options.width || (imageSource && imageSource.width) || 652;
    var height = options.height || (imageSource && imageSource.height) || 488;
    var canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    var ctx = canvas.getContext('2d');
    if(imageSource) ctx.drawImage(imageSource, 0, 0, width, height);
    var copy = OE.pickOverlayCopy(approvedCopy);
    var px = OE.safeAreaToPixels(safeAreaRect, width, height);
    var sampleColor = options.backgroundSampleHex || '#1f2937';
    var textPick = OE.pickTextColor(sampleColor);
    if(textPick.needsScrim || options.forceScrim) drawScrim(ctx, px, textPick.color);

    var measureFn = function(text, fontSize){ ctx.font = 'bold '+fontSize+'px sans-serif'; return ctx.measureText(text).width; };
    var padding = Math.round(px.w*0.06);
    var cursorY = px.y + padding + 18;

    if(copy.badge){
      ctx.font = 'bold '+Math.max(12, Math.round(width*0.022))+'px sans-serif';
      ctx.fillStyle = textPick.color;
      ctx.textAlign = 'left';
      ctx.fillText(copy.badge, px.x+padding, cursorY);
      cursorY += Math.round(width*0.022) + 14;
    }
    if(copy.headline){
      var fit = OE.fitFontSize(copy.headline, { maxWidth: px.w-padding*2, maxLines:2, maxFontSize:Math.round(width*0.075), minFontSize:Math.round(width*0.03) }, measureFn);
      ctx.fillStyle = textPick.color;
      ctx.textAlign = 'left';
      fit.lines.forEach(function(line){
        ctx.font = 'bold '+fit.fontSize+'px sans-serif';
        ctx.fillText(line, px.x+padding, cursorY);
        cursorY += fit.fontSize*1.2;
      });
    }
    if(copy.subheadline){
      ctx.font = Math.max(11, Math.round(width*0.028))+'px sans-serif';
      ctx.fillStyle = textPick.color;
      ctx.textAlign = 'left';
      ctx.fillText(copy.subheadline, px.x+padding, cursorY+6);
      cursorY += Math.round(width*0.028) + 12;
    }
    if(copy.cta){
      var ctaW = Math.round(width*0.28), ctaH = Math.round(width*0.06);
      var ctaX = px.x+padding, ctaY = Math.min(cursorY+8, px.y+px.h-ctaH-padding);
      ctx.fillStyle = textPick.color==='#ffffff' ? '#ffffff' : '#111827';
      ctx.fillRect(ctaX, ctaY, ctaW, ctaH);
      ctx.fillStyle = textPick.color==='#ffffff' ? '#111827' : '#ffffff';
      ctx.font = 'bold '+Math.max(11, Math.round(width*0.026))+'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(copy.cta, ctaX+ctaW/2, ctaY+ctaH/2+5);
    }
    return { canvas: canvas, dataUrl: canvas.toDataURL('image/png'), width: width, height: height };
  }

  OE.composeThumbnailOverlay = function(imageSource, approvedCopy, safeAreaRect, options){
    return composeOverlay(imageSource, approvedCopy, safeAreaRect, Object.assign({ width:652, height:488 }, options));
  };
  OE.composeSalesPageOverlay = function(imageSource, approvedCopy, safeAreaRect, options){
    return composeOverlay(imageSource, approvedCopy, safeAreaRect, Object.assign({ width:1080, height:1350 }, options));
  };

})(window.AtlasOverlayEngine);
