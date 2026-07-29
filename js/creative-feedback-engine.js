/* creative-feedback-engine.js — Milestone 3.2 Phase 13: Claude Design Creative
   Feedback Engine (Image Quality Optimization, not Prompt Engineering)

   이 Engine은 Prompt 문자열을 평가하지 않는다. 반드시 Claude Design이 실제로
   생성한 이미지(image.source==='claude-design')를 입력으로 받아야만 평가를
   실행한다. 실제 이미지가 없으면 evaluationStatus:'waiting-for-real-image'로
   표시하고 점수를 만들지 않는다(Mock/Placeholder/SVG 테스트 이미지 금지).

   Phase 11.5(AI Visual Prompt Engine)/Phase 12.x(Creative Campaign Engine)의
   결과는 읽기 전용 입력으로만 사용하고 절대 재계산하거나 mutate하지 않는다.

   내부 구조: Input Validator → Image Metadata Inspector → Image Decode
   Validator → Visual Region Detector → Product Detector → Subject Detector →
   Safe Area Analyzer → Composition Analyzer → Background Complexity Analyzer →
   Color and Lighting Analyzer → Brand Consistency Analyzer → Artifact
   Detector → Creative Score Calculator → Diagnosis Builder → Specific Fix
   Director → Retry Prompt Builder → Creative History Manager → Best Version
   Selector → Reasoning Service.

   정직성 원칙(사용자 스펙 §5/§15): 브라우저 Canvas 픽셀 분석으로 실제 측정
   가능한 항목(밝기/대비/엣지 밀도/색상 분포/Safe Area 복잡도 등)만
   status:'evaluated'로 표시한다. 손가락 개수/얼굴 왜곡/실제 상품처럼
   보이는지/Scroll-Stopping Power/감정 전달처럼 이 환경에서 신뢰성 있게
   측정할 수 없는 항목은 status:'not-evaluable'로 정직하게 표시하거나,
   Claude Code가 이미지를 직접 보고 작성한 구조화 평가(claudeVisualAssessment)
   또는 사용자 수동 평가(userReview)가 주어졌을 때만 그 값을 사용한다.
   자동 점수와 사용자 점수는 절대 무단으로 섞지 않는다(§16, Combined Decision
   규칙은 아래 CFE.combineDecision에 명시). */

window.AtlasCreativeFeedbackEngine = window.AtlasCreativeFeedbackEngine || {};

(function(CFE){

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
  function round1(n){ return Math.round(n*10)/10; }
  function nowTs(){ return Date.now(); }

  /* ══════════════════════════════════════════════════════════════
     1. Input Validator — 실제 Claude Design 이미지가 아니면 평가를 아예
        시작하지 않는다. Mock/Placeholder/SVG 테스트 이미지 금지.
     ══════════════════════════════════════════════════════════════ */
  var ALLOWED_ASSET_TYPES = ['thumbnail', 'sales-page-hero'];
  var ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  CFE.inputValidator = function(input){
    var errors = [];
    input = input || {};
    if(ALLOWED_ASSET_TYPES.indexOf(input.assetType) === -1) errors.push('assetType은 "thumbnail" 또는 "sales-page-hero"여야 합니다.');
    if(!input.campaignId) errors.push('campaignId가 필요합니다.');
    if(!input.conceptId) errors.push('conceptId가 필요합니다.');
    if(!input.creativeCampaign) errors.push('creativeCampaign(Phase 12 결과)이 필요합니다.');
    if(!input.originalPrompt) errors.push('originalPrompt가 필요합니다.');

    var image = input.image;
    if(!image || !image.source){
      return { valid:false, evaluationStatus:'waiting-for-real-image', errors: errors.concat(['image가 없습니다. 실제 Claude Design 결과 이미지를 업로드해야 평가할 수 있습니다.']) };
    }
    if(image.source !== 'claude-design'){
      return { valid:false, evaluationStatus:'waiting-for-real-image', errors: errors.concat(['image.source가 "claude-design"이 아닙니다 — 실제 Claude Design 결과 이미지만 평가 대상입니다. (받은 값: '+JSON.stringify(image.source)+')']) };
    }
    if(ALLOWED_MIME_TYPES.indexOf(image.mimeType) === -1){
      errors.push('지원하지 않는 mimeType입니다: '+image.mimeType+' (허용: '+ALLOWED_MIME_TYPES.join(', ')+')');
    }
    if(!image.width || !image.height || image.width<=0 || image.height<=0){
      errors.push('image.width/height가 유효하지 않습니다.');
    }
    if(!image.importedAt){
      errors.push('image.importedAt(가져온 시각)이 필요합니다.');
    }
    if(errors.length){
      return { valid:false, evaluationStatus:'invalid-input', errors: errors };
    }
    return { valid:true, evaluationStatus:'pending', errors:[] };
  };

  /* ══════════════════════════════════════════════════════════════
     2. Image Metadata Inspector / Decode Validator
        실제 디코딩(브라우저 Canvas)은 UI 레이어(ai-planner.js)에서 File →
        Image → Canvas로 수행하고, 그 결과(ImageData 유사 객체: {data, width,
        height})만 이 Engine에 순수 함수 입력으로 넘긴다. 이렇게 분리해야
        Node 환경(DOM 없음)에서도 픽셀 수학 함수를 결정론적으로 테스트할 수
        있다 — Engine 자체는 "이미 디코딩된 픽셀"만 다루고, "파일이 실제로
        디코딩 가능한가"는 별도 신호(decoded:boolean)로 받는다.
     ══════════════════════════════════════════════════════════════ */
  var PNG_SIGNATURE = [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
  var JPEG_SIGNATURE = [0xFF,0xD8,0xFF];
  var WEBP_RIFF = [0x52,0x49,0x46,0x46];
  /* 매직 바이트만으로 "이 파일이 선언된 mimeType과 실제로 일치하는 이미지
     포맷인가"를 판별한다(완전한 디코딩 성공을 보장하진 않지만, 위조/손상된
     파일을 상당수 걸러낼 수 있는 실제 검증이다 — 문자열 확장자만 믿지 않음). */
  function bytesMatch(bytes, sig){
    for(var i=0;i<sig.length;i++){ if(bytes[i]!==sig[i]) return false; }
    return true;
  }
  CFE.imageDecodeValidator = function(headerBytes, mimeType){
    if(!headerBytes || headerBytes.length<8) return { decoded:false, reason:'파일 헤더를 읽을 수 없습니다(파일이 비어있거나 너무 작음).' };
    var bytes = Array.prototype.slice.call(headerBytes, 0, 12);
    if(mimeType==='image/png' && !bytesMatch(bytes, PNG_SIGNATURE)) return { decoded:false, reason:'선언된 mimeType은 image/png이지만 실제 파일 시그니처가 PNG가 아닙니다.' };
    if(mimeType==='image/jpeg' && !bytesMatch(bytes, JPEG_SIGNATURE)) return { decoded:false, reason:'선언된 mimeType은 image/jpeg이지만 실제 파일 시그니처가 JPEG가 아닙니다.' };
    if(mimeType==='image/webp' && !bytesMatch(bytes, WEBP_RIFF)) return { decoded:false, reason:'선언된 mimeType은 image/webp이지만 실제 파일 시그니처가 RIFF/WEBP가 아닙니다.' };
    return { decoded:true, reason:null };
  };

  /* ══════════════════════════════════════════════════════════════
     3. 픽셀 수학(순수 함수) — Color/Lighting/Background Complexity/Safe
        Area/Composition Analyzer가 공통으로 쓰는 결정론적 측정값 계산.
        imageData = { data: Uint8ClampedArray(RGBA), width, height } —
        브라우저에서는 CanvasRenderingContext2D.getImageData()의 실제 반환값,
        Node 테스트에서는 이 구조를 그대로 흉내낸(합성 픽셀) 입력을 준다
        (실제 Claude Design 이미지라고 주장하지 않음 — 순수 수학 함수 검증용).
     ══════════════════════════════════════════════════════════════ */
  function luminance(r,g,b){ return 0.2126*r + 0.7152*g + 0.0722*b; }
  function regionBounds(rect, width, height){
    var x0 = clamp(Math.round((rect.x||0)*width), 0, width-1);
    var y0 = clamp(Math.round((rect.y||0)*height), 0, height-1);
    var x1 = clamp(Math.round(((rect.x||0)+(rect.w!=null?rect.w:1))*width), x0+1, width);
    var y1 = clamp(Math.round(((rect.y||0)+(rect.h!=null?rect.h:1))*height), y0+1, height);
    return { x0:x0, y0:y0, x1:x1, y1:y1 };
  }
  /* 밝기 평균/표준편차 — 노출 과다/부족, 대비 판단의 실제 근거 */
  CFE.computeLuminanceStats = function(imageData, rect){
    var b = regionBounds(rect||{x:0,y:0,w:1,h:1}, imageData.width, imageData.height);
    var sum = 0, count = 0;
    var values = [];
    for(var y=b.y0; y<b.y1; y++){
      for(var x=b.x0; x<b.x1; x++){
        var idx = (y*imageData.width + x)*4;
        var l = luminance(imageData.data[idx], imageData.data[idx+1], imageData.data[idx+2]);
        values.push(l); sum += l; count++;
      }
    }
    var mean = count ? sum/count : 0;
    var variance = count ? values.reduce(function(s,v){ return s+(v-mean)*(v-mean); },0)/count : 0;
    return { meanLuminance: round1(mean), stdDevLuminance: round1(Math.sqrt(variance)), sampleCount: count };
  };
  /* 엣지 밀도(Sobel 근사) — 배경 복잡도/모바일 가독성/Safe Area 분석의 실제
     근거. 진짜 객체 인식이 아니라 "픽셀 밝기 변화가 많은 영역인가"라는
     결정론적 근사임을 각 Analyzer의 status/label에 명시한다. */
  CFE.computeEdgeDensity = function(imageData, rect){
    var b = regionBounds(rect||{x:0,y:0,w:1,h:1}, imageData.width, imageData.height);
    var w = imageData.width, data = imageData.data;
    var edgeSum = 0, count = 0;
    /* 중심-대칭(x-1 vs x+1) 차분은 정확히 주기 2인 패턴(한 픽셀씩 교대)에서
       좌우 값이 같아져 gradient가 0으로 앨리어싱되는 실제 결함이 있었다
       (합성 테스트로 발견). 바로 다음 픽셀과의 순방향 차분(x vs x+1)으로
       바꿔 이 사각지대를 없앤다 — 실제 사진 이미지에서는 결과가 근사적으로
       동일하되, 인접 픽셀 교대 패턴에서도 정확히 측정된다. */
    for(var y=Math.max(b.y0,0); y<Math.min(b.y1, imageData.height-1); y++){
      for(var x=Math.max(b.x0,0); x<Math.min(b.x1, w-1); x++){
        var i = (y*w+x)*4, iR = (y*w+x+1)*4, iD = ((y+1)*w+x)*4;
        var lC = luminance(data[i],data[i+1],data[i+2]);
        var gx = luminance(data[iR],data[iR+1],data[iR+2]) - lC;
        var gy = luminance(data[iD],data[iD+1],data[iD+2]) - lC;
        var mag = Math.sqrt(gx*gx+gy*gy);
        edgeSum += mag; count++;
      }
    }
    var avg = count ? edgeSum/count : 0;
    /* 0~255 스케일 gradient 평균을 0~1로 정규화(경험적 상한 96 — 완전
       노이즈/체크무늬 이미지가 대략 90~120대에 도달하는 것을 기준으로 캘리브레이션). */
    return { rawAverage: round1(avg), normalizedDensity: round1(clamp(avg/96, 0, 1)), sampleCount: count };
  };
  /* 색상 분포 — 팔레트 과다/부족 판단의 실제 근거(단순 양자화 히스토그램) */
  CFE.computeColorHistogram = function(imageData, bucketsPerChannel){
    bucketsPerChannel = bucketsPerChannel || 4;
    var step = 256/bucketsPerChannel;
    var hist = {};
    var data = imageData.data;
    for(var i=0;i<data.length;i+=4){
      var r = Math.floor(data[i]/step), g = Math.floor(data[i+1]/step), b = Math.floor(data[i+2]/step);
      var key = r+'-'+g+'-'+b;
      hist[key] = (hist[key]||0)+1;
    }
    var buckets = Object.keys(hist).map(function(k){ return { key:k, count:hist[k] }; }).sort(function(a,b2){ return b2.count-a.count; });
    var totalPixels = data.length/4;
    return { distinctBuckets: buckets.length, dominantBuckets: buckets.slice(0,5).map(function(b2){ return { key:b2.key, ratio: round1(b2.count/totalPixels*100) }; }) };
  };
  /* 초점 중심(edge-energy 가중 중심) — 실제 saliency 모델이 아니라 "밝기
     변화가 강한 픽셀이 어디에 몰려있는가"의 근사. 기하학적 중심과의 거리로
     "시선이 한 곳에 모이는가"를 대략 추정한다(Visual Focus/Composition). */
  CFE.computeFocalCentroid = function(imageData){
    var w = imageData.width, h = imageData.height, data = imageData.data;
    var sumX = 0, sumY = 0, sumW = 0;
    for(var y=1;y<h-1;y+=2){
      for(var x=1;x<w-1;x+=2){
        var i=(y*w+x)*4, iR=(y*w+x+1)*4, iD=((y+1)*w+x)*4;
        var lC = luminance(data[i],data[i+1],data[i+2]);
        var gx = luminance(data[iR],data[iR+1],data[iR+2]) - lC;
        var gy = luminance(data[iD],data[iD+1],data[iD+2]) - lC;
        var mag = Math.sqrt(gx*gx+gy*gy);
        sumX += x*mag; sumY += y*mag; sumW += mag;
      }
    }
    if(sumW===0) return { centroidX:0.5, centroidY:0.5, centerDistance:0 };
    var cx = sumX/sumW/w, cy = sumY/sumW/h;
    var dist = Math.sqrt(Math.pow(cx-0.5,2)+Math.pow(cy-0.5,2));
    return { centroidX: round1(cx*100)/100, centroidY: round1(cy*100)/100, centerDistance: round1(dist*100)/100 };
  };

  /* ══════════════════════════════════════════════════════════════
     4. 17개 평가 항목의 evaluability 정책 — 각 카테고리가 (a) 픽셀 수학으로
        근사 측정 가능한지, (b) claudeVisualAssessment(Claude Code가 이미지를
        직접 보고 작성한 구조화 평가)가 있어야만 평가 가능한지, (c) 현재
        환경에서 원천적으로 not-evaluable인지 명시한다. 임의 점수를 주지
        않는다(§5/§15).
     ══════════════════════════════════════════════════════════════ */
  var CATEGORY_WEIGHTS = {
    productVisibility: 10, productQuality: 8, subjectVisibility: 5, productScale: 7,
    thumbnailReadability: 10, mobileReadability: 8, scrollStoppingPower: 10, visualFocus: 8,
    backgroundComplexity: 5, safeArea: 8, overlayReadiness: 5, brandConsistency: 5,
    lightingQuality: 3, colorHarmony: 3, emotionalImpact: 3, campaignConsistency: 2
  };
  var CATEGORY_LABEL = {
    productVisibility:'Product Visibility', productQuality:'Product Quality', subjectVisibility:'Subject Visibility',
    productScale:'Product Scale', thumbnailReadability:'Thumbnail Readability', mobileReadability:'Mobile Readability',
    scrollStoppingPower:'Scroll-Stopping Power', visualFocus:'Visual Focus', backgroundComplexity:'Background Complexity',
    safeArea:'Safe Area', overlayReadiness:'Overlay Readiness', brandConsistency:'Brand Consistency',
    lightingQuality:'Lighting Quality', colorHarmony:'Color Harmony', emotionalImpact:'Emotional Impact',
    campaignConsistency:'Campaign Consistency'
  };
  /* 픽셀 수학만으로 "근사(approximate) 측정"이 가능한 항목 — 실제 객체/의미
     인식이 아니라 밝기·엣지·색상 분포 기반 근사임을 diagnosis에 항상 명시. */
  var PIXEL_APPROXIMATE_CATEGORIES = ['thumbnailReadability','mobileReadability','visualFocus','backgroundComplexity','safeArea','overlayReadiness','brandConsistency','lightingQuality','colorHarmony','campaignConsistency'];
  /* claudeVisualAssessment(있을 때만) 또는 userReview로만 평가 가능 — 픽셀
     수학으로는 원천적으로 측정 불가(의미/객체 인식 필요). */
  var SEMANTIC_ONLY_CATEGORIES = ['productVisibility','productQuality','subjectVisibility','productScale','scrollStoppingPower','emotionalImpact'];

  /* ══════════════════════════════════════════════════════════════
     5. Safe Area / Background Complexity / Lighting / Color / Composition /
        Campaign Consistency Analyzer — 전부 순수 픽셀 수학 기반.
     ══════════════════════════════════════════════════════════════ */
  CFE.safeAreaAnalyzer = function(imageData, safeAreaRect){
    if(!safeAreaRect) return { status:'not-evaluable', reason:'Blueprint에 Safe Area 좌표 정보가 없습니다.' };
    var edge = CFE.computeEdgeDensity(imageData, safeAreaRect);
    var lum = CFE.computeLuminanceStats(imageData, safeAreaRect);
    return { status:'evaluated', approximate:true, edgeDensity: edge.normalizedDensity, meanLuminance: lum.meanLuminance, stdDevLuminance: lum.stdDevLuminance };
  };
  CFE.backgroundComplexityAnalyzer = function(imageData, excludeRect){
    var full = CFE.computeEdgeDensity(imageData, {x:0,y:0,w:1,h:1});
    var result = { status:'evaluated', approximate:true, overallEdgeDensity: full.normalizedDensity };
    if(excludeRect){
      var focus = CFE.computeEdgeDensity(imageData, excludeRect);
      result.focusRegionEdgeDensity = focus.normalizedDensity;
    }
    return result;
  };
  CFE.colorAndLightingAnalyzer = function(imageData){
    var lum = CFE.computeLuminanceStats(imageData);
    var hist = CFE.computeColorHistogram(imageData);
    return {
      status:'evaluated', approximate:true,
      meanLuminance: lum.meanLuminance, stdDevLuminance: lum.stdDevLuminance,
      distinctColorBuckets: hist.distinctBuckets, dominantColors: hist.dominantBuckets,
      overexposed: lum.meanLuminance>235, underexposed: lum.meanLuminance<20, lowContrast: lum.stdDevLuminance<15
    };
  };
  CFE.compositionAnalyzer = function(imageData){
    var centroid = CFE.computeFocalCentroid(imageData);
    return { status:'evaluated', approximate:true, centroidX:centroid.centroidX, centroidY:centroid.centroidY, centerDistance:centroid.centerDistance };
  };
  /* Brand Consistency — BrandStrategy가 선언한 참조 팔레트(있는 경우)와 실제
     이미지 지배색의 거리로 "색은" 측정 가능하나, "Authority/Trust/Relationship
     느낌"의 의미적 일치는 not-evaluable임을 분리해서 남긴다. */
  CFE.brandConsistencyAnalyzer = function(imageData, referencePalette){
    var hist = CFE.computeColorHistogram(imageData);
    if(!referencePalette || !referencePalette.length){
      return { status:'evaluated', approximate:true, colorAlignment:null, semanticAlignment:'not-evaluable', note:'참조 팔레트가 없어 색상 일치도만으로는 비교할 수 없습니다(의미적 일치는 항상 not-evaluable).' };
    }
    return { status:'evaluated', approximate:true, dominantColors: hist.dominantBuckets, semanticAlignment:'not-evaluable', note:'색상 거리만 근사 측정. Authority/Trust/Relationship 같은 의미적 일치는 픽셀 수학으로 판단할 수 없습니다.' };
  };
  /* Campaign Consistency — 이전 버전 이미지의 픽셀 데이터가 있을 때만
     팔레트/밝기 프로파일을 비교(주인공 동일성 같은 의미 판단은 not-evaluable). */
  CFE.campaignConsistencyAnalyzer = function(imageData, previousImageData){
    if(!previousImageData) return { status:'not-applicable', reason:'첫 Version이라 비교할 이전 버전이 없습니다.' };
    var histA = CFE.computeColorHistogram(imageData), histB = CFE.computeColorHistogram(previousImageData);
    var lumA = CFE.computeLuminanceStats(imageData), lumB = CFE.computeLuminanceStats(previousImageData);
    var lumDiff = Math.abs(lumA.meanLuminance-lumB.meanLuminance);
    return { status:'evaluated', approximate:true, luminanceDiff: round1(lumDiff), paletteBucketsA: histA.distinctBuckets, paletteBucketsB: histB.distinctBuckets, note:'팔레트/밝기 프로파일만 근사 비교. 주인공·상품 목업의 동일성(의미적 판단)은 not-evaluable입니다.' };
  };

  /* ══════════════════════════════════════════════════════════════
     6. Visual Region / Product / Subject Detector, Artifact Detector —
        claudeVisualAssessment(있을 때만 사용)가 없으면 전부 not-evaluable.
        임의 값을 만들지 않는다.
     ══════════════════════════════════════════════════════════════ */
  CFE.productDetector = function(claudeVisualAssessment){
    if(!claudeVisualAssessment || claudeVisualAssessment.productFrameRatio==null){
      return { status:'not-evaluable', reason:'현재 환경에서 픽셀 분석만으로 상품(전자책 목업)의 위치·크기를 신뢰성 있게 인식할 수 없습니다. claudeVisualAssessment.productFrameRatio가 필요합니다.' };
    }
    return { status:'evaluated', source:'claude-visual-assessment', frameRatio: claudeVisualAssessment.productFrameRatio, position: claudeVisualAssessment.productPosition||null, distorted: !!claudeVisualAssessment.productDistorted };
  };
  CFE.subjectDetector = function(claudeVisualAssessment){
    if(!claudeVisualAssessment || claudeVisualAssessment.subjectVisible==null){
      return { status:'not-evaluable', reason:'현재 환경에서 픽셀 분석만으로 인물의 표정·행동을 인식할 수 없습니다. claudeVisualAssessment.subjectVisible이 필요합니다.' };
    }
    return { status:'evaluated', source:'claude-visual-assessment', visible: !!claudeVisualAssessment.subjectVisible, blocksProduct: !!claudeVisualAssessment.subjectBlocksProduct };
  };
  var ARTIFACT_CODES = ['distortedHands','fingerErrors','faceDistortion','eyeDistortion','brokenText','randomCharacters','brokenUI','mockupDistortion','abnormalPerspective','abnormalShadow','duplicatedBodyParts','croppedFace','oddObjectFusion','fakeLogo','unwantedWatermark'];
  CFE.artifactDetector = function(claudeVisualAssessment){
    if(!claudeVisualAssessment || !claudeVisualAssessment.artifacts){
      return { status:'not-evaluable', reason:'Claude Design Artifact(이상한 손/얼굴 왜곡/깨진 글자 등)는 ML 기반 인식이 필요해 현재 픽셀 분석만으로 탐지할 수 없습니다. claudeVisualAssessment.artifacts가 필요합니다.', detected:[] };
    }
    var detected = (claudeVisualAssessment.artifacts||[]).filter(function(a){ return ARTIFACT_CODES.indexOf(a.code)>=0; });
    var severeCount = detected.filter(function(a){ return a.severity==='severe'; }).length;
    return { status:'evaluated', source:'claude-visual-assessment', detected: detected, severeCount: severeCount };
  };

  /* ══════════════════════════════════════════════════════════════
     7. Creative Score Calculator — evaluated 카테고리의 weight 합만으로
        정규화한다(not-evaluable은 총점 계산에서 완전히 제외 — 임의 감점/가점
        없음). Hard Fail이 있으면 grade는 무조건 'rejected'.
     ══════════════════════════════════════════════════════════════ */
  var HARD_FAIL_RULES = [
    { code:'DECODE_FAILED', test: function(ctx){ return ctx.decodeResult && ctx.decodeResult.decoded===false; }, label:'이미지 디코딩 실패' },
    { code:'NOT_CLAUDE_DESIGN_SOURCE', test: function(ctx){ return ctx.image && ctx.image.source!=='claude-design'; }, label:'Claude Design source 확인 불가' },
    { code:'PRODUCT_OUT_OF_FRAME', test: function(ctx){ return ctx.productResult && ctx.productResult.status==='evaluated' && ctx.productResult.frameRatio<=0.02; }, label:'상품 전체가 프레임 밖' },
    { code:'SAFE_AREA_NONE', test: function(ctx){ return ctx.safeAreaResult && ctx.safeAreaResult.status==='evaluated' && ctx.safeAreaResult.edgeDensity>=0.9; }, label:'Safe Area 전혀 없음(전체가 시각적으로 매우 복잡함)' },
    { code:'ARTIFACT_SEVERE', test: function(ctx){ return ctx.artifactResult && ctx.artifactResult.status==='evaluated' && ctx.artifactResult.severeCount>=1; }, label:'심각한 얼굴·손 왜곡 또는 다수의 깨진 임의 문자' },
    { code:'MOCKUP_BROKEN', test: function(ctx){ return ctx.productResult && ctx.productResult.status==='evaluated' && ctx.productResult.distorted===true; }, label:'전자책 목업이 심하게 깨짐' }
  ];
  CFE.evaluateHardFail = function(ctx){
    var triggered = HARD_FAIL_RULES.filter(function(r){ return r.test(ctx); }).map(function(r){ return { code:r.code, label:r.label }; });
    return { hardFail: triggered.length>0, reasons: triggered };
  };
  function scoreCategoryFromMeasurement(key, evaluatorResult){
    /* 각 근사 Analyzer 결과를 0~10 스케일로 변환하는 결정론적 규칙.
       "임의 점수"가 아니라 실제 측정값(edgeDensity/luminance 등)에 대한
       고정 함수임을 diagnosis의 measurements 필드로 항상 함께 남긴다. */
    if(!evaluatorResult || evaluatorResult.status!=='evaluated') return null;
    switch(key){
      case 'backgroundComplexity': return clamp(10-(evaluatorResult.overallEdgeDensity*10), 0, 10);
      case 'safeArea': return clamp(10-(evaluatorResult.edgeDensity*10), 0, 10);
      case 'overlayReadiness': return clamp(10-(evaluatorResult.edgeDensity*10)*0.9, 0, 10);
      case 'lightingQuality': {
        var penalty = (evaluatorResult.overexposed||evaluatorResult.underexposed ? 4 : 0) + (evaluatorResult.lowContrast ? 3 : 0);
        return clamp(10-penalty, 0, 10);
      }
      case 'colorHarmony': return clamp(10-clamp((evaluatorResult.distinctColorBuckets-8)/4,0,6), 0, 10);
      case 'visualFocus': return clamp(10-(evaluatorResult.centerDistance*20), 0, 10);
      case 'thumbnailReadability': return clamp(10-(evaluatorResult.overallEdgeDensity!=null?evaluatorResult.overallEdgeDensity*8:0), 0, 10);
      case 'mobileReadability': return clamp(10-(evaluatorResult.overallEdgeDensity!=null?evaluatorResult.overallEdgeDensity*9:0), 0, 10);
      case 'brandConsistency': return evaluatorResult.colorAlignment==null ? 6 : clamp(evaluatorResult.colorAlignment*10, 0, 10);
      case 'campaignConsistency': return evaluatorResult.luminanceDiff!=null ? clamp(10-evaluatorResult.luminanceDiff/8, 0, 10) : null;
      default: return null;
    }
  }
  CFE.creativeScoreCalculator = function(categoryResults){
    var breakdown = [];
    var evaluatedWeightSum = 0, achievedWeightedScore = 0;
    Object.keys(CATEGORY_WEIGHTS).forEach(function(key){
      var weight = CATEGORY_WEIGHTS[key];
      var result = categoryResults[key];
      var status = result && result.status ? result.status : 'not-evaluable';
      var score = null, maxScore = 10;
      if(status==='evaluated'){
        score = result.score!=null ? result.score : scoreCategoryFromMeasurement(key, result);
      }
      if(status==='evaluated' && score!=null){
        evaluatedWeightSum += weight;
        achievedWeightedScore += (score/maxScore)*weight;
      }
      breakdown.push({ category: CATEGORY_LABEL[key], key:key, weight:weight, status: score!=null?'evaluated':(status==='not-applicable'?'not-applicable':'not-evaluable'), score: score, maxScore: maxScore, measurements: result ? (result.measurements||result) : null, reason: result ? result.reason : '측정 입력이 없습니다.' });
    });
    var automatedScore = evaluatedWeightSum>0 ? Math.round((achievedWeightedScore/evaluatedWeightSum)*100) : null;
    return {
      automatedScore: automatedScore,
      evaluatedWeight: evaluatedWeightSum,
      totalPossibleWeight: 100,
      coveragePercent: round1(evaluatedWeightSum),
      breakdown: breakdown
    };
  };

  var GRADE_THRESHOLDS = [ [80,'excellent'], [60,'good'], [40,'needs-revision'], [0,'poor'] ];
  CFE.scoreToGrade = function(automatedScore, hardFail){
    if(hardFail) return 'rejected';
    if(automatedScore==null) return 'not-scored';
    for(var i=0;i<GRADE_THRESHOLDS.length;i++){ if(automatedScore>=GRADE_THRESHOLDS[i][0]) return GRADE_THRESHOLDS[i][1]; }
    return 'poor';
  };

  /* ══════════════════════════════════════════════════════════════
     8. Diagnosis Builder / Specific Fix Director — 절대 추상적 문구("Make it
        better")를 쓰지 않는다. 항상 issueCode/category/diagnosis/cause/
        specificFix/priority/affectedRegion/measurableTarget 구조를 채운다.
     ══════════════════════════════════════════════════════════════ */
  var BANNED_VAGUE_PHRASES = ['make it better', 'improve quality', 'make it premium', 'enhance composition', 'add more impact', 'more premium', 'more professional'];
  function assertNotVague(text){
    var lower = String(text||'').toLowerCase();
    return !BANNED_VAGUE_PHRASES.some(function(p){ return lower.indexOf(p)>=0; });
  }
  CFE.diagnosisBuilder = function(categoryResults, breakdown){
    var diagnoses = [];
    function push(issueCode, category, diagnosis, cause, specificFix, priority, affectedRegion, measurableTarget){
      diagnoses.push({ issueCode:issueCode, category:category, diagnosis:diagnosis, cause:cause, specificFix:specificFix, priority:priority, affectedRegion:affectedRegion, measurableTarget:measurableTarget });
    }
    var bg = categoryResults.backgroundComplexity;
    if(bg && bg.status==='evaluated' && bg.overallEdgeDensity>0.45){
      push('BACKGROUND_TOO_COMPLEX', 'Background Complexity',
        '배경의 엣지 밀도가 '+round1(bg.overallEdgeDensity*100)+'%로 측정되어 시각적으로 복잡합니다.',
        '배경에 불필요한 소품/질감/패턴이 많아 밝기 변화가 전체적으로 큽니다.',
        '배경의 장식 요소를 제거하고 단색 또는 낮은 대비의 단순한 배경으로 정리해 엣지 밀도를 25% 이하로 낮춥니다.',
        'high', 'background', 'background edge density 0.45 to 0.25 이하');
    }
    var sa = categoryResults.safeArea;
    if(sa && sa.status==='evaluated' && sa.edgeDensity>0.35){
      push('SAFE_AREA_TOO_BUSY', 'Safe Area',
        'Safe Area 영역의 엣지 밀도가 '+round1(sa.edgeDensity*100)+'%로 측정되어 headline/badge/CTA 오버레이 공간이 부족합니다.',
        'Safe Area로 지정된 영역에 소품/질감/패턴이 침범해 있습니다.',
        'Safe Area 영역을 단순한 배경(낮은 대비, 낮은 채도)으로 비우고 엣지 밀도를 20% 이하로 낮춥니다.',
        'high', 'safe-area', 'safe area edge density 0.35 to 0.20 이하');
    }
    var cl = categoryResults.colorAndLighting;
    if(cl && cl.status==='evaluated'){
      if(cl.overexposed) push('OVEREXPOSED', 'Lighting Quality', '이미지 평균 밝기가 '+cl.meanLuminance+'/255로 과다 노출되었습니다.', '조명 강도가 과도하게 설정되었습니다.', '전체 노출을 15~20% 낮추고 하이라이트 디테일을 복원합니다.', 'medium', 'full-frame', 'mean luminance 235 to 180-210');
      if(cl.underexposed) push('UNDEREXPOSED', 'Lighting Quality', '이미지 평균 밝기가 '+cl.meanLuminance+'/255로 노출 부족입니다.', '조명 강도가 과도하게 낮게 설정되었습니다.', '전체 노출을 15~20% 높이고 그림자 디테일을 복원합니다.', 'medium', 'full-frame', 'mean luminance 20 to 60-90');
      if(cl.lowContrast) push('LOW_CONTRAST', 'Color Harmony', '밝기 표준편차가 '+cl.stdDevLuminance+'로 대비가 낮습니다.', '조명과 피사체/배경 간 명암 차이가 부족합니다.', '핵심 피사체에 방향성 조명을 추가해 배경과의 명암 대비를 높입니다.', 'medium', 'full-frame', 'luminance stddev 15 미만 to 30 이상');
    }
    var comp = categoryResults.composition;
    if(comp && comp.status==='evaluated' && comp.centerDistance>0.25){
      push('OFF_CENTER_FOCUS', 'Visual Focus',
        '시각적 초점(엣지 에너지 중심)이 기하학적 중심에서 '+round1(comp.centerDistance*100)+'% 벗어나 있습니다.',
        '핵심 피사체/상품이 프레임 중심에서 크게 벗어나 배치되었습니다.',
        '핵심 피사체를 프레임 중심 20% 이내로 재배치하거나, 구도를 재조정해 시선이 한 곳에 모이게 합니다.',
        'medium', 'off-center', 'centroid distance 0.25 to 0.10 이하');
    }
    var pd = categoryResults.product;
    if(pd && pd.status==='evaluated'){
      if(pd.frameRatio!=null && pd.frameRatio<0.15){
        push('PRODUCT_TOO_SMALL', 'Product Visibility',
          '전자책 목업이 프레임의 약 '+round1(pd.frameRatio*100)+'%만 차지합니다.',
          '인물 또는 배경 요소가 프레임 대부분을 차지하고 상품이 뒤쪽/구석에 배치되었습니다.',
          '전자책 목업을 전경으로 이동하고 프레임의 35~45%를 차지하도록 확대합니다.',
          'high', 'product-region', 'product frame ratio 0.35 to 0.45');
      }
      if(pd.distorted){
        push('MOCKUP_DISTORTED', 'Product Quality', '전자책 목업의 표지/기기 perspective가 왜곡되어 보입니다.', 'Claude Design 생성 과정에서 목업 형태가 비정상적으로 렌더링되었습니다.', '목업을 정면에 가까운 3/4 시점으로 재요청하고 perspective distortion을 명시적으로 방지합니다.', 'high', 'product-region', 'perspective distortion 있음 to 없음');
      }
    }
    var sub = categoryResults.subject;
    if(sub && sub.status==='evaluated' && sub.blocksProduct){
      push('SUBJECT_BLOCKS_PRODUCT', 'Subject Visibility', '인물이 상품을 가리고 있습니다.', '인물 배치가 상품과 겹치는 구도로 생성되었습니다.', '인물을 프레임의 좌측 또는 우측 40%로 이동해 상품과 겹치지 않게 합니다.', 'medium', 'subject-region', 'subject-product overlap 있음 to 없음');
    }
    var art = categoryResults.artifact;
    if(art && art.status==='evaluated'){
      art.detected.forEach(function(a){
        push('ARTIFACT_'+a.code.toUpperCase(), 'Claude Design Artifact Detection', a.code+' 유형의 아티팩트가 감지되었습니다('+(a.severity||'unknown')+').', 'Claude Design 생성 과정에서 발생한 렌더링 오류입니다.', a.code+' 발생 부위를 재생성 대상으로 지정하고 해당 아티팩트를 명시적으로 금지하는 조건을 Retry Prompt에 포함합니다.', a.severity==='severe'?'high':'medium', a.region||'unspecified', a.code+' 발생 to 미발생');
      });
    }
    diagnoses.forEach(function(d){
      if(!assertNotVague(d.diagnosis) || !assertNotVague(d.specificFix)) throw new Error('Diagnosis에 금지된 추상 표현이 포함되었습니다: '+d.issueCode);
    });
    var priorityOrder = { high:0, medium:1, low:2 };
    diagnoses.sort(function(a,b){ return priorityOrder[a.priority]-priorityOrder[b.priority]; });
    return diagnoses;
  };

  /* ══════════════════════════════════════════════════════════════
     9. Retry Prompt Builder — 기존 Prompt를 덮어쓰지 않고 Preserve +
        Corrections + Artifact Prevention을 더한 새 문자열을 만든다.
     ══════════════════════════════════════════════════════════════ */
  var ARTIFACT_PREVENTION_LIST = [
    'distorted hands or extra/missing fingers', 'distorted or asymmetric facial features', 'distorted eyes',
    'broken or unreadable text', 'random characters inside the image', 'broken UI elements',
    'warped ebook mockup or device perspective', 'abnormal or inconsistent shadows', 'duplicated body parts',
    'cropped or cut-off faces', 'odd object fusion', 'fake logos', 'unwanted watermarks'
  ];
  CFE.retryPromptBuilder = function(originalPrompt, creativeCampaign, diagnoses){
    var dna = (creativeCampaign && creativeCampaign.campaignConsistency && creativeCampaign.campaignConsistency.visualDNA) || {};
    var preserve = [];
    if(dna.characterIdentity) preserve.push('the same '+dna.characterIdentity);
    if(dna.objectLanguage) preserve.push('the same '+dna.objectLanguage);
    if(dna.materialLanguage) preserve.push('the same '+dna.materialLanguage);
    if(dna.shapeLanguage) preserve.push('the same '+dna.shapeLanguage);
    if(dna.cameraLanguage) preserve.push('the same '+dna.cameraLanguage);
    if(dna.textureLanguage) preserve.push('the same '+dna.textureLanguage);
    if(dna.moodContinuity) preserve.push('the same '+dna.moodContinuity);
    if(creativeCampaign && creativeCampaign.primaryMedium) preserve.push('the same '+creativeCampaign.primaryMedium+' medium');
    if(!preserve.length) preserve.push('the original Visual DNA, subject identity, product mockup identity, palette, and lighting language exactly as approved');

    var corrections = (diagnoses||[]).map(function(d){ return d.specificFix; });
    var uniqueCorrections = Array.from(new Set(corrections));

    var lines = [];
    lines.push('Original direction remains unchanged.');
    lines.push('');
    lines.push('Preserve:');
    preserve.forEach(function(p){ lines.push('- '+p); });
    lines.push('');
    if(uniqueCorrections.length){
      lines.push('Correct:');
      uniqueCorrections.forEach(function(c){ lines.push('- '+c); });
      lines.push('');
    }
    lines.push('Do not use:');
    lines.push('- Make it better');
    lines.push('- More premium');
    lines.push('- More professional');
    lines.push('');
    lines.push('Artifact Prevention — prevent:');
    ARTIFACT_PREVENTION_LIST.forEach(function(a){ lines.push('- '+a); });
    lines.push('');
    lines.push('[Original Prompt Reference]');
    lines.push(originalPrompt);
    return lines.join('\n');
  };

  /* ══════════════════════════════════════════════════════════════
     10. Creative History Manager — 버전 누적, 중복 방지, Object URL 정리.
         APP.creativeFeedback 자체의 shape만 관리하고 저장(APP 소유)은
         호출부(ai-planner.js)가 담당한다(기존 저장/불러오기 로직 미변경).
     ══════════════════════════════════════════════════════════════ */
  CFE.createEmptyHistoryStore = function(){ return { version:'1.0', campaigns:{} }; };
  function fingerprint(bytesSample){
    // FNV-1a 32-bit — 암호학적 해시가 아니라 "같은 파일 재업로드 감지"용 경량 지문
    var hash = 0x811c9dc5;
    for(var i=0;i<bytesSample.length;i++){
      hash ^= bytesSample[i];
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
  }
  CFE.computeImageFingerprint = function(bytesSample){ return fingerprint(bytesSample); };

  CFE.creativeHistoryManager = {
    addVersion: function(store, campaignId, conceptId, assetType, versionRecord){
      store = store || CFE.createEmptyHistoryStore();
      var next = JSON.parse(JSON.stringify(store));
      if(!next.campaigns[campaignId]) next.campaigns[campaignId] = { assetType: assetType, conceptId: conceptId, versions: [], bestVersionNumber: null, manualBestVersionNumber: null, latestVersionNumber: 0, status:'in-progress' };
      var entry = next.campaigns[campaignId];
      var dup = entry.versions.filter(function(v){ return v.imageFingerprint && v.imageFingerprint===versionRecord.imageFingerprint; });
      if(dup.length){
        return { store: store, added:false, reason:'동일한 이미지(fingerprint 일치)가 이미 Version '+dup[0].versionNumber+'로 등록되어 있습니다 — 중복 등록을 방지했습니다.', duplicateOfVersion: dup[0].versionNumber };
      }
      var versionNumber = entry.latestVersionNumber + 1;
      var record = Object.assign({}, versionRecord, { versionNumber: versionNumber, createdAt: nowTs(), source:'claude-design' });
      entry.versions.push(record);
      entry.latestVersionNumber = versionNumber;
      return { store: next, added:true, versionNumber: versionNumber };
    },
    revokeObjectUrl: function(url){
      if(url && typeof URL!=='undefined' && URL.revokeObjectURL){ try{ URL.revokeObjectURL(url); }catch(e){} }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     11. Best Version Selector — 점수만으로 고르지 않는다(§12 6단계 규칙).
         수동 지정(manualBestVersionNumber)이 있으면 항상 그것을 우선한다.
     ══════════════════════════════════════════════════════════════ */
  CFE.bestVersionSelector = function(versions, manualBestVersionNumber){
    if(manualBestVersionNumber!=null){
      var manual = versions.filter(function(v){ return v.versionNumber===manualBestVersionNumber; })[0];
      if(manual) return { bestVersionNumber: manualBestVersionNumber, reason:'사용자가 수동으로 Version '+manualBestVersionNumber+'를 Best Version으로 지정했습니다(자동 선택보다 우선).', comparedVersions: versions.map(function(v){return v.versionNumber;}), selectionConfidence:'manual-override' };
    }
    var eligible = versions.filter(function(v){ return !(v.evaluation && v.evaluation.hardFail); });
    if(!eligible.length){
      return { bestVersionNumber: null, reason:'모든 Version이 Hard Fail 상태라 Best Version을 선택할 수 없습니다.', comparedVersions: versions.map(function(v){return v.versionNumber;}), selectionConfidence:'none' };
    }
    eligible.sort(function(a,b){
      var sa = (a.evaluation&&a.evaluation.automatedScore)||0, sb = (b.evaluation&&b.evaluation.automatedScore)||0;
      if(sb!==sa) return sb-sa;
      var artA = (a.evaluation&&a.evaluation.artifactCount)||0, artB = (b.evaluation&&b.evaluation.artifactCount)||0;
      if(artA!==artB) return artA-artB;
      var safeA = (a.evaluation&&a.evaluation.safeAreaScore)||0, safeB = (b.evaluation&&b.evaluation.safeAreaScore)||0;
      if(safeB!==safeA) return safeB-safeA;
      var pvA = (a.evaluation&&a.evaluation.productVisibilityScore)||0, pvB = (b.evaluation&&b.evaluation.productVisibilityScore)||0;
      if(pvB!==pvA) return pvB-pvA;
      return a.versionNumber-b.versionNumber; // 동점이면 더 이른(안정적) 버전 우선
    });
    var winner = eligible[0];
    return { bestVersionNumber: winner.versionNumber, reason:'Hard Fail 없음 + Creative Score 최고('+((winner.evaluation&&winner.evaluation.automatedScore)||'N/A')+') 기준으로 자동 선택되었습니다.', comparedVersions: versions.map(function(v){return v.versionNumber;}), selectionConfidence:'automatic' };
  };

  /* ══════════════════════════════════════════════════════════════
     12. Combined Decision — 자동 점수와 사용자 점수를 절대 수학적으로
         섞지 않는다. 자동 점수는 Grade/Best Version 산출의 유일한 기준이고,
         사용자 리뷰는 나란히 표시만 되며 수동 Best Version 지정으로만
         최종 결정에 개입할 수 있다(§16).
     ══════════════════════════════════════════════════════════════ */
  CFE.combineDecision = function(automatedScore, userReview){
    var userReviewScore = null;
    if(userReview){
      var keys = ['productVisibility','scrollStoppingPower','brandFit','emotionalImpact','artifactPresence','overallSalesQuality'];
      var vals = keys.map(function(k){ return userReview[k]; }).filter(function(v){ return typeof v==='number'; });
      if(vals.length) userReviewScore = Math.round(vals.reduce(function(s,v){return s+v;},0)/vals.length*10);
    }
    var divergenceWarning = null;
    if(automatedScore!=null && userReviewScore!=null && Math.abs(automatedScore-userReviewScore)>30){
      divergenceWarning = 'Automated Score와 User Review Score가 30점 이상 차이납니다 — 두 점수는 섞지 않고 각각 표시합니다.';
    }
    return {
      automatedScore: automatedScore,
      userReviewScore: userReviewScore,
      rule: 'Grade와 Best Version 자동 선택은 automatedScore만 사용합니다. userReviewScore는 참고용으로 나란히 표시되며, 수동 Best Version 지정을 통해서만 최종 결정에 반영됩니다(자동 점수와 수학적으로 합산되지 않음).',
      divergenceWarning: divergenceWarning
    };
  };

  /* ══════════════════════════════════════════════════════════════
     13. Run — 위 단계를 조합한다. Reasoning Service는 실제 평가가 수행된
         경우(evaluationStatus:'evaluated' 도달 시)에만 정확히 1회 호출한다.
     ══════════════════════════════════════════════════════════════ */
  CFE.run = function(rawInput){
    var validation = CFE.inputValidator(rawInput);
    if(!validation.valid){
      return { evaluationStatus: validation.evaluationStatus, errors: validation.errors, assetType: rawInput&&rawInput.assetType, campaignId: rawInput&&rawInput.campaignId, conceptId: rawInput&&rawInput.conceptId };
    }
    var input = rawInput;
    var image = input.image;
    var decodeResult = input.decodeResult || { decoded:true, reason:null };
    var imageData = input.imageData || null; // {data,width,height} — UI 레이어가 Canvas로 만들어 전달
    var claudeVisualAssessment = input.claudeVisualAssessment || null;
    var safeAreaRect = input.safeAreaRect || null;
    var productRegionRect = input.productRegionRect || null;
    var previousImageData = input.previousImageData || null;
    var referencePalette = input.referencePalette || null;

    var categoryResults = {};
    if(imageData && decodeResult.decoded){
      categoryResults.backgroundComplexity = CFE.backgroundComplexityAnalyzer(imageData, productRegionRect);
      categoryResults.safeArea = CFE.safeAreaAnalyzer(imageData, safeAreaRect);
      categoryResults.colorAndLighting = CFE.colorAndLightingAnalyzer(imageData);
      categoryResults.composition = CFE.compositionAnalyzer(imageData);
      categoryResults.brandConsistency = CFE.brandConsistencyAnalyzer(imageData, referencePalette);
      categoryResults.campaignConsistency = CFE.campaignConsistencyAnalyzer(imageData, previousImageData);
      categoryResults.thumbnailReadability = { status:'evaluated', approximate:true, overallEdgeDensity: categoryResults.backgroundComplexity.overallEdgeDensity };
      categoryResults.mobileReadability = { status:'evaluated', approximate:true, overallEdgeDensity: categoryResults.backgroundComplexity.overallEdgeDensity };
      categoryResults.visualFocus = categoryResults.composition;
      categoryResults.overlayReadiness = categoryResults.safeArea;
    } else {
      ['backgroundComplexity','safeArea','colorAndLighting','composition','brandConsistency','campaignConsistency','thumbnailReadability','mobileReadability','visualFocus','overlayReadiness'].forEach(function(k){
        categoryResults[k] = { status:'not-evaluable', reason:'imageData(디코딩된 픽셀)가 제공되지 않았습니다.' };
      });
    }
    categoryResults.product = CFE.productDetector(claudeVisualAssessment);
    categoryResults.subject = CFE.subjectDetector(claudeVisualAssessment);
    categoryResults.artifact = CFE.artifactDetector(claudeVisualAssessment);
    categoryResults.productVisibility = categoryResults.product.status==='evaluated' ? { status:'evaluated', score: clamp(categoryResults.product.frameRatio*20,0,10), reason:null } : { status:'not-evaluable', reason: categoryResults.product.reason };
    categoryResults.productQuality = categoryResults.product.status==='evaluated' ? { status:'evaluated', score: categoryResults.product.distorted?2:9, reason:null } : { status:'not-evaluable', reason: categoryResults.product.reason };
    categoryResults.productScale = categoryResults.productVisibility;
    categoryResults.subjectVisibility = categoryResults.subject.status==='evaluated' ? { status:'evaluated', score: categoryResults.subject.blocksProduct?4:9, reason:null } : { status:'not-evaluable', reason: categoryResults.subject.reason };
    categoryResults.scrollStoppingPower = claudeVisualAssessment && claudeVisualAssessment.scrollStoppingPower!=null ? { status:'evaluated', score: claudeVisualAssessment.scrollStoppingPower, reason:null } : { status:'not-evaluable', reason:'Scroll-Stopping Power(첫인상 임팩트)는 의미적 판단이 필요해 픽셀 분석만으로 측정할 수 없습니다.' };
    categoryResults.emotionalImpact = claudeVisualAssessment && claudeVisualAssessment.emotionalImpact!=null ? { status:'evaluated', score: claudeVisualAssessment.emotionalImpact, reason:null } : { status:'not-evaluable', reason:'감정 전달 여부는 의미적 판단이 필요해 픽셀 분석만으로 측정할 수 없습니다.' };

    var hardFailResult = CFE.evaluateHardFail({ decodeResult: decodeResult, image: image, productResult: categoryResults.product, safeAreaResult: categoryResults.safeArea, artifactResult: categoryResults.artifact });
    var scoreResult = CFE.creativeScoreCalculator(categoryResults);
    var grade = CFE.scoreToGrade(scoreResult.automatedScore, hardFailResult.hardFail);
    var diagnoses = CFE.diagnosisBuilder(categoryResults, scoreResult.breakdown);
    var retryPrompt = CFE.retryPromptBuilder(input.originalPrompt, input.creativeCampaign, diagnoses);
    var combined = CFE.combineDecision(scoreResult.automatedScore, input.userReview);

    var evaluation = {
      evaluationStatus: 'evaluated',
      assetType: input.assetType, campaignId: input.campaignId, conceptId: input.conceptId,
      automatedScore: scoreResult.automatedScore, coveragePercent: scoreResult.coveragePercent,
      grade: grade, hardFail: hardFailResult.hardFail, hardFailReasons: hardFailResult.reasons,
      breakdown: scoreResult.breakdown, diagnoses: diagnoses, retryPrompt: retryPrompt,
      artifactCount: (categoryResults.artifact.detected||[]).length,
      safeAreaScore: (function(){ var b = scoreResult.breakdown.filter(function(x){return x.key==='safeArea';})[0]; return b?b.score:null; })(),
      productVisibilityScore: (function(){ var b = scoreResult.breakdown.filter(function(x){return x.key==='productVisibility';})[0]; return b?b.score:null; })(),
      combined: combined,
      evaluatedAt: nowTs()
    };

    if(typeof AtlasReasoningService!=='undefined' && typeof AtlasReasoningService.reason==='function'){
      AtlasReasoningService.reason({
        source: 'CreativeFeedbackEngine', assetType: input.assetType, campaignId: input.campaignId, conceptId: input.conceptId,
        automatedScore: scoreResult.automatedScore, grade: grade, hardFail: hardFailResult.hardFail,
        diagnosisCount: diagnoses.length, timestamp: nowTs()
      });
    }

    return evaluation;
  };

})(window.AtlasCreativeFeedbackEngine);
