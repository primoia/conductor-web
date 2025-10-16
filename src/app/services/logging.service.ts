import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private readonly sessionId: string;
  private readonly isProduction: boolean;
  private readonly minLogLevel: LogLevel;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProduction = environment.production;
    this.minLogLevel = this.isProduction ? LogLevel.WARN : LogLevel.TRACE;
  }

  /**
   * Log a trace message (most verbose)
   */
  trace(message: string, context?: string, data?: any): void {
    this.log(LogLevel.TRACE, message, context, data);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: any, context?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, { error, ...data });
  }

  /**
   * Log a user action (specialized info log)
   */
  userAction(action: string, context?: string, data?: any): void {
    this.info(`👤 ${action}`, context, data);
  }

  /**
   * Log a system event (specialized info log)
   */
  systemEvent(event: string, context?: string, data?: any): void {
    this.info(`⚙️ ${event}`, context, data);
  }

  /**
   * Log an API call
   */
  apiCall(method: string, url: string, context?: string, data?: any): void {
    this.debug(`🌐 ${method.toUpperCase()} ${url}`, context, data);
  }

  /**
   * Log an API response
   */
  apiResponse(method: string, url: string, status: number, context?: string, data?: any): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
    const emoji = status >= 400 ? '❌' : '✅';
    this.log(level, `${emoji} ${method.toUpperCase()} ${url} - ${status}`, context, data);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: string, data?: any): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, `⏱️ ${operation} - ${duration}ms`, context, data);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (level < this.minLogLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context || 'App',
      message,
      data,
      sessionId: this.sessionId
    };

    this.outputLog(entry);
  }

  /**
   * Output the log entry
   */
  private outputLog(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const prefix = `[${entry.timestamp}] [${levelName}] [${entry.context}]`;
    const fullMessage = `${prefix} ${entry.message}`;

    // Add data if present
    const logData = entry.data ? { ...entry.data, sessionId: entry.sessionId } : { sessionId: entry.sessionId };

    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(fullMessage, logData);
        break;
      case LogLevel.INFO:
        console.info(fullMessage, logData);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage, logData);
        break;
      case LogLevel.ERROR:
        console.error(fullMessage, logData);
        break;
    }

    // In production, you could send to external logging service here
    if (this.isProduction && entry.level >= LogLevel.ERROR) {
      this.sendToExternalService(entry);
    }
  }

  /**
   * Send critical logs to external service (placeholder for future implementation)
   */
  private sendToExternalService(entry: LogEntry): void {
    // TODO: Implement integration with Sentry, Datadog, or similar
    // This is where you would send error logs to external monitoring
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Create a child logger with additional context
   */
  createChildLogger(additionalContext: string): LoggingService {
    return {
      trace: (message: string, context?: string, data?: any) => 
        this.log(LogLevel.TRACE, message, context ? `${additionalContext}.${context}` : additionalContext, data),
      debug: (message: string, context?: string, data?: any) => 
        this.log(LogLevel.DEBUG, message, context ? `${additionalContext}.${context}` : additionalContext, data),
      info: (message: string, context?: string, data?: any) => 
        this.log(LogLevel.INFO, message, context ? `${additionalContext}.${context}` : additionalContext, data),
      warn: (message: string, context?: string, data?: any) => 
        this.log(LogLevel.WARN, message, context ? `${additionalContext}.${context}` : additionalContext, data),
      error: (message: string, error?: any, context?: string, data?: any) => 
        this.log(LogLevel.ERROR, message, context ? `${additionalContext}.${context}` : additionalContext, { error, ...data }),
      userAction: (action: string, context?: string, data?: any) => 
        this.log(LogLevel.INFO, `👤 ${action}`, context ? `${additionalContext}.${context}` : additionalContext, data),
      systemEvent: (event: string, context?: string, data?: any) => 
        this.log(LogLevel.INFO, `⚙️ ${event}`, context ? `${additionalContext}.${context}` : additionalContext, data),
      apiCall: (method: string, url: string, context?: string, data?: any) => 
        this.log(LogLevel.DEBUG, `🌐 ${method.toUpperCase()} ${url}`, context ? `${additionalContext}.${context}` : additionalContext, data),
      apiResponse: (method: string, url: string, status: number, context?: string, data?: any) => {
        const level = status >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
        const emoji = status >= 400 ? '❌' : '✅';
        this.log(level, `${emoji} ${method.toUpperCase()} ${url} - ${status}`, context ? `${additionalContext}.${context}` : additionalContext, data);
      },
      performance: (operation: string, duration: number, context?: string, data?: any) => {
        const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
        this.log(level, `⏱️ ${operation} - ${duration}ms`, context ? `${additionalContext}.${context}` : additionalContext, data);
      },
      getSessionId: () => this.getSessionId(),
      createChildLogger: (childContext: string) => this.createChildLogger(`${additionalContext}.${childContext}`)
    } as LoggingService;
  }
}
