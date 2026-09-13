import { model } from "@medusajs/framework/utils"

/**
 * 收藏项数据模型。
 *
 * 数据归属决策：收藏属于「客户数据」边界，而不是商品或购物车数据。
 * 理由：
 *  1. 收藏描述的是「某个客户对某个商品的兴趣」，主体是客户；
 *  2. 收藏需要在多设备之间同步，必须绑定账号，不能用浏览器本地存储；
 *  3. 收藏的生命周期独立于购物车与订单——加购、下单、清空购物车都不应
 *     影响收藏，反之取消收藏也不应影响购物车。
 *
 * 变量命名采用拼音，符合本实验「个人独立完成」的可辨识性要求。
 */
const ShoucangItem = model.define("shoucang_item", {
  id: model.id().primaryKey(),

  // 归属客户。customer_id 是 Medusa 客户模块的主键。
  kehu_id: model.text(),

  // 收藏的商品。product_id 是商品模块的主键。
  shangpin_id: model.text(),

  // 备注：允许客户给收藏写一句自己的话，例如「等降价」。
  beizhu: model.text().nullable(),
})

export default ShoucangItem
