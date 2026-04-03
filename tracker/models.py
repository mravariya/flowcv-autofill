from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from typing import Optional

VALID_STATUSES = [
    "Applied",
    "Follow-up Sent",
    "Interview Scheduled",
    "Interview Done",
    "Assignment",
    "Offer",
    "Rejected",
    "Ghosted",
    "Withdrawn",
    "Archived",
]

FOUND_ON_OPTIONS = [
    "LinkedIn",
    "Naukri",
    "Referral",
    "Company Site",
    "AngelList",
    "Other",
]

WORK_MODE_OPTIONS = ["Remote", "Hybrid", "Onsite"]


@dataclass
class Application:
    company: str
    designation: str
    job_url: Optional[str] = None
    found_on: Optional[str] = None
    apply_date: Optional[str] = None
    follow_up_date: Optional[str] = None
    status: str = "Applied"
    contact_name: Optional[str] = None
    contact_linkedin: Optional[str] = None
    contact_email: Optional[str] = None
    jd_file_path: Optional[str] = None
    markdown_file_path: Optional[str] = None
    resume_pdf_path: Optional[str] = None
    notes: Optional[str] = None
    salary_expected: Optional[str] = None
    salary_offered: Optional[str] = None
    location: Optional[str] = None
    remote_hybrid_onsite: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    id: Optional[int] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class StatusChange:
    application_id: int
    old_status: str
    new_status: str
    changed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    note: Optional[str] = None
    id: Optional[int] = None


def make_slug(company: str) -> str:
    """Turn company name into a filesystem-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", company.lower()).strip("-")


def folder_name(company: str, apply_date: str) -> str:
    """Canonical subfolder name under applications/."""
    return f"{make_slug(company)}_{apply_date}"
