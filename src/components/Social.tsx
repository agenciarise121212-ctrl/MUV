"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { fetchJson } from "@/lib/http";

const base = "inline-flex items-center gap-2 h-10 px-3 text-[13px] font-medium transition-colors";

export function KudosButton({ id, initial }: { id: number; initial: number }) {
  const [k, setK] = useState(initial);
  const [given, setGiven] = useState(false);
  return (
    <button aria-label="Dar kudos" onClick={async () => { if (given) return; setGiven(true); setK(k + 1); const r = await fetchJson<{ kudos: number }>(`/api/activities/${id}/kudos`, { method: "POST" }); if (r.ok) setK(r.data.kudos); }}
      className={`${base} ${given ? "text-lime" : "text-mute hover:text-bone"}`}>
      <Icon name="thumb" size={18} className={given ? "fill-lime/20 scale-110 transition-transform" : "transition-transform"} /><span className="num">{k}</span>
    </button>
  );
}

export function ShareButton({ id, title, text }: { id: number; title: string; text: string }) {
  const [msg, setMsg] = useState("");
  return (
    <button onClick={async () => {
      const url = `${location.origin}/activities/${id}`;
      try {
        if (navigator.share) await navigator.share({ title, text, url });
        else { await navigator.clipboard.writeText(`${text}\n${url}`); setMsg("Link copiado"); setTimeout(() => setMsg(""), 2000); }
      } catch {}
    }} className={`${base} ${msg ? "text-lime" : "text-mute hover:text-bone"}`}><Icon name="share" size={18} />{msg || "Compartilhar"}</button>
  );
}

export function CommentForm({ id }: { id: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="flex flex-col  gap-2" onSubmit={async (e) => {
      e.preventDefault(); if (!body.trim()) return; setBusy(true);
      const r = await fetchJson(`/api/activities/${id}/comments`, { json: { author: author.trim(), body: body.trim() } });
      if (!r.ok) { alert(r.error); setBusy(false); return; }
      setBody(""); setBusy(false); router.refresh();
    }}>
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Seu nome" className="field " />
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva um comentário" className="field flex-1" />
      <button disabled={busy} className="btn btn-lime btn-sm !h-[42px]">Enviar</button>
    </form>
  );
}
