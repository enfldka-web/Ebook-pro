/* js/image-provider-mock.js — Phase 14: Mock Image Provider

   목적: 유료 외부 API를 호출하지 않고 전체 파이프라인(Scene → Prompt → Image Engine →
   Overlay → Export)을 끝까지 테스트할 수 있게 한다. 실제 AI 생성 이미지가 아니다 —
   이 Provider가 만든 결과에는 항상 image.sourceType==='mock'이 표시되고, 실제 UI에서도
   "테스트용 Mock 결과이며 실제 AI 생성 이미지가 아닙니다."라는 문구를 반드시 함께
   보여준다(js/image-generation-ui.js 참고).

   generate()는 { jobId, promise } 를 동기적으로 반환한다 — jobId는 cancel()에 즉시
   쓸 수 있어야 하고, promise는 실제 생성(모의) 완료 후 정규화된 Response로 resolve된다.

   브라우저 밖(Node 테스트)에서는 document/canvas가 없으므로, 실제 캔버스 드로잉 대신
   결정적인 placeholder objectUrl 문자열만 만든다 — Contract 형태 검증에는 지장이 없다. */

window.AtlasMockImageProvider = window.AtlasMockImageProvider || {};

(function(P){
  var C = window.AtlasImageGenerationContract;

  P.id = 'mock';
  P.displayName = 'Mock 생성 (테스트용 — 실제 AI 아님)';
  P.mockLabel = '테스트용 Mock 결과이며 실제 AI 생성 이미지가 아닙니다.';
  P.capabilities = {
    textToImage: true, imageToImage: false, referenceImage: false,
    negativePrompt: true, seed: true,
    aspectRatios: ['4:3', '4:5', 'any'],
    maximumImagesPerRequest: 1,
    supportsConsistencyReference: true,
    supportsTransparentBackground: false
  };

  var jobs = {}; /* jobId -> { status, timer } */
  var jobCounter = 0;

  P.isConfigured = function(){ return true; };

  P.validateRequest = function(request){ return C.validateRequest(request); };

  function hashString(s){
    var h = 0;
    for(var i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  function paletteToHex(paletteText){
    var h = hashString(paletteText||'default');
    var hue = h % 360;
    return 'hsl('+hue+',55%,42%)';
  }

  /* 브라우저에서는 실제 Canvas에 배경색 + Mock 라벨 + 규격/역할 텍스트를 그려 진짜
     placeholder PNG(dataUrl)를 만든다. 이는 여전히 "실제 AI 이미지"가 아니라 명확히
     Mock임을 이미지 자체에도 남기기 위함이다(스크린샷만 보고 실제 생성물로 오인하는
     것을 방지). */
  function drawMockCanvas(request){
    var canvas = document.createElement('canvas');
    canvas.width = request.width; canvas.height = request.height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = paletteToHex(request.scene && request.scene.palette);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, canvas.height*0.4, canvas.width, canvas.height*0.2);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold '+Math.max(14, Math.round(canvas.width*0.045))+'px sans-serif';
    ctx.fillText('MOCK — NOT A REAL AI IMAGE', canvas.width/2, canvas.height*0.48);
    ctx.font = Math.max(11, Math.round(canvas.width*0.028))+'px sans-serif';
    ctx.fillText((request.role||request.conceptId||request.assetType||'')+' · '+canvas.width+'x'+canvas.height, canvas.width/2, canvas.height*0.56);
    return canvas.toDataURL('image/png');
  }

  function buildMockObjectUrl(request){
    if(typeof document !== 'undefined' && document.createElement){
      try{ return drawMockCanvas(request); }
      catch(e){ /* 캔버스를 그릴 수 없는 환경 — placeholder 문자열로 대체 */ }
    }
    return 'mock://placeholder/'+request.assetType+'/'+(request.conceptId||request.role||'x')+'/'+request.width+'x'+request.height;
  }

  P.generate = function(request, extra){
    var validation = C.validateRequest(request);
    jobCounter++;
    var jobId = 'mock-job-'+jobCounter+'-'+Date.now();
    if(!validation.valid){
      var failedNow = C.createResponse({
        requestId: request && request.requestId, jobId: jobId, providerId: P.id, status:'failed',
        error: { message:'요청 검증 실패', details: validation.errors }
      });
      return { jobId: jobId, promise: Promise.resolve(failedNow) };
    }
    jobs[jobId] = { status:'queued' };
    var delay = (extra && typeof extra.delayMs==='number') ? extra.delayMs : 0;
    var promise = new Promise(function(resolve){
      jobs[jobId].status = 'processing';
      setTimeout(function(){
        var job = jobs[jobId];
        if(!job || job.status==='cancelled'){
          resolve(C.createResponse({ requestId: request.requestId, jobId: jobId, providerId: P.id, status:'cancelled' }));
          return;
        }
        job.status = 'completed';
        resolve(C.createResponse({
          requestId: request.requestId, jobId: jobId, providerId: P.id, status:'completed',
          image: { mimeType:'image/png', width:request.width, height:request.height, objectUrl: buildMockObjectUrl(request), sourceType:'mock' },
          usage: { costAvailable:false }
        }));
      }, delay);
    });
    return { jobId: jobId, promise: promise };
  };

  P.cancel = function(jobId){
    if(!jobs[jobId]) return false;
    if(jobs[jobId].status==='completed') return false;
    jobs[jobId].status = 'cancelled';
    return true;
  };

  P.normalizeResponse = function(raw){ return raw; };

  if(window.AtlasImageProviderRegistry) window.AtlasImageProviderRegistry.register(P);

})(window.AtlasMockImageProvider);
