import { useState, useCallback } from 'react';
import { ApiConfig, ApiResponse } from '../types';

export const useConductorApi = (config: ApiConfig) => {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (message: string): Promise<ApiResponse> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${config.baseUrl}${config.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          message,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`${config.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }, [config]);

  return {
    sendMessage,
    checkConnection,
    isLoading,
  };
};