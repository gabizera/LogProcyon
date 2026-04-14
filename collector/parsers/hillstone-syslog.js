'use strict';

/**
 * Hillstone Networks firewall/CGNAT syslog parser
 *
 * Formato real observado em produção (NAT444 session-based):
 *   <134> 1 2026 Apr 14 18:54:19 PLAYLINK - - NAT444:sessionbasedA
 *   [6 100.64.6.37 - 200.219.30.159 48558 38287 - 157.240.12.54 5222]
 *
 * Campos entre colchetes:
 *   [proto_num ip_priv - ip_pub porta_priv porta_pub - ip_dst porta_dst]
 * onde proto_num segue a IANA (6=TCP, 17=UDP, 1=ICMP).
 *
 * Mantém fallback pro formato key=value (srcip=/natip=/) caso outras
 * versões da Hillstone usem.
 */

const generic = require('./syslog-generic');

const PROTO_MAP = { 6: 'TCP', 17: 'UDP', 1: 'ICMP' };

// [proto ip_priv - ip_pub priv_port pub_port - ip_dst dst_port]
const NAT444_RE = /\[(\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+-\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(\d+)\s+-\s+/;

module.exports = {
  protocol: 'udp',

  parse(buf, rinfo, config, tzOffsetMs) {
    const line = buf.toString('utf8', 0, Math.min(buf.length, 2048));
    const ts = new Date(Date.now() + tzOffsetMs).toISOString().replace('T', ' ').replace('Z', '').slice(0, 23);

    // Formato NAT444 session-based. Os dois números após o IP público são
    // porta INICIAL e porta FINAL do bloco alocado — normalizamos pra
    // (min, max) e armazenamos como porta_publica + tamanho_bloco no schema
    // padrão, compatível com os BPA do Cisco.
    const m = line.match(NAT444_RE);
    if (m) {
      const protoNum = parseInt(m[1], 10);
      const a = parseInt(m[4], 10);
      const b = parseInt(m[5], 10);
      const portaInicio = Math.min(a, b);
      const portaFim    = Math.max(a, b);
      return [{
        timestamp:          ts,
        ip_publico:         m[3],
        ip_privado:         m[2],
        porta_publica:      portaInicio,
        porta_privada:      0,
        tamanho_bloco:      portaFim - portaInicio + 1,
        protocolo:          PROTO_MAP[protoNum] || String(protoNum),
        tipo_nat:           'nat444',
        equipamento_origem: config?.name || 'hillstone',
        payload_raw:        line.slice(0, 1000),
      }];
    }

    // Fallback: formato key=value (compatibilidade com outras versões)
    const srcIpMatch   = line.match(/srcip=(\d+\.\d+\.\d+\.\d+)/i);
    const srcPortMatch = line.match(/srcport=(\d+)/i);
    const natIpMatch   = line.match(/natip=(\d+\.\d+\.\d+\.\d+)/i);
    const natPortMatch = line.match(/natport=(\d+)/i);
    const protoMatch   = line.match(/proto=(tcp|udp)/i);

    if (srcIpMatch && natIpMatch) {
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
