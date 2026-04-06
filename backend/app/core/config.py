from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Final Project Resource API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/tempusai"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    run_migrations_on_startup: bool = True
    run_seed_on_empty_resources_startup: bool = True
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    chat_pgvector_table: str = "chat_knowledge_chunks"
    chat_embedding_dimension: int = 1536
    chat_sql_result_limit: int = 200
    chat_return_sql_query: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
