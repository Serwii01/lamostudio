import { directionsUrl, shortAddress } from './geocode';

describe('geocode', () => {
  it('acorta la dirección de Nominatim', () => {
    expect(shortAddress('Calle Betis, Triana, Sevilla, Andalucía, 41010, España')).toBe('Calle Betis, Triana, Sevilla');
    expect(shortAddress('Plaza de España, El Prado, Casco Antiguo, Sevilla, Andalucía, 41013, España')).toBe(
      'Plaza de España, El Prado, Casco Antiguo, Sevilla',
    );
  });

  it('genera el enlace de cómo llegar', () => {
    expect(directionsUrl(37.37724, -5.98689)).toBe('https://www.google.com/maps/dir/?api=1&destination=37.37724,-5.98689');
  });
});
