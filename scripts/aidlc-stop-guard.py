#!/usr/bin/env python3
"""Bound Codex Stop retries before AI-DLC's duplicate-response cache."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def run(raw, cache_root=None):
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            return "", 0
    except (ValueError, TypeError):
        return "", 0

    # A previous Stop intervention must not prevent the human from responding.
    if payload.get("stop_hook_active") is True:
        return "", 0

    project = str(Path(__file__).resolve().parent.parent)
    identity = json.dumps([project, raw], ensure_ascii=True)
    key = hashlib.sha256(identity.encode()).hexdigest()
    root = Path(cache_root or tempfile.gettempdir()) / "formicarium-aidlc-stop-guard"
    try:
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        # Claim once per exact event, including concurrent duplicate deliveries.
        fd = os.open(root / key, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
    except OSError:
        return "", 0

    try:
        result = subprocess.run(
            ["aidlc", "engine", "adapter", "codex", "continue-workflow"],
            input=raw, text=True, capture_output=True, cwd=project, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return "", 0
    # Preserve the first real response. Never replay it on a repeated Stop.
    if result.stderr:
        sys.stderr.write(result.stderr)
    return result.stdout, result.returncode


if __name__ == "__main__":
    output, code = run(sys.stdin.read())
    sys.stdout.write(output)
    sys.exit(code)
