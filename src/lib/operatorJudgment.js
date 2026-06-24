// Fail-closed judgment verdict. The Claude Code operator does the actual
// criteria-vs-submission reasoning; this turns its decision into a pay/no-pay
// verdict where ONLY an explicit, sufficiently-confident accept authorizes
// payment. Anything else (reject, low confidence, malformed) → no pay.
function evaluateJudgment({
  decision,
  confidence,
  minConfidence = Number(process.env.AGENT_JUDGE_MIN_CONFIDENCE || 0.6),
} = {}) {
  const valid = decision === 'accept' || decision === 'reject';
  const conf = Number.isFinite(Number(confidence))
    ? Number(confidence)
    : (decision === 'accept' ? 1 : 0);
  const pay = valid && decision === 'accept' && conf >= minConfidence;
  return { decision, valid, confidence: conf, minConfidence, pay };
}

module.exports = { evaluateJudgment };
