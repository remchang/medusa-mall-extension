import { Module } from "@medusajs/framework/utils"
import ShoucangModuleService from "./service"

/**
 * 收藏夹自定义模块。
 *
 * 为什么要做成 module 而不是直接写 SQL：Medusa 的约定是
 * 「业务数据归属某个 Module，Module 对外暴露 Service，其他代码只通过 Service 访问数据」。
 * 写成模块之后，迁移文件由框架统一管理，将来升级 Medusa 核心也不会被冲掉。
 *
 * 注意：本模块只使用开源核心提供的 Module 机制，不修改 node_modules。
 */
export const SHOUCANG_MODULE = "shoucang"

export default Module(SHOUCANG_MODULE, {
  service: ShoucangModuleService,
})
