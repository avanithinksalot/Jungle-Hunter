import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'ghibli-tasks-v1'

function getStatus(dateStr, timeStr, done) {
  if (done) return 'done'
  if (!dateStr) return 'upcoming'
  const now = new Date()
  const due = new Date(`${dateStr}T${timeStr || '23:59'}:00`)
  const diffMs = due - now
  const diffDays = diffMs / 86400000
  if (diffMs < 0) return 'overdue'
  if (diffDays <= 2) return 'soon'
  return 'upcoming'
}

function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T${timeStr || '23:59'}:00`)
  const datePart = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!timeStr) return datePart
  const timePart = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${datePart} · ${timePart}`
}

const BADGE_LABEL = { upcoming: 'upcoming', soon: 'due soon', overdue: 'overdue', done: 'done' }

function TaskCard({ task, onToggle, onDelete }) {
  const [anim, setAnim] = useState('enter')
  const cardRef = useRef(null)
  const status = getStatus(task.date, task.time, task.done)

  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const onEnd = () => setAnim('')
    el.addEventListener('animationend', onEnd, { once: true })
    return () => el.removeEventListener('animationend', onEnd)
  }, [])

  function handleToggle() {
    if (task.done) { onToggle(task.id); return }
    setAnim('settling')
    setTimeout(() => onToggle(task.id), 500)
  }

  function handleDelete() {
    setAnim('falling')
    setTimeout(() => onDelete(task.id), 430)
  }

  const cardClass = ['task-card', task.done ? 'done' : status, anim].filter(Boolean).join(' ')

  return (
    <div className={cardClass} ref={cardRef}>
      <div className="card-inner">
        <button className="check-btn" onClick={handleToggle} title={task.done ? 'Mark undone' : 'Mark done'}>
          <svg className="check-icon" width="11" height="9" viewBox="0 0 11 9" fill="none">
            <path d="M1 4L4.5 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="task-body">
          <div className="task-title">{task.title}</div>
          <div className="task-meta">
            {task.date && <span className="task-date">{formatDateTime(task.date, task.time)}</span>}
            <span className={`badge badge-${task.done ? 'done' : status}`}>
              {BADGE_LABEL[task.done ? 'done' : status]}
            </span>
          </div>
        </div>

        <button className="delete-btn" onClick={handleDelete} title="Remove">✕</button>
      </div>
    </div>
  )
}

function scheduleNotification(task) {
  if (!task.date || Notification.permission !== 'granted') return
  const due = new Date(`${task.date}T${task.time || '23:59'}:00`)
  const remind = new Date(due.getTime() - 2 * 86400000)
  const delay = remind - Date.now()
  if (delay > 0 && delay < 7 * 86400000) {
    setTimeout(() => {
      new Notification('Forest reminder 🌿', { body: `"${task.title}" is due in 2 days.` })
    }, delay)
  }
}

export default function App() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const titleRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    if (notifPerm !== 'granted') return
    const now = new Date()
    for (const t of tasks) {
      if (t.done || !t.date) continue
      const due = new Date(`${t.date}T${t.time || '23:59'}:00`)
      const diffDays = (due - now) / 86400000
      if (diffDays >= 0 && diffDays <= 1) {
        new Notification('Forest reminder 🌿', {
          body: `"${t.title}" is due ${diffDays < 0.5 ? 'very soon' : 'tomorrow'}.`,
        })
      }
    }
  }, [])

  const addTask = useCallback(() => {
    const trimmed = title.trim()
    if (!trimmed) { titleRef.current?.focus(); return }
    const task = { id: crypto.randomUUID(), title: trimmed, date, time, done: false }
    setTasks(prev => [task, ...prev])
    setTitle('')
    setDate('')
    setTime('')
    scheduleNotification(task)
  }, [title, date, time])

  const toggleDone = useCallback((id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }, [])

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  async function requestNotifications() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  const active = tasks.filter(t => !t.done)
  const done   = tasks.filter(t => t.done)

  return (
    <>
      <svg style={{position:'absolute',width:0,height:0,overflow:'hidden'}} aria-hidden="true">
        <defs>
          <filter id="wavy-card" x="-4%" y="-8%" width="108%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.02" numOctaves="2" seed="9" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>
      <header className="header">
        <h1>Jungle Hunter</h1>
        <p>hunt your prey in the canopy</p>
      </header>

      <div className="add-form">
        <label className="form-label" htmlFor="task-title">What needs doing?</label>
        <input
          id="task-title"
          ref={titleRef}
          className="form-input"
          type="text"
          placeholder="e.g. Gather morning mushrooms…"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          autoComplete="off"
        />
        <div className="form-row">
          <div className="date-wrap">
            <label className="form-label" htmlFor="task-date">Date</label>
            <input
              id="task-date"
              className="form-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="time-wrap">
            <label className="form-label" htmlFor="task-time">Time</label>
            <input
              id="task-time"
              className="form-input"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
          </div>
          <button className="btn-add" onClick={addTask}>Add</button>
        </div>
        <button
          className={`notif-btn${notifPerm === 'granted' ? ' granted' : ''}`}
          onClick={requestNotifications}
        >
          {notifPerm === 'granted'
            ? '✦ reminders are awake'
            : '✦ allow gentle reminders when a deadline is near'}
        </button>
      </div>

      {tasks.length === 0 && (
        <div className="empty-state">
          <span>🍃</span>
          The forest is still. Add a task above.
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="section-label">in the thicket</div>
          <div className="task-list">
            {active.map(t => (
              <TaskCard key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} />
            ))}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="section-label">returned to earth</div>
          <div className="task-list">
            {done.map(t => (
              <TaskCard key={t.id} task={t} onToggle={toggleDone} onDelete={deleteTask} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
