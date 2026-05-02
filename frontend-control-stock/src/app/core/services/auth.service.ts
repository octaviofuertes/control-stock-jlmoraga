import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenKey = 'control-stock-token';
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(this.getStoredUser());
  readonly user$ = this.userSubject.asObservable();

  login(payload: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, payload).pipe(
      tap((response) => this.persistSession(response)),
    );
  }

  fetchMe(): Observable<{ user: AuthUser }> {
    return this.http.get<{ user: AuthUser }>(`${environment.apiUrl}/auth/me`).pipe(
      tap((response) => localStorage.setItem('control-stock-user', JSON.stringify(response.user))),
      tap((response) => this.userSubject.next(response.user)),
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('control-stock-user');
    this.userSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getCurrentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem('control-stock-user', JSON.stringify(response.user));
    this.userSubject.next(response.user);
  }

  private getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem('control-stock-user');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.id || !parsed.email || !parsed.role) {
      return null;
    }

    return parsed as AuthUser;
  }
}
