/* js/image-generation-queue.js — Phase 15: 동시 생성 수 제한 Queue (클라이언트 측)

   "썸네일 5장/상세페이지 9장을 동시에 무제한 호출하지 마세요. 기본 동시 생성 수: 2"
   요구를 UI 레이어에서 구현한다. 서버(image-rate-limiter.js)의 Semaphore와는 별개의
   방어선이다 — 여기서는 진행률(진행 중 2/5)과 개별 상태(queued/processing/completed/
   failed/cancelled)만 관리하고, 429/5xx 자동 재시도 자체는 서버가 이미 수행한다(§11).
   "다시 생성" 버튼은 사용자가 명시적으로 새 Job을 enqueue하는 것으로 처리한다. */

window.AtlasImageGenerationQueue = window.AtlasImageGenerationQueue || {};

(function(Q){

  Q.DEFAULT_CONCURRENCY = 2;

  Q.createQueue = function(maxConcurrency){
    maxConcurrency = maxConcurrency>0 ? maxConcurrency : Q.DEFAULT_CONCURRENCY;
    var items = {}; /* id -> { id, status, run, onUpdate, jobId, response } */
    var order = [];
    var pending = [];
    var activeCount = 0;

    function set(id, patch){
      items[id] = Object.assign({}, items[id], patch);
      if(items[id].onUpdate) items[id].onUpdate(items[id]);
    }

    function runNext(){
      if(activeCount >= maxConcurrency) return;
      var nextId = pending.shift();
      if(nextId===undefined) return;
      var item = items[nextId];
      if(!item || item.status==='cancelled') { runNext(); return; }
      activeCount++;
      set(nextId, { status:'processing' });
      var control = item.run();
      set(nextId, { jobId: control.jobId });
      control.promise.then(function(resp){
        activeCount--;
        set(nextId, { status: resp.status, response: resp });
        runNext();
      });
    }

    function enqueue(id, runFn, onUpdate){
      items[id] = { id:id, status:'queued', run:runFn, onUpdate:onUpdate, jobId:null, response:null };
      order.push(id);
      pending.push(id);
      runNext();
      return items[id];
    }

    /* 아직 시작되지 않은 항목은 즉시 취소 처리한다. 이미 processing 중이면 큐는
       상태만 바꾸지 않고 false를 반환한다 — 실제 진행 중인 Job 취소는 호출자가
       item.jobId로 Provider.cancel()을 직접 호출해야 한다(큐는 Provider를 모른다). */
    function cancelPending(id){
      var idx = pending.indexOf(id);
      if(idx===-1) return false;
      pending.splice(idx,1);
      set(id, { status:'cancelled' });
      return true;
    }

    function progress(){
      var total = order.length;
      var done = order.filter(function(id){ var s=items[id].status; return s==='completed'||s==='failed'||s==='cancelled'; }).length;
      var processing = order.filter(function(id){ return items[id].status==='processing'; }).length;
      return { done: done, total: total, processing: processing, queued: pending.length };
    }

    return {
      enqueue: enqueue, cancelPending: cancelPending, progress: progress,
      items: function(){ return items; }, order: function(){ return order.slice(); },
      maxConcurrency: maxConcurrency
    };
  };

})(window.AtlasImageGenerationQueue);
