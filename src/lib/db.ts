import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface Bookmark {
  id?: number
  url: string
  title: string
  domain: string
  duration: string
  thumbnail: string
  description: string
  tags: string[]
  moodTags: string[]
  badges: string[]
  notes: string
  isFavorite: boolean
  watchProgress: number
  watchCount: number
  lastWatched: number | null
  isAlive: boolean
  lastChecked: number | null
  playlists: number[]
  savedAt: number
}

export interface Playlist {
  id?: number
  name: string
  itemIds: number[]
  createdAt: number
  shuffle: boolean
}

export interface Settings {
  id?: number
  passwordHash: string | null
  pinHash: string | null
  stealthMode: boolean
  decoyConfig: {
    type: 'calculator' | 'notes' | 'todo' | 'weather' | 'custom'
    title: string
    color: string
    content: string
  }
  theme: 'dark' | 'light' | 'focus'
  uiMode: 'popup' | 'tab' | 'sidepanel'
  autoTagLevel: number
  autoPlay: boolean
  roastMode: boolean
  tagTaxonomy: string[]
}

class StashdDB extends Dexie {
  bookmarks!: Table<Bookmark>
  playlists!: Table<Playlist>
  settings!: Table<Settings>

  constructor() {
    super('stashd')
    this.version(3).stores({
      bookmarks: '++id, url, title, domain, savedAt, lastWatched, isAlive',
      playlists: '++id, name, createdAt',
      settings: '++id'
    })
  }
}

export const db = new StashdDB()

// Default settings
export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get(1)
  if (s) return s
  const defaults: Settings = {
    id: 1,
    passwordHash: null,
    pinHash: null,
    stealthMode: false,
    decoyConfig: {
      type: 'calculator',
      title: 'Calculator',
      color: '#ffffff',
      content: ''
    },
    theme: 'dark',
    uiMode: 'popup',
    autoTagLevel: 5,
    autoPlay: false,
    roastMode: false,
    tagTaxonomy: []
  }
  await db.settings.put(defaults)
  return defaults
}

// Auto tag extractor
export function extractTags(title: string, level: number): string[] {
  if (level === 0) return []
  const stopWords = new Set([
    'the','and','with','for','a','an','in','on','at','to','of',
    'video','watch','free','hd','full','online','porn','sex',
    'xxx','tube','hot','new','best','big','black','white','all',
    'is','are','was','be','by','from','as','or','but','not','this'
  ])
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
  const unique = [...new Set(words)]
  return unique.slice(0, level)
}
