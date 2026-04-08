'use strict';

/**
 * A10 Networks CGN syslog parser
 *
 * A10 CGN log format (LSN session):
 *   <134>DATE TIME HOSTNAME CGN[PID]: LSN-SESSION-CREATE inside=<IP>:<PORT> outside=<IP>:<PORT> protocol=<N> ...
 *
 * Reference: A10 aGalaxy/ACOS CGN Logging Guide
 * STATUS: STUB — needs real A10 log samples to finalize field extraction
 */

const generic = require('./syslog-generic');

module.exports = {
  protocol: 'udp',

  parse(buf, rinfo, config, tzOffsetMs) {
    const line = buf.toString('utf8', 0, Math.min(buf.length, 2048));

    // A10 CGN session create: inside=<IP>:<PORT> outside=<IP>:<PORT>
    const insideMatch  = line.match(/inside=(\d+\.\d+\.\d+\.\d+):(\d+)/i);
    const outsideMatch = line.match(/outside=(\d+\.\d+\.\d+\.\d+):(\d+)/i);
    const protoMatch   = line.match(/protocol=(\d+)/i);

    if (insideMatch && outsideMatch) {
      const ts = new Date(Date.now() + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
      const proto = protoMatch ? (protoMatch[1] === '6' ? 'TCP' : 'UDP') : 'TCP';
      return [{
        timestamp:          ts,
        ip_publico:         outsideMatch[1],
        ip_privado:         insideMatch[1],
        porta_publica:      parseInt(outsideMatch[2], 10),
        porta_privada:      parseInt(insideMatch[2], 10),
        tamanho_bloco:      0,
        protocolo:          proto,
        tipo_nat:           'cgnat',
        equipamento_origem: config?.name || 'a10',
        payload_raw:        line.slice(0, 1000),
      }];
    }

    // Fallback to generic syslog parser
    return generic.parse(buf, rinfo, config, tzOffsetMs);
  },
};
