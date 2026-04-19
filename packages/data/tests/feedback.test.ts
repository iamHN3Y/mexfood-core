import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registrarFeedback } from "../src/feedback.js";
import { crearFakeSupabase } from "./fake-supabase.js";

describe("registrarFeedback", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserta fila con variante_id y util, omitiendo perfil_hash si no viene", async () => {
    const { cliente, llamadas } = crearFakeSupabase();
    await registrarFeedback(cliente, "VAR001", true);

    expect(llamadas.insert).toEqual([
      { tabla: "feedback", fila: { variante_id: "VAR001", util: true } },
    ]);
  });

  it("incluye perfil_hash cuando se pasa", async () => {
    const { cliente, llamadas } = crearFakeSupabase();
    await registrarFeedback(cliente, "VAR001", false, "abc123");

    expect(llamadas.insert[0]?.fila).toEqual({
      variante_id: "VAR001",
      util: false,
      perfil_hash: "abc123",
    });
  });

  it("no lanza si Supabase devuelve error; solo loggea warning", async () => {
    const { cliente } = crearFakeSupabase({
      insertFeedback: { error: { message: "RLS rechazó el insert" } },
    });

    await expect(registrarFeedback(cliente, "VAR001", true)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("RLS rechazó"));
  });

  it("no lanza si el cliente tira excepción; loggea warning", async () => {
    const clienteRoto = {
      from() {
        throw new Error("cliente muerto");
      },
    } as unknown as Parameters<typeof registrarFeedback>[0];

    await expect(registrarFeedback(clienteRoto, "VAR001", true)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("cliente muerto"));
  });
});
