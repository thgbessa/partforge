
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
  solicitacoesCompra: [],  // { id, numero, status, demanda, demanda_nome, equip_serie, itens[], obs, ... }
  kitsPreventivas: [],     // { id, nome, fonte, linha, taxa, dolar, markup, itens[], obs, ... }
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
    validade: '7 dias',
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
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.body.classList.remove('mob-active'); var _pM=document.getElementById('page-mobile-requests'); if(_pM) _pM.style.display='none';
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

  if (page === 'mobile-requests') { var _pM2=document.getElementById('page-mobile-requests'); if(_pM2) _pM2.style.display='block'; document.body.classList.add('mob-active'); setTimeout(()=>{renderMobOrc();renderMobPed();marcarTodasLidas();},200); }
  if (page === 'mobile-requests') {
    const pMob=document.getElementById('page-mobile-requests');
    document.body.classList.add('mob-active');
    setTimeout(()=>{if(typeof renderMobOrc==='function'){renderMobOrc();renderMobPed();marcarTodasLidas();}},300);
  }
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
      <button class="btn btn-import" onclick="importarExcel('orcamentos')">⬆ Importar Excel</button>
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
window._globalTaxa   = 2.00;
window._globalDolar  = 5.27;
window._globalMarkup = 2.00;

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
  document.getElementById('peca-minimo').value      = (p?.minimo !== undefined && p?.minimo !== null) ? p.minimo : 5;
  document.getElementById('peca-localizacao').value     = p?.localizacao     || '';
  document.getElementById('peca-localizacao-bin').value = p?.localizacao_bin || '';
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
    preco_usd:   parseFloat(document.getElementById('peca-preco-usd').value)   || 0,
    minimo:      parseFloat(document.getElementById('peca-minimo').value)      || 5,
    localizacao:     document.getElementById('peca-localizacao').value     || '',
    localizacao_bin: document.getElementById('peca-localizacao-bin').value.trim() || '',
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
let pecasPagina = 1;
const PECAS_POR_PAGINA = 150;

function renderPecas(q='', manterPagina=false) {
  const el = document.getElementById('pecas-table');
  if (!el) return;
  if (!manterPagina) pecasPagina = 1;
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

  const totalPaginas = Math.max(1, Math.ceil(list.length / PECAS_POR_PAGINA));
  if (pecasPagina > totalPaginas) pecasPagina = totalPaginas;
  if (pecasPagina < 1) pecasPagina = 1;
  const inicio = (pecasPagina - 1) * PECAS_POR_PAGINA;
  const pageList = list.slice(inicio, inicio + PECAS_POR_PAGINA);

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

  const paginacaoHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 6px;
      font-family:var(--mono);font-size:11px;color:var(--text3);flex-wrap:wrap;gap:10px">
      <span>Mostrando ${inicio+1}–${Math.min(inicio+PECAS_POR_PAGINA, list.length)} de ${list.length}</span>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="mudarPaginaPecas(-1)" ${pecasPagina<=1?'disabled':''}>‹ Anterior</button>
        <span>Página ${pecasPagina} de ${totalPaginas}</span>
        <button class="btn btn-ghost btn-sm" onclick="mudarPaginaPecas(1)" ${pecasPagina>=totalPaginas?'disabled':''}>Próxima ›</button>
      </div>
    </div>`;

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
    ${pageList.map(p => {
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
    </tbody></table>
    ${paginacaoHtml}`;
  document.getElementById('badge-pecas').textContent = list.length;
}

function mudarPaginaPecas(delta) {
  pecasPagina += delta;
  const q = document.querySelector('#page-pecas .search-input')?.value || '';
  renderPecas(q, true);
  document.getElementById('pecas-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
const EQUIP_TEXT_FIELDS = [
  'codigo','nome','cod-produto','serie','marca','modelo','grupo','grupo2',
  'local','setor','ip','nome-fantasia','cnpj','contrato','local-contrato','ult-os',
  'os-aberta','os-instalacao','fornecedor','nf-compra','data-compra',
  'termino-garantia','envio','ult-retorno','endereco','numero','complemento',
  'bairro','municipio','uf','cep'
];
const EQUIP_SEL_FIELDS = ['status','proprietario','usado'];
const EQUIP_NUM_FIELDS = ['ano-fab','valor-compra','valor-mercado'];

// ── CNPJ do cliente no Equipamento (mesma memória usada em Orçamentos) ──
let _cnpjEquipEditadoManualmente = false;

function onClienteEquipMudou() {
  _cnpjEquipEditadoManualmente = false;
  const statusEl = document.getElementById('equip-cnpj-status');
  if (statusEl) statusEl.textContent = '';
}

function onCnpjEquipEditadoManualmente() {
  _cnpjEquipEditadoManualmente = true;
  const statusEl = document.getElementById('equip-cnpj-status');
  if (statusEl) statusEl.textContent = '';
}

function buscarCnpjEquip() {
  const nome = document.getElementById('equip-nome-fantasia')?.value.trim();
  const cnpjEl = document.getElementById('equip-cnpj');
  const statusEl = document.getElementById('equip-cnpj-status');
  if (!nome || !cnpjEl) return;
  if (_cnpjEquipEditadoManualmente && cnpjEl.value.trim()) return;
  API.get('/clientes/cnpj?nome=' + encodeURIComponent(nome)).then(res => {
    if (res && res.cnpj) {
      cnpjEl.value = res.cnpj;
      if (statusEl) { statusEl.textContent = '✓ encontrado'; statusEl.style.color = 'var(--green)'; }
    } else if (statusEl) {
      statusEl.textContent = cnpjEl.value.trim() ? '' : 'cliente novo — digite o CNPJ';
      statusEl.style.color = 'var(--text3)';
    }
  }).catch(() => {});
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
  _cnpjEquipEditadoManualmente = !!(e?.cnpj);
  const equipCnpjStatusEl = document.getElementById('equip-cnpj-status');
  if (equipCnpjStatusEl) equipCnpjStatusEl.textContent = '';
  if (!e?.cnpj && e?.nome_fantasia) buscarCnpjEquip();
  openModal('modal-equip');
}

function salvarEquipamento() {
  const data = {};
  const fields = ['modelo','marca','serie','linha','local','contrato','obs'];
  for (const f of fields) {
    const el = document.getElementById('equip-' + f);
    if (el) data[f] = el.value.trim();
  }
  // Não existe campo "equip-cliente" no formulário — quem representa o cliente
  // é "Nome Fantasia", que precisa ir pra coluna real "cliente".
  data.cliente = document.getElementById('equip-nome-fantasia')?.value.trim() || '';
  if (!data.modelo) { toast('Modelo obrigatório', 'error'); return; }
  if (editId) data.id = editId;

  // Campos extras (Cód. Produto, Grupo 2, Setor, IP, Nome Fantasia, CNPJ, Fornecedor,
  // NF Compra, datas, endereço, status, proprietário, valores etc.) — guardados em
  // "campos" (JSON). Começa com os que já existiam (importação, etc.) e sobrescreve
  // com o que estiver preenchido no formulário, para não perder dados de outras origens.
  const campos = { ...(editId ? (db.equipamentos.find(x => x.id === editId)?.campos || {}) : {}) };
  [...EQUIP_TEXT_FIELDS, ...EQUIP_SEL_FIELDS, ...EQUIP_NUM_FIELDS].forEach(f => {
    const el = document.getElementById('equip-' + f);
    if (el) campos[f.replace(/-/g, '_')] = el.value.trim();
  });
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

let estoquePagina = 1;
const ESTOQUE_POR_PAGINA = 150;

function renderEstoque(q='', manterPagina=false) {
  const el = document.getElementById('estoque-table');
  if (!manterPagina) estoquePagina = 1;

  // Índice código->peça construído UMA VEZ (O(n)), em vez de db.pecas.find()
  // dentro do loop abaixo (O(n) por código, O(n²) no total — era isso que
  // travava a tela com o catálogo grande).
  const indicePecas = new Map();
  db.pecas.forEach(p => indicePecas.set(String(p.codigo), p));

  // Filtra: peças com dados de estoque importado OU que constam no db.pecas
  const allCodigos = new Set([
    ...db.pecas.map(p => String(p.codigo)),
    ...Object.keys(db.depositos)
  ]);

  let list = [];
  allCodigos.forEach(cod => {
    const peca = indicePecas.get(cod);
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
      String(r.peca?.grupo || r.deps._grupo || '').toLowerCase().includes(ql) ||
      String(r.peca?.localizacao || '').toLowerCase().includes(ql) ||
      String(r.peca?.localizacao_bin || '').toLowerCase().includes(ql)
    );
  }

  // Ordena: com estoque primeiro, depois por código
  list.sort((a,b) => b.total - a.total || String(a.cod).localeCompare(String(b.cod)));

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◫</div><div class="empty-title">Estoque Vazio</div><div class="empty-sub">Importe a planilha de estoque do eLoca ou registre movimentações</div></div>`;
    return;
  }

  const totalPaginas = Math.max(1, Math.ceil(list.length / ESTOQUE_POR_PAGINA));
  if (estoquePagina > totalPaginas) estoquePagina = totalPaginas;
  if (estoquePagina < 1) estoquePagina = 1;
  const inicio = (estoquePagina - 1) * ESTOQUE_POR_PAGINA;
  const pageList = list.slice(inicio, inicio + ESTOQUE_POR_PAGINA);

  // Verifica quais depósitos têm algum valor > 0 (para mostrar só os relevantes)
  // — calculado sobre a lista inteira filtrada, não só a página, para não
  // esconder/mostrar colunas de depósito conforme a página mudar.
  const depoComValor = DEPOSITOS.filter(d =>
    list.some(r => (r.deps[d]||0) > 0)
  );
  const depoShow = depoComValor.length > 0 ? depoComValor : DEPOSITOS_ATIVOS;

  const paginacaoHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 6px;
      font-family:var(--mono);font-size:11px;color:var(--text3);flex-wrap:wrap;gap:10px">
      <span>Mostrando ${inicio+1}–${Math.min(inicio+ESTOQUE_POR_PAGINA, list.length)} de ${list.length}</span>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="mudarPaginaEstoque(-1)" ${estoquePagina<=1?'disabled':''}>‹ Anterior</button>
        <span>Página ${estoquePagina} de ${totalPaginas}</span>
        <button class="btn btn-ghost btn-sm" onclick="mudarPaginaEstoque(1)" ${estoquePagina>=totalPaginas?'disabled':''}>Próxima ›</button>
      </div>
    </div>`;

  el.innerHTML = `
  <table class="data-table" style="min-width:900px">
    <thead><tr>
      <th>Produto</th>
      <th>Descrição</th>
      <th>Grupo</th>
      <th>Localização</th>
      <th>UND</th>
      ${depoShow.map(d => `<th style="text-align:center;font-size:9px;white-space:nowrap">${d}</th>`).join('')}
      <th style="text-align:center">Total</th>
      <th>Mín.</th>
      <th>Situação</th>
      <th>Nível</th>
      <th></th>
    </tr></thead>
    <tbody>
    ${pageList.map(r => {
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
        <td style="font-size:11px;color:var(--text2);white-space:nowrap">
          ${peca?.localizacao ? peca.localizacao + (peca.localizacao_bin ? ' · ' + peca.localizacao_bin : '') : '<span style="color:var(--text3)">—</span>'}
        </td>
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
        <td style="text-align:right;white-space:nowrap">
          ${peca ? `<button class="btn btn-ghost btn-sm" onclick="abrirModalAjusteEstoque('${peca.id}')">Ajustar</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
  ${paginacaoHtml}`;
}

function mudarPaginaEstoque(delta) {
  estoquePagina += delta;
  const q = document.querySelector('#page-estoque .search-input')?.value || '';
  renderEstoque(q, true);
  document.getElementById('estoque-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── AJUSTE MANUAL DE ESTOQUE ─────────────────────────────────
function abrirModalAjusteEstoque(pecaId) {
  const peca = db.pecas.find(x => x.id === pecaId);
  if (!peca) return;
  const atual = db.estoque[pecaId] || 0;

  let overlay = document.getElementById('modal-ajuste-estoque-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-ajuste-estoque-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);
      max-width:420px;width:95%">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;
        border-bottom:1px solid var(--border)">
        <span style="font-weight:700;font-size:15px">Ajustar Estoque</span>
        <button onclick="document.getElementById('modal-ajuste-estoque-overlay').remove()"
          style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="padding:20px">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);
          padding:10px 14px;margin-bottom:16px;font-size:12px">
          <div><span style="color:var(--accent);font-family:var(--mono);font-weight:700">${peca.codigo}</span> · ${peca.nome}</div>
          <div style="color:var(--text3);margin-top:4px">Estoque atual: <strong style="color:var(--text)">${atual} ${peca.unidade||'UN'}</strong></div>
        </div>
        <div class="form-group">
          <label class="form-label">Nova Quantidade em Estoque</label>
          <input class="form-input" type="number" min="0" id="ajuste-estoque-qtd" value="${atual}"
            onkeydown="if(event.key==='Enter') salvarAjusteEstoque('${pecaId}')">
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">
          Digite a quantidade correta — serve para lançar entrada, saída ou corrigir uma contagem física.
          O sistema grava o valor final informado aqui.
        </div>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-ajuste-estoque-overlay').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="salvarAjusteEstoque('${pecaId}')">✓ Salvar</button>
      </div>
    </div>`;

  setTimeout(() => document.getElementById('ajuste-estoque-qtd')?.focus(), 50);
}

function salvarAjusteEstoque(pecaId) {
  const input = document.getElementById('ajuste-estoque-qtd');
  const novaQtd = parseFloat(input?.value);
  if (isNaN(novaQtd) || novaQtd < 0) { toast('Informe uma quantidade válida', 'error'); return; }
  API.put('/estoque/' + pecaId, { quantidade: novaQtd })
    .then(() => {
      toast('Estoque ajustado com sucesso');
      document.getElementById('modal-ajuste-estoque-overlay')?.remove();
      loadAndRenderEstoque();
      loadAndRenderDashboard();
    })
    .catch(err => toast(err.message, 'error'));
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

let movItens = [];
function adicionarItemMov() {
  const pecaId = document.getElementById('mov-peca').value;
  const qtd = parseInt(document.getElementById('mov-qtd').value) || 0;
  if (!pecaId) { toast('Selecione uma peca', 'error'); return; }
  if (qtd <= 0) { toast('Informe uma quantidade valida', 'error'); return; }
  const peca = db.pecas.find(function(x) { return x.id === pecaId; });
  // Captura o equipamento selecionado NO MOMENTO em que este item é
  // adicionado — assim, cada item da lista pode ir pra um equipamento
  // diferente (troque o equipamento selecionado entre uma adição e outra).
  const equipId = document.getElementById('mov-equip').value;
  const equip   = equipId ? db.equipamentos.find(x => x.id === equipId) : null;
  movItens.push({
    peca_id: pecaId,
    peca_codigo: peca?.codigo || pecaId,
    peca_nome: peca?.nome || '?',
    peca_unidade: peca?.unidade || 'UN',
    peca_fonte: peca?.fonte || '',
    peca_custo: peca?.custo || 0,
    qtd: qtd,
    equip_id: equipId || '',
    equip_serie: equip?.serie || equip?.codigo || '',
    equip_cliente: equip?.nome_fantasia || equip?.cliente || '',
    equip_modelo: equip?.modelo || '',
  });
  document.getElementById('mov-peca-search').value = '';
  document.getElementById('mov-peca').value = '';
  document.getElementById('mov-peca').dataset.label = '';
  var selEl = document.getElementById('mov-peca-selected');
  if (selEl) selEl.style.display = 'none';
  document.getElementById('mov-qtd').value = '';
  renderItensMov();
}
function renderItensMov() {
  const el = document.getElementById('mov-itens-lista');
  if (!el) return;
  if (!movItens.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<table class="data-table"><thead><tr><th>P/N</th><th>Peca</th><th>Qtd</th><th>Equipamento</th><th></th></tr></thead><tbody>' +
    movItens.map(function(it, i) {
      const equipInfo = it.equip_serie
        ? '<span style="font-family:var(--mono)">' + it.equip_serie + '</span>' + (it.equip_cliente ? ' · ' + it.equip_cliente : '')
        : '<span style="color:var(--text3);font-style:italic">sem equipamento</span>';
      return '<tr><td class="mono" style="font-size:11px;color:var(--accent)">' + (it.peca_codigo||'') + '</td>' +
        '<td style="font-size:12px">' + (it.peca_nome||'') + '</td>' +
        '<td class="mono">' + it.qtd + '</td>' +
        '<td style="font-size:11px">' + equipInfo + '</td>' +
        '<td><button class="btn btn-danger btn-sm" onclick="removerItemMov(' + i + ')">✕</button></td></tr>';
    }).join('') + '</tbody></table>';
}
function removerItemMov(idx) {
  movItens.splice(idx, 1);
  renderItensMov();
}
function criarSolicitacao() {
  var listaFinal = movItens.slice();
  var pecaIdAtual = document.getElementById('mov-peca').value;
  var qtdAtual = parseInt(document.getElementById('mov-qtd').value) || 0;
  if (!listaFinal.length && pecaIdAtual && qtdAtual > 0) {
    var pecaAtual = db.pecas.find(function(x) { return x.id === pecaIdAtual; });
    var equipIdAtual = document.getElementById('mov-equip').value;
    var equipAtual   = equipIdAtual ? db.equipamentos.find(x => x.id === equipIdAtual) : null;
    listaFinal.push({
      peca_id: pecaIdAtual, peca_codigo: pecaAtual?.codigo || pecaIdAtual,
      peca_nome: pecaAtual?.nome || '?', peca_unidade: pecaAtual?.unidade || 'UN',
      peca_fonte: pecaAtual?.fonte || '', peca_custo: pecaAtual?.custo || 0, qtd: qtdAtual,
      equip_id: equipIdAtual || '', equip_serie: equipAtual?.serie || equipAtual?.codigo || '',
      equip_cliente: equipAtual?.nome_fantasia || equipAtual?.cliente || '', equip_modelo: equipAtual?.modelo || '',
    });
  }
  if (!listaFinal.length) { toast('Adicione ao menos uma peca', 'error'); return; }
  const tecnico = document.getElementById('mov-tecnico').value.trim() || currentUser?.nome || '';
  const obs     = document.getElementById('mov-obs').value.trim();
  // Itens de uma mesma solicitação (mais de 1 peça) compartilham um grupo_id,
  // para aparecerem agrupados visualmente no Histórico, mesmo cada um mantendo
  // seu próprio status/rastreamento individual — inclusive quando vão para
  // equipamentos diferentes dentro da mesma solicitação em lote.
  const grupoId = listaFinal.length > 1 ? uid() : '';
  var criadas = 0, erros = 0;
  function processarProximo(i) {
    if (i >= listaFinal.length) {
      toast('Solicitacoes criadas: ' + criadas + (erros ? ', erros: ' + erros : ''), erros ? 'info' : 'success');
      movItens = [];
      renderItensMov();
      populateMovSelects();
      loadAndRenderDashboard();
      return;
    }
    var item = listaFinal[i];
    var estoqueAtual = db.estoque[item.peca_id] || 0;
    var temEstoque = estoqueAtual >= item.qtd;
    var data = {
      peca_id: item.peca_id, peca_codigo: item.peca_codigo, peca_nome: item.peca_nome,
      peca_unidade: item.peca_unidade, peca_fonte: item.peca_fonte, peca_custo: item.peca_custo,
      qtd: item.qtd,
      equip_id: item.equip_id || '', equip_serie: item.equip_serie || '',
      equip_cliente: item.equip_cliente || '', equip_modelo: item.equip_modelo || '',
      tecnico: tecnico, obs: obs, tem_estoque: temEstoque, grupo_id: grupoId
    };
    API.post('/movimentacoes', data).then(function() { criadas++; processarProximo(i + 1); })
      .catch(function() { erros++; processarProximo(i + 1); });
  }
  processarProximo(0);
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
  var _modal=document.getElementById('action-modal');
  if(_modal&&_modal.parentNode!==document.body) document.body.appendChild(_modal);

  const ids  = Array.isArray(id) ? id : [id];
  const itensLote = ids.map(i => db.movimentacoes.find(x => x.id === i)).filter(Boolean);
  const sol = itensLote[0];
  if (!sol) return;
  actionModalTarget = itensLote.length > 1 ? ids : id;

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
  if (itensLote.length > 1) title.textContent += ` (${itensLote.length} itens)`;

  const pInfoBox = itensLote.length > 1 ? `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);
      padding:10px 14px;margin-bottom:18px;font-size:12px;line-height:1.7">
      <div style="font-family:var(--mono);font-size:10px;color:var(--accent);letter-spacing:1px;margin-bottom:8px">
        📦 AÇÃO APLICADA AOS ${itensLote.length} ITENS DO LOTE
      </div>
      ${itensLote.map(it => `<div style="display:flex;gap:8px;align-items:center;padding:3px 0">
        <strong style="color:var(--accent);font-family:var(--mono)">${it.pecaCodigo}</strong>
        <span>${it.pecaNome}</span>
        <span style="color:var(--text3)">· ${it.qtd} ${it.pecaUnidade}</span>
      </div>`).join('')}
      ${sol.equipSerie ? `<div style="margin-top:6px;color:var(--text3)">S/N: <span style="font-family:var(--mono);color:var(--text2)">${sol.equipSerie}</span>${sol.equipCliente ? ' · '+sol.equipCliente : ''}</div>` : ''}
    </div>` : `
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
          <label class="form-label">Valor do Frete (R$)</label>
          <input class="form-input" type="number" step="0.01" id="am-frete" placeholder="0.00">
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

    const custoUnit  = parseFloat(sol.peca_custo)||0;
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
      valorNFBase = (parseFloat(sol.peca_custo)||0) * sol.qtd;
      valorLabel  = 'Valor da NF — Uso/Consumo (custo R$)';
      valorHint   = `<div style="font-size:11px;color:var(--text3);margin-top:3px">Custo unitário: R$ ${parseFloat(sol.peca_custo||0).toFixed(2)} × ${sol.qtd} un</div>`;
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
    const numRetorno = (sol.numSeq||sol.num_seq||sol.seqNum||sol.seq_num||'???') + 'R';
    const isRetornoFin = sol.tipoAlocacao==='RETORNO'||sol.tipo_alocacao==='RETORNO';
    body.innerHTML = pInfoBox + `
      <div style="background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25);border-radius:var(--radius);
        padding:14px;margin-bottom:16px;font-size:13px;color:var(--text2)">
        <strong style="color:var(--green)">✓ Processo completo.</strong>
        ${sol.nfNumero ? `NF <strong>${sol.nfNumero}</strong> emitida em <strong>${sol.nfData}</strong>.` : ''}
        Confirma a finalização desta solicitação?
      </div>

      <div style="background:rgba(231,76,60,0.06);border:1px solid rgba(231,76,60,0.2);border-radius:var(--radius);
        padding:12px 14px;margin-bottom:16px;display:${isRetornoFin?'none':'block'}">
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
  const solId = Array.isArray(actionModalTarget) ? actionModalTarget[0] : actionModalTarget;
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
  const alvo = actionModalTarget;
  const ids  = Array.isArray(alvo) ? alvo : [alvo];
  const solId = ids[0]; // usado só para checagens de contexto (ex.: FINALIZAR/RETORNO)
  const obs   = (document.getElementById('am-obs')?.value||'').trim();

  const body = { acao, obs };
  if (acao === 'DESPACHAR') {
    body.transporte        = document.getElementById('am-transporte')?.value || '';
    body.rastreio          = document.getElementById('am-rastreio')?.value.trim() || '';
    body.previsao_entrega  = document.getElementById('am-previsao')?.value || '';
    body.valor_frete       = parseFloat(document.getElementById('am-frete')?.value) || 0;
    if (!body.transporte) { toast('Informe o meio de transporte', 'error'); return; }
  }
  if (acao === 'RECEBER') {
    body.data_recebimento = document.getElementById('am-data-rec')?.value || '';
    body.hora_recebimento = document.getElementById('am-hora-rec')?.value || '';
    if (!body.data_recebimento || !body.hora_recebimento) { toast('Informe data e hora', 'error'); return; }
  }
  if (acao === 'ALOCAR') {
    body.tipo_alocacao = document.getElementById('am-tipo-aloc')?.value || 'INSTALACAO';
    body.os_num = document.getElementById('am-os-num')?.value || '';
  }
  if (acao === 'EMITIR_NF') {
    body.nf_numero = document.getElementById('am-nf-num')?.value || '';
    body.nf_data = document.getElementById('am-nf-data')?.value || '';
  }
  if (acao === 'FINALIZAR') {
    const solAtual=db.movimentacoes.find(x=>x.id===solId);
    const isRetorno=solAtual&&(solAtual.tipoAlocacao==='RETORNO'||solAtual.tipo_alocacao==='RETORNO');
    body.devolucao = !isRetorno && (document.getElementById('am-devolucao')?.checked || false);
    body.motivo_devolucao = document.getElementById('am-motivo-dev')?.value || '';
  }

  Promise.all(ids.map(id => API.put('/movimentacoes/' + id + '/acao', body)))
    .then(() => {
      closeModal('action-modal');
      toast(ids.length > 1 ? `Status atualizado (${ids.length} itens)` : 'Status atualizado');
      loadAndRenderHistorico();
      loadAndRenderLogistica();
      loadAndRenderDashboard();
      if(typeof renderMobPed==='function') renderMobPed();
      if(typeof renderMobOrc==='function') renderMobOrc();
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
      `  Valor R$:    ${sol.peca_custo ? 'R$ '+parseFloat(sol.peca_custo).toFixed(2) : 'N/D'}\n` +
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
  db.solicitacoesCompra = [];
  db.kitsPreventivas = [];
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
        <button class="btn btn-danger btn-sm" onclick="deleteMovimentacao('${m.id}')" style="font-size:10px">✕ Excluir</button>
      </div>
    </div>`;
  }).join('');
}

function cancelarMovimentacao(id) {
  if (!confirm('Cancelar esta solicitação? Se o estoque já tinha sido baixado (peça já enviada), ele será devolvido automaticamente.')) return;
  API.put('/movimentacoes/' + id + '/acao', { acao: 'CANCELAR', obs: '' })
    .then(() => {
      toast('Solicitação cancelada — estoque ajustado se necessário', 'info');
      loadAndRenderHistorico();
      loadAndRenderLogistica();
      loadAndRenderDashboard();
    })
    .catch(err => toast(err.message, 'error'));
}

function cancelarMovimentacaoGrupo(grupoId) {
  const itens = db.movimentacoes.filter(x => x.grupoId === grupoId);
  if (!itens.length) return;
  if (!confirm(`Cancelar esta solicitação em lote (${itens.length} itens)? O estoque já baixado (itens já enviados) será devolvido automaticamente.`)) return;
  Promise.all(itens.map(it => API.put('/movimentacoes/' + it.id + '/acao', { acao: 'CANCELAR', obs: '' })))
    .then(() => {
      toast('Solicitação em lote cancelada — estoque ajustado se necessário', 'info');
      loadAndRenderHistorico();
      loadAndRenderLogistica();
      loadAndRenderDashboard();
    })
    .catch(err => toast(err.message, 'error'));
}

function deleteMovimentacao(id) {
  if (!confirm('Excluir esta solicitação? Essa ação não pode ser desfeita.')) return;
  API.delete('/movimentacoes/' + id)
    .then(() => { toast('Solicitação excluída', 'info'); loadAndRenderHistorico(); })
    .catch(err => toast(err.message, 'error'));
}

function deleteMovimentacaoGrupo(grupoId) {
  const itens = db.movimentacoes.filter(x => x.grupoId === grupoId);
  if (!itens.length) return;
  if (!confirm(`Excluir esta solicitação em lote (${itens.length} itens)? Essa ação não pode ser desfeita.`)) return;
  Promise.all(itens.map(it => API.delete('/movimentacoes/' + it.id)))
    .then(() => { toast('Solicitação em lote excluída', 'info'); loadAndRenderHistorico(); })
    .catch(err => toast(err.message, 'error'));
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
function montarCardMov(m) {
  const ps    = PIPELINE_STATUS[m.status] || PIPELINE_STATUS.SOLICITADA;
  const isFin = m.status === 'FINALIZADO';

  // Botões de ação conforme status atual
  let acoes = '';
  if (m.status === 'SOLICITADA') {
    if(m.tipoAlocacao==='RETORNO'||m.tipo_alocacao==='RETORNO'){
      acoes = `<span style="font-size:11px;color:var(--red);font-style:italic">↩ Aguardando devolução pelo técnico</span>`;
    } else {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','ENVIAR')">✉ Enviar</button>`;
      if (!m.temEstoque) acoes += ` <button class="btn btn-ghost btn-sm" style="color:var(--accent)" onclick="abrirActionModal('${m.id}','COMPRA')">🛒 Compra</button>`;
    }
  } else if (m.status === 'ENVIADA' || m.status === 'COMPRA_PENDENTE') {
    acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','DESPACHAR')">📦 Despachar</button>`;
  } else if (m.status === 'DESPACHADA') {
    if(m.tipoAlocacao==='RETORNO'||m.tipo_alocacao==='RETORNO'){
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','RECEBER')">✓ Receber Devolução</button>`;
    } else {
      acoes = `<span style="font-size:11px;color:var(--text3);font-style:italic">⏳ Aguardando confirmação do técnico</span>`;
    }
  } else if (m.status === 'RECEBIDA') {
    if(m.tipoAlocacao==='RETORNO'||m.tipo_alocacao==='RETORNO'){
      acoes = `<button class="btn btn-success btn-sm" onclick="abrirActionModal('${m.id}','FINALIZAR')">✓ Finalizar Devolução</button>`;
    } else {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','ALOCAR')">⇢ Alocar</button>`;
    }
  } else if (m.status === 'ALOCADA') {
    acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal('${m.id}','EMITIR_NF')">📄 Emitir NF</button>`;
  } else if (m.status === 'NF_EMITIDA') {
    acoes = `<button class="btn btn-success btn-sm" onclick="abrirActionModal('${m.id}','FINALIZAR')">✓ Finalizar</button>`;
  }

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
        ${m.tipoAlocacao==='RETORNO'&&m.numSeqOrigem ? '#'+m.numSeqOrigem+'R' : '#'+(m.numSeq||'—')}
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
      ${!['FINALIZADO','CANCELADA'].includes(m.status) ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);font-size:10px" onclick="cancelarMovimentacao('${m.id}')">✕ Cancelar</button>` : ''}
      <button class="btn btn-danger btn-sm" onclick="deleteMovimentacao('${m.id}')" style="font-size:10px">X Excluir</button>
    </div>

  </div>`;
}

function montarCardGrupo(itensDoGrupo) {
  const ids = itensDoGrupo.map(x => x.id);
  const idsJs = "['" + ids.join("','") + "']"; // array literal JS seguro para embutir em onclick="..."
  const primeiro = itensDoGrupo[0];

  // Normalmente todos os itens do lote têm o mesmo status (progridem juntos).
  // Se algum já foi alterado individualmente e ficou diferente, avisa e pede
  // que a ação seja feita item a item nesse caso raro.
  const statusUnico = itensDoGrupo.every(x => x.status === primeiro.status);
  const statusRep = statusUnico ? primeiro.status : null;
  const ps = statusRep ? (PIPELINE_STATUS[statusRep] || PIPELINE_STATUS.SOLICITADA) : null;

  const seqs = itensDoGrupo.map(x => x.numSeq).filter(Boolean).sort((a,b)=>a-b);
  let numeroLabel = '#—';
  if (seqs.length) {
    const consecutivo = seqs.every((v,i) => i===0 || v === seqs[i-1]+1);
    numeroLabel = (consecutivo && seqs.length>1) ? `#${seqs[0]}-${seqs[seqs.length-1]}` : seqs.map(s=>'#'+s).join(', ');
  }
  const qtdTotal = itensDoGrupo.reduce((s,x)=>s+(parseFloat(x.qtd)||0), 0);

  let acoes = '';
  if (statusUnico) {
    if (statusRep === 'SOLICITADA') {
      if (primeiro.tipoAlocacao === 'RETORNO') {
        acoes = `<span style="font-size:11px;color:var(--red);font-style:italic">↩ Aguardando devolução pelo técnico</span>`;
      } else {
        acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal(${idsJs},'ENVIAR')">✉ Enviar</button>`;
        if (itensDoGrupo.some(x => !x.temEstoque)) {
          acoes += ` <button class="btn btn-ghost btn-sm" style="color:var(--accent)" onclick="abrirActionModal(${idsJs},'COMPRA')">🛒 Compra</button>`;
        }
      }
    } else if (statusRep === 'ENVIADA' || statusRep === 'COMPRA_PENDENTE') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal(${idsJs},'DESPACHAR')">📦 Despachar</button>`;
    } else if (statusRep === 'DESPACHADA') {
      acoes = primeiro.tipoAlocacao === 'RETORNO'
        ? `<button class="btn btn-primary btn-sm" onclick="abrirActionModal(${idsJs},'RECEBER')">✓ Receber Devolução</button>`
        : `<span style="font-size:11px;color:var(--text3);font-style:italic">⏳ Aguardando confirmação do técnico</span>`;
    } else if (statusRep === 'RECEBIDA') {
      acoes = primeiro.tipoAlocacao === 'RETORNO'
        ? `<button class="btn btn-success btn-sm" onclick="abrirActionModal(${idsJs},'FINALIZAR')">✓ Finalizar Devolução</button>`
        : `<button class="btn btn-primary btn-sm" onclick="abrirActionModal(${idsJs},'ALOCAR')">⇢ Alocar</button>`;
    } else if (statusRep === 'ALOCADA') {
      acoes = `<button class="btn btn-primary btn-sm" onclick="abrirActionModal(${idsJs},'EMITIR_NF')">📄 Emitir NF</button>`;
    } else if (statusRep === 'NF_EMITIDA') {
      acoes = `<button class="btn btn-success btn-sm" onclick="abrirActionModal(${idsJs},'FINALIZAR')">✓ Finalizar</button>`;
    }
  } else {
    acoes = `<span style="font-size:11px;color:var(--text3);font-style:italic">Itens em status diferentes — use a ação de cada linha</span>`;
  }

  const isFin = statusUnico && statusRep === 'FINALIZADO';

  const equipUnico = itensDoGrupo.every(x => x.equipSerie === primeiro.equipSerie);

  return `
  <div class="sol-card ${isFin?'finalizado':''}" style="flex-direction:column;align-items:stretch;gap:10px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent)">${numeroLabel}</span>
          ${ps ? `<span class="badge ${ps.badge}">${ps.label}</span>` : `<span class="badge badge-gray">STATUS MISTO</span>`}
          <span class="badge badge-gray" style="font-size:9px">📦 LOTE · ${itensDoGrupo.length} ITENS · ${qtdTotal} UNID.</span>
        </div>
        ${equipUnico && primeiro.equipSerie ? `<div style="font-size:12px;color:var(--text2)">S/N: <span style="font-family:var(--mono);color:var(--text)">${primeiro.equipSerie}</span>${primeiro.equipCliente ? ' · <span style="color:var(--text3)">'+primeiro.equipCliente+'</span>' : ''}</div>` : ''}
        ${!equipUnico ? `<div style="font-size:11px;color:var(--accent)">📍 ${new Set(itensDoGrupo.map(x=>x.equipSerie||'—')).size} equipamentos diferentes neste lote (veja a tabela abaixo)</div>` : ''}
        ${primeiro.tecnico ? `<div style="font-size:11px;color:var(--text3)">Solicitante: ${primeiro.tecnico}</div>` : ''}
        ${primeiro.obs ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;font-style:italic">"${primeiro.obs}"</div>` : ''}
        <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:4px">${formatDate(primeiro.eventos?.[0]?.data||0)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${acoes}
        ${!isFin && statusRep !== 'CANCELADA' ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);font-size:10px" onclick="cancelarMovimentacaoGrupo('${primeiro.grupoId}')">✕ Cancelar Lote</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteMovimentacaoGrupo('${primeiro.grupoId}')" style="font-size:10px">X Excluir Lote</button>
      </div>
    </div>
    <table class="data-table" style="margin-top:2px">
      <thead><tr><th>P/N</th><th>Peça</th><th>Qtd</th>${!equipUnico ? '<th>Equipamento</th>' : ''}<th>Status</th><th></th></tr></thead>
      <tbody>
      ${itensDoGrupo.map(it => {
        const psIt = PIPELINE_STATUS[it.status] || PIPELINE_STATUS.SOLICITADA;
        const equipCol = !equipUnico
          ? `<td style="font-size:11px">${it.equipSerie ? `<span style="font-family:var(--mono)">${it.equipSerie}</span>${it.equipCliente ? ' · '+it.equipCliente : ''}` : '<span style="color:var(--text3);font-style:italic">—</span>'}</td>`
          : '';
        return `<tr>
          <td class="mono" style="font-size:11px;color:var(--accent)">${it.pecaCodigo}</td>
          <td style="font-size:12px">${it.pecaNome}${!it.temEstoque ? ' <span class="badge badge-orange" style="font-size:9px">Sem Estoque</span>' : ''}</td>
          <td class="mono">${it.qtd} ${it.pecaUnidade}</td>
          ${equipCol}
          <td><span class="badge ${psIt.badge}" style="font-size:9px">${psIt.label}</span></td>
          <td style="text-align:right"><button class="btn btn-ghost btn-sm" onclick="verEventos('${it.id}')" style="font-size:9px" title="Histórico deste item">⊙</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>`;
}

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

  // Agrupa visualmente itens que vieram da mesma solicitação em lote (mesmo
  // grupo_id) num único card, com um só conjunto de ações para todo o lote.
  const gruposVistos = new Set();
  el.innerHTML = list.map(m => {
    if (m.grupoId) {
      if (gruposVistos.has(m.grupoId)) return ''; // já renderizado junto com o primeiro item do grupo
      const itensDoGrupo = list.filter(x => x.grupoId === m.grupoId);
      if (itensDoGrupo.length > 1) {
        gruposVistos.add(m.grupoId);
        return montarCardGrupo(itensDoGrupo);
      }
    }
    return montarCardMov(m);
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
let editandoItemOrcIdx = null;
let orcEquipamentos = [];
let editandoEquipOrcIdx = null;
let orcItensOpcionais = []; // preservados de orçamentos gerados via Kit Preventiva

const ORC_STATUS = {
  RASCUNHO:            { label:'Rascunho',                       badge:'badge-gray'   },
  ENVIADO:              { label:'Aguard. Aprov. Cliente',          badge:'badge-orange' },
  APROVADO_TECNICO:     { label:'Aprovado - Aguard. Tecnico',      badge:'badge-green'  },
  APROVADO_PECA:        { label:'Aprovado - Aguard. Peca',         badge:'badge-green'  },
  APROVADO_PAGAMENTO:   { label:'Aprovado - Aguard. Pagamento',    badge:'badge-green'  },
  A_FATURAR:            { label:'A Faturar',                       badge:'badge-orange' },
  FATURADO:             { label:'Faturado',                        badge:'badge-blue'   },
  CANCELADO:            { label:'Cancelado',                       badge:'badge-red'    },
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
  el.innerHTML = `<table class="data-table compact">
    <thead><tr>
      <th>Nº</th><th>Status</th><th>Dias</th><th>Cliente</th><th>S/N</th>
      <th>OS</th><th>Itens</th><th>Total</th><th>Data</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(o => {
      const st = ORC_STATUS[o.status] || ORC_STATUS.RASCUNHO;
      return `<tr>
        <td><strong style="font-family:var(--mono)">${o.numero}</strong></td>
        <td><span class="badge ${st.badge}">${st.label}</span></td>
        <td class="mono" style="font-size:11px">${(function(){ var base = o.status_changed_at || o.created_at || Date.now(); var dias = Math.floor((Date.now() - base) / 86400000); return dias + 'd'; })()}</td>
        <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.cliente||'—'}</td>
        <td class="mono">${(o.equipamentos&&o.equipamentos.length)?(o.equipamentos[0].serie||'—')+(o.equipamentos.length>1?' +'+(o.equipamentos.length-1):''):(o.equip_serie||'—')}</td>
        <td class="mono">${o.os||'—'}</td>
        <td class="mono">${(o.itens||[]).length}</td>
        <td class="mono" style="color:var(--accent);font-weight:700">R$ ${parseFloat(o.total||0).toFixed(2)}</td>
        <td class="mono">${o.data||'—'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="abrirModalOrcamento('${o.id}')" title="Editar">✎</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirMenuStatusOrc(event,'${o.id}')" title="Status">▾</button>
          <button class="btn btn-sm" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3)" onclick="gerarPDFOrcamento('${o.id}')" title="Gerar PDF">⬇</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrcamento('${o.id}')" title="Excluir">✕</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

// ── CNPJ do cliente (autopreenchimento com memória por nome) ──
let _cnpjEditadoManualmente = false;

function onClienteOrcMudou() {
  // Nome do cliente mudou: o CNPJ que estava lá pode não valer mais,
  // libera a busca automática de novo.
  _cnpjEditadoManualmente = false;
  const statusEl = document.getElementById('orc-cnpj-status');
  if (statusEl) statusEl.textContent = '';
}

function onCnpjOrcEditadoManualmente() {
  _cnpjEditadoManualmente = true;
  const statusEl = document.getElementById('orc-cnpj-status');
  if (statusEl) statusEl.textContent = '';
}

function buscarCnpjCliente() {
  const nome = document.getElementById('orc-cliente')?.value.trim();
  const cnpjEl = document.getElementById('orc-cnpj');
  const statusEl = document.getElementById('orc-cnpj-status');
  if (!nome || !cnpjEl) return;
  if (_cnpjEditadoManualmente && cnpjEl.value.trim()) return; // não sobrescreve o que o usuário já digitou
  API.get('/clientes/cnpj?nome=' + encodeURIComponent(nome)).then(res => {
    if (res && res.cnpj) {
      cnpjEl.value = res.cnpj;
      if (statusEl) { statusEl.textContent = '✓ encontrado'; statusEl.style.color = 'var(--green)'; }
    } else if (statusEl) {
      statusEl.textContent = cnpjEl.value.trim() ? '' : 'cliente novo — digite o CNPJ';
      statusEl.style.color = 'var(--text3)';
    }
  }).catch(() => {});
}

// ============================================================
//  KITS PREVENTIVAS
// ============================================================
let editKitId = null;
let kitItens = [];
let editandoItemKitIdx = null;
let kitItensOpcionais = [];
let editandoItemKitOpcionalIdx = null;

function calcularTotaisKit(itens, taxa, dolar, markup) {
  taxa = parseFloat(taxa) || 2; dolar = parseFloat(dolar) || 5.27; markup = parseFloat(markup) || 2;
  let custo = 0, venda = 0;
  (itens || []).forEach(it => {
    const qtd = parseFloat(it.qtd) || 0;
    let custoUnit = parseFloat(it.custo_rs) || 0;
    if (!custoUnit && it.custo_usd) custoUnit = parseFloat(it.custo_usd) * taxa * dolar;
    custo += custoUnit * qtd;
    venda += custoUnit * qtd * markup;
  });
  return { custo, venda };
}

let kitsExpandidos = new Set();

function toggleKitExpandido(id) {
  if (kitsExpandidos.has(id)) kitsExpandidos.delete(id);
  else kitsExpandidos.add(id);
  renderKitsPreventivas();
}

function renderKitsPreventivas(q = '') {
  const el = document.getElementById('kits-preventivas-table');
  if (!el) return;
  const ql = (q || document.querySelector('#page-kits-preventivas .search-input')?.value || '').toLowerCase().trim();
  const fonteFiltro = document.getElementById('kits-filter-fonte')?.value || '';
  let list = [...(db.kitsPreventivas || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  if (fonteFiltro) list = list.filter(k => String(k.fonte || '') === fonteFiltro);
  if (ql) {
    list = list.filter(k =>
      String(k.nome || '').toLowerCase().includes(ql) ||
      String(k.fonte || '').toLowerCase().includes(ql) ||
      String(k.linha || '').toLowerCase().includes(ql)
    );
  }

  const badgeEl = document.getElementById('badge-kits-preventivas');
  if (badgeEl) badgeEl.textContent = (db.kitsPreventivas || []).length || '';

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🛠</div>
      <div class="empty-title">Nenhum Kit Preventiva</div>
      <div class="empty-sub">Cadastre o primeiro kit</div></div>`;
    return;
  }

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Código</th><th>Nome</th><th>Fonte</th><th>Linha</th><th>Itens</th><th>Custo Total</th><th>Valor Venda Total</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(k => {
      const totais = calcularTotaisKit(k.itens || [], k.taxa, k.dolar, k.markup);
      const totaisOpc = calcularTotaisKit(k.itens_opcionais || [], k.taxa, k.dolar, k.markup);
      const aberto = kitsExpandidos.has(k.id);
      const linhaPrincipal = `<tr>
        <td class="mono" style="font-size:11px;color:var(--accent);font-weight:700">${k.codigo || '—'}</td>
        <td>
          <span onclick="toggleKitExpandido('${k.id}')" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none">
            <span style="color:var(--accent);font-size:10px;transition:transform 0.15s;display:inline-block;transform:rotate(${aberto ? '90deg' : '0deg'})">▶</span>
            <strong style="font-size:13px">${k.nome}</strong>
          </span>
        </td>
        <td style="font-size:12px">${k.fonte || '—'}</td>
        <td class="mono" style="font-size:11px;color:var(--text3)">${k.linha || '—'}</td>
        <td class="mono">${(k.itens || []).length}</td>
        <td class="mono" style="color:var(--accent);font-weight:700">R$ ${totais.custo.toFixed(2)}</td>
        <td class="mono" style="color:var(--green);font-weight:700">R$ ${totais.venda.toFixed(2)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm" style="background:rgba(212,140,50,0.15);color:var(--accent);border:1px solid rgba(212,140,50,0.3)" onclick="abrirModalGerarOrcamentoKit('${k.id}')">📄 Gerar Orçamento</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirModalKitPreventiva('${k.id}')">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKitPreventiva('${k.id}')">✕</button>
        </td>
      </tr>`;

      const linhaExpandida = aberto ? `<tr>
        <td colspan="8" style="padding:0;background:var(--surface2)">
          <div style="padding:12px 16px 16px 34px">
            ${k.obs ? `<div style="font-size:11px;color:var(--text3);font-style:italic;margin-bottom:10px">"${k.obs}"</div>` : ''}
            ${(k.itens || []).length ? `<table class="data-table" style="margin:0">
              <thead><tr><th>Código</th><th>Fornecedor</th><th>Descrição</th><th>Qtd</th><th>Custo Unit. R$</th><th>Total R$</th></tr></thead>
              <tbody>
              ${(k.itens || []).map(it => {
                let custoUnit = parseFloat(it.custo_rs) || 0;
                if (!custoUnit && it.custo_usd) custoUnit = parseFloat(it.custo_usd) * (parseFloat(k.taxa) || 2) * (parseFloat(k.dolar) || 5.27);
                const totalItem = custoUnit * (parseFloat(it.qtd) || 0) * (parseFloat(k.markup) || 2);
                return `<tr>
                  <td class="mono" style="font-size:11px;color:var(--accent)">${it.codigo || '—'}</td>
                  <td style="font-size:11px;color:var(--text3)">${it.fornecedor || '—'}</td>
                  <td style="font-size:12px">${it.desc}</td>
                  <td class="mono">${it.qtd}</td>
                  <td class="mono">R$ ${custoUnit.toFixed(2)}</td>
                  <td class="mono" style="color:var(--green);font-weight:700">R$ ${totalItem.toFixed(2)}</td>
                </tr>`;
              }).join('')}
              </tbody>
            </table>
            <div style="text-align:right;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
              <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">CUSTO TOTAL: </span>
              <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent)">R$ ${totais.custo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
              <span style="margin:0 10px;color:var(--border2)">|</span>
              <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">VALOR VENDA TOTAL: </span>
              <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--green)">R$ ${totais.venda.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>
            ${(k.itens_opcionais || []).length ? `
            <div style="font-family:var(--mono);font-size:10px;color:var(--accent);letter-spacing:1px;margin:18px 0 8px">ITENS OPCIONAIS</div>
            <table class="data-table" style="margin:0">
              <thead><tr><th>Código</th><th>Fornecedor</th><th>Descrição</th><th>Qtd</th><th>Custo Unit. R$</th><th>Total R$</th></tr></thead>
              <tbody>
              ${(k.itens_opcionais || []).map(it => {
                let custoUnit = parseFloat(it.custo_rs) || 0;
                if (!custoUnit && it.custo_usd) custoUnit = parseFloat(it.custo_usd) * (parseFloat(k.taxa) || 2) * (parseFloat(k.dolar) || 5.27);
                const totalItem = custoUnit * (parseFloat(it.qtd) || 0) * (parseFloat(k.markup) || 2);
                return `<tr>
                  <td class="mono" style="font-size:11px;color:var(--accent)">${it.codigo || '—'}</td>
                  <td style="font-size:11px;color:var(--text3)">${it.fornecedor || '—'}</td>
                  <td style="font-size:12px">${it.desc}</td>
                  <td class="mono">${it.qtd}</td>
                  <td class="mono">R$ ${custoUnit.toFixed(2)}</td>
                  <td class="mono" style="color:var(--green);font-weight:700">R$ ${totalItem.toFixed(2)}</td>
                </tr>`;
              }).join('')}
              </tbody>
            </table>
            <div style="text-align:right;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
              <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">CUSTO TOTAL OPCIONAIS: </span>
              <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent)">R$ ${totaisOpc.custo.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
              <span style="margin:0 10px;color:var(--border2)">|</span>
              <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">VALOR VENDA TOTAL OPCIONAIS: </span>
              <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--green)">R$ ${totaisOpc.venda.toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>
            </div>` : ''}` : `<div style="font-size:12px;color:var(--text3);font-style:italic">Nenhum item cadastrado</div>`}
          </div>
        </td>
      </tr>` : '';

      return linhaPrincipal + linhaExpandida;
    }).join('')}
    </tbody></table>`;
}

function abrirModalKitPreventiva(id) {
  editKitId = id || null;
  const k = id ? (db.kitsPreventivas || []).find(x => x.id === id) : null;
  kitItens = k ? JSON.parse(JSON.stringify(k.itens || [])) : [];
  editandoItemKitIdx = null;
  kitItensOpcionais = k ? JSON.parse(JSON.stringify(k.itens_opcionais || [])) : [];
  editandoItemKitOpcionalIdx = null;

  document.getElementById('modal-kit-title').textContent = k ? 'Editar Kit Preventiva' : 'Novo Kit Preventiva';
  document.getElementById('kit-codigo').value = k?.codigo || '';
  document.getElementById('kit-nome').value = k?.nome || '';
  document.getElementById('kit-fonte').value = k?.fonte || '';
  document.getElementById('kit-linha').value = k?.linha || '';
  document.getElementById('kit-taxa').value = k?.taxa || 2;
  document.getElementById('kit-dolar').value = k?.dolar || 5.27;
  document.getElementById('kit-markup').value = k?.markup || 2;
  document.getElementById('kit-obs').value = k?.obs || '';

  ['kit-item-codigo', 'kit-item-fornecedor', 'kit-item-desc', 'kit-item-custo-usd', 'kit-item-custo-rs'].forEach(id2 => {
    const el = document.getElementById(id2); if (el) el.value = '';
  });
  const qtdEl = document.getElementById('kit-item-qtd'); if (qtdEl) qtdEl.value = '1';
  const btnAdd = document.getElementById('kit-add-item-btn'); if (btnAdd) btnAdd.textContent = '⊕ Add';

  ['kit-opc-codigo', 'kit-opc-fornecedor', 'kit-opc-desc', 'kit-opc-custo-usd', 'kit-opc-custo-rs'].forEach(id2 => {
    const el = document.getElementById(id2); if (el) el.value = '';
  });
  const qtdOpcEl = document.getElementById('kit-opc-qtd'); if (qtdOpcEl) qtdOpcEl.value = '1';
  const btnAddOpc = document.getElementById('kit-add-opc-btn'); if (btnAddOpc) btnAddOpc.textContent = '⊕ Add';

  renderItensKit();
  renderItensKitOpcionais();
  document.getElementById('modal-kit-preventiva').style.display = 'flex';
}

function fecharModalKitPreventiva() {
  document.getElementById('modal-kit-preventiva').style.display = 'none';
  editKitId = null; kitItens = []; editandoItemKitIdx = null;
  kitItensOpcionais = []; editandoItemKitOpcionalIdx = null;
}

function sugerirPecaKit(q, prefixo) {
  const ddId = prefixo + '-peca-dropdown';
  const dd = document.getElementById(ddId);
  if (!dd) return;
  const ql = (q || '').toLowerCase().trim();
  const list = db.pecas.filter(p =>
    !ql ||
    String(p.codigo || '').toLowerCase().includes(ql) ||
    String(p.nome || '').toLowerCase().includes(ql) ||
    String(p.fonte || '').toLowerCase().includes(ql)
  ).slice(0, 30);

  dd.style.display = list.length ? 'block' : 'none';
  dd.innerHTML = list.map(p => {
    const custo = p.custo || 0;
    const img = p.imagem
      ? `<img src="${p.imagem}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0">`
      : `<div style="width:28px;height:28px;background:var(--surface2);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px">⬡</div>`;
    return `<div onmousedown="selecionarPecaKit('${p.id}','${prefixo}')"
      style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--border)"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${img}
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${p.codigo}</div>
        <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nome}</div>
        <div style="font-size:9px;color:var(--text3)">${p.fonte || ''}</div>
      </div>
      <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">R$ ${custo.toFixed(2)}</div>
    </div>`;
  }).join('');
}

function selecionarPecaKit(pecaId, prefixo) {
  const p = db.pecas.find(x => x.id === pecaId);
  if (!p) return;
  document.getElementById(prefixo + '-peca-dropdown').style.display = 'none';
  document.getElementById(prefixo + '-codigo').value = p.codigo || '';
  document.getElementById(prefixo + '-fornecedor').value = p.fonte || '';
  document.getElementById(prefixo + '-desc').value = p.nome || '';
  document.getElementById(prefixo + '-custo-rs').value = (p.custo || 0).toFixed(2);
  document.getElementById(prefixo + '-custo-usd').value = '';
}

function fecharDropdownPecaKit(prefixo) {
  const dd = document.getElementById(prefixo + '-peca-dropdown');
  if (dd) dd.style.display = 'none';
}

function adicionarItemKit() {
  const codigo = document.getElementById('kit-item-codigo').value.trim();
  const fornecedor = document.getElementById('kit-item-fornecedor').value.trim();
  const desc = document.getElementById('kit-item-desc').value.trim();
  const qtd = parseInt(document.getElementById('kit-item-qtd').value) || 1;
  const custoUsd = parseFloat(document.getElementById('kit-item-custo-usd').value) || 0;
  const custoRs = parseFloat(document.getElementById('kit-item-custo-rs').value) || 0;
  if (!desc) { toast('Informe a descrição do item', 'error'); return; }

  const item = { codigo, fornecedor, desc, qtd, custo_usd: custoUsd, custo_rs: custoRs };
  if (editandoItemKitIdx !== null) {
    kitItens[editandoItemKitIdx] = item;
    editandoItemKitIdx = null;
    const btn = document.getElementById('kit-add-item-btn'); if (btn) btn.textContent = '⊕ Add';
  } else {
    kitItens.push(item);
  }

  ['kit-item-codigo', 'kit-item-fornecedor', 'kit-item-desc', 'kit-item-custo-usd', 'kit-item-custo-rs'].forEach(id2 => {
    const el = document.getElementById(id2); if (el) el.value = '';
  });
  document.getElementById('kit-item-qtd').value = '1';
  renderItensKit();
}

function editarItemKit(idx) {
  const it = kitItens[idx]; if (!it) return;
  editandoItemKitIdx = idx;
  document.getElementById('kit-item-codigo').value = it.codigo || '';
  document.getElementById('kit-item-fornecedor').value = it.fornecedor || '';
  document.getElementById('kit-item-desc').value = it.desc || '';
  document.getElementById('kit-item-qtd').value = it.qtd || 1;
  document.getElementById('kit-item-custo-usd').value = it.custo_usd || '';
  document.getElementById('kit-item-custo-rs').value = it.custo_rs || '';
  const btn = document.getElementById('kit-add-item-btn'); if (btn) btn.textContent = 'Salvar edição';
}

function removerItemKit(idx) {
  kitItens.splice(idx, 1);
  editandoItemKitIdx = null;
  renderItensKit();
}

function renderItensKit() {
  const el = document.getElementById('kit-itens-lista');
  if (!el) return;
  const taxa = parseFloat(document.getElementById('kit-taxa')?.value) || 2;
  const dolar = parseFloat(document.getElementById('kit-dolar')?.value) || 5.27;
  const markup = parseFloat(document.getElementById('kit-markup')?.value) || 2;

  if (!kitItens.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);font-style:italic">Nenhum item adicionado</div>`;
  } else {
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Código</th><th>Fornecedor</th><th>Descrição</th><th>Qtd</th><th>Custo Unit. R$</th><th>Total R$</th><th></th></tr></thead>
      <tbody>${kitItens.map((it, i) => {
        let custoUnit = parseFloat(it.custo_rs) || 0;
        if (!custoUnit && it.custo_usd) custoUnit = parseFloat(it.custo_usd) * taxa * dolar;
        const total = custoUnit * (it.qtd || 0) * markup;
        return `<tr>
          <td class="mono" style="font-size:11px;color:var(--accent)">${it.codigo || '—'}</td>
          <td style="font-size:11px;color:var(--text3)">${it.fornecedor || '—'}</td>
          <td style="font-size:12px">${it.desc}</td>
          <td class="mono">${it.qtd}</td>
          <td class="mono">R$ ${custoUnit.toFixed(2)}</td>
          <td class="mono" style="color:var(--green);font-weight:700">R$ ${total.toFixed(2)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editarItemKit(${i})">✎</button>
            <button class="btn btn-danger btn-sm" onclick="removerItemKit(${i})">✕</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  const totais = calcularTotaisKit(kitItens, taxa, dolar, markup);
  const custoEl = document.getElementById('kit-custo-total-display');
  const vendaEl = document.getElementById('kit-venda-total-display');
  if (custoEl) custoEl.textContent = `R$ ${totais.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (vendaEl) vendaEl.textContent = `R$ ${totais.venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ── Itens Opcionais (mesma mecânica dos itens padrão, lista/total à parte) ──
function adicionarItemKitOpcional() {
  const codigo = document.getElementById('kit-opc-codigo').value.trim();
  const fornecedor = document.getElementById('kit-opc-fornecedor').value.trim();
  const desc = document.getElementById('kit-opc-desc').value.trim();
  const qtd = parseInt(document.getElementById('kit-opc-qtd').value) || 1;
  const custoUsd = parseFloat(document.getElementById('kit-opc-custo-usd').value) || 0;
  const custoRs = parseFloat(document.getElementById('kit-opc-custo-rs').value) || 0;
  if (!desc) { toast('Informe a descrição do item opcional', 'error'); return; }

  const item = { codigo, fornecedor, desc, qtd, custo_usd: custoUsd, custo_rs: custoRs };
  if (editandoItemKitOpcionalIdx !== null) {
    kitItensOpcionais[editandoItemKitOpcionalIdx] = item;
    editandoItemKitOpcionalIdx = null;
    const btn = document.getElementById('kit-add-opc-btn'); if (btn) btn.textContent = '⊕ Add';
  } else {
    kitItensOpcionais.push(item);
  }

  ['kit-opc-codigo', 'kit-opc-fornecedor', 'kit-opc-desc', 'kit-opc-custo-usd', 'kit-opc-custo-rs'].forEach(id2 => {
    const el = document.getElementById(id2); if (el) el.value = '';
  });
  document.getElementById('kit-opc-qtd').value = '1';
  renderItensKitOpcionais();
}

function editarItemKitOpcional(idx) {
  const it = kitItensOpcionais[idx]; if (!it) return;
  editandoItemKitOpcionalIdx = idx;
  document.getElementById('kit-opc-codigo').value = it.codigo || '';
  document.getElementById('kit-opc-fornecedor').value = it.fornecedor || '';
  document.getElementById('kit-opc-desc').value = it.desc || '';
  document.getElementById('kit-opc-qtd').value = it.qtd || 1;
  document.getElementById('kit-opc-custo-usd').value = it.custo_usd || '';
  document.getElementById('kit-opc-custo-rs').value = it.custo_rs || '';
  const btn = document.getElementById('kit-add-opc-btn'); if (btn) btn.textContent = 'Salvar edição';
}

function removerItemKitOpcional(idx) {
  kitItensOpcionais.splice(idx, 1);
  editandoItemKitOpcionalIdx = null;
  renderItensKitOpcionais();
}

function renderItensKitOpcionais() {
  const el = document.getElementById('kit-itens-opcionais-lista');
  if (!el) return;
  const taxa = parseFloat(document.getElementById('kit-taxa')?.value) || 2;
  const dolar = parseFloat(document.getElementById('kit-dolar')?.value) || 5.27;
  const markup = parseFloat(document.getElementById('kit-markup')?.value) || 2;

  if (!kitItensOpcionais.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);font-style:italic">Nenhum item opcional adicionado</div>`;
  } else {
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>Código</th><th>Fornecedor</th><th>Descrição</th><th>Qtd</th><th>Custo Unit. R$</th><th>Total R$</th><th></th></tr></thead>
      <tbody>${kitItensOpcionais.map((it, i) => {
        let custoUnit = parseFloat(it.custo_rs) || 0;
        if (!custoUnit && it.custo_usd) custoUnit = parseFloat(it.custo_usd) * taxa * dolar;
        const total = custoUnit * (it.qtd || 0) * markup;
        return `<tr>
          <td class="mono" style="font-size:11px;color:var(--accent)">${it.codigo || '—'}</td>
          <td style="font-size:11px;color:var(--text3)">${it.fornecedor || '—'}</td>
          <td style="font-size:12px">${it.desc}</td>
          <td class="mono">${it.qtd}</td>
          <td class="mono">R$ ${custoUnit.toFixed(2)}</td>
          <td class="mono" style="color:var(--green);font-weight:700">R$ ${total.toFixed(2)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editarItemKitOpcional(${i})">✎</button>
            <button class="btn btn-danger btn-sm" onclick="removerItemKitOpcional(${i})">✕</button>
          </td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  const totaisOpc = calcularTotaisKit(kitItensOpcionais, taxa, dolar, markup);
  const custoOpcEl = document.getElementById('kit-opc-custo-total-display');
  const vendaOpcEl = document.getElementById('kit-opc-venda-total-display');
  if (custoOpcEl) custoOpcEl.textContent = `R$ ${totaisOpc.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (vendaOpcEl) vendaOpcEl.textContent = `R$ ${totaisOpc.venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function salvarKitPreventiva() {
  const codigo = document.getElementById('kit-codigo').value.trim();
  const nome = document.getElementById('kit-nome').value.trim();
  if (!codigo) { toast('Informe o código do kit', 'error'); return; }
  if (!nome) { toast('Informe o nome do kit', 'error'); return; }
  if (!kitItens.length) { toast('Adicione ao menos um item', 'error'); return; }

  const data = {
    codigo,
    nome,
    fonte:  document.getElementById('kit-fonte').value.trim(),
    linha:  document.getElementById('kit-linha').value.trim(),
    taxa:   parseFloat(document.getElementById('kit-taxa').value) || 2,
    dolar:  parseFloat(document.getElementById('kit-dolar').value) || 5.27,
    markup: parseFloat(document.getElementById('kit-markup').value) || 2,
    obs:    document.getElementById('kit-obs').value.trim(),
    itens:  [...kitItens],
    itens_opcionais: [...kitItensOpcionais],
  };

  const fn = editKitId ? API.put('/kits-preventivas/' + editKitId, data) : API.post('/kits-preventivas', data);
  fn.then(() => {
    toast('Kit preventiva salvo');
    fecharModalKitPreventiva();
    loadAndRenderKitsPreventivas();
  }).catch(err => toast(err.message, 'error'));
}

function deleteKitPreventiva(id) {
  if (!confirm('Excluir este kit preventiva?')) return;
  API.delete('/kits-preventivas/' + id)
    .then(() => { toast('Kit excluído', 'info'); loadAndRenderKitsPreventivas(); })
    .catch(err => toast(err.message, 'error'));
}

async function loadAndRenderKitsPreventivas(q = '') {
  setSyncing(true);
  try {
    const qs = q ? '?q=' + encodeURIComponent(q) : '';
    db.kitsPreventivas = await API.get('/kits-preventivas' + qs);
    if (!q) popularFiltroFonteKits(); // só repopula com a lista completa (sem busca ativa)
    renderKitsPreventivas(q);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    setSyncing(false);
  }
}

function popularFiltroFonteKits() {
  const sel = document.getElementById('kits-filter-fonte');
  if (!sel) return;
  const valorAtual = sel.value;
  const fontes = [...new Set((db.kitsPreventivas || []).map(k => (k.fonte || '').trim()).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas as fontes</option>' +
    fontes.map(f => `<option value="${f}">${f}</option>`).join('');
  if (fontes.includes(valorAtual)) sel.value = valorAtual;
}

// ── Gerar Orçamento a partir de um Kit Preventiva (PDF exclusivo, itens
// opcionais aparecem numa seção separada com total próprio) ──
function abrirModalGerarOrcamentoKit(kitId) {
  const k = (db.kitsPreventivas || []).find(x => x.id === kitId);
  if (!k) return;

  let overlay = document.getElementById('modal-gerar-orc-kit-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-gerar-orc-kit-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);max-width:440px;width:95%">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
        <span style="font-weight:700;font-size:15px">Gerar Orçamento — ${k.nome}</span>
        <button onclick="document.getElementById('modal-gerar-orc-kit-overlay').remove()"
          style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="padding:20px">
        <div class="form-group">
          <label class="form-label">Nº do Orçamento</label>
          <input class="form-input" id="orckit-numero" placeholder="Ex: 1050">
        </div>
        <div class="form-group">
          <label class="form-label">Cliente</label>
          <input class="form-input" id="orckit-cliente" placeholder="Nome do cliente">
        </div>
        <div class="form-group">
          <label class="form-label">Nº de Série do Equipamento</label>
          <input class="form-input" id="orckit-serie" placeholder="Opcional">
        </div>
        <div class="form-group">
          <label class="form-label">OS</label>
          <input class="form-input" id="orckit-os" placeholder="Opcional">
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input class="form-input" type="date" id="orckit-data" value="${hoje}">
        </div>
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-gerar-orc-kit-overlay').remove()">Cancelar</button>
        <button class="btn btn-primary" onclick="criarOrcamentoDeKit('${kitId}')">✓ Gerar Orçamento</button>
      </div>
    </div>`;
}

function criarOrcamentoDeKit(kitId) {
  const k = (db.kitsPreventivas || []).find(x => x.id === kitId);
  if (!k) return;

  const cliente = document.getElementById('orckit-cliente')?.value.trim() || '';
  const serie   = document.getElementById('orckit-serie')?.value.trim() || '';
  const os      = document.getElementById('orckit-os')?.value.trim() || '';
  const data    = document.getElementById('orckit-data')?.value || new Date().toISOString().slice(0, 10);
  let numero    = document.getElementById('orckit-numero')?.value.trim() || '';

  const taxa = parseFloat(k.taxa) || 2, dolar = parseFloat(k.dolar) || 5.27, markup = parseFloat(k.markup) || 2;
  const custoUnitDe = it => {
    let c = parseFloat(it.custo_rs) || 0;
    if (!c && it.custo_usd) c = parseFloat(it.custo_usd) * taxa * dolar;
    return c;
  };
  const mapItem = it => ({
    cod: it.codigo || '', desc: it.desc, qtd: it.qtd || 1,
    valor: parseFloat((custoUnitDe(it) * markup).toFixed(2)),
  });

  const itens = (k.itens || []).map(mapItem);
  const itensOpcionais = (k.itens_opcionais || []).map(mapItem);
  const total = itens.reduce((s, it) => s + it.qtd * it.valor, 0);

  // Busca a lista atual de orçamentos pra pegar o próximo número certo
  // (mesma sequência usada na tela de Orçamentos), mesmo que essa lista
  // ainda não tenha sido carregada nesta sessão.
  API.get('/orcamentos').then(lista => {
    db.orcamentos = lista;
    if (!numero) {
      const nums = lista.map(x => parseInt(x.numero) || 0).filter(n => n > 900);
      numero = String(nums.length ? Math.max(...nums) + 1 : 979);
    }

    const cfg = db.configOrcamento || {};
    const payload = {
      numero, status: 'RASCUNHO', cliente,
      equip_serie: serie, equip_nome: k.nome,
      equipamentos: serie || k.nome ? [{ serie, nome: k.nome }] : [],
      os, data, obs: `Gerado a partir do Kit Preventiva ${k.codigo || ''} — ${k.nome}`.trim(),
      validade: cfg.validade || '7 dias',
      pagamento: cfg.formaPagamento || '30 dias',
      entrega: cfg.prazoEntrega || 'A combinar',
      frete: cfg.frete || 'FOB',
      condicoes: cfg.condicoesGerais || '',
      total, itens, itens_opcionais: itensOpcionais,
    };

    return API.post('/orcamentos', payload);
  }).then(res => {
    document.getElementById('modal-gerar-orc-kit-overlay')?.remove();
    toast(`Orçamento Nº ${numero} criado a partir do kit`, 'success');
    // Recarrega a lista e já abre o PDF do orçamento recém-criado
    API.get('/orcamentos').then(lista => {
      db.orcamentos = lista;
      updateBadges();
      gerarPDFOrcamento(res.id);
    });
  }).catch(err => toast(err.message, 'error'));
}


function atualizarVisibilidadeTipoNF() {
  const status = document.getElementById('orc-status')?.value;
  const wrap = document.getElementById('orc-tipo-nf-wrap');
  if (wrap) wrap.style.display = (status === 'A_FATURAR' || status === 'FATURADO') ? '' : 'none';
}

function abrirModalOrcamento(id) {
  editOrcId = id || null;
  const o   = id ? db.orcamentos.find(x=>x.id===id) : null;
  const cfg = db.configOrcamento || {};
  orcItens  = o ? JSON.parse(JSON.stringify(o.itens||[])) : [];
  orcItensOpcionais = o ? JSON.parse(JSON.stringify(o.itens_opcionais||[])) : [];

  document.getElementById('modal-orcamento-title').textContent = o ? 'Editar Orçamento' : 'Novo Orçamento';
  if(!o){const nums=db.orcamentos.map(x=>parseInt(x.numero)||0).filter(n=>n>900);const next=nums.length?Math.max(...nums)+1:979;document.getElementById('orc-numero').value=String(next);}else{document.getElementById('orc-numero').value=o.numero;}
  document.getElementById('orc-status').value      = o?.status     || 'RASCUNHO';
  document.getElementById('orc-tipo-nf').value      = o?.tipo_nf   || '';
  atualizarVisibilidadeTipoNF();
  document.getElementById('orc-cliente').value     = o?.cliente    || '';
  document.getElementById('orc-cnpj').value        = o?.cnpj       || '';
  _cnpjEditadoManualmente = !!(o?.cnpj);
  const cnpjStatusEl0 = document.getElementById('orc-cnpj-status');
  if (cnpjStatusEl0) cnpjStatusEl0.textContent = '';
  if (!o?.cnpj && o?.cliente) buscarCnpjCliente();
  orcEquipamentos = o ? (Array.isArray(o.equipamentos) && o.equipamentos.length ? JSON.parse(JSON.stringify(o.equipamentos)) : (o.equip_serie || o.equip_nome ? [{ serie: o.equip_serie||'', nome: o.equip_nome||'' }] : [])) : [];
  editandoEquipOrcIdx = null;
  document.getElementById('orc-serie').value       = '';
  document.getElementById('orc-equip-nome').value  = '';
  const btnEq = document.getElementById('orc-add-equip-btn'); if (btnEq) btnEq.textContent = '+ Adicionar Equipamento a Lista';
  renderEquipamentosOrc();
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
  setOrcSelect('orc-validade',  o?.validade,  cfg.validade       || '7 dias');
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
  editOrcId = null; orcItens = []; orcEquipamentos = []; editandoEquipOrcIdx = null;
}

function resetarCondicoesOrc() {
  const validade  = document.getElementById('orc-validade')?.value  || '7 dias';
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

  const kits = (db.kitsPreventivas || []).filter(k =>
    !ql ||
    String(k.codigo||'').toLowerCase().includes(ql) ||
    String(k.nome||'').toLowerCase().includes(ql)
  ).slice(0, 10);

  const list = db.pecas.filter(p =>
    !ql ||
    String(p.codigo||'').toLowerCase().includes(ql) ||
    String(p.nome||'').toLowerCase().includes(ql) ||
    String(p.fonte||'').toLowerCase().includes(ql)
  ).slice(0, 50);

  dd.style.display = (list.length || kits.length) ? 'block' : 'none';

  const kitsHtml = kits.map(k => {
    const totais = calcularTotaisKit(k.itens||[], k.taxa, k.dolar, k.markup);
    return `<div onmousedown="selecionarKitOrc(\'${k.id}\')"
      style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;border-bottom:1px solid var(--border);background:rgba(212,140,50,0.05)"
      onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'rgba(212,140,50,0.05)\'">
      <div style="width:30px;height:30px;background:var(--surface);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px">🛠</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${k.codigo || '—'}
          <span style="background:var(--accent);color:var(--bg);font-size:8px;padding:1px 5px;border-radius:3px;margin-left:4px;letter-spacing:0.5px">KIT · ${(k.itens||[]).length} ITENS</span>
        </div>
        <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${k.nome}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:9px;color:var(--text3)">V.Venda Total</div>
        <div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--green)">R$ ${totais.venda.toFixed(2)}</div>
      </div>
    </div>`;
  }).join('');

  const pecasHtml = list.map(p => {
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

  dd.innerHTML = kitsHtml + pecasHtml;
}

function selecionarKitOrc(kitId) {
  const k = (db.kitsPreventivas || []).find(x => x.id === kitId);
  if (!k) return;
  document.getElementById('orc-peca-dropdown').style.display = 'none';

  const taxa = parseFloat(k.taxa) || 2;
  const dolar = parseFloat(k.dolar) || 5.27;
  const markup = parseFloat(k.markup) || 2;

  (k.itens || []).forEach(it => {
    let custoUnit = parseFloat(it.custo_rs) || 0;
    if (!custoUnit && it.custo_usd) custoUnit = parseFloat(it.custo_usd) * taxa * dolar;
    const valorVendaUnit = custoUnit * markup;
    orcItens.push({
      cod: it.codigo || '',
      desc: it.desc,
      qtd: it.qtd || 1,
      valor: parseFloat(valorVendaUnit.toFixed(2)),
      custoUnit: custoUnit,
    });
  });

  renderItensOrc();
  ['orc-item-cod','orc-item-desc','orc-item-valor'].forEach(fid => {
    const el = document.getElementById(fid); if (el) el.value = '';
  });
  const qtdEl = document.getElementById('orc-item-qtd'); if (qtdEl) qtdEl.value = '1';
  toast(`${(k.itens||[]).length} itens do kit "${k.nome}" adicionados`, 'success');
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
    onClienteOrcMudou();
    buscarCnpjCliente();
  }
}

function fecharDropdownEquipOrc() {
  const dd = document.getElementById('orc-equip-dropdown');
  if (dd) dd.style.display = 'none';
}
function adicionarEquipOrc() {
  const serie = document.getElementById('orc-serie').value.trim();
  const nome  = document.getElementById('orc-equip-nome').value.trim();
  if (!serie && !nome) { toast('Busque e selecione um equipamento primeiro', 'error'); return; }
  if (editandoEquipOrcIdx !== null) {
    orcEquipamentos[editandoEquipOrcIdx] = { serie, nome };
    editandoEquipOrcIdx = null;
    const btn = document.getElementById('orc-add-equip-btn');
    if (btn) btn.textContent = '+ Adicionar Equipamento a Lista';
  } else {
    orcEquipamentos.push({ serie, nome });
  }
  document.getElementById('orc-serie').value = '';
  document.getElementById('orc-equip-nome').value = '';
  renderEquipamentosOrc();
}
function renderEquipamentosOrc() {
  const el = document.getElementById('orc-equip-lista');
  if (!el) return;
  if (!orcEquipamentos.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = '<table class="data-table"><thead><tr><th>Serie</th><th>Equipamento</th><th></th></tr></thead><tbody>' +
    orcEquipamentos.map(function(eq, i) {
      return '<tr><td class="mono" style="font-size:11px;color:var(--accent)">' + (eq.serie||'-') + '</td>' +
        '<td style="font-size:12px">' + (eq.nome||'-') + '</td>' +
        '<td><button class="btn btn-ghost btn-sm" onclick="editarEquipOrc(' + i + ')">✎</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="removerEquipOrc(' + i + ')">✕</button></td></tr>';
    }).join('') + '</tbody></table>';
}
function editarEquipOrc(idx) {
  const eq = orcEquipamentos[idx];
  if (!eq) return;
  editandoEquipOrcIdx = idx;
  document.getElementById('orc-serie').value = eq.serie || '';
  document.getElementById('orc-equip-nome').value = eq.nome || '';
  const btn = document.getElementById('orc-add-equip-btn');
  if (btn) btn.textContent = 'Salvar edicao do equipamento';
}
function removerEquipOrc(idx) {
  orcEquipamentos.splice(idx, 1);
  editandoEquipOrcIdx = null;
  const btn = document.getElementById('orc-add-equip-btn');
  if (btn) btn.textContent = '+ Adicionar Equipamento a Lista';
  renderEquipamentosOrc();
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
          <td><button class="btn btn-ghost btn-sm" onclick="editarItemOrc(${i})">✎</button> <button class="btn btn-danger btn-sm" onclick="removerItemOrc(${i})">✕</button></td></tr>`;
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
  if (editandoItemOrcIdx !== null) { orcItens[editandoItemOrcIdx] = { cod, desc, qtd, valor, custoUnit: peca?.custo||0 }; editandoItemOrcIdx = null; const btnAdd = document.getElementById('orc-add-item-btn'); if (btnAdd) btnAdd.textContent = 'Add'; } else { orcItens.push({ cod, desc, qtd, valor, custoUnit: peca?.custo||0 }); }
  ['orc-item-cod','orc-item-desc','orc-item-valor'].forEach(fid => { const el=document.getElementById(fid); if(el) el.value=''; });
  const qtdEl = document.getElementById('orc-item-qtd'); if (qtdEl) qtdEl.value='1';
  const imgEl = document.getElementById('orc-item-img'); if (imgEl) { imgEl.style.display='none'; imgEl.innerHTML=''; }
  renderItensOrc();
}

function removerItemOrc(idx) { orcItens.splice(idx,1); editandoItemOrcIdx = null; renderItensOrc(); }
function editarItemOrc(idx) {
  const it = orcItens[idx];
  if (!it) return;
  editandoItemOrcIdx = idx;
  document.getElementById('orc-item-cod').value = it.cod || '';
  document.getElementById('orc-item-desc').value = it.desc || '';
  document.getElementById('orc-item-qtd').value = it.qtd || 1;
  document.getElementById('orc-item-valor').value = it.valor || 0;
  const btnAdd = document.getElementById('orc-add-item-btn');
  if (btnAdd) btnAdd.textContent = 'Salvar edicao';
}

function salvarOrcamento() {
  const numero = document.getElementById('orc-numero').value.trim();
  if (!numero) { toast('Informe o número do orçamento', 'error'); return; }
  const total = orcItens.reduce((s,it) => s + it.qtd*(parseFloat(it.valor)||0), 0);
  const data = {
    numero, total,
    status:     document.getElementById('orc-status').value,
    cliente:    document.getElementById('orc-cliente').value.trim(),
    cnpj:       document.getElementById('orc-cnpj')?.value.trim() || '',
    equip_serie: (orcEquipamentos[0]?.serie) || '',
    equip_nome:  (orcEquipamentos[0]?.nome) || '',
    equipamentos: [...orcEquipamentos],
    os:         document.getElementById('orc-os').value.trim(),
    data:       document.getElementById('orc-data').value,
    obs:        document.getElementById('orc-obs').value.trim(),
    validade:   document.getElementById('orc-validade')?.value   || '7 dias',
    pagamento:  document.getElementById('orc-pagamento')?.value  || '30 dias',
    entrega:    document.getElementById('orc-entrega')?.value    || 'A combinar',
    frete:      document.getElementById('orc-frete')?.value      || 'FOB',
    obs_condicoes: document.getElementById('orc-condicoes')?.value || '',
    condicoes:  document.getElementById('orc-condicoes-geradas')?.value || '',
    assinatura: currentUser?.nome || '',
    itens:      [...orcItens],
    itens_opcionais: [...orcItensOpcionais],
    tipo_nf: document.getElementById('orc-tipo-nf')?.value || '',
  };

  const fn = editOrcId ? API.put('/orcamentos/' + editOrcId, data) : API.post('/orcamentos', data);
  fn.then(() => {
    toast('Orçamento salvo');
    fecharModalOrcamento();
    loadAndRenderOrcamentos();
  }).catch(err => toast(err.message, 'error'));
}
const STATUS_ORC_OPCOES = ['ENVIADO','APROVADO_TECNICO','APROVADO_PECA','APROVADO_PAGAMENTO','A_FATURAR','FATURADO'];
function abrirMenuStatusOrc(ev, id) {
  ev.stopPropagation();
  fecharMenuStatusOrc();
  const btn = ev.currentTarget;
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'status-orc-menu';
  menu.style.cssText = 'position:fixed;top:' + (rect.bottom+4) + 'px;left:' + rect.left + 'px;background:var(--surface);border:1px solid var(--border2);border-radius:4px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:500;min-width:220px';
  menu.innerHTML = STATUS_ORC_OPCOES.map(function(st) {
    var info = ORC_STATUS[st];
    return '<div style="padding:8px 12px;cursor:pointer;font-size:12px;color:var(--text)" onmouseover="this.style.background=\'var(--border2)\'" onmouseout="this.style.background=\'transparent\'" onclick="definirStatusOrc(\'' + id + '\',\'' + st + '\')">' + info.label + '</div>';
  }).join('');
  document.body.appendChild(menu);
  setTimeout(function() { document.addEventListener('click', fecharMenuStatusOrc, { once: true }); }, 0);
}
function fecharMenuStatusOrc() {
  const m = document.getElementById('status-orc-menu');
  if (m) m.remove();
}
function definirStatusOrc(id, status) {
  fecharMenuStatusOrc();
  API.put('/orcamentos/' + id + '/status', { status: status })
    .then(function() {
      const o = db.orcamentos.find(function(x) { return x.id === id; });
      if (o) o.status = status;
      toast('Status atualizado', 'success');
      renderOrcamentos();
    })
    .catch(function(err) { toast(err.message, 'error'); });
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
  const validade   = document.getElementById('cfg-orc-validade')?.value   || '7 dias';
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
  const validade  = document.getElementById('orc-validade')?.value  || '7 dias';
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
  setSelect('cfg-orc-validade',  cfg.validade       || '7 dias');
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
  cfg.validade         = document.getElementById('cfg-orc-validade')?.value   || '7 dias';
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

  function desenharInfoRow(label, val) {
    doc.setFont('helvetica','bold');  doc.setFontSize(8); doc.setTextColor(...LIGHT);
    doc.text(label.toUpperCase() + ':', ML, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(...DARK);
    doc.text(String(val), ML + labelW, y);
    y += 5.5;
  }

  desenharInfoRow('Cliente', (o.cliente || '—') + (o.cnpj ? '  -  CNPJ: ' + o.cnpj : ''));

  // Lista de equipamentos: usa o array completo (o.equipamentos) quando
  // existir; senão cai para os campos únicos (compatibilidade com
  // orçamentos antigos, criados antes do suporte a múltiplos equipamentos).
  const listaEquipPdf = (o.equipamentos && o.equipamentos.length)
    ? o.equipamentos
    : [{ nome: o.equip_nome || '', serie: o.equip_serie || '' }];

  if (listaEquipPdf.length > 1) {
    listaEquipPdf.forEach((eq, i) => {
      desenharInfoRow(`Equipamento ${i + 1}`, eq.nome || '—');
      desenharInfoRow(`Nº de Série ${i + 1}`, eq.serie || '—');
    });
  } else {
    desenharInfoRow('Equipamento', listaEquipPdf[0]?.nome || '—');
    desenharInfoRow('Nº de Série', listaEquipPdf[0]?.serie || '—');
  }

  desenharInfoRow('OS', o.os || '—');

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

  // ── Itens Opcionais (ex: kits preventivas trazem itens recomendados pelo
  // fabricante, separados do valor principal do orçamento) ──────────────────
  if (o.itens_opcionais && o.itens_opcionais.length) {
    if (yNext > H - 70) { doc.addPage(); yNext = 20; }

    doc.setFillColor(212, 140, 50);
    doc.rect(ML, yNext, W-ML-MR, 7, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text('ITENS OPCIONAIS', ML+3, yNext+5);
    yNext += 9;

    doc.setTextColor(...MED); doc.setFont('helvetica','italic'); doc.setFontSize(8);
    const obsOpcLines = doc.splitTextToSize('Itens recomendados trocar numa preventiva, segundo o fabricante.', W-ML-MR);
    doc.text(obsOpcLines, ML, yNext+4);
    yNext += obsOpcLines.length*4 + 6;

    doc.autoTable({
      startY: yNext,
      head: [['#', 'Código', 'Descrição', 'Qtd', 'Valor Unit. (R$)', 'Total (R$)']],
      body: o.itens_opcionais.map((it,i) => [
        i+1,
        it.cod||'—',
        it.desc,
        it.qtd,
        parseFloat(it.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),
        (it.qtd*(parseFloat(it.valor)||0)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
      ]),
      styles:        { fontSize:9, cellPadding:3.5, textColor:DARK },
      headStyles:    { fillColor:[212,140,50], textColor:[255,255,255], fontStyle:'bold', fontSize:9 },
      alternateRowStyles: { fillColor:ROW_ALT },
      columnStyles:  { 0:{cellWidth:8,halign:'center'}, 1:{cellWidth:28,font:'courier'}, 4:{halign:'right'}, 5:{halign:'right',fontStyle:'bold'} },
      margin: { left:ML, right:MR },
    });

    const totalOpc = o.itens_opcionais.reduce((s,it)=>s+it.qtd*(parseFloat(it.valor)||0),0);
    const tableEndYOpc = doc.lastAutoTable.finalY;
    doc.setFillColor(212, 140, 50);
    doc.roundedRect(W-MR-boxW, tableEndYOpc+4, boxW, boxH, 2, 2, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('OPCIONAIS: R$ ' + totalOpc.toLocaleString('pt-BR',{minimumFractionDigits:2}), W-MR-boxW/2, tableEndYOpc+10.5, {align:'center'});
    yNext = tableEndYOpc + boxH + 14;
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
//  SOLICITAÇÕES DE COMPRA — CRUD
// ============================================================

const TECNICOS_SC = [
  'HENRIQUE','WESLEY','FABRICIO','SAULO','ALAN','NEY','RICARDO SALES','RICARDO TORRES',
  'ROGERIO','LEANDRO','BRUNO','NATANAEL','ATL','ALEXANDRE','SUPRIBIO'
];

const STATUS_SC = {
  SOLICITADO:           { label: 'Solicitado',            badge: 'badge-gray'   },
  AGUARDANDO_APROVACAO: { label: 'Aguard. Aprov.',         badge: 'badge-orange' },
  APROVADO:             { label: 'Aprovado',               badge: 'badge-green'  },
  APROVADO_PARCIAL:     { label: 'Aprovado Parcial',        badge: 'badge-blue'   },
  RECUSADO:             { label: 'Recusado',                badge: 'badge-red'    },
  RECEBIDO:             { label: 'Recebido/Finalizado',     badge: 'badge-teal'   },
  FINALIZADO:           { label: 'Finalizado',              badge: 'badge-green'  },
};

let editScId = null;
let scItens = [];
let editandoItemScIdx = null;

// ── LISTAGEM ─────────────────────────────────────────────────
function renderSolicitacoesCompra(q = '') {
  const el = document.getElementById('solicitacoescompra-table');
  if (!el) return;
  const sf = document.getElementById('sc-filter-status')?.value || '';
  let list = [...(db.solicitacoesCompra || [])].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  if (sf) list = list.filter(x => x.status === sf);
  const ql = (q || document.querySelector('#page-solicitacoescompra .search-input')?.value || '').toLowerCase().trim();
  if (ql) {
    list = list.filter(x =>
      String(x.numero || '').toLowerCase().includes(ql) ||
      String(x.demanda_nome || '').toLowerCase().includes(ql) ||
      String(x.equip_serie || '').toLowerCase().includes(ql)
    );
  }

  const badgeEl = document.getElementById('badge-solicitacoescompra');
  if (badgeEl) {
    badgeEl.textContent = (db.solicitacoesCompra || [])
      .filter(x => !['FINALIZADO', 'RECUSADO'].includes(x.status)).length || '0';
  }

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div>
      <div class="empty-title">Nenhuma Solicitação de Compra</div>
      <div class="empty-sub">Crie a primeira solicitação</div></div>`;
    return;
  }

  el.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>Nº</th><th>Status</th><th>Dias no Status</th><th>Demanda</th>
      <th>S/N Equip.</th><th>Itens</th><th>Total</th><th>Data</th><th></th>
    </tr></thead>
    <tbody>
    ${list.map(sc => {
      const st = STATUS_SC[sc.status] || STATUS_SC.SOLICITADO;
      const base = sc.status_changed_at || sc.created_at || Date.now();
      const dias = Math.floor((Date.now() - base) / 86400000);
      const diasLabel = dias + (dias === 1 ? ' dia' : ' dias');
      const demandaBadge = sc.demanda
        ? `<span class="badge badge-gray" style="font-size:9px">${sc.demanda}</span> ${sc.demanda_nome || ''}`
        : (sc.demanda_nome || '—');
      const totalSc = (sc.itens || []).reduce((s, it) => s + (it.qtd || 0) * (parseFloat(it.valor) || 0), 0);
      return `<tr>
        <td><strong style="font-family:var(--mono)">${sc.numero}</strong></td>
        <td><span class="badge ${st.badge}">${st.label}</span></td>
        <td class="mono" style="font-size:12px">${diasLabel}</td>
        <td style="font-size:12px">${demandaBadge}</td>
        <td class="mono" style="font-size:11px">${sc.equip_serie || '—'}${sc.equip_cliente ? `<div style="font-family:var(--body);font-size:10px;color:var(--text3)">${sc.equip_cliente}</div>` : ''}</td>
        <td class="mono">${(sc.itens || []).length}</td>
        <td class="mono" style="color:var(--accent);font-weight:700">R$ ${totalSc.toFixed(2)}</td>
        <td class="mono" style="font-size:11px">${sc.created_at ? new Date(sc.created_at).toLocaleDateString('pt-BR') : '—'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="abrirModalSolicitacaoCompra('${sc.id}')">Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="abrirMenuStatusSC(event,'${sc.id}')">Status ▾</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSolicitacaoCompra('${sc.id}')">✕</button>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

function proximoNumeroSC() {
  const nums = (db.solicitacoesCompra || []).map(x => parseInt(x.numero) || 0).filter(n => n > 0);
  return String(nums.length ? Math.max(...nums) + 1 : 1);
}

// ── MODAL ────────────────────────────────────────────────────
function abrirModalSolicitacaoCompra(id) {
  editScId = id || null;
  const sc = id ? (db.solicitacoesCompra || []).find(x => x.id === id) : null;
  scItens = sc ? JSON.parse(JSON.stringify(sc.itens || [])) : [];
  editandoItemScIdx = null;

  document.getElementById('modal-sc-title').textContent = sc ? 'Editar Solicitação de Compra' : 'Nova Solicitação de Compra';
  document.getElementById('sc-numero').value = sc ? sc.numero : proximoNumeroSC();
  document.getElementById('sc-status').value = sc?.status || 'SOLICITADO';
  document.getElementById('sc-demanda').value = sc?.demanda || 'TECNICO';
  document.getElementById('sc-demanda-nome-search').value = sc?.demanda_nome || '';
  document.getElementById('sc-equip-serie').value = sc?.equip_serie || '';
  const scNomeEl = document.getElementById('sc-equip-nome');
  scNomeEl.value = sc?.equip_nome || '';
  scNomeEl.dataset.serie = sc?.equip_serie || '';
  document.getElementById('sc-equip-cliente').value = sc?.equip_cliente || '';
  const scEquipCard = document.getElementById('sc-equip-card');
  if (sc?.equip_serie) {
    scEquipCard.style.display = 'block';
    scEquipCard.innerHTML = `<strong style="color:var(--accent);font-family:var(--mono)">${sc.equip_serie}</strong>
      ${sc.equip_nome ? ' · ' + sc.equip_nome : ''}
      ${sc.equip_cliente ? ' · <span style="color:var(--text3)">' + sc.equip_cliente + '</span>' : ''}`;
  } else {
    scEquipCard.style.display = 'none';
  }
  document.getElementById('sc-obs').value = sc?.obs || '';

  ['sc-item-cod', 'sc-item-desc', 'sc-item-valor', 'sc-item-obs'].forEach(id2 => {
    const el = document.getElementById(id2); if (el) el.value = '';
  });
  const qtdEl = document.getElementById('sc-item-qtd'); if (qtdEl) qtdEl.value = '1';
  const btnAdd = document.getElementById('sc-add-item-btn'); if (btnAdd) btnAdd.textContent = '⊕ Add';

  toggleDemandaSC();
  renderItensSC();
  document.getElementById('modal-solicitacaocompra').style.display = 'flex';
}

function fecharModalSolicitacaoCompra() {
  document.getElementById('modal-solicitacaocompra').style.display = 'none';
  editScId = null; scItens = []; editandoItemScIdx = null;
}

// ── CAMPO "DEMANDA" CONDICIONAL ──────────────────────────────
function toggleDemandaSC() {
  const demanda = document.getElementById('sc-demanda')?.value;
  const label = document.getElementById('sc-demanda-nome-label');
  if (!label) return;
  const labels = {
    TECNICO: 'Técnico *',
    CLIENTE: 'Cliente *',
    ESTOQUE: 'Estoque — descrição',
    OUTROS:  'Outros — descrição',
  };
  label.textContent = labels[demanda] || 'Nome';
  fecharDropdownDemandaSC();
}

function filtrarDemandaNomeSC(q) {
  const demanda = document.getElementById('sc-demanda')?.value;
  const dd = document.getElementById('sc-demanda-nome-dd');
  if (!dd) return;

  if (demanda === 'ESTOQUE' || demanda === 'OUTROS') {
    dd.style.display = 'none';
    return;
  }

  const ql = (q || '').toLowerCase().trim();
  let list = [];
  if (demanda === 'TECNICO') {
    list = TECNICOS_SC.filter(t => !ql || t.toLowerCase().includes(ql));
  } else if (demanda === 'CLIENTE') {
    const clientesSet = new Set();
    (db.equipamentos || []).forEach(e => {
      if (e.nome_fantasia) clientesSet.add(e.nome_fantasia.replace(/\[\d+\]$/, '').trim());
    });
    (db.orcamentos || []).forEach(o => { if (o.cliente) clientesSet.add(o.cliente); });
    list = [...clientesSet].filter(c => !ql || c.toLowerCase().includes(ql));
  }

  if (!list.length) { dd.style.display = 'none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = list.slice(0, 30).map(nome => `<div
      onmousedown="selecionarDemandaNomeSC('${nome.replace(/'/g, "\\'")}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${nome}</div>`
  ).join('');
}

function selecionarDemandaNomeSC(nome) {
  const el = document.getElementById('sc-demanda-nome-search');
  if (el) el.value = nome;
  fecharDropdownDemandaSC();
}

function fecharDropdownDemandaSC() {
  const dd = document.getElementById('sc-demanda-nome-dd');
  if (dd) dd.style.display = 'none';
}

// ── AUTOCOMPLETE DE EQUIPAMENTO (puxa Equipamento e Cliente automaticamente) ──
function filtrarEquipSC(q) {
  const dd = document.getElementById('sc-equip-dropdown');
  if (!dd) return;

  // Se o texto digitado não bate mais com o equipamento selecionado, limpa o auto-preenchido
  const nomeEl = document.getElementById('sc-equip-nome');
  const clienteEl = document.getElementById('sc-equip-cliente');
  if (nomeEl && nomeEl.dataset.serie !== q) {
    nomeEl.value = ''; nomeEl.dataset.serie = '';
    if (clienteEl) clienteEl.value = '';
    const card = document.getElementById('sc-equip-card');
    if (card) card.style.display = 'none';
  }

  const ql = (q || '').toLowerCase().trim();
  const list = (db.equipamentos || []).filter(e =>
    !ql ||
    String(e.serie || '').toLowerCase().includes(ql) ||
    String(e.codigo || '').toLowerCase().includes(ql) ||
    String(e.nome || '').toLowerCase().includes(ql) ||
    String(e.nome_fantasia || '').toLowerCase().includes(ql)
  ).slice(0, 40);

  if (!list.length) { dd.style.display = 'none'; return; }
  dd.style.display = 'block';
  dd.innerHTML = list.map(e => {
    const serie = e.serie || e.codigo || '';
    const cliente = e.nome_fantasia ? e.nome_fantasia.replace(/\[\d+\]$/, '').trim() : '';
    return `<div onmousedown="selecionarEquipSC('${e.id}')"
      style="padding:9px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      <div><span style="font-family:var(--mono);color:var(--accent);font-weight:700">${serie}</span>
        <span style="margin-left:8px;color:var(--text)">${e.nome || ''}</span></div>
      ${cliente ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${cliente}</div>` : ''}
    </div>`;
  }).join('');
}

function selecionarEquipSC(id) {
  const e = (db.equipamentos || []).find(x => x.id === id);
  if (!e) return;
  const serie = e.serie || e.codigo || '';
  const cliente = e.nome_fantasia ? e.nome_fantasia.replace(/\[\d+\]$/, '').trim() : '';

  const input = document.getElementById('sc-equip-serie');
  input.value = serie;

  const nomeEl = document.getElementById('sc-equip-nome');
  nomeEl.value = e.nome || '';
  nomeEl.dataset.serie = serie;

  document.getElementById('sc-equip-cliente').value = cliente;
  fecharDropdownEquipSC();

  const card = document.getElementById('sc-equip-card');
  card.style.display = 'block';
  card.innerHTML = `<strong style="color:var(--accent);font-family:var(--mono)">${serie}</strong>
    ${e.nome ? ' · ' + e.nome : ''}
    ${cliente ? ' · <span style="color:var(--text3)">' + cliente + '</span>' : ''}`;
}

function fecharDropdownEquipSC() {
  const dd = document.getElementById('sc-equip-dropdown');
  if (dd) dd.style.display = 'none';
}

// ── ITENS ────────────────────────────────────────────────────
function sugerirPecaSC(q) {
  const dd = document.getElementById('sc-item-peca-dropdown');
  if (!dd) return;
  const ql = (q || '').toLowerCase().trim();
  const list = db.pecas.filter(p =>
    !ql ||
    String(p.codigo || '').toLowerCase().includes(ql) ||
    String(p.nome || '').toLowerCase().includes(ql) ||
    String(p.fonte || '').toLowerCase().includes(ql)
  ).slice(0, 30);

  dd.style.display = list.length ? 'block' : 'none';
  dd.innerHTML = list.map(p => {
    const custo = p.custo || 0;
    const img = p.imagem
      ? `<img src="${p.imagem}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0">`
      : `<div style="width:28px;height:28px;background:var(--surface2);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px">⬡</div>`;
    return `<div onmousedown="selecionarPecaSC('${p.id}')"
      style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--border)"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${img}
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${p.codigo}</div>
        <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nome}</div>
        <div style="font-size:9px;color:var(--text3)">${p.fonte || ''}</div>
      </div>
      <div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">R$ ${custo.toFixed(2)}</div>
    </div>`;
  }).join('');
}

function selecionarPecaSC(pecaId) {
  const p = db.pecas.find(x => x.id === pecaId);
  if (!p) return;
  document.getElementById('sc-item-peca-dropdown').style.display = 'none';
  document.getElementById('sc-item-cod').value = p.codigo || '';
  document.getElementById('sc-item-desc').value = p.nome || '';
  document.getElementById('sc-item-valor').value = (p.custo || 0).toFixed(2);
}

function fecharDropdownPecaSC() {
  const dd = document.getElementById('sc-item-peca-dropdown');
  if (dd) dd.style.display = 'none';
}

function adicionarItemSC() {
  const cod  = document.getElementById('sc-item-cod').value.trim();
  const desc = document.getElementById('sc-item-desc').value.trim();
  const qtd  = parseInt(document.getElementById('sc-item-qtd').value) || 1;
  const valor = parseFloat(document.getElementById('sc-item-valor').value) || 0;
  const obs  = document.getElementById('sc-item-obs').value.trim();
  if (!desc) { toast('Informe a descrição do item', 'error'); return; }

  // Ao editar um item já existente, mantém a demanda/equipamento originais
  // dele — só captura do formulário quando é um item NOVO sendo adicionado.
  let demanda, demandaNome, equipSerie, equipNome, equipCliente;
  if (editandoItemScIdx !== null) {
    const original = scItens[editandoItemScIdx];
    demanda = original.demanda; demandaNome = original.demanda_nome;
    equipSerie = original.equip_serie; equipNome = original.equip_nome; equipCliente = original.equip_cliente;
  } else {
    demanda = document.getElementById('sc-demanda').value;
    demandaNome = document.getElementById('sc-demanda-nome-search')?.value.trim() || '';
    equipSerie = document.getElementById('sc-equip-serie').value.trim();
    equipNome = document.getElementById('sc-equip-nome').value.trim();
    equipCliente = document.getElementById('sc-equip-cliente').value.trim();
  }

  const item = {
    cod, desc, qtd, valor, obs,
    demanda, demanda_nome: demandaNome,
    equip_serie: equipSerie, equip_nome: equipNome, equip_cliente: equipCliente,
  };

  if (editandoItemScIdx !== null) {
    scItens[editandoItemScIdx] = item;
    editandoItemScIdx = null;
    const btn = document.getElementById('sc-add-item-btn');
    if (btn) btn.textContent = '⊕ Add';
  } else {
    scItens.push(item);
  }

  ['sc-item-cod', 'sc-item-desc', 'sc-item-valor', 'sc-item-obs'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const qtdEl = document.getElementById('sc-item-qtd'); if (qtdEl) qtdEl.value = '1';
  renderItensSC();
}

function editarItemSC(idx) {
  const it = scItens[idx]; if (!it) return;
  editandoItemScIdx = idx;
  document.getElementById('sc-item-cod').value  = it.cod  || '';
  document.getElementById('sc-item-desc').value = it.desc || '';
  document.getElementById('sc-item-qtd').value  = it.qtd  || 1;
  document.getElementById('sc-item-valor').value = it.valor || '';
  document.getElementById('sc-item-obs').value  = it.obs  || '';
  const btn = document.getElementById('sc-add-item-btn');
  if (btn) btn.textContent = 'Salvar edição';
}

function removerItemSC(idx) {
  scItens.splice(idx, 1);
  editandoItemScIdx = null;
  renderItensSC();
}

function renderItensSC() {
  const el = document.getElementById('sc-itens-lista');
  if (!el) return;
  if (!scItens.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);font-style:italic">Nenhum item adicionado</div>`;
  } else {
    const clientesDistintos = new Set(scItens.map(it => (it.equip_cliente || it.demanda_nome || '').trim())).size;
    const mostrarCliente = clientesDistintos > 1;
    el.innerHTML = `<table class="data-table">
      <thead><tr><th>P/N</th><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th>${mostrarCliente ? '<th>Cliente/Equip.</th>' : ''}<th>Obs.</th><th></th></tr></thead>
      <tbody>${scItens.map((it, i) => {
        const clienteCol = mostrarCliente
          ? `<td style="font-size:11px">${it.equip_serie ? `<span style="font-family:var(--mono)">${it.equip_serie}</span>` : ''}${it.equip_cliente ? (it.equip_serie ? ' · ' : '') + it.equip_cliente : (it.demanda_nome ? ' ' + it.demanda_nome : '')}${!it.equip_serie && !it.equip_cliente && !it.demanda_nome ? '<span style="color:var(--text3);font-style:italic">—</span>' : ''}</td>`
          : '';
        return `<tr>
        <td class="mono" style="font-size:11px;color:var(--accent)">${it.cod || '—'}</td>
        <td style="font-size:12px">${it.desc}</td>
        <td class="mono">${it.qtd}</td>
        <td class="mono">R$ ${parseFloat(it.valor || 0).toFixed(2)}</td>
        <td class="mono" style="color:var(--accent);font-weight:700">R$ ${(it.qtd * (parseFloat(it.valor) || 0)).toFixed(2)}</td>
        ${clienteCol}
        <td style="font-size:11px;color:var(--text3)">${it.obs || '—'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="editarItemSC(${i})">✎</button>
          <button class="btn btn-danger btn-sm" onclick="removerItemSC(${i})">✕</button>
        </td>
      </tr>`;
      }).join('')}</tbody></table>`;
  }
  const total = scItens.reduce((s, it) => s + it.qtd * (parseFloat(it.valor) || 0), 0);
  const totalEl = document.getElementById('sc-total-display');
  if (totalEl) totalEl.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ── SALVAR / STATUS / EXCLUIR ────────────────────────────────
function salvarSolicitacaoCompra() {
  const numero = document.getElementById('sc-numero').value.trim();
  if (!numero) { toast('Informe o número', 'error'); return; }

  const demanda = document.getElementById('sc-demanda').value;
  const demandaNome = document.getElementById('sc-demanda-nome-search')?.value.trim() || '';
  if ((demanda === 'TECNICO' || demanda === 'CLIENTE') && !demandaNome) {
    toast('Selecione ' + (demanda === 'TECNICO' ? 'o técnico' : 'o cliente'), 'error');
    return;
  }
  if (!scItens.length) { toast('Adicione ao menos um item', 'error'); return; }

  const data = {
    numero,
    status:       document.getElementById('sc-status').value,
    demanda,
    demanda_nome: demandaNome,
    equip_serie:  document.getElementById('sc-equip-serie').value.trim(),
    equip_nome:   document.getElementById('sc-equip-nome').value.trim(),
    equip_cliente: document.getElementById('sc-equip-cliente').value.trim(),
    obs:          document.getElementById('sc-obs').value.trim(),
    itens:        [...scItens],
  };

  const fn = editScId
    ? API.put('/solicitacoes-compra/' + editScId, data)
    : API.post('/solicitacoes-compra', data);

  fn.then(() => {
    toast('Solicitação de compra salva');
    fecharModalSolicitacaoCompra();
    loadAndRenderSolicitacoesCompra();
  }).catch(err => toast(err.message, 'error'));
}

function abrirMenuStatusSC(ev, id) {
  ev.stopPropagation();
  fecharMenuStatusSC();
  const btn = ev.currentTarget;
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'status-sc-menu';
  menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 4) + 'px;left:' + rect.left +
    'px;background:var(--surface);border:1px solid var(--border2);border-radius:4px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:500;min-width:200px';
  menu.innerHTML = Object.keys(STATUS_SC).map(st =>
    `<div style="padding:8px 12px;cursor:pointer;font-size:12px;color:var(--text)"
      onmouseover="this.style.background='var(--border2)'" onmouseout="this.style.background='transparent'"
      onclick="definirStatusSC('${id}','${st}')">${STATUS_SC[st].label}</div>`
  ).join('');
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', fecharMenuStatusSC, { once: true }), 0);
}

function fecharMenuStatusSC() {
  const m = document.getElementById('status-sc-menu');
  if (m) m.remove();
}

function definirStatusSC(id, status) {
  fecharMenuStatusSC();
  API.put('/solicitacoes-compra/' + id + '/status', { status })
    .then(() => {
      const sc = (db.solicitacoesCompra || []).find(x => x.id === id);
      if (sc) sc.status = status;
      toast('Status atualizado');
      renderSolicitacoesCompra();
    })
    .catch(err => toast(err.message, 'error'));
}

function deleteSolicitacaoCompra(id) {
  if (!confirm('Excluir esta solicitação de compra?')) return;
  API.delete('/solicitacoes-compra/' + id)
    .then(() => { toast('Solicitação excluída', 'info'); loadAndRenderSolicitacoesCompra(); })
    .catch(err => toast(err.message, 'error'));
}

// ── CARREGAMENTO (API) ───────────────────────────────────────
async function loadAndRenderSolicitacoesCompra(q = '', status = '') {
  setSyncing(true);
  try {
    const params = {};
    if (q) params.q = q;
    if (status) params.status = status;
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    db.solicitacoesCompra = await API.get('/solicitacoes-compra' + qs);
    renderSolicitacoesCompra(q);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    setSyncing(false);
  }
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
// ── GRÁFICOS DO DASHBOARD ──────────────────────────────────────
let _chartFaturamento = null;
function renderChartFaturamentoMensal(dados) {
  const canvas = document.getElementById('chart-faturamento-mensal');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_chartFaturamento) { _chartFaturamento.destroy(); _chartFaturamento = null; }

  let msg = document.getElementById('chart-faturamento-empty');
  if (!dados.length) {
    canvas.style.display = 'none';
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'chart-faturamento-empty';
      msg.className = 'empty-state';
      msg.innerHTML = `<div class="empty-icon">📊</div><div class="empty-title">Sem Faturamento</div><div class="empty-sub">Nenhum orçamento faturado ainda</div>`;
      canvas.parentElement.appendChild(msg);
    }
    msg.style.display = '';
    return;
  }
  canvas.style.display = 'block';
  if (msg) msg.style.display = 'none';

  const nomesMes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels = dados.map(d => {
    const [ano, mes] = String(d.mes||'').split('-');
    return mes ? `${nomesMes[parseInt(mes)-1]}/${String(ano).slice(2)}` : d.mes;
  });
  const valores = dados.map(d => Number(d.total)||0);

  _chartFaturamento = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{
      label: 'Faturamento (R$)', data: valores,
      backgroundColor: 'rgba(46,204,113,0.65)', borderColor: '#2ecc71', borderWidth: 1, borderRadius: 4,
    }]},
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => 'R$ ' + ctx.parsed.y.toLocaleString('pt-BR',{minimumFractionDigits:2}) } }
      },
      scales: {
        x: { ticks: { color: '#8a94a6' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8a94a6', callback: v => 'R$ ' + Number(v).toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

let _chartEnvios = null;
function renderChartEnviosCliente(dados) {
  const canvas = document.getElementById('chart-envios-cliente');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_chartEnvios) { _chartEnvios.destroy(); _chartEnvios = null; }

  let msg = document.getElementById('chart-envios-empty');
  if (!dados.length) {
    canvas.style.display = 'none';
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'chart-envios-empty';
      msg.className = 'empty-state';
      msg.innerHTML = `<div class="empty-icon">📦</div><div class="empty-title">Sem Envios</div><div class="empty-sub">Nenhuma peça enviada a clientes ainda</div>`;
      canvas.parentElement.appendChild(msg);
    }
    msg.style.display = '';
    return;
  }
  canvas.style.display = 'block';
  if (msg) msg.style.display = 'none';

  const labels = dados.map(d => String(d.cliente||'—').replace(/\[\d+\]$/,'').trim().slice(0,30));
  const custoPecas = dados.map(d => Number(d.custoPecas)||0);
  const custoFrete = dados.map(d => Number(d.custoFrete)||0);

  _chartEnvios = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Custo das Peças (R$)', data: custoPecas, backgroundColor: 'rgba(212,140,50,0.75)', borderRadius: 3 },
      { label: 'Custo de Frete (R$)',  data: custoFrete, backgroundColor: 'rgba(52,152,219,0.75)', borderRadius: 3 },
    ]},
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { labels: { color: '#8a94a6' } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: R$ ${ctx.parsed.x.toLocaleString('pt-BR',{minimumFractionDigits:2})}` } }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#8a94a6', callback: v => 'R$ ' + Number(v).toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { stacked: true, ticks: { color: '#8a94a6' }, grid: { display: false } }
      }
    }
  });
}

let _chartGastosSC = null;
function renderChartGastosSC(dados) {
  const canvas = document.getElementById('chart-gastos-sc-cliente');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_chartGastosSC) { _chartGastosSC.destroy(); _chartGastosSC = null; }

  let msg = document.getElementById('chart-gastos-sc-empty');
  if (!dados.length) {
    canvas.style.display = 'none';
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'chart-gastos-sc-empty';
      msg.className = 'empty-state';
      msg.innerHTML = `<div class="empty-icon">🛒</div><div class="empty-title">Sem Gastos</div><div class="empty-sub">Nenhuma solicitação de compra com cliente identificado ainda</div>`;
      canvas.parentElement.appendChild(msg);
    }
    msg.style.display = '';
    return;
  }
  canvas.style.display = 'block';
  if (msg) msg.style.display = 'none';

  const labels = dados.map(d => String(d.cliente||'—').replace(/\[\d+\]$/,'').trim().slice(0,30));
  const totais = dados.map(d => Number(d.total)||0);

  _chartGastosSC = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Gasto em Compras (R$)', data: totais, backgroundColor: 'rgba(155,89,182,0.75)', borderRadius: 3 },
    ]},
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `R$ ${ctx.parsed.x.toLocaleString('pt-BR',{minimumFractionDigits:2})}` } }
      },
      scales: {
        x: { ticks: { color: '#8a94a6', callback: v => 'R$ ' + Number(v).toLocaleString('pt-BR') }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#8a94a6' }, grid: { display: false } }
      }
    }
  });
}

function renderDashboard() {
  // Total de estoque: soma db.estoque (peças cadastradas) + depósitos sem peça vinculada
  const estoqueKnown = new Set(db.pecas.map(p => String(p.codigo)));
  const totalEstoque = Object.values(db.estoque).reduce((a,b)=>a+b, 0)
    + Object.entries(db.depositos)
        .filter(([cod]) => !estoqueKnown.has(cod))
        .reduce((s,[,d]) => s + (d['Total']||0), 0);

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
  document.getElementById('kpi-movs').textContent = abertas;

  // Valor Faturado / Peças Enviadas (vêm do servidor, já agregados)
  const dash = db._dashData || {};
  const fmtRS = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
  const kpiFat = document.getElementById('kpi-faturado');
  if (kpiFat) kpiFat.textContent = fmtRS(dash.valorFaturado);
  const kpiEnv = document.getElementById('kpi-enviadas');
  if (kpiEnv) kpiEnv.textContent = Number(dash.pecasEnviadas||0).toLocaleString('pt-BR');

  renderChartFaturamentoMensal(dash.faturamentoPorMes || []);
  renderChartEnviosCliente(dash.enviosPorCliente || []);
  renderChartGastosSC(dash.gastosPorCliente || []);

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
      return p.minimo > 0 && qty > 0 && qty < p.minimo;
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
      (p.minimo > 0 && estoqueAtual > 0 && estoqueAtual < p.minimo) ? (p.minimo - estoqueAtual) : 0
    );

    if (qtdSugerida <= 0 && !pendMap[pecaId] && !(p.minimo > 0 && estoqueAtual > 0 && estoqueAtual < p.minimo)) return;

    // Origens desta sugestão
    const origens = [];
    if (cfg.incluiDoadora === 'sim' && consumoDoad[pecaId]) origens.push('doadora');
    if (cfg.incluiPendente === 'sim' && pendMap[pecaId])    origens.push('pendente');
    if (p.minimo > 0 && estoqueAtual > 0 && estoqueAtual < p.minimo) origens.push('minimo');

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
  const totalCusto = list.reduce((s,m) => s + (m.peca_custo||0)*(m.qtd||1), 0);

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
        ${isAdmin ? `<td class="mono" style="font-size:11px;color:var(--accent)">R$ ${((m.peca_custo||0)*(m.qtd||1)).toFixed(2)}</td>` : ''}
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
      'Data','Peça Cód','Peça Desc','Valor Peça','Qtd',
      'Equipamento','Nº Série','Cliente','Técnico','OS',
      'Transporte','Valor','Rastreio','Obs'
    ];

    const rows = [heads, ...db.movimentacoes.map(m => {
      const dataEvt = m.eventos?.[0]?.data ? new Date(m.eventos[0].data).toLocaleString('pt-BR') : '';
      return [
        dataEvt,
        m.pecaCodigo || '',
        m.pecaNome   || '',
        parseFloat(m.peca_custo || 0),
        m.qtd        || 0,
        m.equipNome  || '',
        m.equipSerie || '',
        m.equipCliente || '',
        m.tecnico    || '',
        m.osNum      || '',
        m.transportadora || '',
        parseFloat(m.valor_frete || 0),
        m.rastreio   || '',
        m.obs        || '',
      ];
    })];

    const ws = buildSheet(rows, heads);
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, 'partforge_historico.xlsx');
    toast(`Histórico exportado: ${rows.length - 1} solicitações`);
  } else if (aba === 'orcamentos') {
    // Respeita o filtro de status e a busca que estiverem ativos na tela,
    // pra exportar só o que está sendo visualizado no momento.
    const sfExport = document.getElementById('orc-filter-status')?.value || '';
    const qExport = (document.querySelector('#page-orcamento .search-input')?.value || '').toLowerCase();
    let listaOrcExport = [...db.orcamentos];
    if (sfExport) listaOrcExport = listaOrcExport.filter(function(o) { return o.status === sfExport; });
    if (qExport) listaOrcExport = listaOrcExport.filter(function(o) {
      return (o.numero||'').toLowerCase().includes(qExport) ||
        (o.cliente||'').toLowerCase().includes(qExport) ||
        (o.equip_serie||'').toLowerCase().includes(qExport) ||
        (o.itens||[]).some(function(i) { return (i.desc||'').toLowerCase().includes(qExport); });
    });

    const TIPO_NF_LABEL = { NFE:'NFe', NFS:'NFS', AMBAS:'NFe + NFS' };
    const heads = ['Nº Orçamento','Status','Cliente','Equip','OS','Pagamento','Tipo de Nota','Total','Itens','Obs'];
    const rows = [heads, ...listaOrcExport.map(function(o) {
      const itensTexto = (o.itens || []).map(function(it) {
        const qtd = parseFloat(it.qtd || 0);
        const valor = parseFloat(it.valor || 0);
        return (it.cod || '') + ' - ' + (it.desc || '') + ' (Qtd: ' + qtd + ', Unit: R$ ' + valor.toFixed(2) + ', Total: R$ ' + (qtd * valor).toFixed(2) + ')';
      }).join(' | ');
      const equipList = (o.equipamentos && o.equipamentos.length) ? o.equipamentos
        : ((o.equip_serie || o.equip_nome) ? [{ serie: o.equip_serie, nome: o.equip_nome }] : []);
      const equipTexto = equipList.map(function(e) { return [e.serie, e.nome].filter(Boolean).join(' - '); }).join(' | ');
      const stLabel = (ORC_STATUS[o.status] || {}).label || o.status || '';
      const clienteTexto = (o.cliente || '') + (o.cnpj ? ' - ' + o.cnpj : '');
      return [
        o.numero || '',
        stLabel,
        clienteTexto,
        equipTexto,
        o.os || '',
        o.pagamento || '',
        TIPO_NF_LABEL[o.tipo_nf] || '',
        parseFloat(o.total || 0),
        itensTexto,
        o.obs || ''
      ];
    })];
    const ws = buildSheet(rows, heads);
    ws['!cols'] = heads.map(function(h, i) { return i === 8 ? { wch: 80 } : { wch: 18 }; });
    const stLabelArquivo = sfExport ? ((ORC_STATUS[sfExport]||{}).label || sfExport) : '';
    const nomeAba = ('Orçamentos' + (stLabelArquivo ? ' - ' + stLabelArquivo : '')).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);

    const nomeArquivo = 'partforge_orcamentos' + (sfExport ? '_' + sfExport.toLowerCase() : '') + '.xlsx';
    XLSX.writeFile(wb, nomeArquivo);
    toast('Orçamentos exportados: ' + listaOrcExport.length + (stLabelArquivo ? ' (status: ' + stLabelArquivo + ')' : ''));

  } else if (aba === 'solicitacoescompra') {
    const heads = ['Nº Solicitação eLoca','Status','Dias no Status','Demanda','Nome (Técnico/Cliente/Estoque)','S/N Equip.','Nome Equip.','Cliente Equip.','Total','Qtd Itens','Itens (Detalhe)','Observações'];
    const rows = [heads, ...db.solicitacoesCompra.map(function(sc) {
      const itensTexto = (sc.itens || []).map(function(it) {
        const qtd = parseFloat(it.qtd || 0);
        const valor = parseFloat(it.valor || 0);
        const obsItem = it.obs ? ' [Obs: ' + it.obs + ']' : '';
        return (it.cod || '') + ' - ' + (it.desc || '') + ' (Qtd: ' + qtd + ', Unit: R$ ' + valor.toFixed(2) + ', Total: R$ ' + (qtd * valor).toFixed(2) + ')' + obsItem;
      }).join(' | ');
      const total = (sc.itens || []).reduce(function(s, it) { return s + (parseFloat(it.qtd)||0) * (parseFloat(it.valor)||0); }, 0);
      const baseData = sc.status_changed_at || sc.created_at || Date.now();
      const diasStatus = Math.floor((Date.now() - baseData) / 86400000);
      return [
        sc.numero || '',
        sc.status || '',
        diasStatus,
        sc.demanda || '',
        sc.demanda_nome || '',
        sc.equip_serie || '',
        sc.equip_nome || '',
        sc.equip_cliente || '',
        total,
        (sc.itens || []).length,
        itensTexto,
        sc.obs || ''
      ];
    })];
    const ws = buildSheet(rows, heads);
    ws['!cols'] = heads.map(function(h, i) { return i === 10 ? { wch: 80 } : { wch: 16 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitações de Compra');

    XLSX.writeFile(wb, 'partforge_solicitacoes_compra.xlsx');
    toast('Solicitações de compra exportadas: ' + db.solicitacoesCompra.length);
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
          importarPecas(rows, sheetName); persistPecas();

        } else if (aba === 'equipamentos') {
          // Aba 'OG' é o padrão do eLoca; senão pega a primeira
          sheetName = wb.SheetNames.find(n => n.toUpperCase() === 'OG')
            || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarEquipamentos(rows, sheetName); persistEquipamentos();

        } else if (aba === 'estoque') {
          // Sheet1 é o padrão do eLoca; senão pega a primeira
          sheetName = wb.SheetNames.find(n => n.toLowerCase() === 'sheet1')
            || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarEstoque(rows, sheetName);
        } else if (aba === 'orcamentos') {
          sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('orcamento')) || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarOrcamentos(rows, sheetName);
        } else if (aba === 'solicitacoescompra') {
          sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('solicita')) || wb.SheetNames[0];
          ws = wb.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
          if (rows.length < 2) { toast('Arquivo sem dados', 'error'); return; }
          importarSolicitacoesCompra(rows, sheetName);
        }

      } catch(err) {
        toast('Erro ao ler arquivo: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

function importarOrcamentos(rows, sheetName) {
  const norm = function(str) { return String(str||'').trim().toLowerCase(); };
  const rawHeader = rows[0];
  const idx = {};
  rawHeader.forEach(function(h, i) {
    const hn = norm(h);
    if (hn === 'nº de orçamento' || hn === 'nº orçamento' || hn === 'numero' || hn === 'número') idx.numero = i;
    else if (hn === 'status') idx.status = i;
    else if (hn === 'cliente') idx.cliente = i;
    else if (hn === 'equip') idx.equip = i;
    else if (hn === 'série equip.' || hn === 'serie equip.') idx.equip_serie = i;
    else if (hn === 'nome equip.') idx.equip_nome = i;
    else if (hn === 'os') idx.os = i;
    else if (hn === 'data') idx.data = i;
    else if (hn === 'validade') idx.validade = i;
    else if (hn === 'pagamento') idx.pagamento = i;
    else if (hn === 'tipo de nota') idx.tipo_nf = i;
    else if (hn === 'entrega') idx.entrega = i;
    else if (hn === 'frete') idx.frete = i;
    else if (hn === 'itens' || hn === 'itens (detalhe)') idx.itens = i;
    else if (hn === 'obs' || hn === 'observações' || hn === 'observacoes') idx.obs = i;
  });
  if (idx.numero === undefined) { toast('Coluna Nº de Orçamento não encontrada', 'error'); return; }
  const labelParaStatus = {};
  Object.keys(ORC_STATUS).forEach(function(code) { labelParaStatus[norm(ORC_STATUS[code].label)] = code; });
  const labelParaTipoNf = { 'nfe': 'NFE', 'nfs': 'NFS', 'nfe + nfs': 'AMBAS' };
  function parseItens(texto) {
    if (!texto) return [];
    return String(texto).split(' | ').map(function(bloco) {
      const m = bloco.match(/^(.*?) - (.*?) \(Qtd: ([\d.]+), Unit: R\$ ([\d.,]+), Total: R\$ ([\d.,]+)\)$/);
      if (!m) return null;
      return { cod: m[1].trim(), desc: m[2].trim(), qtd: parseFloat(m[3])||1, valor: parseFloat(m[4].replace(',','.'))||0, custoUnit: 0 };
    }).filter(Boolean);
  }
  let criados = 0, atualizados = 0, erros = 0;
  const linhas = rows.slice(1);
  function processarLinha(i) {
    if (i >= linhas.length) {
      toast('Orçamentos importados: ' + criados + ' criados, ' + atualizados + ' atualizados' + (erros?', ' + erros + ' erros':''), 'success');
      loadAndRenderOrcamentos();
      return;
    }
    const row = linhas[i];
    const numero = String(row[idx.numero]||'').trim();
    if (!numero) { processarLinha(i+1); return; }
    const statusLabel = norm(row[idx.status]);
    const statusCode = labelParaStatus[statusLabel] || 'RASCUNHO';
    const itens = idx.itens !== undefined ? parseItens(row[idx.itens]) : [];
    // Coluna combinada "Equip" (formato "Série - Nome | Série2 - Nome2"): usa
    // o primeiro equipamento pros campos únicos equip_serie/equip_nome.
    let equipSerie = idx.equip_serie !== undefined ? row[idx.equip_serie] : '';
    let equipNome  = idx.equip_nome  !== undefined ? row[idx.equip_nome]  : '';
    if (idx.equip !== undefined && row[idx.equip]) {
      const primeiro = String(row[idx.equip]).split(' | ')[0] || '';
      const partes = primeiro.split(' - ');
      equipSerie = partes[0] ? partes[0].trim() : equipSerie;
      equipNome  = partes.slice(1).join(' - ').trim() || equipNome;
    }
    const payload = {
      numero: numero,
      status: statusCode,
      cliente: idx.cliente !== undefined ? row[idx.cliente] : '',
      equip_serie: equipSerie,
      equip_nome: equipNome,
      os: idx.os !== undefined ? row[idx.os] : '',
      data: idx.data !== undefined ? row[idx.data] : '',
      validade: idx.validade !== undefined ? row[idx.validade] : '7 dias',
      pagamento: idx.pagamento !== undefined ? row[idx.pagamento] : '30 dias',
      entrega: idx.entrega !== undefined ? row[idx.entrega] : 'A combinar',
      frete: idx.frete !== undefined ? row[idx.frete] : 'FOB',
      tipo_nf: idx.tipo_nf !== undefined ? (labelParaTipoNf[norm(row[idx.tipo_nf])] || '') : '',
      obs: idx.obs !== undefined ? row[idx.obs] : '',
      itens: itens
    };
    const existente = db.orcamentos.find(function(o) { return String(o.numero) === numero; });
    const prom = existente ? API.put('/orcamentos/' + existente.id, payload) : API.post('/orcamentos', payload);
    prom.then(function() {
      if (existente) atualizados++; else criados++;
      processarLinha(i+1);
    }).catch(function() {
      erros++;
      processarLinha(i+1);
    });
  }
  processarLinha(0);
}
function importarSolicitacoesCompra(rows, sheetName) {
  const norm = function(str) { return String(str||'').trim().toLowerCase(); };
  const rawHeader = rows[0];
  const idx = {};
  rawHeader.forEach(function(h, i) {
    const hn = norm(h);
    if (hn === 'nº solicitação eloca' || hn === 'nº solicitacao eloca' || hn === 'numero' || hn === 'número') idx.numero = i;
    else if (hn === 'status') idx.status = i;
    else if (hn === 'demanda') idx.demanda = i;
    else if (hn === 'nome (técnico/cliente/estoque)' || hn === 'nome (tecnico/cliente/estoque)') idx.demanda_nome = i;
    else if (hn === 's/n equip.') idx.equip_serie = i;
    else if (hn === 'nome equip.') idx.equip_nome = i;
    else if (hn === 'cliente equip.') idx.equip_cliente = i;
    else if (hn === 'itens (detalhe)') idx.itens = i;
    else if (hn === 'observações' || hn === 'observacoes') idx.obs = i;
  });
  if (idx.numero === undefined) { toast('Coluna Nº Solicitação eLoca não encontrada', 'error'); return; }
  const labelParaStatus = {};
  Object.keys(STATUS_SC).forEach(function(code) { labelParaStatus[norm(STATUS_SC[code].label)] = code; });
  function parseItens(texto) {
    if (!texto) return [];
    return String(texto).split(' | ').map(function(bloco) {
      const obsMatch = bloco.match(/\[Obs: (.*?)\]$/);
      const obs = obsMatch ? obsMatch[1].trim() : '';
      const semObs = bloco.replace(/\s*\[Obs: .*?\]$/, '');
      const m = semObs.match(/^(.*?) - (.*?) \(Qtd: ([\d.]+), Unit: R\$ ([\d.,]+), Total: R\$ ([\d.,]+)\)$/);
      if (!m) return null;
      return { cod: m[1].trim(), desc: m[2].trim(), qtd: parseFloat(m[3])||1, valor: parseFloat(m[4].replace(',','.'))||0, obs: obs };
    }).filter(Boolean);
  }
  let criados = 0, atualizados = 0, erros = 0;
  const linhas = rows.slice(1);
  function processarLinha(i) {
    if (i >= linhas.length) {
      toast('Solicitações de compra importadas: ' + criados + ' criadas, ' + atualizados + ' atualizadas' + (erros?', ' + erros + ' erros':''), 'success');
      loadAndRenderSolicitacoesCompra();
      return;
    }
    const row = linhas[i];
    const numero = String(row[idx.numero]||'').trim();
    if (!numero) { processarLinha(i+1); return; }
    const statusLabel = norm(row[idx.status]);
    const statusCode = labelParaStatus[statusLabel] || 'SOLICITADO';
    const itens = idx.itens !== undefined ? parseItens(row[idx.itens]) : [];
    const payload = {
      numero: numero,
      status: statusCode,
      demanda: idx.demanda !== undefined ? row[idx.demanda] : '',
      demanda_nome: idx.demanda_nome !== undefined ? row[idx.demanda_nome] : '',
      equip_serie: idx.equip_serie !== undefined ? row[idx.equip_serie] : '',
      equip_nome: idx.equip_nome !== undefined ? row[idx.equip_nome] : '',
      equip_cliente: idx.equip_cliente !== undefined ? row[idx.equip_cliente] : '',
      obs: idx.obs !== undefined ? row[idx.obs] : '',
      itens: itens
    };
    const existente = db.solicitacoesCompra.find(function(sc) { return String(sc.numero) === numero; });
    const prom = existente ? API.put('/solicitacoes-compra/' + existente.id, payload) : API.post('/solicitacoes-compra', payload);
    prom.then(function() {
      if (existente) atualizados++; else criados++;
      processarLinha(i+1);
    }).catch(function() {
      erros++;
      processarLinha(i+1);
    });
  }
  processarLinha(0);
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

  // Índice código->peça construído UMA VEZ antes do loop (O(n)), em vez de
  // procurar linearmente em db.pecas a cada linha do arquivo (O(n) por linha,
  // O(n×m) no total — isso é o que travava o navegador em importações grandes).
  const indicePecas = new Map();
  db.pecas.forEach(p => indicePecas.set(String(p.codigo||'').trim().toUpperCase(), p));

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
        // Remove R$, $, espaços
        val = val.replace(/[R$\s]/g,'');
        if (val.includes(',')) {
          // Formato BR (1.234,56): pontos são separador de milhar, vírgula é decimal
          val = val.replace(/\./g,'').replace(',','.');
        }
        // Sem vírgula: já é decimal simples (751.68, 0.05...) — mantém o ponto como está
        val = val || '0';
        data[internalKey] = parseFloat(val) || 0;
      } else {
        data[internalKey] = val;
      }
    }

    // Calculo automatico de preco: USD x 5.27 (dolar) x 2.00 (taxa) x 2.00 (markup)
    (function calcularPrecoAutomatico() {
      const TAXA_PADRAO = 2.00, DOLAR_PADRAO = 5.27, MARKUP_PADRAO = 2.00;
      const custoUsd = parseFloat(data.custo_usd) || 0;
      const custoDireto = parseFloat(data.custo) || 0;
      if (custoUsd > 0) {
        const custo = custoUsd * DOLAR_PADRAO * TAXA_PADRAO;
        data.taxa = TAXA_PADRAO;
        data.dolar = DOLAR_PADRAO;
        data.markup = MARKUP_PADRAO;
        data.custo = parseFloat(custo.toFixed(2));
        data.valor_venda = parseFloat((custo * MARKUP_PADRAO).toFixed(2));
      } else if (custoDireto > 0) {
        data.markup = MARKUP_PADRAO;
        data.valor_venda = parseFloat((custoDireto * MARKUP_PADRAO).toFixed(2));
      }
    })();

    const codigoNorm = codigo.trim().toUpperCase();
    const existing = indicePecas.get(codigoNorm);
    if (existing) {
      Object.assign(existing, data);
      updated++;
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      db.pecas.push(data);
      indicePecas.set(codigoNorm, data);
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
  const indiceEquip = new Map();
  db.equipamentos.forEach(e => indiceEquip.set(String(e.codigo), e));

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
        let clean = val.replace(/[R$\s]/g,'');
        if (clean.includes(',')) {
          clean = clean.replace(/\./g,'').replace(',','.');
        }
        clean = clean || '0';
        data[internalKey] = parseFloat(clean)||0;
      } else {
        data[internalKey] = val;
      }
    }

    const existing = indiceEquip.get(codigo);
    if (existing) {
      Object.assign(existing, data);
      updated++;
    } else {
      data.id = uid();
      data.createdAt = Date.now();
      db.equipamentos.push(data);
      indiceEquip.set(codigo, data);
      added++;
    }
  });

  updateBadges();
  renderEquipamentos();
  renderDashboard();
  const skipMsg = skipped > 0 ? `, ${skipped} ignorados` : '';
  toast(`eLoca [${sheetName||'OG'}] — ${added} adicionados, ${updated} atualizados${skipMsg}`);
}


function persistPecas() {
  const payload = db.pecas.map(function(p) {
    return {
      id: p.id, codigo: p.codigo || '', nome: p.nome || '', unidade: p.unidade || 'UN',
      grupo: p.grupo || '', fonte: p.fonte || '', linha: p.linha || '', minimo: p.minimo || 5,
      taxa: p.taxa || 0, dolar: p.dolar || 0, markup: p.markup || 0, custo: p.custo || 0,
      valor_venda: p.valor_venda || 0, preco_usd: p.preco_usd || p.custo_usd || 0
    };
  });
  if (!payload.length) return;
  API.post('/pecas/importar', { pecas: payload })
    .then(function() { toast('OK: ' + payload.length + ' pecas salvas no servidor'); })
    .catch(function(err) { toast('ERRO ao salvar pecas no servidor: ' + err.message); });
}

function persistEquipamentos() {
  const payload = db.equipamentos.map(function(d) {
    return {
      id: d.id, modelo: d.nome || d.modelo || '', marca: d.marca || '',
      serie: d.serie || '', linha: d.grupo || '',
      cliente: d.nome_fantasia || d.proprietario || '',
      local: d.local || '', contrato: d.contrato || '', obs: '',
      campos: d
    };
  });
  if (!payload.length) return;
  API.post('/equipamentos/importar', { equipamentos: payload })
    .then(function() { toast('OK: ' + payload.length + ' equipamentos salvos no servidor'); })
    .catch(function(err) { toast('ERRO ao salvar equipamentos no servidor: ' + err.message); });
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
    try {
      const { estoque } = await API.estoque();
      db.estoque = {};
      estoque.forEach(function(e) { db.estoque[e.peca_id] = e.quantidade; });
    } catch (e2) { /* estoque opcional, nao bloqueia render */ }
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
  API.get('/kits-preventivas').then(k => { db.kitsPreventivas = k; }).catch(() => {});
}

// Override navigate to use loadAndRender functions
const _originalNavigate = navigate;
function navigate(page, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active")); document.body.classList.remove("mob-active"); var _pM=document.getElementById("page-mobile-requests"); if(_pM) _pM.style.display="none";
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (!pageEl) return;
  pageEl.classList.add('active');
  if (el) el.classList.add('active');

  const titles = {
    dashboard:    ['Dashboard',    '/ visão geral'],
    pecas:        ['Peças',        '/ cadastro'],
    equipamentos: ['Equipamentos', '/ cadastro'],
    'kits-preventivas': ["Kit's Preventivas", '/ itens, valores e fornecedor'],
    estoque:      ['Estoque',      '/ posição atual'],
    movimentacao: ['Movimentação', '/ nova solicitação'],
    historico:    ['Histórico',    '/ solicitações'],
    logistica:    ['Logística',    '/ painel de despacho'],
    orcamento:    ['Orçamentos',   '/ cadastro e faturamento'],
    solicitacoescompra: ['Solicitações de Compra', '/ demanda técnico, cliente e estoque'],
    usuarios:     ['Usuários',     '/ cadastro e permissões'],
    compras:      ['Compras',      '/ pedidos e sugestões'],
    doadoras:     ['Máq. Doadoras','/ retirada de peças'],
    'mobile-requests': ['Solicitações Mobile','/ orçamentos e pedidos do app'],
  };
  const t = titles[page] || [page, ''];
  const titleEl = document.getElementById('page-title');
  const pathEl  = document.getElementById('page-path');
  if (titleEl) titleEl.textContent = t[0];
  if (pathEl)  pathEl.textContent  = t[1];

  const actionsEl = document.getElementById('topbar-actions');
  if (actionsEl) actionsEl.innerHTML = '';
  if (page === 'mobile-requests') { var pMob=document.getElementById('page-mobile-requests'); if(pMob) pMob.style.display='block'; document.body.classList.add('mob-active'); setTimeout(function(){if(typeof renderMobOrc==='function'){renderMobOrc();renderMobPed();marcarTodasLidas();}},200); }

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
      <button class="btn btn-import" onclick="importarExcel('orcamentos')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('orcamentos')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="abrirModalOrcamento()">⊕ Novo Orçamento</button>`;
    loadAndRenderOrcamentos();
  } else if (page === 'solicitacoescompra') {
    if (actionsEl) actionsEl.innerHTML = `
      <button class="btn btn-import" onclick="importarExcel('solicitacoescompra')">⬆ Importar Excel</button>
      <button class="btn btn-excel" onclick="exportarExcel('solicitacoescompra')">⬇ Exportar Excel</button>
      <button class="btn btn-primary" onclick="abrirModalSolicitacaoCompra()">⊕ Nova Solicitação</button>`;
    loadAndRenderSolicitacoesCompra();
  } else if (page === 'kits-preventivas') {
    if (actionsEl) actionsEl.innerHTML = `<button class="btn btn-primary" onclick="abrirModalKitPreventiva()">⊕ Novo Kit</button>`;
    loadAndRenderKitsPreventivas();
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
  API.get('/backup').then(function(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'partforge_backup_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Backup baixado com sucesso!');
  }).catch(function(err) {
    toast('Erro ao gerar backup: ' + err.message, 'error');
  });
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

// ============================================================
// SOLICITAÇÕES MOBILE
// ============================================================
let mobSeenIds = [];

function getMobOrcamentos() {
  return (db.orcamentos||[]).filter(o=>o.numero&&String(o.numero).startsWith('M-'));
}

function getMobPedidos() {
  return (db.movimentacoes||[]).filter(m=>m.origem==='mobile');
}

function tocarSomAlerta() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [523,659,784].forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.3,ctx.currentTime+i*0.15);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.15+0.3);
      osc.start(ctx.currentTime+i*0.15);
      osc.stop(ctx.currentTime+i*0.15+0.3);
    });
  } catch(e){}
}

function atualizarBadgeMobile() {
  const orcs = getMobOrcamentos();
  const peds = getMobPedidos();
  const novosOrcs = orcs.filter(o=>!mobSeenIds.includes('orc-'+o.id));
  const novosPeds = peds.filter(m=>!mobSeenIds.includes('ped-'+m.id));
  const total = novosOrcs.length + novosPeds.length;
  const badge = document.getElementById('badge-mobile');
  const badgeOrc = document.getElementById('badge-mob-orc');
  const badgePed = document.getElementById('badge-mob-ped');
  if(badge){if(total>0){badge.textContent=total;badge.style.display='';}else{badge.style.display='none';}}
  if(badgeOrc){if(novosOrcs.length>0){badgeOrc.textContent=novosOrcs.length;badgeOrc.style.display='';}else{badgeOrc.style.display='none';}}
  if(badgePed){if(novosPeds.length>0){badgePed.textContent=novosPeds.length;badgePed.style.display='';}else{badgePed.style.display='none';}}
}

function marcarTodasLidas() {
  const orcs = getMobOrcamentos();
  const peds = getMobPedidos();
  mobSeenIds = [...orcs.map(o=>'orc-'+o.id), ...peds.map(m=>'ped-'+m.id)];
  atualizarBadgeMobile();
  renderMobOrc(); renderMobPed();
}

function switchMobTab(tab) {
  document.getElementById('panel-mob-orc').style.display = tab==='orc'?'':'none';
  document.getElementById('panel-mob-ped').style.display = tab==='ped'?'':'none';
  const tOrc = document.getElementById('tab-mob-orc');
  const tPed = document.getElementById('tab-mob-ped');
  if(tOrc){tOrc.style.borderBottomColor=tab==='orc'?'var(--accent)':'transparent';tOrc.style.color=tab==='orc'?'var(--accent)':'var(--text3)';}
  if(tPed){tPed.style.borderBottomColor=tab==='ped'?'var(--accent)':'transparent';tPed.style.color=tab==='ped'?'var(--accent)':'var(--text3)';}
}

function renderMobOrc() {
  const el = document.getElementById('mob-orc-table');
  if(!el) return;
  const orcs = getMobOrcamentos();
  if(!orcs.length){el.innerHTML='<div class="empty-state"><div class="empty-icon">📱</div><div class="empty-title">Nenhum orçamento mobile</div></div>';return;}
  el.innerHTML='<table class="data-table"><thead><tr><th>Número</th><th>Cliente</th><th>Equipamento</th><th>Total</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+
    orcs.map(o=>{
      const isNovo = !mobSeenIds.includes('orc-'+o.id);
      return '<tr style="'+(isNovo?'background:rgba(249,115,22,0.05);':'')+'">' +
        '<td><span style="font-family:var(--mono);color:var(--accent)">'+o.numero+'</span>'+(isNovo?'<span style="background:var(--accent);color:#fff;font-size:9px;padding:1px 5px;border-radius:4px;margin-left:6px">NOVO</span>':'')+'</td>'+
        '<td>'+(o.cliente||'—')+'</td>'+
        '<td>'+(o.equip_nome||o.equip_serie||'—')+'</td>'+
        '<td style="font-family:var(--mono);color:var(--green)">R$ '+parseFloat(o.total||0).toFixed(2)+'</td>'+
        '<td>'+(o.data||'—')+'</td>'+
        '<td><span class="status-badge status-'+(o.status||'').toLowerCase()+'">'+(o.status||'—')+'</span></td>'+
        '<td><button class="btn btn-ghost btn-sm" onclick="abrirModalOrcamento(\''+o.id+'\')">Ver</button> <button class="btn btn-sm" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3)" onclick="gerarPDFOrcamento(\''+o.id+'\')">⬇ PDF</button></td>'+
      '</tr>';
    }).join('')+
  '</tbody></table>';
}

async function renderMobPed() {
  const el = document.getElementById('mob-ped-table');
  if(!el) return;
  el.innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try{ const data=await API.get('/movimentacoes'); db.movimentacoes=Array.isArray(data)?data:(data.movimentacoes||[]); }catch(e){}
  const peds = getMobPedidos();
  if(!peds.length){ el.innerHTML='<div class="empty-state"><div class="empty-icon">📱</div><div class="empty-title">Nenhuma solicitacao mobile</div></div>'; return; }
  const origEl = document.getElementById('hist-table');
  const origMov = db.movimentacoes;
  if(origEl) origEl.id='hist-table-backup';
  el.id='hist-table';
  db.movimentacoes = peds;
  renderHistorico();
  el.id='mob-ped-table';
  if(origEl) origEl.id='hist-table';
  db.movimentacoes = origMov;
}

// ============================================================
// NOTIFICAÇÕES - POLLING DESKTOP
// ============================================================
let notifUltimoTs = Date.now();
let notifTimer = null;
let notifStatusMap = {};

function iniciarPollingNotificacoes() {
  if(notifTimer) clearInterval(notifTimer);
  notifTimer = setInterval(verificarNotificacoes, 30000);
}

async function verificarNotificacoes() {
  try {
    const data = await API.get('/notificacoes?desde=' + (notifUltimoTs - 5000));
    notifUltimoTs = data.timestamp || Date.now();

    // Novas solicitacoes mobile (com som) — antes o filtro também deixava
    // passar solicitações do desktop por engano (`|| m.tecnico` era sempre
    // verdadeiro, já que toda solicitação tem técnico preenchido).
    const novasMov = (data.movimentacoes||[]).filter(m => m.origem === 'mobile');
    const novosOrcs = (data.orcamentos||[]);

    novasMov.forEach(m => {
      const key = 'mov-' + m.id + '-' + m.status;
      if(!notifStatusMap[key]) {
        notifStatusMap[key] = true;
        const msgs = {
          'SOLICITADA': '📱 Nova solicitação de ' + (m.tecnico||'técnico') + ': ' + (m.pecaNome||''),
          'DESPACHADA': '📦 Peça despachada confirmada: ' + (m.pecaNome||''),
          'RECEBIDA': '✓ Peça recebida pelo técnico: ' + (m.pecaNome||''),
        };
        const msg = msgs[m.status];
        if(msg) {
          toast(msg, 'success');
          tocarSomNotificacao();
          atualizarBadgeMobile();
        }
      }
    });

    novosOrcs.forEach(o => {
      const key = 'orc-' + o.id;
      if(!notifStatusMap[key]) {
        notifStatusMap[key] = true;
        toast('📱 Novo orçamento mobile: ' + (o.cliente||o.numero||''), 'success');
        tocarSomNotificacao();
        atualizarBadgeMobile();
      }
    });
  } catch(e) {}
}

function tocarSomNotificacao() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [880, 1100].forEach((freq,i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i*0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i*0.15 + 0.2);
      osc.start(ctx.currentTime + i*0.15);
      osc.stop(ctx.currentTime + i*0.15 + 0.3);
    });
  } catch(e) {}
}

// Inicia polling quando carregar
setTimeout(iniciarPollingNotificacoes, 5000);
