import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SHOUCANG_MODULE } from "../../../../modules/shoucang"
import type ShoucangModuleService from "../../../../modules/shoucang/service"

/**
 * DELETE /store/shoucang/:id —— 取消收藏
 *
 * 业务规则：
 *  1. 必须登录，匿名 401。
 *  2. 只能删自己的收藏。这是最容易出安全问题的地方——如果只按收藏记录 ID 删除，
 *     攻击者拿到别人的 ID 就能删掉别人的收藏。所以这里额外比对 kehu_id。
 *  3. 删除不存在的记录返回 404，而不是静默成功。
 *     为什么不静默成功：前端重复点击「取消收藏」时会拿到明确的 404，
 *     用户能知道「这条已经不在收藏夹了」，而不是以为操作生效了。
 */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const kehuId = req.auth_context?.actor_id
  const shoucangService: ShoucangModuleService =
    req.scope.resolve(SHOUCANG_MODULE)

  if (!kehuId) {
    return res.status(401).json({
      type: "not_allowed",
      message: "请先登录后再操作收藏夹。",
    })
  }

  const shoucangId = req.params.id

  const [jiLu] = await shoucangService.listShoucangItems({
    id: shoucangId,
  })

  if (!jiLu) {
    return res.status(404).json({
      type: "not_found",
      message: "该收藏记录不存在。",
    })
  }

  // 规则 2：越权校验
  if (jiLu.kehu_id !== kehuId) {
    return res.status(403).json({
      type: "forbidden",
      message: "无权操作他人的收藏记录。",
    })
  }

  await shoucangService.deleteShoucangItems(shoucangId)

  return res.json({
    id: shoucangId,
    deleted: true,
    message: "已取消收藏。",
  })
}
