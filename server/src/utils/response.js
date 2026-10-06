export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data, error: null });
}

export function sendError(res, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(status).json({ success: false, data: null, error });
}
