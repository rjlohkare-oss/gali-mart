// lib/orders.js
// Saare order-related Firebase functions yahan hain
import { db } from './firebase'
import {
  collection, addDoc, doc, updateDoc, getDoc,
  serverTimestamp, onSnapshot, query,
  where, orderBy, limit
} from 'firebase/firestore'

// ─────────────────────────────────────────────────
// 1. NAYA ORDER BANAO (payment ke baad call karo)
// ─────────────────────────────────────────────────
export async function createOrder({
  customer,       // { uid, name, phone, address, lat, lng }
  shop,           // { id, name, phone, upiId }
  items,          // cart items array
  subtotal,
  discount,
  total,
  paymentMethod,  // 'razorpay' | 'upi_qr' | 'cod'
  couponCode,
}) {
  const orderRef = await addDoc(collection(db, 'orders'), {
    // Customer info
    customerId:      customer.uid,
    customerName:    customer.name,
    customerPhone:   customer.phone,
    customerAddress: customer.address,
    customerLat:     customer.lat ?? null,
    customerLng:     customer.lng ?? null,

    // Shop info
    shopId:    shop.id,
    shopName:  shop.name,
    shopPhone: shop.phone,
    shopUpiId: shop.upiId ?? null,

    // Items
    items,

    // Pricing
    subtotal,
    discount:  discount ?? 0,
    delivery:  0,
    total,
    couponCode: couponCode ?? null,

    // Payment
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',

    // Status — starts at 'Placed'
    status: 'Placed',
    timeline: { Placed: serverTimestamp() },

    // Delivery boy (assigned later by shop)
    deliveryBoyId:    null,
    deliveryBoyName:  null,
    deliveryBoyPhone: null,
    eta:              null,   // minutes

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return orderRef.id
}

// ─────────────────────────────────────────────────
// 2. ORDER STATUS UPDATE KARO
//    status: 'Placed' | 'Accepted' | 'Packed' | 'Out' | 'Delivered'
// ─────────────────────────────────────────────────
export async function updateOrderStatus(orderId, status, extra = {}) {
  await updateDoc(doc(db, 'orders', orderId), {
    status,
    [`timeline.${status}`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  })
}

// ─────────────────────────────────────────────────
// 3. PAYMENT INFO SAVE KARO (Razorpay verify hone ke baad)
// ─────────────────────────────────────────────────
export async function savePaymentInfo(orderId, paymentData) {
  await updateDoc(doc(db, 'orders', orderId), {
    paymentStatus: 'paid',
    payment: {
      razorpayOrderId:   paymentData.razorpay_order_id,
      razorpayPaymentId: paymentData.razorpay_payment_id,
      razorpaySignature: paymentData.razorpay_signature,
      paidAt: serverTimestamp(),
    },
    status: 'Accepted',
    [`timeline.Accepted`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

// ─────────────────────────────────────────────────
// 4. REAL-TIME — CUSTOMER KA ORDER TRACK KARO
// ─────────────────────────────────────────────────
export function listenOrder(orderId, callback) {
  return onSnapshot(doc(db, 'orders', orderId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() })
  })
}

// ─────────────────────────────────────────────────
// 5. REAL-TIME — SHOP KE ACTIVE ORDERS
// ─────────────────────────────────────────────────
export function listenShopOrders(shopId, callback) {
  const q = query(
    collection(db, 'orders'),
    where('shopId', '==', shopId),
    where('status', 'in', ['Placed', 'Accepted', 'Packed', 'Out']),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ─────────────────────────────────────────────────
// 6. REAL-TIME — DELIVERY BOY KE ORDERS
// ─────────────────────────────────────────────────
export function listenDeliveryOrders(deliveryBoyId, callback) {
  const q = query(
    collection(db, 'orders'),
    where('deliveryBoyId', '==', deliveryBoyId),
    where('status', '==', 'Out'),
    orderBy('createdAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

// ─────────────────────────────────────────────────
// 7. DELIVERY BOY ASSIGN KARO
// ─────────────────────────────────────────────────
export async function assignDeliveryBoy(orderId, boy) {
  await updateOrderStatus(orderId, 'Out', {
    deliveryBoyId:    boy.id,
    deliveryBoyName:  boy.name,
    deliveryBoyPhone: boy.phone,
    eta:              boy.eta ?? 15,
  })
}
