# monia

> money + IA, no seu computador.

App desktop pessoal para análise de fatura e gastos. Seus dados ficam **100% locais**: um banco SQLite na sua máquina, sem servidor, sem conta, sem nuvem.

O projeto é feito em público (build in public), então o código busca ser legível e didático: clareza vence esperteza.

## O que faz

- **Sincroniza** contas e cartões via Open Finance ([Pluggy](https://pluggy.ai), pelo Meu Pluggy, gratuito para uso pessoal)
- **Normaliza** descrições, converte valores para centavos e remove duplicatas
- **Detecta parcelas** ("3/10", "PARC 03/10") e projeta as próximas faturas
- **Categoriza** por regras e, no que sobrar, por IA (Ollama local ou Gemini), com anonimização antes de enviar
- **Aprende com você**: corrigir a categoria de uma transação cria uma regra nova
- **Painel** com gasto por categoria e mês, projeção da fatura, assinaturas recorrentes e sugestões de economia
- **Investimentos**: alocação, rentabilidade e vencimentos

## Stack

Electron (`electron-vite`) · TypeScript estrito · React · Tailwind · Framer Motion · SQLite (`better-sqlite3`) + Drizzle ORM · Zod · Recharts · Vitest

## Como rodar

Requer Node 22+.

```bash
npm install
npm run dev
```

Na primeira execução, abra **Configurações** e informe:

1. `client_id` e `client_secret` do Pluggy e os IDs dos itens conectados no Meu Pluggy
2. (opcional) o provedor de IA: Ollama (URL local) ou Gemini (chave de API)

Segredos são cifrados com `safeStorage` do Electron e ficam só no processo principal.

### Comandos

```bash
npm run dev          # app em modo desenvolvimento
npm run build        # build de produção
npm run test         # testes Vitest (funções puras)
npm run test:db      # testes de integração com SQLite, no Node do Electron
npm run typecheck    # tsc nos projetos node e web
npm run db:generate  # gera migration a partir do schema Drizzle
npm run dist         # empacota com electron-builder
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

- **Dinheiro é inteiro em centavos.** Nunca `float`. Gasto é negativo, crédito é positivo.
- **Datas em ISO** (`YYYY-MM-DD`, fuso `America/Sao_Paulo`). Data da compra e mês da fatura são campos diferentes.
- **Electron seguro**: `contextIsolation`, `sandbox`, sem `nodeIntegration`.
- **IA com cuidado**: só descrição normalizada, valor e data saem da máquina. Resposta validada com Zod; se falhar, a transação fica "Sem categoria".
- **Sincronizar de novo não duplica nada.**

## Roadmap

- [x] Scaffold Electron + SQLite + tabela de transações
- [x] Categorias, regras e painel
- [x] Integração Pluggy
- [x] Categorização por IA com anonimização
- [x] Parcelas, projeção de faturas e assinaturas recorrentes
- [ ] Import de PDF de fatura com extração por LLM
