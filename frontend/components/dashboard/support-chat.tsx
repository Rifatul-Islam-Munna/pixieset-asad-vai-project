"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Ban, Clock3, Crown, MessageCircle, Search, Send, Trash2, UserRound, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteSupportConversation, getAdminSupportHistory, getMySupport, getSupportConversations, setSupportBlocked, type SupportConversation, type SupportMessage } from "@/actions/support";

const wsUrl = process.env.NEXT_PUBLIC_SUPPORT_WS_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:4000";
const idleMs = Math.max(60_000, Number(process.env.NEXT_PUBLIC_SUPPORT_IDLE_MINUTES ?? 5) * 60_000);
const activityPingMs = 60_000;

function formatShortTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SupportChat({ admin = false }: { admin?: boolean }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [connected, setConnected] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const [idle, setIdle] = useState(false);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [cooldownLimit, setCooldownLimit] = useState(20);
  const [supportBlocked, setSupportBlockedState] = useState(false);
  const [moderationBusy, setModerationBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const selectedUserRef = useRef("");
  const lastActivityRef = useRef(Date.now());
  const lastPingRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => conversations.find((item) => item.userId === selectedUserId), [conversations, selectedUserId]);
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((item) => `${item.user?.name ?? ""} ${item.user?.email ?? ""} ${item.lastMessage ?? ""}`.toLowerCase().includes(q));
  }, [conversations, search]);

  useEffect(() => {
    selectedUserRef.current = selectedUserId;
  }, [selectedUserId]);

  const updateConversationFromMessage = useCallback((message: SupportMessage) => {
    setConversations((current) => {
      const index = current.findIndex((item) => item.userId === message.userId);
      if (index < 0) {
        void getSupportConversations().then(setConversations).catch(() => undefined);
        return current;
      }
      const next = [...current];
      next[index] = { ...next[index], lastMessage: message.message, lastAt: message.createdAt ?? new Date().toISOString() };
      return [next[index], ...next.filter((_, i) => i !== index)];
    });
  }, []);

  const reconnectIfNeeded = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.connected || document.hidden) return;
    setIdle(false);
    socket.connect();
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (admin) {
          const list = await getSupportConversations();
          if (!mounted) return;
          setConversations(list);
          if (list[0]) setSelectedUserId(list[0].userId);
        } else {
          const data = await getMySupport();
          if (!mounted) return;
          setMessages(data.messages);
          setCooldownLimit(Number(data.cooldownSeconds || 20));
          setSupportBlockedState(Boolean(data.supportBlocked));
        }

        const tokenResponse = await fetch("/api/support/socket-token", { cache: "no-store" });
        if (!tokenResponse.ok) throw new Error("Could not authenticate live support");
        const { token } = await tokenResponse.json();
        const socket = io(`${wsUrl}/support`, {
          transports: ["websocket"],
          auth: { token },
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          randomizationFactor: 0.5,
        });
        socketRef.current = socket;
        socket.on("connect", () => {
          if (!mounted) return;
          setConnected(true);
          setIdle(false);
          if (admin) setAdminOnline(true);
        });
        socket.on("disconnect", () => {
          if (!mounted) return;
          setConnected(false);
          if (admin) setAdminOnline(false);
        });
        socket.on("support:admin-status", (value: { online: boolean }) => {
          if (!admin && mounted) setAdminOnline(Boolean(value.online));
        });
        socket.on("support:message", (message: SupportMessage) => {
          if (!admin || message.userId === selectedUserRef.current) {
            setMessages((current) => current.some((item) => item._id === message._id) ? current : [...current, message]);
          }
          if (admin) updateConversationFromMessage(message);
        });
        socket.on("support:blocked", (value: { userId?: string; blocked: boolean }) => {
          if (!admin) setSupportBlockedState(Boolean(value.blocked));
          else if (value.userId) setConversations((current) => current.map((item) => item.userId === value.userId ? { ...item, user: { ...item.user, supportBlocked: Boolean(value.blocked) } } : item));
        });
        socket.on("support:conversation-cleared", (value?: { userId?: string }) => {
          if (!admin) setMessages([]);
          else if (value?.userId) {
            if (selectedUserRef.current === value.userId) setMessages([]);
            setConversations((current) => current.filter((item) => item.userId !== value.userId));
          }
        });
        socket.connect();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Support could not load");
      }
    })();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [admin, updateConversationFromMessage]);
  useEffect(() => {
    if (!admin || !selectedUserId) return;
    setMessages([]);
    getAdminSupportHistory(selectedUserId)
      .then((data) => setMessages(data.messages))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Chat could not load"));
  }, [admin, selectedUserId]);

  useEffect(() => {
    const markActive = () => {
      lastActivityRef.current = Date.now();
      if (idle) reconnectIfNeeded();
      const now = Date.now();
      if (socketRef.current?.connected && now - lastPingRef.current >= activityPingMs) {
        lastPingRef.current = now;
        socketRef.current.emit("support:active");
      }
    };
    const onVisibility = () => {
      if (!document.hidden) markActive();
    };
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive, { passive: true });
    window.addEventListener("focus", markActive);
    document.addEventListener("visibilitychange", onVisibility);
    const idleTimer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= idleMs && socketRef.current?.connected) {
        setIdle(true);
        socketRef.current.disconnect();
      }
    }, 15_000);
    return () => {
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
      window.removeEventListener("focus", markActive);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(idleTimer);
    };
  }, [idle, reconnectIfNeeded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const send = () => {
    const message = text.trim();
    if (!message) return;
    if (!socketRef.current?.connected) {
      reconnectIfNeeded();
      toast.message("Reconnecting support chat…");
      return;
    }
    if (!admin && cooldown > 0) return;
    socketRef.current.emit("support:send", { message, userId: admin ? selectedUserId : undefined }, (result: { ok: boolean; error?: string }) => {
      if (!result?.ok) return toast.error(result?.error ?? "Message failed");
      setText("");
      lastActivityRef.current = Date.now();
      if (!admin) setCooldown(cooldownLimit);
    });
  };

  const deleteConversation = async () => {
    if (!admin || !selectedUserId || moderationBusy) return;
    if (!window.confirm("Delete this entire support conversation? This cannot be undone.")) return;
    setModerationBusy(true);
    try {
      await deleteSupportConversation(selectedUserId);
      setMessages([]);
      setConversations((current) => current.filter((item) => item.userId !== selectedUserId));
      setSelectedUserId("");
      toast.success("Conversation deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete conversation");
    } finally {
      setModerationBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!admin || !selectedUserId || moderationBusy) return;
    const nextBlocked = !Boolean(selected?.user?.supportBlocked);
    if (nextBlocked && !window.confirm("Block this user from sending any more support messages?")) return;
    setModerationBusy(true);
    try {
      await setSupportBlocked(selectedUserId, nextBlocked);
      setConversations((current) => current.map((item) => item.userId === selectedUserId ? { ...item, user: { ...item.user, supportBlocked: nextBlocked } } : item));
      toast.success(nextBlocked ? "User blocked from support chat" : "User unblocked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update support access");
    } finally {
      setModerationBusy(false);
    }
  };

  const connectionLabel = idle
    ? "Paused while inactive"
    : !connected
      ? "Reconnecting"
      : admin
        ? "Live console"
        : adminOnline
          ? "Admin online"
          : "Admin currently away";

  return (
    <div className="mx-auto w-full max-w-[1240px] px-3 py-4 sm:px-6 sm:py-6">
      <div className="overflow-hidden rounded-[24px] border border-[#e9e4f4] bg-white shadow-[0_24px_80px_rgba(53,35,95,.10)]">
        <header className="flex flex-col gap-4 border-b border-[#eeeaf5] bg-[linear-gradient(135deg,#ffffff_0%,#faf8ff_70%,#f4efff_100%)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#6337d8] text-white shadow-[0_10px_28px_rgba(99,55,216,.24)]"><Crown className="size-5" /></div>
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#6337d8]">VIP Support</p><span className="rounded-full bg-[#f0eaff] px-2 py-0.5 text-[10px] font-semibold text-[#6337d8]">Private</span></div><h1 className="mt-1 truncate text-xl font-semibold tracking-[-.02em] text-[#1f1d24] sm:text-2xl">{admin ? "Support inbox" : "Priority support"}</h1></div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e7e1f2] bg-white/90 px-3 py-2 text-xs font-semibold text-[#5d5865] shadow-sm">
            {connected && !idle ? <Wifi className="size-4 text-[#6337d8]" /> : <WifiOff className="size-4 text-[#aaa3b3]" />}
            <span>{connectionLabel}</span>
            <span className={`size-2 rounded-full ${connected && !idle ? (admin || adminOnline ? "bg-emerald-500" : "bg-amber-400") : "bg-[#b9b4c0]"}`} />
          </div>
        </header>

        <div className={`grid min-h-[650px] ${admin ? "lg:grid-cols-[330px_1fr]" : ""}`}>
          {admin && (
            <aside className="border-b border-[#eeeaf5] bg-[#fbfaff] lg:border-b-0 lg:border-r">
              <div className="border-b border-[#eeeaf5] p-4">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#aaa3b3]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search VIP users" className="h-10 rounded-xl border-[#e3dced] bg-white pl-9 shadow-none focus-visible:ring-[#6337d8]" /></div>
                <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-[#8b8493]"><span>{filteredConversations.length} conversations</span><span>10-day history</span></div>
              </div>
              <div className="max-h-[590px] overflow-y-auto">
                {filteredConversations.map((item) => {
                  const active = selectedUserId === item.userId;
                  const label = item.user?.name || item.user?.email || "VIP user";
                  return <button key={item.userId} type="button" onClick={() => setSelectedUserId(item.userId)} className={`group w-full border-b border-[#f0ecf6] px-4 py-4 text-left transition ${active ? "bg-white shadow-[inset_3px_0_0_#6337d8]" : "hover:bg-[#f6f2ff]"}`}>
                    <div className="flex items-start gap-3"><div className={`grid size-10 shrink-0 place-items-center rounded-full ${active ? "bg-[#6337d8] text-white" : "bg-[#eee8f8] text-[#6337d8]"}`}><UserRound className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-[#26232b]">{label}</p><span className="shrink-0 text-[10px] text-[#aaa3b3]">{formatShortTime(item.lastAt)}</span></div><p className="mt-1 truncate text-xs leading-5 text-[#817a88]">{item.lastMessage || "No message preview"}</p></div></div>
                  </button>;
                })}
                {!filteredConversations.length && <div className="px-6 py-14 text-center"><MessageCircle className="mx-auto size-8 text-[#c4b8df]" /><p className="mt-3 text-sm font-medium text-[#696270]">No conversations found</p><p className="mt-1 text-xs text-[#9992a0]">New VIP chats will appear here.</p></div>}
              </div>
            </aside>
          )}

          <section className="flex min-h-[650px] min-w-0 flex-col bg-white">
            <div className="flex min-h-[70px] items-center justify-between gap-4 border-b border-[#eeeaf5] px-5 py-4 sm:px-6">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#25222a]">{admin ? (selected?.user?.name || selected?.user?.email || "Select a VIP conversation") : "Gallerista VIP Support"}</p><div className="mt-1 flex items-center gap-2 text-xs text-[#8a8390]"><Clock3 className="size-3.5" /><span>Messages are automatically removed after 10 days</span></div></div>
              {admin && selectedUserId ? <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={moderationBusy} onClick={toggleBlock} className={selected?.user?.supportBlocked ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}><Ban className="mr-2 size-4" />{selected?.user?.supportBlocked ? "Unblock" : "Block"}</Button><Button type="button" variant="outline" disabled={moderationBusy} onClick={deleteConversation} className="border-red-200 text-red-600 hover:bg-red-50"><Trash2 className="mr-2 size-4" />Delete chat</Button></div> : !admin && connected ? <span className={`hidden rounded-full px-3 py-1.5 text-[11px] font-semibold sm:inline-flex ${adminOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{adminOnline ? "Usually replies quickly" : "We’ll reply when available"}</span> : null}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,#faf8ff_0%,#fcfbff_30%,#ffffff_100%)] px-4 py-5 sm:px-6">
              {messages.map((message) => {
                const mine = admin ? message.senderType === "admin" : message.senderType === "user";
                return <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] sm:max-w-[72%] ${mine ? "text-right" : "text-left"}`}><div className={`inline-block rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${mine ? "rounded-br-md bg-[#6337d8] text-white shadow-[0_8px_22px_rgba(99,55,216,.18)]" : "rounded-bl-md border border-[#ebe6f3] bg-white text-[#2c2830]"}`}><p className="whitespace-pre-wrap break-words text-left">{message.message}</p></div><p className={`mt-1.5 px-1 text-[10px] ${mine ? "text-[#9c92aa]" : "text-[#aaa3b3]"}`}>{formatMessageTime(message.createdAt)}</p></div></div>;
              })}
              {!messages.length && <div className="grid min-h-[430px] place-items-center px-6 text-center"><div className="max-w-sm"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f0eaff] text-[#6337d8]"><MessageCircle className="size-6" /></div><h3 className="mt-4 text-base font-semibold text-[#302c34]">{admin ? "Select a VIP conversation" : "How can we help?"}</h3><p className="mt-2 text-sm leading-6 text-[#817a88]">{admin ? "Choose a conversation from the inbox to read the history and reply." : "Send a message to the admin team. This is a private support channel included with your VIP plan."}</p></div></div>}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-[#eeeaf5] bg-white px-4 py-4 sm:px-6">
              {idle && <button type="button" onClick={reconnectIfNeeded} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f6f2ff] px-4 py-2.5 text-xs font-semibold text-[#6337d8] hover:bg-[#efe8ff]"><WifiOff className="size-4" />Chat paused while you were inactive — click to reconnect</button>}
              {!admin && supportBlocked && <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"><Ban className="size-4" />You have been blocked from sending new support messages. You can still read your existing chat.</div>}
              <div className="rounded-2xl border border-[#ddd6e8] bg-white p-2 shadow-[0_8px_30px_rgba(50,32,85,.06)] focus-within:border-[#bca9eb] focus-within:ring-2 focus-within:ring-[#6337d8]/10">
                <Textarea value={text} onChange={(event) => setText(event.target.value)} onFocus={reconnectIfNeeded} disabled={(admin && !selectedUserId) || (!admin && supportBlocked)} placeholder={admin ? "Write a reply…" : supportBlocked ? "Messaging has been disabled for this support chat" : cooldown > 0 ? `You can send another message in ${cooldown}s` : "Write a message…"} className="min-h-[72px] resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} />
                <div className="flex items-center justify-between gap-3 border-t border-[#f0edf5] px-1 pt-2"><p className="text-[11px] text-[#9992a0]">{admin ? "Enter to send · Shift + Enter for a new line" : supportBlocked ? "Sending disabled by support admin" : cooldown > 0 ? `Rate limit active · ${cooldown}s remaining` : "One message every 20 seconds · Enter to send"}</p><Button type="button" onClick={send} disabled={!text.trim() || (!admin && (cooldown > 0 || supportBlocked)) || (admin && !selectedUserId)} className="h-9 rounded-xl bg-[#6337d8] px-4 text-white shadow-[0_6px_18px_rgba(99,55,216,.20)] hover:bg-[#5730c3]"><Send className="mr-2 size-3.5" />Send</Button></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
