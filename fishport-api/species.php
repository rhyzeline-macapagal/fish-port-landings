<?php
require_once dirname($_SERVER['SCRIPT_FILENAME']) . '/helpers.php';

function species_row(int $id): ?array {
  $statement = db()->prepare(
    'SELECT id,
            name AS local_name,
            other_names,
            english_name AS common_name,
            scientific_name,
            notes
       FROM fp_species
      WHERE id = ?'
  );
  $statement->execute([$id]);
  return $statement->fetch() ?: null;
}

function clean_species(array $body): array {
  $value = function (string $key) use ($body): ?string {
    $value = trim((string)($body[$key] ?? ''));
    return $value === '' ? null : $value;
  };

  $name = $value('local_name');
  if ($name === null) json_out(['error' => 'Local name is required'], 422);

  return [
    'local_name' => $name,
    'other_names' => $value('other_names'),
    'common_name' => $value('common_name'),
    'scientific_name' => $value('scientific_name'),
    'notes' => $value('notes'),
  ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($method === 'GET') {
  auth_user(['admin', 'encoder', 'viewer']);
  $rows = db()->query(
    'SELECT id,
            name AS local_name,
            other_names,
            english_name AS common_name,
            scientific_name,
            notes
       FROM fp_species
      ORDER BY name ASC, id ASC'
  )->fetchAll();
  json_out($rows);
}

if ($method === 'POST') {
  $user = auth_user(['admin', 'encoder']);
  $data = clean_species(body());
  db()->prepare(
    'INSERT INTO fp_species (name, other_names, english_name, scientific_name, notes)
     VALUES (?, ?, ?, ?, ?)'
  )->execute([
    $data['local_name'], $data['other_names'], $data['common_name'], $data['scientific_name'], $data['notes'],
  ]);
  json_out(species_row((int)db()->lastInsertId()), 201);
}

if ($method === 'PUT') {
  auth_user(['admin', 'encoder']);
  if (!$id || !species_row($id)) json_out(['error' => 'Species not found'], 404);
  $data = clean_species(body());
  db()->prepare(
    'UPDATE fp_species
        SET name = ?, other_names = ?, english_name = ?, scientific_name = ?, notes = ?
      WHERE id = ?'
  )->execute([
    $data['local_name'], $data['other_names'], $data['common_name'], $data['scientific_name'], $data['notes'], $id,
  ]);
  json_out(species_row($id));
}

if ($method === 'DELETE') {
  auth_user(['admin']);
  if (!$id || !species_row($id)) json_out(['error' => 'Species not found'], 404);
  db()->prepare('DELETE FROM fp_species WHERE id = ?')->execute([$id]);
  json_out(['ok' => true]);
}

json_out(['error' => 'Method not allowed'], 405);