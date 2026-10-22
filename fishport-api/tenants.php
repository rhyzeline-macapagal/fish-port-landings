<?php
require_once __DIR__ . '/helpers.php';

const TENANT_CATEGORIES = [
  'fish_dealer', 'fish_broker', 'cold_storage_ice', 'retail_fish_seafood',
  'fish_drying', 'fish_smoking', 'commercial_vessel_above_3t',
  'commercial_vessel_below_3t', 'marine_products', 'marine_fishing_supply',
  'carinderia_eatery',
];
const TENANT_SIZES = ['small', 'big'];
const TENANT_COLUMNS = 'id, category, permit_number, broker_size, business_name, owner_name, contact_number,
                        stall_no, address, application_status, status, remarks, created_at, updated_at';

function tenant_schema(): void {
  db()->exec(
    "CREATE TABLE IF NOT EXISTS fp_tenants (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      category VARCHAR(64) NOT NULL,
      permit_number VARCHAR(100) NULL,
      broker_size VARCHAR(10) NULL,
      business_name VARCHAR(180) NOT NULL,
      owner_name VARCHAR(180) NULL,
      contact_number VARCHAR(80) NULL,
      stall_no VARCHAR(80) NULL,
      address VARCHAR(255) NULL,
      application_status VARCHAR(20) NOT NULL DEFAULT 'pending',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      remarks TEXT NULL,
      created_by INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant_category (category),
      INDEX idx_tenant_business (business_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  );

  // Older installations used a three-value ENUM. Expand it without losing records.
  $column = db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'category'")->fetch();
  $type = strtolower((string)($column['Type'] ?? ''));
  if (!preg_match('/^varchar\((\d+)\)/', $type, $match) || (int)$match[1] < 64) {
    db()->exec('ALTER TABLE fp_tenants MODIFY category VARCHAR(64) NOT NULL');
  }
  if (!db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'permit_number'")->fetch()) {
    db()->exec('ALTER TABLE fp_tenants ADD permit_number VARCHAR(100) NULL AFTER category');
  }
  if (!db()->query("SHOW COLUMNS FROM fp_tenants LIKE 'application_status'")->fetch()) {
    db()->exec("ALTER TABLE fp_tenants ADD application_status VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER address");
  }
  db()->exec("UPDATE fp_tenants SET category = 'retail_fish_seafood' WHERE category = 'retailer'");
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

  return [
    'category' => $category,
    'permit_number' => $optional('permit_number'),
    'broker_size' => $size,
    'business_name' => $name,
    'owner_name' => $optional('owner_name'),
    'contact_number' => $optional('contact_number'),
    'stall_no' => $optional('stall_no'),
    'address' => $optional('address'),
    'application_status' => in_array(($body['application_status'] ?? ''), ['pending', 'approved', 'rejected'], true)
      ? $body['application_status'] : 'pending',
    'status' => ($body['status'] ?? 'active') === 'inactive' ? 'inactive' : 'active',
    'remarks' => $optional('remarks'),
  ];
}

function find_tenant(int $id): ?array {
  $statement = db()->prepare('SELECT ' . TENANT_COLUMNS . ' FROM fp_tenants WHERE id = ?');
  $statement->execute([$id]);
  return $statement->fetch() ?: null;
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
    $where[] = '(permit_number LIKE ? OR business_name LIKE ? OR owner_name LIKE ? OR contact_number LIKE ? OR stall_no LIKE ? OR address LIKE ?)';
    $term = '%' . addcslashes($query, '%_\\') . '%';
    array_push($params, $term, $term, $term, $term, $term, $term);
  }
  $sql = 'SELECT ' . TENANT_COLUMNS . ' FROM fp_tenants';
  if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
  $sql .= ' ORDER BY business_name ASC';
  $statement = db()->prepare($sql);
  $statement->execute($params);
  json_out($statement->fetchAll());
}

if ($method === 'POST') {
  $user = auth_user(['admin', 'encoder']);
  $data = clean_tenant(body());
  db()->prepare(
    'INSERT INTO fp_tenants
      (category, permit_number, broker_size, business_name, owner_name, contact_number,
       stall_no, address, application_status, status, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )->execute([
    $data['category'], $data['permit_number'], $data['broker_size'], $data['business_name'],
    $data['owner_name'], $data['contact_number'], $data['stall_no'], $data['address'],
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
      contact_number = ?, stall_no = ?, address = ?, application_status = ?, status = ?, remarks = ? WHERE id = ?'
  )->execute([
    $data['category'], $data['permit_number'], $data['broker_size'], $data['business_name'],
    $data['owner_name'], $data['contact_number'], $data['stall_no'], $data['address'],
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
