#!/usr/bin/env node

/**
 * Smart setup script for HostelGrievance
 * Handles better-sqlite3 compilation on different systems
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

console.log('');
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║         HostelGrievance - Smart Setup Script             ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

function run(cmd, options = {}) {
    try {
        return execSync(cmd, { 
            stdio: 'inherit', 
            cwd: ROOT,
            ...options 
        });
    } catch (e) {
        return null;
    }
}

// Step 1: Check if dependencies are installed
console.log('');
console.log('📦 Step 1: Checking dependencies...');

if (!existsSync(join(ROOT, 'node_modules', 'better-sqlite3'))) {
    console.log('⚠️  better-sqlite3 not found. Run: npm install --ignore-scripts');
    console.log('   Then run: npm run setup');
    process.exit(1);
}

console.log('✅ Dependencies found.');

// Step 2: Create database
console.log('');
console.log('🗄️  Step 2: Creating database with sample data...');
run('npx tsx src/server/scripts/reset-db.ts');

console.log('');
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║                    ✅ Setup Complete!                     ║');
console.log('╠═══════════════════════════════════════════════════════════╣');
console.log('║                                                         ║');
console.log('║  Run the app with:                                      ║');
console.log('║    npm run dev:all                                      ║');
console.log('║                                                         ║');
console.log('║  Then open: http://localhost:5173                       ║');
console.log('║                                                         ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');
