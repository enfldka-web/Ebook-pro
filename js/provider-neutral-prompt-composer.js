/* js/provider-neutral-prompt-composer.js — Phase 14: Provider-Neutral Prompt Composer

   Creative Campaign 전체 보고서(점수/confidence/recommendationStatus/reasoning/
   evaluatorStatus/revisionHistory/risk 분석/내부 field 이름 등)를 Provider에 보내지
   않는다. 이 Composer는 오직 아래 화이트리스트 형태의 "scene" 입력만 받는다 — 애초에
   내부 평가 필드를 받을 수 있는 구조 자체가 아니므로, 구조적으로 유출이 불가능하다.

   scene = {
     assetType: 'thumbnail' | 'sales-page',
     assetLabel: string (예: "Thumbnail Concept — Contrarian Insight", "Sales Page Page 2 — Reader Reality"),
     visualEvent, mainSubject, productMockup, environment, camera,
     composition: string 또는 { name, description },
     lighting, palette, style, safeArea, negativePrompt,
     width, height
   }

   출력 순서(고정): 1.Asset purpose 2.Exact visual event 3.Main subject 4.Product mockup
   5.Environment 6.Camera 7.Composition 8.Lighting 9.Palette 10.Visual style
   11.Safe Area 12.Output dimensions 13.Text restriction 14.Negative instructions

   권장 길이: Thumbnail 500~1,000자, Sales Page 500~1,200자(참고용 경고일 뿐, 강제
   절단하지 않는다 — 장면이 구체적이어야 한다는 요구가 글자 수 제한보다 우선한다). */

window.AtlasProviderNeutralPromptComposer = window.AtlasProviderNeutralPromptComposer || {};

(function(PC){

  PC.RECOMMENDED_LENGTH = { thumbnail: { min:500, max:1000 }, 'sales-page': { min:500, max:1200 } };

  function articleFor(phrase){ return /^[aeiou]/i.test(phrase||'') ? 'an' : 'a'; }
  function compositionText(composition){
    if(!composition) return '';
    if(typeof composition === 'string') return composition;
    return (composition.name ? composition.name+' — ' : '') + (composition.description || '');
  }
  function assetPurposeLine(scene){
    var kind = scene.assetType==='sales-page' ? 'Sales Page' : 'Thumbnail';
    return 'Asset: '+kind+(scene.assetLabel?(' — '+scene.assetLabel):'');
  }

  /* 권장 길이(500~1,000/500~1,200자) 안에 들어오도록, AVPE가 만든 포괄적인 Negative
     Prompt(콤마로 구분된 전체 목록)를 앞부분 핵심 항목만 남겨 축약한다 — Negative
     Instructions라는 요소 자체는 그대로 유지하되(요구 14개 항목 중 하나), 매번
     전체 목록을 반복하지 않는다. 원본 전체 목록은 AVPE 결과 자체에는 그대로 남아있고
     여기서 다시 쓰지 않을 뿐이다(원본 데이터 변경 없음). */
  var NEGATIVE_TERM_LIMIT = 6;
  function trimNegative(negativePrompt){
    var terms = String(negativePrompt||'').split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    return terms.slice(0, NEGATIVE_TERM_LIMIT).join(', ');
  }

  /* 내부 평가 관련 키워드가 실수로라도 scene에 섞여 들어와 있으면(예: 호출자가
     잘못된 객체를 통째로 넘긴 경우) Prompt 문자열에 노출되지 않도록, scene에서
     읽는 필드를 화이트리스트로만 한정한다 — scene.score, scene.confidence 등은
     애초에 아래 어떤 라인에서도 참조하지 않는다. */
  PC.composePrompt = function(scene){
    scene = scene || {};
    var lines = [];
    lines.push(assetPurposeLine(scene));
    lines.push('Event: '+(scene.visualEvent||''));
    lines.push('Subject: '+(scene.mainSubject||''));
    lines.push('Product: '+(scene.productMockup||''));
    lines.push('Environment: '+(scene.environment||''));
    lines.push('Camera: '+(scene.camera||''));
    lines.push('Composition: '+compositionText(scene.composition));
    lines.push('Lighting: '+(scene.lighting||''));
    lines.push('Palette: '+(scene.palette||''));
    lines.push('Style: '+(scene.style||''));
    lines.push('Safe Area: '+(scene.safeArea||''));
    lines.push('Output: '+(scene.width||'?')+'x'+(scene.height||'?')+'px.');
    lines.push('No embedded text, random letters, logos, or watermarks inside the image.');
    lines.push('Negative: '+trimNegative(scene.negativePrompt));
    return lines.join('\n');
  };

  PC.composeThumbnailPrompt = function(scene){
    scene = Object.assign({}, scene, { assetType:'thumbnail' });
    return PC.composePrompt(scene);
  };

  PC.composeSalesPagePrompt = function(scene){
    scene = Object.assign({}, scene, { assetType:'sales-page' });
    return PC.composePrompt(scene);
  };

  PC.lengthCheck = function(promptText, assetType){
    var range = PC.RECOMMENDED_LENGTH[assetType] || PC.RECOMMENDED_LENGTH.thumbnail;
    var length = (promptText||'').length;
    return { length: length, min: range.min, max: range.max, withinRecommendedRange: length>=range.min && length<=range.max };
  };

})(window.AtlasProviderNeutralPromptComposer);
