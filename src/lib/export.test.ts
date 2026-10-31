import { describe, expect, it } from 'vitest';
import { versCsv } from './export.ts';

describe('export CSV', () => {
  it('échappe virgules, guillemets et objets', () => {
    const csv = versCsv([
      { evenement: 'bouton_tache', details: { action: 'fait', tache: 'Vitres, salon' } },
      { evenement: 'ouverture', details: null },
    ]);
    const lignes = csv.replace('﻿', '').trim().split('\r\n');
    expect(lignes[0]).toBe('evenement,details');
    expect(lignes[1]).toBe('bouton_tache,"{""action"":""fait"",""tache"":""Vitres, salon""}"');
    expect(lignes[2]).toBe('ouverture,');
  });
});
