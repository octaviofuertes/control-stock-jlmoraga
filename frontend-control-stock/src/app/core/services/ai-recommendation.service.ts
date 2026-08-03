import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiRecommendationTire {
  id: string;
  code: string;
  brand: string;
  model: string;
  size: string;
  state: string;
  repairType: number | null;
  location: string;
}

export interface AiRecommendation {
  id: string;
  category: string;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  title: string;
  action: string;
  reason: string;
  from: string | null;
  to: string | null;
  tire: AiRecommendationTire | null;
  replacementTire: AiRecommendationTire | null;
  confidence: 'ALTA' | 'MEDIA' | 'BAJA';
  evidence: {
    daysInCurrentPlace: number | null;
    movementCount: number | null;
    brandAverageDaysToRepair: number | null;
    brandAverageDaysToDiscard: number | null;
    score: number | null;
  };
}

export interface BrandAnalytics {
  brand: string;
  tireCount: number;
  repairedCount: number;
  discardedCount: number;
  averageDaysToRepair: number | null;
  averageDaysToDiscard: number | null;
  averageObservedDays: number | null;
  durabilityScore: number;
  confidence: 'ALTA' | 'MEDIA' | 'BAJA';
  insight: string;
  longestTire: {
    code: string;
    brand: string;
    model: string;
    size: string;
    days: number;
    state: string;
    location: string;
  } | null;
}

export interface AiRecommendationResponse {
  id: string;
  weekKey: string;
  generatedAt: string;
  validUntil: string;
  wasGeneratedNow: boolean;
  recommendations: AiRecommendation[];
  brandAnalytics: BrandAnalytics[];
  sourceStats: {
    totalTires: number;
    activeTires: number;
    fleetTires: number;
    depositCandidates: number;
    movements: number;
    engine: string;
  } | null;
  summary: {
    recommendationsCount: number;
    highPriorityCount: number;
    brandsAnalyzed: number;
    nextRefreshAt: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AiRecommendationService {
  private readonly http = inject(HttpClient);

  getWeeklyRecommendations(): Observable<AiRecommendationResponse> {
    return this.http.get<AiRecommendationResponse>(`${environment.apiUrl}/recomendaciones-ia`);
  }
}
