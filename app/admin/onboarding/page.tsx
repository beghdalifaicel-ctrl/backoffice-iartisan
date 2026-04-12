"use client";

import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Check, Mail, MessageCircle, User, Building, Sparkles, Send } from "lucide-react";

// ─── DESIGN TOKENS ───────────────────
const C = {
  bg: "#f7f4ef", dark: "#1a1a14", accent: "#ff5c00", green: "#2d6a4f",
  muted: "#7a7a6a", surface: "#fff", border: "#e5e0d8",
};

const PLAN_AGENTS: Record<string, { type: string; defaultName: string; emoji: string; role: string; desc: string }[]> = {
  ESSENTIEL: [
    { type: "ADMIN", defaultName: "Alice", emoji: "📋", role: "Admin", desc: "Emails, devis, factures, relances" },
  ],
  PRO: [
    { type: "ADMIN", defaultName: "Alice", emoji: "📋", role: "Admin", desc: "Emails, devis, factures, relances" },
    { type: "MARKETING", defaultName: "Marc", emoji: "📢", role: "Marketing", desc: "Fiche Google, avis, SEO, réseaux sociaux" },
  ],
  MAX: [
    { type: "ADMIN", defaultName: "Alice", emoji: "📋", role: "Admin", desc: "Emails, devis, factures, relances" },
    { type: "MARKETING", defaultName: "Marc", emoji: "📢", role: "Marketing", desc: "Fiche Google, avis, SEO, réseaux sociaux" },
    { type: "COMMERCIAL", defaultName: "Léa", emoji: "💼", role: "Commercial", desc: "Prospection, leads, recouvrement, annuaires" },
  ],
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState("");
  const [plan, setPlan] = useState("MAX");

  // Step 1 — Company info
  const [company, setCompany] = useState("");
  const [metier, setMetier] = useState("");
  const [ville, setVille] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [siret, setSiret] = useState("");
  const [phone, setPhone] = useState("");
  const [adresse, setAdresse] = useState("");

  // Step 2 — Agent names
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});

  // Step 4 — Telegram link code
  const [linkCode, setLinkCode] = useState("");
  const [firstMessage, setFirstMessage] = useState("");

  useEffect(() => {
    // Get clientId from URL or session
    const params = new URLSearchParams(window.location.search);
    const id = params.get("clientId") || "";
    setClientId(id);

    if (id) {
      fetch(`/api/onboarding?clientId=${id}`)
        .then(r => r.json())
        .then(data => {
          if (data.client) {
            setPlan(data.client.plan || "MAX");
            setCompany(data.client.company || "");
            setMetier(data.client.metier || "");
            setVille(data.client.ville || "");
            setCodePostal(data.client.codePostal || "");
            setSiret(data.client.siret || "");
            setPhone(data.client.phone || "");
            setAdresse(data.client.adresse || "");
            setLinkCode(`link_${id}`);

            // Restore agent names
            const names: Record<string, string> = {};
            (data.agents || []).forEach((a: any) => {
              names[a.agent_type] = a.display_name || "";
            });
            setAgentNames(names);

            if (data.onboardingStep > 0) setStep(data.onboardingStep + 1);
          }
        })
        .catch(() => {});
    }
  }, []);

  const agents = PLAN_AGENTS[plan] || PLAN_AGENTS.MAX;

  // Initialize default names
  useEffect(() => {
    const defaults: Record<string, string> = {};
    agents.forEach(a => {
      if (!agentNames[a.type]) defaults[a.type] = a.defaultName;
    });
    if (Object.keys(defaults).length > 0) {
      setAgentNames(prev => ({ ...defaults, ...prev }));
    }
  }, [plan]);

  const saveStep = async (stepNum: number, data: any) => {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, step: stepNum, data }),
      });
      setStep(stepNum + 1);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const progressWidth = `${(step / 4) * 100}%`;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 640, background: C.surface, borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", overflow: "hidden" }}>

        {/* Progress bar */}
        <div style={{ height: 4, background: C.border }}>
          <div style={{ height: 4, background: C.accent, width: progressWidth, transition: "width 0.3s ease" }} />
        </div>

        {/* Header */}
        <div style={{ padding: "32px 32px 0", textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.dark }}>
            <span style={{ color: C.accent }}>i</span>Artisan
          </div>
          <p style={{ color: C.muted, marginTop: 4 }}>Étape {step} sur 4</p>
        </div>

        <div style={{ padding: "24px 32px 32px" }}>

          {/* ── STEP 1: Company Info ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                <Building size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Votre entreprise
              </h2>
              <p style={{ color: C.muted, marginBottom: 24 }}>Ces infos apparaîtront sur vos devis et factures.</p>

              <div style={{ display: "grid", gap: 12 }}>
                <Input label="Nom de l'entreprise *" value={company} onChange={setCompany} placeholder="Ex: Dupont Plomberie" />
                <Input label="Métier *" value={metier} onChange={setMetier} placeholder="Ex: Plombier, Électricien, Maçon..." />
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                  <Input label="Ville *" value={ville} onChange={setVille} placeholder="Lyon" />
                  <Input label="Code postal" value={codePostal} onChange={setCodePostal} placeholder="69001" />
                </div>
                <Input label="Adresse" value={adresse} onChange={setAdresse} placeholder="12 rue des Artisans" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Téléphone" value={phone} onChange={setPhone} placeholder="06 12 34 56 78" />
                  <Input label="SIRET" value={siret} onChange={setSiret} placeholder="123 456 789 00012" />
                </div>
              </div>

              <Btn
                disabled={!company || !metier || !ville || loading}
                onClick={() => saveStep(1, { company, metier, ville, codePostal, siret, phone, adresse })}
              >
                Continuer <ArrowRight size={18} />
              </Btn>
            </div>
          )}

          {/* ── STEP 2: Name Your Agents ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                <Sparkles size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Nommez vos assistants
              </h2>
              <p style={{ color: C.muted, marginBottom: 24 }}>
                Choisissez un prénom pour {agents.length > 1 ? "chacun de vos" : "votre"} assistant{agents.length > 1 ? "s" : ""} IA.
              </p>

              <div style={{ display: "grid", gap: 16 }}>
                {agents.map(agent => (
                  <div key={agent.type} style={{
                    border: `2px solid ${C.border}`,
                    borderRadius: 12,
                    padding: 20,
                    transition: "border-color 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 32 }}>{agent.emoji}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: C.dark }}>Agent {agent.role}</div>
                        <div style={{ fontSize: 13, color: C.muted }}>{agent.desc}</div>
                      </div>
                    </div>
                    <Input
                      label="Prénom de l'assistant"
                      value={agentNames[agent.type] || agent.defaultName}
                      onChange={(v) => setAgentNames(prev => ({ ...prev, [agent.type]: v }))}
                      placeholder={agent.defaultName}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <BtnSecondary onClick={() => setStep(1)}>
                  <ArrowLeft size={18} /> Retour
                </BtnSecondary>
                <Btn
                  disabled={loading}
                  onClick={() => saveStep(2, {
                    agents: agents.map(a => ({
                      agentType: a.type,
                      displayName: agentNames[a.type] || a.defaultName,
                    }))
                  })}
                >
                  Continuer <ArrowRight size={18} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── STEP 3: Connect Email ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                <Mail size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Connectez votre email
              </h2>
              <p style={{ color: C.muted, marginBottom: 24 }}>
                Pour que <strong>{agentNames.ADMIN || "Alice"}</strong> puisse lire et envoyer vos emails professionnels.
              </p>

              <div style={{
                background: "#f8f9fa",
                borderRadius: 12,
                padding: 24,
                textAlign: "center",
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
                <a
                  href={`/api/integrations/gmail/auth?clientId=${clientId}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#4285F4",
                    color: "#fff",
                    padding: "12px 24px",
                    borderRadius: 8,
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 15,
                  }}
                >
                  <Mail size={18} />
                  Connecter Gmail
                </a>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>
                  Nous ne stockons jamais vos mots de passe. Connexion sécurisée via Google OAuth.
                </p>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <BtnSecondary onClick={() => setStep(2)}>
                  <ArrowLeft size={18} /> Retour
                </BtnSecondary>
                <Btn disabled={loading} onClick={() => saveStep(3, {})}>
                  {loading ? "..." : "Continuer"} <ArrowRight size={18} />
                </Btn>
              </div>
              <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 8 }}>
                Vous pourrez connecter Gmail plus tard si vous préférez.
              </p>
            </div>
          )}

          {/* ── STEP 4: Connect Telegram ── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 4 }}>
                <MessageCircle size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Parlez à {agentNames.ADMIN || "Alice"}
              </h2>
              <p style={{ color: C.muted, marginBottom: 24 }}>
                Connectez Telegram pour discuter avec vos assistants depuis votre téléphone.
              </p>

              <div style={{
                background: "#f8f9fa",
                borderRadius: 12,
                padding: 24,
                marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: 36 }}>✈️</div>
                  <div>
                    <div style={{ fontWeight: 700, color: C.dark }}>Telegram</div>
                    <div style={{ fontSize: 13, color: C.muted }}>Gratuit, rapide, illimité</div>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.8 }}>
                  <strong>1.</strong> Ouvrez{" "}
                  <a href="https://t.me/iartisan_agent_bot" target="_blank" style={{ color: C.accent, fontWeight: 600 }}>
                    t.me/iartisan_agent_bot
                  </a><br />
                  <strong>2.</strong> Envoyez ce code pour lier votre compte :<br />
                  <div style={{
                    background: C.dark,
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontFamily: "monospace",
                    fontSize: 16,
                    fontWeight: 700,
                    display: "inline-block",
                    margin: "8px 0",
                    letterSpacing: 1,
                    cursor: "pointer",
                  }}
                    onClick={() => navigator.clipboard?.writeText(clientId)}
                    title="Cliquer pour copier"
                  >
                    {clientId || "votre-client-id"}
                  </div>
                  <br />
                  <strong>3.</strong> Essayez : <em style={{ color: C.accent }}>"Aide"</em> ou <em style={{ color: C.accent }}>"Lis mes emails"</em>
                </div>
              </div>

              {/* WhatsApp teaser */}
              <div style={{
                background: "#e8f5e9",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
                opacity: 0.7,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>💬</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>WhatsApp</div>
                    <div style={{ fontSize: 12, color: C.muted }}>Bientôt disponible</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <BtnSecondary onClick={() => setStep(3)}>
                  <ArrowLeft size={18} /> Retour
                </BtnSecondary>
                <Btn disabled={loading} onClick={() => saveStep(4, {})}>
                  Terminer <Check size={18} />
                </Btn>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 5 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: C.dark, marginBottom: 8 }}>
                C'est prêt !
              </h2>
              <p style={{ color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
                {agents.length > 1 ? "Vos assistants sont" : "Votre assistant est"} configuré{agents.length > 1 ? "s" : ""} et prêt{agents.length > 1 ? "s" : ""} à travailler.<br />
                Parlez à {agents.map(a => agentNames[a.type] || a.defaultName).join(", ")} via Telegram pour commencer.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {agents.map(a => (
                  <div key={a.type} style={{
                    background: C.bg,
                    borderRadius: 12,
                    padding: "16px 20px",
                    textAlign: "center",
                    minWidth: 130,
                  }}>
                    <div style={{ fontSize: 28 }}>{a.emoji}</div>
                    <div style={{ fontWeight: 700, color: C.dark, marginTop: 4 }}>
                      {agentNames[a.type] || a.defaultName}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>{a.role}</div>
                  </div>
                ))}
              </div>

              <a href="/admin" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: C.accent,
                color: "#fff",
                padding: "12px 32px",
                borderRadius: 8,
                fontWeight: 700,
                textDecoration: "none",
                marginTop: 24,
                fontSize: 15,
              }}>
                Aller au tableau de bord <ArrowRight size={18} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UI Components ───────────────────
function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 4 }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          fontSize: 15,
          outline: "none",
          background: "#fafaf8",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: disabled ? C.muted : C.accent,
        color: "#fff",
        padding: "12px 24px",
        borderRadius: 8,
        border: "none",
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        marginTop: 24,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        color: C.muted,
        padding: "12px 16px",
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
        marginTop: 24,
      }}
    >
      {children}
    </button>
  );
}
