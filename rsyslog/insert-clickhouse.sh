#!/bin/bash
# Reads lines from rsyslog (omprog), parses NAT/CGNAT/BPA fields, inserts into ClickHouse.
# Each line: <timestamp>\t<message>

CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://clickhouse:8123}"
BATCH_SIZE=100
BATCH_TIMEOUT=2
BUFFER=""
COUNT=0
LAST_FLUSH=$(date +%s)

flush_buffer() {
    if [ -n "$BUFFER" ]; then
        echo "$BUFFER" | curl -s -X POST \
            "${CLICKHOUSE_URL}/?query=INSERT+INTO+nat_logs+(timestamp,ip_publico,ip_privado,porta_publica,porta_privada,protocolo,tipo_nat,equipamento_origem,payload_raw)+FORMAT+JSONEachRow" \
            --data-binary @- > /dev/null 2>&1
        BUFFER=""
        COUNT=0
        LAST_FLUSH=$(date +%s)
    fi
}

parse_and_queue() {
    local ts="$1"
    local msg="$2"

    local ip_pub="0.0.0.0"
    local ip_priv="0.0.0.0"
    local port_pub=0
    local port_priv=0
    local proto="UNKNOWN"
    local tipo="unknown"
    local equip="unknown"

    # Format 1: NAT|CGNAT TCP 203.0.113.1:40000 -> 10.100.0.50:12345 on equipment
    if echo "$msg" | grep -qP '(NAT|CGNAT|BPA)\s+(TCP|UDP)\s+[\d.]+:\d+\s+->\s+[\d.]+:\d+\s+on\s+\S+'; then
        tipo=$(echo "$msg" | grep -oP '(NAT|CGNAT|BPA)' | head -1 | tr '[:upper:]' '[:lower:]')
        proto=$(echo "$msg" | grep -oP '(TCP|UDP)' | head -1)
        ip_pub=$(echo "$msg" | grep -oP '(NAT|CGNAT|BPA)\s+(TCP|UDP)\s+\K[\d.]+' | head -1)
        port_pub=$(echo "$msg" | grep -oP '(NAT|CGNAT|BPA)\s+(TCP|UDP)\s+[\d.]+:\K\d+' | head -1)
        ip_priv=$(echo "$msg" | grep -oP '->\s+\K[\d.]+' | head -1)
        port_priv=$(echo "$msg" | grep -oP '->\s+[\d.]+:\K\d+' | head -1)
        equip=$(echo "$msg" | grep -oP 'on\s+\K\S+' | head -1)

    # Format 2: CGNAT: proto=UDP public=IP:PORT private=IP:PORT device=NAME
    elif echo "$msg" | grep -qP '(CGNAT|NAT|BPA):\s+proto=(TCP|UDP)\s+public=[\d.]+:\d+\s+private=[\d.]+:\d+\s+device=\S+'; then
        tipo=$(echo "$msg" | grep -oP '^[^:]+' | grep -oP '(CGNAT|NAT|BPA)' | head -1 | tr '[:upper:]' '[:lower:]')
        proto=$(echo "$msg" | grep -oP 'proto=\K(TCP|UDP)' | head -1)
        ip_pub=$(echo "$msg" | grep -oP 'public=\K[\d.]+' | head -1)
        port_pub=$(echo "$msg" | grep -oP 'public=[\d.]+:\K\d+' | head -1)
        ip_priv=$(echo "$msg" | grep -oP 'private=\K[\d.]+' | head -1)
        port_priv=$(echo "$msg" | grep -oP 'private=[\d.]+:\K\d+' | head -1)
        equip=$(echo "$msg" | grep -oP 'device=\K\S+' | head -1)

    # Format 3: BPA IP PROTO_NUM ext=PORT int=IP:PORT router=NAME
    elif echo "$msg" | grep -qP '(BPA|NAT|CGNAT)\s+[\d.]+\s+\d+\s+ext=\d+\s+int=[\d.]+:\d+\s+router=\S+'; then
        tipo=$(echo "$msg" | grep -oP '(BPA|NAT|CGNAT)' | head -1 | tr '[:upper:]' '[:lower:]')
        ip_pub=$(echo "$msg" | grep -oP '(BPA|NAT|CGNAT)\s+\K[\d.]+' | head -1)
        local proto_num=$(echo "$msg" | grep -oP '(BPA|NAT|CGNAT)\s+[\d.]+\s+\K\d+' | head -1)
        case "$proto_num" in
            6)  proto="TCP" ;;
            17) proto="UDP" ;;
            *)  proto="$proto_num" ;;
        esac
        port_pub=$(echo "$msg" | grep -oP 'ext=\K\d+' | head -1)
        ip_priv=$(echo "$msg" | grep -oP 'int=\K[\d.]+' | head -1)
        port_priv=$(echo "$msg" | grep -oP 'int=[\d.]+:\K\d+' | head -1)
        equip=$(echo "$msg" | grep -oP 'router=\K\S+' | head -1)
    fi

    # Escape payload for JSON
    local payload=$(echo "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')

    local json="{\"timestamp\":\"${ts}\",\"ip_publico\":\"${ip_pub}\",\"ip_privado\":\"${ip_priv}\",\"porta_publica\":${port_pub},\"porta_privada\":${port_priv},\"protocolo\":\"${proto}\",\"tipo_nat\":\"${tipo}\",\"equipamento_origem\":\"${equip}\",\"payload_raw\":\"${payload}\"}"

    if [ -n "$BUFFER" ]; then
        BUFFER="${BUFFER}
${json}"
    else
        BUFFER="${json}"
    fi
    COUNT=$((COUNT + 1))
}

# Main loop: read from stdin (omprog)
while IFS=$'\t' read -r timestamp message; do
    parse_and_queue "$timestamp" "$message"

    NOW=$(date +%s)
    ELAPSED=$((NOW - LAST_FLUSH))

    if [ "$COUNT" -ge "$BATCH_SIZE" ] || [ "$ELAPSED" -ge "$BATCH_TIMEOUT" ]; then
        flush_buffer
    fi
done

# Flush remaining
flush_buffer
