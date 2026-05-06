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

export interface QueueItem {
  id?: number
  bookmarkId: number
  title: string
  url: string
  thumbnail: string
  addedAt: number
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
  queue!: Table<QueueItem>
  settings!: Table<Settings>

  constructor() {
    super('stashd')
    this.version(4).stores({
      bookmarks: '++id, url, title, domain, savedAt, lastWatched, isAlive',
      playlists: '++id, name, createdAt',
      queue: '++id, bookmarkId, addedAt',
      settings: '++id'
    })
  }
}

export const db = new StashdDB()

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

export function extractTags(title: string, level: number): string[] {
  if (level === 0) return []

  const stopWords = new Set([
    'the','and','with','for','a','an','in','on','at','to','of',
    'video','watch','free','hd','full','online','porn','sex',
    'xxx','tube','hot','new','best','big','all','is','are',
    'was','be','by','from','as','or','but','not','this',
    'her','his','sd','4k','mp4','now','part','get','your',
    'again','lends','hand','you','better','fucks','fucked',
    'slut','slutty','gets','make','makes','take','takes',
    'cum','does','fuck','getting','being','more','just',
    'only','also','into','that','then','than','when','will',
    'have','has','had','its','our','out','can','back','even',
    'most','over','such','well','up','my','me','him','she',
    'they','we','us','it','go','got','let','put','end','old',
    'own','too','very','want','way','who','why','yes','yet',
    'use','two','how','any','may','say','each','once','please'
  ])

  const tags: string[] = []
  const segments = title.split(/\s*[-–—]\s*/)

  segments.forEach((segment, index) => {
    const trimmed = segment.trim()
    if (!trimmed) return
    if (/tube|xxx|porn|videos|\.com|\.xxx/i.test(trimmed)) return

    const words = trimmed.split(/\s+/)

    if (index === 0 && words.length >= 1 && words.length <= 3) {
      const name = trimmed.toLowerCase()
      if (!stopWords.has(name)) {
        tags.push(name)
        return
      }
    }

    words.forEach(word => {
      const w = word.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w)) {
        tags.push(w)
      }
    })
  })

  const unique = [...new Set(tags)].filter(t => t.length > 1)
  return unique.slice(0, level)
}