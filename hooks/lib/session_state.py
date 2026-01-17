#!/usr/bin/env python3
import fcntl, json, os, time
from pathlib import Path
from typing import Any, Callable

def get_session_id() -> str:
    return os.environ.get("CLAUDE_SESSION_ID") or time.strftime("%Y%m%d")

def get_state_path() -> Path:
    return Path(f"/tmp/claude-session-{get_session_id()}.json")

def _atomic_update(updater: Callable[[dict], dict]) -> None:
    sp, lp = get_state_path(), Path(f"{get_state_path()}.lock")
    try:
        lp.touch(exist_ok=True)
        with open(lp, 'r+') as lf:
            fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
            try:
                state = json.loads(sp.read_text()) if sp.exists() else {}
            except: state = {}
            sp.write_text(json.dumps(updater(state), indent=2))
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)
    except: pass

def read_state() -> dict:
    sp, lp = get_state_path(), Path(f"{get_state_path()}.lock")
    try:
        lp.touch(exist_ok=True)
        with open(lp, 'r') as lf:
            fcntl.flock(lf.fileno(), fcntl.LOCK_SH)
            try:
                r = json.loads(sp.read_text()) if sp.exists() else {}
            except: r = {}
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)
            return r
    except: return {}

def write_state(key: str, value: Any) -> None:
    _atomic_update(lambda s: {**s, key: value})

def register_hook(hook_name: str) -> None:
    def u(s):
        h = s.get("hooks_active", {}); h[hook_name] = True; s["hooks_active"] = h; return s
    _atomic_update(u)

def is_hook_active(hook_name: str) -> bool:
    return read_state().get("hooks_active", {}).get(hook_name, False)

def append_to_list(key: str, value: Any) -> None:
    def u(s):
        l = s.get(key, [])
        if value not in l: l.append(value)
        s[key] = l; return s
    _atomic_update(u)
