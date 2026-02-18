"use client";

import { FormEvent, useEffect, useState } from "react";

type Item = {
  id: number;
  name: string;
  createdAt: string;
};

export default function AdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadItems() {
      const response = await fetch("/api/items");

      if (!response.ok) {
        setError("Could not load items.");
        return;
      }

      const data = (await response.json()) as { items: Item[] };
      setItems(data.items);
    }

    void loadItems();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = (await response.json()) as {
        item?: Item;
        error?: string;
      };

      if (!response.ok || !data.item) {
        setError(data.error ?? "Unable to add item.");
        return;
      }

      setItems((current) => [data.item as Item, ...current]);
      setName("");
      setSuccess("Item added successfully.");
    } catch {
      setError("Request failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <h1>Item Admin</h1>
      <p>Add an item from this backend UI.</p>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <label htmlFor="name">Item name</label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter item name"
            maxLength={100}
            required
            style={{ flex: 1, padding: "8px 10px" }}
          />
          <button type="submit" disabled={loading} style={{ padding: "8px 14px" }}>
            {loading ? "Adding..." : "Add item"}
          </button>
        </div>
      </form>

      {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
      {success ? <p style={{ color: "#0f7a2f" }}>{success}</p> : null}

      <h2>Items</h2>
      {items.length === 0 ? <p>No items added yet.</p> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong>{" "}
            <span style={{ color: "#666" }}>
              ({new Date(item.createdAt).toLocaleString()})
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
