"""
GeometryBuilder – Takes a list of DetectedFeature objects and constructs
a parametric 3D model description (GeometryModel).

Design approach
---------------
Industrial drawings rarely give explicit 3D positions – they present multiple
2D views.  Since we cannot do true multi-view reconstruction without layout
info, the builder applies a *heuristic inference* approach:

1. Derive the bounding box from the largest linear dimensions found.
2. Classify each feature (hole, pocket, chamfer, fillet, thread…) from its
   detected type and associated qualifiers.
3. Assign plausible 3D positions to holes by distributing them across the
   XY face.
4. Compute volume, surface area, and estimated part weight.

This is intentionally conservative: features with insufficient data to
position uniquely are added as notes rather than as misplaced geometry.
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Sequence, Tuple

from models.schemas import (
    BoundingBox,
    DetectedFeature,
    FeatureType,
    GeometricFeatureType,
    GeometryFeature,
    GeometryModel,
    MaterialType,
)

logger = logging.getLogger(__name__)

# Material density in g/cm³  (used for weight estimate)
MATERIAL_DENSITY: Dict[str, float] = {
    MaterialType.ALUMINUM: 2.70,
    MaterialType.STEEL: 7.85,
    MaterialType.STAINLESS: 7.90,
    MaterialType.TITANIUM: 4.43,
    MaterialType.BRASS: 8.50,
    MaterialType.PLASTIC: 1.20,
    MaterialType.CAST_IRON: 7.20,
    MaterialType.COPPER: 8.96,
}


class GeometryBuilder:
    """
    Builds a GeometryModel from a list of DetectedFeature objects.
    """

    # Minimum confidence to include a feature in the model
    MIN_CONFIDENCE = 0.70

    def __init__(self, material: MaterialType = MaterialType.ALUMINUM) -> None:
        self.material = material

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def build(
        self,
        features: List[DetectedFeature],
        part_name: Optional[str] = None,
    ) -> GeometryModel:
        """
        Main entry point.

        Parameters
        ----------
        features : list of DetectedFeature (from FeatureExtractor)
        part_name : optional string label

        Returns
        -------
        GeometryModel
        """
        # Filter by confidence
        confident = [f for f in features if f.confidence >= self.MIN_CONFIDENCE]
        logger.debug(
            "GeometryBuilder: %d/%d features above confidence threshold",
            len(confident), len(features),
        )

        # Step 1: derive bounding box
        bbox = self._derive_bounding_box(confident)

        # Step 2: build geometric features
        geo_features: List[GeometryFeature] = []
        notes: List[str] = []

        geo_features.extend(self._build_holes(confident, bbox))
        geo_features.extend(self._build_pockets(confident, bbox))
        geo_features.extend(self._build_chamfers(confident))
        geo_features.extend(self._build_fillets(confident))
        geo_features.extend(self._build_threads(confident, geo_features))

        # Attach surface finish to nearest hole/pocket if found
        self._attach_surface_finish(confident, geo_features)

        # Collect notes for features we couldn't position precisely
        notes.extend(self._collect_notes(confident, geo_features))

        # Step 3: compute derived values
        stock_volume = bbox.x * bbox.y * bbox.z
        part_volume = self._estimate_part_volume(stock_volume, geo_features)
        surface_area = self._estimate_surface_area(bbox, geo_features)
        removal_volume = stock_volume - part_volume
        density = MATERIAL_DENSITY.get(self.material, 2.70)
        weight_kg = (part_volume / 1e6) * density  # mm³ → cm³ → kg

        return GeometryModel(
            part_name=part_name,
            material=self.material,
            bounding_box=bbox,
            features=geo_features,
            volume=round(part_volume, 2),
            surface_area=round(surface_area, 2),
            stock_volume=round(stock_volume, 2),
            removal_volume=round(removal_volume, 2),
            estimated_weight_kg=round(weight_kg, 4),
            notes=notes,
        )

    # ------------------------------------------------------------------
    # Bounding box derivation
    # ------------------------------------------------------------------

    def _derive_bounding_box(self, features: List[DetectedFeature]) -> BoundingBox:
        """
        Infer the overall bounding box from the three largest linear dimensions.
        Falls back to sensible defaults if insufficient data.
        """
        # Collect all linear dimension values
        linear_values = sorted(
            [
                f.value
                for f in features
                if f.feature_type == FeatureType.DIMENSION
                and f.value is not None
                and f.value > 5.0       # ignore tiny annotations
                and f.value < 5000.0    # ignore obviously wrong values
            ],
            reverse=True,
        )

        if len(linear_values) >= 3:
            x = linear_values[0]
            y = linear_values[1]
            z = linear_values[2]
        elif len(linear_values) == 2:
            x, y = linear_values[0], linear_values[1]
            z = max(10.0, y * 0.3)   # Estimate thickness as 30% of smaller dim
        elif len(linear_values) == 1:
            x = linear_values[0]
            y = x * 0.6              # Assume 3:2 aspect ratio
            z = max(10.0, x * 0.2)
        else:
            # Absolute fallback: 100×80×30 mm placeholder
            logger.warning("No linear dimensions found – using default bounding box")
            return BoundingBox(x=100.0, y=80.0, z=30.0)

        # Sanity: ensure x >= y >= z (conventional: L×W×H)
        dims = sorted([x, y, z], reverse=True)
        return BoundingBox(x=round(dims[0], 3), y=round(dims[1], 3), z=round(dims[2], 3))

    # ------------------------------------------------------------------
    # Holes
    # ------------------------------------------------------------------

    def _build_holes(
        self,
        features: List[DetectedFeature],
        bbox: BoundingBox,
    ) -> List[GeometryFeature]:
        """
        Create a GeometryFeature(type=HOLE) for each detected diameter that
        is not a thread (threads get their own feature).
        Distributes holes across the top face (Z=0) in a grid pattern.
        """
        diameter_features = [
            f for f in features
            if f.feature_type == FeatureType.DIAMETER
            and f.value is not None
        ]

        holes: List[GeometryFeature] = []
        depths = [
            f.value for f in features
            if f.feature_type == FeatureType.DEPTH and f.value is not None
        ]

        for idx, df in enumerate(diameter_features):
            diam = df.value
            # Heuristic depth: use next available depth or fallback
            if depths:
                depth = depths[min(idx, len(depths) - 1)]
            else:
                depth = bbox.z  # Through-hole assumption

            # Determine if this hole has a thread
            thread_qual: Optional[str] = None

            # Grid distribution: simple row/column layout
            cols = max(1, int(math.sqrt(len(diameter_features))))
            row = idx // cols
            col = idx % cols
            margin_x = max(diam, bbox.x * 0.15)
            margin_y = max(diam, bbox.y * 0.15)
            spacing_x = (bbox.x - 2 * margin_x) / max(1, cols - 1 if cols > 1 else 1)
            spacing_y = (bbox.y - 2 * margin_y) / max(1, (len(diameter_features) // cols) or 1)

            pos_x = margin_x + col * spacing_x if cols > 1 else bbox.x / 2
            pos_y = margin_y + row * spacing_y

            hole = GeometryFeature(
                type=GeometricFeatureType.HOLE,
                position=[round(pos_x, 3), round(pos_y, 3), 0.0],
                diameter=round(diam, 3),
                depth=round(min(depth, bbox.z), 3),
                thread=thread_qual,
                tolerance=df.qualifier,
            )
            holes.append(hole)

        return holes

    # ------------------------------------------------------------------
    # Pockets
    # ------------------------------------------------------------------

    def _build_pockets(
        self,
        features: List[DetectedFeature],
        bbox: BoundingBox,
    ) -> List[GeometryFeature]:
        """
        Infer pockets from groups of linear dimensions that are significantly
        smaller than the bounding box.

        Heuristic: pairs of dimensions where both are < 80% of the bounding
        box side imply a recessed pocket.  We take up to 3 such pairs.
        """
        dims = sorted(
            [
                f.value
                for f in features
                if f.feature_type == FeatureType.DIMENSION
                and f.value is not None
                and f.value > 5.0
            ],
        )

        pockets: List[GeometryFeature] = []
        depths = [
            f.value for f in features
            if f.feature_type == FeatureType.DEPTH and f.value is not None
        ]
        pocket_depth = depths[0] if depths else 10.0

        # Look for dimension pairs that are clearly sub-features
        bbox_min = min(bbox.x, bbox.y)
        sub_dims = [d for d in dims if d < bbox_min * 0.75 and d > 5.0]

        # Group into pairs
        for i in range(0, min(len(sub_dims) - 1, 6), 2):
            w = sub_dims[i]
            length = sub_dims[i + 1]
            if w == length:
                continue   # Square pockets – only one, avoid duplication

            # Center the pocket on the part face with some offset
            offset_x = bbox.x * 0.35 + i * 5
            offset_y = bbox.y * 0.35 + i * 5

            pocket = GeometryFeature(
                type=GeometricFeatureType.POCKET,
                position=[
                    round(max(0, offset_x - w / 2), 3),
                    round(max(0, offset_y - length / 2), 3),
                    0.0,
                ],
                width=round(w, 3),
                length=round(length, 3),
                depth=round(min(pocket_depth, bbox.z * 0.6), 3),
                corner_radius=0.0,
            )
            pockets.append(pocket)

        return pockets

    # ------------------------------------------------------------------
    # Chamfers
    # ------------------------------------------------------------------

    def _build_chamfers(self, features: List[DetectedFeature]) -> List[GeometryFeature]:
        chamfer_features = [
            f for f in features
            if f.feature_type == FeatureType.CHAMFER and f.value is not None
        ]
        result: List[GeometryFeature] = []
        edges = ["top", "bottom", "edge_x_pos", "edge_x_neg", "edge_y_pos"]
        for idx, cf in enumerate(chamfer_features[:5]):  # max 5 chamfer features
            result.append(GeometryFeature(
                type=GeometricFeatureType.CHAMFER,
                edge=edges[idx % len(edges)],
                size=round(cf.value, 3),
                angle=cf.secondary_value or 45.0,
            ))
        return result

    # ------------------------------------------------------------------
    # Fillets (from radius features)
    # ------------------------------------------------------------------

    def _build_fillets(self, features: List[DetectedFeature]) -> List[GeometryFeature]:
        radius_features = [
            f for f in features
            if f.feature_type == FeatureType.RADIUS and f.value is not None
        ]
        result: List[GeometryFeature] = []
        for rf in radius_features[:4]:
            result.append(GeometryFeature(
                type=GeometricFeatureType.FILLET,
                radius=round(rf.value, 3),
                edge="corner",
            ))
        return result

    # ------------------------------------------------------------------
    # Threads (augment existing hole features or create new ones)
    # ------------------------------------------------------------------

    def _build_threads(
        self,
        features: List[DetectedFeature],
        existing_geo: List[GeometryFeature],
    ) -> List[GeometryFeature]:
        """
        For each detected thread, either augment the nearest hole of matching
        diameter or create a standalone thread feature.
        """
        thread_features = [
            f for f in features
            if f.feature_type == FeatureType.THREAD and f.value is not None
        ]
        new_features: List[GeometryFeature] = []

        for tf in thread_features:
            nominal_diam = tf.value
            # Find matching hole in existing geometry
            matched = False
            for geo in existing_geo:
                if (
                    geo.type == GeometricFeatureType.HOLE
                    and geo.diameter is not None
                    and abs(geo.diameter - nominal_diam) < 2.0
                    and geo.thread is None
                ):
                    geo.thread = tf.raw_text.strip()
                    geo.thread_depth = geo.depth
                    matched = True
                    break

            if not matched:
                # Create a new threaded hole entry
                new_features.append(GeometryFeature(
                    type=GeometricFeatureType.HOLE,
                    position=[20.0, 20.0, 0.0],
                    diameter=nominal_diam,
                    depth=nominal_diam * 2.0,   # Standard through/tapped depth
                    thread=tf.raw_text.strip(),
                    thread_depth=nominal_diam * 1.5,
                ))

        return new_features

    # ------------------------------------------------------------------
    # Surface finish annotation
    # ------------------------------------------------------------------

    def _attach_surface_finish(
        self,
        features: List[DetectedFeature],
        geo_features: List[GeometryFeature],
    ) -> None:
        """Attach Ra values to the first matching hole/pocket as metadata."""
        sf_values = [
            f.value for f in features
            if f.feature_type == FeatureType.SURFACE_FINISH
            and f.qualifier == "Ra"
            and f.value is not None
        ]
        if not sf_values:
            return
        # Attach the finest Ra to the first hole (typically a bored or reamed feature)
        finest_ra = min(sf_values)
        for gf in geo_features:
            if gf.type == GeometricFeatureType.HOLE:
                gf.surface_finish = finest_ra
                break

    # ------------------------------------------------------------------
    # Volume / area estimation
    # ------------------------------------------------------------------

    def _estimate_part_volume(
        self, stock_volume: float, geo_features: List[GeometryFeature]
    ) -> float:
        """Subtract removed volumes (holes, pockets) from stock."""
        removed = 0.0
        for gf in geo_features:
            if gf.type == GeometricFeatureType.HOLE:
                if gf.diameter and gf.depth:
                    r = gf.diameter / 2
                    removed += math.pi * r * r * gf.depth
            elif gf.type == GeometricFeatureType.POCKET:
                if gf.width and gf.length and gf.depth:
                    removed += gf.width * gf.length * gf.depth

        return max(stock_volume * 0.1, stock_volume - removed)

    def _estimate_surface_area(
        self, bbox: BoundingBox, geo_features: List[GeometryFeature]
    ) -> float:
        """Approximate surface area: box faces + hole walls."""
        lx, ly, lz = bbox.x, bbox.y, bbox.z
        area = 2 * (lx * ly + lx * lz + ly * lz)
        for gf in geo_features:
            if gf.type == GeometricFeatureType.HOLE:
                if gf.diameter and gf.depth:
                    r = gf.diameter / 2
                    area += 2 * math.pi * r * gf.depth   # Wall
                    area -= 2 * math.pi * r * r           # Remove top/bottom circles
        return max(0.0, area)

    # ------------------------------------------------------------------
    # Notes collection
    # ------------------------------------------------------------------

    def _collect_notes(
        self,
        features: List[DetectedFeature],
        geo_features: List[GeometryFeature],
    ) -> List[str]:
        """Collect annotations for features that could not be fully resolved."""
        notes: List[str] = []
        sf_features = [f for f in features if f.feature_type == FeatureType.SURFACE_FINISH]
        for sf in sf_features:
            notes.append(f"Surface finish specified: {sf.raw_text}")

        gt_features = [f for f in features if f.feature_type == FeatureType.GEOMETRIC_TOLERANCE]
        for gt in gt_features:
            notes.append(f"Geometric tolerance: {gt.qualifier} = {gt.value} mm")

        angle_features = [f for f in features if f.feature_type == FeatureType.ANGLE]
        for af in angle_features:
            notes.append(f"Angular feature: {af.raw_text}")

        return notes
