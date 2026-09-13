"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders, getCacheTag } from "./cookies"
import { revalidateTag } from "next/cache"

/**
 * 收藏夹前端数据层。
 *
 * 说明：这里调用的是我们在后端新增的 /store/shoucang 系列接口，
 * 不是 Medusa 上游 Store API。请求头复用客户登录态（_medusa_jwt）。
 */

export type ShoucangShangpin = {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  status: string
  is_active: boolean
  variants: Array<{
    id: string
    title: string | null
    inventory_quantity?: number
    manage_inventory?: boolean
    allow_backorder?: boolean
    calculated_price?: {
      calculated_amount: number
      currency_code: string
    }
  }>
}

export type ShoucangTiaoMu = {
  id: string
  shangpin_id: string
  beizhu: string | null
  shoucang_shijian: string
  deleted: boolean
  shangpin: ShoucangShangpin | null
}

/**
 * 从异常里取出后端返回的中文提示。
 *
 * 为什么不直接用 @lib/util/medusa-error：那个函数的返回类型是 never（一定抛异常），
 * 而收藏夹的失败状态需要「把错误信息交给组件渲染」，不是把异常继续往上抛。
 */
function quCuowuXinxi(error: unknown): string {
  const err = error as {
    response?: { data?: { message?: string } | string; status?: number }
    message?: string
  }

  const shuJu = err?.response?.data
  if (shuJu && typeof shuJu === "object" && shuJu.message) {
    return shuJu.message
  }
  if (typeof shuJu === "string" && shuJu) {
    return shuJu
  }
  if (err?.response?.status === 401) {
    return "登录状态已过期，请重新登录。"
  }
  return err?.message || "操作失败，请稍后重试。"
}

/** 查询当前登录客户的收藏夹 */
export const retrieveShoucang = async (): Promise<ShoucangTiaoMu[]> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) return []

  return await sdk.client
    .fetch<{ shoucang: ShoucangTiaoMu[]; zongshu: number }>(`/store/shoucang`, {
      method: "GET",
      headers: authHeaders,
      cache: "no-store",
    })
    .then(({ shoucang }) => shoucang ?? [])
    .catch(() => [])
}

/**
 * 收藏一个商品。
 *
 * 返回值里的 yiyoucunzai 用来区分「新收藏」和「本来就在收藏夹里」，
 * 前端据此给出不同提示，而不是一律弹「收藏成功」。
 */
export const addShoucang = async (
  shangpinId: string,
  beizhu?: string
): Promise<{ success: boolean; yiyoucunzai: boolean; error: string | null }> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) {
    return {
      success: false,
      yiyoucunzai: false,
      error: "请先登录后再收藏商品。",
    }
  }

  try {
    const jieGuo = await sdk.client.fetch<{
      shoucang: unknown
      yiyoucunzai: boolean
    }>(`/store/shoucang`, {
      method: "POST",
      headers: authHeaders,
      body: { shangpin_id: shangpinId, beizhu },
    })

    const cacheTag = await getCacheTag("shoucang")
    if (cacheTag) revalidateTag(cacheTag)

    return {
      success: true,
      yiyoucunzai: jieGuo.yiyoucunzai ?? false,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      yiyoucunzai: false,
      error: quCuowuXinxi(error),
    }
  }
}

/** 取消收藏 */
export const removeShoucang = async (
  shoucangId: string
): Promise<{ success: boolean; error: string | null }> => {
  const authHeaders = await getAuthHeaders()

  if (!authHeaders) {
    return { success: false, error: "请先登录后再操作收藏夹。" }
  }

  try {
    await sdk.client.fetch(`/store/shoucang/${shoucangId}`, {
      method: "DELETE",
      headers: authHeaders,
    })

    const cacheTag = await getCacheTag("shoucang")
    if (cacheTag) revalidateTag(cacheTag)

    return { success: true, error: null }
  } catch (error) {
    return { success: false, error: quCuowuXinxi(error) }
  }
}

/** 判断某个商品是否已被当前客户收藏 */
export const isShoucang = async (shangpinId: string): Promise<boolean> => {
  const lieBiao = await retrieveShoucang()
  return lieBiao.some((t) => t.shangpin_id === shangpinId)
}
