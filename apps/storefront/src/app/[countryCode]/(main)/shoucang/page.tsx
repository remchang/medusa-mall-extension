import { retrieveCustomer } from "@lib/data/customer"
import { retrieveShoucang } from "@lib/data/shoucang"
import ShoucangList from "@modules/shoucang/components/shoucang-list"
import { Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata = {
  title: "我的收藏夹",
  description: "查看和管理我收藏的商品。",
}

/**
 * 收藏夹页面 /[countryCode]/shoucang
 *
 * 页面本身只做两件事：取数据、决定展示哪个分支。
 * 列表渲染和交互都放在客户端组件里，因为这个页面需要
 * 「取消收藏后立刻更新列表」的交互。
 */
export default async function ShoucangPage() {
  const kehu = await retrieveCustomer()

  // 分支一：未登录
  if (!kehu) {
    return (
      <div className="content-container py-16 flex flex-col items-center gap-y-4">
        <Heading level="h1" className="text-2xl text-ui-fg-base">
          我的收藏夹
        </Heading>
        <Text className="text-ui-fg-subtle">
          收藏需要绑定账号，这样换设备也能看到同样的收藏。
        </Text>
        <LocalizedClientLink
          href="/account"
          className="underline text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
          data-testid="shoucang-login-link"
        >
          去登录
        </LocalizedClientLink>
      </div>
    )
  }

  const shoucangLieBiao = await retrieveShoucang()

  // 分支二：已登录但没有收藏
  if (!shoucangLieBiao.length) {
    return (
      <div className="content-container py-16 flex flex-col items-center gap-y-4">
        <Heading level="h1" className="text-2xl text-ui-fg-base">
          我的收藏夹
        </Heading>
        <Text className="text-ui-fg-subtle" data-testid="shoucang-empty">
          还没有收藏任何商品。去商品页点「加入收藏」试试。
        </Text>
        <LocalizedClientLink
          href="/store"
          className="underline text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
        >
          去逛逛商品
        </LocalizedClientLink>
      </div>
    )
  }

  // 分支三：正常展示
  return (
    <div className="content-container py-12">
      <div className="flex flex-col gap-y-2 mb-8">
        <Heading level="h1" className="text-2xl text-ui-fg-base">
          我的收藏夹
        </Heading>
        <Text className="text-ui-fg-subtle" data-testid="shoucang-count">
          共 {shoucangLieBiao.length} 件收藏商品
        </Text>
      </div>

      <ShoucangList chushiLieBiao={shoucangLieBiao} />
    </div>
  )
}
