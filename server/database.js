const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');
const bcrypt = require('bcryptjs');

const DB_DIR  = process.env.DB_DIR || path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'partforge.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function now() { return Date.now(); }

let _db = null;

// Sinaliza se houve escrita no banco desde o último backup automático
// consultado (usado para disparar backups só quando algo de fato mudou,
// sem precisar fazer um export completo a cada clique do usuário).
let _mudouDesdeUltimoBackup = false;

function consumirFlagMudanca() {
  const mudou = _mudouDesdeUltimoBackup;
  _mudouDesdeUltimoBackup = false;
  return mudou;
}

// Persiste o banco em disco. Escrita ATÔMICA: grava num arquivo temporário e
// só então renomeia por cima do arquivo real — se o processo for interrompido
// no meio da escrita (crash, restart, OOM), o arquivo original NUNCA fica
// corrompido/truncado, porque o rename só acontece depois que a escrita
// terminou por completo.
function persist() {
  const data = _db.export();
  const tmpFile = DB_FILE + '.tmp';
  fs.writeFileSync(tmpFile, Buffer.from(data));
  fs.renameSync(tmpFile, DB_FILE);
  _mudouDesdeUltimoBackup = true;
}

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    try {
      _db = new SQL.Database(fileBuffer);
    } catch (e) {
      // Arquivo existe mas está corrompido/ilegível: NUNCA seguir em frente
      // criando um banco vazio silenciosamente (isso apagaria os dados na
      // próxima escrita). Falha alto e claro para investigação manual.
      console.error('ERRO CRÍTICO: arquivo do banco existe mas não pôde ser aberto:', e.message);
      console.error('Arquivo:', DB_FILE, '| Tamanho:', fileBuffer.length, 'bytes');
      console.error('O servidor NÃO vai iniciar para evitar sobrescrever dados. Restaure um backup e tente novamente.');
      throw e;
    }
  } else {
    _db = new SQL.Database();
  }

  _db.run(`PRAGMA foreign_keys = ON;`);

  _db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, cargo TEXT NOT NULL,
      tel TEXT, email TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL,
      ativo INTEGER DEFAULT 1, created_at INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pecas (
      id TEXT PRIMARY KEY, codigo TEXT, nome TEXT NOT NULL,
      unidade TEXT DEFAULT 'UN', grupo TEXT, fonte TEXT, linha TEXT,
      minimo REAL DEFAULT 0, imagem TEXT,
      taxa REAL DEFAULT 0, dolar REAL DEFAULT 0, markup REAL DEFAULT 0,
      custo REAL DEFAULT 0, valor_venda REAL DEFAULT 0,
      created_at INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS equipamentos (
      id TEXT PRIMARY KEY, modelo TEXT NOT NULL, marca TEXT, serie TEXT,
      linha TEXT, cliente TEXT, local TEXT, contrato TEXT, obs TEXT,
      campos TEXT DEFAULT '{}', created_at INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS estoque (
      peca_id TEXT PRIMARY KEY, quantidade REAL DEFAULT 0, updated_at INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS depositos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, peca_id TEXT NOT NULL,
      localizacao TEXT NOT NULL, quantidade REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id TEXT PRIMARY KEY, seq_num INTEGER, status TEXT DEFAULT 'SOLICITADA',
      peca_id TEXT, peca_codigo TEXT, peca_nome TEXT, peca_unidade TEXT,
      peca_fonte TEXT, peca_custo REAL DEFAULT 0, qtd REAL DEFAULT 1,
      equip_id TEXT, equip_serie TEXT, equip_cliente TEXT, equip_modelo TEXT,
      tecnico TEXT, tem_estoque INTEGER DEFAULT 0, tipo_alocacao TEXT, num_seq_origem INTEGER,
      valor_por_orc INTEGER DEFAULT 0, obs TEXT, transportadora TEXT,
      rastreio TEXT, previsao_entrega TEXT, data_recebimento TEXT,
      hora_recebimento TEXT, eventos TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT 0, created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS orcamentos (
      id TEXT PRIMARY KEY, numero TEXT NOT NULL, status TEXT DEFAULT 'ABERTO',
      cliente TEXT, equip_serie TEXT, equip_nome TEXT, os TEXT, data TEXT,
      obs TEXT, validade TEXT DEFAULT '30 dias', pagamento TEXT DEFAULT '30 dias',
      entrega TEXT DEFAULT 'A combinar', frete TEXT DEFAULT 'FOB',
      obs_condicoes TEXT, condicoes TEXT, assinatura TEXT,
      total REAL DEFAULT 0, itens TEXT DEFAULT '[]',
      solicitacao_id TEXT, created_at INTEGER DEFAULT 0, created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS doadoras (
      id TEXT PRIMARY KEY, modelo TEXT NOT NULL, serie TEXT, marca TEXT,
      linha TEXT, classificacao TEXT DEFAULT 'USO', fator REAL DEFAULT 1,
      obs TEXT, created_at INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS retiradas (
      id TEXT PRIMARY KEY, doad_id TEXT, doad_modelo TEXT, doad_serie TEXT,
      doad_class TEXT, peca_id TEXT, peca_codigo TEXT, peca_nome TEXT,
      qtd REAL DEFAULT 1, custo_unit REAL DEFAULT 0, custo_total REAL DEFAULT 0,
      tecnico TEXT, obs TEXT, data INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY, numero TEXT NOT NULL, status TEXT DEFAULT 'ABERTO',
      obs TEXT, itens TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT 0, created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY, valor TEXT NOT NULL
    );
  `);

  // Config padrão
  const cfgs = [
    ['config_orcamento', JSON.stringify({ taxa:0, dolar:0, markup:0, validade:'30 dias', prazoEntrega:'A combinar', formaPagamento:'30 dias', condicoesGerais:'' })],
    ['config_compras',   JSON.stringify({ diasEstoque:30, periodoAnalise:90, incluiDoadora:'sim', incluiPendente:'sim' })],
    ['seq_counter',      '0'],
  ];
  for (const [k, v] of cfgs) {
    _db.run(`INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES (?,?)`, [k, v]);
  }

  // Admin padrão
  const rows = _db.exec(`SELECT COUNT(*) as n FROM usuarios`);
  const count = rows[0]?.values[0][0] || 0;
  if (count === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    _db.run(`INSERT INTO usuarios(id,nome,cargo,email,senha_hash,created_at) VALUES (?,?,?,?,?,?)`,
      [uid(), 'Administrador', 'Gerente', 'admin@partforge.com', hash, now()]);
    console.log('✅ Admin criado: admin@partforge.com / admin123');
  }

  // Migracao: adiciona coluna preco_usd se ainda nao existir
  try { _db.run("ALTER TABLE pecas ADD COLUMN preco_usd REAL DEFAULT 0"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("ALTER TABLE movimentacoes ADD COLUMN valor_frete REAL DEFAULT 0"); } catch(e) { /* coluna ja existe */ }
  try { _db.run(`CREATE TABLE IF NOT EXISTS solicitacoes_compra (
    id TEXT PRIMARY KEY, numero TEXT, status TEXT DEFAULT 'SOLICITADO',
    demanda TEXT, demanda_nome TEXT, equip_serie TEXT, equip_nome TEXT DEFAULT '', equip_cliente TEXT DEFAULT '',
    itens TEXT DEFAULT '[]',
    obs TEXT, status_changed_at INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0, created_by TEXT
  )`); } catch(e) { console.log('erro criando solicitacoes_compra', e.message); }
  try { _db.run("ALTER TABLE solicitacoes_compra ADD COLUMN equip_nome TEXT DEFAULT ''"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("ALTER TABLE solicitacoes_compra ADD COLUMN equip_cliente TEXT DEFAULT ''"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("UPDATE orcamentos SET status='APROVADO_TECNICO' WHERE status='APROVADO'"); } catch(e) {}
  try { _db.run("UPDATE orcamentos SET status='A_FATURAR' WHERE status='FATURANDO'"); } catch(e) {}
  try { _db.run("ALTER TABLE movimentacoes ADD COLUMN origem TEXT DEFAULT 'desktop'"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("ALTER TABLE orcamentos ADD COLUMN status_changed_at INTEGER DEFAULT 0"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("UPDATE orcamentos SET status_changed_at = created_at WHERE status_changed_at IS NULL OR status_changed_at = 0"); } catch(e) {}
  try { _db.run("ALTER TABLE orcamentos ADD COLUMN equipamentos TEXT DEFAULT '[]'"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("ALTER TABLE orcamentos ADD COLUMN updated_at INTEGER DEFAULT 0"); } catch(e) { /* coluna ja existe */ }
  try { _db.run("UPDATE orcamentos SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = 0"); } catch(e) {}

  persist();
  console.log('✅ Banco de dados iniciado');
  return _db;
}

// API compatível com better-sqlite3 (síncrona via wrapper)
function getDb() { return _db; }

function query(sql, params = []) {
  try {
    const result = _db.exec(sql, params);
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
  } catch(e) {
    console.error('Query error:', sql, e.message);
    throw e;
  }
}

function run(sql, params = []) {
  _db.run(sql, params);
  persist();
}

// Variante para loops de importação em massa: NÃO persiste a cada linha
// (persist() serializa o banco inteiro — chamá-lo milhares de vezes seguidas
// trava o servidor). Quem usar isso deve chamar persist() manualmente ao final.
function runBatch(sql, params = []) {
  _db.run(sql, params);
}

function get(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

module.exports = { init, query, run, runBatch, get, persist, consumirFlagMudanca, uid, now };
