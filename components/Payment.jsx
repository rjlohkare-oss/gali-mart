'use client'
// components/Payment.jsx
// Razorpay + QR Code + COD — teen options ek component mein
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode.react'
import useCartStore from '@/store/cartStore'
import { createOrder } from '@/lib/orders'
import toast from 'react-hot-toast'

// ─── QR PAYMENT COMPONENT ───
function QRPayment({ shop, amount, onPaid }) {
  const [confirming, setConfirming] = useState(false)

  // UPI deep-link — ek click mein PhonePe/GPay/Paytm khulega
  const upiString =
    `upi://pay?pa=${shop.upiId}` +
    `&pn=${encodeURIComponent(shop.name)}` +
    `&am=${amount}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent('Gali Mart Order')}`

  const handleConfirm = async () => {
    setConfirming(true)
    await onPaid('upi_qr')  // parent ko batao
    setConfirming(false)
  }

  return (
    <div className="qr-payment">
      <h3>Scan & Pay ₹{amount}</h3>
      <p className="shop-name">to <strong>{shop.name}</strong></p>

      {/* QR CODE */}
      <div className="qr-box">
        <QRCode
          value={upiString}
          size={200}
          level="H"
          includeMargin
          fgColor="#1A1A2E"
          imageSettings={{
            src: '/logo.png',
            height: 36,
            width: 36,
            excavate: true,
          }}
        />
      </div>

      {/* DIRECT APP BUTTONS */}
      <div className="upi-apps">
        <a href={`phonepe://pay?pa=${shop.upiId}&pn=${shop.name}&am=${amount}&cu=INR`}
           className="upi-btn phonepe">
          💜 PhonePe
        </a>
        <a href={`tez://upi/pay?pa=${shop.upiId}&pn=${shop.name}&am=${amount}&cu=INR`}
           className="upi-btn gpay">
          🟢 Google Pay
        </a>
        <a href={`paytmmp://pay?pa=${shop.upiId}&pn=${shop.name}&am=${amount}&cu=INR`}
           className="upi-btn paytm">
          🔵 Paytm
        </a>
      </div>

      <p className="upi-id-label">UPI ID: <strong>{shop.upiId}</strong></p>

      {/* 0% COMMISSION BADGE */}
      <div className="zero-commission">
        ✅ Zero commission — 100% goes to shop!
      </div>

      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="paid-confirm-btn"
      >
        {confirming ? 'Placing order...' : "I've Paid ✅"}
      </button>
    </div>
  )
}

// ─── MAIN PAYMENT COMPONENT ───
export default function Payment({ customer, shop }) {
  const router   = useRouter()
  const { items, getTotal, getSubtotal, discount, coupon, clearCart } = useCartStore()
  const [method, setMethod] = useState('phonepe')  // phonepe | gpay | cod | qr
  const [loading, setLoading] = useState(false)
  const total = getTotal()

  // ─────────────────────────────────────────────────
  // RAZORPAY FLOW (PhonePe / GPay / Card)
  // ─────────────────────────────────────────────────
  const handleRazorpay = async () => {
    setLoading(true)
    try {
      // Step 1: Firebase mein order banao (status = Placed, payment = pending)
      const firestoreOrderId = await createOrder({
        customer,
        shop,
        items,
        subtotal:      getSubtotal(),
        discount,
        total,
        paymentMethod: method,
        couponCode:    coupon?.code ?? null,
      })

      // Step 2: Backend se Razorpay order ID lo
      const res  = await fetch('/api/payment/create', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total,
          firestoreOrderId,
          customerName:  customer.name,
          customerPhone: customer.phone,
        }),
      })
      const { rzpOrderId, key } = await res.json()

      // Step 3: Razorpay checkout open karo
      const options = {
        key,
        amount:   total * 100,
        currency: 'INR',
        name:     'Gali Mart',
        description: `Order from ${shop.name}`,
        image:    '/logo.png',
        order_id: rzpOrderId,
        prefill: {
          name:    customer.name,
          contact: customer.phone,
        },
        theme: { color: '#FF3B3B' },
        // User ko preferred method dikhao
        config: {
          display: {
            preferences: {
              show_default_blocks: false,
            },
            blocks: {
              utib: {
                name:       method === 'phonepe' ? 'PhonePe' : 'Google Pay',
                instruments: [{ method: 'upi', flows: ['collect'] }],
              },
            },
            sequence: ['block.utib'],
          },
        },

        // ─── PAYMENT SUCCESS ───
        handler: async (response) => {
          const verifyRes = await fetch('/api/payment/verify', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...response,
              firestoreOrderId,
            }),
          })
          const result = await verifyRes.json()

          if (result.success) {
            clearCart()
            toast.success('🎉 Order placed! Track it now.')
            router.push(`/track/${firestoreOrderId}`)
          } else {
            toast.error('Payment verification failed. Contact support.')
          }
        },

        modal: {
          ondismiss: () => {
            toast.error('Payment cancelled')
            setLoading(false)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      toast.error('Something went wrong: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────
  // COD FLOW
  // ─────────────────────────────────────────────────
  const handleCOD = async () => {
    setLoading(true)
    try {
      const orderId = await createOrder({
        customer,
        shop,
        items,
        subtotal:      getSubtotal(),
        discount,
        total,
        paymentMethod: 'cod',
        couponCode:    coupon?.code ?? null,
      })
      clearCart()
      toast.success('Order placed! Pay on delivery 💵')
      router.push(`/track/${orderId}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────
  // QR CODE FLOW (zero commission)
  // ─────────────────────────────────────────────────
  const handleQRPaid = async () => {
    const orderId = await createOrder({
      customer,
      shop,
      items,
      subtotal:      getSubtotal(),
      discount,
      total,
      paymentMethod: 'upi_qr',
      couponCode:    coupon?.code ?? null,
    })
    clearCart()
    router.push(`/track/${orderId}`)
  }

  // ─────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────
  return (
    <div className="payment-container">
      <h2>Payment</h2>
      <div className="amount-display">Total: <strong>₹{total}</strong></div>

      {/* METHOD PICKER */}
      <div className="method-grid">
        {[
          { id: 'phonepe', icon: '💜', label: 'PhonePe' },
          { id: 'gpay',    icon: '🟢', label: 'Google Pay' },
          { id: 'qr',      icon: '📱', label: 'QR (0% fee)' },
          { id: 'cod',     icon: '💵', label: 'Cash on Delivery' },
        ].map(m => (
          <div
            key={m.id}
            className={`method-card ${method === m.id ? 'selected' : ''}`}
            onClick={() => setMethod(m.id)}
          >
            <span className="method-icon">{m.icon}</span>
            <span className="method-label">{m.label}</span>
            {method === m.id && <span className="check">✓</span>}
          </div>
        ))}
      </div>

      {/* QR VIEW */}
      {method === 'qr' && (
        <QRPayment shop={shop} amount={total} onPaid={handleQRPaid} />
      )}

      {/* PAY BUTTON */}
      {method !== 'qr' && (
        <button
          className="pay-btn"
          onClick={method === 'cod' ? handleCOD : handleRazorpay}
          disabled={loading}
          style={{
            background: method === 'cod'
              ? 'linear-gradient(135deg,#06D6A0,#00C9A7)'
              : method === 'phonepe'
              ? 'linear-gradient(135deg,#5F259F,#7B2FBE)'
              : 'linear-gradient(135deg,#4285F4,#34A853)',
          }}
        >
          {loading ? 'Processing...' : (
            method === 'cod' ? 'Place Order (Pay on Delivery) 💵'
            : method === 'phonepe' ? 'Pay with PhonePe 💜'
            : 'Pay with Google Pay 🟢'
          )}
        </button>
      )}

      <p className="secure-note">🔒 100% Secure · Powered by Razorpay</p>
    </div>
  )
}
