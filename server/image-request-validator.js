/* server/image-request-validator.js — Phase 15: OpenAI Image 요청에 필요한 서버 전용
   검증. shared/image-generation-contract.js의 Provider-neutral 검증(필수 필드 존재
   여부)과는 별개로, 실제 OpenAI Images API에 보낼 값(size/quality/output_format/
   background)이 허용된 값인지, Prompt에 내부 평가 정보가 섞여 들어오지 않았는지를
   여기서 마지막으로 한 번 더 확인한다("내부 기획 문서를 그대로 전송하지 마세요"). */

var ALLOWED_SIZES = ['1536x1024', '1024x1536', '1024x1024'];
var ALLOWED_QUALITY = ['low', 'medium', 'high'];
var ALLOWED_OUTPUT_FORMAT = ['png', 'jpeg', 'webp'];
var ALLOWED_BACKGROUND = ['opaque', 'transparent'];
var MAX_PROMPT_LENGTH = 4000;

/* Provider-neutral-prompt-composer.js가 애초에 이 필드들을 받지 않는 구조이지만,
   서버 경계에서 한 번 더 방어적으로 확인한다(호출자가 실수로 다른 객체를 넘겼을
   가능성 대비 — "Defense in depth"). */
var FORBIDDEN_LEAK_PATTERNS = [
  /recommendationStatus/i, /evaluatorStatus/i, /revisionHistory/i,
  /normalizedScore/i, /creativeQuality/i, /productionBriefStatus/i,
  /claude\s*design/i
];

function validateOpenAIRequestBody(body){
  var errors = [];
  if(!body || typeof body.prompt !== 'string' || !body.prompt.trim()) errors.push('prompt가 비어 있습니다.');
  else {
    if(body.prompt.length > MAX_PROMPT_LENGTH) errors.push('prompt가 너무 깁니다(최대 '+MAX_PROMPT_LENGTH+'자).');
    FORBIDDEN_LEAK_PATTERNS.forEach(function(re){
      if(re.test(body.prompt)) errors.push('prompt에 내부 평가/기획 정보로 의심되는 패턴이 포함되어 있습니다: '+re);
    });
  }
  if(ALLOWED_SIZES.indexOf(body.size) === -1) errors.push('size는 '+ALLOWED_SIZES.join('/')+' 중 하나여야 합니다.');
  if(ALLOWED_QUALITY.indexOf(body.quality) === -1) errors.push('quality는 '+ALLOWED_QUALITY.join('/')+' 중 하나여야 합니다.');
  if(body.output_format !== undefined && ALLOWED_OUTPUT_FORMAT.indexOf(body.output_format) === -1) errors.push('output_format은 '+ALLOWED_OUTPUT_FORMAT.join('/')+' 중 하나여야 합니다.');
  if(body.background !== undefined && ALLOWED_BACKGROUND.indexOf(body.background) === -1) errors.push('background는 '+ALLOWED_BACKGROUND.join('/')+' 중 하나여야 합니다.');
  return { valid: errors.length===0, errors: errors };
}

function sizeForAssetType(assetType){
  return assetType==='sales-page' ? '1024x1536' : '1536x1024';
}

module.exports = {
  ALLOWED_SIZES: ALLOWED_SIZES, ALLOWED_QUALITY: ALLOWED_QUALITY,
  ALLOWED_OUTPUT_FORMAT: ALLOWED_OUTPUT_FORMAT, ALLOWED_BACKGROUND: ALLOWED_BACKGROUND,
  MAX_PROMPT_LENGTH: MAX_PROMPT_LENGTH,
  validateOpenAIRequestBody: validateOpenAIRequestBody,
  sizeForAssetType: sizeForAssetType
};
