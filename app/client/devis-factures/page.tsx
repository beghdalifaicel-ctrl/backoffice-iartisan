"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Plus, Search, ChevronRight, ChevronDown, Trash2, Copy, ArrowRight,
  Download, Eye, Edit, Save, X, Package, Users, CreditCard, Check,
  ArrowLeft, Loader2, BookOpen, RefreshCw
} from "lucide-react";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
  red: "#dc2626", blue: "#2563eb",
};

const UNITES = ["u", "m²", "ml", "m³", "h", "forfait", "kg", "l", "lot"];
const TVA_RATES = [
  { value: 20, label: "20% (standard)" },
  { value: 10, label: "10% (rénovation)" },
  { value: 5.5, label: "5,5% (amélioration énerg.)" },
  { value: 0, label: "0% (exonéré)" },
];

const DEVIS_STATUS: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon", color: C.muted },
  ENVOYE: { label: "Envoyé", color: C.blue },
  ACCEPTE: { label: "Accepté", color: C.green },
  REFUSE: { label: "Refusé", color: C.red },
  EXPIRE: { label: "Expiré", color: C.yellow },
};

const FACTURE_STATUS: Record<string, { label: string; color: string }> = {
  EN_ATTENTE: { label: "En attente", color: C.yellow },
  PAYEE: { label: "Payée", color: C.green },
  EN_RETARD: { label: "En retard", color: C.red },
  ANNULEE: { label: "Annulée", color: C.muted },
};

const FACTURE_TYPE: Record<string, string> = {
  FACTURE: "Facture", ACOMPTE: "Acompte", SITUATION: "Situation", AVOIR: "Avoir",
};

// ─── TYPES ──────────────────────────────────────────────────────────────────

type Customer = { id: string; name: string; email?: string; phone?: string; type: string; adresse?: string; codePostal?: string; ville?: string; siret?: string; tvaIntra?: string };
type Article = { id: string; categorie?: string; designation: string; description?: string; unite: string; prixUnitHT: number; tauxTVA: number };
type Ligne = { id?: string; designation: string; description?: string; quantite: number; unite: string; prixUnitHT: number; tauxTVA: number };
type Lot = { id?: string; titre: string; lignes: Ligne[] };
type Devis = any;
type Facture = any;

function fmtMoney(n: number) { return n.toFixed(2).replace(".", ",") + " €"; }
function fmtDate(d: string) { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)); }

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, fontWeight: 700, background: `${color}18`, color }}>{label}</span>;
}

function Btn({ children, onClick, variant = "primary", small, disabled, style: extraStyle }: any) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8,
    fontWeight: 600, fontSize: small ? 12 : 13, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Bricolage Grotesque', sans-serif", opacity: disabled ? 0.5 : 1,
    padding: small ? "6px 12px" : "10px 18px", transition: "all 0.15s",
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: C.accent, color: "#fff" },
    secondary: { background: C.surface, color: C.dark, border: `1px solid ${C.border}` },
    danger: { background: `${C.red}15`, color: C.red },
    ghost: { background: "transparent", color: C.muted, padding: small ? "4px 8px" : "8px 12px" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>{children}</button>;
}

function Input({ label, value, onChange, placeholder, type, style: s }: any) {
  return (
    <div style={{ flex: 1, ...s }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{label}</div>}
      <input
        type={type || "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", background: C.surface, outline: "none" }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, style: s }: any) {
  return (
    <div style={{ flex: 1, ...s }}>
      {label && <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{label}</div>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", background: C.surface }}>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── EMPTY LOT ──────────────────────────────────────────────────────────────
function emptyLot(idx: number): Lot {
  return { titre: `Lot ${idx + 1}`, lignes: [{ designation: "", quantite: 1, unite: "u", prixUnitHT: 0, tauxTVA: 20 }] };
}

function emptyLigne(): Ligne {
  return { designation: "", quantite: 1, unite: "u", prixUnitHT: 0, tauxTVA: 20 };
}

// ─── TOTALS CALC ────────────────────────────────────────────────────────────
function calcTotals(lots: Lot[], remise: number) {
  let ht = 0, tva = 0;
  for (const lot of lots) for (const l of lot.lignes) {
    const lht = l.quantite * l.prixUnitHT;
    ht += lht;
    tva += lht * (l.tauxTVA / 100);
  }
  if (remise > 0) { ht *= (1 - remise / 100); tva *= (1 - remise / 100); }
  return { totalHT: Math.round(ht * 100) / 100, totalTVA: Math.round(tva * 100) / 100, totalTTC: Math.round((ht + tva) * 100) / 100 };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function DevisFacturesPage() {
  // ─── STATE ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"devis" | "factures" | "articles" | "clients">("devis");
  const [view, setView] = useState<"list" | "form" | "detail">("list");

  // Data
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [facturesList, setFacturesList] = useState<Facture[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Current edit
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);

  // Article form
  const [articleForm, setArticleForm] = useState<any>(null);

  // Customer form
  const [customerForm, setCustomerForm] = useState<any>(null);

  // Convert modal
  const [convertModal, setConvertModal] = useState<{ devisId: string; type: string; pourcentage: number } | null>(null);

  // ─── FETCH ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, fRes, aRes, cRes] = await Promise.all([
        fetch("/api/client/devis"), fetch("/api/client/factures-btp"),
        fetch("/api/client/articles"), fetch("/api/client/customers"),
      ]);
      if (dRes.ok) setDevisList(await dRes.json());
      if (fRes.ok) setFacturesList(await fRes.json());
      if (aRes.ok) setArticles(await aRes.json());
      if (cRes.ok) setCustomers(await cRes.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── DEVIS ACTIONS ────────────────────────────────────────────────────
  const openNewDevis = () => {
    setFormData({
      objet: "", customerId: customers[0]?.id || "", validUntil: "",
      conditions: "Paiement à 30 jours", notes: "", remisePercent: 0,
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
      objet: d.objet, customerId: d.customerId,
      validUntil: d.validUntil ? d.validUntil.slice(0, 10) : "",
      conditions: d.conditions || "", notes: d.notes || "",
      remisePercent: d.remisePercent || 0,
      lots: d.lots.map((l: any) => ({
        titre: l.titre,
        lignes: l.lignes.map((li: any) => ({
          designation: li.designation, description: li.description || "",
          quantite: li.quantite, unite: li.unite, prixUnitHT: li.prixUnitHT, tauxTVA: li.tauxTVA,
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
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
    if (res.ok) { await fetchAll(); setView("list"); }
    setSaving(false);
  };

  const deleteDevis = async (id: string) => {
    if (!confirm("Supprimer ce devis ?")) return;
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
      body: JSON.stringify({ type: convertModal.type, pourcentage: convertModal.pourcentage }),
    });
    if (res.ok) {
      await fetchAll();
      setConvertModal(null);
      setTab("factures");
      setView("list");
    }
    setSaving(false);
  };

  // ─── FACTURE ACTIONS ──────────────────────────────────────────────────
  const updateFactureStatus = async (id: string, status: string) => {
    await fetch(`/api/client/factures-btp/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAll();
  };

  const deleteFacture = async (id: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    await fetch(`/api/client/factures-btp/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // ─── ARTICLE ACTIONS ──────────────────────────────────────────────────
  const saveArticle = async () => {
    if (!articleForm) return;
    setSaving(true);
    const method = articleForm.id ? "PUT" : "POST";
    const url = articleForm.id ? `/api/client/articles/${articleForm.id}` : "/api/client/articles";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(articleForm) });
    setArticleForm(null);
    await fetchAll();
    setSaving(false);
  };

  const deleteArticle = async (id: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    await fetch(`/api/client/articles/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // ─── CUSTOMER ACTIONS ─────────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!customerForm) return;
    setSaving(true);
    await fetch("/api/client/customers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(customerForm),
    });
    setCustomerForm(null);
    await fetchAll();
    setSaving(false);
  };

  // ─── INSERT ARTICLE INTO FORM ─────────────────────────────────────────
  const insertArticle = (lotIdx: number, art: Article) => {
    if (!formData) return;
    const newLots = [...formData.lots];
    newLots[lotIdx] = {
      ...newLots[lotIdx],
      lignes: [...newLots[lotIdx].lignes, {
        designation: art.designation, description: art.description || "",
        quantite: 1, unite: art.unite, prixUnitHT: art.prixUnitHT, tauxTVA: art.tauxTVA,
      }],
    };
    setFormData({ ...formData, lots: newLots });
  };

  // ─── UPDATE FORM HELPERS ──────────────────────────────────────────────
  const updateLot = (lotIdx: number, key: string, val: any) => {
    const lots = [...formData.lots];
    lots[lotIdx] = { ...lots[lotIdx], [key]: val };
    setFormData({ ...formData, lots });
  };

  const updateLigne = (lotIdx: number, ligneIdx: number, key: string, val: any) => {
    const lots = [...formData.lots];
    const lignes = [...lots[lotIdx].lignes];
    lignes[ligneIdx] = { ...lignes[ligneIdx], [key]: key === "quantite" || key === "prixUnitHT" || key === "tauxTVA" ? parseFloat(val) || 0 : val };
    lots[lotIdx] = { ...lots[lotIdx], lignes };
    setFormData({ ...formData, lots });
  };

  const addLot = () => setFormData({ ...formData, lots: [...formData.lots, emptyLot(formData.lots.length)] });
  const removeLot = (idx: number) => { if (formData.lots.length > 1) setFormData({ ...formData, lots: formData.lots.filter((_: any, i: number) => i !== idx) }); };
  const addLigne = (lotIdx: number) => {
    const lots = [...formData.lots];
    lots[lotIdx] = { ...lots[lotIdx], lignes: [...lots[lotIdx].lignes, emptyLigne()] };
    setFormData({ ...formData, lots });
  };
  const removeLigne = (lotIdx: number, ligneIdx: number) => {
    const lots = [...formData.lots];
    if (lots[lotIdx].lignes.length > 1) {
      lots[lotIdx] = { ...lots[lotIdx], lignes: lots[lotIdx].lignes.filter((_: any, i: number) => i !== ligneIdx) };
      setFormData({ ...formData, lots });
    }
  };

  // ─── FILTERED LISTS ───────────────────────────────────────────────────
  const q = search.toLowerCase();
  const filteredDevis = devisList.filter(d => d.number.toLowerCase().includes(q) || d.objet.toLowerCase().includes(q) || d.customer?.name?.toLowerCase().includes(q));
  const filteredFactures = facturesList.filter(f => f.number.toLowerCase().includes(q) || f.objet.toLowerCase().includes(q) || f.customer?.name?.toLowerCase().includes(q));
  const filteredArticles = articles.filter(a => a.designation.toLowerCase().includes(q) || (a.categorie || "").toLowerCase().includes(q));

  // ─── RENDER ───────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ═══ DEVIS FORM ═══════════════════════════════════════════════════════
  if (view === "form" && formData) {
    const totals = calcTotals(formData.lots, formData.remisePercent);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        {/* Top bar */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(247,244,239,0.95)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Btn variant="ghost" onClick={() => setView("list")}><ArrowLeft size={16} /> Retour</Btn>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{editId ? "Modifier le devis" : "Nouveau devis"}</div>
          <Btn onClick={saveDevis} disabled={saving || !formData.customerId}>
            {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
            Enregistrer
          </Btn>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
          {/* Client + Objet */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Select label="Client" value={formData.customerId} onChange={(v: string) => setFormData({ ...formData, customerId: v })}
                options={[{ value: "", label: "— Sélectionner —" }, ...customers.map(c => ({ value: c.id, label: c.name }))]}
                style={{ flex: 2 }}
              />
              <Btn variant="secondary" small onClick={() => setCustomerForm({ type: "PARTICULIER", name: "", email: "", phone: "", adresse: "", codePostal: "", ville: "" })} style={{ alignSelf: "flex-end" }}>
                <Plus size={14} /> Client
              </Btn>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <Input label="Objet du devis" value={formData.objet} onChange={(v: string) => setFormData({ ...formData, objet: v })} placeholder="Rénovation salle de bain" style={{ flex: 3 }} />
              <Input label="Valide jusqu'au" type="date" value={formData.validUntil} onChange={(v: string) => setFormData({ ...formData, validUntil: v })} style={{ flex: 1, minWidth: 140 }} />
            </div>
          </div>

          {/* Lots */}
          {formData.lots.map((lot: Lot, lotIdx: number) => (
            <div key={lotIdx} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, marginBottom: 12, overflow: "hidden" }}>
              {/* Lot header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: `${C.dark}08`, borderBottom: `1px solid ${C.border}` }}>
                <Package size={16} color={C.accent} />
                <input value={lot.titre} onChange={e => updateLot(lotIdx, "titre", e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", fontWeight: 700, fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", outline: "none" }}
                />
                {formData.lots.length > 1 && (
                  <Btn variant="ghost" small onClick={() => removeLot(lotIdx)}><Trash2 size={14} /></Btn>
                )}
              </div>

              {/* Lignes header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 90px 100px 90px 32px", gap: 4, padding: "8px 12px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>
                <div>Désignation</div><div style={{ textAlign: "center" }}>Qté</div><div style={{ textAlign: "center" }}>Unité</div>
                <div style={{ textAlign: "right" }}>P.U. HT</div><div style={{ textAlign: "center" }}>TVA</div><div style={{ textAlign: "right" }}>Total</div><div />
              </div>

              {/* Lignes */}
              {lot.lignes.map((ligne: Ligne, lIdx: number) => {
                const lineTotal = ligne.quantite * ligne.prixUnitHT;
                return (
                  <div key={lIdx} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 90px 100px 90px 32px", gap: 4, padding: "4px 12px", alignItems: "center", borderBottom: `1px solid ${C.border}08` }}>
                    <input value={ligne.designation} onChange={e => updateLigne(lotIdx, lIdx, "designation", e.target.value)}
                      placeholder="Prestation..." style={{ border: "none", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", outline: "none", background: "transparent", width: "100%", padding: "6px 4px" }}
                    />
                    <input type="number" value={ligne.quantite} onChange={e => updateLigne(lotIdx, lIdx, "quantite", e.target.value)}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, textAlign: "center", padding: "6px 4px", width: "100%", fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    />
                    <select value={ligne.unite} onChange={e => updateLigne(lotIdx, lIdx, "unite", e.target.value)}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, textAlign: "center", padding: "6px 2px", width: "100%", fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                      {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <input type="number" value={ligne.prixUnitHT} onChange={e => updateLigne(lotIdx, lIdx, "prixUnitHT", e.target.value)}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, textAlign: "right", padding: "6px 4px", width: "100%", fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    />
                    <select value={ligne.tauxTVA} onChange={e => updateLigne(lotIdx, lIdx, "tauxTVA", e.target.value)}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, padding: "6px 2px", width: "100%", fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                      {TVA_RATES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <div style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>{fmtMoney(lineTotal)}</div>
                    <Btn variant="ghost" small onClick={() => removeLigne(lotIdx, lIdx)}><X size={12} /></Btn>
                  </div>
                );
              })}

              {/* Add ligne + insert article */}
              <div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="ghost" small onClick={() => addLigne(lotIdx)}><Plus size={12} /> Ligne</Btn>
                {articles.length > 0 && (
                  <div style={{ position: "relative" }}>
                    <select
                      value=""
                      onChange={e => {
                        const art = articles.find(a => a.id === e.target.value);
                        if (art) insertArticle(lotIdx, art);
                      }}
                      style={{ border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, padding: "4px 8px", fontFamily: "'Bricolage Grotesque', sans-serif", color: C.blue, background: `${C.blue}08` }}
                    >
                      <option value="">+ Depuis bibliothèque</option>
                      {articles.map(a => <option key={a.id} value={a.id}>{a.categorie ? `[${a.categorie}] ` : ""}{a.designation} — {fmtMoney(a.prixUnitHT)}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}

          <Btn variant="secondary" onClick={addLot} style={{ marginBottom: 16 }}><Plus size={14} /> Ajouter un lot</Btn>

          {/* Remise + Conditions + Totals */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280, background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
              <Input label="Remise globale (%)" type="number" value={formData.remisePercent} onChange={(v: string) => setFormData({ ...formData, remisePercent: parseFloat(v) || 0 })} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>Conditions</div>
                <textarea value={formData.conditions} onChange={e => setFormData({ ...formData, conditions: e.target.value })}
                  rows={3} style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, padding: "8px 10px", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ width: 280, background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Récapitulatif</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span>Total HT</span><span style={{ fontWeight: 600 }}>{fmtMoney(totals.totalHT)}</span>
              </div>
              {formData.remisePercent > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.green }}>
                  <span>Remise ({formData.remisePercent}%)</span><span>incluse</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <span>TVA</span><span style={{ fontWeight: 600 }}>{fmtMoney(totals.totalTVA)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 18, fontWeight: 800, color: C.accent }}>
                <span>TTC</span><span>{fmtMoney(totals.totalTTC)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* New customer modal */}
        {customerForm && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: 420, maxHeight: "90vh", overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Nouveau client</h3>
                <Btn variant="ghost" small onClick={() => setCustomerForm(null)}><X size={16} /></Btn>
              </div>
              <Select label="Type" value={customerForm.type} onChange={(v: string) => setCustomerForm({ ...customerForm, type: v })}
                options={[{ value: "PARTICULIER", label: "Particulier" }, { value: "PROFESSIONNEL", label: "Professionnel" }]} />
              <div style={{ height: 8 }} />
              <Input label="Nom / Raison sociale" value={customerForm.name} onChange={(v: string) => setCustomerForm({ ...customerForm, name: v })} placeholder="Jean Dupont" />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Input label="Email" value={customerForm.email} onChange={(v: string) => setCustomerForm({ ...customerForm, email: v })} placeholder="email@..." />
                <Input label="Téléphone" value={customerForm.phone} onChange={(v: string) => setCustomerForm({ ...customerForm, phone: v })} placeholder="06..." />
              </div>
              <div style={{ marginTop: 8 }}>
                <Input label="Adresse" value={customerForm.adresse} onChange={(v: string) => setCustomerForm({ ...customerForm, adresse: v })} placeholder="12 rue..." />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Input label="Code postal" value={customerForm.codePostal} onChange={(v: string) => setCustomerForm({ ...customerForm, codePostal: v })} placeholder="75001" />
                <Input label="Ville" value={customerForm.ville} onChange={(v: string) => setCustomerForm({ ...customerForm, ville: v })} placeholder="Paris" />
              </div>
              {customerForm.type === "PROFESSIONNEL" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Input label="SIRET" value={customerForm.siret || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, siret: v })} placeholder="123 456 789 00012" />
                  <Input label="TVA intra." value={customerForm.tvaIntra || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, tvaIntra: v })} placeholder="FR12345678901" />
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="secondary" onClick={() => setCustomerForm(null)}>Annuler</Btn>
                <Btn onClick={saveCustomer} disabled={!customerForm.name}><Save size={14} /> Enregistrer</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ DEVIS DETAIL ═════════════════════════════════════════════════════
  if (view === "detail" && detailData) {
    const d = detailData;
    const st = DEVIS_STATUS[d.status] || { label: d.status, color: C.muted };
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(247,244,239,0.95)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Btn variant="ghost" onClick={() => { setView("list"); setDetailData(null); }}><ArrowLeft size={16} /> Retour</Btn>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{d.number}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn variant="secondary" small onClick={() => window.open(`/api/client/devis/${d.id}/pdf`, "_blank")}><Eye size={14} /> PDF</Btn>
            <Btn variant="secondary" small onClick={() => openEditDevis(d.id)}><Edit size={14} /> Modifier</Btn>
            <Btn small onClick={() => setConvertModal({ devisId: d.id, type: "FACTURE", pourcentage: 100 })}><ArrowRight size={14} /> Facturer</Btn>
          </div>
        </div>

        <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{d.objet}</h2>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Client : <strong>{d.customer?.name}</strong></div>
              </div>
              <Badge label={st.label} color={st.color} />
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 12, color: C.muted }}>
              <span>Créé le {fmtDate(d.createdAt)}</span>
              {d.validUntil && <span>Valide jusqu'au {fmtDate(d.validUntil)}</span>}
            </div>
          </div>

          {/* Lots & Lignes */}
          {d.lots?.map((lot: any) => (
            <div key={lot.id} style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: `${C.dark}06`, fontWeight: 700, fontSize: 13, borderBottom: `1px solid ${C.border}` }}>{lot.titre}</div>
              {lot.lignes?.map((l: any) => (
                <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 80px 60px 90px", gap: 8, padding: "8px 16px", fontSize: 12, borderBottom: `1px solid ${C.border}08`, alignItems: "center" }}>
                  <div>{l.designation}</div>
                  <div style={{ textAlign: "center" }}>{l.quantite}</div>
                  <div style={{ textAlign: "center" }}>{l.unite}</div>
                  <div style={{ textAlign: "right" }}>{fmtMoney(l.prixUnitHT)}</div>
                  <div style={{ textAlign: "center" }}>{l.tauxTVA}%</div>
                  <div style={{ textAlign: "right", fontWeight: 700 }}>{fmtMoney(l.quantite * l.prixUnitHT)}</div>
                </div>
              ))}
            </div>
          ))}

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 280, background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}><span>Total HT</span><span style={{ fontWeight: 600 }}>{fmtMoney(d.totalHT)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}><span>TVA</span><span style={{ fontWeight: 600 }}>{fmtMoney(d.totalTVA)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 18, fontWeight: 800, color: C.accent }}><span>TTC</span><span>{fmtMoney(d.totalTTC)}</span></div>
            </div>
          </div>

          {/* Factures liées */}
          {d.factures?.length > 0 && (
            <div style={{ marginTop: 16, background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Factures liées</div>
              {d.factures.map((f: any) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{f.number}</span>
                  <span>{fmtMoney(f.totalTTC)}</span>
                  <Badge label={FACTURE_STATUS[f.status]?.label || f.status} color={FACTURE_STATUS[f.status]?.color || C.muted} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Convert modal */}
        {convertModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: 380 }}>
              <h3 style={{ fontWeight: 800, fontSize: 16, margin: "0 0 16px" }}>Convertir en facture</h3>
              <Select label="Type" value={convertModal.type} onChange={(v: string) => setConvertModal({ ...convertModal, type: v })}
                options={[{ value: "FACTURE", label: "Facture complète" }, { value: "ACOMPTE", label: "Acompte" }, { value: "SITUATION", label: "Situation" }]} />
              {(convertModal.type === "ACOMPTE" || convertModal.type === "SITUATION") && (
                <div style={{ marginTop: 8 }}>
                  <Input label="Pourcentage (%)" type="number" value={convertModal.pourcentage} onChange={(v: string) => setConvertModal({ ...convertModal, pourcentage: parseFloat(v) || 0 })} placeholder="30" />
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <Btn variant="secondary" onClick={() => setConvertModal(null)}>Annuler</Btn>
                <Btn onClick={convertDevis} disabled={saving}><ArrowRight size={14} /> Facturer</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══ MAIN LIST VIEW ═══════════════════════════════════════════════════

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(247,244,239,0.95)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="/client" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: C.dark }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>iA</div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Devis & Factures</span>
          </a>
          <div style={{ display: "flex", gap: 4 }}>
            {(["devis", "factures", "articles", "clients"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                background: tab === t ? C.accent : "transparent", color: tab === t ? "#fff" : C.muted,
                fontWeight: 700, fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", textTransform: "capitalize",
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>
        {/* Search + Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
            <Search size={16} color={C.muted} style={{ position: "absolute", left: 10, top: 10 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              style={{ width: "100%", padding: "10px 10px 10px 34px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", background: C.surface }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" small onClick={fetchAll}><RefreshCw size={14} /></Btn>
            {tab === "devis" && <Btn onClick={openNewDevis}><Plus size={14} /> Nouveau devis</Btn>}
            {tab === "articles" && <Btn onClick={() => setArticleForm({ categorie: "", designation: "", description: "", unite: "u", prixUnitHT: 0, tauxTVA: 20 })}><Plus size={14} /> Nouvel article</Btn>}
            {tab === "clients" && <Btn onClick={() => setCustomerForm({ type: "PARTICULIER", name: "", email: "", phone: "", adresse: "", codePostal: "", ville: "" })}><Plus size={14} /> Nouveau client</Btn>}
          </div>
        </div>

        {/* ─── DEVIS TAB ─── */}
        {tab === "devis" && (
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {filteredDevis.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
                <FileText size={32} color={C.border} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 14 }}>Aucun devis</div>
                <Btn onClick={openNewDevis} style={{ marginTop: 12 }}><Plus size={14} /> Créer un devis</Btn>
              </div>
            ) : filteredDevis.map((d: any) => {
              const st = DEVIS_STATUS[d.status] || { label: d.status, color: C.muted };
              return (
                <div key={d.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => openDetailDevis(d.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{d.number}</span>
                      <Badge label={st.label} color={st.color} />
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{d.objet} — {d.customer?.name}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{fmtMoney(d.totalTTC)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(d.createdAt)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      <Btn variant="ghost" small onClick={() => duplicateDevis(d.id)} title="Dupliquer"><Copy size={14} /></Btn>
                      <Btn variant="ghost" small onClick={() => deleteDevis(d.id)} title="Supprimer"><Trash2 size={14} color={C.red} /></Btn>
                    </div>
                    <ChevronRight size={16} color={C.muted} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── FACTURES TAB ─── */}
        {tab === "factures" && (
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {filteredFactures.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
                <CreditCard size={32} color={C.border} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 14 }}>Aucune facture</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Créez d'abord un devis puis convertissez-le en facture</div>
              </div>
            ) : filteredFactures.map((f: any) => {
              const st = FACTURE_STATUS[f.status] || { label: f.status, color: C.muted };
              return (
                <div key={f.id} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{f.number}</span>
                      <Badge label={FACTURE_TYPE[f.type] || f.type} color={C.blue} />
                      <Badge label={st.label} color={st.color} />
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {f.objet} — {f.customer?.name}
                      {f.devis && <span> (Devis {f.devis.number})</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>{fmtMoney(f.totalTTC)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(f.createdAt)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Btn variant="ghost" small onClick={() => window.open(`/api/client/factures-btp/${f.id}/pdf`, "_blank")} title="Voir PDF"><Eye size={14} /></Btn>
                      {f.status === "EN_ATTENTE" && <Btn variant="ghost" small onClick={() => updateFactureStatus(f.id, "PAYEE")} title="Marquer payée"><Check size={14} color={C.green} /></Btn>}
                      {f.status === "EN_ATTENTE" && <Btn variant="ghost" small onClick={() => updateFactureStatus(f.id, "EN_RETARD")} title="Marquer en retard"><CreditCard size={14} color={C.red} /></Btn>}
                      <Btn variant="ghost" small onClick={() => deleteFacture(f.id)} title="Supprimer"><Trash2 size={14} color={C.red} /></Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── ARTICLES TAB ─── */}
        {tab === "articles" && (
          <>
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {filteredArticles.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
                  <BookOpen size={32} color={C.border} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 14 }}>Bibliothèque vide</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Ajoutez vos prestations récurrentes pour les insérer rapidement dans vos devis</div>
                </div>
              ) : filteredArticles.map((a: any) => (
                <div key={a.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {a.categorie && <span style={{ color: C.blue, fontSize: 11 }}>[{a.categorie}] </span>}
                      {a.designation}
                    </div>
                    {a.description && <div style={{ fontSize: 11, color: C.muted }}>{a.description}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtMoney(a.prixUnitHT)}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{a.unite} — TVA {a.tauxTVA}%</div>
                    </div>
                    <Btn variant="ghost" small onClick={() => setArticleForm({ ...a })}><Edit size={14} /></Btn>
                    <Btn variant="ghost" small onClick={() => deleteArticle(a.id)}><Trash2 size={14} color={C.red} /></Btn>
                  </div>
                </div>
              ))}
            </div>

            {/* Article form modal */}
            {articleForm && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: 420 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 16, margin: "0 0 16px" }}>{articleForm.id ? "Modifier" : "Nouvel"} article</h3>
                  <Input label="Catégorie" value={articleForm.categorie || ""} onChange={(v: string) => setArticleForm({ ...articleForm, categorie: v })} placeholder="Plomberie, Électricité..." />
                  <div style={{ height: 8 }} />
                  <Input label="Désignation" value={articleForm.designation} onChange={(v: string) => setArticleForm({ ...articleForm, designation: v })} placeholder="Pose de carrelage 60x60" />
                  <div style={{ height: 8 }} />
                  <Input label="Description (optionnel)" value={articleForm.description || ""} onChange={(v: string) => setArticleForm({ ...articleForm, description: v })} placeholder="Détail..." />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Input label="Prix unit. HT" type="number" value={articleForm.prixUnitHT} onChange={(v: string) => setArticleForm({ ...articleForm, prixUnitHT: parseFloat(v) || 0 })} />
                    <Select label="Unité" value={articleForm.unite} onChange={(v: string) => setArticleForm({ ...articleForm, unite: v })}
                      options={UNITES.map(u => ({ value: u, label: u }))} />
                    <Select label="TVA" value={articleForm.tauxTVA} onChange={(v: string) => setArticleForm({ ...articleForm, tauxTVA: parseFloat(v) })}
                      options={TVA_RATES} />
                  </div>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <Btn variant="secondary" onClick={() => setArticleForm(null)}>Annuler</Btn>
                    <Btn onClick={saveArticle} disabled={!articleForm.designation}><Save size={14} /> Enregistrer</Btn>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── CLIENTS TAB ─── */}
        {tab === "clients" && (
          <>
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {customers.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
                  <Users size={32} color={C.border} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 14 }}>Aucun client</div>
                </div>
              ) : customers.filter(c => c.name.toLowerCase().includes(q)).map((c: any) => (
                <div key={c.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                      <Badge label={c.type === "PROFESSIONNEL" ? "Pro" : "Particulier"} color={c.type === "PROFESSIONNEL" ? C.blue : C.green} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {[c.email, c.phone, c.ville].filter(Boolean).join(" — ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer form modal */}
            {customerForm && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: 420 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>Nouveau client</h3>
                    <Btn variant="ghost" small onClick={() => setCustomerForm(null)}><X size={16} /></Btn>
                  </div>
                  <Select label="Type" value={customerForm.type} onChange={(v: string) => setCustomerForm({ ...customerForm, type: v })}
                    options={[{ value: "PARTICULIER", label: "Particulier" }, { value: "PROFESSIONNEL", label: "Professionnel" }]} />
                  <div style={{ height: 8 }} />
                  <Input label="Nom / Raison sociale" value={customerForm.name} onChange={(v: string) => setCustomerForm({ ...customerForm, name: v })} placeholder="Jean Dupont" />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Input label="Email" value={customerForm.email || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, email: v })} />
                    <Input label="Téléphone" value={customerForm.phone || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, phone: v })} />
                  </div>
                  <Input label="Adresse" value={customerForm.adresse || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, adresse: v })} style={{ marginTop: 8 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Input label="Code postal" value={customerForm.codePostal || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, codePostal: v })} />
                    <Input label="Ville" value={customerForm.ville || ""} onChange={(v: string) => setCustomerForm({ ...customerForm, ville: v })} />
                  </div>
                  <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <Btn variant="secondary" onClick={() => setCustomerForm(null)}>Annuler</Btn>
                    <Btn onClick={saveCustomer} disabled={!customerForm.name}><Save size={14} /> Enregistrer</Btn>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Stats summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{devisList.length}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Devis</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.green }}>{fmtMoney(devisList.filter((d: any) => d.status === "ACCEPTE").reduce((s: number, d: any) => s + d.totalTTC, 0))}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Devis acceptés</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{facturesList.length}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Factures</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.red }}>{fmtMoney(facturesList.filter((f: any) => f.status === "EN_ATTENTE" || f.status === "EN_RETARD").reduce((s: number, f: any) => s + f.totalTTC - f.montantPaye, 0))}</div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Reste à encaisser</div>
          </div>
        </div>
      </div>
    </div>
  );
}
