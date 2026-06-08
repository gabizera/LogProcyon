-- ============================================================
-- Migração 001 — conserta o rollup horário e cria rollups de top-IPs
--
-- PROBLEMA: nat_logs_hourly tinha `total_count UInt64` numa
-- AggregatingMergeTree. Coluna comum NÃO é somada no merge — só
-- AggregateFunction/SimpleAggregateFunction. Resultado: o rollup
-- guardava a contagem de UM bloco por (hora,dims), não a soma →
-- sum(total_count) dava 23.888 em vez de 293M. Inutilizável.
--
-- CORREÇÃO: total_count vira SimpleAggregateFunction(sum, UInt64).
-- Mais 2 rollups (dia, IP) p/ os top-IPs do dashboard saírem da
-- tabela crua (eram as queries de 28s). Tudo é DADO DERIVADO —
-- a tabela legal nat_logs NÃO é tocada (só lida no backfill).
--
-- Idempotente o suficiente p/ rodar uma vez no deploy atual.
-- ============================================================

-- Backfill seguro de memória (container de 3 GB): derrama no disco se precisar.
SET max_memory_usage = 2200000000;
SET max_bytes_before_external_group_by = 1200000000;

-- ── 1. Rollup HORÁRIO (conta + uniq de IPs por hora/proto/tipo/equip) ──
DROP VIEW  IF EXISTS nat_logs_hourly_mv;
DROP TABLE IF EXISTS nat_logs_hourly;

CREATE TABLE nat_logs_hourly (
    hour                DateTime,
    protocolo           LowCardinality(String),
    tipo_nat            LowCardinality(String),
    equipamento_origem  LowCardinality(String),
    total_count         SimpleAggregateFunction(sum, UInt64),
    unique_public_ips   AggregateFunction(uniq, IPv4),
    unique_private_ips  AggregateFunction(uniq, IPv4)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, protocolo, tipo_nat, equipamento_origem)
TTL hour + INTERVAL 15 MONTH;

CREATE MATERIALIZED VIEW nat_logs_hourly_mv TO nat_logs_hourly AS
SELECT
    toStartOfHour(timestamp) AS hour,
    protocolo, tipo_nat, equipamento_origem,
    count()                   AS total_count,
    uniqState(ip_publico)     AS unique_public_ips,
    uniqState(ip_privado)     AS unique_private_ips
FROM nat_logs
GROUP BY hour, protocolo, tipo_nat, equipamento_origem;

-- backfill histórico (tudo até o instante atual; MV pega daqui pra frente)
INSERT INTO nat_logs_hourly
SELECT
    toStartOfHour(timestamp) AS hour,
    protocolo, tipo_nat, equipamento_origem,
    count()                   AS total_count,
    uniqState(ip_publico),
    uniqState(ip_privado)
FROM nat_logs
WHERE timestamp < now() - INTERVAL 3 HOUR
GROUP BY hour, protocolo, tipo_nat, equipamento_origem;

-- ── 2. Top IPs PÚBLICOS por dia (exclui ICMP, igual ao dashboard) ──
DROP VIEW  IF EXISTS nat_logs_pubip_daily_mv;
DROP TABLE IF EXISTS nat_logs_pubip_daily;

CREATE TABLE nat_logs_pubip_daily (
    day                 Date,
    equipamento_origem  LowCardinality(String),
    ip_publico          IPv4,
    cnt                 SimpleAggregateFunction(sum, UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, equipamento_origem, ip_publico)
TTL day + INTERVAL 15 MONTH;

CREATE MATERIALIZED VIEW nat_logs_pubip_daily_mv TO nat_logs_pubip_daily AS
SELECT toDate(timestamp) AS day, equipamento_origem, ip_publico, count() AS cnt
FROM nat_logs WHERE protocolo != 'ICMP'
GROUP BY day, equipamento_origem, ip_publico;

INSERT INTO nat_logs_pubip_daily
SELECT toDate(timestamp) AS day, equipamento_origem, ip_publico, count() AS cnt
FROM nat_logs
WHERE protocolo != 'ICMP' AND timestamp < now() - INTERVAL 3 HOUR
GROUP BY day, equipamento_origem, ip_publico;

-- ── 3. Top IPs PRIVADOS por dia ──
DROP VIEW  IF EXISTS nat_logs_privip_daily_mv;
DROP TABLE IF EXISTS nat_logs_privip_daily;

CREATE TABLE nat_logs_privip_daily (
    day                 Date,
    equipamento_origem  LowCardinality(String),
    ip_privado          IPv4,
    cnt                 SimpleAggregateFunction(sum, UInt64)
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (day, equipamento_origem, ip_privado)
TTL day + INTERVAL 15 MONTH;

CREATE MATERIALIZED VIEW nat_logs_privip_daily_mv TO nat_logs_privip_daily AS
SELECT toDate(timestamp) AS day, equipamento_origem, ip_privado, count() AS cnt
FROM nat_logs WHERE protocolo != 'ICMP'
GROUP BY day, equipamento_origem, ip_privado;

INSERT INTO nat_logs_privip_daily
SELECT toDate(timestamp) AS day, equipamento_origem, ip_privado, count() AS cnt
FROM nat_logs
WHERE protocolo != 'ICMP' AND timestamp < now() - INTERVAL 3 HOUR
GROUP BY day, equipamento_origem, ip_privado;
