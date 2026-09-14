#!/usr/bin/env bash
# ==============================================================================
# run.sh - Local Multi-Repository Joint Integration Test Runner
# 
# Repositories Involved:
# 1. web3-chat          (/ssd0/git/web3-chat)          - Mobile App Client & Local-First Engine
# 2. web3-chat-worker   (/ssd0/git/web3-chat-worker)   - Cloudflare Worker Node & Transit Relay
# 3. web3-chat-contract (/ssd0/git/web3-chat-contract) - On-Chain Social Protocol & SDK
# 4. LuckyDrop          (/ssd0/git/LuckyDrop)          - Red Packet Smart Contract & SDK
# 5. evm-call           (/ssd0/git/evm-call)           - Unified EVM RPC Pool & Multicall Gateway
# 6. EVM-Data-SDK       (/ssd0/git/EVM-Data-SDK)       - Indexed EVM Data SDK & Provider Routing
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_GREEN="\033[1;32m"
C_BLUE="\033[1;34m"
C_YELLOW="\033[1;33m"
C_CYAN="\033[1;36m"
C_RED="\033[1;31m"

echo -e "${C_CYAN}${C_BOLD}"
echo "================================================================================"
echo "    🚀 Starting Local Multi-Repository Full Stack Joint Integration Test       "
echo "================================================================================"
echo -e "${C_RESET}"

# 1. Clean up any leftover Anvil process on port 8548
echo -e "${C_YELLOW}[1/5] Checking & Cleaning hanging ports (8548)...${C_RESET}"
fuser -k 8548/tcp 2>/dev/null || true
sleep 1

# 2. Verify and build sub-repositories if needed
echo -e "${C_YELLOW}[2/5] Verifying sub-repository compilation artifacts...${C_RESET}"

if [ ! -d "/ssd0/git/web3-chat-contract/out" ] && [ ! -d "/ssd0/git/web3-chat-contract/artifacts" ]; then
  echo -e "${C_BLUE}--> Compiling web3-chat-contract...${C_RESET}"
  pnpm --dir /ssd0/git/web3-chat-contract run build
fi

if [ ! -d "/ssd0/git/LuckyDrop/contracts/artifacts" ]; then
  echo -e "${C_BLUE}--> Compiling LuckyDrop contracts...${C_RESET}"
  pnpm --dir /ssd0/git/LuckyDrop/contracts run compile
fi

if [ ! -d "/ssd0/git/evm-call/dist" ]; then
  echo -e "${C_BLUE}--> Building evm-call...${C_RESET}"
  pnpm --dir /ssd0/git/evm-call run build
fi

if [ ! -d "/ssd0/git/EVM-Data-SDK/dist" ]; then
  echo -e "${C_BLUE}--> Building EVM-Data-SDK...${C_RESET}"
  pnpm --dir /ssd0/git/EVM-Data-SDK run build
fi

# 3. Run typecheck
echo -e "${C_YELLOW}[3/5] Running strict TypeScript typecheck in web3-chat...${C_RESET}"
pnpm --dir "${WORKSPACE_ROOT}" run typecheck

# 4. Run multiRepoJoint.test.ts (9 Baseline Stages)
echo -e "${C_YELLOW}[4/5] Executing Baseline Multi-Repo Joint Integration Test Suite (9 Stages)...${C_RESET}"
cd "${WORKSPACE_ROOT}"
pnpm vitest run local-joint-test/multiRepoJoint.test.ts --testTimeout=30000 --hookTimeout=60000

# Ensure port 8548 is freed before starting complex suite
fuser -k 8548/tcp 2>/dev/null || true
sleep 1

# 5. Run complexJointCases.test.ts (6 Advanced Scenarios)
echo -e "${C_YELLOW}[5/5] Executing Advanced & High-Complexity Multi-Repo Verification Suite (6 Cases)...${C_RESET}"
pnpm vitest run local-joint-test/complexJointCases.test.ts --testTimeout=30000 --hookTimeout=60000

echo -e "${C_GREEN}${C_BOLD}"
echo "================================================================================"
echo "    ✅ ALL LOCAL REPOSITORIES JOINT INTEGRATION TESTS PASSED SUCCESSFULLY!     "
echo "================================================================================"
echo -e "${C_RESET}"
