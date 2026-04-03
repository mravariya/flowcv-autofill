#!/usr/bin/env python3
"""CLI for the job-application tracker.

Usage examples:
    python tracker/cli.py add --company "Google" --role "SDE-2" --url "https://..." --jd jd.txt --md resume.md --pdf resume.pdf
    python tracker/cli.py list
    python tracker/cli.py view 3
    python tracker/cli.py status 3 "Interview Scheduled" --note "HR called"
    python tracker/cli.py export --format csv
    python tracker/cli.py dashboard
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

# Ensure the project root is on sys.path so `tracker.*` imports work
# when invoked as `python tracker/cli.py` from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tracker import db
from tracker.crypto import encrypt_file
from tracker.models import (
    FOUND_ON_OPTIONS,
    VALID_STATUSES,
    WORK_MODE_OPTIONS,
    folder_name,
)

APPS_DIR = Path(__file__).resolve().parent.parent / "applications"


def _save_file(src: str, company: str, apply_dt: str, dest_name: str) -> str:
    """Encrypt *src* into the canonical applications subfolder. Returns the .enc path."""
    folder = APPS_DIR / folder_name(company, apply_dt)
    folder.mkdir(parents=True, exist_ok=True)
    dest = str(folder / f"{dest_name}.enc")
    encrypt_file(src, dest)
    return dest


# ── Commands ─────────────────────────────────────────────────


def cmd_add(args: argparse.Namespace) -> None:
    apply_dt = args.apply_date or date.today().isoformat()

    data: dict = {
        "company": args.company,
        "designation": args.role,
        "job_url": args.url,
        "found_on": args.found_on,
        "apply_date": apply_dt,
        "status": args.status or "Applied",
        "location": args.location,
        "remote_hybrid_onsite": args.mode,
        "salary_expected": args.salary,
        "contact_name": args.contact,
        "contact_linkedin": args.linkedin,
        "contact_email": args.contact_email,
        "notes": args.notes,
    }

    if args.jd:
        data["jd_file_path"] = _save_file(args.jd, args.company, apply_dt, "jd.txt")
    if args.md:
        data["markdown_file_path"] = _save_file(args.md, args.company, apply_dt, "resume.md")
    if args.pdf:
        data["resume_pdf_path"] = _save_file(args.pdf, args.company, apply_dt, "resume.pdf")

    # strip None values
    data = {k: v for k, v in data.items() if v is not None}

    app_id = db.add_application(data)
    print(f"Added application #{app_id} — {args.company} / {args.role}")


def cmd_list(args: argparse.Namespace) -> None:
    df = db.get_all_applications()
    if df.empty:
        print("No applications yet.")
        return

    cols = ["id", "company", "designation", "apply_date", "follow_up_date", "status", "location"]
    display = [c for c in cols if c in df.columns]
    print(df[display].to_string(index=False))


def cmd_view(args: argparse.Namespace) -> None:
    app = db.get_application(args.id)
    if not app:
        print(f"Application #{args.id} not found.")
        return
    for k, v in app.items():
        if v is not None:
            print(f"  {k:>22s}: {v}")

    history = db.get_status_history(args.id)
    if not history.empty:
        print("\n  Status history:")
        for _, row in history.iterrows():
            note = f" — {row['note']}" if row["note"] else ""
            print(f"    {row['changed_at']}  {row['old_status']} → {row['new_status']}{note}")


def cmd_status(args: argparse.Namespace) -> None:
    data: dict = {"status": args.new_status}
    if args.note:
        data["_status_note"] = args.note
    db.update_application(args.id, data)
    print(f"Application #{args.id} → {args.new_status}")


def cmd_export(args: argparse.Namespace) -> None:
    fmt = args.format or "csv"
    out = args.output or f"applications_export.{fmt}"
    if fmt == "csv":
        db.export_to_csv(out)
    else:
        db.export_to_json(out)
    print(f"Exported to {out}")


def cmd_dashboard(_args: argparse.Namespace) -> None:
    app_path = Path(__file__).parent / "app.py"
    subprocess.run(["streamlit", "run", str(app_path)], check=True)


def cmd_stats(_args: argparse.Namespace) -> None:
    s = db.get_stats()
    print(f"  Total active : {s['total']}")
    print(f"  Response rate: {s['response_rate']}%")
    if s["avg_days_to_response"]:
        print(f"  Avg days to response: {s['avg_days_to_response']}")
    print("  By status:")
    for status, count in s["by_status"].items():
        print(f"    {status:>22s}: {count}")


# ── Argument parser ──────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="tracker", description="Job Application Tracker")
    sub = root.add_subparsers(dest="command")

    # add
    p_add = sub.add_parser("add", help="Add a new application")
    p_add.add_argument("--company", required=True)
    p_add.add_argument("--role", required=True)
    p_add.add_argument("--url")
    p_add.add_argument("--found-on", dest="found_on", choices=FOUND_ON_OPTIONS)
    p_add.add_argument("--apply-date", dest="apply_date")
    p_add.add_argument("--status", choices=VALID_STATUSES)
    p_add.add_argument("--location")
    p_add.add_argument("--mode", choices=WORK_MODE_OPTIONS)
    p_add.add_argument("--salary")
    p_add.add_argument("--contact")
    p_add.add_argument("--linkedin")
    p_add.add_argument("--contact-email", dest="contact_email")
    p_add.add_argument("--notes")
    p_add.add_argument("--jd", help="Path to JD text/pdf file")
    p_add.add_argument("--md", help="Path to markdown resume")
    p_add.add_argument("--pdf", help="Path to PDF resume")

    # list
    sub.add_parser("list", help="List all applications")

    # view
    p_view = sub.add_parser("view", help="View application details")
    p_view.add_argument("id", type=int)

    # status
    p_status = sub.add_parser("status", help="Update application status")
    p_status.add_argument("id", type=int)
    p_status.add_argument("new_status", choices=VALID_STATUSES)
    p_status.add_argument("--note")

    # export
    p_export = sub.add_parser("export", help="Export applications")
    p_export.add_argument("--format", choices=["csv", "json"], default="csv")
    p_export.add_argument("--output", "-o")

    # stats
    sub.add_parser("stats", help="Show summary statistics")

    # dashboard
    sub.add_parser("dashboard", help="Launch Streamlit dashboard")

    return root


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    commands = {
        "add": cmd_add,
        "list": cmd_list,
        "view": cmd_view,
        "status": cmd_status,
        "export": cmd_export,
        "stats": cmd_stats,
        "dashboard": cmd_dashboard,
    }

    handler = commands.get(args.command)
    if not handler:
        parser.print_help()
        return

    handler(args)


if __name__ == "__main__":
    main()
