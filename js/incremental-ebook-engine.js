/* js/incremental-ebook-engine.js — 전자책을 한 번의 거대한 Anthropic 호출로 만들지
   않고, 목차 → 챕터별 생성(7개, 순차) → 부록 생성 → 최종 병합 순서로 나눠서
   만든다. 각 단계는 별도의 작은 Anthropic 호출이므로 초장시간 단일 연결에서
   발생하던 timeout/network_error 위험이 사라지고, 챕터 단위로 진행률을 실시간
   표시하거나 중지/재개할 수 있다.

   Prompt 품질은 기존 startGenerate()의 [분량과 구성]/[사실성과 안전]/[크몽 판매 카피]
   지시문을 그대로(문구 변경 없이) 각 호출에 나눠 재사용한다 — 생성 "방식"만
   incremental로 바뀌고, 실제로 AI에게 요구하는 내용/기준은 동일하다.

   Creative Campaign Engine은 이 엔진의 중간 산출물(outline/개별 챕터)을 전혀
   참조하지 않는다 — AI Planner 단계(AIP.approve())에서 이미 확정되어 있고,
   최종 병합된 APP.ebook만 이후 판매디자인 단계에서 사용된다. */

window.AtlasIncrementalEbookEngine = window.AtlasIncrementalEbookEngine || {};

(function(E){
  E.TOTAL_CHAPTERS = 7;
  E.CHAPTER_TYPES = ['문제 해부형','사례 분석형','단계별 실행형','개념 전환형','도구·자원형','심화 전략형','종합 실행형'];

  var FACTUALITY_RULES = `[사실성과 안전]
- 사용자가 제공하지 않은 저자의 실제 경험, 판매 실적, 구매후기, 통계는 창작하지 않습니다.
- 특정 인물의 사례가 필요하면 가상 사례임을 본문 안에서 명시합니다.
- 최신 정보가 필요한 도구·정책은 확실하지 않으면 확인 필요라고 씁니다.`;

  var SALES_COPY_RULES = `[크몽 판매 카피]
- 구체적인 수익 금액, 매출 금액, 성장률, 달성 기간을 후킹과 상세페이지 문구에 사용하지 않습니다.
- 보장·무조건·100%·누구나 성공·자동수익 등의 표현을 사용하지 않습니다.
- testimonials는 반드시 빈 배열입니다.
- 가격·정가·할인액 필드는 생성하지 않습니다.
- hook은 핵심 불편을 찌르는 짧은 문장으로 작성합니다.
- pains, solution, learnings, benefits, before, after는 각각 구체적인 문장 배열로 작성합니다.`;

  function ebookBlueprintGuidelines(){
    if(!APP.ebookBlueprint) return '';
    var ebp=APP.ebookBlueprint;
    var lines=['[승인된 전자책 생성 가이드라인]','','- 문체: '+ebp.toneGuideline,'- 정보 밀도: '+ebp.densityGuideline,'- CTA 적용 방식: '+ebp.ctaGuideline,'- FAQ 통합 방식: '+ebp.faqIntegrationGuideline,'- 핵심 Promise 일관성: '+ebp.crossConsistency.promise];
    if(ebp.crossConsistency.thumbnailPattern)lines.push('- Thumbnail Pattern과의 일관성: '+ebp.crossConsistency.thumbnailPattern);
    if(ebp.crossConsistency.salesPageLayoutStrategy)lines.push('- Sales Page 전략과의 일관성: '+ebp.crossConsistency.salesPageLayoutStrategy);
    lines.push('','[중요 규칙]','','- 위 가이드는 기존 전자책 구조를 변경하지 않는다.','- 원문에 없는 후기, 수치, 자격, 매출 보장을 생성하지 않는다.','- 기존 사용자 입력과 원천자료가 최우선 사실 근거다.');
    return lines.join('\n')+'\n\n';
  }

  /* ── 1) 목차/개요(Outline) ── 챕터 "본문"은 만들지 않고, 책 전체 뼈대(제목 주변
     필드/서문/서론/결론/판매카피/7개 챕터 브리핑)만 만든다. */
  E.buildOutlinePrompt = function(modeWrapperPrefix){
    return ebookBlueprintGuidelines()+(modeWrapperPrefix||'')+`위 입력을 바탕으로 한국어 전자책의 전체 개요와 크몽 판매용 카피 데이터를 작성하세요.
아직 각 챕터의 본문 전체를 쓰지 않습니다 — 챕터는 "브리핑"만 작성합니다(본문은 다음 단계에서 챕터별로 따로 작성됩니다).

[잠긴 제목 — 변경 금지]
제목: ${APP.lockedTitle}
부제목: ${APP.lockedSubtitle||''}
반환 JSON의 title과 subtitle은 위 문구를 정확히 사용하세요.
반드시 JSON 객체 하나만 반환하고 JSON 밖의 텍스트는 작성하지 마세요.

[분량과 구성]
- preface: 600자 이상
- intro: 800자 이상
- conclusion: 1200자 이상
- chapterBriefs: 정확히 7개, 문제 해부형, 사례 분석형, 단계별 실행형, 개념 전환형, 도구·자원형, 심화 전략형, 종합 실행형을 한 번씩 이 순서로 사용합니다.
- 각 chapterBrief는 해당 챕터에서 다룰 핵심 내용을 2~3문장으로 요약합니다(본문이 아니라 다음 단계 집필 지침).
- appendices: 정확히 3개 제목만 먼저 정합니다(본문은 다음 단계에서 작성).

${FACTUALITY_RULES}

${SALES_COPY_RULES}

아래 스키마를 정확히 따르세요.
{
  "title":"전자책 제목",
  "subtitle":"부제목",
  "author":"저자명",
  "category":"카테고리",
  "description":"책 소개",
  "targetReader":"구체적인 추천 독자 상황",
  "preface":"저자 서문. 사용자 입력에 실제 경험이 없으면 경험을 꾸며내지 말고 집필 배경과 문제의식 중심으로 작성",
  "intro":"서론",
  "authorBio":"저자 소개. 정보가 없으면 전문성을 과장하지 않는 일반 소개",
  "conclusion":"핵심 정리와 실행 순서, 현실적인 응원",
  "chapterBriefs":[
    {"number":1,"title":"챕터 제목","type":"문제 해부형","summary":"이 챕터에서 다룰 핵심 내용 2~3문장"},
    {"number":2,"title":"챕터 제목","type":"사례 분석형","summary":"..."},
    {"number":3,"title":"챕터 제목","type":"단계별 실행형","summary":"..."},
    {"number":4,"title":"챕터 제목","type":"개념 전환형","summary":"..."},
    {"number":5,"title":"챕터 제목","type":"도구·자원형","summary":"..."},
    {"number":6,"title":"챕터 제목","type":"심화 전략형","summary":"..."},
    {"number":7,"title":"챕터 제목","type":"종합 실행형","summary":"..."}
  ],
  "appendixTitles":["핵심 실천 체크리스트","추천 도구와 참고 자료","실전 실행 플랜"],
  "copyright":{"year":"2026","publisher":"독립 출판","notice":"","disclaimer":"","contact":""},
  "sales":{
    "hook":"수치 없는 강력한 후킹 문장",
    "subhook":"구체적인 상황을 묘사한 서브 후킹",
    "pains":["고통1","고통2","고통3","고통4"],
    "solution":"이 책이 제공하는 해결 구조",
    "learnings":["배울 내용1","배울 내용2","배울 내용3","배울 내용4"],
    "benefits":["혜택1","혜택2","혜택3","혜택4"],
    "before":["변화 전1","변화 전2","변화 전3"],
    "after":["변화 후1","변화 후2","변화 후3"],
    "testimonials":[],
    "faqs":[{"q":"질문1","a":"답변1"},{"q":"질문2","a":"답변2"},{"q":"질문3","a":"답변3"}],
    "finalPush":"과장 없는 최종 행동 유도 문장"
  }
}`;
  };

  /* ── 2) 챕터별 생성(7회 반복) ── 이미 완성된 outline의 해당 chapterBrief만 그
     챕터의 집필 지침으로 쓰고, 나머지 챕터와 내용이 겹치지 않도록 전체 개요도
     참고 정보로 함께 전달한다. */
  E.buildChapterPrompt = function(outline, brief){
    var otherBriefs = outline.chapterBriefs.filter(function(b){return b.number!==brief.number;})
      .map(function(b){return b.number+'장 ('+b.type+'): '+b.title+' — '+b.summary;}).join('\n');
    return ebookBlueprintGuidelines()+`아래는 이미 확정된 전자책의 개요입니다. 이 중 ${brief.number}번째 챕터(${brief.type}) 하나만 본문으로 완성하세요.
다른 챕터와 겹치지 않게 하되, 이 챕터의 집필 지침(summary)에서 벗어나지 마세요.
반드시 JSON 객체 하나만 반환하고 JSON 밖의 텍스트는 작성하지 마세요.

[전자책 정보]
제목: ${outline.title}
부제목: ${outline.subtitle}
설명: ${outline.description}
추천 독자: ${outline.targetReader}

[이 챕터의 집필 지침]
${brief.number}번째 챕터 · 유형: ${brief.type}
제목(안): ${brief.title}
다룰 내용: ${brief.summary}

[다른 챕터 목록 — 내용 중복 방지용 참고]
${otherBriefs}

[분량과 구성]
- content: 3500자 이상
- actionBox는 오늘 바로 할 수 있는 행동 하나입니다.
- keyPoints는 새로운 인사이트 3개입니다.
- actionItems는 구체적인 실행 단계 3개 이상입니다.

${FACTUALITY_RULES}

아래 스키마를 정확히 따르세요(이 챕터 하나만).
{"number":${brief.number},"title":"챕터 제목","content":"${brief.type} 본문(3500자 이상)","actionBox":"구체적 행동","keyPoints":["인사이트1","인사이트2","인사이트3"],"actionItems":["실행1","실행2","실행3"]}`;
  };

  /* ── 3) 부록 생성 ── outline이 이미 정해둔 3개 제목 그대로 본문만 채운다. */
  E.buildAppendicesPrompt = function(outline){
    var titles = outline.appendixTitles||['핵심 실천 체크리스트','추천 도구와 참고 자료','실전 실행 플랜'];
    return ebookBlueprintGuidelines()+`아래는 이미 확정된 전자책의 개요입니다. 부록 3개의 본문을 작성하세요(제목은 이미 정해져 있으니 그대로 사용).
반드시 JSON 배열 하나만 반환하고 배열 밖의 텍스트는 작성하지 마세요.

[전자책 정보]
제목: ${outline.title}
설명: ${outline.description}
추천 독자: ${outline.targetReader}

[분량과 구성]
- appendices: 정확히 3개
- 각 부록은 실제로 활용 가능한 구체적인 체크리스트/자료/계획으로 작성합니다.

${FACTUALITY_RULES}

아래 스키마를 정확히 따르세요.
[
  {"title":"${titles[0]}","content":"구체적 체크리스트"},
  {"title":"${titles[1]}","content":"도구별 특징, 사용법, 확인 시점"},
  {"title":"${titles[2]}","content":"단계별 실행 계획"}
]`;
  };

  function extractResponseText(data){
    return (data.content||[]).filter(function(b){return b.type==='text';}).map(function(b){return b.text;}).join('');
  }

  function stripBOM(s){ return s.length && s.charCodeAt(0)===0xFEFF ? s.slice(1) : s; }

  function contextAroundPosition(text, pos, radius){
    var start = Math.max(0, pos-radius);
    var end = Math.min(text.length, pos+radius);
    return text.slice(start, end);
  }

  /* Claude가 JSON 문자열 값 안에 이스케이프 없이 실제 줄바꿈/탭을 그대로 반환하는
     경우(실제로 확인된 원인 — "Expected ',' or ']'" 류 오류의 전형적인 원인)를
     고치기 위한 최소한의 상태기계형 sanitizer다. 문자열( " ~ " ) 내부에 있을 때만
     raw \n/\r/\t를 \\n/\\r/\\t로 이스케이프한다 — 문자열 밖의 JSON 구조는 건드리지
     않는다. */
  function escapeRawControlCharsInStrings(text){
    var out = '';
    var inString = false;
    var escapeNext = false;
    for(var i=0;i<text.length;i++){
      var ch = text[i];
      if(inString){
        if(escapeNext){ out += ch; escapeNext = false; continue; }
        if(ch === '\\'){ out += ch; escapeNext = true; continue; }
        if(ch === '"'){ out += ch; inString = false; continue; }
        if(ch === '\n'){ out += '\\n'; continue; }
        if(ch === '\r'){ out += '\\r'; continue; }
        if(ch === '\t'){ out += '\\t'; continue; }
        out += ch; continue;
      }
      if(ch === '"'){ inString = true; }
      out += ch;
    }
    return out;
  }

  /* §1/§2/§3/§4/§5/§6(사용자 요청) — 실제 Windows 실행에서 "Expected ',' or ']'..."
     파싱 오류가 재현되어 만든 견고화 로직이다.
     - 파싱 전 원문(raw)을 window.__atlasLastRawResponse[unitLabel]에 항상 보관한다
       (개발자 콘솔에서 언제든 실제 원문을 확인할 수 있다 — §1).
     - ```json/``` 코드펜스, BOM, 앞뒤 설명 문장을 제거하고 첫 여는 문자~마지막 닫는
       문자 사이만 후보로 삼는다(§4/§5).
     - 1차 파싱이 실패하면 실패 위치 주변 원문을 콘솔에 출력한다(§3).
     - 문자열 내부의 raw 개행/탭을 이스케이프하고 trailing comma를 제거해 2차
       파싱을 시도한다(§4) — 실제 Anthropic 응답이 이 패턴으로 깨지는 경우가 있다.
     - 그래도 실패하면 원문 전체/실패 위치 주변을 로그로 남기고, 에러 객체에도
       원문을 실어(err.rawResponseText) 위쪽 catch에서 그대로 보여줄 수 있게 한다(§6). */
  function robustJsonParse(rawResponseText, openChar, closeChar, unitLabel){
    var raw = stripBOM(rawResponseText);
    window.__atlasLastRawResponse = window.__atlasLastRawResponse || {};
    window.__atlasLastRawResponse[unitLabel] = raw;

    var clean = raw.replace(/```json\s*/gi,'').replace(/```/g,'').trim();
    var s = clean.indexOf(openChar), e = clean.lastIndexOf(closeChar);
    if(s===-1||e===-1){
      console.error('[incremental-ebook] ['+unitLabel+'] JSON 시작/끝 문자를 찾을 수 없습니다. 원문 전체:', raw);
      var eNotFound = new Error(unitLabel+': 응답에서 JSON을 찾을 수 없습니다.');
      eNotFound.rawResponseText = raw;
      throw eNotFound;
    }
    var candidate = clean.substring(s, e+1);

    function tryParse(text){
      try{ return { ok:true, value: JSON.parse(text) }; }
      catch(err){ return { ok:false, err: err }; }
    }

    var attempt1 = tryParse(candidate);
    if(attempt1.ok) return attempt1.value;

    console.error('[incremental-ebook] ['+unitLabel+'] 1차 JSON.parse 실패: '+attempt1.err.message);
    console.error('[incremental-ebook] ['+unitLabel+'] 원문 전체(파싱 전, response.text() 그대로):', raw);
    var posMatch1 = /position (\d+)/.exec(attempt1.err.message);
    if(posMatch1){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(원문 기준):', contextAroundPosition(candidate, parseInt(posMatch1[1],10), 200));
    }

    var sanitized = escapeRawControlCharsInStrings(candidate).replace(/,(\s*[}\]])/g, '$1');
    var attempt2 = tryParse(sanitized);
    if(attempt2.ok){
      console.warn('[incremental-ebook] ['+unitLabel+'] 문자열 내부 제어문자 이스케이프 후 2차 파싱 성공(모델이 JSON 문자열 안에 실제 줄바꿈을 이스케이프 없이 반환했을 가능성이 높습니다).');
      return attempt2.value;
    }

    console.error('[incremental-ebook] ['+unitLabel+'] 2차(정제 후) JSON.parse도 실패: '+attempt2.err.message);
    var posMatch2 = /position (\d+)/.exec(attempt2.err.message);
    if(posMatch2){
      console.error('[incremental-ebook] ['+unitLabel+'] 실패 위치 주변 문자열(정제 후 기준):', contextAroundPosition(sanitized, parseInt(posMatch2[1],10), 200));
    }

    var eFinal = new Error(unitLabel+': JSON 파싱 실패 — '+attempt2.err.message+' (개발자 콘솔의 window.__atlasLastRawResponse.'+unitLabel+' 에서 원문 전체를 확인할 수 있습니다)');
    eFinal.rawResponseText = raw;
    eFinal.parseErrorMessage = attempt2.err.message;
    throw eFinal;
  }

  /* callGateway는 window.AtlasAnthropicGateway.generate()를 그대로 쓴다 — 새 Provider나
     새 Gateway 경로를 만들지 않는다(기존 Anthropic Gateway 재사용). callType은
     Anthropic에 보내는 값이 아니라, 서버가 유닛 종류별로(챕터는 더 짧게) 타임아웃을
     고르는 데만 쓰는 라우팅 힌트다. 실제 호출 전 max_tokens만 콘솔에 남기고
     Prompt 전문/API Key는 절대 출력하지 않는다. */
  function callGateway(promptText, maxTokens, callType){
    return buildApiContent(promptText).then(function(content){
      console.log('[incremental-ebook] calling Anthropic gateway — callType='+callType+', max_tokens='+maxTokens);
      return window.AtlasAnthropicGateway.generate({
        model:'claude-sonnet-4-6', max_tokens:maxTokens, system:ATLAS_SYSTEM_PROMPT,
        callType: callType,
        messages:[{role:'user', content: content}]
      });
    });
  }

  E.generateOutline = function(modeWrapperPrefix){
    return callGateway(E.buildOutlinePrompt(modeWrapperPrefix), 6000, 'outline').then(function(data){
      var text = extractResponseText(data);
      return robustJsonParse(text, '{', '}', 'outline');
    });
  };

  E.generateChapter = function(outline, brief){
    return callGateway(E.buildChapterPrompt(outline, brief), 9000, 'chapter').then(function(data){
      var text = extractResponseText(data);
      return robustJsonParse(text, '{', '}', 'chapter'+brief.number);
    });
  };

  E.generateAppendices = function(outline){
    return callGateway(E.buildAppendicesPrompt(outline), 5000, 'appendices').then(function(data){
      var text = extractResponseText(data);
      return robustJsonParse(text, '[', ']', 'appendices');
    });
  };

  /* ── 최종 병합 ── outline + 완료된 7개 챕터 + 부록을 기존 ebook 스키마와
     동일한 모양으로 합친다. 이 병합 결과만 Creative Campaign Engine/판매디자인이
     사용한다(중간 산출물은 절대 전달하지 않는다). */
  E.mergeFinalEbook = function(state){
    var o = state.outline;
    return {
      title: o.title, subtitle: o.subtitle, author: o.author, category: o.category,
      description: o.description, targetReader: o.targetReader,
      preface: o.preface, intro: o.intro, authorBio: o.authorBio,
      chapters: state.chapters.slice(),
      conclusion: o.conclusion,
      appendices: state.appendices.slice(),
      copyright: o.copyright, sales: o.sales
    };
  };

})(window.AtlasIncrementalEbookEngine);
