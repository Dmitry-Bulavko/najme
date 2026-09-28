-- Baseline migration (#13): no domain tables yet. Enables the `btree_gist` extension needed by
-- exclusion constraints for booking overlap checks (ADR-0005), so it exists before any domain
-- migration relies on it.
CREATE EXTENSION IF NOT EXISTS btree_gist;
