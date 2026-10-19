# DeepCutsEDH Isolated Security Staging — October 19, 2026

This file exists **only** in the staging-only GitHub branch. It must not be merged into production main as an authorization for runtime changes.

- Dedicated Cloudflare Pages project: `deepcuts-edh-security-staging`
- Dedicated Access application: `DeepCutsEDH Isolated Security Staging`; entire staging hostname is protected and only the verified owner email is permitted.
- Production and preview `DB` bindings point to **synthetic-only staging** database `deepcuts-security-staging-db` (D1 UUID `e1ca9158-1767-49c6-b4db-4ef8626b6b75`).
- Production and preview `HIVE_DB` bindings point to **synthetic-only staging** database `deepcuts-security-staging-hive` (D1 UUID `fda85a95-0613-43a7-898c-baa2ff20b643`).
- Schema definitions were copied as DDL only: **no production member rows, scores, payments, or credentials**.
- No production Ko-fi or email secrets are set in this project. Real paid webhook tests and actual account recovery email flows are deliberately unavailable until a *dedicated synthetic test provider* is configured.
- Do not reuse production D1 bindings or share test keys. Do not enable public access to this staging hostname.
- Canonical follow-up: https://github.com/Squackle/deep-cuts-edh/issues/74

Production project: `deep-cuts-edh`, independent and unchanged.
