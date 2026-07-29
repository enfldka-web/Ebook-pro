/* server/providers/openai-image-provider.js — Phase 15: 실제 OpenAI Images API 호출.
   API Key는 이 서버 모듈 안에서만 process.env.OPENAI_API_KEY로 읽고, 절대 응답/로그에
   그대로 노출하지 않는다. fetch 구현체를 주입 가능하게 만들어(fetchImpl) 실제 네트워크
   호출 없이도 429/5xx/timeout/401 재시도 정책을 Node 테스트로 검증할 수 있게 한다. */

var DEFAULT_MODEL = 'gpt-image-2';
var RETRYABLE_STATUS = [429, 500, 502, 503, 504];
var MAX_RETRIES = 2;
var BASE_BACKOFF_MS = 500;

function config(env){
  env = env || process.env;
  return {
    apiKey: env.OPENAI_API_KEY || '',
    model: env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL,
    quality: env.OPENAI_IMAGE_QUALITY || 'medium',
    timeoutMs: parseInt(env.OPENAI_IMAGE_TIMEOUT_MS, 10) || 120000,
    maxConcurrency: parseInt(env.OPENAI_IMAGE_MAX_CONCURRENCY, 10) || 2
  };
}

function isConfigured(env){ return !!config(env).apiKey; }

/* Provider-neutral Prompt(이미 "no embedded text" 등을 포함)에 OpenAI 전용 추가
   지시("no Korean text", "Atlas will add all Korean text later" 등)를 덧붙인다.
   내부 기획 문서 전체를 보내지 않고, 이미 압축된 Prompt 문자열 하나만 그대로 쓴다. */
function buildOpenAIPrompt(providerNeutralPrompt){
  return providerNeutralPrompt
    + '\nDo not render any Korean text, any embedded text, random letters, logos, or watermarks. '
    + 'Leave the specified safe area completely clean — Atlas will add all Korean text later.';
}

function buildRequestBody(providerNeutralPrompt, opts){
  opts = opts || {};
  var cfg = config(opts.env);
  return {
    model: cfg.model,
    prompt: buildOpenAIPrompt(providerNeutralPrompt),
    size: opts.size,
    quality: opts.quality || cfg.quality,
    output_format: opts.outputFormat || 'png',
    background: opts.background || 'opaque',
    n: 1
  };
}

function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

function classifyError(status){
  if(RETRYABLE_STATUS.indexOf(status) !== -1) return 'retryable';
  if(status===400) return 'invalid_request';
  if(status===401) return 'auth_error';
  if(status===403) return 'permission_error';
  return 'other';
}

/* fetchImpl은 (url, options) => Promise<{status, json:async fn, ok}> 형태의 fetch 호환
   함수여야 한다(Node 18+ 전역 fetch와 동일 시그니처) — 테스트에서 실제 네트워크 없이
   상태 코드를 자유롭게 흉내내기 위해 주입 가능하게 했다. */
function callOnce(fetchImpl, apiKey, body, signal, timeoutMs){
  var timeoutController = new AbortController();
  var timer = setTimeout(function(){ timeoutController.abort(); }, timeoutMs);
  if(signal){
    signal.addEventListener('abort', function(){ timeoutController.abort(); });
  }
  return fetchImpl('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer '+apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutController.signal
  }).then(function(res){
    clearTimeout(timer);
    return res.json().then(function(json){ return { status: res.status, ok: res.ok, json: json }; });
  }).catch(function(err){
    clearTimeout(timer);
    if(err && (err.name==='AbortError')){
      if(signal && signal.aborted) throw Object.assign(new Error('cancelled'), { code:'cancelled' });
      throw Object.assign(new Error('timeout'), { code:'timeout' });
    }
    throw err;
  });
}

/* 429/5xx/timeout만 최대 2회, exponential backoff로 재시도한다. 400/401/403은
   재시도하지 않고 즉시 실패로 반환한다(요구사항 §11). */
function generateWithRetry(providerNeutralPrompt, opts){
  opts = opts || {};
  var cfg = config(opts.env);
  var fetchImpl = opts.fetchImpl || fetch;
  var apiKey = cfg.apiKey;
  var body = buildRequestBody(providerNeutralPrompt, Object.assign({ env: opts.env }, opts));
  var timeoutMs = opts.timeoutMs || cfg.timeoutMs;

  function attempt(retryCount){
    return callOnce(fetchImpl, apiKey, body, opts.signal, timeoutMs).then(function(result){
      if(result.ok){
        return { success:true, status:result.status, data:result.json, retries:retryCount };
      }
      var kind = classifyError(result.status);
      if(kind==='retryable' && retryCount < MAX_RETRIES){
        var backoff = BASE_BACKOFF_MS * Math.pow(2, retryCount);
        return sleep(backoff).then(function(){ return attempt(retryCount+1); });
      }
      return { success:false, status:result.status, errorKind:kind, data:result.json, retries:retryCount };
    }).catch(function(err){
      if(err.code==='cancelled') return { success:false, status:null, errorKind:'cancelled', retries:retryCount };
      if(err.code==='timeout' && retryCount < MAX_RETRIES){
        var backoff = BASE_BACKOFF_MS * Math.pow(2, retryCount);
        return sleep(backoff).then(function(){ return attempt(retryCount+1); });
      }
      return { success:false, status:null, errorKind: err.code==='timeout' ? 'timeout' : 'network_error', retries:retryCount };
    });
  }

  return attempt(0);
}

/* OpenAI Images API 응답(data[0].b64_json)을 Atlas 공통 이미지 표현으로 변환한다.
   실제 파일 저장소 없이 data: URL로 넘긴다 — 브라우저 쪽 Overlay Engine은 Mock의
   dataUrl과 동일하게 다루므로 별도 분기가 필요 없다(알려진 단순화, 완료 보고에 명시). */
function decodeOpenAIImage(apiData, mimeType){
  var item = apiData && apiData.data && apiData.data[0];
  if(!item || !item.b64_json) return null;
  return 'data:'+(mimeType||'image/png')+';base64,'+item.b64_json;
}

module.exports = {
  DEFAULT_MODEL: DEFAULT_MODEL, RETRYABLE_STATUS: RETRYABLE_STATUS, MAX_RETRIES: MAX_RETRIES,
  config: config, isConfigured: isConfigured, buildOpenAIPrompt: buildOpenAIPrompt,
  buildRequestBody: buildRequestBody, classifyError: classifyError,
  generateWithRetry: generateWithRetry, decodeOpenAIImage: decodeOpenAIImage
};
