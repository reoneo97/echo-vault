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

FLASHCARD_PROMPT = """You are a flashcard generator. Given new content from a user's notes, \
create flashcards that test understanding of the key concepts.

Generate a mix of card types based on what suits the content best:

- "standard": A question with a written answer. Use for concepts, definitions, explanations, \
and anything that requires a full-sentence response.

- "multiple_choice": A question with 4 answer options and one correct answer. Use for facts, \
classifications, or comparisons where plausible distractors can be written. \
Set "options" to a list of 4 strings and "correct_answer" to the exact text of the correct option.

- "true_false": A statement that is either true or false. Use for common misconceptions or \
clear factual claims. Set "answer" to "True" or "False" with a brief explanation, \
and "correct_answer" to "True" or "False".

Rules:
- Focus on the most important concepts only.
- Make questions specific and unambiguous.
- Keep answers concise.
- For multiple_choice, ensure distractors are plausible but clearly wrong.
- Do not generate cards for trivial or obvious facts."""

HEALTH_PROMPT = "Say hello and confirm this connection is working. Give a short introduction about yourself"

flashcard_agent = Agent(
    model,
    system_prompt=FLASHCARD_PROMPT,
    output_type=GenerateResponse,
)

health_agent = Agent(
    model,
    system_prompt=settings.system_prompt,
)


# async def agent_health_stream():
#     yield "<html><body><pre>"
#     async with agent.run_stream(HEALTH_PROMPT) as result:
#         async for text in result.stream_text(delta=True):
#             yield text
#             print(text)
#     yield "</pre></body></html>"


async def agent_health_stream():
    yield "<html><body><pre>"
    async with health_agent.run_stream(HEALTH_PROMPT, output_type=str) as result:
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
        result = await flashcard_agent.run(message_parts)
    else:
        result = await flashcard_agent.run(user_message)

    return result.output.cards[:max_cards]
