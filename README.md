SAHAY --- Rescue & Emergency Response Platform
Technical Overview
SAHAY is a multi-role emergency and flood-rescue platform connecting citizens, rescuers, administrators/command centre, and hospitals through a real-time rescue workflow.
Core Technical Capabilities
Citizen emergency/SOS creation
GPS/location capture and validation
Rescuer discovery, offers, acceptance and mission tracking
Command-centre/admin workflow
Hospital management/integration
Notifications
Live map integration
Voice-note capture during SOS
Mission chat and voice-note playback
Offline-first distress communication
Flood-aware routing
Spatial SOS clustering
Automated notification workflows
Multilingual voice/SMS accessibility
Architecture
Citizen / Android / Web
        |
        v
Frontend Application
        |
        v
API / tRPC Rescue Layer
        |
        +--------------------+
        |                    |
        v                    v
   Database             Object Storage
        |                    |
        |              Voice-note files
        |
        +-----------> Rescue / Responder Logic
                         |
                         +--> Rescuer Portal
                         +--> Command Centre
                         +--> Hospital Workflow
Technology Stack
Frontend
React
TypeScript
Vite
Leaflet-based map architecture
Capacitor Android application
Web APIs / MediaRecorder for voice capture
Backend
Node.js
TypeScript
tRPC
Rescue procedures in server/routers/rescue.ts
Health endpoint: /health
Environment-based configuration
Database
SQL database with relational entities for incidents, users, responders and operational workflows
Connection pool protection
connectionLimit: 10
idleTimeout: 60000
connectTimeout: 15000
Storage
Voice recordings can be persisted through:
S3-compatible storage
Forge storage
Local /uploads/ fallback
Storage configuration is optional; missing object-storage credentials fall back to local uploads without crashing the server.
Mobile
Capacitor
Android WebView
Native runtime microphone permission handling
Android-safe API URL resolution using getApiUrl()
Maps & Geospatial Processing
Leaflet
OpenStreetMap ecosystem
PostGIS for spatial data in the planned/deployment architecture
OSMnx + NetworkX for flood-aware routing
DBSCAN + PostGIS for spatial SOS clustering
Automation
n8n
Asynchronous triggers
Alert workflows
WhatsApp SOS notifications
SMS broadcast workflows
Deployment / DevOps
Docker
Render Cloud Services
GitHub
GitHub Actions
Production health checks
Environment variables for deployment configuration
Authentication & Authorization
Authentication follows a server-authoritative role model.
Authenticate
    |
    v
Identify trusted account role
    |
    v
Check account status
    |
    +--> ACTIVE
    +--> PENDING
    +--> REJECTED
    +--> SUSPENDED
    |
    v
Authorize requested portal/procedure
Portal routing:
USER                  -> User Portal
ADMIN                 -> Admin / Command Centre
HOSPITAL + ACTIVE     -> Hospital Portal
RESCUER + ACTIVE      -> Rescuer Portal
HOSPITAL + PENDING    -> Awaiting Admin Approval
RESCUER + PENDING     -> Awaiting Admin Approval
REJECTED / SUSPENDED  -> Access Denied
Frontend-supplied roles are not trusted for authorization.
SOS / Emergency Flow
Citizen
  |
  v
Create SOS
  |
  v
Capture + validate location
  |
  v
Backend receives emergency
  |
  v
Persist incident
  |
  v
Matching / assignment logic
  |
  v
Rescuer receives offer
  |
  v
Rescuer accepts
  |
  v
Live location + status updates
  |
  v
Rescue completed
  |
  v
Final state persisted
  |
  v
Citizen / Command Centre receives final state
Critical rescue operations must use real API calls and real persistence rather than frontend-only state or mock data.
Voice Note Pipeline
VoiceNoteCard
      |
      v
Microphone Permission Check
      |
      +---- denied ----> Non-blocking notice
      |                    |
      |                    +--> SOS continues
      |
      v
MediaRecorder
      |
      v
Audio Data URL / Base64
      |
      v
rescue.emergency.create
      |
      v
Storage Upload
      |
      v
voiceNoteUrl + duration
      |
      v
Incident Database Record
      |
      v
Responder activeOffer()
      |
      v
EmergencyOfferCard
      |
      v
RescuerMissionCard
Supported recording formats include:
audio/webm
audio/mp4
audio/aac
audio/ogg
The SOS remains functional when microphone permission is denied or an audio recording is invalid/corrupt.
Android playback uses getApiUrl() to resolve backend media URLs correctly inside the Capacitor WebView.
Responder Workflow
The responder dashboard retrieves active offers from the backend.
The backend prevents stale emergency offers by checking that the incident creation time is within the responder session window.
After acceptance:
Mission state is maintained
Location/status updates propagate
Voice notes remain playable
Mission chat can retain the voice note
Rescue completion is persisted
Flood-Aware Routing
The proposed geospatial routing pipeline uses:
Flooded Road Data
       |
       v
OpenStreetMap / OSMnx
       |
       v
NetworkX Graph
       |
       v
Remove / Block Flooded Segments
       |
       v
Calculate Safer Route
Spatial SOS Clustering
Nearby SOS reports can be clustered to reduce duplicate emergency reports.
SOS Signals
    |
    v
PostGIS Spatial Data
    |
    v
DBSCAN Clustering
    |
    v
Grouped Emergency Events
    |
    v
Human Verification
    |
    v
Rescue Dispatch
Offline / Fallback Communication
The system architecture includes fallback communication for network-degraded environments.
Internet / 4G / 5G
        |
        +--> Normal API workflow
        |
        X
        |
        v
SMS fallback / short-code communication
The platform is designed for offline and extreme-disaster scenarios where conventional cellular connectivity may be unreliable.
Notifications & Automation
n8n is used for asynchronous workflows such as:
SOS alerts
WhatsApp notifications
SMS broadcasts
Event-triggered automation
External notification workflows
Render Production Safety
Production safeguards include:
No boot-time database seeding
Protected database connection pool
Optional S3/R2 configuration
Local storage fallback
Environment-based port binding
Lightweight /health database check
Degraded 503 health response instead of server crash
Git / Branch Safety
The stable main branch is treated as the production baseline.
Development workflow:
main
 |
 +--> Feature branch
       |
       +--> Local implementation
       +--> Tests
       +--> Commit
       +--> Review / PR
       +--> Merge to main
       |
       v
     Render
       |
       v
   Android APK rebuild when required
Experimental architecture changes should not be merged wholesale into the frozen main architecture. Changes are integrated selectively after inspection and validation.
Validation
Current technical validation documented for the stabilized implementation:
Git safety: PASS
Frozen core architecture protection: PASS
TypeScript typecheck: PASS
Targeted tests: 23/23 PASS
Web production build: PASS
Voice-note end-to-end flow: PASS
Render safety: PASS
Android Capacitor sync: PASS
Android debug APK build: blocked by missing Android SDK on the validation host
Full test suite: 488/506 passed, with the documented failures identified as pre-existing/live-database divergence rather than introduced regressions
Key Technical Files
client/
  src/
    components/
      EmergencyOfferCard.tsx
      Map.tsx
    pages/
      Responder.tsx
      user/
        UserResponder.tsx

server/
  routers/
    rescue.ts
  _core/
    index.ts
Environment Configuration
Production configuration is environment-variable driven.
Typical infrastructure configuration includes:
DATABASE_URL
PORT
S3 / R2 credentials
API configuration
External notification credentials
Secrets must remain outside source control.
Technical Design Goals
Real API-backed emergency workflows
Persistent critical rescue state
Server-side authorization
Resilient SOS creation
Offline/fallback communication
Geospatial rescue coordination
Real-time operational visibility
Fault-tolerant media handling
Production-safe deployment
Android + web support
Automated notification workflows
Status
The stabilized implementation has been validated across the documented frontend, backend, SOS, responder, voice-note, deployment and safety workflows. Production readiness remains dependent on environment configuration, real-device validation, external integrations and end-to-end operational testing.