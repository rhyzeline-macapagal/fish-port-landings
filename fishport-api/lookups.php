<?php
require_once __DIR__ . '/helpers.php';

$tables = ['species' => 'fp_species', 'brokers' => 'fp_brokers'];
$type = $_GET['type'] ?? '';
if (!isset($tables[$type])) json_out(['error' => 'Unknown list'], 422);
$table = $tables[$type];

auth_user(['admin', 'encoder']);
$pdo = db();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $names = $pdo->query("SELECT name FROM $table ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
  json_out(['names' => $names]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body();
  $name = trim(preg_replace('/\s+/', ' ', (string)($b['name'] ?? '')));
  if ($name === '' || mb_strlen($name) > 100) json_out(['error' => 'Invalid name'], 422);
  $pdo->prepare("INSERT IGNORE INTO $table (name) VALUES (?)")->execute([$name]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);