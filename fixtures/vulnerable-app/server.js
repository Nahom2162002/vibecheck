// Intentionally vulnerable fixture: overly permissive CORS for vibecheck's cors rule to catch.
const express = require('express');
const cors = require('cors');
const app = express();

// VULNERABLE: wildcard origin + credentials lets any site make authenticated requests.
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

// SAFE: explicit allowlist with credentials — should NOT be flagged.
app.use(
  '/api/public',
  cors({
    origin: ['https://app.example.com'],
    credentials: true,
  })
);

module.exports = app;
