# Google Maps Setup Instructions

## Quick Start

### 1. Get Your API Key (2-3 minutes)

1. Visit: https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable these APIs:
   - Search for "Maps JavaScript API" → Enable
   - Search for "Places API" → Enable (optional, for future features)

4. Go to **Credentials** (left sidebar)
5. Click **Create Credentials** → **API Key**
6. Copy the generated API key

### 2. Add to Your Environment (30 seconds)

Edit `.env.local` in the web app root:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_ACTUAL_API_KEY_HERE
```

Replace `YOUR_ACTUAL_API_KEY_HERE` with the key from step 1.

### 3. Test It

```bash
cd apps/web
npm run dev
```

Visit: http://localhost:3000/hospitals

You should see the interactive map with hospitals in Chandigarh.

---

## Security: Restrict Your API Key (Recommended)

To prevent unauthorized use of your API key:

1. In Google Cloud Console → **APIs & Services** → **Credentials**
2. Click on your API key
3. Under "Application restrictions":
   - Select **HTTP referrers (web sites)**
   - Add your domain: `yourdomain.com/*`
   - For local development, use: `localhost:3000/*` and `localhost:3001/*`

4. Under "API restrictions":
   - Select **Maps JavaScript API**

This ensures the key only works on your specified domains.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Map not loading | Verify API key in `.env.local`, restart dev server |
| "Invalid API Key" error | Check API key is correctly copied, no extra spaces |
| API key shows in browser console | This is normal - `NEXT_PUBLIC_` keys are public-facing. Restrict via Application Restrictions. |
| Geolocation prompt not appearing | Check browser permissions, use HTTPS for production |
| Coordinates are approximate | See Hospital Map Setup Guide for updating coordinates |

---

## Environment Variable Format

```env
# ✅ Correct
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# ❌ Wrong (don't do this)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY='your_api_key_here'  # No quotes!
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your_api_key_here"  # No quotes!
```

---

## Testing

After setup, visit these routes to test:

- **Full Hospital Finder**: http://localhost:3000/hospitals
- **Custom Usage**: Create your own page using `<HospitalMap />` component

---

## Need Help?

Check [HOSPITAL_MAP_SETUP.md](./HOSPITAL_MAP_SETUP.md) for:
- Full feature list
- Hospital database management
- MongoDB integration
- API reference
- Advanced configuration
