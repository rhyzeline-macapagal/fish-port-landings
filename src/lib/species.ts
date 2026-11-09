/** Individual landing species reported together as HIPON on the dashboard. */
const hiponNames = ["SUGPO", "BUKIK", "OSBON", "SUAHE", "GULUDAN", "KUAKIT"];
export const HIPON_SPECIES = hiponNames.map((name) => `${name} (HIPON)`);

/** Keep existing plain names and saved classified names in one dropdown option. */
export function formatSpeciesName(value: string) {
  const name = value.trim();
  const upper = name.toUpperCase();
  const index = hiponNames.findIndex((base, i) => upper === base || upper === HIPON_SPECIES[i]);
  return index >= 0 ? HIPON_SPECIES[index] : name;
}

export function speciesClassification(value: string) {
  const name = formatSpeciesName(value);
  return name.toUpperCase() === "HIPON" || HIPON_SPECIES.includes(name) ? "HIPON" : name;
}

/** Summaries count each classification once, including older individual names. */
export function groupSpeciesVolumes(rows: { species: string; volume: number | string }[]) {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const name = speciesClassification(row.species);
    totals.set(name, (totals.get(name) ?? 0) + Number(row.volume));
  });
  return [...totals].map(([name, volume]) => ({ name, volume })).sort((a, b) => b.volume - a.volume);
}
