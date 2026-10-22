<?php
require_once __DIR__ . '/helpers.php';

const TENANT_CATEGORIES = ['fish_broker', 'fish_dealer', 'retailer'];
const TENANT_SIZES = ['small', 'big'];
const TENANT_COLUMNS = 'id, category, broker_size, business_name, owner_name, contact_number,
                        stall_no, address, status, remarks, created_at, updated_at';

// Validate and normalize the request body for create/update.
function clean_tenant(array $b): array {
  $category = $b['category'] ?? '';
  if (!in_array($category, TENANT_CATEGORIES, true)) {
    json_out(['error' => 'Invalid category'], 422);
  }

  $size = $b['broker_size'] ?? null;
  if ($category === 'fish_broker') {
    if (!in_array($size, TENANT_SIZES, true)) {
      json_out(['error' => 'Broker size must be small or big'], 422);
    }
  } else {
    $size = null; // dealers and retailers have no size
  }

  $name = trim((string)($b['business_name'] ?? ''));
  if ($name === '') json_out(['error' => 'Business name is required'], 422);

  $opt = function (string $key) use ($b) {
    $v = trim((string)($b[$key] ?? ''));
    return $v === '' ? null : $v;
  };

  return [
    'category'       => $category,
    'broker_size'    => $size,
    'business_name'  => $name,
    'owner_name'     => $opt('owner_name'),
    'contact_number' => $opt('contact_number'),
    'stall_no'       => $opt('stall_no'),
    'address'        => $opt('address'),
    'status'         => ($b['status'] ?? 'active') === 'inactive' ? 'inactive' : 'active',
    'remarks'        => $opt('remarks'),
  ];
}

function find_tenant(int $id): ?array {
  $st = db()->prepare('SELECT ' . TENANT_COLUMNS . ' FROM fp_tenants WHERE id = ?');
  $st->execute([$id]);
  $row = $st->fetch();
  return $row ?: null;
}

$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// LIST: any logged-in user, including viewers
if ($method === 'GET') {
  auth_user();
  $rows = db()->query(
    'SELECT ' . TENANT_COLUMNS . ' FROM fp_tenants ORDER BY business_name ASC'
  )->fetchAll();
  json_out($rows);
}

// CREATE: admin and encoder only
if ($method === 'POST') {
  $u = auth_user(['admin', 'encoder']);
  $d = clean_tenant(body());

  db()->prepare(
    'INSERT INTO fp_tenants
       (category, broker_size, business_name, owner_name, contact_number,
        stall_no, address, status, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )->execute([
    $d['category'], $d['broker_size'], $d['business_name'], $d['owner_name'],
    $d['contact_number'], $d['stall_no'], $d['address'], $d['status'],
    $d['remarks'], $u['id'],
  ]);

  json_out(find_tenant((int)db()->lastInsertId()), 201);
}

// UPDATE: admin and encoder only
if ($method === 'PUT') {
  auth_user(['admin', 'encoder']);
  if (!$id || !find_tenant($id)) json_out(['error' => 'Tenant not found'], 404);
  $d = clean_tenant(body());

  db()->prepare(
    'UPDATE fp_tenants SET
       category = ?, broker_size = ?, business_name = ?, owner_name = ?,
       contact_number = ?, stall_no = ?, address = ?, status = ?, remarks = ?
     WHERE id = ?'
  )->execute([
    $d['category'], $d['broker_size'], $d['business_name'], $d['owner_name'],
    $d['contact_number'], $d['stall_no'], $d['address'], $d['status'],
    $d['remarks'], $id,
  ]);

  json_out(find_tenant($id));
}

// DELETE: admin only (add 'encoder' to the list if encoders should be able to delete too)
if ($method === 'DELETE') {
  auth_user(['admin']);
  if (!$id || !find_tenant($id)) json_out(['error' => 'Tenant not found'], 404);
  db()->prepare('DELETE FROM fp_tenants WHERE id = ?')->execute([$id]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);