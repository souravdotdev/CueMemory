"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cue-memory/ui/button";
import { createItemRequestDtoSchema } from "@cue-memory/contracts/items";
import { createItem } from "@/lib/api";

export function SaveForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Same contract the API validates with, so the form and server never disagree.
    const parsed = createItemRequestDtoSchema.safeParse({ url });
    if (!parsed.success) {
      setStatus("error");
      setError(parsed.error.issues[0]?.message ?? "That link isn't valid");
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await createItem(parsed.data.url);
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
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", gap: "0.5rem" }}>
      <input
        type="url"
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
