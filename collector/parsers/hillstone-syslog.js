'use strict';

/**
 * Hillstone Networks firewall/CGNAT syslog parser
 *
 * Hillstone log format (NAT session):
 *   <PRI>DATE TIME host_id hillstone[PID]: NAT_CREATE srcip=<IP> srcport=<PORT> natip=<IP> natport=<PORT> proto=<TCP|UDP>
 *
 * Reference: Hillstone Networks Syslog Reference Guide
 * STATUS: STUB — needs real Hillstone log samples to finalize
 */

const generic = require('./syslog-generic');

module.exports = {
  protocol: 'udp',

  parse(buf, rinfo, config, tzOffsetMs) {
    const line = buf.toString('utf8', 0, Math.min(buf.length, 2048));

    const srcIpMatch   = line.match(/srcip=(\d+\.\d+\.\d+\.\d+)/i);
    const srcPortMatch = line.match(/srcport=(\d+)/i);
    const natIpMatch   = line.match(/natip=(\d+\.\d+\.\d+\.\d+)/i);
    const natPortMatch = line.match(/natport=(\d+)/i);
    const protoMatch   = line.match(/proto=(tcp|udp)/i);

    if (srcIpMatch && natIpMatch) {
      const ts = new Date(Date.now() + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
      return [{
        timestamp:          ts,
        ip_publico:         natIpMatch[1],
        ip_privado:         srcIpMatch[1],
        porta_publica:      natPortMatch  ? parseInt(natPortMatch[1], 10) : 0,
        porta_privada:      srcPortMatch  ? parseInt(srcPortMatch[1], 10) : 0,
        tamanho_bloco:      0,
        protocolo:          protoMatch ? protoMatch[1].toUpperCase() : 'TCP',
        tipo_nat:           'cgnat',
        equipamento_origem: config?.name || 'hillstone',
        payload_raw:        line.slice(0, 1000),
      }];
    }

    return generic.parse(buf, rinfo, config, tzOffsetMs);
  },
};
