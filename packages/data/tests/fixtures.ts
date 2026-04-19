import type { FilaPlatillo, FilaVariante } from "../src/mapeo.js";

export function filaPlatilloValida(overrides: Partial<FilaPlatillo> = {}): FilaPlatillo {
  return {
    id_platillo: "PL001",
    nombre_es: "Tlayuda",
    categoria: "antojito",
    subcategoria: "tlayuda",
    estado_tipico: "Oaxaca",
    region_tipica: "Sur",
    descripcion_es: "Tortilla grande con frijoles y quesillo.",
    tipo_estructura: "abierto_con_toppings",
    personalizable: true,
    nivel_picante_base: "medio",
    riesgo_digestivo_base: "bajo",
    nota_cultural_es: "Símbolo de Oaxaca.",
    recomendacion_turista_es: "Prueba con tasajo.",
    activo: true,
    ...overrides,
  };
}

export function filaVarianteValida(overrides: Partial<FilaVariante> = {}): FilaVariante {
  return {
    id_variante: "VAR001",
    id_platillo: "PL001",
    nombre_variante_es: "Tlayuda de tasajo",
    tipo_variante: "con carne",
    ingredientes_es: ["tortilla", "frijoles", "quesillo", "tasajo"],
    alergenos: ["lacteos"],
    contiene_cerdo: false,
    contiene_mariscos: false,
    contiene_lacteos: true,
    contiene_gluten: false,
    contiene_alcohol: false,
    apto_vegetariano: false,
    apto_vegano: false,
    nivel_picante: "medio",
    riesgo_digestivo: "bajo",
    observaciones_es: "",
    ...overrides,
  };
}
