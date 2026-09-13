#!/usr/bin/env bash
# 一键启动脚本（Git Bash / Linux / macOS）
#
# 用途：分别开两个进程启动后端和店面。
# 使用：在仓库根目录执行  bash ./scripts/start-all.sh
#
# 注意：本脚本不负责启动 PostgreSQL 与跑迁移/种子，步骤见 README 第 6 节。

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "仓库根目录: ${ROOT}"

if [ ! -f "${ROOT}/apps/backend/.env" ]; then
  echo "缺少 apps/backend/.env，请先按 README 6.4 节创建。" >&2
  exit 1
fi

if [ ! -f "${ROOT}/apps/storefront/.env.local" ]; then
  echo "缺少 apps/storefront/.env.local，请先按 README 6.7 节创建。" >&2
  exit 1
fi

echo "启动后端 (端口 9000)..."
( cd "${ROOT}/apps/backend" && pnpm run dev ) &
BACKEND_PID=$!

echo "等待后端就绪..."
for i in $(seq 1 60); do
  sleep 2
  if curl -fsS http://localhost:9000/health >/dev/null 2>&1; then
    echo "后端已就绪。"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "后端 120 秒内未就绪，请检查输出。" >&2
  fi
done

echo "启动店面 (端口 8000)..."
( cd "${ROOT}/apps/storefront" && pnpm run dev ) &
FRONTEND_PID=$!

echo ""
echo "完成。访问地址："
echo "  店面     http://localhost:8000/dk/store"
echo "  管理端   http://localhost:9000/app"
echo "  健康检查 http://localhost:9000/health"
echo ""
echo "后端 PID: ${BACKEND_PID}  店面 PID: ${FRONTEND_PID}"
echo "按 Ctrl+C 停止两个进程。"

trap "kill ${BACKEND_PID} ${FRONTEND_PID} 2>/dev/null || true" INT TERM
wait
