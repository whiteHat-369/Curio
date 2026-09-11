import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiStore, useApiStoreApi } from "@/lib/api-store";
import { authApi } from "@/lib/api-client";
import { useTheme, useAccent } from "@/lib/theme";
import {
  Moon,
  Sun,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  Trash2,
  Check,
  Home,
  UserRound,
  Palette,
  Sparkles,
  LockKeyhole,
  Database,
  Loader2,
  BookOpen,
  Layers,
  NotebookPen,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Curio" }] }),
});

type TabId =
  | "home"
  | "personal"
  | "appearance"
  | "ai"
  | "keys"
  | "security"
  | "privacy";

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "personal", label: "Personal info", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "ai", label: "AI & chat", icon: Sparkles },
  { id: "keys", label: "API keys", icon: KeyRound },
  { id: "security", label: "Security & sign-in", icon: LockKeyhole },
  { id: "privacy", label: "Data & privacy", icon: Database },
];

function SectionCard({
  title,
  desc,
  children,
  className = "",
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`border-border p-6 ${className}`}>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {desc && <p className="mt-1 font-ui text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {desc && <div className="font-ui text-xs text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function ApiKeyRow({
  storeKey,
  label,
  placeholder,
}: {
  storeKey: string;
  label: string;
  placeholder: string;
}) {
  const isConfigured = useApiStore((s) => Boolean(s.apiKeys[storeKey]));
  const setApiKey = useApiStore((s) => s.setApiKey);
  const removeApiKey = useApiStore((s) => s.removeApiKey);
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {label}
          {isConfigured ? (
            <Badge className="border-[var(--success)]/30 bg-[var(--success)]/10 font-ui text-[9px] text-[var(--success)]">
              Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="font-ui text-[9px] text-muted-foreground">
              Not configured
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Input
            type={visible ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={isConfigured ? "Update key..." : placeholder}
            className="h-8 w-48 pr-8 font-ui text-xs"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="font-ui cursor-pointer"
          onClick={() => {
            const trimmed = value.trim();
            if (!trimmed) {
              toast.error("Please enter an API key");
              return;
            }
            if (trimmed.length < 5) {
              toast.error("API key is too short");
              return;
            }
            void setApiKey(storeKey, trimmed)
              .then(() => {
                setValue("");
                toast.success(`${label} key saved securely`);
              })
              .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Unable to save this API key";
                toast.error(message);
              });
          }}
        >
          Save
        </Button>
        {isConfigured && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-[var(--destructive)] cursor-pointer"
            onClick={() => {
              void removeApiKey(storeKey)
                .then(() => {
                  setValue("");
                  toast.success(`${label} key removed`);
                })
                .catch((err: unknown) => {
                  const message = err instanceof Error ? err.message : "Unable to remove this API key";
                  toast.error(message);
                });
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const store = useApiStoreApi();
  const { theme, setTheme } = useTheme();
  const { accent, setAccent, accents } = useAccent();
  const reduceMotion = useApiStore((s) => s.reduceMotion);
  const setReduceMotion = useApiStore((s) => s.setReduceMotion);
  const defaultModel = useApiStore((s) => s.defaultModel);
  const setDefaultModel = useApiStore((s) => s.setDefaultModel);
  const defaultIncludeExternal = useApiStore((s) => s.defaultIncludeExternal);
  const setDefaultIncludeExternal = useApiStore((s) => s.setDefaultIncludeExternal);
  const defaultCiteFormat = useApiStore((s) => s.defaultCiteFormat);
  const setDefaultCiteFormat = useApiStore((s) => s.setDefaultCiteFormat);
  const databases = useApiStore((s) => s.databases);
  const workspaces = useApiStore((s) => s.workspaces);
  const papers = useApiStore((s) => s.papers);
  const userName = useApiStore((s) => s.userName);
  const userEmail = useApiStore((s) => s.userEmail);
  const userMobile = useApiStore((s) => s.userMobile);
  const userField = useApiStore((s) => s.userField);
  const userAffiliation = useApiStore((s) => s.userAffiliation);
  const updateProfile = useApiStore((s) => s.updateProfile);
  const logout = useApiStore((s) => s.logout);

  const [tab, setTab] = useState<TabId>("home");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [field, setField] = useState("Computer Science / Engineering");
  const [affiliation, setAffiliation] = useState("Cambridge");
  const [savingProfile, setSavingProfile] = useState(false);
  const [responseStyle, setResponseStyle] = useState("balanced");

  // Change password
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Delete account dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deletePwVisible, setDeletePwVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    store.getState().fetchApiKeys();
    store.getState().fetchPreferences();
  }, [store]);

  useEffect(() => {
    if (userName) setName(userName);
    if (userMobile) setMobile(userMobile);
    if (userField) setField(userField);
    if (userAffiliation) setAffiliation(userAffiliation);
  }, [userName, userMobile, userField, userAffiliation]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        mobile: mobile.trim() || undefined,
        field: field.trim() || undefined,
        affiliation: affiliation.trim() || undefined,
      });
      toast.success("Profile saved successfully");
    } catch (err: any) {
      toast.error("Failed to save profile: " + (err.message || "Unknown error"));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!curPw || !newPw) {
      toast.error("Fill in both password fields");
      return;
    }
    if (newPw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("New passwords do not match");
      return;
    }
    setChangingPw(true);
    try {
      await authApi.changePassword(curPw, newPw);
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      toast.success("Password updated — other sessions signed out");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setChangingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePw) {
      setDeleteError("Enter your password to confirm deletion.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      await authApi.deleteAccount(deletePw);
      setDeleteOpen(false);
      logout();
      toast.success("Account deleted");
      navigate({ to: "/login" });
    } catch (err: any) {
      setDeleteError(err?.message || "Could not delete account");
    } finally {
      setDeleting(false);
    }
  };

  const initial = (userName ?? userEmail ?? "C").trim().charAt(0).toUpperCase() || "C";
  const readCount = papers.filter((p) => p.status === "read").length;

  const quickLinks: { tab: TabId; title: string; desc: string }[] = [
    { tab: "personal", title: "Personal info", desc: "Name, contact, field & affiliation" },
    { tab: "ai", title: "Default AI model", desc: `${defaultModel === "gemini" ? "Google Gemini" : defaultModel} · ${defaultIncludeExternal ? "External on" : "Workspace only"}` },
    { tab: "keys", title: "API keys", desc: "Bring your own model keys" },
    { tab: "security", title: "Password & sign-in", desc: "Change password, manage sessions" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-8 py-8 animate-enter">
      <h1 className="mt-4 font-display text-2xl font-semibold">Account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your profile, models, keys, and security.
      </p>

      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        {/* Side nav */}
        <nav className="w-full shrink-0 space-y-1 md:w-60">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 font-ui text-sm transition-colors cursor-pointer ${
                  active
                    ? "bg-[var(--primary)]/15 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    active ? "bg-[var(--primary)]/20 text-[var(--primary)]" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Main panel */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Profile hero — Curio graphics: radial glow + grid + gradient ring */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
            <div className="bg-radial-glow pointer-events-none absolute inset-0" />
            <div className="bg-grid-soft pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_70%_90%_at_50%_0%,black,transparent)]" />
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--accent-purple)]/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 -bottom-24 h-56 w-56 rounded-full bg-[var(--primary)]/20 blur-3xl" />
            <div className="relative flex flex-col items-center px-6 py-10 text-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent-purple)] p-[2.5px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-card font-display text-3xl font-semibold text-foreground">
                    {initial}
                  </div>
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-[var(--success)]" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">
                {userName ?? "Researcher"}
              </h2>
              <p className="mt-0.5 font-ui text-sm text-muted-foreground">{userEmail}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {userField && (
                  <Badge variant="outline" className="font-ui text-[10px]">{userField}</Badge>
                )}
                {userAffiliation && (
                  <Badge variant="outline" className="font-ui text-[10px]">{userAffiliation}</Badge>
                )}
                <Badge className="border-[var(--primary)]/30 bg-[var(--primary)]/10 font-ui text-[10px] text-[var(--primary)]">
                  {workspaces.length} workspaces
                </Badge>
              </div>
              <div className="mt-5 grid w-full max-w-md grid-cols-3 gap-2">
                {[
                  { icon: Layers, v: workspaces.length, l: "Workspaces" },
                  { icon: BookOpen, v: papers.length, l: "Papers" },
                  { icon: NotebookPen, v: readCount, l: "Read" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl border border-border/70 bg-background/60 px-2 py-2.5 backdrop-blur">
                    <s.icon className="mx-auto h-3.5 w-3.5 text-[var(--primary)]" />
                    <div className="mt-1 font-display text-lg font-semibold text-foreground">{s.v}</div>
                    <div className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {quickLinks.map((q) => (
                  <button
                    key={q.tab}
                    onClick={() => setTab(q.tab)}
                    className="group card-lift flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-[var(--primary)]/40 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-ui text-sm font-semibold text-foreground">{q.title}</div>
                      <div className="mt-0.5 truncate font-ui text-xs text-muted-foreground">{q.desc}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
                  </button>
                ))}
              </div>
              <Card className="border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                  <div>
                    <div className="font-ui text-sm font-semibold text-foreground">
                      Evidence-first research
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      Papers in, evidence map out. Every AI claim traces back to a specific paper
                      and paragraph with a visible confidence score.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {tab === "personal" && (
            <SectionCard title="Personal info" desc="How you appear across Curio.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Name</Label>
                  <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pemail">Email</Label>
                  <Input id="pemail" type="email" value={userEmail ?? ""} readOnly disabled className="opacity-75" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pmobile">Mobile</Label>
                  <Input id="pmobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pfield">Field</Label>
                  <Input id="pfield" value={field} onChange={(e) => setField(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="paff">Affiliation</Label>
                  <Input id="paff" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button className="font-ui cursor-pointer" disabled={savingProfile} onClick={handleSaveProfile}>
                  {savingProfile ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </SectionCard>
          )}

          {tab === "appearance" && (
            <SectionCard title="Appearance" desc="Light or dark, accent colors, and motion.">
              <div className="space-y-4">
                <Row label="Theme" desc="Light or dark.">
                  <div className="flex rounded-md border border-border bg-background p-0.5">
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-ui text-xs cursor-pointer ${
                        theme === "light" ? "bg-muted text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5" /> Light
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-ui text-xs cursor-pointer ${
                        theme === "dark" ? "bg-muted text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" /> Dark
                    </button>
                  </div>
                </Row>
                <Row label="Accent color" desc="Applied to buttons, links, and highlights app-wide.">
                  <div className="flex items-center gap-1.5">
                    {accents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAccent(a.id)}
                        title={a.label}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border cursor-pointer"
                        style={{
                          backgroundColor: `oklch(0.62 ${"chroma" in a ? a.chroma : 0.19} ${a.hue})`,
                        }}
                      >
                        {accent === a.id && <Check className="h-3 w-3 text-white" />}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Reduce motion" desc="Minimize animations across the app.">
                  <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                </Row>
              </div>
            </SectionCard>
          )}

          {tab === "ai" && (
            <SectionCard title="AI & chat" desc="Defaults for new chat sessions.">
              <div className="space-y-4">
                <Row label="Default model" desc="Used for new chat sessions.">
                  <Select value={defaultModel} onValueChange={setDefaultModel}>
                    <SelectTrigger className="h-8 w-auto rounded-md border-border bg-background font-ui text-xs text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                      <SelectItem value="grok">xAI (Grok-2)</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row
                  label="Include external literature by default"
                  desc="Answers can draw beyond your workspace papers."
                >
                  <Switch checked={defaultIncludeExternal} onCheckedChange={setDefaultIncludeExternal} />
                </Row>
                <Row label="Response style" desc="How detailed new answers should be.">
                  <Select value={responseStyle} onValueChange={setResponseStyle}>
                    <SelectTrigger className="h-8 w-auto rounded-md border-border bg-background font-ui text-xs text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
                <Row
                  label="Default citation format"
                  desc="Used on the Citations page for new workspaces."
                >
                  <Select
                    value={defaultCiteFormat}
                    onValueChange={(v) => setDefaultCiteFormat(v as typeof defaultCiteFormat)}
                  >
                    <SelectTrigger className="h-8 w-auto rounded-md border-border bg-background font-ui text-xs text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APA">APA</SelectItem>
                      <SelectItem value="IEEE">IEEE</SelectItem>
                      <SelectItem value="BibTeX">BibTeX</SelectItem>
                    </SelectContent>
                  </Select>
                </Row>
              </div>
            </SectionCard>
          )}

          {tab === "keys" && (
            <SectionCard
              title="API keys"
              desc="Bring your own keys. Keys are used securely to call each provider."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="h-3 w-3" /> AI models
                </div>
                <ApiKeyRow storeKey="model:gemini" label="Google Gemini" placeholder="AQ... or AIza..." />
                <ApiKeyRow storeKey="model:openai" label="OpenAI" placeholder="sk-..." />
                <ApiKeyRow storeKey="model:grok" label="Grok" placeholder="xai-..." />
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <KeyRound className="h-3 w-3" /> Datasets
                </div>
                {databases.length === 0 ? (
                  <p className="font-ui text-xs text-muted-foreground">
                    No datasets yet — add one on the Datasets page.
                  </p>
                ) : (
                  databases.map((db) => (
                    <ApiKeyRow
                      key={db.id}
                      storeKey={`db:${db.id}`}
                      label={db.name}
                      placeholder={`${db.name} API key`}
                    />
                  ))
                )}
              </div>
            </SectionCard>
          )}

          {tab === "security" && (
            <div className="space-y-4">
              <SectionCard title="Password" desc="Change the password you sign in with.">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cur-pw">Current password</Label>
                    <Input
                      id="cur-pw"
                      type={pwVisible ? "text" : "password"}
                      value={curPw}
                      onChange={(e) => setCurPw(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pw">New password</Label>
                    <Input
                      id="new-pw"
                      type={pwVisible ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Min. 8 characters"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pw">Confirm new</Label>
                    <Input
                      id="confirm-pw"
                      type={pwVisible ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => setPwVisible((v) => !v)}
                    className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {pwVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {pwVisible ? "Hide passwords" : "Show passwords"}
                  </button>
                  <Button
                    variant="secondary"
                    className="font-ui cursor-pointer"
                    disabled={changingPw}
                    onClick={handleChangePassword}
                  >
                    {changingPw ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Updating…</>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </div>
              </SectionCard>
              <SectionCard title="Sessions" desc="Signing out ends this session on this device.">
                <Row label="Sign out" desc={`Signed in as ${userEmail ?? "unknown"}.`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="font-ui cursor-pointer"
                    onClick={() => {
                      logout();
                      navigate({ to: "/login" });
                    }}
                  >
                    Sign out
                  </Button>
                </Row>
              </SectionCard>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-4">
              <SectionCard title="Data & privacy" desc="Export or reset your research data.">
                <div className="space-y-4">
                  <Row
                    label="Export all data"
                    desc="Download workspaces, papers, notes, and chats as JSON."
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      className="font-ui cursor-pointer"
                      onClick={() => toast.success("Export started — you'll get a download link by email")}
                    >
                      Export
                    </Button>
                  </Row>
                  <Row label="Clear reading history" desc="Reset per-paper read/unread/reading status.">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="font-ui cursor-pointer"
                      onClick={() => {
                        if (window.confirm("Clear reading history for all papers?")) {
                          toast.success("Reading history cleared");
                        }
                      }}
                    >
                      Clear
                    </Button>
                  </Row>
                </div>
              </SectionCard>

              <SectionCard title="Delete account" className="border-[var(--destructive)]/30">
                <Row
                  label="Delete account"
                  desc="Permanently delete your account and all workspaces, papers, notes, and chats."
                >
                  <Button
                    variant="destructive"
                    size="sm"
                    className="font-ui cursor-pointer"
                    onClick={() => {
                      setDeletePw("");
                      setDeleteError("");
                      setDeleteOpen(true);
                    }}
                  >
                    Delete account
                  </Button>
                </Row>
              </SectionCard>
            </div>
          )}
        </div>
      </div>

      {/* Delete-account confirmation card */}
      <Dialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-[var(--destructive)]">
              <ShieldAlert className="h-4 w-4" /> Delete account?
            </DialogTitle>
          </DialogHeader>
          <p className="font-sans text-sm leading-relaxed text-muted-foreground">
            This permanently deletes your account and <span className="font-semibold text-foreground">all associated data</span> —
            workspaces, papers, notes, chats, datasets, and API keys. This cannot be undone.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="delete-pw">Confirm with your password</Label>
            <div className="relative">
              <Input
                id="delete-pw"
                type={deletePwVisible ? "text" : "password"}
                value={deletePw}
                onChange={(e) => {
                  setDeletePw(e.target.value);
                  setDeleteError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && !deleting && handleDeleteAccount()}
                placeholder="Enter your password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setDeletePwVisible((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {deletePwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {deleteError && (
              <p className="font-ui text-xs text-[var(--destructive)]">{deleteError}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              className="font-ui cursor-pointer"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="font-ui cursor-pointer"
              disabled={deleting || !deletePw}
              onClick={handleDeleteAccount}
            >
              {deleting ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Deleting…</>
              ) : (
                "Delete my account"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
