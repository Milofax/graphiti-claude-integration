#!/usr/bin/env python3
import json, sys, os, re, subprocess
from pathlib import Path
HOOK_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HOOK_DIR, '..', 'lib'))
from session_state import write_state

def find_git_root(p):
    path = Path(p)
    while path != path.parent:
        if (path / ".git").exists(): return str(path)
        path = path.parent
    return None

def get_github_repo(root):
    try:
        r = subprocess.run(["git","-C",root,"remote","get-url","origin"],capture_output=True,text=True,timeout=3)
        if r.returncode != 0: return None
        url = r.stdout.strip()
        if url.startswith("git@github.com:"): return url[15:].removesuffix(".git")
        if url.startswith("https://github.com/"): return url[19:].removesuffix(".git")
    except: pass
    return None

def detect_group_id(cwd):
    if not cwd: return "main",""
    p = Path(cwd)
    for cp in [p]+list(p.parents):
        gf = cp / ".graphiti-group"
        if gf.exists():
            try:
                c = gf.read_text().strip()
                if c:
                    if ":" in c: g,n = c.split(":",1); return g.strip(),n.strip()
                    return c, cp.name
            except: pass
        cf = cp / "CLAUDE.md"
        if cf.exists():
            try:
                m = re.search(r'graphiti_group_id:\s*(\S+)', cf.read_text())
                if m: return m.group(1).strip(), cp.name
            except: pass
    gr = find_git_root(cwd)
    if gr:
        pn = Path(gr).name
        repo = get_github_repo(gr)
        return (repo,pn) if repo else (f"project-{pn.lower()}",pn)
    return "main",""

def main():
    try: hi = json.load(sys.stdin)
    except: return
    write_state("graphiti_searched", False)
    gid,pn = detect_group_id(hi.get("cwd",""))
    if gid != "main" and pn:
        print(f"📁 Projekt: {pn}\n   group_id: {gid}\n\n💡 Graphiti verfügbar für:\n   - search_nodes() → Wissen abrufen\n   - add_memory() → Wissen speichern")
    else:
        print("📁 main (persönlich)\n\n💡 Graphiti: Kontakte, Learnings, Decisions, Preferences")

if __name__ == "__main__": main()
