'use strict';

/**
 * Cisco NAT Event Logging — NetFlow v9 Collector
 *
 * Handles: ip nat log translations flow-export v9 udp destination <ip> 514
 *
 * NetFlow v9 field types used by Cisco NAT event logging:
 *   4   PROTOCOL              1 byte
 *   7   L4_SRC_PORT           2 bytes  (original/private port)
 *   8   IPV4_SRC_ADDR         4 bytes  (original/private IP)
 *   11  L4_DST_PORT           2 bytes
 *   12  IPV4_DST_ADDR         4 bytes
 *   225 postNATSourceIPv4Addr 4 bytes  (public IP)
 *   226 postNATDstIPv4Addr    4 bytes
 *   227 postNAPTSrcPort       2 bytes  (public port)
 *   228 postNAPTDstPort       2 bytes
 *   230 natEvent              1 byte   (1=create, 2=delete)
 *   231 initiatorOctets       8 bytes
 *   232 responderOctets       8 bytes
 *   233 firewallEvent         1 byte
 *   234 ingressVRFID          4 bytes
 *   238 postNATSourceIPv6Addr 16 bytes
 *   239 postNATDstIPv6Addr    16 bytes
 */

const dgram  = require('dgram');
const http   = require('http');
const os     = require('os');

const LISTEN_PORT    = parseInt(process.env.LISTEN_PORT    || '514', 10);
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL           || 'http://clickhouse:8123';
const BATCH_SIZE     = parseInt(process.env.BATCH_SIZE      || '100', 10);
const FLUSH_INTERVAL = parseInt(process.env.FLUSH_INTERVAL  || '2000', 10); // ms

// Template cache: sourceId -> templateId -> [{ fieldType, fieldLength }]
const templates = {};

// Pending rows to insert
let batch = [];
let flushTimer = null;

// ─── NetFlow v9 parsing ─────────────────────────────────────────────────────

function readIPv4(buf, offset) {
  return `${buf[offset]}.${buf[offset+1]}.${buf[offset+2]}.${buf[offset+3]}`;
}

function readUInt(buf, offset, len) {
  let val = 0;
  for (let i = 0; i < len; i++) val = (val * 256) + buf[offset + i];
  return val;
}

function parseTemplateFlowset(buf, offset, end, sourceId) {
  while (offset + 4 <= end) {
    const templateId = buf.readUInt16BE(offset);     offset += 2;
    const fieldCount  = buf.readUInt16BE(offset);    offset += 2;

    if (templateId === 0 || fieldCount === 0) break;

    const fields = [];
    for (let i = 0; i < fieldCount; i++) {
      if (offset + 4 > end) break;
      const fieldType   = buf.readUInt16BE(offset); offset += 2;
      const fieldLength = buf.readUInt16BE(offset); offset += 2;
      fields.push({ fieldType, fieldLength });
    }

    if (!templates[sourceId]) templates[sourceId] = {};
    templates[sourceId][templateId] = fields;
    const fieldSummary = fields.map(f => `${f.fieldType}(${f.fieldLength}b)`).join(', ');
    console.log(`[template] sourceId=${sourceId} templateId=${templateId} fields=${fields.length}: ${fieldSummary}`);
  }
}

function parseDataFlowset(buf, offset, end, flowsetId, sourceId, unixSecs) {
  const tmpl = templates[sourceId] && templates[sourceId][flowsetId];
  if (!tmpl) {
    // Template not yet received — skip
    return;
  }

  // Calculate record size
  const recordSize = tmpl.reduce((s, f) => s + f.fieldLength, 0);
  if (recordSize === 0) return;

  while (offset + recordSize <= end) {
    const record = {};
    let pos = offset;

    for (const { fieldType, fieldLength } of tmpl) {
      // Always store every field by its numeric ID with raw value
      let val;
      if (fieldLength === 4 && (fieldType === 8 || fieldType === 12 || fieldType === 225 || fieldType === 226)) {
        val = readIPv4(buf, pos);
      } else if (fieldLength <= 8) {
        val = readUInt(buf, pos, fieldLength);
      } else {
        val = buf.slice(pos, pos + fieldLength).toString('hex');
      }
      record[`field_${fieldType}`] = val;

      // Also store with human-readable name where known
      switch (fieldType) {
        case 4:   record.protocol               = val; break;
        case 7:   record.src_port               = val; break;
        case 8:   record.src_ip                 = val; break;  // nf_ipv4_src_addr (IP privado)
        case 11:  record.dst_port               = val; break;
        case 12:  record.dst_ip                 = val; break;
        case 225: record.post_nat_src_ip        = val; break;  // nf_xlate_src_addr_ipv4 (IP público)
        case 226: record.post_nat_dst_ip        = val; break;
        case 227: record.post_nat_src_port      = val; break;
        case 228: record.post_nat_dst_port      = val; break;
        case 230: record.nat_event              = val; break;
        case 233: record.fw_event               = val; break;
        case 234: record.ingress_vrf            = val; break;
        case 323: record.event_time_msec        = val; break;  // nf_event_time_msec
        case 361: record.port_block_start       = val; break;  // nf_postnatportblockstart (porta pública BPA)
        case 363: record.field_363              = val; break;
        case 364: record.field_364              = val; break;
      }
      pos += fieldLength;
    }

    offset += recordSize;

    // Only store create/delete events with valid NAT data
    const proto = record.protocol;
    if (proto !== 6 && proto !== 17) continue; // only TCP/UDP

    const ip_privado   = record.src_ip          || '0.0.0.0';
    const ip_publico   = record.post_nat_src_ip || '0.0.0.0';
    const porta_pub    = record.port_block_start || record.post_nat_src_port || record.dst_port || 0;
    const porta_priv   = record.src_port        || 0;

    if (ip_publico === '0.0.0.0' && ip_privado === '0.0.0.0') continue;

    // Use event timestamp if available (field 323 = ms since epoch), adjust to configured TZ offset
    const TZ_OFFSET_MS = parseInt(process.env.TZ_OFFSET_HOURS || '-3', 10) * 60 * 60 * 1000;
    let ts;
    if (record.event_time_msec && record.event_time_msec > 1000000000000) {
      ts = new Date(Number(record.event_time_msec) + TZ_OFFSET_MS).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
    } else {
      ts = new Date(unixSecs * 1000 + TZ_OFFSET_MS).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
    }

    // tipo_nat: bpa se tem bloco de porta, cgnat se não
    const tipo_nat = record.port_block_start ? 'bpa' : 'cgnat';

    const row = {
      timestamp:          ts,
      ip_publico,
      ip_privado,
      porta_publica:      porta_pub,
      porta_privada:      porta_priv,
      tamanho_bloco:      record.field_364 || 0,
      protocolo:          proto === 6 ? 'TCP' : 'UDP',
      tipo_nat,
      equipamento_origem: 'cisco',
      payload_raw:        JSON.stringify(record),
    };

    batch.push(row);
    console.log(`[event] ${row.tipo_nat} ${row.protocolo} ${row.ip_privado}:${row.porta_privada} -> ${row.ip_publico}:${row.porta_publica}`);
  }
}

function parseNetFlowV9(buf, rinfo) {
  if (buf.length < 20) return;

  const version  = buf.readUInt16BE(0);
  if (version !== 9) {
    console.warn(`[warn] Unknown version ${version} from ${rinfo.address}`);
    return;
  }

  const count      = buf.readUInt16BE(2);
  const unixSecs   = buf.readUInt32BE(8);
  const sourceId   = buf.readUInt32BE(16);

  let offset = 20;
  let flowsetsParsed = 0;

  while (offset + 4 <= buf.length && flowsetsParsed < count) {
    const flowsetId = buf.readUInt16BE(offset);
    const length    = buf.readUInt16BE(offset + 2);

    if (length < 4 || offset + length > buf.length) break;

    const fsStart = offset + 4;
    const fsEnd   = offset + length;

    if (flowsetId === 0) {
      // Template FlowSet
      parseTemplateFlowset(buf, fsStart, fsEnd, sourceId);
    } else if (flowsetId === 1) {
      // Options Template — skip for now
    } else if (flowsetId >= 256) {
      // Data FlowSet
      parseDataFlowset(buf, fsStart, fsEnd, flowsetId, sourceId, unixSecs);
    }

    offset += length;
    flowsetsParsed++;
  }
}

// ─── ClickHouse insertion ────────────────────────────────────────────────────

function insertBatch(rows) {
  if (rows.length === 0) return;

  const body = rows.map(r => JSON.stringify(r)).join('\n');
  const query = 'INSERT INTO nat_logs (timestamp,ip_publico,ip_privado,porta_publica,porta_privada,protocolo,tipo_nat,equipamento_origem,payload_raw) FORMAT JSONEachRow';
  const url   = new URL(CLICKHOUSE_URL);

  const options = {
    hostname: url.hostname,
    port:     url.port || 8123,
    path:     `/?query=${encodeURIComponent(query)}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const req = http.request(options, (res) => {
    if (res.statusCode !== 200) {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => console.error(`[clickhouse] error ${res.statusCode}: ${body}`));
    } else {
      console.log(`[clickhouse] inserted ${rows.length} rows`);
    }
  });

  req.on('error', (err) => console.error('[clickhouse] request error:', err.message));
  req.write(body);
  req.end();
}

function scheduledFlush() {
  if (batch.length > 0) {
    const toInsert = batch.splice(0, batch.length);
    insertBatch(toInsert);
  }
}

function maybeBatchFlush() {
  if (batch.length >= BATCH_SIZE) {
    const toInsert = batch.splice(0, BATCH_SIZE);
    insertBatch(toInsert);
  }
}

// ─── UDP server ──────────────────────────────────────────────────────────────

const server = dgram.createSocket('udp4');

server.on('error', (err) => {
  console.error('[udp] error:', err.message);
});

server.on('message', (msg, rinfo) => {
  try {
    parseNetFlowV9(msg, rinfo);
    maybeBatchFlush();
  } catch (err) {
    console.error('[parse] error:', err.message);
  }
});

server.on('listening', () => {
  const addr = server.address();
  console.log(`[collector] NetFlow v9 listening on UDP ${addr.address}:${addr.port}`);
  console.log(`[collector] ClickHouse target: ${CLICKHOUSE_URL}`);
  console.log(`[collector] Batch size: ${BATCH_SIZE}, flush interval: ${FLUSH_INTERVAL}ms`);
});

flushTimer = setInterval(scheduledFlush, FLUSH_INTERVAL);

server.bind(LISTEN_PORT, '0.0.0.0');

process.on('SIGTERM', () => {
  console.log('[collector] Shutting down...');
  clearInterval(flushTimer);
  scheduledFlush();
  server.close();
  process.exit(0);
});
