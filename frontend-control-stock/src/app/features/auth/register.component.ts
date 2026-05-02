import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <div class="auth-hero">
        <span class="eyebrow">Alta de usuarios</span>
        <h1>Prepara tu equipo para registrar cada movimiento</h1>
        <p>Cada cambio queda auditado con fecha, hora y responsable para tener trazabilidad real en toda la flota.</p>
      </div>

      <form class="auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h2>Crear cuenta</h2>
        <label>
          Nombre
          <input type="text" formControlName="name" placeholder="Nombre y apellido" />
        </label>
        <label>
          Email
          <input type="email" formControlName="email" placeholder="usuario@empresa.com" />
        </label>
        <label>
          Contrasena
          <input type="password" formControlName="password" placeholder="Minimo 6 caracteres" />
        </label>
        <button class="primary-button" type="submit" [disabled]="form.invalid || loading">
          {{ loading ? 'Creando...' : 'Crear usuario' }}
        </button>
        <p>¿Ya tienes cuenta? <a routerLink="/login">Ingresar</a></p>
      </form>
    </section>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  loading = false;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.authService.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.notificationService.show('success', 'Usuario creado e identificado correctamente.');
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No fue posible registrar el usuario.');
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
