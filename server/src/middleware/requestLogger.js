import morgan from 'morgan';

export const requestLogger = morgan((tokens, req, res) => {
  const path = req.originalUrl.split('?')[0];
  const parts = [tokens.method(req, res), path, tokens.status(req, res), `${tokens['response-time'](req, res)}ms`];
  if (typeof res.locals.evaluationMs === 'number') parts.push(`evaluation=${res.locals.evaluationMs}ms`);
  return parts.join(' ');
});
