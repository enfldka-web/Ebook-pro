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
      return pool.query(
        'CREATE TABLE IF NOT EXISTS subscriptions (' +
        '  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,' +
        '  status text NOT NULL DEFAULT \'inactive\',' +
        '  billing_key text,' +
        '  customer_key text,' +
        '  plan_amount integer NOT NULL DEFAULT 29000,' +
        '  next_billing_at timestamptz,' +
        '  created_at timestamptz NOT NULL DEFAULT now(),' +
        '  updated_at timestamptz NOT NULL DEFAULT now()' +
        ')'
      );
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
    });
  }

  return { pool: pool, ensureSchema: ensureSchema, query: function(text, params){ return pool.query(text, params); } };
}

module.exports = { createDb: createDb };
