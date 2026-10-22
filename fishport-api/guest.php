<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'Method not allowed'], 405);

$st = db()->prepare("SELECT id, full_name, email, role FROM fp_users WHERE email = ? AND role = 'viewer' AND is_active = 1");
$st->execute(['viewer@fishport.local']);
$u = $st->fetch();

if (!$u) json_out(['error' => 'Viewer access is not available'], 403);

$token = bin2hex(random_bytes(32));
db()->prepare(
  'INSERT INTO fp_auth_tokens (user_id, token_hash, expires_at)
   VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))'
)->execute([$u['id'], hash('sha256', $token)]);

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