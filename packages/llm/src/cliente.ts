import { CoreError } from "@core/types";

export type AccionLlm = "explicar" | "frases";

export interface PayloadLlm {
  accion: AccionLlm;
  datos: unknown;
}

export interface RespuestaLlmOk {
  ok: true;
  datos: unknown;
}

export interface RespuestaLlmError {
  ok: false;
  error: string;
}

export type RespuestaLlm = RespuestaLlmOk | RespuestaLlmError;

export interface LlmClient {
  invocar(payload: PayloadLlm): Promise<RespuestaLlm>;
}

export interface ConfiguracionLlmClient {
  url: string;
  anonKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const TIMEOUT_DEFAULT_MS = 8000;

export function crearLlmClient(config: ConfiguracionLlmClient): LlmClient {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new CoreError(
      "CONFIG",
      "No hay fetch disponible. Pasa config.fetch si el entorno no lo expone globalmente.",
    );
  }
  const timeoutMs = config.timeoutMs ?? TIMEOUT_DEFAULT_MS;

  return {
    async invocar(payload) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetchImpl(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.anonKey}`,
            apikey: config.anonKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          return { ok: false, error: `HTTP ${res.status}` };
        }

        const json = (await res.json()) as unknown;
        if (!esRespuestaLlm(json)) {
          return { ok: false, error: "Respuesta malformada" };
        }
        return json;
      } catch (err) {
        const nombre = err instanceof Error ? err.name : "";
        if (nombre === "AbortError") {
          return { ok: false, error: "timeout" };
        }
        const mensaje = err instanceof Error ? err.message : String(err);
        return { ok: false, error: mensaje };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function esRespuestaLlm(valor: unknown): valor is RespuestaLlm {
  if (typeof valor !== "object" || valor === null) return false;
  const obj = valor as Record<string, unknown>;
  if (obj.ok === true) return "datos" in obj;
  if (obj.ok === false) return typeof obj.error === "string";
  return false;
}
