import { CommonModule, NgFor } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ResourceItem, ResourceService } from '../../core/services/resource.service';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgFor],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Recursos</span>
        <h2>Alta de depositos, tractores y semis</h2>
        <p class="section-copy">Configura primero los destinos posibles para que luego las gomas puedan asignarse y moverse sin errores.</p>
      </div>
    </section>

    <section class="panel-grid three-columns">
      <article class="panel-card">
        <div class="panel-head"><h3>Depositos</h3><span class="chip">{{ filteredDeposits().length }}</span></div>
        <form class="form-grid compact" [formGroup]="depositForm" (ngSubmit)="saveDeposit()">
          <label class="field-label">
            <span>Nombre del deposito</span>
            <input type="text" placeholder="Deposito central" formControlName="name" />
          </label>
          <label class="field-label">
            <span>Descripcion</span>
            <textarea rows="2" placeholder="Observaciones del deposito" formControlName="description"></textarea>
          </label>
          <button class="primary-button" type="submit">Agregar</button>
        </form>
        <label class="field-label">
          <span>Buscar deposito</span>
          <input type="text" [value]="depositSearch" (input)="depositSearch = getInputValue($event)" placeholder="Escribe nombre o descripcion" />
        </label>
        <div class="simple-list resource-list-scroll">
          <div class="simple-item" *ngFor="let deposit of filteredDeposits()">
            <strong>{{ deposit.name }}</strong>
            <span>{{ deposit.description || 'Sin descripcion' }}</span>
            <button *ngIf="authService.getCurrentUser()?.role === 'ADMIN'" class="ghost-button danger" type="button" (click)="deleteDeposit(deposit)">Borrar</button>
          </div>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head"><h3>Tractores</h3><span class="chip">{{ filteredTractors().length }}</span></div>
        <form class="form-grid compact" [formGroup]="tractorForm" (ngSubmit)="saveTractor()">
          <label class="field-label">
            <span>Patente</span>
            <input type="text" placeholder="ABC123" formControlName="plate" />
          </label>
          <label class="field-label">
            <span>Marca</span>
            <input type="text" placeholder="Marca del tractor" formControlName="brand" />
          </label>
          <label class="field-label">
            <span>Modelo</span>
            <input type="text" placeholder="Modelo del tractor" formControlName="model" />
          </label>
          <button class="primary-button" type="submit">Agregar</button>
        </form>
        <label class="field-label">
          <span>Buscar tractor</span>
          <input type="text" [value]="tractorSearch" (input)="tractorSearch = getInputValue($event)" placeholder="Escribe patente, marca o modelo" />
        </label>
        <div class="simple-list resource-list-scroll">
          <div class="simple-item" *ngFor="let tractor of filteredTractors()">
            <strong>{{ tractor.plate }}</strong>
            <span>{{ tractor.brand || 'Marca no informada' }} {{ tractor.model ? '| ' + tractor.model : '' }}</span>
            <button *ngIf="authService.getCurrentUser()?.role === 'ADMIN'" class="ghost-button danger" type="button" (click)="deleteTractor(tractor)">Borrar</button>
          </div>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head"><h3>Semis</h3><span class="chip">{{ filteredSemis().length }}</span></div>
        <form class="form-grid compact" [formGroup]="semiForm" (ngSubmit)="saveSemi()">
          <label class="field-label">
            <span>Patente</span>
            <input type="text" placeholder="DEF456" formControlName="plate" />
          </label>
          <label class="field-label">
            <span>Marca</span>
            <input type="text" placeholder="Marca del semi" formControlName="brand" />
          </label>
          <label class="field-label">
            <span>Modelo</span>
            <input type="text" placeholder="Modelo del semi" formControlName="model" />
          </label>
          <button class="primary-button" type="submit">Agregar</button>
        </form>
        <label class="field-label">
          <span>Buscar semi</span>
          <input type="text" [value]="semiSearch" (input)="semiSearch = getInputValue($event)" placeholder="Escribe patente, marca o modelo" />
        </label>
        <div class="simple-list resource-list-scroll">
          <div class="simple-item" *ngFor="let semi of filteredSemis()">
            <strong>{{ semi.plate }}</strong>
            <span>{{ semi.brand || 'Marca no informada' }} {{ semi.model ? '| ' + semi.model : '' }}</span>
            <button *ngIf="authService.getCurrentUser()?.role === 'ADMIN'" class="ghost-button danger" type="button" (click)="deleteSemi(semi)">Borrar</button>
          </div>
        </div>
      </article>
    </section>
  `,
})
export class ResourcesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly resourceService = inject(ResourceService);
  private readonly notificationService = inject(NotificationService);
  readonly authService = inject(AuthService);

  deposits: ResourceItem[] = [];
  tractors: ResourceItem[] = [];
  semis: ResourceItem[] = [];
  depositSearch = '';
  tractorSearch = '';
  semiSearch = '';

  readonly depositForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  readonly tractorForm = this.fb.nonNullable.group({
    plate: ['', Validators.required],
    brand: [''],
    model: [''],
    description: [''],
  });

  readonly semiForm = this.fb.nonNullable.group({
    plate: ['', Validators.required],
    brand: [''],
    model: [''],
    description: [''],
  });

  ngOnInit(): void {
    this.loadResources();
  }

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  filteredDeposits(): ResourceItem[] {
    const query = this.normalize(this.depositSearch);
    if (!query) return this.deposits;
    return this.deposits.filter((deposit) => [deposit.name || '', deposit.description || ''].some((value) => this.normalize(value).includes(query)));
  }

  filteredTractors(): ResourceItem[] {
    const query = this.normalize(this.tractorSearch);
    if (!query) return this.tractors;
    return this.tractors.filter((tractor) => [tractor.plate || '', tractor.brand || '', tractor.model || ''].some((value) => this.normalize(value).includes(query)));
  }

  filteredSemis(): ResourceItem[] {
    const query = this.normalize(this.semiSearch);
    if (!query) return this.semis;
    return this.semis.filter((semi) => [semi.plate || '', semi.brand || '', semi.model || ''].some((value) => this.normalize(value).includes(query)));
  }

  loadResources(): void {
    this.resourceService.getDeposits().subscribe((items) => (this.deposits = items));
    this.resourceService.getTractors().subscribe((items) => (this.tractors = items));
    this.resourceService.getSemis().subscribe((items) => (this.semis = items));
  }

  saveDeposit(): void {
    this.resourceService.createDeposit(this.depositForm.getRawValue()).subscribe({
      next: () => {
        this.notificationService.show('success', 'Deposito creado.');
        this.depositForm.reset({ name: '', description: '' });
        this.loadResources();
      },
      error: (error) => this.notificationService.show('error', error.error?.message || 'No se pudo crear el deposito.'),
    });
  }

  saveTractor(): void {
    this.resourceService.createTractor(this.tractorForm.getRawValue()).subscribe({
      next: () => {
        this.notificationService.show('success', 'Tractor creado.');
        this.tractorForm.reset({ plate: '', brand: '', model: '', description: '' });
        this.loadResources();
      },
      error: (error) => this.notificationService.show('error', error.error?.message || 'No se pudo crear el tractor.'),
    });
  }

  saveSemi(): void {
    this.resourceService.createSemi(this.semiForm.getRawValue()).subscribe({
      next: () => {
        this.notificationService.show('success', 'Semi creado.');
        this.semiForm.reset({ plate: '', brand: '', model: '', description: '' });
        this.loadResources();
      },
      error: (error) => this.notificationService.show('error', error.error?.message || 'No se pudo crear el semi.'),
    });
  }

  deleteDeposit(deposit: ResourceItem): void {
    const confirmed = window.confirm(`¿Quieres borrar el deposito ${deposit.name}? Solo se eliminara si no aparece en ningun movimiento del historial.`);
    if (!confirmed) return;
    this.resourceService.deleteDeposit(deposit.id).subscribe({
      next: () => {
        this.notificationService.show('success', 'Deposito eliminado.');
        this.loadResources();
      },
      error: (error) => this.notificationService.show('error', error.error?.message || 'No se pudo eliminar el deposito.'),
    });
  }

  deleteTractor(tractor: ResourceItem): void {
    const confirmed = window.confirm(`¿Quieres borrar el tractor ${tractor.plate}? Solo se eliminara si no aparece en ningun movimiento del historial.`);
    if (!confirmed) return;
    this.resourceService.deleteTractor(tractor.id).subscribe({
      next: () => {
        this.notificationService.show('success', 'Tractor eliminado.');
        this.loadResources();
      },
      error: (error) => this.notificationService.show('error', error.error?.message || 'No se pudo eliminar el tractor.'),
    });
  }

  deleteSemi(semi: ResourceItem): void {
    const confirmed = window.confirm(`¿Quieres borrar el semi ${semi.plate}? Solo se eliminara si no aparece en ningun movimiento del historial.`);
    if (!confirmed) return;
    this.resourceService.deleteSemi(semi.id).subscribe({
      next: () => {
        this.notificationService.show('success', 'Semi eliminado.');
        this.loadResources();
      },
      error: (error) => this.notificationService.show('error', error.error?.message || 'No se pudo eliminar el semi.'),
    });
  }
}
