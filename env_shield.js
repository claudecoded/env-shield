#!/usr/bin/env node

/**
 * ==============================================================================
 * ENV-SHIELD: Smart Environment Variable Validator & Synchronizer
 * Automatically synchronizes .env with .env.example and blocks leaked secrets.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// --- ANSI UI Color Codes ---
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// High-risk patterns heuristics definitions to detect raw hardcoded credentials
const SECRET_PATTERNS = {
    "AWS Access/Secret Key": /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}|([A-Za-z0-9/+=]{40})/i,
    "Generic Password/Secret": /(password|passwd|secret|private_key|database_url|db_password|session_secret)\s*=\s*['"]?(admin|root|password|123456|qwerty|secret|my_secret_key|postgres|mysql)['"]?$/i,
    "JSON Web Token (JWT)": /eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/i,
    "SSH Private Key Matrix": /-----BEGIN [A-Z]+ PRIVATE KEY-----/
};

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const envObj = {};

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return; // Ignore empty lines and comments
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, ''); // Strip outer quotes
            envObj[key] = value;
        }
    });
    return envObj;
}
function synchronizeAndValidate() {
    const rootDir = process.cwd();
    const envPath = path.join(rootDir, '.env');
    const examplePath = path.join(rootDir, '.env.example');

    console.log(`${CYAN}${BOLD}[Env-Shield Engine Initializing]${RESET}\n`);

    if (!fs.existsSync(envPath)) {
        console.log(`${RED}[CRITICAL ERROR] Target active local .env file missing in root directory.${RESET}`);
        process.exit(1);
    }

    const localEnv = parseEnvFile(envPath);
    const exampleEnv = parseEnvFile(examplePath);

    let configurationErrors = 0;
    const missingInExample = [];
    const missingInLocal = [];

    // 1. Scan for keys added locally but missing in the shared .env.example blueprint file
    Object.keys(localEnv).forEach(key => {
        if (!(key in exampleEnv)) {
            missingInExample.push(key);
        }
    });

    // 2. Scan for keys defined in the shared template blueprint file but missing locally
    Object.keys(exampleEnv).forEach(key => {
        if (!(key in localEnv) || localEnv[key] === '') {
            missingInLocal.push(key);
        }
    });

    // 3. Security Auditing Scanning Loop looking for hardcoded secrets leaks
    console.log(`${BLUE}[i] Running heuristic cryptography and credentials leakage scan...${RESET}`);
    Object.entries(localEnv).forEach(([key, value]) => {
        Object.entries(SECRET_PATTERNS).forEach(([patternName, regex]) => {
            const compositeString = `${key}=${value}`;
            if (regex.test(compositeString)) {
                console.log(`${RED}[SECURITY VIOLATION] Exposed raw confidential signature found inside variable -> ${BOLD}${key}${RESET} (${YELLOW}${patternName}${RESET})`);
                configurationErrors++;
            }
        });
    });

    // Handle automated syncing and synchronization outputs alerts
    if (missingInExample.length > 0) {
        console.log(`${YELLOW}[WARNING] Found keys in local .env missing inside your .env.example template.${RESET}`);
        missingInExample.forEach(key => {
            fs.appendFileSync(examplePath, `\n${key}=`);
            console.log(`  ${GREEN}[+] Auto-synchronized missing key: ${key}${RESET}`);
        });
    }

    if (missingInLocal.length > 0) {
        console.log(`${RED}[BLOCKING ERROR] The following keys from your template are missing or empty locally:${RESET}`);
        missingInLocal.forEach(key => console.log(`  ${RED}✖ ${key}${RESET}`));
        configurationErrors += missingInLocal.length;
    }

    console.log(`\n${CYAN}----------------------------------------------------------------------${RESET}`);
    if (configurationErrors > 0) {
        console.log(`${RED}${BOLD}[GIT COMMIT BLOCKED] Security check failed with ${configurationErrors} anomalies. Fix secrets/missing files to proceed.${RESET}`);
        process.exit(1);
    } else {
        console.log(`${GREEN}${BOLD}[SECURITY SECURE] Environmental keys validated successfully. Committing safely.${RESET}`);
        process.exit(0);
    }
}

synchronizeAndValidate();
#!/usr/bin/env bash

# ==============================================================================
# ENV-SHIELD AUTO-INSTALLER
# Sets up the pre-commit environment validation hooks natively inside git workspace.
# ==============================================================================

set -euo pipefail

TARGET_HOOK_DIR=".git/hooks"
PRE_COMMIT_FILE="$TARGET_HOOK_DIR/pre-commit"

echo -e "\033[0;34m[*] Bootstrapping Env-Shield pipeline hook installation...\033[0m"

if [ ! -d ".git" ]; then
    echo -e "\033[0;31m[Fatal Error] No git architecture found. Please execute this installer inside project root folder.\033[0m"
    exit 1
fi

# Inject validation script binding target commands
cat << 'EOF' > "$PRE_COMMIT_FILE"
#!/usr/bin/env bash
# Trigger Env-Shield verification routine safely before accepting commits
node env_shield.js
EOF

# Grant execution rights permission maps to the target file system hooks
chmod +x "$PRE_COMMIT_FILE"

echo -e "\033[0;32m[SUCCESS] Env-Shield pre-commit hooks loaded actively. Your repository is now protected!\033[0m"
