const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');
const { init }    = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', credentials: true }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20, message: { erro: 'Muitas tentativas.' } }));
app.use('/api/', rateLimit({ windowMs: 60*1000, max: 500 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d' }));

init().then(async () => {
  const db = require('./database');
  const countPecas = db.get('SELECT COUNT(*) as n FROM pecas')?.n || 0;
  const htmlPath = path.join(__dirname, '../gestao-pecas.html');

  if (countPecas < 500 && fs.existsSync(htmlPath)) {
    console.log(`Importando catalogos (${countPecas} pecas no banco)...`);
    try {
      const html   = fs.readFileSync(htmlPath, 'utf-8');
      const nodeVm = require('vm');
      const catMatch = html.match(/const PARTS_CATALOG\s*=[\s\S]*?(?=\/\/ ={10})/);
      if (catMatch) {
        const sandbox = { module: { exports: {} } };
        nodeVm.runInNewContext(catMatch[0] + `
          module.exports = {
            PARTS_CATALOG:      typeof PARTS_CATALOG      !== 'undefined' ? PARTS_CATALOG      : [],
            DYMIND_NEW_CATALOG: typeof DYMIND_NEW_CATALOG !== 'undefined' ? DYMIND_NEW_CATALOG : [],
            RAYTO_CATALOG:      typeof RAYTO_CATALOG      !== 'undefined' ? RAYTO_CATALOG      : [],
            IMPORTAR1_CATALOG:  typeof IMPORTAR1_CATALOG  !== 'undefined' ? IMPORTAR1_CATALOG  : [],
            SENSACORE_CATALOG:  typeof SENSACORE_CATALOG  !== 'undefined' ? SENSACORE_CATALOG  : [],
            BIOBASE_CATALOG:    typeof BIOBASE_CATALOG    !== 'undefined' ? BIOBASE_CATALOG    : [],
          };
        `, sandbox);
        const cats = sandbox.module.exports;
        const allPecas = [
          ...(cats.PARTS_CATALOG      || []).map(p => ({ ...p, fonte: p.fonte || 'DYMIND', linha: p.linha || 'DP-C16' })),
          ...(cats.DYMIND_NEW_CATALOG || []),
          ...(cats.RAYTO_CATALOG      || []),
          ...(cats.IMPORTAR1_CATALOG  || []),
          ...(cats.SENSACORE_CATALOG  || []),
          ...(cats.BIOBASE_CATALOG    || []),
        ];
        let inserted = 0;
        for (const p of allPecas)
