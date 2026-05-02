import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="auth-page">
      <div class="auth-hero">
        <div class="hero-logo-wrap">
          <img class="hero-logo" src="assets/logo.webp" alt="Logo JLMoraga" />
        </div>

        <h1>Control de stock de JLMoraga</h1>
        <p>Gestiona ubicaciones, movimientos e historial completo desde una sola pantalla.</p>
      </div>

      <form class="auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <div class="auth-card-brand">
    
          <div>
            <span class="eyebrow">Acceso seguro</span>
            <h2>Ingresar</h2>
          </div>
        </div>
        <label>
          Email
          <input type="email" formControlName="email" placeholder="usuario@empresa.com" />
        </label>
        <label>
          Contrasena
          <input type="password" formControlName="password" placeholder="********" />
        </label>
        <button class="primary-button" type="submit" [disabled]="form.invalid || loading">
          {{ loading ? 'Ingresando...' : 'Entrar al sistema' }}
        </button>
        <p>El acceso de usuarios se administra internamente por un perfil administrador.</p>
      </form>
    </section>
  `,
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  loading = false;

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (this.authService.getToken() && !this.authService.getCurrentUser()) {
      this.authService.logout();
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.notificationService.show('success', 'Sesion iniciada correctamente.');
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No fue posible iniciar sesion.');
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
