function pad(n){return String(n||0).padStart(2,'0');}

/* Atlas V3 Phase 1B: renderText now gives real numbered ("1) ..."/"1. ...")
   and bulleted ("- .../· ...") lines their own hanging-indent typography
   instead of flattening every line into an identical <p>. This only fires on
   markers already present in the real AI-generated text — nothing is
   invented, it is a presentation upgrade for structure that already exists
   (e.g. numbered decision criteria, bulleted checklists inside chapter body
   or appendix content).

   V3 Phase 1B refinement (full-book re-study of the Master Reference):
   the reference repeats a bold, standalone "thesis statement" sentence
   several times per book to punctuate a key idea, and separately uses a
   left-border italic block for quoted/illustrative dialogue. Atlas already
   silently destroys the first signal today — cleanText() strips any
   "**bold**" markdown before it ever reaches the DOM, which is a real,
   already-possible signal in AI-written text (LLMs commonly emphasize a key
   sentence this way even unprompted), just discarded instead of honored.
   Detection happens on a whole trimmed line BEFORE the generic ** strip, so
   the emphasis and quote checks below run first; whatever doesn't match
   still gets its trailing ** cleaned in the plain-paragraph fallback exactly
   as before. Nothing is fabricated — both devices are no-ops on real text
   that never contains them (the overwhelming case, and the entirety of
   old/backward-compat projects).

   Editorial Composition Engine (final Phase 1B step): a genuinely long
   paragraph (the model occasionally writes one dense 300+ character block)
   reads as a wall of text. atlasSplitLongParagraph() breaks such a
   paragraph into two or more <p> tags at real sentence boundaries — same
   words, same order, just given room to breathe. It never fires on
   paragraphs that are already a normal length (the overwhelming majority),
   so this is a safety net, not a rewrite. renderTextBlocks() exposes each
   rendered unit (paragraph/thesis/quote/list-row) as a separate array entry
   instead of one joined string, so renderCvEbook() can interleave real
   structural components (framework/table/timeline) between the first and
   second half of a chapter's body prose instead of stacking every optional
   block after a single wall of paragraphs — see the chapter loop below. */
function atlasSplitLongParagraph(text,maxLen){
  maxLen=maxLen||220;
  if(text.length<=maxLen)return [text];
  var sentences=text.match(/[^.!?]+[.!?]+(?:['"’”)]*)\s*|[^.!?]+$/g)||[text];
  var chunks=[],cur='';
  sentences.forEach(function(sent){
    if(cur&&(cur.length+sent.length)>maxLen){chunks.push(cur.trim());cur=sent;}
    else{cur+=sent;}
  });
  if(cur.trim())chunks.push(cur.trim());
  return chunks.length?chunks:[text];
}
/* 2026-08-19: 실제 재현된 버그 — AI가 부록/챕터 본문 같은 자유 텍스트
   필드 안에 마크다운 파이프 표(| 헤더 | 헤더 |\n|---|---|\n| 값 | 값 |)를
   섞어 쓰는 경우가 있는데, renderTextBlocks()는 이 문법을 전혀 몰라서
   "|---|---|" 구분줄이 그대로 글자로 화면에 노출됐다(사용자 스크린샷으로
   확인). 헤더 줄 바로 다음이 구분줄이면 실제 표로 인식해 파싱한다 —
   comparisonTable(구조화 필드)과 똑같은 .ctable 마크업으로 렌더링해
   시각적으로도 일관되게 맞춘다. */
function atlasIsMdTableRow(line){
  return line.indexOf('|')!==-1 && line.replace(/\|/g,'').trim().length>0;
}
function atlasIsMdTableSepRow(line){
  var cells=line.split('|').map(function(c){return c.trim();}).filter(function(c){return c.length;});
  if(!cells.length)return false;
  return cells.every(function(c){return /^:?-{2,}:?$/.test(c);});
}
function atlasSplitMdTableRow(line){
  var t=line.trim();
  if(t.charAt(0)==='|')t=t.slice(1);
  if(t.charAt(t.length-1)==='|')t=t.slice(0,-1);
  return t.split('|').map(function(c){return c.trim();});
}
function renderTextBlocks(s){
  if(!s)return [];
  s=String(s).replace(/#{1,6}\s/g,'').replace(/\n{3,}/g,'\n\n');
  var lines=s.split('\n').filter(function(l){return l.trim();});
  var blocks=[];
  var i=0;
  while(i<lines.length){
    var t=lines[i].trim();
    if(atlasIsMdTableRow(t)&&i+1<lines.length&&atlasIsMdTableSepRow(lines[i+1].trim())){
      var headerCells=atlasSplitMdTableRow(t);
      var rows=[];
      var j=i+2;
      while(j<lines.length&&atlasIsMdTableRow(lines[j].trim())&&!atlasIsMdTableSepRow(lines[j].trim())){
        rows.push(atlasSplitMdTableRow(lines[j].trim()));
        j++;
      }
      blocks.push('<div class="ctable"><div class="ctable-scroll"><table><thead><tr>'
        +headerCells.map(function(c){return '<th>'+x(c)+'</th>';}).join('')
        +'</tr></thead><tbody>'
        +rows.map(function(row){return '<tr>'+row.map(function(c){return '<td>'+x(c)+'</td>';}).join('')+'</tr>';}).join('')
        +'</tbody></table></div></div>');
      i=j;
      continue;
    }
    // LLM이 섹션 구분용으로 남기는, 밑줄/대시만 있는 줄("___", "----" 등)은
    // 실제 본문이 아니라 잔재이므로 통째로 건너뛴다(사용자 요청: 문단 끝
    // "___" 기호 제거).
    if(/^[_\-–—]{3,}$/.test(t)){i++;continue;}
    var mBold=t.match(/^\*\*(.+)\*\*$/);
    var mQuote=!mBold&&t.match(/^["“](.+)["”]$/);
    var mNum=!mBold&&!mQuote&&t.match(/^(\d{1,2})[).]\s+(.+)$/);
    // 2026-08-19: 실제 재현된 버그 — AI가 "- [ ] 항목" 같은 마크다운 체크리스트
    // 문법을 쓰면 mBul이 대시만 걷어내고 "[ ]"는 본문 텍스트로 그대로 남겨
    // 화면에 대괄호가 노출됐다(사용자 스크린샷으로 확인). mBul보다 먼저
    // 검사해 실제 체크박스(.cklrow/.ckl-check, actionItems 체크리스트와
    // 동일한 컴포넌트)로 렌더링한다.
    var mChk=!mBold&&!mQuote&&!mNum&&t.match(/^(?:[-•·]\s*)?\[([ xX])\]\s+(.+)$/);
    var mBul=!mBold&&!mQuote&&!mNum&&!mChk&&t.match(/^[-•·]\s+(.+)$/);
    if(mBold){
      blocks.push('<div class="thst">'+x(mBold[1])+'</div>');
    }else if(mQuote){
      blocks.push('<div class="qtb">'+x(mQuote[1])+'</div>');
    }else if(mNum){
      blocks.push('<div class="chb-nrow"><span class="chb-nnum">'+x(mNum[1])+'</span><span class="chb-ntext">'+x(mNum[2])+'</span></div>');
    }else if(mChk){
      blocks.push('<div class="cklrow"><div class="ckl-check">'+(mChk[1].trim()?ebIcon('checkCircle',11):'')+'</div><span>'+x(mChk[2])+'</span></div>');
    }else if(mBul){
      blocks.push('<div class="chb-brow"><span class="chb-bdot"></span><span class="chb-ntext">'+x(mBul[1])+'</span></div>');
    }else{
      atlasSplitLongParagraph(t.replace(/\*\*/g,'')).forEach(function(chunk,ci){
        // 문단 시작이 짧은 리드인 레이블(예: "1단계, ~", "핵심 포인트: ~")이면
        // 그 레이블만 굵게+진한 색으로 강조한다(가독성 요청) — 긴 문단이
        // 여러 조각으로 나뉜 경우 진짜 리드인은 첫 조각에만 있으므로 그때만
        // 검사한다.
        var lead=ci===0&&chunk.match(/^([^:,]{1,16}[:,])\s*(.+)$/);
        if(lead){
          blocks.push('<p><strong class="chb-lead">'+x(lead[1])+'</strong> '+x(lead[2])+'</p>');
        }else{
          blocks.push('<p>'+x(chunk)+'</p>');
        }
      });
    }
    i++;
  }
  return blocks;
}
function renderText(s){
  return renderTextBlocks(s).join('');
}
function copyPrompt(id,btn){
  var el=document.getElementById('prompt-'+id);
  if(!el)return;
  navigator.clipboard.writeText(el.textContent||'').then(function(){
    var orig=btn?btn.textContent:'';
    if(btn){btn.textContent='복사됨';setTimeout(function(){btn.textContent=orig;},1500);}
  }).catch(function(){showToast('error','복사 실패');});
}

/* 2026-08-14: 실제 재현된 버그 — 챕터 본문(renderTextBlocks)은 "**bold**"
   마크다운을 걸러내지만, 표 셀/프레임워크/타임라인/체크리스트/실행박스/
   경고박스/챕터 제목처럼 x()로 바로 렌더링되는 짧은 필드들은 이 필터를
   거치지 않아 AI가 가끔 남기는 "**"가 화면에 그대로 노출됐다. 이 앱 안에서
   x()는 오직 AI 생성 텍스트/사용자 입력 echo용이고 "**"가 의도된 문자로
   쓰일 일이 없으므로, escape 직전에 여기서 한 번에 제거하면 모든 호출부를
   개별 수정하지 않고도 근본 지점 하나에서 해결된다. */
function x(s){return String(s||'').replace(/\*\*/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* 2026-08-12: 사용자 요청 — AI가 만든 제목에 대시("링크는 있는데 구매가
   없다 - 전환 공백의 정체" 같은 형태)가 있으면 대시 앞/뒤를 두 줄(대제목/
   소제목)로 나눠서 보여주고, 화면에 "-" 글자 자체는 표시하지 않는다. 대시
   양옆에 공백이 있는 경우만 분리 대상으로 본다("AI-기반"처럼 붙어 쓴
   하이픈은 건드리지 않음). 대시가 없으면 원래 그대로(main만, sub 없음). */
function splitHookTitle(title){
  var t=String(title||'');
  var m=t.match(/^(.+?)\s[-–—]\s(.+)$/);
  if(m&&m[1].trim()&&m[2].trim())return {main:m[1].trim(),sub:m[2].trim()};
  return {main:t,sub:null};
}
function fsStyleAttr(px){ px=parseInt(px,10); return px?(' style="font-size:'+px+'px"'):''; }
/* 편집모드에서만 보이는 대제목/소제목 글씨크기 A-/A+ 컨트롤. contentEditable
   영역([data-atlas-field]) 바깥의 형제 요소로 둬야 버튼 라벨 텍스트가
   저장되는 제목에 섞여 들어가지 않는다. */
function fontSizeCtl(hasSub){
  var h='<div class="atlas-fontsize-ctl">'
    +'<span class="afc-lbl">대제목</span>'
    +'<button type="button" class="afc-btn" onclick="atlasAdjustTitleFontSize(this,\'main\',-1)">A−</button>'
    +'<button type="button" class="afc-btn" onclick="atlasAdjustTitleFontSize(this,\'main\',1)">A+</button>';
  if(hasSub){
    h+='<span class="afc-lbl">소제목</span>'
      +'<button type="button" class="afc-btn" onclick="atlasAdjustTitleFontSize(this,\'sub\',-1)">A−</button>'
      +'<button type="button" class="afc-btn" onclick="atlasAdjustTitleFontSize(this,\'sub\',1)">A+</button>';
  }
  h+='</div>';
  return h;
}


/* 2026-08-10: 사용자가 첨부한 참고 전자책(다크 네이비 + 골드 프리미엄 에디토리얼
   스타일)을 모방해달라고 요청 — 매 전자책마다 색이 바뀌던 랜덤 그라디언트
   COVER_THEMES 대신, 참고 스타일과 같은 단일 고정 아이덴티티를 쓴다. Atlas
   CSS(:root)에 이미 있는 --gold(#e8b84b) 토큰과 짝을 맞춘 다크 네이비 한
   색상만 쓴다(참고 PDF에서 실측한 값과 가장 가까운 톤). */
function getRandomTheme(arr){return arr[Math.floor(Math.random()*arr.length)];}

/* Atlas Redesign Phase 2: Success/Error/Info toast now backed by
   .atlas-toast(-success/-error/-info) tokens instead of hardcoded inline
   colors (css/styles.css) — same behavior, message/duration logic unchanged. */
function showToast(type,msg,dur){
  var t=document.getElementById('toast');
  if(!t){
    t=document.createElement('div');t.id='toast';t.className='atlas-toast';
    document.body.appendChild(t);
  }
  var tone=(type==='success'||type==='error')?type:'info';
  t.className='atlas-toast atlas-toast-'+tone;
  t.textContent=msg||'';
  clearTimeout(t._to);
  requestAnimationFrame(function(){t.classList.add('show');});
  t._to=setTimeout(function(){t.classList.remove('show');},dur||3000);
}
/* 2026-08-14: 실제 재현된 버그 — 전자책 생성 실패 시 showToast('error',...,6000)로
   6초짜리 에러 토스트를 띄우는데, 사용자가 그 6초 안에 "이어서 생성"을 누르면
   재생성이 정상적으로 시작돼도(진행률/단계 목록은 바로 갱신됨) 이 토스트는
   자기 타이머가 끝날 때까지 화면에 그대로 남아있었다 — 재시도 버튼이 이
   토스트를 전혀 건드리지 않았기 때문. 재시도를 누르는 순간 무조건 즉시
   치운다. */
function dismissToast(){
  var t=document.getElementById('toast');
  if(t){clearTimeout(t._to);t.classList.remove('show');}
}


/* Atlas Premium Ebook Output Design, Phase 2: real icons only (no emoji in
   actual exported/previewed ebook content) via AtlasIcons.svg(), which is
   loaded before this file (index.html script order). Silent no-op fallback
   keeps this safe even if that ever changes. */
function ebIcon(name,size){return (typeof AtlasIcons!=='undefined'&&AtlasIcons.svg)?AtlasIcons.svg(name,{size:size||14}):'';}

/* Atlas V3 Phase 1B: page-footer running header device. Every "reading"
   page (not the cover/opener/dark art pages, which carry their own closing
   design — same restraint the reference book itself shows) gets a
   consistent footer: book title on the left, a real copyright line on the
   right — matching the reference's own running footer.
   2026-08-20: 사용자가 재현한 버그 — 예전엔 여기에 "N / 전체" 페이지
   번호도 함께 표시했다. 그 "전체"는 목차/서문/서론/챕터/결론/부록처럼
   화면에 보이는 "구조적 섹션" 개수였는데(PR #61의 A4 슬라이싱 이전
   설계), PDF로 저장할 때는 긴 챕터 하나가 실제로는 물리적으로 여러
   장으로 나뉘므로(atlasComputeSafePageBreaks) 실제 PDF 파일의 진짜
   페이지 수와 이 "전체" 숫자가 서로 달랐다(예: 화면엔 "1/15"인데 실제
   저장된 PDF는 24페이지). 실제 최종 페이지 수는 html2canvas로 캡처하는
   시점에야 정해지는 값이라 화면 렌더링 시점(이 함수)에서는 애초에 알 수
   없다 — Preview와 Export가 항상 같은 내용을 보여줘야 한다는 원칙상
   Export에서만 다른(진짜) 숫자를 새로 그려 넣는 것도 답이 아니므로,
   틀릴 수밖에 없는 숫자를 아예 표시하지 않는다. */
function pgFooter(bookTitle,copyrightLine){
  return '<div class="pgft"><span class="pgft-l">'+x(bookTitle)+'</span><span class="pgft-c">'+x(copyrightLine)+'</span></div>';
}

function renderCvEbook(e){
  var c=e.copyright||{};
  var chs=e.chapters||[];
  var apps=e.appendices||[];
  var footerCopyright='ⓒ '+(c.year||'2025')+' '+e.author;
  function nextFooter(){return pgFooter(e.title,footerCopyright);}

  /* 2026-08-10: 목차에 실제 페이지 번호를 넣기 위한 사전 계산. .pg 하나 =
     인쇄/PDF 시 정확히 한 페이지라는 규칙(css/styles.css @media print)을
     그대로 이용해, 아래 pages.push() 호출 순서와 정확히 같은 순서로 절대
     페이지 번호를 미리 센다(지어내지 않고 실제로 쌓일 순서를 그대로 계산 —
     Never-Guess). 2026-08-12: 저작권 페이지를 맨 뒤로 옮기면서(사용자 요청)
     더 이상 2번째 페이지를 차지하지 않는다 — 표지=1, 서문(있으면)=+1,
     목차=그 다음 페이지, 서론(있으면)=+1, 이후 각 챕터는 오프너+본문
     2페이지씩. 목차에는 저작권 페이지 번호를 표시하지 않으므로 그 번호는
     따로 계산할 필요가 없다. */
  var absPage=1; // 1=표지
  if(e.preface)absPage++;
  var tocPageNum=absPage+1;
  absPage=tocPageNum;
  if(e.intro)absPage++;
  var chapterPageNums=[];
  for(var pi=0;pi<chs.length;pi++){ absPage++; chapterPageNums.push(absPage); absPage++; }
  absPage++;
  var conclusionPageNum=absPage;
  var appendixPageNum=apps.length?absPage+1:null;

  var pages=[];
  // 표지 — 참고 전자책 스타일(다크 네이비 + 골드)을 모방한 고정 아이덴티티,
  // 러닝 푸터 없음(원문 참고서도 표지엔 페이지 번호가 없다)
  // 2026-08-12: 사용자 요청 — (1) 표지 하단 저자명 표시 삭제, (2) 별/눈꽃
  // 모양으로 보인다는 sparkle 아이콘 장식 삭제, (3) 이후 시도했던 워터마크
  // (월계관 → 책 모양)도 전부 취소 — 중앙 오브젝트 워터마크 없이 배경
  // 그라디언트/점/텍스처 장식만으로 화려함을 낸다(css/styles.css .cvr 참고).
  // 2026-08-12: 사용자 요청 — 제목에 대시("A - B")가 있으면 대제목(A)/
  // 소제목(B)로 칸을 나눠 대시 글자 없이 표시. 편집모드에서 A-/A+로 글씨
  // 크기 조절 가능(titleFontSizeMain/titleFontSizeSub에 저장).
  var _ctp=splitHookTitle(e.title);
  var _ctitHtml=_ctp.sub
    ? '<div class="ctit-split" contenteditable="false" data-atlas-field="title">'
      +'<div class="ctit"'+fsStyleAttr(e.titleFontSizeMain)+'>'+x(_ctp.main)+'</div>'
      +'<div class="ctit-sub2"'+fsStyleAttr(e.titleFontSizeSub)+'>'+x(_ctp.sub)+'</div>'
      +'</div>'
    : '<div class="ctit" contenteditable="false" data-atlas-field="title"'+fsStyleAttr(e.titleFontSizeMain)+'>'+x(e.title)+'</div>';
  pages.push('<div class="pg cvr">'
    +'<div class="ccat">'+x(e.category)+'</div>'
    +'<div class="ctit-box">'+_ctitHtml+fontSizeCtl(!!_ctp.sub)+'</div>'
    +'<div class="csub" contenteditable="false" data-atlas-field="subtitle">'+x(e.subtitle)+'</div>'
    +'<div class="cvr-foot"><div class="cyr">'+x(c.year||'2025')+' · '+x(e.category)+'</div></div>'
    +'</div>');
  // 저작권 및 법적 고지 — 2026-08-12: 사용자 요청으로 맨 뒤(뒷표지 다음)로
  // 옮겼다. 저자/출판사/연락처 줄도 삭제했다(요청: "저자, 출판 연락처는
  // 삭제해") — 실제 push는 이 함수 맨 아래, 뒷표지 다음에서 한다.
  // 저자 서문
  if(e.preface){
    pages.push('<div class="pg inn"><div class="ey">'+ebIcon('sparkle',12)+' PREFACE</div><div class="sh">저자 서문</div>'
      +'<div class="chb" contenteditable="false" data-atlas-field="preface">'+renderText(e.preface)+'</div>'+nextFooter()+'</div>');
  }
  // 목차 — 참고 스타일처럼 점선 리더 + 실제 페이지 번호(위에서 미리 계산한 값)
  var toc='<div class="pg inn"><div class="ey">'+ebIcon('library',12)+' CONTENTS</div><div class="sh">목차</div>';
  for(var i=0;i<chs.length;i++){
    toc+='<div class="ti">'
      +'<span class="tn">CHAPTER '+pad(chs[i].number)+'</span>'
      +'<span class="tt">'+x(chs[i].title)+'</span>'
      +'<span class="tdots"></span>'
      +'<span class="tpg">P.'+chapterPageNums[i]+'</span>'
      +'</div>';
  }
  toc+='<div class="ti"><span class="tn">'+ebIcon('checkCircle',12)+'</span><span class="tt">결론</span><span class="tdots"></span><span class="tpg">P.'+conclusionPageNum+'</span></div>';
  if(appendixPageNum)toc+='<div class="ti"><span class="tn">'+ebIcon('file',12)+'</span><span class="tt">부록</span><span class="tdots"></span><span class="tpg">P.'+appendixPageNum+'</span></div>';
  toc+=nextFooter()+'</div>';
  pages.push(toc);
  // 서론
  if(e.intro){
    var introHtml='<div class="pg inn"><div class="ey">'+ebIcon('compass',12)+' INTRODUCTION</div><div class="sh">서론</div>'
      +'<div class="chb" contenteditable="false" data-atlas-field="intro">'+renderText(e.intro)+'</div>';
    if(e.targetReader){introHtml+='<div class="tgtb"><div class="tgtb-ic">'+ebIcon('target',16)+'</div><div><h4>이 책이 필요한 독자</h4><p>'+x(e.targetReader)+'</p></div></div>';}
    introHtml+=nextFooter()+'</div>';
    pages.push(introHtml);
  }
  // 챕터 — 각 장은 두 페이지로 구성: (1) 장 오프너(제목만, 러닝 푸터 없음 —
  // 원문 참고서의 장 시작 페이지와 동일한 절제된 여백 구성), (2) 본문 페이지
  // (기존에 장 도입부에 있던 "CHAPTER 0N · 카테고리" 이야블은 이제 본문
  // 페이지 상단의 러닝 헤더 역할을 한다).
  for(var i=0;i<chs.length;i++){
    var ch=chs[i];
    // 2026-08-12: 순서를 원래대로 되돌림(사용자 정정) — "CHAPTER 0N" 라벨이
    // 위, 챕터 실제 제목이 그 아래. 대제목/소제목 표현은 원래 이 순서(라벨 →
    // 큰 제목)를 가리킨 것이었다.
    var _chtp=splitHookTitle(ch.title);
    var _chTitleHtml=_chtp.sub
      ? '<div class="chop-title-split" contenteditable="false" data-atlas-field="chapterTitle" data-atlas-chapter="'+i+'">'
        +'<div class="chop-title"'+fsStyleAttr(ch.titleFontSizeMain)+'>'+x(_chtp.main)+'</div>'
        +'<div class="chop-title-sub"'+fsStyleAttr(ch.titleFontSizeSub)+'>'+x(_chtp.sub)+'</div>'
        +'</div>'
      : '<div class="chop-title" contenteditable="false" data-atlas-field="chapterTitle" data-atlas-chapter="'+i+'"'+fsStyleAttr(ch.titleFontSizeMain)+'>'+x(ch.title)+'</div>';
    pages.push('<div class="pg chop">'
      +'<div class="chop-badge">CHAPTER '+pad(ch.number)+'</div>'
      +_chTitleHtml
      +fontSizeCtl(!!_chtp.sub)
      +'</div>');
    var h='<div class="pg inn">';
    h+='<div class="cb"><div class="cp">'+ebIcon('book',14)+' CHAPTER '+pad(ch.number)+'</div><div class="cl">'+x(e.category||'')+'</div></div>';
    // 2026-08-13: 사용자 요청 — 비교표/프레임워크/타임라인이 본문 문단 중간에
    // 끼어들어 글의 흐름이 끊긴다는 지적. 예전(Editorial Composition Engine)
    // 에는 이 구조화 요소들을 본문 전반부와 후반부 사이에 일부러 끼워
    // 넣었는데, 그게 바로 이 문제의 원인이었다 — 이제 본문 전체(chb 하나)를
    // 끝까지 다 보여준 다음에야 구조화 요소가 나온다. 구조화 요소가 없는
    // 챕터는 원래도 그랬듯 본문만 그대로 렌더링된다.
    var bodyBlocks=renderTextBlocks(ch.content);
    var afterBodyComponents='';
    if(ch.comparisonTable&&ch.comparisonTable.headers&&ch.comparisonTable.headers.length&&ch.comparisonTable.rows&&ch.comparisonTable.rows.length){
      var ctab=ch.comparisonTable;
      afterBodyComponents+='<div class="ctable"><h4>'+ebIcon('briefcase',14)+' '+x(ctab.title||'비교')+'</h4><div class="ctable-scroll"><table><thead><tr>'+ctab.headers.map(function(hd){return '<th>'+x(hd)+'</th>';}).join('')+'</tr></thead><tbody>'+ctab.rows.map(function(row){return '<tr>'+row.map(function(cell){return '<td>'+x(cell)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>';
    }
    if(ch.framework&&ch.framework.steps&&ch.framework.steps.length){
      var fw=ch.framework;
      afterBodyComponents+='<div class="fwb"><h4>'+ebIcon('compass',14)+' 프레임워크</h4><div class="fwb-name">'+x(fw.name||'')+'</div><div class="fwgrid">'+fw.steps.map(function(st,si){return '<div class="fwcard"><div class="fwcard-num">'+pad(si+1)+'</div><div class="fwcard-title">'+x(st.title||'')+'</div><p>'+x(st.description||'')+'</p></div>';}).join('')+'</div></div>';
    }
    if(ch.timeline&&ch.timeline.length){
      afterBodyComponents+='<div class="tlb"><h4>'+ebIcon('calendar',14)+' 타임라인</h4>'+ch.timeline.map(function(tl,ti){
        var stageLbl=tl.stage?x(tl.stage)+' · ':'';
        return '<div class="tlrow"><div class="tldot">'+(ti+1)+'</div><div class="tllabel">'+stageLbl+x(tl.label||'')+'</div><div class="tltext">'+x(tl.description||'')+'</div></div>';
      }).join('')+'</div>';
    }
    h+='<div class="chb" contenteditable="false" data-atlas-field="chapterContent" data-atlas-chapter="'+i+'">'+bodyBlocks.join('')+'</div>'+afterBodyComponents;
    // Action Box — 오늘의 실행 (real actionBox field, one or more concrete actions)
    if(ch.actionBox&&ch.actionBox.length){
      var actions=Array.isArray(ch.actionBox)?ch.actionBox:[ch.actionBox];
      h+='<div class="actb"><h4>'+ebIcon('rocket',15)+' 오늘의 실행</h4>'+actions.map(function(a,ai){return '<div class="actb-row"><div class="actb-num">'+(ai+1)+'</div><span>'+x(a)+'</span></div>';}).join('')+'</div>';
    }
    // Copy-paste template block (already strong, kept — icon swapped for emoji)
    if(ch.copyBox&&ch.copyBox.length){
      h+='<div class="prompt-box">';
      h+='<div class="prompt-box-header"><div class="prompt-box-title">'+ebIcon('checkCircle',13)+' 그대로 복사해서 쓰세요</div></div>';
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
    // Warning Box — 초보자 주의사항
    if(ch.warningBox&&ch.warningBox.length){
      h+='<div class="warnb"><h4>'+ebIcon('alertTriangle',14)+' 초보자 주의사항</h4>'+ch.warningBox.map(function(w,wi){return '<div class="warnb-row"><span class="warnb-num">'+(wi+1)+'.</span><span>'+x(w)+'</span></div>';}).join('')+'</div>';
    }
    // Tip box — 핵심 포인트 (real keyPoints, its own honest role)
    if(ch.keyPoints&&ch.keyPoints.length){
      h+='<div class="tipb"><h4>'+ebIcon('sparkle',14)+' 핵심 포인트</h4>'+ch.keyPoints.map(function(kp){return '<div class="tipb-row"><div class="tipb-dot"></div><span>'+x(kp)+'</span></div>';}).join('')+'</div>';
    }
    // Checklist — 즉시 실천 체크리스트 (real actionItems)
    if(ch.actionItems&&ch.actionItems.length){
      h+='<div class="cklist"><h4>'+ebIcon('checkCircle',14)+' 즉시 실천 체크리스트</h4>'+ch.actionItems.map(function(a){return '<div class="cklrow"><div class="ckl-check">'+ebIcon('checkCircle',11)+'</div><span>'+x(a)+'</span></div>';}).join('')+'</div>';
    }
    // Chapter Summary — real ch.summary (genuine AI-written recap, required per chapter)
    if(ch.summary){
      h+='<div class="chsum"><h4>'+ebIcon('library',14)+' 이 장 요약</h4><p>'+x(ch.summary)+'</p></div>';
    }
    var chNext=chs[i+1];
    h+='<div class="chnx">';
    h+='<span class="chnx-done">'+ebIcon('checkCircle',13)+' CHAPTER '+pad(ch.number)+' 완료</span>';
    h+=chNext?'<span class="chnx-next">다음 챕터 · CH.'+pad(chNext.number)+' <b>'+x(chNext.title)+'</b> →</span>':'<span class="chnx-next">마지막 챕터 · 이어서 결론으로</span>';
    h+='</div>';
    h+=nextFooter();
    h+='</div>';
    pages.push(h);
  }
  // 결론
  var concl='<div class="pg inn" style="background:#fafaf9"><div class="ey">'+ebIcon('crown',12)+' CONCLUSION</div><div class="sh">결론</div>';
  var conclusionHtml=e.conclusion&&e.conclusion.length>10&&e.conclusion.charAt(0)!=='['?renderText(e.conclusion):'<p>이 전자책을 통해 다양한 전략과 방법을 살펴봤습니다. 꾸준히 실천하며 성장해 나가시길 진심으로 응원합니다. 작은 것부터 하나씩 시작하면 반드시 변화가 찾아올 것입니다.</p>';
  concl+='<div class="chb" contenteditable="false" data-atlas-field="conclusion">'+conclusionHtml+'</div>';
  concl+='<div class="impactb"><div class="impactb-mark">&ldquo;</div><p>이 책을 완독한 당신은 이미 99%를 앞서 있습니다</p><small>지금 바로 첫 번째 실천을 시작하세요</small></div>';
  concl+=nextFooter()+'</div>';
  pages.push(concl);
  // 부록 — renderText로 통일해 본문/서론과 같은 문단·목록 타이포그래피를 적용
  if(apps.length){
    for(var i=0;i<apps.length;i++){
      var apHtml='<div class="pg inn"><div class="ey">'+ebIcon('file',12)+' APPENDIX '+(i+1)+'</div><div class="sh">'+x(apps[i].title)+'</div>';
      apHtml+='<div class="chb" contenteditable="false" data-atlas-field="appendixContent" data-atlas-appendix="'+i+'">'+renderText(apps[i].content||'')+'</div>';
      apHtml+=nextFooter()+'</div>';
      pages.push(apHtml);
    }
  }
  // 뒷표지 — 표지와 같은 계열의 아트워크 페이지, 러닝 푸터 없음
  // 2026-08-12: 연락처(c.contact) 노출 줄 삭제(사용자 요청 — 연락처는 어디에도
  // 남기지 않는다).
  pages.push('<div class="pg bkpg"><div class="bkpg-ic">'+ebIcon('book',36)+'</div><h3>'+x(e.title)+'</h3>'
    +'<p>이 전자책이 도움이 되셨다면 주변에 공유해주세요.</p>'
    +'<div class="bkc">ⓒ '+x(c.year||'2025')+' '+x(e.author)+' · '+x(c.publisher||'독립 출판')+' · ALL RIGHTS RESERVED</div></div>');
  // 저작권 및 법적 고지 — 2026-08-12: 사용자 요청으로 맨 뒤(뒷표지 다음)로
  // 이동. 저자/출판/연락처 줄은 삭제하고 제목·법적 고지문·면책 조항만 남긴다.
  pages.push('<div class="pg cpg"><div class="cinn"><div class="clbl">저작권 및 법적 고지</div><div class="ctxt">'
    +'<p><strong>제목:</strong> '+x(e.title)+'</p><br>'
    +'<p>'+x(c.notice)+'</p><br><p><strong>면책 조항:</strong> '+x(c.disclaimer)+'</p>'
    +'<br><p>이 전자책은 저작권법의 보호를 받습니다. PLR 원본을 한국 시장에 맞게 재창작하였습니다.</p>'
    +'</div>'+nextFooter()+'</div></div>');
  var edocEl=document.getElementById('cv-edoc');
  edocEl.innerHTML=pages.join('');
  // 2026-08-12: 글씨체 선택(js/application.js atlasSetEbookFont())은
  // APP.ebook.fontFamily에 저장된다 — renderCvEbook()이 다시 불릴 때마다
  // (초기 생성/제목 실시간 수정/편집 저장/History 재열람) 여기서 다시
  // 적용해야 새로고침 후에도 선택한 글씨체가 유지된다.
  if(e.fontFamily)edocEl.style.setProperty('--ebook-font',e.fontFamily);
  if(typeof atlasUpdateResultHeader==='function')atlasUpdateResultHeader(e);
}

/* 2026-08-10: 사용자 지시로 썸네일/상세페이지/리스팅 자료 렌더링 전체(구
   ATLAS v0.2 KMONG THUMBNAIL/SALES/LISTING ENGINE, ~1150줄)를 삭제했다.
   renderCvEbook()과 그 위의 core 유틸(x/showToast/pad/copyPrompt 등)만
   남는다 — 이 파일들은 전자책 미리보기 자체가 계속 쓴다. */
