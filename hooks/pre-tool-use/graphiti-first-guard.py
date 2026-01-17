#!/usr/bin/env python3
import json, sys, os
HOOK_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HOOK_DIR, '..', 'lib'))
from session_state import register_hook, read_state

def main():
    try: hook_input = json.load(sys.stdin)
    except: print(json.dumps({"decision":"approve"})); return
    register_hook("graphiti-first")
    tool_name = hook_input.get("tool_name","")
    tool_input = hook_input.get("tool_input",{})
    is_research, query = False, ""
    if tool_name in ["WebSearch","WebFetch"]:
        is_research = True
        query = tool_input.get("query","") if tool_name == "WebSearch" else tool_input.get("url","")
    if tool_name == "mcp__mcp-funnel__bridge_tool_request":
        bt = tool_input.get("tool","").lower()
        args = tool_input.get("arguments",{})
        if "firecrawl" in bt:
            is_research, query = True, args.get("query","") or args.get("url","")
        if "context7" in bt:
            is_research, query = True, args.get("libraryName","") or args.get("topic","")
    if not is_research:
        print(json.dumps({"decision":"approve"})); return
    if not read_state().get("graphiti_searched",False):
        print(json.dumps({"decision":"block","reason":f"!!graphiti_first: Erst search_nodes(query=\"{query[:50]}\")\nZettelkasten: Eigenes Wissen VOR externer Recherche."}))
        return
    print(json.dumps({"decision":"approve"}))

if __name__ == "__main__": main()
