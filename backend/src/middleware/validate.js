// validate({ body, query, params }) — parses with Zod and replaces with clean data
module.exports = (schemas) => (req, res, next) => {
  if (schemas.params) req.params = schemas.params.parse(req.params);
  if (schemas.body) req.body = schemas.body.parse(req.body);
  if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
  next();
};
