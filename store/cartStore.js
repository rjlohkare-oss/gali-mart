// store/cartStore.js
// Zustand se cart manage karo — localStorage mein auto-save hoga
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ✅ Valid coupons — yahan aur add kar sakte ho
const COUPONS = {
  'GALI10':   { type: 'percent', value: 10,  label: '10% OFF',  minOrder: 0   },
  'FIRST100': { type: 'flat',    value: 100, label: '₹100 OFF', minOrder: 200 },
  'GM50':     { type: 'flat',    value: 50,  label: '₹50 OFF',  minOrder: 150 },
  'SAVE20':   { type: 'percent', value: 20,  label: '20% OFF',  minOrder: 300 },
  'NAGPUR15': { type: 'percent', value: 15,  label: '15% OFF',  minOrder: 0   },
}

const DELIVERY_CHARGE = 0  // FREE delivery
const PLATFORM_FEE   = 0  // No platform fee

const useCartStore = create(
  persist(
    (set, get) => ({
      items:    [],
      coupon:   null,
      discount: 0,

      // ─────────────────────────────────────────
      // 1. ITEM ADD KARO
      // ─────────────────────────────────────────
      addItem: (product) => {
        const { items } = get()
        const existing = items.find(i => i.id === product.id)

        if (existing) {
          // Already hai — qty badhao
          set({
            items: items.map(i =>
              i.id === product.id ? { ...i, qty: i.qty + 1 } : i
            )
          })
        } else {
          // Naya item add karo
          set({ items: [...items, { ...product, qty: 1 }] })
        }
      },

      // ─────────────────────────────────────────
      // 2. ITEM REMOVE KARO
      // ─────────────────────────────────────────
      removeItem: (productId) => {
        set({ items: get().items.filter(i => i.id !== productId) })
      },

      // ─────────────────────────────────────────
      // 3. QUANTITY UPDATE KARO
      // ─────────────────────────────────────────
      updateQty: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId)
          return
        }
        set({
          items: get().items.map(i =>
            i.id === productId ? { ...i, qty } : i
          )
        })
      },

      // ─────────────────────────────────────────
      // 4. COUPON APPLY KARO (GALI10 works!)
      // ─────────────────────────────────────────
      applyCoupon: (code) => {
        const clean  = code.trim().toUpperCase()
        const coupon = COUPONS[clean]

        if (!coupon) {
          return { success: false, message: '❌ Invalid coupon code' }
        }

        const subtotal = get().getSubtotal()

        if (subtotal < coupon.minOrder) {
          return {
            success: false,
            message: `❌ Minimum order ₹${coupon.minOrder} required for this coupon`
          }
        }

        let discount = 0
        if (coupon.type === 'percent') {
          discount = Math.round(subtotal * coupon.value / 100)
        } else {
          discount = Math.min(coupon.value, subtotal)
        }

        set({ coupon: { ...coupon, code: clean }, discount })
        return {
          success:  true,
          message:  `✅ ${coupon.label} applied! You saved ₹${discount}`,
          discount,
        }
      },

      // ─────────────────────────────────────────
      // 5. COUPON REMOVE KARO
      // ─────────────────────────────────────────
      removeCoupon: () => set({ coupon: null, discount: 0 }),

      // ─────────────────────────────────────────
      // 6. CART CLEAR KARO (order place hone ke baad)
      // ─────────────────────────────────────────
      clearCart: () => set({ items: [], coupon: null, discount: 0 }),

      // ─────────────────────────────────────────
      // COMPUTED VALUES
      // ─────────────────────────────────────────
      getSubtotal:  () => get().items.reduce((s, i) => s + i.price * i.qty, 0),
      getTotal:     () => Math.max(0, get().getSubtotal() - get().discount + DELIVERY_CHARGE + PLATFORM_FEE),
      getItemCount: () => get().items.reduce((s, i) => s + i.qty, 0),
      getDelivery:  () => DELIVERY_CHARGE,
    }),
    { name: 'gali-mart-cart' }   // localStorage key
  )
)

export default useCartStore
