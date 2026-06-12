/**
 * import-catalog.js
 * Importa o catalogo-pecas.json para o banco de dados
 * Rode via console do Railway: node /app/server/import-catalog.js
 */
const db   = require('./database');
const path = require('path');
const fs   = require('fs');

const catalogPath = path.join(__dirname, '../catalogo-pecas.json');

db.init().then(() => {
  if (!fs.existsSync(catalogPath)) {
    console.error('catalogo-pecas.json nao encontrado em', catalogPath);
    process.exit(1);
  }

  const { pecas } = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  console.log(`Importando ${pecas.length} pecas...`);

  let inseridas = 0;
  let atualizadas = 0;

  for (const p of pecas) {
    if (!p.nome) continue;
    const existe = db.get('SELECT id FROM pecas WHERE id=?', [p.id]);
    if (!existe) {
      db.run(
        'INSERT OR IGNORE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,imagem,taxa,dolar,markup,custo,valor_venda,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [p.id, p.codigo||'', p.nome, p.unidade||'UN', p.grupo||'', p.fonte||'',
         p.linha||'', p.minimo||0, '', p.taxa||0, p.dolar||0, p.markup||0,
         p.custo||0, p.valor_venda||0, Date.now()]
      );
      inseridas++;
    } else {
      // Atualiza preços se já existe
      db.run(
        'UPDATE pecas SET taxa=?,dolar=?,markup=?,custo=?,valor_venda=? WHERE id=?',
        [p.taxa||0, p.dolar||0, p.markup||0, p.custo||0, p.valor_venda||0, p.id]
      );
      atualizadas++;
    }
  }

  const total = db.get('SELECT COUNT(*) as n FROM pecas');
  console.log(`✅ Inseridas: ${inseridas} | Atualizadas: ${atualizadas} | Total no banco: ${total.n}`);
  process.exit(0);
}).catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
