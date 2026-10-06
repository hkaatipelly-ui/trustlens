// TrustLens Trust Engine — deterministic, explainable scoring for AI agent actions.
// Pure JS (ES module). Depends only on detector.js. The LLM NEVER computes the score:
// it can only supply the optional `intent` signal ({ aligned, confidence, reason }).
//
// evaluate({ agent, tool, params, payloadText, resource, policies, org, intent, now })
//   agent:    { key, name, allowedTools[], allowedDataClasses[], baseline:{ typicalTools[], typicalRecipients[], typicalDomains[], avgRecordsPerAction } }
//   tool:     'send_email' | 'share_file' | 'post_message' | 'http_request' | 'read_resource'
//   params:   { to?, url?, channel?, subject?, body?, resourceKey? }
//   payloadText: string — everything leaving with the action (subject + body + resource content)
//   resource: { key, name, dataClass, recordCount } | null
//   policies: [{ key, name, severity:'hard_block'|'penalty', penalty, rule, enabled }]
//   org:      { internalDomains[], partnerDomains[], blockedDomains[], personalDomains[] }
//   intent:   { aligned:boolean, confidence:0..1, reason } | null
//   now:      Date (for time-based policies; defaults to new Date())
// returns { score, level, hardBlock, checks[], privacy:{counts, entityTypes, records}, tokenizedPayload, recipient:{address, domain, class} }

import { tokenize, createVault } from './detector.js';

export const THRESHOLDS = { trusted: 75, suspicious: 40 };

export const DEFAULT_ORG = {
  internalDomains: ['acme.in'],
  partnerDomains: ['partner-logistics.in', 'vendor-insights.in'],
  blockedDomains: ['pastebin.com', 'transfer.sh', 'temp-mail.org'],
  personalDomains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com', 'proton.me', 'icloud.com', 'rediffmail.com'],
};

// Per-type sensitivity weight (applied once per type present)
export const SENSITIVITY_WEIGHTS = { SECRET: 30, AADHAAR: 25, CARD: 20, PAN: 15, UPI: 8, GSTIN: 5, PHONE: 5, EMAIL: 3, IFSC: 3, PERSON: 2 };

const CAPS = { sensitivity: 40, recipient: 35, destination: 30, behavior: 20, policy: 35, intent: 30 };

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const severityOf = (penalty, hard) => (hard ? 'critical' : penalty === 0 ? 'pass' : penalty <= 10 ? 'low' : penalty <= 20 ? 'medium' : 'high');
const check = (id, name, penalty, reason, hard = false) => ({ id, name, passed: penalty === 0 && !hard, penalty, reason, severity: severityOf(penalty, hard), hardBlock: hard });

// ---------- helpers ----------
export function extractDomain(tool, params = {}) {
  if (params.to && params.to.includes('@')) return { address: params.to.trim().toLowerCase(), domain: params.to.split('@').pop().trim().toLowerCase() };
  if (params.url) {
    try { return { address: params.url, domain: new URL(params.url).hostname.replace(/^www\./, '').toLowerCase() }; } catch { return { address: params.url, domain: null }; }
  }
  if (params.channel) return { address: params.channel, domain: null, internalChannel: true };
  return { address: null, domain: null };
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// "acme-helpdesk.co", "acrne.in", "acme.in.evil.com" → look-alike of acme.in
export function lookalikeOf(domain, trusted) {
  if (!domain) return null;
  const norm = (d) => d.replace(/0/g, 'o').replace(/1/g, 'l').replace(/rn/g, 'm');
  for (const t of trusted) {
    if (domain === t || domain.endsWith('.' + t)) continue;
    const brand = t.split('.')[0];
    const dBase = domain.split('.')[0];
    if (levenshtein(norm(domain), norm(t)) <= 2) return t;
    if (brand.length >= 4 && (dBase.includes(brand) || norm(dBase).includes(brand))) return t;
    if (domain.startsWith(t + '.')) return t;
  }
  return null;
}

export function classifyDomain(domain, org, internalChannel = false) {
  if (internalChannel) return 'internal';
  if (!domain) return 'none';
  const inList = (list) => list.some((d) => domain === d || domain.endsWith('.' + d));
  if (inList(org.internalDomains)) return 'internal';
  if (inList(org.blockedDomains)) return 'blocked';
  if (inList(org.partnerDomains)) return 'partner';
  if (inList(org.personalDomains)) return 'personal';
  return 'unknown';
}

// ---------- main ----------
export function evaluate({ agent, tool, params = {}, payloadText = '', resource = null, policies = [], org = DEFAULT_ORG, intent = null, now = new Date() }) {
  const checks = [];
  let hardBlock = false;

  // Privacy shield: detect + tokenize everything that would leave with this action
  const { tokenized, counts, entities } = tokenize(payloadText || '', createVault());
  const entityTypes = Object.keys(counts);
  const maxPerType = entityTypes.length ? Math.max(...entityTypes.map((t) => new Set(entities.filter((e) => e.type === t).map((e) => e.token)).size)) : 0;
  const records = Math.max(resource?.recordCount || 0, maxPerType);

  const { address, domain, internalChannel } = extractDomain(tool, params);
  const recipientClass = classifyDomain(domain, org, internalChannel);
  const isOutbound = recipientClass !== 'none';
  const isExternal = isOutbound && recipientClass !== 'internal';

  // 1. Permission
  {
    const problems = [];
    if (!agent.allowedTools?.includes(tool)) problems.push(`tool "${tool}" is not allowed for ${agent.name}`);
    if (resource && !agent.allowedDataClasses?.includes(resource.dataClass)) problems.push(`${agent.name} has no access to "${resource.dataClass}" data (${resource.name || resource.key})`);
    if (problems.length) { hardBlock = true; checks.push(check('permission', 'Agent permission', 0, 'HARD BLOCK: ' + problems.join('; '), true)); }
    else checks.push(check('permission', 'Agent permission', 0, `${tool}${resource ? ' on ' + resource.dataClass + ' data' : ''} is within ${agent.name}'s scope`));
  }

  // 2. Sensitivity
  {
    let p = entityTypes.reduce((s, t) => s + (SENSITIVITY_WEIGHTS[t] || 0), 0);
    if (entityTypes.length) { if (records > 20) p += 10; else if (records > 5) p += 5; } // volume only matters when personal data is present
    if (!isExternal) p = Math.round(p / 2); // staying inside the company is lower risk
    p = clamp(p, 0, CAPS.sensitivity);
    const summary = entityTypes.length ? entityTypes.map((t) => `${counts[t]} ${t}`).join(', ') : 'no personal data detected';
    checks.push(check('sensitivity', 'Sensitive data', p, entityTypes.length ? `${summary}${records ? ` (~${records} records)` : ''}${!isExternal ? ' — internal use, penalty halved' : ''}` : summary));
  }

  // 3. Recipient
  {
    const table = { internal: [0, 'internal colleague'], partner: [10, 'approved external partner'], unknown: [25, 'unknown external party'], personal: [35, 'personal email account outside company control'], blocked: [35, 'blocked destination'], none: [0, 'no external recipient (internal read)'] };
    const [p, label] = table[recipientClass];
    checks.push(check('recipient', 'Recipient', p, address ? `${address} — ${label}` : label));
  }

  // 4. Destination trust
  {
    let p = 0; const reasons = [];
    const look = lookalikeOf(domain, [...org.internalDomains, ...org.partnerDomains]);
    if (recipientClass === 'blocked') { p += 30; reasons.push(`${domain} is on the blocked list`); }
    if (look && recipientClass !== 'internal' && recipientClass !== 'partner') { p += 30; reasons.push(`${domain} looks like ${look} (possible impersonation)`); }
    if (recipientClass === 'personal') { p += 10; reasons.push(`${domain} is a consumer mailbox, not managed by the company`); }
    if (recipientClass === 'unknown' && !look) { p += 15; reasons.push(`${domain} has never been verified`); }
    if (params.url && params.url.startsWith('http://')) { p += 10; reasons.push('unencrypted http:// destination'); }
    p = clamp(p, 0, CAPS.destination);
    checks.push(check('destination', 'Destination trust', p, reasons.length ? reasons.join('; ') : domain ? `${domain} is a trusted domain` : 'no network destination'));
  }

  // 5. Behaviour vs this agent's baseline
  {
    const b = agent.baseline || {};
    let p = 0; const reasons = [];
    if (b.typicalTools?.length && !b.typicalTools.includes(tool)) { p += 5; reasons.push(`${agent.name} rarely uses ${tool}`); }
    if (address && b.typicalRecipients?.length && !b.typicalRecipients.includes(address) && domain && !(b.typicalDomains || []).includes(domain) && recipientClass !== 'internal') { p += 8; reasons.push(`first time sending to ${domain}`); }
    const avg = b.avgRecordsPerAction || 0;
    if (avg && records > avg * 3) { p += 7; reasons.push(`${records} records vs usual ~${avg} (${Math.round(records / avg)}×)`); }
    else if (avg && records > avg * 1.5) { p += 4; reasons.push(`${records} records vs usual ~${avg}`); }
    p = clamp(p, 0, CAPS.behavior);
    checks.push(check('behavior', 'Behaviour baseline', p, reasons.length ? reasons.join('; ') : `consistent with ${agent.name}'s normal activity`));
  }

  // 6. Organisation policies
  {
    let p = 0; const hits = []; let policyHard = false;
    for (const pol of policies.filter((x) => x.enabled !== false)) {
      const r = pol.rule || {};
      let violated = false;
      if (r.entity && r.destination === 'external') violated = isExternal && (counts[r.entity] || 0) > 0;
      else if (r.maxRecords != null && r.destination === 'external') violated = isExternal && records > r.maxRecords;
      else if (r.destinationType) violated = recipientClass === r.destinationType;
      else if (r.start != null && r.end != null) { const h = now.getHours(); violated = h < r.start || h >= r.end; }
      if (!violated) continue;
      if (pol.severity === 'hard_block') { policyHard = true; hits.push(`HARD BLOCK: ${pol.name}`); }
      else { p += pol.penalty || 0; hits.push(pol.name); }
    }
    if (policyHard) hardBlock = true;
    p = clamp(p, 0, CAPS.policy);
    checks.push(check('policy', 'Company policy', p, hits.length ? 'Violates: ' + hits.join('; ') : 'complies with all company policies', policyHard));
  }

  // 7. Intent alignment (only signal that comes from the LLM)
  {
    if (!intent) checks.push(check('intent', 'Task alignment', 0, 'not evaluated'));
    else if (intent.aligned) checks.push(check('intent', 'Task alignment', 0, intent.reason || 'action matches the user\'s request'));
    else {
      const p = clamp(Math.round(CAPS.intent * (intent.confidence ?? 1)), 5, CAPS.intent);
      checks.push(check('intent', 'Task alignment', p, (intent.reason || 'action does not match the user\'s request') + ' — possible prompt injection'));
    }
  }

  const totalPenalty = checks.reduce((s, c) => s + c.penalty, 0);
  const score = clamp(100 - totalPenalty, 0, 100);
  const level = hardBlock ? 'BLOCKED' : score >= THRESHOLDS.trusted ? 'TRUSTED' : score >= THRESHOLDS.suspicious ? 'SUSPICIOUS' : 'UNSAFE';
  const decision = { TRUSTED: 'execute', SUSPICIOUS: 'require_approval', UNSAFE: 'block', BLOCKED: 'block' }[level];

  return {
    score, level, decision, hardBlock, checks,
    privacy: { counts, entityTypes, records },
    tokenizedPayload: tokenized,
    recipient: { address, domain, class: recipientClass },
  };
}
