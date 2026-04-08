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

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL  || 'http://clickhouse:8123';
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE     || '100', 10);
const FLUSH_INTERVAL = parseInt(process.env.FLUSH_INTERVAL || '2000', 10);
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

// ── ClickHouse insertion ──────────────────────────────────────────────────────

function insertBatch(rows) {
  if (rows.length === 0) return;

  const body  = rows.map(r => JSON.stringify(r)).join('\n');
  const query = 'INSERT INTO nat_logs (timestamp,ip_publico,ip_privado,porta_publica,porta_privada,protocolo,tipo_nat,equipamento_origem,payload_raw,tamanho_bloco) FORMAT JSONEachRow';
  const url   = new URL(CLICKHOUSE_URL);

  const options = {
    hostname: url.hostname,
    port:     url.port || 8123,
    path:     `/?query=${encodeURIComponent(query)}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const req = http.request(options, res => {
    if (res.statusCode !== 200) {
      let err = '';
      res.on('data', d => err += d);
      res.on('end', () => console.error(`[clickhouse] error ${res.statusCode}: ${err}`));
    } else {
      console.log(`[clickhouse] inserted ${rows.length} rows`);
    }
  });

  req.on('error', e => console.error('[clickhouse] request error:', e.message));
  req.write(body);
  req.end();
}

function scheduledFlush() {
  if (batch.length > 0) {
    insertBatch(batch.splice(0, batch.length));
  }
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
      // Route by source IP first, then any-IP fallback
      const entry = sockets.get(port);
      const list  = entry ? entry.inputs : portInputs;
      let matched = list.find(i => i.source_ip && i.source_ip === rinfo.address);
      if (!matched) matched = list.find(i => !i.source_ip);
      if (!matched) matched = list[0];

      const parser = getParser(matched);
      const rows = parser.parse(msg, rinfo, matched, TZ_OFFSET_MS);

      if (rows.length > 0) {
        batch.push(...rows);
        rows.forEach(r =>
          console.log(`[event] ${matched.name} ${r.tipo_nat} ${r.protocolo} ${r.ip_privado}:${r.porta_privada} -> ${r.ip_publico}:${r.porta_publica}`)
        );
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

// ── Hot-reload: watch inputs.json for changes ─────────────────────────────────

let reloadDebounce = null;

function watchInputs() {
  if (!fs.existsSync(CONFIG_FILE)) return;

  fs.watch(CONFIG_FILE, () => {
    // Debounce: editors may trigger multiple events per save
    clearTimeout(reloadDebounce);
    reloadDebounce = setTimeout(() => {
      console.log('[collector] inputs.json changed — reloading...');
      const newInputs = loadInputs();
      startListeners(newInputs);
    }, 500);
  });

  console.log(`[collector] Watching ${CONFIG_FILE} for changes`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('[collector] LogProcyon Multi-Vendor Collector starting...');
console.log(`[collector] ClickHouse: ${CLICKHOUSE_URL}`);
console.log(`[collector] TZ offset: ${TZ_OFFSET_MS / 3600000}h`);
console.log(`[collector] Data dir: ${DATA_DIR}`);

const inputs = loadInputs();
startListeners(inputs);
watchInputs();

flushTimer = setInterval(scheduledFlush, FLUSH_INTERVAL);

process.on('SIGTERM', () => {
  console.log('[collector] Shutting down...');
  clearInterval(flushTimer);
  clearTimeout(reloadDebounce);
  scheduledFlush();
  for (const { server } of sockets.values()) server.close();
  process.exit(0);
});
