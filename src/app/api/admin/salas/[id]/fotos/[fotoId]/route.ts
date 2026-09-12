import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { removerFoto } from "@/lib/fotos-sala";

import { operadorDaRequisicao } from "../../../../operador";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/salas/[id]/fotos/[fotoId]
 *
 * Se o Cloudinary recusar a remocao, a foto sai do site MESMO ASSIM e a
 * resposta avisa que o arquivo pode ter ficado la (decisao do dono). Uma
 * instabilidade do Cloudinary nao pode deixar no ar uma foto que a equipe
 * quer fora.
 */
export async function DELETE(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string; fotoId: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id, fotoId } = await contexto.params;
  const resultado = await removerFoto({ salaId: id, fotoId });

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NAO_ENCONTRADA" ? 404 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({
    fotos: resultado.dados.fotos,
    aviso: resultado.dados.ficouNoCloudinary
      ? "A foto saiu do site, mas o arquivo pode ter ficado no Cloudinary. Confira por lá quando puder."
      : null,
  });
}
