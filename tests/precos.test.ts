/**
 * QUANTO CUSTA UMA RESERVA (bloco de precos por faixa).
 *
 * O que estes testes protegem:
 *  1. cada bloco de 30 min e cobrado pela faixa em que COMECA — inclusive
 *     quando a reserva atravessa a fronteira das 18h;
 *  2. o preco de grupo so vale A NOITE e so ACIMA do numero configurado. De
 *     dia, o numero de pessoas nao muda nada;
 *  3. sala sem regra de grupo ignora o numero de pessoas;
 *  4. a diaria e preco fechado, nao depende das horas;
 *  5. a fronteira da noite vem da configuracao, nao esta chumbada em 18h.
 *
 * Nao precisa de banco: o modulo e puro.
 */
import { describe, expect, it } from "vitest";

import {
  valorEmCentavos,
  valorEmReais,
  type PedidoDePreco,
  type TarifasDaSala,
} from "@/lib/precos";

/** A Sala de Reuniao: tem preco de grupo e diaria. */
const REUNIAO: TarifasDaSala = {
  precoPorHora: "40.00",
  precoPorHoraNoturno: "75.00",
  precoPorHoraNoturnoGrupo: "95.00",
  pessoasParaGrupo: 4,
  precoDiaria: "350.00",
};

/** A Container: sem regra de grupo, sem diaria. */
const CONTAINER: TarifasDaSala = {
  precoPorHora: "35.00",
  precoPorHoraNoturno: "75.00",
  precoPorHoraNoturnoGrupo: null,
  pessoasParaGrupo: null,
  precoDiaria: null,
};

function pedido(parcial: Partial<PedidoDePreco>): PedidoDePreco {
  return {
    inicio: "09:00",
    fim: "11:00",
    tarifas: REUNIAO,
    categoria: "HORA",
    pessoas: null,
    horaInicioNoturno: "18:00",
    ...parcial,
  };
}

// -----------------------------------------------------------------------------

describe("dentro de uma faixa so", () => {
  it("de dia cobra o preco de dia", () => {
    // 09:00 as 11:00 = 2 horas a R$40
    expect(valorEmCentavos(pedido({ inicio: "09:00", fim: "11:00" }))).toBe(8_000);
  });

  it("a noite cobra o preco noturno", () => {
    // 19:00 as 21:00 = 2 horas a R$75
    expect(valorEmCentavos(pedido({ inicio: "19:00", fim: "21:00" }))).toBe(15_000);
  });

  it("meia hora custa metade da hora", () => {
    expect(valorEmCentavos(pedido({ inicio: "09:00", fim: "09:30" }))).toBe(2_000);
  });
});

describe("atravessando a fronteira das 18h", () => {
  it("cobra cada hora pela faixa dela (o exemplo do dono)", () => {
    // 17h-20h numa sala 40/75 = 40 + 75 + 75 = R$190
    expect(valorEmReais(pedido({ inicio: "17:00", fim: "20:00" }))).toBe("190.00");
  });

  it("divide certo quando a fronteira cai no meio de uma hora", () => {
    // 17:30-18:00 de dia (R$20) + 18:00-18:30 de noite (R$37,50)
    expect(valorEmReais(pedido({ inicio: "17:30", fim: "18:30" }))).toBe("57.50");
  });

  it("o bloco que COMECA as 18:00 ja e noturno", () => {
    expect(valorEmCentavos(pedido({ inicio: "18:00", fim: "18:30" }))).toBe(3_750);
  });

  it("o bloco que termina as 18:00 ainda e de dia", () => {
    expect(valorEmCentavos(pedido({ inicio: "17:30", fim: "18:00" }))).toBe(2_000);
  });
});

describe("numero de pessoas", () => {
  it("acima do limite, a noite, cobra o preco de grupo", () => {
    // 5 pessoas > 4: 2 horas a R$95
    expect(valorEmCentavos(pedido({ inicio: "19:00", fim: "21:00", pessoas: 5 }))).toBe(
      19_000,
    );
  });

  it("exatamente no limite NAO e grupo — a regra e ACIMA de 4", () => {
    expect(valorEmCentavos(pedido({ inicio: "19:00", fim: "21:00", pessoas: 4 }))).toBe(
      15_000,
    );
  });

  it("de dia o numero de pessoas nao muda nada", () => {
    const sozinho = valorEmCentavos(pedido({ inicio: "09:00", fim: "11:00", pessoas: 1 }));
    const lotado = valorEmCentavos(pedido({ inicio: "09:00", fim: "11:00", pessoas: 20 }));

    expect(sozinho).toBe(8_000);
    expect(lotado).toBe(8_000);
  });

  it("atravessando a fronteira, so a parte da noite fica mais cara", () => {
    // 17h-20h com 5 pessoas = 40 (dia) + 95 + 95 (noite, grupo) = R$230
    expect(valorEmReais(pedido({ inicio: "17:00", fim: "20:00", pessoas: 5 }))).toBe(
      "230.00",
    );
  });

  it("sala sem regra de grupo ignora o numero de pessoas", () => {
    const cheia = valorEmCentavos(
      pedido({ tarifas: CONTAINER, inicio: "19:00", fim: "21:00", pessoas: 30 }),
    );

    expect(cheia).toBe(15_000);
  });

  it("sem informar pessoas, vale o preco noturno normal", () => {
    expect(valorEmCentavos(pedido({ inicio: "19:00", fim: "21:00", pessoas: null }))).toBe(
      15_000,
    );
  });
});

describe("diaria", () => {
  it("e preco fechado, nao depende das horas", () => {
    const cheia = valorEmReais(
      pedido({ categoria: "DIARIA", inicio: "08:00", fim: "18:00" }),
    );

    expect(cheia).toBe("350.00");
  });

  it("nao muda com o numero de pessoas", () => {
    expect(
      valorEmReais(pedido({ categoria: "DIARIA", inicio: "08:00", fim: "18:00", pessoas: 20 })),
    ).toBe("350.00");
  });

  it("recusa sala que nao tem preco de diaria", () => {
    expect(() =>
      valorEmCentavos(pedido({ categoria: "DIARIA", tarifas: CONTAINER })),
    ).toThrow(/diaria/i);
  });
});

describe("a fronteira da noite vem da configuracao", () => {
  it("com a noite comecando as 20h, as 19h ainda e preco de dia", () => {
    expect(
      valorEmCentavos(
        pedido({ inicio: "19:00", fim: "20:00", horaInicioNoturno: "20:00" }),
      ),
    ).toBe(4_000);
  });

  it("com a noite comecando as 12h, as 13h ja e preco noturno", () => {
    expect(
      valorEmCentavos(
        pedido({ inicio: "13:00", fim: "14:00", horaInicioNoturno: "12:00" }),
      ),
    ).toBe(7_500);
  });
});

describe("recusas", () => {
  it("recusa termino antes do inicio", () => {
    expect(() => valorEmCentavos(pedido({ inicio: "11:00", fim: "09:00" }))).toThrow(
      /depois do de inicio/i,
    );
  });

  it("recusa termino igual ao inicio", () => {
    expect(() => valorEmCentavos(pedido({ inicio: "09:00", fim: "09:00" }))).toThrow();
  });
});

describe("dinheiro nao some no arredondamento", () => {
  it("a soma dos pedacos bate com a reserva inteira", () => {
    // 08:00-12:00 dividido em quatro horas avulsas tem de dar o mesmo total.
    const inteira = valorEmCentavos(pedido({ inicio: "08:00", fim: "12:00" }));

    const pedacos =
      valorEmCentavos(pedido({ inicio: "08:00", fim: "09:00" })) +
      valorEmCentavos(pedido({ inicio: "09:00", fim: "10:00" })) +
      valorEmCentavos(pedido({ inicio: "10:00", fim: "11:00" })) +
      valorEmCentavos(pedido({ inicio: "11:00", fim: "12:00" }));

    expect(inteira).toBe(pedacos);
    expect(inteira).toBe(16_000);
  });

  it("preco quebrado nao acumula erro bloco a bloco", () => {
    const quebrado: TarifasDaSala = {
      ...REUNIAO,
      precoPorHora: "33.33",
      precoPorHoraNoturno: "33.33",
    };

    // 3 horas a 33,33 = 99,99 — e nao 99,96, que sairia arredondando cada
    // bloco de 30 min separadamente.
    expect(valorEmReais(pedido({ tarifas: quebrado, inicio: "09:00", fim: "12:00" }))).toBe(
      "99.99",
    );
  });
});

// -----------------------------------------------------------------------------
// A regra completa da Sala de Reuniao, do jeito que o dono descreveu.
// -----------------------------------------------------------------------------

describe("a Sala de Reuniao na pratica", () => {
  const naReuniao = (inicio: string, fim: string, quantas: number | null) =>
    valorEmReais(pedido({ inicio, fim, pessoas: quantas }));

  it("reuniao de manha com muita gente custa o preco de dia", () => {
    // 09:00-12:00, 12 pessoas: 3 horas a R$40. Pessoas nao contam de dia.
    expect(naReuniao("09:00", "12:00", 12)).toBe("120.00");
  });

  it("reuniao a noite com quatro pessoas paga R$75 a hora", () => {
    expect(naReuniao("19:00", "22:00", 4)).toBe("225.00");
  });

  it("a quinta pessoa muda a conta da noite inteira", () => {
    expect(naReuniao("19:00", "22:00", 5)).toBe("285.00");
  });

  it("comecando de tarde e virando a noite, so a noite encarece", () => {
    // 16:00-22:00 com 5 pessoas: 2h de dia (R$80) + 4h de grupo (R$380).
    expect(naReuniao("16:00", "22:00", 5)).toBe("460.00");
  });
});
