/* server/image-rate-limiter.js — Phase 15: 동시 OpenAI 호출 수를 제한하는 Semaphore.
   "썸네일 5장/상세페이지 9장을 동시에 무제한 호출하지 마세요. 기본 동시 생성 수: 2"
   요구를 서버 단(전체 프로세스 기준, 여러 브라우저 탭/사용자를 포함해 방어)에서
   강제한다. 클라이언트 큐(js/image-generation-queue.js)의 동시성 제한과는 별개의
   방어선(defense in depth)이다. */

function createSemaphore(maxConcurrency){
  maxConcurrency = maxConcurrency>0 ? maxConcurrency : 2;
  var active = 0;
  var queue = [];

  function release(){
    active--;
    var next = queue.shift();
    if(next) grant(next);
  }

  function grant(resolve){
    active++;
    resolve(release);
  }

  function acquire(){
    return new Promise(function(resolve){
      if(active < maxConcurrency) grant(resolve);
      else queue.push(resolve);
    });
  }

  return {
    acquire: acquire,
    activeCount: function(){ return active; },
    queueLength: function(){ return queue.length; },
    maxConcurrency: maxConcurrency
  };
}

module.exports = { createSemaphore: createSemaphore };
