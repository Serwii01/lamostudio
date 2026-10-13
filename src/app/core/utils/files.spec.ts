import { MAX_UPLOAD_BYTES, fileKindOf, formatBytes, linkName, linkProvider, parseLink, validateUpload } from './files';

describe('files', () => {
  it('clasifica por tipo MIME y extensión', () => {
    expect(fileKindOf('image/png', 'a.png')).toBe('image');
    expect(fileKindOf('video/mp4', 'clip.mp4')).toBe('video');
    expect(fileKindOf('audio/mpeg', 'tema.mp3')).toBe('audio');
    expect(fileKindOf('application/pdf', 'guion.pdf')).toBe('pdf');
    expect(fileKindOf('', 'presupuesto.xlsx')).toBe('document');
    expect(fileKindOf('', 'marca.psd')).toBe('document');
    expect(fileKindOf('', 'misterio.xyz')).toBe('other');
  });

  it('valida tamaño y bloquea ejecutables', () => {
    expect(validateUpload({ name: 'foto.jpg', size: 2_000_000 })).toBeNull();
    expect(validateUpload({ name: 'vacio.txt', size: 0 })).toContain('vacío');
    expect(validateUpload({ name: 'bruto.mov', size: MAX_UPLOAD_BYTES + 1 })).toContain('25 MB');
    expect(validateUpload({ name: 'setup.EXE', size: 10 })).toContain('ejecutable');
  });

  it('reconoce enlaces y su servicio', () => {
    expect(parseLink('')).toBeNull();
    expect(parseLink('javascript:alert(1)')).toBeNull();
    expect(parseLink('drive.google.com/file/d/123')?.href).toBe('https://drive.google.com/file/d/123');
    expect(linkProvider(parseLink('https://app.frame.io/reviews/abc')!)).toBe('Frame.io');
    expect(linkProvider(parseLink('https://youtu.be/xyz')!)).toBe('YouTube');
    expect(linkProvider(parseLink('https://www.ejemplo.es/a')!)).toBe('ejemplo.es');
    expect(linkName(parseLink('https://www.dropbox.com/s/1/moodboard.pdf')!)).toBe('moodboard.pdf');
    expect(linkName(parseLink('https://app.frame.io/reviews/abc')!)).toBe('Enlace de Frame.io');
  });

  it('formatea tamaños en español', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
});
