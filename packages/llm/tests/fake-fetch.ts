export interface LlamadaFetch {
  url: string;
  init: RequestInit | undefined;
}

export interface EscenarioFetch {
  respuesta?: unknown;
  status?: number;
  lanzar?: Error;
  retrasoMs?: number;
  textoInvalido?: boolean;
}

export interface FakeFetch {
  fn: typeof fetch;
  llamadas: LlamadaFetch[];
}

export function crearFakeFetch(escenario: EscenarioFetch = {}): FakeFetch {
  const llamadas: LlamadaFetch[] = [];

  const fn: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    llamadas.push({ url, init });

    if (escenario.retrasoMs) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, escenario.retrasoMs);
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    }

    if (escenario.lanzar) {
      throw escenario.lanzar;
    }

    const status = escenario.status ?? 200;
    const body = escenario.textoInvalido
      ? "no-es-json"
      : JSON.stringify(escenario.respuesta ?? { ok: true, datos: {} });

    return new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  return { fn, llamadas };
}
