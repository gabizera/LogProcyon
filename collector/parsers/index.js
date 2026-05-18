'use strict';

/**
 * Parser registry — maps equipment_type + protocol_type to a parser module.
 */

const parsers = {
  cisco_netflow_v9:   require('./cisco-netflow9'),
  cisco_netflow9:     require('./cisco-netflow9'),  // alias
  a10_syslog:         require('./a10-syslog'),
  nokia_syslog:       require('./nokia-syslog'),
  hillstone_syslog:   require('./hillstone-syslog'),
  juniper_syslog:     require('./juniper-syslog'),
  syslog_udp:         require('./syslog-generic'),
  syslog_tcp:         require('./syslog-generic'),
  generic:            require('./syslog-generic'),
};

/**
 * Get the right parser for a given input config.
 * @param {object} inputConfig - { equipment_type, protocol_type }
 * @returns parser module with a `parse()` function
 */
function getParser(inputConfig) {
  const { equipment_type, protocol_type } = inputConfig;

  // 1. Match exato: equipment_type + protocol_type
  const key1 = `${equipment_type}_${protocol_type}`.replace(/-/g, '_');
  if (parsers[key1]) return parsers[key1];

  // 2. Parser ESPECÍFICO do equipamento (hillstone_syslog, a10_syslog...).
  //    Vem ANTES do protocolo genérico: senão protocol_type=syslog_udp
  //    cai no parser genérico e ignora o formato do equipamento.
  const key3 = `${equipment_type}_syslog`;
  if (parsers[key3]) return parsers[key3];

  // 3. protocol_type sozinho (syslog_udp/tcp → genérico)
  const key2 = protocol_type?.replace(/-/g, '_');
  if (parsers[key2]) return parsers[key2];

  // 4. Fallback genérico
  console.warn(`[parsers] No parser for equipment=${equipment_type} protocol=${protocol_type}, using generic`);
  return parsers.generic;
}

module.exports = { getParser, parsers };
