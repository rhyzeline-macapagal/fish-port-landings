<?php
require_once __DIR__ . '/helpers.php';
$me = auth_user(['admin']);
$roles = ['admin', 'encoder', 'viewer'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  json_out(db()->query(
    'SELECT id, full_name, email, role, is_active, created_at FROM fp_users ORDER BY created_at DESC'
  )->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $b = body();
  $name = trim($b['full_name'] ?? '');
  $email = strtolower(trim($b['email'] ?? ''));
  $pass = $b['password'] ?? '';
  $role = $b['role'] ?? 'viewer';

  if ($name === '' || $email === '') json_out(['error' => 'Name and email are required'], 422);
  if (strlen($pass) < 8) json_out(['error' => 'Password must be at least 8 characters'], 422);
  if (!in_array($role, $roles, true)) json_out(['error' => 'Invalid role'], 422);

  $chk = db()->prepare('SELECT id FROM fp_users WHERE email = ?');
  $chk->execute([$email]);
  if ($chk->fetch()) json_out(['error' => 'Email already exists'], 409);

  db()->prepare('INSERT INTO fp_users (full_name, email, password_hash, role) VALUES (?,?,?,?)')
    ->execute([$name, $email, password_hash($pass, PASSWORD_BCRYPT), $role]);

  json_out(['id' => (int)db()->lastInsertId()], 201);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
  $b = body();
  $id = (int)($b['id'] ?? 0);
  if (!$id) json_out(['error' => 'id is required'], 422);

  $sets = [];
  $p = [];

  if (isset($b['full_name']) && trim($b['full_name']) !== '') { $sets[] = 'full_name = ?'; $p[] = trim($b['full_name']); }
  if (isset($b['role'])) {
    if (!in_array($b['role'], $roles, true)) json_out(['error' => 'Invalid role'], 422);
    $sets[] = 'role = ?'; $p[] = $b['role'];
  }
  if (isset($b['is_active'])) { $sets[] = 'is_active = ?'; $p[] = $b['is_active'] ? 1 : 0; }
  if (!empty($b['password'])) {
    if (strlen($b['password']) < 8) json_out(['error' => 'Password must be at least 8 characters'], 422);
    $sets[] = 'password_hash = ?'; $p[] = password_hash($b['password'], PASSWORD_BCRYPT);
  }

  // Prevent the admin from locking themselves out
  if ($id === (int)$me['id']) {
    if ((isset($b['role']) && $b['role'] !== 'admin') || (isset($b['is_active']) && !$b['is_active'])) {
      json_out(['error' => 'You cannot demote or deactivate your own account'], 422);
    }
  }

  if (!$sets) json_out(['error' => 'Nothing to update'], 422);

  $p[] = $id;
  db()->prepare('UPDATE fp_users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($p);

  // Force re-login if the account was deactivated, re-roled, or password changed
  if (isset($b['is_active']) || isset($b['role']) || !empty($b['password'])) {
    db()->prepare('DELETE FROM fp_auth_tokens WHERE user_id = ?')->execute([$id]);
  }

  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);