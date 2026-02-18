export type Item = {
  id: number;
  name: string;
  createdAt: string;
};

const items: Item[] = [];

export function listItems(): Item[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addItem(name: string): Item {
  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    throw new Error("Item name must be at least 2 characters long.");
  }

  if (trimmedName.length > 100) {
    throw new Error("Item name must be 100 characters or less.");
  }

  const newItem: Item = {
    id: Date.now(),
    name: trimmedName,
    createdAt: new Date().toISOString(),
  };

  items.push(newItem);

  return newItem;
}
