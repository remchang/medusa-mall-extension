import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * 二次开发新增：演示商品与库存边界种子脚本。
 *
 * 为什么单独写一个脚本而不改上游的 initial-data-seed.ts：
 *  上游脚本是「基线」，改动它会让「个人实现范围」和「上游已有内容」混在一起，
 *  不利于答辩时说明自己做了什么。这个脚本只做增量：
 *   1. 补 6 个商品，使总数达到 10 个（含多变体、长标题）；
 *   2. 把库存从「统一 100 万」改成有边界的值，覆盖零库存和仅剩 1 件。
 *
 * 幂等性：本脚本可重复执行。
 *  - 商品按 handle 判重，已存在则跳过创建；
 *  - 库存用 update 而不是 create，重复执行结果一致。
 *
 * 执行方式（在 apps/backend 目录）：
 *   pnpm exec medusa exec ./src/migration-scripts/shangpin-seed.ts
 */
export default async function shangpin_seed({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // ---------- 1. 读取基线已有的上下文 ----------

  const { data: shangpinYiYou } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
  })

  const yiYouHandles = new Set(shangpinYiYou.map((p: any) => p.handle))
  logger.info(`基线已有商品 ${yiYouHandles.size} 个。`)

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const defaultSalesChannel = salesChannels[0]

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  })
  const categoryByName = (name: string) =>
    categories.find((c: any) => c.name === name)

  const { data: options } = await query.graph({
    entity: "product_option",
    fields: ["id", "title"],
  })
  const sizeOption = options.find((o: any) => o.title === "Size")
  const colorOption = options.find((o: any) => o.title === "Color")

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const shippingProfile = shippingProfiles[0]

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = stockLocations[0]

  if (!defaultSalesChannel || !shippingProfile || !stockLocation) {
    logger.error(
      "缺少销售渠道 / 配送模板 / 库存地点，请先执行上游的 initial-data-seed.ts。"
    )
    return
  }

  // ---------- 2. 补充商品到 10 个 ----------

  /**
   * 为什么这几个商品要这样设计：
   *  - 「限量版」只有一个变体 → 覆盖「单一变体」路径
   *  - 「联名款」有 Size + Color 双维度 → 覆盖「多变体组合」路径
   *  - 长标题商品 → 覆盖前端换行和卡片高度
   *  - 价格跨度从 8 到 120 → 覆盖不同价位的价格格式化
   */
  const xinShangpin = [
    {
      title: "Medusa Hoodie",
      handle: "hoodie",
      description: "连帽卫衣，适合实验室空调房。",
      category: "Sweatshirts",
      options: [{ id: sizeOption.id }],
      variants: ["S", "M", "L"].map((s) => ({
        title: s,
        sku: `HOODIE-${s}`,
        options: { Size: s },
        prices: [
          { amount: 35, currency_code: "eur" },
          { amount: 40, currency_code: "usd" },
        ],
      })),
    },
    {
      title: "Medusa Cap",
      handle: "cap",
      description: "棒球帽，遮阳用。",
      category: "Merch",
      options: [{ id: sizeOption.id }],
      variants: ["S", "M"].map((s) => ({
        title: s,
        sku: `CAP-${s}`,
        options: { Size: s },
        prices: [
          { amount: 18, currency_code: "eur" },
          { amount: 22, currency_code: "usd" },
        ],
      })),
    },
    {
      // 限量单品：只有一个变体，走「单一变体自动选中」路径
      title: "Medusa Limited Edition Jacket",
      handle: "limited-jacket",
      description: "限量版夹克，单一批次，售完不补。",
      category: "Sweatshirts",
      options: [{ id: sizeOption.id }],
      variants: [
        {
          title: "M",
          sku: "LIMITED-JACKET-M",
          options: { Size: "M" },
          prices: [
            { amount: 120, currency_code: "eur" },
            { amount: 140, currency_code: "usd" },
          ],
        },
      ],
    },
    {
      // 联名款：Size + Color 双维度，变体组合最多
      title: "Medusa Collaboration Sneakers",
      handle: "collab-sneakers",
      description: "联名款运动鞋，尺码与配色自由组合。",
      category: "Merch",
      options: [{ id: sizeOption.id }, { id: colorOption.id }],
      variants: [
        ...["S", "M", "L"].flatMap((s) =>
          ["Black", "White"].map((c) => ({
            title: `${s} / ${c}`,
            sku: `COLLAB-${s}-${c}`,
            options: { Size: s, Color: c },
            prices: [
              { amount: 88, currency_code: "eur" },
              { amount: 99, currency_code: "usd" },
            ],
          }))
        ),
      ],
    },
    {
      title: "Medusa Socks",
      handle: "socks",
      description: "中筒袜，三双装。",
      category: "Merch",
      options: [{ id: sizeOption.id }],
      variants: ["S", "M"].map((s) => ({
        title: s,
        sku: `SOCKS-${s}`,
        options: { Size: s },
        prices: [
          { amount: 8, currency_code: "eur" },
          { amount: 10, currency_code: "usd" },
        ],
      })),
    },
    {
      // 长标题：覆盖前端卡片换行
      title:
        "Medusa Premium Multi Pocket Water Resistant Outdoor Hiking Vest With Detachable Inner Lining",
      handle: "long-title-vest",
      description:
        "超长标题商品，用于测试商品卡片在标题溢出的情况下的排版表现，同时也是价格最高的商品之一。",
      category: "Merch",
      options: [{ id: sizeOption.id }],
      variants: ["M", "L"].map((s) => ({
        title: s,
        sku: `VEST-${s}`,
        options: { Size: s },
        prices: [
          { amount: 150, currency_code: "eur" },
          { amount: 170, currency_code: "usd" },
        ],
      })),
    },
  ].filter((p) => !yiYouHandles.has(p.handle))

  if (xinShangpin.length) {
    logger.info(`准备新增 ${xinShangpin.length} 个商品...`)

    await createProductsWorkflow(container).run({
      input: {
        products: xinShangpin.map((p) => ({
          title: p.title,
          handle: p.handle,
          description: p.description,
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          category_ids: categoryByName(p.category)
            ? [categoryByName(p.category)!.id]
            : [],
          options: p.options,
          variants: p.variants,
          sales_channels: [{ id: defaultSalesChannel.id }],
        })),
      },
    })

    logger.info("商品创建完成。")
  } else {
    logger.info("6 个增量商品均已存在，跳过创建。")
  }

  // ---------- 3. 设置库存边界 ----------

  /**
   * 库存边界设计（这是「业务边界测试」的直接素材）：
   *  - 零库存：Limited Jacket / Socks-S → 验证「加购被拒绝」
   *  - 仅剩 1 件：Collab Sneakers 全部变体 / Hoodie-S → 验证「买 2 件失败、买 1 件成功」
   *  - 充足库存：其余商品 500 件 → 保证主链路能顺畅跑通
   *  - 不管理库存：Cap → allow_backorder/isStock 的判断分支
   */

  // 先把所有库存项重置为充足，保证脚本可重复执行
  const { data: suoYouKuCun } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
  })

  const kuCunJiLu: Array<{ id: string; sku: string }> = suoYouKuCun.map(
    (item: any) => ({ id: item.id, sku: item.sku })
  )

  /** 根据 SKU 决定这个库存项应该有多少库存 */
  const juedingKuCun = (sku: string): number => {
    // 零库存
    if (sku === "LIMITED-JACKET-M") return 0
    if (sku === "SOCKS-S") return 0

    // 仅剩 1 件
    if (sku.startsWith("COLLAB-")) return 1
    if (sku === "HOODIE-S") return 1

    // 宽松库存（Cap 保持较大值，用于验证正常购买）
    if (sku.startsWith("CAP-")) return 500

    return 500
  }

  logger.info("设置库存边界...")

  // 已有的库存层级直接更新
  const { data: xianYouCengJi } = await query.graph({
    entity: "inventory_level",
    fields: ["id", "inventory_item_id", "location_id"],
  })

  const cengJiMap = new Map(
    xianYouCengJi.map((l: any) => [l.inventory_item_id, l])
  )

  const yaoGengxin: Array<{
    id: string
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }> = []

  const yaoChuangjian: Array<{
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }> = []

  for (const item of kuCunJiLu) {
    const shuliang = juedingKuCun(item.sku)
    const yiYouCeng = cengJiMap.get(item.id)

    if (yiYouCeng) {
      yaoGengxin.push({
        id: (yiYouCeng as any).id,
        inventory_item_id: item.id,
        location_id: stockLocation.id,
        stocked_quantity: shuliang,
      })
    } else {
      yaoChuangjian.push({
        inventory_item_id: item.id,
        location_id: stockLocation.id,
        stocked_quantity: shuliang,
      })
    }
  }

  if (yaoChuangjian.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: yaoChuangjian },
    })
  }

  if (yaoGengxin.length) {
    await updateInventoryLevelsWorkflow(container).run({
      input: { updates: yaoGengxin },
    })
  }

  logger.info("库存边界设置完成。")

  // ---------- 4. 输出核对信息 ----------

  const { data: jieGuo } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "variants.sku",
      "variants.inventory_quantity",
    ],
  })

  logger.info(`===== 种子结果核对：共 ${jieGuo.length} 个商品 =====`)
  for (const p of jieGuo as any[]) {
    const kuCunMiaoShu = (p.variants ?? [])
      .map((v: any) => `${v.sku}=${v.inventory_quantity}`)
      .join(", ")
    logger.info(`  ${p.handle.padEnd(18)} ${kuCunMiaoShu}`)
  }
  logger.info("===== 种子结束 =====")
}
