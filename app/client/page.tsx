"use client";

import { useState, useEffect } from "react";
import { Home, Zap, FileText, User, LogOut, TrendingUp, ArrowUpRight, ArrowDownRight, Phone, Clock, CheckCircle, Star, CreditCard, Edit, Save, Activity, AlertTriangle, CalendarDays, Play, Search, Mail, MessageSquare, Globe, BarChart3, FileEdit, Send, RefreshCw, Loader2, ChevronRight, X, Bell, Shield, ShieldCheck, Rocket, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Eye, Link2, Unlink, QrCode } from "lucide-react";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
  red: "#dc2626", blue: "#2563eb",
};

const PLAN_LABELS: Record<string, string> = { ESSENTIEL: "Essentiel", CROISSANCE: "Pro", PILOTE_AUTO: "Max" };
const PLAN_PRICES: Record<string, number> = { ESSENTIEL: 49, CROISSANCE: 99, PILOTE_AUTO: 179 };

const SUB_STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Actif", color: C.green },
  trialing: { label: "Essai gratuit", color: C.blue },
  past_due: { label: "Impayé", color: C.red },
  canceled: { label: "Annulé", color: C.muted },
  incomplete: { label: "Incomplet", color: C.yellow },
};

// ─── WORDING DÉTECHNICISÉ ────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Nouvelle demande", color: C.blue },
  CONTACTED: { label: "Contacté", color: C.accent },
  RDV_BOOKED: { label: "RDV pris", color: C.yellow },
  WON: { label: "Client gagné", color: C.green },
  LOST: { label: "Perdu", color: C.red },
};
const SOURCE_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads", GOOGLE_BUSINESS: "Google Business", SITE_VITRINE: "Site Vitrine", FORM: "Formulaire", WHATSAPP: "WhatsApp",
};

// Assistant au lieu d'Agent — noms fonctionnels
const ASSISTANT_LABELS: Record<string, { label: string; emoji: string; desc: string; color: string }> = {
  ADMIN: { label: "Assistant Gestion", emoji: "📋", desc: "Devis, factures, relances clients", color: "#2563eb" },
  MARKETING: { label: "Assistant Visibilité", emoji: "📢", desc: "Google, avis, SEO, réseaux sociaux", color: "#2d6a4f" },
  COMMERCIAL: { label: "Assistant Prospection", emoji: "💼", desc: "Nouveaux clients, qualification, relances impayés", color: "#ff5c00" },
};

// Task labels humanisés (français)
const TASK_LABELS: Record<string, string> = {
  "email.read": "Lecture des emails",
  "quote.generate": "Création de devis",
  "invoice.generate": "Création de facture",
  "client.followup": "Relance client",
  "report.weekly": "Rapport hebdomadaire",
  "gbp.optimize": "Audit Google Business",
  "gbp.post": "Publication Google Business",
  "review.respond": "Réponse à un avis",
  "seo.audit": "Audit SEO local",
  "site.update": "Contenu site web",
  "social.post": "Publication réseaux sociaux",
  "lead.scrape": "Recherche de prospects",
  "prospect.email": "Email de prospection",
  "lead.qualify": "Qualification de demande",
  "lead.respond": "Réponse à une demande",
  "invoice.collect": "Relance impayé",
  "directory.enroll": "Inscription annuaire",
};

const TASK_STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  COMPLETED: { label: "Fait ✓", color: C.green, icon: "✅" },
  FAILED: { label: "Problème", color: C.red, icon: "❌" },
  PENDING: { label: "En cours...", color: C.yellow, icon: "⏳" },
  PROCESSING: { label: "En cours...", color: C.blue, icon: "⚙️" },
};

// ─── OUTILS AGENTS — REGROUPÉS PAR BESOIN MÉTIER ─────────────────────────────
type ToolDef = {
  taskType: string;
  agentType: string;
  label: string;
  desc: string;
  icon: any;
  fields?: { key: string; label: string; placeholder: string; type?: string; options?: { value: string; label: string }[] }[];
};

// Groupés par besoin métier au lieu de par type d'agent
const TOOL_CATEGORIES: { id: string; label: string; emoji: string; desc: string; tools: ToolDef[] }[] = [
  {
    id: "clients", label: "Gérer mes clients", emoji: "👥", desc: "Devis, factures, relances",
    tools: [
      { taskType: "invoice.generate", agentType: "ADMIN", label: "Créer une facture", desc: "Facture à partir d'un devis validé", icon: FileText, fields: [
        { key: "clientName", label: "Nom du client", placeholder: "Ex: Pierre Durand" },
        { key: "description", label: "Prestation réalisée", placeholder: "Travaux effectués" },
        { key: "amount", label: "Montant HT (€)", placeholder: "1500", type: "number" },
      ]},
      { taskType: "client.followup", agentType: "ADMIN", label: "Relancer un client", desc: "Envoie une relance personnalisée", icon: Send, fields: [
        { key: "type", label: "Type de relance", placeholder: "", options: [
          { value: "devis_pending", label: "Devis en attente de réponse" },
          { value: "rdv_reminder", label: "Rappel de RDV" },
          { value: "satisfaction", label: "Enquête satisfaction" },
          { value: "payment_reminder", label: "Rappel de paiement" },
        ]},
      ]},
      { taskType: "invoice.collect", agentType: "COMMERCIAL", label: "Relancer un impayé", desc: "Relance de paiement adaptée au niveau", icon: CreditCard, fields: [
        { key: "clientName", label: "Nom du client", placeholder: "Ex: Société Martin" },
        { key: "clientEmail", label: "Email du client", placeholder: "client@email.com" },
        { key: "amount", label: "Montant (€)", placeholder: "1500", type: "number" },
        { key: "relanceLevel", label: "Niveau", placeholder: "", options: [
          { value: "1", label: "Amicale (1re relance)" },
          { value: "2", label: "Ferme (2e relance)" },
          { value: "3", label: "Mise en demeure" },
        ]},
      ]},
      { taskType: "lead.respond", agentType: "COMMERCIAL", label: "Répondre à une demande", desc: "Réponse personnalisée à un prospect", icon: Mail, fields: [
        { key: "leadName", label: "Nom du prospect", placeholder: "Ex: Pierre Durand" },
        { key: "leadEmail", label: "Email", placeholder: "pierre@email.com" },
        { key: "originalMessage", label: "Sa demande", placeholder: "Le message du prospect" },
      ]},
      { taskType: "email.read", agentType: "ADMIN", label: "Lire mes emails", desc: "Résumé des emails non lus", icon: Mail, fields: [] },
      { taskType: "report.weekly", agentType: "ADMIN", label: "Rapport de la semaine", desc: "Résumé de votre activité", icon: BarChart3, fields: [] },
    ],
  },
  {
    id: "visibilite", label: "Être visible sur Google", emoji: "🔍", desc: "Avis, SEO, réseaux sociaux",
    tools: [
      { taskType: "gbp.optimize", agentType: "MARKETING", label: "Audit Google Business", desc: "Analyse et améliore votre fiche", icon: Search, fields: [] },
      { taskType: "gbp.post", agentType: "MARKETING", label: "Publier sur Google", desc: "Actualité, offre ou événement", icon: Globe, fields: [
        { key: "type", label: "Type", placeholder: "", options: [
          { value: "update", label: "Actualité" },
          { value: "offer", label: "Offre / Promo" },
          { value: "event", label: "Événement" },
        ]},
        { key: "topic", label: "Sujet", placeholder: "Ex: Nouveau service" },
      ]},
      { taskType: "review.respond", agentType: "MARKETING", label: "Répondre à un avis", desc: "Réponse pro à un avis Google", icon: MessageSquare, fields: [
        { key: "reviewerName", label: "Auteur de l'avis", placeholder: "Jean D." },
        { key: "rating", label: "Note (1-5)", placeholder: "4", type: "number" },
        { key: "reviewText", label: "Texte de l'avis", placeholder: "Très bon accueil, je recommande..." },
      ]},
      { taskType: "seo.audit", agentType: "MARKETING", label: "Audit SEO local", desc: "Votre référencement local", icon: BarChart3, fields: [] },
      { taskType: "site.update", agentType: "MARKETING", label: "Contenu site web", desc: "Texte optimisé pour votre site", icon: FileEdit, fields: [
        { key: "pageType", label: "Type de page", placeholder: "", options: [
          { value: "home", label: "Accueil" },
          { value: "services", label: "Services" },
          { value: "about", label: "À propos" },
          { value: "blog_post", label: "Article blog" },
        ]},
        { key: "topic", label: "Sujet", placeholder: "Ex: Nos services de rénovation" },
      ]},
      { taskType: "social.post", agentType: "MARKETING", label: "Publier sur les réseaux", desc: "Facebook, Instagram, LinkedIn", icon: Globe, fields: [
        { key: "platform", label: "Réseau", placeholder: "", options: [
          { value: "facebook", label: "Facebook" },
          { value: "instagram", label: "Instagram" },
          { value: "linkedin", label: "LinkedIn" },
        ]},
        { key: "topic", label: "Sujet", placeholder: "Ex: Chantier terminé" },
      ]},
    ],
  },
  {
    id: "prospection", label: "Trouver de nouveaux clients", emoji: "🎯", desc: "Prospection, qualification",
    tools: [
      { taskType: "lead.scrape", agentType: "COMMERCIAL", label: "Chercher des prospects", desc: "Trouve des contacts dans votre zone", icon: Search, fields: [
        { key: "sector", label: "Secteur", placeholder: "Ex: dentiste, plombier" },
        { key: "city", label: "Ville", placeholder: "Ex: Lyon" },
      ]},
      { taskType: "prospect.email", agentType: "COMMERCIAL", label: "Email de prospection", desc: "Email personnalisé pour un prospect", icon: Send, fields: [
        { key: "sector", label: "Secteur cible", placeholder: "Ex: dentiste" },
        { key: "angle", label: "Angle d'approche", placeholder: "Ex: visibilité Google" },
      ]},
      { taskType: "lead.qualify", agentType: "COMMERCIAL", label: "Qualifier une demande", desc: "Analyse et note un prospect", icon: Activity, fields: [
        { key: "leadName", label: "Nom du prospect", placeholder: "Ex: Pierre Durand" },
        { key: "message", label: "Sa demande", placeholder: "Ex: Besoin d'un plombier pour rénovation" },
        { key: "source", label: "Source", placeholder: "Ex: site web, Google, bouche à oreille" },
      ]},
      { taskType: "directory.enroll", agentType: "COMMERCIAL", label: "Inscription annuaire", desc: "Annuaire pro (PagesJaunes, etc.)", icon: Globe, fields: [
        { key: "directoryName", label: "Annuaire", placeholder: "Ex: PagesJaunes" },
      ]},
    ],
  },
];

// Flat list of all tools for lookup
const ALL_TOOLS = TOOL_CATEGORIES.flatMap(c => c.tools);

const PLAN_AGENT_ACCESS: Record<string, string[]> = {
  ESSENTIEL: ["ADMIN"],
  CROISSANCE: ["ADMIN", "MARKETING"],
  PILOTE_AUTO: ["ADMIN", "MARKETING", "COMMERCIAL"],
};

// ─── AUTONOMY LEVELS ─────────────────────────────────────────────────────────
const AUTONOMY_LEVELS = [
  { id: "assisted", icon: Shield, label: "Il prépare, vous validez", desc: "Pour démarrer en confiance", color: C.blue },
  { id: "semi", icon: ShieldCheck, label: "L'essentiel en auto", desc: "Recommandé après 1 mois", color: C.accent },
  { id: "auto", icon: Rocket, label: "Il gère tout, vous êtes informé", desc: "Pour les pros confiants", color: C.green },
];

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
  const [page, setPage] = useState("accueil");
  const [data, setData] = useState<DashboardData>(null);
  const [agents, setAgents] = useState<AgentsData>(null);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Actions state
  const [selectedTool, setSelectedTool] = useState<ToolDef | null>(null);
  const [toolFormData, setToolFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [taskResult, setTaskResult] = useState<{ id: string; status: string } | null>(null);
  const [toolsHistory, setToolsHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  // Agents fiches state
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // Autonomy levels per agent (stored locally for now)
  const [autonomyLevels, setAutonomyLevels] = useState<Record<string, string>>({
    ADMIN: "assisted", MARKETING: "assisted", COMMERCIAL: "assisted",
  });
  // Channel links state
  const [channels, setChannels] = useState<{ channel: string; channel_user_id: string; display_name: string | null; is_active: boolean; linked_at: string }[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);
  const [showTelegramQR, setShowTelegramQR] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/client/dashboard").then(r => r.ok ? r.json() : null),
      fetch("/api/client/agents").then(r => r.ok ? r.json() : null),
      fetch("/api/client/invoices").then(r => r.ok ? r.json() : { invoices: [] }),
      fetch("/api/client/profile").then(r => r.ok ? r.json() : null),
      fetch("/api/client/channels").then(r => r.ok ? r.json() : { channels: [] }),
    ]).then(([d, a, inv, p, ch]) => {
      setData(d);
      setAgents(a);
      setAllInvoices(inv.invoices || []);
      setProfile(p);
      if (p) setEditData(p);
      setChannels(ch.channels || []);
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

  // Fetch history when switching to actions
  useEffect(() => {
    if (page === "actions") {
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

  const openBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/client/billing/portal", { method: "POST" });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } catch { /* silently fail */ } finally {
      setBillingLoading(false);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");
  const fmtRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  };

  // ─── Compute alerts for the "À traiter" zone ───
  const computeAlerts = () => {
    const alerts: { type: "red" | "orange" | "green"; text: string; action?: string }[] = [];
    if (data) {
      const newLeads = data.leads.byStatus?.NEW || 0;
      if (newLeads > 0) alerts.push({ type: "red", text: `${newLeads} demande${newLeads > 1 ? "s" : ""} en attente de réponse`, action: "Voir les demandes" });
    }
    if (agents?.recentTasks) {
      const failed = agents.recentTasks.filter((t: any) => t.status === "FAILED").length;
      if (failed > 0) alerts.push({ type: "orange", text: `${failed} action${failed > 1 ? "s" : ""} en erreur — vérifiez le détail`, action: "Voir le journal" });
    }
    if (alerts.length === 0) {
      const completedThisWeek = agents?.agentTaskStats?.completed || 0;
      alerts.push({ type: "green", text: `Tout roule — vos assistants ont traité ${completedThisWeek} action${completedThisWeek !== 1 ? "s" : ""} récemment` });
    }
    return alerts;
  };

  // ─── NAV — 4 onglets rationalisés ───
  const alertCount = (data?.leads.byStatus?.NEW || 0) + (agents?.recentTasks?.filter((t: any) => t.status === "FAILED").length || 0);

  const navItems = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "actions", label: "Actions", icon: Zap },
    { id: "devis-factures", label: "Devis", icon: FileText, href: "/client/devis-factures" },
    { id: "compte", label: "Mon compte", icon: User },
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
  const allowed = PLAN_AGENT_ACCESS[plan] || PLAN_AGENT_ACCESS.ESSENTIEL;

  return (
    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", background: C.bg, minHeight: "100dvh" as any, color: C.dark, fontSize: 14, maxWidth: 520, margin: "0 auto", position: "relative", overflowX: "hidden", width: "100%" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ paddingBottom: 80 }}>
        {/* ─── HEADER — Salut contextuel, pas de carte plan ──── */}
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16 }}>iA</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Bonjour {client?.firstName || ""} !</div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {agents?.agentTaskStats?.completed
                  ? `Vos assistants ont traité ${agents.agentTaskStats.completed} actions`
                  : client?.company || "Bienvenue"
                }
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 8, minWidth: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={20} />
          </button>
        </div>

        {/* Trial banner — discret, pas un bloc entier */}
        {client?.status === "TRIAL" && client?.trialEndsAt && (
          <div style={{ margin: "8px 16px 0", background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 10, padding: "8px 14px", fontSize: 12, color: C.blue, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><Clock size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />Essai gratuit — {Math.max(0, Math.ceil((new Date(client.trialEndsAt).getTime() - Date.now()) / 86400000))} jours restants</span>
            <span style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setPage("compte")}>Voir les plans</span>
          </div>
        )}

        <div style={{ padding: 16 }}>

          {/* ═══════════════════════════════════════════════════════
              ACCUEIL — 3 zones : À traiter / Chiffres / Fil d'activité
              ═══════════════════════════════════════════════════════ */}
          {page === "accueil" && data && (
            <>
              {/* ZONE 1 — À traiter (traffic light) */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>À voir en priorité</div>
                {computeAlerts().map((alert, i) => {
                  const bg = alert.type === "red" ? `${C.red}10` : alert.type === "orange" ? `${C.yellow}15` : `${C.green}10`;
                  const borderColor = alert.type === "red" ? `${C.red}40` : alert.type === "orange" ? `${C.yellow}40` : `${C.green}30`;
                  const textColor = alert.type === "red" ? C.red : alert.type === "orange" ? "#946800" : C.green;
                  const emoji = alert.type === "red" ? "🔴" : alert.type === "orange" ? "🟠" : "🟢";
                  return (
                    <div key={i} style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 48, gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>{alert.text}</span>
                      </div>
                      {alert.action && (
                        <button onClick={() => setPage("actions")} style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: C.accent, cursor: "pointer", padding: "4px 8px", minHeight: 48, display: "flex", alignItems: "center", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {alert.action}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ZONE 2 — Chiffres du mois (simplifié : 2 KPIs + comparaison texte) */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Vos chiffres du mois</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Demandes reçues */}
                  <div style={{ background: C.surface, borderRadius: 12, padding: "16px 16px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Demandes reçues</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{data.leads.thisMonth}</div>
                    {data.leads.lastMonth > 0 && (
                      <div style={{ fontSize: 12, color: data.leads.thisMonth >= data.leads.lastMonth ? C.green : C.red, display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                        {data.leads.thisMonth >= data.leads.lastMonth ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {data.leads.thisMonth >= data.leads.lastMonth ? "+" : ""}{data.leads.thisMonth - data.leads.lastMonth} vs mois dernier
                      </div>
                    )}
                  </div>
                  {/* Clients gagnés */}
                  <div style={{ background: C.surface, borderRadius: 12, padding: "16px 16px", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Clients gagnés</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{data.leads.byStatus?.WON || 0}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                      sur {data.leads.total} demande{data.leads.total !== 1 ? "s" : ""} au total
                    </div>
                  </div>
                </div>
              </div>

              {/* ZONE 3 — Ce que vos assistants ont fait (fil d'activité narratif) */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Ce que vos assistants ont fait</div>
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                  {(!agents?.recentTasks || agents.recentTasks.length === 0) && (!agents?.activity || agents.activity.length === 0) ? (
                    /* Empty state humanisé */
                    <div style={{ padding: "32px 20px", textAlign: "center" }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Vos assistants sont prêts</div>
                      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Lancez votre première action pour les mettre au travail.</div>
                      <button onClick={() => setPage("actions")} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 48 }}>
                        Voir les actions disponibles
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Agent tasks as narrative */}
                      {(agents?.recentTasks || []).slice(0, 5).map((task: any) => {
                        const statusInfo = TASK_STATUS_LABELS[task.status] || { label: task.status, color: C.muted, icon: "❓" };
                        const assistantInfo = ASSISTANT_LABELS[task.agentType] || { label: task.agentType, emoji: "🤖" };
                        const isAuto = !task.triggeredBy; // If not triggered by user, it's automatic
                        const sourceTag = isAuto ? "🤖 Automatique" : "👆 À votre demande";
                        return (
                          <div key={task.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, minHeight: 48, cursor: "pointer" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                                  {statusInfo.icon} {assistantInfo.label} — {TASK_LABELS[task.taskType] || task.taskType.replace(/[._]/g, " ")}
                                </div>
                                <div style={{ fontSize: 12, color: C.muted }}>
                                  {sourceTag} · {fmtRelative(task.createdAt)}
                                </div>
                              </div>
                              <span style={{ fontSize: 11, background: `${statusInfo.color}15`, color: statusInfo.color, padding: "4px 10px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {/* Recent leads as narrative */}
                      {(agents?.activity || []).slice(0, 3).map((lead: any) => (
                        <div key={lead.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, minHeight: 48 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                                📨 Nouvelle demande de {lead.name}
                              </div>
                              <div style={{ fontSize: 12, color: C.muted }}>
                                {SOURCE_LABELS[lead.source] || lead.source} · {fmtRelative(lead.createdAt)}
                              </div>
                            </div>
                            <span style={{ fontSize: 11, background: `${(STATUS_LABELS[lead.status]?.color || C.muted)}15`, color: STATUS_LABELS[lead.status]?.color || C.muted, padding: "4px 10px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {STATUS_LABELS[lead.status]?.label || lead.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Suivi des demandes (ex pipeline) — simplifié */}
              {Object.keys(data.leads.byStatus).length > 0 && (
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12 }}>Suivi des demandes</div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
                    {Object.entries(data.leads.byStatus).map(([status, count]) => {
                      const total = data.leads.total || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={status} style={{ flex: `${Math.max(pct, 10)} 0 0`, minWidth: 52 }}>
                          <div style={{ height: 8, borderRadius: 4, background: STATUS_LABELS[status]?.color || C.muted, marginBottom: 6 }} />
                          <div style={{ fontSize: 10, color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>{STATUS_LABELS[status]?.label?.split(" ").pop()}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center" }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              ACTIONS — Regroupées par besoin métier
              ═══════════════════════════════════════════════════════ */}
          {page === "actions" && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, marginTop: 0 }}>Que voulez-vous faire ?</h2>
              <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Vos assistants IA sont prêts à agir</p>

              {/* Success/Error banner */}
              {taskResult && (
                <div style={{ background: taskResult.id ? `${C.green}12` : `${C.red}12`, border: `1px solid ${taskResult.id ? C.green : C.red}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 48 }}>
                  <div style={{ fontSize: 13, color: taskResult.id ? C.green : C.red, fontWeight: 600 }}>
                    {taskResult.id ? "✅ Action lancée avec succès" : taskResult.status}
                  </div>
                  <button onClick={() => setTaskResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 8, minWidth: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                </div>
              )}

              {/* Tool categories by business need */}
              {TOOL_CATEGORIES.map(cat => {
                // Check if any tool in the category is accessible
                const accessibleTools = cat.tools.filter(t => allowed.includes(t.agentType));
                const lockedTools = cat.tools.filter(t => !allowed.includes(t.agentType));
                const isExpanded = expandedCategory === cat.id;

                return (
                  <div key={cat.id} style={{ marginBottom: 14 }}>
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                      style={{ width: "100%", background: C.surface, borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 56 }}
                    >
                      <span style={{ fontSize: 24 }}>{cat.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{cat.label}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{cat.desc}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{accessibleTools.length} action{accessibleTools.length > 1 ? "s" : ""}</span>
                        {isExpanded ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, paddingLeft: 8 }}>
                        {accessibleTools.map(tool => (
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
                            style={{ background: C.surface, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "'Bricolage Grotesque', sans-serif", opacity: submitting ? 0.6 : 1, minHeight: 48 }}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ASSISTANT_LABELS[tool.agentType]?.color || C.dark}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <tool.icon size={15} color={ASSISTANT_LABELS[tool.agentType]?.color || C.dark} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{tool.label}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>{tool.desc}</div>
                            </div>
                            {tool.fields && tool.fields.length > 0 ? (
                              <ChevronRight size={16} color={C.muted} />
                            ) : (
                              <Play size={14} color={ASSISTANT_LABELS[tool.agentType]?.color || C.dark} />
                            )}
                          </button>
                        ))}

                        {lockedTools.length > 0 && (
                          <div style={{ background: `${C.muted}08`, borderRadius: 10, border: `1px dashed ${C.border}`, padding: "10px 14px", fontSize: 12, color: C.muted }}>
                            +{lockedTools.length} action{lockedTools.length > 1 ? "s" : ""} disponible{lockedTools.length > 1 ? "s" : ""} avec un plan supérieur ·{" "}
                            <span style={{ color: C.accent, fontWeight: 600, cursor: "pointer" }} onClick={() => setPage("compte")}>Voir les plans</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ─── JOURNAL D'ACTIVITÉ (ex historique des tâches) ─── */}
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginTop: 8 }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Journal d&apos;activité</span>
                  <button onClick={() => { setHistoryLoading(true); fetch("/api/client/agents/tasks?limit=20").then(r => r.ok ? r.json() : { tasks: [] }).then(d => { setToolsHistory(d.tasks || []); setHistoryLoading(false); }).catch(() => setHistoryLoading(false)); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, minWidth: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <RefreshCw size={14} color={C.muted} />
                  </button>
                </div>
                {historyLoading ? (
                  <div style={{ padding: 24, textAlign: "center" }}><Loader2 size={18} color={C.muted} /></div>
                ) : toolsHistory.length === 0 ? (
                  /* Empty state humanisé */
                  <div style={{ padding: "28px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>Aucune action pour le moment.<br />Lancez votre première action ci-dessus !</div>
                  </div>
                ) : (
                  toolsHistory.map((task: any) => {
                    const statusInfo = TASK_STATUS_LABELS[task.status] || { label: task.status, color: C.muted, icon: "❓" };
                    const assistantInfo = ASSISTANT_LABELS[task.agentType];
                    const isAuto = !task.triggeredBy;
                    return (
                      <div key={task.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 48 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {statusInfo.icon} {TASK_LABELS[task.taskType] || task.taskType.replace(/[._]/g, " ")}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {assistantInfo?.label || task.agentType} · {isAuto ? "🤖 Auto" : "👆 Vous"} · {fmtRelative(task.createdAt)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, background: `${statusInfo.color}15`, color: statusInfo.color, padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>
                          {statusInfo.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ─── TOOL FORM MODAL ─── */}
              {selectedTool && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) { setSelectedTool(null); setToolFormData({}); } }}>
                  <div style={{ background: C.bg, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto", padding: "20px 16px calc(20px + env(safe-area-inset-bottom))" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${ASSISTANT_LABELS[selectedTool.agentType]?.color || C.dark}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <selectedTool.icon size={16} color={ASSISTANT_LABELS[selectedTool.agentType]?.color || C.dark} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedTool.label}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{selectedTool.desc}</div>
                        </div>
                      </div>
                      <button onClick={() => { setSelectedTool(null); setToolFormData({}); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, minWidth: 48, minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} color={C.muted} /></button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                      {(selectedTool.fields || []).map(field => (
                        <div key={field.key}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.dark, display: "block", marginBottom: 4 }}>{field.label}</label>
                          {field.options ? (
                            <select
                              value={toolFormData[field.key] || ""}
                              onChange={(e) => setToolFormData({ ...toolFormData, [field.key]: e.target.value })}
                              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", color: C.dark, appearance: "none", minHeight: 48 }}
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
                              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", color: C.dark, boxSizing: "border-box", minHeight: 48 }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleToolSubmit(selectedTool)}
                      disabled={submitting}
                      style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: submitting ? "wait" : "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", opacity: submitting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48 }}
                    >
                      {submitting ? <Loader2 size={16} /> : <Play size={16} />}
                      {submitting ? "Envoi en cours..." : "Lancer l'action"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              MON COMPTE — Profil + Abonnement + Mes assistants
              ═══════════════════════════════════════════════════════ */}
          {page === "compte" && profile && (
            <>
              {/* ── Profil ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Mon compte</h2>
                {!editing ? (
                  <button onClick={() => { setEditing(true); setEditData(profile); }} style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: C.dark, minHeight: 48 }}>
                    <Edit size={14} /> Modifier
                  </button>
                ) : (
                  <button onClick={handleSaveProfile} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, background: C.accent, border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff", minHeight: 48 }}>
                    <Save size={14} /> {saving ? "..." : "Enregistrer"}
                  </button>
                )}
              </div>

              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
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
                  <div key={field.key} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 48 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, minWidth: 100 }}>{field.label}</div>
                    {editing && !field.readonly ? (
                      <input
                        value={editData[field.key] || ""}
                        onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                        style={{ flex: 1, textAlign: "right", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", outline: "none", background: C.bg, minHeight: 36 }}
                      />
                    ) : (
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{profile[field.key] || "—"}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Abonnement (déplacé ici depuis le dashboard) ── */}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={16} /> Abonnement
              </h3>
              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Plan actuel</div>
                    <div style={{ fontWeight: 700, fontSize: 18, marginTop: 2 }}>{PLAN_LABELS[plan]} — {PLAN_PRICES[plan]}€/mois</div>
                  </div>
                  {data?.subscription && (
                    <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, fontWeight: 600, background: `${(SUB_STATUS_MAP[data.subscription.status]?.color || C.muted)}30`, color: SUB_STATUS_MAP[data.subscription.status]?.color || C.muted }}>
                      {SUB_STATUS_MAP[data.subscription.status]?.label || data.subscription.status}
                    </span>
                  )}
                </div>

                {data?.subscription && (
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.muted }}>
                    <CalendarDays size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    Période : {fmtDate(data.subscription.currentPeriodStart)} → {fmtDate(data.subscription.currentPeriodEnd)}
                    {data.subscription.cancelAtPeriodEnd && (
                      <div style={{ color: C.red, fontWeight: 600, marginTop: 6, fontSize: 12 }}>
                        <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                        Annulation prévue en fin de période
                      </div>
                    )}
                  </div>
                )}

                {data?.upcomingInvoice && (
                  <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.dark }}>
                    <CreditCard size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    Prochaine facture : <strong>{(data.upcomingInvoice.amount / 100).toFixed(2)}€</strong>
                    {data.upcomingInvoice.date && ` le ${fmtDate(data.upcomingInvoice.date)}`}
                  </div>
                )}

                <div style={{ padding: "14px 16px" }}>
                  <button
                    onClick={openBillingPortal}
                    disabled={billingLoading}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "none", background: C.dark, color: "#fff", fontWeight: 700, fontSize: 14, cursor: billingLoading ? "not-allowed" : "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: billingLoading ? 0.6 : 1, minHeight: 48 }}
                  >
                    {billingLoading ? <Loader2 size={16} /> : <CreditCard size={16} />}
                    {billingLoading ? "Redirection..." : "Gérer mon abonnement"}
                  </button>
                </div>
              </div>

              {/* ── Dernières factures ── */}
              {allInvoices.length > 0 && (
                <>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText size={16} /> Dernières factures
                  </h3>
                  <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
                    {allInvoices.slice(0, 5).map((inv: any, i: number) => (
                      <div key={inv.id} style={{ padding: "12px 16px", borderBottom: i < Math.min(allInvoices.length, 5) - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 48 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.number}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(inv.createdAt)}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{(inv.amount / 100).toFixed(2)}€</span>
                          {inv.stripePaymentUrl && (
                            <a href={inv.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, fontSize: 12, fontWeight: 600, textDecoration: "none", padding: "6px 10px", minHeight: 48, display: "inline-flex", alignItems: "center" }}>
                              PDF ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Canaux connectés ── */}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={16} /> Canaux de communication
              </h3>

              <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
                {/* Telegram */}
                {(() => {
                  const tg = channels.find(c => c.channel === "telegram");
                  return (
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: tg ? "#0088cc20" : `${C.muted}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Send size={18} color={tg ? "#0088cc" : C.muted} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.dark }}>Telegram</div>
                        {tg ? (
                          <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Connecté {tg.display_name ? `(${tg.display_name})` : ""}</div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.muted }}>Non connecté</div>
                        )}
                      </div>
                      {tg ? (
                        <button
                          onClick={async () => {
                            setDisconnecting("telegram");
                            try {
                              const res = await fetch("/api/client/channels", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "telegram" }) });
                              if (res.ok) setChannels(prev => prev.filter(c => c.channel !== "telegram"));
                            } finally { setDisconnecting(null); }
                          }}
                          disabled={disconnecting === "telegram"}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.muted, fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 36 }}
                        >
                          <Unlink size={12} /> {disconnecting === "telegram" ? "..." : "Déconnecter"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowTelegramQR(!showTelegramQR)}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "#0088cc", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 36 }}
                        >
                          <Link2 size={12} /> Connecter
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Telegram QR expand */}
                {showTelegramQR && !channels.find(c => c.channel === "telegram") && (
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: `${C.bg}` }}>
                    <div style={{ textAlign: "center" }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://t.me/iartisan_bot?start=${profile?.id || ""}`)}`}
                        alt="Telegram QR"
                        style={{ width: 120, height: 120, borderRadius: 8, margin: "0 auto 8px" }}
                      />
                      <div style={{ fontSize: 12, color: C.muted }}>Scannez ou cliquez ci-dessous</div>
                      <a
                        href={`https://t.me/iartisan_bot?start=${profile?.id || ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "10px 20px", background: "#0088cc", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none", fontFamily: "'Bricolage Grotesque', sans-serif" }}
                      >
                        <Send size={14} /> Ouvrir Telegram
                      </a>
                    </div>
                  </div>
                )}

                {/* WhatsApp */}
                {(() => {
                  const wa = channels.find(c => c.channel === "whatsapp");
                  return (
                    <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: wa ? "#25D36620" : `${C.muted}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Phone size={18} color={wa ? "#25D366" : C.muted} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.dark }}>WhatsApp</div>
                        {wa ? (
                          <div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Connecté {wa.display_name ? `(${wa.display_name})` : ""}</div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.muted }}>Non connecté</div>
                        )}
                      </div>
                      {wa ? (
                        <button
                          onClick={async () => {
                            setDisconnecting("whatsapp");
                            try {
                              const res = await fetch("/api/client/channels", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "whatsapp" }) });
                              if (res.ok) setChannels(prev => prev.filter(c => c.channel !== "whatsapp"));
                            } finally { setDisconnecting(null); }
                          }}
                          disabled={disconnecting === "whatsapp"}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: C.muted, fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 36 }}
                        >
                          <Unlink size={12} /> {disconnecting === "whatsapp" ? "..." : "Déconnecter"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowWhatsAppQR(!showWhatsAppQR)}
                          style={{ display: "flex", alignItems: "center", gap: 4, background: "#25D366", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 36 }}
                        >
                          <Link2 size={12} /> Connecter
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* WhatsApp QR expand */}
                {showWhatsAppQR && !channels.find(c => c.channel === "whatsapp") && (
                  <div style={{ padding: "12px 16px", background: `${C.bg}` }}>
                    <div style={{ textAlign: "center" }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://wa.me/${WA_NUMBER}?text=link_${profile?.id || ""}`)}`}
                        alt="WhatsApp QR"
                        style={{ width: 120, height: 120, borderRadius: 8, margin: "0 auto 8px" }}
                      />
                      <div style={{ fontSize: 12, color: C.muted }}>Scannez ou cliquez ci-dessous</div>
                      <a
                        href={`https://wa.me/${WA_NUMBER}?text=link_${profile?.id || ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "10px 20px", background: "#25D366", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none", fontFamily: "'Bricolage Grotesque', sans-serif" }}
                      >
                        <Phone size={14} /> Ouvrir WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Mes assistants (fiches agents complètes) ── */}
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={16} /> Mes assistants
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {(["ADMIN", "MARKETING", "COMMERCIAL"] as const).map(agentType => {
                  if (!allowed.includes(agentType)) return null;
                  const info = ASSISTANT_LABELS[agentType];
                  const agent = agents?.agents?.find(a => a.type === agentType);
                  const isSelected = selectedAgent === agentType;
                  const agentTasks = (agents?.recentTasks || []).filter((t: any) => t.agentType === agentType);
                  const agentTools = ALL_TOOLS.filter(t => t.agentType === agentType);
                  const level = autonomyLevels[agentType] || "assisted";
                  const levelInfo = AUTONOMY_LEVELS.find(l => l.id === level) || AUTONOMY_LEVELS[0];

                  return (
                    <div key={agentType}>
                      {/* Agent card */}
                      <button
                        onClick={() => setSelectedAgent(isSelected ? null : agentType)}
                        style={{ width: "100%", background: C.surface, borderRadius: isSelected ? "12px 12px 0 0" : 12, padding: "14px 16px", border: `1px solid ${isSelected ? info.color + "40" : C.border}`, borderBottom: isSelected ? "none" : `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", fontFamily: "'Bricolage Grotesque', sans-serif", minHeight: 56 }}
                      >
                        <span style={{ fontSize: 24 }}>{info.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{info.label}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{info.desc}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
                          <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>En service</span>
                          {isSelected ? <ChevronUp size={14} color={C.muted} /> : <ChevronDown size={14} color={C.muted} />}
                        </div>
                      </button>

                      {/* Expanded agent fiche */}
                      {isSelected && (
                        <div style={{ background: C.surface, borderRadius: "0 0 12px 12px", border: `1px solid ${info.color}40`, borderTop: "none", overflow: "hidden" }}>

                          {/* Autonomy level */}
                          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: C.muted }}>Quel niveau de liberté ?</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {AUTONOMY_LEVELS.map(lvl => (
                                <button
                                  key={lvl.id}
                                  onClick={() => setAutonomyLevels(prev => ({ ...prev, [agentType]: lvl.id }))}
                                  style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    borderRadius: 10,
                                    border: `2px solid ${level === lvl.id ? lvl.color : C.border}`,
                                    background: level === lvl.id ? `${lvl.color}10` : C.surface,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    fontFamily: "'Bricolage Grotesque', sans-serif",
                                    minHeight: 48,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <lvl.icon size={18} color={level === lvl.id ? lvl.color : C.muted} style={{ flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: level === lvl.id ? lvl.color : C.dark }}>{lvl.label}</div>
                                    <div style={{ fontSize: 11, color: C.muted }}>{lvl.desc}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Agent tools */}
                          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.muted }}>Ce qu&apos;il sait faire</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {agentTools.map(tool => (
                                <button
                                  key={tool.taskType}
                                  onClick={() => {
                                    setPage("actions");
                                    if (tool.fields && tool.fields.length > 0) {
                                      setSelectedTool(tool);
                                      setToolFormData({});
                                    }
                                  }}
                                  style={{ background: `${info.color}08`, border: `1px solid ${info.color}20`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", color: info.color, minHeight: 36 }}
                                >
                                  {tool.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Agent recent activity */}
                          <div style={{ padding: "14px 16px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: C.muted }}>Ses dernières actions</div>
                            {agentTasks.length === 0 ? (
                              <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Aucune action récente</div>
                            ) : (
                              agentTasks.slice(0, 3).map((task: any) => {
                                const statusInfo = TASK_STATUS_LABELS[task.status] || { label: task.status, color: C.muted, icon: "❓" };
                                return (
                                  <div key={task.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12 }}>
                                    <span>{statusInfo.icon} {TASK_LABELS[task.taskType] || task.taskType} · {fmtRelative(task.createdAt)}</span>
                                    <span style={{ color: statusInfo.color, fontWeight: 600 }}>{statusInfo.label}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Locked agents upsell */}
                {(() => {
                  const locked = (["ADMIN", "MARKETING", "COMMERCIAL"] as const).filter(a => !allowed.includes(a));
                  if (locked.length === 0) return null;
                  return (
                    <div style={{ background: `${C.muted}08`, borderRadius: 12, border: `1px dashed ${C.border}`, padding: "14px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Débloquez plus d&apos;assistants</div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                        {locked.map(a => ASSISTANT_LABELS[a].label).join(" et ")} disponible{locked.length > 1 ? "s" : ""} avec un plan supérieur.
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, cursor: "pointer" }} onClick={openBillingPortal}>
                        Voir les plans →
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── BOTTOM NAV — 4 onglets rationalisés ──────────────────── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "4px 0 calc(4px + env(safe-area-inset-bottom))", zIndex: 50 }}>
        {navItems.map(item => {
          const isActive = !("href" in item) && page === item.id;
          const showBadge = item.id === "accueil" && alertCount > 0;
          const navStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none", background: "none", border: "none", cursor: "pointer", color: isActive ? C.accent : C.muted, padding: "8px 4px", fontSize: 10, fontWeight: 600, fontFamily: "'Bricolage Grotesque', sans-serif", flex: 1, minHeight: 52, justifyContent: "center", position: "relative", WebkitTapHighlightColor: "transparent" };
          return "href" in item ? (
            <a key={item.id} href={item.href} style={navStyle}>
              <item.icon size={22} />
              <span>{item.label}</span>
            </a>
          ) : (
            <button key={item.id} onClick={() => setPage(item.id)} style={navStyle}>
              <div style={{ position: "relative" }}>
                <item.icon size={22} />
                {showBadge && (
                  <div style={{ position: "absolute", top: -4, right: -8, background: C.red, color: "#fff", fontSize: 9, fontWeight: 800, width: 16, height: 16, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {alertCount}
                  </div>
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
