import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LoginComponent } from './features/auth/login.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { TiresComponent } from './features/tires/tires.component';
import { MovementsComponent } from './features/movements/movements.component';
import { ResourcesComponent } from './features/resources/resources.component';
import { UsersComponent } from './features/users/users.component';
import { PartsWarehouseComponent } from './features/parts-warehouse/parts-warehouse.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'gomas', component: TiresComponent },
      { path: 'repuestos', component: PartsWarehouseComponent },
      { path: 'movimientos', component: MovementsComponent },
      { path: 'recursos', component: ResourcesComponent },
      { path: 'usuarios', component: UsersComponent, canActivate: [adminGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];
