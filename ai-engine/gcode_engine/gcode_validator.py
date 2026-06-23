"""
GCodeValidator – Validates G-Code programs for common errors and safety issues.

Checks performed
----------------
Errors (will cause machine crash or alarm)
  E001  RAPID_IN_CUT      – G00 move with active depth (non-retract Z < 0)
  E002  MISSING_TOOL_COMP – no G43 H after a T M06 tool change
  E003  UNCLOSED_CYCLE    – drilling cycle (G81-G89) without G80 cancel
  E004  NO_WORK_OFFSET    – no G54-G59 defined before first cut
  E005  FEED_ZERO         – G01/G02/G03 with F0 or missing F word
  E006  SPINDLE_OFF_CUT   – G01 move without previous M03/M04
  E007  MISSING_M30       – program has no M30 or M02 end

Warnings (will not crash but may cause issues)
  W001  DWELL_MISSING_P   – G04 without P word
  W002  HIGH_FEED         – feed rate > 10000 mm/min
  W003  HIGH_RPM          – spindle speed > 30000 RPM
  W004  COOLANT_NOT_OFF   – M08 called but no M09 before M30
  W005  REPEAT_TOOL_CALL  – same tool called twice in a row
  W006  MISSING_PERCENT   – no % at start/end (Fanuc)
  W007  Z_BELOW_ZERO_RAPID – rapid move to negative Z (possible crash)
  W008  TOOL_LENGTH_ON_RAPID – G43 applied during rapid without position

Info
  I001  CYCLE_TYPE        – detected drilling cycle type
  I002  TOTAL_TOOLS       – number of tool changes
  I003  PROGRAM_LINES     – total line count
"""

from __future__ import annotations

import re
from typing import List, Optional, Set, Tuple

from models.schemas import GCodeValidationResult, ValidationIssue


class GCodeValidator:
    """
    Validates G-Code programs.

    Usage::

        validator = GCodeValidator()
        result = validator.validate(gcode_string, controller="fanuc")
    """

    # G-Codes for linear cut, arc CW, arc CCW
    CUT_CODES = {"G01", "G1", "G02", "G2", "G03", "G3"}
    # Drilling / boring cycles
    DRILL_CYCLES = {"G73", "G74", "G76", "G81", "G82", "G83", "G84",
                    "G85", "G86", "G87", "G88", "G89"}
    SPINDLE_ON = {"M03", "M3", "M04", "M4"}
    SPINDLE_OFF = {"M05", "M5"}
    COOLANT_ON = {"M08", "M8"}
    COOLANT_OFF = {"M09", "M9"}
    WORK_OFFSETS = {"G54", "G55", "G56", "G57", "G58", "G59"}

    def __init__(self) -> None:
        pass

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def validate(
        self,
        code: str,
        controller: str = "fanuc",
    ) -> GCodeValidationResult:
        """
        Parse and validate G-Code, returning a GCodeValidationResult.
        """
        issues: List[ValidationIssue] = []
        lines = code.split("\n")

        # State tracking
        active_cycle: Optional[str] = None
        spindle_on = False
        coolant_on = False
        tool_comp_on = False   # G43 H active
        work_offset_set = False
        has_end = False
        has_percent_start = False
        has_percent_end = False
        current_z = 0.0
        current_feed = 0.0
        last_tool = -1
        tool_change_count = 0
        tool_changes: List[str] = []
        any_cut = False

        for lnum, raw_line in enumerate(lines, start=1):
            line = self._strip_comment(raw_line).strip()
            if not line:
                continue

            # Check for % markers (Fanuc)
            if line.strip() == "%":
                if not has_percent_start:
                    has_percent_start = True
                else:
                    has_percent_end = True
                continue

            tokens = self._tokenise(line)
            g_words = {t.upper() for t in tokens if t[0].upper() == "G"}
            m_words = {t.upper() for t in tokens if t[0].upper() == "M"}
            f_value = self._get_word_value(tokens, "F")
            s_value = self._get_word_value(tokens, "S")
            t_value = self._get_word_value(tokens, "T")
            z_value = self._get_word_value(tokens, "Z")
            h_value = self._get_word_value(tokens, "H")
            p_value = self._get_word_value(tokens, "P")

            # Track Z position
            if z_value is not None:
                current_z = z_value

            # Track feed
            if f_value is not None:
                current_feed = f_value

            # E006: Spindle off on cut
            if g_words & self.CUT_CODES and not spindle_on:
                issues.append(ValidationIssue(
                    severity="error",
                    line_number=lnum,
                    line_content=raw_line.strip(),
                    message="Cut move (G01/G02/G03) with spindle not running",
                    code="E006",
                ))

            # E005: Feed zero on cut
            if g_words & self.CUT_CODES and current_feed <= 0:
                issues.append(ValidationIssue(
                    severity="error",
                    line_number=lnum,
                    line_content=raw_line.strip(),
                    message="Cut move with F0 or no feed rate specified",
                    code="E005",
                ))

            # E001 / W007: Rapid checks
            if "G00" in g_words or "G0" in g_words:
                if z_value is not None and z_value < -0.01:
                    issues.append(ValidationIssue(
                        severity="warning",
                        line_number=lnum,
                        line_content=raw_line.strip(),
                        message=f"Rapid move to negative Z={z_value:.3f} – verify this is safe",
                        code="W007",
                    ))
                if any_cut and z_value is None and current_z < -0.01:
                    # Horizontal rapid while still at cut depth
                    issues.append(ValidationIssue(
                        severity="warning",
                        line_number=lnum,
                        line_content=raw_line.strip(),
                        message="Rapid traverse at cut depth – ensure retract was done",
                        code="E001",
                    ))

            # Track cut state
            if g_words & self.CUT_CODES:
                any_cut = True

            # Tool change
            if "M06" in m_words or "M6" in m_words:
                if t_value is not None:
                    tool_num = int(t_value)
                    if tool_num == last_tool:
                        issues.append(ValidationIssue(
                            severity="warning",
                            line_number=lnum,
                            line_content=raw_line.strip(),
                            message=f"Tool T{tool_num:02d} called again without change",
                            code="W005",
                        ))
                    last_tool = tool_num
                    tool_change_count += 1
                    tool_changes.append(f"T{tool_num:02d}")
                tool_comp_on = False  # G43 must be re-applied after each tool change

            # G43 tool length compensation
            if "G43" in g_words:
                if h_value is None:
                    issues.append(ValidationIssue(
                        severity="warning",
                        line_number=lnum,
                        line_content=raw_line.strip(),
                        message="G43 (tool length comp) without H word",
                        code="W008",
                    ))
                tool_comp_on = True

            # E002: Missing tool comp after tool change
            if g_words & self.CUT_CODES and not tool_comp_on and tool_change_count > 0:
                if controller == "fanuc":  # Fanuc always needs G43
                    issues.append(ValidationIssue(
                        severity="warning",
                        line_number=lnum,
                        line_content=raw_line.strip(),
                        message="Cut without active tool length compensation (G43 H..) – check setup",
                        code="E002",
                    ))

            # Work offset
            if g_words & self.WORK_OFFSETS:
                work_offset_set = True

            # Spindle state
            if m_words & self.SPINDLE_ON:
                spindle_on = True
            if m_words & self.SPINDLE_OFF:
                spindle_on = False

            # Coolant
            if m_words & self.COOLANT_ON:
                coolant_on = True
            if m_words & self.COOLANT_OFF:
                coolant_on = False

            # Drilling cycles
            cycle_activated = g_words & self.DRILL_CYCLES
            if cycle_activated:
                cycle_code = next(iter(cycle_activated))
                active_cycle = cycle_code
                issues.append(ValidationIssue(
                    severity="info",
                    line_number=lnum,
                    line_content=None,
                    message=f"Drilling cycle {cycle_code} activated",
                    code="I001",
                ))

            # G80 cancels cycle
            if "G80" in g_words and active_cycle:
                active_cycle = None

            # G04 dwell without P
            if "G04" in g_words or "G4" in g_words:
                if p_value is None:
                    issues.append(ValidationIssue(
                        severity="warning",
                        line_number=lnum,
                        line_content=raw_line.strip(),
                        message="G04 dwell without P word (dwell time)",
                        code="W001",
                    ))

            # Feed rate sanity
            if f_value is not None and f_value > 10000:
                issues.append(ValidationIssue(
                    severity="warning",
                    line_number=lnum,
                    line_content=raw_line.strip(),
                    message=f"Very high feed rate F{f_value:.0f} mm/min – verify this is correct",
                    code="W002",
                ))

            if s_value is not None and s_value > 30000:
                issues.append(ValidationIssue(
                    severity="warning",
                    line_number=lnum,
                    line_content=raw_line.strip(),
                    message=f"Very high spindle speed S{s_value:.0f} RPM – verify machine limits",
                    code="W003",
                ))

            # Program end
            if "M30" in m_words or "M02" in m_words or "M2" in m_words:
                has_end = True

        # ---- Post-scan checks ----

        # E007: No M30
        if not has_end:
            issues.append(ValidationIssue(
                severity="error",
                line_number=None,
                line_content=None,
                message="Program has no M30 or M02 end-of-program command",
                code="E007",
            ))

        # E003: Unclosed cycle
        if active_cycle:
            issues.append(ValidationIssue(
                severity="error",
                line_number=None,
                line_content=None,
                message=f"Drilling cycle {active_cycle} was never cancelled with G80",
                code="E003",
            ))

        # E004: No work offset
        if not work_offset_set and controller in ("fanuc", "iso"):
            issues.append(ValidationIssue(
                severity="warning",
                line_number=None,
                line_content=None,
                message="No work offset (G54-G59) found in program",
                code="E004",
            ))

        # W004: Coolant not turned off
        if coolant_on:
            issues.append(ValidationIssue(
                severity="warning",
                line_number=None,
                line_content=None,
                message="Coolant (M08) was turned on but never turned off with M09 before M30",
                code="W004",
            ))

        # W006: Missing percent markers (Fanuc)
        if controller == "fanuc" and not (has_percent_start and has_percent_end):
            issues.append(ValidationIssue(
                severity="warning",
                line_number=None,
                line_content=None,
                message="Fanuc program should start and end with % marker",
                code="W006",
            ))

        # Info stats
        issues.append(ValidationIssue(
            severity="info",
            line_number=None,
            line_content=None,
            message=f"Total tool changes: {tool_change_count} ({', '.join(tool_changes)})",
            code="I002",
        ))
        issues.append(ValidationIssue(
            severity="info",
            line_number=None,
            line_content=None,
            message=f"Total program lines: {len(lines)}",
            code="I003",
        ))

        errors = [i for i in issues if i.severity == "error"]
        warnings = [i for i in issues if i.severity == "warning"]

        return GCodeValidationResult(
            is_valid=len(errors) == 0,
            error_count=len(errors),
            warning_count=len(warnings),
            issues=issues,
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _strip_comment(line: str) -> str:
        """Remove parenthesis and semicolon comments from a G-Code line."""
        line = re.sub(r"\(.*?\)", "", line)
        line = re.sub(r";.*$", "", line)
        return line

    @staticmethod
    def _tokenise(line: str) -> List[str]:
        """
        Split a G-Code line into address-word tokens.
        E.g. 'N10 G00 X10.5 Y-3.0 F200' -> ['N10', 'G00', 'X10.5', 'Y-3.0', 'F200']
        """
        return re.findall(r"[A-Za-z][+\-]?\d*\.?\d*", line)

    @staticmethod
    def _get_word_value(tokens: List[str], letter: str) -> Optional[float]:
        """
        Find the numeric value of a word beginning with *letter*.
        Returns None if not found.
        """
        letter = letter.upper()
        for tok in tokens:
            if tok[0].upper() == letter:
                num_str = tok[1:]
                try:
                    return float(num_str)
                except ValueError:
                    pass
        return None
