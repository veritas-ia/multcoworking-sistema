/**
 * A DATA DAS MENSAGENS DE WHATSAPP.
 *
 * O que estes testes protegem:
 *  1. o formato combinado: "15/09 (terça-feira)" — dia/mes e o dia da semana
 *     por extenso, em portugues, sem o ano;
 *  2. o FUSO. Uma reserva das 21h de segunda e, em UTC, meia-noite de TERCA.
 *     Se a conversa fosse feita no fuso do servidor, a mensagem diria o dia
 *     errado — e justamente nas reservas do fim da tarde, que sao muitas.
 *     Este e o bug que este arquivo existe para nao deixar voltar;
 *  3. a previa do painel mostra o MESMO formato do envio de verdade, senao
 *     ela ensinaria a equipe a esperar uma coisa e o cliente receberia outra.
 *
 * Nao precisa de banco: e so conversao de data.
 */
import { describe, expect, it } from "vitest";

import { EXEMPLO_DA_PREVIA } from "@/lib/templates-admin";
import { dataAmigavelDe, instanteDe } from "@/lib/tempo";

// -----------------------------------------------------------------------------

describe("o formato", () => {
  it("escreve dia/mes e o dia da semana por extenso", () => {
    expect(dataAmigavelDe(instanteDe("2026-09-15", "10:00"))).toBe(
      "15/09 (terça-feira)",
    );
  });

  it("nao mostra o ano", () => {
    // As reservas ficam a no maximo 60 dias, entao o ano so ocuparia espaco.
    expect(dataAmigavelDe(instanteDe("2026-09-15", "10:00"))).not.toContain("2026");
  });

  it("cobre a semana inteira, em portugues", () => {
    // 2026-09-13 e um domingo.
    const semana = [
      "13/09 (domingo)",
      "14/09 (segunda-feira)",
      "15/09 (terça-feira)",
      "16/09 (quarta-feira)",
      "17/09 (quinta-feira)",
      "18/09 (sexta-feira)",
      "19/09 (sábado)",
    ];

    semana.forEach((esperado, passo) => {
      const dia = String(13 + passo).padStart(2, "0");
      expect(dataAmigavelDe(instanteDe(`2026-09-${dia}`, "12:00"))).toBe(esperado);
    });
  });

  it("escreve o dia com dois digitos", () => {
    expect(dataAmigavelDe(instanteDe("2026-10-05", "09:00"))).toBe(
      "05/10 (segunda-feira)",
    );
  });
});

describe("o fuso de Sao Paulo", () => {
  it("reserva das 21h de segunda diz SEGUNDA, e nao terca", () => {
    // Em UTC isto e 2026-09-15T00:00 — ja terca-feira.
    const inicio = instanteDe("2026-09-14", "21:00");

    expect(inicio.toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(dataAmigavelDe(inicio)).toBe("14/09 (segunda-feira)");
  });

  it("reserva das 22h de sabado diz SABADO, e nao domingo", () => {
    const inicio = instanteDe("2026-09-19", "22:00");

    expect(inicio.getUTCDate()).toBe(20);
    expect(dataAmigavelDe(inicio)).toBe("19/09 (sábado)");
  });

  it("a primeira hora do dia tambem cai no dia certo", () => {
    expect(dataAmigavelDe(instanteDe("2026-09-15", "00:00"))).toBe(
      "15/09 (terça-feira)",
    );
  });

  it("continua certo dentro do horario de verao", () => {
    // Em 2018 o Brasil ainda tinha horario de verao: -02:00 em vez de -03:00.
    const inicio = instanteDe("2018-11-05", "21:00");

    expect(dataAmigavelDe(inicio)).toBe("05/11 (segunda-feira)");
  });
});

describe("a previa do painel", () => {
  it("usa o mesmo formato do envio de verdade", () => {
    expect(EXEMPLO_DA_PREVIA.data).toBe(
      dataAmigavelDe(instanteDe("2026-09-15", "10:00")),
    );
  });

  it("o periodo da serie fica em dia/mes, sem o ano", () => {
    // Na serie o dia da semana ja vem em {{dias}} ("terça e quarta"), entao
    // repeti-lo nas duas pontas do periodo so faria barulho.
    expect(EXEMPLO_DA_PREVIA.periodo).toMatch(/^\d{2}\/\d{2} a \d{2}\/\d{2}$/);
  });
});
