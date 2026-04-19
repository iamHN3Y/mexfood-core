import type {
  Categoria,
  Nivel,
  Platillo,
  TipoEstructura,
  Variante,
} from "@core/types";

export interface FilaPlatillo {
  id_platillo: string;
  nombre_es: string;
  categoria: Categoria;
  subcategoria: string;
  estado_tipico: string;
  region_tipica: string;
  descripcion_es: string;
  tipo_estructura: TipoEstructura;
  personalizable: boolean;
  nivel_picante_base: Nivel;
  riesgo_digestivo_base: Nivel;
  nota_cultural_es: string;
  recomendacion_turista_es: string;
  activo: boolean;
}

export interface FilaVariante {
  id_variante: string;
  id_platillo: string;
  nombre_variante_es: string;
  tipo_variante: string;
  ingredientes_es: unknown;
  alergenos: unknown;
  contiene_cerdo: boolean;
  contiene_mariscos: boolean;
  contiene_lacteos: boolean;
  contiene_gluten: boolean;
  contiene_alcohol: boolean;
  apto_vegetariano: boolean;
  apto_vegano: boolean;
  nivel_picante: Nivel;
  riesgo_digestivo: Nivel;
  observaciones_es: string;
}

function asStringArray(valor: unknown, campo: string, id: string): string[] {
  if (!Array.isArray(valor)) {
    throw new Error(`${campo} en ${id} no es un array: ${JSON.stringify(valor)}`);
  }
  return valor.map((x, i) => {
    if (typeof x !== "string") {
      throw new Error(`${campo}[${i}] en ${id} no es string: ${JSON.stringify(x)}`);
    }
    return x;
  });
}

export function filaAPlatillo(fila: FilaPlatillo): Platillo {
  return {
    id: fila.id_platillo,
    nombre: fila.nombre_es,
    categoria: fila.categoria,
    subcategoria: fila.subcategoria,
    estadoTipico: fila.estado_tipico,
    regionTipica: fila.region_tipica,
    descripcion: fila.descripcion_es,
    tipoEstructura: fila.tipo_estructura,
    personalizable: fila.personalizable,
    nivelPicanteBase: fila.nivel_picante_base,
    riesgoDigestivoBase: fila.riesgo_digestivo_base,
    notaCultural: fila.nota_cultural_es,
    recomendacionTurista: fila.recomendacion_turista_es,
    activo: fila.activo,
  };
}

export function filaAVariante(fila: FilaVariante): Variante {
  return {
    id: fila.id_variante,
    idPlatillo: fila.id_platillo,
    nombre: fila.nombre_variante_es,
    tipoVariante: fila.tipo_variante,
    ingredientes: asStringArray(fila.ingredientes_es, "ingredientes_es", fila.id_variante),
    alergenos: asStringArray(fila.alergenos, "alergenos", fila.id_variante),
    contieneCerdo: fila.contiene_cerdo,
    contieneMariscos: fila.contiene_mariscos,
    contieneLacteos: fila.contiene_lacteos,
    contieneGluten: fila.contiene_gluten,
    contieneAlcohol: fila.contiene_alcohol,
    aptoVegetariano: fila.apto_vegetariano,
    aptoVegano: fila.apto_vegano,
    nivelPicante: fila.nivel_picante,
    riesgoDigestivo: fila.riesgo_digestivo,
    observaciones: fila.observaciones_es,
  };
}
