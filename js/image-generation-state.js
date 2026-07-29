/* js/image-generation-state.js — Phase 14: Image Production 상태

   APP 객체에 이번 Phase에 필요한 값만 딱 하나(APP.imageProduction)로 모아 둔다 —
   기존 APP 필드(marketingCopy/thumbnailBlueprint/creativeCampaign 등)는 전혀
   건드리지 않는다. 레거시 저장본(이 필드가 없는 이전 프로젝트)을 불러와도
   APP.imageProduction이 없을 뿐 에러 없이 그대로 동작해야 하므로, 이 상태는
   저장/불러오기 JSON에 포함시키지 않는다(세션 동안만 유지되는 생성 진행 상태 —
   대용량 이미지 데이터를 기존 저장 JSON에 넣지 않는다는 정책과 일치). */

window.AtlasImageProductionState = window.AtlasImageProductionState || {};

(function(S){

  S.VERSION = 1;

  function emptyState(){
    return {
      version: S.VERSION,
      /* Phase 15 §9: OpenAI Provider가 설정되어 있으면 기본값은 항상 openai-gpt-image다.
         설정 여부는 비동기로만 확인 가능하므로(서버 /status 조회), 이 시점에는 아직
         모른다는 뜻의 null로 시작하고, AtlasImageProductionUI.populate()가 상태 확인
         직후 실제 기본값을 정한다 — Mock으로 조용히 대체하지 않는다. */
      selectedProviderId: null,
      providerStatusChecked: false,
      thumbnailQueue: null,
      salesPageQueue: null,
      thumbnail: { concepts: [], results: [], selectedResultId: null, finalComposite: null },
      salesPage: { scenes: [], resultsByPage: {}, finalComposites: {} },
      /* Phase 15.2: Creative Director — Generate 전에 사용자가 먼저 보는 판매 전략
         기획(Concept-First Workflow). 레거시 저장본에는 없을 수 있으므로 S.get()이
         항상 방어적으로 채워 넣는다(아래 emptyCreativeDirector 참고). */
      creativeDirector: emptyCreativeDirector(),
      jobs: {},
      errors: [],
      exportStatus: 'idle'
    };
  }

  function emptyCreativeDirector(){
    return {
      thumbnailConcepts: [],
      salesPageScenes: [],
      thumbnailPlanStatus: 'unplanned',
      salesPagePlanStatus: 'unplanned',
      lastPlannedAt: null
    };
  }

  function revokeIfBlobUrl(url){
    if(typeof url === 'string' && url.indexOf('blob:')===0){
      try{ URL.revokeObjectURL(url); }catch(e){}
    }
  }

  /* results 배열/finalComposite 안에 남아 있는 모든 objectUrl(blob: 문자열만)을
     정리한다 — data: URL(Mock의 Canvas 출력)은 revoke 대상이 아니므로 건드리지 않는다. */
  function revokeAllUrls(state){
    if(!state) return;
    (state.thumbnail && state.thumbnail.results || []).forEach(function(r){ if(r.image) revokeIfBlobUrl(r.image.objectUrl); });
    if(state.thumbnail && state.thumbnail.finalComposite) revokeIfBlobUrl(state.thumbnail.finalComposite.dataUrl);
    var resultsByPage = (state.salesPage && state.salesPage.resultsByPage) || {};
    Object.keys(resultsByPage).forEach(function(k){
      (resultsByPage[k]||[]).forEach(function(r){ if(r.image) revokeIfBlobUrl(r.image.objectUrl); });
    });
    var finals = (state.salesPage && state.salesPage.finalComposites) || {};
    Object.keys(finals).forEach(function(k){ if(finals[k]) revokeIfBlobUrl(finals[k].dataUrl); });
  }

  /* 이미 APP.imageProduction이 있으면 건드리지 않는다(중복 초기화 방지) — 새 프로젝트/
     리셋 시에만 새로 만든다. */
  S.init = function(){
    if(typeof APP === 'undefined') return null;
    if(!APP.imageProduction) APP.imageProduction = emptyState();
    return APP.imageProduction;
  };

  S.reset = function(){
    if(typeof APP === 'undefined') return;
    revokeAllUrls(APP.imageProduction);
    if(typeof AtlasImageEngine!=='undefined' && AtlasImageEngine.reset) AtlasImageEngine.reset();
    APP.imageProduction = emptyState();
  };

  S.get = function(){
    if(typeof APP === 'undefined') return null;
    var st = APP.imageProduction || S.init();
    /* 레거시 호환: Phase 15.2 이전에 만들어진 imageProduction(또는 옛 저장본)에는
       creativeDirector가 없을 수 있다 — 에러 없이 그 자리만 채워 넣는다. */
    if(st && !st.creativeDirector) st.creativeDirector = emptyCreativeDirector();
    return st;
  };

})(window.AtlasImageProductionState);
