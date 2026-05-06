import { useState, useEffect } from 'react'
import { db, type Bookmark, type QueueItem, type Playlist, getSettings, extractTags } from './lib/db'
import { Lock } from './Lock'
import { Decoy } from './Decoy'

declare const chrome: any

type View = 'library' | 'playlist'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function hashPin(pin: string): string {
  let hash = 0
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i)
    hash |= 0
  }
  return hash.toString()
}

function App() {
  const [unlocked, setUnlocked] = useState(false)
  const [pinHash, setPinHash] = useState<string | null>(null)
  const [pinLoaded, setPinLoaded] = useState(false)
  const [showDecoy, setShowDecoy] = useState(false)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('')
  const [domain, setDomain] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [saved, setSaved] = useState<Bookmark[]>([])
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [autoTagLevel, setAutoTagLevel] = useState(5)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [showQueue, setShowQueue] = useState(false)
  const [view, setView] = useState<View>('library')
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [showNewPlaylist, setShowNewPlaylist] = useState(false)
  const [addingToPlaylist, setAddingToPlaylist] = useState<Bookmark | null>(null)
  const [isShuffled, setIsShuffled] = useState(false)
  const [shuffledIds, setShuffledIds] = useState<number[]>([])
  const [checking, setChecking] = useState(false)
  const [filterDead, setFilterDead] = useState(false)

  useEffect(() => {
    getSettings().then(s => {
      setAutoTagLevel(s.autoTagLevel)
      setPinHash(s.pinHash)
      setPinLoaded(true)
      setUnlocked(false)
    })
    loadSaved()
    loadQueue()
    loadPlaylists()

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
      const tab = tabs[0]
      if (!tab) return
      if (tab.url) {
        setUrl(tab.url)
        try { setDomain(new URL(tab.url).hostname.replace('www.', '')) } catch {}
      }
      if (tab.title) setTitle(tab.title)
      if (tab.id) {
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const video = document.querySelector('video') as HTMLVideoElement
              const dur = (video && isFinite(video.duration))
                ? `${Math.floor(video.duration/60)}:${Math.floor(video.duration%60).toString().padStart(2,'0')}`
                : ''
              const desc = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || ''
              const thumb = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || ''
              return { dur, desc, thumb }
            }
          }, (results: any[]) => {
            const r = results?.[0]?.result
            if (r?.dur) setDuration(r.dur)
            if (r?.desc) setDescription(r.desc)
            if (r?.thumb) setThumbnail(r.thumb)
          })
        }, 1500)
      }
    })

    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        setShowDecoy(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKey)

    // Listen for health check completion
    const handleMessage = (msg: any) => {
      if (msg.type === 'CHECK_COMPLETE') {
        setChecking(false)
        loadSaved()
        setSaveMsg('✅ Health check complete!')
        setTimeout(() => setSaveMsg(''), 3000)
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      window.removeEventListener('keydown', handleKey)
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const loadSaved = async () => {
    const items = await db.bookmarks.orderBy('savedAt').reverse().toArray()
    setSaved(items.map(item => ({
      ...item,
      tags: item.tags || [],
      badges: item.badges || [],
      moodTags: item.moodTags || [],
      playlists: item.playlists || [],
    })))
  }

  const loadQueue = async () => {
    const items = await db.queue.orderBy('addedAt').toArray()
    setQueue(items)
  }

  const loadPlaylists = async () => {
    const items = await db.playlists.orderBy('createdAt').toArray()
    setPlaylists(items)
  }

  const handleSetPin = async (pin: string) => {
    const h = hashPin(pin)
    await db.settings.update(1, { pinHash: h })
    setPinHash(h)
    setUnlocked(true)
  }

  const handleUnlock = (pin: string): boolean => {
    if (hashPin(pin) === pinHash) {
      setUnlocked(true)
      return true
    }
    return false
  }

  const handleSave = async () => {
    if (url.trim() === '') return
    const tags = extractTags(title, autoTagLevel)
    await db.bookmarks.add({
      url: url.trim(),
      title: title.trim() || url.trim(),
      domain,
      duration,
      thumbnail,
      description,
      tags,
      moodTags: [],
      badges: [],
      notes: '',
      isFavorite: false,
      watchProgress: 0,
      watchCount: 0,
      lastWatched: null,
      isAlive: true,
      lastChecked: null,
      playlists: [],
      savedAt: Date.now()
    })
    await loadSaved()
    setUrl('')
    setTitle('')
    setDuration('')
    setDescription('')
    setThumbnail('')
    setSaveMsg('✅ Saved!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleRetagAll = async () => {
    const items = await db.bookmarks.toArray()
    for (const item of items) {
      const tags = extractTags(item.title, autoTagLevel)
      await db.bookmarks.update(item.id!, { tags })
    }
    await loadSaved()
    setSaveMsg('✅ Re-tagged!')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleCheckLinks = () => {
    setChecking(true)
    setSaveMsg('🔍 Checking links...')
    chrome.runtime.sendMessage({ type: 'CHECK_LINKS' })
  }

  const handleDelete = async (id: number) => {
    await db.bookmarks.delete(id)
    await loadSaved()
  }

  const handleOpen = (url: string) => {
    chrome.tabs.create({ url })
  }

  const toggleBadge = async (item: Bookmark, badge: string) => {
    const badges = (item.badges || []).includes(badge)
      ? (item.badges || []).filter(b => b !== badge)
      : [...(item.badges || []), badge]
    await db.bookmarks.update(item.id!, { badges })
    await loadSaved()
  }

  const addToQueue = async (item: Bookmark) => {
    await db.queue.add({
      bookmarkId: item.id!,
      title: item.title,
      url: item.url,
      thumbnail: item.thumbnail,
      addedAt: Date.now()
    })
    await loadQueue()
    setSaveMsg('➕ Added to queue!')
    setTimeout(() => setSaveMsg(''), 1500)
  }

  const playNext = async () => {
    if (queue.length === 0) return
    const next = queue[0]
    chrome.tabs.create({ url: next.url })
    await db.queue.delete(next.id!)
    await loadQueue()
  }

  const removeFromQueue = async (id: number) => {
    await db.queue.delete(id)
    await loadQueue()
  }

  const clearQueue = async () => {
    await db.queue.clear()
    await loadQueue()
  }

  const shuffleQueue = async () => {
    const shuffled = shuffle(queue)
    await db.queue.clear()
    for (const item of shuffled) {
      const { id, ...rest } = item
      await db.queue.add({ ...rest, addedAt: Date.now() + Math.random() })
    }
    await loadQueue()
    setSaveMsg('🔀 Queue shuffled!')
    setTimeout(() => setSaveMsg(''), 1500)
  }

  const toggleShuffleLibrary = () => {
    if (isShuffled) {
      setIsShuffled(false)
      setShuffledIds([])
    } else {
      const ids = shuffle(saved.map(s => s.id!))
      setShuffledIds(ids)
      setIsShuffled(true)
      setSaveMsg('🔀 Library shuffled!')
      setTimeout(() => setSaveMsg(''), 1500)
    }
  }

  const shuffleIntoQueue = async (items: Bookmark[]) => {
    const shuffled = shuffle(items)
    for (const item of shuffled) {
      await db.queue.add({
        bookmarkId: item.id!,
        title: item.title,
        url: item.url,
        thumbnail: item.thumbnail,
        addedAt: Date.now() + Math.random() * 1000
      })
    }
    await loadQueue()
    setShowQueue(true)
    setSaveMsg(`🔀 ${shuffled.length} videos queued!`)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return
    await db.playlists.add({
      name: newPlaylistName.trim(),
      itemIds: [],
      createdAt: Date.now(),
      shuffle: false
    })
    setNewPlaylistName('')
    setShowNewPlaylist(false)
    await loadPlaylists()
  }

  const deletePlaylist = async (id: number) => {
    await db.playlists.delete(id)
    if (activePlaylist?.id === id) {
      setActivePlaylist(null)
      setView('library')
    }
    await loadPlaylists()
  }

  const addToPlaylist = async (playlist: Playlist, item: Bookmark) => {
    const ids = playlist.itemIds || []
    if (ids.includes(item.id!)) return
    await db.playlists.update(playlist.id!, { itemIds: [...ids, item.id!] })
    await db.bookmarks.update(item.id!, { playlists: [...(item.playlists || []), playlist.id!] })
    await loadPlaylists()
    await loadSaved()
    setAddingToPlaylist(null)
    setSaveMsg(`➕ Added to ${playlist.name}!`)
    setTimeout(() => setSaveMsg(''), 1500)
  }

  const removeFromPlaylist = async (playlist: Playlist, itemId: number) => {
    const ids = (playlist.itemIds || []).filter(id => id !== itemId)
    await db.playlists.update(playlist.id!, { itemIds: ids })
    const item = saved.find(s => s.id === itemId)
    if (item) {
      await db.bookmarks.update(itemId, { playlists: (item.playlists || []).filter(p => p !== playlist.id!) })
    }
    await loadPlaylists()
    await loadSaved()
    if (activePlaylist?.id === playlist.id) {
      const updated = await db.playlists.get(playlist.id!)
      setActivePlaylist(updated || null)
    }
  }

  const deadCount = saved.filter(s => s.lastChecked && !s.isAlive).length

  const allTags = [...new Set(saved.flatMap(s => s.tags || []))]

  const playlistItems = activePlaylist
    ? (activePlaylist.itemIds || []).map(id => saved.find(s => s.id === id)).filter(Boolean) as Bookmark[]
    : []

  const baseItems = view === 'playlist' ? playlistItems : saved
  const orderedItems = isShuffled && view === 'library'
    ? shuffledIds.map(id => saved.find(s => s.id === id)).filter(Boolean) as Bookmark[]
    : baseItems

  const filtered = orderedItems.filter(item => {
    const matchSearch = search === '' || item.title.toLowerCase().includes(search.toLowerCase())
    const matchTag = filterTag === '' || (item.tags || []).includes(filterTag)
    const matchDead = !filterDead || (item.lastChecked && !item.isAlive)
    return matchSearch && matchTag && matchDead
  })
const findReplacement = (item: Bookmark) => {
    const query = encodeURIComponent(item.title.replace(/[-–—]/g, ' ').trim())
    chrome.tabs.create({ url: `https://www.google.com/search?q=${query}` })
  }
  const renderItem = (item: Bookmark) => (
    <div key={item.id} style={{ background: '#1a2533', borderRadius: 5, overflow: 'hidden', border: item.lastChecked && !item.isAlive ? '1px solid #c0392b' : '1px solid transparent' }}>
      <div style={{ display: 'flex', gap: 7, padding: 7 }}>
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            style={{ width: 72, height: 46, objectFit: 'cover', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
            onClick={() => handleOpen(item.url)}
          />
        ) : (
          <div
            onClick={() => handleOpen(item.url)}
            style={{ width: 72, height: 46, background: '#0f1923', borderRadius: 3, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}
          >
            ▶
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={() => handleOpen(item.url)}
            style={{ fontWeight: 'bold', fontSize: 11, color: '#5b9bd5', cursor: 'pointer', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {item.title}
          </div>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🌐 {item.domain} {item.duration && `· ⏱ ${item.duration}`}</span>
            {item.lastChecked && (
              <span style={{ color: item.isAlive ? '#27ae60' : '#c0392b', fontSize: 10 }}>
                {item.isAlive ? '● Live' : '● Dead'}
              </span>
            )}
            {item.lastChecked && !item.isAlive && (
              <span
                onClick={() => findReplacement(item)}
                style={{ fontSize: 10, color: '#e67e22', cursor: 'pointer', padding: '1px 5px', border: '1px solid #e67e22', borderRadius: 4 }}
              >
                🔎 Find
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 3 }}>
            {(item.tags || []).map(tag => (
              <span
                key={tag}
                onClick={() => setFilterTag(tag)}
                style={{ padding: '1px 5px', borderRadius: 8, background: '#0f1923', color: '#5b9bd5', fontSize: 10, cursor: 'pointer' }}
              >
                {tag}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            {['⚡','🔁','✅','❤️'].map(badge => (
              <span
                key={badge}
                onClick={() => toggleBadge(item, badge)}
                style={{ fontSize: 11, cursor: 'pointer', opacity: (item.badges || []).includes(badge) ? 1 : 0.2 }}
              >
                {badge}
              </span>
            ))}
            <span
              onClick={() => addToQueue(item)}
              style={{ fontSize: 10, color: '#5b9bd5', cursor: 'pointer', padding: '1px 5px', border: '1px solid #5b9bd5', borderRadius: 4 }}
            >
              +Q
            </span>
            <span
              onClick={() => setAddingToPlaylist(addingToPlaylist?.id === item.id ? null : item)}
              style={{ fontSize: 10, color: '#aaa', cursor: 'pointer', padding: '1px 5px', border: '1px solid #333', borderRadius: 4 }}
            >
              +PL
            </span>
            {view === 'playlist' && activePlaylist && (
              <span
                onClick={() => removeFromPlaylist(activePlaylist, item.id!)}
                style={{ fontSize: 10, color: '#c0392b', cursor: 'pointer', padding: '1px 5px', border: '1px solid #c0392b', borderRadius: 4 }}
              >
                −PL
              </span>
            )}
            <button
              onClick={() => handleDelete(item.id!)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 13, padding: 0 }}
            >×</button>
          </div>

          {addingToPlaylist?.id === item.id && (
            <div style={{ marginTop: 4, background: '#0f1923', borderRadius: 4, padding: 6 }}>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Add to playlist:</div>
              {playlists.length === 0 && (
                <div style={{ fontSize: 10, color: '#444' }}>No playlists yet.</div>
              )}
              {playlists.map(pl => (
                <div
                  key={pl.id}
                  onClick={() => addToPlaylist(pl, item)}
                  style={{ padding: '3px 6px', fontSize: 11, color: '#aaa', cursor: 'pointer', borderRadius: 3, marginBottom: 2 }}
                >
                  📋 {pl.name} {(pl.itemIds || []).includes(item.id!) && '✓'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(item.watchProgress || 0) > 0 && (
        <div style={{ height: 2, background: '#333' }}>
          <div style={{ height: 2, background: '#5b9bd5', width: `${item.watchProgress}%` }} />
        </div>
      )}
    </div>
  )

  if (!pinLoaded) return null
  if (showDecoy) return <Decoy onExit={() => setShowDecoy(false)} />

  if (!unlocked) {
    return (
      <div style={{ position: 'relative' }}>
        <Lock
          hasPin={!!pinHash}
          onSetPin={handleSetPin}
          onUnlock={handleUnlock}
        />
        {!pinHash && (
          <div
            onClick={() => setUnlocked(true)}
            style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: '#333', cursor: 'pointer' }}
          >
            Skip for now
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: 580, fontFamily: 'Arial', background: '#0f1923', color: '#fff', minHeight: 400, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #1a2533' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 'bold', color: '#5b9bd5' }}>📁 Stashd</span>
          <input
            style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #333', background: '#1a2533', color: '#fff', fontSize: 12 }}
            placeholder="Paste or save current URL..."
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button
            style={{ padding: '4px 12px', background: '#1F3A5F', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #333', background: '#1a2533', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
            placeholder="🔍 Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => { setView('library'); setActivePlaylist(null); setFilterTag('') }}
            style={{ padding: '4px 8px', background: view === 'library' ? '#5b9bd5' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
          >
            Library
          </button>
          <button
            onClick={toggleShuffleLibrary}
            style={{ padding: '4px 8px', background: isShuffled ? '#5b9bd5' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
            title="Shuffle library"
          >
            🔀
          </button>
          <button
            onClick={() => setShowQueue(!showQueue)}
            style={{ padding: '4px 8px', background: showQueue ? '#5b9bd5' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}
          >
            🎬 {queue.length > 0 ? `(${queue.length})` : 'Q'}
          </button>
          <button
            onClick={handleCheckLinks}
            disabled={checking}
            style={{ padding: '4px 8px', background: checking ? '#5b9bd5' : deadCount > 0 ? '#c0392b' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: checking ? 'default' : 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}
            title="Check for dead links"
          >
            {checking ? '🔍...' : deadCount > 0 ? `💀 ${deadCount}` : '🔍'}
          </button>
          {deadCount > 0 && (
            <button
              onClick={() => setFilterDead(!filterDead)}
              style={{ padding: '4px 8px', background: filterDead ? '#c0392b' : '#1a2533', color: '#fff', border: '1px solid #c0392b', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
              title="Show dead links only"
            >
              Dead
            </button>
          )}
          <button
            onClick={handleRetagAll}
            style={{ padding: '4px 8px', background: '#1a2533', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
            title="Re-tag all"
          >
            ✦
          </button>
          <button
            onClick={() => setUnlocked(false)}
            style={{ padding: '4px 8px', background: '#1a2533', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
            title="Lock"
          >
            🔒
          </button>
        </div>
        {saveMsg && <div style={{ color: '#4caf50', fontSize: 11, marginTop: 4 }}>{saveMsg}</div>}
      </div>

      {/* Queue panel */}
      {showQueue && (
        <div style={{ background: '#111e2b', borderBottom: '1px solid #1a2533', padding: '8px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 'bold', color: '#5b9bd5' }}>🎬 Queue ({queue.length})</span>
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={playNext}
                disabled={queue.length === 0}
                style={{ padding: '3px 8px', background: queue.length > 0 ? '#1F3A5F' : '#1a2533', color: queue.length > 0 ? '#fff' : '#444', border: 'none', borderRadius: 4, cursor: queue.length > 0 ? 'pointer' : 'default', fontSize: 11 }}
              >
                ▶ Next
              </button>
              <button
                onClick={shuffleQueue}
                disabled={queue.length === 0}
                style={{ padding: '3px 8px', background: '#1a2533', color: queue.length > 0 ? '#aaa' : '#333', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
              >
                🔀
              </button>
              <button
                onClick={() => shuffleIntoQueue(view === 'playlist' ? playlistItems : filtered)}
                style={{ padding: '3px 8px', background: '#1a2533', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' }}
              >
                + All 🔀
              </button>
              <button
                onClick={clearQueue}
                style={{ padding: '3px 8px', background: 'none', color: '#555', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
              >
                Clear
              </button>
            </div>
          </div>
          {queue.length === 0 && (
            <p style={{ color: '#444', fontSize: 11, margin: 0 }}>Queue is empty.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
            {queue.map((item, index) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1a2533', borderRadius: 4, padding: '4px 8px' }}>
                <span style={{ color: '#444', fontSize: 10, minWidth: 14 }}>{index + 1}</span>
                {item.thumbnail && <img src={item.thumbnail} style={{ width: 36, height: 24, objectFit: 'cover', borderRadius: 2 }} />}
                <span style={{ flex: 1, fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                <button onClick={() => removeFromQueue(item.id!)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 13 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {view === 'playlist' && activePlaylist && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 6px', borderBottom: '1px solid #1a2533' }}>
              <span style={{ fontSize: 12, fontWeight: 'bold', color: '#5b9bd5' }}>📋 {activePlaylist.name}</span>
              <span style={{ fontSize: 10, color: '#444' }}>{playlistItems.length} videos</span>
              <button
                onClick={() => shuffleIntoQueue(playlistItems)}
                style={{ marginLeft: 'auto', padding: '2px 8px', background: '#1a2533', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}
              >
                🔀 Queue All
              </button>
            </div>
          )}
          {filtered.length === 0 && (
            <p style={{ color: '#666', fontSize: 12, padding: 8 }}>
              {view === 'playlist' ? 'No videos in this playlist yet.' : 'No saved items yet.'}
            </p>
          )}
          {filtered.map(item => renderItem(item))}
        </div>

        <div style={{ width: 100, borderLeft: '1px solid #1a2533', padding: '8px 6px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ fontSize: 9, color: '#444', fontWeight: 'bold', letterSpacing: 1 }}>PLAYLISTS</div>
              <span onClick={() => setShowNewPlaylist(!showNewPlaylist)} style={{ fontSize: 14, color: '#5b9bd5', cursor: 'pointer', lineHeight: 1 }}>+</span>
            </div>
            {showNewPlaylist && (
              <div style={{ marginBottom: 6 }}>
                <input
                  autoFocus
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createPlaylist()}
                  placeholder="Name..."
                  style={{ width: '100%', padding: '3px 5px', background: '#1a2533', border: '1px solid #5b9bd5', borderRadius: 3, color: '#fff', fontSize: 10, boxSizing: 'border-box' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {playlists.map(pl => (
                <div key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span
                    onClick={() => { setActivePlaylist(pl); setView('playlist'); setFilterTag('') }}
                    style={{ flex: 1, padding: '2px 5px', borderRadius: 3, background: activePlaylist?.id === pl.id ? '#5b9bd5' : '#1a2533', color: activePlaylist?.id === pl.id ? '#fff' : '#aaa', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {pl.name}
                  </span>
                  <span onClick={() => deletePlaylist(pl.id!)} style={{ color: '#333', cursor: 'pointer', fontSize: 11 }}>×</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, color: '#444', marginBottom: 5, fontWeight: 'bold', letterSpacing: 1 }}>TAGS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span
                onClick={() => setFilterTag('')}
                style={{ padding: '2px 6px', borderRadius: 3, background: filterTag === '' ? '#5b9bd5' : '#1a2533', color: '#fff', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
              >
                All
              </span>
              {allTags.map(tag => (
                <span
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                  style={{ padding: '2px 6px', borderRadius: 3, background: filterTag === tag ? '#5b9bd5' : '#1a2533', color: filterTag === tag ? '#fff' : '#aaa', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App