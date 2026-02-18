"use client";

import Image from "next/image";
import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type StepItem = {
  id: number;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  createdAt: string;
};

type Step = {
  id: number;
  name: string;
  items: StepItem[];
};

type Colour = {
  id: number;
  name: string;
  steps: Step[];
};

type Paper = {
  id: number;
  name: string;
  colours: Colour[];
};

type Printer = {
  id: number;
  name: string;
  papers: Paper[];
};

type TutorialState = {
  printers: Printer[];
};

type Selection = {
  printerId: number | null;
  paperId: number | null;
  colourId: number | null;
  stepId: number | null;
};

const emptyState: TutorialState = { printers: [] };

const baseCardStyle: CSSProperties = {
  border: "1px solid #d0d7de",
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
  background: "#fff",
};

const editorStyle: CSSProperties = {
  minHeight: 140,
  border: "1px solid #d0d7de",
  borderRadius: 6,
  padding: 10,
  marginBottom: 12,
};

export default function AdminPage() {
  const [tutorialState, setTutorialState] = useState<TutorialState>(emptyState);
  const [selection, setSelection] = useState<Selection>({
    printerId: null,
    paperId: null,
    colourId: null,
    stepId: null,
  });
  const [nameInput, setNameInput] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemContentHtml, setItemContentHtml] = useState("");
  const [itemImageDataUrl, setItemImageDataUrl] = useState("");
  const [itemImageName, setItemImageName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadState() {
      setLoadingState(true);
      setError(null);

      try {
        const response = await fetch("/api/tutorial", { cache: "no-store" });
        const payload = (await response.json()) as TutorialState | { error: string };

        if (!response.ok || !("printers" in payload)) {
          setError("Could not load tutorial data.");
          return;
        }

        setTutorialState(payload);
      } catch {
        setError("Could not load tutorial data.");
      } finally {
        setLoadingState(false);
      }
    }

    void loadState();
  }, []);

  const selectedPrinter = useMemo(
    () => tutorialState.printers.find((printer) => printer.id === selection.printerId) ?? null,
    [selection.printerId, tutorialState.printers],
  );

  const selectedPaper = useMemo(
    () => selectedPrinter?.papers.find((paper) => paper.id === selection.paperId) ?? null,
    [selection.paperId, selectedPrinter],
  );

  const selectedColour = useMemo(
    () => selectedPaper?.colours.find((colour) => colour.id === selection.colourId) ?? null,
    [selection.colourId, selectedPaper],
  );

  const selectedStep = useMemo(
    () => selectedColour?.steps.find((step) => step.id === selection.stepId) ?? null,
    [selection.stepId, selectedColour],
  );

  async function runAction(payload: Record<string, unknown>): Promise<boolean> {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json()) as TutorialState | { error: string };

      if (!response.ok || !("printers" in responsePayload)) {
        setError(
          "error" in responsePayload ? responsePayload.error : "Unable to save this change.",
        );
        return false;
      }

      setTutorialState(responsePayload);
      setNameInput("");
      setSuccess("Saved.");
      return true;
    } catch {
      setError("Request failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function resetItemFields() {
    setItemTitle("");
    setItemContentHtml("");
    setItemImageDataUrl("");
    setItemImageName("");

    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }

  async function handleAddEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPrinter) {
      await runAction({ action: "addPrinter", name: nameInput });
      return;
    }

    if (!selectedPaper) {
      await runAction({ action: "addPaper", printerId: selectedPrinter.id, name: nameInput });
      return;
    }

    if (!selectedColour) {
      await runAction({
        action: "addColour",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        name: nameInput,
      });
      return;
    }

    if (!selectedStep) {
      await runAction({
        action: "addStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        name: nameInput,
      });
    }
  }

  async function handleAddStepItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPrinter || !selectedPaper || !selectedColour || !selectedStep) {
      return;
    }

    if (!itemImageDataUrl) {
      setError("Image is required.");
      return;
    }

    const saved = await runAction({
      action: "addStepItem",
      printerId: selectedPrinter.id,
      paperId: selectedPaper.id,
      colourId: selectedColour.id,
      stepId: selectedStep.id,
      title: itemTitle,
      contentHtml: itemContentHtml,
      imageDataUrl: itemImageDataUrl,
    });

    if (saved) {
      resetItemFields();
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setItemImageDataUrl("");
      setItemImageName("");
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
            return;
          }

          reject(new Error("Could not read image."));
        };
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });

      setItemImageDataUrl(dataUrl);
      setItemImageName(file.name);
    } catch {
      setError("Could not read image.");
    }
  }

  function formatEditor(command: "bold" | "italic" | "insertUnorderedList") {
    document.execCommand(command);
    if (editorRef.current) {
      setItemContentHtml(editorRef.current.innerHTML);
    }
  }

  function goBackOneLevel() {
    if (selection.stepId !== null) {
      setSelection((current) => ({ ...current, stepId: null }));
      return;
    }

    if (selection.colourId !== null) {
      setSelection((current) => ({ ...current, colourId: null, stepId: null }));
      return;
    }

    if (selection.paperId !== null) {
      setSelection((current) => ({ ...current, paperId: null, colourId: null, stepId: null }));
      return;
    }

    if (selection.printerId !== null) {
      setSelection({ printerId: null, paperId: null, colourId: null, stepId: null });
    }
  }

  const breadcrumb = [
    {
      label: "Printers",
      onClick: () => {
        setSelection({ printerId: null, paperId: null, colourId: null, stepId: null });
      },
    },
    ...(selectedPrinter
      ? [
          {
            label: selectedPrinter.name,
            onClick: () => {
              setSelection({
                printerId: selectedPrinter.id,
                paperId: null,
                colourId: null,
                stepId: null,
              });
            },
          },
        ]
      : []),
    ...(selectedPaper
      ? [
          {
            label: selectedPaper.name,
            onClick: () => {
              setSelection((current) => ({
                ...current,
                paperId: selectedPaper.id,
                colourId: null,
                stepId: null,
              }));
            },
          },
        ]
      : []),
    ...(selectedColour
      ? [
          {
            label: selectedColour.name,
            onClick: () => {
              setSelection((current) => ({
                ...current,
                colourId: selectedColour.id,
                stepId: null,
              }));
            },
          },
        ]
      : []),
    ...(selectedStep
      ? [
          {
            label: selectedStep.name,
            onClick: () => {
              setSelection((current) => ({ ...current, stepId: selectedStep.id }));
            },
          },
        ]
      : []),
  ];

  const formLabel = !selectedPrinter
    ? "Add Printer"
    : !selectedPaper
      ? `Add Paper in ${selectedPrinter.name}`
      : !selectedColour
        ? `Add Colour in ${selectedPaper.name}`
        : !selectedStep
          ? `Add Step in ${selectedColour.name}`
          : "Add Item in Step";

  const listTitle = !selectedPrinter
    ? "Printers"
    : !selectedPaper
      ? "Papers"
      : !selectedColour
        ? "Colours"
        : !selectedStep
          ? "Steps"
          : "Step Items";

  const currentList = !selectedPrinter
    ? tutorialState.printers
    : !selectedPaper
      ? selectedPrinter.papers
      : !selectedColour
        ? selectedPaper.colours
        : !selectedStep
          ? selectedColour.steps
          : selectedStep.items;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px" }}>
      <h1>Tutorial Printer Admin</h1>
      <p>Create tutorials by drilling down through Printer, Paper, Colour, Step, and Item.</p>

      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
        {breadcrumb.map((item, index) => (
          <span key={item.label + String(index)}>
            {index > 0 ? <span style={{ color: "#666" }}> / </span> : null}
            <button
              type="button"
              onClick={item.onClick}
              style={{
                border: "none",
                background: "none",
                color: "#0958d9",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {item.label}
            </button>
          </span>
        ))}
      </nav>

      {selection.printerId !== null ? (
        <button type="button" onClick={goBackOneLevel} style={{ marginBottom: 20 }}>
          Back one level
        </button>
      ) : null}

      {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
      {success ? <p style={{ color: "#0f7a2f" }}>{success}</p> : null}

      {loadingState ? <p>Loading...</p> : null}

      {!loadingState ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <section style={baseCardStyle}>
            <h2>{formLabel}</h2>

            {selectedStep ? (
              <form onSubmit={(event) => void handleAddStepItem(event)}>
                <label htmlFor="item-title">Item title</label>
                <input
                  id="item-title"
                  value={itemTitle}
                  onChange={(event) => setItemTitle(event.target.value)}
                  required
                  maxLength={100}
                  style={{ width: "100%", marginTop: 8, marginBottom: 12, padding: "8px 10px" }}
                />

                <label>WYSIWYG content</label>
                <div style={{ marginTop: 8, marginBottom: 8, display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => formatEditor("bold")}>
                    Bold
                  </button>
                  <button type="button" onClick={() => formatEditor("italic")}>
                    Italic
                  </button>
                  <button type="button" onClick={() => formatEditor("insertUnorderedList")}>
                    List
                  </button>
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) =>
                    setItemContentHtml((event.currentTarget as HTMLDivElement).innerHTML)
                  }
                  style={editorStyle}
                />

                <label htmlFor="item-image">Image upload</label>
                <input
                  id="item-image"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handleImageUpload(event);
                  }}
                  required
                  style={{ display: "block", marginTop: 8, marginBottom: 10 }}
                />

                {itemImageName ? <p style={{ color: "#666" }}>Selected: {itemImageName}</p> : null}

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Add Item"}
                  </button>
                  <button type="button" onClick={resetItemFields}>
                    Reset fields
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(event) => void handleAddEntity(event)}>
                <label htmlFor="entity-name">Name</label>
                <input
                  id="entity-name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  required
                  maxLength={100}
                  style={{ width: "100%", marginTop: 8, marginBottom: 12, padding: "8px 10px" }}
                />
                <button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </button>
              </form>
            )}
          </section>

          <section style={baseCardStyle}>
            <h2>{listTitle}</h2>
            {currentList.length === 0 ? <p>No entries yet.</p> : null}

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {currentList.map((entry) => {
                if (selectedStep) {
                  const item = entry as StepItem;

                  return (
                    <li key={item.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
                      <strong>{item.title}</strong>
                      <p style={{ color: "#666", margin: "4px 0" }}>
                        Created: {new Date(item.createdAt).toLocaleString()}
                      </p>
                      <div
                        style={{ color: "#222", marginBottom: 8 }}
                        dangerouslySetInnerHTML={{ __html: item.contentHtml }}
                      />
                      <Image
                        src={item.imageDataUrl}
                        alt={item.title}
                        width={120}
                        height={120}
                        unoptimized
                        style={{ objectFit: "cover", borderRadius: 6 }}
                      />
                    </li>
                  );
                }

                const node = entry as Printer | Paper | Colour | Step;

                return (
                  <li
                    key={node.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      padding: "10px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span>{node.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedPrinter) {
                          setSelection({
                            printerId: node.id,
                            paperId: null,
                            colourId: null,
                            stepId: null,
                          });
                          return;
                        }

                        if (!selectedPaper) {
                          setSelection((current) => ({
                            ...current,
                            paperId: node.id,
                            colourId: null,
                            stepId: null,
                          }));
                          return;
                        }

                        if (!selectedColour) {
                          setSelection((current) => ({
                            ...current,
                            colourId: node.id,
                            stepId: null,
                          }));
                          return;
                        }

                        if (!selectedStep) {
                          setSelection((current) => ({ ...current, stepId: node.id }));
                        }
                      }}
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}
