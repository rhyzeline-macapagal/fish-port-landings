<?php
require_once __DIR__ . '/helpers.php';

$tables = ['species' => 'fp_species', 'brokers' => 'fp_brokers'];
$type = $_GET['type'] ?? '';
if (!isset($tables[$type])) json_out(['error' => 'Unknown list'], 422);
$table = $tables[$type];

auth_user(['admin', 'encoder']);
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  if ($type === 'brokers') {
    // Brokers now come from fp_tenants (fish_broker category)
    $names = $pdo->query(
      "SELECT business_name
         FROM fp_tenants
        WHERE category = 'fish_broker'
          AND business_name IS NOT NULL
          AND business_name <> ''
        ORDER BY business_name"
    )->fetchAll(PDO::FETCH_COLUMN);
  } else {
    $names = $pdo->query("SELECT name FROM $table ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
  }
  json_out(['names' => $names]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body();
  $name = trim(preg_replace('/\s+/', ' ', (string)($b['name'] ?? '')));
  if ($name === '' || mb_strlen($name) > 100) json_out(['error' => 'Invalid name'], 422);

  if ($type === 'brokers') {
    // Typed-in new broker: add it to fp_tenants as a fish_broker (no duplicates)
    $name = mb_strtoupper($name);
    $chk = $pdo->prepare(
      "SELECT id FROM fp_tenants WHERE category = 'fish_broker' AND business_name = ? LIMIT 1"
    );
    $chk->execute([$name]);
    if (!$chk->fetchColumn()) {
      $pdo->prepare(
        "INSERT INTO fp_tenants (category, business_name, status, created_at, updated_at)
         VALUES ('fish_broker', ?, 'active', NOW(), NOW())"
      )->execute([$name]);
    }
    json_out(['ok' => true]);
  }

  $pdo->prepare("INSERT IGNORE INTO $table (name) VALUES (?)")->execute([$name]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);