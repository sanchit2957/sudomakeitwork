import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getApiUrl } from "@/lib/apiConfig";
import { currentInterfaceTerms } from "./currentInterfaceTerms";

export type Locale = "en" | "as" | "hi" | "bn" | "or" | "mr" | "gu" | "ta" | "te" | "kn";

export const localeOptions: Array<{ code: Locale; label: string; nativeLabel: string }> = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "as", label: "Assamese", nativeLabel: "অসমীয়া" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { code: "or", label: "Odia", nativeLabel: "ଓଡ଼ିଆ" },
  { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
  { code: "gu", label: "Gujarati", nativeLabel: "ગુજરાતી" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
];

const storageKey = "sahay-language";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const universalTerms: Record<string, Partial<Record<Locale, string>>> = {
  "general.new": { en: "NEW", as: "নতুন", hi: "नया", bn: "নতুন", or: "ନୂତନ", mr: "नवीन", gu: "નવું", ta: "புதியது", te: "కొత్త", kn: "ಹೊಸ" },
};

export const messages: Record<Locale, Record<string, string>> = {
  en: {
    "language.label": "Language",
    "language.english": "English",
    "language.assamese": "Assamese",
    "language.hindi": "Hindi",
    "brand.network": "Sahay emergency network",
    "general.sos": "SOS",
    "general.safetyHub": "Safety hub",
    "general.connected": "Connected",
    "general.offline": "Offline mode",
    "general.live": "Live",
    "general.back": "Back",
    "general.new": "NEW",
    "general.optional": "optional",
    "home.ready": "Ready when every second matters",
    "home.heading": "One tap for help.",
    "home.headingAccent": "One team behind you.",
    "home.intro": "A clear rescue path for people in danger, field responders, and emergency coordinators. No searching through menus when you need help.",
    "home.sendSos": "Send SOS now",
    "home.offlineNote": "Your phone can save a report when offline and send it when you reconnect.",
    "home.chooseRole": "Choose the role that fits now",
    "home.needHelp": "I need help",
    "home.needHelpCopy": "Report an SOS in a few visual steps.",
    "home.responder": "I am a responder",
    "home.responderCopy": "See assignments and set readiness.",
    "home.coordinate": "I coordinate rescue",
    "home.coordinateCopy": "Open the command centre.",
    "home.track": "Track",
    "home.trackCopy": "My request",
    "home.rescue": "Rescue",
    "home.rescueCopy": "Field team",
    "home.command": "Command",
    "home.commandCopy": "Coordinate",
    "home.panic": "Panic-mode SOS",
    "home.panicCopy": "Image-led choices, big controls, location first, and optional details only when you can provide them.",
    "home.field": "Field-ready response",
    "home.fieldCopy": "One secured workspace for missions, availability, alerts, and required status updates.",
    "home.capacity": "Capacity in view",
    "home.capacityCopy": "Coordinate SOS cases, relief shelters, hospitals, beds, and critical medical stock from command.",
    "emergency.help": "Emergency help",
    "emergency.choose": "Choose what is happening.",
    "emergency.pictureHint": "Start with the picture that fits. Details can wait.",
    "emergency.flood": "Flood / water",
    "emergency.medical": "Medical help",
    "emergency.shelter": "Need safe place",
    "emergency.stepLocation": "Step 2",
    "emergency.shareLocation": "Share your location",
    "emergency.gpsHint": "Only use GPS if it is safe. You can add a landmark below.",
    "emergency.shareMyLocation": "Share my location",
    "emergency.locationMissing": "Location not shared yet",
    "emergency.stepPeople": "Step 3",
    "emergency.people": "How many people?",
    "emergency.moreDetails": "More details (optional)",
    "emergency.landmark": "Landmark or address",
    "emergency.landmarkPlaceholder": "Village, road, building, or nearby landmark",
    "emergency.contact": "Name or family identifier",
    "emergency.importantDetail": "Important detail",
    "emergency.detailPlaceholder": "For example: roof access, child present, injury…",
    "emergency.photo": "Photo (optional)",
    "emergency.addPhoto": "Add a photo",
    "emergency.send": "Send SOS now",
    "emergency.saveOffline": "Save SOS until signal returns",
    "emergency.offlineWarning": "Offline SOS stays on this device until this app can reconnect. It cannot reach the control centre without any network connection.",
    "emergency.delivered": "Saved SOS delivered. Open tracking reference",
    "emergency.gpsUnavailable": "Location sharing is unavailable. Open More details and enter a landmark or map point.",
    "emergency.finding": "Finding your location…",
    "emergency.gpsShared": "GPS location shared from this phone",
    "emergency.locationReady": "Location shared. You can send SOS now.",
    "emergency.gpsFailure": "We could not get location. Open More details and use a map pin or landmark.",
    "emergency.fileError": "Use a PNG, JPEG, or WebP image smaller than 1.5 MB.",
    "emergency.locationRequired": "First, share your location so help can find you.",
    "emergency.savedOffline": "SOS saved on this phone. We will send it as soon as this app reconnects.",
    "emergency.signalLost": "Signal was lost. SOS saved on this phone and will send when the app reconnects.",
    "emergency.sendFailure": "We could not send right now. Keep this page open or try again when signal returns.",
    "emergency.mapPin": "Map pin near",
    "emergency.outbox": "{count} SOS request(s) saved on this phone.",
    "emergency.outboxHint": "It will send automatically when this app reconnects.",
    "emergency.sending": "Sending SOS…",
    "track.private": "Private SOS",
    "track.heading": "Where is my rescue?",
    "track.intro": "Enter the private SOS code. This page refreshes itself while a team works on your request.",
    "track.code": "Private SOS code",
    "track.see": "See",
    "track.checking": "Checking the latest update…",
    "track.yourSos": "Your SOS",
    "track.liveCheck": "Live check",
    "track.now": "Now",
    "track.seen": "Seen",
    "track.moving": "Moving",
    "track.done": "Done",
    "track.pending": "Your SOS is with the control team",
    "track.dispatched": "A rescue team is being deployed",
    "track.resolved": "The team has recorded this mission complete",
    "track.safetyNote": "This is the last recorded control-centre status. Keep following local safety guidance while you wait.",
    "responder.workspace": "Rescuer operations",
    "responder.role": "Field responder",
    "responder.missions": "My missions",
    "responder.map": "Field map",
    "responder.hospitals": "Nearby hospitals",
    "responder.alerts": "Alerts",
    "responder.readiness": "Field readiness",
    "responder.available": "Available",
    "responder.onMission": "On mission",
    "responder.offDuty": "Off duty",
    "responder.updating": "Updating…",
    "responder.board": "My mission board",
    "responder.boardTitle": "Work each mission through its required sequence.",
    "responder.dispatched": "Mark dispatched",
    "responder.resolved": "Mark resolved",
    "responder.completed": "Completed",
    "responder.assignmentAlerts": "Allow alerts",
    "responder.enableAlerts": "Enable browser alerts",
    "responder.profilePending": "Rescuer profile pending",
    "responder.readinessCopy": "Updates stay live while this workspace is open. Set availability before deploying and share GPS only when safe.",
    "responder.mapTitle": "See active conditions in your response area.",
    "responder.people": "people",
    "responder.priority": "priority",
    "responder.noMission": "No mission has been assigned to this account. Keep your availability current so dispatchers can find you.",
    "responder.alertCopy": "Register this device to receive mission assignments and nearby priority SOS alerts even when Sahay is not open.",
    "responder.retryAlerts": "Retry browser alert registration",
    "responder.missionAlerts": "Mission alerts",
    "responder.operationalNotifications": "Operational notifications",
    "responder.noAlerts": "No current alerts. Mission notifications will appear here.",
    "command.workspace": "Administrator command centre",
    "command.role": "Emergency coordination",
    "command.operations": "Operations board",
    "command.map": "Live map",
    "command.shelters": "Shelters",
    "command.hospitals": "Hospitals & resources",
    "command.postRescueRecords": "Post rescue records",
    "command.requests": "Rescuer requests",
    "command.team": "Team roster",
    "command.overview": "National · operational overview",
    "command.heading": "Triage with confidence.",
    "command.liveFeed": "Live operational feed",
    "command.incidents": "Incident feed",
    "command.openCoordination": "Open rescue coordination",
    "command.search": "Search code or location",
    "command.allCases": "All cases",
    "command.pending": "Pending",
    "command.dispatched": "Dispatched",
    "command.resolved": "Resolved",
    "dashboard.secureAccess": "Secure access",
    "dashboard.signIn": "Sign in to open",
    "dashboard.continue": "Continue securely",
    "dashboard.signOut": "Sign out",
    "dashboard.liveWorkspace": "Live operations workspace",
  },
  as: {
    "language.label": "ভাষা",
    "language.english": "ইংৰাজী",
    "language.assamese": "অসমীয়া",
    "language.hindi": "হিন্দী",
    "brand.network": "অসম জৰুৰী নেটৱৰ্ক",
    "general.sos": "SOS",
    "general.safetyHub": "সুৰক্ষা কেন্দ্ৰ",
    "general.connected": "সংযুক্ত",
    "general.offline": "অফলাইন মোড",
    "general.live": "লাইভ",
    "general.back": "পিছলৈ",
    "general.new": "নতুন",
    "general.optional": "ঐচ্ছিক",
    "home.ready": "প্ৰতিটো ছেকেণ্ড গুৰুত্বপূৰ্ণ হ’লে সাজু",
    "home.heading": "সহায়ৰ বাবে এটা টেপ।",
    "home.headingAccent": "আপোনাৰ পিছত এটা দল।",
    "home.intro": "বিপদত থকা লোক, ক্ষেত্ৰ প্ৰতিসঁহাৰকাৰী আৰু জৰুৰী সমন্বয়কৰ বাবে স্পষ্ট উদ্ধাৰ পথ। সহায়ৰ প্ৰয়োজনত মেনু বিচাৰি সময় নষ্ট কৰিব নালাগে।",
    "home.sendSos": "এতিয়াই SOS পঠিয়াওক",
    "home.offlineNote": "অফলাইনত আপোনাৰ ফোনে অনুৰোধ সাঁচি ৰাখে আৰু পুনৰ সংযোগ পালে পঠিয়ায়।",
    "home.chooseRole": "এতিয়া আপোনাৰ ভূমিকা বাছক",
    "home.needHelp": "মোৰ সহায় লাগে",
    "home.needHelpCopy": "কেইটামান দৃশ্যভিত্তিক ধাপত SOS পঠিয়াওক।",
    "home.responder": "মই প্ৰতিসঁহাৰকাৰী",
    "home.responderCopy": "দায়িত্ব চাওক আৰু সাজু অৱস্থা ঠিক কৰক।",
    "home.coordinate": "মই উদ্ধাৰ সমন্বয় কৰোঁ",
    "home.coordinateCopy": "কমান্ড কেন্দ্ৰ খোলক।",
    "home.track": "খবৰ লওক",
    "home.trackCopy": "মোৰ অনুৰোধ",
    "home.rescue": "উদ্ধাৰ",
    "home.rescueCopy": "ক্ষেত্ৰ দল",
    "home.command": "কমান্ড",
    "home.commandCopy": "সমন্বয়",
    "home.panic": "তাৎক্ষণিক SOS",
    "home.panicCopy": "ছবিভিত্তিক পছন্দ, ডাঙৰ নিয়ন্ত্ৰণ, প্ৰথমে অৱস্থান, আৰু পাৰিলে ঐচ্ছিক বিৱৰণ।",
    "home.field": "ক্ষেত্ৰ-সাজু সঁহাৰি",
    "home.fieldCopy": "অভিযান, উপলব্ধতা, সতৰ্কবাণী আৰু অৱস্থা আপডেটৰ বাবে সুৰক্ষিত স্থান।",
    "home.capacity": "সম্পদৰ অৱস্থা",
    "home.capacityCopy": "কমান্ডৰ পৰা SOS, আশ্ৰয়, চিকিৎসালয়, বিছনা আৰু জৰুৰী চিকিৎসা মজুত সমন্বয় কৰক।",
    "emergency.help": "জৰুৰী সহায়",
    "emergency.choose": "কি ঘটিছে বাছক।",
    "emergency.pictureHint": "মিল থকা ছবিখন বাছক। বিৱৰণ পিছত দিব পাৰিব।",
    "emergency.flood": "বান / পানী",
    "emergency.medical": "চিকিৎসা সহায়",
    "emergency.shelter": "নিৰাপদ ঠাই লাগে",
    "emergency.stepLocation": "ধাপ ২",
    "emergency.shareLocation": "আপোনাৰ অৱস্থান শ্বেয়াৰ কৰক",
    "emergency.gpsHint": "নিৰাপদ হ’লেহে GPS ব্যৱহাৰ কৰক। তলত চিহ্নিত ঠাই যোগ কৰিব পাৰিব।",
    "emergency.shareMyLocation": "মোৰ অৱস্থান শ্বেয়াৰ কৰক",
    "emergency.locationMissing": "এতিয়াও অৱস্থান শ্বেয়াৰ কৰা হোৱা নাই",
    "emergency.stepPeople": "ধাপ ৩",
    "emergency.people": "কিমানজন লোক?",
    "emergency.moreDetails": "অধিক বিৱৰণ (ঐচ্ছিক)",
    "emergency.landmark": "চিনাকি ঠাই বা ঠিকনা",
    "emergency.landmarkPlaceholder": "গাঁও, পথ, ঘৰ বা ওচৰৰ চিনাকি ঠাই",
    "emergency.contact": "নাম বা পৰিয়ালৰ চিনাক্তকৰণ",
    "emergency.importantDetail": "গুৰুত্বপূৰ্ণ বিৱৰণ",
    "emergency.detailPlaceholder": "উদাহৰণ: ছাদলৈ যোৱা, শিশু আছে, আঘাত…",
    "emergency.photo": "ফটো (ঐচ্ছিক)",
    "emergency.addPhoto": "ফটো যোগ কৰক",
    "emergency.send": "এতিয়াই SOS পঠিয়াওক",
    "emergency.saveOffline": "সংযোগ ঘূৰি নাহালৈ SOS সাঁচক",
    "emergency.offlineWarning": "অফলাইন SOS এই ডিভাইচতেই সাঁচি থাকে। নেটৱৰ্ক নাথাকিলে ই নিয়ন্ত্ৰণ কেন্দ্ৰত পঠিয়াব নোৱাৰে।",
    "emergency.delivered": "সাঁচি ৰখা SOS পঠিওৱা হ’ল। ট্ৰেকিং নম্বৰ খোলক",
    "emergency.gpsUnavailable": "অৱস্থান শ্বেয়াৰ সুবিধা উপলব্ধ নহয়। অধিক বিৱৰণ খুলি চিনাকি ঠাই বা মানচিত্ৰ বিন্দু দিয়ক।",
    "emergency.finding": "আপোনাৰ অৱস্থান বিচৰা হৈছে…",
    "emergency.gpsShared": "এই ফোনৰ পৰা GPS অৱস্থান শ্বেয়াৰ কৰা হৈছে",
    "emergency.locationReady": "অৱস্থান শ্বেয়াৰ কৰা হ’ল। এতিয়া SOS পঠিয়াব পাৰে।",
    "emergency.gpsFailure": "অৱস্থান পোৱা নগ’ল। অধিক বিৱৰণ খুলি মানচিত্ৰ বিন্দু বা চিনাকি ঠাই ব্যৱহাৰ কৰক।",
    "emergency.fileError": "1.5 MB-তকৈ সৰু PNG, JPEG, বা WebP ছবি ব্যৱহাৰ কৰক।",
    "emergency.locationRequired": "প্ৰথমে অৱস্থান শ্বেয়াৰ কৰক যাতে সহায় আপোনাক বিচাৰি পায়।",
    "emergency.savedOffline": "SOS এই ফোনত সাঁচি ৰখা হ’ল। পুনৰ সংযোগ হ’লেই পঠিওৱা হ’ব।",
    "emergency.signalLost": "সংকেত হেৰাইছে। SOS এই ফোনত সাঁচি ৰখা হ’ল আৰু সংযোগ ঘূৰি আহিলে পঠিওৱা হ’ব।",
    "emergency.sendFailure": "এতিয়া পঠিয়াব নোৱাৰিলে। পৃষ্ঠা খোলা ৰাখক বা সংকেত ঘূৰি আহিলে আকৌ চেষ্টা কৰক।",
    "emergency.mapPin": "মানচিত্ৰ বিন্দু ওচৰত",
    "emergency.outbox": "এই ফোনত {count}টা SOS অনুৰোধ সাঁচি ৰখা আছে।",
    "emergency.outboxHint": "এই এপ পুনৰ সংযোগ হ’লে স্বয়ংক্ৰিয়ভাৱে পঠিওৱা হ’ব।",
    "emergency.sending": "SOS পঠোৱা হৈছে…",
    "track.private": "ব্যক্তিগত SOS",
    "track.heading": "মোৰ উদ্ধাৰ ক’ত?",
    "track.intro": "ব্যক্তিগত SOS কোড দিয়ক। দলটোৱে কাম কৰাৰ সময়ত এই পৃষ্ঠাই নিজে আপডেট হয়।",
    "track.code": "ব্যক্তিগত SOS কোড",
    "track.see": "চাওক",
    "track.checking": "সৰ্বশেষ আপডেট পৰীক্ষা কৰা হৈছে…",
    "track.yourSos": "আপোনাৰ SOS",
    "track.liveCheck": "লাইভ পৰীক্ষা",
    "track.now": "এতিয়া",
    "track.seen": "দেখা হৈছে",
    "track.moving": "যাত্ৰাত",
    "track.done": "সম্পূৰ্ণ",
    "track.pending": "আপোনাৰ SOS নিয়ন্ত্ৰণ দলৰ ওচৰত আছে",
    "track.dispatched": "এটা উদ্ধাৰ দল পঠোৱা হৈছে",
    "track.resolved": "দলটোৱে এই অভিযান সম্পূৰ্ণ বুলি নথিভুক্ত কৰিছে",
    "track.safetyNote": "এইটো নিয়ন্ত্ৰণ কেন্দ্ৰৰ সৰ্বশেষ অৱস্থা। অপেক্ষাৰ সময়ত স্থানীয় সুৰক্ষা নিৰ্দেশনা মানি চলক।",
    "responder.workspace": "উদ্ধাৰকৰ্মী কাৰ্যকলাপ",
    "responder.role": "ক্ষেত্ৰ প্ৰতিসঁহাৰকাৰী",
    "responder.missions": "মোৰ অভিযানসমূহ",
    "responder.map": "ক্ষেত্ৰ মানচিত্ৰ",
    "responder.alerts": "সতৰ্কবাণীসমূহ",
    "responder.readiness": "ক্ষেত্ৰৰ প্ৰস্তুতি",
    "responder.available": "উপলব্ধ",
    "responder.onMission": "অভিযানত",
    "responder.offDuty": "কৰ্তব্যৰ বাহিৰত",
    "responder.updating": "আপডেট হৈ আছে…",
    "responder.board": "মোৰ অভিযান ফলক",
    "responder.boardTitle": "প্ৰতিটো অভিযানৰ প্ৰয়োজনীয় ধাপ সম্পূৰ্ণ কৰক।",
    "responder.dispatched": "পঠোৱা হৈছে বুলি চিহ্নিত কৰক",
    "responder.resolved": "সমাধান হোৱা বুলি চিহ্নিত কৰক",
    "responder.completed": "সম্পূৰ্ণ",
    "responder.assignmentAlerts": "সতৰ্কবাণী অনুমতি দিয়ক",
    "responder.enableAlerts": "ব্ৰাউজাৰ সতৰ্কবাণী সক্ৰিয় কৰক",
    "responder.profilePending": "উদ্ধাৰকৰ্মীৰ প্ৰফাইল অপেক্ষাৰত",
    "responder.readinessCopy": "এই কৰ্মক্ষেত্ৰ খোলা থাকিলে আপডেট লাইভ থাকে। মোতায়েনৰ আগতে উপলব্ধতা ঠিক কৰক আৰু নিৰাপদ হ’লেহে GPS শ্বেয়াৰ কৰক।",
    "responder.mapTitle": "আপোনাৰ সঁহাৰি অঞ্চলৰ সক্ৰিয় অৱস্থা চাওক।",
    "responder.people": "লোক",
    "responder.priority": "অগ্ৰাধিকাৰ",
    "responder.noMission": "এই একাউণ্টত কোনো অভিযান নিযুক্ত কৰা হোৱা নাই। ডিছপেচাৰে আপোনাক বিচাৰি পাবলৈ আপোনাৰ উপলব্ধতা সঠিক ৰাখক।",
    "responder.alertCopy": "Sahay খোলা নাথাকিলেও অভিযান দায়িত্ব আৰু ওচৰৰ অগ্ৰাধিকাৰ SOS সতৰ্কবাণী পাবলৈ এই ডিভাইচ পঞ্জীয়ন কৰক।",
    "responder.retryAlerts": "ব্ৰাউজাৰ সতৰ্কবাণী পঞ্জীয়ন পুনৰ চেষ্টা কৰক",
    "responder.missionAlerts": "অভিযান সতৰ্কবাণী",
    "responder.operationalNotifications": "কাৰ্যকৰী অধিসূচনা",
    "responder.noAlerts": "বৰ্তমান কোনো সতৰ্কবাণী নাই। অভিযান অধিসূচনা ইয়াত দেখা যাব।",
    "command.workspace": "প্ৰশাসক কমাণ্ড কেন্দ্ৰ",
    "command.role": "জৰুৰী সমন্বয়",
    "command.operations": "কাৰ্যকলাপ ফলক",
    "command.map": "লাইভ মানচিত্ৰ",
    "command.shelters": "আশ্ৰয়সমূহ",
    "command.hospitals": "চিকিৎসালয় আৰু সম্পদ",
    "command.requests": "উদ্ধাৰকৰ্মী অনুৰোধসমূহ",
    "command.team": "দলৰ তালিকা",
    "command.overview": "অসম · কাৰ্যকৰী অৱলোকন",
    "command.heading": "আত্মবিশ্বাসেৰে অগ্ৰাধিকাৰ দিয়ক।",
    "command.liveFeed": "লাইভ কাৰ্যকৰী ফিড",
    "command.incidents": "ঘটনা ফিড",
    "command.openCoordination": "চলিত উদ্ধাৰ সমন্বয়",
    "command.search": "কোড বা অৱস্থান বিচাৰক",
    "command.allCases": "সকলো ঘটনা",
    "command.pending": "অপেক্ষাৰত",
    "command.dispatched": "পঠিওৱা হৈছে",
    "command.resolved": "সমাধান",
    "dashboard.secureAccess": "সুৰক্ষিত প্ৰৱেশ",
    "dashboard.signIn": "খোলিবলৈ ছাইন ইন কৰক",
    "dashboard.continue": "সুৰক্ষিতভাৱে আগবাঢ়ক",
    "dashboard.signOut": "ছাইন আউট",
    "dashboard.liveWorkspace": "লাইভ কাৰ্যকলাপ কৰ্মক্ষেত্ৰ",
  },
  hi: {
    "language.label": "भाषा",
    "language.english": "अंग्रेज़ी",
    "language.assamese": "असमिया",
    "language.hindi": "हिन्दी",
    "brand.network": "असम आपातकालीन नेटवर्क",
    "general.sos": "SOS",
    "general.safetyHub": "सुरक्षा केंद्र",
    "general.connected": "कनेक्टेड",
    "general.offline": "ऑफ़लाइन मोड",
    "general.live": "लाइव",
    "general.back": "वापस",
    "general.new": "नया",
    "general.optional": "वैकल्पिक",
    "home.ready": "जब हर सेकंड मायने रखता है, तब तैयार",
    "home.heading": "मदद के लिए एक टैप।",
    "home.headingAccent": "आपके पीछे एक टीम।",
    "home.intro": "खतरे में लोगों, फील्ड रिस्पॉन्डर और आपात समन्वयकों के लिए स्पष्ट बचाव मार्ग। मदद चाहिए तो मेनू में खोजने की जरूरत नहीं।",
    "home.sendSos": "अभी SOS भेजें",
    "home.offlineNote": "ऑफ़लाइन होने पर आपका फ़ोन अनुरोध सहेज सकता है और दोबारा कनेक्ट होने पर भेज सकता है।",
    "home.chooseRole": "अभी अपनी भूमिका चुनें",
    "home.needHelp": "मुझे मदद चाहिए",
    "home.needHelpCopy": "कुछ दृश्य चरणों में SOS भेजें।",
    "home.responder": "मैं रिस्पॉन्डर हूँ",
    "home.responderCopy": "असाइनमेंट देखें और तैयारी सेट करें।",
    "home.coordinate": "मैं बचाव समन्वयित करता हूँ",
    "home.coordinateCopy": "कमांड केंद्र खोलें।",
    "home.track": "स्थिति देखें",
    "home.trackCopy": "मेरा अनुरोध",
    "home.rescue": "बचाव",
    "home.rescueCopy": "फील्ड टीम",
    "home.command": "कमांड",
    "home.commandCopy": "समन्वय",
    "home.panic": "पैनिक-मोड SOS",
    "home.panicCopy": "तस्वीर आधारित विकल्प, बड़े नियंत्रण, पहले स्थान और संभव होने पर ही वैकल्पिक विवरण।",
    "home.field": "फील्ड-रेडी प्रतिक्रिया",
    "home.fieldCopy": "मिशन, उपलब्धता, अलर्ट और आवश्यक स्थिति अपडेट के लिए सुरक्षित कार्यक्षेत्र।",
    "home.capacity": "क्षमता की जानकारी",
    "home.capacityCopy": "कमांड से SOS, राहत शिविर, अस्पताल, बिस्तर और महत्वपूर्ण चिकित्सा सामग्री का समन्वय करें।",
    "emergency.help": "आपातकालीन सहायता",
    "emergency.choose": "क्या हो रहा है, चुनें।",
    "emergency.pictureHint": "मिलने वाली तस्वीर चुनें। विवरण बाद में दिया जा सकता है।",
    "emergency.flood": "बाढ़ / पानी",
    "emergency.medical": "चिकित्सा सहायता",
    "emergency.shelter": "सुरक्षित जगह चाहिए",
    "emergency.stepLocation": "चरण 2",
    "emergency.shareLocation": "अपना स्थान साझा करें",
    "emergency.gpsHint": "GPS केवल तभी इस्तेमाल करें जब सुरक्षित हो। नीचे कोई पहचान-चिह्न जोड़ा जा सकता है।",
    "emergency.shareMyLocation": "मेरा स्थान साझा करें",
    "emergency.locationMissing": "स्थान अभी साझा नहीं किया गया है",
    "emergency.stepPeople": "चरण 3",
    "emergency.people": "कितने लोग हैं?",
    "emergency.moreDetails": "अधिक विवरण (वैकल्पिक)",
    "emergency.landmark": "पहचान-चिह्न या पता",
    "emergency.landmarkPlaceholder": "गांव, सड़क, इमारत या पास का पहचान-चिह्न",
    "emergency.contact": "नाम या परिवार की पहचान",
    "emergency.importantDetail": "महत्वपूर्ण विवरण",
    "emergency.detailPlaceholder": "उदाहरण: छत तक पहुंच, बच्चा मौजूद, चोट…",
    "emergency.photo": "फ़ोटो (वैकल्पिक)",
    "emergency.addPhoto": "फ़ोटो जोड़ें",
    "emergency.send": "अभी SOS भेजें",
    "emergency.saveOffline": "सिग्नल लौटने तक SOS सहेजें",
    "emergency.offlineWarning": "ऑफ़लाइन SOS इसी डिवाइस पर सहेजा रहता है। बिना नेटवर्क के यह नियंत्रण केंद्र तक नहीं पहुंच सकता।",
    "emergency.delivered": "सहेजा हुआ SOS पहुंच गया। ट्रैकिंग संदर्भ खोलें",
    "emergency.gpsUnavailable": "स्थान साझा करना उपलब्ध नहीं है। अधिक विवरण खोलें और पहचान-चिह्न या मानचित्र बिंदु दर्ज करें।",
    "emergency.finding": "आपका स्थान खोजा जा रहा है…",
    "emergency.gpsShared": "इस फ़ोन से GPS स्थान साझा किया गया",
    "emergency.locationReady": "स्थान साझा हो गया। अब SOS भेज सकते हैं।",
    "emergency.gpsFailure": "स्थान नहीं मिल सका। अधिक विवरण खोलें और मानचित्र बिंदु या पहचान-चिह्न इस्तेमाल करें।",
    "emergency.fileError": "1.5 MB से छोटी PNG, JPEG या WebP छवि इस्तेमाल करें।",
    "emergency.locationRequired": "पहले अपना स्थान साझा करें ताकि मदद आपको ढूंढ सके।",
    "emergency.savedOffline": "SOS इस फ़ोन पर सहेज लिया गया। ऐप दोबारा कनेक्ट होते ही भेजा जाएगा।",
    "emergency.signalLost": "सिग्नल खो गया। SOS इस फ़ोन पर सहेज लिया गया है और ऐप कनेक्ट होते ही भेजा जाएगा।",
    "emergency.sendFailure": "अभी भेजा नहीं जा सका। पृष्ठ खुला रखें या सिग्नल लौटने पर फिर प्रयास करें।",
    "emergency.mapPin": "मानचित्र बिंदु के पास",
    "emergency.outbox": "इस फ़ोन पर {count} SOS अनुरोध सहेजे गए हैं।",
    "emergency.outboxHint": "ऐप के दोबारा कनेक्ट होते ही यह अपने आप भेजा जाएगा।",
    "emergency.sending": "SOS भेजा जा रहा है…",
    "track.private": "निजी SOS",
    "track.heading": "मेरा बचाव कहाँ है?",
    "track.intro": "निजी SOS कोड दर्ज करें। टीम के काम करते समय यह पृष्ठ खुद अपडेट होता है।",
    "track.code": "निजी SOS कोड",
    "track.see": "देखें",
    "track.checking": "नवीनतम अपडेट जांचा जा रहा है…",
    "track.yourSos": "आपका SOS",
    "track.liveCheck": "लाइव जांच",
    "track.now": "अभी",
    "track.seen": "देख लिया गया",
    "track.moving": "रवाना",
    "track.done": "पूरा",
    "track.pending": "आपका SOS नियंत्रण टीम के पास है",
    "track.dispatched": "बचाव दल भेजा जा रहा है",
    "track.resolved": "दल ने इस मिशन को पूरा दर्ज कर दिया है",
    "track.safetyNote": "यह नियंत्रण केंद्र की अंतिम दर्ज स्थिति है। प्रतीक्षा करते समय स्थानीय सुरक्षा निर्देशों का पालन करें।",
    "responder.workspace": "रिस्पॉन्डर कार्यक्षेत्र",
    "responder.role": "फील्ड रिस्पॉन्डर",
    "responder.missions": "मेरे मिशन",
    "responder.map": "फील्ड मानचित्र",
    "responder.alerts": "अलर्ट",
    "responder.readiness": "फील्ड तैयारी",
    "responder.available": "उपलब्ध",
    "responder.onMission": "मिशन पर",
    "responder.offDuty": "ड्यूटी से बाहर",
    "responder.updating": "अपडेट हो रहा है…",
    "responder.board": "मेरा मिशन बोर्ड",
    "responder.boardTitle": "हर मिशन को उसके आवश्यक क्रम से पूरा करें।",
    "responder.dispatched": "रवाना चिह्नित करें",
    "responder.resolved": "समाधान चिह्नित करें",
    "responder.completed": "पूर्ण",
    "responder.assignmentAlerts": "अलर्ट की अनुमति दें",
    "responder.enableAlerts": "ब्राउज़र अलर्ट सक्रिय करें",
    "responder.profilePending": "रिस्पॉन्डर प्रोफ़ाइल लंबित",
    "responder.readinessCopy": "यह कार्यक्षेत्र खुला रहने पर अपडेट लाइव रहते हैं। रवाना होने से पहले उपलब्धता सेट करें और सुरक्षित होने पर ही GPS साझा करें।",
    "responder.mapTitle": "अपने प्रतिक्रिया क्षेत्र की सक्रिय स्थितियाँ देखें।",
    "responder.people": "लोग",
    "responder.priority": "प्राथमिकता",
    "responder.noMission": "इस खाते को कोई मिशन नहीं दिया गया है। डिस्पैचर आपको ढूंढ सकें इसलिए उपलब्धता अद्यतन रखें।",
    "responder.alertCopy": "Sahay खुला न होने पर भी मिशन असाइनमेंट और निकटवर्ती प्राथमिक SOS अलर्ट पाने के लिए इस डिवाइस को पंजीकृत करें।",
    "responder.retryAlerts": "ब्राउज़र अलर्ट पंजीकरण फिर से आज़माएँ",
    "responder.missionAlerts": "मिशन अलर्ट",
    "responder.operationalNotifications": "संचालन सूचनाएँ",
    "responder.noAlerts": "कोई मौजूदा अलर्ट नहीं है। मिशन सूचनाएँ यहाँ दिखाई देंगी।",
    "command.workspace": "प्रशासक कमांड केंद्र",
    "command.role": "आपात समन्वय",
    "command.operations": "ऑपरेशन बोर्ड",
    "command.map": "लाइव मानचित्र",
    "command.shelters": "आश्रय स्थल",
    "command.hospitals": "अस्पताल और संसाधन",
    "command.postRescueRecords": "पोस्ट-रेस्क्यू रिकॉर्ड",
    "command.requests": "रिस्पॉन्डर अनुरोध",
    "command.team": "टीम सूची",
    "command.overview": "असम · संचालन अवलोकन",
    "command.heading": "विश्वास के साथ प्राथमिकता दें।",
    "command.liveFeed": "लाइव संचालन फ़ीड",
    "command.incidents": "घटना फ़ीड",
    "command.openCoordination": "चालू बचाव समन्वय",
    "command.search": "कोड या स्थान खोजें",
    "command.allCases": "सभी मामले",
    "command.pending": "लंबित",
    "command.dispatched": "रवाना",
    "command.resolved": "समाधान",
    "dashboard.secureAccess": "सुरक्षित पहुंच",
    "dashboard.signIn": "खोलने के लिए साइन इन करें",
    "dashboard.continue": "सुरक्षित रूप से जारी रखें",
    "dashboard.signOut": "साइन आउट",
    "dashboard.liveWorkspace": "लाइव संचालन कार्यक्षेत्र",
  },
  bn: {
    "language.label": "ভাষা", "language.english": "ইংরেজি", "language.assamese": "অসমীয়া", "language.hindi": "হিন্দি",
    "brand.network": "অসম জরুরি নেটওয়ার্ক", "general.sos": "SOS", "general.safetyHub": "নিরাপত্তা কেন্দ্র", "general.connected": "সংযুক্ত", "general.offline": "অফলাইন মোড", "general.live": "লাইভ", "general.back": "পেছনে", "general.new": "নতুন", "general.optional": "ঐচ্ছিক",
    "home.ready": "প্রতিটি সেকেন্ড গুরুত্বপূর্ণ হলে প্রস্তুত",
    "home.heading": "সাহায্যের জন্য এক ট্যাপ।", "home.headingAccent": "আপনার পাশে একটি দল।",
    "home.intro": "বিপদে থাকা মানুষ, ফিল্ড রেসপন্ডার এবং জরুরি সমন্বয়কদের জন্য স্পষ্ট উদ্ধার পথ। সাহায্য লাগলে মেনুতে খোঁজার দরকার নেই।",
    "home.sendSos": "এখনই SOS পাঠান", "home.offlineNote": "অফলাইনে আপনার ফোন অনুরোধ সংরক্ষণ করে পুনরায় সংযুক্ত হলে পাঠাতে পারে।",
    "home.chooseRole": "আপনার ভূমিকা বেছে নিন", "home.needHelp": "আমার সাহায্য চাই", "home.needHelpCopy": "কয়েকটি ধাপে SOS রিপোর্ট করুন।", "home.responder": "আমি উদ্ধারকর্মী", "home.responderCopy": "দায়িত্ব দেখুন ও প্রস্তুতি নিন।", "home.coordinate": "আমি উদ্ধার সমন্বয় করি", "home.coordinateCopy": "কমান্ড কেন্দ্র খুলুন।",
    "home.track": "খোঁজ নিন", "home.trackCopy": "আমার অনুরোধ", "home.rescue": "উদ্ধার", "home.rescueCopy": "ক্ষেত্র দল", "home.command": "কমান্ড", "home.commandCopy": "সমন্বয়",
    "home.panic": "প্যানিক মোড SOS", "home.panicCopy": "ছবি-ভিত্তিক নির্বাচন, বড় নিয়ন্ত্রণ, প্রথমে অবস্থান।", "home.field": "ফিল্ড-রেডি রেসপন্স", "home.fieldCopy": "মিশন ও সতর্কতার জন্য সুরক্ষিত স্থান।", "home.capacity": "সম্পদ দৃশ্যমান", "home.capacityCopy": "কমান্ড থেকে SOS ও হাসপাতাল শয্যা সমন্বয় করুন।",
    "emergency.help": "জরুরি সহায়তা", "emergency.choose": "কি ঘটছে, বেছে নিন।", "emergency.pictureHint": "মিলে যায় এমন ছবি বেছে নিন। বিস্তারিত পরে দিতে পারেন।",
    "emergency.flood": "বন্যা / জল", "emergency.medical": "চিকিৎসা সহায়তা", "emergency.shelter": "নিরাপদ স্থান চাই", "emergency.stepLocation": "ধাপ ২",
    "emergency.shareLocation": "আপনার অবস্থান শেয়ার করুন", "emergency.gpsHint": "নিরাপদ হলে তবেই GPS ব্যবহার করুন। নিচে একটি পরিচিত স্থান যোগ করতে পারেন।",
    "emergency.shareMyLocation": "আমার অবস্থান শেয়ার করুন", "emergency.locationMissing": "অবস্থান এখনও শেয়ার করা হয়নি", "emergency.stepPeople": "ধাপ ৩",
    "emergency.people": "কতজন মানুষ?", "emergency.moreDetails": "আরও বিস্তারিত (ঐচ্ছিক)", "emergency.landmark": "পরিচিত স্থান বা ঠিকানা",
    "emergency.send": "এখনই SOS পাঠান", "emergency.saveOffline": "সিগন্যাল ফেরার পর্যন্ত SOS সংরক্ষণ করুন",
    "track.private": "ব্যক্তিগত SOS", "track.heading": "আমার উদ্ধার কোথায়?", "track.intro": "ব্যক্তিগত SOS কোড দিন।", "track.code": "ব্যক্তিগত SOS কোড", "track.see": "দেখুন",
    "track.pending": "আপনার SOS নিয়ন্ত্রণ দলের কাছে আছে", "track.dispatched": "একটি উদ্ধার দল পাঠানো হচ্ছে", "track.resolved": "দল এই মিশন সম্পূর্ণ করেছে", "track.safetyNote": "প্রতীক্ষার সময় স্থানীয় নিরাপত্তা নির্দেশিকা মেনে চলুন।",
    "responder.workspace": "উদ্ধারকর্মী কার্যক্ষেত্র", "responder.role": "ক্ষেত্র উদ্ধারকর্মী", "responder.missions": "আমার মিশন", "responder.map": "ক্ষেত্র মানচিত্র", "responder.alerts": "সতর্কতা", "responder.readiness": "ফিল্ড প্রস্তুতি", "responder.available": "উপলব্ধ", "responder.onMission": "মিশনে", "responder.offDuty": "দায়িত্বের বাইরে",
    "responder.board": "মিশন বোর্ড", "responder.dispatched": "প্রেরিত চিহ্নিত করুন", "responder.resolved": "সম্পন্ন চিহ্নিত করুন", "responder.completed": "সম্পূর্ণ", "responder.people": "মানুষ", "responder.priority": "অগ্রাধিকার", "responder.noMission": "কোনো মিশন বরাদ্দ করা হয়নি।", "responder.profilePending": "প্রোফাইল অপেক্ষমান",
    "command.workspace": "প্রশাসক কমান্ড কেন্দ্র", "command.role": "জরুরি সমন্বয়", "command.operations": "অপারেশন বোর্ড", "command.map": "লাইভ মানচিত্র", "command.shelters": "আশ্রয়", "command.hospitals": "হাসপাতাল ও সম্পদ", "command.requests": "উদ্ধারকর্মীর অনুরোধ", "command.team": "দলের তালিকা", "command.heading": "আস্থার সাথে কাজ করুন।", "command.allCases": "সকল কেস", "command.pending": "অপেক্ষমান", "command.dispatched": "প্রেরিত", "command.resolved": "সমাধান", "dashboard.signIn": "সাইন ইন করুন", "dashboard.signOut": "সাইন আউট", "dashboard.liveWorkspace": "লাইভ অপারেশন ওয়ার্কস্পেস",
  },
  or: {
    "language.label": "ଭାଷା", "language.english": "ଇଂରାଜୀ", "language.assamese": "ଆସାମୀ", "language.hindi": "ହିନ୍ଦୀ",
    "brand.network": "ଆସାମ ଜରୁରୀ ନେଟୱର୍କ", "general.sos": "SOS", "general.safetyHub": "ସୁରକ୍ଷା କେନ୍ଦ୍ର", "general.connected": "ସଂଯୁକ୍ତ", "general.offline": "ଅଫଲାଇନ୍ ମୋଡ୍", "general.live": "ଲାଇଭ୍", "general.back": "ପଛକୁ", "general.new": "ନୂତନ", "general.optional": "ଇଚ୍ଛାଧୀନ",
    "home.ready": "ପ୍ରତ୍ୟେକ ସେକେଣ୍ଡ ମୂଲ୍ୟବାନ ହେଲେ ପ୍ରସ୍ତୁତ",
    "home.heading": "ସାହାଯ୍ୟ ପାଇଁ ଗୋଟିଏ ଟ୍ୟାପ୍।", "home.headingAccent": "ଆପଣଙ୍କ ପଛରେ ଗୋଟିଏ ଦଳ।",
    "home.intro": "ବିପଦରେ ଥିବା ଲୋକ, କ୍ଷେତ୍ର ଉଦ୍ଧାରକର୍ମୀ ଓ ଜରୁରୀ ସମନ୍ୱୟକଙ୍କ ପାଇଁ ସ୍ପଷ୍ଟ ଉଦ୍ଧାର ପଥ।",
    "home.sendSos": "ଏବେ SOS ପଠାନ୍ତୁ", "home.offlineNote": "ଅଫଲାଇନରେ ଆପଣଙ୍କ ଫୋନ୍ ଅନୁରୋଧ ସଞ୍ଚୟ କରି ପୁଣି ସଂଯୁକ୍ତ ହେଲେ ପଠାଇପାରେ।",
    "home.chooseRole": "ଆପଣଙ୍କ ଭୂମିକା ବାଛନ୍ତୁ", "home.needHelp": "ମୋତେ ସାହାଯ୍ୟ ଦରକାର", "home.needHelpCopy": "କିଛି ପଦକ୍ଷେପରେ SOS ପଠାନ୍ତୁ।", "home.responder": "ମୁଁ ଉଦ୍ଧାରକର୍ମୀ", "home.responderCopy": "ଦାୟିତ୍ୱ ଦେଖନ୍ତୁ ଓ ପ୍ରସ୍ତୁତି ସେଟ୍ କରନ୍ତୁ।", "home.coordinate": "ମୁଁ ଉଦ୍ଧାର ସମନ୍ୱୟ କରେ", "home.coordinateCopy": "କମାଣ୍ଡ କେନ୍ଦ୍ର ଖୋଲନ୍ତୁ।",
    "home.track": "ସ୍ଥିତି ଦେଖନ୍ତୁ", "home.trackCopy": "ମୋର ଅନୁରୋଧ", "home.rescue": "ଉଦ୍ଧାର", "home.rescueCopy": "କ୍ଷେତ୍ର ଦଳ", "home.command": "କମାଣ୍ଡ", "home.commandCopy": "ସମନ୍ୱୟ",
    "home.panic": "ତତ୍କାଳ SOS", "home.panicCopy": "ଚିତ୍ର ଆଧାରିତ ଚୟନ, ପ୍ରଥମେ ଅବସ୍ଥାନ।", "home.field": "କ୍ଷେତ୍ର ପ୍ରସ୍ତୁତ", "home.fieldCopy": "ମିଶନ ଓ ସତର୍କତା ପାଇଁ ସୁରକ୍ଷିତ ସ୍ଥାନ।", "home.capacity": "କ୍ଷମତା ପ୍ରଦର୍ଶନ", "home.capacityCopy": "କମାଣ୍ଡରୁ SOS ଓ ଚିକିତ୍ସାଳୟ ସମନ୍ୱୟ କରନ୍ତୁ।",
    "emergency.help": "ଜରୁରୀ ସହାୟତା", "emergency.choose": "କ’ଣ ଘଟୁଛି ବାଛନ୍ତୁ।", "emergency.pictureHint": "ମେଳ ଖାଉଥିବା ଛବି ବାଛନ୍ତୁ। ବିବରଣୀ ପରେ ଦେଇପାରିବେ।",
    "emergency.flood": "ବନ୍ୟା / ପାଣି", "emergency.medical": "ଚିକିତ୍ସା ସହାୟତା", "emergency.shelter": "ନିରାପଦ ସ୍ଥାନ ଦରକାର", "emergency.stepLocation": "ପଦକ୍ଷେପ ୨",
    "emergency.shareLocation": "ଆପଣଙ୍କ ଅବସ୍ଥାନ ସେୟାର କରନ୍ତୁ", "emergency.gpsHint": "ନିରାପଦ ହେଲେ ମାତ୍ର GPS ବ୍ୟବହାର କରନ୍ତୁ।",
    "emergency.shareMyLocation": "ମୋ ଅବସ୍ଥାନ ସେୟାର କରନ୍ତୁ", "emergency.locationMissing": "ଅବସ୍ଥାନ ଏପର୍ଯ୍ୟନ୍ତ ସେୟାର ହୋଇନାହିଁ", "emergency.stepPeople": "ପଦକ୍ଷେପ ୩",
    "emergency.people": "କେତେ ଲୋକ?", "emergency.moreDetails": "ଅଧିକ ବିବରଣୀ (ଇଚ୍ଛାଧୀନ)", "emergency.landmark": "ଚିହ୍ନିତ ସ୍ଥାନ ବା ଠିକଣା",
    "emergency.send": "ଏବେ SOS ପଠାନ୍ତୁ", "emergency.saveOffline": "ସିଗ୍ନାଲ ଫେରିବା ପର୍ଯ୍ୟନ୍ତ SOS ସଞ୍ଚୟ କରନ୍ତୁ",
    "track.private": "ବ୍ୟକ୍ତିଗତ SOS", "track.heading": "ମୋ ଉଦ୍ଧାର କେଉଁଠି?", "track.intro": "ବ୍ୟକ୍ତିଗତ SOS କୋଡ୍ ଦିଅନ୍ତୁ।", "track.code": "ବ୍ୟକ୍ତିଗତ SOS କୋଡ୍", "track.see": "ଦେଖନ୍ତୁ",
    "track.pending": "ଆପଣଙ୍କ SOS ନିୟନ୍ତ୍ରଣ ଦଳ ପାଖରେ ଅଛି", "track.dispatched": "ଏକ ଉଦ୍ଧାର ଦଳ ପଠାଯାଉଛି", "track.resolved": "ଦଳ ଏହି ମିଶନ ସମାପ୍ତ କରିଛି", "track.safetyNote": "ଅପେକ୍ଷା ସମୟରେ ସ୍ଥାନୀୟ ସୁରକ୍ଷା ନିର୍ଦ୍ଦେଶ ପାଳନ କରନ୍ତୁ।",
    "responder.workspace": "ଉଦ୍ଧାରକର୍ମୀ କାର୍ଯ୍ୟକ୍ଷେତ୍ର", "responder.role": "କ୍ଷେତ୍ର ଉଦ୍ଧାରକର୍ମୀ", "responder.missions": "ମୋର ମିଶନ", "responder.map": "କ୍ଷେତ୍ର ମାନଚିତ୍ର", "responder.alerts": "ସତର୍କତା", "responder.readiness": "କ୍ଷେତ୍ର ପ୍ରସ୍ତୁତି", "responder.available": "ଉପଲବ୍ଧ", "responder.onMission": "ମିଶନରେ", "responder.offDuty": "ଡ୍ୟୁଟି ବାହାରେ",
    "responder.board": "ମିଶନ ବୋର୍ଡ", "responder.dispatched": "ପଠାଯାଇଛି ଚିହ୍ନିତ କରନ୍ତୁ", "responder.resolved": "ସମାପ୍ତ ଚିହ୍ନିତ କରନ୍ତୁ", "responder.completed": "ସମ୍ପୂର୍ଣ୍ଣ", "responder.people": "ଲୋକ", "responder.priority": "ପ୍ରାଥମିକତା", "responder.noMission": "କୌଣସି ମିଶନ ଦିଆଯାଇ ନାହିଁ।", "responder.profilePending": "ପ୍ରୋଫାଇଲ୍ ବିଚାରାଧୀନ",
    "command.workspace": "ପ୍ରଶାସକ କମାଣ୍ଡ କେନ୍ଦ୍ର", "command.role": "ଜରୁରୀ ସମନ୍ୱୟ", "command.operations": "ଅପରେସନ ବୋର୍ଡ", "command.map": "ଲାଇଭ୍ ମାନଚିତ୍ର", "command.shelters": "ଆଶ୍ରୟ", "command.hospitals": "ଡାକ୍ତରଖାନା ଓ ସମ୍ବଳ", "command.requests": "ଉଦ୍ଧାରକର୍ମୀ ଅନୁରୋଧ", "command.team": "ଦଳ ତାଲିକା", "command.heading": "ଆତ୍ମବିଶ୍ୱାସରେ ନିର୍ଣ୍ଣୟ ନିଅନ୍ତୁ।", "command.allCases": "ସମସ୍ତ ଘଟଣା", "command.pending": "ବିଚାରାଧୀନ", "command.dispatched": "ପଠାଯାଇଛି", "command.resolved": "ସମାପ୍ତ", "dashboard.signIn": "ସାଇନ୍ ଇନ୍ କରନ୍ତୁ", "dashboard.signOut": "ସାଇନ୍ ଆଉଟ୍", "dashboard.liveWorkspace": "ଲାଇଭ୍ ଅପରେସନ କାର୍ଯ୍ୟକ୍ଷେତ୍ର",
  },
  mr: {
    "language.label": "भाषा", "language.english": "इंग्रजी", "language.assamese": "असमिया", "language.hindi": "हिंदी",
    "brand.network": "आसाम आपत्कालीन नेटवर्क", "general.sos": "SOS", "general.safetyHub": "सुरक्षा केंद्र", "general.connected": "जोडलेले", "general.offline": "ऑफलाइन मोड", "general.live": "लाइव्ह", "general.back": "मागे", "general.new": "नवीन", "general.optional": "ऐच्छिक",
    "home.ready": "प्रत्येक सेकंद महत्त्वाचा असताना सज्ज",
    "home.heading": "मदतीसाठी एक टॅप.", "home.headingAccent": "तुमच्यामागे एक पथक.",
    "home.intro": "धोक्यातील लोक, क्षेत्रीय प्रतिसादकर्ता आणि आपत्कालीन समन्वयकांसाठी स्पष्ट बचाव मार्ग.",
    "home.sendSos": "आता SOS पाठवा", "home.offlineNote": "ऑफलाइन असताना तुमचा फोन विनंती जतन करून पुन्हा जोडल्यावर पाठवू शकतो.",
    "home.chooseRole": "तुमची भूमिका निवडा", "home.needHelp": "मला मदत हवी आहे", "home.needHelpCopy": "काही टप्प्यांत SOS पाठवा.", "home.responder": "मी प्रतिसादकर्ता आहे", "home.responderCopy": "असाइनमेंट पहा आणि तयारी सेट करा.", "home.coordinate": "मी बचाव समन्वय करतो", "home.coordinateCopy": "कमांड केंद्र उघडा.",
    "home.track": "स्थिती पहा", "home.trackCopy": "माझी विनंती", "home.rescue": "बचाव", "home.rescueCopy": "क्षेत्र पथक", "home.command": "कमांड", "home.commandCopy": "समन्वय",
    "home.panic": "पॅनिक मोड SOS", "home.panicCopy": "चित्र आधारित पर्याय, मोठे नियंत्रण, आधी स्थान.", "home.field": "फील्ड-रेडी प्रतिसाद", "home.fieldCopy": "मोहीम आणि सूचनांसाठी सुरक्षित जागा.", "home.capacity": "क्षमता दृश्यमान", "home.capacityCopy": "कमांडमधून SOS आणि रुग्णालयांचे समन्वय करा.",
    "emergency.help": "आपत्कालीन मदत", "emergency.choose": "काय घडत आहे ते निवडा.", "emergency.pictureHint": "जुळणारे चित्र निवडा. तपशील नंतर देऊ शकता.",
    "emergency.flood": "पूर / पाणी", "emergency.medical": "वैद्यकीय मदत", "emergency.shelter": "सुरक्षित जागा हवी", "emergency.stepLocation": "पायरी २",
    "emergency.shareLocation": "तुमचे स्थान शेअर करा", "emergency.gpsHint": "सुरक्षित असल्यासच GPS वापरा.",
    "emergency.shareMyLocation": "माझे स्थान शेअर करा", "emergency.locationMissing": "स्थान अजून शेअर केलेले नाही", "emergency.stepPeople": "पायरी ३",
    "emergency.people": "किती लोक आहेत?", "emergency.moreDetails": "अधिक तपशील (ऐच्छिक)", "emergency.landmark": "ओळखचिन्ह किंवा पत्ता",
    "emergency.send": "आता SOS पाठवा", "emergency.saveOffline": "सिग्नल परत येईपर्यंत SOS जतन करा",
    "track.private": "खाजगी SOS", "track.heading": "माझा बचाव कुठे आहे?", "track.intro": "खाजगी SOS कोड टाका.", "track.code": "खाजगी SOS कोड", "track.see": "पाहा",
    "track.pending": "तुमचा SOS नियंत्रण पथकाकडे आहे", "track.dispatched": "बचाव पथक पाठवले जात आहे", "track.resolved": "पथकाने हे अभियान पूर्ण केले आहे", "track.safetyNote": "वाट पाहताना स्थानिक सुरक्षा सूचनांचे पालन करा.",
    "responder.workspace": "प्रतिसादकर्ता कार्यक्षेत्र", "responder.role": "क्षेत्रीय प्रतिसादकर्ता", "responder.missions": "माझी अभियान", "responder.map": "क्षेत्र नकाशा", "responder.alerts": "सूचना", "responder.readiness": "फील्ड तयारी", "responder.available": "उपलब्ध", "responder.onMission": "अभियानावर", "responder.offDuty": "कर्तव्याबाहेर",
    "responder.board": "अभियान फलक", "responder.dispatched": "रवाना चिन्हांकित करा", "responder.resolved": "पूर्ण चिन्हांकित करा", "responder.completed": "पूर्ण", "responder.people": "लोक", "responder.priority": "प्राधान्य", "responder.noMission": "कोणतीही मोहीम दिलेली नाही.", "responder.profilePending": "प्रोफाइल प्रलंबित",
    "command.workspace": "प्रशासक कमांड केंद्र", "command.role": "आपत्कालीन समन्वय", "command.operations": "ऑपरेशन बोर्ड", "command.map": "लाइव्ह नकाशा", "command.shelters": "निवारे", "command.hospitals": "रुग्णालये व संसाधने", "command.requests": "प्रतिसादकर्ता विनंत्या", "command.team": "पथक यादी", "command.heading": "विश्वासाने निर्णय घ्या.", "command.allCases": "सर्व प्रकरणे", "command.pending": "प्रलंबित", "command.dispatched": "रवाना", "command.resolved": "पूर्ण", "dashboard.signIn": "साइन इन करा", "dashboard.signOut": "साइन आउट", "dashboard.liveWorkspace": "थेट ऑपरेशन्स कार्यक्षेत्र",
  },
  gu: {
    "language.label": "ભાષા", "language.english": "અંગ્રેજી", "language.assamese": "આસામી", "language.hindi": "હિન્દી",
    "brand.network": "આસામ કટોકટી નેટવર્ક", "general.sos": "SOS", "general.safetyHub": "સુરક્ષા કેન્દ્ર", "general.connected": "કનેક્ટેડ", "general.offline": "ઑફલાઇન મોડ", "general.live": "લાઇવ", "general.back": "પાછા", "general.new": "નવું", "general.optional": "વૈકલ્પિક",
    "home.ready": "જ્યારે દરેક સેકન્ડ મહત્વપૂર્ણ હોય ત્યારે તૈયાર",
    "home.heading": "મદદ માટે એક ટેપ.", "home.headingAccent": "તમારી પાછળ એક ટીમ.",
    "home.intro": "જોખમમાં રહેલા લોકો, ક્ષેત્ર પ્રતિસાદકો અને કટોકટી સંયોજકો માટે સ્પષ્ટ બચાવ માર્ગ.",
    "home.sendSos": "હમણાં SOS મોકલો", "home.offlineNote": "ઑફલાઇન હોવા પર તમારો ફોન વિનંતી સાચવીને ફરી કનેક્ટ થતાં મોકલી શકે છે.",
    "home.chooseRole": "તમારી ભૂમિકા પસંદ કરો", "home.needHelp": "મને મદદ જોઈએ", "home.needHelpCopy": "થોડા પગલાંમાં SOS મોકલો.", "home.responder": "હું પ્રતિસાદક છું", "home.responderCopy": "અસાઇનમેન્ટ જુઓ અને તૈયારી સેટ કરો.", "home.coordinate": "હું બચાવનું સંકલન કરું છું", "home.coordinateCopy": "કમાન્ડ સેન્ટર ખોલો.",
    "home.track": "સ્થિતિ જુઓ", "home.trackCopy": "મારી વિનંતી", "home.rescue": "બચાવ", "home.rescueCopy": "ક્ષેત્ર ટીમ", "home.command": "કમાન્ડ", "home.commandCopy": "સંકલન",
    "home.panic": "પેનિક મોડ SOS", "home.panicCopy": "ચિત્ર આધારિત વિકલ્પો, મોટા નિયંત્રણો, પહેલા સ્થાન.", "home.field": "ક્ષેત્ર-તૈયાર પ્રતિસાદ", "home.fieldCopy": "મિશન અને ચેતવણીઓ માટે સુરક્ષિત સ્થાન.", "home.capacity": "ક્ષમતા દર્શન", "home.capacityCopy": "કમાન્ડમાંથી SOS અને હોસ્પિટલોનું સંકલન કરો.",
    "emergency.help": "કટોકટી સહાય", "emergency.choose": "શું થઈ રહ્યું છે તે પસંદ કરો.", "emergency.pictureHint": "મેળ ખાતું ચિત્ર પસંદ કરો. વિગતો પછી આપી શકો છો.",
    "emergency.flood": "પૂર / પાણી", "emergency.medical": "તબીબી સહાય", "emergency.shelter": "સુરક્ષિત જગ્યા જોઈએ", "emergency.stepLocation": "પગલું ૨",
    "emergency.shareLocation": "તમારું સ્થાન શેર કરો", "emergency.gpsHint": "સુરક્ષિત હોય તો જ GPS વાપરો.",
    "emergency.shareMyLocation": "મારું સ્થાન શેર કરો", "emergency.locationMissing": "સ્થાન હજુ શેર કરાયું નથી", "emergency.stepPeople": "પગલું ૩",
    "emergency.people": "કેટલા લોકો?", "emergency.moreDetails": "વધુ વિગતો (વૈકલ્પિક)", "emergency.landmark": "ઓળખચિહ્ન અથવા સરનામું",
    "emergency.send": "હમણાં SOS મોકલો", "emergency.saveOffline": "સિગ્નલ પાછું આવે ત્યાં સુધી SOS સાચવો",
    "track.private": "ખાનગી SOS", "track.heading": "મારું બચાવ ક્યાં છે?", "track.intro": "ખાનગી SOS કોડ દાખલ કરો.", "track.code": "ખાનગી SOS કોડ", "track.see": "જુઓ",
    "track.pending": "તમારું SOS નિયંત્રણ ટીમ પાસે છે", "track.dispatched": "બચાવ ટીમ મોકલાઈ રહી છે", "track.resolved": "ટીમે આ મિશન પૂર્ણ કર્યું છે", "track.safetyNote": "રાહ જોતી વખતે સ્થાનિક સુરક્ષા માર્ગદર્શિકા અનુસરો.",
    "responder.workspace": "પ્રતિસાદક કાર્યક્ષેત્ર", "responder.role": "ક્ષેત્રીય પ્રતિસાદક", "responder.missions": "મારા મિશન", "responder.map": "ક્ષેત્ર નકશો", "responder.alerts": "ચેતવણીઓ", "responder.readiness": "ક્ષેત્ર તૈયારી", "responder.available": "ઉપલબ્ધ", "responder.onMission": "મિશન પર", "responder.offDuty": "ફરજ બહાર",
    "responder.board": "મિશન બોર્ડ", "responder.dispatched": "મોકલાયેલ ચિહ્નિત કરો", "responder.resolved": "પૂર્ણ ચિહ્નિત કરો", "responder.completed": "પૂર્ણ", "responder.people": "લોકો", "responder.priority": "પ્રાથમિકતા", "responder.noMission": "કોઈ મિશન સોંપાયું નથી.", "responder.profilePending": "પ્રોફાઇલ બાકી",
    "command.workspace": "પ્રશાસક કમાન્ડ કેન્દ્ર", "command.role": "કટોકટી સંકલન", "command.operations": "ઓપરેશન બોર્ડ", "command.map": "લાઇવ નકશો", "command.shelters": "આશ્રય", "command.hospitals": "હોસ્પિટલ અને સંસાધનો", "command.requests": "પ્રતિસાદક વિનંતીઓ", "command.team": "ટીમ સૂચિ", "command.heading": "વિશ્વાસ સાથે સંચાલન કરો.", "command.allCases": "બધા કેસ", "command.pending": "બાકી", "command.dispatched": "મોકલાયેલ", "command.resolved": "પૂર્ણ", "dashboard.signIn": "સાઇન ઇન કરો", "dashboard.signOut": "સાઇન આઉટ", "dashboard.liveWorkspace": "લાઇવ ઓપરેશન્સ કાર્યક્ષેત્ર",
  },
  ta: {
    "language.label": "மொழி", "language.english": "ஆங்கிலம்", "language.assamese": "அசாமிய", "language.hindi": "இந்தி",
    "brand.network": "அசாம் அவசர வலைப்பின்னல்", "general.sos": "SOS", "general.safetyHub": "பாதுகாப்பு மையம்", "general.connected": "இணைக்கப்பட்டது", "general.offline": "ஆஃப்லைன் முறை", "general.live": "நேரலை", "general.back": "பின்செல்", "general.new": "புதியது", "general.optional": "விருப்பமானது",
    "home.ready": "ஒவ்வொரு வினாடியும் முக்கியம் எனும்போது தயார்",
    "home.heading": "உதவிக்கு ஒரு தொடுதல்.", "home.headingAccent": "உங்களுக்குப் பின்னால் ஒரு குழு.",
    "home.intro": "ஆபத்தில் உள்ளோர், கள மீட்புப் பணியாளர்கள் மற்றும் அவசர ஒருங்கிணைப்பாளர்களுக்கான தெளிவான மீட்பு வழி.",
    "home.sendSos": "இப்போது SOS அனுப்பவும்", "home.offlineNote": "ஆஃப்லைனில் உங்கள் தொலைபேசி கோரிக்கையைச் சேமித்து மீண்டும் இணைந்ததும் அனுப்ப முடியும்.",
    "home.chooseRole": "உங்கள் பங்கைத் தேர்ந்தெடுக்கவும்", "home.needHelp": "எனக்கு உதவி வேண்டும்", "home.needHelpCopy": "சில படிகளில் SOS பதிவு செய்யவும்.", "home.responder": "நான் மீட்புப் பணியாளர்", "home.responderCopy": "பணிகளைப் பார்த்து தயார்நிலையை அமைக்கவும்.", "home.coordinate": "நான் மீட்பை ஒருங்கிணைக்கிறேன்", "home.coordinateCopy": "கட்டளை மையத்தைத் திறக்கவும்.",
    "home.track": "நிலை பார்க்கவும்", "home.trackCopy": "என் கோரிக்கை", "home.rescue": "மீட்பு", "home.rescueCopy": "கள குழு", "home.command": "கட்டளை", "home.commandCopy": "ஒருங்கிணைப்பு",
    "home.panic": "அதிவிரைவு SOS", "home.panicCopy": "படங்கள் வழி தேர்வுகள், பெரிய பொத்தான்கள், முதலில் இருப்பிடம்.", "home.field": "கள தயார்நிலை", "home.fieldCopy": "பணிகள் மற்றும் எச்சரிக்கைகளுக்கான பாதுகாப்பு தளம்.", "home.capacity": "வளங்கள் பார்வை", "home.capacityCopy": "SOS மற்றும் மருத்துவமனை வளங்களை ஒருங்கிணைக்கவும்.",
    "emergency.help": "அவசர உதவி", "emergency.choose": "என்ன நடக்கிறது என்பதைத் தேர்ந்தெடுக்கவும்.", "emergency.pictureHint": "பொருந்தும் படத்தைத் தேர்ந்தெடுக்கவும். விவரங்களை பின்னர் வழங்கலாம்.",
    "emergency.flood": "வெள்ளம் / நீர்", "emergency.medical": "மருத்துவ உதவி", "emergency.shelter": "பாதுகாப்பான இடம் வேண்டும்", "emergency.stepLocation": "படி 2",
    "emergency.shareLocation": "உங்கள் இருப்பிடத்தைப் பகிரவும்", "emergency.gpsHint": "பாதுகாப்பாக இருந்தால் மட்டுமே GPS பயன்படுத்தவும்.",
    "emergency.shareMyLocation": "என் இருப்பிடத்தைப் பகிரவும்", "emergency.locationMissing": "இருப்பிடம் இன்னும் பகிரப்படவில்லை", "emergency.stepPeople": "படி 3",
    "emergency.people": "எத்தனை பேர்?", "emergency.moreDetails": "மேலும் விவரங்கள் (விருப்பமானது)", "emergency.landmark": "அடையாள இடம் அல்லது முகவரி",
    "emergency.send": "இப்போது SOS அனுப்பவும்", "emergency.saveOffline": "சிக்னல் திரும்பும் வரை SOS சேமிக்கவும்",
    "track.private": "தனிப்பட்ட SOS", "track.heading": "என் மீட்பு எங்கே?", "track.intro": "தனிப்பட்ட SOS குறியீட்டை உள்ளிடவும்.", "track.code": "தனிப்பட்ட SOS குறியீடு", "track.see": "பார்க்கவும்",
    "track.pending": "உங்கள் SOS கட்டுப்பாட்டு குழுவிடம் உள்ளது", "track.dispatched": "மீட்புக் குழு அனுப்பப்படுகிறது", "track.resolved": "குழு இந்தப் பணியை முடித்துள்ளது", "track.safetyNote": "காத்திருக்கும்போது உள்ளூர் பாதுகாப்பு வழிகாட்டுதலைப் பின்பற்றவும்.",
    "responder.workspace": "மீட்புப் பணியாளர் பணியிடம்", "responder.role": "கள மீட்புப் பணியாளர்", "responder.missions": "என் பணிகள்", "responder.map": "கள வரைபடம்", "responder.alerts": "எச்சரிக்கைகள்", "responder.readiness": "கள தயார் நிலை", "responder.available": "கிடைக்கும்", "responder.onMission": "பணியில்", "responder.offDuty": "பணிக்கு வெளியே",
    "responder.board": "என் பணி பலகை", "responder.dispatched": "அனுப்பியதாக குறிக்க", "responder.resolved": "தீர்வடைந்ததாக குறிக்க", "responder.completed": "முடிந்தது", "responder.people": "பேர்", "responder.priority": "முன்னுரிமை", "responder.noMission": "பணிகள் எதுவும் ஒதுக்கப்படவில்லை.", "responder.profilePending": "சுயவிவரம் நிலுவையில்",
    "command.workspace": "நிர்வாக கட்டளை மையம்", "command.role": "அவசர ஒருங்கிணைப்பு", "command.operations": "செயல்பாட்டு பலகை", "command.map": "நேரலை வரைபடம்", "command.shelters": "தங்குமிடங்கள்", "command.hospitals": "மருத்துவமனைகள் மற்றும் வளங்கள்", "command.requests": "மீட்புப் பணியாளர் கோரிக்கைகள்", "command.team": "குழு பட்டியல்", "command.heading": "நம்பிக்கையுடன் முன்னுரிமை அளியுங்கள்.", "command.allCases": "அனைத்து வழக்குகள்", "command.pending": "நிலுவையில்", "command.dispatched": "அனுப்பப்பட்டது", "command.resolved": "தீர்க்கப்பட்டது", "dashboard.signIn": "உள்நுழையவும்", "dashboard.signOut": "வெளியேறு", "dashboard.liveWorkspace": "நேரடி செயல்பாட்டு பணியிடம்",
  },
  te: {
    "language.label": "భాష", "language.english": "ఇంగ్లీష్", "language.assamese": "అస్సామీ", "language.hindi": "హిందీ",
    "brand.network": "అస్సాం అత్యవసర నెట్‌వర్క్", "general.sos": "SOS", "general.safetyHub": "భద్రతా కేంద్రం", "general.connected": "కనెక్ట్ అయింది", "general.offline": "ఆఫ్‌లైన్ మోడ్", "general.live": "లైవ్", "general.back": "వెనుకకు", "general.new": "కొత్త", "general.optional": "ఐచ్ఛికం",
    "home.ready": "ప్రతి సెకను కీలకమైనప్పుడు సిద్ధం",
    "home.heading": "సహాయం కోసం ఒక ట్యాప్.", "home.headingAccent": "మీ వెనుక ఒక బృందం ఉంది.",
    "home.intro": "ప్రమాదంలో ఉన్నవారు, క్షేత్ర స్పందనకర్తలు మరియు అత్యవసర సమన్వయకర్తల కోసం స్పష్టమైన రక్షణ మార్గం.",
    "home.sendSos": "ఇప్పుడే SOS పంపండి", "home.offlineNote": "ఆఫ్‌లైన్‌లో మీ ఫోన్ అభ్యర్థనను భద్రపరచి మళ్లీ కనెక్ట్ అయినప్పుడు పంపగలదు.",
    "home.chooseRole": "మీ పాత్రను ఎంచుకోండి", "home.needHelp": "నాకు సహాయం కావాలి", "home.needHelpCopy": "కొన్ని దశల్లో SOS పంపండి.", "home.responder": "నేను స్పందనకర్తను", "home.responderCopy": "కేటాయింపులను చూసి సంసిద్ధతను సెట్ చేయండి.", "home.coordinate": "నేను రక్షణను సమన్వయం చేస్తాను", "home.coordinateCopy": "కమాండ్ కేంద్రాన్ని తెరవండి.",
    "home.track": "స్థితి చూడండి", "home.trackCopy": "నా అభ్యర్థన", "home.rescue": "రక్షణ", "home.rescueCopy": "క్షేత్ర బృందం", "home.command": "కమాండ్", "home.commandCopy": "సమన్వయం",
    "home.panic": "పానిక్ మోడ్ SOS", "home.panicCopy": "చిత్రాల ఎంపిక, పెద్ద నియంత్రణలు, మొదట స్థానం.", "home.field": "ఫీల్డ్ సిద్ధం", "home.fieldCopy": "మిషన్లు మరియు హెచ్చరికల కోసం సురక్షిత స్థలం.", "home.capacity": "వనరుల లభ్యత", "home.capacityCopy": "కమాండ్ నుండి SOS మరియు ఆసుపత్రి వనరులను సమన్వయం చేయండి.",
    "emergency.help": "అత్యవసర సహాయం", "emergency.choose": "ఏమి జరుగుతుందో ఎంచుకోండి.", "emergency.pictureHint": "సరిపోయే చిత్రాన్ని ఎంచుకోండి. వివరాలను తర్వాత ఇవ్వవచ్చు.",
    "emergency.flood": "వరద / నీరు", "emergency.medical": "వైద్య సహాయం", "emergency.shelter": "సురక్షిత స్థలం కావాలి", "emergency.stepLocation": "దశ 2",
    "emergency.shareLocation": "మీ స్థానాన్ని పంచుకోండి", "emergency.gpsHint": "సురక్షితంగా ఉన్నప్పుడే GPS ఉపయోగించండి.",
    "emergency.shareMyLocation": "నా స్థానాన్ని పంచుకోండి", "emergency.locationMissing": "స్థానం ఇంకా పంచుకోబడలేదు", "emergency.stepPeople": "దశ 3",
    "emergency.people": "ఎంతమంది వ్యక్తులు?", "emergency.moreDetails": "మరిన్ని వివరాలు (ఐచ్ఛికం)", "emergency.landmark": "గుర్తింపు స్థలం లేదా చిరునామా",
    "emergency.send": "ఇప్పుడే SOS పంపండి", "emergency.saveOffline": "సిగ్నల్ తిరిగివచ్చే వరకు SOS భద్రపరచండి",
    "track.private": "వ్యక్తిగత SOS", "track.heading": "నా రక్షణ ఎక్కడ ఉంది?", "track.intro": "వ్యక్తిగత SOS కోడ్‌ను నమోదు చేయండి.", "track.code": "వ్యక్తిగత SOS కోడ్", "track.see": "చూడండి",
    "track.pending": "మీ SOS నియంత్రణ బృందం వద్ద ఉంది", "track.dispatched": "రక్షణ బృందం పంపబడుతోంది", "track.resolved": "బృందం ఈ మిషన్‌ను పూర్తిగా నమోదు చేసింది", "track.safetyNote": "వేచి ఉన్న సమయంలో స్థానిక భద్రతా సూచనలను పాటించండి.",
    "responder.workspace": "స్పందనకర్త కార్యస్థలం", "responder.role": "క్షేత్ర స్పందనకర్త", "responder.missions": "నా మిషన్లు", "responder.map": "క్షేత్ర మ్యాప్", "responder.alerts": "హెచ్చరికలు", "responder.readiness": "ఫీల్డ్ సంసిద్ధత", "responder.available": "అందుబాటులో", "responder.onMission": "మిషన్‌లో", "responder.offDuty": "డ్యూటీ వెలుపల",
    "responder.board": "మిషన్ బోర్డు", "responder.dispatched": "పంపినట్లు గుర్తించండి", "responder.resolved": "పరిష్కరించినట్లు గుర్తించండి", "responder.completed": "పూర్తయింది", "responder.people": "వ్యక్తులు", "responder.priority": "ప్రాధాన్యత", "responder.noMission": "ఎటువంటి మిషన్ కేటాయించబడలేదు.", "responder.profilePending": "ప్రొఫైల్ పెండింగ్‌లో ఉంది",
    "command.workspace": "నిర్వాహక కమాండ్ కేంద్రం", "command.role": "అత్యవసర సమన్వయం", "command.operations": "ఆపరేషన్స్ బోర్డు", "command.map": "లైవ్ మ్యాప్", "command.shelters": "ఆశ్రయాలు", "command.hospitals": "ఆసుపత్రులు మరియు వనరులు", "command.requests": "స్పందనకర్త అభ్యర్థనలు", "command.team": "బృంద జాబితా", "command.heading": "విశ్వాసంతో నిర్ణయాలు తీసుకోండి.", "command.allCases": "అన్ని కేసులు", "command.pending": "పెండింగ్", "command.dispatched": "పంపబడింది", "command.resolved": "పరిష్కరించబడింది", "dashboard.signIn": "సైన్ ఇన్ చేయండి", "dashboard.signOut": "సైన్ అవుట్", "dashboard.liveWorkspace": "లైవ్ ఆపరేషన్స్ వర్క్‌స్పేస్",
  },
  kn: {
    "language.label": "ಭಾಷೆ", "language.english": "ಇಂಗ್ಲಿಷ್", "language.assamese": "ಅಸ್ಸಾಮಿ", "language.hindi": "ಹಿಂದಿ",
    "brand.network": "ಅಸ್ಸಾಂ ತುರ್ತು ಜಾಲ", "general.sos": "SOS", "general.safetyHub": "ಸುರಕ್ಷತಾ ಕೇಂದ್ರ", "general.connected": "ಸಂಪರ್ಕಗೊಂಡಿದೆ", "general.offline": "ಆಫ್‌ಲೈನ್ ವಿಧಾನ", "general.live": "ಲೈವ್", "general.back": "ಹಿಂದೆ", "general.new": "ಹೊಸ", "general.optional": "ಐಚ್ಛಿಕ",
    "home.ready": "ಪ್ರತಿ ಕ್ಷಣವೂ ಮುಖ್ಯವಾದಾಗ ಸಿದ್ಧ",
    "home.heading": "ಸಹಾಯಕ್ಕಾಗಿ ಒಂದು ಟ್ಯಾಪ್.", "home.headingAccent": "ನಿಮ್ಮ ಹಿಂದೆ ಒಂದು ತಂಡ.",
    "home.intro": "ಅಪಾಯದಲ್ಲಿರುವ ಜನರು, ಕ್ಷೇತ್ರ ಪ್ರತಿಕ್ರಿಯಾಕಾರರು ಮತ್ತು ತುರ್ತು ಸಮನ್ವಯಕರಿಗೆ ಸ್ಪಷ್ಟ ರಕ್ಷಣಾ ದಾರಿ.",
    "home.sendSos": "ಈಗ SOS ಕಳುಹಿಸಿ", "home.offlineNote": "ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿರುವಾಗ ನಿಮ್ಮ ಫೋನ್ ವಿನಂತಿಯನ್ನು ಉಳಿಸಿ ಮತ್ತೆ ಸಂಪರ್ಕಗೊಂಡಾಗ ಕಳುಹಿಸಬಹುದು.",
    "home.chooseRole": "ನಿಮ್ಮ ಪಾತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ", "home.needHelp": "ನನಗೆ ಸಹಾಯ ಬೇಕು", "home.needHelpCopy": "ಕೆಲವೇ ಹಂತಗಳಲ್ಲಿ SOS ವರದಿ ಮಾಡಿ.", "home.responder": "ನಾನು ಪ್ರತಿಕ್ರಿಯಾಕಾರ", "home.responderCopy": "ಕಾರ್ಯಗಳನ್ನು ನೋಡಿ ಸಿದ್ಧತೆಯನ್ನು ಹೊಂದಿಸಿ.", "home.coordinate": "ನಾನು ರಕ್ಷಣೆಯನ್ನು ಸಮನ್ವಯಗೊಳಿಸುತ್ತೇನೆ", "home.coordinateCopy": "ಕಮಾಂಡ್ ಕೇಂದ್ರವನ್ನು ತೆರೆಯಿರಿ.",
    "home.track": "ಸ್ಥಿತಿ ನೋಡಿ", "home.trackCopy": "ನನ್ನ ವಿನಂತಿ", "home.rescue": "ರಕ್ಷಣೆ", "home.rescueCopy": "ಕ್ಷೇತ್ರ ತಂಡ", "home.command": "ಕಮಾಂಡ್", "home.commandCopy": "ಸಮನ್ವಯ",
    "home.panic": "ತುರ್ತು SOS", "home.panicCopy": "ಚಿತ್ರ ಆಧಾರಿತ ಆಯ್ಕೆಗಳು, ದೊಡ್ಡ ನಿಯಂತ್ರಣಗಳು, ಮೊದಲು ಸ್ಥಳ.", "home.field": "ಕ್ಷೇತ್ರ-ಸಿದ್ಧ ಪ್ರತಿಕ್ರಿಯೆ", "home.fieldCopy": "ಕಾರ್ಯಗಳು ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳಿಗಾಗಿ ಸುರಕ್ಷಿತ ಸ್ಥಳ.", "home.capacity": "ಸಾಮರ್ಥ್ಯ ವೀಕ್ಷಣೆ", "home.capacityCopy": "ಕಮಾಂಡ್‌ನಿಂದ SOS ಮತ್ತು ಆಸ್ಪತ್ರೆ ಹಾಸಿಗೆಗಳನ್ನು ಸಮನ್ವಯಗೊಳಿಸಿ.",
    "emergency.help": "ತುರ್ತು ಸಹಾಯ", "emergency.choose": "ಏನು ನಡೆಯುತ್ತಿದೆ ಆಯ್ಕೆಮಾಡಿ.", "emergency.pictureHint": "ಹೊಂದುವ ಚಿತ್ರವನ್ನು ಆಯ್ಕೆಮಾಡಿ. ವಿವರಗಳನ್ನು ನಂತರ ನೀಡಬಹುದು.",
    "emergency.flood": "ಪ್ರವಾಹ / ನೀರು", "emergency.medical": "ವೈದ್ಯಕೀಯ ಸಹಾಯ", "emergency.shelter": "ಸುರಕ್ಷಿತ ಸ್ಥಳ ಬೇಕು", "emergency.stepLocation": "ಹಂತ 2",
    "emergency.shareLocation": "ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ", "emergency.gpsHint": "ಸುರಕ್ಷಿತವಾಗಿದ್ದಾಗ ಮಾತ್ರ GPS ಬಳಸಿ.",
    "emergency.shareMyLocation": "ನನ್ನ ಸ್ಥಳವನ್ನು ಹಂಚಿಕೊಳ್ಳಿ", "emergency.locationMissing": "ಸ್ಥಳ ಇನ್ನೂ ಹಂಚಿಕೊಳ್ಳಲಾಗಿಲ್ಲ", "emergency.stepPeople": "ಹಂತ 3",
    "emergency.people": "ಎಷ್ಟು ಜನರು?", "emergency.moreDetails": "ಹೆಚ್ಚಿನ ವಿವರಗಳು (ಐಚ್ಛಿಕ)", "emergency.landmark": "ಗುರುತಿನ ಸ್ಥಳ ಅಥವಾ ವಿಳಾಸ",
    "emergency.send": "ಈಗ SOS ಕಳುಹಿಸಿ", "emergency.saveOffline": "ಸಿಗ್ನಲ್ ಮರಳುವವರೆಗೆ SOS ಉಳಿಸಿ",
    "track.private": "ಖಾಸಗಿ SOS", "track.heading": "ನನ್ನ ರಕ್ಷಣೆ ಎಲ್ಲಿದೆ?", "track.intro": "ಖಾಸಗಿ SOS ಕೋಡ್ ನಮೂದಿಸಿ.", "track.code": "ಖಾಸಗಿ SOS ಕೋಡ್", "track.see": "ನೋಡಿ",
    "track.pending": "ನಿಮ್ಮ SOS ನಿಯಂತ್ರಣ ತಂಡದ ಬಳಿ ಇದೆ", "track.dispatched": "ರಕ್ಷಣಾ ತಂಡ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ", "track.resolved": "ತಂಡ ಈ ಕಾರ್ಯವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದೆ", "track.safetyNote": "ಕಾಯುವ ಸಮಯದಲ್ಲಿ ಸ್ಥಳೀಯ ಸುರಕ್ಷತಾ ಸೂಚನೆಗಳನ್ನು ಅನುಸರಿಸಿ.",
    "responder.workspace": "ಪ್ರತಿಕ್ರಿಯಾಕಾರ ಕಾರ್ಯಕ್ಷೇತ್ರ", "responder.role": "ಕ್ಷೇತ್ರ ಪ್ರತಿಕ್ರಿಯಾಕಾರ", "responder.missions": "ನನ್ನ ಕಾರ್ಯಗಳು", "responder.map": "ಕ್ಷೇತ್ರ ನಕ್ಷೆ", "responder.alerts": "ಎಚ್ಚರಿಕೆಗಳು", "responder.readiness": "ಕ್ಷೇತ್ರ ಸಿದ್ಧತೆ", "responder.available": "ಲಭ್ಯ", "responder.onMission": "ಕಾರ್ಯದಲ್ಲಿದೆ", "responder.offDuty": "ಕರ್ತವ್ಯದಿಂದ ಹೊರಗೆ",
    "responder.board": "ಕಾರ್ಯ ಫಲಕ", "responder.dispatched": "ಕಳುಹಿಸಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ", "responder.resolved": "ಪೂರ್ಣಗೊಂಡಿದೆ ಎಂದು ಗುರುತಿಸಿ", "responder.completed": "ಪೂರ್ಣಗೊಂಡಿದೆ", "responder.people": "ಜನರು", "responder.priority": "ಆದ್ಯತೆ", "responder.noMission": "ಯಾವುದೇ ಕಾರ್ಯ ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ.", "responder.profilePending": "ಪ್ರೊಫೈಲ್ ಬಾಕಿ ಇದೆ",
    "command.workspace": "ನಿರ್ವಾಹಕ ಕಮಾಂಡ್ ಕೇಂದ್ರ", "command.role": "ತುರ್ತು ಸಮನ್ವಯ", "command.operations": "ಕಾರ್ಯಾಚರಣೆ ಫಲಕ", "command.map": "ಲೈವ್ ನಕ್ಷೆ", "command.shelters": "ಆಶ್ರಯಗಳು", "command.hospitals": "ಆಸ್ಪತ್ರೆಗಳು ಮತ್ತು ಸಂಪನ್ಮೂಲಗಳು", "command.requests": "ಪ್ರತಿಕ್ರಿಯಾಕಾರ ವಿನಂತಿಗಳು", "command.team": "ತಂಡ ಪಟ್ಟಿ", "command.heading": "ಆತ್ಮವಿಶ್ವಾಸದಿಂದ ನಿರ್ಧಾರ ತೆಗೆದುಕೊಳ್ಳಿ.", "command.allCases": "ಎಲ್ಲಾ ಪ್ರಕರಣಗಳು", "command.pending": "ಬಾಕಿ ಇದೆ", "command.dispatched": "ರವಾನಿಸಲಾಗಿದೆ", "command.resolved": "ಪರಿಹರಿಸಲಾಗಿದೆ", "dashboard.signIn": "ಸೈನ್ ಇನ್ ಮಾಡಿ", "dashboard.signOut": "ಸೈನ್ ಔಟ್", "dashboard.liveWorkspace": "ಲೈವ್ ಕಾರ್ಯಾಚರಣೆಗಳ ಕಾರ್ಯಕ್ಷೇತ್ರ",
  },
};

export function resolveLocale(value: string | null | undefined): Locale {
  return localeOptions.some(option => option.code === value) ? value as Locale : "en";
}

export function translate(locale: Locale, key: string, values?: Record<string, string | number>, operationalTerms?: Partial<Record<Locale, Record<string, string>>>): string {
  const template = operationalTerms?.[locale]?.[key] || currentInterfaceTerms[locale]?.[key] || messages[locale]?.[key] || universalTerms[key]?.[locale] || messages.en[key] || key;
  return values ? Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template) : template;
}

type LanguageContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string, values?: Record<string, string | number>) => string };
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("lang");
    if (requested && localeOptions.some(option => option.code === requested)) return requested as Locale;
    const stored = typeof window === "undefined" ? null : localStorage.getItem(storageKey);
    if (stored) return resolveLocale(stored);
    const browser = typeof navigator === "undefined" ? "en" : navigator.language.slice(0, 2);
    return resolveLocale(browser);
  });
  const [operationalTerms, setOperationalTerms] = useState<Partial<Record<Locale, Record<string, string>>>>({});

  const setLocale = useCallback((nextLocale: Locale) => {
    const next = resolveLocale(nextLocale);
    setLocaleState(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    void fetch(getApiUrl("/storage/operational-language-pack_86163712.json"))
      .then(response => response.ok ? response.json() : {})
      .then((data: Partial<Record<Locale, Record<string, string>>>) => setOperationalTerms(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  // Build a reverse translation index for seamless bidirectional multi-language switching
  const reverseIndex = useMemo(() => {
    const map = new Map<string, string>();
    const register = (englishKey: string, foreignVal: string) => {
      const trimmedVal = foreignVal.trim();
      const trimmedEn = englishKey.trim();
      if (trimmedVal && trimmedEn && trimmedVal !== trimmedEn) {
        map.set(trimmedVal, trimmedEn);
      }
    };

    // Index currentInterfaceTerms
    for (const loc of Object.keys(currentInterfaceTerms) as Locale[]) {
      if (loc === "en") continue;
      const dict = currentInterfaceTerms[loc];
      if (dict) {
        for (const [enKey, foreignVal] of Object.entries(dict)) {
          register(enKey, foreignVal);
        }
      }
    }

    // Index messages
    for (const loc of Object.keys(messages) as Locale[]) {
      if (loc === "en") continue;
      const dict = messages[loc];
      if (dict) {
        for (const [msgKey, foreignVal] of Object.entries(dict)) {
          const englishVal = messages.en[msgKey];
          // Only register actual human-readable English phrases, never internal dot-notated keys
          if (englishVal && !englishVal.includes(".") && englishVal !== foreignVal) {
            register(englishVal, foreignVal);
          }
        }
      }
    }

    // Index operational terms
    for (const loc of Object.keys(operationalTerms) as Locale[]) {
      if (loc === "en") continue;
      const dict = operationalTerms[loc];
      if (dict) {
        for (const [enKey, foreignVal] of Object.entries(dict)) {
          if (enKey && !enKey.includes(".") && enKey !== foreignVal) {
            register(enKey, foreignVal);
          }
        }
      }
    }

    return map;
  }, [operationalTerms]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const terms: Record<string, string> = {
      ...(currentInterfaceTerms[locale] || {}),
      ...(operationalTerms[locale] || {}),
    };

    const isIgnoredElement = (el: Element): boolean => {
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "SVG" || tag === "CANVAS" || tag === "NOSCRIPT" || tag === "OPTION") return true;
      if (el.hasAttribute("data-no-operational-translation") || el.getAttribute("contenteditable") === "true") return true;
      if (el.closest?.("[data-no-operational-translation]")) return true;
      if (el.classList && (el.classList.contains("leaflet-container") || el.classList.contains("leaflet-pane"))) return true;
      return false;
    };

    const applyText = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || isIgnoredElement(parent)) return;
      const raw = node.nodeValue;
      if (!raw || !raw.trim()) return;

      const leadingWs = raw.match(/^\s*/)?.[0] || "";
      const trailingWs = raw.match(/\s*$/)?.[0] || "";
      const trimmed = raw.trim();

      // Resolve original English source
      let source = originalText.get(node);
      if (!source) {
        source = reverseIndex.get(trimmed) || trimmed;
        originalText.set(node, source);
      }

      let target: string | undefined;
      if (locale === "en") {
        target = source;
      } else {
        target = terms[source] || messages[locale]?.[source] || universalTerms[source]?.[locale];
      }

      if (target !== undefined) {
        const fullTarget = leadingWs + target + trailingWs;
        if (node.nodeValue !== fullTarget) {
          node.nodeValue = fullTarget;
        }
      }
    };

    const applyElement = (element: Element) => {
      if (isIgnoredElement(element)) return;
      let attributes = originalAttributes.get(element);
      if (!attributes) {
        attributes = new Map<string, string>();
        originalAttributes.set(element, attributes);
      }

      for (const name of ["placeholder", "title", "aria-label"]) {
        const currentAttr = element.getAttribute(name);
        if (!currentAttr) continue;
        const trimmed = currentAttr.trim();
        if (!trimmed) continue;

        let source = attributes.get(name);
        if (!source) {
          source = reverseIndex.get(trimmed) || trimmed;
          attributes.set(name, source);
        }

        let target: string | undefined;
        if (locale === "en") {
          target = source;
        } else {
          target = terms[source] || messages[locale]?.[source] || universalTerms[source]?.[locale];
        }

        if (target !== undefined && currentAttr !== target) {
          element.setAttribute(name, target);
        }
      }
    };

    const filterNode = (node: Node): number => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (isIgnoredElement(node as Element)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const val = node.nodeValue;
        if (!val || !val.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (parent && isIgnoredElement(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    };

    const applyTree = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyText(root as Text);
        return;
      }
      if (root.nodeType === Node.ELEMENT_NODE) {
        const el = root as Element;
        if (isIgnoredElement(el)) return;
        applyElement(el);
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: filterNode,
      });
      let current: Node | null;
      while ((current = walker.nextNode())) {
        if (current.nodeType === Node.TEXT_NODE) {
          applyText(current as Text);
        } else if (current.nodeType === Node.ELEMENT_NODE) {
          applyElement(current as Element);
        }
      }
    };

    // Run pass immediately on locale change
    applyTree(document.body);

    // If English, all text has been restored to default. No background DOM observer needed!
    if (locale === "en") return;

    let pendingNodes: Node[] = [];
    let frameId: number | null = null;

    const processPending = () => {
      frameId = null;
      const nodes = pendingNodes;
      pendingNodes = [];
      for (const node of nodes) {
        if (document.body.contains(node)) {
          applyTree(node);
        }
      }
    };

    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (isIgnoredElement(node as Element)) return;
          }
          pendingNodes.push(node);
        });
      }
      if (pendingNodes.length > 0 && frameId === null) {
        frameId = typeof window !== "undefined" && window.requestAnimationFrame
          ? window.requestAnimationFrame(processPending)
          : (setTimeout(processPending, 50) as any);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: false });
    return () => {
      if (frameId !== null) {
        if (typeof window !== "undefined" && window.cancelAnimationFrame) window.cancelAnimationFrame(frameId);
        else clearTimeout(frameId);
      }
      observer.disconnect();
    };
  }, [locale, operationalTerms, reverseIndex]);

  const t = useCallback((key: string, values?: Record<string, string | number>) => translate(locale, key, values, operationalTerms), [locale, operationalTerms]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      locale: "en",
      setLocale: () => {},
      t: (key: string) => key,
    };
  }
  return context;
}
