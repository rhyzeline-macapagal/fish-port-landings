<?php
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_out(['error' => 'Method not allowed'], 405);
}

// Admins and encoders may edit; auth_user handles the login and role check
$u  = auth_user(['admin', 'encoder']);
$in = body();

$str = function ($k) use ($in) {
  $v = trim((string)($in[$k] ?? ''));
  return $v === '' ? null : $v;
};

$id = (int)($in['id'] ?? 0);
if ($id <= 0) json_out(['error' => 'Missing landing id.'], 422);

$date = $str('landing_date');
if (!$date || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) json_out(['error' => 'Invalid date.'], 422);

$boat    = $str('boat_name');
$species = $str('species');
$volume  = (float)($in['volume'] ?? 0);
if (!$boat)       json_out(['error' => 'Supplier / vessel is required.'], 422);
if (!$species)    json_out(['error' => 'Species is required.'], 422);
if ($volume <= 0) json_out(['error' => 'Volume must be greater than 0.'], 422);

$price = isset($in['price_per_kg']) && $in['price_per_kg'] !== '' ? (float)$in['price_per_kg'] : null;
$total = isset($in['total_value']) && $in['total_value'] !== '' ? (float)$in['total_value']
       : ($price !== null ? round($volume * $price, 2) : 0);

$time = $str('landing_time');
if ($time && !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $time)) json_out(['error' => 'Invalid time.'], 422);

$land = !empty($in['truck_delivery']) ? 1 : 0;
$unit = $str('unit') ?? 'kg';

$pdo = db();

$check = $pdo->prepare('SELECT id FROM fp_landings WHERE id = ?');
$check->execute([$id]);
if (!$check->fetch()) json_out(['error' => 'Landing not found.'], 404);

// An encoder's edit goes back to the admin for review; an admin's edit keeps the current status.
$reset = $u['role'] === 'admin' ? '' : ", status = 'pending', reviewed_by = NULL, reviewed_at = NULL";

$sql = "UPDATE fp_landings SET
          landing_date = :landing_date, landing_time = :landing_time,
          boat_name = :boat_name, fishing_gear = :fishing_gear,
          origin = :origin, truck_delivery = :truck_delivery, plate_number = :plate_number,
          boat_owner = :boat_owner, fishing_ground = :fishing_ground,
          species = :species, volume = :volume, unit = :unit,
          price_per_kg = :price_per_kg, total_value = :total_value,
          broker = :broker, quality = :quality, remarks = :remarks,
          updated_at = NOW()
          $reset
        WHERE id = :id";

$pdo->prepare($sql)->execute([
  ':landing_date'   => $date,
  ':landing_time'   => $time,
  ':boat_name'      => $boat,
  ':fishing_gear'   => $str('fishing_gear'),
  ':origin'         => $land ? $str('origin') : null,
  ':truck_delivery' => $land,
  ':plate_number'   => $land ? $str('plate_number') : null,
  ':boat_owner'     => $str('boat_owner'),
  ':fishing_ground' => $str('fishing_ground'),
  ':species'        => $species,
  ':volume'         => $volume,
  ':unit'           => $unit,
  ':price_per_kg'   => $price,
  ':total_value'    => $total,
  ':broker'         => $str('broker'),
  ':quality'        => $str('quality'),
  ':remarks'        => $str('remarks'),
  ':id'             => $id,
]);

json_out(['ok' => true]);