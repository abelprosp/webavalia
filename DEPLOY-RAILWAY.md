# Deploy na Railway — Avalia Imobe

Este guia publica **frontend + API + banco** na [Railway](https://railway.com) em um único serviço web.

## Arquitetura

| Componente | Onde roda |
|------------|-----------|
| React (Vite) | Arquivos estáticos servidos pelo Express |
| API Express | Mesmo serviço (`/api/*`) |
| PostgreSQL | Plugin Postgres da Railway |

## Passo a passo

### 1. Criar conta e projeto

1. Acesse https://railway.com e faça login (GitHub recomendado).
2. Clique em **New Project**.
3. Escolha **Deploy from GitHub repo** e conecte este repositório.
4. Se ainda não tiver o código no GitHub, suba antes:
   ```bash
   git init
   git add .
   git commit -m "Deploy Railway"
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
   git push -u origin main
   ```

### 2. Adicionar PostgreSQL

1. No projeto Railway, clique em **+ New**.
2. Escolha **Database → PostgreSQL**.
3. Aguarde o banco ficar **Active**.

### 3. Configurar o serviço web

1. Clique no serviço da aplicação (não no Postgres).
2. Em **Settings → Root Directory**, deixe vazio (raiz do repo).
3. Em **Settings → Build**, confirme que usa `railway.toml` (já incluso no projeto).

### 4. Variáveis de ambiente

No serviço web, abra **Variables** e adicione:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Sim |
| `JWT_SECRET` | string longa e aleatória (ex: `openssl rand -hex 32`) | Sim |
| `OPENAI_API_KEY` | sua chave OpenAI | Sim |
| `SERPER_API_KEY` | sua chave Serper | Sim |
| `OPENAI_MODEL` | `gpt-4o` | Não |
| `JWT_EXPIRES_IN` | `7d` | Não |
| `VITE_API_URL` | `/api` | Sim (build) |

**DATABASE_URL** — conecte ao Postgres:

1. No serviço PostgreSQL, aba **Variables**, copie `DATABASE_URL` (ou use **Connect → Add to service** no serviço web).
2. No serviço web, adicione a variável `DATABASE_URL` referenciando o Postgres.

A Railway define automaticamente `PORT` e `RAILWAY_PUBLIC_DOMAIN`.

`CORS_ORIGIN` é opcional; se não definir, o sistema usa `https://SEU_DOMINIO.railway.app`.

### 5. Deploy

1. Salve as variáveis — o deploy reinicia automaticamente.
2. Acompanhe os logs em **Deployments → View logs**.
3. Aguarde mensagens como:
   - `Migrations concluídas.`
   - `Avalia Imobe em produção na porta ...`

### 6. Domínio público

1. No serviço web: **Settings → Networking → Generate Domain**.
2. Acesse a URL gerada (ex: `https://avalia-imobe-production.up.railway.app`).
3. Crie sua conta em `/sign-up`.

## O que o deploy faz

1. Instala dependências do frontend e do `server/`
2. Compila o React (`dist/`)
3. Compila a API (`server/dist/`)
4. Na inicialização: roda migrations e sobe o Express
5. Express serve `/api/*` e o SPA React

## Troubleshooting

### Build falhou

- Confira se `VITE_API_URL=/api` está nas variáveis.
- Veja o log completo em Deployments.

### Erro de banco / SSL

- Confirme que `DATABASE_URL` aponta para o Postgres da Railway.
- O projeto já habilita SSL automaticamente para bancos remotos.

### Página em branco ou 404 nas rotas

- O fallback SPA só funciona com `NODE_ENV=production`.
- Confirme que o build gerou a pasta `dist/` nos logs.

### Avaliação retorna erro 500

- Verifique `OPENAI_API_KEY` e `SERPER_API_KEY` nas variáveis.
- Confira os logs do serviço no momento da avaliação.

## Comandos úteis (local)

Simular produção localmente:

```bash
npm install && npm install --prefix server
set NODE_ENV=production
set VITE_API_URL=/api
npm run build:prod
npm run start:prod
```

No PowerShell use `$env:NODE_ENV="production"` em vez de `set`.

## Custo

Railway oferece créditos mensais no plano gratuito/hobby. Postgres + app consomem recursos — monitore em **Usage** no painel.
