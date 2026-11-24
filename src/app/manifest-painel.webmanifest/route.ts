import { manifestoDoPainel } from "@/lib/manifesto";

/**
 * A FICHA DO APLICATIVO DO PAINEL.
 *
 * POR QUE E UMA ROTA ESCRITA A MAO, e nao outro "manifest.ts": o Next aceita
 * um manifesto por site, e este e o SEGUNDO — o do site publico abre a tela
 * de reservar, e este abre o painel. Quem amarra esta ficha nas paginas do
 * painel e "metadadosDoPainel", entao toda pagina nova do painel ja nasce com
 * ela.
 *
 * POR QUE FORA DE "/admin": o middleware exige login em tudo que comeca com
 * /admin, e o navegador precisa ler a ficha ANTES de alguem entrar. La dentro
 * ela viraria um redirecionamento para o login, e o celular diria apenas que
 * nao conseguiu instalar — sem explicar por que.
 *
 * Nao ha nada sigiloso aqui: e o nome do sistema, a cor e o endereco da
 * primeira tela, que ja aparece no botao de login.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(manifestoDoPainel(), {
    // O tipo proprio de manifesto. Servido como JSON comum, o Chrome do
    // Android avisa no console e deixa de oferecer a instalacao.
    headers: { "content-type": "application/manifest+json; charset=utf-8" },
  });
}
