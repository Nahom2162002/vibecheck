// Intentionally vulnerable fixture: auth routes for vibecheck's rate-limiting rule to catch.
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const signupLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

// VULNERABLE: no rate limiter on a login endpoint — open to brute-force.
router.post('/login', (req, res) => {
  res.json({ ok: true });
});

// SAFE: protected by a local rate-limiter middleware — should NOT be flagged.
router.post('/signup', signupLimiter, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
