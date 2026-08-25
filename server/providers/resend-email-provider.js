/* server/providers/resend-email-provider.js — 2026-08-14: 회원가입 이메일
   인증번호 발송. Resend(https://resend.com) REST API를 fetch로 직접 호출한다
   (SDK 의존성 추가 없음 — 이 프로젝트의 최소 의존성 원칙, anthropic-text-
   provider.js/toss-payments-provider.js와 동일한 패턴). RESEND_API_KEY가
   없으면 isConfigured()가 false를 반환해 호출부가 503으로 안내한다(기존
   ANTHROPIC_API_KEY/DATABASE_URL 없을 때와 같은 부분 기능 저하 원칙).

   발신 주소(from)는 기본으로 Resend가 도메인 인증 없이 누구나 즉시 쓸 수
   있게 제공하는 onboarding@resend.dev를 쓴다 — 실제 커스텀 도메인을 Resend에
   인증해두면 RESEND_FROM_EMAIL로 바꿔 쓸 수 있다. */
var RESEND_API_BASE = 'https://api.resend.com';

function config(env){
  env = env || process.env;
  return {
    apiKey: env.RESEND_API_KEY || null,
    fromEmail: env.RESEND_FROM_EMAIL || 'Atlas AI eBook Studio <onboarding@resend.dev>'
  };
}

function isConfigured(env){
  return !!config(env).apiKey;
}

/* 6자리 숫자 인증번호를 담은 간단한 HTML 이메일 하나만 보낸다 — 마케팅
   문구/이미지 없이 인증 목적 하나에만 집중한다. */
function sendVerificationEmail(opts){
  opts = opts || {};
  var cfg = config(opts.env);
  var fetchImpl = opts.fetchImpl || fetch;
  var html = '<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">'
    + '<h2 style="margin:0 0 12px">Atlas AI eBook Studio</h2>'
    + '<p style="color:#555;font-size:14px;line-height:1.6">아래 인증번호를 회원가입 화면에 입력해주세요. 이 번호는 10분간 유효합니다.</p>'
    + '<div style="font-size:32px;font-weight:800;letter-spacing:6px;padding:16px 0;text-align:center;background:#f4f4f8;border-radius:12px;margin:16px 0">' + opts.code + '</div>'
    + '<p style="color:#999;font-size:12px">본인이 요청하지 않았다면 이 이메일을 무시하셔도 됩니다.</p>'
    + '</div>';
  return fetchImpl(RESEND_API_BASE + '/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
    body: JSON.stringify({
      from: cfg.fromEmail,
      to: [opts.to],
      subject: '[Atlas AI] 회원가입 인증번호 ' + opts.code,
      html: html
    })
  }).then(function(res){
    return res.json().catch(function(){ return {}; }).then(function(json){
      return { ok: res.ok, status: res.status, data: json };
    });
  });
}

/* 2026-08-21: 비밀번호 재설정 인증번호 이메일. sendVerificationEmail()과
   본문 구조는 거의 같지만 제목/문구가 "회원가입"이 아니라 "비밀번호
   재설정"을 가리켜야 하므로 별도 함수로 둔다(하나를 purpose 파라미터로
   일반화하는 대신, 이 파일의 기존 스타일대로 목적별 함수를 각각 둔다). */
function sendPasswordResetEmail(opts){
  opts = opts || {};
  var cfg = config(opts.env);
  var fetchImpl = opts.fetchImpl || fetch;
  var html = '<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">'
    + '<h2 style="margin:0 0 12px">Atlas AI eBook Studio</h2>'
    + '<p style="color:#555;font-size:14px;line-height:1.6">아래 인증번호를 비밀번호 재설정 화면에 입력해주세요. 이 번호는 10분간 유효합니다.</p>'
    + '<div style="font-size:32px;font-weight:800;letter-spacing:6px;padding:16px 0;text-align:center;background:#f4f4f8;border-radius:12px;margin:16px 0">' + opts.code + '</div>'
    + '<p style="color:#999;font-size:12px">본인이 비밀번호 재설정을 요청하지 않았다면 이 이메일을 무시하셔도 됩니다 — 비밀번호는 변경되지 않습니다.</p>'
    + '</div>';
  return fetchImpl(RESEND_API_BASE + '/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
    body: JSON.stringify({
      from: cfg.fromEmail,
      to: [opts.to],
      subject: '[Atlas AI] 비밀번호 재설정 인증번호 ' + opts.code,
      html: html
    })
  }).then(function(res){
    return res.json().catch(function(){ return {}; }).then(function(json){
      return { ok: res.ok, status: res.status, data: json };
    });
  });
}

module.exports = { config: config, isConfigured: isConfigured, sendVerificationEmail: sendVerificationEmail, sendPasswordResetEmail: sendPasswordResetEmail };
