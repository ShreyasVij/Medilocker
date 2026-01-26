# GPS-First Hospital Map System

## 🎯 What Changed

### Before (Static Data):
- ❌ Manual list of 15 hardcoded Chandigarh hospitals
- ❌ Only worked in Chandigarh area
- ❌ Static data that needed manual updates
- ❌ Limited information

### After (GPS-First Dynamic):
- ✅ **Gets user GPS location FIRST**
- ✅ **Centers map on user's actual location**
- ✅ **Dynamically searches nearby hospitals using Google Places API**
- ✅ **Works anywhere in the world**
- ✅ **Real-time data with ratings, hours, phone numbers**
- ✅ **Search radius up to 40km**

## 🔄 How It Works Now

### Step-by-Step Process:

1. **User opens the map** 
   → System immediately requests GPS location

2. **User grants location permission**
   → System gets exact latitude/longitude

3. **Map centers on user's location**
   → Blue marker shows "You are here"

4. **System searches Google Places API**
   → Finds all hospitals, clinics, doctors within specified radius (default 10km)

5. **Results displayed on map**
   → Red markers = Hospitals
   → Orange markers = Clinics/Doctors
   → Sorted by distance (nearest first)

## 📝 Usage Examples

### Basic Usage (10km radius):
```tsx
import HospitalMap from '@/components/HospitalMap';

export default function Page() {
  return <HospitalMap />;
}
```

### Custom Radius (30km):
```tsx
<HospitalMap radiusKm={30} />
```

### Only Hospitals (40km):
```tsx
<HospitalMap radiusKm={40} type="hospital" />
```

### Only Clinics (20km):
```tsx
<HospitalMap radiusKm={20} type="clinic" />
```

### With Selection Handler:
```tsx
<HospitalMap 
  radiusKm={15}
  onHospitalSelect={(hospital) => {
    console.log('Selected:', hospital.name);
    console.log('Distance:', hospital.distance, 'km');
    console.log('Rating:', hospital.rating);
  }}
/>
```

## 🔧 Service Functions Available

### 1. Get User GPS Location
```typescript
import { getUserGPSLocation } from '@/services/hospitalService';

const location = await getUserGPSLocation();
// Returns: { latitude: 30.7333, longitude: 76.7794 } or null
```

### 2. Find All Nearby Medical Facilities (Main Function)
```typescript
import { findAllNearbyMedicalFacilitiesFromGPS } from '@/services/hospitalService';

const facilities = await findAllNearbyMedicalFacilitiesFromGPS(
  30.7333,  // user latitude
  76.7794,  // user longitude
  30        // radius in km (searches within 30km)
);

// Returns array of hospitals, clinics, doctors, dentists, pharmacies
// Sorted by distance (nearest first)
console.log(`Found ${facilities.length} facilities`);
```

### 3. Find Nearby Hospitals/Clinics
```typescript
import { getNearbyHospitals } from '@/services/hospitalService';

// All medical facilities within 5km
const all = await getNearbyHospitals(30.7333, 76.7794, 5);

// Only hospitals within 10km
const hospitals = await getNearbyHospitals(30.7333, 76.7794, 10, 'hospital');

// Only clinics within 15km
const clinics = await getNearbyHospitals(30.7333, 76.7794, 15, 'clinic');
```

### 4. Get Hospital Details by ID
```typescript
import { getHospitalById } from '@/services/hospitalService';

const hospital = await getHospitalById('ChIJplace_id_here');
// Returns full details including phone, address, rating, hours
```

### 5. Search by Name
```typescript
import { searchHospitals } from '@/services/hospitalService';

const results = await searchHospitals('cardiology');
// Searches for hospitals/clinics with "cardiology" in name or specialty
```

## 📊 Data Returned

Each hospital/clinic object contains:

```typescript
{
  id: string;              // Google Place ID
  name: string;            // "Apollo Hospital"
  location: string;        // "123 Main Street, City"
  latitude: number;        // 30.7333
  longitude: number;       // 76.7794
  type: 'hospital' | 'clinic';
  address: string;         // Full formatted address
  phone: string;           // Phone number (if available)
  specialties: string[];   // ["cardiology", "emergency"]
  distance: number;        // Distance from user in km
  rating: number;          // Google rating (0-5)
  isOpen: boolean;         // Currently open? true/false
}
```

## 🌍 Works Globally

Unlike the old system (Chandigarh only), this works **anywhere**:
- India (any city)
- USA
- Europe
- Asia
- Worldwide!

The system automatically detects where the user is and searches for nearby medical facilities in that area.

## ⚙️ Configuration

### Change Search Radius:
Edit the component call:
```tsx
<HospitalMap radiusKm={40} />  // 40km radius
```

### Change Default Radius:
Edit [HospitalMap.tsx](apps/web/components/HospitalMap.tsx#L33):
```typescript
radiusKm = 10,  // Change this default
```

## 🔐 Permissions Required

**User must grant location permission** for this to work:
- Browser will show: "Allow [site] to access your location?"
- User must click "Allow"
- If denied, system shows error message

## 🚨 Error Handling

### No GPS Permission:
```
"Unable to access your location. Please enable GPS/location services."
```

### Google Maps Not Loaded:
```
"Google Maps failed to load. Please check your internet connection."
```

### No Results:
```
"No medical facilities found within Xkm"
```

## 📱 Mobile Support

Works perfectly on mobile devices:
- Uses phone's GPS for accurate location
- Touch-friendly interface
- Responsive design

## 🎨 UI Features

1. **Loading State**: Shows spinner while getting GPS and searching
2. **User Marker**: Blue marker shows user's location
3. **Hospital Markers**: Red (hospitals) and Orange (clinics)
4. **Info Windows**: Click marker to see details
5. **Sidebar List**: Scrollable list of all results
6. **Distance Display**: Shows exact km from user
7. **Ratings**: Google star ratings displayed
8. **Open/Closed**: Green/red indicator for business hours

## 🔄 Migration Notes

### Old Code:
```typescript
// ❌ Old static approach
import { CHANDIGARH_HOSPITALS } from '@/services/hospitalService';
```

### New Code:
```typescript
// ✅ New GPS-first approach
const location = await getUserGPSLocation();
const hospitals = await findAllNearbyMedicalFacilitiesFromGPS(
  location.latitude, 
  location.longitude, 
  30
);
```

## 💡 Tips

1. **Increase radius for rural areas**: Use 30-40km in less populated areas
2. **Decrease radius in cities**: Use 5-10km in dense urban areas
3. **Check rating field**: Filter results by minimum rating if needed
4. **Use type filter**: Specify 'hospital' or 'clinic' to narrow results
5. **Cache location**: Don't request GPS on every page load

## 🎯 Summary

**Old System**: 15 hardcoded Chandigarh hospitals, static data  
**New System**: Unlimited hospitals worldwide, real-time Google Places API data, GPS-first approach

The system now:
1. ✅ Gets user GPS location first
2. ✅ Centers map on user
3. ✅ Searches nearby hospitals dynamically
4. ✅ Works anywhere in the world
5. ✅ Shows real-time data (ratings, hours, etc.)
6. ✅ Supports 30-40km search radius
