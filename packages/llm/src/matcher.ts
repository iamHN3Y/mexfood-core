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
  if (hits === 0) return 0;
  return (hits / tokensCat.length + hits / tokensDet.length) / 2;
}

export interface MejorMatch {
  platillo: Platillo;
  variante: Variante | null;
  puntaje: number;
}

export function encontrarMejorMatch(textoDetectado: string, catalogo: Catalogo): MejorMatch | null {
  const variantesPorPlatillo = new Map<string, Variante[]>();
  for (const v of catalogo.variantes) {
    const lista = variantesPorPlatillo.get(v.idPlatillo) ?? [];
    lista.push(v);
    variantesPorPlatillo.set(v.idPlatillo, lista);
  }

  let mejor: MejorMatch | null = null;
  for (const platillo of catalogo.platillos) {
    const variantes = variantesPorPlatillo.get(platillo.id) ?? [];
    const puntajePlatillo = similitud(platillo.nombre, textoDetectado);

    let mejorVariante: Variante | null = null;
    let puntajeVariante = 0;
    for (const v of variantes) {
      const p = similitud(v.nombre, textoDetectado);
      if (p > puntajeVariante) {
        puntajeVariante = p;
        mejorVariante = v;
      }
    }

    const puntaje = Math.max(puntajePlatillo, puntajeVariante);
    if (puntaje < UMBRAL_MATCH) continue;

    const variante = puntajeVariante >= puntajePlatillo ? mejorVariante : null;
    if (!mejor || puntaje > mejor.puntaje) {
      mejor = { platillo, variante, puntaje };
    }
  }

  return mejor;
}
