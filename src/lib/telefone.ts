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

/**
 * Telefone escondido para mostrar na tela: "(11) 9****-4321".
 *
 * Serve so para a pessoa reconhecer o proprio numero sem que ele apareca
 * inteiro para quem estiver olhando a tela por cima do ombro.
 * Devolve string vazia quando o telefone nao esta no formato esperado.
 */
export function mascararTelefone(telefone: string): string {
  const digitos = apenasDigitos(telefone);
  const semPais = digitos.startsWith("55") ? digitos.slice(2) : digitos;

  if (semPais.length !== 11) {
    return "";
  }

  return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 3)}****-${semPais.slice(-4)}`;
}

/**
 * Vai formatando o que a pessoa digita: "11987654321" -> "(11) 98765-4321".
 * Aceita numero incompleto, porque roda a cada tecla.
 */
export function formatarEnquantoDigita(bruto: string): string {
  const digitos = bruto.replace(/\D/g, "").slice(0, 11);

  if (digitos.length <= 2) {
    return digitos;
  }
  if (digitos.length <= 7) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}
