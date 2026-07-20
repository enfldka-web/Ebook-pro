function pad(n){return String(n||0).padStart(2,'0');}

function renderText(s){
  if(!s)return '';
  s=cleanText(s);
  return s.split('\n').filter(function(l){return l.trim();})
    .map(function(l){return '<p>'+x(l)+'</p>';}).join('');
}
function copyPrompt(id,btn){
  var el=document.getElementById('prompt-'+id);
  if(!el)return;
  navigator.clipboard.writeText(el.textContent||'').then(function(){
    var orig=btn?btn.textContent:'';
    if(btn){btn.textContent='✅ 복사됨';setTimeout(function(){btn.textContent=orig;},1500);}
  }).catch(function(){showToast('error','복사 실패');});
}

function x(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cleanText(s){return String(s||'').replace(/\*\*/g,'').replace(/#{1,6}\s/g,'').replace(/\n{3,}/g,'\n\n');}


var COVER_THEMES=[
  {bg:'linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#052e16 0%,#166534 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#1a0a0a 0%,#7f1d1d 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#0f172a 0%,#075985 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#1c1008 0%,#3d3000 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#1a0616 0%,#6b21a8 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'},
  {bg:'linear-gradient(135deg,#0f172a 0%,#334155 100%)',catBg:'rgba(255,255,255,.1)',catBorder:'rgba(255,255,255,.2)',divBg:'rgba(255,255,255,.3)'}
];
function getRandomTheme(arr){return arr[Math.floor(Math.random()*arr.length)];}

function showToast(type,msg,dur){
  var t=document.getElementById('toast');
  if(!t){
    t=document.createElement('div');t.id='toast';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);padding:12px 22px;border-radius:12px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:all 0.3s;pointer-events:none;max-width:380px;text-align:center;white-space:nowrap';
    document.body.appendChild(t);
  }
  var colors={success:'rgba(16,185,129,.95)',error:'rgba(239,68,68,.95)',info:'rgba(99,102,241,.95)'};
  t.style.background=colors[type]||colors.info;
  t.style.color='#fff';
  t.textContent=msg||'';
  t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._to);
  t._to=setTimeout(function(){t.style.opacity='0';t.style.transform='translateX(-50%) translateY(10px)';},dur||3000);
}


function renderCvEbook(e){
  var c=e.copyright||{},h='';
  // 랜덤 표지 테마
  var th=getRandomTheme(COVER_THEMES);
  // 표지
  h+='<div class="pg cvr" style="background:'+th.bg+'">';
  h+='<div class="ccirc" style="width:560px;height:560px;top:-180px;right:-180px"></div>';
  h+='<div class="ccirc" style="width:380px;height:380px;bottom:-140px;left:-140px"></div>';
  h+='<div class="ccat" style="background:'+th.catBg+';border:1px solid '+th.catBorder+';color:'+th.accentLight+'">📚 '+x(e.category)+'</div>';
  h+='<div class="ctit">'+x(e.title)+'</div>';
  h+='<div class="csub">'+x(e.subtitle)+'</div>';
  h+='<div class="cdiv" style="background:'+th.divBg+'"></div>';
  h+='<div class="caut">지은이 <strong>'+x(e.author)+'</strong></div>';
  h+='<div class="cyr">'+x(c.year||'2025')+'</div></div>';
  // 저작권
  h+='<div class="pg cpg"><div class="cinn"><div class="clbl">저작권 및 법적 고지</div><div class="ctxt">';
  h+='<p><strong>제목:</strong> '+x(e.title)+'</p>';
  h+='<p><strong>저자:</strong> '+x(e.author)+'</p>';
  h+='<p><strong>출판:</strong> '+x(c.publisher||'독립 출판')+' · '+x(c.year||'2025')+'</p><br>';
  h+='<p>'+x(c.notice)+'</p><br><p><strong>면책 조항:</strong> '+x(c.disclaimer)+'</p>';
  h+='<br><p><strong>연락처:</strong> '+x(c.contact)+'</p>';
  h+='<br><p>이 전자책은 저작권법의 보호를 받습니다. PLR 원본을 한국 시장에 맞게 재창작하였습니다.</p>';
  h+='</div></div></div>';
  // 저자 서문
  if(e.preface){
    h+='<div class="pg inn"><div class="ey">PREFACE</div><div class="sh">저자 서문</div>';
    h+='<div class="chb">'+x(cleanText(e.preface))+'</div></div>';
  }
  // 저자 소개
  var bio=e.authorBio||e.author_bio||e.bio||'(저자 소개 정보가 없습니다)';
  h+='<div class="pg apg"><div class="ah">저자 소개</div>';
  h+='<div class="ac"><div class="aa">✍️</div><div style="flex:1">';
  h+='<div class="an">'+x(e.author)+'</div>';
  h+='<div class="ar">'+x((e.category||'').toUpperCase())+' AUTHOR</div>';
  h+='<div class="ab">'+renderText(bio)+'</div>';
  h+='</div></div></div>';
  // 목차
  var chs=e.chapters||[];
  h+='<div class="pg inn"><div class="ey">CONTENTS</div><div class="sh">목차</div>';
  for(var i=0;i<chs.length;i++){
    h+='<div class="ti" style="padding:14px 0;border-bottom:1px solid #f1f5f9">';
    h+='<span class="tn" style="font-size:12px;min-width:50px;color:#6366f1;font-weight:700">CH.'+pad(chs[i].number)+'</span>';
    h+='<span class="tt" style="font-size:15px;color:#1a1a2e;font-weight:500">'+x(chs[i].title)+'</span>';
    h+='</div>';
  }
  h+='<div class="ti" style="padding:14px 0;border-bottom:1px solid #f1f5f9"><span class="tn" style="min-width:50px;color:#6366f1">✦</span><span class="tt" style="font-size:15px;color:#1a1a2e">결론</span></div>';
  h+='<div class="ti" style="padding:14px 0"><span class="tn" style="min-width:50px;color:#6366f1">✦</span><span class="tt" style="font-size:15px;color:#1a1a2e">부록</span></div>';
  h+='</div>';
  // 서론
  if(e.intro){
    h+='<div class="pg inn"><div class="ey">INTRODUCTION</div><div class="sh">서론</div>';
    h+='<div class="chb">'+renderText(e.intro)+'</div>';
    if(e.targetReader){h+='<div class="kpb" style="margin-top:0"><h4>📌 이 책이 필요한 독자</h4><p style="font-size:13px;color:#334155;line-height:1.9">'+x(e.targetReader)+'</p></div>';}
    h+='</div>';
  }
  // 챕터
  for(var i=0;i<chs.length;i++){
    var ch=chs[i];
    h+='<div class="pg inn">';
    h+='<div class="cb"><span class="cp">CHAPTER '+pad(ch.number)+'</span><span class="cl">본문</span></div>';
    h+='<div class="cht">'+x(ch.title)+'</div>';
    h+='<div class="chb" style="line-height:2.1">'+renderText(ch.content)+'</div>';
    if(ch.actionBox&&ch.actionBox.length){h+='<div class="kpb" style="border-color:#ef4444;background:linear-gradient(135deg,#fff5f5,#fef2f2)"><h4 style="color:#dc2626">🔥 지금 바로 실행</h4>'+(Array.isArray(ch.actionBox)?ch.actionBox:[ch.actionBox]).map(function(a,ai){return '<div class="kpi" style="margin-bottom:10px"><div class="kpd" style="background:#dc2626"></div><span style="font-weight:600">'+(ai+1)+'. '+x(a)+'</span></div>';}).join('')+'</div>';}
    if(ch.copyBox&&ch.copyBox.length){
      h+='<div class="prompt-box">';
      h+='<div class="prompt-box-header"><div class="prompt-box-title">✔ 그대로 복사해서 쓰세요</div></div>';
      var boxes=Array.isArray(ch.copyBox)?ch.copyBox:[{label:'프롬프트 템플릿',prompt:ch.copyBox}];
      boxes.forEach(function(item,idx){
        var pid='prompt-'+Math.random().toString(36).substr(2,6);
        var txt=typeof item==='string'?item:(item.prompt||item.template||item.text||'');
        var lbl=typeof item==='string'?'프롬프트 '+(idx+1):(item.label||item.title||'프롬프트 '+(idx+1));
        h+='<div class="prompt-item">';
        h+='<div class="prompt-label">'+(idx+1)+'. '+x(lbl)+'</div>';
        h+='<div class="prompt-text" id="'+pid+'">'+x(txt)+'</div>';
        h+='<button class="prompt-copy-btn" onclick="copyPrompt(\''+pid+'\',this)">복사</button>';
        h+='</div>';
      });
      h+='</div>';
    }
    if(ch.warningBox&&ch.warningBox.length){h+='<div class="acb" style="background:#fffbeb;border-color:#fde68a"><h4 style="color:#d97706">⚠ 초보자 주의사항</h4>'+ch.warningBox.map(function(w,wi){return '<div class="aci" style="margin-bottom:9px"><span style="font-weight:700;color:#d97706">'+(wi+1)+'.</span>'+x(w)+'</div>';}).join('')+'</div>';}
    if(ch.keyPoints&&ch.keyPoints.length){h+='<div class="kpb"><h4>💡 핵심 포인트</h4>'+ch.keyPoints.map(function(kp,ki){return '<div class="kpi" style="margin-bottom:10px"><div class="kpd"></div><span>'+(ki+1)+'. '+x(kp)+'</span></div>';}).join('')+'</div>';}
    if(ch.actionItems&&ch.actionItems.length){h+='<div class="acb"><h4>✅ 즉시 실천 체크리스트</h4>'+ch.actionItems.map(function(a,ai){return '<div class="aci" style="margin-bottom:8px"><span style="font-weight:700;min-width:20px">'+(ai+1)+'.</span>'+x(a)+'</div>';}).join('')+'</div>';}
    h+='</div>';
  }
  // 결론
  h+='<div class="pg inn" style="background:#fafaf9"><div class="ey">CONCLUSION</div><div class="sh">결론</div>';
  var conclusionHtml=e.conclusion&&e.conclusion.length>10&&e.conclusion.charAt(0)!=='['?renderText(e.conclusion):'<p>이 전자책을 통해 다양한 전략과 방법을 살펴봤습니다. 꾸준히 실천하며 성장해 나가시길 진심으로 응원합니다. 작은 것부터 하나씩 시작하면 반드시 변화가 찾아올 것입니다.</p>';
  h+='<div class="chb" style="line-height:2.1">'+conclusionHtml+'</div>';
  h+='<div class="concl" style="margin-top:32px"><p>이 책을 완독한 당신은 이미 99%를 앞서 있습니다</p><small>지금 바로 첫 번째 실천을 시작하세요</small></div></div>';
  // 부록
  if(e.appendices&&e.appendices.length){
    for(var i=0;i<e.appendices.length;i++){
      h+='<div class="pg inn"><div class="ey">APPENDIX '+(i+1)+'</div><div class="sh">'+x(e.appendices[i].title)+'</div>';
      h+='<div class="chb" style="line-height:2.1">'+x(cleanText(e.appendices[i].content||''))+'</div></div>';
    }
  }
  // 뒷표지
  h+='<div class="pg bkpg"><div style="font-size:36px">📘</div><h3>'+x(e.title)+'</h3>';
  h+='<p>이 전자책이 도움이 되셨다면 주변에 공유해주세요.</p>';
  h+='<p style="font-size:12px;color:rgba(255,255,255,.22)">'+x(c.contact||'')+'</p>';
  h+='<div class="bkc">ⓒ '+x(c.year||'2025')+' '+x(e.author)+' · '+x(c.publisher||'독립 출판')+' · ALL RIGHTS RESERVED</div></div>';
  document.getElementById('cv-edoc').innerHTML=h;
}


/* ── ATLAS v0.2 · KMONG THUMBNAIL ENGINE ── */
var KMONG_THUMBNAIL_SPEC={width:652,height:488,ratio:'4:3',safeArea:50,format:'PNG'};

function kmongSafeText(value){
  var v=String(value||'');
  var rules=[
    [/100\s*%/gi,'높은 완성도'],
    [/무조건|반드시\s*성공|확실한\s*수익|수익\s*보장|매출\s*보장|자동\s*수익|평생\s*수익/gi,'체계적인 실행'],
    [/누구나\s*(?:쉽게|가능|성공)?/gi,'초보자도 단계적으로'],
    [/(?:월|한\s*달|하루|일주일|주간|연간)\s*\d[\d,]*(?:\.\d+)?\s*(?:만|억|천)?\s*원(?:\s*(?:벌기|버는|수익|매출|달성|만들기))?/gi,'실전 수익화'],
    [/\d[\d,]*(?:\.\d+)?\s*(?:만|억|천)?\s*원\s*(?:수익|매출|달성|벌기|버는)/gi,'수익화 성과'],
    [/\d+(?:\.\d+)?\s*%\s*(?:증가|상승|개선|수익|매출)/gi,'의미 있는 개선']
  ];
  rules.forEach(function(r){v=v.replace(r[0],r[1]);});
  return v.replace(/\s{2,}/g,' ').trim();
}

function kmongThumbCopy(e){
  var s=e.sales||{};
  var title=kmongSafeText(s.hook||e.title||'AI 전자책 실전 가이드');
  var subtitle=kmongSafeText(s.subhook||e.subtitle||'처음부터 판매 준비까지 한 번에');
  var category=kmongSafeText(e.category||'DIGITAL EBOOK');
  if(title.length>34)title=title.substring(0,34).trim();
  if(subtitle.length>48)subtitle=subtitle.substring(0,48).trim();
  return {title:title,subtitle:subtitle,category:category};
}

function renderKmongThumbnails(e){
  var host=document.getElementById('cv-thumb-body');
  if(!host||!e)return;
  var c=kmongThumbCopy(e);
  var selected=(typeof window._kmThumbSelected==='number')?window._kmThumbSelected:0;
  var variants=[
    {name:'A · 프리미엄 다크',bg:'linear-gradient(135deg,#0b1020 0%,#152b52 100%)',accent:'#f5c451',text:'#ffffff',muted:'rgba(255,255,255,.72)',icon:'✦',layout:'left'},
    {name:'B · 모던 그라데이션',bg:'linear-gradient(135deg,#4f46e5 0%,#9333ea 55%,#ec4899 100%)',accent:'#ffffff',text:'#ffffff',muted:'rgba(255,255,255,.82)',icon:'AI',layout:'center'},
    {name:'C · 에디토리얼',bg:'linear-gradient(135deg,#f7f5ef 0%,#e8edf7 100%)',accent:'#3157c8',text:'#111827',muted:'#4b5563',icon:'BOOK',layout:'split'},
    {name:'D · 볼드 코랄',bg:'linear-gradient(135deg,#fff4ed 0%,#ffd7c2 100%)',accent:'#e84a1f',text:'#2a130b',muted:'#7c3a24',icon:'→',layout:'bold'}
  ];
  var html='<div style="background:linear-gradient(160deg,#090b16,#11162a);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px;margin-bottom:18px">'
    +'<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px">'
    +'<div><div style="font-size:11px;color:#818cf8;font-weight:800;letter-spacing:1.6px">ATLAS THUMBNAIL ENGINE v0.4</div>'
    +'<div style="font-size:17px;color:#fff;font-weight:900;margin-top:3px">크몽 메인 이미지 4종 미리보기</div>'
    +'<div style="font-size:11px;color:#94a3b8;margin-top:4px">652 × 488px · 4:3 · 안전 여백 50px 적용</div></div>'
    +'<button onclick="downloadSelectedKmongThumbnail(this)" style="padding:9px 16px;border:0;border-radius:100px;background:#6366f1;color:#fff;font-size:12px;font-weight:800;cursor:pointer">⬇ 선택 이미지 저장</button>'
    +'</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">';
  variants.forEach(function(v,i){
    var active=i===selected;
    var visual='';
    if(v.layout==='left'){
      visual='<div style="position:absolute;right:54px;top:70px;width:150px;height:190px;border:1px solid rgba(245,196,81,.42);border-radius:18px;transform:rotate(5deg);background:rgba(255,255,255,.05);box-shadow:0 22px 55px rgba(0,0,0,.28)"><div style="padding:20px;font-size:13px;color:'+v.accent+';font-weight:900">EBOOK</div><div style="margin:5px 20px;height:5px;background:rgba(255,255,255,.45);border-radius:10px"></div><div style="margin:10px 20px;height:4px;background:rgba(255,255,255,.18);border-radius:10px"></div><div style="margin:8px 20px;width:70%;height:4px;background:rgba(255,255,255,.18);border-radius:10px"></div></div>';
    }else if(v.layout==='center'){
      visual='<div style="position:absolute;right:50px;top:70px;width:160px;height:160px;border-radius:40px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:900;color:#fff;box-shadow:0 24px 60px rgba(35,20,90,.35)">'+v.icon+'</div>';
    }else if(v.layout==='split'){
      visual='<div style="position:absolute;right:50px;top:54px;width:190px;height:260px;background:#fff;border-radius:8px;box-shadow:0 22px 55px rgba(28,39,68,.18);transform:rotate(3deg);overflow:hidden"><div style="height:74px;background:'+v.accent+';display:flex;align-items:center;padding:0 18px;color:#fff;font-size:17px;font-weight:900">'+v.icon+'</div><div style="padding:22px"><div style="height:6px;background:#111827;border-radius:4px;margin-bottom:12px"></div><div style="height:5px;background:#cbd5e1;border-radius:4px;margin-bottom:9px"></div><div style="height:5px;width:75%;background:#cbd5e1;border-radius:4px"></div></div></div>';
    }else{
      visual='<div style="position:absolute;right:55px;top:74px;width:160px;height:160px;border-radius:50%;background:'+v.accent+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:68px;font-weight:900;box-shadow:0 22px 48px rgba(232,74,31,.28)">'+v.icon+'</div>';
    }
    html+='<div style="border:2px solid '+(active?'#818cf8':'rgba(255,255,255,.12)')+';border-radius:15px;padding:10px;background:'+(active?'rgba(99,102,241,.12)':'rgba(255,255,255,.03)')+'">'
      +'<div id="km-thumb-'+i+'" data-thumb-index="'+i+'" style="width:652px;height:488px;max-width:100%;aspect-ratio:4/3;position:relative;overflow:hidden;border-radius:10px;background:'+v.bg+';font-family:Pretendard,\'Noto Sans KR\',sans-serif;box-sizing:border-box">'
      +'<div style="position:absolute;inset:50px;border:1px dashed rgba(255,255,255,'+(v.layout==='split'||v.layout==='bold'?'.22':'.25')+');border-radius:8px;pointer-events:none"></div>'
      +'<div style="position:absolute;left:50px;top:48px;font-size:13px;font-weight:900;letter-spacing:1.5px;color:'+v.accent+'">'+x(c.category.toUpperCase())+'</div>'
      +'<div style="position:absolute;left:50px;top:115px;width:350px;z-index:2">'
      +'<div style="font-size:42px;line-height:1.15;font-weight:900;letter-spacing:-1.6px;color:'+v.text+';word-break:keep-all">'+x(c.title)+'</div>'
      +'<div style="font-size:18px;line-height:1.45;font-weight:650;color:'+v.muted+';margin-top:18px;word-break:keep-all">'+x(c.subtitle)+'</div>'
      +'</div>'+visual
      +'<div style="position:absolute;left:50px;bottom:48px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:30px;height:3px;background:'+v.accent+';border-radius:10px"></span><span style="font-size:12px;font-weight:800;color:'+v.muted+'">PRACTICAL DIGITAL GUIDE</span></div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:9px"><span style="font-size:11px;font-weight:800;color:'+(active?'#c7d2fe':'#94a3b8')+'">'+v.name+(active?' · 선택됨':'')+'</span><div style="display:flex;gap:6px"><button onclick="selectKmongThumbnail('+i+')" style="padding:6px 10px;border:1px solid rgba(129,140,248,.45);border-radius:100px;background:'+(active?'#6366f1':'transparent')+';color:#fff;font-size:10px;font-weight:800;cursor:pointer">'+(active?'✓ 선택됨':'선택')+'</button><button onclick="downloadKmongThumbnail('+i+',this)" style="padding:6px 10px;border:0;border-radius:100px;background:rgba(255,255,255,.1);color:#fff;font-size:10px;font-weight:800;cursor:pointer">PNG</button></div></div>'
      +'</div>';
  });
  html+='</div><div style="margin-top:12px;padding:10px 12px;background:rgba(255,255,255,.05);border-radius:10px;color:#94a3b8;font-size:10px;line-height:1.65">※ 점선은 안전 영역 안내이며 저장 이미지에서는 자동으로 제거됩니다. 구체적인 수익 금액·보장성 표현은 자동 정리됩니다.</div></div>';
  host.innerHTML=html;
}

function selectKmongThumbnail(index){
  window._kmThumbSelected=index;
  if(APP.ebook)renderKmongThumbnails(APP.ebook);
  showToast('success','대표 썸네일 '+String.fromCharCode(65+index)+'안을 선택했습니다.');
}

function downloadKmongThumbnail(index,btn){
  if(typeof html2canvas==='undefined'){showToast('error','이미지 저장 기능을 불러오는 중입니다.');return;}
  var el=document.getElementById('km-thumb-'+index);
  if(!el){showToast('error','썸네일을 먼저 생성해주세요.');return;}
  var safe=el.querySelector('div[style*="dashed"]');
  var oldDisplay=safe?safe.style.display:'';
  if(safe)safe.style.display='none';
  if(btn){btn.disabled=true;btn.textContent='저장 중';}
  html2canvas(el,{width:652,height:488,scale:2,useCORS:true,allowTaint:true,backgroundColor:null}).then(function(canvas){
    var a=document.createElement('a');
    a.download='kmong-thumbnail-'+String.fromCharCode(65+index)+'-652x488.png';
    a.href=canvas.toDataURL('image/png');a.click();
    showToast('success','크몽 썸네일을 저장했습니다.');
  }).catch(function(err){showToast('error','썸네일 저장 실패: '+err.message);}).finally(function(){
    if(safe)safe.style.display=oldDisplay;
    if(btn){btn.disabled=false;btn.textContent='PNG';}
  });
}

function downloadSelectedKmongThumbnail(btn){
  var idx=(typeof window._kmThumbSelected==='number')?window._kmThumbSelected:0;
  downloadKmongThumbnail(idx,btn);
}


/* ── ATLAS v0.3 DETAIL PREVIEW ENGINE ── */
window._spSelectedSlides = window._spSelectedSlides || {};

function getSpSelectedNumbers(){
  var keys=Object.keys(window._spSelectedSlides||{}).filter(function(k){return window._spSelectedSlides[k];});
  if(!keys.length){for(var i=1;i<=9;i++)keys.push(String(i));}
  return keys.map(Number).sort(function(a,b){return a-b;});
}

function updateSpSelectionUi(){
  var selected=getSpSelectedNumbers();
  var count=document.getElementById('sp-selected-count');
  if(count)count.textContent=selected.length+'장 선택';
  for(var i=1;i<=9;i++){
    var wrap=document.getElementById('sp-slide-wrap-'+i);
    var active=!!window._spSelectedSlides[i];
    if(wrap){
      wrap.style.border=active?'2px solid #818cf8':'2px solid transparent';
      wrap.style.background=active?'rgba(99,102,241,.10)':'transparent';
    }
    var btn=document.getElementById('sp-select-btn-'+i);
    if(btn){
      btn.textContent=active?'✓ 선택됨':'선택';
      btn.style.background=active?'#6366f1':'rgba(255,255,255,.10)';
    }
  }
}

function toggleSpSlideSelection(n){
  window._spSelectedSlides[n]=!window._spSelectedSlides[n];
  updateSpSelectionUi();
}

function selectAllSpSlides(){
  window._spSelectedSlides={};
  for(var i=1;i<=9;i++)window._spSelectedSlides[i]=true;
  updateSpSelectionUi();
}

function clearSpSlideSelection(){
  window._spSelectedSlides={};
  updateSpSelectionUi();
}

function setSpPreviewMode(mode){
  var root=document.getElementById('sp-preview-list');
  if(!root)return;
  root.setAttribute('data-preview-mode',mode);
  var wraps=root.querySelectorAll('[id^="sp-slide-wrap-"]');
  wraps.forEach(function(w){
    var card=w.querySelector('.sp-card');
    if(mode==='mobile'){
      w.style.width='390px';w.style.maxWidth='100%';
      if(card){card.style.transform='scale(.68)';card.style.transformOrigin='top center';card.style.marginBottom='-216px';}
    }else if(mode==='grid'){
      w.style.width='min(100%,560px)';
      if(card){card.style.transform='';card.style.marginBottom='';}
    }else{
      w.style.width='min(100%,560px)';
      if(card){card.style.transform='';card.style.marginBottom='';}
    }
  });
  var labels={grid:'전체 카드',mobile:'모바일 미리보기',selected:'선택 카드'};
  if(mode==='selected'){
    var selected=getSpSelectedNumbers();
    wraps.forEach(function(w,idx){w.style.display=selected.indexOf(idx+1)>=0?'flex':'none';});
  }else{
    wraps.forEach(function(w){w.style.display='flex';});
  }
  showToast('info',(labels[mode]||'미리보기')+' 모드로 변경했습니다.');
}

async function downloadSelectedSpSlides(btn){
  var nums=getSpSelectedNumbers();
  if(!nums.length){showToast('error','저장할 상세페이지를 선택해주세요.');return;}
  var orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='⏳ 저장 중';}
  for(var i=0;i<nums.length;i++){
    dlSpSlide(nums[i],null);
    await new Promise(function(r){setTimeout(r,900);});
  }
  if(btn){btn.disabled=false;btn.textContent=orig;}
  showToast('success',nums.length+'장 저장을 요청했습니다.');
}

async function downloadKmongLongPage(btn){
  if(typeof html2canvas==='undefined'){showToast('error','이미지 저장 기능을 불러오는 중입니다.');return;}
  var nums=getSpSelectedNumbers();
  if(!nums.length){showToast('error','연결할 상세페이지를 선택해주세요.');return;}
  var orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='⏳ 긴 이미지 제작 중';}
  try{
    var rendered=[];
    for(var i=0;i<nums.length;i++){
      var el=document.getElementById('sp-card-'+nums[i]);
      if(!el)continue;
      var canvas=await html2canvas(el,{scale:2,useCORS:true,allowTaint:true,backgroundColor:null});
      rendered.push(canvas);
    }
    if(!rendered.length)throw new Error('상세페이지 카드가 없습니다.');
    var targetWidth=860;
    var gap=0;
    var totalHeight=0;
    var heights=rendered.map(function(c){var h=Math.round(c.height*(targetWidth/c.width));totalHeight+=h;return h;});
    totalHeight+=gap*(rendered.length-1);
    var maxCanvasHeight=30000;
    if(totalHeight>maxCanvasHeight)throw new Error('선택한 이미지가 너무 깁니다. 일부 페이지만 선택해주세요.');
    var out=document.createElement('canvas');out.width=targetWidth;out.height=totalHeight;
    var ctx=out.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,out.width,out.height);
    var y=0;
    rendered.forEach(function(c,idx){ctx.drawImage(c,0,y,targetWidth,heights[idx]);y+=heights[idx]+gap;});
    var a=document.createElement('a');
    a.download='kmong-detail-long-860px-'+nums.join('-')+'.png';
    a.href=out.toDataURL('image/png');a.click();
    showToast('success','크몽용 긴 상세페이지 이미지를 저장했습니다.');
  }catch(err){showToast('error','긴 이미지 저장 실패: '+err.message);}
  finally{if(btn){btn.disabled=false;btn.textContent=orig;}}
}

/* ── ATLAS v0.4 KMONG LISTING + COMPLIANCE ENGINE ── */
function atlasPlainText(v){
  return String(v==null?'':v).replace(/<[^>]*>/g,' ').replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim();
}

function atlasUnique(arr){
  var seen={};
  return (arr||[]).filter(function(v){
    v=atlasPlainText(v);
    if(!v)return false;
    var k=v.toLowerCase();
    if(seen[k])return false;
    seen[k]=true;return true;
  });
}

function atlasExtractKeywords(e){
  var stop={'방법':1,'가이드':1,'전자책':1,'실전':1,'완성':1,'시작':1,'활용':1,'위한':1,'하는':1,'그리고':1,'에서':1,'으로':1,'까지':1,'대한':1,'입니다':1};
  var source=[e.title,e.subtitle,e.category,e.description]
    .concat((e.chapters||[]).map(function(c){return c.title;})).join(' ');
  var words=source.replace(/[^가-힣a-zA-Z0-9\s]/g,' ').split(/\s+/).filter(function(w){
    return w.length>=2&&!stop[w]&&!/^\d+$/.test(w);
  });
  var freq={};
  words.forEach(function(w){freq[w]=(freq[w]||0)+1;});
  return Object.keys(freq).sort(function(a,b){return freq[b]-freq[a]||b.length-a.length;}).slice(0,8);
}

function buildKmongListing(e){
  e=e||{};var sales=e.sales||{};var chapters=e.chapters||[];var apps=e.appendices||[];
  var safeTitle=kmongSafeText(sales.hook||e.title||'디지털 전자책 실전 가이드');
  var serviceTitle=atlasPlainText(safeTitle);
  if(serviceTitle.length>48)serviceTitle=serviceTitle.substring(0,48).trim();
  var oneLine=atlasPlainText(kmongSafeText(sales.subhook||e.subtitle||e.description||'핵심 내용을 단계별로 정리한 실전 전자책입니다.'));
  if(oneLine.length>90)oneLine=oneLine.substring(0,90).trim();
  var keywords=atlasExtractKeywords(e);
  if(keywords.length<5)keywords=atlasUnique(keywords.concat(['전자책','디지털자료','실전가이드','초보자','체크리스트']));
  var target=atlasPlainText(e.targetReader||'이 주제를 처음 접하거나 실행 순서를 체계적으로 정리하고 싶은 분');
  var solution=atlasPlainText(sales.solution||e.description||'복잡한 정보를 실행 순서에 맞게 정리해 바로 활용할 수 있도록 돕습니다.');
  var learning=atlasUnique((sales.learnings||[]).concat(chapters.slice(0,5).map(function(c){return c.title;}))).slice(0,6);
  var included=[];
  included.push('전자책 본문 '+chapters.length+'개 챕터');
  if(apps.length)included.push('실전 부록 '+apps.length+'종');
  if(chapters.some(function(c){return c.actionItems&&c.actionItems.length;}))included.push('챕터별 실행 체크리스트');
  if(chapters.some(function(c){return c.copyBox&&c.copyBox.length;}))included.push('복사해 활용할 수 있는 프롬프트·템플릿');
  included.push('크몽용 썸네일 및 상세페이지 이미지');
  var faqs=(sales.faqs||[]).slice(0,6).map(function(f){return {q:atlasPlainText(f.q),a:atlasPlainText(f.a)};});
  if(!faqs.length)faqs=[
    {q:'초보자도 활용할 수 있나요?',a:'기초 개념부터 실행 순서까지 단계적으로 구성되어 처음 시작하는 분도 따라갈 수 있습니다.'},
    {q:'어떤 형태로 제공되나요?',a:'전자책 원고와 판매 준비에 활용할 수 있는 이미지 결과물을 확인하고 저장할 수 있습니다.'},
    {q:'구매 전에 무엇을 확인해야 하나요?',a:'목차, 추천 대상, 제공 범위를 확인한 뒤 현재 필요한 내용과 맞는지 검토해 주세요.'}
  ];
  return {
    serviceTitle:serviceTitle,
    oneLine:oneLine,
    category:'전자책·디지털 자료',
    keywords:keywords.slice(0,8),
    target:target,
    solution:solution,
    learning:learning,
    included:included,
    delivery:'전자책 원고 파일과 판매용 이미지 결과물을 확인한 뒤 저장하여 사용할 수 있습니다. 실제 제공 형식과 수정 범위는 판매자가 최종 등록 전에 직접 확인해 주세요.',
    buyerNotice:'구매 전 목차, 추천 대상, 제공 범위를 확인해 주세요. 본 자료는 학습과 실행을 돕기 위한 정보성 콘텐츠이며 특정 결과나 성과를 보장하지 않습니다.',
    faqs:faqs
  };
}

function scanKmongCompliance(e){
  var texts=[];
  function walk(v,path){
    if(typeof v==='string')texts.push({path:path,text:v});
    else if(Array.isArray(v))v.forEach(function(x,i){walk(x,path+'['+i+']');});
    else if(v&&typeof v==='object')Object.keys(v).forEach(function(k){walk(v[k],path?path+'.'+k:k);});
  }
  walk({title:e&&e.title,subtitle:e&&e.subtitle,description:e&&e.description,sales:e&&e.sales},'');
  var rules=[
    {id:'exact-income',label:'구체적인 수익·매출 금액',level:'high',re:/(?:월|한\s*달|하루|일주일|주간|연간)?\s*\d[\d,]*(?:\.\d+)?\s*(?:만|억|천)?\s*원\s*(?:수익|매출|달성|벌기|버는|만들기)?/gi},
    {id:'guarantee',label:'성과 보장·단정 표현',level:'high',re:/100\s*%|무조건|반드시\s*성공|확실한\s*수익|수익\s*보장|매출\s*보장|자동\s*수익|평생\s*수익/gi},
    {id:'unsupported-proof',label:'증빙이 필요한 판매·순위 표현',level:'medium',re:/베스트\s*셀러|판매\s*1위|업계\s*1위|최고\s*수익|검증된\s*수익|수천\s*명|수만\s*명/gi},
    {id:'universal',label:'과도한 일반화 표현',level:'medium',re:/누구나\s*(?:쉽게|가능|성공)?/gi},
    {id:'fake-review',label:'가상 후기 데이터',level:'high',custom:function(){return !!(e&&e.sales&&e.sales.testimonials&&e.sales.testimonials.length);}}
  ];
  var issues=[];
  rules.forEach(function(r){
    if(r.custom){if(r.custom())issues.push({label:r.label,level:r.level,path:'sales.testimonials',match:'후기 '+e.sales.testimonials.length+'건'});return;}
    texts.forEach(function(t){
      var re=new RegExp(r.re.source,r.re.flags);var m;
      while((m=re.exec(t.text))){issues.push({label:r.label,level:r.level,path:t.path,match:m[0]});if(m.index===re.lastIndex)re.lastIndex++;}
    });
  });
  var high=issues.filter(function(i){return i.level==='high';}).length;
  var medium=issues.filter(function(i){return i.level==='medium';}).length;
  var score=Math.max(0,100-high*18-medium*8);
  return {issues:issues,score:score,status:high?'수정 필요':(medium?'확인 권장':'통과')};
}

function atlasCopyText(text,btn){
  navigator.clipboard.writeText(String(text||'')).then(function(){
    var orig=btn?btn.textContent:'';if(btn){btn.textContent='✅ 복사됨';setTimeout(function(){btn.textContent=orig;},1300);}
  }).catch(function(){showToast('error','복사하지 못했습니다.');});
}

function copyKmongListingField(key,btn){
  if(!APP.ebook)return;
  var d=buildKmongListing(APP.ebook),v='';
  if(key==='keywords')v=d.keywords.join(', ');
  else if(key==='learning')v=d.learning.map(function(x){return '• '+x;}).join('\n');
  else if(key==='included')v=d.included.map(function(x){return '• '+x;}).join('\n');
  else if(key==='faqs')v=d.faqs.map(function(f,i){return (i+1)+'. '+f.q+'\n'+f.a;}).join('\n\n');
  else v=d[key]||'';
  atlasCopyText(v,btn);
}

function atlasListingText(d){
  var lines=[];
  lines.push('[서비스 제목]\n'+d.serviceTitle,'','[한 줄 소개]\n'+d.oneLine,'','[추천 카테고리]\n'+d.category,'','[검색 키워드]\n'+d.keywords.join(', '),'','[추천 대상]\n'+d.target,'','[서비스 설명]\n'+d.solution);
  if(d.learning.length)lines.push('','[배울 수 있는 내용]\n- '+d.learning.join('\n- '));
  lines.push('','[제공 내용]\n- '+d.included.join('\n- '),'','[제공 안내]\n'+d.delivery,'','[구매 전 안내]\n'+d.buyerNotice,'','[자주 묻는 질문]');
  d.faqs.forEach(function(f,i){lines.push((i+1)+'. '+f.q+'\n'+f.a);});
  return lines.join('\n');
}

function downloadKmongListing(format){
  if(!APP.ebook){showToast('error','전자책을 먼저 생성해주세요.');return;}
  var d=buildKmongListing(APP.ebook);var content,name,type;
  if(format==='json'){content=JSON.stringify(d,null,2);name='kmong-listing-data.json';type='application/json';}
  else{content=atlasListingText(d);name='kmong-listing-data.txt';type='text/plain';}
  var blob=new Blob([content],{type:type+';charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
  showToast('success','전자책 판매자료를 저장했습니다.');
}

function applyKmongComplianceFix(){
  if(!APP.ebook)return;
  APP.ebook=sanitizeKmongSalesClaims(APP.ebook);
  renderKmongListing(APP.ebook);
  renderKmongThumbnails(APP.ebook);
  showToast('success','위험 표현을 다시 정리했습니다.');
}

function renderKmongListing(e){
  var host=document.getElementById('cv-listing-body');if(!host||!e)return;
  var d=buildKmongListing(e),scan=scanKmongCompliance(e);
  var issueHtml=scan.issues.length?scan.issues.slice(0,8).map(function(it){
    var c=it.level==='high'?'#fca5a5':'#fcd34d';
    return '<div style="padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:11px;line-height:1.55;color:#cbd5e1"><span style="color:'+c+';font-weight:900">'+(it.level==='high'?'높음':'확인')+'</span> · '+x(it.label)+'<br><span style="color:#64748b">'+x(it.path)+' · “'+x(it.match)+'”</span></div>';
  }).join(''):'<div style="padding:14px;border-radius:11px;background:rgba(16,185,129,.10);border:1px solid rgba(16,185,129,.25);color:#6ee7b7;font-size:12px;font-weight:800">✓ 현재 검사 범위에서 위험 표현이 발견되지 않았습니다.</div>';
  function field(label,value,key,multi){
    var safe=x(value||'');
    return '<div style="padding:12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:12px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px"><span style="font-size:10px;color:#818cf8;font-weight:900;letter-spacing:1px">'+label+'</span><button onclick="copyKmongListingField(&quot;'+key+'&quot;,this)" style="padding:5px 9px;border:1px solid rgba(129,140,248,.35);border-radius:100px;background:transparent;color:#c7d2fe;font-size:9px;font-weight:800;cursor:pointer">복사</button></div>'
      +'<div style="font-size:12px;line-height:1.75;color:#e2e8f0;white-space:'+(multi?'pre-wrap':'normal')+';word-break:keep-all">'+safe+'</div></div>';
  }
  var faqText=d.faqs.map(function(f,i){return (i+1)+'. '+f.q+'\n'+f.a;}).join('\n\n');
  var learnText=d.learning.map(function(v){return '• '+v;}).join('\n');
  var includeText=d.included.map(function(v){return '• '+v;}).join('\n');
  host.innerHTML='<div style="background:linear-gradient(160deg,#090b16,#11162a);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:18px;margin-bottom:18px">'
    +'<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px"><div><div style="font-size:11px;color:#818cf8;font-weight:800;letter-spacing:1.6px">ATLAS EBOOK SALES KIT</div><div style="font-size:17px;color:#fff;font-weight:900;margin-top:3px">전자책 판매자료 자동 정리</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">등록 전 직접 검토하고 필요한 부분만 수정해 사용하세요.</div></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button onclick="atlasCopyText(atlasListingText(buildKmongListing(APP.ebook)),this)" style="padding:8px 13px;border:0;border-radius:100px;background:#6366f1;color:#fff;font-size:10px;font-weight:800;cursor:pointer">전체 복사</button><button onclick="downloadKmongListing(&quot;txt&quot;)" style="padding:8px 13px;border:1px solid rgba(255,255,255,.16);border-radius:100px;background:rgba(255,255,255,.06);color:#fff;font-size:10px;font-weight:800;cursor:pointer">TXT</button><button onclick="downloadKmongListing(&quot;json&quot;)" style="padding:8px 13px;border:1px solid rgba(255,255,255,.16);border-radius:100px;background:rgba(255,255,255,.06);color:#fff;font-size:10px;font-weight:800;cursor:pointer">JSON</button></div></div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">'
    +field('서비스 제목',d.serviceTitle,'serviceTitle',false)+field('한 줄 소개',d.oneLine,'oneLine',false)+field('추천 카테고리',d.category,'category',false)+field('검색 키워드',d.keywords.join(', '),'keywords',false)+field('추천 대상',d.target,'target',true)+field('서비스 설명',d.solution,'solution',true)+field('배울 수 있는 내용',learnText,'learning',true)+field('제공 내용',includeText,'included',true)+field('제공 안내',d.delivery,'delivery',true)+field('구매 전 안내',d.buyerNotice,'buyerNotice',true)+field('FAQ',faqText,'faqs',true)
    +'</div>'
    +'<div style="margin-top:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09)"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:9px;margin-bottom:10px"><div><span style="font-size:11px;color:#94a3b8;font-weight:800">크몽 표현 위험도</span><span style="margin-left:8px;font-size:20px;color:'+(scan.score>=90?'#6ee7b7':scan.score>=70?'#fcd34d':'#fca5a5')+';font-weight:900">'+scan.score+'점</span><span style="margin-left:6px;font-size:10px;color:#64748b">'+scan.status+'</span></div><button onclick="applyKmongComplianceFix()" style="padding:7px 12px;border:1px solid rgba(251,191,36,.30);border-radius:100px;background:rgba(251,191,36,.08);color:#fcd34d;font-size:10px;font-weight:800;cursor:pointer">위험 표현 다시 정리</button></div><div style="display:grid;gap:7px">'+issueHtml+'</div><div style="font-size:9px;color:#64748b;line-height:1.6;margin-top:9px">※ 자동 검사는 등록 승인을 보장하지 않습니다. 플랫폼 정책과 실제 서비스 내용은 등록 직전에 반드시 직접 확인하세요.</div></div>'
    +'</div>';
}


/* ── RENDER SALES ── */

function renderCvSalesPage(e,_themeOverride){
  var s=e.sales||{}, chs=e.chapters||[];

  var title    = x(e.title||'');
  var author   = x(e.author||'저자');
  var category = x(e.category||'EBOOK');
  var hook     = x(s.hook||title);
  var subhook  = x(s.subhook||e.subtitle||e.description||'');
  var solution = x(s.solution||e.description||'');
  var finalPush= x(s.finalPush||e.conclusion||'지금 바로 시작하세요');
  var target   = x(e.targetReader||'');

  var pains=(s.pains&&s.pains.length)?s.pains:[
    {icon:'😩',title:'막막한 시작',desc:'어디서 시작할지 모릅니다'},
    {icon:'😤',title:'정보 과부하',desc:'무엇이 맞는지 알 수 없습니다'},
    {icon:'😞',title:'결과가 없다',desc:'열심히 해도 변화가 없습니다'}
  ];
  var learnings=(s.learnings&&s.learnings.length)?s.learnings
    :chs.map(function(c2){return c2.title;}).filter(Boolean);
  var after=(s.after&&s.after.length)?s.after:['명확한 방향','즉시 적용','실질적 변화'];
  var before=(s.before&&s.before.length)?s.before:['방향 없이 반복','무엇부터 할지 모름','결과가 안 보임'];
  var faqs=(s.faqs&&s.faqs.length)?s.faqs:[
    {q:'초보자도 가능한가요?',a:'기초부터 단계별로 설명하여 처음 시작하는 분도 쉽게 따라할 수 있습니다.'},
    {q:'바로 실전 적용 가능한가요?',a:'챕터마다 체크리스트가 있습니다.'},
    {q:'얼마나 걸려 읽나요?',a:'2~3시간에 완독 가능합니다.'},
    {q:'파일 형식은 무엇인가요?',a:'Word(.docx) 파일로 제공됩니다.'}
  ];

  // ── 5가지 컬러 테마 ──
  var THEMES = [
    // 0: 네이비 골드
    {
      name:'📘 네이비 골드',
      card1bg:'#0d1b2a', card2bg:'#0a1520', card3bg:'linear-gradient(160deg,#0d1b2a 0%,#1a2f45 50%,#0f3060 100%)',
      card4bg:'#f8f9fc', card5bg:'#0a1520', card6bg:'#f8f9fc',
      card7bg:'#0d1b2a', card8bg:'#f8f9fc', card9bg:'linear-gradient(160deg,#050d18 0%,#0d1b2a 50%,#1a3060 100%)',
      B:'#D4A843', B2:'#F0C84A', B3:'#a07820',
      BL:'#e8f0f8', BL2:'#c8d8e8',
      DK:'#0d1b2a', DK2:'#1a2f45', DK3:'#0f3060',
      W:'#ffffff', GR:'#8a9ab5', GR2:'#6a7a95',
      ACC:'#D4A843', ACC2:'#F0C84A', ACC3:'#ffd166', ACC4:'#fff3cc',
      dark1:true, dark2:true, dark3:true, dark4:false, dark5:true,
      dark6:false, dark7:true, dark8:false, dark9:true,
      p1:'#D4A843', p2:'#F0C84A', p3:'#ffd166', p4:'#ffecaa',
      style:'navy'
    },
    // 1: 차콜 민트
    {
      name:'🌿 차콜 민트',
      card1bg:'#111417', card2bg:'#0d1012', card3bg:'linear-gradient(160deg,#111417 0%,#1a2e2b 50%,#0d2420 100%)',
      card4bg:'#f5faf9', card5bg:'#0d1012', card6bg:'#f5faf9',
      card7bg:'#111417', card8bg:'#f5faf9', card9bg:'linear-gradient(160deg,#080a0c 0%,#111417 50%,#0d2420 100%)',
      B:'#2DD4BF', B2:'#5EE8D8', B3:'#0fa396',
      BL:'#e0f8f5', BL2:'#b3ede6',
      DK:'#111417', DK2:'#1a2420', DK3:'#0d2420',
      W:'#f5faf9', GR:'#7aa09c', GR2:'#5a8080',
      ACC:'#2DD4BF', ACC2:'#5EE8D8', ACC3:'#a3f0e8', ACC4:'#d0f8f3',
      dark1:true, dark2:true, dark3:true, dark4:false, dark5:true,
      dark6:false, dark7:true, dark8:false, dark9:true,
      p1:'#2DD4BF', p2:'#5EE8D8', p3:'#a3f0e8', p4:'#d0f8f3',
      style:'mint'
    },
    // 2: 크림 바이올렛
    {
      name:'💜 크림 바이올렛',
      card1bg:'#faf9f7', card2bg:'#f5f3ff', card3bg:'linear-gradient(160deg,#ede9fe 0%,#ddd6fe 50%,#c4b5fd 100%)',
      card4bg:'#faf9f7', card5bg:'#7C3AED', card6bg:'#faf9f7',
      card7bg:'#7C3AED', card8bg:'#faf9f7', card9bg:'linear-gradient(160deg,#4c1d95 0%,#6d28d9 50%,#7C3AED 100%)',
      B:'#7C3AED', B2:'#9b59fa', B3:'#5b21b6',
      BL:'#ede9fe', BL2:'#ddd6fe',
      DK:'#1e1633', DK2:'#2d1b69', DK3:'#4c1d95',
      W:'#faf9f7', GR:'#8b7ab5', GR2:'#6b5a9a',
      ACC:'#A78BFA', ACC2:'#C4B5FD', ACC3:'#DDD6FE', ACC4:'#F5F3FF',
      dark1:false, dark2:false, dark3:true, dark4:false, dark5:true,
      dark6:false, dark7:true, dark8:false, dark9:true,
      p1:'#7C3AED', p2:'#9b59fa', p3:'#c4b5fd', p4:'#ede9fe',
      style:'violet'
    },
    // 3: 코랄 에너지
    {
      name:'🔥 코랄 에너지',
      card1bg:'#fff8f5', card2bg:'#120805', card3bg:'linear-gradient(135deg,#120805 0%,#B83010 60%,#E84A1F 100%)',
      card4bg:'#fff8f5', card5bg:'#1f0d08', card6bg:'#fff8f5',
      card7bg:'#E84A1F', card8bg:'#fff8f5', card9bg:'linear-gradient(160deg,#120805 0%,#E84A1F 100%)',
      B:'#E84A1F', B2:'#FF6B35', B3:'#B83010',
      BL:'#fff0e8', BL2:'#ffd8b8',
      DK:'#1a0800', DK2:'#2d1208', DK3:'#3d2010',
      W:'#fff8f5', GR:'#d4845a', GR2:'#a0522d',
      ACC:'#FFB347', ACC2:'#FF6B35', ACC3:'#FF4500', ACC4:'#FFD3B4',
      dark1:false, dark2:true, dark3:true, dark4:false, dark5:true,
      dark6:false, dark7:true, dark8:false, dark9:true,
      p1:'#FFB347', p2:'#FF6B35', p3:'#FF4500', p4:'#E84A1F',
      style:'coral'
    },
    // 4: 골드 럭셔리
    {
      name:'✨ 골드 럭셔리',
      card1bg:'#fffdf0', card2bg:'#0d0b05', card3bg:'linear-gradient(135deg,#0d0b05 0%,#92700A 50%,#D4A843 100%)',
      card4bg:'#fffdf0', card5bg:'#1a1508', card6bg:'#fffdf0',
      card7bg:'#D4A843', card8bg:'#fffdf0', card9bg:'linear-gradient(160deg,#0d0b05 0%,#92700A 100%)',
      B:'#D4A843', B2:'#F0C040', B3:'#92700A',
      BL:'#fdf8e0', BL2:'#f0e8b0',
      DK:'#1a1200', DK2:'#2a1f08', DK3:'#3d3000',
      W:'#fffdf0', GR:'#c9a84c', GR2:'#8a6d1a',
      ACC:'#FFE066', ACC2:'#FFC200', ACC3:'#FF9900', ACC4:'#FFECB3',
      dark1:false, dark2:true, dark3:true, dark4:false, dark5:true,
      dark6:false, dark7:true, dark8:false, dark9:true,
      p1:'#FFE066', p2:'#FFC200', p3:'#FF9900', p4:'#D4A843',
      style:'gold'
    },
    // 5: 파스텔 핑크
    {
      name:'🌸 파스텔 핑크',
      card1bg:'#FFF0F5', card2bg:'#FFF0F5', card3bg:'linear-gradient(160deg,#8A0040 0%,#C2005A 50%,#900040 100%)',
      card4bg:'#FFF0F5', card5bg:'#8A0040', card6bg:'#FFF0F5',
      card7bg:'#8A0040', card8bg:'#FFF0F5', card9bg:'linear-gradient(160deg,#5A0028 0%,#8A0040 100%)',
      B:'#A80050', B2:'#C2005A', B3:'#780038',
      BL:'#FFCCE0', BL2:'#FF99C2',
      DK:'#1A0010', DK2:'#2D0020', DK3:'#0A0008',
      W:'#FFF0F5', GR:'#800040', GR2:'#580030',
      ACC:'#FF1493', ACC2:'#FF69B4', ACC3:'#FFB6D9', ACC4:'#FFE0EE',
      dark1:false, dark2:false, dark3:true, dark4:false, dark5:true,
      dark6:false, dark7:true, dark8:false, dark9:true,
      p1:'#C2005A', p2:'#E0187A', p3:'#FF4DA6', p4:'#A80050',
      style:'pink'
    }
  ];
  var CUR_THEME = (typeof _themeOverride === 'number') ? _themeOverride : 0;
  var T = THEMES[CUR_THEME];
  window._spLastEbook = e;

  var B=T.B, B2=T.B2, B3=T.B3, BL=T.BL, BL2=T.BL2;
  var DK=T.DK, W=T.W, GR=T.GR, GR2=T.GR2;
  var ACC=T.ACC, ACC2=T.ACC2, ACC3=T.ACC3, ACC4=T.ACC4;
  var FF = "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
  // 12가지 폰트 맵
  var FONT_MAP = {
    'noto': "'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif",
    'brush': "'Nanum Brush Script',cursive",
    'poor': "'Poor Story',cursive",
    'melody': "'Hi Melody',cursive",
    'single': "'Single Day',cursive",
    'sunflower': "'Sunflower',sans-serif"
  };
  var STYLE = T.style;
  var CARD_FF = (window._spFontKey && FONT_MAP[window._spFontKey]) ? FONT_MAP[window._spFontKey] : FF;
  // 손글씨 계열 폰트는 글자 폭이 넓어 줄바꿈 시 잘림(...) 발생 → 폰트 크기를 비례 축소
  var HW_FONTS = {'brush':1, 'poor':1, 'melody':1, 'single':1, 'sunflower':1};
  var FONT_SCALE = (window._spFontKey && HW_FONTS[window._spFontKey]) ? 0.8 : 1;
  function fsz(px){ return Math.round(px*FONT_SCALE); }
  // 텍스트 길이에 따라 폰트 크기를 자동 축소 (line-clamp으로 인한 잘림 방지)
  // maxLen: 이 글자수를 넘으면 줄이기 시작, lines: 허용 줄 수(많을수록 여유)
  function autoFitSize(basePx, text, maxLen, lines){
    var len = String(text||'').replace(/<[^>]+>/g,'').length;
    var limit = maxLen || 20;
    var allowedLines = lines || 2;
    var effLimit = limit * allowedLines / 2;
    if(len <= effLimit) return fsz(basePx);
    var ratio = effLimit / len;
    var scaled = basePx * Math.max(ratio, 0.75); // 최소 75%까지만 축소(가독성 유지)
    return fsz(Math.round(scaled));
  }
  var TOTAL = 9;

  function x(s2){ return String(s2||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function hl1(text,color){
    if(!text||text.length<2)return text||'';
    // HTML 태그가 포함된 텍스트는 안전하게 처리 불가 → 그대로 반환 (강조 생략)
    if(/<[^>]+>/.test(text))return text;
    var words=text.split(' ').filter(function(w){return w.length>0;});
    if(words.length===0)return text;
    var josa=['을','를','이','가','은','는','의','에','서','로','으로','와','과','도','만','까지','부터','에서','에게','한테','처럼','보다','이다','입니다','합니다','됩니다'];
    function realLen(w){var r=w;josa.forEach(function(j){if(r.endsWith(j))r=r.slice(0,-j.length);});return r.length;}
    function stripJosa(w){var r=w;josa.forEach(function(j){if(r.endsWith(j))r=r.slice(0,-j.length);});return r;}
    var best=null,bestLen=0;
    words.forEach(function(w){var clean=w.replace(/[^\uac00-\ud7a3a-zA-Z0-9]/g,'');var rl=realLen(clean);if(rl>=2&&!/^[0-9]+$/.test(clean)&&rl>bestLen){bestLen=rl;best=w;}});
    if(!best)best=words[0];
    best=best.replace(/[,，]+$/,'');
    var idx2=text.indexOf(best);
    if(idx2<0)return text;

    // best가 속한 나열 구간(쉼표로 구분된 짧은 병렬 명사 리스트, 예: "크몽, 탈잉, 클래스101")만 전체 강조
    var verbEndRe=/(?:있다|없다|한다|된다|간다|온다|이다|하고|었고|았고|이고|하며|었며|아며|니다|습니다|입니다|네요|어요|아요|해요|고요)$/;
    function isPureNoun(item){
      var t=item.trim();
      if(!t)return false;
      if(t.length>10)return false;
      if(verbEndRe.test(t))return false;
      var core=stripJosa(t.replace(/[^\uac00-\ud7a3a-zA-Z0-9]/g,''));
      return core.length>=1;
    }
    var listRegex=/(?:[\uac00-\ud7a3a-zA-Z0-9]{1,10}\s*,\s*){1,}[\uac00-\ud7a3a-zA-Z0-9]{1,10}(?:[\uac00-\ud7a3]{0,2})?/g;
    var lm, listMatch=null;
    while((lm=listRegex.exec(text))){
      var segStart=lm.index, segEnd=lm.index+lm[0].length;
      if(idx2>=segStart && idx2<segEnd+6){
        var items=lm[0].split(',');
        if(items.length>=2 && items.every(isPureNoun)){
          listMatch=lm;
        }
      }
    }
    if(listMatch){
      var segStart2=listMatch.index, segEnd2=listMatch.index+listMatch[0].length;
      var realEnd=segEnd2;
      if(idx2+best.length>realEnd) realEnd=idx2+best.length;
      return text.substring(0,segStart2)+'<span style="color:'+(color||ACC)+';font-weight:900;font-family:inherit">'+text.substring(segStart2,realEnd)+'</span>'+text.substring(realEnd);
    }

    return text.substring(0,idx2)+'<span style="color:'+(color||ACC)+';font-weight:900;font-family:inherit">'+best+'</span>'+text.substring(idx2+best.length);
  }

  // ── 테마별 스타일 헬퍼 ──
  function isNavy(){ return STYLE==='navy'; }
  function isPink(){ return STYLE==='pink'; }

  // (삭제: sketch/notebook 헬퍼)
  function sketchUnderline(color, w, thick) {
    var c=color||'#E8302A', ww=w||120, t=thick||3;
    return '<svg width="'+ww+'" height="'+(t+6)+'" viewBox="0 0 '+ww+' '+(t+6)+'" style="display:block;margin-top:-2px">'
      +'<path d="M2 '+(t+2)+' Q'+(ww*0.25)+' 2 '+(ww*0.5)+' '+(t+2)+' Q'+(ww*0.75)+' '+(t*2+4)+' '+(ww-2)+' '+(t+2)+'" stroke="'+c+'" stroke-width="'+t+'" fill="none" stroke-linecap="round"/>'
      +'</svg>';
  }
  // 동그라미 SVG (손그림 강조용)
  function sketchCircle(w,h,color){
    var c=color||'#E8302A';
    return '<svg style="position:absolute;top:-6px;left:-8px;pointer-events:none" width="'+(w+16)+'" height="'+(h+12)+'" viewBox="0 0 '+(w+16)+' '+(h+12)+'">'
      +'<ellipse cx="'+(w/2+8)+'" cy="'+(h/2+6)+'" rx="'+(w/2+5)+'" ry="'+(h/2+3)+'" stroke="'+c+'" stroke-width="2.5" fill="none" stroke-dasharray="4 2" stroke-linecap="round"/>'
      +'</svg>';
  }
  // 노트 줄 배경 SVG
  function notebookLines(lineColor){
    var lc=lineColor||'rgba(26,79,216,0.12)';
    var lines='';
    for(var yi=80;yi<680;yi+=28){ lines+='<line x1="0" y1="'+yi+'" x2="540" y2="'+yi+'" stroke="'+lc+'" stroke-width="1"/>'; }
    return '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675" preserveAspectRatio="none">'
      +'<rect x="48" y="0" width="2" height="675" fill="rgba(255,100,100,0.25)"/>'
      +lines+'</svg>';
  }

  // 공통 카드 래퍼
  function card(idx, bg, inner, dark) {
    var borderTop = '<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,'+B+','+B2+');z-index:3"></div>';
    var pct = Math.round((idx+1)/TOTAL*100);
    var pbarBg = dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.08)';
    var pbarFg = dark ? 'rgba(255,255,255,.8)' : B;
    var pbarTxt = dark ? 'rgba(255,255,255,.4)' : GR2;
    var pBar = '<div style="position:absolute;bottom:0;left:0;right:0;padding:8px 20px 12px;display:flex;align-items:center;gap:8px;z-index:2">'
      +'<div style="flex:1;height:2px;background:'+pbarBg+';border-radius:100px;overflow:hidden">'
      +'<div style="height:100%;width:'+pct+'%;background:'+pbarFg+';border-radius:100px"></div></div>'
      +'<span style="font-size:9px;font-weight:600;color:'+pbarTxt+'">'+(idx+1)+'/'+TOTAL+'</span></div>';
    var arrow2 = idx < TOTAL-1
      ? '<div style="position:absolute;right:0;top:0;bottom:0;width:24px;display:flex;align-items:center;justify-content:flex-end;padding-right:5px;z-index:2"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="'+(dark?'rgba(255,255,255,.3)':'rgba(0,0,0,.2)')+'" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg></div>'
      : '';
    return '<div class="sp-card" id="sp-card-'+(idx+1)+'" style="width:540px;height:675px;position:relative;overflow:hidden;box-sizing:border-box;font-family:'+CARD_FF+';background:'+bg+'">'
      + borderTop
      + inner + pBar + arrow2
      + '</div>';
  }

  function logo(dark2) {
    var bc = dark2 ? 'rgba(255,255,255,.15)' : BL;
    var tc = dark2 ? 'rgba(255,255,255,.9)' : B;
    return '<div style="display:flex;align-items:center;gap:7px;flex-shrink:0">'
      +'<div style="width:28px;height:28px;border-radius:7px;background:'+bc+';display:flex;align-items:center;justify-content:center;font-size:13px">📘</div>'
      +'<div style="font-size:9px;font-weight:800;color:'+tc+';letter-spacing:1px;text-transform:uppercase">'+category+'</div>'
      +'</div>';
  }

  function chip(t, solid) {
    return solid
      ? '<span style="display:inline-block;font-size:13px;font-weight:800;color:#fff;background:'+B+';padding:3px 10px;border-radius:100px;letter-spacing:0.5px">'+t+'</span>'
      : '<span style="display:inline-block;font-size:13px;font-weight:800;color:'+B+';background:'+BL+';border:1px solid '+BL2+';padding:3px 10px;border-radius:100px;letter-spacing:0.5px">'+t+'</span>';
  }

  function headingHL(text) {
    return hl1(text, B);
  }

  var slides = '';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 01 히어로
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var slide01Inner = '';
  if (isNavy()) {
    // 네이비 골드 01 - 레퍼런스 스타일
    slide01Inner = '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675">'
      +'<defs>'
      +'<radialGradient id="ng01a" cx="80%" cy="20%" r="60%"><stop offset="0%" stop-color="'+B+'" stop-opacity=".15"/><stop offset="100%" stop-color="transparent"/></radialGradient>'
      +'<radialGradient id="ng01b" cx="10%" cy="80%" r="50%"><stop offset="0%" stop-color="'+B+'" stop-opacity=".08"/><stop offset="100%" stop-color="transparent"/></radialGradient>'
      +'</defs>'
      +'<circle cx="430" cy="135" r="200" fill="url(#ng01a)"/>'
      +'<circle cx="54" cy="540" r="160" fill="url(#ng01b)"/>'
      +'<line x1="0" y1="300" x2="540" y2="300" stroke="'+B+'" stroke-opacity=".06" stroke-width="1"/>'
      +'<path d="M0 430 L540 370" stroke="'+B+'" stroke-opacity=".08" stroke-width="60"/>'
      +'<rect x="380" y="50" width="110" height="145" rx="10" fill="'+B+'" fill-opacity=".07" stroke="'+B+'" stroke-opacity=".2" stroke-width="1"/>'
      +'<rect x="390" y="60" width="90" height="120" rx="8" fill="'+B+'" fill-opacity=".05" stroke="'+B+'" stroke-opacity=".15" stroke-width="1"/>'
      +'<line x1="398" y1="88" x2="472" y2="88" stroke="'+B+'" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>'
      +'<line x1="398" y1="100" x2="465" y2="100" stroke="'+B+'" stroke-opacity=".15" stroke-width="1.5" stroke-linecap="round"/>'
      +'<line x1="398" y1="112" x2="460" y2="112" stroke="'+B+'" stroke-opacity=".12" stroke-width="1.5" stroke-linecap="round"/>'
      +'<circle cx="480" cy="55" r="3" fill="'+B+'" opacity=".6"/>'
      +'<circle cx="55" cy="55" r="2.5" fill="'+B+'" opacity=".5"/>'
      +'<path d="M55 55 L55 48 M55 55 L55 62 M55 55 L48 55 M55 55 L62 55" stroke="'+B+'" stroke-width="1.5" opacity=".6"/>'
      +'</svg>'
      +'<div style="padding:22px 24px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:12px;position:relative;z-index:1">'
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      + logo(true)
      + '<div style="font-size:13px;font-weight:700;color:'+ACC+';letter-spacing:1px">1 / 9</div>'
      + '</div>'
      +'<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px">'
      +'<div style="display:inline-block;background:rgba(212,168,67,.2);border:1px solid rgba(212,168,67,.4);color:'+B+';font-size:13px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:1px;width:fit-content">'+x(category)+'</div>'
      +'<h1 style="font-size:clamp(38px,8vw,50px);font-weight:900;color:#fff;line-height:1.1;word-break:keep-all;letter-spacing:-1px;margin:0">'+hl1(hook,B)+'</h1>'
      +'<p style="font-size:'+autoFitSize(28,subhook,28,2)+'px;font-weight:700;color:rgba(255,255,255,.75);line-height:1.4;word-break:keep-all;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+x(subhook)+'</p>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(212,168,67,.12);border:1px solid rgba(212,168,67,.3);border-radius:12px">'
      +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+B+'" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
      +'<span style="font-size:18px;font-weight:700;color:'+B+'">스와이프하여 확인하기</span>'
      +'</div>'
      +'</div>';
  } else {
    // 코랄/골드 공통 01
    slide01Inner = '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675">'
      +'<defs><radialGradient id="c01a" cx="70%" cy="25%" r="55%"><stop offset="0%" stop-color="'+T.p1+'" stop-opacity=".25"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>'
      +'<circle cx="378" cy="170" r="260" fill="url(#c01a)"/>'
      +'<path d="M400 50 L440 73 L440 119 L400 142 L360 119 L360 73 Z" stroke="'+T.p1+'" stroke-opacity=".18" stroke-width="1.5" fill="none"/>'
      +'<path d="M0 500 Q270 450 540 500" stroke="'+T.p2+'" stroke-opacity=".1" stroke-width="2" fill="none"/>'
      +'<circle cx="460" cy="110" r="45" fill="'+T.p1+'" fill-opacity=".06" stroke="'+T.p1+'" stroke-opacity=".15" stroke-width="1"/>'
      +'<circle cx="80" cy="570" r="35" fill="'+T.p2+'" fill-opacity=".06" stroke="'+T.p2+'" stroke-opacity=".12" stroke-width="1"/>'
      +'<circle cx="58" cy="55" r="2.5" fill="'+T.p1+'" opacity=".7"/>'
      +'<path d="M58 55 L58 48 M58 55 L58 62 M58 55 L51 55 M58 55 L65 55" stroke="'+T.p1+'" stroke-width="1.2" opacity=".7"/>'
      +'</svg>'
      +'<div style="padding:22px 24px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:12px;position:relative;z-index:1">'
      + '<div style="display:flex;align-items:center;justify-content:space-between">'
      + logo(T.dark1)
      + '<div style="font-size:13px;font-weight:700;color:'+B+';letter-spacing:1px">1 / 9</div>'
      + '</div>'
      +'<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px">'
      +chip(category,false)
      +'<h1 style="font-size:clamp(38px,8vw,50px);font-weight:900;color:'+(T.dark1?'#fff':DK)+';line-height:1.1;word-break:keep-all;letter-spacing:-1px;margin:0">'+hl1(hook,B)+'</h1>'
      +'<p style="font-size:'+autoFitSize(28,subhook,28,2)+'px;font-weight:700;color:'+(T.dark1?'rgba(255,255,255,.75)':DK)+';line-height:1.4;word-break:keep-all;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+x(subhook)+'</p>'
      +'</div>'
      +'<div style="display:flex;align-items:center;gap:10px;padding:11px 16px;background:'+BL+';border-radius:11px;border:1px solid '+BL2+'">'
      +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+B+'" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
      +'<span style="font-size:18px;font-weight:700;color:'+B+'">스와이프하여 확인하기</span>'
      +'</div>'
      +'</div>';
  }
  slides += card(0, T.card1bg, slide01Inner, T.dark1);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 02 문제 공감
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var pains5=(function(){
    var DEF=[{icon:'😩',title:'막막한 시작',desc:'어디서 시작할지 모릅니다'},{icon:'😤',title:'정보 과부하',desc:'무엇이 맞는지 알 수 없습니다'},{icon:'😞',title:'결과가 없다',desc:'열심히 해도 변화가 없습니다'},{icon:'💸',title:'투자 대비 성과 없음',desc:'쏟아붓고 있지만 결과가 없습니다'},{icon:'😴',title:'의지는 있지만 지쳐간다',desc:'매일 반복되는 상황에 지쳐갑니다'}];
    var norm=pains.map(function(p,pi){
      if(typeof p==='string')return {icon:DEF[pi%5].icon,title:p,desc:''};
      return {icon:p.icon||DEF[pi%5].icon,title:p.title||p.text||String(p),desc:p.desc||p.description||''};
    });
    // 중복 제거 (전체 title 비교)
    var seen={};
    norm=norm.filter(function(p){
      var k=(p.title||String(p)).replace(/\s/g,'').substring(0,12);
      if(seen[k])return false;seen[k]=true;return true;
    });
    if(norm.length>=3)return norm.slice(0,5);
    var extra=DEF.filter(function(d){
      var k=d.title.replace(/\s/g,'').substring(0,12);
      return !seen[k];
    });
    return norm.concat(extra).slice(0,5);
  })();

  var slide02BgColor = T.card2bg;
  var slide02Inner = '';
  if (isNavy()) {
    slide02Inner = '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675">'
      +'<defs><radialGradient id="ng02" cx="50%" cy="0%" r="70%"><stop offset="0%" stop-color="'+B+'" stop-opacity=".12"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>'
      +'<rect width="540" height="675" fill="url(#ng02)"/>'
      +'<line x1="0" y1="300" x2="540" y2="300" stroke="'+B+'" stroke-opacity=".05" stroke-width="1"/>'
      +'</svg>'
      +'<div style="padding:22px 24px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:12px;position:relative;z-index:1">'
      +logo(true)
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="width:4px;height:24px;background:'+B+';border-radius:2px"></div>'
      +'<span style="font-size:14px;font-weight:800;color:'+B+';letter-spacing:1.5px">직장인 맞춤형 현실 가이드</span>'
      +'</div>'
      +'<h2 style="font-size:42px;font-weight:900;color:#fff;line-height:1.1;word-break:keep-all;margin:0">혹시 <span style="color:'+ACC+'">이런 상황</span><br>아닌가요?</h2>'
      +'<div style="display:flex;flex-direction:column;gap:7px;flex:1;justify-content:center">'
      +pains5.slice(0,4).map(function(p,pi){
        var ptxt = p.title;
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.2);border-radius:10px">'
          +'<span style="font-size:28px;flex-shrink:0">'+x(p.icon||'😩')+'</span>'
          +'<span style="font-size:'+fsz(18)+'px;font-weight:700;color:'+(T.dark2?'rgba(255,255,255,.9)':DK)+';word-break:keep-all;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+x(ptxt)+'</span>'
          +'</div>';
      }).join('')
      +'</div>'
      +'</div>';
  } else {
    slide02Inner = '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675">'
      +'<defs><radialGradient id="c02" cx="50%" cy="0%" r="75%"><stop offset="0%" stop-color="'+T.p1+'" stop-opacity=".2"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>'
      +'<rect width="540" height="675" fill="url(#c02)"/>'
      +'<circle cx="460" cy="90" r="55" fill="'+T.p1+'" fill-opacity=".06" stroke="'+T.p1+'" stroke-opacity=".15" stroke-width="1"/>'
      +'</svg>'
      +'<div style="padding:22px 24px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:12px;position:relative;z-index:1">'
      +logo(true)
      +'<h2 style="font-size:42px;font-weight:900;color:'+(T.dark2?'#fff':DK)+';line-height:1.1;word-break:keep-all;margin:0">혹시 <span style="color:'+ACC3+'">이런 상황</span><br>아닌가요?</h2>'
      +'<div style="display:flex;flex-direction:column;gap:8px;flex:1;justify-content:center">'
      +pains5.slice(0,4).map(function(p){
        var ptxt=p.title+(p.desc?' — '+p.desc:'');
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:'+(T.dark2?'rgba(255,255,255,.07)':BL)+';border:1px solid '+(T.dark2?'rgba(255,255,255,.10)':BL2)+';border-radius:10px">'
          +'<span style="font-size:28px;flex-shrink:0">'+x(p.icon||'😩')+'</span>'
          +'<span style="font-size:'+fsz(18)+'px;font-weight:700;color:'+(T.dark2?'rgba(255,255,255,.9)':DK)+';word-break:keep-all;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+x(ptxt)+'</span>'
          +'</div>';
      }).join('')
      +'</div></div>';
  }
  slides += card(1, T.card2bg, slide02Inner, T.dark2);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 03 해결책
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var slide03Inner = '';

    slide03Inner = '<div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.06)"></div>'
      +'<div style="position:absolute;bottom:-30px;left:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.04)"></div>'
      +'<div style="padding:16px 24px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:8px;position:relative;z-index:1;justify-content:space-between">'
      +logo(true)
      +'<div style="display:inline-flex;align-items:center;gap:6px;width:fit-content">'
      +'<div style="width:5px;height:5px;border-radius:50%;background:'+ACC+'"></div>'
      +'<div style="font-size:13px;font-weight:800;letter-spacing:3px;color:'+ACC+';text-transform:uppercase">SOLUTION</div>'
      +'</div>'
      +'<div style="background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.18);border-radius:16px;padding:10px 14px">'
      +'<h2 style="font-size:clamp(24px,4.5vw,32px);font-weight:900;color:#fff;line-height:1.15;word-break:keep-all;letter-spacing:-0.8px;margin:0 0 8px">'+hl1(title,ACC)+'</h2>'
      +'<p style="font-size:18px;font-weight:600;color:rgba(255,255,255,.85);line-height:1.5;word-break:keep-all;margin:0">'+hl1(solution||'',ACC)+'</p>'
      +'</div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'
      +after.slice(0,3).map(function(a,ai){
        var icons=['🎯','⚡','🚀'];
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.09);border-radius:10px">'
          +'<span style="font-size:24px;flex-shrink:0">'+icons[ai]+'</span>'
          +'<span style="font-size:'+fsz(22)+'px;font-weight:700;color:#fff;word-break:keep-all;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+hl1(x(String(a||'')),ACC2)+'</span>'
          +'</div>';
      }).join('')
      +'</div></div>';
  
  slides += card(2, T.card3bg, slide03Inner, T.dark3);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 04 목차/챕터
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var slide04Inner = '';

    slide04Inner = '<div style="padding:16px 20px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:8px;position:relative;z-index:1">'
      +logo(false)
      +'<div style="display:flex;align-items:center;gap:8px">'+chip('CONTENTS',true)
      +'<h2 style="font-size:22px;font-weight:900;color:'+DK+';margin:0">전체 챕터 구성</h2></div>'
      +'<div style="display:flex;flex-direction:column;gap:0;flex:1;justify-content:space-evenly">'
      +chs.map(function(ch,i){
        return '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:'+(i%2===0?BL+'80':'white')+';border:1px solid '+BL2+';border-radius:9px;border-left:3px solid '+B+'">'
          +'<span style="font-size:13px;font-weight:800;color:white;background:'+B+';padding:2px 7px;border-radius:100px;flex-shrink:0">'+('0'+(i+1)).slice(-2)+'</span>'
          +'<span style="font-size:18px;font-weight:700;color:'+DK+';overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+x(ch.title||'')+'</span>'
          +'</div>';
      }).join('')
      +(e.appendices&&e.appendices[0]
        ?'<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#FFF8E7;border:1px solid #FFD166;border-radius:9px;border-left:3px solid #FFD166">'
          +'<span style="font-size:13px;font-weight:800;color:#0A1628;background:#FFD166;padding:2px 7px;border-radius:100px;flex-shrink:0">부록</span>'
          +'<span style="font-size:18px;font-weight:700;color:'+DK+';overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+x(e.appendices[0].title||'')+'</span>'
          +'</div>':''
      )
      +'</div></div>';
  
  slides += card(3, T.card4bg, slide04Inner, false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 05 핵심 장점 / 왜 이 전자책?
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var slide05Inner = '';

    slide05Inner = '<div style="padding:16px 20px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:10px;position:relative;z-index:1">'
      +logo(true)
      +'<div style="font-size:13px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.45);text-transform:uppercase">KEY BENEFITS</div>'
      +'<h2 style="font-size:28px;font-weight:900;color:'+W+';letter-spacing:-0.5px;margin:0">왜 이 전자책은<br><span style="color:'+ACC2+'">부담 없이 시작하기</span> 좋을까요?</h2>'
      +'<div style="display:flex;flex-direction:column;gap:8px;flex:1;justify-content:center">'
      +learnings.slice(0,4).map(function(item,i){
        var desc=chs[i]&&chs[i].keyPoints&&chs[i].keyPoints[0]?x(chs[i].keyPoints[0]).substring(0,30):'';
        var icons2=['👔','🤖','📋','📅'];
        return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:12px">'
          +'<div style="width:32px;height:32px;flex-shrink:0;background:rgba(255,255,255,.12);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:20px">'+icons2[i%4]+'</div>'
          +'<div>'
          +'<div style="font-size:'+fsz(17)+'px;font-weight:800;color:'+W+';word-break:keep-all;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+hl1(x(String(item||'')),ACC2)+'</div>'
          +(desc?'<div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">'+desc+'</div>':'')
          +'</div>'
          +'</div>';
      }).join('')
      +'</div>'
      +'<div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 14px;font-size:15px;color:rgba(255,255,255,.7);font-weight:700;text-align:center">+ 가볍게 시작해서 바로 적용되는 구조를 담았습니다 +</div>'
      +'</div>';
  
  slides += card(4, T.card5bg, slide05Inner, T.dark5);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 06 비포/애프터
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var DEF_BEFORE=['방향이 없어 시간만 낭비','무엇부터 해야 할지 모름','이론만 알고 실천 못함','결과가 보이지 않는다','정보는 많은데 혼란스럽다','동기는 있지만 실행이 안 된다','혼자서는 한계를 느낀다','돈을 써도 변화가 없다','반복적인 실패에 지쳐간다','자신감이 점점 떨어진다'];
  var DEF_AFTER=['명확한 로드맵이 생긴다','오늘부터 즉시 실행 가능하다','이론+실전을 동시에 익힌다','눈에 보이는 성과가 생긴다','핵심만 빠르게 파악된다','매일 조금씩 성장한다','전문가의 노하우를 활용한다','투자 대비 최고의 결과를 낸다','자신감이 생기고 지속된다','원하는 결과에 점점 가까워진다'];
  var before10=(before&&before.length>=10)?before.map(function(b){return typeof b==='string'?b:(b.text||b.title||String(b));}):DEF_BEFORE.map(function(d,i){return (before&&before[i])?(typeof before[i]==='string'?before[i]:(before[i].text||before[i].title||d)):d;});
  var after10=(after&&after.length>=10)?after.map(function(a){return typeof a==='string'?a:(a.text||a.title||a.after||String(a));}):DEF_AFTER.map(function(d,i){return (after&&after[i])?(typeof after[i]==='string'?after[i]:(after[i].text||after[i].title||after[i].after||d)):d;});

  var slide06Inner = '';

    slide06Inner = '<div style="padding:14px 18px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:8px;position:relative;z-index:1">'
    +logo(false)
    +'<div style="display:flex;align-items:center;gap:8px">'+chip('BEFORE / AFTER',true)
    +'<h2 style="font-size:22px;font-weight:900;color:'+DK+';margin:0">읽기 전 vs 후</h2></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0">'
    +'<div style="background:#FFF5F5;border:1px solid #FFD0D0;border-radius:12px;padding:10px 9px;display:flex;flex-direction:column;gap:0;justify-content:space-evenly">'
    +'<div style="font-size:12px;font-weight:800;color:#E05555;letter-spacing:2px;margin-bottom:5px;text-align:center">❌ BEFORE</div>'
    +before10.slice(0,10).map(function(b){
      return '<div style="font-size:15px;color:#aaa;padding:3px 5px;background:rgba(255,80,80,.04);border-radius:5px;text-decoration:line-through;word-break:keep-all;line-height:1.35">'+x(String(b))+'</div>';
    }).join('')
    +'</div>'
    +'<div style="background:'+BL+';border:1px solid '+BL2+';border-radius:12px;padding:10px 9px;display:flex;flex-direction:column;gap:0;justify-content:space-evenly">'
    +'<div style="font-size:12px;font-weight:800;color:'+B+';letter-spacing:2px;margin-bottom:5px;text-align:center">✅ AFTER</div>'
    +after10.slice(0,10).map(function(a){
      return '<div style="font-size:15px;color:'+DK+';padding:3px 5px;border-radius:5px;word-break:keep-all;font-weight:700;line-height:1.35;background:rgba(255,255,255,.6)"><span style="color:'+B+';font-weight:900;margin-right:3px">✓</span>'+x(String(a))+'</div>';
    }).join('')
    +'</div>'
    +'</div></div>';
  
  slides += card(5, T.card6bg, slide06Inner, false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 07 추천 대상
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var targetItems5=(function(){
    var items=[];
    if(target&&target.length>5){
      var sents=target.replace(/([,，.!?])/g,'$1|').split('|').map(function(s2){return s2.trim().replace(/^[,，\s]+/,'').replace(/[,，.!?\s]+$/,'');}).filter(function(s2){return s2.length>3;});
      sents.slice(0,3).forEach(function(s2){var icons3=['🙋','👨‍💼','👩‍💻'];items.push({icon:icons3[items.length%3],t:s2});});
    }
    if(items.length<1)items.push({icon:'🙋',t:x(e.targetReader||'이 분야를 처음 시작하는 분')});
    items.push({icon:'⚡',t:'이론보다 즉시 실전 적용이 필요한 분'});
    items.push({icon:'🎯',t:'체계적인 로드맵으로 빠르게 성과 내고 싶은 분'});
    items.push({icon:'📈',t:'이미 시도했지만 결과가 없어 방법을 바꾸고 싶은 분'});
    items.push({icon:'💡',t:'전문가의 실전 노하우를 한 번에 익히고 싶은 분'});
    return items.slice(0,5);
  })();

  var slide07Inner = '';

    slide07Inner = '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675">'
      +'<defs><radialGradient id="c07" cx="50%" cy="30%" r="60%"><stop offset="0%" stop-color="'+T.p1+'" stop-opacity=".2"/><stop offset="100%" stop-color="transparent"/></radialGradient></defs>'
      +'<circle cx="270" cy="200" r="260" fill="url(#c07)"/>'
      +'<line x1="0" y1="150" x2="540" y2="80" stroke="'+T.p1+'" stroke-opacity=".07" stroke-width="60"/>'
      +'</svg>'
      +'<div style="padding:18px 22px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:10px;position:relative;z-index:1">'
      +logo(true)
      +'<div style="font-size:13px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,.5);text-transform:uppercase">WHO IS THIS FOR</div>'
      +'<h2 style="font-size:40px;font-weight:900;color:'+W+';word-break:keep-all;letter-spacing:-0.8px;line-height:1.1;margin:0"><span style="color:'+ACC+'">이런 분</span>께<br>추천합니다</h2>'
      +'<div style="flex:1;display:flex;flex-direction:column;gap:7px;justify-content:center">'
      +targetItems5.map(function(it){
        return '<div style="display:flex;align-items:center;gap:11px;padding:10px 13px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.14);border-radius:11px">'
          +'<span style="font-size:28px;flex-shrink:0">'+it.icon+'</span>'
          +'<span style="font-size:'+fsz(17)+'px;font-weight:700;color:'+W+';word-break:keep-all;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+hl1(it.t,ACC)+'</span>'
          +'</div>';
      }).join('')
      +'</div></div>';
  
  slides += card(6, T.card7bg, slide07Inner, T.dark7);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 08 기대 결과 / 이것은 할 수 있게 됩니다
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var resultItems = (function(){
    var DEF=[
      {icon:'①',t:'핵심 개념 이해와 즉시 실전 적용'},
      {icon:'②',t:'전문 도구 없이 스스로 시작'},
      {icon:'③',t:'나만의 수익화 루틴 설계'},
      {icon:'④',t:'지속 가능한 성장 구조 완성'}
    ];
    var items=chs.slice(0,4).map(function(ch,i){
      var ai=ch.actionItems&&ch.actionItems.length?ch.actionItems[0]:null;
      var kp=ch.keyPoints&&ch.keyPoints.length?ch.keyPoints[0]:null;
      var t=ai||(kp)||(ch.title?ch.title:DEF[i].t);
      return {icon:['①','②','③','④'][i],t:typeof t==='string'?t:String(t)};
    });
    return (items.length>=4&&items[0].t)?items:DEF;
  })();

  var slide08InnerBase = '<div style="padding:22px 24px 52px;display:flex;flex-direction:column;height:100%;box-sizing:border-box;gap:12px;position:relative;z-index:1">'
    +logo(false)
    +'<div style="display:flex;align-items:center;gap:8px">'
    +'<div style="width:4px;height:20px;background:'+B+';border-radius:2px"></div>'
    +'<span style="font-size:14px;font-weight:800;color:'+B+';letter-spacing:1px">기대 결과</span>'
    +'</div>'
    +'<h2 style="font-size:32px;font-weight:900;color:'+DK+';line-height:1.1;word-break:keep-all;margin:0">이 책을 보고 나면<br><span style="color:'+B+'">최소한 이것은 할 수 있게</span> 됩니다</h2>'
    +'<div style="display:flex;flex-direction:column;gap:10px;flex:1;justify-content:center">'
    +resultItems.map(function(it){
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:'+BL+';border:1px solid '+BL2+';border-radius:12px">'
        +'<div style="width:32px;height:32px;flex-shrink:0;background:'+B+';border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff;">'+it.icon+'</div>'
        +'<span style="font-size:'+fsz(17)+'px;font-weight:700;color:'+DK+';word-break:keep-all;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+hl1(x(it.t),B)+'</span>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<div style="background:'+B+';border-radius:10px;padding:10px 14px;font-size:15px;color:#fff;font-weight:800;text-align:center">🚀 막막함이 줄어들수록 실행 속도도 달라집니다</div>'
    +'</div>';
  var slide08Inner = '';

    slide08Inner = slide08InnerBase;
  
  slides += card(7, T.card8bg, slide08Inner, false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 09 CTA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  var slide09Inner = '';

    slide09Inner = '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none" viewBox="0 0 540 675">'
      +'<defs>'
      +'<radialGradient id="c09a" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="'+T.p1+'" stop-opacity=".28"/><stop offset="100%" stop-color="transparent"/></radialGradient>'
      +'<radialGradient id="c09b" cx="15%" cy="80%" r="40%"><stop offset="0%" stop-color="'+T.p2+'" stop-opacity=".18"/><stop offset="100%" stop-color="transparent"/></radialGradient>'
      +'</defs>'
      +'<circle cx="270" cy="338" r="280" fill="url(#c09a)"/>'
      +'<circle cx="81" cy="540" r="180" fill="url(#c09b)"/>'
      +'<path d="M400 55 L440 78 L440 124 L400 147 L360 124 L360 78 Z" stroke="'+T.p1+'" stroke-opacity=".22" stroke-width="1.5" fill="none"/>'
      +'<path d="M0 550 Q270 520 540 550" stroke="'+T.p2+'" stroke-opacity=".12" stroke-width="2" fill="none"/>'
      +'<circle cx="460" cy="110" r="50" fill="'+T.p1+'" fill-opacity=".07" stroke="'+T.p1+'" stroke-opacity=".18" stroke-width="1"/>'
      +'<circle cx="50" cy="75" r="2.5" fill="'+T.p1+'" opacity=".7"/>'
      +'<path d="M50 75 L50 68 M50 75 L50 82 M50 75 L43 75 M50 75 L57 75" stroke="'+T.p1+'" stroke-width="1.5" opacity=".7"/>'
      +'</svg>'
      +'<div style="padding:22px 26px 52px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;box-sizing:border-box;text-align:center;position:relative;z-index:1;gap:12px">'
      +'<div style="width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:24px">📘</div>'
      +'<div style="font-size:13px;font-weight:800;letter-spacing:2.5px;color:'+ACC+';text-transform:uppercase">GET STARTED TODAY</div>'
      +'<h2 style="font-size:clamp(24px,5vw,32px);font-weight:900;color:#fff;line-height:1.1;word-break:keep-all;letter-spacing:-0.8px;max-width:420px;margin:0">'+hl1(title,ACC)+'</h2>'
      +'<p style="font-size:'+fsz(14)+'px;color:rgba(255,255,255,.75);line-height:1.55;word-break:keep-all;max-width:380px;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">'+hl1((finalPush||'').substring(0,70)+((finalPush||'').length>70?'...':''),ACC)+'</p>'
      +'<div style="display:inline-flex;align-items:center;gap:10px;padding:14px 30px;background:'+W+';color:'+B3+';font-weight:900;font-size:17px;border-radius:100px;box-shadow:0 8px 28px rgba(0,0,0,.25)">'
      +'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="'+B3+'" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
      +'지금 바로 읽기</div>'
      +'</div>';
  
  slides += card(8, T.card9bg, slide09Inner, T.dark9);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── 테마 버튼 & 최종 HTML 조립 ──
  var cardParts = slides.split(/(?=<div class="sp-card")/);
  var slideLabels=['01 히어로','02 문제 공감','03 해결책','04 목차/챕터','05 핵심 장점','06 비포/애프터','07 추천 대상','08 기대 결과','09 CTA'];

  var themeButtonsHtml='<div id="sp-theme-bar" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:12px">';
  THEMES.forEach(function(th,ti){
    var isAct=(ti===CUR_THEME);
    themeButtonsHtml+='<button onclick="spSwitchTheme('+ti+')" style="padding:6px 12px;border:2px solid '+(isAct?'rgba(255,255,255,.9)':'rgba(255,255,255,.25)')+';border-radius:100px;background:'+(isAct?'rgba(255,255,255,.18)':'transparent')+';color:'+(isAct?'#fff':'rgba(255,255,255,.6)')+';font-size:10px;font-weight:'+(isAct?800:500)+';cursor:pointer;font-family:inherit">'+th.name+'</button>';
  });
  themeButtonsHtml+='</div>';

  // 폰트 선택기
  var FONT_LIST=[
    {key:'noto',label:'Noto (기본)'},
    {key:'brush',label:'붓글씨'},{key:'poor',label:'Poor Story'},
    {key:'melody',label:'Hi Melody'},{key:'single',label:'Single Day'},
    {key:'sunflower',label:'해바라기'}
  ];
  var curFontKey=window._spFontKey||'noto';
  var fontBtnsHtml='<div id="sp-font-bar" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-bottom:10px">'
    +'<div style="width:100%;text-align:center;font-size:9px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:1.5px;margin-bottom:3px">✦ 폰트 선택</div>';
  FONT_LIST.forEach(function(fo){
    var act=(fo.key===curFontKey);
    fontBtnsHtml+='<button onclick="spSwitchFont(\''+fo.key+'\')" style="padding:5px 11px;border:1.5px solid '+(act?'rgba(255,255,255,.8)':'rgba(255,255,255,.2)')+';border-radius:100px;background:'+(act?'rgba(255,255,255,.15)':'transparent')+';color:'+(act?'#fff':'rgba(255,255,255,.5)')+';font-size:10px;font-weight:'+(act?700:400)+';cursor:pointer;font-family:inherit">'+fo.label+'</button>';
  });
  fontBtnsHtml+='</div>';
  var finalHtml='<div id="sp-root" style="background:linear-gradient(160deg,#0a0818 0%,#120d30 50%,#0a1520 100%);padding:24px 16px;font-family:'+CARD_FF+';min-height:100%;box-sizing:border-box">'
    +'<div id="sp-header" style="text-align:center;margin-bottom:8px">'
    +'<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.45);letter-spacing:2px;margin-bottom:6px;text-transform:uppercase">CARD NEWS · 9장 · 테마 &amp; 폰트 선택</div>'
    +'<div style="font-size:'+fsz(13)+'px;font-weight:800;color:#fff;margin-bottom:10px;word-break:keep-all;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+title+'</div>'
    +themeButtonsHtml
    +fontBtnsHtml
    +'<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:8px 0 5px">'
    +'<button onclick="setSpPreviewMode(\'grid\')" style="padding:7px 12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:100px;color:#fff;font-size:10px;font-weight:800;cursor:pointer">▦ 전체</button>'
    +'<button onclick="setSpPreviewMode(\'mobile\')" style="padding:7px 12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:100px;color:#fff;font-size:10px;font-weight:800;cursor:pointer">▯ 모바일</button>'
    +'<button onclick="setSpPreviewMode(\'selected\')" style="padding:7px 12px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:100px;color:#fff;font-size:10px;font-weight:800;cursor:pointer">✓ 선택만</button>'
    +'<button onclick="selectAllSpSlides()" style="padding:7px 12px;background:rgba(99,102,241,.22);border:1px solid rgba(129,140,248,.35);border-radius:100px;color:#c7d2fe;font-size:10px;font-weight:800;cursor:pointer">전체 선택</button>'
    +'<button onclick="clearSpSlideSelection()" style="padding:7px 12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:100px;color:#94a3b8;font-size:10px;font-weight:800;cursor:pointer">선택 해제</button>'
    +'</div>'
    +'<div style="font-size:10px;color:#94a3b8;margin:4px 0 10px"><span id="sp-selected-count">9장 선택</span> · 개별 PNG 1080×1350 · 크몽 긴 이미지 860px 폭</div>'
    +'<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:7px">'
    +'<button onclick="downloadSelectedSpSlides(this)" style="padding:9px 18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:100px;color:#fff;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">⬇ 선택 PNG</button>'
    +'<button onclick="downloadKmongLongPage(this)" style="padding:9px 18px;background:#6366f1;border:1px solid #818cf8;border-radius:100px;color:#fff;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">⬇ 크몽 긴 이미지</button>'
    +'<button onclick="dlAllSlides(this)" style="padding:9px 18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);border-radius:100px;color:#cbd5e1;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">전체 9장</button>'
    +'</div>'
    +'</div>'
    +'<div id="sp-preview-list" data-preview-mode="grid" style="display:flex;flex-direction:column;align-items:center;gap:24px">';

  cardParts.forEach(function(part,idx){
    if(!part.trim())return;
    var label=slideLabels[idx-1]||('슬라이드 0'+idx);
    window._spSelectedSlides[idx]=window._spSelectedSlides[idx]!==false;
    finalHtml+='<div id="sp-slide-wrap-'+idx+'" style="display:flex;flex-direction:column;align-items:center;gap:7px;padding:10px;border:2px solid '+(window._spSelectedSlides[idx]?'#818cf8':'transparent')+';border-radius:16px;background:'+(window._spSelectedSlides[idx]?'rgba(99,102,241,.10)':'transparent')+';transition:.2s;width:min(100%,560px);box-sizing:border-box">'
      +'<div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="font-size:10px;color:#6B7A9A;font-weight:700;letter-spacing:1px">'+label+'</div><button id="sp-select-btn-'+idx+'" onclick="toggleSpSlideSelection('+idx+')" style="padding:5px 10px;border:1px solid rgba(129,140,248,.4);border-radius:100px;background:'+(window._spSelectedSlides[idx]?'#6366f1':'rgba(255,255,255,.10)')+';color:#fff;font-size:9px;font-weight:800;cursor:pointer">'+(window._spSelectedSlides[idx]?'✓ 선택됨':'선택')+'</button></div>'
      +part
      +'<button onclick="dlSpSlide('+idx+',this)" style="padding:8px 20px;background:#1B5CE8;border:none;border-radius:100px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">⬇ PNG</button>'
      +'</div>';
  });



  finalHtml+='</div></div>';

  finalHtml=finalHtml.replace(/—/g, (HW_FONTS[window._spFontKey]) 
    ? '<span style="font-family:inherit;display:inline-block;transform:scaleX(1.3);margin:0 2px">ㅡ</span>' 
    : '<span style="font-family:inherit">—</span>');
  document.getElementById('cv-sp-body').innerHTML=finalHtml;
  updateSpSelectionUi();
  renderKmongThumbnails(e);
  renderKmongListing(e);

  window.spSwitchTheme=function(idx2){
    renderCvSalesPage(window._spLastEbook||APP.ebook, idx2);
  };
  window.spSwitchFont=function(key){
    window._spFontKey=key;
    renderCvSalesPage(window._spLastEbook||APP.ebook, CUR_THEME);
  };

}




/* ── DOCX ── */



async function dlAllSlides(btn){
  if(typeof html2canvas==='undefined'){
    showToast('error','html2canvas 로딩 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  var orig=btn?btn.textContent:'';
  if(btn){btn.textContent='⏳ 저장 중...';btn.disabled=true;}
  var total=9;
  for(var i=1;i<=total;i++){
    await new Promise(function(res){
      dlSpSlide(i,null);
      setTimeout(res,1200);
    });
  }

  if(btn){btn.textContent=orig;btn.disabled=false;}
  showToast('success','✅ 전체 9장 저장 완료!');
}
