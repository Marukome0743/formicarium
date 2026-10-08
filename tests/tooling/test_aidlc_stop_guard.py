import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


source = Path(__file__).resolve().parents[2] / "scripts/aidlc-stop-guard.py"
spec = importlib.util.spec_from_file_location("stop_guard", source)
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class StopGuardTests(unittest.TestCase):
    def test_identical_stop_cannot_replay_block_forever(self):
        raw = json.dumps({"session_id": "s", "turn_id": "t", "stop_hook_active": False})
        blocked = subprocess.CompletedProcess([], 0, '{"decision":"block","reason":"continue"}', "")
        with tempfile.TemporaryDirectory() as cache, patch.object(guard.subprocess, "run", return_value=blocked) as adapter:
            self.assertEqual(guard.run(raw, cache)[0], blocked.stdout)
            for _ in range(10):
                self.assertEqual(guard.run(raw, cache), ("", 0))
            adapter.assert_called_once()

    def test_native_retry_allows_human_turn_without_adapter(self):
        with patch.object(guard.subprocess, "run") as adapter:
            self.assertEqual(guard.run('{"stop_hook_active":true}'), ("", 0))
            adapter.assert_not_called()

    def test_new_turn_gets_its_own_first_check(self):
        allowed = subprocess.CompletedProcess([], 0, "", "")
        with tempfile.TemporaryDirectory() as cache, patch.object(guard.subprocess, "run", return_value=allowed) as adapter:
            guard.run('{"session_id":"s","turn_id":"one"}', cache)
            guard.run('{"session_id":"s","turn_id":"two"}', cache)
            self.assertEqual(adapter.call_count, 2)

    def test_timeout_and_malformed_input_allow_stop(self):
        with tempfile.TemporaryDirectory() as cache, patch.object(guard.subprocess, "run", side_effect=subprocess.TimeoutExpired("aidlc", 30)) as adapter:
            self.assertEqual(guard.run("not json", cache), ("", 0))
            self.assertEqual(guard.run('{"turn_id":"timeout"}', cache), ("", 0))
            adapter.assert_called_once()


if __name__ == "__main__":
    unittest.main()
