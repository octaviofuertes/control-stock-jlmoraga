import { AsyncPipe, CommonModule, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NotificationService } from '../core/services/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, NgIf, AsyncPipe],
  template: `
    <div class="toast-wrapper" *ngIf="notificationService.notification$ | async as notification">
      <div class="toast-card" [class.success]="notification.type === 'success'" [class.error]="notification.type === 'error'">
        {{ notification.message }}
      </div>
    </div>
  `,
})
export class NotificationCenterComponent {
  readonly notificationService = inject(NotificationService);
}
