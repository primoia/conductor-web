import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ApiConfig, StreamEvent, ApiResponse } from '../models/chat.models';

@Injectable({
  providedIn: 'root'
})
export class ConductorApiService {
  private baseUrl: string;

  constructor() {
    // Detecta automaticamente a URL base dependendo do ambiente
    const currentHost = window.location.hostname;

    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      // Desenvolvimento local - usa proxy ou porta específica
      this.baseUrl = 'http://localhost:5006';
    } else {
      // Acesso via rede - usa o mesmo host que a aplicação
      this.baseUrl = `http://${currentHost}:5006`;
    }

    console.log(`[ConductorApiService] Detectado host: ${currentHost}, usando API Base URL: ${this.baseUrl}`);
  }

  sendMessage(
    message: string,
    config: ApiConfig
  ): Observable<StreamEvent | ApiResponse> {
    const subject = new Subject<StreamEvent | ApiResponse>();

    const executeStream = async () => {
      try {
        if (!config.streamEndpoint) {
          throw new Error('streamEndpoint not configured');
        }

        const startUrl = `${this.baseUrl}${config.streamEndpoint}`;
        console.log('Starting streaming execution:', startUrl);

        const startResponse = await fetch(startUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.apiKey,
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

            subject.next(data);

            switch (data.event) {
              case 'result':
                finalResult = data.data;
                subject.next({ success: true, data: finalResult });
                break;
              case 'error':
                eventSource.close();
                subject.error(data.data?.error || 'Erro durante execução');
                break;
            }
          } catch (parseError) {
            console.error('Error parsing SSE data:', parseError);
          }
        };

        eventSource.addEventListener('end_of_stream', () => {
          console.log(`End of stream reached for job ${job_id}`);
          eventSource.close();
          if (finalResult) {
            subject.next({ success: true, data: finalResult });
          }
          subject.complete();
        });

        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          eventSource.close();
          if (!streamStarted) {
            subject.error('SSE connection failed');
          }
        };

      } catch (error) {
        console.error('API Error:', error);
        subject.error(error instanceof Error ? error.message : 'Erro desconhecido');
      }
    };

    executeStream();
    return subject.asObservable();
  }

  async checkConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }
}
