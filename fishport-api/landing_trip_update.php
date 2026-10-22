<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

auth_user(['admin', 'encoder']);
$b = body();

$id = (int)($b['id'] ?? 0);
if ($id <= 0) json_out(['error' => 'id is required'], 422);

// Find the trip of the row that was edited
$st = db()->prepare('SELECT trip_id FROM fp_landings WHERE id = ?');
$st->execute([$id]);
$tripId = $st->fetchColumn();
if (!$tripId) json_out(['updated' => 0]); // not part of a trip, nothing to sync

foreach (['landing_date', 'boat_name'] as $k) {
  if (!isset($b[$k]) || trim((string)$b[$k]) === '') json_out(['error' => "$k is required"], 422);
}

$nz = fn($v) => ($v === null || trim((string)$v) === '') ? null : trim((string)$v);

$isLand = !empty($b['truck_delivery']);
$origin = $isLand ? trim((string)($b['origin'] ?? '')) : '';
$plate  = $isLand ? $nz(strtoupper(preg_replace('/\s+/', ' ', trim((string)($b['plate_number'] ?? ''))))) : null;

if ($isLand && $origin === '') json_out(['error' => 'origin is required for land deliveries'], 422);
if ($isLand && $plate === null) json_out(['error' => 'plate_number is required for land deliveries'], 422);
if ($plate !== null && strlen($plate) > 20) json_out(['error' => 'plate_number must be 20 characters or fewer'], 422);

$st = db()->prepare(
  'UPDATE fp_landings SET
     landing_date = ?, landing_time = ?, boat_name = ?, boat_owner = ?,
     fishing_gear = ?, fishing_ground = ?, origin = ?, truck_delivery = ?,
     plate_number = ?, broker = ?, remarks = ?
   WHERE trip_id = ?'
);
$st->execute([
  $b['landing_date'],
  $nz($b['landing_time'] ?? null),
  trim((string)$b['boat_name']),
  $nz($b['boat_owner'] ?? null),
  $nz($b['fishing_gear'] ?? null),
  $nz($b['fishing_ground'] ?? null),
  $origin,
  $isLand ? 1 : 0,
  $plate,
  $nz($b['broker'] ?? null),
  $nz($b['remarks'] ?? null),
  $tripId,
]);

json_out(['updated' => $st->rowCount()]);