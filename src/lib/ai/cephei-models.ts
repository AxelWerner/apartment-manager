/**
 * Cephei AI Model Catalog, Health Checker & Fallback Routing Strategy.
 *
 * Core AI Engineering Concept:
 * LLM Infrastructure Reliability, Circuit Breakers & Dynamic Model Routing.
 */

export interface CepheiModelEntry {
  id: string;
  name?: string;
  isActive?: boolean;
  ownedBy?: string;
}

export interface ModelHealthReport {
  timestamp: string;
  healthy: boolean;
  overallStatus: 'healthy' | 'degraded' | 'outage';
  baseURL: string;
  totalActiveModels: number;
  chat: {
    configured: string;
    isAvailable: boolean;
    activeModel: string;
    isFallback: boolean;
    availableFallbacks: string[];
  };
  vision: {
    configured: string;
    isAvailable: boolean;
    activeModel: string;
    isFallback: boolean;
    availableFallbacks: string[];
  };
  warnings: string[];
  remediationSuggestions: string[];
}

export const DEFAULT_CEPHEI_BASE_URL = 'https://cephei.ai/api/v1';

export const DEFAULT_CHAT_MODEL = 'galahad.qwen3.6-35b';
export const CHAT_FALLBACK_CHAIN = [
  'galahad.qwen3.8-flash',
  'galahad.qwen3.5-122b',
  'qwen3.8:27b-mlx',
  'galahad.qwen3-coder',
  'nemotron-3.5-super:120b',
] as const;

export const DEFAULT_VISION_MODEL = 'glm-5.3-flash:cloud';
export const VISION_FALLBACK_CHAIN = [
  'glm-5.3:cloud',
  'glm-5.2:cloud',
  'qwen3.8:27b-mlx',
  'nemotron-3.5-super:120b',
] as const;

/**
 * Normalizes and extracts model entries from Cephei / OpenAI-compatible /v1/models response.
 */
export function parseCepheiModelsResponse(json: unknown): CepheiModelEntry[] {
  if (!json || typeof json !== 'object') return [];
  const rawData = (json as { data?: unknown[] }).data;
  if (!Array.isArray(rawData)) return [];

  const results: CepheiModelEntry[] = [];
  for (const item of rawData) {
    if (!item || typeof item !== 'object') continue;
    const m = item as {
      id?: string;
      name?: string;
      is_active?: boolean;
      owned_by?: string;
      info?: { is_active?: boolean };
    };
    if (!m.id || typeof m.id !== 'string') continue;

    // Cephei marks models as active via item.is_active or item.info.is_active (defaults to true if omitted)
    const isActive =
      m.is_active !== undefined
        ? Boolean(m.is_active)
        : m.info?.is_active !== undefined
          ? Boolean(m.info.is_active)
          : true;

    results.push({
      id: m.id,
      name: m.name || m.id,
      isActive,
      ownedBy: m.owned_by,
    });
  }

  return results;
}

/**
 * Fetches available models from Cephei OpenAI-compatible endpoint.
 */
export async function fetchCepheiModels(
  baseURL: string = DEFAULT_CEPHEI_BASE_URL,
  apiKey: string = '',
  fetchFn: typeof fetch = fetch
): Promise<CepheiModelEntry[]> {
  const cleanBaseUrl = baseURL.replace(/\/+$/, '');
  const url = `${cleanBaseUrl}/models`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetchFn(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Error conectando con Cephei (${response.status} ${response.statusText}): ${errorText.slice(0, 200)}`
    );
  }

  const json = await response.json();
  return parseCepheiModelsResponse(json);
}

/**
 * Pure evaluation function that assesses model availability and selects fallbacks.
 */
export function evaluateModelHealth(params: {
  models: CepheiModelEntry[];
  configuredChatModel?: string;
  configuredVisionModel?: string;
  baseURL?: string;
}): ModelHealthReport {
  const {
    models,
    configuredChatModel = DEFAULT_CHAT_MODEL,
    configuredVisionModel = DEFAULT_VISION_MODEL,
    baseURL = DEFAULT_CEPHEI_BASE_URL,
  } = params;

  // Active models set
  const activeModelIds = new Set(
    models.filter((m) => m.isActive !== false).map((m) => m.id)
  );

  const warnings: string[] = [];
  const remediationSuggestions: string[] = [];

  // 1. Evaluate Chat Model
  const isChatAvailable = activeModelIds.has(configuredChatModel);
  let resolvedChatModel = configuredChatModel;
  let isChatFallback = false;

  const chatFallbackCandidates = CHAT_FALLBACK_CHAIN.filter((id) =>
    activeModelIds.has(id)
  );

  if (!isChatAvailable) {
    isChatFallback = true;
    if (chatFallbackCandidates.length > 0) {
      resolvedChatModel = chatFallbackCandidates[0];
      warnings.push(
        `[CHAT] Modelo configurado '${configuredChatModel}' no disponible en Cephei. Fallback activado a '${resolvedChatModel}'.`
      );
      remediationSuggestions.push(
        `Actualizar CUSTOM_LLM_MODEL='${resolvedChatModel}' en variables de entorno o rehabilitar '${configuredChatModel}' en Cephei.`
      );
    } else {
      warnings.push(
        `[CHAT CRÍTICO] Ni el modelo configurado '${configuredChatModel}' ni ningún modelo de fallback de chat están disponibles.`
      );
      remediationSuggestions.push(
        `Revisar estado de Ollama/vLLM en el host de Cephei para los modelos Qwen.`
      );
    }
  }

  // 2. Evaluate Vision Model
  const isVisionAvailable = activeModelIds.has(configuredVisionModel);
  let resolvedVisionModel = configuredVisionModel;
  let isVisionFallback = false;

  const visionFallbackCandidates = VISION_FALLBACK_CHAIN.filter((id) =>
    activeModelIds.has(id)
  );

  if (!isVisionAvailable) {
    isVisionFallback = true;
    if (visionFallbackCandidates.length > 0) {
      resolvedVisionModel = visionFallbackCandidates[0];
      warnings.push(
        `[VISION] Modelo configurado '${configuredVisionModel}' no disponible en Cephei. Fallback activado a '${resolvedVisionModel}'.`
      );
      remediationSuggestions.push(
        `Actualizar CUSTOM_LLM_VISION_MODEL='${resolvedVisionModel}' en variables de entorno o rehabilitar '${configuredVisionModel}' en Cephei.`
      );
    } else {
      warnings.push(
        `[VISION CRÍTICO] Ni el modelo configurado '${configuredVisionModel}' ni ningún modelo de fallback de visión están disponibles.`
      );
      remediationSuggestions.push(
        `Revisar conectividad de modelos de visión (GLM / Qwen) en Cephei.`
      );
    }
  }

  const isHealthy = isChatAvailable && isVisionAvailable;
  const isOutage =
    (!isChatAvailable && chatFallbackCandidates.length === 0) ||
    (!isVisionAvailable && visionFallbackCandidates.length === 0);

  const overallStatus: 'healthy' | 'degraded' | 'outage' = isHealthy
    ? 'healthy'
    : isOutage
      ? 'outage'
      : 'degraded';

  return {
    timestamp: new Date().toISOString(),
    healthy: isHealthy,
    overallStatus,
    baseURL,
    totalActiveModels: activeModelIds.size,
    chat: {
      configured: configuredChatModel,
      isAvailable: isChatAvailable,
      activeModel: resolvedChatModel,
      isFallback: isChatFallback,
      availableFallbacks: chatFallbackCandidates,
    },
    vision: {
      configured: configuredVisionModel,
      isAvailable: isVisionAvailable,
      activeModel: resolvedVisionModel,
      isFallback: isVisionFallback,
      availableFallbacks: visionFallbackCandidates,
    },
    warnings,
    remediationSuggestions,
  };
}

/**
 * End-to-end Cephei health check helper.
 */
export async function checkCepheiHealth(options?: {
  baseURL?: string;
  apiKey?: string;
  configuredChatModel?: string;
  configuredVisionModel?: string;
  fetchFn?: typeof fetch;
}): Promise<ModelHealthReport> {
  const baseURL = options?.baseURL || DEFAULT_CEPHEI_BASE_URL;
  const apiKey = options?.apiKey || '';
  const configuredChatModel = options?.configuredChatModel || DEFAULT_CHAT_MODEL;
  const configuredVisionModel =
    options?.configuredVisionModel || DEFAULT_VISION_MODEL;

  const models = await fetchCepheiModels(baseURL, apiKey, options?.fetchFn);

  return evaluateModelHealth({
    models,
    configuredChatModel,
    configuredVisionModel,
    baseURL,
  });
}
