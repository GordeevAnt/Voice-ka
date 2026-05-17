import { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Renders a React component with necessary providers for testing
 */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>
  );
}

/**
 * Mock data for testing components
 */
export const mockMessages = [
  {
    id: '1',
    content: 'Hello, this is a test message',
    sender: 'User1',
    timestamp: '2024-01-01T12:00:00Z',
  },
  {
    id: '2',
    content: 'Another test message here',
    sender: 'User2',
    timestamp: '2024-01-01T12:05:00Z',
  },
  {
    id: '3',
    content: 'Third message with longer content to test rendering',
    sender: 'User3',
    timestamp: '2024-01-01T12:10:00Z',
  },
];

export const mockChannels = [
  { id: '1', name: 'General', unread: 3 },
  { id: '2', name: 'Random', unread: 0 },
  { id: '3', name: 'Help', unread: 1 },
];

export const mockRooms = [
  { id: '1', name: 'Room 1', online: 5 },
  { id: '2', name: 'Room 2', online: 2 },
  { id: '3', name: 'Room 3', online: 0 },
];

/**
 * Sleep utility for waiting in tests
 */
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}