// node --test deploy/observability/alert-relay/relay.test.mjs
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import {
  buildRequest,
  channelsFromEnv,
  createRelay,
  dingtalkSign,
  feishuSign,
  formatMessage,
  renderMarkdown,
} from "./relay.mjs";

const firing = {
  status: "firing",
  labels: { alertname: "QueueStalled", severity: "critical", queue: "mail" },
  annotations: {
    summary: "队列停止处理",
    description: "队列 mail 有 3 个任务在等待",
  },
  startsAt: "2026-10-16T02:00:00Z",
  endsAt: "0001-01-01T00:00:00Z",
};

const payload = (alerts, status = "firing") => ({
  version: "4",
  status,
  receiver: "default",
  groupLabels: { alertname: alerts[0].labels.alertname },
  commonLabels: { alertname: alerts[0].labels.alertname },
  alerts,
});

test("formats firing and resolved alerts", () => {
  const message = formatMessage(payload([firing]));
  assert.equal(message.title, "[告警] QueueStalled");
  assert.equal(message.isFiring, true);
  assert.deepEqual(message.blocks[0], [
    "**队列停止处理**（告警中，critical）",
    "队列 mail 有 3 个任务在等待",
    "queue=mail",
    "开始：2026-10-16 10:00:00",
  ]);

  const resolved = formatMessage(
    payload(
      [{ ...firing, status: "resolved", endsAt: "2026-10-16T02:30:00Z" }],
      "resolved",
    ),
    { timeZone: "UTC" },
  );
  assert.equal(resolved.title, "[恢复] QueueStalled");
  assert.equal(
    resolved.blocks[0].at(-1),
    "开始：2026-10-16 02:00:00，恢复：2026-10-16 02:30:00",
  );
});

test("keeps messages within the size limit", () => {
  const blocks = Array.from({ length: 30 }, (_, index) => [
    `**告警 ${index}**`,
    "x".repeat(200),
  ]);
  const text = renderMarkdown("header", blocks, {
    maxBytes: 1000,
    lineBreak: "\n",
  });
  assert.ok(Buffer.byteLength(text) <= 1000);
  assert.match(text, /…另有 2\d 条未显示$/);
  const all = renderMarkdown("header", blocks.slice(0, 2), {
    maxBytes: 1000,
    lineBreak: "\n",
  });
  assert.doesNotMatch(all, /未显示/);
});

test("signs like the bot documentation", () => {
  // Reference implementations from the Feishu and DingTalk docs (Python hmac).
  assert.equal(
    feishuSign("1700000000", "secret"),
    createHmac("sha256", "1700000000\nsecret").digest("base64"),
  );
  assert.equal(
    dingtalkSign("1700000000000", "secret"),
    createHmac("sha256", "secret")
      .update("1700000000000\nsecret")
      .digest("base64"),
  );
});

test("builds the request of each bot", () => {
  const message = formatMessage(payload([firing]));
  const wecom = buildRequest(
    "wecom",
    { url: "https://wecom/send?key=k" },
    message,
  );
  assert.equal(wecom.body.msgtype, "markdown");
  assert.match(
    wecom.body.markdown.content,
    /^<font color="warning">\*\*\[告警\] QueueStalled\*\*<\/font>\n\n/,
  );

  const feishu = buildRequest(
    "feishu",
    { url: "https://feishu/hook/t", secret: "s" },
    message,
    1_700_000_000_123,
  );
  assert.equal(feishu.body.msg_type, "interactive");
  assert.equal(feishu.body.card.header.template, "red");
  assert.equal(feishu.body.timestamp, "1700000000");
  assert.equal(feishu.body.sign, feishuSign("1700000000", "s"));
  assert.match(
    feishu.body.card.elements[0].text.content,
    /^\*\*队列停止处理\*\*/,
  );

  const dingtalk = buildRequest(
    "dingtalk",
    { url: "https://dingtalk/robot/send?access_token=t", secret: "s" },
    message,
    1_700_000_000_123,
  );
  const url = new URL(dingtalk.url);
  assert.equal(url.searchParams.get("access_token"), "t");
  assert.equal(url.searchParams.get("timestamp"), "1700000000123");
  assert.equal(
    url.searchParams.get("sign"),
    dingtalkSign("1700000000123", "s"),
  );
  assert.equal(dingtalk.body.markdown.title, "[告警] QueueStalled");
  assert.match(
    dingtalk.body.markdown.text,
    /^### \[告警\] QueueStalled\n\n\*\*/,
  );
});

test("reads only configured channels from the environment", () => {
  assert.deepEqual(
    Object.keys(
      channelsFromEnv({
        ALERT_WECOM_WEBHOOK_URL: "https://wecom",
        ALERT_DINGTALK_WEBHOOK_URL: "",
      }),
    ),
    ["wecom"],
  );
});

test("relays Alertmanager webhooks and reports failed deliveries", async (t) => {
  const sent = [];
  let answer = { errcode: 0, errmsg: "ok" };
  const fetchImpl = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(answer), { status: 200 });
  };
  const server = createRelay({
    channels: { wecom: { url: "https://wecom/send?key=k" } },
    timeZone: "UTC",
    fetchImpl,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path) =>
    fetch(`${base}${path}`, {
      method: "POST",
      body: JSON.stringify(payload([firing])),
    });

  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  assert.equal((await post("/wecom")).status, 204);
  assert.equal(sent[0].url, "https://wecom/send?key=k");
  assert.equal(sent[0].body.msgtype, "markdown");

  // Unconfigured channel.
  assert.equal((await post("/dingtalk")).status, 404);

  // The bot answers 200 with an error code: Alertmanager must retry.
  answer = { errcode: 93000, errmsg: "invalid webhook url" };
  assert.equal((await post("/wecom")).status, 502);
});
