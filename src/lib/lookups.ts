import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Names = { names: string[] };
export type LookupType = "species" | "brokers" | "producers" | "owners";

export function useLookups() {
  const [data, setData] = useState({
    species: [] as string[],
    brokers: [] as string[],
    producers: [] as string[],
    owners: [] as string[],
  });

  useEffect(() => {
    // Each list loads on its own, so one failing type doesn't empty the others
    const load = (type: LookupType) =>
      api<Names>(`lookups.php?type=${type}`)
        .then((r) => r.names)
        .catch(() => [] as string[]);

    Promise.all([load("species"), load("brokers"), load("producers"), load("owners")]).then(
      ([species, brokers, producers, owners]) => setData({ species, brokers, producers, owners })
    );
  }, []);

  return data;
}

export function saveLookup(type: LookupType, name: string) {
  const n = name.trim();
  if (!n) return Promise.resolve();
  return api(`lookups.php?type=${type}`, { method: "POST", body: JSON.stringify({ name: n }) }).catch(() => {});
}