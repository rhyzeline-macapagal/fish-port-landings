"""Run the dashboard endpoint with an isolated SQLite landing database."""
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest


class DashboardPeriodTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fishport-dashboard-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copyfile(Path(__file__).resolve().parents[1] / "fishport-api/dashboard.php", self.root / "dashboard.php")
        (self.root / "helpers.php").write_text("""<?php
function db(): PDO {
  static $pdo;
  if (!$pdo) {
    $pdo = new PDO('sqlite:' . __DIR__ . '/fixture.sqlite', null, null, [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->sqliteCreateFunction('YEAR', fn($date) => (int)substr($date, 0, 4));
    $pdo->sqliteCreateFunction('MONTH', fn($date) => (int)substr($date, 5, 2));
  }
  return $pdo;
}
function auth_user(array $roles = []) {
  if ($roles && !in_array('viewer', $roles, true)) json_out(['error' => 'Forbidden'], 403);
  return ['id' => 1, 'role' => 'viewer'];
}
function json_out($data, int $code = 200) {
  echo json_encode(['status' => $code, 'data' => $data]);
  exit;
}
""")
        with sqlite3.connect(self.root / "fixture.sqlite") as db:
            db.execute("""CREATE TABLE fp_landings (
                id INTEGER PRIMARY KEY, landing_date TEXT, species TEXT,
                volume REAL, unit TEXT, total_value REAL, truck_delivery INTEGER, status TEXT
            )""")
            db.executemany("INSERT INTO fp_landings VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
                (1, "2023-12-31", "Bangus", 1, "kg", 100, 0, "approved"),
                (2, "2024-01-01", "Bangus", 3, "kg", 300, 0, "approved"),
                (3, "2024-01-31", "Bangus", 2, "kg", 200, 0, "approved"),
                (4, "2024-02-01", "SUGPO (HIPON)", 10, "kg", 1000, 1, "approved"),
                (5, "2024-02-01", "Suahe", 20, "kg", 2000, 0, "pending"),
                (6, "2024-02-01", "Bangus", 999, "ton", 999999, 1, "rejected"),
                (7, "2024-02-02", "Bangus", .1, "ton", 5000, None, "approved"),
                (8, "2024-02-29", "GULUDAN (HIPON)", 5, "kg", 500, 1, "approved"),
                (9, "2024-03-01", "Kuakit", 7, "kg", 700, 0, "approved"),
            ])

    def request(self, year=2024, month=0, day=0):
        runner = """
$_SERVER['SCRIPT_FILENAME'] = $argv[1];
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = json_decode($argv[2], true);
require $argv[1];
"""
        result = subprocess.run(["php", "-r", runner, str(self.root / "dashboard.php"),
                                 json.dumps({"year": year, "month": month, "day": day})],
                                check=True, text=True, capture_output=True)
        return json.loads(result.stdout)

    def test_daily_totals_routes_species_and_previous_day(self):
        response = self.request(month=2, day=1)
        self.assertEqual(response["status"], 200)
        data = response["data"]
        self.assertEqual((data["total_landings"], data["total_volume"], data["total_value"]), (2, 30, 3000))
        self.assertEqual(data["pending_review"], 1)
        self.assertEqual(data["species_count"], 1)
        self.assertEqual(data["by_species"], [{"species": "HIPON", "volume": 30}])
        self.assertEqual(sum(row["volume"] for row in data["hipon_species"]), 30)
        self.assertEqual(data["by_route"]["land"]["value"], 1000)
        self.assertEqual(data["by_route"]["sea"]["value"], 2000)
        self.assertEqual(data["period_days"], 1)
        self.assertEqual(data["active_days"], 1)
        self.assertEqual(data["prev"]["total_value"], 200)
        self.assertEqual(data["compare_label"], "vs Jan 31, 2024")
        self.assertEqual(data["day"], 1)
        self.assertTrue(all(row["landing_date"] == "2024-02-01" for row in data["recent"]))

    def test_daily_filter_preserves_full_year_charts(self):
        data = self.request(month=2, day=1)["data"]
        self.assertEqual(len(data["by_month"]), 12)
        self.assertEqual(data["by_month"][1], {"month": 2, "landings": 4, "volume": 135, "amount": 8500})
        self.assertEqual(data["by_month"][2]["amount"], 700)

    def test_tons_and_empty_days(self):
        data = self.request(month=2, day=2)["data"]
        self.assertEqual(data["total_volume"], 100)
        self.assertEqual(data["prev"]["total_value"], 3000)
        empty = self.request(month=2, day=3)["data"]
        self.assertEqual(empty["total_value"], 0)
        self.assertEqual(empty["period_days"], 1)
        self.assertEqual(empty["active_days"], 0)
        self.assertEqual(empty["by_species"], [])
        self.assertEqual(empty["recent"], [])

    def test_calendar_boundaries_and_leap_day(self):
        self.assertEqual(self.request(month=1, day=1)["data"]["prev"]["total_value"], 100)
        self.assertEqual(self.request(month=3, day=1)["data"]["prev"]["total_value"], 500)
        leap = self.request(month=2, day=29)["data"]
        self.assertEqual(leap["total_value"], 500)
        self.assertEqual(leap["compare_label"], "vs Feb 28, 2024")

    def test_month_and_year_filters_count_only_days_with_landings(self):
        month = self.request(month=2)["data"]
        self.assertEqual(month["period_days"], 29)
        self.assertEqual(month["active_days"], 3)
        self.assertEqual(month["total_value"], 8500)
        self.assertEqual(month["day"], 0)
        year = self.request()["data"]
        self.assertEqual(year["period_days"], 366)
        self.assertEqual(year["active_days"], 6)
        self.assertEqual(year["total_value"], 9700)

    def test_invalid_dates_are_rejected(self):
        for year, month, day in [(2023, 2, 29), (2024, 4, 31), (2024, 0, 1), (2024, 2, -1), (2024, 2, 32)]:
            with self.subTest(year=year, month=month, day=day):
                self.assertEqual(self.request(year, month, day)["status"], 422)


if __name__ == "__main__":
    unittest.main()
