import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppNotification {
  type: 'success' | 'error' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notificationSubject = new BehaviorSubject<AppNotification | null>(null);
  readonly notification$ = this.notificationSubject.asObservable();

  show(type: AppNotification['type'], message: string): void {
    this.notificationSubject.next({ type, message });
    setTimeout(() => {
      if (this.notificationSubject.value?.message === message) {
        this.notificationSubject.next(null);
      }
    }, 3500);
  }
}
