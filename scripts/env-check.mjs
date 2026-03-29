import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const envPath = resolve(rootDir, ".env");
const envExamplePath = resolve(rootDir, ".env.example");

const REQUIRED_VARS = ["DATABASE_URL"];

const OPTIONAL_VARS = [
    { name: "PORT", description: "Backend server port (default: 3000)" },
    { name: "LLM_API_ENDPOINT", description: "LLM API endpoint for streaming" },
    { name: "LLM_API_MODEL", description: "LLM model name" },
    { name: "LLM_API_KEY", description: "LLM API key" },
    { name: "RAG_RETRIEVER_MODE", description: "RAG retrieval mode: keyword | vector" },
];

console.log("╔══════════════════════════════════════════╗");
console.log("║       Environment Configuration Check    ║");
console.log("╚══════════════════════════════════════════╝\n");

// --- 1. Check .env file exists ---
if (!existsSync(envPath)) {
    console.error("❌  .env file not found!\n");
    if (existsSync(envExamplePath)) {
        console.log("💡  Create one by copying the example:");
        console.log(`    cp .env.example .env\n`);
        console.log("    Then fill in your DATABASE_URL and other values.\n");
    } else {
        console.log("💡  Create a .env file in the project root with at least:");
        console.log('    DATABASE_URL="postgresql://user:password@localhost:5432/your_db"\n');
    }
    process.exit(1);
}

// --- 2. Parse .env file ---
const envContent = readFileSync(envPath, "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    envVars[key] = value;
}

// --- 3. Check required variables ---
let hasErrors = false;

console.log("Checking required variables:\n");
for (const varName of REQUIRED_VARS) {
    const value = envVars[varName];
    if (!value) {
        console.error(`  ❌  ${varName} — missing or empty`);
        hasErrors = true;
    } else {
        const masked = value.length > 20 ? value.slice(0, 15) + "..." + value.slice(-5) : value.slice(0, 8) + "***";
        console.log(`  ✅  ${varName} = ${masked}`);
    }
}

// --- 4. Report optional variables ---
console.log("\nOptional variables:\n");
for (const { name, description } of OPTIONAL_VARS) {
    const value = envVars[name];
    if (value) {
        console.log(`  ✅  ${name} — configured`);
    } else {
        console.log(`  ⚠️   ${name} — not set (${description})`);
    }
}

// --- 5. Validate DATABASE_URL format ---
const dbUrl = envVars["DATABASE_URL"];
if (dbUrl) {
    console.log("\nValidating DATABASE_URL format:");
    try {
        const url = new URL(dbUrl);
        if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
            console.error(`  ❌  Protocol must be "postgresql://" — found "${url.protocol}"`);
            hasErrors = true;
        } else {
            console.log(`  ✅  Protocol: ${url.protocol}`);
        }
        console.log(`  ✅  Host: ${url.hostname}:${url.port || "5432"}`);
        console.log(`  ✅  Database: ${url.pathname.slice(1) || "(default)"}`);
    } catch {
        console.error(`  ❌  Invalid URL format: ${dbUrl}`);
        hasErrors = true;
    }
}

console.log("");

if (hasErrors) {
    console.error("❌  Environment check failed. Please fix the issues above.\n");
    process.exit(1);
} else {
    console.log("✅  All environment checks passed!\n");
}
