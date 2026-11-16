# Ferramentas e referências

Fontes: aulas 03-01 a 03-06, `IMPORTANTE.md`, `links.md`, apostila cap. 7, aula 02-02. **Tudo abaixo é "conforme o curso (nov/2026)"**: preços, menus, versões de modelo e disponibilidade de sites mudam; o instrutor diz que a aula e as ferramentas já foram trocadas várias vezes.

## Links que o curso fornece
| O quê | Link | Observação |
|---|---|---|
| Banco de referências atual | https://ds.asimov.academy/ | Substitui a pasta zipada antiga ("Banco de Referências"). Na fala aparece "dsdesignsystems.asimov.academy" (Whisper); vale o link do `IMPORTANTE.md`/`links.md`. Ferramenta exclusiva dos alunos. |
| Site Downloader 3.0 | https://sd.asimov.academy/ | Exclusivo dos alunos. |
| Site Downloader 2.0 | https://sd2.asimov.academy/ | Versão anterior, citada no `IMPORTANTE.md`. |
| Repositório de skills (rtadewald) | https://github.com/rtadewald/skills | Atenção: o curso diz que o instrutor mantém aqui a versão mais atual. |
| Skill extract-ds | https://github.com/rtadewald/skills/tree/main/extract-ds | |
| Skill img-to-html | https://github.com/rtadewald/skills/tree/main/img-to-html | |
| Antigravity | antigravity.google (download em antigravity.google/download) | Gratuito, Windows/macOS/Linux. |

## Banco de referências (ds.asimov.academy)
- Curadoria do instrutor e da equipe: **48 sites** na gravação, com navegação por card, botão para ver em tela cheia, seleção de **temas claros** e seção de **componentes**. Atualizado ao longo do tempo.
- Cada item tem botão de download. O arquivo vem **pré-processado** para a IA consumir com o mínimo de tokens e entender a identidade visual. Cada DS baixado é uma pasta autocontida: HTML grande + pasta `assets` (CSS/JS), abre localmente sem internet.
- Uso: baixar quantos quiser, escolher por gosto (animação do botão, hierarquia, cores, fundo animado) e recombinar.

## Onde buscar mais referências (citadas no curso)
- **Aura.build:** favorita do instrutor na gravação; permite ver o HTML puro sem conta (o instrutor avisa que pode deixar de funcionar). Boa parte do banco veio daqui. Apostila: layouts com animações sofisticadas e visuais futuristas.
- **Mobbin** (mobbin.com; falado "Mobbing"): sites e fluxos/interfaces de apps. Apostila: foco em interfaces de aplicativos e fluxos de usuário.
- **Dribbble** (dribbble.com): designers publicando trabalhos; também para contratar.
- **Webflow** (webflow.com): sites feitos com ferramentas modernas (citado na apostila).
- **Monster Templates** (como falado; "TemplateMonster"/similar, confirmar): referência antiga do instrutor, ainda com sites bonitos.
- Princípio: salve tudo que achar bonito; qualquer site vira ponto de partida. Sites para um "swipe file" pessoal que alimenta a recombinação.

### Ética (disclaimer da aula 03-01)
Trabalho de design sempre parte de estudo de referências. Será plágio replicar **inteiramente o mesmo site para o mesmo nicho com o mesmo nome**. O método recomenda pegar elementos de vários sites e **recombinar com algo seu**.

## Site Downloader 3.0 (como usa)
1. Acesse sd.asimov.academy e cole a URL.
2. Escolha o formato: **duplo clique** (autocontido: `index` + `assets`, abre direto no navegador) ou **servidor local**.
3. **Modo rápido** (recomendado para pegar animação): mais rápido, sem garantir adaptação para celular. Desmarcar para ter configuração mobile (mais lento). Tempo observado: ~30 s a 1 min.
4. Se o formato duplo clique **não abrir/funcionar** (alguns sites 3D/complexos quebram), baixar a versão com **servidor local**: vem uma versão estática de pré-visualização, um script Python, um guia e (Windows) um `abrir.bat`. Precisa de **Python** instalado; em Mac/Linux, abrir o terminal na pasta e rodar o comando do guia.
5. Se nenhum formato funcionar, o curso pede para avisar a equipe, que atualiza a ferramenta.
- Limites declarados: é imperfeito e não baixa todos os sites; **não baixa páginas com login** (ex.: hub da própria Asimov). Existem extensões de navegador do tipo "site downloader" (o instrutor testou várias; sempre imperfeitas, e a apostila diz que extensões comuns falham em sites modernos).
- Para sites que o downloader não pegar, o curso não oferece alternativa além das extensões e do atalho de imagem (`img-to-html`).

## Ambientes de trabalho
| Ferramenta | O que o curso diz |
|---|---|
| **Antigravity** (Google) | Editor com agente de IA, baseado no VS Code, lançado em 18/11/2025 (leitura da aula 04). Gratuito com login Google e "cota semanal generosa"; modelos Gemini 3 Pro (High/Low), Gemini 3 Flash e alguns da Anthropic. Usado nos primeiros cursos e no portfólio (com Gemini Flash, sem cartão). |
| **Cursor** | Mais avançado, pago (cerca de R$ 100/mês na gravação, cota pequena). Instrutor recomenda para uso avançado; tem curso eletivo na formação. Permite escolher vários modelos. |
| **Claude Code** | Terminal. O curso diz que um curso estava para sair. |
| **Codex** (OpenAI), **Gemini CLI** | Alternativas de terminal para aproveitar planos já pagos. |
| Lovable | Usado só como exemplo de "prompt único" que gera design médio. |

Mensagem de custo do instrutor: bons resultados com IA em geral são pagos (GPT ~R$ 110/mês; ele compara com um dev sênior de R$ 4-5 mil/mês). "Conforme o curso (nov/2026)".

### Configuração do Antigravity (aula 03-03, resumo)
- Instalar (download, abrir). Tela inicial: importar configuração do Cursor se usar; tema escuro.
- **Modo do agente** (nomes como ouvidos): modo seguro (pede autorização para tudo), "Review Driven Development" (pede revisão em parte) e "Agent Driven Development" (executa direto; o instrutor escolheu este para não ficar aprovando toda hora). Se insegurança, usar o mais restritivo. Confirmar nomes na interface.
- Login Google obrigatório (permite upgrade depois). Extensões recomendadas; instalar o comando de linha.
- Interface: 3 colunas (barra de atalhos, arquivos, chat do agente). Abas úteis: **arquivos, pesquisa, extensões**; as demais podem ser ocultas.
- No chat: `@` aponta arquivos/DS; `/` comandos; colar print (útil para mostrar erro); seletor de modelo (Flash é rápido e menos preciso; High para tarefas complexas; Low intermediário); modo **Planning** (plano de ação antes de executar, pede aprovação) x execução direta.
- Se você assiste daqui a anos, diz o instrutor, a lógica dos modelos é parecida mesmo com versões novas.

## Instalar skills do GitHub (aula 03-04; leitura guiada)
Skill = pasta com `SKILL.md` (obrigatório) + `scripts/`, `examples/`, `resources/` (opcionais). É um padrão aberto: funciona em Antigravity, Claude Code, Cursor. O agente vê só nome e descrição no início da conversa e lê o SKILL.md completo quando o pedido combina.

Onde ficam no **Antigravity IDE**:
- Projeto: `<projeto>/.agents/skills/<nome-da-skill>/`
- Global: `~/.gemini/config/skills/<nome-da-skill>/`
(Aula 05 menciona também `.claude/skills` para Claude Code; ouvido como "cloud.skills" na transcrição, confirmar.)

Passos: localizar a pasta da skill no repositório (a que contém SKILL.md) -> baixar (ZIP ou `git clone https://github.com/rtadewald/skills.git`) -> criar `.agents/skills` na raiz do projeto -> copiar a pasta da skill **inteira** -> abrir **conversa nova** (a lista é montada no início da conversa).

Atalho citado na aula 05: copiar o link do GitHub da skill e pedir à IA preferida "instala essa skill pra mim".

Teste: menu *Customizations* no painel do agente, ou perguntar "Quais skills estão disponíveis?". Depois chamar pelo nome.

Problemas comuns: pasta extra no caminho (`skills-main/extract-ds` em vez de `extract-ds`); conversa aberta antes da instalação; `.agents` fora da raiz; descrição vaga (citar a skill pelo nome); dependência faltando (Python, etc.); pastas com ponto ocultas (Cmd+Shift+. no Mac).
**Segurança:** skills podem conter scripts executados na máquina; leia `SKILL.md` e `scripts/` antes de instalar de repositório desconhecido.

## Skills do curso (não recriar; cópia à parte)
Ver SKILL.md, seção "Quando chamar as skills".
- **extract-ds** (aula 05, "skill de 1000 dólares"): site local -> catálogo de DS (Overview + Components) em HTML. Descrição: o autor refinou por mais de 10 meses, cerca de US$ 1.000 em tokens, versão "10.0" na fala. Chamada `/extract-ds`.
- **img-to-html** (aula 06): imagem de UI -> HTML estático fiel, por camadas e com gates de aprovação. Chamada `/img-to-html`. O `SKILL.md` dela tem `disable-model-invocation: true`, ou seja, só roda se for **chamada pelo nome**. Depende de skills vizinhas do mesmo repositório (conforme o README): `to-wireframe` (wireframe ASCII tipado), `openrouter-img` (regenerar crops/ícones; precisa `OPENROUTER_API_KEY`) e opcionalmente `find-font`. Confirmar que estão instaladas antes de rodar.

## Modelos citados (podem estar velhos)
Cursor Composer (pequeno), Gemini 3 Pro/Flash, Claude Sonnet 4.5, GPT 5.2 (aula 02), "Grok 4.7" no Cursor (aula 05; confirmar), "Claude Opus 5" e "GPT 5.6 Sol" (aula 06; confirmar grafia). Apostila cita modelos mais antigos (Claude 3.5 Sonnet, Gemini 1.5 Pro, GPT-4o), que divergem das aulas; priorizar as aulas.
