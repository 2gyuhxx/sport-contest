import { useEffect, useMemo, useRef, useState } from 'react'
import type { Event, RegionMeta } from '../../types/events'
import { EventPin } from '../EventPin'
import { batchAddressToSvgCoordinates } from '../../utils/geocoding'

const DEFAULT_VIEW_BOX = '0 0 509 716.1'

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

interface KoreaMapProps {
  regions: RegionMeta[]
  activeRegionId?: string | null
  events: Event[]
  activeEventId?: string | null
  onRegionSelect: (regionId: string | null) => void
  onEventSelect: (event: Event) => void
}

export function KoreaMap({
  regions,
  activeRegionId,
  events,
  activeEventId,
  onRegionSelect,
  onEventSelect,
}: KoreaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const baseViewBoxRef = useRef(DEFAULT_VIEW_BOX)

  const [viewBox, setViewBox] = useState(DEFAULT_VIEW_BOX)
  const [svgMarkup, setSvgMarkup] = useState<string>('')
  const [regionBounds, setRegionBounds] = useState<Record<string, Bounds>>({})
  const [addressCoordinates, setAddressCoordinates] = useState<Map<string, { x: number; y: number } | null>>(new Map())


  useEffect(() => {
    let isMounted = true
    const loadSvg = async () => {
      try {
        const response = await fetch('/maps/korea-regions.svg')
        const raw = await response.text()
        if (!isMounted) return
        const { innerMarkup, viewBox: parsedViewBox } = transformSvg(raw, regions)
        setSvgMarkup(innerMarkup)
        const nextViewBox = parsedViewBox ?? DEFAULT_VIEW_BOX
        baseViewBoxRef.current = nextViewBox
        setViewBox(nextViewBox)
      } catch (error) {
        console.error('Failed to load korea-regions.svg', error)
      }
    }

    loadSvg()

    return () => {
      isMounted = false
    }
  }, [regions])

  useEffect(() => {
    if (!containerRef.current) return
    const svgElement = containerRef.current.querySelector('svg')
    if (!svgElement) return
    svgRef.current = svgElement as SVGSVGElement

    const bounds: Record<string, Bounds> = {}
    regions.forEach((region) => {
      const regionElement = svgElement.querySelector<SVGGElement>(
        `[data-region-id="${region.id}"]`,
      )
      if (!regionElement) return

      const bbox = regionElement.getBBox()
      bounds[region.id] = {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      }
    })
    setRegionBounds(bounds)
  }, [svgMarkup, regions])

  // 주소를 좌표로 변환
  useEffect(() => {
    if (!events.length) {
      return
    }

    const addresses = events
      .filter(event => event.address && event.address.trim() !== '')
      .map(event => event.address)

    if (addresses.length === 0) {
      return
    }

    batchAddressToSvgCoordinates(addresses)
      .then(coords => {
        setAddressCoordinates(coords)
      })
      .catch(error => {
        console.error('[KoreaMap] 주소 좌표 변환 오류:', error)
      })
  }, [events])

  useEffect(() => {
    if (!svgRef.current) return
    const regionElements = Array.from(
      svgRef.current.querySelectorAll<SVGGElement>('[data-region-id]'),
    )

    const cleanup: Array<() => void> = []

    regionElements.forEach((element) => {
      const regionId = element.getAttribute('data-region-id')
      if (!regionId) return

      const handleClick = () => {
        const nextRegionId = regionId === activeRegionId ? null : regionId
        onRegionSelect(nextRegionId)
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          const nextRegionId = regionId === activeRegionId ? null : regionId
          onRegionSelect(nextRegionId)
        }
      }

      element.setAttribute('tabindex', '0')
      element.setAttribute('role', 'button')
      element.addEventListener('click', handleClick)
      element.addEventListener('keydown', handleKeyDown)

      cleanup.push(() => {
        element.removeEventListener('click', handleClick)
        element.removeEventListener('keydown', handleKeyDown)
        element.removeAttribute('tabindex')
        element.removeAttribute('role')
      })
    })

    return () => {
      cleanup.forEach((fn) => fn())
    }
  }, [activeRegionId, onRegionSelect, svgMarkup])

  useEffect(() => {
    if (!svgRef.current) return
    const regionElements = svgRef.current.querySelectorAll<SVGGElement>('[data-region-id]')
    regionElements.forEach((element) => {
      const regionId = element.getAttribute('data-region-id')
      element.classList.toggle('is-active', regionId === activeRegionId)
    })
  }, [activeRegionId])

  useEffect(() => {
    if (!activeRegionId) {
      setViewBox(baseViewBoxRef.current)
      return
    }

    const bounds = regionBounds[activeRegionId]
    if (!bounds) return
    const padding = Math.max(bounds.width, bounds.height) * 0.45
    const nextViewBox = [
      Math.max(bounds.x - padding, 0),
      Math.max(bounds.y - padding, 0),
      bounds.width + padding * 2,
      bounds.height + padding * 2,
    ].join(' ')
    setViewBox(nextViewBox)
  }, [activeRegionId, regionBounds])

  const activeRegion = useMemo(
    () => regions.find((region) => region.id === activeRegionId),
    [regions, activeRegionId],
  )

  const pins = useMemo(() => {
    if (!events.length) return []

    const grouped = events.reduce<Record<string, Event[]>>((acc, event) => {
      acc[event.region] = acc[event.region] ? [...acc[event.region], event] : [event]
      return acc
    }, {})

    const data: Array<{ event: Event; position: { x: number; y: number } }> = []

    Object.entries(grouped).forEach(([regionId, regionEvents]) => {
      const bounds = regionBounds[regionId]
      if (!bounds) return

      const sortedEvents = [...regionEvents].sort((a, b) =>
        a.id.localeCompare(b.id),
      )
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + bounds.height / 2
      const scatterRadius = Math.min(bounds.width, bounds.height) * 0.18

      sortedEvents.forEach((event, index) => {
        let posX = centerX
        let posY = centerY
        let offsetX = 0
        let offsetY = 0

        // 1순위: 주소 기반 정확한 좌표
        if (event.address && addressCoordinates.has(event.address)) {
          const coords = addressCoordinates.get(event.address)
          if (coords) {
            posX = coords.x
            posY = coords.y
            
            // 같은 주소에 여러 행사가 있으면 약간 분산
            if (sortedEvents.length > 1) {
              const angle = (index / sortedEvents.length) * Math.PI * 2
              const microRadius = 5 // 작은 반경으로 분산
              offsetX = Math.cos(angle) * microRadius
              offsetY = Math.sin(angle) * microRadius
            }
          }
        }
        // 2순위: 수동 설정된 오프셋
        else if (event.pinOffset) {
          offsetX = event.pinOffset.x
          offsetY = event.pinOffset.y
        }
        // 3순위: 지역 중심에서 자동 분산
        else if (sortedEvents.length > 1) {
          const angle = (index / sortedEvents.length) * Math.PI * 2
          offsetX = Math.cos(angle) * scatterRadius
          offsetY = Math.sin(angle) * scatterRadius
        }

        data.push({
          event,
          position: {
            x: posX + offsetX,
            y: posY + offsetY,
          },
        })
      })
    })

    return data
  }, [events, regionBounds, addressCoordinates])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-3xl border border-surface-subtle bg-white shadow-sm"
    >
      <svg
        ref={svgRef}
        viewBox={viewBox}
        role="img"
        aria-label="대한민국 지역 지도"
        className="h-[420px] w-full transition-all duration-300 ease-out md:h-full"
      >
        <g dangerouslySetInnerHTML={{ __html: svgMarkup }} />
        {pins.map(({ event, position }) => (
          <EventPin
            key={event.id}
            event={event}
            position={position}
            onSelect={onEventSelect}
            isActive={activeEventId === event.id}
          />
        ))}
      </svg>

      {activeRegion && (
        <div className="pointer-events-none absolute left-6 top-6 rounded-xl bg-white/95 px-4 py-3 shadow">
          <p className="text-xs uppercase tracking-wide text-slate-500">선택 지역</p>
          <p className="text-lg font-semibold text-slate-900">{activeRegion.name}</p>
          <p className="text-xs text-slate-500">
            주요 도시: {activeRegion.cities.join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

function transformSvg(svgMarkup: string, regions: RegionMeta[]) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml')
  const svgElement = doc.querySelector('svg')
  if (!svgElement) {
    return { innerMarkup: '', viewBox: DEFAULT_VIEW_BOX }
  }

  const highlightCss = `
    .region-shape { cursor: pointer; }
    .region-shape .st0 { transition: fill 0.25s ease; fill: #f5f1e7; }
    .region-shape.is-active .st0 { fill: #22c55e !important; }
    .region-shape:hover .st0 { fill: #2563eb !important; }
  `

  const styleElement =
    svgElement.querySelector('style') ?? doc.createElement('style')
  styleElement.textContent = `${styleElement.textContent ?? ''}\n${highlightCss}`
  if (!styleElement.parentElement) {
    svgElement.insertBefore(styleElement, svgElement.firstChild)
  }

  regions.forEach((region) => {
    const regionGroup = svgElement.querySelector<SVGGElement>(
      `g[id="${region.svgId}"]`,
    )
    if (!regionGroup) return
    regionGroup.setAttribute('data-region-id', region.id)
    regionGroup.classList.add('region-shape')
  })

  return {
    innerMarkup: svgElement.innerHTML,
    viewBox: svgElement.getAttribute('viewBox') ?? undefined,
  }
}
