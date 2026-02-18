"use client";

import Image from "next/image";
import {
  Alert,
  Avatar,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

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

type EditState = {
  open: boolean;
  level: Level | null;
  id: string;
  name: string;
  thumbnailDataUrl: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
};

const emptyState: TutorialState = { printers: [] };

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

  const [editState, setEditState] = useState<EditState>({
    open: false,
    level: null,
    id: "",
    name: "",
    thumbnailDataUrl: "",
    title: "",
    contentHtml: "",
    imageDataUrl: "",
  });

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

  async function handleEntityThumbnailUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setEntityThumbnailDataUrl("");
      setEntityThumbnailName("");
      return;
    }

    try {
      const dataUrl = await toDataUrl(file);
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
    if (!file) return;

    try {
      const dataUrl = await toDataUrl(file);
      setEditState((current) => ({ ...current, thumbnailDataUrl: dataUrl }));
    } catch {
      setError("Could not read image.");
    }
  }

  async function handleEditStepImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await toDataUrl(file);
      setEditState((current) => ({ ...current, imageDataUrl: dataUrl }));
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

  function openEdit(
    level: Level,
    node: {
      id: string;
      name: string;
      thumbnailDataUrl?: string;
      title?: string;
      contentHtml?: string;
      imageDataUrl?: string;
    },
  ) {
    setEditState({
      open: true,
      level,
      id: node.id,
      name: node.name,
      thumbnailDataUrl: node.thumbnailDataUrl ?? "",
      title: node.title ?? "",
      contentHtml: node.contentHtml ?? "",
      imageDataUrl: node.imageDataUrl ?? "",
    });
  }

  function closeEdit() {
    setEditState({
      open: false,
      level: null,
      id: "",
      name: "",
      thumbnailDataUrl: "",
      title: "",
      contentHtml: "",
      imageDataUrl: "",
    });
  }

  async function saveEdit() {
    if (!editState.level) {
      return;
    }

    if (editState.level === "printer") {
      await runAction({
        action: "updatePrinter",
        printerId: editState.id,
        name: editState.name,
        thumbnailDataUrl: editState.thumbnailDataUrl,
      });
      closeEdit();
      return;
    }

    if (editState.level === "paper" && selectedPrinter) {
      await runAction({
        action: "updatePaper",
        printerId: selectedPrinter.id,
        paperId: editState.id,
        name: editState.name,
        thumbnailDataUrl: editState.thumbnailDataUrl,
      });
      closeEdit();
      return;
    }

    if (editState.level === "colour" && selectedPrinter && selectedPaper) {
      await runAction({
        action: "updateColour",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: editState.id,
        name: editState.name,
        thumbnailDataUrl: editState.thumbnailDataUrl,
      });
      closeEdit();
      return;
    }

    if (editState.level === "step" && selectedPrinter && selectedPaper && selectedColour) {
      await runAction({
        action: "updateStep",
        printerId: selectedPrinter.id,
        paperId: selectedPaper.id,
        colourId: selectedColour.id,
        stepId: editState.id,
        title: editState.title,
        contentHtml: editState.contentHtml,
        imageDataUrl: editState.imageDataUrl,
      });
      closeEdit();
    }
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
                <Typography variant="h6" gutterBottom>{listTitle}</Typography>

                <List sx={{ p: 0 }}>
                    {(currentList as Array<Step | Paper | Colour | Printer>).map((node, index, list) => (
                      <ListItem key={node.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 1.25, p: 1.25, alignItems: "stretch", transition: "transform 180ms ease, box-shadow 180ms ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 3 } }}>
                      <Stack spacing={1.25} sx={{ width: "100%" }}>
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
                          <Button size="small" variant="outlined" onClick={() => openEdit(currentLevel, node)}>Edit</Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => void handleDelete(currentLevel, node.id)}>Delete</Button>
                          <Button size="small" variant="outlined" disabled={index === 0} onClick={() => void handleMove(currentLevel, node.id, "up")}>↑</Button>
                          <Button size="small" variant="outlined" disabled={index === list.length - 1} onClick={() => void handleMove(currentLevel, node.id, "down")}>↓</Button>
                        </Stack>

                        {selectedColour ? (
                          <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
                            <Typography variant="subtitle2" fontWeight={700}>{(node as Step).title || "Untitled"}</Typography>
                            <Box sx={{ mt: 1, mb: 1 }} dangerouslySetInnerHTML={{ __html: (node as Step).contentHtml || "" }} />
                            {(node as Step).imageDataUrl ? (
                              <Image src={(node as Step).imageDataUrl} alt={(node as Step).title || (node as Step).name} width={220} height={140} unoptimized style={{ borderRadius: 6, objectFit: "cover" }} />
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
                      </Box>
                    ) : null}

                    {selectedColour ? (
                      <>
                        <TextField label="Step title" value={stepTitleInput} onChange={(e) => setStepTitleInput(e.target.value)} required fullWidth />
                        <TextField
                          label="Step content (HTML allowed)"
                          value={stepContentInput}
                          onChange={(e) => setStepContentInput(e.target.value)}
                          required
                          multiline
                          minRows={5}
                          fullWidth
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

      <Dialog open={editState.open} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit {editState.level ?? "entry"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editState.level !== "step" ? (
              <TextField label="Name" value={editState.name} onChange={(e) => setEditState((c) => ({ ...c, name: e.target.value }))} fullWidth />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Step name is automatic and cannot be edited.
              </Typography>
            )}
            {editState.level !== "step" ? (
              <Box>
                <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Thumbnail image</Typography>
                <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditThumbnailUpload(e); }} />
              </Box>
            ) : null}
            {editState.level === "step" ? (
              <>
                <TextField label="Step title" value={editState.title} onChange={(e) => setEditState((c) => ({ ...c, title: e.target.value }))} fullWidth />
                <TextField
                  label="Step content (HTML allowed)"
                  value={editState.contentHtml}
                  onChange={(e) => setEditState((c) => ({ ...c, contentHtml: e.target.value }))}
                  multiline
                  minRows={5}
                  fullWidth
                />
                <Box>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Step image</Typography>
                  <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditStepImageUpload(e); }} />
                </Box>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={() => void saveEdit()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
