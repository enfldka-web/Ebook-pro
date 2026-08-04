/* Atlas Redesign Phase 2 — State System Foundation.
   Centralized, reusable, presentation-only rendering for the 9 interaction
   states (Empty/Loading/Processing/Success/Error/Disabled/No Results/
   Validation/Retry). Every screen calls into this module instead of hand-
   rolling its own markup — this does not decide WHEN a state fires, only
   HOW it is shown. Trigger conditions live where they already lived. */
window.AtlasStateSystem = (function(){
  'use strict';

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* Processing — reused across Thumbnail/Sales Page card status badges.
     Centralized here (previously duplicated inline in image-generation-ui.js). */
  var PROCESSING_LABEL = { planned:'기획 완료', queued:'대기 중', processing:'생성 중...', completed:'완료', failed:'실패', cancelled:'취소됨' };
  var PROCESSING_COLOR = { planned:'#7c3aed', queued:'#6b7280', processing:'#2563eb', completed:'#16a34a', failed:'#dc2626', cancelled:'#6b7280' };

  var S = {};

  S.processingBadge = function(status){
    if(!status) return '';
    return '<span class="atlas-state-badge" style="color:'+(PROCESSING_COLOR[status]||'#6b7280')+'">'+esc(PROCESSING_LABEL[status]||status)+'</span>';
  };

  /* Empty — wraps the UI Kit's canonical .a2-empty component
     (css/styles.css) so every screen builds it the same way. opts.icon is
     an AtlasIcons name (data-icon), not raw emoji/markup — callers must
     re-run AtlasIcons.applyAll(root) after inserting this markup. */
  S.empty = function(opts){
    opts = opts || {};
    return '<div class="a2-empty">'
      + '<div class="a2-empty-icon" data-icon="' + esc(opts.icon || 'sparkle') + '" data-icon-size="44"></div>'
      + '<div class="a2-empty-title">' + esc(opts.title || '') + '</div>'
      + (opts.sub ? '<div class="a2-empty-sub">' + esc(opts.sub) + '</div>' : '')
      + (opts.actionHtml || '')
      + '</div>';
  };

  /* No Results — distinct from Empty: an attempt was made and produced
     nothing yet, as opposed to nothing having been attempted. */
  S.noResults = function(opts){
    opts = opts || {};
    return '<div class="atlas-state-noresults">'
      + '<span class="atlas-state-noresults-text">' + esc(opts.text || '아직 생성된 결과가 없습니다.') + '</span>'
      + (opts.actionHtml ? (' ' + opts.actionHtml) : '')
      + '</div>';
  };

  S.errorMessage = function(text){
    return '<div class="atlas-state-error">' + esc(text || '오류가 발생했습니다.') + '</div>';
  };

  /* Retry — a short, explicit label to use on an action button when the
     previous attempt at that same action failed, so recovery reads as
     recovery rather than a fresh, unrelated action. */
  S.retryLabel = function(baseLabel){
    return '다시 시도' + (baseLabel ? ' · ' + esc(baseLabel) : '');
  };

  /* Disabled — a control stays visible with a reason, per providerStatusBannerHtml's
     existing pattern (js/image-generation-ui.js), adopted here as the shared standard. */
  S.disabledReason = function(text, tone){
    if(!text) return '';
    return '<div class="atlas-state-disabled atlas-state-disabled-' + (tone || 'warn') + '">' + esc(text) + '</div>';
  };

  /* Loading — a lightweight inline indicator for short waits, distinct from
     the heavier Processing pattern (progress circle/step banner/card badges). */
  S.loadingInline = function(text){
    return '<span class="atlas-state-loading"><span class="atlas-state-spinner"></span>' + esc(text || '불러오는 중...') + '</span>';
  };

  S.validationMessage = function(text, tone){
    if(!text) return '';
    return '<div class="atlas-state-validation atlas-state-validation-' + (tone || 'warn') + '">' + esc(text) + '</div>';
  };

  return S;
})();
