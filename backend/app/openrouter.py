import base64

from pydantic_ai import Agent, BinaryContent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
import asyncio 

from .config import settings
from .schemas import FlashcardPair, GenerateResponse, ImageData

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

FLASHCARD_PROMPT = (
    "You are a flashcard generator. Given the following new content from a user's notes, "
    "create concise question-and-answer flashcards that test understanding of the key concepts. "
    "Focus on the most important concepts. Make questions specific and answers concise."
)

HEALTH_PROMPT = "Say hello and confirm this connection is working. Give a short introduction about yourself"


# async def agent_health_stream():
#     yield "<html><body><pre>"
#     async with agent.run_stream(HEALTH_PROMPT) as result:
#         async for text in result.stream_text(delta=True):
#             yield text
#             print(text)
#     yield "</pre></body></html>"


async def agent_health_stream():
    yield "<html><body><pre>"
    async with agent.run_stream(HEALTH_PROMPT, output_type=str) as result:
        async for text in result.stream_text(delta=True):
            yield text
            await asyncio.sleep(0)
    yield "</pre></body></html>"





async def generate_cards_from_diff(
    diff_content: str,
    source_note: str,
    max_cards: int,
    images: list[ImageData] | None = None,
) -> list[FlashcardPair]:
    user_message = f"Source note: {source_note}\n\nNew content:\n{diff_content}"
    if max_cards:
        user_message += f"\n\nGenerate at most {max_cards} flashcards."

    if images:
        user_message += (
            f"\n\nThe content references {len(images)} image(s). "
            "Examine the images and generate flashcards about their visual content as well. "
            "Include the original image reference in the question field so the image displays during review."
        )
        # Build multimodal message: text + image content blocks
        message_parts: list = [user_message]
        for img in images:
            image_bytes = base64.b64decode(img.data)
            message_parts.append(
                BinaryContent(data=image_bytes, media_type=img.media_type)
            )
        result = await agent.run(message_parts, system_prompt=FLASHCARD_PROMPT)
    else:
        result = await agent.run(user_message, system_prompt=FLASHCARD_PROMPT)

    return result.output.cards[:max_cards]
