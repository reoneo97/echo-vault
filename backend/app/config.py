from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    openrouter_api_key: str = ""
    openrouter_model: str = "qwen/qwen3.5-9b"
    system_prompt: str = "You are a helpful assistant."

    # Generation hyperparameters
    temperature: float = 0.7
    top_p: float = 0.9
    max_tokens: int = 2048

    # Observability
    logfire_token: str = ""
    environment: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()