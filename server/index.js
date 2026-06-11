const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', credentials: true }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20, message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' } }));
app.use('/api/', rateLimit({ windowMs: 60*1000, max: 300 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public'), { maxAge: '1d', etag: true }));
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Inicia banco de dados antes de registrar rotas
initDb().then(() => {
  const routes = require('./routes');
  app.use('/api', routes);
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ erro: 'Erro interno' }); });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🔧 PartForge v2.0 rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Erro ao iniciar banco:', err);
  process.exit(1);
});
