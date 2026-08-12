# fixtures/vulnerable-app

A tiny, deliberately flawed Express app used to verify vibecheck's checks end-to-end. Every file here has at least one intentional vulnerability the corresponding rule should catch. Do not use any pattern in this folder as a real-world example.

`config.js` and `.env` are **not committed** — they contain realistic provider-format secrets (Stripe/AWS/GitHub-token-shaped) so the secrets rule has something real to catch, and committing that literal text trips GitHub's push protection. Run `npm run fixtures:generate` (or `npm run scan:fixture`, which does it for you) to write them locally before scanning.
