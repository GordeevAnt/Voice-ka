import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from './Header';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { apiService } from '../features/api.service';
import { storeAPI } from '../features/useStore';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(),
}));

vi.mock('../features/api.service', () => ({
  apiService: {
    logout: vi.fn(),
  },
}));

vi.mock('../features/useStore', () => ({
  storeAPI: {
    get: vi.fn(),
    clear: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Header', () => {
  const mockWindow = {
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    isMaximized: vi.fn(),
    close: vi.fn(),
    onResized: vi.fn(() => Promise.resolve(() => {})),
    onMoved: vi.fn(() => Promise.resolve(() => {})),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentWindow as any).mockReturnValue(mockWindow);
    mockWindow.isMaximized.mockResolvedValue(false);
    (storeAPI.get as any).mockResolvedValue(123);
  });

  it('renders title and buttons', () => {
    render(<Header />);
    
    expect(screen.getByText('Voice-ka')).toBeDefined();
    expect(screen.getByText('–')).toBeDefined();
  });

  it('minimizes window when minimize button is clicked', async () => {
    render(<Header />);
    
    const minimizeBtn = screen.getByText('–');
    fireEvent.click(minimizeBtn);
    
    expect(mockWindow.minimize).toHaveBeenCalled();
  });

  it('maximizes window when maximize button is clicked', async () => {
    render(<Header />);
    
    const maximizeBtn = screen.getAllByRole('button')[1];
    fireEvent.click(maximizeBtn);
    
    expect(mockWindow.toggleMaximize).toHaveBeenCalled();
  });

  it('shows maximize icon when window is not maximized', async () => {
    mockWindow.isMaximized.mockResolvedValue(false);
    
    render(<Header />);
    
    await waitFor(() => {
      const img = screen.getByAltText('Maximize');
      expect(img).toBeDefined();
    });
  });

  it('shows restore icon when window is maximized', async () => {
    mockWindow.isMaximized.mockResolvedValue(true);
    
    render(<Header />);
    
    await waitFor(() => {
      const img = screen.getByAltText('Restore');
      expect(img).toBeDefined();
    });
  });

  it('calls logout and closes window on close button click', async () => {
    (apiService.logout as any).mockResolvedValue(true);
    
    render(<Header />);
    
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    
    await waitFor(() => {
      expect(apiService.logout).toHaveBeenCalled();
      expect(mockWindow.close).toHaveBeenCalled();
    });
  });

  it('handles close even when logout fails', async () => {
    (apiService.logout as any).mockRejectedValue(new Error('Network error'));
    
    render(<Header />);
    
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    
    await waitFor(() => {
      expect(mockWindow.close).toHaveBeenCalled();
    });
  });

  it('disables close button while logging out', async () => {
    (apiService.logout as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<Header />);
    
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    
    expect(closeBtn.hasAttribute('disabled')).toBe(true);
  });
});