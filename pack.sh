#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Color definitions
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}       皮克西西图表排版 (piccc) 自动化打包脚本        ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check for target platform
TARGET=$1
if [ -z "$TARGET" ]; then
  echo -e "${YELLOW}提示: 未指定打包目标平台，默认将打包 macOS (dmg) 和 Windows (exe)。${NC}"
  echo -e "使用方法: ${GREEN}./pack.sh mac${NC} | ${GREEN}./pack.sh win${NC} | ${GREEN}./pack.sh all${NC}"
  TARGET="all"
fi

# Run production build
echo -e "\n${GREEN}[1] 正在编译前端与主进程资源...${NC}"
npm run build

if [ "$TARGET" = "mac" ] || [ "$TARGET" = "all" ]; then
  echo -e "\n${GREEN}[2] 正在打包 macOS (DMG) 安装包...${NC}"
  npx electron-builder --mac
  echo -e "${GREEN}✓ macOS DMG 打包完成!${NC}"
fi

if [ "$TARGET" = "win" ] || [ "$TARGET" = "all" ]; then
  echo -e "\n${GREEN}[3] 正在打包 Windows (EXE) 安装包 (x64)...${NC}"
  npx electron-builder --win --x64
  echo -e "${GREEN}✓ Windows EXE 打包完成!${NC}"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}  🎉 所有打包任务已成功完成！生成的安装文件位于 dist/ 目录。${NC}"
echo -e "${GREEN}====================================================${NC}"
