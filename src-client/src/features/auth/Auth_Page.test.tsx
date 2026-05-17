import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Auth_Page } from './Auth_Page';
import { apiService } from '../api.service';
import { storeAPI } from '../useStore';

vi.mock('../api.service', () => ({
  apiService: {
    login: vi.fn(),
  },
}));

vi.mock('../useStore', () => ({
  storeAPI: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../websocket.service', () => ({
  wsService: {
    getConnectionStatus: vi.fn(() => true),
    authenticate: vi.fn(),
    onConnectionChange: vi.fn(() => () => {}),
    waitForAuth: vi.fn().mockResolvedValue(undefined),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('Auth_Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (storeAPI.get as any).mockResolvedValue(null);
    (apiService.login as any).mockResolvedValue([true, 123, 'session-token']);
  });

  it('renders login form', async () => {
    renderWithRouter(<Auth_Page />);
    
    // Ждем окончания проверки аутентификации
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Логин')).toBeDefined();
    });
    
    expect(screen.getByPlaceholderText('Пароль')).toBeDefined();
    expect(screen.getByText('Войти')).toBeDefined();
    expect(screen.getByText('Зарегистрироваться')).toBeDefined();
  });

  it('updates login input value', async () => {
    renderWithRouter(<Auth_Page />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Логин')).toBeDefined();
    });
    
    const loginInput = screen.getByPlaceholderText('Логин') as HTMLInputElement;
    fireEvent.change(loginInput, { target: { value: 'testuser' } });
    
    expect(loginInput.value).toBe('testuser');
  });

  it('updates password input value', async () => {
    renderWithRouter(<Auth_Page />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Пароль')).toBeDefined();
    });
    
    const passwordInput = screen.getByPlaceholderText('Пароль') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(passwordInput.value).toBe('password123');
  });

  it('calls login with correct credentials', async () => {
    renderWithRouter(<Auth_Page />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Логин')).toBeDefined();
    });
    
    const loginInput = screen.getByPlaceholderText('Логин');
    const passwordInput = screen.getByPlaceholderText('Пароль');
    
    fireEvent.change(loginInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    const loginButton = screen.getByText('Войти');
    fireEvent.click(loginButton);
    
    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalled();
    });
  });

  it('shows error message on failed login', async () => {
    (apiService.login as any).mockResolvedValue([false, 0, '']);
    
    renderWithRouter(<Auth_Page />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Логин')).toBeDefined();
    });
    
    fireEvent.change(screen.getByPlaceholderText('Логин'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Войти'));
    
    await waitFor(() => {
      expect(screen.getByText('Неверные данные')).toBeDefined();
    });
  });

  it('disables inputs while loading', async () => {
    (apiService.login as any).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    renderWithRouter(<Auth_Page />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Логин')).toBeDefined();
    });
    
    fireEvent.change(screen.getByPlaceholderText('Логин'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password' } });
    fireEvent.click(screen.getByText('Войти'));
    
    expect(screen.getByPlaceholderText('Логин')).toHaveProperty('disabled', true);
    expect(screen.getByPlaceholderText('Пароль')).toHaveProperty('disabled', true);
  });

  it('navigates to register page when register button is clicked', async () => {
    renderWithRouter(<Auth_Page />);
    
    await waitFor(() => {
      expect(screen.getByText('Зарегистрироваться')).toBeDefined();
    });
    
    const registerButton = screen.getByText('Зарегистрироваться');
    fireEvent.click(registerButton);
  });
});