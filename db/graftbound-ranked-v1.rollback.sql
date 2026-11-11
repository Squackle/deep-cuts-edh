-- Rollback for db/graftbound-ranked-v1.sql. DESTROYS GRAFTBOUND ranked data only. Export first:
--   wrangler d1 export <db> --table graftbound_attempts_v1 (and each table below) before running.
-- Safer first step: UPDATE graftbound_launch_v1 SET enabled=0;  (disables the API without data loss)
DROP TABLE IF EXISTS graftbound_awards_v1;
DROP TABLE IF EXISTS graftbound_best_v1;
DROP TABLE IF EXISTS graftbound_encounters_v1;
DROP TABLE IF EXISTS graftbound_segments_v1;
DROP INDEX IF EXISTS graftbound_attempts_one_open_v1;
DROP INDEX IF EXISTS graftbound_attempts_profile_v1;
DROP TABLE IF EXISTS graftbound_attempts_v1;
DROP TABLE IF EXISTS graftbound_challenges_v1;
DROP TABLE IF EXISTS graftbound_launch_v1;
