#!/usr/bin/env python3
"""
Rules Reminder Hook - Modular & Flexibel

Erinnert Claude daran, die Regeln zu lesen und ernst zu nehmen.
Kennt keine Regeln, parsed nichts - nur eine Erinnerung mit Konsequenz.
"""

import json
import sys

output = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": """
⚠️ **STOPP. DREI FRAGEN.**

1. Folgst du allen Regeln?
2. Was weißt du bereits?
3. Was ist es wert zu behalten?

Wenn nicht → kein Vertrauen → nutzlos.
"""
    }
}

print(json.dumps(output))
sys.exit(0)
