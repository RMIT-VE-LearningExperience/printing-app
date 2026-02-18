export type RichTextBlockType = "heading" | "paragraph" | "bullets" | "callout";

export type RichTextBlock = {
  id: string;
  type: RichTextBlockType;
  text: string;
  items?: string[];
};

export type InlineSegment = {
  text: string;
  href: string | null;
};

const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;

function makeBlockId() {
  return `blk-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function legacyHtmlToBlocks(contentHtml: string): RichTextBlock[] {
  const text = htmlToPlainText(contentHtml);
  if (!text) {
    return [];
  }

  return [
    {
      id: makeBlockId(),
      type: "paragraph",
      text,
    },
  ];
}

export function normalizeRichTextBlocks(input: unknown): RichTextBlock[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const mapped = input.map((raw): RichTextBlock | null => {
      if (!raw || typeof raw !== "object") {
        return null;
      }

      const candidate = raw as Partial<RichTextBlock>;
      const type = candidate.type;
      if (
        type !== "heading" &&
        type !== "paragraph" &&
        type !== "bullets" &&
        type !== "callout"
      ) {
        return null;
      }

      if (type === "bullets") {
        const items = Array.isArray(candidate.items)
          ? candidate.items.map((item) => normalizeText(item)).filter(Boolean)
          : [];
        if (items.length === 0) {
          return null;
        }

        return {
          id: normalizeText(candidate.id) || makeBlockId(),
          type,
          text: "",
          items,
        } satisfies RichTextBlock;
      }

      const text = normalizeText(candidate.text);
      if (!text) {
        return null;
      }

      return {
        id: normalizeText(candidate.id) || makeBlockId(),
        type,
        text,
      };
    });

  const blocks: RichTextBlock[] = mapped.filter((block) => block !== null);

  return blocks;
}

export function hasMeaningfulBlocks(blocks: RichTextBlock[]): boolean {
  return blocks.some((block) =>
    block.type === "bullets" ? (block.items?.length ?? 0) > 0 : block.text.trim().length > 0,
  );
}

export function parseInlineSegments(input: string): InlineSegment[] {
  if (!input) {
    return [{ text: "", href: null }];
  }

  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  LINK_PATTERN.lastIndex = 0;
  while (true) {
    match = LINK_PATTERN.exec(input);
    if (!match) {
      break;
    }

    const [matched, label, href] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      segments.push({
        text: input.slice(lastIndex, matchIndex),
        href: null,
      });
    }

    segments.push({
      text: label.trim(),
      href: href.trim(),
    });

    lastIndex = matchIndex + matched.length;
  }

  if (lastIndex < input.length) {
    segments.push({
      text: input.slice(lastIndex),
      href: null,
    });
  }

  if (segments.length === 0) {
    segments.push({ text: input, href: null });
  }

  return segments;
}

export function blocksToLegacyHtml(blocks: RichTextBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        return `<h3>${escapeHtml(block.text)}</h3>`;
      }

      if (block.type === "callout") {
        return `<p><strong>${escapeHtml(block.text)}</strong></p>`;
      }

      if (block.type === "bullets") {
        const items = (block.items ?? [])
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join("");
}
