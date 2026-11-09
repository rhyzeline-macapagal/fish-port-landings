"""Exercise the PHP species handlers against an isolated SQLite database.

Run with: python3 -m unittest discover -s tests -p '*_test.py'
Requires PHP with pdo_sqlite. Authentication is stubbed; role checks are verified.
"""
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest


class SpeciesApiTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fishport-species-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        source = Path(__file__).resolve().parents[1] / "fishport-api"
        for filename in ("species.php", "species_save.php"):
            shutil.copyfile(source / filename, self.root / filename)
        with sqlite3.connect(self.root / "fixture.sqlite") as db:
            db.execute("""CREATE TABLE fp_species (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
                other_names TEXT, english_name TEXT, scientific_name TEXT, notes TEXT
            )""")
        (self.root / "helpers.php").write_text("""<?php
function db(): PDO {
  static $pdo;
  return $pdo ??= new PDO('sqlite:' . __DIR__ . '/fixture.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
}
function json_out($data, int $code = 200) {
  echo json_encode(['status' => $code, 'data' => $data]);
  exit;
}
function body(): array { return json_decode($GLOBALS['fixture_body'], true) ?? []; }
function auth_user(array $roles = []): array {
  $role = $GLOBALS['fixture_role'];
  if (!$role) json_out(['error' => 'Unauthorized'], 401);
  if ($roles && !in_array($role, $roles, true)) json_out(['error' => 'Forbidden'], 403);
  return ['id' => 1, 'role' => $role];
}
""")

    def request(self, method, payload=None, role="admin", record_id=None, endpoint="species.php"):
        runner = """
$_SERVER['REQUEST_METHOD'] = $argv[2];
$_SERVER['SCRIPT_FILENAME'] = $argv[1];
$GLOBALS['fixture_body'] = $argv[3];
$GLOBALS['fixture_role'] = $argv[4];
if ($argv[5] !== '') $_GET['id'] = $argv[5];
require $argv[1];
"""
        result = subprocess.run(
            ["php", "-r", runner, str(self.root / endpoint), method,
             json.dumps(payload or {}), role, str(record_id) if record_id is not None else ""],
            check=True, text=True, capture_output=True,
        )
        return json.loads(result.stdout)

    def test_create_preserves_all_fields_and_appears_in_list(self):
        fields = {"local_name": "SUGPO (HIPON)", "other_names": "Sugpo",
                  "common_name": "Prawn", "scientific_name": "Fixture scientific name", "notes": "Fixture notes"}
        for role in ("admin", "encoder"):
            payload = {**fields, "local_name": fields["local_name"] + " " + role}
            response = self.request("POST", payload, role=role)
            self.assertEqual(response["status"], 201)
            self.assertGreater(response["data"]["id"], 0)
            self.assertEqual({k: response["data"][k] for k in payload}, payload)
        listing = self.request("GET", role="viewer", endpoint="species.php")
        self.assertEqual(listing["status"], 200)
        self.assertEqual(len(listing["data"]), 2)

    def test_update_delete_and_permissions(self):
        created = self.request("POST", {"local_name": "Fixture species"})["data"]
        record_id = created["id"]
        updated = self.request("PUT", {"local_name": " Updated species ", "notes": "Updated"}, record_id=record_id)
        self.assertEqual(updated["status"], 200)
        self.assertEqual(updated["data"]["local_name"], "Updated species")
        self.assertIsNone(updated["data"]["common_name"])
        self.assertEqual(self.request("DELETE", role="encoder", record_id=record_id)["status"], 403)
        self.assertEqual(self.request("DELETE", record_id=record_id)["status"], 200)
        self.assertEqual(self.request("GET", endpoint="species.php")["data"], [])

    def test_rejects_invalid_unauthorized_and_unsupported_requests(self):
        self.assertEqual(self.request("POST", {"local_name": "   "})["status"], 422)
        self.assertEqual(self.request("POST", {"local_name": "Fixture"}, role="")["status"], 401)
        self.assertEqual(self.request("POST", {"local_name": "Fixture"}, role="viewer")["status"], 403)
        self.assertEqual(self.request("PATCH")["status"], 405)
        self.assertEqual(self.request("PUT", {"local_name": "Fixture"}, record_id=999)["status"], 404)
        self.assertEqual(self.request("GET", endpoint="species.php")["data"], [])

    def test_save_alias_keeps_supporting_writes(self):
        response = self.request("POST", {"local_name": "Compatible species"}, endpoint="species_save.php")
        self.assertEqual(response["status"], 201)
        self.assertEqual(response["data"]["local_name"], "Compatible species")

    def test_species_endpoint_works_without_save_file(self):
        (self.root / "species_save.php").unlink()
        response = self.request("POST", {"local_name": "Standalone species"})
        self.assertEqual(response["status"], 201)
        listing = self.request("GET", role="viewer")
        self.assertEqual(listing["data"][0]["local_name"], "Standalone species")


if __name__ == "__main__":
    unittest.main()
