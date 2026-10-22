<?php
define('DB_HOST', 'mysql-pondmate.alwaysdata.net');
define('DB_NAME', 'pondmate_fishport');
define('DB_USER', 'pondmate_epesomercedes_user');
define('DB_PASS', 'Epeso2026db');
try {
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error', 'debug' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error', 'debug' => $e->getMessage()]);
}
// Frontend origins allowed to call this API (add your Vercel URL after deploying)
define('ALLOWED_ORIGINS', [
  'http://localhost:3000',
  // 'https://your-fishport.vercel.app',
]);

