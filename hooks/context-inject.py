#!/usr/bin/env python3
"""
Graphiti Knowledge System - UserPromptSubmit Hook
Injiziert Kontext-Hinweis wenn Prompt Graphiti-relevante Fragen enthält.
Erkennt Projekt aus:
1. .graphiti-group Datei im Projekt-Root
2. CLAUDE.md mit graphiti_group_id
3. ~/.claude/graphiti-projects.json Mapping
4. Fallback: Projektname aus Git Root
"""

import json
import sys
import re
import os
from pathlib import Path

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

prompt = input_data.get("prompt", "").lower()
cwd = input_data.get("cwd", "")


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

    # 1. Check .graphiti-group Datei im aktuellen oder Parent-Verzeichnis
    for check_path in [cwd_path] + list(cwd_path.parents):
        graphiti_file = check_path / ".graphiti-group"
        if graphiti_file.exists():
            try:
                content = graphiti_file.read_text().strip()
                if content:
                    # Format: group_id oder group_id:project_name
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
                # Suche nach graphiti_group_id: xxx
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
            # Check alle konfigurierten Pfade
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


group_id, project_name = detect_group_id(cwd)

# Patterns für automatische Graphiti-Recherche
person_patterns = [
    r'\bwer ist\b', r'\bwer war\b', r'\bkennst du\b',
    r'\barbeite.* mit\b', r'\bmein.* (chef|kollege|partner|frau|mann|mentor|coach)\b',
    r'\bkontakt\b', r'\bperson\b'
]
org_patterns = [
    r'\bfirma\b', r'\bunternehmen\b', r'\borganisation\b',
    r'\bmarakanda\b', r'\bgemeinde\b', r'\bband\b', r'\bteam\b'
]
project_patterns = [
    r'\bprojekt\b', r'\brepository\b', r'\bfeature\b',
    r'\bworan.*arbeite\b', r'\bwas.*mache ich\b', r'\binitiative\b'
]
decision_patterns = [
    r'\bwarum.*entschieden\b', r'\bwieso.*gewählt\b',
    r'\bwarum.*nicht\b', r'\bentscheidung\b', r'\bwahl\b'
]
preference_patterns = [
    r'\bwas.*bevorzug\b', r'\bwas.*mag\b', r'\bwas.*lieber\b',
    r'\bmeine.*präferenz\b', r'\bwas.*gerne\b'
]
learning_patterns = [
    r'\bwas.*gelernt\b', r'\berkenntnis\b', r'\blesson\b',
    r'\berfahrung.*gemacht\b'
]
goal_patterns = [
    r'\bziel\b', r'\bvorhaben\b', r'\bokr\b', r'\bgewohnheit\b',
    r'\bwas.*erreichen\b'
]

all_patterns = (person_patterns + org_patterns + project_patterns +
                decision_patterns + preference_patterns + learning_patterns + goal_patterns)

# Check ob Prompt Graphiti-relevante Frage enthält
needs_graphiti = any(re.search(pattern, prompt) for pattern in all_patterns)

if needs_graphiti:
    # Baue Kontext mit group_id Info
    if group_id != "main" and project_name:
        context = f"""
🔍 **GRAPHITI RECHERCHE EMPFOHLEN**

**Projekt erkannt:** {project_name}
**group_ids für Suche:** `["main", "{group_id}"]`
**group_id für Speichern:**
- Projektspezifisch → `{group_id}`
- Übergreifendes Learning → `main`

Nutze `graphiti__search_nodes(query, group_ids=["main", "{group_id}"])` BEVOR du antwortest.
"""
    else:
        context = """
🔍 **GRAPHITI RECHERCHE EMPFOHLEN**

**Kein Projekt erkannt** - Nutze group_id `main` für persönliches Wissen.

Nutze `graphiti__search_nodes(query)` BEVOR du antwortest oder rätst.

Wenn Graphiti nichts findet: "Das habe ich nicht gespeichert" - NICHT erfinden.
"""
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context
        }
    }
    print(json.dumps(output))

sys.exit(0)
