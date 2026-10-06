import api from '../lib/api.js';

export const USING_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export class ServiceError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED', details) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function request(method, url, { data, params, signal } = {}) {
  try {
    const envelope = USING_MOCKS
      ? await (await import('../mocks/handlers.js')).mockRequest(method, url, { data, params, signal })
      : (await api.request({ method, url, data, params, signal })).data;
    if (!envelope?.success) throw new ServiceError(envelope?.error?.message || 'Unexpected API response.', 0, envelope?.error?.code);
    return envelope.data;
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') throw error;
    if (error instanceof ServiceError) throw error;
    const response = error.response;
    throw new ServiceError(response?.data?.error?.message || (response ? 'The request could not be completed.' : 'Unable to reach the API. Check VITE_API_URL and your connection.'), response?.status, response?.data?.error?.code, response?.data?.error?.details);
  }
}

export function notifyDataChanged() { window.dispatchEvent(new Event('tl:data-changed')); }
