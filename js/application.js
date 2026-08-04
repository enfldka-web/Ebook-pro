// ════════════════════════════════════════
// DATA & STATE
// ════════════════════════════════════════
var APP={user:null,ebook:null,editMode:false,salesEditMode:false,selFile:null,selPlan:'free',urlContent:'',multiFiles:[],multiLinks:[],titleCandidates:[],selectedTitleIndex:-1,lockedTitle:'',lockedSubtitle:'',workspaceStage:'input',projectName:'',projectUpdatedAt:null,interviewQuestions:[],interviewAnswers:{},interviewContext:'',smartAnalysis:null,plannerReport:null,brandProfile:null,marketingCopy:null,thumbnailBlueprint:null,salesPageBlueprint:null,ebookBlueprint:null,ebookProgress:null};

// ════════════════════════════════════════
// ATLAS v0.7 SMART PREMIUM ENGINE
// ════════════════════════════════════════
var ATLAS_STAGE_ORDER=['input','analysis','title','planner','ebook','sales','publish'];
var ATLAS_STAGE_INFO={
 input:{pct:8,label:'1단계 · 자료 준비',badge:'기획 시작',coach:'파일, 주제 또는 URL 중 편한 방식을 선택하세요. 입력한 내용은 브라우저에 임시 저장됩니다.'},
 analysis:{pct:22,label:'2단계 · 자료 분석',badge:'분석 중',coach:'Atlas가 핵심 주제, 독자, 문제와 차별화 각도를 정리하고 있습니다.'},
 title:{pct:36,label:'3단계 · 제목과 후킹',badge:'선택 필요',coach:'후킹과 신뢰를 함께 고려해 제목을 고르세요. 선택한 제목은 모든 결과물에 연결됩니다.'},
 planner:{pct:50,label:'4단계 · AI 기획 승인',badge:'승인 필요',coach:'AI Planner가 정리한 기획안을 확인하고 Brand Pack을 선택한 뒤 승인하세요.'},
 ebook:{pct:100,label:'5단계 · 전자책 완성',badge:'전자책 완성',coach:'전자책이 완성되었습니다. 내용과 제목을 검토한 뒤 판매 디자인으로 이동하세요.'},
 sales:{pct:88,label:'6단계 · 판매 디자인',badge:'디자인 작업',coach:'썸네일, 상세페이지와 전자책 판매자료를 확인하고 가장 적합한 시안을 선택하세요.'},
 publish:{pct:100,label:'7단계 · 판매 준비 완료',badge:'출시 가능',coach:'최종 결과물을 저장하고 크몽 등록 전 정책 검사와 문구를 한 번 더 확인하세요.'}
};
function atlasProjectStorageKey(){return 'atlas_project_draft_v07';}
function atlasGuessProjectName(){
 var t='';
 if(APP.lockedTitle)t=APP.lockedTitle;
 else if(typeof CV_MODE!=='undefined'&&CV_MODE==='topic'){var el=document.getElementById('topic-main');t=el&&el.value.trim();}
 else if(typeof CV_MODE!=='undefined'&&CV_MODE==='file'&&APP.selFile)t=APP.selFile.name.replace(/\.[^.]+$/,'');
 else if(typeof CV_MODE!=='undefined'&&CV_MODE==='url'){var u=document.getElementById('url-input');t=u&&u.value.trim();}
 else if(typeof CV_MODE!=='undefined'&&CV_MODE==='multi'){var d=document.getElementById('ms-direction');t=d&&d.value.trim();}
 return t||'새 전자책 프로젝트';
}
function atlasSetWorkspaceStage(stage,opts){
 opts=opts||{};if(ATLAS_STAGE_ORDER.indexOf(stage)<0)stage='input';APP.workspaceStage=stage;
 var info=ATLAS_STAGE_INFO[stage];var idx=ATLAS_STAGE_ORDER.indexOf(stage);
 var title=atlasGuessProjectName();APP.projectName=title;APP.projectUpdatedAt=Date.now();
 var pe=document.getElementById('aw-project-title');if(pe)pe.textContent=title;
 var meta=document.getElementById('aw-project-meta');if(meta)meta.textContent=(typeof CV_MODE!=='undefined'?'입력 방식: '+({file:'PLR·문서',topic:'주제 직접 입력',url:'URL 참고'}[CV_MODE]||CV_MODE)+' · ':'')+'마지막 저장 '+new Date(APP.projectUpdatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
 var sl=document.getElementById('aw-stage-label');if(sl)sl.textContent=info.label;
 var pt=document.getElementById('aw-progress-text');if(pt)pt.textContent=info.pct+'%';
 var pb=document.getElementById('aw-progress-bar');if(pb)pb.style.width=info.pct+'%';
 var badge=document.getElementById('aw-status-badge');if(badge)badge.textContent=info.badge;
 var coach=document.getElementById('aw-coach-text');if(coach)coach.textContent=opts.coach||info.coach;
 document.querySelectorAll('[data-aw-step]').forEach(function(el){var n=ATLAS_STAGE_ORDER.indexOf(el.getAttribute('data-aw-step'));el.classList.toggle('done',n<idx);el.classList.toggle('active',n===idx);});
 if(!opts.noSave)atlasSaveDraft(false);
}
/* Phase 17.1: 사용자 기본 화면에 보여줄 4단계(STEP1~4) 배너 — 기존 7단계
   ATLAS_STAGE_ORDER/atlasSetWorkspaceStage는 그대로 두고(내부 저장/코치 문구용),
   화면에 실제로 어떤 STATE div가 보이는지를 기준으로 이 배너만 별도로 갱신한다. */
/* Atlas Visual Redesign v2, Phase R10 — Result screen (STEP 4) header: the
   most important screen in the app previously had the weakest header (a
   single caption line, no title), unlike Title Studio/AI Planner's full
   eyebrow+title+sub treatment. Called from renderCvEbook() (renderers.js)
   with the same real ebook object already being rendered — chrome-only,
   does not touch the actual exported ebook page content. */
function atlasUpdateResultHeader(e){
  var t=document.getElementById('cv-result-title');
  if(t)t.textContent=(e&&e.title)?e.title:'전자책이 완성되었습니다';
}
function atlasSetSimpleStep(step){
 document.querySelectorAll('[data-aw-simple-step]').forEach(function(el){
  var n=parseInt(el.getAttribute('data-aw-simple-step'),10);
  el.classList.toggle('done',n<step);el.classList.toggle('active',n===step);
 });
}
function atlasCollectDraft(){
 function val(id){var e=document.getElementById(id);return e?e.value:'';}
 return {version:'0.7',savedAt:Date.now(),stage:APP.workspaceStage||'input',interviewQuestions:APP.interviewQuestions||[],interviewAnswers:APP.interviewAnswers||{},interviewContext:APP.interviewContext||'',smartAnalysis:APP.smartAnalysis||null,mode:typeof CV_MODE!=='undefined'?CV_MODE:'file',lockedTitle:APP.lockedTitle||'',lockedSubtitle:APP.lockedSubtitle||'',titleCandidates:APP.titleCandidates||[],titleAnalysis:APP.titleAnalysis||{},topic:{main:val('topic-main'),target:val('topic-target'),extra:val('topic-extra')},url:{input:val('url-input'),direction:val('url-direction'),extra:val('url-extra'),content:APP.urlContent||''},multi:{notes:val('ms-notes'),direction:val('ms-direction'),links:APP.multiLinks||[],files:(APP.multiFiles||[]).map(function(f){return {name:f.name,role:f.role};})},ebook:APP.ebook||null,ebookProgress:ebookProgressLightweight(APP.ebookProgress),thumbnailStudio:APP.thumbnailStudio||null,salesPageStudio:APP.salesPageStudio||null,brandTheme:APP.brandTheme||null,plannerReport:APP.plannerReport||null,brandProfile:APP.brandProfile||null,marketingCopy:APP.marketingCopy||null,thumbnailBlueprint:APP.thumbnailBlueprint||null,salesPageBlueprint:APP.salesPageBlueprint||null,ebookBlueprint:APP.ebookBlueprint||null,creativeCampaign:APP.creativeCampaign||null};
}
function atlasSaveDraft(show){try{localStorage.setItem(atlasProjectStorageKey(),JSON.stringify(atlasCollectDraft()));if(show)showToast('success','현재 프로젝트를 저장했습니다.');}catch(e){if(show)showToast('error','프로젝트 저장에 실패했습니다.');}}
function atlasLoadDraft(show){
 try{var raw=localStorage.getItem(atlasProjectStorageKey());if(!raw){if(show)showToast('info','저장된 프로젝트가 없습니다.');return;}var d=JSON.parse(raw);
 APP.lockedTitle=d.lockedTitle||'';APP.lockedSubtitle=d.lockedSubtitle||'';APP.titleCandidates=d.titleCandidates||[];APP.titleAnalysis=d.titleAnalysis||{};APP.interviewQuestions=d.interviewQuestions||[];APP.interviewAnswers=d.interviewAnswers||{};APP.interviewContext=d.interviewContext||'';APP.smartAnalysis=d.smartAnalysis||null;APP.plannerReport=d.plannerReport||null;APP.brandProfile=d.brandProfile||null;APP.marketingCopy=d.marketingCopy||null;APP.thumbnailBlueprint=d.thumbnailBlueprint||null;APP.salesPageBlueprint=d.salesPageBlueprint||null;APP.ebookBlueprint=d.ebookBlueprint||null;APP.creativeCampaign=d.creativeCampaign||null;APP.urlContent=d.url&&d.url.content||'';APP.multiLinks=d.multi&&d.multi.links||[];if(d.ebook)APP.ebook=d.ebook;APP._ebookProgressLightweightHint=d.ebookProgress||null;APP.ebookProgress=null;
 if(d.thumbnailStudio){APP.thumbnailStudio=d.thumbnailStudio;}else{delete APP.thumbnailStudio;}
 if(typeof ThumbnailStudio!=='undefined'&&typeof ThumbnailStudio.init==='function')ThumbnailStudio.init();
 if(d.salesPageStudio){APP.salesPageStudio=d.salesPageStudio;}else{delete APP.salesPageStudio;}
 if(typeof SalesPageStudio!=='undefined'&&typeof SalesPageStudio.init==='function')SalesPageStudio.init();
 if(typeof AtlasDesignSystem!=='undefined'&&typeof AtlasDesignSystem.restoreTheme==='function')AtlasDesignSystem.restoreTheme(d.brandTheme&&d.brandTheme.themeId?d.brandTheme.themeId:null);
 function setv(id,v){var e=document.getElementById(id);if(e)e.value=v||'';}
 setv('topic-main',d.topic&&d.topic.main);setv('topic-target',d.topic&&d.topic.target);setv('topic-extra',d.topic&&d.topic.extra);setv('url-input',d.url&&d.url.input);setv('url-direction',d.url&&d.url.direction);setv('url-extra',d.url&&d.url.extra);setv('ms-notes',d.multi&&d.multi.notes);setv('ms-direction',d.multi&&d.multi.direction);
 if(typeof switchInputTab==='function'&&d.mode)switchInputTab(d.mode);if(typeof renderMultiLinks==='function')renderMultiLinks();
 atlasSetWorkspaceStage(d.stage||'input',{noSave:true,coach:'저장된 프로젝트를 불러왔습니다. 파일은 보안상 다시 선택해야 할 수 있습니다.'});if(typeof checkCvReady==='function')checkCvReady();if(typeof restoreEbookProgressFromIndexedDb==='function')restoreEbookProgressFromIndexedDb();if(show)showToast('success','저장된 프로젝트를 불러왔습니다.');
 }catch(e){if(show)showToast('error','프로젝트 불러오기에 실패했습니다.');}
}
function atlasClearDraft(){if(!confirm('저장된 임시 프로젝트를 지울까요?'))return;localStorage.removeItem(atlasProjectStorageKey());if(typeof AtlasEbookProgressStore!=='undefined'&&AtlasEbookProgressStore.remove)AtlasEbookProgressStore.remove('current');if(typeof resetConverter==='function')resetConverter();showToast('success','임시 프로젝트를 지웠습니다.');}
/* Atlas Redesign Phase 4 (Dashboard): read-only summary of the single-slot
   draft, if one exists — no side effects, no state mutation, purely for
   display. Reuses the same localStorage key/shape atlasSaveDraft/atlasLoadDraft
   already read and write; does not introduce a new storage format. */
function atlasGetDraftSummary(){
  try{
    var raw=localStorage.getItem(atlasProjectStorageKey());
    if(!raw)return null;
    var d=JSON.parse(raw);
    if(!d||typeof d!=='object')return null;
    var stage=(d.stage&&ATLAS_STAGE_INFO[d.stage])?d.stage:'input';
    var info=ATLAS_STAGE_INFO[stage];
    var title=(d.lockedTitle||(d.topic&&d.topic.main)||'').trim()||'새 전자책 프로젝트';
    var pct=(d.ebookProgress&&typeof d.ebookProgress.progressPct==='number')?d.ebookProgress.progressPct:info.pct;
    return {title:title,stageLabel:info.label,badge:info.badge,pct:pct,savedAt:d.savedAt||null};
  }catch(e){return null;}
}
function atlasRelativeTime(ts){
  if(!ts)return '';
  var diffMin=Math.round((Date.now()-ts)/60000);
  if(diffMin<1)return '방금 저장됨';
  if(diffMin<60)return diffMin+'분 전 저장됨';
  var diffHr=Math.round(diffMin/60);
  if(diffHr<24)return diffHr+'시간 전 저장됨';
  return new Date(ts).toLocaleDateString('ko-KR')+' 저장됨';
}
/* Dashboard "이어서 작업하기" — reuses the exact same working path as the
   existing in-converter "↻ 저장 프로젝트 불러오기" button (index.html), just
   triggered from outside the converter screen. showApp('converter') lands
   on the default STEP1 view (setupConverter/checkCvReady, no forced reset
   since we're entering converter, not leaving it), then atlasLoadDraft(true)
   restores the saved project exactly as it already does today. */
function atlasResumeDraft(){showApp('converter');atlasLoadDraft(true);}
/* 어느 화면/단계에 있든(같은 converter 섹션에 이미 머물러 있어도) 항상 실제로
   새 프로젝트 상태로 되돌리기 위해 showApp('converter') 전에 반드시 resetConverter()를
   먼저 호출한다 — showApp()은 section이 이미 'converter'면 내부 상태를 리셋하지 않는다. */
function startNewEbookProject(){resetConverter();showApp('converter');}
function atlasBindDraftAutosave(){
 ['topic-main','topic-target','topic-extra','url-input','url-direction','url-extra','ms-notes','ms-direction'].forEach(function(id){var e=document.getElementById(id);if(e&&!e.dataset.atlasBound){e.dataset.atlasBound='1';e.addEventListener('input',function(){atlasSetWorkspaceStage('input',{coach:'입력 내용을 저장했습니다. 자료 분석을 시작하면 제목 후보를 만들 수 있습니다.'});});}});
}

var FF_SKETCH = "'Nanum Pen Script',cursive";
var FF_NOTEBOOK = "'Gaegu','Nanum Pen Script',cursive";
var PLANS={free:{name:'BETA',limit:9999,badge:'plan-pro'},starter:{name:'BETA',limit:9999,badge:'plan-pro'},pro:{name:'BETA',limit:9999,badge:'plan-pro'}};

function getUsers(){return JSON.parse(localStorage.getItem('plrbooks_users')||'{}');}
function saveUsers(u){localStorage.setItem('plrbooks_users',JSON.stringify(u));}
function getUser(email){return getUsers()[email]||null;}
function setCurrentUser(u){localStorage.setItem('plrbooks_cu',JSON.stringify(u));APP.user=u;}
function getCurrentUser(){var u=localStorage.getItem('plrbooks_cu');return u?JSON.parse(u):null;}
function clearCurrentUser(){localStorage.removeItem('plrbooks_cu');APP.user=null;}
/* 브라우저는 Anthropic API Key를 절대 들고 있지 않는다 — 모든 호출은
   AtlasAnthropicGateway(js/anthropic-gateway-client.js)를 거쳐 서버(localhost:8910)
   → Anthropic 순서로만 이루어진다. 아래는 그 서버 상태를 읽고 표시하는 헬퍼다. */
function atlasGatewayStatus(){
  var g=window.AtlasAnthropicGateway;
  return g ? g.getStatusCache() : {reachable:false,configured:false,checked:false};
}
function refreshAtlasGatewayStatus(){
  var g=window.AtlasAnthropicGateway;
  if(!g)return Promise.resolve({reachable:false,configured:false,checked:true});
  return g.refreshStatus().then(function(st){ if(typeof checkCvReady==='function')checkCvReady(); return st; });
}
function testGatewayConnection(){
  var el=document.getElementById('api-test-result');
  /* Atlas Redesign Phase 2 (Loading state): show an immediate inline loading
     indicator instead of leaving the result box untouched until the request
     resolves — the toast alone was too transient to count as feedback. */
  if(el && window.AtlasStateSystem){el.className='';el.style.display='block';el.style.background='';el.style.color='';el.innerHTML=AtlasStateSystem.loadingInline('AI 서버 연결 확인 중...');}
  showToast('info','AI 서버 연결 확인 중...');
  refreshAtlasGatewayStatus().then(function(st){
    if(!st.reachable){
      if(el){el.style.display='block';el.className='a2-banner a2-banner-error';el.innerHTML='<span data-icon="alertTriangle"></span><span>AI 서버가 실행되지 않았습니다.</span>';if(window.AtlasIcons)AtlasIcons.applyAll(el);}
      showToast('error','AI 서버가 실행되지 않았습니다.');
      return;
    }
    if(!st.configured){
      if(el){el.style.display='block';el.className='a2-banner a2-banner-warning';el.innerHTML='<span data-icon="alertTriangle"></span><span>AI 서버는 실행 중이지만 Anthropic API 키가 설정되지 않았습니다.</span>';if(window.AtlasIcons)AtlasIcons.applyAll(el);}
      showToast('error','서버에 API 키가 설정되지 않았습니다.');
      return;
    }
    if(el){el.style.display='block';el.className='a2-banner a2-banner-success';el.innerHTML='<span data-icon="checkCircle"></span><span>AI 서버가 정상적으로 연결되어 있습니다.</span>';if(window.AtlasIcons)AtlasIcons.applyAll(el);}
    showToast('success','AI 서버 연결 정상!');
  });
}
function getUserEbooks(email){
  // 전체 localStorage 스캔 - 이메일 무관하게 모든 전자책 통합
  var all=[];
  var seen={};
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(k&&k.startsWith('plrbooks_eb_')){
      try{
        var arr=JSON.parse(localStorage.getItem(k)||'[]');
        arr.forEach(function(e){
          if(e&&e.id&&!seen[e.id]){seen[e.id]=true;all.push(e);}
        });
      }catch(e2){}
    }
  }
  // 날짜 내림차순 정렬
  all.sort(function(a,b){return (b.id||0)-(a.id||0);});
  // 전역 키에 통합 저장
  localStorage.setItem('plrbooks_eb_global',JSON.stringify(all));
  return all;
}
function saveUserEbooks(email,arr){localStorage.setItem('plrbooks_eb_global',JSON.stringify(arr));}
function addEbook(email,ebook){var arr=getUserEbooks(email);arr.unshift({id:Date.now(),created:new Date().toLocaleDateString('ko-KR'),title:ebook.title,category:ebook.category||'자기계발',data:ebook});if(arr.length>50)arr=arr.slice(0,50);saveUserEbooks(email,arr);}
function getThisMonthCount(email){var arr=getUserEbooks(email);var now=new Date();var mon=now.getFullYear()+'-'+(now.getMonth()+1);return arr.filter(function(e){return e.id&&new Date(e.id).getMonth()===now.getMonth()&&new Date(e.id).getFullYear()===now.getFullYear();}).length;}

// ════════════════════════════════════════
// PAGE NAVIGATION
// ════════════════════════════════════════

// 체험판 - 항상 통과 (날짜 제한 없음)
function checkAccessPeriod(){return true;}


var LATPEED_URL='https://www.latpeed.com/memberships/69e81cb28dffc208089f1e8e';

function openLatpeed(){window.open(LATPEED_URL,"_blank");}
function showTrialLimitPopup(type){
  var typeNames={file:'파일 업로드',topic:'주제 키워드',url:'URL',text:'텍스트',sales:'상세페이지'};
  var typeName=typeNames[type]||type;
  var p=document.createElement('div');
  p.className='atlas-modal-bg';
  var inner=document.createElement('div');
  inner.className='atlas-modal';
  inner.style.cssText='max-width:400px;text-align:center';
  inner.innerHTML='<div class="a2-icon-chip amber" data-icon="lock" style="margin:0 auto 16px"></div>'
    +'<h3 style="margin-bottom:8px">'+typeName+' 체험 횟수 초과</h3>'
    +'<p style="margin-bottom:24px">무료 체험판은 방식별 1회만 사용 가능합니다.<br>무제한으로 사용하려면 구독해주세요!</p>';
  var btn1=document.createElement('button');
  btn1.className='a2-btn a2-btn-primary';
  btn1.style.cssText='width:100%;margin-bottom:10px';
  btn1.textContent='월 ₩29,000로 무제한 시작';
  btn1.onclick=function(){window.open(LATPEED_URL,'_blank');};
  var btn2=document.createElement('button');
  btn2.className='a2-btn a2-btn-secondary';
  btn2.style.width='100%';
  btn2.textContent='닫기';
  btn2.onclick=function(){p.remove();};
  inner.appendChild(btn1);
  inner.appendChild(btn2);
  p.appendChild(inner);
  document.body.appendChild(p);
  if(window.AtlasIcons)AtlasIcons.applyAll(inner);
}

function showTrialWelcomePopup(){
  if(localStorage.getItem('plrbooks_trial_welcomed'))return;
  localStorage.setItem('plrbooks_trial_welcomed','1');
  var p=document.createElement('div');
  p.className='atlas-modal-bg';
  var inner=document.createElement('div');
  inner.className='atlas-modal';
  inner.style.cssText='max-width:400px;text-align:center';
  inner.innerHTML='<div class="a2-icon-chip violet" data-icon="sparkle" style="margin:0 auto 16px"></div>'
    +'<h3 style="margin-bottom:8px">무료 체험판에 오신 걸 환영합니다!</h3>'
    +'<p style="margin-bottom:24px">파일·주제·URL·상세페이지<br>각 방식별 <b style="color:var(--a2-accent)">1회씩</b> 무료로 체험하실 수 있습니다.</p>';
  var btn=document.createElement('button');
  btn.className='a2-btn a2-btn-primary';
  btn.style.width='100%';
  btn.textContent='시작하기';
  btn.onclick=function(){p.remove();};
  inner.appendChild(btn);
  p.appendChild(inner);
  document.body.appendChild(p);
  if(window.AtlasIcons)AtlasIcons.applyAll(inner);
}

function getTrialCount(){
  try{var t=localStorage.getItem('plrbooks_trial');return t?JSON.parse(t):{file:0,topic:0,url:0,multi:0,text:0,sales:0};}
  catch(e){return {file:0,topic:0,url:0,multi:0,text:0,sales:0};}
}
function addTrialCount(type){
  var t=getTrialCount();
  t[type]=(t[type]||0)+1;
  localStorage.setItem('plrbooks_trial',JSON.stringify(t));
}
function canGenerate(type){ return true; }

function showPage(pg,sub){
  /* Atlas Redesign Phase 3 investigation: #pg-access-block has no matching
     element anywhere in index.html today (checkAccessPeriod() below is
     stubbed to always return true, i.e. the access gate is currently open).
     This defensive hide is left in place rather than removed — it is cheap,
     harmless, and is the correct hook for whenever a real access-gate
     overlay is reintroduced under this ID. Not dead code to delete, just a
     currently-inactive feature hook (Coding Bible: never delete based on
     "appears unused" alone; confirm intent first). */
  var ab=document.getElementById('pg-access-block');
  if(ab){ab.style.display='none';ab.style.position='';ab.style.zIndex='';}
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  var el=document.getElementById('pg-'+pg);
  if(!el)return;
  el.classList.add('active');
  if(pg==='auth'){
    if(sub==='signup')switchAuthTab('signup');
    else switchAuthTab('login');
  }
  if(pg==='app'){
    if(!checkAccessPeriod())return;
    initApp();
    if(sub)showApp(sub);
  }
  window.scrollTo(0,0);
}
function showApp(section){
  // 1. 모든 콘텐츠 섹션 숨기기
  var sections=['dashboard','converter','history','settings'];
  sections.forEach(function(s){
    var el=document.getElementById('app-'+s);
    if(el)el.style.display='none';
    var sb=document.getElementById('sb-'+s);
    if(sb)sb.classList.remove('active');
    var tb=document.getElementById('tb-'+s);
    if(tb)tb.classList.remove('active');
  });

  // 2. 요청 섹션 표시
  var target=document.getElementById('app-'+section);
  if(target)target.style.display='block';
  var sbTarget=document.getElementById('sb-'+section);
  if(sbTarget)sbTarget.classList.add('active');
  var tbTarget=document.getElementById('tb-'+section);
  if(tbTarget)tbTarget.classList.add('active');

  // 3. 상단바 제목
  var titles={dashboard:'대시보드',converter:'전자책 생성',history:'내 전자책',settings:'설정'};
  var tt=document.getElementById('topbar-title');
  if(tt)tt.textContent=titles[section]||section;

  // 4. 사이드바 닫기 (모바일)
  closeSidebar();

  // 5. 섹션 진입 시 렌더
  if(section==='dashboard')renderDashboard();
  else if(section==='history')renderHistory();
  else if(section==='settings')renderSettings();
  else if(section==='converter'){setupConverter();checkCvReady();}

  // 6. converter 벗어날 때 내부 상태 리셋
  if(section!=='converter'){
    ['cv-process-state','cv-result-state','cv-sales-state','cv-planner-state'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.style.display='none';
    });
    var up=document.getElementById('cv-upload-state');
    if(up)up.style.display='';
  }
  // scroll to top
  window.scrollTo(0,0);
  var mc=document.querySelector('.main-content');
  if(mc)mc.scrollTop=0;
}

function toggleSidebar(){var sb=document.getElementById('sidebar');var ov=document.getElementById('sb-overlay');sb.classList.toggle('open');ov.classList.toggle('show');}
function closeSidebar(){var sb=document.getElementById('sidebar');var ov=document.getElementById('sb-overlay');sb.classList.remove('open');ov.classList.remove('show');}

// ════════════════════════════════════════
// AUTH
// ════════════════════════════════════════
function switchAuthTab(tab){
  document.getElementById('tab-login').classList.toggle('active',tab==='login');
  document.getElementById('tab-signup').classList.toggle('active',tab==='signup');
  document.getElementById('form-login').style.display=tab==='login'?'':'none';
  document.getElementById('form-signup').style.display=tab==='signup'?'':'none';
}
function selectPlan(plan,el){
  APP.selPlan=plan;
  document.querySelectorAll('.plan-chip').forEach(function(c){c.classList.remove('sel');});
  el.classList.add('sel');
}
function doLogin(){
  var email=document.getElementById('l-email').value.trim();
  var pw=document.getElementById('l-pw').value;
  var err=document.getElementById('login-err');
  if(!email||!pw){showErr(err,'이메일과 비밀번호를 입력해주세요.');return;}
  var u=getUser(email);
  if(!u){
    // 계정 없으면 자동 생성
    var name=email.split('@')[0];
    u={name:name,email:email,pw:btoa(pw),plan:'free',joined:new Date().toLocaleDateString('ko-KR')};
    var users=getUsers();users[email]=u;saveUsers(users);
    setCurrentUser(u);showPage('app','dashboard');showToast('success','환영합니다! 자동으로 계정이 생성됐습니다.');
  } else if(u.pw!==btoa(pw)){
    showErr(err,'비밀번호가 올바르지 않습니다. 다시 확인해주세요.');return;
  } else {
    setCurrentUser(u);showPage('app','dashboard');showToast('success','반갑습니다, '+u.name+'님!');
  }
}
function doSignup(){
  var name=document.getElementById('s-name').value.trim();
  var email=document.getElementById('s-email').value.trim();
  var pw=document.getElementById('s-pw').value;
  var err=document.getElementById('signup-err');
  if(!name||!email||!pw){showErr(err,'모든 항목을 입력해주세요.');return;}
  if(pw.length<8){showErr(err,'비밀번호는 8자 이상이어야 합니다.');return;}
  var users=getUsers();
  if(users[email]){showErr(err,'이미 사용 중인 이메일입니다.');return;}
  var u={name:name,email:email,pw:btoa(pw),plan:APP.selPlan,joined:new Date().toLocaleDateString('ko-KR')};
  users[email]=u;saveUsers(users);setCurrentUser(u);
  showPage('app','dashboard');showToast('success','가입 완료! 첫 전자책을 만들어보세요.');
}
function doLogout(){clearCurrentUser();APP.ebook=null;APP.selFile=null;showPage('landing');showToast('success','로그아웃되었습니다.');}
function showErr(el,msg){el.textContent=msg;el.style.display='block';}

// ════════════════════════════════════════
// APP INIT
// ════════════════════════════════════════
function initApp(){
  if(!getCurrentUser()){
    var proUser={email:'pro@user',name:'구독자',plan:'pro'};
    setCurrentUser(proUser);
  }
  var u=getCurrentUser();if(!u){showPage('landing');return;}
  APP.user=u;
  // update sidebar
  var uname=document.getElementById('sb-uname');
  if(uname)uname.textContent=u.name;
  var pb=document.getElementById('sb-uplan');
  if(pb){pb.textContent=PLANS[u.plan]?.name||'FREE';pb.className='plan-badge plan-'+(u.plan||'free');}
  // setup converter
  setupConverter();
  // AI 서버(Anthropic Gateway) 연결 상태를 미리 한 번 확인해둔다(Loading이 무한정
  // 걸리는 대신, 서버가 꺼져 있으면 즉시 안내 배너/버튼 상태로 반영된다).
  refreshAtlasGatewayStatus();
  // render dashboard
  showApp('dashboard');
  // setTimeout(showTrialWelcomePopup, 800); // 구독자용 비활성화
}
/* Atlas Visual Redesign v2, Phase R2 — truthful daily-count buckets derived
   from real ebook creation timestamps (eb.id === Date.now() at save time,
   see addEbook()). No fabricated movement: an account with no ebooks yet
   simply buckets to all-zero, which atlasSparklineSvg() renders as a calm
   flat line rather than a broken/empty chart. */
function atlasDailyCounts(ebooks,days){
  var now=new Date();now.setHours(0,0,0,0);
  var buckets=[];
  for(var i=days-1;i>=0;i--)buckets.push({t:now.getTime()-i*86400000,count:0});
  ebooks.forEach(function(eb){
    if(!eb.id)return;
    var d=new Date(eb.id);d.setHours(0,0,0,0);
    var diffDays=Math.round((now.getTime()-d.getTime())/86400000);
    if(diffDays>=0&&diffDays<days)buckets[days-1-diffDays].count++;
  });
  return buckets.map(function(b){return b.count;});
}
function atlasSparklineSvg(counts){
  var w=64,h=24,pad=2;
  var n=counts.length;
  var rawMax=Math.max.apply(null,counts);
  var stepX=(w-pad*2)/((n-1)||1);
  var pts=counts.map(function(c,i){
    var px=pad+i*stepX;
    var py=rawMax===0?h/2:(h-pad-(c/rawMax)*(h-pad*2));
    return [px,py];
  });
  var line=pts.map(function(p,i){return (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' ');
  var area=line+' L'+pts[pts.length-1][0].toFixed(1)+','+(h-pad)+' L'+pts[0][0].toFixed(1)+','+(h-pad)+' Z';
  return '<svg class="stat-spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><path d="'+area+'" class="stat-spark-fill" stroke="none"/><path d="'+line+'" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function renderDashboard(){
  if(!APP.user)return;
  var u=APP.user;
  var ebooks=getUserEbooks(u.email);
  var monthCount=getThisMonthCount(u.email);
  var cntEl=document.getElementById('dash-ebook-count');
  if(cntEl)cntEl.textContent=ebooks.length>0?'총 '+ebooks.length+'권 저장됨':'아직 생성한 전자책이 없습니다';
  var plan=PLANS[u.plan||'free'];
  var limitLeft=plan.limit-monthCount;

  /* Atlas Visual Redesign v2, Phase R2 — Dashboard as publishing control
     center. "What am I working on? / What should I do next?" answered from
     the real single-slot draft state (atlasGetDraftSummary) — no fabricated
     progress, no invented data. The work-center card is the FIRST/dominant
     element (subscription status moved below it — see upgrade-banner-wrap
     further down). Falls back to a calm start-new prompt when no draft
     exists. */
  var draft=atlasGetDraftSummary();
  var wc=document.getElementById('dash-workcenter');
  if(wc){
    if(draft){
      wc.innerHTML='<div class="dash-workcenter">'
        +'<div class="dash-workcenter-head"><span class="dash-workcenter-eyebrow">이어서 작업 중</span><span class="dash-workcenter-saved">'+x(atlasRelativeTime(draft.savedAt))+'</span></div>'
        +'<div class="dash-workcenter-title">'+x(draft.title)+'</div>'
        +'<div class="dash-workcenter-stage">'+x(draft.stageLabel)+'</div>'
        +'<div class="a2-progress"><div class="a2-progress-fill" style="width:'+draft.pct+'%"></div></div>'
        +'<div class="dash-workcenter-actions">'
        +'<button class="a2-btn a2-btn-primary" onclick="atlasResumeDraft()"><span data-icon="play"></span>이어서 작업하기</button>'
        +'<button class="a2-btn a2-btn-secondary" onclick="startNewEbookProject()"><span data-icon="plus"></span>새 전자책 시작</button>'
        +'</div></div>';
    } else {
      wc.innerHTML='<div class="dash-workcenter dash-workcenter-empty">'
        +'<div class="dash-workcenter-title">새로운 전자책을 시작해보세요</div>'
        +'<div class="dash-workcenter-stage">자료를 준비하면 Atlas가 제목부터 판매 이미지까지 함께 만듭니다.</div>'
        +'<div class="dash-workcenter-actions">'
        +'<button class="a2-btn a2-btn-primary" onclick="startNewEbookProject()"><span data-icon="plus"></span>새 전자책 시작</button>'
        +'</div></div>';
    }
  }

  /* Quiet secondary account/status line — deliberately NOT a dominant
     banner (Phase R2 correction #8). Same real, unconditional plan/logout-
     adjacent status text the app already showed pre-redesign (no NEW
     fabricated plan/price/quota/usage data introduced here — only the
     presentation and position changed, from a large gradient block above
     the work-center to a quiet text row below it). */
  var bw=document.getElementById('upgrade-banner-wrap');
  if(bw){
    bw.innerHTML='<div class="dash-status-row"><span data-icon="lock" data-icon-size="15"></span>'
      +'<span>구독자 전용 서비스 · 무제한으로 PLR 전자책을 생성하세요</span>'
      +'<span class="a2-badge a2-badge-success" style="margin-left:auto">구독 중</span></div>';
  }

  /* Quick Actions — icon-chip shortcuts to real, already-existing
     destinations only (Phase R2 explicit requirement: New Publication /
     Resume Current Draft when available / My Ebooks / Settings). "Resume"
     only appears when a draft genuinely exists — no fake affordance for
     nothing to resume. All four call existing, unmodified functions. */
  var qa=document.getElementById('dash-quickactions');
  if(qa){
    var actions=[{icon:'plus',color:'violet',label:'새 전자책 만들기',fn:'startNewEbookProject()'}];
    if(draft)actions.push({icon:'play',color:'amber',label:'이어서 작업하기',fn:'atlasResumeDraft()'});
    actions.push({icon:'library',color:'blue',label:'내 전자책',fn:"showApp('history')"});
    actions.push({icon:'settings',color:'green',label:'설정',fn:"showApp('settings')"});
    qa.innerHTML=actions.map(function(a){
      return '<button class="dash-qa-card" onclick="'+a.fn+'">'
        +'<span class="a2-icon-chip '+a.color+'" data-icon="'+a.icon+'"></span>'
        +'<span class="dash-qa-label">'+x(a.label)+'</span></button>';
    }).join('');
  }

  /* Only real, already-tracked counts — the two fabricated tiles (fixed
     "₩29,000" plan price, fixed "~10분" average time) stay removed (Phase 4
     finding, Never-Guess). Phase R2: the total-count tile gets a sparkline
     truthfully derived from real ebook creation timestamps (see
     atlasDailyCounts) — an account with no history yet gets a calm flat
     line, never fabricated movement. The monthly tile stays a plain number:
     a second parallel chart over the same sparse data would be redundant,
     not clearer. */
  var sg=document.getElementById('stat-grid');
  var spark=atlasSparklineSvg(atlasDailyCounts(ebooks,14));
  sg.innerHTML=[
    '<div class="stat-card"><div class="stat-card-top"><span class="a2-icon-chip blue" data-icon="book"></span>'+spark+'</div><div class="stat-val">'+ebooks.length+'</div><div class="stat-label">총 생성 전자책</div><div class="stat-caption">전체 이력 · 최근 14일 추이</div></div>',
    '<div class="stat-card"><div class="stat-card-top"><span class="a2-icon-chip green" data-icon="calendar"></span></div><div class="stat-val">'+monthCount+'</div><div class="stat-label">이번 달 생성</div><div class="stat-caption">무제한 이용 중</div></div>'
  ].join('');

  // recent projects — dashboard-only card, distinct from History's ebookCard()
  var de=document.getElementById('dash-ebooks');
  var recent=ebooks.slice(0,6);
  if(!recent.length){
    de.innerHTML='<div class="a2-empty"><div class="a2-empty-icon" data-icon="sparkle" data-icon-size="44"></div><div class="a2-empty-title">아직 생성한 전자책이 없어요</div><div class="a2-empty-sub">첫 PLR 전자책을 만들어보세요!</div><button class="a2-btn a2-btn-primary" onclick="showApp(\'converter\')"><span data-icon="plus"></span>지금 만들기</button></div>';
  } else {
    de.innerHTML='<div class="dash-projgrid">'+recent.map(function(eb){return dashProjectCard(eb);}).join('')
      +'<button class="dash-proj-new" onclick="startNewEbookProject()"><span data-icon="plus" data-icon-size="22"></span><span>새 전자책 만들기</span></button></div>';
  }

  if(window.AtlasIcons)AtlasIcons.applyAll(document.getElementById('app-dashboard'));
}
function renderHistory(){
  if(!APP.user)return;
  var ebooks=getUserEbooks(APP.user.email||'');
  var el=document.getElementById('hist-count');
  if(el)el.textContent='총 '+ebooks.length+'권';
  var he=document.getElementById('hist-ebooks');
  if(!he)return;
  if(!ebooks.length){
    he.innerHTML='<div class="a2-empty"><div class="a2-empty-icon" data-icon="book" data-icon-size="44"></div><div class="a2-empty-title">전자책 이력이 없습니다</div><div class="a2-empty-sub">전자책을 생성하면 여기에 저장됩니다</div></div>';
    var btn=document.createElement('button');
    btn.className='a2-btn a2-btn-primary';
    btn.innerHTML='<span data-icon="plus"></span>첫 전자책 만들기';
    btn.onclick=function(){showApp('converter');};
    var es=he.querySelector('.a2-empty');if(es)es.appendChild(btn);
    if(window.AtlasIcons)AtlasIcons.applyAll(he);
    return;
  }
  he.innerHTML='<div class="ebook-grid">'+ebooks.map(function(eb){return ebookCard(eb);}).join('')+'</div>';
  if(window.AtlasIcons)AtlasIcons.applyAll(he);
}

function renderSettings(){
  if(!APP.user){APP.user={email:'',name:'',plan:'free'};}
  var u=APP.user;
  document.getElementById('set-name').value=u.name||'';
  document.getElementById('set-email').value=u.email||'';
  refreshAtlasGatewayStatus();
  var plan=PLANS[u.plan||'free'];
  var badge=document.getElementById('set-plan-badge');
  if(badge){badge.textContent='구독자';badge.className='plan-badge plan-pro';}
  var pd=document.getElementById('set-plan-desc');
  if(pd)pd.textContent='구독자 전용 · 무제한 이용';
  var monthCount=getThisMonthCount(u.email||'');
  var txt=document.getElementById('set-usage-text');
  var bar=document.getElementById('set-usage-bar');
  if(txt)txt.textContent=monthCount+'권 생성 완료 (무제한 베타)';
  if(bar)bar.style.width=Math.min(60,monthCount*5)+'%';
}
function ebookCard(eb){
  var colors=['linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)','linear-gradient(135deg,#0f2027,#203a43,#2c5364)','linear-gradient(135deg,#1e1b4b,#312e81,#1e3a8a)','linear-gradient(135deg,#14532d,#166534,#15803d)','linear-gradient(135deg,#4c1d95,#5b21b6,#6d28d9)'];
  var i=Math.abs(eb.id||0)%colors.length;
  return '<div class="ebook-card" onclick="openEbook('+eb.id+')">'
    +'<div class="ebook-cover" style="background:'+colors[i]+'">'
    +'<div class="ebook-cover-cat"><span data-icon="book" data-icon-size="12"></span>'+x(eb.category||'자기계발')+'</div>'
    +'<div class="ebook-cover-title">'+x(eb.title||'제목 없음')+'</div>'
    +'</div>'
    +'<div class="ebook-body">'
    +'<div class="ebook-meta">'+x(eb.created)+'</div>'
    +'<div class="ebook-title">'+x(eb.title||'제목 없음')+'</div>'
    +'<div class="ebook-tags"><span class="ebook-tag">'+x(eb.category||'자기계발')+'</span></div>'
    +'<div class="ebook-actions">'
    +'<button class="ebook-act-btn" onclick="event.stopPropagation();openEbook('+eb.id+')"><span data-icon="chevronRight"></span>열기</button>'
    +'<button class="ebook-act-btn" onclick="event.stopPropagation();deleteEbook('+eb.id+')"><span data-icon="trash"></span></button>'
    +'</div></div></div>';
}
/* Atlas Visual Redesign v2, Phase R2 — Dashboard-only recent-project card.
   Deliberately separate from ebookCard() above: History (Phase R6 scope)
   still renders the old dark .ebook-card everywhere, and this phase must
   not touch that shared component. Same real data (eb.id/title/category/
   created) and the exact same openEbook()/deleteEbook() handlers — only the
   markup/classes differ. */
function dashProjectCard(eb){
  var colors=['linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)','linear-gradient(135deg,#0f2027,#203a43,#2c5364)','linear-gradient(135deg,#1e1b4b,#312e81,#1e3a8a)','linear-gradient(135deg,#14532d,#166534,#15803d)','linear-gradient(135deg,#4c1d95,#5b21b6,#6d28d9)'];
  var i=Math.abs(eb.id||0)%colors.length;
  return '<div class="dash-projcard" onclick="openEbook('+eb.id+')">'
    +'<div class="dash-projcover" style="background:'+colors[i]+'"><div class="dash-projcover-title">'+x(eb.title||'제목 없음')+'</div></div>'
    +'<div class="dash-projbody">'
    +'<div class="dash-projmeta">'+x(eb.created)+' · '+x(eb.category||'자기계발')+'</div>'
    +'<div class="dash-projtitle">'+x(eb.title||'제목 없음')+'</div>'
    +'<div class="dash-projactions">'
    +'<button class="a2-btn a2-btn-secondary a2-btn-sm" onclick="event.stopPropagation();openEbook('+eb.id+')"><span data-icon="chevronRight"></span>열기</button>'
    +'<button class="a2-icon-btn" onclick="event.stopPropagation();deleteEbook('+eb.id+')" title="삭제"><span data-icon="trash"></span></button>'
    +'</div></div></div>';
}
function openEbook(id){
  var ebooks=getUserEbooks(APP.user.email);
  var eb=ebooks.find(function(e){return e.id===id;});
  if(!eb||!eb.data)return;
  APP.ebook=eb.data;
  ['cv-upload-state','cv-process-state','cv-sales-state'].forEach(function(sid){
    var el=document.getElementById(sid);if(el)el.style.display='none';
  });
  var edoc=document.getElementById('cv-edoc');
  if(edoc)edoc.innerHTML='';
  showApp('converter');
  renderCvEbook(eb.data);
  document.getElementById('cv-result-state').style.display='';
  window.scrollTo(0,0);
}

function deleteEbook(id){
  if(!confirm('이 전자책을 삭제하시겠습니까?'))return;
  var ebooks=getUserEbooks(APP.user.email).filter(function(e){return e.id!==id;});
  saveUserEbooks(APP.user.email,ebooks);
  renderDashboard();renderHistory();
  showToast('success','삭제되었습니다.');
}

// ════════════════════════════════════════
// CONVERTER
// ════════════════════════════════════════
// ── INPUT MODE ──
var CV_MODE='file'; // file | topic | url
function switchInputTab(mode){
  atlasSetWorkspaceStage('input',{coach:'입력 방식을 선택했습니다. 자료를 추가한 뒤 분석을 시작하세요.'});
  CV_MODE=mode;
  document.querySelectorAll('.input-tab').forEach(function(t,i){
    t.classList.toggle('active',['file','topic','url','multi'][i]===mode);
  });
  document.querySelectorAll('.input-panel').forEach(function(p){p.classList.remove('active');});
  var el=document.getElementById('panel-'+mode);if(el)el.classList.add('active');
  checkCvReady();atlasSetWorkspaceStage('input',{noSave:true});
}
function setTopic(t){
  document.getElementById('topic-main').value=t;checkCvReady();
}
async function fetchUrl(){
  var url=document.getElementById('url-input').value.trim();
  if(!url)return;
  var btn=document.getElementById('url-fetch-btn');
  btn.innerHTML=(window.AtlasStateSystem?AtlasStateSystem.loadingInline('불러오는 중...'):'불러오는 중...');btn.disabled=true;
  var preview=document.getElementById('url-preview');
  try{
    // CORS proxy를 통해 URL 내용 가져오기
    var proxyUrl='https://api.allorigins.win/get?url='+encodeURIComponent(url);
    var resp=await fetch(proxyUrl);
    var data=await resp.json();
    var html=data.contents||'';
    // 태그 제거해서 텍스트만 추출
    var tmp=document.createElement('div');tmp.innerHTML=html;
    var text=tmp.innerText||tmp.textContent||'';
    text=text.replace(/\s+/g,' ').trim().substring(0,1500);
    APP.urlContent=(text||'URL 내용을 불러왔습니다.');
    preview.textContent='불러오기 완료 ('+text.length+'자)\n\n'+text.substring(0,300)+'...';
    preview.classList.add('show');
    checkCvReady();
    showToast('success','URL 내용을 불러왔습니다!');
  }catch(e){
    APP.urlContent='';
    preview.textContent='불러오기 실패: '+e.message+'\n\nURL을 직접 입력해두면 AI가 참고합니다.';
    preview.classList.add('show');
    checkCvReady();
  }finally{btn.innerHTML='<span data-icon="refresh"></span>불러오기';if(window.AtlasIcons)AtlasIcons.applyAll(btn);btn.disabled=false;}
}

function setupConverter(){
  var dz=document.getElementById('cv-dz'),fi=document.getElementById('cv-fi');
  if(!dz||dz._setup)return;dz._setup=true;
  dz.addEventListener('click',function(){fi.click();});
  fi.addEventListener('change',function(e){cvPick(e.target.files[0]);});
  dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave',function(){dz.classList.remove('drag');});
  dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('drag');cvPick(e.dataTransfer.files[0]);});
  var msDrop=document.getElementById('ms-drop'),msFiles=document.getElementById('ms-files');
  if(msDrop&&msFiles&&!msDrop._setup){
    msDrop._setup=true;
    msDrop.addEventListener('click',function(){msFiles.click();});
    msFiles.addEventListener('change',function(e){addMultiFiles(e.target.files);msFiles.value='';});
    msDrop.addEventListener('dragover',function(e){e.preventDefault();msDrop.classList.add('drag');});
    msDrop.addEventListener('dragleave',function(){msDrop.classList.remove('drag');});
    msDrop.addEventListener('drop',function(e){e.preventDefault();msDrop.classList.remove('drag');addMultiFiles(e.dataTransfer.files);});
  }

  // Word 버튼 - onclick으로 처리 (중복 이벤트 제거)
  document.getElementById('cv-copybtn').addEventListener('click',function(){
    var html=document.getElementById('cv-sp-body').innerHTML;
    navigator.clipboard.writeText(html).then(function(){showToast('success','HTML이 복사되었습니다!');});
  });
  // live check for topic/url/text inputs
  ['topic-main','topic-target','topic-extra','url-input','url-direction','ms-notes','ms-direction','ms-link-input'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.addEventListener('input',checkCvReady);
  });
  checkCvReady();
}

function sourceRoleOptions(selected){
  var roles=[['core','핵심 자료'],['reference','참고 자료'],['evidence','통계·근거'],['structure','구조 참고'],['tone','문체 참고']];
  return roles.map(function(r){return '<option value="'+r[0]+'"'+(selected===r[0]?' selected':'')+'>'+r[1]+'</option>';}).join('');
}
function addMultiFiles(fileList){
  var allowedExt=['pdf','docx','doc','txt','md','html','htm','pptx'];
  Array.from(fileList||[]).forEach(function(f){
    var ext=(f.name.split('.').pop()||'').toLowerCase();
    if(!allowedExt.includes(ext)){showToast('error',f.name+' 형식은 아직 지원하지 않습니다.');return;}
    if(APP.multiFiles.length>=5){showToast('error','한 번에 최대 5개 파일을 권장·지원합니다.');return;}
    if(APP.multiFiles.some(function(x){return x.name===f.name&&x.size===f.size;}))return;
    APP.multiFiles.push({id:'f'+Date.now()+Math.random().toString(36).slice(2,6),file:f,name:f.name,size:f.size,role:APP.multiFiles.length===0?'core':'reference',status:'준비 완료'});
  });
  renderMultiSources();checkCvReady();
}
function addMultiLink(){
  var input=document.getElementById('ms-link-input');
  var url=(input&&input.value||'').trim();
  if(!url)return;
  try{new URL(url);}catch(e){showToast('error','올바른 URL을 입력해주세요.');return;}
  if(APP.multiLinks.some(function(x){return x.url===url;})){showToast('info','이미 추가된 링크입니다.');return;}
  APP.multiLinks.push({id:'u'+Date.now(),url:url,name:url,role:'reference',status:'분석 대기',content:''});
  input.value='';renderMultiSources();checkCvReady();
  enrichMultiLink(APP.multiLinks[APP.multiLinks.length-1]);
}
async function enrichMultiLink(item){
  try{
    if(/(?:youtube\.com|youtu\.be)/i.test(item.url)){
      var oe=await fetch('https://www.youtube.com/oembed?url='+encodeURIComponent(item.url)+'&format=json');
      if(oe.ok){var od=await oe.json();item.name='▶ '+(od.title||'YouTube 영상');item.content='영상 제목: '+(od.title||'')+'\n채널: '+(od.author_name||'');item.status='메타정보 완료 · 자막 필요';}
      else item.status='링크 등록 · 자막 필요';
    }else{
      var resp=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent(item.url));
      var data=await resp.json();var tmp=document.createElement('div');tmp.innerHTML=data.contents||'';
      tmp.querySelectorAll('script,style,noscript,svg').forEach(function(el){el.remove();});
      var text=(tmp.innerText||tmp.textContent||'').replace(/\s+/g,' ').trim();
      item.name=((tmp.querySelector('title')||{}).textContent||item.url).trim();
      item.content=text.substring(0,6000);item.status=text?'본문 확보':'링크만 등록';
    }
  }catch(e){item.status='링크만 등록';}
  renderMultiSources();
}
function removeMultiSource(kind,id){
  if(kind==='file')APP.multiFiles=APP.multiFiles.filter(function(x){return x.id!==id;});
  else APP.multiLinks=APP.multiLinks.filter(function(x){return x.id!==id;});
  renderMultiSources();checkCvReady();
}
function updateMultiRole(kind,id,val){
  var arr=kind==='file'?APP.multiFiles:APP.multiLinks;var it=arr.find(function(x){return x.id===id;});if(it)it.role=val;
}
function renderMultiSources(){
  var fl=document.getElementById('ms-file-list'),ll=document.getElementById('ms-link-list');
  if(fl)fl.innerHTML=APP.multiFiles.length?APP.multiFiles.map(function(it){return '<div class="ms-item"><div><div class="ms-name">📄 '+x(it.name)+'</div><div class="ms-meta">'+Math.round(it.size/1024)+'KB · '+x(it.status)+'</div></div><select class="ms-role" onchange="updateMultiRole(\'file\',\''+it.id+'\',this.value)">'+sourceRoleOptions(it.role)+'</select><button class="ms-remove" onclick="removeMultiSource(\'file\',\''+it.id+'\')">×</button></div>';}).join(''):'<div class="ms-status">아직 추가된 문서가 없습니다.</div>';
  if(ll)ll.innerHTML=APP.multiLinks.length?APP.multiLinks.map(function(it){return '<div class="ms-item"><div><div class="ms-name">'+x(it.name)+'</div><div class="ms-meta">'+x(it.status)+'</div></div><select class="ms-role" onchange="updateMultiRole(\'link\',\''+it.id+'\',this.value)">'+sourceRoleOptions(it.role)+'</select><button class="ms-remove" onclick="removeMultiSource(\'link\',\''+it.id+'\')">×</button></div>';}).join(''):'<div class="ms-status">유튜브나 웹페이지 링크를 추가할 수 있습니다.</div>';
}

function cvPick(f){
  if(!f)return;
  var allowed=['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/plain','text/markdown',''];
  // allow by extension too
  var ext=f.name.split('.').pop().toLowerCase();
  var okExts=['pdf','docx','doc','txt','md','hwp'];
  if(!okExts.includes(ext)&&!allowed.includes(f.type)){showToast('error','Word(.docx), PDF 파일 지원합니다.');return;}
  APP.selFile=f;
  document.getElementById('cv-dz').classList.add('has-file');
  var uicoEl=document.getElementById('cv-uico');uicoEl.innerHTML=window.AtlasIcons?AtlasIcons.svg('file',{size:30}):'';
  document.getElementById('cv-utit').textContent='파일 준비 완료';
  document.getElementById('cv-usub').style.display='none';
  var chip=document.getElementById('cv-chip');chip.textContent=f.name;chip.style.display='inline-flex';
  checkCvReady();
}
function checkCvReady(){
  var gw=atlasGatewayStatus();
  var gwReady=gw.checked&&gw.reachable&&gw.configured;
  var btn=document.getElementById('cv-genbtn');
  if(!btn)return;
  // AI 서버 연결 경고 배너 — 서버가 아예 안 켜져 있는지, 켜져 있지만 키가 없는지 구분한다.
  var apiwarn=document.getElementById('cv-apikey-warn');
  var apiwarnDetail=document.getElementById('cv-apikey-warn-detail');
  if(apiwarn){
    if(!gw.checked||gwReady){ apiwarn.style.display='none'; }
    else{
      apiwarn.style.display='block';
      if(apiwarnDetail)apiwarnDetail.textContent=!gw.reachable?'AI 서버가 실행되지 않았습니다.':'AI 서버에 Anthropic API 키가 설정되지 않았습니다.';
    }
  }
  var ready=false;
  if(CV_MODE==='file')ready=!!(APP.selFile&&gwReady);
  else if(CV_MODE==='topic')ready=!!(document.getElementById('topic-main')&&document.getElementById('topic-main').value.trim()&&gwReady);
  else if(CV_MODE==='url'){var u=document.getElementById('url-input');ready=!!(u&&u.value.trim()&&gwReady);}
  else if(CV_MODE==='multi')ready=!!((APP.multiFiles.length||APP.multiLinks.length||(document.getElementById('ms-notes')&&document.getElementById('ms-notes').value.trim()))&&gwReady);
  btn.disabled=!ready;
  if(gw.checked&&!gwReady){btn.textContent=!gw.reachable?'AI 서버가 실행되지 않았습니다':'서버에 API 키 설정 필요';btn.style.opacity='.5';}
  else{btn.textContent='자료 분석 & 제목 후보 만들기';btn.style.opacity=ready?'1':'.4';}
  var warn=document.getElementById('cv-limit-warn');
  if(warn)warn.style.display='none';
}
function resetConverter(){
  APP.selFile=null;APP.ebook=null;APP.editMode=false;APP.salesEditMode=false;APP.urlContent='';APP.multiFiles=[];APP.multiLinks=[];APP.titleCandidates=[];APP.selectedTitleIndex=-1;APP.lockedTitle='';APP.lockedSubtitle='';APP.interviewQuestions=[];APP.interviewAnswers={};APP.interviewContext='';APP.smartAnalysis=null;APP.plannerReport=null;APP.brandProfile=null;APP.marketingCopy=null;APP.thumbnailBlueprint=null;APP.salesPageBlueprint=null;APP.ebookBlueprint=null;APP.creativeCampaign=null;APP.ebookProgress=null;APP._ebookProgressLightweightHint=null;APP.projectName='';
  /* Phase 13: Creative Feedback UI가 만든 Object URL을 여기서도 정리한다(모듈
     미로드 시에도 안전하도록 방어적으로 호출 — 기존 resetConverter 동작은 그대로 유지). */
  if(typeof AtlasAIPlanner!=='undefined' && AtlasAIPlanner.creativeFeedback && AtlasAIPlanner.creativeFeedback.deleteImage){ try{ AtlasAIPlanner.creativeFeedback.deleteImage(); }catch(e){} }
  /* Phase 14: Image Production 상태(생성 결과 objectUrl 포함)도 여기서 정리한다 —
     모듈 미로드 시에도 안전하도록 방어적으로 호출(기존 resetConverter 동작은 그대로 유지). */
  if(typeof AtlasImageProductionState!=='undefined' && AtlasImageProductionState.reset){ try{ AtlasImageProductionState.reset(); }catch(e){} }
  CV_MODE='file';
  var fi=document.getElementById('cv-fi');if(fi)fi.value='';
  var dz=document.getElementById('cv-dz');if(dz)dz.classList.remove('has-file');
  var uicoResetEl=document.getElementById('cv-uico');uicoResetEl.innerHTML=window.AtlasIcons?AtlasIcons.svg('upload',{size:30}):'';
  document.getElementById('cv-utit').textContent='파일을 드래그하거나 클릭하세요';
  document.getElementById('cv-usub').style.display='';
  document.getElementById('cv-chip').style.display='none';
  // reset topic/url/text
  ['topic-main','topic-target','topic-extra','url-input','url-direction','url-extra','ms-notes','ms-direction','ms-link-input','ts-final-title','ts-final-subtitle'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  var up=document.getElementById('url-preview');if(up){up.textContent='';up.classList.remove('show');} renderMultiSources(); var ts=document.getElementById('cv-title-state');if(ts)ts.style.display='none';
  var ps=document.getElementById('cv-planner-state');if(ps)ps.style.display='none';
  // reset tabs
  switchInputTab('file');
  document.getElementById('cv-upload-state').style.display='';
  document.getElementById('cv-process-state').style.display='none';
  document.getElementById('cv-result-state').style.display='none';
  document.getElementById('cv-sales-state').style.display='none';
  var igs=document.getElementById('cv-imagegen-state');if(igs)igs.style.display='none';
  if(typeof AtlasAIPlanner!=='undefined'&&typeof AtlasAIPlanner.reset==='function')AtlasAIPlanner.reset();
  /* APP.workspaceStage를 직접 대입하는 대신 atlasSetWorkspaceStage()를 호출해야
     상단 워크스페이스 위젯(단계 배지/진행률 바/코치 문구)도 함께 'input' 단계로
     되돌아간다 — 그렇지 않으면 이전 단계(예: "2단계 · 자료 분석")가 화면에 그대로
     남아 마치 초기화가 되지 않은 것처럼 보인다(실제 사용자 버그 리포트로 발견됨). */
  atlasSetWorkspaceStage('input',{noSave:true});
  atlasSetSimpleStep(1);
  checkCvReady();
}

var ATLAS_SYSTEM_PROMPT = `당신은 한국어 실전 전자책과 전자책 판매자료를 제작하는 전문 편집자입니다.
모든 응답은 반드시 유효한 JSON 객체 하나만 반환합니다. 마크다운, 코드블록, JSON 앞뒤 설명은 금지합니다.
JSON 키는 영어로 유지하고 모든 값은 한국어로 작성합니다.

[전자책 품질]
- 독자가 실제로 실행할 수 있는 단계, 방법, 주의점, 예시를 제공합니다.
- 뻔한 이론, 내용 없는 강조, 동일한 챕터 패턴 반복을 금지합니다.
- 확인되지 않은 경험을 저자의 실제 경험처럼 단정하지 않습니다.
- 실제 출처나 사용자 제공 근거가 없는 통계·사례·성과는 사실처럼 만들지 않습니다.
- 도구·서비스·정책처럼 최신성이 필요한 내용은 확신이 없으면 일반화하고 확인 필요성을 표시합니다.

[전자책 판매자료 정책]
- 썸네일, 상세페이지, 서비스 소개에는 구체적인 수익 금액을 쓰지 않습니다.
- 월·주·일 단위 수익, 매출, 절감액, 투자수익률, 성장률을 숫자로 약속하지 않습니다.
- 보장, 무조건, 반드시 성공, 누구나 가능, 자동수익, 평생수익, 100% 같은 표현을 금지합니다.
- 증빙 없는 판매량, 후기, 평점, 순위, 수익성과를 창작하지 않습니다.
- 가짜 구매후기를 만들지 않습니다. testimonial 필드는 빈 배열로 반환합니다.
- 가격, 정가, 할인액은 이미지와 상세페이지 카피에 생성하지 않습니다.
- 대신 실행 가능성, 시간 절약, 구조화, 사용 편의, 결과물 구성과 차별점을 구체적으로 설명합니다.

[문체]
- 과장보다 명확성, 감정보다 구체성, 홍보 문구보다 구매 판단에 필요한 정보를 우선합니다.
- 상황으로 공감하고 해결 과정과 결과물 구성을 명료하게 제시합니다.`;

function sanitizeKmongSalesClaims(ebook){
  if(!ebook||typeof ebook!=='object')return ebook;
  var forbiddenWords=[
    [/100\s*%/gi,'높은 완성도'],
    [/무조건|반드시\s*성공|확실한\s*수익|수익\s*보장|매출\s*보장|자동\s*수익|평생\s*수익/gi,'체계적인 실행'],
    [/누구나\s*(?:쉽게|가능|성공)?/gi,'초보자도 단계적으로'],
    [/(?:월|한\s*달|하루|일주일|주간|연간)\s*\d[\d,]*(?:\.\d+)?\s*(?:만|억|천)?\s*원(?:\s*(?:벌기|버는|수익|매출|달성|만들기))?/gi,'꾸준한 수익 구조'],
    [/\d[\d,]*(?:\.\d+)?\s*(?:만|억|천)?\s*원\s*(?:수익|매출|달성|벌기|버는)/gi,'수익화 성과'],
    [/\d+(?:\.\d+)?\s*%\s*(?:증가|상승|개선|수익|매출)/gi,'의미 있는 개선']
  ];
  function clean(v){
    if(typeof v==='string'){
      forbiddenWords.forEach(function(pair){v=v.replace(pair[0],pair[1]);});
      return v.replace(/\s{2,}/g,' ').trim();
    }
    if(Array.isArray(v))return v.map(clean);
    if(v&&typeof v==='object')Object.keys(v).forEach(function(k){v[k]=clean(v[k]);});
    return v;
  }
  ['title','subtitle','description'].forEach(function(k){if(ebook[k])ebook[k]=clean(ebook[k]);});
  if(ebook.sales)ebook.sales=clean(ebook.sales);
  if(ebook.sales){
    ebook.sales.testimonials=[];
    delete ebook.sales.price;
    delete ebook.sales.originalPrice;
    delete ebook.sales.savings;
  }
  return ebook;
}


function backToInputs(){
  document.getElementById('cv-title-state').style.display='none';
  var _si=document.getElementById('cv-interview-state');if(_si)_si.style.display='none';
  document.getElementById('cv-upload-state').style.display='';
  atlasSetSimpleStep(1);
  checkCvReady();window.scrollTo(0,0);
}
function safeTitleText(v){
  return String(v||'').replace(/100\s*%/gi,'').replace(/(?:월|하루|일주일|연간)\s*\d[\d,]*\s*(?:만|억|천)?\s*원/gi,'').replace(/무조건|보장|자동수익|누구나\s*성공/gi,'').replace(/\s{2,}/g,' ').trim();
}
async function fileToApiBlock(f){
  var ext=(f.name.split('.').pop()||'').toLowerCase();
  var b64=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result.split(',')[1]);};r.onerror=rej;r.readAsDataURL(f);});
  var mimeMap={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',txt:'text/plain',md:'text/plain',html:'text/html',htm:'text/html',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
  return {type:'document',source:{type:'base64',media_type:mimeMap[ext]||f.type||'application/octet-stream',data:b64},title:f.name};
}
function currentInputSummary(){
  if(CV_MODE==='topic')return '주제: '+document.getElementById('topic-main').value.trim()+'\n대상: '+document.getElementById('topic-target').value.trim()+'\n요구사항: '+document.getElementById('topic-extra').value.trim();
  if(CV_MODE==='url')return '대표 URL: '+document.getElementById('url-input').value.trim()+'\n추가 URL: '+document.getElementById('url-extra').value.trim()+'\n방향: '+document.getElementById('url-direction').value.trim()+'\n확보 내용: '+(APP.urlContent||'').substring(0,5000);
  if(CV_MODE==='file')return '업로드 문서: '+(APP.selFile?APP.selFile.name:'')+'\n이 문서를 한국 독자용으로 재기획한다.';
  var files=APP.multiFiles.map(function(it){return '- '+it.name+' ['+it.role+']';}).join('\n');
  var links=APP.multiLinks.map(function(it){return '- '+it.url+' ['+it.role+'] '+(it.content?'\n  '+it.content.substring(0,1800):'');}).join('\n');
  return '복수 자료 프로젝트\n문서:\n'+files+'\n링크:\n'+links+'\n사용자 메모:\n'+(document.getElementById('ms-notes').value||'')+'\n전자책 방향:\n'+(document.getElementById('ms-direction').value||'');
}
async function buildApiContent(promptText){
  var content=[];
  if(CV_MODE==='file'&&APP.selFile)content.push(await fileToApiBlock(APP.selFile));
  if(CV_MODE==='multi'){
    for(var i=0;i<APP.multiFiles.length;i++)content.push(await fileToApiBlock(APP.multiFiles[i].file));
  }
  content.push({type:'text',text:currentInputSummary()+'\n\n'+promptText});
  return content;
}
function normalizeInterviewQuestion(q,i){
  q=q||{};return {id:String(q.id||('q'+(i+1))),question:String(q.question||''),type:q.type==='choice'?'choice':'text',options:Array.isArray(q.options)?q.options.slice(0,6):[],placeholder:String(q.placeholder||'답변을 입력하세요'),required:q.required!==false};
}
function renderSmartInterview(reason){
  var state=document.getElementById('cv-interview-state');var upload=document.getElementById('cv-upload-state');var title=document.getElementById('cv-title-state');
  if(upload)upload.style.display='none';if(title)title.style.display='none';if(state)state.style.display='';
  var re=document.getElementById('si-reason');if(re)re.innerHTML='<strong>AI 판단:</strong> '+x(reason||'자료는 충분하지만 상품 방향을 더 정확히 맞추기 위해 확인이 필요합니다.');
  var list=document.getElementById('si-list');if(!list)return;
  list.innerHTML=(APP.interviewQuestions||[]).map(function(q,idx){
    var body=q.type==='choice'?'<div class="si-options">'+q.options.map(function(op){return '<button type="button" class="si-opt" data-qid="'+x(q.id)+'" data-value="'+x(op)+'" onclick="selectInterviewOption(this)">'+x(op)+'</button>';}).join('')+'</div>':'<input class="si-input" id="si-input-'+x(q.id)+'" placeholder="'+x(q.placeholder)+'" value="'+x(APP.interviewAnswers[q.id]||'')+'" oninput="APP.interviewAnswers[\''+x(q.id)+'\']=this.value;atlasSaveDraft(false)"/>';
    return '<div class="si-card"><div class="si-q">'+(idx+1)+'. '+x(q.question)+(q.required?' <span style="color:var(--a2-danger)">*</span>':'')+'</div>'+body+'</div>';
  }).join('');
  atlasSetWorkspaceStage('analysis',{coach:'자료에서 부족한 정보만 골라 질문했습니다. 답변 후 제목과 후킹을 정교하게 추천합니다.'});window.scrollTo(0,0);
}
function selectInterviewOption(btn){
  var qid=btn.getAttribute('data-qid'),v=btn.getAttribute('data-value');APP.interviewAnswers[qid]=v;
  document.querySelectorAll('.si-opt[data-qid="'+CSS.escape(qid)+'"]').forEach(function(el){el.classList.toggle('selected',el===btn);});atlasSaveDraft(false);
}
function validateSmartInterview(){
  for(var i=0;i<APP.interviewQuestions.length;i++){var q=APP.interviewQuestions[i];if(q.required&&!String(APP.interviewAnswers[q.id]||'').trim()){showToast('error',(i+1)+'번 질문에 답해주세요.');return false;}}return true;
}
function smartInterviewAnswerText(){return (APP.interviewQuestions||[]).map(function(q){return '- '+q.question+'\n  답변: '+(APP.interviewAnswers[q.id]||'미응답');}).join('\n');}
function skipSmartInterview(){APP.interviewAnswers={};generateTitlesFromSmartAnalysis(true);}
function submitSmartInterview(){if(!validateSmartInterview())return;generateTitlesFromSmartAnalysis(false);}
async function generateTitlesFromSmartAnalysis(skipped){
  var btn=document.getElementById('si-submit-btn');var old=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent='⏳ 제목 설계 중...';}
  var prompt=`당신은 한국 전자책 상품의 제목과 후킹을 설계하는 편집자입니다. 앞선 자료 분석과 사용자 답변을 반영해 판매용 전자책 제목 후보를 만드세요.\n\n[앞선 분석]\n${JSON.stringify(APP.smartAnalysis||APP.titleAnalysis||{})}\n\n[사용자 답변]\n${skipped?'사용자가 추가 질문을 건너뛰고 자료만으로 진행함':smartInterviewAnswerText()}\n\n[규칙]\n- 과장, 보장, 구체적인 수익 금액, 100%, 무조건 표현 금지\n- 궁금증·문제공감·실전 효용·신뢰·검색 의도를 균형 있게 사용\n- 입력에 없는 판매 실적이나 경험을 창작하지 않음\n- 정확히 12개 후보 생성\n\n유효한 JSON만 반환:\n{"analysis":{"topic":"","target":"","pain":"","angle":"","sourceSummary":""},"titles":[{"title":"","subtitle":"","type":"궁금증형|문제공감형|실전형|검색형|신뢰형|프리미엄형","reason":"","scores":{"hook":0,"trust":0,"search":0,"policy":0,"total":0}}]}`;
  try{
    var content=await buildApiContent(prompt);
    var data=await window.AtlasAnthropicGateway.generate({model:'claude-sonnet-4-6',max_tokens:5000,system:'유효한 JSON 객체 하나만 반환하세요.',messages:[{role:'user',content:content}]});
    var raw=(data.content||[]).filter(function(z){return z.type==='text';}).map(function(z){return z.text;}).join('');
    var clean=raw.replace(/```json|```/g,'').trim();clean=clean.substring(clean.indexOf('{'),clean.lastIndexOf('}')+1);
    var obj=JSON.parse(clean);APP.titleCandidates=(obj.titles||[]).map(function(t){t.title=safeTitleText(t.title);t.subtitle=safeTitleText(t.subtitle);return t;});APP.titleAnalysis=obj.analysis||APP.smartAnalysis||{};APP.selectedTitleIndex=0;var si=document.getElementById('cv-interview-state');if(si)si.style.display='none';document.getElementById('cv-title-state').style.display='';renderTitleStudio();atlasSetWorkspaceStage('title');atlasSetSimpleStep(2);window.scrollTo(0,0);
  }catch(e){
    showToast('error',e.gatewayUnreachable?'AI 서버가 실행되지 않았습니다.':'제목 후보 생성 실패: '+e.message,5000);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=old||'답변 반영 & 제목 추천';}
  }
}

async function openTitleStudio(isRetry){
  atlasSetWorkspaceStage('analysis');
  var gw=atlasGatewayStatus();
  if(gw.checked&&!gw.reachable){showToast('error','AI 서버가 실행되지 않았습니다.');return;}
  if(gw.checked&&gw.reachable&&!gw.configured){showApp('settings');showToast('error','서버에 API 키가 설정되지 않았습니다.');return;}
  var btn=isRetry?document.getElementById('ts-retry-btn'):document.getElementById('cv-genbtn');
  var old=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent='⏳ 자료 분석 중...';}
  var prompt=`당신은 한국 전자책 상품을 기획하는 시니어 편집자입니다. 제공된 자료를 분석하고, 추가 질문이 필요한지 스스로 판단한 뒤 제목 후보까지 설계하세요.

[분석 원칙]
- 주제 입력, PLR, 여러 문서와 링크를 구분해 핵심 주제·독자·문제·차별화 각도를 찾습니다.
- 자료를 단순 번역하거나 짜깁기하지 않고 한국 독자에게 맞는 새 상품 각도를 제안합니다.
- 입력에 없는 판매실적·경험·통계는 만들지 않습니다.
- 구체적인 수익 금액, 기간 내 성공, 보장, 100%, 무조건, 누구나 성공 표현은 제목과 부제에 사용하지 않습니다.
- 후킹은 과장 대신 궁금증, 문제 공감, 구체적 효용, 신뢰, 실전성을 사용합니다.

[스마트 인터뷰 판단]
- 자료가 충분하면 interview.needed=false로 하고 질문을 만들지 않습니다.
- 독자, 목적, 차별화 방향 등 결과 품질에 치명적인 정보가 빠졌을 때만 질문합니다.
- 질문은 최대 5개이며, 답을 몰라도 진행 가능한 사소한 질문은 만들지 않습니다.

[출력]
유효한 JSON 하나만 반환하세요.
{
 "analysis":{"topic":"핵심 주제","target":"핵심 독자","pain":"가장 큰 문제","angle":"추천 차별화 각도","sourceSummary":"자료 활용 방향과 부족한 점","sufficiency":0},
 "interview":{"needed":false,"reason":"질문 필요 또는 생략 이유","questions":[{"id":"q1","question":"질문","type":"choice|text","options":["선택1","선택2"],"placeholder":"직접 입력 안내","required":true}]},
 "titles":[
  {"title":"제목","subtitle":"부제목","type":"궁금증형|문제공감형|실전형|검색형|신뢰형|프리미엄형","reason":"왜 좋은지","scores":{"hook":0,"trust":0,"search":0,"policy":0,"total":0}}
 ]
}
- titles는 정확히 12개를 생성합니다.
- 제목은 한국어 14~32자 권장, 부제는 18~48자 권장입니다.
- total은 다른 점수를 종합해 100점 만점으로 현실적으로 평가합니다.`;
  try{
    var content=await buildApiContent(prompt);
    var data=await window.AtlasAnthropicGateway.generate({model:'claude-sonnet-4-6',max_tokens:5000,system:'반드시 유효한 JSON 객체 하나만 반환하세요. 입력 자료의 저작권을 존중하고 검증되지 않은 성과를 창작하지 마세요.',messages:[{role:'user',content:content}]});
    var raw=(data.content||[]).filter(function(x){return x.type==='text';}).map(function(x){return x.text;}).join('');
    var clean=raw.replace(/```json|```/g,'').trim();clean=clean.substring(clean.indexOf('{'),clean.lastIndexOf('}')+1);
    var obj=JSON.parse(clean);APP.smartAnalysis=obj.analysis||{};APP.titleAnalysis=obj.analysis||{};var iv=obj.interview||{};APP.interviewContext=iv.reason||'';APP.interviewQuestions=(iv.questions||[]).slice(0,5).map(normalizeInterviewQuestion);APP.interviewAnswers={};
    if(iv.needed&&APP.interviewQuestions.length){APP.titleCandidates=[];renderSmartInterview(iv.reason);}
    else{APP.titleCandidates=(obj.titles||[]).map(function(t){t.title=safeTitleText(t.title);t.subtitle=safeTitleText(t.subtitle);return t;});APP.selectedTitleIndex=0;document.getElementById('cv-upload-state').style.display='none';document.getElementById('cv-title-state').style.display='';renderTitleStudio();atlasSetWorkspaceStage('title',{coach:'자료가 충분해 추가 질문 없이 프리미엄 제목 후보를 완성했습니다.'});atlasSetSimpleStep(2);window.scrollTo(0,0);}
  }catch(e){
    showToast('error',e.gatewayUnreachable?'AI 서버가 실행되지 않았습니다.':'제목 후보 생성 실패: '+e.message,5000);
    /* 실패 시 상단 워크스페이스 배지를 'analysis'(분석 중)에 방치하면 버튼은
       다시 눌러도 실제로 재시도되지만 화면은 계속 "2단계 · 자료 분석"에 멈춰
       있는 것처럼 보인다(실제 사용자 버그 리포트: 눌러도 반응이 없다). 재시도가
       아닌 최초 시도가 실패했을 때만 'input'으로 되돌린다. */
    if(!isRetry)atlasSetWorkspaceStage('input',{noSave:true});
  }
  finally{if(btn){btn.disabled=false;btn.textContent=old||'↻ 제목 다시 추천';}}
}
function renderTitleStudio(){
  var a=APP.titleAnalysis||{};var ana=document.getElementById('ts-analysis');
  if(ana)ana.innerHTML='<strong>분석:</strong> '+x(a.topic||'')+' · <strong>독자:</strong> '+x(a.target||'')+'<br><strong>핵심 문제:</strong> '+x(a.pain||'')+'<br><strong>추천 각도:</strong> '+x(a.angle||'')+(a.sourceSummary?'<br><strong>자료 메모:</strong> '+x(a.sourceSummary):'');
  var grid=document.getElementById('ts-grid');
  if(grid)grid.innerHTML=APP.titleCandidates.map(function(t,i){var sc=t.scores||{};return '<div class="ts-card '+(APP.selectedTitleIndex===i?'selected':'')+'" onclick="selectTitleCandidate('+i+')"><div class="ts-total">'+(sc.total||'-')+'점</div><div class="ts-type">'+x(t.type||'TITLE')+'</div><div class="ts-title">'+x(t.title)+'</div><div class="ts-sub">'+x(t.subtitle||'')+'</div><div class="ts-score"><span>후킹 '+(sc.hook||'-')+'</span><span>신뢰 '+(sc.trust||'-')+'</span><span>검색 '+(sc.search||'-')+'</span><span>정책 '+(sc.policy||'-')+'</span></div></div>';}).join('');
  if(APP.titleCandidates.length)selectTitleCandidate(Math.max(0,APP.selectedTitleIndex));
}
function selectTitleCandidate(i){
  APP.selectedTitleIndex=i;var t=APP.titleCandidates[i]||{};
  document.querySelectorAll('.ts-card').forEach(function(el,idx){el.classList.toggle('selected',idx===i);});
  document.getElementById('ts-final-title').value=t.title||'';document.getElementById('ts-final-subtitle').value=t.subtitle||'';
}
function lockTitleAndGenerate(){
  var title=safeTitleText(document.getElementById('ts-final-title').value);var sub=safeTitleText(document.getElementById('ts-final-subtitle').value);
  if(!title){showToast('error','최종 제목을 입력해주세요.');return;}
  APP.lockedTitle=title;APP.lockedSubtitle=sub;atlasSetWorkspaceStage('title',{coach:'제목이 잠겼습니다. AI Planner가 기획안을 정리합니다.'});
  if(typeof AtlasAIPlanner!=='undefined'&&typeof AtlasAIPlanner.open==='function')AtlasAIPlanner.open();
  else startGenerate(true);
}

/* 전자책을 한 번의 거대한 Anthropic 호출로 만드는 구조를 제거하고, 목차 → 챕터별
   생성(7개) → 부록 생성 → 최종 병합 순서의 Incremental 구조로 바꾼다(js/incremental-
   ebook-engine.js). Prompt의 실제 지시문/스키마/품질 기준은 그대로 유지하고
   "생성 방식"만 바뀐다. 이미 완료된 챕터는 다시 생성하지 않고, 실패한 챕터만
   재생성한다. 진행률은 완료 유닛 수(목차1+챕터7+부록1=9유닛) 기준 실시간 계산이며,
   사용자는 언제든 중지할 수 있고 다시 시작하면 완료된 부분부터 이어서 진행한다. */
function ebookModeWrapperPrefix(){
  if(CV_MODE==='file'){
    if(!APP.selFile)throw new Error('파일을 선택해주세요.');
    return '업로드한 문서를 단순 번역하지 말고 핵심 개념을 재구성하여 한국 독자용 새 전자책으로 집필하세요. 사용자는 해당 문서를 활용할 권한이 있다고 전제하되, 원문 문장과 목차를 그대로 복제하지 마세요.\n\n';
  } else if(CV_MODE==='topic'){
    var topic=document.getElementById('topic-main').value.trim();
    var target=document.getElementById('topic-target').value.trim();
    var extra=document.getElementById('topic-extra').value.trim();
    var topicPrompt='주제: '+topic+(target?'\n대상 독자: '+target:'')+(extra?'\n추가 요구사항: '+extra:'');
    return '아래 주제로 한국 베스트셀러 전자책을 처음부터 완전히 새로 창작해주세요.\n\n'+topicPrompt+'\n\n위 주제를 기반으로 실전 전문 지식과 구체적 예시를 풍부하게 담아 창작하세요.\n\n';
  } else if(CV_MODE==='url'){
    var urlVal=document.getElementById('url-input').value.trim();
    var urlDir=document.getElementById('url-direction').value.trim();
    var urlExtra=document.getElementById('url-extra').value.trim();
    var urlFetched=APP.urlContent||'';
    var urlContext='참고 URL: '+urlVal+(urlExtra?'\n추가 URL:\n'+urlExtra:'')+(urlDir?'\n전자책 방향: '+urlDir:'')+(urlFetched?'\n\nURL에서 불러온 내용 (참고용):\n'+urlFetched.substring(0,8000):'');
    return '아래 URL의 내용을 분석하여 한국 독자용 전자책을 새롭게 창작해주세요.\n\n'+urlContext+'\n\nURL의 핵심 내용을 살리되 원문의 표현과 구조를 복제하지 말고, 실전 예시와 한국 실정에 맞는 내용으로 재구성하세요.\n\n';
  } else if(CV_MODE==='multi'){
    return '여러 자료를 종합하여 하나의 독창적인 한국어 전자책을 만드세요.\n- 핵심 자료는 중심 근거로 사용합니다.\n- 참고 자료는 보충에만 사용합니다.\n- 자료 간 중복은 통합하고 충돌하는 주장은 단정하지 않습니다.\n- 유튜브 링크에 자막이 없으면 제목과 사용자 메모 이상을 추측하지 않습니다.\n- 원문 문장과 목차를 그대로 복제하지 말고 새로운 구조와 표현으로 집필합니다.\n- 최신성이 필요한 정보는 확인 필요를 표시합니다.\n\n';
  }
  return '';
}

var EBOOK_PROGRESS_STORE_KEY='current';

function newEbookProgressState(){
  return {
    status:'idle', stopRequested:false,
    outline:null, chapters:new Array(7).fill(null), chapterStatus:new Array(7).fill('pending'),
    appendices:null, appendicesStatus:'pending', errorMessage:null,
    failedUnitId:null, mergedEbook:null,
    unitTimestamps:{}, // unitId -> 완료 시각(ms epoch)
    unitRetryCount:{ outline:0, chapter1:0, chapter2:0, chapter3:0, chapter4:0, chapter5:0, chapter6:0, chapter7:0, appendices:0 }
  };
}

function ebookProgressPct(p){
  var units=0, total=9; // outline(1) + chapters(7) + appendices(1)
  if(p.outline)units+=1;
  units+=p.chapterStatus.filter(function(s){return s==='completed';}).length;
  if(p.appendicesStatus==='completed')units+=1;
  return Math.round(units/total*100);
}

/* localStorage Draft에는 이 가벼운 값만 남긴다 — outline/챕터 본문/부록/최종
   병합본 같은 대용량 텍스트는 IndexedDB(js/ebook-progress-store.js)에만 저장한다. */
function ebookProgressLightweight(p){
  if(!p) return null;
  return {
    status:p.status, chapterStatus:p.chapterStatus.slice(), appendicesStatus:p.appendicesStatus,
    hasOutline:!!p.outline, failedUnitId:p.failedUnitId, progressPct:ebookProgressPct(p),
    unitTimestamps:Object.assign({},p.unitTimestamps), unitRetryCount:Object.assign({},p.unitRetryCount),
    hasMergedEbook:!!p.mergedEbook
  };
}

var _ebookProgressSaveIndicatorTimer=null;
function persistEbookProgress(){
  var p=APP.ebookProgress; if(!p)return;
  atlasSaveDraft(false); // 가벼운 상태(ebookProgressLightweight로 축약됨)는 기존 Draft 메커니즘 재사용
  if(window.AtlasEbookProgressStore){
    window.AtlasEbookProgressStore.save(EBOOK_PROGRESS_STORE_KEY, p); // 무거운 본문은 IndexedDB에
  }
  var ind=document.getElementById('cv-save-indicator');
  if(ind){
    ind.textContent='생성 상태가 저장되었습니다.';
    ind.style.opacity='1';
    if(_ebookProgressSaveIndicatorTimer)clearTimeout(_ebookProgressSaveIndicatorTimer);
    _ebookProgressSaveIndicatorTimer=setTimeout(function(){ind.style.opacity='0';},2500);
  }
}

/* 새로고침/재방문 후 IndexedDB에서 무거운 진행 상태를 복원한다(§ 새로고침 후 이어서
   생성 가능). atlasLoadDraft()가 가벼운 상태를 먼저 복원해 두면, 이 함수가 그
   상태가 idle/completed가 아닐 때만 IndexedDB에서 본문을 마저 불러온다. */
function restoreEbookProgressFromIndexedDb(){
  if(!window.AtlasEbookProgressStore)return;
  var light=APP._ebookProgressLightweightHint;
  if(!light || light.status==='idle' || light.status==='completed')return;
  window.AtlasEbookProgressStore.load(EBOOK_PROGRESS_STORE_KEY).then(function(heavy){
    if(!heavy)return; // IndexedDB에 없으면(다른 브라우저/프로필 등) 복원 불가 — 처음부터 다시 시작해야 함
    APP.ebookProgress=heavy;
    var procEl=document.getElementById('cv-process-state');
    if(procEl && (heavy.status==='stopped'||heavy.status==='failed')){
      document.getElementById('cv-upload-state').style.display='none';
      var _ts=document.getElementById('cv-title-state');if(_ts)_ts.style.display='none';
      procEl.style.display='';
    }
    renderEbookProgressUI();
  });
}

/* Atlas Visual Redesign v2, Phase R4 — real SVG status icons for the
   chapter-by-chapter incremental generation list, replacing the emoji
   (✅/✍️/⚠️/⏳). "waiting" gets a quiet neutral dot rather than an icon —
   it's a passive state, not an event, so it stays visually quiet. */
function cvStepIcon(status){
  if(status==='completed')return window.AtlasIcons?AtlasIcons.svg('checkCircle',{size:15}):'';
  if(status==='processing')return window.AtlasIcons?'<span class="cv-pstep-spin">'+AtlasIcons.svg('refresh',{size:15})+'</span>':'';
  if(status==='failed')return window.AtlasIcons?AtlasIcons.svg('alertTriangle',{size:15}):'';
  return '<span class="cv-pstep-dot"></span>';
}
function renderEbookProgressUI(){
  var p=APP.ebookProgress; if(!p)return;
  var pct=ebookProgressPct(p);
  var bar=document.getElementById('cv-progress-bar');
  var ring=document.getElementById('cv-progress-ring');
  var pctEl=document.getElementById('cv-progress-pct');
  if(bar)bar.style.width=pct+'%';
  if(ring){var offset=352-(352*pct/100);ring.style.strokeDashoffset=offset;}
  if(pctEl)pctEl.textContent=pct+'%';

  var list=document.getElementById('cv-chapter-steps');
  if(list){
    var rows=[];
    var outlineDone=!!p.outline;
    rows.push('<div class="cv-pstep '+(outlineDone?'done':(p.status==='outline'?'active':''))+'">'+cvStepIcon(outlineDone?'completed':(p.status==='outline'?'processing':'waiting'))+'<span>목차/개요'+(outlineDone?' 완료':(p.status==='outline'?' 생성 중...':' 대기'))+'</span></div>');
    for(var i=0;i<7;i++){
      var st=p.chapterStatus[i];
      var label=(i+1)+'장'+(st==='completed'?' 완료':st==='processing'?' 생성 중...':st==='failed'?' 실패':' 대기');
      var retryBtn=(st==='failed')?' <button class="a2-btn a2-btn-secondary a2-btn-sm" onclick="retryFailedChapter('+i+')">이 장만 다시 생성</button>':'';
      rows.push('<div class="cv-pstep '+(st==='completed'?'done':st==='processing'?'active':(st==='failed'?'failed':''))+'">'+cvStepIcon(st)+'<span>'+label+'</span>'+retryBtn+'</div>');
    }
    var aLabel='부록'+(p.appendicesStatus==='completed'?' 완료':p.appendicesStatus==='processing'?' 생성 중...':p.appendicesStatus==='failed'?' 실패':' 대기');
    rows.push('<div class="cv-pstep '+(p.appendicesStatus==='completed'?'done':p.appendicesStatus==='processing'?'active':(p.appendicesStatus==='failed'?'failed':''))+'">'+cvStepIcon(p.appendicesStatus)+'<span>'+aLabel+'</span></div>');
    list.innerHTML=rows.join('');
  }

  var stopBtn=document.getElementById('cv-ebook-stop-btn');
  var resumeBtn=document.getElementById('cv-ebook-resume-btn');
  var cancelBtn=document.getElementById('cv-ebook-cancel-btn');
  var running=(p.status==='outline'||p.status==='chapters'||p.status==='appendices'||p.status==='merging');
  if(stopBtn)stopBtn.style.display=running?'':'none';
  if(resumeBtn)resumeBtn.style.display=(!running&&p.status!=='completed'&&p.status!=='idle')?'':'none';
  if(cancelBtn)cancelBtn.style.display=(p.status!=='completed'&&p.status!=='idle')?'':'none';

  var msg=document.getElementById('cv-fun-msg');
  if(msg){
    if(p.status==='stopped')msg.innerHTML='<span style="color:var(--a2-warning)">사용자 요청으로 중지되었습니다. 완료된 부분은 저장되어 있습니다 — "이어서 생성"을 누르면 계속됩니다.</span>';
    else if(p.status==='failed')msg.innerHTML='<span style="color:var(--a2-danger)">'+x(p.errorMessage||'생성 중 오류가 발생했습니다.')+' — "이어서 생성"을 누르면 실패한 부분만 다시 시도합니다.</span>';
    else msg.textContent='';
  }
}

/* 이미 완료된 챕터는 절대 다시 생성하지 않는다(§1) — 실패한 챕터만 재생성한다(§2).
   진행률은 이 상태 기준 실시간 계산(§3)이며, stopRequested가 켜지면 "다음 유닛을
   시작하기 전에" 멈춘다(§4, 진행 중인 네트워크 호출 자체를 강제 종료하지는 않음 —
   이미 시작된 응답은 끝까지 받아 저장한다). 다시 진입하면 이 함수가 상태를 보고
   완료되지 않은 지점부터 이어서 진행한다(§5). */
async function continueEbookPipeline(){
  var p=APP.ebookProgress;
  var E=window.AtlasIncrementalEbookEngine;

  try{
    if(!p.outline){
      p.status='outline';renderEbookProgressUI();
      var prefix=ebookModeWrapperPrefix();
      var outline=await E.generateOutline(prefix);
      p.outline=outline;
      p.chapterStatus=new Array(7).fill('pending');
      p.unitTimestamps.outline=Date.now();
      persistEbookProgress();
      renderEbookProgressUI();
    }
    if(p.stopRequested){ p.status='stopped'; persistEbookProgress(); renderEbookProgressUI(); return; }

    p.status='chapters';
    for(var i=0;i<7;i++){
      if(p.chapterStatus[i]==='completed')continue; // §1: 완료된 챕터는 다시 생성하지 않음
      if(p.stopRequested){ p.status='stopped'; persistEbookProgress(); renderEbookProgressUI(); return; }
      p.chapterStatus[i]='processing';renderEbookProgressUI();
      var brief=p.outline.chapterBriefs[i];
      var chapter=await E.generateChapter(p.outline, brief);
      p.chapters[i]=chapter;
      p.chapterStatus[i]='completed';
      p.unitTimestamps['chapter'+(i+1)]=Date.now();
      persistEbookProgress();
      renderEbookProgressUI();
    }
    if(p.stopRequested){ p.status='stopped'; persistEbookProgress(); renderEbookProgressUI(); return; }

    if(p.appendicesStatus!=='completed'){
      p.status='appendices';p.appendicesStatus='processing';renderEbookProgressUI();
      var appendices=await E.generateAppendices(p.outline);
      p.appendices=appendices;
      p.appendicesStatus='completed';
      p.unitTimestamps.appendices=Date.now();
      persistEbookProgress();
      renderEbookProgressUI();
    }
    if(p.stopRequested){ p.status='stopped'; persistEbookProgress(); renderEbookProgressUI(); return; }

    p.status='merging';renderEbookProgressUI();
    await finalizeIncrementalEbook(p);
  }catch(e){
    p.status='failed';
    p.errorMessage=e.gatewayUnreachable?'AI 서버가 실행되지 않았습니다.':(e.message||'알 수 없는 오류가 발생했습니다.');
    if(!p.outline){
      p.failedUnitId='outline';
    }else{
      var procIdx=p.chapterStatus.indexOf('processing');
      if(procIdx!==-1){ p.chapterStatus[procIdx]='failed'; p.failedUnitId='chapter'+(procIdx+1); }
      else if(p.appendicesStatus==='processing'){ p.appendicesStatus='failed'; p.failedUnitId='appendices'; }
    }
    persistEbookProgress();
    renderEbookProgressUI();
    showToast('error','전자책 생성 중 오류: '+p.errorMessage,5000);
  }
}

async function finalizeIncrementalEbook(p){
  var E=window.AtlasIncrementalEbookEngine;
  var u=APP.user;
  var ebook=E.mergeFinalEbook(p);
  ebook.title=APP.lockedTitle;
  if(APP.lockedSubtitle)ebook.subtitle=APP.lockedSubtitle;
  ebook=sanitizeKmongSalesClaims(ebook);
  APP.ebook=ebook;
  p.mergedEbook=ebook;
  addEbook(u.email,ebook);
  addTrialCount(CV_MODE);
  var users=getUsers();u.plan=u.plan||'free';users[u.email]=u;saveUsers(users);
  p.status='completed';
  persistEbookProgress();
  document.getElementById('cv-process-state').style.display='none';
  document.getElementById('cv-result-state').style.display='';
  renderCvEbook(ebook);
  /* Phase 17.1: STEP4 등록 자료 패널 — 새 Engine 없이 기존 buildKmongListing()/
     renderKmongListing()을 그대로 재사용해 상품 제목/설명/FAQ/키워드/안내문을 채운다. */
  if(typeof renderKmongListing==='function')renderKmongListing(ebook);
  atlasSetWorkspaceStage('ebook');
  atlasSetSimpleStep(4);
  showToast('success','전자책이 생성되었습니다!');
}

function stopIncrementalEbookGeneration(){
  if(!APP.ebookProgress)return;
  APP.ebookProgress.stopRequested=true;
  showToast('info','다음 챕터를 시작하기 전에 중지합니다(현재 진행 중인 요청은 끝까지 받습니다).');
}
function resumeIncrementalEbookGeneration(){
  if(!APP.ebookProgress)return;
  var p=APP.ebookProgress;
  p.stopRequested=false;
  p.errorMessage=null;
  // §2: 실패로 표시된 챕터/부록만 pending으로 되돌려 재생성 대상으로 삼는다(완료된 것은 그대로 유지)
  // 재시도 횟수도 함께 기록한다.
  p.chapterStatus=p.chapterStatus.map(function(s,i){
    if(s==='failed'){ p.unitRetryCount['chapter'+(i+1)]=(p.unitRetryCount['chapter'+(i+1)]||0)+1; return 'pending'; }
    return s;
  });
  if(p.appendicesStatus==='failed'){ p.unitRetryCount.appendices=(p.unitRetryCount.appendices||0)+1; p.appendicesStatus='pending'; }
  if(p.failedUnitId==='outline'){ p.unitRetryCount.outline=(p.unitRetryCount.outline||0)+1; }
  p.failedUnitId=null;
  document.getElementById('cv-process-state').style.display='';
  renderEbookProgressUI();
  continueEbookPipeline();
}
/* 실패한 "특정" 챕터 하나만 다시 생성 — 전체 재개(resumeIncrementalEbookGeneration)와
   달리, 파이프라인이 failed/stopped 상태가 아니어도(예: 완료된 뒤 품질이 마음에
   들지 않아 그 장만 다시 만들고 싶을 때도) 그 챕터 하나만 재시도할 수 있게 한다. */
async function retryFailedChapter(i){
  var p=APP.ebookProgress; if(!p||!p.outline)return;
  p.unitRetryCount['chapter'+(i+1)]=(p.unitRetryCount['chapter'+(i+1)]||0)+1;
  p.chapterStatus[i]='processing';
  p.status='chapters';p.stopRequested=false;p.errorMessage=null;p.failedUnitId=null;
  document.getElementById('cv-process-state').style.display='';
  renderEbookProgressUI();
  try{
    var E=window.AtlasIncrementalEbookEngine;
    var brief=p.outline.chapterBriefs[i];
    var chapter=await E.generateChapter(p.outline, brief);
    p.chapters[i]=chapter;
    p.chapterStatus[i]='completed';
    p.unitTimestamps['chapter'+(i+1)]=Date.now();
    persistEbookProgress();
    renderEbookProgressUI();
    // 이 장만 재생성한 뒤에도 나머지가 이미 모두 끝나 있었다면 이어서 최종 병합까지 진행한다.
    continueEbookPipeline();
  }catch(e){
    p.chapterStatus[i]='failed';
    p.failedUnitId='chapter'+(i+1);
    p.status='failed';
    p.errorMessage=e.gatewayUnreachable?'AI 서버가 실행되지 않았습니다.':(e.message||'알 수 없는 오류가 발생했습니다.');
    persistEbookProgress();
    renderEbookProgressUI();
    showToast('error','챕터 재생성 실패: '+p.errorMessage,5000);
  }
}
/* 전체 취소 — 진행 중이던 모든 상태를 버리고 처음(자료 준비 화면)으로 되돌린다.
   §1 정책과 무관하게 사용자가 명시적으로 전부 버리기를 선택한 경우에만 쓰인다. */
function cancelIncrementalEbookGeneration(){
  if(!confirm('지금까지 생성된 목차/챕터/부록을 모두 버리고 처음부터 다시 시작하시겠습니까?'))return;
  APP.ebookProgress=null;
  APP.ebook=null;
  if(window.AtlasEbookProgressStore)window.AtlasEbookProgressStore.remove(EBOOK_PROGRESS_STORE_KEY);
  atlasSaveDraft(false);
  document.getElementById('cv-process-state').style.display='none';
  document.getElementById('cv-upload-state').style.display='';
  checkCvReady();
  showToast('info','전자책 생성을 취소했습니다.');
}

async function startGenerate(titleLocked){
  if(!titleLocked||!APP.lockedTitle){openTitleStudio();return;}
  var gw=atlasGatewayStatus();
  if(gw.checked&&!gw.reachable){
    showToast('error','AI 서버가 실행되지 않았습니다.');
    return;
  }
  if(gw.checked&&gw.reachable&&!gw.configured){
    showApp('settings');
    showToast('error','서버에 API 키가 설정되지 않았습니다.');
    return;
  }
  // 무료 체험 모드별 생성 횟수 체크
  if(!canGenerate(CV_MODE)){
    showTrialLimitPopup(CV_MODE);
    return;
  }

  // 에러박스 초기화
  var warn=document.getElementById('cv-limit-warn');
  if(warn){warn.style.display='none';warn.innerHTML='';}

  document.getElementById('cv-upload-state').style.display='none';
  var _ts=document.getElementById('cv-title-state');if(_ts)_ts.style.display='none';
  var _ps=document.getElementById('cv-planner-state');if(_ps)_ps.style.display='none';
  document.getElementById('cv-result-state').style.display='none';
  document.getElementById('cv-sales-state').style.display='none';
  var _edoc=document.getElementById('cv-edoc');if(_edoc)_edoc.innerHTML='';
  var _spb=document.getElementById('cv-sp-body');if(_spb)_spb.innerHTML='';
  document.getElementById('cv-process-state').style.display='';
  /* Phase 17.1: 판매 이미지 생성(cv-imagegen-state, 기존 ipe-section)은 STEP3부터
     전자책 진행 화면과 함께 보이기 시작해 STEP4(결과)까지 그대로 유지된다 — 생성
     중에는 진행 배지가, 완료 후에는 같은 카드가 결과 갤러리 역할을 겸한다. */
  var igs=document.getElementById('cv-imagegen-state');if(igs)igs.style.display='';
  if(typeof AtlasImageProductionUI!=='undefined'&&AtlasImageProductionUI.populate)AtlasImageProductionUI.populate();
  atlasSetWorkspaceStage('analysis',{coach:'목차 → 챕터별 → 부록 순서로 전자책을 나눠서 만듭니다. 언제든 중지했다가 이어서 진행할 수 있습니다.'});
  atlasSetSimpleStep(3);

  // 이미 진행 중이던 상태가 있으면(§5: 재시작 시 완료 지점부터 이어서) 그대로 이어가고,
  // 없으면(또는 이전에 완료/실패 없이 새로 시작하는 경우) 새 상태를 만든다.
  if(!APP.ebookProgress || APP.ebookProgress.status==='completed'){
    APP.ebookProgress=newEbookProgressState();
  }
  APP.ebookProgress.stopRequested=false;
  renderEbookProgressUI();

  // 실제 호출 전 예상 호출 횟수/max_tokens만 콘솔에 남긴다(API Key/Prompt 전문은 절대 출력하지 않음).
  var remainingChapters=APP.ebookProgress.chapterStatus.filter(function(s){return s!=='completed';}).length;
  var remainingUnits=(APP.ebookProgress.outline?0:1)+remainingChapters+(APP.ebookProgress.appendicesStatus==='completed'?0:1);
  console.log('[incremental-ebook] 시작 — 예상 실제 Anthropic 호출 횟수: '+remainingUnits+'회 (목차 max_tokens=16000, 챕터별 max_tokens=9000, 부록 max_tokens=16000)');

  await continueEbookPipeline();
}

/* Phase 17.1: STEP4 "전자책 다시 생성" — 새 Engine 없이 기존 startGenerate(true)를
   그대로 재사용해 같은 잠금 제목/스타일로 처음부터 다시 만든다(자료 재입력 불필요). */
function atlasRegenerateEbookFromScratch(){
  if(!confirm('전자책을 처음부터 다시 만들까요? 현재 완성본은 새 버전으로 덮어써집니다.'))return;
  APP.ebookProgress=null;
  startGenerate(true);
}
function checkAndShowSales(){
  if(!canGenerate('sales')){showTrialLimitPopup('sales');return;}
  addTrialCount('sales');
  if(!APP.ebook){showToast('error','전자책을 먼저 생성해주세요.');return;}
  showSalesThemeModal(APP.ebook);
}
THEMES_MODAL_DEF=null;
function showSalesThemeModal(ebook){
  // renderIdx: THEMES 배열 내 실제 인덱스 (0=navy,1=mint,2=violet,3=coral,4=gold)
  var THEME_DEFS=[
    {name:'📘 네이비 골드',desc:'프리미엄 · 신뢰감',bg:'#0d1b2a',point:'#D4A843',accent:'#F0C84A',light:false,renderIdx:0},
    {name:'🌿 차콜 민트',desc:'모던 · 청량감',bg:'#111417',point:'#2DD4BF',accent:'#5EE8D8',light:false,renderIdx:1},
    {name:'💜 크림 바이올렛',desc:'감성 · 세련됨',bg:'#faf9f7',point:'#7C3AED',accent:'#9b59fa',light:true,renderIdx:2},
    {name:'🔥 코랄 에너지',desc:'열정 · 에너제틱',bg:'#120805',point:'#E84A1F',accent:'#FFB347',light:false,renderIdx:3},
    {name:'✨ 골드 럭셔리',desc:'고급스러움 · 부유함',bg:'#0d0b05',point:'#D4A843',accent:'#FFE066',light:false,renderIdx:4},
    {name:'🌸 파스텔 핑크',desc:'따뜻함 · 감성적',bg:'#FFF5F8',point:'#E0187A',accent:'#FF4DA6',light:true,renderIdx:5}
  ];
  var overlay=document.createElement('div');
  overlay.id='sales-theme-modal';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  var modal=document.createElement('div');
  modal.style.cssText='background:#0c0f1a;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:24px 20px;max-width:520px;width:100%';
  function makeThumb(th,idx){
    var isLt=th.light;
    var borderC=isLt?'rgba(180,160,140,.5)':'rgba(255,255,255,.12)';
    var darkText=isLt?'#1a1a1a':'#ffffff';
    var thumbContent='<div style="width:100%;height:130px;background:'+th.bg+';border-radius:10px;overflow:hidden;position:relative">'
      +'<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,'+th.point+','+th.accent+')"></div>'
      +'<div style="padding:10px 12px">'
      +'<div style="display:flex;align-items:center;gap:5px;margin-bottom:7px">'
      +'<div style="width:16px;height:16px;border-radius:4px;background:'+th.point+'26;display:flex;align-items:center;justify-content:center;font-size:8px">📘</div>'
      +'<div style="font-size:7px;font-weight:800;color:'+th.point+';letter-spacing:1px">EBOOK</div></div>'
      +'<div style="display:inline-block;background:'+th.point+'26;border:1px solid '+th.point+'66;color:'+th.point+';font-size:7px;font-weight:800;padding:2px 7px;border-radius:100px;margin-bottom:5px">CATEGORY</div>'
      +'<div style="font-size:11px;font-weight:900;color:'+darkText+';line-height:1.2;margin-bottom:5px">제목이 <span style="color:'+th.point+'">여기에</span><br>표시됩니다</div>'
      +'<div style="padding:5px 8px;background:'+th.point+'1a;border:1px solid '+th.point+'44;border-radius:7px;font-size:7px;color:'+th.point+';font-weight:700">→ 스와이프하여 확인하기</div>'
      +'</div></div>';
        var nameC='rgba(255,255,255,.92)';
    var descC=isLt?'rgba(255,255,255,.6)':'rgba(255,255,255,.5)';
    return '<div id="th-'+idx+'" onclick="selTheme('+idx+')" style="cursor:pointer;padding:10px;border:2px solid '+borderC+';border-radius:12px;background:rgba(255,255,255,.02);transition:border-color .2s,background .2s">'
      +thumbContent
      +'<div style="margin-top:7px"><div style="font-size:11px;font-weight:800;color:'+nameC+'">'+th.name+'</div>'
      +'<div style="font-size:10px;color:'+descC+'">'+th.desc+'</div></div>'
      +'</div>';
  }
  var grid='<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:16px">'
    +THEME_DEFS.map(function(th,i){return makeThumb(th,i);}).join('')+'</div>';
  modal.innerHTML='<div style="text-align:center;margin-bottom:18px">'
    +'<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:2px;margin-bottom:5px">CARD NEWS THEME</div>'
    +'<h2 style="font-size:17px;font-weight:900;color:#fff;margin:0 0 4px">테마를 선택하세요</h2>'
    +'<p style="font-size:11px;color:rgba(255,255,255,.5);margin:0">카드뉴스 9장의 디자인 스타일</p></div>'
    +grid
    +'<div style="display:flex;gap:10px">'
    +'<button onclick="document.getElementById(\'sales-theme-modal\').remove()" style="flex:1;padding:12px;background:transparent;border:1px solid rgba(255,255,255,.15);border-radius:12px;color:rgba(255,255,255,.6);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">취소</button>'
    +'<button id="th-confirm" onclick="confirmTheme()" disabled style="flex:2;padding:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:12px;color:rgba(255,255,255,.35);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">테마를 선택해주세요</button>'
    +'</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  window._thEB=ebook;
  window._thSel=undefined;
  window.selTheme=function(idx){
    window._thSel=idx;
    for(var i=0;i<5;i++){
      var el=document.getElementById('th-'+i);
      if(el){var isLt2=THEME_DEFS[i].light;el.style.borderColor=isLt2?'rgba(0,0,0,.1)':'rgba(255,255,255,.12)';el.style.background='rgba(255,255,255,.02)';}
    }
    var sel=document.getElementById('th-'+idx);
    if(sel){sel.style.borderColor=THEME_DEFS[idx].point;sel.style.background='rgba(255,255,255,.07)';sel.style.boxShadow='0 0 0 2px '+THEME_DEFS[idx].point+'40';}
    var btn=document.getElementById('th-confirm');
    if(btn){btn.disabled=false;btn.style.background='linear-gradient(135deg,'+THEME_DEFS[idx].point+','+THEME_DEFS[idx].accent+')';btn.style.borderColor=THEME_DEFS[idx].point;btn.style.color=THEME_DEFS[idx].light?'#1a1a1a':'#fff';btn.textContent=THEME_DEFS[idx].name+' 으로 생성하기';}
  };
  window.confirmTheme=function(){
    var idx=window._thSel;if(idx===undefined)return;
    var renderIdx=THEME_DEFS[idx].renderIdx;
    document.getElementById('sales-theme-modal').remove();
    // showCvSales 대신 직접 영역만 표시 (이중 renderCvSalesPage 호출 방지)
    document.getElementById('cv-result-state').style.display='none';
    var ss=document.getElementById('cv-sales-state');
    if(ss){ ss.style.display=''; setTimeout(function(){ss.scrollIntoView({behavior:'instant',block:'start'});},30); }
    var eb=window._thEB||APP.ebook;
    if(eb){atlasSetWorkspaceStage('sales');renderCvSalesPage(eb, renderIdx);}
    else showToast('error','전자책을 먼저 생성해주세요.');
  };
}
function closeErrorPopup(el){
  var p=el;
  while(p&&!p.classList.contains('atlas-modal-bg')){p=p.parentElement;}
  if(p)p.remove();
}
function showErrorPopup(msg){
  var ps=document.getElementById('cv-process-state');
  var us=document.getElementById('cv-upload-state');
  if(ps)ps.style.display='none';
  if(us)us.style.display='';
  checkCvReady();
  var overlay=document.createElement('div');
  overlay.className='atlas-modal-bg';
  var icon='alertTriangle',iconTone='amber';
  var lines2=msg.split('\n');
  var title2=(lines2[0]||'생성 실패').replace('❌ ','').replace('⚠️ ','');
  var detail2=lines2.slice(1).join('\n').trim();
  var extraHtml='';
  if(msg.indexOf('요청 한도 초과')!==-1||msg.indexOf('rate_limit')!==-1){
    extraHtml='<div class="a2-banner a2-banner-warning" style="margin-bottom:10px"><span data-icon="alertTriangle"></span><span>30초~1분 후 다시 시도해주세요</span></div>';
  } else if(msg.indexOf('API 키')!==-1||msg.indexOf('authentication')!==-1){
    icon='lock';
    extraHtml='<button class="a2-btn a2-btn-primary" style="width:100%;margin-bottom:8px" onclick="closeErrorPopup(this);showApp(\'settings\')"><span data-icon="settings"></span>설정에서 API 키 확인</button>';
  } else if(msg.indexOf('크레딧')!==-1||msg.indexOf('credit')!==-1){
    icon='card';
    extraHtml='<a href="https://console.anthropic.com/settings/billing" target="_blank" class="a2-btn a2-btn-primary" style="width:100%;margin-bottom:8px;text-decoration:none"><span data-icon="card"></span>크레딧 충전하기</a>';
  }
  var detailHtml=detail2?('<div style="background:var(--a2-bg);border:1px solid var(--a2-border);border-radius:var(--a2-r-sm);padding:12px;margin-bottom:14px;font-size:12px;color:var(--a2-text-muted);line-height:1.8;white-space:pre-line;text-align:left">'+detail2+'</div>'):'';
  var div=document.createElement('div');
  div.className='atlas-modal';
  div.setAttribute('data-popup','1');
  div.style.cssText='max-width:440px;text-align:center';
  div.innerHTML='<div class="a2-icon-chip '+iconTone+'" data-icon="'+icon+'" style="margin:0 auto 14px"></div>'
    +'<div style="font-size:11px;font-weight:700;color:var(--a2-accent);margin-bottom:6px">Atlas AI eBook Studio</div>'
    +'<h3 style="margin-bottom:16px;word-break:keep-all">'+title2+'</h3>'
    +detailHtml+extraHtml
    +'<button class="a2-btn a2-btn-secondary" style="width:100%" onclick="closeErrorPopup(this)">닫기</button>';
  overlay.appendChild(div);
  document.body.appendChild(overlay);
  if(window.AtlasIcons)AtlasIcons.applyAll(div);
}

function showCvSales(){
  document.getElementById('cv-result-state').style.display='none';
  var ss=document.getElementById('cv-sales-state');
  if(ss){
    ss.style.display='';
    setTimeout(function(){ss.scrollIntoView({behavior:'instant',block:'start'});},30);
  }
  if(APP.ebook){atlasSetWorkspaceStage('sales');renderCvSalesPage(APP.ebook);}
  else showToast('error','전자책을 먼저 생성해주세요.');
}

function downloadDocx(e){
  if(!e){showToast('error','전자책을 먼저 생성해주세요.');return;}
  if(typeof JSZip==='undefined'){showToast('error','JSZip을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');return;}
  try{
    var zip=new JSZip();
    var title=e.title||'전자책';
    var author=e.author||'저자';
    var chs=e.chapters||[];

    // cleanText와 동일한 처리 (미리보기와 일치)
    function ct(s){
      return String(s||'')
        .replace(/\*\*/g,'')
        .replace(/#{1,6}\s/g,'')
        .replace(/\n{3,}/g,'\n\n')
        .trim();
    }
    function esc(s){
      return String(s||'')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
    }
    // 텍스트를 단락 배열로 분리 (빈줄 기준)
    function textToParas(s,size,color){
      var clean=ct(s);
      var lines=clean.split('\n');
      var out='';
      lines.forEach(function(line){
        var t=line.trim();
        if(!t){out+='<w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr></w:p>';return;}
        out+='<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>'
          +'<w:r><w:rPr>'
          +'<w:sz w:val="'+(size||24)+'"/><w:szCs w:val="'+(size||24)+'"/>'
          +(color?'<w:color w:val="'+color+'"/>':'')
          +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
          +'</w:rPr><w:t xml:space="preserve">'+esc(t)+'</w:t></w:r></w:p>';
      });
      return out;
    }
    function heading(text,level){
      var sz={1:52,2:40,3:32,4:28};
      var cl={1:'1B5CE8',2:'1a1a2e',3:'334155',4:'475569'};
      var sp={1:'400',2:'300',3:'240',4:'200'};
      return '<w:p><w:pPr><w:spacing w:before="'+sp[level]+'" w:after="120"/>'
        +(level===1?'<w:jc w:val="center"/>':'')
        +'</w:pPr>'
        +'<w:r><w:rPr><w:b/>'
        +'<w:sz w:val="'+(sz[level]||28)+'"/><w:szCs w:val="'+(sz[level]||28)+'"/>'
        +'<w:color w:val="'+(cl[level]||'1a1a2e')+'"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">'+esc(ct(text))+'</w:t></w:r></w:p>';
    }
    function label(text,color){
      return '<w:p><w:pPr><w:spacing w:before="80" w:after="20"/></w:pPr>'
        +'<w:r><w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>'
        +'<w:color w:val="'+(color||'6366f1')+'"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">'+esc(text)+'</w:t></w:r></w:p>';
    }
    function bullet(text,icon){
      return '<w:p><w:pPr><w:spacing w:before="40" w:after="40"/>'
        +'<w:ind w:left="360"/></w:pPr>'
        +'<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">'+(icon||'•')+' '+esc(ct(text))+'</w:t></w:r></w:p>';
    }
    function divider(){
      return '<w:p><w:pPr>'
        +'<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="CBD5E1"/></w:pBdr>'
        +'<w:spacing w:before="160" w:after="160"/>'
        +'</w:pPr></w:p>';
    }
    function emptyLine(n){
      var out='';
      for(var i=0;i<(n||1);i++)out+='<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';
      return out;
    }

    var body='';

    // ── 표지
    body+=emptyLine(3);
    body+=heading(title,1);
    if(e.subtitle){
      body+='<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/></w:pPr>'
        +'<w:r><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="6366f1"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">'+esc(ct(e.subtitle))+'</w:t></w:r></w:p>';
    }
    body+='<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>'
      +'<w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="475569"/>'
      +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
      +'</w:rPr><w:t xml:space="preserve">저자: '+esc(ct(author))+'</w:t></w:r></w:p>';
    if(e.category){
      body+='<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="20" w:after="20"/></w:pPr>'
        +'<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="94a3b8"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">'+esc(ct(e.category))+'</w:t></w:r></w:p>';
    }
    body+=emptyLine(2);
    body+=divider();

    // ── 저자 서문
    if(e.preface){
      body+=heading('PREFACE  |  저자 서문',2);
      body+=textToParas(e.preface,24);
      body+=divider();
    }

    // ── 서론
    if(e.intro){
      body+=heading('INTRODUCTION  |  서론',2);
      body+=textToParas(e.intro,24);
      if(e.targetReader){
        body+=label('📌 이 책이 필요한 독자','1B5CE8');
        body+=textToParas(e.targetReader,22,'475569');
      }
      body+=divider();
    }

    // ── 목차
    body+=heading('CONTENTS  |  목차',2);
    for(var i=0;i<chs.length;i++){
      body+='<w:p><w:pPr><w:spacing w:before="60" w:after="60"/>'
        +'<w:tabs><w:tab w:val="right" w:pos="8640"/></w:tabs></w:pPr>'
        +'<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="6366f1"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">CH.'+String(chs[i].number||i+1).padStart(2,'0')+'</w:t></w:r>'
        +'<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/>'
        +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
        +'</w:rPr><w:t xml:space="preserve">  '+esc(ct(chs[i].title||''))+'</w:t></w:r></w:p>';
    }
    body+=divider();

    // ── 챕터
    for(var i=0;i<chs.length;i++){
      var ch=chs[i];
      body+=heading('CHAPTER '+String(ch.number||i+1).padStart(2,'0'),3);
      body+=heading(ch.title||'',2);
      body+=textToParas(ch.content||'',24);

      // actionBox
      if(ch.actionBox){
        var ab=Array.isArray(ch.actionBox)?ch.actionBox:[ch.actionBox];
        body+=label('🔥 지금 바로 실행','dc2626');
        ab.forEach(function(a,ai){body+=bullet(a,'  '+(ai+1)+'.');});
      }
      // keyPoints
      if(ch.keyPoints&&ch.keyPoints.length){
        body+=label('💡 핵심 포인트','6366f1');
        ch.keyPoints.forEach(function(kp,ki){body+=bullet(kp,'  '+(ki+1)+'.');});
      }
      // actionItems
      if(ch.actionItems&&ch.actionItems.length){
        body+=label('✅ 즉시 실천 체크리스트','059669');
        ch.actionItems.forEach(function(a){body+=bullet(a,'  □');});
      }
      body+=divider();
    }

    // ── 결론
    body+=heading('CONCLUSION  |  결론',2);
    var conclusionContent=e.conclusion||'';
    if(!conclusionContent||conclusionContent.length<100||conclusionContent.charAt(0)==='['){
      var cTitles=(e.chapters||[]).map(function(c){return c.title||'';}).filter(Boolean);
      conclusionContent='이 전자책을 통해 우리는 '+(cTitles.length?cTitles.join(', '):'다양한 전략과 방법')+
        '에 대해 깊이 있게 살펴보았습니다.\n\n'+
        '지식은 행동으로 옮길 때 비로소 가치를 발휘합니다. 각 챕터에서 배운 핵심 내용을 실천에 옮기는 것이 가장 중요합니다.\n\n';
      (e.chapters||[]).forEach(function(ch){
        var kp=(ch.keyPoints&&ch.keyPoints[0])||'';
        if(kp)conclusionContent+='■ '+ch.title+': '+kp+'\n';
      });
      conclusionContent+='\n꾸준히 실천하며 성장해 나가시길 진심으로 응원합니다. 작은 것부터 하나씩 시작하면 반드시 변화가 찾아올 것입니다. 여러분의 성공을 응원합니다!';
    }
    body+=textToParas(conclusionContent,24);
    body+=divider();

    // ── 부록
    if(e.appendices&&e.appendices.length){
      e.appendices.forEach(function(ap,ai){
        var apContent=ap.content||'';
        if(!apContent||apContent.length<50||apContent.charAt(0)==='['){apContent='';}
        body+=heading('APPENDIX '+(ai+1)+'  |  '+ct(ap.title||''),3);
        body+=textToParas(apContent,23);
        body+=divider();
      });
    }else{
      body+=heading('APPENDIX 1  |  핵심 실천 체크리스트',3);
      var apText='이 전자책의 핵심 내용을 실천하기 위한 체크리스트입니다. 각 항목을 완료하면 체크하세요.\n\n';
      (e.chapters||[]).forEach(function(ch){
        apText+='【'+ch.title+'】\n';
        var items=(ch.actionItems&&ch.actionItems.length)?ch.actionItems:
                  (ch.keyPoints&&ch.keyPoints.length)?ch.keyPoints.slice(0,3):[];
        items.forEach(function(it){apText+='□ '+(typeof it==='string'?it:String(it))+'\n';});
        apText+='\n';
      });
      body+=textToParas(apText,23);
      body+=divider();
    }

    // ── 저작권
    var c2=e.copyright||{};
    body+=emptyLine(2);
    body+='<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="20"/></w:pPr>'
      +'<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="94a3b8"/>'
      +'<w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>'
      +'</w:rPr><w:t xml:space="preserve">ⓒ '+(c2.year||'2025')+' '+esc(author)+' · '
      +esc(c2.publisher||'독립 출판')+' · ALL RIGHTS RESERVED</w:t></w:r></w:p>';

    var xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
      +' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      +'<w:body>'+body
      +'<w:sectPr>'
      +'<w:pgSz w:w="12240" w:h="15840"/>'
      +'<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>'
      +'</w:sectPr>'
      +'</w:body></w:document>';

    var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      +'</Relationships>';
    var ct2='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      +'<Default Extension="xml" ContentType="application/xml"/>'
      +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      +'</Types>';
    var wRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

    zip.file('[Content_Types].xml',ct2);
    zip.file('_rels/.rels',rels);
    zip.file('word/document.xml',xml);
    zip.file('word/_rels/document.xml.rels',wRels);
    zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
      .then(function(blob){
        var a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        a.download=title.replace(/[\/\\:*?"<>|]/g,'_')+'.docx';
        document.body.appendChild(a);a.click();
        setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(a.href);},2000);
        showToast('success','Word 파일이 저장되었습니다!');
      }).catch(function(err){showToast('error','저장 실패: '+err.message);});
  }catch(err){showToast('error','오류: '+err.message);}
}

function hideCvSales(){document.getElementById('cv-sales-state').style.display='none';document.getElementById('cv-result-state').style.display='';}

// ── 리치 에디터 ──
function execF(cmd,val){document.execCommand(cmd,false,val||null);}
function setFontSize(size){
  if(!size)return;
  var sel=window.getSelection();
  if(sel&&sel.rangeCount>0&&!sel.isCollapsed){
    var range=sel.getRangeAt(0);
    var span=document.createElement("span");
    span.style.fontSize=size;
    range.surroundContents(span);
  }
}
function saveRange(){var s=window.getSelection();return(s&&s.rangeCount>0)?s.getRangeAt(0):null;}
function restoreRange(r){if(!r)return;var s=window.getSelection();s.removeAllRanges();s.addRange(r);}
function insertEditorImage(){APP._savedRange=saveRange();document.getElementById('editor-img-input').click();}
function insertSpImage(){APP._savedRange=saveRange();document.getElementById('sp-img-input').click();}
function handleEditorImage(input,targetId){
  var f=input.files[0];if(!f)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var img=document.createElement('img');
    img.src=ev.target.result;
    img.style.cssText='max-width:100%;height:auto;border-radius:8px;margin:10px 0;display:block;cursor:pointer';
    img.onclick=function(){var w=prompt('너비 입력 (예: 300px, 80%)',img.style.width||'100%');if(w){img.style.width=w;img.style.height='auto';}};
    if(APP._savedRange){restoreRange(APP._savedRange);document.execCommand('insertHTML',false,img.outerHTML);}
    else{var t=document.getElementById(targetId);if(t)t.appendChild(img);}
    input.value='';
  };
  reader.readAsDataURL(f);
}
function toggleCvEdit(){
  APP.editMode=!APP.editMode;
  var btn=document.getElementById('cv-editbtn');
  var toolbar=document.getElementById('cv-editor-toolbar');
  var doc=document.getElementById('cv-edoc');
  toolbar.style.display=APP.editMode?'flex':'none';
  btn.textContent=APP.editMode?'완료':'편집';
  btn.style.cssText=APP.editMode?'background:var(--a2-success-soft);border-color:var(--a2-success);color:var(--a2-success)':'';
  setEditableAll(doc,APP.editMode);
  if(!APP.editMode)showToast('success','편집이 저장되었습니다');
}
function toggleCvSalesEdit(){
  APP.salesEditMode=!APP.salesEditMode;
  var btn=document.getElementById('cv-sp-editbtn');
  var toolbar=document.getElementById('cv-sp-toolbar');
  var body=document.getElementById('cv-sp-body');
  if(!body)return;
  toolbar.style.display=APP.salesEditMode?'flex':'none';
  if(btn){
    btn.textContent=APP.salesEditMode?'완료':'편집';
    btn.style.cssText=APP.salesEditMode?'background:var(--a2-success-soft);border-color:var(--a2-success);color:var(--a2-success)':'';
  }
  // 상세페이지 카드 안 모든 텍스트 편집 가능
  var editables=body.querySelectorAll('h1,h2,h3,h4,p,span,div');
  editables.forEach(function(el){
    // 버튼, 스크립트, 이미지 컨테이너 제외
    if(el.tagName==='BUTTON'||el.closest('button')||el.tagName==='SVG')return;
    if(el.querySelector('button,svg,canvas'))return;
    if(APP.salesEditMode){
      el.contentEditable='true';
      el.style.outline='1px dashed rgba(99,102,241,0.4)';
      el.style.minHeight='1em';
    } else {
      el.contentEditable='false';
      el.style.outline='';
      el.style.minHeight='';
    }
  });
  if(!APP.salesEditMode)showToast('success','상세페이지 편집이 저장되었습니다');
}

function getRandomTheme(arr){return arr[Math.floor(Math.random()*arr.length)];}
function printCvSales(){
  var body=document.getElementById('cv-sp-body');
  if(!body){showToast('error','상세페이지를 먼저 생성해주세요.');return;}
  var w=window.open('','_blank');
  if(!w)return;
  var css=getSalesCss();
  var content=body.innerHTML;
  w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">'+css+'</head><body>'+content+'</body></html>');
  w.document.close();
}


function dlSpSlide(n,btn){
  if(typeof html2canvas==='undefined'){
    showToast('error','잠시 후 다시 시도해주세요.');
    if(btn){btn.disabled=false;}return;
  }
  var body=document.getElementById('cv-sp-body');
  if(!body){showToast('error','상세페이지를 먼저 생성해주세요.');return;}
  var el=body.querySelector('#sp-card-'+n);
  if(!el){var all=body.querySelectorAll('[id^="sp-card-"]');if(all&&all[n-1])el=all[n-1];}
  if(!el){showToast('error',n+'번 카드 없음. 상세페이지 재생성 해주세요.');if(btn)btn.disabled=false;return;}
  html2canvas(el,{scale:2,useCORS:true,allowTaint:true}).then(function(canvas){
    var a=document.createElement('a');
    a.download='card-'+n+'.png';
    a.href=canvas.toDataURL('image/png');
    a.click();
    if(btn)btn.disabled=false;
  }).catch(function(err){
    showToast('error','저장 실패: '+err.message);
    if(btn)btn.disabled=false;
  });
}

