/**
 * QUANTO CUSTA UMA RESERVA (bloco de precos por faixa).
 *
 * O que estes testes protegem:
 *  1. cada bloco de 30 min e cobrado pela faixa em que COMECA — inclusive
 *     quando a reserva atravessa a fronteira das 18h;
 *  2. o preco de grupo vale NAS DUAS FAIXAS (dia e noite), sempre ACIMA do
 *     numero configurado. Ate set/2026 o tamanho do grupo so era consultado a
 *     noite — era um defeito, e de dia o preco nao variava;
 *  3. sala sem regra de grupo ignora o numero de pessoas;
 *  4. a diaria e preco fechado (nao depende das horas), mas tem o PROPRIO
 *     corte de pessoas — diferente do corte do calculo por hora;
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
  precoPorHora: "40.00",        // 1 a 4 pessoas, ate as 18h
  precoPorHoraGrupo: "75.00",   // 5 a 10 pessoas, ate as 18h
  precoPorHoraNoturno: "75.00", // 1 a 4 pessoas, apos as 18h
  precoPorHoraNoturnoGrupo: "95.00", // 5 a 10 pessoas, apos as 18h
  pessoasParaGrupo: 4,          // ACIMA de 4
  precoDiaria: "350.00",        // 1 a 5 pessoas
  precoDiariaGrupo: "450.00",   // 6 a 10 pessoas
  pessoasParaGrupoDiaria: 5,    // ACIMA de 5 — corte DIFERENTE do de cima
};

/** A Container: sem regra de grupo, sem diaria. */
const CONTAINER: TarifasDaSala = {
  precoPorHora: "35.00",
  precoPorHoraGrupo: null,
  precoPorHoraNoturno: "75.00",
  precoPorHoraNoturnoGrupo: null,
  pessoasParaGrupo: null,
  precoDiaria: null,
  precoDiariaGrupo: null,
  pessoasParaGrupoDiaria: null,
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

  it("DE DIA o grupo grande tambem paga mais", () => {
    // Era o defeito: ate set/2026 os dois davam R$80.
    const pequeno = valorEmCentavos(pedido({ inicio: "09:00", fim: "11:00", pessoas: 4 }));
    const grande = valorEmCentavos(pedido({ inicio: "09:00", fim: "11:00", pessoas: 5 }));

    expect(pequeno).toBe(8_000); // 2h x R$40
    expect(grande).toBe(15_000); // 2h x R$75
  });

  it("atravessando a fronteira, cada faixa usa o preco DELA ja com o grupo", () => {
    // 17h-20h com 5 pessoas = 75 (dia, grupo) + 95 + 95 (noite, grupo) = R$265
    expect(valorEmReais(pedido({ inicio: "17:00", fim: "20:00", pessoas: 5 }))).toBe(
      "265.00",
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

describe("os casos confirmados pelo dono (Sala de Reunião)", () => {
  const conta = (parcial: Partial<PedidoDePreco>) => valorEmReais(pedido(parcial));

  it("1) 4 pessoas, 14h-17h (3h de dia) = R$120", () => {
    expect(conta({ inicio: "14:00", fim: "17:00", pessoas: 4 })).toBe("120.00");
  });

  it("2) 6 pessoas, 14h-16h (2h de dia) = R$150", () => {
    expect(conta({ inicio: "14:00", fim: "16:00", pessoas: 6 })).toBe("150.00");
  });

  it("3) 3 pessoas, 19h-21h (2h de noite) = R$150", () => {
    expect(conta({ inicio: "19:00", fim: "21:00", pessoas: 3 })).toBe("150.00");
  });

  it("4) 6 pessoas, 19h-21h (2h de noite) = R$190", () => {
    expect(conta({ inicio: "19:00", fim: "21:00", pessoas: 6 })).toBe("190.00");
  });

  it("5) 5 pessoas, 17h-20h (cruza as 18h) = R$265", () => {
    // 1h x R$75 de dia (grupo) + 2h x R$95 de noite (grupo).
    expect(conta({ inicio: "17:00", fim: "20:00", pessoas: 5 })).toBe("265.00");
  });

  it("6) diaria com 4 pessoas = R$350", () => {
    expect(conta({ categoria: "DIARIA", inicio: "08:00", fim: "18:00", pessoas: 4 })).toBe("350.00");
  });

  it("7) diaria com 5 pessoas = R$350", () => {
    expect(conta({ categoria: "DIARIA", inicio: "08:00", fim: "18:00", pessoas: 5 })).toBe("350.00");
  });

  it("8) diaria com 6 pessoas = R$450", () => {
    expect(conta({ categoria: "DIARIA", inicio: "08:00", fim: "18:00", pessoas: 6 })).toBe("450.00");
  });

  it("a fronteira exata do corte por hora: 4 paga base, 5 paga grupo", () => {
    expect(conta({ inicio: "14:00", fim: "15:00", pessoas: 4 })).toBe("40.00");
    expect(conta({ inicio: "14:00", fim: "15:00", pessoas: 5 })).toBe("75.00");
  });
});

describe("as outras salas nao mudaram", () => {
  it("Container de dia continua R$35/h, com qualquer numero de pessoas", () => {
    const conta = (pessoas: number | null) =>
      valorEmReais(pedido({ tarifas: CONTAINER, inicio: "14:00", fim: "16:00", pessoas }));

    expect(conta(null)).toBe("70.00");
    expect(conta(2)).toBe("70.00");
    expect(conta(30)).toBe("70.00");
  });

  it("Container a noite continua R$75/h, sem preco de grupo", () => {
    const conta = (pessoas: number | null) =>
      valorEmReais(pedido({ tarifas: CONTAINER, inicio: "19:00", fim: "21:00", pessoas }));

    expect(conta(null)).toBe("150.00");
    expect(conta(30)).toBe("150.00");
  });
});

describe("diaria", () => {
  it("e preco fechado, nao depende das horas", () => {
    const cheia = valorEmReais(
      pedido({ categoria: "DIARIA", inicio: "08:00", fim: "18:00" }),
    );

    expect(cheia).toBe("350.00");
  });

  it("tem o PROPRIO corte de pessoas, diferente do calculo por hora", () => {
    const diaria = (pessoas: number | null) =>
      valorEmReais(pedido({ categoria: "DIARIA", inicio: "08:00", fim: "18:00", pessoas }));

    // O PEGA-RATAO: por hora o pulo e entre 4 e 5; na diaria, entre 5 e 6.
    // Se alguem unificar os cortes, e aqui que estoura — a diaria de 5
    // pessoas sairia por R$450.
    expect(diaria(4)).toBe("350.00");
    expect(diaria(5)).toBe("350.00");
    expect(diaria(6)).toBe("450.00");
    expect(diaria(10)).toBe("450.00");
    expect(diaria(null)).toBe("350.00");
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

  it("reuniao de manha com muita gente paga o preco de DIA PARA GRUPO", () => {
    // 09:00-12:00: 3 horas. Com 4 pessoas, R$40/h; com 6, R$75/h.
    // Ate set/2026 os dois davam R$120 — o numero de pessoas era ignorado
    // durante o dia, e era justamente o defeito.
    expect(naReuniao("09:00", "12:00", 4)).toBe("120.00");
    expect(naReuniao("09:00", "12:00", 6)).toBe("225.00");
  });

  it("reuniao a noite com quatro pessoas paga R$75 a hora", () => {
    expect(naReuniao("19:00", "22:00", 4)).toBe("225.00");
  });

  it("a quinta pessoa muda a conta da noite inteira", () => {
    expect(naReuniao("19:00", "22:00", 5)).toBe("285.00");
  });

  it("comecando de tarde e virando a noite, cada faixa cobra o preco dela", () => {
    // 16:00-22:00 com 5 pessoas (grupo nas duas faixas):
    //   2h de dia a R$75  = R$150
    //   4h de noite a R$95 = R$380
    expect(naReuniao("16:00", "22:00", 5)).toBe("530.00");

    // A mesma reserva com 4 pessoas fica no preco pequeno das duas faixas:
    //   2h x R$40 + 4h x R$75 = R$380
    expect(naReuniao("16:00", "22:00", 4)).toBe("380.00");
  });
});
