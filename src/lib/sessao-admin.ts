/**
 * SESSAO DO ADMIN — separada da sessao do cliente, de proposito.
 *
 * Sao duas coisas que nunca podem se misturar:
 *
 *   sessao do CLIENTE (Fase 4)   cookie "sessao_cliente", validado no banco,
 *                                 vale 30 dias, da acesso a area publica.
 *   sessao do ADMIN  (esta)      cookie "sessao_admin", token ASSINADO,
 *                                 vale 12 horas, da acesso ao painel.
 *
 * Nomes de cookie diferentes e verificadores diferentes: um cookie nunca e
 * lido pelo outro lado, nem por engano.
 *
 * Por que o token e assinado em vez de guardado no banco: o middleware do
 * Next roda num ambiente restrito, sem Prisma. Com assinatura, ele confere
 * o cookie sozinho. As paginas e rotas do painel conferem DE NOVO no banco
 * (ver "exigirAdmin"), entao um usuario apagado perde o acesso no ato.
 *
 * ATENCAO: este arquivo roda no middleware. NAO importe Prisma nem "node:*"
 * aqui — so a Web Crypto, que existe nos dois ambientes.
 */

export const COOKIE_ADMIN = "sessao_admin";

/** Doze horas: expediente de trabalho, nao 30 dias como a do cliente. */
export const HORAS_DE_VALIDADE = 12;

const SEGUNDOS_DE_VALIDADE = HORAS_DE_VALIDADE * 60 * 60;

export type ConteudoDoToken = {
  /** Id do usuario admin. */
  sub: string;
  /** Instante de vencimento, em segundos desde 1970. */
  exp: number;
};

function paraBase64Url(bytes: Uint8Array): string {
  let texto = "";
  for (const byte of bytes) {
    texto += String.fromCharCode(byte);
  }
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(texto: string): Uint8Array<ArrayBuffer> {
  const normalizado = texto.replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normalizado.padEnd(Math.ceil(normalizado.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) {
    bytes[i] = bruto.charCodeAt(i);
  }
  return bytes;
}

/** O segredo que assina os tokens. Sem ele o painel nao sobe. */
function segredo(): string {
  const valor = process.env.ADMIN_SESSAO_SEGREDO?.trim();

  if (!valor || valor.length < 32) {
    throw new Error(
      'ADMIN_SESSAO_SEGREDO ausente ou curto demais no .env. ' +
        'Gere um com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
    );
  }

  return valor;
}

async function chave(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Cria o token que vai dentro do cookie. */
export async function assinarToken(usuarioId: string): Promise<string> {
  const conteudo: ConteudoDoToken = {
    sub: usuarioId,
    exp: Math.floor(Date.now() / 1_000) + SEGUNDOS_DE_VALIDADE,
  };

  const corpo = paraBase64Url(new TextEncoder().encode(JSON.stringify(conteudo)));
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    await chave(),
    new TextEncoder().encode(corpo),
  );

  return `${corpo}.${paraBase64Url(new Uint8Array(assinatura))}`;
}

/**
 * Confere o token e devolve o conteudo. Nulo quando:
 * nao veio, esta malformado, a assinatura nao bate ou o prazo venceu.
 *
 * A comparacao da assinatura usa "crypto.subtle.verify", que compara em tempo
 * constante — nao da para adivinhar a assinatura medindo o tempo de resposta.
 */
export async function lerToken(token: string | undefined): Promise<ConteudoDoToken | null> {
  if (!token) {
    return null;
  }

  const [corpo, assinatura] = token.split(".");

  if (!corpo || !assinatura) {
    return null;
  }

  let confere: boolean;

  try {
    confere = await crypto.subtle.verify(
      "HMAC",
      await chave(),
      deBase64Url(assinatura),
      new TextEncoder().encode(corpo),
    );
  } catch {
    return null;
  }

  if (!confere) {
    return null;
  }

  try {
    const conteudo: unknown = JSON.parse(new TextDecoder().decode(deBase64Url(corpo)));

    if (
      typeof conteudo !== "object" ||
      conteudo === null ||
      typeof (conteudo as ConteudoDoToken).sub !== "string" ||
      typeof (conteudo as ConteudoDoToken).exp !== "number"
    ) {
      return null;
    }

    const valido = conteudo as ConteudoDoToken;

    return valido.exp * 1_000 > Date.now() ? valido : null;
  } catch {
    return null;
  }
}

/** Opcoes do cookie do painel. */
export function opcoesDoCookieAdmin() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SEGUNDOS_DE_VALIDADE,
  };
}

/** Opcoes que fazem o navegador jogar o cookie do painel fora. */
export function opcoesParaApagarCookieAdmin() {
  return { ...opcoesDoCookieAdmin(), maxAge: 0 };
}
