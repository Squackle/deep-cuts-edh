-- One-time upgrade, October 13 2026: both featured and open-format rescue events.
-- Apply once after checking PRAGMA table_info(community_challenges).
ALTER TABLE community_challenges ADD COLUMN format TEXT NOT NULL DEFAULT 'commander' CHECK(format IN ('commander','open'));
INSERT OR IGNORE INTO community_challenges(id,title,commander,opens_at,closes_at,status,format)
VALUES('open-001','Open Case Showcase — Experimental Builds','Open Format','2026-10-13 00:00:00','2026-11-13 23:59:59','active','open');
