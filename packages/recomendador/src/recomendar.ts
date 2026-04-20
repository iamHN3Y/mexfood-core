import type {
  Catalogo,
  OpcionesRecomendacion,
  Perfil,
  Recomendacion,
  ResultadoRecomendacion,
} from "@core/types";
import { calcularMatchScore } from "./score.js";

const TOP_N_DEFAULT = 5;
const MAX_EVITAR_DEFAULT = 5;

export function recomendarPlatillos(
  perfil: Perfil,
  catalogo: Catalogo,
  opciones: OpcionesRecomendacion = {},
): ResultadoRecomendacion {
  const topN = opciones.topN ?? TOP_N_DEFAULT;
  const diversificar = opciones.diversificar ?? true;
  const incluirEvitar = opciones.incluirEvitar ?? true;
  const maxEvitar = opciones.maxEvitar ?? MAX_EVITAR_DEFAULT;

  const platillosPorId = new Map(catalogo.platillos.map((p) => [p.id, p]));

  const aptos: Recomendacion[] = [];
  const noAptos: Recomendacion[] = [];

  for (const v of catalogo.variantes) {
    const platillo = platillosPorId.get(v.idPlatillo);
    if (!platillo) continue;
    const r = calcularMatchScore(perfil, v, platillo);
    if (r.apto) aptos.push(r);
    else noAptos.push(r);
  }

  aptos.sort((a, b) => b.score - a.score);

  const recomendados = diversificar ? seleccionarDiversificando(aptos, topN) : aptos.slice(0, topN);

  const evitar = incluirEvitar ? noAptos.slice(0, maxEvitar) : [];

  return {
    recomendados,
    evitar,
    totalEvaluados: aptos.length + noAptos.length,
  };
}

function seleccionarDiversificando(ordenados: Recomendacion[], topN: number): Recomendacion[] {
  const vistos = new Set<string>();
  const seleccion: Recomendacion[] = [];
  const pospuestos: Recomendacion[] = [];

  for (const r of ordenados) {
    if (seleccion.length >= topN) break;
    if (vistos.has(r.platilloId)) {
      pospuestos.push(r);
      continue;
    }
    vistos.add(r.platilloId);
    seleccion.push(r);
  }

  if (seleccion.length < topN) {
    for (const r of pospuestos) {
      if (seleccion.length >= topN) break;
      seleccion.push(r);
    }
  }

  return seleccion;
}
