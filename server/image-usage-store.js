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
    if(!users[userId]) users[userId] = { plan: plan||'starter', daily:{date:todayKey(), count:0}, monthly:{month:monthKey(), count:0} };
    var u = users[userId];
    if(u.daily.date !== todayKey()) u.daily = { date:todayKey(), count:0 };
    if(u.monthly.month !== monthKey()) u.monthly = { month:monthKey(), count:0 };
    return u;
  }

  function getPlanLimits(plan){
    var limits = planLimitsFromEnv(env);
    return limits[plan] || limits.starter;
  }

  /* 한도 확인 — 아직 소진하지 않고 "지금 요청 1건을 더 허용할 수 있는가"만 확인한다. */
  function checkLimit(userId, plan){
    var u = getUser(userId, plan);
    var limits = getPlanLimits(u.plan);
    if(u.daily.count >= limits.dailyLimit){
      return { allowed:false, reason:'daily_limit_exceeded', message:'오늘 이미지 생성 한도를 모두 사용했습니다.', dailyUsed:u.daily.count, dailyLimit:limits.dailyLimit, monthlyUsed:u.monthly.count, monthlyLimit:limits.monthlyLimit };
    }
    if(u.monthly.count >= limits.monthlyLimit){
      return { allowed:false, reason:'monthly_limit_exceeded', message:'이번 달 이미지 생성 한도를 모두 사용했습니다.', dailyUsed:u.daily.count, dailyLimit:limits.dailyLimit, monthlyUsed:u.monthly.count, monthlyLimit:limits.monthlyLimit };
    }
    return { allowed:true, dailyUsed:u.daily.count, dailyLimit:limits.dailyLimit, monthlyUsed:u.monthly.count, monthlyLimit:limits.monthlyLimit };
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
    recordUsage: recordUsage, getOperatorTotal: getOperatorTotal, resolveSessionUser: resolveSessionUser
  };
}

module.exports = { createUsageStore: createUsageStore, planLimitsFromEnv: planLimitsFromEnv };
