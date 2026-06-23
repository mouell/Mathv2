"""
OperationPlanner – converts a GeometryModel into an ordered list of
MachiningOperation objects with realistic cutting parameters.

Cutting parameter philosophy
----------------------------
Parameters are derived from empirical machining handbooks (Sandvik, Kennametal,
Mitsubishi) adapted for typical workshop CNC machines.

Material-specific surface speeds (Vc in m/min) are used to back-calculate
spindle RPM for each tool diameter:

    n = (Vc × 1000) / (π × D)

Feed per tooth (fz in mm/tooth) × number of flutes × RPM = feed rate.

Operation order (standard machining sequence)
---------------------------------------------
1. Face milling   – establish Z datum, clean top surface
2. Contour milling – external profile (rough then semi-finish)
3. Pocketing      – internal pockets
4. Center drilling – spot drill all hole locations
5. Drilling        – full holes
6. Reaming         – precision holes (H7 or better)
7. Tapping         – threaded holes
8. Chamfering      – edge chamfers
"""

from __future__ import annotations

import logging
import math
from typing import Dict, List, Optional, Sequence, Tuple

from models.schemas import (
    CuttingParameters,
    CuttingTool,
    GeometricFeatureType,
    GeometryFeature,
    GeometryModel,
    MachiningOperation,
    MaterialType,
    OperationType,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cutting speed tables  (Vc in m/min for carbide tooling, flood coolant)
# ---------------------------------------------------------------------------

# [face_mill, end_mill, drill, tap]
VC_TABLE: Dict[str, Tuple[float, float, float, float]] = {
    MaterialType.ALUMINUM:  (800, 400, 150, 15),
    MaterialType.BRASS:     (500, 250, 100, 12),
    MaterialType.PLASTIC:   (600, 300, 120, 10),
    MaterialType.STEEL:     (220, 120,  60,  6),
    MaterialType.STAINLESS: (160,  80,  40,  4),
    MaterialType.CAST_IRON: (200, 100,  70,  6),
    MaterialType.TITANIUM:  ( 60,  40,  20,  2),
    MaterialType.COPPER:    (350, 180,  80, 10),
}

# Feed per tooth (mm/tooth) for standard carbide tooling
FPT_TABLE: Dict[str, Tuple[float, float, float]] = {
    # [face_mill_fpt, end_mill_fpt, drill_fpt]
    MaterialType.ALUMINUM:  (0.12, 0.05, 0.08),
    MaterialType.BRASS:     (0.10, 0.04, 0.06),
    MaterialType.PLASTIC:   (0.15, 0.06, 0.10),
    MaterialType.STEEL:     (0.08, 0.03, 0.04),
    MaterialType.STAINLESS: (0.06, 0.02, 0.03),
    MaterialType.CAST_IRON: (0.10, 0.04, 0.05),
    MaterialType.TITANIUM:  (0.04, 0.02, 0.02),
    MaterialType.COPPER:    (0.10, 0.04, 0.06),
}

# Axial depth-of-cut multiplier relative to tool diameter (roughing)
DOC_RATIO: Dict[str, float] = {
    MaterialType.ALUMINUM:  1.0,
    MaterialType.BRASS:     0.8,
    MaterialType.PLASTIC:   1.2,
    MaterialType.STEEL:     0.4,
    MaterialType.STAINLESS: 0.3,
    MaterialType.CAST_IRON: 0.5,
    MaterialType.TITANIUM:  0.2,
    MaterialType.COPPER:    0.7,
}

# Radial stepover as fraction of tool diameter (milling)
STEPOVER_RATIO: Dict[str, float] = {
    MaterialType.ALUMINUM:  0.60,
    MaterialType.BRASS:     0.50,
    MaterialType.PLASTIC:   0.65,
    MaterialType.STEEL:     0.40,
    MaterialType.STAINLESS: 0.35,
    MaterialType.CAST_IRON: 0.45,
    MaterialType.TITANIUM:  0.25,
    MaterialType.COPPER:    0.50,
}


class OperationPlanner:
    """
    Generates an ordered machining plan from a geometry model.
    """

    def __init__(self, material: MaterialType = MaterialType.ALUMINUM) -> None:
        self.material = material
        self._vc = VC_TABLE.get(material, VC_TABLE[MaterialType.STEEL])
        self._fpt = FPT_TABLE.get(material, FPT_TABLE[MaterialType.STEEL])
        self._doc_ratio = DOC_RATIO.get(material, 0.4)
        self._so_ratio = STEPOVER_RATIO.get(material, 0.4)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def plan(self, geometry: GeometryModel) -> List[MachiningOperation]:
        """
        Generate the complete ordered operation list.
        """
        ops: List[MachiningOperation] = []
        seq = 1

        bbox = geometry.bounding_box
        features = geometry.features

        holes = [f for f in features if f.type == GeometricFeatureType.HOLE]
        pockets = [f for f in features if f.type == GeometricFeatureType.POCKET]
        chamfers_geo = [f for f in features if f.type == GeometricFeatureType.CHAMFER]
        threaded = [f for f in holes if f.thread]
        plain_holes = [f for f in holes if not f.thread]
        precision_holes = [f for f in plain_holes if f.tolerance in ("H7", "H6", "H5", "H8")]
        rough_holes = [f for f in plain_holes if f not in precision_holes]

        # 1. Face milling
        face_op = self._face_milling(seq, bbox)
        ops.append(face_op)
        seq += 1

        # 2. Contour milling (rough)
        contour_op = self._contour_milling(seq, bbox, rough=True)
        ops.append(contour_op)
        seq += 1

        # 3. Contour milling (finish)
        contour_fin = self._contour_milling(seq, bbox, rough=False)
        ops.append(contour_fin)
        seq += 1

        # 4. Pocketing
        for pocket in pockets:
            pocket_op = self._pocketing(seq, pocket)
            ops.append(pocket_op)
            seq += 1

        # 5. Center drilling (all holes)
        if holes:
            center_op = self._center_drilling(seq, holes)
            ops.append(center_op)
            seq += 1

        # 6. Drilling – rough holes
        for hole in rough_holes:
            drill_op = self._drilling(seq, hole)
            ops.append(drill_op)
            seq += 1

        # 7. Drilling + reaming – precision holes
        for hole in precision_holes:
            drill_op = self._drilling(seq, hole)
            ops.append(drill_op)
            seq += 1
            ream_op = self._reaming(seq, hole)
            ops.append(ream_op)
            seq += 1

        # 8. Tapping – threaded holes
        for hole in threaded:
            tap_op = self._tapping(seq, hole)
            ops.append(tap_op)
            seq += 1

        # 9. Chamfering
        if chamfers_geo:
            cham_op = self._chamfering(seq, chamfers_geo)
            ops.append(cham_op)
            seq += 1

        logger.info(
            "OperationPlanner generated %d operations for %s",
            len(ops),
            self.material,
        )
        return ops

    # ------------------------------------------------------------------
    # Individual operation builders
    # ------------------------------------------------------------------

    def _face_milling(self, seq: int, bbox) -> MachiningOperation:
        """Face mill the top surface."""
        tool_diam = 63.0   # Standard face mill diameter
        vc = self._vc[0]
        rpm = self._calc_rpm(vc, tool_diam)
        fpt = self._fpt[0]
        feed = self._calc_feed(fpt, 6, rpm)   # 6-insert face mill
        doc = 0.5   # Face milling finish pass

        area = bbox.x * bbox.y  # mm²
        passes_y = math.ceil(bbox.y / (tool_diam * 0.75))
        path_length = passes_y * (bbox.x + 2 * 10)  # 10mm approach
        time_cut = (path_length / feed) + passes_y * (5 / (feed * 0.1))
        time_min = time_cut / 60

        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.FACE_MILLING,
            description=f"Face milling – Top surface {bbox.x:.0f}×{bbox.y:.0f} mm",
            tool=CuttingTool(
                tool_number=1,
                name="FRAISE SURFAÇAGE D63",
                tool_type="face_mill",
                diameter=tool_diam,
                num_flutes=6,
                material="carbide",
                coating="TiAlN",
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=int(feed),
                depth_of_cut_mm=doc,
                stepover_mm=round(tool_diam * 0.75, 1),
                plunge_rate_mmpm=int(feed * 0.3),
                retract_height_mm=5.0,
                coolant=True,
                climb_milling=True,
            ),
            estimated_time_min=round(time_min, 2),
        )

    def _contour_milling(
        self, seq: int, bbox, rough: bool = True
    ) -> MachiningOperation:
        """External contour milling – rough or finish."""
        tool_diam = 16.0 if rough else 12.0
        vc = self._vc[1]
        rpm = self._calc_rpm(vc, tool_diam)
        fpt = self._fpt[1]
        feed = self._calc_feed(fpt, 4, rpm)
        doc = round(tool_diam * self._doc_ratio, 2) if rough else round(tool_diam * 0.1, 2)
        stepover = round(tool_diam * self._so_ratio, 2) if rough else round(tool_diam * 0.05, 2)

        perimeter = 2 * (bbox.x + bbox.y)
        num_passes = math.ceil(bbox.z / doc)
        path_length = perimeter * num_passes + num_passes * 20  # approach
        time_min = (path_length / feed) / 60

        op_type = OperationType.CONTOUR_MILLING
        label = "Ébauche contour" if rough else "Finition contour"
        t_num = 2 if rough else 3
        t_name = f"FRAISE 2T D{int(tool_diam)} EBAUCHE" if rough else f"FRAISE 4T D{int(tool_diam)} FINITION"

        return MachiningOperation(
            sequence=seq,
            operation_type=op_type,
            description=f"{label} extérieur {bbox.x:.0f}×{bbox.y:.0f}×{bbox.z:.0f} mm",
            tool=CuttingTool(
                tool_number=t_num,
                name=t_name,
                tool_type="end_mill",
                diameter=tool_diam,
                num_flutes=2 if rough else 4,
                material="carbide",
                coating="TiAlN",
                radius=0.0,
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=int(feed),
                depth_of_cut_mm=doc,
                stepover_mm=stepover,
                plunge_rate_mmpm=int(feed * 0.3),
                coolant=True,
                climb_milling=True,
            ),
            estimated_time_min=round(time_min, 2),
        )

    def _pocketing(self, seq: int, pocket: GeometryFeature) -> MachiningOperation:
        """Pocket milling for a rectangular pocket."""
        tool_diam = min(12.0, (pocket.width or 20) / 3)
        tool_diam = max(4.0, round(tool_diam, 0))  # min 4mm
        vc = self._vc[1]
        rpm = self._calc_rpm(vc, tool_diam)
        fpt = self._fpt[1]
        feed = self._calc_feed(fpt, 4, rpm)
        doc = round(tool_diam * self._doc_ratio * 0.8, 2)
        stepover = round(tool_diam * self._so_ratio, 2)
        depth = pocket.depth or 10.0

        area = (pocket.width or 20) * (pocket.length or 20)
        passes = math.ceil(depth / doc)
        rows_per_pass = math.ceil((pocket.width or 20) / stepover)
        path_length = passes * rows_per_pass * (pocket.length or 20) + passes * 50
        time_min = (path_length / feed) / 60

        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.POCKETING,
            description=(
                f"Poche {pocket.width:.0f}×{pocket.length:.0f}×{depth:.0f} mm "
                f"@ ({pocket.position[0]:.0f},{pocket.position[1]:.0f})"
            ),
            tool=CuttingTool(
                tool_number=seq + 2,
                name=f"FRAISE 4T D{int(tool_diam)} POCHE",
                tool_type="end_mill",
                diameter=tool_diam,
                num_flutes=4,
                material="carbide",
                coating="TiAlN",
                radius=0.0,
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=int(feed),
                depth_of_cut_mm=doc,
                stepover_mm=stepover,
                plunge_rate_mmpm=int(feed * 0.25),
                coolant=True,
            ),
            target_features=[pocket.id],
            estimated_time_min=round(time_min, 2),
        )

    def _center_drilling(
        self, seq: int, holes: List[GeometryFeature]
    ) -> MachiningOperation:
        """Center-drill all hole locations."""
        vc = self._vc[2] * 1.5   # Center drills run faster (short, rigid)
        tool_diam = 5.0           # #2 center drill / spot drill 5mm
        rpm = self._calc_rpm(vc, tool_diam)
        feed = 50.0

        time_per_hole = 0.02
        time_min = len(holes) * time_per_hole + len(holes) * 0.005

        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.CENTER_DRILLING,
            description=f"Perçage centrage – {len(holes)} trous",
            tool=CuttingTool(
                tool_number=seq + 2,
                name="FORET CENTRAGE 5mm 90°",
                tool_type="center_drill",
                diameter=5.0,
                num_flutes=2,
                material="hss",
                coating="TiN",
                taper_angle=90.0,
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=int(feed),
                depth_of_cut_mm=2.5,
                stepover_mm=0.0,
                plunge_rate_mmpm=int(feed * 0.5),
                coolant=True,
            ),
            target_features=[h.id for h in holes],
            estimated_time_min=round(time_min, 2),
        )

    def _drilling(self, seq: int, hole: GeometryFeature) -> MachiningOperation:
        """Drill a single hole."""
        diam = hole.diameter or 10.0
        depth = hole.depth or 20.0
        vc = self._vc[2]
        rpm = self._calc_rpm(vc, diam)
        fpt = self._fpt[2]
        feed = round(fpt * rpm, 1)    # drill: 1 flute equivalent per rev

        # Peck depth: 3× diameter for deep holes, full for shallow
        peck = min(depth, diam * 3)
        is_deep = depth > diam * 4

        # Machining time estimate
        num_pecks = math.ceil(depth / peck)
        time_min = (depth / feed + num_pecks * 0.005) / 60

        desc_suffix = " (forage profond)" if is_deep else ""
        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.DRILLING,
            description=f"Perçage Ø{diam:.1f} P{depth:.1f}{desc_suffix}",
            tool=CuttingTool(
                tool_number=seq + 2,
                name=f"FORET Ø{diam:.1f} CARBURE",
                tool_type="drill",
                diameter=diam,
                num_flutes=2,
                material="carbide",
                coating="TiAlN",
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=round(feed, 1),
                depth_of_cut_mm=round(peck, 2),
                stepover_mm=0.0,
                plunge_rate_mmpm=round(feed, 1),
                coolant=True,
            ),
            target_features=[hole.id],
            notes=["G83 cycle de débourrage" if is_deep else "G81 perçage simple"],
            estimated_time_min=round(time_min, 2),
        )

    def _reaming(self, seq: int, hole: GeometryFeature) -> MachiningOperation:
        """Ream a precision hole (H7/H6)."""
        diam = hole.diameter or 10.0
        depth = hole.depth or 20.0
        # Reaming: low speed, high feed
        vc_ream = self._vc[2] * 0.4
        rpm = self._calc_rpm(vc_ream, diam)
        feed = round(0.2 * diam * rpm / 1000, 1)  # 0.2mm/rev
        time_min = (depth / feed) / 60

        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.REAMING,
            description=f"Alésage Ø{diam:.1f} {hole.tolerance or 'H7'}",
            tool=CuttingTool(
                tool_number=seq + 2,
                name=f"ALÉSOIR Ø{diam:.3f} {hole.tolerance or 'H7'}",
                tool_type="reamer",
                diameter=diam,
                num_flutes=6,
                material="carbide",
                coating="TiAlN",
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=round(feed, 1),
                depth_of_cut_mm=diam * 0.005,  # ~0.1mm stock removal
                stepover_mm=0.0,
                plunge_rate_mmpm=round(feed, 1),
                coolant=True,
            ),
            target_features=[hole.id],
            estimated_time_min=round(time_min, 2),
        )

    def _tapping(self, seq: int, hole: GeometryFeature) -> MachiningOperation:
        """Tap a threaded hole."""
        thread_str = hole.thread or "M10"
        # Parse nominal diameter from thread string
        import re
        m = re.match(r"M(\d+(?:\.\d+)?)", thread_str)
        diam = float(m.group(1)) if m else (hole.diameter or 10.0)

        # Standard metric pitch lookup
        std_pitches = {2: 0.4, 3: 0.5, 4: 0.7, 5: 0.8, 6: 1.0,
                       8: 1.25, 10: 1.5, 12: 1.75, 16: 2.0, 20: 2.5}
        pitch = hole.thread_depth or std_pitches.get(int(diam), 1.5)

        vc_tap = self._vc[3]
        rpm = min(int(self._calc_rpm(vc_tap, diam)), 800)  # max 800 rpm for tapping
        feed = round(pitch * rpm, 1)  # synchronized feed for tapping
        depth = hole.thread_depth or (hole.depth or diam * 1.5)
        time_min = (depth / feed * 2 + 0.01) / 60  # include reverse

        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.TAPPING,
            description=f"Taraudage {thread_str} P{depth:.1f}",
            tool=CuttingTool(
                tool_number=seq + 2,
                name=f"TARAUD {thread_str}",
                tool_type="tap",
                diameter=diam,
                num_flutes=3,
                material="hss",
                coating="TiN",
                thread_pitch=pitch,
            ),
            parameters=CuttingParameters(
                spindle_rpm=rpm,
                feed_rate_mmpm=round(feed, 1),
                depth_of_cut_mm=depth,
                stepover_mm=0.0,
                plunge_rate_mmpm=round(feed, 1),
                coolant=True,
                climb_milling=False,
            ),
            target_features=[hole.id],
            notes=[f"G84 cycle taraudage pas={pitch:.2f}mm"],
            estimated_time_min=round(time_min, 2),
        )

    def _chamfering(
        self, seq: int, chamfers: List[GeometryFeature]
    ) -> MachiningOperation:
        """Chamfer edges."""
        total_length = sum((c.size or 2.0) * 4 * 2 for c in chamfers)  # approx per edge
        tool_diam = 16.0
        vc = self._vc[1] * 0.8
        rpm = self._calc_rpm(vc, tool_diam)
        feed = 500.0

        time_min = (total_length / feed) / 60 + len(chamfers) * 0.02

        return MachiningOperation(
            sequence=seq,
            operation_type=OperationType.CHAMFERING,
            description=f"Chanfreinage {len(chamfers)} arête(s)",
            tool=CuttingTool(
                tool_number=seq + 2,
                name="FRAISE CHANFREIN 45° D16",
                tool_type="chamfer_mill",
                diameter=tool_diam,
                num_flutes=4,
                material="carbide",
                coating="TiAlN",
                taper_angle=45.0,
            ),
            parameters=CuttingParameters(
                spindle_rpm=int(rpm),
                feed_rate_mmpm=int(feed),
                depth_of_cut_mm=2.0,
                stepover_mm=0.0,
                plunge_rate_mmpm=200,
                coolant=True,
            ),
            estimated_time_min=round(time_min, 2),
        )

    # ------------------------------------------------------------------
    # Utility methods
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_rpm(vc_m_min: float, diameter_mm: float) -> float:
        """n = (Vc × 1000) / (π × D)"""
        if diameter_mm <= 0:
            return 1000.0
        return (vc_m_min * 1000.0) / (math.pi * diameter_mm)

    @staticmethod
    def _calc_feed(fpt: float, num_flutes: int, rpm: float) -> float:
        """Vf = fz × z × n"""
        return fpt * num_flutes * rpm
