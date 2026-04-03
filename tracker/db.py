"""SQLite CRUD for the job-application tracker.

Database file lives at tracker/applications.db (gitignored).
"""

from __future__ import annotations

import os
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

DB_PATH = Path(__file__).parent / "applications.db"

# ── Schema ───────────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS applications (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company             TEXT NOT NULL,
    designation         TEXT NOT NULL,
    job_url             TEXT,
    found_on            TEXT,
    apply_date          TEXT,
    follow_up_date      TEXT,
    status              TEXT DEFAULT 'Applied',
    contact_name        TEXT,
    contact_linkedin    TEXT,
    contact_email       TEXT,
    jd_file_path        TEXT,
    markdown_file_path  TEXT,
    resume_pdf_path     TEXT,
    notes               TEXT,
    salary_expected     TEXT,
    salary_offered      TEXT,
    location            TEXT,
    remote_hybrid_onsite TEXT,
    created_at          TEXT,
    updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS status_history (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id    INTEGER REFERENCES applications(id),
    old_status        TEXT,
    new_status        TEXT,
    changed_at        TEXT,
    note              TEXT
);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(_SCHEMA)


# auto-init on first import
init_db()

# ── Helpers ──────────────────────────────────────────────────


def _add_business_days(start: date, days: int) -> date:
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Mon-Fri
            added += 1
    return current


def _now_iso() -> str:
    return datetime.now().isoformat()


# ── CRUD ─────────────────────────────────────────────────────


def add_application(data: dict) -> int:
    """Insert a new application. Returns the new row id."""
    now = _now_iso()
    data.setdefault("apply_date", date.today().isoformat())
    data.setdefault("created_at", now)
    data.setdefault("updated_at", now)
    data.setdefault("status", "Applied")

    if not data.get("follow_up_date"):
        apply = date.fromisoformat(data["apply_date"])
        data["follow_up_date"] = _add_business_days(apply, 5).isoformat()

    cols = list(data.keys())
    placeholders = ", ".join("?" for _ in cols)
    sql = f"INSERT INTO applications ({', '.join(cols)}) VALUES ({placeholders})"

    with _connect() as conn:
        cur = conn.execute(sql, [data[c] for c in cols])
        app_id = cur.lastrowid

        conn.execute(
            "INSERT INTO status_history (application_id, old_status, new_status, changed_at, note) "
            "VALUES (?, ?, ?, ?, ?)",
            (app_id, None, data["status"], now, "Initial entry"),
        )

    return app_id  # type: ignore[return-value]


def get_all_applications() -> pd.DataFrame:
    with _connect() as conn:
        return pd.read_sql_query(
            "SELECT * FROM applications WHERE status != 'Archived' ORDER BY apply_date DESC",
            conn,
        )


def get_application(app_id: int) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
    return dict(row) if row else None


def update_application(app_id: int, data: dict) -> None:
    """Update fields on an application. If status changed, logs to status_history."""
    now = _now_iso()
    data["updated_at"] = now

    old = get_application(app_id)
    if not old:
        raise ValueError(f"Application {app_id} not found")

    old_status = old["status"]
    new_status = data.get("status", old_status)

    status_note = data.pop("_status_note", "")

    cols = list(data.keys())
    setters = ", ".join(f"{c} = ?" for c in cols)
    sql = f"UPDATE applications SET {setters} WHERE id = ?"

    with _connect() as conn:
        conn.execute(sql, [data[c] for c in cols] + [app_id])

        if new_status != old_status:
            conn.execute(
                "INSERT INTO status_history (application_id, old_status, new_status, changed_at, note) "
                "VALUES (?, ?, ?, ?, ?)",
                (app_id, old_status, new_status, now, status_note),
            )


def delete_application(app_id: int) -> None:
    """Soft delete — sets status to Archived."""
    update_application(app_id, {"status": "Archived"})


def get_status_history(app_id: int) -> pd.DataFrame:
    with _connect() as conn:
        return pd.read_sql_query(
            "SELECT * FROM status_history WHERE application_id = ? ORDER BY changed_at DESC",
            conn,
            params=(app_id,),
        )


def export_to_csv(filepath: str) -> None:
    df = get_all_applications()
    df.to_csv(filepath, index=False)


def export_to_json(filepath: str) -> None:
    df = get_all_applications()
    df.to_json(filepath, orient="records", indent=2)


def get_stats() -> dict:
    with _connect() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM applications WHERE status != 'Archived'"
        ).fetchone()[0]

        rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM applications "
            "WHERE status != 'Archived' GROUP BY status"
        ).fetchall()
        by_status = {r["status"]: r["cnt"] for r in rows}

        responded_statuses = (
            "Interview Scheduled",
            "Interview Done",
            "Assignment",
            "Offer",
            "Rejected",
        )
        responded = sum(by_status.get(s, 0) for s in responded_statuses)
        response_rate = (responded / total * 100) if total else 0.0

        avg_row = conn.execute(
            "SELECT AVG(julianday(sh.changed_at) - julianday(a.apply_date)) as avg_days "
            "FROM status_history sh "
            "JOIN applications a ON sh.application_id = a.id "
            "WHERE sh.new_status IN ('Interview Scheduled','Interview Done','Assignment','Offer','Rejected') "
            "AND sh.old_status = 'Applied'"
        ).fetchone()
        avg_days = round(avg_row["avg_days"], 1) if avg_row["avg_days"] else None

    return {
        "total": total,
        "by_status": by_status,
        "response_rate": round(response_rate, 1),
        "avg_days_to_response": avg_days,
    }


def get_follow_ups_due() -> pd.DataFrame:
    """Applications where follow_up_date <= today and status is still Applied."""
    today = date.today().isoformat()
    with _connect() as conn:
        return pd.read_sql_query(
            "SELECT * FROM applications "
            "WHERE follow_up_date <= ? AND status = 'Applied' "
            "ORDER BY follow_up_date",
            conn,
            params=(today,),
        )


def get_recent_applications(days: int = 7) -> pd.DataFrame:
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    with _connect() as conn:
        return pd.read_sql_query(
            "SELECT * FROM applications "
            "WHERE apply_date >= ? AND status != 'Archived' "
            "ORDER BY apply_date DESC",
            conn,
            params=(cutoff,),
        )
