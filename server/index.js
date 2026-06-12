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

  const countP = db.get('SELECT COUNT(*) as n FROM pecas')?.n || 0;
  if (countP < 500) {
    console.log('Auto-import iniciando, pecas no banco: ' + countP);
    try {
      const https   = require('https');
      const tmpFile = '/tmp/auto-imp.js';
      const catUrl  = 'https://raw.githubusercontent.com/thgbessa/partforge/main/import-pecas.js';
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(tmpFile);
        https.get(catUrl, res => {
          res.pipe(file);
          file.on('finish', resolve);
        }).on('error', reject);
      });
      delete require.cache[require.resolve(tmpFile)];
      require(tmpFile);
      console.log('Auto-import concluido!');
    } catch(e) {
      console.log('Auto-import erro: ' + e.message);
    }
  }

  const routes = require('./routes');
  app.use('/api', routes);
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ erro: 'Erro interno' }); });

  app.listen(PORT, '0.0.0.0', () => {
    console.log('PartForge v2.0 rodando na porta ' + PORT);
  });
}).catch(err => {
  console.error('Erro ao iniciar banco:', err);
  process.exit(1);
});
