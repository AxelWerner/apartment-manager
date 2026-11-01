import {
  checkCepheiHealth,
  DEFAULT_CEPHEI_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_VISION_MODEL,
} from '../src/lib/ai/cephei-models.js';

export async function GET() {
  const baseURL = process.env.CUSTOM_LLM_BASE_URL || DEFAULT_CEPHEI_BASE_URL;
  const apiKey = process.env.CUSTOM_LLM_API_KEY || '';
  const configuredChatModel = process.env.CUSTOM_LLM_MODEL || DEFAULT_CHAT_MODEL;
  const configuredVisionModel = process.env.CUSTOM_LLM_VISION_MODEL || DEFAULT_VISION_MODEL;

  try {
    const report = await checkCepheiHealth({
      baseURL,
      apiKey,
      configuredChatModel,
      configuredVisionModel,
    });

    const statusCode = report.overallStatus === 'outage' ? 503 : report.overallStatus === 'degraded' ? 200 : 200;

    return new Response(JSON.stringify(report, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al verificar modelos en Cephei';
    return new Response(
      JSON.stringify(
        {
          healthy: false,
          overallStatus: 'outage',
          error: message,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      ),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
