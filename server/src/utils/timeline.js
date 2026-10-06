import { performance } from 'node:perf_hooks';

export const CHECK_STAGES = [
  ['permission', 'Agent permission checked'],
  ['sensitivity', 'Data sensitivity checked'],
  ['recipient', 'Recipient classified'],
  ['destination', 'Destination trust checked'],
  ['behavior', 'Behavior baseline checked'],
  ['policy', 'Company policies checked'],
  ['intent', 'Task alignment checked'],
];

export function createTimeline() {
  const started = performance.now();
  const entries = [];
  const elapsed = () => Number((performance.now() - started).toFixed(2));
  return {
    entries,
    elapsed,
    mark(stage, label) {
      // Completion offsets, not fabricated per-check durations: the unchanged
      // engine computes its checks together in one deterministic evaluation.
      entries.push({ stage, label, ms: elapsed() });
    },
  };
}
