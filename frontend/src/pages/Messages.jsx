import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth.jsx";
import { api, imageUrl } from "@/lib/api";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send } from "lucide-react";

export default function Messages() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const load = () => api.get("/messages/threads").then(r => {
      setThreads(r.data);
      if (!activeId && r.data.length > 0) setActiveId(r.data[0].booking_id);
    });
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [user, activeId]);

  useEffect(() => {
    if (!activeId) return;
    const load = () => api.get(`/messages/${activeId}`).then(r => {
      setMessages(r.data);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
    });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [activeId]);

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    try {
      await api.post("/messages", { booking_id: activeId, content: draft });
      setDraft("");
      const r = await api.get(`/messages/${activeId}`);
      setMessages(r.data);
    } catch {}
  };

  if (!user) return null;

  const activeThread = threads.find(t => t.booking_id === activeId);

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-heading text-3xl font-extrabold mb-6">{t("messages_page.title")}</h1>

        {threads.length === 0 ? (
          <div className="bg-white border border-brand-border rounded-2xl p-16 text-center" data-testid="messages-empty">
            <MessageSquare className="w-12 h-12 mx-auto text-brand-muted/40 mb-4" />
            <h3 className="font-heading text-xl font-bold mb-1">{t("messages_page.no_messages")}</h3>
            <p className="text-brand-muted text-sm">{t("messages_page.no_messages_sub")}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-[320px_1fr] gap-6 h-[calc(100vh-220px)]">
            {/* Threads list */}
            <div className="bg-white border border-brand-border rounded-2xl overflow-y-auto">
              {threads.map(t => (
                <button key={t.booking_id} onClick={() => setActiveId(t.booking_id)}
                  data-testid={`thread-${t.booking_id}`}
                  className={`w-full text-left p-4 border-b border-brand-border transition-colors hover:bg-brand-subtle ${activeId === t.booking_id ? 'bg-brand-primary/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {t.counterparty?.picture && <AvatarImage src={t.counterparty.picture} />}
                      <AvatarFallback className="text-xs bg-brand-primary text-white">{t.counterparty?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold truncate">{t.counterparty?.name}</span>
                        {t.unread_count > 0 && <Badge className="bg-brand-secondary text-white border-0 text-xs">{t.unread_count}</Badge>}
                      </div>
                      <div className="text-xs text-brand-muted truncate">{t.tool?.title}</div>
                      <div className="text-xs text-brand-muted truncate mt-1">{t.last_message?.content}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Active thread */}
            <div className="bg-white border border-brand-border rounded-2xl flex flex-col overflow-hidden">
              {activeThread && (
                <div className="border-b border-brand-border p-4 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {activeThread.counterparty?.picture && <AvatarImage src={activeThread.counterparty.picture} />}
                    <AvatarFallback className="text-xs bg-brand-primary text-white">{activeThread.counterparty?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-semibold">{activeThread.counterparty?.name}</div>
                    <Link to={`/bookings/${activeThread.booking_id}`} className="text-xs text-brand-primary hover:underline">
                      {activeThread.tool?.title} · view booking →
                    </Link>
                  </div>
                </div>
              )}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="messages-list">
                {messages.map(m => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl ${mine ? 'bg-brand-primary text-white rounded-br-sm' : 'bg-brand-subtle text-brand-text rounded-bl-sm'}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
                        <div className={`text-xs mt-1 ${mine ? 'text-white/70' : 'text-brand-muted'}`}>{m.created_at?.slice(11, 16)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-brand-border p-3 flex gap-2">
                <Input
                  value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') send(); }}
                  placeholder={t("booking.type_message")}
                  data-testid="message-input-field"
                  className="rounded-xl flex-1" />
                <Button onClick={send} disabled={!draft.trim()}
                  data-testid="message-send-btn"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
