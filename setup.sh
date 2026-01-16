#!/bin/bash
# Graphiti Claude Integration - Setup Script
# Creates symlinks to ~/.claude/ and verifies installation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

echo "Graphiti Claude Integration Setup"
echo "=================================="
echo ""
echo "Source: $SCRIPT_DIR"
echo "Target: $CLAUDE_DIR"
echo ""

# Create directories
mkdir -p "$CLAUDE_DIR/hooks"
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/rules"

# Function to create symlink with backup
create_symlink() {
    local source="$1"
    local target="$2"
    local name="$(basename "$target")"

    if [ -L "$target" ]; then
        echo "  Updating: $name"
        rm "$target"
    elif [ -e "$target" ]; then
        echo "  Backing up: $name -> ${name}.backup"
        mv "$target" "${target}.backup"
    else
        echo "  Creating: $name"
    fi

    ln -s "$source" "$target"
}

echo "Installing hooks..."
create_symlink "$SCRIPT_DIR/hooks/session-start.sh" "$CLAUDE_DIR/hooks/graphiti-session-start.sh"
create_symlink "$SCRIPT_DIR/hooks/context-inject.py" "$CLAUDE_DIR/hooks/graphiti-context-inject.py"

echo ""
echo "Installing commands..."
create_symlink "$SCRIPT_DIR/commands/graphiti" "$CLAUDE_DIR/commands/graphiti"

echo ""
echo "Installing rules..."
create_symlink "$SCRIPT_DIR/rules/graphiti.md" "$CLAUDE_DIR/rules/graphiti.md"

echo ""
echo "Verifying installation..."
ERRORS=0

for f in "hooks/graphiti-session-start.sh" "hooks/graphiti-context-inject.py" "commands/graphiti" "rules/graphiti.md"; do
    if [ -L "$CLAUDE_DIR/$f" ]; then
        TARGET=$(readlink "$CLAUDE_DIR/$f")
        if [ -e "$TARGET" ]; then
            echo "  OK: $f"
        else
            echo "  BROKEN: $f -> $TARGET (target missing)"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "  MISSING: $f"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

if [ $ERRORS -gt 0 ]; then
    echo "Installation completed with $ERRORS error(s)."
    exit 1
fi

echo "Installation complete!"
echo ""
echo "Next steps:"
echo "1. Add hooks to ~/.claude/settings.json:"
echo ""
echo '   "hooks": {'
echo '     "SessionStart": [{'
echo '       "type": "command",'
echo '       "command": "bash ~/.claude/hooks/graphiti-session-start.sh"'
echo '     }],'
echo '     "UserPromptSubmit": [{'
echo '       "type": "command",'
echo '       "command": "python3 ~/.claude/hooks/graphiti-context-inject.py"'
echo '     }]'
echo '   }'
echo ""
echo "2. Configure your Graphiti MCP server in Claude Code"
echo "3. Create .graphiti-group in your project roots"
echo ""
echo "See README.md for detailed instructions."
