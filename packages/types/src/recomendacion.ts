export type ColorSemaforo = "verde" | "amarillo" | "naranja" | "rojo";

export type EtiquetaRecomendacion =
  | "Muy recomendable"
  | "Compatible con precauciones"
  | "Con reservas"
  | "No recomendable";

export interface Recomendacion {
  varianteId: string;
  platilloId: string;
  score: number;
  apto: boolean;
  etiqueta: EtiquetaRecomendacion;
  color: ColorSemaforo;
  razonesPositivas: string[];
  razonesNegativas: string[];
  advertencias: string[];
  razonBloqueo?: string;
}

export interface ResultadoRecomendacion {
  recomendados: Recomendacion[];
  evitar: Recomendacion[];
  totalEvaluados: number;
}

export interface OpcionesRecomendacion {
  topN?: number;
  diversificar?: boolean;
  incluirEvitar?: boolean;
  maxEvitar?: number;
}
