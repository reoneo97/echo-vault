from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider

from .config import settings
from .schemas import FlashcardPair, GenerateResponse

provider = OpenAIProvider(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)

model = OpenAIModel(
    settings.openrouter_model,
    provider=provider,
)

agent = Agent(
    model,
    system_prompt=settings.system_prompt,
    output_type=GenerateResponse,
)


async def generate_cards_from_diff(
    diff_content: str,
    source_note: str,
    max_cards: int,
) -> list[FlashcardPair]:
    user_message = f"Source note: {source_note}\n\nNew content:\n{diff_content}"
    if max_cards:
        user_message += f"\n\nGenerate at most {max_cards} flashcards."

    result = await agent.run(user_message)
    return result.output.cards[:max_cards]
