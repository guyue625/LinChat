#!/usr/bin/env bash
set -Eeuo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   NextChat 一键更新脚本 (docker compose)${NC}"
echo -e "${GREEN}========================================${NC}"

cd "$(dirname "$0")"

SERVICE="${SERVICE:-nextchat}"
PULL_RETRIES="${PULL_RETRIES:-3}"
PULL_RETRY_DELAY="${PULL_RETRY_DELAY:-10}"

if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.yaml" ]; then
    echo -e "${RED}错误：当前目录下没有找到 docker-compose.yml 或 docker-compose.yaml${NC}"
    exit 1
fi

restore_cached_service() {
    if docker compose ps --status running --services | grep -Fxq "$SERVICE"; then
        return 0
    fi

    echo -e "${YELLOW}正在尝试使用本地缓存镜像恢复服务...${NC}"
    if docker compose up -d --no-deps --pull never "$SERVICE"; then
        echo -e "${GREEN}已使用本地缓存镜像恢复服务。${NC}"
    else
        echo -e "${RED}本地缓存镜像恢复失败，请检查 docker images 和容器日志。${NC}"
    fi
}

echo -e "\n${YELLOW}[1/4] 检查当前容器状态...${NC}"
docker compose ps "$SERVICE"

echo -e "\n${YELLOW}[2/4] 拉取最新镜像...${NC}"
pull_succeeded=false
for ((attempt = 1; attempt <= PULL_RETRIES; attempt++)); do
    if docker compose pull "$SERVICE"; then
        pull_succeeded=true
        break
    fi

    if ((attempt < PULL_RETRIES)); then
        echo -e "${YELLOW}第 ${attempt} 次拉取失败，${PULL_RETRY_DELAY} 秒后重试...${NC}"
        sleep "$PULL_RETRY_DELAY"
    fi
done

if [ "$pull_succeeded" != "true" ]; then
    echo -e "${RED}连续 ${PULL_RETRIES} 次拉取镜像失败，保留当前版本。${NC}"
    restore_cached_service
    exit 1
fi

echo -e "\n${YELLOW}[3/4] 更新容器...${NC}"
if ! docker compose up -d --no-deps "$SERVICE"; then
    echo -e "${RED}新容器启动失败。${NC}"
    restore_cached_service
    exit 1
fi

echo -e "\n${YELLOW}[4/4] 清理悬空镜像...${NC}"
docker image prune -f

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  更新完成！${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n当前容器状态："
docker compose ps "$SERVICE"

echo -e "\n当前使用的镜像："
docker images ghcr.io/guyue625/nextchat

echo -e "\n最近日志："
docker compose logs --tail 30 "$SERVICE"
