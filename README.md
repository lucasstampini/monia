# monia

> money + IA, no seu computador.

App desktop para analisar fatura e gastos. Os dados ficam num banco SQLite local.

## O que faz

- Sincroniza contas e cartões via Open Finance ([Pluggy](https://pluggy.ai), pelo Meu Pluggy, gratuito para uso pessoal)
- Normaliza descrições, converte valores para centavos e remove duplicatas
- Detecta parcelas ("3/10", "PARC 03/10") e projeta as próximas faturas
- Categoriza por regras e, no que sobrar, por IA (Ollama local ou Gemini), com anonimização antes de enviar
- Corrigir a categoria de uma transação cria uma regra nova
- Painel com gasto por categoria e mês, projeção da fatura, assinaturas recorrentes e sugestões de economia
- Investimentos: alocação, rentabilidade e vencimentos

## Stack

Electron (`electron-vite`) · TypeScript estrito · React · Tailwind · Framer Motion · SQLite (`better-sqlite3`) + Drizzle ORM · Zod · Recharts · Vitest

## Como rodar

Requer Node 22+.

```bash
npm install
npm run dev
```

Na primeira execução, abra **Configurações** e informe as credenciais do Pluggy (veja abaixo) e, se quiser, o provedor de IA: Ollama (local) ou Gemini (chave de API).

Segredos são cifrados com `safeStorage` do Electron e ficam só no processo principal.

### Configurar o Pluggy (Open Finance)

O monia lê seus bancos pelo [Meu Pluggy](https://meu.pluggy.ai), gratuito para uso pessoal. São duas contas: o **Meu Pluggy**, onde você conecta os bancos, e o **Pluggy Dashboard**, que dá as credenciais para o app ler esses dados.

1. **Conecte seus bancos no Meu Pluggy.** Crie a conta em [meu.pluggy.ai](https://meu.pluggy.ai), clique para conectar, escolha a instituição e autorize pelo Open Finance. Repita para cada banco.
2. **Crie a conta no Pluggy Dashboard.** Em [dashboard.pluggy.ai](https://dashboard.pluggy.ai), crie a conta e um time. Isso abre um período de teste de 15 dias: faça os passos 3 e 4 dentro dele, porque depois a lista de conexões não pode mais ser editada (as já feitas continuam funcionando).
3. **Crie uma aplicação e copie as credenciais.** Em **Applications**, crie uma aplicação de desenvolvimento. Copie o **Client ID** e o **Client Secret**. Guarde o secret como uma senha; o botão *Refresh Secret* gera outro e invalida o antigo.
4. **Ligue o Meu Pluggy à aplicação.** Na página da aplicação, clique em **Ir para Demo**. Escolha o conector **MeuPluggy** e autorize com a sua conta do Meu Pluggy. Faça uma autorização **por banco** conectado no passo 1.
5. **Copie os Item IDs.** Ainda no Demo, cada autorização aparece como um item conectado. No menu de cada item, use **Copiar Item ID**. Um banco = um Item ID.
6. **Preencha no monia.** Em **Configurações > Open Finance**, cole o Client ID, o Client Secret e os Item IDs (um por linha). Salve e clique em **Sincronizar**.

Bom saber:

- O Meu Pluggy atualiza os dados uma vez por dia; sincronizar várias vezes no mesmo dia não traz nada novo.
- Se você revogar o consentimento no banco ou ele expirar, o Item ID para de funcionar: reconecte no Meu Pluggy, autorize de novo no Demo e troque o Item ID no monia.
- Dúvidas sobre o fluxo do Pluggy: [repositório do Meu Pluggy](https://github.com/pluggyai/meu-pluggy) e [documentação](https://docs.pluggy.ai).

### Instalar como app

Para usar sem `npm run dev`:

```bash
npm install
npm run app:install
```

O comando gera o build de produção e instala o app no sistema:

| Sistema | O que acontece | Onde abrir |
| --- | --- | --- |
| Windows | roda o instalador em modo silencioso (por usuário, sem pedir admin) | Menu Iniciar ou atalho na Área de Trabalho |
| macOS | copia o `monia.app` para `/Applications` | Launchpad ou Spotlight |
| Linux | copia o AppImage para `~/Applications` | executando o `monia.AppImage` |

Para atualizar, rode o comando de novo. Os dados ficam fora da pasta do app (`%APPDATA%\analise-de-gastos` no Windows, `~/Library/Application Support/analise-de-gastos` no macOS, `~/.config/analise-de-gastos` no Linux), então reinstalar não apaga nada.

> Sem assinatura de código: no macOS, abra a primeira vez com clique direito > **Abrir**.

### Comandos

```bash
npm run dev          # app em modo desenvolvimento
npm run build        # build de produção
npm run test         # testes Vitest (funções puras)
npm run test:db      # testes de integração com SQLite, no Node do Electron
npm run typecheck    # tsc nos projetos node e web
npm run db:generate  # gera migration a partir do schema Drizzle
npm run dist         # empacota com electron-builder (instalador em dist/)
npm run app:install  # empacota e instala o app no sistema
```

> `better-sqlite3` é compilado para o ABI do Electron, não do Node do sistema. Por isso os testes que tocam o banco ficam em `*.db.test.ts` e rodam via `npm run test:db`.

## Arquitetura

```
src/
  main/            # processo principal: único lugar com acesso a DB, rede e segredos
    db/            # schema Drizzle, conexão, queries
    ingestion/     # adaptadores de fonte (hoje: Pluggy)
    pipeline/      # normalize, dedup, installments, categorize, projeção...
    ai/            # cliente LLM + implementações (Ollama, Gemini)
    ipc/           # handlers IPC expostos ao renderer
  preload/         # contextBridge com API tipada
  renderer/        # UI React (nunca acessa DB ou segredos)
  shared/          # tipos e contratos IPC compartilhados
```

Fluxo de uma transação:

```
Fonte (Pluggy)
  -> adaptador converte para RawTransaction
  -> normalize (descrição limpa, valor em centavos, data)
  -> dedup (hash de data + valor + descrição normalizada)
  -> installments (detecta parcelas)
  -> categorize (regras -> IA -> "Sem categoria")
  -> persiste
```

Todo adaptador implementa a mesma interface; o pipeline não sabe de onde a transação veio.

## Princípios

- Dinheiro é inteiro em centavos, nunca `float`. Gasto é negativo, crédito é positivo.
- Datas em ISO (`YYYY-MM-DD`, fuso `America/Sao_Paulo`). Data da compra e mês da fatura são campos diferentes.
- Electron com `contextIsolation`, `sandbox`, sem `nodeIntegration`.
- Para a IA, só descrição normalizada, valor e data saem da máquina. Resposta validada com Zod; se falhar, a transação fica "Sem categoria".
- Sincronizar de novo não duplica nada.

## Roadmap

- [x] Scaffold Electron + SQLite + tabela de transações
- [x] Categorias, regras e painel
- [x] Integração Pluggy
- [x] Categorização por IA com anonimização
- [x] Parcelas, projeção de faturas e assinaturas recorrentes
- [ ] Import de PDF de fatura com extração por LLM
