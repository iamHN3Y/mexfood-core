import type { Perfil, Platillo, Recomendacion, Variante } from "@core/types";

export function perfilBase(overrides: Partial<Perfil> = {}): Perfil {
  return {
    alergias: [],
    dieta: { vegetariano: false, vegano: false, pescetariano: false },
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
    notaCultural: "Clásico de CDMX, ideal al atardecer.",
    recomendacionTurista: "Pide con piña.",
    activo: true,
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

export function recomendacionApta(overrides: Partial<Recomendacion> = {}): Recomendacion {
  return {
    varianteId: "VAR001",
    platilloId: "PL001",
    score: 95,
    apto: true,
    etiqueta: "Muy recomendable",
    color: "verde",
    razonesPositivas: ["Típico de Ciudad de México, donde estás ahora"],
    razonesNegativas: [],
    advertencias: [],
    ...overrides,
  };
}

export function recomendacionBloqueada(overrides: Partial<Recomendacion> = {}): Recomendacion {
  return {
    varianteId: "VAR001",
    platilloId: "PL001",
    score: 0,
    apto: false,
    etiqueta: "No recomendable",
    color: "rojo",
    razonesPositivas: [],
    razonesNegativas: [],
    advertencias: [],
    razonBloqueo: "Contiene cerdo",
    ...overrides,
  };
}
