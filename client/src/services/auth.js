import { request } from './request.js';

export const login = (credentials) => request('POST', '/api/auth/login', { data: credentials });
export const register = (details) => request('POST', '/api/auth/register', { data: details });
export const getMe = (options) => request('GET', '/api/auth/me', options);
