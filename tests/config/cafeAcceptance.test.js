import { describe, expect, test } from '@jest/globals'
import fixture from '../fixtures/cafeAcceptance.json'

describe('P0 cafe acceptance specification consistency, not functional acceptance', () => {
  test('keeps unresolved hardware/performance and poster prices explicit', () => {
    expect(fixture.status).toBe('proposed-targets-not-observed-behavior')
    expect(fixture.devices.phoneModel).toBe('SM-A156E/DSN')
    expect(fixture.devices.tabletModel).toBeNull()
    expect(fixture.performance.deviceMeasurements).toBeNull()
    expect(fixture.performance.realCatalogVerified).toBe(false)
    expect(new Set(fixture.scenarios.map(scenario => scenario.id)).size).toBe(20)
  })

  test.each(fixture.scenarios)('$id $name has exact centavo expectations and valid fixture references', scenario => {
    expect(['dine-in', 'takeout', 'delivery']).toContain(scenario.type)
    expect([null, 'cash', 'gcash']).toContain(scenario.payment)
    expect(scenario.phases.length).toBeGreaterThan(0)
    expect(scenario.assertions.length).toBeGreaterThan(0)
    const computed = scenario.lines.reduce((total, line) => {
      const product = fixture.products.find(product => product.id === line.product)
      expect(product).toBeDefined()
      expect(Number.isSafeInteger(line.quantity) && line.quantity > 0).toBe(true)
      const extras = line.extras.map(extraId => {
        const extra = fixture.extras.find(extra => extra.id === extraId)
        expect(extra).toBeDefined()
        expect(extra.appliesTo).toContain(product.id)
        return extra.priceCentavos
      })
      if (product.componentCount) {
        expect(line.components.reduce((count, component) => count + component.quantity, 0)).toBe(3)
        for (const component of line.components) {
          expect(['hawaiian', 'pepperoni']).toContain(component.product)
          expect(Number.isSafeInteger(component.quantity) && component.quantity > 0).toBe(true)
        }
      }
      return total + (product.priceCentavos + extras.reduce((sum, price) => sum + price, 0)) * line.quantity
    }, 0)
    expect(Number.isSafeInteger(computed)).toBe(true)
    expect(computed).toBe(scenario.expectedTotalCentavos)
    if (scenario.payment === 'cash') {
      expect(scenario.tenderCentavos).toBeGreaterThanOrEqual(computed)
      expect(scenario.tenderCentavos - computed).toBe(scenario.expectedChangeCentavos)
    } else {
      expect(scenario.tenderCentavos).toBeUndefined()
    }
    if (scenario.expectedDrawerCentavos !== undefined) {
      expect(scenario.expectedDrawerCentavos).toBe(scenario.openingFloatCentavos + computed)
    }
  })
})
