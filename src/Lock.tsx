import { useState } from 'react'

interface Props {
  onUnlock: (pin: string) => boolean
  onSetPin: (pin: string) => void
  hasPin: boolean
}

export function Lock({ onUnlock, onSetPin, hasPin }: Props) {
  const [input, setInput] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'enter' | 'set' | 'confirm'>(!hasPin ? 'set' : 'enter')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
    setInput('')
    setError('Wrong PIN. Try again.')
  }

  const handleDigit = (d: string) => {
    if (step === 'enter') {
      const next = input + d
      setInput(next)
      if (next.length === 4) {
        const success = onUnlock(next)
        if (!success) triggerShake()
      }
    } else if (step === 'set') {
      const next = input + d
      setInput(next)
      if (next.length === 4) {
        setStep('confirm')
        setConfirm('')
      }
    } else if (step === 'confirm') {
      const next = confirm + d
      setConfirm(next)
      if (next.length === 4) {
        if (next === input) {
          onSetPin(input)
        } else {
          setError('PINs do not match. Try again.')
          setInput('')
          setConfirm('')
          setStep('set')
        }
      }
    }
  }

  const handleBack = () => {
    if (step === 'enter') setInput(input.slice(0, -1))
    else if (step === 'set') setInput(input.slice(0, -1))
    else if (step === 'confirm') setConfirm(confirm.slice(0, -1))
  }

  const currentInput = step === 'confirm' ? confirm : input

  const dots = [0,1,2,3].map(i => (
    <div key={i} style={{
      width: 12, height: 12, borderRadius: '50%',
      background: i < currentInput.length ? '#5b9bd5' : '#1a2533',
      border: '2px solid #5b9bd5'
    }} />
  ))

  return (
    <div style={{
      width: 580, height: 400, background: '#0f1923', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Arial', color: '#fff', gap: 20
    }}>
      <div style={{ fontSize: 18, fontWeight: 'bold', color: '#5b9bd5' }}>📁 Stashd</div>

      <div style={{ fontSize: 13, color: '#aaa' }}>
        {step === 'enter' && 'Enter your PIN'}
        {step === 'set' && 'Set a new PIN'}
        {step === 'confirm' && 'Confirm your PIN'}
      </div>

      <div style={{
        display: 'flex', gap: 12,
        transform: shake ? 'translateX(10px)' : 'none',
        transition: 'transform 0.1s'
      }}>
        {dots}
      </div>

      {error && <div style={{ fontSize: 11, color: '#e74c3c' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 60px)', gap: 10 }}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button
            key={i}
            onClick={() => d === '⌫' ? handleBack() : d !== '' && handleDigit(d)}
            style={{
              width: 60, height: 50, borderRadius: 8,
              background: d === '' ? 'transparent' : '#1a2533',
              color: '#fff', border: d === '' ? 'none' : '1px solid #333',
              fontSize: 18, cursor: d === '' ? 'default' : 'pointer',
              fontFamily: 'Arial'
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {step === 'enter' && (
        <div
          onClick={() => { setStep('set'); setInput(''); setError('') }}
          style={{ fontSize: 11, color: '#444', cursor: 'pointer', marginTop: 4 }}
        >
          Forgot PIN? Reset
        </div>
      )}
    </div>
  )
}