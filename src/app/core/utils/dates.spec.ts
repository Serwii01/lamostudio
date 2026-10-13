import { daysFromToday, fromDateInput, isoDaysFromNow, relativeDue, toDateInput } from './dates';

describe('dates', () => {
  it('calcula días respecto a hoy', () => {
    expect(daysFromToday(isoDaysFromNow(0))).toBe(0);
    expect(daysFromToday(isoDaysFromNow(3))).toBe(3);
    expect(daysFromToday(isoDaysFromNow(-2))).toBe(-2);
  });

  it('describe fechas relativas', () => {
    expect(relativeDue(undefined)).toBe('Sin fecha');
    expect(relativeDue(isoDaysFromNow(0))).toBe('Hoy');
    expect(relativeDue(isoDaysFromNow(1))).toBe('Mañana');
    expect(relativeDue(isoDaysFromNow(-3))).toBe('Hace 3 días');
  });

  it('convierte ida y vuelta con <input type="date">', () => {
    expect(fromDateInput('')).toBeUndefined();
    expect(toDateInput(fromDateInput('2026-05-14'))).toBe('2026-05-14');
  });
});
