import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardSummary {
  totalTires: number;
  tiresInDeposit: number;
  tiresInSemis: number;
  tiresInTractors: number;
  tiresInGomeria: number;
  tiresInAuxilio: number;
  recentMovements: Array<{
    id: string;
    createdAt: string;
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
    tire: { id: string; code: string; brand: string; model: string; size: string };
    user: { id: string; name: string };
  }>;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${environment.apiUrl}/dashboard/resumen`);
  }
}
