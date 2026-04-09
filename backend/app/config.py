from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openrouter_api_key: str = ""
    openrouter_model: str = "anthropic/claude-sonnet-4"
    system_prompt: str = (
        "You are a flashcard generator. Given new content from a user's notes, "
        "create flashcards that test understanding of the key concepts. "
        "Focus on the most important concepts. Make questions specific and answers concise.\n\n"
        "Generate a mix of card types:\n"
        '- "standard": A question with a free-form answer. Use for explanations, definitions, and open-ended concepts.\n'
        '- "true_false": A statement that is either true or false. '
        'Set "correct_answer" to "true" or "false". '
        'Set "answer" to a brief explanation of why the statement is true or false.\n'
        '- "multiple_choice": A question with 3-5 options where exactly one is correct. '
        'Set "options" to the list of choices and "correct_answer" to the correct option text. '
        'Set "answer" to a brief explanation of why the correct answer is right.\n\n'
        "Choose the card type that best fits each concept: use true/false for verifiable facts, "
        "multiple choice for distinguishing between related concepts, "
        "and standard for deeper explanations."
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
