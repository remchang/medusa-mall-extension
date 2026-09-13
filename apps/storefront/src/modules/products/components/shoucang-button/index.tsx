"use client"

import { addShoucang, removeShoucang } from "@lib/data/shoucang"
import { Button } from "@modules/common/components/ui"
import { useParams } from "next/navigation"
import { useState } from "react"

type ShoucangButtonProps = {
  shangpinId: string
  /** 服务端传入的初始收藏状态，避免按钮首屏闪烁 */
  chushiYishoucang: boolean
  /** 已收藏时对应的收藏记录 ID，取消收藏要用 */
  shoucangId: string | null
  /** 未登录时点击的处理方式 */
  yidenglu: boolean
}

/**
 * 商品详情页的收藏按钮。
 *
 * 交互规则：
 *  1. 未登录点击 → 不调接口，直接提示「请先登录」，避免无意义的 401 请求。
 *  2. 请求进行中禁用按钮，防止重复点击产生并发请求。
 *  3. 收藏和取消收藏分别显示不同的文案与失败提示。
 *  4. 失败时不改变按钮状态，保证界面和后端状态一致。
 */
export default function ShoucangButton({
  shangpinId,
  chushiYishoucang,
  shoucangId,
  yidenglu,
}: ShoucangButtonProps) {
  const countryCode = useParams().countryCode as string

  const [yishoucang, setYishoucang] = useState(chushiYishoucang)
  const [jiluId, setJiluId] = useState(shoucangId)
  const [jiazaiZhong, setJiazaiZhong] = useState(false)
  const [tishi, setTishi] = useState<string | null>(null)

  const chuliDianji = async () => {
    // 规则 1：未登录先引导登录
    if (!yidenglu) {
      setTishi("请先登录后再收藏商品。")
      return
    }

    setJiazaiZhong(true)
    setTishi(null)

    if (yishoucang) {
      // 取消收藏
      if (!jiluId) {
        // 状态异常时兜底：本地以为已收藏但没有记录 ID
        setTishi("收藏状态异常，请刷新页面后重试。")
        setJiazaiZhong(false)
        return
      }

      const jieGuo = await removeShoucang(jiluId)

      if (jieGuo.success) {
        setYishoucang(false)
        setJiluId(null)
        setTishi("已取消收藏。")
      } else {
        // 规则 4：失败不改状态
        setTishi(jieGuo.error)
      }
    } else {
      // 添加收藏
      const jieGuo = await addShoucang(shangpinId)

      if (jieGuo.success) {
        setYishoucang(true)
        setTishi(jieGuo.yiyoucunzai ? "该商品已在收藏夹中。" : "收藏成功。")
      } else {
        setTishi(jieGuo.error)
      }
    }

    setJiazaiZhong(false)
  }

  return (
    <div className="flex flex-col gap-y-2">
      <Button
        onClick={chuliDianji}
        disabled={jiazaiZhong}
        variant={yishoucang ? "secondary" : "primary"}
        className="w-full h-10"
        isLoading={jiazaiZhong}
        data-testid="shoucang-button"
      >
        {yishoucang ? "已收藏 ♥" : "加入收藏 ♡"}
      </Button>

      {tishi && (
        <p
          className={`text-small-regular ${
            tishi.includes("成功") || tishi.includes("已收藏")
              ? "text-ui-tag-green-text"
              : "text-rose-500"
          }`}
          data-testid="shoucang-tishi"
        >
          {tishi}
        </p>
      )}
    </div>
  )
}
