#!/bin/bash

# Colors for better visual feedback
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Spinner function
spin() {
    local -a marks=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    while :; do
        for m in "${marks[@]}"; do
            echo -ne "\r$1 $m"
            sleep 0.1
        done
    done
}

# Function to stop spinner and clear line
stop_spin() {
    kill $1 2>/dev/null
    echo -ne "\r\033[K" # Clear the line
}

# Function to run command with spinner
run_with_spinner() {
    local message="$1"
    local command="$2"
    local success_msg="$3"
    local error_msg="$4"
    
    # Start spinner in background
    spin "$message" &
    local spin_pid=$!
    
    # Run the command and capture output
    local output
    output=$(eval "$command" 2>&1)
    local exit_code=$?
    
    # Stop spinner
    stop_spin $spin_pid
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ $success_msg${NC}"
        return 0
    else
        echo -e "${RED}❌ $error_msg${NC}"
        echo -e "${RED}Error details:${NC}"
        echo "$output"
        return 1
    fi
}

# Main build process
echo -e "${CYAN}🚀 Creating optimized production build...${NC}"
echo ""

# Step 1: Linting and validation
if [ "${SKIP_LINT:-0}" = "1" ]; then
    echo -e "${YELLOW}⚠️  Skipping linting because SKIP_LINT=1${NC}"
else
    if ! run_with_spinner \
        "${YELLOW}🔍 Linting and validating code..." \
        "npm run lint" \
        "Passed linting and validation step! 🎯" \
        "Build failed due to linting errors! 💥"; then
        exit 1
    fi
fi

echo ""

# Step 2: Compiling TypeScript
if ! run_with_spinner \
    "${CYAN}⚙️  Compiling TypeScript..." \
    "tsc" \
    "TypeScript compilation finished! 📦" \
    "Build failed due to compilation errors! 🔥"; then
    exit 1
fi

echo ""

# Step 3: Fix import paths with tsc-alias
if ! run_with_spinner \
    "${YELLOW}🔧 Fixing import paths..." \
    "./node_modules/.bin/tsc-alias" \
    "Import paths fixed successfully! 🛠️" \
    "Build failed during path resolution! ⚠️"; then
    exit 1
fi

echo ""
echo -e "${GREEN}🎊 Congratulations! Build completed successfully! 🎊${NC}"
echo -e "${GREEN}✨ Your production build is ready to deploy! ✨${NC}"