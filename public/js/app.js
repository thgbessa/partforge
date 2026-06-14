
// ============================================================
//  DATA STORE
// ============================================================
let db = {
  pecas: [],
  equipamentos: [],
  estoque: {},      // { pecaId: quantidade total }
  depositos: {},    // { pecaId: { 'QUALLYX': 0, 'QUALLYX SC': 0, ... } }
  movimentacoes: [],
  seqCounter: 0,    // contador sequencial de solicitações
  usuarios: [],     // { id, nome, cargo, tel, email, senhaHash }
  orcamentos: [],   // { id, numero, cliente, equipSerie, itens[], status, total, ... }
  doadoras: [],     // { id, modelo, serie, marca, linha, classificacao:'USO'|'SUCATA', fator, obs, createdAt }
  retiradas: [],    // { id, doadId, doadModelo, doadSerie, doadClass, pecaId, pecaCodigo, pecaNome, qtd, custoUnit, custoTotal, tecnico, obs, data }
  pedidos: [],      // { id, numero, data, itens[], status:'ABERTO'|'PARCIAL'|'CONCLUIDO'|'CANCELADO', obs }
  configCompras: {  // configuração global de compras
    diasEstoque: 30,
    periodoAnalise: 90,
    incluiDoadora: 'sim',
    incluiPendente: 'sim',
    diasPorPeca: {}   // { [pecaId]: dias }
  },
  configOrcamento: {  // configuração global de orçamentos
    taxa: 0,
    dolar: 0,
    markup: 0,
    validade: '30 dias',
    prazoEntrega: 'A combinar',
    formaPagamento: '30 dias',
    condicoesGerais: ''
  }
};

let editId = null;

// ============================================================
//  NAVIGATION
// ============================================================
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  el.classList.add('active');

  const titles = {
    dashboard:    ['Dashboard',    '/ visão geral'],
    pecas:        ['Peças',        '/ cadastro'],
    equipamentos: ['Equipamentos', '/ cadastro'],
    estoque:      ['Estoque',      '/ posição atual'],
    movimentacao: ['Movimentação', '/ nova solicitação'],
    historico:    ['Histórico',    '/ solicitações'],
    logistica:    ['Logística',    '/ painel de despacho'],
    orcamento:    ['Orçamentos',   '/ cadastro e faturamento'],
    usuarios:     ['Usuários',     '/ cadastro e permissões'],
  };
  document.getElementById('page-title').textContent = titles[page][0];
  document.getElementById('page-path').textContent = titles[page][1];

  const actionsEl = document.getElementById('topbar-actions');
  actionsEl.innerHTML = '';

  if (page === 'pecas') {
    const isAdmin = podeAcessar('admin');
    actionsEl.innerHTML = `
      ${isAdmin ? `
      <div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:4px 10px">
        <span style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:1px;white-space:nowrap">TAXA</span>
        <input type="number" step="0.01" id="global-taxa" placeholder="1.50"
          style="width:56px;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center"
          value="${window._globalTaxa||''}"
          oninput="aplicarTaxaDolar()" title="Multiplicador de importação/frete (ex: 1.50)">
        <span style="color:var(--border2)">×</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3);white-space:nowrap">US$1 =</span>
        <input type="number" step="0.01" id="global-dolar" placeholder="5.60"
          style="width:56px;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center"
          value="${window._globalDolar||''}"
          oninput="aplicarTaxaDolar()" title="Cotação do dólar em R$ (ex: 5.60)">
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">R$</span>
        <span style="color:var(--border2);margin:0 2px">|</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--green);letter-spacing:1px;white-space:nowrap">MK</span>
        <input type="number" step="0.01" id="global-markup" placeholder="2.00"
          style="width:52px;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center"
          value="${window._globalMarkup||''}"
          oninput="aplicarTaxaDolar()" title="Mark-up para valor de venda (ex: 2.00)">
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">×</span>
      </div>` : ''}
      <button class="btn btn-import" onclick="importarExcel('pecas')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('pecas')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="openModalPeca()">⊕ Nova Peça</button>`;
    renderPecas();
  } else if (page === 'equipamentos') {
    actionsEl.innerHTML = `
      <button class="btn btn-import" onclick="importarExcel('equipamentos')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('equipamentos')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="openModalEquip()">⊕ Novo Equipamento</button>`;
    renderEquipamentos();
  } else if (page === 'estoque') {
    actionsEl.innerHTML = `
      <button class="btn btn-import" onclick="importarExcel('estoque')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('estoque')">⬇ Exportar Excel</button>`;
    renderEstoque();
  } else if (page === 'movimentacao') {
    populateMovSelects();
  } else if (page === 'historico') {
    actionsEl.innerHTML = `<button class="btn btn-excel" onclick="exportarExcel('historico')">⬇ Exportar Excel</button>`;
    renderHistorico();
  } else if (page === 'logistica') {
    renderLogistica('envios');
  } else if (page === 'compras') {
    actionsEl.innerHTML = '';
    renderCompras();
  } else if (page === 'doadoras') {
    actionsEl.innerHTML = `<button class="btn btn-primary" onclick="abrirModalDoadora()">⊕ Nova Doadora</button>`;
    renderDoadoras();
  } else if (page === 'orcamento') {
    actionsEl.innerHTML = `
      <button class="btn btn-ghost" onclick="abrirConfigOrcamento()" title="Configurar condições gerais e taxa/markup">⚙ Configurar</button>
      <button class="btn btn-excel" onclick="exportarExcel('orcamentos')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="abrirModalOrcamento()">⊕ Novo Orçamento</button>`;
    renderOrcamentos();
  } else if (page === 'usuarios') {
    if (!podeAcessar('admin')) { toast('Acesso restrito a Gerentes e Back Office', 'error'); return; }
    actionsEl.innerHTML = `<button class="btn btn-primary" onclick="abrirModalUsuario()">⊕ Novo Usuário</button>`;
    renderUsuarios();
  } else if (page === 'dashboard') {
    renderDashboard();
  }
}

// ============================================================
//  HELPERS
// ============================================================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function toast(msg, type='success') {
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function formatDate(ts) {
  return new Date(ts).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function stockPercent(pecaId) {
  const p = db.pecas.find(x => x.id === pecaId);
  const qty = db.estoque[pecaId] || 0;
  if (!p || !p.minimo || p.minimo === 0) return 100;
  return Math.min(100, Math.round((qty / (p.minimo * 2)) * 100));
}

function stockColor(pecaId) {
  const p = db.pecas.find(x => x.id === pecaId);
  const qty = db.estoque[pecaId] || 0;
  if (!p) return '#3a9ef5';
  if (p.minimo > 0 && qty <= 0) return '#e74c3c';
  if (p.minimo > 0 && qty < p.minimo) return '#e8cc2a';
  return '#2ecc71';
}

function movBadge(tipo) {
  const map = {
    ENTRADA: 'badge-green',
    ENVIO: 'badge-blue',
    RETORNO: 'badge-orange',
    ALOCACAO: 'badge-purple',
    VENDA: 'badge-orange',
    CONSUMO: 'badge-red'
  };
  return `<span class="badge ${map[tipo]||'badge-gray'}">${tipo}</span>`;
}

// ============================================================
//  PECAS
// ============================================================
const PECA_FIELDS_NUM = ['preco-usd','custo','valor-venda','peso-g','minimo'];

// Globais de taxa/dólar/markup (lembrados entre cadastros)
window._globalTaxa   = '';
window._globalDolar  = '';
window._globalMarkup = '';

function recalcPricing() {
  const usd    = parseFloat(document.getElementById('peca-preco-usd')?.value) || 0;
  const taxa   = parseFloat(document.getElementById('peca-taxa')?.value)      || 1;
  const dolar  = parseFloat(document.getElementById('peca-dolar')?.value)     || 0;
  const markup = parseFloat(document.getElementById('peca-markup')?.value)    || 1;

  const custo  = usd * taxa * dolar;
  const venda  = custo * markup;

  // Atualiza display da fórmula
  const fmt = (v, prefix='') => prefix + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const el = id => document.getElementById(id);
  if (el('calc-usd-display'))   el('calc-usd-display').textContent   = fmt(usd,  '$ ');
  if (el('calc-taxa-display'))  el('calc-taxa-display').textContent  = taxa.toLocaleString('pt-BR', {minimumFractionDigits:2});
  if (el('calc-dolar-display')) el('calc-dolar-display').textContent = fmt(dolar,'R$ ');
  if (el('calc-custo-display')) el('calc-custo-display').textContent = fmt(custo,'R$ ');
  if (el('calc-markup-display'))el('calc-markup-display').textContent= markup.toLocaleString('pt-BR', {minimumFractionDigits:2});
  if (el('calc-venda-display')) el('calc-venda-display').textContent = fmt(venda,'R$ ');

  // Preenche custo e venda automaticamente (se campos não foram editados manualmente)
  if (custo > 0) {
    const custoEl = el('peca-custo');
    if (custoEl && !custoEl.dataset.manual) custoEl.value = custo.toFixed(2);
  }
  if (venda > 0) {
    const vendaEl = el('peca-valor-venda');
    if (vendaEl && !vendaEl.dataset.manual) vendaEl.value = venda.toFixed(2);
  }
}

function recalcPricingFromCusto() {
  // Custo editado manualmente — marca como manual e recalcula só o venda
  const custoEl = document.getElementById('peca-custo');
  if (custoEl) custoEl.dataset.manual = '1';
  const markup = parseFloat(document.getElementById('peca-markup')?.value) || 1;
  const custo  = parseFloat(custoEl?.value) || 0;
  const venda  = custo * markup;
  const vendaEl = document.getElementById('peca-valor-venda');
  if (vendaEl && !vendaEl.dataset.manual) vendaEl.value = venda > 0 ? venda.toFixed(2) : '';
  // Atualiza display
  const fmt = (v,p='') => p + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const el = id => document.getElementById(id);
  if (el('calc-custo-display')) el('calc-custo-display').textContent = fmt(custo,'R$ ');
  if (el('calc-venda-display')) el('calc-venda-display').textContent = fmt(venda,'R$ ');
}

function recalcMarkupFromVenda() {
  // Venda editada manualmente — marca e calcula markup implícito
  const vendaEl = document.getElementById('peca-valor-venda');
  if (vendaEl) vendaEl.dataset.manual = '1';
  const custo  = parseFloat(document.getElementById('peca-custo')?.value)  || 0;
  const venda  = parseFloat(vendaEl?.value) || 0;
  const fmt = (v,p='') => p + v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const el = id => document.getElementById(id);
  if (custo > 0 && venda > 0) {
    const mkp = venda / custo;
    if (el('peca-markup')) el('peca-markup').value = mkp.toFixed(2);
    if (el('calc-markup-display')) el('calc-markup-display').textContent = mkp.toLocaleString('pt-BR',{minimumFractionDigits:2});
  }
  if (el('calc-venda-display')) el('calc-venda-display').textContent = fmt(venda,'R$ ');
}

function atualizarLinhasModal(fonte) {
  const linhaEl = document.getElementById('peca-linha');
  if (!linhaEl) return;
  const LINHAS = {
    DYMIND: ['DP-C16','DF55/DF56VET','DH36','DH36VET','DH76','DH615'],
    RAYTO:  ['HMG51','RT2201, RT2202'],
    ORTHO:  ['ADVIA2120','RAPIDLAB348EX','RAPIDPOINT500'],
    SIEMENS:['ADVIA2120','IMMULITE2000','RAPIDLAB348EX','RAPIDPOINT500'],
    SNIBE:  ['BIOSSAYS240'],
    FUJIFILM:['DRI-CHEM'],
    'VIDA BIOTECNOLOGIA':['VIDA ELECTROLYTE'],
    STAGO:  ['CA500','CA560','CA600'],
    SENSACORE: ['ST200'],
    BIOBASE:   ['BK-200','BK-280','BK-310','BK-410','BK-400','BK-600','BK-1200'],
  };
  const opts = LINHAS[fonte] || [];
  linhaEl.innerHTML = '<option value="">— Selecionar —</option>' +
    opts.map(l => `<option value="${l}">${l}</option>`).join('');
}

function aplicarTaxaDolar() {
  const taxa   = parseFloat(document.getElementById('global-taxa')?.value)   || 0;
  const dolar  = parseFloat(document.getElementById('global-dolar')?.value)  || 0;
  const markup = parseFloat(document.getElementById('global-markup')?.value) || 0;
  if (!taxa || !dolar) return;

  // Persiste globais
  window._globalTaxa   = taxa;
  window._globalDolar  = dolar;
  if (markup) window._globalMarkup = markup;

  let atUSD = 0, atBRL = 0;
  db.pecas.forEach(p => {
    const mkp = markup || p.markup || 1;
    if (p.custo_brl_direto && p.custo > 0) {
      // Peça com custo R$ direto: sem taxa/dolar, só aplica markup
      p.markup      = mkp;
      p.valor_venda = parseFloat((p.custo * mkp).toFixed(2));
      atBRL++;
    } else if (p.preco_usd > 0) {
      // Peça com preço USD: aplica taxa × dolar × markup
      const custo  = p.preco_usd * taxa * dolar;
      p.taxa        = taxa;
      p.dolar       = dolar;
      p.markup      = mkp;
      p.custo       = parseFloat(custo.toFixed(2));
      p.valor_venda = parseFloat((custo * mkp).toFixed(2));
      atUSD++;
    }
  });

  salvarDB();
  renderPecas();
  toast(`Aplicado: ${atUSD} peças USD · ${atBRL} peças R$ atualizadas`, 'success');
}

function openModalPeca(id) {
  editId = id || null;
  const p = id ? db.pecas.find(x => x.id === id) : null;
  document.getElementById('modal-peca-title').textContent = id ? 'Editar Peça' : 'Nova Peça';
  document.getElementById('peca-codigo').value      = p?.codigo      || '';
  document.getElementById('peca-nome').value        = p?.nome        || '';
  document.getElementById('peca-fonte').value       = p?.fonte       || '';
  atualizarLinhasModal(p?.fonte || '');
  document.getElementById('peca-linha').value       = p?.linha       || '';
  document.getElementById('peca-especificacoes').value = p?.especificacoes || '';
  document.getElementById('peca-unidade').value     = p?.unidade     || 'pcs';
  document.getElementById('peca-preco-usd').value   = p?.preco_usd   || '';
  document.getElementById('peca-taxa').value        = p?.taxa        || window._globalTaxa  || '';
  document.getElementById('peca-dolar').value       = p?.dolar       || window._globalDolar || '';
  document.getElementById('peca-markup').value      = p?.markup      || window._globalMarkup|| '';
  document.getElementById('peca-custo').value       = p?.custo       || '';
  document.getElementById('peca-valor-venda').value = p?.valor_venda || '';
  document.getElementById('peca-peso-g').value      = p?.peso_g      || '';
  document.getElementById('peca-minimo').value      = p?.minimo      || 0;
  // Limpar flags de edição manual
  ['peca-custo','peca-valor-venda'].forEach(id => {
    const el = document.getElementById(id);
    if (el) delete el.dataset.manual;
  });
  // Image
  window._pecaImgData = p?.imagem || '';
  const prev = document.getElementById('peca-img-preview');
  const icon = document.getElementById('peca-img-icon');
  const rem  = document.getElementById('peca-img-remove');
  if (window._pecaImgData) {
    prev.style.backgroundImage = `url(${window._pecaImgData})`;
    prev.style.backgroundSize  = 'cover';
    prev.style.backgroundPosition = 'center';
    if (icon) icon.style.display = 'none';
    if (rem)  rem.style.display  = 'inline-flex';
  } else {
    prev.style.backgroundImage = '';
    if (icon) icon.style.display = 'block';
    if (rem)  rem.style.display  = 'none';
  }
  recalcPricing();
  openModal('modal-peca');
}

function salvarPeca() {
  const codigo = document.getElementById('peca-codigo').value.trim();
  const nome   = document.getElementById('peca-nome').value.trim();
  if (!codigo || !nome) { toast('P/N e Nome são obrigatórios', 'error'); return; }

  const taxa   = parseFloat(document.getElementById('peca-taxa').value)   || 1;
  const dolar  = parseFloat(document.getElementById('peca-dolar').value)  || 0;
  const markup = parseFloat(document.getElementById('peca-markup').value) || 1;
  if (taxa  !== 1) window._globalTaxa   = taxa;
  if (dolar  > 0)  window._globalDolar  = dolar;
  if (markup !== 1) window._globalMarkup = markup;

  const data = {
    id:          editId || undefined,
    codigo, nome,
    fonte:       document.getElementById('peca-fonte').value       || '',
    linha:       document.getElementById('peca-linha').value.trim() || '',
    unidade:     document.getElementById('peca-unidade').value,
    taxa, dolar, markup,
    custo:       parseFloat(document.getElementById('peca-custo').value)       || 0,
    valor_venda: parseFloat(document.getElementById('peca-valor-venda').value) || 0,
    minimo:      parseFloat(document.getElementById('peca-minimo').value)      || 0,
    imagem:      window._pecaImgData || (editId ? (db.pecas.find(x=>x.id===editId)?.imagem||'') : ''),
  };

  const fn = editId ? API.put('/pecas/' + editId, data) : API.post('/pecas', data);
  fn.then(res => {
    if (!editId) data.id = res.id;
    toast(editId ? 'Peça atualizada' : 'Peça cadastrada');
    closeModal('modal-peca');
    loadAndRenderPecas();
  }).catch(err => toast(err.message, 'error'));
}
function renderPecas(q='') {
  const el = document.getElementById('pecas-table');
  if (!el) return;
  const ql = (q||'').toLowerCase().trim();
  const fonteFilter = document.getElementById('pecas-filter-fonte')?.value || '';
  const list = db.pecas.filter(p => {
    if (fonteFilter) {
      if (fonteFilter.includes(':')) {
        // "FONTE:linha" syntax — filter by both
        const [ff, fl] = fonteFilter.split(':');
        if ((p.fonte||'') !== ff || (p.linha||'') !== fl) return false;
      } else {
        // just fonte
        if ((p.fonte||'') !== fonteFilter) return false;
      }
    }
    if (!ql) return true;
    return String(p.codigo||'').toLowerCase().includes(ql) ||
           String(p.nome||'').toLowerCase().includes(ql) ||
           String(p.fonte||'').toLowerCase().includes(ql) ||
           String(p.linha||'').toLowerCase().includes(ql);
  });
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⬡</div>
      <div class="empty-title">Nenhuma Peça</div>
      <div class="empty-sub">Importe a planilha ou cadastre manualmente</div></div>`;
    document.getElementById('badge-pecas').textContent = 0;
    return;
  }

  const FONTE_BADGE = {
    DYMIND:             'background:rgba(52,152,219,0.2);color:#3498db;border:1px solid rgba(52,152,219,0.4)',
    RAYTO:              'background:rgba(46,204,113,0.2);color:#27ae60;border:1px solid rgba(46,204,113,0.4)',
    ORTHO:              'background:rgba(231,76,60,0.2);color:#e74c3c;border:1px solid rgba(231,76,60,0.4)',
    SIEMENS:            'background:rgba(52,73,94,0.3);color:#aab7c4;border:1px solid rgba(100,130,150,0.4)',
    SNIBE:              'background:rgba(243,156,18,0.2);color:#f39c12;border:1px solid rgba(243,156,18,0.4)',
    FUJIFILM:           'background:rgba(192,57,43,0.2);color:#e74c3c;border:1px solid rgba(192,57,43,0.4)',
    STAGO:              'background:rgba(142,68,173,0.2);color:#9b59b6;border:1px solid rgba(142,68,173,0.4)',
    'VIDA BIOTECNOLOGIA':'background:rgba(26,188,156,0.2);color:#1abc9c;border:1px solid rgba(26,188,156,0.4)',
    SENSACORE:          'background:rgba(230,126,34,0.2);color:#e67e22;border:1px solid rgba(230,126,34,0.4)',
    BIOBASE:            'background:rgba(52,73,94,0.3);color:#85c1e9;border:1px solid rgba(52,73,94,0.6)',
    OUTRO:              'background:rgba(155,89,182,0.2);color:#9b59b6;border:1px solid rgba(155,89,182,0.4)',
  };

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th style="width:56px">Foto</th>
      <th>P/N</th><th>Nome</th>
      <th>Fonte</th><th>Linha</th>
      <th>UND</th><th>Preço USD</th><th>Taxa</th><th>Dólar</th>
      <th>Custo R$</th><th>Mark-up</th><th>V.Venda R$</th>
      <th>Estoque</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(p => {
      const qty = db.estoque[p.id] || 0;
      const cor = qty <= 0 ? 'var(--red)' : (p.minimo > 0 && qty < p.minimo ? '#e8cc2a' : 'var(--green)');
      const imgHtml = p.imagem
        ? `<img src="${p.imagem}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border2);cursor:pointer"
            onclick="abrirVisualizadorImg('${p.id}')" title="Ver imagem">`
        : `<div style="width:44px;height:44px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--border2)">⬡</div>`;
      const taxa  = p.taxa  || '—';
      const dolar = p.dolar ? `R$${Number(p.dolar).toFixed(2)}` : '—';
      const mkup  = p.markup|| '—';
      const fonteSt = FONTE_BADGE[p.fonte] || 'background:var(--surface2);color:var(--text3)';
      const fonteBadge = p.fonte
        ? `<span style="font-family:var(--mono);font-size:9px;padding:2px 6px;border-radius:4px;white-space:nowrap;${fonteSt}">${p.fonte}</span>`
        : '—';
      return `<tr>
        <td>${imgHtml}</td>
        <td class="mono" style="font-size:11px;color:var(--accent);font-weight:700">${p.codigo}</td>
        <td style="font-weight:500;max-width:240px">
          ${p.nome}
          ${p.especificacoes ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;white-space:normal;line-height:1.4">${p.especificacoes.slice(0,80)}${p.especificacoes.length>80?'…':''}</div>` : ''}
        </td>
        <td>${fonteBadge}</td>
        <td class="mono" style="font-size:10px;color:var(--text3)">${p.linha||'—'}</td>
        <td class="mono" style="font-size:11px">${p.unidade}</td>
        <td class="mono" style="font-size:11px">$${(p.preco_usd||0).toFixed(2)}</td>
        <td class="mono" style="font-size:11px;color:var(--text2)">${taxa}</td>
        <td class="mono" style="font-size:11px;color:var(--text2)">${dolar}</td>
        <td class="mono" style="font-size:11px;font-weight:600;color:var(--accent)">R$${(p.custo||0).toFixed(2)}</td>
        <td class="mono" style="font-size:11px;color:var(--text2)">${mkup}</td>
        <td class="mono" style="font-size:11px;font-weight:600;color:var(--green)">R$${(p.valor_venda||0).toFixed(2)}</td>
        <td class="mono" style="font-weight:700;color:${cor}">${qty} ${p.unidade}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="openModalPeca('${p.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deletePeca('${p.id}')">✕</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
  document.getElementById('badge-pecas').textContent = list.length;
}

// Visualizador de imagem em tela cheia
function abrirVisualizadorImg(pecaId) {
  const p = db.pecas.find(x => x.id === pecaId);
  if (!p?.imagem) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;cursor:pointer';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <div style="font-family:var(--mono);font-size:11px;color:var(--text3);letter-spacing:2px">${p.codigo} — ${p.nome}</div>
    <img src="${p.imagem}" style="max-width:80vw;max-height:75vh;object-fit:contain;border-radius:8px;border:1px solid var(--border2)">
    <div style="font-size:11px;color:var(--text3)">Clique para fechar</div>`;
  document.body.appendChild(overlay);
}


function deletePeca(id) {
  if (!confirm('Remover esta peça?')) return;
  API.delete('/pecas/' + id)
    .then(() => { toast('Peça removida', 'info'); loadAndRenderPecas(); })
    .catch(err => toast(err.message, 'error'));
}
function openModalEquip(id) {
  editId = id || null;
  const e = id ? db.equipamentos.find(x => x.id === id) : null;
  document.getElementById('modal-equip-title').textContent = id ? 'Editar Equipamento' : 'Novo Equipamento';
  EQUIP_TEXT_FIELDS.forEach(f => {
    const el = document.getElementById('equip-' + f);
    if (el) el.value = e ? (e[f.replace(/-/g,'_')]||'') : '';
  });
  EQUIP_SEL_FIELDS.forEach(f => {
    const el = document.getElementById('equip-' + f);
    if (el) el.value = e ? (e[f.replace(/-/g,'_')]||el.options[0].value) : el.options[0].value;
  });
  EQUIP_NUM_FIELDS.forEach(f => {
    const el = document.getElementById('equip-' + f);
    if (el) el.value = e ? (e[f.replace(/-/g,'_')]||'') : '';
  });
  openModal('modal-equip');
}

function salvarEquipamento() {
  const data = {};
  const fields = ['modelo','marca','serie','linha','cliente','local','contrato','obs'];
  for (const f of fields) {
    const el = document.getElementById('equip-' + f);
    if (el) data[f] = el.value.trim();
  }
  if (!data.modelo) { toast('Modelo obrigatório', 'error'); return; }
  if (editId) data.id = editId;

  // Capture extra fields from EQUIP_TEXT_FIELDS if available
  const campos = {};
  if (typeof EQUIP_TEXT_FIELDS !== 'undefined') {
    EQUIP_TEXT_FIELDS.forEach(f => {
      const el = document.getElementById('equip-campo-' + f.key);
      if (el) campos[f.key] = el.value.trim();
    });
  }
  data.campos = campos;

  const fn = editId ? API.put('/equipamentos/' + editId, data) : API.post('/equipamentos', data);
  fn.then(res => {
    toast(editId ? 'Equipamento atualizado' : 'Equipamento cadastrado');
    closeModal('modal-equip');
    loadAndRenderEquipamentos();
  }).catch(err => toast(err.message, 'error'));
}
function verEquipDoadora(equipId) {
  const doadora = db.doadoras.find(d => {
    const e = db.equipamentos.find(x => x.id === equipId);
    return d.equipId === equipId || (e && d.serie === e.serie);
  });
  if (!doadora) { toast('Doadora não encontrada', 'error'); return; }
  const rets = db.retiradas.filter(r => r.doadId === doadora.id);
  const isAdmin = podeAcessar('admin');
  const custoTotal = rets.reduce((s,r) => s + (r.custoTotal||0), 0);
  const vendaTotal = rets.reduce((s,r) => s + (r.vendaTotal||0), 0);

  const pct = Math.round((doadora.fator||1)*100);
  const classifStyle = doadora.classificacao === 'USO'
    ? 'background:rgba(46,204,113,0.15);color:var(--green);border:1px solid rgba(46,204,113,0.3)'
    : 'background:rgba(231,76,60,0.15);color:var(--red);border:1px solid rgba(231,76,60,0.3)';

  const html = `
    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);
      padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:16px">
      <div style="font-size:32px">⊘</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:15px">${doadora.modelo}</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--accent)">${doadora.serie||'—'}</div>
        <div style="margin-top:4px">
          <span style="${classifStyle};font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:4px;font-weight:700">
            ${doadora.classificacao} · ${pct}%
          </span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">RETIRADAS</div>
        <div style="font-family:var(--mono);font-size:22px;font-weight:800;color:var(--text)">${rets.length}</div>
      </div>
    </div>
    ${rets.length ? `
    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      ${isAdmin ? `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">CUSTO TOTAL DE REPOSIÇÃO</div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:800;color:var(--accent)">R$ ${custoTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>` : ''}
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">VALOR DE VENDA TOTAL</div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:800;color:var(--green)">R$ ${vendaTotal.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Data</th><th>Peça</th><th>Qtd</th>
        ${isAdmin ? '<th>Custo Unit.</th><th>Custo Total</th>' : ''}
        <th>V.Venda</th><th>Técnico</th>
      </tr></thead>
      <tbody>
      ${rets.map(r => `<tr>
        <td class="mono" style="font-size:10px">${new Date(r.data).toLocaleDateString('pt-BR')}</td>
        <td>
          <div class="mono" style="font-size:11px;color:var(--accent);font-weight:700">${r.pecaCodigo}</div>
          <div style="font-size:11px">${r.pecaNome}</div>
        </td>
        <td class="mono" style="font-weight:700">${r.qtd}</td>
        ${isAdmin ? `<td class="mono" style="font-size:11px;color:var(--accent)">R$ ${(r.custoUnit||0).toFixed(2)}</td>
        <td class="mono" style="font-weight:700;color:var(--accent)">R$ ${(r.custoTotal||0).toFixed(2)}</td>` : ''}
        <td class="mono" style="font-weight:700;color:var(--green)">R$ ${(r.vendaTotal||0).toFixed(2)}</td>
        <td style="font-size:11px">${r.tecnico||'—'}</td>
      </tr>`).join('')}
      </tbody>
    </table>` : `<div style="text-align:center;padding:24px;color:var(--text3)">Nenhuma retirada registrada</div>`}
  `;

  // Use a simple overlay modal
  let overlay = document.getElementById('equip-doad-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'equip-doad-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);
      max-width:720px;width:95%;max-height:85vh;overflow-y:auto;padding:0">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;
        border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:1">
        <span style="font-weight:700;font-size:15px">Retiradas — Equipamento Doador</span>
        <button onclick="document.getElementById('equip-doad-overlay').remove()"
          style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="padding:20px">${html}</div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost" onclick="document.getElementById('equip-doad-overlay').remove()">Fechar</button>
        <button class="btn btn-primary" onclick="navigate('doadoras',document.querySelector('[onclick*=doadoras]'));document.getElementById('equip-doad-overlay').remove()">
          Ir para Doadoras
        </button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
}

function deleteEquip(id) {
  if (!confirm('Remover este equipamento?')) return;
  API.delete('/equipamentos/' + id)
    .then(() => { toast('Equipamento removido', 'info'); loadAndRenderEquipamentos(); })
    .catch(err => toast(err.message, 'error'));
}
function renderEquipamentos(q='') {
  const el = document.getElementById('equip-table');
  const list = db.equipamentos.filter(e =>
    !q ||
    String(e.codigo||'').toLowerCase().includes(q.toLowerCase()) ||
    String(e.nome||'').toLowerCase().includes(q.toLowerCase()) ||
    String(e.nome_fantasia||'').toLowerCase().includes(q.toLowerCase()) ||
    String(e.serie||'').toLowerCase().includes(q.toLowerCase()) ||
    String(e.municipio||'').toLowerCase().includes(q.toLowerCase()) ||
    String(e.grupo||'').toLowerCase().includes(q.toLowerCase())
  );

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚙</div><div class="empty-title">Nenhum Equipamento</div><div class="empty-sub">Importe do eLoca ou clique em "Novo Equipamento"</div></div>`;
    return;
  }

  const statusColor = {
    'Em Contrato':         'badge-green',
    'Disponivel':          'badge-blue',
    'Em OS - Com Contrato':'badge-orange',
    'Em OS - Sem Contrato':'badge-red',
    'Inativo':             'badge-gray'
  };
  const propColor = { 'Empresa':'badge-blue', 'Cliente':'badge-purple', 'Terceiros':'badge-gray' };

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Equip.</th><th>Produto / Modelo</th><th>Grupo</th>
      <th>Cliente</th><th>Município/UF</th><th>Série</th>
      <th>Contrato</th><th>Status</th><th>Proprietário</th><th>Ações</th>
    </tr></thead>
    <tbody>
    ${list.map(e => {
      // Check if this equip is a doadora
      const doadora = db.doadoras.find(d => d.equipId === e.id || d.serie === e.serie);
      const rets    = doadora ? db.retiradas.filter(r => r.doadId === doadora.id) : [];
      const nRet    = rets.length;
      const custoReposto = rets.reduce((s,r) => s + (r.custoTotal||0), 0);
      const doadBadge = doadora ? `
        <div style="margin-top:4px">
          <button onclick="verEquipDoadora('${e.id}')" style="
            background:${doadora.classificacao==='SUCATA' ? 'rgba(231,76,60,0.15)' : 'rgba(52,152,219,0.15)'};
            border:1px solid ${doadora.classificacao==='SUCATA' ? 'rgba(231,76,60,0.4)' : 'rgba(52,152,219,0.4)'};
            color:${doadora.classificacao==='SUCATA' ? 'var(--red)' : '#3498db'};
            border-radius:4px;padding:2px 8px;font-family:var(--mono);font-size:9px;cursor:pointer;
            font-weight:700;letter-spacing:0.5px">
            ⊘ DOADORA ${doadora.classificacao==='SUCATA'?'SUCATA':'EM USO'}
            ${nRet ? `· ${nRet} retirada${nRet>1?'s':''}` : ''}
          </button>
        </div>` : '';
      return `<tr>
      <td class="mono" style="font-weight:700;color:var(--accent)">${e.codigo}</td>
      <td>
        <strong style="font-size:13px">${e.nome}</strong>
        ${e.marca||e.modelo ? `<div class="text-mono">${[e.marca,e.modelo].filter(Boolean).join(' · ')}</div>` : ''}
        ${e.cod_produto ? `<div class="text-mono" style="color:var(--text3)">${e.cod_produto}</div>` : ''}
        ${doadBadge}
      </td>
      <td>${e.grupo ? `<span class="badge badge-gray" style="font-size:9px">${e.grupo}</span>` : '—'}</td>
      <td style="max-width:160px;font-size:12px">${e.nome_fantasia||'—'}</td>
      <td class="text-sm">${[e.municipio,e.uf].filter(Boolean).join(' / ')||'—'}</td>
      <td class="mono" style="font-size:11px">${e.serie||'—'}</td>
      <td class="mono" style="font-size:11px">${e.contrato||'—'}</td>
      <td><span class="badge ${statusColor[e.status]||'badge-gray'}">${e.status||'—'}</span></td>
      <td><span class="badge ${propColor[e.proprietario]||'badge-gray'}">${e.proprietario||'—'}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" onclick="openModalEquip('${e.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEquip('${e.id}')">✕</button>
        </div>
      </td>
    </tr>`;}).join('')}
    </tbody>
  </table>`;
}

// ============================================================
//  ESTOQUE
// ============================================================
const DEPOSITOS = ['QUALLYX','QUALLYX SC','QUALLYX SP','CONSUMO - SP','CONSUMO - BC',
  'A LIBERAR BC','A LIBERAR SP','QUALLYX SC-SP','REPAIR','EQUIP. USADO','SUCATA',
  'NOVO-11','NOVO-12','E-JFH'];

// Depósitos que têm movimento relevante (para exibição condensada)
const DEPOSITOS_ATIVOS = ['QUALLYX','QUALLYX SC','QUALLYX SP','CONSUMO - SP','CONSUMO - BC','REPAIR'];

function renderEstoque(q='') {
  const el = document.getElementById('estoque-table');

  // Filtra: peças com dados de estoque importado OU que constam no db.pecas
  const allCodigos = new Set([
    ...db.pecas.map(p => String(p.codigo)),
    ...Object.keys(db.depositos)
  ]);

  let list = [];
  allCodigos.forEach(cod => {
    const peca = db.pecas.find(p => String(p.codigo) === cod);
    const deps = db.depositos[cod] || {};
    const total = db.estoque[peca?.id] ?? deps['Total'] ?? 0;
    list.push({ peca, cod, deps, total });
  });

  // Filtro texto
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(r =>
      String(r.cod).toLowerCase().includes(ql) ||
      String(r.peca?.nome || r.deps._nome || '').toLowerCase().includes(ql) ||
      String(r.peca?.grupo || r.deps._grupo || '').toLowerCase().includes(ql)
    );
  }

  // Ordena: com estoque primeiro, depois por código
  list.sort((a,b) => b.total - a.total || String(a.cod).localeCompare(String(b.cod)));

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◫</div><div class="empty-title">Estoque Vazio</div><div class="empty-sub">Importe a planilha de estoque do eLoca ou registre movimentações</div></div>`;
    return;
  }

  // Verifica quais depósitos têm algum valor > 0 (para mostrar só os relevantes)
  const depoComValor = DEPOSITOS.filter(d =>
    list.some(r => (r.deps[d]||0) > 0)
  );
  const depoShow = depoComValor.length > 0 ? depoComValor : DEPOSITOS_ATIVOS;

  el.innerHTML = `
  <table class="data-table" style="min-width:900px">
    <thead><tr>
      <th>Produto</th>
      <th>Descrição</th>
      <th>Grupo</th>
      <th>UND</th>
      ${depoShow.map(d => `<th style="text-align:center;font-size:9px;white-space:nowrap">${d}</th>`).join('')}
      <th style="text-align:center">Total</th>
      <th>Mín.</th>
      <th>Situação</th>
      <th>Nível</th>
    </tr></thead>
    <tbody>
    ${list.map(r => {
      const { peca, cod, deps, total } = r;
      const nome    = peca?.nome   || deps._nome  || '—';
      const grupo   = peca?.grupo  || deps._grupo || '';
      const unidade = peca?.unidade|| deps._und   || 'UN';
      const minimo  = peca?.minimo || 0;
      const grupoDisplay = grupo.replace(/^\d+\s*-\s*/, '');

      const pct = minimo > 0 ? Math.min(100, Math.round((total / (minimo * 2)) * 100)) : (total > 0 ? 100 : 0);
      const cor = total <= 0 ? 'var(--red)' : (minimo > 0 && total < minimo ? '#e8cc2a' : 'var(--green)');
      const sit = total <= 0 ? ['Zerado','badge-red'] : (minimo > 0 && total < minimo ? ['Crítico','badge-orange'] : ['Normal','badge-green']);

      return `<tr>
        <td class="mono" style="font-weight:700;color:var(--accent);white-space:nowrap">${cod}</td>
        <td style="max-width:200px"><strong style="font-size:12px">${nome}</strong></td>
        <td>${grupoDisplay ? `<span class="badge badge-gray" style="font-size:8px;white-space:nowrap">${grupoDisplay}</span>` : '—'}</td>
        <td class="mono">${unidade}</td>
        ${depoShow.map(d => {
          const v = deps[d] || 0;
          const style = v > 0 ? `font-weight:700;color:var(--text)` : `color:var(--text3)`;
          return `<td style="text-align:center;font-family:var(--mono);font-size:12px;${style}">${v > 0 ? v : '·'}</td>`;
        }).join('')}
        <td style="text-align:center">
          <span style="font-family:var(--mono);font-size:15px;font-weight:700;color:${cor}">${total}</span>
        </td>
        <td class="mono" style="font-size:11px">${minimo||'—'}</td>
        <td><span class="badge ${sit[1]}">${sit[0]}</span></td>
        <td>
          <div class="stock-bar" style="width:60px">
            <div class="stock-fill" style="width:${pct}%;background:${cor}"></div>
          </div>
          <div class="text-mono" style="margin-top:2px;font-size:9px">${pct}%</div>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function importarEstoque(rows, sheetName) {
  // Colunas fixas do eLoca: Produto, Descrição, Unidade, Grupo + depósitos + Total
  const ELOCA_EST_MAP = {
    'produto':         '_cod',
    'descricao':       '_nome',
    'descrição':       '_nome',
    'unidade':         '_und',
    'grupo':           '_grupo',
    'total':           'Total',
  };
  // Depósitos reconhecidos (exatamente como aparecem no eLoca)
  const DEPOT_NAMES = new Set(DEPOSITOS.map(d => d.toLowerCase()));

  const norm = s => String(s||'').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const rawHeader = rows[0];
  // Mapeia índice de cada coluna
  const colMap = {}; // nomeCampo → índice coluna
  rawHeader.forEach((h, ci) => {
    const hn = norm(h);
    // Verifica mapa fixo
    for (const [key, field] of Object.entries(ELOCA_EST_MAP)) {
      if (hn === norm(key)) { if (colMap[field] === undefined) colMap[field] = ci; }
    }
    // Verifica depósitos (match exato case-insensitive)
    const hOrig = String(h).trim().toUpperCase();
    if (DEPOSITOS.map(d=>d.toUpperCase()).includes(hOrig)) {
      colMap[hOrig] = ci;
    }
  });

  if (colMap['_cod'] === undefined) {
    openImportHelp('estoque');
    return;
  }

  let updated = 0, added = 0, skipped = 0;

  rows.slice(1).forEach(row => {
    const cod = String(row[colMap['_cod']]||'').trim();
    if (!cod || cod === '0') { skipped++; return; }

    const depData = {
      _nome:  colMap['_nome']  !== undefined ? String(row[colMap['_nome']]||'').trim()  : '',
      _und:   colMap['_und']   !== undefined ? String(row[colMap['_und']]||'UN').trim() : 'UN',
      _grupo: colMap['_grupo'] !== undefined ? String(row[colMap['_grupo']]||'').trim() : '',
    };

    // Lê cada depósito
    DEPOSITOS.forEach(d => {
      const ci = colMap[d.toUpperCase()];
      depData[d] = ci !== undefined ? (parseInt(row[ci])||0) : 0;
    });

    // Total: usa coluna Total se existir, senão soma depósitos
    const totalCI = colMap['Total'];
    depData['Total'] = totalCI !== undefined
      ? (parseInt(row[totalCI])||0)
      : DEPOSITOS.reduce((s,d) => s + (depData[d]||0), 0);

    // Armazena depósitos por código
    db.depositos[cod] = depData;

    // Sincroniza com db.estoque se a peça existir
    const peca = db.pecas.find(p => String(p.codigo) === cod);
    if (peca) {
      db.estoque[peca.id] = depData['Total'];
      updated++;
    } else {
      added++;
    }
  });

  renderEstoque();
  renderDashboard();
  const msg = `eLoca Estoque [${sheetName}] — ${updated} peças atualizadas, ${added} novos códigos carregados${skipped > 0 ? `, ${skipped} ignorados` : ''}`;
  toast(msg);
}

// ============================================================
//  MOVIMENTAÇÃO — FLUXO PIPELINE
// ============================================================

// Status do pipeline e suas propriedades visuais
const PIPELINE_STATUS = {
  SOLICITADA:      { label:'Solicitada',      badge:'badge-gray',   step:1, cor:'var(--text3)' },
  ENVIADA:         { label:'Enviada',         badge:'badge-blue',   step:2, cor:'var(--blue)' },
  COMPRA_PENDENTE: { label:'Compra Pendente', badge:'badge-orange', step:2, cor:'var(--accent)' },
  DESPACHADA:      { label:'Despachada',      badge:'badge-purple', step:3, cor:'var(--purple)' },
  RECEBIDA:        { label:'Recebida',        badge:'badge-teal',   step:4, cor:'#1abc9c' },
  ALOCADA:         { label:'Alocada',         badge:'badge-green',  step:5, cor:'var(--green)' },
  NF_EMITIDA:      { label:'NF Emitida',      badge:'badge-yellow', step:6, cor:'#f1c40f' },
  FINALIZADO:      { label:'Finalizado',      badge:'badge-green',  step:7, cor:'var(--green)' },
};

let actionModalTarget = null; // id da solicitação sendo editada

function criarSolicitacao() {
  const pecaId = document.getElementById('mov-peca').value;
  const qtd    = parseInt(document.getElementById('mov-qtd').value) || 0;
  if (!pecaId)  { toast('Selecione uma peça', 'error'); return; }
  if (qtd <= 0) { toast('Informe uma quantidade válida', 'error'); return; }

  const peca    = db.pecas.find(x => x.id === pecaId);
  const equipId = document.getElementById('mov-equip').value;
  const equip   = equipId ? db.equipamentos.find(x => x.id === equipId) : null;
  const tecnico = document.getElementById('mov-tecnico').value.trim() || currentUser?.nome || '';
  const obs     = document.getElementById('mov-obs').value.trim();
  const estoqueAtual = db.estoque[pecaId] || 0;
  const temEstoque   = estoqueAtual >= qtd;

  const data = {
    peca_id:      pecaId,
    peca_codigo:  peca?.codigo  || pecaId,
    peca_nome:    peca?.nome    || '?',
    peca_unidade: peca?.unidade || 'UN',
    peca_fonte:   peca?.fonte   || '',
    peca_custo:   peca?.custo   || 0,
    qtd,
    equip_id:      equipId || '',
    equip_serie:   equip?.serie  || equip?.codigo || '',
    equip_cliente: equip?.nome_fantasia || equip?.cliente || '',
    equip_modelo:  equip?.modelo || '',
    tecnico,
    obs,
    tem_estoque: temEstoque,
  };

  API.post('/movimentacoes', data)
    .then(res => {
      toast(`Solicitação #${res.seq_num} criada — ${temEstoque ? 'peça em estoque' : '⚠ estoque insuficiente'}`, temEstoque ? 'success' : 'info');
      populateMovSelects();
      loadAndRenderDashboard();
    })
    .catch(err => toast(err.message, 'error'));
}
function populateMovSelects() {
  document.getElementById('mov-peca-search').value = '';
  document.getElementById('mov-peca').value = '';
  document.getElementById('mov-peca').dataset.label = '';
  document.getElementById('mov-peca-selected').style.display = 'none';
  document.getElementById('mov-serie-search').value = '';
  document.getElementById('mov-equip').value = '';
  document.getElementById('mov-equip').dataset.label = '';
  document.getElementById('mov-equip-card').style.display = 'none';
  document.getElementById('mov-qtd').value = '';
  document.getElementById('mov-tecnico').value = '';
  document.getElementById('mov-tecnico-email').value = '';
  document.getElementById('mov-obs').value = '';
  document.getElementById('mov-doadora-search').value = '';
  document.getElementById('mov-doadora').value = '';
  document.getElementById('mov-doadora-card').style.display = 'none';
}

// -----------------------------------------------
// AUTOCOMPLETE DOADORA NO FORM DE MOVIMENTAÇÃO
// -----------------------------------------------
function filtrarDoadorasMov(q) {
  const dd = document.getElementById('mov-doadora-dropdown');
  const lista = db.doadoras || [];
  const termo = (q||'').toLowerCase();
  const filtrada = termo.length < 1
    ? lista
    : lista.filter(d =>
        (d.modelo||'').toLowerCase().includes(termo) ||
        (d.serie||'').toLowerCase().includes(termo) ||
        (d.marca||'').toLowerCase().includes(termo)
      );

  if (!filtrada.length) { dd.style.display = 'none'; return; }

  dd.innerHTML = filtrada.slice(0,12).map(d => {
    const classifColor = d.classificacao === 'SUCATA' ? 'var(--red)' : '#3498db';
    return `<div style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.1s"
      onmousedown="selecionarDoadoraMov('${d.id}')"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="font-family:var(--mono);font-size:11px;color:${classifColor}">${d.classificacao||'USO'} · ${d.serie||'—'}</div>
      <div style="font-size:13px;color:var(--text)">${d.modelo||'—'} <span style="color:var(--text3);font-size:11px">${d.marca||''}</span></div>
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function selecionarDoadoraMov(id) {
  const d = (db.doadoras||[]).find(x => x.id === id);
  if (!d) return;
  document.getElementById('mov-doadora').value = id;
  document.getElementById('mov-doadora-search').value = `${d.modelo} · ${d.serie||''}`;
  document.getElementById('mov-doadora-dropdown').style.display = 'none';
  const card = document.getElementById('mov-doadora-card');
  const classifColor = d.classificacao === 'SUCATA' ? 'var(--red)' : '#3498db';
  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="color:${classifColor};font-weight:600">⊘ DOADORA ${d.classificacao||'EM USO'}</span>
      <span style="cursor:pointer;color:var(--text3);font-size:12px" onclick="limparDoadoraMov()" title="Remover vínculo">✕</span>
    </div>
    <div style="color:var(--text);font-size:12px">${d.modelo} · <span style="color:var(--accent)">${d.serie||'—'}</span></div>
    ${d.marca ? `<div style="color:var(--text3)">${d.marca}${d.linha?' · '+d.linha:''}</div>` : ''}
  `;
  card.style.display = 'block';
}

function limparDoadoraMov() {
  document.getElementById('mov-doadora').value = '';
  document.getElementById('mov-doadora-search').value = '';
  document.getElementById('mov-doadora-card').style.display = 'none';
}

function fecharDropdownDoadora() {
  const dd = document.getElementById('mov-doadora-dropdown');
  if (dd) dd.style.display = 'none';
}

// -----------------------------------------------
// ACTION MODAL — abre para cada ação do pipeline
// -----------------------------------------------
function abrirActionModal(id, acao) {
  const sol = db.movimentacoes.find(x => x.id === id);
  if (!sol) return;
  actionModalTarget = id;

  const el     = document.getElementById('action-modal');
  const title  = document.getElementById('action-modal-title');
  const body   = document.getElementById('action-modal-body');
  const footer = document.getElementById('action-modal-footer');

  const acoes = {
    ENVIAR:     'Confirmar Envio para Logística',
    DESPACHAR:  'Registrar Despacho',
    RECEBER:    'Confirmar Recebimento',
    ALOCAR:     'Registrar Alocação / Uso',
    EMITIR_NF:  'Emitir Nota Fiscal',
    FINALIZAR:  'Finalizar Processo',
    COMPRA:     'Gerar Pedido de Compra',
  };
  title.textContent = acoes[acao] || acao;

  const pInfoBox = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);
      padding:10px 14px;margin-bottom:18px;font-size:12px;line-height:1.8">
      <div style="display:flex;align-items:center;gap:12px">
        ${sol.pecaImagem ? `<img src="${sol.pecaImagem}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid var(--border2);flex-shrink:0;cursor:pointer" onclick="abrirVisualizadorImg('${sol.pecaId}')" title="Ver imagem da peça">` : ''}
        <div>
          <strong style="color:var(--accent);font-family:var(--mono)">${sol.pecaCodigo}</strong>
          · ${sol.pecaNome} · <strong>${sol.qtd} ${sol.pecaUnidade}</strong>
          ${sol.equipSerie ? `· S/N: <span style="font-family:var(--mono);color:var(--text2)">${sol.equipSerie}</span>` : ''}
          ${sol.equipCliente ? `<br><span style="color:var(--text3)">${sol.equipCliente}</span>` : ''}
        </div>
      </div>
    </div>`;

  if (acao === 'ENVIAR') {
    const sem = !sol.temEstoque;
    body.innerHTML = pInfoBox + `
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">
        ${sem
          ? `<span style="color:var(--accent)">⚠ Peça sem estoque suficiente.</span> Ao confirmar o envio, será gerado um <strong>pedido de compra</strong> por e-mail para Marcelo.`
          : `Ao confirmar, será enviado um <strong>e-mail para a logística</strong> (marcelo@quallyx.com.br) com os dados desta solicitação.`}
      </p>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Observação para logística</label>
        <textarea class="form-textarea" id="am-obs" placeholder="Informações adicionais..." style="min-height:60px"></textarea>
      </div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharActionModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="executarAcao('ENVIAR')">
        ${sem ? '⚠ Gerar Compra + Notificar' : '✉ Enviar para Logística'}
      </button>`;

  } else if (acao === 'DESPACHAR') {
    body.innerHTML = pInfoBox + `
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Meio de Transporte *</label>
          <select class="form-select" id="am-transporte">
            <option value="">Selecione...</option>
            <option>Motoboy</option><option>Correios (PAC)</option><option>Correios (SEDEX)</option>
            <option>Transportadora</option><option>Retirada Pessoal</option><option>Outro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Código de Rastreio</label>
          <input class="form-input" id="am-rastreio" placeholder="Ex: BR123456789BR">
        </div>
        <div class="form-group">
          <label class="form-label">Previsão de Entrega</label>
          <input class="form-input" type="date" id="am-previsao">
        </div>
        <div class="form-group">
          <label class="form-label">Observação</label>
          <input class="form-input" id="am-obs" placeholder="Informações adicionais">
        </div>
      </div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharActionModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="executarAcao('DESPACHAR')">✓ Confirmar Despacho</button>`;

  } else if (acao === 'RECEBER') {
    const agora = new Date();
    const hojeStr = agora.toISOString().slice(0,10);
    const horaStr = agora.toTimeString().slice(0,5);
    body.innerHTML = pInfoBox + `
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Data do Recebimento *</label>
          <input class="form-input" type="date" id="am-data-rec" value="${hojeStr}">
        </div>
        <div class="form-group">
          <label class="form-label">Hora do Recebimento *</label>
          <input class="form-input" type="time" id="am-hora-rec" value="${horaStr}">
        </div>
        <div class="form-group full">
          <label class="form-label">Recebido por</label>
          <input class="form-input" id="am-obs" placeholder="Nome de quem recebeu">
        </div>
      </div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharActionModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="executarAcao('RECEBER')">✓ Confirmar Recebimento</button>`;

  } else if (acao === 'ALOCAR') {
    const equip = sol.equipId ? db.equipamentos.find(x=>x.id===sol.equipId) : null;
    const propOpts = equip
      ? `<option value="ALOCACAO" ${equip.proprietario==='Cliente'?'selected':''}>Alocação (peça no cliente)</option>
         <option value="CONSUMO"  ${equip.proprietario!=='Cliente'?'selected':''}>Uso/Consumo (empresa/terceiros)</option>
         <option value="VENDA">Venda</option>`
      : `<option value="ALOCACAO">Alocação</option>
         <option value="CONSUMO">Uso/Consumo</option>
         <option value="VENDA">Venda</option>`;

    // Busca orçamento vinculado ou lista disponíveis
    const orc = sol.orcamentoId ? db.orcamentos.find(x=>x.id===sol.orcamentoId) : null;
    const orcsDisp = db.orcamentos.filter(x=>x.status==='APROVADO' && (!x.solicitacaoId || x.solicitacaoId===sol.id));
    const orcSelect = orcsDisp.length
      ? `<div class="form-group full">
          <label class="form-label">Vincular Orçamento (opcional)</label>
          <select class="form-select" id="am-orcamento-id" onchange="atualizarValorPorOrc(this.value,'${sol.id}')">
            <option value="">Sem vínculo</option>
            ${orcsDisp.map(o=>`<option value="${o.id}" ${sol.orcamentoId===o.id?'selected':''}>#${o.numero} · ${o.cliente||'—'} · R$ ${parseFloat(o.total||0).toFixed(2)}</option>`).join('')}
          </select>
        </div>` : '';

    const custoUnit  = parseFloat(sol.pecaCusto)||0;
    const vendaUnit  = parseFloat(sol.pecaValorVenda)||0;
    const orcValUnit = orc ? parseFloat(orc.total||0)/Math.max(sol.qtd,1) : 0;

    body.innerHTML = pInfoBox + `
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Número da OS</label>
          <input class="form-input" id="am-os-num" placeholder="Ex: 6513" value="${sol.osNum||''}">
        </div>
        <div class="form-group" style="position:relative">
          <label class="form-label">Técnico que encerrou a OS</label>
          <input class="form-input" id="am-tec-nome" placeholder="Nome do técnico" autocomplete="off"
            value="${sol.tecnicoAlocacao||sol.tecnico||''}"
            oninput="filtrarTecnicosMov(this.value,'am')" onfocus="filtrarTecnicosMov(this.value,'am')"
            onblur="setTimeout(()=>fecharDropdownTecnico('am'),200)">
          <div id="am-tecnico-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:999;
            background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);
            max-height:160px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.4);margin-top:2px"></div>
        </div>
        <div class="form-group">
          <label class="form-label">E-mail do Técnico</label>
          <input class="form-input" type="email" id="am-tec-email" placeholder="email@empresa.com.br"
            value="${sol.emailTecnicoAlocacao||sol.emailTecnico||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Alocação *</label>
          <select class="form-select" id="am-tipo-aloc" onchange="onTipoAlocChange(this.value)">${propOpts}</select>
        </div>

        <!-- Valores — aparecem/mudam por tipo -->
        <div class="form-group" id="am-bloco-custo">
          <label class="form-label">Custo Unitário (R$)</label>
          <input class="form-input" type="number" step="0.01" id="am-custo-unit"
            value="${custoUnit.toFixed(2)}" placeholder="0,00">
        </div>
        <div class="form-group" id="am-bloco-custo-total">
          <label class="form-label">Custo Total (R$) · ${sol.qtd} un</label>
          <input class="form-input" type="number" step="0.01" id="am-custo-total"
            value="${(custoUnit*sol.qtd).toFixed(2)}" placeholder="0,00"
            style="background:var(--surface2);color:var(--text2)" readonly>
        </div>
        <div class="form-group" id="am-bloco-venda" style="display:none">
          <label class="form-label">Valor de Venda Unitário (R$)</label>
          <input class="form-input" type="number" step="0.01" id="am-valor-venda"
            value="${vendaUnit.toFixed(2)}" oninput="recalcTotais()" placeholder="0,00">
        </div>
        <div class="form-group" id="am-bloco-venda-total" style="display:none">
          <label class="form-label">Total de Venda (R$) · ${sol.qtd} un</label>
          <input class="form-input" type="number" step="0.01" id="am-valor-venda-total"
            value="${(vendaUnit*sol.qtd).toFixed(2)}" placeholder="0,00"
            style="background:var(--surface2);color:var(--text2)" readonly>
        </div>
        ${orcSelect}

        <div class="form-group full">
          <label class="form-label">Observação</label>
          <input class="form-input" id="am-obs" placeholder="Problema resolvido? Observações...">
        </div>
      </div>
      `;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharActionModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="executarAcao('ALOCAR')">✓ Confirmar Alocação</button>`;
    // init campos após injetar HTML
    setTimeout(() => {
      const ti = document.getElementById('am-tipo-aloc');
      if (ti) onTipoAlocChange(ti.value);
      const cu = document.getElementById('am-custo-unit');
      if (cu) cu.addEventListener('input', recalcTotais);
    }, 0);
  } else if (acao === 'EMITIR_NF') {
    // Determina o valor base para NF
    const orc       = sol.orcamentoId ? db.orcamentos.find(x=>x.id===sol.orcamentoId) : null;
    const isVenda   = sol.tipoAlocacao === 'VENDA';
    const isConsumo = ['CONSUMO','ALOCACAO'].includes(sol.tipoAlocacao);

    let valorNFBase = 0;
    let valorLabel  = 'Valor da NF (R$)';
    let valorHint   = '';
    if (orc) {
      valorNFBase = parseFloat(orc.total)||0;
      valorLabel  = 'Valor da NF (R$) — via Orçamento';
      valorHint   = `<div style="font-size:11px;color:var(--accent);margin-top:3px">📋 Orçamento #${orc.numero}: R$ ${parseFloat(orc.total||0).toFixed(2)}</div>`;
    } else if (isVenda) {
      valorNFBase = (parseFloat(sol.pecaValorVenda)||0) * sol.qtd;
      valorLabel  = 'Valor da NF — Venda (R$)';
      valorHint   = `<div style="font-size:11px;color:var(--blue);margin-top:3px">Valor venda unitário: R$ ${parseFloat(sol.pecaValorVenda||0).toFixed(2)} × ${sol.qtd} un</div>`;
    } else if (isConsumo) {
      valorNFBase = (parseFloat(sol.pecaCusto)||0) * sol.qtd;
      valorLabel  = 'Valor da NF — Uso/Consumo (custo R$)';
      valorHint   = `<div style="font-size:11px;color:var(--text3);margin-top:3px">Custo unitário: R$ ${parseFloat(sol.pecaCusto||0).toFixed(2)} × ${sol.qtd} un</div>`;
    }

    body.innerHTML = pInfoBox + `
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        ${sol.tipoAlocacao ? `<span class="badge badge-blue">${sol.tipoAlocacao}</span>` : ''}
        ${orc ? `<span class="badge badge-orange">Orçamento #${orc.numero}</span>` : ''}
        ${sol.osNum ? `<span class="badge badge-gray">OS ${sol.osNum}</span>` : ''}
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Número da NF *</label>
          <input class="form-input" id="am-nf-numero" placeholder="Ex: 001234" value="${sol.nfNumero||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Data de Faturamento *</label>
          <input class="form-input" type="date" id="am-nf-data" value="${sol.nfData||new Date().toISOString().slice(0,10)}">
        </div>
        <div class="form-group full">
          <label class="form-label">${valorLabel}</label>
          <input class="form-input" type="number" step="0.01" id="am-nf-valor"
            value="${valorNFBase>0 ? valorNFBase.toFixed(2) : ''}" placeholder="0,00">
          ${valorHint}
        </div>
        <div class="form-group full">
          <label class="form-label">Observação</label>
          <input class="form-input" id="am-obs" placeholder="Informações adicionais">
        </div>
      </div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharActionModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="executarAcao('EMITIR_NF')">✓ Registrar NF</button>`;

  } else if (acao === 'FINALIZAR') {
    const numRetorno = (sol.numSeq||'????') + 'R';
    body.innerHTML = pInfoBox + `
      <div style="background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:var(--radius);
        padding:14px;margin-bottom:16px;font-size:13px;color:var(--text2)">
        <strong style="color:var(--green)">✓ Processo completo.</strong>
        ${sol.nfNumero ? `NF <strong>${sol.nfNumero}</strong> emitida em <strong>${sol.nfData}</strong>.` : ''}
        Confirma a finalização desta solicitação?
      </div>

      <div style="background:rgba(231,76,60,0.06);border:1px solid rgba(231,76,60,0.2);border-radius:var(--radius);
        padding:12px 14px;margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none">
          <input type="checkbox" id="am-devolucao" onchange="toggleDevolucaoInfo(this.checked)"
            style="width:16px;height:16px;accent-color:var(--red);cursor:pointer">
          <span style="font-family:var(--mono);font-size:11px;letter-spacing:1px;color:var(--red)">
            DEVOLUÇÃO DE PEÇA DEFEITUOSA
          </span>
        </label>
        <div id="am-devolucao-info" style="display:none;margin-top:10px;padding:8px 10px;
          background:rgba(231,76,60,0.08);border-radius:var(--radius);font-size:12px;color:var(--text2);line-height:1.7">
          Será iniciado o processo de retorno da peça. Esta solicitação receberá o número de retorno
          <strong style="font-family:var(--mono);color:var(--red)">${numRetorno}</strong>,
          indicando que é o retorno da solicitação <strong style="font-family:var(--mono)">${sol.numSeq||'????'}</strong>.
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Observação final</label>
        <input class="form-input" id="am-obs" placeholder="Comentário final opcional">
      </div>`;
    footer.innerHTML = `
      <button class="btn btn-ghost" onclick="fecharActionModal()">Cancelar</button>
      <button class="btn btn-success" onclick="executarAcao('FINALIZAR')">✓ Finalizar</button>`;
  }

  el.classList.add('open');
}

function toggleValorVenda(val) {
  // mantido por compatibilidade
  onTipoAlocChange(val);
}

function onTipoAlocChange(val) {
  const isVenda = val === 'VENDA';
  ['am-bloco-venda','am-bloco-venda-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isVenda ? 'block' : 'none';
  });
  recalcTotais();
}

function recalcTotais() {
  const solId = actionModalTarget;
  const sol   = db.movimentacoes.find(x=>x.id===solId);
  if (!sol) return;
  const qtd   = sol.qtd || 1;

  const cuUnit = parseFloat(document.getElementById('am-custo-unit')?.value)||0;
  const cuTot  = document.getElementById('am-custo-total');
  if (cuTot) cuTot.value = (cuUnit * qtd).toFixed(2);

  const vUnit = parseFloat(document.getElementById('am-valor-venda')?.value)||0;
  const vTot  = document.getElementById('am-valor-venda-total');
  if (vTot) vTot.value = (vUnit * qtd).toFixed(2);
}

function atualizarValorPorOrc(orcId, solId) {
  const orc = db.orcamentos.find(x=>x.id===orcId);
  const sol = db.movimentacoes.find(x=>x.id===solId);
  if (!orc || !sol) return;
  const qtd    = sol.qtd || 1;
  const unitVal= parseFloat(orc.total||0) / qtd;
  const vendaEl = document.getElementById('am-valor-venda');
  if (vendaEl) { vendaEl.value = unitVal.toFixed(2); recalcTotais(); }
}

function toggleDevolucaoInfo(checked) {
  document.getElementById('am-devolucao-info').style.display = checked ? 'block' : 'none';
}

function fecharActionModal() {
  document.getElementById('action-modal').classList.remove('open');
  actionModalTarget = null;
}

function executarAcao(acao) {
  const solId = actionModalTarget;
  const obs   = (document.getElementById('am-obs')?.value||'').trim();

  const body = { acao, obs };
  if (acao === 'DESPACHAR') {
    body.transporte        = document.getElementById('am-transporte')?.value || '';
    body.rastreio          = document.getElementById('am-rastreio')?.value.trim() || '';
    body.previsao_entrega  = document.getElementById('am-previsao')?.value || '';
    if (!body.transporte) { toast('Informe o meio de transporte', 'error'); return; }
  }
  if (acao === 'RECEBER') {
    body.data_recebimento = document.getElementById('am-data-rec')?.value || '';
    body.hora_recebimento = document.getElementById('am-hora-rec')?.value || '';
    if (!body.data_recebimento || !body.hora_recebimento) { toast('Informe data e hora', 'error'); return; }
  }

  API.put('/movimentacoes/' + solId + '/acao', body)
    .then(() => {
      closeModal('action-modal');
      toast('Status atualizado');
      loadAndRenderHistorico();
      loadAndRenderLogistica();
      loadAndRenderDashboard();
    })
    .catch(err => toast(err.message, 'error'));
}
function simularEmail(tipo, sol) {
  const baseUrl = window.location.href.split('?')[0];
  const tkn     = sol.id.substring(0,6); // token simples
  const numLabel = sol.numSeq ? `[${sol.numSeq}] ` : '';
  let subject, body;

  if (tipo === 'ENVIO') {
    const linkDespachar = `${baseUrl}?action=despachar&id=${sol.id}&token=${tkn}`;
    subject = encodeURIComponent(`${numLabel}[PartForge] Solicitação de Envio — ${sol.pecaCodigo} · ${sol.equipSerie||'S/N N/D'}`);
    body = encodeURIComponent(
      `====================================\n` +
      `  SOLICITAÇÃO DE ENVIO DE PEÇA\n` +
      `  Nº ${sol.numSeq || '—'}\n` +
      `====================================\n\n` +
      `PEÇA\n` +
      `  Código:      ${sol.pecaCodigo}\n` +
      `  Descrição:   ${sol.pecaNome}\n` +
      `  Quantidade:  ${sol.qtd} ${sol.pecaUnidade}\n\n` +
      `EQUIPAMENTO\n` +
      `  Descrição:   ${sol.equipNome||'—'}\n` +
      `  Nº de Série: ${sol.equipSerie||'—'}\n` +
      `  Cliente:     ${sol.equipCliente||'—'}\n\n` +
      (sol.doadId ? `╔══════════════════════════════════╗\n⚠ ORIGEM DA PEÇA: EQUIPAMENTO DOADOR\n  Doadora: ${sol.doadModelo||'—'}\n  Série:   ${sol.doadSerie||'—'}\n  Tipo:    ${sol.doadClass==='SUCATA'?'SUCATA (50%)':'Em Uso (100%)'}\n*** PEÇA VEM DA ÁREA TÉCNICA — NÃO REALIZAR COMPRA ***\n╚══════════════════════════════════╝\n\n` : '') +
      `SOLICITANTE\n` +
      `  Técnico:     ${sol.tecnico||'—'}\n` +
      `  E-mail:      ${sol.emailTecnico||'—'}\n` +
      `  Observação:  ${sol.obs||'—'}\n\n` +
      `====================================\n` +
      `>> CLIQUE AQUI PARA CONFIRMAR O DESPACHO:\n` +
      `   Despachar: ${linkDespachar}\n` +
      `====================================\n` +
      `Data: ${new Date().toLocaleString('pt-BR')}\n` +
      `====================================`
    );
  } else if (tipo === 'COMPRA') {
    subject = encodeURIComponent(`${numLabel}[PartForge] Pedido de Compra — ${sol.pecaCodigo} · ${sol.pecaNome}`);
    body = encodeURIComponent(
      `====================================\n` +
      `  PEDIDO DE COMPRA — PEÇA SEM ESTOQUE\n` +
      `  Nº ${sol.numSeq || '—'}\n` +
      `====================================\n\n` +
      `PEÇA\n` +
      `  Código:      ${sol.pecaCodigo}\n` +
      `  Descrição:   ${sol.pecaNome}\n` +
      `  Fonte:       ${sol.pecaFonte||'—'}\n` +
      `  Valor R$:    ${sol.pecaCusto ? 'R$ '+parseFloat(sol.pecaCusto).toFixed(2) : 'N/D'}\n` +
      `  Quantidade:  ${sol.qtd} ${sol.pecaUnidade}\n\n` +
      `EQUIPAMENTO\n` +
      `  Descrição:   ${sol.equipNome||'—'}\n` +
      `  Nº de Série: ${sol.equipSerie||'—'}\n` +
      `  Cliente:     ${sol.equipCliente||'—'}\n\n` +
      `SOLICITANTE\n` +
      `  Técnico:     ${sol.tecnico||'—'}\n` +
      `  E-mail:      ${sol.emailTecnico||'—'}\n` +
      `  Observação:  ${sol.obs||'—'}\n\n` +
      `====================================\n` +
      `Data: ${new Date().toLocaleString('pt-BR')}\n` +
      `====================================`
    );
  } else if (tipo === 'RETORNO') {
    const linkRetorno = `${baseUrl}?action=retorno&id=${sol.id}&token=${tkn}`;
    const emailDest   = sol.emailTecnico || sol.emailTecnicoAlocacao || '';
    subject = encodeURIComponent(`${numLabel}[PartForge] Devolução de Peça Defeituosa — ${sol.pecaCodigo}`);
    body = encodeURIComponent(
      `====================================\n` +
      `  DEVOLUÇÃO DE PEÇA DEFEITUOSA\n` +
      `  Nº Retorno: ${sol.numSeqRetorno || sol.numSeq}\n` +
      `====================================\n\n` +
      `PEÇA\n` +
      `  Código:      ${sol.pecaCodigo}\n` +
      `  Descrição:   ${sol.pecaNome}\n` +
      `  Quantidade:  ${sol.qtd} ${sol.pecaUnidade}\n\n` +
      `EQUIPAMENTO\n` +
      `  Descrição:   ${sol.equipNome||'—'}\n` +
      `  Nº de Série: ${sol.equipSerie||'—'}\n` +
      `  Cliente:     ${sol.equipCliente||'—'}\n\n` +
      `TÉCNICO RESPONSÁVEL\n` +
      `  Nome:        ${sol.tecnicoAlocacao||sol.tecnico||'—'}\n` +
      `  E-mail:      ${sol.emailTecnicoAlocacao||sol.emailTecnico||'—'}\n\n` +
      `====================================\n` +
      `>> CLIQUE AQUI PARA ACESSAR O PROCESSO DE RETORNO:\n` +
      `   ${linkRetorno}\n` +
      `====================================\n` +
      `Data: ${new Date().toLocaleString('pt-BR')}\n` +
      `====================================`
    );
    if (emailDest) window.open(`mailto:${emailDest}?subject=${subject}&body=${body}`);
    window.open(`mailto:<a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="9bf6fae9f8fef7f4dbeaeefaf7f7e2e3b5f8f4f6b5f9e9">[email&#160;protected]</a>?subject=${subject}&body=${body}`);
    return;
  }

  window.open(`mailto:<a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="3c515d4e5f5950537c4d495d50504544125f5351125e4e">[email&#160;protected]</a>?subject=${subject}&body=${body}`);
}

// -----------------------------------------------
// CANCELAR / LIMPAR
// -----------------------------------------------
function cancelarMov() { populateMovSelects(); }

// ============================================================
//  AUTH — LOGIN / LOGOUT / SESSÃO
// ============================================================
let currentUser = null; // { id, nome, email, cargo, tel }

// hashSenha: handled server-side
function hashSenha(s) { return s; }
function podeAcessar(nivel) {
  if (!currentUser) return false;
  const adminCargos = ['Gerente','Back Office','Assessor'];
  if (nivel === 'admin') return adminCargos.includes(currentUser.cargo);
  return true; // 'any'
}

function fazerLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const senha = document.getElementById('login-senha').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.querySelector('.login-btn');
  errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'ENTRANDO...'; }

  API.login(email, senha)
    .then(({ token, usuario }) => {
      API.setToken(token);
      currentUser = usuario;
      document.getElementById('login-screen').classList.add('hidden');
      atualizarUserPill();
      const navUsr = document.getElementById('nav-usuarios');
      if (navUsr) navUsr.style.display = podeAcessar('admin') ? '' : 'none';
      initApp();
      toast(`Bem-vindo, ${usuario.nome.split(' ')[0]}!`, 'success');
    })
    .catch(err => {
      errEl.textContent = err.message || 'Erro ao fazer login';
    })
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = 'ENTRAR'; }
    });
}
function fazerLogout() {
  API.clearToken();
  currentUser = null;
  db.pecas = []; db.equipamentos = []; db.movimentacoes = [];
  db.orcamentos = []; db.pedidos = []; db.usuarios = [];
  db.doadoras = []; db.estoque = {}; db.depositos = {};
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  document.getElementById('login-error').textContent = '';
}
function atualizarUserPill() {
  if (!currentUser) return;
  const initials = currentUser.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  document.getElementById('sidebar-avatar').textContent     = initials;
  document.getElementById('sidebar-user-name').textContent  = currentUser.nome;
  document.getElementById('sidebar-user-cargo').textContent = currentUser.cargo.toUpperCase();
}

// ============================================================
//  USUÁRIOS — CRUD
// ============================================================
let editUsrId = null;

const CARGO_BADGE = {
  'Gerente':     'badge-orange',
  'Back Office': 'badge-blue',
  'Tecnico':     'badge-teal',
  'Assessor':    'badge-green',
};

function renderUsuarios() {
  const el = document.getElementById('usuarios-table');
  if (!el) return;
  if (!db.usuarios.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◉</div>
      <div class="empty-title">Nenhum Usuário</div>
      <div class="empty-sub">Cadastre os usuários do sistema</div></div>`;
    return;
  }
  el.innerHTML = `<table class="data-table">
    <thead><tr><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Telefone</th><th>Solicitações</th><th></th></tr></thead>
    <tbody>
    ${db.usuarios.map(u => {
      const badge = CARGO_BADGE[u.cargo] || 'badge-gray';
      const nSols = db.movimentacoes.filter(m => m.tecnico === u.nome).length;
      const isMe  = currentUser?.id === u.id;
      return `<tr ${isMe?'style="background:rgba(212,140,50,0.06)"':''}>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:var(--accent);display:flex;
              align-items:center;justify-content:center;font-family:var(--display);font-weight:700;
              font-size:11px;color:var(--bg);flex-shrink:0">
              ${u.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
            </div>
            <strong>${u.nome}</strong>${isMe?' <span style="font-family:var(--mono);font-size:9px;color:var(--accent)">(você)</span>':''}
          </div>
        </td>
        <td><span class="badge ${badge}">${u.cargo}</span></td>
        <td class="mono" style="font-size:12px">${u.email}</td>
        <td style="font-size:12px;color:var(--text2)">${u.tel||'—'}</td>
        <td class="mono" style="color:var(--text3)">${nSols}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="abrirModalUsuario('${u.id}')">Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="resetarSenha('${u.id}')">🔑 Senha</button>
          ${!isMe ? `<button class="btn btn-danger btn-sm" onclick="deleteUsuario('${u.id}')">✕</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
  document.getElementById('badge-usuarios').textContent = db.usuarios.length;
}

function abrirModalUsuario(id) {
  editUsrId = id || null;
  const u = id ? db.usuarios.find(x=>x.id===id) : null;
  document.getElementById('modal-usuario-title').textContent = u ? 'Editar Usuário' : 'Novo Usuário';
  document.getElementById('usr-nome').value  = u?.nome  || '';
  document.getElementById('usr-cargo').value = u?.cargo || 'Tecnico';
  document.getElementById('usr-tel').value   = u?.tel   || '';
  document.getElementById('usr-email').value = u?.email || '';
  document.getElementById('usr-senha').value = '';
  document.getElementById('usr-senha-confirm').value = '';
  // Ao editar, senha é opcional
  const senhaLabel = document.querySelector('#usr-senha-group .form-label');
  if (senhaLabel) senhaLabel.textContent = u ? 'Nova Senha (deixe em branco para manter)' : 'Senha *';
  document.getElementById('modal-usuario').style.display = 'flex';
}

function fecharModalUsuario() {
  document.getElementById('modal-usuario').style.display = 'none';
  editUsrId = null;
}

function salvarUsuario() {
  const nome  = document.getElementById('usr-nome').value.trim();
  const cargo = document.getElementById('usr-cargo').value;
  const tel   = document.getElementById('usr-tel').value.trim();
  const email = document.getElementById('usr-email').value.trim().toLowerCase();
  const senha = document.getElementById('usr-senha').value;
  const conf  = document.getElementById('usr-senha-confirm').value;

  if (!nome || !email) { toast('Nome e e-mail são obrigatórios', 'error'); return; }
  if (!editUsrId && !senha) { toast('Informe uma senha', 'error'); return; }
  if (senha && senha.length < 6) { toast('Senha deve ter mínimo 6 caracteres', 'error'); return; }
  if (senha && senha !== conf) { toast('As senhas não conferem', 'error'); return; }

  const data = { nome, cargo, tel, email };
  if (senha) data.senha = senha;

  const fn = editUsrId ? API.put('/usuarios/' + editUsrId, data) : API.post('/usuarios', data);
  fn.then(() => {
    toast('Usuário salvo');
    fecharModalUsuario();
    loadAndRenderUsuarios();
  }).catch(err => toast(err.message, 'error'));
}
function deleteUsuario(id) {
  if (!confirm('Remover este usuário?')) return;
  API.delete('/usuarios/' + id)
    .then(() => { toast('Usuário removido', 'info'); loadAndRenderUsuarios(); })
    .catch(err => toast(err.message, 'error'));
}
function resetarSenha(id) {
  const u = db.usuarios.find(x=>x.id===id);
  if (!u) return;
  abrirModalUsuario(id);
  setTimeout(() => document.getElementById('usr-senha').focus(), 100);
}

// Autocomplete de usuário/técnico (usado no form movimentação e no modal alocação)
// Mantém compatibilidade com filtrarTecnicosMov
function filtrarTecnicosMov(q, prefix) {
  const ddId  = prefix === 'am' ? 'am-tecnico-dropdown' : 'mov-tecnico-dropdown';
  const dd    = document.getElementById(ddId);
  if (!dd) return;
  const ql    = (q||'').toLowerCase().trim();
  // Busca em usuários (todos os cargos que podem ser técnicos de campo)
  const lista = db.usuarios.filter(u =>
    !ql ||
    u.nome.toLowerCase().includes(ql) ||
    (u.email||'').toLowerCase().includes(ql)
  );
  if (!lista.length) { dd.style.display='none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = lista.map(u => {
    const badge = CARGO_BADGE[u.cargo] || 'badge-gray';
    return `
    <div onclick="selecionarTecnico('${u.id}','${prefix}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="width:26px;height:26px;border-radius:50%;background:var(--accent);display:flex;
        align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--bg);flex-shrink:0">
        ${u.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
      </div>
      <div>
        <span style="font-size:13px;font-weight:600;color:var(--text)">${u.nome}</span>
        <span class="badge ${badge}" style="margin-left:6px;font-size:9px">${u.cargo}</span>
        ${u.email ? `<div style="font-family:var(--mono);font-size:10px;color:var(--text3)">${u.email}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function selecionarTecnico(id, prefix) {
  const u = db.usuarios.find(x=>x.id===id);
  if (!u) return;
  if (prefix === 'am') {
    document.getElementById('am-tec-nome').value  = u.nome;
    document.getElementById('am-tec-email').value = u.email||'';
    document.getElementById('am-tecnico-dropdown').style.display = 'none';
  } else {
    document.getElementById('mov-tecnico').value       = u.nome;
    document.getElementById('mov-tecnico-email').value = u.email||'';
    document.getElementById('mov-tecnico-dropdown').style.display = 'none';
  }
}

function fecharDropdownTecnico(prefix) {
  const ddId = prefix === 'am' ? 'am-tecnico-dropdown' : 'mov-tecnico-dropdown';
  const dd = document.getElementById(ddId);
  if (dd) dd.style.display = 'none';
}

// ============================================================
//  LOGÍSTICA — PAINEL
// ============================================================
let logTab = 'envios';

function switchLogTab(tab) {
  logTab = tab;
  ['envios','retornos'].forEach(t => {
    const btn = document.getElementById('log-tab-'+t);
    if (btn) {
      btn.style.background = t===tab ? 'var(--accent)' : 'var(--surface2)';
      btn.style.color      = t===tab ? 'var(--bg)'     : 'var(--text2)';
    }
  });
  renderLogistica(tab);
}

function renderLogistica(tab) {
  logTab = tab || logTab;
  const el = document.getElementById('log-content');

  // Envios: status ENVIADA ou COMPRA_PENDENTE (aguardando despacho)
  // Retornos: tipoAlocacao=RETORNO e status SOLICITADA/ENVIADA/DESPACHADA
  let list;
  if (logTab === 'envios') {
    list = db.movimentacoes.filter(m => ['ENVIADA','COMPRA_PENDENTE'].includes(m.status));
  } else {
    list = db.movimentacoes.filter(m =>
      m.tipoAlocacao === 'RETORNO' && !['FINALIZADO'].includes(m.status)
    );
  }

  // Update badge total
  const totalLogistica = db.movimentacoes.filter(m =>
    ['ENVIADA','COMPRA_PENDENTE'].includes(m.status) ||
    (m.tipoAlocacao==='RETORNO' && m.status!=='FINALIZADO')
  ).length;
  const badgeEl = document.getElementById('badge-logistica');
  if (badgeEl) badgeEl.textContent = totalLogistica;

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${logTab==='envios'?'⬆':'↩'}</div>
      <div class="empty-title">${logTab==='envios'?'Nenhum Envio Pendente':'Nenhum Retorno Pendente'}</div>
      <div class="empty-sub">${logTab==='envios'?'Todos os envios foram despachados':'Nenhuma peça aguardando retorno'}</div>
    </div>`;
    return;
  }

  el.innerHTML = list.map(m => {
    const ps    = PIPELINE_STATUS[m.status] || PIPELINE_STATUS.SOLICITADA;
    const isRet = m.tipoAlocacao === 'RETORNO';

    let acoes = '';
    if (logTab === 'envios') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','DESPACHAR')">📦 Despachar</button>`;
    } else {
      if (m.status === 'SOLICITADA' || m.status === 'ENVIADA') {
        acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','DESPACHAR')">📦 Despachar</button>`;
      } else if (m.status === 'DESPACHADA') {
        acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','RECEBER')">✓ Receber</button>`;
      }
    }

    return `<div class="sol-card">
      <div style="flex-shrink:0;text-align:center;min-width:100px">
        <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:${isRet?'var(--red)':'var(--accent)'};margin-bottom:4px">
          #${m.numSeq||'—'}${isRet?' ↩':''}
        </div>
        <span class="badge ${ps.badge}" style="display:inline-block;margin-bottom:4px">${ps.label}</span>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">${formatDate(m.eventos?.[0]?.data||0)}</div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <div style="display:flex;align-items:center;gap:10px">
          ${m.pecaImagem ? `<img src="${m.pecaImagem}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border2);flex-shrink:0;cursor:pointer" onclick="abrirVisualizadorImg('${m.pecaId}')" title="Ver peça">` : ''}
          <div>
            <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent)">${m.pecaCodigo}</span>
            <span style="font-size:13px;font-weight:600;color:var(--text)">${m.pecaNome}</span>
            <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${m.qtd} ${m.pecaUnidade}</span>
          </div>
        </div>
        ${m.equipSerie ? `<div style="font-size:12px;color:var(--text2)">
          S/N: <span style="font-family:var(--mono);color:var(--text)">${m.equipSerie}</span>
          · <span style="color:var(--text3)">${m.equipNome||''}</span>
          ${m.equipCliente ? `· <span style="color:var(--text3)">${m.equipCliente}</span>` : ''}
        </div>` : ''}
        ${m.doadoraModelo ? `<div style="font-size:11px;margin-top:3px;display:flex;align-items:center;gap:6px">
          <span style="background:rgba(52,152,219,0.12);border:1px solid rgba(52,152,219,0.3);color:#3498db;font-family:var(--mono);font-size:9px;padding:1px 7px;border-radius:2px;letter-spacing:1px">⊘ DOADORA</span>
          <span style="font-family:var(--mono);color:var(--text2)">${m.doadoraModelo}${m.doadoraSerie?' · '+m.doadoraSerie:''}</span>
        </div>` : ''}
        ${m.tecnico ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">Técnico: ${m.tecnico}${m.emailTecnico?` · <span style="font-family:var(--mono)">${m.emailTecnico}</span>`:''}</div>` : ''}
        ${m.transportadora ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">📦 ${m.transportadora}${m.rastreio?' · '+m.rastreio:''}${m.previsaoEntrega?' · Prev: '+m.previsaoEntrega:''}</div>` : ''}
        ${m.obs ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;font-style:italic">"${m.obs}"</div>` : ''}
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${acoes}
        <button class="btn btn-ghost btn-sm" onclick="verEventos('${m.id}')" style="font-size:10px">⊙ Histórico</button>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
//  URL ACTION HANDLER — links nos emails abrem ação automática
// ============================================================
function processarURLAction() {
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');
  const id     = params.get('id');
  const token  = params.get('token'); // segurança básica: hash do id

  if (!action || !id) return;

  // Validação simples: token deve ser os primeiros 6 chars do id
  const expectedToken = id.substring(0,6);
  if (token !== expectedToken) {
    toast('Link inválido ou expirado', 'error');
    return;
  }

  const sol = db.movimentacoes.find(x => x.id === id);
  if (!sol) { toast('Solicitação não encontrada: ' + id, 'error'); return; }

  const agora     = new Date();
  const dataStr   = agora.toLocaleDateString('pt-BR');
  const horaStr   = agora.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
  const tsLabel   = `${dataStr} ${horaStr}`;

  if (action === 'despachar' && ['ENVIADA','COMPRA_PENDENTE','SOLICITADA'].includes(sol.status)) {
    sol.status = 'DESPACHADA';
    sol.transportadora = 'A confirmar';
    sol.eventos.push({ status:'DESPACHADA', data: Date.now(), obs:`Despachado via link de e-mail em ${tsLabel}` });
    toast(`✓ Solicitação #${sol.numSeq} marcada como Despachada em ${tsLabel}`, 'success');

    // Dispara email de confirmação para o técnico
    if (sol.emailTecnico) {
      const baseUrl = window.location.href.split('?')[0];
      const tkn     = sol.id.substring(0,6);
      const linkRec = `${baseUrl}?action=receber&id=${sol.id}&token=${tkn}`;
      const subject = encodeURIComponent(`[PartForge] #${sol.numSeq} — Confirme o Recebimento da Peça`);
      const body    = encodeURIComponent(
        `Olá ${sol.tecnico||''},\n\n` +
        `A peça abaixo foi despachada em ${tsLabel}.\n` +
        `Por favor, confirme o recebimento quando a peça chegar.\n\n` +
        `====================================\n` +
        `  CONFIRMAÇÃO DE RECEBIMENTO\n` +
        `  Nº ${sol.numSeq}\n` +
        `====================================\n\n` +
        `Peça:        ${sol.pecaCodigo} — ${sol.pecaNome}\n` +
        `Quantidade:  ${sol.qtd} ${sol.pecaUnidade}\n` +
        `Equipamento: ${sol.equipNome||'—'}\n` +
        `Nº de Série: ${sol.equipSerie||'—'}\n` +
        `Cliente:     ${sol.equipCliente||'—'}\n\n` +
        `>> CLIQUE AQUI PARA CONFIRMAR O RECEBIMENTO:\n` +
        `${linkRec}\n\n` +
        `====================================`
      );
      setTimeout(() => {
        window.open(`mailto:${sol.emailTecnico}?subject=${subject}&body=${body}`);
      }, 800);
    }

    updateBadges(); renderHistorico(); renderDashboard();
    // Navegar para historico
    const navHistEl = document.querySelector('.nav-item[onclick*="historico"]');
    if (navHistEl) navigate('historico', navHistEl);

  } else if (action === 'receber' && sol.status === 'DESPACHADA') {
    const agora2 = new Date();
    sol.dataRecebimento = agora2.toLocaleDateString('pt-BR');
    sol.horaRecebimento = agora2.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
    sol.status = 'RECEBIDA';
    sol.eventos.push({ status:'RECEBIDA', data: Date.now(), obs:`Confirmado via link de e-mail em ${tsLabel}` });
    toast(`✓ Solicitação #${sol.numSeq} marcada como Recebida em ${tsLabel}`, 'success');
    updateBadges(); renderHistorico(); renderDashboard();
    const navHistEl = document.querySelector('.nav-item[onclick*="historico"]');
    if (navHistEl) navigate('historico', navHistEl);

  } else if (action === 'retorno' && sol.status !== 'FINALIZADO') {
    toast(`Solicitação de retorno #${sol.numSeq} — acesse o Histórico para prosseguir`, 'info');
    const navHistEl = document.querySelector('.nav-item[onclick*="historico"]');
    if (navHistEl) navigate('historico', navHistEl);

  } else {
    toast(`Ação "${action}" não aplicável ao status atual (${sol.status})`, 'info');
  }

  // Limpa os params da URL sem recarregar
  window.history.replaceState({}, '', window.location.pathname);
}

// ============================================================
//  RENDER HISTÓRICO (pipeline cards)
// ============================================================
function renderHistorico(q='', statusFilter='') {
  const el = document.getElementById('hist-table');
  const sf = statusFilter || (document.getElementById('hist-filter-status')?.value||'');
  let list = [...db.movimentacoes];
  // Técnico vê apenas suas próprias solicitações
  if (currentUser && currentUser.cargo === 'Tecnico') {
    list = list.filter(m => m.tecnico === currentUser.nome);
  }
  if (sf) list = list.filter(m => m.status === sf);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(m =>
      String(m.pecaNome||'').toLowerCase().includes(ql) ||
      String(m.pecaCodigo||'').toLowerCase().includes(ql) ||
      String(m.equipSerie||'').toLowerCase().includes(ql) ||
      String(m.equipCliente||'').toLowerCase().includes(ql) ||
      String(m.tecnico||'').toLowerCase().includes(ql)
    );
  }

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">≡</div><div class="empty-title">Nenhum Registro</div><div class="empty-sub">Nenhuma solicitação encontrada</div></div>`;
    return;
  }

  el.innerHTML = list.map(m => {
    const ps    = PIPELINE_STATUS[m.status] || PIPELINE_STATUS.SOLICITADA;
    const isFin = m.status === 'FINALIZADO';
    const peca  = db.pecas.find(x => x.id === m.pecaId);

    // Botões de ação conforme status atual
    let acoes = '';
    if (m.status === 'SOLICITADA') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','ENVIAR')">✉ Enviar</button>`;
      if (!m.temEstoque) acoes += ` <button class="btn btn-ghost btn-sm" style="color:var(--accent)" onclick="abrirActionModal('${m.id}','COMPRA')">🛒 Compra</button>`;
    } else if (m.status === 'ENVIADA' || m.status === 'COMPRA_PENDENTE') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','DESPACHAR')">📦 Despachar</button>`;
    } else if (m.status === 'DESPACHADA') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','RECEBER')">✓ Receber</button>`;
    } else if (m.status === 'RECEBIDA') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','ALOCAR')">⇢ Alocar</button>`;
    } else if (m.status === 'ALOCADA') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','EMITIR_NF')">📄 Emitir NF</button>`;
    } else if (m.status === 'NF_EMITIDA') {
      acoes = `<button class="btn btn-success btn-sm" onclick="abrirActionModal('${m.id}','FINALIZAR')">✓ Finalizar</button>`;
    }

    // Timeline de eventos resumida
    const ultimoEvt = m.eventos?.[m.eventos.length-1];

    // Info despacho
    const despachoInfo = m.transportadora
      ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">
          📦 ${m.transportadora}
          ${m.rastreio ? `· <span style="font-family:var(--mono)">${m.rastreio}</span>` : ''}
          ${m.previsaoEntrega ? `· Prev: ${m.previsaoEntrega}` : ''}
         </div>` : '';

    const recInfo = m.dataRecebimento
      ? `<div style="font-size:11px;color:#1abc9c;margin-top:3px">✓ Recebido: ${m.dataRecebimento} ${m.horaRecebimento}</div>` : '';

    const nfInfo = m.nfNumero
      ? `<div style="font-size:11px;color:#f1c40f;margin-top:3px">📄 NF ${m.nfNumero} · ${m.nfData}</div>` : '';

    return `
    <div class="sol-card ${isFin?'finalizado':''}">

      <!-- Status badge + pipeline mini -->
      <div style="flex-shrink:0;text-align:center;min-width:100px">
        <div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);margin-bottom:4px">
          #${m.numSeq||'—'}
          ${m.devolucao ? `<span style="color:var(--red);font-size:10px"> ↩R</span>` : ''}
          ${m.tipoAlocacao==='RETORNO' ? `<span class="badge badge-red" style="font-size:9px;margin-left:4px">RETORNO</span>` : ''}
        </div>
        <span class="badge ${ps.badge}" style="margin-bottom:6px;display:inline-block">${ps.label}</span>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">${formatDate(m.eventos?.[0]?.data||0)}</div>
      </div>

      <!-- Main info -->
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent)">${m.pecaCodigo}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text)">${m.pecaNome}</span>
          <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${m.qtd} ${m.pecaUnidade}</span>
          ${!m.temEstoque ? `<span class="badge badge-orange" style="font-size:9px">Sem Estoque</span>` : ''}
        </div>
        ${m.equipSerie ? `<div style="font-size:12px;color:var(--text2)">
          S/N: <span style="font-family:var(--mono);color:var(--text)">${m.equipSerie}</span>
          ${m.equipCliente ? `· <span style="color:var(--text3)">${m.equipCliente}</span>` : ''}
          ${m.equipNome ? `· <span style="color:var(--text3);font-size:11px">${m.equipNome}</span>` : ''}
        </div>` : ''}
        ${m.tecnico ? `<div style="font-size:11px;color:var(--text3)">Solicitante: ${m.tecnico}${m.emailTecnico?` · <span style="font-family:var(--mono)">${m.emailTecnico}</span>`:''}</div>` : ''}
        ${despachoInfo}${recInfo}${nfInfo}
        ${m.tipoAlocacao && m.tipoAlocacao !== 'RETORNO' ? `<div style="font-size:11px;color:var(--green);margin-top:3px">✓ ${m.tipoAlocacao}${m.osNum ? ` · OS: <span style="font-family:var(--mono)">${m.osNum}</span>` : ''}</div>` : ''}
        ${m.tipoAlocacao === 'RETORNO' ? `<div style="font-size:11px;color:var(--red);margin-top:3px">↩ Retorno de peça defeituosa${m.osNum ? ` · OS: <span style="font-family:var(--mono)">${m.osNum}</span>` : ''}</div>` : ''}
        ${m.numSeqRetorno ? `<div style="font-size:11px;color:var(--red);margin-top:2px">Retorno gerado: <strong style="font-family:var(--mono)">${m.numSeqRetorno}</strong></div>` : ''}
        ${m.obs ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;font-style:italic">"${m.obs}"</div>` : ''}
      </div>

      <!-- Ações -->
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${acoes}
        <button class="btn btn-ghost btn-sm" onclick="verEventos('${m.id}')" style="font-size:10px">⊙ Histórico</button>
      </div>

    </div>`;
  }).join('');
}

function verEventos(id) {
  const sol = db.movimentacoes.find(x => x.id === id);
  if (!sol) return;
  actionModalTarget = id;
  const title  = document.getElementById('action-modal-title');
  const body   = document.getElementById('action-modal-body');
  const footer = document.getElementById('action-modal-footer');
  title.textContent = 'Histórico da Solicitação';
  body.innerHTML = `
    <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px">${sol.pecaCodigo} · ${sol.pecaNome}</div>
    <div style="border-left:2px solid var(--border);padding-left:16px">
    ${(sol.eventos||[]).map(e => {
      const ps = PIPELINE_STATUS[e.status] || {};
      return `<div style="margin-bottom:12px;position:relative">
        <div style="position:absolute;left:-21px;top:4px;width:8px;height:8px;border-radius:50%;
          background:${ps.cor||'var(--text3)'}"></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${ps.badge||'badge-gray'}" style="font-size:9px">${ps.label||e.status}</span>
          <span style="font-family:var(--mono);font-size:10px;color:var(--text3)">${formatDate(e.data)}</span>
        </div>
        ${e.obs ? `<div style="font-size:11px;color:var(--text3);margin-top:3px">${e.obs}</div>` : ''}
      </div>`;
    }).join('')}
    </div>`;
  footer.innerHTML = `<button class="btn btn-ghost" onclick="fecharActionModal()">Fechar</button>`;
  document.getElementById('action-modal').classList.add('open');
}

// ============================================================
//  MOVIMENTAÇÃO — BUSCA DE PEÇAS (dropdown)
// ============================================================
// ============================================================
//  ORÇAMENTOS — CRUD + PDF
// ============================================================
let editOrcId = null;
let orcItens  = [];

const ORC_STATUS = {
  RASCUNHO:  { label:'Rascunho',  badge:'badge-gray'   },
  APROVADO:  { label:'Aprovado',  badge:'badge-green'  },
  FATURANDO: { label:'Faturando', badge:'badge-orange' },
  FATURADO:  { label:'Faturado',  badge:'badge-blue'   },
  CANCELADO: { label:'Cancelado', badge:'badge-red'    },
};

function renderOrcamentos(q='') {
  const el = document.getElementById('orcamento-table');
  if (!el) return;
  const sf = document.getElementById('orc-filter-status')?.value || '';
  let list = [...db.orcamentos].sort((a,b)=> (b.data||'').localeCompare(a.data||''));
  if (sf) list = list.filter(x => x.status === sf);
  if (q)  list = list.filter(x =>
    (x.numero||'').toLowerCase().includes(q.toLowerCase()) ||
    (x.cliente||'').toLowerCase().includes(q.toLowerCase()) ||
    (x.equipSerie||'').toLowerCase().includes(q.toLowerCase()) ||
    (x.itens||[]).some(i => (i.desc||'').toLowerCase().includes(q.toLowerCase()))
  );
  document.getElementById('badge-orcamento').textContent = db.orcamentos.filter(x=>x.status!=='CANCELADO').length || '';
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div>
      <div class="empty-title">Nenhum Orçamento</div>
      <div class="empty-sub">Crie o primeiro orçamento</div></div>`;
    return;
  }
  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Número</th><th>Status</th><th>Cliente</th><th>S/N Equip.</th>
      <th>OS</th><th>Itens</th><th>Total</th><th>Data</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(o => {
      const st = ORC_STATUS[o.status] || ORC_STATUS.RASCUNHO;
      return `<tr>
        <td><strong style="font-family:var(--mono)">${o.numero}</strong></td>
        <td><span class="badge ${st.badge}">${st.label}</span></td>
        <td style="font-size:12px">${o.cliente||'—'}</td>
        <td class="mono">${o.equipSerie||'—'}</td>
        <td class="mono">${o.os||'—'}</td>
        <td class="mono">${(o.itens||[]).length}</td>
        <td class="mono" style="color:var(--accent);font-weight:700">R$ ${parseFloat(o.total||0).toFixed(2)}</td>
        <td class="mono">${o.data||'—'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="abrirModalOrcamento('${o.id}')">Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="alterarStatusOrc('${o.id}')">${o.status==='RASCUNHO'?'✓ Aprovar':o.status==='APROVADO'?'✕ Cancelar':'—'}</button>
          <button class="btn btn-sm" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3)" onclick="gerarPDFOrcamento('${o.id}')">⬇ PDF</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrcamento('${o.id}')">✕</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

function abrirModalOrcamento(id) {
  editOrcId = id || null;
  const o   = id ? db.orcamentos.find(x=>x.id===id) : null;
  const cfg = db.configOrcamento || {};
  orcItens  = o ? JSON.parse(JSON.stringify(o.itens||[])) : [];

  document.getElementById('modal-orcamento-title').textContent = o ? 'Editar Orçamento' : 'Novo Orçamento';
  if(!o){const nums=db.orcamentos.map(x=>parseInt(x.numero)||0).filter(n=>n>900);const next=nums.length?Math.max(...nums)+1:979;document.getElementById('orc-numero').value=String(next);}else{document.getElementById('orc-numero').value=o.numero;}
  document.getElementById('orc-status').value      = o?.status     || 'RASCUNHO';
  document.getElementById('orc-cliente').value     = o?.cliente    || '';
  document.getElementById('orc-serie').value       = o?.equipSerie || '';
  document.getElementById('orc-equip-nome').value  = o?.equipNome  || '';
  document.getElementById('orc-os').value          = o?.os         || '';
  document.getElementById('orc-data').value        = o?.data       || new Date().toISOString().slice(0,10);
  document.getElementById('orc-obs').value         = o?.obs        || '';
  // Condições — popula selects com valores salvos ou defaults da config
  const setOrcSelect = (id, val, fallback) => {
    const el = document.getElementById(id);
    if (!el) return;
    const target = val || fallback || el.options[0]?.value;
    for (let opt of el.options) { if (opt.value === target) { opt.selected = true; return; } }
  };
  setOrcSelect('orc-validade',  o?.validade,  cfg.validade       || '30 dias');
  setOrcSelect('orc-pagamento', o?.pagamento, cfg.formaPagamento || '30 dias');
  setOrcSelect('orc-entrega',   o?.entrega,   cfg.prazoEntrega   || 'À combinar');
  setOrcSelect('orc-frete',     o?.frete,     'FOB');
  // Observações adicionais (texto livre)
  const condEl = document.getElementById('orc-condicoes');
  if (condEl) condEl.value = o?.obsCondicoes || '';
  // Atualiza hidden com texto compilado
  atualizarCondicoesOrc();
  ['orc-item-cod','orc-item-desc','orc-item-valor'].forEach(fid => {
    const el = document.getElementById(fid); if (el) el.value='';
  });
  const qtdEl = document.getElementById('orc-item-qtd'); if (qtdEl) qtdEl.value='1';
  const imgEl = document.getElementById('orc-item-img'); if (imgEl) { imgEl.style.display='none'; imgEl.innerHTML=''; }
  renderItensOrc();
  document.getElementById('modal-orcamento').style.display = 'flex';
}

function fecharModalOrcamento() {
  document.getElementById('modal-orcamento').style.display = 'none';
  editOrcId = null; orcItens = [];
}

function resetarCondicoesOrc() {
  const validade  = document.getElementById('orc-validade')?.value  || '30 dias';
  const pagamento = document.getElementById('orc-pagamento')?.value || '30 dias';
  const entrega   = document.getElementById('orc-entrega')?.value   || 'À combinar';
  const frete     = document.getElementById('orc-frete')?.value     || 'FOB';
  const condEl = document.getElementById('orc-condicoes');
  if (condEl) condEl.value = '';
  atualizarCondicoesOrc();
}

function sugerirPecaOrc(q) {
  const dd = document.getElementById('orc-peca-dropdown');
  if (!dd) return;
  const ql = q.toLowerCase().trim();
  const list = db.pecas.filter(p =>
    !ql ||
    String(p.codigo||'').toLowerCase().includes(ql) ||
    String(p.nome||'').toLowerCase().includes(ql) ||
    String(p.fonte||'').toLowerCase().includes(ql)
  ).slice(0, 50);
  dd.style.display = list.length ? 'block' : 'none';
  dd.innerHTML = list.map(p => {
    const venda = p.valor_venda || 0;
    const img = p.imagem
      ? `<img src="${p.imagem}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;flex-shrink:0">`
      : `<div style="width:30px;height:30px;background:var(--surface);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px">⬡</div>`;
    return `<div onmousedown="selecionarPecaOrc(\'${p.id}\')"
      style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border)"
      onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">${img}
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${p.codigo}</div>
        <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nome}</div>
        <div style="font-size:10px;color:var(--text3)">${p.fonte||''} ${p.linha ? '· '+p.linha : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:9px;color:var(--text3)">V.Venda</div>
        <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--green)">R$ ${venda.toFixed(2)}</div>
      </div>
    </div>`;
  }).join('');
}

function selecionarPecaOrc(pecaId) {
  const p = db.pecas.find(x => x.id === pecaId);
  if (!p) return;
  document.getElementById('orc-peca-dropdown').style.display = 'none';
  document.getElementById('orc-item-cod').value   = p.codigo;
  document.getElementById('orc-item-desc').value  = p.nome;
  document.getElementById('orc-item-valor').value = (p.valor_venda || 0).toFixed(2);
  const imgEl = document.getElementById('orc-item-img');
  if (imgEl) {
    if (p.imagem) { imgEl.style.display='block'; imgEl.innerHTML=`<img src="${p.imagem}" style="width:100%;height:100%;object-fit:cover">`; }
    else imgEl.style.display='none';
  }
}

function fecharDropdownPecaOrc() {
  const dd = document.getElementById('orc-peca-dropdown');
  if (dd) dd.style.display = 'none';
}

function filtrarEquipOrc(q) {
  const dd = document.getElementById('orc-equip-dropdown');
  if (!dd) return;
  const ql = q.toLowerCase().trim();
  const list = db.equipamentos.filter(e =>
    !ql ||
    String(e.serie||'').toLowerCase().includes(ql) ||
    String(e.codigo||'').toLowerCase().includes(ql) ||
    String(e.nome||'').toLowerCase().includes(ql) ||
    String(e.nome_fantasia||'').toLowerCase().includes(ql) ||
    String(e.modelo||'').toLowerCase().includes(ql) ||
    String(e.municipio||'').toLowerCase().includes(ql)
  ).slice(0, 60);
  dd.style.display = list.length ? 'block' : 'none';
  const statusColor = {
    'Em Contrato':'var(--green)','Disponivel':'var(--blue)',
    'Em OS - Com Contrato':'var(--accent)','Em OS - Sem Contrato':'var(--red)','Inativo':'var(--text3)'
  };
  dd.innerHTML = list.map(e => {
    const cor    = statusColor[e.status] || 'var(--text3)';
    const serie  = e.serie || e.codigo;
    const client = e.nome_fantasia ? e.nome_fantasia.replace(/\[\d+\]$/,'').trim() : '';
    return `<div onmousedown="selecionarEquipOrc('${e.id}')"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.1s"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${serie}</span>
          <span style="font-size:12px;color:var(--text);margin-left:8px">${e.nome}</span>
        </div>
        <span style="font-family:var(--mono);font-size:10px;color:${cor};white-space:nowrap;flex-shrink:0">${e.status||''}</span>
      </div>
      ${client ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">👤 ${client}${e.municipio ? ' · '+e.municipio+(e.uf?'/'+e.uf:'') : ''}</div>` : ''}
    </div>`;
  }).join('');
}

function selecionarEquipOrc(equipId) {
  const e = db.equipamentos.find(x => x.id === equipId);
  if (!e) return;
  document.getElementById('orc-equip-dropdown').style.display = 'none';
  document.getElementById('orc-serie').value      = e.serie || e.codigo || '';
  document.getElementById('orc-equip-nome').value = e.nome || '';
  const clienteEl = document.getElementById('orc-cliente');
  if (clienteEl && e.nome_fantasia && !clienteEl.value) {
    clienteEl.value = e.nome_fantasia.replace(/\[\d+\]$/,'').trim();
  }
}

function fecharDropdownEquipOrc() {
  const dd = document.getElementById('orc-equip-dropdown');
  if (dd) dd.style.display = 'none';
}

function renderItensOrc() {
  const el = document.getElementById('orc-itens-lista');
  if (!el) return;
  if (!orcItens.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);padding:8px 0;font-style:italic">Nenhum item adicionado</div>`;
  } else {
    el.innerHTML = `<table class="data-table" style="margin-bottom:8px">
      <thead><tr><th style="width:44px">Foto</th><th>P/N</th><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th><th></th></tr></thead>
      <tbody>${orcItens.map((it,i)=>{
        const peca = db.pecas.find(p=>p.codigo===it.cod);
        const imgHtml = peca?.imagem ? `<img src="${peca.imagem}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid var(--border2);cursor:pointer" onclick="abrirVisualizadorImg(\'${peca.id}\')">` : '';
        return `<tr><td>${imgHtml}</td>
          <td class="mono" style="font-size:11px;color:var(--accent)">${it.cod||'—'}</td>
          <td style="font-size:12px">${it.desc}</td>
          <td class="mono">${it.qtd}</td>
          <td class="mono">R$ ${parseFloat(it.valor||0).toFixed(2)}</td>
          <td class="mono" style="color:var(--accent);font-weight:700">R$ ${(it.qtd*(parseFloat(it.valor)||0)).toFixed(2)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="removerItemOrc(${i})">✕</button></td></tr>`;
      }).join('')}</tbody></table>`;
  }
  const total = orcItens.reduce((s,it) => s + it.qtd*(parseFloat(it.valor)||0), 0);
  document.getElementById('orc-total-display').textContent = `R$ ${total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`;
}

function adicionarItemOrc() {
  const cod   = document.getElementById('orc-item-cod').value.trim();
  const desc  = document.getElementById('orc-item-desc').value.trim();
  const qtd   = parseInt(document.getElementById('orc-item-qtd').value)||1;
  const valor = parseFloat(document.getElementById('orc-item-valor').value)||0;
  if (!desc) { toast('Informe a descrição do item', 'error'); return; }
  const peca  = cod ? db.pecas.find(p=>p.codigo===cod) : null;
  orcItens.push({ cod, desc, qtd, valor, custoUnit: peca?.custo||0 });
  ['orc-item-cod','orc-item-desc','orc-item-valor'].forEach(fid => { const el=document.getElementById(fid); if(el) el.value=''; });
  const qtdEl = document.getElementById('orc-item-qtd'); if (qtdEl) qtdEl.value='1';
  const imgEl = document.getElementById('orc-item-img'); if (imgEl) { imgEl.style.display='none'; imgEl.innerHTML=''; }
  renderItensOrc();
}

function removerItemOrc(idx) { orcItens.splice(idx,1); renderItensOrc(); }

function salvarOrcamento() {
  const numero = document.getElementById('orc-numero').value.trim();
  if (!numero) { toast('Informe o número do orçamento', 'error'); return; }
  const total = orcItens.reduce((s,it) => s + it.qtd*(parseFloat(it.valor)||0), 0);
  const data = {
    numero, total,
    status:     document.getElementById('orc-status').value,
    cliente:    document.getElementById('orc-cliente').value.trim(),
    equip_serie: document.getElementById('orc-serie').value.trim(),
    equip_nome:  document.getElementById('orc-equip-nome').value.trim(),
    os:         document.getElementById('orc-os').value.trim(),
    data:       document.getElementById('orc-data').value,
    obs:        document.getElementById('orc-obs').value.trim(),
    validade:   document.getElementById('orc-validade')?.value   || '30 dias',
    pagamento:  document.getElementById('orc-pagamento')?.value  || '30 dias',
    entrega:    document.getElementById('orc-entrega')?.value    || 'A combinar',
    frete:      document.getElementById('orc-frete')?.value      || 'FOB',
    obs_condicoes: document.getElementById('orc-condicoes')?.value || '',
    condicoes:  document.getElementById('orc-condicoes-geradas')?.value || '',
    assinatura: currentUser?.nome || '',
    itens:      [...orcItens],
  };

  const fn = editOrcId ? API.put('/orcamentos/' + editOrcId, data) : API.post('/orcamentos', data);
  fn.then(() => {
    toast('Orçamento salvo');
    fecharModalOrcamento();
    loadAndRenderOrcamentos();
  }).catch(err => toast(err.message, 'error'));
}
function alterarStatusOrc(id) {
  const o = db.orcamentos.find(x=>x.id===id);
  if (!o) return;
  if (o.status==='RASCUNHO')  { o.status='APROVADO';  toast('Orçamento aprovado ✓','success'); }
  else if (o.status==='APROVADO') { o.status='CANCELADO'; toast('Orçamento cancelado'); }
  salvarDB(); renderOrcamentos();
}

function deleteOrcamento(id) {
  if (!confirm('Excluir este orçamento?')) return;
  API.delete('/orcamentos/' + id)
    .then(() => { toast('Orçamento excluído', 'info'); loadAndRenderOrcamentos(); })
    .catch(err => toast(err.message, 'error'));
}
function atualizarValorPorOrc(orcId, solId) {
  if (!orcId) return;
  const orc = db.orcamentos.find(x=>x.id===orcId);
  if (!orc) return;
  const valorEl = document.getElementById('am-valor-venda');
  if (valorEl) valorEl.value = orc.total.toFixed(2);
}

function gerarCondicoesAuto(force) {
  const validade   = document.getElementById('cfg-orc-validade')?.value   || '30 dias';
  const pagamento  = document.getElementById('cfg-orc-pagamento')?.value  || '30 dias';
  const entrega    = document.getElementById('cfg-orc-prazo')?.value      || 'À combinar';
  const condEl     = document.getElementById('cfg-orc-condicoes');
  if (!condEl) return;
  if (!force && condEl.value.trim()) return;
  condEl.value = buildCondicoesText(validade, pagamento, entrega, 'FOB', '');
}

function buildCondicoesText(validade, pagamento, entrega, frete, obsExtra) {
  const freteLabel = frete === 'CIF' ? 'CIF — Frete por conta da Quallyx.' : 'FOB — Frete por conta do cliente.';
  const linhas = [
    `1. Validade da proposta: ${validade} a partir da data de emissão.`,
    `2. Prazo de pagamento: ${pagamento}.`,
    `3. Prazo de entrega: ${entrega} após confirmação do pedido.`,
    `4. Frete: ${freteLabel}`,
    `5. Garantia das peças conforme fabricante.`,
    `6. Impostos inclusos nos valores cotados.`,
    `7. Em caso de cancelamento após confirmação do pedido, poderão ser cobrados custos de restoque.`,
    `8. Sujeito à disponibilidade de estoque no momento da confirmação.`,
  ];
  let texto = linhas.join('\n');
  if (obsExtra && obsExtra.trim()) texto += '\n\n' + obsExtra.trim();
  return texto;
}

function atualizarCondicoesOrc() {
  const validade  = document.getElementById('orc-validade')?.value  || '30 dias';
  const pagamento = document.getElementById('orc-pagamento')?.value || '30 dias';
  const entrega   = document.getElementById('orc-entrega')?.value   || 'À combinar';
  const frete     = document.getElementById('orc-frete')?.value     || 'FOB';
  const obsExtra  = document.getElementById('orc-condicoes')?.value || '';
  const hidden    = document.getElementById('orc-condicoes-geradas');
  if (hidden) hidden.value = buildCondicoesText(validade, pagamento, entrega, frete, obsExtra);
}

function abrirConfigOrcamento() {
  const cfg = db.configOrcamento || {};
  document.getElementById('cfg-orc-taxa').value       = cfg.taxa          || '';
  document.getElementById('cfg-orc-dolar').value      = cfg.dolar         || '';
  document.getElementById('cfg-orc-markup').value     = cfg.markup        || '';
  // Selects
  const setSelect = (id, val) => {
    const el = document.getElementById(id);
    if (!el || !val) return;
    for (let opt of el.options) { if (opt.value === val) { opt.selected = true; return; } }
  };
  setSelect('cfg-orc-validade',  cfg.validade       || '30 dias');
  setSelect('cfg-orc-pagamento', cfg.formaPagamento || '30 dias');
  setSelect('cfg-orc-prazo',     cfg.prazoEntrega   || 'À combinar');
  // Condições gerais — auto-gera se vazio
  const condEl = document.getElementById('cfg-orc-condicoes');
  if (condEl) {
    condEl.value = cfg.condicoesGerais || '';
    if (!condEl.value.trim()) gerarCondicoesAuto(true);
  }
  openModal('modal-config-orc');
}

function salvarConfigOrcamento() {
  if (!db.configOrcamento) db.configOrcamento = {};
  const cfg = db.configOrcamento;
  cfg.taxa             = parseFloat(document.getElementById('cfg-orc-taxa')?.value)    || 0;
  cfg.dolar            = parseFloat(document.getElementById('cfg-orc-dolar')?.value)   || 0;
  cfg.markup           = parseFloat(document.getElementById('cfg-orc-markup')?.value)  || 0;
  cfg.validade         = document.getElementById('cfg-orc-validade')?.value   || '30 dias';
  cfg.prazoEntrega     = document.getElementById('cfg-orc-entrega')?.value    || 'A combinar';
  cfg.formaPagamento   = document.getElementById('cfg-orc-pagamento')?.value  || '30 dias';
  cfg.condicoesGerais  = document.getElementById('cfg-orc-condicoes')?.value  || '';

  API.put('/config/config_orcamento', cfg)
    .then(() => { toast('Configuração salva'); closeModal('modal-config-orc'); })
    .catch(err => toast(err.message, 'error'));
}
function gerarPDFOrcamento(id) {
  const o = db.orcamentos.find(x=>x.id===id);
  if (!o) return;
  const cfg = db.configOrcamento || {};
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W = 210, H = 297, ML = 14, MR = 14;

  // ── Palette ────────────────────────────────────────────────────────────────
  const HEADER_BG = [245, 247, 249];   // very light gray header
  const TEAL_LINE = [0, 180, 180];     // teal accent line (slightly muted)
  const TEAL_HEAD = [0, 160, 160];     // table header teal
  const TEAL_TOTAL= [0, 150, 150];     // total box
  const YELLOW    = [255, 204, 0];     // accent yellow (thin stripe)
  const DARK      = [30,  40,  50];    // main text
  const MED       = [70,  85, 100];    // label text
  const LIGHT     = [130, 145, 160];   // footer/light text
  const ROW_ALT   = [248, 250, 252];   // alternate row

  // ── Header (light gray band) ───────────────────────────────────────────────
  doc.setFillColor(...HEADER_BG);
  doc.rect(0, 0, W, 32, 'F');

  // Logo on light gray bg (transparent PNG looks great here)
  try {
    doc.addImage(QUALLYX_LOGO_B64, 'PNG', ML, 4, 58, 24);
  } catch(e) {
    doc.setTextColor(...TEAL_HEAD); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text('QUALLYX', ML, 20);
  }

  // Orçamento / number / status — right side
  doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(13);
  doc.text('ORÇAMENTO', W-MR, 12, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(10);
  doc.setTextColor(...MED);
  doc.text(o.numero, W-MR, 19, {align:'right'});
  const stLabel = ({RASCUNHO:'Rascunho',APROVADO:'Aprovado',CANCELADO:'Cancelado',FATURANDO:'Faturando',FATURADO:'Faturado'})[o.status]||o.status;
  doc.setFontSize(8);
  doc.text(stLabel + '  ·  ' + (o.data||new Date().toLocaleDateString('pt-BR')), W-MR, 25, {align:'right'});

  // Thin yellow accent line below header
  doc.setFillColor(...YELLOW);
  doc.rect(0, 32, W, 1.2, 'F');
  // Thin teal line below yellow
  doc.setFillColor(...TEAL_LINE);
  doc.rect(0, 33.2, W, 0.6, 'F');

  // ── Info block ─────────────────────────────────────────────────────────────
  let y = 42;
  const labelW = 32;
  const infoRows = [
    ['Cliente',      o.cliente    || '—'],
    ['Equipamento',  o.equipNome  || '—'],
    ['Nº de Série',  o.equipSerie || '—'],
    ['OS',           o.os         || '—'],
  ];
  infoRows.forEach(([label, val]) => {
    doc.setFont('helvetica','bold');  doc.setFontSize(8); doc.setTextColor(...LIGHT);
    doc.text(label.toUpperCase() + ':', ML, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(...DARK);
    doc.text(String(val), ML + labelW, y);
    y += 5.5;
  });

  // ── Items table ─────────────────────────────────────────────────────────────
  y += 3;
  doc.autoTable({
    startY: y,
    head: [['#', 'Código', 'Descrição', 'Qtd', 'Valor Unit. (R$)', 'Total (R$)']],
    body: o.itens.map((it,i) => [
      i+1,
      it.cod||'—',
      it.desc,
      it.qtd,
      parseFloat(it.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),
      (it.qtd*(parseFloat(it.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
    ]),
    styles:        { fontSize:9, cellPadding:3.5, textColor:DARK },
    headStyles:    { fillColor:TEAL_HEAD, textColor:[255,255,255], fontStyle:'bold', fontSize:9 },
    alternateRowStyles: { fillColor:ROW_ALT },
    columnStyles:  {
      0:{cellWidth:8,  halign:'center'},
      1:{cellWidth:28, font:'courier'},
      4:{halign:'right'},
      5:{halign:'right', fontStyle:'bold'}
    },
    margin: { left:ML, right:MR },
  });

  // ── Total ──────────────────────────────────────────────────────────────────
  const tableEndY = doc.lastAutoTable.finalY;
  const totalStr  = 'TOTAL: R$ ' + parseFloat(o.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2});
  const boxW = 74, boxH = 10;
  doc.setFillColor(...TEAL_TOTAL);
  doc.roundedRect(W-MR-boxW, tableEndY+4, boxW, boxH, 2, 2, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text(totalStr, W-MR-boxW/2, tableEndY+10.5, {align:'center'});

  // ── Observação ─────────────────────────────────────────────────────────────
  let yNext = tableEndY + boxH + 14;
  if (o.obs) {
    doc.setTextColor(...MED); doc.setFont('helvetica','italic'); doc.setFontSize(8.5);
    doc.text('Obs.:', ML, yNext);
    doc.setFont('helvetica','normal');
    const obsLines = doc.splitTextToSize(o.obs, W-ML-MR-12);
    doc.text(obsLines, ML+11, yNext);
    yNext += obsLines.length*4.5 + 8;
  }

  // ── Condições Gerais ────────────────────────────────────────────────────────
  const condicoes = (o.condicoes || cfg.condicoesGerais || '').trim();
  if (condicoes) {
    if (yNext > H - 55) { doc.addPage(); yNext = 20; }

    doc.setFillColor(...TEAL_HEAD);
    doc.rect(ML, yNext, W-ML-MR, 7, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('CONDIÇÕES GERAIS', ML+3, yNext+5);
    yNext += 10;

    doc.setTextColor(...MED); doc.setFont('helvetica','normal'); doc.setFontSize(8);
    const condLines = doc.splitTextToSize(condicoes, W-ML-MR);
    if (yNext + condLines.length*4.2 > H-20) {
      let rem = condLines;
      while (rem.length > 0) {
        const avail = Math.max(1, Math.floor((H-yNext-20)/4.2));
        doc.text(rem.slice(0,avail), ML, yNext);
        rem = rem.slice(avail);
        if (rem.length) { doc.addPage(); yNext = 20; }
      }
    } else {
      doc.text(condLines, ML, yNext);
      yNext += condLines.length*4.2 + 6;
    }
  }

  // ── Assinatura ─────────────────────────────────────────────────────────────
  const assinatura = o.assinatura || '';
  if (assinatura) {
    const totalPages2 = doc.getNumberOfPages();
    doc.setPage(totalPages2);
    const sigY = H - 40;
    doc.setDrawColor(...LIGHT); doc.setLineWidth(0.3);
    doc.line(ML, sigY, ML + 80, sigY);
    doc.setTextColor(...DARK); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text(assinatura, ML, sigY + 6);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT);
    doc.text('Quallyx Saúde', ML, sigY + 12);
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    // Teal bottom line
    doc.setFillColor(...TEAL_LINE); doc.setDrawColor(...TEAL_LINE);
    doc.line(ML, H-11, W-MR, H-11);
    doc.setLineWidth(0.4); doc.line(ML, H-11, W-MR, H-11);
    doc.setTextColor(...LIGHT); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('Quallyx Saúde  ·  quallyx.com.br', ML, H-6);
    doc.text(`${o.numero}  ·  Pág. ${pg} / ${totalPages}`, W-MR, H-6, {align:'right'});
  }

  const fname = 'Orcamento_' + o.numero + '_' + (o.cliente||'cliente').replace(/[^a-zA-Z0-9]/g,'_') + '.pdf';
  doc.save(fname);
  toast('PDF gerado: ' + fname, 'success');
}
// ============================================================
//  IMAGEM DE PEÇA
// ============================================================
function onPecaImgChange(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Imagem muito grande (máx 2MB)', 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    window._pecaImgData = e.target.result;
    const prev = document.getElementById('peca-img-preview');
    const icon = document.getElementById('peca-img-icon');
    const rem  = document.getElementById('peca-img-remove');
    prev.style.backgroundImage    = `url(${e.target.result})`;
    prev.style.backgroundSize     = 'cover';
    prev.style.backgroundPosition = 'center';
    if (icon) icon.style.display = 'none';
    if (rem)  rem.style.display  = 'inline-flex';
  };
  reader.readAsDataURL(file);
}

function removerImgPeca() {
  window._pecaImgData = '';
  const prev = document.getElementById('peca-img-preview');
  const icon = document.getElementById('peca-img-icon');
  const rem  = document.getElementById('peca-img-remove');
  prev.style.backgroundImage = '';
  if (icon) icon.style.display = 'block';
  if (rem)  rem.style.display  = 'none';
  document.getElementById('peca-img-input').value = '';
}

function pecaImgTag(peca, size=40) {
  if (!peca?.imagem) return '';
  return `<img src="${peca.imagem}" style="width:${size}px;height:${size}px;object-fit:cover;
    border-radius:4px;border:1px solid var(--border2);flex-shrink:0" alt="${peca.nome}">`;
}

// ============================================================
//  MOVIMENTAÇÃO — BUSCA DE PEÇA
// ============================================================
function filtrarPecasMov(q) {
  const dd = document.getElementById('mov-peca-dropdown');
  const hidden = document.getElementById('mov-peca');

  // Se já tem algo selecionado e o campo mudou, limpa seleção
  if (hidden.value && document.getElementById('mov-peca-search').value !== hidden.dataset.label) {
    hidden.value = '';
    document.getElementById('mov-peca-selected').style.display = 'none';
  }

  const ql = q.toLowerCase().trim();
  const list = db.pecas.filter(p =>
    !ql ||
    String(p.codigo).toLowerCase().includes(ql) ||
    String(p.nome).toLowerCase().includes(ql) ||
    String(p.grupo||'').toLowerCase().includes(ql)
  ).slice(0, 50);

  if (!list.length) {
    dd.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:var(--text3)">Nenhuma peça encontrada</div>`;
    dd.style.display = 'block';
    return;
  }

  dd.innerHTML = list.map(p => {
    const qty = db.estoque[p.id] || 0;
    const cor = qty <= 0 ? 'var(--red)' : (p.minimo > 0 && qty < p.minimo ? '#e8cc2a' : 'var(--green)');
    return `<div class="mov-dd-item" onmousedown="selecionarPeca('${p.id}')" style="
      padding:9px 14px; cursor:pointer; border-bottom:1px solid var(--border);
      display:flex; justify-content:space-between; align-items:center; gap:12px;
      transition:background 0.1s;
    " onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        ${pecaImgTag(p, 36)}
        <div>
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${p.codigo}</span>
          <span style="font-size:12px;color:var(--text);margin-left:8px">${p.nome}</span>
          ${p.grupo ? `<span style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-left:6px">${p.grupo}</span>` : ''}
        </div>
      </div>
      <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${cor};white-space:nowrap">${qty} ${p.unidade}</span>
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function selecionarPeca(id) {
  const p = db.pecas.find(x => x.id === id);
  if (!p) return;
  const qty = db.estoque[p.id] || 0;
  const cor = qty <= 0 ? 'var(--red)' : (p.minimo > 0 && qty < p.minimo ? '#e8cc2a' : 'var(--green)');

  const searchEl = document.getElementById('mov-peca-search');
  const hidden   = document.getElementById('mov-peca');
  const card     = document.getElementById('mov-peca-selected');
  const dd       = document.getElementById('mov-peca-dropdown');

  const label = `${p.codigo} — ${p.nome}`;
  searchEl.value     = label;
  hidden.value       = id;
  hidden.dataset.label = label;
  dd.style.display   = 'none';

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      ${pecaImgTag(p, 48)}
      <div>
        <span style="color:var(--accent);font-weight:700">${p.codigo}</span> · ${p.nome}
        ${p.grupo ? `· <span style="color:var(--text3)">${p.grupo}</span>` : ''}
        · Estoque: <span style="color:${cor};font-weight:700">${qty} ${p.unidade}</span>
        ${p.minimo ? `· Mín: ${p.minimo}` : ''}
      </div>
    </div>
    <div id="mov-custo-resumo" style="margin-top:8px"></div>
  `;
  card.style.display = 'block';
  atualizarResumoCustoMov();
}

function atualizarResumoCustoMov() {
  const pecaId = document.getElementById('mov-peca')?.value;
  const resumoEl = document.getElementById('mov-custo-resumo');
  if (!pecaId || !resumoEl) return;

  const p   = db.pecas.find(x => x.id === pecaId);
  if (!p) return;

  const qtd   = parseInt(document.getElementById('mov-qtd')?.value) || 1;
  const custo = (p.custo || 0) * qtd;
  const venda = (p.valor_venda || 0) * qtd;
  const isAdmin = podeAcessar('admin'); // Gerente / Back Office
  const isAssessor = currentUser?.cargo === 'Assessor';

  // Técnico vê só valor de venda; Assessor vê só valor de venda; Admin vê custo + venda
  const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

  if (isAdmin) {
    resumoEl.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--border)">
        <div>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">CUSTO UNIT.</span>
          <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent)">${fmt(p.custo||0)}</span>
        </div>
        <div>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">CUSTO TOTAL · ${qtd} un</span>
          <span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--accent)">${fmt(custo)}</span>
        </div>
        <div style="border-left:1px solid var(--border);padding-left:16px">
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">VENDA UNIT.</span>
          <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--green)">${fmt(p.valor_venda||0)}</span>
        </div>
        <div>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">VENDA TOTAL · ${qtd} un</span>
          <span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--green)">${fmt(venda)}</span>
        </div>
        ${p.markup ? `<div style="border-left:1px solid var(--border);padding-left:16px">
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">MARK-UP</span>
          <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text2)">${Number(p.markup).toFixed(2)}×</span>
        </div>` : ''}
      </div>`;
  } else {
    // Técnico e Assessor: só valor de venda
    resumoEl.innerHTML = `
      <div style="display:flex;gap:16px;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--border)">
        <div>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">VALOR UNIT.</span>
          <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--green)">${fmt(p.valor_venda||0)}</span>
        </div>
        <div>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);display:block;margin-bottom:2px">VALOR TOTAL · ${qtd} un</span>
          <span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--green)">${fmt(venda)}</span>
        </div>
      </div>`;
  }
}

function fecharDropdownPeca() {
  const dd = document.getElementById('mov-peca-dropdown');
  if (dd) dd.style.display = 'none';
}

// ============================================================
//  MOVIMENTAÇÃO — BUSCA DE EQUIPAMENTO POR SÉRIE
// ============================================================
function filtrarEquipMov(q) {
  const dd = document.getElementById('mov-equip-dropdown');
  const hidden = document.getElementById('mov-equip');

  if (hidden.value && document.getElementById('mov-serie-search').value !== hidden.dataset.label) {
    hidden.value = '';
    document.getElementById('mov-equip-card').style.display = 'none';
  }

  const ql = q.toLowerCase().trim();
  const list = db.equipamentos.filter(e =>
    !ql ||
    String(e.serie||'').toLowerCase().includes(ql) ||
    String(e.codigo||'').toLowerCase().includes(ql) ||
    String(e.nome||'').toLowerCase().includes(ql) ||
    String(e.nome_fantasia||'').toLowerCase().includes(ql) ||
    String(e.modelo||'').toLowerCase().includes(ql)
  ).slice(0, 50);

  if (!list.length) {
    dd.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:var(--text3)">Nenhum equipamento encontrado</div>`;
    dd.style.display = 'block';
    return;
  }

  const statusColor = {
    'Em Contrato':'var(--green)','Disponivel':'var(--blue)',
    'Em OS - Com Contrato':'var(--accent)','Em OS - Sem Contrato':'var(--red)','Inativo':'var(--text3)'
  };

  dd.innerHTML = list.map(e => {
    const cor = statusColor[e.status] || 'var(--text3)';
    const serie = e.serie || e.codigo;
    return `<div onmousedown="selecionarEquip('${e.id}')" style="
      padding:9px 14px; cursor:pointer; border-bottom:1px solid var(--border);
      transition:background 0.1s;
    " onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${serie}</span>
          <span style="font-size:12px;color:var(--text);margin-left:8px">${e.nome}</span>
        </div>
        <span style="font-family:var(--mono);font-size:10px;color:${cor};white-space:nowrap">${e.status||''}</span>
      </div>
      ${e.nome_fantasia ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${e.nome_fantasia}${e.municipio ? ' · '+e.municipio+(e.uf?'/'+e.uf:'') : ''}</div>` : ''}
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function selecionarEquip(id) {
  const e = db.equipamentos.find(x => x.id === id);
  if (!e) return;

  const searchEl = document.getElementById('mov-serie-search');
  const hidden   = document.getElementById('mov-equip');
  const card     = document.getElementById('mov-equip-card');
  const dd       = document.getElementById('mov-equip-dropdown');

  const serie = e.serie || e.codigo;
  const label = `${serie} — ${e.nome}`;
  searchEl.value       = label;
  hidden.value         = id;
  hidden.dataset.label = label;
  dd.style.display     = 'none';

  const statusColor = {
    'Em Contrato':'var(--green)','Disponivel':'var(--blue)',
    'Em OS - Com Contrato':'var(--accent)','Em OS - Sem Contrato':'var(--red)','Inativo':'var(--text3)'
  };
  const cor = statusColor[e.status] || 'var(--text3)';

  card.style.display = 'block';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:1px">S/N</span>
      <strong style="color:var(--accent);font-family:var(--mono)">${serie}</strong>
      <span style="color:var(--text);font-size:12px">${e.nome}</span>
      ${e.marca||e.modelo ? `<span style="color:var(--text3);font-size:11px">${[e.marca,e.modelo].filter(Boolean).join(' · ')}</span>` : ''}
      <span style="font-family:var(--mono);font-size:10px;color:${cor}">${e.status||''}</span>
    </div>
    <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:10px;font-family:var(--mono);font-size:10px;color:var(--text3)">
      ${e.cod_produto ? `<span>Cód: <span style="color:var(--text2)">${e.cod_produto}</span></span>` : ''}
      ${e.contrato    ? `<span>Contrato: <span style="color:var(--text2)">${e.contrato}</span></span>` : ''}
      ${e.nome_fantasia ? `<span style="color:var(--text2)">${e.nome_fantasia}${e.municipio ? ' · '+e.municipio+(e.uf?'/'+e.uf:'') : ''}</span>` : ''}
    </div>
  `;
}

function fecharDropdownEquip() {
  const dd = document.getElementById('mov-equip-dropdown');
  if (dd) dd.style.display = 'none';
}


// ============================================================
//  DASHBOARD
// ============================================================
function renderDashboard() {
  // Total de estoque: soma db.estoque (peças cadastradas) + depósitos sem peça vinculada
  const estoqueKnown = new Set(db.pecas.map(p => String(p.codigo)));
  const totalEstoque = Object.values(db.estoque).reduce((a,b)=>a+b, 0)
    + Object.entries(db.depositos)
        .filter(([cod]) => !estoqueKnown.has(cod))
        .reduce((s,[,d]) => s + (d['Total']||0), 0);

  // Críticos: peças com estoque mínimo definido e qty abaixo
  const criticos = db.pecas.filter(p => p.minimo > 0 && (db.estoque[p.id]||0) < p.minimo);

  // Total de itens no catálogo (peças + depósitos sem peça)
  const totalItens = new Set([...db.pecas.map(p=>String(p.codigo)), ...Object.keys(db.depositos)]).size;

  let movsFiltradas = db.movimentacoes;
  if (currentUser && currentUser.cargo === 'Tecnico') {
    movsFiltradas = movsFiltradas.filter(m => m.tecnico === currentUser.nome);
  }
  const abertas = movsFiltradas.filter(m => !['FINALIZADO'].includes(m.status)).length;
  document.getElementById('kpi-pecas').textContent = totalItens;
  document.getElementById('kpi-equip').textContent = db.equipamentos.length;
  document.getElementById('kpi-estoque').textContent = totalEstoque;
  document.getElementById('kpi-critico').textContent = criticos.length;
  document.getElementById('kpi-movs').textContent = abertas;

  // Criticos
  const criticoEl = document.getElementById('dash-critico');
  if (!criticos.length) {
    criticoEl.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-title">Sem Alertas</div><div class="empty-sub">Estoque adequado em todos os itens</div></div>`;
  } else {
    criticoEl.innerHTML = `<table class="data-table">
      <thead><tr><th>Peça</th><th>Disponível</th><th>Mínimo</th><th>Situação</th></tr></thead>
      <tbody>
      ${criticos.map(p => {
        const qty = db.estoque[p.id]||0;
        return `<tr>
          <td><strong>${p.nome}</strong> <span class="text-mono">${p.codigo}</span></td>
          <td><span style="font-family:var(--mono);color:var(--red);font-weight:700">${qty} ${p.unidade}</span></td>
          <td class="mono">${p.minimo} ${p.unidade}</td>
          <td><span class="badge badge-red">${qty<=0?'ZERADO':'CRÍTICO'}</span></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
  }

  // Últimas solicitações
  const movsEl = document.getElementById('dash-movs');
  const recent = db.movimentacoes.slice(0, 8);
  if (!recent.length) {
    movsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⇄</div><div class="empty-title">Sem Solicitações</div><div class="empty-sub">Crie a primeira na aba Movimentação</div></div>`;
  } else {
    movsEl.innerHTML = `<table class="data-table">
      <thead><tr><th>Data</th><th>Status</th><th>Peça</th><th>Qtd</th><th>Equipamento / Cliente</th></tr></thead>
      <tbody>
      ${recent.map(m => {
        const ps = PIPELINE_STATUS[m.status] || PIPELINE_STATUS.SOLICITADA;
        return `<tr>
          <td class="mono">${formatDate(m.eventos?.[0]?.data||m.data||0)}</td>
          <td><span class="badge ${ps.badge}" style="font-size:9px">${ps.label}</span></td>
          <td><strong style="font-size:12px">${m.pecaNome}</strong><div class="text-mono">${m.pecaCodigo}</div></td>
          <td class="mono">${m.qtd} ${m.pecaUnidade}</td>
          <td style="font-size:11px;color:var(--text2)">${[m.equipSerie?'S/N:'+m.equipSerie:'',m.equipCliente].filter(Boolean).join(' · ')||'—'}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
  }
}

// ============================================================
//  MÁQUINAS DOADORAS
// ============================================================

let _retirId = null; // doadora selecionada para retirada

function switchDoadTab(tab) {
  document.getElementById('panel-doadoras-cadastro').style.display  = tab === 'cadastro'  ? '' : 'none';
  document.getElementById('panel-doadoras-retiradas').style.display = tab === 'retiradas' ? '' : 'none';
  const bC = document.getElementById('tab-doadoras-cadastro');
  const bR = document.getElementById('tab-doadoras-retiradas');
  [bC, bR].forEach(b => {
    b.style.borderBottomColor = 'transparent';
    b.style.color = 'var(--text3)';
    b.style.fontWeight = '400';
  });
  const active = tab === 'cadastro' ? bC : bR;
  active.style.borderBottomColor = 'var(--accent)';
  active.style.color = 'var(--accent)';
  active.style.fontWeight = '700';
  if (tab === 'retiradas') renderRetiradas();
  else renderDoadoras();
}

// ── Busca de Equipamento na Doadora ──────────────────────────────────────────
function filtrarEquipDoadora(q) {
  const dd = document.getElementById('doad-equip-dd');
  if (!dd) return;
  const ql = q.toLowerCase().trim();
  const list = db.equipamentos.filter(e =>
    !ql ||
    String(e.serie||'').toLowerCase().includes(ql) ||
    String(e.codigo||'').toLowerCase().includes(ql) ||
    String(e.nome||'').toLowerCase().includes(ql) ||
    String(e.nome_fantasia||'').toLowerCase().includes(ql) ||
    String(e.modelo||'').toLowerCase().includes(ql)
  ).slice(0, 50);
  dd.style.display = list.length ? 'block' : 'none';
  dd.innerHTML = list.map(e => {
    const serie = e.serie || e.codigo;
    const client = e.nome_fantasia ? e.nome_fantasia.replace(/\[\d+\]$/,'').trim() : '';
    return `<div onmousedown="selecionarEquipDoadora('${e.id}')"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.1s"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div>
        <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${serie}</span>
        <span style="font-size:12px;color:var(--text);margin-left:8px">${e.nome}</span>
      </div>
      ${client ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">👤 ${client}</div>` : ''}
    </div>`;
  }).join('');
}

function selecionarEquipDoadora(equipId) {
  const e = db.equipamentos.find(x => x.id === equipId);
  if (!e) return;
  const dd = document.getElementById('doad-equip-dd');
  if (dd) dd.style.display = 'none';
  document.getElementById('doad-equip-id').value  = e.id;
  document.getElementById('doad-equip-search').value = `${e.serie || e.codigo} — ${e.nome}`;
  document.getElementById('doad-modelo').value    = e.nome;
  document.getElementById('doad-serie').value     = e.serie || e.codigo || '';
  document.getElementById('doad-marca').value     = e.marca || '';
  document.getElementById('doad-linha').value     = e.grupo || '';
}

function abrirModalDoadora(id) {
  editId = id || null;
  const d = id ? db.doadoras.find(x => x.id === id) : null;
  document.getElementById('modal-doadora-title').textContent = id ? 'Editar Doadora' : 'Nova Máquina Doadora';
  // Reset equip search
  const srch = document.getElementById('doad-equip-search');
  const hidEl = document.getElementById('doad-equip-id');
  if (srch) srch.value = d ? `${d.serie||''} — ${d.modelo||''}` : '';
  if (hidEl) hidEl.value = d?.equipId || '';
  document.getElementById('doad-modelo').value         = d?.modelo         || '';
  document.getElementById('doad-serie').value          = d?.serie          || '';
  document.getElementById('doad-marca').value          = d?.marca          || '';
  document.getElementById('doad-linha').value          = d?.linha          || '';
  document.getElementById('doad-classificacao').value  = d?.classificacao  || 'USO';
  document.getElementById('doad-fator').value          = d?.fator          ?? 1.00;
  document.getElementById('doad-obs').value            = d?.obs            || '';
  onDoadClassifChange(d?.classificacao || 'USO');
  openModal('modal-doadora');
}

function onDoadClassifChange(val) {
  const fatorEl = document.getElementById('doad-fator');
  const labelEl = document.getElementById('doad-fator-label');
  if (!fatorEl) return;
  const fator = val === 'SUCATA' ? 0.5 : 1.0;
  fatorEl.value = fator.toFixed(2);
  onDoadFatorChange(fator);
}

function onDoadFatorChange(val) {
  const labelEl = document.getElementById('doad-fator-label');
  if (!labelEl) return;
  const pct = Math.round(parseFloat(val) * 100);
  labelEl.textContent = `= ${pct}%`;
  labelEl.style.color = pct >= 100 ? 'var(--green)' : (pct >= 60 ? '#e8cc2a' : 'var(--red)');
}

function salvarDoadora() {
  const modelo = document.getElementById('doad-modelo')?.value.trim();
  if (!modelo) { toast('Modelo obrigatório', 'error'); return; }
  const data = {
    modelo,
    serie:        document.getElementById('doad-serie')?.value.trim()  || '',
    marca:        document.getElementById('doad-marca')?.value.trim()  || '',
    linha:        document.getElementById('doad-linha')?.value.trim()  || '',
    classificacao: document.getElementById('doad-class')?.value       || 'USO',
    fator:        parseFloat(document.getElementById('doad-fator')?.value) || 1,
    obs:          document.getElementById('doad-obs')?.value.trim()   || '',
  };

  const fn = editDoadId ? API.put('/doadoras/' + editDoadId, data) : API.post('/doadoras', data);
  fn.then(() => {
    toast('Doadora salva');
    fecharModalDoadora?.();
    loadAndRenderDoadoras();
  }).catch(err => toast(err.message, 'error'));
}
function deleteDoadora(id) {
  if (!confirm('Remover esta doadora?')) return;
  API.delete('/doadoras/' + id)
    .then(() => { toast('Doadora removida', 'info'); loadAndRenderDoadoras(); })
    .catch(err => toast(err.message, 'error'));
}
function renderDoadoras(q = '') {
  const el = document.getElementById('doadoras-table');
  if (!el) return;
  const ql = (q || '').toLowerCase().trim();
  const sf = document.getElementById('filter-doadora-status')?.value || '';

  const list = db.doadoras.filter(d => {
    if (sf && d.classificacao !== sf) return false;
    if (!ql) return true;
    return [d.modelo, d.serie, d.marca, d.linha, d.obs].some(v =>
      String(v || '').toLowerCase().includes(ql));
  });

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">⊘</div>
      <div class="empty-title">Nenhuma Máquina Doadora</div>
      <div class="empty-sub">Cadastre uma doadora para registrar retiradas de peças</div>
    </div>`;
    return;
  }

  const classifBadge = c => c === 'USO'
    ? `<span style="font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:4px;
        background:rgba(46,204,113,0.15);color:var(--green);border:1px solid rgba(46,204,113,0.4);
        font-weight:700;letter-spacing:1px">EM USO</span>`
    : `<span style="font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:4px;
        background:rgba(231,76,60,0.15);color:var(--red);border:1px solid rgba(231,76,60,0.4);
        font-weight:700;letter-spacing:1px">SUCATA</span>`;

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Modelo</th><th>Série / Patrimônio</th><th>Marca</th><th>Linha</th>
      <th>Classificação</th><th>Fator Custo</th>
      <th>Retiradas</th><th>Observação</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(d => {
      const nRet = db.retiradas.filter(r => r.doadId === d.id).length;
      const pct  = Math.round((d.fator || 1) * 100);
      const pctColor = pct >= 100 ? 'var(--green)' : (pct >= 60 ? '#e8cc2a' : 'var(--red)');
      return `<tr>
        <td style="font-weight:700;color:var(--text)">${d.modelo}</td>
        <td class="mono" style="font-size:11px;color:var(--accent)">${d.serie || '—'}</td>
        <td style="color:var(--text2)">${d.marca || '—'}</td>
        <td style="color:var(--text3);font-size:11px">${d.linha || '—'}</td>
        <td>${classifBadge(d.classificacao)}</td>
        <td>
          <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:${pctColor}">${pct}%</span>
          <span style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-left:4px">do custo</span>
        </td>
        <td>
          <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text2)">${nRet}</span>
          ${nRet ? `<button class="btn btn-ghost btn-sm" style="margin-left:4px;font-size:10px"
            onclick="verRetiradasDoadora('${d.id}')">Ver</button>` : ''}
        </td>
        <td style="color:var(--text3);font-size:11px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.obs || '—'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" style="color:var(--green);border-color:var(--green)"
            onclick="abrirModalRetirada('${d.id}')">⬡ Retirar Peça</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirModalDoadora('${d.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDoadora('${d.id}')">✕</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

// ── Retirada de Peça ──────────────────────────────────────────────────────────

let _retirPecaId = null;

function abrirModalRetirada(doadId) {
  _retirId = doadId;
  _retirPecaId = null;
  const d = db.doadoras.find(x => x.id === doadId);
  if (!d) return;

  const pct   = Math.round((d.fator || 1) * 100);
  const isUSO = d.classificacao === 'USO';
  const classifBadge = isUSO
    ? `<span style="background:rgba(46,204,113,0.15);color:var(--green);border:1px solid rgba(46,204,113,0.3);
        font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:4px;font-weight:700">EM USO · 100%</span>`
    : `<span style="background:rgba(231,76,60,0.15);color:var(--red);border:1px solid rgba(231,76,60,0.3);
        font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:4px;font-weight:700">SUCATA · ${pct}%</span>`;

  document.getElementById('modal-retirada-body').innerHTML = `
    <!-- Info doadora -->
    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);
      padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px">
      <div style="font-size:28px;line-height:1">⊘</div>
      <div>
        <div style="font-weight:700;font-size:14px">${d.modelo}</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--accent)">${d.serie || '—'}</div>
        <div style="margin-top:4px">${classifBadge}</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">FATOR DE CUSTO</div>
        <div style="font-family:var(--mono);font-size:24px;font-weight:800;
          color:${isUSO ? 'var(--green)' : 'var(--red)'}">${pct}%</div>
      </div>
    </div>

    <div class="form-grid">
      <!-- Busca da peça -->
      <div class="form-group full" style="position:relative">
        <label class="form-label">Peça Retirada *</label>
        <input class="form-input" id="ret-peca-search" placeholder="Buscar por código, nome ou fonte..."
          autocomplete="off" oninput="filtrarPecasRet(this.value)" onfocus="filtrarPecasRet(this.value)"
          onblur="setTimeout(()=>document.getElementById('ret-peca-dd').style.display='none',200)">
        <input type="hidden" id="ret-peca-id">
        <div id="ret-peca-dd" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:999;
          background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);
          max-height:200px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.4);margin-top:2px"></div>
        <div id="ret-peca-card" style="display:none;margin-top:6px;padding:10px 12px;
          background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);
          font-family:var(--mono);font-size:11px"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Quantidade *</label>
        <input class="form-input" type="number" min="1" id="ret-qtd" value="1" oninput="recalcRetirada()">
      </div>
      <div class="form-group">
        <label class="form-label">Técnico Responsável</label>
        <input class="form-input" id="ret-tecnico" placeholder="Nome do técnico">
      </div>
      <div class="form-group full">
        <label class="form-label">Destinação / Observação</label>
        <input class="form-input" id="ret-obs" placeholder="Ex: Substituição peça avariada OS 6513">
      </div>
    </div>

    <!-- Resumo de Custo -->
    <div id="ret-resumo" style="display:none;margin-top:8px;padding:14px 16px;
      background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius)">
      <!-- filled by recalcRetirada -->
    </div>
  `;
  openModal('modal-retirada');
}

function filtrarPecasRet(q) {
  const dd = document.getElementById('ret-peca-dd');
  const ql = q.toLowerCase().trim();
  const list = db.pecas.filter(p =>
    !ql ||
    String(p.codigo||'').toLowerCase().includes(ql) ||
    String(p.nome||'').toLowerCase().includes(ql) ||
    String(p.fonte||'').toLowerCase().includes(ql)
  ).slice(0, 50);

  dd.style.display = list.length ? 'block' : 'none';
  dd.innerHTML = list.map(p => {
    const custo = p.custo || 0;
    const img = p.imagem
      ? `<img src="${p.imagem}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;flex-shrink:0">`
      : `<div style="width:32px;height:32px;background:var(--surface);border-radius:4px;display:flex;
          align-items:center;justify-content:center;font-size:14px;flex-shrink:0">⬡</div>`;
    return `<div onmousedown="selecionarPecaRet('${p.id}')"
      style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;
      border-bottom:1px solid var(--border);transition:background 0.1s"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      ${img}
      <div style="flex:1;min-width:0">
        <div style="color:var(--accent);font-weight:700;font-size:11px">${p.codigo}</div>
        <div style="color:var(--text2);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nome}</div>
        <div style="color:var(--text3);font-size:10px">${p.fonte||''} · ${p.linha||''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:10px;color:var(--text3)">Custo</div>
        <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent)">R$ ${custo.toFixed(2)}</div>
      </div>
    </div>`;
  }).join('');
}

function selecionarPecaRet(id) {
  const p = db.pecas.find(x => x.id === id);
  if (!p) return;
  _retirPecaId = id;
  document.getElementById('ret-peca-id').value = id;
  document.getElementById('ret-peca-search').value = `${p.codigo} — ${p.nome}`;
  document.getElementById('ret-peca-dd').style.display = 'none';

  const card = document.getElementById('ret-peca-card');
  card.style.display = 'block';
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      ${p.imagem ? `<img src="${p.imagem}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--border2)">` : ''}
      <div>
        <span style="color:var(--accent);font-weight:700">${p.codigo}</span> · ${p.nome}
        <span style="color:var(--text3)"> · ${p.fonte||''} ${p.linha ? '· '+p.linha : ''}</span>
      </div>
    </div>
  `;
  recalcRetirada();
}

function recalcRetirada() {
  if (!_retirPecaId || !_retirId) return;
  const p = db.pecas.find(x => x.id === _retirPecaId);
  const d = db.doadoras.find(x => x.id === _retirId);
  if (!p || !d) return;

  const qtd        = parseInt(document.getElementById('ret-qtd')?.value) || 1;
  const fator      = d.fator || 1;
  const isUSO      = d.classificacao === 'USO';
  const custoBase  = p.custo || 0;        // custo cheio da peça
  const custoUnit  = custoBase * fator;   // custo aplicado ao fator
  const custoTotal = custoUnit * qtd;
  const vendaUnit  = p.valor_venda || 0;
  const vendaTotal = vendaUnit * qtd;
  const isAdmin    = podeAcessar('admin');

  const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const pct = Math.round(fator * 100);
  const pctColor = isUSO ? 'var(--green)' : 'var(--red)';

  const resumo = document.getElementById('ret-resumo');
  resumo.style.display = 'block';
  resumo.innerHTML = `
    <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px">CÁLCULO DE CUSTO · FATOR ${pct}%</span>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      ${isAdmin ? `
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:2px">CUSTO CHEIO</div>
        <div style="font-family:var(--mono);font-size:12px;color:var(--text2)">${fmt(custoBase)}</div>
      </div>
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:2px">× FATOR ${pct}%</div>
        <div style="font-family:var(--mono);font-size:12px;color:${pctColor};font-weight:700">${fmt(custoUnit)} / un</div>
      </div>
      <div style="border-left:1px solid var(--border);padding-left:16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:2px">CUSTO TOTAL · ${qtd} un</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--accent)">${fmt(custoTotal)}</div>
      </div>` : ''}
      <div style="${isAdmin ? 'border-left:1px solid var(--border);padding-left:16px' : ''}">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-bottom:2px">VALOR VENDA TOTAL · ${qtd} un</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--green)">${fmt(vendaTotal)}</div>
      </div>
    </div>
    ${!isUSO ? `
    <div style="margin-top:10px;padding:8px 12px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.3);
      border-radius:6px;font-size:11px;color:var(--red)">
      ⚠ Máquina classificada como <strong>Sucata</strong> — custo aplicado a ${pct}% do valor cheio
      ${isAdmin ? `(R$ ${custoBase.toFixed(2)} × ${(fator*100).toFixed(0)}% = R$ ${custoUnit.toFixed(2)}/un)` : ''}
    </div>` : ''}
  `;
}

function confirmarRetirada() {
  if (!_retirPecaId) { toast('Selecione a peça', 'error'); return; }
  if (!_retirId)     { toast('Doadora não identificada', 'error'); return; }

  const p   = db.pecas.find(x => x.id === _retirPecaId);
  const d   = db.doadoras.find(x => x.id === _retirId);
  if (!p || !d) return;

  const qtd       = parseInt(document.getElementById('ret-qtd')?.value) || 1;
  const custoUnit = (p.custo || 0) * (d.fator || 1);
  const tecnico   = document.getElementById('ret-tecnico')?.value.trim() || currentUser?.nome || '';

  const data = {
    doad_id:    d.id,
    doad_modelo: d.modelo,
    doad_serie:  d.serie,
    doad_class:  d.classificacao,
    peca_id:    p.id,
    peca_codigo: p.codigo,
    peca_nome:  p.nome,
    qtd, custo_unit: custoUnit,
    tecnico,
    obs: document.getElementById('ret-obs')?.value.trim() || '',
  };

  API.post('/retiradas', data)
    .then(() => {
      toast('Retirada registrada — estoque atualizado');
      closeModal('modal-retirada');
      loadAndRenderDoadoras();
      loadAndRenderEstoque();
      loadAndRenderDashboard();
    })
    .catch(err => toast(err.message, 'error'));
}
function verRetiradasDoadora(doadId) {
  switchDoadTab('retiradas');
  // Filter to this doadora (set search)
  setTimeout(() => {
    const d = db.doadoras.find(x => x.id === doadId);
    if (!d) return;
    const inp = document.querySelector('#panel-doadoras-retiradas .search-input');
    if (inp) { inp.value = d.modelo; renderRetiradas(d.modelo); }
  }, 50);
}

function renderRetiradas(q = '') {
  const el = document.getElementById('retiradas-table');
  if (!el) return;
  const ql = (q || '').toLowerCase().trim();
  const isAdmin = podeAcessar('admin');

  const list = [...db.retiradas].filter(r =>
    !ql ||
    String(r.pecaCodigo||'').toLowerCase().includes(ql) ||
    String(r.pecaNome||'').toLowerCase().includes(ql) ||
    String(r.doadModelo||'').toLowerCase().includes(ql) ||
    String(r.doadSerie||'').toLowerCase().includes(ql) ||
    String(r.tecnico||'').toLowerCase().includes(ql)
  ).sort((a,b) => b.data - a.data);

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">≡</div>
      <div class="empty-title">Nenhuma Retirada Registrada</div>
      <div class="empty-sub">As retiradas de peças das doadoras aparecerão aqui</div>
    </div>`;
    return;
  }

  const classifBadge = c => c === 'USO'
    ? `<span style="font-family:var(--mono);font-size:9px;padding:2px 6px;border-radius:4px;
        background:rgba(46,204,113,0.15);color:var(--green);border:1px solid rgba(46,204,113,0.3)">USO</span>`
    : `<span style="font-family:var(--mono);font-size:9px;padding:2px 6px;border-radius:4px;
        background:rgba(231,76,60,0.15);color:var(--red);border:1px solid rgba(231,76,60,0.3)">SUCATA</span>`;

  const totalCusto = list.reduce((s,r) => s + (r.custoTotal||0), 0);
  const totalVenda = list.reduce((s,r) => s + (r.vendaTotal||0), 0);

  el.innerHTML = `
    ${isAdmin ? `
    <div style="display:flex;gap:24px;padding:12px 16px;background:var(--surface2);
      border:1px solid var(--border2);border-radius:var(--radius);margin-bottom:14px">
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px">CUSTO TOTAL</div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:800;color:var(--accent)">
          R$ ${totalCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
      </div>
      <div style="border-left:1px solid var(--border);padding-left:24px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px">VALOR VENDA TOTAL</div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:800;color:var(--green)">
          R$ ${totalVenda.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
      </div>
      <div style="border-left:1px solid var(--border);padding-left:24px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px">RETIRADAS</div>
        <div style="font-family:var(--mono);font-size:16px;font-weight:800;color:var(--text)">${list.length}</div>
      </div>
    </div>` : ''}
    <table class="data-table">
      <thead><tr>
        <th>Data</th><th>Doadora</th><th>Classif.</th>
        <th>Peça</th><th>Qtd</th>
        ${isAdmin ? `<th>Custo Unit.</th><th>Custo Total</th>` : ''}
        <th>V.Venda Total</th>
        <th>Técnico</th><th>Observação</th>
      </tr></thead>
      <tbody>
      ${list.map(r => `<tr>
        <td class="mono" style="font-size:11px;white-space:nowrap">${new Date(r.data).toLocaleDateString('pt-BR')}</td>
        <td>
          <div style="font-weight:600">${r.doadModelo}</div>
          <div style="font-family:var(--mono);font-size:10px;color:var(--accent)">${r.doadSerie||'—'}</div>
        </td>
        <td>${classifBadge(r.doadClass)}
          <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:2px">${Math.round((r.doadFator||1)*100)}%</div>
        </td>
        <td>
          <div style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${r.pecaCodigo}</div>
          <div style="font-size:11px;color:var(--text2);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.pecaNome}</div>
          <div style="font-size:10px;color:var(--text3)">${r.pecaFonte||''}</div>
        </td>
        <td class="mono" style="font-weight:700">${r.qtd}</td>
        ${isAdmin ? `
        <td class="mono" style="font-size:11px;color:var(--accent)">R$ ${(r.custoUnit||0).toFixed(2)}</td>
        <td class="mono" style="font-size:12px;font-weight:700;color:var(--accent)">R$ ${(r.custoTotal||0).toFixed(2)}</td>
        ` : ''}
        <td class="mono" style="font-size:12px;font-weight:700;color:var(--green)">R$ ${(r.vendaTotal||0).toFixed(2)}</td>
        <td style="color:var(--text2)">${r.tecnico||'—'}</td>
        <td style="font-size:11px;color:var(--text3);max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.obs||'—'}</td>
      </tr>`).join('')}
      </tbody>
    </table>`;
}

function exportarRetiradasExcel() {
  const rows = [...db.retiradas].sort((a,b)=>b.data-a.data);
  if (!rows.length) { toast('Sem retiradas para exportar', 'info'); return; }
  const isAdmin = podeAcessar('admin');
  const headers = ['Data','Doadora','Série','Classif.','Fator%','P/N','Nome Peça','Fonte','Qtd'];
  if (isAdmin) headers.push('Custo Unit. R$','Custo Total R$');
  headers.push('V.Venda Total R$','Técnico','Observação');

  const data = rows.map(r => {
    const row = [
      new Date(r.data).toLocaleDateString('pt-BR'),
      r.doadModelo, r.doadSerie||'', r.doadClass,
      Math.round((r.doadFator||1)*100)+'%',
      r.pecaCodigo, r.pecaNome, r.pecaFonte||'', r.qtd
    ];
    if (isAdmin) row.push((r.custoUnit||0).toFixed(2), (r.custoTotal||0).toFixed(2));
    row.push((r.vendaTotal||0).toFixed(2), r.tecnico||'', r.obs||'');
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'Retiradas');
  XLSX.writeFile(wb2, `retiradas_doadoras_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Excel exportado', 'success');
}

// ============================================================
//  COMPRAS
// ============================================================

let _sugestaoItens = [];   // itens gerados para o pedido atual
let _pedidoRascunho = [];  // itens selecionados para pedido

function switchComprasTab(tab) {
  const tabs = ['sugestao','pendentes','pedidos','config'];
  tabs.forEach(t => {
    const p = document.getElementById('panel-compras-' + t);
    const b = document.getElementById('tab-compras-' + t);
    if (!p || !b) return;
    p.style.display = t === tab ? '' : 'none';
    b.style.borderBottomColor = t === tab ? 'var(--accent)' : 'transparent';
    b.style.color = t === tab ? 'var(--accent)' : 'var(--text3)';
    b.style.fontWeight = t === tab ? '700' : '400';
  });
  if (tab === 'sugestao')  renderSugestao();
  if (tab === 'pendentes') renderPendencias();
  if (tab === 'pedidos')   renderPedidos();
  if (tab === 'config')    renderConfigCompras();
}

function renderCompras() {
  switchComprasTab('sugestao');
  atualizarBadgeCompras();
}

// ── Badge ──────────────────────────────────────────────────────────────────────
function atualizarBadgeCompras() {
  const total = calcularDemandaTotal().length;
  const pend  = db.movimentacoes.filter(m => m.status === 'COMPRA_PENDENTE').length;
  const bdg = document.getElementById('badge-compras');
  if (bdg) bdg.textContent = total;
  const bdgP = document.getElementById('badge-compras-pend');
  if (bdgP) bdgP.textContent = pend;
}

// ── Motor de sugestão ──────────────────────────────────────────────────────────
function calcularDemandaTotal() {
  const cfg     = db.configCompras;
  const periodo = cfg.periodoAnalise || 90;
  const agora   = Date.now();
  const limite  = agora - periodo * 86400000;

  // Monta mapa de consumo por pecaId no período
  const consumoMov = {};   // saídas via movimentações finalizadas
  const consumoDoad= {};   // saídas via retiradas de doadoras EM USO

  db.movimentacoes
    .filter(m => m.status === 'FINALIZADO' && m.dataFinalizacao)
    .forEach(m => {
      const ts = new Date(m.dataFinalizacao).getTime();
      if (ts >= limite && m.pecaId) {
        consumoMov[m.pecaId] = (consumoMov[m.pecaId] || 0) + (m.qtd || 1);
      }
    });

  // Retiradas de doadoras EM USO (precisam reposição)
  db.retiradas
    .filter(r => r.doadClass === 'USO' && r.data >= limite)
    .forEach(r => {
      consumoDoad[r.pecaId] = (consumoDoad[r.pecaId] || 0) + (r.qtd || 1);
    });

  // Solicitações COMPRA_PENDENTE (sem estoque)
  const pendMap = {};
  db.movimentacoes
    .filter(m => m.status === 'COMPRA_PENDENTE' && m.pecaId)
    .forEach(m => {
      pendMap[m.pecaId] = (pendMap[m.pecaId] || 0) + (m.qtd || 1);
    });

  // Monta lista unificada de peças com demanda
  const pecasSet = new Set([
    ...(cfg.incluiDoadora === 'sim' ? Object.keys(consumoDoad) : []),
    ...(cfg.incluiPendente === 'sim' ? Object.keys(pendMap)    : []),
    // abaixo do mínimo — sempre incluí
    ...db.pecas.filter(p => {
      const qty = Object.values(db.estoque).length > 0
        ? (db.estoque[p.id] || 0) : 0;
      return p.minimo > 0 && qty < p.minimo;
    }).map(p => p.id)
  ]);

  const resultado = [];

  pecasSet.forEach(pecaId => {
    const p = db.pecas.find(x => x.id === pecaId);
    if (!p) return;

    const estoqueAtual = db.estoque[p.id] || 0;
    const diasCob      = (cfg.diasPorPeca && cfg.diasPorPeca[pecaId]) || cfg.diasEstoque || 30;

    // Consumo médio diário (histórico movimentações + retiradas)
    const totalConsumo = (consumoMov[pecaId] || 0) + (consumoDoad[pecaId] || 0);
    const cmdDiario    = totalConsumo / periodo;  // consumo médio diário

    // Demanda calculada: estoque para cobrir X dias - estoque atual
    const estoqueAlvo  = Math.ceil(cmdDiario * diasCob);
    const qtdSugerida  = Math.max(
      0,
      estoqueAlvo - estoqueAtual,
      pendMap[pecaId] || 0,             // garante atender as pendências
      (p.minimo > 0 && estoqueAtual < p.minimo) ? (p.minimo - estoqueAtual) : 0
    );

    if (qtdSugerida <= 0 && !pendMap[pecaId] && !(p.minimo > 0 && estoqueAtual < p.minimo)) return;

    // Origens desta sugestão
    const origens = [];
    if (cfg.incluiDoadora === 'sim' && consumoDoad[pecaId]) origens.push('doadora');
    if (cfg.incluiPendente === 'sim' && pendMap[pecaId])    origens.push('pendente');
    if (p.minimo > 0 && estoqueAtual < p.minimo)            origens.push('minimo');

    resultado.push({
      pecaId,
      codigo:       p.codigo,
      nome:         p.nome,
      fonte:        p.fonte || '',
      linha:        p.linha || '',
      unidade:      p.unidade || 'pcs',
      estoqueAtual,
      minimo:       p.minimo || 0,
      consumoTotal: totalConsumo,
      cmdDiario:    parseFloat(cmdDiario.toFixed(4)),
      estoqueAlvo,
      qtdPendente:  pendMap[pecaId] || 0,
      qtdDoadora:   consumoDoad[pecaId] || 0,
      qtdSugerida:  Math.max(qtdSugerida, 1),
      diasCob,
      custoUnit:    p.custo || 0,
      valorVendaUnit: p.valor_venda || 0,
      custoTotal:   (p.custo || 0) * Math.max(qtdSugerida, 1),
      origens,
    });
  });

  // Ordena: pendentes primeiro, depois abaixo do mínimo, depois demanda normal
  resultado.sort((a, b) => {
    const prioA = a.origens.includes('pendente') ? 0 : a.origens.includes('minimo') ? 1 : 2;
    const prioB = b.origens.includes('pendente') ? 0 : b.origens.includes('minimo') ? 1 : 2;
    return prioA - prioB || b.custoTotal - a.custoTotal;
  });

  _sugestaoItens = resultado;
  return resultado;
}

// ── Render Sugestão ────────────────────────────────────────────────────────────
function renderSugestao(q = '') {
  const el = document.getElementById('sugestao-table');
  if (!el) return;
  const ql         = (q || document.querySelector('#panel-compras-sugestao .search-input')?.value || '').toLowerCase().trim();
  const origemFlt  = document.getElementById('filter-sug-origem')?.value || '';
  const fonteFlt   = document.getElementById('filter-sug-fonte')?.value  || '';
  const isAdmin    = podeAcessar('admin');

  const lista = calcularDemandaTotal().filter(item => {
    if (origemFlt && !item.origens.includes(origemFlt)) return false;
    if (fonteFlt  && item.fonte !== fonteFlt) return false;
    if (ql && !String(item.codigo).toLowerCase().includes(ql) &&
              !String(item.nome).toLowerCase().includes(ql) &&
              !String(item.fonte).toLowerCase().includes(ql)) return false;
    return true;
  });

  // Preenche filtro de fontes
  const fontesSel = document.getElementById('filter-sug-fonte');
  if (fontesSel && fontesSel.options.length <= 1) {
    const fontes = [...new Set(_sugestaoItens.map(i => i.fonte).filter(Boolean))].sort();
    fontes.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; fontesSel.appendChild(o); });
    if (fonteFlt) fontesSel.value = fonteFlt;
  }

  // KPIs
  const totalCusto = lista.reduce((s, i) => s + i.custoTotal, 0);
  const totalVenda = lista.reduce((s, i) => s + i.valorVendaUnit * i.qtdSugerida, 0);
  const kpiEl = document.getElementById('compras-kpis');
  if (kpiEl) {
    const kpi = (label, val, cor, sub) => `
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);
        padding:10px 16px;min-width:140px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px">${label}</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:${cor};margin-top:2px">${val}</div>
        ${sub ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${sub}</div>` : ''}
      </div>`;
    kpiEl.innerHTML =
      kpi('ITENS NA FILA', lista.length, 'var(--text)', lista.filter(i=>i.origens.includes('pendente')).length + ' pendentes') +
      kpi('PENDENTES S/ ESTOQUE', lista.filter(i=>i.origens.includes('pendente')).length, 'var(--red)', 'solicitações aguardando') +
      kpi('ABAIXO DO MÍNIMO',    lista.filter(i=>i.origens.includes('minimo')).length,   '#e8cc2a', 'estoque crítico') +
      kpi('REPOSIÇÃO DOADORA',   lista.filter(i=>i.origens.includes('doadora')).length,  'var(--accent)', 'máquinas em uso') +
      (isAdmin ? kpi('CUSTO ESTIMADO', 'R$ ' + totalCusto.toLocaleString('pt-BR',{minimumFractionDigits:2}), 'var(--accent)', 'baseado no custo de reposição') : '') +
      kpi('VENDA ESTIMADA', 'R$ ' + totalVenda.toLocaleString('pt-BR',{minimumFractionDigits:2}), 'var(--green)', 'valor de venda ao cliente');
  }

  if (!lista.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🛒</div>
      <div class="empty-title">Nenhuma Sugestão de Compra</div>
      <div class="empty-sub">Sem demanda identificada com os filtros atuais</div>
    </div>`;
    return;
  }

  const origemTag = o => {
    const map = {
      doadora: ['REPOSIÇÃO DOADORA','rgba(52,152,219,0.2)','#3498db','rgba(52,152,219,0.4)'],
      pendente:['SEM ESTOQUE','rgba(231,76,60,0.2)','var(--red)','rgba(231,76,60,0.4)'],
      minimo:  ['ABAIXO MÍNIMO','rgba(232,204,42,0.2)','#e8cc2a','rgba(232,204,42,0.4)'],
    };
    return (o || []).map(k => {
      const [label, bg, color, border] = map[k] || [k,'var(--surface2)','var(--text3)','var(--border)'];
      return `<span style="font-family:var(--mono);font-size:9px;padding:1px 6px;border-radius:4px;
        background:${bg};color:${color};border:1px solid ${border};margin-right:3px;white-space:nowrap">${label}</span>`;
    }).join('');
  };

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th style="width:36px"><input type="checkbox" id="sug-chk-all" onchange="toggleSugAll(this.checked)" title="Selecionar todos"></th>
      <th>P/N · Peça</th><th>Fonte</th>
      <th>Estoque<br>Atual</th><th>Mínimo</th>
      <th>Consumo<br>(${db.configCompras.periodoAnalise||90}d)</th>
      <th>CMD/dia</th>
      <th>Alvo<br>(${db.configCompras.diasEstoque||30}d)</th>
      <th>Pendente<br>s/ Estoque</th>
      <th style="min-width:110px">Qtd Sugerida</th>
      ${isAdmin ? `<th>Custo Unit.</th><th>Custo Total</th>` : ''}
      <th>V.Venda Total</th>
      <th>Origem</th>
    </tr></thead>
    <tbody>
    ${lista.map((item, i) => {
      const urgente = item.origens.includes('pendente') || item.estoqueAtual <= 0;
      const cor     = item.estoqueAtual <= 0 ? 'var(--red)' : (item.estoqueAtual < item.minimo ? '#e8cc2a' : 'var(--text2)');
      return `<tr style="${urgente ? 'background:rgba(231,76,60,0.04)' : ''}">
        <td><input type="checkbox" class="sug-chk" data-idx="${i}" checked></td>
        <td>
          <div style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${item.codigo}</div>
          <div style="font-size:11px;color:var(--text2);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.nome}</div>
        </td>
        <td style="font-size:11px;color:var(--text3)">${item.fonte}</td>
        <td class="mono" style="font-weight:700;color:${cor};text-align:center">${item.estoqueAtual}</td>
        <td class="mono" style="color:var(--text3);text-align:center">${item.minimo||'—'}</td>
        <td class="mono" style="text-align:center">${item.consumoTotal}</td>
        <td class="mono" style="font-size:10px;color:var(--text3);text-align:center">${item.cmdDiario.toFixed(3)}</td>
        <td class="mono" style="color:var(--accent);text-align:center">${item.estoqueAlvo}</td>
        <td class="mono" style="color:${item.qtdPendente ? 'var(--red)' : 'var(--text3)'};font-weight:${item.qtdPendente?700:400};text-align:center">
          ${item.qtdPendente || '—'}
        </td>
        <td>
          <input type="number" min="1" value="${item.qtdSugerida}"
            class="form-input sug-qtd" data-pecaid="${item.pecaId}"
            style="width:80px;text-align:center;font-family:var(--mono);font-weight:700"
            oninput="atualizarQtdSug('${item.pecaId}', this.value)">
        </td>
        ${isAdmin ? `
        <td class="mono" style="font-size:11px;color:var(--accent)">R$ ${item.custoUnit.toFixed(2)}</td>
        <td class="mono" style="font-size:12px;font-weight:700;color:var(--accent)" id="sug-custo-${item.pecaId}">
          R$ ${item.custoTotal.toFixed(2)}
        </td>` : ''}
        <td class="mono" style="font-size:12px;font-weight:700;color:var(--green)" id="sug-venda-${item.pecaId}">
          R$ ${(item.valorVendaUnit * item.qtdSugerida).toFixed(2)}
        </td>
        <td>${origemTag(item.origens)}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function toggleSugAll(checked) {
  document.querySelectorAll('.sug-chk').forEach(c => c.checked = checked);
}

function atualizarQtdSug(pecaId, val) {
  const item = _sugestaoItens.find(i => i.pecaId === pecaId);
  if (!item) return;
  const qtd = parseInt(val) || 1;
  item.qtdSugerida = qtd;
  item.custoTotal  = item.custoUnit * qtd;
  const custoEl = document.getElementById('sug-custo-' + pecaId);
  const vendaEl = document.getElementById('sug-venda-' + pecaId);
  if (custoEl) custoEl.textContent = 'R$ ' + item.custoTotal.toFixed(2);
  if (vendaEl) vendaEl.textContent = 'R$ ' + (item.valorVendaUnit * qtd).toFixed(2);
}

// ── Gerar Pedido ───────────────────────────────────────────────────────────────
function gerarPedidoCompra() {
  const chks   = [...document.querySelectorAll('.sug-chk:checked')];
  const idxs   = chks.map(c => parseInt(c.dataset.idx));
  const lista  = calcularDemandaTotal();
  _pedidoRascunho = idxs.map(i => lista[i]).filter(Boolean);

  if (!_pedidoRascunho.length) { toast('Selecione ao menos um item', 'error'); return; }

  const isAdmin = podeAcessar('admin');
  const totalCusto = _pedidoRascunho.reduce((s,i) => s + i.custoTotal, 0);
  const totalVenda = _pedidoRascunho.reduce((s,i) => s + i.valorVendaUnit * i.qtdSugerida, 0);
  const numero = 'PC-' + String(db.pedidos.length + 1).padStart(4,'0');

  document.getElementById('modal-pedido-title').textContent = `Pedido de Compra ${numero}`;
  document.getElementById('modal-pedido-body').innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      ${isAdmin ? `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">CUSTO TOTAL</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--accent)">R$ ${totalCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>` : ''}
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">VALOR DE VENDA</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--green)">R$ ${totalVenda.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">ITENS</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--text)">${_pedidoRascunho.length}</div>
      </div>
    </div>
    <div style="margin-bottom:10px">
      <label class="form-label">Observação do Pedido</label>
      <input class="form-input" id="pedido-obs" placeholder="Ex: Urgente — atender OS abertas">
    </div>
    <div style="max-height:360px;overflow-y:auto">
    <table class="data-table">
      <thead><tr>
        <th>P/N</th><th>Nome</th><th>Fonte</th><th>Qtd</th>
        ${isAdmin ? '<th>Custo Unit.</th><th>Custo Total</th>' : ''}
        <th>V.Venda Total</th><th>Origem</th>
      </tr></thead>
      <tbody>
      ${_pedidoRascunho.map(item => `<tr>
        <td class="mono" style="font-size:11px;color:var(--accent);font-weight:700">${item.codigo}</td>
        <td style="font-size:11px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.nome}</td>
        <td style="font-size:11px;color:var(--text3)">${item.fonte}</td>
        <td class="mono" style="font-weight:700">${item.qtdSugerida}</td>
        ${isAdmin ? `
        <td class="mono" style="font-size:11px;color:var(--accent)">R$ ${item.custoUnit.toFixed(2)}</td>
        <td class="mono" style="font-weight:700;color:var(--accent)">R$ ${item.custoTotal.toFixed(2)}</td>` : ''}
        <td class="mono" style="font-weight:700;color:var(--green)">R$ ${(item.valorVendaUnit*item.qtdSugerida).toFixed(2)}</td>
        <td style="font-size:10px">${item.origens.map(o=>({doadora:'Doadora',pendente:'Pendente',minimo:'Mínimo'})[o]||o).join(', ')}</td>
      </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
  openModal('modal-pedido');
}

function salvarPedido() {
  if (!_pedidoRascunho.length) return;
  const numero = 'PC-' + String((db.pedidos.length || 0) + 1).padStart(4,'0');
  const obs    = document.getElementById('pedido-obs')?.value.trim() || '';
  const data = {
    numero, obs, status: 'ABERTO',
    itens: _pedidoRascunho.map(i => ({
      pecaId: i.pecaId, pecaCodigo: i.pecaCodigo, pecaNome: i.pecaNome,
      qtdSugerida: i.qtdSugerida, custoUnit: i.custoUnit, custoTotal: i.custoTotal,
      valorVendaUnit: i.valorVendaUnit,
    })),
  };
  API.post('/pedidos', data)
    .then(() => {
      toast('Pedido de compra gerado');
      closeModal('modal-pedido');
      loadAndRenderCompras();
    })
    .catch(err => toast(err.message, 'error'));
}
function exportarPedidoExcel() {
  if (!_pedidoRascunho.length) return;
  const isAdmin = podeAcessar('admin');
  const heads = ['P/N','Nome','Fonte','Linha','Qtd','Unidade'];
  if (isAdmin) heads.push('Custo Unit. R$','Custo Total R$');
  heads.push('V.Venda Total R$','Origem');
  const rows = _pedidoRascunho.map(i => {
    const r = [i.codigo, i.nome, i.fonte, i.linha, i.qtdSugerida, i.unidade];
    if (isAdmin) r.push(i.custoUnit.toFixed(2), i.custoTotal.toFixed(2));
    r.push((i.valorVendaUnit*i.qtdSugerida).toFixed(2), i.origens.join(', '));
    return r;
  });
  const ws2 = XLSX.utils.aoa_to_sheet([heads,...rows]);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws2, 'Pedido');
  XLSX.writeFile(wb2, `pedido_compra_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Excel exportado', 'success');
}

function exportarSugestaoExcel() {
  const lista = calcularDemandaTotal();
  if (!lista.length) { toast('Sem itens para exportar', 'info'); return; }
  const isAdmin = podeAcessar('admin');
  const heads = ['P/N','Nome','Fonte','Linha','Estoque Atual','Mínimo','Consumo no Período','CMD/dia','Alvo Estoque','Qtd Pendente','Qtd Sugerida'];
  if (isAdmin) heads.push('Custo Unit. R$','Custo Total R$');
  heads.push('V.Venda Total R$','Origem');
  const rows = lista.map(i => {
    const r = [i.codigo,i.nome,i.fonte,i.linha,i.estoqueAtual,i.minimo,i.consumoTotal,i.cmdDiario,i.estoqueAlvo,i.qtdPendente,i.qtdSugerida];
    if (isAdmin) r.push(i.custoUnit.toFixed(2),i.custoTotal.toFixed(2));
    r.push((i.valorVendaUnit*i.qtdSugerida).toFixed(2), i.origens.join(', '));
    return r;
  });
  const ws2 = XLSX.utils.aoa_to_sheet([heads,...rows]);
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws2, 'Sugestão');
  XLSX.writeFile(wb2, `sugestao_compra_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Excel exportado', 'success');
}

// ── Pendências ─────────────────────────────────────────────────────────────────
function renderPendencias(q = '') {
  const el = document.getElementById('pendencias-table');
  if (!el) return;
  const ql = (q || document.querySelector('#panel-compras-pendentes .search-input')?.value || '').toLowerCase();
  const isAdmin = podeAcessar('admin');

  const list = db.movimentacoes
    .filter(m => m.status === 'COMPRA_PENDENTE')
    .filter(m => !ql || [m.pecaNome,m.pecaCodigo,m.tecnico,m.numSeq].some(v=>String(v||'').toLowerCase().includes(ql)))
    .sort((a,b) => b.eventos[0]?.data - a.eventos[0]?.data);

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✓</div>
      <div class="empty-title">Sem Pendências de Compra</div>
      <div class="empty-sub">Nenhuma solicitação aguardando compra de peça</div>
    </div>`;
    return;
  }

  const totalVenda = list.reduce((s,m) => s + (m.pecaValorVenda||0)*(m.qtd||1), 0);
  const totalCusto = list.reduce((s,m) => s + (m.pecaCusto||0)*(m.qtd||1), 0);

  el.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">SOLICITAÇÕES PENDENTES</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--red)">${list.length}</div>
      </div>
      ${isAdmin ? `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">CUSTO TOTAL</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--accent)">R$ ${totalCusto.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>` : ''}
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">VALOR DE VENDA</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--green)">R$ ${totalVenda.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>
    </div>
    <table class="data-table">
      <thead><tr>
        <th>Nº Sol.</th><th>Peça</th><th>Qtd</th>
        ${isAdmin ? '<th>Custo</th>' : ''}
        <th>V.Venda</th>
        <th>Equipamento</th><th>Técnico</th><th>Data</th><th>Ação</th>
      </tr></thead>
      <tbody>
      ${list.map(m => `<tr>
        <td class="mono" style="font-weight:700;color:var(--accent)">#${m.numSeq||m.id.slice(-4)}</td>
        <td>
          <div class="mono" style="font-size:11px;font-weight:700;color:var(--accent)">${m.pecaCodigo||'—'}</div>
          <div style="font-size:11px;color:var(--text2)">${m.pecaNome||'—'}</div>
        </td>
        <td class="mono" style="font-weight:700">${m.qtd||1}</td>
        ${isAdmin ? `<td class="mono" style="font-size:11px;color:var(--accent)">R$ ${((m.pecaCusto||0)*(m.qtd||1)).toFixed(2)}</td>` : ''}
        <td class="mono" style="font-size:11px;font-weight:700;color:var(--green)">R$ ${((m.pecaValorVenda||0)*(m.qtd||1)).toFixed(2)}</td>
        <td style="font-size:11px">${m.equipNome||'—'} <span style="color:var(--text3)">${m.equipSerie ? '· '+m.equipSerie : ''}</span></td>
        <td style="font-size:11px">${m.tecnico||'—'}</td>
        <td class="mono" style="font-size:10px;color:var(--text3)">${new Date(m.eventos[0]?.data||Date.now()).toLocaleDateString('pt-BR')}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="abrirActionModal('${m.id}','ENVIAR')">📦 Despachar</button></td>
      </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Pedidos Registrados ────────────────────────────────────────────────────────
function renderPedidos(q = '') {
  const el = document.getElementById('pedidos-table');
  if (!el) return;
  const ql = (q || document.querySelector('#panel-compras-pedidos .search-input')?.value || '').toLowerCase();
  const isAdmin = podeAcessar('admin');

  const list = [...db.pedidos]
    .filter(p => !ql || String(p.numero).toLowerCase().includes(ql) || String(p.obs).toLowerCase().includes(ql))
    .sort((a,b) => b.data - a.data);

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">Nenhum Pedido Registrado</div>
      <div class="empty-sub">Gere pedidos a partir da aba Sugestão de Compra</div>
    </div>`;
    return;
  }

  const statusBadge = s => ({
    ABERTO:    ['ABERTO',   'rgba(231,76,60,0.15)',  'var(--red)',   'rgba(231,76,60,0.4)'],
    PARCIAL:   ['PARCIAL',  'rgba(243,156,18,0.15)', '#f39c12',     'rgba(243,156,18,0.4)'],
    CONCLUIDO: ['CONCLUÍDO','rgba(46,204,113,0.15)', 'var(--green)','rgba(46,204,113,0.4)'],
    CANCELADO: ['CANCELADO','rgba(100,100,100,0.15)','var(--text3)','rgba(100,100,100,0.4)'],
  }[s] || [s,'var(--surface2)','var(--text3)','var(--border)']);

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Número</th><th>Data</th><th>Itens</th>
      ${isAdmin ? '<th>Custo Total</th>' : ''}
      <th>V.Venda Total</th>
      <th>Status</th><th>Observação</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(p => {
      const totalC = p.itens.reduce((s,i) => s + (i.custoTotal||0), 0);
      const totalV = p.itens.reduce((s,i) => s + (i.valorVendaUnit||0)*(i.qtd||1), 0);
      const [slabel, sbg, scolor, sborder] = statusBadge(p.status);
      return `<tr>
        <td class="mono" style="font-weight:700;color:var(--accent)">${p.numero}</td>
        <td class="mono" style="font-size:11px">${new Date(p.data).toLocaleDateString('pt-BR')}</td>
        <td class="mono">${p.itens.length}</td>
        ${isAdmin ? `<td class="mono" style="font-weight:700;color:var(--accent)">R$ ${totalC.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>` : ''}
        <td class="mono" style="font-weight:700;color:var(--green)">R$ ${totalV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
        <td>
          <select class="form-select" style="width:130px;font-size:11px;
            background:${sbg};color:${scolor};border-color:${sborder}"
            onchange="atualizarStatusPedido('${p.id}',this.value)">
            <option value="ABERTO"    ${p.status==='ABERTO'?'selected':''}>ABERTO</option>
            <option value="PARCIAL"   ${p.status==='PARCIAL'?'selected':''}>PARCIAL</option>
            <option value="CONCLUIDO" ${p.status==='CONCLUIDO'?'selected':''}>CONCLUÍDO</option>
            <option value="CANCELADO" ${p.status==='CANCELADO'?'selected':''}>CANCELADO</option>
          </select>
        </td>
        <td style="font-size:11px;color:var(--text3)">${p.obs||'—'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="verDetalhesPedido('${p.id}')">Ver</button>
          <button class="btn btn-excel btn-sm"  onclick="exportarPedidoById('${p.id}')">⬇</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
}

function atualizarStatusPedido(id, status) {
  API.put('/pedidos/' + id + '/status', { status })
    .then(() => { toast('Status atualizado'); loadAndRenderCompras(); })
    .catch(err => toast(err.message, 'error'));
}
function verDetalhesPedido(id) {
  const p = db.pedidos.find(x => x.id === id);
  if (!p) return;
  _pedidoRascunho = p.itens.map(i => ({...i, qtdSugerida: i.qtd, valorVendaUnit: i.valorVendaUnit||0, origens: i.origens||[]}));
  document.getElementById('modal-pedido-title').textContent = `Pedido ${p.numero}`;
  document.getElementById('modal-pedido-body').innerHTML = gerarHtmlDetalhesPedido(p);
  openModal('modal-pedido');
}

function gerarHtmlDetalhesPedido(p) {
  const isAdmin = podeAcessar('admin');
  const totalC = p.itens.reduce((s,i) => s + (i.custoTotal||0), 0);
  const totalV = p.itens.reduce((s,i) => s + (i.valorVendaUnit||0)*(i.qtd||1), 0);
  return `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${isAdmin ? `<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">CUSTO TOTAL</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--accent)">R$ ${totalC.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>` : ''}
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">V.VENDA TOTAL</div>
        <div style="font-family:var(--mono);font-size:18px;font-weight:800;color:var(--green)">R$ ${totalV.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:10px 16px">
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3)">DATA</div>
        <div style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--text)">${new Date(p.data).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>
    <div style="max-height:380px;overflow-y:auto">
    <table class="data-table">
      <thead><tr><th>P/N</th><th>Nome</th><th>Fonte</th><th>Qtd</th>
        ${isAdmin ? '<th>Custo Unit.</th><th>Custo Total</th>' : ''}
        <th>V.Venda Total</th><th>Origem</th>
      </tr></thead>
      <tbody>${p.itens.map(i => `<tr>
        <td class="mono" style="font-size:11px;color:var(--accent);font-weight:700">${i.codigo}</td>
        <td style="font-size:11px;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.nome}</td>
        <td style="font-size:11px;color:var(--text3)">${i.fonte||'—'}</td>
        <td class="mono" style="font-weight:700">${i.qtd}</td>
        ${isAdmin ? `<td class="mono" style="font-size:11px;color:var(--accent)">R$ ${(i.custoUnit||0).toFixed(2)}</td>
        <td class="mono" style="font-weight:700;color:var(--accent)">R$ ${(i.custoTotal||0).toFixed(2)}</td>` : ''}
        <td class="mono" style="font-weight:700;color:var(--green)">R$ ${((i.valorVendaUnit||0)*(i.qtd||1)).toFixed(2)}</td>
        <td style="font-size:10px;color:var(--text3)">${(i.origens||[]).join(', ')||'—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

function exportarPedidoById(id) {
  const p = db.pedidos.find(x => x.id === id);
  if (!p) return;
  _pedidoRascunho = p.itens.map(i => ({...i, qtdSugerida: i.qtd, valorVendaUnit: i.valorVendaUnit||0, origens: i.origens||[]}));
  exportarPedidoExcel();
}

// ── Configuração ───────────────────────────────────────────────────────────────
function salvarConfigCompras() {
  db.configCompras.diasEstoque    = parseInt(document.getElementById('cfg-dias-estoque')?.value)    || 30;
  db.configCompras.periodoAnalise = parseInt(document.getElementById('cfg-periodo-analise')?.value) || 90;
  db.configCompras.incluiDoadora  = document.getElementById('cfg-inclui-doadora')?.value  || 'sim';
  db.configCompras.incluiPendente = document.getElementById('cfg-inclui-pendente')?.value || 'sim';
  API.put('/config/config_compras', db.configCompras)
    .then(() => toast('Configuração salva'))
    .catch(err => toast(err.message, 'error'));
}
function renderConfigCompras() {
  const cfg = db.configCompras;
  const el  = document.getElementById('cfg-dias-estoque');
  if (el) el.value = cfg.diasEstoque || 30;
  const ep  = document.getElementById('cfg-periodo-analise');
  if (ep) ep.value = cfg.periodoAnalise || 90;
  const id  = document.getElementById('cfg-inclui-doadora');
  if (id) id.value = cfg.incluiDoadora || 'sim';
  const ip  = document.getElementById('cfg-inclui-pendente');
  if (ip) ip.value = cfg.incluiPendente || 'sim';
  filtrarPecasCfg('');
}

function filtrarPecasCfg(q) {
  const el = document.getElementById('cfg-pecas-lista');
  if (!el) return;
  const ql   = (q||'').toLowerCase().trim();
  const cfg  = db.configCompras;
  const list = db.pecas
    .filter(p => !ql || String(p.codigo||'').toLowerCase().includes(ql) || String(p.nome||'').toLowerCase().includes(ql))
    .slice(0, 80);

  if (!list.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px">Nenhuma peça encontrada</div>'; return; }

  el.innerHTML = list.map(p => {
    const dias = (cfg.diasPorPeca && cfg.diasPorPeca[p.id]) || '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${p.codigo}</span>
        <span style="font-size:11px;color:var(--text2);margin-left:8px">${p.nome.slice(0,50)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <input type="number" min="1" placeholder="${cfg.diasEstoque||30}" value="${dias}"
          style="width:72px;background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);
          padding:4px 8px;font-family:var(--mono);font-size:11px;color:var(--text);text-align:center"
          oninput="setDiasPeca('${p.id}', this.value)"
          title="Deixe vazio para usar o valor global (${cfg.diasEstoque||30} dias)">
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">dias</span>
      </div>
    </div>`;
  }).join('');
}

function setDiasPeca(pecaId, val) {
  if (!db.configCompras.diasPorPeca) db.configCompras.diasPorPeca = {};
  const v = parseInt(val);
  if (v > 0) db.configCompras.diasPorPeca[pecaId] = v;
  else delete db.configCompras.diasPorPeca[pecaId];
}

function updateBadges() {
  document.getElementById('badge-pecas').textContent = db.pecas.length;
  document.getElementById('badge-equip').textContent = db.equipamentos.length;
  document.getElementById('badge-usuarios').textContent = db.usuarios.length;
  const bdg = document.getElementById('badge-doadoras');
  if (bdg) bdg.textContent = db.doadoras.length;
  atualizarBadgeCompras();
  const totalLog = db.movimentacoes.filter(m =>
    ['ENVIADA','COMPRA_PENDENTE'].includes(m.status) ||
    (m.tipoAlocacao==='RETORNO' && m.status!=='FINALIZADO')
  ).length;
  document.getElementById('badge-logistica').textContent = totalLog || '';
}

// ============================================================
//  EXPORT / IMPORT EXCEL  (SheetJS)
// ============================================================

// Colunas exatas do eLoca → campos internos
const ELOCA_MAP = {
  'produto':              'codigo',
  'descrição':            'nome',
  'grupo':                'grupo',
  'grupo 2':              'grupo2',
  'controla série':       'controla_serie',
  'controla lote':        'controla_lote',
  'fonte fornecimento':   'fonte',
  'ncm':                  'ncm',
  'und':                  'unidade',
  'altura':               'altura',
  'largura':              'largura',
  'comprimento':          'comprimento',
  'peso líquido':         'peso_liq',
  'peso bruto':           'peso_bruto',
  'tipo de produto':      'tipo_produto',
  'status':               'status',
  'ref.fornecedor':       'ref',
  'cód. barras':          'cod_barras',
  'cód. tributação':      'cod_tributacao',
  'forma custo':          'forma_custo',
  'data cadastro':        'data_cadastro',
  'esp. técnica':         'esp_tecnica',
  'descrição nf':         'descricao_nf',
  'custo usd':            'custo_usd',
  'custo r$':             'custo',
  'valor venda':          'valor_venda',
  'estoque minimo':       'minimo',
  'estoque mínimo':       'minimo',
  'vida util (dias)':     'vida_util',
  'vida útil (dias)':     'vida_util',
};

// Campos numéricos
const NUMERIC_FIELDS = new Set(['minimo','vida_util','custo_usd','custo','valor_venda']);

// Cabeçalhos para exportação (formato eLoca)
const EXPORT_PECAS_HEADS = [
  'Produto','Descrição','Grupo','Grupo 2','Controla Série','Controla Lote',
  'Fonte Fornecimento','NCM','UND','Altura','Largura','Comprimento',
  'Peso Líquido','Peso Bruto','Tipo de Produto','Status',
  'Ref.Fornecedor','Cód. Barras','Cód. Tributação','Forma Custo',
  'Data Cadastro','Esp. Técnica','Descrição NF',
  'Estoque Minimo','Vida Util (Dias)','Custo USD','Custo R$','Valor Venda'
];
const EXPORT_PECAS_KEYS = [
  'codigo','nome','grupo','grupo2','controla_serie','controla_lote',
  'fonte','ncm','unidade','altura','largura','comprimento',
  'peso_liq','peso_bruto','tipo_produto','status',
  'ref','cod_barras','cod_tributacao','forma_custo',
  'data_cadastro','esp_tecnica','descricao_nf',
  'minimo','vida_util','custo_usd','custo','valor_venda'
];
const EQUIP_COLS  = ['codigo','nome','tipo','local','serie','resp','status','obs'];
const EQUIP_HEADS = ['Código','Nome','Tipo','Localização','Nº Série','Responsável','Status','Observações'];

function exportarExcel(aba) {
  const wb = XLSX.utils.book_new();

  if (aba === 'pecas') {
    const rows = [EXPORT_PECAS_HEADS, ...db.pecas.map(p => EXPORT_PECAS_KEYS.map(k => p[k]??''))];
    const ws = buildSheet(rows, EXPORT_PECAS_HEADS);
    XLSX.utils.book_append_sheet(wb, ws, 'Peças');
    XLSX.writeFile(wb, 'partforge_pecas.xlsx');
    toast(`${db.pecas.length} peças exportadas com sucesso`);

  } else if (aba === 'equipamentos') {
    const heads = [
      'Local','Equipamento','Série Fabricante','Fornecedor','Usado','Status',
      'Data de Compra','Ano de Fabricação','Término Garantia','Nome Fantasia','Proprietário',
      'Cód. Produto','Produto','Grupo','Grupo 2','Envio','Ult. Retorno','Contrato',
      'Ult. OS','Local Contrato','Setor','OS Aberta','OS Instalação',
      'Endereço','Numero Endereço','Bairro','Complemento','Município','UF','CEP',
      'Nota Fiscal de Compra','IP','Marca','Modelo','Valor de Mercado','Valor de Compra'
    ];
    const keys = [
      'local','codigo','serie','fornecedor','usado','status',
      'data_compra','ano_fab','termino_garantia','nome_fantasia','proprietario',
      'cod_produto','nome','grupo','grupo2','envio','ult_retorno','contrato',
      'ult_os','local_contrato','setor','os_aberta','os_instalacao',
      'endereco','numero','bairro','complemento','municipio','uf','cep',
      'nf_compra','ip','marca','modelo','valor_mercado','valor_compra'
    ];
    const rows = [heads, ...db.equipamentos.map(e => keys.map(k => e[k]??''))];
    const ws = buildSheet(rows, heads);
    XLSX.utils.book_append_sheet(wb, ws, 'OG');
    XLSX.writeFile(wb, 'partforge_equipamentos.xlsx');
    toast(`${db.equipamentos.length} equipamentos exportados com sucesso`);

  } else if (aba === 'estoque') {
    const depoHeads = [...DEPOSITOS, 'Total'];
    const heads = ['Produto','Descrição','Unidade','Grupo', ...depoHeads, 'Est.Mínimo','Situação'];
    // Mescla peças cadastradas + depósitos importados
    const allCods = new Set([...db.pecas.map(p=>String(p.codigo)), ...Object.keys(db.depositos)]);
    const rows = [heads, ...[...allCods].map(cod => {
      const p    = db.pecas.find(x => String(x.codigo) === cod);
      const deps = db.depositos[cod] || {};
      const tot  = p ? (db.estoque[p.id]||0) : (deps['Total']||0);
      const sit  = tot <= 0 ? 'Zerado' : ((p?.minimo||0) > 0 && tot < (p?.minimo||0) ? 'Crítico' : 'Normal');
      return [
        cod,
        p?.nome || deps._nome || '',
        p?.unidade || deps._und || 'UN',
        p?.grupo || deps._grupo || '',
        ...DEPOSITOS.map(d => deps[d]||0),
        tot,
        p?.minimo||0,
        sit
      ];
    })];
    const ws = buildSheet(rows, heads);
    // Colorir coluna Situação
    rows.slice(1).forEach((row, i) => {
      const sitVal = row[row.length-1];
      const cell = ws[XLSX.utils.encode_cell({r: i+1, c: row.length-1})];
      if (cell) {
        const color = sitVal==='Zerado' ? 'FFCCCC' : sitVal==='Crítico' ? 'FFF3CC' : 'CCFFDD';
        cell.s = { fill:{fgColor:{rgb:color}}, font:{bold:true} };
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'partforge_estoque.xlsx');
    toast(`Estoque exportado: ${rows.length - 1} itens`);

  } else if (aba === 'historico') {
    const heads = [
      'Nº','Status','Data Solicitação','Peça Código','Peça Descrição','Qtd','Unidade',
      'Equipamento Descrição','Nº de Série','Cliente',
      'Técnico','OS','Tipo Alocação',
      'Transporte','Rastreio','Previsão Entrega',
      'Data Recebimento','Hora Recebimento',
      'NF Número','NF Data','Devolução','Nº Retorno',
      'Data Finalização','Observação'
    ];

    const statusLabel = s => ({
      SOLICITADA:'Solicitada', ENVIADA:'Enviada', COMPRA_PENDENTE:'Compra Pendente',
      DESPACHADA:'Despachada', RECEBIDA:'Recebida', ALOCADA:'Alocada',
      NF_EMITIDA:'NF Emitida', FINALIZADO:'Finalizado'
    }[s] || s);

    const statusColor = s => ({
      SOLICITADA:'D0D0D0', ENVIADA:'AED6F1', COMPRA_PENDENTE:'FAD7A0',
      DESPACHADA:'D7BDE2', RECEBIDA:'A2D9CE', ALOCADA:'A9DFBA',
      NF_EMITIDA:'F9E79F', FINALIZADO:'A9DFBA'
    }[s] || 'FFFFFF');

    const rows = [heads, ...db.movimentacoes.map(m => {
      const dataEvt = m.eventos?.[0]?.data ? new Date(m.eventos[0].data).toLocaleString('pt-BR') : '';
      return [
        m.numSeq || '—',
        statusLabel(m.status),
        dataEvt,
        m.pecaCodigo || '',
        m.pecaNome   || '',
        m.qtd        || 0,
        m.pecaUnidade|| '',
        m.equipNome  || '',
        m.equipSerie || '',
        m.equipCliente || '',
        m.tecnico    || '',
        m.osNum      || '',
        m.tipoAlocacao || '',
        m.transportadora || '',
        m.rastreio   || '',
        m.previsaoEntrega || '',
        m.dataRecebimento || '',
        m.horaRecebimento || '',
        m.nfNumero   || '',
        m.nfData     || '',
        m.devolucao  ? 'Sim' : '',
        m.numSeqRetorno || '',
        m.dataFinalizacao || '',
        m.obs        || '',
      ];
    })];

    const ws = buildSheet(rows, heads);

    // Colorir coluna Status (índice 1)
    rows.slice(1).forEach((row, i) => {
      const cell = ws[XLSX.utils.encode_cell({r: i+1, c: 1})];
      if (cell) {
        cell.s = {
          fill: { fgColor: { rgb: statusColor(db.movimentacoes[i]?.status) } },
          font: { bold: true },
          alignment: { horizontal: 'center' }
        };
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, 'partforge_historico.xlsx');
    toast(`Histórico exportado: ${rows.length - 1} solicitações`);
  }
}

function buildSheet(rows, headers) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  headers.forEach((_, ci) => {
    const cell = ws[XLSX.utils.encode_cell({r:0, c:ci})];
    if (cell) cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1A2535' } },
      alignment: { horizontal: 'center' }
    };
  });
  const colWidths = headers.map((h, ci) => {
    const max = rows.reduce((m, row) => Math.max(m, String(row[ci]||'').length), h.length);
    return { wch: Math.min(Math.max(max + 2, 10), 45) };
  });
  ws['!cols'] = colWidths;
  return ws;
}

function importarExcel(aba) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls,.csv';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });

        let sheetName, ws, rows;

        if (aba === 'pecas') {
          // Planilha2 preferida (tem custos/estoque mínimo), senão Planilha1
          sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('planilha2'))
            || wb.SheetNames.find(n => n.toLowerCase().includes('planilha1'))
            || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarPecas(rows, sheetName);

        } else if (aba === 'equipamentos') {
          // Aba 'OG' é o padrão do eLoca; senão pega a primeira
          sheetName = wb.SheetNames.find(n => n.toUpperCase() === 'OG')
            || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarEquipamentos(rows, sheetName);

        } else if (aba === 'estoque') {
          // Sheet1 é o padrão do eLoca; senão pega a primeira
          sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'sheet1')
            || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarEstoque(rows, sheetName);
        }

      } catch(err) {
        toast('Erro ao ler arquivo: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

function importarPecas(rows, sheetName) {
  // Mapeamento flexível: normaliza header e cruza com ELOCA_MAP
  const rawHeader = rows[0];
  const headerNorm = rawHeader.map(h => String(h).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos para comparação
    .replace(/\s+/g,' ')
  );

  // Cria índice: campo_interno → coluna
  const colIndex = {};
  headerNorm.forEach((h, ci) => {
    // tenta match exato no ELOCA_MAP
    for (const [elocaKey, internalKey] of Object.entries(ELOCA_MAP)) {
      const normKey = elocaKey.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
      if (h === normKey || h.includes(normKey) || normKey.includes(h)) {
        if (colIndex[internalKey] === undefined) colIndex[internalKey] = ci;
      }
    }
  });

  // Mínimo: precisa de 'codigo' (Produto) e 'nome' (Descrição)
  if (colIndex['codigo'] === undefined || colIndex['nome'] === undefined) {
    openImportHelp('pecas');
    return;
  }

  let added = 0, updated = 0, skipped = 0;

  rows.slice(1).forEach(row => {
    const codigoRaw = row[colIndex['codigo']];
    const nomeRaw   = row[colIndex['nome']];
    const codigo    = String(codigoRaw||'').trim();
    const nome      = String(nomeRaw||'').trim();
    if (!codigo || !nome) { skipped++; return; }

    // Monta objeto com todos os campos mapeados
    const data = { codigo, nome };
    for (const [internalKey, ci] of Object.entries(colIndex)) {
      if (internalKey === 'codigo' || internalKey === 'nome') continue;
      let val = row[ci];
      if (val === undefined || val === null) val = '';
      val = String(val).trim();
      if (NUMERIC_FIELDS.has(internalKey)) {
        // Remove R$, $, pontos de milhar, troca vírgula por ponto
        val = val.replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.') || '0';
        data[internalKey] = parseFloat(val) || 0;
      } else {
        data[internalKey] = val;
      }
    }

    const existing = db.pecas.find(p => String(p.codigo) === codigo);
    if (existing) {
      Object.assign(existing, data);
      updated++;
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      db.pecas.push(data);
      if (db.estoque[data.id] === undefined) db.estoque[data.id] = 0;
      added++;
    }
  });

  updateBadges();
  renderPecas();
  renderDashboard();
  const skipMsg = skipped > 0 ? `, ${skipped} ignoradas` : '';
  toast(`eLoca [${sheetName}] — ${added} adicionadas, ${updated} atualizadas${skipMsg}`);
}

function importarEquipamentos(rows, sheetName) {
  // Mapeamento exato colunas eLoca → campos internos
  const ELOCA_EQUIP_MAP = {
    'local':                  'local',
    'equipamento':            'codigo',
    'serie fabricante':       'serie',
    'fornecedor':             'fornecedor',
    'usado':                  'usado',
    'status':                 'status',
    'data de compra':         'data_compra',
    'ano de fabricacao':      'ano_fab',
    'ano de fabricação':      'ano_fab',
    'termino garantia':       'termino_garantia',
    'término garantia':       'termino_garantia',
    'nome fantasia':          'nome_fantasia',
    'proprietario':           'proprietario',
    'proprietário':           'proprietario',
    'cod. produto':           'cod_produto',
    'produto':                'nome',
    'grupo':                  'grupo',
    'grupo 2':                'grupo2',
    'envio':                  'envio',
    'ult. retorno':           'ult_retorno',
    'contrato':               'contrato',
    'ult. os':                'ult_os',
    'local contrato':         'local_contrato',
    'setor':                  'setor',
    'os aberta':              'os_aberta',
    'os instalacao':          'os_instalacao',
    'os instalação':          'os_instalacao',
    'endereco':               'endereco',
    'endereço':               'endereco',
    'numero endereco':        'numero',
    'numero endereço':        'numero',
    'bairro':                 'bairro',
    'complemento':            'complemento',
    'municipio':              'municipio',
    'município':              'municipio',
    'uf':                     'uf',
    'cep':                    'cep',
    'nota fiscal de compra':  'nf_compra',
    'ip':                     'ip',
    'marca':                  'marca',
    'modelo':                 'modelo',
    'valor de mercado':       'valor_mercado',
    'valor de compra':        'valor_compra',
  };
  const EQUIP_NUMERIC = new Set(['ano_fab','valor_compra','valor_mercado']);

  // Normaliza cabeçalho removendo acentos
  const norm = s => String(s).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');

  const rawHeader = rows[0];
  const colIndex = {};
  rawHeader.forEach((h, ci) => {
    const hn = norm(h);
    for (const [elocaKey, internalKey] of Object.entries(ELOCA_EQUIP_MAP)) {
      if (hn === elocaKey && colIndex[internalKey] === undefined) {
        colIndex[internalKey] = ci;
      }
    }
  });

  // Mínimo: precisa de 'codigo' (Equipamento) e 'nome' (Produto)
  if (colIndex['codigo'] === undefined || colIndex['nome'] === undefined) {
    openImportHelp('equipamentos');
    return;
  }

  let added = 0, updated = 0, skipped = 0;

  rows.slice(1).forEach(row => {
    const codigoRaw = row[colIndex['codigo']];
    const nomeRaw   = row[colIndex['nome']];
    const codigo    = String(codigoRaw||'').trim();
    const nome      = String(nomeRaw||'').trim();
    if (!codigo || !nome) { skipped++; return; }

    const data = { codigo, nome };
    for (const [internalKey, ci] of Object.entries(colIndex)) {
      if (internalKey === 'codigo' || internalKey === 'nome') continue;
      let val = row[ci];
      if (val === undefined || val === null) val = '';
      val = String(val).trim();
      // Limpa datas inválidas do eLoca (0000-00-00)
      if (val === '0000-00-00' || val === '0') val = '';
      if (EQUIP_NUMERIC.has(internalKey)) {
        const clean = val.replace(/[R$\s.]/g,'').replace(',','.') || '0';
        data[internalKey] = parseFloat(clean)||0;
      } else {
        data[internalKey] = val;
      }
    }

    const existing = db.equipamentos.find(e => String(e.codigo) === codigo);
    if (existing) {
      Object.assign(existing, data);
      updated++;
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      db.equipamentos.push(data);
      added++;
    }
  });

  updateBadges();
  renderEquipamentos();
  renderDashboard();
  const skipMsg = skipped > 0 ? `, ${skipped} ignorados` : '';
  toast(`eLoca [${sheetName||'OG'}] — ${added} adicionados, ${updated} atualizados${skipMsg}`);
}

function openImportHelp(aba) {
  const msg = aba === 'pecas'
    ? 'O sistema reconhece automaticamente o formato de exportação do <strong style="color:var(--accent)">eLoca</strong>.<br><br>Colunas obrigatórias: <strong style="color:var(--text)">Produto</strong> (código) e <strong style="color:var(--text)">Descrição</strong> (nome).<br><br>Se o arquivo tiver Planilha1 e Planilha2, a Planilha2 é preferida por conter custos e estoque mínimo.'
    : aba === 'equipamentos'
    ? 'O sistema reconhece automaticamente o formato de exportação do <strong style="color:var(--accent)">eLoca — ConsultaEquipamentos</strong>.<br><br>Colunas obrigatórias: <strong style="color:var(--text)">Equipamento</strong> (código) e <strong style="color:var(--text)">Produto</strong> (nome).<br><br>A aba <strong style="color:var(--text)">OG</strong> é detectada automaticamente.'
    : 'O sistema reconhece automaticamente o formato de exportação do <strong style="color:var(--accent)">eLoca — Estoque</strong>.<br><br>Coluna obrigatória: <strong style="color:var(--text)">Produto</strong> (código).<br><br>Colunas de depósito reconhecidas: <strong style="color:var(--text)">QUALLYX, QUALLYX SC, QUALLYX SP, CONSUMO - SP, CONSUMO - BC</strong> e demais. A aba <strong style="color:var(--text)">Sheet1</strong> é detectada automaticamente.';
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:300;display:flex;align-items:center;justify-content:center';
  el.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:4px;padding:28px;max-width:500px;width:90%;box-shadow:0 24px 80px rgba(0,0,0,0.6)">
      <div style="font-family:var(--display);font-size:17px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;color:var(--accent)">⚠ Formato Não Reconhecido</div>
      <p style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:16px">${msg}</p>
      <p style="font-size:12px;color:var(--text3);margin-bottom:18px">💡 Dica: exporte primeiro para baixar um modelo no formato correto.</p>
      <button onclick="this.closest('[style]').remove()" style="background:var(--accent);color:var(--bg);border:none;padding:8px 22px;border-radius:4px;cursor:pointer;font-family:var(--body);font-weight:700;letter-spacing:1px;font-size:13px">ENTENDI</button>
    </div>`;
  document.body.appendChild(el);
}

// ============================================================
//  SAMPLE DATA
// ============================================================
// DP-C16 Spare Parts catalog (pre-loaded from Excel)


// ============================================================
//  API LOAD HELPERS — carregam dados do servidor antes de renderizar
// ============================================================
function setSyncing(active) {
  const dot = document.getElementById('sync-dot');
  if (dot) dot.className = 'sync-dot' + (active ? ' syncing' : '');
}

async function loadAndRenderPecas(q='') {
  setSyncing(true);
  try {
    db.pecas = await API.pecas(q);
    renderPecas(q);
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderEquipamentos(q='') {
  setSyncing(true);
  try {
    db.equipamentos = await API.equipamentos(q);
    renderEquipamentos(q);
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderEstoque() {
  setSyncing(true);
  try {
    const { estoque, depositos } = await API.estoque();
    db.estoque = {};
    db.depositos = {};
    estoque.forEach(e => { db.estoque[e.peca_id] = e.quantidade; });
    depositos.forEach(d => {
      if (!db.depositos[d.peca_id]) db.depositos[d.peca_id] = {};
      db.depositos[d.peca_id][d.localizacao] = d.quantidade;
    });
    renderEstoque();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderHistorico(q='', status='') {
  setSyncing(true);
  try {
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    db.movimentacoes = await API.movimentacoes(params);
    renderHistorico(q, status);
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderLogistica() {
  setSyncing(true);
  try {
    db.movimentacoes = await API.movimentacoes();
    renderLogistica();
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderOrcamentos(q='', status='') {
  setSyncing(true);
  try {
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    db.orcamentos = await API.orcamentos(params);
    renderOrcamentos(q);
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderDoadoras() {
  setSyncing(true);
  try {
    db.doadoras = await API.doadoras();
    renderDoadoras();
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderCompras() {
  setSyncing(true);
  try {
    db.pedidos = await API.pedidos();
    db.movimentacoes = await API.movimentacoes();
    renderCompras();
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderUsuarios() {
  setSyncing(true);
  try {
    db.usuarios = await API.usuarios();
    renderUsuarios();
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadAndRenderDashboard() {
  setSyncing(true);
  try {
    const dash = await API.dashboard();
    // Populate db with dashboard summary data for renderDashboard
    db._dashData = dash;
    renderDashboard();
    updateBadges();
  } catch(e) { toast(e.message, 'error'); }
  finally { setSyncing(false); }
}

async function loadMovimentacoesParaForm() {
  try {
    if (!db.pecas.length) db.pecas = await API.pecas();
    if (!db.equipamentos.length) db.equipamentos = await API.equipamentos();
    if (!db.doadoras.length) db.doadoras = await API.doadoras();
    const { estoque } = await API.estoque();
    db.estoque = {};
    estoque.forEach(e => { db.estoque[e.peca_id] = e.quantidade; });
    populateMovSelects();
  } catch(e) { toast(e.message, 'error'); }
}

// ============================================================
//  APP INIT
// ============================================================
function initApp() {
  loadAndRenderDashboard();
  // Pre-load common data
  API.pecas().then(p => { db.pecas = p; updateBadges(); });
  API.equipamentos().then(e => { db.equipamentos = e; });
  API.doadoras().then(d => { db.doadoras = d; updateBadges(); });
  API.movimentacoes().then(m => { db.movimentacoes = m; updateBadges(); });
  API.config('config_orcamento').then(c => { db.configOrcamento = c; });
  API.config('config_compras').then(c => { db.configCompras = c; });
}

// Override navigate to use loadAndRender functions
const _originalNavigate = navigate;
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;
  pageEl.classList.add('active');
  if (el) el.classList.add('active');

  const titles = {
    dashboard:    ['Dashboard',    '/ visão geral'],
    pecas:        ['Peças',        '/ cadastro'],
    equipamentos: ['Equipamentos', '/ cadastro'],
    estoque:      ['Estoque',      '/ posição atual'],
    movimentacao: ['Movimentação', '/ nova solicitação'],
    historico:    ['Histórico',    '/ solicitações'],
    logistica:    ['Logística',    '/ painel de despacho'],
    orcamento:    ['Orçamentos',   '/ cadastro e faturamento'],
    usuarios:     ['Usuários',     '/ cadastro e permissões'],
    compras:      ['Compras',      '/ pedidos e sugestões'],
    doadoras:     ['Máq. Doadoras','/ retirada de peças'],
  };
  const t = titles[page] || [page, ''];
  const titleEl = document.getElementById('page-title');
  const pathEl  = document.getElementById('page-path');
  if (titleEl) titleEl.textContent = t[0];
  if (pathEl)  pathEl.textContent  = t[1];

  const actionsEl = document.getElementById('topbar-actions');
  if (actionsEl) actionsEl.innerHTML = '';

  if (page === 'pecas') {
    const isAdmin = podeAcessar('admin');
    if (actionsEl) actionsEl.innerHTML = `
      ${isAdmin ? `<div style="display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius);padding:4px 10px">
        <span style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:1px">TAXA</span>
        <input type="number" step="0.01" id="global-taxa" placeholder="1.50" style="width:56px;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center" value="${window._globalTaxa||''}" oninput="aplicarTaxaDolar()">
        <span style="color:var(--border2)">×</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">US$1 =</span>
        <input type="number" step="0.01" id="global-dolar" placeholder="5.60" style="width:56px;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center" value="${window._globalDolar||''}" oninput="aplicarTaxaDolar()">
        <span style="font-family:var(--mono);font-size:9px;color:var(--text3)">R$</span>
        <span style="color:var(--border2);margin:0 2px">|</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--green)">MK</span>
        <input type="number" step="0.01" id="global-markup" placeholder="2.00" style="width:52px;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:12px;color:var(--text);text-align:center" value="${window._globalMarkup||''}" oninput="aplicarTaxaDolar()">
      </div>` : ''}
      <button class="btn btn-import" onclick="importarExcel('pecas')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('pecas')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="openModalPeca()">⊕ Nova Peça</button>`;
    loadAndRenderPecas();
  } else if (page === 'equipamentos') {
    if (actionsEl) actionsEl.innerHTML = `
      <button class="btn btn-import" onclick="importarExcel('equipamentos')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('equipamentos')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="openModalEquip()">⊕ Novo Equipamento</button>`;
    loadAndRenderEquipamentos();
  } else if (page === 'estoque') {
    if (actionsEl) actionsEl.innerHTML = `
      <button class="btn btn-import" onclick="importarExcel('estoque')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('estoque')">⬇ Exportar Excel</button>`;
    loadAndRenderEstoque();
  } else if (page === 'movimentacao') {
    loadMovimentacoesParaForm();
  } else if (page === 'historico') {
    if (actionsEl) actionsEl.innerHTML = `<button class="btn btn-excel" onclick="exportarExcel('historico')">⬇ Exportar Excel</button>`;
    loadAndRenderHistorico();
  } else if (page === 'logistica') {
    loadAndRenderLogistica();
  } else if (page === 'compras') {
    loadAndRenderCompras();
  } else if (page === 'doadoras') {
    if (actionsEl) actionsEl.innerHTML = `<button class="btn btn-primary" onclick="abrirModalDoadora()">⊕ Nova Doadora</button>`;
    loadAndRenderDoadoras();
  } else if (page === 'orcamento') {
    if (actionsEl) actionsEl.innerHTML = `
      <button class="btn btn-ghost" onclick="abrirConfigOrcamento()" title="Configurar condições gerais">⚙ Configurar</button>
      <button class="btn btn-excel" onclick="exportarExcel('orcamentos')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="abrirModalOrcamento()">⊕ Novo Orçamento</button>`;
    loadAndRenderOrcamentos();
  } else if (page === 'usuarios') {
    if (!podeAcessar('admin')) { toast('Acesso restrito', 'error'); return; }
    if (actionsEl) actionsEl.innerHTML = `<button class="btn btn-primary" onclick="abrirModalUsuario()">⊕ Novo Usuário</button>`;
    loadAndRenderUsuarios();
  } else if (page === 'dashboard') {
    loadAndRenderDashboard();
  }
}

// ============================================================
//  BACKUP / RESTORE via API
// ============================================================
function exportarBancoDados() {
  window.open('/api/backup', '_blank');
}

function importarBancoDados(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const snap = JSON.parse(e.target.result);
      await API.post('/restore', snap);
      toast('Backup restaurado com sucesso!');
      setTimeout(() => initApp(), 500);
    } catch(err) {
      toast('Erro ao restaurar: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================================
//  AUTO-START: Verifica token e inicia sessão
// ============================================================
(function autoStart() {
  const token = API.getToken();
  if (!token) return; // Mostra tela de login

  API.me().then(({ usuario }) => {
    currentUser = usuario;
    document.getElementById('login-screen').classList.add('hidden');
    atualizarUserPill();
    const navUsr = document.getElementById('nav-usuarios');
    if (navUsr) navUsr.style.display = podeAcessar('admin') ? '' : 'none';
    initApp();
  }).catch(() => {
    API.clearToken();
  });
})();
