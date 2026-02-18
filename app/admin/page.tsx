"use client";

import Image from "next/image";
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Divider,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Step = {
  id: string;
  name: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
};

type Colour = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  steps: Step[];
};

type Paper = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  colours: Colour[];
};

type Printer = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  papers: Paper[];
};

type TutorialState = {
  printers: Printer[];
};

type Selection = {
  printerId: string | null;
  paperId: string | null;
  colourId: string | null;
  stepId: string | null;
};

type Level = "printer" | "paper" | "colour" | "step";
type Direction = "up" | "down";

const emptyState: TutorialState = { printers: [] };

const THUMBNAIL_MIN_WIDTH = 800;
const THUMBNAIL_MIN_HEIGHT = 600;
const THUMBNAIL_ASPECT = 4 / 3;
const THUMBNAIL_ASPECT_TOLERANCE = 0.08;

function getAspectError(width: number, height: number) {
  const ratio = width / height;
  if (Math.abs(ratio - THUMBNAIL_ASPECT) > THUMBNAIL_ASPECT_TOLERANCE) {
    return `Thumbnail should be close to 4:3 ratio. Current ratio is ${ratio.toFixed(2)}:1.`;
  }
  return null;
}

async function getImageSizeFromDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => reject(new Error("Could not read image metadata."));
    image.src = dataUrl;
  });
}

type RichHtmlEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function RichHtmlEditor({ label, value, onChange }: RichHtmlEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  function insertLink() {
    const urlInput = window.prompt("Enter URL (https://...)");
    if (!urlInput) {
      return;
    }
    const url = /^(https?:)?\/\//i.test(urlInput) ? urlInput : `https://${urlInput}`;
    runCommand("createLink", url);
  }

  return (
    <Box>
      <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
        <Button size="small" variant="outlined" onMouseDown={(e) => { e.preventDefault(); runCommand("formatBlock", "h3"); }}>
          Heading
        </Button>
        <Button size="small" variant="outlined" onMouseDown={(e) => { e.preventDefault(); runCommand("bold"); }}>
          Bold
        </Button>
        <Button size="small" variant="outlined" onMouseDown={(e) => { e.preventDefault(); runCommand("italic"); }}>
          Italic
        </Button>
        <Button size="small" variant="outlined" onMouseDown={(e) => { e.preventDefault(); runCommand("insertUnorderedList"); }}>
          Bullets
        </Button>
        <Button size="small" variant="outlined" onMouseDown={(e) => { e.preventDefault(); insertLink(); }}>
          Insert link
        </Button>
        <Button size="small" variant="outlined" onMouseDown={(e) => { e.preventDefault(); runCommand("unlink"); }}>
          Remove link
        </Button>
      </Stack>
      <Box
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange((event.target as HTMLDivElement).innerHTML)}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          px: 1.5,
          py: 1.25,
          minHeight: 170,
          outline: "none",
          "&:focus": {
            borderColor: "primary.main",
            boxShadow: (theme) => `0 0 0 1px ${theme.palette.primary.main}`,
          },
        }}
      />
    </Box>
  );
}

function hasMeaningfulContent(html: string) {
  const plain = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  return plain.length > 0;
}

export default function AdminPage() {
  const [tutorialState, setTutorialState] = useState<TutorialState>(emptyState);
  const [selection, setSelection] = useState<Selection>({
    printerId: null,
    paperId: null,
    colourId: null,
    stepId: null,
  });

  const [nameInput, setNameInput] = useState("");
  const [entityThumbnailDataUrl, setEntityThumbnailDataUrl] = useState("");
  const [entityThumbnailName, setEntityThumbnailName] = useState("");

  const [stepTitleInput, setStepTitleInput] = useState("");
  const [stepContentInput, setStepContentInput] = useState("");
  const [stepImageDataUrl, setStepImageDataUrl] = useState("");
  const [stepImageName, setStepImageName] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragTargetNodeId, setDragTargetNodeId] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<"cards" | "list">("cards");

  const [editNameInput, setEditNameInput] = useState("");
  const [editThumbnailDataUrl, setEditThumbnailDataUrl] = useState("");
  const [editThumbnailName, setEditThumbnailName] = useState("");
  const [editStepTitleInput, setEditStepTitleInput] = useState("");
  const [editStepContentInput, setEditStepContentInput] = useState("");
  const [editStepImageDataUrl, setEditStepImageDataUrl] = useState("");
  const [editStepImageName, setEditStepImageName] = useState("");

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
      setSuccess("Saved.");
      return true;
    } catch {
      setError("Request failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  function resetEntityFields() {
    setNameInput("");
    setEntityThumbnailDataUrl("");
    setEntityThumbnailName("");
    setStepTitleInput("");
    setStepContentInput("");
    setStepImageDataUrl("");
    setStepImageName("");
  }

  async function toDataUrl(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
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
  }

  async function validateThumbnailDataUrl(dataUrl: string): Promise<string | null> {
    const { width, height } = await getImageSizeFromDataUrl(dataUrl);

    if (width < THUMBNAIL_MIN_WIDTH || height < THUMBNAIL_MIN_HEIGHT) {
      return `Thumbnail must be at least ${THUMBNAIL_MIN_WIDTH}x${THUMBNAIL_MIN_HEIGHT}px. Uploaded image is ${width}x${height}px.`;
    }

    return getAspectError(width, height);
  }

  async function handleEntityThumbnailUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setEntityThumbnailDataUrl("");
      setEntityThumbnailName("");
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
      const imageError = await validateThumbnailDataUrl(dataUrl);
      if (imageError) {
        setError(imageError);
        return;
      }
      setEntityThumbnailDataUrl(dataUrl);
      setEntityThumbnailName(file.name);
    } catch {
      setError("Could not read image.");
    }
  }

  async function handleStepImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setStepImageDataUrl("");
      setStepImageName("");
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
      setStepImageDataUrl(dataUrl);
      setStepImageName(file.name);
    } catch {
      setError("Could not read image.");
    }
  }

  async function handleEditThumbnailUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
      const imageError = await validateThumbnailDataUrl(dataUrl);
      if (imageError) {
        setError(imageError);
        return;
      }
      setEditThumbnailDataUrl(dataUrl);
      setEditThumbnailName(file.name);
    } catch {
      setError("Could not read image.");
    }
  }

  async function handleEditStepImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
      setEditStepImageDataUrl(dataUrl);
      setEditStepImageName(file.name);
    } catch {
      setError("Could not read image.");
    }
  }

  async function handleAddEntity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedColour && !entityThumbnailDataUrl) {
      setError("Thumbnail image is required.");
      return;
    }

    if (!selectedPrinter) {
      if (await runAction({ action: "addPrinter", name: nameInput, thumbnailDataUrl: entityThumbnailDataUrl })) {
        resetEntityFields();
      }
      return;
    }

    if (!selectedPaper) {
      if (
        await runAction({
          action: "addPaper",
          printerId: selectedPrinter.id,
          name: nameInput,
          thumbnailDataUrl: entityThumbnailDataUrl,
        })
      ) {
        resetEntityFields();
      }
      return;
    }

    if (!selectedColour) {
      if (
        await runAction({
          action: "addColour",
          printerId: selectedPrinter.id,
          paperId: selectedPaper.id,
          name: nameInput,
          thumbnailDataUrl: entityThumbnailDataUrl,
        })
      ) {
        resetEntityFields();
      }
      return;
    }

    if (!stepImageDataUrl) {
      setError("Step image is required.");
      return;
    }

    if (!hasMeaningfulContent(stepContentInput)) {
      setError("Step content is required.");
      return;
    }

    if (
      await runAction({
        action: "addStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        title: stepTitleInput,
        contentHtml: stepContentInput,
        imageDataUrl: stepImageDataUrl,
      })
    ) {
      resetEntityFields();
    }
  }

  async function handleDelete(level: Level, id: string) {
    if (!window.confirm("Delete this item and all nested data?")) {
      return;
    }

    if (level === "printer") {
      await runAction({ action: "deletePrinter", printerId: id });
      if (selection.printerId === id) {
        setSelection({ printerId: null, paperId: null, colourId: null, stepId: null });
      }
      return;
    }

    if (level === "paper" && selectedPrinter) {
      await runAction({ action: "deletePaper", printerId: selectedPrinter.id, paperId: id });
      if (selection.paperId === id) {
        setSelection((current) => ({ ...current, paperId: null, colourId: null, stepId: null }));
      }
      return;
    }

    if (level === "colour" && selectedPrinter && selectedPaper) {
      await runAction({
        action: "deleteColour",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: id,
      });
      if (selection.colourId === id) {
        setSelection((current) => ({ ...current, colourId: null, stepId: null }));
      }
      return;
    }

    if (level === "step" && selectedPrinter && selectedPaper && selectedColour) {
      await runAction({
        action: "deleteStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        stepId: id,
      });
      if (selection.stepId === id) {
        setSelection((current) => ({ ...current, stepId: null }));
      }
    }
  }

  async function handleMove(level: Level, id: string, direction: Direction) {
    if (level === "printer") {
      await runAction({ action: "movePrinter", printerId: id, direction });
      return;
    }

    if (level === "paper" && selectedPrinter) {
      await runAction({ action: "movePaper", printerId: selectedPrinter.id, paperId: id, direction });
      return;
    }

    if (level === "colour" && selectedPrinter && selectedPaper) {
      await runAction({
        action: "moveColour",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: id,
        direction,
      });
      return;
    }

    if (level === "step" && selectedPrinter && selectedPaper && selectedColour) {
      await runAction({
        action: "moveStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        stepId: id,
        direction,
      });
    }
  }

  async function handleReorder(level: Level, sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    if (level === "printer") {
      await runAction({ action: "reorderPrinter", sourceId, targetId });
      return;
    }

    if (level === "paper" && selectedPrinter) {
      await runAction({
        action: "reorderPaper",
        printerId: selectedPrinter.id,
        sourceId,
        targetId,
      });
      return;
    }

    if (level === "colour" && selectedPrinter && selectedPaper) {
      await runAction({
        action: "reorderColour",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        sourceId,
        targetId,
      });
      return;
    }

    if (level === "step" && selectedPrinter && selectedPaper && selectedColour) {
      await runAction({
        action: "reorderStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        sourceId,
        targetId,
      });
    }
  }

  async function saveInlineEdit() {
    if (selectedStep && selectedPrinter && selectedPaper && selectedColour) {
      if (!hasMeaningfulContent(editStepContentInput)) {
        setError("Step content is required.");
        return;
      }

      await runAction({
        action: "updateStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        stepId: selectedStep.id,
        title: editStepTitleInput,
        contentHtml: editStepContentInput,
        imageDataUrl: editStepImageDataUrl,
      });
      return;
    }

    if (selectedColour && selectedPrinter && selectedPaper) {
      await runAction({
        action: "updateColour",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        name: editNameInput,
        thumbnailDataUrl: editThumbnailDataUrl,
      });
      return;
    }

    if (selectedPaper && selectedPrinter) {
      await runAction({
        action: "updatePaper",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        name: editNameInput,
        thumbnailDataUrl: editThumbnailDataUrl,
      });
      return;
    }

    if (selectedPrinter) {
      await runAction({
        action: "updatePrinter",
        printerId: selectedPrinter.id,
        name: editNameInput,
        thumbnailDataUrl: editThumbnailDataUrl,
      });
    }
  }

  async function handleUndoStep() {
    if (!selectedStep || !selectedPrinter || !selectedPaper || !selectedColour) {
      return;
    }

    await runAction({
      action: "undoStep",
      printerId: selectedPrinter.id,
      paperId: selectedPaper.id,
      colourId: selectedColour.id,
      stepId: selectedStep.id,
    });
  }

  const breadcrumb = [
    { label: "Printers", onClick: () => setSelection({ printerId: null, paperId: null, colourId: null, stepId: null }) },
    ...(selectedPrinter ? [{ label: selectedPrinter.name, onClick: () => setSelection({ printerId: selectedPrinter.id, paperId: null, colourId: null, stepId: null }) }] : []),
    ...(selectedPaper ? [{ label: selectedPaper.name, onClick: () => setSelection((current) => ({ ...current, paperId: selectedPaper.id, colourId: null, stepId: null })) }] : []),
    ...(selectedColour ? [{ label: selectedColour.name, onClick: () => setSelection((current) => ({ ...current, colourId: selectedColour.id, stepId: null })) }] : []),
    ...(selectedStep ? [{ label: selectedStep.name, onClick: () => setSelection((current) => ({ ...current, stepId: selectedStep.id })) }] : []),
  ];

  const formLabel = !selectedPrinter
    ? "Add Printer"
    : !selectedPaper
      ? `Add Paper in ${selectedPrinter.name}`
      : !selectedColour
        ? `Add Colour in ${selectedPaper.name}`
        : `Add Step in ${selectedColour.name}`;

  const listTitle = !selectedPrinter
    ? "Printers"
    : !selectedPaper
      ? "Papers"
      : !selectedColour
        ? "Colours"
        : "Steps";

  const currentLevel: Level = !selectedPrinter
    ? "printer"
    : !selectedPaper
      ? "paper"
      : !selectedColour
        ? "colour"
        : "step";

  const currentList = !selectedPrinter
    ? tutorialState.printers
    : !selectedPaper
      ? selectedPrinter.papers
      : !selectedColour
        ? selectedPaper.colours
        : selectedColour.steps;

  const editingLevel: Level | null = selectedStep
    ? "step"
    : selectedColour
      ? "colour"
      : selectedPaper
        ? "paper"
        : selectedPrinter
          ? "printer"
          : null;

  const editingLabel = selectedStep
    ? selectedStep.name
    : selectedColour
      ? selectedColour.name
      : selectedPaper
        ? selectedPaper.name
        : selectedPrinter
          ? selectedPrinter.name
          : "";

  useEffect(() => {
    if (selectedStep) {
      setEditStepTitleInput(selectedStep.title ?? "");
      setEditStepContentInput(selectedStep.contentHtml ?? "");
      setEditStepImageDataUrl(selectedStep.imageDataUrl ?? "");
      setEditStepImageName("");
      return;
    }

    const selectedNode = selectedColour ?? selectedPaper ?? selectedPrinter;
    if (!selectedNode) {
      setEditNameInput("");
      setEditThumbnailDataUrl("");
      setEditThumbnailName("");
      return;
    }

    setEditNameInput(selectedNode.name ?? "");
    setEditThumbnailDataUrl(selectedNode.thumbnailDataUrl ?? "");
    setEditThumbnailName("");
  }, [selectedPrinter, selectedPaper, selectedColour, selectedStep]);

  const emptyGuidance = !selectedPrinter
    ? "No printers yet. Add your first printer below."
    : !selectedPaper
      ? "No papers yet. Add first paper for this printer below."
      : !selectedColour
        ? "No colours yet. Add first colour for this paper below."
        : "No steps yet. Add Step 1 below.";

  return (
    <Box sx={{ minHeight: "100vh", py: 4 }}>
      <Container maxWidth="xl">
        <Box sx={{ display: "grid", gap: 2.5, gridTemplateColumns: { xs: "1fr", md: "280px 1fr" } }}>
          <Paper elevation={2} sx={{ p: 2, height: "fit-content", position: { md: "sticky" }, top: { md: 20 } }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Printers</Typography>
            <List sx={{ p: 0 }}>
              {tutorialState.printers.map((printer) => (
                <ListItem key={printer.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={selection.printerId === printer.id}
                    onClick={() => setSelection({ printerId: printer.id, paperId: null, colourId: null, stepId: null })}
                    sx={{
                      borderRadius: 2,
                      transition: "transform 180ms ease, background-color 180ms ease",
                      "&:hover": {
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 40 }}>
                      <Avatar src={printer.thumbnailDataUrl || undefined} alt={printer.name}>
                        {printer.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={printer.name} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Paper>

          <Stack spacing={2.5}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>Tutorial Printer Admin</Typography>
              <Typography color="text.secondary">Hierarchy: Printers &gt; Papers &gt; Colours &gt; Steps</Typography>
            </Box>

            <Breadcrumbs aria-label="breadcrumb">
              {breadcrumb.map((item, index) => (
                <Link
                  key={item.label + String(index)}
                  component="button"
                  type="button"
                  underline="hover"
                  color={index === breadcrumb.length - 1 ? "text.primary" : "primary"}
                  onClick={item.onClick}
                >
                  {item.label}
                </Link>
              ))}
            </Breadcrumbs>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}
            {loadingState ? <Alert severity="info">Loading...</Alert> : null}

            {!loadingState ? (
              <Paper elevation={2} sx={{ p: 2.5, transition: "box-shadow 220ms ease, transform 220ms ease", "&:hover": { transform: "translateY(-1px)", boxShadow: 6 } }}>
                {editingLevel ? (
                  <>
                    <Typography variant="h6" gutterBottom>
                      Edit {editingLevel}: {editingLabel}
                    </Typography>
                    <Stack spacing={2}>
                      {editingLevel !== "step" ? (
                        <>
                          <TextField
                            label="Title"
                            value={editNameInput}
                            onChange={(e) => setEditNameInput(e.target.value)}
                            fullWidth
                          />
                          <Box>
                            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Thumbnail image</Typography>
                            <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditThumbnailUpload(e); }} />
                            {editThumbnailName ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                Selected: {editThumbnailName}
                              </Typography>
                            ) : null}
                            {editThumbnailDataUrl ? (
                              <Box
                                component="img"
                                src={editThumbnailDataUrl}
                                alt="Thumbnail preview"
                                sx={{
                                  mt: 1,
                                  width: 220,
                                  maxWidth: "100%",
                                  aspectRatio: "4 / 3",
                                  objectFit: "cover",
                                  borderRadius: 1,
                                  border: "1px solid",
                                  borderColor: "divider",
                                }}
                              />
                            ) : null}
                          </Box>
                        </>
                      ) : (
                        <>
                          <TextField
                            label="Step title"
                            value={editStepTitleInput}
                            onChange={(e) => setEditStepTitleInput(e.target.value)}
                            fullWidth
                          />
                          <RichHtmlEditor
                            label="Step content"
                            value={editStepContentInput}
                            onChange={setEditStepContentInput}
                          />
                          <Box>
                            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Step image</Typography>
                            <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditStepImageUpload(e); }} />
                            {editStepImageName ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                Selected: {editStepImageName}
                              </Typography>
                            ) : null}
                          </Box>
                        </>
                      )}
                      <Stack direction="row" spacing={1.5}>
                        <Button type="button" variant="contained" onClick={() => void saveInlineEdit()} disabled={loading}>
                          {loading ? "Saving..." : "Save changes"}
                        </Button>
                        {editingLevel === "step" ? (
                          <Button type="button" variant="outlined" onClick={() => void handleUndoStep()} disabled={loading}>
                            Undo last change
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                    <Divider sx={{ my: 2.5 }} />
                  </>
                ) : null}

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="h6">{listTitle}</Typography>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                      p: 0.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 999,
                      bgcolor: "action.hover",
                    }}
                  >
                    <Button
                      size="small"
                      variant={adminViewMode === "cards" ? "contained" : "text"}
                      onClick={() => setAdminViewMode("cards")}
                    >
                      Cards
                    </Button>
                    <Button
                      size="small"
                      variant={adminViewMode === "list" ? "contained" : "text"}
                      onClick={() => setAdminViewMode("list")}
                    >
                      List
                    </Button>
                  </Stack>
                </Stack>
                {currentList.length === 0 ? (
                  <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2, mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {emptyGuidance}
                    </Typography>
                  </Box>
                ) : null}

                <List
                  sx={{
                    p: 0,
                    display: adminViewMode === "cards" ? "grid" : "block",
                    gridTemplateColumns:
                      adminViewMode === "cards"
                        ? { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }
                        : undefined,
                    gap: adminViewMode === "cards" ? 1.25 : 0,
                  }}
                >
                    {(currentList as Array<Step | Paper | Colour | Printer>).map((node, index, list) => (
                      <ListItem
                        key={node.id}
                        draggable
                        onDragStart={() => {
                          setDraggedNodeId(node.id);
                          setDragTargetNodeId(null);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggedNodeId && draggedNodeId !== node.id) {
                            setDragTargetNodeId(node.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragTargetNodeId === node.id) {
                            setDragTargetNodeId(null);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (draggedNodeId && draggedNodeId !== node.id) {
                            void handleReorder(currentLevel, draggedNodeId, node.id);
                          }
                          setDraggedNodeId(null);
                          setDragTargetNodeId(null);
                        }}
                        onDragEnd={() => {
                          setDraggedNodeId(null);
                          setDragTargetNodeId(null);
                        }}
                        sx={{
                          border: "1px solid",
                          borderColor: dragTargetNodeId === node.id ? "primary.main" : "divider",
                          borderRadius: adminViewMode === "cards" ? 2 : 1.5,
                          mb: adminViewMode === "cards" ? 0 : 0.75,
                          p: adminViewMode === "cards" ? 1.25 : 1,
                          alignItems: "stretch",
                          transition: "transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease",
                          "&:hover":
                            adminViewMode === "cards"
                              ? { transform: "translateY(-2px)", boxShadow: 3 }
                              : { bgcolor: "action.hover" },
                        }}
                      >
                      <Stack spacing={adminViewMode === "cards" ? 1.25 : 0.75} sx={{ width: "100%" }}>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar src={"thumbnailDataUrl" in node ? node.thumbnailDataUrl || undefined : undefined} alt={node.name}>{node.name.charAt(0).toUpperCase()}</Avatar>
                          <Typography sx={{ flex: 1 }}>{node.name}</Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              if (!selectedPrinter) {
                                setSelection({ printerId: node.id, paperId: null, colourId: null, stepId: null });
                                return;
                              }
                              if (!selectedPaper) {
                                setSelection((current) => ({ ...current, paperId: node.id, colourId: null, stepId: null }));
                                return;
                              }
                              if (!selectedColour) {
                                setSelection((current) => ({ ...current, colourId: node.id, stepId: null }));
                                return;
                              }
                              setSelection((current) => ({ ...current, stepId: node.id }));
                            }}
                          >
                            Open
                          </Button>
                        </Stack>

                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button size="small" variant="outlined" color="error" onClick={() => void handleDelete(currentLevel, node.id)}>Delete</Button>
                          <Button size="small" variant="outlined" disabled={index === 0} onClick={() => void handleMove(currentLevel, node.id, "up")}>↑</Button>
                          <Button size="small" variant="outlined" disabled={index === list.length - 1} onClick={() => void handleMove(currentLevel, node.id, "down")}>↓</Button>
                        </Stack>

                        {selectedColour && adminViewMode === "cards" ? (
                          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
                            <Typography variant="subtitle2" fontWeight={700}>{(node as Step).title || "Untitled"}</Typography>
                            <Box
                              sx={{ mt: 1, mb: 1 }}
                              dangerouslySetInnerHTML={{ __html: (node as Step).contentHtml || "" }}
                            />
                            {(node as Step).imageDataUrl ? (
                                <Image src={(node as Step).imageDataUrl} alt={(node as Step).title || (node as Step).name} width={220} height={140} loading="lazy" sizes="220px" style={{ borderRadius: 6, objectFit: "cover" }} />
                              ) : null}
                          </Box>
                        ) : null}
                      </Stack>
                    </ListItem>
                  ))}
                </List>

                <Divider sx={{ my: 2.5 }} />

                <Typography variant="h6" gutterBottom>{formLabel}</Typography>
                <Box component="form" onSubmit={(event) => void handleAddEntity(event)}>
                  <Stack spacing={2}>
                    {!selectedColour ? (
                      <TextField label="Name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} required fullWidth />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Step name is automatic (Step 1, Step 2, ...).
                      </Typography>
                    )}

                    {!selectedColour ? (
                      <Box>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Thumbnail image</Typography>
                        <Box component="input" type="file" accept="image/*" required onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEntityThumbnailUpload(e); }} />
                        {entityThumbnailName ? <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Selected: {entityThumbnailName}</Typography> : null}
                        {entityThumbnailDataUrl ? (
                          <Box
                            component="img"
                            src={entityThumbnailDataUrl}
                            alt="Thumbnail preview"
                            sx={{
                              mt: 1,
                              width: 220,
                              maxWidth: "100%",
                              aspectRatio: "4 / 3",
                              objectFit: "cover",
                              borderRadius: 1,
                              border: "1px solid",
                              borderColor: "divider",
                            }}
                          />
                        ) : null}
                      </Box>
                    ) : null}

                    {selectedColour ? (
                      <>
                        <TextField label="Step title" value={stepTitleInput} onChange={(e) => setStepTitleInput(e.target.value)} required fullWidth />
                        <RichHtmlEditor
                          label="Step content"
                          value={stepContentInput}
                          onChange={setStepContentInput}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Step image</Typography>
                          <Box component="input" type="file" accept="image/*" required onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleStepImageUpload(e); }} />
                          {stepImageName ? <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Selected: {stepImageName}</Typography> : null}
                        </Box>
                      </>
                    ) : null}

                    <Stack direction="row" spacing={1.5}>
                      <Button type="submit" variant="contained" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
                      <Button type="button" variant="outlined" onClick={resetEntityFields}>Reset fields</Button>
                    </Stack>
                  </Stack>
                </Box>
              </Paper>
            ) : null}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
