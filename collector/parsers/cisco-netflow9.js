'use strict';

/**
 * Cisco NAT Event Logging — NetFlow v9 parser
 * Handles: ip nat log translations flow-export v9 udp destination <ip> <port>
 */

const templates = {}; // sourceId -> templateId -> fields

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
    const templateId = buf.readUInt16BE(offset); offset += 2;
    const fieldCount  = buf.readUInt16BE(offset); offset += 2;
    if (templateId === 0 || fieldCount === 0) break;
    const fields = [];
    for (let i = 0; i < fieldCount; i++) {
      if (offset + 4 > end) break;
      fields.push({ fieldType: buf.readUInt16BE(offset), fieldLength: buf.readUInt16BE(offset + 2) });
      offset += 4;
    }
    if (!templates[sourceId]) templates[sourceId] = {};
    templates[sourceId][templateId] = fields;
  }
}

function parseDataFlowset(buf, offset, end, flowsetId, sourceId, unixSecs, tzOffsetMs) {
  const tmpl = templates[sourceId]?.[flowsetId];
  if (!tmpl) return [];

  const recordSize = tmpl.reduce((s, f) => s + f.fieldLength, 0);
  if (recordSize === 0) return [];

  const rows = [];

  while (offset + recordSize <= end) {
    const record = {};
    let pos = offset;

    for (const { fieldType, fieldLength } of tmpl) {
      let val;
      if (fieldLength === 4 && [8, 12, 225, 226].includes(fieldType)) {
        val = readIPv4(buf, pos);
      } else if (fieldLength <= 8) {
        val = readUInt(buf, pos, fieldLength);
      } else {
        val = buf.slice(pos, pos + fieldLength).toString('hex');
      }
      record[`field_${fieldType}`] = val;

      switch (fieldType) {
        case 4:   record.protocol          = val; break;
        case 7:   record.src_port          = val; break;
        case 8:   record.src_ip            = val; break;
        case 11:  record.dst_port          = val; break;
        case 12:  record.dst_ip            = val; break;
        case 225: record.post_nat_src_ip   = val; break;
        case 226: record.post_nat_dst_ip   = val; break;
        case 227: record.post_nat_src_port = val; break;
        case 228: record.post_nat_dst_port = val; break;
        case 230: record.nat_event         = val; break;
        case 233: record.fw_event          = val; break;
        case 234: record.ingress_vrf       = val; break;
        case 323: record.event_time_msec   = val; break;
        case 361: record.port_block_start  = val; break;
        case 364: record.field_364         = val; break;
      }
      pos += fieldLength;
    }
    offset += recordSize;

    const proto = record.protocol;
    if (proto !== 6 && proto !== 17) continue;

    const ip_privado = record.src_ip          || '0.0.0.0';
    const ip_publico = record.post_nat_src_ip || '0.0.0.0';
    if (ip_publico === '0.0.0.0' && ip_privado === '0.0.0.0') continue;

    const porta_pub  = record.port_block_start || record.post_nat_src_port || record.dst_port || 0;
    const porta_priv = record.src_port || 0;

    let ts;
    if (record.event_time_msec && record.event_time_msec > 1000000000000) {
      ts = new Date(Number(record.event_time_msec) + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
    } else {
      ts = new Date(unixSecs * 1000 + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
    }

    rows.push({
      timestamp:          ts,
      ip_publico,
      ip_privado,
      porta_publica:      porta_pub,
      porta_privada:      porta_priv,
      tamanho_bloco:      record.field_364 || 0,
      protocolo:          proto === 6 ? 'TCP' : 'UDP',
      tipo_nat:           record.port_block_start ? 'bpa' : 'cgnat',
      equipamento_origem: 'cisco',
      payload_raw:        JSON.stringify(record),
    });
  }

  return rows;
}

module.exports = {
  protocol: 'udp',

  /**
   * @param {Buffer} buf
   * @param {object} rinfo - { address, port }
   * @param {object} config - input config (name, equipment_type, etc.)
   * @param {number} tzOffsetMs
   * @returns {Array} rows to insert, or []
   */
  parse(buf, rinfo, config, tzOffsetMs) {
    if (buf.length < 20) return [];
    const version = buf.readUInt16BE(0);
    if (version !== 9) {
      console.warn(`[cisco-netflow9] Unknown version ${version} from ${rinfo.address}`);
      return [];
    }

    const count    = buf.readUInt16BE(2);
    const unixSecs = buf.readUInt32BE(8);
    const sourceId = buf.readUInt32BE(16);

    let offset = 20;
    let parsed = 0;
    const allRows = [];

    while (offset + 4 <= buf.length && parsed < count) {
      const flowsetId = buf.readUInt16BE(offset);
      const length    = buf.readUInt16BE(offset + 2);
      if (length < 4 || offset + length > buf.length) break;

      const fsStart = offset + 4;
      const fsEnd   = offset + length;

      if (flowsetId === 0) {
        parseTemplateFlowset(buf, fsStart, fsEnd, sourceId);
      } else if (flowsetId >= 256) {
        const rows = parseDataFlowset(buf, fsStart, fsEnd, flowsetId, sourceId, unixSecs, tzOffsetMs);
        // Stamp with configured equipment name if set
        const equipName = config?.name || 'cisco';
        rows.forEach(r => { r.equipamento_origem = equipName; });
        allRows.push(...rows);
      }

      offset += length;
      parsed++;
    }

    return allRows;
  },
};
