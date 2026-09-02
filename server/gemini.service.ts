import { FunctionDeclaration, GoogleGenAI, Type } from "@google/genai";
import { ASSAM_DISTRICT_LOCATIONS, getComprehensiveWeather } from "./weather.service";
import { getOfficialAssamRiverGauge } from "./assam-river-gauge";
import { listHospitals, listShelters } from "./rescue.db";

// Official Assam Emergency Helplines
export const ASSAM_EMERGENCY_HELPLINES = {
  nationalEmergency: "112",
  stateEmergencyOperationsCentre: "1070 (Toll Free) / 0361-2237011",
  districtEmergencyOperationsCentre: "1077",
  ambulanceService: "108",
  policeControlRoom: "100",
  fireAndEmergencyServices: "101",
  sdrfAssamControlRoom: "0361-2800557 / 94350-00108",
  ndrf1stBattalionPatgaonGuwahati: "0361-2849005 / 94359-62222",
  childHelpline: "1098",
  womenHelpline: "181",
  assamStateDisasterManagementAuthority: "ASDMA Dispur, Guwahati - 0361-2237221",
};

// Official Disaster & App Feature Guidance
export const PLATFORM_GUIDE = {
  sos: "To send an immediate SOS: Tap the large circular red SOS button on the home screen. Your phone captures current GPS coordinates and creates an emergency dispatch record instantly without extra clicks, notifying Assam SDRF & NDRF dispatchers.",
  voice_note: "To attach a Voice Note: Tap 'Record voice note' on the home card, speak your urgent message (up to 2 minutes), and tap Stop. The voice note is automatically attached to your next SOS dispatch for hands-free rescue details.",
  tracking: "To track your rescue status: Visit the 'Track' tab in bottom navigation and enter your private 8-character case code (e.g. SOS-ABC123XY) to view live rescuer ETA, coordinates, and real-time status updates.",
  weather: "To check local flood conditions: Review the 'Local flood conditions' panel on the home page for 7-day modeled rain forecasts, water level trends, precipitation radar, and official river gauge readings across Assam.",
  river_level: "To monitor river levels: Check the River Gauge section in the Flood Conditions panel on the home screen. It connects directly to the Central Water Commission (CWC) and National Water Data Portal to show live water levels (in metres), rising/falling trends, and danger mark warnings for the Brahmaputra, Barak, and tributaries.",
  safety: "To view flood preparedness: Open the 'Safety' tab in bottom navigation for offline evacuation checklists, kit preparation guides, disaster survival rules, and the district emergency directory.",
  hospital: "To find medical resources: Check the Hospital directory to view real-time bed availability, ICU capacity, oxygen cylinder counts, and 108 ambulance dispatch contacts.",
  shelter: "To find relief shelters: Access the Relief Camps directory to view active government evacuation centers, verified capacity, current occupancy, and district control room contacts (1077).",
  all_features: `Sahay Emergency & Disaster Response Platform Core Features:
1. 🚨 Rapid SOS: One-tap red emergency button with automatic GPS location dispatch.
2. 🎙️ Voice Notes: In-card audio recording (up to 2 min) attached to your rescue ticket.
3. 📍 Live Case Tracking: Real-time rescuer route, ETA, and status tracking using your 8-character case code.
4. 🌊 River Levels & Flood Forecast: Live river gauge readings and 7-day weather/rain forecasts across India.
5. 🛡️ Safety & Evacuation Guide: Offline checklists, emergency kit advice, and survival protocols.
6. 🏥 Hospital & Medical Tracker: Real-time emergency beds, ICU beds, oxygen availability, and 108 ambulance.
7. ⛺ Relief Camp Directory: Active evacuation shelters, capacity, and supply distribution info.
8. 🌐 Multilingual Support: Full support for English, Hindi, Assamese, Bengali, Odia, Marathi, Gujarati, Tamil, Telugu, and Kannada.`,
};

export const SAHAYAK_REDIRECT_MESSAGE =
  "I'm here to help with flood safety, emergencies, disaster response, and Sahay app features only. For other questions, please use a general assistant. Is there anything about the app, disaster situation, or your safety I can help with?";

export const SAHAYAK_REDIRECT_MESSAGES: Record<string, string> = {
  en: "I'm here to help with flood safety, emergencies, disaster response, and Sahay app features only. For other questions, please use a general assistant. Is there anything about the app, disaster situation, or your safety I can help with?",
  as: "মই কেৱল বানপানী আৰু দুৰ্যোগ সুৰক্ষা, জৰুৰীকালীন সাহায্য আৰু সহায় (Sahay) এপ্পৰ বৈশিষ্ট্যসমূহৰ বাবে সহায় কৰিব পাৰোঁ। আন প্ৰশ্নৰ বাবে অনুগ্ৰহ কৰি সাধাৰণ সহায়ক ব্যৱহাৰ কৰক।",
  hi: "मैं केवल आपदा व बाढ़ सुरक्षा, आपातकालीन सहायता, और सहाय (Sahay) ऐप की सुविधाओं में मदद करने के लिए यहाँ हूँ। अन्य प्रश्नों के लिए कृपया सामान्य सहायक का उपयोग करें।",
  bn: "আমি শুধুমাত্র দুর্যোগ ও বন্যা নিরাপত্তা, জরুরি সহায়তা এবং সহায় (Sahay) অ্যাপের বৈশিষ্ট্যের জন্য সাহায্য করতে পারি।",
  or: "ମୁଁ କେବଳ ଦୁର୍ଯ୍ୟୋଗ ସୁରକ୍ଷା, ଜରୁରୀକାଳୀନ ସହାୟତା ଏବଂ ସହାୟ (Sahay) ଆପ୍ ବିଷୟରେ ସାହାଯ୍ୟ କରିପାରିବି।",
  mr: "मी केवळ आपत्ती निवारण, पूर सुरक्षा आणि सहाय (Sahay) ॲपच्या वैशिष्ट्यांसाठी मदत करू शकतो.",
  gu: "હું ફક્ત આપત્તિ વ્યવસ્થાપન, કટોકટી સહાય અને સહાય (Sahay) એપની સુવિધાઓ માટે મદદ કરી શકું છું.",
  ta: "நான் பேரிடர் பாதுகாப்பு, அவசர உதவி மற்றும் சஹாய் (Sahay) செயலி அம்சங்களுக்கு மட்டுமே உதவ முடியும்.",
  te: "నేను విపత్తు భద్రత, అత్యవసర సహాయం మరియు సహాయ్ (Sahay) యాప్ ఫీచర్‌ల కోసం మాత్రమే సహాయం చేయగలను.",
  kn: "ನಾನು ವಿಪತ್ತು ಸುರಕ್ಷತೆ, ತುರ್ತು ನೆರವು ಮತ್ತು ಸಹಾಯ್ (Sahay) ಅಪ್ಲಿಕೇಶನ್ ವೈಶಿಷ್ಟ್ಯಗಳಿಗೆ ಮಾತ್ರ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.",
};

export function getSahayakRedirectMessage(language?: string): string {
  const langKey = (language || "en").toLowerCase().trim();
  return SAHAYAK_REDIRECT_MESSAGES[langKey] || SAHAYAK_REDIRECT_MESSAGES.en;
}

export const SAHAYAK_SYSTEM_INSTRUCTIONS = `You are Sahayak AI, the official Emergency & Disaster Response Assistant for Sahay - Pan-India Emergency & Disaster Response Platform. You ONLY answer questions about flood safety, emergency preparedness, disaster response, weather/rain forecasts, river levels & gauge monitoring, hospitals/medical beds/ICU/oxygen, relief shelters, first aid, emergency helplines, and how to use this app's features (Rapid SOS, Voice Notes, Case Tracking, Live Weather Risk Heatmaps, Safety Checklists, Hospital Portal, and Responder Dashboard). When finding hospitals or medical assistance and user location/coordinates are available, call the findNearbyHospitals tool with lat and lng coordinates, and present the nearest hospitals first including their distance in kilometres (e.g., "X.X km away"), address, phone, emergency beds, ICU beds, and oxygen capacity. Do NOT give a generic 108 helpline fallback message when real hospital data is available for their location. If a user asks anything unrelated (physics, math, coding, trivia, homework, entertainment, general knowledge, recipes, sports, politics, etc.), respond ONLY with: '${SAHAYAK_REDIRECT_MESSAGE}' Do not explain or entertain the off-topic subject even briefly. This applies even if the user insists or rephrases.`;

export const DISASTER_KEYWORDS = [
  // River Levels & Gauges
  "river level",
  "river levels",
  "water level",
  "water levels",
  "river gauge",
  "river gauges",
  "gauge reading",
  "gauge readings",
  "gauge",
  "gauges",
  "water flow",
  "water discharge",
  "danger level",
  "danger mark",
  "warning level",
  "warning mark",
  "hfl",
  "highest flood level",
  "river height",
  "river depth",
  "river status",
  "river trend",
  "river rise",
  "river fall",
  "rising water",
  "water rising",
  "river",
  "rivers",
  "stream",
  "streams",
  "dam",
  "dams",
  "reservoir",
  "embankment",
  "embankments",
  "breach",
  "bund",
  "sluice gate",
  "cwc",
  "telemetry",
  "brahmaputra",
  "barak",
  "jia bharali",
  "kopili",
  "pudhimary",
  "beki",
  "manas",
  "subansiri",
  "dhansiri",
  "burhidehing",
  "pagladiya",
  "sankosh",
  "kushiyara",
  "katakhal",
  "tributary",
  "tributaries",

  // App Features
  "app",
  "feature",
  "features",
  "sahayak",
  "sahayak ai",
  "how to use",
  "how does this work",
  "how to",
  "guide",
  "functions",
  "sos",
  "rapid sos",
  "emergency button",
  "panic button",
  "red button",
  "send sos",
  "trigger sos",
  "dispatch",
  "gps",
  "coordinates",
  "location",
  "live location",
  "voice note",
  "voice notes",
  "voice message",
  "audio note",
  "record voice",
  "voice recording",
  "record audio",
  "mic",
  "microphone",
  "audio recording",
  "track",
  "tracking",
  "case code",
  "case number",
  "case id",
  "track status",
  "rescue status",
  "rescuer eta",
  "eta",
  "track rescue",
  "live tracking",
  "track tab",
  "status update",
  "rescue progress",
  "responder",
  "responders",
  "rescue team",
  "operations map",
  "command center",
  "hospital portal",
  "hospital registration",
  "update beds",
  "bed management",
  "language",
  "switch language",
  "offline mode",

  // Floods, Disaster, Weather & Safety
  "flood",
  "floods",
  "flooding",
  "flood level",
  "flood risk",
  "active flood zones",
  "flood alert",
  "flood warning",
  "emergency",
  "emergencies",
  "rescue",
  "rescuer",
  "rescuers",
  "rescuing",
  "rescued",
  "shelter",
  "shelters",
  "relief",
  "relief camp",
  "relief camps",
  "camp",
  "camps",
  "evacuation center",
  "shelter capacity",
  "food relief",
  "hospital",
  "hospitals",
  "clinic",
  "clinics",
  "doctor",
  "doctors",
  "medical",
  "medicine",
  "medicines",
  "ambulance",
  "icu",
  "icu bed",
  "bed",
  "beds",
  "emergency bed",
  "oxygen",
  "oxygen cylinder",
  "pharmacy",
  "weather",
  "rain",
  "rains",
  "raining",
  "rainfall",
  "storm",
  "cyclone",
  "monsoon",
  "temperature",
  "forecast",
  "7-day forecast",
  "precipitation",
  "radar",
  "safety",
  "safety tab",
  "safe",
  "danger",
  "warning",
  "alert",
  "caution",
  "preparedness",
  "prepared",
  "checklist",
  "evacuation checklist",
  "emergency kit",
  "survival kit",
  "first aid kit",
  "safety tips",
  "help",
  "assist",
  "assistance",
  "support",
  "injury",
  "injuries",
  "injured",
  "wound",
  "wounds",
  "first aid",
  "casualty",
  "hurt",
  "bleeding",
  "pain",
  "fracture",
  "snake bite",
  "cpr",
  "drown",
  "drowning",
  "evacuate",
  "evacuation",
  "evacuating",
  "evacuated",
  "water",
  "submerged",
  "inundat",
  "inundated",
  "inundation",
  "disaster",
  "sdrf",
  "ndrf",
  "asdma",
  "deoc",
  "seoc",
  "helpline",
  "helplines",
  "emergency contact",
  "emergency number",
  "112",
  "1070",
  "1077",
  "108",
  "100",
  "101",
  "1098",
  "181",

  // Multilingual terms (Assamese, Bengali, Hindi, etc.)
  "বানপানী", "বান", "বন্যা", "উদ্ধাৰ", "উদ্ধার", "সাহায্য", "আশ্ৰয়", "আশ্রয়",
  "চিকিৎসালয়", "হাসপাতাল", "বতৰ", "আবহাওয়া", "নিৰাপত্তা", "নিরাপত্তা", "জৰুৰী", "জরুরি",
  "বিপদ", "নদী", "নৈ", "নদীৰ জলস্তৰ", "জলস্তৰ", "পানীৰ স্তৰ", "নদীৰ পানী", "বিপদ সীমা",
  "নদীর জলস্তর", "জলস্তর", "পানির স্তর", "নদীর পানি", "বিপদসীমা", "ব্ৰহ্মপুত্ৰ", "ব্রহ্মপুত্র",
  "বৰাক", "বরাক", "পানী", "পানি", "চিকিৎসা", "ঔষধ", "ওষুধ", "ডাক্তার", "এম্বুলেন্স",
  "বাঢ়", "राहत", "बचाव", "आपातकालीन", "मदद", "सहायता", "अस्पताल", "मौसम", "बारिश",
  "सुरक्षा", "नदी", "नदी का जलस्तर", "जलस्तर", "पानी का स्तर", "नदी का पानी", "खतरे का निशान",
  "ब्रह्मपुत्र", "बराक", "पानी", "दवा", "इलाज", "खतरा", "डॉक्टर", "एंबुलेंस", "हेल्पलाइन", "सुविधाएं", "फीचर्स"
];

export function isDisasterRelatedMessage(message: string): boolean {
  if (!message || typeof message !== "string") return false;
  const normalized = message.toLowerCase().trim();
  if (normalized.length === 0) return false;
  return DISASTER_KEYWORDS.some((kw) => normalized.includes(kw.toLowerCase()));
}

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Tool implementations using real application data
export const realDataTools = {
  getCurrentWeatherAndFloodRisk: async (args?: { district?: string; latitude?: number; longitude?: number }) => {
    let lat = args?.latitude;
    let lng = args?.longitude;

    if ((!lat || !lng) && args?.district) {
      const normalized = args.district.trim().toLowerCase();
      const match = ASSAM_DISTRICT_LOCATIONS.find(d =>
        d.name.toLowerCase().includes(normalized) ||
        normalized.includes(d.name.toLowerCase())
      );
      if (match) {
        lat = match.latitude;
        lng = match.longitude;
      }
    }

    // Default coordinates: Guwahati (Kamrup Metro)
    lat = lat ?? 26.1445;
    lng = lng ?? 91.7362;

    try {
      const weather = await getComprehensiveWeather(lat, lng);
      const riverGauge = await getOfficialAssamRiverGauge(lat, lng);

      return {
        success: true,
        district: args?.district || "Kamrup Metro / Guwahati",
        coordinates: { latitude: lat, longitude: lng },
        currentTemperatureC: weather.current.temperatureC,
        currentPrecipitationMm: weather.current.precipitationMm,
        windSpeedKmh: weather.current.windKmh,
        forecastRainChancePct: weather.forecast.rainChance,
        forecastRainAmountMm: weather.forecast.rainAmountMm,
        floodRiskLevel: weather.floodRisk.riskLevel,
        floodRiskSummary: weather.floodRisk.summary,
        activeFloodZonesNearby: weather.floodRisk.activeFloodZonesCount,
        riverGauge: {
          available: riverGauge.available,
          station: riverGauge.stationName,
          river: riverGauge.riverName,
          waterLevelMeters: riverGauge.levelMetres,
          trend: riverGauge.trend,
          distanceKm: riverGauge.distanceKm,
          status: riverGauge.message,
          source: riverGauge.sourceName,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: "Real-time weather & river gauge source temporarily unavailable. Follow ASDMA radio/TV alerts.",
        error: err?.message,
      };
    }
  },

  findNearbyHospitals: async (args?: { district?: string; query?: string; lat?: number; lng?: number }) => {
    try {
      const allHospitals = await listHospitals();
      let filtered = allHospitals;

      if (args?.district) {
        const districtTerm = args.district.toLowerCase();
        filtered = filtered.filter(h =>
          h.address?.toLowerCase().includes(districtTerm) ||
          h.name.toLowerCase().includes(districtTerm)
        );
      }

      if (args?.query) {
        const queryTerm = args.query.toLowerCase();
        filtered = filtered.filter(h =>
          h.name.toLowerCase().includes(queryTerm) ||
          h.address?.toLowerCase().includes(queryTerm)
        );
      }

      let mapped = filtered.map(h => {
        let distanceKm: number | undefined = undefined;
        if (
          typeof args?.lat === "number" &&
          typeof args?.lng === "number" &&
          typeof h.latitude === "number" &&
          typeof h.longitude === "number"
        ) {
          distanceKm = calculateHaversineDistanceKm(args.lat, args.lng, h.latitude, h.longitude);
        }

        return {
          name: h.name,
          address: h.address,
          phone: h.contactPhone,
          availableBeds: h.availableEmergencyBeds,
          totalBeds: h.totalEmergencyBeds,
          icuBeds: h.availableIcuBeds,
          totalIcuBeds: h.totalIcuBeds,
          oxygenCylinders: h.oxygenCylinderCount,
          status: h.status,
          distanceKm,
        };
      });

      if (typeof args?.lat === "number" && typeof args?.lng === "number") {
        mapped.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      }

      const results = mapped.slice(0, 5);

      return {
        success: true,
        count: results.length,
        hospitals: results,
      };
    } catch (err: any) {
      return {
        success: false,
        count: 0,
        hospitals: [],
        message: "Live hospital capacity data is temporarily unavailable. For urgent hospital dispatch or ambulance, call 108.",
      };
    }
  },

  getReliefShelters: async (args?: { district?: string }) => {
    try {
      const allShelters = await listShelters();
      let filtered = allShelters;

      if (args?.district) {
        const d = args.district.toLowerCase();
        filtered = filtered.filter(s =>
          s.address?.toLowerCase().includes(d) ||
          s.name?.toLowerCase().includes(d)
        );
      }

      const results = filtered.slice(0, 5).map(s => ({
        name: s.name,
        address: s.address,
        capacity: s.capacity,
        currentOccupancy: s.occupancy,
        status: s.status,
      }));

      return {
        success: true,
        count: results.length,
        shelters: results,
      };
    } catch {
      return {
        success: false,
        count: 0,
        shelters: [],
        message: "Live relief shelter data is temporarily unavailable. Contact District Disaster Control Room at 1077.",
      };
    }
  },

  getEmergencyHelplines: async () => {
    return {
      success: true,
      helplines: ASSAM_EMERGENCY_HELPLINES,
      note: "For life-threatening emergencies, dial 112 (National Emergency) or 1070 (Assam State Disaster Control Room).",
    };
  },

  getPlatformAssistanceGuide: async (args?: { topic?: string }) => {
    const topic = (args?.topic || "general").toLowerCase();
    let guide = PLATFORM_GUIDE.all_features;
    if (topic.includes("sos") || topic.includes("emergency") || topic.includes("red button")) {
      guide = PLATFORM_GUIDE.sos;
    } else if (topic.includes("voice") || topic.includes("audio") || topic.includes("record")) {
      guide = PLATFORM_GUIDE.voice_note;
    } else if (topic.includes("track") || topic.includes("status") || topic.includes("code")) {
      guide = PLATFORM_GUIDE.tracking;
    } else if (topic.includes("river") || topic.includes("gauge") || topic.includes("water level")) {
      guide = PLATFORM_GUIDE.river_level;
    } else if (topic.includes("weather") || topic.includes("rain") || topic.includes("flood")) {
      guide = PLATFORM_GUIDE.weather;
    } else if (topic.includes("safety") || topic.includes("kit") || topic.includes("checklist")) {
      guide = PLATFORM_GUIDE.safety;
    } else if (topic.includes("hospital") || topic.includes("bed") || topic.includes("doctor")) {
      guide = PLATFORM_GUIDE.hospital;
    } else if (topic.includes("shelter") || topic.includes("camp")) {
      guide = PLATFORM_GUIDE.shelter;
    }

    return {
      success: true,
      topic,
      instructions: guide,
      availableFeatures: [
        "1. Rapid SOS (One-tap red emergency button with live GPS location)",
        "2. Record Voice Note (In-card recording for hands-free details attached to SOS)",
        "3. Live Case Tracking (8-character code tracking with rescuer ETA)",
        "4. Live River Gauges & Flood Forecast (Real-time CWC water levels in metres and 7-day rainfall)",
        "5. Safety & Preparedness (Offline evacuation checklists, kit advice, emergency directory)",
        "6. Hospital Bed & ICU Tracker (Live bed/ICU/oxygen availability and 108 ambulance)",
        "7. Relief Shelters Directory (Active camp capacity, occupancy, and DEOC 1077)",
      ],
    };
  },
};

// Gemini Tool Declarations for Function Calling
const geminiFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "getCurrentWeatherAndFloodRisk",
    description: "Get real-time weather, precipitation, rain forecast, flood risk level, and official CWC river gauge data for an Assam district or coordinate.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        district: {
          type: Type.STRING,
          description: "Name of the Assam district (e.g. Kamrup Metro, Dibrugarh, Cachar, Sonitpur, Jorhat, Nagaon, etc.)",
        },
        latitude: { type: Type.NUMBER, description: "Optional latitude coordinate" },
        longitude: { type: Type.NUMBER, description: "Optional longitude coordinate" },
      },
    },
  },
  {
    name: "findNearbyHospitals",
    description: "Find real registered hospitals and medical centers in Assam with live bed availability, ICU capacity, oxygen cylinders, contact numbers, and distance when coordinates are provided.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        district: { type: Type.STRING, description: "District to filter by (e.g. Kamrup Metro, Cachar, Dibrugarh, etc.)" },
        query: { type: Type.STRING, description: "Search term for hospital name or department" },
        lat: { type: Type.NUMBER, description: "Optional user latitude coordinate for proximity sorting" },
        lng: { type: Type.NUMBER, description: "Optional user longitude coordinate for proximity sorting" },
      },
    },
  },
  {
    name: "getReliefShelters",
    description: "Get real active flood relief shelters and evacuation camps in Assam with capacity and location details.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        district: { type: Type.STRING, description: "District to filter by" },
      },
    },
  },
  {
    name: "getEmergencyHelplines",
    description: "Get official Assam disaster response helplines and emergency contact numbers (State & District EOC, SDRF, NDRF, 112, 108, 100, 101).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getPlatformAssistanceGuide",
    description: "Get instructions on how to use the Sahay Emergency Platform features such as Rapid SOS, Voice Notes, Case Tracking, River Gauges, Safety Checklists, and Hospital Portal.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: { type: Type.STRING, description: "Feature to explain: 'sos', 'voice_note', 'tracking', 'river_level', 'weather', 'safety', 'hospital', 'shelter', 'all_features'" },
      },
    },
  },
];

export const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  as: "Assamese (অসমীয়া)",
  hi: "Hindi (हिन्दी)",
  bn: "Bengali (বাংলা)",
  or: "Odia (ଓଡ଼ିଆ)",
  mr: "Marathi (मराठी)",
  gu: "Gujarati (ગુજરાતી)",
  ta: "Tamil (தமிழ்)",
  te: "Telugu (తెలుగు)",
  kn: "Kannada (ಕನ್ನಡ)",
};

export function buildSahayakSystemInstruction(language?: string): string {
  const langKey = (language || "en").toLowerCase().trim();
  const langName = LOCALE_NAMES[langKey] || language || "English";

  if (langKey === "en" || !langKey) {
    return SAHAYAK_SYSTEM_INSTRUCTIONS;
  }

  return `CRITICAL LANGUAGE DIRECTIVE:
You are interacting with a user whose application language is set to ${langName} (locale: "${langKey}").
You MUST write and present your entire final response in ${langName} (${langKey}).
- All hospital details, bed capacities, river gauge levels, flood advice, weather conditions, relief shelter info, and emergency guidelines MUST be translated and formulated into natural, fluent ${langName}.
- Even if tool data (from hospital database or weather feeds) or user queries contain English text, you MUST translate and explain everything in ${langName}.
- Official emergency helpline numbers (112, 1070, 1077, 108, 100, 101, 1098, 181) and specific proper names must be clearly preserved.
- DO NOT output responses in English.

${SAHAYAK_SYSTEM_INSTRUCTIONS}

MANDATORY OUTPUT FORMAT:
You MUST write your entire response in ${langName} (${langKey}).`;
}

export const SAHAYAK_FALLBACK_MESSAGES: Record<string, string> = {
  en: "Sahayak AI is temporarily unable to connect. If you need immediate emergency assistance, please tap the SOS button on the home screen or call 112 (National Emergency) / 1070 (Assam State Disaster Control Room).",
  as: "সহায়ক AI সাময়িকভাৱে সংযোগ কৰিবলৈ অসমৰ্থ। যদি আপোনাক জৰুৰীকালীন সাহায্যৰ প্ৰয়োজন হয়, অনুগ্ৰহ কৰি মুখ্য স্ক্ৰীণৰ SOS বুটামটো টিপক বা তাৎক্ষণিকভাৱে ১১২ (ৰাষ্ট্ৰীয় জৰুৰীকালীন) / ১০৭০ (অসম ৰাজ্যিক দুৰ্যোগ নিয়ন্ত্ৰণ কক্ষ) নম্বৰত ফোন কৰক।",
  hi: "सहायक AI अस्थायी रूप से कनेक्ट करने में असमर्थ है। यदि आपको तत्काल आपातकालीन सहायता की आवश्यकता है, तो कृपया होम स्क्रीन पर SOS बटन दबाएं या तुरंत 112 (राष्ट्रीय आपातकाल) / 1070 (असम राज्य आपदा नियंत्रण कक्ष) पर कॉल करें।",
  bn: "সহায়ক AI সাময়িকভাবে সংযোগ করতে অক্ষম। আপনার যদি অবিলম্বে জরুরি সহায়তার প্রয়োজন হয়, দয়া করে হোম স্ক্রিনের SOS বোতামটি চাপুন বা সরাসরি ১১২ (জাতীয় জরুরি সেবা) / ১০৭০ (আসাম রাজ্য দুর্যোগ নিয়ন্ত্রণ কক্ষ)-এ কল করুন।",
  or: "ସହାୟକ AI ସାମୟିକ ଭାବରେ ସଂଯୋଗ କରିବାରେ ଅସମର୍ଥ। ଯଦି ଆପଣଙ୍କୁ ତୁରନ୍ତ ଜରୁରୀକାଳୀନ ସହାୟତା ଆବଶ୍ୟକ, ଦୟାକରି ହୋମ୍ ସ୍କ୍ରିନରେ ଥିବା SOS ବଟନ୍ ଦବାନ୍ତୁ କିମ୍ବା ୧୧୨ / ୧୦୭୦ ରେ କଲ୍ କରନ୍ତୁ।",
  mr: "सहायक AI तात्पुरते कनेक्ट होण्यास असमर्थ आहे. आपल्याला तात्काळ आपत्कालीन मदतीची आवश्यकता असल्यास, कृपया मुख्य स्क्रीनवरील SOS बटण दाबा किंवा त्वरित 112 / 1070 वर कॉल करा.",
  gu: "સહાયક AI કામચલાઉ રીતે કનેક્ટ કરવામાં અસમર્થ છે. જો તમને તાત્કાલિક કટોકટી સહાયની જરૂર હોય, તો કૃપા કરીને હોમ સ્ક્રીન પર SOS બટન દબાવો અથવા 112 / 1070 પર કૉલ કરો.",
  ta: "சஹாயக் AI தற்காலிகமாக இணைக்க முடியவில்லை. அவசர உதவி தேவைப்பட்டால், முகப்புத் திரையில் உள்ள SOS பொத்தானை அழுத்தவும் அல்லது 112 / 1070 ஐ அழைக்கவும்.",
  te: "సహాయక్ AI తాత్కాలಿಕంగా కనెక్ట్ కాలేకపోతోంది. మీకు తక్షణ అత్యవసర సహాయం అవసరమైతే, దయచేసి హోమ్ స్క్రీన్‌పై SOS బటన్‌ను నొక్కండి లేదా 112 / 1070 కు కాల్ చేయండి.",
  kn: "ಸಹಾಯಕ್ AI ತಾತ್ಕಾಲಿಕವಾಗಿ ಸಂಪರ್ಕ ಸಾಧಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ನಿಮಗೆ ತಕ್ಷಣದ ತುರ್ತು ಸಹಾಯದ ಅಗತ್ಯವಿದ್ದರೆ, ದಯವಿಟ್ಟು ಮುಖಪುಟದಲ್ಲಿರುವ SOS ಬಟನ್ ಒತ್ತಿರಿ ಅಥವಾ 112 / 1070 ಗೆ ಕರೆ ಮಾಡಿ.",
};

export function getSahayakFallbackMessage(language?: string): string {
  const langKey = (language || "en").toLowerCase().trim();
  return SAHAYAK_FALLBACK_MESSAGES[langKey] || SAHAYAK_FALLBACK_MESSAGES.en;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateChatResponseOptions {
  message: string;
  language?: string;
  userLocation?: { lat: number; lng: number } | null;
  history?: ChatMessage[];
  conversationId?: string;
}

export interface ChatResponseResult {
  reply: string;
  conversationId?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errorMessage = err?.message || String(err);
      const isRetryable = errorMessage.includes("503") || 
                          errorMessage.includes("fetch failed");

      // Note: 429 quota exhaustion in free-tier should fail fast to trigger our smart offline fallback
      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }
      
      const backoffTime = Math.pow(2, attempt) * 1000;
      console.warn(`[Sahayak AI] API Error (${errorMessage}). Retrying ${attempt}/${maxRetries} in ${backoffTime}ms...`);
      await delay(backoffTime);
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Intelligent Local Emergency Fallback Engine:
 * When external AI APIs are rate-limited, offline, or unavailable, this engine executes real database & gauge queries
 * to provide accurate, live answers for river levels, app features, weather, hospitals, shelters, and helplines.
 */
export async function generateSmartOfflineResponse(options: GenerateChatResponseOptions): Promise<string> {
  const normalized = (options.message || "").toLowerCase();
  const lang = (options.language || "en").toLowerCase().trim();

  // Detect District Mention
  const matchedDistrict = ASSAM_DISTRICT_LOCATIONS.find(d => normalized.includes(d.name.toLowerCase()))?.name || "Kamrup Metro";

  // 1. River Level & Gauge Queries
  if (
    normalized.includes("river") ||
    normalized.includes("gauge") ||
    normalized.includes("water level") ||
    normalized.includes("brahmaputra") ||
    normalized.includes("barak") ||
    normalized.includes("danger mark") ||
    normalized.includes("danger level") ||
    normalized.includes("stream") ||
    normalized.includes("জলস্তৰ") ||
    normalized.includes("নদী") ||
    normalized.includes("जलस्तर")
  ) {
    try {
      const weatherData = await realDataTools.getCurrentWeatherAndFloodRisk({ district: matchedDistrict });
      const gauge = weatherData.riverGauge;

      if (lang === "as") {
        return `🌊 **অসম নদীৰ জলস্তৰ তথ্য (${matchedDistrict})**:
• পৰ্যবেক্ষণ কেন্দ্ৰ: ${gauge?.station || "গুৱাহাটী ব্ৰহ্মপুত্ৰ কেন্দ্ৰ"}
• নদী: ${gauge?.river || "ব্ৰহ্মপুত্ৰ"}
• বৰ্তমান জলস্তৰ: ${gauge?.waterLevelMeters ? `${gauge.waterLevelMeters} মিটাৰ` : "তথ্য সংগ্ৰহ চলি আছে"}
• প্ৰৱণতা: ${gauge?.trend === "rising" ? "উৰ্ধ্বমুখী (Rising ⬆️)" : gauge?.trend === "falling" ? "হ্ৰাসমান (Falling ⬇️)" : "স্থিৰ (Steady ↔️)"}
• অৱস্থা: ${gauge?.status || "জলস্তৰ নিয়মীয়া নিৰীক্ষণত আছে"}

জৰুৰীকালীন সাহায্যৰ বাবে মুখ্য স্ক্ৰীণৰ SOS বুটাম টিপক বা ১১২ / ১০৭০ নম্বৰত ফোন কৰক।`;
      }

      if (lang === "hi") {
        return `🌊 **असम नदी जलस्तर रिपोर्ट (${matchedDistrict})**:
• स्टेशन: ${gauge?.station || "गुवाहाटी ब्रह्मपुत्र स्टेशन"}
• नदी: ${gauge?.river || "ब्रह्मपुत्र"}
• वर्तमान जलस्तर: ${gauge?.waterLevelMeters ? `${gauge.waterLevelMeters} मीटर` : "आंकड़े उपलब्ध"}
• प्रवृत्ति (Trend): ${gauge?.trend === "rising" ? "बढ़ रहा है (Rising ⬆️)" : gauge?.trend === "falling" ? "घट रहा है (Falling ⬇️)" : "स्थिर (Steady ↔️)"}
• स्थिति: ${gauge?.status || "जलस्तर की निगरानी जारी है"}

आपातकालीन सहायता के लिए होम स्क्रीन पर लाल SOS बटन दबाएं या 112 / 1070 पर संपर्क करें।`;
      }

      if (lang === "bn") {
        return `🌊 **আসাম নদীর জলস্তর রিপোর্ট (${matchedDistrict})**:
• পর্যবেক্ষণ কেন্দ্র: ${gauge?.station || "গুয়াহাটি ব্রহ্মপুত্র"}
• নদী: ${gauge?.river || "ব্রহ্মপুত্র"}
• বর্তমান জলস্তর: ${gauge?.waterLevelMeters ? `${gauge.waterLevelMeters} মিটার` : "তথ্য সংগৃহীত হচ্ছে"}
• প্রবণতা: ${gauge?.trend === "rising" ? "বাড়ছে (Rising ⬆️)" : gauge?.trend === "falling" ? "কমছে (Falling ⬇️)" : "স্থির (Steady ↔️)"}
• তথ্যসূত্র: ${gauge?.source || "National Water Data Portal & CWC"}

জরুরি সহায়তার জন্য হোম স্ক্রিনের SOS বোতামটি ব্যবহার করুন অথবা ১১২ / ১০৭০ নম্বরে কল করুন।`;
      }

      return `🌊 **Official Assam River Gauge & Water Level Report (${matchedDistrict})**:
• **Monitoring Station**: ${gauge?.station || "Guwahati Brahmaputra"}
• **River**: ${gauge?.river || "Brahmaputra"}
• **Water Level**: ${gauge?.waterLevelMeters ? `${gauge.waterLevelMeters} metres` : "Live telemetry active"}
• **Trend**: ${gauge?.trend === "rising" ? "Rising ⬆️ (Caution advised)" : gauge?.trend === "falling" ? "Falling ⬇️" : "Steady ↔️"}
• **Observation**: ${gauge?.status || "Continuous telemetry stream"}
• **Source**: ${gauge?.source || "Assam Department & Central Water Commission (CWC)"}

💡 You can also monitor real-time river gauges directly in the **Flood Conditions** panel on the home screen. For life-threatening emergencies, tap **SOS** or dial **112 / 1070**.`;
    } catch {
      return `🌊 River Level Update: Live river telemetry stations across Assam (Brahmaputra, Barak, and tributaries) are monitored continuously. Please check the 'Local flood conditions' panel on the home screen for live readings or call State Disaster Control Room at 1070 / 112.`;
    }
  }

  // 2. App Features & How-To Guides
  if (
    normalized.includes("feature") ||
    normalized.includes("features") ||
    normalized.includes("app") ||
    normalized.includes("how to") ||
    normalized.includes("guide") ||
    normalized.includes("functions") ||
    normalized.includes("what can this app do") ||
    normalized.includes("এপ্প") ||
    normalized.includes("सुविधाएं") ||
    normalized.includes("ফিচার")
  ) {
    if (normalized.includes("sos") || normalized.includes("emergency button") || normalized.includes("red button")) {
      return `🚨 **How to use Rapid SOS**:
${PLATFORM_GUIDE.sos}

💡 Once pressed, your GPS coordinates are locked and transmitted to SDRF/NDRF dispatchers immediately.`;
    }

    if (normalized.includes("voice") || normalized.includes("audio") || normalized.includes("record")) {
      return `🎙️ **How to record a Voice Note**:
${PLATFORM_GUIDE.voice_note}`;
    }

    if (normalized.includes("track") || normalized.includes("case code") || normalized.includes("status")) {
      return `📍 **How to Track Rescue Status**:
${PLATFORM_GUIDE.tracking}`;
    }

    if (normalized.includes("safety") || normalized.includes("checklist") || normalized.includes("kit")) {
      return `🛡️ **Safety & Preparedness Guide**:
${PLATFORM_GUIDE.safety}`;
    }

    return `📱 **Sahay Platform Features**:
${PLATFORM_GUIDE.all_features}

How can I assist you further with any of these tools?`;
  }

  // 3. Weather, Rain & Flood Risk
  if (
    normalized.includes("weather") ||
    normalized.includes("rain") ||
    normalized.includes("forecast") ||
    normalized.includes("precipitation") ||
    normalized.includes("flood condition") ||
    normalized.includes("storm") ||
    normalized.includes("cyclone") ||
    normalized.includes("মনসুন") ||
    normalized.includes("বতৰ") ||
    normalized.includes("मौसम") ||
    normalized.includes("বৃষ্টি")
  ) {
    try {
      const weather = await realDataTools.getCurrentWeatherAndFloodRisk({ district: matchedDistrict });
      return `🌧️ **Weather & Flood Risk (${matchedDistrict})**:
• Temperature: ${weather.currentTemperatureC}°C
• Current Precipitation: ${weather.currentPrecipitationMm} mm
• Wind Speed: ${weather.windSpeedKmh} km/h
• 7-Day Rain Probability: ${weather.forecastRainChancePct}% (Est. ${weather.forecastRainAmountMm} mm)
• Flood Risk Level: **${weather.floodRiskLevel?.toUpperCase()}**
• Summary: ${weather.floodRiskSummary}
• Active Flood Zones Nearby: ${weather.activeFloodZonesNearby}

Stay alert and move to higher ground if heavy rain continues. Dial 112 / 1070 for emergency dispatch.`;
    } catch {
      return `🌧️ Weather & Flood Update: Please review the 'Local flood conditions' card on the home screen for live 7-day precipitation forecasts and flood risk levels. For immediate emergency help, dial 112.`;
    }
  }

  // 4. Hospitals, Medical Beds, ICU, Oxygen & Doctors
  if (
    normalized.includes("hospital") ||
    normalized.includes("bed") ||
    normalized.includes("icu") ||
    normalized.includes("oxygen") ||
    normalized.includes("doctor") ||
    normalized.includes("clinic") ||
    normalized.includes("ambulance") ||
    normalized.includes("medical") ||
    normalized.includes("হাসপাতাল") ||
    normalized.includes("চিকিৎসালয়") ||
    normalized.includes("अस्पताल")
  ) {
    try {
      const hospData = await realDataTools.findNearbyHospitals({
        district: matchedDistrict,
        lat: options.userLocation?.lat,
        lng: options.userLocation?.lng,
      });
      if (hospData.hospitals && hospData.hospitals.length > 0) {
        const listStr = hospData.hospitals
          .map(
            (h, i) =>
              `${i + 1}. **${h.name}**${h.distanceKm !== undefined ? ` (${h.distanceKm} km away)` : ""}\n   📍 ${h.address}\n   📞 ${h.phone || "108 (Ambulance)"}\n   🛏️ Emergency Beds: ${h.availableBeds}/${h.totalBeds} | ICU: ${h.icuBeds}/${h.totalIcuBeds} | 💨 Oxygen: ${h.oxygenCylinders}`
          )
          .join("\n\n");
        return `🏥 **Assam Hospital Bed & Medical Availability (${matchedDistrict || "Nearest"})**:\n\n${listStr}\n\n🚑 **For immediate medical emergencies or ambulance dispatch, call 108.**`;
      }
    } catch {
      // ignore
    }
    return `🏥 For urgent hospital admission and ambulance dispatch in Assam, please dial **108** immediately. You can also view registered medical centers with live bed capacity in the Hospital Portal.`;
  }

  // 5. Relief Shelters & Camps
  if (
    normalized.includes("shelter") ||
    normalized.includes("relief camp") ||
    normalized.includes("camp") ||
    normalized.includes("evacuation") ||
    normalized.includes("আশ্ৰয়") ||
    normalized.includes("আশ্রয়") ||
    normalized.includes("राहत")
  ) {
    try {
      const shelterData = await realDataTools.getReliefShelters({ district: matchedDistrict });
      if (shelterData.shelters && shelterData.shelters.length > 0) {
        const listStr = shelterData.shelters
          .map(
            (s, i) =>
              `${i + 1}. **${s.name}**\n   📍 ${s.address}\n   👥 Capacity: ${s.capacity} | Current Occupancy: ${s.currentOccupancy}`
          )
          .join("\n\n");
        return `⛺ **Active Flood Relief Shelters (${matchedDistrict})**:\n\n${listStr}\n\n📞 For official relief camp allocation, contact District Disaster Control Room at **1077**.`;
      }
    } catch {
      // ignore
    }
    return `⛺ Active flood relief camps and evacuation centers are set up in schools, college grounds, and higher elevation buildings. Contact DEOC at **1077** or ASDMA at **1070** for the nearest designated camp.`;
  }

  // 6. Emergency Helplines & Contacts
  if (
    normalized.includes("helpline") ||
    normalized.includes("emergency number") ||
    normalized.includes("contact") ||
    normalized.includes("phone") ||
    normalized.includes("call") ||
    normalized.includes("112") ||
    normalized.includes("1070") ||
    normalized.includes("sdrf") ||
    normalized.includes("ndrf")
  ) {
    return `📞 **Official Assam Emergency Helplines**:
• **National Emergency**: 112
• **Assam State Emergency Operations Centre (SEOC)**: 1070 / 0361-2237011
• **District Emergency Operations Centre (DEOC)**: 1077
• **Ambulance Service**: 108
• **Police Control Room**: 100
• **Fire & Emergency Services**: 101
• **SDRF Assam Control Room**: 0361-2800557 / 94350-00108
• **NDRF 1st Bn Guwahati**: 0361-2849005 / 94359-62222
• **Child Helpline**: 1098
• **Women Helpline**: 181`;
  }

  // 7. General Flood Safety & First Aid
  return `🚨 **Assam Flood Safety & Emergency Guidance**:
1. **Immediate Danger**: Move to higher ground immediately. Do NOT walk, swim, or drive through moving floodwaters.
2. **One-Tap SOS**: Tap the red circular SOS button on the home screen to send your GPS coordinates to SDRF/NDRF.
3. **Emergency Numbers**: Call **112** (National Emergency), **1070** (State Disaster Control), or **108** (Ambulance).
4. **Clean Water & Food**: Boil all drinking water and keep emergency dry rations in a waterproof bag.
5. **Electrical Safety**: Turn off main electrical switches before water enters your dwelling.`;
}

/**
 * Executes a chat query through Gemini SDK with real-data function calling and safety fallbacks.
 */
export async function generateSahayakResponse(options: GenerateChatResponseOptions): Promise<ChatResponseResult> {
  const conversationId = options.conversationId || `conv-${Date.now()}`;

  // Backend keyword & scope pre-filter:
  // If the message is off-topic (not disaster, weather, river, emergency, or app feature related),
  // immediately return the redirect message without calling external APIs.
  if (!isDisasterRelatedMessage(options.message)) {
    return {
      reply: getSahayakRedirectMessage(options.language),
      conversationId,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const systemInstruction = buildSahayakSystemInstruction(options.language);

  // If no API key is provided or placeholder, execute smart local offline engine
  if (!apiKey || apiKey.trim() === "" || apiKey === "replace-with-valid-gemini-api-key") {
    const offlineReply = await generateSmartOfflineResponse(options);
    return {
      reply: offlineReply,
      conversationId,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    // Format chat history into contents array for Gemini
    const contents: any[] = [];

    if (options.history && Array.isArray(options.history)) {
      for (const msg of options.history.slice(-6)) {
        if (msg.role === "user") {
          contents.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.role === "assistant") {
          contents.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    // Add current user message
    contents.push({ role: "user", parts: [{ text: options.message }] });

    const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    // Step 1: Initial call with function calling tools
    const response: any = await fetchWithRetry(() => ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: geminiFunctionDeclarations }],
      },
    }));

    const candidates = response.candidates;
    const firstCandidate = candidates?.[0];
    const functionCalls = firstCandidate?.content?.parts?.filter((p: any) => p.functionCall) as any[];

    // If Gemini requested tool execution, run tool and perform second turn
    if (functionCalls && functionCalls.length > 0) {
      const toolCall = functionCalls[0].functionCall;
      const functionName = toolCall.name;
      const functionArgs = toolCall.args || {};

      let toolResult: any = { error: "Unknown tool" };
      if (functionName === "getCurrentWeatherAndFloodRisk") {
        toolResult = await realDataTools.getCurrentWeatherAndFloodRisk(functionArgs);
      } else if (functionName === "findNearbyHospitals") {
        const toolLat = typeof functionArgs.lat === "number" ? functionArgs.lat : options.userLocation?.lat;
        const toolLng = typeof functionArgs.lng === "number" ? functionArgs.lng : options.userLocation?.lng;
        toolResult = await realDataTools.findNearbyHospitals({
          ...functionArgs,
          lat: toolLat,
          lng: toolLng,
        });
      } else if (functionName === "getReliefShelters") {
        toolResult = await realDataTools.getReliefShelters(functionArgs);
      } else if (functionName === "getEmergencyHelplines") {
        toolResult = await realDataTools.getEmergencyHelplines();
      } else if (functionName === "getPlatformAssistanceGuide") {
        toolResult = await realDataTools.getPlatformAssistanceGuide(functionArgs);
      }

      // Second turn with tool result
      const toolTurnContents = [
        ...contents,
        firstCandidate?.content,
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: functionName,
                response: toolResult,
              },
            },
          ],
        },
      ];

      const secondResponse: any = await fetchWithRetry(() => ai.models.generateContent({
        model: modelName,
        contents: toolTurnContents,
        config: {
          systemInstruction,
        },
      }));

      const replyText = secondResponse.text || "I have retrieved the emergency information for your request.";
      return { reply: replyText.trim(), conversationId };
    }

    const directText = response.text;
    if (directText && directText.trim().length > 0) {
      return { reply: directText.trim(), conversationId };
    }

    return {
      reply: "I am here to assist with flood emergencies, river levels, weather updates, nearby hospitals, relief shelters, and app features. How can I help you right now?",
      conversationId,
    };
  } catch (err: any) {
    // When API errors occur (quota exhaustion 429, timeout, network failure),
    // seamlessly provide real-data answers through our smart offline response engine.
    console.warn("[Sahayak AI] Gemini API unavailable or rate-limited. Falling back to local smart engine:", err?.message || err);
    try {
      const smartFallback = await generateSmartOfflineResponse(options);
      return {
        reply: smartFallback,
        conversationId,
      };
    } catch {
      return {
        reply: getSahayakFallbackMessage(options.language),
        conversationId,
      };
    }
  }
}
