/** Ações sobre o cadastro, chamadas de dentro da tela de controle de horas. */
import { pedir } from "@/components/admin/configuracoes/api";

/**
 * Diz a que empresa esta pessoa pertence.
 *
 * Fica aqui, e não só em Configurações → Clientes, porque é olhando a lista
 * dos quatro "Toca" que a equipe percebe que falta vincular. Mandar ela
 * trocar de tela para arrumar seria pedir que ela desistisse.
 */
export function definirEmpresaDoCliente(
  id: string,
  empresaId: string | null,
): Promise<{ mensagem: string }> {
  return pedir("/api/admin/cadastro-clientes", {
    method: "POST",
    body: JSON.stringify({ acao: "empresa", id, empresaId }),
  });
}
