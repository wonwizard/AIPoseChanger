import asyncio
import base64
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).parent.parent / ".env")

from image_generator import generate_image
from pose_detector import detect_pose
from prompt_extractor import extract_prompt

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
async def analyze(image: UploadFile = File(...)):
    image_bytes = await image.read()
    mime = image.content_type or "image/jpeg"

    loop = asyncio.get_event_loop()
    keypoints, prompt = await asyncio.gather(
        loop.run_in_executor(None, detect_pose, image_bytes),
        loop.run_in_executor(None, extract_prompt, image_bytes, mime),
    )

    return {"keypoints": keypoints, "prompt": prompt}


@app.post("/api/generate")
async def generate(
    prompt: str = Form(...),
    skeleton_image: UploadFile = File(...),
    original_image: Optional[UploadFile] = File(None),
):
    skeleton_bytes = await skeleton_image.read()
    original_bytes = await original_image.read() if original_image else None

    loop = asyncio.get_event_loop()
    try:
        result_bytes = await loop.run_in_executor(
            None, generate_image, prompt, original_bytes, skeleton_bytes
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"image_base64": base64.b64encode(result_bytes).decode()}


# Serve frontend — must be mounted last so API routes take priority
frontend_dir = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="static")
