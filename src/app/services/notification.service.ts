import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration: number;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$: Observable<Notification[]> = this.notificationsSubject.asObservable();

  private notifications: Notification[] = [];

  constructor() {}

  /**
   * Show success notification
   */
  showSuccess(message: string, duration: number = 3000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'success',
      message,
      duration,
      timestamp: new Date()
    });
  }

  /**
   * Show error notification
   */
  showError(message: string, duration: number = 5000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'error',
      message,
      duration,
      timestamp: new Date()
    });
  }

  /**
   * Show warning notification
   */
  showWarning(message: string, duration: number = 4000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'warning',
      message,
      duration,
      timestamp: new Date()
    });
  }

  /**
   * Show info notification
   */
  showInfo(message: string, duration: number = 3000): void {
    this.addNotification({
      id: this.generateId(),
      type: 'info',
      message,
      duration,
      timestamp: new Date()
    });
  }

  /**
   * Add notification to the list
   */
  private addNotification(notification: Notification): void {
    this.notifications.push(notification);
    this.notificationsSubject.next([...this.notifications]);

    // Auto-remove notification after duration
    if (notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  /**
   * Remove notification by ID
   */
  removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notificationsSubject.next([...this.notifications]);
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications = [];
    this.notificationsSubject.next([]);
  }

  /**
   * Generate unique ID for notification
   */
  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
