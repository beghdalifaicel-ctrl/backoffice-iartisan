"use client";

import { useState, useEffect } from "react";
import { Home, FileText, User, Bot, LogOut, TrendingUp, ArrowUpRight, ArrowDownRight, Phone, Clock, CheckCircle, Star, CreditCard, Edit, Save, Zap, Activity, AlertTriangle, CalendarDays, Wrench, Play, Search, Mail, MessageSquare, Globe, BarChart3, FileEdit, Send, RefreshCw, Loader2, ChevronRight, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
  red: "#dc2626", blue: "#2563eb",
};

const PLAN_LABELS: Record<string, string> = { ESSENTIEL: "Essentiel", CROISSANCE: "Pro", PILOTE_AUTO: "Max" };
const PLAN_PRICES: Record<string, number> = { ESSENTIEL: 49, CROISSANCE: 99, PILOTE_AUTO: 179 };
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Nouveau", color: C.blue },
  CONTACTED: { label: "Contacté", color: C.accent },
  RDV_BOOKED: { label: "RDV pris", color: C.yellow },
  WON: { label: "Gagné", color: C.green },
  LOST: { label: "Perdu", color: C.red },
};
const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads", GOOGLE_BUSINESS: "Google Business", SITE_VITRINE: "Site Vitrine", FORM: "Formulaire", WHATSAPP: "WhatsApp",
};
const AGENT_TYPE_LABELS: Record<string, string> = {
  COMMERCIAL: "Commercial", MARKETING: "Marketing", ADMIN: "Admin",
};
const TASK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: "Terminé", color: C.green },
  FAILED: { label: "Échoué", color: C.red },
  PENDING: { label: "En attente", color: C.yellow },
  PROCESSING: { label: "En cours", color: C.blue },
};
// ─── OUTILS AGENTS ───────────────────────────────────────────────────────────
type ToolDef = {
  taskType: string;
  agentType: string;
  label: string;
  desc: string;
  icon: any;
  fields?: { key: string; label: string; placeholder: string; type?: string; options?: { value: string; label: string }[] }[];
};

const AGENT_TOOLS: ToolDef[] = [
  // ADMIN
  { taskType: "email.read", agentType: "ADMIN", label: "Lire les emails", desc: "Résumé des emails non lus", icon: Mail, fields: [] },
  { taskType: "quote.generate", agentType: "ADMIN", label: "Générer un devis", desc: "Crée un devis professionnel", icon: FileEdit, fields: [
    { key: "clientName", label: "Nom du client", placeholder: "Ex: Dr. Martin" },
    { key: "description", label: "Description", placeholder: "Ex: Pose de 3 implants" },
    { key: "amount", label: "Montant HT (€)", placeholder: "1500", type: "number" },
  ]},
  { taskType: "invoice.generate", agentType: "ADMIN", label: "Générer une facture", desc: "Crée une facture à partir d'un devis", icon: FileText, fields: [
    { key: "clientName", label: "Nom du client", placeholder: "Ex: Dr. Martin" },
    { key: "description", label: "Description", placeholder: "Prestation réalisée" },
    { key: "amount", label: "Montant HT (€)", placeholder: "1500", type: "number" },
  ]},
  { taskType: "client.followup", agentType: "ADMIN", label: "Relance client", desc: "Envoie une relance personnalisée", icon: Send, fields: [
    { key: "type", label: "Type de relance", placeholder: "", options: [
      { value: "devis_pending", label: "Devis en attente" },
      { value: "rdv_reminder", label: "Rappel de RDV" },
      { value: "satisfaction", label: "Enquête satisfaction" },
      { value: "payment_reminder", label: "Rappel de paiement" },
    ]},
  ]},
  // MARKETING
  { taskType: "gbp.optimize", agentType: "MARKETING", label: "Audit Google Business", desc: "Analyse et optimise votre fiche GBP", icon: Search, fields: [] },
  { taskType: "gbp.post", agentType: "MARKETING", label: "Post Google Business", desc: "Crée un post pour votre fiche GBP", icon: Globe, fields: [
    { key: "type", label: "Type de post", placeholder: "", options: [
      { value: "update", label: "Actualité" },
      { value: "offer", label: "Offre / Promo" },
      { value: "event", label: "Événement" },
    ]},
    { key: "topic", label: "Sujet", placeholder: "Ex: Nouveau service blanchiment" },
  ]},
  { taskType: "review.respond", agentType: "MARKETING", label: "Répondre à un avis", desc: "Rédige une réponse professionnelle", icon: MessageSquare, fields: [
    { key: "reviewerName", label: "Auteur de l'avis", placeholder: "Jean D." },
    { key: "rating", label: "Note (1-5)", placeholder: "4", type: "number" },
    { key: "reviewText", label: "Texte de l'avis", placeholder: "Très bon accueil, je recommande..." },
  ]},
  { taskType: "seo.audit", agentType: "MARKETING", label: "Audit SEO local", desc: "Analyse votre référencement local", icon: BarChart3, fields: [] },
  { taskType: "social.post", agentType: "MARKETING", label: "Post réseaux sociaux", desc: "Crée un post Facebook, Instagram ou LinkedIn", icon: Globe, fields: [
    { key: "platform", label: "Réseau", placeholder: "", options: [
      { value: "facebook", label: "Facebook" },
      { value: "instagram", label: "Instagram" },
      { value: "linkedin", label: "LinkedIn" },
    ]},
    { key: "topic", label: "Sujet", placeholder: "Ex: Journée mondiale du sourire" },
  ]},
  // COMMERCIAL
  { taskType: "lead.scrape", agentType: "COMMERCIAL", label: "Trouver des prospects", desc: "Scrape annuaires pour trouver de nouveaux leads", icon: Search, fields: [
    { key: "sector", label: "Secteur", placeholder: "Ex: dentiste, plombier" },
    { key: "city", label: "Ville", placeholder: "Ex: Lyon" },
  ]},
  { taskType: "prospect.email", agentType: "COMMERCIAL", label: "Email de prospection", desc: "Envoie un email de prospection personnalisé", icon: Send, fields: [
    { key: "sector", label: "Secteur cible", placeholder: "Ex: dentiste" },
    { key: "angle", label: "Angle d'approche", placeholder: "Ex: visibilité Google" },
  ]},
  { taskType: "directory.enroll", agentType: "COMMERCIAL", label: "Inscription annuaire", desc: "Prépare votre inscription sur un annuaire pro", icon: Globe, fields: [
    { key: "directoryName", label: "Nom de l'annuaire", placeholder: "Ex: PagesJaunes" },
  ]},
];

const PLAN_AGENT_ACCESS: Record<string, string[]> = {
  ESSENTIEL: ["ADMIN"],
  CROISSANCE: ["ADMIN", "MARKETING"],
  PILOTE_AUTO: ["ADMIN", "MARKETING", "COMMERCIAL"],
};

const AGENT_TYPE_COLORS: Record<string, string> = {
  ADMIN: "#2563eb",
  MARKETING: "#2d6a4f",
  COMMERCIAL: "#ff5c00",
};

const SUB_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: C.green },
  trialing: { label: "Essai gratuit", color: C.blue },
  past_due: { label: "Impayé", color: C.red },
  canceled: { label: "Annulé", color: C.muted },
  incomplete: { label: "Incomplet", color: C.yellow },
};

type DashboardData = {
  client: any;
  leads: { thisMonth: number; lastMonth: number; total: number; byStatus: Record<string, number>; conversionRate: number };
  leadsChart: { month: string; leads: number; won: number }[];
  subscription: { status: string; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; trialEnd: string | null } | null;
  upcomingInvoice: { amount: number; date: string | null } | null;
  invoices: any[];
} | null;

type AgentsData = {
  agents: { name: string; type: string; desc: string; active: boolean }[];
  activity: any[];
  recentTasks: any[];
  agentTaskStats: { total: number; completed: number; failed: number; pending: number };
  agentUsage: any;
  stats: { totalLeads: number; bySource: Record<string, number>; googleRating: number | null; googleReviewCount: number | null; avisCount: number };
} | null;

export default function ClientDashboard() {
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState<DashboardData>(null);
  const [agents, setAgents] = useState<AgentsData>(null);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Outils Agents state
  const [selectedTool, setSelectedTool] = useState<ToolDef | null>(null);
  const [toolFormData, setToolFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [taskResult, setTaskResult] = useState<{ id: string; status: string } | null>(null);
  const [toolsHistory, setToolsHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/client/dashboard").then(r => r.ok ? r.json() : null),
      fetch("/api/client/agents").then(r => r.ok ? r.json() : null),
      fetch("/api/client/invoices").then(r => r.ok ? r.json() : { invoices: [] }),
      fetch("/api/client/profile").then(r => r.ok ? r.json() : null),
    ]).then(([d, a, inv, p]) => {
      setData(d);
      setAgents(a);
      setAllInvoices(inv.invoices || []);
      setProfile(p);
      if (p) setEditData(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/client/auth/logout", { method: "POST" });
    window.location.href = "/client/login";
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (res.ok) {
        const { client: updated } = await res.json();
        setProfile({ ...profile, ...updated });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Fetch tools history when switching to outils ───
  useEffect(() => {
    if (page === "outils") {
      setHistoryLoading(true);
      fetch("/api/client/agents/tasks?limit=20")
        .then(r => r.ok ? r.json() : { tasks: [] })
        .then(d => { setToolsHistory(d.tasks || []); setHistoryLoading(false); })
        .catch(() => setHistoryLoading(false));
    }
  }, [page]);

  const handleToolSubmit = async (tool: ToolDef) => {
    setSubmitting(true);
    setTaskResult(null);
    try {
      const res = await fetch("/api/client/agents/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentType: tool.agentType,
          taskType: tool.taskType,
          payload: toolFormData,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setTaskResult({ id: json.taskId, status: "PENDING" });
        setSelectedTool(null);
        setToolFormData({});
        // Refresh history
        const hRes = await fetch("/api/client/agents/tasks?limit=20");
        if (hRes.ok) { const hData = await hRes.json(); setToolsHistory(hData.tasks || []); }
      } else {
        setTaskResult({ id: "", status: json.error || "Erreur" });
      }
    } catch {
      setTaskResult({ id: "", status: "Erreur réseau" });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

  const navItems = [
    { id: "dashboard", label: "Accueil", icon: Home },
    { id: "outils", label: "Outils", icon: Wrench },
    { id: "factures", label: "Factures", icon: FileText },
    { id: "profil", label: "Profil", icon: User },
    { id: "agents", label: "Agents", icon: Bot },
  ];

  if (loading) {
    return (
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>iA</div>
        <div style={{ color: C.muted, fontSize: 14 }}>Chargement de votre espace...</div>
      </div>
    );
  }

  const client = data?.client;
  const plan = client?.plan || "ESSENTIEL";

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100vh", color: C.dark, fontSize: 14, maxWidth: 520, margin: "0 auto", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ paddingBottom: 80 }}>
        {/* ─── HEADER ──────────────────────────────────────── */}
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>iA</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Bonjour {client?.firstName || ""}!</div>
              <div style={{ fontSize: 12, color: C.muted }}>{client?.company} &middot; {PLAN_LABELS[plan]}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 8 }}>
            <LogOut size={20} />
          </button>
        </div>

        {/* ─── CONTENT ──────────────────────────────────────── */}
        <div style={{ padding: 16 }}>

          {/* ═══ DASHBOARD ═══ */}
          {page === "dashboard" && data && (
            <>
              {/* Plan + Stripe card */}
              <div style={{ background: C.dark, borderRadius: 14, padding: "18px 20px", marginBottom: 16, color: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>Votre plan</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{PLAN_LABELS[plan]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{PLAN_PRICES[plan]}€<span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6 }}>/mois</span></div>
                  </div>
                </div>

                {/* Stripe subscription status */}
                {data.subscription && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, fontWeight: 600, background: `${SUB_STATUS_MAP[data.subscription.status]?.color || C.muted}30`, color: SUB_STATUS_MAP[data.subscription.status]?.color || "#fff" }}>
                      {SUB_STATUS_MAP[data.subscription.status]?.label || data.subscription.status}
                    </span>
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.1)" }}>
                      <CalendarDays size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
                      Période : {fmtDate(data.subscription.currentPeriodStart)} → {fmtDate(data.subscription.currentPeriodEnd)}
                    </span>
                  </div>
                )}

                {/* Trial info */}
                {client?.status === "TRIAL" && client?.trialEndsAt && (
                  <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 8 }}>
                    <Clock size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    Essai gratuit jusqu&apos;au {fmtDate(client.trialEndsAt)}
                  </div>
                )}

                {/* Upcoming invoice */}
                {data.upcomingInvoice && (
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <CreditCard size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    Prochaine facture : {(data.upcomingInvoice.amount / 100).toFixed(2)}€
                    {data.upcomingInvoice.date && ` le ${fmtDate(data.upcomingInvoice.date)}`}
                  </div>
                )}
              </div>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Leads ce mois", value: data.leads.thisMonth, prev: data.leads.lastMonth, icon: TrendingUp },
                  { label: "Leads total", value: data.leads.total, icon: Phone },
                  { label: "Taux conversion", value: `${data.leads.conversionRate}%`, icon: CheckCircle },
                  { label: "Note Google", value: client?.googleRating ? `${client.googleRating}/5` : "N/A", icon: Star },
                ].map((kpi, i) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</span>
                      <kpi.icon size={14} color={C.muted} />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{kpi.value}</div>
                    {"prev" in kpi && typeof kpi.prev === "number" && (
                      <div style={{ fontSize: 11, color: (kpi.value as number) >= kpi.prev ? C.green : C.red, display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                        {(kpi.value as number) >= kpi.prev ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        vs {kpi.prev} mois dernier
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Leads chart */}
              {data.leadsChart && data.leadsChart.length > 0 && (
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 16px 8px", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Évolution des leads</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={data.leadsChart}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        formatter={(val: number, name: string) => [val, name === "leads" ? "Leads" : "Gagnés"]}
                      />
                      <Area type="monotone" dataKey="leads" stroke={C.accent} fill="url(#colorLeads)" strokeWidth={2} />
                      <Area type="monotone" dataKey="won" stroke={C.green} fill="url(#colorWon)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Lead status breakdown */}
              {Object.keys(data.leads.byStatus).length > 0 && (
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Pipeline leads</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {Object.entries(data.leads.byStatus).map(([status, count]) => {
                      const total = data.leads.total || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={status} style={{ flex: pct, minWidth: 30 }}>
                          <div style={{ height: 8, borderRadius: 4, background: STATUS_LABELS[status]?.color || C.muted, marginBottom: 6 }} />
                          <div style={{ fontSize: 10, color: C.muted, textAlign: "center" }}>{STATUS_LABELS[status]?.label}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, textAlign: "center" }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Leads récents */}
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>Derniers leads</div>
                {!agents?.activity?.length ? (
                  <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucun lead pour le moment</div>
                ) : (
                  agents.activity.slice(0, 5).map((lead: any) => (
                    <div key={lead.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{lead.name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{lead.type} &middot; {SOURCE_LABELS[lead.source] || lead.source}</div>
                      </div>
                      <span style={{ fontSize: 11, background: `${(STATUS_LABELS[lead.status]?.color || C.muted)}15`, color: STATUS_LABELS[lead.status]?.color || C.muted, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {STATUS_LABELS[lead.status]?.label || lead.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ═══ FACTURES ═══ */}
          {page === "factures" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, marginTop: 0 }}>Factures & Abonnement</h2>

              {/* Abonnement actuel */}
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>Plan actuel</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{PLAN_LABELS[plan]} &mdash; {PLAN_PRICES[plan]}€/mois</div>
                  </div>
                  <CreditCard size={20} color={C.accent} />
                </div>
                {data?.subscription && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
                    Renouvellement le {fmtDate(data.subscription.currentPeriodEnd)}
                    {data.subscription.cancelAtPeriodEnd && (
                      <span style={{ color: C.red, fontWeight: 600 }}> (annulation prévue)</span>
                    )}
                  </div>
                )}
              </div>

              {/* Liste des factures */}
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>Historique</div>
                {allInvoices.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucune facture pour le moment</div>
                ) : (
                  allInvoices.map((inv: any) => (
                    <div key={inv.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{inv.number}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(inv.createdAt)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 700 }}>{(inv.amount / 100).toFixed(2)}€</span>
                        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, fontWeight: 600, background: inv.status === "PAID" ? `${C.green}15` : `${C.red}15`, color: inv.status === "PAID" ? C.green : C.red }}>
                          {inv.status === "PAID" ? "Payée" : inv.status === "PENDING" ? "En attente" : inv.status}
                        </span>
                        {inv.stripePaymentUrl && inv.status !== "PAID" && (
                          <a href={inv.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontSize: 12, textDecoration: "none", fontWeight: 600 }}>Payer</a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {/* ═══ PROFIL ═══ */}
          {page === "profil" && profile && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Mon profil</h2>
                {!editing ? (
                  <button onClick={() => { setEditing(true); setEditData(profile); }} style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.dark }}>
                    <Edit size={14} /> Modifier
                  </button>
                ) : (
                  <button onClick={handleSaveProfile} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, background: C.accent, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff" }}>
                    <Save size={14} /> {saving ? "..." : "Enregistrer"}
                  </button>
                )}
              </div>

              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                {[
                  { label: "Prénom", key: "firstName" },
                  { label: "Nom", key: "lastName" },
                  { label: "Email", key: "email", readonly: true },
                  { label: "Téléphone", key: "phone" },
                  { label: "Entreprise", key: "company" },
                  { label: "Métier", key: "metier" },
                  { label: "SIRET", key: "siret" },
                  { label: "Ville", key: "ville" },
                  { label: "Code postal", key: "codePostal" },
                  { label: "Adresse", key: "adresse" },
                  { label: "Google Business", key: "googleBusinessUrl" },
                ].map((field) => (
                  <div key={field.key} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, minWidth: 100 }}>{field.label}</div>
                    {editing && !field.readonly ? (
                      <input
                        value={editData[field.key] || ""}
                        onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                        style={{ flex: 1, textAlign: "right", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", outline: "none", background: C.bg }}
                      />
                    ) : (
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{profile[field.key] || "—"}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ═══ OUTILS AGENTS ═══ */}
          {page === "outils" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, marginTop: 0 }}>Outils agents</h2>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Lancez des actions via vos agents IA</p>

              {/* Success/Error banner */}
              {taskResult && (
                <div style={{ background: taskResult.id ? `${C.green}12` : `${C.red}12`, border: `1px solid ${taskResult.id ? C.green : C.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: taskResult.id ? C.green : C.red, fontWeight: 600 }}>
                    {taskResult.id ? `Tâche soumise (#${taskResult.id.slice(0, 8)})` : taskResult.status}
                  </div>
                  <button onClick={() => setTaskResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 2 }}><X size={14} /></button>
                </div>
              )}

              {/* Tool cards grouped by agent type */}
              {(["ADMIN", "MARKETING", "COMMERCIAL"] as const).map(agentType => {
                const allowed = PLAN_AGENT_ACCESS[plan] || PLAN_AGENT_ACCESS.ESSENTIEL;
                if (!allowed.includes(agentType)) return null;
                const tools = AGENT_TOOLS.filter(t => t.agentType === agentType);
                if (tools.length === 0) return null;
                const color = AGENT_TYPE_COLORS[agentType] || C.dark;
                return (
                  <div key={agentType} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>{AGENT_TYPE_LABELS[agentType] || agentType}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {tools.map(tool => (
                        <button
                          key={tool.taskType}
                          onClick={() => {
                            if (tool.fields && tool.fields.length > 0) {
                              setSelectedTool(tool);
                              setToolFormData({});
                              setTaskResult(null);
                            } else {
                              handleToolSubmit(tool);
                            }
                          }}
                          disabled={submitting}
                          style={{ background: C.surface, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "'Bricolage Grotesque', sans-serif", opacity: submitting ? 0.6 : 1 }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <tool.icon size={16} color={color} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{tool.label}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{tool.desc}</div>
                          </div>
                          {tool.fields && tool.fields.length > 0 ? (
                            <ChevronRight size={16} color={C.muted} />
                          ) : (
                            <Play size={14} color={color} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Locked agents upsell */}
              {(() => {
                const allowed = PLAN_AGENT_ACCESS[plan] || PLAN_AGENT_ACCESS.ESSENTIEL;
                const locked = (["ADMIN", "MARKETING", "COMMERCIAL"] as const).filter(a => !allowed.includes(a));
                if (locked.length === 0) return null;
                return (
                  <div style={{ background: `${C.muted}08`, borderRadius: 12, border: `1px dashed ${C.border}`, padding: "14px 16px", marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Débloquez plus d'outils</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                      Les agents {locked.map(a => AGENT_TYPE_LABELS[a]).join(" et ")} sont disponibles avec un plan supérieur.
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, cursor: "pointer" }} onClick={() => setPage("profil")}>
                      Voir les plans →
                    </div>
                  </div>
                );
              })()}

              {/* Recent tasks history */}
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Historique des tâches</span>
                  <button onClick={() => { setHistoryLoading(true); fetch("/api/client/agents/tasks?limit=20").then(r => r.ok ? r.json() : { tasks: [] }).then(d => { setToolsHistory(d.tasks || []); setHistoryLoading(false); }).catch(() => setHistoryLoading(false)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <RefreshCw size={14} color={C.muted} className={historyLoading ? "spin" : ""} />
                  </button>
                </div>
                {historyLoading ? (
                  <div style={{ padding: 24, textAlign: "center" }}><Loader2 size={18} color={C.muted} /></div>
                ) : toolsHistory.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucune tâche pour le moment</div>
                ) : (
                  toolsHistory.map((task: any) => (
                    <div key={task.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{AGENT_TOOLS.find(t => t.taskType === task.taskType)?.label || task.taskType}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {AGENT_TYPE_LABELS[task.agentType] || task.agentType} &middot; {fmtDate(task.createdAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: `${(TASK_STATUS_LABELS[task.status]?.color || C.muted)}15`, color: TASK_STATUS_LABELS[task.status]?.color || C.muted, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {TASK_STATUS_LABELS[task.status]?.label || task.status}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* ─── TOOL FORM MODAL ─── */}
              {selectedTool && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) { setSelectedTool(null); setToolFormData({}); } }}>
                  <div style={{ background: C.bg, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto", padding: "20px 16px calc(20px + env(safe-area-inset-bottom))" }}>
                    {/* Modal header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${AGENT_TYPE_COLORS[selectedTool.agentType]}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <selectedTool.icon size={16} color={AGENT_TYPE_COLORS[selectedTool.agentType]} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedTool.label}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{selectedTool.desc}</div>
                        </div>
                      </div>
                      <button onClick={() => { setSelectedTool(null); setToolFormData({}); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={18} color={C.muted} /></button>
                    </div>

                    {/* Form fields */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                      {(selectedTool.fields || []).map(field => (
                        <div key={field.key}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>{field.label}</label>
                          {field.options ? (
                            <select
                              value={toolFormData[field.key] || ""}
                              onChange={(e) => setToolFormData({ ...toolFormData, [field.key]: e.target.value })}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", color: C.dark, appearance: "none" }}
                            >
                              <option value="">Choisir...</option>
                              {field.options.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type || "text"}
                              placeholder={field.placeholder}
                              value={toolFormData[field.key] || ""}
                              onChange={(e) => setToolFormData({ ...toolFormData, [field.key]: e.target.value })}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", color: C.dark, boxSizing: "border-box" }}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Submit button */}
                    <button
                      onClick={() => handleToolSubmit(selectedTool)}
                      disabled={submitting}
                      style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: submitting ? "wait" : "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      {submitting ? <Loader2 size={16} /> : <Play size={16} />}
                      {submitting ? "Envoi en cours..." : "Lancer la tâche"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ AGENTS ═══ */}
          {page === "agents" && agents && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, marginTop: 0 }}>Vos agents IA</h2>

              {/* Agents actifs — cards enrichies */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {agents.agents.map((agent, i) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: agent.type === "COMMERCIAL" ? `${C.accent}15` : `${C.green}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot size={18} color={agent.type === "COMMERCIAL" ? C.accent : C.green} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{agent.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
                      <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>Actif</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Agent task stats */}
              {agents.agentTaskStats.total > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Total", value: agents.agentTaskStats.total, icon: Activity, color: C.dark },
                    { label: "Terminé", value: agents.agentTaskStats.completed, icon: CheckCircle, color: C.green },
                    { label: "En cours", value: agents.agentTaskStats.pending, icon: Zap, color: C.blue },
                    { label: "Échoué", value: agents.agentTaskStats.failed, icon: AlertTriangle, color: C.red },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.surface, borderRadius: 10, padding: "10px 8px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                      <s.icon size={14} color={s.color} style={{ marginBottom: 4 }} />
                      <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Leads stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: C.surface, borderRadius: 12, padding: "14px 12px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{agents.stats.totalLeads}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Leads total</div>
                </div>
                <div style={{ background: C.surface, borderRadius: 12, padding: "14px 12px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{agents.stats.googleRating || "—"}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Note Google</div>
                </div>
                <div style={{ background: C.surface, borderRadius: 12, padding: "14px 12px", border: `1px solid ${C.border}`, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{agents.stats.avisCount}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Avis</div>
                </div>
              </div>

              {/* Sources breakdown */}
              {Object.keys(agents.stats.bySource).length > 0 && (
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>Sources de leads</div>
                  {Object.entries(agents.stats.bySource).map(([source, count]) => {
                    const total = agents.stats.totalLeads || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={source} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13 }}>{SOURCE_LABELS[source] || source}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 60, height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: C.accent }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13, minWidth: 24, textAlign: "right" }}>{count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tâches agents récentes */}
              {agents.recentTasks && agents.recentTasks.length > 0 && (
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>Tâches agents récentes</div>
                  {agents.recentTasks.map((task: any) => (
                    <div key={task.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{task.taskType?.replace(/_/g, " ")}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {AGENT_TYPE_LABELS[task.agentType] || task.agentType} &middot; {fmtDate(task.createdAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: `${(TASK_STATUS_LABELS[task.status]?.color || C.muted)}15`, color: TASK_STATUS_LABELS[task.status]?.color || C.muted, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {TASK_STATUS_LABELS[task.status]?.label || task.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Activité récente (leads) */}
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>Derniers leads</div>
                {agents.activity.length === 0 ? (
                  <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>Aucune activité pour le moment</div>
                ) : (
                  agents.activity.slice(0, 10).map((item: any) => (
                    <div key={item.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {item.type} &middot; {SOURCE_LABELS[item.source] || item.source} &middot; {fmtDate(item.createdAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, background: `${(STATUS_LABELS[item.status]?.color || C.muted)}15`, color: STATUS_LABELS[item.status]?.color || C.muted, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>
                        {STATUS_LABELS[item.status]?.label || item.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── BOTTOM NAV ──────────────────────────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 520, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0 calc(8px + env(safe-area-inset-bottom))", zIndex: 50 }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: page === item.id ? C.accent : C.muted, padding: "4px 12px", fontSize: 10, fontWeight: 600, fontFamily: "'Bricolage Grotesque', sans-serif" }}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
