from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_model: str = "qwen/qwen3.5-9b"
    system_prompt: str = "You are a helpful assistant."

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()