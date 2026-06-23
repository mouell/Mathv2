"""
ToolpathGenerator – Generates geometric toolpath coordinates for each
MachiningOperation, producing a sequence of PathSegment objects.

Path segments types
-------------------
  rapid    – G00: fast traverse (air move)
  cut      – G01: linear cut at feed rate
  plunge   – G01 downward at plunge feed
  retract  – G00: lift to retract height
  arc_cw   – G02: clockwise arc
  arc_ccw  – G03: counter-clockwise arc

All coordinates are in the workpiece coordinate system (WCS) with:
  Origin  = top-left corner of the bounding box
  X+      = right
  Y+      = away from operator
  Z0      = top face of part
  Z-      = down into material

Approach moves: 5mm above Z0, then plunge.
Retract height: 5mm above Z0 by default.
"""

from __future__ import annotations

import logging
import math
from typing import List, Optional, Tuple

from models.schemas import (
    CuttingParameters,
    GeometricFeatureType,
    GeometryFeature,
    GeometryModel,
    MachiningOperation,
    OperationToolpath,
    OperationType,
    PathSegment,
)

logger = logging.getLogger(__name__)

RETRACT_HEIGHT = 5.0   # mm above Z0


class ToolpathGenerator:
    """
    Generates toolpath coordinates for all machining operations.

    Usage::

        gen = ToolpathGenerator(geometry)
        toolpaths = gen.generate_all(operations)
    """

    def __init__(self, geometry: GeometryModel) -> None:
        self.geometry = geometry
        self.bbox = geometry.bounding_box
        self._feature_map = {f.id: f for f in geometry.features}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_all(
        self, operations: List[MachiningOperation]
    ) -> List[OperationToolpath]:
        """Generate toolpaths for every operation in the list."""
        toolpaths: List[OperationToolpath] = []
        for op in operations:
            tp = self.generate_for_operation(op)
            toolpaths.append(tp)
        return toolpaths

    def generate_for_operation(self, op: MachiningOperation) -> OperationToolpath:
        """Dispatch to the correct generator based on operation type."""
        generators = {
            OperationType.FACE_MILLING:    self._gen_face_milling,
            OperationType.CONTOUR_MILLING: self._gen_contour_milling,
            OperationType.POCKETING:       self._gen_pocketing,
            OperationType.CENTER_DRILLING: self._gen_center_drilling,
            OperationType.DRILLING:        self._gen_drilling,
            OperationType.REAMING:         self._gen_drilling,      # same pattern
            OperationType.TAPPING:         self._gen_drilling,      # same pattern
            OperationType.CHAMFERING:      self._gen_chamfering,
        }
        gen_fn = generators.get(op.operation_type, self._gen_fallback)
        segments = gen_fn(op)

        # Calculate totals
        total_dist = sum(self._seg_length(s) for s in segments)
        feed = op.parameters.feed_rate_mmpm
        cut_dist = sum(
            self._seg_length(s) for s in segments
            if s.move_type in ("cut", "plunge", "arc_cw", "arc_ccw")
        )
        time_min = (cut_dist / feed if feed > 0 else 0) / 60 + \
                   sum(
                       self._seg_length(s) for s in segments
                       if s.move_type in ("rapid", "retract")
                   ) / 30000 * 60  # Rapids at 30 m/min

        return OperationToolpath(
            operation_id=op.id,
            operation_type=str(op.operation_type),
            segments=segments,
            total_distance_mm=round(total_dist, 2),
            estimated_time_min=round(time_min, 3),
        )

    # ------------------------------------------------------------------
    # Face milling – zigzag raster
    # ------------------------------------------------------------------

    def _gen_face_milling(self, op: MachiningOperation) -> List[PathSegment]:
        """
        Zigzag raster toolpath for face milling.
        The cutter starts outside the part (-5mm in X) and sweeps across in Y.
        """
        segs: List[PathSegment] = []
        diam = op.tool.diameter
        stepover = op.parameters.stepover_mm
        params = op.parameters

        lx = self.bbox.x
        ly = self.bbox.y
        z_top = RETRACT_HEIGHT

        # Starting position: left of part, center Y
        start_x = -diam / 2 - 5
        end_x = lx + diam / 2 + 5

        y_positions: List[float] = []
        y = -diam / 2
        while y <= ly + diam / 2:
            y_positions.append(round(y, 3))
            y += stepover

        # Rapid to start
        segs.append(PathSegment(
            move_type="rapid",
            from_pos=[0, 0, z_top],
            to_pos=[start_x, y_positions[0] if y_positions else 0, z_top],
        ))
        # Plunge to cut depth
        z_cut = -params.depth_of_cut_mm
        segs.append(PathSegment(
            move_type="plunge",
            from_pos=[start_x, y_positions[0] if y_positions else 0, z_top],
            to_pos=[start_x, y_positions[0] if y_positions else 0, z_cut],
            feed_rate=params.plunge_rate_mmpm,
        ))

        direction = 1  # +X first
        for i, y_pos in enumerate(y_positions):
            x_from = start_x if direction > 0 else end_x
            x_to = end_x if direction > 0 else start_x

            segs.append(PathSegment(
                move_type="cut",
                from_pos=[x_from, y_pos, z_cut],
                to_pos=[x_to, y_pos, z_cut],
                feed_rate=params.feed_rate_mmpm,
            ))

            # Step in Y if not last pass
            if i < len(y_positions) - 1:
                y_next = y_positions[i + 1]
                segs.append(PathSegment(
                    move_type="cut",
                    from_pos=[x_to, y_pos, z_cut],
                    to_pos=[x_to, y_next, z_cut],
                    feed_rate=params.feed_rate_mmpm,
                ))
            direction = -direction

        # Retract
        current_x = end_x if len(y_positions) % 2 == 0 else start_x
        segs.append(PathSegment(
            move_type="retract",
            from_pos=[current_x, y_positions[-1] if y_positions else 0, z_cut],
            to_pos=[current_x, y_positions[-1] if y_positions else 0, z_top],
        ))

        return segs

    # ------------------------------------------------------------------
    # Contour milling – rectangular profile
    # ------------------------------------------------------------------

    def _gen_contour_milling(self, op: MachiningOperation) -> List[PathSegment]:
        """
        Rectangular contour path following the bounding box.
        Multiple Z-depth passes for rough cuts.
        """
        segs: List[PathSegment] = []
        lx, ly = self.bbox.x, self.bbox.y
        diam = op.tool.diameter
        params = op.parameters

        # Offset from part boundary
        offset = diam / 2

        # Profile corners (climb milling: CCW for outside)
        corners = [
            [-offset, -offset],
            [lx + offset, -offset],
            [lx + offset, ly + offset],
            [-offset, ly + offset],
        ]

        z = RETRACT_HEIGHT
        doc = params.depth_of_cut_mm
        total_depth = self.bbox.z

        # Approach rapid
        segs.append(PathSegment(
            move_type="rapid",
            from_pos=[0, 0, RETRACT_HEIGHT + 50],
            to_pos=[corners[0][0] - 10, corners[0][1], RETRACT_HEIGHT],
        ))

        current_z = 0.0
        while current_z > -total_depth:
            current_z = max(-total_depth, current_z - doc)

            # Plunge
            segs.append(PathSegment(
                move_type="plunge",
                from_pos=[corners[0][0] - 10, corners[0][1], RETRACT_HEIGHT],
                to_pos=[corners[0][0] - 10, corners[0][1], current_z],
                feed_rate=params.plunge_rate_mmpm,
            ))
            # Lead-in to start corner
            segs.append(PathSegment(
                move_type="cut",
                from_pos=[corners[0][0] - 10, corners[0][1], current_z],
                to_pos=[corners[0][0], corners[0][1], current_z],
                feed_rate=params.feed_rate_mmpm,
            ))

            # Profile passes
            for i in range(len(corners)):
                c_from = corners[i]
                c_to = corners[(i + 1) % len(corners)]
                segs.append(PathSegment(
                    move_type="cut",
                    from_pos=[c_from[0], c_from[1], current_z],
                    to_pos=[c_to[0], c_to[1], current_z],
                    feed_rate=params.feed_rate_mmpm,
                ))

        # Final retract
        segs.append(PathSegment(
            move_type="retract",
            from_pos=[corners[0][0], corners[0][1], current_z],
            to_pos=[corners[0][0], corners[0][1], RETRACT_HEIGHT],
        ))

        return segs

    # ------------------------------------------------------------------
    # Pocketing – spiral / offset strategy
    # ------------------------------------------------------------------

    def _gen_pocketing(self, op: MachiningOperation) -> List[PathSegment]:
        """
        Spiral inward pocketing for rectangular pockets.
        Uses zigzag raster within the pocket boundary.
        """
        segs: List[PathSegment] = []
        params = op.parameters
        diam = op.tool.diameter
        stepover = params.stepover_mm

        # Find target pocket from features
        pocket: Optional[GeometryFeature] = None
        for fid in op.target_features:
            f = self._feature_map.get(fid)
            if f and f.type == GeometricFeatureType.POCKET:
                pocket = f
                break

        if pocket is None:
            # Fallback: pocket at center of part
            pocket_x = self.bbox.x * 0.25
            pocket_y = self.bbox.y * 0.25
            pocket_w = self.bbox.x * 0.5
            pocket_l = self.bbox.y * 0.5
            pocket_d = min(10.0, self.bbox.z * 0.3)
        else:
            pocket_x = pocket.position[0]
            pocket_y = pocket.position[1]
            pocket_w = pocket.width or 20
            pocket_l = pocket.length or 20
            pocket_d = pocket.depth or 10

        # Rapid to pocket start (center)
        cx = pocket_x + pocket_w / 2
        cy = pocket_y + pocket_l / 2

        segs.append(PathSegment(
            move_type="rapid",
            from_pos=[0, 0, RETRACT_HEIGHT],
            to_pos=[cx, cy, RETRACT_HEIGHT],
        ))

        current_z = 0.0
        doc = params.depth_of_cut_mm

        while current_z > -pocket_d:
            current_z = max(-pocket_d, current_z - doc)

            # Helix entry (approximated as plunge for simplicity)
            segs.append(PathSegment(
                move_type="plunge",
                from_pos=[cx, cy, RETRACT_HEIGHT if current_z == -doc else current_z + doc],
                to_pos=[cx, cy, current_z],
                feed_rate=params.plunge_rate_mmpm,
            ))

            # Zigzag inside pocket
            margin = diam / 2
            x0 = pocket_x + margin
            x1 = pocket_x + pocket_w - margin
            y0 = pocket_y + margin
            y1 = pocket_y + pocket_l - margin

            if x1 <= x0 or y1 <= y0:
                break  # Pocket too small for this tool

            y_pos = y0
            direction = 1
            while y_pos <= y1 + 0.001:
                x_from = x0 if direction > 0 else x1
                x_to = x1 if direction > 0 else x0
                segs.append(PathSegment(
                    move_type="cut",
                    from_pos=[x_from, y_pos, current_z],
                    to_pos=[x_to, y_pos, current_z],
                    feed_rate=params.feed_rate_mmpm,
                ))
                y_pos = round(y_pos + stepover, 3)
                if y_pos <= y1:
                    segs.append(PathSegment(
                        move_type="cut",
                        from_pos=[x_to, y_pos - stepover, current_z],
                        to_pos=[x_to, y_pos, current_z],
                        feed_rate=params.feed_rate_mmpm,
                    ))
                direction = -direction

        # Retract
        segs.append(PathSegment(
            move_type="retract",
            from_pos=[cx, cy, current_z],
            to_pos=[cx, cy, RETRACT_HEIGHT],
        ))

        return segs

    # ------------------------------------------------------------------
    # Center drilling / Drilling / Reaming / Tapping – point moves
    # ------------------------------------------------------------------

    def _gen_center_drilling(self, op: MachiningOperation) -> List[PathSegment]:
        """Generate rapid-drill-retract for all hole locations."""
        segs: List[PathSegment] = []
        params = op.parameters
        holes = [
            self._feature_map.get(fid)
            for fid in op.target_features
            if fid in self._feature_map
        ]
        if not holes:
            holes = [f for f in self.geometry.features
                     if f.type == GeometricFeatureType.HOLE]

        z_center = -params.depth_of_cut_mm

        for hole in holes:
            if hole is None:
                continue
            px, py = hole.position[0], hole.position[1]

            segs.append(PathSegment(
                move_type="rapid",
                from_pos=[0, 0, RETRACT_HEIGHT] if not segs else segs[-1].to_pos,
                to_pos=[px, py, RETRACT_HEIGHT],
            ))
            segs.append(PathSegment(
                move_type="plunge",
                from_pos=[px, py, RETRACT_HEIGHT],
                to_pos=[px, py, z_center],
                feed_rate=params.plunge_rate_mmpm,
            ))
            segs.append(PathSegment(
                move_type="retract",
                from_pos=[px, py, z_center],
                to_pos=[px, py, RETRACT_HEIGHT],
            ))

        return segs

    def _gen_drilling(self, op: MachiningOperation) -> List[PathSegment]:
        """
        Generate peck drilling cycle for a single hole.
        For deep holes: repeated partial-depth plunges with retract (G83-style).
        For shallow holes: single plunge (G81-style).
        """
        segs: List[PathSegment] = []
        params = op.parameters

        # Find target hole
        hole: Optional[GeometryFeature] = None
        for fid in op.target_features:
            f = self._feature_map.get(fid)
            if f:
                hole = f
                break

        if hole is None:
            return segs

        px, py = hole.position[0], hole.position[1]
        z_final = -(hole.depth or params.depth_of_cut_mm)
        peck = -params.depth_of_cut_mm

        segs.append(PathSegment(
            move_type="rapid",
            from_pos=[0, 0, RETRACT_HEIGHT],
            to_pos=[px, py, RETRACT_HEIGHT],
        ))

        # Peck cycle
        current_z = 0.0
        while current_z > z_final:
            next_z = max(z_final, current_z + peck)

            segs.append(PathSegment(
                move_type="plunge",
                from_pos=[px, py, current_z if current_z == 0 else RETRACT_HEIGHT],
                to_pos=[px, py, next_z],
                feed_rate=params.feed_rate_mmpm,
            ))

            if next_z > z_final:
                # Retract for chip clearance (G83-style)
                segs.append(PathSegment(
                    move_type="retract",
                    from_pos=[px, py, next_z],
                    to_pos=[px, py, RETRACT_HEIGHT],
                ))
            current_z = next_z

        # Final retract
        segs.append(PathSegment(
            move_type="retract",
            from_pos=[px, py, z_final],
            to_pos=[px, py, RETRACT_HEIGHT],
        ))

        return segs

    # ------------------------------------------------------------------
    # Chamfering – contour pass at chamfer depth
    # ------------------------------------------------------------------

    def _gen_chamfering(self, op: MachiningOperation) -> List[PathSegment]:
        """
        Chamfer pass: follow the external contour at Z = -chamfer_size.
        """
        segs: List[PathSegment] = []
        diam = op.tool.diameter
        params = op.parameters
        lx, ly = self.bbox.x, self.bbox.y
        offset = diam / 2
        z_cham = -params.depth_of_cut_mm

        corners = [
            [-offset, -offset],
            [lx + offset, -offset],
            [lx + offset, ly + offset],
            [-offset, ly + offset],
        ]

        segs.append(PathSegment(
            move_type="rapid",
            from_pos=[0, 0, RETRACT_HEIGHT],
            to_pos=[corners[0][0] - 5, corners[0][1], RETRACT_HEIGHT],
        ))
        segs.append(PathSegment(
            move_type="plunge",
            from_pos=[corners[0][0] - 5, corners[0][1], RETRACT_HEIGHT],
            to_pos=[corners[0][0] - 5, corners[0][1], z_cham],
            feed_rate=params.plunge_rate_mmpm,
        ))
        segs.append(PathSegment(
            move_type="cut",
            from_pos=[corners[0][0] - 5, corners[0][1], z_cham],
            to_pos=[corners[0][0], corners[0][1], z_cham],
            feed_rate=params.feed_rate_mmpm,
        ))

        for i in range(len(corners)):
            c_from = corners[i]
            c_to = corners[(i + 1) % len(corners)]
            segs.append(PathSegment(
                move_type="cut",
                from_pos=[c_from[0], c_from[1], z_cham],
                to_pos=[c_to[0], c_to[1], z_cham],
                feed_rate=params.feed_rate_mmpm,
            ))

        segs.append(PathSegment(
            move_type="retract",
            from_pos=[corners[0][0], corners[0][1], z_cham],
            to_pos=[corners[0][0], corners[0][1], RETRACT_HEIGHT],
        ))

        return segs

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    def _gen_fallback(self, op: MachiningOperation) -> List[PathSegment]:
        """Minimal placeholder toolpath for unsupported operation types."""
        return [
            PathSegment(
                move_type="rapid",
                from_pos=[0, 0, RETRACT_HEIGHT],
                to_pos=[self.bbox.x / 2, self.bbox.y / 2, RETRACT_HEIGHT],
            )
        ]

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    @staticmethod
    def _seg_length(seg: PathSegment) -> float:
        """Euclidean distance of a path segment."""
        dx = seg.to_pos[0] - seg.from_pos[0]
        dy = seg.to_pos[1] - seg.from_pos[1]
        dz = seg.to_pos[2] - seg.from_pos[2]
        return math.sqrt(dx * dx + dy * dy + dz * dz)
