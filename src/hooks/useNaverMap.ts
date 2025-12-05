import { useState, useEffect, useRef, type RefObject } from 'react'

interface UseNaverMapReturn {
    mapRef: RefObject<any>
    mapContainerRef: RefObject<HTMLDivElement>
    naverMapsLoaded: boolean
    naverMapsError: string | null
    initializeMap: (onMapReady?: (map: any) => void) => void
}

export function useNaverMap(): UseNaverMapReturn {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const [naverMapsLoaded, setNaverMapsLoaded] = useState(false)
    const [naverMapsError, setNaverMapsError] = useState<string | null>(null)

    // 네이버맵 SDK 로드 및 전역 에러 핸들러 설정
    useEffect(() => {
        // 전역 에러 핸들러를 먼저 설정 (Naver Maps API 에러를 조용히 처리)
        const handleScriptError = (event: ErrorEvent) => {
            try {
                const errorMessage = event.message || ''
                const filename = event.filename || ''
                const stack = event.error?.stack || ''

                // 네이버 맵 API 관련 에러인지 확인 (매우 넓은 범위로 캐치)
                const isNaverMapError =
                    filename.includes('naver.com') ||
                    filename.includes('maps.js') ||
                    stack.includes('maps.js') ||
                    errorMessage.includes('substring') ||
                    (errorMessage.includes('Cannot read properties') && errorMessage.includes('undefined'))

                if (isNaverMapError) {
                    // 에러를 완전히 조용히 처리 (콘솔에 표시하지 않음)
                    event.stopImmediatePropagation()
                    event.preventDefault()
                    event.stopPropagation()
                    return false
                }
            } catch {
                // 에러 핸들러 자체에서 에러 발생 시 무시
            }
        }

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            try {
                const errorMessage = event.reason?.message || String(event.reason || '')
                const stack = event.reason?.stack || ''
                if (errorMessage.includes('substring') ||
                    errorMessage.includes('Cannot read properties') ||
                    errorMessage.includes('naver') ||
                    errorMessage.includes('maps') ||
                    stack.includes('maps.js')) {
                    // 에러를 완전히 조용히 처리
                    event.preventDefault()
                    return false
                }
            } catch {
                // 에러 핸들러 자체에서 에러 발생 시 무시
            }
        }

        // 에러 핸들러를 가장 먼저 등록 (다른 핸들러보다 먼저 실행되도록)
        window.addEventListener('error', handleScriptError, true)
        window.addEventListener('unhandledrejection', handleUnhandledRejection, true)

        if (window.naver?.maps) {
            setNaverMapsLoaded(true)
            return () => {
                window.removeEventListener('error', handleScriptError, true)
                window.removeEventListener('unhandledrejection', handleUnhandledRejection, true)
            }
        }

        const existingScript = document.querySelector(`script[src*="naver.com/openapi"]`)
        if (existingScript) {
            const checkLoaded = setInterval(() => {
                if (window.naver?.maps) {
                    setNaverMapsLoaded(true)
                    clearInterval(checkLoaded)
                }
            }, 100)
            return () => {
                clearInterval(checkLoaded)
                window.removeEventListener('error', handleScriptError, true)
                window.removeEventListener('unhandledrejection', handleUnhandledRejection, true)
            }
        }

        const script = document.createElement('script')
        const naverClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID
        if (!naverClientId) {
            console.error('[useNaverMap] 네이버맵 API 키가 설정되지 않았습니다. .env 파일에 VITE_NAVER_MAP_CLIENT_ID를 설정해주세요.')
            setNaverMapsError('네이버맵 API 키가 설정되지 않았습니다.')
            return () => {
                window.removeEventListener('error', handleScriptError, true)
                window.removeEventListener('unhandledrejection', handleUnhandledRejection, true)
            }
        }
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${naverClientId}&submodules=geocoder`
        script.async = true
        script.onerror = () => {
            console.error('[useNaverMap] 네이버맵 API 스크립트 로드 실패. API 키를 확인해주세요.')
            setNaverMapsError('네이버맵 API 스크립트를 로드할 수 없습니다. API 키를 확인해주세요.')
        }

        script.onload = () => {
            const checkLoaded = setInterval(() => {
                if (window.naver?.maps) {
                    setNaverMapsLoaded(true)
                    clearInterval(checkLoaded)
                }
            }, 100)

            // 타임아웃 설정 (10초 후 실패로 간주)
            setTimeout(() => {
                if (!window.naver?.maps) {
                    console.error('[useNaverMap] 네이버맵 API 로드 타임아웃')
                    clearInterval(checkLoaded)
                    setNaverMapsError('네이버맵 API 로드가 시간 초과되었습니다.')
                }
            }, 10000)
        }
        document.head.appendChild(script)

        // cleanup 함수에서 이벤트 리스너 제거
        return () => {
            window.removeEventListener('error', handleScriptError, true)
            window.removeEventListener('unhandledrejection', handleUnhandledRejection, true)
        }
    }, [])

    // 지도 초기화 함수
    const initializeMap = (onMapReady?: (map: any) => void) => {
        if (!naverMapsLoaded || !mapContainerRef.current || mapRef.current) return

        const mapOptions = {
            center: new window.naver.maps.LatLng(36.5, 125.5),
            zoom: 7,
            minZoom: 6,
            maxZoom: 18,
            zoomControl: true,
            zoomControlOptions: {
                position: 7, // RIGHT_CENTER
                style: 1, // SMALL
            },
            mapTypeControl: false,
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
        }

        const map = new window.naver.maps.Map(mapContainerRef.current, mapOptions)
        mapRef.current = map

        // 콜백 실행
        if (onMapReady) {
            onMapReady(map)
        }
    }

    return {
        mapRef,
        mapContainerRef,
        naverMapsLoaded,
        naverMapsError,
        initializeMap
    }
}
