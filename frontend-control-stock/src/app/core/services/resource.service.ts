import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ResourceItem {
  id: string;
  name?: string;
  plate?: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ResourceService {
  private readonly http = inject(HttpClient);

  getDeposits(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(`${environment.apiUrl}/deposits`);
  }

  createDeposit(payload: Record<string, unknown>): Observable<ResourceItem> {
    return this.http.post<ResourceItem>(`${environment.apiUrl}/deposits`, payload);
  }

  updateDeposit(id: string, payload: Record<string, unknown>): Observable<ResourceItem> {
    return this.http.put<ResourceItem>(`${environment.apiUrl}/deposits/${id}`, payload);
  }

  deleteDeposit(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/deposits/${id}`);
  }

  getTractors(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(`${environment.apiUrl}/tractors`);
  }

  createTractor(payload: Record<string, unknown>): Observable<ResourceItem> {
    return this.http.post<ResourceItem>(`${environment.apiUrl}/tractors`, payload);
  }

  updateTractor(id: string, payload: Record<string, unknown>): Observable<ResourceItem> {
    return this.http.put<ResourceItem>(`${environment.apiUrl}/tractors/${id}`, payload);
  }

  deleteTractor(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/tractors/${id}`);
  }

  getSemis(): Observable<ResourceItem[]> {
    return this.http.get<ResourceItem[]>(`${environment.apiUrl}/semis`);
  }

  createSemi(payload: Record<string, unknown>): Observable<ResourceItem> {
    return this.http.post<ResourceItem>(`${environment.apiUrl}/semis`, payload);
  }

  updateSemi(id: string, payload: Record<string, unknown>): Observable<ResourceItem> {
    return this.http.put<ResourceItem>(`${environment.apiUrl}/semis/${id}`, payload);
  }

  deleteSemi(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/semis/${id}`);
  }
}
