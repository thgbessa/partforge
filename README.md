# PartForge v2.0 — Sistema de Gestão de Peças

Sistema completo de gestão de peças, equipamentos, estoque, movimentações, orçamentos e compras.

## 🚀 Deploy no Railway (Recomendado)

### 1. Preparar o projeto

```bash
# Crie uma conta gratuita em railway.app
# Instale o Railway CLI
npm install -g @railway/cli
railway login
```

### 2. Criar o projeto no Railway

```bash
# Na pasta do projeto:
railway init
railway up
```

### 3. Configurar variáveis de ambiente

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `JWT_SECRET` | uma string aleatória longa (ex: `abc123xyz...`) |
| `NODE_ENV` | `production` |
| `DB_DIR` | `/data` |

### 4. Adicionar Volume persistente

No Railway, vá em **Settings → Volumes** e adicione:
- Mount path: `/data`
- Isso garante que o banco de dados não seja apagado nos deploys

### 5. Importar seu backup

Após subir o sistema:
1. Acesse a URL gerada pelo Railway
2. Faça login com: `admin@partforge.com` / `admin123`
3. Clique no ícone de **importar backup** no topo
4. Selecione seu arquivo `partforge_backup_*.json`
5. **Troque a senha do admin** em Usuários!

---

## 💻 Rodar localmente

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Acesse: http://localhost:3000
```

## 🔧 Importar catálogo de peças

Se você tiver o arquivo `gestao-pecas.html` original, coloque-o na raiz do projeto e rode:

```bash
node server/seed-catalogs.js
```

Isso importa todos os ~2000 peças dos catálogos para o banco de dados.

---

## 📱 App Mobile (próxima fase)

O sistema já está preparado para o app móvel. A API em `/api/*` aceita qualquer cliente — React Native, Flutter, etc.

Endpoints principais para o app:
- `POST /api/auth/login` — autenticação
- `GET /api/movimentacoes` — listagem de solicitações
- `POST /api/movimentacoes` — nova solicitação de peça
- `GET /api/orcamentos` — listagem de orçamentos
- `POST /api/orcamentos` — novo orçamento
- `GET /api/pedidos` — pedidos de compra

---

## 👥 Perfis de acesso

| Cargo | Acesso |
|-------|--------|
| Gerente | Tudo, incluindo usuários e configurações |
| Back Office | Tudo, exceto excluir usuários |
| Assessor | Tudo, exceto configurações |
| Tecnico | Apenas suas próprias solicitações |

---

## 📦 Estrutura do projeto

```
partforge/
├── server/
│   ├── index.js        # Servidor Express
│   ├── database.js     # Schema SQLite
│   ├── routes.js       # Todos os endpoints da API
│   ├── auth.js         # JWT e middleware de auth
│   └── seed-catalogs.js # Importa catálogos do HTML original
├── public/
│   ├── index.html      # Interface principal
│   ├── css/app.css     # Estilos (idêntico ao original)
│   └── js/
│       ├── api.js      # Cliente da API REST
│       └── app.js      # Toda a lógica do frontend
├── package.json
├── railway.toml        # Configuração Railway
└── .env.example        # Variáveis de ambiente
```
