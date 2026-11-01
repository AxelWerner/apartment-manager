#!/usr/bin/env tsx
/**
 * CLI Monitor for Cephei LLM Models & Availability.
 *
 * Usage:
 *   pnpm monitor:cephei
 *   npx tsx scripts/monitor-cephei-models.ts [--json] [--silent-ok]
 *
 * Core Concept: LLM Infrastructure Reliability, Circuit Breakers & Dynamic Model Routing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkCepheiHealth,
  DEFAULT_CEPHEI_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_VISION_MODEL,
  ModelHealthReport,
} from '../src/lib/ai/cephei-models.js';

// Minimal env file loader if running outside vite/next
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Auto-load .env.local and .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

const isJson = process.argv.includes('--json');
const isSilentOk = process.argv.includes('--silent-ok');

async function main() {
  const baseURL = process.env.CUSTOM_LLM_BASE_URL || DEFAULT_CEPHEI_BASE_URL;
  const apiKey = process.env.CUSTOM_LLM_API_KEY || '';
  const configuredChatModel = process.env.CUSTOM_LLM_MODEL || DEFAULT_CHAT_MODEL;
  const configuredVisionModel = process.env.CUSTOM_LLM_VISION_MODEL || DEFAULT_VISION_MODEL;

  try {
    const report: ModelHealthReport = await checkCepheiHealth({
      baseURL,
      apiKey,
      configuredChatModel,
      configuredVisionModel,
    });

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.overallStatus === 'outage' ? 2 : report.overallStatus === 'degraded' ? 1 : 0);
    }

    if (isSilentOk && report.healthy) {
      process.exit(0);
    }

    // Console formatting
    const divider = '─'.repeat(72);
    console.log('\n' + divider);
    console.log('🤖 CEPHEI AI MODEL MONITOR — HEALTH & FAILOVER STATUS');
    console.log(divider);
    console.log(`⏱️  Timestamp:       ${report.timestamp}`);
    console.log(`🌐 Base URL:        ${report.baseURL}`);
    console.log(`📦 Modelos Activos: ${report.totalActiveModels}`);

    const statusBadge =
      report.overallStatus === 'healthy'
        ? '\x1b[32m✔ OPERATIVO (HEALTHY)\x1b[0m'
        : report.overallStatus === 'degraded'
          ? '\x1b[33m▲ DEGRADADO (FALLBACK ACTIVO)\x1b[0m'
          : '\x1b[31m✖ CAÍDA TOTAL (OUTAGE)\x1b[0m';

    console.log(`🚦 Estado General:  ${statusBadge}`);
    console.log(divider);

    // Chat Model
    console.log('\n💬 MODELO DE CHAT & AGENTE FINANCIERO:');
    console.log(`   Configurado:     ${report.chat.configured}`);
    console.log(`   Disponible:      ${report.chat.isAvailable ? '✅ Sí' : '❌ NO'}`);
    console.log(`   Modelo en Uso:   ${report.chat.activeModel} ${report.chat.isFallback ? '⚠️ (FALLBACK AUTOMÁTICO)' : ''}`);
    if (report.chat.availableFallbacks.length > 0) {
      console.log(`   Fallbacks Disp.: ${report.chat.availableFallbacks.join(', ')}`);
    }

    // Vision Model
    console.log('\n👁️ MODELO DE VISIÓN & ESCANEO DE FACTURAS:');
    console.log(`   Configurado:     ${report.vision.configured}`);
    console.log(`   Disponible:      ${report.vision.isAvailable ? '✅ Sí' : '❌ NO'}`);
    console.log(`   Modelo en Uso:   ${report.vision.activeModel} ${report.vision.isFallback ? '⚠️ (FALLBACK AUTOMÁTICO)' : ''}`);
    if (report.vision.availableFallbacks.length > 0) {
      console.log(`   Fallbacks Disp.: ${report.vision.availableFallbacks.join(', ')}`);
    }

    // Warnings and Suggestions
    if (report.warnings.length > 0) {
      console.log('\n' + divider);
      console.log('⚠️  ALERTAS DETECTADAS:');
      for (const w of report.warnings) {
        console.log(`   • ${w}`);
      }
    }

    if (report.remediationSuggestions.length > 0) {
      console.log('\n💡 PROCEDIMIENTO DE REMEDIACIÓN:');
      for (const s of report.remediationSuggestions) {
        console.log(`   👉 ${s}`);
      }
    }

    console.log(divider + '\n');

    if (report.overallStatus === 'outage') {
      process.exit(2);
    } else if (report.overallStatus === 'degraded') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      console.log(JSON.stringify({ error: errorMsg, healthy: false, overallStatus: 'outage' }, null, 2));
    } else {
      console.error('\n❌ ERROR CRÍTICO AL CONECTAR CON CEPHEI:');
      console.error(`   ${errorMsg}`);
      console.error('   Verifica que CUSTOM_LLM_BASE_URL y CUSTOM_LLM_API_KEY sean correctos.\n');
    }
    process.exit(2);
  }
}

main();
