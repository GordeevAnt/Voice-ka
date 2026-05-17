import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Message_Input } from './Message_Input';
import { apiService } from '../features/api.service';

vi.mock('../features/api.service', () => ({
  apiService: {
    sendMessage: vi.fn(),
  },
}));

describe('Message_Input', () => {
  const defaultProps = {
    roomId: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.sendMessage as any).mockResolvedValue({ id: 1 });
  });

  it('renders input field and send button', () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    const button = screen.getByText('Отправить');
    
    expect(input).toBeDefined();
    expect(button).toBeDefined();
  });

  it('updates input value on change', () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Hello world' } });
    
    expect(input.value).toBe('Hello world');
  });

  it('sends message when send button is clicked', async () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const button = screen.getByText('Отправить');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(apiService.sendMessage).toHaveBeenCalledWith(1, 'Test message');
    });
  });

  it('clears input after sending message', async () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const button = screen.getByText('Отправить');
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('sends message when Enter key is pressed', async () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    fireEvent.change(input, { target: { value: 'Test message' } });
    // В компоненте используется onKeyPress, не onKeyDown
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    await waitFor(() => {
      expect(apiService.sendMessage).toHaveBeenCalledWith(1, 'Test message');
    });
  });

  it('does not send empty message', async () => {
    render(<Message_Input {...defaultProps} />);
    
    const button = screen.getByText('Отправить');
    fireEvent.click(button);
    
    expect(apiService.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send message with only whitespace', async () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    fireEvent.change(input, { target: { value: '   ' } });
    
    const button = screen.getByText('Отправить');
    fireEvent.click(button);
    
    expect(apiService.sendMessage).not.toHaveBeenCalled();
  });

  it('disables send button while sending', async () => {
    (apiService.sendMessage as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    fireEvent.change(input, { target: { value: 'Test' } });
    
    const button = screen.getByText('Отправить');
    fireEvent.click(button);
    
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Отправка...')).toBeDefined();
    
    await waitFor(() => {
      expect(screen.getByText('Отправить')).toBeDefined();
    });
  });

  it('shows error alert when send fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    (apiService.sendMessage as any).mockRejectedValue(new Error('Network error'));
    
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Отправить'));
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
    });
    
    alertMock.mockRestore();
  });

  it('does not send on Shift+Enter', async () => {
    render(<Message_Input {...defaultProps} />);
    
    const input = screen.getByPlaceholderText('Напиши сообщение :)');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', shiftKey: true });
    
    expect(apiService.sendMessage).not.toHaveBeenCalled();
  });
});