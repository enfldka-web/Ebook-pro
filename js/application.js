// ════════════════════════════════════════
// DATA & STATE
// ════════════════════════════════════════
var APP={user:null,ebook:null,editMode:false,salesEditMode:false,selFile:null,selPlan:'free',urlContent:'',multiFiles:[],multiLinks:[],titleCandidates:[],selectedTitleIndex:-1,lockedTitle:'',lockedSubtitle:'',workspaceStage:'input',projectName:'',projectUpdatedAt:null,interviewQuestions:[],interviewAnswers:{},interviewContext:'',smartAnalysis:null};

// ════════════════════════════════════════
// ATLAS v0.7 SMART PREMIUM ENGINE
// ════════════════════════════════════════
var ATLAS_STAGE_ORDER=['input','analysis','title','ebook','sales','publish'];
var ATLAS_STAGE_INFO={
 input:{pct:8,label:'1단계 · 자료 준비',badge:'기획 시작',coach:'파일, 주제 또는 URL 중 편한 방식을 선택하세요. 입력한 내용은 브라우저에 임시 저장됩니다.'},
 analysis:{pct:25,label:'2단계 · 자료 분석',badge:'분석 중',coach:'Atlas가 핵심 주제, 독자, 문제와 차별화 각도를 정리하고 있습니다.'},
 title:{pct:42,label:'3단계 · 제목과 후킹',badge:'선택 필요',coach:'후킹과 신뢰를 함께 고려해 제목을 고르세요. 선택한 제목은 모든 결과물에 연결됩니다.'},
 ebook:{pct:68,label:'4단계 · 콘텐츠 제작',badge:'전자책 완성',coach:'전자책이 완성되었습니다. 내용과 제목을 검토한 뒤 판매 디자인으로 이동하세요.'},
 sales:{pct:88,label:'5단계 · 판매 디자인',badge:'디자인 작업',coach:'썸네일, 상세페이지와 전자책 판매자료를 확인하고 가장 적합한 시안을 선택하세요.'},
 publish:{pct:100,label:'6단계 · 판매 준비 완료',badge:'출시 가능',coach:'최종 결과물을 저장하고 크몽 등록 전 정책 검사와 문구를 한 번 더 확인하세요.'}
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
function atlasCollectDraft(){
 function val(id){var e=document.getElementById(id);return e?e.value:'';}
 return {version:'0.7',savedAt:Date.now(),stage:APP.workspaceStage||'input',interviewQuestions:APP.interviewQuestions||[],interviewAnswers:APP.interviewAnswers||{},interviewContext:APP.interviewContext||'',smartAnalysis:APP.smartAnalysis||null,mode:typeof CV_MODE!=='undefined'?CV_MODE:'file',lockedTitle:APP.lockedTitle||'',lockedSubtitle:APP.lockedSubtitle||'',titleCandidates:APP.titleCandidates||[],titleAnalysis:APP.titleAnalysis||{},topic:{main:val('topic-main'),target:val('topic-target'),extra:val('topic-extra')},url:{input:val('url-input'),direction:val('url-direction'),extra:val('url-extra'),content:APP.urlContent||''},multi:{notes:val('ms-notes'),direction:val('ms-direction'),links:APP.multiLinks||[],files:(APP.multiFiles||[]).map(function(f){return {name:f.name,role:f.role};})},ebook:APP.ebook||null,thumbnailStudio:APP.thumbnailStudio||null,salesPageStudio:APP.salesPageStudio||null};
}
function atlasSaveDraft(show){try{localStorage.setItem(atlasProjectStorageKey(),JSON.stringify(atlasCollectDraft()));if(show)showToast('success','현재 프로젝트를 저장했습니다.');}catch(e){if(show)showToast('error','프로젝트 저장에 실패했습니다.');}}
function atlasLoadDraft(show){
 try{var raw=localStorage.getItem(atlasProjectStorageKey());if(!raw){if(show)showToast('info','저장된 프로젝트가 없습니다.');return;}var d=JSON.parse(raw);
 APP.lockedTitle=d.lockedTitle||'';APP.lockedSubtitle=d.lockedSubtitle||'';APP.titleCandidates=d.titleCandidates||[];APP.titleAnalysis=d.titleAnalysis||{};APP.interviewQuestions=d.interviewQuestions||[];APP.interviewAnswers=d.interviewAnswers||{};APP.interviewContext=d.interviewContext||'';APP.smartAnalysis=d.smartAnalysis||null;APP.urlContent=d.url&&d.url.content||'';APP.multiLinks=d.multi&&d.multi.links||[];if(d.ebook)APP.ebook=d.ebook;
 if(d.thumbnailStudio){APP.thumbnailStudio=d.thumbnailStudio;}else{delete APP.thumbnailStudio;}
 if(typeof ThumbnailStudio!=='undefined'&&typeof ThumbnailStudio.init==='function')ThumbnailStudio.init();
 if(d.salesPageStudio){APP.salesPageStudio=d.salesPageStudio;}else{delete APP.salesPageStudio;}
 if(typeof SalesPageStudio!=='undefined'&&typeof SalesPageStudio.init==='function')SalesPageStudio.init();
 function setv(id,v){var e=document.getElementById(id);if(e)e.value=v||'';}
 setv('topic-main',d.topic&&d.topic.main);setv('topic-target',d.topic&&d.topic.target);setv('topic-extra',d.topic&&d.topic.extra);setv('url-input',d.url&&d.url.input);setv('url-direction',d.url&&d.url.direction);setv('url-extra',d.url&&d.url.extra);setv('ms-notes',d.multi&&d.multi.notes);setv('ms-direction',d.multi&&d.multi.direction);
 if(typeof switchInputTab==='function'&&d.mode)switchInputTab(d.mode);if(typeof renderMultiLinks==='function')renderMultiLinks();
 atlasSetWorkspaceStage(d.stage||'input',{noSave:true,coach:'저장된 프로젝트를 불러왔습니다. 파일은 보안상 다시 선택해야 할 수 있습니다.'});if(typeof checkCvReady==='function')checkCvReady();if(show)showToast('success','저장된 프로젝트를 불러왔습니다.');
 }catch(e){if(show)showToast('error','프로젝트 불러오기에 실패했습니다.');}
}
function atlasClearDraft(){if(!confirm('저장된 임시 프로젝트를 지울까요?'))return;localStorage.removeItem(atlasProjectStorageKey());showToast('success','임시 프로젝트를 지웠습니다.');}
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
function getApiKey(){return localStorage.getItem('plrbooks_apikey')||'';}
function setApiKey(k){localStorage.setItem('plrbooks_apikey',k);}
function saveApiKey(){
  var v=document.getElementById('set-apikey').value.trim();
  if(!v){showToast('error','API 키를 입력해주세요.');return;}
  setApiKey(v);
  showToast('success','API 키가 저장되었습니다.');
}
function clearApiKey(){
  if(!confirm('API 키를 삭제하시겠습니까?'))return;
  localStorage.removeItem('plrbooks_apikey');
  var el=document.getElementById('set-apikey');
  if(el)el.value='';
  showToast('success','API 키가 삭제되었습니다.');
}
function testApiKey(){
  var key=getApiKey();
  if(!key){showToast('error','저장된 API 키가 없습니다. 먼저 저장해주세요.');return;}
  showToast('info','API 키 테스트 중...');
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:10,messages:[{role:'user',content:'hi'}]})
  }).then(function(r){
    if(r.ok){showToast('success','✅ API 키가 정상입니다!');}
    else{showToast('error','❌ API 키 오류 ('+r.status+'). 키를 확인해주세요.');}
  }).catch(function(){
    showToast('error','네트워크 오류. 인터넷 연결을 확인해주세요.');
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
  p.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  var inner=document.createElement('div');
  inner.style.cssText='background:#1a1a2e;border:1px solid rgba(99,102,241,.4);border-radius:20px;padding:36px 32px;max-width:400px;width:90%;text-align:center;';
  inner.innerHTML='<div style="font-size:32px;margin-bottom:12px">🔒</div>'
    +'<div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">'+typeName+' 체험 횟수 초과</div>'
    +'<div style="font-size:14px;color:#94a3b8;margin-bottom:24px;line-height:1.6">무료 체험판은 방식별 1회만 사용 가능합니다.<br>무제한으로 사용하려면 구독해주세요!</div>';
  var btn1=document.createElement('button');
  btn1.style.cssText='width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:10px;display:block;';
  btn1.textContent='🚀 월 ₩29,000로 무제한 시작';
  btn1.onclick=function(){window.open(LATPEED_URL,'_blank');};
  var btn2=document.createElement('button');
  btn2.style.cssText='width:100%;padding:10px;background:transparent;border:1px solid rgba(255,255,255,.2);border-radius:12px;color:#94a3b8;font-size:13px;cursor:pointer;display:block;';
  btn2.textContent='닫기';
  btn2.onclick=function(){p.remove();};
  inner.appendChild(btn1);
  inner.appendChild(btn2);
  p.appendChild(inner);
  document.body.appendChild(p);
}

function showTrialWelcomePopup(){
  if(localStorage.getItem('plrbooks_trial_welcomed'))return;
  localStorage.setItem('plrbooks_trial_welcomed','1');
  var p=document.createElement('div');
  p.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
  var inner=document.createElement('div');
  inner.style.cssText='background:#1a1a2e;border:1px solid rgba(99,102,241,.4);border-radius:20px;padding:36px 32px;max-width:400px;width:90%;text-align:center;';
  inner.innerHTML='<div style="font-size:40px;margin-bottom:12px">🎁</div>'
    +'<div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:8px">무료 체험판에 오신 걸 환영합니다!</div>'
    +'<div style="font-size:14px;color:#94a3b8;margin-bottom:24px;line-height:1.6">파일·주제·URL·상세페이지<br>각 방식별 <b style=\"color:#a5b4fc\">1회씩</b> 무료로 체험하실 수 있습니다.</div>';
  var btn=document.createElement('button');
  btn.style.cssText='width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;';
  btn.textContent='시작하기 🚀';
  btn.onclick=function(){p.remove();};
  inner.appendChild(btn);
  p.appendChild(inner);
  document.body.appendChild(p);
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
  // access block 숨기기
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
  });

  // 2. 요청 섹션 표시
  var target=document.getElementById('app-'+section);
  if(target)target.style.display='block';
  var sbTarget=document.getElementById('sb-'+section);
  if(sbTarget)sbTarget.classList.add('active');

  // 3. 상단바 제목
  var titles={dashboard:'대시보드',converter:'⚡ 전자책 생성',history:'📚 내 전자책',settings:'⚙️ 설정'};
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
    ['cv-process-state','cv-result-state','cv-sales-state'].forEach(function(id){
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
    setCurrentUser(u);showPage('app','dashboard');showToast('success','🎉 환영합니다! 자동으로 계정이 생성됐습니다.');
  } else if(u.pw!==btoa(pw)){
    showErr(err,'비밀번호가 올바르지 않습니다. 다시 확인해주세요.');return;
  } else {
    setCurrentUser(u);showPage('app','dashboard');showToast('success','👋 반갑습니다, '+u.name+'님!');
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
  showPage('app','dashboard');showToast('success','🎉 가입 완료! 첫 전자책을 만들어보세요.');
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
  // render dashboard
  showApp('dashboard');
  // setTimeout(showTrialWelcomePopup, 800); // 구독자용 비활성화
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

  // upgrade banner
  var bw=document.getElementById('upgrade-banner-wrap');
  bw.innerHTML='<div class="upgrade-banner" style="background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(167,139,250,.1));border-color:rgba(99,102,241,.35)"><div class="upgrade-text"><h4>🔓 구독자 전용 서비스</h4><p>무제한으로 PLR 전자책을 생성하세요. 구독해 주셔서 감사합니다 🙏</p></div><span style="background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;padding:8px 18px;border-radius:10px;font-size:13px;font-weight:800;white-space:nowrap">✅ 구독 중</span></div>';

  // stats
  var sg=document.getElementById('stat-grid');
  sg.innerHTML=[
    {icon:'📚',val:ebooks.length,label:'총 생성 전자책',change:'↑ 전체 이력',cls:'neu'},
    {icon:'📅',val:monthCount,label:'이번 달 생성',change:'무제한 이용 중',cls:'up'},
    {icon:'💰',val:'₩29,000',label:'월 구독 요금',change:'구독자 전용 · 무제한',cls:'up'},
    {icon:'⚡',val:'~10분',label:'평균 생성 시간',change:'AI 자동 처리',cls:'up'}
  ].map(function(s){return '<div class="stat-card"><div class="stat-icon">'+s.icon+'</div><div class="stat-val">'+s.val+'</div><div class="stat-label">'+s.label+'</div><div class="stat-change '+s.cls+'">'+s.change+'</div></div>';}).join('');

  // recent ebooks
  var de=document.getElementById('dash-ebooks');
  var recent=ebooks.slice(0,6);
  if(!recent.length){de.innerHTML='<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">아직 생성한 전자책이 없어요</div><div class="empty-sub">첫 PLR 전자책을 만들어보세요!</div><button class="btn-primary" onclick="showApp(\'converter\')">+ 지금 만들기</button></div>';return;}
  de.innerHTML='<div class="ebook-grid">'+recent.map(function(eb){return ebookCard(eb);}).join('')+'</div>';
}
function renderHistory(){
  if(!APP.user)return;
  var ebooks=getUserEbooks(APP.user.email||'');
  var el=document.getElementById('hist-count');
  if(el)el.textContent='총 '+ebooks.length+'권';
  var he=document.getElementById('hist-ebooks');
  if(!he)return;
  if(!ebooks.length){
    he.innerHTML='<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-title">전자책 이력이 없습니다</div><div class="empty-sub">전자책을 생성하면 여기에 저장됩니다</div></div>';
    var btn=document.createElement('button');
    btn.className='btn-primary';
    btn.textContent='+ 첫 전자책 만들기';
    btn.onclick=function(){showApp('converter');};
    var es=he.querySelector('.empty-state');if(es)es.appendChild(btn);
    return;
  }
  he.innerHTML='<div class="ebook-grid">'+ebooks.map(function(eb){return ebookCard(eb);}).join('')+'</div>';
}

function renderSettings(){
  if(!APP.user){APP.user={email:'',name:'',plan:'free'};}
  var u=APP.user;
  document.getElementById('set-name').value=u.name||'';
  document.getElementById('set-email').value=u.email||'';
  document.getElementById('set-apikey').value=getApiKey();
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
    +'<div class="ebook-cover-cat">📚 '+(eb.category||'자기계발')+'</div>'
    +'<div class="ebook-cover-title">'+(eb.title||'제목 없음')+'</div>'
    +'</div>'
    +'<div class="ebook-body">'
    +'<div class="ebook-meta">'+eb.created+'</div>'
    +'<div class="ebook-title">'+(eb.title||'제목 없음')+'</div>'
    +'<div class="ebook-tags"><span class="ebook-tag">'+(eb.category||'자기계발')+'</span></div>'
    +'<div class="ebook-actions">'
    +'<button class="ebook-act-btn" onclick="event.stopPropagation();openEbook('+eb.id+')">📖 열기</button>'
    +'<button class="ebook-act-btn" onclick="event.stopPropagation();deleteEbook('+eb.id+')">🗑️</button>'
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
  btn.textContent='⏳ 불러오는 중...';btn.disabled=true;
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
    preview.textContent='✅ 불러오기 완료 ('+text.length+'자)\n\n'+text.substring(0,300)+'...';
    preview.classList.add('show');
    checkCvReady();
    showToast('success','URL 내용을 불러왔습니다!');
  }catch(e){
    APP.urlContent='';
    preview.textContent='⚠️ 불러오기 실패: '+e.message+'\n\nURL을 직접 입력해두면 AI가 참고합니다.';
    preview.classList.add('show');
    checkCvReady();
  }finally{btn.textContent='📥 불러오기';btn.disabled=false;}
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
  var icons={'pdf':'📄','docx':'📝','doc':'📝'};
  document.getElementById('cv-dz').classList.add('has-file');
  document.getElementById('cv-uico').textContent=icons[ext]||'📂';
  document.getElementById('cv-utit').textContent='파일 준비 완료';
  document.getElementById('cv-usub').style.display='none';
  var chip=document.getElementById('cv-chip');chip.textContent='📎 '+f.name;chip.style.display='inline-flex';
  checkCvReady();
}
function checkCvReady(){
  var key=getApiKey();
  var btn=document.getElementById('cv-genbtn');
  if(!btn)return;
  // API 키 경고 배너
  var apiwarn=document.getElementById('cv-apikey-warn');
  if(apiwarn)apiwarn.style.display=(!key||key.length<=10)?'block':'none';
  var ready=false;
  if(CV_MODE==='file')ready=!!(APP.selFile&&key&&key.length>10);
  else if(CV_MODE==='topic')ready=!!(document.getElementById('topic-main')&&document.getElementById('topic-main').value.trim()&&key&&key.length>10);
  else if(CV_MODE==='url'){var u=document.getElementById('url-input');ready=!!(u&&u.value.trim()&&key&&key.length>10);}
  else if(CV_MODE==='multi')ready=!!((APP.multiFiles.length||APP.multiLinks.length||(document.getElementById('ms-notes')&&document.getElementById('ms-notes').value.trim()))&&key&&key.length>10);
  btn.disabled=!ready;
  if(!key||key.length<=10){btn.textContent='🔑 API 키를 먼저 설정해주세요';btn.style.opacity='.5';}
  else{btn.textContent='✨ 자료 분석 & 제목 후보 만들기';btn.style.opacity=ready?'1':'.4';}
  var warn=document.getElementById('cv-limit-warn');
  if(warn)warn.style.display='none';
}
function resetConverter(){
  APP.selFile=null;APP.ebook=null;APP.editMode=false;APP.salesEditMode=false;APP.urlContent='';APP.multiFiles=[];APP.multiLinks=[];APP.titleCandidates=[];APP.selectedTitleIndex=-1;APP.lockedTitle='';APP.lockedSubtitle='';APP.interviewQuestions=[];APP.interviewAnswers={};APP.interviewContext='';APP.smartAnalysis=null;APP.workspaceStage='input';APP.projectName='';
  CV_MODE='file';
  var fi=document.getElementById('cv-fi');if(fi)fi.value='';
  var dz=document.getElementById('cv-dz');if(dz)dz.classList.remove('has-file');
  document.getElementById('cv-uico').textContent='📂';
  document.getElementById('cv-utit').textContent='파일을 드래그하거나 클릭하세요';
  document.getElementById('cv-usub').style.display='';
  document.getElementById('cv-chip').style.display='none';
  // reset topic/url/text
  ['topic-main','topic-target','topic-extra','url-input','url-direction','url-extra','ms-notes','ms-direction','ms-link-input','ts-final-title','ts-final-subtitle'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.value='';
  });
  var up=document.getElementById('url-preview');if(up){up.textContent='';up.classList.remove('show');} renderMultiSources(); var ts=document.getElementById('cv-title-state');if(ts)ts.style.display='none';
  // reset tabs
  switchInputTab('file');
  document.getElementById('cv-upload-state').style.display='';
  document.getElementById('cv-process-state').style.display='none';
  document.getElementById('cv-result-state').style.display='none';
  document.getElementById('cv-sales-state').style.display='none';
  checkCvReady();
}
function setCvStep(n){
  for(var i=1;i<=5;i++){
    var e=document.getElementById('cvp'+i);if(!e)continue;
    e.classList.remove('active','done');
    if(i<n)e.classList.add('done');
    else if(i===n)e.classList.add('active');
  }
  // 진행률 업데이트
  var pcts=[0,18,35,60,82,100];
  var pct=pcts[Math.min(n,5)];
  var bar=document.getElementById('cv-progress-bar');
  var ring=document.getElementById('cv-progress-ring');
  var pctEl=document.getElementById('cv-progress-pct');
  if(bar)bar.style.width=pct+'%';
  if(ring){var offset=352-(352*pct/100);ring.style.strokeDashoffset=offset;}
  if(pctEl)pctEl.textContent=pct+'%';
  // 재미 메시지
  var msgs=['📖 원문을 꼼꼼히 읽고 있어요...','🎨 독자를 사로잡을 제목을 구상 중...','✍️ 25,000자 본문을 열심히 쓰고 있어요!','🛒 판매용 상세페이지 작성 중...','✨ 거의 다 됐어요! 조금만 기다려주세요~'];
  var msg=document.getElementById('cv-fun-msg');
  if(msg&&msgs[n-1])msg.textContent=msgs[n-1];
  // 진행 중 애니메이션 (실제 API 응답 전 가짜 진행)
  if(n===3){
    // API 호출 중 - 60%~80% 사이를 천천히 채움
    var fakeStart=60,fakeEnd=80,fakeDuration=90000; // 90초
    var fakeStep=(fakeEnd-fakeStart)/fakeDuration*500;
    var fakePct=fakeStart;
    window._fakeTimer=setInterval(function(){
      fakePct=Math.min(fakePct+fakeStep,fakeEnd);
      var o=352-(352*fakePct/100);
      if(bar)bar.style.width=fakePct+'%';
      if(ring)ring.style.strokeDashoffset=o;
      if(pctEl)pctEl.textContent=Math.round(fakePct)+'%';
      if(fakePct>=fakeEnd)clearInterval(window._fakeTimer);
    },500);
  } else {
    if(window._fakeTimer)clearInterval(window._fakeTimer);
  }
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

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
    return '<div class="si-card"><div class="si-q">'+(idx+1)+'. '+x(q.question)+(q.required?' <span style="color:#fda4af">*</span>':'')+'</div>'+body+'</div>';
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
  var key=getApiKey();var btn=document.getElementById('si-submit-btn');var old=btn?btn.textContent:'';if(btn){btn.disabled=true;btn.textContent='⏳ 제목 설계 중...';}
  var prompt=`당신은 한국 전자책 상품의 제목과 후킹을 설계하는 편집자입니다. 앞선 자료 분석과 사용자 답변을 반영해 판매용 전자책 제목 후보를 만드세요.\n\n[앞선 분석]\n${JSON.stringify(APP.smartAnalysis||APP.titleAnalysis||{})}\n\n[사용자 답변]\n${skipped?'사용자가 추가 질문을 건너뛰고 자료만으로 진행함':smartInterviewAnswerText()}\n\n[규칙]\n- 과장, 보장, 구체적인 수익 금액, 100%, 무조건 표현 금지\n- 궁금증·문제공감·실전 효용·신뢰·검색 의도를 균형 있게 사용\n- 입력에 없는 판매 실적이나 경험을 창작하지 않음\n- 정확히 12개 후보 생성\n\n유효한 JSON만 반환:\n{"analysis":{"topic":"","target":"","pain":"","angle":"","sourceSummary":""},"titles":[{"title":"","subtitle":"","type":"궁금증형|문제공감형|실전형|검색형|신뢰형|프리미엄형","reason":"","scores":{"hook":0,"trust":0,"search":0,"policy":0,"total":0}}]}`;
  try{var content=await buildApiContent(prompt);var resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:5000,system:'유효한 JSON 객체 하나만 반환하세요.',messages:[{role:'user',content:content}]})});var data=await resp.json();if(!resp.ok)throw new Error(data.error&&data.error.message||'제목 생성 실패');var raw=(data.content||[]).filter(function(z){return z.type==='text';}).map(function(z){return z.text;}).join('');var clean=raw.replace(/```json|```/g,'').trim();clean=clean.substring(clean.indexOf('{'),clean.lastIndexOf('}')+1);var obj=JSON.parse(clean);APP.titleCandidates=(obj.titles||[]).map(function(t){t.title=safeTitleText(t.title);t.subtitle=safeTitleText(t.subtitle);return t;});APP.titleAnalysis=obj.analysis||APP.smartAnalysis||{};APP.selectedTitleIndex=0;var si=document.getElementById('cv-interview-state');if(si)si.style.display='none';document.getElementById('cv-title-state').style.display='';renderTitleStudio();atlasSetWorkspaceStage('title');window.scrollTo(0,0);}catch(e){showToast('error','제목 후보 생성 실패: '+e.message,5000);}finally{if(btn){btn.disabled=false;btn.textContent=old||'답변 반영 & 제목 추천';}}
}

async function openTitleStudio(isRetry){
  atlasSetWorkspaceStage('analysis');
  var key=getApiKey();if(!key||key.length<=10){showApp('settings');showToast('error','API 키를 먼저 입력해주세요.');return;}
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
    var resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:5000,system:'반드시 유효한 JSON 객체 하나만 반환하세요. 입력 자료의 저작권을 존중하고 검증되지 않은 성과를 창작하지 마세요.',messages:[{role:'user',content:content}]})});
    var data=await resp.json();if(!resp.ok)throw new Error(data.error&&data.error.message||'제목 생성 실패');
    var raw=(data.content||[]).filter(function(x){return x.type==='text';}).map(function(x){return x.text;}).join('');
    var clean=raw.replace(/```json|```/g,'').trim();clean=clean.substring(clean.indexOf('{'),clean.lastIndexOf('}')+1);
    var obj=JSON.parse(clean);APP.smartAnalysis=obj.analysis||{};APP.titleAnalysis=obj.analysis||{};var iv=obj.interview||{};APP.interviewContext=iv.reason||'';APP.interviewQuestions=(iv.questions||[]).slice(0,5).map(normalizeInterviewQuestion);APP.interviewAnswers={};
    if(iv.needed&&APP.interviewQuestions.length){APP.titleCandidates=[];renderSmartInterview(iv.reason);}
    else{APP.titleCandidates=(obj.titles||[]).map(function(t){t.title=safeTitleText(t.title);t.subtitle=safeTitleText(t.subtitle);return t;});APP.selectedTitleIndex=0;document.getElementById('cv-upload-state').style.display='none';document.getElementById('cv-title-state').style.display='';renderTitleStudio();atlasSetWorkspaceStage('title',{coach:'자료가 충분해 추가 질문 없이 프리미엄 제목 후보를 완성했습니다.'});window.scrollTo(0,0);}
  }catch(e){showToast('error','제목 후보 생성 실패: '+e.message,5000);}
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
  APP.lockedTitle=title;APP.lockedSubtitle=sub;atlasSetWorkspaceStage('title',{coach:'제목이 잠겼습니다. 이제 전자책을 제작합니다.'});startGenerate(true);
}

async function startGenerate(titleLocked){
  if(!titleLocked||!APP.lockedTitle){openTitleStudio();return;}
  var key=getApiKey();
  if(!key||key.trim().length<=10){
    showApp('settings');
    showToast('error','⚠️ 설정에서 API 키를 먼저 입력해주세요.');
    return;
  }
  // 무료 체험 모드별 생성 횟수 체크
  if(!canGenerate(CV_MODE)){
    showTrialLimitPopup(CV_MODE);
    return;
  }
  var u=APP.user;

  // 에러박스 초기화
  var warn=document.getElementById('cv-limit-warn');
  if(warn){warn.style.display='none';warn.innerHTML='';}

  document.getElementById('cv-upload-state').style.display='none';
  var _ts=document.getElementById('cv-title-state');if(_ts)_ts.style.display='none';
  document.getElementById('cv-result-state').style.display='none';
  document.getElementById('cv-sales-state').style.display='none';
  var _edoc=document.getElementById('cv-edoc');if(_edoc)_edoc.innerHTML='';
  var _spb=document.getElementById('cv-sp-body');if(_spb)_spb.innerHTML='';
  document.getElementById('cv-process-state').style.display='';
  atlasSetWorkspaceStage('analysis',{coach:'자료와 선택한 제목을 바탕으로 콘텐츠 제작 계획을 정리하고 있습니다.'});
  setCvStep(1);

  function showGenError(msg){
    document.getElementById('cv-process-state').style.display='none';
    document.getElementById('cv-upload-state').style.display='';
    var w=document.getElementById('cv-limit-warn');
    w.style.display='block';
    w.style.background='rgba(239,68,68,.12)';
    w.style.border='1px solid rgba(239,68,68,.35)';
    w.style.color='#fca5a5';
    w.style.borderRadius='12px';
    w.style.padding='16px 20px';
    w.style.lineHeight='1.8';
    w.style.whiteSpace='pre-line';
    w.innerHTML=msg;
    checkCvReady();
  }

  var PROMPT = `위 입력을 바탕으로 한국어 전자책과 크몽 판매용 카피 데이터를 작성하세요.

[잠긴 제목 — 변경 금지]
제목: ${APP.lockedTitle}
부제목: ${APP.lockedSubtitle||''}
반환 JSON의 title과 subtitle은 위 문구를 정확히 사용하세요.
반드시 JSON 객체 하나만 반환하고 JSON 밖의 텍스트는 작성하지 마세요.

[분량과 구성]
- preface: 600자 이상
- intro: 800자 이상
- chapters: 정확히 7개, 각 content 3500자 이상
- conclusion: 1200자 이상
- appendices: 정확히 3개
- 각 챕터는 문제 해부형, 사례 분석형, 단계별 실행형, 개념 전환형, 도구·자원형, 심화 전략형, 종합 실행형을 한 번씩 사용합니다.
- actionBox는 오늘 바로 할 수 있는 행동 하나입니다.
- keyPoints는 새로운 인사이트 3개입니다.
- actionItems는 구체적인 실행 단계 3개 이상입니다.

[사실성과 안전]
- 사용자가 제공하지 않은 저자의 실제 경험, 판매 실적, 구매후기, 통계는 창작하지 않습니다.
- 특정 인물의 사례가 필요하면 가상 사례임을 본문 안에서 명시합니다.
- 최신 정보가 필요한 도구·정책은 확실하지 않으면 확인 필요라고 씁니다.

[크몽 판매 카피]
- 구체적인 수익 금액, 매출 금액, 성장률, 달성 기간을 후킹과 상세페이지 문구에 사용하지 않습니다.
- 보장·무조건·100%·누구나 성공·자동수익 등의 표현을 사용하지 않습니다.
- testimonials는 반드시 빈 배열입니다.
- 가격·정가·할인액 필드는 생성하지 않습니다.
- hook은 핵심 불편을 찌르는 짧은 문장으로 작성합니다.
- pains, solution, learnings, benefits, before, after는 각각 구체적인 문장 배열로 작성합니다.

아래 스키마를 정확히 따르세요.
{
  "title":"전자책 제목",
  "subtitle":"부제목",
  "author":"저자명",
  "category":"카테고리",
  "description":"책 소개",
  "targetReader":"구체적인 추천 독자 상황",
  "preface":"저자 서문. 사용자 입력에 실제 경험이 없으면 경험을 꾸며내지 말고 집필 배경과 문제의식 중심으로 작성",
  "intro":"서론",
  "authorBio":"저자 소개. 정보가 없으면 전문성을 과장하지 않는 일반 소개",
  "chapters":[
    {"number":1,"title":"챕터 제목","content":"문제 해부형 본문","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]},
    {"number":2,"title":"챕터 제목","content":"사례 분석형 본문. 가상 사례는 가상임을 명시","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]},
    {"number":3,"title":"챕터 제목","content":"단계별 실행형 본문","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]},
    {"number":4,"title":"챕터 제목","content":"개념 전환형 본문","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]},
    {"number":5,"title":"챕터 제목","content":"도구·자원형 본문","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]},
    {"number":6,"title":"챕터 제목","content":"심화 전략형 본문","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]},
    {"number":7,"title":"챕터 제목","content":"종합 실행형 본문","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]}
  ],
  "conclusion":"핵심 정리와 실행 순서, 현실적인 응원",
  "appendices":[
    {"title":"핵심 실천 체크리스트","content":"구체적 체크리스트"},
    {"title":"추천 도구와 참고 자료","content":"도구별 특징, 사용법, 확인 시점"},
    {"title":"실전 실행 플랜","content":"단계별 실행 계획"}
  ],
  "copyright":{"year":"2026","publisher":"독립 출판","notice":"","disclaimer":"","contact":""},
  "sales":{
    "hook":"수치 없는 강력한 후킹 문장",
    "subhook":"구체적인 상황을 묘사한 서브 후킹",
    "pains":["고통1","고통2","고통3","고통4"],
    "solution":"이 책이 제공하는 해결 구조",
    "learnings":["배울 내용1","배울 내용2","배울 내용3","배울 내용4"],
    "benefits":["혜택1","혜택2","혜택3","혜택4"],
    "before":["변화 전1","변화 전2","변화 전3"],
    "after":["변화 후1","변화 후2","변화 후3"],
    "testimonials":[],
    "faqs":[{"q":"질문1","a":"답변1"},{"q":"질문2","a":"답변2"},{"q":"질문3","a":"답변3"}],
    "finalPush":"과장 없는 최종 행동 유도 문장"
  }
}`;

  try{
    // ── 모드별 메시지 구성
    var messages=[];
    if(CV_MODE==='file'){
      if(!APP.selFile)throw new Error('파일을 선택해주세요.');
      messages=[{role:'user',content:await buildApiContent('업로드한 문서를 단순 번역하지 말고 핵심 개념을 재구성하여 한국 독자용 새 전자책으로 집필하세요. 사용자는 해당 문서를 활용할 권한이 있다고 전제하되, 원문 문장과 목차를 그대로 복제하지 마세요.\n\n'+PROMPT)}];
    } else if(CV_MODE==='topic'){
      var topic=document.getElementById('topic-main').value.trim();
      var target=document.getElementById('topic-target').value.trim();
      var extra=document.getElementById('topic-extra').value.trim();
      var topicPrompt='주제: '+topic+(target?'\n대상 독자: '+target:'')+(extra?'\n추가 요구사항: '+extra:'');
      messages=[{role:'user',content:[{type:'text',text:'아래 주제로 한국 베스트셀러 전자책을 처음부터 완전히 새로 창작해주세요.\n\n'+topicPrompt+'\n\n위 주제를 기반으로 실전 전문 지식과 구체적 예시를 풍부하게 담아 창작하세요.\n\n'+PROMPT}]}];
    } else if(CV_MODE==='url'){
      var urlVal=document.getElementById('url-input').value.trim();
      var urlDir=document.getElementById('url-direction').value.trim();
      var urlExtra=document.getElementById('url-extra').value.trim();
      var urlFetched=APP.urlContent||'';
      var urlContext='참고 URL: '+urlVal+(urlExtra?'\n추가 URL:\n'+urlExtra:'')+(urlDir?'\n전자책 방향: '+urlDir:'')+(urlFetched?'\n\nURL에서 불러온 내용 (참고용):\n'+urlFetched.substring(0,8000):'');
      messages=[{role:'user',content:[{type:'text',text:'아래 URL의 내용을 분석하여 한국 독자용 전자책을 새롭게 창작해주세요.\n\n'+urlContext+'\n\nURL의 핵심 내용을 살리되 원문의 표현과 구조를 복제하지 말고, 실전 예시와 한국 실정에 맞는 내용으로 재구성하세요.\n\n'+PROMPT}]}];
    } else if(CV_MODE==='multi'){
      var multiPrompt='여러 자료를 종합하여 하나의 독창적인 한국어 전자책을 만드세요.\n- 핵심 자료는 중심 근거로 사용합니다.\n- 참고 자료는 보충에만 사용합니다.\n- 자료 간 중복은 통합하고 충돌하는 주장은 단정하지 않습니다.\n- 유튜브 링크에 자막이 없으면 제목과 사용자 메모 이상을 추측하지 않습니다.\n- 원문 문장과 목차를 그대로 복제하지 말고 새로운 구조와 표현으로 집필합니다.\n- 최신성이 필요한 정보는 확인 필요를 표시합니다.\n\n'+PROMPT;
      messages=[{role:'user',content:await buildApiContent(multiPrompt)}];
    }
    setCvStep(2);await sleep(600);setCvStep(3);

    // 오래 걸릴 때 안내
    var slowTimer=setTimeout(function(){
      var msg=document.getElementById('cv-fun-msg');
      if(msg)msg.innerHTML='<span style="color:#fbbf24">⏳ 응답이 오래 걸리고 있어요. 조금만 더 기다려주세요...</span>';
    },60000);

    var resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:32000,
        system:ATLAS_SYSTEM_PROMPT,
        messages:messages
      })
    });
    clearTimeout(slowTimer);
    if(window._fakeTimer)clearInterval(window._fakeTimer);

    setCvStep(4);
    var data=await resp.json();
    if(!resp.ok){
      var errMsg=data.error?.message||'';
      var errType=data.error?.type||'';
      var koreanErr='';
      if(errType==='authentication_error'||errMsg.includes('API key')||errMsg.includes('api_key')||resp.status===401)
        koreanErr='❌ API 키 오류\nAPI 키가 잘못되었습니다. 설정 메뉴에서 API 키를 다시 확인해주세요.\n\n원인: '+errMsg;
      else if(errType==='permission_error'||resp.status===403)
        koreanErr='❌ 권한 오류\n크레딧이 부족하거나 키가 만료됐을 수 있습니다.\nconsole.anthropic.com에서 확인해주세요.\n\n원인: '+errMsg;
      else if(errType==='rate_limit_error'||resp.status===429)
        koreanErr='❌ 요청 한도 초과\n잠시 후 (30초~1분) 다시 시도해주세요.\n\n원인: '+errMsg;
      else if(resp.status===500||resp.status===529)
        koreanErr='❌ Anthropic 서버 오류\n잠시 후 다시 시도해주세요.\n\n원인: '+errMsg;
      else if(errMsg.includes('credit')||errMsg.includes('billing')||errMsg.includes('balance'))
        koreanErr='❌ API 크레딧 부족\nconsole.anthropic.com에서 크레딧을 충전해주세요.\n\n원인: '+errMsg;
      else
        koreanErr='❌ API 오류 ('+resp.status+')\n'+errMsg;
      throw new Error(koreanErr);
    }
    // max_tokens 도달해도 생성된 내용으로 파싱 시도 (에러 안 냄)
    var raw='';if(data.content)for(var i=0;i<data.content.length;i++)if(data.content[i].type==='text'){raw=data.content[i].text;break;}
    var clean=raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    var js=clean.indexOf('{'),je=clean.lastIndexOf('}');
    if(js===-1)throw new Error('JSON을 찾을 수 없습니다. 다시 시도해주세요.');
    clean=clean.substring(js,je+1);
    var ebook;
    try{ebook=JSON.parse(clean);}catch(e2){
      // 1차: 후행 쉼표 제거
      var fix=clean.replace(/,\s*([}\]])/g,'$1');
      try{ebook=JSON.parse(fix);}catch(e3){
        // 2차: 열린 괄호 닫기
        fix=fix.replace(/,\s*$/,'');
        var oa=(fix.match(/\[/g)||[]).length-(fix.match(/\]/g)||[]).length;
        var ob=(fix.match(/\{/g)||[]).length-(fix.match(/\}/g)||[]).length;
        for(var kk=0;kk<oa;kk++)fix+=']';for(var kk=0;kk<ob;kk++)fix+='}';
        try{ebook=JSON.parse(fix);}catch(e4){
          // 3차: 마지막 완전한 챕터까지만 파싱 시도
          var chIdx=clean.lastIndexOf('"content"');
          if(chIdx>0){
            var partial=clean.substring(0,chIdx);
            var li=partial.lastIndexOf('{');
            if(li>0){
              partial=partial.substring(0,li).replace(/,\s*$/,'')+'],"conclusion":"[반드시 1000자 이상 작성. 절대 짧게 쓰지 말 것] 핵심 요약 + 독자 액션플랜 + 응원 메시지","appendices":[{"title":"핵심 체크리스트","content":"[반드시 500자 이상] 실천 항목 체크리스트"},{"title":"참고 자료 및 추천 도구","content":"[반드시 500자 이상] 관련 사이트, 도구, 추천 자료"},{"title":"실전 워크시트","content":"[반드시 500자 이상] 독자 실전 연습 시트"}],"copyright":{"year":"2026","publisher":"독립 출판","notice":"","disclaimer":"","contact":""},"sales":{"hook":"","subhook":"","pains":[],"solution":"","learnings":[],"benefits":[],"before":[],"after":[],"testimonials":[],"faqs":[],"finalPush":""}}';
              try{ebook=JSON.parse(partial);}catch(e5){
                throw new Error('❌ JSON 파싱 오류\n다시 시도해주세요. 계속 실패 시 더 짧은 내용으로 시도해보세요.');
              }
            } else throw new Error('❌ JSON 파싱 오류\n다시 시도해주세요.');
          } else throw new Error('❌ JSON 파싱 오류\n다시 시도해주세요.');
        }
      }
    }
    setCvStep(5);await sleep(400);
    ebook.title=APP.lockedTitle;
    if(APP.lockedSubtitle)ebook.subtitle=APP.lockedSubtitle;
    ebook=sanitizeKmongSalesClaims(ebook);
    APP.ebook=ebook;
    addEbook(u.email,ebook);
    addTrialCount(CV_MODE); // 모드별 체험 횟수 기록
    // update user in storage
    var users=getUsers();u.plan=u.plan||'free';users[u.email]=u;saveUsers(users);
    document.getElementById('cv-process-state').style.display='none';
    document.getElementById('cv-result-state').style.display='';
    renderCvEbook(ebook);
    atlasSetWorkspaceStage('ebook');
    showToast('success','🎉 전자책이 생성되었습니다!');
  }catch(e){
    console.error('생성 오류:', e);
    var msg=e.message||'알 수 없는 오류가 발생했습니다.';
    // 네트워크 오류 처리
    if(msg.includes('fetch')||msg.includes('network')||msg.includes('Failed to fetch')||msg.includes('NetworkError')){
      msg='❌ 네트워크 연결 오류\n인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.\n\nCORS 오류일 경우: 브라우저가 API 직접 호출을 막을 수 있습니다.\nChrome에서 접속해주세요.';
    }
    showErrorPopup(msg);
  }
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
  while(p&&p.style.position!=='fixed'){p=p.parentElement;}
  if(p)p.remove();
}
function showErrorPopup(msg){
  var ps=document.getElementById('cv-process-state');
  var us=document.getElementById('cv-upload-state');
  if(ps)ps.style.display='none';
  if(us)us.style.display='';
  checkCvReady();
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  var icon='⚠️';
  var lines2=msg.split('\n');
  var title2=(lines2[0]||'생성 실패').replace('❌ ','').replace('⚠️ ','');
  var detail2=lines2.slice(1).join('\n').trim();
  var extraHtml='';
  if(msg.indexOf('요청 한도 초과')!==-1||msg.indexOf('rate_limit')!==-1){
    icon='⏱️';
    extraHtml='<div style="padding:10px;background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.2);border-radius:10px;font-size:13px;color:#e8b84b;margin-bottom:10px">⏰ 30초~1분 후 다시 시도해주세요</div>';
  } else if(msg.indexOf('API 키')!==-1||msg.indexOf('authentication')!==-1){
    icon='🔑';
    extraHtml='<button onclick="closeErrorPopup(this);showApp(\'settings\')" style="width:100%;padding:11px;background:linear-gradient(135deg,#6366f1,#a78bfa);border:none;border-radius:10px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;margin-bottom:8px">⚙️ 설정에서 API 키 확인</button>';
  } else if(msg.indexOf('크레딧')!==-1||msg.indexOf('credit')!==-1){
    icon='💳';
    extraHtml='<a href="https://console.anthropic.com/settings/billing" target="_blank" style="display:block;padding:11px;background:linear-gradient(135deg,#6366f1,#a78bfa);color:#fff;font-size:14px;font-weight:700;border-radius:10px;text-decoration:none;margin-bottom:8px;text-align:center">💳 크레딧 충전하기</a>';
  }
  var detailHtml=detail2?('<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#94a3b8;line-height:1.8;white-space:pre-line">'+detail2+'</div>'):'';
  var div=document.createElement('div');
  div.setAttribute('data-popup','1');
  div.style.cssText='background:#0c0c1a;border:2px solid rgba(240,80,112,.3);border-radius:20px;padding:32px 26px;max-width:440px;width:100%;text-align:center';
  div.innerHTML='<div style="font-size:48px;margin-bottom:14px">'+icon+'</div>'
    +'<div style="font-size:11px;font-weight:700;color:#a5b4fc;margin-bottom:6px">Atlas AI eBook Studio</div>'
    +'<h2 style="font-size:18px;font-weight:900;color:#fff;margin-bottom:16px;word-break:keep-all">'+title2+'</h2>'
    +detailHtml+extraHtml
    +'<button onclick="closeErrorPopup(this)" style="width:100%;padding:11px;background:transparent;border:1px solid rgba(255,255,255,.15);border-radius:10px;font-size:13px;color:#94a3b8;cursor:pointer">닫기</button>';
  overlay.appendChild(div);
  document.body.appendChild(overlay);
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
        showToast('success','📝 Word 파일이 저장되었습니다!');
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
  btn.textContent=APP.editMode?'✅ 완료':'✏️ 편집';
  btn.style.cssText=APP.editMode?'background:rgba(16,185,129,.2);border-color:rgba(16,185,129,.4);color:#34d399':'';
  setEditableAll(doc,APP.editMode);
  if(!APP.editMode)showToast('success','✅ 편집이 저장되었습니다');
}
function toggleCvSalesEdit(){
  APP.salesEditMode=!APP.salesEditMode;
  var btn=document.getElementById('cv-sp-editbtn');
  var toolbar=document.getElementById('cv-sp-toolbar');
  var body=document.getElementById('cv-sp-body');
  if(!body)return;
  toolbar.style.display=APP.salesEditMode?'flex':'none';
  if(btn){
    btn.textContent=APP.salesEditMode?'✅ 완료':'✏️ 편집';
    btn.style.cssText=APP.salesEditMode?'background:rgba(16,185,129,.2);border-color:rgba(16,185,129,.4);color:#34d399':'';
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
  if(!APP.salesEditMode)showToast('success','✅ 상세페이지 편집이 저장되었습니다');
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

