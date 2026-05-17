import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Messenger_Field } from './Messenger_Field';
import { useUserPermissions } from '../features/useUserPermissions';
import { wsService } from '../features/websocket.service';

vi.mock('../features/useUserPermissions', () => ({
  useUserPermissions: vi.fn(),
}));

vi.mock('../features/websocket.service', () => ({
  wsService: {
    on: vi.fn(() => () => {}),
    subscribeRoom: vi.fn(),
    unsubscribeRoom: vi.fn(),
  },
}));

vi.mock('../entities/Messages_List', () => ({
  Messages_List: () => <div data-testid="messages-list">Messages List</div>,
}));

vi.mock('../entities/Message_Input', () => ({
  Message_Input: () => <div data-testid="message-input">Message Input</div>,
}));

vi.mock('../features/api.service', () => ({
  apiService: {
    getRoomById: vi.fn().mockResolvedValue({ id: 1, guild_id: 1, name: 'Test Room' }),
  },
}));

describe('Messenger_Field', () => {
  const defaultProps = {
    roomId: 1,
    currentUserId: 123,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders messages list', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasSendMessages: true,
      isLoading: false,
    });
    
    render(<Messenger_Field {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('messages-list')).toBeDefined();
    });
  });

  it('shows message input when user has permission', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasSendMessages: true,
      isLoading: false,
    });
    
    render(<Messenger_Field {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('message-input')).toBeDefined();
    });
  });

  it('does not show message input when user lacks permission', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasSendMessages: false,
      isLoading: false,
    });
    
    render(<Messenger_Field {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('message-input')).toBeNull();
    });
  });

  it('shows loading placeholder while permissions are loading', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasSendMessages: false,
      isLoading: true,
    });
    
    render(<Messenger_Field {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Загрузка прав доступа...')).toBeDefined();
    });
  });

  it('subscribes to room on mount', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasSendMessages: true,
      isLoading: false,
    });
    
    render(<Messenger_Field {...defaultProps} />);
    
    await waitFor(() => {
      expect(wsService.subscribeRoom).toHaveBeenCalledWith(1);
    });
  });

  it('unsubscribes from room on unmount', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasSendMessages: true,
      isLoading: false,
    });
    
    const { unmount } = render(<Messenger_Field {...defaultProps} />);
    
    await waitFor(() => {
      expect(wsService.subscribeRoom).toHaveBeenCalled();
    });
    
    unmount();
    
    expect(wsService.unsubscribeRoom).toHaveBeenCalledWith(1);
  });
});