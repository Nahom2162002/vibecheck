// Intentionally vulnerable fixture: raw CORS headers for vibecheck's cors rule to catch.
module.exports = function corsMiddleware(req, res, next) {
  // VULNERABLE: wildcard origin combined with credentials via raw headers.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
};
