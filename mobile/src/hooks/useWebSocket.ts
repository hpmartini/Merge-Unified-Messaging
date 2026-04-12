import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { wsService } from '../services/websocket';

export const useWebSocket = () => {
  useEffect(() => {
    wsService.connect();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        wsService.connect();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        wsService.disconnect();
      }
    });

    return () => {
      subscription.remove();
      wsService.disconnect();
    };
  }, []);
};
