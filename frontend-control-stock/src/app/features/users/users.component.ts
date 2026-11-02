import { CommonModule, DatePipe, NgFor } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { AppUser, UserService } from '../../core/services/user.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgFor, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Usuarios</span>
        <h2>Alta de usuarios administrada por perfil administrador</h2>
        <p class="section-copy">Gestiona los accesos del equipo sin habilitar registro publico y manteniendo el control desde administracion.</p>
      </div>
    </section>

    <section class="panel-grid two-columns">
      <article class="panel-card">
        <div class="panel-head">
          <h3>Crear usuario</h3>
          <span class="chip">Solo admin</span>
        </div>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="saveUser()">
          <label class="field-label">
            <span>Nombre completo</span>
            <input type="text" placeholder="Nombre y apellido" formControlName="name" />
          </label>
          <label class="field-label">
            <span>Email</span>
            <input type="email" placeholder="usuario@empresa.com" formControlName="email" />
          </label>
          <label class="field-label">
            <span>Contrasena inicial</span>
            <input type="password" placeholder="Minimo 6 caracteres" formControlName="password" />
          </label>
          <label class="field-label">
            <span>Rol</span>
            <select formControlName="role">
              <option value="OPERATOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <div class="form-actions">
            <button class="primary-button" type="submit" [disabled]="form.invalid">Crear usuario</button>
          </div>
        </form>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <h3>Usuarios del sistema</h3>
          <span class="chip">{{ users.length }} activos</span>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of users">
                <td>{{ user.name }}</td>
                <td>{{ user.email }}</td>
                <td><span class="chip">{{ user.role }}</span></td>
                <td>{{ user.createdAt | date:'dd/MM/yyyy' }}</td>
                <td class="actions-cell">
                  <button class="ghost-button danger" type="button" (click)="deleteUser(user)">Borrar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `,
})
export class UsersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);

  users: AppUser[] = [];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['OPERATOR' as 'ADMIN' | 'OPERATOR', Validators.required],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getAll().subscribe((users) => {
      this.users = users;
    });
  }

  saveUser(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.userService.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.notificationService.show('success', 'Usuario creado correctamente.');
        this.form.reset({
          name: '',
          email: '',
          password: '',
          role: 'OPERATOR',
        });
        this.loadUsers();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo crear el usuario.');
      },
    });
  }

  deleteUser(user: AppUser): void {
    const confirmed = window.confirm(`Quieres borrar al usuario ${user.name}?`);
    if (!confirmed) {
      return;
    }

    this.userService.delete(user.id).subscribe({
      next: () => {
        this.notificationService.show('success', 'Usuario eliminado correctamente.');
        this.loadUsers();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo eliminar el usuario.');
      },
    });
  }
}
