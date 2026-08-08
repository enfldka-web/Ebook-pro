/* server/image-usage-store.js — Phase 15: 사용자별 일일/월간 이미지 생성량 추적 +
   플랜별 한도 차단 + 운영자 전체 사용량. 인증 시스템이 아직 없으므로 "임시 session
   user adapter"만 제공한다(쿠키 기반 익명 세션 ID) — 실제 로그인/회원 시스템이
   생기면 resolveSessionUser()의 쿠키 조회 부분만 실제 인증된 userId/plan 조회로
   교체하면 된다(향후 인증 연결 지점, 아래 주석 참고).

   메모리 저장소이므로 서버 재시작 시 초기화된다 — 프로덕션에서는 Redis/DB로
   교체 가능하도록 인터페이스(getUsage/recordUsage/checkLimit)만 고정해 둔다. */

var crypto = require('crypto');

function planLimitsFromEnv(env){
  env = env || process.env;
  function num(v, fallback){ var n = parseInt(v, 10); return isNaN(n) ? fallback : n; }
  return {
    starter: { dailyLimit: num(env.ATLAS_PLAN_STARTER_DAILY_LIMIT, 10), monthlyLimit: num(env.ATLAS_PLAN_STARTER_MONTHLY_LIMIT, 100) },
    pro:     { dailyLimit: num(env.ATLAS_PLAN_PRO_DAILY_LIMIT, 50),     monthlyLimit: num(env.ATLAS_PLAN_PRO_MONTHLY_LIMIT, 1000) },
    admin:   { dailyLimit: num(env.ATLAS_PLAN_ADMIN_DAILY_LIMIT, 200),  monthlyLimit: num(env.ATLAS_PLAN_ADMIN_MONTHLY_LIMIT, 5000) }
  };
}

function todayKey(){ return new Date().toISOString().slice(0,10); }
function monthKey(){ return new Date().toISOString().slice(0,7); }

function createUsageStore(env){
  env = env || process.env;
  var users = {}; /* userId -> { plan, daily:{date,count}, monthly:{month,count} } */
  var operatorTotal = { requestCount:0, chargeableCount:0, failedCount:0 };

  function getUser(userId, plan){
    if(!users[userId]) users[userId] = { plan: plan||'starter', daily:{date:todayKey(), count:0}, monthly:{month:monthKey(), count:0}, trialUsed:false };
    var u = users[userId];
    if(u.daily.date !== todayKey()) u.daily = { date:todayKey(), count:0 };
    if(u.monthly.month !== monthKey()) u.monthly = { month:monthKey(), count:0 };
    return u;
  }

  /* V3 Phase 2 Round 33(2026-08-07): 사용자가 명시적으로 요청한 "무료 체험 1회 →
     넘으면 구독(LatPeed) 유도" — 운영자 본인 키를 쓰는 클라우드 서버가 생기면서
     방문자 익명 세션(쿠키)당 실제 비용이 드는 상황이 됐다. 클라이언트 localStorage
     카운터만으로는 지워버리면 무제한 우회가 가능하므로, 서버가 세션 쿠키 기준으로
     한 번만 진짜로 판단한다(완벽한 방지는 아니지만 — 쿠키 삭제/시크릿 모드로는
     여전히 우회 가능 — 합리적 수준의 남용 방지). "1회"는 전자책 본문 생성이
     실제로 성공했을 때만 소모된다(실패한 시도는 소모하지 않는다 — 아래
     recordTrialUsed 호출부, image-gateway.js 참고). */
  function checkTrialAllowed(userId){
    var u = getUser(userId);
    return { allowed: !u.trialUsed };
  }
  function recordTrialUsed(userId){
    var u = getUser(userId);
    u.trialUsed = true;
  }

  function getPlanLimits(plan){
    var limits = planLimitsFromEnv(env);
    return limits[plan] || limits.starter;
  }

  /* 사용자 요청으로 플랜별 일일/월간 한도 차단을 제거한다 — 실제 로컬 1인 운영
     환경에서는 본인 OpenAI 키로 직접 비용을 지불하므로, Atlas가 임의로 10장/일
     같은 인위적 상한으로 막을 이유가 없다(실제 사용자가 자기 API 사용을 막힌
     상태로 겪은 버그 리포트: "오늘 10/10장 사용" 배너로 생성이 중단됨). 사용량
     집계(daily.count/monthly.count) 자체는 통계 표시용으로 계속 남겨두되,
     checkLimit은 항상 allowed:true를 반환한다 — 향후 실제 다중 사용자 인증이
     생기면 이 지점만 다시 활성화하면 된다(getPlanLimits는 그대로 남아 있다). */
  function checkLimit(userId, plan){
    var u = getUser(userId, plan);
    return { allowed:true, dailyUsed:u.daily.count, dailyLimit:null, monthlyUsed:u.monthly.count, monthlyLimit:null };
  }

  /* chargeable=false(실패한 요청)는 한도 카운트에 반영하지 않는다 — "실패 요청의
     과금 여부 별도 기록" 요구 반영. 운영자 전체 사용량은 성공/실패와 무관하게 항상 집계한다. */
  function recordUsage(userId, opts){
    opts = opts || {};
    var u = getUser(userId);
    operatorTotal.requestCount++;
    if(opts.chargeable){
      u.daily.count++; u.monthly.count++;
      operatorTotal.chargeableCount++;
    } else {
      operatorTotal.failedCount++;
    }
    return { daily:u.daily.count, monthly:u.monthly.count };
  }

  function getOperatorTotal(){ return Object.assign({}, operatorTotal); }

  /* 임시 session user adapter — 쿠키의 익명 세션 ID를 그대로 userId로 쓴다.
     향후 인증 연결 지점: 실제 로그인이 생기면 이 함수를 "req의 인증 토큰에서
     실제 회원 userId/plan을 조회"하는 방식으로만 교체하면 나머지(Usage Store/
     Rate Limiter/Gateway)는 전혀 손댈 필요가 없다. */
  function resolveSessionUser(cookieHeader, setCookieFn){
    var COOKIE_NAME = 'atlas_session_id';
    var match = (cookieHeader||'').match(new RegExp(COOKIE_NAME+'=([^;]+)'));
    var userId = match ? match[1] : null;
    if(!userId){
      userId = crypto.randomUUID();
      if(typeof setCookieFn === 'function') setCookieFn(COOKIE_NAME, userId);
    }
    return { userId: userId, plan: 'starter' /* 인증 연결 전까지는 전부 starter 플랜 */ };
  }

  return {
    getUser: getUser, getPlanLimits: getPlanLimits, checkLimit: checkLimit,
    recordUsage: recordUsage, getOperatorTotal: getOperatorTotal, resolveSessionUser: resolveSessionUser,
    checkTrialAllowed: checkTrialAllowed, recordTrialUsed: recordTrialUsed
  };
}

module.exports = { createUsageStore: createUsageStore, planLimitsFromEnv: planLimitsFromEnv };
