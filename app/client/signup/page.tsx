"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ArrowRight, ArrowLeft, Loader2, Shield, Star, Clock, Users } from "lucide-react";

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
    setup: 50,
    trial: true,
    desc: "Votre secrétaire IA",
    reframe: "Le prix d'un plein de gasoil",
    result: "~10h/semaine de paperasse en moins",
    features: [
      "Devis et factures automatiques",
      "Relance clients par email",
      "Vos emails lus et résumés chaque matin",
      "Fiche Google optimisée",
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    price: 99,
    setup: 0,
    trial: true,
    popular: true,
    desc: "Être trouvé par vos clients",
    reframe: "Moins qu'un encart dans les Pages Jaunes",
    result: "Visible sur Google en 2 à 4 semaines",
    features: [
      "Tout de Essentiel +",
      "Site web et fiche Google au top",
      "Réponse aux avis Google par IA",
      "Publications réseaux sociaux",
      "Référencement local optimisé",
    ],
  },
  {
    key: "MAX",
    name: "Max",
    price: 179,
    setup: 0,
    trial: true,
    desc: "On vous trouve de nouveaux clients",
    reframe: "Rentabilisé dès le 1er nouveau client",
    result: "5 à 15 nouveaux contacts par mois",
    features: [
      "Tout de Pro +",
      "Prospection automatique dans votre zone",
      "Emails de prospection personnalisés",
      "Relance des impayés",
      "Inscription annuaires professionnels",
    ],
  },
];

export default function ClientSignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: C.muted, fontSize: 15 }}>Chargement...</div></div>}>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const canceled = params.get("canceled");
  const errorParam = params.get("error");

  // Pré-remplissage depuis les URL params (redirect depuis le site vitrine)
  const initialPlan = params.get("plan") || "PRO";
  const initialFirstName = params.get("firstName") || "";
  const initialLastName = params.get("lastName") || "";
  const initialEmail = params.get("email") || "";
  const initialMetier = params.get("metier") || "";

  // Si des params sont fournis, aller directement au step 2 (formulaire)
  const hasPrefilledData = !!(initialFirstName && initialEmail);
  const [step, setStep] = useState(hasPrefilledData ? 2 : 1);
  const [selectedPlan, setSelectedPlan] = useState(PLANS.some(p => p.key === initialPlan) ? initialPlan : "PRO");
  const [form, setForm] = useState({ firstName: initialFirstName, lastName: initialLastName, email: initialEmail, password: "", metier: initialMetier });
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

  const selectedPlanData = PLANS.find(p => p.key === selectedPlan);

  const inputStyle = {
    width: "100%", padding: "14px 16px", borderRadius: 12,
    border: `1.5px solid ${C.border}`, fontSize: 15, outline: "none",
    fontFamily: "'Bricolage Grotesque', sans-serif",
    background: C.surface, color: C.dark, boxSizing: "border-box" as const,
    minHeight: 50, transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header sticky */}
      <div style={{ position: "sticky", top: 0, background: C.bg, zIndex: 10, padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="https://www.iartisan.io" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            {step === 2 ? (
              <button onClick={(e) => { e.preventDefault(); setStep(1); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", color: C.muted, fontSize: 13, fontWeight: 600, padding: 0 }}>
                <ArrowLeft size={16} /> Retour
              </button>
            ) : (
              <>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>iA</div>
                <span style={{ fontWeight: 700, fontSize: 18, color: C.dark }}>iArtisan</span>
              </>
            )}
          </a>
          <a href="/client/login" style={{ color: C.accent, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Déjà un compte ?
          </a>
        </div>
      </div>

      <div style={{ padding: "24px 16px 40px", maxWidth: 480, margin: "0 auto" }}>

        {/* ═══ STEP 1 — Choix du plan ═══ */}
        {step === 1 && (
          <>
            {/* Titre */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: C.dark, margin: "0 0 6px", lineHeight: 1.3 }}>
                Votre assistant IA,<br />prêt en 2 minutes
              </h1>
              <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
                Choisissez votre formule
              </p>
            </div>

            {/* Plan cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {PLANS.map(plan => {
                const isSelected = selectedPlan === plan.key;
                return (
                  <button
                    key={plan.key}
                    onClick={() => { setSelectedPlan(plan.key); setStep(2); }}
                    style={{
                      background: C.surface, borderRadius: 16, padding: "20px 18px",
                      border: isSelected ? `2.5px solid ${C.accent}` : `1.5px solid ${C.border}`,
                      cursor: "pointer", textAlign: "left", position: "relative",
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      transition: "all 0.2s",
                      boxShadow: plan.popular ? "0 4px 20px rgba(255,92,0,0.08)" : "none",
                    }}
                  >
                    {plan.popular && (
                      <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20 }}>
                        Le + choisi par les artisans
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.dark }}>{plan.name}</div>
                        <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginTop: 2 }}>{plan.desc}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: C.dark, lineHeight: 1 }}>{plan.price}€</div>
                        <div style={{ fontSize: 11, color: C.muted }}>/mois HT</div>
                      </div>
                    </div>

                    {/* Setup fee ou trial badge */}
                    {plan.setup > 0 && (
                      <div style={{ background: `${C.yellow}20`, borderRadius: 8, padding: "6px 12px", marginBottom: 10, fontSize: 12, color: C.dark, fontWeight: 600, display: "inline-block" }}>
                        Frais de mise en service : {plan.setup}€ HT
                      </div>
                    )}
                    {plan.trial && (
                      <div style={{ background: `${C.green}12`, borderRadius: 8, padding: "6px 12px", marginBottom: 10, fontSize: 12, color: C.green, fontWeight: 700, display: "inline-block" }}>
                        <Clock size={11} style={{ verticalAlign: "middle", marginRight: 4 }} /> 14 jours d'essai gratuit
                      </div>
                    )}

                    {/* Features */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.dark }}>
                          <Check size={14} color={C.green} style={{ flexShrink: 0 }} />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* Result badge */}
                    <div style={{ background: `${C.green}10`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Star size={14} color={C.green} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{plan.result}</span>
                    </div>

                    {/* Reframe */}
                    <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", textAlign: "center", marginBottom: 8 }}>
                      {plan.reframe}
                    </div>

                    {/* CTA */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: C.accent, fontWeight: 700, fontSize: 14 }}>
                      {plan.trial ? "Essayer gratuitement" : "Commencer maintenant"} <ArrowRight size={15} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Réassurance */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {[
                { icon: Shield, text: "Sans engagement · Annulable en 1 clic" },
                { icon: Clock, text: "14 jours d'essai gratuit sur toutes les formules" },
                { icon: Users, text: "Déjà utilisé par des artisans partout en France" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.muted }}>
                  <item.icon size={15} color={C.green} style={{ flexShrink: 0 }} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══ STEP 2 — Formulaire simplifié ═══ */}
        {step === 2 && selectedPlanData && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: C.dark, margin: "0 0 6px" }}>
                Créez votre compte
              </h1>
              <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
                30 secondes et c'est parti
              </p>
            </div>

            {/* Récap plan */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 16px", borderRadius: 12,
              background: `${C.accent}06`, border: `1.5px solid ${C.accent}20`,
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                  Offre {selectedPlanData.name} — {selectedPlanData.price}€/mois
                </div>
                <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginTop: 2 }}>
                  <Clock size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />14 jours gratuits — 0€ aujourd'hui
                  {selectedPlanData.setup > 0 && (
                    <span style={{ color: C.muted, marginLeft: 8 }}>· + {selectedPlanData.setup}€ HT de mise en service après l'essai</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setStep(1)}
                style={{ fontSize: 12, color: C.accent, fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", padding: "8px 0" }}
              >
                Changer
              </button>
            </div>

            {/* Formulaire */}
            <div style={{ background: C.surface, borderRadius: 16, padding: "24px 20px", border: `1.5px solid ${C.border}` }}>
              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>Prénom</label>
                    <input
                      value={form.firstName}
                      onChange={e => updateForm("firstName", e.target.value)}
                      placeholder="Jean"
                      required
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>Nom</label>
                    <input
                      value={form.lastName}
                      onChange={e => updateForm("lastName", e.target.value)}
                      placeholder="Dupont"
                      required
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => updateForm("email", e.target.value)}
                    placeholder="jean@dupont-plomberie.fr"
                    required
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>Mot de passe</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => updateForm("password", e.target.value)}
                    placeholder="6 caractères minimum"
                    required
                    minLength={6}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>Votre métier</label>
                  <input
                    value={form.metier}
                    onChange={e => updateForm("metier", e.target.value)}
                    placeholder="Ex : plombier, électricien, maçon..."
                    style={inputStyle}
                  />
                </div>

                {error && (
                  <div style={{ background: "#fef2f2", color: C.red, padding: "12px 16px", borderRadius: 12, fontSize: 13, marginBottom: 16, textAlign: "center", fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: 16, borderRadius: 14, border: "none",
                    background: loading ? C.muted : C.accent, color: "#fff",
                    fontWeight: 800, fontSize: 16, cursor: loading ? "wait" : "pointer",
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    minHeight: 56, transition: "all 0.2s",
                    boxShadow: loading ? "none" : "0 4px 16px rgba(255,92,0,0.25)",
                  }}
                >
                  {loading ? <Loader2 size={18} /> : null}
                  {loading ? "Redirection..." : selectedPlanData.trial ? "Démarrer mes 14 jours gratuits" : "Créer mon compte"}
                </button>

                <p style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 14, lineHeight: 1.6 }}>
                  En continuant, vous acceptez nos{" "}
                  <a href="/cgv" target="_blank" style={{ color: C.muted, textDecoration: "underline" }}>conditions d'utilisation</a>.<br />
                  {selectedPlanData.setup > 0
                    ? `0€ aujourd'hui. Après 14 jours d'essai : ${selectedPlanData.setup}€ HT de mise en service + ${selectedPlanData.price}€ HT premier mois. Puis ${selectedPlanData.price}€/mois HT.`
                    : "Aucun prélèvement pendant l'essai gratuit."
                  }
                </p>
              </form>
            </div>

            {/* Réassurance sous le formulaire */}
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
              {[
                { icon: Shield, text: "Paiement sécurisé" },
                { icon: Clock, text: "Annulable à tout moment" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
                  <item.icon size={13} color={C.green} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
