/* thumbnail-studio-io.js — Milestone 2: Prompt Builder + Export (신규, 기존 코드 무수정) */
/* Prompt 생성 로직(순수 함수)과 UI 로직을 분리한다. 전역 노출은 ts* 래퍼만. */

(function(TS){

  var STYLE_PROMPT_MAP = {
    flat:'flat illustration style, clean vector shapes',
    photo:'realistic photography style',
    '3d':'3D rendered style, soft shadows',
    minimal:'minimal design, generous whitespace',
    business:'professional business style, corporate tone',
    korean:'Korean design sensibility, clean sans-serif typography'
  };
  var LAYOUT_PROMPT_MAP = {
    'left-image':'image area on the left, text content on the right',
    'right-image':'image area on the right, text content on the left',
    'center-text':'centered composition, large centered title',
    'number-focus':'large bold number as the focal visual element',
    'comparison':'split before/after comparison composition',
    'icon-focus':'a large circular icon or symbol as the focal visual element'
  };

  /* 순수 함수: DOM/전역 상태에 의존하지 않고 ctx만으로 프롬프트 문자열을 만든다. */
  function buildThumbnailPrompt(ctx){
    ctx = ctx || {};
    var parts = [];
    parts.push('Design a Korean eBook sales thumbnail image, 652x488px, 4:3 ratio.');
    if(ctx.title) parts.push('Main title text: "'+ctx.title+'".');
    if(ctx.hook) parts.push('Hook phrase: "'+ctx.hook+'".');
    if(ctx.subtitle) parts.push('Subtitle: "'+ctx.subtitle+'".');
    parts.push('Layout: '+(LAYOUT_PROMPT_MAP[ctx.layoutId]||'balanced composition')+'.');
    parts.push('Color theme: '+(ctx.colorName||'Blue')+'.');
    parts.push('Visual style: '+(STYLE_PROMPT_MAP[ctx.styleId]||'flat illustration style')+'.');
    parts.push('No exaggerated claims, no fake guarantees, no unrealistic numbers in the on-image text.');
    return parts.join(' ');
  }
  TS.buildPrompt = buildThumbnailPrompt; // 단위 테스트/재사용 가능하도록 노출

  function currentPromptContext(){
    var themes = (typeof TS_COLOR_THEMES!=='undefined') ? TS_COLOR_THEMES : [];
    var color = themes.filter(function(c){return c.id===TS.state.colorId;})[0] || themes[0] || {};
    var hook = TS.state.customHook || TS.state.hooks[TS.state.selectedHookIndex] || '';
    return {
      title: TS.state.mainTitle,
      hook: hook,
      subtitle: TS.state.subtitle,
      layoutId: TS.state.layoutId,
      colorId: TS.state.colorId,
      colorName: color.name || 'Blue',
      styleId: TS.state.styleId
    };
  }

  /* ── Prompt Builder UI ── */
  TS.renderPromptSection = function(){
    return '<div class="ts-section"><div class="ts-section-title">이미지 생성용 Prompt</div>'
      +'<textarea class="ts-prompt-box" id="ts-prompt-box" oninput="tsSetPrompt(this.value)">'+x(TS.state.prompt)+'</textarea>'
      +'<div class="ts-row"><button class="ts-btn" onclick="tsRegeneratePrompt()">↻ Prompt 다시 생성</button>'
      +'<button class="ts-btn" onclick="tsCopyPrompt()">📋 복사</button></div></div>';
  };

  /* renderPreviewOnly/render에서 호출됨: 사용자가 직접 수정하지 않은 동안에는 관련 필드가
     바뀔 때마다 자동으로 프롬프트를 다시 만든다. 직접 수정한 뒤에는 자동 갱신을 멈춘다. */
  TS.renderPromptOnly = function(){
    if(!TS.state.promptManuallyEdited){
      TS.state.prompt = buildThumbnailPrompt(currentPromptContext());
      if(typeof APP!=='undefined') APP.thumbnailStudio = TS.state;
    }
    var box = document.getElementById('ts-prompt-box');
    if(box && document.activeElement !== box) box.value = TS.state.prompt;
  };

  TS.setPrompt = function(v){
    TS.state.prompt = v;
    TS.state.promptManuallyEdited = true;
    if(typeof APP!=='undefined') APP.thumbnailStudio = TS.state;
  };

  TS.regeneratePrompt = function(){
    TS.state.promptManuallyEdited = false;
    TS.state.prompt = buildThumbnailPrompt(currentPromptContext());
    if(typeof APP!=='undefined') APP.thumbnailStudio = TS.state;
    var box = document.getElementById('ts-prompt-box');
    if(box) box.value = TS.state.prompt;
    if(typeof showToast==='function') showToast('success','Prompt를 다시 생성했습니다.');
  };

  TS.copyPrompt = function(){
    var text = TS.state.prompt || '';
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){
        if(typeof showToast==='function') showToast('success','Prompt를 복사했습니다.');
      }).catch(function(){
        if(typeof showToast==='function') showToast('error','복사 실패');
      });
    }
  };

  /* ── Export (기존 downloadKmongThumbnail의 html2canvas 사용 패턴을 재사용,
     캡처 대상은 새 DOM #ts-preview-canvas — 기존 #km-thumb-* 는 건드리지 않음).
     652×488 요구사항을 리터럴하게 만족시키기 위해 scale:1로 캡처한다
     (기존 크몽 엔진은 scale:2로 고해상도를 우선하지만, 그건 별개 기능이라 변경하지 않음). ── */
  TS.renderExportSection = function(){
    return '<div class="ts-section ts-export-row">'
      +'<button class="ts-btn" id="ts-export-png" onclick="tsExportPNG()">⬇ PNG 다운로드</button>'
      +'<button class="ts-btn" id="ts-export-jpg" onclick="tsExportJPG()">⬇ JPG 다운로드</button>'
      +'</div>';
  };

  function exportImage(format){
    if(typeof html2canvas==='undefined'){
      if(typeof showToast==='function') showToast('error','이미지 저장 기능을 아직 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    var el = document.getElementById('ts-preview-canvas');
    if(!el){
      if(typeof showToast==='function') showToast('error','미리보기를 먼저 만들어주세요.');
      return;
    }
    var btnId = format==='jpg' ? 'ts-export-jpg' : 'ts-export-png';
    var btn = document.getElementById(btnId);
    if(btn){ btn.disabled = true; btn.textContent = '저장 중...'; }
    html2canvas(el, {width:652, height:488, scale:1, useCORS:true, allowTaint:true, backgroundColor: format==='jpg' ? '#ffffff' : null})
      .then(function(canvas){
        var mime = format==='jpg' ? 'image/jpeg' : 'image/png';
        var ext = format==='jpg' ? 'jpg' : 'png';
        var a = document.createElement('a');
        a.download = 'thumbnail-studio-652x488.'+ext;
        a.href = canvas.toDataURL(mime, format==='jpg'?0.92:undefined);
        a.click();
        if(typeof showToast==='function') showToast('success','썸네일을 저장했습니다 ('+canvas.width+'×'+canvas.height+'px).');
      })
      .catch(function(err){
        if(typeof showToast==='function') showToast('error','저장 실패: '+err.message);
      })
      .finally(function(){
        if(btn){ btn.disabled = false; btn.textContent = format==='jpg' ? '⬇ JPG 다운로드' : '⬇ PNG 다운로드'; }
      });
  }

  TS.exportPNG = function(){ exportImage('png'); };
  TS.exportJPG = function(){ exportImage('jpg'); };

})(window.ThumbnailStudio);

function tsSetPrompt(v){ ThumbnailStudio.setPrompt(v); }
function tsRegeneratePrompt(){ ThumbnailStudio.regeneratePrompt(); }
function tsCopyPrompt(){ ThumbnailStudio.copyPrompt(); }
function tsExportPNG(){ ThumbnailStudio.exportPNG(); }
function tsExportJPG(){ ThumbnailStudio.exportJPG(); }
