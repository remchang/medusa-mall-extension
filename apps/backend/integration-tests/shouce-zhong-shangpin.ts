import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * 集成测试的数据准备。
 *
 * 为什么需要它：
 *  集成测试跑在一个临时新建的空库上（名字类似
 *  medusa-<随机>-integration-1）。框架只会建表，不会自动灌数据。
 *  所以「收藏一个商品」这类需要商品存在的用例，必须先自己造数据。
 *
 * 为什么要跑完整链路（渠道 → 配送模板 → 商品）：
 *  直接往 product 表插一行会漏掉销售渠道、价格、配送模板这些关联表，
 *  之后 query.graph 取商品信息会拿到空值，用例断言「收藏里带商品信息」
 *  就会失败。走 createProductsWorkflow 造出来的商品和后台手工创建的完全一致。
 *
 * 幂等性：整个函数可以安全重复执行。
 *  - 配送模板 / 基线店铺数据只在缺失时才补；
 *  - 测试商品按 handle 判重，已存在就跳过。
 */
export const SHANGPIN_SKU = "SHOUCANG-TEST-01"

/** 默认配送模板 ID。Medusa 约定用这个固定 ID 表示「默认」。 */
const MO_REN_PEISONG_ID = "sp_ship"

export async function zhunbei_shangpin(container: any) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve("query")

  // ---------- 0. 补默认配送模板 ----------
  // 这一步是最容易被忽略的坑：基线种子脚本里有这么一行注释
  //   // This is created by a migration script in core.
  //   const { data: shippingProfileResult } = await query.graph({...})
  // 也就是说它「假设」核心迁移脚本已经把默认配送模板建好了。
  // 但集成测试的临时库只跑 migrator（建表），不跑核心的种子迁移，
  // 所以这个模板其实是空的——基线脚本读出来 shippingProfile = undefined，
  // 后面所有带 shipping_profile_id 的商品都会创建失败。
  // 手工补上这一个模板，基线脚本就能正常跑通。
  const { data: peisongYiYou } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })

  if (!peisongYiYou.length) {
    const fulfillment = container.resolve("fulfillment")
    await fulfillment.createShippingProfiles({
      id: MO_REN_PEISONG_ID,
      name: "Default Shipping Profile",
      type: "default",
    })
    logger.info("默认配送模板已补齐。")
  }

  // ---------- 1. 店铺基础数据（渠道 / 区域 / 库存地点） ----------
  // 只在真的没有渠道时才跑。基线脚本不是幂等的，
  // 重复执行会造出两份渠道/区域，区域重复会让后续价格计算报错。
  const { data: yiYouQudao } = await query.graph({
    entity: "sales_channel",
    fields: ["id"],
  })

  if (!yiYouQudao.length) {
    const jichuSeed = require("../src/migration-scripts/initial-data-seed")
    await (jichuSeed.default ?? jichuSeed)({ container })
    logger.info("基线店铺数据已灌入临时测试库。")
  } else {
    logger.info("临时测试库已有店铺数据，跳过基线种子。")
  }

  // ---------- 2. 取渠道与配送模板（商品必须挂在它们下面） ----------

  const { data: qudao } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  if (!qudao.length) {
    throw new Error("测试库缺少销售渠道，无法准备商品数据。")
  }

  const { data: peisong } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  if (!peisong.length) {
    throw new Error("测试库缺少配送模板，无法准备商品数据。")
  }

  // ---------- 3. 创建可收藏的商品 ----------
  // 按 handle 判重，避免重复执行时被「handle 已存在」顶掉。
  const { data: yiYouShangpin } = await query.graph({
    entity: "product",
    fields: ["id", "title"],
    filters: { handle: "shoucang-ceshi-shangpin" },
  })

  if (yiYouShangpin.length) {
    logger.info("收藏测试商品已存在，跳过创建。")
    return yiYouShangpin[0]
  }

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "收藏测试商品",
          handle: "shoucang-ceshi-shangpin",
          description: "仅用于收藏夹集成测试，不对应真实商品。",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: peisong[0].id,
          sales_channels: [{ id: qudao[0].id }],
          options: [{ title: "规格", values: ["默认"] }],
          variants: [
            {
              title: "默认",
              sku: SHANGPIN_SKU,
              options: { 规格: "默认" },
              prices: [{ amount: 1999, currency_code: "cny" }],
            },
          ],
        },
      ],
    },
  })

  logger.info("收藏测试商品已创建。")
  return result[0]
}
