# Publicar: GitHub, Vercel, domínio e fluxo de atualização

Conforme o curso (nov/2026); interfaces e preços mudam.

## 1. GitHub (backup + ponte para a Vercel)

O GitHub guarda a última versão e o histórico; se uma mudança quebrar o site, dá para voltar.

Passos do usuário (o Claude orienta; criação de conta e repositório é do usuário):

1. Entrar/criar conta no GitHub e clicar em **New** (novo repositório).
2. Nome livre (curso: `projeto-caneta`); visibilidade pública ou privada (curso: privado). Criar.
3. A tela seguinte mostra comandos para colar no terminal. Copiar o bloco, abrir um terminal novo no editor e trocar **uma coisa**: onde está `git add README.md`, deixar `git add .` (o ponto envia todos os arquivos do projeto).
4. Rodar. Atualizar a página do GitHub: os arquivos devem aparecer.

O projeto Astro criado com `npm create astro@latest` já nasce com Git inicializado (resposta "Yes" na criação).

Checagem: repositório mostra `src/`, `public/`, `package.json`, `astro.config.*`.

## 2. Vercel (deploy)

1. Entrar em vercel.com (login ou conta nova).
2. **Add New > Project**, escolher o repositório e clicar **Import**.
3. Conferir o nome do projeto (vira parte do endereço `nome.vercel.app`) e clicar **Deploy**.
4. Abrir o endereço gerado; testar as três páginas, navegação, o formulário e abrir no celular.

A Vercel lê o repositório, instala as dependências e roda o Astro sozinha; o curso não alterou nenhuma configuração de build.

## 3. Domínio próprio

Exemplo do curso: domínio comprado na Super Domínios (confirmar o nome), `.com.br` por R$ 39 por 1 ano, pago por Pix; pede CPF ou CNPJ. Na própria Vercel também é possível comprar (botão **Buy**; no exemplo, `.com` ~US$ 11 e `.dev` ~US$ 13), e nesse caso ela configura tudo.

Domínio comprado fora da Vercel:

1. Na Vercel: projeto > **Domains > Add Domain > Add existing**; digitar o domínio e **Add Domain** (deixar o resto padrão).
2. Aparece "Invalid configuration" e a Vercel mostra os valores. No gerenciador de DNS do registrador:
   - Registro **A**, nome `@` (o próprio domínio), valor = IP que a Vercel mostra (editar o registro A existente e trocar o IP).
   - Registro **CNAME**, nome `www`, valor = o que a Vercel mostra. Se já existir um `www` apontando para um A, apagar antes e adicionar o CNAME.
3. Em "Endereços de DNS" do registrador, o curso também trocou para **DNS personalizado** com `ns1.vercel-dns.com` e `ns2.vercel-dns.com` (alterar DNS). O curso fez os registros A/CNAME e a troca para os servidores de nomes da Vercel. Não explica se só um dos caminhos bastaria (confirmar antes de afirmar isso ao usuário). Quando se delega o DNS à Vercel, os valores passam a ser geridos por ela.
4. Voltar à Vercel e dar refresh: o status muda para configuração válida. Propagação leva de segundos a algumas horas; é normal demorar.
5. Testar o domínio no computador e no celular.

Os valores de IP/CNAME mostrados na Vercel podem mudar; sempre copiar da tela, nunca de anotação antiga.

## 4. Fluxo definitivo de atualização

Sempre que algo mudar (texto, botão, SEO, tag de medição):

1. Pedir a alteração à IA (ex.: "Na primeira dobra, onde temos os botões Comprar agora e Explorar, inverta-os de posição e troque o texto Comprar agora para Saiba mais.").
2. Conferir localmente com `npm run dev`.
3. Enviar:

```bash
git add .
git commit -am "descrição curta do que mudou"
git push
```

4. A Vercel publica sozinha a cada push; abrir o domínio e conferir (esperar alguns minutos).

O curso repete esses três comandos depois de cada etapa (otimização, SEO, tag manager, evento de botão, pixel, integração com planilha). Mensagens de commit usadas: "otimizando o site", "ajustando links", "melhorando o SEO", "ajustes do Google", "ajustando tag manager", "ajustando o pixel", "integrando tabela".

Observação: `git add .` vem antes porque arquivos novos precisam ser adicionados. O curso não fala de branches, pull requests nem rollback; só do fluxo acima.

## 5. Checklist de publicação

- [ ] Projeto roda local sem erro (`npm run dev`)
- [ ] Repositório no GitHub com todos os arquivos
- [ ] Deploy na Vercel concluído e as 3 páginas abrem
- [ ] Teste no celular
- [ ] Domínio próprio com status válido na Vercel (www e raiz)
- [ ] Push de teste atualizando o site no ar
