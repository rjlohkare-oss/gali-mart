// app/api/places/route.js
// Google Maps Places Autocomplete — backend se call karo (key secure rahega)
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get('input')

  if (!input) return NextResponse.json({ predictions: [] })

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(input)}` +
    `&components=country:in` +
    `&location=21.1458,79.0882` +   // Nagpur center
    `&radius=30000` +                // 30km radius around Nagpur
    `&key=${process.env.GOOGLE_MAPS_KEY}`

  const res  = await fetch(url)
  const data = await res.json()

  return NextResponse.json({ predictions: data.predictions ?? [] })
}
