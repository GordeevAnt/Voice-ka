import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Rooms_List } from './Rooms_List';
import { apiService } from '../features/api.service';
import { storeAPI } from '../features/useStore';
import { wsService } from '../features/websocket.service';
import { useUserPermissions } from '../features/useUserPermissions';

vi.mock('../features/api.service', () => ({
  apiService: {
    getGuildRooms: vi.fn(),
  },
}));

vi.mock('../features/useStore', () => ({
  storeAPI: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../features/websocket.service', () => ({
  wsService: {
    waitForAuth: vi.fn().mockResolvedValue(undefined),
    subscribeGuild: vi.fn(),
    unsubscribeGuild: vi.fn(),
    on: vi.fn(() => () => {}),
    request: vi.fn(),
  },
}));

vi.mock('../features/useUserPermissions', () => ({
  useUserPermissions: vi.fn(),
}));

describe('Rooms_List', () => {
  const defaultProps = {
    guildId: 1,
    currentRoomId: undefined,
    onRoomSelect: vi.fn(),
  };

  const mockRooms = [
    { id: 1, name: 'general', room_type: 'text', guild_id: 1, topic: null, member_count: null, created_at: '', updated_at: '' },
    { id: 2, name: 'random', room_type: 'text', guild_id: 1, topic: null, member_count: null, created_at: '', updated_at: '' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getGuildRooms as any).mockResolvedValue(mockRooms);
    (useUserPermissions as any).mockReturnValue({
      hasCreateRooms: true,
      isLoading: false,
    });
  });

  it('renders loading state initially', () => {
    (apiService.getGuildRooms as any).mockImplementation(
      () => new Promise(() => {})
    );
    
    render(<Rooms_List {...defaultProps} />);
    
    expect(screen.getByText('Загрузка комнат...')).toBeDefined();
  });

  it('renders rooms list after loading', async () => {
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('general')).toBeDefined();
      expect(screen.getByText('random')).toBeDefined();
    });
  });

  it('shows "Нет текстовых комнат" when no rooms', async () => {
    (apiService.getGuildRooms as any).mockResolvedValue([]);
    
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Нет текстовых комнат')).toBeDefined();
    });
  });

  it('shows create room button when user has permission', async () => {
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Создать')).toBeDefined();
    });
  });

  it('does not show create room button when user lacks permission', async () => {
    (useUserPermissions as any).mockReturnValue({
      hasCreateRooms: false,
      isLoading: false,
    });
    
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.queryByText('Создать')).toBeNull();
    });
  });

  it('opens create room modal when create button is clicked', async () => {
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Создать'));
    });
    
    expect(screen.getByText('Создать комнату')).toBeDefined();
    expect(screen.getByPlaceholderText('Название комнаты')).toBeDefined();
  });

  it('closes create room modal on cancel', async () => {
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Создать'));
    });
    
    expect(screen.getByText('Создать комнату')).toBeDefined();
    
    fireEvent.click(screen.getByText('Отмена'));
    
    await waitFor(() => {
      expect(screen.queryByText('Создать комнату')).toBeNull();
    });
  });

  it('handles room selection', async () => {
    const onRoomSelect = vi.fn();
    render(<Rooms_List {...defaultProps} onRoomSelect={onRoomSelect} />);
    
    await waitFor(() => {
      const roomButton = screen.getByText('general').closest('.switch-room-wrapper');
      fireEvent.click(roomButton!);
    });
    
    expect(onRoomSelect).toHaveBeenCalledWith(1);
  });

  it('highlights active room', async () => {
    render(<Rooms_List {...defaultProps} currentRoomId={1} />);
    
    await waitFor(() => {
      const activeRoom = document.querySelector('.switch-room-wrapper.active');
      expect(activeRoom).toBeDefined();
    });
  });

  it('subscribes to guild on mount', async () => {
    render(<Rooms_List {...defaultProps} />);
    
    await waitFor(() => {
      expect(wsService.subscribeGuild).toHaveBeenCalledWith(1);
    });
  });
});