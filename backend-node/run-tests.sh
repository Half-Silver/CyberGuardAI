#!/bin/bash
# CyberGuard AI Comprehensive Test Runner
# This script runs all tests for the CyberGuard AI system

echo "============================================================="
echo "            CYBERGUARD AI SYSTEM TEST RUNNER                 "
echo "============================================================="

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
echo -e "${BLUE}Checking if backend server is running...${NC}"
curl -s http://localhost:8001/api/status > /dev/null
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Backend server is not running!${NC}"
  echo -e "${YELLOW}Please start the server with:${NC}"
  echo -e "cd $(pwd) && PORT=8001 npm run dev"
  exit 1
fi
echo -e "${GREEN}Backend server is running.${NC}"

# Run the tests
echo -e "\n${BLUE}Running comprehensive tests...${NC}"
npm test

# Check result
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}All tests completed successfully!${NC}"
  exit 0
else
  echo -e "\n${RED}Some tests failed. Please check the logs above.${NC}"
  exit 1
fi
