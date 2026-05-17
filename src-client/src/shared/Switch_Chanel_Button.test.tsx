import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Switch_Chanel_Button } from './Switch_Chanel_Button';
import { storeAPI } from '../features/useStore';
import { apiService } from '../features/api.service';

vi.mock('../features/useStore', () => ({
  storeAPI: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../features/api.service', () => ({
  apiService: {
    getUserRolesInGuild: vi.fn(),
  },
}));

describe('Switch_Chanel_Button', () => {
  const defaultProps = {
    guildId: 1,
    icon: '/test-icon.svg',
    isActive: false,
    onSelect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (storeAPI.get as any).mockResolvedValue(123);
    // Мок для ролей - возвращаем пустой массив
    (apiService.getUserRolesInGuild as any).mockResolvedValue([]);
  });

  it('renders button with image', async () => {
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} />);
    });
    
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('/test-icon.svg');
  });

  it('applies active class when isActive is true', async () => {
    const { container } = await act(async () => {
      return render(
        <Switch_Chanel_Button {...defaultProps} isActive={true} />
      );
    });
    
    const button = container.querySelector('.switch-chanel-btn');
    expect(button?.className).toContain('active');
  });

  it('does not apply active class when isActive is false', async () => {
    const { container } = await act(async () => {
      return render(
        <Switch_Chanel_Button {...defaultProps} isActive={false} />
      );
    });
    
    const button = container.querySelector('.switch-chanel-btn');
    expect(button?.className).not.toContain('active');
  });

  it('calls onSelect when clicked and not active', async () => {
    const onSelectMock = vi.fn();
    
    await act(async () => {
      render(
        <Switch_Chanel_Button {...defaultProps} isActive={false} onSelect={onSelectMock} />
      );
    });
    
    // Ждем завершения загрузки ролей
    await waitFor(() => {
      expect(apiService.getUserRolesInGuild).toHaveBeenCalled();
    });
    
    const button = screen.getByRole('button');
    
    await act(async () => {
      fireEvent.click(button);
    });
    
    expect(onSelectMock).toHaveBeenCalledWith(1);
  });

  it('does not call onSelect when clicked and active', async () => {
    const onSelectMock = vi.fn();
    
    await act(async () => {
      render(
        <Switch_Chanel_Button {...defaultProps} isActive={true} onSelect={onSelectMock} />
      );
    });
    
    const button = screen.getByRole('button');
    
    await act(async () => {
      fireEvent.click(button);
    });
    
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  it('is disabled when active', async () => {
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} isActive={true} />);
    });
    
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('is disabled while loading roles', async () => {
    (apiService.getUserRolesInGuild as any).mockImplementation(
      () => new Promise(() => {})
    );
    
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} isActive={false} />);
    });
    
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('loads user roles on mount', async () => {
    const mockRoles = [
      { id: 1, name: 'Admin', permissions: 8 },
      { id: 2, name: 'Member', permissions: 64 },
    ];
    (apiService.getUserRolesInGuild as any).mockResolvedValue(mockRoles);
    
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(apiService.getUserRolesInGuild).toHaveBeenCalled();
    });
  });

  it('shows loading indicator while fetching roles', async () => {
    (apiService.getUserRolesInGuild as any).mockImplementation(
      () => new Promise(() => {})
    );
    
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} />);
    });
    
    const loadingIndicator = screen.getByText('...');
    expect(loadingIndicator).toBeDefined();
  });

  it('shows roles in title attribute', async () => {
    const mockRoles = [
      { id: 1, name: 'Admin', permissions: 8 },
      { id: 2, name: 'Moderator', permissions: 32 },
    ];
    (apiService.getUserRolesInGuild as any).mockResolvedValue(mockRoles);
    
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} />);
    });
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      const title = button.getAttribute('title');
      expect(title).toContain('Admin');
      expect(title).toContain('Moderator');
    });
  });

  it('saves roles to storage after loading', async () => {
    const mockRoles = [{ id: 1, name: 'Admin', permissions: 8 }];
    (apiService.getUserRolesInGuild as any).mockResolvedValue(mockRoles);
    
    await act(async () => {
      render(<Switch_Chanel_Button {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(storeAPI.set).toHaveBeenCalledWith(
        expect.stringContaining('guild_1_user_roles'),
        expect.objectContaining({
          roles: mockRoles,
          permissions: 8,
        })
      );
    });
  });
});