import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApiStore, type ChatMessage } from "@/lib/api-store";
import { conversationsApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ConfidenceBar } from "@/components/confidence-bar";
import { toast } from "sonner";
import {
  MessageSquareText,
  Send,
  Globe,
  PanelLeftClose,
  PanelLeft,
  Paperclip,
  MoreVertical,
  Plus,
  FolderPlus,
  FolderKanban,
  Search,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { RelatedRail, buildRelatedResources } from "@/components/related-resources";
import { slugify } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/workspace/$name/chat")({
  component: ChatPage,
  head: () => ({ meta: [{ title: "AI Chat — Curio" }] }),
});

const suggestions = [
  "Compare methodology across papers",
  "What are the main findings of our papers?",
  "Summarize key limitations and future research directions",
  "Identify conflicting claims across our literature",
];

function ChatPage() {
  const { name } = useParams({ from: "/_app/workspace/$name/chat" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const wsId = ws?.id ?? "";
  const papers = useApiStore((s) => s.papers);
  const wsPapers = papers.filter((p) => p.workspaceId === wsId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const defaultModel = useApiStore((s) => s.defaultModel);
  const defaultIncludeExternal = useApiStore((s) => s.defaultIncludeExternal);
  const setDefaultModel = useApiStore((s) => s.setDefaultModel);
  const setDefaultIncludeExternal = useApiStore((s) => s.setDefaultIncludeExternal);
  const [external, setExternal] = useState(defaultIncludeExternal);
  const [model, setModel] = useState(defaultModel || "gemini");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  const [conversations, setConversations] = useState<
    { id: string; title: string; group?: string }[]
  >([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [convQuery, setConvQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations from backend
  useEffect(() => {
    if (!wsId) return;
    conversationsApi
      .list(wsId)
      .then((res) => {
        const all: { id: string; title: string; group?: string }[] = [];
        if (res.ungrouped) {
          all.push(
            ...res.ungrouped.map((c) => ({ id: c.id, title: c.title, group: c.group ?? undefined })),
          );
        }
        if (res.grouped) {
          for (const [group, items] of Object.entries(res.grouped)) {
            all.push(...items.map((c) => ({ id: c.id, title: c.title, group })));
          }
        }
        setConversations(all);
        if (all.length > 0 && !activeConvId) {
          setActiveConvId(all[0].id);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch conversations", err);
      });
  }, [wsId]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!wsId || !activeConvId) {
      setMessages([]);
      return;
    }
    conversationsApi
      .listMessages(wsId, activeConvId)
      .then((res) => {
        if (res?.items) {
          const sorted = [...res.items].reverse().map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            external: m.external,
            sources: m.sources ?? undefined,
            followups: m.followups ?? undefined,
          }));
          setMessages(sorted);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch messages", err);
      });
  }, [wsId, activeConvId]);

  const groupedConversations = useMemo(() => {
    const filtered = conversations.filter((c) =>
      c.title.toLowerCase().includes(convQuery.toLowerCase()),
    );
    const map: Record<string, typeof conversations> = {};
    filtered.forEach((c) => {
      const g = c.group || "General";
      if (!map[g]) map[g] = [];
      map[g].push(c);
    });
    return map;
  }, [conversations, convQuery]);

  const handleNewConversation = async (group?: string) => {
    if (!wsId) return;
    try {
      const created = await conversationsApi.create(wsId, {
        title: "New chat",
        group: group || null,
      });
      const newConv = { id: created.id, title: created.title, group: created.group ?? undefined };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setMessages([]);
    } catch (err: any) {
      toast.error("Failed to create conversation: " + (err.message || "Unknown error"));
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  if (!ws) return null;

  const send = async () => {
    if ((!draft.trim() && attachments.length === 0) || isSending) return;
    const currentDraft = draft.trim();
    setDraft("");

    let convId = activeConvId;
    if (!convId || !conversations.some((c) => c.id === convId)) {
      try {
        const created = await conversationsApi.create(wsId, {
          title: currentDraft.slice(0, 32) || "New chat",
        });
        convId = created.id;
        setConversations((prev) => [
          { id: created.id, title: created.title, group: created.group ?? undefined },
          ...prev,
        ]);
        setActiveConvId(convId);
      } catch (err) {
        // Continue
      }
    }

    const userMsg: ChatMessage = {
      id: "u_" + Math.random().toString(36).slice(2, 9),
      role: "user",
      content:
        currentDraft +
        (attachments.length > 0 ? ` [Attached: ${attachments.map((f) => f.name).join(", ")}]` : ""),
      external,
    };
    setMessages((m) => [...m, userMsg]);
    setIsSending(true);

    try {
      const res = await conversationsApi.sendMessage(wsId, convId, {
        content: currentDraft,
        model,
        includeExternal: external,
      });

      if (res?.assistantMessage) {
        const modelName = model === "gemini" ? "Gemini" : model === "openai" ? "GPT-4o" : "Grok-2";
        const assistantMsg: ChatMessage = {
          id: res.assistantMessage.id,
          role: "assistant",
          content: res.assistantMessage.content,
          external: res.assistantMessage.external,
          sources: res.assistantMessage.sources ?? undefined,
          followups: res.assistantMessage.followups ?? undefined,
        };
        (assistantMsg as { model?: string }).model =
          `${modelName}${res.assistantMessage.external ? " · External" : " · Workspace"}`;
        setMessages((m) => [...m, assistantMsg]);
      }
    } catch (err: any) {
      toast.error("AI Error: " + (err.message || "Failed to generate response"));
    } finally {
      setIsSending(false);
      setAttachments([]);
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Conversation history panel */}
      {historyOpen && (
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 md:block">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <button
                onClick={() => setHistoryOpen(false)}
                className="hover:text-foreground cursor-pointer"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
              <span className="font-ui text-xs font-semibold uppercase tracking-wider">
                Conversations
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <button
                onClick={() => handleNewConversation()}
                className="hover:text-foreground cursor-pointer"
                title="New chat"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  const gName = window.prompt("New group name:");
                  if (gName !== null && gName.trim()) {
                    handleNewConversation(gName.trim());
                  }
                }}
                className="hover:text-foreground cursor-pointer"
                title="New group"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={convQuery}
                onChange={(e) => setConvQuery(e.target.value)}
                placeholder="Search conversations"
                className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 font-ui text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 space-y-3 px-2">
            {Object.entries(groupedConversations).map(([groupName, convList]) => (
              <div key={groupName} className="space-y-0.5">
                <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <FolderKanban className="h-2.5 w-2.5 text-muted-foreground/65" />
                  <span>{groupName}</span>
                </div>
                {convList.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center justify-between rounded-md px-3 py-1 font-ui text-sm transition-colors ${
                      activeConvId === c.id
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    <button
                      onClick={() => setActiveConvId(c.id)}
                      className="flex-1 truncate text-left py-1 cursor-pointer"
                    >
                      {c.title}
                    </button>
                    <div className="opacity-0 group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 hover:text-foreground cursor-pointer"
                            aria-label="Conversation options"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              const newTitle = window.prompt("Rename conversation:", c.title);
                              if (newTitle !== null) {
                                const title = newTitle.trim();
                                if (title) {
                                  conversationsApi
                                    .update(wsId, c.id, { title })
                                    .then(() => {
                                      setConversations((prev) =>
                                        prev.map((x) => (x.id === c.id ? { ...x, title } : x)),
                                      );
                                    })
                                    .catch(console.error);
                                }
                              }
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer text-xs"
                            onClick={() => {
                              if (
                                window.confirm("Are you sure you want to delete this conversation?")
                              ) {
                                conversationsApi
                                  .delete(wsId, c.id)
                                  .then(() => {
                                    setConversations((prev) => prev.filter((x) => x.id !== c.id));
                                    if (activeConvId === c.id) {
                                      const remaining = conversations.filter((x) => x.id !== c.id);
                                      if (remaining.length > 0) {
                                        setActiveConvId(remaining[0].id);
                                      } else {
                                        setActiveConvId("");
                                      }
                                    }
                                  })
                                  .catch(console.error);
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {Object.keys(groupedConversations).length === 0 && (
              <p className="px-3 py-6 text-center font-ui text-xs text-muted-foreground">
                No conversations yet.
              </p>
            )}
          </div>
        </aside>
      )}

      {/* Main chat */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!historyOpen && (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              <div>
                <h1 className="font-display text-xl font-semibold leading-none">AI Research Assistant</h1>
                <p className="mt-1 font-ui text-[11px] text-muted-foreground">
                  Grounded in {wsPapers.length} workspace paper{wsPapers.length === 1 ? "" : "s"}
                  {" · "}
                  {model === "gemini" ? "Google Gemini" : model === "openai" ? "OpenAI GPT-4o" : "xAI Grok-2"}
                  {external ? " · External literature on" : " · Workspace only"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={model}
                onValueChange={(v) => {
                  setModel(v);
                  setDefaultModel(v);
                }}
              >
                <SelectTrigger className="h-7 w-auto rounded-full border-border bg-card px-2.5 font-ui text-xs text-muted-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                  <SelectItem value="grok">xAI (Grok-2)</SelectItem>
                </SelectContent>
              </Select>
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1 font-ui text-xs border transition-colors ${
                  external
                    ? "border-[var(--accent-purple)]/50 bg-[var(--accent-purple)]/10 text-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
                title={external ? "External literature included" : "Workspace papers only"}
              >
                <Globe className={`h-3 w-3 ${external ? "text-[var(--accent-purple)]" : ""}`} />
                Include external literature
                <Switch
                  checked={external}
                  onCheckedChange={(v) => {
                    setExternal(v);
                    setDefaultIncludeExternal(v);
                    toast.success(
                      v ? "External literature included" : "Using workspace papers only",
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6">
          {messages.length === 0 && !isSending ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <EmptyState
                icon={MessageSquareText}
                title="Ask a question about your research papers"
                description="Curio AI analyzes papers in your workspace, synthesizes methodology, and cites specific findings."
              />
              <div className="flex flex-col items-center max-w-xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 font-ui">
                  Suggested Prompts
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft(s)}
                      className="rounded-full border border-border bg-card px-3.5 py-1.5 font-ui text-xs text-foreground transition-all hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:text-foreground cursor-pointer shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-5xl space-y-6">
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  isLast={i === messages.length - 1}
                  onFollowup={(q) => setDraft(q)}
                  query={
                    [...messages.slice(0, i)]
                      .reverse()
                      .find((x) => x.role === "user")?.content ?? ""
                  }
                  wsName={ws.name}
                />
              ))}

              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                    <span>Analyzing research papers with {model === "gemini" ? "Google Gemini" : model}...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background/80 px-8 py-4">
          <div className="mx-auto max-w-3xl">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {attachments.map((file, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="flex items-center gap-1 text-[11px] font-ui border border-border"
                  >
                    <span>{file.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="file"
                id="chat-file"
                className="hidden"
                onChange={handleFileAttach}
                multiple
              />
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => document.getElementById("chat-file")?.click()}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isSending && send()}
                  placeholder="Ask about your research papers, methodologies, or findings..."
                  className="h-11 pl-10 font-sans text-sm"
                  disabled={isSending}
                />
              </div>
              <Button onClick={send} disabled={isSending} className="h-11 px-4 cursor-pointer">
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  m,
  isLast,
  onFollowup,
  query,
  wsName,
}: {
  m: ChatMessage;
  isLast: boolean;
  onFollowup: (q: string) => void;
  query: string;
  wsName: string;
}) {
  const papers = useApiStore((s) => s.papers);
  // Only the newest message animates in — history loads instantly.
  const enterClass = isLast ? "animate-enter" : undefined;

  if (m.role === "user") {
    return (
      <div className={`flex flex-col items-end gap-1.5 ${enterClass ?? ""}`}>
        {m.external && (
          <span className="flex items-center gap-1 font-ui text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-purple)]">
            <Globe className="h-2.5 w-2.5" /> External literature included
          </span>
        )}
        <div className="max-w-lg rounded-2xl rounded-br-md border border-[var(--primary)]/20 bg-[var(--primary)]/15 px-4 py-2.5 font-sans text-sm leading-relaxed text-foreground shadow-sm whitespace-pre-wrap">
          {m.content}
        </div>
      </div>
    );
  }

  const external = m.external;
  const modelLabel =
    (m as { model?: string }).model ??
    (external ? "Gemini · External" : "Gemini · Workspace");
  const resources = buildRelatedResources({
    query,
    papers,
    citedIds: (m.sources ?? []).map((s) => s.paperId),
    external: !!external,
    wsName,
  });
  const showRail = resources.length > 0;
  return (
    <div className={`flex justify-start ${enterClass ?? ""}`}>
      <div className={`grid w-full gap-4 ${showRail ? "lg:grid-cols-[minmax(0,1fr)_250px]" : ""} ${showRail ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="min-w-0">
        <Card
          className={`border p-0 shadow-sm ${
            external
              ? "border-[var(--accent-purple)]/40 bg-[var(--accent-purple)]/[0.04]"
              : "border-border"
          }`}
        >
          {/* Response header — model + provenance */}
          <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
            <span className="font-ui text-xs font-semibold text-foreground">Curio AI</span>
            <span className="font-ui text-[11px] text-muted-foreground">· {modelLabel}</span>
            {external ? (
              <Badge
                variant="outline"
                className="ml-auto flex items-center gap-1 border-[var(--accent-purple)]/40 font-ui text-[10px] text-[var(--accent-purple)]"
              >
                <Globe className="h-2.5 w-2.5" /> External literature
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-auto font-ui text-[10px] text-muted-foreground">
                Workspace sources
              </Badge>
            )}
          </div>

          {/* Structured answer body */}
          <div className="px-4 py-3">
            <Markdown text={m.content} />
          </div>

          {/* Cited sources with provenance */}
          {m.sources && m.sources.length > 0 && (
            <div className="space-y-2 border-t border-border/70 px-4 py-3">
              <div className="font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cited sources · {m.sources.length}
              </div>
              {m.sources.map((s, i) => {
                const paper = papers.find((p) => p.id === s.paperId);
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-background px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-ui text-xs font-semibold text-foreground">
                          {i + 1}. {paper?.title || "Referenced paper"}
                        </div>
                        <div className="mt-0.5 font-ui text-[11px] text-muted-foreground">
                          {paper
                            ? `${paper.authors.slice(0, 3).join(", ")} · ${paper.venue} · ${paper.year}`
                            : "External publication"}
                        </div>
                      </div>
                      <ConfidenceBar value={s.confidence} />
                    </div>
                    {s.paragraph && (
                      <div className="mt-2 border-l-2 border-[var(--primary)]/40 pl-2.5 font-sans text-xs leading-relaxed text-muted-foreground">
                        “{s.paragraph}”
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        {isLast && m.followups && m.followups.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Follow up
            </div>
            <div className="flex flex-wrap gap-2">
              {m.followups.map((f) => (
                <button
                  key={f}
                  onClick={() => onFollowup(f)}
                  className="rounded-full border border-border bg-card px-3 py-1 font-ui text-xs text-muted-foreground transition-all hover:border-[var(--primary)]/40 hover:text-foreground cursor-pointer shadow-sm"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
        {showRail && <RelatedRail resources={resources} />}
      </div>
    </div>
  );
}
