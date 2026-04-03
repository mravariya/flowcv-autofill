# FlowCV Autofill

Automate your [FlowCV](https://flowcv.com) resume filling using Playwright.

## Setup

```bash
npm install
npx playwright install chromium
```

Create a `.env` file (never committed):

```
FLOWCV_EMAIL=you@example.com
FLOWCV_PASSWORD=your-password
```

Edit `data/resume.json` with your resume data.

## Usage

```bash
# Normal run (opens browser, fills resume)
npm start

# Debug mode (pauses at each step so you can inspect)
npm run start:debug

# Headless (no visible browser)
npx ts-node src/index.ts --headless

# Custom resume file
npx ts-node src/index.ts path/to/my-resume.json
```

## Project Structure

```
src/
  index.ts        CLI entry point
  parser.ts       Loads & validates resume JSON
  automator.ts    Playwright browser automation
  selectors.ts    All FlowCV CSS selectors (single source of truth)
data/
  resume.json     Your resume data (template included)
```

## Flags

| Flag | Description |
|------|-------------|
| `--debug` | Pauses at each step with `page.pause()` for inspection |
| `--headless` | Runs without a visible browser window |

---

## Job Application Tracker

A Python module that lives in `tracker/` — track every job application you submit with an encrypted local database and a Streamlit dashboard.

### Setup

```bash
pip install -r tracker/requirements.txt
```

Generate an encryption key and add it to `.env`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste the output into `.env`:

```
ENCRYPTION_KEY=your-generated-key-here
```

### Run the Dashboard

```bash
streamlit run tracker/app.py
```

### CLI Usage

```bash
# Add an application
python tracker/cli.py add --company "Google" --role "SDE-2" --url "https://..."

# List all
python tracker/cli.py list

# View details
python tracker/cli.py view 1

# Update status
python tracker/cli.py status 1 "Interview Scheduled" --note "HR called"

# Export
python tracker/cli.py export --format csv

# Quick stats
python tracker/cli.py stats

# Launch dashboard from CLI
python tracker/cli.py dashboard
```

### How Encryption Works

All uploaded files (JDs, resumes, PDFs) are encrypted with Fernet symmetric encryption before being saved to disk. The `applications/` folder only ever contains `.enc` files — the raw originals are deleted immediately after encryption. The dashboard decrypts files on-the-fly into temporary memory when you click "View" or "Download". The same key is used for optional GitHub sync, where only `.enc` files are pushed.

> **Warning:** Back up your `ENCRYPTION_KEY` in a password manager. If you lose it, your encrypted files are unrecoverable.
