from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-sonnet-4"
    system_prompt: str = (
        "You are a flashcard generator. Given the following new content from a user's notes, "
        "create concise question-and-answer flashcards that test understanding of the key concepts. "
        "Focus on the most important concepts. Make questions specific and answers concise."
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
