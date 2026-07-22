from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


# Orígenes LAN típicos (Smart TVs en la misma red Wi‑Fi/Ethernet)
_LAN_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|127\.0\.0\.1|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?$"
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+asyncpg://callejon:callejon_dev_2026@db:5432/el_callejon_pos"
    )
    # "*" = permitir toda la LAN (recomendado para cartelería en red local)
    cors_origins: str = "*"
    app_name: str = "El Callejón · Pantallas Digitales"
    timezone: str = "America/Managua"

    jwt_secret: str = "el-callejon-pos-dev-secret-cambiar-en-produccion"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    image_root: str = "/app/static/images"

    @property
    def cors_allow_all(self) -> bool:
        raw = (self.cors_origins or "").strip()
        return raw in ("*", "ALL", "any", "")

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_allow_all:
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        """Si no es *, acepta localhost + IPs privadas con cualquier puerto."""
        if self.cors_allow_all:
            return None
        return _LAN_ORIGIN_REGEX


@lru_cache
def get_settings() -> Settings:
    return Settings()
