export type Nivel = "bajo" | "medio" | "alto";

export type IdiomaISO = "es" | "en" | "fr" | "de" | "pt" | "it" | "ja" | "ar" | "zh";

export interface Dieta {
  vegetariano: boolean;
  vegano: boolean;
  pescetariano: boolean;
  // Keto: alta ingesta de grasas saludables, baja en carbohidratos.
  // Ortogonal a vegano/vegetariano/pescetariano (puede combinarse).
  // No se usa como hard filter; aplica penalizaciones de score a
  // variantes altas en carbos (tortilla, arroz, pan, masa, azúcar).
  keto: boolean;
}

export interface Restricciones {
  sinGluten: boolean;
  sinLacteos: boolean;
}

export interface Perfil {
  alergias: string[];
  dieta: Dieta;
  restricciones: Restricciones;
  evitaCerdo: boolean;
  evitaAlcohol: boolean;
  evitaMariscos: boolean;

  toleranciaPicante: Nivel;
  estomagoSensible: boolean;
  ingredientesEvitar: string[];
  ingredientesFavoritos: string[];

  estadoActual: string;
  idioma: IdiomaISO;
}
