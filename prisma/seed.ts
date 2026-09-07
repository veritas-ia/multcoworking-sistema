/**
 * Carga inicial do banco.
 *
 * Pode rodar quantas vezes quiser: nada e duplicado. Cada item e criado se
 * nao existir, e atualizado se ja existir (menos a senha do admin, que so
 * e definida na criacao).
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";

import { ChaveTemplate, PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL nao configurada. Copie .env.example para .env e preencha.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const registro: string[] = [];

function anotar(mensagem: string): void {
  registro.push(mensagem);
}

// -----------------------------------------------------------------------------
// Salas
// -----------------------------------------------------------------------------

// Precos por faixa de horario. "precoPorHora" e o de DIA; depois do inicio da
// faixa noturna (configuravel, 18:00 no padrao) vale o noturno.
//
// Estes valores so entram em banco VAZIO. Onde o sistema ja roda, quem mandou
// foi a migracao "precos_por_faixa_e_diaria", e a partir dali o painel manda.
const SALAS = [
  {
    slug: "sala-ci",
    nome: "Privativa",
    precoPorHora: "40.00",
    precoPorHoraNoturno: "75.00",
    precoPorHoraNoturnoGrupo: null,
    pessoasParaGrupo: null,
    aceitaDiaria: false,
    precoDiaria: null,
    duracaoMaximaMinutos: null,
    ordem: 1,
  },
  {
    slug: "sala-de-reuniao",
    nome: "Sala de Reunião",
    precoPorHora: "40.00",
    precoPorHoraNoturno: "75.00",
    // Acima de 4 pessoas, a noite, a hora sobe para R$95.
    precoPorHoraNoturnoGrupo: "95.00",
    pessoasParaGrupo: 4,
    aceitaDiaria: true,
    precoDiaria: "350.00",
    duracaoMaximaMinutos: 120,
    ordem: 2,
  },
  {
    slug: "sala-container",
    nome: "Sala Container",
    precoPorHora: "35.00",
    precoPorHoraNoturno: "75.00",
    precoPorHoraNoturnoGrupo: null,
    pessoasParaGrupo: null,
    aceitaDiaria: false,
    precoDiaria: null,
    duracaoMaximaMinutos: null,
    ordem: 3,
  },
] as const;

async function criarSalas(): Promise<void> {
  for (const sala of SALAS) {
    await prisma.sala.upsert({
      where: { slug: sala.slug },
      create: {
        slug: sala.slug,
        nome: sala.nome,
        precoPorHora: sala.precoPorHora,
        precoPorHoraNoturno: sala.precoPorHoraNoturno,
        precoPorHoraNoturnoGrupo: sala.precoPorHoraNoturnoGrupo,
        pessoasParaGrupo: sala.pessoasParaGrupo,
        aceitaDiaria: sala.aceitaDiaria,
        precoDiaria: sala.precoDiaria,
        duracaoMaximaMinutos: sala.duracaoMaximaMinutos,
        ordem: sala.ordem,
        ativa: true,
      },
      // Sala que ja existe NAO e tocada: a partir da Fase 11 nome, preco,
      // duracao maxima e ordem sao editaveis no painel, e rodar o seed de novo
      // nao pode desfazer o que a equipe ajustou.
      update: {},
    });
  }
  anotar(`${SALAS.length} salas`);
}

// -----------------------------------------------------------------------------
// Horario de funcionamento padrao:
// seg-SEX 08:00-22:00 | sab 09:00-13:00 | dom fechado
//
// Mudou no bloco de precos por faixa: a sexta passou a abrir e o fechamento
// foi das 18h para as 22h, para o cliente conseguir reservar na faixa
// noturna pelo site. Antes disso o dia acabava as 18h e a faixa da noite so
// existia para lancamento da recepcao.
// -----------------------------------------------------------------------------

const HORARIOS = [
  { diaDaSemana: 0, aberto: false, horaAbertura: null, horaFechamento: null },
  { diaDaSemana: 1, aberto: true, horaAbertura: "08:00", horaFechamento: "22:00" },
  { diaDaSemana: 2, aberto: true, horaAbertura: "08:00", horaFechamento: "22:00" },
  { diaDaSemana: 3, aberto: true, horaAbertura: "08:00", horaFechamento: "22:00" },
  { diaDaSemana: 4, aberto: true, horaAbertura: "08:00", horaFechamento: "22:00" },
  { diaDaSemana: 5, aberto: true, horaAbertura: "08:00", horaFechamento: "22:00" },
  { diaDaSemana: 6, aberto: true, horaAbertura: "09:00", horaFechamento: "13:00" },
] as const;

async function criarHorarios(): Promise<void> {
  for (const horario of HORARIOS) {
    await prisma.horarioFuncionamento.upsert({
      where: { diaDaSemana: horario.diaDaSemana },
      create: { ...horario },
      // Dia que ja existe NAO e tocado: a partir da Fase 11 o horario de
      // funcionamento e editavel no painel, e rodar o seed de novo nao pode
      // desfazer o que a equipe ajustou.
      update: {},
    });
  }
  anotar("7 dias de horário de funcionamento");
}

// -----------------------------------------------------------------------------
// Parametros gerais
// -----------------------------------------------------------------------------

const CONFIGURACOES = [
  {
    chave: "intervaloMinutos",
    valor: "30",
    descricao: "Minutos de folga obrigatórios entre duas reservas da mesma sala.",
  },
  {
    chave: "duracaoMinimaMinutos",
    valor: "60",
    descricao: "Duração mínima de uma reserva, em minutos.",
  },
  {
    chave: "janelaCancelamentoHoras",
    valor: "12",
    descricao:
      "Antecedência mínima, em horas, para o cliente cancelar ou reagendar sozinho.",
  },
  {
    chave: "antecedenciaMinimaMinutos",
    valor: "60",
    descricao: "Com quantos minutos de antecedência, no mínimo, dá para reservar.",
  },
  {
    chave: "antecedenciaMaximaDias",
    valor: "60",
    descricao: "Até quantos dias no futuro o cliente pode reservar.",
  },
  {
    chave: "horaInicioNoturno",
    valor: "18:00",
    descricao: "A partir de que hora vale o preço noturno das salas.",
  },
] as const;

async function criarConfiguracoes(): Promise<void> {
  for (const configuracao of CONFIGURACOES) {
    await prisma.configuracao.upsert({
      where: { chave: configuracao.chave },
      create: { ...configuracao },
      update: { descricao: configuracao.descricao },
    });
  }
  anotar(`${CONFIGURACOES.length} parâmetros de configuração`);
}

// -----------------------------------------------------------------------------
// As seis mensagens de WhatsApp
// Variaveis: {{nome}} {{sala}} {{data}} {{inicio}} {{fim}} {{valor}} {{codigo}}
// -----------------------------------------------------------------------------

const TEMPLATES = [
  {
    chave: ChaveTemplate.codigo_verificacao,
    descricao: "Enviada quando o cliente pede o código para se identificar.",
    texto:
      "Seu código de confirmação é {{codigo}}.\n" +
      "Ele vale por 10 minutos. Não compartilhe com ninguém.",
  },
  {
    chave: ChaveTemplate.reserva_confirmada,
    descricao: "Enviada assim que a reserva é criada.",
    texto:
      "Oi, {{nome}}! Sua reserva está confirmada. ✅\n\n" +
      "📍 {{sala}}\n" +
      "📅 {{data}}\n" +
      "🕐 {{inicio}} às {{fim}}\n" +
      "💰 Valor estimado: {{valor}}\n\n" +
      "O pagamento é feito no local. Até lá!",
  },
  {
    chave: ChaveTemplate.serie_confirmada,
    descricao:
      "Enviada UMA vez quando a equipe cria uma série de reservas repetidas.",
    texto:
      "Oi, {{nome}}! Suas reservas estão confirmadas. ✅\n\n" +
      "📍 {{sala}}\n" +
      "🔁 {{dias}}\n" +
      "🕐 {{inicio}} às {{fim}}\n" +
      "📅 De {{periodo}} — {{quantidade}} datas\n\n" +
      "Você recebe um lembrete antes de cada uma. " +
      "O pagamento é feito no local. Até lá!",
  },
  {
    chave: ChaveTemplate.reserva_cancelada,
    descricao:
      "Enviada quando a reserva é cancelada, seja pelo cliente ou pela equipe.",
    texto:
      "Oi, {{nome}}. Sua reserva foi cancelada.\n\n" +
      "📍 {{sala}}\n" +
      "📅 {{data}}\n" +
      "🕐 {{inicio}} às {{fim}}\n\n" +
      "Se quiser marcar outro horário, é só acessar o site. Estamos à disposição!",
  },
  {
    chave: ChaveTemplate.reserva_reagendada,
    descricao: "Enviada quando a reserva muda de horário.",
    texto:
      "Oi, {{nome}}! Sua reserva foi remarcada. 🔄\n\n" +
      "O novo horário é:\n" +
      "📍 {{sala}}\n" +
      "📅 {{data}}\n" +
      "🕐 {{inicio}} às {{fim}}\n" +
      "💰 Valor estimado: {{valor}}\n\n" +
      "Te esperamos!",
  },
  {
    chave: ChaveTemplate.lembrete_13h,
    descricao: "Lembrete automático enviado 13 horas antes da reserva.",
    texto:
      "Oi, {{nome}}! Passando para lembrar da sua reserva. 😊\n\n" +
      "📍 {{sala}}\n" +
      "📅 {{data}}\n" +
      "🕐 {{inicio}} às {{fim}}\n\n" +
      "Precisa cancelar ou remarcar? É só acessar:\n{{link}}",
  },
  {
    chave: ChaveTemplate.lembrete_3h,
    descricao: "Lembrete automático enviado 3 horas antes da reserva.",
    texto:
      "Oi, {{nome}}! Sua reserva começa em breve. ⏰\n\n" +
      "📍 {{sala}}\n" +
      "🕐 Hoje, {{inicio}} às {{fim}}\n\n" +
      "Precisa cancelar ou remarcar? É só acessar:\n{{link}}",
  },
] as const;

async function criarTemplates(): Promise<void> {
  for (const template of TEMPLATES) {
    await prisma.templateMensagem.upsert({
      where: { chave: template.chave },
      create: { ...template },
      update: { descricao: template.descricao },
    });
  }
  anotar(`${TEMPLATES.length} modelos de mensagem`);
}

// -----------------------------------------------------------------------------
// Usuario admin
// -----------------------------------------------------------------------------

async function criarAdmin(): Promise<void> {
  const senha = process.env.ADMIN_SENHA;
  // Sempre em minusculas: e assim que o login do painel procura (Fase 7).
  const login = (process.env.ADMIN_USUARIO ?? "admin").trim().toLowerCase();
  const nome = process.env.ADMIN_NOME ?? "Administrador";

  if (!senha) {
    anotar(
      'nenhum admin criado — defina ADMIN_SENHA no arquivo .env e rode "npm run db:seed" de novo',
    );
    return;
  }

  if (senha.length < 8) {
    throw new Error("ADMIN_SENHA precisa ter pelo menos 8 caracteres.");
  }

  const existente = await prisma.usuario.findUnique({ where: { usuario: login } });

  if (existente) {
    // A senha nao e sobrescrita: quem ja tem conta continua com a senha atual.
    anotar(`admin "${login}" já existia (senha mantida)`);
    return;
  }

  await prisma.usuario.create({
    data: { nome, usuario: login, senhaHash: await bcrypt.hash(senha, 12) },
  });
  anotar(`admin "${login}" criado`);
}

// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  await criarSalas();
  await criarHorarios();
  await criarConfiguracoes();
  await criarTemplates();
  await criarAdmin();

  process.stdout.write(
    `\nCarga inicial concluída:\n${registro.map((l) => `  - ${l}`).join("\n")}\n\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro: unknown) => {
    await prisma.$disconnect();
    process.stderr.write(`\nFalha na carga inicial: ${String(erro)}\n\n`);
    process.exitCode = 1;
  });
