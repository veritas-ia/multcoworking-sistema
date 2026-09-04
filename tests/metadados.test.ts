/**
 * CARTAO DO LINK E ROBOTS (Fase 12).
 *
 * O que estes testes protegem:
 *  1. o endereco base sai do APP_URL. Sem ele, o WhatsApp nao consegue baixar
 *     a imagem do cartao — e a falha e silenciosa: o link so aparece sem
 *     imagem, sem erro nenhum em lugar nenhum;
 *  2. as paginas publicas tem titulo, descricao e dados de compartilhamento;
 *  3. o painel continua FORA dos buscadores, nas duas camadas: no HTML de
 *     cada pagina e no robots.txt.
 */
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { NOME_DA_MARCA, enderecoDoSite, urlDoSite } from "@/lib/marca";
import {
  DESCRICAO_DO_SITE,
  metadadosDoPainel,
  metadadosPublicos,
} from "@/lib/metadados";

const metadataDaRaiz = metadadosPublicos({
  titulo: "Reservar sala",
  descricao: DESCRICAO_DO_SITE,
  caminho: "/",
  indexar: true,
});

const metadataDasReservas = metadadosPublicos({
  titulo: "Minhas reservas",
  descricao: "Veja, remarque ou cancele suas reservas.",
  caminho: "/minhas-reservas",
  indexar: false,
});

// -----------------------------------------------------------------------------

describe("endereco do site", () => {
  it("sai do APP_URL e nunca termina com barra", () => {
    const endereco = enderecoDoSite();

    expect(endereco).toBe(process.env.APP_URL?.trim().replace(/\/+$/, ""));
    expect(endereco.endsWith("/")).toBe(false);
  });

  it("vira o endereco base dos metadados", () => {
    expect(metadataDaRaiz.metadataBase?.toString()).toBe(urlDoSite().toString());
  });
});

describe("cartao das paginas publicas", () => {
  it("a pagina de reserva leva nome, descricao e dados de compartilhamento", () => {
    expect(String(metadataDaRaiz.title)).toContain(NOME_DA_MARCA);
    expect(metadataDaRaiz.description?.length).toBeGreaterThan(20);
    expect(metadataDaRaiz.openGraph?.siteName).toBe(NOME_DA_MARCA);
    expect(metadataDaRaiz.openGraph?.locale).toBe("pt_BR");
    expect(metadataDaRaiz.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("a area do cliente tem cartao, mas fica fora dos buscadores", () => {
    expect(metadataDasReservas.openGraph?.siteName).toBe(NOME_DA_MARCA);
    expect(metadataDasReservas.robots).toMatchObject({ index: false });
  });
});

describe("o painel fica fora dos buscadores", () => {
  it("toda pagina do painel nasce dizendo \"nao me indexe\"", () => {
    // A conferencia e sobre a FUNCAO, e nao sobre uma pagina especifica: e ela
    // que garante que a proxima tela do painel ja nasca fora do Google.
    for (const titulo of ["Painel", "Agenda", "Configurações", "Entrar"]) {
      expect(metadadosDoPainel(titulo).robots).toMatchObject({
        index: false,
        follow: false,
      });
      expect(String(metadadosDoPainel(titulo).title)).toContain(NOME_DA_MARCA);
    }
  });

  it("o robots.txt tambem barra o painel e as rotas de API", () => {
    const regras = robots().rules;
    const primeira = Array.isArray(regras) ? regras[0] : regras;
    const proibidos = primeira?.disallow;

    expect(proibidos).toContain("/admin");
    expect(proibidos).toContain("/api");
  });

  it("o robots.txt libera a pagina de reserva", () => {
    const regras = robots().rules;
    const primeira = Array.isArray(regras) ? regras[0] : regras;

    expect(primeira?.allow).toBe("/");
  });
});
