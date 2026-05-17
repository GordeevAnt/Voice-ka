import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Logout } from './Logout';
import { storeAPI } from '../useStore';
import { apiService } from '../api.service';

vi.mock('../useStore', () => ({
  storeAPI: {
    get: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../api.service', () => ({
  apiService: {
    logout: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (storeAPI.get as any).mockResolvedValue(123);
    (apiService.logout as any).mockResolvedValue(true);
  });

  it('renders logout button', () => {
    renderWithRouter(<Logout />);
    
    expect(screen.getByText('Выйти')).toBeDefined();
  });

  it('calls logout on click', async () => {
    renderWithRouter(<Logout />);
    
    fireEvent.click(screen.getByText('Выйти'));
    
    await waitFor(() => {
      expect(apiService.logout).toHaveBeenCalledWith(123, null);
      expect(storeAPI.clear).toHaveBeenCalled();
    });
  });

  it('handles logout when no user ID', async () => {
    (storeAPI.get as any).mockResolvedValue(null);
    
    renderWithRouter(<Logout />);
    
    fireEvent.click(screen.getByText('Выйти'));
    
    await waitFor(() => {
      expect(apiService.logout).not.toHaveBeenCalled();
      expect(storeAPI.clear).toHaveBeenCalled();
    });
  });

  it('clears store even if logout fails', async () => {
    (apiService.logout as any).mockRejectedValue(new Error('Network error'));
    
    renderWithRouter(<Logout />);
    
    fireEvent.click(screen.getByText('Выйти'));
    
    await waitFor(() => {
      expect(storeAPI.clear).toHaveBeenCalled();
    });
  });
});