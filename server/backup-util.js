// ============================================================
//  BACKUP E RESTAURAÇÃO — módulo único
// ------------------------------------------------------------
//  Lê a estrutura do banco sozinho (todas as tabelas e colunas), então
//  qualquer campo ou tabela criado no futuro entra no backup e na
//  restauração automaticamente, sem precisar lembrar de atualizar listas.
//
//  Formato gerado (v3.0): cada tabela vem exatamente como está no banco.
//  A restauração aceita também os formatos antigos (v2.0 do botão, com
//  listas já convertidas, e v2.0 do e-mail, com listas em texto).
// ============================================================
const db = require('./database');

function listarTabelas() {
  return db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .map(t => t.name);
}

function colunasDe(tabela) {
  return db.query(`PRAGMA table_info("${tabela}")`).map(c => c.name);
}

// Gera uma cópia completa do banco.
//   incluirSenhas: false → usuários vão SEM a senha (backup do botão e do
//   e-mail). true → só para a cópia que fica no servidor antes de restaurar.
function gerarSnapshot({ incluirSenhas = false, origem = '' } = {}) {
  const tabelas = listarTabelas();
  const snap = {
    _version: '3.0',
    _exportedAt: new Date().toISOString(),
    _origem: origem,
    _tabelas: tabelas,
    _contagens: {},
  };
  for (const t of tabelas) {
    let rows = db.query(`SELECT * FROM "${t}"`);
    if (t === 'usuarios' && !incluirSenhas) rows = rows.map(({ senha_hash, ...u }) => u);
    snap[t] = rows;
    snap._contagens[t] = rows.length;
  }
  return snap;
}

// Converte um valor do backup para gravar no banco: listas/objetos viram
// texto JSON (formato do banco); texto, número e nulo ficam como estão.
function _valorDb(v) {
  if (v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

// Usuários: nunca apaga quem existe hoje (o admin que está restaurando
// continua com acesso). Quem existe é atualizado (menos a senha); quem não
// existe é criado — sem senha conhecida quando o backup não traz a senha,
// e aí o admin define uma nova senha para essa pessoa.
function _restaurarUsuarios(lista, r) {
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const cols = colunasDe('usuarios').filter(c => c !== 'senha_hash');
  for (const u of lista) {
    if (!u || typeof u !== 'object' || !u.id || !u.email) { r.ignorados++; continue; }
    const campos = cols.filter(c => c !== 'id' && u[c] !== undefined);
    const existe = db.get('SELECT id FROM usuarios WHERE id=?', [u.id]);
    // e-mail já usado por OUTRA pessoa: não mexe (evita conflito de login)
    const emailDeOutro = db.get('SELECT id FROM usuarios WHERE email=? AND id<>?', [u.email, u.id]);
    if (emailDeOutro) { r.ignorados++; continue; }
    if (existe) {
      if (campos.length) {
        db.runBatch(`UPDATE usuarios SET ${campos.map(c => `"${c}"=?`).join(',')} WHERE id=?`,
          [...campos.map(c => _valorDb(u[c])), u.id]);
      }
      r.atualizados++;
      continue;
    }
    let hash = u.senha_hash;
    if (!hash) { hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10); r.sem_senha.push(u.nome || u.email); }
    const cs = ['id', ...campos];
    db.runBatch(`INSERT INTO usuarios("senha_hash",${cs.map(c => `"${c}"`).join(',')}) VALUES(?,${cs.map(() => '?').join(',')})`,
      [hash, ...cs.map(c => _valorDb(u[c]))]);
    r.criados++;
  }
}

// Restaura um backup SUBSTITUINDO os dados: cada tabela que vem no arquivo
// fica exatamente igual ao arquivo. Tabelas que o arquivo não traz (backups
// antigos) ficam como estão. Tudo numa transação: se der erro no meio,
// nada é alterado.
// Confere se o arquivo é um backup utilizável, SEM alterar nada.
function validarSnapshot(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error('Arquivo de backup inválido.');
  const tabelas = listarTabelas();
  const presentes = tabelas.filter(t => t !== 'usuarios' && Array.isArray(s[t]));
  const temCfg = ['config_orcamento', 'config_compras'].some(k => s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]));
  const usuarios = Array.isArray(s.usuarios) ? s.usuarios : null;
  if (!presentes.length && !temCfg && !usuarios) throw new Error('O arquivo não contém nenhuma tabela do PartForge.');
  const total = presentes.reduce((a, t) => a + s[t].length, 0) + (usuarios ? usuarios.length : 0);
  if (total === 0) throw new Error('O arquivo de backup está vazio.');
}

function restaurarSnapshot(s) {
  validarSnapshot(s);
  const tabelas = listarTabelas();
  const presentes = tabelas.filter(t => t !== 'usuarios' && Array.isArray(s[t]));
  const cfgAntigas = ['config_orcamento', 'config_compras'].filter(k => s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]));
  const usuarios = Array.isArray(s.usuarios) ? s.usuarios : null;


  const relatorio = { tabelas: {}, usuarios: { atualizados: 0, criados: 0, ignorados: 0, sem_senha: [] } };
  db.runBatch('BEGIN');
  try {
    for (const t of presentes) {
      const cols = colunasDe(t);
      db.runBatch(`DELETE FROM "${t}"`);
      let n = 0;
      for (const row of s[t]) {
        if (!row || typeof row !== 'object') continue;
        const cs = cols.filter(c => row[c] !== undefined);
        if (!cs.length) continue;
        db.runBatch(`INSERT OR REPLACE INTO "${t}"(${cs.map(c => `"${c}"`).join(',')}) VALUES(${cs.map(() => '?').join(',')})`,
          cs.map(c => _valorDb(row[c])));
        n++;
      }
      relatorio.tabelas[t] = n;
    }
    // Configurações no formato antigo (backup do botão v2.0)
    for (const k of cfgAntigas) {
      db.runBatch('INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES(?,?)', [k, JSON.stringify(s[k])]);
    }
    if (usuarios) _restaurarUsuarios(usuarios, relatorio.usuarios);
    db.runBatch('COMMIT');
  } catch (e) {
    try { db.runBatch('ROLLBACK'); } catch (_) {}
    throw e;
  }
  db.persist();
  return relatorio;
}

module.exports = { gerarSnapshot, restaurarSnapshot, validarSnapshot, listarTabelas };
