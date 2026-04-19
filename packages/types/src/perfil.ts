export type Nivel = "bajo" | "medio" | "alto";

export type IdiomaISO = "es" | "en" | "fr" | "de" | "pt" | "it" | "ja" | "ar" | "zh";

export interface Dieta {
  vegetariano: boolean;
  vegano: boolean;
  pescetariano: boolean;
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
