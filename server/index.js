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

    // ── Gatilho manual de teste do relatorio diario (acesse pelo navegador) ──
    app.get('/api/admin/relatorio-teste', async (req, res) => {
      const secret = process.env.RELATORIO_TESTE_SECRET || 'partforge-teste-2026';
      if (req.query.secret !== secret) {
        return res.status(403).json({ erro: 'Nao autorizado. Use ?secret=' + secret });
      }
      const range = req.query.dia === 'hoje' ? getTodayRangeBRT() : getYesterdayRangeBRT();
      const resultado = await gerarEEnviarRelatorioDiario(range);
      res.json(resultado);
    });

    // ── Recuperação de acesso emergencial (cria/reseta um usuário admin) ──
    // Também reporta quantos registros existem, para diagnosticar perda de dados.
    app.get('/api/admin/emergencia-recuperar-acesso', (req, res) => {
      const secret = process.env.RELATORIO_TESTE_SECRET || 'partforge-teste-2026';
      if (req.query.secret !== secret) {
        return res.status(403).json({ erro: 'Nao autorizado. Use ?secret=' + secret });
      }
      const bcrypt = require('bcryptjs');
      const email = 'emergencia@partforge.local';
      const senha = 'TrocarAgora123!';
      try {
        const existente = db.get('SELECT id FROM usuarios WHERE email=?', [email]);
        if (existente) {
          db.run('UPDATE usuarios SET senha_hash=?, ativo=1 WHERE id=?', [bcrypt.hashSync(senha, 10), existente.id]);
        } else {
          const { uid, now } = require('./database');
          db.run('INSERT INTO usuarios(id,nome,cargo,tel,email,senha_hash,ativo,created_at) VALUES(?,?,?,?,?,?,?,?)',
            [uid(), 'Acesso Emergencial', 'Gerente', '', email, bcrypt.hashSync(senha, 10), 1, now()]);
        }
        const totalPecas       = db.get('SELECT COUNT(*) as n FROM pecas')?.n || 0;
        const totalEquip       = db.get('SELECT COUNT(*) as n FROM equipamentos')?.n || 0;
        const totalUsuarios    = db.get('SELECT COUNT(*) as n FROM usuarios')?.n || 0;
        const totalMov         = db.get('SELECT COUNT(*) as n FROM movimentacoes')?.n || 0;
        const totalOrcamentos  = db.get('SELECT COUNT(*) as n FROM orcamentos')?.n || 0;
        res.json({
          ok: true,
          login: { email, senha },
          contagem_atual: { pecas: totalPecas, equipamentos: totalEquip, usuarios: totalUsuarios, movimentacoes: totalMov, orcamentos: totalOrcamentos },
          aviso: 'Troque a senha ou exclua este usuário assim que possível (tela Usuários).'
        });
      } catch (e) {
        res.status(500).json({ ok: false, erro: e.message });
      }
    });

    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
    console.log('Banco iniciado, rotas ativas');

    // ── Relatorio diario automatico (pecas enviadas + orcamentos) ──
    const nodemailer = require('nodemailer');

    function getYesterdayRangeBRT() {
      const now = new Date();
      const brtOffsetMs = 3 * 60 * 60 * 1000;
      const brtNow = new Date(now.getTime() - brtOffsetMs);
      const y = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate() - 1));
      const startBRT = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 0, 0, 0));
      const endBRT = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 23, 59, 59, 999));
      return {
        startMs: startBRT.getTime() + brtOffsetMs,
        endMs: endBRT.getTime() + brtOffsetMs,
        label: y.toISOString().slice(0, 10).split('-').reverse().join('/')
      };
    }

    function getTodayRangeBRT() {
      const now = new Date();
      const brtOffsetMs = 3 * 60 * 60 * 1000;
      const brtNow = new Date(now.getTime() - brtOffsetMs);
      const y = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()));
      const startBRT = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 0, 0, 0));
      const endBRT = new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate(), 23, 59, 59, 999));
      return {
        startMs: startBRT.getTime() + brtOffsetMs,
        endMs: endBRT.getTime() + brtOffsetMs,
        label: y.toISOString().slice(0, 10).split('-').reverse().join('/') + ' (hoje - teste)'
      };
    }

    async function gerarEEnviarRelatorioDiario(rangeOverride) {
      try {
        const CIFRAO = String.fromCharCode(36);
        const ORC_STATUS_LABELS = {
          RASCUNHO: 'Rascunho',
          ENVIADO: 'Aguard. Aprov. Cliente',
          APROVADO_TECNICO: 'Aprovado - Aguard. Tecnico',
          APROVADO_PECA: 'Aprovado - Aguard. Peca',
          APROVADO_PAGAMENTO: 'Aprovado - Aguard. Pagamento',
          A_FATURAR: 'A Faturar',
          FATURADO: 'Faturado',
          CANCELADO: 'Cancelado'
        };
        const SC_STATUS_LABELS = {
          SOLICITADO: 'Solicitado',
          AGUARDANDO_APROVACAO: 'Aguard. Aprov.',
          APROVADO: 'Aprovado',
          APROVADO_PARCIAL: 'Aprovado Parcial',
          RECUSADO: 'Recusado',
          RECEBIDO: 'Recebido/Finalizado',
          FINALIZADO: 'Finalizado'
        };
        const range = rangeOverride || getYesterdayRangeBRT();
        const pecasEnviadas = db.query(
          "SELECT m.*, p.preco_usd as peca_preco_usd FROM movimentacoes m LEFT JOIN pecas p ON p.id = m.peca_id WHERE m.status='DESPACHADA' AND m.created_at BETWEEN ? AND ?",
          [range.startMs, range.endMs]
        );
        const orcamentos = db.query(
          "SELECT * FROM orcamentos WHERE updated_at BETWEEN ? AND ?",
          [range.startMs, range.endMs]
        );
        const solicitacoesCompra = db.query(
          "SELECT * FROM solicitacoes_compra WHERE updated_at BETWEEN ? AND ?",
          [range.startMs, range.endMs]
        );

        let html = '<h2>Relatorio Diario PartForge - ' + range.label + '</h2>';
        html += '<h3>Pecas Enviadas (' + pecasEnviadas.length + ')</h3>';
        if (pecasEnviadas.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Nr de Orcamento</th><th>Data</th><th>Peca</th><th>Qtd</th><th>Custo USD</th><th>Valor Frete</th><th>Tecnico</th><th>Cliente</th><th>Equipamento</th><th>No Serie</th><th>Forma de Envio</th></tr>';
          pecasEnviadas.forEach(function(m) {
            var dataM = new Date(m.created_at).toLocaleDateString('pt-BR'); html += '<tr><td>' + (m.seq_num || '') + '</td><td>' + dataM + '</td><td>' + (m.peca_nome || '') + '</td><td>' + (m.qtd || '') + '</td><td>' + CIFRAO + parseFloat(m.peca_preco_usd || 0).toFixed(2) + '</td><td>R' + CIFRAO + ' ' + parseFloat(m.valor_frete || 0).toFixed(2) + '</td><td>' + (m.tecnico || '') + '</td><td>' + (m.equip_cliente || '') + '</td><td>' + (m.equip_modelo || '') + '</td><td>' + (m.equip_serie || '') + '</td><td>' + (m.transportadora || '') + '</td></tr>';
          });
          html += '</table>';
        } else {
          html += '<p>Nenhuma peca enviada no dia.</p>';
        }

        html += '<h3>Orcamentos Criados/Atualizados (' + orcamentos.length + ')</h3>';
        if (orcamentos.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Nr de Orcamento</th><th>Data</th><th>Cliente</th><th>Descricao Item</th><th>Qtd</th><th>Valor</th><th>Status</th><th>Dias no Status</th></tr>';
          orcamentos.forEach(function(o) {
            const itens = (function() {
              try { return JSON.parse(o.itens || '[]'); } catch (e) { return Array.isArray(o.itens) ? o.itens : []; }
            })();
            var baseData = o.status_changed_at || o.created_at || Date.now();
            var diasStatus = Math.floor((Date.now() - baseData) / 86400000);
            if (itens.length) {
              itens.forEach(function(it) {
                const qtd = parseFloat(it.qtd || 0);
                const valor = parseFloat(it.valor || 0);
                html += '<tr><td>' + (o.numero || '') + '</td><td>' + (o.data || '') + '</td><td>' + (o.cliente || '') + '</td><td>' + (it.desc || '') + '</td><td>' + qtd + '</td><td>R$ ' + valor.toFixed(2) + '</td><td>' + (ORC_STATUS_LABELS[o.status] || o.status || '') + '</td><td>' + diasStatus + '</td></tr>';
              });
            } else {
              html += '<tr><td>' + (o.numero || '') + '</td><td>' + (o.data || '') + '</td><td>' + (o.cliente || '') + '</td><td colspan="2">(sem itens)</td><td>R$ ' + parseFloat(o.total || 0).toFixed(2) + '</td><td>' + (ORC_STATUS_LABELS[o.status] || o.status || '') + '</td><td>' + diasStatus + '</td></tr>';
            }
          });
          html += '</table>';
        } else {
          html += '<p>Nenhum orcamento criado no dia.</p>';
        }

        html += '<h3>Solicitacoes de Compra Criadas/Atualizadas (' + solicitacoesCompra.length + ')</h3>';
        if (solicitacoesCompra.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Nr Solicitacao eLoca</th><th>Demanda</th><th>S/N Equip.</th><th>Cliente</th><th>Item</th><th>Qtd</th><th>Valor</th><th>Status</th><th>Dias no Status</th></tr>';
          solicitacoesCompra.forEach(function(sc) {
            const itensSc = (function() {
              try { return JSON.parse(sc.itens || '[]'); } catch (e) { return Array.isArray(sc.itens) ? sc.itens : []; }
            })();
            var baseDataSc = sc.status_changed_at || sc.created_at || Date.now();
            var diasStatusSc = Math.floor((Date.now() - baseDataSc) / 86400000);
            const demandaLabelSc = (sc.demanda || '') + (sc.demanda_nome ? ' - ' + sc.demanda_nome : '');
            const statusLabelSc = SC_STATUS_LABELS[sc.status] || sc.status || '';
            if (itensSc.length) {
              itensSc.forEach(function(it) {
                const qtd = parseFloat(it.qtd || 0);
                const valor = parseFloat(it.valor || 0);
                html += '<tr><td>' + (sc.numero || '') + '</td><td>' + demandaLabelSc + '</td><td>' + (sc.equip_serie || '') + '</td><td>' + (sc.equip_cliente || '') + '</td><td>' + (it.desc || '') + '</td><td>' + qtd + '</td><td>R$ ' + valor.toFixed(2) + '</td><td>' + statusLabelSc + '</td><td>' + diasStatusSc + '</td></tr>';
              });
            } else {
              html += '<tr><td>' + (sc.numero || '') + '</td><td>' + demandaLabelSc + '</td><td>' + (sc.equip_serie || '') + '</td><td>' + (sc.equip_cliente || '') + '</td><td colspan="2">(sem itens)</td><td>-</td><td>' + statusLabelSc + '</td><td>' + diasStatusSc + '</td></tr>';
            }
          });
          html += '</table>';
        } else {
          html += '<p>Nenhuma solicitacao de compra criada/atualizada no dia.</p>';
        }

        const estoqueAtualizado = db.query("SELECT e.peca_id, e.quantidade, e.updated_at, p.codigo, p.nome, p.fonte FROM estoque e LEFT JOIN pecas p ON p.id = e.peca_id WHERE e.updated_at BETWEEN ? AND ?", [range.startMs, range.endMs]);
        html += '<h3>Estoque Atualizado (' + estoqueAtualizado.length + ')</h3>';
        if (estoqueAtualizado.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Codigo</th><th>Peca</th><th>Fonte</th><th>Qtd Atual</th><th>Data Atualizacao</th></tr>';
          estoqueAtualizado.forEach(function(e) {
            var dataE = new Date(e.updated_at).toLocaleString('pt-BR'); html += '<tr><td>' + (e.codigo || '') + '</td><td>' + (e.nome || '') + '</td><td>' + (e.fonte || '') + '</td><td>' + (e.quantidade || 0) + '</td><td>' + dataE + '</td></tr>';
          });
          html += '</table>';
        } else {
          html += '<p>Nenhuma peca teve estoque atualizado no dia.</p>';
        }

        const equipamentosCadastrados = db.query('SELECT * FROM equipamentos WHERE created_at BETWEEN ? AND ?', [range.startMs, range.endMs]);
        html += '<h3>Equipamentos Cadastrados (' + equipamentosCadastrados.length + ')</h3>';
        if (equipamentosCadastrados.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Modelo</th><th>Marca</th><th>Serie</th><th>Cliente</th></tr>';
          equipamentosCadastrados.forEach(function(eq) {
            html += '<tr><td>' + (eq.modelo || '') + '</td><td>' + (eq.marca || '') + '</td><td>' + (eq.serie || '') + '</td><td>' + (eq.cliente || '') + '</td></tr>';
          });
          html += '</table>';
        } else {
          html += '<p>Nenhum equipamento cadastrado no dia.</p>';
        }

        const destinatarios = (process.env.RELATORIO_DESTINATARIOS || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        if (!destinatarios.length || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          console.log('Relatorio diario: configuracao incompleta (GMAIL_USER, GMAIL_APP_PASSWORD ou RELATORIO_DESTINATARIOS ausente)');
          return { ok: false, motivo: 'Configuracao incompleta: verifique as variaveis GMAIL_USER, GMAIL_APP_PASSWORD e RELATORIO_DESTINATARIOS no Railway.' };
        }

        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
        });

        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: destinatarios.join(','),
          subject: 'PartForge - Relatorio Diario ' + range.label,
          html: html
        });
        console.log('Relatorio diario enviado com sucesso para', destinatarios.join(', '));
        return { ok: true, destinatarios: destinatarios, label: range.label };
      } catch (err) {
        console.error('Erro ao gerar/enviar relatorio diario:', err.message);
        return { ok: false, motivo: err.message };
      }
    }

    let ultimoDiaEnviado = null;
    setInterval(function() {
      const now = new Date();
      const hojeStr = now.toISOString().slice(0, 10);
      if (now.getUTCHours() === 12 && now.getUTCMinutes() === 0 && ultimoDiaEnviado !== hojeStr) {
        ultimoDiaEnviado = hojeStr;
        gerarEEnviarRelatorioDiario();
      }
    }, 60 * 1000);
    // ── fim relatorio diario ──

    // ============================================================
    //  BACKUP AUTOMÁTICO DIÁRIO
    //  - Salva em disco (data/backups/), com escrita atômica e
    //    rotação (mantém os últimos 14 dias)
    //  - Também envia por e-mail como anexo (cópia fora do Railway,
    //    sobrevive mesmo que o volume inteiro seja perdido)
    // ============================================================
    async function gerarBackupAutomatico() {
      try {
        const backup = {
          _version: '2.0', _exportedAt: new Date().toISOString(), _origem: 'backup_automatico',
          pecas:               db.query('SELECT * FROM pecas'),
          equipamentos:        db.query('SELECT * FROM equipamentos'),
          estoque:             db.query('SELECT * FROM estoque'),
          depositos:           db.query('SELECT * FROM depositos'),
          movimentacoes:       db.query('SELECT * FROM movimentacoes'),
          orcamentos:          db.query('SELECT * FROM orcamentos'),
          solicitacoes_compra: db.query('SELECT * FROM solicitacoes_compra'),
          doadoras:            db.query('SELECT * FROM doadoras'),
          retiradas:           db.query('SELECT * FROM retiradas'),
          pedidos:             db.query('SELECT * FROM pedidos'),
          usuarios:            db.query('SELECT id,nome,cargo,tel,email,ativo,created_at FROM usuarios'),
        };

        const dbDir = process.env.DB_DIR || path.join(__dirname, '../data');
        const dirBackups = path.join(dbDir, 'backups');
        if (!fs.existsSync(dirBackups)) fs.mkdirSync(dirBackups, { recursive: true });

        const hojeStr  = new Date().toISOString().slice(0, 10);
        const arquivo  = path.join(dirBackups, `auto_backup_${hojeStr}.json`);
        const tmp      = arquivo + '.tmp';
        const conteudo = JSON.stringify(backup);

        // Escrita atômica (mesmo padrão usado no banco): nunca deixa
        // um arquivo de backup pela metade se o processo for interrompido.
        fs.writeFileSync(tmp, conteudo);
        fs.renameSync(tmp, arquivo);

        // Rotação: mantém só os últimos 14 backups automáticos
        const arquivos = fs.readdirSync(dirBackups).filter(f => f.startsWith('auto_backup_')).sort();
        while (arquivos.length > 14) {
          fs.unlinkSync(path.join(dirBackups, arquivos.shift()));
        }

        const tamanhoMB = fs.statSync(arquivo).size / 1024 / 1024;
        console.log('Backup automatico salvo:', arquivo, '(' + tamanhoMB.toFixed(1) + ' MB)');

        // Envia também por e-mail, como camada extra fora do Railway
        const destinatarios = (process.env.RELATORIO_DESTINATARIOS || '').split(',').map(s => s.trim()).filter(Boolean);
        let emailEnviado = false;
        if (destinatarios.length && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
          if (tamanhoMB < 20) {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
            });
            await transporter.sendMail({
              from: process.env.GMAIL_USER,
              to: destinatarios.join(','),
              subject: 'PartForge - Backup Automático ' + hojeStr,
              text: 'Backup automático do PartForge em anexo.\n\nGuarde este arquivo com segurança: em caso de perda de dados, ele pode ser restaurado pela tela "Restaurar" do sistema.',
              attachments: [{ filename: `partforge_backup_${hojeStr}.json`, path: arquivo }]
            });
            emailEnviado = true;
            console.log('Backup automatico enviado por email para', destinatarios.join(', '));
          } else {
            console.log('Backup automatico grande demais para e-mail (' + tamanhoMB.toFixed(1) + 'MB) - mantido apenas em disco em', arquivo);
          }
        }
        return { ok: true, arquivo, tamanhoMB: tamanhoMB.toFixed(2), emailEnviado };
      } catch (err) {
        console.error('Erro no backup automatico:', err.message);
        return { ok: false, motivo: err.message };
      }
    }

    let ultimoDiaBackup = null;
    setInterval(function() {
      const now = new Date();
      const hojeStr = now.toISOString().slice(0, 10);
      // 06:00 UTC = 03:00 BRT — horário de baixo uso, fora do relatorio das 9h
      if (now.getUTCHours() === 6 && now.getUTCMinutes() === 0 && ultimoDiaBackup !== hojeStr) {
        ultimoDiaBackup = hojeStr;
        gerarBackupAutomatico();
      }
    }, 60 * 1000);

    // Gera um backup logo na subida do servidor, para já existir uma
    // cópia de segurança sem precisar esperar até 03:00.
    setTimeout(() => { gerarBackupAutomatico(); }, 15 * 1000);

    // Gatilho manual de teste (acesse pelo navegador)
    app.get('/api/admin/backup-teste', async (req, res) => {
      const secret = process.env.RELATORIO_TESTE_SECRET || 'partforge-teste-2026';
      if (req.query.secret !== secret) {
        return res.status(403).json({ erro: 'Nao autorizado. Use ?secret=' + secret });
      }
      const resultado = await gerarBackupAutomatico();
      res.json(resultado);
    });
    // ── fim backup automatico ──


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
