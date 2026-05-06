import { useState, useEffect, useRef } from 'react'
import { db, getSettings } from './lib/db'

declare const chrome: any

interface Props {
  onClose: () => void
  pinHash: string | null
  onPinChange: (newHash: string | null) => void
  autoTagLevel: number
  onAutoTagChange: (level: number) => void
}

function hashPin(pin: string): string {
  let hash = 0
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i)
    hash |= 0
  }
  return hash.toString()
}

export function Settings({ onClose, pinHash, onPinChange, autoTagLevel, onAutoTagChange }: Props) {
  const [msg, setMsg] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [decoyType, setDecoyType] = useState('notes')
  const [theme, setTheme] = useState('dark')
  const [roastMode, setRoastMode] = useState(false)
  const [stats, setStats] = useState({ bookmarks: 0, playlists: 0, dead: 0 })
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings().then(s => {
      setDecoyType(s.decoyConfig?.type || 'notes')
      setTheme(s.theme || 'dark')
      setRoastMode(s.roastMode || false)
    })
    loadStats()
  }, [])

  const loadStats = async () => {
    const bookmarks = await db.bookmarks.count()
    const playlists = await db.playlists.count()
    const dead = await db.bookmarks.filter(b => b.lastChecked !== null && !b.isAlive).count()
    setStats({ bookmarks, playlists, dead })
  }

  const showMsg = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }

  const handleChangePin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showMsg('❌ PIN must be 4 digits')
      return
    }
    if (newPin !== confirmPin) {
      showMsg('❌ PINs do not match')
      return
    }
    const h = hashPin(newPin)
    await db.settings.update(1, { pinHash: h })
    onPinChange(h)
    setNewPin('')
    setConfirmPin('')
    showMsg('✅ PIN updated!')
  }

  const handleDisablePin = async () => {
    await db.settings.update(1, { pinHash: null })
    onPinChange(null)
    showMsg('✅ PIN disabled')
  }

  const handleAutoTagChange = async (level: number) => {
    onAutoTagChange(level)
    await db.settings.update(1, { autoTagLevel: level })
  }

  const handleDecoyChange = async (type: string) => {
    setDecoyType(type)
    await db.settings.update(1, {
      decoyConfig: { type: type as any, title: type === 'notes' ? 'Notes' : type === 'calculator' ? 'Calculator' : 'To Do', color: '#ffffff', content: '' }
    })
    showMsg('✅ Decoy updated')
  }

  const handleThemeChange = async (t: string) => {
    setTheme(t)
    await db.settings.update(1, { theme: t as any })
    showMsg('✅ Theme saved (restart popup)')
  }

  const handleRoastMode = async () => {
    const next = !roastMode
    setRoastMode(next)
    await db.settings.update(1, { roastMode: next })
    showMsg(next ? '😂 Roast Mode ON' : '🫥 Roast Mode OFF')
  }

  const handleExportJSON = async () => {
    const bookmarks = await db.bookmarks.toArray()
    const playlists = await db.playlists.toArray()
    const data = JSON.stringify({ bookmarks, playlists }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stashd-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    showMsg('✅ Exported JSON!')
  }

  const handleExportCSV = async () => {
    const bookmarks = await db.bookmarks.toArray()
    const rows = [
      ['Title', 'URL', 'Domain', 'Duration', 'Tags', 'Badges', 'Saved At'],
      ...bookmarks.map(b => [
        `"${(b.title || '').replace(/"/g, '""')}"`,
        b.url,
        b.domain,
        b.duration,
        (b.tags || []).join(';'),
        (b.badges || []).join(';'),
        new Date(b.savedAt).toLocaleDateString()
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stashd-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    showMsg('✅ Exported CSV!')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      if (data.bookmarks && Array.isArray(data.bookmarks)) {
        for (const b of data.bookmarks) {
          const { id, ...rest } = b
          await db.bookmarks.add({ ...rest, savedAt: rest.savedAt || Date.now() })
        }
        if (data.playlists && Array.isArray(data.playlists)) {
          for (const p of data.playlists) {
            const { id, ...rest } = p
            await db.playlists.add(rest)
          }
        }
        await loadStats()
        showMsg(`✅ Imported ${data.bookmarks.length} items!`)
      } else {
        showMsg('❌ Invalid file format')
      }
    } catch {
      showMsg('❌ Could not parse file')
    }
    e.target.value = ''
  }

  const handleClearLibrary = async () => {
    await db.bookmarks.clear()
    await db.playlists.clear()
    await db.queue.clear()
    await loadStats()
    setShowClearConfirm(false)
    showMsg('✅ Library cleared')
  }

  const handleClearDeadFlags = async () => {
    const items = await db.bookmarks.toArray()
    for (const item of items) {
      await db.bookmarks.update(item.id!, { isAlive: true, lastChecked: null })
    }
    await loadStats()
    showMsg('✅ Dead flags cleared')
  }

  const section = (title: string) => (
    <div style={{ fontSize: 9, color: '#444', fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 16, borderBottom: '1px solid #1a2533', paddingBottom: 4 }}>
      {title}
    </div>
  )

  const row = (label: string, content: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 11, color: '#aaa' }}>{label}</span>
      <div>{content}</div>
    </div>
  )

  return (
    <div style={{ width: 580, minHeight: 400, background: '#0f1923', color: '#fff', fontFamily: 'Arial', display: 'flex', flexDirection: 'column' }}>

      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a2533', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5b9bd5', cursor: 'pointer', fontSize: 18, padding: 0 }}>←</button>
        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#5b9bd5' }}>⚙️ Settings</span>
        {msg && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#4caf50' }}>{msg}</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>

        {section('ABOUT')}
        <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
          {[
            { label: 'Videos', value: stats.bookmarks },
            { label: 'Playlists', value: stats.playlists },
            { label: 'Dead Links', value: stats.dead },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: '#1a2533', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: '#5b9bd5' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#666' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#333', textAlign: 'right' }}>Stashd v0.1.0</div>

        {section('SECURITY')}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>{pinHash ? 'Change PIN' : 'Set PIN'}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New PIN"
              style={{ width: 80, padding: '4px 8px', background: '#1a2533', border: '1px solid #333', borderRadius: 4, color: '#fff', fontSize: 12 }} />
            <input type="password" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="Confirm"
              style={{ width: 80, padding: '4px 8px', background: '#1a2533', border: '1px solid #333', borderRadius: 4, color: '#fff', fontSize: 12 }} />
            <button onClick={handleChangePin} style={{ padding: '4px 12px', background: '#1F3A5F', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              {pinHash ? 'Update' : 'Set PIN'}
            </button>
            {pinHash && (
              <button onClick={handleDisablePin} style={{ padding: '4px 12px', background: 'none', color: '#c0392b', border: '1px solid #c0392b', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Disable
              </button>
            )}
          </div>
        </div>

        {section('TAGS')}
        {row('Auto-tag level', (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#5b9bd5', minWidth: 12 }}>{autoTagLevel}</span>
            <input type="range" min={0} max={10} value={autoTagLevel} onChange={e => handleAutoTagChange(Number(e.target.value))} style={{ width: 100 }} />
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#444', marginBottom: 8 }}>0 = no auto tags, 10 = up to 10 tags per save</div>

        {section('APPEARANCE')}
        {row('Theme', (
          <div style={{ display: 'flex', gap: 4 }}>
            {['dark', 'light', 'focus'].map(t => (
              <button key={t} onClick={() => handleThemeChange(t)}
                style={{ padding: '3px 8px', background: theme === t ? '#5b9bd5' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>
                {t}
              </button>
            ))}
          </div>
        ))}

        {section('PRIVACY')}
        {row('Decoy screen', (
          <div style={{ display: 'flex', gap: 4 }}>
            {['notes', 'calculator', 'todo'].map(t => (
              <button key={t} onClick={() => handleDecoyChange(t)}
                style={{ padding: '3px 8px', background: decoyType === t ? '#5b9bd5' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>
                {t}
              </button>
            ))}
          </div>
        ))}
        <div style={{ fontSize: 10, color: '#444', marginBottom: 8 }}>Press Ctrl+D to activate decoy screen</div>

        {section('ROAST MODE')}
        {row('Roast Mode 😂', (
          <button onClick={handleRoastMode}
            style={{ padding: '3px 12px', background: roastMode ? '#5b9bd5' : '#1a2533', color: '#fff', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>
            {roastMode ? 'ON' : 'OFF'}
          </button>
        ))}
        <div style={{ fontSize: 10, color: '#444', marginBottom: 8 }}>Adds humor to your library experience</div>

        {section('HEALTH CHECK')}
        {row('Dead link flags', (
          <button onClick={handleClearDeadFlags}
            style={{ padding: '3px 10px', background: 'none', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>
            Clear flags
          </button>
        ))}

        {section('DATA')}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={handleExportJSON} style={{ padding: '5px 12px', background: '#1F3A5F', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Export JSON</button>
          <button onClick={handleExportCSV} style={{ padding: '5px 12px', background: '#1F3A5F', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Export CSV</button>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '5px 12px', background: '#1a2533', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Import JSON</button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>

        {section('DANGER ZONE')}
        {!showClearConfirm ? (
          <button onClick={() => setShowClearConfirm(true)}
            style={{ padding: '5px 12px', background: 'none', color: '#c0392b', border: '1px solid #c0392b', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            Clear Entire Library
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#c0392b' }}>Are you sure? This cannot be undone.</span>
            <button onClick={handleClearLibrary} style={{ padding: '4px 10px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Yes, clear it</button>
            <button onClick={() => setShowClearConfirm(false)} style={{ padding: '4px 10px', background: 'none', color: '#aaa', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Cancel</button>
          </div>
        )}

      </div>
    </div>
  )
}