/* js/ebook-progress-store.js — Incremental Ebook 생성 진행 상태 중 "무거운" 내용
   (outline/각 챕터 본문/부록/최종 병합본)을 IndexedDB에 저장한다. localStorage
   Draft(atlasCollectDraft)에는 상태/진행률/타임스탬프 같은 가벼운 값만 남기고,
   본문 전체(수만 자)는 여기로 분리해 localStorage가 무리하게 커지지 않게 한다.
   IndexedDB를 쓸 수 없는 환경(비공개 모드 등)에서는 조용히 실패로 처리하고
   메모리 상 진행 상태만으로 계속 동작한다(치명적이지 않음). */

window.AtlasEbookProgressStore = window.AtlasEbookProgressStore || {};

(function(S){
  var DB_NAME='atlas_ebook_progress_db', STORE_NAME='progress', DB_VERSION=1;

  function openDb(){
    return new Promise(function(resolve, reject){
      if(!('indexedDB' in window)){ reject(new Error('IndexedDB unsupported')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }

  S.save = function(key, value){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ reject(tx.error); };
      });
    }).catch(function(){ return false; });
  };

  S.load = function(key){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = function(){ resolve(req.result||null); };
        req.onerror = function(){ reject(req.error); };
      });
    }).catch(function(){ return null; });
  };

  S.remove = function(key){
    return openDb().then(function(db){
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ resolve(false); };
      });
    }).catch(function(){ return false; });
  };
})(window.AtlasEbookProgressStore);
