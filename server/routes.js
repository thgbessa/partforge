const express = require('express'); // v2
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
  db.run(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda,preco_usd,localizacao,localizacao_bin,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,p.codigo||'',p.nome,p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,
     p.imagem||'',p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,p.preco_usd||0,
     p.localizacao||'',p.localizacao_bin||'',now()]);
  res.status(201).json({id});
});

router.put('/pecas/:id', autenticar, isAdmin, (req, res) => {
  const p=req.body;
  db.run(`UPDATE pecas SET codigo=?,nome=?,unidade=?,grupo=?,fonte=?,linha=?,minimo=?,taxa=?,dolar=?,markup=?,custo=?,valor_venda=?,preco_usd=?,localizacao=?,localizacao_bin=? WHERE id=?`,
    [p.codigo||'',p.nome,p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,
     p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,p.preco_usd||0,
     p.localizacao||'',p.localizacao_bin||'',req.params.id]);
  res.json({ok:true});
});

router.delete('/pecas/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM pecas WHERE id=?',[req.params.id]);
  db.run('DELETE FROM estoque WHERE peca_id=?',[req.params.id]);
  res.json({ok:true});
});

router.post('/pecas/definir-minimo-padrao', autenticar, isAdmin, (req, res) => {
  const minimo = parseFloat(req.body.minimo) || 5;
  db.run('UPDATE pecas SET minimo=? WHERE minimo=0 OR minimo IS NULL', [minimo]);
  const total = db.get('SELECT COUNT(*) as n FROM pecas WHERE minimo=?', [minimo]);
  res.json({ok:true, msg:'Minimo padrao definido', total: total?.n||0});
});

router.post('/pecas/zerar', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM depositos');
  db.run('DELETE FROM estoque');
  db.run('DELETE FROM pecas');
  res.json({ok:true, msg:'Pecas e estoque zerados'});
});

router.post('/pecas/importar', autenticar, isAdmin, (req, res) => {
  const { pecas } = req.body;
  if (!Array.isArray(pecas)) return res.status(400).json({erro:'Array obrigatório'});
  for (const p of pecas) {
    db.runBatch(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,taxa,dolar,markup,custo,valor_venda,preco_usd,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id||uid(),p.codigo||'',p.nome||'',p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',
       p.minimo||0,p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,p.preco_usd||0,now()]);
  }
  db.persist();
  res.json({importadas:pecas.length});
});

// ── EQUIPAMENTOS ──────────────────────────────────────────────
router.get('/equipamentos', autenticar, (req, res) => {
  const {q}=req.query; let sql='SELECT * FROM equipamentos WHERE 1=1'; const p=[];
  if (q) { sql+=' AND (modelo LIKE ? OR serie LIKE ? OR cliente LIKE ? OR campos LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
  const CAMPOS_EXTRA = ['cod_produto','grupo2','setor','ip','cnpj','local_contrato','ult_os',
    'os_aberta','os_instalacao','fornecedor','nf_compra','data_compra','termino_garantia',
    'envio','ult_retorno','endereco','numero','complemento','bairro','municipio','uf','cep',
    'status','proprietario','usado','ano_fab','valor_compra','valor_mercado'];
  res.json(db.query(sql+' ORDER BY modelo,cliente',p).map(e=>{
    const campos = P(e.campos)||{};
    const extra = {};
    CAMPOS_EXTRA.forEach(k => { extra[k] = campos[k] || ''; });
    return {
      ...e, campos, ...extra,
      nome: e.modelo, nome_fantasia: e.cliente,
      grupo: campos.grupo || e.linha || '',
      // Expõe codigo do campos diretamente
      codigo: campos.codigo || e.serie || e.id || '',
    };
  }));
});

router.post('/equipamentos', autenticar, isAdmin, (req, res) => {
  const e=req.body; if (!e.modelo) return res.status(400).json({erro:'Modelo obrigatório'});
  const id=e.id||uid();
  db.run(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id,e.modelo,e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),now()]);
  if (e.cliente && e.campos?.cnpj) salvarCnpjCliente(e.cliente, e.campos.cnpj);
  res.status(201).json({id});
});

router.put('/equipamentos/:id', autenticar, isAdmin, (req, res) => {
  const e=req.body;
  db.run(`UPDATE equipamentos SET modelo=?,marca=?,serie=?,linha=?,cliente=?,local=?,contrato=?,obs=?,campos=? WHERE id=?`,
    [e.modelo,e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),req.params.id]);
  if (e.cliente && e.campos?.cnpj) salvarCnpjCliente(e.cliente, e.campos.cnpj);
  res.json({ok:true});
});

router.delete('/equipamentos/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM equipamentos WHERE id=?',[req.params.id]); res.json({ok:true});
});

router.post('/equipamentos/importar', autenticar, isAdmin, (req, res) => {
  const {equipamentos}=req.body; if (!Array.isArray(equipamentos)) return res.status(400).json({erro:'Array obrigatório'});
  for (const e of equipamentos)
    db.runBatch(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      [e.id||uid(),e.modelo||'',e.marca||'',e.serie||'',e.linha||'',e.cliente||'',e.local||'',e.contrato||'',e.obs||'',J(e.campos||{}),now()]);
  db.persist();
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
const toMov=m=>({
  ...m,
  pecaId:      m.peca_id,
  pecaCodigo:  m.peca_codigo,
  pecaNome:    m.peca_nome,
  pecaUnidade: m.peca_unidade,
  equipSerie:  m.equip_serie,
  equipCliente:m.equip_cliente,
  equipModelo: m.equip_modelo,
  temEstoque:  m.tem_estoque,
  numSeq:      m.seq_num,
  tipoAlocacao:m.tipo_alocacao,
  osNum:       m.os_num,
  numSeqOrigem:m.obs&&String(m.obs).startsWith('REF:')?parseInt(String(m.obs).split('|')[0].replace('REF:','')):null,
  grupoId:     m.grupo_id || '',
  eventos:     typeof m.eventos==='string' ? JSON.parse(m.eventos||'[]') : m.eventos||[]
});

router.get('/movimentacoes', autenticar, (req, res) => {
  const {status,q}=req.query;
  const admin=['Gerente','Back Office','Assessor'].includes(req.user.cargo);
  let sql='SELECT * FROM movimentacoes WHERE 1=1'; const p=[];
  if (!admin) { sql+=' AND tecnico=?'; p.push(req.user.nome); }
  if (status) { sql+=' AND status=?'; p.push(status); }
  if (q) { sql+=' AND (peca_nome LIKE ? OR peca_codigo LIKE ? OR equip_serie LIKE ? OR tecnico LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
  const lista = db.query(sql+' ORDER BY created_at DESC',p).map(toMov);
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
    qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,valor_por_orc,obs,eventos,created_at,created_by,origem,grupo_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,seq,'SOLICITADA',m.peca_id||'',m.peca_codigo||'',m.peca_nome||'',m.peca_unidade||'UN',
     m.peca_fonte||'',m.peca_custo||0,m.qtd||1,m.equip_id||'',m.equip_serie||'',m.equip_cliente||'',
     m.equip_modelo||'',m.tecnico||req.user.nome,m.tem_estoque?1:0,m.tipo_alocacao||'',
     m.valor_por_orc?1:0,m.obs||'',eventos,now(),req.user.id,m.origem||'desktop',m.grupo_id||'']);
  res.status(201).json({id,seq_num:seq});
});

router.put('/movimentacoes/:id/acao', autenticar, (req, res) => {
  try {
  const {acao,obs,transporte,rastreio,previsao_entrega,data_recebimento,hora_recebimento,valor_frete}=req.body;
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
    upd.status='DESPACHADA'; upd.transportadora=transporte; upd.rastreio=rastreio||''; upd.previsao_entrega=previsao_entrega||''; upd.valor_frete=parseFloat(valor_frete)||0;
    addEv('DESPACHADA',`Transporte: ${transporte}${rastreio?' · '+rastreio:''}`);
  } else if (acao==='RECEBER') {
    if (!data_recebimento||!hora_recebimento) return res.status(400).json({erro:'Data e hora obrigatórios'});
    upd.status='RECEBIDA'; upd.data_recebimento=data_recebimento; upd.hora_recebimento=hora_recebimento;
    addEv('RECEBIDA',`Recebido em ${data_recebimento} às ${hora_recebimento}`);
  } else if (acao==='ALOCAR') {
    const {tipo_alocacao,os_num}=req.body;
    upd.status='ALOCADA'; upd.tipo_alocacao=tipo_alocacao||'INSTALACAO';
    addEv('ALOCADA','Tipo: '+(tipo_alocacao||'INSTALACAO')+(os_num?' | OS: '+os_num:''));
  } else if (acao==='EMITIR_NF') {
    const {nf_numero,nf_data}=req.body;
    upd.status='NF_EMITIDA';
    addEv('NF_EMITIDA','NF: '+(nf_numero||'')+(nf_data?' · '+nf_data:''));
  } else if (acao==='FINALIZAR') {
    const {devolucao,motivo_devolucao}=req.body;
    upd.status='FINALIZADO'; addEv('FINALIZADO');
    if(devolucao){
      const uid2=()=>Math.random().toString(36).slice(2,14);
      const retId=uid2();
      const retSeq=(db.get('SELECT MAX(seq_num) as m FROM movimentacoes')?.m||0)+1;
      const retEvt=JSON.stringify([{status:'SOLICITADA',data:Date.now(),obs:'Devolucao solicitada pelo desktop. Motivo: '+(motivo_devolucao||'Peca defeituosa'),user:req.user.nome}]);
      db.run('INSERT INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,qtd,equip_serie,tecnico,tem_estoque,tipo_alocacao,obs,eventos,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [retId,retSeq,'SOLICITADA',sol.peca_id,sol.peca_codigo,sol.peca_nome,sol.peca_unidade,sol.qtd,sol.equip_serie,sol.tecnico,0,'RETORNO','REF:'+sol.seq_num+'|'+(motivo_devolucao||'Devolucao de peca defeituosa'),retEvt,Date.now(),req.user.id]);
    }
  } else if (acao==='CANCELAR') {
    upd.status='CANCELADA'; addEv('CANCELADA');
    // Se o estoque já tinha sido baixado (a solicitação passou por "Enviada"
    // ou além, com tem_estoque=true), devolve a quantidade ao cancelar —
    // senão a peça fica "perdida" do estoque numa transação que não existe mais.
    if (sol.status && !['SOLICITADA','COMPRA_PENDENTE'].includes(sol.status)) {
      db.run('UPDATE estoque SET quantidade=quantidade+?,updated_at=? WHERE peca_id=?', [sol.qtd, now(), sol.peca_id]);
    }
  } else if (acao==='COMPRA')   { upd.status='COMPRA_PENDENTE'; addEv('COMPRA_PENDENTE'); }

  try{
    const sets=Object.keys(upd).map(k=>`${k}=?`).join(',');
    db.run(`UPDATE movimentacoes SET ${sets} WHERE id=?`,[...Object.values(upd),req.params.id]);
    res.json({ok:true,status:upd.status});
  }catch(e2){
    console.error('ACAO ERROR:',e2.message,'UPD:',JSON.stringify(upd));
    res.status(500).json({erro:e2.message});
  }
  }catch(e1){ console.error('OUTER ERROR:',e1.message); res.status(500).json({erro:e1.message}); }
});

router.delete('/movimentacoes/:id', autenticar, isAdmin, (req, res) => {
  // Se a solicitação já tinha baixado estoque (passou por "Enviada" ou além)
  // e for excluída (não só cancelada), devolve a quantidade também — mesma
  // lógica do cancelamento, para não deixar peça "perdida" do estoque.
  const sol = db.get('SELECT * FROM movimentacoes WHERE id=?', [req.params.id]);
  if (sol && sol.status && !['SOLICITADA','COMPRA_PENDENTE','CANCELADA'].includes(sol.status)) {
    db.run('UPDATE estoque SET quantidade=quantidade+?,updated_at=? WHERE peca_id=?', [sol.qtd, now(), sol.peca_id]);
  }
  db.run('DELETE FROM movimentacoes WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ── ORÇAMENTOS ────────────────────────────────────────────────
router.get('/orcamentos', autenticar, (req, res) => {
  const {status,q}=req.query; let sql='SELECT * FROM orcamentos WHERE 1=1'; const p=[];
  if (status) { sql+=' AND status=?'; p.push(status); }
  if (q) { sql+=' AND (numero LIKE ? OR cliente LIKE ? OR equip_serie LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  res.json(db.query(sql+' ORDER BY created_at DESC',p).map(o=>({...o,itens:P(o.itens),itens_opcionais:P(o.itens_opcionais)||[],equipamentos:P(o.equipamentos)||[]})));
});

router.post('/orcamentos', autenticar, (req, res) => {
  const o=req.body; if (!o.numero) return res.status(400).json({erro:'Número obrigatório'});
  const id=uid();
  const total=(o.itens||[]).reduce((s,it)=>s+(it.qtd||0)*(parseFloat(it.valor)||0),0);
  db.run(`INSERT INTO orcamentos(id,numero,status,cliente,cnpj,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,obs_condicoes,condicoes,assinatura,total,itens,itens_opcionais,tipo_nf,solicitacao_id,created_at,created_by,status_changed_at,equipamentos,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,o.numero,o.status||'ABERTO',o.cliente||'',o.cnpj||'',o.equip_serie||'',o.equip_nome||'',o.os||'',
     o.data||'',o.obs||'',o.validade||'7 dias',o.pagamento||'30 dias',o.entrega||'A combinar',
     o.frete||'FOB',o.obs_condicoes||'',o.condicoes||'',o.assinatura||req.user.nome,
     total,J(o.itens||[]),J(o.itens_opcionais||[]),o.tipo_nf||'',o.solicitacao_id||'',now(),req.user.id,now(),J(o.equipamentos||[]),now()]);
  if (o.cliente && o.cnpj) salvarCnpjCliente(o.cliente, o.cnpj);
  res.status(201).json({id});
});

router.put('/orcamentos/:id', autenticar, (req, res) => {
  const o=req.body;
  const total=(o.itens||[]).reduce((s,it)=>s+(it.qtd||0)*(parseFloat(it.valor)||0),0);
  const existente = db.get('SELECT status FROM orcamentos WHERE id=?', [req.params.id]);
  const statusMudou = existente && existente.status !== (o.status||'ABERTO');
  db.run(`UPDATE orcamentos SET numero=?,status=?,cliente=?,cnpj=?,equip_serie=?,equip_nome=?,os=?,data=?,obs=?,
    validade=?,pagamento=?,entrega=?,frete=?,obs_condicoes=?,condicoes=?,assinatura=?,total=?,itens=?,itens_opcionais=?,tipo_nf=?,equipamentos=?,updated_at=? WHERE id=?`,
    [o.numero,o.status||'ABERTO',o.cliente||'',o.cnpj||'',o.equip_serie||'',o.equip_nome||'',o.os||'',o.data||'',
     o.obs||'',o.validade||'7 dias',o.pagamento||'30 dias',o.entrega||'A combinar',o.frete||'FOB',
     o.obs_condicoes||'',o.condicoes||'',o.assinatura||'',total,J(o.itens||[]),J(o.itens_opcionais||[]),o.tipo_nf||'',J(o.equipamentos||[]),now(),req.params.id]);
  if (statusMudou) db.run('UPDATE orcamentos SET status_changed_at=? WHERE id=?', [now(), req.params.id]);
  if (o.cliente && o.cnpj) salvarCnpjCliente(o.cliente, o.cnpj);
  res.json({ok:true});
});

router.put('/orcamentos/:id/status', autenticar, isAdmin, (req, res) => {
  db.run('UPDATE orcamentos SET status=?,status_changed_at=?,updated_at=? WHERE id=?',[req.body.status,now(),now(),req.params.id]); res.json({ok:true});
});

router.delete('/orcamentos/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM orcamentos WHERE id=?',[req.params.id]); res.json({ok:true});
});

// ── CLIENTES (memória de CNPJ por nome, para autopreenchimento) ──
function normalizarNomeCliente(nome) {
  return String(nome||'').trim().toUpperCase().replace(/\s+/g,' ');
}
function salvarCnpjCliente(nome, cnpj) {
  const nomeNorm = normalizarNomeCliente(nome);
  if (!nomeNorm || !cnpj) return;
  db.run('INSERT OR REPLACE INTO clientes(nome_norm,nome,cnpj,updated_at) VALUES(?,?,?,?)',
    [nomeNorm, nome.trim(), String(cnpj).trim(), now()]);
}

router.get('/clientes/cnpj', autenticar, (req, res) => {
  const nome = req.query.nome || '';
  const nomeNorm = normalizarNomeCliente(nome);
  if (!nomeNorm) return res.json({ cnpj: '' });
  const c = db.get('SELECT cnpj FROM clientes WHERE nome_norm=?', [nomeNorm]);
  res.json({ cnpj: c?.cnpj || '' });
});

router.post('/clientes/cnpj', autenticar, (req, res) => {
  const { nome, cnpj } = req.body;
  if (!nome || !cnpj) return res.status(400).json({ erro: 'Nome e CNPJ obrigatórios' });
  salvarCnpjCliente(nome, cnpj);
  res.json({ ok: true });
});

// -- KITS PREVENTIVAS --
router.get('/kits-preventivas', autenticar, (req, res) => {
  const {q}=req.query; let sql='SELECT * FROM kits_preventivas WHERE 1=1'; const p=[];
  if (q) { sql+=' AND (nome LIKE ? OR fonte LIKE ? OR linha LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  res.json(db.query(sql+' ORDER BY nome',p).map(k=>({...k,itens:P(k.itens),itens_opcionais:P(k.itens_opcionais)})));
});
router.post('/kits-preventivas', autenticar, isAdmin, (req, res) => {
  const k=req.body; if (!k.nome) return res.status(400).json({erro:'Nome obrigatorio'});
  const id=uid();
  db.run(`INSERT INTO kits_preventivas(id,nome,codigo,fonte,linha,taxa,dolar,markup,itens,itens_opcionais,obs,created_at,updated_at,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,k.nome,k.codigo||'',k.fonte||'',k.linha||'',k.taxa||2,k.dolar||5.27,k.markup||2,J(k.itens||[]),J(k.itens_opcionais||[]),k.obs||'',now(),now(),req.user.id]);
  res.status(201).json({id});
});
router.put('/kits-preventivas/:id', autenticar, isAdmin, (req, res) => {
  const k=req.body;
  db.run(`UPDATE kits_preventivas SET nome=?,codigo=?,fonte=?,linha=?,taxa=?,dolar=?,markup=?,itens=?,itens_opcionais=?,obs=?,updated_at=? WHERE id=?`,
    [k.nome,k.codigo||'',k.fonte||'',k.linha||'',k.taxa||2,k.dolar||5.27,k.markup||2,J(k.itens||[]),J(k.itens_opcionais||[]),k.obs||'',now(),req.params.id]);
  res.json({ok:true});
});
router.delete('/kits-preventivas/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM kits_preventivas WHERE id=?',[req.params.id]); res.json({ok:true});
});

// -- SOLICITACOES DE COMPRA --
router.get('/solicitacoes-compra', autenticar, (req, res) => {
  const {status,q}=req.query; let sql='SELECT * FROM solicitacoes_compra WHERE 1=1'; const p=[];
  if (status) { sql+=' AND status=?'; p.push(status); }
  if (q) { sql+=' AND (numero LIKE ? OR demanda_nome LIKE ? OR equip_serie LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  res.json(db.query(sql+' ORDER BY created_at DESC',p).map(sc=>({...sc,itens:P(sc.itens)})));
});
router.post('/solicitacoes-compra', autenticar, (req, res) => {
  const sc=req.body; if (!sc.numero) return res.status(400).json({erro:'Numero obrigatorio'});
  const id=uid();
  db.run(`INSERT INTO solicitacoes_compra(id,numero,status,demanda,demanda_nome,equip_serie,equip_nome,equip_cliente,itens,obs,created_at,updated_at,status_changed_at,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,sc.numero,sc.status||'SOLICITADO',sc.demanda||'',sc.demanda_nome||'',sc.equip_serie||'',sc.equip_nome||'',sc.equip_cliente||'',J(sc.itens||[]),sc.obs||'',now(),now(),now(),req.user.id]);
  res.status(201).json({id});
});
router.put('/solicitacoes-compra/:id', autenticar, (req, res) => {
  const sc=req.body;
  const existente = db.get('SELECT status FROM solicitacoes_compra WHERE id=?', [req.params.id]);
  const statusMudou = existente && existente.status !== (sc.status||'SOLICITADO');
  db.run(`UPDATE solicitacoes_compra SET numero=?,status=?,demanda=?,demanda_nome=?,equip_serie=?,equip_nome=?,equip_cliente=?,itens=?,obs=?,updated_at=? WHERE id=?`,
    [sc.numero,sc.status||'SOLICITADO',sc.demanda||'',sc.demanda_nome||'',sc.equip_serie||'',sc.equip_nome||'',sc.equip_cliente||'',J(sc.itens||[]),sc.obs||'',now(),req.params.id]);
  if (statusMudou) db.run('UPDATE solicitacoes_compra SET status_changed_at=? WHERE id=?', [now(), req.params.id]);
  res.json({ok:true});
});
router.put('/solicitacoes-compra/:id/status', autenticar, (req, res) => {
  db.run('UPDATE solicitacoes_compra SET status=?,status_changed_at=?,updated_at=? WHERE id=?',[req.body.status,now(),now(),req.params.id]); res.json({ok:true});
});
router.delete('/solicitacoes-compra/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM solicitacoes_compra WHERE id=?',[req.params.id]); res.json({ok:true});
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

router.get('/notificacoes', autenticar, (req, res) => {
  const desdeMs=parseInt(req.query.desde)||0;
  const desde=desdeMs>9999999999?Math.floor(desdeMs/1000):desdeMs;
  const userId=req.user.id;
  const userNome=req.user.nome;
  const movs=db.query('SELECT * FROM movimentacoes WHERE created_at > ?',[desde])
    .map(m=>({...m,eventos:typeof m.eventos==='string'?JSON.parse(m.eventos||'[]'):m.eventos||[]}))
    .filter(m=>{
      // Desktop ve novas solicitacoes mobile
      // Mobile ve mudancas de status nas suas solicitacoes
      return m.tecnico===userNome || true;
    });
  const orcs=db.query('SELECT * FROM orcamentos WHERE created_at > ?',[desde])
    .filter(o=>String(o.numero||'').startsWith('M-'));
  res.json({movimentacoes:movs,orcamentos:orcs,timestamp:Date.now()});
});

router.post('/admin/reset', autenticar, (req, res) => {
  if(req.user.cargo !== 'Gerente') return res.status(403).json({erro:'Sem permissao'});
  ['movimentacoes','orcamentos','estoque','pecas','equipamentos','pedidos','retiradas','doadoras'].forEach(t=>db.run('DELETE FROM '+t));
  db.run("DELETE FROM usuarios WHERE cargo != 'Gerente'");
  db.run("UPDATE configuracoes SET valor='1' WHERE chave='seq_counter'");
  res.json({ok:true,msg:'Reset concluido'});
});
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
  const ultMovs      = db.query("SELECT * FROM movimentacoes ORDER BY created_at DESC LIMIT 10").map(toMov);

  // Valor total de orçamentos faturados
  const valorFaturado = db.get("SELECT COALESCE(SUM(total),0) as v FROM orcamentos WHERE status='FATURADO'")?.v || 0;

  // Total de peças enviadas (soma de qtd das solicitações que já saíram: exclui só as
  // que ainda estão em Solicitada, Compra Pendente ou foram Canceladas)
  const pecasEnviadas = db.get("SELECT COALESCE(SUM(qtd),0) as v FROM movimentacoes WHERE status NOT IN ('SOLICITADA','COMPRA_PENDENTE','CANCELADA')")?.v || 0;

  // Faturamento mensal (orçamentos com status Faturado, agrupado por mês da data do orçamento)
  const faturamentoPorMes = db.query(`
    SELECT substr(data,1,7) as mes, SUM(total) as total
    FROM orcamentos
    WHERE status='FATURADO' AND data IS NOT NULL AND data != ''
    GROUP BY mes ORDER BY mes`);

  // Envios de peças por cliente: quantidade, custo das peças e custo de frete
  const enviosPorCliente = db.query(`
    SELECT equip_cliente as cliente, SUM(qtd) as qtdPecas,
           SUM(peca_custo*qtd) as custoPecas, SUM(COALESCE(valor_frete,0)) as custoFrete
    FROM movimentacoes
    WHERE equip_cliente IS NOT NULL AND equip_cliente != '' AND status NOT IN ('SOLICITADA','CANCELADA')
    GROUP BY equip_cliente
    ORDER BY qtdPecas DESC
    LIMIT 15`);

  // Gastos por cliente em Solicitações de Compra (soma qtd x valor dos itens,
  // agrupado pelo cliente do item ou, se não tiver, o da própria solicitação).
  // Itens de demanda ESTOQUE (reposição, sem cliente vinculado) entram numa
  // categoria própria "Reposição de Estoque", em vez de ficarem de fora.
  // Exclui as recusadas, que não representam gasto real.
  const todasSC = db.query("SELECT * FROM solicitacoes_compra WHERE status != 'RECUSADO'");
  const gastosPorClienteMap = {};
  todasSC.forEach(sc => {
    let itens = [];
    try { itens = JSON.parse(sc.itens || '[]'); } catch (e) { itens = []; }
    itens.forEach(it => {
      const demandaEfetiva = it.demanda || sc.demanda || '';
      let categoria;
      if (demandaEfetiva === 'ESTOQUE') {
        categoria = 'Reposição de Estoque';
      } else {
        categoria = (
          it.equip_cliente ||
          (it.demanda === 'CLIENTE' ? it.demanda_nome : '') ||
          sc.equip_cliente ||
          (sc.demanda === 'CLIENTE' ? sc.demanda_nome : '') ||
          ''
        ).trim();
      }
      if (!categoria) return;
      const valorItem = (parseFloat(it.qtd) || 0) * (parseFloat(it.valor) || 0);
      gastosPorClienteMap[categoria] = (gastosPorClienteMap[categoria] || 0) + valorItem;
    });
  });
  const gastosPorCliente = Object.entries(gastosPorClienteMap)
    .map(([cliente, total]) => ({ cliente, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  res.json({totalPecas,totalEquip,movAbertos,compPendente,orcAbertos,pedAbertos,estoqueMin,ultMovs,
    valorFaturado, pecasEnviadas, faturamentoPorMes, enviosPorCliente, gastosPorCliente});
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
    orcamentos:    db.query('SELECT * FROM orcamentos').map(o=>({...o,itens:P(o.itens),itens_opcionais:P(o.itens_opcionais)})),
    solicitacoes_compra: db.query('SELECT * FROM solicitacoes_compra').map(sc=>({...sc,itens:P(sc.itens)})),
    kits_preventivas: db.query('SELECT * FROM kits_preventivas').map(k=>({...k,itens:P(k.itens),itens_opcionais:P(k.itens_opcionais)})),
    clientes:      db.query('SELECT * FROM clientes'),
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
    if (s.pecas?.length) {
      for (const p of s.pecas)
        db.runBatch(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [p.id||uid(),p.codigo||'',p.nome||'',p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,p.imagem||'',p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,p.created_at||now()]);
    } else if (s.pecasPrecos || s.depositos || s.movimentacoes) {
      const pecasMap = {};
      if (s.movimentacoes?.length) {
        for (const m of s.movimentacoes) {
          const pid = m.peca_id||m.pecaId||'';
          if (pid && !pecasMap[pid]) {
            pecasMap[pid] = {
              id: pid, codigo: m.peca_codigo||m.pecaCodigo||pid,
              nome: m.peca_nome||m.pecaNome||'', unidade: m.peca_unidade||m.pecaUnidade||'UN',
              fonte: m.peca_fonte||m.pecaFonte||'', custo: m.peca_custo||m.pecaCusto||0,
              taxa:0, dolar:0, markup:0, valor_venda:0, grupo:'', linha:'', minimo:0,
            };
          }
        }
      }
      if (s.depositos) {
        for (const [pid, dep] of Object.entries(s.depositos)) {
          if (!pecasMap[pid] && dep._nome) {
            pecasMap[pid] = {
              id: pid, codigo: pid, nome: dep._nome, unidade: dep._und||'UN',
              fonte:'', custo:0, taxa:0, dolar:0, markup:0, valor_venda:0,
              grupo: dep._grupo||'', linha:'', minimo:0,
            };
          }
        }
      }
      if (s.pecasPrecos) {
        for (const p of Object.values(pecasMap)) {
          const preco = s.pecasPrecos[p.codigo] || s.pecasPrecos[p.id];
          if (preco) Object.assign(p, preco);
        }
      }
      for (const p of Object.values(pecasMap)) {
        if (!p.nome) continue;
        db.runBatch(`INSERT OR REPLACE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [p.id,p.codigo||'',p.nome,p.unidade||'UN',p.grupo||'',p.fonte||'',p.linha||'',p.minimo||0,'',p.taxa||0,p.dolar||0,p.markup||0,p.custo||0,p.valor_venda||0,now()]);
      }
      if (s.depositos) {
        for (const [pid, dep] of Object.entries(s.depositos)) {
          const total = typeof dep.Total === 'number' ? dep.Total : 0;
          if (total > 0 || pecasMap[pid]) {
            const ex = db.get('SELECT quantidade FROM estoque WHERE peca_id=?',[pid]);
            if (!ex) db.runBatch('INSERT OR IGNORE INTO estoque(peca_id,quantidade,updated_at) VALUES(?,?,?)',[pid,total,now()]);
          }
        }
      }
      if (s.estoque && !Array.isArray(s.estoque)) {
        for (const [pid, qtd] of Object.entries(s.estoque)) {
          if (pecasMap[pid] && qtd > 0) {
            db.runBatch('INSERT OR REPLACE INTO estoque(peca_id,quantidade,updated_at) VALUES(?,?,?)',[pid,qtd,now()]);
          }
        }
      }
    }

    if (s.equipamentos?.length) for (const e of s.equipamentos) {
      const modelo  = e.modelo || e.nome || '';
      const cliente = e.cliente || e.nome_fantasia || '';
      const local   = e.local || e.endereco || '';
      const linha   = e.linha || e.grupo || '';
      const campos  = e.campos || {
        codigo: e.codigo||'', cod_produto: e.cod_produto||'', grupo: e.grupo||'',
        grupo2: e.grupo2||'', status: e.status||'', proprietario: e.proprietario||'',
        municipio: e.municipio||'', uf: e.uf||'', cep: e.cep||'', bairro: e.bairro||'',
        setor: e.setor||'', ip: e.ip||'', nf_compra: e.nf_compra||'',
        data_compra: e.data_compra||'', ano_fab: e.ano_fab||'',
        valor_compra: e.valor_compra||0, valor_mercado: e.valor_mercado||0,
        os_aberta: e.os_aberta||'', ult_os: e.ult_os||'',
      };
      db.runBatch(`INSERT OR REPLACE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [e.id||uid(), modelo, e.marca||'', e.serie||'', linha, cliente, local,
         e.contrato||'', e.obs||'', J(campos), e.createdAt||e.created_at||now()]);
    }

    if (s.estoque) {
      const estoqueList = Array.isArray(s.estoque) ? s.estoque : Object.entries(s.estoque).map(([k,v])=>({peca_id:k,quantidade:v}));
      for (const e of estoqueList)
        db.runBatch(`INSERT OR REPLACE INTO estoque(peca_id,quantidade,updated_at) VALUES(?,?,?)`,
          [e.peca_id||e.pecaId,e.quantidade||0,now()]);
    }

    if (s.movimentacoes?.length) for (const m of s.movimentacoes)
      db.runBatch(`INSERT OR REPLACE INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,obs,eventos,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [m.id||uid(),m.seq_num||m.seqNum||0,m.status||'SOLICITADA',m.peca_id||m.pecaId||'',m.peca_codigo||m.pecaCodigo||'',m.peca_nome||m.pecaNome||'',m.peca_unidade||m.pecaUnidade||'UN',m.peca_fonte||m.pecaFonte||'',m.peca_custo||m.pecaCusto||0,m.qtd||1,m.equip_id||m.equipId||'',m.equip_serie||m.equipSerie||'',m.equip_cliente||m.equipCliente||'',m.equip_modelo||m.equipModelo||'',m.tecnico||'',m.tem_estoque||m.temEstoque?1:0,m.tipo_alocacao||m.tipoAlocacao||'',m.obs||'',J(m.eventos||[]),m.created_at||m.createdAt||now(),'restore']);

    if (s.orcamentos?.length) for (const o of s.orcamentos)
      db.runBatch(`INSERT OR REPLACE INTO orcamentos(id,numero,status,cliente,cnpj,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,condicoes,assinatura,total,itens,itens_opcionais,equipamentos,created_at,updated_at,status_changed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [o.id||uid(),o.numero||'',o.status||'ABERTO',o.cliente||'',o.cnpj||'',o.equip_serie||o.equipSerie||'',o.equip_nome||o.equipNome||'',o.os||'',o.data||'',o.obs||'',o.validade||'7 dias',o.pagamento||o.formaPagamento||'30 dias',o.entrega||o.prazoEntrega||'A combinar',o.frete||'FOB',o.condicoes||'',o.assinatura||'',o.total||0,J(o.itens||[]),J(o.itens_opcionais||[]),J(o.equipamentos||[]),o.created_at||now(),o.updated_at||now(),o.status_changed_at||now()]);

    if (s.pedidos?.length) for (const p of s.pedidos)
      db.runBatch(`INSERT OR REPLACE INTO pedidos(id,numero,status,obs,itens,created_at) VALUES(?,?,?,?,?,?)`,
        [p.id||uid(),p.numero||'',p.status||'ABERTO',p.obs||'',J(p.itens||[]),p.created_at||now()]);

    if (s.doadoras?.length) for (const d of s.doadoras)
      db.runBatch(`INSERT OR REPLACE INTO doadoras(id,modelo,serie,marca,linha,classificacao,fator,obs,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
        [d.id||uid(),d.modelo||'',d.serie||'',d.marca||'',d.linha||'',d.classificacao||'USO',d.fator||1,d.obs||'',d.created_at||now()]);

    if (s.solicitacoes_compra?.length) for (const sc of s.solicitacoes_compra)
      db.runBatch(`INSERT OR REPLACE INTO solicitacoes_compra(id,numero,status,demanda,demanda_nome,equip_serie,equip_nome,equip_cliente,itens,obs,created_at,updated_at,status_changed_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sc.id||uid(),sc.numero||'',sc.status||'SOLICITADO',sc.demanda||'',sc.demanda_nome||'',sc.equip_serie||'',sc.equip_nome||'',sc.equip_cliente||'',J(sc.itens||[]),sc.obs||'',sc.created_at||now(),sc.updated_at||now(),sc.status_changed_at||now(),sc.created_by||'restore']);

    if (s.clientes?.length) for (const c of s.clientes)
      db.runBatch(`INSERT OR REPLACE INTO clientes(nome_norm,nome,cnpj,updated_at) VALUES(?,?,?,?)`,
        [c.nome_norm||normalizarNomeCliente(c.nome||''),c.nome||'',c.cnpj||'',c.updated_at||now()]);

    if (s.kits_preventivas?.length) for (const k of s.kits_preventivas)
      db.runBatch(`INSERT OR REPLACE INTO kits_preventivas(id,nome,codigo,fonte,linha,taxa,dolar,markup,itens,itens_opcionais,obs,created_at,updated_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [k.id||uid(),k.nome||'',k.codigo||'',k.fonte||'',k.linha||'',k.taxa||2,k.dolar||5.27,k.markup||2,J(k.itens||[]),J(k.itens_opcionais||[]),k.obs||'',k.created_at||now(),k.updated_at||now(),k.created_by||'restore']);

    if (s.config_orcamento) db.runBatch("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES('config_orcamento',?)",[J(s.config_orcamento)]);
    if (s.config_compras)   db.runBatch("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES('config_compras',?)",[J(s.config_compras)]);

    db.persist();
    res.json({ok:true});
  } catch(e) {
    console.error('Restore error:', e);
    res.status(500).json({erro:'Erro no restore: '+e.message});
  }
});

// ── HEALTH ────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({status:'ok',time:new Date().toISOString()}));

module.exports = router;
