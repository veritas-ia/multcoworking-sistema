"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";

import { Campo } from "@/components/ui/campo";

import {
  buscarTemplates,
  salvarLinkDeAvaliacao,
  salvarTemplate,
  type TemplateNaTela,
} from "./api";
import { AreaDeTexto, BarraDeSalvar, Secao, type Situacao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

export function AbaDeMensagens() {
  const [templates, setTemplates] = useState<TemplateNaTela[] | null>(null);
  const [maximo, setMaximo] = useState(1_000);
  const [linkAvaliacao, setLinkAvaliacao] = useState("");
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarTemplates(sinal);
      setTemplates(resposta.templates);
      setMaximo(resposta.maximoDeCaracteres);
      setLinkAvaliacao(resposta.linkAvaliacao);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar as mensagens."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!templates) {
    return <Carregando texto="Carregando as mensagens…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm leading-relaxed text-text-secondary">
        Estas são as mensagens que o cliente recebe no WhatsApp. Cada uma aceita
        variáveis diferentes, porque cada envio sabe coisas diferentes — o
        lembrete conhece o link das reservas, a mensagem de série conhece o
        período. Usar uma variável fora da lista faz o cliente receber o
        {" "}<code className="font-mono">{"{{"}...{"}}"}</code> escrito na mensagem, por
        isso o sistema recusa antes de salvar.
      </p>

      <LinkDeAvaliacao inicial={linkAvaliacao} aoSalvar={setLinkAvaliacao} />

      {templates.map((template) => (
        <CartaoDaMensagem
          key={template.chave}
          template={template}
          maximo={maximo}
          aoAtualizar={(atualizado) =>
            setTemplates((atual) =>
              (atual ?? []).map((item) =>
                item.chave === atualizado.chave ? atualizado : item,
              ),
            )
          }
        />
      ))}
    </div>
  );
}

/** Uma mensagem: o texto, as variaveis que valem e a previa. */
function CartaoDaMensagem({
  template,
  maximo,
  aoAtualizar,
}: {
  template: TemplateNaTela;
  maximo: number;
  aoAtualizar: (template: TemplateNaTela) => void;
}) {
  const [texto, setTexto] = useState(template.texto);
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });

  const alterado = texto !== template.texto;

  async function salvar() {
    setSituacao({ tipo: "salvando" });

    try {
      const { template: atualizado } = await salvarTemplate(template.chave, texto);
      aoAtualizar(atualizado);
      setTexto(atualizado.texto);
      setSituacao({ tipo: "salvo", mensagem: "Mensagem salva." });
    } catch (erro) {
      setSituacao({ tipo: "erro", mensagem: mensagemDe(erro, "Não foi possível salvar.") });
    }
  }

  return (
    <Secao titulo={template.rotulo} descricao={template.descricao}>
      <div className="flex flex-col gap-4">
        <AreaDeTexto
          etiqueta="Texto da mensagem"
          valor={texto}
          maximo={maximo}
          linhas={8}
          aoMudar={(novo) => {
            setSituacao({ tipo: "parado" });
            setTexto(novo);
          }}
        />

        <p className="text-sm text-text-secondary">
          Variáveis desta mensagem:{" "}
          {template.variaveis.map((variavel) => (
            <code
              key={variavel}
              className="mr-1.5 rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-text-primary"
            >
              {`{{${variavel}}}`}
            </code>
          ))}
        </p>

        <div className="rounded-lg border border-border bg-bg-secondary p-4">
          <h3 className="text-sm font-bold text-text-primary">
            Como o cliente vai ver
          </h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-text-secondary">
            {previaLocal(texto, template.previa, alterado)}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            Prévia com dados de exemplo.
            {alterado ? " Salve para valer de verdade." : ""}
          </p>
        </div>

        <BarraDeSalvar
          situacao={situacao}
          alterado={alterado}
          aoSalvar={() => void salvar()}
          aoDescartar={() => {
            setTexto(template.texto);
            setSituacao({ tipo: "parado" });
          }}
          rotulo="Salvar mensagem"
        />
      </div>
    </Secao>
  );
}

/** Valores de exemplo iguais aos do servidor, para a previa mudar enquanto digita. */
const EXEMPLO: Record<string, string> = {
  nome: "Maria",
  sala: "Sala de Reunião",
  data: "2026-09-15",
  inicio: "09:00",
  fim: "11:00",
  valor: "R$ 160,00",
  codigo: "482913",
  dias: "terça e quarta",
  periodo: "15/09 a 30/11",
  quantidade: "17",
  link: "https://coworking.exemplo/minhas-reservas",
};

function previaLocal(texto: string, previaDoServidor: string, alterado: boolean): string {
  if (!alterado) {
    return previaDoServidor;
  }

  return texto.replace(/\{\{(\w+)\}\}/g, (original, chave: string) => EXEMPLO[chave] ?? original);
}

/**
 * O link do Google Meu Negócio, usado pela mensagem de avaliação.
 *
 * Fica nesta aba, junto das mensagens, porque é aqui que quem for editar o
 * texto do convite vai procurar por ele.
 */
function LinkDeAvaliacao({
  inicial,
  aoSalvar,
}: {
  inicial: string;
  aoSalvar: (link: string) => void;
}) {
  const [link, setLink] = useState(inicial);
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });

  const alterado = link.trim() !== inicial.trim();

  async function salvar() {
    setSituacao({ tipo: "salvando" });

    try {
      const { linkAvaliacao } = await salvarLinkDeAvaliacao(link);
      aoSalvar(linkAvaliacao);
      setLink(linkAvaliacao);
      setSituacao({
        tipo: "salvo",
        mensagem:
          linkAvaliacao === ""
            ? "Link apagado. O convite para avaliar deixa de ser enviado."
            : "Link salvo. O convite passa a ser enviado 1 hora depois de cada reserva.",
      });
    } catch (erro) {
      setSituacao({ tipo: "erro", mensagem: mensagemDe(erro, "Não foi possível salvar.") });
    }
  }

  return (
    <Secao
      titulo="Link de avaliação do Google"
      descricao="É o endereço que o cliente abre para avaliar o coworking. A mensagem de avaliação usa ele na variável {{link}}."
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Endereço"
          type="url"
          inputMode="url"
          placeholder="https://g.page/r/..."
          value={link}
          onChange={(evento) => {
            setSituacao({ tipo: "parado" });
            setLink(evento.target.value);
          }}
          dica={
            inicial === ""
              ? "Enquanto estiver em branco, a mensagem de avaliação NÃO é enviada — pedir avaliação sem dizer onde só gasta a paciência do cliente."
              : "Para desligar o convite de avaliação, apague o endereço e salve."
          }
        />

        <BarraDeSalvar
          situacao={situacao}
          alterado={alterado}
          aoSalvar={() => void salvar()}
          aoDescartar={() => {
            setLink(inicial);
            setSituacao({ tipo: "parado" });
          }}
          rotulo="Salvar link"
        />
      </div>
    </Secao>
  );
}
