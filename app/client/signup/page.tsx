"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ArrowRight, Loader2 } from "lucide-react";

const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8", yellow: "#f4d03f",
  blue: "#2563eb", red: "#dc2626",
};

const PLANS = [
  {
    key: "ESSENTIEL",
    name: "Essentiel",
    price: 49,
    desc: "L'essentiel pour votre visibilité",
    features: [
      "Agent Admin (Alice)",
      "Fiche Google optimisée",
      "Réponse aux avis par IA",
      "Devis & factures",
      "500 tâches IA / mois",
    ],
  },
  {
    key: "CROISSANCE",
    name: "Pro",
    price: 99,
    popular: true,
    desc: "Pour développer votre activité",
    features: [
      "Tout Essentiel +",
      "Agent Marketing (Marc)",
      "SEO local avancé",
      "Réseaux sociaux auto",
      "2 000 tâches IA / mois",
    ],
  },
  {
    key: "PILOTE_AUTO",
    name: "Max",
    price: 179,
    desc: "Le pilote automatique complet",
    features: [
      "Tout Pro +",
      "Agent Commercial (Léa)",
      "Prospection automatique",
      "Email de prospection IA",
      "5 000 tâches IA / mois",
    ],
  },
];

export default function ClientSignupPage() {
  const router = useRouter();
  const params = useSearchParams();
  const canceled = params.get("canceled");
  const errorParam = params.get("error");

  const [step, setStep] = useState(1); // 1 = plan, 2 = form
  const [selectedPlan, setSelectedPlan] = useState("CROISSANCE");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "", company: "", metier: "", ville: "" });
  const [error, setError] = useState(canceled ? "Paiement annulé. Vous pouvez réessayer." : errorParam ? "Une erreur est survenue. Réessayez." : "");
  const [loading, setLoading] = useState(false);

  const updateForm = (key: string, value: string) => setForm({ ...form, [key]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/client/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, plan: selectedPlan }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'inscription");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError("Erreur de redirection paiement");
        setLoading(false);
      }
    } catch {
      setError("Erreur réseau");
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: `1px solid ${C.border}`, fontSize: 14, outline: "none",
    fontFamily: "'Bricolage Grotesque', sans-serif",
    background: C.bg, color: C.dark, boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 16px", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 12 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>iA</div>
          <span style={{ fontWeight: 700, fontSize: 22, color: C.dark }}>iArtisan</span>
        </div>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          {step === 1 ? "Choisissez votre offre" : "Créez votre compte"}
        </p>
        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ width: s === step ? 32 : 8, height: 8, borderRadius: 4, background: s === step ? C.accent : C.border, transition: "all 0.3s" }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        {/* ═══ STEP 1 — Plan selection ═══ */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PLANS.map(plan => (
              <button
                key={plan.key}
                onClick={() => { setSelectedPlan(plan.key); setStep(2); }}
                style={{
                  background: C.surface, borderRadius: 16, padding: "18px 16px",
                  border: selectedPlan === plan.key ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
                  cursor: "pointer", textAlign: "left", position: "relative",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                }}
              >
                {plan.popular && (
                  <div style={{ position: "absolute", top: -10, right: 16, background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                    Populaire
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.dark }}>{plan.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{plan.desc}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.accent }}>{plan.price}€</div>
                    <div style={{ fontSize: 11, color: C.muted }}>/mois HT</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.dark }}>
                      <Check size={13} color={C.green} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, color: C.accent, fontWeight: 700, fontSize: 13 }}>
                  Choisir ce plan <ArrowRight size={14} />
                </div>
              </button>
            ))}

            <p style={{ textAlign: "center", fontSize: 12, color: C.muted, marginTop: 8 }}>
              14 jours d'essai gratuit · Sans engagement · Annulable à tout moment
            </p>

            <p style={{ textAlign: "center", marginTop: 4 }}>
              <a href="/client/login" style={{ color: C.muted, fontSize: 13, textDecoration: "none" }}>
                Déjà un compte ? Se connecter
              </a>
            </p>
          </div>
        )}

        {/* ═══ STEP 2 — Account form ═══ */}
        {step === 2 && (
          <div style={{ background: C.surface, borderRadius: 16, padding: "24px 20px", border: `1px solid ${C.border}` }}>
            {/* Selected plan recap */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: `${C.accent}08`, border: `1px solid ${C.accent}20`, marginBottom: 20 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>
                  Offre {PLANS.find(p => p.key === selectedPlan)?.name}
                </span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>14j gratuit</span>
              </div>
              <button
                onClick={() => setStep(1)}
                style={{ fontSize: 12, color: C.accent, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif" }}
              >
                Changer
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Prénom *</label>
                  <input value={form.firstName} onChange={e => updateForm("firstName", e.target.value)} placeholder="Jean" required style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Nom *</label>
                  <input value={form.lastName} onChange={e => updateForm("lastName", e.target.value)} placeholder="Dupont" required style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Email *</label>
                <input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} placeholder="jean@dupont-plomberie.fr" required style={inputStyle} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Mot de passe *</label>
                <input type="password" value={form.password} onChange={e => updateForm("password", e.target.value)} placeholder="6 caractères minimum" required minLength={6} style={inputStyle} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Téléphone</label>
                <input type="tel" value={form.phone} onChange={e => updateForm("phone", e.target.value)} placeholder="06 12 34 56 78" style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Entreprise</label>
                  <input value={form.company} onChange={e => updateForm("company", e.target.value)} placeholder="Dupont Plomberie" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Métier</label>
                  <input value={form.metier} onChange={e => updateForm("metier", e.target.value)} placeholder="Plombier" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 4 }}>Ville</label>
                <input value={form.ville} onChange={e => updateForm("ville", e.target.value)} placeholder="Lyon" style={inputStyle} />
              </div>

              {error && (
                <div style={{ background: "#fef2f2", color: C.red, padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: "center" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: 14, borderRadius: 12, border: "none",
                  background: loading ? C.muted : C.accent, color: "#fff",
                  fontWeight: 700, fontSize: 15, cursor: loading ? "wait" : "pointer",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {loading ? <Loader2 size={18} /> : null}
                {loading ? "Redirection vers le paiement..." : "Démarrer l'essai gratuit"}
              </button>

              <p style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
                En cliquant, vous acceptez nos conditions d'utilisation.<br />
                14 jours gratuits, puis {PLANS.find(p => p.key === selectedPlan)?.price}€/mois HT.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
