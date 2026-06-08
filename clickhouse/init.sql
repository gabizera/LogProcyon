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
TTL toDateTime(timestamp) + INTERVAL 15 MONTH
SETTINGS index_granularity = 8192;

-- Secondary indices for fast IP lookups
ALTER TABLE nat_logs ADD INDEX IF NOT EXISTS idx_ip_publico ip_publico TYPE minmax GRANULARITY 4;
ALTER TABLE nat_logs ADD INDEX IF NOT EXISTS idx_ip_privado ip_privado TYPE minmax GRANULARITY 4;

-- Rollup horário p/ o dashboard (contagem + IPs únicos por hora/proto/tipo/equip).
-- total_count É SimpleAggregateFunction(sum): numa AggregatingMergeTree, coluna
-- comum NÃO soma no merge — só agregada. UInt64 puro guardava 1 bloco por chave
-- (rollup dava 23k em vez de 293M). Ver clickhouse/migrations/001-fix-rollups.sql.
CREATE TABLE IF NOT EXISTS nat_logs_hourly (
    hour DateTime,
    protocolo LowCardinality(String),
    tipo_nat LowCardinality(String),
    equipamento_origem LowCardinality(String),
    total_count SimpleAggregateFunction(sum, UInt64),
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

-- Rollups diários de Top IPs (público/privado) p/ o dashboard. Excluem ICMP
-- (ruído CGNAT, igual ao painel). Tiram o "GROUP BY ip" da tabela crua de 290M
-- (era ~28s) — public ~234 IPs, private ~10k IPs, sobra minúsculo.
CREATE TABLE IF NOT EXISTS nat_logs_pubip_daily (
    day Date,
    equipamento_origem LowCardinality(String),
    ip_publico IPv4,
    cnt SimpleAggregateFunction(sum, UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, equipamento_origem, ip_publico)
TTL day + INTERVAL 15 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS nat_logs_pubip_daily_mv
TO nat_logs_pubip_daily
AS
SELECT toDate(timestamp) AS day, equipamento_origem, ip_publico, count() AS cnt
FROM nat_logs WHERE protocolo != 'ICMP'
GROUP BY day, equipamento_origem, ip_publico;

CREATE TABLE IF NOT EXISTS nat_logs_privip_daily (
    day Date,
    equipamento_origem LowCardinality(String),
    ip_privado IPv4,
    cnt SimpleAggregateFunction(sum, UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, equipamento_origem, ip_privado)
TTL day + INTERVAL 15 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS nat_logs_privip_daily_mv
TO nat_logs_privip_daily
AS
SELECT toDate(timestamp) AS day, equipamento_origem, ip_privado, count() AS cnt
FROM nat_logs WHERE protocolo != 'ICMP'
GROUP BY day, equipamento_origem, ip_privado;
