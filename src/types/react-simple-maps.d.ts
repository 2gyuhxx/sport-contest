declare module 'react-simple-maps' {
  import type { FC, MouseEvent, ReactNode } from 'react'

  export interface RSMGeography {
    rsmKey: string
    properties?: Record<string, unknown>
  }

  export interface GeographiesRenderProps {
    geographies: RSMGeography[]
  }

  export interface GeographyStyle {
    default?: Record<string, unknown>
    hover?: Record<string, unknown>
    pressed?: Record<string, unknown>
  }

  export interface GeographyProps {
    geography: RSMGeography
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void
    onMouseLeave?: (event: MouseEvent<SVGPathElement>) => void
    onClick?: (event: MouseEvent<SVGPathElement>) => void
    style?: GeographyStyle
  }

  export interface GeographiesProps {
    geography: string
    onMouseEnter?: (event: MouseEvent<SVGPathElement>) => void
    children: (props: GeographiesRenderProps) => ReactNode
  }

  export const ComposableMap: FC<{
    projection?: string
    projectionConfig?: Record<string, unknown>
    height?: number
    className?: string
    children?: ReactNode
  }>

  export const ZoomableGroup: FC<{
    center?: [number, number]
    zoom?: number
    children?: ReactNode
  }>

  export const Geographies: FC<GeographiesProps>

  export const Geography: FC<GeographyProps>
}
