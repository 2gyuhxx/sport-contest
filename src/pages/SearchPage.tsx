import { useEffect, useMemo, useState, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { Calendar, Search, X } from 'lucide-react'
import { useEventContext } from '../context/useEventContext'
import type { Category, Event, RegionMeta } from '../types/events'
import type { SportCategory } from '../types/auth'
import { formatDate } from '../utils/formatDate'
import { feature as topojsonFeature } from 'topojson-client'
import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

const KR_PROVINCES_TOPO = '/maps/skorea-provinces-2018-topo.json'
const KR_MUNICIPALITIES_TOPO = '/maps/skorea-municipalities-2018-topo.json'

const BASE_VIEW = { center: [127.5, 36.2] as [number, number], zoom: 1.45 }

type CategoryFilter = 'all' | SportCategory
type ProvinceFeature = Feature<Geometry, { name: string }>
type ProvinceFeatureCollection = FeatureCollection<Geometry, { name: string }>

// 스포츠 카테고리 정보
const SPORT_CATEGORIES: { value: SportCategory; label: string; emoji: string }[] = [
  { value: 'team-ball', label: '구기·팀', emoji: '⚽' },
  { value: 'racket-ball', label: '라켓·볼', emoji: '🏓' },
  { value: 'martial-arts', label: '무도·격투', emoji: '🥋' },
  { value: 'fitness-skill', label: '체력·기술', emoji: '🏋️' },
  { value: 'precision', label: '정밀·기술', emoji: '🎯' },
  { value: 'ice-snow', label: '빙상·설원', emoji: '⛷️' },
  { value: 'water', label: '수상·해양', emoji: '🏊' },
  { value: 'leisure', label: '레저·환경', emoji: '🚴' },
  { value: 'mind', label: '마인드', emoji: '🧠' },
  { value: 'other', label: '기타', emoji: '🎮' },
]

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: '전체',
  'team-ball': '구기·팀',
  'racket-ball': '라켓·볼',
  'martial-arts': '무도·격투',
  'fitness-skill': '체력·기술',
  'precision': '정밀·기술',
  'ice-snow': '빙상·설원',
  'water': '수상·해양',
  'leisure': '레저·환경',
  'mind': '마인드',
  'other': '기타',
}

const REGION_COLORS: Record<
  string,
  { default: string; hover: string; active: string; muted: string }
> = {
  seoul: {
    default: '#c7d2fe',
    hover: '#a5b4fc',
    active: '#818cf8',
    muted: '#e2e8ff',
  },
  busan: {
    default: '#bfdbfe',
    hover: '#93c5fd',
    active: '#a3bffa',
    muted: '#dbeafe',
  },
  daegu: { default: '#fde7d0', hover: '#f9c9a1', active: '#f8b88b', muted: '#fff1e3' },
  incheon: { default: '#cdfae5', hover: '#9fe9c8', active: '#8bd8b7', muted: '#e3fdf0' },
  gwangju: { default: '#fce0f1', hover: '#f7badc', active: '#f29eca', muted: '#fdebf6' },
  daejeon: { default: '#faecc8', hover: '#f6dba1', active: '#f1c679', muted: '#fef7e6' },
  ulsan: { default: '#d9f0ff', hover: '#afe2ff', active: '#99d2f7', muted: '#ebf8ff' },
  sejong: { default: '#ede4ff', hover: '#d7c9ff', active: '#c5b4f9', muted: '#f4edff' },
  gyeonggi: { default: '#fef4cc', hover: '#fde39b', active: '#fbd977', muted: '#fff9e4' },
  gangwon: { default: '#ffe2e0', hover: '#ffc5c0', active: '#ffb3ab', muted: '#fff0f0' },
  chungbuk: { default: '#e6ddff', hover: '#d0c0ff', active: '#bba9ff', muted: '#f0eaff' },
  chungnam: { default: '#f9dcff', hover: '#f1b7ff', active: '#eba0ff', muted: '#fce9ff' },
  jeonbuk: { default: '#defee0', hover: '#baf7c1', active: '#a3ebad', muted: '#f0fff0' },
  jeonnam: { default: '#d1f7ff', hover: '#a5e9ff', active: '#8dddf4', muted: '#e7fbff' },
  gyeongbuk: { default: '#ffe8d5', hover: '#ffd0aa', active: '#ffbe8c', muted: '#fff3e8' },
  gyeongnam: { default: '#fddae8', hover: '#f7b7d4', active: '#f091c0', muted: '#feeaf2' },
  jeju: { default: '#fef0d0', hover: '#fbdca1', active: '#f7c879', muted: '#fff4de' },
}

const FALLBACK_REGION_PALETTE = {
  default: '#e2e8f0',
  hover: '#cbd5f5',
  active: '#cbd5f5',
  muted: '#e2e8f0',
}

const NAME_SUFFIXES = [
  '특별자치도',
  '특별자치시',
  '특별시',
  '광역시',
  '자치도',
  '자치시',
  '광역',
  '특별',
  '도',
  '시',
] as const

const PREFIX_MAP: Record<string, string> = {
  충청: '충',
  전라: '전',
  경상: '경',
}

const Tag = ({ label }: { label: string }) => (
  <span className="inline-block rounded-full border border-surface-subtle bg-white px-2 py-0.5 text-xs text-slate-600">
    {label}
  </span>
)

const createNameVariants = (value: string) => {
  const variants = new Set<string>()
  const trimmed = value.trim()
  if (!trimmed) return Array.from(variants)

  const noSpace = trimmed.replace(/\s+/g, '')
  variants.add(trimmed)
  variants.add(noSpace)

  NAME_SUFFIXES.forEach((suffix) => {
    if (noSpace.endsWith(suffix)) {
      const stripped = noSpace.slice(0, noSpace.length - suffix.length)
      if (stripped) {
        variants.add(stripped)
        Object.entries(PREFIX_MAP).forEach(([full, short]) => {
          if (stripped.startsWith(full)) {
            variants.add(stripped.replace(full, short))
          }
        })
      }
    }
  })

  Object.entries(PREFIX_MAP).forEach(([full, short]) => {
    if (noSpace.startsWith(full)) {
      variants.add(noSpace.replace(full, short))
    }
  })

  return Array.from(variants)
}

export function SearchPage() {
  let contextValue
  try {
    contextValue = useEventContext()
  } catch (error) {
    console.error('EventContext 에러:', error)
    // EventContext가 없는 경우 빈 값 반환
    contextValue = {
      state: {
        events: [],
        regions: [],
        categories: [],
        selectedRegion: null,
        selectedCategory: null,
        keyword: '',
        activeEventId: null,
      },
      dispatch: () => {},
      filteredEvents: [],
      appliedFilters: {},
    }
  }
  
  const { state, dispatch } = contextValue
  const { events = [], regions = [], categories = [] } = state || {}

  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [hoverLabel, setHoverLabel] = useState<string | null>(null)

  const initialRegion = state?.selectedRegion ?? null
  const initialCategory = (state?.selectedCategory ?? 'all') as CategoryFilter
  const initialKeyword = state?.keyword ?? ''

  const [selectedRegion, setSelectedRegion] = useState<string | null>(initialRegion)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(initialCategory)
  const [searchTerm, setSearchTerm] = useState(initialKeyword)

  const regionIdToMeta = useMemo(
    () =>
      regions.reduce<Record<string, RegionMeta>>((acc, region) => {
        acc[region.id] = region
        return acc
      }, {}),
    [regions],
  )

  const regionNameLookup = useMemo(() => {
    const map = new Map<string, string>()

    regions.forEach((region) => {
      const keys = new Set<string>([region.name, region.shortName, ...region.aliases])
      keys.forEach((key) => {
        createNameVariants(key).forEach((variant) => {
          if (variant && !map.has(variant)) {
            map.set(variant, region.id)
          }
        })
      })
    })

    return map
  }, [regions])

  const resolveRegionId = useCallback(
    (rawName: string) => {
      const variants = createNameVariants(rawName)
      for (const variant of variants) {
        const id = regionNameLookup.get(variant)
        if (id) return id
      }
      return undefined
    },
    [regionNameLookup],
  )

  const [provinceFeatureMap, setProvinceFeatureMap] = useState<
    Record<string, ProvinceFeature>
  >({})
  
  const [municipalitiesFeatures, setMunicipalitiesFeatures] = useState<ProvinceFeatureCollection | null>(null)

  useEffect(() => {
    let mounted = true
    const loadProvinces = async () => {
      try {
        const response = await fetch(KR_PROVINCES_TOPO)
        const topo = await response.json()
        const collection = topojsonFeature(
          topo,
          topo.objects.skorea_provinces_2018_geo,
        ) as unknown as ProvinceFeatureCollection
        if (!mounted) return
        const mapping: Record<string, ProvinceFeature> = {}
        ;(collection.features as ProvinceFeature[]).forEach((feat) => {
          const raw = feat.properties?.name ?? ''
          const regionId = resolveRegionId(raw)
          if (regionId) {
            mapping[regionId] = feat
          }
        })
        setProvinceFeatureMap(mapping)
      } catch (error) {
        console.error('Failed to load province shapes', error)
      }
    }
    loadProvinces()
    return () => {
      mounted = false
    }
  }, [resolveRegionId])
  
  // 시/군/구 데이터 로드
  useEffect(() => {
    let mounted = true
    const loadMunicipalities = async () => {
      try {
        const response = await fetch(KR_MUNICIPALITIES_TOPO)
        const topo = await response.json()
        const collection = topojsonFeature(
          topo,
          topo.objects.skorea_municipalities_2018_geo,
        ) as unknown as ProvinceFeatureCollection
        if (!mounted) return
        setMunicipalitiesFeatures(collection)
      } catch (error) {
        console.error('Failed to load municipalities', error)
      }
    }
    loadMunicipalities()
    return () => {
      mounted = false
    }
  }, [])

  const citiesByRegion = useMemo(() => {
    const map = new Map<string, Set<string>>()
    events.forEach((event) => {
      if (!map.has(event.region)) {
        map.set(event.region, new Set())
      }
      map.get(event.region)!.add(event.city)
    })
    return map
  }, [events])

  const citiesInRegion = useMemo(() => {
    if (!selectedRegion) return []
    return Array.from(citiesByRegion.get(selectedRegion) ?? []).sort((a, b) =>
      a.localeCompare(b, 'ko'),
    )
  }, [citiesByRegion, selectedRegion])

  const categoryOptions = useMemo<CategoryFilter[]>(() => {
    // 새로운 스포츠 카테고리 목록 사용
    return ['all', ...SPORT_CATEGORIES.map(cat => cat.value)]
  }, [])

  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return events
      .filter((event) => {
        const regionMatch = selectedRegion ? event.region === selectedRegion : true
        const cityMatch = selectedCity ? event.city === selectedCity : true
        const categoryMatch =
          categoryFilter === 'all' ? true : event.category === categoryFilter
        const keywordMatch = term
          ? [event.title, event.city, event.summary]
              .join(' ')
              .toLowerCase()
              .includes(term)
          : true
        return regionMatch && cityMatch && categoryMatch && keywordMatch
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [categoryFilter, events, searchTerm, selectedCity, selectedRegion])

  useEffect(() => {
    setCategoryFilter(initialCategory)
  }, [initialCategory])

  useEffect(() => {
    setSearchTerm(initialKeyword)
  }, [initialKeyword])

  const resetFilters = () => {
    setSelectedRegion(null)
    setSelectedCity(null)
    setCategoryFilter('all')
    setSearchTerm('')
    dispatch({ type: 'CLEAR_FILTERS' })
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
  }

  const handleRegionClick = (regionId: string) => {
    const nextRegion = regionId === selectedRegion ? null : regionId
    setSelectedRegion(nextRegion)
    setSelectedCity(null)

    if (state.selectedRegion !== nextRegion) {
      dispatch({ type: 'SELECT_REGION', payload: nextRegion })
    }
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
  }

  const handleCityClick = (city: string) => {
    setSelectedCity(city)
    setSearchTerm(city)
    dispatch({ type: 'SET_KEYWORD', payload: city })
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: null })
  }

  const handleCategoryChange = (option: CategoryFilter) => {
    setCategoryFilter(option)
    const nextCategory = option === 'all' ? null : option
    if (state.selectedCategory !== nextCategory) {
      dispatch({ type: 'SELECT_CATEGORY', payload: nextCategory })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (state.keyword !== value) {
      dispatch({ type: 'SET_KEYWORD', payload: value })
    }
  }

  const handleEventSelect = (event: Event) => {
    dispatch({ type: 'SET_ACTIVE_EVENT', payload: event.id })
  }

  const heroRegionLabel = selectedRegion
    ? regionIdToMeta[selectedRegion]?.shortName ?? selectedRegion
    : null

  const spotlightPalette =
    selectedRegion && REGION_COLORS[selectedRegion]
      ? REGION_COLORS[selectedRegion]
      : FALLBACK_REGION_PALETTE

  // 선택된 지역의 SVG path 생성
  const selectedRegionSvgPath = useMemo(() => {
    if (!selectedRegion || !provinceFeatureMap[selectedRegion]) return null
    const feature = provinceFeatureMap[selectedRegion]
    const projection = geoMercator().fitExtent(
      [
        [20, 20],
        [380, 380],
      ],
      feature,
    )
    const pathGenerator = geoPath(projection)
    return pathGenerator(feature) ?? null
  }, [selectedRegion, provinceFeatureMap])
  
  // 선택된 지역의 시/군/구 경계들
  const selectedMunicipalitiesPaths = useMemo(() => {
    if (!selectedRegion || !provinceFeatureMap[selectedRegion] || !municipalitiesFeatures) {
      return []
    }
    
    const provinceFeature = provinceFeatureMap[selectedRegion]
    const projection = geoMercator().fitExtent(
      [
        [20, 20],
        [380, 380],
      ],
      provinceFeature,
    )
    const pathGenerator = geoPath(projection)
    
    // 선택된 지역의 시/군/구 필터링 (SIG_CD 코드 기반)
    const prefix = regionIdToMeta[selectedRegion]?.prefix ?? ''
    const municipalities = municipalitiesFeatures.features.filter((feat) => {
      const props = (feat.properties ?? {}) as Record<string, string>
      const code = props.SIG_CD ?? props.sig_cd ?? ''
      return prefix ? code.startsWith(prefix) : false
    })
    
    // 각 시/군/구의 path 생성
    return municipalities.map((feat) => {
      const props = (feat.properties ?? {}) as Record<string, string>
      return {
        path: pathGenerator(feat.geometry) ?? '',
        name: props.name_local ?? props.SIG_KOR_NM ?? props.name ?? '',
      }
    })
  }, [selectedRegion, provinceFeatureMap, municipalitiesFeatures, regionIdToMeta])


  return (
    <div className="space-y-16 pb-20">
      <section className="rounded-4xl bg-gradient-to-br from-brand-primary to-brand-secondary p-10 text-white md:p-16">
        <div className="mx-auto flex max-w-content flex-col gap-7">
          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">
            sport contest search
          </span>
          <h1 className="text-3xl font-bold md:text-5xl">
            원하는 지역의 스포츠 행사를 지도에서 찾아보세요
          </h1>
          <p className="max-w-2xl text-base text-white/80 md:text-lg">
            도·광역시를 클릭해 세부 시·군·구 경계를 확인하고, 필터와 검색으로 관심 있는
            행사를 빠르게 찾을 수 있습니다.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            <span>• 지역을 선택하면 해당 지역이 확대되어 표시됩니다.</span>
            <span>• 시/군/구를 클릭하여 세부 필터링이 가능합니다.</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-content grid-cols-1 gap-6 px-4 md:grid-cols-[minmax(0,4.2fr)_minmax(320px,1.2fr)] lg:gap-10">
        <div className="relative flex flex-col gap-5 overflow-hidden">
          <div className="rounded-4xl border border-surface-subtle bg-white p-5 shadow-sm md:p-7 lg:p-8 overflow-hidden">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
                  대한민국 지역 지도
                </h2>
                <p className="text-sm text-slate-600">
                  {heroRegionLabel
                    ? `${heroRegionLabel} 선택됨 · 우측에 확대 지도가 표시됩니다.`
                    : '도/광역시를 선택하면 해당 지역이 확대됩니다.'}
                </p>
              </div>
              {(selectedRegion || selectedCity || searchTerm || categoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <X className="h-3 w-3" /> 초기화
                </button>
              )}
            </div>

            {/* 전체 지도 */}
            <div className={`relative overflow-hidden rounded-4xl border border-surface-subtle bg-white/70 p-4 transition-all duration-500 ease-in-out ${
              selectedRegion ? 'md:-translate-x-8 md:scale-[0.85] md:origin-left' : ''
            }`}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ scale: 3600, center: BASE_VIEW.center }}
                height={860}
                className="w-full bg-surface"
              >
                <ZoomableGroup center={BASE_VIEW.center} zoom={BASE_VIEW.zoom}>
                  <Geographies geography={KR_PROVINCES_TOPO}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const props = (geo.properties ?? {}) as Record<string, string>
                        const rawName =
                          props.name_local ?? props.name ?? props.SIG_KOR_NM ?? ''
                        const regionId = resolveRegionId(rawName)
                        const isSelected = !!regionId && regionId === selectedRegion
                        const palette =
                          (regionId ? REGION_COLORS[regionId] : undefined) ??
                          FALLBACK_REGION_PALETTE

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() =>
                              setHoverLabel(
                                regionIdToMeta[regionId ?? '']?.shortName ?? rawName,
                              )
                            }
                            onMouseLeave={() => setHoverLabel(null)}
                            onClick={() => regionId && handleRegionClick(regionId)}
                            style={{
                              default: {
                                fill: isSelected ? palette.active : palette.default,
                                stroke: '#94a3b8',
                                strokeWidth: 0.5,
                                outline: 'none',
                              },
                              hover: {
                                fill: palette.hover,
                                outline: 'none',
                                cursor: regionId ? 'pointer' : 'default',
                              },
                              pressed: { fill: palette.active, outline: 'none' },
                            }}
                          />
                        )
                      })
                    }
                  </Geographies>

                  {selectedRegion && (
                    <Geographies geography={KR_MUNICIPALITIES_TOPO}>
                      {({ geographies }) => {
                        const prefix = regionIdToMeta[selectedRegion]?.prefix ?? ''
                        return geographies
                          .filter((geo) => {
                            const props = (geo.properties ?? {}) as Record<string, string>
                            const code = props.SIG_CD ?? props.sig_cd ?? ''
                            return prefix ? code.startsWith(prefix) : false
                          })
                          .map((geo) => {
                            const props = (geo.properties ?? {}) as Record<string, string>
                            const name =
                              props.name_local ?? props.SIG_KOR_NM ?? props.name ?? ''
                            const isActive = selectedCity === name
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                onMouseEnter={() => setHoverLabel(name)}
                                onMouseLeave={() => setHoverLabel(null)}
                                onClick={() => handleCityClick(name)}
                                style={{
                                  default: {
                                    fill: isActive
                                      ? REGION_COLORS[selectedRegion]?.muted ?? '#fde68a'
                                      : 'transparent',
                                    stroke: '#64748b',
                                    strokeWidth: 0.6,
                                    outline: 'none',
                                  },
                                  hover: {
                                    fill: REGION_COLORS[selectedRegion]?.default ?? '#fef3c7',
                                    outline: 'none',
                                    cursor: 'pointer',
                                  },
                                  pressed: { fill: '#fef08a', outline: 'none' },
                                }}
                              />
                            )
                          })
                      }}
                    </Geographies>
                  )}
                </ZoomableGroup>
              </ComposableMap>

              {hoverLabel && (
                <div className="pointer-events-none absolute right-4 top-4 rounded-md bg-slate-900/85 px-3 py-1 text-xs text-white shadow">
                  {hoverLabel}
                </div>
              )}

            </div>
          </div>

          {/* 선택된 지역 확대 오버레이 - 오른쪽 상단 */}
          {selectedRegion && selectedRegionSvgPath && (
            <div className="absolute right-8 top-20 w-[420px] rounded-3xl border-2 border-brand-primary/40 bg-white/98 p-6 shadow-2xl backdrop-blur transition-all duration-500 ease-in-out hidden md:block z-20 animate-in slide-in-from-right fade-in">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{regionIdToMeta[selectedRegion]?.shortName === '서울' ? '🏙️' : regionIdToMeta[selectedRegion]?.shortName === '부산' ? '🌊' : regionIdToMeta[selectedRegion]?.shortName === '제주' ? '🏝️' : '📍'}</span>
                  <h3 className="text-xl font-bold text-slate-900">
                    {regionIdToMeta[selectedRegion]?.name ?? heroRegionLabel}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleRegionClick(selectedRegion)}
                  className="rounded-full p-1.5 transition hover:bg-slate-100"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
              
              <svg viewBox="0 0 400 400" className="h-72 w-full rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-5 shadow-inner">
                {/* 전체 지역 배경 */}
                <path
                  d={selectedRegionSvgPath}
                  fill={spotlightPalette.default}
                  stroke={spotlightPalette.hover}
                  strokeWidth={3}
                  className="drop-shadow-xl"
                />
                {/* 시/군/구 경계선 */}
                {selectedMunicipalitiesPaths.map((municipality, idx) => (
                  <path
                    key={idx}
                    d={municipality.path}
                    fill="transparent"
                    stroke="#64748b"
                    strokeWidth={1.2}
                    className="pointer-events-none"
                    opacity={0.6}
                  />
                ))}
              </svg>
              
              <div className="mt-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">주요 도시</p>
                <p className="text-sm font-medium text-slate-800">
                  {regionIdToMeta[selectedRegion]?.cities.join(', ') ?? '정보 없음'}
                </p>
              </div>
              
              <p className="mt-4 text-xs text-slate-500 text-center bg-slate-50 rounded-lg py-2">
                💡 시/군/구 경계선으로 세부 지역을 확인할 수 있습니다
              </p>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:gap-6">
          <div className="rounded-4xl border border-surface-subtle bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-2 rounded-full border border-surface-subtle bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="도시 또는 행사명을 검색하세요"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              {(searchTerm ||
                categoryFilter !== 'all' ||
                selectedRegion ||
                selectedCity) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="whitespace-nowrap text-xs text-slate-500 transition hover:text-brand-primary"
                >
                  초기화
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {categoryOptions.map((option) => {
                const categoryInfo = option === 'all' 
                  ? { label: '전체', emoji: '🌐' }
                  : SPORT_CATEGORIES.find(cat => cat.value === option)
                
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleCategoryChange(option)}
                    className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs transition whitespace-nowrap ${
                      categoryFilter === option
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                    }`}
                  >
                    {categoryInfo?.emoji && <span className="text-sm flex-shrink-0">{categoryInfo.emoji}</span>}
                    <span>{categoryInfo?.label || CATEGORY_LABELS[option]}</span>
                  </button>
                )
              })}
              {selectedRegion && (
                <Tag
                  label={`지역: ${regionIdToMeta[selectedRegion]?.shortName ?? selectedRegion}`}
                />
              )}
              {selectedCity && <Tag label={`도시: ${selectedCity}`} />}
            </div>
          </div>

          <div className="rounded-4xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">시/군/구</h2>
              {selectedRegion ? (
                <span className="text-xs text-slate-500">{citiesInRegion.length}곳</span>
              ) : (
                <span className="text-xs text-slate-500">도/광역시를 먼저 선택하세요</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRegion ? (
                citiesInRegion.length ? (
                  citiesInRegion.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleCityClick(city)}
                      className={`rounded-lg border px-2 py-1 text-xs transition ${
                        selectedCity === city
                          ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                          : 'border-surface-subtle text-slate-600 hover:border-brand-primary hover:text-brand-primary'
                      }`}
                    >
                      {city}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    샘플 데이터에 도시 정보가 없습니다. 더 많은 Mock 데이터를 추가해 보세요.
                  </p>
                )
              ) : (
                <p className="text-sm text-slate-500">지역을 선택하면 도시 목록이 표시됩니다.</p>
              )}
            </div>
          </div>

          <div className="rounded-4xl border border-surface-subtle bg-white p-6 shadow-sm md:p-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Calendar className="h-4 w-4 text-brand-primary" />
                행사 목록
              </h2>
              <span className="text-xs text-slate-500">{filteredEvents.length}건</span>
            </div>
            <ul className="flex flex-col divide-y divide-surface-subtle">
              {filteredEvents.length ? (
                filteredEvents.map((event) => {
                  const regionLabel =
                    regionIdToMeta[event.region]?.shortName ?? event.region
                  return (
                    <li key={event.id} className="py-3">
                      <button
                        type="button"
                        onClick={() => handleEventSelect(event)}
                        className="w-full text-left"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-slate-900">
                            {event.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {regionLabel} · {event.city} · {formatDate(event.date)}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <Tag label={CATEGORY_LABELS[event.category]} />
                          </div>
                          <p className="text-xs text-slate-500">{event.summary}</p>
                        </div>
                      </button>
                    </li>
                  )
                })
              ) : (
                <li className="py-6 text-center text-sm text-slate-500">
                  조건에 맞는 행사가 없습니다.
                </li>
              )}
            </ul>
          </div>
        </aside>
      </section>
    </div>
  )
}
