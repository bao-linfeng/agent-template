#!/bin/sh
# Alertmanager cannot read environment variables, so this renders /tmp/alertmanager.yml from deploy/.env
# (passed in by docker-compose.yml) and starts it. Channels without a setting are left out:
# - email: ALERT_EMAIL_TO plus the API's SMTP_* settings and MAIL_FROM;
# - WeCom / Feishu / DingTalk group bots: ALERT_*_WEBHOOK_URL, delivered through alert-relay.
set -eu

config=/tmp/alertmanager.yml
password_file=/tmp/smtp-password

# YAML single-quoted scalar.
q() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"
}

{
  cat /etc/alertmanager/alertmanager.base.yml
  echo
  echo 'receivers:'
  echo '  - name: default'

  if [ -n "${ALERT_EMAIL_TO:-}" ]; then
    echo '    email_configs:'
    echo "      - to: $(q "$ALERT_EMAIL_TO")"
    echo "        from: $(q "${ALERT_EMAIL_FROM:-$MAIL_FROM}")"
    echo "        smarthost: $(q "$SMTP_HOST:$SMTP_PORT")"
    echo '        send_resolved: true'
    # Same meaning as the API's SMTP_SECURE: TLS from the first byte (465), otherwise STARTTLS.
    if [ "${SMTP_SECURE:-false}" = "true" ] || [ "${SMTP_SECURE:-}" = "1" ]; then
      echo '        force_implicit_tls: true'
    else
      echo "        require_tls: ${ALERT_SMTP_REQUIRE_TLS:-true}"
    fi
    if [ -n "${SMTP_USER:-}" ]; then
      (umask 077 && printf '%s' "${SMTP_PASSWORD:-}" > "$password_file")
      echo "        auth_username: $(q "$SMTP_USER")"
      echo "        auth_password_file: $password_file"
    fi
  fi

  webhooks=''
  for channel in wecom feishu dingtalk; do
    case "$channel" in
      wecom) url="${ALERT_WECOM_WEBHOOK_URL:-}" ;;
      feishu) url="${ALERT_FEISHU_WEBHOOK_URL:-}" ;;
      dingtalk) url="${ALERT_DINGTALK_WEBHOOK_URL:-}" ;;
    esac
    if [ -n "$url" ]; then
      webhooks="$webhooks $channel"
    fi
  done
  if [ -n "$webhooks" ]; then
    echo '    webhook_configs:'
    # One webhook per channel: Alertmanager retries each on its own, so one failing bot never duplicates the others.
    for channel in $webhooks; do
      echo "      - url: http://alert-relay:8080/$channel"
      echo '        send_resolved: true'
    done
  fi
} > "$config"

if [ -z "${ALERT_EMAIL_TO:-}" ] && [ -z "$webhooks" ]; then
  echo "alertmanager: no receiver configured (ALERT_EMAIL_TO, ALERT_*_WEBHOOK_URL); alerts are only shown in Grafana" >&2
fi

# `entrypoint.sh check` only validates the rendered configuration (CI).
if [ "${1:-}" = "check" ]; then
  exec amtool check-config "$config"
fi

exec /bin/alertmanager \
  --config.file="$config" \
  --storage.path=/alertmanager \
  --cluster.listen-address= \
  "$@"
