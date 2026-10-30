<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $u = auth_user(['admin']);
    db()->exec('CREATE TABLE IF NOT EXISTS fp_deleted_landings (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      landing_id INT UNSIGNED NOT NULL,
      record_json JSON NOT NULL,
      deleted_by INT UNSIGNED NOT NULL,
      deleted_by_name VARCHAR(255) NOT NULL,
      deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      INDEX idx_deleted_landings_expiry (expires_at)
    )');
    db()->exec('UPDATE fp_deleted_landings SET expires_at = DATE_ADD(deleted_at, INTERVAL 5 DAY) WHERE expires_at > DATE_ADD(deleted_at, INTERVAL 5 DAY)');
    db()->exec('DELETE FROM fp_deleted_landings WHERE expires_at <= CURRENT_TIMESTAMP');
    $archiveId = isset($_GET['archive_id']) ? (int)$_GET['archive_id'] : 0;
    if ($archiveId) {
      $st = db()->prepare('SELECT id AS archive_id, landing_id, record_json, deleted_by_name, deleted_at, expires_at FROM fp_deleted_landings WHERE id = ?');
      $st->execute([$archiveId]);
      $record = $st->fetch();
      if (!$record) json_out(['error' => 'Deleted record is no longer available'], 404);
      $record['record'] = json_decode($record['record_json'], true);
      unset($record['record_json']);
      json_out($record);
    }
    if (isset($_GET['history'])) {
      $rows = db()->query('SELECT id AS archive_id, landing_id, record_json, deleted_by_name, deleted_at, expires_at FROM fp_deleted_landings ORDER BY deleted_at DESC')->fetchAll();
      foreach ($rows as &$row) {
        $row['record'] = json_decode($row['record_json'], true);
        unset($row['record_json']);
      }
      unset($row);
      json_out($rows);
    }
    $rows = db()->query('SELECT id AS archive_id, landing_id, deleted_by_name, deleted_at, expires_at FROM fp_deleted_landings ORDER BY deleted_at DESC')->fetchAll();
    json_out($rows);
  }
  json_out(['error' => 'Method not allowed'], 405);
}

// Only admins can delete
$u = auth_user(['admin']);
$b = body();

db()->exec('CREATE TABLE IF NOT EXISTS fp_deleted_landings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  landing_id INT UNSIGNED NOT NULL,
  record_json JSON NOT NULL,
  deleted_by INT UNSIGNED NOT NULL,
  deleted_by_name VARCHAR(255) NOT NULL,
  deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_deleted_landings_expiry (expires_at)
)');

// One truck / boat trip: every species row that shares the trip_id
if (!empty($b['trip_id']) && !is_array($b['trip_id'])) {
  $st = db()->prepare('SELECT id FROM fp_landings WHERE trip_id = ?');
  $st->execute([(string)$b['trip_id']]);
  $b['ids'] = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
  unset($b['id']);
}

// Accept a single id or a list of ids
$ids = isset($b['ids']) && is_array($b['ids'])
  ? $b['ids']
  : (isset($b['id']) ? [$b['id']] : []);
$ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn($i) => $i > 0)));

if (!$ids) json_out(['error' => 'No landings selected'], 422);
if (count($ids) > 1000) json_out(['error' => 'Too many landings in one request'], 422);

$ph = implode(',', array_fill(0, count($ids), '?'));
$before = db()->prepare("SELECT * FROM fp_landings WHERE id IN ($ph)");
$before->execute($ids);
$archive = db()->prepare('INSERT INTO fp_deleted_landings (landing_id, record_json, deleted_by, deleted_by_name, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 DAY))');
$archiveIds = [];
foreach ($before->fetchAll() as $row) {
  $archive->execute([(int)$row['id'], json_encode($row), (int)$u['id'], $u['full_name'] ?? $u['name'] ?? 'Administrator']);
  $archiveIds[] = (int)db()->lastInsertId();
}
$st = db()->prepare("DELETE FROM fp_landings WHERE id IN ($ph)");
$st->execute($ids);

$deleted = $st->rowCount();
if ($deleted === 0) {
  json_out(['error' => 'Landing record was not found'], 404);
}

json_out(['deleted' => $deleted, 'archive_ids' => $archiveIds, 'deleted_by' => $u['full_name'] ?? $u['name'] ?? 'Administrator']);
