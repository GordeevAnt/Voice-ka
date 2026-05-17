import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Search_Chanel } from './Search_Chanel';
import { apiService } from '../features/api.service';
import { storeAPI } from '../features/useStore';
import { wsService } from '../features/websocket.service';

vi.mock('../features/api.service', () => ({
  apiService: {
    findGuildById: vi.fn(),
    joinGuild: vi.fn(),
  },
}));

vi.mock('../features/useStore', () => ({
  storeAPI: {
    get: vi.fn(),
  },
}));

vi.mock('../features/websocket.service', () => ({
  wsService: {
    subscribeGuild: vi.fn(),
  },
}));

describe('Search_Chanel', () => {
  const defaultProps = {
    onGuildJoined: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (storeAPI.get as any).mockResolvedValue(123);
  });

  it('renders search button', () => {
    render(<Search_Chanel {...defaultProps} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDefined();
    expect(button.querySelector('img')?.getAttribute('src')).toBe('/grey-search.svg');
  });

  it('opens modal when search button is clicked', () => {
    render(<Search_Chanel {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByText('Поиск канала')).toBeDefined();
    expect(screen.getByPlaceholderText('Введите ID канала...')).toBeDefined();
  });

  it('closes modal when close button is clicked', () => {
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Поиск канала')).toBeDefined();
    
    fireEvent.click(screen.getByText('×'));
    expect(screen.queryByText('Поиск канала')).toBeNull();
  });

  it('closes modal when overlay is clicked', () => {
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Поиск канала')).toBeDefined();
    
    fireEvent.click(document.querySelector('.modal-overlay')!);
    expect(screen.queryByText('Поиск канала')).toBeNull();
  });

  it('shows error when searching with empty ID', async () => {
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      expect(screen.getByText('Введите ID канала')).toBeDefined();
    });
  });

  it('shows error when ID is not a number', async () => {
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      expect(screen.getByText('ID должен быть числом')).toBeDefined();
    });
  });

  it('searches for guild by ID', async () => {
    const mockGuild = {
      id: 123,
      name: 'Test Guild',
      icon: null,
      owner_id: 1,
      description: 'Test Description',
    };
    (apiService.findGuildById as any).mockResolvedValue(mockGuild);
    
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      expect(apiService.findGuildById).toHaveBeenCalledWith(123);
      expect(screen.getByText('Test Guild')).toBeDefined();
      expect(screen.getByText('ID: 123')).toBeDefined();
      expect(screen.getByText('Test Description')).toBeDefined();
    });
  });

  it('shows error when guild not found', async () => {
    (apiService.findGuildById as any).mockResolvedValue(null);
    
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      expect(screen.getByText('Канал с ID 999 не найден')).toBeDefined();
    });
  });

  it('joins guild successfully', async () => {
    const mockGuild = {
      id: 123,
      name: 'Test Guild',
      icon: null,
      owner_id: 1,
      description: null,
    };
    (apiService.findGuildById as any).mockResolvedValue(mockGuild);
    (apiService.joinGuild as any).mockResolvedValue(true);
    
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      expect(screen.getByText('Присоединиться к каналу')).toBeDefined();
    });
    
    fireEvent.click(screen.getByText('Присоединиться к каналу'));
    
    await waitFor(() => {
      expect(apiService.joinGuild).toHaveBeenCalledWith(123, 123);
      expect(wsService.subscribeGuild).toHaveBeenCalledWith(123);
      expect(defaultProps.onGuildJoined).toHaveBeenCalled();
    });
  });

  it('shows error when join fails', async () => {
    const mockGuild = {
      id: 123,
      name: 'Test Guild',
      icon: null,
      owner_id: 1,
      description: null,
    };
    (apiService.findGuildById as any).mockResolvedValue(mockGuild);
    (apiService.joinGuild as any).mockResolvedValue(false);
    
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Присоединиться к каналу'));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Не удалось присоединиться к каналу')).toBeDefined();
    });
  });

  it('shows default icon when guild has no icon', async () => {
    const mockGuild = {
      id: 123,
      name: 'Test Guild',
      icon: null,
      owner_id: 1,
      description: null,
    };
    (apiService.findGuildById as any).mockResolvedValue(mockGuild);
    
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByText('Найти'));
    
    await waitFor(() => {
      expect(screen.getByText('🎤')).toBeDefined();
    });
  });

  it('searches on Enter key press', async () => {
    const mockGuild = {
      id: 123,
      name: 'Test Guild',
      icon: null,
      owner_id: 1,
      description: null,
    };
    (apiService.findGuildById as any).mockResolvedValue(mockGuild);
    
    render(<Search_Chanel {...defaultProps} />);
    
    fireEvent.click(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('Введите ID канала...');
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
    
    await waitFor(() => {
      expect(apiService.findGuildById).toHaveBeenCalledWith(123);
    });
  });
});