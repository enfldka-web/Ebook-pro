/* sales-page-studio-io.js — Milestone 3: 데이터 매핑 + Export (신규, 기존 코드 무수정) */
/* 기존 ebook/sales 데이터를 sections 배열로 변환하는 순수 helper와, PNG/ZIP Export를 담당한다.
   기존 dlSpSlide/dlAllSlides/downloadKmongLongPage는 참조만 하지 않고 완전히 독립적으로 재구현한다. */

(function(SPS){

  /* ── 전자책 식별 키 (결정적 생성, 랜덤 없음) ── */
  SPS.computeEbookKey = function(ebook){
    if(!ebook) return '';
    var title = String(ebook.title||'');
    var subtitle = String(ebook.subtitle||'');
    var chCount = (ebook.chapters||[]).length;
    return title+'|'+subtitle+'|'+chCount;
  };

  function lines(text){
    return String(text||'').split('\n').map(function(s){return s.trim();}).filter(Boolean);
  }

  var uid = 0;
  function newId(type){ uid++; return type+'-'+uid; }

  /* ── 기존 데이터를 8개 섹션으로 안전하게 매핑 (fallback 포함, 실제 API 신규 호출 없음) ── */
  SPS.buildSectionsFromEbook = function(ebook){
    ebook = ebook || {};
    var sales = ebook.sales || {};
    var chapters = ebook.chapters || [];

    var pains = (sales.pains && sales.pains.length) ? sales.pains : [
      {icon:'😩',title:'막막한 시작',desc:'어디서 시작할지 모릅니다'},
      {icon:'😤',title:'정보 과부하',desc:'무엇이 맞는지 알 수 없습니다'},
      {icon:'😞',title:'결과가 없다',desc:'열심히 해도 변화가 없습니다'}
    ];
    var painsBody = pains.map(function(p){
      var t = (p.icon?p.icon+' ':'')+(p.title||'');
      return p.desc ? (t+' — '+p.desc) : t;
    }).join('\n');

    var learnings = (sales.learnings && sales.learnings.length) ? sales.learnings
      : chapters.map(function(c){return c.title;}).filter(Boolean);
    if(!learnings.length) learnings = ['핵심 개념 이해와 즉시 실전 적용','전문 도구 없이 스스로 시작','지속 가능한 성장 구조 완성'];

    var before = (sales.before && sales.before.length) ? sales.before : ['방향 없이 반복','무엇부터 할지 모름','결과가 안 보임'];
    var after  = (sales.after && sales.after.length)  ? sales.after  : ['명확한 방향','즉시 적용','실질적 변화'];

    var targetLines = [];
    if(ebook.targetReader){
      targetLines = String(ebook.targetReader).split(/[,\n]/).map(function(s){return s.trim();}).filter(Boolean);
    }
    if(!targetLines.length) targetLines = ['처음 시작하는 초보자','체계적인 방법을 찾는 분','실전 적용이 필요한 분'];

    function mk(type, overrides){
      var def = SPS.sectionDef(type);
      var base = {
        id: newId(type),
        type: type,
        enabled: true,
        order: 0,
        title: '',
        body: '',
        badge: '',
        cta: '',
        layoutId: def.defaultLayoutId
      };
      for(var k in overrides){ base[k] = overrides[k]; }
      return base;
    }

    var sections = [
      mk('hero', {
        title: sales.hook || ebook.title || '',
        body: sales.subhook || ebook.subtitle || ebook.description || '',
        badge: ebook.category || '',
        cta: ''
      }),
      mk('pain', {
        title: '이런 고민 있으신가요?',
        body: painsBody
      }),
      mk('solution', {
        title: '해결책',
        body: sales.solution || ebook.description || '',
        cta: ''
      }),
      mk('toc', {
        title: '목차',
        enabled: chapters.length > 0
      }),
      mk('benefits', {
        title: '핵심 장점',
        body: learnings.join('\n')
      }),
      (function(){
        var s = mk('beforeAfter', { title: '비포 / 애프터' });
        s.beforeText = before.join('\n');
        s.afterText = after.join('\n');
        return s;
      })(),
      mk('targetAudience', {
        title: '이런 분께 추천합니다',
        body: targetLines.join('\n')
      }),
      mk('cta', {
        title: sales.finalPush || '지금 바로 시작하세요',
        body: '',
        cta: '지금 바로 읽기'
      })
    ];
    sections.forEach(function(s,i){ s.order = i+1; });
    return sections;
  };

  /* ── 안전한 파일명 생성 ── */
  SPS.sanitizeFilename = function(name){
    return String(name||'sales-page')
      .replace(/[\\/:*?"<>|]/g,'')
      .replace(/\s+/g,'-')
      .replace(/-+/g,'-')
      .replace(/^-|-$/g,'')
      .slice(0,60) || 'sales-page';
  };

  /* ── 개별 카드 PNG Export (기존 dlSpSlide와 동일한 html2canvas 파라미터: scale:2 → 1080×1350) ── */
  SPS._exportBusy = false;

  SPS.exportSectionPNG = function(sectionId, btn){
    if(SPS._exportBusy){ return; }
    if(typeof html2canvas==='undefined'){
      if(typeof showToast==='function') showToast('error','이미지 저장 기능을 아직 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    var el = document.getElementById('sps-card-'+sectionId);
    if(!el){
      if(typeof showToast==='function') showToast('error','카드를 찾을 수 없습니다. 상세페이지를 다시 확인해주세요.');
      return;
    }
    var s = SPS.state.sections.filter(function(v){return v.id===sectionId;})[0];
    var enabledOrdered = SPS.state.sections.filter(function(v){return v.enabled;}).sort(function(a,b){return a.order-b.order;});
    var idx = enabledOrdered.indexOf(s) + 1;
    var typeLabel = s ? s.type : 'section';

    SPS._exportBusy = true;
    if(btn){ btn.disabled = true; btn.textContent = '⏳ 저장 중...'; }
    html2canvas(el, {scale:2, useCORS:true, allowTaint:true}).then(function(canvas){
      var a = document.createElement('a');
      var num = idx>0 ? (idx<10?'0'+idx:''+idx) : '00';
      a.download = 'sales-'+num+'-'+typeLabel+'.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      if(typeof showToast==='function') showToast('success','카드를 저장했습니다 ('+canvas.width+'×'+canvas.height+'px).');
    }).catch(function(err){
      if(typeof showToast==='function') showToast('error','저장 실패: '+err.message);
    }).finally(function(){
      SPS._exportBusy = false;
      if(btn){ btn.disabled = false; btn.textContent = '⬇ PNG'; }
    });
  };

  /* ── 전체 ZIP Export (enabled 섹션만, 현재 화면 순서대로, 실패 시 성공으로 보고하지 않음) ── */
  SPS.exportAllZip = function(btn){
    if(SPS._exportBusy){ return; }
    if(typeof html2canvas==='undefined'){
      if(typeof showToast==='function') showToast('error','이미지 저장 기능을 아직 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if(typeof JSZip==='undefined'){
      if(typeof showToast==='function') showToast('error','ZIP 생성 기능을 아직 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    var enabledOrdered = SPS.state.sections.filter(function(v){return v.enabled;}).sort(function(a,b){return a.order-b.order;});
    if(!enabledOrdered.length){
      if(typeof showToast==='function') showToast('error','활성화된 섹션이 없습니다.');
      return;
    }

    SPS._exportBusy = true;
    var orig = btn ? btn.textContent : '';
    var zip = new JSZip();
    var failed = [];
    var i = 0;

    function next(){
      if(i >= enabledOrdered.length){
        finish();
        return;
      }
      var s = enabledOrdered[i];
      var num = (i+1)<10 ? '0'+(i+1) : ''+(i+1);
      if(btn) btn.textContent = '⏳ '+(i+1)+'/'+enabledOrdered.length+' 저장 중...';
      var el = document.getElementById('sps-card-'+s.id);
      if(!el){
        failed.push(s.type);
        i++; next();
        return;
      }
      html2canvas(el, {scale:2, useCORS:true, allowTaint:true}).then(function(canvas){
        return new Promise(function(resolve){
          canvas.toBlob(function(blob){
            if(blob) zip.file('sales-'+num+'-'+s.type+'.png', blob);
            else failed.push(s.type);
            resolve();
          }, 'image/png');
        });
      }).catch(function(){
        failed.push(s.type);
      }).finally(function(){
        i++; next();
      });
    }

    function finish(){
      if(failed.length){
        SPS._exportBusy = false;
        if(btn){ btn.disabled = false; btn.textContent = orig; }
        if(typeof showToast==='function') showToast('error','일부 카드 저장에 실패했습니다('+failed.join(', ')+'). 전체 ZIP은 만들지 않았습니다.');
        return;
      }
      zip.generateAsync({type:'blob'}).then(function(blob){
        var titleBase = (typeof APP!=='undefined' && APP.ebook && APP.ebook.title) ? APP.ebook.title : 'sales-page';
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.download = SPS.sanitizeFilename(titleBase)+'-sales-page.zip';
        a.href = url;
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        if(typeof showToast==='function') showToast('success','전체 '+enabledOrdered.length+'장을 ZIP으로 저장했습니다.');
      }).catch(function(err){
        if(typeof showToast==='function') showToast('error','ZIP 생성 실패: '+err.message);
      }).finally(function(){
        SPS._exportBusy = false;
        if(btn){ btn.disabled = false; btn.textContent = orig; }
      });
    }

    if(btn) btn.disabled = true;
    next();
  };

})(window.SalesPageStudio);

function spsExportSectionPNG(sectionId, btn){ SalesPageStudio.exportSectionPNG(sectionId, btn); }
function spsExportAllZip(btn){ SalesPageStudio.exportAllZip(btn); }
