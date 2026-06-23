"""
GCodeGenerator – Produces complete, ready-to-run G-Code programs from
machining operations and toolpaths for multiple CNC controller dialects.

Supported controllers
---------------------
  fanuc       – Fanuc 0i / 16i / 18i / 30i (most common worldwide)
  siemens     – Siemens SINUMERIK 840D sl / 828D
  heidenhain  – Heidenhain iTNC 530 / TNC 640 (conversational)
  iso         – Generic ISO 6983 subset (portable)
  mazak       – Mazak Mazatrol / ISO mode
  okuma       – Okuma OSP-P300 / OSP-P500

Each controller method returns a complete program string with:
  - Program header (number, name, date, material)
  - Initialisation block (modal resets)
  - For each operation: tool change, spindle, coolant, cycle
  - Program end (M30)
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from models.schemas import (
    ControllerType,
    CuttingParameters,
    CuttingTool,
    GCodeProgram,
    GeometricFeatureType,
    GeometryModel,
    MachiningOperation,
    MaterialType,
    OperationToolpath,
    OperationType,
    PathSegment,
)

# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def _f(value: float, decimals: int = 3) -> str:
    """Format a float to fixed decimals, always with sign-less form for G-Code."""
    return f"{value:.{decimals}f}"


def _coord(value: float) -> str:
    """Format a coordinate value (3 decimal places)."""
    return _f(value, 3)


def _rpm(value: int) -> str:
    return str(int(value))


def _feed(value: float) -> str:
    return _f(value, 1)


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class GCodeGenerator:
    """
    Generates complete G-Code programs for multiple CNC controller types.

    Usage::

        gen = GCodeGenerator(geometry, material=MaterialType.ALUMINUM)
        programs = gen.generate_all(operations, toolpaths, program_name="PIECE_001")
    """

    def __init__(
        self,
        geometry: GeometryModel,
        material: MaterialType = MaterialType.ALUMINUM,
        work_offset: str = "G54",
        program_number: str = "0001",
    ) -> None:
        self.geometry = geometry
        self.material = material
        self.work_offset = work_offset
        self.program_number = program_number
        self.bbox = geometry.bounding_box
        self._feature_map = {f.id: f for f in geometry.features}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_all(
        self,
        operations: List[MachiningOperation],
        toolpaths: List[OperationToolpath],
        program_name: str = "PIECE_001",
        controllers: Optional[List[ControllerType]] = None,
    ) -> Dict[str, GCodeProgram]:
        """
        Generate programs for all requested controllers (default: all four).
        Returns dict keyed by controller name.
        """
        if controllers is None:
            controllers = [
                ControllerType.FANUC,
                ControllerType.SIEMENS,
                ControllerType.HEIDENHAIN,
                ControllerType.ISO,
            ]

        tp_map: Dict[str, OperationToolpath] = {tp.operation_id: tp for tp in toolpaths}
        result: Dict[str, GCodeProgram] = {}

        for ctrl in controllers:
            program = self._generate_for_controller(
                ctrl, operations, toolpaths, tp_map, program_name
            )
            # Use plain name (e.g. "fanuc") as the dict key, not the full enum repr
            key = ctrl.value if hasattr(ctrl, "value") else str(ctrl)
            result[key] = program

        return result

    def generate_for_controller(
        self,
        controller: ControllerType,
        operations: List[MachiningOperation],
        toolpaths: List[OperationToolpath],
        program_name: str = "PIECE_001",
    ) -> GCodeProgram:
        tp_map = {tp.operation_id: tp for tp in toolpaths}
        return self._generate_for_controller(
            controller, operations, toolpaths, tp_map, program_name
        )

    # ------------------------------------------------------------------
    # Controller dispatch
    # ------------------------------------------------------------------

    def _generate_for_controller(
        self,
        controller: ControllerType,
        operations: List[MachiningOperation],
        toolpaths: List[OperationToolpath],
        tp_map: Dict[str, OperationToolpath],
        program_name: str,
    ) -> GCodeProgram:
        dispatch = {
            ControllerType.FANUC:      self._gen_fanuc,
            ControllerType.SIEMENS:    self._gen_siemens,
            ControllerType.HEIDENHAIN: self._gen_heidenhain,
            ControllerType.ISO:        self._gen_iso,
            ControllerType.MAZAK:      self._gen_fanuc,   # Mazak ISO ≈ Fanuc
            ControllerType.OKUMA:      self._gen_iso,     # Okuma OSP ≈ ISO
        }
        fn = dispatch.get(controller, self._gen_iso)
        content, tools_used, cycle_time = fn(operations, tp_map, program_name)
        lines = content.split("\n")
        return GCodeProgram(
            controller=controller,
            program_name=program_name,
            program_number=self.program_number,
            content=content,
            line_count=len(lines),
            estimated_cycle_time_min=round(cycle_time, 2),
            tools_used=tools_used,
        )

    # ------------------------------------------------------------------
    # FANUC
    # ------------------------------------------------------------------

    def _gen_fanuc(
        self,
        operations: List[MachiningOperation],
        tp_map: Dict[str, OperationToolpath],
        program_name: str,
    ) -> Tuple[str, List[str], float]:
        """Generate Fanuc 0i/16i/30i compatible G-Code."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        _mat = self.material.value if hasattr(self.material, "value") else str(self.material)
        mat_str = _mat.upper().replace("_", " ")
        lines: List[str] = []
        tools_used: List[str] = []
        total_time = 0.0

        # ---- Header ----
        lines += [
            "%",
            f"O{self.program_number} ({program_name.upper()})",
            f"(MATHV2 CAM - GENERATED {now})",
            f"(MATERIAL: {mat_str})",
            f"(PART: {self.bbox.x:.1f} X {self.bbox.y:.1f} X {self.bbox.z:.1f} MM)",
            f"(WORK OFFSET: {self.work_offset})",
            "(",
            "(TOOL LIST:)",
        ]
        for op in operations:
            lines.append(
                f"( T{op.tool.tool_number:02d} - {op.tool.name} D{op.tool.diameter:.1f} )"
            )
        lines += ["", "N10 G21 G17 G40 G49 G80 G90   (METRIC, XY PLANE, RESET)"]

        n = 20
        last_tool = -1

        for op in operations:
            tp = tp_map.get(op.id)
            total_time += op.estimated_time_min
            t = op.tool
            p = op.parameters

            if t.tool_number not in [x for x in [last_tool]]:
                # Tool change block
                lines += [
                    "",
                    f"(------- {op.description.upper()} -------)",
                    f"N{n} G91 G28 Z0.   (RETRACT Z)",
                    f"N{n+10} T{t.tool_number:02d} M06   ({t.name})",
                    f"N{n+20} {self.work_offset} G00 "
                    f"X{_coord(self.bbox.x/2)} Y{_coord(self.bbox.y/2)} "
                    f"S{_rpm(p.spindle_rpm)} M03",
                    f"N{n+30} G43 H{t.tool_number:02d} Z{_coord(5.0)} M08   (TOOL LENGTH COMP + COOLANT ON)",
                ]
                n += 40
                last_tool = t.tool_number
                tools_used.append(f"T{t.tool_number:02d} {t.name}")

            # Operation-specific cycles
            op_lines = self._fanuc_operation(op, tp, n)
            lines.extend(op_lines)
            n += len(op_lines) * 10 + 10

        # ---- Footer ----
        lines += [
            "",
            f"N{n} G91 G28 Z0.   (RETRACT Z)",
            f"N{n+10} G91 G28 X0. Y0.   (RETURN TO HOME)",
            f"N{n+20} M09   (COOLANT OFF)",
            f"N{n+30} M05   (SPINDLE STOP)",
            f"N{n+40} M30   (END OF PROGRAM)",
            "%",
        ]

        return "\n".join(lines), tools_used, total_time

    def _fanuc_operation(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
        n_start: int,
    ) -> List[str]:
        """Generate Fanuc G-Code lines for a single operation."""
        lines: List[str] = []
        p = op.parameters
        n = n_start

        if op.operation_type == OperationType.FACE_MILLING:
            lines += self._fanuc_milling_segments(tp, p, n)

        elif op.operation_type in (OperationType.CONTOUR_MILLING, OperationType.CHAMFERING):
            lines += self._fanuc_milling_segments(tp, p, n)

        elif op.operation_type == OperationType.POCKETING:
            lines += self._fanuc_milling_segments(tp, p, n)

        elif op.operation_type == OperationType.CENTER_DRILLING:
            lines += self._fanuc_drilling_cycle(op, tp, n, cycle="G81", z_depth=-p.depth_of_cut_mm)

        elif op.operation_type == OperationType.DRILLING:
            # Decide G81 vs G83 based on depth vs diameter
            depth = p.depth_of_cut_mm
            diam = op.tool.diameter
            if depth > diam * 3:
                lines += self._fanuc_drilling_cycle(op, tp, n, cycle="G83", z_depth=-depth, peck=p.depth_of_cut_mm)
            else:
                lines += self._fanuc_drilling_cycle(op, tp, n, cycle="G81", z_depth=-depth)

        elif op.operation_type == OperationType.REAMING:
            depth = op.tool.flute_length or (op.parameters.depth_of_cut_mm * 10)
            lines += self._fanuc_drilling_cycle(op, tp, n, cycle="G85", z_depth=-p.depth_of_cut_mm * 10)

        elif op.operation_type == OperationType.TAPPING:
            lines += self._fanuc_tapping_cycle(op, tp, n)

        return lines

    def _fanuc_milling_segments(
        self,
        tp: Optional[OperationToolpath],
        params: CuttingParameters,
        n_start: int,
    ) -> List[str]:
        """Convert PathSegment list to numbered Fanuc G-Code lines."""
        lines: List[str] = []
        n = n_start
        if tp is None:
            return lines

        for seg in tp.segments:
            if seg.move_type in ("rapid", "retract"):
                line = (
                    f"N{n} G00 "
                    f"X{_coord(seg.to_pos[0])} "
                    f"Y{_coord(seg.to_pos[1])} "
                    f"Z{_coord(seg.to_pos[2])}"
                )
            elif seg.move_type == "plunge":
                feed = seg.feed_rate or params.plunge_rate_mmpm
                line = (
                    f"N{n} G01 "
                    f"Z{_coord(seg.to_pos[2])} "
                    f"F{_feed(feed)}"
                )
            elif seg.move_type == "cut":
                feed = seg.feed_rate or params.feed_rate_mmpm
                line = (
                    f"N{n} G01 "
                    f"X{_coord(seg.to_pos[0])} "
                    f"Y{_coord(seg.to_pos[1])} "
                    f"F{_feed(feed)}"
                )
                if abs(seg.to_pos[2] - seg.from_pos[2]) > 0.001:
                    line = (
                        f"N{n} G01 "
                        f"X{_coord(seg.to_pos[0])} "
                        f"Y{_coord(seg.to_pos[1])} "
                        f"Z{_coord(seg.to_pos[2])} "
                        f"F{_feed(feed)}"
                    )
            elif seg.move_type == "arc_ccw":
                feed = seg.feed_rate or params.feed_rate_mmpm
                cx = (seg.arc_center or [0, 0, 0])[0]
                cy = (seg.arc_center or [0, 0, 0])[1]
                line = (
                    f"N{n} G03 "
                    f"X{_coord(seg.to_pos[0])} "
                    f"Y{_coord(seg.to_pos[1])} "
                    f"I{_coord(cx - seg.from_pos[0])} "
                    f"J{_coord(cy - seg.from_pos[1])} "
                    f"F{_feed(feed)}"
                )
            elif seg.move_type == "arc_cw":
                feed = seg.feed_rate or params.feed_rate_mmpm
                cx = (seg.arc_center or [0, 0, 0])[0]
                cy = (seg.arc_center or [0, 0, 0])[1]
                line = (
                    f"N{n} G02 "
                    f"X{_coord(seg.to_pos[0])} "
                    f"Y{_coord(seg.to_pos[1])} "
                    f"I{_coord(cx - seg.from_pos[0])} "
                    f"J{_coord(cy - seg.from_pos[1])} "
                    f"F{_feed(feed)}"
                )
            else:
                continue

            lines.append(line)
            n += 10

        return lines

    def _fanuc_drilling_cycle(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
        n_start: int,
        cycle: str = "G81",
        z_depth: float = -20.0,
        peck: Optional[float] = None,
    ) -> List[str]:
        """
        Generate Fanuc fixed drilling cycle (G81/G83/G85/G84) for all holes.
        Returns lines with all hole positions called out.
        """
        lines: List[str] = []
        n = n_start
        p = op.parameters

        # Collect hole positions from target features
        hole_positions: List[Tuple[float, float]] = []
        for fid in op.target_features:
            f = self._feature_map.get(fid)
            if f:
                hole_positions.append((f.position[0], f.position[1]))

        if not hole_positions:
            # Fallback: use first few positions from toolpath rapids
            if tp:
                for seg in tp.segments:
                    if seg.move_type == "rapid":
                        pos = (round(seg.to_pos[0], 3), round(seg.to_pos[1], 3))
                        if pos not in hole_positions and seg.to_pos[2] >= 0:
                            hole_positions.append(pos)
            if not hole_positions:
                hole_positions = [(self.bbox.x / 2, self.bbox.y / 2)]

        r_plane = 2.0   # R-plane: 2mm above workpiece

        if cycle == "G83" and peck:
            # G83 peck drilling
            lines.append(
                f"N{n} {cycle} "
                f"X{_coord(hole_positions[0][0])} "
                f"Y{_coord(hole_positions[0][1])} "
                f"Z{_coord(z_depth)} "
                f"R{_coord(r_plane)} "
                f"Q{_coord(abs(peck))} "
                f"F{_feed(p.feed_rate_mmpm)}"
            )
        elif cycle == "G84":
            # Tapping cycle – feed = pitch × rpm
            lines.append(
                f"N{n} {cycle} "
                f"X{_coord(hole_positions[0][0])} "
                f"Y{_coord(hole_positions[0][1])} "
                f"Z{_coord(z_depth)} "
                f"R{_coord(r_plane)} "
                f"F{_feed(p.feed_rate_mmpm)}"
            )
        else:
            lines.append(
                f"N{n} {cycle} "
                f"X{_coord(hole_positions[0][0])} "
                f"Y{_coord(hole_positions[0][1])} "
                f"Z{_coord(z_depth)} "
                f"R{_coord(r_plane)} "
                f"F{_feed(p.feed_rate_mmpm)}"
            )
        n += 10

        # Additional hole positions
        for x, y in hole_positions[1:]:
            lines.append(f"N{n} X{_coord(x)} Y{_coord(y)}")
            n += 10

        # Cancel cycle
        lines.append(f"N{n} G80   (CANCEL CYCLE)")
        lines.append(f"N{n+10} G00 Z{_coord(5.0)}")

        return lines

    def _fanuc_tapping_cycle(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
        n_start: int,
    ) -> List[str]:
        """Generate G84 rigid tapping cycle."""
        import re as _re
        p = op.parameters
        thread_str = ""
        for fid in op.target_features:
            f = self._feature_map.get(fid)
            if f and f.thread:
                thread_str = f.thread
                break

        # Extract pitch from thread description
        pitch = 1.5
        m = _re.search(r"[Xx](\d+(?:\.\d+)?)", thread_str)
        if m:
            pitch = float(m.group(1))

        depth = -abs(p.depth_of_cut_mm)
        return self._fanuc_drilling_cycle(op, tp, n_start, cycle="G84", z_depth=depth)

    # ------------------------------------------------------------------
    # SIEMENS 840D
    # ------------------------------------------------------------------

    def _gen_siemens(
        self,
        operations: List[MachiningOperation],
        tp_map: Dict[str, OperationToolpath],
        program_name: str,
    ) -> Tuple[str, List[str], float]:
        """Generate Siemens SINUMERIK 840D sl G-Code."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        _mat = self.material.value if hasattr(self.material, "value") else str(self.material)
        mat_str = _mat.upper().replace("_", " ")
        lines: List[str] = []
        tools_used: List[str] = []
        total_time = 0.0

        # Header
        lines += [
            f"; {program_name.upper()} - MATHV2 CAM",
            f"; DATE: {now}",
            f"; MATERIAL: {mat_str}",
            f"; PART: {self.bbox.x:.1f} X {self.bbox.y:.1f} X {self.bbox.z:.1f} MM",
            "",
            "G0 G17 G40 G71 G90   ; METRIC, XY, ABS",
            f"{self.work_offset}            ; WORK OFFSET",
        ]

        for op in operations:
            tp = tp_map.get(op.id)
            total_time += op.estimated_time_min
            t = op.tool
            p = op.parameters

            lines += [
                "",
                f"; ====== {op.description.upper()} ======",
                f"T{t.tool_number} D1",
                "M6",
                f"S{_rpm(p.spindle_rpm)} M3",
                "M8   ; COOLANT ON",
            ]
            tools_used.append(f"T{t.tool_number} {t.name}")

            if op.operation_type in (
                OperationType.FACE_MILLING,
                OperationType.CONTOUR_MILLING,
                OperationType.POCKETING,
                OperationType.CHAMFERING,
            ):
                lines += self._siemens_milling_segments(tp, p)

            elif op.operation_type == OperationType.CENTER_DRILLING:
                lines += self._siemens_drilling(op, tp, p, cycle="CYCLE81",
                                                  z_depth=-p.depth_of_cut_mm)

            elif op.operation_type == OperationType.DRILLING:
                depth = p.depth_of_cut_mm
                if depth > op.tool.diameter * 3:
                    lines += self._siemens_drilling(op, tp, p, cycle="CYCLE83",
                                                      z_depth=-depth, peck=p.depth_of_cut_mm)
                else:
                    lines += self._siemens_drilling(op, tp, p, cycle="CYCLE81",
                                                      z_depth=-depth)

            elif op.operation_type == OperationType.TAPPING:
                lines += self._siemens_tapping(op, tp, p)

            elif op.operation_type == OperationType.REAMING:
                lines += self._siemens_drilling(op, tp, p, cycle="CYCLE85",
                                                  z_depth=-p.depth_of_cut_mm * 10)

            lines += ["M9   ; COOLANT OFF"]

        lines += [
            "",
            "; PROGRAM END",
            "G0 G91 Z100.   ; RETRACT Z",
            "G90",
            "M5   ; SPINDLE STOP",
            "M30",
        ]

        return "\n".join(lines), tools_used, total_time

    def _siemens_milling_segments(
        self, tp: Optional[OperationToolpath], params: CuttingParameters
    ) -> List[str]:
        lines: List[str] = []
        if tp is None:
            return lines
        for seg in tp.segments:
            if seg.move_type in ("rapid", "retract"):
                lines.append(
                    f"G0 X{_coord(seg.to_pos[0])} Y{_coord(seg.to_pos[1])} Z{_coord(seg.to_pos[2])}"
                )
            elif seg.move_type == "plunge":
                feed = seg.feed_rate or params.plunge_rate_mmpm
                lines.append(f"G1 Z{_coord(seg.to_pos[2])} F{_feed(feed)}")
            elif seg.move_type == "cut":
                feed = seg.feed_rate or params.feed_rate_mmpm
                line = f"G1 X{_coord(seg.to_pos[0])} Y{_coord(seg.to_pos[1])} F{_feed(feed)}"
                if abs(seg.to_pos[2] - seg.from_pos[2]) > 0.001:
                    line = (
                        f"G1 X{_coord(seg.to_pos[0])} Y{_coord(seg.to_pos[1])} "
                        f"Z{_coord(seg.to_pos[2])} F{_feed(feed)}"
                    )
                lines.append(line)
        return lines

    def _siemens_drilling(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
        params: CuttingParameters,
        cycle: str,
        z_depth: float,
        peck: Optional[float] = None,
    ) -> List[str]:
        lines: List[str] = []
        hole_positions = self._get_hole_positions(op, tp)
        if not hole_positions:
            hole_positions = [(self.bbox.x / 2, self.bbox.y / 2)]

        for x, y in hole_positions:
            lines.append(f"G0 X{_coord(x)} Y{_coord(y)}")
            if cycle == "CYCLE83" and peck:
                lines.append(
                    f"CYCLE83(5., 0., 2., {_coord(z_depth)}, , "
                    f"{_coord(abs(peck))}, , 0.1, 0, , , 1)"
                )
            elif cycle == "CYCLE84":
                lines.append(
                    f"CYCLE84(5., 0., 2., {_coord(z_depth)}, , "
                    f"{params.spindle_rpm}, {_feed(params.feed_rate_mmpm)}, "
                    f"{params.spindle_rpm}, , , 1, 1)"
                )
            elif cycle == "CYCLE85":
                lines.append(
                    f"CYCLE85(5., 0., 2., {_coord(z_depth)}, , "
                    f"{_feed(params.feed_rate_mmpm)}, {_feed(params.feed_rate_mmpm * 0.8)})"
                )
            else:  # CYCLE81
                lines.append(
                    f"CYCLE81(5., 0., 2., {_coord(z_depth)}, )"
                )

        return lines

    def _siemens_tapping(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
        params: CuttingParameters,
    ) -> List[str]:
        lines: List[str] = []
        hole_positions = self._get_hole_positions(op, tp)
        if not hole_positions:
            hole_positions = [(self.bbox.x / 2, self.bbox.y / 2)]

        z_depth = -abs(params.depth_of_cut_mm)
        for x, y in hole_positions:
            lines.append(f"G0 X{_coord(x)} Y{_coord(y)}")
            lines.append(
                f"CYCLE84(5., 0., 2., {_coord(z_depth)}, , "
                f"{params.spindle_rpm}, {_feed(params.feed_rate_mmpm)}, "
                f"{params.spindle_rpm}, , , 1, 1)"
            )
        return lines

    # ------------------------------------------------------------------
    # HEIDENHAIN iTNC
    # ------------------------------------------------------------------

    def _gen_heidenhain(
        self,
        operations: List[MachiningOperation],
        tp_map: Dict[str, OperationToolpath],
        program_name: str,
    ) -> Tuple[str, List[str], float]:
        """Generate Heidenhain iTNC 530 / TNC 640 conversational G-Code."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        _mat = self.material.value if hasattr(self.material, "value") else str(self.material)
        mat_str = _mat.upper().replace("_", " ")
        lines: List[str] = []
        tools_used: List[str] = []
        total_time = 0.0

        safe_name = program_name.upper().replace("-", "_").replace(" ", "_")[:16]

        lines += [
            f"BEGIN PGM {safe_name} MM",
            f"; MATHV2 CAM - GENERATED {now}",
            f"; MATERIAL: {mat_str}",
            "",
            "; WORKPIECE BLANK DEFINITION",
            f"BLK FORM 0.1 Z X+0 Y+0 Z-{_coord(self.bbox.z)}",
            f"BLK FORM 0.2 X+{_coord(self.bbox.x)} Y+{_coord(self.bbox.y)} Z+0",
            "",
            "; TOOL DEFINITIONS",
        ]

        # Tool table section
        for op in operations:
            t = op.tool
            lines.append(
                f"TOOL DEF {t.tool_number} L+0 R+{_coord(t.diameter/2)}"
                f"   ; {t.name}"
            )

        lines.append("")

        block = 10
        last_tool = -1

        for op in operations:
            tp = tp_map.get(op.id)
            total_time += op.estimated_time_min
            t = op.tool
            p = op.parameters

            lines += [
                "",
                f"; ====== {op.description.upper()} ======",
            ]

            if t.tool_number != last_tool:
                lines += [
                    f"{block} TOOL CALL {t.tool_number} Z S{_rpm(p.spindle_rpm)}",
                    f"{block+1} M3   ; SPINDLE CW",
                    f"{block+2} M8   ; COOLANT ON",
                ]
                block += 3
                last_tool = t.tool_number
                tools_used.append(f"T{t.tool_number} {t.name}")

            if op.operation_type in (
                OperationType.FACE_MILLING,
                OperationType.CONTOUR_MILLING,
                OperationType.POCKETING,
                OperationType.CHAMFERING,
            ):
                block, new_lines = self._hh_milling_segments(tp, p, block)
                lines.extend(new_lines)

            elif op.operation_type in (
                OperationType.CENTER_DRILLING, OperationType.DRILLING,
                OperationType.REAMING, OperationType.TAPPING,
            ):
                block, new_lines = self._hh_drilling(op, tp, p, block)
                lines.extend(new_lines)

        # Footer
        lines += [
            "",
            f"{block} M9   ; COOLANT OFF",
            f"{block+1} M5   ; SPINDLE STOP",
            f"{block+2} L Z+100 R0 FMAX   ; RETRACT Z",
            f"{block+3} L X+0 Y+0 R0 FMAX   ; RETURN TO HOME",
            f"{block+4} M30   ; END OF PROGRAM",
            f"END PGM {safe_name} MM",
        ]

        return "\n".join(lines), tools_used, total_time

    def _hh_milling_segments(
        self,
        tp: Optional[OperationToolpath],
        params: CuttingParameters,
        block: int,
    ) -> Tuple[int, List[str]]:
        lines: List[str] = []
        if tp is None:
            return block, lines

        for seg in tp.segments:
            if seg.move_type in ("rapid", "retract"):
                lines.append(
                    f"{block} L X+{_coord(seg.to_pos[0])} "
                    f"Y+{_coord(seg.to_pos[1])} "
                    f"Z+{_coord(seg.to_pos[2])} R0 FMAX"
                )
            elif seg.move_type == "plunge":
                feed = seg.feed_rate or params.plunge_rate_mmpm
                lines.append(
                    f"{block} L Z+{_coord(seg.to_pos[2])} R0 F{_feed(feed)}"
                )
            elif seg.move_type == "cut":
                feed = seg.feed_rate or params.feed_rate_mmpm
                line = (
                    f"{block} L X+{_coord(seg.to_pos[0])} "
                    f"Y+{_coord(seg.to_pos[1])} R0 F{_feed(feed)}"
                )
                if abs(seg.to_pos[2] - seg.from_pos[2]) > 0.001:
                    line = (
                        f"{block} L X+{_coord(seg.to_pos[0])} "
                        f"Y+{_coord(seg.to_pos[1])} "
                        f"Z+{_coord(seg.to_pos[2])} R0 F{_feed(feed)}"
                    )
                lines.append(line)
            elif seg.move_type in ("arc_cw", "arc_ccw"):
                feed = seg.feed_rate or params.feed_rate_mmpm
                dir_code = "DR-" if seg.move_type == "arc_cw" else "DR+"
                cx = (seg.arc_center or [0, 0, 0])[0]
                cy = (seg.arc_center or [0, 0, 0])[1]
                lines.append(
                    f"{block} CC X+{_coord(cx)} Y+{_coord(cy)}"
                )
                block += 1
                r = seg.arc_radius or 10.0
                lines.append(
                    f"{block} C X+{_coord(seg.to_pos[0])} "
                    f"Y+{_coord(seg.to_pos[1])} "
                    f"{dir_code} R+{_coord(r)} F{_feed(feed)}"
                )
            block += 1

        return block, lines

    def _hh_drilling(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
        params: CuttingParameters,
        block: int,
    ) -> Tuple[int, List[str]]:
        lines: List[str] = []
        hole_positions = self._get_hole_positions(op, tp)
        if not hole_positions:
            hole_positions = [(self.bbox.x / 2, self.bbox.y / 2)]

        depth = abs(params.depth_of_cut_mm * 10) if op.operation_type in (
            OperationType.REAMING, OperationType.TAPPING
        ) else abs(params.depth_of_cut_mm)

        for x, y in hole_positions:
            lines.append(f"{block} L X+{_coord(x)} Y+{_coord(y)} R0 FMAX")
            block += 1

            if op.operation_type in (OperationType.DRILLING,) and depth > op.tool.diameter * 3:
                # Peck drilling
                lines.append(
                    f"{block} CYCL DEF 205 UNIVERSAL PECKING~"
                    f"  Q200=+2   ;SAFETY CLEARANCE~"
                    f"  Q201=-{_coord(depth)}  ;DEPTH~"
                    f"  Q206={_feed(params.feed_rate_mmpm)}  ;FEED RATE PLUNGING~"
                    f"  Q202={_coord(op.tool.diameter*2)}  ;INFEED DEPTH~"
                    f"  Q210=+0   ;DWELL TIME AT TOP~"
                    f"  Q203=+0   ;SURFACE COORDINATE~"
                    f"  Q204=+2   ;2ND SET-UP CLEARANCE~"
                    f"  Q212=+0   ;DECREMENT"
                )
            elif op.operation_type == OperationType.TAPPING:
                lines.append(
                    f"{block} CYCL DEF 207 RIGID TAPPING NEW~"
                    f"  Q200=+2   ;SAFETY CLEARANCE~"
                    f"  Q201=-{_coord(depth)}  ;DEPTH~"
                    f"  Q239={_coord(op.tool.thread_pitch or 1.5)}  ;THREAD PITCH~"
                    f"  Q203=+0   ;SURFACE COORDINATE~"
                    f"  Q204=+2   ;2ND SET-UP CLEARANCE"
                )
            else:
                lines.append(
                    f"{block} CYCL DEF 200 DRILLING~"
                    f"  Q200=+2   ;SAFETY CLEARANCE~"
                    f"  Q201=-{_coord(depth)}  ;DEPTH~"
                    f"  Q206={_feed(params.feed_rate_mmpm)}  ;FEED RATE PLUNGING~"
                    f"  Q202={_coord(depth)}  ;INFEED DEPTH~"
                    f"  Q210=+0   ;DWELL TIME AT TOP~"
                    f"  Q203=+0   ;SURFACE COORDINATE~"
                    f"  Q204=+2   ;2ND SET-UP CLEARANCE"
                )
            block += 1
            lines.append(f"{block} CYCL CALL")
            block += 1

        return block, lines

    # ------------------------------------------------------------------
    # ISO Standard (generic)
    # ------------------------------------------------------------------

    def _gen_iso(
        self,
        operations: List[MachiningOperation],
        tp_map: Dict[str, OperationToolpath],
        program_name: str,
    ) -> Tuple[str, List[str], float]:
        """Generate ISO 6983 compatible G-Code (generic / portable)."""
        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        _mat = self.material.value if hasattr(self.material, "value") else str(self.material)
        mat_str = _mat.upper().replace("_", " ")
        lines: List[str] = []
        tools_used: List[str] = []
        total_time = 0.0

        safe_num = "".join(c for c in program_name if c.isalnum() or c == "_")[:8].upper()

        lines += [
            f"% MATHV2-ISO-{safe_num}",
            f"( GENERATED {now} )",
            f"( MATERIAL: {mat_str} )",
            f"( PART: {self.bbox.x:.1f}x{self.bbox.y:.1f}x{self.bbox.z:.1f}mm )",
            "G21 G17 G40 G49 G80 G90",
            f"{self.work_offset}",
        ]

        n = 10
        for op in operations:
            tp = tp_map.get(op.id)
            total_time += op.estimated_time_min
            t = op.tool
            p = op.parameters

            lines += [
                "",
                f"( {op.description.upper()} )",
                f"N{n} G28 G91 Z0.",
                f"N{n+10} T{t.tool_number:02d} M06",
                f"N{n+20} G90 {self.work_offset}",
                f"N{n+30} S{_rpm(p.spindle_rpm)} M03",
                f"N{n+40} G43 H{t.tool_number:02d} Z5. M08",
            ]
            n += 50
            tools_used.append(f"T{t.tool_number:02d} {t.name}")

            if op.operation_type in (
                OperationType.FACE_MILLING, OperationType.CONTOUR_MILLING,
                OperationType.POCKETING, OperationType.CHAMFERING,
            ):
                seg_lines = self._fanuc_milling_segments(tp, p, n)
                lines.extend(seg_lines)
                n += len(seg_lines) * 10

            elif op.operation_type in (
                OperationType.CENTER_DRILLING, OperationType.DRILLING,
                OperationType.REAMING,
            ):
                depth = p.depth_of_cut_mm
                cycle = "G81"
                drill_lines = self._fanuc_drilling_cycle(op, tp, n, cycle=cycle,
                                                          z_depth=-depth)
                lines.extend(drill_lines)
                n += len(drill_lines) * 10

            elif op.operation_type == OperationType.TAPPING:
                drill_lines = self._fanuc_drilling_cycle(op, tp, n, cycle="G84",
                                                          z_depth=-p.depth_of_cut_mm)
                lines.extend(drill_lines)
                n += len(drill_lines) * 10

            lines += [
                f"N{n} M09",
                f"N{n+10} M05",
            ]
            n += 20

        lines += [
            "",
            f"N{n} G28 G91 Z0.",
            f"N{n+10} G28 X0. Y0.",
            f"N{n+20} M30",
            "%",
        ]

        return "\n".join(lines), tools_used, total_time

    # ------------------------------------------------------------------
    # Shared utility
    # ------------------------------------------------------------------

    def _get_hole_positions(
        self,
        op: MachiningOperation,
        tp: Optional[OperationToolpath],
    ) -> List[Tuple[float, float]]:
        """Collect (x, y) positions for all holes targeted by an operation."""
        positions: List[Tuple[float, float]] = []
        for fid in op.target_features:
            f = self._feature_map.get(fid)
            if f and hasattr(f, "position"):
                positions.append((f.position[0], f.position[1]))
        if not positions and tp:
            for seg in tp.segments:
                if seg.move_type == "rapid" and seg.to_pos[2] >= 0:
                    pos = (round(seg.to_pos[0], 3), round(seg.to_pos[1], 3))
                    if pos not in positions:
                        positions.append(pos)
        return positions
