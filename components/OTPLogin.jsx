'use client'
// components/OTPLogin.jsx
// Firebase Phone Auth — 10,000 OTP/month FREE!
import { useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'

export default function OTPLogin({ role = 'customer', onSuccess }) {
  const [phone,          setPhone]          = useState('')
  const [otp,            setOtp]            = useState('')
  const [step,           setStep]           = useState('phone')   // 'phone' | 'otp'
  const [loading,        setLoading]        = useState(false)
  const [confirmation,   setConfirmation]   = useState(null)
  const [resendTimer,    setResendTimer]    = useState(0)

  // ─── SEND OTP ───
  const sendOTP = async () => {
    if (phone.length !== 10) {
      alert('Please enter a valid 10-digit number')
      return
    }
    setLoading(true)

    try {
      // Invisible reCAPTCHA setup
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          'recaptcha-container',
          { size: 'invisible' }
        )
      }

      const result = await signInWithPhoneNumber(
        auth,
        `+91${phone}`,
        window.recaptchaVerifier
      )
      setConfirmation(result)
      setStep('otp')
      startResendTimer()
    } catch (err) {
      alert('Failed to send OTP: ' + err.message)
      window.recaptchaVerifier = null
    } finally {
      setLoading(false)
    }
  }

  // ─── VERIFY OTP ───
  const verifyOTP = async () => {
    if (otp.length !== 6) { alert('Enter 6-digit OTP'); return }
    setLoading(true)

    try {
      const credential = await confirmation.confirm(otp)
      const user = credential.user

      // User ko Firestore mein save karo (pehli baar)
      const userRef  = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid:       user.uid,
          phone:     `+91${phone}`,
          role,
          name:      '',
          createdAt: serverTimestamp(),
        })
      }

      const userData = { uid: user.uid, phone: `+91${phone}`, role }
      onSuccess(userData)
    } catch (err) {
      alert('Wrong OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── RESEND TIMER ───
  const startResendTimer = () => {
    setResendTimer(30)
    const iv = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(iv); return 0 }
        return t - 1
      })
    }, 1000)
  }

  const resendOTP = () => {
    setStep('phone')
    setOtp('')
    setConfirmation(null)
    window.recaptchaVerifier = null
  }

  return (
    <div className="otp-login">
      <div className="login-logo">🛒</div>
      <h2>Welcome to Gali Mart!</h2>
      <p>Login with your mobile number</p>

      {/* ROLE BADGE */}
      <div className="role-badge">
        {role === 'customer'  ? '🛍️ Customer'
         : role === 'shopowner' ? '🏪 Shop Owner'
         : '🛵 Delivery Partner'}
      </div>

      {step === 'phone' ? (
        <div className="phone-step">
          <div className="phone-row">
            <span className="cc">+91</span>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              maxLength={10}
              className="phone-input"
              onKeyDown={e => e.key === 'Enter' && sendOTP()}
            />
          </div>
          <button onClick={sendOTP} disabled={loading} className="send-otp-btn">
            {loading ? 'Sending...' : 'Get OTP →'}
          </button>
          <p className="terms">
            By continuing, you agree to our Terms & Privacy Policy
          </p>
        </div>
      ) : (
        <div className="otp-step">
          <p>OTP sent to <strong>+91 {phone}</strong></p>

          {/* 4 OTP boxes */}
          <div className="otp-boxes">
            {[0,1,2,3,4,5].map(i => (
              <input
                key={i}
                id={`otp-${i}`}
                type="tel"
                maxLength={1}
                className="otp-box"
                value={otp[i] ?? ''}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g,'')
                  const arr = otp.split('')
                  arr[i] = val
                  setOtp(arr.join('').slice(0, 6))
                  if (val && i < 5) document.getElementById(`otp-${i+1}`)?.focus()
                }}
                onKeyDown={e => {
                  if (e.key === 'Backspace' && !otp[i] && i > 0)
                    document.getElementById(`otp-${i-1}`)?.focus()
                }}
              />
            ))}
          </div>

          <button onClick={verifyOTP} disabled={loading} className="verify-btn">
            {loading ? 'Verifying...' : 'Verify & Login ✅'}
          </button>

          <div className="resend-row">
            {resendTimer > 0
              ? `Resend OTP in ${resendTimer}s`
              : <span onClick={resendOTP} className="resend-link">Resend OTP</span>
            }
          </div>

          <button onClick={() => setStep('phone')} className="back-btn">
            ← Change Number
          </button>
        </div>
      )}

      {/* Invisible reCAPTCHA */}
      <div id="recaptcha-container" />
    </div>
  )
}
