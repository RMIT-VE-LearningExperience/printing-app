"use client";

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
  IconButton,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Chip,
  Collapse,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Step = {
  id: string;
  name: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  order: number;
};

type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
};

type PrinterPaper = {
  paperId: string;
  colours: Colour[];
};

type Printer = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  papers: PrinterPaper[];
};

type DeletedItem = {
  id: string;
  type: "printer" | "paper" | "colour" | "step";
  name: string;
  deletedAt: Date;
  deletedBy: string;
  data: unknown;
};

type TutorialState = {
  papers: Paper[];
  printers: Printer[];
  deletedItems?: DeletedItem[];
};

type Direction = "up" | "down";

const emptyState: TutorialState = { papers: [], printers: [] };

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

export default function AdminPage() {
  const [tutorialState, setTutorialState] = useState<TutorialState>(emptyState);

  // Hierarchy-based navigation state
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showFullPaperList, setShowFullPaperList] = useState(false);
  const [showAllColoursView, setShowAllColoursView] = useState(false);
  const [showDeletedItems, setShowDeletedItems] = useState(false);

  // Modal states
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const [showEditPrinterModal, setShowEditPrinterModal] = useState(false);
  const [showAddPaperModal, setShowAddPaperModal] = useState(false);
  const [showEditPaperModal, setShowEditPaperModal] = useState(false);
  const [showPaperInfoModal, setShowPaperInfoModal] = useState(false);
  const [showAddColourModal, setShowAddColourModal] = useState(false);
  const [showEditColourModal, setShowEditColourModal] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [showEditStepModal, setShowEditStepModal] = useState(false);

  // Form inputs - Printers
  const [homePageTitle, setHomePageTitle] = useState("");
  const [homePageDescription, setHomePageDescription] = useState("");
  const [newPrinterName, setNewPrinterName] = useState("");
  const [newPrinterDescription, setNewPrinterDescription] = useState("");
  const [newPrinterThumbnail, setNewPrinterThumbnail] = useState("");
  const [newPrinterThumbnailName, setNewPrinterThumbnailName] = useState("");
  const [editPrinterId, setEditPrinterId] = useState<string | null>(null);
  const [editPrinterName, setEditPrinterName] = useState("");
  const [editPrinterDescription, setEditPrinterDescription] = useState("");
  const [editPrinterThumbnail, setEditPrinterThumbnail] = useState("");
  const [editPrinterThumbnailName, setEditPrinterThumbnailName] = useState("");

  // Form inputs - Papers
  const [newPaperName, setNewPaperName] = useState("");
  const [newPaperDescription, setNewPaperDescription] = useState("");
  const [newPaperThumbnail, setNewPaperThumbnail] = useState("");
  const [newPaperThumbnailName, setNewPaperThumbnailName] = useState("");
  const [newPaperSelectedPrinters, setNewPaperSelectedPrinters] = useState<string[]>([]);
  const [showAddPaperSearch, setShowAddPaperSearch] = useState(true);
  const [addPaperFromFullList, setAddPaperFromFullList] = useState(false);
  const [editPaperId, setEditPaperId] = useState<string | null>(null);
  const [editPaperName, setEditPaperName] = useState("");
  const [editPaperDescription, setEditPaperDescription] = useState("");
  const [editPaperThumbnail, setEditPaperThumbnail] = useState("");
  const [editPaperThumbnailName, setEditPaperThumbnailName] = useState("");
  const [editPaperSelectedPrinters, setEditPaperSelectedPrinters] = useState<string[]>([]);
  const [infoPaperId, setInfoPaperId] = useState<string | null>(null);

  // Form inputs - Colours
  const [newColourName, setNewColourName] = useState("");
  const [newColourDescription, setNewColourDescription] = useState("");
  const [newColourThumbnail, setNewColourThumbnail] = useState("");
  const [newColourThumbnailName, setNewColourThumbnailName] = useState("");
  const [editColourId, setEditColourId] = useState<string | null>(null);
  const [editColourName, setEditColourName] = useState("");
  const [editColourDescription, setEditColourDescription] = useState("");
  const [editColourThumbnail, setEditColourThumbnail] = useState("");
  const [editColourThumbnailName, setEditColourThumbnailName] = useState("");

  // Form inputs - Steps
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepContent, setNewStepContent] = useState("");
  const [newStepImage, setNewStepImage] = useState("");
  const [newStepImageName, setNewStepImageName] = useState("");
  const [editStepId, setEditStepId] = useState<string | null>(null);
  const [editStepTitle, setEditStepTitle] = useState("");
  const [editStepContent, setEditStepContent] = useState("");
  const [editStepImage, setEditStepImage] = useState("");
  const [editStepImageName, setEditStepImageName] = useState("");

  // Sidebar state
  const [expandedPrinterList, setExpandedPrinterList] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<string | null>(null);

  // Context menu states
  const [printerMenuAnchor, setPrinterMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedPrinterForMenu, setSelectedPrinterForMenu] = useState<string | null>(null);
  const [paperMenuAnchor, setPaperMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedPaperForMenu, setSelectedPaperForMenu] = useState<string | null>(null);
  const [paperMenuSource, setPaperMenuSource] = useState<"papers" | "fulllist">("papers");
  const [colourMenuAnchor, setColourMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedColourForMenu, setSelectedColourForMenu] = useState<string | null>(null);
  const [colourMenuPrinterId, setColourMenuPrinterId] = useState<string | null>(null);
  const [colourMenuPaperId, setColourMenuPaperId] = useState<string | null>(null);
  const [stepMenuAnchor, setStepMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedStepForMenu, setSelectedStepForMenu] = useState<string | null>(null);

  // Loading and feedback states
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sort states for each table
  const [printersSortByName, setPrintersSortByName] = useState(false); // false = by createdAt, true = by name
  const [papersSortByName, setPapersSortByName] = useState(false); // false = by createdAt, true = by name
  const [coloursSortByName, setColoursSortByName] = useState(false); // false = by createdAt, true = by name
  const [fullPaperListSortByName, setFullPaperListSortByName] = useState(false); // false = by createdAt, true = by name
  const [colourManagementSortByName, setColourManagementSortByName] = useState(false); // false = by createdAt, true = by name

  // Sidebar collapse state (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  // Auto-expand printer list if < 5 items
  useEffect(() => {
    if (tutorialState.printers && tutorialState.printers.length < 5) {
      setExpandedPrinterList(true);
    }
  }, [tutorialState.printers?.length]);

  // Persist sidebar collapse state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed]);

  // Load tutorial state
  useEffect(() => {
    async function loadState() {
      setLoadingState(true);
      setError(null);

      try {
        const response = await fetch("/api/tutorial", { cache: "no-store" });
        const data = (await response.json()) as { state?: TutorialState; error?: string };

        if (!response.ok || !data.state) {
          setError(data.error || "Could not load tutorial data.");
          return;
        }

        setTutorialState(data.state);
      } catch {
        setError("Could not load tutorial data.");
      } finally {
        setLoadingState(false);
      }
    }

    void loadState();
  }, []);

  // One-time cleanup for Epson P800
  useEffect(() => {
    const epsoPrinter = tutorialState.printers.find((p) => p.name === "Epson P800");
    if (epsoPrinter) {
      const hasInvalidPapers = epsoPrinter.papers.some((p) => !p.paperId || p.paperId === "undefined");
      if (hasInvalidPapers) {
        void runAction("removeInvalidPapersFromPrinter", { printerId: epsoPrinter.id });
      }
    }
  }, []); // Run only once on mount

  // Computed values
  const selectedPrinter = useMemo(
    () => tutorialState.printers.find((p) => p.id === selectedPrinterId) ?? null,
    [selectedPrinterId, tutorialState.printers]
  );

  const selectedPaper = useMemo(
    () => tutorialState.papers.find((p) => p.id === selectedPaperId) ?? null,
    [selectedPaperId, tutorialState.papers]
  );

  const selectedPrinterPaper = useMemo(
    () => selectedPrinter?.papers.find((pp) => pp.paperId === selectedPaperId) ?? null,
    [selectedPaperId, selectedPrinter]
  );

  const selectedColor = useMemo(
    () => selectedPrinterPaper?.colours.find((c) => c.id === selectedColorId) ?? null,
    [selectedColorId, selectedPrinterPaper]
  );

  const selectedStep = useMemo(
    () => selectedColor?.steps.find((s) => s.id === selectedStepId) ?? null,
    [selectedStepId, selectedColor]
  );

  // Get all papers across all printers for Full Paper List
  const allPapers = useMemo(() => {
    return tutorialState.papers;
  }, [tutorialState.papers]);

  // Get papers for a specific paper in Full Paper List
  const getPapersInPrinter = (paperId: string): Array<{ printerId: string; printerName: string }> => {
    const results: Array<{ printerId: string; printerName: string }> = [];
    tutorialState.printers.forEach((printer) => {
      if (printer.papers.some((pp) => pp.paperId === paperId)) {
        results.push({ printerId: printer.id, printerName: printer.name });
      }
    });
    return results;
  };

  // Handler functions
  const runAction = async (action: string, payload: unknown) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Request failed");
      }

      const result = (await response.json()) as { state: TutorialState };
      setTutorialState(result.state);
      setSuccess("Action completed successfully");
      return result.state;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Sorting functions
  const sortPrinters = (items: Printer[]): Printer[] => {
    const sorted = [...items];
    if (printersSortByName) {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => {
        const dateA = a.createdAt || a.lastModified || new Date(0);
        const dateB = b.createdAt || b.lastModified || new Date(0);
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    }
    return sorted;
  };

  const sortPapers = (items: Paper[], usePapersSortState: boolean = true): Paper[] => {
    const sorted = [...items];
    const sortByName = usePapersSortState ? papersSortByName : fullPaperListSortByName;
    if (sortByName) {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => {
        const dateA = a.createdAt || a.lastModified || new Date(0);
        const dateB = b.createdAt || b.lastModified || new Date(0);
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    }
    return sorted;
  };

  const sortColours = (items: Colour[]): Colour[] => {
    const sorted = [...items];
    if (coloursSortByName) {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => {
        const dateA = a.createdAt || a.lastModified || new Date(0);
        const dateB = b.createdAt || b.lastModified || new Date(0);
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    }
    return sorted;
  };

  type ColourWithContext = {
    colour: Colour;
    paper: Paper;
    printer: Printer;
  };

  const sortColoursForManagement = (items: ColourWithContext[]): ColourWithContext[] => {
    const sorted = [...items];
    if (colourManagementSortByName) {
      sorted.sort((a, b) => a.colour.name.localeCompare(b.colour.name));
    } else {
      sorted.sort((a, b) => {
        const dateA = a.colour.createdAt || a.colour.lastModified || new Date(0);
        const dateB = b.colour.createdAt || b.colour.lastModified || new Date(0);
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
    }
    return sorted;
  };

  const toDataUrl = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Thumbnail upload handlers
  const handleNewPrinterThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPrinterThumbnailName(file.name);
    setNewPrinterThumbnail(await toDataUrl(file));
  };

  const handleNewPaperThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPaperThumbnailName(file.name);
    setNewPaperThumbnail(await toDataUrl(file));
  };

  const handleEditPrinterThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPrinterThumbnailName(file.name);
    setEditPrinterThumbnail(await toDataUrl(file));
  };

  const handleEditPaperThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPaperThumbnailName(file.name);
    setEditPaperThumbnail(await toDataUrl(file));
  };

  const handleNewColourThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewColourThumbnailName(file.name);
    setNewColourThumbnail(await toDataUrl(file));
  };

  const handleEditColourThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditColourThumbnailName(file.name);
    setEditColourThumbnail(await toDataUrl(file));
  };

  const handleNewStepImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewStepImageName(file.name);
    setNewStepImage(await toDataUrl(file));
  };

  const handleEditStepImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditStepImageName(file.name);
    setEditStepImage(await toDataUrl(file));
  };

  // Printer handlers
  const handleAddPrinterFromModal = async () => {
    if (!newPrinterName.trim()) {
      setError("Printer name is required");
      return;
    }

    try {
      await runAction("addPrinter", {
        name: newPrinterName,
        thumbnailDataUrl: newPrinterThumbnail,
      });

      setNewPrinterName("");
      setNewPrinterThumbnail("");
      setNewPrinterThumbnailName("");
      setShowAddPrinterModal(false);
    } catch {
      // Error already set in runAction
    }
  };

  const handleEditPrinter = async () => {
    if (!editPrinterId) {
      setError("Invalid selection");
      return;
    }
    if (!editPrinterName.trim()) {
      setError("Printer name is required");
      return;
    }

    try {
      await runAction("updatePrinter", {
        printerId: editPrinterId,
        name: editPrinterName,
        description: editPrinterDescription,
        thumbnailDataUrl: editPrinterThumbnail,
      });

      setShowEditPrinterModal(false);
      setEditPrinterId(null);
      setEditPrinterName("");
      setEditPrinterDescription("");
      setEditPrinterThumbnail("");
      setEditPrinterThumbnailName("");
    } catch {
      // Error already set in runAction
    }
  };

  const handleDeletePrinter = async (printerId: string) => {
    if (!confirm("Are you sure you want to delete this printer?")) return;

    try {
      await runAction("deletePrinter", { printerId });

      if (selectedPrinterId === printerId) {
        setSelectedPrinterId(null);
        setSelectedPaperId(null);
        setSelectedColorId(null);
        setSelectedStepId(null);
      }
    } catch {
      // Error already set in runAction
    }
  };

  // Paper handlers
  const handleAddPaperFromModal = async () => {
    if (newPaperSelectedPrinters.length === 0) {
      setError("Select at least one printer");
      return;
    }
    if (!newPaperName.trim()) {
      setError("Paper name is required");
      return;
    }

    try {
      // Add paper once with all selected printers
      await runAction("addPaper", {
        name: newPaperName,
        description: newPaperDescription,
        thumbnailDataUrl: newPaperThumbnail,
        printerIds: newPaperSelectedPrinters,
      });

      setNewPaperName("");
      setNewPaperDescription("");
      setNewPaperThumbnail("");
      setNewPaperThumbnailName("");
      setNewPaperSelectedPrinters([]);
      setShowAddPaperModal(false);
      setAddPaperFromFullList(false);
    } catch {
      // Error already set in runAction
    }
  };

  const handleEditPaper = async () => {
    if (!editPaperId) {
      setError("Invalid selection");
      return;
    }
    if (!editPaperName.trim()) {
      setError("Paper name is required");
      return;
    }

    try {
      // Update paper metadata
      await runAction("updatePaper", {
        paperId: editPaperId,
        name: editPaperName,
        thumbnailDataUrl: editPaperThumbnail,
      });

      // Handle printer assignment changes
      const currentPrinters = tutorialState.printers
        .filter((printer) => printer.papers.some((pp) => pp.paperId === editPaperId))
        .map((printer) => printer.id);

      // Find printers to remove from
      for (const printerId of currentPrinters) {
        if (!editPaperSelectedPrinters.includes(printerId)) {
          await runAction("removePaperFromPrinter", {
            printerId,
            paperId: editPaperId,
          });
        }
      }

      // Find printers to add to
      for (const printerId of editPaperSelectedPrinters) {
        if (!currentPrinters.includes(printerId)) {
          await runAction("addPaperToPrinter", {
            printerId,
            paperId: editPaperId,
          });
        }
      }

      setShowEditPaperModal(false);
      setEditPaperId(null);
      setEditPaperName("");
      setEditPaperThumbnail("");
      setEditPaperThumbnailName("");
      setEditPaperSelectedPrinters([]);
    } catch {
      // Error already set in runAction
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!selectedPrinterId) return;

    if (!confirm("Are you sure you want to delete this paper?")) return;

    try {
      await runAction("deletePaper", {
        printerId: selectedPrinterId,
        paperId,
      });

      if (selectedPaperId === paperId) {
        setSelectedPaperId(null);
        setSelectedColorId(null);
        setSelectedStepId(null);
      }
    } catch {
      // Error already set in runAction
    }
  };

  const handleUnpublishPaper = async (paperId: string, currentStatus?: boolean) => {
    const newStatus = !currentStatus;

    try {
      await runAction("updatePaper", {
        paperId,
        published: newStatus,
      });
    } catch {
      // Error already set in runAction
    }
  };

  const handleUnpublishPrinter = async (printerId: string, currentStatus?: boolean) => {
    const newStatus = !currentStatus;

    try {
      await runAction("updatePrinter", {
        printerId,
        published: newStatus,
      });
    } catch {
      // Error already set in runAction
    }
  };

  const handleUnpublishColour = async (colourId: string, currentStatus?: boolean) => {
    if (!selectedPrinterId || !selectedPaperId) return;
    const newStatus = !currentStatus;

    try {
      await runAction("updateColour", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId,
        published: newStatus,
      });
    } catch {
      // Error already set in runAction
    }
  };

  // Colour handlers
  const handleAddColourFromModal = async () => {
    if (!selectedPrinterId || !selectedPaperId) {
      setError("No paper selected");
      return;
    }
    if (!newColourName.trim()) {
      setError("Colour name is required");
      return;
    }

    try {
      await runAction("addColour", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        name: newColourName,
        description: newColourDescription,
        thumbnailDataUrl: newColourThumbnail,
      });

      setNewColourName("");
      setNewColourDescription("");
      setNewColourThumbnail("");
      setNewColourThumbnailName("");
      setShowAddColourModal(false);
    } catch {
      // Error already set in runAction
    }
  };

  const handleEditColour = async () => {
    if (!selectedPrinterId || !selectedPaperId || !editColourId) {
      setError("Invalid selection");
      return;
    }
    if (!editColourName.trim()) {
      setError("Colour name is required");
      return;
    }

    try {
      await runAction("updateColour", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: editColourId,
        name: editColourName,
        description: editColourDescription,
        thumbnailDataUrl: editColourThumbnail,
      });

      setShowEditColourModal(false);
      setEditColourId(null);
      setEditColourName("");
      setEditColourDescription("");
      setEditColourThumbnail("");
      setEditColourThumbnailName("");
    } catch {
      // Error already set in runAction
    }
  };

  const handleDeleteColour = async (colourId: string) => {
    if (!selectedPrinterId || !selectedPaperId) return;

    if (!confirm("Are you sure you want to delete this colour?")) return;

    try {
      await runAction("deleteColour", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId,
      });

      if (selectedColorId === colourId) {
        setSelectedColorId(null);
        setSelectedStepId(null);
      }
    } catch {
      // Error already set in runAction
    }
  };

  // Step handlers
  const handleAddStepFromModal = async () => {
    if (!selectedPrinterId || !selectedPaperId || !selectedColorId) {
      setError("No colour selected");
      return;
    }
    if (!newStepTitle.trim()) {
      setError("Step title is required");
      return;
    }

    try {
      await runAction("addStep", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColorId,
        title: newStepTitle,
        contentHtml: newStepContent,
        imageDataUrl: newStepImage,
      });

      setNewStepTitle("");
      setNewStepContent("");
      setNewStepImage("");
      setNewStepImageName("");
      setShowAddStepModal(false);
    } catch {
      // Error already set in runAction
    }
  };

  const handleEditStep = async () => {
    if (!selectedPrinterId || !selectedPaperId || !selectedColorId || !editStepId) {
      setError("Invalid selection");
      return;
    }
    if (!editStepTitle.trim()) {
      setError("Step title is required");
      return;
    }

    try {
      await runAction("updateStep", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColorId,
        stepId: editStepId,
        title: editStepTitle,
        contentHtml: editStepContent,
        imageDataUrl: editStepImage,
      });

      setShowEditStepModal(false);
      setEditStepId(null);
      setEditStepTitle("");
      setEditStepContent("");
      setEditStepImage("");
      setEditStepImageName("");
    } catch {
      // Error already set in runAction
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!selectedPrinterId || !selectedPaperId || !selectedColorId) return;

    if (!confirm("Are you sure you want to delete this step?")) return;

    try {
      await runAction("deleteStep", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColorId,
        stepId,
      });

      if (selectedStepId === stepId) {
        setSelectedStepId(null);
      }
    } catch {
      // Error already set in runAction
    }
  };

  const handleReorderStep = async (stepId: string, direction: Direction) => {
    if (!selectedPrinterId || !selectedPaperId || !selectedColorId) return;

    try {
      await runAction("reorderStep", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColorId,
        stepId,
        direction,
      });
    } catch {
      // Error already set in runAction
    }
  };

  // Menu handlers - Printers
  const handlePrinterMenuOpen = (e: React.MouseEvent<HTMLElement>, printerId: string) => {
    setPrinterMenuAnchor(e.currentTarget);
    setSelectedPrinterForMenu(printerId);
  };

  const handlePrinterMenuClose = () => {
    setPrinterMenuAnchor(null);
    setSelectedPrinterForMenu(null);
  };

  const handlePrinterMenuEdit = () => {
    if (!selectedPrinterForMenu) return;

    const printer = tutorialState.printers.find((p) => p.id === selectedPrinterForMenu);
    if (printer) {
      setEditPrinterId(selectedPrinterForMenu);
      setEditPrinterName(printer.name);
      setEditPrinterDescription("");
      setEditPrinterThumbnail(printer.thumbnailDataUrl);
      setShowEditPrinterModal(true);
    }
    handlePrinterMenuClose();
  };

  const handlePrinterMenuDelete = () => {
    if (selectedPrinterForMenu) {
      void handleDeletePrinter(selectedPrinterForMenu);
    }
    handlePrinterMenuClose();
  };

  // Menu handlers - Papers
  const handlePaperMenuOpen = (e: React.MouseEvent<HTMLElement>, paperId: string, source: "papers" | "fulllist") => {
    setPaperMenuAnchor(e.currentTarget);
    setSelectedPaperForMenu(paperId);
    setPaperMenuSource(source);
  };

  const handlePaperMenuClose = () => {
    setPaperMenuAnchor(null);
    setSelectedPaperForMenu(null);
  };

  const handlePaperMenuEdit = () => {
    if (!selectedPaperForMenu) return;

    const paper = allPapers.find((p) => p.id === selectedPaperForMenu);
    if (paper) {
      // Find which printers have this paper
      const printersWithPaper = tutorialState.printers
        .filter((printer) => printer.papers.some((pp) => pp.paperId === selectedPaperForMenu))
        .map((printer) => printer.id);

      setEditPaperId(selectedPaperForMenu);
      setEditPaperName(paper.name);
      setEditPaperDescription("");
      setEditPaperThumbnail(paper.thumbnailDataUrl);
      setEditPaperSelectedPrinters(printersWithPaper);
      setShowEditPaperModal(true);
    }
    handlePaperMenuClose();
  };

  const handlePaperMenuInfo = () => {
    if (selectedPaperForMenu) {
      setInfoPaperId(selectedPaperForMenu);
      setShowPaperInfoModal(true);
    }
    handlePaperMenuClose();
  };

  const handlePaperMenuDelete = () => {
    if (!selectedPaperForMenu || !selectedPrinterId) return;
    void handleDeletePaper(selectedPaperForMenu);
    handlePaperMenuClose();
  };

  // Menu handlers - Colours
  const handleColourMenuOpen = (e: React.MouseEvent<HTMLElement>, colourId: string) => {
    setColourMenuAnchor(e.currentTarget);
    setSelectedColourForMenu(colourId);
  };

  const handleColourMenuClose = () => {
    setColourMenuAnchor(null);
    setSelectedColourForMenu(null);
    setColourMenuPrinterId(null);
    setColourMenuPaperId(null);
  };

  const handleColourMenuEdit = () => {
    if (!selectedColourForMenu) return;

    // If coming from Colour Management view
    if (colourMenuPrinterId && colourMenuPaperId) {
      const printer = tutorialState.printers.find((p) => p.id === colourMenuPrinterId);
      const printerPaper = printer?.papers.find((pp) => pp.paperId === colourMenuPaperId);
      const colour = printerPaper?.colours.find((c) => c.id === selectedColourForMenu);
      if (colour) {
        setEditColourId(selectedColourForMenu);
        setEditColourName(colour.name);
        setEditColourDescription(colour.description || "");
        setEditColourThumbnail(colour.thumbnailDataUrl);
        setShowEditColourModal(true);
      }
    } else {
      // Coming from regular Colours page
      const colour = selectedPrinterPaper?.colours.find((c) => c.id === selectedColourForMenu);
      if (colour) {
        setEditColourId(selectedColourForMenu);
        setEditColourName(colour.name);
        setEditColourDescription(colour.description || "");
        setEditColourThumbnail(colour.thumbnailDataUrl);
        setShowEditColourModal(true);
      }
    }
    handleColourMenuClose();
  };

  const handleColourMenuDelete = () => {
    if (selectedColourForMenu) {
      // If coming from Colour Management view, set context first
      if (colourMenuPrinterId && colourMenuPaperId) {
        setSelectedPrinterId(colourMenuPrinterId);
        setSelectedPaperId(colourMenuPaperId);
      }
      void handleDeleteColour(selectedColourForMenu);
    }
    handleColourMenuClose();
  };

  // Menu handlers - Steps
  const handleStepMenuOpen = (e: React.MouseEvent<HTMLElement>, stepId: string) => {
    setStepMenuAnchor(e.currentTarget);
    setSelectedStepForMenu(stepId);
  };

  const handleStepMenuClose = () => {
    setStepMenuAnchor(null);
    setSelectedStepForMenu(null);
  };

  const handleStepMenuEdit = () => {
    if (!selectedStepForMenu) return;

    const step = selectedColor?.steps.find((s) => s.id === selectedStepForMenu);
    if (step) {
      setEditStepId(selectedStepForMenu);
      setEditStepTitle(step.title);
      setEditStepContent(step.contentHtml);
      setEditStepImage(step.imageDataUrl);
      setShowEditStepModal(true);
    }
    handleStepMenuClose();
  };

  const handleStepMenuDelete = () => {
    if (selectedStepForMenu) {
      void handleDeleteStep(selectedStepForMenu);
    }
    handleStepMenuClose();
  };

  // Navigation handlers
  const goHome = () => {
    setSelectedPrinterId(null);
    setSelectedPaperId(null);
    setSelectedColorId(null);
    setSelectedStepId(null);
    setShowFullPaperList(false);
    setShowAllColoursView(false);
    setShowDeletedItems(false);
  };

  const goToPrinterPapers = (printerId: string) => {
    setSelectedPrinterId(printerId);
    setSelectedPaperId(null);
    setSelectedColorId(null);
    setSelectedStepId(null);
    setShowFullPaperList(false);
    setShowAllColoursView(false);
    setShowDeletedItems(false);
  };

  const goToFullPaperList = () => {
    setShowFullPaperList(true);
    setSelectedPaperId(null);
    setSelectedColorId(null);
    setSelectedStepId(null);
    setShowAllColoursView(false);
    setShowDeletedItems(false);
  };

  const goToPaperColours = (paperId: string) => {
    setSelectedPaperId(paperId);
    setSelectedColorId(null);
    setSelectedStepId(null);
    setShowFullPaperList(false);
    setShowAllColoursView(false);
    setShowDeletedItems(false);
  };

  const goToColourSteps = (colourId: string) => {
    setSelectedColorId(colourId);
    setSelectedStepId(null);
    setShowFullPaperList(false);
    setShowAllColoursView(false);
    setShowDeletedItems(false);
  };

  // Render
  if (loadingState) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#fafafa" }}>
      {/* LEFT SIDEBAR */}
      <Box
        sx={{
          width: sidebarCollapsed ? 80 : 300,
          bgcolor: "#f5f5f5",
          borderRight: "1px solid",
          borderColor: "divider",
          p: 2,
          overflowY: "auto",
          transition: "width 0.3s ease",
        }}
      >
        {/* Toggle Button and Title */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <IconButton
            size="small"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            sx={{ padding: 0 }}
          >
            {sidebarCollapsed ? "❯" : "❮"}
          </IconButton>
          {!sidebarCollapsed && (
            <Link
              component="button"
              variant="h6"
              onClick={(e) => {
                e.preventDefault();
                goHome();
              }}
              sx={{
                fontWeight: 700,
                cursor: "pointer",
                flex: 1,
                marginLeft: 1,
                textAlign: "left",
                textDecoration: "none",
                color: "inherit",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              Print Room Dashboard
            </Link>
          )}
        </Box>

        {/* Preview Section */}
        {sidebarCollapsed ? (
          <Stack spacing={1} sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title="Home" placement="right">
                <IconButton
                  onClick={goHome}
                  size="large"
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    bgcolor: "rgba(0, 0, 0, 0.04)",
                    "&:hover": { bgcolor: "rgba(0, 0, 0, 0.08)" },
                  }}
                >
                  🏠
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title="Preview" placement="right">
                <IconButton
                  size="large"
                  sx={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    bgcolor: "rgba(0, 0, 0, 0.04)",
                    "&:hover": { bgcolor: "rgba(0, 0, 0, 0.08)" },
                  }}
                >
                  📄
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <Button size="small" variant="outlined" fullWidth>
              PREVIEW
            </Button>
            <Button size="small" variant="outlined" fullWidth>
              PREVIEW PAGE
            </Button>
          </Stack>
        )}

        {!sidebarCollapsed && (
          <>
            {/* Homepage Customization - Only on HOME page */}
            {!showFullPaperList && !showAllColoursView && !selectedPrinterId && !showDeletedItems && (
              <Stack spacing={2} sx={{ mb: 3, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <TextField
                  label="Homepage Header"
                  size="small"
                  fullWidth
                  value={homePageTitle}
                  onChange={(e) => setHomePageTitle(e.target.value)}
                  placeholder="e.g., PRINTER GUIDE"
                />
                <TextField
                  label="Homepage Description"
                  size="small"
                  fullWidth
                  multiline
                  rows={3}
                  value={homePageDescription}
                  onChange={(e) => setHomePageDescription(e.target.value)}
                  placeholder="e.g., A step-by-step guide..."
                />
              </Stack>
            )}
          </>
        )}

        {/* Printer List */}
        {sidebarCollapsed ? (
              <Stack spacing={2} sx={{ mb: 1 }}>
                {/* Printers Section */}
                <Stack spacing={1} sx={{ mb: 1 }}>
                  {tutorialState.printers.map((printer) => (
                    <Tooltip key={printer.id} title={printer.name} placement="right">
                      <Box
                        onClick={() => goToPrinterPapers(printer.id)}
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Avatar
                          src={printer.thumbnailDataUrl || undefined}
                          alt={printer.name}
                          sx={{
                            width: 60,
                            height: 60,
                            border: selectedPrinterId === printer.id && !showFullPaperList ? "2px solid" : "1px solid transparent",
                            borderColor: "primary.main",
                            transition: "all 180ms ease",
                            "&:hover": {
                              boxShadow: 2,
                            },
                          }}
                        >
                          {printer.name.charAt(0).toUpperCase()}
                        </Avatar>
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>

                {/* Full Paper List Section */}
                <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                  <Tooltip title="Full Paper List" placement="right">
                    <IconButton
                      onClick={goToFullPaperList}
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        bgcolor: showFullPaperList ? "primary.main" : "rgba(0, 0, 0, 0.04)",
                        color: showFullPaperList ? "white" : "inherit",
                        "&:hover": { bgcolor: showFullPaperList ? "primary.dark" : "rgba(0, 0, 0, 0.08)" },
                      }}
                    >
                      📦
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Colour Management Section */}
                <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                  <Tooltip title="Colour Management" placement="right">
                    <IconButton
                      onClick={() => {
                        setShowAllColoursView(true);
                        setShowFullPaperList(false);
                        setSelectedPrinterId(null);
                        setSelectedPaperId(null);
                        setSelectedColorId(null);
                        setSelectedStepId(null);
                        setShowDeletedItems(false);
                      }}
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        bgcolor: showAllColoursView ? "primary.main" : "rgba(0, 0, 0, 0.04)",
                        color: showAllColoursView ? "white" : "inherit",
                        "&:hover": { bgcolor: showAllColoursView ? "primary.dark" : "rgba(0, 0, 0, 0.08)" },
                      }}
                    >
                      🔺
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Deleted Items Section */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Tooltip title="Deleted Items" placement="right">
                    <IconButton
                      onClick={() => {
                        setShowDeletedItems(true);
                        setShowFullPaperList(false);
                        setSelectedPrinterId(null);
                        setSelectedPaperId(null);
                        setSelectedColorId(null);
                      }}
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        bgcolor: showDeletedItems ? "primary.main" : "rgba(0, 0, 0, 0.04)",
                        color: showDeletedItems ? "white" : "inherit",
                        "&:hover": { bgcolor: showDeletedItems ? "primary.dark" : "rgba(0, 0, 0, 0.08)" },
                      }}
                    >
                      🗑️
                    </IconButton>
                  </Tooltip>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  PRINTER LIST
                </Typography>
                <Button
                  size="small"
                  onClick={() => setShowAddPrinterModal(true)}
                  sx={{ minWidth: "auto", p: 0.5 }}
                >
                  +
                </Button>
              </Stack>

              {expandedPrinterList && tutorialState.printers.length > 0 && (
                <List sx={{ p: 0, bgcolor: "white", borderRadius: 1 }}>
                  {tutorialState.printers.map((printer) => (
                    <ListItem
                      key={printer.id}
                      disablePadding
                    >
                      <ListItemButton
                        selected={selectedPrinterId === printer.id && !showFullPaperList}
                        onClick={() => goToPrinterPapers(printer.id)}
                        sx={{
                          borderRadius: 1,
                          transition: "all 180ms ease",
                          "&:hover": {
                            bgcolor: "action.hover",
                          },
                        }}
                      >
                        <ListItemAvatar sx={{ minWidth: 40 }}>
                          <Avatar
                            src={printer.thumbnailDataUrl || undefined}
                            alt={printer.name}
                            sx={{ width: 32, height: 32 }}
                          >
                            {printer.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText primary={printer.name} />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrinterMenuOpen(e, printer.id);
                          }}
                          sx={{ ml: 1 }}
                        >
                          ⋯
                        </IconButton>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}

            {!expandedPrinterList && tutorialState.printers.length > 0 && (
              <Button
                fullWidth
                size="small"
                onClick={() => setExpandedPrinterList(true)}
                sx={{ textTransform: "none" }}
              >
                Show {tutorialState.printers.length} Printers
              </Button>
            )}

            {tutorialState.printers.length === 0 && expandedPrinterList && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                No printers yet
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Full Paper List Link */}
          <Button
            fullWidth
            variant={showFullPaperList ? "contained" : "outlined"}
            onClick={goToFullPaperList}
            sx={{
              justifyContent: "flex-start",
              textTransform: "none",
            }}
          >
            Full Paper List
          </Button>

          {/* Colour Management Link */}
          <Button
            fullWidth
            variant={showAllColoursView ? "contained" : "outlined"}
            onClick={() => {
              setShowAllColoursView(true);
              setShowFullPaperList(false);
              setSelectedPrinterId(null);
              setSelectedPaperId(null);
              setSelectedColorId(null);
              setSelectedStepId(null);
              setShowDeletedItems(false);
            }}
            sx={{
              justifyContent: "flex-start",
              textTransform: "none",
            }}
          >
            Colour Management
          </Button>

          <Divider sx={{ my: 2 }} />

          {/* Deleted Items Button */}
          <Button
            fullWidth
            variant={showDeletedItems ? "contained" : "outlined"}
            onClick={() => {
              setShowDeletedItems(true);
              setShowFullPaperList(false);
              setSelectedPrinterId(null);
              setSelectedPaperId(null);
              setSelectedColorId(null);
            }}
            sx={{
              justifyContent: "flex-start",
              textTransform: "none",
              color: showDeletedItems ? "white" : "text.secondary",
            }}
          >
            Deleted Items
          </Button>
            </Stack>
            )}
      </Box>

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, p: 3, overflowY: "auto" }}>
        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Breadcrumbs Navigation */}
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link component="button" variant="body2" onClick={goHome} underline="hover">
              HOME
            </Link>
            {!showDeletedItems && selectedPrinterId && selectedPrinter && (
              <Link component="button" variant="body2" onClick={() => goToPrinterPapers(selectedPrinterId)} underline="hover">
                {selectedPrinter.name.toUpperCase()}
              </Link>
            )}
            {!showDeletedItems && selectedPaperId && selectedPaper && (
              <Link component="button" variant="body2" onClick={() => goToPaperColours(selectedPaperId)} underline="hover">
                {selectedPaper.name.toUpperCase()}
              </Link>
            )}
            {!showDeletedItems && selectedColorId && selectedColor && (
              <Link component="button" variant="body2" onClick={() => goToColourSteps(selectedColorId)} underline="hover">
                {selectedColor.name.toUpperCase()}
              </Link>
            )}
            {!showDeletedItems && selectedStepId && selectedStep && (
              <Typography color="text.primary" variant="body2">
                {selectedStep.title.toUpperCase()}
              </Typography>
            )}
          </Breadcrumbs>
        </Box>

        {!showDeletedItems && (
          <>


        {/* HOME PAGE */}
        {!selectedPrinterId && !showFullPaperList && !showAllColoursView && (
          <Box>
            <Stack spacing={4}>
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                  <Box>
                    <Typography variant="h5">PRINTERS</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Select your Printer:
                    </Typography>
                  </Box>
                  <Button variant="contained" onClick={() => setShowAddPrinterModal(true)}>
                    + Add Printer
                  </Button>
                </Box>

                <TableContainer component={Paper} elevation={1}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: "action.hover" }}>
                        <TableCell
                          sx={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}
                          onClick={() => setPrintersSortByName(!printersSortByName)}
                        >
                          Printer {printersSortByName ? "↑" : "↓"}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, width: 50 }}>⋯</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Last Edited</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortPrinters(tutorialState.printers).map((printer) => (
                        <TableRow
                          key={printer.id}
                          hover
                          onClick={() => goToPrinterPapers(printer.id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Avatar
                                src={printer.thumbnailDataUrl || undefined}
                                alt={printer.name}
                                sx={{ width: 32, height: 32 }}
                              >
                                {printer.name.charAt(0).toUpperCase()}
                              </Avatar>
                              <Typography variant="body2">{printer.name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrinterMenuOpen(e, printer.id);
                              }}
                            >
                              ⋯
                            </IconButton>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {printer.lastModified ? new Date(printer.lastModified).toLocaleDateString() : "N/A"}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleUnpublishPrinter(printer.id, printer.published);
                              }}
                            >
                              {printer.published ? "Publish" : "Unpublish"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          </Box>
        )}

        {/* PRINTER PAPERS PAGE */}
        {selectedPrinterId && selectedPrinter && !selectedPaperId && !showFullPaperList && !showAllColoursView && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h5">Papers for {selectedPrinter.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Choose your paper type:
                </Typography>
              </Box>
              <Button variant="contained" onClick={() => setShowAddPaperModal(true)}>
                + Add Paper
              </Button>
            </Box>

            <TableContainer component={Paper} elevation={1}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell
                      sx={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}
                      onClick={() => setPapersSortByName(!papersSortByName)}
                    >
                      Paper {papersSortByName ? "↑" : "↓"}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, width: 50 }}>⋯</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Edited</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortPapers(
                    selectedPrinter.papers
                      .map((printerPaper) => {
                        const paper = tutorialState.papers.find((p) => p.id === printerPaper.paperId);
                        return paper || null;
                      })
                      .filter((p): p is Paper => p !== null)
                  ).map((paper) => (
                      <TableRow
                        key={paper.id}
                        hover
                        onClick={() => goToPaperColours(paper.id)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar
                              src={paper.thumbnailDataUrl || undefined}
                              alt={paper.name}
                              sx={{ width: 32, height: 32 }}
                            >
                              {paper.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2">{paper.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePaperMenuOpen(e, paper.id, "papers");
                            }}
                          >
                            ⋯
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {paper.lastModified ? new Date(paper.lastModified).toLocaleDateString() : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleUnpublishPaper(paper.id, paper.published);
                            }}
                          >
                            {paper.published ? "Publish" : "Unpublish"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* COLOURS PAGE */}
        {selectedPrinterId && selectedPaper && !selectedColorId && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h5">Colour Management - {selectedPaper.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  I want to preserve:
                </Typography>
              </Box>
              <Button variant="contained" onClick={() => setShowAddColourModal(true)}>
                + Add Colour
              </Button>
            </Box>

            {selectedPrinterPaper?.colours.length === 0 ? (
              <Typography color="text.secondary">No colours added yet.</Typography>
            ) : (
              <TableContainer component={Paper} elevation={1}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell
                        sx={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}
                        onClick={() => setColoursSortByName(!coloursSortByName)}
                      >
                        Colour {coloursSortByName ? "↑" : "↓"}
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600, width: 50 }}>⋯</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Last Edited</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortColours(selectedPrinterPaper?.colours || []).map((colour) => (
                      <TableRow
                        key={colour.id}
                        hover
                        onClick={() => goToColourSteps(colour.id)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {colour.thumbnailDataUrl && (
                              <Box
                                component="img"
                                src={colour.thumbnailDataUrl}
                                alt={colour.name}
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 1,
                                  objectFit: "cover",
                                }}
                              />
                            )}
                            {!colour.thumbnailDataUrl && (
                              <Box
                                sx={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 1,
                                  backgroundColor: "action.hover",
                                }}
                              />
                            )}
                            <Typography variant="body2">{colour.name}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleColourMenuOpen(e, colour.id);
                            }}
                          >
                            ⋯
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {colour.lastModified ? new Date(colour.lastModified).toLocaleDateString() : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleUnpublishColour(colour.id, colour.published);
                            }}
                          >
                            {colour.published ? "Publish" : "Unpublish"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* STEPS PAGE */}
        {selectedPrinterId && selectedPaper && selectedColorId && selectedColor && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h5">Step Instructions - {selectedColor.name}</Typography>
              </Box>
              <Button variant="contained" onClick={() => setShowAddStepModal(true)}>
                + Add Step
              </Button>
            </Box>

            {selectedColor.steps.length === 0 ? (
              <Typography color="text.secondary">No steps added yet.</Typography>
            ) : (
              <Stack spacing={2}>
                {selectedColor.steps.map((step, index) => (
                  <Paper
                    key={step.id}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      transition: "all 200ms ease",
                      "&:hover": {
                        boxShadow: 1,
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                          <Typography variant="h6" fontWeight={700}>
                            Step {index + 1}: {step.title}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setExpandedSteps(expandedSteps === step.id ? null : step.id)}
                          >
                            {expandedSteps === step.id ? "Collapse" : "Expand"}
                          </Button>
                        </Box>

                        <Collapse in={expandedSteps === step.id}>
                          <Box sx={{ mt: 2, mb: 2 }}>
                            {step.contentHtml && (
                              <Box
                                sx={{
                                  p: 2,
                                  backgroundColor: "action.hover",
                                  borderRadius: 1,
                                  mb: 2,
                                  "& h3": { mt: 0, mb: 1 },
                                  "& p": { mb: 1 },
                                  "& ul": { pl: 2, mb: 1 },
                                }}
                                dangerouslySetInnerHTML={{ __html: step.contentHtml }}
                              />
                            )}

                            {step.imageDataUrl && (
                              <Box
                                component="img"
                                src={step.imageDataUrl}
                                alt="Step image"
                                sx={{
                                  width: "100%",
                                  maxWidth: 400,
                                  maxHeight: 300,
                                  objectFit: "cover",
                                  borderRadius: 1,
                                  mt: 1,
                                }}
                              />
                            )}
                          </Box>
                        </Collapse>
                      </Box>

                      <Box sx={{ display: "flex", gap: 1, ml: 2 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                          <IconButton
                            size="small"
                            disabled={index === 0}
                            onClick={() => handleReorderStep(step.id, "up")}
                            title="Move up"
                          >
                            ▲
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={index === selectedColor.steps.length - 1}
                            onClick={() => handleReorderStep(step.id, "down")}
                            title="Move down"
                          >
                            ▼
                          </IconButton>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStepMenuOpen(e, step.id);
                          }}
                          title="More options"
                        >
                          ⋯
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        )}

        {/* FULL PAPER LIST PAGE */}
        {showFullPaperList && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h5">All Papers</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  View and manage all papers across the system
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => {
                  setShowAddPaperModal(true);
                  setAddPaperFromFullList(true);
                  setShowAddPaperSearch(false);
                }}
                sx={{ textTransform: "none" }}
              >
                + Add Paper
              </Button>
            </Box>

            <TableContainer component={Paper} elevation={1}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell
                      sx={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}
                      onClick={() => setFullPaperListSortByName(!fullPaperListSortByName)}
                    >
                      Paper Type {fullPaperListSortByName ? "↑" : "↓"}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Active In</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Edited</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortPapers(allPapers, false).map((paper) => (
                    <TableRow
                      key={paper.id}
                      hover
                      sx={{
                        transition: "all 200ms ease",
                        "&:hover": {
                          bgcolor: "action.hover",
                        },
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar
                            src={paper.thumbnailDataUrl || undefined}
                            alt={paper.name}
                            sx={{ width: 32, height: 32 }}
                          >
                            {paper.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2">{paper.name}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {getPapersInPrinter(paper.id).map((loc) => (
                          <Link
                            key={loc.printerId}
                            component="button"
                            variant="body2"
                            onClick={() => goToPrinterPapers(loc.printerId)}
                            sx={{ display: "block", mb: 0.5 }}
                          >
                            {loc.printerName}
                          </Link>
                        ))}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {paper.lastModified ? new Date(paper.lastModified).toLocaleDateString() : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={paper.published ? "Published" : "Unpublished"}
                          color={paper.published ? "success" : "default"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handlePaperMenuOpen(e, paper.id, "fulllist")}
                        >
                          ⋯
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {showAllColoursView && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h5">Colour Management</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  View and manage all colours across all papers and printers
                </Typography>
              </Box>
            </Box>

            <TableContainer component={Paper} elevation={1}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell
                      sx={{ fontWeight: 600, cursor: "pointer", userSelect: "none" }}
                      onClick={() => setColourManagementSortByName(!colourManagementSortByName)}
                    >
                      Colour {colourManagementSortByName ? "↑" : "↓"}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Paper</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Printer</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Edited</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortColoursForManagement(
                    tutorialState.printers.flatMap((printer) =>
                      printer.papers.flatMap((printerPaper) => {
                        const paper = tutorialState.papers.find((p) => p.id === printerPaper.paperId);
                        if (!paper) return [];
                        return printerPaper.colours.map((colour) => ({
                          colour,
                          paper,
                          printer,
                        }));
                      })
                    )
                  ).map(({ colour, paper, printer }) => (
                        <TableRow
                          key={`${printer.id}-${paper.id}-${colour.id}`}
                          hover
                          sx={{
                            transition: "all 200ms ease",
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              {colour.thumbnailDataUrl && (
                                <Box
                                  component="img"
                                  src={colour.thumbnailDataUrl}
                                  alt={colour.name}
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 1,
                                    objectFit: "cover",
                                  }}
                                />
                              )}
                              {!colour.thumbnailDataUrl && (
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 1,
                                    backgroundColor: "action.hover",
                                  }}
                                />
                              )}
                              <Typography variant="body2">{colour.name}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Link
                              component="button"
                              variant="body2"
                              onClick={() => {
                                setSelectedPrinterId(printer.id);
                                setSelectedPaperId(paper.id);
                                setShowAllColoursView(false);
                                setShowFullPaperList(false);
                              }}
                              sx={{ display: "block" }}
                            >
                              {paper.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{printer.name}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {colour.lastModified ? new Date(colour.lastModified).toLocaleDateString() : "N/A"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
          </>
        )}

        {/* DELETED ITEMS PAGE */}
        {showDeletedItems && (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5">Deleted Items</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Restore or permanently delete removed items
              </Typography>
            </Box>

            {tutorialState.deletedItems && tutorialState.deletedItems.length > 0 ? (
              <Stack spacing={2}>
                {tutorialState.deletedItems.map((item) => (
                  <Paper key={item.id} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {item.name}
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Type: {item.type}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Deleted: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : "N/A"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            By: {item.deletedBy}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={() => {
                            void runAction("restoreDeletedItem", { deletedItemId: item.id });
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => {
                            if (confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) {
                              void runAction("permanentlyDeleteItem", { deletedItemId: item.id });
                            }
                          }}
                        >
                          Delete Permanently
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No deleted items. Everything is safe!
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      {/* Modals - Printers */}
      <Dialog
        open={showAddPrinterModal}
        onClose={() => {
          setShowAddPrinterModal(false);
          setNewPrinterName("");
          setNewPrinterDescription("");
          setNewPrinterThumbnail("");
          setNewPrinterThumbnailName("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>NEW PRINTER</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title="Upload thumbnails in portrait for the best student experience. Format: jpeg, png & gif">
                  <Typography sx={{ fontSize: 16, color: "text.secondary", cursor: "pointer", lineHeight: 1 }}>
                    ℹ️
                  </Typography>
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewPrinterThumbnailUpload(e); }} />
              {newPrinterThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {newPrinterThumbnailName}
                </Typography>
              )}
              {newPrinterThumbnail && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={newPrinterThumbnail}
                    alt="Thumbnail preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setNewPrinterThumbnail("");
                      setNewPrinterThumbnailName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>

            <TextField
              label="Printer Name"
              value={newPrinterName}
              onChange={(e) => setNewPrinterName(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Description (Optional)"
              value={newPrinterDescription}
              onChange={(e) => setNewPrinterDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="Add a description for this printer..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddPrinterModal(false);
            setNewPrinterName("");
            setNewPrinterDescription("");
            setNewPrinterThumbnail("");
            setNewPrinterThumbnailName("");
          }}>Cancel</Button>
          <Button
            onClick={() => void handleAddPrinterFromModal()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Adding..." : "ADD"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showEditPrinterModal}
        onClose={() => {
          setShowEditPrinterModal(false);
          setEditPrinterId(null);
          setEditPrinterName("");
          setEditPrinterDescription("");
          setEditPrinterThumbnail("");
          setEditPrinterThumbnailName("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>EDIT PRINTER</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title="Upload thumbnails in portrait for the best student experience. Format: jpeg, png & gif">
                  <Typography sx={{ fontSize: 16, color: "text.secondary", cursor: "pointer", lineHeight: 1 }}>
                    ℹ️
                  </Typography>
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditPrinterThumbnailUpload(e); }} />
              {editPrinterThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editPrinterThumbnailName}
                </Typography>
              )}
              {editPrinterThumbnail && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={editPrinterThumbnail}
                    alt="Thumbnail preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditPrinterThumbnail("");
                      setEditPrinterThumbnailName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>

            <TextField
              label="Printer Name"
              value={editPrinterName}
              onChange={(e) => setEditPrinterName(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Description (Optional)"
              value={editPrinterDescription}
              onChange={(e) => setEditPrinterDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              placeholder="Add a description for this printer..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditPrinterModal(false);
            setEditPrinterId(null);
            setEditPrinterName("");
            setEditPrinterDescription("");
            setEditPrinterThumbnail("");
            setEditPrinterThumbnailName("");
          }}>Cancel</Button>
          <Button
            onClick={() => void handleEditPrinter()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Saving..." : "SAVE"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modals - Papers */}
      <Dialog
        open={showAddPaperModal}
        onClose={() => {
          setShowAddPaperModal(false);
          setNewPaperName("");
          setNewPaperDescription("");
          setNewPaperThumbnail("");
          setNewPaperThumbnailName("");
          setNewPaperSelectedPrinters([]);
          setShowAddPaperSearch(true);
          setAddPaperFromFullList(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>NEW PAPER</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={0}>
            {/* Accordion-style sections */}

            {/* Search Existing Papers Section */}
            {!addPaperFromFullList && (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 2, overflow: "hidden" }}>
                <Button
                  fullWidth
                  onClick={() => setShowAddPaperSearch(!showAddPaperSearch)}
                  sx={{
                    py: 2,
                    px: 2,
                    backgroundColor: showAddPaperSearch ? "action.hover" : "transparent",
                    justifyContent: "flex-start",
                    textAlign: "left",
                    "&:hover": { backgroundColor: "action.hover" },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <Typography fontWeight={600}>SEARCH EXISTING PAPERS</Typography>
                    <Typography>{showAddPaperSearch ? "▼" : "▶"}</Typography>
                  </Box>
                </Button>
                <Collapse in={showAddPaperSearch}>
                  <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
                      Search and reuse existing papers across printers (Coming soon)
                    </Typography>
                    <TextField
                      placeholder="Search papers..."
                      size="small"
                      fullWidth
                      disabled
                      sx={{ mb: 2 }}
                    />
                  </Box>
                </Collapse>
              </Box>
            )}

            {/* Add New Paper Section */}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
              <Button
                fullWidth
                onClick={() => setShowAddPaperSearch(!showAddPaperSearch)}
                sx={{
                  py: 2,
                  px: 2,
                  backgroundColor: !showAddPaperSearch ? "action.hover" : "transparent",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <Typography fontWeight={600}>ADD NEW PAPER</Typography>
                  <Typography>{!showAddPaperSearch ? "▼" : "▶"}</Typography>
                </Box>
              </Button>
              <Collapse in={!showAddPaperSearch}>
                <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
                  <Stack spacing={2}>
                    <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                    ADD NEW PAPER
                  </Typography>

                  <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                    Thumbnail
                  </Typography>
                  <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewPaperThumbnailUpload(e); }} />
                  {newPaperThumbnailName && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Selected: {newPaperThumbnailName}
                    </Typography>
                  )}
                  {newPaperThumbnail && (
                    <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                      <Box
                        component="img"
                        src={newPaperThumbnail}
                        alt="Thumbnail preview"
                        sx={{
                          width: 220,
                          maxWidth: "100%",
                          aspectRatio: "4 / 3",
                          objectFit: "cover",
                          borderRadius: 1,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => {
                          setNewPaperThumbnail("");
                          setNewPaperThumbnailName("");
                        }}
                        sx={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          bgcolor: "rgba(255, 255, 255, 0.9)",
                          "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                        }}
                      >
                        ✕
                      </IconButton>
                    </Box>
                  )}
                </Box>

                <TextField
                  label="Paper Name"
                  value={newPaperName}
                  onChange={(e) => setNewPaperName(e.target.value)}
                  required
                  fullWidth
                />

                <TextField
                  label="Description (Optional)"
                  value={newPaperDescription}
                  onChange={(e) => setNewPaperDescription(e.target.value.slice(0, 300))}
                  multiline
                  rows={3}
                  fullWidth
                  inputProps={{ maxLength: 300 }}
                  helperText={`${newPaperDescription.length}/300 characters`}
                />

                <Box>
                  <Typography variant="body2" fontWeight={500} sx={{ mb: 2 }}>
                    Select Printers for this Paper
                  </Typography>
                  <Stack spacing={1}>
                    {tutorialState.printers.map((printer) => (
                      <FormControlLabel
                        key={printer.id}
                        control={
                          <Checkbox
                            checked={newPaperSelectedPrinters.includes(printer.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewPaperSelectedPrinters([...newPaperSelectedPrinters, printer.id]);
                              } else {
                                setNewPaperSelectedPrinters(newPaperSelectedPrinters.filter((id) => id !== printer.id));
                              }
                            }}
                          />
                        }
                        label={printer.name}
                      />
                    ))}
                  </Stack>
                  {newPaperSelectedPrinters.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                      Select at least one printer
                    </Typography>
                  )}
                    </Box>
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddPaperModal(false);
            setNewPaperName("");
            setNewPaperDescription("");
            setNewPaperThumbnail("");
            setNewPaperThumbnailName("");
            setNewPaperSelectedPrinters([]);
            setShowAddPaperSearch(true);
            setAddPaperFromFullList(false);
          }}>Cancel</Button>
          {!showAddPaperSearch && (
            <Button
              onClick={() => void handleAddPaperFromModal()}
              variant="contained"
              disabled={loading || newPaperSelectedPrinters.length === 0}
            >
              {loading ? "Adding..." : "ADD"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={showEditPaperModal}
        onClose={() => {
          setShowEditPaperModal(false);
          setEditPaperId(null);
          setEditPaperName("");
          setEditPaperDescription("");
          setEditPaperThumbnail("");
          setEditPaperThumbnailName("");
          setEditPaperSelectedPrinters([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>EDIT PAPER</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title="Upload thumbnails in portrait for the best student experience. Format: jpeg, png & gif">
                  <Typography sx={{ fontSize: 16, color: "text.secondary", cursor: "pointer", lineHeight: 1 }}>
                    ℹ️
                  </Typography>
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditPaperThumbnailUpload(e); }} />
              {editPaperThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editPaperThumbnailName}
                </Typography>
              )}
              {editPaperThumbnail && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={editPaperThumbnail}
                    alt="Thumbnail preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditPaperThumbnail("");
                      setEditPaperThumbnailName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>

            <TextField
              label="Paper Name"
              value={editPaperName}
              onChange={(e) => setEditPaperName(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Description (Optional)"
              value={editPaperDescription}
              onChange={(e) => setEditPaperDescription(e.target.value.slice(0, 300))}
              multiline
              rows={3}
              fullWidth
              inputProps={{ maxLength: 300 }}
              helperText={`${editPaperDescription.length}/300 characters`}
            />

            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 2 }}>
                Active In
              </Typography>
              <Stack spacing={1}>
                {tutorialState.printers.map((printer) => (
                  <FormControlLabel
                    key={printer.id}
                    control={
                      <Checkbox
                        checked={editPaperSelectedPrinters.includes(printer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditPaperSelectedPrinters([...editPaperSelectedPrinters, printer.id]);
                          } else {
                            setEditPaperSelectedPrinters(editPaperSelectedPrinters.filter((id) => id !== printer.id));
                          }
                        }}
                      />
                    }
                    label={printer.name}
                  />
                ))}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditPaperModal(false);
            setEditPaperId(null);
            setEditPaperName("");
            setEditPaperDescription("");
            setEditPaperThumbnail("");
            setEditPaperThumbnailName("");
            setEditPaperSelectedPrinters([]);
          }}>Cancel</Button>
          <Button
            onClick={() => void handleEditPaper()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Saving..." : "SAVE"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showPaperInfoModal} onClose={() => setShowPaperInfoModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>PAPER INFO</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {infoPaperId && (() => {
            const paper = allPapers.find((p) => p.id === infoPaperId);
            return paper ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{paper.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Modified
                  </Typography>
                  <Typography variant="body1">
                    {paper.lastModified ? new Date(paper.lastModified).toLocaleString() : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Modified By
                  </Typography>
                  <Typography variant="body1">{paper.modifiedBy || "N/A"}</Typography>
                </Box>
              </Stack>
            ) : null;
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaperInfoModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Modals - Colours */}
      <Dialog
        open={showAddColourModal}
        onClose={() => {
          setShowAddColourModal(false);
          setNewColourName("");
          setNewColourDescription("");
          setNewColourThumbnail("");
          setNewColourThumbnailName("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>NEW COLOUR</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title="Upload thumbnails in portrait for the best student experience. Format: jpeg, png & gif">
                  <Typography sx={{ fontSize: 16, color: "text.secondary", cursor: "pointer", lineHeight: 1 }}>
                    ℹ️
                  </Typography>
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewColourThumbnailUpload(e); }} />
              {newColourThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {newColourThumbnailName}
                </Typography>
              )}
              {newColourThumbnail && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={newColourThumbnail}
                    alt="Thumbnail preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setNewColourThumbnail("");
                      setNewColourThumbnailName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>

            <TextField
              label="Colour Name"
              value={newColourName}
              onChange={(e) => setNewColourName(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Description"
              value={newColourDescription}
              onChange={(e) => setNewColourDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddColourModal(false);
            setNewColourName("");
            setNewColourDescription("");
            setNewColourThumbnail("");
            setNewColourThumbnailName("");
          }}>Cancel</Button>
          <Button
            onClick={() => void handleAddColourFromModal()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Adding..." : "ADD"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showEditColourModal}
        onClose={() => {
          setShowEditColourModal(false);
          setEditColourId(null);
          setEditColourName("");
          setEditColourDescription("");
          setEditColourThumbnail("");
          setEditColourThumbnailName("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>EDIT COLOUR</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title="Upload thumbnails in portrait for the best student experience. Format: jpeg, png & gif">
                  <Typography sx={{ fontSize: 16, color: "text.secondary", cursor: "pointer", lineHeight: 1 }}>
                    ℹ️
                  </Typography>
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditColourThumbnailUpload(e); }} />
              {editColourThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editColourThumbnailName}
                </Typography>
              )}
              {editColourThumbnail && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={editColourThumbnail}
                    alt="Thumbnail preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditColourThumbnail("");
                      setEditColourThumbnailName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>

            <TextField
              label="Colour Name"
              value={editColourName}
              onChange={(e) => setEditColourName(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Description"
              value={editColourDescription}
              onChange={(e) => setEditColourDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowEditColourModal(false);
            setEditColourId(null);
            setEditColourName("");
            setEditColourDescription("");
            setEditColourThumbnail("");
            setEditColourThumbnailName("");
          }}>Cancel</Button>
          <Button
            onClick={() => void handleEditColour()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Saving..." : "SAVE"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modals - Steps */}
      <Dialog
        open={showAddStepModal}
        onClose={() => {
          setShowAddStepModal(false);
          setNewStepTitle("");
          setNewStepContent("");
          setNewStepImage("");
          setNewStepImageName("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>NEW STEP</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Step Title"
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              required
              fullWidth
            />

            <RichHtmlEditor
              label="Step Content"
              value={newStepContent}
              onChange={setNewStepContent}
            />

            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Step Image
              </Typography>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewStepImageUpload(e); }} />
              {newStepImageName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {newStepImageName}
                </Typography>
              )}
              {newStepImage && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={newStepImage}
                    alt="Step image preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      maxHeight: 300,
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setNewStepImage("");
                      setNewStepImageName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddStepModal(false)}>Cancel</Button>
          <Button
            onClick={() => void handleAddStepFromModal()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Adding..." : "ADD"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showEditStepModal}
        onClose={() => {
          setShowEditStepModal(false);
          setEditStepId(null);
          setEditStepTitle("");
          setEditStepContent("");
          setEditStepImage("");
          setEditStepImageName("");
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>EDIT STEP</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Step Title"
              value={editStepTitle}
              onChange={(e) => setEditStepTitle(e.target.value)}
              required
              fullWidth
            />

            <RichHtmlEditor
              label="Step Content"
              value={editStepContent}
              onChange={setEditStepContent}
            />

            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Step Image
              </Typography>
              <Box component="input" type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditStepImageUpload(e); }} />
              {editStepImageName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editStepImageName}
                </Typography>
              )}
              {editStepImage && (
                <Box sx={{ position: "relative", display: "inline-block", mt: 1 }}>
                  <Box
                    component="img"
                    src={editStepImage}
                    alt="Step image preview"
                    sx={{
                      width: 220,
                      maxWidth: "100%",
                      maxHeight: 300,
                      objectFit: "cover",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditStepImage("");
                      setEditStepImageName("");
                    }}
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bgcolor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" },
                    }}
                  >
                    ✕
                  </IconButton>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditStepModal(false)}>Cancel</Button>
          <Button
            onClick={() => void handleEditStep()}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Saving..." : "SAVE"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menus */}
      <Menu
        anchorEl={printerMenuAnchor}
        open={Boolean(printerMenuAnchor)}
        onClose={handlePrinterMenuClose}
      >
        <MenuItem onClick={handlePrinterMenuEdit}>Edit</MenuItem>
        <MenuItem onClick={handlePrinterMenuDelete} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={paperMenuAnchor}
        open={Boolean(paperMenuAnchor)}
        onClose={handlePaperMenuClose}
      >
        {paperMenuSource === "papers" ? (
          <>
            <MenuItem onClick={handlePaperMenuEdit}>Edit</MenuItem>
            <MenuItem onClick={handlePaperMenuDelete} sx={{ color: "error.main" }}>
              Delete
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={handlePaperMenuEdit}>Edit</MenuItem>
            <MenuItem onClick={handlePaperMenuInfo}>Info</MenuItem>
            <MenuItem onClick={() => {
              if (selectedPaperForMenu) {
                const paper = allPapers.find((p) => p.id === selectedPaperForMenu);
                if (paper) {
                  void handleUnpublishPaper(selectedPaperForMenu, paper.published);
                }
              }
              handlePaperMenuClose();
            }}>
              {selectedPaperForMenu && (() => {
                const paper = allPapers.find((p) => p.id === selectedPaperForMenu);
                return paper?.published ? "Unpublish" : "Publish";
              })()}
            </MenuItem>
            <MenuItem onClick={handlePaperMenuDelete} sx={{ color: "error.main" }}>
              Delete
            </MenuItem>
          </>
        )}
      </Menu>

      <Menu
        anchorEl={colourMenuAnchor}
        open={Boolean(colourMenuAnchor)}
        onClose={handleColourMenuClose}
      >
        <MenuItem onClick={handleColourMenuEdit}>Edit</MenuItem>
        <MenuItem onClick={handleColourMenuDelete} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={stepMenuAnchor}
        open={Boolean(stepMenuAnchor)}
        onClose={handleStepMenuClose}
      >
        <MenuItem onClick={handleStepMenuEdit}>Edit</MenuItem>
        <MenuItem onClick={handleStepMenuDelete} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
