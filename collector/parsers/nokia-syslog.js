'use strict';

/**
 * Nokia (NOKIA) BNG/BRAS syslog NAT parser
 *
 * Nokia 7750 SR / SROS NAT event log format:
 *   <PRI>DATE TIME timos HOST LOGGER #NAT: subscriber=<IP> ...
 *
 * Reference: Nokia SROS NAT Logging documentation
 * STATUS: STUB — needs real Nokia log samples to finalize
 */

const generic = require('./syslog-generic');

module.exports = {
  protocol: 'udp',

  parse(buf, rinfo, config, tzOffsetMs) {
    const line = buf.toString('utf8', 0, Math.min(buf.length, 2048));

    // Nokia NAT session: subscriber=<IP> nat-ip=<IP> nat-port=<PORT> ...
    const subMatch  = line.match(/subscriber=(\d+\.\d+\.\d+\.\d+)/i);
    const natIpMatch = line.match(/nat-ip=(\d+\.\d+\.\d+\.\d+)/i);
    const natPortMatch = line.match(/nat-port=(\d+)/i);
    const protoMatch = line.match(/protocol=(tcp|udp)/i);

    if (subMatch && natIpMatch) {
      const ts = new Date(Date.now() + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
      return [{
        timestamp:          ts,
        ip_publico:         natIpMatch[1],
        ip_privado:         subMatch[1],
        porta_publica:      natPortMatch ? parseInt(natPortMatch[1], 10) : 0,
        porta_privada:      0,
        tamanho_bloco:      0,
        protocolo:          protoMatch ? protoMatch[1].toUpperCase() : 'TCP',
        tipo_nat:           'cgnat',
        equipamento_origem: config?.name || 'nokia',
        payload_raw:        line.slice(0, 1000),
      }];
    }

    return generic.parse(buf, rinfo, config, tzOffsetMs);
  },
};
