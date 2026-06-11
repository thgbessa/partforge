const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'partforge.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

let db;
let SQL;

// Salva o banco em disco a cada mudança
function persist() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

// Wrapper para manter a mesma interface do better-sqlite3
function createWrapper(sqlDb) {
  return {
    prepare(sql) {
      return {
        run(...params) {
          sqlDb.run(sql, params);
          persist();
          return { changes: 1 };
        },
        get(...params) {
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = sqlDb.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) results.push(stmt.getAsObject());
          stmt.free();
          return results;
        }
      };
    },
    exec(sql) {
      sqlDb.run(sql);
      persist();
    },
    run(sql, params) {
      sqlDb.run(sql, params || []);
      persist();
    },
    transaction(fn) {
      return function(...args) {
        sqlDb.run('BEGIN');
        try {
          const result = fn(...args);
          sqlDb.run('COMMIT');
          persist();
          return result;
        } catch(e) {
          sqlDb.run('ROLLBACK');
          throw e;
        }
      };
    },
    pragma(sql) {
      sqlDb.run('PRAGMA ' + sql);
    }
  };
}

async function initDb() {
  SQL = await initSqlJs();
  let sqlDb;
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = createWrapper(sqlDb);

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY, nome TEXT NOT NULL, cargo TEXT NOT NULL,
      tel TEXT, email TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL,
      ativo INTEGER DEFAULT 1, created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS pecas (
      id TEXT PRIMARY KEY, codigo TEXT, nome TEXT NOT NULL, unidade TEXT DEFAULT 'UN',
      grupo TEXT, fonte TEXT, linha TEXT, minimo REAL DEFAULT 0, imagem TEXT,
      taxa REAL DEFAULT 0, dolar REAL DEFAULT 0, markup REAL DEFAULT 0,
      custo REAL DEFAULT 0, valor_venda REAL DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS equipamentos (
      id TEXT PRIMARY KEY, modelo TEXT NOT NULL, marca TEXT, serie TEXT, linha TEXT,
      cliente TEXT, local TEXT, contrato TEXT, obs TEXT, campos TEXT DEFAULT '{}',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS estoque (
      peca_id TEXT PRIMARY KEY, quantidade REAL DEFAULT 0,
      updated_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS depositos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, peca_id TEXT NOT NULL,
      localizacao TEXT NOT NULL, quantidade REAL DEFAULT 0,
      UNIQUE(peca_id, localizacao)
    );
    CREATE TABLE IF NOT EXISTS movimentacoes (
      id TEXT PRIMARY KEY, seq_num INTEGER, status TEXT DEFAULT 'SOLICITADA',
      peca_id TEXT, peca_codigo TEXT, peca_nome TEXT, peca_unidade TEXT,
      peca_fonte TEXT, peca_custo REAL DEFAULT 0, qtd REAL DEFAULT 1,
      equip_id TEXT, equip_serie TEXT, equip_cliente TEXT, equip_modelo TEXT,
      tecnico TEXT, tem_estoque INTEGER DEFAULT 0, tipo_alocacao TEXT,
      valor_por_orc INTEGER DEFAULT 0, obs TEXT, transportadora TEXT,
      rastreio TEXT, previsao_entrega TEXT, data_recebimento TEXT,
      hora_recebimento TEXT, eventos TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000), created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS orcamentos (
      id TEXT PRIMARY KEY, numero TEXT NOT NULL, status TEXT DEFAULT 'ABERTO',
      cliente TEXT, equip_serie TEXT, equip_nome TEXT, os TEXT, data TEXT,
      obs TEXT, validade TEXT DEFAULT '30 dias', pagamento TEXT DEFAULT '30 dias',
      entrega TEXT DEFAULT 'A combinar', frete TEXT DEFAULT 'FOB',
      obs_condicoes TEXT, condicoes TEXT, assinatura TEXT, total REAL DEFAULT 0,
      itens TEXT DEFAULT '[]', solicitacao_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000), created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS doadoras (
      id TEXT PRIMARY KEY, modelo TEXT NOT NULL, serie TEXT, marca TEXT,
      linha TEXT, classificacao TEXT DEFAULT 'USO', fator REAL DEFAULT 1, obs TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS retiradas (
      id TEXT PRIMARY KEY, doad_id TEXT, doad_modelo TEXT, doad_serie TEXT,
      doad_class TEXT, peca_id TEXT, peca_codigo TEXT, peca_nome TEXT,
      qtd REAL DEFAULT 1, custo_unit REAL DEFAULT 0, custo_total REAL DEFAULT 0,
      tecnico TEXT, obs TEXT, data INTEGER DEFAULT (strftime('%s','now')*1000)
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY, numero TEXT NOT NULL, status TEXT DEFAULT 'ABERTO',
      obs TEXT, itens TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (strftime('%s','now')*1000), created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY, valor TEXT NOT NULL
    );
  `);

  // Config padrão
  const configs = [
    ['config_orcamento', JSON.stringify({ taxa:0, dolar:0, markup:0, validade:'30 dias', prazoEntrega:'A combinar', formaPagamento:'30 dias', condicoesGerais:'' })],
    ['config_compras',   JSON.stringify({ diasEstoque:30, periodoAnalise:90, incluiDoadora:'sim', incluiPendente:'sim', diasPorPeca:{} })],
    ['seq_counter',      '0'],
  ];
  for (const [k,v] of configs) {
    const exists = db.prepare('SELECT chave FROM configuracoes WHERE chave = ?').get(k);
    if (!exists) db.prepare('INSERT INTO configuracoes(chave,valor) VALUES(?,?)').run(k, v);
  }

  // Admin padrão
  const bcrypt = require('bcryptjs');
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  const countRow = db.prepare('SELECT COUNT(*) as n FROM usuarios').get();
  if (!countRow || countRow.n == 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO usuarios(id,nome,cargo,email,senha_hash) VALUES(?,?,?,?,?)')
      .run(uid(), 'Administrador', 'Gerente', 'admin@partforge.com', hash);
    console.log('✅ Admin criado: admin@partforge.com / admin123');
  }

  console.log('✅ Banco de dados iniciado');
  return db;
}

module.exports = { initDb, getDb: () => db };
