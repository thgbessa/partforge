const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'partforge.db'));

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
  -- USUARIOS
  CREATE TABLE IF NOT EXISTS usuarios (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL,
    cargo       TEXT NOT NULL,
    tel         TEXT,
    email       TEXT UNIQUE NOT NULL,
    senha_hash  TEXT NOT NULL,
    ativo       INTEGER DEFAULT 1,
    created_at  INTEGER DEFAULT (unixepoch('now') * 1000)
  );

  -- PECAS
  CREATE TABLE IF NOT EXISTS pecas (
    id          TEXT PRIMARY KEY,
    codigo      TEXT,
    nome        TEXT NOT NULL,
    unidade     TEXT DEFAULT 'UN',
    grupo       TEXT,
    fonte       TEXT,
    linha       TEXT,
    minimo      REAL DEFAULT 0,
    imagem      TEXT,
    taxa        REAL DEFAULT 0,
    dolar       REAL DEFAULT 0,
    markup      REAL DEFAULT 0,
    custo       REAL DEFAULT 0,
    valor_venda REAL DEFAULT 0,
    created_at  INTEGER DEFAULT (unixepoch('now') * 1000)
  );

  -- EQUIPAMENTOS
  CREATE TABLE IF NOT EXISTS equipamentos (
    id          TEXT PRIMARY KEY,
    modelo      TEXT NOT NULL,
    marca       TEXT,
    serie       TEXT,
    linha       TEXT,
    cliente     TEXT,
    local       TEXT,
    contrato    TEXT,
    obs         TEXT,
    campos      TEXT DEFAULT '{}',
    created_at  INTEGER DEFAULT (unixepoch('now') * 1000)
  );

  -- ESTOQUE (quantidade total por peca)
  CREATE TABLE IF NOT EXISTS estoque (
    peca_id     TEXT PRIMARY KEY REFERENCES pecas(id),
    quantidade  REAL DEFAULT 0,
    updated_at  INTEGER DEFAULT (unixepoch('now') * 1000)
  );

  -- DEPOSITOS (quantidade por peca por localização)
  CREATE TABLE IF NOT EXISTS depositos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    peca_id     TEXT NOT NULL REFERENCES pecas(id),
    localizacao TEXT NOT NULL,
    quantidade  REAL DEFAULT 0,
    UNIQUE(peca_id, localizacao)
  );

  -- MOVIMENTACOES (solicitações de peças)
  CREATE TABLE IF NOT EXISTS movimentacoes (
    id              TEXT PRIMARY KEY,
    seq_num         INTEGER,
    status          TEXT DEFAULT 'SOLICITADA',
    peca_id         TEXT,
    peca_codigo     TEXT,
    peca_nome       TEXT,
    peca_unidade    TEXT,
    peca_fonte      TEXT,
    peca_custo      REAL DEFAULT 0,
    qtd             REAL DEFAULT 1,
    equip_id        TEXT,
    equip_serie     TEXT,
    equip_cliente   TEXT,
    equip_modelo    TEXT,
    tecnico         TEXT,
    tem_estoque     INTEGER DEFAULT 0,
    tipo_alocacao   TEXT,
    valor_por_orc   INTEGER DEFAULT 0,
    obs             TEXT,
    transportadora  TEXT,
    rastreio        TEXT,
    previsao_entrega TEXT,
    data_recebimento TEXT,
    hora_recebimento TEXT,
    eventos         TEXT DEFAULT '[]',
    created_at      INTEGER DEFAULT (unixepoch('now') * 1000),
    created_by      TEXT
  );

  -- ORCAMENTOS
  CREATE TABLE IF NOT EXISTS orcamentos (
    id            TEXT PRIMARY KEY,
    numero        TEXT NOT NULL,
    status        TEXT DEFAULT 'ABERTO',
    cliente       TEXT,
    equip_serie   TEXT,
    equip_nome    TEXT,
    os            TEXT,
    data          TEXT,
    obs           TEXT,
    validade      TEXT DEFAULT '30 dias',
    pagamento     TEXT DEFAULT '30 dias',
    entrega       TEXT DEFAULT 'A combinar',
    frete         TEXT DEFAULT 'FOB',
    obs_condicoes TEXT,
    condicoes     TEXT,
    assinatura    TEXT,
    total         REAL DEFAULT 0,
    itens         TEXT DEFAULT '[]',
    solicitacao_id TEXT,
    created_at    INTEGER DEFAULT (unixepoch('now') * 1000),
    created_by    TEXT
  );

  -- DOADORAS (equipamentos doadores de peças)
  CREATE TABLE IF NOT EXISTS doadoras (
    id            TEXT PRIMARY KEY,
    modelo        TEXT NOT NULL,
    serie         TEXT,
    marca         TEXT,
    linha         TEXT,
    classificacao TEXT DEFAULT 'USO',
    fator         REAL DEFAULT 1,
    obs           TEXT,
    created_at    INTEGER DEFAULT (unixepoch('now') * 1000)
  );

  -- RETIRADAS (retirada de peça de doadora)
  CREATE TABLE IF NOT EXISTS retiradas (
    id            TEXT PRIMARY KEY,
    doad_id       TEXT REFERENCES doadoras(id),
    doad_modelo   TEXT,
    doad_serie    TEXT,
    doad_class    TEXT,
    peca_id       TEXT,
    peca_codigo   TEXT,
    peca_nome     TEXT,
    qtd           REAL DEFAULT 1,
    custo_unit    REAL DEFAULT 0,
    custo_total   REAL DEFAULT 0,
    tecnico       TEXT,
    obs           TEXT,
    data          INTEGER DEFAULT (unixepoch('now') * 1000)
  );

  -- PEDIDOS DE COMPRA
  CREATE TABLE IF NOT EXISTS pedidos (
    id            TEXT PRIMARY KEY,
    numero        TEXT NOT NULL,
    status        TEXT DEFAULT 'ABERTO',
    obs           TEXT,
    itens         TEXT DEFAULT '[]',
    created_at    INTEGER DEFAULT (unixepoch('now') * 1000),
    created_by    TEXT
  );

  -- CONFIGURACOES
  CREATE TABLE IF NOT EXISTS configuracoes (
    chave   TEXT PRIMARY KEY,
    valor   TEXT NOT NULL
  );

  -- SESSOES (tokens de acesso)
  CREATE TABLE IF NOT EXISTS sessoes (
    token       TEXT PRIMARY KEY,
    usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
    criado_em   INTEGER DEFAULT (unixepoch('now') * 1000),
    expira_em   INTEGER NOT NULL,
    dispositivo TEXT
  );

  -- Indices para performance
  CREATE INDEX IF NOT EXISTS idx_mov_status    ON movimentacoes(status);
  CREATE INDEX IF NOT EXISTS idx_mov_tecnico   ON movimentacoes(tecnico);
  CREATE INDEX IF NOT EXISTS idx_mov_created   ON movimentacoes(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orc_status    ON orcamentos(status);
  CREATE INDEX IF NOT EXISTS idx_orc_created   ON orcamentos(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
  CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
`);

// Config padrão
const initConfig = db.prepare(`INSERT OR IGNORE INTO configuracoes(chave, valor) VALUES (?, ?)`);
initConfig.run('config_orcamento', JSON.stringify({
  taxa: 0, dolar: 0, markup: 0,
  validade: '30 dias', prazoEntrega: 'A combinar',
  formaPagamento: '30 dias', condicoesGerais: ''
}));
initConfig.run('config_compras', JSON.stringify({
  diasEstoque: 30, periodoAnalise: 90,
  incluiDoadora: 'sim', incluiPendente: 'sim', diasPorPeca: {}
}));
initConfig.run('seq_counter', '0');

// Admin padrão se não houver usuários
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('crypto');
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

const countUsers = db.prepare('SELECT COUNT(*) as n FROM usuarios').get();
if (countUsers.n === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO usuarios(id, nome, cargo, email, senha_hash) VALUES (?,?,?,?,?)`)
    .run(uid(), 'Administrador', 'Gerente', 'admin@partforge.com', hash);
  console.log('✅ Usuário admin criado: admin@partforge.com / admin123');
}

module.exports = db;
