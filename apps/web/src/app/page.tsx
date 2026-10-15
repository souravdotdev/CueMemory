import { Card } from "@cue-memory/ui/card";
import { fetchItems } from "@/lib/api";
import { itemTypeLabel } from "@/lib/item-type-label";

export default async function FeedPage() {
  const { items } = await fetchItems();

  if (items.length === 0) {
    return <p>Nothing saved yet — head to Save to paste your first link.</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
      {items.map((item) => (
        <li key={item.id}>
          <Card>
            <strong>{item.title ?? item.sourceUrl}</strong>
            <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
              {[itemTypeLabel(item.type), item.status].filter(Boolean).join(" · ")}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
