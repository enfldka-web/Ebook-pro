/* js/atlas-overlay-engine.js — Phase 14: Atlas Overlay Engine
   Thumbnail Engine redesign (production-quality pass): real background-color
   sampling, real accent-color extraction from the generated artwork (Brand
   Pack consistency without fabricating new AI schema data), height-aware
   layout fitting, real Pretendard typography, rounded CTA.

   이미지 생성 AI가 한글 텍스트를 직접 그리게 하지 않는다(Prompt Composer가 항상
   "no embedded text" 지시를 포함한다) — 대신 Atlas가 생성/가져온 배경 이미지 위에
   승인된 Marketing Copy/Blueprint의 Headline/Subheadline/Badge/CTA만 Canvas로
   합성한다. 새 카피를 만들지 않는다 — approvedCopy에 없는 문구를 여기서 생성하지
   않는다. 마찬가지로 새 색상 데이터를 지어내지 않는다 — 실제로 생성된 배경 이미지의
   픽셀에서 색을 추출해 쓴다(Creative Campaign 파이프라인에 색상 필드가 없으므로,
   진짜 있는 데이터인 이미지 자체를 근거로 삼는다).

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

  /* 색상 하나를 밝게/어둡게 조절한다(amount: -1~1). 실제 추출한 accent 색을 그대로
     칠판/버튼 배경에 쓰면 텍스트와의 대비가 부족할 수 있어, 칩/버튼처럼 "칠해진
     면" 위에는 이 함수로 살짝 어둡게 한 톤을 쓴다. */
  function shade(hex, amount){
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    function adj(c){ return Math.max(0, Math.min(255, Math.round(amount<0 ? c*(1+amount) : c+(255-c)*amount))); }
    function h2(n){ return n.toString(16).padStart(2,'0'); }
    return '#'+h2(adj(r))+h2(adj(g))+h2(adj(b));
  }

  /* 채도를 대략 계산한다(HSL S 근사) — accent 후보 중 너무 무채색(회색/거의 흰/검)인
     색을 걸러내기 위함. */
  function approxSaturation(r,g,b){
    var max=Math.max(r,g,b), min=Math.min(r,g,b);
    if(max===0) return 0;
    return (max-min)/max;
  }

  /* ── 실제 이미지에서 색 추출 (브라우저 전용, Canvas 필요) ──
     생성된 배경 이미지를 작은 오프스크린 캔버스(32×32)로 축소해 픽셀을 스캔한다 —
     전체 해상도를 그대로 스캔하면 느리고, 다운샘플은 "지배적인 색"을 뽑는 표준
     기법이다(개별 픽셀 노이즈가 평균화된다).
     - average: 안전 영역(safeArea) 픽셀의 평균색 — 텍스트 대비 판단에 쓴다(실제로
       텍스트가 얹힐 자리의 실제 밝기를 근거로 삼는다).
     - accent: 이미지 전체에서 가장 채도 높은 색 — 뱃지/CTA 색상에 쓴다("이 이미지에서
       실제로 존재하는 색"이라는 원칙 아래, 캠페인의 하나의 지배색을 뽑아 재사용한다). */
  function sampleImageColors(imageSource, canvasWidth, canvasHeight, safeAreaPx){
    var fallback = { averageHex:'#1f2937', accentHex:'#6366f1' };
    if(!imageSource || typeof document==='undefined') return fallback;
    try{
      var SIZE = 32;
      var sc = document.createElement('canvas');
      sc.width = SIZE; sc.height = SIZE;
      var sctx = sc.getContext('2d');
      sctx.drawImage(imageSource, 0, 0, SIZE, SIZE);
      var data = sctx.getImageData(0, 0, SIZE, SIZE).data;

      // safe area 평균색 — 원본 좌표계를 SIZE 격자로 환산해 그 영역만 평균낸다.
      var sx0 = Math.max(0, Math.floor(safeAreaPx.x/canvasWidth*SIZE));
      var sy0 = Math.max(0, Math.floor(safeAreaPx.y/canvasHeight*SIZE));
      var sx1 = Math.min(SIZE, Math.ceil((safeAreaPx.x+safeAreaPx.w)/canvasWidth*SIZE));
      var sy1 = Math.min(SIZE, Math.ceil((safeAreaPx.y+safeAreaPx.h)/canvasHeight*SIZE));
      var ar=0, ag=0, ab=0, an=0;
      var bestSat=-1, bestR=99, bestG=102, bestB=241; // fallback accent = Atlas indigo
      for(var y=0;y<SIZE;y++){
        for(var x=0;x<SIZE;x++){
          var i=(y*SIZE+x)*4;
          var r=data[i], g=data[i+1], b=data[i+2];
          if(x>=sx0 && x<sx1 && y>=sy0 && y<sy1){ ar+=r; ag+=g; ab+=b; an++; }
          var sat = approxSaturation(r,g,b);
          var lum = (r+g+b)/3;
          // 너무 어둡거나(<25) 너무 밝은(>235) 픽셀은 accent 후보에서 제외 —
          // 실루엣/하이라이트가 아니라 실제 "색"을 대표하는 픽셀을 원한다.
          if(sat>bestSat && lum>25 && lum<235){ bestSat=sat; bestR=r; bestG=g; bestB=b; }
        }
      }
      function h2(n){ return Math.round(n).toString(16).padStart(2,'0'); }
      var averageHex = an>0 ? '#'+h2(ar/an)+h2(ag/an)+h2(ab/an) : fallback.averageHex;
      var accentHex = '#'+h2(bestR)+h2(bestG)+h2(bestB);
      return { averageHex: averageHex, accentHex: accentHex };
    }catch(e){
      // getImageData가 CORS로 막히는 등 실패하면 조용히 fallback으로 — 오버레이 자체는
      // 여전히 그려져야 한다(색 추출 실패가 전체 합성을 막으면 안 됨).
      return fallback;
    }
  }

  /* ── 높이까지 고려한 레이아웃 fit (Node 테스트 가능) ──
     기존 fitFontSize는 너비/줄 수만 봤다 — Safe Area의 "높이" 예산은 한 번도
     검증되지 않아, 뱃지+헤드라인(2줄)+서브헤드+CTA가 동시에 있으면 실제로 Safe
     Area를 넘어 캔버스 밖으로 그려질 수 있었다(진짜 가독성 버그). 있는 요소만
     기준으로 총 높이를 예산 안에 맞을 때까지 전체 스케일을 낮춰가며 재계산한다.
     그래도 안 맞으면(예: 매우 낮은 Safe Area + 최대 길이 헤드라인 + 뱃지/서브헤드/
     CTA 전부) 무한히 글자를 줄여 읽을 수 없게 만드는 대신, 덜 핵심적인 요소부터
     순서대로 이 생성에서 제외한다 — CTA(플랫폼이 이미 자체 구매 버튼을 제공하므로
     가장 대체 가능), 그다음 서브헤드라인. 뱃지와 헤드라인(진짜 "주인공")은 절대
     제외하지 않는다 — 대신 끝까지 최소 크기로 유지한다. */
  function computeLayoutAtScale(copy, boxWidth, scale, measureFn, opts){
    var padding = Math.round(boxWidth*0.06);
    var innerWidth = boxWidth - padding*2;
    var badgeSize = copy.badge ? Math.max(11, Math.round(boxWidth*0.022*scale)) : 0;
    var subSize = copy.subheadline ? Math.max(10, Math.round(boxWidth*0.026*scale)) : 0;
    var ctaSize = copy.cta ? Math.max(10, Math.round(boxWidth*0.024*scale)) : 0;
    var ctaH = copy.cta ? Math.round(boxWidth*0.058*scale) : 0;
    var headlineMax = Math.round((opts.maxFontSize||boxWidth*0.088)*scale);
    var headlineMin = Math.max(14, Math.round(boxWidth*0.028*Math.min(1,scale+0.3)));
    var fit = copy.headline ? OE.fitFontSize(copy.headline, {
      maxWidth: innerWidth, maxLines: opts.maxLines||2, maxFontSize: Math.max(headlineMax, headlineMin), minFontSize: headlineMin
    }, measureFn) : { fontSize:0, lines:[], truncated:false };

    var gapSm = Math.round(boxWidth*0.012);
    var totalH = padding
      + (badgeSize ? badgeSize + gapSm*1.6 : 0)
      + (fit.lines.length ? fit.lines.length*fit.fontSize*1.22 : 0)
      + (subSize ? subSize*1.3 + gapSm : 0)
      + (ctaH ? ctaH + gapSm*1.6 : 0)
      + padding*0.7;

    return { scale:scale, badgeSize:badgeSize, subSize:subSize, ctaSize:ctaSize, ctaH:ctaH, headline:fit, padding:padding, gapSm:gapSm, totalH:totalH };
  }

  OE.fitOverlayLayout = function(copy, boxWidth, boxHeight, measureFn, opts){
    opts = opts || {};
    var scaleSteps = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45];
    var dropStages = [ {}, { cta:true }, { cta:true, subheadline:true } ];
    var best = null;
    for(var d=0; d<dropStages.length; d++){
      var reduced = Object.assign({}, copy);
      if(dropStages[d].cta) reduced.cta = '';
      if(dropStages[d].subheadline) reduced.subheadline = '';
      for(var s=0;s<scaleSteps.length;s++){
        var layout = computeLayoutAtScale(reduced, boxWidth, scaleSteps[s], measureFn, opts);
        layout.fitsHeight = layout.totalH<=boxHeight;
        layout.dropped = Object.keys(dropStages[d]);
        if(!best || layout.totalH < best.totalH) best = layout;
        if(layout.fitsHeight) return layout;
      }
    }
    return best; // 극단적인 경우(뱃지+헤드라인만 있어도 안 맞는 매우 낮은 Safe Area)에도 가장 근접했던 결과를 반환 — 잘리는 대신 최대한 축소된 상태
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
    grad.addColorStop(0.3, 'rgba('+c+',0.5)');
    grad.addColorStop(1, 'rgba('+c+',0.78)');
    ctx.fillStyle = grad;
    ctx.fillRect(px.x, px.y, px.w, px.h);
  }

  /* roundRect: 대부분의 최신 브라우저(Chromium/Playwright 포함)는 네이티브
     지원하지만, 없는 환경을 위한 최소 fallback도 둔다. */
  function pathRoundRect(ctx, x, y, w, h, r){
    if(typeof ctx.roundRect==='function'){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); return; }
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  var FONT_FAMILY = "'Pretendard', -apple-system, sans-serif";

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

    // 실제 생성된 이미지에서 색을 추출한다(지어낸 색이 아니라 이 이미지에 실제로
    // 존재하는 색) — Safe Area 평균색은 텍스트 대비 판단에, accent는 뱃지/CTA에 쓴다.
    var sampled = sampleImageColors(imageSource, width, height, px);
    var sampleColor = options.backgroundSampleHex || sampled.averageHex;
    var accentHex = options.accentHex || sampled.accentHex;
    var textPick = OE.pickTextColor(sampleColor);
    if(textPick.needsScrim || options.forceScrim) drawScrim(ctx, px, textPick.color);

    var measureFn = function(text, fontSize){ ctx.font = 'bold '+fontSize+'px '+FONT_FAMILY; return ctx.measureText(text).width; };
    var layout = OE.fitOverlayLayout(copy, px.w, px.h, measureFn, { maxFontSize: width*0.088, maxLines: 2 });
    var cursorY = px.y + layout.padding;

    if(copy.badge){
      var badgeH = Math.round(layout.badgeSize*1.9);
      var badgeMetricsFont = 'bold '+layout.badgeSize+'px '+FONT_FAMILY;
      ctx.font = badgeMetricsFont;
      var badgePadX = Math.round(layout.badgeSize*0.75);
      var badgeW = ctx.measureText(copy.badge).width + badgePadX*2;
      ctx.fillStyle = shade(accentHex, -0.1);
      pathRoundRect(ctx, px.x+layout.padding, cursorY, badgeW, badgeH, badgeH/2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.badge, px.x+layout.padding+badgePadX, cursorY+badgeH/2+1);
      ctx.textBaseline = 'alphabetic';
      cursorY += badgeH + layout.gapSm*1.6;
    }
    if(copy.headline && layout.headline.lines.length){
      ctx.fillStyle = textPick.color;
      ctx.textAlign = 'left';
      ctx.shadowColor = textPick.color==='#ffffff' ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.28)';
      ctx.shadowBlur = Math.max(2, Math.round(width*0.006));
      ctx.shadowOffsetY = 1;
      layout.headline.lines.forEach(function(line){
        ctx.font = '800 '+layout.headline.fontSize+'px '+FONT_FAMILY;
        ctx.fillText(line, px.x+layout.padding, cursorY+layout.headline.fontSize);
        cursorY += layout.headline.fontSize*1.22;
      });
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    if(copy.subheadline && layout.subSize){
      ctx.font = '600 '+layout.subSize+'px '+FONT_FAMILY;
      ctx.fillStyle = textPick.color;
      ctx.globalAlpha = 0.92;
      ctx.textAlign = 'left';
      ctx.fillText(copy.subheadline, px.x+layout.padding, cursorY+layout.subSize);
      ctx.globalAlpha = 1;
      cursorY += layout.subSize*1.3 + layout.gapSm;
    }
    if(copy.cta && layout.ctaH){
      var ctaPadX = Math.round(layout.ctaH*0.5);
      ctx.font = '800 '+layout.ctaSize+'px '+FONT_FAMILY;
      var ctaW = ctx.measureText(copy.cta).width + ctaPadX*2;
      var ctaX = px.x+layout.padding;
      var ctaY = Math.min(cursorY+layout.gapSm, px.y+px.h-layout.ctaH-layout.padding*0.5);
      ctx.fillStyle = accentHex;
      pathRoundRect(ctx, ctaX, ctaY, ctaW, layout.ctaH, layout.ctaH/2);
      ctx.fill();
      ctx.fillStyle = OE.pickTextColor(accentHex).color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.cta, ctaX+ctaW/2, ctaY+layout.ctaH/2+1);
      ctx.textBaseline = 'alphabetic';
    }
    return { canvas: canvas, dataUrl: canvas.toDataURL('image/png'), width: width, height: height, sampledColors: sampled };
  }

  OE.composeThumbnailOverlay = function(imageSource, approvedCopy, safeAreaRect, options){
    return composeOverlay(imageSource, approvedCopy, safeAreaRect, Object.assign({ width:652, height:488 }, options));
  };
  OE.composeSalesPageOverlay = function(imageSource, approvedCopy, safeAreaRect, options){
    return composeOverlay(imageSource, approvedCopy, safeAreaRect, Object.assign({ width:1080, height:1350 }, options));
  };

})(window.AtlasOverlayEngine);
