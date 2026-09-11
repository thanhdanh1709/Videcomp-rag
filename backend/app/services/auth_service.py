from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import os
import re
from typing import Any

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.config import settings
from ..db.models import UserRecord


def hash_password(password: str) -> str:
    """Ma hoa mat khau su dung PBKDF2 HMAC SHA-256 chuan bao mat cao."""
    salt = os.urandom(16)
    salt_hex = salt.hex()
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    key_hex = key.hex()
    return f"pbkdf2_sha256$100000${salt_hex}${key_hex}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Xac thuc mat khau voi chuoi hash."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_key = parts[3]
        computed_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations).hex()
        return hmac.compare_digest(expected_key, computed_key)
    except Exception:
        return False


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Kiem tra do phuc tap cua mat khau:
    - It nhat 8 ky tu
    - Co chu in hoa
    - Co chu in thuong
    - Co so
    - Co ky tu dac biet
    """
    if len(password) < 8:
        return False, "Mật khẩu phải có độ dài ít nhất 8 ký tự."
    if not re.search(r"[A-Z]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 chữ cái in hoa (A-Z)."
    if not re.search(r"[a-z]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 chữ cái in thường (a-z)."
    if not re.search(r"[0-9]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 chữ số (0-9)."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-\+=~`\[\]/\\]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)."
    return True, ""


def create_access_token(data: dict[str, Any], expires_delta: dt.timedelta | None = None) -> str:
    """Tao JSON Web Token (JWT) voi thoi gian het han."""
    to_encode = data.copy()
    if expires_delta:
        expire = dt.datetime.now(dt.timezone.utc) + expires_delta
    else:
        expire = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=settings.jwt_expire_minutes)
    to_encode.update({"exp": expire, "iat": dt.datetime.now(dt.timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Giai ma va kiem tra tinh hop le cua JWT token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except Exception:
        return None


def get_user_by_username(db: Session, username: str) -> UserRecord | None:
    stmt = select(UserRecord).where(UserRecord.username == username.strip().lower())
    return db.scalars(stmt).first()


def get_user_by_email(db: Session, email: str) -> UserRecord | None:
    stmt = select(UserRecord).where(UserRecord.email == email.strip().lower())
    return db.scalars(stmt).first()


def create_user(
    db: Session,
    username: str,
    email: str,
    password: str,
    full_name: str = "",
    role: str = "user",
) -> UserRecord:
    hashed = hash_password(password)
    user = UserRecord(
        username=username.strip().lower(),
        email=email.strip().lower(),
        hashed_password=hashed,
        full_name=full_name.strip() or username.strip(),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_default_admin(db: Session) -> UserRecord:
    """Dam bao tai khoan admin mac dinh admin / admin123 luon ton tai."""
    admin_user = get_user_by_username(db, "admin")
    if not admin_user:
        admin_user = create_user(
            db,
            username="admin",
            email="admin@enterprise.ai",
            password="admin123",
            full_name="Admin Workspace",
            role="admin",
        )
    return admin_user
