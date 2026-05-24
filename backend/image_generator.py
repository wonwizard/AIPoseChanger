import io
import os
from PIL import Image
from google import genai
from google.genai import types


def _get_mime_type(image_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(image_bytes))
    fmt = (img.format or "JPEG").upper()
    return {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}.get(fmt, "image/jpeg")


def generate_image(
    prompt: str,
    original_image_bytes: bytes | None,
    skeleton_image_bytes: bytes,
) -> bytes:
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    full_prompt = (
        f"{prompt}. "
        "Modify the person's pose to exactly match the skeleton shown in the skeleton image. "
        "Preserve all other aspects: clothing, appearance, background, lighting, and style."
    )

    parts: list = [types.Part(text=full_prompt)]

    if original_image_bytes:
        parts.append(
            types.Part(
                inline_data=types.Blob(
                    data=original_image_bytes,
                    mime_type=_get_mime_type(original_image_bytes),
                )
            )
        )

    parts.append(
        types.Part(
            inline_data=types.Blob(
                data=skeleton_image_bytes,
                mime_type="image/png",
            )
        )
    )

    response = client.models.generate_content(
        model="gemini-3.1-flash-image-preview",
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    raise ValueError("Gemini returned no image in the response")
