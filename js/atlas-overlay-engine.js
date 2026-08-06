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

  /* V3 Phase 2 Round 3(품질 튜닝) — Thumbnail 전용 스크림. 위 drawScrim은
     항상 "위(투명)→아래(진하게)" 세로 방향만 그린다 — 하단 Safe Area만 있던
     시절엔 맞는 가정이었지만, Intelligence Engine이 top/left/right도 고를 수
     있는 지금은 실제 버그였다: 예를 들어 top Safe Area는 텍스트가 이미지 맨
     위(뱃지)부터 시작하는데, 기존 방향으로는 그 자리가 정확히 alpha=0(가장
     투명)이 되어 정작 필요한 곳을 보호하지 못한다. 텍스트가 실제로 앉는 가장자리
     쪽을 항상 가장 진하게, 그 반대쪽을 투명하게 그린다. 또한 배경이 평균 대비는
     통과해도 국소적으로 복잡한("high-detail") 경우를 위해 호출자가 강제
     불투명도를 올릴 수 있게 한다(색 자체는 여전히 이미지에서만 정한다 — 이
     함수는 짙기만 조절, 새 색을 만들지 않는다). composeOverlay(공유 코드,
     Sales Page도 의존)는 절대 건드리지 않고 이 새 함수만 Thumbnail Intelligent
     경로에서 쓴다. */
  function drawScrimIntelligent(ctx, px, textColor, safeAreaName, boost){
    var dark = textColor==='#ffffff';
    var c = dark ? '0,0,0' : '255,255,255';
    var x0, y0, x1, y1;
    switch(safeAreaName){
      case 'top': x0=px.x; y0=px.y+px.h; x1=px.x; y1=px.y; break;
      case 'left': x0=px.x+px.w; y0=px.y; x1=px.x; y1=px.y; break;
      case 'right': x0=px.x; y0=px.y; x1=px.x+px.w; y1=px.y; break;
      default: x0=px.x; y0=px.y; x1=px.x; y1=px.y+px.h; break;
    }
    var grad = ctx.createLinearGradient(x0, y0, x1, y1);
    // V3 Phase 2 Round 3 재조정: 실제 렌더링 검증 중 발견된 결함 — boost(고밀도
    // 배경)일 때도 그라데이션이 여전히 "가까운 가장자리=완전 투명(0)"에서
    // 시작하면, 체크무늬처럼 인접 셀 간 명암차가 큰 배경은 옅게 씻어내도 그
    // 무늬 자체(밝은 칸/어두운 칸의 교대)가 그대로 비쳐 보인다(반투명 워시는
    // 전체를 밀어올릴 뿐 국소 대비를 지우지 못한다 — 실측으로 확인). boost일
    // 때는 가장 가까운 가장자리에서도 최소 불투명도 바닥을 둬서 Safe Area
    // 전체가 실제로 읽히게 한다. boost가 아닐 때(일반적인 사진/그라데이션
    // 배경)는 기존의 은은한 페이드를 그대로 유지한다.
    var rectX = px.x, rectY = px.y, rectW = px.w, rectH = px.h;
    if(boost){
      grad.addColorStop(0, 'rgba('+c+',0.5)');
      grad.addColorStop(0.32, 'rgba('+c+',0.72)');
      grad.addColorStop(1, 'rgba('+c+',0.92)');
      // 실측 결함: Safe Area 경계에 걸쳐 있는 장식 그래픽(예: 원 그래픽이
      // 절반만 영역 안에 들어오는 경우)은 정확히 그 경계에서 워시가 뚝
      // 끊겨 "위는 씻겼는데 아래는 그대로"인 이음매가 생긴다. 캔버스
      // 그라데이션은 stop 범위 밖을 stop 0 색으로 고정(clamp)하므로, "먼
      // 가장자리"(anchor 반대쪽) 방향으로 그리기 사각형만 살짝 더 늘리면
      // 그 여백 부분이 stop 0의 불투명도(0.5)로 자연스럽게 이어져 뚝 끊기는
      // 이음매 없이 부드럽게 옅어진다(그라데이션 정의 자체는 그대로 둔다).
      var bleed = 0.3;
      switch(safeAreaName){
        case 'top': rectH = px.h*(1+bleed); break;
        case 'left': rectW = px.w*(1+bleed); break;
        case 'right': rectX = px.x-px.w*bleed; rectW = px.w*(1+bleed); break;
        default: rectY = px.y-px.h*bleed; rectH = px.h*(1+bleed); break;
      }
    }else{
      grad.addColorStop(0, 'rgba('+c+',0)');
      grad.addColorStop(0.32, 'rgba('+c+',0.5)');
      grad.addColorStop(1, 'rgba('+c+',0.78)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(rectX, rectY, rectW, rectH);
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

  /* ══════════════════════════════════════════════════════════════════════
     V3 Phase 2 — Thumbnail Intelligence Engine.

     Everything below is NEW and ADDITIVE — composeOverlay/sampleImageColors/
     wrapLines/fitFontSize/fitOverlayLayout/composeSalesPageOverlay above are
     completely unmodified (not one line touched), and composeSalesPageOverlay
     never calls anything below this line. This is a deliberate isolation
     choice: Sales Page Engine must not be touched by this phase, and since
     both overlay types used to share one drawing routine, the safest way to
     guarantee zero Sales Page impact is a fully independent function for
     thumbnails rather than adding branches to the shared one. Only
     js/image-generation-ui.js's applyThumbnailOverlay() (never
     applySalesPageOverlay()) calls into this section. */

  /* 목록형 안전 영역 후보 — 기본은 기존과 동일한 하단 38% 밴드다. 다른 후보는
     이미지가 실제로 그 자리를 비워두고 있을 때만(복잡도가 뚜렷하게 낮을 때만)
     선택된다(chooseSafeArea 참조) — "이미지가 더 나은 배치를 제안하면 고정 위치에
     의존하지 않는다"는 요구사항을, 매번 배치가 흔들리지 않도록 보수적으로
     구현한다. */
  var SAFE_AREA_CANDIDATES = [
    { name:'bottom', rect:{ x:0, y:0.62, w:1, h:0.38 } },
    { name:'bottomTight', rect:{ x:0, y:0.70, w:1, h:0.30 } },
    { name:'top', rect:{ x:0, y:0, w:1, h:0.30 } },
    { name:'left', rect:{ x:0, y:0.12, w:0.42, h:0.76 } },
    { name:'right', rect:{ x:0.58, y:0.12, w:0.42, h:0.76 } }
  ];

  /* 48×48로 축소한 픽셀 안에서 사각형(0~1 비율) 영역의 밝기 분산(복잡도)과
     평균 밝기를 계산한다 — 분산이 낮을수록 "정적인"(디테일이 적은) 영역이라
     텍스트를 얹기 좋다. */
  function regionStats(data, size, rect){
    var x0 = Math.max(0, Math.floor(rect.x*size)), y0 = Math.max(0, Math.floor(rect.y*size));
    var x1 = Math.min(size, Math.ceil((rect.x+rect.w)*size)), y1 = Math.min(size, Math.ceil((rect.y+rect.h)*size));
    var sum=0, sumSq=0, n=0;
    for(var y=y0;y<y1;y++){
      for(var x=x0;x<x1;x++){
        var i=(y*size+x)*4;
        var lum=(data[i]+data[i+1]+data[i+2])/3;
        sum+=lum; sumSq+=lum*lum; n++;
      }
    }
    if(!n) return { variance:0, avgLum:128, n:0 };
    var mean=sum/n;
    return { variance:Math.max(0, sumSq/n - mean*mean), avgLum:mean, n:n };
  }

  /* 이미지 전체에서 "지배색"을 뽑는다 — 기존 accent(가장 채도 높은 픽셀 1개)와
     달리, 색상을 성긴 64구간(각 채널 4단계)으로 양자화해 가장 많은 픽셀이 몰린
     구간을 고른다(표준 히스토그램 기반 dominant color 기법). 단일 픽셀 노이즈에
     흔들리지 않는, "이 이미지 전체가 실제로 어떤 색조인가"에 대한 답이다. */
  function pickDominantColor(data, size){
    var buckets = {};
    for(var y=0;y<size;y++){
      for(var x=0;x<size;x++){
        var i=(y*size+x)*4;
        var r=data[i], g=data[i+1], b=data[i+2];
        var lum=(r+g+b)/3;
        if(lum<18 || lum>242) continue; // 거의 검정/거의 흰색(레터박스, 과다노출)은 "색"이 아니므로 제외
        var key = Math.min(3,(r/64)|0)+'_'+Math.min(3,(g/64)|0)+'_'+Math.min(3,(b/64)|0);
        if(!buckets[key]) buckets[key] = { count:0, r:0, g:0, b:0 };
        var bucket = buckets[key];
        bucket.count++; bucket.r+=r; bucket.g+=g; bucket.b+=b;
      }
    }
    var best=null;
    Object.keys(buckets).forEach(function(k){ if(!best || buckets[k].count>best.count) best=buckets[k]; });
    if(!best) return null;
    function h2(n){ return Math.round(n).toString(16).padStart(2,'0'); }
    var r=best.r/best.count, g=best.g/best.count, b=best.b/best.count;
    return { hex:'#'+h2(r)+h2(g)+h2(b), saturation:approxSaturation(r,g,b) };
  }

  /* 실제 생성된 이미지를 분석한다: 지배색 + (채도 기반) accent + 안전 영역별
     복잡도를 계산해 가장 적합한 배치를 고른다. composeOverlay/sampleImageColors와
     완전히 독립된 코드다(Sales Page 경로에 영향 없음). */
  function analyzeArtwork(imageSource, canvasWidth, canvasHeight, defaultRect, preferredName){
    var fallback = {
      averageHex:'#1f2937', accentHex:'#6366f1', dominantHex:'#1f2937', dominantSaturation:0,
      safeAreaRect: defaultRect, safeAreaName: preferredName||'bottom', candidateStats:[]
    };
    if(!imageSource || typeof document==='undefined') return fallback;
    try{
      var SIZE = 48;
      var sc = document.createElement('canvas');
      sc.width = SIZE; sc.height = SIZE;
      var sctx = sc.getContext('2d');
      sctx.drawImage(imageSource, 0, 0, SIZE, SIZE);
      var data = sctx.getImageData(0, 0, SIZE, SIZE).data;

      var ar=0, ag=0, ab=0, an=0;
      var bestSat=-1, bestR=99, bestG=102, bestB=241;
      for(var y=0;y<SIZE;y++){
        for(var x=0;x<SIZE;x++){
          var i=(y*SIZE+x)*4;
          var r=data[i], g=data[i+1], b=data[i+2];
          ar+=r; ag+=g; ab+=b; an++;
          var sat = approxSaturation(r,g,b);
          var lum = (r+g+b)/3;
          if(sat>bestSat && lum>25 && lum<235){ bestSat=sat; bestR=r; bestG=g; bestB=b; }
        }
      }
      function h2(n){ return Math.round(n).toString(16).padStart(2,'0'); }
      var averageHex = an>0 ? '#'+h2(ar/an)+h2(ag/an)+h2(ab/an) : fallback.averageHex;
      var accentHex = '#'+h2(bestR)+h2(bestG)+h2(bestB);

      var dominant = pickDominantColor(data, SIZE);

      var stats = SAFE_AREA_CANDIDATES.map(function(c){
        var s = regionStats(data, SIZE, c.rect);
        return { name:c.name, rect:c.rect, variance:s.variance, avgLum:s.avgLum };
      });
      // 기본(테마가 선호하는 위치, 없으면 하단)을 기준으로, 다른 후보가 분산이
      // 뚜렷하게(30% 이상) 더 낮을 때만 교체한다 — 사소한 차이로 매번 배치가
      // 바뀌지 않도록 보수적인 문턱을 둔다. V3 Phase 2 Round 2: preferredName이
      // 주어지면(선택된 Thumbnail Theme의 preferredSafeAreaName) 그 후보를
      // "기본값"으로 삼는다 — Intelligence Engine은 여전히 필요하면 다른 위치로
      // 옮길 수 있지만(가독성이 우선), 이제 그 판단은 "하단이 기본"이 아니라
      // "선택된 테마가 정한 자리가 기본"이라는 기준 위에서 이뤄진다("지능은 테마
      // 규칙 안에서 동작하되 테마 정체성을 지우지 않는다"는 요구사항).
      // 또한 기본 영역 자체가 이미 거의 평평하면(분산이 매우 작으면) 절대 바꾸지
      // 않는다 — 완전히 단색/거의 단색인 배경에서는 48×48 축소 시의 미세한 보간
      // 오차만으로도 "다른 후보가 근소하게 더 낮다"는 잘못된 신호가 나올 수 있어
      // (실측으로 확인된 실제 버그), 바꿀 실익이 없는데도 배치가 흔들렸다.
      var MIN_VARIANCE_TO_CARE = 6;
      var defaultStat = (preferredName && stats.filter(function(s){ return s.name===preferredName; })[0]) || stats[0];
      var best = defaultStat;
      if(defaultStat.variance > MIN_VARIANCE_TO_CARE){
        stats.forEach(function(s){ if(s!==defaultStat && s.variance < best.variance*0.7) best = s; });
      }

      // V3 Phase 2 Round 3(품질 튜닝) — 실제 렌더링 검증 중 발견된 결함: best.rect
      // 전체 평균 분산은 "이 영역 전체가 평평한가"만 답한다. 실제로는 장식
      // 일러스트 하나가 넓은 배경의 한쪽(예: 오른쪽 절반)에만 몰려 있어도 전체
      // 평균은 여전히 낮게 나올 수 있다 — 그 결과 텍스트가 "평균적으로 평평한"
      // 영역으로 배치됐지만 실제로는 그 절반에 있는 그래픽과 그대로 겹치는
      // 사고가 났다(bestsellerEditorial + illustration 배경 조합에서 실측
      // 확인). best.rect를 절반으로 나눠 각 절반의 분산도 함께 확인해, 둘 중
      // 더 "바쁜" 절반을 기준으로 스크림 강제 여부를 판단한다(배치 자체는
      // 그대로 두고, 보호막만 실제 최악의 절반 기준으로 정한다).
      var halfA = Object.assign({}, best.rect), halfB = Object.assign({}, best.rect);
      if(best.rect.w >= best.rect.h){
        halfA.w = best.rect.w/2; halfB.x = best.rect.x+best.rect.w/2; halfB.w = best.rect.w/2;
      }else{
        halfA.h = best.rect.h/2; halfB.y = best.rect.y+best.rect.h/2; halfB.h = best.rect.h/2;
      }
      var statA = regionStats(data, SIZE, halfA), statB = regionStats(data, SIZE, halfB);
      var pickedVariance = Math.max(best.variance, statA.variance, statB.variance);

      return {
        averageHex: averageHex,
        accentHex: accentHex,
        dominantHex: dominant ? dominant.hex : accentHex,
        dominantSaturation: dominant ? dominant.saturation : 0,
        safeAreaRect: best.rect,
        safeAreaName: best.name,
        pickedVariance: pickedVariance,
        candidateStats: stats
      };
    }catch(e){
      return fallback;
    }
  }
  OE.analyzeArtwork = analyzeArtwork;

  /* 오포먼(고아 단어) 방지 줄바꿈 — 기존 wrapLines(그대로 둠, Sales Page가 계속
     쓴다)로 먼저 줄을 나눈 뒤, 마지막 줄이 단어 하나뿐이면 이전 줄의 마지막
     단어를 넘겨받아 외로운 한 단어짜리 줄을 없앤다(너비 안에 들어갈 때만). 한국어
     타이포그래피에서도 흔히 지켜지는 관례다. */
  OE.wrapLinesBalanced = function(text, maxWidth, measureFn){
    var lines = OE.wrapLines(text, maxWidth, measureFn);
    if(lines.length < 2) return lines;
    var last = lines[lines.length-1];
    var prev = lines[lines.length-2];
    var lastWords = last.split(/\s+/).filter(Boolean);
    if(lastWords.length===1){
      var prevWords = prev.split(/\s+/).filter(Boolean);
      if(prevWords.length>1){
        var moved = prevWords[prevWords.length-1];
        var candidateLast = moved+' '+last;
        if(measureFn(candidateLast)<=maxWidth){
          lines[lines.length-2] = prevWords.slice(0,-1).join(' ');
          lines[lines.length-1] = candidateLast;
        }
      }
    }
    return lines;
  };

  /* V3 Phase 2 Round 4 — 커머셜 썸네일 참고 자료(크몽/스마트스토어류 실제
     판매 썸네일) 다수를 비교 분석한 결과, 서로 다른 제작자/카테고리의
     썸네일들이 공통으로 쓰는 장치 중 새 카피를 지어내지 않고도 재현 가능한
     것은 "헤드라인 안의 숫자를 다른 색으로 강조"였다(월 3,000만원 / 10억 /
     2024 크몽어워즈 등 — 어떤 단어가 "핵심 키워드"인지는 추측(Never Guess
     위반)해야 하지만, 숫자는 이미 존재하는 카피 안에서 객관적으로 찾아낼 수
     있는 유일한 신호다). 헤드라인 문자열 안의 숫자 구간(예: "2배", "90일",
     "3000만원"의 앞자리 숫자)만 갈라내 별도 색으로 그릴 수 있게 구간을
     나눈다 — 새 텍스트를 만들지 않고, 이미 승인된 헤드라인 문자열만 그대로
     재사용한다. */
  OE.splitHeadlineEmphasis = function(text){
    text = String(text||'');
    var out = [];
    var re = /\d+/g;
    var last = 0, m;
    while((m = re.exec(text))){
      if(m.index > last) out.push({ text: text.slice(last, m.index), emphasis: false });
      out.push({ text: m[0], emphasis: true });
      last = m.index + m[0].length;
    }
    if(last < text.length) out.push({ text: text.slice(last), emphasis: false });
    if(!out.length) out.push({ text: text, emphasis: false });
    return out;
  };

  OE.fitFontSizeBalanced = function(text, opts, measureFn){
    opts = opts || {};
    var maxWidth = opts.maxWidth || 1000;
    var maxLines = opts.maxLines || 2;
    var maxFontSize = opts.maxFontSize || 48;
    var minFontSize = opts.minFontSize || 14;
    for(var size=maxFontSize; size>=minFontSize; size--){
      var lines = OE.wrapLinesBalanced(text, maxWidth, function(t){ return measureFn(t, size); });
      if(lines.length <= maxLines) return { fontSize:size, lines:lines, truncated:false };
    }
    var forced = OE.wrapLinesBalanced(text, maxWidth, function(t){ return measureFn(t, minFontSize); }).slice(0, maxLines);
    if(forced.length){
      var last = forced[forced.length-1];
      forced[forced.length-1] = last.replace(/[.,!?]*$/, '') + '…';
    }
    return { fontSize:minFontSize, lines:forced, truncated:true };
  };

  function computeLayoutAtScaleIntelligent(copy, boxWidth, scale, measureFn, opts){
    var padding = Math.round(boxWidth*0.06*(opts.whitespaceScale||1));
    var innerWidth = boxWidth - padding*2;
    var badgeSize = copy.badge ? Math.max(11, Math.round(boxWidth*0.022*scale)) : 0;
    var subSize = copy.subheadline ? Math.max(10, Math.round(boxWidth*0.026*scale)) : 0;
    var ctaSize = copy.cta ? Math.max(10, Math.round(boxWidth*0.024*scale)) : 0;
    var ctaH = copy.cta ? Math.round(boxWidth*0.058*scale) : 0;
    var headlineMax = Math.round((opts.maxFontSize||boxWidth*0.088)*scale);
    var headlineMin = Math.max(14, Math.round(boxWidth*0.028*Math.min(1,scale+0.3)));
    var fit = copy.headline ? OE.fitFontSizeBalanced(copy.headline, {
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

  OE.fitOverlayLayoutIntelligent = function(copy, boxWidth, boxHeight, measureFn, opts){
    opts = opts || {};
    var scaleSteps = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.45];
    var dropStages = [ {}, { cta:true }, { cta:true, subheadline:true } ];
    var best = null;
    for(var d=0; d<dropStages.length; d++){
      var reduced = Object.assign({}, copy);
      if(dropStages[d].cta) reduced.cta = '';
      if(dropStages[d].subheadline) reduced.subheadline = '';
      for(var s=0;s<scaleSteps.length;s++){
        var layout = computeLayoutAtScaleIntelligent(reduced, boxWidth, scaleSteps[s], measureFn, opts);
        layout.fitsHeight = layout.totalH<=boxHeight;
        layout.dropped = Object.keys(dropStages[d]);
        if(!best || layout.totalH < best.totalH) best = layout;
        if(layout.fitsHeight) return layout;
      }
    }
    return best;
  };

  /* Brand Pack → 장식 언어/타이포그래피 성격(모양만, 색은 절대 여기서 정하지
     않는다 — 색은 항상 실제 이미지 픽셀에서만 나온다, 위 파일 헤더 원칙 유지).
     authority(Premium)는 더 각진 뱃지/CTA와 살짝의 자간으로 에디토리얼한 느낌을,
     trust(Study Note)는 작은 강조 점이 있는 완전한 필 모양으로 신뢰/노트 느낌을,
     relationship(Handwriting)/neutral은 기본 형태를 그대로 쓴다. 가독성(대비/
     크기)에는 전혀 관여하지 않는다 — "Brand Pack은 가독성을 절대 떨어뜨리지
     않는다"는 요구사항. */
  var BRAND_GEOMETRY = {
    authority: { cornerRatio:0.28, accentDot:false, letterSpacing:0.3 },
    trust: { cornerRatio:0.5, accentDot:true, letterSpacing:0 },
    relationship: { cornerRatio:0.5, accentDot:false, letterSpacing:0 },
    neutral: { cornerRatio:0.5, accentDot:false, letterSpacing:0 }
  };
  function pickGeometry(brandStrategy){
    /* 실제 앱 흐름에서는 AIP.brandProfileDefaults가 'Authority'/'Trust'/'Relationship'처럼
       대문자로 시작하는 값을 넘긴다 — 여기서 소문자로 정규화하지 않으면 항상 neutral로
       빠져 세 Brand Pack의 배지/CTA 모양이 실제로는 전혀 구분되지 않는다. */
    var key = String(brandStrategy||'').toLowerCase();
    return BRAND_GEOMETRY[key] || BRAND_GEOMETRY.neutral;
  }

  /* V3 Phase 2 Round 5 — Composition Engine 지원. js/thumbnail-composition-
     engine.js의 Layout Family가 지정한 panelSide를 실제 캔버스 픽셀 좌표로
     바꾼다. 'split' 계열(left/right/top/bottom)은 사진을 그 절반에만
     crop-cover로 그리고 나머지는 실제 이미지에서 뽑은 단색 패널로 채운다 —
     "사진 반쪽 + 텍스트 반쪽"이라는 실제로 다른 화면 구조를 만든다.
     'overlay' 계열(centerBand/corner)은 사진을 풀블리드로 그대로 두고 그 위에
     불투명 띠/카드를 얹는다(한국 베스트셀러 표지의 "오비 띠", 마켓플레이스
     리스팅의 "코너 정보 카드" 관례에서 원리만 차용 — 특정 표지를 복제하지
     않는다). panelSide가 없거나 'none'이면 null을 반환해 기존 Round 1~4의
     적응형 Safe Area 경로가 그대로 쓰이게 한다(회귀 없음). */
  function computeCompositionRects(family, width, height){
    if(!family || family.panelSide==='none') return null;
    var r = family.panelRatio;
    switch(family.panelSide){
      case 'right':
        return { mode:'split',
          imageRect:{ x:0, y:0, w:width*(1-r), h:height },
          panelRect:{ x:width*(1-r), y:0, w:width*r, h:height } };
      case 'left':
        return { mode:'split',
          imageRect:{ x:width*r, y:0, w:width*(1-r), h:height },
          panelRect:{ x:0, y:0, w:width*r, h:height } };
      case 'top':
        return { mode:'split',
          imageRect:{ x:0, y:height*r, w:width, h:height*(1-r) },
          panelRect:{ x:0, y:0, w:width, h:height*r } };
      case 'bottom':
        return { mode:'split',
          imageRect:{ x:0, y:0, w:width, h:height*(1-r) },
          panelRect:{ x:0, y:height*(1-r), w:width, h:height*r } };
      case 'centerBand':
        return { mode:'overlay', panelRect:{ x:0, y:height*(0.5-r/2), w:width, h:height*r } };
      case 'corner':
        var cr = family.cornerRatio || { w:0.55, h:0.35 };
        var cw = width*cr.w, ch = height*cr.h;
        var anchor = String(family.cornerAnchor||'bottomLeft').toLowerCase();
        var cx = anchor.indexOf('left')>=0 ? 0 : width-cw;
        var cy = anchor.indexOf('bottom')>=0 ? height-ch : 0;
        return { mode:'overlay', panelRect:{ x:cx, y:cy, w:cw, h:ch }, isCorner:true };
      default:
        return null;
    }
  }

  /* CSS background-size:cover와 같은 원리로, 소스 이미지를 잘라 목적지
     사각형을 빈틈없이 채운다(비율 왜곡 없이) — split 계열 Layout Family가
     사진을 캔버스 절반에만 그릴 때 쓴다. */
  function drawImageCover(ctx, img, dest){
    var sw = (img && (img.naturalWidth||img.width)) || 0;
    var sh = (img && (img.naturalHeight||img.height)) || 0;
    if(!sw || !sh || !dest.w || !dest.h) return;
    var destAspect = dest.w/dest.h, srcAspect = sw/sh;
    var sx, sy, sWidth, sHeight;
    if(srcAspect > destAspect){
      sHeight = sh; sWidth = sh*destAspect; sx = (sw-sWidth)/2; sy = 0;
    }else{
      sWidth = sw; sHeight = sw/destAspect; sx = 0; sy = (sh-sHeight)/2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, dest.x, dest.y, dest.w, dest.h);
  }

  /* V3 Phase 2 Round 6(아트 디렉션) — 실제 AI 배경 생성이 막혀 있어 "배경 사진
     안에 책/태블릿이 우연히 나오길" 기대할 수 없다. 대신 Atlas가 직접 벡터로
     그리는 목업을 각 Layout Family가 지정한 자리(mockupRect)에 얹어, 생성
     결과와 무관하게 "이 전자책의 실물감"을 항상 보장한다. 색은 그 이미지에서
     이미 뽑은 accentHex/textColor만 쓴다 — 새 색을 짓지 않는다. 표지 위 줄은
     실제 목차/문장을 지어내지 않고 일반적인 "본문이 있다"는 느낌만 주는 회색
     막대다(증거 조작 금지 원칙). */
  function drawBookMockup(ctx, r, accentHex, shadowAlpha){
    var baseY = r.y+r.h;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,'+(shadowAlpha||0.28)+')';
    ctx.beginPath(); ctx.ellipse(r.x+r.w/2, baseY+r.h*0.03, r.w*0.46, r.h*0.05, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    // 책등(spine) — 살짝 어두운 세로 띠로 두께감을 준다.
    ctx.fillStyle = shade(accentHex, -0.55);
    ctx.fillRect(r.x, r.y+r.h*0.02, r.w*0.055, r.h*0.96);
    // 표지 — 은은한 세로 그라데이션(위에서 빛이 오는 느낌)
    var coverX = r.x+r.w*0.055, coverW = r.w*0.945;
    var grad = ctx.createLinearGradient(coverX, r.y, coverX+coverW, r.y+r.h);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#f1f1f4');
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = r.w*0.05; ctx.shadowOffsetX = r.w*0.02; ctx.shadowOffsetY = r.h*0.015;
    ctx.fillStyle = grad;
    ctx.fillRect(coverX, r.y, coverW, r.h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; ctx.strokeRect(coverX, r.y, coverW, r.h);
    // 표지 상단 컬러 밴드(제목 자리처럼 보이는 실제 문구 없는 색 블록)
    var bandH = r.h*0.16;
    ctx.fillStyle = accentHex;
    ctx.fillRect(coverX, r.y, coverW, bandH);
    // 본문 자리 표시용 회색 막대(실제 텍스트 아님 — 그냥 "내용이 있다"는 신호)
    ctx.fillStyle = 'rgba(30,30,40,.16)';
    var lineY = r.y+bandH+r.h*0.12, lineGap = r.h*0.085;
    [1,0.86,0.7].forEach(function(wRatio, i){
      ctx.fillRect(coverX+coverW*0.12, lineY+lineGap*i, coverW*0.76*wRatio, r.h*0.028);
    });
  }

  function drawTabletMockup(ctx, r, accentHex){
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = r.w*0.05; ctx.shadowOffsetY = r.h*0.02;
    ctx.fillStyle = '#1c1c28';
    pathRoundRect(ctx, r.x, r.y, r.w, r.h, r.w*0.07);
    ctx.fill();
    ctx.restore();
    var bezel = r.w*0.045;
    var sx = r.x+bezel, sy = r.y+bezel, sw = r.w-bezel*2, sh = r.h-bezel*2;
    ctx.fillStyle = '#f5f6fa';
    pathRoundRect(ctx, sx, sy, sw, sh, r.w*0.03);
    ctx.fill();
    // 브라우저/앱 창 크롬 — 흔한 "디지털 제품" 신호(신호등 점 3개), 실제 데이터 아님.
    var dotY = sy+sh*0.10, dotR = sw*0.022;
    ['#ef4444','#f5b400','#22c55e'].forEach(function(c, i){
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx+sw*0.10+i*dotR*3, dotY, dotR, 0, Math.PI*2); ctx.fill();
    });
    ctx.fillStyle = accentHex;
    ctx.fillRect(sx+sw*0.08, sy+sh*0.22, sw*0.84, sh*0.14);
    ctx.fillStyle = 'rgba(30,30,40,.14)';
    [0.62, 0.48].forEach(function(wRatio, i){
      ctx.fillRect(sx+sw*0.08, sy+sh*0.46+sh*0.14*i, sw*0.84*wRatio, sh*0.075);
    });
  }

  function drawDocumentMockup(ctx, r, accentHex){
    // 살짝 어긋나게 쌓인 문서 묶음 — 뒤쪽 2장은 옅게, 맨 앞장만 또렷하게.
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = r.w*0.03; ctx.shadowOffsetY = r.h*0.012;
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    pathRoundRect(ctx, r.x+r.w*0.10, r.y+r.h*0.06, r.w*0.86, r.h*0.86, r.w*0.02);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    pathRoundRect(ctx, r.x+r.w*0.05, r.y+r.h*0.03, r.w*0.90, r.h*0.90, r.w*0.02);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    pathRoundRect(ctx, r.x, r.y, r.w*0.92, r.h*0.92, r.w*0.02);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; ctx.strokeRect(r.x, r.y, r.w*0.92, r.h*0.92);
    ctx.fillStyle = accentHex;
    ctx.fillRect(r.x, r.y, r.w*0.92, r.h*0.10);
    ctx.fillStyle = 'rgba(30,30,40,.16)';
    [1,0.8,0.9,0.6].forEach(function(wRatio, i){
      ctx.fillRect(r.x+r.w*0.08, r.y+r.h*0.22+r.h*0.13*i, r.w*0.76*wRatio, r.h*0.045);
    });
    // 체크마크 배지 — "완료/검증됨" 느낌의 일반적인 아이콘, 실제 수치 아님.
    var cx = r.x+r.w*0.92-r.w*0.10, cy = r.y+r.h*0.92-r.h*0.10, cr = r.w*0.09;
    ctx.fillStyle = accentHex;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, cr*0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx-cr*0.45, cy); ctx.lineTo(cx-cr*0.1, cy+cr*0.4); ctx.lineTo(cx+cr*0.5, cy-cr*0.4);
    ctx.stroke();
  }

  function drawMockup(ctx, type, rect, accentHex){
    if(type==='book') drawBookMockup(ctx, rect, accentHex);
    else if(type==='tablet') drawTabletMockup(ctx, rect, accentHex);
    else if(type==='document') drawDocumentMockup(ctx, rect, accentHex);
  }

  /* Problem Solver 전용 보조 그래픽 — 위로 향하는 화살표(성장/개선) + 체크
     배지. 실제 수치를 지어내지 않는, 순수 상징 그래픽이다. */
  function drawCheckArrowGraphic(ctx, width, height, accentHex){
    var x0 = width*0.06, y0 = height*0.10, x1 = width*0.16, y1 = height*0.03;
    ctx.strokeStyle = accentHex; ctx.lineWidth = Math.max(2, width*0.008); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1-width*0.03, y1); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1+height*0.03); ctx.stroke();
  }

  /* Bestseller Editorial 전용 보조 그래픽 — 캔버스 왼쪽 가장자리에 아주 얇은
     책등 선을 그어, 이 썸네일 전체가 "책 표지 그 자체"처럼 느껴지게 한다. */
  function drawSpineLineGraphic(ctx, width, height, textColor){
    ctx.fillStyle = textColor==='#ffffff' ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)';
    ctx.fillRect(Math.round(width*0.045), 0, Math.max(1, Math.round(width*0.004)), height);
  }

  /* safe 영역 비율 rect({x,y,w,h} 0~1)를 실제 캔버스 픽셀로 바꾼다 — 목업 배치
     전용(safeAreaToPixels와 동일한 계산이지만 이름을 분리해 목업 좌표 계산
     경로를 명확히 한다). */
  function ratioRectToPixels(rect, width, height){
    return { x: rect.x*width, y: rect.y*height, w: rect.w*width, h: rect.h*height };
  }

  /* V3 Phase 2 Round 6 실측 결함: panelSide:'none' Family(각 테마의 기존
     기본형)는 텍스트 위치를 적응형 analyzeArtwork가 실시간으로 정한다 —
     보통 'bottom'이지만 배경에 따라 'top'/'left'/'right'로 바뀔 수 있다
     (Round 1의 의도된 동작). 그런데 Family에 미리 박아 둔 고정 mockupRect는
     "텍스트가 항상 하단에 있다"고 가정해 우상단에 배치돼 있어, 적응형
     엔진이 'top'을 고르면 텍스트와 목업이 그대로 겹치는 실제 충돌이
     났다(교육 주제 예시에서 실측 확인). 텍스트가 실제로 어느 안전 영역에
     앉았는지에 따라 목업을 항상 "반대쪽"으로 옮겨 충돌 자체를 구조적으로
     없앤다. panelSide가 있는 Family(패널/코너 계열)는 텍스트 자리를 이미
     확정적으로 알고 있으므로(패널 자체가 텍스트 자리) 그대로 고정 mockupRect를
     쓴다. */
  function resolveMockupRect(family, hasPanel, safeAreaName){
    if(!family || !family.mockupRect) return null;
    if(hasPanel) return family.mockupRect;
    var w = family.mockupRect.w, h = family.mockupRect.h;
    switch(safeAreaName){
      case 'top': return { x:1-w-0.06, y:1-h-0.06, w:w, h:h };
      case 'left': return { x:1-w-0.06, y:0.5-h/2, w:w, h:h };
      case 'right': return { x:0.06, y:0.5-h/2, w:w, h:h };
      default: return family.mockupRect; // 'bottom'/'bottomTight' — 기존 고정 자리(우상단) 그대로
    }
  }

  /* 실제 Canvas 합성 — Thumbnail 전용 지능형 경로. composeOverlay와 같은 그리기
     스타일을 따르되: (1) 고정 Safe Area 대신 analyzeArtwork가 고른 위치를 쓰고,
     (2) accent는 "이미지가 실제로 하나의 지배적인 색조(채도 높은 단일색)를 가질
     때"는 그 지배색을, 아니면 기존처럼 가장 채도 높은 픽셀을 쓰며, (3) 헤드라인
     줄바꿈이 고아 단어를 만들지 않고, (4) Brand Pack이 뱃지/CTA의 모양(색은 절대
     아님)에 옅게 반영된다. */
  OE.composeThumbnailOverlayIntelligent = function(imageSource, approvedCopy, defaultSafeAreaRect, options){
    options = options || {};
    var width = options.width || 652;
    var height = options.height || 488;
    var canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    var ctx = canvas.getContext('2d');
    var copy = OE.pickOverlayCopy(approvedCopy);
    // V3 Phase 2 Round 2: 선택된 Thumbnail Theme이 뱃지/CTA를 아예 보여주지 않기로
    // 정했다면(예: publisherPremium의 "minimal decorative noise"), 그리기 단계가
    // 아니라 여기서 copy 자체를 비워 레이아웃 높이 계산(fitOverlayLayoutIntelligent)
    // 부터 뱃지/CTA를 위한 공간을 아예 배정하지 않게 한다 — 그리지만 않고 자리만
    // 남기면 헤드라인 위에 설명 없는 빈 공간이 생기는 진짜 문제가 있었다.
    if(options.badgeShow===false) copy.badge = '';
    if(options.ctaShow===false) copy.cta = '';

    // 색/accent 분석은 Layout Family 유무와 무관하게 항상 전체 원본 이미지
    // 기준으로 먼저 계산한다 — "색은 항상 실제 이미지에서만" 원칙은 구도가
    // 바뀌어도 그대로 지킨다.
    var analysis = analyzeArtwork(imageSource, width, height, defaultSafeAreaRect || SAFE_AREA_CANDIDATES[0].rect, options.preferredSafeAreaName);
    var sampleColor = options.backgroundSampleHex || analysis.averageHex;
    var accentHex = options.accentHex || (analysis.dominantSaturation > 0.35 ? analysis.dominantHex : analysis.accentHex);
    // 실사용 중 발견된 결함: 배경이 거의 단색/무채색이면(dominant/accent 추출이
    // 실제로 뽑을 만한 색이 없어) accentHex가 배경색과 거의 같아져, 뱃지/CTA
    // 알약이 배경에 파묻혀 거의 보이지 않는다(뱃지 계층/CTA 배치 요구사항 위반).
    // 배경 대비 accent의 대비가 최소 기준(1.6:1 — 텍스트 기준 4.5:1보다는 낮게
    // 잡는다, "칠해진 면"은 텍스트만큼 엄격할 필요는 없지만 완전히 안 보이면
    // 안 된다)에 못 미치면, 이미지에 실제 색 신호가 없다는 뜻이므로 기존
    // sampleImageColors의 fallback과 동일한 Atlas 기본 accent로 대체한다(새 색을
    // 지어내는 게 아니라, "이 이미지에는 쓸 만한 색이 없다"는 판단에 대한 기존
    // 폴백 원칙을 그대로 따른다).
    if(OE.contrastRatio(accentHex, sampleColor) < 1.6) accentHex = '#6366f1';

    // V3 Phase 2 Round 5 — Composition Engine: Layout Family가 패널 구조를
    // 지정하면(panelSide !== 'none') 사진+패널을 그리고, 텍스트는 그 패널의
    // 실제 칠해진 색을 기준으로 배치한다(적응형 밝기 분석이 필요 없다 — 패널
    // 색은 우리가 직접 칠했으므로 이미 알고 있다). 지정하지 않으면(대부분
    // 테마의 기존 기본형) Round 1~4의 적응형 Safe Area 경로를 그대로 쓴다.
    var family = options.layoutFamily;
    var comp = computeCompositionRects(family, width, height);
    var px, textPick, panelFillColor = null, invertedPill = false;

    if(comp){
      if(comp.mode==='split'){
        if(imageSource) drawImageCover(ctx, imageSource, comp.imageRect);
      }else if(imageSource){
        ctx.drawImage(imageSource, 0, 0, width, height);
      }
      panelFillColor = family.panelColorMode==='accent' ? accentHex : shade(analysis.averageHex, -0.35);
      if(comp.isCorner){
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.32)';
        ctx.shadowBlur = Math.max(4, Math.round(width*0.014));
        ctx.shadowOffsetY = Math.max(2, Math.round(width*0.006));
        ctx.fillStyle = panelFillColor;
        pathRoundRect(ctx, comp.panelRect.x, comp.panelRect.y, comp.panelRect.w, comp.panelRect.h, Math.round(width*0.028));
        ctx.fill();
        ctx.restore();
      }else{
        ctx.fillStyle = panelFillColor;
        ctx.fillRect(comp.panelRect.x, comp.panelRect.y, comp.panelRect.w, comp.panelRect.h);
      }
      if(family.supportingGraphic==='dividerLine'){
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.fillRect(Math.round(comp.panelRect.x-1), comp.panelRect.y, 2, comp.panelRect.h);
      }else if(family.supportingGraphic==='cornerAccent'){
        ctx.fillStyle = accentHex;
        pathRoundRect(ctx, comp.panelRect.x+Math.round(width*0.035), comp.panelRect.y-Math.round(height*0.008), Math.round(width*0.16), Math.round(height*0.016), Math.round(height*0.008));
        ctx.fill();
      }
      px = comp.panelRect;
      textPick = OE.pickTextColor(panelFillColor);
      invertedPill = true;
    }else{
      if(imageSource) ctx.drawImage(imageSource, 0, 0, width, height);
      px = OE.safeAreaToPixels(analysis.safeAreaRect, width, height);
      textPick = OE.pickTextColor(sampleColor);
      // V3 Phase 2 Round 3(품질 튜닝): pickTextColor는 Safe Area의 "평균색"
      // 대비만 본다 — 평균은 통과해도 그 안에 국소적으로 밝은/어두운 패치가 섞인
      // "복잡한(high-detail)" 배경에서는 텍스트 일부가 배경 무늬와 겹쳐 실제로는
      // 읽기 어려워진다(실사용 검증 중 확인된 실제 결함). analyzeArtwork가 이미
      // 계산해 둔 안전 영역의 밝기 분산(pickedVariance)이 높으면 평균 대비만으로
      // 통과했더라도 스크림을 강제한다 — 새 색을 추가하는 게 아니라 기존 스크림의
      // 짙기만 올리는 것이므로 "색은 항상 실제 이미지에서만" 원칙을 지킨다.
      var HIGH_DETAIL_VARIANCE = 80;
      var isHighDetailBg = (analysis.pickedVariance||0) > HIGH_DETAIL_VARIANCE;
      if(textPick.needsScrim || options.forceScrim || isHighDetailBg){
        drawScrimIntelligent(ctx, px, textPick.color, analysis.safeAreaName, isHighDetailBg);
      }
    }

    // V3 Phase 2 Round 6(아트 디렉션) — Layout Family가 목업/보조 그래픽을
    // 지정하면(panelSide 유무와 무관하게, 즉 기존 기본형에도) 텍스트를 그리기
    // 전에 얹는다. 목업 자리(mockupRect)는 각 Family가 텍스트 영역과 겹치지
    // 않도록 이미 설계해 뒀다.
    if(family && family.mockupType && family.mockupType!=='none' && family.mockupRect){
      var resolvedMockupRect = resolveMockupRect(family, !!comp, analysis.safeAreaName);
      if(resolvedMockupRect) drawMockup(ctx, family.mockupType, ratioRectToPixels(resolvedMockupRect, width, height), accentHex);
    }
    if(family && family.supportingGraphic==='checkArrow'){
      drawCheckArrowGraphic(ctx, width, height, accentHex);
    }else if(family && family.supportingGraphic==='spineLine'){
      drawSpineLineGraphic(ctx, width, height, textPick.color);
    }

    var geometry = pickGeometry(options.brandStrategy);
    // V3 Phase 2 Round 2: Thumbnail Theme의 decorativeLimit이 Brand Pack의 장식
    // 취향(예: trust 브랜드팩의 accentDot)보다 우선한다 — "Brand Pack은 선택된
    // 테마의 정체성을 절대 깨지 않는다"는 요구사항. 색/코너 반경은 그대로 Brand
    // Pack이 정하고, 오직 "점 장식을 넣을지"만 테마가 minimal이면 강제로 끈다.
    if(options.decorativeLimit==='minimal' && geometry.accentDot){
      geometry = Object.assign({}, geometry, { accentDot:false });
    }

    var measureFn = function(text, fontSize){
      ctx.font = 'bold '+fontSize+'px '+FONT_FAMILY;
      if('letterSpacing' in ctx) ctx.letterSpacing = (geometry.letterSpacing||0)+'px';
      return ctx.measureText(text).width;
    };
    var layout = OE.fitOverlayLayoutIntelligent(copy, px.w, px.h, measureFn, {
      maxFontSize: width*0.088*(options.titleScale||1),
      maxLines: options.maxLines||2,
      whitespaceScale: options.whitespaceScale||1
    });
    var cursorY = px.y + layout.padding;
    // V3 Phase 2 Round 5 — Composition Engine: Layout Family가 textAlign:
    // 'center'를 지정하면(예: Publisher Premium의 framedCentered, Bestseller
    // Editorial의 centeredBand) 뱃지/헤드라인/서브헤드/CTA 전부를 패널 폭
    // 기준으로 가운데 정렬한다. 기존 테마 기본형은 전부 'left'이므로 이
    // 분기는 새 구조에서만 동작하고 기존 출력은 그대로 유지된다.
    var textAlign = (family && family.textAlign) || 'left';
    // Round 5: invertedPill이면(패널이 직접 칠해진 색이므로) 뱃지/CTA를
    // "판" 위에 얹은 알약이 아니라 판과 반대색인 알약 + 판 색 글자로 뒤집는다
    // — 패널 색이 accentHex 그 자체일 수 있어(예: Problem Solver의
    // splitPanel), 기존처럼 accentHex 알약을 또 칠하면 배경과 같은 색이 되어
    // 보이지 않는 실제 버그가 나기 때문이다. textPick.color/panelFillColor는
    // pickTextColor로 이미 최대 대비가 보장된 한 쌍이므로 새 색을 짓지 않고도
    // 항상 안전하다.
    var badgeFillColor = invertedPill ? textPick.color : shade(accentHex, -0.1);
    var badgeLabelColor = invertedPill ? panelFillColor : '#ffffff';
    var ctaFillColor = invertedPill ? textPick.color : accentHex;
    var ctaLabelColor = invertedPill ? panelFillColor : OE.pickTextColor(accentHex).color;

    if(copy.badge){
      var badgeH = Math.round(layout.badgeSize*1.9);
      ctx.font = 'bold '+layout.badgeSize+'px '+FONT_FAMILY;
      if('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      var badgePadX = Math.round(layout.badgeSize*0.75);
      var dotD = geometry.accentDot ? Math.round(layout.badgeSize*0.32) : 0;
      var dotGap = dotD ? Math.round(badgePadX*0.5) : 0;
      var badgeW = ctx.measureText(copy.badge).width + badgePadX*2 + (dotD ? dotD+dotGap : 0);
      var badgeX = textAlign==='center' ? px.x+(px.w-badgeW)/2 : px.x+layout.padding;
      ctx.fillStyle = badgeFillColor;
      // V3 Phase 2 Round 3(품질 튜닝): 뱃지가 배경 위에 그냥 "붙어있는 평평한
      // 스티커"처럼 보이지 않도록, 실제 인쇄/커머셜 디자인의 배지·알약 버튼처럼
      // 아주 옅은 그림자로 살짝 뜬 느낌을 준다(색은 그대로, 짙기만 추가).
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.22)';
      ctx.shadowBlur = Math.max(2, Math.round(width*0.008));
      ctx.shadowOffsetY = Math.max(1, Math.round(width*0.003));
      pathRoundRect(ctx, badgeX, cursorY, badgeW, badgeH, badgeH*geometry.cornerRatio);
      ctx.fill();
      ctx.restore();
      var textStartX = badgeX+badgePadX;
      if(dotD){
        ctx.beginPath();
        ctx.fillStyle = badgeLabelColor;
        ctx.arc(textStartX+dotD/2, cursorY+badgeH/2, dotD/2, 0, Math.PI*2);
        ctx.fill();
        textStartX += dotD + dotGap;
      }
      ctx.fillStyle = badgeLabelColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.badge, textStartX, cursorY+badgeH/2+1);
      ctx.textBaseline = 'alphabetic';
      cursorY += badgeH + layout.gapSm*1.6;
    }
    if(copy.headline && layout.headline.lines.length){
      ctx.textAlign = 'left';
      // V3 Phase 2 Round 3(품질 튜닝): 그림자를 살짝 더 진하고 넓게 키워
      // 어떤 배경 위에서도 헤드라인이 "떠 보이는" 대신 또렷하게 튀어나오게
      // 한다(과하면 촌스러워지므로 여전히 은은한 수준 — 커머셜 포스터가
      // 흔히 쓰는 정도로만).
      ctx.shadowColor = textPick.color==='#ffffff' ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)';
      ctx.shadowBlur = Math.max(3, Math.round(width*0.009));
      ctx.shadowOffsetY = Math.max(1, Math.round(width*0.0023));
      if('letterSpacing' in ctx) ctx.letterSpacing = (geometry.letterSpacing||0)+'px';
      // V3 Phase 2 Round 6(아트 디렉션) — 실제 참고 썸네일들은 강조 숫자를
      // 색만 바꾸는 게 아니라 "더 크게" 그려 위계를 만든다(10억/월 3,000만원
      // 등이 문장의 다른 글자보다 눈에 띄게 크다). baseline은 그대로 두고
      // (같은 y좌표에 fillText) 강조 구간만 더 큰 폰트로 그려, 손글씨로 숫자만
      // 크게 쓴 것 같은 자연스러운 위계를 만든다.
      var EMPHASIS_SCALE = 1.3;
      var baseFontSize = layout.headline.fontSize;
      var emphFontSize = Math.round(baseFontSize*EMPHASIS_SCALE);
      function segFont(size){ return '800 '+size+'px '+FONT_FAMILY; }
      layout.headline.lines.forEach(function(line){
        ctx.font = segFont(baseFontSize);
        var lineHasEmphasis = options.numberEmphasis && /\d/.test(line);
        var lineMaxFont = lineHasEmphasis ? emphFontSize : baseFontSize;
        // 정렬을 위해 먼저 전체 줄 너비를 잰다(강조 구간은 큰 폰트로).
        var lineWidth = 0;
        if(options.numberEmphasis){
          OE.splitHeadlineEmphasis(line).forEach(function(seg){
            if(!seg.text) return;
            ctx.font = segFont(seg.emphasis ? emphFontSize : baseFontSize);
            lineWidth += ctx.measureText(seg.text).width;
          });
        }else{
          lineWidth = ctx.measureText(line).width;
        }
        var segX = textAlign==='center' ? px.x+(px.w-lineWidth)/2 : px.x+layout.padding;
        var baselineY = cursorY+lineMaxFont;
        // V3 Phase 2 Round 4 — 실제 판매 썸네일 참고 자료 다수가 공통으로 쓰는
        // 장치: 헤드라인 안의 숫자(월 3,000만원 / 10억 / 2배 등)를 나머지
        // 텍스트와 다른 색+더 큰 크기로 강조해 "혜택/근거"가 한눈에 들어오게
        // 한다. 어떤 단어가 핵심인지 추측하지 않고, 카피 안에 이미 있는
        // 객관적 신호(숫자)만 강조한다. 테마가 numberEmphasis:false면(예:
        // Publisher Premium의 절제된 정체성) 기존처럼 단색·단일 크기로 그린다.
        if(options.numberEmphasis){
          OE.splitHeadlineEmphasis(line).forEach(function(seg){
            if(!seg.text) return;
            ctx.font = segFont(seg.emphasis ? emphFontSize : baseFontSize);
            if(invertedPill){
              // Round 5: 패널 색 자체가 accentHex일 수 있어(예: splitPanel) 그
              // 위에 accentHex로 강조하면 안 보인다 — 대신 강조 구간만 완전
              // 불투명, 나머지는 살짝 옅게 해 "같은 색 안에서" 대비를 만든다.
              ctx.globalAlpha = seg.emphasis ? 1 : 0.72;
              ctx.fillStyle = textPick.color;
            }else{
              ctx.globalAlpha = 1;
              ctx.fillStyle = seg.emphasis ? accentHex : textPick.color;
            }
            ctx.fillText(seg.text, segX, baselineY);
            segX += ctx.measureText(seg.text).width;
          });
          ctx.globalAlpha = 1;
        }else{
          ctx.font = segFont(baseFontSize);
          ctx.fillStyle = textPick.color;
          ctx.fillText(line, segX, baselineY);
        }
        cursorY += lineMaxFont*1.22;
      });
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      if('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    if(copy.subheadline && layout.subSize){
      ctx.font = '600 '+layout.subSize+'px '+FONT_FAMILY;
      ctx.fillStyle = textPick.color;
      ctx.globalAlpha = 0.92;
      ctx.textAlign = 'left';
      var subLineX = textAlign==='center' ? px.x+(px.w-ctx.measureText(copy.subheadline).width)/2 : px.x+layout.padding;
      ctx.fillText(copy.subheadline, subLineX, cursorY+layout.subSize);
      ctx.globalAlpha = 1;
      cursorY += layout.subSize*1.3 + layout.gapSm;
    }
    if(copy.cta && layout.ctaH){
      var ctaPadX = Math.round(layout.ctaH*0.5);
      ctx.font = '800 '+layout.ctaSize+'px '+FONT_FAMILY;
      var ctaW = ctx.measureText(copy.cta).width + ctaPadX*2;
      var ctaX = textAlign==='center' ? px.x+(px.w-ctaW)/2 : px.x+layout.padding;
      var ctaY = Math.min(cursorY+layout.gapSm, px.y+px.h-layout.ctaH-layout.padding*0.5);
      ctx.fillStyle = ctaFillColor;
      // V3 Phase 2 Round 3(품질 튜닝): CTA는 실제로 눌러야 하는 버튼이므로
      // 뱃지보다 살짝 더 뚜렷한 그림자로 "누를 수 있는 표면"임을 시각적으로
      // 강조한다.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.28)';
      ctx.shadowBlur = Math.max(3, Math.round(width*0.011));
      ctx.shadowOffsetY = Math.max(1, Math.round(width*0.0038));
      pathRoundRect(ctx, ctaX, ctaY, ctaW, layout.ctaH, layout.ctaH*geometry.cornerRatio);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = ctaLabelColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.cta, ctaX+ctaW/2, ctaY+layout.ctaH/2+1);
      ctx.textBaseline = 'alphabetic';
    }
    return { canvas: canvas, dataUrl: canvas.toDataURL('image/png'), width: width, height: height, analysis: analysis, layoutFamily: family };
  };

})(window.AtlasOverlayEngine);
