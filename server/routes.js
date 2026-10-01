const express = require('express'); // v2
const router  = express.Router();
const db      = require('./database');
const bcrypt  = require('bcryptjs');
const { gerarToken, autenticar, isAdmin } = require('./auth');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

function uid() { return db.uid(); }
function now() { return db.now(); }
function J(v)  { return JSON.stringify(v); }
function P(v)  { try { return JSON.parse(v||'null') || []; } catch(e) { return []; } }

// ── Geração do PDF do orçamento no servidor (pra anexar no e-mail) ──
function desenharTabelaItensPdf(doc, itens, y, ML, CONTENT_W, corHeader, corTexto) {
  const wCod=65, wDesc=215, wQtd=40, wUnit=100, wTotal=CONTENT_W-(65+215+40+100);
  const colCod=ML, colDesc=ML+wCod, colQtd=ML+wCod+wDesc, colUnit=ML+wCod+wDesc+wQtd, colTotal=ML+wCod+wDesc+wQtd+wUnit;
  doc.rect(ML, y, CONTENT_W, 18).fill(corHeader);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
  doc.text('CÓD.', colCod+3, y+5, {width:wCod-6});
  doc.text('DESCRIÇÃO', colDesc+3, y+5, {width:wDesc-6});
  doc.text('QTD', colQtd, y+5, {width:wQtd, align:'center'});
  doc.text('VALOR UNIT.', colUnit, y+5, {width:wUnit-3, align:'right'});
  doc.text('TOTAL', colTotal, y+5, {width:wTotal-3, align:'right'});
  y += 18;
  itens.forEach((it, i) => {
    const qtd = parseFloat(it.qtd)||0, valor = parseFloat(it.valor)||0, rowH = 16;
    if (y > 760) { doc.addPage(); y = 40; }
    if (i % 2 === 1) doc.rect(ML, y, CONTENT_W, rowH).fill('#f7f8fa');
    doc.fillColor(corTexto).font('Helvetica').fontSize(8.5);
    doc.text(it.cod || '—', colCod+3, y+4, {width:wCod-6});
    doc.text(it.desc || '', colDesc+3, y+4, {width:wDesc-6, ellipsis:true});
    doc.text(String(qtd), colQtd, y+4, {width:wQtd, align:'center'});
    doc.text('R$ '+valor.toFixed(2), colUnit, y+4, {width:wUnit-3, align:'right'});
    doc.font('Helvetica-Bold').text('R$ '+(qtd*valor).toFixed(2), colTotal, y+4, {width:wTotal-3, align:'right'});
    y += rowH;
  });
  return y + 6;
}
function desenharTotalPdf(doc, y, label, valor, cor, ML, CONTENT_W) {
  const boxW = 170, boxH = 22;
  if (y > 750) { doc.addPage(); y = 40; }
  doc.roundedRect(ML+CONTENT_W-boxW, y, boxW, boxH, 3).fill(cor);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
    .text(label+': R$ '+valor.toFixed(2), ML+CONTENT_W-boxW, y+6, {width:boxW, align:'center'});
  return y + boxH + 10;
}

function gerarPdfOrcamentoBuffer(orc) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const ML = 40, PAGE_W = 595.28, CONTENT_W = PAGE_W - ML - 40;
      const TEAL='#00a0a0', DARK='#1e2832', MED='#465569', LIGHT='#8294a0', ORANGE='#d48c32';

      doc.rect(0, 0, PAGE_W, 70).fill('#f5f7f9');
      doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(20).text('QUALLYX', ML, 22);
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(14).text('ORÇAMENTO', ML, 20, { width: CONTENT_W, align: 'right' });
      doc.fillColor(MED).font('Helvetica').fontSize(10).text(orc.numero || '', ML, 38, { width: CONTENT_W, align: 'right' });
      doc.fillColor(LIGHT).fontSize(8).text(orc.data || '', ML, 52, { width: CONTENT_W, align: 'right' });

      let y = 90;
      const infoLine = (label, value) => {
        doc.fillColor(LIGHT).font('Helvetica-Bold').fontSize(8).text(label.toUpperCase() + ':', ML, y);
        doc.fillColor(DARK).font('Helvetica').fontSize(9).text(value || '—', ML + 90, y, { width: CONTENT_W-90 });
        y += 16;
      };
      infoLine('Cliente', (orc.cliente || '—') + (orc.cnpj ? '  -  CNPJ: ' + orc.cnpj : ''));
      const equipList = (orc.equipamentos && orc.equipamentos.length) ? orc.equipamentos
        : ((orc.equip_serie || orc.equip_nome) ? [{ serie: orc.equip_serie, nome: orc.equip_nome }] : []);
      infoLine('Equipamento', equipList.map(e => [e.serie, e.nome].filter(Boolean).join(' - ')).join(' | '));
      infoLine('OS', orc.os);
      y += 8;

      const itens = orc.itens || [];
      y = desenharTabelaItensPdf(doc, itens, y, ML, CONTENT_W, TEAL, DARK);
      const totalPrincipal = itens.reduce((s,it)=>s+(parseFloat(it.qtd)||0)*(parseFloat(it.valor)||0),0);
      y = desenharTotalPdf(doc, y, 'TOTAL', totalPrincipal, TEAL, ML, CONTENT_W);

      if (orc.itens_opcionais && orc.itens_opcionais.length) {
        if (y > 700) { doc.addPage(); y = 40; }
        y += 6;
        doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(9).text('ITENS OPCIONAIS', ML, y);
        y += 14;
        doc.fillColor(MED).font('Helvetica-Oblique').fontSize(8)
          .text('Itens recomendados trocar numa preventiva, segundo o fabricante.', ML, y, { width: CONTENT_W });
        y += 16;
        y = desenharTabelaItensPdf(doc, orc.itens_opcionais, y, ML, CONTENT_W, ORANGE, DARK);
        const totalOpc = orc.itens_opcionais.reduce((s,it)=>s+(parseFloat(it.qtd)||0)*(parseFloat(it.valor)||0),0);
        y = desenharTotalPdf(doc, y, 'OPCIONAIS', totalOpc, ORANGE, ML, CONTENT_W);
      }

      if (y > 720) { doc.addPage(); y = 40; }
      y += 10;
      if (orc.obs) {
        doc.fillColor(MED).font('Helvetica-Oblique').fontSize(8).text('Obs.: ' + orc.obs, ML, y, { width: CONTENT_W });
        y += 20;
      }
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text('CONDIÇÕES GERAIS', ML, y);
      y += 14;
      doc.fillColor(MED).font('Helvetica').fontSize(8.5);
      const condLinhas = [
        'Validade da proposta: ' + (orc.validade || '—') + '.',
        'Prazo de pagamento: ' + (orc.pagamento || '—') + '.',
        'Prazo de entrega: ' + (orc.entrega || '—') + '.',
        'Frete: ' + (orc.frete || '—') + '.',
      ];
      if (orc.tipo_nf) {
        const tipoNfLabel = { NFE: 'NFe', NFS: 'NFS', AMBAS: 'NFe + NFS' }[orc.tipo_nf] || orc.tipo_nf;
        condLinhas.push('Tipo de nota fiscal: ' + tipoNfLabel + '.');
      }
      condLinhas.forEach(l => { doc.text(l, ML, y, { width: CONTENT_W }); y += 13; });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Notifica por e-mail quando um orçamento MUDA de status para A Faturar ou
// Faturado (não dispara em resalvamentos que não mudam o status), com o
// PDF do orçamento anexado. Falha silenciosamente (só loga) se as
// credenciais de e-mail não estiverem configuradas ou o PDF não gerar, pra
// nunca travar a operação principal por causa disso.
async function notificarStatusOrcamento(orcId, statusNovo) {
  const destinos = {
    A_FATURAR: { email: 'chaiane@quallyx.com.br', assunto: 'Orçamento pronto para faturamento', mensagem: 'está pronto para faturamento' },
  };
  const destino = destinos[statusNovo];
  if (!destino) return;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('Notificacao de status de orcamento: GMAIL_USER/GMAIL_APP_PASSWORD nao configurados, pulando envio.');
    return;
  }
  try {
    const row = db.get('SELECT * FROM orcamentos WHERE id=?', [orcId]);
    if (!row) return;
    const orc = { ...row, itens: P(row.itens), itens_opcionais: P(row.itens_opcionais)||[], equipamentos: P(row.equipamentos)||[] };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const html = `
      <p>O orçamento <strong>Nº ${orc.numero || '—'}</strong> ${destino.mensagem}.</p>
      <p><strong>Cliente:</strong> ${orc.cliente || '—'}<br>
      <strong>Total:</strong> R$ ${parseFloat(orc.total || 0).toFixed(2)}</p>
      <p style="color:#888;font-size:12px">Mensagem automática do PartForge. O PDF do orçamento está anexado.</p>`;

    const attachments = [];
    try {
      const pdfBuffer = await gerarPdfOrcamentoBuffer(orc);
      attachments.push({ filename: 'Orcamento_' + (orc.numero || 'sem_numero') + '.pdf', content: pdfBuffer });
    } catch (pdfErr) {
      console.error('Erro ao gerar PDF do orcamento para anexar no e-mail:', pdfErr.message);
    }

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: destino.email,
      subject: 'PartForge - ' + destino.assunto + ' (Nº ' + (orc.numero || '') + ')',
      html,
      attachments
    });
    console.log('Notificacao de status enviada para', destino.email, '- orcamento', orc.numero);
  } catch (err) {
    console.error('Erro ao enviar notificacao de status de orcamento:', err.message);
  }
}

// Notifica thiago.bessa@quallyx.com.br quando um orçamento passa a ter os DOIS
// anexos (boleto + nota fiscal) ao mesmo tempo — só na transição (não tinha
// os dois antes, agora tem), pra não repetir a cada edição depois disso.
function dataUrlParaBuffer(dataUrl) {
  const m = /^data:.*?;base64,(.*)$/s.exec(dataUrl || '');
  return m ? Buffer.from(m[1], 'base64') : null;
}
async function notificarAnexosCompletos(orcId) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('Notificacao de anexos completos: GMAIL_USER/GMAIL_APP_PASSWORD nao configurados, pulando envio.');
    return;
  }
  try {
    const row = db.get('SELECT * FROM orcamentos WHERE id=?', [orcId]);
    if (!row) return;
    const orc = { ...row, itens: P(row.itens), itens_opcionais: P(row.itens_opcionais)||[], equipamentos: P(row.equipamentos)||[] };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });
    const html = `
      <p>O orçamento <strong>Nº ${orc.numero || '—'}</strong> já tem boleto e nota fiscal anexados.</p>
      <p><strong>Cliente:</strong> ${orc.cliente || '—'}<br>
      <strong>Total:</strong> R$ ${parseFloat(orc.total || 0).toFixed(2)}</p>
      <p style="color:#888;font-size:12px">Mensagem automática do PartForge. Orçamento, boleto e nota fiscal estão anexados.</p>`;

    const attachments = [];
    try {
      const pdfBuffer = await gerarPdfOrcamentoBuffer(orc);
      attachments.push({ filename: 'Orcamento_' + (orc.numero || 'sem_numero') + '.pdf', content: pdfBuffer });
    } catch (pdfErr) {
      console.error('Erro ao gerar PDF do orcamento para anexar no e-mail:', pdfErr.message);
    }
    const boletoBuf = dataUrlParaBuffer(orc.boleto_arquivo);
    if (boletoBuf) attachments.push({ filename: orc.boleto_nome || 'boleto', content: boletoBuf });
    const notaBuf = dataUrlParaBuffer(orc.nota_arquivo);
    if (notaBuf) attachments.push({ filename: orc.nota_nome || 'nota_fiscal', content: notaBuf });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: 'thiago.bessa@quallyx.com.br',
      subject: 'PartForge - Orçamento com boleto e nota anexados (Nº ' + (orc.numero || '') + ')',
      html,
      attachments
    });
    console.log('Notificacao de anexos completos enviada para thiago.bessa@quallyx.com.br - orcamento', orc.numero);
  } catch (err) {
    console.error('Erro ao enviar notificacao de anexos completos:', err.message);
  }
}


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
// O conteúdo das fotos (base64) fica de fora das listagens — só a
// quantidade de cada tipo, pra UI mostrar o indicador sem pesar o
// carregamento. O conteúdo é buscado sob demanda em /movimentacoes/:id/fotos.
const contarFotos = v => { try { return (JSON.parse(v||'[]')||[]).length; } catch(e) { return 0; } };
const toMov=m=>{
  const { fotos_despacho, fotos_recebimento, fotos_devolucao, ...resto } = m;
  return {
    ...resto,
    pecaId:      m.peca_id,
    pecaCodigo:  m.peca_codigo,
    pecaNome:    m.peca_nome,
    pecaUnidade: m.peca_unidade,
    pecaValorVenda: m.peca_valor_venda,
    equipSerie:  m.equip_serie,
    equipCliente:m.equip_cliente,
    equipModelo: m.equip_modelo,
    temEstoque:  m.tem_estoque,
    numSeq:      m.seq_num,
    tipoAlocacao:m.tipo_alocacao,
    osNum:       m.os_num,
    numSeqOrigem:m.obs&&String(m.obs).startsWith('REF:')?parseInt(String(m.obs).split('|')[0].replace('REF:','')):null,
    grupoId:     m.grupo_id || '',
    eventos:     typeof m.eventos==='string' ? JSON.parse(m.eventos||'[]') : m.eventos||[],
    fotosDespachoQtd:    contarFotos(fotos_despacho),
    fotosRecebimentoQtd: contarFotos(fotos_recebimento),
    fotosDevolucaoQtd:   contarFotos(fotos_devolucao),
  };
};

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

router.get('/movimentacoes/:id/fotos', autenticar, (req, res) => {
  const m = db.get('SELECT fotos_despacho, fotos_recebimento, fotos_devolucao FROM movimentacoes WHERE id=?', [req.params.id]);
  if (!m) return res.status(404).json({ erro: 'Não encontrada' });
  res.json({
    fotos_despacho: P(m.fotos_despacho),
    fotos_recebimento: P(m.fotos_recebimento),
    fotos_devolucao: P(m.fotos_devolucao),
  });
});

router.post('/movimentacoes', autenticar, (req, res) => {
  const m=req.body;
  const cfg = db.get("SELECT valor FROM configuracoes WHERE chave='seq_counter'");
  const seq  = parseInt(cfg?.valor||'0') + 1;
  db.run("UPDATE configuracoes SET valor=? WHERE chave='seq_counter'",[String(seq)]);
  const id=uid();
  // Se vier uma data customizada (lançamento retroativo de um envio que
  // aconteceu em outro dia), usa ela tanto no evento inicial quanto no
  // created_at — assim entra certo em relatórios/dashboard filtrados por data.
  let dataMs = now();
  if (m.data_solicitacao) {
    const parsed = new Date(m.data_solicitacao + 'T12:00:00-03:00').getTime();
    if (!isNaN(parsed)) dataMs = parsed;
  }
  const eventos=J([{status:'SOLICITADA',data:dataMs,obs:'',user:req.user.nome}]);
  db.run(`INSERT INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,peca_valor_venda,
    qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,valor_por_orc,obs,eventos,created_at,created_by,origem,grupo_id,
    retirada_eqsp_id,retirada_eqsp_nome)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,seq,'SOLICITADA',m.peca_id||'',m.peca_codigo||'',m.peca_nome||'',m.peca_unidade||'UN',
     m.peca_fonte||'',m.peca_custo||0,m.peca_valor_venda||0,m.qtd||1,m.equip_id||'',m.equip_serie||'',m.equip_cliente||'',
     m.equip_modelo||'',m.tecnico||req.user.nome,m.tem_estoque?1:0,m.tipo_alocacao||'',
     m.valor_por_orc?1:0,m.obs||'',eventos,dataMs,req.user.id,m.origem||'desktop',m.grupo_id||'',
     m.retirada_eqsp_id||'',m.retirada_eqsp_nome||'']);
  res.status(201).json({id,seq_num:seq});
});

// Edita a data de uma solicitação já existente (ex: envio feito num dia mas
// só lançado no sistema depois). Atualiza o evento inicial e o created_at,
// pra valer certo em Histórico, Dashboard e relatórios.
router.put('/movimentacoes/:id/data', autenticar, (req, res) => {
  const { data_solicitacao } = req.body;
  if (!data_solicitacao) return res.status(400).json({ erro: 'Data obrigatória' });
  const parsed = new Date(data_solicitacao + 'T12:00:00-03:00').getTime();
  if (isNaN(parsed)) return res.status(400).json({ erro: 'Data inválida' });
  const sol = db.get('SELECT * FROM movimentacoes WHERE id=?', [req.params.id]);
  if (!sol) return res.status(404).json({ erro: 'Não encontrada' });
  let eventos = [];
  try { eventos = JSON.parse(sol.eventos || '[]'); } catch (e) { eventos = []; }
  if (eventos.length) eventos[0].data = parsed;
  else eventos = [{ status: 'SOLICITADA', data: parsed, obs: '', user: req.user.nome }];
  db.run('UPDATE movimentacoes SET eventos=?, created_at=? WHERE id=?', [JSON.stringify(eventos), parsed, req.params.id]);
  res.json({ ok: true });
});

// Edição geral de uma solicitação já existente (peça, quantidade, equipamento,
// técnico, obs). Se o estoque já tinha sido baixado (status além de
// SOLICITADA/COMPRA_PENDENTE), ajusta o estoque automaticamente: devolve a
// quantidade antiga na peça antiga e baixa a nova quantidade na peça nova.
router.put('/movimentacoes/:id', autenticar, (req, res) => {
  const m = req.body;
  const sol = db.get('SELECT * FROM movimentacoes WHERE id=?', [req.params.id]);
  if (!sol) return res.status(404).json({ erro: 'Não encontrada' });

  const estoqueJaBaixado = sol.status && !['SOLICITADA', 'COMPRA_PENDENTE', 'CANCELADA'].includes(sol.status);
  const pecaMudou = m.peca_id !== undefined && m.peca_id !== sol.peca_id;
  const qtdMudou  = m.qtd !== undefined && Number(m.qtd) !== Number(sol.qtd);

  if (estoqueJaBaixado && (pecaMudou || qtdMudou)) {
    // Devolve a quantidade antiga pra peça antiga
    if (sol.peca_id) {
      db.run('UPDATE estoque SET quantidade=quantidade+?,updated_at=? WHERE peca_id=?', [sol.qtd || 0, now(), sol.peca_id]);
    }
    // Baixa a quantidade nova na peça nova
    const novaPecaId = pecaMudou ? m.peca_id : sol.peca_id;
    const novaQtd = qtdMudou ? m.qtd : sol.qtd;
    if (novaPecaId) {
      db.run('UPDATE estoque SET quantidade=MAX(0,quantidade-?),updated_at=? WHERE peca_id=?', [novaQtd || 0, now(), novaPecaId]);
    }
  }

  db.run(`UPDATE movimentacoes SET peca_id=?,peca_codigo=?,peca_nome=?,peca_unidade=?,peca_fonte=?,peca_custo=?,peca_valor_venda=?,
    qtd=?,equip_id=?,equip_serie=?,equip_cliente=?,equip_modelo=?,tecnico=?,obs=? WHERE id=?`,
    [m.peca_id ?? sol.peca_id, m.peca_codigo ?? sol.peca_codigo, m.peca_nome ?? sol.peca_nome, m.peca_unidade ?? sol.peca_unidade,
     m.peca_fonte ?? sol.peca_fonte, m.peca_custo ?? sol.peca_custo, m.peca_valor_venda ?? sol.peca_valor_venda,
     m.qtd ?? sol.qtd, m.equip_id ?? sol.equip_id, m.equip_serie ?? sol.equip_serie, m.equip_cliente ?? sol.equip_cliente,
     m.equip_modelo ?? sol.equip_modelo, m.tecnico ?? sol.tecnico, m.obs ?? sol.obs, req.params.id]);

  res.json({ ok: true, estoqueAjustado: estoqueJaBaixado && (pecaMudou || qtdMudou) });
});

router.put('/movimentacoes/:id/acao', autenticar, (req, res) => {
  try {
  const {acao,obs,transporte,rastreio,previsao_entrega,data_recebimento,hora_recebimento,valor_frete,fotos_despacho,fotos_recebimento,fotos_devolucao,devolucao,motivo_devolucao}=req.body;
  const sol=db.get('SELECT * FROM movimentacoes WHERE id=?',[req.params.id]);
  if (!sol) return res.status(404).json({erro:'Não encontrada'});
  const eventos=P(sol.eventos);
  const addEv=(st,extra='')=>eventos.push({status:st,data:now(),obs:[obs||'',extra].filter(Boolean).join(' | '),user:req.user.nome});
  const upd={eventos:J(eventos)};

  // Cria a movimentação de devolução (mesma lógica usada em FINALIZAR),
  // reaproveitada também pelo RECEBER — no mobile a devolução é sinalizada
  // já na hora de confirmar o recebimento, não só ao finalizar.
  const criarDevolucao = (origemLabel, fotos) => {
    const uid2=()=>Math.random().toString(36).slice(2,14);
    const retId=uid2();
    const retSeq=(db.get('SELECT MAX(seq_num) as m FROM movimentacoes')?.m||0)+1;
    const retEvt=JSON.stringify([{status:'SOLICITADA',data:Date.now(),obs:'Devolucao solicitada '+origemLabel+'. Motivo: '+(motivo_devolucao||'Peca defeituosa'),user:req.user.nome}]);
    db.run(`INSERT INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_custo,peca_valor_venda,qtd,equip_serie,tecnico,tem_estoque,tipo_alocacao,obs,eventos,fotos_devolucao,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [retId,retSeq,'SOLICITADA',sol.peca_id,sol.peca_codigo,sol.peca_nome,sol.peca_unidade,sol.peca_custo||0,sol.peca_valor_venda||0,sol.qtd,sol.equip_serie,sol.tecnico,0,'RETORNO','REF:'+sol.seq_num+'|'+(motivo_devolucao||'Devolucao de peca defeituosa'),retEvt,J(fotos||[]),Date.now(),req.user.id]);
  };

  if (acao==='ENVIAR') {
    if (!sol.tem_estoque) { upd.status='COMPRA_PENDENTE'; addEv('COMPRA_PENDENTE'); }
    else {
      db.run('UPDATE estoque SET quantidade=MAX(0,quantidade-?),updated_at=? WHERE peca_id=?',[sol.qtd,now(),sol.peca_id]);
      upd.status='ENVIADA'; addEv('ENVIADA');
    }
  } else if (acao==='DESPACHAR') {
    if (!transporte) return res.status(400).json({erro:'Transporte obrigatório'});
    upd.status='DESPACHADA'; upd.transportadora=transporte; upd.rastreio=rastreio||''; upd.previsao_entrega=previsao_entrega||''; upd.valor_frete=parseFloat(valor_frete)||0;
    if (fotos_despacho !== undefined) upd.fotos_despacho=J(fotos_despacho||[]);
    addEv('DESPACHADA',`Transporte: ${transporte}${rastreio?' · '+rastreio:''}`);
  } else if (acao==='RECEBER') {
    if (!data_recebimento||!hora_recebimento) return res.status(400).json({erro:'Data e hora obrigatórios'});
    upd.status='RECEBIDA'; upd.data_recebimento=data_recebimento; upd.hora_recebimento=hora_recebimento;
    if (fotos_recebimento !== undefined) upd.fotos_recebimento=J(fotos_recebimento||[]);
    addEv('RECEBIDA',`Recebido em ${data_recebimento} às ${hora_recebimento}`);
    // Se o técnico já sinalizou defeito/devolução no momento do recebimento
    // (fluxo do mobile), cria a movimentação de devolução aqui mesmo, com
    // as fotos que ele tirou da peça com problema.
    if (devolucao) criarDevolucao('no recebimento (mobile)', fotos_devolucao);
  } else if (acao==='ALOCAR') {
    const {tipo_alocacao,os_num}=req.body;
    upd.status='ALOCADA'; upd.tipo_alocacao=tipo_alocacao||'INSTALACAO';
    addEv('ALOCADA','Tipo: '+(tipo_alocacao||'INSTALACAO')+(os_num?' | OS: '+os_num:''));
  } else if (acao==='EMITIR_NF') {
    const {nf_numero,nf_data}=req.body;
    upd.status='NF_EMITIDA';
    addEv('NF_EMITIDA','NF: '+(nf_numero||'')+(nf_data?' · '+nf_data:''));
  } else if (acao==='FINALIZAR') {
    upd.status='FINALIZADO'; addEv('FINALIZADO');
    if (devolucao) criarDevolucao('pelo desktop', fotos_devolucao);
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
  // boleto_arquivo/nota_arquivo (base64) ficam de fora da listagem — podem
  // ser pesados e a lista precisa carregar rápido. Só o nome do arquivo vai
  // junto, pra UI mostrar que tem anexo; o conteúdo é buscado sob demanda
  // em /orcamentos/:id/anexos, na hora de baixar.
  res.json(db.query(sql+' ORDER BY created_at DESC',p).map(o=>{
    const {boleto_arquivo, nota_arquivo, ...resto} = o;
    return {...resto,itens:P(o.itens),itens_opcionais:P(o.itens_opcionais)||[],equipamentos:P(o.equipamentos)||[]};
  }));
});

router.get('/orcamentos/:id/anexos', autenticar, (req, res) => {
  const o = db.get('SELECT boleto_arquivo, boleto_nome, nota_arquivo, nota_nome FROM orcamentos WHERE id=?', [req.params.id]);
  if (!o) return res.status(404).json({erro:'Não encontrado'});
  res.json(o);
});

router.post('/orcamentos', autenticar, (req, res) => {
  const o=req.body; if (!o.numero) return res.status(400).json({erro:'Número obrigatório'});
  const id=uid();
  const total=(o.itens||[]).reduce((s,it)=>s+(it.qtd||0)*(parseFloat(it.valor)||0),0);
  db.run(`INSERT INTO orcamentos(id,numero,status,cliente,cnpj,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,obs_condicoes,condicoes,assinatura,total,itens,itens_opcionais,tipo_nf,boleto_arquivo,boleto_nome,nota_arquivo,nota_nome,solicitacao_id,created_at,created_by,status_changed_at,equipamentos,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id,o.numero,o.status||'ABERTO',o.cliente||'',o.cnpj||'',o.equip_serie||'',o.equip_nome||'',o.os||'',
     o.data||'',o.obs||'',o.validade||'7 dias',o.pagamento||'30 dias',o.entrega||'A combinar',
     o.frete||'FOB',o.obs_condicoes||'',o.condicoes||'',o.assinatura||req.user.nome,
     total,J(o.itens||[]),J(o.itens_opcionais||[]),o.tipo_nf||'',o.boleto_arquivo||'',o.boleto_nome||'',o.nota_arquivo||'',o.nota_nome||'',
     o.solicitacao_id||'',now(),req.user.id,now(),J(o.equipamentos||[]),now()]);
  if (o.cliente && o.cnpj) salvarCnpjCliente(o.cliente, o.cnpj);
  res.status(201).json({id});
});

router.put('/orcamentos/:id', autenticar, (req, res) => {
  const o=req.body;
  const total=(o.itens||[]).reduce((s,it)=>s+(it.qtd||0)*(parseFloat(it.valor)||0),0);
  const existente = db.get('SELECT status, boleto_arquivo, nota_arquivo FROM orcamentos WHERE id=?', [req.params.id]);
  const statusMudou = existente && existente.status !== (o.status||'ABERTO');
  const tinhaAmbosAnexosAntes = !!(existente && existente.boleto_arquivo && existente.nota_arquivo);
  const temAmbosAnexosAgora = !!(o.boleto_arquivo && o.nota_arquivo);
  const anexosCompletaramAgora = !tinhaAmbosAnexosAntes && temAmbosAnexosAgora;
  db.run(`UPDATE orcamentos SET numero=?,status=?,cliente=?,cnpj=?,equip_serie=?,equip_nome=?,os=?,data=?,obs=?,
    validade=?,pagamento=?,entrega=?,frete=?,obs_condicoes=?,condicoes=?,assinatura=?,total=?,itens=?,itens_opcionais=?,tipo_nf=?,
    boleto_arquivo=?,boleto_nome=?,nota_arquivo=?,nota_nome=?,equipamentos=?,updated_at=? WHERE id=?`,
    [o.numero,o.status||'ABERTO',o.cliente||'',o.cnpj||'',o.equip_serie||'',o.equip_nome||'',o.os||'',o.data||'',
     o.obs||'',o.validade||'7 dias',o.pagamento||'30 dias',o.entrega||'A combinar',o.frete||'FOB',
     o.obs_condicoes||'',o.condicoes||'',o.assinatura||'',total,J(o.itens||[]),J(o.itens_opcionais||[]),o.tipo_nf||'',
     o.boleto_arquivo||'',o.boleto_nome||'',o.nota_arquivo||'',o.nota_nome||'',J(o.equipamentos||[]),now(),req.params.id]);
  if (statusMudou) db.run('UPDATE orcamentos SET status_changed_at=? WHERE id=?', [now(), req.params.id]);
  if (o.cliente && o.cnpj) salvarCnpjCliente(o.cliente, o.cnpj);
  if (statusMudou) notificarStatusOrcamento(req.params.id, o.status);
  if (anexosCompletaramAgora) notificarAnexosCompletos(req.params.id);
  res.json({ok:true});
});

router.put('/orcamentos/:id/status', autenticar, isAdmin, (req, res) => {
  const existente = db.get('SELECT status FROM orcamentos WHERE id=?', [req.params.id]);
  const statusMudou = existente && existente.status !== req.body.status;
  db.run('UPDATE orcamentos SET status=?,status_changed_at=?,updated_at=? WHERE id=?',[req.body.status,now(),now(),req.params.id]);
  if (statusMudou && existente) notificarStatusOrcamento(req.params.id, req.body.status);
  res.json({ok:true});
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

// -- GARANTIA: prazos por marca/fabricante --
router.get('/garantia-config', autenticar, (req, res) => {
  res.json(db.query('SELECT * FROM garantia_config ORDER BY marca'));
});
router.post('/garantia-config', autenticar, isAdmin, (req, res) => {
  const g = req.body; if (!g.marca) return res.status(400).json({erro:'Marca obrigatória'});
  db.run(`INSERT OR REPLACE INTO garantia_config(marca,anos_equipamento,anos_acessorio,obs,updated_at) VALUES(?,?,?,?,?)`,
    [g.marca.toUpperCase().trim(), g.anos_equipamento||0, g.anos_acessorio||0, g.obs||'', now()]);
  res.status(201).json({ok:true});
});
router.delete('/garantia-config/:marca', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM garantia_config WHERE marca=?', [req.params.marca]); res.json({ok:true});
});

// Importação em lote (planilha exportada da aba Garantia, editada): atualiza
// Data de Compra e/ou Marca dos equipamentos da Empresa casando por Série
// (+ Modelo quando a série se repete). Não apaga dados: célula vazia = não
// mexe. Um único persist() no final (nunca persistir a cada linha).
router.post('/garantia/importar', autenticar, isAdmin, (req, res) => {
  const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
  const norm = s => String(s == null ? '' : s).trim().toUpperCase();
  const porSerie = {};
  db.query('SELECT id, modelo, serie, marca, campos FROM equipamentos').forEach(e => {
    let campos = {}; try { campos = JSON.parse(e.campos || '{}'); } catch (x) { campos = {}; }
    if ((campos.proprietario || '').trim() !== 'Empresa') return;
    const k = norm(e.serie); if (!k) return;
    (porSerie[k] = porSerie[k] || []).push({ ...e, campos });
  });
  let atualizados = 0, semAlteracao = 0, naoEncontrados = 0, ambiguos = 0;
  for (const it of itens) {
    let alvo = porSerie[norm(it.serie)] || [];
    if (alvo.length > 1 && it.modelo) {
      const porModelo = alvo.filter(c => norm(c.modelo) === norm(it.modelo));
      if (porModelo.length) alvo = porModelo;
    }
    if (!alvo.length) { naoEncontrados++; continue; }
    if (alvo.length > 1) { ambiguos++; continue; }
    const eq = alvo[0];
    const novaData = String(it.data_compra || '').trim();
    let novaMarca = norm(it.marca);
    if (novaMarca === 'NÃO IDENTIFICADO') novaMarca = '';
    const campos = { ...eq.campos };
    let mudou = false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(novaData) && campos.data_compra !== novaData) { campos.data_compra = novaData; mudou = true; }
    let marcaFinal = eq.marca;
    if (novaMarca && norm(eq.marca) !== novaMarca) { marcaFinal = novaMarca; mudou = true; }
    if (!mudou) { semAlteracao++; continue; }
    db.runBatch('UPDATE equipamentos SET marca=?, campos=? WHERE id=?', [marcaFinal, JSON.stringify(campos), eq.id]);
    atualizados++;
  }
  db.persist();
  res.json({ ok: true, atualizados, semAlteracao, naoEncontrados, ambiguos });
});

// -- VALIDAÇÃO DE EQUIPAMENTO (pipeline Repair -> Assessoria -> Concluído) --
// ── Prazos de validação por modelo (puxados automaticamente ao incluir um
// equipamento no Repair) ──
const normalizarModeloPrazo = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function buscarPrazoPorModelo(modeloEquip) {
  const norm = normalizarModeloPrazo(modeloEquip);
  if (!norm) return null;
  const todos = db.query('SELECT * FROM prazos_validacao');
  // 1) match exato
  const exato = todos.find(p => p.modelo_norm === norm);
  if (exato) return exato;
  // 2) por substring — só considera modelos com pelo menos 4 caracteres
  //    normalizados, pra códigos curtos (ex.: "Q") não "casarem" com
  //    qualquer texto que contenha aquela letra. Entre vários candidatos,
  //    prefere o mais específico (modelo_norm mais longo — ex.: "HMG51VET"
  //    antes de "HMG51", se o texto do equipamento mencionar os dois).
  const candidatos = todos.filter(p =>
    p.modelo_norm && p.modelo_norm.length >= 4 &&
    (norm.includes(p.modelo_norm) || p.modelo_norm.includes(norm))
  );
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => b.modelo_norm.length - a.modelo_norm.length);
  return candidatos[0];
}
function somarDias(dataMs, dias) {
  const d = new Date(dataMs);
  d.setDate(d.getDate() + Math.round(dias));
  return d.toISOString().slice(0, 10);
}

router.get('/prazos-validacao', autenticar, (req, res) => {
  res.json(db.query('SELECT * FROM prazos_validacao ORDER BY marca, modelo'));
});
router.get('/prazos-validacao/buscar', autenticar, (req, res) => {
  const p = buscarPrazoPorModelo(req.query.modelo || '');
  res.json(p || null);
});
router.post('/prazos-validacao', autenticar, isAdmin, (req, res) => {
  const p = req.body;
  if (!p.modelo) return res.status(400).json({ erro: 'Modelo obrigatório' });
  const modeloNorm = normalizarModeloPrazo(p.modelo);
  const existente = db.get('SELECT id FROM prazos_validacao WHERE modelo_norm=?', [modeloNorm]);
  const id = existente?.id || uid();
  db.run(`INSERT OR REPLACE INTO prazos_validacao(id,marca,modelo,modelo_norm,complexidade,dias_reforma,dias_teste,dias_embalagem,prazo_final,tolerancia,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id, p.marca || '', p.modelo, modeloNorm, p.complexidade || '', p.dias_reforma || 0, p.dias_teste || 0,
     p.dias_embalagem || 0, p.prazo_final || 0, p.tolerancia || 0, now()]);
  res.status(201).json({ id });
});
router.delete('/prazos-validacao/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM prazos_validacao WHERE id=?', [req.params.id]); res.json({ ok: true });
});

router.get('/validacoes', autenticar, (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM validacoes_equipamento WHERE 1=1'; const p = [];
  if (status) { sql += ' AND status=?'; p.push(status); }
  if (q) { sql += ' AND (equip_serie LIKE ? OR equip_modelo LIKE ? OR equip_cliente LIKE ?)'; p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  // O conteúdo das fotos (base64) fica de fora da listagem — só a
  // quantidade, pra UI mostrar o indicador sem pesar o carregamento. O
  // conteúdo é buscado sob demanda em /validacoes/:id/fotos.
  res.json(db.query(sql + ' ORDER BY created_at DESC', p).map(v => {
    const fotos = P(v.fotos);
    const { fotos: _omit, ...resto } = v;
    return { ...resto, eventos: P(v.eventos), fotos_qtd: fotos.length };
  }));
});

router.get('/validacoes/:id/fotos', autenticar, (req, res) => {
  const v = db.get('SELECT fotos FROM validacoes_equipamento WHERE id=?', [req.params.id]);
  if (!v) return res.status(404).json({ erro: 'Não encontrado' });
  res.json({ fotos: P(v.fotos) });
});

router.post('/validacoes', autenticar, (req, res) => {
  const v = req.body;
  if (!v.equip_serie && !v.equip_modelo) return res.status(400).json({ erro: 'Informe ao menos a série ou o modelo do equipamento' });
  const cfg = db.get("SELECT valor FROM configuracoes WHERE chave='validacao_seq_counter'");
  const seq = parseInt(cfg?.valor || '0') + 1;
  if (cfg) db.run("UPDATE configuracoes SET valor=? WHERE chave='validacao_seq_counter'", [String(seq)]);
  else db.run("INSERT INTO configuracoes(chave,valor) VALUES('validacao_seq_counter',?)", [String(seq)]);
  const id = uid();
  const eventos = J([{ status: 'REPAIR', data: now(), obs: v.obs || '', user: req.user.nome }]);

  // Puxa o prazo de validação pelo modelo do equipamento (planilha de
  // prazos por modelo) — vira um retrato: não muda se a config for editada
  // depois. Data-limite = hoje + prazo final (dias).
  const prazo = buscarPrazoPorModelo(v.equip_modelo);
  const prazoDias = prazo?.prazo_final || 0;
  const prazoTolerancia = prazo?.tolerancia || 0;
  const prazoComplexidade = prazo?.complexidade || '';
  const dataLimite = prazoDias > 0 ? somarDias(now(), prazoDias) : '';

  db.run(`INSERT INTO validacoes_equipamento(id,seq_num,equip_id,equip_serie,equip_modelo,equip_cliente,status,obs,eventos,
    peca_solicitada,data_solicitacao_peca,data_entrega_peca,produto_solicitado,data_solicitacao_produto,data_entrega_produto,
    fotos,prazo_dias,prazo_tolerancia,prazo_complexidade,data_limite,data_limite_original,tecnico_responsavel,os_numero,origem,created_at,created_by,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, seq, v.equip_id || '', v.equip_serie || '', v.equip_modelo || '', v.equip_cliente || '', 'REPAIR', v.obs || '', eventos,
     v.peca_solicitada || '', v.data_solicitacao_peca || '', v.data_entrega_peca || '',
     v.produto_solicitado || '', v.data_solicitacao_produto || '', v.data_entrega_produto || '',
     J(v.fotos || []), prazoDias, prazoTolerancia, prazoComplexidade, dataLimite, dataLimite, v.tecnico_responsavel || '',
     v.os_numero || '', v.origem || '', now(), req.user.nome, now()]);
  res.status(201).json({ id, seq_num: seq, prazo: prazo ? { modelo: prazo.modelo, dias: prazoDias, complexidade: prazoComplexidade, dataLimite } : null });
});

router.put('/validacoes/:id', autenticar, (req, res) => {
  const v = req.body;
  db.run(`UPDATE validacoes_equipamento SET equip_serie=?,equip_modelo=?,equip_cliente=?,obs=?,
    peca_solicitada=?,data_solicitacao_peca=?,data_entrega_peca=?,
    produto_solicitado=?,data_solicitacao_produto=?,data_entrega_produto=?,
    fotos=?,tecnico_responsavel=?,os_numero=?,origem=?,updated_at=? WHERE id=?`,
    [v.equip_serie || '', v.equip_modelo || '', v.equip_cliente || '', v.obs || '',
     v.peca_solicitada || '', v.data_solicitacao_peca || '', v.data_entrega_peca || '',
     v.produto_solicitado || '', v.data_solicitacao_produto || '', v.data_entrega_produto || '',
     J(v.fotos || []), v.tecnico_responsavel || '', v.os_numero || '', v.origem || '', now(), req.params.id]);
  res.json({ ok: true });
});

// Ajusta manualmente a data-limite (e, opcionalmente, a data de entrada) de
// um equipamento. Essencial pra quem entrou SEM prazo automático (modelo
// não configurado na planilha de prazos) — aqui dá pra definir entrada e
// saída na mão. Compara sempre com data_limite_original (o prazo calculado
// no dia em que entrou, ou vazio se nunca teve um automático) pra saber
// quantos dias a mais foram adicionados, e registra isso no histórico.
router.put('/validacoes/:id/ajustar-prazo', autenticar, (req, res) => {
  const { nova_data_limite, nova_data_entrada, motivo } = req.body;
  if (nova_data_limite && !/^\d{4}-\d{2}-\d{2}$/.test(nova_data_limite)) return res.status(400).json({ erro: 'Data de saída inválida' });
  if (nova_data_entrada && !/^\d{4}-\d{2}-\d{2}$/.test(nova_data_entrada)) return res.status(400).json({ erro: 'Data de entrada inválida' });
  const existente = db.get('SELECT data_limite, data_limite_original, created_at, eventos FROM validacoes_equipamento WHERE id=?', [req.params.id]);
  if (!existente) return res.status(404).json({ erro: 'Não encontrado' });

  let eventos = []; try { eventos = JSON.parse(existente.eventos || '[]'); } catch (e) { eventos = []; }
  let diffDias = 0;
  const sets = [], params = [];

  if (nova_data_limite) {
    const base = existente.data_limite_original || existente.data_limite;
    diffDias = base ? Math.round((new Date(nova_data_limite) - new Date(base)) / 86400000) : 0;
    const obsEvento = `Prazo (saída) ajustado de ${existente.data_limite || '(sem prazo)'} para ${nova_data_limite}` +
      (diffDias !== 0 ? ` (${diffDias > 0 ? '+' : ''}${diffDias}d em relação ao prazo original)` : '') +
      (motivo ? `. Motivo: ${motivo}` : '');
    eventos.push({ status: 'PRAZO_AJUSTADO', data: now(), obs: obsEvento, user: req.user.nome });
    sets.push('data_limite=?'); params.push(nova_data_limite);
    // Se nunca teve prazo automático, esta data definida na mão vira a
    // referência (data_limite_original) pra futuros ajustes compararem contra.
    if (!existente.data_limite_original) { sets.push('data_limite_original=?'); params.push(nova_data_limite); }
  }
  if (nova_data_entrada) {
    const entradaMs = new Date(nova_data_entrada + 'T00:00:00').getTime();
    const entradaAntigaFmt = new Date(existente.created_at).toLocaleDateString('pt-BR');
    eventos.push({ status: 'ENTRADA_AJUSTADA', data: now(), obs: `Data de entrada ajustada de ${entradaAntigaFmt} para ${new Date(entradaMs).toLocaleDateString('pt-BR')}`, user: req.user.nome });
    sets.push('created_at=?'); params.push(entradaMs);
  }
  if (!sets.length) return res.status(400).json({ erro: 'Informe ao menos uma data' });

  sets.push('eventos=?'); params.push(J(eventos));
  sets.push('updated_at=?'); params.push(now());
  params.push(req.params.id);
  db.run(`UPDATE validacoes_equipamento SET ${sets.join(',')} WHERE id=?`, params);
  res.json({ ok: true, diffDias });
});

// Avança para a próxima etapa do pipeline: REPAIR -> ASSESSORIA -> CONCLUIDO.
// Grava o evento (com observação da etapa que está sendo concluída) no
// histórico, pra manter rastreabilidade completa do processo.
router.put('/validacoes/:id/avancar', autenticar, (req, res) => {
  const existente = db.get('SELECT status, eventos FROM validacoes_equipamento WHERE id=?', [req.params.id]);
  if (!existente) return res.status(404).json({ erro: 'Não encontrado' });
  const proximo = { REPAIR: 'ASSESSORIA', ASSESSORIA: 'CONCLUIDO' }[existente.status];
  if (!proximo) return res.status(400).json({ erro: 'Este item já está concluído' });
  let eventos = []; try { eventos = JSON.parse(existente.eventos || '[]'); } catch (e) { eventos = []; }
  eventos.push({ status: proximo, data: now(), obs: req.body.obs || '', user: req.user.nome });
  db.run('UPDATE validacoes_equipamento SET status=?,eventos=?,updated_at=? WHERE id=?',
    [proximo, J(eventos), now(), req.params.id]);
  res.json({ ok: true, status: proximo });
});

router.put('/validacoes/:id/voltar', autenticar, (req, res) => {
  const existente = db.get('SELECT status, eventos FROM validacoes_equipamento WHERE id=?', [req.params.id]);
  if (!existente) return res.status(404).json({ erro: 'Não encontrado' });
  const anterior = { ASSESSORIA: 'REPAIR', CONCLUIDO: 'ASSESSORIA' }[existente.status];
  if (!anterior) return res.status(400).json({ erro: 'Este item já está na primeira etapa' });
  let eventos = []; try { eventos = JSON.parse(existente.eventos || '[]'); } catch (e) { eventos = []; }
  eventos.push({ status: anterior, data: now(), obs: 'Retornado: ' + (req.body.obs || ''), user: req.user.nome });
  db.run('UPDATE validacoes_equipamento SET status=?,eventos=?,updated_at=? WHERE id=?',
    [anterior, J(eventos), now(), req.params.id]);
  res.json({ ok: true, status: anterior });
});

router.delete('/validacoes/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM validacoes_equipamento WHERE id=?', [req.params.id]); res.json({ ok: true });
});

// Importação em lote (planilha exportada de Validação Repair/Assessoria,
// editada): casa por Nº — se achar, atualiza os campos de peça/produto/obs
// (nunca mexe no status/etapa, isso só muda pelos botões de avançar/voltar);
// se não achar e a linha não tiver Nº mas tiver Série ou Modelo, cria um
// item novo já na etapa Repair. Célula vazia = não mexe. Um só persist().
router.post('/validacoes/importar', autenticar, isAdmin, (req, res) => {
  const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
  const porSeq = {};
  db.query('SELECT * FROM validacoes_equipamento').forEach(v => { if (v.seq_num) porSeq[v.seq_num] = v; });
  const cfg0 = db.get("SELECT valor FROM configuracoes WHERE chave='validacao_seq_counter'");
  let seqCounter = parseInt(cfg0?.valor || '0');

  let atualizados = 0, criados = 0, naoEncontrados = 0;
  for (const it of itens) {
    const seqNum = parseInt(it.seq_num) || 0;
    const existente = seqNum ? porSeq[seqNum] : null;

    if (existente) {
      const equip_serie = it.equip_serie !== undefined && it.equip_serie !== '' ? it.equip_serie : existente.equip_serie;
      const equip_modelo = it.equip_modelo !== undefined && it.equip_modelo !== '' ? it.equip_modelo : existente.equip_modelo;
      const equip_cliente = it.equip_cliente !== undefined && it.equip_cliente !== '' ? it.equip_cliente : existente.equip_cliente;
      const obs = it.obs !== undefined && it.obs !== '' ? it.obs : existente.obs;
      const peca_solicitada = it.peca_solicitada !== undefined && it.peca_solicitada !== '' ? it.peca_solicitada : existente.peca_solicitada;
      const data_solicitacao_peca = it.data_solicitacao_peca || existente.data_solicitacao_peca;
      const data_entrega_peca = it.data_entrega_peca || existente.data_entrega_peca;
      const produto_solicitado = it.produto_solicitado !== undefined && it.produto_solicitado !== '' ? it.produto_solicitado : existente.produto_solicitado;
      const data_solicitacao_produto = it.data_solicitacao_produto || existente.data_solicitacao_produto;
      const data_entrega_produto = it.data_entrega_produto || existente.data_entrega_produto;
      const tecnico_responsavel = it.tecnico_responsavel !== undefined && it.tecnico_responsavel !== '' ? it.tecnico_responsavel : existente.tecnico_responsavel;
      const os_numero = it.os_numero !== undefined && it.os_numero !== '' ? it.os_numero : existente.os_numero;
      const origem = it.origem !== undefined && it.origem !== '' ? it.origem : existente.origem;
      db.runBatch(`UPDATE validacoes_equipamento SET equip_serie=?,equip_modelo=?,equip_cliente=?,obs=?,
        peca_solicitada=?,data_solicitacao_peca=?,data_entrega_peca=?,
        produto_solicitado=?,data_solicitacao_produto=?,data_entrega_produto=?,tecnico_responsavel=?,os_numero=?,origem=?,updated_at=? WHERE id=?`,
        [equip_serie, equip_modelo, equip_cliente, obs, peca_solicitada, data_solicitacao_peca, data_entrega_peca,
         produto_solicitado, data_solicitacao_produto, data_entrega_produto, tecnico_responsavel, os_numero, origem, now(), existente.id]);
      atualizados++;
    } else if (!seqNum && (it.equip_serie || it.equip_modelo)) {
      seqCounter++;
      const id = uid();
      const eventos = J([{ status: 'REPAIR', data: now(), obs: it.obs || '', user: req.user.nome }]);
      const prazoImp = buscarPrazoPorModelo(it.equip_modelo);
      const prazoDiasImp = prazoImp?.prazo_final || 0;
      const dataLimiteImp = prazoDiasImp > 0 ? somarDias(now(), prazoDiasImp) : '';
      db.runBatch(`INSERT INTO validacoes_equipamento(id,seq_num,equip_id,equip_serie,equip_modelo,equip_cliente,status,obs,eventos,
        peca_solicitada,data_solicitacao_peca,data_entrega_peca,produto_solicitado,data_solicitacao_produto,data_entrega_produto,
        prazo_dias,prazo_tolerancia,prazo_complexidade,data_limite,data_limite_original,tecnico_responsavel,os_numero,origem,
        created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, seqCounter, '', it.equip_serie || '', it.equip_modelo || '', it.equip_cliente || '', 'REPAIR', it.obs || '', eventos,
         it.peca_solicitada || '', it.data_solicitacao_peca || '', it.data_entrega_peca || '',
         it.produto_solicitado || '', it.data_solicitacao_produto || '', it.data_entrega_produto || '',
         prazoDiasImp, prazoImp?.tolerancia || 0, prazoImp?.complexidade || '', dataLimiteImp, dataLimiteImp, it.tecnico_responsavel || '',
         it.os_numero || '', it.origem || '',
         now(), req.user.nome, now()]);
      criados++;
    } else {
      naoEncontrados++;
    }
  }
  if (criados) db.runBatch("INSERT OR REPLACE INTO configuracoes(chave,valor) VALUES('validacao_seq_counter',?)", [String(seqCounter)]);
  db.persist();
  res.json({ ok: true, atualizados, criados, naoEncontrados });
});

// -- EQUIP. QUALLYX SP --
const EQSP_STATUS = ['NOVO', 'USADO_FUNCIONANDO', 'USADO_AVALIAR', 'EM_REFORMA', 'DOADORA'];
router.get('/equip-quallyx-sp', autenticar, (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM equip_quallyx_sp WHERE 1=1'; const p = [];
  if (status) { sql += ' AND status=?'; p.push(status); }
  if (q) { sql += ' AND (nome LIKE ? OR marca LIKE ? OR serie LIKE ?)'; p.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  // Contagem de peças retiradas (movimentações que apontam esse equipamento
  // como origem da peça usada), pra mostrar o indicador "X retirada(s)" —
  // e a última peça retirada, pra já aparecer direto no card sem precisar
  // clicar (histórico de retiradas por equipamento visível de cara).
  const contagens = {};
  db.query("SELECT retirada_eqsp_id, COUNT(*) as n FROM movimentacoes WHERE retirada_eqsp_id != '' GROUP BY retirada_eqsp_id")
    .forEach(r => { contagens[r.retirada_eqsp_id] = r.n; });
  const ultimas = {};
  db.query("SELECT retirada_eqsp_id, peca_nome, created_at FROM movimentacoes WHERE retirada_eqsp_id != '' ORDER BY created_at DESC")
    .forEach(r => { if (!ultimas[r.retirada_eqsp_id]) ultimas[r.retirada_eqsp_id] = { peca_nome: r.peca_nome, data: r.created_at }; });
  // A imagem (base64) fica de fora da listagem, só um booleano — o
  // conteúdo é buscado sob demanda em /equip-quallyx-sp/:id/imagem.
  res.json(db.query(sql + ' ORDER BY created_at DESC', p).map(e => {
    const { imagem, ...resto } = e;
    return { ...resto, tem_imagem: !!imagem, retiradas_qtd: contagens[e.id] || 0, ultima_retirada: ultimas[e.id] || null };
  }));
});
router.get('/equip-quallyx-sp/:id/imagem', autenticar, (req, res) => {
  const e = db.get('SELECT imagem FROM equip_quallyx_sp WHERE id=?', [req.params.id]);
  if (!e) return res.status(404).json({ erro: 'Não encontrado' });
  res.json({ imagem: e.imagem || '' });
});
router.get('/equip-quallyx-sp/:id/retiradas', autenticar, (req, res) => {
  const lista = db.query(`SELECT seq_num, peca_codigo, peca_nome, qtd, equip_serie, equip_cliente, tecnico, created_at
    FROM movimentacoes WHERE retirada_eqsp_id=? ORDER BY created_at DESC`, [req.params.id]);
  res.json(lista);
});
router.post('/equip-quallyx-sp', autenticar, (req, res) => {
  const e = req.body;
  if (!e.nome) return res.status(400).json({ erro: 'Nome do equipamento obrigatório' });
  const id = uid();
  const status = EQSP_STATUS.includes(e.status) ? e.status : 'NOVO';
  db.run(`INSERT INTO equip_quallyx_sp(id,nome,marca,serie,status,obs,imagem,posicao,created_at,created_by,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [id, e.nome, e.marca || '', e.serie || '', status, e.obs || '', e.imagem || '', e.posicao || '', now(), req.user.nome, now()]);
  res.status(201).json({ id });
});
router.put('/equip-quallyx-sp/:id', autenticar, (req, res) => {
  const e = req.body;
  const status = EQSP_STATUS.includes(e.status) ? e.status : 'NOVO';
  db.run(`UPDATE equip_quallyx_sp SET nome=?,marca=?,serie=?,status=?,obs=?,imagem=?,posicao=?,updated_at=? WHERE id=?`,
    [e.nome || '', e.marca || '', e.serie || '', status, e.obs || '', e.imagem || '', e.posicao || '', now(), req.params.id]);
  res.json({ ok: true });
});
// Ajuste rápido só da posição/localização no estoque, direto pelo card
// (sem precisar abrir o modal completo de edição).
router.put('/equip-quallyx-sp/:id/posicao', autenticar, (req, res) => {
  db.run('UPDATE equip_quallyx_sp SET posicao=?,updated_at=? WHERE id=?', [req.body.posicao || '', now(), req.params.id]);
  res.json({ ok: true });
});
router.delete('/equip-quallyx-sp/:id', autenticar, isAdmin, (req, res) => {
  db.run('DELETE FROM equip_quallyx_sp WHERE id=?', [req.params.id]); res.json({ ok: true });
});

// Importação em lote (planilha). Casa por nome+série (se ambos baterem,
// atualiza; senão cria novo). Célula vazia não apaga dado existente.
const EQSP_STATUS_LABELS_IMPORT = {
  'NOVO': 'NOVO',
  'USADO FUNCIONANDO': 'USADO_FUNCIONANDO', 'USADO_FUNCIONANDO': 'USADO_FUNCIONANDO',
  'USADO A AVALIAR': 'USADO_AVALIAR', 'USADO_AVALIAR': 'USADO_AVALIAR',
  'EM REFORMA': 'EM_REFORMA', 'EM_REFORMA': 'EM_REFORMA',
  'DOADORA DE PEÇAS': 'DOADORA', 'DOADORA DE PECAS': 'DOADORA', 'DOADORA': 'DOADORA',
};
router.post('/equip-quallyx-sp/importar', autenticar, isAdmin, (req, res) => {
  const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
  const norm = s => String(s || '').trim().toUpperCase();
  const existentes = db.query('SELECT * FROM equip_quallyx_sp');
  let criados = 0, atualizados = 0;
  for (const it of itens) {
    if (!it.nome) continue;
    const match = existentes.find(e => norm(e.nome) === norm(it.nome) && norm(e.serie) === norm(it.serie || ''));
    const status = EQSP_STATUS_LABELS_IMPORT[norm(it.status)] || null;
    if (match) {
      db.runBatch(`UPDATE equip_quallyx_sp SET nome=?,marca=?,serie=?,status=?,obs=?,posicao=?,updated_at=? WHERE id=?`,
        [it.nome, it.marca || match.marca, it.serie || match.serie, status || match.status, it.obs || match.obs, it.posicao || match.posicao, now(), match.id]);
      atualizados++;
    } else {
      const id = uid();
      db.runBatch(`INSERT INTO equip_quallyx_sp(id,nome,marca,serie,status,obs,imagem,posicao,created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [id, it.nome, it.marca || '', it.serie || '', status || 'NOVO', it.obs || '', '', it.posicao || '', now(), req.user.nome, now()]);
      criados++;
      existentes.push({ id, nome: it.nome, serie: it.serie || '', marca: it.marca || '', status: status || 'NOVO', obs: it.obs || '', posicao: it.posicao || '' });
    }
  }
  db.persist();
  res.json({ ok: true, criados, atualizados });
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
    garantia_config: db.query('SELECT * FROM garantia_config'),
    validacoes_equipamento: db.query('SELECT * FROM validacoes_equipamento').map(v=>({...v,eventos:P(v.eventos),fotos:P(v.fotos)})),
    prazos_validacao: db.query('SELECT * FROM prazos_validacao'),
    equip_quallyx_sp: db.query('SELECT * FROM equip_quallyx_sp'),
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
      db.runBatch(`INSERT OR REPLACE INTO movimentacoes(id,seq_num,status,peca_id,peca_codigo,peca_nome,peca_unidade,peca_fonte,peca_custo,qtd,equip_id,equip_serie,equip_cliente,equip_modelo,tecnico,tem_estoque,tipo_alocacao,obs,eventos,fotos_despacho,fotos_recebimento,fotos_devolucao,retirada_eqsp_id,retirada_eqsp_nome,created_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [m.id||uid(),m.seq_num||m.seqNum||0,m.status||'SOLICITADA',m.peca_id||m.pecaId||'',m.peca_codigo||m.pecaCodigo||'',m.peca_nome||m.pecaNome||'',m.peca_unidade||m.pecaUnidade||'UN',m.peca_fonte||m.pecaFonte||'',m.peca_custo||m.pecaCusto||0,m.qtd||1,m.equip_id||m.equipId||'',m.equip_serie||m.equipSerie||'',m.equip_cliente||m.equipCliente||'',m.equip_modelo||m.equipModelo||'',m.tecnico||'',m.tem_estoque||m.temEstoque?1:0,m.tipo_alocacao||m.tipoAlocacao||'',m.obs||'',typeof m.eventos==='string'?m.eventos:J(m.eventos||[]),typeof m.fotos_despacho==='string'?m.fotos_despacho:J(m.fotos_despacho||[]),typeof m.fotos_recebimento==='string'?m.fotos_recebimento:J(m.fotos_recebimento||[]),typeof m.fotos_devolucao==='string'?m.fotos_devolucao:J(m.fotos_devolucao||[]),m.retirada_eqsp_id||'',m.retirada_eqsp_nome||'',m.created_at||m.createdAt||now(),'restore']);

    if (s.orcamentos?.length) for (const o of s.orcamentos)
      db.runBatch(`INSERT OR REPLACE INTO orcamentos(id,numero,status,cliente,cnpj,equip_serie,equip_nome,os,data,obs,validade,pagamento,entrega,frete,condicoes,assinatura,total,itens,itens_opcionais,tipo_nf,boleto_arquivo,boleto_nome,nota_arquivo,nota_nome,equipamentos,created_at,updated_at,status_changed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [o.id||uid(),o.numero||'',o.status||'ABERTO',o.cliente||'',o.cnpj||'',o.equip_serie||o.equipSerie||'',o.equip_nome||o.equipNome||'',o.os||'',o.data||'',o.obs||'',o.validade||'7 dias',o.pagamento||o.formaPagamento||'30 dias',o.entrega||o.prazoEntrega||'A combinar',o.frete||'FOB',o.condicoes||'',o.assinatura||'',o.total||0,J(o.itens||[]),J(o.itens_opcionais||[]),o.tipo_nf||'',o.boleto_arquivo||'',o.boleto_nome||'',o.nota_arquivo||'',o.nota_nome||'',J(o.equipamentos||[]),o.created_at||now(),o.updated_at||now(),o.status_changed_at||now()]);

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

    if (s.garantia_config?.length) for (const g of s.garantia_config)
      db.runBatch(`INSERT OR REPLACE INTO garantia_config(marca,anos_equipamento,anos_acessorio,obs,updated_at) VALUES(?,?,?,?,?)`,
        [g.marca, g.anos_equipamento||0, g.anos_acessorio||0, g.obs||'', g.updated_at||now()]);

    if (s.validacoes_equipamento?.length) for (const v of s.validacoes_equipamento)
      db.runBatch(`INSERT OR REPLACE INTO validacoes_equipamento(id,seq_num,equip_id,equip_serie,equip_modelo,equip_cliente,status,obs,eventos,
        peca_solicitada,data_solicitacao_peca,data_entrega_peca,produto_solicitado,data_solicitacao_produto,data_entrega_produto,
        fotos,prazo_dias,prazo_tolerancia,prazo_complexidade,data_limite,data_limite_original,tecnico_responsavel,os_numero,origem,created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [v.id||uid(), v.seq_num||0, v.equip_id||'', v.equip_serie||'', v.equip_modelo||'', v.equip_cliente||'', v.status||'REPAIR', v.obs||'', J(v.eventos||[]),
         v.peca_solicitada||'', v.data_solicitacao_peca||'', v.data_entrega_peca||'',
         v.produto_solicitado||'', v.data_solicitacao_produto||'', v.data_entrega_produto||'',
         J(v.fotos||[]), v.prazo_dias||0, v.prazo_tolerancia||0, v.prazo_complexidade||'', v.data_limite||'', v.data_limite_original||v.data_limite||'', v.tecnico_responsavel||'',
         v.os_numero||'', v.origem||'',
         v.created_at||now(), v.created_by||'restore', v.updated_at||now()]);

    if (s.prazos_validacao?.length) for (const p of s.prazos_validacao)
      db.runBatch(`INSERT OR REPLACE INTO prazos_validacao(id,marca,modelo,modelo_norm,complexidade,dias_reforma,dias_teste,dias_embalagem,prazo_final,tolerancia,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [p.id||uid(), p.marca||'', p.modelo||'', normalizarModeloPrazo(p.modelo), p.complexidade||'', p.dias_reforma||0, p.dias_teste||0, p.dias_embalagem||0, p.prazo_final||0, p.tolerancia||0, p.updated_at||now()]);

    if (s.equip_quallyx_sp?.length) for (const e of s.equip_quallyx_sp)
      db.runBatch(`INSERT OR REPLACE INTO equip_quallyx_sp(id,nome,marca,serie,status,obs,imagem,posicao,created_at,created_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [e.id||uid(), e.nome||'', e.marca||'', e.serie||'', e.status||'NOVO', e.obs||'', e.imagem||'', e.posicao||'', e.created_at||now(), e.created_by||'restore', e.updated_at||now()]);

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
