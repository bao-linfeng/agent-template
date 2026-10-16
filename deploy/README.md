# 生产部署（单机 Docker Compose）

本目录把 server、admin、client 和依赖服务部署到一台 Linux 主机：

```text
Internet ──443──▶ gateway (Caddy, 自动 HTTPS)
                    ├─ API_DOMAIN    → api    (apps/server 镜像, :3100)
                    ├─ ADMIN_DOMAIN  → admin  (nginx 静态站, :8080)
                    └─ CLIENT_DOMAIN → client (nginx 静态站, :8080)
api ──▶ postgres (pgvector) / redis / rustfs   —— 仅内网，不发布端口
```

| 文件                 | 作用                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| `docker-compose.yml` | 生产编排；`migrate`、`seed` 属于 `ops` profile，只能通过 `docker compose run` 执行 |
| `.env.example`       | 域名、镜像、密钥、SMTP、备份配置模板，复制为 `.env`（已被 git 忽略）               |
| `Caddyfile`          | 三个域名的反向代理与证书                                                           |
| `nginx/`             | admin/client 镜像使用的 SPA 配置（history 回退、静态资源长缓存、安全响应头）       |
| `scripts/deploy.sh`  | 发布：拉取或构建镜像 → 启动基础设施 → 发布前备份 → 迁移 → 滚动更新 → 就绪检查      |
| `scripts/backup.sh`  | 备份 PostgreSQL 与对象存储，按保留天数清理                                         |
| `scripts/restore.sh` | `--verify` 恢复演练（临时库，不停机）或正式恢复                                    |

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

`ENCRYPTION_KEY` 加密数据库中的模型 API Key，丢失后已保存的密钥无法解密，需与备份分开妥善保管。密码会拼进连接 URL，请用 `openssl rand -hex 32` 生成 URL 安全的值。

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

## 日常运维

```sh
docker compose ps                          # 状态与健康
docker compose logs -f api                 # API 日志（pino JSON）
docker compose exec redis redis-cli info   # Redis（REDISCLI_AUTH 已在容器内设置）
docker compose run --rm seed               # 重复执行是安全的，只补齐缺失数据
```

当前 BullMQ Worker 运行在 API 进程内；Agent 长任务出现后再拆分独立的 Worker 服务。
