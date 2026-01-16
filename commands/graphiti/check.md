# Graphiti Context Check

Show current Graphiti configuration and project detection status.

## Instructions

1. Detect current project configuration:
   - Check for `.graphiti-group` file in project root
   - Check for `graphiti_group_id` in CLAUDE.md
   - Fallback to Git repository name
   - Fallback to `main` (personal knowledge)

2. Display current status:
   ```
   ## Graphiti Context

   **Working Directory:** [current path]
   **Detected Project:** [project name or "none"]
   **group_id:** [detected group_id]
   **Config Source:** [.graphiti-group | CLAUDE.md | Git Root | Fallback]

   **Search will use:** ["main", "project-xxx"] or ["main"]
   **New knowledge goes to:** [group_id]
   ```

3. If Graphiti MCP is available, also show:
   - Connection status (call `graphiti__get_status`)
   - Number of nodes in current group(s)

4. Provide recommendations if misconfigured:
   - No project config in a Git repo → suggest creating `.graphiti-group`
   - Using `main` for project work → warn about pollution
