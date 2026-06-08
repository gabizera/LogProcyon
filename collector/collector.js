'use strict';

/**
 * LogProcyon Multi-Vendor Collector
 *
 * Config-driven: reads /data/inputs.json (managed via the Web UI).
 * Supports Cisco NetFlow v9, A10 syslog, Nokia syslog, Hillstone syslog,
 * Juniper syslog, and generic syslog via pluggable parsers.
 *
 * Falls back to env-var defaults when inputs.json is not present.
 */

const dgram  = require('dgram');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');

const CLICKHOUSE_URL      = process.env.CLICKHOUSE_URL      || 'http://clickhouse:8123';
const CLICKHOUSE_USER     = process.env.CLICKHOUSE_USER     || 'default';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || '';
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE     || '100', 10);
const FLUSH_INTERVAL = parseInt(process.env.FLUSH_INTERVAL || '2000', 10);
// Logar cada tradução/insert no stdout é MUITO verboso (uma linha por conexão).
// Em CGNAT isso enche o disco via json.log do Docker. Default off — só p/ debug.
const LOG_EVENTS     = process.env.LOG_EVENTS === 'true';
const DATA_DIR       = process.env.DATA_DIR        || '/data';
const CONFIG_FILE    = path.join(DATA_DIR, 'inputs.json');

// Default input when inputs.json is missing (backward compat)
const DEFAULT_INPUT = {
  id:             'default',
  name:           'Cisco - Default',
  equipment_type: 'cisco',
  protocol_type:  'netflow_v9',
  source_ip:      '',
  port:           parseInt(process.env.LISTEN_PORT || '514', 10),
  enabled:        true,
};

const { getParser } = require('./parsers/index');

// TZ offset
const TZ_OFFSET_MS = parseInt(process.env.TZ_OFFSET_HOURS || '-3', 10) * 3600 * 1000;

// Batch buffer + flush
let batch = [];
let flushTimer = null;
let spoolTimer = null;

// ── ClickHouse insertion ──────────────────────────────────────────────────────

const CH_TIMEOUT_MS  = parseInt(process.env.CH_TIMEOUT_MS  || '10000', 10);
const CH_MAX_RETRIES = parseInt(process.env.CH_MAX_RETRIES || '3', 10);

const INSERT_QUERY = 'INSERT INTO nat_logs (timestamp,ip_publico,ip_privado,porta_publica,porta_privada,protocolo,tipo_nat,equipamento_origem,payload_raw,tamanho_bloco) FORMAT JSONEachRow';

// Spool em disco: quando o ClickHouse cai, batch que esgotou retries é gravado
// aqui em vez de descartado (CGNAT = evidência legal; perder = gap no Marco
// Civil). Um loop reenvia quando o CH volta. /data é volume persistente.
const SPOOL_DIR = path.join(DATA_DIR, 'spool');
try { fs.mkdirSync(SPOOL_DIR, { recursive: true }); } catch (e) { /* ok */ }

// Quantos inserts estão em vôo — usado pelo shutdown pra esperar o flush.
let pendingInserts = 0;

function postBatch(body, query) {
  return new Promise((resolve, reject) => {
    const url = new URL(CLICKHOUSE_URL);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-ClickHouse-User': CLICKHOUSE_USER,
    };
    if (CLICKHOUSE_PASSWORD) headers['X-ClickHouse-Key'] = CLICKHOUSE_PASSWORD;

    const options = {
      hostname: url.hostname,
      port:     url.port || 8123,
      path:     `/?query=${encodeURIComponent(query)}`,
      method:   'POST',
      headers,
      timeout:  CH_TIMEOUT_MS,
    };

    const req = http.request(options, res => {
      let resp = '';
      res.on('data', d => resp += d);
      res.on('end', () => {
        if (res.statusCode === 200) resolve();
        else reject(new Error(`HTTP ${res.statusCode}: ${resp.slice(0, 200)}`));
      });
    });

    req.on('timeout', () => req.destroy(new Error(`timeout after ${CH_TIMEOUT_MS}ms`)));
    req.on('error', err => reject(err));
    req.write(body);
    req.end();
  });
}

// Resolve sempre (mesmo após esgotar retries) pra não derrubar o processo;
// loga FATAL quando desiste — dado perdido precisa ser visível no log.
async function insertBatch(rows) {
  if (rows.length === 0) return;

  const body = rows.map(r => JSON.stringify(r)).join('\n');

  pendingInserts++;
  try {
    for (let attempt = 1; attempt <= CH_MAX_RETRIES; attempt++) {
      try {
        await postBatch(body, INSERT_QUERY);
        if (LOG_EVENTS) console.log(`[clickhouse] inserted ${rows.length} rows`);
        return;
      } catch (e) {
        const last = attempt === CH_MAX_RETRIES;
        console.error(`[clickhouse] insert attempt ${attempt}/${CH_MAX_RETRIES} failed: ${e.message}`);
        if (last) {
          // NÃO descarta: grava em disco pra reenviar quando o CH voltar.
          spoolBatch(body, rows.length);
          return;
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  } finally {
    pendingInserts--;
  }
}

// ── Spool de disco (reenvio quando o ClickHouse volta) ───────────────────────

function spoolBatch(body, count) {
  try {
    const f = path.join(SPOOL_DIR, `batch-${Date.now()}-${process.pid}-${spoolSeq++}.ndjson`);
    fs.writeFileSync(`${f}.tmp`, body);
    fs.renameSync(`${f}.tmp`, f); // rename atômico — leitor nunca vê arquivo parcial
    console.error(`[spool] ClickHouse indisponível — ${count} rows salvas em ${path.basename(f)} (reenvio automático)`);
  } catch (e) {
    console.error(`[spool] FALHA ao gravar spool — ${count} rows PERDIDAS: ${e.message}`);
  }
}
let spoolSeq = 0;

let replaying = false;
async function replaySpool() {
  if (replaying) return;
  replaying = true;
  try {
    let files;
    try {
      files = fs.readdirSync(SPOOL_DIR).filter(f => f.endsWith('.ndjson')).sort();
    } catch (e) { return; }
    for (const name of files) {
      const f = path.join(SPOOL_DIR, name);
      let body;
      try { body = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
      if (!body.trim()) { try { fs.unlinkSync(f); } catch (e) {} continue; }
      try {
        await postBatch(body, INSERT_QUERY);
        fs.unlinkSync(f);
        console.log(`[spool] reenviado ${name}`);
      } catch (e) {
        break; // CH ainda fora — para e tenta no próximo ciclo (preserva ordem/arquivos)
      }
    }
  } finally {
    replaying = false;
  }
}

function scheduledFlush() {
  if (batch.length > 0) {
    return insertBatch(batch.splice(0, batch.length));
  }
  return Promise.resolve();
}

function maybeBatchFlush() {
  if (batch.length >= BATCH_SIZE) {
    insertBatch(batch.splice(0, BATCH_SIZE));
  }
}

// ── Input config loading ──────────────────────────────────────────────────────

function loadInputs() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const inputs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const enabled = inputs.filter(i => i.enabled !== false);
      if (enabled.length > 0) {
        console.log(`[collector] Loaded ${enabled.length} input(s) from ${CONFIG_FILE}`);
        return enabled;
      }
    }
  } catch (e) {
    console.warn('[collector] Could not load inputs.json, using defaults:', e.message);
  }
  console.log('[collector] Using default input (port', DEFAULT_INPUT.port, ')');
  return [DEFAULT_INPUT];
}

// ── Socket management ─────────────────────────────────────────────────────────

const sockets = new Map(); // port -> { server, inputs: [] }

function buildRouteMap(inputs) {
  const byPort = new Map();
  for (const inp of inputs) {
    if (!byPort.has(inp.port)) byPort.set(inp.port, []);
    byPort.get(inp.port).push(inp);
  }
  return byPort;
}

function openSocket(port, portInputs) {
  const server = dgram.createSocket('udp4');

  server.on('error', err => console.error(`[udp:${port}] error:`, err.message));

  server.on('message', (msg, rinfo) => {
    try {
      // Isolamento por PORTA dedicada: cada cliente tem sua própria porta
      // (1 input por porta, garantido pelo backend). source_ip, quando
      // definido, é 2ª camada — rejeita pacote chegando na porta certa
      // mas de IP não autorizado. SEM catch-all cross-tenant: um pacote
      // de IP desconhecido nunca cai no input de outro cliente.
      const entry = sockets.get(port);
      const list  = entry ? entry.inputs : portInputs;
      const matched = list.find(i => !i.source_ip || i.source_ip === rinfo.address);

      if (!matched) {
        if (list.length > 0) {
          // Porta de um cliente recebendo pacote de IP fora do source_ip
          // cadastrado — possível spoof ou erro de config no equipamento.
          logRejected(port, rinfo.address, list[0].name);
        } else {
          logUnmatched(rinfo.address);
        }
        return;
      }

      const parser = getParser(matched);
      const rows = parser.parse(msg, rinfo, matched, TZ_OFFSET_MS);

      if (rows.length > 0) {
        batch.push(...rows);
        if (LOG_EVENTS) {
          rows.forEach(r =>
            console.log(`[event] ${matched.name} ${r.tipo_nat} ${r.protocolo} ${r.ip_privado}:${r.porta_privada} -> ${r.ip_publico}:${r.porta_publica}`)
          );
        }
        maybeBatchFlush();
      }
    } catch (e) {
      console.error('[parse] error:', e.message);
    }
  });

  server.on('listening', () => {
    const addr  = server.address();
    const names = portInputs.map(i => i.name).join(', ');
    console.log(`[collector] Listening on UDP ${addr.address}:${addr.port} → [${names}]`);
  });

  server.bind(port, '0.0.0.0');
  return server;
}

function startListeners(inputs) {
  const byPort = buildRouteMap(inputs);

  for (const [port, portInputs] of byPort) {
    if (sockets.has(port)) {
      // Port already open — just update the input list (hot-update routing)
      sockets.get(port).inputs = portInputs;
    } else {
      const server = openSocket(port, portInputs);
      sockets.set(port, { server, inputs: portInputs });
    }
  }

  // Close sockets for ports no longer in config
  for (const [port, { server }] of sockets) {
    if (!byPort.has(port)) {
      console.log(`[collector] Closing UDP ${port} (removed from inputs)`);
      server.close();
      sockets.delete(port);
    }
  }
}

// ── Diagnostic: log unmatched source IPs (rate-limited) ──────────────────────
const unmatchedSeen = new Map(); // ip -> last log timestamp
function logUnmatched(ip) {
  const now = Date.now();
  const last = unmatchedSeen.get(ip) || 0;
  if (now - last > 60000) {
    console.warn(`[collector] porta sem input configurado recebeu pacote de ${ip} — descartado`);
    unmatchedSeen.set(ip, now);
  }
}

// Pacote chegou na porta dedicada de um cliente mas de um IP que não
// bate com o source_ip cadastrado. Rate-limited por (porta+ip).
const rejectedSeen = new Map();
function logRejected(port, ip, inputName) {
  const key = `${port}:${ip}`;
  const now = Date.now();
  const last = rejectedSeen.get(key) || 0;
  if (now - last > 60000) {
    console.warn(`[collector][SEGURANÇA] porta ${port} ("${inputName}") rejeitou pacote de ${ip} — IP fora do source_ip cadastrado (possível spoof/erro de config)`);
    rejectedSeen.set(key, now);
  }
}

// ── Hot-reload: poll inputs.json mtime ────────────────────────────────────────
// fs.watch is unreliable with Docker named volumes cross-container
// (inode changes break the watcher; file may not exist at boot). Polling is
// boring, cheap, and always works.

let lastMtime = 0;
let pollTimer = null;

function pollInputs() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return;
    const mtime = fs.statSync(CONFIG_FILE).mtimeMs;
    if (mtime === lastMtime) return;
    if (lastMtime !== 0) {
      console.log('[collector] inputs.json changed — reloading...');
      const newInputs = loadInputs();
      startListeners(newInputs);
    }
    lastMtime = mtime;
  } catch (e) {
    console.warn('[collector] poll error:', e.message);
  }
}

function startPolling() {
  pollInputs();
  pollTimer = setInterval(pollInputs, 2000);
  console.log(`[collector] Polling ${CONFIG_FILE} every 2s`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('[collector] LogProcyon Multi-Vendor Collector starting...');
console.log(`[collector] ClickHouse: ${CLICKHOUSE_URL}`);
console.log(`[collector] TZ offset: ${TZ_OFFSET_MS / 3600000}h`);
console.log(`[collector] Data dir: ${DATA_DIR}`);

const inputs = loadInputs();
startListeners(inputs);
startPolling();

flushTimer = setInterval(scheduledFlush, FLUSH_INTERVAL);
spoolTimer = setInterval(replaySpool, 10000); // reenvia o spool quando o CH voltar
replaySpool();                                // recupera spool de uma queda anterior já no boot

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[collector] ${signal}: shutting down...`);
  clearInterval(flushTimer);
  clearInterval(spoolTimer);
  clearInterval(pollTimer);
  for (const { server } of sockets.values()) server.close();

  // Flush final + espera inserts em vôo (com teto pra não travar o orquestrador).
  const SHUTDOWN_MAX_MS = parseInt(process.env.SHUTDOWN_MAX_MS || '15000', 10);
  const deadline = Date.now() + SHUTDOWN_MAX_MS;
  try {
    await scheduledFlush();
    while (pendingInserts > 0 && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (pendingInserts > 0) {
      console.error(`[collector] shutdown timeout: ${pendingInserts} insert(s) ainda em vôo`);
    }
  } catch (e) {
    console.error('[collector] shutdown flush error:', e.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
