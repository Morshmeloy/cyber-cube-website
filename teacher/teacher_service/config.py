from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class TeacherSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env.ai", extra="ignore")

    teacher_service_token: str = Field(default="", repr=False)
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen2.5:7b"
    ollama_embed_model: str = "bge-m3:latest"
    ollama_keep_alive: str = "15m"
    ollama_timeout_seconds: float = 300.0
    ollama_num_ctx: int = 4096
    chroma_dir: str = "/app/chroma_db"
    chroma_collection: str = "tanenbaum_networks"
    rag_top_k: int = 4
    teacher_max_concurrent_generations: int = 1
    teacher_queue_timeout_seconds: float = 30.0
    teacher_max_explanation_tokens: int = 180
    teacher_max_detail_tokens: int = 420
    teacher_max_chat_tokens: int = 420

    @model_validator(mode="after")
    def validate_limits(self) -> "TeacherSettings":
        if self.teacher_max_concurrent_generations < 1 or self.rag_top_k < 1:
            raise ValueError("Concurrency and RAG_TOP_K must be positive")
        return self

    def require_service_token(self) -> None:
        if len(self.teacher_service_token) < 32:
            raise RuntimeError(
                "TEACHER_SERVICE_TOKEN must contain at least 32 characters"
            )


settings = TeacherSettings()
