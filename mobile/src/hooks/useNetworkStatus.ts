import { useEffect, useState, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import { useSyncQueue } from '../store/useSyncQueue';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const { pendingMessages, updateMessageStatus, removePendingMessage, incrementRetryCount } = useSyncQueue();
  const isSyncingRef = useRef(false);

  const checkNetwork = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setIsConnected(!!networkState.isConnected && !!networkState.isInternetReachable);
    } catch (e) {
      console.warn('Network check failed', e);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkNetwork();

    // Polling since expo-network doesn't have an event listener for changes
    // in the same way NetInfo does, but for a basic foreground check this works.
    const interval = setInterval(() => {
      checkNetwork();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const syncMessages = useCallback(async () => {
    if (!isConnected || pendingMessages.length === 0 || isSyncingRef.current) return;

    isSyncingRef.current = true;
    try {
      const messagesToSync = pendingMessages.filter((m) => m.syncStatus === 'pending' || m.syncStatus === 'failed');

      for (const msg of messagesToSync) {
        if (msg.syncRetryCount > 5) continue; // Max retries
        
        updateMessageStatus(msg.id, 'syncing');
        try {
          // Here we would actually call our API. For V1 we mock a success push.
          // await api.post('/messages', msg);
          
          // Simulating network delay
          await new Promise((resolve, reject) => setTimeout(resolve, 500));
          
          // Remove from queue on success
          removePendingMessage(msg.id);
        } catch (error) {
          updateMessageStatus(msg.id, 'failed');
          incrementRetryCount(msg.id);
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [isConnected, pendingMessages, updateMessageStatus, removePendingMessage, incrementRetryCount]);

  useEffect(() => {
    if (isConnected && pendingMessages.length > 0) {
      syncMessages();
    }
  }, [isConnected, pendingMessages.length, syncMessages]);

  return { isConnected, syncMessages };
};
