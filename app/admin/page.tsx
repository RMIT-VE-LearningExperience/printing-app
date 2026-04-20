"use client";

import {
  Alert,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  InputAdornment,
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
  Select,
  Tab,
  Tabs,
  Modal,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Collapse,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import {
  Home as HomeIcon,
  Inventory as InventoryIcon,
  Palette as PaletteIcon,
  DeleteOutline as DeleteOutlineIcon,
  Visibility as VisibilityIcon,
  ArrowLeftRounded as ArrowLeftRoundedIcon,
  ArrowRightRounded as ArrowRightRoundedIcon,
  Add as AddIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Save as SaveIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  List as ListIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Refresh as RefreshIcon,
  Crop as CropIcon,
  Image as ImagePlaceholderIcon,
  Pageview as PageviewIcon,
  DragIndicator as DragIndicatorIcon,
  QrCode2 as QrCodeIcon,
  ContentCopy as ContentCopyIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  CheckCircleOutline as ApproveIcon,
  CancelOutlined as RejectIcon,
  MoreVert as MoreVertIcon,
  SettingsEthernet as SettingsEthernetIcon,
} from "@mui/icons-material";
import QRCode from "qrcode";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-provider";
import { trackEvent } from "../components/GoogleAnalytics";
import { getAuthInstance } from "../../lib/firebase-client";

type Step = {
  id: string;
  name: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  videoUrl?: string;
  order: number;
  lastModified?: Date;
  modifiedBy?: string;
};

type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  lastModified: Date;
  createdAt?: Date;
  modifiedBy?: string;
  steps: Step[];
  published?: boolean; // Per-printer publish status (when part of printer.paper.colours)
};

type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
  colours: Colour[];
  published?: boolean; // Per-printer publish status (when part of printer.papers)
};

type Printer = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  modifiedBy?: string;
  papers: Paper[];
};

type AdminUser = {
  uid: string;
  name: string;
  email: string;
  staffNumber: string;
  role: "admin" | "superadmin";
  active: boolean;
  addedAt: string;
  lastLogin: string;
};

type DeletedItem = {
  id: string;
  type: "printer" | "paper" | "colour" | "step";
  name: string;
  deletedAt: Date;
  deletedBy: string;
  data: unknown;
};

type SectionSetting = { title: string; subtitle: string };
type SectionSettings = {
  printers: SectionSetting;
  papers: SectionSetting;
  colours: SectionSetting;
};

type AppSettings = {
  copyLink: boolean;
  qrCode: boolean;
  canvasEmbed: boolean;
  printerList: boolean;
  fullPaperList: boolean;
  colourManagementList: boolean;
};

type AnalyticsData = {
  summary: {
    pageViews: number;
    activeUsers: number;
    sessions: number;
    bounceRate: number;
    avgSessionDuration: number;
  };
  topPages: { path: string; views: number }[];
  dailyViews: { date: string; views: number }[];
};

const defaultAppSettings: AppSettings = {
  copyLink: true,
  qrCode: true,
  canvasEmbed: true,
  printerList: true,
  fullPaperList: true,
  colourManagementList: true,
};

type TutorialState = {
  papers: Paper[];
  printers: Printer[];
  deletedItems?: DeletedItem[];
  homepageTitle?: string;
  homepageDescription?: string;
  sectionSettings?: SectionSettings;
  appSettings?: AppSettings;
};

const emptyState: TutorialState = { papers: [], printers: [] };

type RichHtmlEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function sanitizeStepHtml(content: string): string {
  return content
    .replace(/<(?!\/?(p|br|ul|ol|li|b|strong|i|em|h3|a)(\s+[^>]*)?>)[^>]*>/gi, "")
    .replace(/<a\s+[^>]*href=(\"|')(.*?)\1[^>]*>/gi, (_match, _quote, href: string) => {
      const safeHref = /^(https?:\/\/|mailto:)/i.test(href) ? href : "#";
      return `<a href="${safeHref}" target="_blank" rel="noreferrer">`;
    });
}

function generateSlugLocal(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getVideoEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return url;
  return null;
}

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
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: "wrap" }}>
        <IconButton
          size="small"
          onMouseDown={(e) => { e.preventDefault(); runCommand("bold"); }}
          title="Bold"
          sx={{ color: "#3D8078" }}
        >
          <FormatBoldIcon />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={(e) => { e.preventDefault(); runCommand("italic"); }}
          title="Italic"
          sx={{ color: "#3D8078" }}
        >
          <FormatItalicIcon />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={(e) => { e.preventDefault(); runCommand("underline"); }}
          title="Underline"
          sx={{ color: "#3D8078" }}
        >
          <FormatUnderlinedIcon />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={(e) => { e.preventDefault(); runCommand("insertUnorderedList"); }}
          title="Bullets"
          sx={{ color: "#3D8078" }}
        >
          <ListIcon />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={(e) => { e.preventDefault(); insertLink(); }}
          title="Insert link"
          sx={{ color: "#3D8078" }}
        >
          <LinkIcon />
        </IconButton>
        <IconButton
          size="small"
          onMouseDown={(e) => { e.preventDefault(); runCommand("unlink"); }}
          title="Remove link"
          sx={{ color: "#3D8078" }}
        >
          <LinkOffIcon />
        </IconButton>
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
  const { user, role, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // Get a fresh Firebase ID token for API calls
  const getAuthToken = useCallback(async (): Promise<string> => {
    try {
      const firebaseAuth = getAuthInstance();
      const token = await firebaseAuth.currentUser?.getIdToken();
      return token ?? "";
    } catch {
      return "";
    }
  }, []);

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
  const [showPrinterInfoModal, setShowPrinterInfoModal] = useState(false);
  const [showColourInfoModal, setShowColourInfoModal] = useState(false);
  const [showStepInfoModal, setShowStepInfoModal] = useState(false);
  const [showAddColourModal, setShowAddColourModal] = useState(false);
  const [showEditColourModal, setShowEditColourModal] = useState(false);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [showEditStepModal, setShowEditStepModal] = useState(false);

  // Superadmin modal
  const [showSuperadminModal, setShowSuperadminModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<{
    id: string;
    name: string;
    email: string;
    staffNumber: string;
    requestedAt: string;
  }[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, "admin" | "superadmin">>({});
  const [superadminTab, setSuperadminTab] = useState(0);
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [savedAppSettings, setSavedAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [appSettingsSaving, setAppSettingsSaving] = useState(false);
  const [appSettingsSaved, setAppSettingsSaved] = useState(false);
  // Admin Users state
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [adminListLoading, setAdminListLoading] = useState(false);
  const [adminListError, setAdminListError] = useState("");
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState<{ name: string; email: string; staffNumber: string; role: "admin" | "superadmin" }>({ name: "", email: "", staffNumber: "", role: "admin" });
  const [addAdminSaving, setAddAdminSaving] = useState(false);
  const [addAdminError, setAddAdminError] = useState("");
  const [managingId, setManagingId] = useState<string | null>(null);
  const [changedRoles, setChangedRoles] = useState<Record<string, "admin" | "superadmin">>({});
  const [adminManageError, setAdminManageError] = useState("");

  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");

  const loadPendingRequests = useCallback(async () => {
    setPendingLoading(true);
    setPendingError("");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setPendingError("Failed to load requests");
        return;
      }
      const data = await response.json() as { requests: typeof pendingRequests };
      setPendingRequests(data.requests);
    } catch {
      setPendingError("Failed to load requests");
    } finally {
      setPendingLoading(false);
    }
  }, [getAuthToken]);

  // Background fetch pending requests so badge appears on load
  useEffect(() => {
    if (!authLoading && user && role === "superadmin") {
      void loadPendingRequests();
    }
  }, [authLoading, user, role, loadPendingRequests]);

  const loadAdminList = useCallback(async () => {
    setAdminListLoading(true);
    setAdminListError("");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setAdminListError("Failed to load admin list");
        return;
      }
      const data = await response.json() as { admins: AdminUser[] };
      setAdminList(data.admins);
      setChangedRoles({});
    } catch {
      setAdminListError("Failed to load admin list");
    } finally {
      setAdminListLoading(false);
    }
  }, [getAuthToken]);

  // Load admin list when superadmin modal opens
  useEffect(() => {
    if (showSuperadminModal && role === "superadmin") {
      void loadAdminList();
    }
  }, [showSuperadminModal, role, loadAdminList]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/analytics", {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setAnalyticsError(d.error ?? "Failed to load analytics");
        return;
      }
      const data = await res.json() as AnalyticsData;
      setAnalyticsData(data);
    } catch (e) {
      setAnalyticsError(e instanceof Error && e.name === "AbortError" ? "Request timed out" : "Failed to load analytics");
    } finally {
      clearTimeout(timeout);
      setAnalyticsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (superadminTab === 2 && showSuperadminModal && !analyticsData && !analyticsLoading && !analyticsError) {
      void loadAnalytics();
    }
  }, [superadminTab, showSuperadminModal, analyticsData, analyticsLoading, analyticsError, loadAnalytics]);

  const handleReview = async (requestId: string, action: "approve" | "reject") => {
    setReviewingId(requestId);
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          requestId,
          action,
          reviewerUid: user?.uid,
          ...(action === "approve" && { role: pendingRoles[requestId] ?? "admin" }),
        }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setPendingError(data.error || "Action failed");
        return;
      }
      // Remove reviewed request and its role selection from state
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      setPendingRoles((prev) => { const next = { ...prev }; delete next[requestId]; return next; });
    } catch {
      setPendingError("Action failed");
    } finally {
      setReviewingId(null);
    }
  };

  const handleToggleAppSetting = (key: keyof AppSettings, value: boolean) => {
    setAppSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAppSettings = async () => {
    setAppSettingsSaving(true);
    setAppSettingsSaved(false);
    try {
      const token = await getAuthToken();
      await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "updateAppSettings", payload: { settings: appSettings } }),
      });
      setSavedAppSettings(appSettings);
      setAppSettingsSaved(true);
      setTimeout(() => setAppSettingsSaved(false), 2000);
    } catch {
      setAppSettings(savedAppSettings); // revert on error
    } finally {
      setAppSettingsSaving(false);
    }
  };

  const handleAddAdmin = async () => {
    setAddAdminSaving(true);
    setAddAdminError("");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "addDirect", ...addAdminForm }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setAddAdminError(data.error || "Failed to add admin");
        return;
      }
      setShowAddAdminForm(false);
      setAddAdminForm({ name: "", email: "", staffNumber: "", role: "admin" });
      await loadAdminList();
    } catch {
      setAddAdminError("Failed to add admin");
    } finally {
      setAddAdminSaving(false);
    }
  };

  const handleDeactivate = async (uid: string) => {
    setManagingId(uid);
    setAdminManageError("");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "deactivate", uid }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setAdminManageError(data.error || "Failed to deactivate admin");
        return;
      }
      setAdminList((prev) => prev.map((a) => a.uid === uid ? { ...a, active: false } : a));
    } catch {
      setAdminManageError("Failed to deactivate admin");
    } finally {
      setManagingId(null);
    }
  };

  const handleReactivate = async (uid: string) => {
    setManagingId(uid);
    setAdminManageError("");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "reactivate", uid }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setAdminManageError(data.error || "Failed to reactivate admin");
        return;
      }
      setAdminList((prev) => prev.map((a) => a.uid === uid ? { ...a, active: true } : a));
    } catch {
      setAdminManageError("Failed to reactivate admin");
    } finally {
      setManagingId(null);
    }
  };

  const handleChangeRole = async (uid: string) => {
    const newRole = changedRoles[uid];
    if (!newRole) return;
    setManagingId(uid);
    setAdminManageError("");
    try {
      const token = await getAuthToken();
      const response = await fetch("/api/admin-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "changeRole", uid, newRole }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setAdminManageError(data.error || "Failed to update role");
        return;
      }
      setAdminList((prev) => prev.map((a) => a.uid === uid ? { ...a, role: newRole } : a));
      setChangedRoles((prev) => { const next = { ...prev }; delete next[uid]; return next; });
    } catch {
      setAdminManageError("Failed to update role");
    } finally {
      setManagingId(null);
    }
  };

  // Form inputs - Printers
  const [homePageTitle, setHomePageTitle] = useState("");
  const [homePageDescription, setHomePageDescription] = useState("");
  const [savedHomePageTitle, setSavedHomePageTitle] = useState("");
  const [savedHomePageDescription, setSavedHomePageDescription] = useState("");
  const [homepageSaving, setHomepageSaving] = useState(false);
  const [homepageSaved, setHomepageSaved] = useState(false);
  const [sectionSettings, setSectionSettings] = useState({
    printers: { title: "Printers List", subtitle: "Select your Printer:" },
    papers:   { title: "Paper Selection", subtitle: "Choose your paper type to continue:" },
    colours:  { title: "Colour Management", subtitle: "I want to preserve:" },
  });
  const [savedSectionSettings, setSavedSectionSettings] = useState({
    printers: { title: "Printers List", subtitle: "Select your Printer:" },
    papers:   { title: "Paper Selection", subtitle: "Choose your paper type to continue:" },
    colours:  { title: "Colour Management", subtitle: "I want to preserve:" },
  });
  const [sectionSavingKey, setSectionSavingKey] = useState<"printers" | "papers" | "colours" | null>(null);
  const [sectionSavedKey, setSectionSavedKey] = useState<"printers" | "papers" | "colours" | null>(null);
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
  const [paperSearchQuery, setPaperSearchQuery] = useState("");
  const [selectedSearchPaper, setSelectedSearchPaper] = useState<Paper | null>(null);
  const [selectedSearchPaperPrinters, setSelectedSearchPaperPrinters] = useState<string[]>([]);
  const [editPaperId, setEditPaperId] = useState<string | null>(null);
  const [editPaperName, setEditPaperName] = useState("");
  const [editPaperDescription, setEditPaperDescription] = useState("");
  const [editPaperThumbnail, setEditPaperThumbnail] = useState("");
  const [editPaperThumbnailName, setEditPaperThumbnailName] = useState("");
  const [editPaperSelectedPrinters, setEditPaperSelectedPrinters] = useState<string[]>([]);
  const [infoPaperId, setInfoPaperId] = useState<string | null>(null);
  const [infoPrinterId, setInfoPrinterId] = useState<string | null>(null);
  const [infoColourId, setInfoColourId] = useState<string | null>(null);
  const [infoStepId, setInfoStepId] = useState<string | null>(null);

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
  const [newStepVideoUrl, setNewStepVideoUrl] = useState("");
  const [editStepVideoUrl, setEditStepVideoUrl] = useState("");
  const [newStepMediaType, setNewStepMediaType] = useState<"image" | "video">("image");
  const [editStepMediaType, setEditStepMediaType] = useState<"image" | "video">("image");
  const [slugUpdatedIds, setSlugUpdatedIds] = useState<Set<string>>(new Set());

  // Sidebar state
  const [, setExpandedPrinterList] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<string | null>(null);
  const [enlargedStepImageUrl, setEnlargedStepImageUrl] = useState<string | null>(null);

  // Image crop state
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string>("");
  const [cropMode, setCropMode] = useState<"printer" | "paper" | "color" | "step" | null>(null);
  const [cropImageWidth, setCropImageWidth] = useState(0);
  const [cropImageHeight, setCropImageHeight] = useState(0);
  const [cropBoxX, setCropBoxX] = useState(0);
  const [cropBoxY, setCropBoxY] = useState(0);
  const [cropBoxWidth, setCropBoxWidth] = useState(0);
  const [cropBoxHeight, setCropBoxHeight] = useState(0);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [resizingCorner, setResizingCorner] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [cropIsEdit, setCropIsEdit] = useState(false);
  const [cropImgReady, setCropImgReady] = useState(false);
  const [originalCropImage, setOriginalCropImage] = useState<string>("");
  const [originalCropContext, setOriginalCropContext] = useState<{ mode: string; isEdit: boolean; originalImageUrl: string; currentImageUrl: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);

  // Embed dialog state
  const [embedPrinter, setEmbedPrinter] = useState<Printer | null>(null);
  const [embedWidth, setEmbedWidth] = useState("100%");
  const [embedHeight, setEmbedHeight] = useState("600");
  const [embedCopied, setEmbedCopied] = useState(false);

  // Copy link dialog state
  const [copyLinkPrinter, setCopyLinkPrinter] = useState<Printer | null>(null);
  const [copyLinkCopied, setCopyLinkCopied] = useState(false);

  // QR preview dialog state
  const [qrPrinter, setQrPrinter] = useState<Printer | null>(null);
  const [qrCanvasDataUrl, setQrCanvasDataUrl] = useState<string | null>(null);

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
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageCompressed, setImageCompressed] = useState(false);

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
  }, [tutorialState.printers]);

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
        const token = await getAuthToken();
        const response = await fetch("/api/tutorial", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as { state?: TutorialState; error?: string };

        if (!response.ok || !data.state) {
          setError(data.error || "Could not load tutorial data.");
          return;
        }

        setTutorialState(data.state);
        // Set homepage settings from tutorial state
        if (data.state.homepageTitle) {
          setHomePageTitle(data.state.homepageTitle);
          setSavedHomePageTitle(data.state.homepageTitle);
        }
        if (data.state.homepageDescription) {
          setHomePageDescription(data.state.homepageDescription);
          setSavedHomePageDescription(data.state.homepageDescription);
        }
        if (data.state.sectionSettings) {
          const ss = data.state.sectionSettings;
          const loaded = {
            printers: {
              title:    ss.printers.title    || "Printers List",
              subtitle: ss.printers.subtitle || "Select your Printer:",
            },
            papers: {
              title:    ss.papers.title    || "Paper Selection",
              subtitle: ss.papers.subtitle || "Choose your paper type to continue:",
            },
            colours: {
              title:    ss.colours.title    || "Colour Management",
              subtitle: ss.colours.subtitle || "I want to preserve:",
            },
          };
          setSectionSettings(loaded);
          setSavedSectionSettings(loaded);
        }
        if (data.state.appSettings) {
          const loaded = { ...defaultAppSettings, ...data.state.appSettings };
          setAppSettings(loaded);
          setSavedAppSettings(loaded);
        }
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
      const hasInvalidPapers = epsoPrinter.papers.some((p) => !p.id || p.id === "undefined");
      if (hasInvalidPapers) {
        void runAction("removeInvalidPapersFromPrinter", { printerId: epsoPrinter.id });
      }
    }
  }, [tutorialState.printers]);

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
    () => selectedPrinter?.papers.find((pp) => pp.id === selectedPaperId) ?? null,
    [selectedPaperId, selectedPrinter]
  );

  const selectedColor = useMemo(
    () => {
      if (!selectedPrinterPaper || !selectedColorId) return null;
      // selectedPrinterPaper.colours is now an array of full Colour objects, not references
      const colour = selectedPrinterPaper.colours.find((c) => c.id === selectedColorId);
      return colour ?? null;
    },
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
      if (printer.papers.some((pp) => pp.id === paperId)) {
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
      const token = await getAuthToken();
      const response = await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, payload }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error || "Request failed");
      }

      const result = (await response.json()) as { state: TutorialState };
      setTutorialState(result.state);
      setSuccess("Action completed successfully");
      setTimeout(() => setSuccess(null), 3000);
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

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
  const MAX_IMAGE_SIZE_BYTES = 700 * 1024; // 700 KB

  const validateImageFile = (file: File): string | null => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return "Invalid format. Please upload a JPEG, PNG, or GIF image.";
    }
    if (file.type === "image/gif" && file.size > MAX_IMAGE_SIZE_BYTES) {
      return `GIF too large (${(file.size / 1024).toFixed(0)} KB). GIF maximum size is 700 KB.`;
    }
    return null;
  };

  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        // Try reducing quality first at original dimensions
        for (let quality = 0.85; quality >= 0.1; quality = Math.round((quality - 0.1) * 10) / 10) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
          const result = canvas.toDataURL("image/jpeg", quality);
          if (result.length <= MAX_IMAGE_SIZE_BYTES) { resolve(result); return; }
        }
        // Still too large — scale down dimensions
        for (let scale = 0.75; scale >= 0.25; scale -= 0.25) {
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const result = canvas.toDataURL("image/jpeg", 0.7);
          if (result.length <= MAX_IMAGE_SIZE_BYTES) { resolve(result); return; }
        }
        // Last resort
        canvas.width = Math.round(img.naturalWidth * 0.25);
        canvas.height = Math.round(img.naturalHeight * 0.25);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      };
      img.src = dataUrl;
    });
  };

  const processUpload = async (file: File): Promise<{ dataUrl: string; compressed: boolean } | null> => {
    const err = validateImageFile(file);
    if (err) { setImageUploadError(err); return null; }
    setImageUploadError(null);
    const raw = await toDataUrl(file);
    if (file.type !== "image/gif" && file.size > MAX_IMAGE_SIZE_BYTES) {
      return { dataUrl: await compressImage(raw), compressed: true };
    }
    return { dataUrl: raw, compressed: false };
  };

  // Thumbnail upload handlers
  const handleNewPrinterThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setNewPrinterThumbnailName(file.name);
    setNewPrinterThumbnail(result.dataUrl);
  };

  const handleNewPaperThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setNewPaperThumbnailName(file.name);
    setNewPaperThumbnail(result.dataUrl);
  };

  const handleEditPrinterThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setEditPrinterThumbnailName(file.name);
    setEditPrinterThumbnail(result.dataUrl);
  };

  const handleEditPaperThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setEditPaperThumbnailName(file.name);
    setEditPaperThumbnail(result.dataUrl);
  };

  const handleNewColourThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setNewColourThumbnailName(file.name);
    setNewColourThumbnail(result.dataUrl);
  };

  const handleEditColourThumbnailUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setEditColourThumbnailName(file.name);
    setEditColourThumbnail(result.dataUrl);
  };

  const handleNewStepImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setNewStepImageName(file.name);
    setNewStepImage(result.dataUrl);
  };

  const handleEditStepImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await processUpload(file);
    if (!result) { e.target.value = ""; return; }
    setImageCompressed(result.compressed);
    setEditStepImageName(file.name);
    setEditStepImage(result.dataUrl);
  };

  // Homepage settings handler
  const handleSaveHomepageSettings = async () => {
    if (!homePageTitle.trim()) {
      setError("Homepage header is required");
      return;
    }
    if (!homePageDescription.trim()) {
      setError("Homepage description is required");
      return;
    }

    setHomepageSaving(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "updateHomepageSettings", payload: { title: homePageTitle, description: homePageDescription } }),
      });
      if (!res.ok) throw new Error("Failed to save homepage settings");
      setSavedHomePageTitle(homePageTitle);
      setSavedHomePageDescription(homePageDescription);
      setError(null);
      setHomepageSaved(true);
      setTimeout(() => { setHomepageSaved(false); }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save homepage settings");
    } finally {
      setHomepageSaving(false);
    }
  };

  const handleCancelHomepageSettings = () => {
    setHomePageTitle(savedHomePageTitle);
    setHomePageDescription(savedHomePageDescription);
  };

  // Section settings handlers
  const handleSaveSectionSettings = async (section: "printers" | "papers" | "colours") => {
    setSectionSavingKey(section);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "updateSectionSettings",
          payload: {
            section,
            title: sectionSettings[section].title,
            subtitle: sectionSettings[section].subtitle,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save section settings");
      setSavedSectionSettings((prev) => ({
        ...prev,
        [section]: { ...sectionSettings[section] },
      }));
      setError(null);
      setSectionSavedKey(section);
      setTimeout(() => setSectionSavedKey(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save section settings");
    } finally {
      setSectionSavingKey(null);
    }
  };

  const handleCancelSectionSettings = (section: "printers" | "papers" | "colours") => {
    setSectionSettings((prev) => ({
      ...prev,
      [section]: { ...savedSectionSettings[section] },
    }));
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

      trackEvent("cms_printer_created", { printer_name: newPrinterName });
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
      const printerBeforeEdit = tutorialState.printers.find((p) => p.id === editPrinterId);
      const oldSlug = printerBeforeEdit?.slug ?? "";
      const newSlug = generateSlugLocal(editPrinterName);

      console.log("[handleEditPrinter] Saving printer. thumbnailDataUrl length:", editPrinterThumbnail.length, "| isEmpty:", editPrinterThumbnail === "");
      await runAction("updatePrinter", {
        printerId: editPrinterId,
        name: editPrinterName,
        description: editPrinterDescription,
        thumbnailDataUrl: editPrinterThumbnail,
      });

      trackEvent("cms_printer_updated", { printer_name: editPrinterName });
      if (oldSlug && newSlug !== oldSlug) {
        setSlugUpdatedIds((prev) => new Set([...prev, editPrinterId]));
      }

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

      trackEvent("cms_paper_created", { paper_name: newPaperName });
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

  const handleAddExistingPaperToModal = async () => {
    if (!selectedSearchPaper) {
      setError("No paper selected");
      return;
    }
    if (selectedSearchPaperPrinters.length === 0) {
      setError("Select at least one printer");
      return;
    }

    try {
      // Add existing paper to selected printers
      for (const printerId of selectedSearchPaperPrinters) {
        await runAction("addPaperToPrinter", {
          printerId,
          paperId: selectedSearchPaper.id,
        });
      }

      setSelectedSearchPaper(null);
      setSelectedSearchPaperPrinters([]);
      setPaperSearchQuery("");
      setShowAddPaperModal(false);
      setAddPaperFromFullList(false);
      setNewPaperSelectedPrinters([]);
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
      console.log("[handleEditPaper] Saving paper. thumbnailDataUrl length:", editPaperThumbnail.length, "| isEmpty:", editPaperThumbnail === "");
      await runAction("updatePaper", {
        paperId: editPaperId,
        name: editPaperName,
        thumbnailDataUrl: editPaperThumbnail,
      });

      // Handle printer assignment changes
      const currentPrinters = tutorialState.printers
        .filter((printer) => printer.papers.some((pp) => pp.id === editPaperId))
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

      trackEvent("cms_paper_updated", { paper_name: editPaperName });
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
      await runAction("removePaperFromPrinter", {
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
    if (!selectedPrinterId) return;
    const newStatus = !currentStatus;

    try {
      await runAction("updatePaperInPrinter", {
        printerId: selectedPrinterId,
        paperId,
        published: newStatus,
      });

      trackEvent("cms_paper_publish_toggled", { published: newStatus ? 1 : 0 });
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

      trackEvent("cms_printer_publish_toggled", { published: newStatus ? 1 : 0 });
    } catch {
      // Error already set in runAction
    }
  };

  const handleUnpublishColour = async (colourId: string, currentStatus?: boolean) => {
    if (!selectedPrinterId || !selectedPaperId) return;
    const newStatus = !currentStatus;

    try {
      await runAction("updateColourInPrinterPaper", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId,
        published: newStatus,
      });

      trackEvent("cms_colour_publish_toggled", { published: newStatus ? 1 : 0 });
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

      trackEvent("cms_colour_created", { colour_name: newColourName });
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
      console.log("[handleEditColour] Saving colour. thumbnailDataUrl length:", editColourThumbnail.length, "| isEmpty:", editColourThumbnail === "");
      await runAction("updateColour", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: editColourId,
        name: editColourName,
        description: editColourDescription,
        thumbnailDataUrl: editColourThumbnail,
      });

      trackEvent("cms_colour_updated", { colour_name: editColourName });
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
        imageDataUrl: newStepMediaType === "image" ? newStepImage : "",
        videoUrl: newStepMediaType === "video" ? newStepVideoUrl : "",
      });

      trackEvent("cms_step_created", { step_title: newStepTitle });
      setNewStepTitle("");
      setNewStepContent("");
      setNewStepImage("");
      setNewStepImageName("");
      setNewStepVideoUrl("");
      setNewStepMediaType("image");
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
        imageDataUrl: editStepMediaType === "image" ? editStepImage : "",
        videoUrl: editStepMediaType === "video" ? editStepVideoUrl : "",
      });

      trackEvent("cms_step_updated", { step_title: editStepTitle });
      setShowEditStepModal(false);
      setEditStepId(null);
      setEditStepTitle("");
      setEditStepContent("");
      setEditStepImage("");
      setEditStepImageName("");
      setEditStepVideoUrl("");
      setEditStepMediaType("image");
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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    if (!selectedPrinterId || !selectedPaperId || !selectedColorId) return;

    try {
      await runAction("setStepOrder", {
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColorId,
        stepId: result.draggableId,
        newIndex: result.destination.index,
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

  const copyPrinterLink = (printer: Printer) => {
    setCopyLinkPrinter(printer);
    setCopyLinkCopied(false);
  };

  const openQrDialog = async (printer: Printer) => {
    const url = `${window.location.origin}/?printer=${printer.slug}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#000000", light: "#ffffff" } });

    const padding = 20;
    const qrSize = 300;
    const textHeight = 40;
    const canvas = document.createElement("canvas");
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2 + textHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, qrSize, qrSize);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 16px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(printer.name, canvas.width / 2, qrSize + padding + textHeight / 2 + 6);

      setQrCanvasDataUrl(canvas.toDataURL("image/png"));
      setQrPrinter(printer);
    };
    img.src = qrDataUrl;
  };

  const downloadQR = () => {
    if (!qrPrinter || !qrCanvasDataUrl) return;
    const link = document.createElement("a");
    link.download = `${qrPrinter.slug}-qr.png`;
    link.href = qrCanvasDataUrl;
    link.click();

    setSlugUpdatedIds((prev) => {
      const next = new Set(prev);
      next.delete(qrPrinter.id);
      return next;
    });
  };

  const handlePrinterMenuEdit = () => {
    if (!selectedPrinterForMenu) return;

    const printer = tutorialState.printers.find((p) => p.id === selectedPrinterForMenu);
    if (printer) {
      setEditPrinterId(selectedPrinterForMenu);
      setEditPrinterName(printer.name);
      setEditPrinterDescription("");
      setEditPrinterThumbnail(printer.thumbnailDataUrl);
      setImageUploadError(null);
      setImageCompressed(false);
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

  const handlePrinterMenuInfo = () => {
    if (selectedPrinterForMenu) {
      setInfoPrinterId(selectedPrinterForMenu);
      setShowPrinterInfoModal(true);
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
        .filter((printer) => printer.papers.some((pp) => pp.id === selectedPaperForMenu))
        .map((printer) => printer.id);

      setEditPaperId(selectedPaperForMenu);
      setEditPaperName(paper.name);
      setEditPaperDescription("");
      setEditPaperThumbnail(paper.thumbnailDataUrl);
      setEditPaperSelectedPrinters(printersWithPaper);
      setImageUploadError(null);
      setImageCompressed(false);
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

    // Look up the actual Colour object from tutorialState
    const paper = tutorialState.papers.find((p) => selectedPaperId ? p.id === selectedPaperId : false) ||
                  tutorialState.papers.find((p) =>
                    colourMenuPaperId ? p.id === colourMenuPaperId : false
                  );
    const colour = paper?.colours.find((c) => c.id === selectedColourForMenu);

    if (colour) {
      setEditColourId(selectedColourForMenu);
      setEditColourName(colour.name);
      setEditColourDescription(colour.description || "");
      setEditColourThumbnail(colour.thumbnailDataUrl);
      setImageUploadError(null);
      setImageCompressed(false);
      setShowEditColourModal(true);
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

  const handleColourMenuInfo = () => {
    if (selectedColourForMenu) {
      setInfoColourId(selectedColourForMenu);
      setShowColourInfoModal(true);
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
      setEditStepVideoUrl(step.videoUrl || "");
      setEditStepMediaType(step.videoUrl ? "video" : "image");
      setImageUploadError(null);
      setImageCompressed(false);
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

  const handleStepMenuInfo = () => {
    if (selectedStepForMenu) {
      setInfoStepId(selectedStepForMenu);
      setShowStepInfoModal(true);
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

  // Alternate preview handler
  const generateAltPreview = async () => {
    try {
      const res = await fetch("/api/preview-token", { method: "POST" });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) {
        setError("Failed to generate preview link.");
        return;
      }
      const params = new URLSearchParams();
      params.set("previewToken", json.token);
      if (selectedPrinterId) params.set("printerId", selectedPrinterId);
      if (selectedPaperId) params.set("paperId", selectedPaperId);
      if (selectedColorId) params.set("colourId", selectedColorId);
      window.open(`/?${params.toString()}`, "_blank");
    } catch {
      setError("Failed to generate preview link.");
    }
  };

  // Image crop handlers
  const openCropModal = (imageDataUrl: string, mode: "printer" | "paper" | "color" | "step", isEdit: boolean = false) => {
    setCropImgReady(false);
    setCropImage(imageDataUrl);

    // Check if editing a different item
    // isDifferentItem is true if: mode/isEdit changed OR imageUrl is neither original nor current
    const isDifferentItem = originalCropContext && (
      originalCropContext.mode !== mode ||
      originalCropContext.isEdit !== isEdit ||
      (imageDataUrl !== originalCropContext.originalImageUrl && imageDataUrl !== originalCropContext.currentImageUrl)
    );

    // Store original only if: first time ever, or switching to a different item
    if (!originalCropImage || isDifferentItem) {
      console.log("openCropModal: Storing new originalCropImage");
      console.log("openCropModal: isDifferentItem =", isDifferentItem);
      console.log("openCropModal: imageDataUrl length:", imageDataUrl.length);
      console.log("openCropModal: imageDataUrl starts with:", imageDataUrl.substring(0, 100));
      setOriginalCropImage(imageDataUrl);
      setOriginalCropContext({ mode, isEdit, originalImageUrl: imageDataUrl, currentImageUrl: imageDataUrl });
    } else {
      // Same item reopening - update currentImageUrl but preserve originalCropImage and originalImageUrl
      console.log("openCropModal: Same item reopening, preserving originalCropImage");
      console.log("openCropModal: Current imageDataUrl length:", imageDataUrl.length);
      setOriginalCropContext((prev) => prev ? { ...prev, currentImageUrl: imageDataUrl } : null);
    }

    setCropMode(mode);
    setCropIsEdit(isEdit);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setCropImageWidth(img.width);
      setCropImageHeight(img.height);

      // Initialize crop box to full image size
      setCropBoxX(0);
      setCropBoxY(0);
      setCropBoxWidth(img.width);
      setCropBoxHeight(img.height);
    };
    img.onerror = () => {
      console.error("Failed to load image in openCropModal. Image may not be accessible.");
    };
    img.src = imageDataUrl;

    setCropModalOpen(true);
  };

  const resetCropBox = () => {
    // Restore original image to undo any crops
    if (!originalCropImage) {
      console.error("resetCropBox: originalCropImage is empty!");
      return;
    }

    console.log("resetCropBox: Setting cropImage to originalCropImage");
    console.log("resetCropBox: originalCropImage length:", originalCropImage.length);
    console.log("resetCropBox: originalCropImage starts with:", originalCropImage.substring(0, 100));

    setCropImgReady(false);
    setCropImage(originalCropImage);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      console.log("resetCropBox: Image loaded successfully");
      console.log("resetCropBox: Image dimensions:", img.width, "x", img.height);
      setCropImageWidth(img.width);
      setCropImageHeight(img.height);

      // Initialize crop box to full image size
      setCropBoxX(0);
      setCropBoxY(0);
      setCropBoxWidth(img.width);
      setCropBoxHeight(img.height);
    };
    img.onerror = () => {
      console.error("Failed to load original image in resetCropBox.");
    };
    img.src = originalCropImage;
  };

  const handleCropMouseDown = (e: React.MouseEvent, corner?: string) => {
    e.stopPropagation();
    if (corner) {
      setResizingCorner(corner);
    } else {
      setIsDraggingCrop(true);
    }
    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop && !resizingCorner) return;
    if (!cropContainerRef.current) return;

    // Get the image element
    const imgElements = cropContainerRef.current.querySelectorAll('img');
    if (imgElements.length === 0) return;
    const imgElement = imgElements[0] as HTMLImageElement;

    // Get bounding rects
    const imgRect = imgElement.getBoundingClientRect();

    // Calculate actual displayed image dimensions
    const displayedImageWidth = imgRect.width;
    const displayedImageHeight = imgRect.height;

    if (displayedImageWidth === 0 || displayedImageHeight === 0) return;

    // Calculate scale from displayed pixels to original image pixels
    const scaleX = cropImageWidth / displayedImageWidth;
    const scaleY = cropImageHeight / displayedImageHeight;

    // Convert viewport mouse delta to image coordinates
    const deltaX = (e.clientX - dragStartX) * scaleX;
    const deltaY = (e.clientY - dragStartY) * scaleY;

    if (isDraggingCrop) {
      let newX = cropBoxX + deltaX;
      let newY = cropBoxY + deltaY;

      // Allow movement within image bounds - crop box must stay within image
      newX = Math.max(0, Math.min(newX, Math.max(0, cropImageWidth - cropBoxWidth)));
      newY = Math.max(0, Math.min(newY, Math.max(0, cropImageHeight - cropBoxHeight)));

      setCropBoxX(newX);
      setCropBoxY(newY);
    } else if (resizingCorner) {
      const newWidth = cropBoxWidth + deltaX;
      const newHeight = cropBoxHeight + deltaY;

      // Allow free-form resizing with boundaries
      const maxAllowedWidth = cropImageWidth - cropBoxX;
      const maxAllowedHeight = cropImageHeight - cropBoxY;

      if (newWidth > 50 && newWidth <= maxAllowedWidth) {
        setCropBoxWidth(newWidth);
      }
      if (newHeight > 50 && newHeight <= maxAllowedHeight) {
        setCropBoxHeight(newHeight);
      }
    }

    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(false);
    setResizingCorner(null);
  };

  const applyCrop = () => {
    if (!cropImage || !canvasRef.current || !cropCanvasRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = cropImageWidth;
      canvas.height = cropImageHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      // Use the user-selected crop box
      const cropCanvas = cropCanvasRef.current!;
      const outputWidth = 400; // Output width
      const outputHeight = Math.round(outputWidth * (cropBoxHeight / cropBoxWidth)); // Preserve crop aspect ratio
      cropCanvas.width = outputWidth;
      cropCanvas.height = outputHeight;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      cropCtx.drawImage(
        img,
        cropBoxX,
        cropBoxY,
        cropBoxWidth,
        cropBoxHeight,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const croppedImageUrl = cropCanvas.toDataURL("image/jpeg", 0.9);

      // Update context so reopening the same item recognises the cropped URL as the current image
      setOriginalCropContext(prev => prev ? { ...prev, currentImageUrl: croppedImageUrl } : null);

      // Apply cropped image to the appropriate form field
      if (cropMode === "printer") {
        if (cropIsEdit) {
          setEditPrinterThumbnail(croppedImageUrl);
        } else {
          setNewPrinterThumbnail(croppedImageUrl);
        }
      } else if (cropMode === "paper") {
        if (cropIsEdit) {
          setEditPaperThumbnail(croppedImageUrl);
        } else {
          setNewPaperThumbnail(croppedImageUrl);
        }
      } else if (cropMode === "color") {
        if (cropIsEdit) {
          setEditColourThumbnail(croppedImageUrl);
        } else {
          setNewColourThumbnail(croppedImageUrl);
        }
      } else if (cropMode === "step") {
        if (cropIsEdit) {
          setEditStepImage(croppedImageUrl);
        } else {
          setNewStepImage(croppedImageUrl);
        }
      }

      setCropModalOpen(false);
      setCropImage("");
      setCropMode(null);
      setCropIsEdit(false);
    };
    img.onerror = () => {
      console.error("Failed to load image in applyCrop. Image URL may have CORS restrictions or be invalid.");
      setCropModalOpen(false);
      setCropIsEdit(false);
    };
    img.src = cropImage;
  };

  const closeCropModal = () => {
    setCropModalOpen(false);
    setCropImage("");
    setCropMode(null);
    setCropIsEdit(false);
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#FFFFFF" }}>
      {/* LEFT SIDEBAR */}
      <Box
        sx={{
          width: sidebarCollapsed ? 80 : 300,
          bgcolor: "#45443F",
          borderRight: "1px solid",
          borderColor: "#2A2825",
          p: sidebarCollapsed ? 1 : 2,
          overflowY: "auto",
          transition: "all 0.3s ease",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 20,
        }}
      >
        {/* Toggle Button and Title */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", mb: 3 }}>
          {!sidebarCollapsed && (
            <Link
              component="button"
              variant="h6"
              onClick={(e) => {
                e.preventDefault();
                goHome();
              }}
              sx={{
                fontWeight: 600,
                cursor: "pointer",
                flex: 1,
                marginRight: 1.5,
                textAlign: "left",
                textDecoration: "none",
                color: "#E5E1D7",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                "&:hover": {
                  color: "#3D8078",
                },
              }}
            >
              <HomeIcon sx={{ fontSize: 22 }} />
              Print Room Dashboard
            </Link>
          )}
          <IconButton
            size="small"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            sx={{
              padding: 0.5,
              color: "#E5E1D7",
              "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
            }}
          >
            {sidebarCollapsed ? <ArrowRightRoundedIcon /> : <ArrowLeftRoundedIcon />}
          </IconButton>
        </Box>

        {/* Navigation Items */}
        <Stack spacing={sidebarCollapsed ? 1.5 : 1}>
          {/* Home Button - Collapsed Only */}
          {sidebarCollapsed && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title="Home" placement="right">
                <IconButton
                  onClick={goHome}
                  size="large"
                  sx={{
                    width: 50,
                    height: 50,
                    borderRadius: 1,
                    color: !selectedPrinterId && !showFullPaperList && !showAllColoursView && !showDeletedItems ? "#FDF9F1" : "#C2BDB1",
                    bgcolor: !selectedPrinterId && !showFullPaperList && !showAllColoursView && !showDeletedItems ? "rgba(61, 128, 120, 0.25)" : "transparent",
                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                    transition: "all 0.2s ease",
                  }}
                >
                  <HomeIcon sx={{ fontSize: 24 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}

          {/* Preview Button */}
          {sidebarCollapsed ? (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title="Preview from Start" placement="right">
                <IconButton
                  onClick={() => window.open("/", "_blank")}
                  size="large"
                  sx={{
                    width: 50,
                    height: 50,
                    borderRadius: 1,
                    color: "#C2BDB1",
                    bgcolor: "transparent",
                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                    transition: "all 0.2s ease",
                  }}
                >
                  <VisibilityIcon sx={{ fontSize: 24 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Button
              onClick={() => window.open("/", "_blank")}
              fullWidth
              startIcon={<VisibilityIcon />}
              variant="outlined"
              sx={{
                justifyContent: "flex-start",
                color: "#E5E1D7",
                borderColor: "rgba(255, 255, 255, 0.2)",
                "&:hover": {
                  bgcolor: "rgba(255, 255, 255, 0.1)",
                },
              }}
            >
              VIEW APP
            </Button>
          )}

          {/* Alternate Preview Button */}
          {sidebarCollapsed ? (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title="Preview Current Page" placement="right">
                <IconButton
                  onClick={() => void generateAltPreview()}
                  size="large"
                  sx={{
                    width: 50,
                    height: 50,
                    borderRadius: 1,
                    color: "#C2BDB1",
                    bgcolor: "transparent",
                    "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                    transition: "all 0.2s ease",
                  }}
                >
                  <PageviewIcon sx={{ fontSize: 24 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : (
            <Button
              onClick={() => void generateAltPreview()}
              fullWidth
              startIcon={<PageviewIcon />}
              variant="outlined"
              sx={{
                justifyContent: "flex-start",
                color: "#E5E1D7",
                borderColor: "rgba(255, 255, 255, 0.2)",
                "&:hover": {
                  bgcolor: "rgba(255, 255, 255, 0.1)",
                },
              }}
            >
              PREVIEW CURRENT PAGE
            </Button>
          )}
        </Stack>

        {!sidebarCollapsed && (
          <>
            <Divider sx={{ my: 1.5, borderColor: "rgba(255, 255, 255, 0.15)" }} />
            {/* Homepage Customization - Only on HOME page */}
            {!showFullPaperList && !showAllColoursView && !selectedPrinterId && !showDeletedItems && (
              <Stack spacing={2} sx={{ mb: 2, pb: 2 }}>
                <TextField
                  label="Homepage Header"
                  size="small"
                  fullWidth
                  required
                  value={homePageTitle}
                  onChange={(e) => setHomePageTitle(e.target.value)}
                  placeholder="e.g., PRINTER GUIDE"
                  sx={{
                    "& .MuiInputBase-input": {
                      color: "#E5E1D7",
                    },
                    "& .MuiInputBase-input::placeholder": {
                      color: "rgba(255, 255, 255, 0.38)",
                      opacity: 1,
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.2)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.3)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#3D8078",
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(255, 255, 255, 0.6)",
                      "&.Mui-focused": {
                        color: "#3D8078",
                      },
                    },
                  }}
                />
                <TextField
                  label="Homepage Description"
                  size="small"
                  fullWidth
                  required
                  multiline
                  rows={3}
                  value={homePageDescription}
                  onChange={(e) => setHomePageDescription(e.target.value)}
                  placeholder="e.g., A step-by-step guide..."
                  sx={{
                    "& .MuiInputBase-input": {
                      color: "#E5E1D7",
                    },
                    "& .MuiInputBase-input::placeholder": {
                      color: "rgba(255, 255, 255, 0.38)",
                      opacity: 1,
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.2)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(255, 255, 255, 0.3)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#3D8078",
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "rgba(255, 255, 255, 0.6)",
                      "&.Mui-focused": {
                        color: "#3D8078",
                      },
                    },
                  }}
                />

                {/* Save / Cancel row — only shown when there are unsaved changes or after saving */}
                {(homePageTitle !== savedHomePageTitle || homePageDescription !== savedHomePageDescription || homepageSaving || homepageSaved) && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    {homepageSaving ? (
                      <CircularProgress size={16} sx={{ color: "#3D8078" }} />
                    ) : homepageSaved ? (
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <CheckIcon sx={{ fontSize: 16, color: "#1A7A2E" }} />
                        <Typography variant="caption" sx={{ color: "#1A7A2E" }}>Saved</Typography>
                      </Stack>
                    ) : (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={handleSaveHomepageSettings}
                          startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />}
                          sx={{
                            fontSize: "0.7rem",
                            py: 0.4,
                            px: 1,
                            minWidth: 0,
                            backgroundColor: "#3D8078",
                            "&:hover": { backgroundColor: "#3D8078" },
                            textTransform: "none",
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          onClick={handleCancelHomepageSettings}
                          sx={{
                            fontSize: "0.7rem",
                            py: 0.4,
                            px: 1,
                            minWidth: 0,
                            color: "rgba(255,255,255,0.6)",
                            "&:hover": { color: "#FDF9F1", backgroundColor: "rgba(255,255,255,0.1)" },
                            textTransform: "none",
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </Stack>
                )}
              </Stack>
            )}

            <Divider sx={{ my: 1.5, borderColor: "rgba(255, 255, 255, 0.15)" }} />
          </>
        )}

        {/* Printer List */}
        {sidebarCollapsed && (
          <Divider sx={{ my: 1.5, borderColor: "rgba(255, 255, 255, 0.15)" }} />
        )}
        {sidebarCollapsed ? (
              <Stack spacing={1.5} sx={{ mt: 0 }}>
                {/* Printers Section */}
                {appSettings.printerList && (
                  <>
                    <Stack spacing={1.5}>
                      {tutorialState.printers.slice(0, 3).map((printer) => (
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
                                width: 40,
                                height: 40,
                                border: selectedPrinterId === printer.id && !showFullPaperList ? "2px solid" : "1px solid transparent",
                                borderColor: "#3D8078",
                                bgcolor: selectedPrinterId === printer.id && !showFullPaperList ? "rgba(61, 128, 120, 0.25)" : "#62615C",
                                transition: "all 180ms ease",
                                "&:hover": {
                                  boxShadow: "0 0 0 2px rgba(61, 128, 120, 0.4)",
                                },
                              }}
                            >
                              {printer.name.charAt(0).toUpperCase()}
                            </Avatar>
                          </Box>
                        </Tooltip>
                      ))}
                      {tutorialState.printers.length > 3 && (
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <Tooltip title="More printers" placement="right">
                            <IconButton
                              onClick={goHome}
                              size="small"
                              sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1,
                                color: "#3D8078",
                                "&:hover": { bgcolor: "rgba(61, 128, 120, 0.25)" },
                              }}
                            >
                              ⋯
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Stack>

                    <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.15)" }} />
                  </>
                )}

                {/* Full Paper List Section */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Tooltip title="Full Paper List" placement="right">
                    <IconButton
                      onClick={goToFullPaperList}
                      size="large"
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 1,
                        color: showFullPaperList ? "#FDF9F1" : "#C2BDB1",
                        bgcolor: showFullPaperList ? "rgba(61, 128, 120, 0.25)" : "transparent",
                        "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <InventoryIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Colour Management Section */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
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
                      size="large"
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 1,
                        color: showAllColoursView ? "#FDF9F1" : "#C2BDB1",
                        bgcolor: showAllColoursView ? "rgba(61, 128, 120, 0.25)" : "transparent",
                        "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                        transition: "all 0.2s ease",
                      }}
                    >
                      <PaletteIcon sx={{ fontSize: 24 }} />
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
                      size="large"
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 1,
                        color: showDeletedItems ? "#FDF9F1" : "#C2BDB1",
                        bgcolor: showDeletedItems ? "rgba(61, 128, 120, 0.25)" : "transparent",
                        "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                        transition: "all 0.2s ease",
                    }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 24 }} />
                  </IconButton>
                </Tooltip>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
              {appSettings.printerList && (
                <>
                  <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight={600}
                        onClick={goHome}
                        sx={{
                          color: "#E5E1D7",
                          textTransform: "uppercase",
                          fontSize: "0.75rem",
                          letterSpacing: "0.5px",
                          cursor: "pointer",
                          "&:hover": { color: "#3D8078" },
                        }}
                      >
                        PRINTER LIST
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => { setImageUploadError(null); setImageCompressed(false); setShowAddPrinterModal(true); }}
                        sx={{
                          minWidth: "auto",
                          p: 0.5,
                          color: "#3D8078",
                          "&:hover": { bgcolor: "rgba(61, 128, 120, 0.25)" }
                        }}
                      >
                        <AddIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Stack>

                    {tutorialState.printers.length > 0 && (
                      <List sx={{ p: 0, borderRadius: 1 }}>
                        {tutorialState.printers.slice(0, 3).map((printer) => (
                          <ListItem key={printer.id} disablePadding>
                            <ListItemButton
                              selected={selectedPrinterId === printer.id && !showFullPaperList}
                              onClick={() => goToPrinterPapers(printer.id)}
                              sx={{
                                borderRadius: 1,
                                transition: "all 180ms ease",
                                bgcolor: selectedPrinterId === printer.id && !showFullPaperList ? "rgba(61, 128, 120, 0.25)" : "transparent",
                                color: selectedPrinterId === printer.id && !showFullPaperList ? "#FDF9F1" : "#E5E1D7",
                                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                              }}
                            >
                              <ListItemAvatar sx={{ minWidth: 40 }}>
                                <Avatar
                                  src={printer.thumbnailDataUrl || undefined}
                                  alt={printer.name}
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: "#62615C",
                                    border: selectedPrinterId === printer.id && !showFullPaperList ? "2px solid #3D8078" : "1px solid transparent",
                                  }}
                                >
                                  {printer.name.charAt(0).toUpperCase()}
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={printer.name}
                                sx={{ "& .MuiListItemText-primary": { color: "inherit" } }}
                              />
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrinterMenuOpen(e, printer.id);
                                }}
                                sx={{ ml: 1, color: "inherit", "&:hover": { color: "#3D8078" } }}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    )}

                    {tutorialState.printers.length > 3 && (
                      <Button
                        fullWidth
                        size="small"
                        onClick={goHome}
                        sx={{
                          mt: 0.5,
                          textTransform: "none",
                          color: "#3D8078",
                          borderColor: "rgba(61, 128, 120, 0.25)",
                          "&:hover": {
                            bgcolor: "rgba(61, 128, 120, 0.1)",
                            borderColor: "rgba(61, 128, 120, 0.4)",
                          },
                        }}
                      >
                        More
                      </Button>
                    )}

                    {tutorialState.printers.length === 0 && (
                      <Typography
                        variant="body2"
                        sx={{ p: 2, textAlign: "center", color: "rgba(255, 255, 255, 0.38)" }}
                      >
                        No printers yet
                      </Typography>
                    )}
                  </Box>

                  <Divider sx={{ my: 2, borderColor: "rgba(255, 255, 255, 0.15)" }} />
                </>
              )}

          {/* Full Paper List Button */}
          {appSettings.fullPaperList && (
            <Button
              fullWidth
              startIcon={<InventoryIcon />}
              variant={showFullPaperList ? "contained" : "outlined"}
              onClick={goToFullPaperList}
              sx={{
                justifyContent: "flex-start",
                mb: 1,
                bgcolor: showFullPaperList ? "#3D8078" : "transparent",
                color: showFullPaperList ? "#ffffff" : "#E5E1D7",
                borderColor: "rgba(255, 255, 255, 0.2)",
                "&:hover": {
                  bgcolor: showFullPaperList ? "#2D6059" : "rgba(255, 255, 255, 0.1)",
                },
              }}
            >
              Full Paper List
            </Button>
          )}

          {/* Colour Management Button */}
          {appSettings.colourManagementList && (
            <Button
              fullWidth
              startIcon={<PaletteIcon />}
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
                bgcolor: showAllColoursView ? "#3D8078" : "transparent",
                color: showAllColoursView ? "#ffffff" : "#E5E1D7",
                borderColor: "rgba(255, 255, 255, 0.2)",
                "&:hover": {
                  bgcolor: showAllColoursView ? "#2D6059" : "rgba(255, 255, 255, 0.1)",
                },
              }}
            >
              Colour Management
            </Button>
          )}

          <Divider sx={{ my: 2, borderColor: "rgba(255, 255, 255, 0.15)" }} />

          {/* Deleted Items Button */}
          <Button
            fullWidth
            startIcon={<DeleteOutlineIcon />}
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
              bgcolor: showDeletedItems ? "#3D8078" : "transparent",
              color: showDeletedItems ? "#ffffff" : "#E5E1D7",
              borderColor: "rgba(255, 255, 255, 0.2)",
              "&:hover": {
                bgcolor: showDeletedItems ? "#2D6059" : "rgba(255, 255, 255, 0.1)",
              },
            }}
          >
            Deleted Items
          </Button>
            </Stack>
            )}

      </Box>

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, p: 3, overflowY: "auto", backgroundColor: "#FDF9F1", position: "relative" }}>
        {/* Loading overlay */}
        {loading && (
          <Box sx={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(253, 249, 241, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}>
            <CircularProgress sx={{ color: "#3D8078" }} />
          </Box>
        )}
        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, backgroundColor: "#f9e9e6", color: "#a22916" }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2, backgroundColor: "#e0ede3", color: "#104b1c" }}>
            {success}
          </Alert>
        )}

        {/* Breadcrumbs Navigation */}
        <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              component="button"
              variant="body2"
              onClick={goHome}
              underline="hover"
              sx={{ color: "#3D8078", fontWeight: 500, "&:hover": { color: "#2D6059" }, cursor: "pointer" }}
            >
              HOME
            </Link>
            {!showDeletedItems && !showFullPaperList && !showAllColoursView && selectedPrinterId && selectedPrinter && (
              <Link
                component="button"
                variant="body2"
                onClick={() => goToPrinterPapers(selectedPrinterId)}
                underline="hover"
                sx={{ color: "#3D8078", fontWeight: 500, "&:hover": { color: "#2D6059" }, cursor: "pointer" }}
              >
                {selectedPrinter.name.toUpperCase()}
              </Link>
            )}
            {!showDeletedItems && !showFullPaperList && !showAllColoursView && selectedPaperId && selectedPaper && (
              <Link
                component="button"
                variant="body2"
                onClick={() => goToPaperColours(selectedPaperId)}
                underline="hover"
                sx={{ color: "#3D8078", fontWeight: 500, "&:hover": { color: "#2D6059" }, cursor: "pointer" }}
              >
                {selectedPaper.name.toUpperCase()}
              </Link>
            )}
            {!showDeletedItems && !showFullPaperList && !showAllColoursView && selectedColorId && selectedColor && (
              <Link
                component="button"
                variant="body2"
                onClick={() => goToColourSteps(selectedColorId)}
                underline="hover"
                sx={{ color: "#3D8078", fontWeight: 500, "&:hover": { color: "#2D6059" }, cursor: "pointer" }}
              >
                {selectedColor?.name?.toUpperCase()}
              </Link>
            )}
            {!showDeletedItems && !showFullPaperList && !showAllColoursView && selectedStepId && selectedStep && (
              <Typography color="text.primary" variant="body2" sx={{ color: "#3D8078", fontWeight: 500 }}>
                {selectedStep?.title?.toUpperCase()}
              </Typography>
            )}
            {showFullPaperList && (
              <Typography color="text.primary" variant="body2" sx={{ color: "#3D8078", fontWeight: 500 }}>
                FULL PAPER LIST
              </Typography>
            )}
            {showAllColoursView && (
              <Typography color="text.primary" variant="body2" sx={{ color: "#3D8078", fontWeight: 500 }}>
                COLOUR MANAGEMENT
              </Typography>
            )}
          </Breadcrumbs>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {role === "superadmin" && (
              <Tooltip title="Superadmin Settings">
                <IconButton
                  onClick={() => {
                    setShowSuperadminModal(true);
                    void loadPendingRequests();
                  }}
                  size="small"
                  sx={{ color: "#666", "&:hover": { color: "#333" } }}
                >
                  <Badge variant="dot" color="error" invisible={pendingRequests.length === 0}>
                    <SettingsIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Sign Out">
              <IconButton onClick={() => void signOut()} size="small" sx={{ color: "#666", "&:hover": { color: "#333" } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {!showDeletedItems && (
          <>


        {/* HOME PAGE */}
        {!selectedPrinterId && !showFullPaperList && !showAllColoursView && (
          <Box>
            <Stack spacing={4}>
              <Box>
                <Box sx={{ mb: 2 }}>
                  <TextField
                    value={sectionSettings.printers.title}
                    onChange={(e) => setSectionSettings((p) => ({ ...p, printers: { ...p.printers, title: e.target.value } }))}
                    size="small"
                    label="Section Title"
                    inputProps={{ maxLength: 50 }}
                    InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{sectionSettings.printers.title.length}/50</Typography></InputAdornment> }}
                    sx={{ mb: 2, minWidth: 260, maxWidth: "50%" }}
                  />
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <TextField
                      value={sectionSettings.printers.subtitle}
                      onChange={(e) => setSectionSettings((p) => ({ ...p, printers: { ...p.printers, subtitle: e.target.value } }))}
                      size="small"
                      label="Subtitle"
                      inputProps={{ maxLength: 100 }}
                      InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{sectionSettings.printers.subtitle.length}/100</Typography></InputAdornment> }}
                      sx={{ minWidth: 260, maxWidth: "50%" }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => { setImageUploadError(null); setImageCompressed(false); setShowAddPrinterModal(true); }}
                      sx={{ backgroundColor: "#3D8078", color: "#ffffff", fontWeight: 600, textTransform: "none", "&:hover": { backgroundColor: "#2D6059" }, whiteSpace: "nowrap" }}
                    >
                      + Add Printer
                    </Button>
                  </Box>
                  {(sectionSettings.printers.title !== savedSectionSettings.printers.title ||
                    sectionSettings.printers.subtitle !== savedSectionSettings.printers.subtitle ||
                    sectionSavingKey === "printers" || sectionSavedKey === "printers") && (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      {sectionSavingKey === "printers" ? (
                        <CircularProgress size={16} sx={{ color: "#3D8078" }} />
                      ) : sectionSavedKey === "printers" ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <CheckIcon sx={{ fontSize: 16, color: "#1A7A2E" }} />
                          <Typography variant="caption" sx={{ color: "#1A7A2E" }}>Saved</Typography>
                        </Stack>
                      ) : (
                        <>
                          <Button size="small" variant="contained" onClick={() => handleSaveSectionSettings("printers")} startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />} sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#3D8078" }, textTransform: "none" }}>Save</Button>
                          <Button size="small" variant="text" onClick={() => handleCancelSectionSettings("printers")} sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, color: "text.secondary", textTransform: "none" }}>Cancel</Button>
                        </>
                      )}
                    </Stack>
                  )}
                </Box>

                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden" }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            cursor: "pointer",
                            userSelect: "none",
                            color: "#45443F",
                            fontSize: "0.95rem",
                            padding: "16px"
                          }}
                          onClick={() => setPrintersSortByName(!printersSortByName)}
                        >
                          Printer {printersSortByName ? "↑" : "↓"}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, width: 50, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}></TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Last Edited</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortPrinters(tutorialState.printers).map((printer) => (
                        <TableRow
                          key={printer.id}
                          hover
                          onClick={() => goToPrinterPapers(printer.id)}
                          sx={{
                            cursor: "pointer",
                            borderBottom: "1px solid #E5E1D7",
                            "&:hover": { backgroundColor: "#E5E1D7" }
                          }}
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
                            <Stack direction="row" alignItems="center" justifyContent="center">
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePrinterMenuOpen(e, printer.id); }}>
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                              {appSettings.copyLink && (
                                <Tooltip title="Copy link">
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyPrinterLink(printer); }}>
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {appSettings.qrCode && (
                                <Tooltip title={slugUpdatedIds.has(printer.id) ? "Link updated — download new QR code" : "Download QR code"}>
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); void openQrDialog(printer); }} sx={slugUpdatedIds.has(printer.id) ? { color: "#f59e0b" } : {}}>
                                    <QrCodeIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {appSettings.canvasEmbed && (
                                <Tooltip title="Embed in Canvas LMS">
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEmbedPrinter(printer); setEmbedWidth("100%"); setEmbedHeight("600"); setEmbedCopied(false); }}>
                                    <SettingsEthernetIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color="text.secondary">
                              {printer.lastModified ? new Date(printer.lastModified).toLocaleDateString() : "N/A"}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={printer.published}
                              onChange={(e) => {
                                e.stopPropagation();
                                void handleUnpublishPrinter(printer.id, printer.published);
                              }}
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#135b22",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                  backgroundColor: "#b3d3b9",
                                },
                                "& .MuiSwitch-switchBase": {
                                  color: "#C4321A",
                                },
                                "& .MuiSwitch-track": {
                                  backgroundColor: "#efc9c2",
                                },
                              }}
                            />
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
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <TextField
                  value={sectionSettings.papers.title}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, papers: { ...p.papers, title: e.target.value } }))}
                  size="small"
                  label="Section Title"
                  inputProps={{ maxLength: 50 }}
                  InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{sectionSettings.papers.title.length}/50</Typography></InputAdornment> }}
                  sx={{ minWidth: 260, maxWidth: "50%" }}
                />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <TextField
                  value={sectionSettings.papers.subtitle}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, papers: { ...p.papers, subtitle: e.target.value } }))}
                  size="small"
                  label="Subtitle"
                  inputProps={{ maxLength: 100 }}
                  InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{sectionSettings.papers.subtitle.length}/100</Typography></InputAdornment> }}
                  sx={{ minWidth: 260, maxWidth: "50%" }}
                />
                <Button
                  variant="contained"
                  onClick={() => { setImageUploadError(null); setImageCompressed(false); setShowAddPaperModal(true); }}
                  sx={{ backgroundColor: "#3D8078", color: "#ffffff", fontWeight: 600, textTransform: "none", "&:hover": { backgroundColor: "#2D6059" }, whiteSpace: "nowrap" }}
                >
                  + Add Paper
                </Button>
              </Box>
              {(sectionSettings.papers.title !== savedSectionSettings.papers.title ||
                sectionSettings.papers.subtitle !== savedSectionSettings.papers.subtitle ||
                sectionSavingKey === "papers" || sectionSavedKey === "papers") && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  {sectionSavingKey === "papers" ? (
                    <CircularProgress size={16} sx={{ color: "#3D8078" }} />
                  ) : sectionSavedKey === "papers" ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CheckIcon sx={{ fontSize: 16, color: "#1A7A2E" }} />
                      <Typography variant="caption" sx={{ color: "#1A7A2E" }}>Saved</Typography>
                    </Stack>
                  ) : (
                    <>
                      <Button size="small" variant="contained" onClick={() => handleSaveSectionSettings("papers")} startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />} sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#3D8078" }, textTransform: "none" }}>Save</Button>
                      <Button size="small" variant="text" onClick={() => handleCancelSectionSettings("papers")} sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, color: "text.secondary", textTransform: "none" }}>Cancel</Button>
                    </>
                  )}
                </Stack>
              )}
            </Box>

            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        cursor: "pointer",
                        userSelect: "none",
                        color: "#45443F",
                        fontSize: "0.95rem",
                        padding: "16px"
                      }}
                      onClick={() => setPapersSortByName(!papersSortByName)}
                    >
                      Paper {papersSortByName ? "↑" : "↓"}
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, width: 50, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}></TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Last Edited</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    // Papers are now full Paper objects, not PrinterPaper references
                    const sorted = [...selectedPrinter.papers];
                    if (papersSortByName) {
                      sorted.sort((a, b) => a.name.localeCompare(b.name));
                    } else {
                      sorted.sort((a, b) => {
                        const dateA = a.createdAt || a.lastModified || new Date(0);
                        const dateB = b.createdAt || b.lastModified || new Date(0);
                        return new Date(dateA).getTime() - new Date(dateB).getTime();
                      });
                    }
                    return sorted;
                  })().map((paper) => (
                      <TableRow
                        key={paper.id}
                        hover
                        onClick={() => goToPaperColours(paper.id)}
                        sx={{
                          cursor: "pointer",
                          borderBottom: "1px solid #E5E1D7",
                          "&:hover": { backgroundColor: "#E5E1D7" }
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
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePaperMenuOpen(e, paper.id, "papers");
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="text.secondary">
                            {paper.lastModified ? new Date(paper.lastModified).toLocaleDateString() : "N/A"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={paper.published ?? true}
                            onChange={(e) => {
                              e.stopPropagation();
                              void handleUnpublishPaper(paper.id, paper.published ?? true);
                            }}
                            sx={{
                              "& .MuiSwitch-switchBase.Mui-checked": {
                                color: "#135b22",
                              },
                              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                backgroundColor: "#b3d3b9",
                              },
                              "& .MuiSwitch-switchBase": {
                                color: "#C4321A",
                              },
                              "& .MuiSwitch-track": {
                                backgroundColor: "#efc9c2",
                              },
                            }}
                          />
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
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <TextField
                  value={sectionSettings.colours.title}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, colours: { ...p.colours, title: e.target.value } }))}
                  size="small"
                  label="Section Title"
                  inputProps={{ maxLength: 50 }}
                  InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{sectionSettings.colours.title.length}/50</Typography></InputAdornment> }}
                  sx={{ minWidth: 260, maxWidth: "50%" }}
                />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <TextField
                  value={sectionSettings.colours.subtitle}
                  onChange={(e) => setSectionSettings((p) => ({ ...p, colours: { ...p.colours, subtitle: e.target.value } }))}
                  size="small"
                  label="Subtitle"
                  inputProps={{ maxLength: 100 }}
                  InputProps={{ endAdornment: <InputAdornment position="end"><Typography variant="caption" color="text.secondary">{sectionSettings.colours.subtitle.length}/100</Typography></InputAdornment> }}
                  sx={{ minWidth: 260, maxWidth: "50%" }}
                />
                <Button
                  variant="contained"
                  onClick={() => { setImageUploadError(null); setImageCompressed(false); setShowAddColourModal(true); }}
                  sx={{ backgroundColor: "#3D8078", color: "#ffffff", fontWeight: 600, textTransform: "none", "&:hover": { backgroundColor: "#2D6059" }, whiteSpace: "nowrap" }}
                >
                  + Add Colour
                </Button>
              </Box>
              {(sectionSettings.colours.title !== savedSectionSettings.colours.title ||
                sectionSettings.colours.subtitle !== savedSectionSettings.colours.subtitle ||
                sectionSavingKey === "colours" || sectionSavedKey === "colours") && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  {sectionSavingKey === "colours" ? (
                    <CircularProgress size={16} sx={{ color: "#3D8078" }} />
                  ) : sectionSavedKey === "colours" ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CheckIcon sx={{ fontSize: 16, color: "#1A7A2E" }} />
                      <Typography variant="caption" sx={{ color: "#1A7A2E" }}>Saved</Typography>
                    </Stack>
                  ) : (
                    <>
                      <Button size="small" variant="contained" onClick={() => handleSaveSectionSettings("colours")} startIcon={<SaveIcon sx={{ fontSize: "14px !important" }} />} sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#3D8078" }, textTransform: "none" }}>Save</Button>
                      <Button size="small" variant="text" onClick={() => handleCancelSectionSettings("colours")} sx={{ fontSize: "0.7rem", py: 0.4, px: 1, minWidth: 0, color: "text.secondary", textTransform: "none" }}>Cancel</Button>
                    </>
                  )}
                </Stack>
              )}
            </Box>

            {selectedPrinterPaper?.colours.length === 0 ? (
              <Typography color="text.secondary">No colours added yet.</Typography>
            ) : (
              <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden" }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          cursor: "pointer",
                          userSelect: "none",
                          color: "#45443F",
                          fontSize: "0.95rem",
                          padding: "16px"
                        }}
                        onClick={() => setColoursSortByName(!coloursSortByName)}
                      >
                        Colour {coloursSortByName ? "↑" : "↓"}
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, width: 50, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}></TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Last Edited</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      // Colours are now full Colour objects, not PrinterPaperColour references
                      const colours = selectedPrinterPaper?.colours || [];
                      const sorted = [...colours];
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
                    })().map((colour) => (
                        <TableRow
                          key={colour.id}
                          hover
                          onClick={() => goToColourSteps(colour.id)}
                          sx={{
                            cursor: "pointer",
                            borderBottom: "1px solid #E5E1D7",
                            "&:hover": { backgroundColor: "#E5E1D7" }
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
                                    backgroundColor: "#E0EFED",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  <ImagePlaceholderIcon sx={{ fontSize: 18, color: "#A8C0BC" }} />
                                </Box>
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
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" color="text.secondary">
                              {colour.lastModified ? new Date(colour.lastModified).toLocaleDateString() : "N/A"}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={colour.published ?? true}
                              onChange={(e) => {
                                e.stopPropagation();
                                void handleUnpublishColour(colour.id, colour.published ?? true);
                              }}
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": {
                                  color: "#135b22",
                                },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                  backgroundColor: "#b3d3b9",
                                },
                                "& .MuiSwitch-switchBase": {
                                  color: "#C4321A",
                                },
                                "& .MuiSwitch-track": {
                                  backgroundColor: "#efc9c2",
                                },
                              }}
                            />
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700 }}>Steps: {selectedColor.name}</Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                onClick={() => { setImageUploadError(null); setImageCompressed(false); setShowAddStepModal(true); }}
                sx={{
                  backgroundColor: "#3D8078",
                  color: "#ffffff",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#2D6059" }
                }}
              >
                + Add Step
              </Button>
            </Box>

            {selectedColor.steps.length === 0 ? (
              <Typography color="text.secondary">No steps added yet.</Typography>
            ) : (
              <DragDropContext onDragEnd={(result) => { void handleDragEnd(result); }}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      {selectedColor.steps.map((step, index) => (
                        <Draggable key={step.id} draggableId={step.id} index={index}>
                          {(provided, snapshot) => (
                            <Paper
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              elevation={1}
                              sx={{
                                p: 3,
                                borderRadius: 1,
                                border: "1px solid #E5E1D7",
                                transition: snapshot.isDragging ? "none" : "box-shadow 200ms ease",
                                boxShadow: snapshot.isDragging ? "0 8px 24px rgba(0,0,0,0.15)" : undefined,
                              }}
                            >
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flex: 1 }}>
                                  <Box
                                    {...provided.dragHandleProps}
                                    sx={{ display: "flex", alignItems: "center", pt: 0.5, cursor: "grab", color: "text.disabled" }}
                                  >
                                    <DragIndicatorIcon fontSize="small" />
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                                      <Typography variant="h6" fontWeight={700} sx={{ color: "#45443F" }}>
                                        Step {index + 1}: {step.title}
                                      </Typography>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setExpandedSteps(expandedSteps === step.id ? null : step.id)}
                                        sx={{
                                          color: "#3D8078",
                                          borderColor: "#3D8078",
                                          fontWeight: 600,
                                          textTransform: "none",
                                          "&:hover": {
                                            backgroundColor: "rgba(61, 128, 120, 0.1)",
                                            borderColor: "#2D6059"
                                          }
                                        }}
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
                                            dangerouslySetInnerHTML={{ __html: sanitizeStepHtml(step.contentHtml) }}
                                          />
                                        )}
                                        {step.imageDataUrl && (
                                          <Box
                                            component="img"
                                            src={step.imageDataUrl}
                                            alt="Step image"
                                            onClick={() => setEnlargedStepImageUrl(step.imageDataUrl)}
                                            sx={{
                                              width: "100%",
                                              maxWidth: 400,
                                              maxHeight: 300,
                                              objectFit: "cover",
                                              borderRadius: 1,
                                              mt: 1,
                                              cursor: "pointer",
                                              transition: "transform 200ms ease",
                                              "&:hover": { transform: "scale(1.02)" },
                                            }}
                                          />
                                        )}
                                        {step.videoUrl && getVideoEmbedUrl(step.videoUrl) && (
                                          <Box sx={{ mt: 1 }}>
                                            {/\.(mp4|webm|ogg)(\?.*)?$/i.test(step.videoUrl) ? (
                                              <Box component="video" controls src={step.videoUrl} sx={{ width: "100%", borderRadius: 1 }} />
                                            ) : (
                                              <Box sx={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 1, overflow: "hidden" }}>
                                                <Box
                                                  component="iframe"
                                                  src={getVideoEmbedUrl(step.videoUrl)!}
                                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                  allowFullScreen
                                                  sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                                                />
                                              </Box>
                                            )}
                                          </Box>
                                        )}
                                      </Box>
                                    </Collapse>
                                  </Box>
                                </Box>

                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStepMenuOpen(e, step.id);
                                  }}
                                  title="More options"
                                  sx={{ ml: 1 }}
                                >
                                  <MoreVertIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Paper>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </Box>
        )}

        {/* FULL PAPER LIST PAGE */}
        {showFullPaperList && (
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
              <Box>
                <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700, mb: 0.5 }}>All Papers</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  View and manage all papers across the system
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => {
                  setImageUploadError(null);
                  setImageCompressed(false);
                  setShowAddPaperModal(true);
                  setAddPaperFromFullList(true);
                  setShowAddPaperSearch(false);
                }}
                sx={{
                  backgroundColor: "#3D8078",
                  color: "#ffffff",
                  fontWeight: 600,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "#2D6059" }
                }}
              >
                + Add Paper
              </Button>
            </Box>

            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        cursor: "pointer",
                        userSelect: "none",
                        color: "#45443F",
                        fontSize: "0.95rem",
                        padding: "16px"
                      }}
                      onClick={() => setFullPaperListSortByName(!fullPaperListSortByName)}
                    >
                      Paper Type {fullPaperListSortByName ? "↑" : "↓"}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Active In</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Last Edited</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortPapers(allPapers, false).map((paper) => (
                    <TableRow
                      key={paper.id}
                      hover
                      sx={{
                        transition: "all 200ms ease",
                        borderBottom: "1px solid #E5E1D7",
                        "&:hover": {
                          backgroundColor: "#E5E1D7",
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
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handlePaperMenuOpen(e, paper.id, "fulllist")}
                        >
                          <MoreVertIcon fontSize="small" />
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
                <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700, mb: 0.5 }}>Colour Management</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  View and manage all colours across all papers and printers
                </Typography>
              </Box>
            </Box>

            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 1, overflow: "hidden" }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7" }}>
                    <TableCell
                      sx={{
                        fontWeight: 700,
                        cursor: "pointer",
                        userSelect: "none",
                        color: "#45443F",
                        fontSize: "0.95rem",
                        padding: "16px"
                      }}
                      onClick={() => setColourManagementSortByName(!colourManagementSortByName)}
                    >
                      Colour {colourManagementSortByName ? "↑" : "↓"}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Paper</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Printer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: "#45443F", fontSize: "0.95rem", padding: "16px" }}>Last Edited</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortColoursForManagement(
                    tutorialState.printers.flatMap((printer) =>
                      printer.papers.flatMap((paper) => {
                        // Papers now contain full Colour objects with metadata
                        return paper.colours.map((colour) => ({
                          colour,
                          paper,
                          printer,
                        }));
                      })
                    ) as Array<{ colour: Colour; paper: Paper; printer: Printer }>
                  ).map(({ colour, paper, printer }) => (
                        <TableRow
                          key={`${printer.id}-${paper.id}-${colour.id}`}
                          hover
                          sx={{
                            transition: "all 200ms ease",
                            borderBottom: "1px solid #E5E1D7",
                            "&:hover": {
                              backgroundColor: "#E5E1D7",
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
                                    backgroundColor: "#E0EFED",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                >
                                  <ImagePlaceholderIcon sx={{ fontSize: 18, color: "#A8C0BC" }} />
                                </Box>
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
              <Typography variant="h5" sx={{ color: "#45443F", fontWeight: 700, mb: 0.5 }}>Deleted Items</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Restore or permanently delete removed items
              </Typography>
            </Box>

            {tutorialState.deletedItems && tutorialState.deletedItems.length > 0 ? (
              <Stack spacing={2}>
                {tutorialState.deletedItems.map((item) => (
                  <Paper key={item.id} elevation={1} sx={{ p: 3, borderRadius: 1, border: "1px solid #E5E1D7" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ color: "#45443F" }}>
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
                          variant="contained"
                          onClick={() => {
                            void runAction("restoreDeletedItem", { deletedItemId: item.id });
                          }}
                          sx={{
                            backgroundColor: "#135b22",
                            color: "#ffffff",
                            fontWeight: 600,
                            textTransform: "none",
                            "&:hover": {
                              backgroundColor: "#104b1c"
                            }
                          }}
                        >
                          Restore
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            if (confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) {
                              void runAction("permanentlyDeleteItem", { deletedItemId: item.id });
                            }
                          }}
                          sx={{
                            backgroundColor: "#C4321A",
                            color: "#ffffff",
                            fontWeight: 600,
                            textTransform: "none",
                            "&:hover": {
                              backgroundColor: "#b12d17"
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
              <Paper elevation={1} sx={{ p: 3, textAlign: "center", borderRadius: 1 }}>
                <Typography color="text.secondary">
                  No deleted items. Everything is safe!
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      {/* Superadmin Settings Modal */}
      <Dialog
        open={showSuperadminModal}
        onClose={() => {
          setShowSuperadminModal(false);
          setSuperadminTab(0);
          setPendingError("");
          setAppSettings(savedAppSettings);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
          <Typography variant="h6" fontWeight={700} color="#3D8078" fontSize="1.1rem">Superadmin Settings</Typography>
        </DialogTitle>
        <Box sx={{ borderBottom: 1, borderColor: "#E5E1D7", px: 3, backgroundColor: "#FDF9F1" }}>
          <Tabs value={superadminTab} onChange={(_, v: number) => setSuperadminTab(v)} textColor="primary">
            <Tab label="Admins" />
            <Tab label="App Settings" />
            <Tab label="Statistics" />
          </Tabs>
        </Box>

        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>

          {/* ── Admins Tab ── */}
          {superadminTab === 0 && (
            <Box>
              {(pendingLoading || !!pendingError || pendingRequests.length > 0) && (
                <>
                  <Typography variant="subtitle1" fontWeight={600} mb={2}>
                    Pending Access Requests
                  </Typography>

                  {pendingLoading && (
                    <Box display="flex" justifyContent="center" py={3}>
                      <CircularProgress size={28} />
                    </Box>
                  )}

                  {pendingError && (
                    <Alert severity="error" sx={{ mb: 2 }}>{pendingError}</Alert>
                  )}

              {!pendingLoading && pendingRequests.length > 0 && (
                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E5E1D7", borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#FDF9F1" }}>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>E-number</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pendingRequests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>{req.name}</TableCell>
                          <TableCell>{req.email}</TableCell>
                          <TableCell>{req.staffNumber.toUpperCase()}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={pendingRoles[req.id] ?? "admin"}
                              onChange={(e) => setPendingRoles((prev) => ({ ...prev, [req.id]: e.target.value as "admin" | "superadmin" }))}
                              disabled={reviewingId === req.id}
                              sx={{ fontSize: "0.8rem", minWidth: 120 }}
                            >
                              <MenuItem value="admin">Admin</MenuItem>
                              <MenuItem value="superadmin">Superadmin</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="Approve">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    disabled={reviewingId === req.id}
                                    onClick={() => void handleReview(req.id, "approve")}
                                  >
                                    {reviewingId === req.id ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      <ApproveIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={reviewingId === req.id}
                                    onClick={() => void handleReview(req.id, "reject")}
                                  >
                                    <RejectIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

                  <Divider sx={{ my: 3 }} />
                </>
              )}

              {/* ── Admin Users section ── */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Admin Users
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => { setShowAddAdminForm((v) => !v); setAddAdminError(""); }}
                  sx={{ textTransform: "none" }}
                >
                  Add Admin
                </Button>
              </Stack>

              <Collapse in={showAddAdminForm}>
                <Box sx={{ border: "1px solid #E5E1D7", borderRadius: 2, p: 2, mb: 2, backgroundColor: "#FDF9F1" }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.5}>
                      <TextField
                        size="small"
                        label="Full Name"
                        value={addAdminForm.name}
                        onChange={(e) => setAddAdminForm((p) => ({ ...p, name: e.target.value }))}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        label="Email"
                        value={addAdminForm.email}
                        onChange={(e) => setAddAdminForm((p) => ({ ...p, email: e.target.value }))}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                      <TextField
                        size="small"
                        label="E-number"
                        value={addAdminForm.staffNumber}
                        onChange={(e) => setAddAdminForm((p) => ({ ...p, staffNumber: e.target.value }))}
                        sx={{ flex: 1 }}
                      />
                      <Select
                        size="small"
                        value={addAdminForm.role}
                        onChange={(e) => setAddAdminForm((p) => ({ ...p, role: e.target.value as "admin" | "superadmin" }))}
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="superadmin">Superadmin</MenuItem>
                      </Select>
                    </Stack>
                    {addAdminError && <Alert severity="error">{addAdminError}</Alert>}
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        onClick={() => { setShowAddAdminForm(false); setAddAdminForm({ name: "", email: "", staffNumber: "", role: "admin" }); setAddAdminError(""); }}
                        sx={{ textTransform: "none" }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => void handleAddAdmin()}
                        disabled={addAdminSaving}
                        sx={{ backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#2e6159" }, textTransform: "none" }}
                      >
                        {addAdminSaving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Add Admin"}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Collapse>

              {adminManageError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAdminManageError("")}>{adminManageError}</Alert>
              )}

              {adminListLoading && (
                <Box display="flex" justifyContent="center" py={3}>
                  <CircularProgress size={28} />
                </Box>
              )}

              {adminListError && <Alert severity="error">{adminListError}</Alert>}

              {!adminListLoading && adminList.length > 0 && (
                <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #E5E1D7", borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: "#FDF9F1" }}>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>E-number</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Last Login</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {adminList.map((admin) => (
                        <TableRow key={admin.uid} sx={{ opacity: admin.active ? 1 : 0.55 }}>
                          <TableCell>{admin.name}</TableCell>
                          <TableCell sx={{ fontSize: "0.75rem" }}>{admin.email}</TableCell>
                          <TableCell>{admin.staffNumber.toUpperCase()}</TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={changedRoles[admin.uid] ?? admin.role}
                              onChange={(e) => setChangedRoles((prev) => ({ ...prev, [admin.uid]: e.target.value as "admin" | "superadmin" }))}
                              disabled={managingId === admin.uid || admin.uid === user?.uid}
                              sx={{ fontSize: "0.8rem", minWidth: 120 }}
                            >
                              <MenuItem value="admin">Admin</MenuItem>
                              <MenuItem value="superadmin">Superadmin</MenuItem>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: admin.active ? "#1A7A2E" : "#999", fontWeight: 600 }}>
                              {admin.active ? "Active" : "Inactive"}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                            {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : "Never"}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {changedRoles[admin.uid] && changedRoles[admin.uid] !== admin.role && (
                                <Tooltip title="Save role change">
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      disabled={managingId === admin.uid}
                                      onClick={() => void handleChangeRole(admin.uid)}
                                    >
                                      {managingId === admin.uid ? <CircularProgress size={16} /> : <SaveIcon fontSize="small" />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                              <Tooltip title={admin.uid === user?.uid ? "Cannot modify your own account" : admin.active ? "Deactivate" : "Reactivate"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color={admin.active ? "error" : "success"}
                                    disabled={managingId === admin.uid || admin.uid === user?.uid}
                                    onClick={() => void (admin.active ? handleDeactivate(admin.uid) : handleReactivate(admin.uid))}
                                  >
                                    {managingId === admin.uid
                                      ? <CircularProgress size={16} />
                                      : admin.active
                                        ? <RejectIcon fontSize="small" />
                                        : <ApproveIcon fontSize="small" />
                                    }
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}

          {/* ── App Settings Tab ── */}
          {superadminTab === 1 && (
            <Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Control which features are visible to admins in the CMS. The user-facing view is unaffected by all of these settings.
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, mb: 2 }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="#45443F" mb={1}>
                    Printer Table
                  </Typography>
                  <Stack spacing={0.5}>
                    <FormControlLabel
                      control={<Switch checked={appSettings.copyLink} onChange={(e) => handleToggleAppSetting("copyLink", e.target.checked)} />}
                      label="Copy Link"
                    />
                    <FormControlLabel
                      control={<Switch checked={appSettings.qrCode} onChange={(e) => handleToggleAppSetting("qrCode", e.target.checked)} />}
                      label="QR Code"
                    />
                    <FormControlLabel
                      control={<Switch checked={appSettings.canvasEmbed} onChange={(e) => handleToggleAppSetting("canvasEmbed", e.target.checked)} />}
                      label="Canvas LMS Embed"
                    />
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="#45443F" mb={1}>
                    Sidebar
                  </Typography>
                  <Stack spacing={0.5}>
                    <FormControlLabel
                      control={<Switch checked={appSettings.printerList} onChange={(e) => handleToggleAppSetting("printerList", e.target.checked)} />}
                      label="Printer List"
                    />
                    <FormControlLabel
                      control={<Switch checked={appSettings.fullPaperList} onChange={(e) => handleToggleAppSetting("fullPaperList", e.target.checked)} />}
                      label="Full Paper List"
                    />
                    <FormControlLabel
                      control={<Switch checked={appSettings.colourManagementList} onChange={(e) => handleToggleAppSetting("colourManagementList", e.target.checked)} />}
                      label="Colour Management List"
                    />
                  </Stack>
                </Box>
              </Box>

            </Box>
          )}

          {/* ── Statistics Tab ── */}
          {superadminTab === 2 && (
            <Box>
              {analyticsLoading && (
                <Box display="flex" justifyContent="center" alignItems="center" py={6}>
                  <CircularProgress size={32} />
                </Box>
              )}

              {!analyticsLoading && analyticsError && (
                <Alert severity="error" sx={{ mb: 2 }}>{analyticsError}</Alert>
              )}

              {!analyticsLoading && !analyticsError && analyticsData && (
                <Box>
                  {/* Summary cards */}
                  <Typography variant="subtitle1" fontWeight={600} mb={2}>Last 30 Days</Typography>
                  <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(140px, 1fr))" gap={2} mb={4}>
                    {[
                      { label: "Page Views", value: analyticsData.summary.pageViews.toLocaleString() },
                      { label: "Active Users", value: analyticsData.summary.activeUsers.toLocaleString() },
                      { label: "Sessions", value: analyticsData.summary.sessions.toLocaleString() },
                      { label: "Bounce Rate", value: `${(analyticsData.summary.bounceRate * 100).toFixed(1)}%` },
                      { label: "Avg Session", value: `${Math.floor(analyticsData.summary.avgSessionDuration / 60)}m ${Math.floor(analyticsData.summary.avgSessionDuration % 60)}s` },
                    ].map(({ label, value }) => (
                      <Box key={label} sx={{ border: "1px solid #E5E1D7", borderRadius: 2, p: 2, backgroundColor: "#FDF9F1" }}>
                        <Typography variant="h5" fontWeight={700} color="#3D8078">{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Daily trend — last 14 days */}
                  <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Daily Page Views (14 days)</Typography>
                  <Box sx={{ border: "1px solid #E5E1D7", borderRadius: 2, p: 2, mb: 4, backgroundColor: "#FDF9F1" }}>
                    {analyticsData.dailyViews.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>No data yet</Typography>
                    ) : (() => {
                      const max = Math.max(...analyticsData.dailyViews.map(d => d.views), 1);
                      return (
                        <Box display="flex" alignItems="flex-end" gap={0.5} height={80}>
                          {analyticsData.dailyViews.map(({ date, views }) => (
                            <Tooltip key={date} title={`${date}: ${views} views`} arrow>
                              <Box
                                flex={1}
                                sx={{
                                  height: `${Math.max((views / max) * 100, 4)}%`,
                                  backgroundColor: "#3D8078",
                                  borderRadius: "3px 3px 0 0",
                                  opacity: 0.85,
                                  cursor: "default",
                                  "&:hover": { opacity: 1 },
                                }}
                              />
                            </Tooltip>
                          ))}
                        </Box>
                      );
                    })()}
                  </Box>

                  {/* Top pages */}
                  <Typography variant="subtitle1" fontWeight={600} mb={1.5}>Top Pages (Last 30 Days)</Typography>
                  {analyticsData.topPages.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No page data yet</Typography>
                  ) : (
                    <TableContainer sx={{ border: "1px solid #E5E1D7", borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ backgroundColor: "#FDF9F1" }}>
                            <TableCell sx={{ fontWeight: 600 }}>Page</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Views</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, width: 120 }}>Share</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {analyticsData.topPages.map(({ path, views }) => {
                            const pct = analyticsData.summary.pageViews > 0
                              ? Math.round((views / analyticsData.summary.pageViews) * 100)
                              : 0;
                            return (
                              <TableRow key={path} hover>
                                <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{path}</TableCell>
                                <TableCell align="right">{views.toLocaleString()}</TableCell>
                                <TableCell align="right">
                                  <Box display="flex" alignItems="center" gap={1} justifyContent="flex-end">
                                    <Box sx={{ width: 60, height: 6, backgroundColor: "#E5E1D7", borderRadius: 1, overflow: "hidden" }}>
                                      <Box sx={{ width: `${pct}%`, height: "100%", backgroundColor: "#3D8078", borderRadius: 1 }} />
                                    </Box>
                                    <Typography variant="caption">{pct}%</Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {!analyticsLoading && !analyticsError && !analyticsData && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  No analytics data available.
                </Typography>
              )}
            </Box>
          )}

        </DialogContent>

        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1", gap: 1 }}>
          {superadminTab === 0 && (
            <Button
              onClick={() => { void loadPendingRequests(); void loadAdminList(); }}
              startIcon={<RefreshIcon />}
              size="small"
              sx={{ mr: "auto" }}
            >
              Refresh
            </Button>
          )}
          {superadminTab === 1 && (
            <Button
              size="small"
              startIcon={appSettingsSaving ? <CircularProgress size={14} /> : <SaveIcon />}
              onClick={() => void handleSaveAppSettings()}
              disabled={appSettingsSaving || JSON.stringify(appSettings) === JSON.stringify(savedAppSettings)}
              sx={{ mr: "auto" }}
            >
              {appSettingsSaved ? "✓ Saved" : "Save"}
            </Button>
          )}
          {superadminTab === 2 && (
            <Button
              onClick={() => { setAnalyticsData(null); void loadAnalytics(); }}
              startIcon={analyticsLoading ? <CircularProgress size={14} /> : <RefreshIcon />}
              disabled={analyticsLoading}
              size="small"
              sx={{ mr: "auto" }}
            >
              Refresh
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => { setShowSuperadminModal(false); setSuperadminTab(0); setPendingError(""); setAppSettings(savedAppSettings); }}
            sx={{ backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#2e6159" }, textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modals - Printers */}
      <Dialog
        open={showAddPrinterModal}
        onClose={() => {
          setShowAddPrinterModal(false);
          setNewPrinterName("");
          setNewPrinterDescription("");
          setNewPrinterThumbnail("");
          setNewPrinterThumbnailName("");
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>NEW PRINTER</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Box sx={{ mt: 8 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title={<><div>• Upload thumbnails in landscape for the best student experience.</div><div>• Format: jpeg, png &amp; gif</div><div>• Size: &lt;700kb</div></>}>
                  <InfoIcon sx={{ fontSize: 20, color: "text.secondary", cursor: "pointer" }} />
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewPrinterThumbnailUpload(e); }} />
              {imageUploadError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {imageUploadError}
                </Typography>
              )}
              {imageCompressed && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                  Image was compressed to meet the 700 KB limit.
                </Typography>
              )}
              {newPrinterThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {newPrinterThumbnailName}
                </Typography>
              )}
              {newPrinterThumbnail && (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
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
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CropIcon />}
                      onClick={() => openCropModal(newPrinterThumbnail, "printer")}
                      sx={{
                        color: "#3D8078",
                        borderColor: "#3D8078",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Crop
                    </Button>
                  </Box>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => {
              setShowAddPrinterModal(false);
              setNewPrinterName("");
              setNewPrinterDescription("");
              setNewPrinterThumbnail("");
              setNewPrinterThumbnailName("");
              setImageUploadError(null);
            }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleAddPrinterFromModal()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
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
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>EDIT PRINTER</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Box sx={{ mt: 8 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title={<><div>• Upload thumbnails in landscape for the best student experience.</div><div>• Format: jpeg, png &amp; gif</div><div>• Size: &lt;700kb</div></>}>
                  <InfoIcon sx={{ fontSize: 20, color: "text.secondary", cursor: "pointer" }} />
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditPrinterThumbnailUpload(e); }} />
              {imageUploadError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {imageUploadError}
                </Typography>
              )}
              {imageCompressed && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                  Image was compressed to meet the 700 KB limit.
                </Typography>
              )}
              {editPrinterThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editPrinterThumbnailName}
                </Typography>
              )}
              {editPrinterThumbnail && (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
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
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CropIcon />}
                      onClick={() => openCropModal(editPrinterThumbnail, "printer", true)}
                      sx={{
                        color: "#3D8078",
                        borderColor: "#3D8078",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Crop
                    </Button>
                  </Box>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => {
              setShowEditPrinterModal(false);
              setEditPrinterId(null);
              setEditPrinterName("");
              setEditPrinterDescription("");
              setEditPrinterThumbnail("");
              setEditPrinterThumbnailName("");
              setImageUploadError(null);
            }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleEditPrinter()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
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
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>NEW PAPER</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={0} sx={{ pt: 2 }}>
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
                      Search and reuse existing papers
                    </Typography>
                    <TextField
                      placeholder="Search papers by name..."
                      size="small"
                      fullWidth
                      value={paperSearchQuery}
                      onChange={(e) => setPaperSearchQuery(e.target.value)}
                      disabled={selectedSearchPaper !== null}
                      sx={{ mb: 2 }}
                    />

                    {/* Search Results */}
                    {paperSearchQuery && !selectedSearchPaper && (
                      <Box sx={{ maxHeight: 300, overflow: "auto", mb: 2 }}>
                        {allPapers.filter((paper) =>
                          paper.name.toLowerCase().includes(paperSearchQuery.toLowerCase())
                        ).length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                            No papers found
                          </Typography>
                        ) : (
                          <Stack spacing={1}>
                            {allPapers.filter((paper) =>
                              paper.name.toLowerCase().includes(paperSearchQuery.toLowerCase())
                            ).map((paper) => (
                              <Box
                                key={paper.id}
                                onClick={() => {
                                  setSelectedSearchPaper(paper);
                                  setPaperSearchQuery("");
                                }}
                                sx={{
                                  p: 1.5,
                                  border: "1px solid #E5E1D7",
                                  borderRadius: 1,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1.5,
                                  "&:hover": { backgroundColor: "#E5E1D7" },
                                }}
                              >
                                <Avatar
                                  src={paper.thumbnailDataUrl || undefined}
                                  alt={paper.name}
                                  sx={{ width: 40, height: 40 }}
                                >
                                  {paper.name.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="body2" fontWeight={600}>{paper.name}</Typography>
                                  {paper.description && (
                                    <Typography variant="caption" color="text.secondary">{paper.description}</Typography>
                                  )}
                                </Box>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    )}

                    {/* Selected Paper Display */}
                    {selectedSearchPaper && (
                      <Box sx={{ p: 1.5, border: "2px solid #1A7A2E", borderRadius: 1, mb: 2, backgroundColor: "#ebf3ec", display: "flex", alignItems: "center", gap: 1.5, justifyContent: "space-between" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1 }}>
                          <Avatar
                            src={selectedSearchPaper.thumbnailDataUrl || undefined}
                            alt={selectedSearchPaper.name}
                            sx={{ width: 40, height: 40 }}
                          >
                            {selectedSearchPaper.name.charAt(0).toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{selectedSearchPaper.name}</Typography>
                            {selectedSearchPaper.description && (
                              <Typography variant="caption" color="text.secondary">{selectedSearchPaper.description}</Typography>
                            )}
                          </Box>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedSearchPaper(null);
                            setSelectedSearchPaperPrinters([]);
                            setPaperSearchQuery("");
                          }}
                          sx={{ color: "#666" }}
                        >
                          ✕
                        </IconButton>
                      </Box>
                    )}

                    {/* Printer Selection for Selected Paper */}
                    {selectedSearchPaper && (
                      <Box>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 2 }}>
                          {addPaperFromFullList ? "Select Printers for this Paper" : "Add to Printer"}
                        </Typography>
                        <Stack spacing={1}>
                          {(addPaperFromFullList ? tutorialState.printers : (selectedPrinter ? [selectedPrinter] : [])).map((printer) => (
                            <FormControlLabel
                              key={printer.id}
                              control={
                                <Checkbox
                                  checked={selectedSearchPaperPrinters.includes(printer.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSearchPaperPrinters([...selectedSearchPaperPrinters, printer.id]);
                                    } else {
                                      setSelectedSearchPaperPrinters(selectedSearchPaperPrinters.filter((id) => id !== printer.id));
                                    }
                                  }}
                                />
                              }
                              label={printer.name}
                            />
                          ))}
                        </Stack>
                        {selectedSearchPaperPrinters.length === 0 && (
                          <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                            Select at least one printer
                          </Typography>
                        )}
                      </Box>
                    )}
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
                  <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewPaperThumbnailUpload(e); }} />
                  {imageUploadError && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                      {imageUploadError}
                    </Typography>
                  )}
                  {newPaperThumbnailName && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Selected: {newPaperThumbnailName}
                    </Typography>
                  )}
                  {newPaperThumbnail && (
                    <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                      <Box sx={{ position: "relative", display: "inline-block" }}>
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
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CropIcon />}
                          onClick={() => openCropModal(newPaperThumbnail, "paper")}
                          sx={{
                            color: "#3D8078",
                            borderColor: "#3D8078",
                            textTransform: "none",
                            fontWeight: 600,
                          }}
                        >
                          Crop
                        </Button>
                      </Box>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => {
              setShowAddPaperModal(false);
              setNewPaperName("");
              setNewPaperDescription("");
              setNewPaperThumbnail("");
              setNewPaperThumbnailName("");
              setNewPaperSelectedPrinters([]);
              setShowAddPaperSearch(true);
              setAddPaperFromFullList(false);
              setSelectedSearchPaper(null);
              setSelectedSearchPaperPrinters([]);
              setPaperSearchQuery("");
              setImageUploadError(null);
            }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          {(!showAddPaperSearch || selectedSearchPaper) && (
            <Button
              onClick={() => {
                if (selectedSearchPaper) {
                  void handleAddExistingPaperToModal();
                } else {
                  void handleAddPaperFromModal();
                }
              }}
              variant="contained"
              disabled={loading || (selectedSearchPaper ? selectedSearchPaperPrinters.length === 0 : newPaperSelectedPrinters.length === 0)}
              sx={{
                backgroundColor: "#3D8078",
                color: "#ffffff",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": { backgroundColor: "#2D6059" },
                "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
              }}
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
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>EDIT PAPER</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Box sx={{ mt: 8 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title={<><div>• Upload thumbnails in landscape for the best student experience.</div><div>• Format: jpeg, png &amp; gif</div><div>• Size: &lt;700kb</div></>}>
                  <InfoIcon sx={{ fontSize: 20, color: "text.secondary", cursor: "pointer" }} />
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditPaperThumbnailUpload(e); }} />
              {imageUploadError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {imageUploadError}
                </Typography>
              )}
              {imageCompressed && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                  Image was compressed to meet the 700 KB limit.
                </Typography>
              )}
              {editPaperThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editPaperThumbnailName}
                </Typography>
              )}
              {editPaperThumbnail && (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
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
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CropIcon />}
                      onClick={() => openCropModal(editPaperThumbnail, "paper", true)}
                      sx={{
                        color: "#3D8078",
                        borderColor: "#3D8078",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Crop
                    </Button>
                  </Box>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => {
              setShowEditPaperModal(false);
              setEditPaperId(null);
              setEditPaperName("");
              setEditPaperDescription("");
              setEditPaperThumbnail("");
              setEditPaperThumbnailName("");
              setEditPaperSelectedPrinters([]);
              setImageUploadError(null);
            }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleEditPaper()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
          >
            {loading ? "Saving..." : "SAVE"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={showPaperInfoModal}
        onClose={() => setShowPaperInfoModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>PAPER INFO</DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => setShowPaperInfoModal(false)}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Printer Info Modal */}
      <Dialog
        open={showPrinterInfoModal}
        onClose={() => setShowPrinterInfoModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>PRINTER INFO</DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>
          {infoPrinterId && (() => {
            const printer = tutorialState.printers.find((p) => p.id === infoPrinterId);
            return printer ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{printer.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Modified
                  </Typography>
                  <Typography variant="body1">
                    {printer.lastModified ? new Date(printer.lastModified).toLocaleString() : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Modified By
                  </Typography>
                  <Typography variant="body1">{printer.modifiedBy || "N/A"}</Typography>
                </Box>
              </Stack>
            ) : null;
          })()}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => setShowPrinterInfoModal(false)}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Colour Info Modal */}
      <Dialog
        open={showColourInfoModal}
        onClose={() => setShowColourInfoModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>COLOUR INFO</DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>
          {infoColourId && (() => {
            // Look up the colour from the global papers list
            let colour = null;
            for (const paper of tutorialState.papers) {
              const found = paper.colours.find((c) => c.id === infoColourId);
              if (found) {
                colour = found;
                break;
              }
            }
            return colour ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{colour.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Modified
                  </Typography>
                  <Typography variant="body1">
                    {colour.lastModified ? new Date(colour.lastModified).toLocaleString() : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Modified By
                  </Typography>
                  <Typography variant="body1">{colour.modifiedBy || "N/A"}</Typography>
                </Box>
              </Stack>
            ) : null;
          })()}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => setShowColourInfoModal(false)}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Embed in Canvas LMS Dialog */}
      <Dialog
        open={Boolean(embedPrinter)}
        onClose={() => setEmbedPrinter(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#3D8078", fontSize: "1.1rem" }}>
                Embed in Canvas LMS
              </Typography>
              {embedPrinter && (
                <Typography variant="body2" color="text.secondary">{embedPrinter.name}</Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>
          {embedPrinter && (() => {
            const embedUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/?printer=${embedPrinter.slug}`;
            const iframeCode = `<iframe src="${embedUrl}" width="${embedWidth}" height="${embedHeight}px" frameborder="0" allowfullscreen allow="fullscreen; accelerometer; gyroscope; vr" style="border:none;"></iframe>`;
            const handlePreset = (value: string) => {
              const [w, h] = value.split("x");
              setEmbedWidth(w);
              setEmbedHeight(h);
            };
            return (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Width</Typography>
                    <TextField size="small" fullWidth value={embedWidth} onChange={(e) => setEmbedWidth(e.target.value)} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Height (px)</Typography>
                    <TextField size="small" fullWidth value={embedHeight} onChange={(e) => setEmbedHeight(e.target.value)} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Preset</Typography>
                    <TextField
                      select
                      size="small"
                      fullWidth
                      value={`${embedWidth}x${embedHeight}`}
                      onChange={(e) => handlePreset(e.target.value)}
                    >
                      <MenuItem value="100%x600">Full width</MenuItem>
                      <MenuItem value="800x600">800×600</MenuItem>
                      <MenuItem value="1280x720">1280×720 (HD)</MenuItem>
                      <MenuItem value="100%x500">Full width short</MenuItem>
                    </TextField>
                  </Box>
                </Stack>
                <Box sx={{ backgroundColor: "#f9f9f9", borderRadius: 2, border: "1px solid #E5E1D7", p: 2 }}>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", whiteSpace: "pre-wrap", color: "#45443F" }}>
                    {iframeCode}
                  </Typography>
                </Box>
                <Box sx={{ backgroundColor: "#EEF2FF", borderRadius: 2, p: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "#3730a3", mb: 1 }}>How to embed in Canvas LMS:</Typography>
                  <Box component="ol" sx={{ pl: 2, m: 0, color: "#3730a3" }}>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>Open your Canvas page or assignment in Edit mode</Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>Click <strong>Insert → Embed</strong> (or the HTML editor <code>&lt;/&gt;</code> button)</Typography>
                    <Typography component="li" variant="body2">Paste the code and save</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: "#4338ca", mt: 1, fontSize: "0.8rem" }}>
                    This URL is permanent — uploading a new version won&apos;t break existing embeds.
                  </Typography>
                </Box>
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1", gap: 1 }}>
          {embedPrinter && (() => {
            const embedUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/?printer=${embedPrinter.slug}`;
            const iframeCode = `<iframe src="${embedUrl}" width="${embedWidth}" height="${embedHeight}px" frameborder="0" allowfullscreen allow="fullscreen; accelerometer; gyroscope; vr" style="border:none;"></iframe>`;
            return (
              <>
                <Button
                  variant="contained"
                  sx={{ flex: 1, backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#2e6159" }, textTransform: "none", fontWeight: 600 }}
                  onClick={() => {
                    void navigator.clipboard.writeText(iframeCode);
                    setEmbedCopied(true);
                    setTimeout(() => setEmbedCopied(false), 2000);
                  }}
                >
                  {embedCopied ? "Copied!" : "Copy Embed Code"}
                </Button>
                <Button onClick={() => setEmbedPrinter(null)} sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}>
                  Close
                </Button>
              </>
            );
          })()}
        </DialogActions>
      </Dialog>

      {/* QR Code Preview Dialog */}
      <Dialog
        open={Boolean(qrPrinter)}
        onClose={() => { setQrPrinter(null); setQrCanvasDataUrl(null); }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#3D8078", fontSize: "1.1rem" }}>
                QR Code
              </Typography>
              {qrPrinter && (
                <Typography variant="body2" color="text.secondary">{qrPrinter.name}</Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff", display: "flex", justifyContent: "center" }}>
          {qrCanvasDataUrl && (
            <Box component="img" src={qrCanvasDataUrl} alt="QR Code preview" sx={{ width: "100%", maxWidth: 340, borderRadius: 1, border: "1px solid #E5E1D7" }} />
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1", gap: 1 }}>
          <Button
            variant="contained"
            sx={{ flex: 1, backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#2e6159" }, textTransform: "none", fontWeight: 600 }}
            onClick={() => { downloadQR(); setQrPrinter(null); setQrCanvasDataUrl(null); }}
          >
            Download
          </Button>
          <Button onClick={() => { setQrPrinter(null); setQrCanvasDataUrl(null); }} sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy Link Dialog */}
      <Dialog
        open={Boolean(copyLinkPrinter)}
        onClose={() => setCopyLinkPrinter(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", py: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "#3D8078", fontSize: "1.1rem" }}>
                Copy Link
              </Typography>
              {copyLinkPrinter && (
                <Typography variant="body2" color="text.secondary">{copyLinkPrinter.name}</Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>
          {copyLinkPrinter && (
            <Box sx={{ backgroundColor: "#f9f9f9", borderRadius: 2, border: "1px solid #E5E1D7", p: 2 }}>
              <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem", wordBreak: "break-all", color: "#45443F" }}>
                {`${typeof window !== "undefined" ? window.location.origin : ""}/?printer=${copyLinkPrinter.slug}`}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1", gap: 1 }}>
          {copyLinkPrinter && (
            <>
              <Button
                variant="contained"
                sx={{ flex: 1, backgroundColor: "#3D8078", "&:hover": { backgroundColor: "#2e6159" }, textTransform: "none", fontWeight: 600 }}
                onClick={() => {
                  const url = `${window.location.origin}/?printer=${copyLinkPrinter.slug}`;
                  void navigator.clipboard.writeText(url);
                  setCopyLinkCopied(true);
                  setTimeout(() => setCopyLinkCopied(false), 2000);
                }}
              >
                {copyLinkCopied ? "Copied!" : "Copy Link"}
              </Button>
              <Button onClick={() => setCopyLinkPrinter(null)} sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}>
                Close
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Step Info Modal */}
      <Dialog
        open={showStepInfoModal}
        onClose={() => setShowStepInfoModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>STEP INFO</DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", backgroundColor: "#ffffff" }}>
          {infoStepId && (() => {
            const step = selectedColor?.steps.find((s) => s.id === infoStepId);
            return step ? (
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Name
                  </Typography>
                  <Typography variant="body1">{step.title}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last Modified
                  </Typography>
                  <Typography variant="body1">
                    {step.lastModified ? new Date(step.lastModified).toLocaleString() : "N/A"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Modified By
                  </Typography>
                  <Typography variant="body1">{step.modifiedBy || "N/A"}</Typography>
                </Box>
              </Stack>
            ) : null;
          })()}
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => setShowStepInfoModal(false)}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Close
          </Button>
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
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>NEW COLOUR</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Box sx={{ mt: 8 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title={<><div>• Upload thumbnails in landscape for the best student experience.</div><div>• Format: jpeg, png &amp; gif</div><div>• Size: &lt;700kb</div></>}>
                  <InfoIcon sx={{ fontSize: 20, color: "text.secondary", cursor: "pointer" }} />
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewColourThumbnailUpload(e); }} />
              {imageUploadError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {imageUploadError}
                </Typography>
              )}
              {imageCompressed && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                  Image was compressed to meet the 700 KB limit.
                </Typography>
              )}
              {newColourThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {newColourThumbnailName}
                </Typography>
              )}
              {newColourThumbnail && (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
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
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CropIcon />}
                      onClick={() => openCropModal(newColourThumbnail, "color")}
                      sx={{
                        color: "#3D8078",
                        borderColor: "#3D8078",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Crop
                    </Button>
                  </Box>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => {
              setShowAddColourModal(false);
              setNewColourName("");
              setNewColourDescription("");
              setNewColourThumbnail("");
              setNewColourThumbnailName("");
              setImageUploadError(null);
              setImageCompressed(false);
            }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleAddColourFromModal()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
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
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>EDIT COLOUR</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Box sx={{ mt: 8 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  Thumbnail
                </Typography>
                <Tooltip title={<><div>• Upload thumbnails in landscape for the best student experience.</div><div>• Format: jpeg, png &amp; gif</div><div>• Size: &lt;700kb</div></>}>
                  <InfoIcon sx={{ fontSize: 20, color: "text.secondary", cursor: "pointer" }} />
                </Tooltip>
              </Stack>
              <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditColourThumbnailUpload(e); }} />
              {imageUploadError && (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {imageUploadError}
                </Typography>
              )}
              {imageCompressed && (
                <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                  Image was compressed to meet the 700 KB limit.
                </Typography>
              )}
              {editColourThumbnailName && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Selected: {editColourThumbnailName}
                </Typography>
              )}
              {editColourThumbnail && (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                  <Box sx={{ position: "relative", display: "inline-block" }}>
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
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CropIcon />}
                      onClick={() => openCropModal(editColourThumbnail, "color", true)}
                      sx={{
                        color: "#3D8078",
                        borderColor: "#3D8078",
                        textTransform: "none",
                        fontWeight: 600,
                      }}
                    >
                      Crop
                    </Button>
                  </Box>
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
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => {
              setShowEditColourModal(false);
              setEditColourId(null);
              setEditColourName("");
              setEditColourDescription("");
              setEditColourThumbnail("");
              setEditColourThumbnailName("");
              setImageUploadError(null);
              setImageCompressed(false);
            }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleEditColour()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
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
          setNewStepVideoUrl("");
          setNewStepMediaType("image");
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>Step {(selectedColor?.steps?.length ?? 0) + 1}</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              label="Title"
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              required
              fullWidth
              variant="outlined"
              size="small"
            />

            <RichHtmlEditor
              label="Content"
              value={newStepContent}
              onChange={setNewStepContent}
            />

            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Media</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant={newStepMediaType === "image" ? "contained" : "outlined"}
                  startIcon={<ImagePlaceholderIcon />}
                  onClick={() => { setNewStepMediaType("image"); setNewStepVideoUrl(""); }}
                  sx={{ textTransform: "none", fontWeight: 600, ...(newStepMediaType === "image" ? { backgroundColor: "#3D8078", color: "#fff", "&:hover": { backgroundColor: "#2D6059" } } : { color: "#3D8078", borderColor: "#3D8078" }) }}
                >
                  Image
                </Button>
                <Button
                  size="small"
                  variant={newStepMediaType === "video" ? "contained" : "outlined"}
                  startIcon={<LinkIcon />}
                  onClick={() => { setNewStepMediaType("video"); setNewStepImage(""); setNewStepImageName(""); setImageUploadError(null); setImageCompressed(false); }}
                  sx={{ textTransform: "none", fontWeight: 600, ...(newStepMediaType === "video" ? { backgroundColor: "#3D8078", color: "#fff", "&:hover": { backgroundColor: "#2D6059" } } : { color: "#3D8078", borderColor: "#3D8078" }) }}
                >
                  Video URL
                </Button>
              </Stack>
              {newStepMediaType === "image" && (
                <>
                  <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleNewStepImageUpload(e); }} />
                  {imageUploadError && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                      {imageUploadError}
                    </Typography>
                  )}
                  {imageCompressed && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                      Image was compressed to meet the 700 KB limit.
                    </Typography>
                  )}
                  {newStepImageName && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Selected: {newStepImageName}
                    </Typography>
                  )}
                  {newStepImage && (
                    <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                      <Box sx={{ position: "relative", display: "inline-block" }}>
                        <Box
                          component="img"
                          src={newStepImage}
                          alt="Step image preview"
                          sx={{ width: 220, maxWidth: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => { setNewStepImage(""); setNewStepImageName(""); }}
                          sx={{ position: "absolute", top: 0, right: 0, bgcolor: "rgba(255, 255, 255, 0.9)", "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" } }}
                        >
                          ✕
                        </IconButton>
                      </Box>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CropIcon />}
                          onClick={() => openCropModal(newStepImage, "step")}
                          sx={{ color: "#3D8078", borderColor: "#3D8078", textTransform: "none", fontWeight: 600 }}
                        >
                          Crop
                        </Button>
                      </Box>
                    </Box>
                  )}
                </>
              )}
              {newStepMediaType === "video" && (
                <Stack spacing={1.5}>
                  <TextField
                    label="Video URL"
                    placeholder="YouTube, Vimeo, or direct .mp4 link"
                    value={newStepVideoUrl}
                    onChange={(e) => setNewStepVideoUrl(e.target.value)}
                    fullWidth
                    size="small"
                    variant="outlined"
                  />
                  {getVideoEmbedUrl(newStepVideoUrl) && (
                    <Box sx={{ position: "relative" }}>
                      {/\.(mp4|webm|ogg)(\?.*)?$/i.test(newStepVideoUrl) ? (
                        <Box component="video" controls src={newStepVideoUrl} sx={{ width: "100%", borderRadius: 1 }} />
                      ) : (
                        <Box sx={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 1, overflow: "hidden" }}>
                          <Box
                            component="iframe"
                            src={getVideoEmbedUrl(newStepVideoUrl)!}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          />
                        </Box>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => setNewStepVideoUrl("")}
                        sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                      >
                        ✕
                      </IconButton>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => { setShowAddStepModal(false); setNewStepVideoUrl(""); setNewStepMediaType("image"); setImageUploadError(null); setImageCompressed(false); }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleAddStepFromModal()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
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
          setEditStepVideoUrl("");
          setEditStepMediaType("image");
          setImageUploadError(null);
          setImageCompressed(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)" } }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>Step {Math.max(1, (selectedColor?.steps?.findIndex((s) => s.id === editStepId) ?? -1) + 1)}</DialogTitle>
        <DialogContent sx={{ pt: 16, backgroundColor: "#ffffff" }}>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              label="Title"
              value={editStepTitle}
              onChange={(e) => setEditStepTitle(e.target.value)}
              required
              fullWidth
              variant="outlined"
              size="small"
            />

            <RichHtmlEditor
              label="Content"
              value={editStepContent}
              onChange={setEditStepContent}
            />

            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Media</Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <Button
                  size="small"
                  variant={editStepMediaType === "image" ? "contained" : "outlined"}
                  startIcon={<ImagePlaceholderIcon />}
                  onClick={() => { setEditStepMediaType("image"); setEditStepVideoUrl(""); }}
                  sx={{ textTransform: "none", fontWeight: 600, ...(editStepMediaType === "image" ? { backgroundColor: "#3D8078", color: "#fff", "&:hover": { backgroundColor: "#2D6059" } } : { color: "#3D8078", borderColor: "#3D8078" }) }}
                >
                  Image
                </Button>
                <Button
                  size="small"
                  variant={editStepMediaType === "video" ? "contained" : "outlined"}
                  startIcon={<LinkIcon />}
                  onClick={() => { setEditStepMediaType("video"); setEditStepImage(""); setEditStepImageName(""); setImageUploadError(null); setImageCompressed(false); }}
                  sx={{ textTransform: "none", fontWeight: 600, ...(editStepMediaType === "video" ? { backgroundColor: "#3D8078", color: "#fff", "&:hover": { backgroundColor: "#2D6059" } } : { color: "#3D8078", borderColor: "#3D8078" }) }}
                >
                  Video URL
                </Button>
              </Stack>
              {editStepMediaType === "image" && (
                <>
                  <Box component="input" type="file" accept="image/jpeg,image/png,image/gif" onChange={(e: ChangeEvent<HTMLInputElement>) => { void handleEditStepImageUpload(e); }} />
                  {imageUploadError && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                      {imageUploadError}
                    </Typography>
                  )}
                  {imageCompressed && (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "#f59e0b" }}>
                      Image was compressed to meet the 700 KB limit.
                    </Typography>
                  )}
                  {editStepImageName && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Selected: {editStepImageName}
                    </Typography>
                  )}
                  {editStepImage && (
                    <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
                      <Box sx={{ position: "relative", display: "inline-block" }}>
                        <Box
                          component="img"
                          src={editStepImage}
                          alt="Step image preview"
                          sx={{ width: 220, maxWidth: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => { setEditStepImage(""); setEditStepImageName(""); }}
                          sx={{ position: "absolute", top: 0, right: 0, bgcolor: "rgba(255, 255, 255, 0.9)", "&:hover": { bgcolor: "rgba(255, 255, 255, 1)" } }}
                        >
                          ✕
                        </IconButton>
                      </Box>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CropIcon />}
                          onClick={() => openCropModal(editStepImage, "step", true)}
                          sx={{ color: "#3D8078", borderColor: "#3D8078", textTransform: "none", fontWeight: 600 }}
                        >
                          Crop
                        </Button>
                      </Box>
                    </Box>
                  )}
                </>
              )}
              {editStepMediaType === "video" && (
                <Stack spacing={1.5}>
                  <TextField
                    label="Video URL"
                    placeholder="YouTube, Vimeo, or direct .mp4 link"
                    value={editStepVideoUrl}
                    onChange={(e) => setEditStepVideoUrl(e.target.value)}
                    fullWidth
                    size="small"
                    variant="outlined"
                  />
                  {getVideoEmbedUrl(editStepVideoUrl) && (
                    <Box sx={{ position: "relative" }}>
                      {/\.(mp4|webm|ogg)(\?.*)?$/i.test(editStepVideoUrl) ? (
                        <Box component="video" controls src={editStepVideoUrl} sx={{ width: "100%", borderRadius: 1 }} />
                      ) : (
                        <Box sx={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 1, overflow: "hidden" }}>
                          <Box
                            component="iframe"
                            src={getVideoEmbedUrl(editStepVideoUrl)!}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          />
                        </Box>
                      )}
                      <IconButton
                        size="small"
                        onClick={() => setEditStepVideoUrl("")}
                        sx={{ position: "absolute", top: 4, right: 4, bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}
                      >
                        ✕
                      </IconButton>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1" }}>
          <Button
            onClick={() => { setShowEditStepModal(false); setEditStepVideoUrl(""); setEditStepMediaType("image"); setImageUploadError(null); setImageCompressed(false); }}
            sx={{ color: "#3D8078", fontWeight: 600, textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleEditStep()}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "#3D8078",
              color: "#ffffff",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { backgroundColor: "#2D6059" },
              "&:disabled": { backgroundColor: "#FFFFFF", color: "#ffffff" }
            }}
          >
            {loading ? "Saving..." : "SAVE"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Step Image Enlargement Modal */}
      <Modal
        open={enlargedStepImageUrl !== null}
        onClose={() => setEnlargedStepImageUrl(null)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(0, 0, 0, 0.7)",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: { xs: "90%", sm: "80%", md: "70%" },
            maxWidth: "900px",
            maxHeight: "90vh",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {enlargedStepImageUrl && (
            <img
              src={enlargedStepImageUrl}
              alt="Enlarged step image"
              style={{
                width: "100%",
                height: "auto",
                objectFit: "contain",
              }}
            />
          )}
        </Box>
      </Modal>

      {/* Image Crop Modal */}
      <Dialog
        open={cropModalOpen}
        onClose={closeCropModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "visible",
          }
        }}
      >
        <DialogTitle sx={{ backgroundColor: "#FDF9F1", borderBottom: "2px solid #E5E1D7", fontWeight: 700, color: "#3D8078", fontSize: "1.1rem", py: 2.5 }}>
          Crop Image
        </DialogTitle>
        <DialogContent sx={{ paddingTop: "24px !important", pb: 3, backgroundColor: "#ffffff" }}>
          <Box sx={{ mb: 3 }}>
            {cropImage && (
              <Box
                ref={cropContainerRef}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "4 / 3",
                  overflow: "auto",
                  borderRadius: 1,
                  border: "1px solid #E5E1D7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FDF9F1",
                  userSelect: "none",
                  cursor: isDraggingCrop ? "grabbing" : "grab",
                }}
              >
                <Box
                  component="img"
                  src={cropImage}
                  alt="Crop preview"
                  onLoad={() => setCropImgReady(true)}
                  sx={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    display: "block",
                  }}
                />

                {/* Crop Box Overlay */}
                {cropImageWidth > 0 && cropImageHeight > 0 && cropImgReady && (() => {
                  const imgElements = cropContainerRef.current?.querySelectorAll('img');
                  if (!imgElements || imgElements.length === 0) return null;
                  const imgElement = imgElements[0] as HTMLImageElement;
                  const containerRect = cropContainerRef.current?.getBoundingClientRect();
                  const imgRect = imgElement.getBoundingClientRect();

                  if (!containerRect || !imgRect) return null;

                  const displayedImageWidth = imgRect.width;
                  const displayedImageHeight = imgRect.height;
                  const imgOffsetX = imgRect.left - containerRect.left + (cropContainerRef.current?.scrollLeft || 0);
                  const imgOffsetY = imgRect.top - containerRect.top + (cropContainerRef.current?.scrollTop || 0);

                  const scaleX = displayedImageWidth / cropImageWidth;
                  const scaleY = displayedImageHeight / cropImageHeight;

                  const cropBoxPixelX = imgOffsetX + cropBoxX * scaleX;
                  const cropBoxPixelY = imgOffsetY + cropBoxY * scaleY;
                  const cropBoxPixelWidth = cropBoxWidth * scaleX;
                  const cropBoxPixelHeight = cropBoxHeight * scaleY;

                  return (
                    <>
                      <Box
                        onMouseDown={(e: React.MouseEvent) => handleCropMouseDown(e)}
                        sx={{
                          position: "absolute",
                          left: `${cropBoxPixelX}px`,
                          top: `${cropBoxPixelY}px`,
                          width: `${cropBoxPixelWidth}px`,
                          height: `${cropBoxPixelHeight}px`,
                          border: "2px solid #3D8078",
                          backgroundColor: "rgba(61, 128, 120, 0.1)",
                          cursor: isDraggingCrop ? "grabbing" : "grab",
                          boxSizing: "border-box",
                        }}
                      >
                        {/* Corner resize handles */}
                        <Box
                          sx={{
                            position: "absolute",
                            width: 12,
                            height: 12,
                            backgroundColor: "#3D8078",
                            borderRadius: "50%",
                            bottom: -6,
                            right: -6,
                            cursor: "se-resize",
                            zIndex: 10,
                          }}
                          onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => handleCropMouseDown(e as React.MouseEvent, "se")}
                        />
                      </Box>

                      {/* Dark overlay outside crop area */}
                      <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, height: `${cropBoxPixelY}px`, backgroundColor: "rgba(0, 0, 0, 0.5)", pointerEvents: "none" }} />
                      <Box sx={{ position: "absolute", top: `${cropBoxPixelY}px`, left: 0, width: `${cropBoxPixelX}px`, height: `${cropBoxPixelHeight}px`, backgroundColor: "rgba(0, 0, 0, 0.5)", pointerEvents: "none" }} />
                      <Box sx={{ position: "absolute", top: `${cropBoxPixelY}px`, left: `${cropBoxPixelX + cropBoxPixelWidth}px`, right: 0, height: `${cropBoxPixelHeight}px`, backgroundColor: "rgba(0, 0, 0, 0.5)", pointerEvents: "none" }} />
                      <Box sx={{ position: "absolute", top: `${cropBoxPixelY + cropBoxPixelHeight}px`, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", pointerEvents: "none" }} />
                    </>
                  );
                })()}
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag the crop box to reposition it. Click and drag the bottom-right handle to resize freely (no aspect ratio constraint).
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid #E5E1D7", pt: 2, pb: 2, px: 3, backgroundColor: "#FDF9F1", display: "flex", justifyContent: "space-between" }}>
          <IconButton
            onClick={resetCropBox}
            title="Reset crop box"
            sx={{ color: "#3D8078" }}
          >
            <RefreshIcon />
          </IconButton>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              onClick={closeCropModal}
              sx={{
                color: "#3D8078",
                borderColor: "#3D8078",
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={applyCrop}
              variant="contained"
              sx={{
                backgroundColor: "#3D8078",
                color: "#ffffff",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { backgroundColor: "#2D6059" },
              }}
            >
              Apply Crop
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Canvas elements for image processing (hidden) */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <canvas ref={cropCanvasRef} style={{ display: "none" }} />

      {/* Context Menus */}
      <Menu
        anchorEl={printerMenuAnchor}
        open={Boolean(printerMenuAnchor)}
        onClose={handlePrinterMenuClose}
      >
        <MenuItem onClick={handlePrinterMenuEdit}>Edit</MenuItem>
        <MenuItem onClick={handlePrinterMenuInfo}>Information</MenuItem>
        <Divider />
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
            <MenuItem onClick={handlePaperMenuInfo}>Information</MenuItem>
            <Divider />
            <MenuItem onClick={handlePaperMenuDelete} sx={{ color: "error.main" }}>
              Delete
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem onClick={handlePaperMenuEdit}>Edit</MenuItem>
            <MenuItem onClick={handlePaperMenuInfo}>Information</MenuItem>
            <Divider />
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
        <MenuItem onClick={handleColourMenuInfo}>Information</MenuItem>
        <Divider />
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
        <MenuItem onClick={handleStepMenuInfo}>Information</MenuItem>
        <Divider />
        <MenuItem onClick={handleStepMenuDelete} sx={{ color: "error.main" }}>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
