import { describe, expect, it } from 'vitest';
import { CONSIGNES } from './consignes.ts';

describe('consignes IA0', () => {
  it('essai : accepte {pret:true, mot}, refuse le reste', () => {
    const v = CONSIGNES.essai.valider;
    expect(v({ pret: true, mot: ' éponge ' })).toEqual({ pret: true, mot: 'éponge' });
    expect(v({ pret: 'true', mot: 'éponge' })).toBeNull();
    expect(v({ pret: true, mot: '' })).toBeNull();
    expect(v({ pret: true, mot: 'x'.repeat(41) })).toBeNull();
    expect(v([])).toBeNull();
  });

  it('essai_vision : exige une image', () => {
    expect(CONSIGNES.essai_vision.demande({})).toBeNull();
    expect(CONSIGNES.essai_vision.demande({}, { base64: 'AA', type: 'image/png' })?.image).toEqual({ base64: 'AA', type: 'image/png' });
    expect(CONSIGNES.essai_vision.valider({ couleur: 'bleu' })).toEqual({ couleur: 'bleu' });
    expect(CONSIGNES.essai_vision.valider({ couleur: 3 })).toBeNull();
  });

  it('les consignes n’embarquent aucune donnée du foyer', () => {
    const d = CONSIGNES.essai.demande({ code: 'ABC123', prenom: 'Laeti' })!;
    expect(JSON.stringify(d)).not.toMatch(/ABC123|Laeti/);
  });
});
