import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiAssistantDrawer } from './AiAssistantDrawer';

// Mock useChat from @ai-sdk/react
const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockRegenerate = vi.fn();

vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: mockSendMessage,
    stop: mockStop,
    status: 'ready',
    error: undefined,
    regenerate: mockRegenerate,
  }),
}));

describe('AiAssistantDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AiAssistantDrawer isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders drawer header, status and quick prompts when open', () => {
    render(
      <AiAssistantDrawer
        isOpen={true}
        onClose={vi.fn()}
        propertyName="Apartamento Poblado"
      />
    );

    expect(screen.getByText('Asistente Financiero')).toBeInTheDocument();
    expect(screen.getByText('Qwen / Privado')).toBeInTheDocument();
    expect(screen.getByText('Analizando: Apartamento Poblado')).toBeInTheDocument();
    expect(screen.getByText('¿Cómo nos fue en Septiembre?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Pregunta algo sobre tus ingresos/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<AiAssistantDrawer isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByTitle('Cerrar (Esc)');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers quick prompt when clicked', () => {
    render(<AiAssistantDrawer isOpen={true} onClose={vi.fn()} />);

    const quickPrompt = screen.getByText('¿Cómo nos fue en Septiembre?');
    fireEvent.click(quickPrompt);
    expect(mockSendMessage).toHaveBeenCalledWith({ text: '¿Cómo nos fue en Septiembre?' });
  });

  it('submits text when typed into input and sent', () => {
    render(<AiAssistantDrawer isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Pregunta algo sobre tus ingresos/i);
    fireEvent.change(input, { target: { value: '¿Cuál fue la ocupación en agosto?' } });

    const sendBtn = screen.getByTitle('Enviar pregunta');
    fireEvent.click(sendBtn);

    expect(mockSendMessage).toHaveBeenCalledWith({ text: '¿Cuál fue la ocupación en agosto?' });
  });
});
