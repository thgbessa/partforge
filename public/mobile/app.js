const API_BASE='/api';
let currentUser=null;
let navHistory=[];
let token=localStorage.getItem('pf_mobile_token');
let didLogout=false;

async function api(method,path,body){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(token)opts.headers['Authorization']=`Bearer ${token}`;
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(API_BASE+path,opts);
  const data=await res.json().catch(()=>({}));
  if(res.status===401){doLogout();return null;}
  if(!res.ok)throw new Error(data.erro||data.error||`Erro ${res.status}`);
  return data;
}

function fmt(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);}
function fmtDate(ts){if(!ts)return'—';return new Date(ts).toLocaleDateString('pt-BR');}

function toast(msg,type=''){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.className='toast show'+(type?' '+type:'');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'),3000);
}

function showScreen(id,pushHist=true){
  const screens=document.querySelectorAll('.screen');
  const current=[...screens].find(s=>s.classList.contains('active'));
  if(current&&pushHist){
    navHistory.push(current.id);
    current.classList.add('slide-left');
    current.classList.remove('active');
  }else if(current){
    current.classList.remove('active','slide-left');
  }
  const next=document.getElementById(id);
  if(next){next.classList.add('active');next.classList.remove('slide-left');}
}

function goBack(){
  if(!navHistory.length)return;
  const prev=navHistory.pop();
  const screens=document.querySelectorAll('.screen');
  const current=[...screens].find(s=>s.classList.contains('active'));
  if(current){current.classList.remove('active');}
  const prevEl=document.getElementById(prev);
  if(prevEl){prevEl.classList.remove('slide-left');prevEl.classList.add('active');}
}

function mostrarLogin(){
  document.getElementById('screen-home').style.transform='translateX(100%)';
  navHistory.length=0;
  document.querySelectorAll('.screen').forEach(s=>{
    s.classList.remove('active','slide-left');
    s.style.transform='';
  });
  const login=document.getElementById('screen-login');
  login.classList.add('active');
  const emailEl=document.getElementById('login-email');
  const senhaEl=document.getElementById('login-senha');
  if(emailEl)emailEl.value='';
  if(senhaEl)senhaEl.value='';
  document.getElementById('login-error').textContent='';
}

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const senha=document.getElementById('login-senha').value;
  const errEl=document.getElementById('login-error');
  const btn=document.getElementById('btn-login');
  errEl.textContent='';
  btn.disabled=true;
  btn.textContent='Entrando...';
  try{
    const res=await api('POST','/auth/login',{email,senha});
    if(!res)return;
    token=res.token;
    currentUser=res.usuario||res.user||res;
    localStorage.setItem('pf_mobile_token',token);
    didLogout=false;
    initHome();
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active','slide-left'));
    const home=document.getElementById('screen-home');
    home.style.transform='translateX(0)';
    home.classList.add('active');
  }catch(e){
    errEl.textContent=e.message;
  }finally{
    btn.disabled=false;
    btn.textContent='Entrar';
  }
}

function doLogout(){
  localStorage.removeItem('pf_mobile_token');
  token=null;
  currentUser=null;
  didLogout=true;
  mostrarLogin();
}

async function initHome(){
  const nome=currentUser?.nome||currentUser?.name||currentUser?.username||currentUser?.email||'Usuário';
  const primeiroNome=nome.includes('@')?nome.split('@')[0]:nome.split(' ')[0];
  document.getElementById('home-name').textContent=primeiroNome;
  document.getElementById('home-cargo').textContent=currentUser?.cargo||currentUser?.role||currentUser?.perfil||'';
  loadRecentes();
}

async function loadRecentes(){
  const el=document.getElementById('recentes-list');
  el.innerHTML='<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try{
    const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),8000));
    const [movs,orcs]=await Promise.race([
      Promise.allSettled([
        api('GET','/movimentacoes?status=SOLICITADA'),
        api('GET','/orcamentos?status=ABERTO')
      ]),
      timeout
    ]);
    const movsData=movs?.status==='fulfilled'?(movs.value||[]):[];
    const orcsData=orcs?.status==='fulfilled'?(orcs.value||[]):[];
    const items=[
      ...movsData.slice(0,3).map(m=>({
        tipo:'compra',
        titulo:m.peca_nome||m.peca_codigo||m.descricao||`Pedido #${m.id||''}`,
        meta:`Qtd: ${m.qtd||m.quantidade||1} · ${fmtDate(m.created_at||m.criado_em)}`,
        status:'aberto'
      })),
      ...orcsData.slice(0,3).map(o=>({
        tipo:'orc',
        titulo:`Orç. ${o.numero||o.id||''}`,
        meta:`${o.cliente||'—'} · ${fmtDate(o.created_at||o.criado_em)}`,
        status:'aberto'
      }))
    ].slice(0,5);
    if(!items.length){
      el.innerHTML='<div class="empty"><span class="empty-icon">📋</span>Nenhuma atividade recente</div>';
      return;
    }
    el.innerHTML=items.map(i=>`
      <div class="recent-item">
        <div class="recent-icon ${i.tipo}">${i.tipo==='compra'?'🛒':'📄'}</div>
        <div class="recent-body">
          <div class="recent-title">${i.titulo}</div>
          <div class="recent-meta">${i.meta}</div>
        </div>
        <span class="status-pill status-${i.status}">${i.status.toUpperCase()}</span>
      </div>`).join('');
  }catch(e){
    el.innerHTML='<div class="empty"><span class="empty-icon">📋</span>Nenhuma atividade recente</div>';
  }
}

let pedidoPeca=null;
function abrirSolicitacao(){
  pedidoPeca=null;
  document.getElementById('pedido-peca-sel').style.display='none';
  document.getElementById('pedido-busca-wrap').style.display='block';
  document.getElementById('pedido-qtd').value='1';
  document.getElementById('pedido-equip').value='';
  document.getElementById('pedido-obs').value='';
  document.getElementById('pedido-busca').value='';
  document.getElementById('pedido-resultados').innerHTML='';
  showScreen('screen-solicitacao');
}

let buscaTimer=null;
async function buscarPecasSolicitacao(q){
  clearTimeout(buscaTimer);
  if(!q||q.length<2){document.getElementById('pedido-resultados').innerHTML='';return;}
  buscaTimer=setTimeout(async()=>{
    const el=document.getElementById('pedido-resultados');
    el.innerHTML='<div class="loading"><div class="spinner"></div></div>';
    try{
      const pecas=await api('GET',`/pecas?q=${encodeURIComponent(q)}`);
      if(!pecas?.length){el.innerHTML='<div class="empty">Nenhuma peça encontrada</div>';return;}
      el.innerHTML=pecas.slice(0,20).map(p=>`
        <div class="peca-card" onclick="selecionarPecaPedido('${p.id}','${(p.codigo||'').replace(/'/g,"\\'")}','${(p.nome||'').replace(/'/g,"\\'")}','${p.unidade||'UN'}',${p.custo||0})">
          <div class="peca-codigo">${p.codigo||p.id}</div>
          <div class="peca-nome">${p.nome}</div>
          <div class="peca-tags">
            ${p.fonte?`<span class="tag fonte">${p.fonte}</span>`:''}
            <span class="tag">${p.unidade||'UN'}</span>
            ${p.custo?`<span class="tag">${fmt(p.custo)}</span>`:''}
          </div>
        </div>`).join('');
    }catch(e){el.innerHTML='<div class="empty">Erro na busca</div>';}
  },400);
}

function selecionarPecaPedido(id,codigo,nome,unidade,custo){
  pedidoPeca={id,codigo,nome,unidade,custo};
  document.getElementById('pedido-busca-wrap').style.display='none';
  document.getElementById('pedido-resultados').innerHTML='';
  const sel=document.getElementById('pedido-peca-sel');
  sel.style.display='block';
  sel.querySelector('.selected-peca-codigo').textContent=codigo;
  sel.querySelector('.selected-peca-nome').textContent=nome;
}

function alterarPecaSolicitacao(){
  pedidoPeca=null;
  document.getElementById('pedido-peca-sel').style.display='none';
  document.getElementById('pedido-busca-wrap').style.display='block';
  document.getElementById('pedido-busca').value='';
  document.getElementById('pedido-resultados').innerHTML='';
}

function solicitacaoQty(delta){
  const inp=document.getElementById('pedido-qtd');
  inp.value=Math.max(1,parseInt(inp.value||'1')+delta);
}

async function enviarSolicitacao(){
  if(!pedidoPeca){toast('Selecione uma peça','error');return;}
  const qtd=parseInt(document.getElementById('pedido-qtd').value)||1;
  const equip=document.getElementById('pedido-equip').value.trim();
  const obs=document.getElementById('pedido-obs').value.trim();
  const btn=document.getElementById('btn-enviar-pedido');
  btn.disabled=true;btn.textContent='Enviando...';
  try{
    await api('POST','/movimentacoes',{
      peca_id:pedidoPeca.id,
      peca_codigo:pedidoPeca.codigo,
      peca_nome:pedidoPeca.nome,
      peca_unidade:pedidoPeca.unidade,
      peca_custo:pedidoPeca.custo,
      qtd,equip_serie:equip,
      tecnico:currentUser?.nome||currentUser?.name||'',
      obs
    });
    toast('Pedido enviado!','success');
    setTimeout(()=>{goBack();loadRecentes();},1000);
  }catch(e){
    toast(e.message,'error');
  }finally{
    btn.disabled=false;btn.textContent='🛒 Enviar Solicitação';
  }
}

let orcItens=[];
let orcPecaTemp=null;

function abrirOrcamento(){
  orcItens=[];orcPecaTemp=null;
  document.getElementById('orc-cliente').value='';
  document.getElementById('orc-equip').value='';
  document.getElementById('orc-obs').value='';
  renderOrcItens();
  showScreen('screen-orc');
}

function abrirBuscaOrc(){
  document.getElementById('orc-item-busca').value='';
  document.getElementById('orc-item-resultados').innerHTML='';
  document.getElementById('orc-item-qtd').value='1';
  document.getElementById('orc-item-valor').value='';
  document.getElementById('orc-item-sel').style.display='none';
  document.getElementById('orc-item-busca-wrap').style.display='block';
  orcPecaTemp=null;
  showScreen('screen-orc-item');
}

let buscaOrcTimer=null;
async function buscarPecasOrc(q){
  clearTimeout(buscaOrcTimer);
  if(!q||q.length<2){document.getElementById('orc-item-resultados').innerHTML='';return;}
  buscaOrcTimer=setTimeout(async()=>{
    const el=document.getElementById('orc-item-resultados');
    el.innerHTML='<div class="loading"><div class="spinner"></div></div>';
    try{
      const pecas=await api('GET',`/pecas?q=${encodeURIComponent(q)}`);
      if(!pecas?.length){el.innerHTML='<div class="empty">Nenhuma peça encontrada</div>';return;}
      el.innerHTML=pecas.slice(0,20).map(p=>`
        <div class="peca-card" onclick="selecionarPecaOrc('${p.id}','${(p.codigo||'').replace(/'/g,"\\'")}','${(p.nome||'').replace(/'/g,"\\'")}','${p.unidade||'UN'}',${p.valor_venda||p.custo||0})">
          <div class="peca-codigo">${p.codigo||p.id}</div>
          <div class="peca-nome">${p.nome}</div>
          <div class="peca-tags">
            ${p.fonte?`<span class="tag fonte">${p.fonte}</span>`:''}
            <span class="tag">${p.unidade||'UN'}</span>
            ${p.valor_venda?`<span class="tag">${fmt(p.valor_venda)}</span>`:''}
          </div>
        </div>`).join('');
    }catch(e){el.innerHTML='<div class="empty">Erro na busca</div>';}
  },400);
}

function selecionarPecaOrc(id,codigo,nome,unidade,valor){
  orcPecaTemp={id,codigo,nome,unidade,valor};
  document.getElementById('orc-item-busca-wrap').style.display='none';
  document.getElementById('orc-item-resultados').innerHTML='';
  const sel=document.getElementById('orc-item-sel');
  sel.style.display='block';
  sel.querySelector('.selected-peca-codigo').textContent=codigo;
  sel.querySelector('.selected-peca-nome').textContent=nome;
  document.getElementById('orc-item-valor').value=valor||'';
}

function alterarPecaOrc(){
  orcPecaTemp=null;
  document.getElementById('orc-item-sel').style.display='none';
  document.getElementById('orc-item-busca-wrap').style.display='block';
  document.getElementById('orc-item-busca').value='';
  document.getElementById('orc-item-resultados').innerHTML='';
}

function orcItemQty(delta){
  const inp=document.getElementById('orc-item-qtd');
  inp.value=Math.max(1,parseInt(inp.value||'1')+delta);
}

function adicionarItemOrc(){
  if(!orcPecaTemp){
    const desc=document.getElementById('orc-item-busca').value.trim();
    if(!desc){toast('Selecione uma peça ou digite uma descrição','error');return;}
    orcPecaTemp={id:'',codigo:'',nome:desc,unidade:'UN',valor:0};
  }
  const qtd=parseInt(document.getElementById('orc-item-qtd').value)||1;
  const valor=parseFloat(document.getElementById('orc-item-valor').value)||0;
  orcItens.push({...orcPecaTemp,qtd,valor});
  toast('Item adicionado');
  goBack();
  renderOrcItens();
}

function removerItemOrc(idx){orcItens.splice(idx,1);renderOrcItens();}

function renderOrcItens(){
  const el=document.getElementById('orc-itens-list');
  const total=orcItens.reduce((s,i)=>s+i.qtd*i.valor,0);
  document.getElementById('orc-total').textContent=fmt(total);
  if(!orcItens.length){
    el.innerHTML='<div class="empty"><span class="empty-icon">📦</span>Nenhum item adicionado</div>';
    return;
  }
  el.innerHTML=orcItens.map((i,idx)=>`
    <div class="item-row">
      <div class="item-info">
        ${i.codigo?`<div class="item-codigo">${i.codigo}</div>`:''}
        <div class="item-nome">${i.nome}</div>
        <div class="item-preco">${i.qtd}x ${fmt(i.valor)} = ${fmt(i.qtd*i.valor)}</div>
      </div>
      <button class="btn-remove" onclick="removerItemOrc(${idx})">×</button>
    </div>`).join('');
}

async function enviarOrcamento(){
  if(!orcItens.length){toast('Adicione pelo menos um item','error');return;}
  const cliente=document.getElementById('orc-cliente').value.trim();
  const equip=document.getElementById('orc-equip').value.trim();
  const obs=document.getElementById('orc-obs').value.trim();
  const btn=document.getElementById('btn-enviar-orc');
  btn.disabled=true;btn.textContent='Salvando...';
  try{
    // Busca proximo numero O-XXX
    const orcsExist = await api('GET','/orcamentos');
    const nums = (orcsExist||[])
      .map(o=>o.numero||'')
      .filter(n=>n.startsWith('O-'))
      .map(n=>parseInt(n.replace('O-',''))||0);
    const proxOrc = nums.length ? Math.max(...nums)+1 : 1;
    const numero = 'O-' + String(proxOrc).padStart(3,'0');
    const total=orcItens.reduce((s,i)=>s+i.qtd*i.valor,0);
    await api('POST','/orcamentos',{
      numero,total,status:'ABERTO',cliente,equip_serie:equip,obs,
      assinatura:currentUser?.nome||currentUser?.name||'',
      itens:orcItens.map(i=>({cod:i.codigo||i.nome,desc:i.nome,qtd:i.qtd,valor:i.valor,custoUnit:i.custo||0}))
    });
    toast('Orçamento enviado!','success');
    setTimeout(()=>{goBack();loadRecentes();},1000);
  }catch(e){
    toast(e.message,'error');
  }finally{
    btn.disabled=false;btn.textContent='📄 Enviar Orçamento';
  }
}

async function autoLogin(){
  if(didLogout)return;
  const t=localStorage.getItem('pf_mobile_token');
  if(!t)return;
  try{
    const r=await fetch(API_BASE+'/auth/me',{headers:{Authorization:`Bearer ${t}`}});
    if(!r.ok)throw new Error('token inválido');
    const d=await r.json();
    if(didLogout)return;
    currentUser=d.usuario||d.user||(d.id?d:null);
    if(currentUser){
      token=t;
      initHome();
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active','slide-left'));
      const home=document.getElementById('screen-home');
      home.style.transform='translateX(0)';
      home.classList.add('active');
      return;
    }
  }catch(e){}
  if(!didLogout)mostrarLogin();
}

document.addEventListener('DOMContentLoaded',()=>{
  if('serviceWorker'in navigator){
    navigator.serviceWorker.register('/mobile/sw.js').catch(()=>{});
  }
  document.getElementById('login-senha').addEventListener('keydown',e=>{
    if(e.key==='Enter')doLogin();
  });
  const t=localStorage.getItem('pf_mobile_token');
  if(t){
    autoLogin();
  }
});

let movPecaSel = null;
function abrirMovimentacao() {
  movPecaSel = null;
  document.getElementById('mov-busca').value = '';
  document.getElementById('mov-resultados').innerHTML = '';
  document.getElementById('mov-busca-wrap').style.display = '';
  document.getElementById('mov-peca-sel').style.display = 'none';
  document.getElementById('mov-qtd').value = '1';
  document.getElementById('mov-equip').value = '';
  document.getElementById('mov-tecnico').value = currentUser ? currentUser.nome : '';
  document.getElementById('mov-obs').value = '';
  showScreen('screen-mov');
}
let buscaMovTimer;
async function buscarPecasMov(q) {
  clearTimeout(buscaMovTimer);
  const el = document.getElementById('mov-resultados');
  if (!q || q.length < 2) { el.innerHTML = ''; return; }
  buscaMovTimer = setTimeout(async()=>{
    el.innerHTML='<div class="loading"><div class="spinner"></div></div>';
    try {
      const pecas = await api('GET', '/pecas?q='+encodeURIComponent(q));
      if (!pecas||!pecas.length) { el.innerHTML='<div class="empty">Nenhuma peca encontrada</div>'; return; }
      el.innerHTML = pecas.slice(0,20).map(p=>
        '<div class="peca-card" onclick="selecionarPecaMov(\''+p.id+'\',\''+((p.codigo||'').replace(/'/g,"\\'"))+'\',\''+((p.nome||'').replace(/'/g,"\\'"))+'\',\''+( p.unidade||'UN')+'\','+( p.custo||0)+')">'+
        '<div class="peca-codigo">'+(p.codigo||p.id)+'</div>'+
        '<div class="peca-nome">'+(p.nome||'')+'</div>'+
        '<div class="peca-tags">'+(p.fonte?'<span class="tag fonte">'+p.fonte+'</span>':'')+'<span class="tag">'+(p.unidade||'UN')+'</span></div>'+
        '</div>'
      ).join('');
    } catch(e) { el.innerHTML='<div class="empty">Erro na busca</div>'; }
  }, 400);
}
function selecionarPecaMov(id,codigo,nome,unidade,custo) {
  movPecaSel = {id,codigo,nome,unidade:unidade||'UN',custo:custo||0};
  document.getElementById('mov-busca-wrap').style.display = 'none';
  const sel = document.getElementById('mov-peca-sel');
  sel.style.display = '';
  sel.querySelector('.selected-peca-codigo').textContent = codigo || '';
  sel.querySelector('.selected-peca-nome').textContent = nome || '';
}
function alterarPecaMov() {
  movPecaSel = null;
  document.getElementById('mov-busca-wrap').style.display = '';
  document.getElementById('mov-peca-sel').style.display = 'none';
  document.getElementById('mov-busca').value = '';
  document.getElementById('mov-resultados').innerHTML = '';
}
function movQty(d) {
  const el = document.getElementById('mov-qtd');
  el.value = Math.max(1, (parseInt(el.value)||1) + d);
}
async function enviarMovimentacao() {
  if (!movPecaSel) { toast('Selecione uma peca', 'error'); return; }
  const qtd = parseInt(document.getElementById('mov-qtd').value)||1;
  const serie = document.getElementById('mov-equip').value.trim();
  const chamado = document.getElementById('mov-chamado') ? document.getElementById('mov-chamado').value.trim() : '';
  const tecnico = document.getElementById('mov-tecnico').value.trim();
  const email = document.getElementById('mov-email') ? document.getElementById('mov-email').value.trim() : '';
  if (!serie) { toast('Informe o numero de serie', 'error'); return; }
  if (!chamado) { toast('Informe o numero do chamado', 'error'); return; }
  if (!tecnico) { toast('Informe o tecnico solicitante', 'error'); return; }
  if (!email) { toast('Informe o e-mail do tecnico', 'error'); return; }
  // Busca proximo numero P-XXX
  let proxNum = 'P-001';
  try {
    const movsExist = await api('GET','/movimentacoes');
    const pNums = (movsExist||[])
      .map(m=>m.obs_num||m.peca_num||'')
      .filter(n=>n.startsWith('P-'))
      .map(n=>parseInt(n.replace('P-',''))||0);
    const seqNums = (movsExist||[])
      .map(m=>m.seq_num||m.seqNum||0);
    const proxSeq = seqNums.length ? Math.max(...seqNums)+1 : 1;
    proxNum = 'P-' + String(proxSeq).padStart(3,'0');
  } catch(e){}
  const btn = document.getElementById('btn-enviar-mov');
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const body = {
      peca_id: movPecaSel.id,
      peca_codigo: movPecaSel.codigo,
      peca_nome: movPecaSel.nome,
      peca_unidade: movPecaSel.unidade || 'UN',
      qtd,
      equip_serie: serie,
      tecnico,
      tecnico_email: email,
      chamado,
      obs: document.getElementById('mov-obs').value.trim(),
      origem: 'mobile'
    };
    const r = await fetch('/api/movimentacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error('Erro ao enviar');
    toast('Movimentacao enviada!', 'success');
    btn.disabled = false; btn.textContent = 'Enviar Movimentacao';
    goBack();
  } catch(e) {
    toast('Erro: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'Enviar Movimentacao';
  }
}

// ============================================================
// MINHAS SOLICITAÇÕES
// ============================================================
let minhasSolAtual = null;

async function abrirMinhasSolicitacoes() {
  showScreen('screen-minhas');
  const el = document.getElementById('minhas-list');
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try {
    const movs = await api('GET', '/movimentacoes');
    const minhas = (movs || []).filter(m =>
      m.tecnico && currentUser &&
      m.tecnico.toLowerCase() === (currentUser.nome || '').toLowerCase()
    );
    if (!minhas.length) {
      el.innerHTML = '<div class="empty"><span class="empty-icon">📋</span>Nenhuma solicitação encontrada</div>';
      return;
    }
    const statusColor = {
      'SOLICITADA': '#f39c12', 'ENVIADA': '#3498db', 'COMPRA_PENDENTE': '#e67e22',
      'DESPACHADA': '#9b59b6', 'RECEBIDA': '#1abc9c', 'ALOCADA': '#27ae60',
      'FINALIZADO': '#95a5a6', 'CANCELADA': '#e74c3c'
    };
    el.innerHTML = minhas.map(m => {
      const cor = statusColor[m.status] || '#888';
      const podeConfirmar = m.status === 'DESPACHADA' && m.tipo_alocacao !== 'RETORNO';
      return '<div class="sol-card" style="margin-bottom:12px">' +
        '<div style="flex-shrink:0;text-align:center;min-width:80px">' +
          '<div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--accent)">' + (m.tipo_alocacao==='RETORNO'&&m.obs&&String(m.obs).startsWith('REF:') ? '#'+String(m.obs).split('|')[0].replace('REF:','')+' <span style="color:var(--red);font-size:10px">↩R</span>' : '#'+(m.numSeq||m.seqNum||'—')) + '</div>' +
          '<span style="background:' + cor + ';color:#fff;font-size:10px;padding:2px 8px;border-radius:10px;display:inline-block;margin-top:4px">' + (m.status || '—') + '</span>' +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-family:var(--mono);font-size:11px;color:var(--accent)">' + (m.pecaCodigo || '—') + '</div>' +
          '<div style="font-size:13px;font-weight:600;color:var(--text)">' + (m.pecaNome || '—') + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">Qtd: ' + (m.qtd || 1) + ' · S/N: ' + (m.equipSerie || '—') + '</div>' +
          (m.tipo_alocacao==='RETORNO'?'<div style="font-size:11px;color:var(--red);font-weight:600">↩ DEVOLUÇÃO SOLICITADA</div>':'') +(m.transportadora ? '<div style="font-size:11px;color:var(--text3)">📦 ' + m.transportadora + (m.rastreio ? ' · ' + m.rastreio : '') + '</div>' : '') +
          (m.dataRecebimento ? '<div style="font-size:11px;color:#1abc9c">✓ Recebido: ' + m.dataRecebimento + '</div>' : '') +
        '</div>' +
        (podeConfirmar ? '<div style="flex-shrink:0"><button class="btn-primary" style="font-size:12px;padding:8px 12px" onclick="abrirConfirmarRecebimento(\'' + m.id + '\')">✓ Recebi</button></div>' : '') +(m.tipo_alocacao==='RETORNO'&&m.status==='SOLICITADA'?'<div style="flex-shrink:0"><button class="btn-primary" style="font-size:12px;padding:8px 12px;background:var(--red)" onclick="despacharRetorno(\'' + m.id + '\')" >↩ Despachar Devolução</button></div>':'')+
      '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty"><span class="empty-icon">⚠</span>Erro ao carregar</div>';
  }
}

function abrirConfirmarRecebimento(id) {
  minhasSolAtual = id;
  document.getElementById('conf-obs').value = '';
  document.getElementById('conf-defeituosa').checked = false;
  document.getElementById('conf-devolucao-section').style.display = 'none';
  document.getElementById('conf-motivo') && (document.getElementById('conf-motivo').value = '');
  // Busca dados da solicitacao
  api('GET', '/movimentacoes').then(movs => {
    const m = (movs || []).find(x => x.id === id);
    if (m) {
      document.getElementById('conf-peca-codigo').textContent = m.pecaCodigo || '';
      document.getElementById('conf-peca-nome').textContent = m.pecaNome || '';
    }
  });
  document.getElementById('conf-defeituosa').onchange = function() {
    document.getElementById('conf-devolucao-section').style.display = this.checked ? 'block' : 'none';
  };
  showScreen('screen-confirmar-recebimento');
}

async function confirmarRecebimento() {
  const btn = document.getElementById('btn-confirmar-receb');
  const obs = document.getElementById('conf-obs').value.trim();
  const defeituosa = document.getElementById('conf-defeituosa').checked;
  const motivo = defeituosa ? (document.getElementById('conf-motivo') ? document.getElementById('conf-motivo').value.trim() : '') : '';
  if (defeituosa && !motivo) { toast('Informe o motivo da devolução', 'error'); return; }
  btn.disabled = true; btn.textContent = 'Enviando...';
  try {
    const _now=new Date();
    const _data=_now.toLocaleDateString('pt-BR');
    const _hora=_now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    await api('PUT', '/movimentacoes/' + minhasSolAtual + '/acao', {
      acao: 'RECEBER',
      data_recebimento: _data,
      hora_recebimento: _hora,
      obs: obs || (defeituosa ? 'Peça recebida com defeito: ' + motivo : 'Peça recebida pelo técnico via mobile'),
      tecnico_confirmou: true,
      devolucao: defeituosa,
      motivo_devolucao: motivo
    });
    toast(defeituosa ? 'Recebimento confirmado. Devolução registrada!' : 'Recebimento confirmado!', 'success');
    btn.disabled = false;
    btn.textContent = '✓ Confirmar Recebimento';
    setTimeout(() => { goBack(); abrirMinhasSolicitacoes(); }, 1500);
  } catch(e) {
    toast('Erro: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = '✓ Confirmar Recebimento';
  }
}

async function despacharRetorno(id) {
  if (!confirm('Confirmar despacho da peça defeituosa de volta ao almoxarifado?')) return;
  try {
    const now = new Date();
    const data = now.toLocaleDateString('pt-BR');
    const hora = now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    await api('PUT', '/movimentacoes/' + id + '/acao', {
      acao: 'DESPACHAR',
      transporte: 'Motoboy',
      obs: 'Peça devolvida pelo técnico via mobile em ' + data + ' às ' + hora
    });
    toast('Devolução despachada com sucesso!', 'success');
    setTimeout(()=>abrirMinhasSolicitacoes(), 1500);
  } catch(e) {
    toast('Erro: ' + e.message, 'error');
  }
}

// ============================================================
// NOTIFICACOES - POLLING MOBILE
// ============================================================
let mobileNotifTs = Date.now();
let mobileNotifTimer = null;
let mobileNotifMap = {};

function iniciarPollingMobile() {
  if(mobileNotifTimer) clearInterval(mobileNotifTimer);
  mobileNotifTimer = setInterval(verificarNotificacoesMobile, 30000);
}

async function verificarNotificacoesMobile() {
  try {
    const r = await fetch('/api/notificacoes?desde=' + (mobileNotifTs - 5000), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await r.json();
    mobileNotifTs = data.timestamp || Date.now();

    const movs = (data.movimentacoes||[]).filter(m =>
      m.tecnico && currentUser && m.tecnico.toLowerCase() === (currentUser.nome||'').toLowerCase()
    );

    movs.forEach(m => {
      const key = 'mob-' + m.id + '-' + m.status;
      if(!mobileNotifMap[key]) {
        mobileNotifMap[key] = true;
        const msgs = {
          'ENVIADA': 'Sua solicitacao foi enviada para despacho!',
          'DESPACHADA': 'Sua peca foi despachada! Aguarde a entrega.',
          'RECEBIDA': 'Recebimento confirmado.',
          'ALOCADA': 'Peca alocada com sucesso!',
          'FINALIZADO': 'Processo finalizado!',
          'CANCELADA': 'Solicitacao cancelada.',
        };
        const msg = msgs[m.status];
        if(msg) toast(msg, m.status==='CANCELADA'?'error':'success');
      }
    });
  } catch(e) {}
}

// Inicia apos login
function iniciarNotificacoesMobile() {
  mobileNotifTs = Date.now();
  mobileNotifMap = {};
  iniciarPollingMobile();
}
