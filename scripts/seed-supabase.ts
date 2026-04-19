import "dotenv/config";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cargarCatalogoDesdeArchivos } from "@core/parser";
import type { Platillo, Variante } from "@core/types";

const ROOT = resolve(import.meta.dirname, "..");
const DATA_DIR = resolve(ROOT, "data");
const TAMANO_BATCH = 50;

function filaPlatillo(p: Platillo) {
  return {
    id_platillo: p.id,
    nombre_es: p.nombre,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    estado_tipico: p.estadoTipico,
    region_tipica: p.regionTipica,
    descripcion_es: p.descripcion,
    tipo_estructura: p.tipoEstructura,
    personalizable: p.personalizable,
    nivel_picante_base: p.nivelPicanteBase,
    riesgo_digestivo_base: p.riesgoDigestivoBase,
    nota_cultural_es: p.notaCultural,
    recomendacion_turista_es: p.recomendacionTurista,
    activo: p.activo,
  };
}

function filaVariante(v: Variante) {
  return {
    id_variante: v.id,
    id_platillo: v.idPlatillo,
    nombre_variante_es: v.nombre,
    tipo_variante: v.tipoVariante,
    ingredientes_es: v.ingredientes,
    alergenos: v.alergenos,
    contiene_cerdo: v.contieneCerdo,
    contiene_mariscos: v.contieneMariscos,
    contiene_lacteos: v.contieneLacteos,
    contiene_gluten: v.contieneGluten,
    contiene_alcohol: v.contieneAlcohol,
    apto_vegetariano: v.aptoVegetariano,
    apto_vegano: v.aptoVegano,
    nivel_picante: v.nivelPicante,
    riesgo_digestivo: v.riesgoDigestivo,
    observaciones_es: v.observaciones,
  };
}

function enBatches<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function upsertEnBatches<T extends Record<string, unknown>>(
  supa: SupabaseClient,
  tabla: string,
  filas: T[],
  onConflict: string,
): Promise<void> {
  const batches = enBatches(filas, TAMANO_BATCH);
  for (const [i, batch] of batches.entries()) {
    const { error } = await supa.from(tabla).upsert(batch, { onConflict });
    if (error) {
      console.error(`✗ ${tabla} batch ${i + 1}/${batches.length}: ${error.message}`);
      throw error;
    }
    console.log(`  ${tabla} batch ${i + 1}/${batches.length} (${batch.length} filas)`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  console.log("Leyendo CSVs...");
  const catalogo = await cargarCatalogoDesdeArchivos(
    resolve(DATA_DIR, "platillos.csv"),
    resolve(DATA_DIR, "variantes_platillo.csv"),
  );
  console.log(`  ${catalogo.platillos.length} platillos + ${catalogo.variantes.length} variantes`);

  if (dryRun) {
    console.log("\n--dry-run: no se escribe a Supabase. Saliendo.");
    return;
  }

  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    console.error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Ver .env.example y crear .env.",
    );
    process.exit(1);
  }

  const supa = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\nUpsert a platillos...");
  await upsertEnBatches(supa, "platillos", catalogo.platillos.map(filaPlatillo), "id_platillo");

  console.log("\nUpsert a variantes...");
  await upsertEnBatches(supa, "variantes", catalogo.variantes.map(filaVariante), "id_variante");

  console.log("\n✔ Seed completado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
