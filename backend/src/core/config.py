from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    REFRESH_SECRET_KEY: str = Field(..., env="REFRESH_SECRET_KEY")
    ALGORITHM: str = Field("HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(15, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(7, env="REFRESH_TOKEN_EXPIRE_DAYS")
    APP_NAME: str = Field("D4 Technologies", env="APP_NAME")
    DEBUG: bool = Field(False, env="DEBUG")
    CORS_ALLOWED_ORIGINS: list[str] = Field(["*"], env="CORS_ALLOWED_ORIGINS")
    ONEC_BASE_URL: str = Field(..., env="ONEC_BASE_URL")
    ONEC_USERNAME: str = Field(..., env="ONEC_USERNAME")
    ONEC_PASSWORD: str = Field(..., env="ONEC_PASSWORD")
    DOCUMENTS_STORAGE_DIR: str = Field("/app/data/documents", env="DOCUMENTS_STORAGE_DIR")

    class Config:
        env_file = ".env.dev"
        env_file_encoding = "utf-8"


settings = Settings()
