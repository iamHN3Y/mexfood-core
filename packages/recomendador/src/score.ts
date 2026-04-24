import type {
  ColorSemaforo,
  EtiquetaRecomendacion,
  Perfil,
  Platillo,
  Recomendacion,
  Variante,
} from "@core/types";
import { aplicarHardFilters } from "./hard-filters.js";

export const PESOS = {
  picante: {
    bajoVsMedio: -15,
    bajoVsAlto: -30,
    medioVsAlto: -15,
  },
  digestivo: {
    sensibleVsMedio: -10,
    sensibleVsAlto: -25,
  },
  ingredientesEvitar: {
    porCoincidencia: -10,
    tope: -30,
  },
  ingredientesFavoritos: {
    porCoincidencia: 5,
    tope: 15,
  },
  regional: {
    bonus: 10,
  },
  keto: {
    // Keto no bloquea (no es hard filter) — penaliza en score.
    // Heavy = base evidente de carbos (tortilla, arroz, pan, masa, azúcar, harina, gluten).
    // Medium = carbos secundarios (frijol, maíz molido, plátano frito).
    carbsHeavy: -20,
    carbsMedium: -10,
  },
} as const;

// Listas para detectar carbos en ingredientes — normalizadas (sin acento, lowercase).
// Heavy captura los carbs dominantes del platillo; medium los secundarios.
const KETO_CARBS_HEAVY = [
  "tortilla",
  "arroz",
  "pan",
  "masa",
  "harina",
  "azucar",
  "miel",
  "piloncillo",
] as const;

const KETO_CARBS_MEDIUM = [
  "frijol",
  "maiz",
  "elote",
  "platano",
  "camote",
  "papa",
] as const;

export const UMBRALES = {
  verde: 80,
  amarillo: 60,
  naranja: 40,
} as const;

interface Ajuste {
  delta: number;
  razon: string;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function coincideTexto(a: string, b: string): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x === "" || y === "") return false;
  return x === y || x.includes(y) || y.includes(x);
}

function ajustePicante(perfil: Perfil, v: Variante): Ajuste | null {
  const tol = perfil.toleranciaPicante;
  const nivel = v.nivelPicante;
  if (tol === "alto") return null;
  if (tol === "medio" && nivel === "alto") {
    return { delta: PESOS.picante.medioVsAlto, razon: "Picante alto y tu tolerancia es media" };
  }
  if (tol === "bajo" && nivel === "alto") {
    return { delta: PESOS.picante.bajoVsAlto, razon: "Picante alto y tu tolerancia es baja" };
  }
  if (tol === "bajo" && nivel === "medio") {
    return { delta: PESOS.picante.bajoVsMedio, razon: "Picante medio y tu tolerancia es baja" };
  }
  return null;
}

function ajusteDigestivo(perfil: Perfil, v: Variante): Ajuste | null {
  if (!perfil.estomagoSensible) return null;
  if (v.riesgoDigestivo === "alto") {
    return {
      delta: PESOS.digestivo.sensibleVsAlto,
      razon: "Riesgo digestivo alto y tu estómago es sensible",
    };
  }
  if (v.riesgoDigestivo === "medio") {
    return {
      delta: PESOS.digestivo.sensibleVsMedio,
      razon: "Riesgo digestivo medio y tu estómago es sensible",
    };
  }
  return null;
}

function ajustesIngredientesEvitar(perfil: Perfil, v: Variante): Ajuste[] {
  const ajustes: Ajuste[] = [];
  for (const ing of perfil.ingredientesEvitar) {
    if (normalizar(ing) === "") continue;
    if (v.ingredientes.some((i) => coincideTexto(i, ing))) {
      ajustes.push({
        delta: PESOS.ingredientesEvitar.porCoincidencia,
        razon: `Contiene ${ing}, que prefieres evitar`,
      });
    }
  }
  return ajustes;
}

function ajustesIngredientesFavoritos(perfil: Perfil, v: Variante): Ajuste[] {
  const ajustes: Ajuste[] = [];
  for (const ing of perfil.ingredientesFavoritos) {
    if (normalizar(ing) === "") continue;
    if (v.ingredientes.some((i) => coincideTexto(i, ing))) {
      ajustes.push({
        delta: PESOS.ingredientesFavoritos.porCoincidencia,
        razon: `Contiene ${ing}, uno de tus favoritos`,
      });
    }
  }
  return ajustes;
}

function ajusteKeto(perfil: Perfil, v: Variante): Ajuste | null {
  if (!perfil.dieta.keto) return null;
  // Gluten es carbo heavy por definición — usamos el flag directo.
  const ingrNorm = v.ingredientes.map(normalizar);
  const haveHeavy =
    v.contieneGluten ||
    ingrNorm.some((i) => KETO_CARBS_HEAVY.some((c) => i.includes(c)));
  if (haveHeavy) {
    return {
      delta: PESOS.keto.carbsHeavy,
      razon: "Alto en carbohidratos (no compatible con keto)",
    };
  }
  const haveMedium = ingrNorm.some((i) => KETO_CARBS_MEDIUM.some((c) => i.includes(c)));
  if (haveMedium) {
    return {
      delta: PESOS.keto.carbsMedium,
      razon: "Carbohidratos moderados (afecta tu keto)",
    };
  }
  return null;
}

function ajusteRegional(perfil: Perfil, p: Platillo): Ajuste | null {
  if (!perfil.estadoActual || !p.estadoTipico) return null;
  if (coincideTexto(perfil.estadoActual, p.estadoTipico)) {
    return {
      delta: PESOS.regional.bonus,
      razon: `Típico de ${p.estadoTipico}, donde estás ahora`,
    };
  }
  return null;
}

function capearTotal(ajustes: Ajuste[], tope: number): number {
  const total = ajustes.reduce((s, a) => s + a.delta, 0);
  if (tope < 0) return Math.max(total, tope);
  return Math.min(total, tope);
}

export function etiquetaYColor(score: number): {
  etiqueta: EtiquetaRecomendacion;
  color: ColorSemaforo;
} {
  if (score >= UMBRALES.verde) return { etiqueta: "Muy recomendable", color: "verde" };
  if (score >= UMBRALES.amarillo)
    return { etiqueta: "Compatible con precauciones", color: "amarillo" };
  if (score >= UMBRALES.naranja) return { etiqueta: "Con reservas", color: "naranja" };
  return { etiqueta: "No recomendable", color: "rojo" };
}

export function calcularMatchScore(
  perfil: Perfil,
  variante: Variante,
  platillo: Platillo,
): Recomendacion {
  const hard = aplicarHardFilters(perfil, variante);

  if (!hard.apto) {
    return {
      varianteId: variante.id,
      platilloId: variante.idPlatillo,
      score: 0,
      apto: false,
      etiqueta: "No recomendable",
      color: "rojo",
      razonesPositivas: [],
      razonesNegativas: [],
      advertencias: [],
      ...(hard.razonBloqueo !== undefined ? { razonBloqueo: hard.razonBloqueo } : {}),
    };
  }

  const positivos: Ajuste[] = [];
  const negativos: Ajuste[] = [];

  const pic = ajustePicante(perfil, variante);
  if (pic) negativos.push(pic);

  const dig = ajusteDigestivo(perfil, variante);
  if (dig) negativos.push(dig);

  const keto = ajusteKeto(perfil, variante);
  if (keto) negativos.push(keto);

  const evitar = ajustesIngredientesEvitar(perfil, variante);
  const evitarDeltaTopeado = capearTotal(evitar, PESOS.ingredientesEvitar.tope);

  const favs = ajustesIngredientesFavoritos(perfil, variante);
  const favsDeltaTopeado = capearTotal(favs, PESOS.ingredientesFavoritos.tope);

  const reg = ajusteRegional(perfil, platillo);
  if (reg) positivos.push(reg);

  const deltaPenalizaciones = negativos.reduce((s, a) => s + a.delta, 0) + evitarDeltaTopeado;
  const deltaBonos = positivos.reduce((s, a) => s + a.delta, 0) + favsDeltaTopeado;

  const raw = 100 + deltaPenalizaciones + deltaBonos;
  const score = Math.max(0, Math.min(100, raw));

  const razonesPositivas = [...positivos.map((a) => a.razon), ...favs.map((a) => a.razon)];
  const razonesNegativas = [...negativos.map((a) => a.razon), ...evitar.map((a) => a.razon)];

  const { etiqueta, color } = etiquetaYColor(score);

  return {
    varianteId: variante.id,
    platilloId: variante.idPlatillo,
    score,
    apto: true,
    etiqueta,
    color,
    razonesPositivas,
    razonesNegativas,
    advertencias: [],
  };
}
