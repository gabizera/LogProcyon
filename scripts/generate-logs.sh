#!/usr/bin/env bash
# ============================================================
# generate-logs.sh - Generate realistic NAT/CGNAT/BPA syslog messages
# Usage: ./generate-logs.sh [count] [target_host] [target_port]
#   count       - Number of messages to generate (default: 100)
#   target_host - Syslog destination host (default: 127.0.0.1)
#   target_port - Syslog destination port (default: 514)
# ============================================================

set -euo pipefail

COUNT="${1:-100}"
TARGET_HOST="${2:-127.0.0.1}"
TARGET_PORT="${3:-514}"

# -----------------------------------------------------------
# Pool data for realistic variation
# -----------------------------------------------------------
PUBLIC_SUBNETS=("203.0.113" "198.51.100" "192.0.2" "100.65.0" "100.66.0" "177.52.10" "177.52.11" "189.40.100" "189.40.101")
PRIVATE_SUBNETS=("10.100.0" "10.100.1" "10.200.0" "10.200.1" "100.64.0" "100.64.1" "100.64.2" "100.64.3" "172.16.0" "172.16.1")
PROTOCOLS=("TCP" "UDP")
PROTO_NUMS=("6" "17")
NAT_TYPES=("NAT" "CGNAT" "BPA")
EQUIPMENTS=("cgnat-sp-01" "cgnat-sp-02" "cgnat-rj-01" "bras-north-01" "bras-south-01" "pe-edge-01" "pe-edge-02" "pe-edge-03" "asr9k-core-01" "asr9k-core-02")

# -----------------------------------------------------------
# Helper functions
# -----------------------------------------------------------
rand_range() {
    local min=$1 max=$2
    echo $(( RANDOM % (max - min + 1) + min ))
}

rand_element() {
    local arr=("$@")
    echo "${arr[RANDOM % ${#arr[@]}]}"
}

rand_ip_suffix() {
    echo "$(rand_range 1 254)"
}

rand_port() {
    echo "$(rand_range 1024 65535)"
}

# -----------------------------------------------------------
# Message generators (3 formats matching rsyslog.conf parsers)
# -----------------------------------------------------------

# Format 1: NAT TCP 203.0.113.1:40000 -> 10.100.0.50:12345 on equipment-cgnat-01
generate_format1() {
    local nat_type=$(rand_element "${NAT_TYPES[@]}")
    local proto=$(rand_element "${PROTOCOLS[@]}")
    local pub_subnet=$(rand_element "${PUBLIC_SUBNETS[@]}")
    local priv_subnet=$(rand_element "${PRIVATE_SUBNETS[@]}")
    local pub_ip="${pub_subnet}.$(rand_ip_suffix)"
    local priv_ip="${priv_subnet}.$(rand_ip_suffix)"
    local pub_port=$(rand_port)
    local priv_port=$(rand_port)
    local equip=$(rand_element "${EQUIPMENTS[@]}")

    echo "${nat_type} ${proto} ${pub_ip}:${pub_port} -> ${priv_ip}:${priv_port} on ${equip}"
}

# Format 2: CGNAT: proto=UDP public=198.51.100.5:30000 private=100.64.1.10:54321 device=bras-north-01
generate_format2() {
    local nat_type=$(rand_element "${NAT_TYPES[@]}")
    local proto=$(rand_element "${PROTOCOLS[@]}")
    local pub_subnet=$(rand_element "${PUBLIC_SUBNETS[@]}")
    local priv_subnet=$(rand_element "${PRIVATE_SUBNETS[@]}")
    local pub_ip="${pub_subnet}.$(rand_ip_suffix)"
    local priv_ip="${priv_subnet}.$(rand_ip_suffix)"
    local pub_port=$(rand_port)
    local priv_port=$(rand_port)
    local equip=$(rand_element "${EQUIPMENTS[@]}")

    echo "${nat_type}: proto=${proto} public=${pub_ip}:${pub_port} private=${priv_ip}:${priv_port} device=${equip}"
}

# Format 3: BPA 192.0.2.100 6 ext=50000 int=100.64.0.5:60000 router=pe-edge-03
generate_format3() {
    local nat_type=$(rand_element "${NAT_TYPES[@]}")
    local proto_idx=$(( RANDOM % 2 ))
    local proto_num="${PROTO_NUMS[$proto_idx]}"
    local pub_subnet=$(rand_element "${PUBLIC_SUBNETS[@]}")
    local priv_subnet=$(rand_element "${PRIVATE_SUBNETS[@]}")
    local pub_ip="${pub_subnet}.$(rand_ip_suffix)"
    local priv_ip="${priv_subnet}.$(rand_ip_suffix)"
    local pub_port=$(rand_port)
    local priv_port=$(rand_port)
    local equip=$(rand_element "${EQUIPMENTS[@]}")

    echo "${nat_type} ${pub_ip} ${proto_num} ext=${pub_port} int=${priv_ip}:${priv_port} router=${equip}"
}

# -----------------------------------------------------------
# Main loop
# -----------------------------------------------------------
echo "Generating ${COUNT} NAT/CGNAT/BPA log messages to ${TARGET_HOST}:${TARGET_PORT} (UDP)..."

sent=0
for (( i=1; i<=COUNT; i++ )); do
    # Pick a random format
    format=$(rand_range 1 3)
    case $format in
        1) msg=$(generate_format1) ;;
        2) msg=$(generate_format2) ;;
        3) msg=$(generate_format3) ;;
    esac

    # Build RFC 3164 syslog header
    facility=16  # local0
    severity=6   # info
    pri=$(( facility * 8 + severity ))
    timestamp=$(date '+%b %d %H:%M:%S')
    hostname="logsim"
    tag="natlog"
    syslog_msg="<${pri}>${timestamp} ${hostname} ${tag}: ${msg}"

    # Send via UDP using /dev/udp or nc
    if command -v nc &>/dev/null; then
        echo -n "${syslog_msg}" | nc -u -w0 "${TARGET_HOST}" "${TARGET_PORT}" 2>/dev/null || true
    elif [[ -e /dev/udp/${TARGET_HOST}/${TARGET_PORT} ]] 2>/dev/null; then
        echo -n "${syslog_msg}" > "/dev/udp/${TARGET_HOST}/${TARGET_PORT}" 2>/dev/null || true
    else
        logger -n "${TARGET_HOST}" -P "${TARGET_PORT}" -d -p local0.info -t natlog "${msg}" 2>/dev/null || true
    fi

    sent=$((sent + 1))

    # Progress indicator every 100 messages
    if (( sent % 100 == 0 )); then
        echo "  Sent ${sent}/${COUNT} messages..."
    fi
done

echo "Done. Sent ${sent} messages."
