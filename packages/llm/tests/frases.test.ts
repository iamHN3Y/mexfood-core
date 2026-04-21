import { describe, expect, it, vi } from "vitest";
import type { LlmClient } from "../src/cliente.js";
import { generarFrasesParaPedir } from "../src/frases.js";
import { perfilBase, platilloBase } from "./fixtures.js";

function clienteFake(respuesta: Awaited<ReturnType<LlmClient["invocar"]>>): {
  cliente: LlmClient;
  invocar: ReturnType<typeof vi.fn>;
} {
  const invocar = vi.fn(async () => respuesta);
  return { cliente: { invocar }, invocar };
}

describe("generarFrasesParaPedir", () => {
  it("devuelve frases del LLM cuando el cliente responde válido", async () => {
    const { cliente, invocar } = clienteFake({
      ok: true,
      datos: {
        frases: [
          {
            fraseEs: "¿Me trae un taco?",
            traduccion: "Could I have a taco?",
            pronunciacionFonetica: "meh trah-eh oon TAH-koh",
          },
          {
            fraseEs: "Sin cilantro.",
            traduccion: "No cilantro.",
            pronunciacionFonetica: "seen see-LAHN-troh",
          },
        ],
      },
    });

    const r = await generarFrasesParaPedir(cliente, platilloBase(), perfilBase());

    expect(r).toHaveLength(2);
    expect(r[0]?.fraseEs).toBe("¿Me trae un taco?");
    expect(invocar).toHaveBeenCalledWith({
      accion: "frases",
      datos: expect.objectContaining({
        perfil: expect.any(Object),
        platillo: expect.any(Object),
      }),
    });
  });

  it("cae a plantilla cuando el cliente falla", async () => {
    const { cliente } = clienteFake({ ok: false, error: "timeout" });

    const r = await generarFrasesParaPedir(cliente, platilloBase(), perfilBase());

    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r[0]?.fraseEs).toContain("Taco al pastor");
  });

  it("cae a plantilla cuando el array frases está vacío", async () => {
    const { cliente } = clienteFake({ ok: true, datos: { frases: [] } });

    const r = await generarFrasesParaPedir(cliente, platilloBase(), perfilBase());

    expect(r.length).toBeGreaterThan(0);
    expect(r[0]?.fraseEs).toContain("Taco al pastor");
  });

  it("cae a plantilla cuando alguna frase no tiene los 3 campos requeridos", async () => {
    const { cliente } = clienteFake({
      ok: true,
      datos: {
        frases: [
          { fraseEs: "ok", traduccion: "ok", pronunciacionFonetica: "ok" },
          { fraseEs: "falta", traduccion: "falta" },
        ],
      },
    });

    const r = await generarFrasesParaPedir(cliente, platilloBase(), perfilBase());

    expect(r[0]?.fraseEs).toContain("Taco al pastor");
  });

  it("cae a plantilla cuando datos no tiene array frases", async () => {
    const { cliente } = clienteFake({ ok: true, datos: { otra: "cosa" } });

    const r = await generarFrasesParaPedir(cliente, platilloBase(), perfilBase());

    expect(r[0]?.fraseEs).toContain("Taco al pastor");
  });

  it("nunca lanza aunque los datos sean null", async () => {
    const cliente: LlmClient = {
      invocar: async () => ({ ok: true, datos: null }),
    };

    await expect(
      generarFrasesParaPedir(cliente, platilloBase(), perfilBase()),
    ).resolves.toBeDefined();
  });
});
