"use client"

import { removeShoucang, type ShoucangTiaoMu } from "@lib/data/shoucang"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"
import { Button } from "@modules/common/components/ui"
import { useState } from "react"

type ShoucangListProps = {
  chushiLieBiao: ShoucangTiaoMu[]
}

/**
 * 收藏夹列表（客户端组件）。
 *
 * 三种商品状态分别渲染：
 *  1. 正常在售：缩略图可点击进入详情，可取消收藏
 *  2. 已下架：灰显 + 标签，不可进入加购，但仍可移除
 *  3. 已删除：只有一条提示，可移除
 *
 * 取消收藏采用「先请求、成功后再移除」的顺序，而不是乐观更新。
 * 原因：如果请求失败却先把条目从界面删掉，用户会以为操作成功，
 * 刷新后又出现，体验更差。
 */
export default function ShoucangList({ chushiLieBiao }: ShoucangListProps) {
  const [lieBiao, setLieBiao] = useState(chushiLieBiao)
  const [chuliZhongId, setChuliZhongId] = useState<string | null>(null)
  const [cuowu, setCuowu] = useState<string | null>(null)

  const quxiaoshoucang = async (shoucangId: string) => {
    setChuliZhongId(shoucangId)
    setCuowu(null)

    const jieGuo = await removeShoucang(shoucangId)

    if (jieGuo.success) {
      setLieBiao((prev) => prev.filter((t) => t.id !== shoucangId))
    } else {
      setCuowu(jieGuo.error)
    }

    setChuliZhongId(null)
  }

  return (
    <div className="flex flex-col gap-y-6">
      {cuowu && (
        <p className="text-rose-500 text-small-regular" data-testid="shoucang-error">
          {cuowu}
        </p>
      )}

      <ul className="grid grid-cols-1 small:grid-cols-3 gap-6" data-testid="shoucang-list">
        {lieBiao.map((tiaoMu) => {
          const shangpin = tiaoMu.shangpin

          return (
            <li
              key={tiaoMu.id}
              className={`border border-ui-border-base rounded-rounded p-4 flex flex-col gap-y-3 ${
                shangpin && !shangpin.is_active ? "opacity-60" : ""
              }`}
              data-testid="shoucang-item"
            >
              {/* 已删除商品 */}
              {tiaoMu.deleted || !shangpin ? (
                <div
                  className="flex items-center justify-center h-40 bg-ui-bg-subtle rounded-rounded text-ui-fg-muted text-small-regular"
                  data-testid="shoucang-deleted"
                >
                  该商品已下架或被删除
                </div>
              ) : (
                <LocalizedClientLink
                  href={`/products/${shangpin.handle}`}
                  data-testid="shoucang-item-link"
                >
                  <Thumbnail thumbnail={shangpin.thumbnail} size="full" />
                </LocalizedClientLink>
              )}

              <div className="flex flex-col gap-y-1">
                <span className="text-ui-fg-base txt-compact-medium">
                  {shangpin ? shangpin.title : "已删除的商品"}
                </span>

                {/* 规则：已下架标签 */}
                {shangpin && !shangpin.is_active && (
                  <span
                    className="text-small-regular text-ui-fg-muted"
                    data-testid="shoucang-inactive-tag"
                  >
                    已下架 · 暂时无法购买
                  </span>
                )}

                {/* 备注（客户自己写的那句话） */}
                {tiaoMu.beizhu && (
                  <span className="text-small-regular text-ui-fg-subtle">
                    备注：{tiaoMu.beizhu}
                  </span>
                )}
              </div>

              <Button
                variant="secondary"
                onClick={() => quxiaoshoucang(tiaoMu.id)}
                disabled={chuliZhongId === tiaoMu.id}
                isLoading={chuliZhongId === tiaoMu.id}
                data-testid="shoucang-remove-button"
              >
                取消收藏
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
