<?php
require_once __DIR__ . '/helpers.php';

const TENANT_CATEGORIES = [
  'fish_dealer', 'fish_broker', 'cold_storage_ice', 'retail_fish_seafood',
  'fish_drying', 'fish_smoking', 'commercial_vessel_above_3t',
  'commercial_vessel_below_3t', 'marine_products', 'marine_fishing_supply',
  'carinderia_eatery',
];
const TENANT_API_VERSION = '2026-10-23-tenant-fix-v2';
const TENANT_SIZES = ['small', 'big'];
const TENANT_COLUMNS = 'id, category, permit_number, broker_size, business_name, owner_name, last_name, first_name, middle_name, contact_number,
                        stall_no, address, application_status, status, remarks, created_at, updated_at';

header('X-Tenants-Api-Version: ' . TENANT_API_VERSION);

function tenant_schema(): void {
  db()->exec(
    "CREATE TABLE IF NOT EXISTS fp_tenants (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(64) NOT NULL,
      permit_number VARCHAR(100) NULL,
      broker_size VARCHAR(10) NULL,
      business_name VARCHAR(180) NOT NULL,
      owner_name VARCHAR(180) NULL,
      last_name VARCHAR(100) NULL,
      first_name VARCHAR(100) NULL,
      middle_name VARCHAR(100) NULL,
      contact_number VARCHAR(80) NULL,
      stall_no VARCHAR(80) NULL,
      address VARCHAR(255) NULL,
      application_status VARCHAR(50) NOT NULL DEFAULT 'New',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      remarks TEXT NULL,
      created_by INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant_category (category),
      INDEX idx_tenant_business (business_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  // Older installations used an ENUM for category. Widen it first, before any category UPDATE.
  $column = db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'category'")->fetch();
  $type = strtolower((string)($column['Type'] ?? ''));
  if (!preg_match('/^varchar\((\d+)\)/', $type, $match) || (int)$match[1] < 64) {
    db()->exec('ALTER TABLE fp_tenants MODIFY category VARCHAR(64) NOT NULL');
  }

  if (!db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'permit_number'")->fetch()) {
    db()->exec('ALTER TABLE fp_tenants ADD permit_number VARCHAR(100) NULL AFTER category');
  }
  if (!db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'application_status'")->fetch()) {
    db()->exec("ALTER TABLE fp_tenants ADD application_status VARCHAR(50) NOT NULL DEFAULT 'New' AFTER address");
  }

  // Make sure the name columns exist.
  $nameColumns = ['last_name' => 'owner_name', 'first_name' => 'last_name', 'middle_name' => 'first_name'];
  foreach ($nameColumns as $name => $after) {
    if (!db()->query("SHOW COLUMNS FROM fp_tenants LIKE '$name'")->fetch()) {
      db()->exec("ALTER TABLE fp_tenants ADD $name VARCHAR(100) NULL AFTER $after");
    }
  }

  // Make sure application_status can hold values like "Renew".
  $statusColumn = db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'application_status'")->fetch();
  $statusType = strtolower((string)($statusColumn['Type'] ?? ''));
  if (!preg_match('/^varchar\((\d+)\)/', $statusType, $statusMatch) || (int)$statusMatch[1] < 50) {
    db()->exec("ALTER TABLE fp_tenants MODIFY application_status VARCHAR(50) NOT NULL DEFAULT 'New'");
  }

  // Copy values from legacy column names, if any exist.
  $columns = db()->query('SHOW COLUMNS FROM fp_tenants')->fetchAll(PDO::FETCH_COLUMN);
  $columnSet = array_fill_keys($columns, true);
  $legacyPermit = first_existing_column($columnSet, ['permit_no', 'permit', 'permit_id', 'permitnumber']);
  if ($legacyPermit) {
    db()->exec("UPDATE fp_tenants SET permit_number = NULLIF(TRIM(permit_number), '')");
    db()->exec("UPDATE fp_tenants SET permit_number = NULLIF(TRIM(`$legacyPermit`), '') WHERE permit_number IS NULL");
  }

  $legacyApplication = first_existing_column($columnSet, ['application', 'application_state', 'permit_status', 'permit_application_status']);
  if ($legacyApplication) {
    // Only fill rows that have no real status yet.
    db()->exec("UPDATE fp_tenants
      SET application_status = TRIM(`$legacyApplication`)
      WHERE TRIM(COALESCE(`$legacyApplication`, '')) <> ''
        AND (application_status IS NULL OR application_status = '' OR LOWER(application_status) = 'pending')");
  }

  // Rename old category names to the current ones (safe to repeat; does nothing once migrated).
  // fish_processor is not mapped here because it must be split into drying or smoking by hand.
  db()->exec("UPDATE fp_tenants SET category = CASE category
      WHEN 'retailer'        THEN 'retail_fish_seafood'
      WHEN 'vessel_below_3t' THEN 'commercial_vessel_below_3t'
      WHEN 'vessel_above_3t' THEN 'commercial_vessel_above_3t'
      WHEN 'fishing_supply'  THEN 'marine_fishing_supply'
      WHEN 'eatery'          THEN 'carinderia_eatery'
      ELSE category END
    WHERE category IN ('retailer', 'vessel_below_3t', 'vessel_above_3t', 'fishing_supply', 'eatery')");
}

function first_existing_column(array $columns, array $candidates): ?string {
  foreach ($candidates as $candidate) {
    if (isset($columns[$candidate])) return $candidate;
  }
  return null;
}

function tenant_output(array $tenant): array {
  $permit = $tenant['permit_number'] ?? $tenant['permit_no'] ?? $tenant['permit'] ?? null;
  $application = $tenant['application_status'] ?? $tenant['application'] ?? $tenant['permit_status'] ?? null;

  $tenant['permit_number'] = $permit !== null ? trim((string)$permit) : null;
  $tenant['application_status'] = $application !== null ? trim((string)$application) : null;
  return $tenant;
}

function clean_tenant(array $body): array {
  $category = trim((string)($body['category'] ?? ''));
  if (!in_array($category, TENANT_CATEGORIES, true)) {
    json_out(['error' => 'Invalid tenant group'], 422);
  }

  $size = $body['broker_size'] ?? null;
  if ($category === 'fish_broker') {
    if (!in_array($size, TENANT_SIZES, true)) {
      json_out(['error' => 'Broker size must be small or big'], 422);
    }
  } else {
    $size = null;
  }

  $name = trim((string)($body['business_name'] ?? ''));
  if ($name === '') json_out(['error' => 'Business or tenant name is required'], 422);

  $optional = function (string $key) use ($body) {
    $value = trim((string)($body[$key] ?? ''));
    return $value === '' ? null : $value;
  };

  $lastName = $optional('last_name');
  $firstName = $optional('first_name');
  $middleName = $optional('middle_name');

  // Keep owner_name in sync with the name parts when they are provided.
  $owner = $optional('owner_name');
  $composed = trim(implode(' ', array_filter([$firstName, $middleName, $lastName])));
  if ($composed !== '') $owner = $composed;

  // Any application status is accepted (New, Renew, pending, approved, ...).
  $application = $optional('application_status');
  $application = $application !== null ? mb_substr($application, 0, 50) : 'New';

  return [
    'category' => $category,
    'permit_number' => $optional('permit_number'),
    'broker_size' => $size,
    'business_name' => $name,
    'owner_name' => $owner,
    'last_name' => $lastName,
    'first_name' => $firstName,
    'middle_name' => $middleName,
    'contact_number' => $optional('contact_number'),
    'stall_no' => $optional('stall_no'),
    'address' => $optional('address'),
    'application_status' => $application,
    'status' => ($body['status'] ?? 'active') === 'inactive' ? 'inactive' : 'active',
    'remarks' => $optional('remarks'),
  ];
}

function find_tenant(int $id): ?array {
  $statement = db()->prepare('SELECT ' . TENANT_COLUMNS . ' FROM fp_tenants WHERE id = ?');
  $statement->execute([$id]);
  $tenant = $statement->fetch();
  return $tenant ? tenant_output($tenant) : null;
}

tenant_schema();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($method === 'GET') {
  auth_user();
  $where = [];
  $params = [];
  $category = trim((string)($_GET['category'] ?? ''));
  if ($category !== '') {
    if (!in_array($category, TENANT_CATEGORIES, true)) json_out(['error' => 'Invalid tenant group'], 422);
    $where[] = 'category = ?';
    $params[] = $category;
  }
  $query = trim((string)($_GET['q'] ?? ''));
  if ($query !== '') {
    $where[] = '(permit_number LIKE ? OR business_name LIKE ? OR owner_name LIKE ? OR last_name LIKE ? OR first_name LIKE ?
                 OR middle_name LIKE ? OR contact_number LIKE ? OR stall_no LIKE ? OR address LIKE ?)';
    $term = '%' . addcslashes($query, '%_\\') . '%';
    array_push($params, ...array_fill(0, 9, $term));
  }
  $sql = 'SELECT ' . TENANT_COLUMNS . ' FROM fp_tenants';
  if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
  $sql .= ' ORDER BY business_name ASC';
  $statement = db()->prepare($sql);
  $statement->execute($params);
  $rows = array_map('tenant_output', $statement->fetchAll());
  if (($_GET['debug'] ?? '') === '1') {
    json_out([
      'api_version' => TENANT_API_VERSION,
      'database' => db()->query('SELECT DATABASE()')->fetchColumn(),
      'total_rows' => (int)db()->query('SELECT COUNT(*) FROM fp_tenants')->fetchColumn(),
      'count' => count($rows),
      'sample' => $rows[0] ?? null,
      'rows' => $rows,
    ]);
  }
  json_out($rows);
}

if ($method === 'POST') {
  $user = auth_user(['admin', 'encoder']);
  $data = clean_tenant(body());
  db()->prepare(
    'INSERT INTO fp_tenants
      (category, permit_number, broker_size, business_name, owner_name, last_name, first_name, middle_name,
       contact_number, stall_no, address, application_status, status, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )->execute([
    $data['category'], $data['permit_number'], $data['broker_size'], $data['business_name'],
    $data['owner_name'], $data['last_name'], $data['first_name'], $data['middle_name'],
    $data['contact_number'], $data['stall_no'], $data['address'],
    $data['application_status'], $data['status'], $data['remarks'], $user['id'],
  ]);
  json_out(find_tenant((int)db()->lastInsertId()), 201);
}

if ($method === 'PUT') {
  auth_user(['admin', 'encoder']);
  if (!$id || !find_tenant($id)) json_out(['error' => 'Tenant not found'], 404);
  $data = clean_tenant(body());
  db()->prepare(
    'UPDATE fp_tenants SET category = ?, permit_number = ?, broker_size = ?, business_name = ?, owner_name = ?,
      last_name = ?, first_name = ?, middle_name = ?, contact_number = ?, stall_no = ?, address = ?,
      application_status = ?, status = ?, remarks = ? WHERE id = ?'
  )->execute([
    $data['category'], $data['permit_number'], $data['broker_size'], $data['business_name'],
    $data['owner_name'], $data['last_name'], $data['first_name'], $data['middle_name'],
    $data['contact_number'], $data['stall_no'], $data['address'],
    $data['application_status'], $data['status'], $data['remarks'], $id,
  ]);
  json_out(find_tenant($id));
}

if ($method === 'DELETE') {
  auth_user(['admin']);
  if (!$id || !find_tenant($id)) json_out(['error' => 'Tenant not found'], 404);
  db()->prepare('DELETE FROM fp_tenants WHERE id = ?')->execute([$id]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);