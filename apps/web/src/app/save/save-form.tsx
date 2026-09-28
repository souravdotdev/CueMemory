"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cue-memory/ui/button";
import { createItem } from "@/lib/api";

export function SaveForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      await createItem(url);
      setUrl("");
      router.push("/");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
      return;
    }

    setStatus("idle");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
      <input
        type="url"
        required
        placeholder="Paste a link…"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        style={{ flex: 1, padding: "0.5rem" }}
      />
      <Button type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save"}
      </Button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
