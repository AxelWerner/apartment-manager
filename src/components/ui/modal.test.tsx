import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './modal';

describe('Modal Component', () => {
  afterEach(() => {
    document.body.style.overflow = 'unset';
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('renders title, subtitle, and children when isOpen is true', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Detalles de la Reserva"
        subtitle="Información del huésped"
      >
        <div data-testid="modal-child">Contenido dentro del modal</div>
      </Modal>
    );

    expect(screen.getByText('Detalles de la Reserva')).toBeInTheDocument();
    expect(screen.getByText('Información del huésped')).toBeInTheDocument();
    expect(screen.getByTestId('modal-child')).toBeInTheDocument();
  });

  it('locks body scroll when opened and restores it when unmounted', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Scroll Lock Test">
        <div>Content</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('unset');
  });

  it('calls onClose when clicking the close (X) button', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Close Button Test">
        <div>Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole('button');
    await user.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Test">
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking backdrop overlay', () => {
    const handleClose = vi.fn();

    const { container } = render(
      <Modal isOpen={true} onClose={handleClose} title="Backdrop Test">
        <div>Content</div>
      </Modal>
    );

    // The first child of the fixed container is the backdrop
    const backdrop = container.querySelector('.bg-slate-900\\/60');
    expect(backdrop).toBeInTheDocument();

    if (backdrop) {
      fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });

  it('does not call onClose when clicking inside the modal content card', () => {
    const handleClose = vi.fn();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Card Click Test">
        <div data-testid="inside-content">Inside Text</div>
      </Modal>
    );

    const inside = screen.getByTestId('inside-content');
    fireEvent.click(inside);

    expect(handleClose).not.toHaveBeenCalled();
  });

  it('applies custom maxWidth classes', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Width Test" maxWidth="2xl">
        <div>Content</div>
      </Modal>
    );

    const card = container.querySelector('.max-w-2xl');
    expect(card).toBeInTheDocument();
  });
});
