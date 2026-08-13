/* js/thumbnail-templates.js — 2026-08-11 개정 2

   사용자가 실제로 GPT 이미지 생성으로 만든 참고 이미지 4장(BESTSELLER
   EDITORIAL/MARKETPLACE IMPACT/PROBLEM SOLVER/PUBLISHER PREMIUM)을 다시
   확인해 정확한 내용을 반영했다: 책 더미+데스크 램프(베스트셀러) / 쇼핑카트
   (마켓플레이스) / 퍼즐 조각+돋보기(문제 해결형) / 왕관+월계관(퍼블리셔
   프리미엄) 배경 위에 제목/부제/아이콘 4개 배지가 얹힌 구성이다.

   배경 그래픽은 실제 OpenAI 이미지 생성(server/image-gateway.js
   /api/image-gateway/generate)으로 만든다 — 비용이 발생하므로 사용자가 각
   카드에서 "AI 이미지 생성"을 직접 눌렀을 때만 호출된다(js/application.js
   atlasGenerateThumbnailAiBg). 이 파일은 그 결과(bgImageDataUrl)를 받아
   렌더링만 담당하는 순수 함수 모음이며, 아직 생성 전이거나 실패했을 때는
   테마 고유의 flat 그라디언트로 자연스럽게 대체된다(화면이 깨지지 않음).

   4개 테마 id/한글명은 참고 이미지 파일명 및 과거 js/thumbnail-theme-engine.js
   가 쓰던 정체성과 그대로 맞춘다: bestseller(베스트셀러 에디토리얼) /
   marketplace(마켓플레이스 임팩트) / problem(문제 해결형) / publisher(퍼블리셔
   프리미엄). 하단 아이콘 배지 4개의 라벨 텍스트는 참고 이미지에 실제로 적혀
   있던 문구를 그대로 옮겼다(Never-Guess — 지어내지 않음).

   4개 템플릿 전부 지금 실제로 완성된 APP.ebook의 title/subtitle/category만
   사용한다. 규격 652×488(4:3)은 이 프로젝트에서 이미 검증했던 Kmong 판매
   플랫폼 표준 썸네일 규격을 그대로 재사용한다. */

window.AtlasThumbnailTemplates = window.AtlasThumbnailTemplates || {};

(function(T){
  T.SIZE = { width: 652, height: 488 };

  T.LIST = [
    { id:'bestseller', name:'베스트셀러 에디토리얼', desc:'책 더미 + 데스크 램프, 다크 네이비 톤의 에디토리얼 사진 스타일' },
    { id:'marketplace', name:'마켓플레이스 임팩트',   desc:'쇼핑카트 일러스트, 크림 배경의 마켓플레이스 판매 스타일' },
    { id:'problem',     name:'문제 해결형',           desc:'퍼즐 조각 + 돋보기, 그린 배경의 솔루션 중심 스타일' },
    { id:'publisher',   name:'퍼블리셔 프리미엄',     desc:'왕관 + 월계관, 다크 네이비+골드의 프리미엄 엠블럼 스타일' }
  ];

  /* 참고 이미지에 실제로 적혀 있던 하단 4개 배지 라벨(지어내지 않음) +
     의미상 가장 가까운 기존 AtlasIcons 아이콘(js/atlas-icons.js, 새 아이콘을
     만들지 않고 이미 있는 것만 재사용). */
  T.THEME_ICONS = {
    bestseller: [ {icon:'briefcase', label:'전문성'}, {icon:'target', label:'설득'}, {icon:'sparkle', label:'끌어당김'}, {icon:'book', label:'스토리텔링'} ],
    marketplace: [ {icon:'rocket', label:'트렌드'}, {icon:'search', label:'분석'}, {icon:'compass', label:'전략'}, {icon:'checkCircle', label:'성과'} ],
    problem: [ {icon:'search', label:'문제분석'}, {icon:'compass', label:'해결전략'}, {icon:'target', label:'실전적용'}, {icon:'checkCircle', label:'결과달성'} ],
    publisher: [ {icon:'briefcase', label:'전문성'}, {icon:'lock', label:'신뢰'}, {icon:'crown', label:'프리미엄'}, {icon:'sparkle', label:'가치'} ]
  };

  function esc(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function icon(name,size){
    return (typeof AtlasIcons!=='undefined'&&AtlasIcons.svg) ? AtlasIcons.svg(name,{size:size||14}) : '';
  }
  function iconRow(tplId){
    var items = T.THEME_ICONS[tplId] || [];
    return '<div class="tt-icons">'+items.map(function(it){
      return '<div class="tt-icon-chip">'+icon(it.icon,15)+'<span>'+esc(it.label)+'</span></div>';
    }).join('')+'</div>';
  }
  /* bgImageDataUrl이 있으면 배경 이미지 + 텍스트 가독성용 어두운 스크림을,
     fontFamily가 있으면(전자책에서 고른 글씨체, js/application.js
     atlasThumbnailData()) 그 글씨체를 인라인 style로 얹는다 — 둘 다 같은
     루트 요소의 style 속성 하나로 합쳐야 한다(style 속성은 요소당 하나뿐).
     2026-08-12: 사용자 요청 — 썸네일 글씨체가 전자책에서 고른 글씨체와
     같아야 한다. */
  function rootStyleAttr(data){
    var decls = [];
    if(data.bgImageDataUrl){
      decls.push('background-image:linear-gradient(180deg,rgba(10,10,20,.15),rgba(10,10,20,.55)),url(&quot;'+data.bgImageDataUrl+'&quot;)');
      decls.push('background-size:cover');
      decls.push('background-position:center');
    }
    if(data.fontFamily) decls.push('font-family:'+data.fontFamily);
    return decls.length ? ' style="'+decls.join(';')+'"' : '';
  }
  function bgClass(data){ return data.bgImageDataUrl ? ' has-ai-bg' : ''; }
  /* 2026-08-12: 사용자 요청 — 썸네일 안의 제목/부제/배지/CTA 문구를 화면에서
     바로 클릭해 고칠 수 있어야 한다(전자책 편집 화면과 같은 철학). 아이콘
     배지 4개처럼 테마 정체성을 이루는 구조적 장식 요소는 전자책 편집 때와
     같은 이유로 편집 대상에서 제외한다 — 자유 텍스트만 고친다.
     data-atlas-thumb-field로 필드 종류를 표시하고, oninput은
     js/application.js의 atlasThumbnailFieldInput()이 처리한다(제목/부제/배지는
     4개 카드에 동일하게 동기화, CTA 문구는 테마마다 원래 다른 문구라 카드별로
     따로 저장). */
  function editAttrs(field){
    return ' contenteditable="true" data-atlas-thumb-field="'+field+'" oninput="atlasThumbnailFieldInput(this)"';
  }

  var ARROW_SVG = '<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">'
    +'<path d="M9 31 29 11" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
    +'<path d="M17 11h12v12" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    +'</svg>';

  function renderBestseller(data){
    return '<div class="thumb-tpl tt-bestseller'+bgClass(data)+'"'+rootStyleAttr(data)+'>'
      +'<div class="tt-badge"'+editAttrs('category')+'>'+esc(data.category||'베스트셀러 인사이트')+'</div>'
      +'<div class="tt-title"'+editAttrs('title')+'>'+esc(data.title)+'</div>'
      +(data.subtitle?'<div class="tt-subtitle"'+editAttrs('subtitle')+'>'+esc(data.subtitle)+'</div>':'')
      +(data.bgImageDataUrl?'':'<div class="tt-dots"><span></span><span></span><span></span></div>')
      +iconRow('bestseller')
      +'</div>';
  }

  function renderMarketplace(data){
    return '<div class="thumb-tpl tt-marketplace'+bgClass(data)+'"'+rootStyleAttr(data)+'>'
      +'<div class="tt-badge"'+editAttrs('category')+'>'+esc(data.category||'템플릿')+'</div>'
      +(data.bgImageDataUrl?'':'<div class="tt-mock"><div class="tt-mock-line l1"></div><div class="tt-mock-line l2"></div><div class="tt-mock-line l3"></div><div class="tt-mock-cta"></div></div>')
      +'<div class="tt-bottom">'
        +'<div class="tt-title"'+editAttrs('title')+'>'+esc(data.title)+'</div>'
        +(data.subtitle?'<div class="tt-subtitle"'+editAttrs('subtitle')+'>'+esc(data.subtitle)+'</div>':'')
        +'<div class="tt-cta"'+editAttrs('cta')+'>'+esc(data.cta||'바로 시작')+'</div>'
      +'</div>'
      +iconRow('marketplace')
      +'</div>';
  }

  function renderProblem(data){
    return '<div class="thumb-tpl tt-problem'+bgClass(data)+'"'+rootStyleAttr(data)+'>'
      +'<div class="tt-badge"'+editAttrs('category')+'>'+esc(data.category||'실전 가이드')+'</div>'
      +(data.bgImageDataUrl?'':'<div class="tt-arrow-wrap"><div class="tt-arrow-box"></div><div class="tt-arrow-icon">'+ARROW_SVG+'</div></div>')
      +'<div class="tt-bottom">'
        +'<div class="tt-title"'+editAttrs('title')+'>'+esc(data.title)+'</div>'
        +(data.subtitle?'<div class="tt-subtitle"'+editAttrs('subtitle')+'>'+esc(data.subtitle)+'</div>':'')
        +'<div class="tt-cta"'+editAttrs('cta')+'>'+esc(data.cta||'지금 확인하기')+'</div>'
      +'</div>'
      +iconRow('problem')
      +'</div>';
  }

  function renderPublisher(data){
    return '<div class="thumb-tpl tt-publisher'+bgClass(data)+'"'+rootStyleAttr(data)+'>'
      +(data.bgImageDataUrl?'':('<div class="tt-card-shadow"></div>'
        +'<div class="tt-card">'
          +'<div class="tt-card-rule"></div>'
          +'<div class="tt-card-ebook">EBOOK</div>'
          +'<div class="tt-card-line l1"></div><div class="tt-card-line l2"></div><div class="tt-card-line l3"></div>'
        +'</div>'))
      +'<div class="tt-bottom">'
        +'<div class="tt-title"'+editAttrs('title')+'>'+esc(data.title)+'</div>'
        +(data.subtitle?'<div class="tt-subtitle"'+editAttrs('subtitle')+'>'+esc(data.subtitle)+'</div>':'')
      +'</div>'
      +iconRow('publisher')
      +'</div>';
  }

  var RENDERERS = {
    bestseller: renderBestseller,
    marketplace: renderMarketplace,
    problem: renderProblem,
    publisher: renderPublisher
  };

  function renderOne(tplId, data){
    var fn = RENDERERS[tplId] || renderBestseller;
    return fn({ title: data.title||'', subtitle: data.subtitle||'', category: data.category||'', bgImageDataUrl: data.bgImageDataUrl||'', fontFamily: data.fontFamily||'', cta: data.cta||'' });
  }

  T.render = function(tplId, data){
    return renderOne(tplId, data||{});
  };

  T.renderAll = function(data){
    return T.LIST.map(function(tpl){ return { id: tpl.id, name: tpl.name, desc: tpl.desc, html: renderOne(tpl.id, data) }; });
  };

  /* 기존(삭제 전) 상세페이지 카드 PNG 저장(dlSpSlide)이 쓰던 것과 같은
     html2canvas 캡처 패턴 재사용 — 새 방식을 만들지 않는다. */
  T.downloadPng = function(containerEl, filename){
    if(typeof html2canvas==='undefined'){
      if(typeof showToast==='function')showToast('error','이미지 저장 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return Promise.resolve(false);
    }
    return html2canvas(containerEl,{ scale:2, useCORS:true, allowTaint:true }).then(function(canvas){
      var a=document.createElement('a');
      a.download=(filename||'thumbnail')+'.png';
      a.href=canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }).catch(function(err){
      if(typeof showToast==='function')showToast('error','썸네일 저장 실패: '+err.message);
      return false;
    });
  };

})(window.AtlasThumbnailTemplates);
