import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Logined_Layout } from './Logined_Layout';
import { storeAPI } from '../features/useStore';

vi.mock('../features/useStore', () => ({
  storeAPI: {
    get: vi.fn(),
  },
}));

describe('Logined_Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading while checking auth', () => {
    (storeAPI.get as any).mockImplementation(
      () => new Promise(() => {})
    );
    
    render(
      <MemoryRouter initialEntries={['/main']}>
        <Routes>
          <Route element={<Logined_Layout />}>
            <Route path="/main" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Проверка авторизации...')).toBeDefined();
  });

  it('redirects to login when not authenticated', async () => {
    (storeAPI.get as any).mockResolvedValue(null);
    
    render(
      <MemoryRouter initialEntries={['/main']}>
        <Routes>
          <Route element={<Logined_Layout />}>
            <Route path="/main" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined();
    });
  });

  it('shows protected content when authenticated', async () => {
    (storeAPI.get as any).mockResolvedValue('valid-token');
    
    render(
      <MemoryRouter initialEntries={['/main']}>
        <Routes>
          <Route element={<Logined_Layout />}>
            <Route path="/main" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeDefined();
    });
  });
});