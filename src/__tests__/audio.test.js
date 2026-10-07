import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('../utils/audio');

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Toneinstellung bei gesperrtem Browserspeicher', () => {
  it('startet auch dann, wenn schon der Storage-Getter gesperrt ist', async () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError');
    });
    const audio = await import('../utils/audio');
    expect(audio.isAudioMuted()).toBe(false);
    expect(() => audio.setAudioMuted(true)).not.toThrow();
    expect(audio.isAudioMuted()).toBe(true);
  });

  it('behält Änderungen bei Lese- und Schreibfehlern im Arbeitsspeicher', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new DOMException('Storage blocked', 'SecurityError'); },
      setItem() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
    });
    const audio = await import('../utils/audio');
    audio.setAudioMuted(true);
    expect(audio.isAudioMuted()).toBe(true);
    audio.setAudioMuted(false);
    expect(audio.isAudioMuted()).toBe(false);
  });

  it('liest und speichert die Einstellung bei verfügbarem Storage weiterhin', async () => {
    const storage = { getItem: vi.fn(() => 'true'), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    const audio = await import('../utils/audio');
    expect(audio.isAudioMuted()).toBe(true);
    audio.setAudioMuted(false);
    expect(storage.setItem).toHaveBeenCalledWith('terra_audio_muted', 'false');
  });
});
