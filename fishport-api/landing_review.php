<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

$u = auth_user(['admin']);
$b = body();

$status = $b['status'] ?? '';
if (!in_array($status, ['approved', 'rejected'], true)) {
  json_out(['error' => 'Invalid status'], 422);
}

// One truck / boat trip: review every species row that shares the trip_id
$byTrip = false;
if (!empty($b['trip_id']) && !is_array($b['trip_id'])) {
  $st = db()->prepare('SELECT id FROM fp_landings WHERE trip_id = ?');
  $st->execute([(string)$b['trip_id']]);
  $b['ids'] = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
  unset($b['id']);
  $byTrip = true;
}

// Accept a single id (one row) or a list of ids (Approve all / a whole trip)
$ids = isset($b['ids']) && is_array($b['ids'])
  ? $b['ids']
  : (isset($b['id']) ? [$b['id']] : []);
$ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn($i) => $i > 0)));

if (!$ids) json_out(['error' => 'No landings selected'], 422);
if (count($ids) > 1000) json_out(['error' => 'Too many landings in one request'], 422);

$ph  = implode(',', array_fill(0, count($ids), '?'));
$sql = "UPDATE fp_landings SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id IN ($ph)";
// "Approve all" only touches rows that are still pending.
// A single trip is always updated, so an approved trip can still be rejected.
if (count($ids) > 1 && !$byTrip) $sql .= " AND status = 'pending'";

$st = db()->prepare($sql);
$st->execute(array_merge([$status, $u['id']], $ids));

json_out(['updated' => $st->rowCount(), 'status' => $status]);