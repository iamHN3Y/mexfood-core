import { describe, expect, it } from "vitest";
import { analizarMenu, plantillaAnalisisMenu } from "../src/analizar-menu.js";
import { crearLlmClient } from "../src/cliente.js";
import type { MenuCache } from "../src/menu-cache.js";
import { crearFakeFetch } from "./fake-fetch.js";
import { perfilBase, platilloBase, varianteBase } from "./fixtures.js";
import type { Catalogo, EntradaMenuCache } from "@core/types";

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

  it("platillo sin variante: reporta match sin color ni score", async () => {
    const catSoloPlatillo: Catalogo = {
      platillos: [platilloBase({ id: "P9", nombre: "Barbacoa", estadoTipico: "Hidalgo" })],
      variantes: [],
    };
    const { cliente } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Barbacoa"] },
    });
    const analisis = await analizarMenu(cliente, "img", perfil, catSoloPlatillo);
    expect(analisis.itemsDetectados).toHaveLength(1);
    const item = analisis.itemsDetectados[0]!;
    expect(item.matchPlatillo?.id).toBe("P9");
    expect(item.color).toBeUndefined();
    expect(item.score).toBeUndefined();
    expect(item.motivo).toMatch(/Hidalgo/);
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

describe("analizarMenu con cache", () => {
  const perfil = perfilBase({ evitaCerdo: true });
  const catalogo = catalogoDemo();

  function crearCacheFake(entradaInicial?: EntradaMenuCache): {
    cache: MenuCache;
    gets: string[];
    sets: Array<{ hash: string; entrada: EntradaMenuCache }>;
  } {
    const store = new Map<string, EntradaMenuCache>();
    if (entradaInicial) store.set("HASH", entradaInicial);
    const gets: string[] = [];
    const sets: Array<{ hash: string; entrada: EntradaMenuCache }> = [];
    return {
      cache: {
        get: async (h) => {
          gets.push(h);
          return store.get(h) ?? null;
        },
        set: async (h, e) => {
          sets.push({ hash: h, entrada: e });
          store.set(h, e);
        },
      },
      gets,
      sets,
    };
  }

  it("hit: usa items cacheados y no llama al LLM", async () => {
    const { cliente, llamadas } = clienteConRespuesta({
      ok: true,
      datos: { items: ["NO DEBERÍA LLEGAR"] },
    });
    const { cache, gets } = crearCacheFake({
      items: ["Tacos al pastor", "Chilaquiles verdes"],
      confianzaOCR: "alta",
    });

    const analisis = await analizarMenu(cliente, "img", perfil, catalogo, {
      cache,
      hashImagen: "HASH",
    });

    expect(llamadas).toHaveLength(0);
    expect(gets).toEqual(["HASH"]);
    expect(analisis.itemsDetectados).toHaveLength(2);
    expect(analisis.itemsDetectados[0]!.matchPlatillo?.id).toBe("P1");
  });

  it("miss: llama al LLM y guarda el resultado en cache", async () => {
    const { cliente, llamadas } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Mole poblano con pollo"] },
    });
    const { cache, gets, sets } = crearCacheFake();

    const analisis = await analizarMenu(cliente, "img", perfil, catalogo, {
      cache,
      hashImagen: "HASH-NUEVO",
    });

    expect(llamadas).toHaveLength(1);
    expect(gets).toEqual(["HASH-NUEVO"]);
    // set es fire-and-forget; esperamos un tick
    await Promise.resolve();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.hash).toBe("HASH-NUEVO");
    expect(sets[0]!.entrada.items).toEqual(["Mole poblano con pollo"]);
    expect(analisis.itemsDetectados).toHaveLength(1);
  });

  it("miss con LLM caído: no guarda en cache", async () => {
    const { cliente } = clienteConRespuesta({ ok: false, error: "Gemini caído" });
    const { cache, sets } = crearCacheFake();

    const analisis = await analizarMenu(cliente, "img", perfil, catalogo, {
      cache,
      hashImagen: "HASH",
    });

    await Promise.resolve();
    expect(sets).toHaveLength(0);
    expect(analisis.itemsDetectados).toEqual([]);
  });

  it("sin hashImagen: ignora el cache aunque se pase", async () => {
    const { cliente, llamadas } = clienteConRespuesta({
      ok: true,
      datos: { items: ["Tacos al pastor"] },
    });
    const { cache, gets, sets } = crearCacheFake({
      items: ["OTRA COSA"],
      confianzaOCR: "alta",
    });

    await analizarMenu(cliente, "img", perfil, catalogo, { cache });

    expect(llamadas).toHaveLength(1);
    expect(gets).toEqual([]);
    expect(sets).toEqual([]);
  });
});

describe("plantillaAnalisisMenu", () => {
  it("devuelve análisis vacío con confianza baja", () => {
    const p = plantillaAnalisisMenu();
    expect(p.itemsDetectados).toEqual([]);
    expect(p.confianzaOCR).toBe("baja");
  });
});
