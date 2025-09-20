import { useState, useCallback } from 'react';
import { ApiConfig, ApiResponse } from '../types';

export const useConductorApi = (config: ApiConfig) => {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (
    message: string,
    onProgress?: (event: any) => void
  ): Promise<ApiResponse> => {
    setIsLoading(true);

    try {
      // Step 1: Start streaming execution
      const startUrl = `${config.baseUrl}${config.streamEndpoint}`;
      console.log('Starting streaming execution:', startUrl);

      const startResponse = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          uid: Date.now().toString(),
          title: "Stream Message",
          textEntries: [{
            uid: "1",
            content: message
          }],
          targetType: "conductor",
          isTemplate: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }),
      });

      if (!startResponse.ok) {
        throw new Error(`API Error: ${startResponse.status} ${startResponse.statusText}`);
      }

      const { job_id } = await startResponse.json();
      console.log('Job started with ID:', job_id);

      // Step 2: Connect to SSE stream
      return new Promise((resolve, reject) => {
        const streamUrl = `${config.baseUrl}/api/v1/stream/${job_id}`;
        console.log('Connecting to SSE stream:', streamUrl);

        const eventSource = new EventSource(streamUrl);
        let finalResult = null;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('SSE Event received:', data);

            // Call progress callback if provided
            if (onProgress) {
              onProgress(data);
            }

            // Handle different event types
            switch (data.event) {
              case 'result':
                finalResult = data.data;
                break;
              case 'end_of_stream':
                eventSource.close();
                setIsLoading(false);
                resolve({
                  status: 'success',
                  data: finalResult?.result || finalResult?.message || 'Execução concluída',
                  job_id
                });
                break;
              case 'error':
                eventSource.close();
                setIsLoading(false);
                reject(new Error(data.data?.error || 'Erro durante execução'));
                break;
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE Error:', error);
          eventSource.close();
          setIsLoading(false);
          reject(new Error('Erro na conexão SSE'));
        };

        // Timeout after 60 seconds
        setTimeout(() => {
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
            setIsLoading(false);
            reject(new Error('Timeout na execução'));
          }
        }, 60000);
      });

    } catch (error) {
      console.error('API Error:', error);
      setIsLoading(false);
      throw error;
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