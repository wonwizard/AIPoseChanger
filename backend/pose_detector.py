import io
import os
import urllib.request

import numpy as np
from PIL import Image
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task"
)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker_heavy.task")

# BlazePose returns 33 landmarks; pick the 17 that map to COCO keypoints
# COCO order: nose, l_eye, r_eye, l_ear, r_ear,
#             l_shoulder, r_shoulder, l_elbow, r_elbow, l_wrist, r_wrist,
#             l_hip, r_hip, l_knee, r_knee, l_ankle, r_ankle
BLAZEPOSE_TO_COCO = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

NORMALIZED_INITIAL_POSE = [
    {"x": 0.50, "y": 0.10, "z": 0.0, "visibility": 1.0},  # 0 nose
    {"x": 0.47, "y": 0.09, "z": 0.0, "visibility": 1.0},  # 1 left_eye
    {"x": 0.53, "y": 0.09, "z": 0.0, "visibility": 1.0},  # 2 right_eye
    {"x": 0.44, "y": 0.10, "z": 0.0, "visibility": 1.0},  # 3 left_ear
    {"x": 0.56, "y": 0.10, "z": 0.0, "visibility": 1.0},  # 4 right_ear
    {"x": 0.38, "y": 0.25, "z": 0.0, "visibility": 1.0},  # 5 left_shoulder
    {"x": 0.62, "y": 0.25, "z": 0.0, "visibility": 1.0},  # 6 right_shoulder
    {"x": 0.30, "y": 0.42, "z": 0.0, "visibility": 1.0},  # 7 left_elbow
    {"x": 0.70, "y": 0.42, "z": 0.0, "visibility": 1.0},  # 8 right_elbow
    {"x": 0.25, "y": 0.57, "z": 0.0, "visibility": 1.0},  # 9 left_wrist
    {"x": 0.75, "y": 0.57, "z": 0.0, "visibility": 1.0},  # 10 right_wrist
    {"x": 0.43, "y": 0.56, "z": 0.0, "visibility": 1.0},  # 11 left_hip
    {"x": 0.57, "y": 0.56, "z": 0.0, "visibility": 1.0},  # 12 right_hip
    {"x": 0.43, "y": 0.72, "z": 0.0, "visibility": 1.0},  # 13 left_knee
    {"x": 0.57, "y": 0.72, "z": 0.0, "visibility": 1.0},  # 14 right_knee
    {"x": 0.43, "y": 0.90, "z": 0.0, "visibility": 1.0},  # 15 left_ankle
    {"x": 0.57, "y": 0.90, "z": 0.0, "visibility": 1.0},  # 16 right_ankle
]


def _ensure_model() -> None:
    if not os.path.exists(MODEL_PATH):
        print("Downloading pose landmarker model (first run only)…", flush=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def detect_pose(image_bytes: bytes) -> list[dict]:
    _ensure_model()

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(image))

    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(base_options=base_options)

    with vision.PoseLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp_image)

    if not result.pose_landmarks:
        return NORMALIZED_INITIAL_POSE

    landmarks = result.pose_landmarks[0]
    return [
        {
            "x": landmarks[i].x,
            "y": landmarks[i].y,
            "z": landmarks[i].z,
            "visibility": landmarks[i].visibility,
        }
        for i in BLAZEPOSE_TO_COCO
    ]
