#!/usr/bin/env python3
"""
Graphiti Guard Hook - Enforces 9 !! rules from graphiti.md

Rules enforced:
- !!quelle_pflicht: source_description IMMER angeben
- !!nie_credentials: NIEMALS Passwörter/API-Keys speichern
- !!vor_add_memory: group_id ENTSCHEIDEN
- !!review: VOR clear_graph reviewen
- !!promoten: Vor clear_graph promoten

Triggers:
- mcp__mcp-funnel__bridge_tool_request (graphiti tools)
"""

import json
import sys
import os

# Add lib directory to path for session_state import
# Path is relative to this hook's location: ../lib/ (same package)
HOOK_DIR = os.path.dirname(os.path.abspath(__file__))
LIB_DIR = os.path.join(HOOK_DIR, '..', 'lib')
sys.path.insert(0, LIB_DIR)

from session_state import register_hook, read_state, write_state


# Credential patterns to block
CREDENTIAL_PATTERNS = [
    "password",
    "api_key",
    "api-key",
    "apikey",
    "token",
    "secret",
    "pin",
    "credentials",
    "private_key",
    "private-key",
    "privatekey",
    "access_token",
    "access-token",
    "accesstoken",
    "auth_token",
    "auth-token",
    "authtoken",
]


def contains_credentials(text: str) -> bool:
    """Check if text contains credential patterns."""
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in CREDENTIAL_PATTERNS)


def main():
    try:
        hook_input = json.load(sys.stdin)
    except json.JSONDecodeError:
        # Invalid input, allow
        print(json.dumps({"decision": "approve"}))
        return

    # Register this hook
    register_hook("graphiti")

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    # Only handle Graphiti MCP tools
    if tool_name != "mcp__mcp-funnel__bridge_tool_request":
        print(json.dumps({"decision": "approve"}))
        return

    bridge_tool = tool_input.get("tool", "")
    if "graphiti" not in bridge_tool.lower():
        print(json.dumps({"decision": "approve"}))
        return

    arguments = tool_input.get("arguments", {})

    # Handle add_memory
    if "add_memory" in bridge_tool.lower():
        # !!quelle_pflicht: source_description required
        source_description = arguments.get("source_description", "")
        if not source_description or source_description.strip() == "":
            print(json.dumps({
                "decision": "block",
                "reason": (
                    "!!quelle_pflicht: source_description fehlt!\n\n"
                    "Woher kommt dieses Wissen?\n"
                    "- User-Aussage → source_description: 'User-Aussage 2026-01-17'\n"
                    "- Recherche → source_description: '[URL oder Buch]'\n"
                    "- Eigene Erkenntnis → source_description: 'Eigene Erfahrung'\n\n"
                    "Wissen ohne Quelle kontaminiert den Graph!"
                )
            }))
            return

        # !!nie_credentials: No credentials in episode_body
        episode_body = arguments.get("episode_body", "")
        if contains_credentials(episode_body):
            print(json.dumps({
                "decision": "block",
                "reason": (
                    "!!nie_credentials: Credentials erkannt!\n\n"
                    "episode_body enthält sensible Daten (password, api_key, token, etc.)\n\n"
                    "Credentials gehören in:\n"
                    "- 1Password (immer)\n"
                    "- Secrets Manager\n"
                    "- Environment Variables\n\n"
                    "NIEMALS in Graphiti speichern!"
                )
            }))
            return

        # !!vor_add_memory: Warn if group_id not explicit
        group_id = arguments.get("group_id", "")
        if not group_id or group_id.strip() == "":
            # Allow but warn
            print(json.dumps({
                "decision": "approve",
                "message": (
                    "!!vor_add_memory: group_id nicht explizit angegeben.\n"
                    "Default ist 'main' - ist das korrekt?\n\n"
                    "- main = Langfristiges Wissen (Kontakte, Learnings, Decisions)\n"
                    "- project-* = Kontextgebundenes Wissen (Requirements, Procedures)\n\n"
                    "Falsches group_id → Kontamination → manuelles Cleanup nötig!"
                )
            }))
            return

        # add_memory with all checks passed
        print(json.dumps({"decision": "approve"}))
        return

    # Handle clear_graph
    if "clear_graph" in bridge_tool.lower():
        state = read_state()

        # !!review + !!promoten: Must review before clearing
        if not state.get("graphiti_review_done", False):
            print(json.dumps({
                "decision": "block",
                "reason": (
                    "!!review: Erst Learnings/Decisions reviewen!\n\n"
                    "VOR clear_graph IMMER:\n"
                    "1. search_nodes(entity_types=['Learning', 'Decision', 'Concept'])\n"
                    "2. Wertvolles Wissen nach 'main' promoten\n"
                    "3. DANN clear_graph\n\n"
                    "Nach clear_graph ist Kontext-Wissen WEG - irreversibel!"
                )
            }))
            return

        print(json.dumps({"decision": "approve"}))
        return

    # Handle search_nodes - track for clear_graph review
    if "search_nodes" in bridge_tool.lower():
        entity_types = arguments.get("entity_types", [])
        entity_types_str = str(entity_types).lower()

        # If searching for Learnings, mark review as done
        if "learning" in entity_types_str or "decision" in entity_types_str or "concept" in entity_types_str:
            write_state("graphiti_review_done", True)

        print(json.dumps({"decision": "approve"}))
        return

    # Default: allow other graphiti tools
    print(json.dumps({"decision": "approve"}))


if __name__ == "__main__":
    main()
