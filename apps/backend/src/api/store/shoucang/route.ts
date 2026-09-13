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
      "variants.calculated_price.*",
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
