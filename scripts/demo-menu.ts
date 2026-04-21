import "dotenv/config";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { crearDataClient } from "@core/data";
import { analizarMenu, crearLlmClient } from "@core/llm";
import type { AnalisisMenu, Catalogo, ItemMenuDetectado, Perfil } from "@core/types";

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
  estadoActual: "Ciudad de México",
  idioma: "es",
};

const MIME_POR_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

function separador(titulo: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(titulo);
  console.log("=".repeat(72));
}

function formatearItem(it: ItemMenuDetectado, i: number): string {
  const marca = it.color ? `[${it.color.toUpperCase()}]` : "[—]";
  const score = typeof it.score === "number" ? `score ${it.score}` : "sin score";
  const match = it.matchPlatillo ? `→ ${it.matchPlatillo.nombre}` : "→ (no match)";
  return [`${i + 1}. ${marca} "${it.textoOriginal}" ${match} · ${score}`, `   ${it.motivo}`].join(
    "\n",
  );
}

async function main(): Promise<void> {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error(
      "Uso: npm run demo:menu -- <ruta-imagen>\nEj:  npm run demo:menu -- pruebas/la-dona-comida-mexicana.jpg",
    );
    process.exit(1);
  }

  const url = process.env["SUPABASE_URL"];
  const anonKey = process.env["SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    console.error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env");
    process.exit(1);
  }

  const rutaAbs = resolve(process.cwd(), argPath);
  const ext = extname(rutaAbs).toLowerCase();
  const mimeType = MIME_POR_EXT[ext];
  if (!mimeType) {
    console.error(`Extensión no soportada: ${ext}. Usa jpg/png/webp/heic.`);
    process.exit(1);
  }

  separador("Entrada");
  console.log(`  Imagen:  ${rutaAbs}`);
  console.log(`  Tipo:    ${mimeType}`);
  console.log(`  Perfil:  vegetariano · picante bajo · alergia cacahuate · CDMX`);

  separador("1. Leyendo imagen y codificando base64");
  const t0 = Date.now();
  const bytes = await readFile(rutaAbs);
  const base64 = bytes.toString("base64");
  console.log(
    `  ${(bytes.length / 1024).toFixed(1)} KB → ${(base64.length / 1024).toFixed(1)} KB base64 (${Date.now() - t0} ms)`,
  );

  separador("2. Cargando catálogo desde Supabase");
  const t1 = Date.now();
  const data = crearDataClient({ url, anonKey });
  const catalogo: Catalogo = await data.fetchCatalogo();
  console.log(
    `  ${catalogo.platillos.length} platillos + ${catalogo.variantes.length} variantes (${Date.now() - t1} ms)`,
  );

  separador("3. Analizando menú (Gemini visión + matching local)");
  const llm = crearLlmClient({
    url: `${url}/functions/v1/llm`,
    anonKey,
    timeoutMs: 20000,
  });

  const t2 = Date.now();
  const analisis: AnalisisMenu = await analizarMenu(llm, base64, PERFIL_DEMO, catalogo, {
    mimeType,
  });
  const dur = Date.now() - t2;

  console.log(
    `  ${analisis.itemsDetectados.length} items detectados · confianzaOCR: ${analisis.confianzaOCR} (${dur} ms)`,
  );

  if (analisis.itemsDetectados.length === 0) {
    console.log(
      "\n  (Sin items detectados — la imagen quizás no era legible como menú o el LLM falló.)",
    );
  } else {
    console.log("");
    analisis.itemsDetectados.forEach((it, i) => console.log(formatearItem(it, i)));
  }

  const matcheados = analisis.itemsDetectados.filter((it) => it.matchPlatillo).length;
  const bloqueados = analisis.itemsDetectados.filter((it) => it.color === "rojo").length;
  const verdes = analisis.itemsDetectados.filter((it) => it.color === "verde").length;

  separador("Resumen");
  console.log(`  Total detectados:    ${analisis.itemsDetectados.length}`);
  console.log(
    `  Matcheados al catálogo: ${matcheados}/${analisis.itemsDetectados.length}`,
  );
  console.log(`  Verdes (recomendables):  ${verdes}`);
  console.log(`  Rojos (evitar):          ${bloqueados}`);
}

main().catch((e) => {
  console.error("\n✗ Demo-menu falló:", e);
  process.exit(1);
});
