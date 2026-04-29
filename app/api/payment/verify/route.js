 // app/api/payment/verify/route.js
// Backend API — Razorpay payment verify karo + Firebase update karo
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { savePaymentInfo } from '@/orders'

export async function POST(request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      firestoreOrderId,
    } = await request.json()

    // ─── SIGNATURE VERIFY KARO (security ke liye ZAROORI hai) ───
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      console.error('Payment signature mismatch!')
      return NextResponse.json(
        { success: false, error: 'Payment verification failed' },
        { status: 400 }
      )
    }

    // ─── PAYMENT VERIFIED — FIREBASE MEIN SAVE KARO ───
    await createOrder(firestoreOrderId, {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    })

    return NextResponse.json({
      success: true,
      message: 'Payment verified! Order is being prepared.',
      orderId: firestoreOrderId,
    })
  } catch (err) {
    console.error('Payment verify error:', err)
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
