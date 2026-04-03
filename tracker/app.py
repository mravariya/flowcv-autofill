#!/usr/bin/env python3
"""Streamlit dashboard for the job-application tracker.

Run with:  streamlit run tracker/app.py
"""

from __future__ import annotations

import os
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tracker import db
from tracker.crypto import decrypt_file, encrypt_file
from tracker.models import (
    FOUND_ON_OPTIONS,
    VALID_STATUSES,
    WORK_MODE_OPTIONS,
    folder_name,
)

APPS_DIR = Path(__file__).resolve().parent.parent / "applications"

st.set_page_config(page_title="Job Tracker", page_icon="briefcase", layout="wide")

# ── Sidebar navigation ──────────────────────────────────────

PAGES = [
    "Dashboard",
    "Add Application",
    "All Applications",
    "View / Edit",
    "Export",
    "GitHub Sync",
]
page = st.sidebar.radio("Navigate", PAGES)


# ═══════════════════════════════════════════════════════════════
# PAGE 1 — Dashboard
# ═══════════════════════════════════════════════════════════════

if page == "Dashboard":
    st.title("Dashboard")

    stats = db.get_stats()
    by_status = stats["by_status"]

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total", stats["total"])
    c2.metric("Active", by_status.get("Applied", 0) + by_status.get("Follow-up Sent", 0))
    c3.metric("Interviews", by_status.get("Interview Scheduled", 0) + by_status.get("Interview Done", 0))
    c4.metric("Offers", by_status.get("Offer", 0))
    c5.metric("Response Rate", f"{stats['response_rate']}%")

    # Bar chart — by status
    if by_status:
        status_df = pd.DataFrame(
            list(by_status.items()), columns=["Status", "Count"]
        )
        fig_bar = px.bar(
            status_df,
            x="Status",
            y="Count",
            color="Status",
            title="Applications by Status",
        )
        fig_bar.update_layout(showlegend=False)
        st.plotly_chart(fig_bar, use_container_width=True)

    # Line chart — over time
    all_df = db.get_all_applications()
    if not all_df.empty and "apply_date" in all_df.columns:
        all_df["apply_date"] = pd.to_datetime(all_df["apply_date"], errors="coerce")
        timeline = (
            all_df.dropna(subset=["apply_date"])
            .groupby(all_df["apply_date"].dt.date)
            .size()
            .reset_index(name="Count")
        )
        timeline.columns = ["Date", "Count"]
        if not timeline.empty:
            fig_line = px.line(
                timeline, x="Date", y="Count", title="Applications Over Time"
            )
            st.plotly_chart(fig_line, use_container_width=True)

    # Follow-ups due
    st.subheader("Follow-ups Due")
    fups = db.get_follow_ups_due()
    if fups.empty:
        st.info("No follow-ups due today.")
    else:
        st.dataframe(
            fups[["id", "company", "designation", "apply_date", "follow_up_date"]],
            use_container_width=True,
        )

    # Recent applications
    st.subheader("Last 7 Days")
    recent = db.get_recent_applications(7)
    if recent.empty:
        st.info("No applications in the last 7 days.")
    else:
        st.dataframe(
            recent[["id", "company", "designation", "apply_date", "status", "location"]],
            use_container_width=True,
        )


# ═══════════════════════════════════════════════════════════════
# PAGE 2 — Add Application
# ═══════════════════════════════════════════════════════════════

elif page == "Add Application":
    st.title("Add Application")

    with st.form("add_form"):
        col1, col2 = st.columns(2)
        company = col1.text_input("Company *")
        designation = col2.text_input("Designation / Role *")

        col3, col4 = st.columns(2)
        job_url = col3.text_input("Job URL")
        found_on = col4.selectbox("Found On", [""] + FOUND_ON_OPTIONS)

        col5, col6 = st.columns(2)
        apply_date = col5.date_input("Apply Date", value=date.today())
        follow_up_date = col6.date_input(
            "Follow-up Date",
            value=apply_date + timedelta(days=7),
            help="Auto-set to apply date + 5 business days on save",
        )

        col7, col8 = st.columns(2)
        status = col7.selectbox("Status", VALID_STATUSES)
        location = col8.text_input("Location")

        col9, col10 = st.columns(2)
        remote_hybrid_onsite = col9.selectbox("Work Mode", [""] + WORK_MODE_OPTIONS)
        salary_expected = col10.text_input("Salary Expected")

        st.markdown("**Contact**")
        cc1, cc2, cc3 = st.columns(3)
        contact_name = cc1.text_input("Contact Name")
        contact_linkedin = cc2.text_input("Contact LinkedIn")
        contact_email = cc3.text_input("Contact Email")

        notes = st.text_area("Notes")

        st.markdown("**Job Description**")
        jd_text = st.text_area("Paste JD text (or upload below)")
        jd_file = st.file_uploader("Upload JD file (.txt / .pdf)", type=["txt", "pdf"])

        st.markdown("**Attachments**")
        md_file = st.file_uploader("Markdown resume (.md)", type=["md"])
        pdf_file = st.file_uploader("PDF resume (.pdf)", type=["pdf"])

        submitted = st.form_submit_button("Save Application")

    if submitted:
        if not company or not designation:
            st.error("Company and Designation are required.")
        else:
            apply_str = apply_date.isoformat()
            data: dict = {
                "company": company,
                "designation": designation,
                "job_url": job_url or None,
                "found_on": found_on or None,
                "apply_date": apply_str,
                "follow_up_date": follow_up_date.isoformat(),
                "status": status,
                "location": location or None,
                "remote_hybrid_onsite": remote_hybrid_onsite or None,
                "salary_expected": salary_expected or None,
                "contact_name": contact_name or None,
                "contact_linkedin": contact_linkedin or None,
                "contact_email": contact_email or None,
                "notes": notes or None,
            }

            slug = folder_name(company, apply_str)
            dest_dir = APPS_DIR / slug
            dest_dir.mkdir(parents=True, exist_ok=True)

            if jd_text:
                jd_tmp = dest_dir / "jd_raw.txt"
                jd_tmp.write_text(jd_text)
                enc = str(dest_dir / "jd.txt.enc")
                encrypt_file(str(jd_tmp), enc)
                jd_tmp.unlink()
                data["jd_file_path"] = enc

            if jd_file:
                jd_tmp = dest_dir / jd_file.name
                jd_tmp.write_bytes(jd_file.read())
                enc = str(dest_dir / "jd.txt.enc")
                encrypt_file(str(jd_tmp), enc)
                jd_tmp.unlink()
                data["jd_file_path"] = enc

            if md_file:
                md_tmp = dest_dir / md_file.name
                md_tmp.write_bytes(md_file.read())
                enc = str(dest_dir / "resume.md.enc")
                encrypt_file(str(md_tmp), enc)
                md_tmp.unlink()
                data["markdown_file_path"] = enc

            if pdf_file:
                pdf_tmp = dest_dir / pdf_file.name
                pdf_tmp.write_bytes(pdf_file.read())
                enc = str(dest_dir / "resume.pdf.enc")
                encrypt_file(str(pdf_tmp), enc)
                pdf_tmp.unlink()
                data["resume_pdf_path"] = enc

            data = {k: v for k, v in data.items() if v is not None}
            app_id = db.add_application(data)
            st.success(f"Saved! Application **#{app_id}** — {company} / {designation}")


# ═══════════════════════════════════════════════════════════════
# PAGE 3 — All Applications
# ═══════════════════════════════════════════════════════════════

elif page == "All Applications":
    st.title("All Applications")

    all_df = db.get_all_applications()
    if all_df.empty:
        st.info("No applications yet. Go to **Add Application** to get started.")
    else:
        # Filters
        fc1, fc2, fc3, fc4 = st.columns(4)
        search = fc1.text_input("Search (company / role)")
        status_filter = fc2.multiselect("Status", VALID_STATUSES)
        found_filter = fc3.multiselect("Found On", FOUND_ON_OPTIONS)
        mode_filter = fc4.multiselect("Work Mode", WORK_MODE_OPTIONS)

        dc1, dc2 = st.columns(2)
        date_from = dc1.date_input("From", value=date.today() - timedelta(days=90))
        date_to = dc2.date_input("To", value=date.today())

        filtered = all_df.copy()

        if search:
            mask = (
                filtered["company"].str.contains(search, case=False, na=False)
                | filtered["designation"].str.contains(search, case=False, na=False)
            )
            filtered = filtered[mask]

        if status_filter:
            filtered = filtered[filtered["status"].isin(status_filter)]

        if found_filter:
            filtered = filtered[filtered["found_on"].isin(found_filter)]

        if mode_filter:
            filtered = filtered[filtered["remote_hybrid_onsite"].isin(mode_filter)]

        if "apply_date" in filtered.columns:
            filtered["apply_date_dt"] = pd.to_datetime(filtered["apply_date"], errors="coerce")
            filtered = filtered[
                (filtered["apply_date_dt"] >= pd.Timestamp(date_from))
                & (filtered["apply_date_dt"] <= pd.Timestamp(date_to))
            ]
            filtered = filtered.drop(columns=["apply_date_dt"])

        display_cols = [
            "id", "company", "designation", "apply_date",
            "follow_up_date", "status", "location",
        ]
        display_cols = [c for c in display_cols if c in filtered.columns]

        st.dataframe(filtered[display_cols], use_container_width=True)

        st.markdown("---")
        st.markdown("Select an application ID above, then go to **View / Edit** to see details.")

        # Quick actions row
        ac1, ac2 = st.columns(2)
        arch_id = ac1.number_input("Archive application #", min_value=1, step=1, key="arch_id")
        if ac1.button("Archive"):
            db.delete_application(int(arch_id))
            st.success(f"Application #{int(arch_id)} archived.")
            st.rerun()


# ═══════════════════════════════════════════════════════════════
# PAGE 4 — View / Edit Application
# ═══════════════════════════════════════════════════════════════

elif page == "View / Edit":
    st.title("View / Edit Application")

    app_id = st.number_input("Application ID", min_value=1, step=1, value=1)
    app = db.get_application(int(app_id))

    if not app:
        st.warning(f"Application #{app_id} not found.")
    else:
        editing = st.toggle("Edit mode")

        if not editing:
            # Read-only view
            r1, r2 = st.columns(2)
            r1.markdown(f"**Company:** {app['company']}")
            r2.markdown(f"**Role:** {app['designation']}")

            r3, r4 = st.columns(2)
            r3.markdown(f"**Status:** {app['status']}")
            r4.markdown(f"**Apply Date:** {app['apply_date']}")

            r5, r6 = st.columns(2)
            r5.markdown(f"**Follow-up:** {app['follow_up_date']}")
            r6.markdown(f"**Location:** {app.get('location', '—')}")

            if app.get("job_url"):
                st.markdown(f"**Job URL:** [{app['job_url']}]({app['job_url']})")

            if app.get("notes"):
                st.markdown(f"**Notes:** {app['notes']}")

            if app.get("salary_expected") or app.get("salary_offered"):
                s1, s2 = st.columns(2)
                s1.markdown(f"**Salary Expected:** {app.get('salary_expected', '—')}")
                s2.markdown(f"**Salary Offered:** {app.get('salary_offered', '—')}")

            # Decrypted file viewers
            st.subheader("Files")
            fc1, fc2, fc3 = st.columns(3)

            if app.get("jd_file_path") and Path(app["jd_file_path"]).exists():
                if fc1.button("View JD"):
                    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp:
                        decrypt_file(app["jd_file_path"], tmp.name)
                        st.text_area("Job Description", Path(tmp.name).read_text(), height=300)

            if app.get("markdown_file_path") and Path(app["markdown_file_path"]).exists():
                if fc2.button("Download Resume MD"):
                    with tempfile.NamedTemporaryFile(suffix=".md", delete=False) as tmp:
                        decrypt_file(app["markdown_file_path"], tmp.name)
                        data = Path(tmp.name).read_bytes()
                        st.download_button("Download .md", data, file_name="resume.md")

            if app.get("resume_pdf_path") and Path(app["resume_pdf_path"]).exists():
                if fc3.button("Download Resume PDF"):
                    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                        decrypt_file(app["resume_pdf_path"], tmp.name)
                        data = Path(tmp.name).read_bytes()
                        st.download_button("Download .pdf", data, file_name="resume.pdf")

            # Quick action
            if app["status"] == "Applied":
                if st.button("Mark Follow-up Done"):
                    db.update_application(
                        int(app_id),
                        {"status": "Follow-up Sent", "_status_note": "Marked from dashboard"},
                    )
                    st.success("Marked as Follow-up Sent.")
                    st.rerun()

        else:
            # Edit mode
            with st.form("edit_form"):
                e1, e2 = st.columns(2)
                new_company = e1.text_input("Company", value=app["company"])
                new_desig = e2.text_input("Designation", value=app["designation"])

                e3, e4 = st.columns(2)
                new_status = e3.selectbox(
                    "Status",
                    VALID_STATUSES,
                    index=VALID_STATUSES.index(app["status"]) if app["status"] in VALID_STATUSES else 0,
                )
                new_location = e4.text_input("Location", value=app.get("location") or "")

                e5, e6 = st.columns(2)
                new_url = e5.text_input("Job URL", value=app.get("job_url") or "")
                new_found = e6.selectbox(
                    "Found On",
                    [""] + FOUND_ON_OPTIONS,
                    index=(FOUND_ON_OPTIONS.index(app["found_on"]) + 1) if app.get("found_on") in FOUND_ON_OPTIONS else 0,
                )

                e7, e8 = st.columns(2)
                new_salary_exp = e7.text_input("Salary Expected", value=app.get("salary_expected") or "")
                new_salary_off = e8.text_input("Salary Offered", value=app.get("salary_offered") or "")

                new_mode = st.selectbox(
                    "Work Mode",
                    [""] + WORK_MODE_OPTIONS,
                    index=(WORK_MODE_OPTIONS.index(app["remote_hybrid_onsite"]) + 1) if app.get("remote_hybrid_onsite") in WORK_MODE_OPTIONS else 0,
                )

                st.markdown("**Contact**")
                nc1, nc2, nc3 = st.columns(3)
                new_contact = nc1.text_input("Name", value=app.get("contact_name") or "")
                new_linkedin = nc2.text_input("LinkedIn", value=app.get("contact_linkedin") or "")
                new_cemail = nc3.text_input("Email", value=app.get("contact_email") or "")

                new_notes = st.text_area("Notes", value=app.get("notes") or "")
                status_note = st.text_input("Status change note (optional)")

                if st.form_submit_button("Save Changes"):
                    updates: dict = {
                        "company": new_company,
                        "designation": new_desig,
                        "status": new_status,
                        "location": new_location or None,
                        "job_url": new_url or None,
                        "found_on": new_found or None,
                        "salary_expected": new_salary_exp or None,
                        "salary_offered": new_salary_off or None,
                        "remote_hybrid_onsite": new_mode or None,
                        "contact_name": new_contact or None,
                        "contact_linkedin": new_linkedin or None,
                        "contact_email": new_cemail or None,
                        "notes": new_notes or None,
                    }
                    if status_note:
                        updates["_status_note"] = status_note
                    db.update_application(int(app_id), updates)
                    st.success("Updated!")
                    st.rerun()

        # Status history (always shown)
        st.subheader("Status History")
        history = db.get_status_history(int(app_id))
        if history.empty:
            st.info("No status changes recorded.")
        else:
            for _, row in history.iterrows():
                note_str = f" — _{row['note']}_" if row["note"] else ""
                old = row["old_status"] or "—"
                st.markdown(f"- **{row['changed_at'][:16]}**: {old} → **{row['new_status']}**{note_str}")


# ═══════════════════════════════════════════════════════════════
# PAGE 5 — Export
# ═══════════════════════════════════════════════════════════════

elif page == "Export":
    st.title("Export Applications")

    all_df = db.get_all_applications()
    if all_df.empty:
        st.info("Nothing to export.")
    else:
        st.subheader("Preview (first 5 rows)")
        st.dataframe(all_df.head(5), use_container_width=True)

        ex1, ex2 = st.columns(2)

        csv_data = all_df.to_csv(index=False).encode()
        ex1.download_button("Export CSV", csv_data, file_name="applications.csv", mime="text/csv")

        json_data = all_df.to_json(orient="records", indent=2).encode()
        ex2.download_button("Export JSON", json_data, file_name="applications.json", mime="application/json")


# ═══════════════════════════════════════════════════════════════
# PAGE 6 — GitHub Sync
# ═══════════════════════════════════════════════════════════════

elif page == "GitHub Sync":
    st.title("GitHub Sync")
    st.caption("Push/pull encrypted files to a private GitHub repo. Raw files and .env are never synced.")

    from tracker import github_sync

    last = github_sync.last_sync_time()
    if last:
        st.info(f"Last synced: {last}")
    else:
        st.info("Never synced.")

    gs1, gs2, gs3 = st.columns(3)
    repo_input = gs1.text_input("Repo (user/repo)", value=os.getenv("GITHUB_REPO", ""))
    branch_input = gs2.text_input("Branch", value="main")
    folder_input = gs3.text_input("Remote folder", value="backup")

    p1, p2 = st.columns(2)

    if p1.button("Push to GitHub"):
        try:
            pushed = github_sync.push(branch=branch_input, folder=folder_input)
            st.success(f"Pushed {len(pushed)} file(s).")
            for f in pushed:
                st.text(f"  {f}")
        except Exception as e:
            st.error(str(e))

    if p2.button("Pull from GitHub"):
        try:
            pulled = github_sync.pull(branch=branch_input, folder=folder_input)
            st.success(f"Pulled {len(pulled)} file(s).")
            for f in pulled:
                st.text(f"  {f}")
        except Exception as e:
            st.error(str(e))
