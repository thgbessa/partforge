const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const path        = require('path');
const fs          = require('fs');
const { init }    = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

init().then(() => {
  const db = require('./database');
  const routes = require('./routes');
  app.use('/api', routes);
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

  app.listen(PORT, '0.0.0.0', () => {
    console.log('PartForge v2.0 porta ' + PORT);

    // Auto-import roda DEPOIS do servidor subir
    const countP = db.get('SELECT COUNT(*) as n FROM pecas')?.n || 0;
    if (countP < 500) {
      console.log('Iniciando auto-import (' + countP + ' pecas no banco)...');
      const https = require('https');
      const tmpFile = '/tmp/auto-imp.js';
      const file = fs.createWriteStream(tmpFile);
      https.get('https://raw.githubusercontent.com/thgbessa/partforge/main/import-pecas.js', res => {
        res.pipe(file);
        file.on('finish', () => {
          delete require.cache[tmpFile];
          require(tmpFile);
          console.log('Auto-import concluido!');
        });
      }).on('error', e => console.log('Auto-import erro: ' + e.message));
    }
  });
}).catch(err => {
  console.error('Erro banco:', err);
  process.exit(1);
});
