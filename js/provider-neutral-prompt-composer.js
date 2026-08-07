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
  /* V3 Phase 2 Round 17: 6이었을 때는 캠페인 레벨 NEGATIVE_BASE(18개 항목)의
     앞 6개("illegible text, random letters, distorted hands, extra fingers,
     duplicated objects, warped book mockup")만 살아남고 watermark/logo는
     물론, 이후 Thumbnail Theme Engine이 맨 앞에 붙이는 테마별 필수 항목(인물
     금지/파스텔 색 금지/아이콘 중복 금지, thumbnail-theme-engine.js 참고)까지
     통째로 잘려나가는 실제 결함이 있었다(실측 확인: negativePrompt 필드가
     "Avoid:" 프롬프트 줄에 전혀 반영되지 않음). 테마 항목은 항상 맨 앞에
     붙으므로, 그 항목들(테마당 11~13개) + 핵심 base 항목 일부가 함께 살아남을
     만큼 넉넉하게 올린다. */
  var NEGATIVE_TERM_LIMIT = 20;
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

  /* V3 Phase 2 Round 7: Thumbnail Generation Engine Rebuild.

     Sales Page는 계속 PC.composePrompt(위)의 "Field: value" 14줄 그대로 쓴다 —
     이 라운드는 Sales Page Engine을 건드리지 않는다는 제약이 있으므로, 공유
     함수를 고치는 대신 Thumbnail 전용 Composer를 새로 추가한다(Sales Page
     경로는 한 줄도 바뀌지 않음).

     Field-값 나열 구조 자체가 실제 병목 중 하나였다 — 실제 조사 결과, Style/
     Composition/Product 세 줄이 서로 다른 그림을 요청하는 모순이 여러 Concept에서
     발견됐고(예: Style="literal 상품 사진", Composition="literal 상품 사진이
     아니라"), Subject와 Product가 같은 문자열을 두 번 반복하는 경우도 흔했다.
     아래 Composer는 같은 화이트리스트 필드를 읽지만, 산문 형태로 조립해
     Style을 이 장면의 우선 창작 방향으로 앞세우고 Composition은 "그 안에서
     프레임을 어떻게 배치할지"로 뒤따르게 해 모순을 구조적으로 줄인다. 또한
     실제 OpenAI 요청 크기(1536x1024, 3:2)와 표시 프롬프트의 Output 줄이
     달랐던 문제(확인된 실측 왜곡 버그)를 정직하게 반영한다 — 정확한 652x488
     이라고 거짓으로 약속하는 대신, 실제 생성 프레임 비율과 이후 크롭/맞춤이
     있을 것이라는 사실을 그대로 알려 모델이 중요한 내용을 프레임 중앙에
     배치하도록 유도한다. */
  var GENERATION_FRAME = { ratio: '3:2 wide landscape', note: 'the image will later be fitted into a 4:3 display frame, so keep the most important visual content within the center-safe two-thirds of the frame' };

  /* mainSubject와 productMockup이 원래 같은 문자열이었어도, Theme이 productMockup
     에만 상업적 표현 접미사를 덧붙이므로(js/thumbnail-theme-engine.js) 이 시점에는
     더 이상 완전히 같은 문자열이 아니다 — 단순 equality 비교만 하면 "같은 대상을
     두 문장으로 반복"하는 원래 버그가 접미사 뒤에 숨어 그대로 재발한다(실제 발견).
     productMockup이 "mainSubject + 접미사" 형태면 같은 대상이라고 보고 한 문장으로
     합친다. */
  function dedupeSubjectProduct(mainSubject, productMockup){
    var subj = String(mainSubject||'').trim();
    var prod = String(productMockup||'').trim();
    if(!subj || !prod){
      return { subjectLine: subj ? ('The main subject is '+subj+'.') : '', productLine: prod ? ('Alongside it, show '+prod+'.') : '' };
    }
    var subjLower = subj.toLowerCase(), prodLower = prod.toLowerCase();
    if(prodLower === subjLower){
      return { subjectLine: 'The central focus of the frame is '+subj+'.', productLine: '' };
    }
    if(prodLower.indexOf(subjLower) === 0){
      var extra = prod.slice(subj.length).replace(/^[,\s]+/, '');
      return { subjectLine: 'The central focus of the frame is '+subj+(extra?(', '+extra):'')+'.', productLine: '' };
    }
    return { subjectLine: 'The main subject is '+subj+'.', productLine: 'Alongside it, show '+prod+'.' };
  }

  PC.composeThumbnailPromptV2 = function(scene){
    scene = scene || {};
    var sp = dedupeSubjectProduct(scene.mainSubject, scene.productMockup);
    var comp = compositionText(scene.composition);
    var lines = [];
    /* 공유 assetPurposeLine()을 그대로 쓰면 "Asset: Thumbnail — Thumbnail Concept
       — X"처럼 Thumbnail이라는 단어가 두 번 겹친다(assetLabel 자체가 이미
       "Thumbnail Concept —"으로 시작하므로) — Thumbnail 전용 Composer는
       assetLabel만으로 직접 한 줄을 만든다(Sales Page가 쓰는 assetPurposeLine은
       그대로 둔다). */
    lines.push((scene.assetLabel || 'Thumbnail')+'.');
    lines.push('Render this in the style of '+(scene.style||'a commercial photograph')+' — this is the primary creative direction for the whole image.');
    if(scene.visualEvent) lines.push('Show the exact moment when: '+scene.visualEvent+'.');
    if(sp.subjectLine) lines.push(sp.subjectLine);
    if(sp.productLine) lines.push(sp.productLine);
    if(scene.environment) lines.push('Setting: '+scene.environment+'.');
    if(scene.camera) lines.push('Camera: '+scene.camera+'.');
    if(comp) lines.push('Within that style, arrange the frame as: '+comp+'.');
    if(scene.lighting) lines.push('Lighting: '+scene.lighting+(scene.palette?(', with '+scene.palette+' as the dominant color note'):'')+'.');
    if(scene.safeArea) lines.push('Safe area: '+scene.safeArea+'. Leave this area completely clean — Atlas will add all headline text afterward as a separate overlay step.');
    lines.push('Compose for a '+GENERATION_FRAME.ratio+' commercial thumbnail frame; '+GENERATION_FRAME.note+'.');
    lines.push('No embedded text, random letters, numbers, logos, or watermarks anywhere in the image.');
    var negative = trimNegative(scene.negativePrompt);
    if(negative) lines.push('Avoid: '+negative+'.');
    return lines.join(' ');
  };

  PC.composeThumbnailPrompt = function(scene){
    scene = Object.assign({}, scene, { assetType:'thumbnail' });
    return PC.composeThumbnailPromptV2(scene);
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
