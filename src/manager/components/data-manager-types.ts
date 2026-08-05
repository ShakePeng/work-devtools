import type { Person, Platform, Cookie, PlatformBridgeMock, PlatformMode } from '@shared/types'

export type Selection =
  | { type: 'person'; personId: string }
  | { type: 'platform'; personId: string; platformId: string }
  | null

export type EntityType = 'person' | 'platform' | 'cookie'
export type EditorMode = 'add' | 'edit' | 'import'

export interface EditorState {
  mode: EditorMode
  entityType: EntityType
  personId?: string
  platformId?: string
  entityId?: string
  title: string
  breadcrumb: string
  initialName?: string
  initialValue?: string
  initialJson?: string
  initialDeviceProfileId?: string
  initialBridges?: PlatformBridgeMock[]
  initialCookies?: Cookie[]
  initialPlatformMode?: PlatformMode
}

export interface EditorSubmitPayload {
  mode: EditorMode
  entityType: EntityType
  tab: 'form' | 'json' | 'bulk'
  name?: string
  value?: string
  json?: string
  deviceProfileId?: string
  bridges?: PlatformBridgeMock[]
  cookies?: Cookie[]
  platformMode?: PlatformMode
}

export type SearchResult =
  | { type: 'person'; person: Person }
  | { type: 'platform'; person: Person; platform: Platform }
  | { type: 'cookie'; person: Person; platform: Platform; cookie: Cookie }
