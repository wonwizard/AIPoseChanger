import os
from google import genai
from google.genai import types


def extract_prompt(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    response = client.models.generate_content(
        model="gemini-3.1-flash-image-preview",
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        inline_data=types.Blob(data=image_bytes, mime_type=mime_type)
                    ),
                    types.Part(
                        text=(
                            "Analyze this image and write a detailed image generation prompt "
                            "that could recreate it. Include: art style, subject's clothing and "
                            "appearance, background/environment, lighting, camera angle, and mood. "
                            "Output only the prompt text, no explanation or prefix."
                        )
                    ),
                ],
            )
        ],
    )

    return response.text.strip()
