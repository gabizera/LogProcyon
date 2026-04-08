'use strict';

/**
 * Juniper Networks (MX series) NAT syslog parser
 *
 * Juniper structured syslog / RT_NAT log format:
 *   <PRI>DATE TIME hostname RT_NAT: RT_NAT_SESSION_CREATE: ... src-nat-rule-name="..." pre-nat-src-address=<IP> post-nat-src-address=<IP> ...
 *
 * Reference: Juniper JUNOS NAT Logging documentation
 * STATUS: STUB — needs real Juniper log samples to finalize
 */

const generic = require('./syslog-generic');

module.exports = {
  protocol: 'udp',

  parse(buf, rinfo, config, tzOffsetMs) {
    const line = buf.toString('utf8', 0, Math.min(buf.length, 2048));

    const preNatIp    = line.match(/pre-nat-src-address=(\d+\.\d+\.\d+\.\d+)/i);
    const postNatIp   = line.match(/post-nat-src-address=(\d+\.\d+\.\d+\.\d+)/i);
    const preNatPort  = line.match(/pre-nat-src-port=(\d+)/i);
    const postNatPort = line.match(/post-nat-src-port=(\d+)/i);
    const protoMatch  = line.match(/protocol-id=(\d+)/i);

    if (preNatIp && postNatIp) {
      const ts = new Date(Date.now() + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);
      const protoId = protoMatch ? parseInt(protoMatch[1], 10) : 6;
      return [{
        timestamp:          ts,
        ip_publico:         postNatIp[1],
        ip_privado:         preNatIp[1],
        porta_publica:      postNatPort ? parseInt(postNatPort[1], 10) : 0,
        porta_privada:      preNatPort  ? parseInt(preNatPort[1], 10) : 0,
        tamanho_bloco:      0,
        protocolo:          protoId === 17 ? 'UDP' : 'TCP',
        tipo_nat:           'cgnat',
        equipamento_origem: config?.name || 'juniper',
        payload_raw:        line.slice(0, 1000),
      }];
    }

    return generic.parse(buf, rinfo, config, tzOffsetMs);
  },
};
