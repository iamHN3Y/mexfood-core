import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfianzaOCR, EntradaMenuCache } from "@core/types";

export type { EntradaMenuCache };

export async function fetchMenuCache(
  cliente: SupabaseClient,
  hashImagen: string,
): Promise<EntradaMenuCache | null> {
  try {
    const { data, error } = await cliente
      .from("menus_escaneados")
      .select("items, confianza_ocr")
      .eq("hash_imagen", hashImagen)
      .maybeSingle();

    if (error) {
      console.warn(`[@core/data] fetchMenuCache falló: ${error.message}`);
      return null;
    }
    if (!data) return null;

    const items = data.items;
    if (!Array.isArray(items)) return null;
    const textos: string[] = [];
    for (const it of items) {
      if (typeof it === "string") textos.push(it);
    }

    const confianza = data.confianza_ocr as ConfianzaOCR;
    if (confianza !== "alta" && confianza !== "media" && confianza !== "baja") {
      return null;
    }

    return { items: textos, confianzaOCR: confianza };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[@core/data] fetchMenuCache excepción: ${msg}`);
    return null;
  }
}

export async function guardarMenuCache(
  cliente: SupabaseClient,
  hashImagen: string,
  entrada: EntradaMenuCache,
): Promise<void> {
  try {
    const { error } = await cliente.from("menus_escaneados").upsert(
      {
        hash_imagen: hashImagen,
        items: entrada.items,
        confianza_ocr: entrada.confianzaOCR,
      },
      { onConflict: "hash_imagen" },
    );
    if (error) {
      console.warn(`[@core/data] guardarMenuCache falló: ${error.message}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[@core/data] guardarMenuCache excepción: ${msg}`);
  }
}
