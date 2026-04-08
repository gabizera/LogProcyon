'use strict';

/**
 * Generic syslog parser (UDP/TCP)
 * Base parser for equipment that sends syslog-format NAT events.
 * Used as fallback; extend for specific vendors (A10, Nokia, Hillstone, etc.)
 *
 * Expected log format (CEF-like or key=value):
 *   <priority>TIMESTAMP HOST APP: src=<ip> sport=<port> dst=<ip> dport=<port> proto=<TCP|UDP> nat_src=<ip> nat_sport=<port>
 *
 * Override `extractFields()` in vendor-specific parsers.
 */

function parseSyslogPri(buf) {
  const str = buf.toString('utf8', 0, Math.min(buf.length, 1024));
  return str;
}

/**
 * Attempt to extract key=value pairs from a syslog line.
 * Returns { src_ip, src_port, nat_ip, nat_port, protocol } or null.
 */
function extractFields(line) {
  const kv = {};
  const kvRegex = /(\w+)=([^\s]+)/g;
  let m;
  while ((m = kvRegex.exec(line)) !== null) {
    kv[m[1].toLowerCase()] = m[2];
  }

  const src_ip   = kv.src   || kv.source_ip || kv.srcip  || null;
  const nat_ip   = kv.nat   || kv.nat_src   || kv.postnat_src || kv.xlate_src || null;
  const src_port = parseInt(kv.sport || kv.src_port || kv.srcport || '0', 10) || 0;
  const nat_port = parseInt(kv.dport || kv.nat_port || kv.postnat_sport || '0', 10) || 0;
  const protocol = (kv.proto || kv.protocol || 'TCP').toUpperCase();

  if (!src_ip && !nat_ip) return null;
  return { src_ip, nat_ip, src_port, nat_port, protocol };
}

module.exports = {
  protocol: 'udp',

  parse(buf, rinfo, config, tzOffsetMs) {
    try {
      const line = parseSyslogPri(buf);
      const fields = extractFields(line);
      if (!fields) return [];

      const ts = new Date(Date.now() + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);

      return [{
        timestamp:          ts,
        ip_publico:         fields.nat_ip   || '0.0.0.0',
        ip_privado:         fields.src_ip   || '0.0.0.0',
        porta_publica:      fields.nat_port || 0,
        porta_privada:      fields.src_port || 0,
        tamanho_bloco:      0,
        protocolo:          fields.protocol === 'UDP' ? 'UDP' : 'TCP',
        tipo_nat:           'cgnat',
        equipamento_origem: config?.name || rinfo.address,
        payload_raw:        line.slice(0, 1000),
      }];
    } catch (e) {
      console.error('[syslog-generic] parse error:', e.message);
      return [];
    }
  },
};
