import type { SupabaseClient } from "@supabase/supabase-js";
import { CoreError, type Catalogo } from "@core/types";
import { fetchCatalogo } from "./catalogo.js";

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface OpcionesCache {
  ttlDias?: number;
  forzarRefetch?: boolean;
}

export const CLAVE_CACHE = "core.catalogo.v1";
export const TTL_DIAS_DEFAULT = 7;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

interface EntradaCache {
  version: 1;
  timestamp: number;
  catalogo: Catalogo;
}

function ahora(): number {
  return Date.now();
}

async function leerCache(
  storage: StorageAdapter,
  ttlDias: number,
): Promise<Catalogo | null> {
  let crudo: string | null;
  try {
    crudo = await storage.getItem(CLAVE_CACHE);
  } catch {
    return null;
  }
  if (crudo === null) return null;

  let entrada: EntradaCache;
  try {
    entrada = JSON.parse(crudo) as EntradaCache;
  } catch {
    return null;
  }

  if (entrada.version !== 1 || typeof entrada.timestamp !== "number" || !entrada.catalogo) {
    return null;
  }

  const edadMs = ahora() - entrada.timestamp;
  if (edadMs > ttlDias * MS_POR_DIA) return null;

  return entrada.catalogo;
}

async function escribirCache(storage: StorageAdapter, catalogo: Catalogo): Promise<void> {
  const entrada: EntradaCache = { version: 1, timestamp: ahora(), catalogo };
  try {
    await storage.setItem(CLAVE_CACHE, JSON.stringify(entrada));
  } catch {
    // Cache es opcional; si falla la escritura el catálogo ya se obtuvo.
  }
}

export async function fetchCatalogoConCache(
  cliente: SupabaseClient,
  storage: StorageAdapter,
  opciones: OpcionesCache = {},
): Promise<Catalogo> {
  const ttlDias = opciones.ttlDias ?? TTL_DIAS_DEFAULT;
  const forzarRefetch = opciones.forzarRefetch ?? false;

  if (!forzarRefetch) {
    const cached = await leerCache(storage, ttlDias);
    if (cached) return cached;
  }

  try {
    const catalogo = await fetchCatalogo(cliente);
    await escribirCache(storage, catalogo);
    return catalogo;
  } catch (e) {
    if (!forzarRefetch) {
      const stale = await leerCacheAunqueExpirado(storage);
      if (stale) return stale;
    }
    if (e instanceof CoreError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new CoreError("NETWORK", msg, true);
  }
}

async function leerCacheAunqueExpirado(storage: StorageAdapter): Promise<Catalogo | null> {
  let crudo: string | null;
  try {
    crudo = await storage.getItem(CLAVE_CACHE);
  } catch {
    return null;
  }
  if (crudo === null) return null;
  try {
    const entrada = JSON.parse(crudo) as EntradaCache;
    if (entrada.version !== 1 || !entrada.catalogo) return null;
    return entrada.catalogo;
  } catch {
    return null;
  }
}
