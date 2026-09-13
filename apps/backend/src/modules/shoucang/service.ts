import { MedusaService } from "@medusajs/framework/utils"
import ShoucangItem from "./models/shoucang-item"

/**
 * 收藏夹模块服务层。
 *
 * Medusa 的 MedusaService 会基于数据模型自动生成一套 CRUD 方法，
 * 例如 listShoucangItems / createShoucangItems / deleteShoucangItems。
 * 这里只补充模块自身需要的业务方法，业务规则不写在 API 路由里，
 * 这样可以保证「无论从哪个入口调用，规则一致」。
 */
class ShoucangModuleService extends MedusaService({
  ShoucangItem,
}) {
  /**
   * 查询某个客户是否已经收藏了某个商品。
   *
   * 为什么需要这个方法：API 层要做「重复收藏」的幂等判断，
   * 如果把判断逻辑直接写在路由里，将来加一个「批量收藏」接口就要复制一遍。
   */
  async chaxun_shifou_yishoucang(kehuId: string, shangpinId: string) {
    const [jiLu] = await this.listShoucangItems({
      kehu_id: kehuId,
      shangpin_id: shangpinId,
    })

    return jiLu ?? null
  }
}

export default ShoucangModuleService
