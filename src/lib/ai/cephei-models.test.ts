import { describe, it, expect, vi } from 'vitest';
import {
  parseCepheiModelsResponse,
  evaluateModelHealth,
  fetchCepheiModels,
  checkCepheiHealth,
  DEFAULT_CHAT_MODEL,
  DEFAULT_VISION_MODEL,
  type CepheiModelEntry,
} from './cephei-models';

describe('cephei-models', () => {
  describe('parseCepheiModelsResponse', () => {
    it('handles null, undefined or empty objects gracefully', () => {
      expect(parseCepheiModelsResponse(null)).toEqual([]);
      expect(parseCepheiModelsResponse(undefined)).toEqual([]);
      expect(parseCepheiModelsResponse({})).toEqual([]);
      expect(parseCepheiModelsResponse({ data: 'not-an-array' })).toEqual([]);
    });

    it('parses valid model array and respects is_active flag', () => {
      const mockPayload = {
        data: [
          { id: 'qwen3.8:27b-mlx', name: 'Qwen 3.8', is_active: true },
          { id: 'galahad.qwen3.6-35b', name: 'Galahad Qwen', info: { is_active: true } },
          { id: 'old-model', is_active: false },
          { id: null }, // invalid item
          'invalid item',
        ],
      };

      const result = parseCepheiModelsResponse(mockPayload);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'qwen3.8:27b-mlx',
        name: 'Qwen 3.8',
        isActive: true,
        ownedBy: undefined,
      });
      expect(result[1]).toEqual({
        id: 'galahad.qwen3.6-35b',
        name: 'Galahad Qwen',
        isActive: true,
        ownedBy: undefined,
      });
      expect(result[2].isActive).toBe(false);
    });
  });

  describe('evaluateModelHealth', () => {
    it('returns healthy status when both primary models are present and active', () => {
      const models: CepheiModelEntry[] = [
        { id: DEFAULT_CHAT_MODEL, isActive: true },
        { id: DEFAULT_VISION_MODEL, isActive: true },
        { id: 'extra-model', isActive: true },
      ];

      const report = evaluateModelHealth({
        models,
        configuredChatModel: DEFAULT_CHAT_MODEL,
        configuredVisionModel: DEFAULT_VISION_MODEL,
      });

      expect(report.healthy).toBe(true);
      expect(report.overallStatus).toBe('healthy');
      expect(report.chat.isAvailable).toBe(true);
      expect(report.chat.isFallback).toBe(false);
      expect(report.chat.activeModel).toBe(DEFAULT_CHAT_MODEL);
      expect(report.vision.isAvailable).toBe(true);
      expect(report.vision.isFallback).toBe(false);
      expect(report.vision.activeModel).toBe(DEFAULT_VISION_MODEL);
      expect(report.warnings).toHaveLength(0);
    });

    it('activates fallback and marks status as degraded when primary chat model is unavailable', () => {
      const models: CepheiModelEntry[] = [
        // Primary chat missing!
        { id: 'galahad.qwen3.8-flash', isActive: true }, // Candidate #1 in fallback chain
        { id: DEFAULT_VISION_MODEL, isActive: true },
      ];

      const report = evaluateModelHealth({
        models,
        configuredChatModel: DEFAULT_CHAT_MODEL,
        configuredVisionModel: DEFAULT_VISION_MODEL,
      });

      expect(report.healthy).toBe(false);
      expect(report.overallStatus).toBe('degraded');
      expect(report.chat.isAvailable).toBe(false);
      expect(report.chat.isFallback).toBe(true);
      expect(report.chat.activeModel).toBe('galahad.qwen3.8-flash');
      expect(report.warnings.some((w) => w.includes('[CHAT]'))).toBe(true);
      expect(report.remediationSuggestions.length).toBeGreaterThan(0);
    });

    it('activates fallback when primary vision model is unavailable', () => {
      const models: CepheiModelEntry[] = [
        { id: DEFAULT_CHAT_MODEL, isActive: true },
        // Primary vision 'glm-5.3-flash:cloud' is missing!
        { id: 'glm-5.3:cloud', isActive: true }, // Candidate in vision fallback chain
      ];

      const report = evaluateModelHealth({
        models,
        configuredChatModel: DEFAULT_CHAT_MODEL,
        configuredVisionModel: DEFAULT_VISION_MODEL,
      });

      expect(report.healthy).toBe(false);
      expect(report.overallStatus).toBe('degraded');
      expect(report.vision.isAvailable).toBe(false);
      expect(report.vision.isFallback).toBe(true);
      expect(report.vision.activeModel).toBe('glm-5.3:cloud');
      expect(report.warnings.some((w) => w.includes('[VISION]'))).toBe(true);
    });

    it('detects outage when neither primary nor fallback models are available', () => {
      const models: CepheiModelEntry[] = [
        { id: 'unrelated-model-123', isActive: true },
      ];

      const report = evaluateModelHealth({
        models,
        configuredChatModel: DEFAULT_CHAT_MODEL,
        configuredVisionModel: DEFAULT_VISION_MODEL,
      });

      expect(report.healthy).toBe(false);
      expect(report.overallStatus).toBe('outage');
      expect(report.chat.isAvailable).toBe(false);
      expect(report.vision.isAvailable).toBe(false);
      expect(report.warnings.some((w) => w.includes('[CHAT CRÍTICO]'))).toBe(true);
      expect(report.warnings.some((w) => w.includes('[VISION CRÍTICO]'))).toBe(true);
    });
  });

  describe('fetchCepheiModels', () => {
    it('calls /models endpoint with Authorization header and parses result', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'model-a', name: 'Model A' }],
        }),
      });

      const models = await fetchCepheiModels('https://cephei.ai/api/v1', 'test-api-key', mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://cephei.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
      expect(models).toEqual([{ id: 'model-a', name: 'Model A', isActive: true, ownedBy: undefined }]);
    });

    it('throws error when server returns non-ok status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid Bearer token',
      });

      await expect(
        fetchCepheiModels('https://cephei.ai/api/v1', 'bad-key', mockFetch as unknown as typeof fetch)
      ).rejects.toThrow(/Error conectando con Cephei \(401 Unauthorized\)/);
    });
  });

  describe('checkCepheiHealth', () => {
    it('executes full workflow and generates report', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: DEFAULT_CHAT_MODEL, is_active: true },
            { id: DEFAULT_VISION_MODEL, is_active: true },
          ],
        }),
      });

      const report = await checkCepheiHealth({
        baseURL: 'https://cephei.ai/api/v1',
        apiKey: 'secret-key',
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(report.healthy).toBe(true);
      expect(report.overallStatus).toBe('healthy');
      expect(report.totalActiveModels).toBe(2);
    });
  });
});
