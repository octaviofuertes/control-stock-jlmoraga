import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ResourceItem, ResourceService } from '../../core/services/resource.service';
import { MovementHistory, Tire, TireService } from '../../core/services/tire.service';

interface TireGroupedSummary {
  stateLabel: string;
  brand: string;
  model: string;
  size: string;
  count: number;
}

@Component({
  selector: 'app-tires',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgFor, NgIf, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Inventario</span>
        <h2>Gestion de gomas y ubicaciones</h2>
        <p class="section-copy">Da de alta gomas, actualiza sus datos tecnicos y consulta su historial completo por unidad.</p>
      </div>
    </section>

    <section class="inventory-stack">
      <article class="panel-card compact-panel">
        <div class="panel-head">
          <h3>Filtros rapidos</h3>
          <span class="chip">{{ tires.length }} visibles</span>
        </div>
        <form class="inline-form" [formGroup]="filtersForm">
          <label class="field-label">
            <span>Busqueda</span>
            <input type="text" placeholder="Codigo, marca, modelo o medida" formControlName="search" />
          </label>
          <label class="field-label">
            <span>Estado</span>
            <select formControlName="state">
              <option value="">Todos los estados</option>
              <option value="NUEVA">Nueva</option>
              <option value="USADA">Usada</option>
              <option value="REPARADA">Reparada</option>
              <option value="BAJA">Baja</option>
            </select>
          </label>
          <label class="field-label">
            <span>Ubicacion</span>
            <select formControlName="locationType">
              <option value="">Todas las ubicaciones</option>
              <option value="DEPOSIT">Deposito</option>
              <option value="GOMERIA">Gomeria</option>
              <option value="AUXILIO">Auxilio</option>
              <option value="SEMI">Semi</option>
              <option value="TRACTOR">Tractor</option>
              <option value="DISCARDED">Descartada</option>
            </select>
          </label>
          <button class="secondary-button" type="button" (click)="loadTires()">Aplicar filtros</button>
        </form>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <h3>Stock actual</h3>
        </div>
        <div class="table-wrapper stock-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Medida</th>
                <th>Estado</th>
                <th>Observaciones</th>
                <th>Ubicacion</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let tire of tires">
                <td>{{ tire.code }}</td>
                <td>{{ tire.brand }}</td>
                <td>{{ tire.model }}</td>
                <td>{{ tire.size }}</td>
                <td><span class="chip">{{ formatStateLabel(tire.state, tire.repairType) }}</span></td>
                <td>
                  <div class="observation-cell" [title]="tire.notes || 'Sin observaciones'">
                    {{ tire.notes || 'Sin observaciones' }}
                  </div>
                </td>
                <td>
                  <strong>{{ tire.locationDetail.label }}</strong>
                  <div class="table-note">{{ getLocationCaption(tire) }}</div>
                </td>
                <td class="actions-cell">
                  <button *ngIf="tire.state !== 'BAJA'" class="ghost-button" type="button" (click)="editTire(tire)">Editar</button>
                  <button class="ghost-button danger" type="button" (click)="showHistory(tire)">Historial</button>
                  <button *ngIf="authService.getCurrentUser()?.role === 'ADMIN'" class="ghost-button danger" type="button" (click)="deleteTire(tire)">Borrar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <div class="inventory-bottom-grid">
        <article class="panel-card inventory-form-panel">
          <div class="panel-head">
            <h3>{{ editingId ? 'Editar goma' : 'Nueva goma' }}</h3>
            <span class="chip">{{ editingId ? 'Edicion' : 'Alta' }}</span>
          </div>
          <form class="form-grid" [formGroup]="tireForm" (ngSubmit)="saveTire()">
            <label class="field-label">
              <span>Marca</span>
              <input type="text" placeholder="Marca comercial" formControlName="brand" />
            </label>
            <label class="field-label">
              <span>Modelo</span>
              <input type="text" placeholder="Modelo del neumatico" formControlName="model" />
            </label>
            <label class="field-label">
              <span>Medida</span>
              <input type="text" placeholder="Ej: S, M, L" formControlName="size" />
            </label>
            <label class="field-label">
              <span>Estado</span>
              <select formControlName="state" (change)="onStateChange()">
                <option value="NUEVA">Nueva</option>
                <option value="USADA">Usada</option>
                <option value="REPARADA">Reparada</option>
                <option value="BAJA">Baja</option>
              </select>
            </label>
            <label class="field-label" *ngIf="tireForm.value.state === 'REPARADA'">
              <span>Tipo de reparacion</span>
              <select formControlName="repairType">
                <option value="">Seleccionar tipo</option>
                <option value="1">Reparada 1</option>
                <option value="2">Reparada 2</option>
                <option value="3">Reparada 3</option>
              </select>
            </label>
            <label class="field-label" *ngIf="!editingId && tireForm.value.state !== 'BAJA'">
              <span>Ubicacion actual</span>
              <select formControlName="currentLocation">
                <option value="DEPOSIT">Deposito</option>
                <option value="GOMERIA">Gomeria</option>
                <option value="AUXILIO">Auxilio</option>
                <option value="SEMI">Semi</option>
                <option value="TRACTOR">Tractor</option>
              </select>
            </label>
            <label class="field-label" *ngIf="editingId">
              <span>Ubicacion actual</span>
              <input type="text" [value]="editingLocationLabel" readonly />
            </label>
            <label class="field-label" *ngIf="!editingId && tireForm.value.state !== 'BAJA' && tireForm.value.currentLocation === 'DEPOSIT'">
              <span>Deposito asignado</span>
              <select formControlName="depositId">
                <option value="">Seleccionar deposito</option>
                <option *ngFor="let deposit of regularDeposits()" [value]="deposit.id">{{ deposit.name }}</option>
              </select>
            </label>
            <div class="field-label autocomplete-field" *ngIf="!editingId && tireForm.value.state !== 'BAJA' && tireForm.value.currentLocation === 'SEMI'">
              <span>Semi asignado</span>
              <input
                type="text"
                [value]="semiAssignmentQuery"
                (input)="onAssignedSemiInput($event)"
                (focus)="showAssignedSemiSuggestions = true"
                placeholder="Escribe patente, marca o modelo"
              />
              <div class="autocomplete-list" *ngIf="showAssignedSemiSuggestions && filteredAssignedSemis().length">
                <button type="button" class="autocomplete-item" *ngFor="let semi of filteredAssignedSemis()" (click)="selectAssignedSemi(semi)">
                  <strong>{{ semi.plate }}</strong>
                  <span>{{ semi.brand || 'Marca no informada' }} {{ semi.model ? '| ' + semi.model : '' }}</span>
                </button>
              </div>
            </div>
            <div class="field-label autocomplete-field" *ngIf="!editingId && tireForm.value.state !== 'BAJA' && tireForm.value.currentLocation === 'TRACTOR'">
              <span>Tractor asignado</span>
              <input
                type="text"
                [value]="tractorAssignmentQuery"
                (input)="onAssignedTractorInput($event)"
                (focus)="showAssignedTractorSuggestions = true"
                placeholder="Escribe patente, marca o modelo"
              />
              <div class="autocomplete-list" *ngIf="showAssignedTractorSuggestions && filteredAssignedTractors().length">
                <button type="button" class="autocomplete-item" *ngFor="let tractor of filteredAssignedTractors()" (click)="selectAssignedTractor(tractor)">
                  <strong>{{ tractor.plate }}</strong>
                  <span>{{ tractor.brand || 'Marca no informada' }} {{ tractor.model ? '| ' + tractor.model : '' }}</span>
                </button>
              </div>
            </div>
            <label class="field-label full-span">
              <span>Observaciones</span>
              <textarea rows="3" placeholder="Comentarios tecnicos o notas internas" formControlName="notes"></textarea>
            </label>
            <div class="form-actions">
              <button class="primary-button" type="submit">{{ editingId ? 'Actualizar' : 'Guardar' }}</button>
              <button class="ghost-button" type="button" (click)="resetForm()">Limpiar</button>
            </div>
          </form>
        </article>

        <article class="panel-card compact-panel">
          <div class="panel-head">
            <h3>Resumen por tipo</h3>
            <span class="chip">{{ groupedTireSummaries.length }} grupos</span>
          </div>
          <div class="table-wrapper grouped-tires-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Medida</th>
                  <th>Cant.</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let group of groupedTireSummaries">
                  <td>{{ group.stateLabel }}</td>
                  <td>{{ group.brand }}</td>
                  <td>{{ group.model }}</td>
                  <td>{{ group.size }}</td>
                  <td><strong>{{ group.count }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>

    <section class="panel-grid">
      <article class="panel-card">
        <div class="panel-head">
          <h3>{{ selectedTire ? 'Historial de goma ' + selectedTire.brand + ', ' + selectedTire.model + ', ' + selectedTire.size : 'Historial' }}</h3>
        </div>
        <div class="timeline tire-history-timeline" *ngIf="history.length; else emptyHistory">
          <div class="timeline-item" *ngFor="let item of history">
            <div>
              <strong>Goma {{ item.tire?.code || selectedTire?.code }}</strong>
              <p>{{ item.tire?.brand || selectedTire?.brand }} | {{ item.tire?.model || selectedTire?.model }} | {{ item.tire?.size || selectedTire?.size }} | {{ formatStateLabel(item.newState, item.newRepairType) }}</p>
              <strong>{{ formatMovementLocation(item.previousLocation, item.previousState, item.previousRepairType, item.previousDepositName) }} -> {{ formatMovementLocation(item.newLocation, item.newState, item.newRepairType, item.newDepositName, item.newPlate) }}</strong>
              <p *ngIf="hasStateChange(item)">{{ formatStateTransition(item.previousState, item.previousRepairType, item.newState, item.newRepairType) }}</p>
              <p>{{ item.previousPlate || 'Sin patente' }} -> {{ item.newPlate || 'Sin patente' }}</p>
              <p>{{ item.notes || 'Sin observaciones' }}</p>
            </div>
            <small>{{ item.user.name }} | {{ item.createdAt | date:'short' }}</small>
          </div>
        </div>
        <ng-template #emptyHistory>
          <p class="empty-state">Selecciona una goma para ver su historial de movimientos.</p>
        </ng-template>
      </article>
    </section>
  `,
  styles: [`
    .observation-cell {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
})
export class TiresComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tireService = inject(TireService);
  private readonly resourceService = inject(ResourceService);
  private readonly notificationService = inject(NotificationService);
  readonly authService = inject(AuthService);

  tires: Tire[] = [];
  history: MovementHistory[] = [];
  selectedTire: Tire | null = null;
  editingId: string | null = null;
  deposits: ResourceItem[] = [];
  tractors: ResourceItem[] = [];
  semis: ResourceItem[] = [];
  semiAssignmentQuery = '';
  tractorAssignmentQuery = '';
  showAssignedSemiSuggestions = false;
  showAssignedTractorSuggestions = false;
  editingLocationLabel = '';

  get groupedTireSummaries(): TireGroupedSummary[] {
    const groups = new Map<string, TireGroupedSummary>();

    this.tires.forEach((tire) => {
      const stateLabel = this.formatStateLabel(tire.state, tire.repairType);
      const brand = tire.brand || 'Sin marca';
      const model = tire.model || 'Sin modelo';
      const size = tire.size || 'Sin medida';
      const key = `${stateLabel}__${brand}__${model}__${size}`;
      const existing = groups.get(key);

      if (existing) {
        existing.count += 1;
        return;
      }

      groups.set(key, {
        stateLabel,
        brand,
        model,
        size,
        count: 1,
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return `${a.stateLabel}${a.brand}${a.model}${a.size}`.localeCompare(`${b.stateLabel}${b.brand}${b.model}${b.size}`);
    });
  }

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    state: [''],
    locationType: [''],
  });

  readonly tireForm = this.fb.nonNullable.group({
    code: [''],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    size: ['', Validators.required],
    state: ['NUEVA', Validators.required],
    repairType: [''],
    currentLocation: ['DEPOSIT', Validators.required],
    depositId: [''],
    semiId: [''],
    tractorId: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadResources();
    this.loadTires();
  }

  loadResources(): void {
    this.resourceService.getDeposits().subscribe((items) => (this.deposits = items));
    this.resourceService.getTractors().subscribe((items) => (this.tractors = items));
    this.resourceService.getSemis().subscribe((items) => (this.semis = items));
  }

  loadTires(): void {
    const filters = this.filtersForm.getRawValue();
    this.tireService.getAll({
      ...filters,
      locationType:
        filters.locationType === 'GOMERIA' || filters.locationType === 'AUXILIO' || filters.locationType === 'DISCARDED'
          ? 'DEPOSIT'
          : filters.locationType,
    }).subscribe((items) => {
      const normalizedSearch = (filters.search || '').trim().toLowerCase();
      const shouldShowDiscardedBySearch = !!normalizedSearch;

      const resolvedItems =
        filters.locationType === 'DISCARDED'
          ? items.filter((tire) => tire.state === 'BAJA')
          : filters.locationType === 'GOMERIA'
          ? items.filter((tire) => this.isGomeriaLabel(tire.locationDetail.label))
          : filters.locationType === 'AUXILIO'
            ? items.filter((tire) => this.isAuxilioLabel(tire.locationDetail.label))
            : filters.locationType === 'DEPOSIT'
              ? items.filter((tire) => tire.state !== 'BAJA' && !this.isGomeriaLabel(tire.locationDetail.label) && !this.isAuxilioLabel(tire.locationDetail.label))
              : filters.locationType === 'SEMI' || filters.locationType === 'TRACTOR'
                ? items.filter((tire) => tire.state !== 'BAJA')
              : items;

      this.tires =
        filters.state === 'BAJA' || filters.locationType === 'DISCARDED' || shouldShowDiscardedBySearch
          ? resolvedItems
          : resolvedItems.filter((tire) => tire.state !== 'BAJA');
    });
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  filteredAssignedTractors(): ResourceItem[] {
    const query = this.normalize(this.tractorAssignmentQuery);
    const items = !query
      ? this.tractors
      : this.tractors.filter((tractor) => [tractor.plate || '', tractor.brand || '', tractor.model || ''].some((value) => this.normalize(value).includes(query)));
    return items.slice(0, 6);
  }

  filteredAssignedSemis(): ResourceItem[] {
    const query = this.normalize(this.semiAssignmentQuery);
    const items = !query
      ? this.semis
      : this.semis.filter((semi) => [semi.plate || '', semi.brand || '', semi.model || ''].some((value) => this.normalize(value).includes(query)));
    return items.slice(0, 6);
  }

  regularDeposits(): ResourceItem[] {
    return this.deposits.filter((deposit) => !this.isGomeriaLabel(deposit.name || '') && !this.isAuxilioLabel(deposit.name || ''));
  }

  onAssignedSemiInput(event: Event): void {
    this.semiAssignmentQuery = (event.target as HTMLInputElement).value;
    this.tireForm.patchValue({ semiId: '' });
    this.showAssignedSemiSuggestions = true;
  }

  selectAssignedSemi(semi: ResourceItem): void {
    this.semiAssignmentQuery = semi.plate || '';
    this.tireForm.patchValue({ semiId: semi.id });
    this.showAssignedSemiSuggestions = false;
  }

  onAssignedTractorInput(event: Event): void {
    this.tractorAssignmentQuery = (event.target as HTMLInputElement).value;
    this.tireForm.patchValue({ tractorId: '' });
    this.showAssignedTractorSuggestions = true;
  }

  selectAssignedTractor(tractor: ResourceItem): void {
    this.tractorAssignmentQuery = tractor.plate || '';
    this.tireForm.patchValue({ tractorId: tractor.id });
    this.showAssignedTractorSuggestions = false;
  }

  onStateChange(): void {
    if (this.tireForm.value.state !== 'REPARADA') {
      this.tireForm.patchValue({ repairType: '' });
    }

    if (this.tireForm.value.state === 'BAJA') {
      this.tireForm.patchValue({
        currentLocation: 'DEPOSIT',
        depositId: '',
        semiId: '',
        tractorId: '',
      });
      this.semiAssignmentQuery = '';
      this.tractorAssignmentQuery = '';
      this.showAssignedSemiSuggestions = false;
      this.showAssignedTractorSuggestions = false;
    }
  }

  getLocationCaption(tire: Tire): string {
    if (tire.state === 'BAJA') {
      return 'Goma fuera de servicio';
    }

    if (tire.locationDetail.type === 'DEPOSIT') {
      if (this.isGomeriaLabel(tire.locationDetail.label)) {
        return 'Ubicada en gomeria';
      }

      if (this.isAuxilioLabel(tire.locationDetail.label)) {
        return 'Ubicada en auxilio';
      }

      return 'Ubicada en deposito';
    }

    return tire.locationDetail.plate ? `Patente ${tire.locationDetail.plate}` : 'Vehiculo asignado';
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

  formatStateTransition(previousState: string | null, previousRepairType: number | null, nextState: string | null, nextRepairType: number | null): string {
    return `Estado: ${this.formatStateLabel(previousState, previousRepairType)} -> ${this.formatStateLabel(nextState, nextRepairType)}`;
  }

  hasStateChange(item: MovementHistory): boolean {
    return item.previousState !== item.newState || (item.previousRepairType || null) !== (item.newRepairType || null);
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

  saveTire(): void {
    if (this.tireForm.invalid) {
      this.tireForm.markAllAsTouched();
      return;
    }

    const raw = this.tireForm.getRawValue();
    if (raw.state === 'REPARADA' && !raw.repairType) {
      this.notificationService.show('error', 'Debes elegir un tipo de reparacion para una goma reparada.');
      return;
    }

    const request =
      raw.state === 'BAJA'
        ? this.editingId
          ? this.tireService.update(this.editingId, raw)
          : this.tireService.create(raw)
        : raw.currentLocation === 'GOMERIA'
        ? this.ensureGomeriaDeposit().pipe(
            switchMap((deposit) => {
              this.deposits = [...this.deposits.filter((item) => item.id !== deposit.id), deposit];
              const payload = {
                ...raw,
                currentLocation: 'DEPOSIT',
                depositId: deposit.id,
              };
              return this.editingId ? this.tireService.update(this.editingId, payload) : this.tireService.create(payload);
            }),
          )
        : raw.currentLocation === 'AUXILIO'
          ? this.ensureAuxilioDeposit().pipe(
              switchMap((deposit) => {
                this.deposits = [...this.deposits.filter((item) => item.id !== deposit.id), deposit];
                const payload = {
                  ...raw,
                  currentLocation: 'DEPOSIT',
                  depositId: deposit.id,
                };
                return this.editingId ? this.tireService.update(this.editingId, payload) : this.tireService.create(payload);
              }),
            )
        : this.editingId
          ? this.tireService.update(this.editingId, raw)
          : this.tireService.create(raw);

    request.subscribe({
      next: () => {
        this.notificationService.show('success', this.editingId ? 'Goma actualizada.' : 'Goma registrada.');
        this.resetForm();
        this.loadTires();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo guardar la goma.');
      },
    });
  }

  editTire(tire: Tire): void {
    if (tire.state === 'BAJA') {
      this.notificationService.show('error', 'Una goma dada de baja no se puede editar.');
      return;
    }

    this.editingId = tire.id;
    this.editingLocationLabel = tire.locationDetail.label;
    this.tireForm.patchValue({
      code: tire.code,
      brand: tire.brand,
      model: tire.model,
      size: tire.size,
      state: tire.state,
      repairType: tire.repairType ? String(tire.repairType) : '',
      currentLocation:
        tire.state === 'BAJA'
          ? 'DEPOSIT'
          : this.isGomeriaLabel(tire.locationDetail.label)
            ? 'GOMERIA'
            : this.isAuxilioLabel(tire.locationDetail.label)
              ? 'AUXILIO'
              : tire.currentLocation,
      depositId:
        tire.currentLocation === 'DEPOSIT' && !this.isGomeriaLabel(tire.locationDetail.label) && !this.isAuxilioLabel(tire.locationDetail.label)
          ? this.findDepositIdByLabel(tire.locationDetail.label)
          : '',
      semiId: tire.currentLocation === 'SEMI' ? this.findSemiIdByPlate(tire.locationDetail.plate) : '',
      tractorId: tire.currentLocation === 'TRACTOR' ? this.findTractorIdByPlate(tire.locationDetail.plate) : '',
      notes: tire.notes || '',
    });
    this.semiAssignmentQuery = tire.currentLocation === 'SEMI' ? tire.locationDetail.plate || '' : '';
    this.tractorAssignmentQuery = tire.currentLocation === 'TRACTOR' ? tire.locationDetail.plate || '' : '';
    this.showAssignedSemiSuggestions = false;
    this.showAssignedTractorSuggestions = false;
  }

  showHistory(tire: Tire): void {
    this.selectedTire = tire;
    this.tireService.getHistory(tire.id).subscribe((history) => (this.history = history));
  }

  deleteTire(tire: Tire): void {
    const confirmed = window.confirm(`Quieres borrar la goma ${tire.code}? Solo se eliminara si no aparece en ningun movimiento del historial.`);
    if (!confirmed) {
      return;
    }

    this.tireService.delete(tire.id).subscribe({
      next: () => {
        this.notificationService.show('success', 'Goma eliminada correctamente.');
        if (this.selectedTire?.id === tire.id) {
          this.selectedTire = null;
          this.history = [];
        }
        this.loadTires();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo eliminar la goma.');
      },
    });
  }

  private getGomeriaDeposit(): ResourceItem | undefined {
    return this.deposits.find((deposit) => this.isGomeriaLabel(deposit.name || ''));
  }

  private ensureGomeriaDeposit(): Observable<ResourceItem> {
    const existing = this.getGomeriaDeposit();
    if (existing) {
      return of(existing);
    }

    return this.resourceService.createDeposit({
      name: 'Gomeria',
      description: 'Deposito unico para trabajos de gomeria',
    });
  }

  private isGomeriaLabel(value: string | null | undefined): boolean {
    const name = (value || '').trim().toLowerCase();
    return name.includes('gomeria') || name.includes('gomerÃ­a');
  }

  private getAuxilioDeposit(): ResourceItem | undefined {
    return this.deposits.find((deposit) => this.isAuxilioLabel(deposit.name || ''));
  }

  private ensureAuxilioDeposit(): Observable<ResourceItem> {
    const existing = this.getAuxilioDeposit();
    if (existing) {
      return of(existing);
    }

    return this.resourceService.createDeposit({
      name: 'Auxilio',
      description: 'Deposito unico para auxilios',
    });
  }

  private isAuxilioLabel(value: string | null | undefined): boolean {
    const name = (value || '').trim().toLowerCase();
    return name.includes('auxilio');
  }

  private findDepositIdByLabel(label: string): string {
    return this.deposits.find((deposit) => deposit.name === label)?.id || '';
  }

  private findSemiIdByPlate(plate: string | null): string {
    return this.semis.find((semi) => semi.plate === plate)?.id || '';
  }

  private findTractorIdByPlate(plate: string | null): string {
    return this.tractors.find((tractor) => tractor.plate === plate)?.id || '';
  }

  resetForm(): void {
    this.editingId = null;
    this.editingLocationLabel = '';
    this.semiAssignmentQuery = '';
    this.tractorAssignmentQuery = '';
    this.showAssignedSemiSuggestions = false;
    this.showAssignedTractorSuggestions = false;
    this.tireForm.reset({
      code: '',
      brand: '',
      model: '',
      size: '',
      state: 'NUEVA',
      repairType: '',
      currentLocation: 'DEPOSIT',
      depositId: '',
      semiId: '',
      tractorId: '',
      notes: '',
    });
  }
}
