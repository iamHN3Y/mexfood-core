import "dotenv/config";
import { crearDataClient } from "@core/data";
import { recomendarPlatillos } from "@core/recomendador";
import { crearLlmClient, generarExplicacion, generarFrasesParaPedir } from "@core/llm";
import type {
  Catalogo,
  Explicacion,
  Frase,
  Perfil,
  Platillo,
  Recomendacion,
  Variante,
} from "@core/types";

const PERFIL_DEMO: Perfil = {
  alergias: ["cacahuate"],
  dieta: { vegetariano: true, vegano: false, pescetariano: false },
  restricciones: { sinGluten: false, sinLacteos: false },
  evitaCerdo: true,
  evitaAlcohol: false,
  evitaMariscos: false,
  toleranciaPicante: "bajo",
  estomagoSensible: true,
  ingredientesEvitar: [],
  ingredientesFavoritos: ["queso", "aguacate"],
  estadoActual: "Oaxaca",
  idioma: "es",
};

function separador(titulo: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(titulo);
  console.log("=".repeat(72));
}

function formatearPerfil(p: Perfil): string {
  const lineas = [
    `  Estado actual: ${p.estadoActual}`,
    `  Idioma: ${p.idioma}`,
    `  Dieta: ${dietaResumen(p)}`,
    `  Alergias: ${p.alergias.length ? p.alergias.join(", ") : "ninguna"}`,
    `  Picante: tolerancia ${p.toleranciaPicante}${p.estomagoSensible ? " · estómago sensible" : ""}`,
    `  Evita: ${evitaResumen(p)}`,
    `  Favoritos: ${p.ingredientesFavoritos.length ? p.ingredientesFavoritos.join(", ") : "—"}`,
  ];
  return lineas.join("\n");
}

function dietaResumen(p: Perfil): string {
  if (p.dieta.vegano) return "vegano";
  if (p.dieta.pescetariano) return "pescetariano";
  if (p.dieta.vegetariano) return "vegetariano";
  return "omnívoro";
}

function evitaResumen(p: Perfil): string {
  const xs: string[] = [];
  if (p.evitaCerdo) xs.push("cerdo");
  if (p.evitaAlcohol) xs.push("alcohol");
  if (p.evitaMariscos) xs.push("mariscos");
  if (p.restricciones.sinGluten) xs.push("gluten");
  if (p.restricciones.sinLacteos) xs.push("lácteos");
  return xs.length ? xs.join(", ") : "—";
}

function formatearRecomendacion(
  r: Recomendacion,
  platillo: Platillo,
  variante: Variante,
  indice: number,
): string {
  const nombre = variante.nombre || platillo.nombre;
  const head = `${indice}. [${r.color.toUpperCase()}] ${r.etiqueta} · score ${r.score} — ${nombre}`;
  const sub = `   ${platillo.categoria} · ${platillo.estadoTipico || "—"}`;
  const pos = r.razonesPositivas.length ? `   + ${r.razonesPositivas.join("\n   + ")}` : "";
  const neg = r.razonesNegativas.length ? `   - ${r.razonesNegativas.join("\n   - ")}` : "";
  const adv = r.advertencias.length ? `   ! ${r.advertencias.join("\n   ! ")}` : "";
  return [head, sub, pos, neg, adv].filter(Boolean).join("\n");
}

function formatearExplicacion(e: Explicacion): string {
  const lineas = [`  [fuente: ${e.fuente}]`, `  ${e.texto}`];
  if (e.tipCultural) lineas.push(`  Tip: ${e.tipCultural}`);
  if (e.advertencia) lineas.push(`  Ojo: ${e.advertencia}`);
  return lineas.join("\n");
}

function formatearFrases(frases: Frase[]): string {
  return frases
    .map(
      (f, i) =>
        `  ${i + 1}. "${f.fraseEs}"\n     EN: ${f.traduccion}\n     [${f.pronunciacionFonetica}]`,
    )
    .join("\n\n");
}

async function main(): Promise<void> {
  const url = process.env["SUPABASE_URL"];
  const anonKey = process.env["SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    console.error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY. Ver .env.example.");
    process.exit(1);
  }

  separador("PERFIL DEMO");
  console.log(formatearPerfil(PERFIL_DEMO));

  separador("1. Cargando catálogo desde Supabase");
  const data = crearDataClient({ url, anonKey });
  const t0 = Date.now();
  const catalogo: Catalogo = await data.fetchCatalogo();
  console.log(
    `  ${catalogo.platillos.length} platillos + ${catalogo.variantes.length} variantes (${Date.now() - t0} ms)`,
  );

  separador("2. Recomendador (hard filters + scoring + orden)");
  const t1 = Date.now();
  const { recomendados, evitar, totalEvaluados } = recomendarPlatillos(PERFIL_DEMO, catalogo, {
    topN: 3,
  });
  console.log(
    `  ${totalEvaluados} variantes evaluadas → ${recomendados.length} top · ${evitar.length} para evitar (${Date.now() - t1} ms)`,
  );

  const platillosPorId = new Map(catalogo.platillos.map((p) => [p.id, p]));
  const variantesPorId = new Map(catalogo.variantes.map((v) => [v.id, v]));

  console.log("\n  -- Recomendados --");
  recomendados.forEach((r, i) => {
    const p = platillosPorId.get(r.platilloId);
    const v = variantesPorId.get(r.varianteId);
    if (p && v) console.log(formatearRecomendacion(r, p, v, i + 1));
  });

  if (evitar.length) {
    console.log("\n  -- Evitar --");
    evitar.slice(0, 3).forEach((r, i) => {
      const p = platillosPorId.get(r.platilloId);
      const v = variantesPorId.get(r.varianteId);
      if (p && v) console.log(formatearRecomendacion(r, p, v, i + 1));
    });
  }

  if (!recomendados.length) {
    console.log("\nNo hay recomendados para este perfil; saltando LLM.");
    return;
  }

  const llm = crearLlmClient({
    url: `${url}/functions/v1/llm`,
    anonKey,
    timeoutMs: 15000,
  });

  separador("3. LLM: explicación del top 1");
  const top = recomendados[0]!;
  const topP = platillosPorId.get(top.platilloId)!;
  const topV = variantesPorId.get(top.varianteId)!;
  const t2 = Date.now();
  const exp = await generarExplicacion(llm, PERFIL_DEMO, top, topP, topV);
  console.log(`  (${Date.now() - t2} ms)`);
  console.log(formatearExplicacion(exp));

  separador("4. LLM: frases para pedir el top 1");
  const t3 = Date.now();
  const frases = await generarFrasesParaPedir(llm, topP, PERFIL_DEMO);
  console.log(`  (${Date.now() - t3} ms · ${frases.length} frases)\n`);
  console.log(formatearFrases(frases));

  console.log("\n" + "=".repeat(72));
  console.log("Demo completada.");
  console.log("=".repeat(72));
}

main().catch((e) => {
  console.error("\n✗ Demo falló:", e);
  process.exit(1);
});
