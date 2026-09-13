# Medusa Mall Extension —— 开源在线商城系统二次开发

> 《开源软件与新技术》实验 02 · 个人独立完成
>
> 基于 Medusa DTC Starter 固定快照，完成商品浏览到创建订单的完整闭环，
> 并新增「登录用户收藏夹」自主功能。
>
> 上游项目原始 README 备份在 [`docs/UPSTREAM-README.md`](./docs/UPSTREAM-README.md)。

---

## 一、项目简介

一句话：**在 Medusa DTC Starter 的基础上，跑通「浏览商品 → 加入购物车 → 结算 → 创建订单」
的完整链路，并新增一个用后端持久化数据支撑的收藏夹功能。**

这不是一个新项目，而是一次**有明确边界的二次开发**：上游负责电商核心能力
（商品、变体、价格、库存、购物车、订单、Store API），我负责把链路跑通、
补齐库存边界、实现收藏夹，并用测试证明订单和库存不会出错。

## 二、目标用户与问题场景

**目标用户**：中小型自营电商的运营者和顾客。

**要解决的问题**：

1. **数据一致性**：顾客点「提交订单」时如果网络卡顿重复点击，容易产生重复订单；
   库存不足时如果前端没拦住，会出现「超卖」。
2. **浏览与决策脱节**：顾客看到一个商品想「先存着，之后再买」，
   但商城没有收藏能力，只能靠浏览器书签，换设备就找不到了。

**本实验的应对**：

- 订单与库存一致性：对零库存、超量、重复提交分别定义行为并写测试覆盖。
- 收藏能力：新增收藏夹，数据存 PostgreSQL 并绑定账号，天然支持跨设备同步。

## 三、功能清单

### 3.1 基线功能（上游 DTC Starter 已提供，本实验跑通并验证）

- [x] 商品列表、分类浏览
- [x] 商品详情页、变体选择、价格显示
- [x] 加入购物车、修改数量、删除行项目
- [x] 填写结算信息、选择配送方式、创建订单
- [x] 管理端可查看商品与订单
- [x] 健康检查、管理端、店面三个入口可访问

### 3.2 二次开发新增

- [x] **收藏夹（自主功能，`shoucang` 模块）**
  - 商品详情页「加入收藏 / 已收藏」按钮
  - 收藏夹独立页面 `/[countryCode]/shoucang`
  - 商品下架后在收藏夹中标注「已下架」而非静默消失
  - 商品被删除后显示提示并允许移除
  - 重复收藏幂等，不产生重复记录
  - 越权防护：不能操作他人的收藏
- [x] **商品数据补齐**：从 4 个扩充到 10 个，含多变体、零库存、仅剩 1 件、超长标题
- [x] **库存边界配置**：把上游「统一 100 万库存」改为有梯度的边界值

## 四、技术栈与系统架构

| 层 | 技术 | 版本 |
|---|---|---|
| 后端框架 | Medusa | 2.20.1 |
| 运行时 | Node.js | 22.22.2（满足快照要求 ≥22.12） |
| 包管理 | pnpm | 10.11.1（与上游锁文件一致） |
| 数据库 | PostgreSQL | 16 |
| 店面 | Next.js（App Router） | 随上游快照 |
| 语言 | TypeScript | 5.x |

### 架构图

```mermaid
graph TB
    subgraph 顾客
        U[浏览器]
    end

    subgraph 店面["Next.js 店面 :8000"]
        SF[页面与组件]
        SD["src/lib/data/* 服务端数据层"]
    end

    subgraph 后端["Medusa 后端 :9000"]
        API[Store API + 自定义 API]
        WL["shoucang 模块<br/>（二次开发新增）"]
        CORE[Commerce Modules<br/>商品/库存/购物车/订单]
        WF[Workflows<br/>createCart, placeOrder]
    end

    subgraph 数据库
        PG[(PostgreSQL :5432)]
    end

    U --> SF
    SF --> SD
    SD -->|"REST /store/*"| API
    API --> CORE
    API --> WL
    API --> WF
    CORE --> PG
    WL --> PG
    WF --> PG
```

### 关键数据模型关系

```mermaid
erDiagram
    PRODUCT ||--o{ PRODUCT_VARIANT : "拥有"
    PRODUCT_VARIANT ||--o{ PRICE : "按区域定价"
    PRODUCT_VARIANT ||--o| INVENTORY_ITEM : "对应库存项"
    INVENTORY_ITEM ||--o{ INVENTORY_LEVEL : "按库位分仓"
    CUSTOMER ||--o{ CART : "拥有"
    CART ||--o{ LINE_ITEM : "包含变体"
    CART ||--o| ORDER : "结算后转为"
    ORDER ||--o{ ORDER_LINE_ITEM : "包含"
    CUSTOMER ||--o{ SHOUCANG_ITEM : "拥有（二次开发）"
    PRODUCT ||--o{ SHOUCANG_ITEM : "被收藏（二次开发）"

    SHOUCANG_ITEM {
        text id PK
        text kehu_id "客户 ID"
        text shangpin_id "商品 ID"
        text beizhu "备注，可空"
    }
```

**为什么购物车挂的是变体而不是商品**：同一件衣服有 S/M/L 三个尺码，
库存和价格都是按尺码（变体）区分的。购物车要锁定「具体买哪个尺码」，
所以行项目必须指向变体。这一点在报告的思考题里有详细讨论。

## 五、环境要求与版本检查

| 组件 | 要求 | 检查命令 |
|---|---|---|
| Node.js | ≥ 22.12（推荐 22 LTS） | `node -v` |
| pnpm | **必须 10.11.1** | `pnpm -v` |
| PostgreSQL | ≥ 15（本实验用 16） | `psql --version` |
| Git | ≥ 2.40 | `git --version` |

**端口占用检查**（三个端口都必须是空闲的）：

```powershell
# Windows PowerShell
Get-NetTCPConnection -LocalPort 5432,9000,8000 -ErrorAction SilentlyContinue
```

| 端口 | 用途 |
|---|---|
| 5432 | PostgreSQL |
| 9000 | Medusa 后端 + 管理端 |
| 8000 | Next.js 店面 |

## 六、安装、配置、初始化与运行

### 6.1 获取代码

```bash
git clone <本仓库地址>
cd medusa-mall
git switch --detach 19e8a6fbefea5a385e9502409908bfbebbecf526
git switch -c feature/store-extension
```

### 6.2 安装依赖（必须用锁文件）

```bash
pnpm install --frozen-lockfile
```

> **不要**用 `npm install`，会生成第二份锁文件，破坏基线固定。

### 6.3 创建数据库

用 PostgreSQL 超级用户执行：

```sql
CREATE USER medusa_user WITH PASSWORD '你的本地密码';
CREATE DATABASE medusa_mall OWNER medusa_user;
GRANT ALL PRIVILEGES ON DATABASE medusa_mall TO medusa_user;
```

### 6.4 配置环境变量

```powershell
Copy-Item apps/backend/.env.template apps/backend/.env
Copy-Item apps/storefront/.env.template apps/storefront/.env.local
```

编辑 `apps/backend/.env`，重点是这几项：

```ini
DATABASE_URL=postgres://medusa_user:你的本地密码@localhost:5432/medusa_mall
JWT_SECRET=本地实验用随机串，不要用默认的 supersecret
COOKIE_SECRET=本地实验用随机串，不要用默认的 supersecret
STORE_CORS=http://localhost:8000
ADMIN_CORS=http://localhost:5173,http://localhost:9000
AUTH_CORS=http://localhost:5173,http://localhost:9000
```

> **注意**：上游 README 里写的是 `apps/backend.env`，实际路径应为 `apps/backend/.env`，这是上游文档的一处笔误。
>
> **关于 REDIS_URL**：模板里有这一项，但本快照没有启用 Redis 模块，基础路线不需要装 Redis，保持默认即可。

### 6.5 数据库迁移与管理员账号

```bash
cd apps/backend
pnpm exec medusa db:migrate

# 创建本地管理员（邮箱密码自己定，不要用真实邮箱密码）
pnpm exec medusa user -e admin@example.test -p "本地随机密码"
```

### 6.6 初始化演示数据（按顺序执行）

```bash
# 仍在 apps/backend 目录

# 第 1 步：上游基线种子（区域、货币、库存地点、配送、4 个商品、API Key）
pnpm exec medusa exec ./src/migration-scripts/initial-data-seed.ts

# 第 2 步：二次开发增量种子（补齐到 10 个商品 + 设置库存边界）
pnpm exec medusa exec ./src/migration-scripts/shangpin-seed.ts
```

> 两个脚本都是**幂等**的，重复执行不会产生重复数据。
> 第 2 步完成时会打印每个商品的库存，便于核对。

### 6.7 启动

**终端 1 —— 后端**：

```bash
cd apps/backend
pnpm run dev
```

等日志出现 `Server is ready on port: 9000` 后：

- 健康检查：http://localhost:9000/health
- 管理端：http://localhost:9000/app

**取得 Publishable API Key**：登录管理端 → Settings → Publishable API Keys → 复制 Key。

写入 `apps/storefront/.env.local`：

```ini
MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=刚才复制的Key
NEXT_PUBLIC_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_REGION=dk
```

> 用 Publishable Key 是安全的，它本来就设计给公开前端用。
> **Admin Token 绝对不能放进店面的环境变量**，那会导致管理权限泄漏。

**终端 2 —— 店面**：

```bash
cd apps/storefront
pnpm run dev
```

访问 http://localhost:8000/dk/store

> 默认国家代码是 `dk`，它必须属于已建立的区域（Europe 区域包含 gb/de/dk/se/fr/es/it）。
> **不要**未经配置就把 URL 改成 `/cn/store`，那会找不到区域导致商品列表为空。

### 6.8 单位置启动（可选）

仓库根目录提供了脚本，一次拉起后端和店面：

```bash
# Windows PowerShell
./scripts/start-all.ps1

# Git Bash / Linux / macOS
bash ./scripts/start-all.sh
```

### 6.9 停止与清理

```bash
# 停止：在各终端按 Ctrl+C

# 完全重置数据库（会删除所有演示数据，请谨慎）
cd apps/backend
pnpm exec medusa db:drop      # 删除所有表
pnpm exec medusa db:migrate   # 重新迁移
# 然后重新执行 6.6 的两个种子脚本
```

## 七、最小演示数据与完整 Demo 流程

### 7.1 演示数据总览（10 个商品）

| # | handle | 商品 | 变体 | 库存设计 | 测试用途 |
|---|---|---|---|---|---|
| 1 | `t-shirt` | Medusa T-Shirt | S/M/L/XL × 黑/白（8） | 500 | 多变体主链路 |
| 2 | `sweatshirt` | Medusa Sweatshirt | S/M/L/XL（4） | 500 | 单维度多变体 |
| 3 | `sweatpants` | Medusa Sweatpants | S/M/L/XL（4） | 500 | 单维度多变体 |
| 4 | `shorts` | Medusa Shorts | S/M/L/XL（4） | 500 | 单维度多变体 |
| 5 | `hoodie` | Medusa Hoodie | S/M/L（3） | **S 仅 1 件**，其余 500 | 库存边界：买 2 件失败 |
| 6 | `cap` | Medusa Cap | S/M（2） | 500 | 常规加购 |
| 7 | `limited-jacket` | 限量版夹克 | M（1） | **0（缺货）** | 零库存：加购被拒 |
| 8 | `collab-sneakers` | 联名款运动鞋 | 3 尺码 × 2 色（6） | **全部仅 1 件** | 多变体 + 库存边界 |
| 9 | `socks` | Medusa Socks | S/M（2） | **S 缺货**，M 500 | 同商品不同变体库存差异 |
| 10 | `long-title-vest` | 超长标题马甲 | M/L（2） | 500 | 前端长标题排版 |

### 7.2 完整 Demo 流程（按此顺序演示）

**演示 1：商品浏览与搜索**

1. 打开 http://localhost:8000/dk/store
2. 展示 10 个商品卡片（注意第 10 个的长标题换行效果）
3. 点击任意商品进入详情页，切换变体，观察价格变化

**演示 2：库存边界（重点）**

4. 进入 `limited-jacket`（限量版夹克）→ 选 M → 按钮显示 **Out of stock**，无法加入购物车
5. 进入 `hoodie` → 选 **S**（仅剩 1 件）→ 加入购物车
6. 在购物车中把数量改成 **2** → 后端拒绝，界面给出库存不足提示
7. 改回 1 → 恢复正常

**演示 3：收藏夹（自主功能，重点）**

8. 未登录状态进入任意商品详情页，点「加入收藏」→ 提示「请先登录后再收藏商品。」
9. 登录（先注册一个账号：Account → Sign up）
10. 回到商品详情页，点「加入收藏」→ 提示「收藏成功。」
11. **再点一次**（此时按钮已变成「已收藏 ♥」）→ 先点取消收藏，再点收藏 → 验证不产生重复
12. 点击导航栏「收藏夹」→ 看到刚收藏的商品
13. **跨设备验证**：换一个浏览器（或隐身窗口）登录同一账号 → 收藏夹内容一致
14. 在管理端把某个已收藏商品改为 **Draft（下架）**
15. 刷新收藏夹 → 该商品灰显并标注「已下架 · 暂时无法购买」，记录仍在

**演示 4：下单闭环**

16. 把 `cap` 加入购物车 → 进入购物车 → 结算
17. 填写虚构的欧洲地址（例如 Copenhagen, Denmark）
18. 选择 Standard Shipping → 选择手动测试支付 → 提交订单
19. 跳转到订单确认页，记下订单号
20. 打开管理端 → Orders → 找到刚才的订单，确认商品和金额正确

**演示 5：订单幂等**

21. 回到结算页，连续快速点击「提交订单」→ 观察按钮在请求期间被禁用
22. 管理端确认只产生了 **一笔** 订单

**演示 6：持久化**

23. 停掉后端和数据库，再重启
24. 刷新店面 → 商品、购物车、订单、收藏全部还在

## 八、测试

### 8.1 运行测试

```bash
cd apps/backend

# API 集成测试（本实验新增的收藏夹测试就在这里）
pnpm test:integration:http

# 模块级测试
pnpm test:integration:modules

# 单元测试
pnpm test:unit

# 代码检查
pnpm lint
```

店面端：

```bash
cd apps/storefront
pnpm lint
pnpm build
```

> **Windows 注意**：上游的测试脚本用了 `TEST_TYPE=xxx` 这种类 Unix 的环境变量写法。
> 在 PowerShell 里直接运行会报「无法识别 TEST_TYPE」。
> 解决办法是先 `cd apps/backend`，然后用 Git Bash 执行，或手动设置：
>
> ```powershell
> $env:TEST_TYPE="integration:http"
> $env:NODE_OPTIONS="--experimental-vm-modules"
> npx jest --silent=false --runInBand --forceExit
> ```
>
> 这类报错是 shell 语法问题，**不是**业务测试失败。

### 8.2 测试覆盖清单

| 测试类型 | 要求数量 | 本实验覆盖 | 位置 |
|---|---|---|---|
| 端到端功能测试 | 8 | 浏览/搜索/详情/加购/改数量/结算/下单/管理端查单 | `docs/测试记录-端到端.md` |
| API 测试 | 6 | 收藏夹接口 10 个用例 | `integration-tests/http/shoucang.spec.ts` |
| 业务边界测试 | 6 | 零库存/超量/重复提交/下架/无效输入/删除不存在行项目 | `docs/测试记录-边界.md` |
| 持久化/初始化测试 | 2 | 重启保留数据、新库 seed 重建 | `docs/测试记录-持久化.md` |

### 8.3 已知问题

1. **收藏接口的并发幂等**：当前用「先查后插」实现幂等，能覆盖重复点击场景。
   极端并发（两个请求在同一毫秒通过检查）理论上仍可能写入两条。
   彻底解决需要给 `(kehu_id, shangpin_id)` 加唯一索引。
   本实验未加，原因见报告的「未解决风险」。
2. **店面没有自动化 UI 测试**：上游快照未配置 Playwright，本实验的端到端验证
   采用手工执行 + 截图记录的方式，未写自动化 E2E 脚本。
3. **搜索依赖上游模板**：商品列表页的搜索若上游模板未提供输入框，
   需通过 Store API 的 `q` 参数查询，本实验以 API 层验证为主。

## 九、二次开发内容（与上游基线的差异）

### 9.1 新增文件

**后端**：

| 文件 | 作用 |
|---|---|
| `src/modules/shoucang/index.ts` | 注册收藏夹模块 |
| `src/modules/shoucang/models/shoucang-item.ts` | 收藏项数据模型 |
| `src/modules/shoucang/service.ts` | 模块服务，封装业务查询 |
| `src/api/store/shoucang/route.ts` | POST 收藏 / GET 查询 |
| `src/api/store/shoucang/[id]/route.ts` | DELETE 取消收藏 |
| `src/migration-scripts/shangpin-seed.ts` | 商品扩充 + 库存边界种子 |
| `integration-tests/http/shoucang.spec.ts` | 收藏夹 API 测试 |

**前端**：

| 文件 | 作用 |
|---|---|
| `src/lib/data/shoucang.ts` | 收藏夹数据层，调用自定义 API |
| `src/modules/products/components/shoucang-button/index.tsx` | 商品页收藏按钮 |
| `src/modules/shoucang/components/shoucang-list/index.tsx` | 收藏夹列表 |
| `src/app/[countryCode]/(main)/shoucang/page.tsx` | 收藏夹页面路由 |

### 9.2 修改的上游文件（共 3 处，改动都很小）

| 文件 | 改动 | 原因 |
|---|---|---|
| `apps/backend/medusa-config.ts` | 注册 `shoucang` 模块 | 让框架加载自定义模块 |
| `apps/storefront/src/modules/products/templates/index.tsx` | 在右侧栏插入收藏按钮，并把组件改为 async 以读取登录态 | 商品详情页需要收藏入口 |
| `apps/storefront/src/modules/layout/templates/nav/index.tsx` | 增加「收藏夹」导航链接 | 提供收藏夹入口 |

### 9.3 明确没有做的事

- 没有修改 `node_modules` 里的任何文件。
- 没有修改 Medusa 核心（`packages/`）代码，只使用模块与 API 扩展点。
- 没有把改动写在依赖目录里（否则重装依赖就会丢失）。

## 十、个人开发记录与贡献证据

### 10.1 分支与远程

```bash
git remote -v
# origin   <个人仓库>   (fetch/push)
```

### 10.2 Commit 记录（对应开发阶段）

| # | 阶段 | Commit 主题 |
|---|---|---|
| 1 | 基线 | `chore: pin dtc-starter baseline to 19e8a6f` |
| 2 | 核心功能 | `feat(seed): expand demo catalog to 10 products with stock boundaries` |
| 3 | 自主功能 | `feat(store): add shoucang module with persisted wishlist items` |
| 4 | 自主功能 | `feat(store): expose wishlist API with idempotent add and auth guard` |
| 5 | 自主功能 | `feat(storefront): add wishlist button and wishlist page` |
| 6 | 测试 | `test(shoucang): cover auth, idempotency, cross-customer access` |
| 7 | 文档 | `docs: add README, NOTICE and business rule decision record` |

对照关系：**基线 → 核心功能 → 自主功能 → 测试 → 文档**，
每个阶段都有对应 commit，符合实验对「至少 5 个可解释的非合并 Commit」的要求。

### 10.3 查看证据的命令

```bash
git log --oneline --graph --decorate --all -n 30
git shortlog -sne HEAD
git diff 19e8a6fbefea5a385e9502409908bfbebbecf526 --stat
```

## 十一、上游项目、第三方资源与许可证

详见 [NOTICE.md](./NOTICE.md)。

要点：
- 上游：`medusajs/medusa`（MIT）与 `medusajs/dtc-starter`（MIT），固定 Commit `19e8a6f`。
- 本仓库沿用 MIT 许可证。
- 未新增任何第三方 npm 依赖。
- 未使用 Medusa 企业版材料。
- 仓库不含密码、Token、数据库口令。

## 十二、安全注意事项

1. **环境变量**：`.env` 与 `.env.local` 已在 `.gitignore` 中，不提交。
   仓库只保留 `.env.template`。
2. **Publishable Key vs Admin Token**：店面前端只能使用 Publishable API Key。
   Admin Token 一旦放进 `NEXT_PUBLIC_*` 变量就会被浏览器用户拿到，等于交出管理权限。
3. **密钥替换**：上游模板的 `JWT_SECRET` / `COOKIE_SECRET` 默认值是公开的 `supersecret`，
   本地实验也必须换成随机值，否则任何人都能伪造登录态。
4. **CORS 收紧**：`STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` 只写本地地址，
   不要为了图方便写 `*`。
5. **支付**：本实验全程使用 `pp_system_default` 测试支付与 `manual_manual` 手工配送，
   **没有配置任何真实支付密钥**。
6. **越权防护**：收藏夹的删除接口额外校验 `kehu_id`，
   防止拿到别人的记录 ID 就能删除别人的数据。
7. **演示脱敏**：提交的截图和报告中不出现真实邮箱、真实密码、Token 和个人信息。

## 十三、主要功能截图

截图保存在 `docs/截图/` 目录下：

| 文件 | 内容 |
|---|---|
| `01-商品列表.png` | 10 个商品的列表页 |
| `02-商品详情.png` | 商品详情与变体选择 |
| `03-零库存.png` | 限量版夹克 Out of stock |
| `04-收藏成功.png` | 收藏按钮与成功提示 |
| `05-收藏夹.png` | 收藏夹页面 |
| `06-已下架标注.png` | 收藏夹中的下架商品 |
| `07-购物车.png` | 购物车与库存不足提示 |
| `08-订单确认.png` | 下单成功后的订单确认页 |
| `09-管理端订单.png` | 管理端查到的订单 |
| `10-测试通过.png` | 测试命令运行结果 |

## 十四、实验追加说明（本实验特有事项）

- **DTC Commit**：`19e8a6fbefea5a385e9502409908bfbebbecf526`，锁文件原样保留。
- **pnpm 锁文件**：`pnpm-lock.yaml` 未做任何修改。
- **启动顺序**：**先数据库 → 再后端 → 后店面**。
  店面启动时会请求后端取区域和商品，后端没起来会报错。
- **区域/库存/配送初始化**：先跑 `initial-data-seed.ts`，再跑 `shangpin-seed.ts`，
  顺序不能颠倒（第二个脚本依赖第一个建立的位置、渠道和配送模板）。
- **手工支付限制**：本实验不接真实支付，订单创建成功即为验收标准，管理端可见即可。
- **自主模块的迁移与回滚**：
  - 迁移：`pnpm exec medusa db:migrate`（会为 `shoucang_item` 建表）
  - 回滚：如果只想移除收藏功能，删除 `medusa-config.ts` 里的模块注册即可，
    表数据不受影响；若要连表一起删，用 `pnpm exec medusa db:drop` 后重新迁移。
- **Windows 脚本**：上游测试脚本含类 Unix 环境变量写法，见 8.1 节的 PowerShell 替代方案。

## 十五、已知问题与后续改进方向

**已知问题**：

1. 收藏接口的并发幂等靠应用层实现，未加数据库唯一索引（见 8.3）。
2. 未编写自动化 UI 测试，端到端验证为手工执行。
3. 商品搜索依赖上游模板，本实验以 API 层验证为主。

**后续改进方向**：

1. 给 `shoucang_item` 加 `(kehu_id, shangpin_id)` 唯一索引，把幂等下沉到数据库。
2. 引入 Playwright 编写端到端自动化测试，纳入 CI。
3. 收藏夹分页；当收藏量很大时当前实现会一次返回全部。
4. 做「收藏商品降价提醒」——把收藏与价格变化关联起来，这需要监听商品更新事件。
5. 把三个进程容器化，用 `docker compose up` 一条命令启动全栈。
