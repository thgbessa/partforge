const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const path        = require('path');
const fs          = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d' }));

// Healthcheck responde IMEDIATAMENTE antes de qualquer coisa
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Sobe o servidor primeiro
app.listen(PORT, '0.0.0.0', () => {
  console.log('PartForge v2.0 porta ' + PORT);

  // Inicializa banco DEPOIS do servidor estar ouvindo
  const { init } = require('./database');
  init().then(() => {
    const db     = require('./database');
    const routes = require('./routes');
    app.use('/api', routes);
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
    console.log('Banco iniciado, rotas ativas');

    // Auto-import após tudo pronto
    const countP = db.get('SELECT COUNT(*) as n FROM pecas')?.n || 0;
    if (countP < 500) {
      console.log('Auto-import: ' + countP + ' pecas, baixando catalogo...');
      const https = require('https');
      const tmpFile = '/tmp/auto-imp.js';
      const file = fs.createWriteStream(tmpFile);
      https.get('https://raw.githubusercontent.com/thgbessa/partforge/main/import-pecas.js', res => {
        res.pipe(file);
        file.on('finish', () => {
          try { delete require.cache[tmpFile]; require(tmpFile); } catch(e) { console.log('Import err:', e.message); }
        });
      }).on('error', e => console.log('Download err:', e.message));
    }
  }).catch(err => {
    console.error('Erro banco:', err);
  });
});
