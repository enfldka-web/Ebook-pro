/* server/providers/toss-payments-provider.js — 2026-08-13: 토스페이먼츠 정기구독
   (빌링키 발급 + 매달 자동 청구) 서버 API 호출. 시크릿 키는 이 모듈 안에서만
   env.TOSS_SECRET_KEY로 읽고 브라우저로 절대 전달하지 않는다(구조:
   Browser(카드 등록 위젯) → Toss 호스팅 페이지 → authKey를 서버로 전달 →
   서버가 시크릿 키로 Toss REST API를 직접 호출). fetch 구현체를 주입 가능하게
   만들어(fetchImpl) 실제 네트워크 호출 없이도 Node 테스트로 검증할 수 있게
   한다(anthropic-text-provider.js와 동일한 원칙).

   테스트 키 출처: 토스페이먼츠 공식 개발자 문서가 누구나 실제 상점 가입 없이
   결제 흐름 전체(카드 등록→발급→청구)를 테스트할 수 있도록 공개한 샌드박스
   키다(진짜 돈이 움직이지 않음). 실제 상점 키가 발급되면 TOSS_CLIENT_KEY/
   TOSS_SECRET_KEY 환경변수로 교체하면 된다 — 이 기본값은 로컬 개발 편의를
   위한 폴백일 뿐, Render 배포本 환경에서는 반드시 실제 키로 교체해야 한다. */

var TOSS_TEST_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq';
var TOSS_TEST_SECRET_KEY = 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R';
var TOSS_API_BASE = 'https://api.tosspayments.com/v1';

function config(env){
  env = env || process.env;
  return {
    clientKey: env.TOSS_CLIENT_KEY || TOSS_TEST_CLIENT_KEY,
    secretKey: env.TOSS_SECRET_KEY || TOSS_TEST_SECRET_KEY,
    isTestKey: !env.TOSS_CLIENT_KEY
  };
}

function authHeader(secretKey){
  return 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
}

/* 카드 등록 위젯(requestBillingAuth)이 successUrl로 돌려준 authKey를 실제
   billingKey로 교환한다 — 이 호출이 성공해야 "카드가 등록됐다"고 볼 수 있다
   (아직 돈이 청구되지는 않음, 별도의 chargeBilling 호출이 필요). */
function issueBillingKey(opts){
  opts = opts || {};
  var cfg = config(opts.env);
  var fetchImpl = opts.fetchImpl || fetch;
  return fetchImpl(TOSS_API_BASE + '/billing/authorizations/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader(cfg.secretKey) },
    body: JSON.stringify({ authKey: opts.authKey, customerKey: opts.customerKey })
  }).then(function(res){
    return res.json().then(function(json){ return { ok: res.ok, status: res.status, data: json }; });
  });
}

/* 이미 발급된 billingKey로 실제 금액을 청구한다 — 첫 구독 시작 시 1회,
   이후 매달 자동청구 스케줄러가 반복 호출한다. orderId는 매 청구마다 고유해야
   한다(토스 요구사항, 중복 청구 방지 키 역할도 겸함). */
function chargeBilling(opts){
  opts = opts || {};
  var cfg = config(opts.env);
  var fetchImpl = opts.fetchImpl || fetch;
  return fetchImpl(TOSS_API_BASE + '/billing/' + encodeURIComponent(opts.billingKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader(cfg.secretKey) },
    body: JSON.stringify({
      customerKey: opts.customerKey,
      amount: opts.amount,
      orderId: opts.orderId,
      orderName: opts.orderName || 'Atlas AI eBook Studio 구독'
    })
  }).then(function(res){
    return res.json().then(function(json){ return { ok: res.ok, status: res.status, data: json }; });
  });
}

module.exports = {
  config: config,
  issueBillingKey: issueBillingKey,
  chargeBilling: chargeBilling
};
