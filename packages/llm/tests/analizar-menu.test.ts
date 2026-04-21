import { describe, expect, it } from "vitest";
import { analizarMenu, plantillaAnalisisMenu } from "../src/analizar-menu.js";
import { crearLlmClient } from "../src/cliente.js";
import { crearFakeFetch } from "./fake-fetch.js";
import { perfilBase, platilloBase, varianteBase } from "./fixtures.js";
import type { Catalogo } from "@core/types";

function catalogoDemo(): Catalogo {
  return {
    platillos: [
      platilloBase({ id: "P1", nombre: "Taco al pastor" }),
      platilloBase({
        id: "P2",
        nombre: "Mole poblano",
        descripcion: "Salsa compleja con chocolate.",
      }),
      platilloBase({
        id: "P3",
        nombre: "Chilaquiles verdes",
        descripcion: "Totopos con salsa verde.",
      }),
    ],
    variantes: [
      varianteBase({ id: "V1", idPlatillo: "P1", nombre: "Taco al pastor", contieneCerdo: true }),
      varianteBase({
        id: "V2",
        idPlatillo: "P2",
        nombre: "Mole poblano con pollo",
        contieneCerdo: false,
        ingredientes: ["pollo", "chile", "chocolate"],
      }),
      varianteBase({
        id: "V3",
        idPlatillo: "P3",
        nombre: "Chilaquiles verdes",
        contieneCerdo: false,
        ingredientes: ["totopos", "salsa verde", "queso"],
        aptoVegetariano: true,
      }),
    ],
  };
}

function clienteConRespuesta(respuesta: unknown) {
  const fake = crearFakeFetch({ respuesta });
  return {
    cliente: crearLlmClient({
      url: "http://x/functions/v1/llm",
      anonKey: "k",
      fetch: fake.fn,
    }),
    llamadas: fake.llamadas,
  };
}

describe("analizarMenu", () => {
  const perfil = perfilBase({ evitaCerdo: true });
  const catalogo = catalogoDemo();

  it("envía la imagen y mimeType al edge function", async () => {
    const { cliente, llamadas } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Taco al pastor"] },
    });
    await analizarMenu(cliente, "BASE64==", perfil, catalogo, { mimeType: "image/png" });
    const body = JSON.parse((llamadas[0]!.init!.body as string) ?? "{}");
    expect(body.accion).toBe("analizar-menu");
    expect(body.datos.imagenBase64).toBe("BASE64==");
    expect(body.datos.mimeType).toBe("image/png");
  });

  it("default a image/jpeg cuando no se pasa mimeType", async () => {
    const { cliente, llamadas } = clienteConRespuesta({
      ok: true,
      datos: { items: [] },
    });
    await analizarMenu(cliente, "abc", perfil, catalogo);
    const body = JSON.parse((llamadas[0]!.init!.body as string) ?? "{}");
    expect(body.datos.mimeType).toBe("image/jpeg");
  });

  it("happy path: todos los items matchean y reciben score/color", async () => {
    const { cliente } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Tacos al pastor", "Chilaquiles verdes", "Mole poblano con pollo"] },
    });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);

    expect(analisis.itemsDetectados).toHaveLength(3);
    expect(analisis.confianzaOCR).toBe("alta");

    const pastor = analisis.itemsDetectados[0]!;
    expect(pastor.matchPlatillo?.id).toBe("P1");
    expect(pastor.color).toBe("rojo"); // bloqueado por evitaCerdo
    expect(pastor.motivo).toMatch(/cerdo/i);

    const chila = analisis.itemsDetectados[1]!;
    expect(chila.matchPlatillo?.id).toBe("P3");
    expect(chila.score).toBeGreaterThan(0);
    expect(chila.color).toBeDefined();
  });

  it("items no encontrados se reportan con motivo", async () => {
    const { cliente } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Ensalada César", "Pizza hawaiana"] },
    });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);
    expect(analisis.itemsDetectados).toHaveLength(2);
    expect(analisis.confianzaOCR).toBe("baja");
    expect(analisis.itemsDetectados[0]!.matchPlatillo).toBeUndefined();
    expect(analisis.itemsDetectados[0]!.motivo).toMatch(/no.*catálogo/i);
  });

  it("ratio de matching determina confianzaOCR", async () => {
    const { cliente } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Tacos al pastor", "Ensalada césar"] },
    });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);
    expect(analisis.confianzaOCR).toBe("media"); // 1 de 2 = 50%
  });

  it("fallback a plantilla cuando el LLM devuelve ok:false", async () => {
    const { cliente } = clienteConRespuesta({ ok: false, error: "Gemini caído" });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);
    expect(analisis.itemsDetectados).toEqual([]);
    expect(analisis.confianzaOCR).toBe("baja");
  });

  it("fallback cuando datos no trae items válido", async () => {
    const { cliente } = clienteConRespuesta({ ok: true, datos: { otra_cosa: 1 } });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);
    expect(analisis.itemsDetectados).toEqual([]);
    expect(analisis.confianzaOCR).toBe("baja");
  });

  it("items vacío → confianza baja, lista vacía", async () => {
    const { cliente } = clienteConRespuesta({ ok: true, datos: { items: [] } });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);
    expect(analisis.itemsDetectados).toEqual([]);
    expect(analisis.confianzaOCR).toBe("baja");
  });

  it("descarta items no-string o vacíos", async () => {
    const { cliente } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Tacos al pastor", "", 42, null, "   "] },
    });
    const analisis = await analizarMenu(cliente, "img", perfil, catalogo);
    expect(analisis.itemsDetectados).toHaveLength(1);
    expect(analisis.itemsDetectados[0]!.textoOriginal).toBe("Tacos al pastor");
  });
});

describe("plantillaAnalisisMenu", () => {
  it("devuelve análisis vacío con confianza baja", () => {
    const p = plantillaAnalisisMenu();
    expect(p.itemsDetectados).toEqual([]);
    expect(p.confianzaOCR).toBe("baja");
  });
});
