from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_all_settings, update_setting

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROTECTED_KEYS = {"pin_hash"}


class SettingUpdate(BaseModel):
    key: str
    value: str


@router.get("")
async def list_settings():
    settings = get_all_settings()
    for key in PROTECTED_KEYS:
        settings.pop(key, None)
    return settings


@router.put("")
async def update_settings(setting: SettingUpdate):
    if setting.key in PROTECTED_KEYS:
        raise HTTPException(status_code=403, detail="Diese Einstellung kann hier nicht geändert werden")
    update_setting(setting.key, setting.value)
    return {"message": "Setting updated", "key": setting.key}


@router.put("/bulk")
async def update_settings_bulk(settings: dict):
    filtered = {k: v for k, v in settings.items() if k not in PROTECTED_KEYS}
    for key, value in filtered.items():
        update_setting(key, str(value))
    return {"message": "Settings updated", "count": len(filtered)}
