# Hospital Map - Visual Guide & Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Patient Browser                      │
│                    (Google Maps API v3)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS Request
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Web App                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  HospitalMap Component (React)                      │   │
│  │  ├─ Interactive map display                         │   │
│  │  ├─ Marker management                              │   │
│  │  ├─ Geolocation handling                           │   │
│  │  └─ Info windows                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                       ↑                                      │
│                       │                                      │
│  ┌────────────────────┴────────────────────┐                │
│  │   useHospitals Hooks & Services          │                │
│  │  ├─ useGeolocation()                     │                │
│  │  ├─ useNearbyHospitals()                 │                │
│  │  ├─ useHospitalSearch()                  │                │
│  │  └─ hospitalService.ts                   │                │
│  │     ├─ Distance calculations             │                │
│  │     └─ Hospital database (local)         │                │
│  └──────────────────────────────────────────┘                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Environment Variables                              │   │
│  │  ├─ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY               │   │
│  │  └─ Loaded in layout.tsx                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
                       │ API Call
                       ↓
        ┌──────────────────────────────┐
        │  Google Maps API Servers     │
        │  ├─ Map rendering            │
        │  ├─ Tile serving             │
        │  └─ Geolocation              │
        └──────────────────────────────┘
```

## 📊 Data Flow

```
User Opens /hospitals
    ↓
HospitalMap Component Mounts
    ↓
Google Maps Loads (initMap)
    ↓
Request Geolocation → Browser asks for permission
    ↓
┌─────────────────────────────────────────────┐
│ Got Location?                               │
├─────────────────────────────────────────────┤
│ YES              │              NO          │
│                  ↓              ↓           │
│ Center map to    Default to     │
│ user location    Chandigarh     │
└──────────────────┬──────────────┘
                   ↓
         Load Hospital Data
         ├─ getNearbyHospitals() or
         └─ getAllHospitals()
                   ↓
         Calculate Distances
         (Haversine formula)
                   ↓
         Create Map Markers
         ├─ Red: Hospitals
         └─ Orange: Clinics
                   ↓
         Render Sidebar List
         (sorted by distance)
                   ↓
         Wait for User Interaction
         ├─ Click marker
         ├─ Click sidebar item
         └─ Adjust filters
```

## 🎨 Component Hierarchy

```
App/Layout
  ├─ [Google Maps API Script]
  │
  └─ app/hospitals/page.tsx
      ├─ Control Panel (Filters)
      │  ├─ "Show Nearby Only" toggle
      │  ├─ "Search Radius" input
      │  └─ Selected Hospital Display
      │
      └─ HospitalMap Component
          ├─ Map Container
          │  ├─ Google Map Element
          │  ├─ User Location Marker (Blue)
          │  ├─ Hospital Markers (Red)
          │  ├─ Clinic Markers (Orange)
          │  └─ Info Windows
          │
          ├─ Sidebar
          │  ├─ Header (Count)
          │  └─ Hospital List
          │     ├─ Name
          │     ├─ Address
          │     ├─ Distance
          │     └─ Specialties
          │
          └─ User Location Display (Top Right)
```

## 🗺️ Map Element Breakdown

```
┌────────────────────────────────────────────────────────┐
│  Hospital & Clinic Finder                       [🔽]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│     ☐ Show Only Nearby      Radius: [5] km            │
│                                                        │
│  📍 Selected: Advanced Dental Care Centre             │
│     Location: SCO 18, Sector 18-D                    │
│     Distance: 2.45 km                               │
│                                                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│                                                        │
│              🗺️  GOOGLE MAPS HERE                      │
│              (with markers and controls)               │
│                                                        │
│     🔵 (Your Location)                                │
│     🔴 (Hospital - Healing Hospital)                  │
│     🟠 (Clinic - Dental Care Centre)                  │
│                                                        │
│                                                        │
│  ┌──────────────────────┐                             │
│  │ Nearby Hospitals     │ Your Location:              │
│  │ Found: 8 facilities  │ 30.7333°N, 76.7794°E       │
│  ├──────────────────────┤                             │
│  │ 🏥 Healing Hospital  │                             │
│  │ SCO 18-19, Sector... │                             │
│  │ 1.23 km away         │                             │
│  │                      │                             │
│  │ ⚕️ Advanced Dental   │                             │
│  │ SCO 18, Sector 18-D  │                             │
│  │ 2.45 km away         │                             │
│  │ Specialty: Dental    │                             │
│  │ ...                  │                             │
│  └──────────────────────┘                             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## 🔄 Geolocation Flow

```
┌─────────────────────────────────────────────┐
│ getUserLocation()                           │
└──────────────┬──────────────────────────────┘
               │
               ↓
    Check navigator.geolocation
               │
      ┌────────┴────────┐
      │                 │
   Unsupported      Supported
      │                 │
      ↓                 ↓
   setError         Show Browser Permission
                    Prompt to User
                      │
        ┌─────────────┴─────────────┐
        │                           │
      Allow                      Deny
        │                           │
        ↓                           ↓
   Get Coordinates            Use Default Location
   (lat, lng)                 (Chandigarh center)
        │                           │
        └──────────────┬────────────┘
                       ↓
            updateMap(userLat, userLng)
                       │
         ├─ Center map to user location
         ├─ Set zoom level to 13
         ├─ Add blue marker at user location
         └─ Load nearby hospitals
```

## 🎯 Distance Calculation

```
Haversine Formula
─────────────────

User Location: (30.7400, 76.7600)
Hospital Location: (30.7333, 76.7794)

Step 1: Calculate angle differences
    Δφ = (lat2 - lat1) × π/180
    Δλ = (lon2 - lon1) × π/180

Step 2: Calculate central angle using spherical law
    a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
    c = 2 × atan2(√a, √(1−a))

Step 3: Calculate distance
    d = R × c
    (R = Earth's radius = 6371 km)

Result: 2.45 km away
```

## 📱 Responsive Behavior

```
Desktop (>1024px)
┌────────────────────────────────────────────┐
│ Controls                                   │
├──────────────────────────┬──────────────────┤
│                          │                │
│        Map               │  Sidebar      │
│      (70%)               │  (30%)        │
│                          │                │
├──────────────────────────┼──────────────────┤
│ Map occupies 70% width, sidebar 30%       │
└────────────────────────────────────────────┘

Tablet (768px-1024px)
┌────────────────────┐
│ Controls           │
├────────────────────┤
│     Map (100%)     │
├────────────────────┤
│  Sidebar List      │
│  (Bottom Sheet)    │
└────────────────────┘

Mobile (<768px)
┌────────────────┐
│ Controls       │
├────────────────┤
│   Map (100%)   │
├────────────────┤
│  Sidebar List  │
│  (Full Width)  │
└────────────────┘
```

## 🔑 Key Integration Points

### 1. Patient Dashboard
```
Dashboard
  └─ "Find Hospitals" Button
      └─ Navigates to /hospitals
```

### 2. Appointment Booking
```
HospitalMap
  └─ onHospitalSelect callback
      └─ Redirect to /appointments?hospital=id
```

### 3. Doctor Profile
```
Doctor Profile
  ├─ Show affiliated hospitals
  └─ Link to map centered on their hospital
```

### 4. Emergency Routing
```
Emergency Button
  └─ Get nearest hospital
      └─ Show directions
```

## 📈 Performance Metrics

```
Load Time Breakdown:
─────────────────
Google Maps Script Load:  ~500ms
Hospital Data Load:       <100ms
Geolocation Request:      0-3000ms (user dependent)
Initial Render:           <500ms
Total Time to Interactive: ~1000-2000ms (usually <1.5s)
```

## 🔐 Security Layers

```
API Key
├─ Stored in .env.local (not in git)
├─ NEXT_PUBLIC_ prefix (only for client-side APIs)
├─ Can be restricted to specific domains
└─ Can be restricted to specific APIs

Data
├─ Hospital data is public
├─ User location stays client-side (not sent to server)
├─ No authentication required
└─ No database credentials exposed
```

## 🚀 Deployment Considerations

```
Before Production
────────────────
1. Get production API key from Google Cloud
2. Set API key restrictions:
   ├─ HTTP Referrers: yourdomain.com/*
   └─ APIs: Maps JavaScript API only
3. Update NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in prod env vars
4. Test on actual domain (geolocation requires HTTPS)
5. Monitor API usage in Google Cloud Console
```

---

This visual guide should help understand how all the pieces fit together!
