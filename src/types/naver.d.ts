// Naver Maps API 타입 정의
declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (container: HTMLElement, options: any) => any
        LatLng: new (lat: number, lng: number) => any
        LatLngBounds: new (sw?: any, ne?: any) => any
        Marker: new (options: any) => any
        InfoWindow: new (options: any) => any
        Polygon: new (options: any) => any
        CustomOverlay: new (options: any) => any
        Size: new (width: number, height: number) => any
        Point: new (x: number, y: number) => any
        Event: {
          addListener: (target: any, type: string, callback: (event?: any) => void) => void
          removeListener: (target: any, type: string, callback: (event?: any) => void) => void
        }
        event: {
          addListener: (target: any, type: string, callback: (event?: any) => void) => void
          removeListener: (target: any, type: string, callback: (event?: any) => void) => void
        }
        Service: {
          Geocoder: new () => {
            addressSearch: (
              address: string,
              callback: (status: string, response: any) => void
            ) => void
            reverseGeocode: (
              coords: any,
              callback: (status: string, response: any) => void
            ) => void
          }
          Status: {
            OK: string
            ERROR: string
            ZERO_RESULT: string
          }
        }
      }
    }
  }
}

export {}

