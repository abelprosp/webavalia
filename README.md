# Avalia Imob

Plataforma de avaliação de imóveis com IA para corretores. Inclui gestão de leads via WhatsApp, avaliação manual com critérios e fotos, e sistema de créditos.

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para PostgreSQL)

## Deploy na Railway

Guia completo: [DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md)

Resumo: conecte o repo no Railway, adicione **PostgreSQL**, configure as variáveis (`NODE_ENV`, `JWT_SECRET`, `OPENAI_API_KEY`, `SERPER_API_KEY`, `DATABASE_URL`, `VITE_API_URL=/api`) e gere o domínio público.

## Primeira execução

```bash
# 1. Instalar dependências
npm install
npm install --prefix server

# 2. Abrir o Docker Desktop e aguardar ficar "Running"

# 3. Subir banco e criar tabelas
npm run setup

# 4. Iniciar API + frontend
npm run dev:apps
```

Ou tudo em um comando (com Docker Desktop já aberto):

```bash
npm run dev:all
```

## URLs

| Serviço    | URL                      |
|------------|--------------------------|
| Frontend   | http://localhost:5173    |
| API        | http://localhost:3001    |
| PostgreSQL | localhost:5433 (Docker)    |

## Primeiro acesso

Crie sua conta em http://localhost:5173/sign-up e faça login em `/sign-in`.

## Avaliação com IA (ChatGPT + Serper)

Configure as chaves em `server/.env`:

```env
OPENAI_API_KEY=sk-sua-chave-openai
SERPER_API_KEY=sua-chave-serper
OPENAI_MODEL=gpt-4o
```

A avaliação de imóveis usa:
- **Serper** — busca anúncios em imobiliárias locais (ZAP, Viva Real, etc.) e dados do **Plano Diretor**
- **ChatGPT** — análise completa com valor estimado, comparáveis, zoneamento e insights

Obtenha as chaves em:
- OpenAI: https://platform.openai.com/api-keys
- Serper: https://serper.dev/

## Scripts disponíveis

| Comando           | Descrição                                      |
|-------------------|------------------------------------------------|
| `npm run setup`   | Sobe PostgreSQL (Docker) e roda migrations     |
| `npm run dev:apps`| Inicia API + frontend (sem Docker)             |
| `npm run dev:all` | Setup + API + frontend                         |
| `npm run dev`     | Apenas frontend                                |
| `npm run dev:server` | Apenas API                                  |
| `npm run docker:up`  | Sobe container PostgreSQL                    |
| `npm run db:migrate` | Cria tabelas e usuário demo                  |

## Erro: porta 5432 já em uso

Se aparecer `Bind for 0.0.0.0:5432 failed: port is already allocated`, você já tem outro PostgreSQL na máquina. Este projeto usa a porta **5433** no host para evitar conflito.

Se a migration falhar com `password authentication failed for user "avalia"`, o banco errado estava sendo usado. Rode:

```bash
npm run docker:reset
npm run setup
npm run dev:apps
```

## Erro: Docker não está rodando

Se aparecer:

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

**Solução:**

1. Abra o **Docker Desktop** no Windows
2. Aguarde o ícone ficar verde / status "Running"
3. Execute novamente:

```bash
npm run setup
npm run dev:apps
```

## Estrutura

```
web/
├── src/              # Frontend React (Vite + Shadcn)
├── server/           # API Express + JWT + PostgreSQL
├── docker-compose.yml
└── scripts/
```

## Tech Stack

- **Frontend:** React, Vite, TanStack Router, Shadcn UI, Tailwind CSS
- **Backend:** Express, PostgreSQL, JWT, bcrypt
- **Banco:** PostgreSQL 16 (Docker)
"# webavalia" 
