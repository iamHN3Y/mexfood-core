import { describe, expect, it, vi } from "vitest";
import type { LlmClient } from "../src/cliente.js";
import { generarExplicacion } from "../src/explicacion.js";
import {
  perfilBase,
  platilloBase,
  recomendacionApta,
  recomendacionBloqueada,
  varianteBase,
} from "./fixtures.js";

function clienteFake(respuesta: Awaited<ReturnType<LlmClient["invocar"]>>): {
  cliente: LlmClient;
  invocar: ReturnType<typeof vi.fn>;
} {
  const invocar = vi.fn(async () => respuesta);
  return { cliente: { invocar }, invocar };
}

describe("generarExplicacion", () => {
  it("devuelve fuente 'llm' cuando el cliente responde con texto válido", async () => {
    const { cliente, invocar } = clienteFake({
      ok: true,
      datos: {
        texto: "El pastor es un clásico de CDMX.",
        tipCultural: "Se come al atardecer.",
      },
    });

    const r = await generarExplicacion(
      cliente,
      perfilBase(),
      recomendacionApta(),
      platilloBase(),
      varianteBase(),
    );

    expect(r.fuente).toBe("llm");
    expect(r.texto).toBe("El pastor es un clásico de CDMX.");
    expect(r.tipCultural).toBe("Se come al atardecer.");
    expect(invocar).toHaveBeenCalledWith({
      accion: "explicar",
      datos: expect.objectContaining({
        perfil: expect.any(Object),
        recomendacion: expect.any(Object),
        platillo: expect.any(Object),
        variante: expect.any(Object),
      }),
    });
  });

  it("cae a plantilla cuando el cliente falla con error de red", async () => {
    const { cliente } = clienteFake({ ok: false, error: "network" });

    const r = await generarExplicacion(
      cliente,
      perfilBase(),
      recomendacionApta(),
      platilloBase(),
      varianteBase(),
    );

    expect(r.fuente).toBe("plantilla");
    expect(r.texto).toContain("Taco al pastor");
  });

  it("cae a plantilla cuando el cliente responde con datos malformados", async () => {
    const { cliente } = clienteFake({ ok: true, datos: { foo: "bar" } });

    const r = await generarExplicacion(
      cliente,
      perfilBase(),
      recomendacionApta(),
      platilloBase(),
      varianteBase(),
    );

    expect(r.fuente).toBe("plantilla");
  });

  it("cae a plantilla cuando el texto es string vacío", async () => {
    const { cliente } = clienteFake({ ok: true, datos: { texto: "   " } });

    const r = await generarExplicacion(
      cliente,
      perfilBase(),
      recomendacionApta(),
      platilloBase(),
      varianteBase(),
    );

    expect(r.fuente).toBe("plantilla");
  });

  it("omite campos opcionales cuando el LLM no los manda", async () => {
    const { cliente } = clienteFake({
      ok: true,
      datos: { texto: "texto mínimo válido" },
    });

    const r = await generarExplicacion(
      cliente,
      perfilBase(),
      recomendacionApta(),
      platilloBase(),
      varianteBase(),
    );

    expect(r.fuente).toBe("llm");
    expect(r.tipCultural).toBeUndefined();
    expect(r.advertencia).toBeUndefined();
  });

  it("usa plantilla bloqueada cuando la recomendación no es apta y el LLM falla", async () => {
    const { cliente } = clienteFake({ ok: false, error: "timeout" });

    const r = await generarExplicacion(
      cliente,
      perfilBase(),
      recomendacionBloqueada(),
      platilloBase(),
      varianteBase(),
    );

    expect(r.fuente).toBe("plantilla");
    expect(r.texto.toLowerCase()).toContain("evita");
  });

  it("nunca lanza aunque el cliente responda con forma extraña", async () => {
    const cliente: LlmClient = {
      invocar: async () => ({ ok: true, datos: null }),
    };

    await expect(
      generarExplicacion(
        cliente,
        perfilBase(),
        recomendacionApta(),
        platilloBase(),
        varianteBase(),
      ),
    ).resolves.toBeDefined();
  });
});
