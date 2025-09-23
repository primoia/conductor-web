import { useState, useCallback, useMemo } from 'react';
import { ApiConfig } from '../types';
import { ConductorApiService } from '../services';

export const useConductorApi = (config: ApiConfig) => {
  const [isLoading, setIsLoading] = useState(false);

  const apiService = useMemo(() => new ConductorApiService(config), [config]);

  const sendMessage = useCallback(async (
    message: string,
    onProgress?: (event: any) => void,
    onComplete?: (result: any) => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    setIsLoading(true);

    const wrappedOnComplete = (result: any) => {
      setIsLoading(false);
      if (onComplete) {
        onComplete(result);
      }
    };

    const wrappedOnError = (error: string) => {
      setIsLoading(false);
      if (onError) {
        onError(error);
      }
    };

    await apiService.sendMessage(message, onProgress, wrappedOnComplete, wrappedOnError);
  }, [apiService]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    return await apiService.checkConnection();
  }, [apiService]);

  return {
    sendMessage,
    checkConnection,
    isLoading,
  };
};