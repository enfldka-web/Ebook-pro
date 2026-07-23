/* reasoning-service.js — Milestone 3.2 Phase 2: Reasoning Service
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md §3 Reasoning Service

   Reasoning Service는 교차 서비스(cross-cutting service)다 — 파이프라인의 한 단계가
   아니라 다른 Engine이 Reason()을 호출할 때만 동작한다. 여기서 하는 일은 딱 하나,
   "이미 다른 Engine이 내린 판단을 기록하는 것"뿐이다. 새로운 판단을 하지 않고,
   점수를 매기지 않고, 값을 바꾸지 않는다 — 그래서 이 파일에는 if/판단 분기가
   전혀 없다. 그런 로직이 생기는 순간 이 파일은 spec 위반이다. */

window.AtlasReasoningService = window.AtlasReasoningService || {};

(function(RS){
  RS.log = [];

  /* 다른 Engine이 이미 완성한 결과를 그대로 기록만 한다. 전달받은 값을 검사하거나
     바꾸지 않고, 얕은 복사본을 저장해 호출자가 이후 원본 객체를 변경해도 기록된
     역사는 보존되도록 한다. */
  RS.reason = function(record){
    var stored = Object.assign({}, record, { recordedAt: Date.now() });
    RS.log.push(stored);
    return stored;
  };

  RS.latest = function(){ return RS.log.length ? RS.log[RS.log.length-1] : null; };
  RS.all = function(){ return RS.log.slice(); };
})(window.AtlasReasoningService);
