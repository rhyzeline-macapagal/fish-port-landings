<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

// Only admins can delete
$u = auth_user(['admin']);
$b = body();

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

// Safety: only rows that are already rejected can be deleted.
// Pending and approved rows are never touched, even if their id is sent.
$ph = implode(',', array_fill(0, count($ids), '?'));
$st = db()->prepare("DELETE FROM fp_landings WHERE id IN ($ph) AND status = 'rejected'");
$st->execute($ids);

$deleted = $st->rowCount();
if ($deleted === 0) {
  json_out(['error' => 'Only rejected landings can be deleted'], 422);
}

json_out(['deleted' => $deleted]);