# Estrutura do design system e checagens

Fonte: lista "Seu design system final deve conter" do `Prompt.txt` (curso "Construindo sites profissionais com IA") e a comparação feita na aula "Criando DSs". O DS é um único arquivo HTML que serve de vitrine e de fonte da verdade para o site.

## O que o DS deve conter (nesta ordem)

| # | Seção | Conteúdo exigido no prompt |
|---|---|---|
| 1 | Primeira dobra | Uma hero que demonstra as capacidades do DS (animações, botões, background, surgimento, glow). É onde o professor mais pede capricho. |
| 2 | Tipografia | Famílias (primária, fallback, mono se houver); estratégia de carregamento (local, CDN, faixas de peso); escala completa h1 a h6; body-lg, body, body-sm; captions, labels, helper text. Para cada papel de texto: família, peso numérico, tamanho, line-height, letter-spacing, text-transform. |
| 3 | Sistema de cores | Hex, RGB e HSL; variantes de opacidade; participação em gradientes; papéis semânticos (primária, secundária, destaque, neutra, feedback, decorativa); regras de uso por contexto (texto, fundo, borda, hover, ativo, desabilitado); intenção de contraste (AA/AAA se der para inferir). |
| 4 | Componentes de UI (com animações) | Para cada componente detectado, spec completa: botões, inputs, cards, navbars, seções, modais, badges, tooltips. |
| 5 | Ícones | Conjunto de ícones (o professor elogia DS de referência com muitos ícones). |
| 6 | Animações | Biblioteca de animações: surgimento (fade in, slide in, blur in, com atraso escalonado entre elementos), efeitos em botões (brilho/glow no hover) e componentes, backgrounds animados. |

Regra de uso: o prompt manda repetir, "em todas as dobras", as animações de fundo, de surgimento e as dos botões/componentes, e cuidar do background das seções.

## Como o DS se liga às referências e ao site

- O novo DS referencia as mesmas classes CSS e JS dos arquivos de referência (não reescreve do zero). Motivo dado pelo professor: poupar a IA de reescrever CSS/JS e deixá-la focar em lembrar de usar.
- Cadeia: site -> novo DS -> DS originais. O site aponta só para o novo DS.
- Consequência: se mover arquivos de pasta, os caminhos (imports de CSS/JS) quebram. Peça à IA para mover e ajustar os caminhos (ver `checklist-deploy.md` na skill `site-com-ia-do-zero`).
- De tempos em tempos, marque o DS de novo no chat para a IA lembrar onde estão as classes e animações.

## Prompt aberto x prompt fechado

- Aberto (o primeiro bloco): "dá os teus pulos". Usa a criatividade do modelo; cada rodada sai diferente. Serve para inventar o DS.
- Fechado (a lista numerada): determinismo, define como o arquivo tem que ser entregue.
- O professor descreve ter derivado o bloco fechado do "prompt de mil dólares" de extração de DS e de pedidos ao GPT (para listar componentes etc.). A skill irmã `design-metodo-ia` cobre esse prompt de extração.
- Prompts grandes e bem descritos reduzem a criatividade e dão entrega exata; prompts curtos e abstratos ("seja criativo", "melhore o site") funcionam melhor com modelos bons.

## Sinais de DS bom x DS preguiçoso (comparação da aula "Criando DSs")

DS gerado com um pedido focado (bom, utilizável):
- hero caprichada, efeito de brilho que segue o cursor nos cards, efeito de fundo, slider;
- tipografia descrita com tamanho, família, peso para h1 a h6;
- cores com hex/HSL, primárias, fundo, gradientes;
- glassmorphism, gráficos, elementos surgindo, muitos ícones, motion primitives.

Três DS pedidos no mesmo prompt (preguiçosos, descartados):
- sem efeito no hover do cursor nem no botão; sem efeito de vidro;
- tipografia sem tamanho de fonte; paleta de 4 cores; 4 ícones;
- faltou layout/componentes/animações; um deles fugiu da estrutura pedida e usou fonte sem relação com as referências.

## Checagens antes de aceitar um DS

1. Abre no navegador sem aparência "quebrada" (CSS/JS das referências carregando). Se estiver bugado, peça correção (prompt de bug em `prompts-verbatim.md`), aceite as mudanças e reabra.
2. As 6 seções da tabela acima existem e estão completas (tamanhos de fonte presentes, cores em hex/RGB/HSL, 8 componentes, ícones, animações).
3. Surgimento dos elementos com fade + blur e atraso entre eles; hover dos botões com efeito.
4. Hero realmente demonstra o DS (não é só uma faixa de texto).
5. Restrições do cliente respeitadas: no exemplo do escritório de advocacia, sem itálico, azul no lugar de amarelo, fonte séria, fundo claro. (Se você pedir "sem itálico" ou troca de cor, confira no arquivo.)
6. Identidade coerente com o produto: caneta branca -> DS branco; escritório -> segurança.
7. Faça um commit (checkpoint) do DS escolhido antes de iterar mais, para poder voltar atrás.

## O que o curso não cobre aqui

- Exportar tokens (JSON, variáveis CSS) ou documentação do DS fora do HTML: não é ensinado.
- Teste de acessibilidade/contraste real: o prompt só pede "contrast intent (AA/AAA se inferível)"; não há verificação ensinada.
- Versão responsiva/mobile do DS: não aparece.
- Os DS de referência (banco de referências, Aura.build, Mobbin, Dribbble) vêm de outros cursos da formação; aqui só aparecem como insumo.
