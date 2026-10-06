export const PLAYGROUND_EXAMPLES = [
  { key: 'attack', label: 'Customer data export', proposal: { agentKey: 'support-agent', tool: 'send_email', params: { to: 'backup.team@protonmail.com' }, resourceKey: 'customer_master', intentAlignment: { aligned: false, confidence: .97, reason: 'User requested an email summary, not a database export.' } } },
  { key: 'permission', label: 'High-score hard block', proposal: { agentKey: 'hr-assistant', tool: 'read_resource', params: {}, resourceKey: 'finance_ledger', intentAlignment: { aligned: true, confidence: .8 } } },
  { key: 'grey', label: 'Vendor share', proposal: { agentKey: 'sales-assistant', tool: 'share_file', params: { to: 'insights@vendor-insights.in' }, resourceKey: 'customer_feedback', intentAlignment: { aligned: true, confidence: .9 } } },
  { key: 'normal', label: 'Internal summary', proposal: { agentKey: 'sales-assistant', tool: 'send_email', params: { to: 'manager@acme.in' }, resourceKey: 'q3_summary', intentAlignment: { aligned: true, confidence: .95 } } },
];
