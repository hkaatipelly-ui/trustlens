export function validate(schema, target = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(result.error);
    req.validated = { ...req.validated, [target]: result.data };
    // Express 5 exposes req.query as a getter; keep parsed query/params separately.
    if (target === 'body') req.body = result.data;
    return next();
  };
}
