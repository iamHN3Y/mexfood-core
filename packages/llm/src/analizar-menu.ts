import type { AnalisisMenu, Catalogo, ConfianzaOCR, ItemMenuDetectado, Perfil } from "@core/types";
import { calcularMatchScore } from "@core/recomendador";
import type { LlmClient } from "./cliente.js";
import { encontrarMejorMatch } from "./matcher.js";
import type { MenuCache } from "./menu-cache.js";

export interface OpcionesAnalizarMenu {
  mimeType?: string;
  cache?: MenuCache;
  hashImagen?: string;
}

export async function analizarMenu(
  cliente: LlmClient,
  imagenBase64: string,
  perfil: Perfil,
  catalogo: Catalogo,
  opciones: OpcionesAnalizarMenu = {},
): Promise<AnalisisMenu> {
  const { cache, hashImagen } = opciones;

  if (cache && hashImagen) {
    const hit = await cache.get(hashImagen);
    if (hit) return construirAnalisis(hit.items, perfil, catalogo);
  }

  const res = await cliente.invocar({
    accion: "analizar-menu",
    datos: { imagenBase64, mimeType: opciones.mimeType ?? "image/jpeg" },
  });

  if (!res.ok) return plantillaAnalisisMenu();

  const textos = parsearItems(res.datos);
  if (textos === null) return plantillaAnalisisMenu();

  const analisis = construirAnalisis(textos, perfil, catalogo);

  if (cache && hashImagen) {
    void cache.set(hashImagen, { items: textos, confianzaOCR: analisis.confianzaOCR });
  }

  return analisis;
}

export function plantillaAnalisisMenu(): AnalisisMenu {
  return { itemsDetectados: [], confianzaOCR: "baja" };
}

function parsearItems(datos: unknown): string[] | null {
  if (typeof datos !== "object" || datos === null) return null;
  const items = (datos as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const textos: string[] = [];
  for (const it of items) {
    if (typeof it === "string" && it.trim() !== "") textos.push(it.trim());
  }
  return textos;
}

function construirAnalisis(textos: string[], perfil: Perfil, catalogo: Catalogo): AnalisisMenu {
  const itemsDetectados: ItemMenuDetectado[] = [];
  let matcheados = 0;

  for (const texto of textos) {
    const match = encontrarMejorMatch(texto, catalogo);
    if (!match) {
      itemsDetectados.push({
        textoOriginal: texto,
        motivo: "No lo encontramos en el catálogo.",
      });
      continue;
    }

    matcheados++;

    if (!match.variante) {
      itemsDetectados.push({
        textoOriginal: texto,
        matchPlatillo: match.platillo,
        motivo: motivoSinVariante(match.platillo),
      });
      continue;
    }

    const recomendacion = calcularMatchScore(perfil, match.variante, match.platillo);
    const motivo = armarMotivo(recomendacion);

    itemsDetectados.push({
      textoOriginal: texto,
      matchPlatillo: match.platillo,
      score: recomendacion.score,
      color: recomendacion.color,
      motivo,
    });
  }

  return { itemsDetectados, confianzaOCR: calcularConfianza(textos.length, matcheados) };
}

function motivoSinVariante(platillo: { estadoTipico?: string; regionTipica?: string }): string {
  const origen = platillo.estadoTipico ?? platillo.regionTipica;
  return origen
    ? `Típico de ${origen}. Sin info de ingredientes — pregunta antes de pedir.`
    : "Encontrado en el catálogo. Sin info de ingredientes — pregunta antes de pedir.";
}

function armarMotivo(r: {
  apto: boolean;
  razonBloqueo?: string;
  razonesPositivas: string[];
  razonesNegativas: string[];
  etiqueta: string;
}): string {
  if (!r.apto) return r.razonBloqueo ?? "No es compatible con tu perfil.";
  const partes: string[] = [r.etiqueta];
  if (r.razonesPositivas[0]) partes.push(r.razonesPositivas[0]);
  if (r.razonesNegativas[0]) partes.push(r.razonesNegativas[0]);
  return partes.join(" · ");
}

function calcularConfianza(total: number, matcheados: number): ConfianzaOCR {
  if (total === 0) return "baja";
  const ratio = matcheados / total;
  if (ratio >= 0.7) return "alta";
  if (ratio >= 0.4) return "media";
  return "baja";
}
