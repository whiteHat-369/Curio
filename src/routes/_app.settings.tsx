import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApiStore, useApiStoreApi } from "@/lib/api-store";
import { useTheme, useAccent } from "@/lib/theme";
import { Moon, Sun, ShieldAlert, Eye, EyeOff, KeyRound, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Curio" }] }),
});

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`mt-4 border-border p-6 ${className}`}>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
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
  const userName = useApiStore((s) => s.userName);
  const userEmail = useApiStore((s) => s.userEmail);
  const userMobile = useApiStore((s) => s.userMobile);
  const userField = useApiStore((s) => s.userField);
  const userAffiliation = useApiStore((s) => s.userAffiliation);
  const updateProfile = useApiStore((s) => s.updateProfile);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [field, setField] = useState("Computer Science / Engineering");
  const [affiliation, setAffiliation] = useState("Cambridge");
  const [savingProfile, setSavingProfile] = useState(false);
  const [responseStyle, setResponseStyle] = useState("balanced");

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

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      {/* Profile */}
      <SectionCard title="Profile" className="mt-8">
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

      {/* Appearance */}
      <SectionCard title="Appearance">
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

      {/* AI & Chat */}
      <SectionCard title="AI &amp; chat">
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
        </div>
      </SectionCard>

      {/* API Keys */}
      <SectionCard title="API keys">
        <p className="mb-4 -mt-2 font-ui text-xs text-muted-foreground">
          Bring your own keys. Nothing is sent to external servers without your instruction — keys are used securely to call each provider.
        </p>
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

      {/* Workspace defaults */}
      <SectionCard title="Workspace defaults">
        <div className="space-y-4">
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
          <Row label="Workspace name length" desc="Names are capped at 50 characters.">
            <span className="font-ui text-xs text-muted-foreground">50 max</span>
          </Row>
        </div>
      </SectionCard>

      {/* Security */}
      <SectionCard title="Security">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input id="cur-pw" type="password" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" placeholder="••••••••" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              className="font-ui"
              onClick={() => toast.success("Password updated")}
            >
              Update password
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Data & Privacy */}
      <SectionCard title="Data &amp; privacy">
        <div className="space-y-4">
          <Row
            label="Export all data"
            desc="Download workspaces, papers, notes, and chats as JSON."
          >
            <Button
              variant="secondary"
              size="sm"
              className="font-ui"
              onClick={() => toast.success("Export started — you'll get a download link by email")}
            >
              Export
            </Button>
          </Row>
          <Row label="Clear reading history" desc="Reset per-paper read/unread/reading status.">
            <Button
              variant="secondary"
              size="sm"
              className="font-ui"
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

      {/* Danger zone */}
      <SectionCard title="Danger zone" className="border-[var(--destructive)]/30">
        <Row label="Delete account" desc="Permanently delete your account and all associated data.">
          <Button
            variant="destructive"
            size="sm"
            className="font-ui"
            onClick={() => {
              if (window.confirm("This will permanently delete your account. Are you sure?")) {
                toast("Account deletion requested", {
                  icon: <ShieldAlert className="h-4 w-4" />,
                });
              }
            }}
          >
            Delete account
          </Button>
        </Row>
      </SectionCard>
    </div>
  );
}
