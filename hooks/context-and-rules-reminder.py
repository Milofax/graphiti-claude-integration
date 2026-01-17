#!/usr/bin/env python3
"""
Context & Rules Reminder Hook

Kombiniert:
1. group_id-Erkennung (aus Git, CLAUDE.md, etc.)
2. Die 3 Fragen (Regeln, Wissen, Speichern)

Keine Patterns - läuft IMMER.
"""

import json
import sys
import re
from pathlib import Path


def find_git_root(start_path: str) -> str | None:
    """Findet Git Root von einem Pfad aus."""
    path = Path(start_path)
    while path != path.parent:
        if (path / ".git").exists():
            return str(path)
        path = path.parent
    return None


def detect_group_id(working_dir: str) -> tuple[str, str]:
    """
    Erkennt group_id aus verschiedenen Quellen.
    Returns (group_id, project_name).
    """
    if not working_dir:
        return "main", ""

    cwd_path = Path(working_dir)

    # 1. Check .graphiti-group Datei
    for check_path in [cwd_path] + list(cwd_path.parents):
        graphiti_file = check_path / ".graphiti-group"
        if graphiti_file.exists():
            try:
                content = graphiti_file.read_text().strip()
                if content:
                    if ":" in content:
                        group_id, name = content.split(":", 1)
                        return group_id.strip(), name.strip()
                    return content, check_path.name
            except:
                pass

    # 2. Check CLAUDE.md für graphiti_group_id
    for check_path in [cwd_path] + list(cwd_path.parents):
        claude_md = check_path / "CLAUDE.md"
        if claude_md.exists():
            try:
                content = claude_md.read_text()
                match = re.search(r'graphiti_group_id:\s*(\S+)', content)
                if match:
                    group_id = match.group(1).strip()
                    return group_id, check_path.name
            except:
                pass

    # 3. Check ~/.claude/graphiti-projects.json
    config_file = Path.home() / ".claude" / "graphiti-projects.json"
    if config_file.exists():
        try:
            config = json.loads(config_file.read_text())
            for base_path, project_config in config.get("projects", {}).items():
                if working_dir.startswith(base_path):
                    group_id = project_config.get("group_id", f"project-{Path(base_path).name.lower()}")
                    name = project_config.get("name", Path(base_path).name)
                    return group_id, name
        except:
            pass

    # 4. Fallback: Git Root + Projektname
    git_root = find_git_root(working_dir)
    if git_root:
        project_name = Path(git_root).name
        return f"project-{project_name.lower()}", project_name

    return "main", ""


# Main
try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

cwd = input_data.get("cwd", "")
group_id, project_name = detect_group_id(cwd)

# Build context message
if group_id != "main" and project_name:
    project_line = f"📁 {project_name} → {group_id}"
else:
    project_line = "📁 main (persönlich)"

context = f"""
⚠️ **STOPP. DREI FRAGEN.**

1. Folgst du allen Regeln?
2. Was weißt du bereits?
3. Was ist es wert zu behalten?

{project_line}

Wenn nicht → kein Vertrauen → nutzlos.
"""

output = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": context
    }
}

print(json.dumps(output))
sys.exit(0)
