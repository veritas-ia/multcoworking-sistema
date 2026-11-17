import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { criarUsuario, listarUsuarios } from "@/lib/usuarios-admin";

import { porteiroDoFinanceiro } from "../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  nome: z.string().trim().min(1, "Escreva o nome da pessoa."),
  usuario: z.string().trim().min(1, "Escreva o nome de usuário."),
  senha: z.string(),
  /**
   * Ve a parte financeira? Em branco vale SIM, que e o que o sistema sempre
   * fez — assim nenhuma chamada antiga passa a criar gente sem acesso.
   */
  acessoFinanceiro: z.boolean().optional(),
});

/**
 * A PORTA DA ADMINISTRACAO DE ACESSOS.
 *
 * E o mesmo porteiro do Financeiro, e isso e DE PROPOSITO: quem nao ve o
 * financeiro tambem nao administra usuarios. Sem esta linha o filtro inteiro
 * seria enfeite — a pessoa chamaria esta rota e se promoveria a acesso total,
 * ou criaria uma conta nova com tudo liberado.
 *
 * Trocar a PROPRIA senha nao passa por aqui: mora em /api/admin/eu/senha e
 * continua aberta a todo mundo.
 */

/** GET /api/admin/usuarios */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const eu = porta.eu;

  return NextResponse.json({ usuarios: await listarUsuarios(eu.id) });
}

/** POST /api/admin/usuarios — cria um acesso novo ao painel. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const eu = porta.eu;

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await criarUsuario(corpo.data, eu.id);

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NOME_REPETIDO" ? 409 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ usuario: resultado.dados }, { status: 201 });
}
