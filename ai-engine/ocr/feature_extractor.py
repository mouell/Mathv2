"""
FeatureExtractor – Parses raw OCR text from industrial drawings and identifies
all engineering features: dimensions, diameters, threads, tolerances, surface
finish, geometric tolerances, etc.

Regex patterns are written to handle:
  - French and English notation
  - ISO and ANSI standards
  - Unicode symbols (Ø ⌀ ° ± √ △)
  - Tolerances in multiple forms:  120±0.05 / 120+0.1/-0.05 / Ø12 H7

All detected features are returned as DetectedFeature Pydantic objects with
confidence scores computed from match quality.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from models.schemas import DetectedFeature, FeatureType

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regex pattern library
# ---------------------------------------------------------------------------

# Number fragment helpers
_N = r"(?:\d+(?:[.,]\d+)?)"          # integer or decimal  e.g. 12  120.5  3,5
_N_SIGNED = r"(?:[+\-]?\d+(?:[.,]\d+)?)"  # signed number

# ISO tolerance qualifiers  (letter + digit)
_ISO_TOL = r"(?:[A-Za-z]{1,2}\d+)"   # H7  h6  JS15  d11  etc.

# Common whitespace including unicode NBSP
_WS = r"[\s ]*"

# Unit suffixes that might appear
_UNIT = r"(?:mm|cm|m|in|\"|\')?"


class FeatureExtractor:
    """
    Extracts manufacturing features from raw OCR text.

    Usage::

        extractor = FeatureExtractor()
        features = extractor.extract(raw_text)
    """

    def __init__(self) -> None:
        self._patterns = self._compile_patterns()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def extract(self, text: str) -> List[DetectedFeature]:
        """
        Parse *text* and return a deduplicated list of DetectedFeature objects,
        ordered by confidence (highest first).
        """
        # Normalise common OCR artifacts before matching
        text = self._normalise(text)
        features: List[DetectedFeature] = []

        for extractor_fn in self._patterns:
            found = extractor_fn(text)
            features.extend(found)

        # Deduplicate by raw_text similarity
        features = self._deduplicate(features)

        # Sort: high confidence first
        features.sort(key=lambda f: -f.confidence)
        logger.debug("FeatureExtractor found %d features", len(features))
        return features

    # ------------------------------------------------------------------
    # Normalisation
    # ------------------------------------------------------------------

    def _normalise(self, text: str) -> str:
        """Normalise OCR artefacts, unicode variants, French formatting."""
        # Replace unicode diameter symbols with ASCII Ø
        text = text.replace("⌀", "Ø").replace("ø", "Ø").replace("O/", "Ø")
        # Replace unicode minus variants
        text = text.replace("−", "-").replace("–", "-").replace("—", "-")
        # Replace comma-decimal to dot-decimal (French numbers)
        text = re.sub(r"(\d),(\d)", r"\1.\2", text)
        # Fix common OCR confusion: O→0 in numeric context
        text = re.sub(r"(?<=[+\-×xX\s])[Oo](?=\d)", "0", text)
        # Normalise whitespace
        text = re.sub(r"\r\n", "\n", text)
        return text

    # ------------------------------------------------------------------
    # Pattern compiler
    # ------------------------------------------------------------------

    def _compile_patterns(self):
        """Return list of bound extractor methods."""
        return [
            self._extract_diameters,
            self._extract_radii,
            self._extract_threads,
            self._extract_chamfers,
            self._extract_linear_dimensions,
            self._extract_surface_finish,
            self._extract_geometric_tolerances,
            self._extract_angles,
            self._extract_depths,
        ]

    # ------------------------------------------------------------------
    # Individual extractors
    # ------------------------------------------------------------------

    def _extract_diameters(self, text: str) -> List[DetectedFeature]:
        """
        Detect diameter callouts:
          Ø12,  Ø12 H7,  ⌀25,  D=10,  d=5,  Dia.12,  Diam 25
        with optional tolerances ±, +/-, ISO qualifiers, or bilateral
        """
        features: List[DetectedFeature] = []

        patterns = [
            # Ø25 H7  /  Ø12.5±0.05
            (
                rf"Ø{_WS}({_N}){_WS}({_ISO_TOL})?{_WS}"
                rf"(?:([+\-]{_N})\s*/\s*([+\-]{_N})|±({_N}))?",
                0.95,
            ),
            # D=25  d=12.5
            (
                rf"[Dd]{_WS}={_WS}({_N}){_WS}({_ISO_TOL})?",
                0.88,
            ),
            # Dia. 25  /  Diam 12
            (
                rf"(?i)(?:dia(?:m(?:etre|eter)?)?\.?){_WS}({_N}){_WS}({_ISO_TOL})?",
                0.85,
            ),
        ]

        for pat, base_conf in patterns:
            for m in re.finditer(pat, text):
                value_str = m.group(1)
                qualifier = m.group(2) if m.lastindex and m.lastindex >= 2 else None
                try:
                    value = float(value_str)
                except (ValueError, TypeError):
                    continue

                # Tolerance extraction
                tol_upper, tol_lower, tol_sym = None, None, None
                full = m.group(0)
                t = self._parse_tolerance(full, value)
                if t:
                    tol_upper, tol_lower = t

                features.append(DetectedFeature(
                    feature_type=FeatureType.DIAMETER,
                    raw_text=m.group(0).strip(),
                    value=value,
                    qualifier=qualifier,
                    tolerance_upper=tol_upper,
                    tolerance_lower=tol_lower,
                    confidence=base_conf,
                ))

        return features

    def _extract_radii(self, text: str) -> List[DetectedFeature]:
        """
        Detect radius callouts: R5, R=10, r5, R10.5
        """
        features: List[DetectedFeature] = []
        patterns = [
            rf"\bR{_WS}={_WS}({_N})\b",
            rf"\bR({_N})\b",
            rf"\br({_N})\b",
        ]
        for pat in patterns:
            for m in re.finditer(pat, text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.RADIUS,
                    raw_text=m.group(0).strip(),
                    value=value,
                    confidence=0.90,
                ))
        return features

    def _extract_threads(self, text: str) -> List[DetectedFeature]:
        """
        Detect thread callouts:
          M12x1.5-6H,  M10,  M16 6g,  UNC 1/4-20,  UNF 3/8-24,  G1/2
        """
        features: List[DetectedFeature] = []
        patterns = [
            # Metric – M12, M12x1.5, M12x1.5-6H, M12 6g
            (
                rf"\bM({_N})(?:x({_N}))?(?:[\s\-]([36][Hhg][Hhg]?))?",
                0.97,
                "metric",
            ),
            # UN / UNC / UNF  e.g. UNC 1/4-20
            (
                r"\bUN[CFS]?\s*([\d/]+)\s*-\s*(\d+)",
                0.92,
                "unc",
            ),
            # BSP / G  e.g. G1/2, G3/4-A
            (
                r"\bG\s*([\d/]+)(?:\s*[\-]?\s*[AB])?",
                0.85,
                "bsp",
            ),
            # NPT  e.g. NPT 1/2
            (
                r"\bNPT\s*([\d/]+)",
                0.85,
                "npt",
            ),
        ]

        for pat, conf, thread_type in patterns:
            for m in re.finditer(pat, text):
                raw = m.group(0).strip()
                value: Optional[float] = None
                pitch: Optional[float] = None

                if thread_type == "metric":
                    try:
                        value = float(m.group(1))    # nominal diameter
                        if m.lastindex >= 2 and m.group(2):
                            pitch = float(m.group(2))
                    except (ValueError, TypeError, IndexError):
                        pass
                elif thread_type == "unc":
                    # Store as fractional string → convert to mm approx
                    try:
                        frac = m.group(1)
                        if "/" in frac:
                            num, den = frac.split("/")
                            value = float(num) / float(den) * 25.4
                        else:
                            value = float(frac) * 25.4
                    except (ValueError, TypeError):
                        pass

                features.append(DetectedFeature(
                    feature_type=FeatureType.THREAD,
                    raw_text=raw,
                    value=value,
                    secondary_value=pitch,
                    qualifier=thread_type,
                    confidence=conf,
                ))

        return features

    def _extract_chamfers(self, text: str) -> List[DetectedFeature]:
        """
        Detect chamfer callouts:
          2x45°,  C2,  1x45°,  Chanfrein 2×45°,  C1.5
        """
        features: List[DetectedFeature] = []
        patterns = [
            # 2x45°  /  1.5x45°  (French drawings often use × or x)
            (rf"({_N})\s*[×x]\s*45\s*°", 0.97),
            # C2  C1.5
            (rf"\bC({_N})\b", 0.90),
            # chanfrein 2×45  /  cham. 2x45
            (rf"(?i)(?:chanfrein|cham\.?)\s*({_N})\s*[×x]\s*(\d+)\s*°?", 0.88),
        ]
        for pat, conf in patterns:
            for m in re.finditer(pat, text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.CHAMFER,
                    raw_text=m.group(0).strip(),
                    value=value,
                    secondary_value=45.0,   # angle always 45° for standard chamfers
                    confidence=conf,
                ))
        return features

    def _extract_linear_dimensions(self, text: str) -> List[DetectedFeature]:
        """
        Detect plain linear dimensions that are not diameters/radii.
        Handles: 120  /  120.5  /  120±0.05  /  120+0.1/-0.05  /  120 H7

        Strategy: match numbers preceded/followed by dimension indicators
        (leader lines context implied, since we don't have layout).
        We accept numbers that appear after newlines or after typical
        drawing callout punctuation.
        """
        features: List[DetectedFeature] = []

        # Full-form: value + tolerance + optional ISO qualifier
        # e.g.  120.50 ± 0.05 H7  /  80+0.030/-0.000
        full_pattern = (
            rf"(?<![ØMRrCD/\d])({_N})"               # capture value, no prefix
            rf"(?:{_WS}({_ISO_TOL}))?"                # optional ISO qualifier
            rf"(?:"                                    # optional tolerance group
            rf"{_WS}[±±]{_WS}({_N})"            # ±0.05
            rf"|{_WS}([+\-]{_N}){_WS}/?\s*([+\-]{_N})"   # +0.1/-0.05
            rf")?"
        )

        seen: set = set()
        for m in re.finditer(full_pattern, text):
            raw = m.group(0).strip()
            if not raw or raw in seen:
                continue

            value_str = m.group(1)
            try:
                value = float(value_str)
            except (ValueError, TypeError):
                continue

            # Skip obviously non-dimensional numbers (years, codes, etc.)
            if value > 9999 or value < 0.1:
                continue

            seen.add(raw)

            qualifier = m.group(2)
            tol_sym = m.group(3)      # ±x
            tol_pos = m.group(4)      # +x
            tol_neg = m.group(5)      # -x

            tol_upper: Optional[float] = None
            tol_lower: Optional[float] = None

            if tol_sym:
                t = abs(float(tol_sym))
                tol_upper, tol_lower = t, -t
            elif tol_pos and tol_neg:
                try:
                    tol_upper = float(tol_pos)
                    tol_lower = float(tol_neg)
                except ValueError:
                    pass

            # Confidence: higher if tolerance or qualifier present
            conf = 0.70
            if qualifier:
                conf = 0.85
            if tol_sym or (tol_pos and tol_neg):
                conf = 0.88

            features.append(DetectedFeature(
                feature_type=FeatureType.DIMENSION,
                raw_text=raw,
                value=value,
                qualifier=qualifier,
                tolerance_upper=tol_upper,
                tolerance_lower=tol_lower,
                confidence=conf,
            ))

        return features

    def _extract_surface_finish(self, text: str) -> List[DetectedFeature]:
        """
        Detect surface finish callouts:
          Ra 0.8  /  Ra1.6  /  Ra=3.2  /  Rz6.3  /  N6  /  ▽▽
        Values in µm (micrometres).
        """
        features: List[DetectedFeature] = []
        patterns = [
            # Ra 0.8  Ra1.6  Ra = 3.2
            (rf"(?i)\bRa{_WS}=?{_WS}({_N})\b", "Ra", 0.97),
            # Rz 6.3
            (rf"(?i)\bRz{_WS}=?{_WS}({_N})\b", "Rz", 0.95),
            # Rt / Rq / Rw
            (rf"(?i)\bR[tqw]{_WS}=?{_WS}({_N})\b", "Rx", 0.88),
            # N grade  N5, N6, N7, N8  (ISO 1302 old notation)
            (r"\bN(\d{1,2})\b", "N", 0.75),
        ]
        for pat, qualifier, conf in patterns:
            for m in re.finditer(pat, text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.SURFACE_FINISH,
                    raw_text=m.group(0).strip(),
                    value=value,
                    qualifier=qualifier,
                    unit="µm",
                    confidence=conf,
                ))
        return features

    def _extract_geometric_tolerances(self, text: str) -> List[DetectedFeature]:
        """
        Detect GD&T (ISO 1101) geometric tolerance callouts.
        Symbols may appear as Unicode or as text abbreviations.

        Detected: flatness (⏥), straightness (⏤), roundness/circularity (○),
        cylindricity (⌭), perpendicularity (⊥), parallelism (∥),
        angularity (∠), total runout (◎), circular runout (↗),
        position (⊕), symmetry (≡), concentricity (◎).
        """
        features: List[DetectedFeature] = []

        symbol_map = {
            # Unicode symbols
            "⏤": "straightness",
            "⏥": "flatness",
            "○": "roundness",
            "⌭": "cylindricity",
            "⊥": "perpendicularity",
            "∥": "parallelism",
            "∠": "angularity",
            "⊕": "position",
            "◎": "concentricity",
            "≡": "symmetry",
            # Text abbreviations (common in French drawings)
        }

        text_sym_patterns = [
            (r"(?i)\bplat(?:éité|eity)?\b", "flatness"),
            (r"(?i)\bperpendicularité\b", "perpendicularity"),
            (r"(?i)\bcylindricité\b", "cylindricity"),
            (r"(?i)\bcircularité\b", "roundness"),
            (r"(?i)\bparallélisme\b", "parallelism"),
            (r"(?i)\bcoaxialité\b", "concentricity"),
            (r"(?i)\bsymétrie\b", "symmetry"),
            (r"(?i)\bflatness\b", "flatness"),
            (r"(?i)\bperpendicul\w+\b", "perpendicularity"),
            (r"(?i)\bparallelism\b", "parallelism"),
        ]

        # Check unicode symbols followed by a tolerance value
        for sym, name in symbol_map.items():
            pattern = rf"{re.escape(sym)}{_WS}({_N})"
            for m in re.finditer(pattern, text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.GEOMETRIC_TOLERANCE,
                    raw_text=m.group(0).strip(),
                    value=value,
                    qualifier=name,
                    confidence=0.95,
                ))

        # Check text-form symbols followed by tolerance value
        for pat, name in text_sym_patterns:
            for m in re.finditer(pat + rf"{_WS}({_N})", text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.GEOMETRIC_TOLERANCE,
                    raw_text=m.group(0).strip(),
                    value=value,
                    qualifier=name,
                    confidence=0.82,
                ))

        return features

    def _extract_angles(self, text: str) -> List[DetectedFeature]:
        """
        Detect angle callouts:
          30°,  45.5°,  angle 30°,  30 deg
        Excludes chamfer 45° (handled separately).
        """
        features: List[DetectedFeature] = []
        patterns = [
            rf"(?<!\d)({_N})\s*°(?!\s*[,;\d])",      # 30°  (not already caught by chamfer)
            rf"(?i)\bangle{_WS}=?{_WS}({_N})\s*°?",  # angle 45
            rf"(?i)\b({_N})\s*deg(?:ré|ree)?s?\b",    # 30 degrés
        ]
        for pat in patterns:
            for m in re.finditer(pat, text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                if value == 45.0:   # Skip – likely chamfer
                    continue
                if value > 360:
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.ANGLE,
                    raw_text=m.group(0).strip(),
                    value=value,
                    unit="deg",
                    confidence=0.85,
                ))
        return features

    def _extract_depths(self, text: str) -> List[DetectedFeature]:
        """
        Detect depth callouts:
          P20,  Prof. 20,  Depth 15,  ▼20,  ↓20
        """
        features: List[DetectedFeature] = []
        patterns = [
            (rf"(?i)(?:prof(?:ondeur)?\.?|depth)\s*=?\s*({_N})", 0.92),
            (rf"\bP({_N})\b", 0.78),
            (rf"(?:▼|↓)\s*({_N})", 0.90),
        ]
        for pat, conf in patterns:
            for m in re.finditer(pat, text):
                try:
                    value = float(m.group(1))
                except (ValueError, TypeError):
                    continue
                features.append(DetectedFeature(
                    feature_type=FeatureType.DEPTH,
                    raw_text=m.group(0).strip(),
                    value=value,
                    confidence=conf,
                ))
        return features

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _parse_tolerance(
        self, text: str, nominal: float
    ) -> Optional[Tuple[float, float]]:
        """
        Given a text fragment, try to extract an explicit tolerance band.
        Returns (upper, lower) where upper > 0 and lower < 0.
        """
        # ±0.05
        m = re.search(rf"[±±]\s*({_N})", text)
        if m:
            t = float(m.group(1))
            return (t, -t)

        # +0.1/-0.05  or  +0.030/0.000
        m = re.search(rf"([+\-]{_N})\s*/\s*([+\-]{_N})", text)
        if m:
            try:
                upper = float(m.group(1))
                lower = float(m.group(2))
                return (upper, lower)
            except ValueError:
                pass

        return None

    def _deduplicate(self, features: List[DetectedFeature]) -> List[DetectedFeature]:
        """
        Remove duplicate features by normalising raw_text and keeping the one
        with higher confidence when identical.
        """
        seen: Dict[str, DetectedFeature] = {}
        for f in features:
            key = re.sub(r"\s+", "", f.raw_text.lower())
            if key not in seen or f.confidence > seen[key].confidence:
                seen[key] = f
        return list(seen.values())
