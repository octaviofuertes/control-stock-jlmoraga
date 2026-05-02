import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Movement {
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
  tire: { id: string; code: string; brand: string; model: string; size: string };
  user: { id: string; name: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class MovementService {
  private readonly http = inject(HttpClient);

  create(payload: Record<string, unknown>): Observable<Movement> {
    return this.http.post<Movement>(`${environment.apiUrl}/movimientos`, payload);
  }

  getAll(): Observable<Movement[]> {
    return this.http.get<Movement[]>(`${environment.apiUrl}/movimientos`);
  }
}
