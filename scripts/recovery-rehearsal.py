"""Isolated SQLite restore rehearsal using only repository DDL + generated fixtures.

No cloud credentials, remote connection, user-supplied DB path, production export,
or real player data is accepted. This proves local recovery logic, not D1 Time Travel.
"""
from pathlib import Path
import hashlib
import sqlite3
import tempfile
import sys

ROOT = Path(__file__).resolve().parents[1]
PROFILES = {
    "community": ("db/schema.sql", "db/community.sql"),
    "hive": ("games/hive-run/db/leaderboard.sql",),
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def connect(path, readonly=False):
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) if readonly else sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def check(connection):
    require(connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)], "SQLite integrity check failed")
    require(not connection.execute("PRAGMA foreign_key_check").fetchall(), "Foreign key check failed")


def logical_digest(connection):
    # iterdump includes schema, indices, seed data and synthetic rows; no real data is ever read.
    return hashlib.sha256("\n".join(connection.iterdump()).encode("utf-8")).hexdigest()


def seed(connection, name):
    for schema in PROFILES[name]:
        connection.executescript((ROOT / schema).read_text(encoding="utf-8"))
    if name == "community":
        connection.execute("INSERT INTO nominations(id,slug,name) VALUES (9001,'qa-only','Synthetic nominee')")
        connection.execute("INSERT INTO nomination_votes(nomination_id,visitor_hash) VALUES (9001,'fixture-voter')")
        connection.execute("INSERT INTO community_profiles(id,handle,key_hash) VALUES ('qa-profile','qa-only','synthetic-not-a-key')")
        connection.execute("INSERT INTO community_decks(id,owner_id,title,commander,content) VALUES ('qa-deck','qa-profile','Fixture','Fixture commander','[]')")
        connection.execute("INSERT INTO community_deck_versions(deck_id,version,content) VALUES ('qa-deck',1,'[]')")
    else:
        connection.execute("INSERT INTO hive_sessions(token,seed,issued_at,subject) VALUES ('qa-alpha',42,1,'fixture')")
        connection.execute("INSERT INTO hive_scores(id,session_token,alias,score,kills,evolutions,ticks,rules_version,created_at) VALUES ('qa-old','qa-alpha','Fixture',100,2,1,30,'hive-0.3',1)")
        connection.execute("INSERT INTO hive_sessions_v1(token,seed,issued_at,subject,mode,rules_version) VALUES ('qa-v1',43,2,'fixture','brood','hive-1.3')")
        connection.execute("INSERT INTO hive_scores_v1(id,session_token,alias,score,kills,evolutions,ticks,rules_version,mode,created_at) VALUES ('qa-new','qa-v1','Fixture',200,3,1,40,'hive-1.3','brood',2)")
    connection.commit()


def validate_fixture(connection, name):
    check(connection)
    if name == "community":
        require(connection.execute("SELECT COUNT(*) FROM nomination_votes WHERE nomination_id=9001").fetchone()[0] == 1, "nomination votes not restored")
        require(connection.execute("SELECT COUNT(*) FROM community_deck_versions WHERE deck_id='qa-deck'").fetchone()[0] == 1, "deck history not restored")
    else:
        require(connection.execute("SELECT rules_version FROM hive_scores WHERE id='qa-old'").fetchone() == ("hive-0.3",), "historical score not restored")
        require(connection.execute("SELECT rules_version,mode FROM hive_scores_v1 WHERE id='qa-new'").fetchone() == ("hive-1.3", "brood"), "versioned score not restored")


def restore(source, target):
    require(not target.exists(), "restore destination must not already exist")
    with connect(source, readonly=True) as snapshot:
        check(snapshot)
        with connect(target) as restored:
            snapshot.backup(restored)
            check(restored)


def rehearse(directory, name):
    source = directory / (name + "-source.sqlite")
    backup = directory / (name + "-snapshot.sqlite")
    target = directory / (name + "-restored.sqlite")
    with connect(source) as original, connect(backup) as snapshot:
        seed(original, name)
        validate_fixture(original, name)
        expected = logical_digest(original)
        original.backup(snapshot)
        check(snapshot)
        require(logical_digest(snapshot) == expected, "backup logical digest differs")
        # Deliberate loss only in generated source. The snapshot remains read-only.
        if name == "community":
            original.execute("DELETE FROM nominations WHERE id=9001")
            original.execute("DELETE FROM community_profiles WHERE id='qa-profile'")
        else:
            original.execute("DELETE FROM hive_scores WHERE id='qa-old'")
            original.execute("DELETE FROM hive_scores_v1 WHERE id='qa-new'")
        original.commit()
        require(logical_digest(original) != expected, "simulated loss did not alter fixture")
    restore(backup, target)
    with connect(target, readonly=True) as recovered:
        validate_fixture(recovered, name)
        require(logical_digest(recovered) == expected, "restored logical digest differs")
    # An existing destination is rejected, even if it is another synthetic file.
    try:
        restore(backup, target)
    except RuntimeError as error:
        require("already exist" in str(error), "unexpected negative-path error")
    else:
        raise RuntimeError("restore overwrote an existing destination")
    with connect(target, readonly=True) as recovered:
        require(logical_digest(recovered) == expected, "existing restore changed after rejection")
    return expected


def main():
    require(len(sys.argv) == 1, "No arguments accepted; never supply a real database path")
    with tempfile.TemporaryDirectory(prefix="deepcuts-synthetic-recovery-") as temp:
        directory = Path(temp)
        for name in PROFILES:
            digest = rehearse(directory, name)
            print(f"PASS {name}: backup, simulated loss, restore, integrity, fixture history, digest {digest}, overwrite rejection")
        bad = directory / "invalid.sqlite"
        bad.write_bytes(b"synthetic invalid snapshot")
        rejected_target = directory / "invalid-restored.sqlite"
        try:
            restore(bad, rejected_target)
        except sqlite3.DatabaseError:
            require(not rejected_target.exists(), "invalid snapshot left a restore destination")
            print("PASS invalid snapshot rejected before destination creation")
        else:
            raise RuntimeError("invalid snapshot accepted")
    print("Synthetic local restore rehearsal passed. No production D1, records, or Time Travel accessed.")


if __name__ == "__main__":
    main()
