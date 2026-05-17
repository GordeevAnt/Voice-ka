import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Message } from './Message';

describe('Message Component', () => {
  it('renders message with author, text and timestamp', () => {
    render(
      <Message
        id={1}
        author="Test User"
        text="Hello World"
        timestamp="2024-01-01 12:00"
        isCurrentUser={false}
      />
    );

    expect(screen.getByText('Test User')).toBeDefined();
    expect(screen.getByText('Hello World')).toBeDefined();
    expect(screen.getByText('2024-01-01 12:00')).toBeDefined();
  });

  it('shows avatar with first letter of author', () => {
    render(
      <Message
        id={1}
        author="John Doe"
        text="Test message"
        timestamp="2024-01-01 12:00"
        isCurrentUser={false}
      />
    );

    expect(screen.getByText('J')).toBeDefined();
  });

  it('shows question mark for empty author', () => {
    render(
      <Message
        id={1}
        author=""
        text="Test"
        timestamp="2024-01-01 12:00"
        isCurrentUser={false}
      />
    );

    expect(screen.getByText('?')).toBeDefined();
  });

  it('applies different class for current user messages', () => {
    const { container } = render(
      <Message
        id={1}
        author="Me"
        text="My message"
        timestamp="2024-01-01 12:00"
        isCurrentUser={true}
      />
    );

    const messageDiv = container.querySelector('.message');
    expect(messageDiv?.className).toContain('message-current-user');
  });

  it('does not apply current-user class for other users', () => {
    const { container } = render(
      <Message
        id={1}
        author="Other User"
        text="Their message"
        timestamp="2024-01-01 12:00"
        isCurrentUser={false}
      />
    );

    const messageDiv = container.querySelector('.message');
    expect(messageDiv?.className).not.toContain('message-current-user');
  });

  it('has correct id attribute', () => {
    render(
      <Message
        id={123}
        author="User"
        text="Test"
        timestamp="2024-01-01 12:00"
        isCurrentUser={false}
      />
    );

    const messageDiv = document.getElementById('123');
    expect(messageDiv).toBeDefined();
    expect(messageDiv?.className).toContain('message');
  });
});