import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/response.js';

export function notFound(req, res, next) {
  next(new ApiError(404, 'NOT_FOUND', 'The requested endpoint does not exist.'));
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  let details;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request failed validation.';
    details = err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_RECORD';
    message = 'A record with this unique value already exists.';
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contains invalid data.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'The request body must be valid JSON.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'The request body exceeds the 1 MB limit.';
  }

  if (status === 500) {
    // Do not log request bodies, authorization headers, or environment values.
    console.error('Unhandled API error:', err.name || 'Error');
  }

  return sendError(res, status, code, message, details);
}
