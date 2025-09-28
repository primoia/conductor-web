import { ApiConfig } from '../types';

export class ConductorApiService {
  private baseUrl: string;

  constructor(private config: ApiConfig) {
    // Detecta automaticamente a URL base dependendo do ambiente
    const currentHost = window.location.hostname;

    // Verifica se existe uma variável de ambiente (Docker/produção)
    const envBaseUrl = import.meta.env.VITE_API_BASE_URL;

    if (envBaseUrl) {
      // Usa URL configurada via variável de ambiente (Docker)
      this.baseUrl = envBaseUrl;
    } else if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      // Desenvolvimento local - usa proxy
      this.baseUrl = '';  // Proxy do Vite irá redirecionar /api para localhost:5006
    } else {
      // Acesso via rede - usa o mesmo host que a aplicação
      this.baseUrl = `http://${currentHost}:5006`;
    }

    console.log(`[ConductorApiService] Detectado host: ${currentHost}, usando API Base URL: ${this.baseUrl || 'proxy'}`);
  }

  async sendMessage(
    message: string,
    onProgress?: (event: any) => void,
    onComplete?: (result: any) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      if (!this.config.streamEndpoint) {
        throw new Error('streamEndpoint not configured');
      }

      const startUrl = `${this.baseUrl}${this.config.streamEndpoint}`;
      console.log('Starting streaming execution:', startUrl);

      const startResponse = await fetch(startUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
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

      const streamUrl = `${this.baseUrl}/api/v1/stream/${job_id}`;
      console.log('Connecting to SSE stream:', streamUrl);

      const eventSource = new EventSource(streamUrl);
      let finalResult: any = null;
      let streamStarted = false;

      eventSource.onopen = () => {
        console.log(`SSE connection opened for job ${job_id}`);
        streamStarted = true;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('SSE Event received:', data.event, data);

          if (onProgress) {
            onProgress(data);
          }

          switch (data.event) {
            case 'result':
              finalResult = data.data;
              if (onComplete) {
                onComplete(finalResult);
              }
              break;
            case 'error':
              eventSource.close();
              if (onError) {
                onError(data.data?.error || 'Erro durante execução');
              }
              break;
          }
        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError);
        }
      };

      eventSource.addEventListener('end_of_stream', () => {
        console.log(`End of stream reached for job ${job_id}`);
        eventSource.close();
        if (onComplete && finalResult) {
          onComplete(finalResult);
        }
      });

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        if (!streamStarted && onError) {
          onError('SSE connection failed');
        }
      };

    } catch (error) {
      console.error('API Error:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }
}