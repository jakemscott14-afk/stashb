import { useState, useEffect } from 'react'
import { db, type Bookmark, getSettings, extractTags } from './lib/db'

declare const chrome: any

function App() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState('')
  const [domain, setDomain] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [saved, setSaved] = useState<Bookmark[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [autoTagLevel, setAutoTagLevel] = useState(5)
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')

  useEffect(() => {
    getSettings().then(s => setAutoTagLevel(s.autoTagLevel))
    db.bookmarks.orderBy('savedAt').reverse().toArray().then(items => {
      setSaved(items.map(item => ({
        ...item,
        tags: item.tags || [],
        badges: item.badges || [],
        moodTags: item.moodTags || [],
        playlists: item.playlists || [],
      })))
    })

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

  const allTags = [...new Set(saved.flatMap(s => s.tags || []))]

  const filtered = saved.filter(item => {
    const matchSearch = search === '' || item.title.toLowerCase().includes(search.toLowerCase())
    const matchTag = filterTag === '' || (item.tags || []).includes(filterTag)
    return matchSearch && matchTag
  })

  return (
    <div style={{ width: 400, padding: 16, fontFamily: 'Arial', background: '#0f1923', color: '#fff', minHeight: 500 }}>

      <h2 style={{ color: '#5b9bd5', marginBottom: 12, fontSize: 18 }}>📁 Stashd</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid #333', background: '#1a2533', color: '#fff' }}
          placeholder="Paste a URL to save..."
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <button
          style={{ padding: '6px 12px', background: '#1F3A5F', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          onClick={handleSave}
        >
          Save
        </button>
      </div>

      {saveMsg && <div style={{ color: '#4caf50', fontSize: 12, marginBottom: 8 }}>{saveMsg}</div>}

      <input
        style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #333', background: '#1a2533', color: '#fff', marginBottom: 8, boxSizing: 'border-box' }}
        placeholder="🔍 Search saved items..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          <span
            onClick={() => setFilterTag('')}
            style={{ padding: '2px 8px', borderRadius: 12, background: filterTag === '' ? '#5b9bd5' : '#1a2533', color: '#fff', fontSize: 11, cursor: 'pointer' }}
          >
            All
          </span>
          {allTags.map(tag => (
            <span
              key={tag}
              onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              style={{ padding: '2px 8px', borderRadius: 12, background: filterTag === tag ? '#5b9bd5' : '#1a2533', color: '#fff', fontSize: 11, cursor: 'pointer' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p style={{ color: '#666', fontSize: 13 }}>No saved items yet.</p>
      )}

      {filtered.map(item => (
        <div key={item.id} style={{ marginBottom: 8, background: '#1a2533', borderRadius: 6, overflow: 'hidden' }}>

          <div style={{ display: 'flex', gap: 8, padding: 8 }}>
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                onClick={() => handleOpen(item.url)}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                onClick={() => handleOpen(item.url)}
                style={{ fontWeight: 'bold', fontSize: 12, color: '#5b9bd5', cursor: 'pointer', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: 11, color: '#666' }}>
                🌐 {item.domain} {item.duration && `· ⏱ ${item.duration}`}
              </div>
            </div>
            <button
              onClick={() => handleDelete(item.id!)}
              style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16, alignSelf: 'flex-start' }}
            >×</button>
          </div>

          {(item.watchProgress || 0) > 0 && (
            <div style={{ height: 3, background: '#333' }}>
              <div style={{ height: 3, background: '#5b9bd5', width: `${item.watchProgress}%` }} />
            </div>
          )}

          {(item.tags || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '4px 8px' }}>
              {(item.tags || []).map(tag => (
                <span
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  style={{ padding: '1px 6px', borderRadius: 10, background: '#0f1923', color: '#5b9bd5', fontSize: 10, cursor: 'pointer' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, padding: '4px 8px 8px' }}>
            {['⚡','🔁','✅','❤️'].map(badge => (
              <span
                key={badge}
                onClick={() => toggleBadge(item, badge)}
                style={{ fontSize: 14, cursor: 'pointer', opacity: (item.badges || []).includes(badge) ? 1 : 0.3 }}
              >
                {badge}
              </span>
            ))}
          </div>

        </div>
      ))}
    </div>
  )
}

export default App