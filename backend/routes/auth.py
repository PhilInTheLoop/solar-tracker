import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..database import get_setting, update_setting

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory session store: token -> expiry
sessions = {}

SESSION_DURATION_HOURS = 24


def hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


def verify_session(token: str) -> bool:
    if token in sessions and sessions[token] > datetime.now():
        return True
    sessions.pop(token, None)
    return False


def _cleanup_sessions():
    now = datetime.now()
    expired = [t for t, exp in sessions.items() if exp <= now]
    for t in expired:
        del sessions[t]


class LoginRequest(BaseModel):
    pin: str


class ChangePinRequest(BaseModel):
    current_pin: str
    new_pin: str


@router.post("/login")
async def login(request: LoginRequest):
    stored_hash = get_setting("pin_hash")
    if stored_hash is None:
        # Safety fallback: set default PIN if missing
        default_hash = hash_pin("1234")
        update_setting("pin_hash", default_hash)
        stored_hash = default_hash

    if hash_pin(request.pin) != stored_hash:
        raise HTTPException(status_code=401, detail="Falsche PIN")

    _cleanup_sessions()
    token = secrets.token_hex(32)
    sessions[token] = datetime.now() + timedelta(hours=SESSION_DURATION_HOURS)

    return {"token": token, "message": "Angemeldet"}


@router.get("/status")
async def auth_status():
    return {"authenticated": True}


@router.post("/logout")
async def logout(request: Request):
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        sessions.pop(token, None)
    return {"message": "Abgemeldet"}


@router.post("/change-pin")
async def change_pin(request: ChangePinRequest):
    stored_hash = get_setting("pin_hash")
    if hash_pin(request.current_pin) != stored_hash:
        raise HTTPException(status_code=401, detail="Aktuelle PIN ist falsch")

    if len(request.new_pin) < 4:
        raise HTTPException(status_code=400, detail="PIN muss mindestens 4 Zeichen haben")

    update_setting("pin_hash", hash_pin(request.new_pin))

    # Invalidate all existing sessions so user must re-login with new PIN
    sessions.clear()

    return {"message": "PIN geändert"}
