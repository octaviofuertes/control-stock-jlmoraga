import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';
import { ResourceItem, ResourceService } from '../../core/services/resource.service';
import { Tire, TireService } from '../../core/services/tire.service';

type InventoryFocus = 'DEPOSIT' | 'GOMERIA' | 'AUXILIO' | 'SEMI' | 'TRACTOR';

interface FleetUnit {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  tires: Tire[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Dashboard</span>
        <h2>Vista general de stock y movimientos</h2>
        <p class="section-copy">Consulta rapidamente cuantas gomas tienes, donde estan y cuales fueron los ultimos cambios realizados.</p>
      </div>
    </section>

    <section class="stats-grid" *ngIf="summary">
      <article class="stat-card accent">
        <span>Total de gomas</span>
        <strong>{{ summary.totalTires }}</strong>
        <small>Inventario consolidado</small>
      </article>
      <article class="stat-card stat-card-clickable" [class.active]="selectedFocus === 'DEPOSIT'" (click)="selectFocus('DEPOSIT')">
        <span>En deposito</span>
        <strong>{{ summary.tiresInDeposit }}</strong>
        <small>Haz clic para ver gomas disponibles</small>
      </article>
      <article class="stat-card stat-card-clickable" [class.active]="selectedFocus === 'GOMERIA'" (click)="selectFocus('GOMERIA')">
        <span>En gomeria</span>
        <strong>{{ summary.tiresInGomeria }}</strong>
        <small>Haz clic para ver gomas en taller</small>
      </article>
      <article class="stat-card stat-card-clickable" [class.active]="selectedFocus === 'AUXILIO'" (click)="selectFocus('AUXILIO')">
        <span>En auxilio</span>
        <strong>{{ summary.tiresInAuxilio }}</strong>
        <small>Haz clic para ver gomas de auxilio</small>
      </article>
      <article class="stat-card stat-card-clickable" [class.active]="selectedFocus === 'SEMI'" (click)="selectFocus('SEMI')">
        <span>En semis</span>
        <strong>{{ summary.tiresInSemis }}</strong>
        <small>Haz clic para ver unidades y gomas</small>
      </article>
      <article class="stat-card stat-card-clickable" [class.active]="selectedFocus === 'TRACTOR'" (click)="selectFocus('TRACTOR')">
        <span>En tractores</span>
        <strong>{{ summary.tiresInTractors }}</strong>
        <small>Haz clic para ver unidades y gomas</small>
      </article>
    </section>

    <section class="panel-grid" *ngIf="showStoragePanel">
      <article class="panel-card">
        <div class="panel-head">
          <h3>{{ storagePanelTitle }}</h3>
          <span class="chip">{{ visibleStorageTires.length }} de {{ selectedStorageTires.length }} gomas</span>
        </div>

        <div class="simple-list" *ngIf="selectedStorageTires.length; else emptyStorage">
          <article class="simple-item" *ngFor="let tire of visibleStorageTires">
            <strong>{{ tire.code }}</strong>
            <span>{{ tire.brand }} | {{ tire.model }} | {{ tire.size }} | {{ formatStateLabel(tire.state, tire.repairType) }}</span>
          </article>
        </div>
        <div class="stock-more-actions" *ngIf="canShowMoreStorageTires">
          <button class="secondary-button" type="button" (click)="showMoreStorageTires()">Mostrar más</button>
        </div>

        <ng-template #emptyStorage>
          <p class="empty-state">No hay gomas en esta ubicacion actualmente.</p>
        </ng-template>
      </article>
    </section>

    <section class="panel-grid" *ngIf="showFleetPanel">
      <article class="panel-card">
        <div class="panel-head">
          <h3>{{ selectedFocus === 'SEMI' ? 'Semis y sus gomas' : 'Tractores y sus gomas' }}</h3>
          <span class="chip">{{ selectedUnits.length }} unidades</span>
        </div>

        <div class="fleet-grid">
          <article class="fleet-unit-card" *ngFor="let unit of selectedUnits">
            <div class="fleet-unit-top">
              <div class="fleet-illustration" [class.tractor]="selectedFocus === 'TRACTOR'">
                <svg *ngIf="selectedFocus === 'SEMI'" viewBox="0 0 180 90" class="fleet-svg" aria-hidden="true">
                  <defs>
                    <linearGradient id="semiBody" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#22b8aa"></stop>
                      <stop offset="100%" stop-color="#116a7b"></stop>
                    </linearGradient>
                    <linearGradient id="semiCab" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#ffc76c"></stop>
                      <stop offset="100%" stop-color="#d58b22"></stop>
                    </linearGradient>
                  </defs>
                  <ellipse cx="92" cy="72" rx="64" ry="8" fill="rgba(15,45,65,0.16)"></ellipse>
                  <rect x="24" y="30" width="104" height="24" rx="9" fill="url(#semiBody)"></rect>
                  <rect x="32" y="35" width="34" height="7" rx="3.5" fill="rgba(255,255,255,0.28)"></rect>
                  <rect x="120" y="35" width="16" height="7" rx="3.5" fill="rgba(255,255,255,0.22)"></rect>
                  <rect x="18" y="52" width="118" height="5" rx="2.5" fill="#3b5569"></rect>
                  <rect x="26" y="54" width="10" height="10" rx="2" fill="#314859"></rect>
                  <rect x="118" y="54" width="10" height="10" rx="2" fill="#314859"></rect>
                  <circle cx="54" cy="67" r="11" fill="#203547"></circle>
                  <circle cx="54" cy="67" r="5" fill="#93a4b1"></circle>
                  <circle cx="98" cy="67" r="11" fill="#203547"></circle>
                  <circle cx="98" cy="67" r="5" fill="#93a4b1"></circle>
                </svg>
                <img *ngIf="selectedFocus === 'TRACTOR'" src="assets/camion.png" alt="Camion tractor" class="fleet-photo" />
              </div>
              <div>
                <span class="eyebrow">{{ selectedFocus === 'SEMI' ? 'Semi' : 'Tractor' }}</span>
                <div class="arg-plate">
                  <div class="arg-plate-top">
                    <span>REPUBLICA ARGENTINA</span>
                    <span class="arg-plate-flag" aria-hidden="true"></span>
                  </div>
                  <div class="arg-plate-number">{{ formatPlate(unit.plate) }}</div>
                </div>
                <p>{{ unit.brand || 'Marca no informada' }} {{ unit.model ? '| ' + unit.model : '' }}</p>
              </div>
            </div>

            <div class="fleet-tires">
              <div class="fleet-tires-head">
                <strong>Gomas asignadas</strong>
                <span>{{ unit.tires.length }}</span>
              </div>
              <div class="fleet-tire-list" *ngIf="unit.tires.length; else emptyFleet">
                <div class="fleet-tire-chip-wrap" *ngFor="let tire of unit.tires">
                  <button class="fleet-tire-chip" type="button" (click)="goToTire(tire)">
                    <span class="fleet-tire-chip-default">{{ tire.brand || 'Marca' }} · {{ tire.size || 'Sin medida' }} · {{ tire.notes || '-' }}</span>
                    <span class="fleet-tire-chip-state">{{ formatStateLabel(tire.state, tire.repairType) }}</span>
                  </button>
                </div>
              </div>
              <ng-template #emptyFleet>
                <p class="empty-state">Esta unidad no tiene gomas asignadas actualmente.</p>
              </ng-template>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section class="panel-grid" *ngIf="summary">
      <article class="panel-card history-panel">
        <div class="panel-head">
          <h3>Ultimos movimientos</h3>
          <span class="chip">{{ visibleRecentMovements.length }} de {{ summary.recentMovements.length }}</span>
        </div>
        <div class="timeline history-timeline dashboard-movements-timeline">
          <div class="timeline-item" *ngFor="let movement of visibleRecentMovements">
            <div>
              <strong>Goma {{ movement.tire.code }}</strong>
              <p>{{ movement.tire.brand }} | {{ movement.tire.model }} | {{ movement.tire.size }} | {{ formatStateLabel(movement.newState, movement.newRepairType) }}</p>
              <p>{{ formatMovementLocation(movement.previousLocation, movement.previousState, movement.previousRepairType, movement.previousDepositName, movement.previousPlate) }} -> {{ formatMovementLocation(movement.newLocation, movement.newState, movement.newRepairType, movement.newDepositName, movement.newPlate) }}</p>
              <p *ngIf="hasStateChange(movement)">{{ formatStateTransition(movement.previousState, movement.previousRepairType, movement.newState, movement.newRepairType) }}</p>
            </div>
            <small>{{ movement.user.name }} | {{ movement.createdAt | date:'short' }}</small>
          </div>
        </div>
        <div class="stock-more-actions" *ngIf="canShowMoreRecentMovements">
          <button class="secondary-button" type="button" (click)="showMoreRecentMovements()">Mostrar más</button>
        </div>
      </article>
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly resourceService = inject(ResourceService);
  private readonly tireService = inject(TireService);
  private readonly router = inject(Router);

  summary: DashboardSummary | null = null;
  semis: ResourceItem[] = [];
  tractors: ResourceItem[] = [];
  tires: Tire[] = [];
  selectedFocus: InventoryFocus = 'DEPOSIT';
  visibleStorageTiresCount = 10;
  visibleRecentMovementsCount = 10;

  get showStoragePanel(): boolean {
    return this.selectedFocus === 'DEPOSIT' || this.selectedFocus === 'GOMERIA' || this.selectedFocus === 'AUXILIO';
  }

  get showFleetPanel(): boolean {
    return this.selectedFocus === 'SEMI' || this.selectedFocus === 'TRACTOR';
  }

  get storagePanelTitle(): string {
    if (this.selectedFocus === 'GOMERIA') {
      return 'Gomas en gomeria';
    }

    if (this.selectedFocus === 'AUXILIO') {
      return 'Gomas en auxilio';
    }

    return 'Gomas en deposito';
  }

  get selectedStorageTires(): Tire[] {
    if (this.selectedFocus === 'GOMERIA') {
      return this.tires.filter((tire) => tire.state !== 'BAJA' && tire.currentLocation === 'DEPOSIT' && this.isGomeriaLabel(tire.locationDetail.label));
    }

    if (this.selectedFocus === 'AUXILIO') {
      return this.tires.filter((tire) => tire.state !== 'BAJA' && tire.currentLocation === 'DEPOSIT' && this.isAuxilioLabel(tire.locationDetail.label));
    }

    if (this.selectedFocus === 'DEPOSIT') {
      return this.tires.filter(
        (tire) =>
          tire.state !== 'BAJA' &&
          tire.currentLocation === 'DEPOSIT' &&
          !this.isGomeriaLabel(tire.locationDetail.label) &&
          !this.isAuxilioLabel(tire.locationDetail.label),
      );
    }

    return [];
  }

  get visibleStorageTires(): Tire[] {
    return this.selectedStorageTires.slice(0, this.visibleStorageTiresCount);
  }

  get canShowMoreStorageTires(): boolean {
    return this.visibleStorageTiresCount < this.selectedStorageTires.length;
  }

  get visibleRecentMovements(): DashboardSummary['recentMovements'] {
    return this.summary?.recentMovements.slice(0, this.visibleRecentMovementsCount) || [];
  }

  get canShowMoreRecentMovements(): boolean {
    return (this.summary?.recentMovements.length || 0) > this.visibleRecentMovementsCount;
  }

  get selectedUnits(): FleetUnit[] {
    const baseItems = this.selectedFocus === 'SEMI' ? this.semis : this.tractors;
    return baseItems.map((item) => ({
      id: item.id,
      plate: item.plate || 'Sin patente',
      brand: item.brand || null,
      model: item.model || null,
      tires: this.tires.filter((tire) => tire.state !== 'BAJA' && tire.currentLocation === this.selectedFocus && tire.locationDetail.plate === item.plate),
    }));
  }

  ngOnInit(): void {
    forkJoin({
      summary: this.dashboardService.getSummary(),
      semis: this.resourceService.getSemis(),
      tractors: this.resourceService.getTractors(),
      tires: this.tireService.getAll({}),
    }).subscribe(({ summary, semis, tractors, tires }) => {
      this.summary = summary;
      this.semis = semis;
      this.tractors = tractors;
      this.tires = tires;
      this.selectedFocus = 'DEPOSIT';
      this.visibleRecentMovementsCount = 10;
      this.visibleStorageTiresCount = 10;
    });
  }

  selectFocus(type: InventoryFocus): void {
    this.selectedFocus = type;
    this.visibleStorageTiresCount = 10;
  }

  showMoreStorageTires(): void {
    this.visibleStorageTiresCount += 10;
  }

  showMoreRecentMovements(): void {
    this.visibleRecentMovementsCount += 10;
  }

  goToTire(tire: Tire): void {
    this.router.navigate(['/gomas'], {
      queryParams: { edit: tire.id },
    });
  }

  formatPlate(plate: string): string {
    const clean = (plate || '').trim().toUpperCase().replace(/\s+/g, '');

    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(clean)) {
      return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5)}`;
    }

    if (/^[A-Z]{3}\d{3}$/.test(clean)) {
      return `${clean.slice(0, 3)} ${clean.slice(3)}`;
    }

    return clean || 'SIN PATENTE';
  }

  hasStateChange(movement: DashboardSummary['recentMovements'][number]): boolean {
    return movement.previousState !== movement.newState || (movement.previousRepairType || null) !== (movement.newRepairType || null);
  }

  formatStateTransition(previousState: string | null, previousRepairType: number | null, nextState: string | null, nextRepairType: number | null): string {
    return `Estado: ${this.formatStateLabel(previousState, previousRepairType)} -> ${this.formatStateLabel(nextState, nextRepairType)}`;
  }

  formatStateLabel(state: string | null | undefined, repairType?: number | null): string {
    if (!state) {
      return 'Sin estado';
    }

    if (state === 'REPARADA') {
      return repairType ? `Reparada ${repairType}` : 'Reparada';
    }

    return state.charAt(0) + state.slice(1).toLowerCase();
  }

  formatMovementLocation(location: string, state?: string | null, repairType?: number | null, depositName?: string | null, plate?: string | null): string {
    if (state === 'BAJA') {
      return 'DESCARTADA';
    }

    if (location === 'DEPOSIT') {
      if (this.isGomeriaLabel(depositName)) {
        return `GOMERIA (${this.formatStateLabel(state, repairType)})`;
      }

      if (this.isAuxilioLabel(depositName)) {
        return 'AUXILIO';
      }

      return 'DEPOSITO';
    }

    if (location === 'SEMI' || location === 'TRACTOR') {
      return plate ? `${location} (${plate})` : location;
    }

    return location;
  }

  private isGomeriaLabel(value: string | null | undefined): boolean {
    const normalized = (value || '').trim().toLowerCase();
    return normalized.includes('gomeria') || normalized.includes('gomería') || normalized.includes('gomerÃ­a');
  }

  private isAuxilioLabel(value: string | null | undefined): boolean {
    const normalized = (value || '').trim().toLowerCase();
    return normalized.includes('auxilio');
  }
}
