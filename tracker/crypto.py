"""Fernet symmetric encryption for files and text.

Key is loaded from the ENCRYPTION_KEY env var.
Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

from __future__ import annotations

import os
from pathlib import Path

from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

_KEY: str | None = os.getenv("ENCRYPTION_KEY")


def _fernet() -> Fernet:
    if not _KEY:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set in .env. "
            "Generate one: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(_KEY.encode())


def encrypt_file(source_path: str, dest_path: str) -> str:
    """Read *source_path*, encrypt, write to *dest_path*. Returns *dest_path*."""
    data = Path(source_path).read_bytes()
    encrypted = _fernet().encrypt(data)
    Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
    Path(dest_path).write_bytes(encrypted)
    return dest_path


def decrypt_file(enc_path: str, dest_path: str) -> str:
    """Read encrypted *enc_path*, decrypt, write to *dest_path*. Returns *dest_path*."""
    token = Path(enc_path).read_bytes()
    decrypted = _fernet().decrypt(token)
    Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
    Path(dest_path).write_bytes(decrypted)
    return dest_path


def encrypt_text(text: str) -> str:
    """Encrypt a string and return the base64 token as a string."""
    return _fernet().encrypt(text.encode()).decode()


def decrypt_text(token: str) -> str:
    """Decrypt a base64 token string back to plaintext."""
    return _fernet().decrypt(token.encode()).decode()
