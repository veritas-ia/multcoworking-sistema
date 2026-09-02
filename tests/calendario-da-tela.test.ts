/**
 * Testes das contas de calendario da TELA (Fase 5).
 *
 * Nao encostam no banco: sao funcoes puras. Elas existem porque o celular do
 * cliente pode estar em qualquer fuso, e uma conta de calendario feita com o
 * relogio do aparelho mostraria o mes deslocado em um dia.
 */
import { describe, expect, it } from "vitest";

import {
  dataCurta,
  dataPorExtenso,
  diaDaSemanaDe,
  diasNoMes,
  duracaoPorExtenso,
  emReais,
  mesDe,
  minutosEntreHoras,
  montarData,
  nomeDoMes,
  somarMeses,
  valorEstimadoEmCentavos,
} from "@/components/reserva/datas";

describe("dia da semana", () => {
  it("acerta o dia sem depender do fuso do aparelho", () => {
    expect(diaDaSemanaDe("2026-10-04")).toBe(0); // domingo
    expect(diaDaSemanaDe("2026-10-05")).toBe(1); // segunda
    expect(diaDaSemanaDe("2026-10-09")).toBe(5); // sexta
    expect(diaDaSemanaDe("2026-10-10")).toBe(6); // sabado
  });

  it("nao escorrega na virada do mes", () => {
    expect(diaDaSemanaDe("2026-01-01")).toBe(4);
    expect(diaDaSemanaDe("2026-12-31")).toBe(4);
  });
});

describe("tamanho do mes", () => {
  it("conta os dias de cada mes", () => {
    expect(diasNoMes(2026, 1)).toBe(31);
    expect(diasNoMes(2026, 4)).toBe(30);
    expect(diasNoMes(2026, 2)).toBe(28);
  });

  it("sabe que 2028 e bissexto", () => {
    expect(diasNoMes(2028, 2)).toBe(29);
  });
});

describe("navegacao entre meses", () => {
  it("anda para frente e para tras", () => {
    expect(somarMeses("2026-10", 1)).toBe("2026-11");
    expect(somarMeses("2026-10", -1)).toBe("2026-09");
  });

  it("vira o ano nos dois sentidos", () => {
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
  });

  it("tira o mes de uma data e monta a data de volta", () => {
    expect(mesDe("2026-10-06")).toBe("2026-10");
    expect(montarData(2026, 3, 7)).toBe("2026-03-07");
  });
});

describe("textos em portugues", () => {
  it("escreve o mes do cabecalho", () => {
    expect(nomeDoMes("2026-10")).toBe("Outubro de 2026");
    expect(nomeDoMes("2026-03")).toBe("Março de 2026");
  });

  it("escreve a data por extenso", () => {
    expect(dataPorExtenso("2026-10-06")).toBe("terça-feira, 6 de outubro de 2026");
    expect(dataCurta("2026-10-06")).toBe("ter, 6 de outubro");
  });
});

describe("duracao", () => {
  it("conta os minutos entre duas horas", () => {
    expect(minutosEntreHoras("08:00", "09:00")).toBe(60);
    expect(minutosEntreHoras("08:30", "10:00")).toBe(90);
  });

  it("escreve a duracao do jeito que a pessoa fala", () => {
    expect(duracaoPorExtenso(60)).toBe("1 hora");
    expect(duracaoPorExtenso(90)).toBe("1h30");
    expect(duracaoPorExtenso(120)).toBe("2 horas");
    expect(duracaoPorExtenso(150)).toBe("2h30");
  });
});

describe("valor estimado", () => {
  it("cobra proporcional aos minutos, igual ao servidor", () => {
    expect(valorEstimadoEmCentavos("50.00", 60)).toBe(5_000);
    expect(valorEstimadoEmCentavos("50.00", 90)).toBe(7_500);
    expect(valorEstimadoEmCentavos("40.00", 150)).toBe(10_000);
  });

  it("arredonda o centavo para cima na metade, como o banco", () => {
    // 45,00/h por 30 min = 22,50. Por 90 min = 67,50.
    expect(valorEstimadoEmCentavos("45.00", 90)).toBe(6_750);
    // 0,01/h por 90 min = 0,015 -> 0,02.
    expect(valorEstimadoEmCentavos("0.01", 90)).toBe(2);
  });

  it("escreve o valor em reais", () => {
    expect(emReais(7_500).replace(/ /g, " ")).toBe("R$ 75,00");
    expect(emReais(10_000).replace(/ /g, " ")).toBe("R$ 100,00");
  });
});
