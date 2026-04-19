import type { SupabaseClient } from "@supabase/supabase-js";

export async function registrarFeedback(
  cliente: SupabaseClient,
  varianteId: string,
  util: boolean,
  perfilHash?: string,
): Promise<void> {
  try {
    const fila: { variante_id: string; util: boolean; perfil_hash?: string } = {
      variante_id: varianteId,
      util,
    };
    if (perfilHash !== undefined) fila.perfil_hash = perfilHash;

    const { error } = await cliente.from("feedback").insert(fila);
    if (error) {
      console.warn(`[@core/data] registrarFeedback falló: ${error.message}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[@core/data] registrarFeedback excepción: ${msg}`);
  }
}
