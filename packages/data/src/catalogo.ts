import type { SupabaseClient } from "@supabase/supabase-js";
import { CoreError, type Catalogo } from "@core/types";
import {
  filaAPlatillo,
  filaAVariante,
  type FilaPlatillo,
  type FilaVariante,
} from "./mapeo.js";

const COLUMNAS_PLATILLO =
  "id_platillo,nombre_es,categoria,subcategoria,estado_tipico,region_tipica,descripcion_es,tipo_estructura,personalizable,nivel_picante_base,riesgo_digestivo_base,nota_cultural_es,recomendacion_turista_es,activo";

const COLUMNAS_VARIANTE =
  "id_variante,id_platillo,nombre_variante_es,tipo_variante,ingredientes_es,alergenos,contiene_cerdo,contiene_mariscos,contiene_lacteos,contiene_gluten,contiene_alcohol,apto_vegetariano,apto_vegano,nivel_picante,riesgo_digestivo,observaciones_es";

export async function fetchCatalogo(cliente: SupabaseClient): Promise<Catalogo> {
  const [platillosRes, variantesRes] = await Promise.all([
    cliente.from("platillos").select(COLUMNAS_PLATILLO).eq("activo", true),
    cliente.from("variantes").select(COLUMNAS_VARIANTE),
  ]);

  if (platillosRes.error) {
    throw new CoreError(
      "SUPABASE",
      `No se pudo leer platillos: ${platillosRes.error.message}`,
      true,
    );
  }
  if (variantesRes.error) {
    throw new CoreError(
      "SUPABASE",
      `No se pudieron leer variantes: ${variantesRes.error.message}`,
      true,
    );
  }

  const filasPlatillo = (platillosRes.data ?? []) as FilaPlatillo[];
  const filasVariante = (variantesRes.data ?? []) as FilaVariante[];

  try {
    return {
      platillos: filasPlatillo.map(filaAPlatillo),
      variantes: filasVariante.map(filaAVariante),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new CoreError("SUPABASE", `Catálogo malformado: ${msg}`, false);
  }
}
