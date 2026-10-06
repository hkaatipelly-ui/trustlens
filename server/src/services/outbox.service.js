import { OutboxItem } from '../models/OutboxItem.js';

export async function createExecutionReceipt({ action, params = action.params, attachmentName = '', redacted = false, session }) {
  // All tools are simulated; creating this receipt is the entire execution.
  const [item] = await OutboxItem.create([{
    action: action._id,
    tool: action.tool,
    to: params.to || params.url || params.channel || '',
    subject: params.subject || '',
    bodyPreview: action.tokenizedPayload,
    attachmentName,
    redacted,
  }], { session });
  return item;
}
