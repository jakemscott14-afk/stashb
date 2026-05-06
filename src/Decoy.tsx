interface Props {
  onExit: () => void
}

export function Decoy({ onExit }: Props) {
  return (
    <div
      style={{
        width: 580, minHeight: 400, background: '#fff',
        fontFamily: 'Arial', display: 'flex', flexDirection: 'column'
      }}
      onKeyDown={e => e.ctrlKey && e.key === 'd' && onExit()}
      tabIndex={0}
    >
      {/* Fake notes app header */}
      <div style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>📝 Notes</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button style={{ padding: '3px 10px', background: '#fff', border: '1px solid #ddd', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#333' }}>New</button>
          <button style={{ padding: '3px 10px', background: '#007aff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: '#fff' }}>Save</button>
        </div>
      </div>

      {/* Fake sidebar + content */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* Sidebar */}
        <div style={{ width: 140, borderRight: '1px solid #eee', background: '#fafafa', padding: 8 }}>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 6, fontWeight: 'bold', letterSpacing: 1 }}>NOTES</div>
          {[
            { title: 'Shopping list', date: 'Today' },
            { title: 'Meeting notes', date: 'Yesterday' },
            { title: 'Ideas', date: 'Mon' },
            { title: 'Passwords', date: 'Last week' },
            { title: 'Books to read', date: 'Mar 12' },
          ].map((note, i) => (
            <div
              key={i}
              style={{
                padding: '6px 8px', borderRadius: 4, marginBottom: 2, cursor: 'pointer',
                background: i === 0 ? '#e8f0fe' : 'transparent'
              }}
            >
              <div style={{ fontSize: 11, fontWeight: i === 0 ? 'bold' : 'normal', color: '#333' }}>{note.title}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{note.date}</div>
            </div>
          ))}
        </div>

        {/* Note content */}
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 }}>Shopping list</div>
          <textarea
            defaultValue={`- Milk\n- Eggs\n- Bread\n- Butter\n- Coffee\n- Orange juice\n- Chicken\n- Rice\n- Pasta\n- Tomatoes`}
            style={{
              width: '100%', height: 240, border: 'none', outline: 'none',
              fontSize: 13, color: '#444', resize: 'none', background: 'transparent',
              fontFamily: 'Arial', lineHeight: 1.6
            }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background: '#f5f5f5', borderTop: '1px solid #ddd', padding: '4px 12px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#aaa' }}>10 items</span>
        <span style={{ fontSize: 10, color: '#aaa' }}>Last saved: just now</span>
      </div>
    </div>
  )
}