import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationCenterComponent } from './layout/notification-center.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NotificationCenterComponent],
  template: `
    <app-notification-center></app-notification-center>
    <router-outlet></router-outlet>
  `,
})
export class AppComponent {}
