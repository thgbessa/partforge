const express = require('express');
const router  = express.Router();
const db      = require('./database');
const bcrypt  = require('bcryptjs');
const { gerarToken, autenticar, isAdmin } = require('./auth');

function uid() { return db.uid(); }
function now() { return db.now(); }
function J(v)  { return JSON.stringify(v); }
function P(v)  { try { return JSON.parse(v||'null') || []; } catch(e) { return []; } }

// ── AUTH ────────────────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });
  const user = db.get('SELECT * FROM usuarios WHERE email = ? AND ativo = 1', [email.toLowerCase().trim()]);
  if (!user) return res.status(401).json({ erro: 'E-mail não encontrado' });
  if (!bcrypt.compareSync(senha, user.senha_hash)) return res.status(401).json({ erro: 'Senha incorreta' });
  const token = gerarToken(user);
  res.json({ token, usuario: { id:user.id, nome:user.nome, cargo:user.cargo, email:user.email } });
});

router.get('/auth/me', autenticar, (req, res) => res.json({ usuario: req.user }));

// ── USUARIOS ─────────────────────────────────────────────────
router.get('/usuarios', autenticar, isAdmin, (req, res) => {
  res.json(db.query('SELECT id,nome,cargo,tel,email,ativo,created_at FROM usuarios ORDER BY nome'));
});

router.post('/usuarios', autenticar, isAdmin, (req, res) => {
  const { nome, cargo, tel, email, senha } = req.body;
  if (!nome||!email||!senha) return res.status(400).json({ erro: 'Nome, email e senha obrigatórios' });
  if (senha.length < 6) return res.status(400).json({ erro: 'Senha mínimo 6 caracteres' });
  if (db.get('SELECT id FROM usuarios WHERE email=?',[email.toLowerCase()]))
    return res.status(409).json({ erro: 'E-mail já cadastrado' });
  const id = uid();
  db.run('INSERT INTO usuarios(id,nome,cargo,tel,email,senha_hash,created_at) VALUES(?,?,?,?,?,?,?)',
    [id, nome, cargo||'Tecnico', tel||'', email.toLowerCase(), bcrypt.hashSync(senha,10), now()]);
  res.status(201).json({ id });
});

router.put('/usuarios/:id', autenticar, isAdmin, (req, res) => {
  const { nome, cargo, tel, email, senha } = req.body;
  const user = db.get('SELECT * FROM usuarios WHERE id=?',[req.params.id]);
  if (!user) return res.status(404).json({ erro: 'Não encontrado' });
  let hash = user.senha_hash;
  if (senha) { if (senha.length<6) return res.status(400).json({erro:'Senha mínimo 6 chars'}); hash=bcrypt.hashSync(senha,10); }
  db.run('UPDATE usuarios SET nome=?,cargo=?,tel=?,email=?,senha_hash=? WHERE id=?',
    [nome||user.nome, cargo||user.cargo, tel??user.tel, (email||user.email).toLowerCase(), hash, req.params.id]);
  res.json({ ok:true });
});

router.delete('/usuarios/:id', autenticar, isAdmin, (req, res) => {
  if (req.params.id===req.user.id) return res.status(400).json({erro:'Não pode excluir própria conta'});
  db.run('UPDATE usuarios SET ativo=0 WHERE id=?',[req.params.id]);
  res.json({ok:true});
});

// ── PEÇAS ─────────────────────────────────────────────────────
router.get('/pecas', autenticar, (req, res) => {
  const { q, grupo, fonte } = req.query;
  let sql = 'SELECT * FROM pecas WHERE 1=1'; const p=[];
  if (q)     { sql+=' AND (nome LIKE ? OR codigo LIKE ?)'; p.push(`%${q}%`,`%${q}%`); }
  if (grupo) { sql+=' AND grupo=?'; p.push(grupo); }
  if (fonte) { sql+=' AND fonte=?'; p.push(fonte); }
  res.json(db.query(sql+' ORDER BY nome', p));
});

router.post('/pecas', autenticar, isAdmin, (req, res) => {
  const p=req.body; if (!p.nome) return res.status(400).json({erro:'Nome obrigatório'});
  const id=p.id||uid();
  db.run(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,p.codigo||'',p.nome,p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,
     p.imagem||'',p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,now()]);
  res.status(201).json({id});
});

router.put('/pecas/:id', autenticar, isAdmin, (req, res) => {
  const p=req.body;
  db.run(`UPDATE pecas SET codigo=?,nome=?,unidade=?,grupo=?,fonte=?,linha=?,minimo=?,taxa=?,dolar=?,markup=?,custo=?,valor_venda=? WHERE id=?`,
    [p.codigo||'',p.nome,p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,
     p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,req.params.id]);
  res.json({ok:true});
});

router.delete('/pecas/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM pecas WHERE id=?',[req.params.id]);
  db.run('DELETE FROM estoque WHERE peca_id=?',[req.params.id]);
  res.json({ok:true});
});

router.post('/pecas/importar', autenticar, isAdmin, (req, res) => {
  const { pecas } = req.body;
  if (!Array.isArray(pecas)) return res.status(400).json({erro:'Array obrigatório'});
  for (const p of pecas) {
    db.run(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,taxa,dolar,markup,custo,valor_venda,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id||uid(),p.codigo||'',p.nome||'',p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',
       p.minimo||0,p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,now()]);
  }
  res.json({importadas:pecas.length});
});

// ── EQUIPAMENTOS ──────────────────────────────────────────────
router.get('/equipamentos', autenticar, (req, res) => {
  const {q}=req.query; let sql='SELECT * FROM equipamentos WHERE 1=1'; const p=[];
  if (q) { sql+=' AND (modelo LIKE ? OR serie LIKE ? OR cliente LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  res.json(db.query(sql+' ORDER BY modelo,cliente',p).map(e=>({...e,campos:P(e.campos)||{}})));
});

router.post('/equipamentos', autenticar, isAdmin, (req, res) => {
  const e=req.body; if (!e.modelo) return res.status(400).json({erro:'Modelo obrigatório'});
  const id=e.id||uid();
  db.run(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id,e.modelo,e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),now()]);
  res.status(201).json({id});
});

router.put('/equipamentos/:id', autenticar, isAdmin, (req, res) => {
  const e=req.body;
  db.run(`UPDATE equipamentos SET modelo=?,marca=?,serie=?,linha=?,cliente=?,local=?,contrato=?,obs=?,campos=? WHERE id=?`,
    [e.modelo,e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),req.params.id]);
  res.json({ok:true});
});

router.delete('/equipamentos/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM equipamentos WHERE id=?',[req.params.id]); res.json({ok:true});
});

router.post('/equipamentos/importar', autenticar, isAdmin, (req, res) => {
  const {equipamentos}=req.body; if (!Array.isArray(equipamentos)) return res.status(400).json({erro:'Array obrigatório'});
  for (const e of equipamentos)
    db.run(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [e.id||uid(),e.modelo||'',e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),now()]);
  res.json({importados:equipamentos.length});
});

// ── ESTOQUE ───────────────────────────────────────────────────
router.get('/estoque', autenticar, (req, res) => {
  const estoque  = db.query(`SELECT e.*,p.nome as peca_nome,p.codigo as peca_codigo,p.unidade,p.minimo,p.grupo FROM estoque e JOIN pecas p ON p.id=e.peca_id ORDER BY p.nome`);
  const depositos = db.query('SELECT * FROM depositos');
  res.json({ estoque, depositos });
});

router.put('/estoque/:pecaId', autenticar, isAdmin, (req, res) => {
  const {quantidade}=req.body;
  db.run('INSERT OR REPLACE INTO estoque(peca_id,quantidade,updated_at) VALUES(?,?,?)',[req.params.pecaId,quantidade,now()]);
  res.json({ok:true});
});

// ── MOVIMENTAÇÕES ─────────────────────────────────────────────
router.get('/movimentacoes', autenticar, (req, res) => {
  const {status,q}=req.query;
  const admin=['Gerente','Back Office','Assessor'].includes(req.user.cargo);
  let sql='SELECT * FROM movimentacoes WHERE 1=1'; const p=[];
  if (!admin) { sql+=' AND tecnico=?'; p.push(req.user.nome); }
  if (status) { sql+=' AND status=?'; p.push(status); }
  if (q) { sql+=' AND (peca_nome LIKE ? OR peca_codigo LIKE ? OR equip_serie LIKE ? OR tecnico LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
  const lista = db.query(sql+' ORDER BY created_at DESC',p).map(m=>({...m,eventos:P(m.eventos)}));
  res.json(lista);
});

router.post('/movimentacoes', autenticar, (req, res) => {
  const m=req.body;
  const cfg = db.get("SELECT valor FROM configuracoes WHERE chave='seq_counter'");
  const seq  = parseInt(cfg?.valor||'0') + 1;
  db.run("UPDATE configuracoes SET valor=? WHERE chave='seq_counter'",[String(seq)]);
  const id=uid();
  const eventos=J([{status:'SOLICITADA',data:now(),obs:'',user:req.user.nome}]);
  db.run(`INSERT INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,
    qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,valor_por_orc,obs,eventos,created_at,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,seq,'SOLICITADA',m.peca_id||'',m.peca_codigo||'',m.peca_nome||'',m.peca_unidade||'UN',
     m.peca_fonte||'',m.peca_custo||0,m.qtd||1,m.equip_id||'',m.equip_serie||'',m.equip_cliente||'',
     m.equip_modelo||'',m.tecnico||req.user.nome,m.tem_estoque?1:0,m.tipo_alocacao||'',
     m.valor_por_orc?1:0,m.obs||'',eventos,now(),req.user.id]);
  res.status(201).json({id,seq_num:seq});
});

router.put('/movimentacoes/:id/acao', autenticar, (req, res) => {
  const {acao,obs,transporte,rastreio,previsao_entrega,data_recebimento,hora_recebimento}=req.body;
  const sol=db.get('SELECT * FROM movimentacoes WHERE id=?',[req.params.id]);
  if (!sol) return res.status(404).json({erro:'Não encontrada'});
  const eventos=P(sol.eventos);
  const addEv=(st,extra='')=>eventos.push({status:st,data:now(),obs:[obs||'',extra].filter(Boolean).join(' | '),user:req.user.nome});
  const upd={eventos:J(eventos)};

  if (acao==='ENVIAR') {
    if (!sol.tem_estoque) { upd.status='COMPRA_PENDENTE'; addEv('COMPRA_PENDENTE'); }
    else {
      db.run('UPDATE estoque SET quantidade=MAX(0,quantidade-?),updated_at=? WHERE peca_id=?',[sol.qtd,now(),sol.peca_id]);
      upd.status='ENVIADA'; addEv('ENVIADA');
    }
  } else if (acao==='DESPACHAR') {
    if (!transporte) return res.status(400).json({erro:'Transporte obrigatório'});
    upd.status='DESPACHADA'; upd.transportadora=transporte; upd.rastreio=rastreio||''; upd.previsao_entrega=previsao_entrega||'';
    addEv('DESPACHADA',`Transporte: ${transporte}${rastreio?' · '+rastreio:''}`);
  } else if (acao==='RECEBER') {
    if (!data_recebimento||!hora_recebimento) return res.status(400).json({erro:'Data e hora obrigatórios'});
    upd.status='RECEBIDA'; upd.data_recebimento=data_recebimento; upd.hora_recebimento=hora_recebimento;
    addEv('RECEBIDA',`Recebido em ${data_recebimento} às ${hora_recebimento}`);
  } else if (acao==='FINALIZAR') { upd.status='FINALIZADO'; addEv('FINALIZADO');
  } else if (acao==='CANCELAR') { upd.status='CANCELADA'; addEv('CANCELADA');
  } else if (acao==='COMPRA')   { upd.status='COMPRA_PENDENTE'; addEv('COMPRA_PENDENTE'); }

  const sets=Object.keys(upd).map(k=>`${k}=?`).join(',');
  db.run(`UPDATE movimentacoes SET ${sets} WHERE id=?`,[...Object.values(upd),req.params.id]);
  res.json({ok:true,status:upd.status});
});

router.delete('/movimentacoes/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM movimentacoes WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ── ORÇAMENTOS ────────────────────────────────────────────────
router.get('/orcamentos', autenticar, (req, res) => {
  const {status,q}=req.query; let sql='SELECT * FROM orcamentos WHERE 1=1'; const p=[];
  if (status) { sql+=' AND status=?'; p.push(status); }
  if (q) { sql+=' AND (numero LIKE ? OR cliente LIKE ? OR equip_serie LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  res.json(db.query(sql+' ORDER BY created_at DESC',p).map(o=>({...o,itens:P(o.itens)})));
});

router.post('/orcamentos', autenticar, (req, res) => {
  const o=req.body; if (!o.numero) return res.status(400).json({erro:'Número obrigatório'});
  const id=uid();
  const total=(o.itens||[]).reduce((s,it)=>s+(it.qtd||0)*(parseFloat(it.valor)||0),0);
  db.run(`INSERT INTO orcamentos(id,numero,status,cliente,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,obs_condicoes,condicoes,assinatura,total,itens,solicitacao_id,created_at,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,o.numero,o.status||'ABERTO',o.cliente||'',o.equip_serie||'',o.equip_nome||'',o.os||'',
     o.data||'',o.obs||'',o.validade||'30 dias',o.pagamento||'30 dias',o.entrega||'A combinar',
     o.frete||'FOB',o.obs_condicoes||'',o.condicoes||'',o.assinatura||req.user.nome,
     total,J(o.itens||[]),o.solicitacao_id||'',now(),req.user.id]);
  res.status(201).json({id});
});

router.put('/orcamentos/:id', autenticar, (req, res) => {
  const o=req.body;
  const total=(o.itens||[]).reduce((s,it)=>s+(it.qtd||0)*(parseFloat(it.valor)||0),0);
  db.run(`UPDATE orcamentos SET numero=?,status=?,cliente=?,equip_serie=?,equip_nome=?,os=?,data=?,obs=?,
    validade=?,pagamento=?,entrega=?,frete=?,obs_condicoes=?,condicoes=?,assinatura=?,total=?,itens=? WHERE id=?`,
    [o.numero,o.status||'ABERTO',o.cliente||'',o.equip_serie||'',o.equip_nome||'',o.os||'',o.data||'',
     o.obs||'',o.validade||'30 dias',o.pagamento||'30 dias',o.entrega||'A combinar',o.frete||'FOB',
     o.obs_condicoes||'',o.condicoes||'',o.assinatura||'',total,J(o.itens||[]),req.params.id]);
  res.json({ok:true});
});

router.put('/orcamentos/:id/status', autenticar, isAdmin, (req, res) => {
  db.run('UPDATE orcamentos SET status=? WHERE id=?',[req.body.status,req.params.id]); res.json({ok:true});
});

router.delete('/orcamentos/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM orcamentos WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ── PEDIDOS ───────────────────────────────────────────────────
router.get('/pedidos', autenticar, (req, res) => {
  const {status}=req.query; let sql='SELECT * FROM pedidos WHERE 1=1'; const p=[];
  if (status) { sql+=' AND status=?'; p.push(status); }
  res.json(db.query(sql+' ORDER BY created_at DESC',p).map(p=>({...p,itens:P(p.itens)})));
});

router.post('/pedidos', autenticar, (req, res) => {
  const p=req.body; if (!p.numero) return res.status(400).json({erro:'Número obrigatório'});
  const id=uid();
  db.run('INSERT INTO pedidos(id,numero,status,obs,itens,created_at,created_by) VALUES(?,?,?,?,?,?,?)',
    [id,p.numero,p.status||'ABERTO',p.obs||'',J(p.itens||[]),now(),req.user.id]);
  res.status(201).json({id});
});

router.put('/pedidos/:id/status', autenticar, isAdmin, (req, res) => {
  db.run('UPDATE pedidos SET status=? WHERE id=?',[req.body.status,req.params.id]); res.json({ok:true});
});

// ── DOADORAS ──────────────────────────────────────────────────
router.get('/doadoras', autenticar, (req, res) => {
  res.json(db.query('SELECT * FROM doadoras ORDER BY modelo'));
});

router.post('/doadoras', autenticar, isAdmin, (req, res) => {
  const d=req.body; const id=uid();
  db.run('INSERT INTO doadoras(id,modelo,serie,marca,linha,classificacao,fator,obs,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    [id,d.modelo||'',d.serie||'',d.marca||'',d.linha||'',d.classificacao||'USO',d.fator||1,d.obs||'',now()]);
  res.status(201).json({id});
});

router.put('/doadoras/:id', autenticar, isAdmin, (req, res) => {
  const d=req.body;
  db.run('UPDATE doadoras SET modelo=?,serie=?,marca=?,linha=?,classificacao=?,fator=?,obs=? WHERE id=?',
    [d.modelo||'',d.serie||'',d.marca||'',d.linha||'',d.classificacao||'USO',d.fator||1,d.obs||'',req.params.id]);
  res.json({ok:true});
});

router.delete('/doadoras/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM doadoras WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ── RETIRADAS ─────────────────────────────────────────────────
router.get('/retiradas', autenticar, (req, res) => {
  const {doad_id}=req.query; let sql='SELECT * FROM retiradas WHERE 1=1'; const p=[];
  if (doad_id) { sql+=' AND doad_id=?'; p.push(doad_id); }
  res.json(db.query(sql+' ORDER BY data DESC',p));
});

router.post('/retiradas', autenticar, (req, res) => {
  const r=req.body; const id=uid();
  const custoTotal=(r.custo_unit||0)*(r.qtd||1);
  db.run(`INSERT INTO retiradas(id,doad_id,doad_modelo,doad_serie,doad_class,peca_id,peca_codigo,peca_nome,qtd,custo_unit,custo_total,tecnico,obs,data)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,r.doad_id||'',r.doad_modelo||'',r.doad_serie||'',r.doad_class||'',r.peca_id||'',
     r.peca_codigo||'',r.peca_nome||'',r.qtd||1,r.custo_unit||0,custoTotal,r.tecnico||req.user.nome,r.obs||'',now()]);
  if (r.peca_id) {
    const ex=db.get('SELECT quantidade FROM estoque WHERE peca_id=?',[r.peca_id]);
    if (ex) db.run('UPDATE estoque SET quantidade=quantidade+?,updated_at=? WHERE peca_id=?',[r.qtd||1,now(),r.peca_id]);
    else     db.run('INSERT INTO estoque(peca_id,quantidade,updated_at) VALUES(?,?,?)',[r.peca_id,r.qtd||1,now()]);
  }
  res.status(201).json({id});
});

// ── CONFIGURAÇÕES ─────────────────────────────────────────────
router.get('/config/:chave', autenticar, (req, res) => {
  const cfg=db.get('SELECT valor FROM configuracoes WHERE chave=?',[req.params.chave]);
  if (!cfg) return res.status(404).json({erro:'Não encontrada'});
  res.json(JSON.parse(cfg.valor));
});

router.put('/config/:chave', autenticar, isAdmin, (req, res) => {
  db.run('INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES(?,?)',[req.params.chave,J(req.body)]);
  res.json({ok:true});
});

// ── DASHBOARD ─────────────────────────────────────────────────
router.get('/dashboard', autenticar, (req, res) => {
  const totalPecas   = db.get('SELECT COUNT(*) as n FROM pecas')?.n || 0;
  const totalEquip   = db.get('SELECT COUNT(*) as n FROM equipamentos')?.n || 0;
  const movAbertos   = db.get("SELECT COUNT(*) as n FROM movimentacoes WHERE status NOT IN ('FINALIZADO','CANCELADA')")?.n || 0;
  const compPendente = db.get("SELECT COUNT(*) as n FROM movimentacoes WHERE status='COMPRA_PENDENTE'")?.n || 0;
  const orcAbertos   = db.get("SELECT COUNT(*) as n FROM orcamentos WHERE status='ABERTO'")?.n || 0;
  const pedAbertos   = db.get("SELECT COUNT(*) as n FROM pedidos WHERE status='ABERTO'")?.n || 0;
  const estoqueMin   = db.get(`SELECT COUNT(*) as n FROM estoque e JOIN pecas p ON p.id=e.peca_id WHERE p.minimo>0 AND e.quantidade<p.minimo`)?.n || 0;
  const ultMovs      = db.query("SELECT * FROM movimentacoes ORDER BY created_at DESC LIMIT 10").map(m=>({...m,eventos:P(m.eventos)}));
  res.json({totalPecas,totalEquip,movAbertos,compPendente,orcAbertos,pedAbertos,estoqueMin,ultMovs});
});

// ── BACKUP / RESTORE ──────────────────────────────────────────
router.get('/backup', autenticar, isAdmin, (req, res) => {
  const backup = {
    _version: '2.0', _exportedAt: new Date().toISOString(),
    pecas:         db.query('SELECT * FROM pecas'),
    equipamentos:  db.query('SELECT * FROM equipamentos').map(e=>({...e,campos:P(e.campos)||{}})),
    estoque:       db.query('SELECT * FROM estoque'),
    depositos:     db.query('SELECT * FROM depositos'),
    movimentacoes: db.query('SELECT * FROM movimentacoes').map(m=>({...m,eventos:P(m.eventos)})),
    orcamentos:    db.query('SELECT * FROM orcamentos').map(o=>({...o,itens:P(o.itens)})),
    doadoras:      db.query('SELECT * FROM doadoras'),
    retiradas:     db.query('SELECT * FROM retiradas'),
    pedidos:       db.query('SELECT * FROM pedidos').map(p=>({...p,itens:P(p.itens)})),
    config_orcamento: JSON.parse(db.get("SELECT valor FROM configuracoes WHERE chave='config_orcamento'")?.valor||'{}'),
    config_compras:   JSON.parse(db.get("SELECT valor FROM configuracoes WHERE chave='config_compras'")?.valor||'{}'),
  };
  res.setHeader('Content-Disposition',`attachment; filename="partforge_backup_${new Date().toISOString().slice(0,10)}.json"`);
  res.json(backup);
});

router.post('/restore', autenticar, isAdmin, (req, res) => {
  const s=req.body;
  try {
    if (s.pecas?.length) for (const p of s.pecas)
      db.run(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.id||uid(),p.codigo||'',p.nome||'',p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,p.imagem||'',p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,p.created_at||now()]);

    if (s.equipamentos?.length) for (const e of s.equipamentos)
      db.run(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [e.id||uid(),e.modelo||'',e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),e.created_at||now()]);

    if (s.estoque?.length) for (const e of s.estoque)
      db.run(`INSERT OR REPLACE INTO estoque(peca_id,quantidade,updated_at) VALUES(?,?,?)`,
        [e.peca_id||e.pecaId,e.quantidade||0,now()]);

    if (s.movimentacoes?.length) for (const m of s.movimentacoes)
      db.run(`INSERT OR REPLACE INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,obs,eventos,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [m.id||uid(),m.seq_num||m.seqNum||0,m.status||'SOLICITADA',m.peca_id||m.pecaId||'',m.peca_codigo||m.pecaCodigo||'',m.peca_nome||m.pecaNome||'',m.peca_unidade||m.pecaUnidade||'UN',m.peca_fonte||m.pecaFonte||'',m.peca_custo||m.pecaCusto||0,m.qtd||1,m.equip_id||m.equipId||'',m.equip_serie||m.equipSerie||'',m.equip_cliente||m.equipCliente||'',m.equip_modelo||m.equipModelo||'',m.tecnico||'',m.tem_estoque||m.temEstoque?1:0,m.tipo_alocacao||m.tipoAlocacao||'',m.obs||'',J(m.eventos||[]),m.created_at||m.createdAt||now(),'restore']);

    if (s.orcamentos?.length) for (const o of s.orcamentos)
      db.run(`INSERT OR REPLACE INTO orcamentos(id,numero,status,cliente,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,condicoes,assinatura,total,itens,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [o.id||uid(),o.numero||'',o.status||'ABERTO',o.cliente||'',o.equip_serie||o.equipSerie||'',o.equip_nome||o.equipNome||'',o.os||'',o.data||'',o.obs||'',o.validade||'30 dias',o.pagamento||o.formaPagamento||'30 dias',o.entrega||o.prazoEntrega||'A combinar',o.frete||'FOB',o.condicoes||'',o.assinatura||'',o.total||0,J(o.itens||[]),o.created_at||now()]);

    if (s.pedidos?.length) for (const p of s.pedidos)
      db.run(`INSERT OR REPLACE INTO pedidos(id,numero,status,obs,itens,created_at) VALUES(?,?,?,?,?,?)`,
        [p.id||uid(),p.numero||'',p.status||'ABERTO',p.obs||'',J(p.itens||[]),p.created_at||now()]);

    if (s.doadoras?.length) for (const d of s.doadoras)
      db.run(`INSERT OR REPLACE INTO doadoras(id,modelo,serie,marca,linha,classificacao,fator,obs,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        [d.id||uid(),d.modelo||'',d.serie||'',d.marca||'',d.linha||'',d.classificacao||'USO',d.fator||1,d.obs||'',d.created_at||now()]);

    if (s.config_orcamento) db.run("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES('config_orcamento',?)",[J(s.config_orcamento)]);
    if (s.config_compras)   db.run("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES('config_compras',?)",[J(s.config_compras)]);

    res.json({ok:true});
  } catch(e) {
    console.error('Restore error:', e);
    res.status(500).json({erro:'Erro no restore: '+e.message});
  }
});

// ── HEALTH ────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({status:'ok',time:new Date().toISOString()}));

module.exports = router;
