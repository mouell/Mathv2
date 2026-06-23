"""
DocumentAnalyzer – Entry point for reading industrial drawings.

Supported input formats
-----------------------
PDF  → pdf2image converts each page to PIL Image
Image (JPEG/PNG/TIFF/BMP) → loaded directly via Pillow
DXF  → ezdxf parses entities; text entities are collected directly
DWG  → partially supported via ezdxf (R2000+ DWG) or rejected gracefully

The analyzer returns an OCRResult containing:
  - raw concatenated OCR text
  - projection type (ISO/ANSI) detected from title block symbols
  - drawing scale
  - title block key-value pairs
  - list of text regions and their coordinates
  - detected features (handed off to FeatureExtractor)
"""

from __future__ import annotations

import io
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image

from models.schemas import (
    DetectedFeature,
    FeatureType,
    FileType,
    OCRResult,
    ProjectionType,
)
from utils.image_preprocessor import (
    extract_text_regions,
    pil_to_cv2,
    preprocess_for_ocr,
)

logger = logging.getLogger(__name__)

# Tesseract configuration for technical drawings
_TESS_CONFIG_FULL = (
    "--psm 6 "                # Assume uniform block of text
    "-c tessedit_char_whitelist="
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "0123456789 .+-×xXΩøØ⌀ÉéÈèÀàÙùÂâÎîÔôÛûÇç"
    "°/:,;()[]{}*#@&%$!?_=<>\\|~^`'\""
)
_TESS_CONFIG_SPARSE = "--psm 11"   # Sparse text (annotations on drawing)
_OCR_LANG = "fra+eng"


class DocumentAnalyzer:
    """
    Analyses an uploaded industrial drawing file and extracts all textual
    and structural information.
    """

    def __init__(
        self,
        tesseract_cmd: Optional[str] = None,
        ocr_language: str = _OCR_LANG,
        dpi: int = 300,
    ) -> None:
        self.ocr_language = ocr_language
        self.dpi = dpi

        # Configure Tesseract path if specified
        if tesseract_cmd:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze(
        self,
        file_data: bytes,
        file_name: str,
        material_hint: Optional[str] = None,
    ) -> OCRResult:
        """
        Main entry point.  Accepts raw bytes + filename and returns OCRResult.
        """
        t0 = time.perf_counter()
        file_type = self._detect_file_type(file_name, file_data)
        logger.info("Analyzing %s as %s", file_name, file_type)

        images = self._load_images(file_data, file_name, file_type)
        dxf_text = ""

        if file_type in (FileType.DXF, FileType.DWG):
            dxf_text = self._extract_dxf_text(file_data, file_name)

        # OCR each page/image
        all_text_parts: List[str] = []
        all_regions: List[Dict[str, Any]] = []

        for page_idx, img in enumerate(images):
            preprocessed = preprocess_for_ocr(
                img,
                target_dpi=self.dpi,
                enhance_contrast=True,
                denoise=True,
                deskew=True,
                binarize=True,
            )
            page_text = self._run_ocr(preprocessed)
            # Also run sparse pass to catch scattered dimension annotations
            sparse_text = self._run_ocr(preprocessed, config=_TESS_CONFIG_SPARSE)
            combined = page_text + "\n" + sparse_text
            all_text_parts.append(combined)

            regions = extract_text_regions(img)
            for r in regions:
                all_regions.append({
                    "page": page_idx,
                    "x": r[0], "y": r[1],
                    "width": r[2], "height": r[3],
                })

        if dxf_text:
            all_text_parts.append(dxf_text)

        raw_text = "\n".join(all_text_parts)

        # Post-process
        projection_type = self._detect_projection_type(raw_text)
        scale = self._detect_scale(raw_text)
        title_block = self._parse_title_block(raw_text)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.info(
            "OCR completed in %.0f ms, %d chars extracted",
            elapsed_ms,
            len(raw_text),
        )

        return OCRResult(
            raw_text=raw_text,
            language_detected=self.ocr_language,
            projection_type=projection_type,
            scale=scale,
            title_block=title_block,
            regions=all_regions,
            detected_features=[],   # Populated later by FeatureExtractor
            processing_time_ms=elapsed_ms,
        )

    # ------------------------------------------------------------------
    # File loading
    # ------------------------------------------------------------------

    def _detect_file_type(self, file_name: str, data: bytes) -> FileType:
        """Determine file type from extension and magic bytes."""
        ext = Path(file_name).suffix.lower().lstrip(".")

        if ext == "pdf" or data[:4] == b"%PDF":
            return FileType.PDF
        if ext in ("jpg", "jpeg", "png", "tiff", "tif", "bmp", "webp"):
            return FileType.IMAGE
        if ext == "dxf":
            return FileType.DXF
        if ext == "dwg":
            return FileType.DWG

        # Sniff magic bytes for images
        try:
            with io.BytesIO(data) as buf:
                img = Image.open(buf)
                img.verify()
            return FileType.IMAGE
        except Exception:
            pass

        return FileType.UNKNOWN

    def _load_images(
        self,
        data: bytes,
        file_name: str,
        file_type: FileType,
    ) -> List[Image.Image]:
        """Convert the input file to a list of PIL Images (one per page)."""
        if file_type == FileType.PDF:
            return self._load_pdf(data)
        if file_type in (FileType.IMAGE, FileType.UNKNOWN):
            return self._load_image(data)
        if file_type in (FileType.DXF, FileType.DWG):
            return self._load_dxf_as_image(data, file_name)
        return []

    def _load_pdf(self, data: bytes) -> List[Image.Image]:
        """Convert PDF pages to PIL Images using pdf2image."""
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(data, dpi=self.dpi, fmt="png")
            logger.info("PDF: %d pages loaded", len(images))
            return images
        except ImportError:
            logger.warning("pdf2image not available – trying PIL PDF fallback")
            return self._load_image(data)
        except Exception as exc:
            logger.error("PDF loading failed: %s", exc)
            return []

    def _load_image(self, data: bytes) -> List[Image.Image]:
        """Load a single image from bytes."""
        try:
            buf = io.BytesIO(data)
            img = Image.open(buf)
            img.load()   # Force read before buffer closes
            if img.mode not in ("RGB", "L", "RGBA"):
                img = img.convert("RGB")
            elif img.mode == "RGBA":
                bg = Image.new("RGB", img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3])
                img = bg
            return [img]
        except Exception as exc:
            logger.error("Image loading failed: %s", exc)
            return []

    def _load_dxf_as_image(
        self, data: bytes, file_name: str
    ) -> List[Image.Image]:
        """
        Render a DXF to a raster image using ezdxf's matplotlib exporter,
        falling back to a blank placeholder if matplotlib is not available.
        """
        try:
            import ezdxf
            from ezdxf.addons.drawing import RenderContext, Frontend
            from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
            import matplotlib.pyplot as plt

            doc = ezdxf.read(io.BytesIO(data))
            msp = doc.modelspace()
            fig = plt.figure(figsize=(16.54, 11.69))  # A3 landscape
            ax = fig.add_axes([0, 0, 1, 1])
            ctx = RenderContext(doc)
            out = MatplotlibBackend(ax)
            Frontend(ctx, out).draw_layout(msp, finalize=True)

            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=self.dpi, bbox_inches="tight")
            plt.close(fig)
            buf.seek(0)
            return [Image.open(buf).convert("RGB")]

        except ImportError:
            logger.warning("matplotlib not available; DXF rendered as blank image")
            img = Image.new("RGB", (2339, 1654), color=(255, 255, 255))
            return [img]
        except Exception as exc:
            logger.error("DXF image rendering failed: %s", exc)
            return []

    def _extract_dxf_text(self, data: bytes, file_name: str) -> str:
        """
        Extract TEXT, MTEXT and DIMENSION entity text strings directly from
        DXF without rendering.  Much faster and more reliable than OCR for DXF.
        """
        try:
            import ezdxf
            doc = ezdxf.read(io.BytesIO(data))
            texts: List[str] = []
            for entity in doc.modelspace():
                dxftype = entity.dxftype()
                if dxftype == "TEXT":
                    texts.append(entity.dxf.text)
                elif dxftype == "MTEXT":
                    texts.append(entity.text)
                elif dxftype == "DIMENSION":
                    try:
                        measurement = entity.get_measurement()
                        texts.append(f"{measurement:.3f}")
                    except Exception:
                        pass
            return "\n".join(t for t in texts if t)
        except Exception as exc:
            logger.error("DXF text extraction failed: %s", exc)
            return ""

    # ------------------------------------------------------------------
    # OCR
    # ------------------------------------------------------------------

    def _run_ocr(self, image: Image.Image, config: str = _TESS_CONFIG_FULL) -> str:
        """Run pytesseract on a preprocessed image."""
        try:
            import pytesseract
            text = pytesseract.image_to_string(
                image,
                lang=self.ocr_language,
                config=config,
            )
            return text.strip()
        except Exception as exc:
            logger.warning("OCR failed: %s", exc)
            return ""

    # ------------------------------------------------------------------
    # Post-processing helpers
    # ------------------------------------------------------------------

    def _detect_projection_type(self, text: str) -> ProjectionType:
        """
        Detect ISO (first-angle) or ANSI (third-angle) projection from
        standard title-block notation.
        """
        # ISO 128 symbols and French/European drawing notes
        iso_patterns = [
            r"(?i)premi[eè]re?\s+dièdre",
            r"(?i)1\s*(?:er|ère)?\s*dièdre",
            r"(?i)first\s+angle",
            r"(?i)projection\s+europ[eé]enne",
            r"ISO\s*E",
        ]
        ansi_patterns = [
            r"(?i)third\s+angle",
            r"(?i)3(?:rd|ième)?\s+dièdre",
            r"(?i)projection\s+am[eé]ricaine",
            r"ANSI",
            r"ISO\s*A",
        ]

        for pat in iso_patterns:
            if re.search(pat, text):
                return ProjectionType.ISO
        for pat in ansi_patterns:
            if re.search(pat, text):
                return ProjectionType.ANSI

        # Default to ISO for French drawings
        if re.search(r"(?i)(?:échelle|matière|établi|dessin[ée])", text):
            return ProjectionType.ISO

        return ProjectionType.UNKNOWN

    def _detect_scale(self, text: str) -> Optional[str]:
        """Extract drawing scale from OCR text."""
        patterns = [
            r"(?i)échelle\s*[:\s]*([\d]+\s*:\s*[\d]+)",
            r"(?i)scale\s*[:\s]*([\d]+\s*:\s*[\d]+)",
            r"(?i)éch\.\s*([\d]+\s*:\s*[\d]+)",
            r"\b(1\s*:\s*[125]\b)",    # Common drawing scales
            r"\b([125]\s*:\s*1\b)",    # Enlargement scales
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return m.group(1).replace(" ", "")
        return None

    def _parse_title_block(self, text: str) -> Dict[str, str]:
        """
        Extract key-value pairs from a French-style ISO title block.
        Handles various spellings and layouts.
        """
        result: Dict[str, str] = {}

        field_patterns = {
            "part_number": [
                r"(?i)(?:rep(?:ère)?|part\s*no?|référence|ref\.?)\s*[:\s]*([\w\-\.]+)",
                r"(?i)n[°o]\s*(?:pièce|plan)\s*[:\s]*([\w\-\.]+)",
            ],
            "title": [
                r"(?i)(?:désignation|titre|intitulé|objet)\s*[:\s]*(.+?)(?:\n|$)",
                r"(?i)title\s*[:\s]*(.+?)(?:\n|$)",
            ],
            "material": [
                r"(?i)(?:matière|matériau|mat\.?|material)\s*[:\s]*(.+?)(?:\n|$)",
            ],
            "drawn_by": [
                r"(?i)(?:dessiné\s*par|établi\s*par|drawn\s*by)\s*[:\s]*(.+?)(?:\n|$)",
            ],
            "date": [
                r"(?i)(?:date|le)\s*[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
                r"\b(\d{2}[/\-]\d{2}[/\-]\d{4})\b",
            ],
            "revision": [
                r"(?i)(?:révision|revision|rev\.?|indice)\s*[:\s]*([A-Z0-9]+)",
            ],
            "drawing_number": [
                r"(?i)(?:n[°o]\s*(?:dessin|plan)|drawing\s*no?)\s*[:\s]*([\w\-\.]+)",
            ],
            "surface_treatment": [
                r"(?i)(?:traitement\s*de\s*surface|finition)\s*[:\s]*(.+?)(?:\n|$)",
            ],
            "tolerance_general": [
                r"(?i)(?:tolérances\s*générales|general\s*tolerances|ISO\s*2768)\s*[:\s]*(.+?)(?:\n|$)",
            ],
        }

        for field, patterns in field_patterns.items():
            for pat in patterns:
                m = re.search(pat, text)
                if m:
                    value = m.group(1).strip()
                    if value and len(value) < 100:  # Sanity check
                        result[field] = value
                        break

        return result
