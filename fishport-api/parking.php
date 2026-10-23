<?php
require_once __DIR__ . '/helpers.php';

function parking_schema(): void {
  db()->exec(
    "CREATE TABLE IF NOT EXISTS fp_parking_collections (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      collection_date DATE NOT NULL,
      total_collection DECIMAL(14,2) NOT NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_parking_date (collection_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
}

function parking_date($value): ?string {
  $value = trim((string)$value);
  $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
  return $date && $date->format('Y-m-d') === $value ? $value : null;
}

function parking_filters(array $input): array {
  $where = ['1 = 1'];
  $params = [];

  if (!empty($input['date']) && ($date = parking_date($input['date']))) {
    $where[] = 'p.collection_date = ?';
    $params[] = $date;
  } else {
    if (!empty($input['from']) && ($date = parking_date($input['from']))) {
      $where[] = 'p.collection_date >= ?';
      $params[] = $date;
    }
    if (!empty($input['to']) && ($date = parking_date($input['to']))) {
      $where[] = 'p.collection_date <= ?';
      $params[] = $date;
    }

    $year = (int)($input['year'] ?? 0);
    $month = (int)($input['month'] ?? 0);
    if ($year >= 2000 && $year <= 2100) {
      if ($month >= 1 && $month <= 12) {
        $start = sprintf('%04d-%02d-01', $year, $month);
        $end = (new DateTimeImmutable($start))->modify('last day of this month')->format('Y-m-d');
        $where[] = 'p.collection_date BETWEEN ? AND ?';
        array_push($params, $start, $end);
      } else {
        $where[] = 'p.collection_date BETWEEN ? AND ?';
        array_push($params, "$year-01-01", "$year-12-31");
      }
    }
  }

  $query = trim((string)($input['q'] ?? ''));
  if ($query !== '') {
    $where[] = 'COALESCE(p.remarks, \'\') LIKE ?';
    $params[] = '%' . addcslashes($query, '%_\\') . '%';
  }

  return [implode(' AND ', $where), $params];
}

function parking_select_columns(): string {
  // Compatibility aliases allow an older frontend to read the simplified rows.
  return "p.id, p.collection_date, p.total_collection, p.remarks, p.created_at,
          NULL AS vehicle_type_id, 'Parking collection' AS vehicle_type,
          NULL AS custom_vehicle_type, NULL AS vehicle_count, NULL AS rate_per_vehicle,
          1 AS is_manual_total, NULL AS or_number, '' AS recorded_by_name,
          NULL AS updated_by_name, p.created_at AS updated_at";
}

function parking_record(int $id): ?array {
  $columns = parking_select_columns();
  $statement = db()->prepare("SELECT $columns FROM fp_parking_collections p WHERE p.id = ?");
  $statement->execute([$id]);
  return $statement->fetch() ?: null;
}

function clean_parking(array $input): array {
  $date = parking_date($input['collection_date'] ?? '');
  if (!$date) json_out(['error' => 'A valid collection date is required'], 422);

  if (!isset($input['total_collection']) || $input['total_collection'] === '' || !is_numeric($input['total_collection'])) {
    json_out(['error' => 'Enter the total collection'], 422);
  }
  $total = round((float)$input['total_collection'], 2);
  if ($total < 0) json_out(['error' => 'Total collection cannot be negative'], 422);

  $remarks = trim((string)($input['remarks'] ?? ''));
  return [
    'collection_date' => $date,
    'total_collection' => $total,
    'remarks' => $remarks !== '' ? $remarks : null,
  ];
}

parking_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  auth_user();
  [$where, $params] = parking_filters($_GET);
  $page = max(1, (int)($_GET['page'] ?? 1));
  $limit = min(5000, max(1, (int)($_GET['limit'] ?? 50)));
  $offset = ($page - 1) * $limit;

  $count = db()->prepare("SELECT COUNT(*) FROM fp_parking_collections p WHERE $where");
  $count->execute($params);
  $totalRows = (int)$count->fetchColumn();

  $columns = parking_select_columns();
  $records = db()->prepare(
    "SELECT $columns FROM fp_parking_collections p
     WHERE $where ORDER BY p.collection_date DESC, p.id DESC LIMIT $limit OFFSET $offset"
  );
  $records->execute($params);

  $today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
  $thisMonth = substr($today, 0, 7);
  $thisYear = (int)substr($today, 0, 4);
  $cards = db()->query(
    "SELECT
      COALESCE(SUM(CASE WHEN collection_date = '$today' THEN total_collection ELSE 0 END), 0) AS today_collection,
      0 AS today_vehicles,
      COALESCE(SUM(CASE WHEN DATE_FORMAT(collection_date, '%Y-%m') = '$thisMonth' THEN total_collection ELSE 0 END), 0) AS month_collection,
      COALESCE(SUM(CASE WHEN YEAR(collection_date) = $thisYear THEN total_collection ELSE 0 END), 0) AS year_collection
     FROM fp_parking_collections"
  )->fetch();

  $summaryStatement = db()->prepare(
    "SELECT COUNT(*) AS entries, 0 AS vehicles,
            COALESCE(SUM(p.total_collection), 0) AS collection,
            COUNT(DISTINCT p.collection_date) AS active_days
     FROM fp_parking_collections p WHERE $where"
  );
  $summaryStatement->execute($params);
  $summary = $summaryStatement->fetch();
  $summary['average_daily'] = (int)$summary['active_days'] > 0
    ? round((float)$summary['collection'] / (int)$summary['active_days'], 2)
    : 0;

  $days = db()->prepare(
    "SELECT p.collection_date AS date, SUM(p.total_collection) AS collection
     FROM fp_parking_collections p WHERE $where
     GROUP BY p.collection_date ORDER BY p.collection_date ASC"
  );
  $days->execute($params);
  $dayRows = $days->fetchAll();
  $summary['highest_day'] = null;
  $summary['lowest_day'] = null;
  foreach ($dayRows as $row) {
    if ($summary['highest_day'] === null || (float)$row['collection'] > (float)$summary['highest_day']['collection']) {
      $summary['highest_day'] = $row;
    }
    if ($summary['lowest_day'] === null || (float)$row['collection'] < (float)$summary['lowest_day']['collection']) {
      $summary['lowest_day'] = $row;
    }
  }

  $year = (int)($_GET['year'] ?? $thisYear);
  if ($year < 2000 || $year > 2100) $year = $thisYear;
  $monthlyStatement = db()->prepare(
    "SELECT MONTH(collection_date) AS month, SUM(total_collection) AS collection
     FROM fp_parking_collections
     WHERE collection_date BETWEEN ? AND ? GROUP BY MONTH(collection_date)"
  );
  $monthlyStatement->execute(["$year-01-01", "$year-12-31"]);
  $monthMap = [];
  foreach ($monthlyStatement->fetchAll() as $row) $monthMap[(int)$row['month']] = $row;
  $monthly = [];
  for ($month = 1; $month <= 12; $month++) {
    $monthly[] = [
      'month' => $month,
      'vehicles' => 0,
      'collection' => (float)($monthMap[$month]['collection'] ?? 0),
    ];
  }

  $compareMonth = (int)($_GET['month'] ?? 0);
  if ($compareMonth < 1 || $compareMonth > 12) {
    $compareMonth = $year === $thisYear ? (int)substr($today, 5, 2) : 12;
  }
  $currentAmount = (float)$monthly[$compareMonth - 1]['collection'];
  if ($compareMonth > 1) {
    $previousAmount = (float)$monthly[$compareMonth - 2]['collection'];
  } else {
    $previousYear = $year - 1;
    $previousStatement = db()->prepare(
      'SELECT COALESCE(SUM(total_collection), 0) FROM fp_parking_collections WHERE collection_date BETWEEN ? AND ?'
    );
    $previousStatement->execute(["$previousYear-12-01", "$previousYear-12-31"]);
    $previousAmount = (float)$previousStatement->fetchColumn();
  }
  $difference = $currentAmount - $previousAmount;
  $comparison = [
    'month' => $compareMonth,
    'current' => $currentAmount,
    'previous' => $previousAmount,
    'difference' => $difference,
    'percent' => $previousAmount > 0 ? round(($difference / $previousAmount) * 100, 1) : null,
  ];

  $years = array_map('intval', db()->query(
    'SELECT DISTINCT YEAR(collection_date) FROM fp_parking_collections ORDER BY 1 DESC'
  )->fetchAll(PDO::FETCH_COLUMN));
  if (!in_array($thisYear, $years, true)) array_unshift($years, $thisYear);

  json_out([
    'records' => $records->fetchAll(),
    'total' => $totalRows,
    'page' => $page,
    'limit' => $limit,
    'cards' => $cards,
    'summary' => $summary,
    'monthly' => $monthly,
    'comparison' => $comparison,
    'by_type' => [],
    'daily' => $dayRows,
    'types' => [],
    'recorders' => [],
    'years' => $years,
    'year' => $year,
  ]);
}

if ($method === 'POST') {
  auth_user(['admin', 'encoder']);
  $data = clean_parking(body());
  db()->prepare(
    'INSERT INTO fp_parking_collections (collection_date, total_collection, remarks) VALUES (?, ?, ?)'
  )->execute([$data['collection_date'], $data['total_collection'], $data['remarks']]);
  json_out(parking_record((int)db()->lastInsertId()), 201);
}

if ($method === 'PUT') {
  auth_user(['admin', 'encoder']);
  $input = body();
  $id = (int)($input['id'] ?? 0);
  if (!$id || !parking_record($id)) json_out(['error' => 'Parking record not found'], 404);
  $data = clean_parking($input);
  db()->prepare(
    'UPDATE fp_parking_collections SET collection_date = ?, total_collection = ?, remarks = ? WHERE id = ?'
  )->execute([$data['collection_date'], $data['total_collection'], $data['remarks'], $id]);
  json_out(parking_record($id));
}

if ($method === 'DELETE') {
  auth_user(['admin']);
  $id = (int)($_GET['id'] ?? 0);
  if (!$id || !parking_record($id)) json_out(['error' => 'Parking record not found'], 404);
  db()->prepare('DELETE FROM fp_parking_collections WHERE id = ?')->execute([$id]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);
