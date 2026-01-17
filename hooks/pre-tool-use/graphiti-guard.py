#!/usr/bin/env python3
import json, sys, os, hashlib
HOOK_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HOOK_DIR, '..', 'lib'))
from session_state import register_hook, read_state, write_state

CRED_PATTERNS = ["password","api_key","api-key","apikey","token","secret","pin","credentials","private_key","private-key","privatekey","access_token","access-token","accesstoken","auth_token","auth-token","authtoken"]

def has_creds(text): return any(p in text.lower() for p in CRED_PATTERNS)
def chash(text): return hashlib.md5(text.encode()).hexdigest()[:8]

def main():
    try: hook_input = json.load(sys.stdin)
    except: print(json.dumps({"decision":"approve"})); return
    register_hook("graphiti")
    tool_name = hook_input.get("tool_name","")
    tool_input = hook_input.get("tool_input",{})
    if tool_name != "mcp__mcp-funnel__bridge_tool_request":
        print(json.dumps({"decision":"approve"})); return
    bridge_tool = tool_input.get("tool","")
    if "graphiti" not in bridge_tool.lower():
        print(json.dumps({"decision":"approve"})); return
    args = tool_input.get("arguments",{})

    if "add_memory" in bridge_tool.lower():
        src = args.get("source_description","")
        if not src or not src.strip():
            print(json.dumps({"decision":"block","reason":"!!quelle_pflicht: source_description fehlt!\n→User-Aussage|Recherche[URL]|Eigene Erfahrung"}))
            return
        body = args.get("episode_body","")
        if has_creds(body):
            print(json.dumps({"decision":"block","reason":"!!nie_credentials: Sensible Daten erkannt!\n→1Password|Secrets Manager|Env Vars\nNIE in Graphiti!"}))
            return
        gid = args.get("group_id","")
        name = args.get("name","")
        eff_gid = gid.strip() if gid else "main"
        if eff_gid == "main":
            state = read_state()
            pending = state.get("main_pending",{})
            curr_hash = chash(body)
            if pending.get("name") == name:
                write_state("main_pending",{})
                if pending.get("content_hash") == curr_hash:
                    print(json.dumps({"decision":"approve","message":"⚠️ Content unverändert→Abstraktion empfohlen!"}))
                else:
                    print(json.dumps({"decision":"approve"}))
                return
            write_state("main_pending",{"name":name,"content_hash":curr_hash})
            print(json.dumps({"decision":"block","reason":"!!main_bestätigung: Speichern in 'main' (permanent).\n1.ÜBERTRAGBAR?\n2.ABSTRAKTION(nicht Impl)?\n3.In 5 Jahren relevant?\nNEIN→projekt-spezifisch|JA→wiederholen"}))
            return
        print(json.dumps({"decision":"approve"})); return

    if "clear_graph" in bridge_tool.lower():
        if not read_state().get("graphiti_review_done",False):
            print(json.dumps({"decision":"block","reason":"!!review: Erst search_nodes(entity_types=['Learning','Decision','Concept'])→promoten→DANN clear_graph"}))
            return
        print(json.dumps({"decision":"approve"})); return

    if "search_nodes" in bridge_tool.lower():
        et = str(args.get("entity_types",[])).lower()
        if "learning" in et or "decision" in et or "concept" in et:
            write_state("graphiti_review_done",True)
        write_state("graphiti_searched",True)
        print(json.dumps({"decision":"approve"})); return

    print(json.dumps({"decision":"approve"}))

if __name__ == "__main__": main()
