/**
 * seed-catalogs.js
 * Run once to import all part catalogs into the database.
 * Usage: node server/seed-catalogs.js
 */
const db = require('./database');
const path = require('path');
const fs = require('fs');

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// Check if catalogs already seeded
const count = db.prepare('SELECT COUNT(*) as n FROM pecas').get().n;
if (count > 100) {
  console.log(`✅ Catálogos já importados (${count} peças). Pulando.`);
  process.exit(0);
}

// Load the catalog data from the original HTML file
const htmlPath = process.env.CATALOG_HTML || path.join(__dirname, '../gestao-pecas.html');
if (!fs.existsSync(htmlPath)) {
  console.log('⚠️  gestao-pecas.html não encontrado. Coloque o arquivo original na pasta raiz do projeto.');
  console.log('   Ou rode o restore de backup via /api/restore');
  process.exit(0);
}

console.log('📦 Importando catálogos de peças...');

const html = fs.readFileSync(htmlPath, 'utf-8');

// Extract catalog JS
const catMatch = html.match(/const PARTS_CATALOG\s*=[\s\S]*?(?=\/\/ ={10})/);
if (!catMatch) {
  console.log('⚠️  Catálogos não encontrados no HTML.');
  process.exit(0);
}

// Evaluate catalog in a sandbox
const { VM } = require('vm');
const vm = new VM ? new VM({ sandbox: {} }) : null;

// Use node's vm module directly
const nodeVm = require('vm');
const sandbox = {};
try {
  // Execute catalog definitions
  const catalogCode = catMatch[0];
  nodeVm.runInNewContext(catalogCode + `
    module.exports = {
      PARTS_CATALOG: typeof PARTS_CATALOG !== 'undefined' ? PARTS_CATALOG : [],
      DYMIND_NEW_CATALOG: typeof DYMIND_NEW_CATALOG !== 'undefined' ? DYMIND_NEW_CATALOG : [],
      RAYTO_CATALOG: typeof RAYTO_CATALOG !== 'undefined' ? RAYTO_CATALOG : [],
      IMPORTAR1_CATALOG: typeof IMPORTAR1_CATALOG !== 'undefined' ? IMPORTAR1_CATALOG : [],
      SENSACORE_CATALOG: typeof SENSACORE_CATALOG !== 'undefined' ? SENSACORE_CATALOG : [],
      BIOBASE_CATALOG: typeof BIOBASE_CATALOG !== 'undefined' ? BIOBASE_CATALOG : [],
    };
  `, { module: sandbox });
} catch(e) {
  console.error('Erro ao parsear catálogos:', e.message);
  process.exit(1);
}

const catalogs = sandbox.exports || {};
const allPecas = [
  ...(catalogs.PARTS_CATALOG || []).map(p => ({ ...p, fonte: p.fonte || 'DYMIND', linha: p.linha || 'DP-C16' })),
  ...(catalogs.DYMIND_NEW_CATALOG || []),
  ...(catalogs.RAYTO_CATALOG || []),
  ...(catalogs.IMPORTAR1_CATALOG || []),
  ...(catalogs.SENSACORE_CATALOG || []),
  ...(catalogs.BIOBASE_CATALOG || []),
];

console.log(`📋 Total de peças nos catálogos: ${allPecas.length}`);

const stmt = db.prepare(`
  INSERT OR IGNORE INTO pecas(id,codigo,nome,unidade,grupo,fonte,linha,minimo,taxa,dolar,markup,custo,valor_venda)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const insertAll = db.transaction((pecas) => {
  let inserted = 0;
  for (const p of pecas) {
    if (!p.nome) continue;
    stmt.run(
      p.id || uid(),
      p.codigo || p.id || '',
      p.nome || '',
      p.unidade || p.und || 'UN',
      p.grupo || '',
      p.fonte || '',
      p.linha || '',
      p.minimo || 0,
      p.taxa || 0,
      p.dolar || 0,
      p.markup || 0,
      p.custo || 0,
      p.valor_venda || p.valorVenda || 0
    );
    inserted++;
  }
  return inserted;
});

const inserted = insertAll(allPecas);
console.log(`✅ ${inserted} peças importadas com sucesso!`);

// Also seed equipamentos if available
const equipMatch = html.match(/const EQUIPAMENTOS_CATALOG\s*=\s*(\[[\s\S]*?\n\];)/);
if (equipMatch) {
  const eqSandbox = {};
  try {
    nodeVm.runInNewContext(`const EQUIPAMENTOS_CATALOG = ${equipMatch[1]}; module.exports = EQUIPAMENTOS_CATALOG;`, { module: eqSandbox });
    const equips = eqSandbox.exports || [];
    const eqStmt = db.prepare(`INSERT OR IGNORE INTO equipamentos(id,modelo,marca,serie,linha,cliente,local,contrato,obs,campos) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const insertEquips = db.transaction((list) => {
      for (const e of list) {
        if (!e.modelo) continue;
        eqStmt.run(e.id||uid(), e.modelo||'', e.marca||'', e.serie||'', e.linha||'', e.cliente||'', e.local||e.endereco||'', e.contrato||'', e.obs||'', JSON.stringify({}));
      }
    });
    insertEquips(equips);
    console.log(`✅ ${equips.length} equipamentos importados!`);
  } catch(e) {
    console.log('Equipamentos: erro ao parsear -', e.message);
  }
}

console.log('\n🚀 Seed concluído! Você pode iniciar o servidor com: npm start\n');
