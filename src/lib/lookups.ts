import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Names = { names: string[] };
export type LookupType = "species" | "brokers" | "producers" | "owners";
type LookupData = Record<LookupType, string[]>;

const CACHE_TTL = 5 * 60 * 1000;
let cached: { data: LookupData; at: number } | null = null;
let pending: Promise<LookupData> | null = null;

const emptyLookups = (): LookupData => ({ species: [], brokers: [], producers: [], owners: [] });

function loadLookups() {
  if (cached && Date.now() - cached.at < CACHE_TTL) return Promise.resolve(cached.data);
  if (pending) return pending;

  const load = (type: LookupType) =>
    api<Names>(`lookups.php?type=${type}`)
      .then((response) => response.names)
      .catch(() => [] as string[]);

  pending = Promise.all([load("species"), load("brokers"), load("producers"), load("owners")])
    .then(([species, brokers, producers, owners]) => {
      const data = { species, brokers, producers, owners };
      cached = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function useLookups() {
  const [data, setData] = useState<LookupData>(() => cached?.data ?? emptyLookups());

  useEffect(() => {
    let active = true;
    loadLookups().then((lookups) => {
      if (active) setData(lookups);
    });
    return () => {
      active = false;
    };
  }, []);

  return data;
}

export function saveLookup(type: LookupType, name: string) {
  const n = name.trim();
  if (!n) return Promise.resolve();
  return api(`lookups.php?type=${type}`, { method: "POST", body: JSON.stringify({ name: n }) })
    .then(() => {
      if (!cached) return;
      const exists = cached.data[type].some((item) => item.toLocaleLowerCase() === n.toLocaleLowerCase());
      if (!exists) cached.data = { ...cached.data, [type]: [...cached.data[type], n] };
      cached.at = Date.now();
    })
    .catch(() => {});
}
