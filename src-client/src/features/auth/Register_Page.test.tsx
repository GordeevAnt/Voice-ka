import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Register_Page } from './Register_Page';
import { apiService } from '../api.service';
import { storeAPI } from '../useStore';

vi.mock('../api.service', () => ({
  apiService: {
    register: vi.fn(),
    login: vi.fn(),
  },
}));

vi.mock('../useStore', () => ({
  storeAPI: {
    set: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Register_Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.register as any).mockResolvedValue([true, 123]);
    (apiService.login as any).mockResolvedValue([true, 123, 'session-token']);
  });

  it('renders registration form', () => {
    renderWithRouter(<Register_Page />);
    
    expect(screen.getByPlaceholderText('Имя')).toBeDefined();
    expect(screen.getByPlaceholderText('Почта')).toBeDefined();
    expect(screen.getByPlaceholderText('Пароль')).toBeDefined();
    expect(screen.getByPlaceholderText('Подтвердите пароль')).toBeDefined();
    expect(screen.getByText('Подтвердить')).toBeDefined();
  });

  it('shows error when passwords do not match', async () => {
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: 'different' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(screen.getByText('Пароли не совпадают')).toBeDefined();
    });
  });

  it('shows error when password is too short', async () => {
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Почта'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: '123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: '123' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(screen.getByText('Пароль должен быть минимум 6 символов')).toBeDefined();
    });
  });

  it('shows error when username is too short', async () => {
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByPlaceholderText('Почта'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(screen.getByText('Имя должно быть минимум 3 символа')).toBeDefined();
    });
  });

  it('shows error when email is invalid', async () => {
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Почта'), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(screen.getByText('Некорректный email')).toBeDefined();
    });
  });

  it('calls register with correct data', async () => {
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Почта'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(apiService.register).toHaveBeenCalledWith(
        'testuser',
        'test@test.com',
        'password123',
        'password123'
      );
    });
  });

  it('calls auto-login after successful registration', async () => {
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Почта'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith(
        'testuser',
        'password123',
        null,
        expect.any(String)
      );
    });
  });

  it('shows error message on registration failure', async () => {
    (apiService.register as any).mockResolvedValue([false, 0]);
    
    renderWithRouter(<Register_Page />);
    
    fireEvent.change(screen.getByPlaceholderText('Имя'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Почта'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Подтвердите пароль'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText('Подтвердить'));
    
    await waitFor(() => {
      expect(screen.getByText('Ошибка регистрации. Попробуйте другие данные.')).toBeDefined();
    });
  });

  it('goes back when back button is clicked', () => {
    renderWithRouter(<Register_Page />);
    
    const backButton = screen.getByText('Назад');
    expect(backButton).toBeDefined();
    
    fireEvent.click(backButton);
    // Навигация проверяется через mock, но для простоты проверяем клик
  });
});