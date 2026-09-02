/**
 * Telefone sempre no mesmo formato.
 *
 * Regra do CLAUDE.md: guardar em formato internacional, +55 + DDD + celular
 * de 9 digitos. Assim a mesma pessoa nunca vira dois clientes por ter
 * digitado "(11) 91234-5678" numa vez e "11912345678" na outra.
 */

/** Formato final aceito pelo banco: +55 + DDD (2) + 9 + 8 digitos. */
const E164_BRASIL = /^\+55[1-9][0-9]9[0-9]{8}$/;

/**
 * Transforma o que a pessoa digitou em +5511987654321.
 * Devolve null quando nao e um celular brasileiro valido.
 */
export function normalizarTelefone(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");

  // Aceita com ou sem o 55 na frente.
  const semPais = digitos.startsWith("55") ? digitos.slice(2) : digitos;

  // Precisa sobrar DDD (2) + 9 + 8 digitos = 11.
  if (semPais.length !== 11) {
    return null;
  }

  const candidato = `+55${semPais}`;
  return E164_BRASIL.test(candidato) ? candidato : null;
}

/** Ja esta no formato final? */
export function telefoneValido(telefone: string): boolean {
  return E164_BRASIL.test(telefone);
}

/** Formato para a Evolution API: so digitos, sem o "+". */
export function apenasDigitos(telefone: string): string {
  return telefone.replace(/\D/g, "");
}
