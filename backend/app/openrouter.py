import asyncio
import base64
import logging
import re

import mlflow.genai
from pydantic_ai import Agent, BinaryContent
from pydantic_ai.models.openai import OpenAIChatModel as OpenAIModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

from .config import settings
from .schemas import FlashcardPair, GenerateResponse, ImageData

logger = logging.getLogger(__name__)


def normalize_image_refs(text: str) -> str:
    """Convert any LLM-invented image reference formats to Obsidian ![[filename]] syntax."""
    text = re.sub(r'@\{\{([^}]+)\}\}', r'![[\1]]', text)
    text = re.sub(r'\{\{([^}]+\.(?:png|jpg|jpeg|gif|webp|bmp))\}\}', r'![[\1]]', text, flags=re.IGNORECASE)
    return text


provider = OpenAIProvider(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)

model = OpenAIModel(
    settings.openrouter_model,
    provider=provider,
)

GENERATION_SETTINGS = ModelSettings(
    temperature=settings.temperature,
    top_p=settings.top_p,
    max_tokens=settings.max_tokens,
)

# Fallback used when the MLflow registry is unreachable at startup
_FLASHCARD_PROMPT_FALLBACK = """You are a flashcard generator. Given new content from a user's notes, \
create flashcards that test understanding of the key concepts.

Prefer multiple_choice and true_false cards wherever possible — only use standard when the \
concept genuinely requires a free-form written response (e.g. open-ended explanations, \
multi-step derivations, or subjective analysis).

Card types:

- "multiple_choice": A question with exactly 4 answer options and one correct answer. \
ALWAYS use this for facts, definitions, classifications, comparisons, numerical values, \
or any question with a single objectively correct answer. \
Generate distractors that are clearly and unambiguously wrong for this specific question — \
they should be plausible enough to require thought, but must not be partially correct, \
a superset, or a generalisation of the correct answer. \
Prefer distractors drawn from specific peer-level concepts in the notes (e.g. other \
algorithms, other values, other named techniques at the same level of abstraction). \
Set "options" to a list of exactly 4 strings and "correct_answer" to the exact text of \
the correct option.

- "true_false": A statement that is clearly true or false based on the notes. \
Use for common misconceptions, negations of facts, or boundary conditions. \
Set "answer" to "True" or "False" followed by a one-sentence explanation, \
and "correct_answer" to exactly "True" or "False".

- "standard": A question requiring a written answer. Reserve for explanations, \
mechanisms, trade-offs, or multi-part reasoning that cannot be reduced to a single choice.

Rules:
- Aim for at least 60% multiple_choice and 20% true_false across the cards you generate.
- Focus on the most important concepts only.
- Make questions specific and unambiguous.
- For multiple_choice, distractors must be plausible — drawn from real terms in the notes, \
not obviously wrong.
- Do not generate cards for trivial or obvious facts."""


def _load_flashcard_prompt() -> str:
    """Load the system prompt from the MLflow registry; fall back to the hardcoded string."""
    try:
        prompt = mlflow.genai.load_prompt("echovault-flashcard-generator")
        messages = prompt.template if isinstance(prompt.template, list) else []
        system_content = next((m["content"] for m in messages if m.get("role") == "system"), None)
        if system_content:
            logger.info("Loaded flashcard prompt from MLflow registry (version=%s)", prompt.version)
            return system_content
    except Exception as e:
        logger.warning("Could not load prompt from MLflow registry, using fallback: %s", e)
    return _FLASHCARD_PROMPT_FALLBACK


FLASHCARD_PROMPT = _load_flashcard_prompt()

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
            "When referencing an image in a question, use exactly this Obsidian syntax: ![[filename]] "
            "(e.g. ![[Pasted image 20230912.png]]). Do not use any other format."
        )
        message_parts: list = [user_message]
        for img in images:
            image_bytes = base64.b64decode(img.data)
            message_parts.append(
                BinaryContent(data=image_bytes, media_type=img.media_type)
            )
        result = await flashcard_agent.run(message_parts, model_settings=GENERATION_SETTINGS)
    else:
        result = await flashcard_agent.run(user_message, model_settings=GENERATION_SETTINGS)

    cards = result.output.cards[:max_cards]
    for card in cards:
        card.question = normalize_image_refs(card.question)
        card.answer = normalize_image_refs(card.answer)
    return cards
