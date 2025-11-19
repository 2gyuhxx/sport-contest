// Kakao Maps API 타입 정의
declare global {
  interface Window {
    kakao: {
      maps: {
        Map: new (container: HTMLElement, options: any) => any
        LatLng: new (lat: number, lng: number) => any
        LatLngBounds: new () => any
        Marker: new (options: any) => any
        InfoWindow: new (options: any) => any
        MarkerClusterer: new (options: any) => any
        Polygon: new (options: any) => any
        CustomOverlay: new (options: any) => any
        event: {
          addListener: (target: any, type: string, callback: (event?: any) => void) => void
        }
        services: {
          Geocoder: new () => {
            addressSearch: (
              address: string,
              callback: (result: any[], status: string) => void,
            ) => void
            coord2Address: (
              lng: number,
              lat: number,
              callback: (result: any[], status: string) => void,
            ) => void
          }
          Status: {
            OK: string
            ZERO_RESULT: string
            ERROR: string
          }
          Places: new () => {
            keywordSearch: (
              keyword: string,
              callback: (result: any[], status: string, pagination: any) => void,
              options?: any,
            ) => void
          }
        }
      }
    }
  }
}

export {}

