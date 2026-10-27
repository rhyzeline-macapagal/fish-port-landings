<?php
require_once dirname($_SERVER['SCRIPT_FILENAME']) . '/helpers.php';
auth_user(['admin', 'encoder', 'viewer']);

$pdo = db();
$vol = "CASE WHEN unit = 'ton' THEN volume * 1000 ELSE volume END";
$tz  = new DateTimeZone('Asia/Manila');

// Totals for one date range (rejected landings excluded)
function fp_period_totals(PDO $pdo, string $vol, array $r): array {
  $st = $pdo->prepare(
    "SELECT COUNT(*) AS total_landings,
            COALESCE(SUM($vol), 0) AS total_volume,
            COALESCE(SUM(total_value), 0) AS total_value,
            COUNT(DISTINCT species) AS species_count
     FROM fp_landings
     WHERE status <> 'rejected' AND landing_date BETWEEN ? AND ?"
  );
  $st->execute($r);
  return $st->fetch();
}

// Selected year (defaults to the current year, Philippine time)
$today    = (new DateTimeImmutable('now', $tz))->setTime(0, 0);
$thisYear = (int)$today->format('Y');
$year     = (int)($_GET['year'] ?? $thisYear);
if ($year < 2000 || $year > 2100) $year = $thisYear;

// Selected month: 0 = whole year, 1-12 = that month
$month = (int)($_GET['month'] ?? 0);
if ($month < 1 || $month > 12) $month = 0;

// Current period and the period it is compared against
if ($month) {
  $start       = new DateTimeImmutable(sprintf('%d-%02d-01', $year, $month), $tz);
  $end         = $start->modify('last day of this month');
  $prevStart   = $start->modify('-1 month');
  $prevFullEnd = $prevStart->modify('last day of this month');
} else {
  $start       = new DateTimeImmutable("$year-01-01", $tz);
  $end         = new DateTimeImmutable("$year-12-31", $tz);
  $prevStart   = new DateTimeImmutable(($year - 1) . '-01-01', $tz);
  $prevFullEnd = new DateTimeImmutable(($year - 1) . '-12-31', $tz);
}

// If the period is still running, compare only the same number of days
$curEnd = min($end, $today);
if ($curEnd < $start) $curEnd = $start;
$partial = $curEnd < $end;
$prevEnd = min($prevStart->add($start->diff($curEnd)), $prevFullEnd);

$range     = [$start->format('Y-m-d'), $end->format('Y-m-d')];
$prevRange = [$prevStart->format('Y-m-d'), $prevEnd->format('Y-m-d')];

if ($month) {
  $compareLabel = $partial
    ? 'vs ' . $prevStart->format('M j') . '-' . $prevEnd->format('j, Y')
    : 'vs ' . $prevStart->format('F Y');
} else {
  $compareLabel = $partial
    ? 'vs ' . $prevStart->format('M j') . ' - ' . $prevEnd->format('M j, Y')
    : 'vs ' . ($year - 1);
}

// Years that have data, newest first (always includes the current year)
$years = array_map('intval', $pdo->query(
  'SELECT DISTINCT YEAR(landing_date) AS y FROM fp_landings
   WHERE landing_date IS NOT NULL ORDER BY y DESC'
)->fetchAll(PDO::FETCH_COLUMN));
if (!in_array($thisYear, $years, true)) {
  $years[] = $thisYear;
  rsort($years);
}

// Totals (current + previous period)
$out  = fp_period_totals($pdo, $vol, $range);
$out['prev'] = fp_period_totals($pdo, $vol, $prevRange);

// Pending review (selected period only)
$st = $pdo->prepare(
  "SELECT COUNT(*) FROM fp_landings
   WHERE status = 'pending' AND landing_date BETWEEN ? AND ?"
);
$st->execute($range);
$out['pending_review'] = (int)$st->fetchColumn();

// Land and sea totals for the selected reporting period. A truck delivery is land;
// records without truck delivery are sea, matching the landing list convention.
$st = $pdo->prepare(
  "SELECT
      SUM(CASE WHEN truck_delivery = 1 THEN 1 ELSE 0 END) AS landings_land,
      SUM(CASE WHEN truck_delivery <> 1 OR truck_delivery IS NULL THEN 1 ELSE 0 END) AS landings_sea,
      COALESCE(SUM(CASE WHEN truck_delivery = 1 THEN total_value ELSE 0 END), 0) AS value_land,
      COALESCE(SUM(CASE WHEN truck_delivery <> 1 OR truck_delivery IS NULL THEN total_value ELSE 0 END), 0) AS value_sea,
      COALESCE(SUM(CASE WHEN truck_delivery = 1 THEN $vol ELSE 0 END), 0) AS weight_land,
      COALESCE(SUM(CASE WHEN truck_delivery <> 1 OR truck_delivery IS NULL THEN $vol ELSE 0 END), 0) AS weight_sea
   FROM fp_landings
   WHERE status <> 'rejected' AND landing_date BETWEEN ? AND ?"
);
$st->execute($range);
$route = $st->fetch() ?: [];
$out['by_route'] = [
  'land' => [
    'landings' => (int)($route['landings_land'] ?? 0),
    'value'    => (float)($route['value_land'] ?? 0),
    'weight'   => (float)($route['weight_land'] ?? 0),
  ],
  'sea' => [
    'landings' => (int)($route['landings_sea'] ?? 0),
    'value'    => (float)($route['value_sea'] ?? 0),
    'weight'   => (float)($route['weight_sea'] ?? 0),
  ],
];
$out['period_days'] = $start->diff($end)->days + 1;

// Volume by species (all species)
$st = $pdo->prepare(
  "SELECT species, SUM($vol) AS volume
   FROM fp_landings
   WHERE status <> 'rejected' AND landing_date BETWEEN ? AND ?
   GROUP BY species ORDER BY volume DESC"
);
$st->execute($range);
$out['by_species'] = $st->fetchAll();

// Month-by-month totals for the whole selected year (chart, sparklines, month chips)
$st = $pdo->prepare(
  "SELECT MONTH(landing_date) AS m,
          COUNT(*) AS landings,
          COALESCE(SUM($vol), 0) AS volume,
          COALESCE(SUM(total_value), 0) AS amount
   FROM fp_landings
   WHERE status <> 'rejected' AND landing_date BETWEEN ? AND ?
   GROUP BY m"
);
$st->execute(["$year-01-01", "$year-12-31"]);
$byM = [];
foreach ($st->fetchAll() as $r) $byM[(int)$r['m']] = $r;
$out['by_month'] = [];
for ($m = 1; $m <= 12; $m++) {
  $out['by_month'][] = [
    'month'    => $m,
    'landings' => (int)($byM[$m]['landings'] ?? 0),
    'volume'   => (float)($byM[$m]['volume'] ?? 0),
    'amount'   => (float)($byM[$m]['amount'] ?? 0),
  ];
}

// Latest entries
$st = $pdo->prepare(
  "SELECT * FROM fp_landings
   WHERE landing_date BETWEEN ? AND ?
   ORDER BY landing_date DESC, id DESC LIMIT 5"
);
$st->execute($range);
$out['recent'] = $st->fetchAll();

$out['year']          = $year;
$out['month']         = $month;
$out['compare_label'] = $compareLabel;
$out['years']         = $years;

json_out($out);