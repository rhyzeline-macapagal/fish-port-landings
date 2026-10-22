<?php
// ---- FILL THESE IN (copy DB values from your config.php) ----
$host = 'mysql-pondmate.alwaysdata.net';
$db   = 'pondmate_fishport';
$user = 'pondmate_epesomercedes_user';
$pass = 'Epeso2026db';

$accounts = [
  ['Admin User',   'admin2@fishport.local',   'admin',   'fishport2_admin2'],
];
// -------------------------------------------------------------

header('Content-Type: text/plain');
$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass,
  [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$cols = $pdo->query("SHOW COLUMNS FROM fp_users")->fetchAll(PDO::FETCH_COLUMN);
echo "Columns found: " . implode(', ', $cols) . "\n\n";

function pick(array $cols, array $needles) {
  foreach ($cols as $c) foreach ($needles as $n) if (stripos($c, $n) !== false) return $c;
  return null;
}
$cName  = pick($cols, ['full_name', 'name']);
$cEmail = pick($cols, ['email']);
$cPass  = pick($cols, ['pass']);
$cRole  = pick($cols, ['role']);

if (!$cEmail || !$cPass || !$cRole) {
  exit("Could not match email/password/role columns. Paste the 'Columns found' line to Claude.");
}

foreach ($accounts as [$name, $email, $role, $plain]) {
  $data = [$cEmail => $email, $cPass => password_hash($plain, PASSWORD_DEFAULT), $cRole => $role];
  if ($cName) $data[$cName] = $name;
  $sql = "INSERT INTO fp_users (" . implode(',', array_keys($data)) . ") VALUES (" .
         implode(',', array_fill(0, count($data), '?')) . ")";
  try {
    $pdo->prepare($sql)->execute(array_values($data));
    echo "Created $email ($role)\n";
  } catch (Exception $e) {
    echo "FAILED $email: " . $e->getMessage() . "\n";
  }
}
echo "\nDone. DELETE seed.php from the server now.\n";