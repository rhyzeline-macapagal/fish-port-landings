<?php
require_once dirname($_SERVER['SCRIPT_FILENAME']) . '/helpers.php';

auth_user(['admin', 'encoder', 'viewer']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_out(['error' => 'Method not allowed'], 405);
}

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
