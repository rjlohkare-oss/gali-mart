'use client'
// components/Location.jsx
// Customer address save karo — GPS + Google Maps autocomplete
import { useState, useEffect, useRef } from 'react'

export default function LocationPicker({ onLocationSelected, savedAddresses = [] }) {
  const [mode,        setMode]        = useState('gps')  // 'gps' | 'type' | 'saved'
  const [address,     setAddress]     = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState(null)
  const debounceRef = useRef(null)

  // ─────────────────────────────────────────────────
  // 1. GPS SE CURRENT LOCATION LO
  // ─────────────────────────────────────────────────
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    setLoading(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords

        // Reverse geocoding — lat/lng se address string lo
        try {
          const res  = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json` +
            `?latlng=${lat},${lng}` +
            `&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}` +
            `&region=in`
          )
          const data = await res.json()
          const formattedAddress = data.results?.[0]?.formatted_address ?? `${lat}, ${lng}`

          const location = { address: formattedAddress, lat, lng }
          setAddress(formattedAddress)
          setSelected(location)
          onLocationSelected(location)
        } catch {
          const location = { address: `${lat}, ${lng}`, lat, lng }
          setSelected(location)
          onLocationSelected(location)
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setLoading(false)
        alert('Could not get location. Please type your address.')
        setMode('type')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // ─────────────────────────────────────────────────
  // 2. ADDRESS TYPE KARO — AUTOCOMPLETE
  // ─────────────────────────────────────────────────
  const handleInput = (val) => {
    setAddress(val)
    setSuggestions([])
    setSelected(null)

    // Debounce — har keystroke pe call mat karo
    clearTimeout(debounceRef.current)
    if (val.length < 3) return

    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `/api/places?input=${encodeURIComponent(val + ' Nagpur')}`
        )
        const data = await res.json()
        setSuggestions(data.predictions ?? [])
      } catch {
        // Ignore errors silently
      }
    }, 400)
  }

  // ─────────────────────────────────────────────────
  // 3. SUGGESTION SELECT KARO
  // ─────────────────────────────────────────────────
  const selectSuggestion = async (placeId, description) => {
    setAddress(description)
    setSuggestions([])
    setLoading(true)

    try {
      // Place ID se lat/lng fetch karo
      const res  = await fetch(`/api/places/details?place_id=${placeId}`)
      const data = await res.json()
      const { lat, lng } = data.result.geometry.location

      const location = { address: description, lat, lng }
      setSelected(location)
      onLocationSelected(location)
    } catch {
      // Fallback — coordinates ke bina bhi chalega
      const location = { address: description, lat: null, lng: null }
      setSelected(location)
      onLocationSelected(location)
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────
  // 4. SAVED ADDRESS SELECT KARO
  // ─────────────────────────────────────────────────
  const selectSaved = (saved) => {
    setSelected(saved)
    setAddress(saved.address)
    onLocationSelected(saved)
  }

  return (
    <div className="location-picker">
      <h3>📍 Delivery Location</h3>

      {/* ── TABS ── */}
      <div className="loc-tabs">
        <button
          className={mode === 'gps' ? 'active' : ''}
          onClick={() => setMode('gps')}
        >
          📍 Current
        </button>
        <button
          className={mode === 'type' ? 'active' : ''}
          onClick={() => setMode('type')}
        >
          ✏️ Type
        </button>
        {savedAddresses.length > 0 && (
          <button
            className={mode === 'saved' ? 'active' : ''}
            onClick={() => setMode('saved')}
          >
            🔖 Saved
          </button>
        )}
      </div>

      {/* ── GPS MODE ── */}
      {mode === 'gps' && (
        <div className="gps-section">
          <button
            onClick={getCurrentLocation}
            disabled={loading}
            className="gps-btn"
          >
            {loading ? '📍 Getting location...' : '📍 Use My Current Location'}
          </button>
          <p className="gps-note">Allow location access when browser asks</p>
        </div>
      )}

      {/* ── TYPE MODE ── */}
      {mode === 'type' && (
        <div className="type-section">
          <input
            value={address}
            onChange={e => handleInput(e.target.value)}
            placeholder="Type your address in Nagpur..."
            className="address-input"
            autoFocus
          />
          {suggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {suggestions.map(s => (
                <div
                  key={s.place_id}
                  className="suggestion-item"
                  onClick={() => selectSuggestion(s.place_id, s.description)}
                >
                  <span>📍</span>
                  <div>
                    <div className="sug-main">{s.structured_formatting?.main_text}</div>
                    <div className="sug-sec">{s.structured_formatting?.secondary_text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SAVED ADDRESSES ── */}
      {mode === 'saved' && (
        <div className="saved-section">
          {savedAddresses.map((addr, i) => (
            <div
              key={i}
              className={`saved-item ${selected?.address === addr.address ? 'selected' : ''}`}
              onClick={() => selectSaved(addr)}
            >
              <span>{addr.label === 'Home' ? '🏠' : addr.label === 'Work' ? '🏢' : '📍'}</span>
              <div>
                <div className="saved-label">{addr.label}</div>
                <div className="saved-addr">{addr.address}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SELECTED CONFIRMATION ── */}
      {selected && (
        <div className="selected-address">
          <span>✅</span>
          <div>
            <div className="sel-label">Delivering to:</div>
            <div className="sel-address">{selected.address}</div>
            {selected.lat && (
              <div className="sel-coords">
                {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
