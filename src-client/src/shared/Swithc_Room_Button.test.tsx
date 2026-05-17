import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch_Room_Button } from './Switch_Room_Button';

describe('Switch_Room_Button', () => {
  it('renders room name correctly', () => {
    render(
      <Switch_Room_Button
        roomId={1}
        name="General Chat"
        isActive={false}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('General Chat')).toBeDefined();
  });

  it('renders room icon', () => {
    render(
      <Switch_Room_Button
        roomId={1}
        name="General Chat"
        isActive={false}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('#')).toBeDefined();
  });

  it('applies active class when isActive is true', () => {
    const { container } = render(
      <Switch_Room_Button
        roomId={1}
        name="Active Room"
        isActive={true}
        onSelect={vi.fn()}
      />
    );

    const wrapper = container.querySelector('.switch-room-wrapper');
    expect(wrapper?.className).toContain('active');
  });

  it('does not apply active class when isActive is false', () => {
    const { container } = render(
      <Switch_Room_Button
        roomId={1}
        name="Inactive Room"
        isActive={false}
        onSelect={vi.fn()}
      />
    );

    const wrapper = container.querySelector('.switch-room-wrapper');
    expect(wrapper?.className).not.toContain('active');
  });

  it('calls onSelect when clicked and not active', () => {
    const onSelectMock = vi.fn();
    
    render(
      <Switch_Room_Button
        roomId={42}
        name="Clickable Room"
        isActive={false}
        onSelect={onSelectMock}
      />
    );

    const element = screen.getByText('Clickable Room').parentElement?.parentElement;
    if (element) {
      fireEvent.click(element);
    }

    expect(onSelectMock).toHaveBeenCalledWith(42);
  });

  it('does not call onSelect when clicked and active', () => {
    const onSelectMock = vi.fn();
    
    render(
      <Switch_Room_Button
        roomId={42}
        name="Active Room"
        isActive={true}
        onSelect={onSelectMock}
      />
    );

    const element = screen.getByText('Active Room').parentElement?.parentElement;
    if (element) {
      fireEvent.click(element);
    }

    expect(onSelectMock).not.toHaveBeenCalled();
  });

  it('has pointer cursor when not active', () => {
    const { container } = render(
      <Switch_Room_Button
        roomId={1}
        name="Room"
        isActive={false}
        onSelect={vi.fn()}
      />
    );

    const wrapper = container.querySelector('.switch-room-wrapper');
    expect(wrapper?.getAttribute('style')).toContain('cursor: pointer');
  });

  it('has default cursor when active', () => {
    const { container } = render(
      <Switch_Room_Button
        roomId={1}
        name="Active Room"
        isActive={true}
        onSelect={vi.fn()}
      />
    );

    const wrapper = container.querySelector('.switch-room-wrapper');
    expect(wrapper?.getAttribute('style')).toContain('cursor: default');
  });
});