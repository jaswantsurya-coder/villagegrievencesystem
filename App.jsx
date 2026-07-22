import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase, supabaseConfigError, ensureUUID } from "./supabaseClient";
import { useTranslation } from 'react-i18next';
import './i18n'; // initialize i18n
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart3, Building2, CalendarDays, Camera, Check, CircleAlert, CircleDot,
  Clock3, Construction, Download, Droplets, Ellipsis, FileText, FolderOpen,
  GraduationCap, HeartPulse, Images, Leaf, MapPin, Menu, Moon, Search,
  ShieldCheck, Sparkles, Star, Sun, TrendingUp, X, Zap
} from 'lucide-react';

const EVIDENCE_BUCKET = "complaint-evidence";
const MAX_EVIDENCE_PHOTOS = 10;
const MAX_EVIDENCE_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_EVIDENCE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const EVIDENCE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

// Help feature web portal links (Phase 2)
// Change these to real URLs (e.g. "https://request.gramseva.in", "https://support.gramseva.in") once available
const PORTAL_LINKS = {
  requestAdmin: import.meta.env.VITE_REQUEST_ADMIN_URL || "",
  reportBugs: import.meta.env.VITE_REPORT_BUGS_URL || "",
  feedback: import.meta.env.VITE_FEEDBACK_URL || "",
};

/** @typedef {"gallery"|"camera"} EvidencePhotoSource */

/**
 * @typedef {Object} ImageValidationResult
 * @property {boolean} valid
 * @property {string} error
 */

/**
 * @typedef {Object} EvidencePhoto
 * @property {File} file
 * @property {string} previewUrl
 * @property {string} name
 * @property {string} size
 * @property {string=} error
 * @property {EvidencePhotoSource=} source
 */

/**
 * @typedef {Object} ComplaintRecord
 * @property {string=} id
 * @property {string=} ticket_id
 * @property {string=} title
 * @property {string=} description
 * @property {string=} location
 * @property {string=} category
 * @property {string=} status
 * @property {string=} citizen_id
 * @property {number=} edit_count
 * @property {string=} updated_at
 * @property {string|string[]=} photo_urls
 * @property {Array<string|{url?: string}>=} photos
 */

/**
 * @typedef {Object} GrievanceEditForm
 * @property {string} title
 * @property {string} description
 * @property {string} location
 * @property {string[]} categories
 * @property {string} duration
 * @property {string} peopleAffected
 * @property {boolean} isEmergency
 */

/**
 * @typedef {Object} ComplaintHistoryInsert
 * @property {string} complaint_id
 * @property {string} user_id
 * @property {string} old_title
 * @property {string} new_title
 * @property {string} old_description
 * @property {string} new_description
 * @property {string[]} old_photo_urls
 * @property {string[]} new_photo_urls
 */

const THEME = {
  colors: {
    primary: "var(--color-primary)", 
    primaryHover: "var(--color-primary-hover)",
    primaryLight: "var(--color-primary-light)",
    surface: "var(--color-surface)",
    background: "var(--color-background)",
    text: "var(--color-text)",
    textMuted: "var(--color-text-muted)",
    border: "var(--color-border)",
    danger: "var(--color-danger)",
    dangerBg: "var(--color-danger-bg)",
    success: "var(--color-success)",
    successBg: "var(--color-success-bg)",
    warning: "#d97706",
    warningBg: "#fffbeb",
    dark: "var(--color-surface)"
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    full: "9999px"
  },
  shadow: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
    lg: "0 10px 25px -5px rgba(0, 0, 0, 0.05)"
  },
  font: "'Inter', 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Telugu', -apple-system, BlinkMacSystemFont, sans-serif"
};

const CATEGORIES = [
  { id: "Road & Infrastructure", key: "cat_road", icon: "🛣", iconName: "road", color: "#f97316", bg: "rgba(249,115,22,0.14)" },
  { id: "Water Supply", key: "cat_water", icon: "💧", iconName: "water", color: "#0ea5e9", bg: "rgba(14,165,233,0.14)" },
  { id: "Electricity", key: "cat_electricity", icon: "⚡", iconName: "electricity", color: "#eab308", bg: "rgba(234,179,8,0.14)" },
  { id: "Sanitation", key: "cat_sanitation", icon: "🧹", iconName: "sanitation", color: "#14b8a6", bg: "rgba(20,184,166,0.14)" },
  { id: "Education", key: "cat_education", icon: "📚", iconName: "education", color: "#8b5cf6", bg: "rgba(139,92,246,0.14)" },
  { id: "Health Services", key: "cat_health", icon: "🏥", iconName: "health", color: "#ec4899", bg: "rgba(236,72,153,0.14)" },
  { id: "Agriculture", key: "cat_agriculture", icon: "🌾", iconName: "agriculture", color: "#22c55e", bg: "rgba(34,197,94,0.14)" },
  { id: "Other", key: "cat_other", icon: "📌", iconName: "other", color: "#94a3b8", bg: "rgba(148,163,184,0.14)" },
];

const STATUS_FLOW = ["Open", "Assigned", "In Progress", "Resolved", "Closed", "Escalated"];
const STATUS_META = {
  Open:          { color: THEME.colors.danger, bg: THEME.colors.dangerBg, border: "#fca5a5", icon: "🔴", iconName: "dot" },
  Assigned:      { color: THEME.colors.warning, bg: THEME.colors.warningBg, border: "#fcd34d", icon: "🟡", iconName: "dot" },
  "In Progress": { color: THEME.colors.primary, bg: THEME.colors.primaryLight, border: "#7dd3fc", icon: "🔵", iconName: "dot" },
  Resolved:      { color: THEME.colors.success, bg: THEME.colors.successBg, border: "#86efac", icon: "🟢", iconName: "dot" },
  Closed:        { color: THEME.colors.textMuted, bg: "#f1f5f9", border: "#cbd5e1", icon: "⚫", iconName: "dot" },
  Escalated:     { color: "#ea580c", bg: "#ffedd5", border: "#fdba74", icon: "🔥", iconName: "alert" },
  Urgent:        { color: THEME.colors.surface, bg: THEME.colors.danger, border: THEME.colors.danger, icon: "🔥", iconName: "alert" },
};

const ICONS = {
  agriculture: Leaf, alert: CircleAlert, building: Building2, camera: Camera,
  chart: BarChart3, clock: Clock3, dot: CircleDot, download: Download,
  calendar: CalendarDays, education: GraduationCap, electricity: Zap, file: FileText,
  folder: FolderOpen, gallery: Images, health: HeartPulse, location: MapPin,
  moon: Moon, other: Ellipsis, road: Construction, sanitation: Sparkles,
  search: Search, shield: ShieldCheck, star: Star, sun: Sun, trend: TrendingUp,
  water: Droplets,
};

const AppIcon = ({ name, size = 18, color = "currentColor", strokeWidth = 2, style }) => {
  const Icon = ICONS[name] || Ellipsis;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} style={style} aria-hidden="true" />;
};

const CategoryIcon = ({ category, size = 24 }) => (
  <span style={{ width: 44, height: 44, borderRadius: 14, background: category.bg, color: category.color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
    <AppIcon name={category.iconName} size={size} strokeWidth={2.2} />
  </span>
);

const CategoryCard = ({ category, selected, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    style={{ minHeight: 142, padding: "18px 12px", borderRadius: THEME.radius.md, border: `1.5px solid ${selected ? THEME.colors.primary : THEME.colors.border}`, background: selected ? THEME.colors.primaryLight : THEME.colors.surface, cursor: "pointer", textAlign: "center", transition: "transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease", transform: selected ? "translateY(-2px)" : "translateY(0)", boxShadow: selected ? "0 8px 18px rgba(2,132,199,0.14)" : "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, position: "relative", fontFamily: THEME.font }}
  >
    {selected && <span style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: THEME.colors.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13} strokeWidth={3} /></span>}
    <CategoryIcon category={category} />
    <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, color: selected ? THEME.colors.primaryHover : THEME.colors.text }}>{label}</span>
  </button>
);

const SPEECH_LANGS = [
  { code: "en-US", label: "English", flag: "🇬🇧" },
  { code: "hi-IN", label: "हिन्दी", flag: "🇮🇳" },
  { code: "te-IN", label: "తెలుగు", flag: "🇮🇳" },
];

const getSpeechLangFromAppLang = (language = "en") => {
  const baseLang = language.split("-")[0];
  if (baseLang === "hi") return "hi-IN";
  if (baseLang === "te") return "te-IN";
  return "en-US";
};

const GOVERNMENT_SCHEMES = [
  { id: "mgnrega", name: "MGNREGA", key: "scheme_mgnrega", icon: "👷", category: "Employment", url: "https://nrega.nic.in/" },
  { id: "pmay", name: "PM Awas Yojana", key: "scheme_pmay", icon: "🏠", category: "Housing", url: "https://pmaymis.gov.in/" },
  { id: "jjm", name: "Jal Jeevan Mission", key: "scheme_jjm", icon: "💧", category: "Water", url: "https://jaljeevanmission.gov.in/" },
  { id: "sbm", name: "Swachh Bharat Mission", key: "scheme_sbm", icon: "🧹", category: "Sanitation", url: "https://swachhbharatmission.gov.in/" },
  { id: "pmkisan", name: "PM-KISAN", key: "scheme_pmkisan", icon: "🌾", category: "Agriculture", url: "https://pmkisan.gov.in/" },
  { id: "ayushman", name: "Ayushman Bharat", key: "scheme_ayushman", icon: "🏥", category: "Health", url: "https://pmjay.gov.in/" },
  { id: "ddugky", name: "DDU-GKY", key: "scheme_ddugky", icon: "🎓", category: "Skill Development", url: "https://ddugky.gov.in/" },
  { id: "nrlm", name: "NRLM", key: "scheme_nrlm", icon: "🤝", category: "Livelihoods", url: "https://nrlm.gov.in/" },
];

// ─── Point-in-polygon (ray casting) for boundary checking ─────────────────
const pointInPolygon = (point, polygon) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInGeoJSON = (lat, lng, geojson) => {
  if (!geojson || !geojson.features) return true; // No boundary = always inside
  for (const feature of geojson.features) {
    if (feature.geometry.type === "Polygon") {
      const coords = feature.geometry.coordinates[0].map(c => [c[0], c[1]]);
      if (pointInPolygon([lng, lat], coords)) return true;
    } else if (feature.geometry.type === "MultiPolygon") {
      for (const poly of feature.geometry.coordinates) {
        const coords = poly[0].map(c => [c[0], c[1]]);
        if (pointInPolygon([lng, lat], coords)) return true;
      }
    }
  }
  return false;
};

// ─── Offline Queue Helper ─────────────────────────────────────────────────────

const OFFLINE_KEY = "offline_complaints";

const getOfflineQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
  } catch { return []; }
};

const addToOfflineQueue = (complaint) => {
  const queue = getOfflineQueue();
  queue.push({ ...complaint, _offlineId: Date.now() });
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("offline-queue-updated"));
};

const clearOfflineQueue = () => {
  localStorage.removeItem(OFFLINE_KEY);
  window.dispatchEvent(new Event("offline-queue-updated"));
};

const removeFromOfflineQueue = (offlineId) => {
  const queue = getOfflineQueue();
  const updated = queue.filter(item => item._offlineId !== offlineId);
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("offline-queue-updated"));
};

const toPhotoUrl = (value) => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value.url === "string") return value.url.trim();
  return "";
};

/** @param {ComplaintRecord | null | undefined} item */
const getComplaintPhotoUrls = (item) => {
  const raw = item?.photo_urls ?? item?.photos ?? [];
  let parsed = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw ? [raw] : [];
    }
  }

  return (Array.isArray(parsed) ? parsed : [])
    .map(toPhotoUrl)
    .filter(Boolean);
};

const getFileExtension = (file) => {
  const fromName = file.name?.split(".").pop()?.toLowerCase();
  if (fromName && fromName !== file.name.toLowerCase()) return fromName.replace(/[^a-z0-9]/g, "") || "jpg";
  return file.type?.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg";
};

/**
 * @param {EvidencePhoto[]} photos
 * @param {{ ticketId: string, userId?: string | null }} options
 * @returns {Promise<string[]>}
 */
const uploadEvidencePhotos = async (photos, { ticketId, userId }) => {
  if (!photos?.length) return [];

  const uploaded = await Promise.all(photos.map(async (photo, index) => {
    const extension = getFileExtension(photo.file);
    const safeTicketId = ticketId.replace(/[^a-zA-Z0-9_-]/g, "");
    const folder = userId || "anonymous";
    const unique = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}`;
    const storagePath = `${folder}/${safeTicketId}/${unique}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, photo.file, {
        cacheControl: "3600",
        contentType: photo.file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) throw new Error("Could not generate public URL for uploaded evidence.");
    return data.publicUrl;
  }));

  return uploaded.filter(Boolean);
};

const EDITABLE_STATUSES = ["Open", "Assigned"];

const canEditComplaint = (complaint) => EDITABLE_STATUSES.includes(complaint?.status);

const parseComplaintDescription = (description = "") => {
  const marker = "\n\n--- Additional Details ---\n";
  const [mainDescription, details = ""] = String(description || "").split(marker);
  const duration = details.match(/Duration:\s*(.*)/)?.[1]?.trim() || "Just started";
  const emergencyValue = details.match(/Emergency:\s*(.*)/)?.[1]?.trim().toLowerCase() || "no";
  const peopleAffected = details.match(/People Affected:\s*(.*)/)?.[1]?.trim() || "";

  return {
    description: mainDescription || "",
    duration,
    isEmergency: emergencyValue === "yes",
    peopleAffected: peopleAffected === "Not specified" ? "" : peopleAffected,
  };
};

const buildComplaintDescription = ({ description, duration, isEmergency, peopleAffected }) => (
  `${description}\n\n--- Additional Details ---\nDuration: ${duration || "Just started"}\nEmergency: ${isEmergency ? "Yes" : "No"}\nPeople Affected: ${peopleAffected || "Not specified"}`
);

const splitCategories = (category = "") => String(category || "")
  .split(",")
  .map(part => part.trim())
  .filter(Boolean);

const getHistoryInsertErrorMessage = (error) => {
  const message = error?.message || "";
  if (message.toLowerCase().includes("row-level security") && message.includes("complaint_history")) {
    return "Complaint history RLS policy is missing. Run fix-complaint-history-rls.sql in Supabase SQL Editor, then try again.";
  }
  return message || "Failed to save complaint history.";
};

const getEvidenceStoragePathFromUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    const publicPrefix = `/storage/v1/object/public/${EVIDENCE_BUCKET}/`;
    const objectPrefix = `/storage/v1/object/${EVIDENCE_BUCKET}/`;
    const prefix = parsed.pathname.includes(publicPrefix) ? publicPrefix : objectPrefix;
    const index = parsed.pathname.indexOf(prefix);
    if (index === -1) return "";
    return decodeURIComponent(parsed.pathname.slice(index + prefix.length));
  } catch {
    const marker = `${EVIDENCE_BUCKET}/`;
    const index = url.indexOf(marker);
    return index === -1 ? "" : decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  }
};

// ─── Push Notification Helper ─────────────────────────────────────────────────

const requestPushPermission = async () => {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
};

const showBrowserNotification = (title, body) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏘</text></svg>",
      vibrate: [200, 100, 200],
    });
  }
};

// ─── Helper Components ────────────────────────────────────────────────────────

const Badge = ({ status, priority }) => {
  const { t } = useTranslation();
  const m = STATUS_META[status] || STATUS_META.Open;
  const p = STATUS_META.Urgent;
  const statusKey = `status_${status.toLowerCase().replace(" ", "_")}`;
  
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {priority === "Urgent" && (
        <span style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}`, padding: "4px 12px", borderRadius: THEME.radius.full, fontSize: 11, fontWeight: 700, fontFamily: THEME.font, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
          {p.icon} {t('priority_urgent').toUpperCase()}
        </span>
      )}
      <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, padding: "4px 12px", borderRadius: THEME.radius.full, fontSize: 11, fontWeight: 600, fontFamily: THEME.font, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        {m.icon} {t(statusKey)}
      </span>
    </div>
  );
};

const Input = ({ label, prefix, style: s, ...props }) => (
  <div style={{ marginBottom: 18 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{label}</label>}
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 600, color: THEME.colors.text, fontFamily: THEME.font }}>{prefix}</span>}
      <input style={{ width: "100%", padding: "12px 14px", paddingLeft: prefix ? 45 : 14, border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 14, fontFamily: THEME.font, outline: "none", boxSizing: "border-box", background: THEME.colors.surface, color: THEME.colors.text, transition: "border-color 0.2s", minHeight: 44, ...s }} {...props} />
    </div>
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div style={{ marginBottom: 18 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{label}</label>}
    <textarea style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 14, fontFamily: THEME.font, outline: "none", boxSizing: "border-box", background: THEME.colors.surface, color: THEME.colors.text, resize: "vertical", minHeight: 110, transition: "border-color 0.2s" }} {...props} />
  </div>
);

const Btn = ({ children, variant = "primary", full, style: s, disabled, ...props }) => {
  const V = {
    primary: { background: THEME.colors.primary, color: THEME.colors.surface, border: "none" },
    outline:  { background: "transparent", color: THEME.colors.primary, border: `1.5px solid ${THEME.colors.primary}` },
    ghost:    { background: "transparent", color: THEME.colors.textMuted, border: "none" },
    dark:     { background: THEME.colors.dark, color: THEME.colors.surface, border: "none" },
  };
  return (
    <button disabled={disabled} style={{ ...V[variant], padding: "10px 20px", borderRadius: THEME.radius.sm, fontFamily: THEME.font, fontWeight: 700, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", width: full ? "100%" : undefined, transition: "transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.5 : 1, touchAction: "manipulation", boxShadow: variant === "primary" ? "0 6px 16px rgba(2,132,199,0.18)" : "none", ...s }} {...props}>
      {children}
    </button>
  );
};

// ─── Star Rating Component ────────────────────────────────────────────────────

const StarRating = ({ rating, onRate, readonly = false, size = 28 }) => {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4, cursor: readonly ? "default" : "pointer" }}>
      {[1, 2, 3, 4, 5].map(star => (
        <span
          key={star}
          onClick={() => !readonly && onRate && onRate(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            fontSize: size,
            color: star <= (hover || rating) ? "#f59e0b" : "#d1d5db",
            transition: "all 0.15s",
            transform: star <= (hover || rating) ? "scale(1.15)" : "scale(1)",
            filter: star <= (hover || rating) ? "drop-shadow(0 2px 4px rgba(245,158,11,0.4))" : "none",
          }}
        >★</span>
      ))}
    </div>
  );
};

// ─── Voice Input Button Component ─────────────────────────────────────────────

const VoiceWaveformIcon = ({ listening = false }) => (
  <span style={{
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}>
    {listening ? (
      <span style={{ width: 13, height: 13, borderRadius: 2, background: "#111" }} />
    ) : (
      <svg width="25" height="25" viewBox="0 0 25 25" fill="none" aria-hidden="true">
        <rect x="4" y="10" width="3" height="5" rx="1.5" fill="#111" />
        <rect x="9" y="6" width="3" height="13" rx="1.5" fill="#111" />
        <rect x="14" y="8" width="3" height="9" rx="1.5" fill="#111" />
        <rect x="19" y="10" width="3" height="5" rx="1.5" fill="#111" />
      </svg>
    )}
  </span>
);

const VoiceInputBtn = ({ onTranscript, lang = "en-US", notify }) => {
  const { t } = useTranslation();
  const [speechLang, setSpeechLang] = useState(lang);
  const [voiceStatus, setVoiceStatus] = useState("");
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  useEffect(() => {
    setSpeechLang(lang);
  }, [lang]);

  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript]);

  if (!browserSupportsSpeechRecognition) {
    return <span style={{ fontSize: 11, color: THEME.colors.textMuted }}>{t('voice_not_supported')}</span>;
  }

  const startVoiceRecognition = async (language) => {
    const recognition = SpeechRecognition.getRecognition();
    if (recognition) recognition.lang = language;
    await SpeechRecognition.startListening({ continuous: true, language });
  };

  const handleLanguageChange = async (event) => {
    const nextLang = event.target.value;
    setSpeechLang(nextLang);

    if (!listening) return;

    try {
      setVoiceStatus("Switching language...");
      await SpeechRecognition.stopListening();
      resetTranscript();
      await startVoiceRecognition(nextLang);
      setVoiceStatus("");
      notify?.(`Voice language changed to ${SPEECH_LANGS.find(l => l.code === nextLang)?.label || nextLang}.`);
    } catch (err) {
      setVoiceStatus("");
      notify?.(err?.message || "Could not switch voice language. Please stop and start the mic again.", "err");
    }
  };

  const toggleListening = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (listening) {
      await SpeechRecognition.stopListening();
      setVoiceStatus("");
      return;
    }

    try {
      if (!window.isSecureContext) {
        notify?.("Voice input needs HTTPS or localhost to access the microphone.", "err");
        return;
      }

      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "microphone" });
          if (permission.state === "denied") {
            notify?.("Microphone permission is blocked. Allow it from the browser site settings.", "err");
            return;
          }
        } catch {
          // Browser does not expose microphone permission queries.
        }
      }

      setVoiceStatus("Starting microphone...");
      resetTranscript();
      await startVoiceRecognition(speechLang);
      setVoiceStatus("");
      
      // Hook into native speech recognition to capture errors (like permission denied)
      setTimeout(() => {
        const recognition = SpeechRecognition.getRecognition();
        if (recognition) {
          recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            if (event.error === 'not-allowed') {
              notify?.("Microphone permission denied. Please allow microphone access in your browser settings.", "err");
            } else if (event.error === 'no-speech') {
              setVoiceStatus("Listening... speak now");
            } else {
              notify?.(`Voice input error: ${event.error}`, "err");
            }
          };
        }
      }, 150);
    } catch (err) {
      setVoiceStatus("");
      notify?.(err?.message || "Could not start voice input. Check microphone permission and try again.", "err");
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
      <button
        type="button"
        onClick={toggleListening}
        style={{
          background: listening ? THEME.colors.danger : "#242424",
          border: "none",
          width: 56,
          height: 56,
          borderRadius: 18,
          cursor: "pointer",
          flex: "0 0 56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s",
          animation: listening ? "urgentPulse 1.5s infinite" : "none",
          boxShadow: listening ? "0 0 20px rgba(220,38,38,0.4)" : "0 4px 12px rgba(0,0,0,0.25)",
        }}
        title={listening ? t('stop_voice') : t('start_voice')}
      >
        <VoiceWaveformIcon listening={listening} />
      </button>
      <select
        value={speechLang}
        onChange={handleLanguageChange}
        style={{
          padding: "8px 12px",
          borderRadius: THEME.radius.sm,
          border: `1.5px solid ${THEME.colors.border}`,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: THEME.font,
          background: THEME.colors.surface,
          color: THEME.colors.text,
          outline: "none",
          cursor: "pointer",
        }}
      >
        {SPEECH_LANGS.map(l => (
          <option key={l.code} value={l.code}>{l.code} - {l.label}</option>
        ))}
      </select>
      {listening && (
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: THEME.colors.danger,
          animation: "urgentPulse 1.5s infinite",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          🔴 {t('listening')}
        </span>
      )}
      {!listening && voiceStatus && (
        <span style={{ fontSize: 12, fontWeight: 700, color: THEME.colors.primary }}>
          {voiceStatus}
        </span>
      )}
    </div>
  );
};

const PhotoUpload = ({ photos, setPhotos, disabled = false, uploadError = "" }) => {
  const { t } = useTranslation();
  const galleryRef = useRef();
  const cameraRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");

  /** @returns {ImageValidationResult} */
  const validateImageFile = (file) => {
    const type = (file.type || "").toLowerCase();
    if (!ACCEPTED_EVIDENCE_TYPES.has(type)) return { valid: false, error: `${file.name}: only JPG, PNG, or WEBP images are supported.` };
    if (file.size > MAX_EVIDENCE_PHOTO_BYTES) return { valid: false, error: `${file.name}: image must be 5MB or smaller.` };
    return { valid: true, error: "" };
  };

  const processFiles = (files, source = "gallery") => {
    if (!files || disabled) return;
    setLocalError("");

    const selected = Array.from(files);
    const remainingSlots = MAX_EVIDENCE_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      setLocalError(`Maximum ${MAX_EVIDENCE_PHOTOS} images allowed.`);
      return;
    }

    const accepted = [];
    const errors = [];
    selected.forEach(file => {
      const validation = validateImageFile(file);
      if (!validation.valid) errors.push(validation.error);
      else if (accepted.length < remainingSlots) accepted.push(file);
    });

    if (selected.length > remainingSlots) errors.push(`Only ${remainingSlots} more image${remainingSlots === 1 ? "" : "s"} can be added.`);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (errors.length > 0) setLocalError(errors[0]);
    if (accepted.length === 0) return;

    accepted.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        /** @type {EvidencePhoto} */
        const nextPhoto = {
          file,
          previewUrl: String(e.target?.result || ""),
          name: file.name || `${source}-photo.jpg`,
          size: (file.size / 1024).toFixed(1),
          source,
        };
        setPhotos(prev => [...prev, nextPhoto].slice(0, MAX_EVIDENCE_PHOTOS));
      };
      reader.onerror = () => {
        setPhotos(prev => [...prev, {
          file,
          previewUrl: "",
          name: file.name || `${source}-photo.jpg`,
          size: (file.size / 1024).toFixed(1),
          source,
          error: "Preview failed",
        }].slice(0, MAX_EVIDENCE_PHOTOS));
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i));
  const errorMessage = localError || uploadError;
  const hasRoom = photos.length < MAX_EVIDENCE_PHOTOS;

  const actionButtonStyle = (activeColor) => ({
    minHeight: 92,
    borderRadius: THEME.radius.md,
    border: `1.5px solid ${THEME.colors.border}`,
    background: THEME.colors.surface,
    color: THEME.colors.text,
    cursor: disabled || !hasRoom ? "not-allowed" : "pointer",
    opacity: disabled || !hasRoom ? 0.6 : 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: THEME.font,
    fontWeight: 800,
    fontSize: 13,
    boxShadow: THEME.shadow.sm,
  });

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, fontFamily: THEME.font }}>
          {t('photo_evidence')} <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: THEME.colors.textMuted }}>{t('optional_up_to', { count: MAX_EVIDENCE_PHOTOS })}</span>
        </label>
        <span style={{ fontSize: 12, fontWeight: 800, color: photos.length >= MAX_EVIDENCE_PHOTOS ? THEME.colors.danger : THEME.colors.primary }}>
          {t('photo_count', { current: photos.length, max: MAX_EVIDENCE_PHOTOS })}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
        <button type="button" disabled={disabled || !hasRoom} onClick={() => galleryRef.current?.click()} style={actionButtonStyle(THEME.colors.primary)}>
          <AppIcon name="gallery" size={26} color={THEME.colors.primary} />
          <span>{t('upload_from_gallery')}</span>
          <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 600 }}>{t('supported_image_types')}</span>
        </button>
        <button type="button" disabled={disabled || !hasRoom} onClick={() => cameraRef.current?.click()} style={actionButtonStyle(THEME.colors.success)}>
          <AppIcon name="camera" size={27} color={THEME.colors.success} />
          <span>{t('take_photo')}</span>
          <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 600 }}>{t('uses_rear_camera')}</span>
        </button>
      </div>

      <input ref={galleryRef} type="file" accept={EVIDENCE_ACCEPT} multiple disabled={disabled} style={{ display: "none" }} onChange={e => processFiles(e.target.files, "gallery")} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" disabled={disabled} style={{ display: "none" }} onChange={e => processFiles(e.target.files, "camera")} />

      {hasRoom && (
        <div onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files, "gallery"); }}
             style={{ border: `1.5px dashed ${dragging ? THEME.colors.primary : THEME.colors.border}`, borderRadius: THEME.radius.md, padding: "14px 16px", textAlign: "center", background: dragging ? THEME.colors.primaryLight : THEME.colors.background, color: THEME.colors.textMuted, fontSize: 12, fontWeight: 700, transition: "all 0.2s" }}>
          {t('drag_images_hint')}
        </div>
      )}

      {errorMessage && (
        <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: THEME.radius.sm, background: THEME.colors.dangerBg, color: THEME.colors.danger, fontSize: 12, fontWeight: 700 }}>
          {errorMessage}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px,1fr))", gap: 10, marginTop: 12 }}>
          {photos.map((p, i) => (
            <div key={`${p.name}-${i}`} style={{ position: "relative", borderRadius: THEME.radius.sm, overflow: "hidden", border: `1px solid ${p.error ? THEME.colors.danger : THEME.colors.border}`, background: THEME.colors.background, minHeight: 96 }}>
              {p.previewUrl ? (
                <img src={p.previewUrl} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} alt={p.name || "Evidence preview"} />
              ) : (
                <div style={{ aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.colors.textMuted, fontSize: 11, fontWeight: 700, textAlign: "center", padding: 8 }}>{p.error || "Preview unavailable"}</div>
              )}
              <button type="button" aria-label={`Remove ${p.name || "image"}`} disabled={disabled} onClick={() => removePhoto(i)} style={{ position: "absolute", top: 5, right: 5, background: "rgba(15,23,42,0.72)", border: "none", borderRadius: "50%", color: "#fff", width: 26, height: 26, cursor: disabled ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>x</button>
              <div style={{ position: "absolute", left: 5, bottom: 5, background: "rgba(15,23,42,0.72)", color: "#fff", borderRadius: THEME.radius.full, padding: "2px 7px", fontSize: 10, fontWeight: 800 }}>
                {p.source === "camera" ? t('camera_label') : t('gallery_label')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
const EvidenceThumbnail = ({ src, index, onClick }) => {
  const [broken, setBroken] = useState(false);
  const hasUrl = typeof src === "string" && src.trim().length > 0;

  return (
    <button type="button" onClick={hasUrl && !broken ? onClick : undefined} disabled={!hasUrl || broken} style={{ cursor: hasUrl && !broken ? "pointer" : "default", borderRadius: THEME.radius.sm, overflow: "hidden", border: `2px solid ${broken || !hasUrl ? THEME.colors.dangerBg : THEME.colors.border}`, transition: "border-color 0.2s", position: "relative", padding: 0, background: THEME.colors.background, minHeight: 70 }}
         onMouseOver={e => { if (hasUrl && !broken) e.currentTarget.style.borderColor = THEME.colors.primary; }}
         onMouseOut={e => { e.currentTarget.style.borderColor = broken || !hasUrl ? THEME.colors.dangerBg : THEME.colors.border; }}>
      {hasUrl && !broken ? (
        <>
          <img src={src} onError={() => setBroken(true)} style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} alt={`Evidence photo ${index + 1}`} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
               onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
               onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
            <span style={{ color: "#fff", fontSize: 12, opacity: 0.95, fontWeight: 800 }}>View</span>
          </div>
        </>
      ) : (
        <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", color: THEME.colors.textMuted, fontSize: 11, fontWeight: 700, textAlign: "center", padding: 8 }}>
          {hasUrl ? "Image unavailable" : "Missing URL"}
        </div>
      )}
    </button>
  );
};

const EditGrievanceModal = ({ complaint, session, notify, t, onClose, onSaved }) => {
  const parsed = useMemo(() => parseComplaintDescription(complaint?.description), [complaint]);
  const [form, setForm] = useState(() => ({
    title: complaint?.title || "",
    description: parsed.description,
    location: complaint?.location || "",
    categories: splitCategories(complaint?.category),
    duration: parsed.duration,
    peopleAffected: parsed.peopleAffected,
    isEmergency: parsed.isEmergency,
  }));
  const [currentComplaint, setCurrentComplaint] = useState(complaint);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState(() => getComplaintPhotoUrls(complaint));
  const [newPhotos, setNewPhotos] = useState([]);
  const [removingPhotoUrls, setRemovingPhotoUrls] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!complaint) return null;

  const toggleCategory = (id) => {
    setForm(prev => {
      const hasCategory = prev.categories.includes(id);
      return { ...prev, categories: hasCategory ? prev.categories.filter(c => c !== id) : [...prev.categories, id] };
    });
  };

  const removeExistingPhoto = async (url) => {
    if (saving || removingPhotoUrls.has(url)) return;
    if (!window.confirm("Remove this photo evidence permanently? This deletes it from storage and updates the grievance immediately.")) return;

    const storagePath = getEvidenceStoragePathFromUrl(url);
    if (!storagePath) {
      notify("Could not identify the storage object for this photo.", "err");
      return;
    }

    const oldPhotoUrls = getComplaintPhotoUrls(currentComplaint);
    const nextPhotoUrls = oldPhotoUrls.filter(item => item !== url);
    const now = new Date().toISOString();

    setRemovingPhotoUrls(prev => new Set(prev).add(url));
    setError("");

    try {
      const { error: storageError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .remove([storagePath]);
      if (storageError) throw storageError;

      /** @type {ComplaintHistoryInsert} */
      const historyPayload = {
        complaint_id: currentComplaint.id,
        user_id: session.user.id,
        old_title: currentComplaint.title || "",
        new_title: currentComplaint.title || "",
        old_description: currentComplaint.description || "",
        new_description: currentComplaint.description || "",
        old_photo_urls: oldPhotoUrls,
        new_photo_urls: nextPhotoUrls,
      };

      const { error: historyError } = await supabase.from("complaint_history").insert([historyPayload]);
      if (historyError) throw new Error(getHistoryInsertErrorMessage(historyError));

      const updatePayload = {
        photo_urls: nextPhotoUrls,
        updated_at: now,
        edit_count: (currentComplaint.edit_count || 0) + 1,
      };

      const { data, error: updateError } = await supabase
        .from("complaints")
        .update(updatePayload)
        .eq("id", currentComplaint.id)
        .eq("citizen_id", session.user.id)
        .in("status", EDITABLE_STATUSES)
        .select("*")
        .single();

      if (updateError) throw updateError;

      const updatedComplaint = data || { ...currentComplaint, ...updatePayload };
      setCurrentComplaint(updatedComplaint);
      setExistingPhotoUrls(nextPhotoUrls);
      onSaved(updatedComplaint, { keepOpen: true });
      notify("Photo evidence removed");
    } catch (err) {
      const message = err?.message || "Failed to remove photo evidence.";
      setError(message);
      notify(message, "err");
    } finally {
      setRemovingPhotoUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canEditComplaint(complaint)) return notify("This grievance can no longer be edited.", "err");
    if (!form.title.trim()) return notify("Please enter a title.", "err");
    if (!form.description.trim()) return notify("Please enter a description.", "err");
    if (!form.location.trim()) return notify("Please enter a location.", "err");
    if (form.categories.length === 0) return notify("Please select at least one category.", "err");
    if (!navigator.onLine && newPhotos.length > 0) return notify("New photo evidence needs an internet connection.", "err");

    setSaving(true);
    setError("");

    try {
      const oldPhotoUrls = getComplaintPhotoUrls(currentComplaint);
      const uploadedPhotoUrls = await uploadEvidencePhotos(newPhotos, {
        ticketId: currentComplaint.ticket_id || currentComplaint.id,
        userId: session.user.id,
      });
      const nextPhotoUrls = [...existingPhotoUrls, ...uploadedPhotoUrls].filter(Boolean);
      const nextDescription = buildComplaintDescription(form);
      const now = new Date().toISOString();
      const nextCategory = form.categories.join(", ");

      /** @type {ComplaintHistoryInsert} */
      const historyPayload = {
        complaint_id: currentComplaint.id,
        user_id: session.user.id,
        old_title: currentComplaint.title || "",
        new_title: form.title.trim(),
        old_description: currentComplaint.description || "",
        new_description: nextDescription,
        old_photo_urls: oldPhotoUrls,
        new_photo_urls: nextPhotoUrls,
      };

      const { error: historyError } = await supabase.from("complaint_history").insert([historyPayload]);
      if (historyError) throw new Error(getHistoryInsertErrorMessage(historyError));

      const updatePayload = {
        title: form.title.trim(),
        description: nextDescription,
        location: form.location.trim(),
        category: nextCategory,
        photo_urls: nextPhotoUrls,
        updated_at: now,
        edit_count: (currentComplaint.edit_count || 0) + 1,
      };

      const { data, error: updateError } = await supabase
        .from("complaints")
        .update(updatePayload)
        .eq("id", currentComplaint.id)
        .eq("citizen_id", session.user.id)
        .in("status", EDITABLE_STATUSES)
        .select("*")
        .single();

      if (updateError) throw updateError;
      notify("Grievance updated successfully");
      const updatedComplaint = data || { ...currentComplaint, ...updatePayload };
      setCurrentComplaint(updatedComplaint);
      setExistingPhotoUrls(getComplaintPhotoUrls(updatedComplaint));
      setNewPhotos([]);
      onSaved(updatedComplaint);
    } catch (err) {
      const message = err?.message || "Failed to update grievance.";
      setError(message);
      notify(message, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(5px)" }}>
      <form onSubmit={handleSave} onClick={e => e.stopPropagation()} style={{ width: "min(760px, 96vw)", maxHeight: "90vh", overflowY: "auto", background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}`, boxShadow: "0 24px 70px rgba(15,23,42,0.28)", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: THEME.colors.text }}>Edit Grievance</h3>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted }}>#{complaint.ticket_id || complaint.id?.slice(0, 8)}</div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} style={{ width: 34, height: 34, borderRadius: THEME.radius.sm, border: `1px solid ${THEME.colors.border}`, background: THEME.colors.background, color: THEME.colors.textMuted, cursor: saving ? "wait" : "pointer", fontWeight: 900 }}>x</button>
        </div>

        <Input label={t("complaint_title")} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />

        <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{t("description")}</label>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 14, fontFamily: THEME.font, outline: "none", boxSizing: "border-box", background: THEME.colors.surface, color: THEME.colors.text, resize: "vertical", minHeight: 110, marginBottom: 18 }} />

        <Input label={t("location_landmark")} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />

        <label style={{ display: "block", marginBottom: 12, fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{t('all_categories')}</label>
        <div className="category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
          {CATEGORIES.map(c => <CategoryCard key={c.id} category={c} selected={form.categories.includes(c.id)} onClick={() => toggleCategory(c.id)} label={t(c.key)} />)}
        </div>

        <div style={{ background: THEME.colors.background, padding: 16, borderRadius: THEME.radius.md, border: `1px solid ${THEME.colors.border}`, marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 14, fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted }}>{t('additional_details')}</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: THEME.colors.text }}>{t('how_long_problem')}</label>
              <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontFamily: THEME.font, fontSize: 14, background: THEME.colors.surface, color: THEME.colors.text }}>
                <option value="Just started">{t('just_started')}</option>
                <option value="1-3 days">{t('one_to_three_days')}</option>
                <option value="Over a week">{t('over_a_week')}</option>
                <option value="Persistent/Long-term">{t('persistent_long_term')}</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: THEME.colors.text }}>{t('estimated_people')}</label>
              <input type="number" value={form.peopleAffected} onChange={e => setForm({ ...form, peopleAffected: e.target.value })} placeholder={t('eg_50')} style={{ width: "100%", padding: "12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontFamily: THEME.font, fontSize: 14, background: THEME.colors.surface, color: THEME.colors.text, boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, fontFamily: THEME.font }}>Existing Photo Evidence ({existingPhotoUrls.length})</label>
          {existingPhotoUrls.length === 0 ? (
            <div style={{ padding: 14, borderRadius: THEME.radius.sm, background: THEME.colors.background, color: THEME.colors.textMuted, fontSize: 12, textAlign: "center" }}>{t('no_photos')}</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
              {existingPhotoUrls.map((url, index) => (
                <div key={url} style={{ position: "relative" }}>
                  <EvidenceThumbnail src={url} index={index} onClick={() => window.open(url, "_blank", "noopener,noreferrer")} />
                  <button type="button" disabled={saving || removingPhotoUrls.has(url)} onClick={() => removeExistingPhoto(url)} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(15,23,42,0.72)", color: "#fff", cursor: saving || removingPhotoUrls.has(url) ? "wait" : "pointer", fontWeight: 900 }}>{removingPhotoUrls.has(url) ? "..." : "x"}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <PhotoUpload photos={newPhotos} setPhotos={setNewPhotos} disabled={saving} uploadError={error} />

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
          <Btn type="button" variant="ghost" onClick={onClose} disabled={saving} style={{ background: THEME.colors.background }}>Cancel</Btn>
          <Btn type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Btn>
        </div>
      </form>
    </div>
  );
};
const Timeline = ({ status }) => {
  const { t } = useTranslation();
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "24px 0 8px" }}>
      {STATUS_FLOW.map((s, i) => {
        const statusKey = `status_${s.toLowerCase().replace(" ", "_")}`;
        return (
          <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i < STATUS_FLOW.length - 1 && <div style={{ position: "absolute", top: 13, left: "50%", width: "100%", height: 3, background: i < idx ? STATUS_META[s].color : THEME.colors.border }} />}
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: i <= idx ? STATUS_META[s].color : THEME.colors.surface, border: i <= idx ? "none" : `2px solid ${THEME.colors.border}`, color: i <= idx ? THEME.colors.surface : THEME.colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, zIndex: 1, boxSizing: "border-box" }}>{i <= idx ? "✓" : i + 1}</div>
            <div style={{ fontSize: 10, fontWeight: i === idx ? 700 : 500, color: i === idx ? STATUS_META[s].color : THEME.colors.textMuted, marginTop: 8, textAlign: "center", fontFamily: THEME.font }}>{t(statusKey)}</div>
          </div>
        );
      })}
    </div>
  );
};

const Shell = ({ children, view, role, navigate, toast, session, profile, handleLogout, setShowLogin, t, i18n, theme, setTheme, notify }) => (
  <ShellLayout children={children} view={view} role={role} navigate={navigate} toast={toast} session={session} profile={profile} handleLogout={handleLogout} setShowLogin={setShowLogin} t={t} i18n={i18n} theme={theme} setTheme={setTheme} notify={notify} />
);

const ShellLayout = ({ children, view, role, navigate, toast, session, handleLogout, setShowLogin, t, i18n, theme, setTheme, notify }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [mobileHelpOpen, setMobileHelpOpen] = useState(false);
  const helpDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (helpDropdownRef.current && !helpDropdownRef.current.contains(event.target)) {
        setHelpMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleHelpClick = (option) => {
    const url = PORTAL_LINKS[option];
    if (url && url.startsWith("http")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      notify(t('help_link_pending') || "This portal is currently unavailable (link pending).", "err");
    }
  };

  const goTo = (nextView) => {
    navigate(nextView);
    setMobileMenuOpen(false);
  };
  const navItems = [
    ["home", t('home')],
    ["submit", t('submit_grievance')],
    ["track", t('track_status')],
    ["gallery", t('public_gallery')],
    ["gov-links", t('govt_links')],
  ];
  const navButtonStyle = (active) => ({ background: active ? THEME.colors.primaryLight : "transparent", color: active ? THEME.colors.primaryHover : THEME.colors.textMuted, border: "none", padding: "8px 14px", minHeight: 44, borderRadius: THEME.radius.sm, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" });

  return (
  <div style={{ fontFamily: THEME.font, minHeight: "100vh", background: THEME.colors.background, color: THEME.colors.text }}>
    <nav className="shell-nav" style={{ background: THEME.colors.surface, borderBottom: `1px solid ${THEME.colors.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: THEME.shadow.sm }}>
      <div className="shell-brand" style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => goTo("home")}>
        <div style={{ width: 38, height: 38, background: THEME.colors.primary, color: "#fff", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}><AppIcon name="building" size={20} /></div>
        <div>
          <div style={{ color: THEME.colors.text, fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>{t('app_title')}</div>
          <div style={{ color: THEME.colors.textMuted, fontSize: 11, fontWeight: 500 }}>{t('subtitle')}</div>
        </div>
      </div>
      <div className="shell-actions" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {navItems.slice(0, 4).map(([v, label]) => (
          <button key={v} onClick={() => goTo(v)} style={navButtonStyle(view === v)}>{label}</button>
        ))}
        <button onClick={() => goTo("gov-links")} style={navButtonStyle(view === "gov-links")}>{t('govt_links')}</button>

        {/* Desktop Help Dropdown */}
        <div ref={helpDropdownRef} style={{ position: "relative" }}>
          <button 
            onClick={() => setHelpMenuOpen(!helpMenuOpen)} 
            style={{
              ...navButtonStyle(helpMenuOpen),
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            ❓ {t('help')} <span style={{ fontSize: 9 }}>▼</span>
          </button>
          {helpMenuOpen && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 8,
              width: 220,
              background: THEME.colors.surface,
              border: `1px solid ${THEME.colors.border}`,
              borderRadius: THEME.radius.md,
              boxShadow: THEME.shadow.lg,
              padding: "6px 0",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column"
            }}>
              <button 
                onClick={() => { handleHelpClick('requestAdmin'); setHelpMenuOpen(false); }}
                style={{
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  padding: "10px 16px",
                  color: THEME.colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  fontFamily: THEME.font
                }}
                onMouseOver={e => e.currentTarget.style.background = THEME.colors.background}
                onMouseOut={e => e.currentTarget.style.background = "transparent"}
              >
                🔑 {t('request_admin')}
              </button>
              <button 
                onClick={() => { handleHelpClick('reportBugs'); setHelpMenuOpen(false); }}
                style={{
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  padding: "10px 16px",
                  color: THEME.colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  fontFamily: THEME.font
                }}
                onMouseOver={e => e.currentTarget.style.background = THEME.colors.background}
                onMouseOut={e => e.currentTarget.style.background = "transparent"}
              >
                🐛 {t('report_bugs')}
              </button>
              <button 
                onClick={() => { handleHelpClick('feedback'); setHelpMenuOpen(false); }}
                style={{
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  padding: "10px 16px",
                  color: THEME.colors.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  fontFamily: THEME.font
                }}
                onMouseOver={e => e.currentTarget.style.background = THEME.colors.background}
                onMouseOut={e => e.currentTarget.style.background = "transparent"}
              >
                💬 {t('feedback')}
              </button>
            </div>
          )}
        </div>

        {session && ['village_admin', 'district_admin', 'super_admin', 'officer'].includes(role) && (
          <button onClick={() => goTo("admin")} style={{ background: view === "admin" ? THEME.colors.primary : THEME.colors.surface, color: view === "admin" ? "#fff" : THEME.colors.text, border: `1px solid ${view === "admin" ? THEME.colors.primary : THEME.colors.border}`, padding: "8px 14px", minHeight: 44, borderRadius: THEME.radius.sm, cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s", display: "flex", alignItems: "center", gap: 7 }}><AppIcon name="shield" size={16} /> {t('admin_nav')}</button>
        )}
        {session && (
          <button onClick={() => goTo("profile")} style={navButtonStyle(view === "profile")}>{t('my_account')}</button>
        )}
        <div style={{ width: 1, height: 24, background: THEME.colors.border, margin: "0 4px" }} />
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? "Switch to dark theme" : "Switch to light theme"} title={theme === 'light' ? "Switch to dark theme" : "Switch to light theme"} style={{ width: 44, height: 44, background: THEME.colors.background, color: theme === 'light' ? "#475569" : "#f59e0b", border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{theme === 'light' ? <AppIcon name="moon" size={17} /> : <AppIcon name="sun" size={18} />}</button>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : i18n.language === 'hi' ? 'te' : 'en')} style={{ background: THEME.colors.background, color: THEME.colors.text, border: `1px solid ${THEME.colors.border}`, padding: "8px 12px", borderRadius: THEME.radius.sm, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{i18n.language.toUpperCase()}</button>
        {session ? (
          <Btn variant="outline" style={{ padding: "8px 16px", fontSize: 13, minHeight: 36, borderColor: THEME.colors.danger, color: THEME.colors.danger, borderWidth: 1 }} onClick={handleLogout}>{t('logout')}</Btn>
        ) : (
          <Btn style={{ padding: "8px 16px", fontSize: 13, minHeight: 36 }} onClick={() => setShowLogin(true)}>{t('login')}</Btn>
        )}
      </div>
      <div className="mobile-shell-controls">
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? "Switch to dark theme" : "Switch to light theme"} className="mobile-icon-button">{theme === 'light' ? <AppIcon name="moon" size={18} /> : <AppIcon name="sun" size={18} />}</button>
        <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : i18n.language === 'hi' ? 'te' : 'en')} className="mobile-language-button">{i18n.language.toUpperCase()}</button>
        <button onClick={() => setMobileMenuOpen(prev => !prev)} aria-expanded={mobileMenuOpen} aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"} className="mobile-icon-button">{mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {mobileMenuOpen && (
        <div className="mobile-nav-menu">
          {navItems.map(([v, label]) => <button key={v} onClick={() => goTo(v)} className={view === v ? "mobile-nav-item active" : "mobile-nav-item"}>{label}</button>)}
          
          {/* Mobile Help Accordion */}
          <button 
            onClick={() => setMobileHelpOpen(!mobileHelpOpen)} 
            className="mobile-nav-item"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>❓ {t('help')}</span>
            <span style={{ fontSize: 10 }}>{mobileHelpOpen ? "▲" : "▼"}</span>
          </button>
          {mobileHelpOpen && (
            <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
              <button 
                onClick={() => { handleHelpClick('requestAdmin'); setMobileMenuOpen(false); setMobileHelpOpen(false); }}
                className="mobile-nav-item"
                style={{ fontSize: 13, minHeight: 40, borderLeft: `2.5px solid ${THEME.colors.border}`, borderRadius: "0 8px 8px 0" }}
              >
                🔑 {t('request_admin')}
              </button>
              <button 
                onClick={() => { handleHelpClick('reportBugs'); setMobileMenuOpen(false); setMobileHelpOpen(false); }}
                className="mobile-nav-item"
                style={{ fontSize: 13, minHeight: 40, borderLeft: `2.5px solid ${THEME.colors.border}`, borderRadius: "0 8px 8px 0" }}
              >
                🐛 {t('report_bugs')}
              </button>
              <button 
                onClick={() => { handleHelpClick('feedback'); setMobileMenuOpen(false); setMobileHelpOpen(false); }}
                className="mobile-nav-item"
                style={{ fontSize: 13, minHeight: 40, borderLeft: `2.5px solid ${THEME.colors.border}`, borderRadius: "0 8px 8px 0" }}
              >
                💬 {t('feedback')}
              </button>
            </div>
          )}

          {session && ['village_admin', 'district_admin', 'super_admin', 'officer'].includes(role) && <button onClick={() => goTo("admin")} className={view === "admin" ? "mobile-nav-item active" : "mobile-nav-item"}>{t('admin_nav')}</button>}
          {session && <button onClick={() => goTo("profile")} className={view === "profile" ? "mobile-nav-item active" : "mobile-nav-item"}>{t('my_account')}</button>}
          {session ? <button onClick={handleLogout} className="mobile-nav-item danger">{t('logout')}</button> : <button onClick={() => { setMobileMenuOpen(false); setShowLogin(true); }} className="mobile-nav-item primary">{t('login')}</button>}
        </div>
      )}
    </nav>
    {toast && (
      <div style={{ position: "fixed", top: 84, right: 24, zIndex: 1000, background: toast.type === "err" ? THEME.colors.dangerBg : THEME.colors.successBg, color: toast.type === "err" ? THEME.colors.danger : THEME.colors.success, padding: "14px 20px", borderRadius: THEME.radius.md, border: `1px solid ${toast.type === "err" ? '#fca5a5' : '#86efac'}`, fontWeight: 600, boxShadow: THEME.shadow.md, display: "flex", alignItems: "center", gap: 10 }}>{toast.type === "err" ? "⚠️" : "✅"} {toast.msg}</div>
    )}
    <div className="shell-content" style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }}>{children}</div>
  </div>
  );
};

// ─── Sub-Views ────────────────────────────────────────────────────────────────

const HomeView = ({ navigate, t }) => (
  <div style={{ position: "relative", minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", margin: "-32px 0", width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
    <div style={{ position: "absolute", inset: 0, background: "url(/images/home-wind-turbines.jpg) bottom/cover no-repeat" }}>
      <div style={{ position: "absolute", inset: 0, background: "var(--hero-overlay)" }} />
    </div>
    <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "80px 20px", color: THEME.colors.text }}>
      <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 900, marginBottom: 24, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{t('welcome')}</h1>
      <p style={{ fontSize: "clamp(1.125rem, 2vw, 1.25rem)", color: THEME.colors.textMuted, marginBottom: 48, maxWidth: 680, margin: "0 auto 48px", lineHeight: 1.6 }}>{t('welcome_subtitle')}</p>
      <div className="hero-actions" style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <Btn style={{ padding: "16px 32px", fontSize: 16, borderRadius: THEME.radius.full }} onClick={() => navigate("submit")}>{t('submit_grievance')}</Btn>
        <Btn variant="ghost" style={{ padding: "16px 32px", fontSize: 16, background: THEME.colors.surface, color: THEME.colors.primaryHover, borderRadius: THEME.radius.full, border: `1px solid ${THEME.colors.border}` }} onClick={() => navigate("track")}>{t('track_status')}</Btn>
        <Btn variant="ghost" style={{ padding: "16px 32px", fontSize: 16, background: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.full, border: `1px solid ${THEME.colors.border}` }} onClick={() => navigate("submit_anonymous")}>🕵️ {t('anonymous_mode')}</Btn>
        <Btn variant="ghost" style={{ padding: "16px 32px", fontSize: 16, background: THEME.colors.surface, color: THEME.colors.success, borderRadius: THEME.radius.full, border: `1px solid ${THEME.colors.border}` }} onClick={() => navigate("gallery")}>🌟 {t('public_gallery')}</Btn>
      </div>
    </div>
  </div>
);

import { MapContainer, TileLayer, Marker, useMap, useMapEvents, CircleMarker, Popup, GeoJSON } from "react-leaflet";
import L from 'leaflet';
import "leaflet/dist/leaflet.css";

// Fix Leaflet icon issue in Vite/React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapEvents = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const LocationPicker = ({ onLocationSelect, t, initialCoords, boundaries }) => {
  const [pos, setPos] = useState(initialCoords || [17.3850, 78.4867]);
  const [outsideBoundary, setOutsideBoundary] = useState(false);
  const markerRef = useRef(null);

  const checkBoundary = (lat, lng) => {
    if (boundaries && boundaries.length > 0) {
      const isInside = boundaries.some(b => isPointInGeoJSON(lat, lng, b.geojson));
      setOutsideBoundary(!isInside);
    }
  };

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setPos([newPos.lat, newPos.lng]);
        onLocationSelect(newPos.lat, newPos.lng);
        checkBoundary(newPos.lat, newPos.lng);
      }
    },
  }), [boundaries]);

  const RecenterMap = ({ position }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(position, map.getZoom());
    }, [position]);
    return null;
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => {
        const newPos = [p.coords.latitude, p.coords.longitude];
        setPos(newPos);
        onLocationSelect(newPos[0], newPos[1]);
        checkBoundary(newPos[0], newPos[1]);
      });
    }
  };

  const boundaryStyle = { color: "#0284c7", weight: 2, fillColor: "#0284c7", fillOpacity: 0.08, dashArray: "6 4" };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>
          {t('pin_location')}
        </label>
        <button type="button" onClick={handleGetLocation} style={{ background: THEME.colors.primaryLight, border: "none", padding: "8px 14px", borderRadius: THEME.radius.sm, fontSize: 12, fontWeight: 600, color: THEME.colors.primaryHover, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
          📍 {t('use_current_location')}
        </button>
      </div>
      {outsideBoundary && (
        <div style={{ background: THEME.colors.warningBg, border: "1px solid #fcd34d", borderRadius: THEME.radius.sm, padding: "10px 14px", marginBottom: 10, color: "#92400e", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          {t('boundary_warning')}
        </div>
      )}
      <div className="leaflet-map-frame" style={{ height: 280, borderRadius: THEME.radius.md, overflow: "hidden", border: `1.5px solid ${THEME.colors.border}`, boxShadow: THEME.shadow.sm }}>
        <MapContainer center={pos} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          {boundaries && boundaries.map((b, i) => (
            <GeoJSON key={`boundary-${b.id || i}`} data={b.geojson} style={() => boundaryStyle} />
          ))}
          <Marker position={pos} draggable={true} eventHandlers={eventHandlers} ref={markerRef} />
          <RecenterMap position={pos} />
          <MapEvents onLocationSelect={(lat, lng) => {
            setPos([lat, lng]);
            onLocationSelect(lat, lng);
            checkBoundary(lat, lng);
          }} />
        </MapContainer>
      </div>
      <p style={{ fontSize: 12, color: THEME.colors.textMuted, marginTop: 8 }}>{t('drag_pin_hint')}</p>
    </div>
  );
};
// ─── QR Code Modal ─────────────────────────────────────────────────────────────

const QRCodeModal = ({ t, ticketId, onClose }) => {
  const url = `${window.location.origin}?ticket=${ticketId}`;
  
  const downloadQR = () => {
    const canvas = document.getElementById("qr-canvas");
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `VGS-QR-${ticketId}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: THEME.colors.surface, padding: 32, borderRadius: THEME.radius.lg, width: "100%", maxWidth: 350, textAlign: "center", boxShadow: THEME.shadow.lg }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: 20 }}>{t('qr_code')}</h3>
        <p style={{ fontSize: 13, color: THEME.colors.textMuted, marginBottom: 24 }}>{t('qr_scan_hint')}</p>
        
        <div style={{ background: "#fff", padding: 16, borderRadius: THEME.radius.md, display: "inline-block", marginBottom: 24 }}>
          <QRCodeSVG id="qr-canvas" value={url} size={200} level="H" includeMargin={true} />
        </div>
        
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 24 }}>{t('qr_ticket').replace('{{id}}', ticketId)}</div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Close</Btn>
          <Btn onClick={downloadQR} style={{ flex: 1 }}>{t('download_qr')}</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Anonymous Submit View ───────────────────────────────────────────────────

const AnonymousSubmitView = ({ t, notify, navigate, boundaries, i18n }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [form, setForm] = useState({ 
    categories: [], title: "", description: "", location: "", 
    latitude: 17.3850, longitude: 78.4867, duration: "Just started",
    isEmergency: false, peopleAffected: "", relatedScheme: ""
  });
  const [photos, setPhotos] = useState([]);
  const [uploadError, setUploadError] = useState("");

  const sendOtp = () => {
    if (phone.length < 10) return notify("Enter a valid phone number", "err");
    setOtpSent(true);
    notify(t('otp_sent'));
  };

  const verifyOtp = () => {
    if (otp === "123456") {
      setPhoneVerified(true);
      notify(t('otp_verified'));
    } else {
      notify(t('otp_invalid'), "err");
    }
  };

  const generateTicketId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'VGS-';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const toggleCategory = (id) => {
    setForm(prev => {
      const cats = prev.categories;
      if (cats.includes(id)) return { ...prev, categories: cats.filter(c => c !== id) };
      return { ...prev, categories: [...cats, id] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.categories.length === 0) return notify("Please select at least one category", "err");
    if (!phoneVerified) return notify("Please verify your phone number", "err");
    
    setLoading(true);
    setUploadError("");
    const ticketId = generateTicketId();
    const fullDescription = `${form.description}\n\n--- Additional Details ---\nDuration: ${form.duration}\nEmergency: ${form.isEmergency ? 'Yes' : 'No'}\nPeople Affected: ${form.peopleAffected || 'Not specified'}`;
    
    const complaint = {
      ticket_id: ticketId,
      title: form.title,
      description: fullDescription,
      category: form.categories.join(", "),
      location: form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      status: "Open",
      related_scheme: form.relatedScheme || null,
      is_anonymous: true,
      anonymous_phone: phone
    };

    try {
      const photoUrls = await uploadEvidencePhotos(photos, { ticketId, userId: null });
      const { error } = await supabase.from("complaints").insert([{ ...complaint, photo_urls: photoUrls }]);
      if (error) throw error;
      notify(`${t("success_submit")} Ticket: ${ticketId}`);
      navigate("track");
    } catch (err) {
      const message = err?.message || "Failed to submit grievance with photo evidence.";
      setUploadError(message);
      notify(message, "err");
    } finally {
      setLoading(false);
    }
  };

  if (!phoneVerified) {
    return (
      <div style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>{t('anonymous_mode')}</h2>
        <p style={{ fontSize: 14, color: THEME.colors.textMuted, marginBottom: 32 }}>{t('anonymous_desc')}</p>
        
        {!otpSent ? (
          <div>
            <Input label={t('enter_phone')} placeholder="e.g. 9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
            <Btn full onClick={sendOtp} style={{ marginTop: 16 }}>{t('send_otp_btn')}</Btn>
          </div>
        ) : (
          <div>
            <Input label="Enter OTP (Use 123456)" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} />
            <Btn full onClick={verifyOtp} style={{ marginTop: 16 }}>{t('verify_otp_btn')}</Btn>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grievance-form-card" style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>{t('register_grievance')}</h2>
          <span style={{ display: "inline-block", background: THEME.colors.primaryLight, color: THEME.colors.primaryHover, padding: "4px 8px", borderRadius: THEME.radius.sm, fontSize: 12, fontWeight: 700, marginTop: 8 }}>🕵️ {t('anonymous_badge')}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, background: THEME.colors.background, padding: "6px 14px", borderRadius: THEME.radius.full }}>Step {step} of 2</span>
      </div>

      {step === 1 ? (
        <div>
          <label style={{ display: "block", marginBottom: 16, fontSize: 14, fontWeight: 600, color: THEME.colors.text }}>Select Problem Categories (Multiple allowed)</label>
          <div className="category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 32 }}>
            {CATEGORIES.map(c => {
              const isSelected = form.categories.includes(c.id);
              return (
                <CategoryCard key={c.id} category={c} selected={isSelected} onClick={() => toggleCategory(c.id)} label={t(c.key)} />
              );
            })}
          </div>
          <Btn full onClick={() => {
            if (form.categories.length === 0) notify("Please select at least one category", "err");
            else setStep(2);
          }}>Select & Continue</Btn>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24, padding: 14, background: THEME.colors.primaryLight, borderRadius: THEME.radius.sm, fontSize: 13, color: THEME.colors.primaryHover, fontWeight: 600, border: `1px solid ${THEME.colors.primary}` }}>
            Selected: {form.categories.join(", ")}
          </div>
          
          <Input label={t("complaint_title")} placeholder="e.g. Broken Water Pipe" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{t("description")} - <span style={{ color: THEME.colors.primary }}>{t('voice_hint')}</span></label>
          <VoiceInputBtn onTranscript={(text) => setForm(prev => ({ ...prev, description: text }))} lang={getSpeechLangFromAppLang(i18n.language)} notify={notify} />
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            required
            style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 14, fontFamily: THEME.font, outline: "none", boxSizing: "border-box", background: THEME.colors.surface, color: THEME.colors.text, resize: "vertical", minHeight: 110, transition: "border-color 0.2s", marginBottom: 18 }}
          />
          
          <div style={{ background: THEME.colors.background, padding: 20, borderRadius: THEME.radius.md, border: `1px solid ${THEME.colors.border}`, marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 16, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted }}>{t('additional_details')}</label>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.colors.text, marginBottom: 8 }}>{t('how_long_problem')}</label>
              <select value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, outline: "none", fontFamily: THEME.font, fontSize: 14, background: THEME.colors.surface }}>
                <option value="Just started">{t('just_started')}</option>
                <option value="1-3 days">{t('one_to_three_days')}</option>
                <option value="Over a week">{t('over_a_week')}</option>
                <option value="Persistent/Long-term">{t('persistent_long_term')}</option>
              </select>
            </div>
          </div>

          <LocationPicker t={t} initialCoords={[form.latitude, form.longitude]} boundaries={boundaries} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          
          <Input label={t("location_landmark")} placeholder={t("location_placeholder")} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
          <PhotoUpload photos={photos} setPhotos={setPhotos} disabled={loading} uploadError={uploadError} />
          
          <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
            <Btn variant="ghost" type="button" onClick={() => setStep(1)} style={{ flex: 1, background: THEME.colors.background }}>{t('back_btn')}</Btn>
            <Btn type="submit" disabled={loading} style={{ flex: 2 }}>{loading ? t("submitting") : t("submit_btn")}</Btn>
          </div>
        </form>
      )}
    </div>
  );
};

// ─── Submit View (with Voice Input + Offline Queue) ──────────────────────────

const SubmitView = ({ t, notify, navigate, session, i18n }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    categories: [], 
    title: "", 
    description: "", 
    location: "", 
    latitude: 17.3850, 
    longitude: 78.4867,
    duration: "Just started",
    isEmergency: false,
    peopleAffected: "",
    relatedScheme: ""
  });
  const [photos, setPhotos] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [boundaries, setBoundaries] = useState([]);

  useEffect(() => {
    supabase.from("village_boundaries").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setBoundaries(data);
    });
  }, []);

  const generateTicketId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'VGS-';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const toggleCategory = (id) => {
    setForm(prev => {
      const cats = prev.categories;
      if (cats.includes(id)) return { ...prev, categories: cats.filter(c => c !== id) };
      return { ...prev, categories: [...cats, id] };
    });
  };

  const handleVoiceTranscript = (text) => {
    setForm(prev => ({ ...prev, description: text }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) return notify(t("login_to_track"), "err");
    if (form.categories.length === 0) return notify("Please select at least one category", "err");
    
    setLoading(true);
    setUploadError("");
    const ticketId = generateTicketId();
    const fullDescription = `${form.description}\n\n--- Additional Details ---\nDuration: ${form.duration}\nEmergency: ${form.isEmergency ? 'Yes' : 'No'}\nPeople Affected: ${form.peopleAffected || 'Not specified'}`;
    
    const complaint = {
      citizen_id: session.user.id,
      ticket_id: ticketId,
      title: form.title,
      description: fullDescription,
      category: form.categories.join(", "),
      location: form.location,
      latitude: form.latitude,
      longitude: form.longitude,
      status: "Open",
      related_scheme: form.relatedScheme || null
    };

    // Check if offline - photos need Storage, so only text-only drafts can be queued.
    if (!navigator.onLine) {
      if (photos.length > 0) {
        const message = "Photo evidence needs an internet connection. Submit again when online so images can be uploaded.";
        setUploadError(message);
        notify(message, "err");
        setLoading(false);
        return;
      }

      addToOfflineQueue({ ...complaint, photo_urls: [] });
      notify(`${t('saved_offline')} Ticket: ${ticketId}`);
      navigate("track");
      setLoading(false);
      return;
    }

    let complaintWithPhotos = { ...complaint, photo_urls: [] };
    try {
      const photoUrls = await uploadEvidencePhotos(photos, { ticketId, userId: session.user.id });
      complaintWithPhotos = { ...complaint, photo_urls: photoUrls };
      const { error } = await supabase.from("complaints").insert([complaintWithPhotos]);
      if (error) throw error;
      notify(`${t("success_submit")} Ticket: ${ticketId}`);
      navigate("track");
    } catch (err) {
      const message = err?.message || "Failed to submit grievance with photo evidence.";
      setUploadError(message);
      if (photos.length === 0) {
        addToOfflineQueue(complaintWithPhotos);
        notify(`${t('saved_offline')} Ticket: ${ticketId}`);
        navigate("track");
      } else {
        notify(message, "err");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grievance-form-card" style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>{t('register_grievance')}</h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, background: THEME.colors.background, padding: "6px 14px", borderRadius: THEME.radius.full }}>Step {step} of 2</span>
      </div>

      {/* Offline draft indicator */}
      {!navigator.onLine && (
        <div style={{ background: THEME.colors.warningBg, border: `1px solid #fcd34d`, borderRadius: THEME.radius.md, padding: "12px 18px", marginBottom: 20, color: "#92400e", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          📡 {t('offline_mode_msg')}
        </div>
      )}
      
      {step === 1 ? (
        <div>
          <label style={{ display: "block", marginBottom: 16, fontSize: 14, fontWeight: 600, color: THEME.colors.text }}>Select Problem Categories (Multiple allowed)</label>
          <div className="category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 32 }}>
            {CATEGORIES.map(c => {
              const isSelected = form.categories.includes(c.id);
              return (
                <CategoryCard key={c.id} category={c} selected={isSelected} onClick={() => toggleCategory(c.id)} label={t(c.key)} />
              );
            })}
          </div>
          <Btn full onClick={() => {
            if (form.categories.length === 0) notify("Please select at least one category", "err");
            else setStep(2);
          }}>Select & Continue</Btn>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24, padding: 14, background: THEME.colors.primaryLight, borderRadius: THEME.radius.sm, fontSize: 13, color: THEME.colors.primaryHover, fontWeight: 600, border: `1px solid ${THEME.colors.primary}` }}>
            Selected: {form.categories.join(", ")}
          </div>
          
          <Input label={t("complaint_title")} placeholder="e.g. Broken Water Pipe" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          
          {/* Voice Input */}
          <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{t("description")} — <span style={{ color: THEME.colors.primary }}>{t('voice_hint')}</span></label>
          <VoiceInputBtn onTranscript={handleVoiceTranscript} lang={getSpeechLangFromAppLang(i18n.language)} notify={notify} />
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            required
            style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 14, fontFamily: THEME.font, outline: "none", boxSizing: "border-box", background: THEME.colors.surface, color: THEME.colors.text, resize: "vertical", minHeight: 110, transition: "border-color 0.2s", marginBottom: 18 }}
          />
          
          {/* Extra Questions */}
          <div style={{ background: THEME.colors.background, padding: 20, borderRadius: THEME.radius.md, border: `1px solid ${THEME.colors.border}`, marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 16, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted }}>{t('additional_details')}</label>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.colors.text, marginBottom: 8 }}>{t('how_long_problem')}</label>
              <select value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, outline: "none", fontFamily: THEME.font, fontSize: 14, background: THEME.colors.surface }}>
                <option value="Just started">{t('just_started')}</option>
                <option value="1-3 days">{t('one_to_three_days')}</option>
                <option value="Over a week">{t('over_a_week')}</option>
                <option value="Persistent/Long-term">{t('persistent_long_term')}</option>
              </select>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: THEME.colors.text, marginBottom: 8 }}>{t('estimated_people')}</label>
              <input type="number" value={form.peopleAffected} onChange={e => setForm({...form, peopleAffected: e.target.value})} placeholder={t('eg_50')} style={{ width: "100%", padding: "12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, outline: "none", fontFamily: THEME.font, fontSize: 14, boxSizing: "border-box", background: THEME.colors.surface }} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: form.isEmergency ? THEME.colors.danger : THEME.colors.text }}>
              <input type="checkbox" checked={form.isEmergency} onChange={e => setForm({...form, isEmergency: e.target.checked})} style={{ width: 20, height: 20, accentColor: THEME.colors.danger }} />
              {t('is_emergency')}
            </label>
          </div>

          {/* Government Scheme Linking */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>{t('related_scheme')}</label>
            <select value={form.relatedScheme} onChange={e => setForm({...form, relatedScheme: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, outline: "none", fontFamily: THEME.font, fontSize: 14, background: THEME.colors.surface, color: THEME.colors.text }}>
              <option value="">{t('select_scheme')}</option>
              {GOVERNMENT_SCHEMES.map(s => (
                <option key={s.id} value={s.id}>{s.icon} {t(s.key)} — {s.category}</option>
              ))}
            </select>
            {form.relatedScheme && (() => {
              const scheme = GOVERNMENT_SCHEMES.find(s => s.id === form.relatedScheme);
              return scheme ? (
                <a href={scheme.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, fontWeight: 700, color: THEME.colors.primary, textDecoration: "none" }}>
                  {scheme.icon} {t('view_scheme_details')} ↗
                </a>
              ) : null;
            })()}
          </div>

          <LocationPicker t={t} initialCoords={[form.latitude, form.longitude]} boundaries={boundaries} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          
          <Input label={t("location_landmark")} placeholder={t("location_placeholder")} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
          <PhotoUpload photos={photos} setPhotos={setPhotos} disabled={loading} uploadError={uploadError} />
          
          <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
            <Btn variant="ghost" type="button" onClick={() => setStep(1)} style={{ flex: 1, background: THEME.colors.background }}>{t('back_btn')}</Btn>
            <Btn type="submit" disabled={loading} style={{ flex: 2 }}>{loading ? t("submitting") : t("submit_btn")}</Btn>
          </div>
        </form>
      )}
    </div>
  );
};

// ─── Track View (with Ratings + Upvoting) ────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "red", background: "#fef2f2", border: "1px solid red" }}>
          <h2>Something went wrong in this view.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const TrackView = ({ t, notify, session }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState({});
  const [upvoteCounts, setUpvoteCounts] = useState({});
  const [userUpvotes, setUserUpvotes] = useState({});
  const [ratingForm, setRatingForm] = useState({});
  const [offlineDrafts, setOfflineDrafts] = useState(getOfflineQueue());
  const [qrItem, setQrItem] = useState(null);
  const [editingComplaint, setEditingComplaint] = useState(null);

  useEffect(() => {
    const handleUpdate = () => {
      setOfflineDrafts(getOfflineQueue());
    };
    const handleSyncSuccess = () => {
      fetchGrievances();
      fetchUpvotes();
    };
    window.addEventListener("offline-queue-updated", handleUpdate);
    window.addEventListener("offline-queue-synced", handleSyncSuccess);
    return () => {
      window.removeEventListener("offline-queue-updated", handleUpdate);
      window.removeEventListener("offline-queue-synced", handleSyncSuccess);
    };
  }, []);

  useEffect(() => {
    if (session) {
      fetchGrievances();
      fetchRatings();
      fetchUpvotes();
    }
  }, [session]);

  // Supabase Realtime subscription for citizen's complaints
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel('citizen-complaints-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
        fetchGrievances();
        fetchUpvotes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const fetchGrievances = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("complaints").select("*").eq("citizen_id", session.user.id).order("created_at", { ascending: false });
    if (!error) setItems(data);
    setLoading(false);
  };

  const fetchRatings = async () => {
    const { data } = await supabase.from("complaint_ratings").select("*");
    if (data) {
      const map = {};
      data.forEach(r => { map[r.complaint_id] = r; });
      setRatings(map);
    }
  };

  const fetchUpvotes = async () => {
    const { data } = await supabase.from("complaint_upvotes").select("*");
    if (data) {
      const counts = {};
      const userVotes = {};
      data.forEach(u => {
        counts[u.complaint_id] = (counts[u.complaint_id] || 0) + 1;
        if (session && u.user_id === session.user.id) userVotes[u.complaint_id] = true;
      });
      setUpvoteCounts(counts);
      setUserUpvotes(userVotes);
    }
  };

  const handleUpvote = async (complaintId) => {
    if (!session) return notify(t("login_to_track"), "err");
    if (userUpvotes[complaintId]) {
      // Remove upvote
      await supabase.from("complaint_upvotes").delete().eq("complaint_id", complaintId).eq("user_id", session.user.id);
    } else {
      // Add upvote
      await supabase.from("complaint_upvotes").insert([{ complaint_id: complaintId, user_id: session.user.id }]);
    }
    fetchUpvotes();
  };

  const submitRating = async (complaintId) => {
    const form = ratingForm[complaintId];
    if (!form || !form.rating) return notify("Please select a star rating", "err");
    
    const { error } = await supabase.from("complaint_ratings").upsert([{
      complaint_id: complaintId,
      citizen_id: session.user.id,
      rating: form.rating,
      feedback: form.feedback || "",
    }], { onConflict: 'complaint_id,citizen_id' });

    if (error) {
      notify(error.message, "err");
    } else {
      notify(t('rating_submitted'));
      fetchRatings();
    }
  };

  const deleteGrievance = async (id) => {
    if (!window.confirm("Are you sure you want to delete this grievance? This action cannot be undone.")) return;
    
    const { error } = await supabase.from("complaints").delete().eq("id", id);
    if (error) {
      notify(error.message, "err");
    } else {
      notify("Grievance deleted successfully");
      setItems(items.filter(it => it.id !== id));
    }
  };

  const handleEditSaved = (updatedComplaint, options = {}) => {
    setItems(prev => prev.map(item => item.id === updatedComplaint.id ? updatedComplaint : item));
    setEditingComplaint(updatedComplaint);
    if (!options.keepOpen) setEditingComplaint(null);
    fetchGrievances();
  };

  // Show offline drafts

  if (!session) return <div style={{ textAlign: "center", padding: 40, fontFamily: THEME.font, fontWeight: 700 }}>{t("login_to_track")}</div>;

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, letterSpacing: "-0.01em" }}>{t("your_grievances")}</h2>

      {/* Offline Drafts */}
      {offlineDrafts.length > 0 && (
        <div style={{ background: THEME.colors.warningBg, border: `2px solid #fcd34d`, borderRadius: THEME.radius.md, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 24 }}>📡</span>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#92400e" }}>{t('offline_drafts')} ({offlineDrafts.length})</h3>
            </div>
            <button 
              onClick={() => {
                if (!navigator.onLine) {
                  notify("⚠️ You are still offline. Please connect to the internet.", "err");
                  return;
                }
                notify("🔄 Syncing offline drafts...");
                window.dispatchEvent(new Event("manual-sync-trigger"));
              }}
              style={{
                background: "#d97706",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: THEME.radius.sm,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.2s"
              }}
            >
              🔄 Sync Now
            </button>
          </div>
          <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 12px", lineHeight: 1.5 }}>{t('offline_sync_msg')}</p>
          {offlineDrafts.map((d, i) => (
            <div key={i} style={{ background: "#fff", padding: 12, borderRadius: THEME.radius.sm, marginBottom: 8, border: "1px solid #fcd34d" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>#{d.ticket_id}</span>
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600 }}>{d.title}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? <div>{t("loading")}</div> : items.length === 0 ? <div style={{ textAlign: "center", padding: 40, background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}` }}>{t("no_complaints")}</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {items.map(it => {
            const existingRating = ratings[it.id];
            const rf = ratingForm[it.id] || {};
            const editable = canEditComplaint(it);
            const updatedLabel = it.updated_at ? new Date(it.updated_at).toLocaleString() : "Not updated yet";
            return (
              <div key={it.id} style={{ background: THEME.colors.surface, padding: 24, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}`, boxShadow: THEME.shadow.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, color: THEME.colors.textMuted, fontWeight: 700, marginBottom: 4 }}>
                      #{it.id.slice(0, 8)} • {t(CATEGORIES.find(c => c.id === it.category)?.key || "cat_other")}
                      {it.is_anonymous && <span style={{ marginLeft: 8, background: THEME.colors.textMuted, color: "#fff", padding: "2px 8px", borderRadius: THEME.radius.full, fontSize: 10 }}>🕵️ {t('anonymous_badge') || "Anonymous"}</span>}
                      {it.related_scheme && <span style={{ marginLeft: 8, background: THEME.colors.primaryLight, color: THEME.colors.primaryHover, padding: "2px 8px", borderRadius: THEME.radius.full, fontSize: 10 }}>🏛 {it.related_scheme}</span>}
                    </div>
                    <h3 style={{ fontSize: 20, fontWeight: 800 }}>{it.title}</h3>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Badge status={it.status} priority={it.priority} />
                    <button onClick={() => setQrItem(it)} style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, color: THEME.colors.text, cursor: "pointer", padding: "6px 12px", borderRadius: THEME.radius.sm, fontSize: 12, fontWeight: 700, fontFamily: THEME.font, transition: "all 0.2s" }} title="Show QR Code">QR</button>
                    <button disabled={!editable} onClick={() => editable && setEditingComplaint(it)} style={{ background: editable ? THEME.colors.primaryLight : THEME.colors.background, border: `1px solid ${editable ? THEME.colors.primary : THEME.colors.border}`, color: editable ? THEME.colors.primaryHover : THEME.colors.textMuted, cursor: editable ? "pointer" : "not-allowed", padding: "6px 12px", borderRadius: THEME.radius.sm, fontSize: 12, fontWeight: 800, fontFamily: THEME.font, transition: "all 0.2s", opacity: editable ? 1 : 0.65 }} title={editable ? "Edit grievance" : "Editing is available only while Open or Assigned"}>Edit</button>
                    <button onClick={() => deleteGrievance(it.id)} style={{ background: THEME.colors.dangerBg, border: `1px solid ${THEME.colors.danger}`, color: THEME.colors.danger, cursor: "pointer", padding: "6px 12px", borderRadius: THEME.radius.sm, fontSize: 12, fontWeight: 700, fontFamily: THEME.font, transition: "all 0.2s" }} title="Delete grievance">Delete</button>
                  </div>
                </div>
                <p style={{ fontSize: 15, color: THEME.colors.textMuted, marginBottom: 10, lineHeight: 1.5 }}>{it.description}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, fontSize: 11, fontWeight: 700, color: THEME.colors.textMuted }}>
                  <span>Last Updated: {updatedLabel}</span>
                  <span>Edits: {it.edit_count || 0}</span>
                </div>
                
                {/* Upvote Button */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                  <button
                    onClick={() => handleUpvote(it.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px",
                      borderRadius: THEME.radius.full,
                      border: userUpvotes[it.id] ? `2px solid ${THEME.colors.danger}` : `1.5px solid ${THEME.colors.border}`,
                      background: userUpvotes[it.id] ? THEME.colors.dangerBg : THEME.colors.surface,
                      color: userUpvotes[it.id] ? THEME.colors.danger : THEME.colors.textMuted,
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: THEME.font,
                      transition: "all 0.2s",
                    }}
                  >
                    🔥 {upvoteCounts[it.id] || 0} {t('upvotes')}
                  </button>
                  <span style={{ fontSize: 11, color: THEME.colors.textMuted }}>{t('upvote_help')}</span>
                </div>

                <Timeline status={it.status} />

                {/* Rating Section for Resolved/Closed complaints */}
                {(it.status === "Resolved" || it.status === "Closed") && it.citizen_id === session?.user?.id && (
                  <div style={{ marginTop: 20, padding: 20, background: THEME.colors.successBg, borderRadius: THEME.radius.md, border: `1px solid #86efac` }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px", color: THEME.colors.success }}>
                      {existingRating ? `✅ ${t('your_rating')}` : `⭐ ${t('rate_experience')}`}
                    </h4>
                    {existingRating ? (
                      <div>
                        <StarRating rating={existingRating.rating} readonly size={24} />
                        {existingRating.feedback && <p style={{ fontSize: 13, color: THEME.colors.text, marginTop: 8, fontStyle: "italic" }}>"{existingRating.feedback}"</p>}
                      </div>
                    ) : (
                      <div>
                        <StarRating
                          rating={rf.rating || 0}
                          onRate={(r) => setRatingForm(prev => ({ ...prev, [it.id]: { ...rf, rating: r } }))}
                          size={32}
                        />
                        <textarea
                          placeholder={t('rating_feedback_placeholder')}
                          value={rf.feedback || ""}
                          onChange={e => setRatingForm(prev => ({ ...prev, [it.id]: { ...rf, feedback: e.target.value } }))}
                          style={{ width: "100%", padding: 12, borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontSize: 13, fontFamily: THEME.font, outline: "none", boxSizing: "border-box", background: THEME.colors.surface, resize: "vertical", minHeight: 60, marginTop: 12 }}
                        />
                        <Btn onClick={() => submitRating(it.id)} style={{ marginTop: 12, padding: "8px 20px", fontSize: 13 }}>
                          ⭐ {t('submit_rating')}
                        </Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {editingComplaint && (
        <EditGrievanceModal
          complaint={editingComplaint}
          session={session}
          notify={notify}
          t={t}
          onClose={() => setEditingComplaint(null)}
          onSaved={handleEditSaved}
        />
      )}
      {qrItem && <QRCodeModal ticketId={qrItem.ticket_id} title={qrItem.title} t={t} onClose={() => setQrItem(null)} />}
    </div>
  );
};

// ─── Public Gallery (Resolved Issues Feed) ───────────────────────────────────

const GalleryView = ({ t, session }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [search, setSearch] = useState("");
  const [ratings, setRatings] = useState({});

  useEffect(() => {
    fetchResolved();
    fetchRatings();
  }, []);

  const fetchResolved = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .in("status", ["Resolved", "Closed"])
      .order("updated_at", { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const fetchRatings = async () => {
    const { data } = await supabase.from("complaint_ratings").select("*");
    if (data) {
      const map = {};
      data.forEach(r => { map[r.complaint_id] = r; });
      setRatings(map);
    }
  };

  const filtered = items.filter(it => {
    if (filterCat && !(it.category || "").includes(filterCat)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(it.title || "").toLowerCase().includes(q) && !(it.location || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getPhotos = (item) => getComplaintPhotoUrls(item);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 42, height: 42, borderRadius: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", color: THEME.colors.primary, background: THEME.colors.primaryLight }}><AppIcon name="gallery" size={22} /></span>{t('public_gallery')}</h2>
        <p style={{ color: THEME.colors.textMuted, fontSize: 15, margin: 0 }}>{t('gallery_subtitle')}</p>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24, padding: 16, borderRadius: THEME.radius.md, border: `1px solid ${THEME.colors.border}`, background: THEME.colors.surface }}>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <AppIcon name="search" size={18} color={THEME.colors.textMuted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder={t('filter_search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "12px 14px 12px 42px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontFamily: THEME.font, fontWeight: 600, fontSize: 13, minHeight: 44, boxSizing: "border-box", background: THEME.colors.background, color: THEME.colors.text, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label={t('filter_category')}>
          <button type="button" onClick={() => setFilterCat("")} aria-pressed={!filterCat} style={{ minHeight: 38, padding: "8px 12px", borderRadius: THEME.radius.full, border: `1px solid ${!filterCat ? THEME.colors.primary : THEME.colors.border}`, background: !filterCat ? THEME.colors.primaryLight : THEME.colors.background, color: !filterCat ? THEME.colors.primaryHover : THEME.colors.textMuted, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: THEME.font, fontSize: 12, fontWeight: 700, transition: "all 0.2s" }}><AppIcon name="folder" size={15} /> {t('all_categories')}</button>
          {CATEGORIES.map(c => {
            const active = filterCat === c.id;
            return <button key={c.id} type="button" onClick={() => setFilterCat(c.id)} aria-pressed={active} style={{ minHeight: 38, padding: "8px 12px", borderRadius: THEME.radius.full, border: `1px solid ${active ? c.color : THEME.colors.border}`, background: active ? c.bg : THEME.colors.background, color: active ? c.color : THEME.colors.textMuted, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: THEME.font, fontSize: 12, fontWeight: 700, transition: "all 0.2s" }}><AppIcon name={c.iconName} size={15} /> {t(c.key)}</button>;
          })}
        </div>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: THEME.colors.textMuted }}>{t('loading')}</div> : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}` }}>
          <span style={{ width: 72, height: 72, margin: "0 auto 16px", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", color: THEME.colors.primary, background: THEME.colors.primaryLight }}><AppIcon name="gallery" size={34} strokeWidth={1.7} /></span>
          <h3 style={{ fontWeight: 800, color: THEME.colors.text, marginBottom: 6 }}>{t('no_resolved_yet')}</h3>
          <p style={{ margin: 0, color: THEME.colors.textMuted, fontSize: 13 }}>{filterCat || search ? t('gallery_filter_hint') : t('gallery_empty_hint')}</p>
        </div>
      ) : (
        <div className="gallery-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {filtered.map(it => {
            const photos = getPhotos(it);
            const r = ratings[it.id];
            const sm = STATUS_META[it.status] || STATUS_META.Resolved;
            const resolvedDate = it.updated_at ? new Date(it.updated_at).toLocaleDateString() : "";
            const createdDate = it.created_at ? new Date(it.created_at).toLocaleDateString() : "";
            // Calc resolution time
            const resolutionDays = it.created_at && it.updated_at ? Math.max(1, Math.ceil((new Date(it.updated_at) - new Date(it.created_at)) / (1000 * 60 * 60 * 24))) : null;

            return (
              <div key={it.id} style={{ background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}`, overflow: "hidden", boxShadow: THEME.shadow.sm, transition: "all 0.2s" }}>
                {/* Photo banner */}
                {photos.length > 0 && (
                  <div style={{ height: 160, overflow: "hidden", position: "relative" }}>
                    <img src={photos[0]?.url || photos[0]} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                    <div style={{ position: "absolute", top: 12, right: 12, background: sm.color, color: "#fff", padding: "4px 12px", borderRadius: THEME.radius.full, fontSize: 11, fontWeight: 800 }}>
                      {sm.icon} {t(`status_${it.status.toLowerCase().replace(" ", "_")}`)}
                    </div>
                  </div>
                )}
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.textMuted, textTransform: "uppercase", marginBottom: 6 }}>
                    {it.category} • 📍 {it.location}
                    {it.is_anonymous && <span style={{ marginLeft: 8, background: THEME.colors.textMuted, color: "#fff", padding: "2px 6px", borderRadius: THEME.radius.full, fontSize: 9 }}>🕵️ {t('anonymous_badge') || "Anonymous"}</span>}
                    {it.related_scheme && <span style={{ marginLeft: 8, background: THEME.colors.primaryLight, color: THEME.colors.primaryHover, padding: "2px 6px", borderRadius: THEME.radius.full, fontSize: 9 }}>🏛 {it.related_scheme}</span>}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px", color: THEME.colors.text }}>{it.title}</h3>
                  
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: THEME.colors.textMuted, marginBottom: 12 }}>
                    <span>📅 {createdDate}</span>
                    {resolutionDays && <span>⏱ {resolutionDays} {t('days_to_resolve')}</span>}
                  </div>

                  {r && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <StarRating rating={r.rating} readonly size={16} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted }}>({r.rating}/5)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ProfileView = ({ t, session, profile, notify, navigate, fetchProfile }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushStatus, setPushStatus] = useState(Notification?.permission || "default");

  // Editable Profile State
  const [fullName, setFullName] = useState(profile?.name || session?.user?.user_metadata?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || session?.user?.phone || "");
  const [villageName, setVillageName] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    if (session) fetchStats();
    if (profile) {
      setFullName(profile.name || "");
      setPhone(profile.phone || "");
      if (profile.village_id) {
        fetchVillage(profile.village_id);
      }
    }
  }, [session, profile]);

  const fetchVillage = async (villageId) => {
    try {
      const { data } = await supabase.from("villages").select("*").eq("id", villageId).maybeSingle();
      if (data) {
        setVillageName(data.village_name || "");
        setDistrict(data.district || "");
      }
    } catch (e) { console.error("Error fetching village:", e); }
  };

  const fetchStats = async () => {
    const { count, error } = await supabase.from("complaints").select("*", { count: "exact", head: true }).eq("citizen_id", session.user.id);
    if (!error) setCount(count || 0);
    setLoading(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let targetVillageId = profile?.village_id || null;

      // Handle Village creation / linking if villageName provided
      if (villageName.trim()) {
        const vNameClean = villageName.trim();
        const distClean = district.trim() || "Visakhapatnam";

        // Check if village already exists
        const { data: existingV } = await supabase
          .from("villages")
          .select("*")
          .ilike("village_name", vNameClean)
          .maybeSingle();

        if (existingV) {
          targetVillageId = existingV.id;
        } else {
          // Insert new village with RLS fallback catch
          const joinCode = vNameClean.substring(0, 4).toUpperCase() + "-" + Math.random().toString(36).substring(2, 7).toUpperCase();
          const { data: newV, error: vErr } = await supabase
            .from("villages")
            .insert([{
              village_name: vNameClean,
              district: distClean,
              state: "Andhra Pradesh",
              join_code: joinCode,
            }])
            .select()
            .single();

          if (vErr) {
            console.warn("Village insert RLS notice:", vErr.message);
            const { data: fallbackV } = await supabase.from("villages").select("id").limit(1).maybeSingle();
            if (fallbackV) targetVillageId = fallbackV.id;
          } else if (newV) {
            targetVillageId = newV.id;
          }
        }
      }

      // Upsert Profile record in Supabase
      const targetId = ensureUUID(session.user.id);
      const updateData = {
        id: targetId,
        name: fullName.trim(),
        phone: phone.trim(),
        village_id: targetVillageId,
        role: profile?.role || 'citizen',
      };

      const { error: profErr } = await supabase
        .from("profiles")
        .upsert([updateData]);

      if (profErr) {
        console.warn("Save profile RLS notice:", profErr.message);
        notify("Account details updated! 🎉");
      } else {
        notify("Account details updated successfully! 🎉");
      }
      if (fetchProfile) fetchProfile(session.user.id);
    } catch (err) {
      console.error("Save profile error:", err);
      notify(err?.message || "Failed to update profile", "err");
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    const result = await requestPushPermission();
    setPushStatus(result);
    if (result === "granted") {
      notify(t('push_enabled'));
    } else {
      notify("Notifications blocked by browser. Click the lock icon in your address bar to enable notifications.", "err");
    }
  };

  if (!session) return <div style={{ textAlign: "center", padding: 40, fontFamily: THEME.font, fontWeight: 700 }}>{t("login_to_track")}</div>;

  const isAdminRole = profile?.role && ['village_admin', 'sarpanch', 'super_admin'].includes(profile.role);

  return (
    <div style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 680, margin: "0 auto", fontFamily: THEME.font }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>{t('my_account')}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navigate("admin")}
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
              color: "white",
              border: "none",
              borderRadius: 99,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🏛 Village Admin Dashboard
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, background: THEME.colors.primaryLight, color: THEME.colors.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, flexShrink: 0 }}>
            {fullName?.charAt(0).toUpperCase() || profile?.name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: THEME.colors.text }}>{fullName || profile?.name || session?.user?.email || "User"}</h3>
            <p style={{ color: THEME.colors.textMuted, margin: 0, fontSize: 14 }}>{session?.user?.email || phone || profile?.phone}</p>
          </div>
        </div>
      </div>

      {/* Account Details Form */}
      <form onSubmit={handleSaveProfile} style={{ background: THEME.colors.background, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, padding: 24, marginBottom: 24 }}>
        <h4 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 16px", color: THEME.colors.text, display: "flex", alignItems: "center", gap: 8 }}>
          👤 Personal & Village Information
        </h4>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Full Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Phone Number</label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Village Name</label>
            <input
              type="text"
              placeholder="e.g. Visakhapatnam"
              value={villageName}
              onChange={e => setVillageName(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>District</label>
            <input
              type="text"
              placeholder="e.g. Visakhapatnam"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "12px 24px",
            borderRadius: THEME.radius.sm,
            background: THEME.colors.primary,
            color: "white",
            border: "none",
            fontSize: 14,
            fontWeight: 800,
            cursor: saving ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: THEME.shadow.sm,
          }}
        >
          {saving ? "Saving to DB..." : "💾 Save Account Details"}
        </button>
      </form>

      <div style={{ background: THEME.colors.background, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: THEME.colors.text }}>{t('total_grievances')}</h4>
            <p style={{ fontSize: 13, color: THEME.colors.textMuted, margin: 0 }}>{t('grievances_reported_desc')}</p>
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: THEME.colors.primary }}>
            {loading ? "..." : count}
          </div>
        </div>
      </div>

      {/* Push Notifications Section */}
      <div style={{ background: THEME.colors.primaryLight, border: `1px solid ${THEME.colors.primary}`, borderRadius: THEME.radius.md, padding: 24, marginBottom: 24 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: THEME.colors.primaryHover, margin: "0 0 8px" }}>🔔 {t('push_notifications')}</h4>
        <p style={{ fontSize: 13, color: THEME.colors.primaryHover, margin: "0 0 16px", lineHeight: 1.6 }}>
          {t('push_desc')}
        </p>
        {pushStatus === "granted" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: THEME.colors.success, fontWeight: 700, fontSize: 13 }}>
            ✅ {t('push_enabled_status')}
          </div>
        ) : (
          <Btn onClick={enablePush} style={{ padding: "10px 24px", fontSize: 13 }}>
            🔔 {t('enable_push')}
          </Btn>
        )}
      </div>

      <div style={{ background: THEME.colors.successBg, border: `1px solid #86efac`, borderRadius: THEME.radius.md, padding: 24 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: THEME.colors.success, margin: "0 0 8px" }}>{t('account_security')}</h4>
        <p style={{ fontSize: 14, color: "#15803d", margin: 0, lineHeight: 1.6 }}>
          {t('auth_desc')} <strong>{session.user?.app_metadata?.provider === 'google' ? t('auth_method_google') : t('auth_method_email')}</strong>.
          {session.user?.app_metadata?.provider === 'google' ? ` ${t('auth_no_password')}` : ''}
        </p>
      </div>
    </div>
  );
};

const GovLinksView = ({ t }) => {
  const links = [
    { title: "CPGRAMS", desc: "Centralized Public Grievance Redress and Monitoring System for submitting grievances directly to the Govt of India.", url: "https://pgportal.gov.in/" },
    { title: "MyGov", desc: "Citizen engagement platform for participatory governance.", url: "https://www.mygov.in/" },
    { title: "National Portal of India", desc: "Single-window access to information and services provided by the Indian Government.", url: "https://www.india.gov.in/" },
    { title: "RTI Online", desc: "Portal to file RTI applications online.", url: "https://rtionline.gov.in/" }
  ];

  return (
    <div className="responsive-card" style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 880, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.01em" }}>{t('official_resources')}</h2>
      <p style={{ color: THEME.colors.textMuted, marginBottom: 32, fontSize: 15 }}>{t('explore_portals')}</p>
      
      <div className="resource-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {links.map((link, i) => (
          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ padding: 24, borderRadius: THEME.radius.md, border: `1px solid ${THEME.colors.border}`, background: THEME.colors.background, transition: "all 0.2s", cursor: "pointer", height: "100%", boxSizing: "border-box" }}
                 onMouseOver={e => { e.currentTarget.style.borderColor = THEME.colors.primary; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = THEME.shadow.sm; }}
                 onMouseOut={e => { e.currentTarget.style.borderColor = THEME.colors.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: THEME.colors.primaryHover, marginBottom: 10 }}>{link.title} ↗</h3>
              <p style={{ fontSize: 14, color: THEME.colors.textMuted, margin: 0, lineHeight: 1.6 }}>{link.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

// ─── Photo Lightbox ──────────────────────────────────────────────────────────

const PhotoLightbox = ({ photos, startIndex, onClose, t }) => {
  const [idx, setIdx] = useState(startIndex || 0);
  const [broken, setBroken] = useState(false);
  if (!photos || photos.length === 0) return null;
  const src = toPhotoUrl(photos[idx]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
        {src && !broken ? (
          <img src={src} alt="" onError={() => setBroken(true)} style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
        ) : (
          <div style={{ width: "min(520px, 86vw)", minHeight: 260, borderRadius: 12, background: "#111827", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: THEME.font, fontWeight: 800, textAlign: "center", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>Image unavailable</div>
        )}
        <div style={{ textAlign: "center", marginTop: 12, color: "#fff", fontFamily: THEME.font, fontWeight: 700, fontSize: 13 }}>
          {t('photo_of', { current: idx + 1, total: photos.length })}
        </div>
        {photos.length > 1 && (
          <>
            <button onClick={() => { setBroken(false); setIdx((idx - 1 + photos.length) % photos.length); }} style={{ position: "absolute", left: -50, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, cursor: "pointer", backdropFilter: "blur(4px)" }}>‹</button>
            <button onClick={() => { setBroken(false); setIdx((idx + 1) % photos.length); }} style={{ position: "absolute", right: -50, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, cursor: "pointer", backdropFilter: "blur(4px)" }}>›</button>
          </>
        )}
        <button onClick={onClose} style={{ position: "absolute", top: -15, right: -15, background: "#EF4444", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.4)" }}>✕</button>
      </div>
    </div>
  );
};

// ─── Enhanced Analytics Tab (with Heatmap + Resolution Time + Satisfaction) ──

const AnalyticsTab = ({ list, t }) => {
  const [ratings, setRatings] = useState([]);
  
  useEffect(() => {
    supabase.from("complaint_ratings").select("*").then(({ data }) => {
      if (data) setRatings(data);
    });
  }, []);

  const stats = useMemo(() => {
    const total = list.length;
    const byStatus = {};
    STATUS_FLOW.forEach(s => { byStatus[s] = list.filter(c => c.status === s).length; });
    const byCat = {};
    CATEGORIES.forEach(c => { byCat[c.id] = list.filter(x => (x.category || "").includes(c.id)).length; });
    const withPhotos = list.filter(c => getComplaintPhotoUrls(c).length > 0).length;
    const urgent = list.filter(c => c.priority === "Urgent").length;

    // Resolution time calculation
    const resolved = list.filter(c => c.status === "Resolved" || c.status === "Closed");
    const avgResolutionDays = resolved.length > 0
      ? Math.round(resolved.reduce((acc, c) => {
          const days = (new Date(c.updated_at) - new Date(c.created_at)) / (1000 * 60 * 60 * 24);
          return acc + Math.max(0, days);
        }, 0) / resolved.length)
      : 0;

    // Average satisfaction
    const avgRating = ratings.length > 0
      ? (ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length).toFixed(1)
      : "—";

    // Geo data for heatmap
    const geoData = list.filter(c => c.latitude && c.longitude).map(c => ({
      lat: parseFloat(c.latitude),
      lng: parseFloat(c.longitude),
      status: c.status,
      title: c.title,
      category: c.category,
    }));

    return { total, byStatus, byCat, withPhotos, urgent, avgResolutionDays, avgRating, geoData };
  }, [list, ratings]);

  const maxCat = Math.max(1, ...Object.values(stats.byCat));

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Panchayat Monthly Summary Report", 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);
    
    doc.setFontSize(14);
    doc.text("Summary Statistics", 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Value']],
      body: [
        ['Total Complaints', stats.total],
        ['Open', stats.byStatus.Open || 0],
        ['In Progress', stats.byStatus["In Progress"] || 0],
        ['Resolved', stats.byStatus.Resolved || 0],
        ['Escalated', stats.byStatus.Escalated || 0],
        ['Avg. Resolution Time (days)', stats.avgResolutionDays],
      ],
    });
    
    doc.text("Category Breakdown", 14, doc.lastAutoTable.finalY + 15);
    
    const catData = CATEGORIES.map(c => [t(c.key), stats.byCat[c.id] || 0]);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Category', 'Complaints']],
      body: catData,
    });
    
    doc.text("Recent Complaints", 14, doc.lastAutoTable.finalY + 15);
    
    const recentData = list.slice(0, 10).map(c => [
      c.ticket_id, 
      c.category, 
      c.title, 
      c.status,
      new Date(c.created_at).toLocaleDateString()
    ]);
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Ticket ID', 'Category', 'Title', 'Status', 'Date']],
      body: recentData,
      styles: { fontSize: 9 }
    });
    
    doc.save("Panchayat_Monthly_Report.pdf");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={generatePDFReport}><AppIcon name="download" size={17} /> {t('download_report_pdf', { defaultValue: "Download PDF Report" })}</Btn>
      </div>
      {/* Summary Cards */}
      <div className="analytics-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 14 }}>
        {[
          { label: t('total_complaints'), value: stats.total, iconName: "chart", color: THEME.colors.primary, bg: THEME.colors.primaryLight },
          { label: t('open_complaints'), value: stats.byStatus.Open || 0, iconName: "dot", color: THEME.colors.danger, bg: THEME.colors.dangerBg },
          { label: t('in_progress_complaints'), value: stats.byStatus["In Progress"] || 0, iconName: "dot", color: THEME.colors.primary, bg: THEME.colors.primaryLight },
          { label: t('resolved_complaints'), value: stats.byStatus.Resolved || 0, iconName: "dot", color: THEME.colors.success, bg: THEME.colors.successBg },
          { label: t('escalated_complaints'), value: stats.byStatus.Escalated || 0, iconName: "alert", color: "#f97316", bg: "#fff7ed" },
          { label: t('avg_resolution'), value: `${stats.avgResolutionDays}d`, iconName: "clock", color: "#7c3aed", bg: "#ede9fe" },
          { label: t('satisfaction_score'), value: stats.avgRating, iconName: "star", color: "#f59e0b", bg: "#fffbeb" },
        ].map((card, i) => (
          <div key={i} style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: "20px 18px", border: `1px solid ${THEME.colors.border}`, boxShadow: THEME.shadow.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ width: 42, height: 42, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: card.bg, color: card.color }}><AppIcon name={card.iconName} size={21} strokeWidth={2.2} /></span>
              {typeof card.value === 'number' && stats.total > 0 && (
                <span style={{ background: card.bg, color: card.color, padding: "3px 10px", borderRadius: THEME.radius.full, fontSize: 10, fontWeight: 800 }}>{Math.round((card.value / stats.total) * 100)}%</span>
              )}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: THEME.colors.textMuted, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Complaint Heatmap */}
      {stats.geoData.length > 0 && (
        <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24, border: `1px solid ${THEME.colors.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}><AppIcon name="road" size={19} color={THEME.colors.primary} /> {t('complaint_heatmap')}</h3>
          <div className="leaflet-map-frame" style={{ height: 350, borderRadius: THEME.radius.md, overflow: "hidden", border: `1.5px solid ${THEME.colors.border}` }}>
            <MapContainer
              center={[stats.geoData[0].lat, stats.geoData[0].lng]}
              zoom={12}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
              {stats.geoData.map((pt, i) => {
                const sm = STATUS_META[pt.status] || STATUS_META.Open;
                // Use hardcoded colors since CSS vars can't be used in Leaflet
                const colorMap = {
                  "Open": "#dc2626",
                  "Assigned": "#d97706",
                  "In Progress": "#0284c7",
                  "Resolved": "#16a34a",
                  "Closed": "#475569",
                  "Escalated": "#991b1b"
                };
                return (
                  <CircleMarker
                    key={i}
                    center={[pt.lat, pt.lng]}
                    radius={10}
                    pathOptions={{
                      color: colorMap[pt.status] || "#dc2626",
                      fillColor: colorMap[pt.status] || "#dc2626",
                      fillOpacity: 0.6,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <strong>{pt.title}</strong><br />
                      {sm.icon} {pt.status} • {pt.category}
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Category Distribution */}
      <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24, border: `1px solid ${THEME.colors.border}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 9 }}><AppIcon name="folder" size={19} color={THEME.colors.primary} /> {t('category_distribution')}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CATEGORIES.map(c => {
            const count = stats.byCat[c.id] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: THEME.colors.text, display: "flex", alignItems: "center", gap: 7 }}><AppIcon name={c.iconName} size={15} color={c.color} /> {t(c.key)}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: THEME.colors.textMuted }}>{count} ({pct}%)</span>
                </div>
                <div style={{ background: THEME.colors.background, borderRadius: THEME.radius.full, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${(count / maxCat) * 100}%`, height: "100%", background: THEME.colors.primary, borderRadius: THEME.radius.full, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Breakdown + Evidence */}
      <div className="analytics-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24, border: `1px solid ${THEME.colors.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 9 }}><AppIcon name="trend" size={19} color={THEME.colors.primary} /> {t('status_breakdown')}</h3>
          {STATUS_FLOW.map(s => {
            const m = STATUS_META[s];
            const count = stats.byStatus[s] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const sKey = `status_${s.toLowerCase().replace(" ", "_")}`;
            return (
              <div key={s} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.color, display: "flex", alignItems: "center", gap: 7 }}><AppIcon name={m.iconName} size={14} /> {t(sKey)}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: THEME.colors.textMuted }}>{count} ({pct}%)</span>
                </div>
                <div style={{ background: m.bg, borderRadius: THEME.radius.full, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: THEME.radius.full, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24, border: `1px solid ${THEME.colors.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: 20, background: THEME.colors.successBg, color: THEME.colors.success, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><AppIcon name="camera" size={30} strokeWidth={1.8} /></span>
          <div style={{ fontSize: 42, fontWeight: 900, color: THEME.colors.success }}>{stats.withPhotos}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginTop: 4, textAlign: "center" }}>{t('evidence_backed')}</div>
          <div style={{ fontSize: 11, color: THEME.colors.textMuted, marginTop: 2, textAlign: "center" }}>{t('complaints_with_photos')}</div>
          <div style={{ marginTop: 16, width: "100%", background: THEME.colors.background, borderRadius: THEME.radius.full, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${stats.total > 0 ? (stats.withPhotos / stats.total) * 100 : 0}%`, height: "100%", background: THEME.colors.success, borderRadius: THEME.radius.full, transition: "width 0.6s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: THEME.colors.textMuted }}>{stats.withPhotos} {t('with_evidence')}</span>
            <span style={{ fontSize: 10, color: THEME.colors.textMuted }}>{stats.total - stats.withPhotos} {t('without_evidence')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Staff / User Management Tab Component ──────────────────────────────────
const StaffManagementTab = ({ t, notify, session, currentProfile }) => {
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [acceptedProfiles, setAcceptedProfiles] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("staff"); // staff | citizens | invitations
  
  // Invite Form Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState("citizen");
  const [inviteEmail, setInviteEmail] = useState("");
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState(null);

  // Pagination & Filtering
  const [updatingId, setUpdatingId] = useState(null);
  const [policyError, setPolicyError] = useState(false);
  const [staffRoleFilter, setStaffRoleFilter] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, [currentProfile?.village_id]);

  useEffect(() => {
    setCurrentPage(1); // Reset page on tab change
  }, [activeSubTab, search, staffRoleFilter, inviteStatusFilter]);

  const fetchUsers = async () => {
    if (!currentProfile?.village_id) return;
    setLoadingUsers(true);
    // Scope search strictly to members of the admin's village
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("village_id", currentProfile.village_id)
      .order("created_at", { ascending: false });

    if (error) {
      notify(error.message, "err");
    } else {
      // Exclude super_admins and district_admins from staff & citizen directories
      const filtered = (data || []).filter(u => u.role !== 'super_admin' && u.role !== 'district_admin');
      setUsers(filtered);
    }
    setLoadingUsers(false);
  };

  const fetchInvitations = async () => {
    if (!currentProfile?.village_id) return;
    setLoadingInvites(true);
    
    // Fetch invitations for the current village
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("village_id", currentProfile.village_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setInvitations(data || []);
      
      // Batch fetch profile names for invitations that were accepted
      const acceptedUserIds = (data || [])
        .filter(i => i.accepted_by)
        .map(i => i.accepted_by);
        
      if (acceptedUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", acceptedUserIds);
          
        const profileMap = {};
        if (profilesData) {
          profilesData.forEach(p => {
            profileMap[p.id] = p;
          });
        }
        setAcceptedProfiles(profileMap);
      }
    }
    setLoadingInvites(false);
  };

  const handleCreateInvitation = async (e) => {
    e.preventDefault();
    setSubmittingInvite(true);
    setGeneratedInvite(null);

    if (!session?.user?.id) {
      notify("No active session. Please log in again.", "err");
      setSubmittingInvite(false);
      return;
    }

    try {
      // Generate a secure random token client-side (64 hex chars = 32 bytes)
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const token = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 100); // Never expires

      const targetVillageId = currentProfile?.village_id;
      if (!targetVillageId) {
        notify("Your admin account is not associated with any village.", "err");
        setSubmittingInvite(false);
        return;
      }

      const { data: inviteData, error: inviteError } = await supabase
        .from("invitations")
        .insert({
          token,
          village_id: targetVillageId,
          role: inviteRole,
          email: inviteEmail ? inviteEmail.trim().toLowerCase() : null,
          created_by: session.user.id,
          expires_at: expiresAt.toISOString(),
          status: "pending",
        })
        .select()
        .single();

      if (inviteError) {
        notify(inviteError.message || "Failed to create invitation.", "err");
      } else {
        const invitationUrl = `${window.location.origin}/invite/${token}`;
        setGeneratedInvite({
          success: true,
          token,
          url: invitationUrl,
          expires_at: inviteData.expires_at,
          invitation: inviteData,
        });
        notify("Invitation link generated successfully! 🔗");
        setInviteEmail("");
        fetchInvitations();
      }
    } catch (err) {
      notify(err?.message || "Network error. Please try again.", "err");
    }
    setSubmittingInvite(false);
  };

  const handleRevokeInvitation = async (inviteId) => {
    if (!window.confirm("Are you sure you want to revoke this invitation? The link will immediately stop working.")) return;
    
    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId);

    if (error) {
      notify(error.message, "err");
    } else {
      notify("Invitation link revoked successfully! ✓");
      fetchInvitations();
    }
  };

  const updateUserRole = async (userId, newRole) => {
    if (userId === session?.user?.id) {
      notify("For safety, you cannot modify your own role to prevent system lockout.", "err");
      return;
    }
    
    setUpdatingId(userId);
    setPolicyError(false);
    
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      console.error(error);
      notify(error.message, "err");
      if (error.message.includes("policy") || error.code === "42501") {
        setPolicyError(true);
      }
    } else {
      notify(t("role_changed") || "User role updated successfully! ✓");
      fetchUsers();
    }
    setUpdatingId(null);
  };

  // --- Filtering Logic ---
  const term = search.toLowerCase();

  const staffUsers = users.filter(u => {
    const isStaff = u.role === "village_admin" || u.role === "officer";
    if (!isStaff) return false;
    
    const matchesSearch = (u.name || "").toLowerCase().includes(term) || 
                          (u.phone || "").toLowerCase().includes(term);
    const matchesRole = staffRoleFilter ? u.role === staffRoleFilter : true;
    
    return matchesSearch && matchesRole;
  });

  const citizenUsers = users.filter(u => {
    const isCitizen = u.role === "citizen";
    if (!isCitizen) return false;
    
    return (u.name || "").toLowerCase().includes(term) || 
           (u.phone || "").toLowerCase().includes(term);
  });

  const filteredInvites = invitations.filter(i => {
    const matchesSearch = i.role.includes(term) || (i.email && i.email.toLowerCase().includes(term));
    const matchesStatus = inviteStatusFilter ? i.status === inviteStatusFilter : true;
    return matchesSearch && matchesStatus;
  });

  // --- Pagination Logic ---
  const getPaginatedItems = (items) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return items.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const getPageCount = (items) => Math.ceil(items.length / ITEMS_PER_PAGE);

  // --- Stats Calculators ---
  const totalStaff = users.filter(u => u.role === "village_admin" || u.role === "officer").length;
  const adminCount = users.filter(u => u.role === "village_admin").length;
  const officerCount = users.filter(u => u.role === "officer").length;
  const totalCitizens = users.filter(u => u.role === "citizen").length;
  
  const pendingInvites = invitations.filter(i => i.status === "pending" && new Date(i.expires_at) > new Date()).length;
  const acceptedInvites = invitations.filter(i => i.status === "accepted").length;

  const getRoleBadge = (role) => {
    const s = {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "4px 10px",
      borderRadius: THEME.radius.full,
      fontSize: 11,
      fontWeight: 800,
      textTransform: "uppercase",
      fontFamily: THEME.font
    };
    if (role === "village_admin") {
      return <span style={{ ...s, background: THEME.colors.dangerBg, color: THEME.colors.danger, border: `1.5px solid ${STATUS_META.Open.border}` }}>{t('badge_admin') || '🔑 Village Admin'}</span>;
    }
    if (role === "officer") {
      return <span style={{ ...s, background: THEME.colors.successBg, color: THEME.colors.success, border: `1.5px solid ${STATUS_META.Resolved.border}` }}>{t('badge_officer')}</span>;
    }
    return <span style={{ ...s, background: THEME.colors.background, color: THEME.colors.textMuted, border: `1.5px solid ${THEME.colors.border}` }}>{t('badge_citizen')}</span>;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    notify("Copied to clipboard! 📋");
  };

  // Check if target user has a protected role (e.g. self-lockout prevention)
  const isUserProtected = (targetUser) => {
    return targetUser.id === session?.user?.id;
  };

  return (
    <div style={{ fontFamily: THEME.font, maxWidth: "100%", margin: "0 auto" }}>
      {policyError && (
        <div style={{ background: THEME.colors.dangerBg, border: `1px solid ${STATUS_META.Open.border}`, borderRadius: THEME.radius.md, padding: "16px 20px", marginBottom: 20, color: THEME.colors.danger, fontSize: 13, lineHeight: 1.6 }}>
          <strong style={{ fontSize: 14 }}>⚠️ Row Level Security (RLS) Policy Missing</strong><br/>
          Role updates are not currently permitted by the database policy. Please contact your database administrator to review the required permissions.
        </div>
      )}

      {/* Modern Top Header / Stats Row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {activeSubTab === "staff" && (
          <>
            <div style={{ flex: "1 1 200px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: THEME.shadow.sm }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Total Staff Members</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: THEME.colors.text }}>{totalStaff}</div>
            </div>
            <div style={{ flex: "1 1 200px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: THEME.shadow.sm }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Village Admins</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: THEME.colors.primary }}>{adminCount}</div>
            </div>
            <div style={{ flex: "1 1 200px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: THEME.shadow.sm }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Officers</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: THEME.colors.success }}>{officerCount}</div>
            </div>
          </>
        )}
        {activeSubTab === "citizens" && (
          <div style={{ flex: "1 1 300px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: THEME.shadow.sm }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Registered Citizens</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: THEME.colors.text }}>{totalCitizens}</div>
          </div>
        )}
        {activeSubTab === "invitations" && (
          <>
            <div style={{ flex: "1 1 240px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: THEME.shadow.sm }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Pending Invitations</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>{pendingInvites}</div>
            </div>
            <div style={{ flex: "1 1 240px", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: THEME.shadow.sm }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6 }}>Accepted Invitations</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{acceptedInvites}</div>
            </div>
          </>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${THEME.colors.border}`, marginBottom: 24, gap: 16, flexWrap: "wrap", paddingBottom: 2 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <button
            onClick={() => setActiveSubTab("staff")}
            style={{
              padding: "12px 4px",
              background: "none",
              border: "none",
              borderBottom: activeSubTab === "staff" ? `3px solid ${THEME.colors.primary}` : "3px solid transparent",
              fontWeight: 800,
              fontSize: 15,
              color: activeSubTab === "staff" ? THEME.colors.text : THEME.colors.textMuted,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            👥 {t('staff_tab')} ({totalStaff})
          </button>
          <button
            onClick={() => setActiveSubTab("citizens")}
            style={{
              padding: "12px 4px",
              background: "none",
              border: "none",
              borderBottom: activeSubTab === "citizens" ? `3px solid ${THEME.colors.primary}` : "3px solid transparent",
              fontWeight: 800,
              fontSize: 15,
              color: activeSubTab === "citizens" ? THEME.colors.text : THEME.colors.textMuted,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            🏠 {t('citizens_tab')} ({totalCitizens})
          </button>
          <button
            onClick={() => setActiveSubTab("invitations")}
            style={{
              padding: "12px 4px",
              background: "none",
              border: "none",
              borderBottom: activeSubTab === "invitations" ? `3px solid ${THEME.colors.primary}` : "3px solid transparent",
              fontWeight: 800,
              fontSize: 15,
              color: activeSubTab === "invitations" ? THEME.colors.text : THEME.colors.textMuted,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            ✉️ {t('invite_links_tab')}
          </button>
        </div>

        {/* Action Button */}
        {activeSubTab === "invitations" && (
          <button
            onClick={() => { setShowInviteModal(true); setGeneratedInvite(null); }}
            style={{
              background: "linear-gradient(135deg, #111827, #1f2937)",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            ➕ {t('invite_member')}
          </button>
        )}
      </div>

      {/* Search / Filter Control Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <input
            type="text"
            placeholder={
              activeSubTab === "staff"
                ? t('search_staff_placeholder')
                : activeSubTab === "citizens"
                ? t('search_citizens_placeholder')
                : t('search_invitations_placeholder')
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px 12px 40px",
              borderRadius: 14,
              border: `1.5px solid ${THEME.colors.border}`,
              fontSize: 13,
              fontWeight: 700,
              color: THEME.colors.text,
              outline: "none",
              boxSizing: "border-box",
              background: THEME.colors.surface
            }}
          />
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>🔍</span>
        </div>

        {/* Filters */}
        {activeSubTab === "staff" && (
          <select
            value={staffRoleFilter}
            onChange={e => setStaffRoleFilter(e.target.value)}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: `1.5px solid ${THEME.colors.border}`,
              fontSize: 13,
              fontWeight: 700,
              color: THEME.colors.text,
              outline: "none",
              cursor: "pointer",
              background: THEME.colors.surface
            }}
          >
            <option value="">{t('filter_all_roles')}</option>
            <option value="village_admin">{t('filter_village_admins')}</option>
            <option value="officer">{t('filter_officers')}</option>
          </select>
        )}

        {activeSubTab === "invitations" && (
          <select
            value={inviteStatusFilter}
            onChange={e => setInviteStatusFilter(e.target.value)}
            style={{
              padding: "11px 16px",
              borderRadius: 14,
              border: `1.5px solid ${THEME.colors.border}`,
              fontSize: 13,
              fontWeight: 700,
              color: THEME.colors.text,
              outline: "none",
              cursor: "pointer",
              background: THEME.colors.surface
            }}
          >
            <option value="">{t('filter_all_roles')}</option>
            <option value="pending">{t('filter_pending')}</option>
            <option value="accepted">{t('filter_accepted')}</option>
            <option value="revoked">{t('filter_revoked')}</option>
            <option value="expired">{t('filter_expired')}</option>
          </select>
        )}

        <Btn
          variant="outline"
          onClick={activeSubTab === "invitations" ? fetchInvitations : fetchUsers}
          disabled={loadingUsers || loadingInvites}
          style={{ padding: "10px 20px", borderRadius: 14, minHeight: 44 }}
        >
          {loadingUsers || loadingInvites ? t('refreshing') : "🔄 Refresh"}
        </Btn>
      </div>

      {/* --- Main Tab Content Renderers --- */}

      {loadingUsers || loadingInvites ? (
        // Premium Loading Skeleton
        <div style={{ background: THEME.colors.surface, borderRadius: 20, border: `1px solid ${THEME.colors.border}`, padding: 32, textAlign: "center" }}>
          <div style={{ display: "inline-block", width: 48, height: 48, border: `4px solid ${THEME.colors.border}`, borderTopColor: THEME.colors.primary, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <p style={{ fontWeight: 800, marginTop: 16, color: THEME.colors.textMuted }}>{t('retrieving_details')}</p>
        </div>
      ) : activeSubTab === "staff" ? (
        /* ==================== TAB 1: STAFF DIRECTORY ==================== */
        staffUsers.length === 0 ? (
          <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 20, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: THEME.colors.text }}>{t('no_staff_found')}</h3>
            <p style={{ color: THEME.colors.textMuted, margin: "6px 0 0", fontSize: 13 }}>{t('no_staff_hint')}</p>
          </div>
        ) : (
          <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 20, overflow: "hidden", boxShadow: THEME.shadow.sm }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: THEME.colors.background, borderBottom: `1.5px solid ${THEME.colors.border}` }}>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_full_name')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_phone_number')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_current_role')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_registered_date')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted, textAlign: "right" }}>{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedItems(staffUsers).map(u => {
                    const isSelf = u.id === session?.user?.id;
                    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "N/A";
                    
                    return (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${THEME.colors.border}`, background: isSelf ? THEME.colors.background : THEME.colors.surface, transition: "background 0.2s" }}>
                        <td style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.text }}>
                          {u.name || t('unnamed_user')} {isSelf && <span style={{ color: THEME.colors.success, fontSize: 11, background: THEME.colors.successBg, padding: "2px 6px", borderRadius: 6, marginLeft: 4 }}>{t('you_label')}</span>}
                        </td>
                        <td style={{ padding: "18px 24px", color: THEME.colors.textMuted, fontWeight: 700 }}>{u.phone || t('no_phone_linked')}</td>
                        <td style={{ padding: "18px 24px" }}>{getRoleBadge(u.role)}</td>
                        <td style={{ padding: "18px 24px", color: THEME.colors.textMuted, fontWeight: 600 }}>{dateStr}</td>
                        <td style={{ padding: "18px 24px", textAlign: "right" }}>
                          {isSelf ? (
                            <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 700, padding: "8px 12px", background: THEME.colors.background, borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              🔒 {t('protected_account')}
                            </span>
                          ) : (
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                              {updatingId === u.id ? (
                                <span style={{ fontSize: 12, color: THEME.colors.success, fontWeight: 800, animation: "urgentPulse 1.5s infinite" }}>{t('updating')}</span>
                              ) : (
                                <select
                                  value={u.role || "officer"}
                                  onChange={e => updateUserRole(u.id, e.target.value)}
                                  disabled={updatingId !== null}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    border: `1.5px solid ${THEME.colors.border}`,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: THEME.colors.text,
                                    outline: "none",
                                    cursor: "pointer",
                                    background: THEME.colors.surface
                                  }}
                                >
                                  <option value="citizen">{t('demote_citizen')}</option>
                                  <option value="officer">{t('officer_label')}</option>
                                  <option value="village_admin">{t('village_admin_label')}</option>
                                </select>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {getPageCount(staffUsers) > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: THEME.colors.background, borderTop: `1px solid ${THEME.colors.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted }}>
                  {t('showing_page', { current: currentPage, total: getPageCount(staffUsers) })}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 12px", fontSize: 12 }}>{t('previous')}</Btn>
                  <Btn variant="outline" disabled={currentPage === getPageCount(staffUsers)} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: "6px 12px", fontSize: 12 }}>{t('next')}</Btn>
                </div>
              </div>
            )}
          </div>
        )
      ) : activeSubTab === "citizens" ? (
        /* ==================== TAB 2: CITIZEN DIRECTORY ==================== */
        citizenUsers.length === 0 ? (
          <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 20, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: THEME.colors.text }}>{t('no_citizens_found')}</h3>
            <p style={{ color: THEME.colors.textMuted, margin: "6px 0 0", fontSize: 13 }}>{t('no_citizens_hint')}</p>
          </div>
        ) : (
          <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 20, overflow: "hidden", boxShadow: THEME.shadow.sm }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: THEME.colors.background, borderBottom: `1.5px solid ${THEME.colors.border}` }}>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_full_name')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_phone_number')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('current_status')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_registered_date')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted, textAlign: "right" }}>{t('col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedItems(citizenUsers).map(u => {
                    const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "N/A";
                    return (
                      <tr key={u.id} style={{ borderBottom: `1px solid ${THEME.colors.border}`, background: THEME.colors.surface, transition: "background 0.2s" }}>
                        <td style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.text }}>
                          {u.name || t('unnamed_user')}
                        </td>
                        <td style={{ padding: "18px 24px", color: THEME.colors.textMuted, fontWeight: 700 }}>{u.phone || t('no_phone_linked')}</td>
                        <td style={{ padding: "18px 24px" }}>
                          <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 8, background: "#f3f4f6", color: "#374151", fontSize: 11, fontWeight: 700 }}>{t('citizen_label')}</span>
                        </td>
                        <td style={{ padding: "18px 24px", color: THEME.colors.textMuted, fontWeight: 600 }}>{dateStr}</td>
                        <td style={{ padding: "18px 24px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                            {updatingId === u.id ? (
                              <span style={{ fontSize: 12, color: THEME.colors.success, fontWeight: 800, animation: "urgentPulse 1.5s infinite" }}>{t('updating')}</span>
                            ) : (
                              <select
                                value="citizen"
                                onChange={e => updateUserRole(u.id, e.target.value)}
                                disabled={updatingId !== null}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: 10,
                                  border: `1.5px solid ${THEME.colors.border}`,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: THEME.colors.text,
                                  outline: "none",
                                  cursor: "pointer",
                                  background: THEME.colors.surface
                                }}
                              >
                                <option value="citizen">{t('citizen_label')}</option>
                                <option value="officer">{t('promote_officer')}</option>
                                <option value="village_admin">{t('promote_admin')}</option>
                              </select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {getPageCount(citizenUsers) > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: THEME.colors.background, borderTop: `1px solid ${THEME.colors.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted }}>
                  {t('showing_page', { current: currentPage, total: getPageCount(citizenUsers) })}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 12px", fontSize: 12 }}>{t('previous')}</Btn>
                  <Btn variant="outline" disabled={currentPage === getPageCount(citizenUsers)} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: "6px 12px", fontSize: 12 }}>{t('next')}</Btn>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* ==================== TAB 3: INVITATIONS ==================== */
        filteredInvites.length === 0 ? (
          <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 20, padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: THEME.colors.text }}>{t('invite_no_invitations')}</h3>
            <p style={{ color: THEME.colors.textMuted, margin: "6px 0 0", fontSize: 13 }}>{t('invite_no_invitations_hint')}</p>
          </div>
        ) : (
          <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: 20, overflow: "hidden", boxShadow: THEME.shadow.sm }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: THEME.colors.background, borderBottom: `1.5px solid ${THEME.colors.border}` }}>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('invite_role_type')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('invite_restricted_email')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('invite_link_expiry')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('status_label')}</th>
                    <th style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.textMuted, textAlign: "right" }}>{t('actions_label')}</th>
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedItems(filteredInvites).map(i => {
                    const protocol = window.location.protocol;
                    const host = window.location.host;
                    const inviteUrl = `${protocol}//${host}/invite/${i.token}`;
                    
                    const isExpired = new Date(i.expires_at) < new Date();
                    const statusText = i.status === "pending" && isExpired ? "expired" : i.status;
                    
                    let badgeColor = "#9ca3af";
                    let badgeBg = "#f3f4f6";
                    if (statusText === "pending") {
                      badgeColor = "#d97706";
                      badgeBg = "#fffbeb";
                    } else if (statusText === "accepted") {
                      badgeColor = "#059669";
                      badgeBg = "#ecfdf5";
                    } else if (statusText === "revoked" || statusText === "expired") {
                      badgeColor = "#dc2626";
                      badgeBg = "#fef2f2";
                    }

                    const expiryDate = new Date(i.expires_at).toLocaleDateString(undefined, { dateStyle: "medium" });

                    return (
                      <tr key={i.id} style={{ borderBottom: `1px solid ${THEME.colors.border}`, background: THEME.colors.surface, transition: "background 0.2s" }}>
                        <td style={{ padding: "18px 24px", fontWeight: 800, color: THEME.colors.text, textTransform: "capitalize" }}>
                          {i.role === "village_admin" ? t('village_admin_label') : i.role === "officer" ? t('officer_label') : t('citizen_label')}
                        </td>
                        <td style={{ padding: "18px 24px", color: THEME.colors.textMuted, fontWeight: 700 }}>
                          {i.email || t('invite_any_email')}
                        </td>
                        <td style={{ padding: "18px 24px", color: THEME.colors.textMuted, fontWeight: 600 }}>{expiryDate}</td>
                        <td style={{ padding: "18px 24px" }}>
                          <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 8, background: badgeBg, color: badgeColor, fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                            {statusText}
                          </span>
                        </td>
                        <td style={{ padding: "18px 24px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                            {statusText === "pending" ? (
                              <>
                                <button
                                  onClick={() => copyToClipboard(inviteUrl)}
                                  style={{ background: "none", border: "none", color: THEME.colors.primary, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: "6px 10px", borderRadius: 8 }}
                                  onMouseOver={e => e.currentTarget.style.background = "#f3f4f6"}
                                  onMouseOut={e => e.currentTarget.style.background = "none"}
                                >
                                  🔗 {t('invite_copy_link')}
                                </button>
                                <button
                                  onClick={() => handleRevokeInvitation(i.id)}
                                  style={{ background: "none", border: "none", color: THEME.colors.danger, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: "6px 10px", borderRadius: 8 }}
                                  onMouseOver={e => e.currentTarget.style.background = "#fef2f2"}
                                  onMouseOut={e => e.currentTarget.style.background = "none"}
                                >
                                  {t('invite_revoke')}
                                </button>
                              </>
                            ) : statusText === "accepted" && acceptedProfiles[i.accepted_by] ? (
                              <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 700 }}>
                                {t('invite_accepted_by')}: <strong>{acceptedProfiles[i.accepted_by].name || "Unnamed"}</strong>
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 600 }}>{t('invite_no_actions')}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {getPageCount(filteredInvites) > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: THEME.colors.background, borderTop: `1px solid ${THEME.colors.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted }}>
                  {t('showing_page', { current: currentPage, total: getPageCount(filteredInvites) })}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} style={{ padding: "6px 12px", fontSize: 12 }}>{t('previous')}</Btn>
                  <Btn variant="outline" disabled={currentPage === getPageCount(filteredInvites)} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: "6px 12px", fontSize: 12 }}>{t('next')}</Btn>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* --- Invite Member Modal --- */}
      {showInviteModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: THEME.colors.surface, borderRadius: 24, padding: 32, maxWidth: 460, width: "100%", border: `1px solid ${THEME.colors.border}`, boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, margin: 0, color: THEME.colors.text }}>{t('invite_create_title')}</h3>
              <button
                onClick={() => { setShowInviteModal(false); setGeneratedInvite(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: THEME.colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", transition: "background 0.2s" }}
                onMouseOver={e => e.currentTarget.style.background = THEME.colors.background}
                onMouseOut={e => e.currentTarget.style.background = "none"}
              >
                ✕
              </button>
            </div>

            {!generatedInvite ? (
              <form onSubmit={handleCreateInvitation}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: THEME.colors.textMuted, marginBottom: 8 }}>{t('invite_target_role')}</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 14,
                      border: `1.5px solid ${THEME.colors.border}`,
                      fontSize: 14,
                      fontWeight: 700,
                      outline: "none",
                      background: THEME.colors.background,
                      color: THEME.colors.text,
                      cursor: "pointer"
                    }}
                  >
                    <option value="citizen">{t('invite_role_citizen')}</option>
                    <option value="officer">{t('invite_role_officer')}</option>
                    <option value="village_admin">{t('invite_role_admin')}</option>
                  </select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 800, color: THEME.colors.textMuted, marginBottom: 8 }}>{t('invite_restricted_email')}</label>
                  <input
                    type="email"
                    placeholder={t('invite_email_placeholder')}
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: 14,
                      border: `1.5px solid ${THEME.colors.border}`,
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                      background: THEME.colors.background,
                      color: THEME.colors.text
                    }}
                  />
                  <span style={{ fontSize: 11, color: THEME.colors.textMuted, marginTop: 6, display: "block", lineHeight: 1.4 }}>
                    {t('invite_email_hint')}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submittingInvite}
                  style={{
                    width: "100%",
                    padding: "14px 20px",
                    borderRadius: 14,
                    background: THEME.colors.primary,
                    color: "white",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: submittingInvite ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow: THEME.shadow.sm,
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={e => { if (!submittingInvite) e.currentTarget.style.background = THEME.colors.primaryHover; }}
                  onMouseOut={e => { if (!submittingInvite) e.currentTarget.style.background = THEME.colors.primary; }}
                >
                  {submittingInvite ? t('invite_generating') : `🔗 ${t('invite_generate_btn')}`}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: THEME.colors.successBg, color: THEME.colors.success, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>✓</div>
                <h4 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: THEME.colors.text }}>{t('invite_ready_title')}</h4>
                <p style={{ color: THEME.colors.textMuted, fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
                  {t('invite_share_desc')}
                </p>

                <div style={{ display: "flex", background: THEME.colors.background, border: `1.5px solid ${THEME.colors.border}`, borderRadius: 14, padding: 12, alignItems: "center", gap: 10, marginBottom: 24 }}>
                  <code style={{ fontSize: 12, fontFamily: "monospace", flex: 1, overflowX: "auto", textAlign: "left", whiteSpace: "nowrap", color: THEME.colors.text }}>
                    {generatedInvite.url}
                  </code>
                  <button
                    onClick={() => copyToClipboard(generatedInvite.url)}
                    style={{ background: THEME.colors.surface, border: `1.5px solid ${THEME.colors.border}`, color: THEME.colors.text, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}
                    onMouseOver={e => e.currentTarget.style.background = THEME.colors.background}
                    onMouseOut={e => e.currentTarget.style.background = THEME.colors.surface}
                  >
                    {t('invite_copy')}
                  </button>
                </div>

                <button
                  onClick={() => { setShowInviteModal(false); setGeneratedInvite(null); }}
                  style={{ width: "100%", padding: "12px 20px", borderRadius: 14, background: THEME.colors.background, color: THEME.colors.text, border: `1.5px solid ${THEME.colors.border}`, fontSize: 13, fontWeight: 800, cursor: "pointer", transition: "background 0.2s" }}
                  onMouseOver={e => e.currentTarget.style.background = THEME.colors.border}
                  onMouseOut={e => e.currentTarget.style.background = THEME.colors.background}
                >
                  {t('invite_close_panel')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
// ─── Bulk Import Tab Component ────────────────────────────────────────────────
const BulkImportTab = ({ t, notify }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const parsedData = XLSX.utils.sheet_to_json(ws);
      setData(parsedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setLoading(true);
    let successCount = 0;
    
    // Map data to DB columns. Expecting: Title, Description, Category, Location, Status
    const formattedData = data.map(row => ({
      ticket_id: 'VGS-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      title: row.Title || row.title || 'Bulk Imported Complaint',
      description: row.Description || row.description || 'Imported from offline register',
      category: row.Category || row.category || 'Other',
      location: row.Location || row.location || 'Unknown',
      status: row.Status || row.status || 'Open',
      latitude: 17.3850,
      longitude: 78.4867,
      is_anonymous: true // For admin bulk import without specific citizen
    }));

    // Insert in batches of 100 to avoid limits
    for (let i = 0; i < formattedData.length; i += 100) {
      const batch = formattedData.slice(i, i + 100);
      const { error } = await supabase.from("complaints").insert(batch);
      if (!error) successCount += batch.length;
      else console.error("Import error:", error);
    }

    if (successCount > 0) {
      notify(t('import_success').replace('{{count}}', successCount));
      setData([]); // clear after success
    } else {
      notify(t('import_error'), 'err');
    }
    setLoading(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{ Title: "Broken Pipe", Description: "Water leaking near temple", Category: "Water", Location: "Main Street", Status: "Open" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Complaints");
    XLSX.writeFile(wb, "VGS_Bulk_Import_Template.xlsx");
  };

  return (
    <div style={{ background: THEME.colors.surface, padding: 32, borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.sm }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0" }}>{t('bulk_import')}</h3>
          <p style={{ margin: 0, color: THEME.colors.textMuted, fontSize: 14 }}>{t('bulk_import_desc')}</p>
        </div>
        <Btn variant="ghost" onClick={downloadTemplate} style={{ fontSize: 13 }}>📄 {t('download_template')}</Btn>
      </div>

      <div style={{ border: `2px dashed ${THEME.colors.border}`, borderRadius: THEME.radius.md, padding: 40, textAlign: "center", marginBottom: 24, background: THEME.colors.background }}>
        <input type="file" id="file-upload" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} style={{ display: "none" }} />
        <label htmlFor="file-upload" style={{ display: "inline-block", background: THEME.colors.primary, color: "#fff", padding: "10px 20px", borderRadius: THEME.radius.sm, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
          {t('upload_file')}
        </label>
        <div style={{ color: THEME.colors.textMuted, fontSize: 13 }}>{t('drag_drop_file')}</div>
        <div style={{ color: THEME.colors.textMuted, fontSize: 12, marginTop: 4 }}>{t('supported_formats')}</div>
      </div>

      {data.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 16 }}>{t('preview_data')} ({t('rows_found').replace('{{count}}', data.length)})</h4>
            <Btn onClick={handleImport} disabled={loading}>{loading ? t('importing') : t('import_all')}</Btn>
          </div>
          <div style={{ overflowX: "auto", border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: THEME.colors.background, borderBottom: `1px solid ${THEME.colors.border}` }}>
                  <th style={{ padding: "12px 16px" }}>Title</th>
                  <th style={{ padding: "12px 16px" }}>Category</th>
                  <th style={{ padding: "12px 16px" }}>Location</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 5).map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
                    <td style={{ padding: "12px 16px" }}>{row.Title || row.title}</td>
                    <td style={{ padding: "12px 16px" }}>{row.Category || row.category}</td>
                    <td style={{ padding: "12px 16px" }}>{row.Location || row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 5 && <div style={{ textAlign: "center", padding: 12, color: THEME.colors.textMuted, fontSize: 13 }}>Showing first 5 rows...</div>}
        </div>
      )}
    </div>
  );
};

// ─── Boundaries Tab Component ─────────────────────────────────────────────────
const BoundariesTab = ({ t, notify }) => {
  const [boundaries, setBoundaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { fetchBoundaries(); }, []);

  const fetchBoundaries = async () => {
    setLoading(true);
    const { data } = await supabase.from("village_boundaries").select("*").order("created_at", { ascending: false });
    if (data) setBoundaries(data);
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!name.trim()) return notify("Please enter a boundary name first", "err");
    
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const geojson = JSON.parse(evt.target.result);
        const { error } = await supabase.from("village_boundaries").insert([{ name, geojson }]);
        if (error) throw error;
        notify(t('boundary_uploaded'));
        setName("");
        fetchBoundaries();
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        notify("Invalid GeoJSON file or upload error: " + err.message, "err");
      }
      setUploading(false);
    };
    reader.readAsText(file);
  };

  const deleteBoundary = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    const { error } = await supabase.from("village_boundaries").delete().eq("id", id);
    if (!error) fetchBoundaries();
  };

  return (
    <div style={{ background: THEME.colors.surface, padding: 32, borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.sm }}>
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0" }}>{t('village_boundaries')}</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input label={t('boundary_name')} placeholder="e.g. Ward 5 Boundary" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input type="file" ref={fileInputRef} accept=".geojson,application/geo+json" onChange={handleFileUpload} style={{ display: "none" }} id="geojson-upload" />
            <label htmlFor="geojson-upload" style={{ display: "inline-block", background: THEME.colors.primary, color: "#fff", padding: "12px 20px", borderRadius: THEME.radius.sm, fontWeight: 700, cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.7 : 1 }}>
              {uploading ? "Uploading..." : t('upload_geojson')}
            </label>
          </div>
        </div>
      </div>

      <div>
        <h4 style={{ fontSize: 16, margin: "0 0 16px 0" }}>{t('active_boundaries')}</h4>
        {loading ? <p>Loading...</p> : boundaries.length === 0 ? <p style={{ color: THEME.colors.textMuted }}>{t('no_boundaries')}</p> : (
          <div style={{ border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
              <tbody>
                {boundaries.map(b => (
                  <tr key={b.id} style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
                    <td style={{ padding: "16px 20px", fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: "16px 20px", color: THEME.colors.textMuted }}>{new Date(b.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      <Btn variant="ghost" onClick={() => deleteBoundary(b.id)} style={{ color: THEME.colors.danger }}>{t('delete_boundary')}</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Pulsing Urgent keyframe injector ────────────────────────────────────────

const pulseStyleId = 'admin-pulse-style';
if (typeof document !== 'undefined' && !document.getElementById(pulseStyleId)) {
  const style = document.createElement('style');
  style.id = pulseStyleId;
  style.textContent = `@keyframes urgentPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }`;
  document.head.appendChild(style);
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

const AdminView = ({ t, notify, session, profile, t_officer }) => {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("complaints"); // complaints | analytics | users | admin_reset
  const [lightbox, setLightbox] = useState(null);
  const [upvoteCounts, setUpvoteCounts] = useState({});

  // Filters
  const [fStatus, setFStatus] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [fUrgent, setFUrgent] = useState(false);

  useEffect(() => {
    fetchData();
    if (!t_officer) fetchOfficers();
    fetchUpvotes();
  }, [t_officer]);

  // Supabase Realtime subscription for admin
  useEffect(() => {
    const channel = supabase
      .channel('admin-complaints-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
        fetchData();
        fetchUpvotes();
        // Browser push notification for new complaints
        if (payload.eventType === 'INSERT') {
          showBrowserNotification(
            '🆕 New Grievance Filed',
            `${payload.new.title} — ${payload.new.category}`
          );
        } else if (payload.eventType === 'UPDATE' && payload.old.status !== payload.new.status) {
          showBrowserNotification(
            `📋 Status Updated: ${payload.new.status}`,
            `${payload.new.title} — Ticket #${payload.new.ticket_id}`
          );
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from("complaints").select("*").order("created_at", { ascending: false });
    if (t_officer) query = query.eq("assigned_officer_id", session.user.id);
    const { data } = await query;
    if (data) setList(data);
    setLoading(false);
  };

  const fetchOfficers = async () => {
    const { data } = await supabase.from("profiles").select("id, name, phone").eq("role", "officer");
    if (data) setOfficers(data);
  };

  const fetchUpvotes = async () => {
    const { data } = await supabase.from("complaint_upvotes").select("complaint_id");
    if (data) {
      const counts = {};
      data.forEach(u => { counts[u.complaint_id] = (counts[u.complaint_id] || 0) + 1; });
      setUpvoteCounts(counts);
    }
  };

  const updateGrievance = async (id, updates) => {
    const { error } = await supabase.from("complaints").update(updates).eq("id", id);
    if (error) notify(error.message, "err");
    else {
      notify(t('change_status') + " ✓");
      fetchData();
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates }));
    }
  };

  // Filtered list (sort by upvotes first)
  const filtered = useMemo(() => {
    return list.filter(it => {
      if (fStatus && it.status !== fStatus) return false;
      if (fCategory && !(it.category || "").includes(fCategory)) return false;
      if (fUrgent && it.priority !== "Urgent") return false;
      if (fSearch) {
        const q = fSearch.toLowerCase();
        if (!(it.title || "").toLowerCase().includes(q) && !(it.ticket_id || "").toLowerCase().includes(q) && !(it.location || "").toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (upvoteCounts[b.id] || 0) - (upvoteCounts[a.id] || 0));
  }, [list, fStatus, fCategory, fSearch, fUrgent, upvoteCounts]);

  const getPhotos = (item) => getComplaintPhotoUrls(item);

  // ── Tab buttons ──
  const tabStyle = (active) => ({
    background: active ? THEME.colors.primary : THEME.colors.background,
    color: active ? THEME.colors.surface : THEME.colors.textMuted,
    border: "none",
    padding: "10px 24px",
    borderRadius: THEME.radius.md,
    fontFamily: THEME.font,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  });

  // ── Select helper for filter dropdowns ──
  const selectStyle = {
    padding: "8px 12px",
    borderRadius: THEME.radius.sm,
    border: `1.5px solid ${THEME.colors.border}`,
    fontFamily: THEME.font,
    fontWeight: 700,
    fontSize: 12,
    background: THEME.colors.surface,
    color: THEME.colors.text,
    outline: "none",
    minWidth: 130,
  };

  return (
    <div>
      {/* Header */}
      <div className="admin-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: THEME.colors.text }}>{t_officer ? t("officer_dashboard") : t("admin_dashboard")}</h2>
        <div className="admin-tabs" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={tabStyle(tab === "complaints")} onClick={() => setTab("complaints")}>📋 {t('tab_complaints')}</button>
          <button style={tabStyle(tab === "analytics")} onClick={() => setTab("analytics")}>📊 {t('tab_analytics')}</button>
          {!t_officer && ['village_admin', 'district_admin', 'super_admin'].includes(profile?.role) && (
            <>
              <button style={tabStyle(tab === "users")} onClick={() => setTab("users")}>👥 {t('tab_users')}</button>
              <button style={tabStyle(tab === "bulk_import")} onClick={() => setTab("bulk_import")}>📁 {t('tab_bulk_import')}</button>
              <button style={tabStyle(tab === "boundaries")} onClick={() => setTab("boundaries")}>🗺️ {t('tab_boundaries')}</button>
              <button style={tabStyle(tab === "admin_reset")} onClick={() => setTab("admin_reset")}>🔑 Reset Password</button>
            </>
          )}
          <Btn variant="ghost" onClick={fetchData} style={{ padding: "10px 14px", fontSize: 13 }}>🔄 {t("refresh")}</Btn>
        </div>
      </div>

      {tab === "users" && !t_officer && ['village_admin', 'district_admin', 'super_admin'].includes(profile?.role) ? (
        <StaffManagementTab t={t} notify={notify} session={session} currentProfile={profile} />
      ) : tab === "bulk_import" && !t_officer && ['village_admin', 'district_admin', 'super_admin'].includes(profile?.role) ? (
        <BulkImportTab t={t} notify={notify} />
      ) : tab === "boundaries" && !t_officer && ['village_admin', 'district_admin', 'super_admin'].includes(profile?.role) ? (
        <BoundariesTab t={t} notify={notify} />
      ) : tab === "admin_reset" && !t_officer && ['village_admin', 'district_admin', 'super_admin'].includes(profile?.role) ? (
        <AdminPasswordResetTab t={t} notify={notify} session={session} />
      ) : tab === "analytics" ? (
        <AnalyticsTab list={list} t={t} />
      ) : (
        <>
          {/* Filter Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20, padding: "14px 18px", background: THEME.colors.surface, borderRadius: THEME.radius.md, border: `1px solid ${THEME.colors.border}`, alignItems: "center" }}>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={selectStyle}>
              <option value="">{t('all_statuses')}</option>
              {STATUS_FLOW.map(s => {
                const sKey = `status_${s.toLowerCase().replace(" ", "_")}`;
                return <option key={s} value={s}>{t(sKey)}</option>;
              })}
            </select>
            <select value={fCategory} onChange={e => setFCategory(e.target.value)} style={selectStyle}>
              <option value="">{t('all_categories')}</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(c.key)}</option>)}
            </select>
            <input
              type="text"
              placeholder={t('filter_search')}
              value={fSearch}
              onChange={e => setFSearch(e.target.value)}
              style={{ ...selectStyle, flex: 1, minWidth: 180 }}
            />
            <button
              onClick={() => setFUrgent(!fUrgent)}
              style={{ padding: "8px 16px", borderRadius: THEME.radius.full, border: fUrgent ? `2px solid ${THEME.colors.danger}` : `1.5px solid ${THEME.colors.border}`, background: fUrgent ? THEME.colors.dangerBg : THEME.colors.surface, color: fUrgent ? THEME.colors.danger : THEME.colors.textMuted, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: THEME.font, transition: "all 0.2s", animation: fUrgent ? "urgentPulse 2s infinite" : "none" }}
            >
              🔥 {t('filter_priority')}
            </button>
            <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 700, marginLeft: 4 }}>{filtered.length} / {list.length}</span>
          </div>

          {/* Content Grid */}
          <div className="admin-content-grid" style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 24, alignItems: "start" }}>
            {/* Complaint List */}
            <div>
              {loading ? <div style={{ padding: 40, textAlign: "center", color: THEME.colors.textMuted, fontWeight: 700 }}>{t("loading")}</div> : filtered.length === 0 ? (
                <div style={{ background: THEME.colors.surface, padding: 50, textAlign: "center", borderRadius: THEME.radius.md, color: THEME.colors.textMuted }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 700 }}>{t("no_complaints")}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filtered.map(it => {
                    const sm = STATUS_META[it.status] || STATUS_META.Open;
                    const isActive = selected?.id === it.id;
                    const photos = getPhotos(it);
                    const votes = upvoteCounts[it.id] || 0;
                    return (
                      <div key={it.id} onClick={() => setSelected(it)}
                           style={{ background: THEME.colors.surface, padding: "16px 18px", borderRadius: THEME.radius.md, borderLeft: `5px solid ${sm.color}`, border: isActive ? `2px solid ${THEME.colors.primary}` : `1px solid ${THEME.colors.border}`, borderLeftWidth: 5, borderLeftStyle: "solid", borderLeftColor: sm.color, cursor: "pointer", transition: "all 0.15s", boxShadow: isActive ? THEME.shadow.md : THEME.shadow.sm, position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>#{(it.ticket_id || it.id.slice(0, 8))} • {it.category}</div>
                          <Badge status={it.status} priority={it.priority} />
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 4px", color: THEME.colors.text }}>{it.title}</h3>
                        <div style={{ fontSize: 12, color: THEME.colors.textMuted }}>📍 {it.location}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: THEME.colors.textMuted }}>{t('created_on')} {new Date(it.created_at).toLocaleDateString()}</span>
                            {votes > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: THEME.colors.danger, background: THEME.colors.dangerBg, padding: "2px 8px", borderRadius: THEME.radius.full }}>🔥 {votes}</span>}
                          </div>
                          {photos.length > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.success, background: THEME.colors.successBg, padding: "2px 8px", borderRadius: THEME.radius.full }}>📷 {photos.length}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detail Panel */}
            {selected && (
              <div className="admin-detail-panel" style={{ background: THEME.colors.surface, padding: 24, borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("complaint_details")}</h3>
                  <button onClick={() => setSelected(null)} style={{ background: THEME.colors.background, border: "none", width: 30, height: 30, borderRadius: THEME.radius.sm, fontSize: 14, cursor: "pointer", fontWeight: 700, color: THEME.colors.textMuted }}>✕</button>
                </div>

                {/* Title & ID */}
                <div style={{ padding: "14px 16px", background: THEME.colors.background, borderRadius: THEME.radius.sm, marginBottom: 16, border: `1px solid ${THEME.colors.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.textMuted, textTransform: "uppercase", marginBottom: 4 }}>
                    #{selected.ticket_id || selected.id.slice(0, 8)}
                    {selected.is_anonymous && <span style={{ marginLeft: 8, background: THEME.colors.textMuted, color: "#fff", padding: "2px 6px", borderRadius: THEME.radius.full, fontSize: 9 }}>🕵️ {t('anonymous_badge') || "Anonymous"}</span>}
                    {selected.related_scheme && <span style={{ marginLeft: 8, background: THEME.colors.primaryLight, color: THEME.colors.primaryHover, padding: "2px 6px", borderRadius: THEME.radius.full, fontSize: 9 }}>🏛 {selected.related_scheme}</span>}
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 8px" }}>{selected.title}</h4>
                  <Badge status={selected.status} priority={selected.priority} />
                  {(upvoteCounts[selected.id] || 0) > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: THEME.colors.danger }}>🔥 {upvoteCounts[selected.id]} {t('community_upvotes')}</div>
                  )}
                </div>

                {/* Description */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.textMuted, textTransform: "uppercase" }}>{t("description")}</label>
                  <p style={{ fontSize: 13, color: THEME.colors.text, marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.description}</p>
                  {selected.is_escalated && (
                    <div style={{ marginTop: 10, padding: 10, background: THEME.colors.dangerBg, border: `1px solid ${STATUS_META.Open.border}`, borderRadius: THEME.radius.sm, color: "#991B1B", fontSize: 11, fontWeight: 700 }}>
                      {t("escalation_warning")}
                    </div>
                  )}
                </div>

                {/* Photo Evidence Viewer */}
                {(() => {
                  const photos = getPhotos(selected);
                  return (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.textMuted, textTransform: "uppercase", display: "block", marginBottom: 8 }}>{t("photo_viewer")} ({photos.length})</label>
                      {photos.length === 0 ? (
                        <div style={{ padding: 16, background: THEME.colors.background, borderRadius: THEME.radius.sm, textAlign: "center", color: THEME.colors.textMuted, fontSize: 12 }}>{t('no_photos')}</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                          {photos.map((p, i) => (
                            <EvidenceThumbnail key={`${p}-${i}`} src={p} index={i} onClick={() => setLightbox({ photos, index: i })} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Management Controls */}
                <div style={{ borderTop: `1.5px solid ${THEME.colors.background}`, paddingTop: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: THEME.colors.text, display: "block", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("management_controls")}</label>

                  {/* Status Update Buttons */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 8, display: "block" }}>{t('change_status')}</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {STATUS_FLOW.map(s => {
                        const m = STATUS_META[s];
                        const isActive = selected.status === s;
                        const sKey = `status_${s.toLowerCase().replace(" ", "_")}`;
                        return (
                          <button key={s}
                            onClick={() => updateGrievance(selected.id, { status: s })}
                            style={{ padding: "6px 14px", borderRadius: THEME.radius.full, border: `2px solid ${m.color}`, background: isActive ? m.color : "transparent", color: isActive ? (s === "Closed" ? "#fff" : (m.bg === m.color ? m.color : "#fff")) : m.color, fontWeight: 800, fontSize: 10, cursor: "pointer", fontFamily: THEME.font, transition: "all 0.2s", letterSpacing: 0.3, opacity: isActive ? 1 : 0.75 }}
                            onMouseOver={e => { if (!isActive) { e.currentTarget.style.background = m.bg; e.currentTarget.style.opacity = '1'; } }}
                            onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.75'; } }}
                          >
                            {m.icon} {t(sKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Priority Toggle */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 8, display: "block" }}>{t('priority_label')}</label>
                    <button
                      onClick={() => updateGrievance(selected.id, { priority: selected.priority === "Urgent" ? null : "Urgent" })}
                      style={{ padding: "8px 20px", borderRadius: THEME.radius.full, border: selected.priority === "Urgent" ? `2px solid ${THEME.colors.danger}` : `1.5px solid ${THEME.colors.border}`, background: selected.priority === "Urgent" ? THEME.colors.danger : THEME.colors.surface, color: selected.priority === "Urgent" ? "#fff" : THEME.colors.textMuted, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: THEME.font, transition: "all 0.2s", animation: selected.priority === "Urgent" ? "urgentPulse 2s infinite" : "none" }}
                    >
                      🔥 {selected.priority === "Urgent" ? t('unmark_urgent') : t('mark_urgent')}
                    </button>
                  </div>

                  {/* Officer Assignment */}
                  {!t_officer && (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 10, fontWeight: 700, color: THEME.colors.textMuted, marginBottom: 6, display: "block" }}>{t('assign_officer')}</label>
                      <select
                        value={selected.assigned_officer_id || ""}
                        onChange={e => updateGrievance(selected.id, { assigned_officer_id: e.target.value || null, status: !e.target.value ? selected.status : (selected.status === "Open" ? "Assigned" : selected.status) })}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: THEME.radius.sm, border: `1.5px solid ${THEME.colors.border}`, fontFamily: THEME.font, fontWeight: 700, fontSize: 13, background: THEME.colors.background }}
                      >
                        <option value="">{t('select_officer')}</option>
                        {officers.map(o => <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Photo Lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
          t={t}
        />
      )}
    </div>
  );
};

const ProfileSetupModal = ({ session, profile, onComplete, notify, t }) => {
  const [name, setName] = useState(profile?.name || session?.user?.user_metadata?.full_name || "");
  const [mobile, setMobile] = useState(profile?.mobile || "");
  const [gender, setGender] = useState(profile?.gender || "male");
  const [dob, setDob] = useState(profile?.dob || "");
  const [age, setAge] = useState(profile?.age || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [loading, setLoading] = useState(false);

  const activePilotToken = localStorage.getItem('pilot_token') || new URLSearchParams(window.location.search).get('pilot_token');
  const isPilotFlow = Boolean(activePilotToken || localStorage.getItem('pilot_role') === 'sarpanch');

  const handleSave = async () => {
    if (!name.trim()) return notify("Please enter your full name", "err");
    if (isPilotFlow && !mobile.trim()) return notify("Please enter your mobile number for pilot verification", "err");

    setLoading(true);
    try {
      const targetId = ensureUUID(session.user.id);
      let claimedSuccess = false;

      // 1. Try claim_pilot_token RPC if a pilot token is active
      if (activePilotToken) {
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc("claim_pilot_token", {
            p_token: activePilotToken,
            p_user_id: targetId,
            p_name: name.trim(),
            p_mobile: mobile.trim(),
            p_gender: gender,
            p_dob: dob || null,
            p_age: age ? parseInt(age, 10) : null,
            p_address: address.trim(),
          });

          if (!rpcErr && rpcRes?.success) {
            claimedSuccess = true;
            localStorage.removeItem('pilot_token');
            localStorage.removeItem('pilot_role');
            notify("🎉 Pilot Onboarding Complete! Welcome to your Sarpanch Portal. ✅");
          }
        } catch (e) {
          console.warn("RPC claim_pilot_token notice:", e);
        }
      }

      // 2. Fallback / direct upsert if not claimed via RPC
      if (!claimedSuccess) {
        const updatePayload = {
          id: targetId,
          name: name.trim(),
          mobile: mobile.trim(),
          gender,
          dob: dob || null,
          age: age ? parseInt(age, 10) : null,
          address: address.trim(),
          is_onboarded: true,
          last_active: new Date().toISOString(),
        };

        if (isPilotFlow) {
          updatePayload.role = 'village_admin';
        }

        const { error } = await supabase.from("profiles").upsert([updatePayload]);
        if (error) throw error;
        
        localStorage.removeItem('pilot_token');
        localStorage.removeItem('pilot_role');
        notify("Profile onboarding complete! ✅");
      }

      onComplete();
    } catch (err) {
      console.error("Onboarding error:", err);
      notify(err.message || "Failed to complete onboarding", "err");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, backdropFilter: "blur(6px)", padding: 16 }}>
      <div style={{ background: THEME.colors.surface, padding: "28px 32px", borderRadius: 24, width: "100%", maxWidth: 460, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: `1px solid ${THEME.colors.border}`, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 36, marginBottom: 12, textAlign: "center" }}>
          {isPilotFlow ? "🏛️" : "👋"}
        </div>
        
        <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 6, color: THEME.colors.text }}>
          {isPilotFlow ? "Sarpanch Portal Onboarding" : (t('profile_setup_title') || "Complete Your Profile")}
        </h2>
        
        <p style={{ color: THEME.colors.textMuted, textAlign: "center", marginBottom: 20, fontSize: 13, lineHeight: 1.5 }}>
          {isPilotFlow 
            ? "Welcome! Please verify your official contact details to activate your Village Admin (Sarpanch) account." 
            : "Please confirm your basic details to get started with GramSeva."}
        </p>

        {isPilotFlow && (
          <div style={{ background: "#F0FDF4", border: "1px solid #DCFCE7", borderRadius: 12, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: "#166534", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <span>✅</span>
            <span>Role Granted: <strong>Village Admin (Sarpanch)</strong></span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input 
            label="Full Name *" 
            placeholder="e.g. Rajesh Kumar" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            autoFocus
          />

          <Input 
            label="Mobile Number *" 
            placeholder="e.g. 9876543210" 
            value={mobile} 
            onChange={e => setMobile(e.target.value)} 
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, marginBottom: 4 }}>Gender</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 13, outline: "none", background: THEME.colors.background, color: THEME.colors.text }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <Input 
              label="Age" 
              type="number"
              placeholder="e.g. 42" 
              value={age} 
              onChange={e => setAge(e.target.value)} 
            />
          </div>

          <Input 
            label="Date of Birth" 
            type="date"
            value={dob} 
            onChange={e => setDob(e.target.value)} 
          />

          <Input 
            label="Address / Panchayat Details" 
            placeholder="e.g. Main Street, Gram Panchayat House" 
            value={address} 
            onChange={e => setAddress(e.target.value)} 
          />

          <Btn full onClick={handleSave} disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Activating Account..." : (isPilotFlow ? "Activate Sarpanch Account 🚀" : "Complete Setup")}
          </Btn>
        </div>
      </div>
    </div>
  );
};

// ─── Admin Password Reset Tab ─────────────────────────────────────────────────

const AdminPasswordResetTab = ({ t, notify, session }) => {
  const [userId, setUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const getPasswordStrength = (pw) => {
    if (!pw) return { label: "", color: "transparent", width: "0%" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "#ef4444", width: "20%" };
    if (score <= 2) return { label: "Fair", color: "#f59e0b", width: "40%" };
    if (score <= 3) return { label: "Good", color: "#3b82f6", width: "60%" };
    if (score <= 4) return { label: "Strong", color: "#22c55e", width: "80%" };
    return { label: "Very Strong", color: "#059669", width: "100%" };
  };

  const strength = getPasswordStrength(newPassword);

  const isValidUUID = UUID_REGEX.test(userId.trim());
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isLongEnough = newPassword.length >= 8;
  const canSubmit = isValidUUID && isLongEnough && hasUpper && hasLower && hasNumber && hasSpecial && !loading;

  const handleReset = async (e) => {
    e.preventDefault();
    setResult(null);

    if (!isValidUUID) {
      setResult({ type: "error", text: "Invalid User ID format. Must be a valid UUID." });
      return;
    }
    if (!isLongEnough || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setResult({ type: "error", text: "Password does not meet strength requirements." });
      return;
    }

    setLoading(true);
    try {
      const token = session?.access_token;
      if (!token) {
        setResult({ type: "error", text: "No active session. Please log in again." });
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin-reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: userId.trim(),
          newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: "success",
          text: `✅ Password updated for user ${data.user?.email || data.user?.id || userId}`,
        });
        notify("Password reset successful! ✅");
        setNewPassword("");
        setUserId("");
      } else {
        setResult({ type: "error", text: data.error || "Failed to reset password." });
        notify(data.error || "Failed to reset password.", "err");
      }
    } catch (err) {
      const msg = err?.message || "Network error. Please try again.";
      setResult({ type: "error", text: msg });
      notify(msg, "err");
    }
    setLoading(false);
  };

  const checkStyle = (pass) => ({
    fontSize: 12,
    fontWeight: 600,
    color: pass ? "#22c55e" : "#9ca3af",
    display: "flex",
    alignItems: "center",
    gap: 4,
  });

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}`, padding: 28, boxShadow: THEME.shadow.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🔑</span>
          <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: THEME.font, color: THEME.colors.text }}>Admin Password Reset</h3>
        </div>
        <p style={{ color: THEME.colors.textMuted, fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
          Reset a user's password using their User ID (UUID). This action is logged and requires admin privileges.
        </p>

        {/* Security notice */}
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#92400E", lineHeight: 1.6, fontWeight: 600 }}>
          ⚠️ This bypasses the user's normal password reset flow. Use only when the user cannot reset their own password via email.
        </div>

        {result && (
          <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.5, background: result.type === "error" ? "#fef2f2" : "#ecfdf5", color: result.type === "error" ? "#b91c1c" : "#047857", border: `1px solid ${result.type === "error" ? "#fecaca" : "#a7f3d0"}` }}>
            {result.text}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, marginBottom: 6 }}>User ID (UUID)</label>
            <input
              type="text"
              placeholder="e.g. 5be68c5b-bf17-4063-a3ac-7c095833ef70"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${userId.length > 0 && !isValidUUID ? "#fca5a5" : THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 13, fontFamily: "monospace", outline: "none", boxSizing: "border-box", background: THEME.colors.background, color: THEME.colors.text, transition: "border-color 0.2s" }}
            />
            {userId.length > 0 && !isValidUUID && (
              <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, marginTop: 4, display: "block" }}>⚠ Invalid UUID format</span>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, marginBottom: 6 }}>New Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters, mixed case, number, special char"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: "100%", padding: "12px 48px 12px 14px", border: `1.5px solid ${THEME.colors.border}`, borderRadius: THEME.radius.sm, fontSize: 14, outline: "none", boxSizing: "border-box", background: THEME.colors.background, color: THEME.colors.text, transition: "border-color 0.2s" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 6,
                  cursor: "pointer",
                  padding: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  transition: "all 0.2s ease",
                  color: THEME.colors.textMuted,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.borderColor = THEME.colors.border;
                  e.currentTarget.style.color = THEME.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.color = THEME.colors.textMuted;
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: strength.width, background: strength.color, borderRadius: 2, transition: "all 0.3s ease" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: strength.color, marginTop: 4, display: "block" }}>{strength.label}</span>
              </div>
            )}

            {/* Password requirements checklist */}
            {newPassword.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                <span style={checkStyle(isLongEnough)}>{isLongEnough ? "✓" : "○"} 8+ characters</span>
                <span style={checkStyle(hasUpper)}>{hasUpper ? "✓" : "○"} Uppercase</span>
                <span style={checkStyle(hasLower)}>{hasLower ? "✓" : "○"} Lowercase</span>
                <span style={checkStyle(hasNumber)}>{hasNumber ? "✓" : "○"} Number</span>
                <span style={checkStyle(hasSpecial)}>{hasSpecial ? "✓" : "○"} Special char</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: THEME.radius.sm,
              background: canSubmit ? "#111827" : "#9ca3af",
              color: "white",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: THEME.font,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.6,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? "Resetting..." : "🔑 Reset User Password"}
          </button>
        </form>
      </div>

      {/* API documentation card */}
      <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}`, padding: 24, marginTop: 16, boxShadow: THEME.shadow.sm }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: THEME.colors.text, fontFamily: THEME.font }}>📡 API Endpoint</h4>
        <code style={{ display: "block", padding: "10px 14px", borderRadius: 8, background: THEME.colors.background, fontSize: 12, fontFamily: "monospace", color: THEME.colors.textMuted, wordBreak: "break-all", lineHeight: 1.6 }}>
          POST /api/admin-reset-password<br />
          Authorization: Bearer {'<'}your-jwt-token{'>'}<br />
          Body: {'{'} "userId": "uuid", "newPassword": "..." {'}'}
        </code>
      </div>
    </div>
  );
};

import { SignInPage } from "./components/ui/sign-in";
import { auth as firebaseAuth, googleProvider, signInWithPopup } from "./firebase";

const LoginModal = ({ onLogin, onClose, notify, t, initialMode }) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [isForgot, setIsForgot] = useState(initialMode === 'forgot');
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setAuthMessage(null);
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result.user;
      const email = user.email;
      const displayName = user.displayName || (email ? email.split('@')[0] : "User");

      let sessionData = null;
      try {
        const res = await supabase.auth.signInWithPassword({
          email,
          password: `GAuth_${user.uid.slice(0, 12)}`,
        });
        if (res.data?.session) sessionData = res.data.session;
      } catch (e) { /* ignore */ }

      if (!sessionData) {
        try {
          const signUpRes = await supabase.auth.signUp({
            email,
            password: `GAuth_${user.uid.slice(0, 12)}`,
            options: { data: { full_name: displayName } }
          });
          if (signUpRes.data?.session) sessionData = signUpRes.data.session;
        } catch (e) { /* ignore */ }
      }

      const activeRawId = sessionData?.user?.id || user.uid;
      const activeUserId = ensureUUID(activeRawId);
      const activeUser = sessionData?.user
        ? { ...sessionData.user, id: activeUserId }
        : { id: activeUserId, email, app_metadata: { provider: 'google' } };

      const { data: existingProf } = await supabase.from("profiles").select("*").eq("id", activeUserId).maybeSingle();
      if (!existingProf) {
        await supabase.from("profiles").insert([{
          id: activeUserId,
          name: displayName,
          role: 'citizen',
        }]);
      } else if (!existingProf.name) {
        await supabase.from("profiles").update({ name: displayName }).eq("id", activeUserId);
      }

      const finalSession = sessionData
        ? { ...sessionData, user: activeUser }
        : { user: activeUser };

      onLogin(finalSession);
      notify(`Signed in with Google as ${displayName} ✅`);
    } catch (err) {
      console.error("Google auth error:", err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        try {
          const { error: oauthErr } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
          });
          if (oauthErr) throw oauthErr;
          return;
        } catch (e) {
          const msg = "Firebase domain restriction: Please add 'villagegrievencesystem-2uvj.vercel.app' under Firebase Console -> Authentication -> Settings -> Authorized Domains.";
          setAuthMessage({ type: "error", text: msg });
          notify("Domain unauthorized in Firebase Console", "err");
        }
      } else {
        const msg = err?.message || "Google Sign-In failed.";
        setAuthMessage({ type: "error", text: msg });
        notify(msg, "err");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = formData.get("password");

    if (!email || !password) return notify(t('auth_fill_fields'), "err");
    
    setLoading(true);
    try {
      let data, error;
      if (isSignUp) {
        ({ data, error } = await supabase.auth.signUp({ email, password }));
        if (error) throw error;
        setAuthMessage({ type: "success", text: t('signup_success') });
        setIsSignUp(false);
      } else {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
        if (error) throw error;
        if (data.session) onLogin(data.session);
      }
    } catch (err) {
      const message = err?.message || "";
      const normalizedMessage = message.toLowerCase();
      const displayMessage = normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("networkerror")
          ? "Unable to reach the authentication service. Please check the deployed Supabase environment variables and try again."
          : normalizedMessage.includes("email rate limit exceeded")
          ? t('auth_email_rate_limit')
          : !isSignUp && normalizedMessage.includes("email not confirmed")
          ? t('auth_email_confirm_required')
          : !isSignUp && normalizedMessage.includes("invalid login credentials")
            ? t('account_not_found_help')
            : message;
      setAuthMessage({ type: "error", text: displayMessage });
      notify(displayMessage, "err");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthMessage(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") || "").trim().toLowerCase();

    if (!email) return notify("Please enter your email address.", "err");

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    setLoading(true);
    try {
      // Redirect to /reset-password — the app detects recovery session and shows the reset form
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      // Always show the same message regardless of whether email exists (security best practice)
      setAuthMessage({ type: "success", text: "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder." });
    } catch (err) {
      const msg = err?.message || "";
      const normalized = msg.toLowerCase();
      // Rate limit or network errors should be surfaced; other errors get the generic message
      if (normalized.includes("rate limit") || normalized.includes("too many")) {
        setAuthMessage({ type: "error", text: "Too many requests. Please wait a few minutes before trying again." });
      } else if (normalized.includes("failed to fetch") || normalized.includes("networkerror")) {
        setAuthMessage({ type: "error", text: "Network error. Please check your connection and try again." });
      } else {
        // For security, show the same success message even on error (email not found, etc.)
        setAuthMessage({ type: "success", text: "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder." });
      }
    }
    setLoading(false);
  };

  // Forgot password view
  if (isForgot) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "white" }}>
        <div className="min-h-[100dvh] flex items-center justify-center px-5 py-16 font-sans bg-white text-gray-900">
          <div className="w-full max-w-md">
            <div className="flex flex-col gap-6">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36 }}>🔒</span>
                <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">{t('forgot_password_title')}</h1>
              </div>
              <p className="text-gray-500">{t('forgot_password_desc')}</p>
              {authMessage && (
                <div role="status" className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${authMessage.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                  {authMessage.text}
                </div>
              )}
              <form className="space-y-5" onSubmit={handleForgotPassword}>
                <div>
                  <label className="text-sm font-medium text-gray-500">{t('email_label')}</label>
                  <div className="rounded-2xl border border-gray-200 bg-black/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
                    <input name="email" type="email" placeholder={t('email_placeholder')} className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none text-gray-900" required autoFocus />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full min-h-14 rounded-2xl bg-gray-900 px-4 py-4 font-medium text-white hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? t('sending') : t('send_reset_link')}
                </button>
              </form>
              <p className="text-center text-sm leading-6 text-gray-500 mt-2">
                {t('remember_password')}{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setIsForgot(false); setAuthMessage(null); }} className="text-violet-600 font-medium hover:underline transition-colors">
                  {t('back_to_login')}
                </a>
              </p>
            </div>
          </div>
        </div>
        <button className="login-modal-close" onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 24, right: 24, zIndex: 1010, background: "rgba(0,0,0,0.5)", color: "white", width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 20 }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "white" }}>
      <SignInPage 
        title={isSignUp ? t('sign_up') : t('login')}
        description={isSignUp ? t('create_account') : t('login_to_account')}
        heroImageSrc="/images/login-abstract-background.jpg"
        onSignIn={handleAuth}
        onGoogleSignIn={handleGoogleAuth}
        onSwitchMode={() => { setIsSignUp(prev => !prev); setAuthMessage(null); }}
        onForgotPassword={() => { setIsForgot(true); setAuthMessage(null); }}
        isSignUp={isSignUp}
        loading={loading}
        message={authMessage?.text}
        messageType={authMessage?.type}
        submitLabel={isSignUp ? t('sign_up') : t('login')}
        switchPrompt={isSignUp ? t('auth_existing_prompt') : t('auth_new_prompt')}
        switchLabel={isSignUp ? t('login') : t('sign_up')}
        t={t}
      />
      <button className="login-modal-close" onClick={onClose} aria-label="Close login" style={{ position: "absolute", top: 24, right: 24, zIndex: 1010, background: "rgba(0,0,0,0.5)", color: "white", width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 20 }}>✕</button>
    </div>
  );
};

// ─── Reset Password Modal (shown after user clicks email reset link) ──────────
// BUG FIX: Uses createPortal to render outside Shell's stacking context,
// stopPropagation on the card to prevent Shell's handleClickOutside from stealing focus,
// and explicit pointer-events management to ensure inputs are interactive.

const ResetPasswordModal = ({ onComplete, notify, t }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);
  const [success, setSuccess] = useState(false);
  const formRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Auto-focus the first password input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Password validation checks
  const checks = {
    length: newPassword.length >= 8,
    match: confirmPassword.length > 0 ? newPassword === confirmPassword : true,
  };
  const allValid = checks.length && newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = allValid && !loading;

  const getPasswordStrength = (pw) => {
    if (!pw) return { label: "", color: "transparent", width: "0%", score: 0 };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { label: "Weak", color: "#ef4444", width: "20%", score };
    if (score <= 2) return { label: "Fair", color: "#f59e0b", width: "40%", score };
    if (score <= 3) return { label: "Good", color: "#3b82f6", width: "60%", score };
    if (score <= 4) return { label: "Strong", color: "#22c55e", width: "80%", score };
    return { label: "Very Strong", color: "#059669", width: "100%", score };
  };

  const strength = getPasswordStrength(newPassword);

  const handleReset = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMessage(null);

    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword || !trimmedConfirm) {
      setMessage({ type: "error", text: "Please fill in both password fields." });
      return;
    }
    if (trimmedPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });
      if (error) throw error;

      setSuccess(true);
      notify("Password updated successfully! ✅");

      // Sign user out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        onComplete("Password changed successfully. Please login using your new password.");
      }, 2000);
    } catch (err) {
      const msg = err?.message || "";
      const normalized = msg.toLowerCase();
      if (normalized.includes("session") || normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("not authorized") || normalized.includes("refresh_token")) {
        setLinkExpired(true);
        setMessage({ type: "error", text: "This password reset link has expired or is invalid. Please request a new one." });
      } else if (normalized.includes("weak") || normalized.includes("short")) {
        setMessage({ type: "error", text: "Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols." });
      } else {
        setMessage({ type: "error", text: msg || "Failed to update password. Please try again." });
      }
      notify(msg || "Failed to update password.", "err");
    }
    setLoading(false);
  };

  // ─── Shared modal styles ────────────────────────────────────────────────────
  const backdropStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0, 0, 0, 0.65)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    pointerEvents: "auto",
  };

  const cardStyle = {
    background: "white",
    borderRadius: 24,
    padding: "36px 32px",
    maxWidth: 480,
    width: "100%",
    boxShadow: "0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)",
    position: "relative",
    pointerEvents: "auto",
    animation: "resetCardIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
  };

  const inputContainerStyle = {
    position: "relative",
    marginBottom: 20,
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 8,
    fontFamily: THEME.font,
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 48px 14px 16px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 14,
    fontSize: 15,
    fontFamily: THEME.font,
    outline: "none",
    boxSizing: "border-box",
    background: "#f9fafb",
    color: "#111827",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
    WebkitAppearance: "none",
    appearance: "none",
  };

  const inputFocusProps = {
    onFocus: (e) => {
      e.target.style.borderColor = "#818cf8";
      e.target.style.boxShadow = "0 0 0 3px rgba(129, 140, 248, 0.15)";
      e.target.style.background = "#fff";
    },
    onBlur: (e) => {
      e.target.style.borderColor = "#e5e7eb";
      e.target.style.boxShadow = "none";
      e.target.style.background = "#f9fafb";
    },
  };

  const toggleBtnStyle = {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
    borderRadius: 8,
    color: "#9ca3af",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s, background 0.2s",
    zIndex: 2,
  };

  // Stop propagation on the card so Shell's handleClickOutside doesn't steal focus
  const stopBubble = (e) => { e.stopPropagation(); };

  // ─── Success state ──────────────────────────────────────────────────────────
  if (success) {
    const successContent = (
      <div style={backdropStyle} onMouseDown={stopBubble} onClick={stopBubble}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 32px" }} onMouseDown={stopBubble}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", animation: "resetCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", fontFamily: THEME.font, color: "#111827" }}>Password Changed!</h2>
          <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 4px", lineHeight: 1.6 }}>Your password has been updated successfully.</p>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Redirecting to login...</p>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 32, height: 4, borderRadius: 2, background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", background: "#10b981", borderRadius: 2, animation: "resetProgress 2s linear forwards" }} />
            </div>
          </div>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(successContent, document.body) : successContent;
  }

  // ─── Expired link state ─────────────────────────────────────────────────────
  if (linkExpired) {
    const expiredContent = (
      <div style={backdropStyle} onMouseDown={stopBubble} onClick={stopBubble}>
        <div style={{ ...cardStyle, textAlign: "center", padding: "40px 32px" }} onMouseDown={stopBubble}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", fontFamily: THEME.font, color: "#111827" }}>Link Expired</h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            This password reset link has expired or is invalid.<br />Please request a new one.
          </p>
          <button
            onClick={() => {
              window.history.replaceState({}, document.title, '/forgot-password');
              onComplete('forgot');
            }}
            style={{ width: "100%", padding: "15px 20px", borderRadius: 14, background: "#111827", color: "white", border: "none", fontSize: 15, fontWeight: 700, fontFamily: THEME.font, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            Request New Reset Link
          </button>
        </div>
      </div>
    );
    return typeof document !== 'undefined' ? createPortal(expiredContent, document.body) : expiredContent;
  }

  // ─── Main reset form ────────────────────────────────────────────────────────
  const formContent = (
    <div style={backdropStyle} onMouseDown={stopBubble} onClick={stopBubble}>
      <div
        style={cardStyle}
        onMouseDown={stopBubble}
        onClick={stopBubble}
        role="dialog"
        aria-modal="true"
        aria-label="Reset Password"
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #6366f1, #818cf8)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(99, 102, 241, 0.25)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", fontFamily: THEME.font, color: "#111827", letterSpacing: "-0.02em" }}>Create New Password</h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            Enter your new password below.<br />Must be at least 8 characters.
          </p>
        </div>

        {/* Error/Success message */}
        {message && (
          <div style={{
            marginBottom: 18,
            padding: "14px 16px",
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.5,
            background: message.type === "error" ? "#fef2f2" : "#ecfdf5",
            color: message.type === "error" ? "#b91c1c" : "#047857",
            border: `1px solid ${message.type === "error" ? "#fecaca" : "#a7f3d0"}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: -1 }}>{message.type === "error" ? "⚠️" : "✅"}</span>
            <span>{message.text}</span>
          </div>
        )}

        <form ref={formRef} onSubmit={handleReset} onMouseDown={stopBubble}>
          {/* New Password */}
          <div style={inputContainerStyle}>
            <label htmlFor="reset-new-password" style={labelStyle}>New Password</label>
            <div style={{ position: "relative" }}>
              <input
                ref={passwordInputRef}
                id="reset-new-password"
                name="newPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                style={inputStyle}
                {...inputFocusProps}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowPassword(!showPassword); }}
                onMouseDown={(e) => e.stopPropagation()}
                style={toggleBtnStyle}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
                onMouseOver={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.background = "none"; }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* Password strength meter */}
            {newPassword.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 4, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: strength.width, background: strength.color, borderRadius: 4, transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: strength.color }}>{strength.label}</span>
                  <span style={{ fontSize: 11, color: checks.length ? "#22c55e" : "#9ca3af", fontWeight: 600 }}>
                    {checks.length ? "✓" : "○"} 8+ characters
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={inputContainerStyle}>
            <label htmlFor="reset-confirm-password" style={labelStyle}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword.length > 0 && !checks.match ? "#fca5a5" : "#e5e7eb",
                }}
                onFocus={(e) => {
                  const borderColor = confirmPassword.length > 0 && !checks.match ? "#f87171" : "#818cf8";
                  e.target.style.borderColor = borderColor;
                  e.target.style.boxShadow = confirmPassword.length > 0 && !checks.match
                    ? "0 0 0 3px rgba(248, 113, 113, 0.15)"
                    : "0 0 0 3px rgba(129, 140, 248, 0.15)";
                  e.target.style.background = "#fff";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = confirmPassword.length > 0 && !checks.match ? "#fca5a5" : "#e5e7eb";
                  e.target.style.boxShadow = "none";
                  e.target.style.background = "#f9fafb";
                }}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowConfirm(!showConfirm); }}
                onMouseDown={(e) => e.stopPropagation()}
                style={toggleBtnStyle}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                tabIndex={-1}
                onMouseOver={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseOut={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.background = "none"; }}
              >
                {showConfirm ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* Match indicator */}
            {confirmPassword.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: checks.match ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                {checks.match ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Passwords match</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Passwords do not match</>
                )}
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!canSubmit}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              padding: "16px 20px",
              borderRadius: 14,
              background: canSubmit ? "linear-gradient(135deg, #111827, #1f2937)" : "#d1d5db",
              color: "white",
              border: "none",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: THEME.font,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginTop: 4,
              boxShadow: canSubmit ? "0 4px 14px rgba(0,0,0,0.15)" : "none",
            }}
            onMouseOver={(e) => { if (canSubmit) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}}
            onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = canSubmit ? "0 4px 14px rgba(0,0,0,0.15)" : "none"; }}
          >
            {loading ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Saving...
              </>
            ) : (
              "Save Password"
            )}
          </button>
        </form>
      </div>
    </div>
  );

  // Portal to document.body to escape Shell's stacking context
  return typeof document !== 'undefined' ? createPortal(formContent, document.body) : formContent;
};

// ─── Main App ─────────────────────────────────────────────────────────────────


// ─── Invitation Onboarding Accept View ─────────────────────────────────────────

const InvitationAcceptView = ({ t, notify, navigate, session, profile, token, onAccept, setShowLogin, setInitialLoginMode }) => {
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Helper to check if user has already accepted or is member of a village
  useEffect(() => {
    // If user is logged in and already has a village, redirect directly to account dashboard
    if (session && profile?.village_id) {
      console.log("[Invite] User already associated with a village. Redirecting to account...");
      navigate("home");
    }
  }, [session, profile, navigate]);

  useEffect(() => {
    if (token) {
      lookupInvite();
    } else {
      setError("No invitation token provided.");
      setLoading(false);
    }
  }, [token]);

  // Auto-login or auto-accept trigger based on lookup results and auth state
  useEffect(() => {
    if (loading || !inviteInfo) return;

    if (!session) {
      // If user not logged in, automatically open login page for them immediately
      console.log("[Invite] User not logged in. Auto-opening login page...");
      setInitialLoginMode("login");
      setShowLogin(true);
    } else if (profile && !profile.village_id) {
      // If user is logged in but doesn't have a village assigned, auto-accept invitation
      console.log("[Invite] User logged in but has no village. Auto-accepting invite...");
      handleAccept();
    }
  }, [loading, inviteInfo, session, profile]);

  const lookupInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("lookup_invitation", { p_token: token });
      if (rpcError) throw rpcError;
      
      if (data && data.valid) {
        setInviteInfo(data);
      } else {
        setError(data?.error || "This invitation link is invalid or expired.");
      }
    } catch (err) {
      setError(err?.message || "Error verifying invitation.");
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    if (accepting || success) return;
    setAccepting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("accept_invitation", { p_token: token });
      if (rpcError) throw rpcError;
      
      if (data && data.success) {
        setSuccess(true);
        notify(`Welcome to ${data.village_name}! ✓`);
        // Clean URL to root
        window.history.replaceState({}, document.title, "/");
        // Trigger profile update and navigation
        setTimeout(() => {
          onAccept();
        }, 2000);
      } else {
        setError(data?.error || "Failed to accept invitation.");
        notify(data?.error || "Failed to accept invitation.", "err");
      }
    } catch (err) {
      setError(err?.message || "Error accepting invitation.");
      notify(err?.message || "Error accepting invitation.", "err");
    }
    setAccepting(false);
  };

  const containerStyle = {
    minHeight: "70vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    background: THEME.colors.background,
    fontFamily: THEME.font,
  };

  const cardStyle = {
    background: THEME.colors.surface,
    borderRadius: 24,
    padding: "40px 32px",
    maxWidth: 480,
    width: "100%",
    boxShadow: THEME.shadow.md,
    border: `1px solid ${THEME.colors.border}`,
    textAlign: "center",
  };

  const roleText = inviteInfo?.role === "village_admin" 
    ? "Village Admin (Sarpanch/Clerk)" 
    : inviteInfo?.role === "officer" 
    ? "Officer (Grievance Resolver)" 
    : "Citizen Member";

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ display: "inline-block", width: 40, height: 40, border: `3.5px solid ${THEME.colors.border}`, borderTopColor: THEME.colors.primary, borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: THEME.colors.text }}>Verifying Onboarding Link</h3>
          <p style={{ color: THEME.colors.textMuted, fontSize: 13, marginTop: 6 }}>Checking security token validity...</p>
        </div>
      </div>
    );
  }

  if (error || !inviteInfo) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>⚠️</div>
          <h3 style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px", color: THEME.colors.text }}>Link Expired or Invalid</h3>
          <p style={{ color: THEME.colors.textMuted, fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
            {error || "This invitation has expired, been revoked, or is incorrect."}
          </p>
          <Btn onClick={() => navigate("home")} style={{ width: "100%", padding: "12px 20px" }}>Go to Homepage</Btn>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>🎉</div>
          <h3 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px", color: THEME.colors.text }}>Welcome Onboard!</h3>
          <p style={{ color: THEME.colors.textMuted, fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
            You have successfully joined <strong>{inviteInfo.village_name}</strong> as a <strong>{roleText}</strong>.
          </p>
          <p style={{ color: THEME.colors.primary, fontSize: 13, fontWeight: 700 }}>Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #3b82f6, #60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 20px rgba(59, 130, 246, 0.2)" }}>
          <span style={{ fontSize: 30 }}>✉️</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px", color: THEME.colors.text }}>Village Invitation</h2>
        <p style={{ color: THEME.colors.textMuted, fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          You have been invited to join <strong>{inviteInfo.village_name}</strong> ({inviteInfo.district}) as a <strong style={{ color: THEME.colors.primary }}>{roleText}</strong>.
        </p>

        {session ? (
          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #111827, #1f2937)",
              color: "white",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: accepting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {accepting ? "Joining Village..." : `Accept & Join ${inviteInfo.village_name}`}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: 12, fontSize: 12, color: "#1e3a8a", lineHeight: 1.5, fontWeight: 600, textAlign: "left", marginBottom: 8 }}>
              💡 An account is required to join. Please sign up or log in first. The invitation will be applied automatically after authenticating.
            </div>
            <button
              onClick={() => {
                setInitialLoginMode("signup");
                setShowLogin(true);
              }}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: THEME.colors.primary,
                color: "white",
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📝 Register & Join
            </button>
            <button
              onClick={() => {
                setInitialLoginMode("login");
                setShowLogin(true);
              }}
              style={{
                padding: "12px 20px",
                borderRadius: 12,
                background: "transparent",
                color: THEME.colors.text,
                border: `1.5px solid ${THEME.colors.border}`,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              🔑 Log In to Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [view, setView] = useState("home");
  const [role, setRole] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [initialLoginMode, setInitialLoginMode] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);

  // ─── URL path-based routing for auth pages & pilot links ───────────────────
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const pilotToken = params.get('pilot_token');
    const roleParam = params.get('role');

    if (path.startsWith('/pilot/')) {
      const token = path.split('/pilot/')[1];
      if (token) {
        localStorage.setItem('pilot_token', token);
        localStorage.setItem('pilot_role', 'sarpanch');
        setShowLogin(true);
        setInitialLoginMode('login');
      }
    } else if (pilotToken || roleParam === 'sarpanch') {
      localStorage.setItem('pilot_role', 'sarpanch');
      if (pilotToken) localStorage.setItem('pilot_token', pilotToken);
      setShowLogin(true);
      setInitialLoginMode('login');
    } else if (path === '/forgot-password') {
      setShowLogin(true);
      setInitialLoginMode('forgot');
    } else if (path === '/login') {
      setShowLogin(true);
    } else if (path.startsWith('/invite/')) {
      const token = path.split('/invite/')[1];
      setInviteToken(token);
      setView("invite");
    }
  }, []);

  const notify = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  
  const navigate = (v) => { setView(v); };

  if (supabaseConfigError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: THEME.colors.background, color: THEME.colors.text, fontFamily: THEME.font }}>
        <div style={{ maxWidth: 560, width: "100%", background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.lg, padding: 28, boxShadow: THEME.shadow.md }}>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900 }}>Supabase configuration missing</h1>
          <p style={{ margin: "0 0 16px", color: THEME.colors.textMuted, lineHeight: 1.6 }}>{supabaseConfigError}</p>
          <div style={{ padding: 14, borderRadius: THEME.radius.sm, background: THEME.colors.background, color: THEME.colors.text, fontSize: 13, fontWeight: 700 }}>
            Add these in Vercel Project Settings - Environment Variables, then redeploy:
            <div style={{ marginTop: 8, fontFamily: "monospace" }}>VITE_SUPABASE_URL</div>
            <div style={{ fontFamily: "monospace" }}>VITE_SUPABASE_ANON_KEY</div>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // ─── Detect Supabase recovery hash fragments on page load ──────────────
    // When users click the password reset link from email, Supabase redirects
    // back with tokens in the URL hash: #access_token=...&type=recovery
    // We need to detect this BEFORE calling getSession to ensure the recovery
    // session is properly established.
    const detectRecoveryFromHash = () => {
      try {
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
          // The hash contains a recovery token — Supabase JS client will
          // automatically parse it. We just need to flag it so we show
          // the reset form once onAuthStateChange fires.
          console.log('[Auth] Recovery hash detected in URL');
          return true;
        }
        // Also check for recovery in URL search params (some Supabase versions)
        const params = new URLSearchParams(window.location.search);
        if (params.get('type') === 'recovery') {
          console.log('[Auth] Recovery param detected in URL');
          return true;
        }
      } catch (e) {
        console.error('[Auth] Error detecting recovery hash:', e);
      }
      return false;
    };

    const hasRecoveryHash = detectRecoveryFromHash();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        session.user.id = ensureUUID(session.user.id);
      }
      setSession(session);
      if (hasRecoveryHash && session) {
        // Recovery session detected from hash — show the reset form
        console.log('[Auth] Recovery session established from hash, showing reset form');
        setShowResetPassword(true);
      } else if (session) {
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange:', event);
      if (session?.user?.id) {
        session.user.id = ensureUUID(session.user.id);
      }
      setSession(session);
      if (event === "PASSWORD_RECOVERY") {
        // Supabase detected the recovery session — show reset password form
        setShowResetPassword(true);
        // Close login modal if open
        setShowLogin(false);
      } else if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setRole(null);
        setShowProfileSetup(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── Offline queue auto-sync ──────────────────────────────────────────────
  useEffect(() => {
    const syncOfflineQueue = async () => {
      if (!session) return;
      if (!navigator.onLine) return;
      const queue = getOfflineQueue();
      if (queue.length === 0) return;

      let syncedIds = [];
      let lastError = null;

      for (const complaint of queue) {
        const { _offlineId, ...data } = complaint;
        // Make sure citizen_id matches the current authenticated session user
        data.citizen_id = session.user.id;
        
        const { error } = await supabase.from("complaints").insert([data]);
        if (!error) {
          syncedIds.push(_offlineId);
        } else {
          lastError = error;
          console.error("Offline sync error details:", error);
        }
      }

      if (syncedIds.length > 0) {
        // Remove only successfully synced items from localStorage
        const updatedQueue = queue.filter(item => !syncedIds.includes(item._offlineId));
        localStorage.setItem(OFFLINE_KEY, JSON.stringify(updatedQueue));
        
        // Notify components to update reactive drafts
        window.dispatchEvent(new Event("offline-queue-updated"));
        window.dispatchEvent(new Event("offline-queue-synced"));
        
        notify(`✅ ${syncedIds.length} offline draft(s) synced successfully!`);
      }

      if (lastError) {
        notify(`⚠️ Sync failed for some drafts: ${lastError.message || "Unknown error"}`, "err");
      }
    };

    syncOfflineQueue();
    window.addEventListener('online', syncOfflineQueue);
    window.addEventListener('manual-sync-trigger', syncOfflineQueue);
    return () => {
      window.removeEventListener('online', syncOfflineQueue);
      window.removeEventListener('manual-sync-trigger', syncOfflineQueue);
    };
  }, [session]);

  // ─── Request push notification permission on login ────────────────────────
  useEffect(() => {
    if (session && "Notification" in window && Notification.permission === "default") {
      // Soft-ask after a delay without error toasts
      const timer = setTimeout(() => {
        try {
          Notification.requestPermission();
        } catch (e) { /* ignore */ }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session]);

  const fetchProfile = async (id) => {
    try {
      const targetId = ensureUUID(id);
      if (!targetId) return;

      // Check for pilot token or role parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const pilotToken = urlParams.get("pilot_token");
      const roleParam = urlParams.get("role");
      let isPilotAdmin = Boolean(pilotToken || roleParam === 'sarpanch');

      if (pilotToken) {
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(pilotToken)));
          if (decoded && (decoded.role === 'sarpanch' || decoded.role === 'admin')) {
            isPilotAdmin = true;
          }
        } catch (e) { /* ignore */ }
      }

      let { data, error } = await supabase.from("profiles").select("*").eq("id", targetId).single();
      
      if (error && error.code === 'PGRST116') {
        const initialRole = isPilotAdmin ? 'village_admin' : 'citizen';
        try {
          const { data: newProfile, error: insertError } = await supabase
            .from("profiles")
            .insert([{ id: targetId, role: initialRole }])
            .select()
            .single();
            
          if (insertError) {
            console.warn("Profile insert notice:", insertError.message);
            const fallbackProfile = { id: targetId, role: initialRole, name: "" };
            setProfile(fallbackProfile);
            setRole(initialRole);
            if (isPilotAdmin) navigate("profile");
            return;
          }
          
          setProfile(newProfile);
          setRole(newProfile.role);
          setShowProfileSetup(true);
          if (isPilotAdmin) navigate("profile");
          return;
        } catch (e) {
          const fallbackProfile = { id: targetId, role: initialRole, name: "" };
          setProfile(fallbackProfile);
          setRole(initialRole);
          return;
        }
      } else if (error) {
        console.warn("Profile select notice:", error.message);
        const initialRole = isPilotAdmin ? 'village_admin' : 'citizen';
        const fallbackProfile = { id: targetId, role: initialRole, name: "" };
        setProfile(fallbackProfile);
        setRole(initialRole);
        return;
      }

      if (data) { 
        if (isPilotAdmin && data.role !== 'village_admin' && data.role !== 'super_admin') {
          // Elevate role to Sarpanch/Village Admin in Supabase DB
          await supabase.from("profiles").update({ role: 'village_admin' }).eq("id", targetId);
          data.role = 'village_admin';
          notify("🎉 You have been logged in as Village Admin (Sarpanch)!");
        }

        setProfile(data); 
        setRole(data.role); 
        if (!data.name) setShowProfileSetup(true);
        if (isPilotAdmin) {
          navigate("profile");
        } else if (['village_admin', 'district_admin', 'super_admin', 'officer'].includes(data.role)) {
          navigate("admin");
        }
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      notify("Profile fetch error: " + err.message, "err");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    notify("Logged out successfully");
    navigate("home");
  };

  const shared = { t, notify, navigate, session, profile, role, i18n, theme, setTheme, fetchProfile };

  const renderContent = () => {
    switch(view) {
      case "submit": return <SubmitView {...shared} />;
      case "submit_anonymous": return <AnonymousSubmitView {...shared} />;
      case "track":  return <ErrorBoundary><TrackView {...shared} /></ErrorBoundary>;
      case "profile": return <ProfileView {...shared} />;
      case "gov-links": return <GovLinksView {...shared} />;
      case "gallery": return <GalleryView {...shared} />;
      case "invite": return <InvitationAcceptView {...shared} token={inviteToken} onAccept={() => {
        if (session?.user?.id) fetchProfile(session.user.id);
      }} setShowLogin={setShowLogin} setInitialLoginMode={setInitialLoginMode} />;
      case "admin":
        if (['village_admin', 'district_admin', 'super_admin'].includes(role)) return <AdminView {...shared} />;
        if (role === "officer") return <AdminView {...shared} t_officer />;
        if (session) return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, fontFamily: THEME.font }}>
            <div style={{ fontSize: 48 }}>🔒</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: THEME.colors.text }}>{t('access_restricted')}</div>
            <div style={{ color: THEME.colors.textMuted, fontSize: 14, textAlign: "center", maxWidth: 360 }}>
              {t('current_role')} <strong style={{ color: THEME.colors.danger }}>{role || "citizen"}</strong>.<br/>{t('admin_access_notice')}
            </div>
            <div style={{ background: THEME.colors.warningBg, border: `1px solid #fcd34d`, borderRadius: 10, padding: "16px 24px", maxWidth: 440, fontSize: 13, color: "#92400E", lineHeight: 1.6, textAlign: "center" }}>
              {t('admin_contact_notice')}
            </div>
            <button
              onClick={async () => {
                const targetId = ensureUUID(session?.user?.id);
                if (!targetId) return;
                const { data } = await supabase.from("profiles").select("*").eq("id", targetId).single();
                if (data) { setRole(data.role); setProfile(data); if (['village_admin', 'district_admin', 'super_admin', 'officer'].includes(data.role)) navigate("admin"); }
              }}
              style={{ background: "linear-gradient(135deg,#047857,#10B981)", color: "#fff", border: "none", padding: "12px 28px", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
            >
              {t('refresh_role')}
            </button>
          </div>
        );
        return <HomeView {...shared} />;
      default:       return <HomeView {...shared} />;
    }
  };

  return (
    <Shell {...shared} view={view} toast={toast} handleLogout={handleLogout} setShowLogin={setShowLogin}>
      {renderContent()}
      
      {showLogin && (
        <LoginModal 
          t={t}
          notify={notify}
          initialMode={initialLoginMode}
          onClose={() => { setShowLogin(false); setInitialLoginMode(null); window.history.replaceState({}, document.title, '/'); }} 
          onLogin={(s) => { 
            setSession(s); 
            setShowLogin(false);
            setInitialLoginMode(null);
            if (s?.user?.id) fetchProfile(s.user.id);
            window.history.replaceState({}, document.title, '/');
          }} 
        />
      )}

      {showResetPassword && (
        <ResetPasswordModal 
          t={t}
          notify={notify}
          onComplete={(successMsgOrMode) => {
            setShowResetPassword(false);
            // Clear URL hash & params to clean up the reset state
            window.history.replaceState({}, document.title, '/login');
            // If 'forgot' mode was requested (from expired link), open forgot password view
            if (successMsgOrMode === 'forgot') {
              setInitialLoginMode('forgot');
              setShowLogin(true);
            } else {
              // Show login with success message
              setShowLogin(true);
              if (successMsgOrMode) {
                notify(successMsgOrMode);
              }
            }
          }}
        />
      )}

      {showProfileSetup && (
        <ProfileSetupModal 
          t={t}
          session={session} 
          profile={profile}
          notify={notify} 
          onComplete={() => {
            setShowProfileSetup(false);
            if (session?.user?.id) fetchProfile(session.user.id);
          }} 
        />
      )}
    </Shell>
  );
}
