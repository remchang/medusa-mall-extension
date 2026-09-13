# 第三方代码、数据、图片与许可证清单（NOTICE）

> 实验 02 · 开源在线商城系统二次开发

## 1. 上游开源项目

| 项目 | 用途 | 仓库地址 | 固定版本 | 许可证 |
|---|---|---|---|---|
| Medusa（medusajs/medusa） | 商品、库存、购物车、订单等电商核心模块 | https://github.com/medusajs/medusa | 2.20.1 | MIT（开源核心） |
| DTC Starter（medusajs/dtc-starter） | 后端 + Next.js 店面的配套骨架 | https://github.com/medusajs/dtc-starter | Commit `19e8a6fbefea5a385e9502409908bfbebbecf526` | MIT |

**基线固定说明**：

- 本实验以 DTC Starter 的这个 Commit 为唯一基线，`pnpm-lock.yaml` 原样保留，未混装其他模板或更新版本的核心。
- 根目录 `package.json` 指定 `pnpm@10.11.1`，实验环境按此版本执行 `pnpm install --frozen-lockfile`。
- 旧模板 `nextjs-starter-medusa` 已归档，本实验未使用。

## 2. 复用的情况说明

**代码复用**：本实验的所有二次开发代码均为本人新写，没有从其他同学或网络上复制业务代码。
对上游代码的改动仅限于「注册模块」和「在页面中插入组件」两处，均已在 README 中说明。

**图片资源**：演示商品图片使用上游 DTC Starter 种子脚本中引用的 Medusa 官方示例图片
（`medusa-public-images.s3.eu-west-1.amazonaws.com`）。这些图片只用于本地演示，
不对外发布，来源与上游种子脚本一致（上游为 MIT 许可项目的一部分）。

**没有使用的资源**：
- 未使用 Medusa 企业版（Medusa Cloud / 企业材料）的任何代码或数据。
- 未接入任何真实支付渠道，未配置支付密钥、邮件账号或云缓存服务。
- 未使用需付费的商业图库、字体或模型。

## 3. 本仓库的许可证

- 本仓库为 DTC Starter 的衍生作品，沿用上游的 **MIT** 许可证，`LICENSE` 文件保持上游内容不变。
- MIT 与上游兼容，可以自由修改与再分发。
- 说明：本仓库仅用于课程实验的本地演示，未部署到公网。
  如果将来公开部署，需继续保留 MIT 许可证与版权声明（MIT 不属于 AGPL 类网络部署义务条款，
  但仍需保留许可证和版权信息）。

## 4. 新增的依赖

本实验**没有新增任何第三方 npm 依赖**。

- 后端自定义模块只使用 Medusa 框架自带的 `Module`、`MedusaService`、`model` 等 API。
- 前端只使用上游已有的组件和 Next.js 自带能力。
- 因此不需要更新 `pnpm-lock.yaml`，也避免了依赖版本漂移。

## 5. 图片、数据、模型的来源记录

| 类型 | 来源 | 作者/机构 | 链接 | 许可证 |
|---|---|---|---|---|
| 商品演示图片 | DTC Starter 种子脚本引用 | Medusa | https://medusa-public-images.s3.eu-west-1.amazonaws.com | MIT 项目资源 |
| 商品文字描述 | 本人编写（除 4 个基线商品沿用上游描述） | — | 本仓库 | MIT |
| 演示商品数据 | 本人设计（价格、库存、分类为虚构） | — | 本仓库 | MIT |

## 6. 安全与敏感信息说明

- 仓库中**不包含**任何真实密码、Token、数据库口令。
- `.env` 文件已加入 `.gitignore`，仓库只提交 `.env.template`。
- 实验用的数据库账号密码在本机环境中配置，未提交到仓库。
- 客户登录 JWT 由 Medusa 运行时签发，不落盘。
