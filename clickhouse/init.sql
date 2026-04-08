-- ============================================================
-- NAT/CGNAT/BPA Log Platform - ClickHouse Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS default;

CREATE TABLE IF NOT EXISTS nat_logs (
    id UUID DEFAULT generateUUIDv4(),
    timestamp DateTime64(3),
    ip_publico IPv4,
    ip_privado IPv4,
    porta_publica UInt16,
    porta_privada UInt16,
    tamanho_bloco UInt16 DEFAULT 0,
    protocolo LowCardinality(String),
    tipo_nat LowCardinality(String),
    equipamento_origem LowCardinality(String),
    payload_raw String,
    inserted_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, ip_publico, ip_privado)
TTL timestamp + INTERVAL 15 MONTH
SETTINGS index_granularity = 8192;

-- Secondary indices for fast IP lookups
ALTER TABLE nat_logs ADD INDEX IF NOT EXISTS idx_ip_publico ip_publico TYPE minmax GRANULARITY 4;
ALTER TABLE nat_logs ADD INDEX IF NOT EXISTS idx_ip_privado ip_privado TYPE minmax GRANULARITY 4;

-- Materialized view for per-hour aggregation (dashboard queries)
CREATE TABLE IF NOT EXISTS nat_logs_hourly (
    hour DateTime,
    protocolo LowCardinality(String),
    tipo_nat LowCardinality(String),
    equipamento_origem LowCardinality(String),
    total_count UInt64,
    unique_public_ips AggregateFunction(uniq, IPv4),
    unique_private_ips AggregateFunction(uniq, IPv4)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, protocolo, tipo_nat, equipamento_origem)
TTL hour + INTERVAL 15 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS nat_logs_hourly_mv
TO nat_logs_hourly
AS
SELECT
    toStartOfHour(timestamp) AS hour,
    protocolo,
    tipo_nat,
    equipamento_origem,
    count() AS total_count,
    uniqState(ip_publico) AS unique_public_ips,
    uniqState(ip_privado) AS unique_private_ips
FROM nat_logs
GROUP BY hour, protocolo, tipo_nat, equipamento_origem;
