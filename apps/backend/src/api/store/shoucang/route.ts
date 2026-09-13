import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SHOUCANG_MODULE } from "../../../modules/shoucang"
import type ShoucangModuleService from "../../../modules/shoucang/service"

/**
 * GET /store/shoucang —— 查询当前登录客户的收藏夹
 *
 * 返回的每条收藏都会附带商品的最新状态，这样前端能区分：
 *  - 商品仍在售  → 正常展示，可点击进详情
 *  - 商品已下架  → 灰显 + 「已下架」标签，不可加购
 *  - 商品已删除  → deleted = true，前端提示并允许移除
 *
 * 为什么要在查询时联商品表，而不是只存一份商品快照：
 *  商品价格、标题、上下架状态是「商品数据」，收藏表只该存「谁收藏了什么」。
 *  存快照会导致商品改价后收藏页显示旧价，产生不一致。
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const kehuId = req.auth_context?.actor_id
  const shoucangService: ShoucangModuleService =
    req.scope.resolve(SHOUCANG_MODULE)

  if (!kehuId) {
    return res.status(401).json({
      type: "not_allowed",
      message: "请先登录后查看收藏夹。",
    })
  }

  const shoucangList = await shoucangService.listShoucangItems(
    { kehu_id: kehuId },
    { order: { created_at: "DESC" } }
  )

  if (!shoucangList.length) {
    return res.json({ shoucang: [], zongshu: 0 })
  }

  // 一次性把所有涉及的商品查出来，避免在循环里查库（N+1 问题）
  const shangpinIds = [...new Set(shoucangList.map((s) => s.shangpin_id))]

  // 注意不要在这里取 variants.calculated_price：
  // 价格计算依赖「区域 / 货币」上下文，收藏夹接口是纯商品信息查询，
  // 没有区域上下文时框架会直接抛
  //   invalid_data: Method calculatePrices requires currency_code in the pricing context
  // 收藏页展示的是「我收藏了什么」，价格由商品详情页自己按区域算，
  // 所以这里只取商品本身的基础字段。
  const query = req.scope.resolve("query")
  const { data: shangpinList } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "status",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.inventory_quantity",
      "variants.manage_inventory",
      "variants.allow_backorder",
    ],
    filters: { id: shangpinIds },
  })

  const shangpinMap = new Map(shangpinList.map((p: any) => [p.id, p]))

  const jieGuo = shoucangList.map((jiLu) => {
    const shangpin: any = shangpinMap.get(jiLu.shangpin_id)

    return {
      id: jiLu.id,
      shangpin_id: jiLu.shangpin_id,
      beizhu: jiLu.beizhu,
      shoucang_shijian: jiLu.created_at,
      // 商品被物理删除时 shangpin 为空
      deleted: !shangpin,
      shangpin: shangpin
        ? {
            id: shangpin.id,
            title: shangpin.title,
            handle: shangpin.handle,
            thumbnail: shangpin.thumbnail,
            status: shangpin.status,
            // 已下架商品仍返回，由前端灰显，而不是从收藏夹里静默消失
            is_active: shangpin.status === "published",
            variants: shangpin.variants ?? [],
          }
        : null,
    }
  })

  return res.json({
    shoucang: jieGuo,
    zongshu: jieGuo.length,
  })
}

/**
 * POST /store/shoucang —— 收藏一个商品
 *
 * 业务规则：
 *  1. 必须登录，匿名 401。
 *  2. shangpin_id 必填，且必须是真实存在的商品，否则 400。
 *     为什么要校验商品存在：不校验的话收藏表会堆进一堆无效 ID，
 *     前端渲染收藏夹时全部是「商品已删除」，体验很差，而且脏数据没法清理。
 *  3. 幂等：同一个客户重复收藏同一个商品不新增第二条记录，返回 200。
 *     为什么不做成 409 报错：前端的「收藏」按钮是切换式的，用户快速点两下
 *     就会发出两次请求，报错会让按钮状态和服务端状态不一致。
 *     返回「已存在」而不是报错，前端按 yiyoucunzai 决定提示文案即可。
 *
 * 返回约定：
 *  - 首次收藏成功 → 201，yiyoucunzai = false
 *  - 重复收藏     → 200，yiyoucunzai = true
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const kehuId = req.auth_context?.actor_id
  const shoucangService: ShoucangModuleService =
    req.scope.resolve(SHOUCANG_MODULE)

  if (!kehuId) {
    return res.status(401).json({
      type: "not_allowed",
      message: "请先登录后再收藏。",
    })
  }

  const body = (req.body ?? {}) as {
    shangpin_id?: string
    beizhu?: string
  }
  const shangpinId = body.shangpin_id

  // 规则 2：参数校验
  if (!shangpinId || typeof shangpinId !== "string") {
    return res.status(400).json({
      type: "invalid_data",
      message: "缺少参数 shangpin_id。",
    })
  }

  const query = req.scope.resolve("query")
  const { data: shangpinList } = await query.graph({
    entity: "product",
    fields: ["id"],
    filters: { id: [shangpinId] },
  })

  if (!shangpinList.length) {
    return res.status(400).json({
      type: "invalid_data",
      message: "要收藏的商品不存在。",
    })
  }

  // 规则 3：幂等判断
  const yiYou = await shoucangService.chaxun_shifou_yishoucang(
    kehuId,
    shangpinId
  )

  if (yiYou) {
    return res.status(200).json({
      yiyoucunzai: true,
      shoucang: {
        id: yiYou.id,
        shangpin_id: yiYou.shangpin_id,
        beizhu: yiYou.beizhu,
        shoucang_shijian: yiYou.created_at,
      },
      message: "该商品已在收藏夹中。",
    })
  }

  const xinJiLu = await shoucangService.createShoucangItems({
    kehu_id: kehuId,
    shangpin_id: shangpinId,
    beizhu: body.beizhu ?? null,
  })

  return res.status(201).json({
    yiyoucunzai: false,
    shoucang: {
      id: xinJiLu.id,
      shangpin_id: xinJiLu.shangpin_id,
      beizhu: xinJiLu.beizhu,
      shoucang_shijian: xinJiLu.created_at,
    },
    message: "收藏成功。",
  })
}
