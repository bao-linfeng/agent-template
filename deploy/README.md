# 生产部署（单机 Docker Compose）

本目录把 server、admin、client 和依赖服务部署到一台 Linux 主机：

```text
Internet ──443──▶ gateway (Caddy, 自动 HTTPS)
                    ├─ API_DOMAIN    → api    (apps/server 镜像, :3100)
                    ├─ ADMIN_DOMAIN  → admin  (nginx 静态站, :8080)
                    └─ CLIENT_DOMAIN → client (nginx 静态站, :8080)
api ──▶ postgres (pgvector) / redis / rustfs   —— 仅内网，不发布端口

可选监控（profile observability）：
prometheus ──抓取──▶ api:9464   ──告警──▶ alertmanager ──▶ 邮件 / alert-relay ──▶ 企业微信、飞书、钉钉
api ──OTLP──▶ tempo:4318          grafana (127.0.0.1:3000) ──查询──▶ prometheus / tempo / alertmanager

可选上传病毒扫描（profile antivirus）：
api ──INSTREAM──▶ clamav:3310 (clamd + freshclam)
```

| 文件                 | 作用                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml` | 生产编排；`migrate`、`seed` 属于 `ops` profile，只能通过 `docker compose run` 执行；监控组件属于 `observability` profile，clamd 属于 `antivirus` profile |
| `.env.example`       | 域名、镜像、密钥、SMTP、监控告警、备份配置模板，复制为 `.env`（已被 git 忽略）                                                                           |
| `Caddyfile`          | 三个域名的反向代理与证书                                                                                                                                 |
| `nginx/`             | admin/client 镜像使用的 SPA 配置（history 回退、静态资源长缓存、安全响应头）                                                                             |
| `observability/`     | Prometheus 抓取配置与告警规则（含 `promtool` 测试）、Alertmanager、IM 告警转发、Tempo、Grafana 数据源与仪表盘                                            |
| `scripts/deploy.sh`  | 发布：拉取或构建镜像 → 启动基础设施 → 发布前备份 → 迁移 → 滚动更新 → 就绪检查                                                                            |
| `scripts/backup.sh`  | 备份 PostgreSQL 与对象存储，按保留天数清理                                                                                                               |
| `scripts/restore.sh` | `--verify` 恢复演练（临时库，不停机）或正式恢复                                                                                                          |

## 镜像

三个 Dockerfile 都以仓库根目录为构建上下文（根 `.dockerignore` 排除 `node_modules`、构建产物和各应用的 `.env`）：

| 镜像   | Dockerfile               | 运行用户          | 健康检查                        |
| ------ | ------------------------ | ----------------- | ------------------------------- |
| server | `apps/server/Dockerfile` | `node` (uid 1000) | `GET /<API_PREFIX>/health/live` |
| admin  | `apps/admin/Dockerfile`  | `nginx` (uid 101) | `GET /healthz`                  |
| client | `apps/client/Dockerfile` | `nginx` (uid 101) | `GET /healthz`                  |

- 多阶段构建：`pnpm fetch` 按锁文件缓存依赖，离线安装后构建；server 运行层只包含生产依赖、`dist/` 和 `drizzle/` 迁移文件。同一个 server 镜像也执行迁移（`node dist/scripts/migrate.js`）和种子（`node dist/scripts/seed.js`）。
- Vite 在构建时把 `VITE_*` 写进前端产物，所以 admin/client 镜像绑定构建时的 API 地址（admin：`VITE_SERVER_API_URL`，client：`VITE_API_BASE_URL`，必填）。更换 API 域名需要重新构建前端镜像。
- Dockerfile 中的 `ARG PNPM_VERSION` 需与根 `package.json` 的 `packageManager` 一致（Renovate 会一起更新）。

镜像来源二选一：

- **GHCR（推荐）**：在 GitHub 仓库变量中设置 `API_DOMAIN`（可选 `API_PREFIX`），推送 `v1.2.3` 形式的 tag，`.github/workflows/release.yml` 会构建并推送 `ghcr.io/<owner>/<repo>/{server,admin,client}`，标签为 `1.2.3`、`1.2`、`latest` 和 `sha-<commit>`。私有仓库需先在主机上 `docker login ghcr.io`。
- **主机本地构建**：`scripts/deploy.sh --build`，标签为当前 git 提交短哈希。

## 首次部署

前提：Docker Engine 与 Compose v2；三个域名的 DNS 已指向本机；80/443 端口可从公网访问（Caddy 申请证书需要）。

```sh
cd deploy
cp .env.example .env
# 填写域名、ACME_EMAIL、JWT_SECRET、ENCRYPTION_KEY、各服务密码、SMTP、SEED_ADMIN_*
scripts/deploy.sh 1.0.0            # 或 scripts/deploy.sh --build
docker compose run --rm seed       # 只需一次：系统角色、首个超级管理员、默认 Embedding 模型
```

`ENCRYPTION_KEY` 加密数据库中的模型 API Key 和管理员双因素认证（TOTP）密钥，丢失后这些数据无法解密，需与备份分开妥善保管；更换方法见「加密密钥轮换」。密码会拼进连接 URL，请用 `openssl rand -hex 32` 生成 URL 安全的值。

使用托管 PostgreSQL / Redis / S3 时：在 `docker-compose.yml` 中删除对应服务及 `depends_on`，把 `x-server.environment` 里的 `DATABASE_URL`、`REDIS_URL`、`STORAGE_ENDPOINT` 改为托管地址（托管 S3 通常还需 `STORAGE_FORCE_PATH_STYLE=false`）。PostgreSQL 必须提供 pgvector 扩展；Redis 必须使用 `noeviction` 策略（BullMQ 要求）。此时 `backup.sh`/`restore.sh` 不再适用，改用云厂商的快照与时间点恢复。

## 发布流程

```sh
scripts/deploy.sh 1.1.0
```

依次执行：

1. 拉取（或构建）三个应用镜像；此时运行中的版本不受影响。
2. 启动并等待 postgres、redis、rustfs 健康。
3. `backup.sh pre-deploy` 生成发布前备份（`SKIP_BACKUP=1` 可跳过）。
4. `docker compose run --rm migrate` 执行迁移。**迁移失败时脚本立即退出，旧版本容器继续运行。**
5. `docker compose up -d --wait` 用新镜像替换 api/admin/client，等待健康检查通过。
6. 调用 `/api/health`（检查数据库与 Redis），并把发布时间和标签追加到 `.deploy-history`。

单机 Compose 替换容器时 API 会有数秒不可用；需要零停机时应迁移到多实例编排（如 Kubernetes）。

## 迁移与回滚策略

Drizzle 只生成正向 SQL，没有 down 迁移，因此回滚依赖“迁移向后兼容”和“发布前备份”两道保障：

- **迁移失败**：Drizzle 在一个事务中执行全部待执行迁移，失败会整体回滚，数据库保持旧结构，旧版本继续运行。修复迁移后重新发布即可。例外：`CREATE INDEX CONCURRENTLY` 等不能在事务中执行的语句，不要写进迁移（运行时创建索引参考 `EmbeddingModelsService.ensureVectorIndex`）。
- **新版本有问题，迁移向后兼容**：直接发布上一个标签，`scripts/deploy.sh 1.0.0`（标签见 `.deploy-history`）。旧镜像中的迁移都已执行过，migrate 步骤不做任何事。
- **新版本有问题，迁移不兼容旧代码**：`scripts/restore.sh backups/<时间>-pre-deploy` 恢复发布前备份，再发布上一个标签。备份之后产生的数据会丢失，所以应尽量避免这种情况。

编写迁移时遵循 expand/contract（先扩展、后收缩），让每次迁移都兼容上一版本的代码：

| 变更                              | 做法                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| 新增列                            | 允许 NULL 或带默认值；旧代码忽略它即可                                  |
| 重命名列/表                       | 第 1 次发布新增列并双写、回填；第 2 次发布切换读取；第 3 次发布删除旧列 |
| 删除列/表                         | 先发布不再使用它的代码，下一次发布再删除                                |
| 收紧约束（NOT NULL、CHECK、唯一） | 先回填和清理数据，确认无违规后单独发布约束                              |
| 大表加索引                        | 不放进迁移事务；在运行时或维护窗口使用 `CONCURRENTLY` 创建              |

CI 的 `Migrations match the Drizzle schema` 步骤会在 schema 修改但未生成迁移时失败。

## 备份与恢复

```sh
scripts/backup.sh                                   # 手动备份，目录 backups/<UTC 时间>-manual/
scripts/restore.sh backups/<目录> --verify          # 恢复演练：恢复到临时库，输出迁移记录与关键表行数，然后删除
scripts/restore.sh backups/<目录>                   # 正式恢复：输入 restore 确认后停 API → 重建数据库 → 回写对象 → 清空 Redis → 启动 API
```

- 每个备份目录包含 `postgres.dump`（`pg_dump -Fc`，生成后会用 `pg_restore --list` 校验）、`storage/`（对象存储桶的完整副本，`BACKUP_STORAGE=false` 可关闭）和 `manifest.txt`。对象数少于桶内数量时备份失败。
- Redis 不备份：其中只有权限缓存、限流计数、验证码、会话吊销标记和队列任务。恢复时会清空 Redis；备份时处于 pending/processing 的文档需要重新入库。
- `BACKUP_RETENTION_DAYS`（默认 14）之前的备份会在每次备份时删除。备份目录在本机，需另行同步到异地（对象存储、另一台主机），否则主机损坏时备份一起丢失。
- 定时备份示例（crontab，每天 03:00 UTC）：

  ```cron
  0 3 * * * cd /srv/agent-template/deploy && scripts/backup.sh daily >> backups/backup.log 2>&1
  ```

- 建议每月对最新备份执行一次 `--verify` 演练，确认备份确实可恢复。

## 上传病毒扫描

头像和知识库文件在通过格式校验（头像按文件头识别图片类型，文档必须是 UTF-8 文本）之后、写入对象存储之前，会交给 ClamAV 的 clamd 扫描。默认关闭，在 `.env` 中启用：

```sh
COMPOSE_PROFILES=antivirus          # 已启用监控时写成 observability,antivirus
CLAMAV_HOST=clamav
```

- `clamav` 容器内的 freshclam 自动更新病毒库，病毒库保存在 `clamav-data` 卷。首次启动需要下载几百 MB 的病毒库，几分钟后才会变为 healthy，`scripts/deploy.sh` 的 `--wait` 会等它就绪。clamd 常驻内存约 1.5–3 GB，启用前确认主机内存足够。
- 设置 `CLAMAV_HOST` 后扫描失败即拒绝上传（fail closed）：检出病毒返回 422 `UPLOAD_INFECTED`，clamd 不可用、超时（`CLAMAV_TIMEOUT_MS`，默认 30 秒）或报错时返回 503 `UPLOAD_SCAN_UNAVAILABLE`，文件都不会写入存储。指标 `upload_scans_total{result="clean|infected|error"}` 记录扫描结果，启用监控时 `UploadScanFailing` 会告警。
- clamd 拒绝超过 `StreamMaxLength`（clamd.conf）的文件流；调大 `UPLOAD_MAX_BYTES`（默认 20 MiB）时要保证它仍小于该值，否则这些文件会被拒绝并返回 503。
- 已经在存储中的旧文件不会补扫。未设置 `CLAMAV_HOST` 的生产实例启动时会在日志中警告。

## 监控与告警

`observability` profile 在同一台主机上运行一套监控栈，配置都在 `observability/`：

| 服务           | 镜像                | 作用                                                                                                  |
| -------------- | ------------------- | ----------------------------------------------------------------------------------------------------- |
| `prometheus`   | `prom/prometheus`   | 每 15 秒抓取 `api:9464/metrics`（API 的内部指标端口，Caddy 不转发），评估告警规则，默认保留 15 天     |
| `alertmanager` | `prom/alertmanager` | 分组、去重、抑制告警，发送邮件和 IM 机器人消息                                                        |
| `alert-relay`  | `node:24-alpine`    | 把 Alertmanager webhook 转成企业微信、飞书、钉钉群机器人的消息格式（`alert-relay/relay.mjs`，无依赖） |
| `tempo`        | `grafana/tempo`     | 接收 API 的 OTLP 链路（`tempo:4318`），本地卷存储，默认保留 7 天                                      |
| `grafana`      | `grafana/grafana`   | 预置 Prometheus、Tempo、Alertmanager 数据源和「API 概览」仪表盘，只监听 `127.0.0.1`                   |

开发时可以用 `apps/server/docker-compose.yml` 的同名 profile 在本地运行同一套规则和仪表盘（抓取宿主机上的 API，告警发到 Mailpit），见 [apps/server/README.md](../apps/server/README.md) 的「本地监控」。修改规则或仪表盘时可以先在本地验证。

### 启用

在 `.env` 中设置（变量说明见 `.env.example` 的 Monitoring 一节）：

```sh
COMPOSE_PROFILES=observability                 # docker compose 与 scripts/deploy.sh 都会启动监控服务
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318  # API 上报链路；未启用 profile 时不要设置
GRAFANA_ADMIN_PASSWORD=<强密码>                # 必填，未设置时 Grafana 拒绝启动
ALERT_EMAIL_TO=ops@example.com                 # 可选，多个收件人用逗号分隔
ALERT_WECOM_WEBHOOK_URL=...                    # 可选，企业微信、飞书、钉钉按需填写
```

然后执行 `scripts/deploy.sh <tag>`，或只启动监控组件：`docker compose up -d --wait`（API 需要重建才能读到新的 `OTEL_EXPORTER_OTLP_ENDPOINT`，`up -d` 会自动处理）。之后修改 `.env` 中的告警设置，同样执行 `docker compose up -d`：Compose 会重建配置有变化的容器，Alertmanager 在启动时重新生成配置。修改 `observability/` 下的挂载文件则需要 `docker compose restart <服务>`。

Grafana 不对公网开放，通过 SSH 隧道访问：

```sh
ssh -L 3000:127.0.0.1:3000 <主机>    # 然后打开 http://localhost:3000，用户 admin
```

`GRAFANA_ADMIN_PASSWORD` 只在 `grafana-data` 卷首次创建时生效，之后改密码用 `docker compose exec grafana grafana cli admin reset-admin-password <新密码>`。仪表盘来自仓库中的 JSON 文件（`observability/grafana/dashboards/`），界面上的修改不能保存，需要改文件后提交。

### 告警规则

规则在 `observability/prometheus/rules/api.yml`，阈值是起点，按实际流量调整：

| 告警                   | 级别     | 条件                                                              |
| ---------------------- | -------- | ----------------------------------------------------------------- |
| `ApiDown`              | critical | 1 分钟抓取不到 API 指标（进程停止、重启失败或卡死）               |
| `HighErrorRate`        | critical | 5 分钟内 5xx 比例 > 5%，持续 5 分钟（每秒请求数 < 0.1 时不告警）  |
| `HighLatency`          | warning  | p95 响应时间 > 1 秒，持续 10 分钟                                 |
| `DbPoolSaturated`      | warning  | 数据库连接池持续 5 分钟有查询在等待空闲连接                       |
| `EventLoopLag`         | warning  | 事件循环延迟 p99 > 500ms，持续 5 分钟                             |
| `QueueBacklog`         | warning  | 某队列等待中的任务 > 100，持续 15 分钟                            |
| `QueueStalled`         | critical | 某队列有等待中的任务，但 15 分钟内没有完成任何任务，持续 15 分钟  |
| `JobFailures`          | warning  | 15 分钟内有任务重试耗尽后最终失败                                 |
| `ScheduledJobMissed`   | warning  | `audit`、`maintenance` 队列的夜间定时任务超过 26 小时没有成功执行 |
| `MonitoringTargetDown` | warning  | Alertmanager 或 Tempo 5 分钟无法抓取                              |
| `UploadScanFailing`    | warning  | 10 分钟内有上传因 clamd 不可用或报错被拒绝（仅启用病毒扫描时）    |

- `ApiDown` 触发时，同时出现的其他 API 告警会被抑制，只发一条。critical 告警每小时重复提醒，warning 每 4 小时。
- 通过后台系统设置关闭的定时任务（如孤儿文件清扫）仍按时运行并直接成功返回，不会触发 `ScheduledJobMissed`；用环境变量移除的任务（如 `AUDIT_LOG_RETENTION_DAYS=0`）的该告警会持续到最后一次成功记录超过 7 天，期间在 Grafana（Alerting → Silences）或 Alertmanager 中静默即可。
- 修改规则后先运行单元测试，再重新加载：

  ```sh
  docker run --rm -v ./observability/prometheus:/etc/prometheus:ro --entrypoint promtool \
    prom/prometheus:v3.15.0 test rules /etc/prometheus/tests/api.test.yml
  docker compose restart prometheus
  ```

### 告警渠道

所有渠道都是可选的，未配置的渠道直接跳过；全部未配置时告警只在 Grafana 中显示。每个渠道单独重试，一个渠道失败不会导致其他渠道重复发送。

- **邮件**：复用 API 的 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASSWORD`，发件人默认 `MAIL_FROM`（可用 `ALERT_EMAIL_FROM` 覆盖），收件人为 `ALERT_EMAIL_TO`。`SMTP_SECURE=true` 时直接使用 TLS（465 端口），否则要求 STARTTLS（内网明文 SMTP 可设 `ALERT_SMTP_REQUIRE_TLS=false`）。
- **企业微信**：群设置 → 添加群机器人，复制 webhook 地址到 `ALERT_WECOM_WEBHOOK_URL`，发送 markdown 消息（超过 4096 字节时省略后面的告警）。
- **飞书**：群设置 → 群机器人 → 自定义机器人，地址填 `ALERT_FEISHU_WEBHOOK_URL`；开启「签名校验」时把密钥填到 `ALERT_FEISHU_SECRET`。发送卡片消息，告警为红色，恢复为绿色。
- **钉钉**：群设置 → 机器人 → 自定义机器人，地址填 `ALERT_DINGTALK_WEBHOOK_URL`；安全设置选「加签」时把密钥填到 `ALERT_DINGTALK_SECRET`，选「自定义关键词」时可用 `告警` 和 `恢复`，所有消息都包含其中之一。

消息中的时间按 `ALERT_TIMEZONE`（默认 `Asia/Shanghai`）显示。测试渠道最简单的方法是临时停止 API（`docker compose stop api`），约 2 分钟后收到 `ApiDown`，启动后约 5 分钟收到恢复通知。

### 查链路

API 设置 `OTEL_EXPORTER_OTLP_ENDPOINT` 后，每个请求在 Tempo 中有一条链路，包含数据库查询、Redis 命令、对外请求和它触发的队列任务。链路 ID 可从以下位置获取：

- API 日志的 `trace_id` 字段（`docker compose logs api | grep <关键字>`）；
- 响应头 `traceparent`（`00-<链路 ID>-<span ID>-01` 的第二段）。

在 Grafana 中打开「API 概览」右上角的「查链路（Tempo）」，或 Explore → Tempo，输入链路 ID 查询；也可以用 TraceQL 搜索，例如 `{ span.http.route = "/api/v1/client/auth/login" && status = error }`。

### 局限

- 监控栈和 API 运行在同一台主机上，主机宕机或断网时不会有任何告警。建议再用一个外部拨测服务（云厂商的站点监控、UptimeRobot 等）定时访问 `https://<API_DOMAIN>/api/health`。
- 没有采集主机指标（磁盘、内存）和 PostgreSQL/Redis 自身指标；需要时可加入 node-exporter、postgres-exporter、redis-exporter，并在 `prometheus.yml` 中增加抓取任务。
- 数据保留由 `PROMETHEUS_RETENTION`（默认 `15d`）和 `TEMPO_RETENTION`（默认 `168h`）控制，按磁盘空间调整。监控数据不在 `backup.sh` 的备份范围内。

## 加密密钥轮换

密钥泄露、人员变动或合规要求定期更换时，按下面的步骤轮换 `ENCRYPTION_KEY`。除重建 API 容器时的几秒外不需要停机，也不需要维护窗口：

1. 生成新密钥：`openssl rand -base64 32`。
2. 在 `.env` 中把当前值移到 `ENCRYPTION_KEYS_PREVIOUS`（已有旧密钥时用逗号追加），`ENCRYPTION_KEY` 改为新密钥，然后执行 `docker compose up -d --wait api` 重建 API。此后新写入的数据使用新密钥，旧数据仍可用旧密钥解密。
3. 把已保存的数据改用新密钥加密（复用 `migrate` 服务的镜像和配置，脚本可重复执行，不影响运行中的 API）：

   ```sh
   docker compose run --rm migrate node dist/scripts/reencrypt-secrets.js
   docker compose run --rm migrate node dist/scripts/reencrypt-secrets.js --dry-run
   ```

   `--dry-run` 只做检查：所有数据都已使用新密钥时退出码为 0，否则为 1，并列出仍在使用旧密钥和无法解密的数量。无法解密的数据（例如密钥早已丢失）会列出行 id，需要人工处理，例如重新填写模型 API Key，或在管理端为对应管理员重置双因素认证。
4. 至少等待 10 分钟，让 Redis 中尚未完成的 TOTP 绑定过期，然后清空 `ENCRYPTION_KEYS_PREVIOUS` 并再次执行 `docker compose up -d --wait api`。

密文格式没有变化，回滚到上一版镜像时，用当前 `ENCRYPTION_KEY` 加密的数据仍可读取。旧版本不认识 `ENCRYPTION_KEYS_PREVIOUS`，所以完成第 3 步之前不要回滚。轮换前的备份仍是用旧密钥加密的：从这类备份恢复时，需要把旧密钥放回 `ENCRYPTION_KEYS_PREVIOUS`，所以旧密钥要保存到这些备份过期为止。

## 日常运维

```sh
docker compose ps                          # 状态与健康
docker compose logs -f api                 # API 日志（pino JSON）
docker compose exec redis redis-cli info   # Redis（REDISCLI_AUTH 已在容器内设置）
docker compose run --rm seed               # 重复执行是安全的，只补齐缺失数据
```

容器日志由 Docker 的 `json-file` 驱动按容器轮转：单个文件达到 `LOG_MAX_SIZE`（默认 `10m`）后切分，最多保留 `LOG_MAX_FILES`（默认 `5`）个，因此每个容器最多占用约 50 MB，超出部分丢弃最旧的日志。需要长期保留日志时，另接日志收集系统，而不是调大这两个值。修改后执行 `docker compose up -d`，配置变化的容器会被重建并生效（重建会丢弃该容器之前的日志）。

当前 BullMQ Worker 运行在 API 进程内；Agent 长任务出现后再拆分独立的 Worker 服务。
