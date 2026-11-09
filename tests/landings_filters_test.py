"""Execute the Landings endpoint with MySQL syntax adapted to isolated SQLite."""
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest


class LandingsFiltersTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fishport-landings-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copyfile(Path(__file__).resolve().parents[1] / "fishport-api/landings.php", self.root / "landings.php")
        (self.root / "helpers.php").write_text("""<?php
class FixturePDO extends PDO {
  public function query(string $query, ?int $fetchMode = null, mixed ...$args): PDOStatement|false {
    if ($query === 'SHOW COLUMNS FROM fp_landings') {
      $query = "SELECT name AS Field FROM pragma_table_info('fp_landings')";
    }
    return $fetchMode === null ? parent::query($query) : parent::query($query, $fetchMode, ...$args);
  }
}
function db(): PDO {
  static $pdo;
  if (!$pdo) {
    $pdo = new FixturePDO('sqlite:' . __DIR__ . '/fixture.sqlite', null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->sqliteCreateFunction('IF', fn($condition, $yes, $no) => $condition ? $yes : $no);
    $pdo->sqliteCreateFunction('CONCAT', fn(...$parts) => implode('', $parts));
    $pdo->sqliteCreateFunction('YEAR', fn($date) => (int)substr($date, 0, 4));
    $pdo->sqliteCreateFunction('MONTH', fn($date) => (int)substr($date, 5, 2));
    $pdo->sqliteCreateFunction('LOWER', fn($text) => mb_strtolower((string)$text));
    $pdo->sqliteCreateFunction('DATE_FORMAT', function($date, $format) {
      if (!$date) return null;
      $formats = ['%b %e, %Y' => 'M j, Y', '%Y-%m' => 'Y-m', '%Y-%m-%d' => 'Y-m-d'];
      return (new DateTimeImmutable($date))->format($formats[$format]);
    });
    $pdo->sqliteCreateFunction('TIME_FORMAT', fn($time, $format) => $time ? (new DateTimeImmutable($time))->format('g:i A') : null);
  }
  return $pdo;
}
function auth_user(array $roles = []) {
  $role = $GLOBALS['fixture_role'];
  if ($roles && !in_array($role, $roles, true)) json_out(['error' => 'Forbidden'], 403);
  return ['id' => 1, 'role' => $role];
}
function json_out($data, int $code = 200) { echo json_encode(['status' => $code, 'data' => $data]); exit; }
""")
        with sqlite3.connect(self.root / "fixture.sqlite") as db:
            self.addCleanup(db.close)
            # Intentionally omit optional fishing_ground, as on the hosted database.
            db.execute("""CREATE TABLE fp_landings (
                id INTEGER PRIMARY KEY, landing_date TEXT, landing_time TEXT,
                boat_name TEXT, fishing_gear TEXT, origin TEXT, truck_delivery INTEGER,
                plate_number TEXT, boat_owner TEXT, species_id INTEGER, species TEXT,
                volume REAL, unit TEXT, price_per_kg REAL, total_value REAL, broker TEXT,
                quality TEXT, remarks TEXT, status TEXT, trip_id TEXT,
                reviewed_at TEXT, created_at TEXT
            )""")
            db.executemany("INSERT INTO fp_landings VALUES (" + ",".join(["?"] * 22) + ")", [
                (1, "2023-12-31", "08:15:00", "Alpha", "Gillnet", "Manila", 0,
                 "AAA001", "Ana", 101, "SUGPO (HIPON)", 10, "kg", 175, 1750,
                 "Broker Alpha", "Fresh", "100% fresh_A!\\notes", "approved", "trip-alpha", None, "2023-12-31"),
                (2, "2024-01-01", "14:30:00", "Beta", "Trap", "Cebu", 1,
                 "BBB002", "Ben", 102, "Bangus", .5, "ton", 20, 10000,
                 "Broker Beta", "Frozen", "New Year delivery", "pending", "trip-beta", None, "2024-01-01"),
                (3, "2024-01-02", "06:00:00", "Gamma", "Line", "Davao", 0,
                 "CCC003", "Cara", 103, "Tilapia", 3, "kg", 0, 0,
                 "Broker Gamma", "Fresh", "Sample", "rejected", "trip-gamma", None, "2024-01-02"),
                (4, "2024-01-03", "17:45:00", "Delta", "Seine", "Bicol", 0,
                 "DDD004", "Dan", 104, "Tuna", 2, "kg", 90, 180,
                 "Broker Delta", "Fresh", "Later delivery", "approved", "trip-delta", None, "2024-01-03"),
            ])

    def request(self, params=None, role="viewer", method="GET"):
        runner = """
$_SERVER['SCRIPT_FILENAME'] = $argv[1];
$_SERVER['REQUEST_METHOD'] = $argv[2];
$_GET = json_decode($argv[3], true);
$GLOBALS['fixture_role'] = $argv[4];
require $argv[1];
"""
        result = subprocess.run(["php", "-r", runner, str(self.root / "landings.php"), method,
                                 json.dumps(params or {}), role], check=True, text=True, capture_output=True)
        return json.loads(result.stdout)

    def ids(self, params=None, role="viewer"):
        result = self.request(params, role)
        self.assertEqual(result["status"], 200, result)
        return sorted(row["id"] for row in result["data"])

    def test_search_record_fields_for_all_roles(self):
        queries = ["alpha", "ana", "gillnet", "manila", "AAA001", "SUGPO", "175", "1750",
                   "10 kg", "Broker Alpha", "approved", "2023-12-31", "Dec 31, 2023", "8:15 AM", "trip-alpha"]
        for role in ("admin", "encoder", "viewer"):
            for query in queries:
                with self.subTest(role=role, query=query):
                    self.assertIn(1, self.ids({"q": query}, role))

    def test_formatted_currency_weight_route_and_zero(self):
        self.assertEqual(self.ids({"q": "₱1,750.00"}), [1])
        self.assertEqual(self.ids({"q": "PHP 10,000"}), [2])
        self.assertEqual(self.ids({"q": "500 kg"}), [2])
        self.assertEqual(self.ids({"q": "0.5 ton"}), [2])
        self.assertEqual(self.ids({"q": "By land"}), [2])
        self.assertIn(3, self.ids({"q": "0"}))

    def test_search_wildcards_are_literal_and_parameters_are_bound(self):
        for query in ("100%", "fresh_A", "!", "\\notes"):
            self.assertEqual(self.ids({"q": query}), [1])
        self.assertEqual(self.ids({"q": "%' OR 1=1 --"}), [])
        self.assertEqual(self.ids({"q": "no match anywhere"}), [])

    def test_inclusive_range_overrides_year_and_quick_period(self):
        for role in ("admin", "encoder", "viewer"):
            self.assertEqual(self.ids({"from": "2023-12-31", "to": "2024-01-01", "year": "2026", "period": "today"}, role), [1, 2])
        self.assertEqual(self.ids({"from": "2024-01-01", "to": "2024-01-01"}), [2])
        self.assertEqual(self.ids({"from": "2024-01-02"}), [3, 4])
        self.assertEqual(self.ids({"to": "2024-01-01"}), [1, 2])
        self.assertEqual(self.ids({"year": "2024"}), [2, 3, 4])

    def test_combined_filters_totals_and_export_grouping(self):
        params = {"from": "2023-12-31", "to": "2024-01-01", "q": "Bangus"}
        self.assertEqual(self.ids(params), [2])
        data = self.request({**params, "summary": "1"})["data"]
        self.assertEqual((data["count"], data["volume"], data["value"]), (1, 500, 10000))
        self.assertEqual(self.request({**params, "top": "species"})["data"]["rows"][0]["label"], "Bangus")
        self.assertEqual(self.request({**params, "group": "species"})["data"]["rows"][0]["labels"], ["Bangus"])

    def test_metadata_handles_optional_missing_columns(self):
        result = self.request({"meta": "options"})
        self.assertEqual(result["status"], 200)
        self.assertEqual(result["data"]["grounds"], [])
        self.assertIn("SUGPO (HIPON)", result["data"]["species"])

    def test_invalid_dates_return_validation_errors(self):
        for params in ({"from": "2024-02-30"}, {"to": "bad"}, {"from": ["2024-01-01"]},
                       {"from": "2024-01-03", "to": "2024-01-01"}):
            self.assertEqual(self.request(params)["status"], 422)

    def test_viewer_cannot_add_records(self):
        self.assertEqual(self.request(role="viewer", method="POST")["status"], 403)


if __name__ == "__main__":
    unittest.main()
