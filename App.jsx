import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient";
import { useTranslation } from 'react-i18next';
import './i18n'; // initialize i18n

const SANS = "'Trebuchet MS', 'Lucida Sans', sans-serif";

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
  Open:          { color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5", icon: "🔴" },
  Assigned:      { color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", icon: "🟡" },
  "In Progress": { color: "#2563EB", bg: "#EFF6FF", border: "#93C5FD", icon: "🔵" },
  Resolved:      { color: "#16A34A", bg: "#F0FDF4", border: "#86EFAC", icon: "🟢" },
  Closed:        { color: "#6B7280", bg: "#F9FAFB", border: "#D1D5DB", icon: "⚫" },
  Escalated:     { color: "#991B1B", bg: "#FEF2F2", border: "#F87171", icon: "⚠️" },
  Urgent:        { color: "#FFFFFF", bg: "#EF4444", border: "#DC2626", icon: "🔥" },
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
        <span style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}`, padding: "4px 12px", borderRadius: 99, fontSize: 10, fontWeight: 800, fontFamily: SANS, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
          {p.icon} {t('priority_urgent').toUpperCase()}
        </span>
      )}
      <span style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}`, padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: SANS, letterSpacing: 0.4, whiteSpace: "nowrap" }}>
        {m.icon} {t(statusKey)}
      </span>
    </div>
  );
};

const Input = ({ label, prefix, style: s, ...props }) => (
  <div style={{ marginBottom: 18 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#6B7280", fontFamily: SANS, letterSpacing: 0.9, textTransform: "uppercase" }}>{label}</label>}
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 700, color: "#374151", fontFamily: SANS }}>{prefix}</span>}
      <input style={{ width: "100%", padding: "11px 14px", paddingLeft: prefix ? 45 : 14, border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: SANS, outline: "none", boxSizing: "border-box", background: "#FAFAFA", color: "#111827", ...s }} {...props} />
    </div>
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div style={{ marginBottom: 18 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#6B7280", fontFamily: SANS, letterSpacing: 0.9, textTransform: "uppercase" }}>{label}</label>}
    <textarea style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontFamily: SANS, outline: "none", boxSizing: "border-box", background: "#FAFAFA", color: "#111827", resize: "vertical", minHeight: 110 }} {...props} />
  </div>
);

const Btn = ({ children, variant = "primary", full, style: s, ...props }) => {
  const V = {
    primary: { background: "linear-gradient(135deg,#047857,#059669)", color: "#fff", border: "none" },
    outline:  { background: "transparent", color: "#047857", border: "1.5px solid #047857" },
    ghost:    { background: "#F3F4F6", color: "#374151", border: "none" },
    dark:     { background: "#111827", color: "#fff", border: "none" },
  };
  return (
    <button style={{ ...V[variant], padding: "10px 20px", borderRadius: 10, fontFamily: SANS, fontWeight: 700, fontSize: 13, cursor: "pointer", width: full ? "100%" : undefined, transition: "all 0.2s", ...s }} {...props}>
      {children}
    </button>
  );
};

const PhotoUpload = ({ photos, setPhotos }) => {
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
      <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#6B7280", fontFamily: SANS, letterSpacing: 0.9, textTransform: "uppercase" }}>
        Photo Evidence <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#9CA3AF" }}>— optional, up to 5</span>
      </label>
      {photos.length < 5 && (
        <div onClick={() => fileRef.current.click()} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files); }}
             style={{ border: `2px dashed ${dragging ? "#047857" : "#D1D5DB"}`, borderRadius: 14, padding: "30px 20px", textAlign: "center", cursor: "pointer", background: dragging ? "#F0FDF4" : "#FAFAFA", transition: "all 0.2s" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
          <div style={{ fontWeight: 700, color: "#374151", fontSize: 14 }}>Click to upload or drag & drop</div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => processFiles(e.target.files)} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px,1fr))", gap: 10, marginTop: 12 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #E5E7EB" }}>
            <img src={p.url} style={{ width: "100%", height: 80, objectFit: "cover" }} />
            <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", color: "#fff", width: 20, height: 20, cursor: "pointer" }}>✕</button>
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
    <div style={{ display: "flex", alignItems: "flex-start", margin: "20px 0" }}>
      {STATUS_FLOW.map((s, i) => {
        const statusKey = `status_${s.toLowerCase().replace(" ", "_")}`;
        return (
          <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i < STATUS_FLOW.length - 1 && <div style={{ position: "absolute", top: 13, left: "50%", width: "100%", height: 3, background: i < idx ? STATUS_META[s].color : "#E5E7EB" }} />}
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: i <= idx ? STATUS_META[s].color : "#E5E7EB", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, zIndex: 1 }}>{i <= idx ? "✓" : i + 1}</div>
            <div style={{ fontSize: 9, fontWeight: i === idx ? 800 : 500, color: i === idx ? STATUS_META[s].color : "#9CA3AF", marginTop: 6, textAlign: "center" }}>{t(statusKey)}</div>
          </div>
        );
      })}
    </div>
  );
};

const Shell = ({ children, view, role, navigate, toast, session, profile, handleLogout, setShowLogin, t, i18n }) => (
  <div style={{ fontFamily: SANS, minHeight: "100vh", background: "#F3F4F6", color: "#111827" }}>
    <nav style={{ background: "#111827", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("home")}>
        <div style={{ width: 32, height: 32, background: "linear-gradient(135deg,#047857,#10B981)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏘</div>
        <div>
          <div style={{ color: "#F9FAFB", fontWeight: 800, fontSize: 14 }}>{t('app_title')}</div>
          <div style={{ color: "#6B7280", fontSize: 10 }}>{t('subtitle')}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {["home", "submit", "track"].map(v => (
          <button key={v} onClick={() => navigate(v)} style={{ background: view === v ? "#047857" : "transparent", color: view === v ? "#fff" : "#9CA3AF", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{t(v === 'submit' ? 'submit_grievance' : v === 'track' ? 'track_status' : 'home')}</button>
        ))}
        <button onClick={() => navigate("gov-links")} style={{ background: view === "gov-links" ? "#047857" : "transparent", color: view === "gov-links" ? "#fff" : "#9CA3AF", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Govt Links</button>
        {session && (
          <button onClick={() => navigate("profile")} style={{ background: view === "profile" ? "#047857" : "transparent", color: view === "profile" ? "#fff" : "#9CA3AF", border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>My Account</button>
        )}
        <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'hi' : i18n.language === 'hi' ? 'te' : 'en')} style={{ background: "#374151", color: "#fff", border: "none", padding: "6px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>{i18n.language.toUpperCase()}</button>
        {session ? (
          <Btn variant="outline" style={{ padding: "6px 12px", fontSize: 12, borderColor: "#EF4444", color: "#EF4444" }} onClick={handleLogout}>{t('logout')}</Btn>
        ) : (
          <Btn style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setShowLogin(true)}>{t('login')}</Btn>
        )}
      </div>
    </nav>
    {toast && (
      <div style={{ position: "fixed", top: 70, right: 20, zIndex: 1000, background: toast.type === "err" ? "#FEF2F2" : "#F0FDF4", color: toast.type === "err" ? "#DC2626" : "#15803D", padding: "12px 20px", borderRadius: 10, border: "1px solid", fontWeight: 700, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>{toast.msg}</div>
    )}
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px" }}>{children}</div>
  </div>
);

// ─── Sub-Views ────────────────────────────────────────────────────────────────

const HomeView = ({ navigate, t }) => (
  <div style={{ textAlign: "center", padding: "40px 0" }}>
    <h1 style={{ fontSize: 36, fontWeight: 900, color: "#111827", marginBottom: 12 }}>{t('welcome')}</h1>
    <p style={{ fontSize: 18, color: "#4B5563", marginBottom: 32, maxWidth: 600, margin: "0 auto 32px" }}>{t('welcome_subtitle')}</p>
    <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
      <Btn style={{ padding: "14px 28px", fontSize: 16 }} onClick={() => navigate("submit")}>{t('submit_grievance')}</Btn>
      <Btn variant="outline" style={{ padding: "14px 28px", fontSize: 16 }} onClick={() => navigate("track")}>{t('track_status')}</Btn>
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
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 0.9, textTransform: "uppercase" }}>
          {t('pin_location')}
        </label>
        <button type="button" onClick={handleGetLocation} style={{ background: "#F3F4F6", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#047857", cursor: "pointer" }}>
          📍 {t('use_current_location')}
        </button>
      </div>
      <div style={{ height: 250, borderRadius: 12, overflow: "hidden", border: "1.5px solid #E5E7EB" }}>
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
      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{t('drag_pin_hint')}</p>
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
      
      const { data, error } = await supabase.from("complaints").insert([{
        citizen_id: session.user.id,
        ticket_id: ticketId,
        title: form.title,
        description: fullDescription,
        category: form.categories.join(", "),
        location: form.location,
        latitude: form.latitude,
        longitude: form.longitude,
        status: "Open"
      }]).select().single();

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
    <div style={{ background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800 }}>{t('register_grievance')}</h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "4px 10px", borderRadius: 12 }}>Step {step} of 2</span>
      </div>
      
      {step === 1 ? (
        <div>
          <label style={{ display: "block", marginBottom: 12, fontSize: 13, fontWeight: 700, color: "#374151" }}>Select Problem Categories (Multiple allowed)</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
            {CATEGORIES.map(c => {
              const isSelected = form.categories.includes(c.id);
              return (
                <div key={c.id} onClick={() => toggleCategory(c.id)}
                     style={{ padding: 10, borderRadius: 10, border: `1.5px solid ${isSelected ? "#047857" : "#E5E7EB"}`, background: isSelected ? "#F0FDF4" : "#fff", cursor: "pointer", textAlign: "center", transition: "0.2s" }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
                  <div style={{ fontSize: 9, fontWeight: 700 }}>{t(c.key)}</div>
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
          <div style={{ marginBottom: 20, padding: 12, background: "#F0FDF4", borderRadius: 8, fontSize: 12, color: "#047857", fontWeight: 700 }}>
            Selected: {form.categories.join(", ")}
          </div>
          
          <Input label={t("complaint_title")} placeholder="e.g. Broken Water Pipe" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <Textarea label={t("description")} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
          
          {/* Extra Questions */}
          <div style={{ background: "#FAFAFA", padding: 16, borderRadius: 12, border: "1px solid #E5E7EB", marginBottom: 18 }}>
            <label style={{ display: "block", marginBottom: 12, fontSize: 11, fontWeight: 700, color: "#6B7280", letterSpacing: 0.9, textTransform: "uppercase" }}>Additional Details</label>
            
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>How long has this problem existed?</label>
              <select value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", outline: "none", fontFamily: SANS }}>
                <option value="Just started">Just started (today/yesterday)</option>
                <option value="1-3 days">1 to 3 days</option>
                <option value="Over a week">Over a week</option>
                <option value="Persistent/Long-term">Persistent / Long-term</option>
              </select>
            </div>
            
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Estimated number of people affected</label>
              <input type="number" value={form.peopleAffected} onChange={e => setForm({...form, peopleAffected: e.target.value})} placeholder="e.g. 50" style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #E5E7EB", outline: "none", fontFamily: SANS, boxSizing: "border-box" }} />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: form.isEmergency ? "#DC2626" : "#374151" }}>
              <input type="checkbox" checked={form.isEmergency} onChange={e => setForm({...form, isEmergency: e.target.checked})} style={{ width: 16, height: 16 }} />
              Is this an emergency?
            </label>
          </div>

          <LocationPicker t={t} initialCoords={[form.latitude, form.longitude]} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          
          <Input label={t("location_landmark")} placeholder="e.g. Near Village School" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
          <PhotoUpload photos={photos} setPhotos={setPhotos} />
          
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <Btn variant="ghost" type="button" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</Btn>
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

  if (!session) return <div style={{ textAlign: "center", padding: 40, fontFamily: SANS, fontWeight: 700 }}>{t("login_to_track")}</div>;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>{t("your_grievances")}</h2>
      {loading ? <div>{t("loading")}</div> : items.length === 0 ? <div style={{ textAlign: "center", padding: 40, background: "#fff", borderRadius: 16 }}>{t("no_complaints")}</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map(it => (
            <div key={it.id} style={{ background: "#fff", padding: 20, borderRadius: 16, border: "1px solid #E5E7EB" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>#{it.id.slice(0, 8)} • {t(CATEGORIES.find(c => c.id === it.category)?.key || "cat_other")}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>{it.title}</h3>
                </div>
                <Badge status={it.status} priority={it.priority} />
              </div>
              <p style={{ fontSize: 14, color: "#4B5563", marginBottom: 16 }}>{it.description}</p>
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

  if (!session || !profile) return <div style={{ textAlign: "center", padding: 40, fontFamily: SANS, fontWeight: 700 }}>{t("login_to_track")}</div>;

  return (
    <div style={{ background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>My Account</h2>
      
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, background: "#F0FDF4", color: "#047857", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
            {profile.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{profile.name || "User"}</h3>
            <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 14 }}>{session.user.email || profile.phone}</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Total Grievances Submitted</h4>
            <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>Number of issues you have reported.</p>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#047857" }}>
            {loading ? "..." : count}
          </div>
        </div>
      </div>

      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: 20 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: "#991B1B", margin: "0 0 8px" }}>Account Security</h4>
        <p style={{ fontSize: 13, color: "#991B1B", margin: 0, lineHeight: 1.5 }}>
          Your account is securely authenticated via <strong>{session.user.app_metadata.provider === 'google' ? 'Google' : 'Phone OTP'}</strong>.
          No local password is required or stored in our system.
        </p>
      </div>
    </div>
  );
};

const GovLinksView = () => {
  const links = [
    { title: "CPGRAMS", desc: "Centralized Public Grievance Redress and Monitoring System for submitting grievances directly to the Govt of India.", url: "https://pgportal.gov.in/" },
    { title: "MyGov", desc: "Citizen engagement platform for participatory governance.", url: "https://www.mygov.in/" },
    { title: "National Portal of India", desc: "Single-window access to information and services provided by the Indian Government.", url: "https://www.india.gov.in/" },
    { title: "RTI Online", desc: "Portal to file RTI applications online.", url: "https://rtionline.gov.in/" }
  ];

  return (
    <div style={{ background: "#fff", padding: 32, borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Official Government Resources</h2>
      <p style={{ color: "#6B7280", marginBottom: 24 }}>Explore these official portals for further assistance or to submit grievances at a national level.</p>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {links.map((link, i) => (
          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ padding: 20, borderRadius: 12, border: "1px solid #E5E7EB", background: "#FAFAFA", transition: "all 0.2s", cursor: "pointer", height: "100%", boxSizing: "border-box" }}
                 onMouseOver={e => e.currentTarget.style.borderColor = "#047857"}
                 onMouseOut={e => e.currentTarget.style.borderColor = "#E5E7EB"}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#047857", marginBottom: 8 }}>{link.title} ↗</h3>
              <p style={{ fontSize: 13, color: "#4B5563", margin: 0, lineHeight: 1.5 }}>{link.desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

const AdminView = ({ t, notify, session, profile, t_officer }) => {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

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
      notify("Updated successfully");
      fetchData();
      if (selected?.id === id) setSelected({ ...selected, ...updates });
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 24, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 26, fontWeight: 900 }}>{t_officer ? t("officer_dashboard") : t("admin_dashboard")}</h2>
          <Btn variant="ghost" onClick={fetchData}>🔄 {t("refresh")}</Btn>
        </div>

        {loading ? <div>{t("loading")}</div> : list.length === 0 ? (
          <div style={{ background: "#fff", padding: 40, textAlign: "center", borderRadius: 16 }}>{t("no_complaints")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(it => (
              <div key={it.id} onClick={() => setSelected(it)}
                   style={{ background: "#fff", padding: 18, borderRadius: 16, border: `2px solid ${selected?.id === it.id ? "#047857" : "transparent"}`, cursor: "pointer", transition: "0.2s", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", letterSpacing: 0.5 }}>#{it.id.slice(0, 8)} • {it.category}</div>
                  <Badge status={it.status} priority={it.priority} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{it.title}</h3>
                <div style={{ fontSize: 13, color: "#4B5563" }}>📍 {it.location}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 10 }}>{t("submitted_by")} {it.phone} on {new Date(it.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ background: "#fff", padding: 24, borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", position: "sticky", top: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <h3 style={{ fontSize: 20, fontWeight: 900 }}>{t("complaint_title")}</h3>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase" }}>{t("description")}</label>
            <p style={{ fontSize: 14, color: "#374151", marginTop: 4, lineHeight: 1.5 }}>{selected.description}</p>
            {selected.is_escalated && (
              <div style={{ marginTop: 12, padding: 12, background: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: 10, color: "#991B1B", fontSize: 12, fontWeight: 700 }}>
                {t("escalation_warning")}
              </div>
            )}
          </div>

          {selected.photos?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase" }}>{t("evidence_photos")}</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                {selected.photos.map((p, i) => (
                  <img key={i} src={p.url} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB" }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: "1.5px solid #F3F4F6", paddingTop: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#374151", display: "block", marginBottom: 12 }}>{t("management_controls")}</label>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: "#6B7280" }}>Change Status</label>
              <select value={selected.status} onChange={e => updateGrievance(selected.id, { status: e.target.value })}
                      style={{ width: "100%", marginTop: 6, padding: "10px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontFamily: SANS, fontWeight: 700 }}>
                {STATUS_FLOW.map(s => {
                  const sKey = `status_${s.toLowerCase().replace(" ", "_")}`;
                  return <option key={s} value={s}>{t(sKey)}</option>;
                })}
              </select>
            </div>

            {!t_officer && (
              <div>
                <label style={{ fontSize: 10, color: "#6B7280" }}>Assign Officer</label>
                <select value={selected.assigned_officer_id || ""} onChange={e => updateGrievance(selected.id, { assigned_officer_id: e.target.value, status: selected.status === "Open" ? "Assigned" : selected.status })}
                        style={{ width: "100%", marginTop: 6, padding: "10px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontFamily: SANS, fontWeight: 700 }}>
                  <option value="">-- Select Officer --</option>
                  {officers.map(o => <option key={o.id} value={o.id}>{o.name} ({o.phone})</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
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
      <div style={{ background: "#fff", padding: 32, borderRadius: 24, width: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>👋</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>{t('profile_setup_title')}</h2>
        <p style={{ color: "#6B7280", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Please tell us your name to complete your registration.</p>
        
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
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleSendOtp = async () => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }
    
    if (cleanPhone.length !== 10) return notify("Enter exactly 10 digits", "err");
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: `+91${cleanPhone}` });
      if (error) throw error;
      setStep(2);
      setTimer(30);
      notify("OTP sent successfully");
    } catch (err) {
      notify(err.message, "err");
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (otp.length < 6) return notify("Enter 6-digit OTP", "err");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ 
        phone: `+91${cleanPhone}`, 
        token: otp, 
        type: 'sms' 
      });
      if (error) throw error;
      if (data.session) onLogin(data.session);
    } catch (err) {
      notify(err.message, "err");
    }
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(2px)" }}>
      <div style={{ background: "#fff", padding: 32, borderRadius: 24, width: 360, boxShadow: "0 10px 40px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{step === 1 ? t('login_title') : t('verify_otp')}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>

        {step === 1 && (
          <div style={{ marginBottom: 24 }}>
            <Btn full variant="outline" onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  queryParams: {
                    prompt: 'select_account',
                  },
                },
              });
              if (error) notify(error.message, "err");
            }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#374151", borderColor: "#E5E7EB" }}>
              <img src="https://www.google.com/favicon.ico" style={{ width: 16, height: 16 }} alt="Google" />
              Continue with Google
            </Btn>
            <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>or</div>
              <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            </div>
          </div>
        )}

        {step === 1 ? (
          <>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{t('phone_placeholder')}</p>
            <Input 
              label={t('phone_label')} 
              prefix="+91"
              placeholder="00000 00000" 
              value={phone} 
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <Btn full onClick={handleSendOtp} disabled={loading} style={{ marginTop: 8 }}>
              {loading ? t('loading') : t('send_otp')}
            </Btn>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              Sent to <span style={{ fontWeight: 700, color: "#111827" }}>+91 {phone}</span>
              <button onClick={() => setStep(1)} style={{ marginLeft: 8, color: "#047857", border: "none", background: "none", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Edit</button>
            </p>
            <Input 
              label={t('enter_otp')} 
              placeholder="000000" 
              value={otp} 
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            <Btn full onClick={handleVerify} disabled={loading} style={{ marginTop: 8 }}>
              {loading ? t('loading') : t('verify_otp')}
            </Btn>
            <div style={{ textAlign: "center", marginTop: 20 }}>
              {timer > 0 ? (
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{t('resend_in', { seconds: timer })}</span>
              ) : (
                <button onClick={handleSendOtp} style={{ background: "none", border: "none", color: "#047857", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>{t('resend_btn')}</button>
              )}
            </div>
          </>
        )}
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
      if (error) throw error;
      if (data) { 
        setProfile(data); 
        setRole(data.role); 
        if (!data.name) setShowProfileSetup(true);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    notify("Logged out successfully");
    navigate("home");
  };

  const shared = { t, notify, navigate, session, profile, role, i18n };

  const renderContent = () => {
    // RBAC: Redirect to appropriate dashboard
    if (role === "admin") return <AdminView {...shared} />;
    if (role === "officer") return <AdminView {...shared} t_officer />; 
    
    switch(view) {
      case "submit": return <SubmitView {...shared} />;
      case "track":  return <TrackView {...shared} />;
      case "profile": return <ProfileView {...shared} />;
      case "gov-links": return <GovLinksView />;
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
