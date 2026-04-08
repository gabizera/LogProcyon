FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y rsyslog curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY rsyslog.conf /etc/rsyslog.conf
COPY insert-clickhouse.sh /usr/local/bin/insert-clickhouse.sh
RUN chmod +x /usr/local/bin/insert-clickhouse.sh

EXPOSE 514/tcp
EXPOSE 514/udp

CMD ["rsyslogd", "-n", "-f", "/etc/rsyslog.conf"]
