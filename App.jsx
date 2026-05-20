import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { useTranslation } from 'react-i18next';
import './i18n'; // initialize i18n

const THEME = {
  colors: {
    primary: "#0284c7", 
    primaryHover: "#0369a1",
    primaryLight: "#e0f2fe",
    surface: "#ffffff",
    background: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    danger: "#dc2626",
    dangerBg: "#fef2f2",
    success: "#16a34a",
    successBg: "#f0fdf4",
    warning: "#d97706",
    warningBg: "#fffbeb",
    dark: "#0f172a"
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
  font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
};

const CATEGORIES = [
  { id: "Road & Infrastructure", key: "cat_road", icon: "🛣" },
  { id: "Water Supply", key: "cat_water", icon: "💧" },
  { id: "Electricity", key: "cat_electricity", icon: "⚡" },
  { id: "Sanitation", key: "cat_sanitation", icon: "🧹" },
  { id: "Education", key: "cat_education", icon: "📚" },
  { id: "Health Services", key: "cat_health", icon: "🏥" },
  { id: "Agriculture", key: "cat_agriculture", icon: "🌾" },
  { id: "Other", key: "cat_other", icon: "📌" },
];

const STATUS_FLOW = ["Open", "Assigned", "In Progress", "Resolved", "Closed", "Escalated"];
const STATUS_META = {
  Open:          { color: THEME.colors.danger, bg: THEME.colors.dangerBg, border: "#fca5a5", icon: "🔴" },
  Assigned:      { color: THEME.colors.warning, bg: THEME.colors.warningBg, border: "#fcd34d", icon: "🟡" },
  "In Progress": { color: THEME.colors.primary, bg: THEME.colors.primaryLight, border: "#7dd3fc", icon: "🔵" },
  Resolved:      { color: THEME.colors.success, bg: THEME.colors.successBg, border: "#86efac", icon: "🟢" },
  Closed:        { color: THEME.colors.textMuted, bg: "#f1f5f9", border: "#cbd5e1", icon: "⚫" },
  Escalated:     { color: "#991b1b", bg: THEME.colors.dangerBg, border: "#f87171", icon: "⚠️" },
  Urgent:        { color: THEME.colors.surface, bg: THEME.colors.danger, border: THEME.colors.danger, icon: "🔥" },
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

const Btn = ({ children, variant = "primary", full, style: s, ...props }) => {
  const V = {
    primary: { background: THEME.colors.primary, color: THEME.colors.surface, border: "none" },
    outline:  { background: "transparent", color: THEME.colors.primary, border: `1.5px solid ${THEME.colors.primary}` },
    ghost:    { background: "transparent", color: THEME.colors.textMuted, border: "none" },
    dark:     { background: THEME.colors.dark, color: THEME.colors.surface, border: "none" },
  };
  return (
    <button style={{ ...V[variant], padding: "10px 20px", borderRadius: THEME.radius.sm, fontFamily: THEME.font, fontWeight: 600, fontSize: 14, cursor: "pointer", width: full ? "100%" : undefined, transition: "all 0.2s", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...s }} {...props}>
      {children}
    </button>
  );
};

const PhotoUpload = ({ photos, setPhotos }) => {
  const { t } = useTranslation();
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const processFiles = (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 5 - photos.length);
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => setPhotos(prev => [...prev, { file, url: e.target.result, name: file.name, size: (file.size / 1024).toFixed(1) }]);
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: THEME.colors.textMuted, fontFamily: THEME.font }}>
        {t('photo_evidence')} <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: THEME.colors.textMuted }}>{t('optional_up_to_5')}</span>
      </label>
      {photos.length < 5 && (
        <div onClick={() => fileRef.current.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
             style={{ border: `2px dashed ${dragging ? THEME.colors.primary : THEME.colors.border}`, borderRadius: THEME.radius.md, padding: "30px 20px", textAlign: "center", cursor: "pointer", background: dragging ? THEME.colors.primaryLight : THEME.colors.surface, transition: "all 0.2s" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
          <div style={{ fontWeight: 600, color: THEME.colors.text, fontSize: 14 }}>{t('click_to_upload')}</div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => processFiles(e.target.files)} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))", gap: 10, marginTop: 12 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", borderRadius: THEME.radius.sm, overflow: "hidden", border: `1px solid ${THEME.colors.border}` }}>
            <img src={p.url} style={{ width: "100%", height: 80, objectFit: "cover" }} />
            <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(15,23,42,0.6)", border: "none", borderRadius: "50%", color: "#fff", width: 24, height: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        ))}
      </div>
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

const Shell = ({ children, view, role, navigate, toast, session, profile, handleLogout, setShowLogin, t, i18n }) => (
  <div style={{ fontFamily: THEME.font, minHeight: "100vh", background: THEME.colors.background, color: THEME.colors.text }}>
    <nav style={{ background: THEME.colors.surface, borderBottom: `1px solid ${THEME.colors.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 100, boxShadow: THEME.shadow.sm }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => navigate("home")}>
        <div style={{ width: 36, height: 36, background: THEME.colors.primary, color: THEME.colors.surface, borderRadius: THEME.radius.sm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏘</div>
        <div>
          <div style={{ color: THEME.colors.text, fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>{t('app_title')}</div>
          <div style={{ color: THEME.colors.textMuted, fontSize: 11, fontWeight: 500 }}>{t('subtitle')}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {["home", "submit", "track"].map(v => (
          <button key={v} onClick={() => navigate(v)} style={{ background: view === v ? THEME.colors.primaryLight : "transparent", color: view === v ? THEME.colors.primaryHover : THEME.colors.textMuted, border: "none", padding: "8px 14px", borderRadius: THEME.radius.sm, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>{t(v === 'submit' ? 'submit_grievance' : v === 'track' ? 'track_status' : 'home')}</button>
        ))}
        <button onClick={() => navigate("gov-links")} style={{ background: view === "gov-links" ? THEME.colors.primaryLight : "transparent", color: view === "gov-links" ? THEME.colors.primaryHover : THEME.colors.textMuted, border: "none", padding: "8px 14px", borderRadius: THEME.radius.sm, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>{t('govt_links')}</button>
        {session && (
          <button onClick={() => navigate("admin")} style={{ background: view === "admin" ? THEME.colors.primary : THEME.colors.surface, color: view === "admin" ? THEME.colors.surface : THEME.colors.text, border: `1px solid ${view === "admin" ? THEME.colors.primary : THEME.colors.border}`, padding: "8px 14px", borderRadius: THEME.radius.sm, cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s" }}>🛡 {t('admin_nav')}</button>
        )}
        {session && (
          <button onClick={() => navigate("profile")} style={{ background: view === "profile" ? THEME.colors.primaryLight : "transparent", color: view === "profile" ? THEME.colors.primaryHover : THEME.colors.textMuted, border: "none", padding: "8px 14px", borderRadius: THEME.radius.sm, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s" }}>{t('my_account')}</button>
        )}
        <div style={{ width: 1, height: 24, background: THEME.colors.border, margin: "0 4px" }} />
        <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : i18n.language === 'hi' ? 'te' : 'en')} style={{ background: THEME.colors.background, color: THEME.colors.text, border: `1px solid ${THEME.colors.border}`, padding: "8px 12px", borderRadius: THEME.radius.sm, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>{i18n.language.toUpperCase()}</button>
        {session ? (
          <Btn variant="outline" style={{ padding: "8px 16px", fontSize: 13, minHeight: 36, borderColor: THEME.colors.danger, color: THEME.colors.danger, borderWidth: 1 }} onClick={handleLogout}>{t('logout')}</Btn>
        ) : (
          <Btn style={{ padding: "8px 16px", fontSize: 13, minHeight: 36 }} onClick={() => setShowLogin(true)}>{t('login')}</Btn>
        )}
      </div>
    </nav>
    {toast && (
      <div style={{ position: "fixed", top: 84, right: 24, zIndex: 1000, background: toast.type === "err" ? THEME.colors.dangerBg : THEME.colors.successBg, color: toast.type === "err" ? THEME.colors.danger : THEME.colors.success, padding: "14px 20px", borderRadius: THEME.radius.md, border: `1px solid ${toast.type === "err" ? '#fca5a5' : '#86efac'}`, fontWeight: 600, boxShadow: THEME.shadow.md, display: "flex", alignItems: "center", gap: 10 }}>{toast.type === "err" ? "⚠️" : "✅"} {toast.msg}</div>
    )}
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }}>{children}</div>
  </div>
);

// ─── Sub-Views ────────────────────────────────────────────────────────────────

const HomeView = ({ navigate, t }) => (
  <div style={{ textAlign: "center", padding: "80px 20px" }}>
    <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 900, color: THEME.colors.text, marginBottom: 24, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{t('welcome')}</h1>
    <p style={{ fontSize: "clamp(1.125rem, 2vw, 1.25rem)", color: THEME.colors.textMuted, marginBottom: 48, maxWidth: 680, margin: "0 auto 48px", lineHeight: 1.6 }}>{t('welcome_subtitle')}</p>
    <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
      <Btn style={{ padding: "16px 32px", fontSize: 16, borderRadius: THEME.radius.full }} onClick={() => navigate("submit")}>{t('submit_grievance')}</Btn>
      <Btn variant="ghost" style={{ padding: "16px 32px", fontSize: 16, background: THEME.colors.primaryLight, color: THEME.colors.primaryHover, borderRadius: THEME.radius.full }} onClick={() => navigate("track")}>{t('track_status')}</Btn>
    </div>
  </div>
);

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
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

const LocationPicker = ({ onLocationSelect, t, initialCoords }) => {
  const [pos, setPos] = useState(initialCoords || [17.3850, 78.4867]);
  const markerRef = useRef(null);

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setPos([newPos.lat, newPos.lng]);
        onLocationSelect(newPos.lat, newPos.lng);
      }
    },
  }), []);

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
      });
    }
  };

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
      <div style={{ height: 280, borderRadius: THEME.radius.md, overflow: "hidden", border: `1.5px solid ${THEME.colors.border}`, boxShadow: THEME.shadow.sm }}>
        <MapContainer center={pos} zoom={13} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
          <Marker position={pos} draggable={true} eventHandlers={eventHandlers} ref={markerRef} />
          <RecenterMap position={pos} />
          <MapEvents onLocationSelect={(lat, lng) => {
            setPos([lat, lng]);
            onLocationSelect(lat, lng);
          }} />
        </MapContainer>
      </div>
      <p style={{ fontSize: 12, color: THEME.colors.textMuted, marginTop: 8 }}>{t('drag_pin_hint')}</p>
    </div>
  );
};

const SubmitView = ({ t, notify, navigate, session }) => {
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
    peopleAffected: ""
  });
  const [photos, setPhotos] = useState([]);

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
    if (!session) return notify(t("login_to_track"), "err");
    if (form.categories.length === 0) return notify("Please select at least one category", "err");
    
    setLoading(true);
    try {
      const ticketId = generateTicketId();
      
      // Append extra questions to description safely
      const fullDescription = `${form.description}\n\n--- Additional Details ---\nDuration: ${form.duration}\nEmergency: ${form.isEmergency ? 'Yes' : 'No'}\nPeople Affected: ${form.peopleAffected || 'Not specified'}`;
      
      const { error } = await supabase.from("complaints").insert([{
        citizen_id: session.user.id,
        ticket_id: ticketId,
        title: form.title,
        description: fullDescription,
        category: form.categories.join(", "),
        location: form.location,
        latitude: form.latitude,
        longitude: form.longitude,
        status: "Open"
      }]);

      if (error) throw error;
      notify(`${t("success_submit")} Ticket: ${ticketId}`);
      navigate("track");
    } catch (err) { 
      console.error("Submission error:", err);
      notify(err.message, "err"); 
    }
    setLoading(false);
  };

  return (
    <div style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>{t('register_grievance')}</h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: THEME.colors.textMuted, background: THEME.colors.background, padding: "6px 14px", borderRadius: THEME.radius.full }}>Step {step} of 2</span>
      </div>
      
      {step === 1 ? (
        <div>
          <label style={{ display: "block", marginBottom: 16, fontSize: 14, fontWeight: 600, color: THEME.colors.text }}>Select Problem Categories (Multiple allowed)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 32 }}>
            {CATEGORIES.map(c => {
              const isSelected = form.categories.includes(c.id);
              return (
                <div key={c.id} onClick={() => toggleCategory(c.id)}
                     style={{ padding: "16px 10px", borderRadius: THEME.radius.md, border: `2px solid ${isSelected ? THEME.colors.primary : THEME.colors.border}`, background: isSelected ? THEME.colors.primaryLight : THEME.colors.surface, cursor: "pointer", textAlign: "center", transition: "all 0.2s", transform: isSelected ? "scale(0.98)" : "scale(1)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? THEME.colors.primaryHover : THEME.colors.text }}>{t(c.key)}</div>
                </div>
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
          <Textarea label={t("description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
          
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

          <LocationPicker t={t} initialCoords={[form.latitude, form.longitude]} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          
          <Input label={t("location_landmark")} placeholder="e.g. Near Village School" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
          <PhotoUpload photos={photos} setPhotos={setPhotos} />
          
          <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
            <Btn variant="ghost" type="button" onClick={() => setStep(1)} style={{ flex: 1, background: THEME.colors.background }}>{t('back_btn')}</Btn>
            <Btn type="submit" disabled={loading} style={{ flex: 2 }}>{loading ? t("submitting") : t("submit_btn")}</Btn>
          </div>
        </form>
      )}
    </div>
  );
};

const TrackView = ({ t, notify, session }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) fetchGrievances();
  }, [session]);

  const fetchGrievances = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
    if (!error) setItems(data);
    setLoading(false);
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

  if (!session) return <div style={{ textAlign: "center", padding: 40, fontFamily: THEME.font, fontWeight: 700 }}>{t("login_to_track")}</div>;

  return (
    <div>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, letterSpacing: "-0.01em" }}>{t("your_grievances")}</h2>
      {loading ? <div>{t("loading")}</div> : items.length === 0 ? <div style={{ textAlign: "center", padding: 40, background: THEME.colors.surface, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}` }}>{t("no_complaints")}</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {items.map(it => (
            <div key={it.id} style={{ background: THEME.colors.surface, padding: 24, borderRadius: THEME.radius.lg, border: `1px solid ${THEME.colors.border}`, boxShadow: THEME.shadow.sm }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: THEME.colors.textMuted, fontWeight: 700, marginBottom: 4 }}>#{it.id.slice(0, 8)} • {t(CATEGORIES.find(c => c.id === it.category)?.key || "cat_other")}</div>
                  <h3 style={{ fontSize: 20, fontWeight: 800 }}>{it.title}</h3>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Badge status={it.status} priority={it.priority} />
                  <button onClick={() => deleteGrievance(it.id)} style={{ background: THEME.colors.dangerBg, border: `1px solid ${THEME.colors.danger}`, color: THEME.colors.danger, cursor: "pointer", padding: "6px 12px", borderRadius: THEME.radius.sm, fontSize: 12, fontWeight: 700, fontFamily: THEME.font, transition: "all 0.2s" }} title="Delete grievance">Delete</button>
                </div>
              </div>
              <p style={{ fontSize: 15, color: THEME.colors.textMuted, marginBottom: 24, lineHeight: 1.5 }}>{it.description}</p>
              <Timeline status={it.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProfileView = ({ t, session, profile, notify }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) fetchStats();
  }, [session]);

  const fetchStats = async () => {
    const { count, error } = await supabase.from("complaints").select("*", { count: "exact", head: true }).eq("citizen_id", session.user.id);
    if (!error) setCount(count || 0);
    setLoading(false);
  };

  if (!session || !profile) return <div style={{ textAlign: "center", padding: 40, fontFamily: THEME.font, fontWeight: 700 }}>{t("login_to_track")}</div>;

  return (
    <div style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 680, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, letterSpacing: "-0.01em" }}>{t('my_account')}</h2>
      
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, background: THEME.colors.primaryLight, color: THEME.colors.primary, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800 }}>
            {profile.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <h3 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>{profile.name || "User"}</h3>
            <p style={{ color: THEME.colors.textMuted, margin: 0, fontSize: 15 }}>{session.user.email || profile.phone}</p>
          </div>
        </div>
      </div>

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

      <div style={{ background: THEME.colors.successBg, border: `1px solid #86efac`, borderRadius: THEME.radius.md, padding: 24 }}>
        <h4 style={{ fontSize: 15, fontWeight: 700, color: THEME.colors.success, margin: "0 0 8px" }}>{t('account_security')}</h4>
        <p style={{ fontSize: 14, color: "#15803d", margin: 0, lineHeight: 1.6 }}>
          {t('auth_desc')} <strong>{session.user.app_metadata.provider === 'google' ? t('auth_method_google') : t('auth_method_email')}</strong>.
          {session.user.app_metadata.provider === 'google' ? ` ${t('auth_no_password')}` : ''}
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
    <div style={{ background: THEME.colors.surface, padding: "40px 32px", borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, maxWidth: 880, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, letterSpacing: "-0.01em" }}>{t('official_resources')}</h2>
      <p style={{ color: THEME.colors.textMuted, marginBottom: 32, fontSize: 15 }}>{t('explore_portals')}</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
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
  if (!photos || photos.length === 0) return null;
  const photo = photos[idx];
  const src = photo?.url || photo;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(6px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
        <img src={src} alt="" style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} />
        <div style={{ textAlign: "center", marginTop: 12, color: "#fff", fontFamily: THEME.font, fontWeight: 700, fontSize: 13 }}>
          {t('photo_of', { current: idx + 1, total: photos.length })}
        </div>
        {photos.length > 1 && (
          <>
            <button onClick={() => setIdx((idx - 1 + photos.length) % photos.length)} style={{ position: "absolute", left: -50, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, cursor: "pointer", backdropFilter: "blur(4px)" }}>‹</button>
            <button onClick={() => setIdx((idx + 1) % photos.length)} style={{ position: "absolute", right: -50, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: "50%", fontSize: 20, cursor: "pointer", backdropFilter: "blur(4px)" }}>›</button>
          </>
        )}
        <button onClick={onClose} style={{ position: "absolute", top: -15, right: -15, background: "#EF4444", border: "none", color: "#fff", width: 32, height: 32, borderRadius: "50%", fontSize: 14, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.4)" }}>✕</button>
      </div>
    </div>
  );
};

// ─── Analytics Tab ───────────────────────────────────────────────────────────

const AnalyticsTab = ({ list, t }) => {
  const stats = useMemo(() => {
    const total = list.length;
    const byStatus = {};
    STATUS_FLOW.forEach(s => { byStatus[s] = list.filter(c => c.status === s).length; });
    const byCat = {};
    CATEGORIES.forEach(c => { byCat[c.id] = list.filter(x => (x.category || "").includes(c.id)).length; });
    const withPhotos = list.filter(c => c.photos && ((Array.isArray(c.photos) && c.photos.length > 0) || (typeof c.photos === 'string' && c.photos !== '[]'))).length;
    const urgent = list.filter(c => c.priority === "Urgent").length;
    return { total, byStatus, byCat, withPhotos, urgent };
  }, [list]);

  const maxCat = Math.max(1, ...Object.values(stats.byCat));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { label: t('total_complaints'), value: stats.total, icon: "📊", color: THEME.colors.primary, bg: THEME.colors.primaryLight },
          { label: t('open_complaints'), value: stats.byStatus.Open || 0, icon: "🔴", color: THEME.colors.danger, bg: THEME.colors.dangerBg },
          { label: t('in_progress_complaints'), value: stats.byStatus["In Progress"] || 0, icon: "🔵", color: THEME.colors.primary, bg: THEME.colors.primaryLight },
          { label: t('resolved_complaints'), value: stats.byStatus.Resolved || 0, icon: "🟢", color: THEME.colors.success, bg: THEME.colors.successBg },
          { label: t('escalated_complaints'), value: stats.byStatus.Escalated || 0, icon: "⚠️", color: "#991B1B", bg: THEME.colors.dangerBg },
        ].map((card, i) => (
          <div key={i} style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: "20px 18px", border: `1px solid ${THEME.colors.border}`, boxShadow: THEME.shadow.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{card.icon}</span>
              <span style={{ background: card.bg, color: card.color, padding: "3px 10px", borderRadius: THEME.radius.full, fontSize: 10, fontWeight: 800 }}>{stats.total > 0 ? Math.round((card.value / stats.total) * 100) : 0}%</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: THEME.colors.textMuted, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Category Distribution */}
      <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24, border: `1px solid ${THEME.colors.border}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>📂 {t('category_distribution')}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CATEGORIES.map(c => {
            const count = stats.byCat[c.id] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: THEME.colors.text }}>{c.icon} {t(c.key)}</span>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: THEME.colors.surface, borderRadius: THEME.radius.md, padding: 24, border: `1px solid ${THEME.colors.border}` }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>📈 {t('status_breakdown')}</h3>
          {STATUS_FLOW.map(s => {
            const m = STATUS_META[s];
            const count = stats.byStatus[s] || 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            const sKey = `status_${s.toLowerCase().replace(" ", "_")}`;
            return (
              <div key={s} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.icon} {t(sKey)}</span>
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
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [policyError, setPolicyError] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      notify(error.message, "err");
    } else {
      setUsers(data || []);
    }
    setLoading(false);
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

  const filteredUsers = users.filter(u => {
    const term = search.toLowerCase();
    const nameMatch = u.name?.toLowerCase().includes(term);
    const phoneMatch = u.phone?.toLowerCase().includes(term);
    const roleMatch = u.role?.toLowerCase().includes(term);
    return nameMatch || phoneMatch || roleMatch;
  });

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
    if (role === "admin") {
      return <span style={{ ...s, background: THEME.colors.dangerBg, color: THEME.colors.danger, border: `1.5px solid ${STATUS_META.Open.border}` }}>{t('badge_admin')}</span>;
    }
    if (role === "officer") {
      return <span style={{ ...s, background: THEME.colors.successBg, color: THEME.colors.success, border: `1.5px solid ${STATUS_META.Resolved.border}` }}>{t('badge_officer')}</span>;
    }
    return <span style={{ ...s, background: THEME.colors.background, color: THEME.colors.textMuted, border: `1.5px solid ${THEME.colors.border}` }}>{t('badge_citizen')}</span>;
  };

  return (
    <div style={{ fontFamily: THEME.font }}>
      {policyError && (
        <div style={{ background: THEME.colors.dangerBg, border: `1px solid ${STATUS_META.Open.border}`, borderRadius: THEME.radius.md, padding: "16px 20px", marginBottom: 20, color: THEME.colors.danger, fontSize: 13, lineHeight: 1.6 }}>
          <strong style={{ fontSize: 14 }}>⚠️ Row Level Security (RLS) Policy Missing</strong><br/>
          To enable role updates from the UI in a secure, production-grade manner, please execute the <code style={{ background: "#FEE2E2", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>add-admin-policy.sql</code> script in your **Supabase SQL Editor**:
          <pre style={{ background: THEME.colors.surface, padding: 12, borderRadius: 8, marginTop: 10, fontSize: 11, overflowX: "auto", border: `1.5px solid ${STATUS_META.Open.border}`, color: THEME.colors.text }}>
{`CREATE POLICY "Admins can update all profiles" 
ON profiles FOR UPDATE TO authenticated 
USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );`}
          </pre>
        </div>
      )}

      {/* Control Bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder={t('search_users_placeholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: "10px 16px",
            borderRadius: THEME.radius.md,
            border: `1.5px solid ${THEME.colors.border}`,
            fontSize: 13,
            fontWeight: 700,
            color: THEME.colors.text,
            flex: 1,
            minWidth: 260,
            outline: "none"
          }}
        />
        <Btn variant="outline" onClick={fetchUsers} disabled={loading} style={{ padding: "10px 20px" }}>
          {loading ? t('refreshing') : t('reload_staff_list')}
        </Btn>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: THEME.colors.textMuted }}>
          <div style={{ fontSize: 32, animation: "urgentPulse 2s infinite" }}>👥</div>
          <p style={{ fontWeight: 800, marginTop: 12 }}>{t('loading_users')}</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: THEME.colors.text }}>{t('no_users_match')}</h3>
          <p style={{ color: THEME.colors.textMuted, margin: "6px 0 0", fontSize: 13 }}>{t('try_checking_spelling')}</p>
        </div>
      ) : (
        <div style={{ background: THEME.colors.surface, border: `1px solid ${THEME.colors.border}`, borderRadius: THEME.radius.md, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: THEME.colors.background, borderBottom: `1.5px solid ${THEME.colors.border}` }}>
                  <th style={{ padding: "16px 20px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_full_name')}</th>
                  <th style={{ padding: "16px 20px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_phone_number')}</th>
                  <th style={{ padding: "16px 20px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_current_role')}</th>
                  <th style={{ padding: "16px 20px", fontWeight: 800, color: THEME.colors.textMuted }}>{t('col_registered_date')}</th>
                  <th style={{ padding: "16px 20px", fontWeight: 800, color: THEME.colors.textMuted, textAlign: "right" }}>{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const isSelf = u.id === session?.user?.id;
                  const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "N/A";
                  return (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${THEME.colors.border}`, background: isSelf ? THEME.colors.background : THEME.colors.surface, transition: "background 0.2s" }}>
                      <td style={{ padding: "16px 20px", fontWeight: 800, color: THEME.colors.text }}>
                        {u.name || t('unnamed_user')} {isSelf && <span style={{ color: THEME.colors.success, fontSize: 11, background: THEME.colors.successBg, padding: "2px 6px", borderRadius: 6, marginLeft: 4 }}>{t('you_label')}</span>}
                      </td>
                      <td style={{ padding: "16px 20px", color: THEME.colors.textMuted, fontWeight: 700 }}>{u.phone || t('no_phone_linked')}</td>
                      <td style={{ padding: "16px 20px" }}>{getRoleBadge(u.role)}</td>
                      <td style={{ padding: "16px 20px", color: THEME.colors.textMuted, fontWeight: 600 }}>{dateStr}</td>
                      <td style={{ padding: "16px 20px", textAlign: "right" }}>
                        {isSelf ? (
                          <span style={{ fontSize: 11, color: THEME.colors.textMuted, fontWeight: 700, padding: "8px 12px", background: THEME.colors.background, borderRadius: THEME.radius.sm, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {t('lock_protection')}
                          </span>
                        ) : (
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            {updatingId === u.id ? (
                              <span style={{ fontSize: 12, color: THEME.colors.success, fontWeight: 800, animation: "urgentPulse 1.5s infinite" }}>{t('updating')}</span>
                            ) : (
                              <>
                                <select
                                  value={u.role || "citizen"}
                                  onChange={e => updateUserRole(u.id, e.target.value)}
                                  disabled={updatingId !== null}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: THEME.radius.sm,
                                    border: `1.5px solid ${THEME.colors.border}`,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: THEME.colors.text,
                                    outline: "none",
                                    cursor: "pointer",
                                    background: THEME.colors.surface
                                  }}
                                >
                                  <option value="citizen">{t('role_citizen')}</option>
                                  <option value="officer">{t('role_officer')}</option>
                                  <option value="admin">{t('role_admin')}</option>
                                </select>
                              </>
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
        </div>
      )}
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
  const [tab, setTab] = useState("complaints"); // complaints | analytics
  const [lightbox, setLightbox] = useState(null); // { photos, index }

  // Filters
  const [fStatus, setFStatus] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fSearch, setFSearch] = useState("");
  const [fUrgent, setFUrgent] = useState(false);

  useEffect(() => {
    fetchData();
    if (!t_officer) fetchOfficers();
  }, [t_officer]);

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

  const updateGrievance = async (id, updates) => {
    const { error } = await supabase.from("complaints").update(updates).eq("id", id);
    if (error) notify(error.message, "err");
    else {
      notify(t('change_status') + " ✓");
      fetchData();
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...updates }));
    }
  };

  // Filtered list
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
    });
  }, [list, fStatus, fCategory, fSearch, fUrgent]);

  const getPhotos = (item) => {
    if (!item?.photos) return [];
    if (Array.isArray(item.photos)) return item.photos;
    try { return JSON.parse(item.photos); } catch { return []; }
  };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: THEME.colors.text }}>{t_officer ? t("officer_dashboard") : t("admin_dashboard")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={tabStyle(tab === "complaints")} onClick={() => setTab("complaints")}>📋 {t('tab_complaints')}</button>
          <button style={tabStyle(tab === "analytics")} onClick={() => setTab("analytics")}>📊 {t('tab_analytics')}</button>
          {!t_officer && profile?.role === "admin" && (
            <button style={tabStyle(tab === "users")} onClick={() => setTab("users")}>👥 {t('tab_users')}</button>
          )}
          <Btn variant="ghost" onClick={fetchData} style={{ padding: "10px 14px", fontSize: 13 }}>🔄 {t("refresh")}</Btn>
        </div>
      </div>

      {tab === "users" && !t_officer && profile?.role === "admin" ? (
        <StaffManagementTab t={t} notify={notify} session={session} currentProfile={profile} />
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
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {t(c.key)}</option>)}
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
          <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 420px" : "1fr", gap: 24, alignItems: "start" }}>
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
                          <span style={{ fontSize: 11, color: THEME.colors.textMuted }}>{t('created_on')} {new Date(it.created_at).toLocaleDateString()}</span>
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
              <div style={{ background: THEME.colors.surface, padding: 24, borderRadius: THEME.radius.lg, boxShadow: THEME.shadow.md, position: "sticky", top: 80, maxHeight: "calc(100vh - 100px)", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{t("complaint_details")}</h3>
                  <button onClick={() => setSelected(null)} style={{ background: THEME.colors.background, border: "none", width: 30, height: 30, borderRadius: THEME.radius.sm, fontSize: 14, cursor: "pointer", fontWeight: 700, color: THEME.colors.textMuted }}>✕</button>
                </div>

                {/* Title & ID */}
                <div style={{ padding: "14px 16px", background: THEME.colors.background, borderRadius: THEME.radius.sm, marginBottom: 16, border: `1px solid ${THEME.colors.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: THEME.colors.textMuted, textTransform: "uppercase", marginBottom: 4 }}>#{selected.ticket_id || selected.id.slice(0, 8)}</div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{selected.title}</h4>
                  <Badge status={selected.status} priority={selected.priority} />
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
                            <div key={i} onClick={() => setLightbox({ photos, index: i })} style={{ cursor: "pointer", borderRadius: THEME.radius.sm, overflow: "hidden", border: `2px solid ${THEME.colors.border}`, transition: "border-color 0.2s", position: "relative" }}
                                 onMouseOver={e => e.currentTarget.style.borderColor = THEME.colors.primary}
                                 onMouseOut={e => e.currentTarget.style.borderColor = THEME.colors.border}>
                              <img src={p.url || p} style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} alt="" />
                              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}
                                   onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
                                   onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
                                <span style={{ color: "#fff", fontSize: 18, opacity: 0.9 }}>🔍</span>
                              </div>
                            </div>
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

const ProfileSetupModal = ({ session, onComplete, notify, t }) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return notify("Please enter your name", "err");
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim() })
        .eq("id", session.user.id);
      
      if (error) throw error;
      notify("Profile setup complete!");
      onComplete();
    } catch (err) {
      notify(err.message, "err");
    }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, backdropFilter: "blur(4px)" }}>
      <div style={{ background: THEME.colors.surface, padding: 32, borderRadius: 24, width: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>👋</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>{t('profile_setup_title')}</h2>
        <p style={{ color: THEME.colors.textMuted, textAlign: "center", marginBottom: 24, fontSize: 14 }}>Please tell us your name to complete your registration.</p>
        
        <Input 
          label={t('full_name_label')} 
          placeholder="e.g. Rajesh Kumar" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          autoFocus
        />
        
        <Btn full onClick={handleSave} disabled={loading}>
          {loading ? t('saving') : t('get_started_btn')}
        </Btn>
      </div>
    </div>
  );
};

const LoginModal = ({ onLogin, onClose, notify, t }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email || !password) return notify("Please fill all fields", "err");
    
    setLoading(true);
    try {
      let data, error;
      if (isSignUp) {
        ({ data, error } = await supabase.auth.signUp({ email, password }));
        if (error) throw error;
        notify("Signup successful! You can now log in.");
        setIsSignUp(false);
      } else {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
        if (error) throw error;
        if (data.session) onLogin(data.session);
      }
    } catch (err) {
      notify(err.message, "err");
    }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}>
      <div style={{ background: THEME.colors.surface, padding: 32, borderRadius: 24, width: 360, boxShadow: THEME.shadow.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{isSignUp ? t('sign_up') : t('login')}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: THEME.colors.textMuted }}>✕</button>
        </div>

        <form onSubmit={handleAuth}>
          <p style={{ fontSize: 13, color: THEME.colors.textMuted, marginBottom: 20 }}>
            {isSignUp ? t('create_account') : t('login_to_account')}
          </p>
          <Input 
            label={t('email_label')} 
            type="email"
            placeholder="you@example.com" 
            value={email} 
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Input 
            label={t('password_label')} 
            type="password"
            placeholder="••••••••" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            required
            style={{ marginTop: 12 }}
          />
          <Btn type="submit" full disabled={loading} style={{ marginTop: 20 }}>
            {loading ? t('loading') : (isSignUp ? t('sign_up') : t('login'))}
          </Btn>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)} 
            style={{ background: "none", border: "none", color: THEME.colors.primary, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          >
            {isSignUp ? t('already_have_account') : t('dont_have_account')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState("home");
  const [role, setRole] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  const notify = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  
  const navigate = (v) => { setView(v); };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setRole(null); setShowProfileSetup(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (id) => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
      
      if (error && error.code === 'PGRST116') {
        // Profile not found, let's create it manually (self-healing)
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert([{ id }])
          .select()
          .single();
          
        if (insertError) {
          notify("Insert error: " + insertError.message, "err");
          throw insertError;
        }
        
        setProfile(newProfile);
        setRole(newProfile.role);
        setShowProfileSetup(true);
        return;
      } else if (error) {
        notify("Select error: " + error.message, "err");
        throw error;
      }

      if (data) { 
        setProfile(data); 
        setRole(data.role); 
        if (!data.name) setShowProfileSetup(true);
        if (data.role === "admin" || data.role === "officer") navigate("admin");
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

  const shared = { t, notify, navigate, session, profile, role, i18n };

  const renderContent = () => {
    switch(view) {
      case "submit": return <SubmitView {...shared} />;
      case "track":  return <TrackView {...shared} />;
      case "profile": return <ProfileView {...shared} />;
      case "gov-links": return <GovLinksView {...shared} />;
      case "admin":
        if (role === "admin") return <AdminView {...shared} />;
        if (role === "officer") return <AdminView {...shared} t_officer />;
        if (session) return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, fontFamily: SANS }}>
            <div style={{ fontSize: 48 }}>🔒</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Access Restricted</div>
            <div style={{ color: "#6B7280", fontSize: 14, textAlign: "center", maxWidth: 360 }}>
              Your account role is <strong style={{ color: "#DC2626" }}>{role || "loading..."}</strong>.<br/>You need <strong>admin</strong> or <strong>officer</strong> role to access this dashboard.
            </div>
            <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 10, padding: "16px 24px", maxWidth: 440, fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
              <strong>To get admin access:</strong><br/>
              1. Go to your Supabase Dashboard → SQL Editor<br/>
              2. Run: <code style={{ background: "#FDE68A", padding: "2px 6px", borderRadius: 4 }}>UPDATE profiles SET role = 'admin' WHERE id = '{session?.user?.id}';</code><br/>
              3. Click "Refresh Role" below
            </div>
            <button
              onClick={async () => {
                const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
                if (data) { setRole(data.role); setProfile(data); if (data.role === "admin" || data.role === "officer") navigate("admin"); }
              }}
              style={{ background: "linear-gradient(135deg,#047857,#10B981)", color: "#fff", border: "none", padding: "12px 28px", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
            >
              🔄 Refresh Role
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
          onClose={() => setShowLogin(false)} 
          onLogin={(s) => { 
            setSession(s); 
            setShowLogin(false); 
          }} 
        />
      )}

      {showProfileSetup && (
        <ProfileSetupModal 
          t={t}
          session={session} 
          notify={notify} 
          onComplete={() => {
            setShowProfileSetup(false);
            fetchProfile(session.user.id);
          }} 
        />
      )}
    </Shell>
  );
}
