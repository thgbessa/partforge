const API_BASE='/api';
let currentUser=null;
let navHistory=[];
let token=localStorage.getItem('pf_mobile_token');
// FLAG: impede autoLogin após logout
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
    showScreen('screen-home',false);
  }catch(e){
    errEl.textContent=e.message;
  }finally{
    btn.disabled=false;
    btn.textContent='Entrar';
  }
}

function doLogout(){
  // Remove token PRIMEIRO antes de qualquer outra coisa
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
function abrirPedido(){
  pedidoPeca=null;
  document.getElementById('pedido-peca-sel').style.display='none';
  document.getElementById('pedido-busca-wrap').style.display='block';
  document.getElementById('pedido-qtd').value='1';
  document.getElementById('pedido-equip').value='';
  document.getElementById('pedido-obs').value='';
  document.getElementById('pedido-busca').value='';
  document.getElementById('pedido-resultados').innerHTML='';
  showScreen('screen-pedido');
}

let buscaTimer=null;
async function buscarPecasPedido(q){
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

function alterarPecaPedido(){
  pedidoPeca=null;
  document.getElementById('pedido-peca-sel').style.display='none';
  document.getElementById('pedido-busca-wrap').style.display='block';
  document.getElementById('pedido-busca').value='';
  document.getElementById('pedido-resultados').innerHTML='';
}

function pedidoQty(delta){
  const inp=document.getElementById('pedido-qtd');
  inp.value=Math.max(1,parseInt(inp.value||'1')+delta);
}

async function enviarPedido(){
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
    btn.disabled=false;btn.textContent='🛒 Enviar Pedido';
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
    const numero='M-'+Date.now().toString(36).toUpperCase();
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
  // Não faz autoLogin se acabou de fazer logout
  if(didLogout)return;
  const t=localStorage.getItem('pf_mobile_token');
  if(!t)return;
  try{
    const r=await fetch(API_BASE+'/auth/me',{headers:{Authorization:`Bearer ${t}`}});
    if(!r.ok)throw new Error('token inválido');
    const d=await r.json();
    // Se fez logout durante a requisição, ignora
    if(didLogout)return;
    currentUser=d.usuario||d.user||(d.id?d:null);
    if(currentUser){
      token=t;
      initHome();
      showScreen('screen-home',false);
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
