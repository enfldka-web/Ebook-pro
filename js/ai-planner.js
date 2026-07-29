/* ai-planner.js — Milestone 3.2 Phase 1(UI) + Phase 2(Brand Strategy Engine 연결)
   + Phase 3(Marketing Copy Engine 연결) + Phase 4(Thumbnail Engine 2.0 연결)
   + Phase 5(Sales Page Engine 2.0 연결) + Phase 6(Ebook Engine 연결)
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
   Phase 6 범위: js/ebook-engine.js가 기존 파이프라인의 "Generation" 단계를 구체화해
   Ebook Blueprint(문체/밀도/CTA/FAQ 통합 가이드라인 — 실제 본문 생성이나 Claude API
   호출 아님)를 만들고, Planner에 Ebook Blueprint 요약 카드를 추가한다. 승인 시 이미
   계산된 Asset Pool/Blueprint 4종을 APP.marketingCopy/APP.thumbnailBlueprint/
   APP.salesPageBlueprint/APP.ebookBlueprint로 확정 저장한다(다시 계산하지 않음 —
   Reasoning Service 중복 기록 방지).

   구현하지 않는 것(Engine Specification의 다른 Engine): Learning Engine, Session
   Memory, AI가 스스로 전략/카피/레이아웃/본문을 판단해 생성하는 로직(실제 Claude API
   호출·이미지·HTML 렌더링 없음). 다섯 Engine 모두 규칙 기반이다. */

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

  AIP.state = { report:null, selectedBrandPackId:null, marketingCopy:null, thumbnailBlueprint:null, salesPageBlueprint:null, ebookBlueprint:null, visualPromptSet:null, creativeCampaign:null };

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
    if(!sel){ AIP.state.marketingCopy=null; AIP.state.thumbnailBlueprint=null; AIP.state.salesPageBlueprint=null; AIP.state.ebookBlueprint=null; AIP.state.visualPromptSet=null; AIP.state.creativeCampaign=null; return; }
    var title=APP.lockedTitle||'', subtitle=APP.lockedSubtitle||'';
    var analysis=APP.titleAnalysis||APP.smartAnalysis||{};
    var previewProfile=createBrandProfile(sel);
    var copyInput={ topic:analysis.topic||'', target:analysis.target||'', pain:analysis.pain||'', angle:analysis.angle||'', title:title, subtitle:subtitle };
    AIP.state.marketingCopy = (typeof AtlasMarketingCopyEngine!=='undefined') ? AtlasMarketingCopyEngine.run(previewProfile, copyInput) : null;
    AIP.state.thumbnailBlueprint = (typeof AtlasThumbnailEngine!=='undefined' && AIP.state.marketingCopy) ? AtlasThumbnailEngine.run(previewProfile, AIP.state.marketingCopy) : null;
    AIP.state.salesPageBlueprint = (typeof AtlasSalesPageEngine!=='undefined' && AIP.state.marketingCopy) ? AtlasSalesPageEngine.run(previewProfile, AIP.state.marketingCopy) : null;
    AIP.state.ebookBlueprint = (typeof AtlasEbookEngine!=='undefined' && AIP.state.marketingCopy) ? AtlasEbookEngine.run(previewProfile, AIP.state.marketingCopy, AIP.state.thumbnailBlueprint, AIP.state.salesPageBlueprint) : null;
    /* Phase 11: AI Visual Prompt Engine — 이미지를 생성하지 않고, 위에서 이미 계산된
       BrandProfile/Marketing Copy/Thumbnail·Sales Page Blueprint(전부 읽기 전용)를
       입력으로 구조화된 이미지 생성 프롬프트 세트만 만든다. */
    AIP.state.visualPromptSet = (typeof AtlasAIVisualPromptEngine!=='undefined' && AIP.state.marketingCopy) ? AtlasAIVisualPromptEngine.run({
      topic: analysis.topic||'', targetAudience: analysis.target||'', sourceSummary: analysis.sourceSummary||'',
      brandProfile: previewProfile, marketingCopy: AIP.state.marketingCopy,
      thumbnailBlueprint: AIP.state.thumbnailBlueprint, salesPageBlueprint: AIP.state.salesPageBlueprint,
      ebookBlueprint: AIP.state.ebookBlueprint, userAssets: []
    }) : null;
    /* Phase 12: Creative Campaign Engine — Phase 11.5의 결과(visualPromptSet)를
       읽기 전용 입력으로만 사용하고 절대 재계산하지 않는다. 캠페인 전략/Big Idea/
       Thumbnail Creative Brief/Sales Page Storyboard/Claude Design Brief만 그
       위에 추가로 만든다. */
    AIP.state.creativeCampaign = (typeof AtlasCreativeCampaignEngine!=='undefined' && AIP.state.visualPromptSet) ? AtlasCreativeCampaignEngine.run({
      topic: analysis.topic||'', targetAudience: analysis.target||'', sourceSummary: analysis.sourceSummary||'',
      brandProfile: previewProfile, marketingCopy: AIP.state.marketingCopy,
      thumbnailBlueprint: AIP.state.thumbnailBlueprint, salesPageBlueprint: AIP.state.salesPageBlueprint,
      ebookBlueprint: AIP.state.ebookBlueprint, visualPromptSet: AIP.state.visualPromptSet
    }) : null;
  }

  /* Planner Report를 카드 UI로 표시한다. 순서: 추천 전략 → Confidence → 추천 Brand →
     추천 Thumbnail Pattern → 추천 Sales Page 구조 → 추천 CTA → Headline/Hook → FAQ 전략
     → 주의사항. 뒤의 세 카드(추천 CTA/Headline·Hook/FAQ 전략)는 Phase 3부터 BrandProfile
     기본값이 아니라 Marketing Copy Engine이 실제로 생성한 Asset Pool 값을 보여준다. */
  /* ── Phase 11: AI Visual Prompt Engine 결과 표시 helper ──
     전부 읽기 전용 표시일 뿐이며, 여기서 어떤 값도 다시 계산하거나 판단하지
     않는다 — AtlasAIVisualPromptEngine.run()이 이미 만든 결과를 그대로 보여준다. */
  function renderCategoryClassification(vps){
    var s = vps.visualStrategy;
    var sec = s.secondaryCategories && s.secondaryCategories.length ? s.secondaryCategories.join(', ') : '없음';
    var ev = s.categoryEvidence && s.categoryEvidence.length ? s.categoryEvidence.join(', ') : '없음(neutral)';
    var sources = s.evidenceSources && s.evidenceSources.length ? s.evidenceSources.join(', ') : '없음';
    return x(s.primaryCategory)+' <span style="font-weight:400;color:var(--text3)">(confidence '+s.categoryConfidence+')</span><br>'
      +'<span style="font-weight:400;font-size:12px">2차 후보: '+x(sec)+'<br>매칭 근거: '+x(ev)+'<br>evidenceSources: '+x(sources)+'<br>'+x(s.confidenceNote)+'</span>';
  }
  function renderRecommendedThumbnailPrompt(vps){
    var rec = vps.thumbnailPrompts.filter(function(p){return p.recommended;})[0] || vps.thumbnailPrompts[0];
    return x(rec.variantLabel)+' <span style="font-weight:400;color:var(--text3)">('+rec.normalizedScore+'/100)</span><br>'
      +'<span style="font-weight:400;font-size:12px">Base Art Direction: '+x(rec.baseArtDirection)+' → Effective: '+x(rec.effectiveArtDirection)+'</span><br>'
      +'<span style="font-weight:400;font-size:12px">'+x(rec.prompt)+'</span>';
  }
  function renderThumbnailCandidateList(vps){
    return '<ul class="aip-cautions">'+vps.thumbnailPrompts.slice().sort(function(a,b){return b.normalizedScore-a.normalizedScore;}).map(function(p){
      return '<li>'+(p.recommended?'✅ ':'')+x(p.variantLabel)+' — '+p.normalizedScore+'/100'
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Art Direction: '+x(p.effectiveArtDirection)+(p.effectiveArtDirection!==p.baseArtDirection?' (대표 스타일과 다름)':'')+'</div>'
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">'+x(p.reasons[0])+'</div></li>';
    }).join('')+'</ul>';
  }
  function renderStyleRanking(vps){
    var top3 = vps.visualStrategy.styleCandidates.slice(0,3);
    return '<div style="font-weight:400;font-size:12px">'+top3.map(function(s,i){
      return (i===0?'✅ ':(i+1)+'위 ')+x(s.style)+' — '+s.normalizedScore+'/100';
    }).join('<br>')+'</div>';
  }
  function renderSalesPromptSummary(vps){
    return '<ul class="aip-cautions">'+vps.salesPagePrompts.map(function(p){
      var safeAreaMatch = p.prompt.match(/Reserve[^.]*\./);
      var safeAreaLabel = p.safeArea ? (p.safeArea.anchor+' / '+p.safeArea.proportion+' (약 '+p.safeArea.approxPercent+'%)') : (safeAreaMatch?safeAreaMatch[0]:'');
      return '<li>'+p.pageNumber+'장 · '+x(p.role)+' — '+p.score+'점'
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Art Direction: '+x(p.effectiveArtDirection)+(p.effectiveArtDirection!==p.baseArtDirection?' (대표 스타일과 다름)':'')+'</div>'
        +(safeAreaLabel?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Safe Area: '+x(safeAreaLabel)+'</div>'):'')
        +(p.consistencyCarryover?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Consistency Carryover: '+x(p.consistencyCarryover.join(', '))+'</div>'):'')
        +'</li>';
    }).join('')+'</ul>';
  }
  function renderConsistencyRules(vps){
    var cr = vps.consistencyRules;
    var dna = cr.visualDNA || {};
    return '<div style="font-weight:400;font-size:12px">주인공/환경: '+x(cr.recurringSubject)+'<br>팔레트: '+x(cr.recurringPalette)+'<br>조명: '+x(cr.recurringLighting)+'<br>Mockup: '+x(cr.recurringProductMockup)+'</div>'
      +'<div style="font-weight:600;font-size:12px;margin-top:8px">Visual DNA</div>'
      +'<div style="font-weight:400;font-size:12px">인물 정체성: '+x(dna.characterIdentity)+'<br>오브젝트 언어: '+x(dna.objectLanguage)+'<br>재질 언어: '+x(dna.materialLanguage)+'<br>형태 언어: '+x(dna.shapeLanguage)+'<br>카메라 언어: '+x(dna.cameraLanguage)+'<br>질감 언어: '+x(dna.textureLanguage)+'<br>무드 연속성: '+x(dna.moodContinuity)+'</div>'
      +'<div style="font-weight:600;font-size:12px;margin-top:8px">허용되는 변화(allowedArtDirectionChanges)</div>'
      +'<ul class="aip-cautions">'+(cr.allowedArtDirectionChanges||[]).map(function(c){return '<li>'+x(c)+'</li>';}).join('')+'</ul>'
      +'<div style="font-weight:600;font-size:12px;margin-top:8px">금지되는 변화(forbiddenChanges)</div>'
      +'<ul class="aip-cautions">'+cr.forbiddenChanges.map(function(c){return '<li>'+x(c)+'</li>';}).join('')+'</ul>';
  }

  /* ── Phase 12: Creative Campaign Engine 결과 표시 helper ──
     전부 읽기 전용 표시일 뿐이며, 여기서 어떤 값도 다시 계산하거나 판단하지
     않는다 — AtlasCreativeCampaignEngine.run()이 이미 만든 결과를 그대로 보여준다. */
  function renderProductTruth(cc){
    var pt = cc.productTruth;
    return '<div style="font-weight:400;font-size:12px">상품 유형: '+x(pt.productType)+'<br>핵심 문제: '+x(pt.coreProblem)+'<br>핵심 약속: '+x(pt.corePromise)+'<br>변화: '+x(pt.transformation)+'</div>'
      +'<div style="font-weight:600;font-size:12px;margin-top:6px">실제 포함 자료</div>'
      +'<ul class="aip-cautions">'+pt.tangibleDeliverables.map(function(d){return '<li>'+x(d)+'</li>';}).join('')+'</ul>'
      +'<div style="font-weight:600;font-size:12px;margin-top:6px">금지 항목(prohibitedClaims)</div>'
      +'<ul class="aip-cautions">'+pt.prohibitedClaims.map(function(d){return '<li>'+x(d)+'</li>';}).join('')+'</ul>';
  }
  function renderAudienceInsight(cc){
    var a = cc.audienceInsight;
    return '<div style="font-weight:400;font-size:12px">'
      +'현재 상황: '+x(a.currentSituation)+'<br>숨은 좌절: '+x(a.hiddenFrustration)+'<br>원하는 정체성: '+x(a.desiredIdentity)+'<br>'
      +'구매 트리거: '+x(a.purchaseTrigger)+'<br>구매 불안: '+x(a.purchaseAnxiety)+'<br>정보 수용도: '+x(a.sophisticationLevel)+'</div>';
  }
  function renderPositioning(cc){
    var p = cc.positioning;
    return '<div style="font-weight:400;font-size:12px">Positioning: '+x(p.positioningStatement)+'<br>'
      +'<b>Single-Minded Message</b>: '+x(p.singleMindedMessage)+'<br>'
      +'차별화: '+x(p.competitiveVisualAngle)+'<br>프리미엄 신호: '+x(p.premiumSignal)+' · 신뢰 신호: '+x(p.trustSignal)+'</div>';
  }
  function renderBigIdeas(cc){
    return '<ul class="aip-cautions">'+cc.bigIdeas.map(function(b){
      var evalu = (cc.thumbnailBriefs.filter(function(x2){return x2.conceptId===b.conceptId;})[0]||{}).evaluation;
      var cam = b.cameraLanguage, comp = b.compositionPattern;
      return '<li>'+(b.recommended?'✅ ':'')+'<b>'+x(b.conceptName)+'</b>'+(evalu?(' — '+evalu.normalizedScore+'/100 · '+x(evalu.tierLabel)):'')+' — '+x(b.bigIdea)
        +(b.visualEvent?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Visual Event: '+x(b.visualEvent)+'</div>'):'')
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">장면: '+x(b.sceneStory)+'</div>'
        +(b.sceneSkeleton&&b.sceneSkeleton.length?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Scene Skeleton: '+x(b.sceneSkeleton.join(' · '))+'</div>'):'')
        +(cam?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Camera: '+x(cam.angle)+' · '+x(cam.lens)+' · '+x(cam.style)+'</div>'):'')
        +(comp?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Composition: '+x(comp.pattern)+' — '+x(comp.description)+'</div>'):'')
        +(evalu&&evalu.creativeQuality?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Creative Quality: Diversity '+evalu.creativeQuality.visualDiversity+'/10 · Clarity '+evalu.creativeQuality.narrativeClarity+'/10 · Memorability '+evalu.creativeQuality.sceneMemorability+'/10 · Confidence '+evalu.creativeQuality.claudeDesignGenerationConfidence+'/10</div>'):'')
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">피사체 역할: '+x(b.subjectRole)+' · 상품 역할: '+x(b.productRole)+' · risk: '+x(b.risk)+'</div>'
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">차별화: '+x(b.differentiation)+'</div></li>';
    }).join('')+'</ul>';
  }
  /* Phase 12.4 §12: Visual Diversity Validator 결과(campaignVisualDiversity)를
     그대로 표시한다 — 5개 Concept 쌍별 유사도와 80% 이상 유사해 자동 Reject된
     Concept이 있는지 보여준다(계산은 전부 Engine이 하고, 여기서는 표시만). */
  function renderVisualDiversity(cc){
    var dv = cc.campaignVisualDiversity;
    if(!dv) return '<span style="font-weight:400;font-size:12px">데이터 없음</span>';
    var nameById = {};
    cc.bigIdeas.forEach(function(b){ nameById[b.conceptId] = b.conceptName; });
    var rows = dv.pairs.map(function(p){
      return '<li>'+x(nameById[p.aId]||p.aId)+' ↔ '+x(nameById[p.bId]||p.bId)+' — 유사도 '+(Math.round(p.similarity*1000)/10)+'%'+(p.tooSimilar?' <b style="color:#c0392b">(80% 이상 — 자동 Reject)</b>':'')+'</li>';
    }).join('');
    return '<div style="font-weight:400;font-size:12px">임계치: '+(dv.threshold*100)+'% · 결과: '+(dv.ok?'전부 충분히 다름':'유사 쌍 발견, '+dv.rejectedConceptIds.length+'개 Concept 자동 Reject')+'</div>'
      +'<ul class="aip-cautions">'+rows+'</ul>';
  }
  function renderRecommendedConcept(cc){
    if(cc.recommendationStatus!=='ready-for-production' || !cc.recommendedConceptId){
      var best = cc.thumbnailBriefs.slice().sort(function(a,b){return (b.evaluation?b.evaluation.normalizedScore:0)-(a.evaluation?a.evaluation.normalizedScore:0);})[0];
      return '<span style="font-weight:600">70점 이상 Concept 없음 — 재기획 필요(needs-revision)</span><br>'
        +'<span style="font-weight:400;font-size:12px">참고용 최고 점수: '+x(best.campaignConcept)+' ('+(best.evaluation?best.evaluation.normalizedScore:'-')+'/100, '+x(best.evaluation?best.evaluation.tierLabel:'')+')</span>';
    }
    var rec = cc.bigIdeas.filter(function(b){return b.conceptId===cc.recommendedConceptId;})[0];
    var evalu = (cc.thumbnailBriefs.filter(function(b){return b.conceptId===cc.recommendedConceptId;})[0]||{}).evaluation;
    return '<b>'+x(rec.conceptName)+'</b> <span style="font-weight:400;color:var(--text3)">('+(evalu?evalu.normalizedScore:'-')+'/100, '+x(evalu?evalu.tierLabel:'')+')</span><br>'
      +'<span style="font-weight:400;font-size:12px">'+x(rec.sceneStory)+'</span>'
      +(evalu?('<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:4px">강점: '+x(evalu.strengths.join(', ')||'없음')+'</div>'):'');
  }
  function renderSubjectDirection(cc){
    var s = cc.thumbnailBriefs[0].subject;
    if(!s.subjectRequired) return '<span style="font-weight:400;font-size:12px">인물 미등장(product-led) — '+x(s.reason)+'</span>';
    return '<div style="font-weight:400;font-size:12px">'+x(s.subjectDescription)+' · '+x(s.ageRange)+'<br>표정: '+x(s.facialExpression)+' · 시선: '+x(s.gazeDirection)+'<br>주의: '+x((s.prohibitedDepictions||[]).join(', '))+'</div>';
  }
  function renderProductMockupDirection(cc){
    var m = cc.thumbnailBriefs[0].productMockup;
    return '<div style="font-weight:400;font-size:12px">'+x(m.mockupType)+'<br>'+x(m.coverTreatment)+'<br>재질: '+x(m.material)+'</div>';
  }
  function renderMediumDirection(cc){
    var m = cc.thumbnailBriefs[0].mediumDirection;
    return '<div style="font-weight:400;font-size:12px">Medium: '+x(m.medium)+'<br>'+x(m.medium==='photography'?m.commercialReferenceLanguage:m.editorialReferenceLanguage)+'</div>';
  }
  function renderLightingColorDirection(cc){
    var l = cc.thumbnailBriefs[0].lightingAndColor;
    return '<div style="font-weight:400;font-size:12px">조명: '+x(l.lightingType)+'<br>지배색: '+x(l.paletteRole.dominant)+'<br>대비: '+x(l.contrastLevel)+' · 색온도: '+x(l.colorTemperature)+'</div>';
  }
  function renderThumbnailBriefs(cc){
    return '<ul class="aip-cautions">'+cc.thumbnailBriefs.map(function(b){
      return '<li>'+(b.evaluation&&b.evaluation.recommended?'✅ ':'')+'<b>'+x(b.campaignConcept)+'</b>'+(b.evaluation?(' — '+b.evaluation.normalizedScore+'/100'):'')
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">'+x(b.visualStory)+'</div></li>';
    }).join('')+'</ul>';
  }
  function renderSalesStoryboard(cc){
    return '<ul class="aip-cautions">'+cc.salesPageStoryboard.map(function(p){
      return '<li>'+p.pageNumber+'장 · <b>'+x(p.role)+'</b> — '+x(p.narrativeBeat)
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">'+x(p.visualScene)+'</div>'
        +'<div style="font-weight:400;font-size:12px;color:var(--text3);margin-top:2px">Art Direction: '+x(p.effectiveArtDirection)+'</div></li>';
    }).join('')+'</ul>';
  }
  function renderCampaignMasterBrief(cc){
    return '<pre style="white-space:pre-wrap;font-size:11px;font-weight:400;max-height:260px;overflow:auto;margin:0">'+x(cc.campaignMasterBrief)+'</pre>';
  }
  /* Phase 12.3: productionBriefStatus가 'ready'가 아니면(blocked-by-content/
     blocked-by-evaluator) selectedThumbnailProductionBrief는 null이다("참고용
     초안"을 Production Brief로 내보내지 않음) — 이때는 thumbnailBlockedReport
     (차단 사유 + revisionHistory)를 대신 보여준다. null 체크 기반이라 상태
     문자열이 늘어나도(uncalibrated 등) 그대로 안전하게 동작한다. */
  function thumbnailBriefText(cc){ return cc.selectedThumbnailProductionBrief || cc.thumbnailBlockedReport || ''; }
  function renderClaudeDesignProductionBrief(cc){
    return '<pre style="white-space:pre-wrap;font-size:11px;font-weight:400;max-height:260px;overflow:auto;margin:0">'+x(thumbnailBriefText(cc))+'\n\n'+x(cc.salesPage9PageBrief)+'</pre>';
  }
  var BRIEF_TEXT_BY_KEY = {
    master: function(cc){ return cc.campaignMasterBrief; },
    thumbnail: function(cc){ return thumbnailBriefText(cc); },
    salesPage: function(cc){ return cc.salesPage9PageBrief; },
    production: function(cc){ return thumbnailBriefText(cc)+'\n\n'+cc.salesPage9PageBrief; }
  };
  AIP.copyBrief=function(which){
    var cc=AIP.state.creativeCampaign; if(!cc) return;
    var text = (BRIEF_TEXT_BY_KEY[which]||BRIEF_TEXT_BY_KEY.master)(cc);
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ if(typeof showToast==='function')showToast('success','Brief를 클립보드에 복사했습니다.'); })
        .catch(function(){ if(typeof showToast==='function')showToast('error','복사에 실패했습니다.'); });
    }
  };
  AIP.downloadBrief=function(which){
    var cc=AIP.state.creativeCampaign; if(!cc) return;
    var text = (BRIEF_TEXT_BY_KEY[which]||BRIEF_TEXT_BY_KEY.master)(cc);
    var FILE_NAME_BY_KEY = { master:'campaign_master_brief.txt', thumbnail:'thumbnail_production_brief.txt', salesPage:'sales_page_9page_brief.txt', production:'claude_design_production_brief.txt' };
    var fileName = FILE_NAME_BY_KEY[which] || FILE_NAME_BY_KEY.master;
    var blob = new Blob([text], { type:'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download=fileName; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

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
    var ebookBlueprint=AIP.state.ebookBlueprint;
    var visualPromptSet=AIP.state.visualPromptSet;
    var creativeCampaign=AIP.state.creativeCampaign;

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
      + card('Ebook Blueprint 요약', ebookBlueprint?(
          x(ebookBlueprint.toneGuideline)+'<br>'
          +'<span style="font-weight:400">'+x(ebookBlueprint.densityGuideline)+'</span>'
        ):x(NEEDS_SELECTION_TEXT), '', ebookBlueprint?'Ebook Engine 생성값 (실제 본문 생성 아님 — 문체/밀도 가이드라인)':'')
      + card('분류 결과', visualPromptSet?renderCategoryClassification(visualPromptSet):x(NEEDS_SELECTION_TEXT), '', visualPromptSet?'AI Visual Prompt Engine 생성값 (Evidence 기반 카테고리 분류, 이미지 생성 아님)':'')
      + card('추천 Visual Style', visualPromptSet?renderStyleRanking(visualPromptSet):x(NEEDS_SELECTION_TEXT), '', visualPromptSet?('감정 목표: '+x(visualPromptSet.visualStrategy.emotionalGoal)):'')
      + card('추천 Thumbnail Prompt', visualPromptSet?renderRecommendedThumbnailPrompt(visualPromptSet):x(NEEDS_SELECTION_TEXT))
      + card('Thumbnail Prompt 후보 5개', visualPromptSet?renderThumbnailCandidateList(visualPromptSet):x(NEEDS_SELECTION_TEXT))
      + card('Sales Page Prompt 9개 요약', visualPromptSet?renderSalesPromptSummary(visualPromptSet):x(NEEDS_SELECTION_TEXT))
      + card('Negative Prompt', visualPromptSet?('<span style="font-weight:400;font-size:12px">'+x(visualPromptSet.thumbnailPrompts[0].negativePrompt)+'</span>'):x(NEEDS_SELECTION_TEXT))
      + card('텍스트 안전 영역', visualPromptSet?('<span style="font-weight:400;font-size:12px">'+x(AtlasAIVisualPromptEngine.textSafetyDirector(blueprint, salesBlueprint).thumbnailSafeArea)+'</span>'):x(NEEDS_SELECTION_TEXT), '', 'Headline/Badge/CTA는 이미지에 직접 그리지 않고 이 영역을 비워 Atlas가 이후 오버레이합니다.')
      + card('일관성 규칙', visualPromptSet?renderConsistencyRules(visualPromptSet):x(NEEDS_SELECTION_TEXT))
      + card('Campaign Positioning', creativeCampaign?renderPositioning(creativeCampaign):x(NEEDS_SELECTION_TEXT), '', creativeCampaign?'Creative Campaign Engine 생성값(Phase 12) — Phase 11.5 결과 위에 캠페인 전략을 추가한 것일 뿐, Phase 11.5 결과 자체는 변경되지 않습니다.':'')
      + card('Audience Insight', creativeCampaign?renderAudienceInsight(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Product Truth', creativeCampaign?renderProductTruth(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Big Idea 5종', creativeCampaign?renderBigIdeas(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Visual Diversity', creativeCampaign?renderVisualDiversity(creativeCampaign):x(NEEDS_SELECTION_TEXT), '', creativeCampaign?'5개 Concept가 Visual Event/Scene Skeleton/Camera/Composition/Scene Story 5개 차원에서 80% 이상 겹치면 자동 Reject됩니다.':'')
      + card('추천 Campaign Concept', creativeCampaign?renderRecommendedConcept(creativeCampaign):x(NEEDS_SELECTION_TEXT), '', creativeCampaign?'Concept Evaluator 12개 기준 계산값(Reasoning Service 기록 참고)':'')
      + card('Subject Direction', creativeCampaign?renderSubjectDirection(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Product Mockup Direction', creativeCampaign?renderProductMockupDirection(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Photography / Illustration Direction', creativeCampaign?renderMediumDirection(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Lighting and Color Direction', creativeCampaign?renderLightingColorDirection(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Thumbnail Creative Brief 5개', creativeCampaign?renderThumbnailBriefs(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Sales Page Storyboard 9개', creativeCampaign?renderSalesStoryboard(creativeCampaign):x(NEEDS_SELECTION_TEXT))
      + card('Campaign Master Brief', creativeCampaign?renderCampaignMasterBrief(creativeCampaign):x(NEEDS_SELECTION_TEXT), '', creativeCampaign?'Claude Design 프로젝트에 그대로 붙여넣을 수 있는 텍스트입니다. 이 버튼은 Claude Design을 자동으로 호출하지 않습니다.':'')
      + card('Claude Design Production Brief', creativeCampaign?(
          renderClaudeDesignProductionBrief(creativeCampaign)
          +'<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'
          +'<button class="btn-sec" onclick="AtlasAIPlanner.copyBrief(\'master\')">Claude Design 제작 Brief 복사</button>'
          +'<button class="btn-sec" onclick="AtlasAIPlanner.downloadBrief(\'master\')">Campaign Master Brief 다운로드</button>'
          +'<button class="btn-sec" onclick="AtlasAIPlanner.downloadBrief(\'thumbnail\')">Selected Thumbnail Brief 다운로드</button>'
          +'<button class="btn-sec" onclick="AtlasAIPlanner.downloadBrief(\'salesPage\')">Sales Page 9-Page Brief 다운로드</button>'
          +'<button class="btn-sec" onclick="AtlasAIPlanner.copyBrief(\'production\')">Asset Production Brief 복사</button>'
          +'<button class="btn-sec" onclick="AtlasAIPlanner.downloadBrief(\'production\')">Claude Design 프로젝트용 Brief 다운로드</button>'
          +'</div>'
        ):x(NEEDS_SELECTION_TEXT), '', creativeCampaign?'실제 Claude Design 생성 API 연결은 없습니다 — 이 Brief를 Claude Design에 직접 붙여넣어 사용하세요.':'')
      + card('주의사항', '<ul class="aip-cautions">'+cautions.map(function(c){return '<li>'+x(c)+'</li>';}).join('')+'</ul>', 'aip-card-full');

    var approveBtn=document.getElementById('aip-approve-btn');
    if(approveBtn) approveBtn.disabled=!sel;

    renderReasonAccordionContent();
    /* Phase 14: Image Production UI — Creative Campaign 결과가 갱신될 때마다(Brand Pack
       후보 변경 포함) Thumbnail/Sales Page Scene+Prompt를 다시 만든다. 모듈 미로드 시에도
       안전하도록 방어적으로 호출한다(기존 renderReport 동작은 그대로 유지). */
    if(typeof AtlasImageProductionUI!=='undefined' && AtlasImageProductionUI.populate) AtlasImageProductionUI.populate();
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
    var ebookRecord=AtlasReasoningService.latestBySource('EbookEngine');
    var visualPromptRecord=AtlasReasoningService.latestBySource('AIVisualPromptEngine');
    container.innerHTML=
      renderReasonSection('Brand Strategy 판단 근거', strategyRecord)
      + renderReasonSection('Marketing Copy 판단 근거', copyRecord)
      + renderReasonSection('Thumbnail 판단 근거', thumbnailRecord)
      + renderReasonSection('Sales Page 판단 근거', salesPageRecord)
      + renderReasonSection('Ebook 판단 근거', ebookRecord)
      + renderReasonSection('AI Visual Prompt 판단 근거', visualPromptRecord);
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
    /* AIP.state.marketingCopy/thumbnailBlueprint/salesPageBlueprint/ebookBlueprint는
       이 sel로 renderReport()가 이미 계산해 둔 값이다(같은 BrandProfile 조합이면
       결과가 동일하므로) — 승인 시점에 다시 계산해 Reasoning Service에 중복 기록하지
       않고 그대로 확정 저장한다. */
    APP.marketingCopy=AIP.state.marketingCopy;
    APP.thumbnailBlueprint=AIP.state.thumbnailBlueprint;
    APP.salesPageBlueprint=AIP.state.salesPageBlueprint;
    APP.ebookBlueprint=AIP.state.ebookBlueprint;
    APP.visualPromptSet=AIP.state.visualPromptSet;
    APP.creativeCampaign=AIP.state.creativeCampaign;
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
    startGenerate(true);
  };

  AIP.reset=function(){
    AIP.state.report=null;
    AIP.state.selectedBrandPackId=null;
    AIP.state.marketingCopy=null;
    AIP.state.thumbnailBlueprint=null;
    AIP.state.salesPageBlueprint=null;
    AIP.state.ebookBlueprint=null;
    AIP.state.visualPromptSet=null;
    AIP.state.creativeCampaign=null;
    APP.brandProfile=null;
    APP.plannerReport=null;
    APP.marketingCopy=null;
    APP.thumbnailBlueprint=null;
    APP.salesPageBlueprint=null;
    APP.ebookBlueprint=null;
    APP.visualPromptSet=null;
    APP.creativeCampaign=null;
    var plannerState=document.getElementById('cv-planner-state'); if(plannerState)plannerState.style.display='none';
  };

  /* ══════════════════════════════════════════════════════════════
     Phase 13: Claude Design Creative Feedback UI — 기존 Planner 카드
     렌더링 사이클(renderPlannerReport 등)과 완전히 분리된 별도 상태/렌더
     함수를 쓴다. 실제 Claude Design 이미지가 없으면 분석 버튼을 비활성화
     하고 waiting-for-real-image 상태를 그대로 보여준다. 기존 Planner UI
     동작은 이 섹션 추가로 인해 전혀 바뀌지 않는다. */
  function x2(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  var CF = { store: (typeof AtlasCreativeFeedbackEngine!=='undefined' ? AtlasCreativeFeedbackEngine.createEmptyHistoryStore() : {version:'1.0',campaigns:{}}),
    currentFile:null, currentObjectUrl:null, currentImageData:null, currentDecodeResult:null, currentFingerprint:null,
    lastEvaluation:null, campaignId:null, pendingUserReview:null };
  AIP.creativeFeedback = CF;

  function cfCurrentCampaignId(){
    if(!CF.campaignId) CF.campaignId = 'campaign-'+(APP.lockedTitle||'untitled')+'-'+Date.now();
    return CF.campaignId;
  }
  function cfPopulateConceptSelect(){
    var sel = document.getElementById('cfe-concept-select');
    if(!sel) return;
    var cc = AIP.state.creativeCampaign;
    if(!cc || !cc.bigIdeas){ sel.innerHTML = '<option value="">Creative Campaign 결과가 없습니다</option>'; return; }
    sel.innerHTML = cc.bigIdeas.map(function(b){ return '<option value="'+x2(b.conceptId)+'">'+x2(b.conceptId)+' — '+x2(b.conceptName)+'</option>'; }).join('');
  }
  function cfSelectedConceptId(){
    var sel = document.getElementById('cfe-concept-select');
    return sel ? sel.value : null;
  }
  function cfConceptKey(){ return (document.getElementById('cfe-asset-type')||{}).value+'::'+cfSelectedConceptId(); }
  /* Creative History store의 실제 key(campaignId+conceptKey 조합) — addVersion
     저장과 cfEntry 조회가 반드시 동일한 key를 써야 한다. */
  function cfHistoryKey(){ return cfCurrentCampaignId()+'::'+cfConceptKey(); }
  function cfEntry(){
    return (CF.store.campaigns[cfHistoryKey()]) || null;
  }
  AIP.creativeFeedback.onContextChange = function(){
    cfRenderVersionLabel();
    cfRenderHistory();
  };
  function cfRenderVersionLabel(){
    var entry = cfEntry();
    var label = document.getElementById('cfe-version-label');
    if(label) label.textContent = '다음 Version: '+((entry?entry.latestVersionNumber:0)+1);
  }

  /* 실제 파일 → Image → Canvas → ImageData(실제 픽셀) 디코딩. Mock/SVG는
     accept="image/png,image/jpeg,image/webp"로 이미 배제되고, 매직 바이트
     검증(imageDecodeValidator)으로 확장자 위조도 걸러낸다. */
  AIP.creativeFeedback.onFileSelected = function(input){
    var file = input.files && input.files[0];
    if(!file) return;
    if(CF.currentObjectUrl) AtlasCreativeFeedbackEngine.creativeHistoryManager.revokeObjectUrl(CF.currentObjectUrl);
    var reader = new FileReader();
    reader.onload = function(ev){
      var buf = new Uint8Array(ev.target.result);
      var decodeResult = AtlasCreativeFeedbackEngine.imageDecodeValidator(buf, file.type);
      CF.currentDecodeResult = decodeResult;
      CF.currentFingerprint = AtlasCreativeFeedbackEngine.computeImageFingerprint(buf.slice(0, Math.min(4096, buf.length)));
      var objectUrl = URL.createObjectURL(file);
      CF.currentObjectUrl = objectUrl;
      CF.currentFile = { name:file.name, size:file.size, mimeType:file.type };
      var img = new Image();
      img.onload = function(){
        var canvas = document.getElementById('cfe-canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try{ CF.currentImageData = ctx.getImageData(0,0,canvas.width,canvas.height); }
        catch(e){ CF.currentImageData = null; }
        CF.currentFile.width = img.naturalWidth; CF.currentFile.height = img.naturalHeight;
        var preview = document.getElementById('cfe-preview-img');
        preview.src = objectUrl;
        document.getElementById('cfe-preview-wrap').style.display = '';
        document.getElementById('cfe-source-badge').style.display = '';
        document.getElementById('cfe-waiting-message').style.display = decodeResult.decoded ? 'none' : '';
        if(!decodeResult.decoded) document.getElementById('cfe-waiting-message').textContent = '디코딩 실패: '+decodeResult.reason;
        document.getElementById('cfe-analyze-btn').disabled = false;
      };
      img.onerror = function(){
        CF.currentImageData = null;
        document.getElementById('cfe-analyze-btn').disabled = false; // Hard Fail로 이어지도록 분석은 허용
      };
      img.src = objectUrl;
    };
    reader.readAsArrayBuffer(file);
  };

  function cfBuildInput(){
    var assetType = (document.getElementById('cfe-asset-type')||{}).value || 'thumbnail';
    var conceptId = cfSelectedConceptId();
    var cc = AIP.state.creativeCampaign;
    var thumbnailBrief = cc && cc.thumbnailBriefs ? cc.thumbnailBriefs.filter(function(b){return b.conceptId===conceptId;})[0] : null;
    var originalPrompt = thumbnailBrief ? thumbnailBrief.claudeDesignPrompt : '(Concept을 선택하면 원본 Prompt가 채워집니다)';
    var safeAreaRect = null;
    if(thumbnailBrief && thumbnailBrief.composition){
      /* Blueprint의 Safe Area는 문자열 설명이라 좌표 rect가 아니다 — 하단
         20%를 관례적 기본값으로 쓰되, 실제 좌표 파싱은 향후 과제로 명시한다. */
      safeAreaRect = { x:0, y:0.78, w:1, h:0.22 };
    }
    var claudeVisualAssessment = null;
    var jsonEl = document.getElementById('cfe-visual-assessment-json');
    if(jsonEl && jsonEl.value.trim()){
      try{ claudeVisualAssessment = JSON.parse(jsonEl.value); }
      catch(e){ claudeVisualAssessment = null; }
    }
    return {
      assetType: assetType, campaignId: cfCurrentCampaignId(), conceptId: conceptId,
      originalPrompt: originalPrompt, creativeCampaign: cc,
      image: CF.currentFile ? { mimeType: CF.currentFile.mimeType, width: CF.currentFile.width, height: CF.currentFile.height, source:'claude-design', importedAt: Date.now() } : null,
      decodeResult: CF.currentDecodeResult, imageData: CF.currentImageData,
      safeAreaRect: safeAreaRect, claudeVisualAssessment: claudeVisualAssessment, userReview: CF.pendingUserReview
    };
  }

  AIP.creativeFeedback.analyze = function(){
    var input = cfBuildInput();
    var result = AtlasCreativeFeedbackEngine.run(input);
    CF.lastEvaluation = result;
    if(result.evaluationStatus==='evaluated'){
      var addResult = AtlasCreativeFeedbackEngine.creativeHistoryManager.addVersion(CF.store, cfHistoryKey(), input.conceptId, input.assetType, {
        originalPrompt: input.originalPrompt, retryPrompt: result.retryPrompt,
        imageMetadata: CF.currentFile, imageReference: { objectUrl: CF.currentObjectUrl, fingerprint: CF.currentFingerprint },
        imageFingerprint: CF.currentFingerprint, evaluation: result
      });
      if(addResult.added) CF.store = addResult.store;
      cfRenderVersionLabel();
      cfRenderHistory();
      if(!addResult.added) result._duplicateWarning = addResult.reason;
    }
    cfRenderResults(result);
  };

  AIP.creativeFeedback.cancel = function(){
    document.getElementById('cfe-results-body').innerHTML = '';
    CF.lastEvaluation = null;
  };
  AIP.creativeFeedback.deleteImage = function(){
    if(CF.currentObjectUrl) AtlasCreativeFeedbackEngine.creativeHistoryManager.revokeObjectUrl(CF.currentObjectUrl);
    CF.currentFile = null; CF.currentObjectUrl = null; CF.currentImageData = null; CF.currentDecodeResult = null; CF.currentFingerprint = null;
    var wrap = document.getElementById('cfe-preview-wrap'); if(wrap) wrap.style.display = 'none';
    var badge = document.getElementById('cfe-source-badge'); if(badge) badge.style.display = 'none';
    var waiting = document.getElementById('cfe-waiting-message');
    if(waiting){ waiting.style.display = ''; waiting.textContent = 'waiting-for-real-image — 아직 실제 Claude Design 이미지가 업로드되지 않았습니다.'; }
    var btn = document.getElementById('cfe-analyze-btn'); if(btn) btn.disabled = true;
    var fi = document.getElementById('cfe-file-input'); if(fi) fi.value = '';
    AIP.creativeFeedback.cancel();
  };

  function cfRenderResults(result){
    var el = document.getElementById('cfe-results-body');
    if(!el) return;
    if(result.evaluationStatus!=='evaluated'){
      el.innerHTML = '<div style="font-size:12px;color:var(--text3)">평가 상태: <b>'+x2(result.evaluationStatus)+'</b><br>'+(result.errors||[]).map(function(e){return x2(e);}).join('<br>')+'</div>';
      return;
    }
    var combined = result.combined || {};
    var html = '';
    html += '<div style="font-size:14px;font-weight:800">Creative Score: '+result.automatedScore+'/100 (coverage '+result.coveragePercent+'%) · Grade: '+x2(result.grade)+'</div>';
    if(result.hardFail) html += '<div style="color:#c0392b;font-weight:700;font-size:12px;margin-top:4px">Hard Fail: '+result.hardFailReasons.map(function(r){return x2(r.label);}).join(', ')+'</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-top:4px">Automated Score: '+result.automatedScore+' · User Review Score: '+(combined.userReviewScore!=null?combined.userReviewScore:'없음')+(combined.divergenceWarning?(' — '+x2(combined.divergenceWarning)):'')+'<br>Combined Decision 규칙: '+x2(combined.rule||'')+'</div>';
    html += '<table style="width:100%;font-size:11px;margin-top:10px;border-collapse:collapse">';
    result.breakdown.forEach(function(b){
      html += '<tr style="border-top:1px solid var(--border)"><td style="padding:4px 4px">'+x2(b.category)+'</td><td style="padding:4px 4px">'+(b.status==='evaluated'?(b.score+'/'+b.maxScore):x2(b.status))+'</td><td style="padding:4px 4px;color:var(--text3)">'+(b.status==='evaluated'?'':x2(b.reason||''))+'</td></tr>';
    });
    html += '</table>';
    if(result.diagnoses.length){
      html += '<div style="font-weight:700;font-size:12px;margin-top:12px">Visual Diagnosis</div>';
      html += '<ul class="aip-cautions">'+result.diagnoses.map(function(d){
        return '<li><b>['+x2(d.priority)+'] '+x2(d.category)+'</b>: '+x2(d.diagnosis)+'<div style="font-size:11px;color:var(--text3)">원인: '+x2(d.cause)+'<br>Specific Fix: '+x2(d.specificFix)+'<br>Target: '+x2(d.measurableTarget)+'</div></li>';
      }).join('')+'</ul>';
    }
    html += '<div style="font-weight:700;font-size:12px;margin-top:12px">Retry Prompt</div>';
    html += '<textarea id="cfe-retry-prompt-text" readonly style="width:100%;min-height:140px;font-size:11px;font-family:monospace;margin-top:4px">'+x2(result.retryPrompt)+'</textarea>';
    html += '<div style="margin-top:6px"><button class="btn-sec" onclick="AtlasAIPlanner.creativeFeedback.copyRetryPrompt()">Retry Prompt 복사</button></div>';
    if(result._duplicateWarning) html += '<div style="font-size:11px;color:#c0392b;margin-top:6px">'+x2(result._duplicateWarning)+'</div>';
    el.innerHTML = html;
    cfRenderUserReviewForm();
  }

  AIP.creativeFeedback.copyRetryPrompt = function(){
    var ta = document.getElementById('cfe-retry-prompt-text');
    if(!ta) return;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(ta.value).then(function(){ if(typeof showToast==='function') showToast('success','Retry Prompt를 클립보드에 복사했습니다.'); })
        .catch(function(){ if(typeof showToast==='function') showToast('error','복사에 실패했습니다.'); });
    }
  };

  var USER_REVIEW_FIELDS = ['productVisibility','scrollStoppingPower','brandFit','emotionalImpact','artifactPresence','overallSalesQuality'];
  var USER_REVIEW_LABEL = { productVisibility:'Product Visibility', scrollStoppingPower:'Scroll-Stopping Power', brandFit:'Brand Fit', emotionalImpact:'Emotional Impact', artifactPresence:'Artifact Presence', overallSalesQuality:'Overall Sales Quality' };
  function cfRenderUserReviewForm(){
    var el = document.getElementById('cfe-user-review-body');
    if(!el) return;
    var html = '<div style="font-weight:700;font-size:12px">사용자 수동 평가(1~10점, 자동 점수와 별도로 저장됩니다)</div>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">';
    USER_REVIEW_FIELDS.forEach(function(f){
      html += '<label style="font-size:11px">'+x2(USER_REVIEW_LABEL[f])+'<br><input type="number" min="1" max="10" id="cfe-review-'+f+'" style="width:56px" /></label>';
    });
    html += '</div><textarea id="cfe-review-notes" placeholder="메모" style="width:100%;min-height:40px;margin-top:6px;font-size:11px"></textarea>';
    html += '<div style="margin-top:6px"><button class="btn-sec" onclick="AtlasAIPlanner.creativeFeedback.saveUserReview()">사용자 평가 저장</button></div>';
    el.innerHTML = html;
  }
  AIP.creativeFeedback.saveUserReview = function(){
    var review = { notes: (document.getElementById('cfe-review-notes')||{}).value||'' };
    USER_REVIEW_FIELDS.forEach(function(f){
      var v = parseFloat((document.getElementById('cfe-review-'+f)||{}).value);
      if(!isNaN(v)) review[f] = v;
    });
    CF.pendingUserReview = review;
    if(CF.lastEvaluation && CF.lastEvaluation.evaluationStatus==='evaluated'){
      CF.lastEvaluation.combined = AtlasCreativeFeedbackEngine.combineDecision(CF.lastEvaluation.automatedScore, review);
      cfRenderResults(CF.lastEvaluation);
    }
    if(typeof showToast==='function') showToast('success','사용자 평가를 저장했습니다.');
  };

  function cfRenderHistory(){
    var el = document.getElementById('cfe-history-body');
    if(!el) return;
    var entry = cfEntry();
    if(!entry || !entry.versions.length){ el.innerHTML = '<div style="font-size:11px;color:var(--text3)">이 Concept의 Creative History가 아직 없습니다.</div>'; return; }
    var best = AtlasCreativeFeedbackEngine.bestVersionSelector(entry.versions, entry.manualBestVersionNumber);
    var html = '<div style="font-weight:700;font-size:12px">Creative History('+entry.versions.length+'개 Version)</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:4px">Best Version: '+(best.bestVersionNumber||'없음')+' — '+x2(best.reason)+'</div>';
    html += '<ul class="aip-cautions">'+entry.versions.map(function(v){
      var isBest = best.bestVersionNumber===v.versionNumber;
      return '<li>'+(isBest?'⭐ ':'')+'Version '+v.versionNumber+' — Score '+((v.evaluation&&v.evaluation.automatedScore)!=null?v.evaluation.automatedScore:'N/A')+'/100, '+((v.evaluation&&v.evaluation.grade)||'')
        +' <button class="btn-sec" style="font-size:10px;padding:2px 6px" onclick="AtlasAIPlanner.creativeFeedback.setManualBest('+v.versionNumber+')">Best Version으로 지정</button></li>';
    }).join('')+'</ul>';
    el.innerHTML = html;
  }
  AIP.creativeFeedback.setManualBest = function(versionNumber){
    var entry = cfEntry();
    if(!entry) return;
    entry.manualBestVersionNumber = versionNumber;
    cfRenderHistory();
    if(typeof showToast==='function') showToast('success','Version '+versionNumber+'을 Best Version으로 지정했습니다.');
  };

  /* Planner 진입 시 Concept select를 채운다(기존 selectCandidate 흐름과
     독립적으로, Creative Campaign 결과가 준비된 뒤 호출됨). */
  var _origSelectCandidate = AIP.selectCandidate;
  if(typeof _origSelectCandidate==='function'){
    AIP.selectCandidate = function(){
      var r = _origSelectCandidate.apply(AIP, arguments);
      cfPopulateConceptSelect();
      cfRenderVersionLabel();
      cfRenderHistory();
      return r;
    };
  }

})(window.AtlasAIPlanner);
