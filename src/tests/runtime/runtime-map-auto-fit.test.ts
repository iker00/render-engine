import { describe, expect, it } from 'vitest'
import { resolveMapInitialView } from '../../runtime/runtime-map-auto-fit'

describe('resolveMapInitialView', () => {
  const fallback = { center: { lat: 10, lng: 20 }, zoom: 5 }

  it('devuelve center con el fallback cuando no hay coordenadas', () => {
    const result = resolveMapInitialView([], fallback)

    expect(result).toEqual({ mode: 'center', center: fallback.center, zoom: fallback.zoom })
  })

  it('devuelve center centrado en la única coordenada, ignorando fallback.center', () => {
    const result = resolveMapInitialView([{ lat: 1, lng: 2 }], fallback)

    expect(result).toEqual({ mode: 'center', center: { lat: 1, lng: 2 }, zoom: fallback.zoom })
  })

  it('devuelve center cuando varias coordenadas son idénticas entre sí', () => {
    const result = resolveMapInitialView(
      [
        { lat: 3, lng: 4 },
        { lat: 3, lng: 4 },
        { lat: 3, lng: 4 },
      ],
      fallback,
    )

    expect(result).toEqual({ mode: 'center', center: { lat: 3, lng: 4 }, zoom: fallback.zoom })
  })

  it('devuelve bounds con dos coordenadas distintas, suroeste primero y noreste después', () => {
    const result = resolveMapInitialView(
      [
        { lat: 1, lng: 2 },
        { lat: 5, lng: 6 },
      ],
      fallback,
    )

    expect(result).toEqual({ mode: 'bounds', bounds: [[1, 2], [5, 6]] })
  })

  it('devuelve bounds que contiene a todas las coordenadas dispersas, sin depender del orden de entrada', () => {
    const result = resolveMapInitialView(
      [
        { lat: -10, lng: 30 },
        { lat: 20, lng: -40 },
        { lat: 5, lng: 5 },
      ],
      fallback,
    )

    expect(result).toEqual({ mode: 'bounds', bounds: [[-10, -40], [20, 30]] })
  })

  it('no degenera a center cuando las coordenadas comparten lat pero difieren en lng', () => {
    const result = resolveMapInitialView(
      [
        { lat: 7, lng: 1 },
        { lat: 7, lng: 9 },
      ],
      fallback,
    )

    expect(result).toEqual({ mode: 'bounds', bounds: [[7, 1], [7, 9]] })
  })

  it('no muta el array de coordenadas recibido', () => {
    const coordinates = [
      { lat: -10, lng: 30 },
      { lat: 20, lng: -40 },
      { lat: 5, lng: 5 },
    ]
    const original = coordinates.map((coordinate) => ({ ...coordinate }))

    resolveMapInitialView(coordinates, fallback)

    expect(coordinates).toEqual(original)
  })
})
