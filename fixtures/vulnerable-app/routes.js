// Intentionally vulnerable fixture: routes for vibecheck's missing-auth rule to catch.
const express = require('express');
const router = express.Router();
const db = require('./db');

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).end();
  next();
}

// VULNERABLE: no auth middleware, no auth check in the handler body — anyone
// can fetch any order by id.
router.get('/orders/:id', async (req, res) => {
  const order = await db.getOrder(req.params.id);
  res.json(order);
});

// VULNERABLE: destructive action with zero auth check.
router.delete('/users/:id', function (req, res) {
  db.deleteUser(req.params.id);
  res.status(204).end();
});

// SAFE: protected by requireAuth middleware — should NOT be flagged.
router.get('/profile', requireAuth, (req, res) => {
  res.json(req.user);
});

// VULNERABLE (IDOR, not missing-auth): requireAuth confirms the requester is
// *someone*, but the handler never checks the invoice actually belongs to
// them — any logged-in user can read any other user's invoice by id.
router.get('/invoices/:id', requireAuth, async (req, res) => {
  const invoice = await db.getInvoiceById(req.params.id);
  res.json(invoice);
});

// SAFE: same shape, but compares the record's owner to the requester —
// should NOT be flagged.
router.get('/receipts/:id', requireAuth, async (req, res) => {
  const receipt = await db.getReceiptById(req.params.id);
  if (receipt.userId !== req.user.id) return res.status(403).end();
  res.json(receipt);
});

// SAFE: public by convention (login) — should NOT be flagged.
router.post('/login', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
