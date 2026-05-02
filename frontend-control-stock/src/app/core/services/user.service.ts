import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<AppUser[]> {
    return this.http.get<AppUser[]>(`${environment.apiUrl}/users`);
  }

  create(payload: { name: string; email: string; password: string; role: 'ADMIN' | 'OPERATOR' }): Observable<AppUser> {
    return this.http.post<AppUser>(`${environment.apiUrl}/users`, payload);
  }
}
