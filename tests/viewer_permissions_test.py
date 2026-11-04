"""Verify the real shared authorization code using an isolated token database.

Only db() is adapted to SQLite; bearer parsing, token lookup, expiry, active-user
checks, role normalization, and authorization all run from helpers.php.
"""
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
import unittest


class ViewerPermissionsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fishport-viewer-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = (Path(__file__).resolve().parents[1] / "fishport-api/helpers.php").read_text()
        replacement = """function db(): PDO {
  static $pdo;
  if (!$pdo) {
    $pdo = new PDO('sqlite:' . dirname($_SERVER['SCRIPT_FILENAME']) . '/fixture.sqlite', null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->sqliteCreateFunction('NOW', fn() => gmdate('Y-m-d H:i:s'));
  }
  return $pdo;
}

function json_out"""
        source, count = re.subn(r"function db\(\): PDO \{.*?\n\}\n\nfunction json_out", replacement, source, count=1, flags=re.S)
        self.assertEqual(count, 1, "Fixture must replace only the database connector")
        (self.root / "helpers.php").write_text(source)
        (self.root / "config.php").write_text("<?php define('ALLOWED_ORIGINS', []);\n")
        with sqlite3.connect(self.root / "fixture.sqlite") as db:
            db.execute("CREATE TABLE fp_users (id INTEGER PRIMARY KEY, full_name TEXT, email TEXT, role TEXT, is_active INTEGER)")
            db.execute("CREATE TABLE fp_auth_tokens (user_id INTEGER, token_hash TEXT, expires_at TEXT)")
            db.execute("CREATE TABLE fixture_changes (actor INTEGER)")
            for user_id, role, active, expiry in [
                (1, "viewer", 1, "2999-01-01"), (2, " Viewer ", 1, "2999-01-01"),
                (3, "admin", 1, "2999-01-01"), (4, "encoder", 1, "2999-01-01"),
                (5, "viewer", 0, "2999-01-01"), (6, "viewer", 1, "2000-01-01"),
            ]:
                db.execute("INSERT INTO fp_users VALUES (?, ?, ?, ?, ?)", (user_id, "Fixture", "fixture@example.test", role, active))
                db.execute("INSERT INTO fp_auth_tokens VALUES (?, ?, ?)",
                           (user_id, hashlib.sha256(f"fixture-{user_id}".encode()).hexdigest(), expiry))

    def request(self, method="GET", roles=None, token="fixture-1"):
        runner = """
ob_start();
register_shutdown_function(function () {
  $output = ob_get_clean();
  echo json_encode(['status' => http_response_code() ?: 200, 'data' => json_decode($output, true)]);
});
$_SERVER['SCRIPT_FILENAME'] = $argv[1];
$_SERVER['REQUEST_METHOD'] = $argv[2];
if ($argv[4] !== '') $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $argv[4];
require $argv[1];
$user = auth_user(json_decode($argv[3], true));
if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD'], true)) {
  db()->prepare('INSERT INTO fixture_changes (actor) VALUES (?)')->execute([$user['id']]);
}
json_out(['role' => $user['role']]);
"""
        result = subprocess.run(
            ["php", "-r", runner, str(self.root / "helpers.php"), method, json.dumps(roles or []), token],
            check=True, text=True, capture_output=True,
        )
        return json.loads(result.stdout)

    def test_viewer_reads_legacy_and_current_sections(self):
        for roles in ([], ["admin"], ["admin", "encoder"], ["admin", "encoder", "viewer"]):
            for method in ("GET", "HEAD"):
                with self.subTest(roles=roles, method=method):
                    self.assertEqual(self.request(method, roles), {"status": 200, "data": {"role": "viewer"}})

    def test_viewer_cannot_change_data_even_without_endpoint_role_restrictions(self):
        for roles in ([], ["viewer"], ["admin", "encoder"], ["admin", "encoder", "viewer"]):
            for method in ("POST", "PUT", "PATCH", "DELETE"):
                with self.subTest(roles=roles, method=method):
                    self.assertEqual(self.request(method, roles)["status"], 403)
        with sqlite3.connect(self.root / "fixture.sqlite") as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM fixture_changes").fetchone()[0], 0)

    def test_normalizes_viewer_role_before_applying_permissions(self):
        self.assertEqual(self.request(roles=["admin"], token="fixture-2")["data"]["role"], "viewer")
        self.assertEqual(self.request("POST", token="fixture-2")["status"], 403)

    def test_missing_invalid_inactive_and_expired_sessions_remain_unauthorized(self):
        for token in ("", "invalid", "fixture-5", "fixture-6"):
            with self.subTest(token=token):
                self.assertEqual(self.request(token=token)["status"], 401)

    def test_admin_and_encoder_keep_their_write_permissions(self):
        for token in ("fixture-3", "fixture-4"):
            self.assertEqual(self.request("POST", ["admin", "encoder"], token)["status"], 200)
        self.assertEqual(self.request("POST", ["admin"], "fixture-4")["status"], 403)
        self.assertEqual(self.request("GET", ["admin"], "fixture-4")["status"], 403)


if __name__ == "__main__":
    unittest.main()
