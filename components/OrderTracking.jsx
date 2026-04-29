'use client'
// components/OrderTracking.jsx
// Real-time order tracking — Firebase se auto-update hoga!
import { useEffect, useState } from 'react'
import { listenOrder } from '@/lib/orders'

// ─── ORDER STAGES ───
const STAGES = [
  {
    key:   'Placed',
    icon:  '📋',
    label: 'Order Placed',
    sub:   'We have received your order',
    color: '#58A6FF',
  },
  {
    key:   'Accepted',
    icon:  '✅',
    label: 'Shop Accepted',
    sub:   'Shop is preparing your order',
    color: '#3FB950',
  },
  {
    key:   'Packed',
    icon:  '📦',
    label: 'Order Packed',
    sub:   'Waiting for delivery partner',
    color: '#D29922',
  },
  {
    key:   'Out',
    icon:  '🛵',
    label: 'Out for Delivery',
    sub:   'Delivery partner is on the way!',
    color: '#FF6B35',
  },
  {
    key:   'Delivered',
    icon:  '🏠',
    label: 'Delivered!',
    sub:   'Enjoy your order 😊',
    color: '#06D6A0',
  },
]

export default function OrderTracking({ orderId }) {
  const [order,      setOrder]      = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [elapsed,    setElapsed]    = useState(0)   // seconds since placed

  // ─── REAL-TIME FIREBASE LISTENER ───
  useEffect(() => {
    if (!orderId) return
    const unsub = listenOrder(orderId, (data) => {
      setOrder(data)
      const idx = STAGES.findIndex(s => s.key === data.status)
      setCurrentIdx(idx >= 0 ? idx : 0)
    })
    return () => unsub()   // cleanup on unmount
  }, [orderId])

  // ─── ELAPSED TIMER ───
  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const fmtTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ─── PROGRESS % ───
  const progress = STAGES.length > 1
    ? (currentIdx / (STAGES.length - 1)) * 100
    : 0

  if (!order) {
    return (
      <div className="tracking-loading">
        <div className="spinner" />
        <p>Loading order details...</p>
      </div>
    )
  }

  const currentStage = STAGES[currentIdx]

  return (
    <div className="tracking-container">

      {/* ── HEADER ── */}
      <div className="tracking-header">
        <div className="order-id">Order #{orderId.slice(-6).toUpperCase()}</div>
        <div className="order-shop">{order.shopName}</div>
        <div className="order-timer">⏱ {fmtTime(elapsed)}</div>
      </div>

      {/* ── CURRENT STATUS BIG DISPLAY ── */}
      <div
        className="current-status-card"
        style={{ borderColor: currentStage.color }}
      >
        <div className="cs-icon">{currentStage.icon}</div>
        <div>
          <div className="cs-label" style={{ color: currentStage.color }}>
            {currentStage.label}
          </div>
          <div className="cs-sub">{currentStage.sub}</div>
          {order.status === 'Out' && order.eta && (
            <div className="cs-eta">
              🕐 ETA: ~{order.eta} minutes away
            </div>
          )}
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="progress-section">
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{
              width:      `${progress}%`,
              background: `linear-gradient(90deg, #FF3B3B, ${currentStage.color})`,
              transition: 'width 1s ease',
            }}
          />
        </div>
        <div className="progress-label">
          {Math.round(progress)}% complete
        </div>
      </div>

      {/* ── STAGE STEPS ── */}
      <div className="stages-list">
        {STAGES.map((stage, idx) => {
          const isDone   = idx <= currentIdx
          const isActive = idx === currentIdx
          const isFuture = idx >  currentIdx

          return (
            <div key={stage.key} className={`stage-row ${isActive ? 'active' : ''}`}>
              {/* Connector line */}
              {idx < STAGES.length - 1 && (
                <div
                  className="connector"
                  style={{ background: isDone && !isActive ? stage.color : '#30363D' }}
                />
              )}

              {/* Dot */}
              <div
                className="stage-dot"
                style={{
                  background: isDone ? stage.color : '#21262D',
                  border:     `2px solid ${isDone ? stage.color : '#30363D'}`,
                  animation:  isActive ? 'pulse 1.5s ease infinite' : 'none',
                }}
              >
                {isDone ? (isActive ? stage.icon : '✓') : '○'}
              </div>

              {/* Text */}
              <div className="stage-text">
                <div
                  className="stage-label"
                  style={{
                    color:      isActive ? stage.color : isDone ? '#C9D1D9' : '#7D8590',
                    fontWeight: isActive ? 800 : 600,
                  }}
                >
                  {stage.label}
                </div>
                <div className="stage-sub" style={{ color: isFuture ? '#30363D' : '#7D8590' }}>
                  {stage.sub}
                </div>
              </div>

              {/* Timestamp if done */}
              {isDone && order.timeline?.[stage.key] && (
                <div className="stage-time">
                  {new Date(
                    order.timeline[stage.key].seconds * 1000
                  ).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── CALL BUTTONS ── */}
      {(order.deliveryBoyPhone || order.shopPhone) && (
        <div className="call-section">
          {order.deliveryBoyPhone && order.status === 'Out' && (
            <a href={`tel:${order.deliveryBoyPhone}`} className="call-btn delivery">
              📞 Call {order.deliveryBoyName || 'Delivery Boy'}
            </a>
          )}
          {order.shopPhone && (
            <a href={`tel:${order.shopPhone}`} className="call-btn shop">
              📞 Call Shop
            </a>
          )}
        </div>
      )}

      {/* ── ORDER SUMMARY ── */}
      <div className="order-summary">
        <div className="os-title">Order Summary</div>
        {order.items?.map((item, i) => (
          <div key={i} className="os-item">
            <span>{item.name} × {item.qty}</span>
            <span>₹{item.price * item.qty}</span>
          </div>
        ))}
        <div className="os-divider" />
        <div className="os-total">
          <strong>Total</strong>
          <strong>₹{order.total}</strong>
        </div>
        <div className="os-payment">
          Payment: {order.paymentMethod === 'cod' ? '💵 Cash on Delivery'
                  : order.paymentMethod === 'upi_qr' ? '📱 UPI QR (Paid)'
                  : '💳 Online (Paid)'}
        </div>
      </div>

    </div>
  )
}
