"""
MathV2 G-Code Validator
Validates G-Code programs for common errors and warnings.
"""
import re
from typing import List, Dict, Any


class GCodeValidator:
    """Validates G-Code programs for syntax and logic issues."""

    def validate(self, gcode: str) -> Dict[str, Any]:
        lines = gcode.splitlines()
        errors = []
        warnings = []
        
        in_canned_cycle = False
        spindle_on = False
        coolant_on = False
        tool_length_comp = False
        current_z = None
        line_count = len(lines)
        operation_count = 0
        tool_changes = 0

        for i, raw_line in enumerate(lines, 1):
            line = raw_line.strip()
            if not line or line.startswith('%') or line.startswith(';') or line.startswith('BEGIN') or line.startswith('END'):
                continue

            upper = line.upper()

            # Count operations
            if re.search(r'\bM06\b|\bM6\b', upper):
                tool_changes += 1

            if re.search(r'\bM03\b|\bM3\b|\bM04\b|\bM4\b', upper):
                spindle_on = True
                operation_count += 1

            if re.search(r'\bM05\b|\bM5\b', upper):
                spindle_on = False

            if re.search(r'\bM08\b|\bM8\b', upper):
                coolant_on = True

            if re.search(r'\bM09\b|\bM9\b', upper):
                coolant_on = False

            # Tool length compensation
            if re.search(r'\bG43\b|\bG44\b', upper):
                tool_length_comp = True
            if re.search(r'\bG49\b', upper):
                tool_length_comp = False

            # Canned cycle tracking
            cycle_open = re.search(r'\bG8[01234567]\b|\bG73\b|\bG74\b|\bG76\b|\bG83\b|\bG84\b|\bG85\b|\bG86\b|\bG87\b|\bG88\b|\bG89\b', upper)
            if cycle_open:
                in_canned_cycle = True

            if re.search(r'\bG80\b', upper):
                in_canned_cycle = False

            # Z position tracking
            z_match = re.search(r'Z([+-]?\d+(?:\.\d+)?)', upper)
            if z_match:
                current_z = float(z_match.group(1))

            # Check rapid move (G0/G00) into material
            if re.search(r'\bG00?\b', upper) and current_z is not None:
                if current_z < 0 and spindle_on:
                    # Only warn if it's a significant depth
                    if current_z < -1.0:
                        warnings.append({
                            "line": i,
                            "severity": "warning",
                            "code": "W001",
                            "message": f"Déplacement rapide G0 à Z={current_z:.3f} avec broche en marche - risque de collision",
                        })

            # Missing M30/M02/M99 at end
            if i == line_count and not re.search(r'\bM30\b|\bM02?\b|\bM99\b', upper):
                if not raw_line.strip().startswith('%'):
                    warnings.append({
                        "line": i,
                        "severity": "warning",
                        "code": "W002",
                        "message": "Programme sans instruction de fin (M30/M02) détectée",
                    })

            # Feed rate check for cutting moves
            if re.search(r'\bG01\b|\bG1\b|\bG02\b|\bG2\b|\bG03\b|\bG3\b', upper):
                if not re.search(r'\bF\d+', upper) and 'F' not in upper:
                    warnings.append({
                        "line": i,
                        "severity": "info",
                        "code": "I001",
                        "message": "Mouvement d'interpolation sans avance (F) explicite sur cette ligne",
                    })

            # Conflicting G-codes on same line
            modal_groups = [
                [r'\bG0[01]\b', r'\bG0?[23]\b'],  # motion group
            ]
            for group in modal_groups:
                found = sum(1 for pat in group if re.search(pat, upper))
                if found > 1:
                    errors.append({
                        "line": i,
                        "severity": "error",
                        "code": "E001",
                        "message": f"G-codes modaux conflictuels sur la même ligne: {line}",
                    })

            # Missing tool length comp after tool change
            if re.search(r'\bM06\b|\bM6\b', upper):
                tool_length_comp = False  # Reset after tool change

        # End-of-program checks
        if in_canned_cycle:
            warnings.append({
                "line": line_count,
                "severity": "warning",
                "code": "W003",
                "message": "Cycle fixe ouvert sans G80 de fermeture en fin de programme",
            })

        if coolant_on:
            warnings.append({
                "line": line_count,
                "severity": "warning",
                "code": "W004",
                "message": "Arrosage toujours actif (M08) en fin de programme - M09 manquant",
            })

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "info": {
                "line_count": line_count,
                "operation_count": operation_count,
                "tool_changes": tool_changes,
                "error_count": len(errors),
                "warning_count": len(warnings),
            }
        }
