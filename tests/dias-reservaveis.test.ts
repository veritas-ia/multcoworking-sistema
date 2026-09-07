/**
 * QUAIS DIAS O CALENDARIO DEIXA ESCOLHER (etapa 2 da tela).
 *
 * A pergunta que estes testes respondem: o dia que o banco diz estar ABERTO
 * chega na tela como reservavel, e o dia FECHADO chega bloqueado?
 *
 * Nada aqui e chumbado. A tabela HorarioFuncionamento e lida do banco e o
 * teste se ajusta sozinho se a equipe mudar o expediente no painel — o que
 * vale e a coerencia entre o banco e a tela, nao um horario especifico.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getAgenda } from "@/app/api/publico/agenda/route";
import {
  DIAS_CURTOS,
  motivoDoBloqueioDoDia,
  resumoDoFuncionamento,
} from "@/components/reserva/datas";
import type { Agenda } from "@/components/reserva/tipos";
import { slotsDoDia } from "@/lib/disponibilidade";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

/** Segunda-feira, 09:00 em Sao Paulo. A semana toda cabe na janela de reserva. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

/** Uma semana inteira de datas reais, segunda a domingo. */
const SEMANA = [
  { data: "2026-10-05", diaDaSemana: 1, nome: "segunda" },
  { data: "2026-10-06", diaDaSemana: 2, nome: "terça" },
  { data: "2026-10-07", diaDaSemana: 3, nome: "quarta" },
  { data: "2026-10-08", diaDaSemana: 4, nome: "quinta" },
  { data: "2026-10-09", diaDaSemana: 5, nome: "sexta" },
  { data: "2026-10-10", diaDaSemana: 6, nome: "sábado" },
  { data: "2026-10-11", diaDaSemana: 0, nome: "domingo" },
] as const;

let agenda: Agenda;
let abertoNoBanco: Map<number, boolean>;
let salaCI: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUnique({ where: { slug: "sala-ci" } });
  if (!sala) {
    throw new Error('Sala do seed nao encontrada. Rode "npm run db:seed".');
  }
  salaCI = sala.id;

  // A VERDADE vem do banco, nao de uma constante escrita no teste.
  const horarios = await bancoDeTeste.horarioFuncionamento.findMany();
  abertoNoBanco = new Map(horarios.map((h) => [h.diaDaSemana, h.aberto]));

  if (abertoNoBanco.size !== 7) {
    throw new Error("A tabela HorarioFuncionamento precisa ter os 7 dias.");
  }
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);

  // A agenda e montada pela rota de verdade, lendo o banco de verdade.
  agenda = (await (await getAgenda()).json()) as Agenda;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

// =============================================================================

describe("o calendario segue o HorarioFuncionamento do banco", () => {
  it.each(SEMANA)(
    "$nome ($data) fica igual ao que o banco diz",
    ({ data, diaDaSemana, nome }) => {
      const aberto = abertoNoBanco.get(diaDaSemana);
      const motivo = motivoDoBloqueioDoDia(data, agenda);

      if (aberto) {
        expect(motivo, `${nome} está aberto no banco e não pode aparecer bloqueado`).toBeNull();
      } else {
        expect(motivo, `${nome} está fechado no banco e precisa aparecer bloqueado`).toBe(
          "fechado",
        );
      }
    },
  );

  it("SÁBADO é dia reservável", () => {
    // Guarda contra o teste passar de graça: se alguem fechar o sabado no
    // banco, esta linha avisa em vez de o teste virar vazio.
    expect(abertoNoBanco.get(6)).toBe(true);
    expect(agenda.diasFechados).not.toContain(6);
    expect(motivoDoBloqueioDoDia("2026-10-10", agenda)).toBeNull();
    expect(motivoDoBloqueioDoDia("2026-10-17", agenda)).toBeNull();
    expect(motivoDoBloqueioDoDia("2026-10-24", agenda)).toBeNull();
  });

  it("SEXTA passou a ser reservável", () => {
    // A sexta abriu junto com a ampliacao do expediente ate as 22h. Se alguem
    // fechar a sexta de novo no painel, esta linha avisa.
    expect(abertoNoBanco.get(5)).toBe(true);
    expect(agenda.diasFechados).not.toContain(5);
    expect(motivoDoBloqueioDoDia("2026-10-09", agenda)).toBeNull();
  });

  it("DOMINGO não é reservável", () => {
    expect(abertoNoBanco.get(0)).toBe(false);
    expect(agenda.diasFechados).toEqual(expect.arrayContaining([0]));
    expect(motivoDoBloqueioDoDia("2026-10-11", agenda)).toBe("fechado");
  });

  it("no sábado a grade realmente oferece horários (09:00 às 13:00)", async () => {
    const blocos = await slotsDoDia(salaCI, "2026-10-10");

    expect(blocos[0]?.horario).toBe("09:00");
    expect(blocos.at(-1)?.horario).toBe("12:30");
    expect(blocos.some((bloco) => bloco.disponivelParaInicio)).toBe(true);
  });

  it("no domingo a grade vem vazia", async () => {
    await expect(slotsDoDia(salaCI, "2026-10-11")).resolves.toEqual([]);
  });

  it("na sexta a grade oferece horarios ate a noite", async () => {
    const blocos = await slotsDoDia(salaCI, "2026-10-09");

    expect(blocos[0]?.horario).toBe("08:00");
    expect(blocos.at(-1)?.horario).toBe("21:30");
  });

  it("bloqueia o que está fora da janela de reserva, não o dia da semana", () => {
    // 2026-10-03 e um sabado, mas ja passou: bloqueado por data, nao por ser sabado.
    expect(motivoDoBloqueioDoDia("2026-10-03", agenda)).toBe("cedo demais para reservar");
    // 2026-12-05 e um sabado alem dos 60 dias.
    expect(motivoDoBloqueioDoDia("2026-12-05", agenda)).toContain("60 dias");
  });
});

describe("cabeçalho do calendário", () => {
  it("tem sete nomes de dia e nenhum repetido", () => {
    // O bug que originou este teste: com iniciais de uma letra, segunda, sexta
    // e sabado viravam todas "S" — e as colunas de sexta e sabado ficam
    // coladas, entao a sexta riscada passava por sabado riscado.
    expect(DIAS_CURTOS).toHaveLength(7);
    expect(new Set(DIAS_CURTOS).size).toBe(7);
  });
});

describe("resumo do funcionamento no rodapé", () => {
  it("junta os dias iguais numa linha só", () => {
    expect(resumoDoFuncionamento(agenda)).toBe(
      "Seg a sex: 08h–22h · Sáb: 09h–13h · Dom: fechado.",
    );
  });

  it("acompanha o banco em vez de repetir um texto fixo", () => {
    const outraCasa: Agenda = {
      ...agenda,
      diasFechados: [0],
      diasAbertos: [
        { diaDaSemana: 1, horaAbertura: "09:00", horaFechamento: "17:30" },
        { diaDaSemana: 2, horaAbertura: "09:00", horaFechamento: "17:30" },
        { diaDaSemana: 3, horaAbertura: "09:00", horaFechamento: "17:30" },
        { diaDaSemana: 4, horaAbertura: "09:00", horaFechamento: "17:30" },
        { diaDaSemana: 5, horaAbertura: "09:00", horaFechamento: "17:30" },
        { diaDaSemana: 6, horaAbertura: "10:00", horaFechamento: "14:00" },
      ],
    };

    expect(resumoDoFuncionamento(outraCasa)).toBe(
      "Seg a sex: 09h–17h30 · Sáb: 10h–14h · Dom: fechado.",
    );
  });

  it("usa 'e' quando são só dois dias seguidos", () => {
    const soDoisDias: Agenda = {
      ...agenda,
      diasFechados: [0, 3, 4, 5, 6],
      diasAbertos: [
        { diaDaSemana: 1, horaAbertura: "08:00", horaFechamento: "18:00" },
        { diaDaSemana: 2, horaAbertura: "08:00", horaFechamento: "18:00" },
      ],
    };

    expect(resumoDoFuncionamento(soDoisDias)).toBe(
      "Seg e ter: 08h–18h · Qua, qui, sex, sáb e dom: fechado.",
    );
  });
});
