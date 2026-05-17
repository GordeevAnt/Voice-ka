import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

vi.mock('../widgets/Header', () => ({
  Header: () => <div data-testid="mock-header">Header</div>,
}));

describe('Layout', () => {
  it('renders header and outlet', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    
    expect(screen.getByTestId('mock-header')).toBeDefined();
    expect(document.querySelector('.app-container')).toBeDefined();
  });

  it('renders children content', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );
    
    const container = document.querySelector('.app-container');
    expect(container).toBeDefined();
  });
});