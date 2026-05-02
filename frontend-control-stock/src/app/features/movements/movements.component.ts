import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { Movement, MovementService } from '../../core/services/movement.service';
import { NotificationService } from '../../core/services/notification.service';
import { ResourceItem, ResourceService } from '../../core/services/resource.service';
import { Tire, TireService } from '../../core/services/tire.service';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgFor, NgIf, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Movimientos</span>
        <h2>Traslado de gomas entre deposito, semis, tractores y baja</h2>
        <p class="section-copy">Registra cada cambio de ubicacion o estado con trazabilidad completa de responsable, fecha y observaciones.</p>
      </div>
    </section>

    <section class="panel-grid two-columns">
      <article class="panel-card">
        <div class="panel-head">
          <h3>Registrar movimiento</h3>
          <span class="chip">{{ movements.length }} movimientos</span>
        </div>
        <form class="form-grid" [formGroup]="form" (ngSubmit)="saveMovement()">
          <div class="field-label autocomplete-field">
            <span>Goma a mover</span>
            <input
              type="text"
              [value]="tireQuery"
              (input)="onTireInput($event)"
              (focus)="showTireSuggestions = true"
              placeholder="Escribe codigo, marca, medida o ubicacion"
            />
            <div class="autocomplete-list" *ngIf="showTireSuggestions && filteredTires().length">
              <button type="button" class="autocomplete-item" *ngFor="let tire of filteredTires()" (click)="selectTire(tire)">
                <strong>{{ tire.code }}</strong>
                <span>{{ tire.brand }} | {{ tire.size }} | {{ formatStateLabel(tire.state, tire.repairType) }} | {{ tire.locationDetail.label }}</span>
              </button>
            </div>
          </div>

          <label class="field-label">
            <span>Nuevo destino</span>
            <select formControlName="newLocation" (change)="resetDestinationSelection()">
              <option value="DEPOSIT">Mover a deposito</option>
              <option value="GOMERIA">Mover a gomeria</option>
              <option value="AUXILIO">Mover a auxilio</option>
              <option value="SEMI">Mover a semi</option>
              <option value="TRACTOR">Mover a tractor</option>
              <option value="BAJA">Mover a baja</option>
            </select>
          </label>

          <div class="field-label autocomplete-field" *ngIf="form.value.newLocation === 'DEPOSIT'">
            <span>Deposito destino</span>
            <input
              type="text"
              [value]="depositQuery"
              (input)="onDepositInput($event)"
              (focus)="showDepositSuggestions = true"
              placeholder="Escribe nombre del deposito"
            />
            <div class="autocomplete-list" *ngIf="showDepositSuggestions && filteredDeposits().length">
              <button type="button" class="autocomplete-item" *ngFor="let deposit of filteredDeposits()" (click)="selectDeposit(deposit)">
                <strong>{{ deposit.name }}</strong>
                <span>{{ deposit.description || 'Sin descripcion' }}</span>
              </button>
            </div>
          </div>

          <div class="field-label autocomplete-field" *ngIf="form.value.newLocation === 'SEMI'">
            <span>Semi destino</span>
            <input
              type="text"
              [value]="semiQuery"
              (input)="onSemiInput($event)"
              (focus)="showSemiSuggestions = true"
              placeholder="Escribe patente, marca o modelo"
            />
            <div class="autocomplete-list" *ngIf="showSemiSuggestions && filteredSemis().length">
              <button type="button" class="autocomplete-item" *ngFor="let semi of filteredSemis()" (click)="selectSemi(semi)">
                <strong>{{ semi.plate }}</strong>
                <span>{{ semi.brand || 'Marca no informada' }} {{ semi.model ? '| ' + semi.model : '' }}</span>
              </button>
            </div>
          </div>

          <div class="field-label autocomplete-field" *ngIf="form.value.newLocation === 'TRACTOR'">
            <span>Tractor destino</span>
            <input
              type="text"
              [value]="tractorQuery"
              (input)="onTractorInput($event)"
              (focus)="showTractorSuggestions = true"
              placeholder="Escribe patente, marca o modelo"
            />
            <div class="autocomplete-list" *ngIf="showTractorSuggestions && filteredTractors().length">
              <button type="button" class="autocomplete-item" *ngFor="let tractor of filteredTractors()" (click)="selectTractor(tractor)">
                <strong>{{ tractor.plate }}</strong>
                <span>{{ tractor.brand || 'Marca no informada' }} {{ tractor.model ? '| ' + tractor.model : '' }}</span>
              </button>
            </div>
          </div>

          <label class="field-label" *ngIf="form.value.newLocation === 'GOMERIA'">
            <span>Tipo de reparacion</span>
            <select formControlName="repairType">
              <option value="">Seleccionar tipo</option>
              <option value="1">Reparada 1</option>
              <option value="2">Reparada 2</option>
              <option value="3">Reparada 3</option>
            </select>
          </label>

          <label class="field-label full-span">
            <span>Observacion del traslado</span>
            <textarea rows="3" placeholder="Motivo del movimiento o comentario tecnico" formControlName="notes"></textarea>
          </label>
          <div class="form-actions">
            <button class="primary-button" type="submit">Guardar movimiento</button>
          </div>
        </form>
      </article>

      <article class="panel-card history-panel">
        <div class="panel-head">
          <h3>Historial global</h3>
        </div>
        <div class="timeline history-timeline">
          <div class="timeline-item" *ngFor="let movement of movements">
            <div>
              <strong>Goma {{ movement.tire.code }}</strong>
              <p>{{ movement.tire.brand }} | {{ movement.tire.model }} | {{ movement.tire.size }} | {{ formatStateLabel(movement.newState, movement.newRepairType) }}</p>
              <p>{{ formatMovementLocation(movement.previousLocation, movement.previousState, movement.previousRepairType, movement.previousDepositName) }} -> {{ formatMovementLocation(movement.newLocation, movement.newState, movement.newRepairType, movement.newDepositName, movement.newPlate) }}</p>
              <p *ngIf="hasStateChange(movement)">{{ formatStateTransition(movement.previousState, movement.previousRepairType, movement.newState, movement.newRepairType) }}</p>
              <p>{{ movement.notes || 'Sin observaciones' }}</p>
            </div>
            <small>{{ movement.user.name }} | {{ movement.createdAt | date:'short' }}</small>
          </div>
        </div>
      </article>
    </section>
  `,
})
export class MovementsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly movementService = inject(MovementService);
  private readonly tireService = inject(TireService);
  private readonly resourceService = inject(ResourceService);
  private readonly notificationService = inject(NotificationService);

  tires: Tire[] = [];
  movements: Movement[] = [];
  deposits: ResourceItem[] = [];
  tractors: ResourceItem[] = [];
  semis: ResourceItem[] = [];

  tireQuery = '';
  depositQuery = '';
  tractorQuery = '';
  semiQuery = '';

  showTireSuggestions = false;
  showDepositSuggestions = false;
  showTractorSuggestions = false;
  showSemiSuggestions = false;

  readonly form = this.fb.nonNullable.group({
    tireId: ['', Validators.required],
    newLocation: ['DEPOSIT', Validators.required],
    depositId: [''],
    semiId: [''],
    tractorId: [''],
    repairType: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadData();
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  filteredTires(): Tire[] {
    const query = this.normalize(this.tireQuery);
    const availableTires = this.tires.filter((tire) => tire.state !== 'BAJA');
    const items = !query
      ? availableTires
      : availableTires.filter((tire) =>
          [tire.code, tire.brand, tire.model, tire.size, tire.locationDetail.label].some((value) => this.normalize(value).includes(query)),
        );
    return items.slice(0, 6);
  }

  filteredDeposits(): ResourceItem[] {
    const query = this.normalize(this.depositQuery);
    const availableDeposits = this.deposits.filter((deposit) => {
      const name = (deposit.name || '').trim().toLowerCase();
      return !this.isGomeriaName(name) && !this.isAuxilioName(name);
    });
    const items = !query
      ? availableDeposits
      : availableDeposits.filter((deposit) => [deposit.name || '', deposit.description || ''].some((value) => this.normalize(value).includes(query)));
    return items.slice(0, 6);
  }

  filteredTractors(): ResourceItem[] {
    const query = this.normalize(this.tractorQuery);
    const items = !query
      ? this.tractors
      : this.tractors.filter((tractor) => [tractor.plate || '', tractor.brand || '', tractor.model || ''].some((value) => this.normalize(value).includes(query)));
    return items.slice(0, 6);
  }

  filteredSemis(): ResourceItem[] {
    const query = this.normalize(this.semiQuery);
    const items = !query
      ? this.semis
      : this.semis.filter((semi) => [semi.plate || '', semi.brand || '', semi.model || ''].some((value) => this.normalize(value).includes(query)));
    return items.slice(0, 6);
  }

  onTireInput(event: Event): void {
    this.tireQuery = this.inputValue(event);
    this.form.patchValue({ tireId: '' });
    this.showTireSuggestions = true;
  }

  onDepositInput(event: Event): void {
    this.depositQuery = this.inputValue(event);
    this.form.patchValue({ depositId: '' });
    this.showDepositSuggestions = true;
  }

  onTractorInput(event: Event): void {
    this.tractorQuery = this.inputValue(event);
    this.form.patchValue({ tractorId: '' });
    this.showTractorSuggestions = true;
  }

  onSemiInput(event: Event): void {
    this.semiQuery = this.inputValue(event);
    this.form.patchValue({ semiId: '' });
    this.showSemiSuggestions = true;
  }

  selectTire(tire: Tire): void {
    this.tireQuery = `${tire.code} | ${tire.locationDetail.label}`;
    this.form.patchValue({ tireId: tire.id });
    this.showTireSuggestions = false;
  }

  selectDeposit(deposit: ResourceItem): void {
    this.depositQuery = deposit.name || '';
    this.form.patchValue({ depositId: deposit.id });
    this.showDepositSuggestions = false;
  }

  selectSemi(semi: ResourceItem): void {
    this.semiQuery = semi.plate || '';
    this.form.patchValue({ semiId: semi.id });
    this.showSemiSuggestions = false;
  }

  selectTractor(tractor: ResourceItem): void {
    this.tractorQuery = tractor.plate || '';
    this.form.patchValue({ tractorId: tractor.id });
    this.showTractorSuggestions = false;
  }

  resetDestinationSelection(): void {
    this.depositQuery = '';
    this.semiQuery = '';
    this.tractorQuery = '';
    this.form.patchValue({ depositId: '', semiId: '', tractorId: '', repairType: '' });
    this.showDepositSuggestions = false;
    this.showSemiSuggestions = false;
    this.showTractorSuggestions = false;
  }

  private getSpecialDepositByName(type: 'gomeria' | 'auxilio'): ResourceItem | undefined {
    return this.deposits.find((deposit) => {
      const name = (deposit.name || '').trim().toLowerCase();
      return type === 'gomeria' ? this.isGomeriaName(name) : this.isAuxilioName(name);
    });
  }

  private ensureSpecialDeposit(type: 'gomeria' | 'auxilio'): Observable<ResourceItem> {
    const existing = this.getSpecialDepositByName(type);
    if (existing) {
      return of(existing);
    }

    return this.resourceService.createDeposit({
      name: type === 'gomeria' ? 'Gomeria' : 'Auxilio',
      description: type === 'gomeria' ? 'Deposito unico para trabajos de gomeria' : 'Deposito unico para auxilios',
    });
  }

  loadData(): void {
    this.tireService.getAll({}).subscribe((items) => (this.tires = items));
    this.movementService.getAll().subscribe((items) => (this.movements = items));
    this.resourceService.getDeposits().subscribe((items) => (this.deposits = items));
    this.resourceService.getTractors().subscribe((items) => (this.tractors = items));
    this.resourceService.getSemis().subscribe((items) => (this.semis = items));
  }

  saveMovement(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.newLocation === 'GOMERIA' && !raw.repairType) {
      this.notificationService.show('error', 'Debes elegir un tipo de reparacion para enviar la goma a gomeria.');
      return;
    }

    const request =
      raw.newLocation === 'GOMERIA'
        ? this.ensureSpecialDeposit('gomeria').pipe(
            switchMap((deposit) => {
              this.deposits = [...this.deposits.filter((item) => item.id !== deposit.id), deposit];
              return this.movementService.create({
                ...raw,
                newLocation: 'DEPOSIT',
                depositId: deposit.id,
              });
            }),
          )
        : raw.newLocation === 'AUXILIO'
          ? this.ensureSpecialDeposit('auxilio').pipe(
              switchMap((deposit) => {
                this.deposits = [...this.deposits.filter((item) => item.id !== deposit.id), deposit];
                return this.movementService.create({
                  ...raw,
                  newLocation: 'DEPOSIT',
                  depositId: deposit.id,
                });
              }),
            )
          : this.movementService.create(raw);

    request.subscribe({
      next: () => {
        this.notificationService.show('success', 'Movimiento registrado correctamente.');
        this.form.patchValue({ tireId: '', notes: '', depositId: '', semiId: '', tractorId: '', repairType: '', newLocation: 'DEPOSIT' });
        this.tireQuery = '';
        this.depositQuery = '';
        this.semiQuery = '';
        this.tractorQuery = '';
        this.loadData();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo registrar el movimiento.');
      },
    });
  }

  hasStateChange(movement: Movement): boolean {
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
      if (this.isGomeriaName(depositName)) {
        return `GOMERIA (${this.formatStateLabel(state, repairType)})`;
      }

      if (this.isAuxilioName(depositName)) {
        return 'AUXILIO';
      }

      return 'DEPOSITO';
    }

    if (location === 'SEMI' || location === 'TRACTOR') {
      return plate ? `${location} (${plate})` : location;
    }

    return location;
  }

  private isGomeriaName(value: string | null | undefined): boolean {
    const name = (value || '').trim().toLowerCase();
    return name.includes('gomeria') || name.includes('gomerÃ­a') || name.includes('gomerÃƒÂ­a');
  }

  private isAuxilioName(value: string | null | undefined): boolean {
    const name = (value || '').trim().toLowerCase();
    return name.includes('auxilio');
  }
}
