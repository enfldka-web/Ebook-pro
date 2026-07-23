/* ai-planner.js — Milestone 3.2 Phase 1: AI Planner UI
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md (Engine Specification v2 FINAL)

   이번 Phase 범위: AI Planner 화면, Planner Report(JSON) 생성, BrandProfile 생성(Read Only),
   BrandProfile Context 연결, 제목 잠금 → Planner → 승인 → 전자책 생성 흐름 전환까지만 구현한다.

   구현하지 않는 것(Engine Specification의 다른 Engine): Marketing Copy Engine, Thumbnail/Sales
   Page Engine의 자동 판단, Learning Engine, Reasoning Service 내부 로직, AI가 스스로 전략을
   판단해 생성하는 로직. Brand Strategy Engine의 실제 AI 판단은 이번 Phase에 포함되지 않으므로,
   Planner Report는 항상 사용자가 Brand Pack 후보 중 하나를 직접 선택하는 형태로 동작한다 —
   선택하지 않은 근거를 꾸며내지 않는다(Never Guess / Never Hide). */

window.AtlasAIPlanner = window.AtlasAIPlanner || {};

(function(AIP){

  /* docs/ATLAS_AI_ENGINE_SPECIFICATION.md §5 "Brand Pack별 기본값" 표를 그대로 인코딩한다.
     이 표는 BrandProfile을 만드는 유일한 데이터 출처다 — 여기 없는 값을 임의로 추가하지 않는다. */
  var BRAND_PROFILE_DEFAULTS = {
    premium: {
      brandStrategy:'Authority', badgeTone:'권위/한정', headlineTone:'단정적/전문가 톤',
      ctaTone:'자신감 있는 명령형', faqStyle:'반박 대응 중심', socialProofStyle:'숫자/권위자 인용',
      informationDensity:'높음', layoutPreference:'숫자중심', thumbnailPattern:'비교형/숫자형',
      salesPagePreference:'Authority/Solution 강조'
    },
    studyNote: {
      brandStrategy:'Trust', badgeTone:'신뢰/근거', headlineTone:'설명적/근거 제시 톤',
      ctaTone:'안심시키는 제안형', faqStyle:'근거/출처 중심', socialProofStyle:'데이터/스크린샷',
      informationDensity:'중간', layoutPreference:'텍스트중심', thumbnailPattern:'아이콘형',
      salesPagePreference:'FAQ/Social Proof 강조'
    },
    handwriting: {
      brandStrategy:'Relationship', badgeTone:'친근/공감', headlineTone:'대화체/친근 톤',
      ctaTone:'다정한 권유형', faqStyle:'공감/후기 중심', socialProofStyle:'실사용 후기/스토리',
      informationDensity:'낮음', layoutPreference:'목업중심', thumbnailPattern:'좌우이미지형',
      salesPagePreference:'Hero/Benefits 강조'
    }
  };
  AIP.brandProfileDefaults = BRAND_PROFILE_DEFAULTS;

  var BRAND_PACK_ORDER = ['premium','studyNote','handwriting'];

  AIP.state = { report:null, selectedBrandPackId:null };

  /* ── BrandProfile 생성(Read Only) ──
     docs/ATLAS_AI_ENGINE_SPECIFICATION.md §5 Immutable Rule: 생성된 이후 절대 수정하지 않는다.
     변경이 필요하면 이 함수를 다시 호출해 새 BrandProfile을 만드는 것 외의 방법은 없다. */
  function createBrandProfile(brandPackId){
    var defaults = BRAND_PROFILE_DEFAULTS[brandPackId];
    if(!defaults) return null;
    var profile = { brandPackId: brandPackId };
    Object.keys(defaults).forEach(function(k){ profile[k]=defaults[k]; });
    return Object.freeze(profile);
  }
  AIP.createBrandProfile = createBrandProfile;

  /* ── BrandProfile Context 연결 ──
     docs/ATLAS_AI_ENGINE_SPECIFICATION.md §5 Single Source of Truth: 모든 소비 Engine은 이
     접근자 하나만 통해 BrandProfile을 읽는다. 이번 Phase에서는 아직 그 어떤 Engine도 이 값을
     소비하지 않지만(Marketing Copy/Thumbnail/Sales Page Engine은 이번 Phase 범위 밖), 이후
     구현될 Engine들이 참조할 단일 진입점을 지금 만들어 둔다. */
  AIP.getBrandProfile = function(){ return (typeof APP!=='undefined' && APP.brandProfile) || null; };

  /* 화면에 표시되는 Confidence는 고정 Placeholder 값이다. 실제 계산 로직(Brand Strategy Engine의
     판단 신뢰도 산출)은 이번 개선에서도 구현하지 않는다 — 숫자는 항상 이 상수 하나다. */
  var PLACEHOLDER_CONFIDENCE_PCT = 85;

  /* ── Planner Report(JSON) 생성 ──
     docs/ATLAS_AI_ENGINE_SPECIFICATION.md §4 Planner Report 8개 항목을 그대로 채운다.
     Brand Strategy Engine의 실제 AI 판단 로직은 이번 Phase 범위가 아니므로, Brand Pack 추천은
     "AI가 판단한 결과"로 꾸미지 않고 사용자가 선택해야 하는 항목으로 명시한다. */
  function buildPlannerReport(){
    var title=APP.lockedTitle||'', subtitle=APP.lockedSubtitle||'';
    var idx=typeof APP.selectedTitleIndex==='number'?APP.selectedTitleIndex:-1;
    var candidate=(APP.titleCandidates||[])[idx]||{};
    var analysis=APP.titleAnalysis||APP.smartAnalysis||{};

    return {
      version:1,
      productSummary: (analysis.topic?('주제: '+analysis.topic+'. '):'')+(title?('잠긴 제목: "'+title+'"'+(subtitle?' — '+subtitle:'')):'제목이 아직 잠기지 않았습니다.'),
      strategy: null,
      brandPackId: null,
      brandPackReason: 'Brand Strategy Engine의 자동 판단은 이번 Phase 범위에 포함되지 않습니다. 아래 Brand Pack 후보 중 하나를 직접 선택해주세요.',
      faqStrategy: '선택한 Brand Pack의 BrandProfile.faqStyle을 따릅니다(아래 후보 카드에서 확인 가능).',
      ctaStrategy: '선택한 Brand Pack의 BrandProfile.ctaTone을 따릅니다(아래 후보 카드에서 확인 가능).',
      thumbnailPattern: '선택한 Brand Pack의 BrandProfile.thumbnailPattern을 따릅니다.',
      salesPageStructure: '선택한 Brand Pack의 BrandProfile.salesPagePreference를 따릅니다.',
      cautions: [
        '이 기획안은 자동으로 확정되지 않습니다 — 승인해야 전자책 생성이 시작됩니다.',
        '승인 후 만들어지는 BrandProfile은 이후 수정할 수 없습니다. 다른 Brand Pack이 필요하면 이 화면으로 돌아와 다시 선택해야 합니다.',
        candidate.type?('선택한 제목 유형: '+candidate.type):''
      ].filter(Boolean),
      confidence:'manual',
      confidencePct: PLACEHOLDER_CONFIDENCE_PCT
    };
  }
  AIP.buildPlannerReport = buildPlannerReport;

  function brandPackLabel(id){ var t=(typeof AtlasDesignSystem!=='undefined'&&AtlasDesignSystem.getTheme)?AtlasDesignSystem.getTheme(id):null; return t?t.name:id; }
  function brandPackTagline(id){ var t=(typeof AtlasDesignSystem!=='undefined'&&AtlasDesignSystem.getTheme)?AtlasDesignSystem.getTheme(id):null; return t?t.tagline:''; }
  function brandPackPalette(id){ var t=(typeof AtlasDesignSystem!=='undefined'&&AtlasDesignSystem.getTheme)?AtlasDesignSystem.getTheme(id):null; return t?t.palette:[]; }

  function renderCandidates(){
    var wrap=document.getElementById('aip-candidates'); if(!wrap) return;
    wrap.innerHTML=BRAND_PACK_ORDER.map(function(id){
      var defaults=BRAND_PROFILE_DEFAULTS[id];
      var selected=AIP.state.selectedBrandPackId===id;
      var swatches=brandPackPalette(id).map(function(c){return '<span class="aip-swatch" style="background:'+x(c)+'"></span>';}).join('');
      return '<div class="aip-candidate'+(selected?' selected':'')+'" onclick="AtlasAIPlanner.selectCandidate(\''+id+'\')">'
        +'<div class="aip-candidate-head"><span class="aip-candidate-name">'+x(brandPackLabel(id))+'</span>'+(selected?'<span class="aip-candidate-check">✓ 선택됨</span>':'')+'</div>'
        +'<div class="aip-candidate-tagline">'+x(brandPackTagline(id))+' · '+x(defaults.brandStrategy)+'</div>'
        +'<div class="aip-swatches">'+swatches+'</div>'
        +'<div class="aip-candidate-meta">CTA: '+x(defaults.ctaTone)+'</div>'
        +'<div class="aip-candidate-meta">FAQ: '+x(defaults.faqStyle)+'</div>'
        +'</div>';
    }).join('');
  }

  var NEEDS_SELECTION_TEXT='Brand Pack 후보를 선택하면 표시됩니다.';

  /* Planner Report를 카드 UI로 표시한다. 요청된 순서 그대로: 추천 전략 → Confidence → 추천
     Brand → 추천 Thumbnail Pattern → 추천 Sales Page 구조 → 추천 CTA → 주의사항. */
  function renderReport(){
    var r=AIP.state.report; if(!r) return;
    var body=document.getElementById('aip-report-body'); if(!body) return;
    var sel=AIP.state.selectedBrandPackId;
    var d=sel?BRAND_PROFILE_DEFAULTS[sel]:null;

    function card(label, value, extraClass, caption){
      return '<div class="aip-card'+(extraClass?' '+extraClass:'')+'">'
        +'<div class="aip-card-label">'+label+'</div>'
        +'<div class="aip-card-value">'+value+'</div>'
        +(caption?'<div class="aip-card-caption">'+caption+'</div>':'')
        +'</div>';
    }

    body.innerHTML=
      card('추천 전략', d?x(d.brandStrategy):x(NEEDS_SELECTION_TEXT))
      + card('Confidence', '<div class="aip-confidence"><div class="aip-confidence-bar"><div class="aip-confidence-fill" style="width:'+r.confidencePct+'%"></div></div><div class="aip-confidence-pct">'+r.confidencePct+'%</div></div>', '', 'Placeholder 값 — 실제 계산 로직은 아직 구현되지 않았습니다.')
      + card('추천 Brand', d?x(brandPackLabel(sel)):x(NEEDS_SELECTION_TEXT), '', '이유 출처: Reasoning Service (아래 "추천 이유 보기" 참고)')
      + card('추천 Thumbnail Pattern', d?x(d.thumbnailPattern):x(NEEDS_SELECTION_TEXT))
      + card('추천 Sales Page 구조', d?x(d.salesPagePreference):x(NEEDS_SELECTION_TEXT))
      + card('추천 CTA', d?x(d.ctaTone):x(NEEDS_SELECTION_TEXT))
      + card('주의사항', '<ul class="aip-cautions">'+r.cautions.map(function(c){return '<li>'+x(c)+'</li>';}).join('')+'</ul>', 'aip-card-full');

    var approveBtn=document.getElementById('aip-approve-btn');
    if(approveBtn) approveBtn.disabled=!sel;
  }

  /* ── "추천 이유 보기" 아코디언 ──
     Reasoning Service는 이번 개선에서도 구현하지 않는다. 실제 상품/시장/타겟 분석 결과를
     추론으로 연결하지 않고, 향후 Reasoning Service가 채울 자리라는 것만 보여주는 Placeholder다. */
  AIP.state.reasonOpen = false;
  AIP.toggleReasonAccordion=function(){
    AIP.state.reasonOpen = !AIP.state.reasonOpen;
    var body=document.getElementById('aip-reason-body');
    var arrow=document.getElementById('aip-reason-arrow');
    if(body) body.style.display = AIP.state.reasonOpen ? '' : 'none';
    if(arrow) arrow.style.transform = AIP.state.reasonOpen ? 'rotate(180deg)' : 'rotate(0deg)';
  };

  AIP.selectCandidate=function(brandPackId){
    AIP.state.selectedBrandPackId=brandPackId;
    renderCandidates();
    renderReport();
  };

  /* ── 화면 전환: 기존 Generate 흐름 변경 ──
     기존: 제목 잠금 → startGenerate(true)
     변경 후: 제목 잠금 → AIP.open()(Planner Report 확인) → 사용자 승인 → startGenerate(true) */
  AIP.open=function(){
    AIP.state.report=buildPlannerReport();
    AIP.state.selectedBrandPackId=null;
    AIP.state.reasonOpen=false;
    var titleState=document.getElementById('cv-title-state'); if(titleState)titleState.style.display='none';
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='';
    var reasonBody=document.getElementById('aip-reason-body'); if(reasonBody)reasonBody.style.display='none';
    var reasonArrow=document.getElementById('aip-reason-arrow'); if(reasonArrow)reasonArrow.style.transform='rotate(0deg)';
    renderCandidates();
    renderReport();
    if(typeof atlasSetWorkspaceStage==='function')atlasSetWorkspaceStage('planner',{coach:'AI Planner가 정리한 기획안을 확인하고 Brand Pack을 선택한 뒤 승인하세요.'});
    window.scrollTo(0,0);
  };

  AIP.backToTitle=function(){
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
    var titleState=document.getElementById('cv-title-state'); if(titleState)titleState.style.display='';
    if(typeof atlasSetWorkspaceStage==='function')atlasSetWorkspaceStage('title',{coach:'제목을 다시 선택하거나 그대로 다시 기획안으로 진행할 수 있습니다.'});
  };

  AIP.approve=function(){
    var sel=AIP.state.selectedBrandPackId;
    if(!sel){ if(typeof showToast==='function')showToast('error','Brand Pack 후보를 먼저 선택해주세요.'); return; }
    APP.brandProfile=createBrandProfile(sel);
    APP.plannerReport=AIP.state.report;
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
    startGenerate(true);
  };

  AIP.reset=function(){
    AIP.state.report=null;
    AIP.state.selectedBrandPackId=null;
    APP.brandProfile=null;
    APP.plannerReport=null;
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
  };

})(window.AtlasAIPlanner);
