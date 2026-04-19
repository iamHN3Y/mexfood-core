import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Catalogo } from "@core/types";
import { fetchCatalogo } from "./catalogo.js";
import {
  fetchCatalogoConCache,
  type OpcionesCache,
  type StorageAdapter,
} from "./cache.js";
import { registrarFeedback } from "./feedback.js";

export interface ConfigDataClient {
  url: string;
  anonKey: string;
}

export interface DataClient {
  fetchCatalogo(): Promise<Catalogo>;
  fetchCatalogoConCache(
    storage: StorageAdapter,
    opciones?: OpcionesCache,
  ): Promise<Catalogo>;
  registrarFeedback(
    varianteId: string,
    util: boolean,
    perfilHash?: string,
  ): Promise<void>;
}

export function crearClienteSupabase(config: ConfigDataClient): SupabaseClient {
  if (!config.url) throw new Error("crearClienteSupabase: falta url");
  if (!config.anonKey) throw new Error("crearClienteSupabase: falta anonKey");
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function crearDataClient(config: ConfigDataClient): DataClient {
  const supa = crearClienteSupabase(config);
  return {
    fetchCatalogo: () => fetchCatalogo(supa),
    fetchCatalogoConCache: (storage, opciones) =>
      fetchCatalogoConCache(supa, storage, opciones),
    registrarFeedback: (varianteId, util, perfilHash) =>
      registrarFeedback(supa, varianteId, util, perfilHash),
  };
}
