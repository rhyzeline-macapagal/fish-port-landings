$utf8 = New-Object System.Text.UTF8Encoding($false)
$root = (Get-Location).Path

function Patch($rel, $label, $pattern, $replacement) {
  $path = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $path)) { Write-Host "SKIP  $label (file not found: $rel)"; return }
  $text = [System.IO.File]::ReadAllText($path)
  $new = [regex]::Replace($text, $pattern, $replacement, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if ($new -eq $text) { Write-Host "NOTE  $label (nothing to change, already done?)"; return }
  [System.IO.File]::WriteAllText($path, $new, $utf8)
  Write-Host "OK    $label"
}

$modal = "src/components/NewLandingModal.tsx"
$landings = "src/app/(app)/landings/page.tsx"

# --- New entry pop-up ---
# 1. remove the "Boat owner" input
Patch $modal "Remove Boat owner field" '\s*<Field label="Boat owner">.*?</Field>' ''
# 2. stop keeping it in the form state
Patch $modal "Remove boat_owner from state" '\s*boat_owner: "",' ''
# 3. still send an empty value so the PHP API receives the key it expects
Patch $modal "Send boat_owner as null" '(total_value: Number\(f\.total_value\),)' ('$1' + "`n          boat_owner: null,")
# 4. let Delivery fill the row next to Fishing gear
Patch $modal "Widen Delivery next to Fishing gear" '<Field label="Delivery" className="sm:col-span-3">' '<Field label="Delivery" className="sm:col-span-2">'
Patch $modal "Delivery tiles full width" 'grid grid-cols-2 gap-3 sm:max-w-md' 'grid grid-cols-2 gap-3'

# --- Landings page ---
Patch $landings "Remove owner under supplier name" '\s*\{r\.boat_owner && <p[^\n]*</p>\}' ''
Patch $landings "Update search placeholder" 'Search supplier, owner or origin' 'Search supplier or origin'

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "Done. Now run: npm run dev"
