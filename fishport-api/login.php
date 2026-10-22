<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Method not allowed'], 405);

$b = body();
$st = db()->prepare('SELECT * FROM fp_users WHERE email = ? AND is_active = 1');
$st->execute([trim($b['email'] ?? '')]);
$u = $st->fetch();

if (!$u || !password_verify($b['password'] ?? '', $u['password_hash'])) {
  json_out(['error' => 'Invalid email or password'], 401);
}

$token = bin2hex(random_bytes(32));
db()->prepare(
  'INSERT INTO fp_auth_tokens (user_id, token_hash, expires_at)
   VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))'
)->execute([$u['id'], hash('sha256', $token)]);

// clean up expired tokens
db()->exec('DELETE FROM fp_auth_tokens WHERE expires_at < NOW()');

json_out([
  'token' => $token,
  'user' => [
    'id' => (int)$u['id'],
    'full_name' => $u['full_name'],
    'email' => $u['email'],
    'role' => $u['role'],
  ],
]);