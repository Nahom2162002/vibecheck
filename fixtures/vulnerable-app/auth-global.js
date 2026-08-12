// Fixture: an auth route covered by a rate limiter applied globally rather
// than per-route — should NOT be flagged by vibecheck's rate-limiting rule.
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// SAFE: covered by the router.use(rateLimit(...)) above, even with no local
// rate-limiter argument on the route itself.
router.post('/verify', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
