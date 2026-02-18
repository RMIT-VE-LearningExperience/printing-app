"use client";

import Image from "next/image";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Container,
  Link,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
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
    <Box sx={{ minHeight: "100vh", py: 5 }}>
      <Container maxWidth="lg">
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Tutorial Printer Admin
            </Typography>
            <Typography color="text.secondary">
              Create tutorials by drilling down through Printer, Paper, Colour, Step, and Item.
            </Typography>
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

          {selection.printerId !== null ? (
            <Box>
              <Button variant="outlined" onClick={goBackOneLevel}>
                Back One Level
              </Button>
            </Box>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}
          {success ? <Alert severity="success">{success}</Alert> : null}
          {loadingState ? <Alert severity="info">Loading...</Alert> : null}

          {!loadingState ? (
            <Box
              sx={{
                display: "grid",
                gap: 2.5,
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              }}
            >
              <Paper elevation={2} sx={{ p: 2.5 }}>
                <Typography variant="h6" gutterBottom>
                  {formLabel}
                </Typography>

                {selectedStep ? (
                  <Box component="form" onSubmit={(event) => void handleAddStepItem(event)}>
                    <Stack spacing={2}>
                      <TextField
                        label="Item title"
                        value={itemTitle}
                        onChange={(event) => setItemTitle(event.target.value)}
                        required
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                      />

                      <Box>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                          WYSIWYG content
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                          <Button variant="outlined" onClick={() => formatEditor("bold")}>
                            Bold
                          </Button>
                          <Button variant="outlined" onClick={() => formatEditor("italic")}>
                            Italic
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => formatEditor("insertUnorderedList")}
                          >
                            List
                          </Button>
                        </Stack>
                        <Box
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(event) =>
                            setItemContentHtml((event.currentTarget as HTMLDivElement).innerHTML)
                          }
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            p: 1.25,
                            minHeight: 140,
                            backgroundColor: "background.paper",
                          }}
                        />
                      </Box>

                      <Box>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                          Image upload
                        </Typography>
                        <Box
                          component="input"
                          type="file"
                          accept="image/*"
                          required
                          onChange={(event: ChangeEvent<HTMLInputElement>) => {
                            void handleImageUpload(event);
                          }}
                        />
                        {itemImageName ? (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                            Selected: {itemImageName}
                          </Typography>
                        ) : null}
                      </Box>

                      <Stack direction="row" spacing={1.5}>
                        <Button type="submit" variant="contained" disabled={loading}>
                          {loading ? "Saving..." : "Add Item"}
                        </Button>
                        <Button type="button" variant="outlined" onClick={resetItemFields}>
                          Reset fields
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                ) : (
                  <Box component="form" onSubmit={(event) => void handleAddEntity(event)}>
                    <Stack spacing={2}>
                      <TextField
                        label="Name"
                        value={nameInput}
                        onChange={(event) => setNameInput(event.target.value)}
                        required
                        inputProps={{ maxLength: 100 }}
                        fullWidth
                      />
                      <Box>
                        <Button type="submit" variant="contained" disabled={loading}>
                          {loading ? "Saving..." : "Save"}
                        </Button>
                      </Box>
                    </Stack>
                  </Box>
                )}
              </Paper>

              <Paper elevation={2} sx={{ p: 2.5 }}>
                <Typography variant="h6" gutterBottom>
                  {listTitle}
                </Typography>

                {currentList.length === 0 ? (
                  <Typography color="text.secondary">No entries yet.</Typography>
                ) : null}

                <List sx={{ p: 0 }}>
                  {currentList.map((entry) => {
                    if (selectedStep) {
                      const item = entry as StepItem;

                      return (
                        <ListItem
                          key={item.id}
                          sx={{
                            display: "block",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            mb: 1.25,
                            p: 1.5,
                          }}
                        >
                          <Typography fontWeight={600}>{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Created: {new Date(item.createdAt).toLocaleString()}
                          </Typography>
                          <Box
                            sx={{ mb: 1.25 }}
                            dangerouslySetInnerHTML={{ __html: item.contentHtml }}
                          />
                          <Image
                            src={item.imageDataUrl}
                            alt={item.title}
                            width={140}
                            height={140}
                            unoptimized
                            style={{ borderRadius: 8, objectFit: "cover" }}
                          />
                        </ListItem>
                      );
                    }

                    const node = entry as Printer | Paper | Colour | Step;

                    return (
                      <ListItem
                        key={node.id}
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          mb: 1.25,
                          p: 1.25,
                        }}
                      >
                        <Box
                          sx={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <Typography>{node.name}</Typography>
                          <Button
                            variant="outlined"
                            size="small"
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
                          </Button>
                        </Box>
                      </ListItem>
                    );
                  })}
                </List>
              </Paper>
            </Box>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
