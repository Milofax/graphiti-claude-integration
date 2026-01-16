#!/bin/bash
# Graphiti Knowledge System - SessionStart Hook
# Zeigt Hinweis auf verfügbares Wissensmanagement bei neuem Session-Start
# Erkennt Projekt aus:
# 1. .graphiti-group Datei im Projekt-Root
# 2. CLAUDE.md mit graphiti_group_id
# 3. Fallback: Git Root Projektname

input=$(cat)
source_type=$(echo "$input" | jq -r '.source // "startup"')
cwd=$(echo "$input" | jq -r '.cwd // ""')

# Nur bei neuem Start, nicht bei Resume
if [ "$source_type" != "startup" ]; then
  exit 0
fi

# Funktion: Finde Git Root
find_git_root() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    if [ -d "$dir/.git" ]; then
      echo "$dir"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

# Funktion: Suche nach .graphiti-group oder CLAUDE.md
find_group_id() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    # Check .graphiti-group
    if [ -f "$dir/.graphiti-group" ]; then
      cat "$dir/.graphiti-group"
      return 0
    fi
    # Check CLAUDE.md für graphiti_group_id
    if [ -f "$dir/CLAUDE.md" ]; then
      local group_id=$(grep 'graphiti_group_id:' "$dir/CLAUDE.md" | head -1 | sed 's/.*graphiti_group_id:[[:space:]]*//' | tr -d '[:space:]')
      if [ -n "$group_id" ]; then
        echo "$group_id"
        return 0
      fi
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

# Projekt-Erkennung
project_name=""
group_id="main"

if [ -n "$cwd" ]; then
  # 1. Check .graphiti-group oder CLAUDE.md
  found_group=$(find_group_id "$cwd")
  if [ -n "$found_group" ]; then
    # Format kann sein: group_id oder group_id:name
    if [[ "$found_group" == *":"* ]]; then
      group_id="${found_group%%:*}"
      project_name="${found_group#*:}"
    else
      group_id="$found_group"
      # Projektname aus Git Root
      git_root=$(find_git_root "$cwd")
      if [ -n "$git_root" ]; then
        project_name=$(basename "$git_root")
      fi
    fi
  else
    # 2. Fallback: Git Root + Projektname
    git_root=$(find_git_root "$cwd")
    if [ -n "$git_root" ]; then
      project_name=$(basename "$git_root")
      group_id="project-$(echo "$project_name" | tr '[:upper:]' '[:lower:]')"
    fi
  fi
fi

if [ -n "$project_name" ] && [ "$group_id" != "main" ]; then
  cat <<EOF
## Graphiti Knowledge System

**Projekt erkannt:** $project_name
**group_id:** \`$group_id\`

### Wichtig für dieses Projekt:

**Suche:** \`graphiti__search_nodes(query, group_ids=["main", "$group_id"])\`
**Speichern Projekt:** \`graphiti__add_memory(..., group_id="$group_id")\`
**Speichern Übergreifend:** \`graphiti__add_memory(..., group_id="main")\`

### Regeln:
- Projektspezifisches Wissen (Requirements, Architektur) → \`$group_id\`
- Übergreifende Learnings, Decisions → \`main\`
- VOR Projektende: Learnings nach \`main\` promoten
EOF
elif [ -n "$cwd" ] && [ "$group_id" = "main" ]; then
  # Warnung: Working Directory existiert aber keine Projekt-Config gefunden
  cat <<EOF
## Graphiti Knowledge System

⚠️ **WARNUNG: Keine Projekt-Konfiguration gefunden!**

Working Directory: \`$cwd\`
Fallback group_id: \`main\` (persönliches Wissen)

**Wenn dies ein Projekt ist:**
Erstelle \`.graphiti-group\` im Projekt-Root mit deinem group_id Namen:
\`\`\`
echo "mein-projektname" > .graphiti-group
\`\`\`

Oder füge in CLAUDE.md hinzu:
\`\`\`
graphiti_group_id: mein-projektname
\`\`\`

**Ohne Konfiguration:** Alles wird in \`main\` gespeichert (NICHT empfohlen für Projekte!)
EOF
else
  cat <<'EOF'
## Graphiti Knowledge System

Persönliches Wissensmanagement ist verfügbar (group_id: `main`).

**Recherche ERST:**
- Bei Fragen über Personen, Firmen, Projekte → `graphiti__search_nodes()` ZUERST
- NIEMALS raten oder erfinden wenn Graphiti nichts findet

**Speichern IMMER:**
- Neue Fakten, Erkenntnisse, Entscheidungen → `graphiti__add_memory()`

**Entity Types:** Person, Organization, Project, Event, Concept, Learning, Decision, Preference, Goal, Location, Document, Requirement, Procedure, Topic, Object
EOF
fi

exit 0
