import type { Catalogo, Platillo, Variante } from "@core/types";

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "con",
  "sin",
  "al",
  "en",
  "a",
  "y",
  "o",
  "u",
]);

const UMBRAL_MATCH = 0.6;

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function tokenizarSignificativos(s: string): string[] {
  return normalizar(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function sinSufijoPlural(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith("es")) return t.slice(0, -2);
  if (t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function coincidenTokens(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = sinSufijoPlural(a);
  const sb = sinSufijoPlural(b);
  if (sa === sb) return true;
  return sa.startsWith(sb) || sb.startsWith(sa);
}

export function similitud(nombreCatalogo: string, textoDetectado: string): number {
  const tokensCat = tokenizarSignificativos(nombreCatalogo);
  const tokensDet = tokenizarSignificativos(textoDetectado);
  if (tokensCat.length === 0 || tokensDet.length === 0) return 0;

  let hits = 0;
  for (const tc of tokensCat) {
    if (tokensDet.some((td) => coincidenTokens(tc, td))) hits++;
  }
  return hits / tokensCat.length;
}

export interface MejorMatch {
  platillo: Platillo;
  variante: Variante;
  puntaje: number;
}

export function encontrarMejorMatch(textoDetectado: string, catalogo: Catalogo): MejorMatch | null {
  const platillosPorId = new Map(catalogo.platillos.map((p) => [p.id, p]));

  let mejor: MejorMatch | null = null;
  const variantesPorPlatillo = new Map<string, Variante[]>();
  for (const v of catalogo.variantes) {
    const lista = variantesPorPlatillo.get(v.idPlatillo) ?? [];
    lista.push(v);
    variantesPorPlatillo.set(v.idPlatillo, lista);
  }

  for (const [platilloId, variantes] of variantesPorPlatillo) {
    const platillo = platillosPorId.get(platilloId);
    if (!platillo) continue;

    const puntajePlatillo = similitud(platillo.nombre, textoDetectado);
    let mejorVariante = variantes[0]!;
    let puntajeVariante = similitud(mejorVariante.nombre, textoDetectado);

    for (let i = 1; i < variantes.length; i++) {
      const p = similitud(variantes[i]!.nombre, textoDetectado);
      if (p > puntajeVariante) {
        puntajeVariante = p;
        mejorVariante = variantes[i]!;
      }
    }

    const puntaje = Math.max(puntajePlatillo, puntajeVariante);
    if (puntaje < UMBRAL_MATCH) continue;
    if (!mejor || puntaje > mejor.puntaje) {
      mejor = { platillo, variante: mejorVariante, puntaje };
    }
  }

  return mejor;
}
