# Graphiti Claude Integration

Claude Code hooks, rules, and commands for the [Graphiti Knowledge System](https://github.com/getzep/graphiti).

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│   MCP Server    │────▶│    FalkorDB     │
│   (with hooks)  │     │   (Graphiti)    │     │   (Graph DB)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

This integration enables Claude Code to use Graphiti as a persistent knowledge graph for:
- Personal knowledge (contacts, preferences, decisions)
- Project-specific knowledge (requirements, architecture, procedures)
- Cross-session memory with automatic entity extraction

## Features

- **Automatic project detection** via `.graphiti-group` file or `CLAUDE.md`
- **Group ID separation** - personal knowledge (`main`) vs. project knowledge (custom)
- **Entity extraction** - Person, Organization, Decision, Learning, Goal, and 10 more types
- **Session hooks** - automatic context injection and search reminders
- **Slash commands** - `/graphiti/end-project` for clean project handoff

## Installation

### Prerequisites

- [Claude Code](https://claude.ai/code) CLI installed
- A running Graphiti MCP server (see [getzep/graphiti](https://github.com/getzep/graphiti))

### Setup

```bash
# Clone or add as submodule
git clone https://github.com/Milofax/graphiti-claude-integration.git

# Run setup script
cd graphiti-claude-integration
./setup.sh
```

The setup script creates symlinks in `~/.claude/`:
- `hooks/graphiti-session-start.sh`
- `hooks/graphiti-context-inject.py`
- `commands/graphiti/`
- `rules/graphiti.md`

### Configure Hooks

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bash ~/.claude/hooks/graphiti-session-start.sh"
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "python3 ~/.claude/hooks/graphiti-context-inject.py"
      }
    ]
  }
}
```

### Configure MCP Server

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "graphiti": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://your-graphiti-server.com/mcp"]
    }
  }
}
```

## Project Configuration

### Option A: `.graphiti-group` file (recommended)

Create a file in your project root:

```bash
echo "my-project-name" > .graphiti-group
```

### Option B: In `CLAUDE.md`

Add to your project's `CLAUDE.md`:

```markdown
graphiti_group_id: my-project-name
```

### Group ID Naming

- Names are **freely choosable** (e.g., `prp`, `infrastructure`, `client-abc`)
- Only `main` is **reserved** for personal knowledge
- Never use `main` for project-specific knowledge

## Usage

### Automatic Behavior

With hooks configured, Claude will:
1. Show project context at session start
2. Remind to search Graphiti before answering questions about people/companies/projects
3. Use the correct `group_id` for storing and searching

### Manual Commands

```
# Search for knowledge
"Who is Max Mustermann?"
→ Claude searches Graphiti BEFORE answering

# Store knowledge
"Remember: Max is the CTO at TechCorp"
→ Claude stores with appropriate group_id and source

# End project
/graphiti/end-project
→ Review learnings, promote to main, optionally clear project graph
```

## Entity Types

Graphiti automatically extracts 15 entity types:

| Type | Description | Example |
|------|-------------|---------|
| Person | Individuals | "Max works at TechCorp" |
| Organization | Companies, teams | "TechCorp is a startup" |
| Location | Places, servers | "Office is in Berlin" |
| Event | Meetings, deadlines | "Meeting on Jan 15" |
| Project | Initiatives | "Project Alpha" |
| Requirement | Must-have specs | "API must be REST" |
| Procedure | How-to guides | "Deployment process" |
| Concept | External knowledge | "OKRs are a framework" |
| Learning | Personal insights | "I learned: X doesn't work" |
| Document | Sources, books | "According to RFC 7231..." |
| Topic | Subject areas | "Machine Learning" |
| Object | Physical things | "My guitar" |
| Preference | Opinions | "I prefer TypeScript" |
| Decision | Choices + reasoning | "We use Postgres because..." |
| Goal | Objectives | "By Q2: Feature X" |

## Group ID Workflow

```
# Personal knowledge (permanent)
add_memory(..., group_id="main")

# Project knowledge (temporary)
add_memory(..., group_id="my-project")

# Search both during project work
search_nodes(..., group_ids=["main", "my-project"])

# End of project: promote learnings, then clear
/graphiti/end-project
```

## File Structure

```
graphiti-claude-integration/
├── README.md
├── setup.sh
├── hooks/
│   ├── session-start.sh      # SessionStart hook
│   └── context-inject.py     # UserPromptSubmit hook
├── rules/
│   └── graphiti.md           # PITH rule for Claude
└── commands/
    └── graphiti/
        └── end-project.md    # /graphiti/end-project command
```

## Troubleshooting

### "Graphiti finds nothing"

1. Use broader search terms
2. Remove entity type filters
3. Check `group_ids` parameter (defaults to `["main"]` only)

### "No project configuration found" warning

Create `.graphiti-group` in your project root or add `graphiti_group_id` to `CLAUDE.md`.

### Hooks not running

1. Verify symlinks exist: `ls -la ~/.claude/hooks/`
2. Check `~/.claude/settings.json` has correct hook configuration
3. Restart Claude Code session

## Related Projects

- [getzep/graphiti](https://github.com/getzep/graphiti) - The Graphiti knowledge graph framework
- [Milofax/graphiti](https://github.com/Milofax/graphiti) - Fork with additional fixes

## License

MIT
