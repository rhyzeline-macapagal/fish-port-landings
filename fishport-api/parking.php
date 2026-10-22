<?php
require_once __DIR__ . '/helpers.php';

function parking_schema(): void {
  $pdo = db();
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS fp_vehicle_types (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS fp_parking_collections (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      collection_date DATE NOT NULL,
      vehicle_type_id INT UNSIGNED NULL,
      custom_vehicle_type VARCHAR(100) NULL,
      vehicle_count INT UNSIGNED NULL,
      rate_per_vehicle DECIMAL(12,2) NULL,
      total_collection DECIMAL(14,2) NOT NULL,
      is_manual_total TINYINT(1) NOT NULL DEFAULT 0,
      or_number VARCHAR(100) NULL,
      remarks TEXT NULL,
      created_by INT UNSIGNED NOT NULL,
      updated_by INT UNSIGNED NULL,
      deleted_by INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      INDEX idx_parking_date (collection_date),
      INDEX idx_parking_vehicle (vehicle_type_id),
      INDEX idx_parking_creator (created_by),
      INDEX idx_parking_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );
  $seed = ['Tricycle', 'Hauler', 'Motorcycle', 'Four-Wheel Vehicle', 'Delivery Truck', 'Other'];
  $st = $pdo->prepare('INSERT IGNORE INTO fp_vehicle_types (name) VALUES (?)');
  foreach ($seed as $name) $st->execute([$name]);
}

function parking_date($value): ?string {
  $value = trim((string)$value);
  $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
  return $date && $date->format('Y-m-d') === $value ? $value : null;
}

function parking_filters(array $g): array {
  $where = ['p.deleted_at IS NULL'];
  $params = [];
  if (!empty($g['date']) && ($date = parking_date($g['date']))) {
    $where[] = 'p.collection_date = ?'; $params[] = $date;
  } else {
    if (!empty($g['from']) && ($date = parking_date($g['from']))) { $where[] = 'p.collection_date >= ?'; $params[] = $date; }
    if (!empty($g['to']) && ($date = parking_date($g['to']))) { $where[] = 'p.collection_date <= ?'; $params[] = $date; }
    $year = (int)($g['year'] ?? 0);
    $month = (int)($g['month'] ?? 0);
    if ($year >= 2000 && $year <= 2100) {
      if ($month >= 1 && $month <= 12) {
        $start = sprintf('%04d-%02d-01', $year, $month);
        $end = (new DateTimeImmutable($start))->modify('last day of this month')->format('Y-m-d');
        $where[] = 'p.collection_date BETWEEN ? AND ?'; array_push($params, $start, $end);
      } else {
        $where[] = 'p.collection_date BETWEEN ? AND ?'; array_push($params, "$year-01-01", "$year-12-31");
      }
    }
  }
  $vehicle = (int)($g['vehicle_type_id'] ?? 0);
  if ($vehicle > 0) { $where[] = 'p.vehicle_type_id = ?'; $params[] = $vehicle; }
  $creator = (int)($g['recorded_by'] ?? 0);
  if ($creator > 0) { $where[] = 'p.created_by = ?'; $params[] = $creator; }
  $q = trim((string)($g['q'] ?? ''));
  if ($q !== '') { $where[] = 'p.or_number LIKE ?'; $params[] = '%' . addcslashes($q, '%_\\') . '%'; }
  return [implode(' AND ', $where), $params];
}

function parking_record(int $id): ?array {
  $st = db()->prepare(
    "SELECT p.*, COALESCE(NULLIF(p.custom_vehicle_type, ''), v.name, 'Unallocated') AS vehicle_type,
            cu.full_name AS recorded_by_name, uu.full_name AS updated_by_name
     FROM fp_parking_collections p
     LEFT JOIN fp_vehicle_types v ON v.id = p.vehicle_type_id
     LEFT JOIN fp_users cu ON cu.id = p.created_by
     LEFT JOIN fp_users uu ON uu.id = p.updated_by
     WHERE p.id = ? AND p.deleted_at IS NULL"
  );
  $st->execute([$id]);
  return $st->fetch() ?: null;
}

function clean_parking(array $b): array {
  $date = parking_date($b['collection_date'] ?? '');
  if (!$date) json_out(['error' => 'A valid collection date is required'], 422);

  $typeId = (int)($b['vehicle_type_id'] ?? 0);
  if ($typeId <= 0) json_out(['error' => 'Vehicle type is required'], 422);
  $st = db()->prepare('SELECT name FROM fp_vehicle_types WHERE id = ? AND is_active = 1');
  $st->execute([$typeId]);
  $typeName = $st->fetchColumn();
  if (!$typeName) json_out(['error' => 'Vehicle type is not available'], 422);

  $custom = trim((string)($b['custom_vehicle_type'] ?? ''));
  if (strcasecmp((string)$typeName, 'Other') === 0 && $custom === '') {
    json_out(['error' => 'Enter the custom vehicle type'], 422);
  }
  if (strcasecmp((string)$typeName, 'Other') !== 0) $custom = '';

  $manual = !empty($b['is_manual_total']);
  $count = $b['vehicle_count'] === '' || $b['vehicle_count'] === null ? null : filter_var($b['vehicle_count'], FILTER_VALIDATE_INT);
  $rate = $b['rate_per_vehicle'] === '' || $b['rate_per_vehicle'] === null ? null : (float)$b['rate_per_vehicle'];
  if ($count !== null && ($count === false || $count < 0)) json_out(['error' => 'Vehicle count must be a nonnegative whole number'], 422);
  if ($rate !== null && $rate < 0) json_out(['error' => 'Rate cannot be negative'], 422);

  if ($manual) {
    if (!isset($b['total_collection']) || $b['total_collection'] === '' || !is_numeric($b['total_collection'])) {
      json_out(['error' => 'Enter the total collection'], 422);
    }
    $total = round((float)$b['total_collection'], 2);
    if ($total < 0) json_out(['error' => 'Total collection cannot be negative'], 422);
  } else {
    if ($count === null || $rate === null) json_out(['error' => 'Vehicle count and rate are required for automatic totals'], 422);
    $total = round($count * $rate, 2);
  }

  $optional = fn(string $key) => trim((string)($b[$key] ?? '')) ?: null;
  return [
    'collection_date' => $date, 'vehicle_type_id' => $typeId,
    'custom_vehicle_type' => $custom ?: null, 'vehicle_count' => $count,
    'rate_per_vehicle' => $rate, 'total_collection' => $total,
    'is_manual_total' => $manual ? 1 : 0, 'or_number' => $optional('or_number'),
    'remarks' => $optional('remarks'),
  ];
}

parking_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$resource = (string)($_GET['resource'] ?? 'records');

if ($resource === 'types') {
  if ($method === 'GET') {
    auth_user();
    json_out(db()->query('SELECT id, name, is_active FROM fp_vehicle_types ORDER BY name')->fetchAll());
  }
  if ($method === 'POST') {
    auth_user(['admin', 'encoder']);
    $name = trim((string)(body()['name'] ?? ''));
    if ($name === '') json_out(['error' => 'Vehicle type name is required'], 422);
    try { db()->prepare('INSERT INTO fp_vehicle_types (name) VALUES (?)')->execute([$name]); }
    catch (PDOException $e) { json_out(['error' => 'That vehicle type already exists'], 409); }
    json_out(['id' => (int)db()->lastInsertId(), 'name' => $name, 'is_active' => 1], 201);
  }
  if ($method === 'PUT') {
    auth_user(['admin', 'encoder']);
    $b = body(); $id = (int)($b['id'] ?? 0); $name = trim((string)($b['name'] ?? ''));
    if (!$id || $name === '') json_out(['error' => 'Vehicle type and name are required'], 422);
    try {
      db()->prepare('UPDATE fp_vehicle_types SET name = ?, is_active = ? WHERE id = ?')
        ->execute([$name, !empty($b['is_active']) ? 1 : 0, $id]);
    } catch (PDOException $e) { json_out(['error' => 'That vehicle type already exists'], 409); }
    json_out(['ok' => true]);
  }
  json_out(['error' => 'Method not allowed'], 405);
}

if ($method === 'GET') {
  auth_user();
  [$where, $params] = parking_filters($_GET);
  $page = max(1, (int)($_GET['page'] ?? 1));
  $limit = min(5000, max(1, (int)($_GET['limit'] ?? 50)));
  $offset = ($page - 1) * $limit;

  $count = db()->prepare("SELECT COUNT(*) FROM fp_parking_collections p WHERE $where");
  $count->execute($params);
  $totalRows = (int)$count->fetchColumn();

  $st = db()->prepare(
    "SELECT p.*, COALESCE(NULLIF(p.custom_vehicle_type, ''), v.name, 'Unallocated') AS vehicle_type,
            cu.full_name AS recorded_by_name, uu.full_name AS updated_by_name
     FROM fp_parking_collections p
     LEFT JOIN fp_vehicle_types v ON v.id = p.vehicle_type_id
     LEFT JOIN fp_users cu ON cu.id = p.created_by
     LEFT JOIN fp_users uu ON uu.id = p.updated_by
     WHERE $where ORDER BY p.collection_date DESC, p.created_at DESC LIMIT $limit OFFSET $offset"
  );
  $st->execute($params);

  $today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
  $thisMonth = substr($today, 0, 7);
  $thisYear = substr($today, 0, 4);
  $cards = db()->query(
    "SELECT
      COALESCE(SUM(CASE WHEN collection_date = '$today' THEN total_collection ELSE 0 END), 0) AS today_collection,
      COALESCE(SUM(CASE WHEN collection_date = '$today' THEN vehicle_count ELSE 0 END), 0) AS today_vehicles,
      COALESCE(SUM(CASE WHEN DATE_FORMAT(collection_date, '%Y-%m') = '$thisMonth' THEN total_collection ELSE 0 END), 0) AS month_collection,
      COALESCE(SUM(CASE WHEN YEAR(collection_date) = $thisYear THEN total_collection ELSE 0 END), 0) AS year_collection
     FROM fp_parking_collections WHERE deleted_at IS NULL"
  )->fetch();

  $summarySt = db()->prepare(
    "SELECT COUNT(*) AS entries, COALESCE(SUM(p.vehicle_count), 0) AS vehicles,
            COALESCE(SUM(p.total_collection), 0) AS collection,
            COUNT(DISTINCT p.collection_date) AS active_days
     FROM fp_parking_collections p WHERE $where"
  );
  $summarySt->execute($params); $summary = $summarySt->fetch();
  $summary['average_daily'] = (int)$summary['active_days'] > 0
    ? round((float)$summary['collection'] / (int)$summary['active_days'], 2) : 0;

  $days = db()->prepare(
    "SELECT p.collection_date AS date, SUM(p.total_collection) AS collection
     FROM fp_parking_collections p WHERE $where
     GROUP BY p.collection_date ORDER BY collection DESC"
  );
  $days->execute($params); $dayRows = $days->fetchAll();
  $summary['highest_day'] = $dayRows[0] ?? null;
  $summary['lowest_day'] = $dayRows ? $dayRows[count($dayRows) - 1] : null;

  $year = (int)($_GET['year'] ?? $thisYear);
  if ($year < 2000 || $year > 2100) $year = (int)$thisYear;
  $vehicleClause = '';
  $vehicleParams = ["$year-01-01", "$year-12-31"];
  if ((int)($_GET['vehicle_type_id'] ?? 0) > 0) {
    $vehicleClause = ' AND p.vehicle_type_id = ?'; $vehicleParams[] = (int)$_GET['vehicle_type_id'];
  }
  $monthlySt = db()->prepare(
    "SELECT MONTH(p.collection_date) AS month, COALESCE(SUM(p.vehicle_count), 0) AS vehicles,
            COALESCE(SUM(p.total_collection), 0) AS collection
     FROM fp_parking_collections p
     WHERE p.deleted_at IS NULL AND p.collection_date BETWEEN ? AND ? $vehicleClause GROUP BY month"
  );
  $monthlySt->execute($vehicleParams); $monthMap = [];
  foreach ($monthlySt->fetchAll() as $row) $monthMap[(int)$row['month']] = $row;
  $monthly = [];
  for ($m = 1; $m <= 12; $m++) $monthly[] = [
    'month' => $m, 'vehicles' => (int)($monthMap[$m]['vehicles'] ?? 0),
    'collection' => (float)($monthMap[$m]['collection'] ?? 0),
  ];

  $compareMonth = (int)($_GET['month'] ?? 0);
  if ($compareMonth < 1 || $compareMonth > 12) {
    $compareMonth = $year === (int)$thisYear ? (int)substr($today, 5, 2) : 12;
  }
  $currentAmount = (float)$monthly[$compareMonth - 1]['collection'];
  if ($compareMonth > 1) {
    $previousAmount = (float)$monthly[$compareMonth - 2]['collection'];
  } else {
    $previousYear = $year - 1;
    $previousParams = ["$previousYear-12-01", "$previousYear-12-31"];
    $previousSt = db()->prepare(
      "SELECT COALESCE(SUM(p.total_collection), 0)
       FROM fp_parking_collections p
       WHERE p.deleted_at IS NULL AND p.collection_date BETWEEN ? AND ? $vehicleClause"
    );
    if ($vehicleClause !== '') $previousParams[] = (int)$_GET['vehicle_type_id'];
    $previousSt->execute($previousParams);
    $previousAmount = (float)$previousSt->fetchColumn();
  }
  $difference = $currentAmount - $previousAmount;
  $comparison = [
    'month' => $compareMonth, 'current' => $currentAmount, 'previous' => $previousAmount,
    'difference' => $difference,
    'percent' => $previousAmount > 0 ? round(($difference / $previousAmount) * 100, 1) : null,
  ];

  $byType = db()->prepare(
    "SELECT COALESCE(NULLIF(p.custom_vehicle_type, ''), v.name, 'Unallocated') AS vehicle_type,
            COALESCE(SUM(p.vehicle_count), 0) AS vehicles, SUM(p.total_collection) AS collection
     FROM fp_parking_collections p LEFT JOIN fp_vehicle_types v ON v.id = p.vehicle_type_id
     WHERE $where GROUP BY vehicle_type ORDER BY collection DESC"
  );
  $byType->execute($params);

  $recorders = db()->query(
    "SELECT DISTINCT u.id, u.full_name FROM fp_parking_collections p
     JOIN fp_users u ON u.id = p.created_by WHERE p.deleted_at IS NULL ORDER BY u.full_name"
  )->fetchAll();
  $types = db()->query('SELECT id, name, is_active FROM fp_vehicle_types WHERE is_active = 1 ORDER BY name')->fetchAll();
  $years = array_map('intval', db()->query(
    'SELECT DISTINCT YEAR(collection_date) FROM fp_parking_collections WHERE deleted_at IS NULL ORDER BY 1 DESC'
  )->fetchAll(PDO::FETCH_COLUMN));
  if (!in_array((int)$thisYear, $years, true)) array_unshift($years, (int)$thisYear);

  json_out([
    'records' => $st->fetchAll(), 'total' => $totalRows, 'page' => $page, 'limit' => $limit,
    'cards' => $cards, 'summary' => $summary, 'monthly' => $monthly,
    'comparison' => $comparison, 'by_type' => $byType->fetchAll(), 'daily' => array_reverse($dayRows),
    'types' => $types, 'recorders' => $recorders, 'years' => $years, 'year' => $year,
  ]);
}

if ($method === 'POST') {
  $user = auth_user(['admin', 'encoder']); $d = clean_parking(body());
  db()->prepare(
    'INSERT INTO fp_parking_collections
      (collection_date, vehicle_type_id, custom_vehicle_type, vehicle_count, rate_per_vehicle,
       total_collection, is_manual_total, or_number, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )->execute([
    $d['collection_date'], $d['vehicle_type_id'], $d['custom_vehicle_type'], $d['vehicle_count'],
    $d['rate_per_vehicle'], $d['total_collection'], $d['is_manual_total'], $d['or_number'],
    $d['remarks'], $user['id'],
  ]);
  json_out(parking_record((int)db()->lastInsertId()), 201);
}

if ($method === 'PUT') {
  $user = auth_user(['admin', 'encoder']); $b = body(); $id = (int)($b['id'] ?? 0);
  if (!$id || !parking_record($id)) json_out(['error' => 'Parking record not found'], 404);
  $d = clean_parking($b);
  db()->prepare(
    'UPDATE fp_parking_collections SET collection_date = ?, vehicle_type_id = ?, custom_vehicle_type = ?,
      vehicle_count = ?, rate_per_vehicle = ?, total_collection = ?, is_manual_total = ?,
      or_number = ?, remarks = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL'
  )->execute([
    $d['collection_date'], $d['vehicle_type_id'], $d['custom_vehicle_type'], $d['vehicle_count'],
    $d['rate_per_vehicle'], $d['total_collection'], $d['is_manual_total'], $d['or_number'],
    $d['remarks'], $user['id'], $id,
  ]);
  json_out(parking_record($id));
}

if ($method === 'DELETE') {
  $user = auth_user(['admin']); $id = (int)($_GET['id'] ?? 0);
  if (!$id || !parking_record($id)) json_out(['error' => 'Parking record not found'], 404);
  db()->prepare('UPDATE fp_parking_collections SET deleted_at = NOW(), deleted_by = ? WHERE id = ?')
    ->execute([$user['id'], $id]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);
