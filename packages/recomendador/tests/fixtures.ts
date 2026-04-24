import type { Perfil, Platillo, Variante } from "@core/types";

export function platilloBase(overrides: Partial<Platillo> = {}): Platillo {
  return {
    id: "PL001",
    nombre: "Taco al pastor",
    categoria: "antojito",
    subcategoria: "taco",
    estadoTipico: "Ciudad de México",
    regionTipica: "Centro",
    descripcion: "Taco de cerdo adobado al estilo trompo.",
    tipoEstructura: "tortilla_rellena",
    personalizable: true,
    nivelPicanteBase: "medio",
    riesgoDigestivoBase: "medio",
    notaCultural: "Clásico de CDMX.",
    recomendacionTurista: "Pide con piña.",
    activo: true,
    ...overrides,
  };
}

export function perfilBase(overrides: Partial<Perfil> = {}): Perfil {
  return {
    alergias: [],
    dieta: { vegetariano: false, vegano: false, pescetariano: false, keto: false },
    restricciones: { sinGluten: false, sinLacteos: false },
    evitaCerdo: false,
    evitaAlcohol: false,
    evitaMariscos: false,
    toleranciaPicante: "medio",
    estomagoSensible: false,
    ingredientesEvitar: [],
    ingredientesFavoritos: [],
    estadoActual: "Ciudad de México",
    idioma: "es",
    ...overrides,
  };
}

export function varianteBase(overrides: Partial<Variante> = {}): Variante {
  return {
    id: "VAR001",
    idPlatillo: "PL001",
    nombre: "Taco al pastor",
    tipoVariante: "con carne",
    ingredientes: ["tortilla", "cerdo", "piña"],
    alergenos: [],
    contieneCerdo: true,
    contieneMariscos: false,
    contieneLacteos: false,
    contieneGluten: false,
    contieneAlcohol: false,
    aptoVegetariano: false,
    aptoVegano: false,
    nivelPicante: "medio",
    riesgoDigestivo: "medio",
    observaciones: "",
    ...overrides,
  };
}

export function varianteVegana(overrides: Partial<Variante> = {}): Variante {
  return varianteBase({
    id: "VAR_VEGAN",
    nombre: "Nopales asados",
    ingredientes: ["nopal", "cebolla", "cilantro"],
    contieneCerdo: false,
    contieneLacteos: false,
    contieneGluten: false,
    aptoVegetariano: true,
    aptoVegano: true,
    ...overrides,
  });
}

export function varianteVegetariana(overrides: Partial<Variante> = {}): Variante {
  return varianteBase({
    id: "VAR_VEG",
    nombre: "Quesadilla de queso",
    ingredientes: ["tortilla", "queso Oaxaca"],
    alergenos: ["lácteos"],
    contieneCerdo: false,
    contieneLacteos: true,
    contieneGluten: false,
    aptoVegetariano: true,
    aptoVegano: false,
    ...overrides,
  });
}

export function variantePescado(overrides: Partial<Variante> = {}): Variante {
  return varianteBase({
    id: "VAR_FISH",
    nombre: "Tacos de camarón",
    ingredientes: ["tortilla", "camarón"],
    alergenos: ["mariscos"],
    contieneCerdo: false,
    contieneMariscos: true,
    aptoVegetariano: false,
    aptoVegano: false,
    ...overrides,
  });
}
