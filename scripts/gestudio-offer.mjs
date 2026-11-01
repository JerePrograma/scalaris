import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const strategyUrl = new URL('../../Gestudio/docs/comercial/estrategia-comercial.md', import.meta.url);
const snapshotUrl = new URL('../commercial/gestudio-offer.snapshot.json', import.meta.url);
const sourceReference = 'Gestudio/docs/comercial/estrategia-comercial.md';

// The Markdown strategy owns the tariffs. This projection is derived, never edited.
export function parseGestudioOffer(markdown) {
  const section = markdown.split('### Planes vigentes')[1]?.split('## Definición de alumno activo')[0];
  assert.ok(section, 'Falta la tabla canónica de planes de Gestudio.');
  const ids = ['estudio', 'academia', 'academia-plus', 'institucion'];
  const rows = section.split('\n').filter(line => /^\| (Estudio|Academia|Academia Plus|Institución) \|/.test(line));
  assert.equal(rows.length, 4, 'Se requieren los cuatro planes canónicos, sin duplicados.');
  const plans = rows.map((line, index) => {
    const [, name, min, max, price, currency] = line.split('|').map(value => value.trim());
    assert.equal(currency, 'ARS');
    const monthlyPrice = Number(price.replace(/[^0-9]/g, ''));
    const studentsMin = Number(min);
    const studentsMax = /^\d+$/.test(max) ? Number(max) : null;
    assert.ok(Number.isSafeInteger(monthlyPrice) && monthlyPrice > 0);
    assert.ok(Number.isSafeInteger(studentsMin) && studentsMin > 0);
    assert.ok(studentsMax === null || (Number.isSafeInteger(studentsMax) && studentsMax >= studentsMin));
    return {id: ids[index], name, monthlyPrice, studentsMin, studentsMax, ...(index === 3 ? {requiresQuote: true} : {})};
  });
  assert.equal(new Set(plans.map(plan => plan.name)).size, 4);
  assert.equal(plans[0].studentsMin, 1);
  for (let i = 1; i < plans.length; i++) assert.equal(plans[i].studentsMin, plans[i-1].studentsMax + 1, 'Los tramos no pueden solaparse ni dejar huecos.');
  assert.equal(plans.at(-1).studentsMax, null);
  const annualDiscountRate = Number(section.match(/\| Descuento anual \|\s*(\d+)%/)?.[1]) / 100;
  const implementationMonths = Number(section.match(/\| Implementación inicial \|\s*([\d,]+) veces/)?.[1]?.replace(',', '.'));
  assert.ok(annualDiscountRate > 0 && annualDiscountRate < 1);
  assert.ok(Number.isFinite(implementationMonths) && implementationMonths > 0);
  return {
    generated: true, sourceReference,
    sourceSha256: createHash('sha256').update(markdown).digest('hex'),
    currency: 'ARS', monthlyFrom: plans[0].monthlyPrice, plans,
    billing: {annualDiscountRate, implementationMonths},
  };
}

export async function loadGestudioOffer({refreshSnapshot = false} = {}) {
  let result;
  try {
    result = parseGestudioOffer(await readFile(strategyUrl, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // CI has only the website checkout. Its committed projection remains portable.
    result = JSON.parse(await readFile(snapshotUrl, 'utf8'));
    assert.equal(result.generated, true);
    assert.equal(result.sourceReference, sourceReference);
    assert.equal(result.plans.length, 4);
    assert.ok(/^[a-f0-9]{64}$/.test(result.sourceSha256));
  }
  if (refreshSnapshot) await writeFile(snapshotUrl, JSON.stringify(result, null, 2) + '\n');
  return result;
}
