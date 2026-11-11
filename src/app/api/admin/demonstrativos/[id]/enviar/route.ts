import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { lerCorpo, respostaErro } from "@/lib/api";
import {
  buscar,
  comoDinheiro,
  horasPorExtenso,
  marcarEnviado,
} from "@/lib/demonstrativos";
import { gerarPdfDoDemonstrativo, nomeDoArquivo } from "@/lib/pdf-demonstrativo";
import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/lib/telefone";
import { enviarDocumento } from "@/lib/whatsapp";

import { operadorDaRequisicao } from "../../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  /** Para qual numero mandar. A tela sugere os telefones do cadastro. */
  telefone: z.string().min(1, "Informe o telefone de quem vai receber."),
});

/** "2026-09-10" -> "10/09/2026". */
function emDiaMesAno(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * POST — manda o PDF pelo WhatsApp do cliente.
 *
 * O texto vem do modelo editavel no painel ("demonstrativo_mensal"), como
 * toda mensagem do sistema. MARCA DEPOIS DE MANDAR, e nao antes: aqui a acao
 * e da pessoa, que ve o resultado na tela e tenta de novo se falhar — ao
 * contrario das rotinas automaticas, onde marcar primeiro evita mandar duas
 * vezes sem ninguem ver.
 */
export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const telefone = normalizarTelefone(corpo.data.telefone);

  if (!telefone) {
    return respostaErro(
      400,
      "Telefone inválido. Use DDD + celular, como (14) 99604-0233.",
      "TELEFONE_INVALIDO",
    );
  }

  const { id } = await contexto.params;
  const dados = await buscar(id);

  if (!dados) {
    return respostaErro(404, "Demonstrativo não encontrado.", "NAO_ENCONTRADO");
  }

  const modelo = await prisma.templateMensagem.findUnique({
    where: { chave: ChaveTemplate.demonstrativo_mensal },
    select: { texto: true },
  });

  if (!modelo) {
    return respostaErro(
      422,
      "O modelo de mensagem do demonstrativo não está cadastrado.",
      "SEM_MODELO",
    );
  }

  const legenda = modelo.texto
    .replaceAll("{{nome}}", dados.clienteNome)
    .replaceAll("{{periodo}}", `${emDiaMesAno(dados.de)} a ${emDiaMesAno(dados.ate)}`)
    .replaceAll("{{horas}}", horasPorExtenso(dados.horas))
    .replaceAll("{{valor}}", comoDinheiro(dados.totalCentavos));

  const pdf = await gerarPdfDoDemonstrativo(dados);

  const resultado = await enviarDocumento({
    telefone,
    nomeArquivo: nomeDoArquivo(dados),
    arquivo: pdf,
    legenda,
  });

  if (!resultado.enviado) {
    return respostaErro(
      502,
      resultado.erro ?? "Não foi possível enviar pelo WhatsApp.",
      "FALHA_NO_ENVIO",
    );
  }

  await marcarEnviado(id);

  return NextResponse.json({ mensagem: "Demonstrativo enviado pelo WhatsApp." });
}
