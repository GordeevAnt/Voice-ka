import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Rooms_Online_List } from './Rooms_Online_List';
import { apiService } from '../features/api.service';
import { wsService } from '../features/websocket.service';

vi.mock('../features/api.service', () => ({
  apiService: {
    getOnlineGuildMembers: vi.fn(),
  },
}));

vi.mock('../features/websocket.service', () => ({
  wsService: {
    waitForAuth: vi.fn().mockResolvedValue(undefined),
    subscribeGuild: vi.fn(),
    unsubscribeGuild: vi.fn(),
    on: vi.fn(() => () => {}),
    getConnectionStatus: vi.fn(() => true),
  },
}));

describe('Rooms_Online_List', () => {
  const defaultProps = {
    guildId: 1,
  };

  const mockUsers = [
    { user_id: 1, username: 'Alice', avatar: null, status: 'online' },
    { user_id: 2, username: 'Bob', avatar: '/avatar.jpg', status: 'online' },
    { user_id: 3, username: 'Charlie', avatar: null, status: 'idle' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getOnlineGuildMembers as any).mockResolvedValue(mockUsers);
  });

  it('renders loading state initially', () => {
    (apiService.getOnlineGuildMembers as any).mockImplementation(
      () => new Promise(() => {})
    );
    
    render(<Rooms_Online_List {...defaultProps} />);
    
    const loadingText = screen.getByText('Загрузка...');
    expect(loadingText).toBeDefined();
  });

  it('renders online users after loading', async () => {
    render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
    });
  });

  it('displays user status', async () => {
    render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      const onlineStatuses = screen.getAllByText('online');
      const idleStatus = screen.getByText('idle');
      expect(onlineStatuses.length).toBe(2);
      expect(idleStatus).toBeDefined();
    });
  });

  it('shows avatar image when user has avatar', async () => {
    render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      const img = screen.getByAltText('Bob');
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toBe('/avatar.jpg');
    });
  });

  it('shows placeholder with initials when no avatar', async () => {
    render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      // Ищем первый символ имени в uppercase
      const aliceInitial = screen.getByText('A');
      const charlieInitial = screen.getByText('C');
      expect(aliceInitial).toBeDefined();
      expect(charlieInitial).toBeDefined();
    });
  });

  it('shows "Нет пользователей в сети" when list is empty', async () => {
    (apiService.getOnlineGuildMembers as any).mockResolvedValue([]);
    
    render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Нет пользователей в сети')).toBeDefined();
    });
  });

  it('renders nothing when guildId is not provided', async () => {
    render(<Rooms_Online_List guildId={undefined} />);
    
    await waitFor(() => {
      expect(apiService.getOnlineGuildMembers).not.toHaveBeenCalled();
    });
    
    // Проверяем, что нет загрузки
    const loadingText = screen.queryByText('Загрузка...');
    expect(loadingText).toBeNull();
  });

  it('subscribes to guild on mount', async () => {
    render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(wsService.subscribeGuild).toHaveBeenCalledWith(1);
    });
  });

  it('unsubscribes from guild on unmount', async () => {
    const { unmount } = render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(wsService.subscribeGuild).toHaveBeenCalled();
    });
    
    unmount();
    
    expect(wsService.unsubscribeGuild).toHaveBeenCalledWith(1);
  });

  it('renders status dot with correct class for each status', async () => {
    const { container } = render(<Rooms_Online_List {...defaultProps} />);
    
    await waitFor(() => {
      const onlineDots = container.querySelectorAll('.status-online');
      const idleDots = container.querySelectorAll('.status-idle');
      expect(onlineDots.length).toBe(2);
      expect(idleDots.length).toBe(1);
    });
  });
});