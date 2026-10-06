import { THRESHOLDS } from '../lib/trustEngine.js';

export function decideStatus(evaluation) {
  if (evaluation.hardBlock || evaluation.score < THRESHOLDS.suspicious) return 'blocked';
  if (evaluation.score < THRESHOLDS.trusted) return 'pending_approval';
  return 'executed';
}
