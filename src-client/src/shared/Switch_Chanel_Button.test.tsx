import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Switch_Chanel_Button } from './Switch_Chanel_Button';
import { storeAPI } from '../features/useStore';
import { apiService } from '../features/api.service';

// Мокаем зависимости
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
    (apiService.getUserRolesInGuild as any).mockResolvedValue([]);
  });

  it('renders button with image', () => {
    render(<Switch_Chanel_Button {...defaultProps} />);
    
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('/test-icon.svg');
  });

  it('applies active class when isActive is true', () => {
    const { container } = render(
      <Switch_Chanel_Button {...defaultProps} isActive={true} />
    );
    
    const button = container.querySelector('.switch-chanel-btn');
    expect(button?.className).toContain('active');
  });

  it('does not apply active class when isActive is false', () => {
    const { container } = render(
      <Switch_Chanel_Button {...defaultProps} isActive={false} />
    );
    
    const button = container.querySelector('.switch-chanel-btn');
    expect(button?.className).not.toContain('active');
  });

  it('calls onSelect when clicked and not active', () => {
    const onSelectMock = vi.fn();
    render(
      <Switch_Chanel_Button {...defaultProps} isActive={false} onSelect={onSelectMock} />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(onSelectMock).toHaveBeenCalledWith(1);
  });

  it('does not call onSelect when clicked and active', () => {
    const onSelectMock = vi.fn();
    render(
      <Switch_Chanel_Button {...defaultProps} isActive={true} onSelect={onSelectMock} />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  it('is disabled when active', () => {
    render(<Switch_Chanel_Button {...defaultProps} isActive={true} />);
    
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('is disabled while loading roles', async () => {
    (apiService.getUserRolesInGuild as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<Switch_Chanel_Button {...defaultProps} isActive={false} />);
    
    const button = screen.getByRole('button');
    expect(button.hasAttribute('disabled')).toBe(true);
    
    await waitFor(() => {
      expect(button.hasAttribute('disabled')).toBe(false);
    });
  });

  it('loads user roles on mount', async () => {
    const mockRoles = [
      { id: 1, name: 'Admin', permissions: 8 },
      { id: 2, name: 'Member', permissions: 64 },
    ];
    (apiService.getUserRolesInGuild as any).mockResolvedValue(mockRoles);
    
    render(<Switch_Chanel_Button {...defaultProps} />);
    
    await waitFor(() => {
      expect(apiService.getUserRolesInGuild).toHaveBeenCalledWith(123, 1);
    });
  });

  it('shows loading indicator while fetching roles', () => {
    (apiService.getUserRolesInGuild as any).mockImplementation(
      () => new Promise(() => {})
    );
    
    render(<Switch_Chanel_Button {...defaultProps} />);
    
    expect(screen.getByText('...')).toBeDefined();
  });

  it('shows roles in title attribute', async () => {
    const mockRoles = [
      { id: 1, name: 'Admin', permissions: 8 },
      { id: 2, name: 'Moderator', permissions: 32 },
    ];
    (apiService.getUserRolesInGuild as any).mockResolvedValue(mockRoles);
    
    render(<Switch_Chanel_Button {...defaultProps} />);
    
    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button.getAttribute('title')).toBe('Admin, Moderator');
    });
  });

  it('saves roles to storage after loading', async () => {
    const mockRoles = [{ id: 1, name: 'Admin', permissions: 8 }];
    (apiService.getUserRolesInGuild as any).mockResolvedValue(mockRoles);
    
    render(<Switch_Chanel_Button {...defaultProps} />);
    
    await waitFor(() => {
      expect(storeAPI.set).toHaveBeenCalledWith(
        expect.stringContaining('guild_1_user_roles'),
        expect.objectContaining({
          roles: mockRoles,
          permissions: 8,
          hasAdmin: true,
        })
      );
    });
  });
});