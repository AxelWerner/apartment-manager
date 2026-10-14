import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  Sparkles,
  X,
  Send,
  Square,
  Bot,
  User as UserIcon,
  AlertCircle,
  Database,
  Building,
  TrendingUp,
  Receipt,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activePropertyId?: string;
  propertyName?: string;
}

const QUICK_PROMPTS = [
  { label: '¿Cómo nos fue en Septiembre?', icon: TrendingUp },
  { label: '¿Cuáles fueron los mayores gastos de este mes?', icon: Receipt },
  { label: '¿Cuáles son mis propiedades registradas?', icon: Building },
  { label: '¿Cuál es el margen de beneficio actual?', icon: Sparkles },
];

function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return '';
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof (p as { text?: unknown }).text === 'string')
    .map((p) => p.text)
    .join('');
}

export function AiAssistantDrawer({
  isOpen,
  onClose,
  activePropertyId,
  propertyName,
}: AiAssistantDrawerProps) {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'help'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { activePropertyId },
      }),
    [activePropertyId]
  );

  const { messages, sendMessage, stop, status, error, regenerate } = useChat({
    transport,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSendPrompt = async (promptText: string) => {
    if (isLoading) return;
    await sendMessage({ text: promptText });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await sendMessage({ text: trimmed });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <aside
          aria-label="Panel del Asistente Financiero IA"
          className="flex w-screen max-w-md md:max-w-lg flex-col bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Asistente Financiero
                  </h3>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    Qwen / Privado
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {propertyName ? `Analizando: ${propertyName}` : 'Consultas en lenguaje natural'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'chat' ? 'help' : 'chat')}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Ayuda y configuración"
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Cerrar (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Help Info Tab */}
          {activeTab === 'help' ? (
            <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-600 dark:text-slate-300 space-y-4">
              <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 p-4 border border-indigo-100 dark:border-indigo-900/50">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Servidor LLM Propio
                </h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                  Este asistente consulta tu propio servidor de modelos (Qwen, Ollama, vLLM, etc.) usando
                  herramientas seguras en Supabase. Las cifras son 100% exactas y no se envían a OpenAI ni a Google.
                </p>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-slate-900 dark:text-white">Variables en tu archivo .env.local:</h5>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 text-xs overflow-x-auto font-mono">
{`CUSTOM_LLM_BASE_URL=http://localhost:11434/v1
CUSTOM_LLM_API_KEY=
CUSTOM_LLM_MODEL=qwen2.5`}
                </pre>
              </div>

              <div className="space-y-2">
                <h5 className="font-semibold text-slate-900 dark:text-white">Ejemplos de preguntas:</h5>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <li>"¿Cómo nos fue en Septiembre de 2026?"</li>
                  <li>"¿Cuáles fueron los 3 gastos más grandes del mes pasado?"</li>
                  <li>"¿Qué ocupación tuvimos en agosto?"</li>
                  <li>"¿Qué departamentos tengo y qué moneda usan?"</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="w-full mt-4 py-2 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Volver al chat
              </button>
            </div>
          ) : (
            /* Chat Body */
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center px-4 py-8">
                  <div className="h-14 w-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                    ¿En qué puedo ayudarte hoy?
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-6">
                    Pregúntame sobre los ingresos, gastos o tasa de ocupación de tus alojamientos.
                  </p>

                  {/* Suggestion Chips */}
                  <div className="w-full space-y-2">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 text-left px-1">
                      Consultas sugeridas:
                    </p>
                    {QUICK_PROMPTS.map((prompt, index) => {
                      const Icon = prompt.icon;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSendPrompt(prompt.label)}
                          className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-all group cursor-pointer"
                        >
                          <div className="h-7 w-7 rounded-lg bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span>{prompt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => {
                    const isUser = message.role === 'user';
                    const text = getMessageText(message);
                    const hasToolCall =
                      !isUser &&
                      Array.isArray(message.parts) &&
                      message.parts.some(
                        (p) =>
                          p.type === 'tool-call' ||
                          (p as { type: string }).type === 'tool-invocation' ||
                          (p as { type: string }).type === 'dynamic-tool'
                      );

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isUser && (
                          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                            isUser
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/60 shadow-xs'
                          }`}
                        >
                          {hasToolCall && (
                            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-lg w-fit">
                              <Database className="h-3 w-3 text-indigo-500" />
                              <span>Métricas de Supabase consultadas</span>
                            </div>
                          )}

                          {text ? (
                            <div className="whitespace-pre-wrap font-sans">{text}</div>
                          ) : (
                            <div className="flex items-center gap-1 py-1 text-slate-400 dark:text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                            </div>
                          )}
                        </div>

                        {isUser && (
                          <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                            <UserIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Loading / Tool execution indicator */}
                  {isLoading && (
                    <div className="flex gap-3 items-center text-xs text-slate-400 dark:text-slate-500">
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border border-slate-200/60 dark:border-slate-800">
                        <Database className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                        <span>Consultando métricas y ejecutando Qwen...</span>
                      </div>
                    </div>
                  )}

                  {/* Error Notification */}
                  {error && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="h-4 w-4 text-rose-500" />
                        <span>No se pudo conectar con el servidor LLM</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        Verifica que tu servidor esté activo y que la variable{' '}
                        <code className="bg-rose-100 dark:bg-rose-900/60 px-1 py-0.5 rounded font-mono">
                          CUSTOM_LLM_BASE_URL
                        </code>{' '}
                        en tu archivo <code className="font-mono">.env.local</code> esté apuntando a la dirección correcta.
                      </p>
                      <button
                        type="button"
                        onClick={() => regenerate()}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-medium hover:bg-rose-700 transition-colors"
                      >
                        <RotateCcw className="h-3 w-3" /> Reintentar
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          )}

          {/* Footer Input */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <form onSubmit={onSubmit} className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta algo sobre tus ingresos, gastos o departamentos..."
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-12 py-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:opacity-60 shadow-xs"
              />

              <div className="absolute right-2 flex items-center">
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    title="Detener respuesta"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
                    title="Enviar pregunta"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </form>
            <p className="mt-2 text-[10px] text-center text-slate-400 dark:text-slate-500">
              🔒 Datos procesados en tu servidor privado. Atajo de teclado: <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px]">Cmd+J</kbd> o <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[9px]">Ctrl+J</kbd>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
