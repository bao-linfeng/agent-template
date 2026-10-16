# AI Agent 基座能力缺口分析

> 分析日期：2026-10-15  
> 分析方式：基于当前仓库代码与项目文档的静态核查，未启动服务或执行测试。  
> 目标定位：为后续开发不同 AI Agent 产品提供可复用的全栈基座。

## 1. 核心结论

项目已经具备比较完整的全栈应用基础，以及 RAG 的检索底座，但 Agent 的核心运行层尚未建立。

当前最需要补齐的主链路是：

```text
生成模型接入
  → Agent 执行循环
  → 工具调用
  → 会话与运行记录
  → 流式交互
  → 用量与质量观测
```

建议优先交付一个“可持久化、可取消、可追踪的知识库问答 Agent”，通过真实端到端场景验证基座，再根据需求扩展多 Agent、工作流、长期记忆等能力。

除 Agent 运行层外，作为通用项目基座还缺少一批与 Agent 无关、但生产项目普遍需要的能力，例如审计日志、统一错误码、SSE 基础设施、定时任务、容器化与 CI（见第 5 节）。其中供应商凭据抽象、统一错误码、SSE 基础设施和审计日志会直接影响 Agent 的数据模型与事件协议，建议与首个 Agent 一起落地。

## 2. 已有能力

| 能力 | 当前情况 |
| --- | --- |
| 用户与管理端账号 | 双账号域、登录注册、令牌刷新、会话撤销、客户端 Bearer 支持 |
| 后台权限 | 管理员 RBAC、权限码、页面及接口权限控制 |
| 数据与基础设施 | PostgreSQL、Redis、对象存储、数据库迁移、后台队列 |
| Embedding 模型管理 | 配置模型、加密保存 API Key、连通性测试、默认模型 |
| 知识库检索 | 文档上传、异步切分与向量化、向量检索、用户所有权隔离 |
| 通用工程能力 | 环境校验、结构化日志、请求 ID、健康检查、单测和 E2E 测试设施 |
| 前端基础 | 管理后台、客户端账号页、共享组件、主题、国际化 |

### 2.1 AI Talk 目前是演示页面

[`apps/admin/src/pages/ai-talk/index.vue`](apps/admin/src/pages/ai-talk/index.vue) 使用 `pickReply()` 匹配关键词，`handleSubmit()` 延迟后返回固定回复，没有调用模型。

页面中的聊天展示和输入组件可以作为交互参考，但不能视为已有真实 Agent 能力。

### 2.2 RAG 已实现检索，尚未实现生成回答

[`apps/server/src/modules/rag/retrieval.service.ts`](apps/server/src/modules/rag/retrieval.service.ts) 返回相关文档片段、分数和元数据。

当前还没有以下闭环：

```text
检索文档 → 构造上下文 → 调用生成模型 → 输出答案与引用
```

## 3. P0：成为 Agent 基座必须补齐的能力

P0 表示首个可用 Agent 闭环所需能力，不代表每项都要一次实现完整的平台化管理。

### 3.1 生成模型接入层

**当前状态：** AI 模块只有 Embedding，模型数据表为 `ai_embedding_models`，API Key 直接保存在每一条模型记录上。

代码依据：

- [`apps/server/src/database/schema/ai.ts`](apps/server/src/database/schema/ai.ts)
- [`apps/server/src/modules/ai/embedding-client.ts`](apps/server/src/modules/ai/embedding-client.ts)

**最低需要：**

- 对话／生成模型配置及凭据管理。
- 流式生成、工具调用、结构化输出能力。
- 模型能力声明，例如是否支持工具、图片、结构化输出。
- 超时、取消、错误归一化和受控重试。
- 输入／输出 token 用量采集。

**供应商与模型分开建模：**

如果照搬 `ai_embedding_models` 的结构再建一张生成模型表，同一供应商的 API Key 会在多处重复保存，轮换凭据时需要逐条修改。建议在新增生成模型之前，先抽出供应商／凭据表，Embedding 模型与生成模型都引用它：

```text
ai_providers（类型、baseUrl、加密凭据）
  ├── ai_embedding_models
  └── ai_chat_models
```

该调整涉及现有表的数据迁移，越晚做成本越高。

**实施建议：**

先接通一个真实供应商，用成熟 SDK 承担协议细节，业务侧保留模型配置与调用入口。多供应商自动路由、负载均衡可以后续再做。

### 3.2 Agent 定义与执行循环

**当前状态：** 未发现 Agent 模块或运行状态数据模型。

**Agent 最低配置：**

- 使用的模型。
- 系统提示词与参数。
- 可以调用的工具。
- 可以访问的知识库。
- 最大执行步数、执行时长及用量上限。

**执行流程：**

```text
接收用户消息
    ↓
构造上下文并调用模型
    ↓
模型请求工具 → 校验并执行工具 → 将结果交回模型
    ↑                                  │
    └──────────────────────────────────┘
    ↓
生成最终回答并结束运行
```

执行器必须具备终止条件、失败处理和取消传播，避免连续工具调用导致无法停止或持续消耗资源。

初版可以只有一个代码定义的 Agent，先跑通执行循环，再补后台配置与发布管理。

### 3.3 工具注册与执行机制

**当前状态：** 已有 `RetrievalService` 可作为工具底层服务，但没有统一工具执行层。

**最低需要：**

- 工具名称、说明及参数 Schema。
- 服务端参数校验。
- 当前用户、运行 ID 等执行上下文。
- 工具超时、结果大小限制、标准化错误。
- 工具调用记录。
- 基于用户身份的资源授权。

工具执行权限必须由服务端身份与授权结果决定，不能由模型传入的 `userId`、`ownerId` 决定。

**实施建议：**

第一版只实现一个 `knowledge_search` 工具，复用现有知识库服务与所有权校验。MCP 作为后续工具来源，不必成为第一版的前置条件。

### 3.4 对话、消息与运行记录

**当前状态：** 现有认证 session 是登录会话，不能代替 Agent 对话。

建议明确三个概念：

| 概念 | 职责 |
| --- | --- |
| Conversation | 一段持续的用户对话 |
| Message | 用户消息、助手回复和工具交互内容 |
| Run | 一次 Agent 执行，包含状态、步骤、用量及错误 |

**最低需要保存：**

- 对话所属用户。
- 消息内容及工具调用关联。
- Run 的 `running / completed / failed / cancelled` 等状态。
- 本次运行采用的模型、提示词和工具配置快照。
- 每次工具执行的结果、耗时和错误。

消息结构至少需要表达文本、工具调用、工具结果和引用，不能只存 `role + content: string`。

同时建立基础上下文预算，限制历史长度与工具输出长度，避免无限追加消息。自动摘要和长期记忆可以后补。

### 3.5 流式交互与真实产品入口

**当前状态：** 客户端没有 Agent 对话页，管理端没有真实的执行调试入口；服务端也没有任何 SSE 或 WebSocket 基础设施。

代码依据：

- [`apps/client/src/router/index.ts`](apps/client/src/router/index.ts)
- [`apps/admin/src/pages/ai-talk/index.vue`](apps/admin/src/pages/ai-talk/index.vue)

**最低需要：**

- 流式回复。
- 工具开始、工具完成、运行失败等事件。
- 停止生成。
- 历史对话加载。
- 文档引用展示。
- 页面刷新后能够恢复已保存的结果。

可以统一一套简单的事件协议：

```text
run.started
message.delta
tool.started
tool.completed
run.completed
run.failed
run.cancelled
```

“停止生成”需要取消后端模型调用和后续工具步骤，而不仅是前端停止显示。

**SSE 基础设施需要同时解决：**

- 鉴权：复用现有 Cookie／Bearer 鉴权，浏览器原生 `EventSource` 无法自定义请求头，需要选定客户端实现方式。
- 心跳与超时：定期发送注释帧，避免代理或负载均衡器断开空闲连接。
- 代理缓冲：反向代理需关闭响应缓冲（如 nginx `X-Accel-Buffering: no`），否则事件会被攒批下发。
- 断线续传：事件带递增 ID，支持 `Last-Event-ID` 从已持久化的记录补发。
- 多实例：运行与连接不在同一进程时，通过 Redis pub/sub 等机制转发事件。
- 事件中的错误使用与 HTTP 接口一致的错误码（见 5.1）。

### 3.6 安全与内容合规

**当前状态：** 文档上传、检索和 Embedding 调用没有内容安全处理；出站请求地址由管理员配置，没有统一管控。

代码依据：

- [`apps/server/src/modules/ai/embedding-client.ts`](apps/server/src/modules/ai/embedding-client.ts)（直接请求管理员配置的 `baseUrl`）
- [`apps/server/AGENTS.md`](apps/server/AGENTS.md)（仅提示“只将 `embedding-model:manage` 授予可信管理员”）

**最低需要：**

- **间接提示词注入：** 知识库文档与工具结果都是不可信输入。系统提示词与检索内容需要明确分隔，工具权限不能因模型输出而扩大；带写操作的工具需要服务端二次校验或人工确认。
- **输入／输出内容审核：** 至少预留审核钩子，可接入供应商审核接口或自建规则，审核结果计入运行记录。
- **敏感信息处理：** 日志、运行记录和评估数据中避免明文保存密钥、证件号等敏感内容；现有 pino `redact` 只覆盖请求日志。
- **出站请求管控：** 生成模型、MCP、Webhook 上线后出站请求会增多，需要统一的出站请求客户端，拦截内网与元数据地址，限制协议、超时和响应体大小。
- **合规要求：** 面向中国大陆公众提供生成式 AI 服务时，需要考虑算法／大模型备案、生成内容标识与内容过滤，应在产品立项时确认。

### 3.7 Agent 资源的账号域与权限

**当前状态：** 现有资源已按 client／admin 两个账号域划分，知识库归属于 client 用户，管理员通过权限码查看全部数据。Agent 相关资源尚未确定归属。

**需要先确定：**

- Conversation、Run 归属于 client 用户，还是管理员也能以自己的身份运行 Agent。
- 管理端调试、查看运行记录、配置 Agent 和生成模型所需的 `SUBJECTS` 与 `PERMISSIONS`，例如 `agent:read`、`agent:manage`、`chat-model:manage`、`agent-run:read`。
- 管理员查看用户对话内容的权限边界与审计要求（见 5.1）。

建议沿用现有约定：client 路由按所有权校验，admin 路由按权限码校验，Agent 定义与模型配置只在 admin 域管理。

## 4. P1：可靠上线和持续迭代所需能力

### 4.1 运行可靠性

**当前状态：** 队列只注册了邮件与文档入库，尚无 Agent 持久化执行机制。

代码依据：[`apps/server/src/infra/queue/queue.module.ts`](apps/server/src/infra/queue/queue.module.ts)。

**需要根据任务类型补齐：**

- 重复提交的幂等处理。
- 同一对话并发运行的策略。
- 服务重启后识别并处理未完成运行。
- 区分可重试模型请求与不可随意重试的写操作。
- 长任务的后台执行、状态查询与事件恢复。

如果目标包含分钟级任务、人工确认或跨服务写操作，这一项应提前到 P0。短对话可以先做，但要明确断线与进程故障时的行为。

幂等键与分布式锁属于通用能力，基座中目前没有可复用实现，见 5.1。

### 4.2 Agent 专属观测与用量控制

**当前状态：** 有请求日志、Prometheus 服务指标和 OpenTelemetry 链路追踪，尚无 Agent 级运行记录与指标。

代码依据：

- [`apps/server/src/app.module.ts`](apps/server/src/app.module.ts)
- [`apps/server/src/infra/metrics`](apps/server/src/infra/metrics)
- [`apps/server/src/tracing.ts`](apps/server/src/tracing.ts)
- [`deploy/observability`](deploy/observability)

**建议从第一个真实调用就记录：**

- `conversationId / runId`。
- 模型与配置版本。
- 输入／输出 token，供应商提供时记录缓存用量。
- 首次输出耗时与总耗时。
- 工具调用次数、耗时和失败原因。
- 成本估算及其价格依据。

**用量控制：**

- 用户并发运行数限制。
- 单次运行步数、token 和时长上限。
- 用户级用量配额。

现有 HTTP 请求限流不能代替这些限制，因为一次请求可能触发多次模型和工具调用。

基础记录和单次执行上限应随首个 Agent 一起落地，聚合报表与完整配额管理可以后续完善。

### 4.3 Agent 行为测试与质量评估

**当前状态：** 已有测试主要覆盖账号、权限、Embedding 和 RAG，尚不能验证 Agent 是否正确完成任务。

相关测试：

- [`apps/server/test/auth.e2e-spec.ts`](apps/server/test/auth.e2e-spec.ts)
- [`apps/server/test/bearer.e2e-spec.ts`](apps/server/test/bearer.e2e-spec.ts)
- [`apps/server/test/rbac.e2e-spec.ts`](apps/server/test/rbac.e2e-spec.ts)
- [`apps/server/test/rag.e2e-spec.ts`](apps/server/test/rag.e2e-spec.ts)

需要两类验证。

#### 确定性的工程测试

- 模型返回工具调用后，是否正确执行并继续。
- 参数错误、工具超时、取消是否正确结束。
- 是否阻止越权检索。
- 重试是否造成重复写入。
- 文档中包含注入指令时，是否不会越权调用工具。

#### 小规模质量评估集

- 应当检索时是否检索。
- 回答是否有正确引用。
- 没有依据时是否承认不足。
- 成功率、耗时及成本是否随版本退化。

关键工程测试应随首版实现落地。初期维护一组有代表性的评估案例即可，不必先建设复杂评测平台。

### 4.4 RAG 产品闭环与质量增强

现有 RAG 能力可以直接支撑首版，但仍有以下缺口：

| 缺口 | 建议时机 |
| --- | --- |
| 知识库、文档上传、入库状态和检索调试页面 | 首版知识库 Agent 一起补 |
| 回答引用及来源定位 | 首版一起补 |
| PDF / DOCX 解析 | 根据实际文档类型提前 |
| 关键词与向量混合检索、重排序 | 用评估结果决定 |
| 元数据过滤、多知识库检索 | 随具体业务补充 |
| 增量同步、版本与重复文档处理 | 接入持续变化的数据源时补 |

当前解析器只支持 UTF-8 文本类格式；检索是单知识库向量检索，主要参数为 `topK` 与 `minScore`。

代码依据：

- [`apps/server/src/modules/rag/document-parsers.ts`](apps/server/src/modules/rag/document-parsers.ts)
- [`apps/server/src/modules/rag/retrieval.service.ts`](apps/server/src/modules/rag/retrieval.service.ts)
- [`apps/server/src/modules/rag/ingest.processor.ts`](apps/server/src/modules/rag/ingest.processor.ts)

### 4.5 发布与部署链路

**当前状态：** 根级 CI、生产镜像、单机部署、备份恢复与依赖更新已补齐（2026-10-15），部署细节见 [`deploy/README.md`](../deploy/README.md)。

| 项目 | 状态 |
| --- | --- |
| 提交或 PR 自动运行 lint、类型检查、测试和构建 | 已完成：`.github/workflows/ci.yml`，另含迁移与 schema 同步检查、server E2E、三个镜像的构建 |
| server、admin、client 生产镜像（多阶段构建、非 root 用户、健康检查）及 `.dockerignore` | 已完成：`apps/*/Dockerfile`、根 `.dockerignore`；`release.yml` 在 `v*` tag 时推送 GHCR |
| 可重复的应用部署流程与迁移步骤 | 已完成：`deploy/docker-compose.yml`（Caddy 网关）与 `deploy/scripts/deploy.sh`（备份 → 迁移 → 发布 → 就绪检查） |
| 数据库备份与恢复演练、迁移失败时的回滚策略 | 已完成：`backup.sh`、`restore.sh --verify`；回滚依赖向后兼容迁移（expand/contract）与发布前备份 |
| 依赖更新机制，配合 24 小时最小发布时间 | 已完成：`renovate.json`（`minimumReleaseAge: 1 day`），需在 GitHub 安装 Renovate App 后生效 |
| API 与 Worker 独立部署 | 待 Agent 长任务出现后再做（当前 Worker 运行在 API 进程内） |
| Agent 配置版本记录，运行绑定实际使用的版本 | 待 Agent 模块建立后随 3.4 的运行记录一起实现 |

**仍需注意：**

- 单机 Compose 替换容器时 API 有数秒中断；需要零停机或多实例时再迁移到 Kubernetes 等编排平台。
- 备份保存在部署主机本地，需要另行同步到异地存储。
- 前端镜像在构建时写入 API 地址，换域名需重新构建。

## 5. 通用基座能力缺口

以下能力与 Agent 无关，但通用生产项目普遍需要；除标注“已完成”的项外，当前代码中均未实现。标注“随首版”的项建议与首个 Agent 一起落地，其余按 P1 处理。

### 5.1 后端

| 缺口 | 当前情况 | 建议时机 |
| --- | --- | --- |
| 统一错误码 | 已完成：`apps/server/src/common/errors`（`ERRORS` 错误码目录、`AppException`、全局 `AllExceptionsFilter`），错误体统一为 `{ statusCode, code, message, params?, details? }`；admin/client 按 `code` 显示本地化文案（`apiErrors.*`），未翻译的码回退到服务端原文 | 随首版；Agent 流式事件复用同一套 `code` |
| 审计日志 | 管理员修改角色、禁用账号、删除知识库、修改模型凭据等操作不留记录 | 随首版，Agent 配置变更与对话查看需要留痕 |
| 幂等键与分布式锁 | 没有通用实现；仅验证码使用了 Redis Lua 脚本 | 随首版，用于重复提交与对话并发控制 |
| 定时任务 | 没有 `@Cron` 或 BullMQ 重复任务；过期会话、重置令牌和孤儿对象没有清理任务 | P1 |
| 账号注销与数据导出 | 只能删除头像、会话等，无法注销账号或导出个人数据；没有软删除与数据保留策略 | P1，面向公众上线前补齐 |
| 第三方登录／SSO／双因素认证 | 均未实现；Bearer 通道已就绪，但没有微信、企业 SSO 等身份接入，管理员没有 TOTP | 按目标用户决定，管理员 TOTP 建议 P1 |
| 指标与链路追踪 | 已完成：Prometheus 指标（`apps/server/src/infra/metrics`，独立内部端口 9464）、OpenTelemetry 链路追踪（`apps/server/src/tracing.ts`，OTLP 上报 Tempo），以及 `deploy/observability` 的监控栈（Prometheus、Alertmanager、Grafana、Tempo）和告警规则（API 不可用、错误率、延迟、连接池、队列积压与停滞、任务最终失败、定时任务未执行），通知渠道为邮件与企业微信、飞书、钉钉机器人 | P1 |
| 数据库连接防护 | 已完成：`createPool` 设置 `statement_timeout`（默认 30 s）、`idle_in_transaction_session_timeout`（默认 60 s）与取连接超时（默认 5 s），可通过 `DATABASE_*_TIMEOUT_MS` 调整；连接错误由监听器记录，不再因未处理的 `error` 事件导致进程退出；迁移与建向量索引不受语句超时限制 | P1 |
| 上传内容校验 | 已完成：头像按文件头（magic bytes）识别 PNG/JPEG/GIF/WebP 并拒绝 SVG，文档上传时严格 UTF-8 解码；设置 `CLAMAV_HOST` 后头像与文档在写入存储前经 clamd 扫描（`apps/server/src/infra/antivirus`，fail closed：感染 422、扫描不可用 503），部署通过 `antivirus` profile 启用，指标 `upload_scans_total` 与告警 `UploadScanFailing` | P1，开放用户上传前补齐 |
| 加密密钥轮换 | `SecretBox` 密文带 `v1` 版本前缀，但只支持单个 `ENCRYPTION_KEY`，更换密钥需要手动迁移 | P1 |
| 系统配置与功能开关 | 没有运行时可修改的系统配置，所有开关依赖环境变量和重启 | 按需 |
| 站内通知 | 只有邮件通知，没有站内消息 | 按需，长任务完成通知时需要 |

代码依据：

- [`apps/server/src/modules/accounts/accounts.service.ts`](apps/server/src/modules/accounts/accounts.service.ts)
- [`apps/server/src/database/database.ts`](apps/server/src/database/database.ts)
- [`apps/server/src/common/crypto/crypto.ts`](apps/server/src/common/crypto/crypto.ts)
- [`apps/server/src/common/http/multipart.ts`](apps/server/src/common/http/multipart.ts)
- [`apps/server/src/infra/queue/queue.module.ts`](apps/server/src/infra/queue/queue.module.ts)

### 5.2 前端与工程

| 缺口 | 当前情况 | 建议时机 |
| --- | --- | --- |
| 前后端类型同步 | 前端 `services/api/*` 手写请求与响应类型，后端已有 Swagger 但没有生成前端类型 | 随首版，Agent 接口与事件类型较多 |
| 前端 E2E | 只有 Vitest 单测，没有 Playwright 等浏览器端到端测试 | P1，首版聊天流程稳定后补 |
| 管理端真实看板 | Dashboard 仍是假数据，缺少用户数、队列状态、模型调用量等运营数据 | P1，依赖 4.2 的用量记录 |
| 客户端知识库页面 | 客户端只有账号相关页面，没有知识库与对话入口 | 随首版（见 4.4、3.5） |

## 6. 按产品定位决定的能力

以下能力目前也没有，但不建议在第一阶段全部建设。

| 能力 | 需要的场景 |
| --- | --- |
| 组织／Workspace、多租户成员权限 | 面向企业团队，共享 Agent、知识库或额度；应尽早确定数据归属 |
| 人工审批与恢复执行 | Agent 执行需要用户确认的业务写操作 |
| MCP 接入与第三方凭据管理 | 连接外部工具生态 |
| 开发者 API Key 与对外 API | 第三方系统以服务身份调用 Agent；需要作用域、吊销、独立限流与用量归属，现有 Bearer 只代表登录用户 |
| 多模态输入 | 用户在对话中上传图片或文件；需复用 `StorageService` 与文档解析链路，并依赖模型能力声明 |
| 定时任务、Webhook 触发 | 用户离线时主动执行任务 |
| 沙箱与产物管理 | 运行代码、处理文件或生成可下载成果 |
| 长期记忆 | 明确的跨会话个性化需求 |
| 多 Agent 协作、可视化工作流 | 单 Agent 已不足以完成真实任务 |
| 计费与套餐 | 商业化；用量记录应提前建设 |

### 6.1 组织级多租户需要尽早决策

目前知识库直接归属于用户，管理员与客户端的双账号域不等于组织／租户模型。

代码依据：[`apps/server/src/database/schema/rag.ts`](apps/server/src/database/schema/rag.ts)。

如果目标明确是团队型 SaaS，应在新增 Agent、对话和凭据表之前确定资源归属方式，避免后续高成本迁移。如果目标是个人使用的 Agent 产品，现有用户归属方式可以继续沿用。

## 7. 推荐实施路线

### 7.1 首个交付目标

交付一个“可持久化、可取消、可追踪的知识库问答 Agent”。

```text
用户上传文档
  → 后台完成入库
  → 用户发起对话
  → Agent 调用知识库搜索工具
  → 流式生成带引用的回答
  → 保存消息、工具记录和用量
  → 用户刷新页面后仍能查看
```

### 7.2 实施顺序

| 阶段 | 主要交付 |
| --- | --- |
| 0. 基座前置 | 供应商／凭据抽象、统一错误码与全局异常过滤器、审计日志、Agent 资源归属与权限码 |
| 1. 真实模型链路 | 生成模型接入、出站请求管控、最小流式对话、基础超时与用量采集 |
| 2. 持久化 | Conversation / Message / Run、资源归属、运行状态和配置快照 |
| 3. Agent 执行 | 工具调用循环、`knowledge_search`、现有 RAG 接入、步数和上下文上限、注入防护 |
| 4. 产品入口 | SSE 基础设施、客户端真实聊天页、知识库管理入口、工具状态和引用展示、前端类型生成 |
| 5. 首版可靠性 | 取消、失败处理、幂等与并发控制、运行记录和关键测试 |
| 6. 上线准备 | 生产镜像与 CI、备份恢复、指标告警、定时清理任务、内容审核与合规确认 |
| 7. 场景扩展 | 按需求增强长任务可靠性、MCP、对外 API、长期记忆或工作流 |

上述阶段是实施顺序，不要求每一阶段都独立建设完整管理平台。围绕同一个知识库问答场景逐步打通即可。

### 7.3 首版验收标准

- 用户能够上传支持的文档，并查看入库成功或失败状态。
- 用户能够发起真实模型对话，收到流式回答。
- Agent 能调用知识库工具，并在服务端按当前用户校验访问权限。
- 回答能够展示与检索结果关联的引用。
- 对话、工具调用、运行状态和用量能够持久化。
- 页面刷新后能够查看已保存的对话结果。
- 用户可以停止运行，后端停止后续模型和工具执行。
- 达到步数、时长等执行上限时，运行能够以明确状态结束。
- 模型失败、工具失败与取消不会让运行永久停留在执行中。
- 流式连接断开后可以重连并补齐已产生的事件。
- HTTP 接口与流式事件使用同一套错误码，前端可按错误码展示本地化文案。
- 管理员修改模型、凭据和 Agent 配置的操作有审计记录。
- 关键工具执行、权限隔离、注入防护、终止与取消路径有自动化测试。

## 8. 总结

当前最缺的是连接现有基础设施的 Agent 核心闭环。

优先补齐模型、运行器、工具、会话和流式交互，同时提前处理供应商凭据抽象、统一错误码、审计日志和 SSE 基础设施这类“越晚改越贵”的基座能力，再用真实业务验证可靠性与质量，项目就能从“带 RAG 的全栈模板”演进为真正可复用的 Agent 基座。
