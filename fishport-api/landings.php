<?php
require_once dirname($_SERVER['SCRIPT_FILENAME']) . '/helpers.php';

/* ------------------------------------------------------------------
 * Filter helpers (GET)
 * ------------------------------------------------------------------ */

// Volume normalised to kg so "ton" rows sort / total / filter correctly.
const LF_KG = "(volume * IF(unit = 'ton', 1000, 1))";

// One truck / boat trip = all rows sharing a trip_id (old rows fall back to their own id).
const LF_TRIP = "COALESCE(trip_id, CONCAT('L', id))";

// Accepts ?x=a,b,c  or  ?x[]=a&x[]=b  and returns a clean list.
function lf_list(array $g, string $key): array {
  if (!isset($g[$key])) return [];
  $raw = is_array($g[$key]) ? $g[$key] : explode(',', (string)$g[$key]);
  $out = [];
  foreach ($raw as $v) {
    if (is_array($v)) continue;
    $v = trim((string)$v);
    if ($v !== '') $out[] = $v;
  }
  return $out;
}

// Builds the WHERE clause + bound params from the query string.
function lf_where(array $g, bool $isTop): array {
  $w = ['1=1'];
  $p = [];

  // Exact-match filters. Several values (comma list or array) = match any.
  $exact = [
    'status'         => 'status',
    'species'        => 'species',
    'boat_name'      => 'boat_name',   'vessel' => 'boat_name',
    'boat_owner'     => 'boat_owner',  'owner'  => 'boat_owner',
    'broker'         => 'broker',
    'origin'         => 'origin',
    'plate_number'   => 'plate_number', 'plate' => 'plate_number',
    'fishing_gear'   => 'fishing_gear', 'gear'  => 'fishing_gear',
    'species_id'     => 'species_id',
    'quality'        => 'quality',
    'unit'           => 'unit',
    'trip_id'        => 'trip_id',
    'created_by'     => 'created_by',
    'reviewed_by'    => 'reviewed_by',
  ];
  foreach ($exact as $param => $col) {
    $vals = lf_list($g, $param);
    if (!$vals) continue;
    $w[] = "$col IN (" . implode(',', array_fill(0, count($vals), '?')) . ')';
    array_push($p, ...$vals);
  }

  // Dashboard-aligned totals and lists ignore rejected entries unless a status was asked for.
  if (($isTop || ($g['exclude_rejected'] ?? '') === '1') && !lf_list($g, 'status')) {
    $w[] = "status <> 'rejected'";
  }

  // By land (truck delivery) / by sea (landed at port, no truck).
  $d = strtolower((string)($g['delivery'] ?? ''));
  if (in_array($d, ['land', 'truck', '1'], true))     $w[] = 'truck_delivery = 1';
  elseif (in_array($d, ['sea', 'boat', '0'], true))   $w[] = 'truck_delivery = 0';

  // Reviewed / not reviewed yet.
  $rv = strtolower((string)($g['reviewed'] ?? ''));
  if ($rv === 'yes')     $w[] = 'reviewed_at IS NOT NULL';
  elseif ($rv === 'no')  $w[] = 'reviewed_at IS NULL';

  // Date range + quick periods (Philippine time).
  if (!empty($g['period'])) {
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    $from = $to = null;
    switch (strtolower((string)$g['period'])) {
      case 'today':     $from = $to = $today; break;
      case 'yesterday': $from = $to = $today->modify('-1 day'); break;
      case 'week':      $from = $today->modify('-6 days');   $to = $today; break;
      case 'month':     $from = $today->modify('-29 days');  $to = $today; break;
      case 'year':      $from = $today->modify('-364 days'); $to = $today; break;
    }
    if ($from) { $w[] = 'landing_date >= ?'; $p[] = $from->format('Y-m-d'); }
    if ($to)   { $w[] = 'landing_date <= ?'; $p[] = $to->format('Y-m-d'); }
  }
  if (!empty($g['from'])) { $w[] = 'landing_date >= ?'; $p[] = $g['from']; }
  if (!empty($g['to']))   { $w[] = 'landing_date <= ?'; $p[] = $g['to']; }

  // Whole calendar year (?year=2026)
  if (!empty($g['year']) && !is_array($g['year']) && ctype_digit((string)$g['year'])) {
    $y = (int)$g['year'];
    if ($y >= 2000 && $y <= 2100) {
      $w[] = 'landing_date BETWEEN ? AND ?';
      array_push($p, "$y-01-01", "$y-12-31");
    }
  }

  // Time of day (e.g. early-morning landings).
  foreach (['time_from' => '>=', 'time_to' => '<='] as $param => $op) {
    if (!empty($g[$param]) && preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', (string)$g[$param])) {
      $w[] = "landing_time $op ?";
      $p[] = $g[$param];
    }
  }

  // Numeric ranges. Volume is compared in kg.
  $ranges = [
    'min_volume' => [LF_KG, '>='],          'max_volume' => [LF_KG, '<='],
    'min_value'  => ['total_value', '>='],  'max_value'  => ['total_value', '<='],
    'min_price'  => ['price_per_kg', '>='], 'max_price'  => ['price_per_kg', '<='],
  ];
  foreach ($ranges as $param => [$expr, $op]) {
    if (isset($g[$param]) && is_numeric($g[$param])) {
      $w[] = "$expr $op ?";
      $p[] = $g[$param];
    }
  }

  // Free-text search across the main text columns.
  if (!empty($g['q']) && !is_array($g['q'])) {
    $cols = ['boat_name', 'boat_owner', 'origin', 'plate_number', 'broker', 'species', 'status', 'remarks'];
    $w[] = '(' . implode(' OR ', array_map(fn($c) => "$c LIKE ?", $cols)) . ')';
    $like = '%' . addcslashes((string)$g['q'], '%_\\') . '%';
    foreach ($cols as $_) $p[] = $like;
  }

  return [$w, $p];
}

/* ------------------------------------------------------------------
 * GET
 *
 *  List (plain array of rows, one row per species).
 *    Each row also has trip_id and trip_items (how many species rows its trip has).
 *    filters : status species vessel|boat_name owner|boat_owner broker origin
 *              plate|plate_number gear|fishing_gear species_id quality unit
 *              trip_id created_by reviewed_by   (comma list or x[]=.. = match any)
 *              delivery=land|sea  reviewed=yes|no
 *              period=today|yesterday|week|month|year  year=2026  from  to
 *              time_from  time_to  q
 *              min_volume max_volume min_value max_value min_price max_price
 *    sorting : sort=landing_date|landing_time|boat_name|species|broker|origin|
 *                   plate_number|status|volume|price_per_kg|total_value|created_at
 *              dir=asc|desc
 *    paging  : limit (max 5000)  offset
 *
 *  Leaderboard
 *    ?top=broker|vessel|owner|species|origin|plate|gear|species_id|quality|status|date|delivery
 *    &by=value|volume|trips|price   &n=10   (+ any filter above)
 *    "trips" counts distinct trips, not species rows.
 *
 *  Breakdown: totals for any mix of fields (+ any filter above)
 *    ?group=origin,species   (up to 5 of: producer owner origin plate species species_id broker gear
 *                             quality status delivery month date)
 *    &by=value|volume|trips|price|name   &n=50
 *
 *  Dropdown values (includes "years", newest first)
 *    ?meta=options
 *
 *  Compact totals (used by comparison cards without downloading every row)
 *    ?summary=1  (+ any filter above, optionally &exclude_rejected=1)
 * ------------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  auth_user(['admin', 'encoder']);
  $g = $_GET;

  // ---- distinct values for the filter dropdowns ----
  if (($g['meta'] ?? '') === 'options') {
    $cols = [
      'statuses' => 'status',        'species'  => 'species',
      'vessels'  => 'boat_name',     'owners'   => 'boat_owner',
      'brokers'  => 'broker',        'origins'  => 'origin',
      'plates'   => 'plate_number',
      'gears'    => 'fishing_gear',  'species_ids' => 'species_id',
      'qualities'=> 'quality',       'units'    => 'unit',
    ];
    $out = [];
    foreach ($cols as $key => $col) {
      $out[$key] = db()->query(
        "SELECT DISTINCT $col FROM fp_landings WHERE $col IS NOT NULL AND $col <> '' ORDER BY $col"
      )->fetchAll(PDO::FETCH_COLUMN);
    }
    $out['deliveries'] = ['land', 'sea'];
    $out['dates'] = db()->query(
      'SELECT MIN(landing_date) AS first, MAX(landing_date) AS last FROM fp_landings'
    )->fetch();

    // Years that have data, newest first (always includes the current year)
    $thisYear = (int)(new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y');
    $years = array_map('intval', db()->query(
      'SELECT DISTINCT YEAR(landing_date) AS y FROM fp_landings
       WHERE landing_date IS NOT NULL ORDER BY y DESC'
    )->fetchAll(PDO::FETCH_COLUMN));
    if (!in_array($thisYear, $years, true)) {
      $years[] = $thisYear;
      rsort($years);
    }
    $out['years'] = $years;

    json_out($out);
  }

  // ---- compact totals for KPI comparisons ----
  // Returning four numbers is substantially faster than sending hundreds or
  // thousands of full landing rows that the browser would only sum again.
  if (($g['summary'] ?? '') === '1') {
    [$w, $p] = lf_where($g, false);

    $st = db()->prepare(
      'SELECT COUNT(*) AS count,
              COALESCE(ROUND(SUM(' . LF_KG . '), 2), 0) AS volume,
              COALESCE(ROUND(SUM(total_value), 2), 0) AS value,
              SUM(CASE WHEN status = \'pending\' THEN 1 ELSE 0 END) AS pending
       FROM fp_landings WHERE ' . implode(' AND ', $w)
    );
    $st->execute($p);
    json_out($st->fetch());
  }

  // ---- leaderboard: top broker / vessel / by land / by sea / ... ----
  if (isset($g['top'])) {
    $groups = [
      'broker'   => 'broker',
      'vessel'   => 'boat_name', 'boat' => 'boat_name',
      'owner'    => 'boat_owner',
      'species'  => 'species',
      'origin'   => 'origin',
      'plate'    => 'plate_number',
      'gear'     => 'fishing_gear',
      'species_id' => 'species_id',
      'quality'  => 'quality',
      'status'   => 'status',
      'date'     => 'landing_date',
      'delivery' => "CASE WHEN truck_delivery = 1 THEN 'Land' ELSE 'Sea' END",
    ];
    $topKey = strtolower((string)$g['top']);
    if (!isset($groups[$topKey])) {
      json_out(['error' => 'top must be one of: ' . implode(', ', array_keys($groups))], 422);
    }
    $expr = $groups[$topKey];

    $metrics = [
      'value'  => 'total_value',
      'volume' => 'total_volume_kg',
      'trips'  => 'trips',
      'price'  => 'avg_price_per_kg',
    ];
    $by = strtolower((string)($g['by'] ?? 'value'));
    if (!isset($metrics[$by])) $by = 'value';

    $n = min(100, max(1, (int)($g['n'] ?? 10)));

    [$w, $p] = lf_where($g, true);
    $where = implode(' AND ', $w);

    $st = db()->prepare(
      "SELECT $expr AS label,
              COUNT(DISTINCT " . LF_TRIP . ") AS trips,
              ROUND(SUM(" . LF_KG . "), 2) AS total_volume_kg,
              ROUND(SUM(total_value), 2) AS total_value,
              ROUND(SUM(total_value) / NULLIF(SUM(" . LF_KG . "), 0), 2) AS avg_price_per_kg
       FROM fp_landings
       WHERE $where AND COALESCE(CAST(($expr) AS CHAR), '') <> ''
       GROUP BY label
       ORDER BY {$metrics[$by]} DESC, label ASC
       LIMIT $n"
    );
    $st->execute($p);
    $rows = $st->fetchAll();

    $sm = db()->prepare(
      "SELECT COUNT(DISTINCT " . LF_TRIP . ") AS trips,
              ROUND(SUM(" . LF_KG . "), 2) AS total_volume_kg,
              ROUND(SUM(total_value), 2) AS total_value,
              ROUND(SUM(total_value) / NULLIF(SUM(" . LF_KG . "), 0), 2) AS avg_price_per_kg
       FROM fp_landings WHERE $where"
    );
    $sm->execute($p);

    json_out(['group' => $topKey, 'by' => $by, 'rows' => $rows, 'summary' => $sm->fetch()]);
  }

  // ---- breakdown: totals for any mix of fields (origin + species, producer + species + broker, ...) ----
  if (isset($g['group'])) {
    $dims = [
      'producer' => 'boat_name', 'vessel' => 'boat_name',
      'owner'    => 'boat_owner',
      'origin'   => 'origin',
      'plate'    => 'plate_number',
      'species'  => 'species',
      'broker'   => 'broker',
      'gear'     => 'fishing_gear',
      'species_id' => 'species_id',
      'quality'  => 'quality',
      'status'   => 'status',
      'delivery' => "CASE WHEN truck_delivery = 1 THEN 'Land' ELSE 'Sea' END",
      'month'    => "DATE_FORMAT(landing_date, '%Y-%m')",
      'date'     => "DATE_FORMAT(landing_date, '%Y-%m-%d')",
    ];
    $keys = [];
    foreach (lf_list($g, 'group') as $k) {
      $k = strtolower($k);
      if (!isset($dims[$k])) {
        json_out(['error' => 'group must be a mix of: ' . implode(', ', array_keys($dims))], 422);
      }
      if (!in_array($k, $keys, true)) $keys[] = $k;
    }
    $keys = array_slice($keys, 0, 5);

    $metrics = ['value' => 'total_value', 'volume' => 'total_volume_kg', 'trips' => 'trips', 'price' => 'avg_price_per_kg'];
    $by = strtolower((string)($g['by'] ?? 'value'));
    if ($by !== 'name' && !isset($metrics[$by])) $by = 'value';
    $n = min(500, max(1, (int)($g['n'] ?? 50)));

    // Same filters as the list, rejected entries included unless a status is chosen.
    [$w, $p] = lf_where($g, false);
    $where = implode(' AND ', $w);

    $totals = 'COUNT(DISTINCT ' . LF_TRIP . ') AS trips,
               ROUND(SUM(' . LF_KG . '), 2) AS total_volume_kg,
               ROUND(SUM(total_value), 2) AS total_value,
               ROUND(SUM(total_value) / NULLIF(SUM(' . LF_KG . '), 0), 2) AS avg_price_per_kg';

    $sm = db()->prepare("SELECT $totals FROM fp_landings WHERE $where");
    $sm->execute($p);
    $summary = $sm->fetch();

    $rows = [];
    $groups = 0;
    if ($keys) {
      $sel = [];
      $exprs = [];
      $aliases = [];
      foreach ($keys as $i => $k) {
        // empty / missing values become their own "(none)" group so the totals still add up
        $e = "COALESCE(NULLIF(TRIM(({$dims[$k]})), ''), '(none)')";
        $sel[] = "$e AS d$i";
        $exprs[] = $e;
        $aliases[] = "d$i";
      }
      $byName = implode(', ', array_map(fn($a) => "$a ASC", $aliases));
      $order = $by === 'name' ? $byName : $metrics[$by] . " DESC, $byName";

      $st = db()->prepare(
        'SELECT ' . implode(', ', $sel) . ", $totals
         FROM fp_landings WHERE $where
         GROUP BY " . implode(', ', $aliases) . "
         ORDER BY $order
         LIMIT $n"
      );
      $st->execute($p);
      foreach ($st->fetchAll() as $r) {
        $labels = [];
        foreach ($aliases as $a) $labels[] = $r[$a];
        $rows[] = [
          'labels'           => $labels,
          'trips'            => $r['trips'],
          'total_volume_kg'  => $r['total_volume_kg'],
          'total_value'      => $r['total_value'],
          'avg_price_per_kg' => $r['avg_price_per_kg'],
        ];
      }

      $ct = db()->prepare(
        'SELECT COUNT(*) FROM (SELECT 1 FROM fp_landings WHERE ' . $where .
        ' GROUP BY ' . implode(', ', $exprs) . ') AS t'
      );
      $ct->execute($p);
      $groups = (int)$ct->fetchColumn();
    }

    json_out(['group' => $keys, 'by' => $by, 'groups' => $groups, 'rows' => $rows, 'summary' => $summary]);
  }

  // ---- normal filtered list ----
  [$w, $p] = lf_where($g, false);

  $sorts = [
    'landing_date' => 'landing_date', 'landing_time' => 'landing_time',
    'boat_name'    => 'boat_name',    'species'      => 'species',
    'broker'       => 'broker',       'origin'       => 'origin',
    'plate_number' => 'plate_number',
    'status'       => 'status',       'volume'       => LF_KG,
    'price_per_kg' => 'price_per_kg', 'total_value'  => 'total_value',
    'created_at'   => 'created_at',
  ];
  $sort = (string)($g['sort'] ?? '');
  $dir  = strtolower((string)($g['dir'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';
  // Default order keeps the species of one trip next to each other.
  $order = isset($sorts[$sort])
    ? $sorts[$sort] . " $dir, id DESC"
    : 'landing_date DESC, created_at DESC, trip_id, id ASC';

  // Larger pages avoid repeated high-latency HTTP round trips while retaining
  // a hard ceiling for memory usage. The client still pages beyond this value.
  $limit  = min(5000, max(1, (int)($g['limit'] ?? 1000)));
  $offset = max(0, (int)($g['offset'] ?? 0));

  $st = db()->prepare(
    'SELECT fp_landings.*,
            (SELECT COUNT(*) FROM fp_landings t2 WHERE t2.trip_id = fp_landings.trip_id) AS trip_items
     FROM fp_landings WHERE ' . implode(' AND ', $w) .
    " ORDER BY $order LIMIT $limit OFFSET $offset"
  );
  $st->execute($p);
  json_out($st->fetchAll());
}

/* ------------------------------------------------------------------
 * POST
 * One trip (truck or boat) with one or more species.
 *   New body : { landing_date, boat_name, ..., items: [{ species, volume, unit, price_per_kg, total_value, quality }] }
 *   Old body : single species at the top level (still accepted).
 * Each item is saved as its own row; all rows share one trip_id.
 * By sea  : boat_name (the producer) is required.
 * By land : origin and plate_number are required; there is no boat, so boat_name is stored empty.
 * ------------------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $u = auth_user(['admin', 'encoder']);
  $b = body();

  $isLand = !empty($b['truck_delivery']);

  $required = ['landing_date'];
  if ($isLand) { $required[] = 'origin'; $required[] = 'plate_number'; }
  else         { $required[] = 'boat_name'; }
  foreach ($required as $f) {
    if (!isset($b[$f]) || trim((string)$b[$f]) === '') json_out(['error' => "$f is required"], 422);
  }

  // Producer (boat name) only applies to sea landings
  $boatName = $isLand ? '' : trim((string)$b['boat_name']);

  // Species items (fall back to the old single-species body)
  $rawItems = (isset($b['items']) && is_array($b['items']) && $b['items'])
    ? $b['items']
    : [[
      'species_id'   => $b['species_id'] ?? null,
        'species'      => $b['species'] ?? '',
        'volume'       => $b['volume'] ?? '',
        'unit'         => $b['unit'] ?? 'kg',
        'price_per_kg' => $b['price_per_kg'] ?? null,
        'total_value'  => $b['total_value'] ?? '',
        'quality'      => $b['quality'] ?? 'Fresh',
      ]];

  if (count($rawItems) > 30) json_out(['error' => 'A trip can have at most 30 species'], 422);

  $items = [];
  $seen = [];
  foreach (array_values($rawItems) as $i => $it) {
    $n = $i + 1;
    if (!is_array($it)) json_out(['error' => "Item $n is invalid"], 422);

    $species = trim((string)($it['species'] ?? ''));
    if ($species === '') json_out(['error' => "Species $n: species is required"], 422);
    $speciesKey = strtolower($species);
    if (isset($seen[$speciesKey])) json_out(['error' => "$species is listed more than once"], 422);
    $seen[$speciesKey] = true;

    if (!is_numeric($it['volume'] ?? null) || !is_numeric($it['total_value'] ?? null)) {
      json_out(['error' => "Species $n: volume and total value must be numbers"], 422);
    }

    $unit = in_array($it['unit'] ?? 'kg', ['kg', 'ton'], true) ? ($it['unit'] ?? 'kg') : 'kg';
    $price = (isset($it['price_per_kg']) && $it['price_per_kg'] !== '') ? $it['price_per_kg'] : null;

    $items[] = [
      'species_id'   => (isset($it['species_id']) && $it['species_id'] !== '') ? $it['species_id'] : null,
      'species'      => $species,
      'volume'       => $it['volume'],
      'unit'         => $unit,
      'price_per_kg' => $price,
      'total_value'  => $it['total_value'],
      'quality'      => $it['quality'] ?? 'Fresh',
    ];
  }

  $origin = $isLand ? trim((string)($b['origin'] ?? '')) : '';
  $plate = $isLand
    ? strtoupper(preg_replace('/\s+/', ' ', trim((string)($b['plate_number'] ?? ''))))
    : null;
  if ($plate !== null && strlen($plate) > 20) {
    json_out(['error' => 'plate_number must be 20 characters or fewer'], 422);
  }

  $pdo = db();
  $tripId = bin2hex(random_bytes(8)); // 16 chars
  $firstId = 0;

  $pdo->beginTransaction();
  try {
    $st = $pdo->prepare(
      'INSERT INTO fp_landings
       (trip_id, landing_date, landing_time, boat_name, fishing_gear, origin, truck_delivery, plate_number,
        boat_owner, species_id, species, volume, unit, price_per_kg, total_value, broker, quality,
        remarks, created_by)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    foreach ($items as $k => $it) {
      $st->execute([
        $tripId,
        $b['landing_date'],
        !empty($b['landing_time']) ? $b['landing_time'] : null,
        $boatName,
        $b['fishing_gear'] ?? null,
        $origin,
        $isLand ? 1 : 0,
        $plate,
        $b['boat_owner'] ?? null,
        $it['species_id'],
        $it['species'],
        $it['volume'],
        $it['unit'],
        $it['price_per_kg'],
        $it['total_value'],
        $b['broker'] ?? null,
        $it['quality'],
        $b['remarks'] ?? null,
        $u['id'],
      ]);
      if ($k === 0) $firstId = (int)$pdo->lastInsertId();
    }
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    error_log('Landing insert failed: ' . $e->getMessage());
    json_out([
      'error' => 'Could not save the landing.',
      'detail' => $e->getMessage(),
      'reference' => 'landing-insert-failed',
    ], 500);
  }

  json_out(['id' => $firstId, 'trip_id' => $tripId, 'rows' => count($items), 'status' => 'pending'], 201);
}

json_out(['error' => 'Method not allowed'], 405);
