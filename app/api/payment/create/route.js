// app/api/payment/create/route.js
// Backend API — Razorpay order create karo
import Razorpay from 'razorpay'
import { NextResponse } from 'next/server'

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
})

export async function POST(request) {
  try {
    const { amount, firestoreOrderId, customerName, customerPhone } =
      await request.json()

    if (!amount || amount < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Razorpay order create karo (amount in PAISE — ₹1 = 100 paise)
    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `galimart_${firestoreOrderId}`,
      notes: {
        firestoreOrderId,
        customerName,
        customerPhone,
        app: 'Gali Mart Nagpur',
      },
    })

    return NextResponse.json({
      success:    true,
      rzpOrderId: order.id,
      amount:     order.amount,
      currency:   order.currency,
      key:        process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('Razorpay order create error:', err)
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
