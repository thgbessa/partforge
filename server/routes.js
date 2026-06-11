const express = require('express');
const router = express.Router();
const { getDb } = require('./database');
const db = { prepare: (...a) => getDb().prepare(...a), exec: (...a) => getDb().exec(...a), run: (...a) => getDb().run(...a), transaction: (...a) => getDb().transaction(...a) };
const bcrypt = require('bcryptjs');
const { gerarToken, autenticar, isAdmin } = require('./auth');

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function now() { return Date.now(); }

// ============================================================
//  AUTH
// ============================================================
router.post('/auth/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ erro: 'E-mail não encontrado' });
  if (!bcrypt.compareSync(senha, user.senha_hash)) return res.status(401).json({ erro: 'Senha incorreta' });

  const token = gerarToken(user);
  res.json({ token, usuario: { id: user.id, nome: user.nome, cargo: user.cargo, email: user.email } });
});

router.get('/auth/me', autenticar, (req, res) => {
  res.json({ usuario: req.user });
});

// ============================================================
//  USUARIOS
// ============================================================
router.get('/usuarios', autenticar, isAdmin, (req, res) => {
  const lista = db.prepare('SELECT id, nome, cargo, tel, email, ativo, created_at FROM usuarios ORDER BY nome').all();
  res.json(lista);
});

router.post('/usuarios', autenticar, isAdmin, (req, res) => {
  const { nome, cargo, tel, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, senha' });
  if (senha.length < 6) return res.status(400).json({ erro: 'Senha mínimo 6 caracteres' });

  const dup = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (dup) return res.status(409).json({ erro: 'E-mail já cadastrado' });

  const id = uid();
  const hash = bcrypt.hashSync(senha, 10);
  db.prepare('INSERT INTO usuarios(id, nome, cargo, tel, email, senha_hash) VALUES (?,?,?,?,?,?)')
    .run(id, nome, cargo || 'Tecnico', tel || '', email.toLowerCase(), hash);
  res.status(201).json({ id });
});

router.put('/usuarios/:id', autenticar, isAdmin, (req, res) => {
  const { nome, cargo, tel, email, senha } = req.body;
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ erro: 'Usuário não encontrado' });

  if (email && email !== user.email) {
    const dup = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email.toLowerCase(), req.params.id);
    if (dup) return res.status(409).json({ erro: 'E-mail já cadastrado' });
  }

  let hash = user.senha_hash;
  if (senha) {
    if (senha.length < 6) return res.status(400).json({ erro: 'Senha mínimo 6 caracteres' });
    hash = bcrypt.hashSync(senha, 10);
  }

  db.prepare('UPDATE usuarios SET nome=?, cargo=?, tel=?, email=?, senha_hash=? WHERE id=?')
    .run(nome || user.nome, cargo || user.cargo, tel ?? user.tel, (email || user.email).toLowerCase(), hash, req.params.id);
  res.json({ ok: true });
});

router.delete('/usuarios/:id', autenticar, isAdmin, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ erro: 'Não pode excluir própria conta' });
  db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
//  PEÇAS
// ============================================================
router.get('/pecas', autenticar, (req, res) => {
  const { q, grupo, fonte } = req.query;
  let sql = 'SELECT * FROM pecas WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (nome LIKE ? OR codigo LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  if (grupo) { sql += ' AND grupo = ?'; params.push(grupo); }
  if (fonte) { sql += ' AND fonte = ?'; params.push(fonte); }
  sql += ' ORDER BY nome';
  res.json(db.prepare(sql).all(...params));
});

router.post('/pecas', autenticar, isAdmin, (req, res) => {
  const p = req.body;
  if (!p.nome) return res.status(400).json({ erro: 'Nome obrigatório' });
  const id = p.id || uid();
  db.prepare(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, p.codigo||'', p.nome, p.unidade||'UN', p.grupo||'', p.fonte||'', p.linha||'',
         p.minimo||0, p.imagem||'', p.taxa||0, p.dolar||0, p.markup||0, p.custo||0, p.valor_venda||0);
  res.status(201).json({ id });
});

router.put('/pecas/:id', autenticar, isAdmin, (req, res) => {
  const p = req.body;
  const exists = db.prepare('SELECT id FROM pecas WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ erro: 'Peça não encontrada' });
  db.prepare(`UPDATE pecas SET codigo=?,nome=?,unidade=?,grupo=?,fonte=?,linha=?,minimo=?,taxa=?,dolar=?,markup=?,custo=?,valor_venda=? WHERE id=?`)
    .run(p.codigo||'', p.nome, p.unidade||'UN', p.grupo||'', p.fonte||'', p.linha||'',
         p.minimo||0, p.taxa||0, p.dolar||0, p.markup||0, p.custo||0, p.valor_venda||0, req.params.id);
  res.json({ ok: true });
});

router.delete('/pecas/:id', autenticar, isAdmin, (req, res) => {
  db.prepare('DELETE FROM pecas WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM estoque WHERE peca_id = ?').run(req.params.id);
  db.prepare('DELETE FROM depositos WHERE peca_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Importação em lote
router.post('/pecas/importar', autenticar, isAdmin, (req, res) => {
  const { pecas } = req.body;
  if (!Array.isArray(pecas)) return res.status(400).json({ erro: 'Array de peças obrigatório' });
  const stmt = db.prepare(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,taxa,dolar,markup,custo,valor_venda)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const run = db.transaction((lista) => {
    for (const p of lista) {
      stmt.run(p.id||uid(), p.codigo||'', p.nome||'', p.unidade||'UN', p.grupo||'',
               p.fonte||'', p.linha||'', p.minimo||0, p.taxa||0, p.dolar||0, p.markup||0, p.custo||0, p.valor_venda||0);
    }
  });
  run(pecas);
  res.json({ importadas: pecas.length });
});

// ============================================================
//  EQUIPAMENTOS
// ============================================================
router.get('/equipamentos', autenticar, (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM equipamentos WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (modelo LIKE ? OR serie LIKE ? OR cliente LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY modelo, cliente';
  res.json(db.prepare(sql).all(...params));
});

router.post('/equipamentos', autenticar, isAdmin, (req, res) => {
  const e = req.body;
  if (!e.modelo) return res.status(400).json({ erro: 'Modelo obrigatório' });
  const id = e.id || uid();
  db.prepare(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, e.modelo, e.marca||'', e.serie||'', e.linha||'', e.cliente||'', e.local||'',
         e.contrato||'', e.obs||'', JSON.stringify(e.campos||{}));
  res.status(201).json({ id });
});

router.put('/equipamentos/:id', autenticar, isAdmin, (req, res) => {
  const e = req.body;
  db.prepare(`UPDATE equipamentos SET modelo=?,marca=?,serie=?,linha=?,cliente=?,local=?,contrato=?,obs=?,campos=? WHERE id=?`)
    .run(e.modelo, e.marca||'', e.serie||'', e.linha||'', e.cliente||'', e.local||'',
         e.contrato||'', e.obs||'', JSON.stringify(e.campos||{}), req.params.id);
  res.json({ ok: true });
});

router.delete('/equipamentos/:id', autenticar, isAdmin, (req, res) => {
  db.prepare('DELETE FROM equipamentos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/equipamentos/importar', autenticar, isAdmin, (req, res) => {
  const { equipamentos } = req.body;
  if (!Array.isArray(equipamentos)) return res.status(400).json({ erro: 'Array obrigatório' });
  const stmt = db.prepare(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const run = db.transaction((lista) => {
    for (const e of lista) {
      stmt.run(e.id||uid(), e.modelo||'', e.marca||'', e.serie||'', e.linha||'',
               e.cliente||'', e.local||'', e.contrato||'', e.obs||'', JSON.stringify(e.campos||{}));
    }
  });
  run(equipamentos);
  res.json({ importados: equipamentos.length });
});

// ============================================================
//  ESTOQUE
// ============================================================
router.get('/estoque', autenticar, (req, res) => {
  const estoque = db.prepare(`
    SELECT e.peca_id, e.quantidade, e.updated_at,
           p.nome as peca_nome, p.codigo as peca_codigo, p.unidade, p.minimo, p.grupo
    FROM estoque e
    JOIN pecas p ON p.id = e.peca_id
    ORDER BY p.nome
  `).all();
  const depositos = db.prepare('SELECT * FROM depositos').all();
  res.json({ estoque, depositos });
});

router.put('/estoque/:pecaId', autenticar, isAdmin, (req, res) => {
  const { quantidade } = req.body;
  db.prepare('INSERT OR REPLACE INTO estoque(peca_id, quantidade, updated_at) VALUES (?,?,?)').run(req.params.pecaId, quantidade, now());
  res.json({ ok: true });
});

// ============================================================
//  MOVIMENTAÇÕES
// ============================================================
router.get('/movimentacoes', autenticar, (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM movimentacoes WHERE 1=1';
  const params = [];
  // Técnico vê só as suas
  const adminCargos = ['Gerente', 'Back Office', 'Assessor'];
  if (!adminCargos.includes(req.user.cargo)) {
    sql += ' AND tecnico = ?'; params.push(req.user.nome);
  }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (q) {
    sql += ' AND (peca_nome LIKE ? OR peca_codigo LIKE ? OR equip_serie LIKE ? OR equip_cliente LIKE ? OR tecnico LIKE ?)';
    params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`);
  }
  sql += ' ORDER BY created_at DESC';
  const lista = db.prepare(sql).all(...params).map(m => ({ ...m, eventos: JSON.parse(m.eventos||'[]') }));
  res.json(lista);
});

router.post('/movimentacoes', autenticar, (req, res) => {
  const m = req.body;
  if (!m.peca_id && !m.peca_nome) return res.status(400).json({ erro: 'Peça obrigatória' });

  // Incrementa contador sequencial
  const cfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'seq_counter'").get();
  const seq = parseInt(cfg.valor) + 1;
  db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = 'seq_counter'").run(String(seq));

  const id = uid();
  const eventos = [{ status: 'SOLICITADA', data: now(), obs: '' }];
  db.prepare(`INSERT INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,
    qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,valor_por_orc,obs,eventos,created_at,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, seq, 'SOLICITADA', m.peca_id||'', m.peca_codigo||'', m.peca_nome||'', m.peca_unidade||'UN',
         m.peca_fonte||'', m.peca_custo||0, m.qtd||1, m.equip_id||'', m.equip_serie||'', m.equip_cliente||'',
         m.equip_modelo||'', m.tecnico||req.user.nome, m.tem_estoque?1:0, m.tipo_alocacao||'',
         m.valor_por_orc?1:0, m.obs||'', JSON.stringify(eventos), now(), req.user.id);
  res.status(201).json({ id, seq_num: seq });
});

router.put('/movimentacoes/:id/acao', autenticar, (req, res) => {
  const { acao, obs, transporte, rastreio, previsao_entrega, data_recebimento, hora_recebimento } = req.body;
  const sol = db.prepare('SELECT * FROM movimentacoes WHERE id = ?').get(req.params.id);
  if (!sol) return res.status(404).json({ erro: 'Solicitação não encontrada' });

  const eventos = JSON.parse(sol.eventos || '[]');
  const addEvento = (status, extra='') => eventos.push({ status, data: now(), obs: [obs||'', extra].filter(Boolean).join(' | '), user: req.user.nome });

  const updates = { eventos: JSON.stringify(eventos) };

  if (acao === 'ENVIAR') {
    if (!sol.tem_estoque) {
      updates.status = 'COMPRA_PENDENTE';
      addEvento('COMPRA_PENDENTE');
    } else {
      // Baixa estoque
      db.prepare('UPDATE estoque SET quantidade = MAX(0, quantidade - ?), updated_at = ? WHERE peca_id = ?')
        .run(sol.qtd, now(), sol.peca_id);
      updates.status = 'ENVIADA';
      addEvento('ENVIADA');
    }
  } else if (acao === 'DESPACHAR') {
    if (!transporte) return res.status(400).json({ erro: 'Transporte obrigatório' });
    updates.status = 'DESPACHADA';
    updates.transportadora = transporte;
    updates.rastreio = rastreio || '';
    updates.previsao_entrega = previsao_entrega || '';
    addEvento('DESPACHADA', `Transporte: ${transporte}${rastreio?' · Rastreio: '+rastreio:''}`);
  } else if (acao === 'RECEBER') {
    if (!data_recebimento || !hora_recebimento) return res.status(400).json({ erro: 'Data e hora obrigatórios' });
    updates.status = 'RECEBIDA';
    updates.data_recebimento = data_recebimento;
    updates.hora_recebimento = hora_recebimento;
    addEvento('RECEBIDA', `Recebido em ${data_recebimento} às ${hora_recebimento}`);
  } else if (acao === 'FINALIZAR') {
    updates.status = 'FINALIZADO';
    addEvento('FINALIZADO');
  } else if (acao === 'CANCELAR') {
    updates.status = 'CANCELADA';
    addEvento('CANCELADA');
  } else if (acao === 'COMPRA') {
    updates.status = 'COMPRA_PENDENTE';
    addEvento('COMPRA_PENDENTE');
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE movimentacoes SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.json({ ok: true, status: updates.status });
});

router.delete('/movimentacoes/:id', autenticar, isAdmin, (req, res) => {
  db.prepare('DELETE FROM movimentacoes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
//  ORÇAMENTOS
// ============================================================
router.get('/orcamentos', autenticar, (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM orcamentos WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (q) { sql += ' AND (numero LIKE ? OR cliente LIKE ? OR equip_serie LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  const lista = db.prepare(sql).all(...params).map(o => ({ ...o, itens: JSON.parse(o.itens||'[]') }));
  res.json(lista);
});

router.post('/orcamentos', autenticar, (req, res) => {
  const o = req.body;
  if (!o.numero) return res.status(400).json({ erro: 'Número obrigatório' });
  const id = uid();
  const total = (o.itens||[]).reduce((s, it) => s + (it.qtd||0) * (parseFloat(it.valor)||0), 0);
  db.prepare(`INSERT INTO orcamentos(id,numero,status,cliente,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,obs_condicoes,condicoes,assinatura,total,itens,solicitacao_id,created_at,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, o.numero, o.status||'ABERTO', o.cliente||'', o.equip_serie||'', o.equip_nome||'',
         o.os||'', o.data||'', o.obs||'', o.validade||'30 dias', o.pagamento||'30 dias',
         o.entrega||'A combinar', o.frete||'FOB', o.obs_condicoes||'', o.condicoes||'',
         o.assinatura||req.user.nome, total, JSON.stringify(o.itens||[]), o.solicitacao_id||'', now(), req.user.id);
  res.status(201).json({ id });
});

router.put('/orcamentos/:id', autenticar, (req, res) => {
  const o = req.body;
  const total = (o.itens||[]).reduce((s, it) => s + (it.qtd||0) * (parseFloat(it.valor)||0), 0);
  db.prepare(`UPDATE orcamentos SET numero=?,status=?,cliente=?,equip_serie=?,equip_nome=?,os=?,data=?,obs=?,
    validade=?,pagamento=?,entrega=?,frete=?,obs_condicoes=?,condicoes=?,assinatura=?,total=?,itens=? WHERE id=?`)
    .run(o.numero, o.status||'ABERTO', o.cliente||'', o.equip_serie||'', o.equip_nome||'',
         o.os||'', o.data||'', o.obs||'', o.validade||'30 dias', o.pagamento||'30 dias',
         o.entrega||'A combinar', o.frete||'FOB', o.obs_condicoes||'', o.condicoes||'',
         o.assinatura||'', total, JSON.stringify(o.itens||[]), req.params.id);
  res.json({ ok: true });
});

router.put('/orcamentos/:id/status', autenticar, isAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orcamentos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

router.delete('/orcamentos/:id', autenticar, isAdmin, (req, res) => {
  db.prepare('DELETE FROM orcamentos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
//  PEDIDOS DE COMPRA
// ============================================================
router.get('/pedidos', autenticar, (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM pedidos WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  const lista = db.prepare(sql).all(...params).map(p => ({ ...p, itens: JSON.parse(p.itens||'[]') }));
  res.json(lista);
});

router.post('/pedidos', autenticar, (req, res) => {
  const p = req.body;
  if (!p.numero) return res.status(400).json({ erro: 'Número obrigatório' });
  const id = uid();
  db.prepare('INSERT INTO pedidos(id,numero,status,obs,itens,created_at,created_by) VALUES (?,?,?,?,?,?,?)')
    .run(id, p.numero, p.status||'ABERTO', p.obs||'', JSON.stringify(p.itens||[]), now(), req.user.id);
  res.status(201).json({ id });
});

router.put('/pedidos/:id/status', autenticar, isAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// ============================================================
//  DOADORAS
// ============================================================
router.get('/doadoras', autenticar, (req, res) => {
  res.json(db.prepare('SELECT * FROM doadoras ORDER BY modelo').all());
});

router.post('/doadoras', autenticar, isAdmin, (req, res) => {
  const d = req.body;
  const id = uid();
  db.prepare('INSERT INTO doadoras(id,modelo,serie,marca,linha,classificacao,fator,obs) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, d.modelo||'', d.serie||'', d.marca||'', d.linha||'', d.classificacao||'USO', d.fator||1, d.obs||'');
  res.status(201).json({ id });
});

router.put('/doadoras/:id', autenticar, isAdmin, (req, res) => {
  const d = req.body;
  db.prepare('UPDATE doadoras SET modelo=?,serie=?,marca=?,linha=?,classificacao=?,fator=?,obs=? WHERE id=?')
    .run(d.modelo||'', d.serie||'', d.marca||'', d.linha||'', d.classificacao||'USO', d.fator||1, d.obs||'', req.params.id);
  res.json({ ok: true });
});

router.delete('/doadoras/:id', autenticar, isAdmin, (req, res) => {
  db.prepare('DELETE FROM doadoras WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
//  RETIRADAS
// ============================================================
router.get('/retiradas', autenticar, (req, res) => {
  const { doad_id } = req.query;
  let sql = 'SELECT * FROM retiradas WHERE 1=1';
  const params = [];
  if (doad_id) { sql += ' AND doad_id = ?'; params.push(doad_id); }
  sql += ' ORDER BY data DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/retiradas', autenticar, (req, res) => {
  const r = req.body;
  const id = uid();
  const custoTotal = (r.custo_unit||0) * (r.qtd||1);
  db.prepare(`INSERT INTO retiradas(id,doad_id,doad_modelo,doad_serie,doad_class,peca_id,peca_codigo,peca_nome,qtd,custo_unit,custo_total,tecnico,obs,data)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, r.doad_id||'', r.doad_modelo||'', r.doad_serie||'', r.doad_class||'',
         r.peca_id||'', r.peca_codigo||'', r.peca_nome||'', r.qtd||1,
         r.custo_unit||0, custoTotal, r.tecnico||req.user.nome, r.obs||'', now());
  // Incrementa estoque
  if (r.peca_id) {
    db.prepare('INSERT INTO estoque(peca_id,quantidade,updated_at) VALUES (?,?,?) ON CONFLICT(peca_id) DO UPDATE SET quantidade=quantidade+?, updated_at=?')
      .run(r.peca_id, r.qtd||1, now(), r.qtd||1, now());
  }
  res.status(201).json({ id });
});

// ============================================================
//  CONFIGURAÇÕES
// ============================================================
router.get('/config/:chave', autenticar, (req, res) => {
  const cfg = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(req.params.chave);
  if (!cfg) return res.status(404).json({ erro: 'Configuração não encontrada' });
  res.json(JSON.parse(cfg.valor));
});

router.put('/config/:chave', autenticar, isAdmin, (req, res) => {
  db.prepare('INSERT OR REPLACE INTO configuracoes(chave, valor) VALUES (?,?)').run(req.params.chave, JSON.stringify(req.body));
  res.json({ ok: true });
});

// ============================================================
//  DASHBOARD
// ============================================================
router.get('/dashboard', autenticar, (req, res) => {
  const totalPecas   = db.prepare('SELECT COUNT(*) as n FROM pecas').get().n;
  const totalEquip   = db.prepare('SELECT COUNT(*) as n FROM equipamentos').get().n;
  const movAbertos   = db.prepare("SELECT COUNT(*) as n FROM movimentacoes WHERE status NOT IN ('FINALIZADO','CANCELADA')").get().n;
  const compPendente = db.prepare("SELECT COUNT(*) as n FROM movimentacoes WHERE status = 'COMPRA_PENDENTE'").get().n;
  const orcAbertos   = db.prepare("SELECT COUNT(*) as n FROM orcamentos WHERE status = 'ABERTO'").get().n;
  const pedAbertos   = db.prepare("SELECT COUNT(*) as n FROM pedidos WHERE status = 'ABERTO'").get().n;
  const estoqueMin   = db.prepare(`
    SELECT COUNT(*) as n FROM estoque e JOIN pecas p ON p.id = e.peca_id
    WHERE p.minimo > 0 AND e.quantidade < p.minimo
  `).get().n;
  const ultMovs = db.prepare("SELECT * FROM movimentacoes ORDER BY created_at DESC LIMIT 10").all()
    .map(m => ({ ...m, eventos: JSON.parse(m.eventos||'[]') }));
  res.json({ totalPecas, totalEquip, movAbertos, compPendente, orcAbertos, pedAbertos, estoqueMin, ultMovs });
});

// ============================================================
//  BACKUP / RESTORE
// ============================================================
router.get('/backup', autenticar, isAdmin, (req, res) => {
  const backup = {
    _version: '2.0',
    _exportedAt: new Date().toISOString(),
    pecas:         db.prepare('SELECT * FROM pecas').all(),
    equipamentos:  db.prepare('SELECT * FROM equipamentos').all().map(e => ({ ...e, campos: JSON.parse(e.campos||'{}') })),
    estoque:       db.prepare('SELECT * FROM estoque').all(),
    depositos:     db.prepare('SELECT * FROM depositos').all(),
    movimentacoes: db.prepare('SELECT * FROM movimentacoes').all().map(m => ({ ...m, eventos: JSON.parse(m.eventos||'[]') })),
    orcamentos:    db.prepare('SELECT * FROM orcamentos').all().map(o => ({ ...o, itens: JSON.parse(o.itens||'[]') })),
    doadoras:      db.prepare('SELECT * FROM doadoras').all(),
    retiradas:     db.prepare('SELECT * FROM retiradas').all(),
    pedidos:       db.prepare('SELECT * FROM pedidos').all().map(p => ({ ...p, itens: JSON.parse(p.itens||'[]') })),
    config_orcamento: JSON.parse(db.prepare("SELECT valor FROM configuracoes WHERE chave='config_orcamento'").get()?.valor||'{}'),
    config_compras:   JSON.parse(db.prepare("SELECT valor FROM configuracoes WHERE chave='config_compras'").get()?.valor||'{}'),
  };
  res.setHeader('Content-Disposition', `attachment; filename="partforge_backup_${new Date().toISOString().slice(0,10)}.json"`);
  res.json(backup);
});

router.post('/restore', autenticar, isAdmin, (req, res) => {
  const snap = req.body;
  const restore = db.transaction(() => {
    // Restore pecas
    if (snap.pecas?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const p of snap.pecas) stmt.run(p.id||uid(),p.codigo||'',p.nome||'',p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,p.imagem||'',p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0);
    }
    // Restore equipamentos
    if (snap.equipamentos?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos) VALUES (?,?,?,?,?,?,?,?,?,?)`);
      for (const e of snap.equipamentos) stmt.run(e.id||uid(),e.modelo||'',e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',JSON.stringify(e.campos||{}));
    }
    // Restore estoque
    if (snap.estoque?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO estoque(peca_id,quantidade,updated_at) VALUES (?,?,?)`);
      for (const e of snap.estoque) stmt.run(e.peca_id||e.pecaId,e.quantidade||0,now());
    }
    // Restore movimentacoes
    if (snap.movimentacoes?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,obs,eventos,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const m of snap.movimentacoes) stmt.run(m.id||uid(),m.seq_num||m.seqNum||0,m.status||'SOLICITADA',m.peca_id||m.pecaId||'',m.peca_codigo||m.pecaCodigo||'',m.peca_nome||m.pecaNome||'',m.peca_unidade||m.pecaUnidade||'UN',m.peca_fonte||m.pecaFonte||'',m.peca_custo||m.pecaCusto||0,m.qtd||1,m.equip_id||m.equipId||'',m.equip_serie||m.equipSerie||'',m.equip_cliente||m.equipCliente||'',m.equip_modelo||m.equipModelo||'',m.tecnico||'',m.tem_estoque||m.temEstoque?1:0,m.tipo_alocacao||m.tipoAlocacao||'',m.obs||'',JSON.stringify(m.eventos||[]),m.created_at||m.createdAt||now(),'restore');
    }
    // Restore orcamentos
    if (snap.orcamentos?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO orcamentos(id,numero,status,cliente,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,condicoes,assinatura,total,itens,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const o of snap.orcamentos) stmt.run(o.id||uid(),o.numero||'',o.status||'ABERTO',o.cliente||'',o.equip_serie||o.equipSerie||'',o.equip_nome||o.equipNome||'',o.os||'',o.data||'',o.obs||'',o.validade||'30 dias',o.pagamento||o.formaPagamento||'30 dias',o.entrega||o.prazoEntrega||'A combinar',o.frete||'FOB',o.condicoes||'',o.assinatura||'',o.total||0,JSON.stringify(o.itens||[]),o.created_at||now());
    }
    // Restore pedidos
    if (snap.pedidos?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO pedidos(id,numero,status,obs,itens,created_at) VALUES (?,?,?,?,?,?)`);
      for (const p of snap.pedidos) stmt.run(p.id||uid(),p.numero||'',p.status||'ABERTO',p.obs||'',JSON.stringify(p.itens||[]),p.created_at||now());
    }
    // Restore doadoras
    if (snap.doadoras?.length) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO doadoras(id,modelo,serie,marca,linha,classificacao,fator,obs) VALUES (?,?,?,?,?,?,?,?)`);
      for (const d of snap.doadoras) stmt.run(d.id||uid(),d.modelo||'',d.serie||'',d.marca||'',d.linha||'',d.classificacao||'USO',d.fator||1,d.obs||'');
    }
    // Configs
    if (snap.config_orcamento) db.prepare("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES ('config_orcamento',?)").run(JSON.stringify(snap.config_orcamento));
    if (snap.config_compras)   db.prepare("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES ('config_compras',?)").run(JSON.stringify(snap.config_compras));
  });
  restore();
  res.json({ ok: true });
});

module.exports = router;
