import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AiRecommendation,
  AiRecommendationResponse,
  AiRecommendationService,
  BrandAnalytics,
} from '../../core/services/ai-recommendation.service';

@Component({
  selector: 'app-ai-recommendations',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Recomendaciones IA</span>
        <h2>Analisis semanal de cambios y duracion por marca</h2>
        <p class="section-copy">Sugerencias generadas desde el historial de gomas, ubicaciones actuales y movimientos registrados.</p>
      </div>
    </section>

    <ng-container *ngIf="data as snapshot; else loadingOrError">
      <section class="stats-grid recommendations-stats">
        <article class="stat-card accent">
          <span>Recomendaciones</span>
          <strong>{{ snapshot.summary.recommendationsCount }}</strong>
          <small>{{ snapshot.summary.highPriorityCount }} de prioridad alta</small>
        </article>
        <article class="stat-card">
          <span>Marcas analizadas</span>
          <strong>{{ snapshot.summary.brandsAnalyzed }}</strong>
          <small>{{ snapshot.sourceStats?.totalTires || 0 }} gomas tomadas</small>
        </article>
        <article class="stat-card">
          <span>Ultima actualizacion</span>
          <strong class="date-stat">{{ snapshot.generatedAt | date:'dd/MM' }}</strong>
          <small>{{ snapshot.wasGeneratedNow ? 'Generada ahora' : 'Cache semanal vigente' }}</small>
        </article>
        <article class="stat-card">
          <span>Proxima revision</span>
          <strong class="date-stat">{{ snapshot.validUntil | date:'dd/MM' }}</strong>
          <small>Se recalcula por semana</small>
        </article>
      </section>

      <section class="panel-grid recommendations-layout">
        <article class="panel-card recommendation-panel">
          <div class="panel-head">
            <h3>Cambios recomendados</h3>
            <div class="panel-actions">
              <span class="chip">Semana {{ snapshot.weekKey }}</span>
              <button class="secondary-button compact-action" type="button" (click)="load()">Actualizar</button>
            </div>
          </div>

          <div class="recommendation-list">
            <div class="recommendation-item" *ngFor="let recommendation of snapshot.recommendations; trackBy: trackRecommendation">
              <div class="recommendation-top">
                <span class="priority-pill" [ngClass]="priorityClass(recommendation.priority)">{{ recommendation.priority }}</span>
                <span class="confidence-pill">Confianza {{ recommendation.confidence.toLowerCase() }}</span>
              </div>

              <div>
                <h4>{{ recommendation.title }}</h4>
                <p class="recommendation-action">{{ recommendation.action }}</p>
                <p class="recommendation-reason">{{ recommendation.reason }}</p>
              </div>

              <div class="recommendation-route" *ngIf="recommendation.from || recommendation.to">
                <div>
                  <span>Desde</span>
                  <strong>{{ recommendation.from || '-' }}</strong>
                </div>
                <div>
                  <span>Hacia</span>
                  <strong>{{ recommendation.to || '-' }}</strong>
                </div>
              </div>

              <div class="tire-pair" *ngIf="recommendation.tire || recommendation.replacementTire">
                <div class="tire-mini" *ngIf="recommendation.tire as tire">
                  <span>Goma a revisar</span>
                  <strong>{{ tire.code }} | {{ tire.brand }}</strong>
                  <small>{{ tire.model }} | {{ tire.size }} | {{ formatState(tire.state, tire.repairType) }}</small>
                </div>
                <div class="tire-mini replacement" *ngIf="recommendation.replacementTire as replacement">
                  <span>Reemplazo sugerido</span>
                  <strong>{{ replacement.code }} | {{ replacement.brand }}</strong>
                  <small>{{ replacement.model }} | {{ replacement.size }} | {{ formatState(replacement.state, replacement.repairType) }}</small>
                </div>
              </div>

              <div class="evidence-strip">
                <span>{{ formatDays(recommendation.evidence.daysInCurrentPlace) }} en ubicacion</span>
                <span>{{ recommendation.evidence.movementCount || 0 }} movimientos</span>
                <span>Reparacion prom.: {{ formatDays(recommendation.evidence.brandAverageDaysToRepair) }}</span>
                <span>Baja prom.: {{ formatDays(recommendation.evidence.brandAverageDaysToDiscard) }}</span>
              </div>
            </div>
          </div>
        </article>

        <article class="panel-card analytics-panel">
          <div class="panel-head">
            <h3>Duracion por marca</h3>
            <span class="chip">{{ snapshot.brandAnalytics.length }} marcas</span>
          </div>

          <div class="brand-highlight-list" *ngIf="topBrands.length">
            <div class="brand-highlight-row" *ngFor="let brand of topBrands; trackBy: trackBrand">
              <div>
                <strong>{{ brand.brand }}</strong>
                <span>{{ brand.insight }}</span>
              </div>
              <b>{{ formatDays(brand.durabilityScore) }}</b>
            </div>
          </div>

          <div class="table-wrapper analytics-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Hasta reparar</th>
                  <th>Hasta baja</th>
                  <th>Mayor duracion</th>
                  <th>Muestra</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let brand of snapshot.brandAnalytics; trackBy: trackBrand">
                  <td>
                    <strong>{{ brand.brand }}</strong>
                    <div class="table-note">Confianza {{ brand.confidence.toLowerCase() }}</div>
                  </td>
                  <td>{{ formatDays(brand.averageDaysToRepair) }}</td>
                  <td>{{ formatDays(brand.averageDaysToDiscard) }}</td>
                  <td>
                    <strong>{{ brand.longestTire?.code || '-' }}</strong>
                    <div class="table-note">{{ formatDays(brand.longestTire?.days || null) }}</div>
                  </td>
                  <td>{{ brand.tireCount }} gomas</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </ng-container>

    <ng-template #loadingOrError>
      <section class="panel-grid">
        <article class="panel-card">
          <div class="panel-head">
            <h3>{{ loading ? 'Calculando recomendaciones' : 'No se pudo cargar el analisis' }}</h3>
            <button class="secondary-button compact-action" *ngIf="!loading" type="button" (click)="load()">Reintentar</button>
          </div>
          <p class="empty-state">{{ loading ? 'Analizando historial, ubicaciones y marcas...' : errorMessage }}</p>
        </article>
      </section>
    </ng-template>
  `,
  styles: [
    `
      .recommendations-layout {
        grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
        align-items: start;
      }

      .recommendations-stats .stat-card {
        min-height: 150px;
      }

      .date-stat {
        font-size: 1.85rem;
      }

      .panel-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .compact-action {
        padding: 0.65rem 0.95rem;
      }

      .recommendation-list,
      .brand-highlight-list {
        display: grid;
        gap: 1rem;
      }

      .recommendation-item {
        display: grid;
        gap: 1rem;
        padding: 1.1rem;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid var(--line);
      }

      .recommendation-top,
      .evidence-strip,
      .tire-pair,
      .recommendation-route {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .recommendation-top {
        align-items: center;
        justify-content: space-between;
      }

      .priority-pill,
      .confidence-pill,
      .evidence-strip span {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        font-weight: 700;
      }

      .priority-pill,
      .confidence-pill {
        padding: 0.34rem 0.72rem;
        font-size: 0.78rem;
      }

      .priority-high {
        color: #8b2a2a;
        background: rgba(196, 74, 74, 0.14);
      }

      .priority-medium {
        color: #87601c;
        background: rgba(255, 183, 77, 0.2);
      }

      .priority-low,
      .confidence-pill {
        color: var(--primary-dark);
        background: rgba(13, 143, 134, 0.11);
      }

      .recommendation-item h4,
      .recommendation-item p {
        margin: 0;
      }

      .recommendation-item h4 {
        font-size: 1.08rem;
      }

      .recommendation-action {
        margin-top: 0.35rem;
        line-height: 1.5;
        color: var(--text);
      }

      .recommendation-reason {
        margin-top: 0.35rem;
        line-height: 1.5;
        color: var(--muted);
      }

      .recommendation-route {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .recommendation-route div,
      .tire-mini,
      .brand-highlight-row {
        padding: 0.85rem;
        border-radius: 16px;
        background: rgba(13, 143, 134, 0.08);
        border: 1px solid rgba(13, 143, 134, 0.09);
      }

      .recommendation-route span,
      .tire-mini span,
      .brand-highlight-row span {
        display: block;
        color: var(--muted);
        font-size: 0.86rem;
      }

      .tire-mini {
        flex: 1 1 220px;
      }

      .tire-mini.replacement {
        background: rgba(255, 183, 77, 0.16);
        border-color: rgba(255, 183, 77, 0.2);
      }

      .tire-mini strong,
      .tire-mini small {
        display: block;
      }

      .tire-mini small {
        margin-top: 0.25rem;
        color: var(--muted);
      }

      .evidence-strip span {
        padding: 0.32rem 0.62rem;
        background: rgba(16, 32, 51, 0.06);
        color: var(--muted);
        font-size: 0.78rem;
      }

      .brand-highlight-list {
        margin-bottom: 1rem;
      }

      .brand-highlight-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .brand-highlight-row b {
        white-space: nowrap;
        color: var(--primary-dark);
      }

      .analytics-table-wrapper {
        max-height: 620px;
        overflow: auto;
      }

      .analytics-table-wrapper table {
        min-width: 720px;
      }

      @media (max-width: 1080px) {
        .recommendations-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .recommendation-route {
          grid-template-columns: 1fr;
        }

        .brand-highlight-row {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class AiRecommendationsComponent implements OnInit {
  private readonly aiRecommendationService = inject(AiRecommendationService);

  data: AiRecommendationResponse | null = null;
  loading = false;
  errorMessage = '';

  get topBrands(): BrandAnalytics[] {
    return (this.data?.brandAnalytics || []).slice(0, 3);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.aiRecommendationService.getWeeklyRecommendations().subscribe({
      next: (data) => {
        this.data = data;
        this.loading = false;
      },
      error: (error) => {
        this.data = null;
        this.loading = false;
        this.errorMessage = error.error?.message || 'El analisis IA no esta disponible en este momento.';
      },
    });
  }

  trackRecommendation(_index: number, recommendation: AiRecommendation): string {
    return recommendation.id;
  }

  trackBrand(_index: number, brand: BrandAnalytics): string {
    return brand.brand;
  }

  priorityClass(priority: AiRecommendation['priority']): string {
    if (priority === 'ALTA') {
      return 'priority-high';
    }

    if (priority === 'MEDIA') {
      return 'priority-medium';
    }

    return 'priority-low';
  }

  formatDays(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (value === 1) {
      return '1 dia';
    }

    return `${value} dias`;
  }

  formatState(state: string | null | undefined, repairType?: number | null): string {
    if (!state) {
      return 'Sin estado';
    }

    if (state === 'REPARADA') {
      return repairType ? `Reparada ${repairType}` : 'Reparada';
    }

    return state.charAt(0) + state.slice(1).toLowerCase();
  }
}
