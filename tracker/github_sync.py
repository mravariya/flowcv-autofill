"""Optional GitHub push/pull of encrypted (.enc) files.

Requires GITHUB_TOKEN and GITHUB_REPO in .env.
Never pushes .env or raw (unencrypted) files.
"""

from __future__ import annotations

import base64
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN: str | None = os.getenv("GITHUB_TOKEN")
GITHUB_REPO: str | None = os.getenv("GITHUB_REPO")

APPS_DIR = Path(__file__).resolve().parent.parent / "applications"
DB_PATH = Path(__file__).resolve().parent / "applications.db"
SYNC_TIMESTAMP_FILE = Path(__file__).resolve().parent / ".last_sync"


def _get_github():
    """Lazily import and return authenticated Github + repo objects."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        raise RuntimeError("GITHUB_TOKEN and GITHUB_REPO must be set in .env")

    from github import Github

    g = Github(GITHUB_TOKEN)
    return g, g.get_repo(GITHUB_REPO)


def push(branch: str = "main", folder: str = "backup") -> list[str]:
    """Push all .enc files + encrypted DB to the repo. Returns list of pushed paths."""
    from tracker.crypto import encrypt_file

    _, repo = _get_github()
    pushed: list[str] = []

    enc_files = list(APPS_DIR.rglob("*.enc"))

    if DB_PATH.exists():
        enc_db = str(DB_PATH) + ".enc"
        encrypt_file(str(DB_PATH), enc_db)
        enc_files.append(Path(enc_db))

    for fpath in enc_files:
        rel = fpath.relative_to(fpath.parents[2]) if "applications" in fpath.parts else fpath.name
        remote_path = f"{folder}/{rel}"
        content = base64.b64encode(fpath.read_bytes()).decode()

        try:
            existing = repo.get_contents(remote_path, ref=branch)
            repo.update_file(
                remote_path,
                f"sync: update {rel}",
                fpath.read_bytes(),
                existing.sha,
                branch=branch,
            )
        except Exception:
            repo.create_file(
                remote_path,
                f"sync: add {rel}",
                fpath.read_bytes(),
                branch=branch,
            )
        pushed.append(remote_path)

    _write_timestamp()
    return pushed


def pull(branch: str = "main", folder: str = "backup") -> list[str]:
    """Pull .enc files from repo and restore locally. Returns list of restored paths."""
    from tracker.crypto import decrypt_file

    _, repo = _get_github()
    pulled: list[str] = []

    try:
        contents = repo.get_contents(folder, ref=branch)
    except Exception:
        return pulled

    items = contents if isinstance(contents, list) else [contents]

    while items:
        item = items.pop()
        if item.type == "dir":
            sub = repo.get_contents(item.path, ref=branch)
            items.extend(sub if isinstance(sub, list) else [sub])
            continue

        if not item.name.endswith(".enc"):
            continue

        rel_path = item.path.removeprefix(f"{folder}/")
        local_path = APPS_DIR.parent / rel_path
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(item.decoded_content)
        pulled.append(str(local_path))

    # Restore DB if present
    enc_db = APPS_DIR.parent / "tracker" / "applications.db.enc"
    if enc_db.exists():
        decrypt_file(str(enc_db), str(DB_PATH))
        enc_db.unlink()

    _write_timestamp()
    return pulled


def last_sync_time() -> Optional[str]:
    if SYNC_TIMESTAMP_FILE.exists():
        return SYNC_TIMESTAMP_FILE.read_text().strip()
    return None


def _write_timestamp() -> None:
    SYNC_TIMESTAMP_FILE.write_text(datetime.now().isoformat())
