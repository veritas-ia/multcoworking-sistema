/**
 * MOTOR DE DISPONIBILIDADE
 *
 * Modulo puro: nao conhece tela nem endereco de internet. So responde
 * perguntas sobre a agenda. Toda regra vem do CLAUDE.md e os numeros
 * ajustaveis vem da tabela Configuracao — nada de valor fixo no codigo.
 *
 * Quem quiser gravar uma reserva ainda passa pelas travas do banco
 * (Fase 2). Este motor existe para nunca oferecer ao cliente um horario
 * que o banco recusaria.
 */
import { Prisma } from "@/generated/prisma/client";
import { StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  type DataLocal,
  type HoraLocal,
  dataLocalDe,
  diaDaSemanaDe,
  horaLocalDe,
  instanteDe,
  minutosEntre,
  somarMinutos,
  validarDataLocal,
  validarHoraLocal,
} from "@/lib/tempo";

/**
 * Tamanho do bloco da grade, em minutos. Nao e configuravel: o CLAUDE.md
 * fixa a grade de selecao em 30 minutos.
 */
export const BLOCO_MINUTOS = 30;

/** Por que uma reserva foi recusada. */
export type MotivoInvalido =
  | "SALA_INEXISTENTE"
  | "SALA_INATIVA"
  | "FORA_DA_GRADE"
  | "FIM_ANTES_DO_INICIO"
  | "DIA_FECHADO"
  | "ANTES_DA_ABERTURA"
  | "DEPOIS_DO_FECHAMENTO"
  | "DURACAO_MINIMA"
  | "DURACAO_MAXIMA_DA_SALA"
  | "NO_PASSADO"
  | "ANTECEDENCIA_MINIMA"
  | "ANTECEDENCIA_MAXIMA"
  | "HORARIO_OCUPADO"
  | "INTERVALO_ENTRE_RESERVAS";

export type ResultadoValidacao = {
  valido: boolean;
  /** Mensagem pronta para mostrar ao cliente. Nulo quando esta tudo certo. */
  motivo: string | null;
  /** Codigo para o programa decidir o que fazer. Nulo quando esta tudo certo. */
  codigo: MotivoInvalido | null;
};

export type Bloco = {
  /** "08:00" no relogio de Sao Paulo. */
  horario: HoraLocal;
  /** Da para COMECAR uma reserva neste bloco? */
  disponivelParaInicio: boolean;
};

/**
 * Quem esta marcando.
 *
 * CLIENTE: todas as regras do site valem.
 * ADMIN: a recepcao nao tem as travas COMERCIAIS — pode lancar no passado,
 *        sem antecedencia minima e com qualquer duracao. As travas de
 *        INTEGRIDADE da agenda continuam valendo para os dois: nao sobrepor
 *        e respeitar os 30 min entre reservas.
 */
export type Modo = "CLIENTE" | "ADMIN";

export type Parametros = {
  intervaloMinutos: number;
  duracaoMinimaMinutos: number;
  janelaCancelamentoHoras: number;
  antecedenciaMinimaMinutos: number;
  antecedenciaMaximaDias: number;
};

type Ocupacao = {
  inicio: Date;
  fim: Date;
  /** Reserva exige folga dos dois lados; bloqueio administrativo, nao. */
  exigeIntervalo: boolean;
};

type ExpedienteDoDia = { abertura: Date; fechamento: Date } | null;

// -----------------------------------------------------------------------------
// Leitura dos parametros ajustaveis
// -----------------------------------------------------------------------------

const CHAVES_OBRIGATORIAS = [
  "intervaloMinutos",
  "duracaoMinimaMinutos",
  "janelaCancelamentoHoras",
  "antecedenciaMinimaMinutos",
  "antecedenciaMaximaDias",
] as const;

export async function carregarParametros(): Promise<Parametros> {
  const linhas = await prisma.configuracao.findMany({
    where: { chave: { in: [...CHAVES_OBRIGATORIAS] } },
  });

  const valores = new Map(linhas.map((linha) => [linha.chave, linha.valor]));

  const numero = (chave: (typeof CHAVES_OBRIGATORIAS)[number]): number => {
    const bruto = valores.get(chave);
    if (bruto === undefined) {
      throw new Error(
        `Parametro "${chave}" nao existe na tabela Configuracao. Rode "npm run db:seed".`,
      );
    }
    const convertido = Number(bruto);
    if (!Number.isFinite(convertido) || convertido < 0) {
      throw new Error(`Parametro "${chave}" tem valor invalido: "${bruto}".`);
    }
    return convertido;
  };

  return {
    intervaloMinutos: numero("intervaloMinutos"),
    duracaoMinimaMinutos: numero("duracaoMinimaMinutos"),
    janelaCancelamentoHoras: numero("janelaCancelamentoHoras"),
    antecedenciaMinimaMinutos: numero("antecedenciaMinimaMinutos"),
    antecedenciaMaximaDias: numero("antecedenciaMaximaDias"),
  };
}

// -----------------------------------------------------------------------------
// Leituras auxiliares
// -----------------------------------------------------------------------------

async function buscarSala(salaId: string) {
  return prisma.sala.findUnique({ where: { id: salaId } });
}

/** Abertura e fechamento do dia, como instantes. Nulo quando o dia e fechado. */
async function expedienteDo(data: DataLocal): Promise<ExpedienteDoDia> {
  const horario = await prisma.horarioFuncionamento.findUnique({
    where: { diaDaSemana: diaDaSemanaDe(data) },
  });

  if (!horario?.aberto || !horario.horaAbertura || !horario.horaFechamento) {
    return null;
  }

  return {
    abertura: instanteDe(data, horario.horaAbertura),
    fechamento: instanteDe(data, horario.horaFechamento),
  };
}

/**
 * Tudo que ocupa a sala entre dois instantes.
 * Reservas canceladas e concluidas nao entram: elas liberam o horario.
 *
 * "ignorarReservaId" existe para o reagendamento (Fase 6): ao remarcar uma
 * reserva, ela nao pode brigar com o proprio horario atual. Sem esse parametro,
 * mudar das 09:00 para as 09:30 seria recusado — a reserva bateria nela mesma.
 */
async function ocupacoesEntre(
  salaId: string,
  de: Date,
  ate: Date,
  ignorarReservaId?: string,
): Promise<Ocupacao[]> {
  const [reservas, bloqueios] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        salaId,
        status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
        inicio: { lt: ate },
        fim: { gt: de },
        ...(ignorarReservaId ? { id: { not: ignorarReservaId } } : {}),
      },
      select: { inicio: true, fim: true },
    }),
    prisma.bloqueio.findMany({
      where: { salaId, inicio: { lt: ate }, fim: { gt: de } },
      select: { inicio: true, fim: true },
    }),
  ]);

  return [
    ...reservas.map((r) => ({ ...r, exigeIntervalo: true })),
    ...bloqueios.map((b) => ({ ...b, exigeIntervalo: false })),
  ];
}

/**
 * Ha choque entre o periodo pedido e algo que ja ocupa a sala?
 *
 * A folga de 30 min e aplicada em volta das RESERVAS existentes, dos dois
 * lados. Como todo par de reservas e comparado, isso torna a regra simetrica.
 * Bloqueios entram sem folga nenhuma.
 */
function encontrarChoque(
  inicio: Date,
  fim: Date,
  ocupacoes: Ocupacao[],
  intervaloMinutos: number,
): Ocupacao | undefined {
  return ocupacoes.find((ocupacao) => {
    const folga = ocupacao.exigeIntervalo ? intervaloMinutos : 0;
    const inicioAmpliado = somarMinutos(ocupacao.inicio, -folga);
    const fimAmpliado = somarMinutos(ocupacao.fim, folga);
    return inicioAmpliado < fim && inicio < fimAmpliado;
  });
}

function recusar(codigo: MotivoInvalido, motivo: string): ResultadoValidacao {
  return { valido: false, motivo, codigo };
}

const APROVADO: ResultadoValidacao = { valido: true, motivo: null, codigo: null };

/** O instante cai exatamente em cima de um bloco de 30 min? */
function estaNaGrade(instante: Date): boolean {
  const minutosDoRelogio = Number(horaLocalDe(instante).slice(3));
  const segundosZerados = instante.getTime() % 60_000 === 0;
  return segundosZerados && minutosDoRelogio % BLOCO_MINUTOS === 0;
}

// -----------------------------------------------------------------------------
// 1. Blocos do dia
// -----------------------------------------------------------------------------

/**
 * Todos os blocos de 30 minutos do dia, dizendo em quais da para COMECAR
 * uma reserva. Um bloco so e oferecido se existir pelo menos um horario de
 * termino valido a partir dele.
 *
 * Dia fechado devolve lista vazia.
 */
export async function slotsDoDia(
  salaId: string,
  data: DataLocal,
  ignorarReservaId?: string,
): Promise<Bloco[]> {
  validarDataLocal(data);

  const [sala, expediente, parametros] = await Promise.all([
    buscarSala(salaId),
    expedienteDo(data),
    carregarParametros(),
  ]);

  if (!sala || !sala.ativa || !expediente) {
    return [];
  }

  const ocupacoes = await ocupacoesEntre(
    salaId,
    somarMinutos(expediente.abertura, -parametros.intervaloMinutos),
    somarMinutos(expediente.fechamento, parametros.intervaloMinutos),
    ignorarReservaId,
  );

  const agora = new Date();
  const blocos: Bloco[] = [];

  for (
    let inicio = expediente.abertura;
    inicio < expediente.fechamento;
    inicio = somarMinutos(inicio, BLOCO_MINUTOS)
  ) {
    blocos.push({
      horario: horaLocalDe(inicio),
      disponivelParaInicio: existeTerminoValido(
        inicio,
        sala,
        expediente,
        ocupacoes,
        parametros,
        agora,
      ),
    });
  }

  return blocos;
}

// -----------------------------------------------------------------------------
// 2. Horarios de termino validos
// -----------------------------------------------------------------------------

/**
 * Para um inicio escolhido, quais horarios de termino sao permitidos.
 * Devolve lista vazia quando nenhum termino serve.
 */
export async function horariosDeTerminoValidos(
  salaId: string,
  data: DataLocal,
  horaInicio: HoraLocal,
  ignorarReservaId?: string,
): Promise<HoraLocal[]> {
  validarDataLocal(data);
  validarHoraLocal(horaInicio);

  const [sala, expediente, parametros] = await Promise.all([
    buscarSala(salaId),
    expedienteDo(data),
    carregarParametros(),
  ]);

  if (!sala || !sala.ativa || !expediente) {
    return [];
  }

  const inicio = instanteDe(data, horaInicio);
  const ocupacoes = await ocupacoesEntre(
    salaId,
    somarMinutos(expediente.abertura, -parametros.intervaloMinutos),
    somarMinutos(expediente.fechamento, parametros.intervaloMinutos),
    ignorarReservaId,
  );

  const agora = new Date();

  return terminosPossiveis(inicio, sala, expediente, ocupacoes, parametros, agora).map(
    horaLocalDe,
  );
}

type SalaBasica = {
  ativa: boolean;
  duracaoMaximaMinutos: number | null;
  precoPorHora: Prisma.Decimal;
};

function terminosPossiveis(
  inicio: Date,
  sala: SalaBasica,
  expediente: { abertura: Date; fechamento: Date },
  ocupacoes: Ocupacao[],
  parametros: Parametros,
  agora: Date,
): Date[] {
  const terminos: Date[] = [];

  for (
    let fim = somarMinutos(inicio, parametros.duracaoMinimaMinutos);
    fim <= expediente.fechamento;
    fim = somarMinutos(fim, BLOCO_MINUTOS)
  ) {
    const resultado = avaliar(
      inicio,
      fim,
      sala,
      expediente,
      ocupacoes,
      parametros,
      agora,
    );
    if (resultado.valido) {
      terminos.push(fim);
    }
  }

  return terminos;
}

function existeTerminoValido(
  inicio: Date,
  sala: SalaBasica,
  expediente: { abertura: Date; fechamento: Date },
  ocupacoes: Ocupacao[],
  parametros: Parametros,
  agora: Date,
): boolean {
  return (
    terminosPossiveis(inicio, sala, expediente, ocupacoes, parametros, agora)
      .length > 0
  );
}

// -----------------------------------------------------------------------------
// 3. Validacao de uma reserva
// -----------------------------------------------------------------------------

/**
 * Diz se um periodo pode virar reserva. Aplica, nesta ordem: sala, grade,
 * expediente, duracao, antecedencia e, por ultimo, choque de horario.
 */
export async function validarReserva(entrada: {
  salaId: string;
  inicio: Date;
  fim: Date;
  /** Reagendamento: a propria reserva nao conta como horario ocupado. */
  ignorarReservaId?: string;
  /** Quem esta marcando. Padrao: CLIENTE, com todas as regras. */
  modo?: Modo;
}): Promise<ResultadoValidacao> {
  const sala = await buscarSala(entrada.salaId);

  if (!sala) {
    return recusar("SALA_INEXISTENTE", "Esta sala não existe.");
  }
  if (!sala.ativa) {
    return recusar("SALA_INATIVA", "Esta sala não está disponível para reserva.");
  }

  const data = dataLocalDe(entrada.inicio);
  const [expediente, parametros] = await Promise.all([
    expedienteDo(data),
    carregarParametros(),
  ]);

  if (!expediente) {
    return recusar("DIA_FECHADO", "O coworking não abre neste dia.");
  }

  const ocupacoes = await ocupacoesEntre(
    entrada.salaId,
    somarMinutos(entrada.inicio, -parametros.intervaloMinutos),
    somarMinutos(entrada.fim, parametros.intervaloMinutos),
    entrada.ignorarReservaId,
  );

  return avaliar(
    entrada.inicio,
    entrada.fim,
    sala,
    expediente,
    ocupacoes,
    parametros,
    new Date(),
    entrada.modo ?? "CLIENTE",
  );
}

function avaliar(
  inicio: Date,
  fim: Date,
  sala: SalaBasica,
  expediente: { abertura: Date; fechamento: Date },
  ocupacoes: Ocupacao[],
  parametros: Parametros,
  agora: Date,
  modo: Modo = "CLIENTE",
): ResultadoValidacao {
  if (fim <= inicio) {
    return recusar(
      "FIM_ANTES_DO_INICIO",
      "O horário de término precisa ser depois do horário de início.",
    );
  }

  const duracao = minutosEntre(inicio, fim);

  if (!estaNaGrade(inicio) || !estaNaGrade(fim) || duracao % BLOCO_MINUTOS !== 0) {
    return recusar(
      "FORA_DA_GRADE",
      "Os horários precisam cair de 30 em 30 minutos.",
    );
  }

  if (inicio < expediente.abertura) {
    return recusar(
      "ANTES_DA_ABERTURA",
      `O coworking abre às ${horaLocalDe(expediente.abertura)} neste dia.`,
    );
  }

  if (fim > expediente.fechamento) {
    return recusar(
      "DEPOIS_DO_FECHAMENTO",
      `O coworking fecha às ${horaLocalDe(expediente.fechamento)} neste dia.`,
    );
  }

  if (modo === "CLIENTE" && duracao < parametros.duracaoMinimaMinutos) {
    return recusar(
      "DURACAO_MINIMA",
      `A reserva mínima é de ${parametros.duracaoMinimaMinutos} minutos.`,
    );
  }

  if (
    modo === "CLIENTE" &&
    sala.duracaoMaximaMinutos !== null &&
    duracao > sala.duracaoMaximaMinutos
  ) {
    return recusar(
      "DURACAO_MAXIMA_DA_SALA",
      `Esta sala pode ser reservada por no máximo ${sala.duracaoMaximaMinutos} minutos seguidos.`,
    );
  }

  if (modo === "CLIENTE" && inicio < agora) {
    return recusar("NO_PASSADO", "Este horário já passou.");
  }

  if (
    modo === "CLIENTE" &&
    inicio < somarMinutos(agora, parametros.antecedenciaMinimaMinutos)
  ) {
    return recusar(
      "ANTECEDENCIA_MINIMA",
      `É preciso reservar com pelo menos ${parametros.antecedenciaMinimaMinutos} minutos de antecedência.`,
    );
  }

  const limiteFuturo = somarMinutos(
    agora,
    parametros.antecedenciaMaximaDias * 24 * 60,
  );
  if (modo === "CLIENTE" && inicio > limiteFuturo) {
    return recusar(
      "ANTECEDENCIA_MAXIMA",
      `Só é possível reservar com até ${parametros.antecedenciaMaximaDias} dias de antecedência.`,
    );
  }

  const choque = encontrarChoque(inicio, fim, ocupacoes, parametros.intervaloMinutos);

  if (choque) {
    const sobrepoe = choque.inicio < fim && inicio < choque.fim;
    return sobrepoe
      ? recusar("HORARIO_OCUPADO", "Este horário já está ocupado.")
      : recusar(
          "INTERVALO_ENTRE_RESERVAS",
          `É preciso deixar ${parametros.intervaloMinutos} minutos livres entre uma reserva e outra.`,
        );
  }

  return APROVADO;
}

// -----------------------------------------------------------------------------
// 4. Calculo do valor
// -----------------------------------------------------------------------------

/**
 * Valor estimado da reserva: preco por hora da sala, proporcional aos
 * minutos, arredondado em centavos. Nao ha pagamento online no MVP.
 */
export async function calcularValor(
  salaId: string,
  inicio: Date,
  fim: Date,
): Promise<Prisma.Decimal> {
  const sala = await buscarSala(salaId);

  if (!sala) {
    throw new Error(`Sala "${salaId}" nao encontrada.`);
  }

  const duracao = minutosEntre(inicio, fim);

  if (duracao <= 0) {
    throw new Error("O horario de termino precisa ser depois do de inicio.");
  }

  return new Prisma.Decimal(sala.precoPorHora)
    .mul(duracao)
    .div(60)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
