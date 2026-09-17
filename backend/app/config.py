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

    # Card store — path to the vault's EchoVault/ directory
    # Set ECHOVAULT_STORE_PATH in .env to e.g. /path/to/vault/EchoVault
    echovault_store_path: str = ""

    # Agent pipeline
    critic_model: str = "google/gemini-2.0-flash-lite-001"

    # Observability
    mlflow_tracking_uri: str = "http://mlflow.reoneo.dev"
    mlflow_experiment_name: str = "echovault"
    environment: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()