import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Tire {
  id: string;
  code: string;
  brand: string;
  model: string;
  size: string;
  state: string;
  repairType: number | null;
  currentLocation: string;
  notes: string | null;
  locationDetail: {
    type: string;
    label: string;
    plate: string | null;
  };
}

export interface MovementHistory {
  id: string;
  previousLocation: string;
  newLocation: string;
  previousState: string | null;
  newState: string | null;
  previousRepairType: number | null;
  newRepairType: number | null;
  previousDepositName?: string | null;
  newDepositName?: string | null;
  previousPlate: string | null;
  newPlate: string | null;
  notes: string | null;
  createdAt: string;
  tire?: { id: string; code: string; brand: string; model: string; size: string };
  user: { id: string; name: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class TireService {
  private readonly http = inject(HttpClient);

  getAll(filters: { search?: string; state?: string; locationType?: string }): Observable<Tire[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params = params.set(key, value);
    });
    return this.http.get<Tire[]>(`${environment.apiUrl}/tires`, { params });
  }

  create(payload: Record<string, unknown>): Observable<Tire> {
    return this.http.post<Tire>(`${environment.apiUrl}/tires`, payload);
  }

  update(id: string, payload: Record<string, unknown>): Observable<Tire> {
    return this.http.put<Tire>(`${environment.apiUrl}/tires/${id}`, payload);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/tires/${id}`);
  }

  getHistory(id: string): Observable<MovementHistory[]> {
    return this.http.get<MovementHistory[]>(`${environment.apiUrl}/tires/${id}/historial`);
  }
}
