import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { cloudinaryConfigurado } from "@/lib/cloudinary";
import { adicionarFoto, listarFotos, reordenarFotos } from "@/lib/fotos-sala";

import { operadorDaRequisicao } from "../../../operador";

export const dynamic = "force-dynamic";

function statusDaFalha(codigo: string): number {
  if (codigo === "NAO_ENCONTRADA") {
    return 404;
  }
  // "Sem Cloudinary" e 503: nao e culpa de quem pediu, e passa quando as
  // variaveis forem preenchidas no servidor.
  return codigo === "SEM_CLOUDINARY" ? 503 : 422;
}

/** GET /api/admin/salas/[id]/fotos */
export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;

  return NextResponse.json({
    fotos: await listarFotos(id),
    envioDisponivel: cloudinaryConfigurado(),
  });
}

/**
 * POST /api/admin/salas/[id]/fotos — envia uma foto.
 *
 * O arquivo chega aqui e SO ENTAO vai para o Cloudinary, assinado com o
 * segredo do servidor. Nunca pelo navegador: quem tem o segredo pode apagar
 * tudo que esta la.
 */
export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;

  let formulario: FormData;

  try {
    formulario = await requisicao.formData();
  } catch {
    return respostaErro(400, "Não foi possível ler o arquivo enviado.");
  }

  const arquivo = formulario.get("arquivo");

  if (!(arquivo instanceof Blob) || arquivo.size === 0) {
    return respostaErro(400, "Escolha uma imagem para enviar.");
  }

  const resultado = await adicionarFoto({
    salaId: id,
    arquivo,
    tipo: arquivo.type,
    tamanho: arquivo.size,
  });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalha(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json(
    { foto: resultado.dados, fotos: await listarFotos(id) },
    { status: 201 },
  );
}

const Ordem = z.object({
  ids: z.array(z.string().min(1)).min(1, "Informe a ordem das fotos."),
});

/** PUT /api/admin/salas/[id]/fotos — grava a ordem do carrossel. */
export async function PUT(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Ordem.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await reordenarFotos({ salaId: id, ids: corpo.data.ids });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalha(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ fotos: resultado.dados });
}
