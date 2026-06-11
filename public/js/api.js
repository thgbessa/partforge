// ============================================================
//  PARTFORGE v2.0 — API CLIENT
//  Substitui localStorage por chamadas REST ao servidor
// ============================================================

const API = (() => {
  const BASE = '/api';

  function getToken() { return localStorage.getItem('pf_token'); }
  function setToken(t) { localStorage.setItem('pf_token', t); }
  function clearToken() { localStorage.removeItem('pf_token'); }

  async function req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const token = getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      clearToken();
      location.reload();
      return;
    }
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  return {
    getToken, setToken, clearToken,
    get:    (p)       => req('GET',    p),
    post:   (p, b)    => req('POST',   p, b),
    put:    (p, b)    => req('PUT',    p, b),
    delete: (p)       => req('DELETE', p),

    // Auth
    login:  (email, senha) => req('POST', '/auth/login', { email, senha }),
    me:     ()             => req('GET',  '/auth/me'),

    // Shortcuts
    pecas:         (q)   => req('GET', '/pecas' + (q ? `?q=${encodeURIComponent(q)}` : '')),
    equipamentos:  (q)   => req('GET', '/equipamentos' + (q ? `?q=${encodeURIComponent(q)}` : '')),
    estoque:       ()    => req('GET', '/estoque'),
    movimentacoes: (p)   => req('GET', '/movimentacoes' + (p ? '?' + new URLSearchParams(p) : '')),
    orcamentos:    (p)   => req('GET', '/orcamentos' + (p ? '?' + new URLSearchParams(p) : '')),
    pedidos:       (p)   => req('GET', '/pedidos' + (p ? '?' + new URLSearchParams(p) : '')),
    doadoras:      ()    => req('GET', '/doadoras'),
    retiradas:     (p)   => req('GET', '/retiradas' + (p ? '?' + new URLSearchParams(p) : '')),
    dashboard:     ()    => req('GET', '/dashboard'),
    usuarios:      ()    => req('GET', '/usuarios'),
    config:        (k)   => req('GET', `/config/${k}`),
  };
})();
