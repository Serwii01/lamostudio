import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import {
  LOCATION_CATEGORY,
  LOCATION_CATEGORY_ORDER,
  LOCATION_STATUS,
  LOCATION_STATUS_ORDER,
  TASK_STATUS,
} from '../../core/catalog';
import { Id, LocationStatus, ProjectLocation } from '../../core/models';
import { LocationPatch } from '../../core/data/repositories';
import { LocationService } from '../../core/services/locations';
import { TaskPanelService, ToastService } from '../../core/services/ui-state';
import { formatSchedule, fromDateTimeInput, toDateTimeInput } from '../../core/utils/dates';
import { GeoResult, directionsUrl, osmUrl, reverseGeocode, searchPlaces, shortAddress } from '../../core/utils/geocode';
import { normalize } from '../../core/utils/text';
import { Badge, Empty } from '../../shared/ui/badge';
import { Icon } from '../../shared/ui/icon';

type StatusFilter = 'all' | LocationStatus;

/** Centro por defecto (Sevilla, donde trabaja el estudio) si el proyecto aún no tiene pines. */
const DEFAULT_CENTER: L.LatLngTuple = [37.3891, -5.9845];
const NEW_NAME = 'Nueva localización';

/**
 * Módulo Mapa: localizaciones del proyecto sobre OpenStreetMap (Leaflet).
 * Añadir: buscando una dirección o con «Añadir en el mapa» y un clic. Cada pin
 * se puede arrastrar para ajustarlo. La lista funciona también sin mirar el mapa.
 */
@Component({
  selector: 'app-map-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Badge, Empty, Icon],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[23rem_1fr]">
      <!-- Lista o ficha -->
      <aside class="order-2 min-w-0 lg:order-1">
        @if (selected(); as loc) {
          <section class="card p-5" aria-label="Ficha de la localización">
            <div class="flex items-center justify-between gap-2">
              <button class="btn btn-ghost btn-sm -ml-2" (click)="selectedId.set(null)">
                <app-icon name="chevron-left" [size]="14" /> Todas
              </button>
              @if (canEdit()) {
                <button class="btn btn-ghost btn-sm hover:text-coral" (click)="remove(loc)"><app-icon name="trash" [size]="14" /> Quitar</button>
              }
            </div>

            <input
              class="mt-2 w-full rounded-md border border-transparent bg-transparent font-display text-xl font-light hover:border-line focus:border-line focus:outline-none"
              aria-label="Nombre"
              [value]="loc.name"
              [disabled]="!canEdit()"
              (change)="patch(loc, { name: $any($event.target).value.trim() || loc.name })"
              (keydown.enter)="$any($event.target).blur()"
            />

            <div class="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estado">
              @for (s of statusOrder; track s) {
                <button
                  type="button"
                  role="radio"
                  class="chip h-7 disabled:cursor-default"
                  [class.chip-active]="loc.status === s"
                  [attr.aria-checked]="loc.status === s"
                  [disabled]="!canEdit()"
                  (click)="patch(loc, { status: s })"
                >
                  {{ status[s].label }}
                </button>
              }
            </div>

            <dl class="mt-5 grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-3">
              <dt class="text-ink-soft">Tipo</dt>
              <dd>
                <select class="input h-9" [disabled]="!canEdit()" (change)="patch(loc, { category: $any($event.target).value })">
                  @for (c of categoryOrder; track c) {
                    <option [value]="c" [selected]="loc.category === c">{{ category[c].label }}</option>
                  }
                </select>
              </dd>

              <dt class="text-ink-soft">Dirección</dt>
              <dd>
                <input class="input h-9" placeholder="Calle, número, ciudad" [value]="loc.address ?? ''" [disabled]="!canEdit()" (change)="patch(loc, { address: $any($event.target).value.trim() || undefined })" />
              </dd>

              <dt class="text-ink-soft">Desde</dt>
              <dd>
                <input type="datetime-local" class="input h-9" [value]="dt(loc.startAt)" [disabled]="!canEdit()" (change)="patch(loc, { startAt: fromDt($any($event.target).value) })" />
              </dd>
              <dt class="text-ink-soft">Hasta</dt>
              <dd>
                <input type="datetime-local" class="input h-9" [value]="dt(loc.endAt)" [disabled]="!canEdit()" (change)="patch(loc, { endAt: fromDt($any($event.target).value) })" />
              </dd>

              <dt class="text-ink-soft">Contacto</dt>
              <dd class="grid gap-2">
                <input class="input h-9" placeholder="Nombre o entidad" [value]="loc.contactName ?? ''" [disabled]="!canEdit()" (change)="patch(loc, { contactName: $any($event.target).value.trim() || undefined })" />
                <input class="input h-9" type="tel" placeholder="Teléfono" [value]="loc.contactPhone ?? ''" [disabled]="!canEdit()" (change)="patch(loc, { contactPhone: $any($event.target).value.trim() || undefined })" />
              </dd>

              <dt class="text-ink-soft">Coste</dt>
              <dd class="flex items-center gap-2">
                <input type="number" min="0" step="10" class="input h-9 w-28" [value]="loc.cost ?? ''" [disabled]="!canEdit()" (change)="setCost(loc, $any($event.target).value)" />
                <span class="text-ink-faint">€</span>
              </dd>
            </dl>

            <label class="mt-5 block">
              <span class="eyebrow">Notas de producción</span>
              <textarea
                class="input mt-2 min-h-24 font-light text-[15px]"
                placeholder="Accesos, luz, ruido…"
                [value]="loc.notes ?? ''"
                [disabled]="!canEdit()"
                (change)="patch(loc, { notes: $any($event.target).value.trim() || undefined })"
              ></textarea>
            </label>

            <section class="mt-5">
              <h3 class="eyebrow mb-2">Tareas de esta localización</h3>
              @for (t of linkedTasks(); track t.id) {
                <button class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-ink/[0.04]" (click)="panel.open(t.id)">
                  <app-icon name="check-square" [size]="14" class="text-ink-faint" />
                  <span class="min-w-0 flex-1 truncate">{{ t.title }}</span>
                  <app-badge [tone]="taskStatus[t.status].tone">{{ taskStatus[t.status].label }}</app-badge>
                </button>
              } @empty {
                <p class="hand text-sm">Sin visitas todavía.</p>
              }
              @if (canEdit()) {
                <button class="btn btn-primary btn-sm mt-3" (click)="locations.scheduleVisit(loc)">
                  <app-icon name="calendar" [size]="13" /> Programar visita
                </button>
              }
            </section>

            <footer class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 pt-4 text-xs">
              <a class="inline-flex items-center gap-1 text-ink-soft hover:text-ink" [href]="directions(loc)" target="_blank" rel="noopener">
                <app-icon name="external" [size]="12" /> Cómo llegar
              </a>
              <a class="inline-flex items-center gap-1 text-ink-soft hover:text-ink" [href]="osm(loc)" target="_blank" rel="noopener">
                <app-icon name="pin" [size]="12" /> OpenStreetMap
              </a>
              <button class="ml-auto cursor-pointer font-mono text-ink-faint tabular-nums hover:text-ink" title="Copiar coordenadas" (click)="copyCoords(loc)">
                {{ loc.lat.toFixed(5) }}, {{ loc.lng.toFixed(5) }}
              </button>
            </footer>
            @if (canEdit()) {
              <p class="hand mt-3 text-sm">Arrastra el pin para moverlo.</p>
            }
          </section>
        } @else {
          <section class="card p-4">
            @if (canEdit()) {
              <form class="flex gap-2" (ngSubmit)="search()">
                <label class="relative min-w-0 flex-1">
                  <span class="sr-only">Buscar una dirección</span>
                  <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
                  <input class="input rounded-full pl-9" name="q" placeholder="Busca una dirección o un sitio" [(ngModel)]="query" autocomplete="off" />
                </label>
                <button class="btn btn-outline" type="submit" [disabled]="!query().trim() || searching()">Buscar</button>
              </form>
              @if (searching()) {
                <p class="hand mt-3 text-sm">Buscando…</p>
              }
              @if (results(); as rs) {
                <ul class="mt-3 space-y-1">
                  @for (r of rs; track $index) {
                    <li class="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-ink/[0.04]">
                      <app-icon name="pin" [size]="15" class="mt-0.5 shrink-0 text-ink-faint" />
                      <span class="min-w-0 flex-1 text-sm leading-snug">{{ short(r.label) }}</span>
                      <button class="btn btn-primary btn-sm shrink-0" (click)="addFromSearch(r)">Añadir</button>
                    </li>
                  } @empty {
                    <li class="hand px-2 text-sm">No encuentro «{{ lastQuery() }}». Añade la ciudad o pon el pin a mano.</li>
                  }
                </ul>
              }
            }

            <div class="mt-4 flex flex-wrap gap-1.5">
              <button class="chip h-7" [class.chip-active]="statusFilter() === 'all'" (click)="statusFilter.set('all')">Todas <span class="opacity-60">{{ projectLocations().length }}</span></button>
              @for (s of statusOrder; track s) {
                @if (counts()[s]) {
                  <button class="chip h-7" [class.chip-active]="statusFilter() === s" (click)="statusFilter.set(s)">
                    {{ status[s].label }} <span class="opacity-60">{{ counts()[s] }}</span>
                  </button>
                }
              }
            </div>
          </section>

          <ul class="mt-4 space-y-2">
            @for (loc of visible(); track loc.id) {
              <li>
                <button
                  class="card flex w-full cursor-pointer items-start gap-3 p-3.5 text-left transition-colors hover:border-ink-faint"
                  [class.opacity-60]="loc.status === 'discarded'"
                  (click)="selectedId.set(loc.id)"
                  (mouseenter)="hoveredId.set(loc.id)"
                  (mouseleave)="hoveredId.set(null)"
                >
                  <span class="mt-1.5 size-3 shrink-0 rounded-full ring-2 ring-surface" [style.background]="category[loc.category].color"></span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-start justify-between gap-2">
                      <span class="font-medium leading-snug">{{ loc.name }}</span>
                      <app-badge [tone]="status[loc.status].tone">{{ status[loc.status].label }}</app-badge>
                    </span>
                    <span class="mt-0.5 block truncate text-xs text-ink-faint">{{ category[loc.category].label }}@if (loc.address) { · {{ loc.address }} }</span>
                    @if (loc.startAt) {
                      <span class="mt-1 flex items-center gap-1 text-xs text-ink-soft"><app-icon name="calendar" [size]="12" /> {{ schedule(loc) }}</span>
                    }
                  </span>
                </button>
              </li>
            } @empty {
              <li class="card">
                @if (projectLocations().length) {
                  <app-empty title="Nada con este filtro" [compact]="true" doodle="circle" />
                } @else {
                  <app-empty title="Aún no hay localizaciones" hint="Busca una dirección o pon un pin en el mapa." doodle="mountain" />
                }
              </li>
            }
          </ul>
        }
      </aside>

      <!-- Mapa -->
      <section class="card relative order-1 overflow-hidden lg:order-2" aria-label="Mapa">
        <div #mapEl class="lamo-map h-[52vh] min-h-[360px] lg:h-[calc(100dvh-15rem)]" [class.is-adding]="adding()"></div>

        @if (canEdit()) {
          <div class="pointer-events-none absolute top-3 left-3 z-[500] flex flex-wrap items-center gap-2">
            <button class="btn pointer-events-auto shadow-md" [class]="adding() ? 'btn-accent' : 'btn-primary'" (click)="adding.set(!adding())">
              <app-icon [name]="adding() ? 'x' : 'plus'" />
              {{ adding() ? 'Cancelar' : 'Añadir en el mapa' }}
            </button>
            @if (adding()) {
              <span class="rounded-full bg-surface/95 px-3 py-1.5 font-light text-sm text-ink shadow-md">Haz clic donde quieras poner el pin</span>
            }
          </div>
        }

        @if (legend().length) {
          <ul class="absolute bottom-3 left-3 z-[500] flex max-w-[70%] flex-wrap gap-x-3 gap-y-1 rounded-2xl bg-surface/95 px-3 py-2 text-xs text-ink-soft shadow-md">
            @for (c of legend(); track c) {
              <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-full" [style.background]="category[c].color"></span>{{ category[c].label }}</li>
            }
          </ul>
        }
      </section>
    </div>
  `,
})
export class MapBoard {
  readonly projectId = input.required<string>();
  /** Parámetro de URL ?loc=… para abrir directamente una localización (p. ej. desde una tarea). */
  readonly loc = input<string>();

  protected readonly locations = inject(LocationService);
  protected readonly panel = inject(TaskPanelService);
  private readonly toast = inject(ToastService);
  private readonly mapEl = viewChild.required<ElementRef<HTMLDivElement>>('mapEl');

  protected readonly status = LOCATION_STATUS;
  protected readonly statusOrder = LOCATION_STATUS_ORDER;
  protected readonly category = LOCATION_CATEGORY;
  protected readonly categoryOrder = LOCATION_CATEGORY_ORDER;
  protected readonly taskStatus = TASK_STATUS;

  protected readonly selectedId = signal<Id | null>(null);
  protected readonly hoveredId = signal<Id | null>(null);
  protected readonly adding = signal(false);
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly query = signal('');
  protected readonly lastQuery = signal('');
  protected readonly searching = signal(false);
  protected readonly results = signal<GeoResult[] | null>(null);

  protected readonly canEdit = computed(() => this.locations.canEdit());
  protected readonly projectLocations = computed(() => this.locations.byProject(this.projectId()));
  protected readonly visible = computed(() => {
    const filter = this.statusFilter();
    return this.projectLocations().filter((l) => filter === 'all' || l.status === filter);
  });
  protected readonly counts = computed(() => {
    const counts: Partial<Record<LocationStatus, number>> = {};
    for (const l of this.projectLocations()) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  });
  protected readonly legend = computed(() => LOCATION_CATEGORY_ORDER.filter((c) => this.projectLocations().some((l) => l.category === c)));
  protected readonly selected = computed(() => this.locations.byId(this.selectedId()));
  protected readonly linkedTasks = computed(() => this.locations.tasksByLocation().get(this.selectedId() ?? '') ?? []);

  private map?: L.Map;
  private readonly markers = new Map<Id, L.Marker>();

  constructor() {
    afterNextRender(() => this.initMap());

    // Abrir desde un enlace (?loc=…).
    effect(() => {
      const id = this.loc();
      if (id) untracked(() => this.selectedId.set(id));
    });

    // Pines sincronizados con la lista visible y con la selección.
    effect(() => {
      const list = this.visible();
      const selected = this.selectedId();
      const hovered = this.hoveredId();
      untracked(() => this.syncMarkers(list, selected, hovered));
    });

    // Al seleccionar, el mapa vuela al pin.
    effect(() => {
      const id = this.selectedId();
      untracked(() => {
        const loc = this.locations.byId(id);
        if (loc && this.map) this.map.flyTo([loc.lat, loc.lng], Math.max(this.map.getZoom(), 16), { duration: 0.6 });
      });
    });

    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  // --- Acciones de la ficha ---------------------------------------------------

  protected patch(loc: ProjectLocation, patch: LocationPatch): void {
    this.locations.update(loc, patch);
  }

  protected setCost(loc: ProjectLocation, value: string): void {
    const cost = Number(value);
    this.patch(loc, { cost: value === '' || Number.isNaN(cost) ? undefined : Math.max(0, cost) });
  }

  protected remove(loc: ProjectLocation): void {
    this.selectedId.set(null);
    this.locations.remove(loc);
  }

  protected async copyCoords(loc: ProjectLocation): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${loc.lat}, ${loc.lng}`);
      this.toast.show('Coordenadas copiadas');
    } catch {
      this.toast.error('No se pudieron copiar las coordenadas.');
    }
  }

  // --- Búsqueda -------------------------------------------------------------------

  protected async search(): Promise<void> {
    const q = this.query().trim();
    if (!q) return;
    this.searching.set(true);
    this.lastQuery.set(q);
    try {
      const center = this.map?.getCenter();
      this.results.set(await searchPlaces(q, center ? { lat: center.lat, lng: center.lng } : undefined));
    } catch {
      this.results.set(null);
      this.toast.error('No se pudo buscar la dirección. Comprueba la conexión o pon el pin a mano.');
    } finally {
      this.searching.set(false);
    }
  }

  protected async addFromSearch(result: GeoResult): Promise<void> {
    const loc = await this.locations.create({
      projectId: this.projectId(),
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      address: shortAddress(result.label),
    });
    this.results.set(null);
    this.query.set('');
    this.statusFilter.set('all');
    this.selectedId.set(loc.id);
  }

  protected onEscape(): void {
    if (this.adding()) this.adding.set(false);
    else if (this.selectedId() && !this.panel.openId()) this.selectedId.set(null);
  }

  // --- Mapa (Leaflet) ------------------------------------------------------------

  private initMap(): void {
    const map = L.map(this.mapEl().nativeElement, { zoomControl: false });
    L.control.zoom({ position: 'bottomright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);

    const points = this.projectLocations().map((l) => L.latLng(l.lat, l.lng));
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [56, 56], maxZoom: 16 });
    else map.setView(DEFAULT_CENTER, 13);

    map.on('click', (event: L.LeafletMouseEvent) => void this.onMapClick(event.latlng));
    this.map = map;
    this.syncMarkers(this.visible(), this.selectedId(), this.hoveredId());

    // La tarjeta puede cambiar de tamaño (columna lateral, ventana): recalcula.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(this.mapEl().nativeElement);
    map.on('unload', () => resize.disconnect());

    const selected = this.selected();
    if (selected) map.setView([selected.lat, selected.lng], 16);
  }

  private async onMapClick(latlng: L.LatLng): Promise<void> {
    if (!this.adding() || !this.canEdit()) return;
    this.adding.set(false);
    const loc = await this.locations.create({ projectId: this.projectId(), name: NEW_NAME, lat: latlng.lat, lng: latlng.lng });
    this.statusFilter.set('all');
    this.selectedId.set(loc.id);
    // Completa nombre y dirección con la dirección más cercana, si el usuario no ha escrito otro.
    const address = await reverseGeocode(latlng.lat, latlng.lng);
    const current = this.locations.byId(loc.id);
    if (address && current) {
      this.locations.update(current, {
        address,
        name: current.name === NEW_NAME ? address.split(',')[0] : current.name,
      });
    }
  }

  private syncMarkers(list: ProjectLocation[], selectedId: Id | null, hoveredId: Id | null): void {
    const map = this.map;
    if (!map) return;
    const ids = new Set(list.map((l) => l.id));
    for (const [id, marker] of this.markers) {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
    for (const loc of list) {
      const icon = pinIcon(loc, loc.id === selectedId, loc.id === hoveredId);
      let marker = this.markers.get(loc.id);
      if (!marker) {
        marker = L.marker([loc.lat, loc.lng], { icon, draggable: this.canEdit(), keyboard: true, title: loc.name, riseOnHover: true });
        marker.on('click', () => this.selectedId.set(loc.id));
        marker.on('dragend', () => {
          const current = this.locations.byId(loc.id);
          const pos = marker!.getLatLng();
          if (current) this.locations.update(current, { lat: pos.lat, lng: pos.lng });
        });
        marker.bindTooltip(loc.name, { direction: 'top', offset: [0, -34], className: 'lamo-tooltip' });
        marker.addTo(map);
        this.markers.set(loc.id, marker);
      } else {
        marker.setIcon(icon);
        marker.setLatLng([loc.lat, loc.lng]);
        marker.setTooltipContent(loc.name);
        marker.options.title = loc.name;
      }
      marker.setZIndexOffset(loc.id === selectedId ? 1000 : 0);
    }
  }

  // --- Formato ----------------------------------------------------------------------

  protected dt(iso?: string): string {
    return toDateTimeInput(iso);
  }

  protected fromDt(value: string): string | undefined {
    return fromDateTimeInput(value);
  }

  protected schedule(loc: ProjectLocation): string {
    return formatSchedule(loc.startAt, loc.endAt);
  }

  protected short(label: string): string {
    return shortAddress(label);
  }

  protected directions(loc: ProjectLocation): string {
    return directionsUrl(loc.lat, loc.lng);
  }

  protected osm(loc: ProjectLocation): string {
    return osmUrl(loc.lat, loc.lng);
  }
}

/** Pin en forma de gota con el color del tipo de localización. */
function pinIcon(loc: ProjectLocation, selected: boolean, hovered: boolean): L.DivIcon {
  const classes = ['lamo-pin', selected ? 'is-selected' : '', hovered ? 'is-hovered' : '', loc.status === 'discarded' ? 'is-muted' : '']
    .filter(Boolean)
    .join(' ');
  return L.divIcon({
    className: 'lamo-pin-wrap',
    html: `<span class="${classes}" style="--pin:${LOCATION_CATEGORY[loc.category].color}"><span></span></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
  });
}
