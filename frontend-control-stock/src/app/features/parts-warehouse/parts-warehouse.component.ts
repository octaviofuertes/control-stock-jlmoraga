import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { OilStockState, PartsWarehouseService, SpareCategory, SpareItem } from '../../core/services/parts-warehouse.service';

// Los clics seguidos sobre un repuesto se envian juntos como un unico movimiento.
const STOCK_BATCH_DELAY_MS = 700;

@Component({
  selector: 'app-parts-warehouse',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  template: `
    <section class="page-header">
      <div>
        <span class="eyebrow">Almacen</span>
        <h2>Almacen de repuestos</h2>
        <p class="section-copy">Controla focos, ferreteria y el stock de aceite desde un apartado independiente, visual y rapido de usar.</p>
      </div>
    </section>

    <section class="parts-layout">
      <article class="panel-card oil-panel">
        <div class="panel-head">
          <div>
            <h3>Aceite</h3>
            <p class="parts-copy">Barril predeterminado para llevar litros cargados y consumidos.</p>
          </div>
          <span class="chip">{{ oil.currentLiters }} / {{ oil.capacityLiters }} L</span>
        </div>

        <div class="oil-hero">
          <div class="oil-barrel-shell">
            <div class="oil-barrel-top"></div>
            <div class="oil-liquid" [style.height.%]="oilPercentage">
              <div class="oil-wave oil-wave-one"></div>
              <div class="oil-wave oil-wave-two"></div>
            </div>
            <div class="oil-barrel-label">
              <strong>{{ oil.currentLiters }} L</strong>
              <span>Aceite disponible</span>
            </div>
          </div>

          <div class="oil-stats">
            <article class="oil-stat-card">
              <span>Disponible</span>
              <strong>{{ oil.currentLiters }} L</strong>
              <small>{{ oilPercentage | number:'1.0-0' }}% del barril</small>
            </article>
            <article class="oil-stat-card">
              <span>Capacidad</span>
              <strong>{{ oil.capacityLiters }} L</strong>
              <small>Barril principal del taller</small>
            </article>
          </div>
        </div>

        <form class="oil-controls" [formGroup]="oilForm">
          <label class="field-label">
            <span>Litros</span>
            <input type="number" min="1" [max]="oil.capacityLiters" formControlName="liters" placeholder="Ej: 100" />
          </label>
          <button class="primary-button" type="button" (click)="addOil()">Cargar aceite</button>
          <button class="ghost-button danger" type="button" (click)="consumeOil()">Descontar uso</button>
        </form>
      </article>

      <article class="panel-card spare-form-panel">
        <div class="panel-head">
          <div>
            <h3>Nuevo repuesto</h3>
            <p class="parts-copy">Crea articulos de stock rapido para focos o ferreteria.</p>
          </div>
          <span class="chip">{{ items.length }} productos</span>
        </div>

        <form class="form-grid" [formGroup]="spareForm" (ngSubmit)="createSpare()">
          <label class="field-label full-span">
            <span>Nombre del producto</span>
            <input type="text" formControlName="name" placeholder="Ej: Faros delanteros, tornillos, luces de galibo" />
          </label>
          <label class="field-label">
            <span>Categoria</span>
            <select formControlName="category">
              <option value="FOCOS">Focos</option>
              <option value="FERRETERIA">Ferreteria</option>
            </select>
          </label>
          <label class="field-label">
            <span>Stock inicial</span>
            <input type="number" min="0" formControlName="stock" />
          </label>
          <div class="form-actions">
            <button class="primary-button" type="submit">Agregar repuesto</button>
            <button class="ghost-button" type="button" (click)="resetSpareForm()">Limpiar</button>
          </div>
        </form>
      </article>
    </section>

    <section class="parts-grid">
      <article class="panel-card">
        <div class="panel-head">
          <div class="parts-section-title">
            <div class="parts-icon bulb-icon" aria-hidden="true">
              <span class="bulb-glow"></span>
              <span class="bulb-body"></span>
              <span class="bulb-base"></span>
            </div>
            <div>
              <h3>Focos</h3>
              <p class="parts-copy">Luces, faros y repuestos electricos listos para uso.</p>
            </div>
          </div>
          <span class="chip">{{ focos.length }} items</span>
        </div>

        <div class="parts-list-scroll">
          <article class="spare-item-card" *ngFor="let item of focos; trackBy: trackById">
            <div>
              <strong>{{ item.name }}</strong>
              <p>Stock actual en almacen</p>
              <small class="spare-movement-copy">
                Movimiento:
                <ng-container *ngIf="item.latestMovement; else noFocoMovement">
                  {{ item.latestMovement.action === 'ADD' ? '+' : '-' }}{{ item.latestMovement.quantity }}
                  por {{ item.latestMovement.userName }}
                  | {{ item.latestMovement.createdAt | date:'dd/MM/yyyy HH:mm' }}
                </ng-container>
                <ng-template #noFocoMovement>Sin movimientos</ng-template>
              </small>
            </div>
            <div class="spare-stock-controls">
              <button class="stock-stepper" type="button" (click)="changeStock(item, -1)">-</button>
              <span class="spare-stock-value">{{ item.stock }}</span>
              <button class="stock-stepper" type="button" (click)="changeStock(item, 1)">+</button>
              <button *ngIf="isAdmin" class="ghost-button danger compact-delete" type="button" (click)="deleteItem(item)">Borrar</button>
            </div>
          </article>
          <p class="empty-state" *ngIf="!focos.length">Todavia no hay focos cargados.</p>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div class="parts-section-title">
            <div class="parts-icon hardware-icon" aria-hidden="true">
              <span class="hardware-line"></span>
              <span class="hardware-head"></span>
              <span class="hardware-thread"></span>
            </div>
            <div>
              <h3>Ferreteria</h3>
              <p class="parts-copy">Tornillos, fijaciones y repuestos generales del taller.</p>
            </div>
          </div>
          <span class="chip">{{ ferreteria.length }} items</span>
        </div>

        <div class="parts-list-scroll">
          <article class="spare-item-card" *ngFor="let item of ferreteria; trackBy: trackById">
            <div>
              <strong>{{ item.name }}</strong>
              <p>Stock actual en almacen</p>
              <small class="spare-movement-copy">
                Movimiento:
                <ng-container *ngIf="item.latestMovement; else noHardwareMovement">
                  {{ item.latestMovement.action === 'ADD' ? '+' : '-' }}{{ item.latestMovement.quantity }}
                  por {{ item.latestMovement.userName }}
                  | {{ item.latestMovement.createdAt | date:'dd/MM/yyyy HH:mm' }}
                </ng-container>
                <ng-template #noHardwareMovement>Sin movimientos</ng-template>
              </small>
            </div>
            <div class="spare-stock-controls">
              <button class="stock-stepper" type="button" (click)="changeStock(item, -1)">-</button>
              <span class="spare-stock-value">{{ item.stock }}</span>
              <button class="stock-stepper" type="button" (click)="changeStock(item, 1)">+</button>
              <button *ngIf="isAdmin" class="ghost-button danger compact-delete" type="button" (click)="deleteItem(item)">Borrar</button>
            </div>
          </article>
          <p class="empty-state" *ngIf="!ferreteria.length">Todavia no hay articulos de ferreteria cargados.</p>
        </div>
      </article>
    </section>
  `,
  styles: [`
    .parts-layout,
    .parts-grid {
      display: grid;
      gap: 3rem;
    }

    .parts-layout {
      grid-template-columns: 1.2fr 0.95fr;
      align-items: start;
      margin-top: 1.15rem;
      margin-bottom: 1rem;
    }

    .parts-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .parts-copy {
      margin: 0.35rem 0 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .oil-panel,
    .spare-form-panel {
      align-self: start;
    }

    .oil-hero {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: 1.5rem;
      align-items: center;
      margin-top: 1rem;
    }

    .oil-barrel-shell {
      position: relative;
      height: 320px;
      border-radius: 34px;
      overflow: hidden;
      background: linear-gradient(180deg, #2e3f4d 0%, #1a2833 100%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 28px 40px rgba(16, 32, 51, 0.16);
    }

    .oil-barrel-top {
      position: absolute;
      inset: 16px 18px auto;
      height: 20px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08));
      z-index: 3;
    }

    .oil-liquid {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(180deg, #2bb3b0 0%, #0e8e85 48%, #0a5f58 100%);
      transition: height 0.35s ease;
      overflow: hidden;
    }

    .oil-wave {
      position: absolute;
      left: -8%;
      width: 116%;
      height: 38px;
      border-radius: 48%;
      background: rgba(255, 255, 255, 0.18);
    }

    .oil-wave-one {
      top: -18px;
      animation: oilWave 5.2s linear infinite;
    }

    .oil-wave-two {
      top: -10px;
      opacity: 0.45;
      animation: oilWave 7s linear infinite reverse;
    }

    .oil-barrel-label {
      position: absolute;
      left: 24px;
      right: 24px;
      bottom: 24px;
      z-index: 4;
      display: grid;
      gap: 0.18rem;
      padding: 1rem 1.1rem;
      border-radius: 20px;
      background: rgba(9, 29, 40, 0.36);
      color: #ffffff;
      backdrop-filter: blur(10px);
    }

    .oil-barrel-label strong {
      font-size: 1.55rem;
    }

    .oil-barrel-label span {
      color: rgba(255, 255, 255, 0.8);
    }

    .oil-stats {
      display: grid;
      gap: 1rem;
    }

    .oil-stat-card {
      padding: 1.2rem;
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(241, 248, 249, 0.94));
      border: 1px solid var(--line);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }

    .oil-stat-card span,
    .oil-stat-card small {
      color: var(--muted);
      display: block;
    }

    .oil-stat-card strong {
      display: block;
      margin: 0.45rem 0 0.3rem;
      font-size: 2rem;
    }

    .oil-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 0.85rem;
      margin-top: 1.35rem;
      align-items: end;
    }

    .parts-section-title {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .parts-icon {
      position: relative;
      width: 58px;
      height: 58px;
      flex: 0 0 58px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(13, 143, 134, 0.14), rgba(255, 183, 77, 0.2));
      border: 1px solid rgba(255, 255, 255, 0.65);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
    }

    .bulb-glow,
    .bulb-body,
    .bulb-base,
    .hardware-line,
    .hardware-head,
    .hardware-thread {
      position: absolute;
      display: block;
    }

    .bulb-glow {
      inset: 10px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255, 225, 111, 0.95), rgba(255, 225, 111, 0.15) 68%, transparent 74%);
      animation: bulbGlow 1.8s ease-in-out infinite alternate;
    }

    .bulb-body {
      width: 20px;
      height: 22px;
      left: 19px;
      top: 13px;
      border-radius: 12px 12px 9px 9px;
      background: #fff7cb;
      box-shadow: 0 0 12px rgba(255, 215, 92, 0.35);
    }

    .bulb-base {
      width: 12px;
      height: 10px;
      left: 23px;
      top: 35px;
      border-radius: 0 0 6px 6px;
      background: #556373;
      box-shadow: 0 3px 0 rgba(85, 99, 115, 0.25);
    }

    .hardware-line {
      width: 30px;
      height: 6px;
      left: 14px;
      top: 26px;
      border-radius: 999px;
      background: #5c7186;
      transform: rotate(-28deg);
    }

    .hardware-head {
      width: 18px;
      height: 18px;
      right: 11px;
      top: 14px;
      border-radius: 7px;
      background: #3c5368;
      transform: rotate(-28deg);
    }

    .hardware-thread {
      width: 20px;
      height: 8px;
      left: 10px;
      top: 31px;
      border-radius: 999px;
      background:
        repeating-linear-gradient(90deg, #bfd0db 0 3px, #6f8799 3px 6px);
      transform: rotate(-28deg);
    }

    .parts-list-scroll {
      display: grid;
      gap: 0.95rem;
      max-height: 420px;
      overflow: auto;
      padding-right: 0.35rem;
    }

    .parts-list-scroll::-webkit-scrollbar {
      width: 10px;
    }

    .parts-list-scroll::-webkit-scrollbar-track {
      background: rgba(16, 32, 51, 0.06);
      border-radius: 999px;
    }

    .parts-list-scroll::-webkit-scrollbar-thumb {
      background: rgba(13, 143, 134, 0.34);
      border-radius: 999px;
    }

    .spare-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.05rem;
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(247, 251, 252, 0.9));
      border: 1px solid var(--line);
    }

    .spare-item-card strong {
      display: block;
      margin-bottom: 0.2rem;
    }

    .spare-item-card p {
      margin: 0;
      color: var(--muted);
    }

    .spare-movement-copy {
      display: block;
      margin-top: 0.35rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .spare-stock-controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 0 0 auto;
      flex-wrap: wrap;
    }

    .stock-stepper {
      width: 38px;
      height: 38px;
      border: none;
      border-radius: 999px;
      background: rgba(13, 143, 134, 0.12);
      color: var(--primary-dark);
      font-size: 1.3rem;
      font-weight: 700;
      cursor: pointer;
    }

    .spare-stock-value {
      min-width: 34px;
      text-align: center;
      font-weight: 800;
      font-size: 1.05rem;
    }

    .compact-delete {
      padding: 0.6rem 0.95rem;
    }

    @keyframes oilWave {
      0% { transform: translateX(-4%) rotate(0deg); }
      50% { transform: translateX(2%) rotate(1deg); }
      100% { transform: translateX(-4%) rotate(0deg); }
    }

    @keyframes bulbGlow {
      from { opacity: 0.5; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1.06); }
    }

    @media (max-width: 1100px) {
      .parts-layout,
      .parts-grid,
      .oil-hero,
      .oil-controls {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .spare-item-card,
      .parts-section-title {
        align-items: flex-start;
      }

      .spare-item-card {
        flex-direction: column;
      }

      .spare-stock-controls {
        width: 100%;
        justify-content: flex-start;
      }

      .oil-barrel-shell {
        height: 280px;
      }
    }
  `],
})
export class PartsWarehouseComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly warehouseService = inject(PartsWarehouseService);

  items: SpareItem[] = [];
  private readonly pendingDeltas = new Map<string, number>();
  private readonly flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlightItems = new Set<string>();
  oil: OilStockState = {
    id: '',
    key: 'main',
    capacityLiters: 1000,
    currentLiters: 1000,
    createdAt: '',
    updatedAt: '',
  };

  readonly spareForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    category: ['FOCOS' as SpareCategory, Validators.required],
    stock: [0, [Validators.required, Validators.min(0)]],
  });

  readonly oilForm = this.fb.nonNullable.group({
    liters: [100, [Validators.required, Validators.min(1)]],
  });

  get oilPercentage(): number {
    return Math.max(0, Math.min(100, (this.oil.currentLiters / this.oil.capacityLiters) * 100));
  }

  get focos(): SpareItem[] {
    return this.items.filter((item) => item.category === 'FOCOS');
  }

  get ferreteria(): SpareItem[] {
    return this.items.filter((item) => item.category === 'FERRETERIA');
  }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'ADMIN';
  }

  ngOnInit(): void {
    this.loadState();
  }

  ngOnDestroy(): void {
    for (const [itemId, timer] of this.flushTimers) {
      clearTimeout(timer);
      this.flushTimers.delete(itemId);
      this.flushStock(itemId);
    }
  }

  trackById(_index: number, item: SpareItem): string {
    return item.id;
  }

  createSpare(): void {
    if (this.spareForm.invalid) {
      this.spareForm.markAllAsTouched();
      return;
    }

    const raw = this.spareForm.getRawValue();
    const payload = {
      name: raw.name.trim(),
      category: raw.category,
      stock: Number(raw.stock) || 0,
    };

    this.warehouseService.createItem(payload).subscribe({
      next: () => {
        this.notificationService.show('success', 'Repuesto agregado al almacen.');
        this.resetSpareForm();
        this.loadState();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo agregar el repuesto.');
      },
    });
  }

  resetSpareForm(): void {
    this.spareForm.reset({
      name: '',
      category: 'FOCOS',
      stock: 0,
    });
  }

  changeStock(item: SpareItem, delta: number): void {
    if (item.stock + delta < 0) {
      this.notificationService.show('error', 'No puedes dejar el stock del repuesto en negativo.');
      return;
    }

    item.stock += delta;
    this.pendingDeltas.set(item.id, (this.pendingDeltas.get(item.id) ?? 0) + delta);

    const currentTimer = this.flushTimers.get(item.id);
    if (currentTimer) {
      clearTimeout(currentTimer);
    }
    this.flushTimers.set(item.id, setTimeout(() => {
      this.flushTimers.delete(item.id);
      this.flushStock(item.id);
    }, STOCK_BATCH_DELAY_MS));
  }

  deleteItem(item: SpareItem): void {
    const confirmed = window.confirm(`Quieres borrar el repuesto ${item.name}?`);
    if (!confirmed) {
      return;
    }

    this.warehouseService.deleteItem(item.id).subscribe({
      next: () => {
        this.notificationService.show('success', 'Repuesto eliminado correctamente.');
        this.loadState();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo eliminar el repuesto.');
      },
    });
  }

  addOil(): void {
    const liters = Number(this.oilForm.getRawValue().liters) || 0;
    if (liters <= 0) {
      this.notificationService.show('error', 'Ingresa una cantidad valida de litros.');
      return;
    }

    this.warehouseService.updateOil('add', liters).subscribe({
      next: () => {
        this.notificationService.show('success', 'Aceite cargado en el barril.');
        this.loadState();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo cargar aceite.');
      },
    });
  }

  consumeOil(): void {
    const liters = Number(this.oilForm.getRawValue().liters) || 0;
    if (liters <= 0) {
      this.notificationService.show('error', 'Ingresa una cantidad valida de litros.');
      return;
    }

    this.warehouseService.updateOil('consume', liters).subscribe({
      next: () => {
        this.notificationService.show('success', 'Consumo de aceite registrado.');
        this.loadState();
      },
      error: (error) => {
        this.notificationService.show('error', error.error?.message || 'No se pudo descontar aceite.');
      },
    });
  }

  private flushStock(itemId: string): void {
    if (this.inFlightItems.has(itemId)) {
      return;
    }

    const delta = this.pendingDeltas.get(itemId) ?? 0;
    this.pendingDeltas.delete(itemId);
    if (!delta) {
      return;
    }

    this.inFlightItems.add(itemId);
    this.warehouseService.updateItemStock(itemId, delta).subscribe({
      next: (updated) => {
        this.inFlightItems.delete(itemId);
        this.applyItemUpdate(updated);
        if (this.pendingDeltas.has(itemId) && !this.flushTimers.has(itemId)) {
          this.flushStock(itemId);
        }
      },
      error: (error) => {
        this.inFlightItems.delete(itemId);
        this.pendingDeltas.delete(itemId);
        const timer = this.flushTimers.get(itemId);
        if (timer) {
          clearTimeout(timer);
          this.flushTimers.delete(itemId);
        }
        this.notificationService.show('error', error.error?.message || 'No se pudo actualizar el stock.');
        this.loadState();
      },
    });
  }

  private applyItemUpdate(updated: SpareItem): void {
    const item = this.items.find((current) => current.id === updated.id);
    if (!item) {
      return;
    }

    item.stock = updated.stock + (this.pendingDeltas.get(updated.id) ?? 0);
    item.latestMovement = updated.latestMovement;
  }

  private loadState(): void {
    this.warehouseService.getState().subscribe({
      next: (state) => {
        this.items = state.items.map((item) => ({
          ...item,
          stock: item.stock + (this.pendingDeltas.get(item.id) ?? 0),
        }));
        this.oil = state.oil;
      },
      error: () => {
        this.notificationService.show('error', 'No se pudo cargar el almacen de repuestos.');
      },
    });
  }
}
