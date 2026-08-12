// Intentionally vulnerable fixture: server handlers for vibecheck's
// client-side-validation rule to correlate against the forms in client/.
const express = require('express');
const router = express.Router();

// VULNERABLE: no server-side validation of req.body at all — a form with
// only client-side checks is the only thing stopping bad input.
router.post('/signup', (req, res) => {
  db.createUser(req.body);
  res.status(201).end();
});

// SAFE: manual server-side validation — should NOT be flagged.
router.post('/contact', (req, res) => {
  if (!req.body.email) return res.status(400).json({ error: 'email required' });
  db.saveContactMessage(req.body);
  res.status(201).end();
});

module.exports = router;
