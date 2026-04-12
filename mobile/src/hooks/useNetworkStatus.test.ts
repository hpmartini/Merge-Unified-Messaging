import { renderHook, act } from '@testing-library/react-native';
import { useNetworkStatus } from './useNetworkStatus';
import * as Network from 'expo-network';
import { useSyncQueue } from '../store/useSyncQueue';

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
}));

jest.mock('../store/useSyncQueue', () => {
  const actual = jest.requireActual('../store/useSyncQueue');
  return {
    ...actual,
    useSyncQueue: jest.fn(),
  };
});

describe('useNetworkStatus', () => {
  let mockUpdateMessageStatus: jest.Mock;
  let mockRemovePendingMessage: jest.Mock;
  let mockIncrementRetryCount: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });

    mockUpdateMessageStatus = jest.fn();
    mockRemovePendingMessage = jest.fn();
    mockIncrementRetryCount = jest.fn();

    (useSyncQueue as unknown as jest.Mock).mockReturnValue({
      pendingMessages: [],
      updateMessageStatus: mockUpdateMessageStatus,
      removePendingMessage: mockRemovePendingMessage,
      incrementRetryCount: mockIncrementRetryCount,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('checks network on mount', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    
    await act(async () => {
      jest.advanceTimersByTime(100);
      // Wait for promises to resolve
      await Promise.resolve();
    });

    expect(Network.getNetworkStateAsync).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(true);
  });

  it('syncs pending messages when connected', async () => {
    (useSyncQueue as unknown as jest.Mock).mockReturnValue({
      pendingMessages: [{ id: 'msg-1', syncStatus: 'pending', syncRetryCount: 0 }],
      updateMessageStatus: mockUpdateMessageStatus,
      removePendingMessage: mockRemovePendingMessage,
      incrementRetryCount: mockIncrementRetryCount,
    });

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      // initial mount triggers effect
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
    
    await act(async () => {
      const syncPromise = result.current.syncMessages();
      jest.advanceTimersByTime(500); // simulate network delay
      await syncPromise;
    });

    expect(mockUpdateMessageStatus).toHaveBeenCalledWith('msg-1', 'syncing');
    expect(mockRemovePendingMessage).toHaveBeenCalledWith('msg-1');
  });
});
