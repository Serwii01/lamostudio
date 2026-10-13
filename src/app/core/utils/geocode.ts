/**
 * Búsqueda de direcciones con Nominatim, el geocodificador libre de OpenStreetMap.
 * Sin clave de API; su política de uso pide pocas peticiones (una por búsqueda,
 * nunca mientras se teclea). Para producción conviene un proxy propio o un
 * proveedor comercial; la interfaz de estas funciones no cambiaría.
 */
const BASE = 'https://nominatim.openstreetmap.org';

export interface GeoResult {
  label: string;
  name: string;
  lat: number;
  lng: number;
}

interface NominatimPlace {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

export async function searchPlaces(query: string, near?: { lat: number; lng: number }): Promise<GeoResult[]> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '5', 'accept-language': 'es', q: query.trim() });
  if (near) {
    // Prioriza resultados cerca de lo que se está viendo en el mapa (sin excluir el resto).
    const d = 0.5;
    params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
  }
  const response = await fetch(`${BASE}/search?${params}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const places = (await response.json()) as NominatimPlace[];
  return places.map((p) => ({
    label: p.display_name,
    name: p.name || p.display_name.split(',')[0],
    lat: Number(p.lat),
    lng: Number(p.lon),
  }));
}

/** Dirección legible de unas coordenadas (o null si no hay respuesta). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({ format: 'jsonv2', 'accept-language': 'es', lat: String(lat), lon: String(lng), zoom: '18' });
    const response = await fetch(`${BASE}/reverse?${params}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const place = (await response.json()) as Partial<NominatimPlace>;
    return place.display_name ? shortAddress(place.display_name) : null;
  } catch {
    return null;
  }
}

/** «Calle Betis, Triana, Sevilla, Andalucía, 41010, España» → «Calle Betis, Triana, Sevilla». */
export function shortAddress(full: string): string {
  return full
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^(España|Andalucía|Spain)$/i.test(part) && !/^\d{5}$/.test(part))
    .slice(0, 4)
    .join(', ');
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function osmUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}
