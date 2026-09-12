/**
 * CONVERSA COM O CLOUDINARY, onde as fotos das salas ficam guardadas.
 *
 * SEM BIBLIOTECA. A API do Cloudinary e um POST comum com uma assinatura; dá
 * para fazer com o "fetch" e a criptografia que ja vem no Node. Duas razoes:
 * a stack do CLAUDE.md nao tem essa dependencia, e biblioteca a mais e mais
 * uma coisa que pode nao sobreviver ao empacotamento de producao — ja
 * aconteceu neste projeto com o "sharp", e o sintoma foi a funcionalidade
 * sumir NO AR funcionando no computador de quem programa.
 *
 * O SEGREDO NUNCA VAI AO NAVEGADOR. O upload passa por aqui, no servidor:
 * a tela manda o arquivo para a nossa rota, e a nossa rota manda para o
 * Cloudinary assinando com o segredo. Um upload direto do navegador exigiria
 * expor a chave, e quem tem a chave pode apagar tudo.
 */
import { createHash } from "node:crypto";

/** Quanto cada arquivo pode ter. Foto de sala nao precisa de mais que isso. */
export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

/** Quantas fotos cada sala aceita. */
export const MAXIMO_DE_FOTOS = 5;

/** Os unicos tipos aceitos. */
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

/** A pasta onde as fotos ficam la dentro, para nao se misturarem a outras. */
const PASTA = "mult-coworking/salas";

type Credenciais = { cloudName: string; apiKey: string; apiSecret: string };

/**
 * As credenciais, se as tres estiverem preenchidas.
 *
 * Nulo e um estado NORMAL, e nao um erro: o sistema inteiro funciona sem
 * Cloudinary — so a area de fotos fica indisponivel, com aviso na tela.
 */
export function credenciais(): Credenciais | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloudName, apiKey, apiSecret };
}

export function cloudinaryConfigurado(): boolean {
  return credenciais() !== null;
}

/**
 * A assinatura que o Cloudinary exige.
 *
 * A regra e dele: junta os parametros em ordem alfabetica como
 * "chave=valor&chave=valor", cola o segredo no fim e tira o SHA-1. Errar a
 * ordem ou incluir um parametro a mais faz o Cloudinary recusar com uma
 * mensagem generica — por isso esta funcao e pura e tem teste proprio.
 */
export function assinar(
  parametros: Record<string, string>,
  apiSecret: string,
): string {
  const texto = Object.keys(parametros)
    .sort()
    .map((chave) => `${chave}=${parametros[chave]}`)
    .join("&");

  return createHash("sha1").update(`${texto}${apiSecret}`).digest("hex");
}

export type FotoEnviada = { publicId: string; url: string };

export type ResultadoDoEnvio =
  | { ok: true; foto: FotoEnviada }
  | { ok: false; motivo: string };

/**
 * Manda o arquivo para o Cloudinary.
 *
 * O "timestamp" em segundos faz parte da assinatura e impede que um pedido
 * capturado hoje seja reenviado amanha.
 */
export async function enviarImagem(arquivo: Blob): Promise<ResultadoDoEnvio> {
  const credencial = credenciais();

  if (!credencial) {
    return { ok: false, motivo: "O Cloudinary não está configurado neste servidor." };
  }

  const timestamp = String(Math.floor(Date.now() / 1_000));
  const assinatura = assinar({ folder: PASTA, timestamp }, credencial.apiSecret);

  const corpo = new FormData();
  corpo.append("file", arquivo);
  corpo.append("api_key", credencial.apiKey);
  corpo.append("timestamp", timestamp);
  corpo.append("folder", PASTA);
  corpo.append("signature", assinatura);

  let resposta: Response;

  try {
    resposta = await fetch(
      `https://api.cloudinary.com/v1_1/${credencial.cloudName}/image/upload`,
      { method: "POST", body: corpo },
    );
  } catch {
    return { ok: false, motivo: "Não conseguimos falar com o Cloudinary. Tente de novo." };
  }

  const dados: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    return { ok: false, motivo: mensagemDeErro(dados) };
  }

  const retorno = dados as { public_id?: string; secure_url?: string };

  if (!retorno.public_id || !retorno.secure_url) {
    return { ok: false, motivo: "O Cloudinary respondeu sem o endereço da imagem." };
  }

  return { ok: true, foto: { publicId: retorno.public_id, url: retorno.secure_url } };
}

/**
 * Apaga o arquivo la.
 *
 * Devolve "false" em vez de estourar: quem chama decide o que fazer. A
 * decisao do dono e tirar a foto do site de qualquer jeito e avisar que o
 * arquivo pode ter ficado — o que o cliente ve importa mais.
 */
export async function apagarImagem(publicId: string): Promise<boolean> {
  const credencial = credenciais();

  if (!credencial) {
    return false;
  }

  const timestamp = String(Math.floor(Date.now() / 1_000));
  const assinatura = assinar(
    { public_id: publicId, timestamp },
    credencial.apiSecret,
  );

  const corpo = new FormData();
  corpo.append("public_id", publicId);
  corpo.append("api_key", credencial.apiKey);
  corpo.append("timestamp", timestamp);
  corpo.append("signature", assinatura);

  try {
    const resposta = await fetch(
      `https://api.cloudinary.com/v1_1/${credencial.cloudName}/image/destroy`,
      { method: "POST", body: corpo },
    );

    const dados = (await resposta.json().catch(() => null)) as { result?: string } | null;

    // "not found" tambem e sucesso do nosso ponto de vista: o arquivo nao
    // esta mais la, que era o objetivo.
    return dados?.result === "ok" || dados?.result === "not found";
  } catch {
    return false;
  }
}

function mensagemDeErro(dados: unknown): string {
  const erro = (dados as { error?: { message?: string } } | null)?.error?.message;
  return erro ? `O Cloudinary recusou: ${erro}` : "O Cloudinary recusou o envio.";
}

/**
 * O endereco da foto no tamanho que a tela precisa.
 *
 * O Cloudinary redimensiona e escolhe o formato pelo proprio endereco
 * ("f_auto,q_auto,w_800"). E melhor do que otimizar aqui: o trabalho fica com
 * quem ja o faz bem, e o celular baixa uma imagem do tamanho do celular.
 */
export function enderecoDaFoto(url: string, largura: number): string {
  const marca = "/upload/";
  const corte = url.indexOf(marca);

  // Endereco fora do formato esperado volta como veio: melhor a foto grande
  // do que a foto quebrada.
  if (corte === -1) {
    return url;
  }

  const inicio = corte + marca.length;
  return `${url.slice(0, inicio)}f_auto,q_auto,w_${largura}/${url.slice(inicio)}`;
}
