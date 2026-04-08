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

  // Try exact match: equipment_type + protocol_type
  const key1 = `${equipment_type}_${protocol_type}`.replace(/-/g, '_');
  if (parsers[key1]) return parsers[key1];

  // Try protocol_type alone
  const key2 = protocol_type?.replace(/-/g, '_');
  if (parsers[key2]) return parsers[key2];

  // Try equipment_type alone
  const key3 = `${equipment_type}_syslog`;
  if (parsers[key3]) return parsers[key3];

  // Fallback to generic
  console.warn(`[parsers] No parser for equipment=${equipment_type} protocol=${protocol_type}, using generic`);
  return parsers.generic;
}

module.exports = { getParser, parsers };
