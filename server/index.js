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

    function getSemanaRangeBRT() {
      const now = new Date();
      const brtOffsetMs = 3 * 60 * 60 * 1000;
      const brtNow = new Date(now.getTime() - brtOffsetMs);
      const hoje = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()));
      // Assume que isso roda no sábado: segunda = hoje-5, sexta = hoje-1
      const segunda = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - 5));
      const sexta   = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - 1));
      const startBRT = new Date(Date.UTC(segunda.getUTCFullYear(), segunda.getUTCMonth(), segunda.getUTCDate(), 0, 0, 0));
      const endBRT   = new Date(Date.UTC(sexta.getUTCFullYear(), sexta.getUTCMonth(), sexta.getUTCDate(), 23, 59, 59, 999));
      const fmt = d => d.toISOString().slice(0, 10).split('-').reverse().join('/');
      return {
        startMs: startBRT.getTime() + brtOffsetMs,
        endMs: endBRT.getTime() + brtOffsetMs,
        label: fmt(segunda) + ' a ' + fmt(sexta)
      };
    }

    async function gerarEEnviarRelatorioDiario(rangeOverride, destinatariosOverride, tituloOverride) {
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
        // Relação completa de TODOS os orçamentos em aberto no sistema (não só
        // os criados/atualizados no período), para acompanhar há quantos dias
        // cada um está parado no status atual. Cancelados ficam de fora.
        const orcamentosCompleto = db.query(
          "SELECT * FROM orcamentos WHERE status != 'CANCELADO' ORDER BY status_changed_at ASC"
        );
        const solicitacoesCompra = db.query(
          "SELECT * FROM solicitacoes_compra WHERE updated_at BETWEEN ? AND ?",
          [range.startMs, range.endMs]
        );

        let html = '<h2>' + (tituloOverride || 'Relatorio Diario') + ' PartForge - ' + range.label + '</h2>';
        html += '<h3>Pecas Enviadas (' + pecasEnviadas.length + ')</h3>';
        if (pecasEnviadas.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Nr de Orcamento</th><th>Data</th><th>Peca</th><th>Qtd</th><th>Custo R$</th><th>Valor Frete</th><th>Tecnico</th><th>Cliente</th><th>Equipamento</th><th>No Serie</th><th>Forma de Envio</th></tr>';
          pecasEnviadas.forEach(function(m) {
            var dataM = new Date(m.created_at).toLocaleDateString('pt-BR'); html += '<tr><td>' + (m.seq_num || '') + '</td><td>' + dataM + '</td><td>' + (m.peca_nome || '') + '</td><td>' + (m.qtd || '') + '</td><td>R' + CIFRAO + ' ' + parseFloat(m.peca_custo || 0).toFixed(2) + '</td><td>R' + CIFRAO + ' ' + parseFloat(m.valor_frete || 0).toFixed(2) + '</td><td>' + (m.tecnico || '') + '</td><td>' + (m.equip_cliente || '') + '</td><td>' + (m.equip_modelo || '') + '</td><td>' + (m.equip_serie || '') + '</td><td>' + (m.transportadora || '') + '</td></tr>';
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

        html += '<h3>Relacao Completa de Orcamentos em Aberto (' + orcamentosCompleto.length + ')</h3>';
        html += '<p style="font-size:12px;color:#666">Todos os orcamentos do sistema que nao estao Cancelados, ordenados do mais parado para o mais recente.</p>';
        if (orcamentosCompleto.length) {
          html += '<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Nr de Orcamento</th><th>Data</th><th>Cliente</th><th>Total</th><th>Status</th><th>Dias no Status</th></tr>';
          orcamentosCompleto.forEach(function(o) {
            var baseDataC = o.status_changed_at || o.created_at || Date.now();
            var diasStatusC = Math.floor((Date.now() - baseDataC) / 86400000);
            html += '<tr><td>' + (o.numero || '') + '</td><td>' + (o.data || '') + '</td><td>' + (o.cliente || '') + '</td><td>R$ ' + parseFloat(o.total || 0).toFixed(2) + '</td><td>' + (ORC_STATUS_LABELS[o.status] || o.status || '') + '</td><td>' + diasStatusC + '</td></tr>';
          });
          html += '</table>';
        } else {
          html += '<p>Nenhum orcamento em aberto no sistema.</p>';
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

        const destinatarios = destinatariosOverride || (process.env.RELATORIO_DESTINATARIOS || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
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
          subject: 'PartForge - ' + (tituloOverride || 'Relatorio Diario') + ' ' + range.label,
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

    // ── Relatorio semanal automatico (sabado, 09h BRT) — segunda a sexta ──
    let ultimoSabadoEnviado = null;
    setInterval(function() {
      const now = new Date();
      const hojeStr = now.toISOString().slice(0, 10);
      // getUTCDay(): 6 = sabado. 12:00 UTC = 09:00 BRT.
      if (now.getUTCDay() === 6 && now.getUTCHours() === 12 && now.getUTCMinutes() === 0 && ultimoSabadoEnviado !== hojeStr) {
        ultimoSabadoEnviado = hojeStr;
        gerarEEnviarRelatorioDiario(getSemanaRangeBRT(), null, 'Relatorio Semanal');
      }
    }, 60 * 1000);
    // ── fim relatorio semanal ──

    // ============================================================
    //  BACKUP AUTOMÁTICO DIÁRIO
    //  - Salva em disco (data/backups/), com escrita atômica e
    //    rotação (mantém os últimos 14 dias)
    //  - Também envia por e-mail como anexo (cópia fora do Railway,
    //    sobrevive mesmo que o volume inteiro seja perdido)
    // ============================================================
    async function gerarBackupAutomatico(opts) {
      const enviarEmail = !opts || opts.enviarEmail !== false;
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
          kits_preventivas:    db.query('SELECT * FROM kits_preventivas'),
          clientes:            db.query('SELECT * FROM clientes'),
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
        // Backup usa uma lista de destinatários própria (separada do relatório
        // diário) — por padrão, só thiago.bessa@quallyx.com.br.
        const destinatarios = (process.env.BACKUP_DESTINATARIOS || 'thiago.bessa@quallyx.com.br')
          .split(',').map(s => s.trim()).filter(Boolean);
        let emailEnviado = false;
        if (enviarEmail && destinatarios.length && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
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

    // Backup GARANTIDO 1x por dia às 03:00 BRT (06:00 UTC), mesmo que nada
    // tenha mudado — baseline de segurança independente de atividade.
    let ultimoDiaBackup = null;
    setInterval(function() {
      const now = new Date();
      const hojeStr = now.toISOString().slice(0, 10);
      if (now.getUTCHours() === 6 && now.getUTCMinutes() === 0 && ultimoDiaBackup !== hojeStr) {
        ultimoDiaBackup = hojeStr;
        gerarBackupAutomatico({ enviarEmail: true });
      }
    }, 60 * 1000);

    // Backup REATIVO: a cada 3 minutos, se algo mudou desde a última
    // checagem, salva em disco na hora (proteção quase em tempo real,
    // sem sobrecarregar o servidor fazendo isso a cada clique individual).
    // NÃO envia e-mail — o e-mail só é enviado pelo backup garantido das 03h.
    setInterval(async function() {
      if (!db.consumirFlagMudanca()) return; // nada mudou, não faz nada
      await gerarBackupAutomatico({ enviarEmail: false });
    }, 3 * 60 * 1000);

    // Gera um backup logo na subida do servidor, para já existir uma
    // cópia de segurança sem precisar esperar a primeira mudança.
    setTimeout(() => { gerarBackupAutomatico({ enviarEmail: false }); }, 15 * 1000);
    // ── fim backup automatico ──

    // ============================================================
    //  CANCELAMENTO AUTOMÁTICO DE ORÇAMENTOS VENCIDOS
    //  Orçamento em "Aguard. Aprov. Cliente" (ENVIADO) que passa 7 dias
    //  sem o cliente aprovar é movido automaticamente para CANCELADO.
    //  Roda a cada 15 minutos.
    // ============================================================
    const PRAZO_APROVACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

    function cancelarOrcamentosVencidos() {
      try {
        const limite = Date.now() - PRAZO_APROVACAO_MS;
        const vencidos = db.query(
          "SELECT id, numero, status_changed_at FROM orcamentos WHERE status = 'ENVIADO' AND status_changed_at <= ?",
          [limite]
        );
        if (!vencidos.length) return;

        const agora = Date.now();
        for (const o of vencidos) {
          db.runBatch(
            "UPDATE orcamentos SET status='CANCELADO', status_changed_at=?, updated_at=? WHERE id=?",
            [agora, agora, o.id]
          );
        }
        db.persist();
        console.log(`Cancelamento automatico: ${vencidos.length} orcamento(s) vencido(s) (7 dias sem aprovacao) -> CANCELADO:`,
          vencidos.map(o => o.numero).join(', '));
      } catch (err) {
        console.error('Erro ao cancelar orcamentos vencidos:', err.message);
      }
    }

    setInterval(cancelarOrcamentosVencidos, 15 * 60 * 1000);
    // Roda uma vez logo na subida também (não precisa esperar 15min pela primeira checagem)
    setTimeout(cancelarOrcamentosVencidos, 20 * 1000);
    // ── fim cancelamento automatico de orcamentos ──

    // ============================================================
    //  IMPORTAÇÃO DE CNPJ POR Nº DE CONTRATO (uso único, sob demanda)
    //  Cruza server/dados-cnpj-contrato.json (Cliente/CNPJ/Contrato) com os
    //  equipamentos já cadastrados pelo campo "contrato" e preenche o CNPJ
    //  dos que baterem. Também alimenta a tabela "clientes" (mesma memória
    //  usada no autopreenchimento de Orçamentos).
    // ============================================================
    app.get('/api/admin/importar-cnpj-por-contrato', (req, res) => {
      const secret = process.env.RELATORIO_TESTE_SECRET || 'partforge-teste-2026';
      if (req.query.secret !== secret) {
        return res.status(403).json({ erro: 'Nao autorizado. Use ?secret=' + secret });
      }
      try {
        const dados = require('./dados-cnpj-contrato.json');
        const normContrato = s => String(s || '').trim().toUpperCase();

        const mapaContrato = new Map();
        for (const d of dados) {
          const key = normContrato(d.contrato);
          if (key) mapaContrato.set(key, d);
        }

        const equipamentos = db.query('SELECT id, contrato, cliente, campos FROM equipamentos');

        let atualizados = 0;
        let semContrato = 0;
        const contratosEncontrados = new Set();
        const clientesParaSalvar = new Map(); // nome -> cnpj

        for (const eq of equipamentos) {
          const key = normContrato(eq.contrato);
          if (!key) { semContrato++; continue; }
          const match = mapaContrato.get(key);
          if (!match) continue;

          contratosEncontrados.add(key);
          let campos = {};
          try { campos = JSON.parse(eq.campos || '{}') || {}; } catch (e) { campos = {}; }
          campos.cnpj = match.cnpj;
          db.runBatch('UPDATE equipamentos SET campos=? WHERE id=?', [JSON.stringify(campos), eq.id]);
          atualizados++;

          // Remove o sufixo tipo "[81]" (mesma limpeza feita ao preencher
          // o campo Cliente do orçamento a partir do equipamento) — sem
          // isso, o nome nunca bate com o que fica salvo no orçamento.
          const nomeCliente = (eq.cliente || match.cliente || '').replace(/\[\d+\]$/, '').trim();
          if (nomeCliente && match.cnpj) clientesParaSalvar.set(nomeCliente, match.cnpj);
        }
        db.persist();

        for (const [nome, cnpj] of clientesParaSalvar.entries()) {
          const nomeNorm = String(nome).trim().toUpperCase().replace(/\s+/g, ' ');
          db.runBatch('INSERT OR REPLACE INTO clientes(nome_norm,nome,cnpj,updated_at) VALUES(?,?,?,?)',
            [nomeNorm, nome, cnpj, Date.now()]);
        }
        db.persist();

        const contratosNaoEncontrados = dados
          .map(d => normContrato(d.contrato))
          .filter(c => !contratosEncontrados.has(c));

        res.json({
          ok: true,
          totalContratosNaPlanilha: dados.length,
          totalEquipamentos: equipamentos.length,
          equipamentosSemContrato: semContrato,
          equipamentosAtualizados: atualizados,
          clientesMemorizados: clientesParaSalvar.size,
          contratosDaPlanilhaSemEquipamento: contratosNaoEncontrados.length,
          amostraContratosNaoEncontrados: contratosNaoEncontrados.slice(0, 20)
        });
      } catch (err) {
        console.error('Erro na importacao de CNPJ por contrato:', err.message);
        res.status(500).json({ ok: false, erro: err.message });
      }
    });
    // ── fim importacao de cnpj por contrato ──

    // ── Importa o kit VITROS 250 de exemplo (rodar uma vez, depois remover) ──
    app.get('/api/admin/importar-kit-vitros250', (req, res) => {
      const secret = process.env.RELATORIO_TESTE_SECRET || 'partforge-teste-2026';
      if (req.query.secret !== secret) {
        return res.status(403).json({ erro: 'Nao autorizado. Use ?secret=' + secret });
      }
      try {
        const itens = [
          { codigo: '356666',        fornecedor: '', desc: 'Lâmpada vitros 250', qtd: 1, custo_usd: 0, custo_rs: 166.21 },
          { codigo: 'J24003',        fornecedor: '', desc: 'Evaporation caps', qtd: 1, custo_usd: 0, custo_rs: 282.31 },
          { codigo: '1C3197/J10944', fornecedor: '', desc: 'Blade - Dispense', qtd: 1, custo_usd: 0, custo_rs: 45.70 },
          { codigo: 'J10537',        fornecedor: '', desc: 'Belt - Rotor', qtd: 1, custo_usd: 0, custo_rs: 0 },
          { codigo: '994659',        fornecedor: '', desc: 'Tubing - 0.030 ID x 6.5 in.', qtd: 1, custo_usd: 0, custo_rs: 116.45 },
          { codigo: 'J02315',        fornecedor: '', desc: 'White reference slides (vem com vários slides, usa 1 a cada 6 meses)', qtd: 1, custo_usd: 0, custo_rs: 0 },
          { codigo: 'J02316',        fornecedor: '', desc: 'Black reference slides (vem com vários slides, usa 1 a cada 6 meses)', qtd: 1, custo_usd: 0, custo_rs: 0 },
          { codigo: 'MOBRA',         fornecedor: '', desc: 'HORA TÉCNICA : 2 a 4 HORAS', qtd: 4, custo_usd: 5, custo_rs: 0 },
        ];
        const id = db.uid();
        const agora = Date.now();
        db.run(`INSERT INTO kits_preventivas(id,nome,fonte,linha,taxa,dolar,markup,itens,obs,created_at,updated_at,created_by)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
          [id, 'VITROS 250 - SEMESTRAL', 'ORTHO', 'VITROS 250', 2, 5.5, 2, JSON.stringify(itens), 'Importado da planilha de preventivas (aba PREVENTIVA GERAL)', agora, agora, 'import-teste']);
        res.json({ ok: true, id, totalItens: itens.length });
      } catch (err) {
        res.status(500).json({ ok: false, erro: err.message });
      }
    });
    // ── fim importacao kit exemplo ──

    // ── Gatilho manual de teste do relatorio diario (envia so para 1 e-mail) ──
    app.get('/api/admin/relatorio-teste', async (req, res) => {
      const secret = process.env.RELATORIO_TESTE_SECRET || 'partforge-teste-2026';
      if (req.query.secret !== secret) {
        return res.status(403).json({ erro: 'Nao autorizado. Use ?secret=' + secret });
      }
      let range, titulo;
      if (req.query.tipo === 'semanal') {
        range = getSemanaRangeBRT();
        titulo = 'Relatorio Semanal';
      } else {
        range = req.query.dia === 'hoje' ? getTodayRangeBRT() : getYesterdayRangeBRT();
        titulo = 'Relatorio Diario';
      }
      const resultado = await gerarEEnviarRelatorioDiario(range, ['thiago.bessa@quallyx.com.br'], titulo);
      res.json(resultado);
    });
    // ── fim teste relatorio diario ──

    // Rota coringa: SEMPRE por último, depois de todas as rotas específicas
    // (senão ela intercepta e nenhuma rota /api/admin/* registrada depois
    // dela seria alcançada — foi exatamente esse bug que impediu a rota
    // de importação de CNPJ de funcionar).
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));


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
