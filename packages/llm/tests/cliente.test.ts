import { describe, expect, it } from "vitest";
import { crearLlmClient } from "../src/cliente.js";
import { crearFakeFetch } from "./fake-fetch.js";

const URL_FALSA = "https://proyecto.supabase.co/functions/v1/llm";

describe("crearLlmClient", () => {
  it("envía POST con Authorization Bearer y apikey", async () => {
    const { fn, llamadas } = crearFakeFetch({
      respuesta: { ok: true, datos: { texto: "hola" } },
    });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "KEY123", fetch: fn });

    await cliente.invocar({ accion: "explicar", datos: { x: 1 } });

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toBe(URL_FALSA);
    const headers = llamadas[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer KEY123");
    expect(headers.apikey).toBe("KEY123");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(llamadas[0]?.init?.method).toBe("POST");
  });

  it("serializa el payload como JSON", async () => {
    const { fn, llamadas } = crearFakeFetch({
      respuesta: { ok: true, datos: {} },
    });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "K", fetch: fn });

    await cliente.invocar({ accion: "frases", datos: { foo: "bar" } });

    const body = JSON.parse(llamadas[0]?.init?.body as string);
    expect(body).toEqual({ accion: "frases", datos: { foo: "bar" } });
  });

  it("devuelve respuesta ok cuando el servidor responde 200 con forma válida", async () => {
    const { fn } = crearFakeFetch({
      respuesta: { ok: true, datos: { texto: "hola" } },
    });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "K", fetch: fn });

    const res = await cliente.invocar({ accion: "explicar", datos: {} });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.datos).toEqual({ texto: "hola" });
  });

  it("devuelve error con HTTP status cuando el server responde !ok", async () => {
    const { fn } = crearFakeFetch({ status: 500 });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "K", fetch: fn });

    const res = await cliente.invocar({ accion: "explicar", datos: {} });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("500");
  });

  it("devuelve error 'timeout' cuando el fetch se aborta", async () => {
    const { fn } = crearFakeFetch({ retrasoMs: 100 });
    const cliente = crearLlmClient({
      url: URL_FALSA,
      anonKey: "K",
      fetch: fn,
      timeoutMs: 20,
    });

    const res = await cliente.invocar({ accion: "explicar", datos: {} });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("timeout");
  });

  it("devuelve error cuando fetch lanza", async () => {
    const { fn } = crearFakeFetch({ lanzar: new Error("network fail") });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "K", fetch: fn });

    const res = await cliente.invocar({ accion: "explicar", datos: {} });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("network fail");
  });

  it("devuelve error 'Respuesta malformada' cuando el body no es la forma esperada", async () => {
    const { fn } = crearFakeFetch({ respuesta: { foo: "bar" } });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "K", fetch: fn });

    const res = await cliente.invocar({ accion: "explicar", datos: {} });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Respuesta malformada");
  });

  it("pasa error del servidor tal cual si ok:false y error:string", async () => {
    const { fn } = crearFakeFetch({
      respuesta: { ok: false, error: "cuota excedida" },
    });
    const cliente = crearLlmClient({ url: URL_FALSA, anonKey: "K", fetch: fn });

    const res = await cliente.invocar({ accion: "explicar", datos: {} });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("cuota excedida");
  });
});
