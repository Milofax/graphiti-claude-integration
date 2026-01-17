# graphiti-claude-integration

Claude Code hooks and rules for [Graphiti](https://github.com/getzep/graphiti) knowledge graph.

## Installation

```bash
npx graphiti-claude-integration install
```

Installs to `.claude/` relative to current directory.

**Prerequisite:** A running Graphiti MCP server configured in Claude Code.

## What's Included

### Hooks

| Hook | Type | Function |
|------|------|----------|
| graphiti-context-loader.py | SessionStart | Shows project context and group_id at start |
| session-reminder.py | UserPromptSubmit | Checklist reminder at each prompt |
| graphiti-guard.py | PreToolUse | Enforces source_description, blocks credentials |

### Hook Enforcement

| Rule | Behavior |
|------|----------|
| `!!quelle_pflicht` | Blocks `add_memory` without `source_description` |
| `!!nie_credentials` | Blocks `add_memory` containing passwords/tokens |
| `!!vor_add_memory` | Warns if `group_id` not specified (defaults to main) |
| `!!review` | Blocks `clear_graph` without prior Learning/Decision search |

### Rules

- `graphiti.md` - PITH format rule for MCP usage, 17 entity types

### Commands

- `/graphiti/end-project` - Review learnings, promote to main, clear project graph
- `/graphiti/check` - Verify Graphiti connection

## Project Configuration

**Option A:** `.graphiti-group` file in project root:
```bash
echo "my-project" > .graphiti-group
```

**Option B:** In `CLAUDE.md`:
```markdown
graphiti_group_id: my-project
```

**Auto-detection:** Falls back to GitHub remote or folder name.

## Group IDs

- `main` - Personal knowledge (contacts, learnings, decisions) - **permanent**
- `project-*` - Project knowledge (requirements, procedures) - **temporary**

```bash
# Personal → main
add_memory(..., group_id="main")

# Project → custom name
add_memory(..., group_id="my-project")

# Search both
search_nodes(..., group_ids=["main", "my-project"])
```

## Entity Types (17)

Person, Organization, Location, Event, Project, Requirement, Procedure, Concept, Learning, Document, Topic, Object, Preference, Decision, Goal, Task, Work

## Commands

```bash
npx graphiti-claude-integration install    # Install hooks + rules
npx graphiti-claude-integration uninstall  # Remove all
npx graphiti-claude-integration status     # Show installed
```

## Structure

```
graphiti-claude-integration/
├── bin/cli.js              # Installer
├── hooks/
│   ├── session-start/      # Context loader
│   ├── user-prompt-submit/ # Reminder
│   └── pre-tool-use/       # Guard
├── rules/graphiti.md       # PITH rule
├── commands/graphiti/      # Slash commands
└── package.json
```

## Related

- [getzep/graphiti](https://github.com/getzep/graphiti) - Graphiti framework
- [shared-claude-rules](https://github.com/Milofax/shared-claude-rules) - General Claude Code rules
