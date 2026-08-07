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

export type RecommendationCategory = 'ROTACION' | 'DESCARTE' | 'GOMERIA' | 'STOCK' | 'CONTROL';

export interface AiRecommendation {
  id: string;
  category: RecommendationCategory;
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
    repairEvents: number | null;
    brandDurabilityScore: number | null;
    brandAverageDaysToRepair: number | null;
    brandAverageDaysToDiscard: number | null;
    score: number | null;
  };
}

export interface BrandAnalytics {
  brand: string;
  aliases: string[];
  tireCount: number;
  repairedCount: number;
  arrivedRepairedCount: number;
  trackedRepairEvents: number;
  discardedCount: number;
  repairShare: number;
  discardShare: number;
  averageRepairLevel: number | null;
  averageDaysToRepair: number | null;
  averageDaysToRepairSample: number;
  averageDaysToDiscard: number | null;
  averageDaysToDiscardSample: number;
  averageDaysWithoutIncident: number | null;
  averageObservedDays: number;
  observedTireDays: number;
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

export interface BrandRanking {
  best: BrandAnalytics[];
  worst: BrandAnalytics[];
  eligibleCount: number;
  excludedForLowEvidence: number;
}

export interface BrandDuplicateWarning {
  brand: string;
  possibleDuplicate: string;
  brandTires: number;
  duplicateTires: number;
  message: string;
}

export interface AiRecommendationResponse {
  id: string;
  weekKey: string;
  generatedAt: string;
  validUntil: string;
  wasGeneratedNow: boolean;
  recommendations: AiRecommendation[];
  brandAnalytics: BrandAnalytics[];
  brandRanking: BrandRanking;
  dataQuality: {
    possibleBrandDuplicates: BrandDuplicateWarning[];
  };
  sourceStats: {
    schemaVersion: number;
    totalTires: number;
    activeTires: number;
    fleetTires: number;
    depositCandidates: number;
    gomeriaTires: number;
    movements: number;
    trackingStart: string | null;
    trackingDays: number;
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

  /** Solo ADMIN: fuerza un recalculo sin esperar al corte semanal. */
  regenerate(): Observable<AiRecommendationResponse> {
    return this.http.post<AiRecommendationResponse>(`${environment.apiUrl}/recomendaciones-ia/recalcular`, {});
  }
}
