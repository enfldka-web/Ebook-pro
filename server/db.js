/* server/db.js — 2026-08-13: 실제 회원가입/로그인/구독 상태를 영구 저장하기
   위한 PostgreSQL 연결 래퍼. `pg.Pool`을 `DATABASE_URL` env로 생성하는 얇은
   래퍼일 뿐이다 — 테스트에서는 `opts.connectionString`을 직접 주입해 로컬
   Postgres(또는 다른 접속 문자열)로 바꿔 끼울 수 있다(server/image-gateway.js
   의 fetchImpl 주입 패턴과 동일한 테스트 용이성 원칙).

   마이그레이션은 별도 도구 없이 `ensureSchema()`가 부팅 시 `CREATE TABLE IF
   NOT EXISTS`를 실행한다 — 이 프로젝트는 지금까지 빌드 도구/DB 마이그레이션
   프레임워크가 전혀 없었고, 테이블 3개뿐인 초기 스키마에 별도 도구를 들이는
   비용이 더 크다. */
var Pool = require('pg').Pool;

function createDb(opts){
  opts = opts || {};
  var connectionString = opts.connectionString || process.env.DATABASE_URL;
  if(!connectionString){
    throw new Error('DATABASE_URL이 설정되지 않았습니다. .env 또는 Render 환경변수에 DATABASE_URL을 추가하세요.');
  }
  /* Render의 관리형 Postgres는 기본적으로 자체 서명 인증서를 쓰므로
     rejectUnauthorized:false가 필요하다(공식 가이드) — 로컬 개발(localhost)
     접속에는 sslmode가 없으므로 이 설정이 조용히 무시된다. */
  var needsSsl = /sslmode=require/.test(connectionString) || (opts.ssl !== false && /render\.com|amazonaws\.com/.test(connectionString));
  var pool = new Pool({
    connectionString: connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : false
  });

  function ensureSchema(){
    /* pgcrypto가 gen_random_uuid()를 제공한다 — 아래 테이블들의 기본값 표현식이
       이 함수를 참조하므로 테이블 생성보다 먼저 만들어야 한다. Render managed
       Postgres는 기본 켜져 있는 경우가 많지만, 권한이 없어 실패해도(이미
       슈퍼유저가 켜둔 경우 등) 조용히 넘어간다. */
    return pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch(function(){}).then(function(){
      return pool.query(
        'CREATE TABLE IF NOT EXISTS users (' +
        '  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),' +
        '  email text UNIQUE NOT NULL,' +
        '  password_hash text NOT NULL,' +
        '  name text NOT NULL,' +
        '  trial_used boolean NOT NULL DEFAULT false,' +
        '  created_at timestamptz NOT NULL DEFAULT now()' +
        ')'
      );
    }).then(function(){
      /* 2026-08-21: 회원 탈퇴. users 행 자체를 DELETE하지 않는다 — payments가
         user_id를 FK(ON DELETE CASCADE)로 참조하는데, 결제 기록은 전자상거래법상
         5년 보관 의무가 있어(개인정보처리방침 3항) 탈퇴한다고 함께 지워지면
         안 된다. 대신 이 컬럼으로 "탈퇴 처리됨"만 표시하고, 실제 개인 식별
         정보(email/name/password_hash)는 탈퇴 처리 시점에 재사용 불가능한
         값으로 덮어쓴다(server/image-gateway.js /api/auth/delete-account). */
      return pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz');
    }).then(function(){
      /* 2026-08-21: 로그인 무차별 대입(brute-force) 방지. email_verifications의
         attempts 컬럼과 같은 발상 — 실패할 때마다 세고, 문턱을 넘으면 일정
         시간 잠근다. login_locked_until이 미래 시각이면 비밀번호가 맞아도
         로그인을 거부한다(server/image-gateway.js). */
      return pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0');
    }).then(function(){
      return pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS login_locked_until timestamptz');
    }).then(function(){
      return pool.query(
        'CREATE TABLE IF NOT EXISTS subscriptions (' +
        '  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,' +
        '  status text NOT NULL DEFAULT \'inactive\',' +
        '  billing_key text,' +
        '  customer_key text,' +
        '  plan_amount integer NOT NULL DEFAULT 29000,' +
        '  next_billing_at timestamptz,' +
        '  cancel_at_period_end boolean NOT NULL DEFAULT false,' +
        '  created_at timestamptz NOT NULL DEFAULT now(),' +
        '  updated_at timestamptz NOT NULL DEFAULT now()' +
        ')'
      );
    }).then(function(){
      /* 2026-08-14: 기존에 이미 만들어진 subscriptions 테이블에는(CREATE TABLE
         IF NOT EXISTS라 위 정의가 새 컬럼을 안 만들어줌) cancel_at_period_end가
         없을 수 있다 — 구독 취소 기능 추가 시 실서비스 DB(이미 가입자가 있는
         상태)에도 안전하게 반영되도록 별도 ALTER로 보강한다. */
      return pool.query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false');
    }).then(function(){
      return pool.query(
        'CREATE TABLE IF NOT EXISTS payments (' +
        '  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),' +
        '  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,' +
        '  order_id text NOT NULL,' +
        '  payment_key text,' +
        '  amount integer NOT NULL,' +
        '  status text NOT NULL,' +
        '  created_at timestamptz NOT NULL DEFAULT now()' +
        ')'
      );
    }).then(function(){
      /* 2026-08-14: 회원가입 이메일 인증. email을 기본키로 써서 "이메일당
         활성 코드 1개"를 자연스럽게 강제한다 — 재전송 요청은 그냥 같은 행을
         덮어쓴다(UPSERT). 아직 계정이 없는 이메일을 대상으로 하므로 users를
         참조하지 않는 독립 테이블이다. */
      return pool.query(
        'CREATE TABLE IF NOT EXISTS email_verifications (' +
        '  email text PRIMARY KEY,' +
        '  code text NOT NULL,' +
        '  attempts integer NOT NULL DEFAULT 0,' +
        '  expires_at timestamptz NOT NULL,' +
        '  last_sent_at timestamptz NOT NULL DEFAULT now()' +
        ')'
      );
    }).then(function(){
      /* 2026-08-21: 비밀번호 재설정. email_verifications와 컬럼 구조는
         동일하지만(이메일당 코드 1개, 재요청 시 UPSERT) 별도 테이블로 둔다 —
         회원가입 인증은 "아직 계정이 없는 이메일"을 대상으로 하고 비밀번호
         재설정은 "이미 계정이 있는 이메일"을 대상으로 해서 성격이 다르고,
         한 테이블을 겸용하면 두 흐름의 만료/시도횟수 정책이 서로 얽힐
         위험이 있다. */
      return pool.query(
        'CREATE TABLE IF NOT EXISTS password_resets (' +
        '  email text PRIMARY KEY,' +
        '  code text NOT NULL,' +
        '  attempts integer NOT NULL DEFAULT 0,' +
        '  expires_at timestamptz NOT NULL,' +
        '  last_sent_at timestamptz NOT NULL DEFAULT now()' +
        ')'
      );
    });
  }

  return { pool: pool, ensureSchema: ensureSchema, query: function(text, params){ return pool.query(text, params); } };
}

module.exports = { createDb: createDb };
