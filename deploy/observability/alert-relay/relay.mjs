// Alertmanager webhook → WeCom (企业微信) / Feishu (飞书) / DingTalk (钉钉) group bots. Alertmanager has no
// integration for these bots (its `wechat_configs` targets WeCom apps), so it posts here and this relay
// reformats the payload. No dependencies: runs on the stock node image (see deploy/docker-compose.yml).
//
//   POST /wecom | /feishu | /dingtalk   Alertmanager webhook payload (version 4)
//   GET  /healthz
//
// Env: ALERT_WECOM_WEBHOOK_URL, ALERT_FEISHU_WEBHOOK_URL (+ ALERT_FEISHU_SECRET), ALERT_DINGTALK_WEBHOOK_URL
// (+ ALERT_DINGTALK_SECRET), ALERT_TIMEZONE (default Asia/Shanghai), PORT (default 8080).
// A failed delivery answers 502 so Alertmanager retries it.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_ALERTS = 20;
const SEND_TIMEOUT_MS = 10_000;

/** Message size limits of the bot APIs (bytes of the markdown text). */
const LIMITS = { wecom: 4096, feishu: 20_000, dingtalk: 18_000 };

/** Labels shown with each alert besides alertname/severity. */
const DETAIL_LABELS = ["queue", "name", "instance", "job"];

export function formatTime(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1971) {
    return "";
  }
  // sv-SE formats as `2026-10-16 08:30:00`.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

/**
 * Title and markdown blocks (one per alert) for a webhook payload; `markdown` joins them within `maxBytes`.
 * The text always contains 告警 or 恢复, which can serve as the DingTalk/Feishu keyword security setting.
 */
export function formatMessage(payload, { timeZone = "Asia/Shanghai" } = {}) {
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const firing = alerts.filter((alert) => alert.status === "firing");
  const resolved = alerts.filter((alert) => alert.status !== "firing");
  const isFiring = firing.length > 0;
  const name =
    payload.commonLabels?.alertname ??
    payload.groupLabels?.alertname ??
    alerts[0]?.labels?.alertname ??
    "Alert";
  const count = isFiring ? firing.length : resolved.length;
  const title = `${isFiring ? "[告警]" : "[恢复]"} ${name}${count > 1 ? ` ×${count}` : ""}`;

  const blocks = [...firing, ...resolved].map((alert) => {
    const labels = alert.labels ?? {};
    const annotations = alert.annotations ?? {};
    const state = alert.status === "firing" ? "告警中" : "已恢复";
    const lines = [
      `**${annotations.summary ?? labels.alertname ?? name}**（${state}，${labels.severity ?? "none"}）`,
    ];
    if (annotations.description) {
      lines.push(annotations.description);
    }
    const details = DETAIL_LABELS.filter((key) => labels[key]).map(
      (key) => `${key}=${labels[key]}`,
    );
    if (details.length > 0) {
      lines.push(details.join("，"));
    }
    const startsAt = formatTime(alert.startsAt, timeZone);
    const endsAt = formatTime(alert.endsAt, timeZone);
    lines.push(
      alert.status === "firing" || !endsAt
        ? `开始：${startsAt}`
        : `开始：${startsAt}，恢复：${endsAt}`,
    );
    return lines;
  });
  return { title, isFiring, blocks };
}

/** Joins as many blocks as fit into `maxBytes` (and `MAX_ALERTS`), noting how many were left out. */
export function renderMarkdown(header, blocks, { maxBytes, lineBreak }) {
  // Blank line between alerts; `lineBreak` separates the lines of one alert.
  const separator = "\n\n";
  const note = (left) => `${separator}…另有 ${left} 条未显示`;
  let text = header;
  let shown = 0;
  for (const block of blocks.slice(0, MAX_ALERTS)) {
    const next = `${text}${separator}${block.join(lineBreak)}`;
    const reserve = blocks.length - shown - 1 > 0 ? 64 : 0;
    if (Buffer.byteLength(next) + reserve > maxBytes) {
      break;
    }
    text = next;
    shown += 1;
  }
  if (shown < blocks.length) {
    text += note(blocks.length - shown);
  }
  return text;
}

/** Feishu custom bot signature: HMAC-SHA256 keyed with `timestamp\nsecret` over an empty message. */
export function feishuSign(timestamp, secret) {
  return createHmac("sha256", `${timestamp}\n${secret}`)
    .update("")
    .digest("base64");
}

/** DingTalk custom bot signature: HMAC-SHA256 keyed with the secret over `timestamp\nsecret`. */
export function dingtalkSign(timestamp, secret) {
  return createHmac("sha256", secret)
    .update(`${timestamp}\n${secret}`)
    .digest("base64");
}

/** Builds the bot request for a channel: `{ url, body }`. */
export function buildRequest(channel, settings, message, now = Date.now()) {
  const { title, isFiring, blocks } = message;
  switch (channel) {
    case "wecom": {
      const color = isFiring ? "warning" : "info";
      const header = `<font color="${color}">**${title}**</font>`;
      const content = renderMarkdown(header, blocks, {
        maxBytes: LIMITS.wecom,
        lineBreak: "\n",
      });
      return {
        url: settings.url,
        body: { msgtype: "markdown", markdown: { content } },
      };
    }
    case "feishu": {
      const content = renderMarkdown("", blocks, {
        maxBytes: LIMITS.feishu,
        lineBreak: "\n",
      }).trimStart();
      const body = {
        msg_type: "interactive",
        card: {
          config: { wide_screen_mode: true },
          header: {
            title: { tag: "plain_text", content: title },
            template: isFiring ? "red" : "green",
          },
          elements: [{ tag: "div", text: { tag: "lark_md", content } }],
        },
      };
      if (settings.secret) {
        const timestamp = String(Math.floor(now / 1000));
        body.timestamp = timestamp;
        body.sign = feishuSign(timestamp, settings.secret);
      }
      return { url: settings.url, body };
    }
    case "dingtalk": {
      // DingTalk markdown needs blank lines between paragraphs.
      const text = renderMarkdown(`### ${title}`, blocks, {
        maxBytes: LIMITS.dingtalk,
        lineBreak: "\n\n",
      });
      let url = settings.url;
      if (settings.secret) {
        const timestamp = String(now);
        const sign = encodeURIComponent(
          dingtalkSign(timestamp, settings.secret),
        );
        url += `${url.includes("?") ? "&" : "?"}timestamp=${timestamp}&sign=${sign}`;
      }
      return {
        url,
        body: { msgtype: "markdown", markdown: { title, text } },
      };
    }
    default:
      throw new Error(`unknown channel ${channel}`);
  }
}

/** Posts to the bot. The bots answer HTTP 200 with an error code in the body (`errcode`, or `code` for Feishu). */
export async function send(request, fetchImpl = fetch) {
  const response = await fetchImpl(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = undefined;
  }
  const code = result?.errcode ?? result?.code ?? result?.StatusCode ?? 0;
  if (!response.ok || code !== 0) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
}

export function channelsFromEnv(env) {
  const channels = {};
  if (env.ALERT_WECOM_WEBHOOK_URL) {
    channels.wecom = { url: env.ALERT_WECOM_WEBHOOK_URL };
  }
  if (env.ALERT_FEISHU_WEBHOOK_URL) {
    channels.feishu = {
      url: env.ALERT_FEISHU_WEBHOOK_URL,
      secret: env.ALERT_FEISHU_SECRET,
    };
  }
  if (env.ALERT_DINGTALK_WEBHOOK_URL) {
    channels.dingtalk = {
      url: env.ALERT_DINGTALK_WEBHOOK_URL,
      secret: env.ALERT_DINGTALK_SECRET,
    };
  }
  return channels;
}

function log(level, message, fields = {}) {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...fields,
    }),
  );
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("payload too large");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createRelay({ channels, timeZone, fetchImpl = fetch }) {
  return createServer(async (request, response) => {
    const reply = (status, body = "") => {
      response.writeHead(status, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end(body);
    };
    const path = new URL(request.url ?? "/", "http://relay").pathname;
    if (request.method === "GET" && path === "/healthz") {
      return reply(200, "ok");
    }
    const channel = path.slice(1);
    if (request.method !== "POST" || !Object.hasOwn(channels, channel)) {
      return reply(404, "not found");
    }
    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      return reply(400, String(error));
    }
    const message = formatMessage(payload, { timeZone });
    try {
      await send(buildRequest(channel, channels[channel], message), fetchImpl);
      log("info", "delivered", { channel, title: message.title });
      return reply(204);
    } catch (error) {
      log("error", "delivery failed", {
        channel,
        title: message.title,
        error: String(error),
      });
      return reply(502, "delivery failed");
    }
  });
}

if (import.meta.main) {
  const channels = channelsFromEnv(process.env);
  const port = Number(process.env.PORT ?? 8080);
  const server = createRelay({
    channels,
    timeZone: process.env.ALERT_TIMEZONE || "Asia/Shanghai",
  });
  server.listen(port, () =>
    log("info", "listening", { port, channels: Object.keys(channels) }),
  );
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
