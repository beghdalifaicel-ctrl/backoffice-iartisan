"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Search, ChevronRight, ChevronDown, Trash2, Copy, ArrowRight,
  Download, Eye, Edit, Save, X, Package, Users, CreditCard, Check,
  ArrowLeft, Loader2, BookOpen, RefreshCw, Sparkles, TrendingUp, Filter,
  MessageSquare, Zap, Clock, AlertCircle, CheckCircle2, XCircle, MoreVertical,
  ChevronLeft, PlusCircle, BarChart3, DollarSign, FileCheck, Briefcase
} from "lucide-react";

// ─── MODERN DESIGN TOKENS ───────────────────────────────────────────────────
const COLORS = {
  background: "#f8fafc",
  surface: "#ffffff",
  dark: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  // Brand colors
  orange: "#f97316",
  amber: "#f59e0b",
  emerald: "#10b981",
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#eab308",
  violet: "#8b5cf6",
  // Semantic
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

// Source colors for AI devis
const SOURCE_COLORS = {
  whatsapp: "#25d366",
  telegram: "#0088cc",
  sms: "#9333ea",
};

const SOURCE_ICONS = {
  whatsapp: "📱",
  telegram: "✈️",
  sms: "💬",
};

// ─── TYPES ──────────────────────────────────────────────────────────────────
type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: string;
  adresse?: string;
  codePostal?: string;
  ville?: string;
  siret?: string;
  tvaIntra?: string;
};

type Article = {
  id: string;
  categorie?: string;
  designation: string;
  description?: string;
  unite: string;
  prixUnitHT: number;
  tauxTVA: number;
};

type Ligne = {
  id?: string;
  designation: string;
  description?: string;
  quantite: number;
  unite: string;
  prixUnitHT: number;
  tauxTVA: number;
};

type Lot = {
  id?: string;
  titre: string;
  lignes: Ligne[];
};

type Devis = any;
type Facture = any;

type AgentDevis = {
  id: string;
  source: "whatsapp" | "telegram" | "sms";
  prospectName: string;
  objet: string;
  totalEstime: number;
  confidenceScore: number;
  status: "pending" | "validated" | "rejected";
  originalMessage: string;
  createdAt: string;
};

type Material = {
  id: string;
  designation: string;
  description?: string;
  categorie: string;
  unite: string;
  prixUnitHT: number;
  tauxTVA: number;
  prixMin?: number;
  prixMax?: number;
};

// ─── UTILITIES ──────────────────────────────────────────────────────────────
function fmtMoney(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}

function fmtDate(d: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

function getConfidenceColor(score: number): string {
  if (score < 50) return COLORS.danger;
  if (score < 75) return COLORS.warning;
  return COLORS.success;
}

function calcTotals(lots: Lot[], remise: number = 0) {
  let ht = 0,
    tva = 0;
  for (const lot of lots) {
    for (const l of lot.lignes) {
      const lht = l.quantite * l.prixUnitHT;
      ht += lht;
      tva += lht * (l.tauxTVA / 100);
    }
  }
  if (remise > 0) {
    ht *= 1 - remise / 100;
    tva *= 1 - remise / 100;
  }
  return {
    totalHT: Math.round(ht * 100) / 100,
    totalTVA: Math.round(tva * 100) / 100,
    totalTTC: Math.round((ht + tva) * 100) / 100,
  };
}

function emptyLot(idx: number): Lot {
  return {
    titre: `Lot ${idx + 1}`,
    lignes: [
      {
        designation: "",
        quantite: 1,
        unite: "u",
        prixUnitHT: 0,
        tauxTVA: 20,
      },
    ],
  };
}

function emptyLigne(): Ligne {
  return { designation: "", quantite: 1, unite: "u", prixUnitHT: 0, tauxTVA: 20 };
}

// ─── REUSABLE COMPONENTS ────────────────────────────────────────────────────

function Badge({
  label,
  icon,
  variant = "default",
}: {
  label: string;
  icon?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "ai";
}) {
  const variantStyles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: `${COLORS.blue}15`, color: COLORS.blue },
    success: { backgroundColor: `${COLORS.success}15`, color: COLORS.success },
    warning: { backgroundColor: `${COLORS.warning}15`, color: COLORS.warning },
    danger: { backgroundColor: `${COLORS.danger}15`, color: COLORS.danger },
    info: { backgroundColor: `${COLORS.info}15`, color: COLORS.info },
    ai: { backgroundColor: `${COLORS.violet}15`, color: COLORS.violet },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "12px",
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: "6px",
        ...variantStyles[variant],
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className = "",
  style: extraStyle = {},
  icon: IconComponent,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  icon?: React.ReactNode;
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    border: "none",
    borderRadius: "10px",
    fontWeight: 600,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    transition: "all 0.2s ease",
    opacity: disabled || loading ? 0.6 : 1,
    fontSize: size === "sm" ? "12px" : size === "lg" ? "14px" : "13px",
    padding:
      size === "sm"
        ? "6px 12px"
        : size === "lg"
          ? "12px 20px"
          : "10px 16px",
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: `linear-gradient(135deg, ${COLORS.orange} 0%, ${COLORS.amber} 100%)`,
      color: "#fff",
    },
    secondary: {
      background: COLORS.surface,
      color: COLORS.dark,
      border: `1px solid ${COLORS.border}`,
    },
    ghost: {
      background: "transparent",
      color: COLORS.muted,
    },
    danger: {
      background: `${COLORS.danger}15`,
      color: COLORS.danger,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...baseStyle, ...variantStyles[variant], ...extraStyle }}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : IconComponent}
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  error,
  style: wrapperStyle,
  ...rest
}: {
  label?: string;
  value: any;
  onChange: (v: any) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}) {
  return (
    <div style={{ flex: 1, ...wrapperStyle }}>
      {label && (
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: COLORS.muted,
            marginBottom: "6px",
          }}
        >
          {label}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: `1px solid ${error ? COLORS.danger : COLORS.border}`,
          fontSize: "13px",
          background: COLORS.surface,
          outline: "none",
          transition: "all 0.2s",
        }}
      />
      {error && (
        <div style={{ fontSize: "11px", color: COLORS.danger, marginTop: "4px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  style: wrapperStyle,
  ...rest
}: {
  label?: string;
  value: any;
  onChange: (v: any) => void;
  options: { value: any; label: string }[];
  style?: React.CSSProperties;
  [key: string]: any;
}) {
  return (
    <div style={{ flex: 1, ...wrapperStyle }}>
      {label && (
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: COLORS.muted,
            marginBottom: "6px",
          }}
        >
          {label}
        </div>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: `1px solid ${COLORS.border}`,
          fontSize: "13px",
          background: COLORS.surface,
          outline: "none",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Card({
  children,
  style: extraStyle = {},
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.surface,
        borderRadius: "12px",
        border: `1px solid ${COLORS.border}`,
        padding: "20px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        transition: "all 0.2s ease",
        ...extraStyle,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const variantBgs: Record<string, string> = {
    default: `linear-gradient(135deg, ${COLORS.blue}20 0%, ${COLORS.info}10 100%)`,
    success: `linear-gradient(135deg, ${COLORS.success}20 0%, ${COLORS.emerald}10 100%)`,
    warning: `linear-gradient(135deg, ${COLORS.warning}20 0%, ${COLORS.amber}10 100%)`,
    danger: `linear-gradient(135deg, ${COLORS.danger}20 0%, ${COLORS.red}10 100%)`,
    info: `linear-gradient(135deg, ${COLORS.violet}20 0%, ${COLORS.blue}10 100%)`,
  };

  return (
    <Card
      style={{
        background: variantBgs[variant],
        border: "none",
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "28px", opacity: 0.7 }}>{Icon}</div>
        <div>
          <div style={{ fontSize: "12px", color: COLORS.muted, fontWeight: 600 }}>
            {label}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: COLORS.dark }}>
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TabNav({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (tab: any) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: "0",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            color: activeTab === tab.id ? COLORS.orange : COLORS.muted,
            borderBottom:
              activeTab === tab.id ? `2px solid ${COLORS.orange}` : "none",
            transition: "all 0.2s",
          }}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── MODALS & DIALOGS ───────────────────────────────────────────────────────

function MaterialModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (material: Material) => void;
}) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchMaterials();
  }, [isOpen, search, category]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      let url = "/api/client/materiaux?";
      if (search) url += `q=${encodeURIComponent(search)}&`;
      if (category) url += `categorie=${encodeURIComponent(category)}&`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMaterials(Array.isArray(data) ? data : data.materials || []);
        if (data.categories) setCategories(data.categories);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <Card
        onClick={(e: any) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: "700px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: COLORS.dark }}>
            Matériaux BTP
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} color={COLORS.muted} />
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={setSearch}
          />
          <Select
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "Toutes les catégories" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto" }} />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "12px",
            }}
          >
            {materials.map((m) => (
              <div
                key={m.id}
                onClick={() => {
                  onSelect(m);
                  onClose();
                }}
                style={{
                  padding: "12px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: COLORS.background,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 4px 12px rgba(0, 0, 0, 0.1)";
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(0)";
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: COLORS.dark,
                    marginBottom: "4px",
                  }}
                >
                  {m.designation}
                </div>
                <div style={{ fontSize: "11px", color: COLORS.muted }}>
                  {m.categorie}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: COLORS.orange }}>
                  {fmtMoney(m.prixUnitHT)} / {m.unite}
                </div>
                {m.prixMin && m.prixMax && (
                  <div style={{ fontSize: "10px", color: COLORS.muted, marginTop: "4px" }}>
                    {fmtMoney(m.prixMin)} - {fmtMoney(m.prixMax)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── MAIN PAGE COMPONENT ────────────────────────────────────────────────────

export default function DevisFacturesPage() {
  // State
  const [tab, setTab] = useState<"devis" | "factures" | "articles" | "clients">("devis");
  const [newDevisMenu, setNewDevisMenu] = useState(false);
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [facturesList, setFacturesList] = useState<Facture[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agentDevisList, setAgentDevisList] = useState<AgentDevis[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [articleForm, setArticleForm] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState<any>(null);
  const [convertModal, setConvertModal] = useState<{
    devisId: string;
    type: string;
    pourcentage: number;
  } | null>(null);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [materialLotIndex, setMaterialLotIndex] = useState<number | null>(null);

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, fRes, aRes, cRes, agRes] = await Promise.all([
        fetch("/api/client/devis"),
        fetch("/api/client/factures-btp"),
        fetch("/api/client/articles"),
        fetch("/api/client/customers"),
        fetch("/api/client/agent-devis"),
      ]);
      if (dRes.ok) setDevisList(await dRes.json());
      if (fRes.ok) setFacturesList(await fRes.json());
      if (aRes.ok) setArticles(await aRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
      if (agRes.ok) setAgentDevisList(await agRes.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Devis actions
  const openNewDevis = () => {
    setFormData({
      objet: "",
      customerId: customers[0]?.id || "",
      validUntil: "",
      conditions: "Paiement à 30 jours",
      notes: "",
      remisePercent: 0,
      lots: [emptyLot(0)],
    });
    setEditId(null);
    setView("form");
  };

  const openEditDevis = async (id: string) => {
    const res = await fetch(`/api/client/devis/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setFormData({
      objet: d.objet,
      customerId: d.customerId,
      validUntil: d.validUntil ? d.validUntil.slice(0, 10) : "",
      conditions: d.conditions || "",
      notes: d.notes || "",
      remisePercent: d.remisePercent || 0,
      lots: d.lots.map((l: any) => ({
        titre: l.titre,
        lignes: l.lignes.map((li: any) => ({
          designation: li.designation,
          description: li.description || "",
          quantite: li.quantite,
          unite: li.unite,
          prixUnitHT: li.prixUnitHT,
          tauxTVA: li.tauxTVA,
        })),
      })),
    });
    setEditId(id);
    setView("form");
  };

  const openDetailDevis = async (id: string) => {
    const res = await fetch(`/api/client/devis/${id}`);
    if (!res.ok) return;
    setDetailData(await res.json());
    setView("detail");
  };

  const saveDevis = async () => {
    setSaving(true);
    const method = editId ? "PUT" : "POST";
    const url = editId ? `/api/client/devis/${editId}` : "/api/client/devis";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      await fetchAll();
      setView("list");
    }
    setSaving(false);
  };

  const deleteDevis = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce devis ?")) return;
    await fetch(`/api/client/devis/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const duplicateDevis = async (id: string) => {
    await fetch(`/api/client/devis/${id}/duplicate`, { method: "POST" });
    fetchAll();
  };

  const convertDevis = async () => {
    if (!convertModal) return;
    setSaving(true);
    const res = await fetch(`/api/client/devis/${convertModal.devisId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: convertModal.type,
        pourcentage: convertModal.pourcentage,
      }),
    });
    if (res.ok) {
      await fetchAll();
      setConvertModal(null);
      setTab("factures");
      setView("list");
    }
    setSaving(false);
  };

  // Agent devis actions
  const importAgentDevis = async (id: string) => {
    setSaving(true);
    const res = await fetch(`/api/client/agent-devis/${id}/import`, {
      method: "POST",
    });
    if (res.ok) {
      await fetchAll();
    }
    setSaving(false);
  };

  const rejectAgentDevis = async (id: string) => {
    await fetch(`/api/client/agent-devis/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Facture actions
  const updateFactureStatus = async (id: string, status: string) => {
    await fetch(`/api/client/factures-btp/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAll();
  };

  // Articles actions
  const saveArticle = async () => {
    setSaving(true);
    const method = articleForm.id ? "PUT" : "POST";
    const url = articleForm.id
      ? `/api/client/articles/${articleForm.id}`
      : "/api/client/articles";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(articleForm),
    });
    if (res.ok) {
      await fetchAll();
      setArticleForm(null);
    }
    setSaving(false);
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    await fetch(`/api/client/articles/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Customers actions
  const saveCustomer = async () => {
    setSaving(true);
    const method = customerForm.id ? "PUT" : "POST";
    const url = customerForm.id
      ? `/api/client/customers/${customerForm.id}`
      : "/api/client/customers";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customerForm),
    });
    if (res.ok) {
      await fetchAll();
      setCustomerForm(null);
    }
    setSaving(false);
  };

  const deleteCustomer = async (id: string) => {
    if (!confirm("Supprimer ce client ?")) return;
    await fetch(`/api/client/customers/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Render sections
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: COLORS.background,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Loader2
            size={40}
            className="animate-spin"
            style={{ margin: "0 auto", color: COLORS.orange }}
          />
          <div style={{ marginTop: "16px", color: COLORS.muted }}>Chargement...</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "devis", label: "Devis", icon: <FileText size={18} /> },
    { id: "factures", label: "Factures", icon: <CreditCard size={18} /> },
    { id: "articles", label: "Articles", icon: <Package size={18} /> },
    { id: "clients", label: "Clients", icon: <Users size={18} /> },
  ];

  // ─── DEVIS LIST VIEW ────────────────────────────────────────────────────
  if (tab === "devis" && view === "list") {
    const filtered = devisList.filter((d) =>
      d.objet.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: 700, color: COLORS.dark }}>
                Devis
              </h1>
              <p style={{ fontSize: "14px", color: COLORS.muted, marginTop: "4px" }}>
                Manuels et générés par l&apos;IA — tout au même endroit
              </p>
            </div>
            <div style={{ position: "relative" }}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setNewDevisMenu(!newDevisMenu)}
                icon={<Plus size={18} />}
              >
                Nouveau devis
              </Button>
              {newDevisMenu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setNewDevisMenu(false)} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
                    background: COLORS.surface, borderRadius: "12px", border: `1px solid ${COLORS.border}`,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.12)", minWidth: "280px", overflow: "hidden",
                  }}>
                    <button
                      onClick={() => { setNewDevisMenu(false); openNewDevis(); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px", width: "100%",
                        padding: "14px 16px", background: "none", border: "none", borderBottom: `1px solid ${COLORS.border}`,
                        cursor: "pointer", textAlign: "left", fontSize: "14px",
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS.orange}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FileText size={16} color={COLORS.orange} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: COLORS.dark }}>Remplir moi-même</div>
                        <div style={{ fontSize: "12px", color: COLORS.muted }}>Créer un devis manuellement</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setNewDevisMenu(false);
                        // Trigger AI devis via the agent task API
                        window.location.href = "/client#actions";
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px", width: "100%",
                        padding: "14px 16px", background: "none", border: "none",
                        cursor: "pointer", textAlign: "left", fontSize: "14px",
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS.violet}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Sparkles size={16} color={COLORS.violet} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: COLORS.dark }}>L&apos;assistant le prépare</div>
                        <div style={{ fontSize: "12px", color: COLORS.muted }}>Devis généré par l&apos;IA à valider</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap" }}>
            <StatCard
              label="Devis total"
              value={filtered.length}
              icon="📄"
              variant="default"
            />
            <StatCard
              label="Montant HT"
              value={fmtMoney(
                filtered.reduce((sum, d) => sum + (calcTotals(d.lots).totalHT || 0), 0)
              )}
              icon="💰"
              variant="success"
            />
            <StatCard
              label="En attente"
              value={filtered.filter((d) => d.status === "BROUILLON").length}
              icon="⏳"
              variant="warning"
            />
            <StatCard
              label="Acceptés"
              value={filtered.filter((d) => d.status === "ACCEPTE").length}
              icon="✓"
              variant="success"
            />
          </div>

          {/* Agent Devis — pending, integrated */}
          {agentDevisList.filter(d => d.status === "pending").length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
              }}>
                <Sparkles size={16} color={COLORS.violet} />
                <span style={{ fontSize: "14px", fontWeight: 700, color: COLORS.violet }}>
                  Proposés par l&apos;IA — à valider ({agentDevisList.filter(d => d.status === "pending").length})
                </span>
              </div>
              <div style={{ display: "grid", gap: "10px" }}>
                {agentDevisList.filter(d => d.status === "pending").map(devis => (
                  <Card key={devis.id} style={{ border: `2px solid ${COLORS.violet}30`, background: `${COLORS.violet}04` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "16px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "16px" }}>{SOURCE_ICONS[devis.source]}</span>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: COLORS.dark }}>{devis.prospectName}</span>
                          <Badge label={devis.source.toUpperCase()} variant="ai" />
                        </div>
                        <div style={{ fontSize: "13px", color: COLORS.dark, fontWeight: 600 }}>{devis.objet}</div>
                        <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "4px" }}>
                          Confiance : <span style={{ color: getConfidenceColor(devis.confidenceScore), fontWeight: 600 }}>{devis.confidenceScore}%</span> · {fmtDate(devis.createdAt)}
                        </div>
                        <div style={{
                          fontSize: "12px", color: COLORS.muted, background: COLORS.background,
                          padding: "8px 10px", borderRadius: "6px", marginTop: "8px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          &ldquo;{devis.originalMessage}&rdquo;
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: COLORS.orange, marginBottom: "8px" }}>
                          {fmtMoney(devis.totalEstime)}
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Button variant="primary" size="sm" onClick={() => importAgentDevis(devis.id)} loading={saving} icon={<Check size={14} />}>
                            Valider
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => rejectAgentDevis(devis.id)} icon={<X size={14} />}>
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.muted,
                }}
              />
              <input
                type="text"
                placeholder="Rechercher un devis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "40px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "14px",
                  background: COLORS.surface,
                }}
              />
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <Card
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: COLORS.surface,
              }}
            >
              <FileText
                size={48}
                style={{ margin: "0 auto", opacity: 0.3, marginBottom: "16px" }}
              />
              <p style={{ color: COLORS.muted, marginBottom: "16px" }}>
                Aucun devis trouvé
              </p>
              <Button variant="primary" onClick={openNewDevis}>
                Créer un devis
              </Button>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {filtered.map((d) => {
                const totals = calcTotals(d.lots);
                return (
                  <Card key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: COLORS.dark,
                        }}
                      >
                        {d.objet}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: COLORS.muted,
                          marginTop: "4px",
                        }}
                      >
                        {customers.find((c) => c.id === d.customerId)?.name} •{" "}
                        {fmtDate(d.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: COLORS.dark,
                          }}
                        >
                          {fmtMoney(totals.totalTTC)}
                        </div>
                        <Badge
                          label={d.status === "BROUILLON" ? "Brouillon" : d.status === "ACCEPTE" ? "Accepté" : "Envoyé"}
                          variant={
                            d.status === "ACCEPTE"
                              ? "success"
                              : d.status === "BROUILLON"
                                ? "warning"
                                : "info"
                          }
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDevis(d.id)}
                          icon={<Eye size={16} />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDevis(d.id)}
                          icon={<Edit size={16} />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateDevis(d.id)}
                          icon={<Copy size={16} />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDevis(d.id)}
                          icon={<Trash2 size={16} />}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Tabs at bottom */}
          <div style={{ marginTop: "32px" }}>
            <TabNav tabs={tabs} activeTab={tab} onChange={setTab} />
          </div>
        </div>
      </div>
    );
  }

  // ─── DEVIS FORM VIEW ────────────────────────────────────────────────────
  if (tab === "devis" && view === "form" && formData) {
    const totals = calcTotals(formData.lots, formData.remisePercent);

    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px" }}>
        <MaterialModal
          isOpen={materialModalOpen}
          onClose={() => setMaterialModalOpen(false)}
          onSelect={(material) => {
            if (materialLotIndex !== null && formData.lots[materialLotIndex]) {
              const newLots = [...formData.lots];
              newLots[materialLotIndex].lignes.push({
                designation: material.designation,
                description: material.description,
                quantite: 1,
                unite: material.unite,
                prixUnitHT: material.prixUnitHT,
                tauxTVA: material.tauxTVA,
              });
              setFormData({ ...formData, lots: newLots });
            }
          }}
        />

        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: COLORS.dark }}>
              {editId ? "Modifier le devis" : "Nouveau devis"}
            </h1>
            <Button variant="ghost" onClick={() => setView("list")} icon={<ArrowLeft size={18} />}>
              Retour
            </Button>
          </div>

          {/* Form */}
          <Card style={{ marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <Input
                label="Objet du devis"
                value={formData.objet}
                onChange={(v) => setFormData({ ...formData, objet: v })}
                placeholder="Ex: Rénovation salle de bain"
              />
              <Select
                label="Client"
                value={formData.customerId}
                onChange={(v) => setFormData({ ...formData, customerId: v })}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Input
                label="Valide jusqu'au"
                value={formData.validUntil}
                onChange={(v) => setFormData({ ...formData, validUntil: v })}
                type="date"
              />
              <Input
                label="Remise (%)"
                value={formData.remisePercent}
                onChange={(v) => setFormData({ ...formData, remisePercent: parseFloat(v) || 0 })}
                type="number"
              />
            </div>
            <Input
              label="Conditions de paiement"
              value={formData.conditions}
              onChange={(v) => setFormData({ ...formData, conditions: v })}
              placeholder="Paiement à 30 jours"
              style={{ marginTop: "16px" }}
            />
            <Input
              label="Notes"
              value={formData.notes}
              onChange={(v) => setFormData({ ...formData, notes: v })}
              placeholder="Notes internes..."
              style={{ marginTop: "16px" }}
            />
          </Card>

          {/* Lots */}
          {formData.lots.map((lot: Lot, lotIdx: number) => (
            <Card key={lotIdx} style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <Input
                  label="Titre du lot"
                  value={lot.titre}
                  onChange={(v) => {
                    const newLots = [...formData.lots];
                    newLots[lotIdx].titre = v;
                    setFormData({ ...formData, lots: newLots });
                  }}
                  style={{ marginBottom: 0 }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMaterialLotIndex(lotIdx);
                    setMaterialModalOpen(true);
                  }}
                  icon={<Package size={16} />}
                  style={{ marginTop: "24px", marginLeft: "12px" }}
                >
                  Matériaux
                </Button>
              </div>

              {/* Lines */}
              <div style={{ display: "grid", gap: "12px" }}>
                {lot.lignes.map((ligne: Ligne, ligIdx: number) => (
                  <div
                    key={ligIdx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
                      gap: "8px",
                      alignItems: "end",
                    }}
                  >
                    <Input
                      label={ligIdx === 0 ? "Désignation" : ""}
                      value={ligne.designation}
                      onChange={(v) => {
                        const newLots = [...formData.lots];
                        newLots[lotIdx].lignes[ligIdx].designation = v;
                        setFormData({ ...formData, lots: newLots });
                      }}
                      placeholder="Description du travail"
                    />
                    <Input
                      label={ligIdx === 0 ? "Qty" : ""}
                      value={ligne.quantite}
                      onChange={(v) => {
                        const newLots = [...formData.lots];
                        newLots[lotIdx].lignes[ligIdx].quantite = parseFloat(v) || 0;
                        setFormData({ ...formData, lots: newLots });
                      }}
                      type="number"
                    />
                    <Select
                      label={ligIdx === 0 ? "Unité" : ""}
                      value={ligne.unite}
                      onChange={(v) => {
                        const newLots = [...formData.lots];
                        newLots[lotIdx].lignes[ligIdx].unite = v;
                        setFormData({ ...formData, lots: newLots });
                      }}
                      options={["u", "m²", "ml", "m³", "h", "forfait", "kg", "l"].map((u) => ({
                        value: u,
                        label: u,
                      }))}
                    />
                    <Input
                      label={ligIdx === 0 ? "Prix HT" : ""}
                      value={ligne.prixUnitHT}
                      onChange={(v) => {
                        const newLots = [...formData.lots];
                        newLots[lotIdx].lignes[ligIdx].prixUnitHT = parseFloat(v) || 0;
                        setFormData({ ...formData, lots: newLots });
                      }}
                      type="number"
                    />
                    <Select
                      label={ligIdx === 0 ? "TVA" : ""}
                      value={ligne.tauxTVA}
                      onChange={(v) => {
                        const newLots = [...formData.lots];
                        newLots[lotIdx].lignes[ligIdx].tauxTVA = parseFloat(v) || 0;
                        setFormData({ ...formData, lots: newLots });
                      }}
                      options={[
                        { value: "0", label: "0%" },
                        { value: "5.5", label: "5,5%" },
                        { value: "10", label: "10%" },
                        { value: "20", label: "20%" },
                      ]}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        const newLots = [...formData.lots];
                        newLots[lotIdx].lignes.splice(ligIdx, 1);
                        setFormData({ ...formData, lots: newLots });
                      }}
                      icon={<Trash2 size={14} />}
                    />
                  </div>
                ))}
              </div>

              {/* Add line button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const newLots = [...formData.lots];
                  newLots[lotIdx].lignes.push(emptyLigne());
                  setFormData({ ...formData, lots: newLots });
                }}
                icon={<Plus size={14} />}
                style={{ marginTop: "12px" }}
              >
                Ajouter une ligne
              </Button>
            </Card>
          ))}

          {/* Add lot button */}
          <Button
            variant="secondary"
            onClick={() => {
              setFormData({
                ...formData,
                lots: [...formData.lots, emptyLot(formData.lots.length)],
              });
            }}
            icon={<Plus size={16} />}
            style={{ marginBottom: "20px" }}
          >
            Ajouter un lot
          </Button>

          {/* Totals Summary */}
          <Card
            style={{
              background: `linear-gradient(135deg, ${COLORS.orange}10 0%, ${COLORS.amber}10 100%)`,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "20px",
                textAlign: "right",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: COLORS.muted }}>Total HT</div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: COLORS.dark,
                    marginTop: "4px",
                  }}
                >
                  {fmtMoney(totals.totalHT)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: COLORS.muted }}>TVA</div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: COLORS.dark,
                    marginTop: "4px",
                  }}
                >
                  {fmtMoney(totals.totalTVA)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: COLORS.muted }}>Total TTC</div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: COLORS.orange,
                    marginTop: "4px",
                  }}
                >
                  {fmtMoney(totals.totalTTC)}
                </div>
              </div>
            </div>
          </Card>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "32px",
              justifyContent: "flex-end",
            }}
          >
            <Button variant="secondary" onClick={() => setView("list")}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={saveDevis}
              loading={saving}
              icon={<Save size={16} />}
            >
              {editId ? "Mettre à jour" : "Créer le devis"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── DEVIS DETAIL VIEW ──────────────────────────────────────────────────
  if (tab === "devis" && view === "detail" && detailData) {
    const totals = calcTotals(detailData.lots);
    const customer = customers.find((c) => c.id === detailData.customerId);

    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 700, color: COLORS.dark }}>
                {detailData.objet}
              </h1>
              <p style={{ fontSize: "14px", color: COLORS.muted, marginTop: "4px" }}>
                {customer?.name} • {fmtDate(detailData.createdAt)}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setView("list")} icon={<ArrowLeft size={18} />}>
              Retour
            </Button>
          </div>

          {/* Content */}
          <Card style={{ marginBottom: "20px" }}>
            {detailData.lots.map((lot: any, idx: number) => (
              <div key={idx} style={{ marginBottom: idx < detailData.lots.length - 1 ? "24px" : "0" }}>
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: COLORS.dark,
                    marginBottom: "12px",
                  }}
                >
                  {lot.titre}
                </h3>
                <div
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: "13px",
                  }}
                >
                  {lot.lignes.map((ligne: any, lidx: number) => {
                    const lht = ligne.quantite * ligne.prixUnitHT;
                    return (
                      <div
                        key={lidx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                          gap: "12px",
                          padding: "12px 0",
                          borderBottom:
                            lidx < lot.lignes.length - 1
                              ? `1px solid ${COLORS.border}`
                              : "none",
                          alignItems: "center",
                        }}
                      >
                        <div>{ligne.designation}</div>
                        <div style={{ textAlign: "center" }}>{ligne.quantite}</div>
                        <div style={{ textAlign: "center" }}>{ligne.unite}</div>
                        <div style={{ textAlign: "right" }}>
                          {fmtMoney(ligne.prixUnitHT)}
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 600 }}>
                          {fmtMoney(lht)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>

          {/* Totals */}
          <Card
            style={{
              background: `linear-gradient(135deg, ${COLORS.orange}10 0%, ${COLORS.amber}10 100%)`,
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "40px" }}>
              <div>
                <div style={{ fontSize: "12px", color: COLORS.muted }}>Total HT</div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: COLORS.dark,
                    marginTop: "4px",
                  }}
                >
                  {fmtMoney(totals.totalHT)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: COLORS.muted }}>TVA</div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: COLORS.dark,
                    marginTop: "4px",
                  }}
                >
                  {fmtMoney(totals.totalTVA)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: COLORS.muted }}>Total TTC</div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 700,
                    color: COLORS.orange,
                    marginTop: "4px",
                  }}
                >
                  {fmtMoney(totals.totalTTC)}
                </div>
              </div>
            </div>
          </Card>

          {/* Conditions */}
          {detailData.conditions && (
            <Card style={{ marginBottom: "20px" }}>
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: COLORS.dark,
                  marginBottom: "8px",
                }}
              >
                Conditions de paiement
              </h3>
              <p style={{ fontSize: "13px", color: COLORS.muted }}>
                {detailData.conditions}
              </p>
            </Card>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "12px" }}>
              <Button
                variant="secondary"
                onClick={() => openEditDevis(detailData.id)}
                icon={<Edit size={16} />}
              >
                Modifier
              </Button>
              <Button
                variant="secondary"
                onClick={() => duplicateDevis(detailData.id)}
                icon={<Copy size={16} />}
              >
                Dupliquer
              </Button>
              <Button
                variant="secondary"
                onClick={() => deleteDevis(detailData.id)}
                icon={<Trash2 size={16} />}
              >
                Supprimer
              </Button>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                setConvertModal({
                  devisId: detailData.id,
                  type: "FACTURE",
                  pourcentage: 100,
                })
              }
              icon={<ArrowRight size={16} />}
            >
              Convertir en facture
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── FACTURES VIEW ──────────────────────────────────────────────────────
  if (tab === "factures") {
    const filtered = facturesList.filter((f) =>
      f.numero?.toString().includes(search) ||
      customers.find((c) => c.id === f.customerId)?.name.toLowerCase().includes(search.toLowerCase())
    );

    const statusColors: Record<string, string> = {
      EN_ATTENTE: COLORS.warning,
      PAYEE: COLORS.success,
      EN_RETARD: COLORS.danger,
      ANNULEE: COLORS.muted,
    };

    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: 700, color: COLORS.dark }}>
                Factures
              </h1>
              <p style={{ fontSize: "14px", color: COLORS.muted, marginTop: "4px" }}>
                Gérez vos factures et suivi de paiement
              </p>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
            <StatCard
              label="Total factures"
              value={filtered.length}
              icon="📄"
              variant="default"
            />
            <StatCard
              label="Montant HT"
              value={fmtMoney(
                filtered.reduce((sum, f) => sum + (f.montantHT || 0), 0)
              )}
              icon="💰"
              variant="success"
            />
            <StatCard
              label="Payées"
              value={filtered.filter((f) => f.status === "PAYEE").length}
              icon="✓"
              variant="success"
            />
            <StatCard
              label="En retard"
              value={filtered.filter((f) => f.status === "EN_RETARD").length}
              icon="⚠️"
              variant="danger"
            />
          </div>

          {/* Search */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.muted,
                }}
              />
              <input
                type="text"
                placeholder="Rechercher une facture..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "40px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "14px",
                  background: COLORS.surface,
                }}
              />
            </div>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <Card
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: COLORS.surface,
              }}
            >
              <CreditCard
                size={48}
                style={{ margin: "0 auto", opacity: 0.3, marginBottom: "16px" }}
              />
              <p style={{ color: COLORS.muted }}>Aucune facture trouvée</p>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {filtered.map((f) => (
                <Card key={f.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: COLORS.dark,
                        }}
                      >
                        {f.numero}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: COLORS.muted,
                          marginTop: "4px",
                        }}
                      >
                        {customers.find((c) => c.id === f.customerId)?.name} •{" "}
                        {fmtDate(f.dateFacture)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: COLORS.dark,
                          }}
                        >
                          {fmtMoney(f.montantTTC || f.montantHT)}
                        </div>
                        <Badge
                          label={
                            f.status === "PAYEE"
                              ? "Payée"
                              : f.status === "EN_RETARD"
                                ? "En retard"
                                : f.status === "EN_ATTENTE"
                                  ? "En attente"
                                  : "Annulée"
                          }
                          variant={
                            f.status === "PAYEE"
                              ? "success"
                              : f.status === "EN_RETARD"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </div>
                      <Select
                        value={f.status}
                        onChange={(status) => updateFactureStatus(f.id, status)}
                        options={[
                          { value: "EN_ATTENTE", label: "En attente" },
                          { value: "PAYEE", label: "Payée" },
                          { value: "EN_RETARD", label: "En retard" },
                          { value: "ANNULEE", label: "Annulée" },
                        ]}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Tabs at bottom */}
          <div style={{ marginTop: "32px" }}>
            <TabNav tabs={tabs} activeTab={tab} onChange={setTab} />
          </div>
        </div>
      </div>
    );
  }

  // ─── ARTICLES VIEW ──────────────────────────────────────────────────────
  if (tab === "articles") {
    const filtered = articles.filter((a) =>
      a.designation.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: 700, color: COLORS.dark }}>
                Articles
              </h1>
              <p style={{ fontSize: "14px", color: COLORS.muted, marginTop: "4px" }}>
                Bibliothèque d'articles et services
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setArticleForm({ categorie: "", designation: "", unite: "u", prixUnitHT: 0, tauxTVA: 20 })}
              icon={<Plus size={18} />}
            >
              Nouvel article
            </Button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
            <StatCard
              label="Total articles"
              value={filtered.length}
              icon="📦"
              variant="default"
            />
          </div>

          {/* Search */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.muted,
                }}
              />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "40px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "14px",
                  background: COLORS.surface,
                }}
              />
            </div>
          </div>

          {/* Article form modal */}
          {articleForm && (
            <Card style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <Input
                  label="Catégorie"
                  value={articleForm.categorie}
                  onChange={(v) => setArticleForm({ ...articleForm, categorie: v })}
                  placeholder="Ex: Plomberie"
                />
                <Input
                  label="Désignation"
                  value={articleForm.designation}
                  onChange={(v) => setArticleForm({ ...articleForm, designation: v })}
                  placeholder="Ex: Tuyau PVC 20mm"
                />
                <Input
                  label="Unité"
                  value={articleForm.unite}
                  onChange={(v) => setArticleForm({ ...articleForm, unite: v })}
                  placeholder="u"
                />
                <Input
                  label="Prix HT"
                  value={articleForm.prixUnitHT}
                  onChange={(v) => setArticleForm({ ...articleForm, prixUnitHT: parseFloat(v) || 0 })}
                  type="number"
                />
                <Select
                  label="TVA"
                  value={articleForm.tauxTVA}
                  onChange={(v) => setArticleForm({ ...articleForm, tauxTVA: parseFloat(v) || 0 })}
                  options={[
                    { value: "0", label: "0%" },
                    { value: "5.5", label: "5,5%" },
                    { value: "10", label: "10%" },
                    { value: "20", label: "20%" },
                  ]}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <Button
                  variant="secondary"
                  onClick={() => setArticleForm(null)}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={saveArticle}
                  loading={saving}
                  icon={<Save size={16} />}
                >
                  Enregistrer
                </Button>
              </div>
            </Card>
          )}

          {/* List */}
          {filtered.length === 0 ? (
            <Card
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: COLORS.surface,
              }}
            >
              <Package
                size={48}
                style={{ margin: "0 auto", opacity: 0.3, marginBottom: "16px" }}
              />
              <p style={{ color: COLORS.muted, marginBottom: "16px" }}>
                Aucun article trouvé
              </p>
              <Button
                variant="primary"
                onClick={() => setArticleForm({ categorie: "", designation: "", unite: "u", prixUnitHT: 0, tauxTVA: 20 })}
              >
                Créer un article
              </Button>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {filtered.map((a) => (
                <Card key={a.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: COLORS.dark,
                        }}
                      >
                        {a.designation}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: COLORS.muted,
                          marginTop: "4px",
                        }}
                      >
                        {a.categorie || "Sans catégorie"} • {a.unite}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: COLORS.dark,
                          }}
                        >
                          {fmtMoney(a.prixUnitHT)}
                        </div>
                        <Badge
                          label={`TVA ${a.tauxTVA}%`}
                          variant="info"
                        />
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setArticleForm(a)}
                          icon={<Edit size={16} />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteArticle(a.id)}
                          icon={<Trash2 size={16} />}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Tabs at bottom */}
          <div style={{ marginTop: "32px" }}>
            <TabNav tabs={tabs} activeTab={tab} onChange={setTab} />
          </div>
        </div>
      </div>
    );
  }

  // ─── CLIENTS VIEW ───────────────────────────────────────────────────────
  if (tab === "clients") {
    const filtered = customers.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
      <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px" }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "32px",
            }}
          >
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: 700, color: COLORS.dark }}>
                Clients
              </h1>
              <p style={{ fontSize: "14px", color: COLORS.muted, marginTop: "4px" }}>
                Base de données de vos clients
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setCustomerForm({ type: "PARTICULIER", name: "", email: "", phone: "" })}
              icon={<Plus size={18} />}
            >
              Nouveau client
            </Button>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "32px" }}>
            <StatCard
              label="Total clients"
              value={filtered.length}
              icon="👥"
              variant="default"
            />
          </div>

          {/* Search */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.muted,
                }}
              />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "40px",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "14px",
                  background: COLORS.surface,
                }}
              />
            </div>
          </div>

          {/* Customer form modal */}
          {customerForm && (
            <Card style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <Input
                  label="Nom"
                  value={customerForm.name}
                  onChange={(v) => setCustomerForm({ ...customerForm, name: v })}
                  placeholder="Nom du client"
                />
                <Select
                  label="Type"
                  value={customerForm.type}
                  onChange={(v) => setCustomerForm({ ...customerForm, type: v })}
                  options={[
                    { value: "PARTICULIER", label: "Particulier" },
                    { value: "ENTREPRISE", label: "Entreprise" },
                  ]}
                />
                <Input
                  label="Email"
                  value={customerForm.email}
                  onChange={(v) => setCustomerForm({ ...customerForm, email: v })}
                  placeholder="email@example.com"
                />
                <Input
                  label="Téléphone"
                  value={customerForm.phone}
                  onChange={(v) => setCustomerForm({ ...customerForm, phone: v })}
                  placeholder="+33 6 XX XX XX XX"
                />
                <Input
                  label="Adresse"
                  value={customerForm.adresse}
                  onChange={(v) => setCustomerForm({ ...customerForm, adresse: v })}
                  placeholder="Rue, numéro..."
                  style={{ gridColumn: "1 / -1" }}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <Button
                  variant="secondary"
                  onClick={() => setCustomerForm(null)}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={saveCustomer}
                  loading={saving}
                  icon={<Save size={16} />}
                >
                  Enregistrer
                </Button>
              </div>
            </Card>
          )}

          {/* List */}
          {filtered.length === 0 ? (
            <Card
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: COLORS.surface,
              }}
            >
              <Users
                size={48}
                style={{ margin: "0 auto", opacity: 0.3, marginBottom: "16px" }}
              />
              <p style={{ color: COLORS.muted, marginBottom: "16px" }}>
                Aucun client trouvé
              </p>
              <Button
                variant="primary"
                onClick={() => setCustomerForm({ type: "PARTICULIER", name: "", email: "", phone: "" })}
              >
                Ajouter un client
              </Button>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {filtered.map((c) => (
                <Card key={c.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: COLORS.dark,
                        }}
                      >
                        {c.name}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: COLORS.muted,
                          marginTop: "4px",
                        }}
                      >
                        {c.email && <>{c.email} • </>}
                        {c.phone}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Badge
                        label={c.type === "PARTICULIER" ? "Particulier" : "Entreprise"}
                        variant="info"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomerForm(c)}
                        icon={<Edit size={16} />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCustomer(c.id)}
                        icon={<Trash2 size={16} />}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Tabs at bottom */}
          <div style={{ marginTop: "32px" }}>
            <TabNav tabs={tabs} activeTab={tab} onChange={setTab} />
          </div>
        </div>
      </div>
    );
  }

  // ─── CONVERT MODAL ──────────────────────────────────────────────────────
  if (convertModal) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}
        onClick={() => setConvertModal(null)}
      >
        <Card
          onClick={(e: any) => e.stopPropagation()}
          style={{
            width: "90%",
            maxWidth: "500px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: COLORS.dark, marginBottom: "16px" }}>
            Convertir en facture
          </h2>
          <Select
            label="Type de facture"
            value={convertModal.type}
            onChange={(v) => setConvertModal({ ...convertModal, type: v })}
            options={[
              { value: "FACTURE", label: "Facture" },
              { value: "ACOMPTE", label: "Acompte" },
              { value: "SITUATION", label: "Situation" },
              { value: "AVOIR", label: "Avoir" },
            ]}
          />
          <Input
            label="Pourcentage (%)"
            value={convertModal.pourcentage}
            onChange={(v) => setConvertModal({ ...convertModal, pourcentage: parseFloat(v) || 100 })}
            type="number"
            style={{ marginTop: "16px" }}
          />
          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <Button variant="secondary" onClick={() => setConvertModal(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={convertDevis}
              loading={saving}
              icon={<ArrowRight size={16} />}
            >
              Convertir
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
