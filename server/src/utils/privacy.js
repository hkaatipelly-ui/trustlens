import { createVault, rehydrate, tokenize } from '../lib/detector.js';

function mapStrings(value, transform) {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      transform(key), mapStrings(item, transform),
    ]));
  }
  return value;
}

export function protectValue(value, vault = createVault()) {
  return mapStrings(value, (text) => tokenize(text, vault).tokenized);
}

// Vaults stay in the request's memory. Restored proposal values are for server-side
// validation/evaluation only and must be protected again before Action persistence.
export function restoreValue(value, vault) {
  return mapStrings(value, (text) => rehydrate(text, vault));
}
