import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildNbr14653Analysis,
  parseMarketNumber,
} from '../src/services/nbr-14653-service.js'
import type {
  EvaluationAIDraftResponse,
  EvaluationRequest,
  NbrHomogenizedComparable,
} from '../src/types/evaluation.js'

const input: EvaluationRequest = {
  address: 'Rua Exemplo',
  propertyType: 'apartamento',
  area: 100,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  buildingAge: 'mais-10',
  conservation: 'bom',
  standardLevel: 'padrao',
  furnishing: 'sem',
  finishLevel: 'padrao',
  condominiumLevel: 'padrao',
  floor: 8,
  elevatorAccess: 'sim',
}
const comparable: NbrHomogenizedComparable = {
  title: 'Apartamento',
  source: 'Anúncio',
  declaredPrice: 'R$ 450.000,00',
  area: '100,00 m²',
  factors: [],
  weight: 1,
  homogenizedUnitPriceSqm: 99000,
}
function evaluate(
  overrides: Partial<EvaluationRequest> = {},
  items = [comparable],
  sourceLinks?: string[]
) {
  const draft = {
    estimatedValue: 900000,
    valuePerSqm: 9000,
    marketAnalysis: { averagePricePerSqm: 9000, comparables: [] },
    nbr14653: {
      homogenizedComparables: items,
      calculationMemory: { steps: ['incorrect AI arithmetic'] },
    },
  } as unknown as EvaluationAIDraftResponse
  return buildNbr14653Analysis(
    draft,
    { ...input, ...overrides },
    items.length,
    sourceLinks
  )
}

test('Brazilian decimal currency and area preserve decimal places', () => {
  assert.equal(parseMarketNumber('R$ 450.000,00'), 450000)
  assert.equal(parseMarketNumber('75,50 m²'), 75.5)
  assert.equal(parseMarketNumber('75.5 m²'), 75.5)
  assert.equal(parseMarketNumber('não informado'), null)
  assert.equal(evaluate().calculationMemory.finalValue, 450000)
})
test('asking price cannot anchor market value', () => {
  assert.equal(
    evaluate({ askingPrice: 9000000 }).calculationMemory.finalValue,
    450000
  )
})
test('server recomputes the arithmetic instead of accepting AI totals or unit prices', () => {
  const result = evaluate({}, [{ ...comparable, unitPriceSqm: 17000 }])
  assert.equal(result.calculationMemory.finalValue, 450000)
  assert.equal(result.homogenizedComparables[0].homogenizedUnitPriceSqm, 4500)
  assert.ok(!result.calculationMemory.steps.includes('incorrect AI arithmetic'))
})
test('floor adjustment remains neutral when comparable floor or elevator is unknown', () => {
  const factor = {
    id: 'floor_access',
    label: 'Andar e elevador',
    value: 1.1,
    justification: 'Dados locais',
  }
  assert.equal(
    evaluate({}, [{ ...comparable, factors: [factor] }]).calculationMemory
      .finalValue,
    450000
  )
  assert.equal(
    evaluate({}, [
      { ...comparable, floor: 2, elevatorAccess: 'sim', factors: [factor] },
    ]).calculationMemory.finalValue,
    495000
  )
  assert.equal(
    evaluate({ elevatorAccess: 'desconhecido' }, [
      { ...comparable, floor: 2, elevatorAccess: 'sim', factors: [factor] },
    ]).calculationMemory.finalValue,
    450000
  )
})
test('zero weights still produce an evidence-based aggregate', () => {
  assert.equal(
    evaluate({}, [{ ...comparable, weight: 0 }]).calculationMemory.finalValue,
    450000
  )
})
test('furniture is counted once only when explicitly selected', () => {
  assert.equal(
    evaluate({ highEndFurnitureValue: 20000 }).calculationMemory.finalValue,
    450000
  )
  const result = evaluate({
    highEndFurnitureValue: 20000,
    amenities: ['moveis-alto-padrao'],
  })
  assert.equal(result.calculationMemory.finalValue, 470000)
  assert.equal(result.calculationMemory.valuePerSqm, 4700)
})
test('unit prices and million-denominated prices are parsed explicitly', () => {
  assert.equal(
    evaluate({}, [{ ...comparable, declaredPrice: 'R$ 4.500,00/m²' }])
      .calculationMemory.finalValue,
    450000
  )
  assert.equal(
    evaluate({}, [{ ...comparable, declaredPrice: 'R$ 1,2 milhões' }])
      .calculationMemory.finalValue,
    1200000
  )
})
test('no automatic normative grade or guaranteed precision', () => {
  const result = evaluate()
  assert.equal(result.specificationGrade, null)
  assert.equal(result.maxDeviationPercent, null)
})

test('standard factor is independent of missing floor information', () => {
  const result = evaluate({}, [
    {
      ...comparable,
      factors: [
        {
          id: 'standard',
          label: 'Padrão construtivo',
          value: 1.1,
          justification: 'Acabamento superior documentado',
        },
      ],
    },
  ])
  assert.equal(result.calculationMemory.finalValue, 495000)
})

test('deduplicates tracking variants without merging distinct listing IDs', () => {
  const result = evaluate({}, [
    { ...comparable, link: 'https://example.com/listing?id=1&utm_source=ad' },
    { ...comparable, link: 'https://example.com/listing?id=1' },
    { ...comparable, link: 'https://example.com/listing?id=2' },
  ])
  assert.equal(result.sampleQuality?.duplicatesRemoved, 1)
  assert.equal(result.sampleQuality?.usedCount, 2)
  assert.equal(result.sampleQuality?.observedValueRange, null)
})
test('only uses source URLs present in the search when provenance is provided', () => {
  const result = evaluate(
    {},
    [
      { ...comparable, link: 'https://example.com/1' },
      {
        ...comparable,
        link: 'https://invented.example/2',
        declaredPrice: 'R$ 900.000',
      },
    ],
    ['https://example.com/1']
  )
  assert.equal(result.sampleQuality?.matchedSourceCount, 1)
  assert.equal(result.sampleQuality?.excludedCount, 1)
  assert.equal(result.calculationMemory.finalValue, 450000)
  assert.throws(
    () => evaluate({}, [comparable], []),
    /Não encontramos comparáveis/
  )
})
test('excludes invalid rows and normalizes the effective weights', () => {
  const result = evaluate({}, [
    comparable,
    { ...comparable, declaredPrice: 'sob consulta' },
  ])
  assert.equal(result.homogenizedComparables.length, 1)
  assert.equal(result.homogenizedComparables[0].weight, 1)
  assert.equal(result.sampleQuality?.excludedCount, 1)
})
test('observed range requires three valid comparables', () => {
  const result = evaluate({}, [
    comparable,
    { ...comparable, declaredPrice: 'R$ 500.000' },
    { ...comparable, declaredPrice: 'R$ 600.000' },
  ])
  assert.deepEqual(result.sampleQuality?.observedValueRange, {
    min: 450000,
    max: 600000,
  })
  assert.equal(result.sampleQuality?.status, 'limitada')
})
