#!/bin/bash
# Graphiti Knowledge System - SessionStart Hook
# Zeigt Hinweis auf verfügbares Wissensmanagement bei neuem Session-Start
#
# Output Format (JSON):
# - systemMessage: Wird dem USER angezeigt (Terminal)
# - additionalContext: Wird Claude als Kontext gegeben
#
# Erkennt Projekt aus:
# 1. CLAUDE.md mit graphiti_group_id
# 2. GitHub Remote (owner/repo)
# 3. Fallback: Git Root Projektname

input=$(cat)

source_type=$(echo "$input" | jq -r '.source // "startup"')

# cwd aus JSON oder fallback zu $PWD
cwd=$(echo "$input" | jq -r '.cwd // ""')
if [ -z "$cwd" ]; then
  cwd="$PWD"
fi

# Nur bei neuem Start (startup), nicht bei Resume
if [ "$source_type" != "startup" ]; then
  exit 0
fi

# === MCP Connectivity Check ===
GRAPHITI_URL="https://graphiti.marakanda.biz/health"
mcp_status="unknown"
mcp_warning=""

# Timeout 3s für Health-Check
if curl -s --max-time 3 "$GRAPHITI_URL" | grep -q "healthy"; then
  mcp_status="ok"
else
  mcp_status="error"
  mcp_warning="Graphiti MCP nicht erreichbar! Wissen kann nicht gespeichert/abgerufen werden."
fi

# === Projekt-Erkennung ===

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

get_github_repo() {
  local git_root="$1"
  local remote_url=$(git -C "$git_root" remote get-url origin 2>/dev/null)

  if [ -z "$remote_url" ]; then
    return 1
  fi

  local repo=""
  if [[ "$remote_url" == git@github.com:* ]]; then
    repo="${remote_url#git@github.com:}"
    repo="${repo%.git}"
  elif [[ "$remote_url" == https://github.com/* ]]; then
    repo="${remote_url#https://github.com/}"
    repo="${repo%.git}"
  fi

  if [ -n "$repo" ]; then
    echo "$repo"
    return 0
  fi
  return 1
}

find_claude_md_group() {
  local dir="$1"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/CLAUDE.md" ]; then
      local gid=$(grep 'graphiti_group_id:' "$dir/CLAUDE.md" 2>/dev/null | head -1 | sed 's/.*graphiti_group_id:[[:space:]]*//' | tr -d '[:space:]')
      if [ -n "$gid" ]; then
        echo "$gid"
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
github_group_id=""
claude_md_group_id=""
source_type_display=""

if [ -n "$cwd" ]; then
  git_root=$(find_git_root "$cwd")

  if [ -n "$git_root" ]; then
    project_name=$(basename "$git_root")
    github_group_id=$(get_github_repo "$git_root")
    claude_md_group_id=$(find_claude_md_group "$cwd")

    if [ -n "$claude_md_group_id" ]; then
      group_id="$claude_md_group_id"
      if [ -n "$github_group_id" ] && [ "$claude_md_group_id" != "$github_group_id" ]; then
        source_type_display="claude-md-override"
      else
        source_type_display="claude-md"
      fi
    elif [ -n "$github_group_id" ]; then
      group_id="$github_group_id"
      source_type_display="github"
    else
      group_id="project-$(echo "$project_name" | tr '[:upper:]' '[:lower:]')"
      source_type_display="local-git"
    fi
  else
    claude_md_group_id=$(find_claude_md_group "$cwd")
    if [ -n "$claude_md_group_id" ]; then
      group_id="$claude_md_group_id"
      source_type_display="claude-md-no-git"
    else
      source_type_display="none"
    fi
  fi
fi

# === Output bauen ===

# systemMessage: Für den User sichtbar
# additionalContext: Für Claude als Kontext

build_system_message() {
  # Icons: ✅ OK | ⚠️ Warning | ❌ Error

  # MCP unreachable = critical
  if [ "$mcp_status" = "error" ]; then
    echo "🧠 ❌ GRAPHITI OFFLINE - Knowledge unavailable!"
    return
  fi

  # No project detected = warning
  if [ "$source_type_display" = "none" ]; then
    echo "🧠 ⚠️ Graphiti: no project → main memory"
    return
  fi

  # CLAUDE.md override = warning
  if [ "$source_type_display" = "claude-md-override" ]; then
    echo "🧠 ⚠️ Graphiti: $group_id (CLAUDE.md overrides GitHub)"
    return
  fi

  # Local git without GitHub = note
  if [ "$source_type_display" = "local-git" ]; then
    echo "🧠 ✅ Graphiti: $group_id (local)"
    return
  fi

  # All OK
  echo "🧠 ✅ Graphiti: $group_id"
}

build_context() {
  local ctx=""

  # MCP Status
  if [ "$mcp_status" = "error" ]; then
    ctx="## Graphiti Knowledge System

**STATUS: UNREACHABLE**

Graphiti MCP Server not responding at $GRAPHITI_URL

**Possible causes:**
- Docker container on Ubuntu VM down
- Traefik reverse proxy issue
- Network problem

**Action:** Escalate to user immediately if Graphiti functions are needed.
Do NOT use WebSearch as substitute for personal knowledge."
    echo "$ctx"
    return
  fi

  # Project context
  case "$source_type_display" in
    "github"|"claude-md")
      ctx="## Graphiti Knowledge System

**Project:** $project_name
**group_id:** \`$group_id\`

**Search:** \`graphiti__search_nodes(query, group_ids=[\"main\", \"$group_id\"])\`
**Save project-specific:** \`graphiti__add_memory(..., group_id=\"$group_id\")\`
**Save cross-project:** \`graphiti__add_memory(..., group_id=\"main\")\`"
      ;;
    "claude-md-override")
      ctx="## Graphiti Knowledge System

**CLAUDE.md overrides GitHub!**

**Project:** $project_name
**group_id:** \`$group_id\` (from CLAUDE.md)
**GitHub would be:** \`$github_group_id\`

**Search:** \`graphiti__search_nodes(query, group_ids=[\"main\", \"$group_id\"])\`
**Save:** \`graphiti__add_memory(..., group_id=\"$group_id\")\`"
      ;;
    "local-git")
      ctx="## Graphiti Knowledge System

**Local Git (no GitHub remote)**

**Project:** $project_name
**group_id:** \`$group_id\`

**Recommendation:** Push to GitHub for stable group_id, or set \`graphiti_group_id:\` in CLAUDE.md.

**Search:** \`graphiti__search_nodes(query, group_ids=[\"main\", \"$group_id\"])\`
**Save:** \`graphiti__add_memory(..., group_id=\"$group_id\")\`"
      ;;
    "claude-md-no-git")
      ctx="## Graphiti Knowledge System

**group_id:** \`$group_id\` (from CLAUDE.md, no Git)

**Search:** \`graphiti__search_nodes(query, group_ids=[\"main\", \"$group_id\"])\`
**Save:** \`graphiti__add_memory(..., group_id=\"$group_id\")\`"
      ;;
    "none")
      ctx="## Graphiti Knowledge System

**No project detected!**

**Directory:** \`$cwd\`
**Fallback:** main memory

⚠️ EVERYTHING goes to main memory! For projects:
- Create Git repository with GitHub remote, OR
- Set \`graphiti_group_id: my-project\` in CLAUDE.md

**Search:** \`graphiti__search_nodes(query)\`
**Save:** \`graphiti__add_memory()\`"
      ;;
    *)
      ctx="## Graphiti Knowledge System

**Mode:** main memory

**Search:** \`graphiti__search_nodes(query)\`
**Save:** \`graphiti__add_memory()\`"
      ;;
  esac

  echo "$ctx"
}

system_message=$(build_system_message)
additional_context=$(build_context)

# JSON Output - systemMessage wird dem User angezeigt!
jq -n \
  --arg sm "$system_message" \
  --arg ctx "$additional_context" \
  '{
    "hookSpecificOutput": { "hookEventName": "SessionStart" },
    "systemMessage": $sm,
    "additionalContext": $ctx
  }'

exit 0
