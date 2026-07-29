/* server/providers/anthropic-text-provider.js — 자료 분석/제목 생성/전자책 생성 등
   Atlas의 모든 Anthropic Messages API 호출을 서버에서만 수행한다. API Key는 이 서버
   모듈 안에서만 process.env.ANTHROPIC_API_KEY로 읽고, 절대 응답/로그에 그대로
   노출하지 않는다. fetch 구현체를 주입 가능하게 만들어(fetchImpl) 실제 네트워크
   호출 없이도 429/5xx/timeout/401 재시도 정책을 Node 테스트로 검증할 수 있게 한다.
   (server/providers/openai-image-provider.js와 동일한 구조를 그대로 따른다.) */

var DEFAULT_MODEL = 'claude-sonnet-4-6';
var RETRYABLE_STATUS = [429, 500, 502, 503, 504];
var MAX_RETRIES = 2;
var BASE_BACKOFF_MS = 500;

function config(env){
  env = env || process.env;
  return {
    apiKey: env.ANTHROPIC_API_KEY || '',
    timeoutMs: parseInt(env.ANTHROPIC_TEXT_TIMEOUT_MS, 10) || 120000,
    /* 챕터별 생성은 목차/전체 병합보다 훨씬 작은 단위이므로 별도의(보통 더 짧은)
       타임아웃을 쓸 수 있게 한다 — 지정하지 않으면 120초 기본값을 쓴다. */
    chapterTimeoutMs: parseInt(env.ANTHROPIC_CHAPTER_TIMEOUT_MS, 10) || 120000
  };
}

function isConfigured(env){ return !!config(env).apiKey; }

function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

function classifyError(status){
  if(RETRYABLE_STATUS.indexOf(status) !== -1) return 'retryable';
  if(status===400) return 'invalid_request';
  if(status===401) return 'auth_error';
  if(status===403) return 'permission_error';
  return 'other';
}

/* fetchImpl은 (url, options) => Promise<Response> 형태의 fetch 호환 함수여야 한다
   (Node 18+ 전역 fetch와 동일 시그니처) — 테스트에서 실제 네트워크 없이 상태 코드를
   자유롭게 흉내내기 위해 주입 가능하게 했다. */
function callOnce(fetchImpl, apiKey, body, signal, timeoutMs){
  var timeoutController = new AbortController();
  var timer = setTimeout(function(){ timeoutController.abort(); }, timeoutMs);
  if(signal){
    signal.addEventListener('abort', function(){ timeoutController.abort(); });
  }
  return fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
    signal: timeoutController.signal
  }).then(function(res){
    clearTimeout(timer);
    return res.json().then(function(json){ return { status: res.status, ok: res.ok, json: json }; });
  }).catch(function(err){
    clearTimeout(timer);
    if(err && err.name==='AbortError'){
      if(signal && signal.aborted) throw Object.assign(new Error('cancelled'), { code:'cancelled' });
      throw Object.assign(new Error('timeout'), { code:'timeout' });
    }
    throw err;
  });
}

/* 429/5xx/timeout/network_error 모두 최대 2회, exponential backoff로 재시도한다.
   400/401/403만 재시도하지 않고 즉시 실패로 반환한다. (Phase 16.1: 순수 네트워크
   예외(연결 끊김 등, HTTP 응답 자체가 없는 경우)가 이전에는 재시도되지 않던 것을
   수정했다 — 실제 검증 중 5분 이상 걸리는 단일 연결이 중간에 끊기며 재시도 없이
   그대로 실패하는 문제가 있었다.) */
function generateWithRetry(requestBody, opts){
  opts = opts || {};
  var cfg = config(opts.env);
  var fetchImpl = opts.fetchImpl || fetch;
  var apiKey = cfg.apiKey;
  var body = Object.assign({ model: DEFAULT_MODEL }, requestBody);
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
      var kind = err.code==='timeout' ? 'timeout' : 'network_error';
      if(retryCount < MAX_RETRIES){
        var backoff = BASE_BACKOFF_MS * Math.pow(2, retryCount);
        return sleep(backoff).then(function(){ return attempt(retryCount+1); });
      }
      return { success:false, status:null, errorKind: kind, retries:retryCount };
    });
  }

  return attempt(0);
}

module.exports = {
  DEFAULT_MODEL: DEFAULT_MODEL, RETRYABLE_STATUS: RETRYABLE_STATUS, MAX_RETRIES: MAX_RETRIES,
  config: config, isConfigured: isConfigured, classifyError: classifyError, generateWithRetry: generateWithRetry
};
