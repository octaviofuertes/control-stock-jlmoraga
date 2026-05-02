import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-panel">
          <img class="brand-logo" src="assets/logo.webp" alt="Logo JLMoraga" />
          <span class="eyebrow">Control operativo</span>

          <div class="brand-highlight">
            <strong>Operacion clara</strong>
            <span>Stock, ubicacion actual y movimientos en una sola vista.</span>
          </div>
        </div>

        <nav class="nav-links">
          <a routerLink="/dashboard" routerLinkActive="active">
            <span class="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="8" height="7" rx="2"></rect>
                <rect x="13" y="4" width="8" height="11" rx="2"></rect>
                <rect x="3" y="13" width="8" height="7" rx="2"></rect>
                <rect x="13" y="17" width="8" height="3" rx="1.5"></rect>
              </svg>
            </span>
            <span>Dashboard</span>
          </a>
          <a routerLink="/gomas" routerLinkActive="active">
            <span class="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="7"></circle>
                <circle cx="12" cy="12" r="2.8"></circle>
                <path d="M12 5v2.2M12 16.8V19M5 12h2.2M16.8 12H19"></path>
              </svg>
            </span>
            <span>Gomas</span>
          </a>
          <a routerLink="/repuestos" routerLinkActive="active">
            <span class="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 8.5h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"></path>
                <path d="M9 8.5V6.8A1.8 1.8 0 0 1 10.8 5h2.4A1.8 1.8 0 0 1 15 6.8v1.7"></path>
                <path d="M5 12h14"></path>
              </svg>
            </span>
            <span>Repuestos</span>
          </a>
          <a routerLink="/movimientos" routerLinkActive="active">
            <span class="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 7h10"></path>
                <path d="M14.5 4.5 17 7l-2.5 2.5"></path>
                <path d="M17 17H7"></path>
                <path d="M9.5 14.5 7 17l2.5 2.5"></path>
              </svg>
            </span>
            <span>Movimientos</span>
          </a>
          <a routerLink="/recursos" routerLinkActive="active">
            <span class="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 10.5 12 5l7 5.5"></path>
                <path d="M7.5 10v8h9v-8"></path>
                <path d="M10.5 18v-4h3v4"></path>
              </svg>
            </span>
            <span>Recursos</span>
          </a>
          <a *ngIf="authService.getCurrentUser()?.role === 'ADMIN'" routerLink="/usuarios" routerLinkActive="active">
            <span class="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="3.2"></circle>
                <path d="M6.5 18.5c1.2-2.7 3.2-4 5.5-4s4.3 1.3 5.5 4"></path>
                <path d="M18 8.8c1.3.3 2.2 1.4 2.2 2.8 0 1.3-.9 2.4-2.2 2.8"></path>
              </svg>
            </span>
            <span>Usuarios</span>
          </a>
        </nav>

        <div class="user-panel" *ngIf="authService.getCurrentUser() as user">
          <div class="user-card">
            <div class="user-avatar">{{ user.name.charAt(0) }}</div>
            <div class="user-meta">
              <strong>{{ user.name }}</strong>
              <span>{{ user.email }}</span>
            </div>
          </div>
          <button class="sidebar-logout" type="button" (click)="logout()">Cerrar sesion</button>
        </div>
      </aside>

      <main class="content-area">
        <section class="content-intro" *ngIf="authService.getCurrentUser() as user">
          <div>
            <span class="eyebrow">Panel activo</span>
            <h2>Bienvenido, {{ user.name }}</h2>
            <p>Gestiona stock, movimientos y usuarios con una vista mas clara y ordenada.</p>
          </div>
          <div class="intro-badge">
            <span>Rol</span>
            <strong>{{ user.role === 'ADMIN' ? 'Administrador' : 'Operador' }}</strong>
          </div>
        </section>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.authService.getToken()) {
      this.authService.fetchMe().subscribe({
        error: () => {
          this.authService.logout();
          this.router.navigate(['/login']);
        },
      });
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
