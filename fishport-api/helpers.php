<?php
require_once dirname($_SERVER['SCRIPT_FILENAME']) . '/config.php';
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originAllowed = in_array($origin, ALLOWED_ORIGINS, true)
  || (bool)preg_match('/^https:\/\/[a-z0-9-]+\.vercel\.app$/i', $origin);
if ($originAllowed) {
  header("Access-Control-Allow-Origin: $origin");
  header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

set_exception_handler(function ($e) {
  error_log($e->getMessage());
  http_response_code(500);
  echo json_encode(['error' => 'Server error']);
});

function db(): PDO {
  static $pdo = null;
  if (!$pdo) {
    $pdo = new PDO(
      'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
      DB_USER,
      DB_PASS,
      [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      ]
    );
  }
  return $pdo;
}

function json_out($data, int $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit;
}

function body(): array {
  return json_decode(file_get_contents('php://input'), true) ?? [];
}

function bearer_token(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$h && function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
      if (strtolower($k) === 'authorization') { $h = $v; break; }
    }
  }
  return preg_match('/Bearer\s+(\S+)/', $h, $m) ? $m[1] : null;
}

function auth_user(array $roles = []): array {
  $token = bearer_token();
  if (!$token) json_out(['error' => 'Unauthorized'], 401);

  $st = db()->prepare(
    'SELECT u.id, u.full_name, u.email, u.role
     FROM fp_auth_tokens t
     JOIN fp_users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.expires_at > NOW() AND u.is_active = 1'
  );
  $st->execute([hash('sha256', $token)]);
  $u = $st->fetch();

  if (!$u) json_out(['error' => 'Unauthorized'], 401);
  if ($roles && !in_array($u['role'], $roles, true)) json_out(['error' => 'Forbidden'], 403);
  return $u;
}