window.addEventListener('load',function(){setTimeout(function(){atlasBindDraftAutosave();var raw=localStorage.getItem(atlasProjectStorageKey());if(raw){try{var d=JSON.parse(raw);atlasSetWorkspaceStage(d.stage||'input',{noSave:true,coach:'저장된 프로젝트가 있습니다. 불러오기 버튼을 누르면 이어서 작업할 수 있습니다.'});}catch(e){atlasSetWorkspaceStage('input',{noSave:true});}}else atlasSetWorkspaceStage('input',{noSave:true});},350);});
/* Atlas Final Integrated Layer */
function atlasTextLen(v){return String(v||'').replace(/<[^>]*>/g,'').trim().length;}
function atlasClamp(n){return Math.max(0,Math.min(100,Math.round(n)));}

/* Atlas V3 Phase 1 — 결정적(비 AI) Cross-Chapter Consistency 체크 3종. 새 AI
   호출을 추가하지 않고 이미 있는 텍스트만으로 판단한다(요구사항: "코드로
   확실하게 감지 가능하면 불필요한 AI 호출을 추가하지 않는다").
   1) 챕터 제목 근접 중복 — js/application.js의 atlasTitleSimilarity()(제목
      후보 중복 감지용으로 이미 만든 토큰 자카드 유사도)를 챕터 제목에도
      그대로 재사용한다(제목 전용이 아니라 범용 문자열 유사도 함수라서 안전).
   2) AI 생성 티가 나는 필러 표현 밀도 — WRITING_STYLE_RULES에서 명시적으로
      금지한 패턴을 1000자당 출현 횟수로 환산한다.
   3) 요약-본문 불일치 — chapter.summary가 chapter.content와 토큰을 거의 공유
      하지 않으면(예: 부분 재생성 후 요약이 옛 내용을 그대로 남긴 경우) 실제
      불일치로 의심한다. */
function atlasFindDuplicateChapterTitles(chapters){
  return (typeof atlasFindNearDuplicateTitles==='function') ? atlasFindNearDuplicateTitles(chapters, 0.6) : [];
}
var ATLAS_FILLER_PATTERNS=[/단순히/g,/결국/g,/중요합니다/g,/바로\s*지금/g,/사실\s*,/g];
function atlasFillerDensityPer1000(text){
  var s=String(text||'');if(!s.length)return 0;
  var count=ATLAS_FILLER_PATTERNS.reduce(function(sum,p){p.lastIndex=0;return sum+((s.match(p)||[]).length);},0);
  return count/(s.length/1000);
}
function atlasSummaryMatchesContent(summary,content){
  if(!summary||!content)return true; // 요약이 아예 없으면(구버전 프로젝트) 이 검사 자체를 건너뛴다 — 하위호환
  if(typeof atlasTitleTokens!=='function')return true;
  var ts=atlasTitleTokens(summary),tc=atlasTitleTokens(content.slice(0,4000));
  if(ts.length<3||tc.length<10)return true; // 너무 짧아 판단 불가한 경우 오탐 방지
  var setC={};tc.forEach(function(t){setC[t]=1;});
  var overlap=ts.filter(function(t){return setC[t];}).length;
  return (overlap/ts.length) >= 0.12;
}

function atlasQualityScores(e){
 e=e||{};var ch=e.chapters||[],sales=e.sales||{};
 var body=ch.reduce(function(a,c){return a+atlasTextLen(c.content);},0);

 var dupTitlePairs=atlasFindDuplicateChapterTitles(ch);
 var mismatchedSummaries=ch.filter(function(c){return !atlasSummaryMatchesContent(c.summary,c.content);});
 var fillerDensity=ch.length ? ch.reduce(function(a,c){return a+atlasFillerDensityPer1000(c.content);},0)/ch.length : 0;

 var completeness=atlasClamp(45+ch.length*5+(e.intro?5:0)+(e.conclusion?5:0)+(e.appendices&&e.appendices.length?5:0)-(dupTitlePairs.length*6)-(mismatchedSummaries.length*4));
 var readability=atlasClamp(88-(ch.some(function(c){return atlasTextLen(c.content)>7000;})?7:0)+(ch.every(function(c){return c.keyPoints&&c.actionItems;})?6:0)-Math.min(20,Math.round(fillerDensity*4)));
 var salesScore=atlasClamp(55+(sales.hook?10:0)+(sales.pains&&sales.pains.length>=3?8:0)+(sales.learnings&&sales.learnings.length>=3?8:0)+(sales.faqs&&sales.faqs.length>=3?8:0)+(sales.finalPush?6:0));
 /* Atlas V3 Phase 1: 이전에는 여기 정책 검사 정규식이 sanitizeKmongSalesClaims()/
    safeTitleText()와 다른 커버리지를 가진 별도 정규식이었다 — 이제 세 곳 모두
    같은 ATLAS_BANNED_CLAIM_PATTERNS를 참조하는 atlasContainsBannedClaim()
    하나만 쓴다(하위호환: 이 함수가 없는 매우 이전 페이지 로드 순서 문제에도
    대비해 typeof 가드를 둔다). */
 var policy=100;
 var policyText=JSON.stringify({title:e.title,subtitle:e.subtitle,sales:sales});
 var hasBannedClaim=(typeof atlasContainsBannedClaim==='function') ? atlasContainsBannedClaim(policyText) : /100\s*%|무조건|수익\s*보장|매출\s*보장|자동\s*수익|월\s*\d[\d,]*\s*(?:만|억|천)?\s*원/i.test(policyText);
 if(hasBannedClaim)policy-=28;
 if(sales.testimonials&&sales.testimonials.length)policy-=22;
 var depth=atlasClamp(45+Math.min(35,body/800)+(ch.filter(function(c){return c.actionItems&&c.actionItems.length>=3;}).length*3));
 var total=atlasClamp((completeness+readability+salesScore+policy+depth)/5);
 var notes=[];
 if(body<18000)notes.push('본문 분량이 짧습니다. 핵심 챕터를 더 구체화하면 만족도가 높아집니다.');
 if(ch.length<6)notes.push('목차가 단순합니다. 독자가 따라가기 쉬운 단계형 구성을 권장합니다.');
 if(salesScore<85)notes.push('후킹·FAQ·구매 판단 정보 중 일부가 약합니다. 판매자료만 다시 생성할 수 있습니다.');
 if(policy<100)notes.push('과장 또는 증빙이 필요한 표현이 감지됐습니다. 정책 정리를 실행하세요.');
 if(dupTitlePairs.length)notes.push('챕터 '+dupTitlePairs.map(function(p){return (p.i+1)+'·'+(p.j+1);}).join(', ')+'장의 제목/내용이 서로 비슷합니다. 서로 다른 각도로 구별해보세요.');
 if(mismatchedSummaries.length)notes.push((mismatchedSummaries.length)+'개 챕터의 요약이 본문과 잘 맞지 않는 것 같습니다. 해당 챕터를 다시 확인하세요.');
 if(fillerDensity>6)notes.push('상투적인 필러 표현이 자주 보입니다. 문체를 다시 다듬으면 좋아집니다.');
 if(!notes.length)notes.push('구성·가독성·판매자료가 균형 있게 준비됐습니다. 최종 문구만 직접 확인하세요.');
 return {total:total,completeness:completeness,readability:readability,sales:salesScore,policy:atlasClamp(policy),depth:depth,notes:notes,duplicateChapterPairs:dupTitlePairs,mismatchedSummaryCount:mismatchedSummaries.length,fillerDensity:fillerDensity};
}
function atlasQualityHTML(e,compact){var q=atlasQualityScores(e);return '<div class="atlas-final-tools"><div class="aft-head"><div><div class="aft-kicker">ATLAS AI QUALITY COACH</div><div class="aft-title">전자책 완성도 점검</div></div><div class="aft-score">'+q.total+'</div></div><div class="aft-grid"><div class="aft-metric"><b>'+q.completeness+'</b><span>구성 완성도</span></div><div class="aft-metric"><b>'+q.readability+'</b><span>가독성</span></div><div class="aft-metric"><b>'+q.sales+'</b><span>판매 설득력</span></div><div class="aft-metric"><b>'+q.policy+'</b><span>정책 안전도</span></div></div><div class="aft-note">'+q.notes.join('<br>• ')+'</div><div class="aft-actions"><button class="aft-btn primary" onclick="openAtlasPartialModal()">필요한 부분만 수정</button><button class="aft-btn" onclick="atlasApplySafeClaims()">위험 표현 정리</button><button class="aft-btn" onclick="openTitleStudio(true)">제목 다시 추천</button></div></div>';}
function renderAtlasQuality(){var a=document.getElementById('atlas-quality-body');if(a)a.innerHTML=APP.ebook?atlasQualityHTML(APP.ebook,false):'';}
function atlasApplySafeClaims(){if(!APP.ebook)return;APP.ebook=sanitizeKmongSalesClaims(APP.ebook);renderCvEbook(APP.ebook);renderAtlasQuality();atlasSaveDraft(false);showToast('success','위험 표현을 안전하게 정리했습니다.');}
function openAtlasPartialModal(){if(!APP.ebook){showToast('error','전자책을 먼저 생성해주세요.');return;}var opts=(APP.ebook.chapters||[]).map(function(c,i){return '<option value="chapter:'+i+'">'+(i+1)+'장 · '+x(c.title||'챕터')+'</option>';}).join('');var bg=document.createElement('div');bg.className='atlas-modal-bg';bg.id='atlas-partial-modal';bg.innerHTML='<div class="atlas-modal"><h3>필요한 부분만 다시 만들기</h3><p>완성된 전자책은 유지하고 선택한 부분만 다시 생성합니다. 처음부터 15분을 다시 기다릴 필요가 없습니다.</p><div class="atlas-form-row"><label>수정할 부분</label><select id="atlas-partial-type"><option value="sales">판매자료·후킹·FAQ</option><option value="intro">서론</option><option value="conclusion">결론</option><option value="appendices">부록 전체</option>'+opts+'</select></div><div class="atlas-form-row"><label>수정 방향</label><textarea id="atlas-partial-direction" placeholder="예: 초보자가 이해하기 쉽게, 사례를 더 구체적으로, 과장 없이 후킹 강화"></textarea></div><div class="atlas-modal-actions"><button class="aft-btn" onclick="document.getElementById(\'atlas-partial-modal\').remove()">취소</button><button class="aft-btn primary" id="atlas-partial-run" onclick="runAtlasPartialRegeneration()">선택 부분 다시 생성</button></div></div>';document.body.appendChild(bg);}
/* Atlas V3 Phase 1 — 부분 재생성 전면 개편.
   이전에는 이 함수가 전체 생성(js/incremental-ebook-engine.js)과 완전히 분리된
   스키마 문자열/시스템 프롬프트/파서를 손으로 따로 갖고 있어 "부분 재생성이
   전체 생성과 같은 스키마·품질 규칙·용어·톤·편집 구조를 쓴다"는 요구를
   충족하지 못했다(실제 파이프라인 점검에서 확인: 챕터/판매 스키마가 각각
   두 곳에 중복돼 있었고, system 프롬프트가 훨씬 짧아 ATLAS_SYSTEM_PROMPT의
   정책/문체 규칙이 전혀 적용되지 않았으며, 챕터 하나만 다시 만들 때 다른
   챕터 내용을 전혀 참고하지 못해 중복 위험이 있었고, JSON 파싱도 강건화
   되지 않았으며, 부록 전체 재생성은 max_tokens 5000으로 전체 생성(16000)과
   달라 잘릴 위험이 있었다). 이제 AtlasIncrementalEbookEngine이 노출한 공유
   규칙·스키마 함수·강건한 파서를 그대로 재사용한다 — 스키마는 항상 하나의
   소스에서만 나온다. */
async function runAtlasPartialRegeneration(){
 var type=document.getElementById('atlas-partial-type').value,dir=document.getElementById('atlas-partial-direction').value.trim(),btn=document.getElementById('atlas-partial-run');
 var gw=atlasGatewayStatus();
 if(gw.checked&&!gw.reachable){showToast('error','AI 서버가 실행되지 않았습니다.');return;}
 if(gw.checked&&gw.reachable&&!gw.configured){showToast('error','서버에 API 키가 설정되지 않았습니다.');return;}
 btn.disabled=true;btn.textContent='생성 중...';
 var E=window.AtlasIncrementalEbookEngine;
 var isChapter=type.indexOf('chapter:')===0;
 var isAppendices=type==='appendices';
 var openChar=isAppendices?'[':'{', closeChar=isAppendices?']':'}';
 var target='',schema='',otherChaptersBlock='';
 if(type==='sales'){
   target=JSON.stringify(APP.ebook.sales||{});
   schema='sales 객체만 반환: '+E.salesSchemaString();
 }else if(isChapter){
   var idx=Number(type.split(':')[1]);
   var thisChapter=APP.ebook.chapters[idx]||{};
   target=JSON.stringify(thisChapter);
   /* 전체 생성과 동일하게 "다른 챕터 목록"을 참고 정보로 함께 전달한다 —
      이전에는 이 정보가 전혀 전달되지 않아 재생성된 챕터가 이미 다른
      챕터가 다룬 내용을 다시 다루는 중복 위험이 있었다. */
   otherChaptersBlock='\n\n[다른 챕터 목록 — 내용 중복 방지용 참고]\n'+(APP.ebook.chapters||[]).map(function(c,i){
     return i===idx ? null : (i+1)+'장: '+(c.title||'')+' — '+(c.summary||String(c.content||'').slice(0,80));
   }).filter(Boolean).join('\n');
   schema='챕터 객체만 반환: '+E.chapterSchemaString({number:idx+1,type:thisChapter.type||'챕터'})+' — framework/timeline/comparisonTable은 이 챕터 내용에 실제로 해당할 때만 포함하고, 해당 없으면 키 자체를 생략하세요.';
 }else if(isAppendices){
   target=JSON.stringify(APP.ebook.appendices||[]);
   schema='부록 배열만 반환: [{"title":"","content":""}]';
 }else{
   target=JSON.stringify(APP.ebook[type]||'');
   schema='문자열 값 하나를 {"content":"..."} 형태로 반환';
 }
 var prompt=E.ebookBlueprintGuidelines()+'당신은 한국어 전자책 전문 편집자입니다. 전체 전자책의 제목과 방향은 유지하고 선택한 부분만 고쳐 쓰세요.\n'
   +'수정 방향: '+(dir||'가독성과 실전성을 높이고 후킹을 강화')+'\n\n'
   +'[전자책 정보]\n'+JSON.stringify({title:APP.ebook.title,subtitle:APP.ebook.subtitle,description:APP.ebook.description,targetReader:APP.ebook.targetReader})+'\n\n'
   +'[현재 선택 부분 — 이 내용을 위 수정 방향에 맞게 다시 씁니다]\n'+target
   +otherChaptersBlock+'\n\n'
   +E.FACTUALITY_RULES+'\n\n'+E.SALES_COPY_RULES+'\n\n'+E.WRITING_STYLE_RULES+'\n\n'+E.PRACTICALITY_RULES+'\n\n'+E.SOURCE_GROUNDING_RULES+'\n\n'+E.KOREAN_LOCALIZATION_RULES+'\n\n'
   +'아래 스키마를 정확히 따르세요.\n'+schema+'\n유효한 JSON만 반환하세요.';
 try{
   var data=await window.AtlasAnthropicGateway.generate({model:'claude-sonnet-4-6',max_tokens:isChapter?9000:(isAppendices?16000:5000),system:ATLAS_SYSTEM_PROMPT,callType:isChapter?'chapter':(isAppendices?'appendices':'partial'),messages:[{role:'user',content:[{type:'text',text:prompt}]}]});
   var raw=(data.content||[]).filter(function(z){return z.type==='text';}).map(function(z){return z.text;}).join('');
   var obj=E.robustJsonParse(raw,openChar,closeChar,'partial-'+type);
   if(type==='sales')APP.ebook.sales=obj;
   else if(isChapter)APP.ebook.chapters[Number(type.split(':')[1])]=obj;
   else if(isAppendices)APP.ebook.appendices=obj;
   else APP.ebook[type]=obj.content||'';
   APP.ebook=sanitizeKmongSalesClaims(APP.ebook);renderCvEbook(APP.ebook);renderAtlasQuality();atlasSaveDraft(false);
   var m=document.getElementById('atlas-partial-modal');if(m)m.remove();
   showToast('success','선택한 부분만 새로 만들었습니다.');
 }catch(e){
   showToast('error',e.gatewayUnreachable?'AI 서버가 실행되지 않았습니다.':'부분 수정 실패: '+e.message,5000);
 }finally{
   btn.disabled=false;btn.textContent='선택 부분 다시 생성';
 }
}
// Hook existing renders without changing core code
(function(){var oldRender=window.renderCvEbook;window.renderCvEbook=function(e){oldRender(e);setTimeout(renderAtlasQuality,0);};})();
