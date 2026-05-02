import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type SpareCategory = 'FOCOS' | 'FERRETERIA';

export interface SpareItem {
  id: string;
  name: string;
  category: SpareCategory;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface OilStockState {
  id: string;
  key: string;
  capacityLiters: number;
  currentLiters: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartsWarehouseState {
  oil: OilStockState;
  items: SpareItem[];
}

@Injectable({ providedIn: 'root' })
export class PartsWarehouseService {
  private readonly http = inject(HttpClient);

  getState(): Observable<PartsWarehouseState> {
    return this.http.get<PartsWarehouseState>(`${environment.apiUrl}/repuestos`);
  }

  createItem(payload: { name: string; category: SpareCategory; stock: number }): Observable<SpareItem> {
    return this.http.post<SpareItem>(`${environment.apiUrl}/repuestos/items`, payload);
  }

  updateItemStock(id: string, delta: number): Observable<SpareItem> {
    return this.http.patch<SpareItem>(`${environment.apiUrl}/repuestos/items/${id}/stock`, { delta });
  }

  updateOil(action: 'add' | 'consume', liters: number): Observable<OilStockState> {
    return this.http.patch<OilStockState>(`${environment.apiUrl}/repuestos/oil`, { action, liters });
  }
}
