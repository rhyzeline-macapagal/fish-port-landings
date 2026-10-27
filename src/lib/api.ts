// CHECK 1: your PHP API base URL (the AlwaysData folder that contains landings.php, login.php, ...)
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://YOUR-ACCOUNT.alwaysdata.net/api";

export type Role = "admin" | "encoder" | "viewer";

export type User = {
  id: number;
  name: string;
  full_name: string;
  email: string;
  role: Role;
};

export type Landing = {
  id: number;
  landing_date: string;
  landing_time: string | null;
  boat_name: string;
  fishing_gear: string | null;
  origin: string | null;
  truck_delivery: number | boolean;
  plate_number: string | null;
  boat_owner: string | null;
  fishing_ground: string | null;
  species: string;
  volume: number | string;
  unit: string;
  price_per_kg: number | string | null;
  total_value: number | string;
  broker: string | null;
  quality: string | null;
  remarks: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  trip_id: string | null;
  trip_items?: number | string; // how many species rows are in this trip
};

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_URL}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // CHECK 2: how helpers.php reads the token (Bearer header is the usual choice)
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON response */
  }

  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data
      ? [
          String((data as { error: unknown }).error),
          "detail" in data && (data as { detail: unknown }).detail ? String((data as { detail: unknown }).detail) : "",
        ].filter(Boolean).join(" ")
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

export function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatPeso(n: number | string | null | undefined) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(Number(n) || 0);
}

export function formatKg(n: number | string | null | undefined) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("en-PH", { maximumFractionDigits: 2 })} kg`;
}