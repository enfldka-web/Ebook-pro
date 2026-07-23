/* ai-planner.js — Milestone 3.2 Phase 1(UI) + Phase 2(Brand Strategy Engine 연결)
   + Phase 3(Marketing Copy Engine 연결) + Phase 4(Thumbnail Engine 2.0 연결)
   + Phase 5(Sales Page Engine 2.0 연결)
   기준 문서: docs/ATLAS_AI_ENGINE_SPECIFICATION.md (Engine Specification v2 FINAL)

   Phase 1 범위: AI Planner 화면, Planner Report(JSON) 생성, BrandProfile 생성(Read Only),
   BrandProfile Context 연결, 제목 잠금 → Planner → 승인 → 전자책 생성 흐름 전환.
   Phase 2 범위: Planner Report의 추천 전략/추천 Brand/추천 이유를 js/brand-strategy-engine.js의
   실제 계산 결과로 채운다(Phase 1의 고정 Placeholder 제거). Confidence가 높으면 후보를
   자동 선택하고, 낮으면 Phase 1처럼 사용자가 직접 선택해야 한다.
   Phase 3 범위: Brand Pack 후보를 선택하면 js/marketing-copy-engine.js가 그 후보의
   BrandProfile로 Marketing Copy Asset Pool을 만들고, Planner의 추천 CTA/Headline·Hook
   요약/FAQ 전략 요약/주의사항을 그 실제 결과로 채운다.
   Phase 4 범위: 같은 후보 선택 시점에 js/thumbnail-engine.js가 BrandProfile +
   Marketing Copy Asset Pool로 Thumbnail Blueprint(레이아웃/배치/색상 전략, 이미지 생성
   아님)를 만들고, Planner의 추천 Thumbnail Pattern을 그 실제 결과로 채운다.
   Phase 5 범위: 같은 후보 선택 시점에 js/sales-page-engine.js가 BrandProfile +
   Marketing Copy Asset Pool로 Sales Page Blueprint(고정 7섹션 순서/강조/레이아웃,
   HTML·렌더링 아님)를 만들고, Planner에 Sales Page Blueprint 요약 카드를 추가한다.
   승인 시 이미 계산된 Asset Pool/Blueprint 3종을 APP.marketingCopy/
   APP.thumbnailBlueprint/APP.salesPageBlueprint로 확정 저장한다(다시 계산하지 않음
   — Reasoning Service 중복 기록 방지).

   구현하지 않는 것(Engine Specification의 다른 Engine): Learning Engine, Session
   Memory, AI가 스스로 전략/카피/레이아웃을 판단해 생성하는 로직(실제 Claude API 호출·
   이미지·HTML 렌더링 없음). 네 Engine 모두 규칙 기반이다. */

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

  AIP.state = { report:null, selectedBrandPackId:null, marketingCopy:null, thumbnailBlueprint:null, salesPageBlueprint:null };

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

  /* ── Planner Report(JSON) 생성 ──
     docs/ATLAS_AI_ENGINE_SPECIFICATION.md §4 Planner Report 8개 항목을 그대로 채운다.
     추천 전략/추천 Brand/추천 이유는 js/brand-strategy-engine.js의 실제 계산 결과를 쓴다
     (Phase 2) — Placeholder 문구는 더 이상 만들지 않는다. 자동 선택 여부(engine.autoRecommended)
     판단은 이 파일에서 다시 계산하지 않고 Engine이 내린 결론을 그대로 따른다(매직 넘버를
     여러 파일에 중복시키지 않기 위해 임계치는 brand-strategy-engine.js에만 둔다). */
  function buildPlannerReport(){
    var title=APP.lockedTitle||'', subtitle=APP.lockedSubtitle||'';
    var idx=typeof APP.selectedTitleIndex==='number'?APP.selectedTitleIndex:-1;
    var candidate=(APP.titleCandidates||[])[idx]||{};
    var analysis=APP.titleAnalysis||APP.smartAnalysis||{};

    var engineInput = {
      topic: analysis.topic||'', target: analysis.target||'', pain: analysis.pain||'',
      angle: analysis.angle||'', sourceSummary: analysis.sourceSummary||'',
      titleType: candidate.type||''
    };
    var engine = AtlasBrandStrategyEngine.run(engineInput);

    return {
      version:1,
      productSummary: (analysis.topic?('주제: '+analysis.topic+'. '):'')+(title?('잠긴 제목: "'+title+'"'+(subtitle?' — '+subtitle:'')):'제목이 아직 잠기지 않았습니다.'),
      engine: engine,
      cautions: [
        '이 기획안은 자동으로 확정되지 않습니다 — 승인해야 전자책 생성이 시작됩니다.',
        '승인 후 만들어지는 BrandProfile은 이후 수정할 수 없습니다. 다른 Brand Pack이 필요하면 이 화면으로 돌아와 다시 선택해야 합니다.',
        engine.strategy===null?'분석 근거가 충분하지 않아 자동 추천하지 않았습니다.':(!engine.autoRecommended?'Brand Pack이 자동 선택 기준을 충족하지 않아 자동 선택되지 않았습니다 — 아래 후보 중 직접 선택해주세요.':''),
        candidate.type?('선택한 제목 유형: '+candidate.type):''
      ].filter(Boolean)
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

  /* 현재 선택된 Brand Pack 후보의 BrandProfile로 Marketing Copy Asset Pool(Phase 3)과
     Thumbnail Blueprint(Phase 4)를 계산한다. 후보를 바꿀 때마다 다시 계산되며, 매번
     Reasoning Service에 정확히 한 번씩 기록된다 — 이 기록은 승인 전까지 화면에 표시되는
     "현재 이 결과가 왜 나왔는지"와 항상 일치해야 하므로, 후보가 바뀔 때마다 다시
     기록하는 것이 맞다(Brand Strategy Engine처럼 Planner 진입 시 1회만 기록하는 것과는
     다른 성격의 결정이다). Thumbnail Engine은 Marketing Copy Asset Pool을 입력으로
     받으므로 반드시 이 순서(카피 먼저 → Thumbnail 나중)로 호출한다. */
  function computeMarketingCopyForSelection(){
    var sel=AIP.state.selectedBrandPackId;
    if(!sel){ AIP.state.marketingCopy=null; AIP.state.thumbnailBlueprint=null; AIP.state.salesPageBlueprint=null; return; }
    var title=APP.lockedTitle||'', subtitle=APP.lockedSubtitle||'';
    var analysis=APP.titleAnalysis||APP.smartAnalysis||{};
    var previewProfile=createBrandProfile(sel);
    var copyInput={ topic:analysis.topic||'', target:analysis.target||'', pain:analysis.pain||'', angle:analysis.angle||'', title:title, subtitle:subtitle };
    AIP.state.marketingCopy = (typeof AtlasMarketingCopyEngine!=='undefined') ? AtlasMarketingCopyEngine.run(previewProfile, copyInput) : null;
    AIP.state.thumbnailBlueprint = (typeof AtlasThumbnailEngine!=='undefined' && AIP.state.marketingCopy) ? AtlasThumbnailEngine.run(previewProfile, AIP.state.marketingCopy) : null;
    AIP.state.salesPageBlueprint = (typeof AtlasSalesPageEngine!=='undefined' && AIP.state.marketingCopy) ? AtlasSalesPageEngine.run(previewProfile, AIP.state.marketingCopy) : null;
  }

  /* Planner Report를 카드 UI로 표시한다. 순서: 추천 전략 → Confidence → 추천 Brand →
     추천 Thumbnail Pattern → 추천 Sales Page 구조 → 추천 CTA → Headline/Hook → FAQ 전략
     → 주의사항. 뒤의 세 카드(추천 CTA/Headline·Hook/FAQ 전략)는 Phase 3부터 BrandProfile
     기본값이 아니라 Marketing Copy Engine이 실제로 생성한 Asset Pool 값을 보여준다. */
  function renderReport(){
    var r=AIP.state.report; if(!r) return;
    var body=document.getElementById('aip-report-body'); if(!body) return;
    var sel=AIP.state.selectedBrandPackId;
    var d=sel?BRAND_PROFILE_DEFAULTS[sel]:null;
    var engine=r.engine;

    computeMarketingCopyForSelection();
    var copy=AIP.state.marketingCopy;
    var blueprint=AIP.state.thumbnailBlueprint;
    var salesBlueprint=AIP.state.salesPageBlueprint;

    function card(label, value, extraClass, caption){
      return '<div class="aip-card'+(extraClass?' '+extraClass:'')+'">'
        +'<div class="aip-card-label">'+label+'</div>'
        +'<div class="aip-card-value">'+value+'</div>'
        +(caption?'<div class="aip-card-caption">'+caption+'</div>':'')
        +'</div>';
    }

    var cautions=r.cautions.slice();
    if(copy){
      if(!copy.trust) cautions.push(copy.metadata.trustWithheldReason);
      if(!copy.scarcity) cautions.push(copy.metadata.scarcityWithheldReason);
      if(!copy.urgency) cautions.push(copy.metadata.urgencyWithheldReason);
    }

    body.innerHTML=
      card('추천 전략', engine.strategy===null?x('판단 보류'):x(engine.strategy))
      + card('Confidence', '<div class="aip-confidence"><div class="aip-confidence-bar"><div class="aip-confidence-fill" style="width:'+engine.confidence+'%"></div></div><div class="aip-confidence-pct">'+engine.confidence+'%</div></div>', '', 'Brand Strategy Engine 계산값 (Evidence Strength/Decision Margin 기반)')
      + card('추천 Brand', engine.recommendedBrandPackId?x(brandPackLabel(engine.recommendedBrandPackId)):x('직접 선택 필요'), '', '이유 출처: Reasoning Service (아래 "추천 이유 보기" 참고)')
      + card('추천 Thumbnail Pattern', blueprint?x(blueprint.pattern):x(NEEDS_SELECTION_TEXT), '', blueprint?'Thumbnail Engine 생성값 (이유 출처: Reasoning Service)':'')
      + card('추천 Sales Page 구조', salesBlueprint?x(salesBlueprint.sectionOrder.join(' → ')):x(NEEDS_SELECTION_TEXT), '', salesBlueprint?('강조: '+x(salesBlueprint.visualHierarchy[0])+' · 이유 출처: Reasoning Service'):'')
      + card('추천 CTA', copy?x(copy.cta):x(NEEDS_SELECTION_TEXT), '', copy?'Marketing Copy Engine 생성값 (동사 고정: '+x(copy.metadata.ctaVerb)+')':'')
      + card('Headline / Hook', copy?(x(copy.headline)+'<br><span style="font-weight:400">'+x(copy.hook)+'</span>'):x(NEEDS_SELECTION_TEXT))
      + card('FAQ 전략', copy?(copy.faqs.length+'개 · '+x(d.faqStyle)):x(NEEDS_SELECTION_TEXT))
      + card('Thumbnail Blueprint 요약', blueprint?(
          'Headline '+x(blueprint.headlinePosition)+' · Badge '+x(blueprint.badgePosition)+' · CTA '+x(blueprint.ctaPosition)+'<br>'
          +'<span style="font-weight:400">Color '+x(blueprint.colorStrategy)+' · Icon '+x(blueprint.iconStyle)+' · Image '+x(blueprint.imageStyle)+'</span>'
        ):x(NEEDS_SELECTION_TEXT))
      + card('Sales Page Blueprint 요약', salesBlueprint?(
          'Layout '+x(salesBlueprint.layoutStrategy)+' · Benefits '+x(salesBlueprint.benefitsLayout)+' · FAQ '+x(salesBlueprint.faqLayout)+'<br>'
          +'<span style="font-weight:400">Social Proof: '+(salesBlueprint.sections.filter(function(s){return s.name==='Social Proof';})[0].hasContent?'포함':'비워둠')+'</span>'
        ):x(NEEDS_SELECTION_TEXT))
      + card('주의사항', '<ul class="aip-cautions">'+cautions.map(function(c){return '<li>'+x(c)+'</li>';}).join('')+'</ul>', 'aip-card-full');

    var approveBtn=document.getElementById('aip-approve-btn');
    if(approveBtn) approveBtn.disabled=!sel;

    renderReasonAccordionContent();
  }

  /* ── "추천 이유 보기" 아코디언 ──
     Reasoning Service가 실제로 기록한 값을 그대로 보여준다 — Reasoning Service는
     판단하지 않으므로, 여기 나오는 문장은 전부 각 Engine의 Reason Generator가 이미
     만든 것을 그대로 옮긴 것이다. Brand Strategy Engine과 Marketing Copy Engine이
     각각 독립적으로 Reason()을 호출하므로, RS.latest()(가장 최근 아무 기록) 대신
     source별로 최신 기록을 따로 조회해 두 섹션으로 보여준다 — 그래야 Marketing Copy
     Engine의 기록이 Brand Strategy Engine의 기존 섹션을 덮어쓰지 않는다. */
  function renderReasonSection(title, recorded){
    if(!recorded) return '';
    return '<div class="aip-reason-section-title">'+x(title)+'</div>'
      +'<ul class="aip-reason-list">'+recorded.reasons.map(function(reason){return '<li>'+x(reason)+'</li>';}).join('')+'</ul>'
      +'<div class="aip-reason-note">Reasoning Service 기록 · '+new Date(recorded.recordedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</div>';
  }
  function renderReasonAccordionContent(){
    var container=document.getElementById('aip-reason-content'); if(!container) return;
    if(typeof AtlasReasoningService==='undefined'){ container.innerHTML=''; return; }
    var strategyRecord=AtlasReasoningService.latestBySource('BrandStrategyEngine');
    var copyRecord=AtlasReasoningService.latestBySource('MarketingCopyEngine');
    var thumbnailRecord=AtlasReasoningService.latestBySource('ThumbnailEngine');
    var salesPageRecord=AtlasReasoningService.latestBySource('SalesPageEngine');
    container.innerHTML=
      renderReasonSection('Brand Strategy 판단 근거', strategyRecord)
      + renderReasonSection('Marketing Copy 판단 근거', copyRecord)
      + renderReasonSection('Thumbnail 판단 근거', thumbnailRecord)
      + renderReasonSection('Sales Page 판단 근거', salesPageRecord);
  }

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
    var engine=AIP.state.report.engine;
    /* engine.autoRecommended === true일 때만 추천 후보를 미리 선택해 둔다(원클릭 승인).
       신호가 없거나(strategy null) 자동 선택 기준을 채우지 못하면 아무것도 선택하지
       않아, 사용자가 아래 후보 카드 중 하나를 직접 골라야만 승인 버튼이 활성화된다. */
    AIP.state.selectedBrandPackId = engine.autoRecommended ? engine.recommendedBrandPackId : null;
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
    /* AIP.state.marketingCopy/thumbnailBlueprint/salesPageBlueprint는 이 sel로
       renderReport()가 이미 계산해 둔 값이다(같은 BrandProfile 조합이면 결과가
       동일하므로) — 승인 시점에 다시 계산해 Reasoning Service에 중복 기록하지 않고
       그대로 확정 저장한다. */
    APP.marketingCopy=AIP.state.marketingCopy;
    APP.thumbnailBlueprint=AIP.state.thumbnailBlueprint;
    APP.salesPageBlueprint=AIP.state.salesPageBlueprint;
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
    startGenerate(true);
  };

  AIP.reset=function(){
    AIP.state.report=null;
    AIP.state.selectedBrandPackId=null;
    AIP.state.marketingCopy=null;
    AIP.state.thumbnailBlueprint=null;
    AIP.state.salesPageBlueprint=null;
    APP.brandProfile=null;
    APP.plannerReport=null;
    APP.marketingCopy=null;
    APP.thumbnailBlueprint=null;
    APP.salesPageBlueprint=null;
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
  };

})(window.AtlasAIPlanner);
