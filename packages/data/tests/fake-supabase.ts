import type { SupabaseClient } from "@supabase/supabase-js";

export interface RespuestaSupabase<T = unknown> {
  data: T | null;
  error: { message: string } | null;
}

export interface EscenarioSupabase {
  platillos?: RespuestaSupabase<unknown[]>;
  variantes?: RespuestaSupabase<unknown[]>;
  insertFeedback?: { error: { message: string } | null };
}

export interface FakeSupabase {
  cliente: SupabaseClient;
  llamadas: {
    from: string[];
    select: Array<{ tabla: string; columnas: string }>;
    eq: Array<{ tabla: string; columna: string; valor: unknown }>;
    insert: Array<{ tabla: string; fila: unknown }>;
  };
}

function respuestaVacia(): RespuestaSupabase<unknown[]> {
  return { data: [], error: null };
}

export function crearFakeSupabase(escenario: EscenarioSupabase = {}): FakeSupabase {
  const llamadas: FakeSupabase["llamadas"] = {
    from: [],
    select: [],
    eq: [],
    insert: [],
  };

  const clienteFake = {
    from(tabla: string) {
      llamadas.from.push(tabla);

      if (tabla === "platillos" || tabla === "variantes") {
        const resultado =
          tabla === "platillos"
            ? (escenario.platillos ?? respuestaVacia())
            : (escenario.variantes ?? respuestaVacia());

        const thenable = {
          eq(columna: string, valor: unknown) {
            llamadas.eq.push({ tabla, columna, valor });
            return thenable;
          },
          then<R1 = RespuestaSupabase, R2 = never>(
            onFulfilled?: (v: RespuestaSupabase) => R1 | PromiseLike<R1>,
            onRejected?: (e: unknown) => R2 | PromiseLike<R2>,
          ): Promise<R1 | R2> {
            return Promise.resolve(resultado).then(onFulfilled, onRejected);
          },
        };

        return {
          select(columnas: string) {
            llamadas.select.push({ tabla, columnas });
            return thenable;
          },
        };
      }

      if (tabla === "feedback") {
        return {
          async insert(fila: unknown) {
            llamadas.insert.push({ tabla, fila });
            return {
              data: null,
              error: escenario.insertFeedback?.error ?? null,
            };
          },
        };
      }

      throw new Error(`Fake supabase: tabla inesperada '${tabla}'`);
    },
  };

  return {
    cliente: clienteFake as unknown as SupabaseClient,
    llamadas,
  };
}

export function crearStorageFake(inicial?: Record<string, string>): {
  storage: { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> };
  mapa: Map<string, string>;
  errorAlLeer: { activo: boolean };
  errorAlEscribir: { activo: boolean };
} {
  const mapa = new Map<string, string>(Object.entries(inicial ?? {}));
  const errorAlLeer = { activo: false };
  const errorAlEscribir = { activo: false };

  return {
    mapa,
    errorAlLeer,
    errorAlEscribir,
    storage: {
      async getItem(k) {
        if (errorAlLeer.activo) throw new Error("storage read error");
        return mapa.get(k) ?? null;
      },
      async setItem(k, v) {
        if (errorAlEscribir.activo) throw new Error("storage write error");
        mapa.set(k, v);
      },
    },
  };
}
