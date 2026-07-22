from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+asyncpg://callejon:callejon_dev_2026@db:5432/el_callejon_pos"
    )
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    app_name: str = "El Callejón · Pantallas Digitales"
    timezone: str = "America/Managua"

    jwt_secret: str = "el-callejon-pos-dev-secret-cambiar-en-produccion"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    image_root: str = "/app/static/images"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
