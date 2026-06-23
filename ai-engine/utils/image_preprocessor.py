"""
Image preprocessing utilities for industrial drawing OCR.

Applies a pipeline of classical image-processing techniques to maximise
Tesseract accuracy on technical drawings, which are typically:
  - Low-contrast scans
  - Mixed line-art + text
  - Sometimes skewed or improperly lit
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def preprocess_for_ocr(
    image: Image.Image,
    target_dpi: int = 300,
    enhance_contrast: bool = True,
    denoise: bool = True,
    deskew: bool = True,
    binarize: bool = True,
) -> Image.Image:
    """
    Full preprocessing pipeline for an industrial drawing image.

    Steps (all optional via flags):
      1. Resize to target DPI equivalent (~300 px/inch on A4)
      2. Convert to greyscale
      3. Contrast / brightness enhancement
      4. Denoising (bilateral + morphological)
      5. Deskew
      6. Adaptive binarisation

    Returns a PIL Image ready for pytesseract.
    """
    img_cv = pil_to_cv2(image)

    # 1. Ensure minimum resolution – scale up small images
    img_cv = _ensure_min_resolution(img_cv, min_width=1200)

    # 2. Greyscale
    if len(img_cv.shape) == 3:
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    else:
        gray = img_cv.copy()

    # 3. Contrast enhancement
    if enhance_contrast:
        gray = _enhance_contrast(gray)

    # 4. Denoising
    if denoise:
        gray = _denoise(gray)

    # 5. Deskew
    if deskew:
        gray = _deskew(gray)

    # 6. Binarise
    if binarize:
        gray = _adaptive_binarize(gray)

    return cv2_to_pil(gray)


def preprocess_for_feature_detection(image: Image.Image) -> np.ndarray:
    """
    Preprocessing optimised for geometric feature / contour detection.
    Returns an OpenCV BGR ndarray.
    """
    img_cv = pil_to_cv2(image)
    img_cv = _ensure_min_resolution(img_cv, min_width=1600)

    # Bilateral filter to keep edges sharp while smoothing noise
    smoothed = cv2.bilateralFilter(img_cv, d=9, sigmaColor=75, sigmaSpace=75)

    # Sharpen
    kernel_sharp = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(smoothed, -1, kernel_sharp)

    return sharpened


def extract_text_regions(image: Image.Image) -> List[Tuple[int, int, int, int]]:
    """
    Detect rectangular text regions (title blocks, dimension annotations) using
    morphological operations + connected components.

    Returns list of (x, y, w, h) bounding boxes.
    """
    img_cv = pil_to_cv2(image)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY) if len(img_cv.shape) == 3 else img_cv

    # Binarise
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Dilate horizontally to merge characters on same line
    kernel_h = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 2))
    dilated = cv2.dilate(binary, kernel_h, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    h_img, w_img = gray.shape
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        # Filter: ignore very small and very large regions
        if w < 20 or h < 8 or w > w_img * 0.95 or h > h_img * 0.5:
            continue
        regions.append((x, y, w, h))

    return regions


def detect_drawing_scale(image: Image.Image) -> Optional[str]:
    """
    Attempt to detect the drawing scale from the title block area (bottom-right).
    Returns a string like "1:1", "1:2", "2:1" or None.
    """
    import re

    img_cv = pil_to_cv2(image)
    h, w = img_cv.shape[:2]

    # Crop bottom-right quadrant (title block is typically there)
    roi = img_cv[int(h * 0.7):h, int(w * 0.6):w]
    roi_pil = cv2_to_pil(roi)
    preprocessed = preprocess_for_ocr(roi_pil, deskew=False)

    try:
        import pytesseract
        text = pytesseract.image_to_string(preprocessed, lang="fra+eng", config="--psm 6")
        # Look for scale notation
        patterns = [
            r"(?i)échelle\s*[:\s]*(\d+\s*:\s*\d+)",
            r"(?i)scale\s*[:\s]*(\d+\s*:\s*\d+)",
            r"\b(\d+\s*:\s*\d+)\b",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                scale = m.group(1).replace(" ", "")
                return scale
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# Helpers / internal
# ---------------------------------------------------------------------------


def pil_to_cv2(image: Image.Image) -> np.ndarray:
    """Convert PIL Image to OpenCV ndarray (BGR)."""
    img = image.convert("RGB")
    arr = np.array(img)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def cv2_to_pil(img: np.ndarray) -> Image.Image:
    """Convert OpenCV ndarray to PIL Image."""
    if len(img.shape) == 2:
        return Image.fromarray(img.astype(np.uint8), mode="L")
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb.astype(np.uint8))


def _ensure_min_resolution(img: np.ndarray, min_width: int = 1200) -> np.ndarray:
    """Upscale image if it is too small for good OCR."""
    h, w = img.shape[:2]
    if w < min_width:
        scale = min_width / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    return img


def _enhance_contrast(gray: np.ndarray) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalisation)."""
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _denoise(gray: np.ndarray) -> np.ndarray:
    """Non-local means denoising followed by morphological closing to fill gaps in thin lines."""
    denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
    # Close small gaps in lines (important for dimension lines)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    closed = cv2.morphologyEx(denoised, cv2.MORPH_CLOSE, kernel)
    return closed


def _deskew(gray: np.ndarray) -> np.ndarray:
    """
    Detect and correct image skew using the Hough Transform on horizontal/vertical lines.
    Limits correction to ±10° to avoid false corrections on isometric drawings.
    """
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=200)

    if lines is None:
        return gray

    angles = []
    for line in lines[:50]:   # Use top 50 strongest lines
        rho, theta = line[0]
        # Convert to degrees, measure from horizontal
        angle_deg = np.degrees(theta) - 90
        if abs(angle_deg) < 10:  # Only near-horizontal lines
            angles.append(angle_deg)

    if not angles:
        return gray

    median_angle = float(np.median(angles))

    if abs(median_angle) < 0.5:
        return gray   # Within tolerance, skip rotation

    logger.debug("Deskewing image by %.2f degrees", median_angle)
    h, w = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
    rotated = cv2.warpAffine(
        gray, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated


def _adaptive_binarize(gray: np.ndarray) -> np.ndarray:
    """
    Adaptive thresholding – better than global Otsu for drawings with uneven illumination.
    Also tries Otsu and keeps whichever has more white space (drawings are mostly white).
    """
    # Adaptive gaussian
    adaptive = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=25,
        C=8,
    )

    # Otsu global
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Prefer the one with more white (less ink = cleaner lines)
    white_adaptive = np.sum(adaptive == 255)
    white_otsu = np.sum(otsu == 255)

    result = adaptive if white_adaptive >= white_otsu else otsu

    # Morphological cleanup: remove isolated noise pixels
    kernel = np.ones((2, 2), np.uint8)
    result = cv2.morphologyEx(result, cv2.MORPH_OPEN, kernel)
    return result


def load_image_from_path(path: str | Path) -> Image.Image:
    """Load an image from disk, handling common formats."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    img = Image.open(path)
    # Ensure RGB or L (greyscale) – not CMYK, RGBA, etc.
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


def image_to_thumbnail(image: Image.Image, max_size: Tuple[int, int] = (800, 600)) -> Image.Image:
    """Create a thumbnail for preview purposes."""
    thumb = image.copy()
    thumb.thumbnail(max_size, Image.LANCZOS)
    return thumb
