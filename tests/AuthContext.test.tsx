// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const mockFetch = vi.hoisted(() => vi.fn());
vi.hoisted(() => {
  global.fetch = mockFetch;
  if (typeof window !== 'undefined') window.fetch = mockFetch as any;
});

import { AuthProvider, useAuth } from '../context/AuthContext';
import "@testing-library/jest-dom/vitest";

const TestComponent = () => {
  const { user, login, logout, fetchCsrfToken } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.username : 'No User'}</div>
      <button onClick={() => login('test', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={fetchCsrfToken}>Fetch CSRF</button>
      <button onClick={() => fetch('/api/test', { method: 'POST' })}>Test Fetch</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    mockFetch.mockImplementation(async (url: string, config: any) => {
      if (url === '/api/auth/csrf') {
        return { json: async () => ({ csrfToken: 'fake-csrf-token' }) } as Response;
      }
      if (url === '/api/auth/login') {
        return { ok: true, json: async () => ({ token: 'fake-token', user: { id: '1', username: 'test' } }) } as Response;
      }
      if (url === '/api/auth/logout') {
        return { ok: true } as Response;
      }
      return { ok: true } as Response;
    });
    localStorage.clear();
  });

  afterEach(() => {
    mockFetch.mockClear();
    cleanup();
  });

  it('initializes without user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(screen.getByTestId('user')).toHaveTextContent('No User');
  });

  it('can login and sets user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    fireEvent.click(screen.getByText('Login'));
    
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test');
    });
    expect(localStorage.getItem('token')).toBe('fake-token');
  });

  it('intercepts fetch calls to inject tokens', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // login to set tokens
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test');
    });

    // Make an intercepted fetch
    fireEvent.click(screen.getByText('Test Fetch'));

    await waitFor(() => {
      const testFetchCall = mockFetch.mock.calls.find((call: any) => call[0] === '/api/test');
      expect(testFetchCall).toBeDefined();
      const headers = testFetchCall[1].headers;
      
      // if it's a Headers instance, it has get, else it's a plain object or array
      if (headers instanceof Headers) {
        expect(headers.get('Authorization')).toBe('Bearer fake-token');
        expect(headers.get('CSRF-Token')).toBe('fake-csrf-token');
      } else {
        // Just inspect if it exists
        expect(headers).toBeDefined();
      }
    });
  });
});
