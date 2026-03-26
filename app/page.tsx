"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Grid,
  Stack,
  Modal,
  Fab,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeIcon from "@mui/icons-material/Home";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ImageIcon from "@mui/icons-material/Image";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

type Step = {
  id: string;
  name: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  videoUrl?: string;
};

function getVideoEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return url;
  return null;
}

type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  steps: Step[];
  published?: boolean;
};

type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  colours: Colour[];
  published?: boolean;
};

type Printer = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  papers: Paper[];
  published?: boolean;
};

type SectionSetting = { title: string; subtitle: string };
type SectionSettings = {
  printers: SectionSetting;
  papers: SectionSetting;
  colours: SectionSetting;
};

type TutorialState = {
  printers: Printer[];
  homepageTitle?: string;
  homepageDescription?: string;
  sectionSettings?: SectionSettings;
};

const emptyState: TutorialState = { printers: [] };
const PROGRESS_KEY = "printing_guide_progress_v1";

function preloadImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let loaded = 0;
    const total = urls.length;
    function onDone() {
      loaded++;
      if (loaded >= total) resolve();
    }
    for (const url of urls) {
      const img = new window.Image();
      img.onload = onDone;
      img.onerror = onDone;
      img.src = url;
    }
  });
}

// Color palette - Modern minimalist aesthetic
const colors = {
  primary: "#009DC9",
  darkBg: "#001F2D",
  lightBg: "#FAFBFC",
  border: "#003549",
  lightBorder: "#E8EAED",
  text: "#001F2D",
  lightText: "#6B7280",
  cardBg: "#FFFFFF",
  cardShadow: "0 2px 8px rgba(0, 31, 45, 0.08)",
  cardShadowHover: "0 8px 16px rgba(0, 31, 45, 0.12)",
};

function sanitizeStepHtml(content: string): string {
  return content
    .replace(/<(?!\/?(p|br|ul|ol|li|b|strong|i|em|h3|a)(\s+[^>]*)?>)[^>]*>/gi, "")
    .replace(/<a\s+[^>]*href=(\"|')(.*?)\1[^>]*>/gi, (_match, _quote, href: string) => {
      const safeHref = /^(https?:\/\/|mailto:)/i.test(href) ? href : "#";
      return `<a href="${safeHref}" target="_blank" rel="noreferrer">`;
    });
}

export default function HomePage() {
  const [data, setData] = useState<TutorialState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedColourId, setSelectedColourId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [enlargedStepImageUrl, setEnlargedStepImageUrl] = useState<string | null>(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const stepCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visibleStepsRef = useRef(new Set<number>());

  useEffect(() => {
    const stored = window.localStorage.getItem(PROGRESS_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        printerId?: string;
        paperId?: string;
        colourId?: string;
        stepIndex?: number;
      };

      setSelectedPrinterId(parsed.printerId ?? null);
      setSelectedPaperId(parsed.paperId ?? null);
      setSelectedColourId(parsed.colourId ?? null);
    } catch {
      window.localStorage.removeItem(PROGRESS_KEY);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(window.location.search);
        const previewToken = params.get("previewToken");
        const urlPrinterId = params.get("printerId");
        const urlPaperId = params.get("paperId");
        const urlColourId = params.get("colourId");

        // Read localStorage to determine initial view for image preloading
        let localPrinterId: string | null = null;
        let localPaperId: string | null = null;
        let localColourId: string | null = null;
        try {
          const stored = window.localStorage.getItem(PROGRESS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as { printerId?: string; paperId?: string; colourId?: string };
            localPrinterId = parsed.printerId ?? null;
            localPaperId = parsed.paperId ?? null;
            localColourId = parsed.colourId ?? null;
          }
        } catch { /* ignore */ }

        const url = previewToken
          ? `/api/tutorial?previewToken=${encodeURIComponent(previewToken)}`
          : "/api/tutorial";

        const response = await fetch(url, { cache: "no-store" });
        const result = (await response.json()) as { state: TutorialState; isPreviewMode?: boolean } | { error: string };

        if (!response.ok || ("error" in result)) {
          setError("Could not load guide data.");
          return;
        }

        const isPreview = "isPreviewMode" in result && result.isPreviewMode;
        const initPrinterId = isPreview ? (urlPrinterId ?? null) : localPrinterId;
        const initPaperId = isPreview ? (urlPaperId ?? null) : localPaperId;
        const initColourId = isPreview ? (urlColourId ?? null) : localColourId;

        // Collect image URLs for the initial view only
        const state = result.state;
        let imageUrls: string[] = [];
        const initPrinter = state.printers.find((p) => p.id === initPrinterId) ?? null;
        if (!initPrinter) {
          // Printer selection view
          imageUrls = state.printers
            .filter((p) => isPreview || p.published !== false)
            .map((p) => p.thumbnailDataUrl)
            .filter(Boolean);
        } else {
          const initPaper = initPrinter.papers.find((p) => p.id === initPaperId) ?? null;
          if (!initPaper) {
            // Paper selection view
            imageUrls = initPrinter.papers
              .filter((p) => isPreview || p.published !== false)
              .map((p) => p.thumbnailDataUrl)
              .filter(Boolean);
          } else {
            const initColour = initPaper.colours.find((c) => c.id === initColourId) ?? null;
            if (!initColour) {
              // Colour selection view
              imageUrls = initPaper.colours
                .filter((c) => isPreview || c.published !== false)
                .map((c) => c.thumbnailDataUrl)
                .filter(Boolean);
            } else {
              // Steps view — preload first step image only
              const firstStep = initColour.steps[0];
              if (firstStep?.imageDataUrl) {
                imageUrls = [firstStep.imageDataUrl];
              }
            }
          }
        }

        await preloadImages(imageUrls);

        setData(state);

        if (isPreview) {
          setIsPreviewMode(true);
          if (urlPrinterId) setSelectedPrinterId(urlPrinterId);
          if (urlPaperId) setSelectedPaperId(urlPaperId);
          if (urlColourId) setSelectedColourId(urlColourId);
        }
      } catch {
        setError("Could not load guide data.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const selectedPrinter = useMemo(
    () => data.printers.find((printer) => printer.id === selectedPrinterId) ?? null,
    [data.printers, selectedPrinterId],
  );

  const selectedPaper = useMemo(
    () => selectedPrinter?.papers.find((paper) => paper.id === selectedPaperId) ?? null,
    [selectedPaperId, selectedPrinter],
  );

  const selectedColour = useMemo(
    () => selectedPaper?.colours.find((colour) => colour.id === selectedColourId) ?? null,
    [selectedColourId, selectedPaper],
  );

  const steps = selectedColour?.steps ?? [];
  useEffect(() => {
    if (selectedPrinterId && !selectedPrinter) {
      setSelectedPrinterId(null);
      setSelectedPaperId(null);
      setSelectedColourId(null);
      setActiveStepIndex(0);
      return;
    }

    if (selectedPaperId && !selectedPaper) {
      setSelectedPaperId(null);
      setSelectedColourId(null);
      setActiveStepIndex(0);
      return;
    }

    if (selectedColourId && !selectedColour) {
      setSelectedColourId(null);
      setActiveStepIndex(0);
      return;
    }

    if (activeStepIndex >= steps.length && steps.length > 0) {
      setActiveStepIndex(steps.length - 1);
    }
  }, [
    activeStepIndex,
    selectedColour,
    selectedColourId,
    selectedPaper,
    selectedPaperId,
    selectedPrinter,
    selectedPrinterId,
    steps.length,
  ]);

  useEffect(() => {
    if (isPreviewMode) return;
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColourId,
      }),
    );
  }, [isPreviewMode, selectedColourId, selectedPaperId, selectedPrinterId]);

  function resetToHome() {
    setSelectedPrinterId(null);
    setSelectedPaperId(null);
    setSelectedColourId(null);
    setActiveStepIndex(0);
  }

  function backOneLevel() {
    if (selectedColourId) {
      setSelectedColourId(null);
      setActiveStepIndex(0);
      return;
    }

    if (selectedPaperId) {
      setSelectedPaperId(null);
      return;
    }

    if (selectedPrinterId) {
      setSelectedPrinterId(null);
    }
  }

  function selectPrinter(printerId: string) {
    setSelectedPrinterId(printerId);
    setSelectedPaperId(null);
    setSelectedColourId(null);
    setActiveStepIndex(0);
  }

  function selectPaper(paperId: string) {
    setSelectedPaperId(paperId);
    setSelectedColourId(null);
    setActiveStepIndex(0);
  }

  function selectColour(colourId: string) {
    setSelectedColourId(colourId);
    setActiveStepIndex(0);
  }

  const showingPrinterSelection = !selectedPrinter;
  const showingPaperSelection = !!selectedPrinter && !selectedPaper;
  const showingColourSelection = !!selectedPaper && !selectedColour;
  const showingSteps = !!selectedColour;

  const hasPrinters = data.printers.length > 0;
  const hasPapers = (selectedPrinter?.papers.length ?? 0) > 0;
  const hasColours = (selectedPaper?.colours.length ?? 0) > 0;

  useEffect(() => {
    if (!showingSteps) return;
    visibleStepsRef.current.clear();
    const refs = stepCardRefs.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number(entry.target.getAttribute("data-step-index"));
          if (entry.isIntersecting) {
            visibleStepsRef.current.add(index);
          } else {
            visibleStepsRef.current.delete(index);
          }
        });
        const visible = [...visibleStepsRef.current].sort((a, b) => a - b);
        if (visible.length > 0) setActiveStepIndex(visible[0]);
      },
      { threshold: 0.2 },
    );
    refs.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [showingSteps, steps.length]);

  useEffect(() => {
    if (!showingSteps) return;
    function onScroll() { setShowBackToTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showingSteps]);

  const previewBanner = isPreviewMode ? (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        bgcolor: "#E65100",
        color: "#ffffff",
        textAlign: "center",
        py: 0.75,
        px: 2,
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      PREVIEW MODE — Includes unpublished content
    </Box>
  ) : null;

  // LOADING SCREEN
  if (loading) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          bgcolor: colors.lightBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          {/* MD3 track ring */}
          <CircularProgress
            variant="determinate"
            value={100}
            size={48}
            thickness={4}
            sx={{ color: "rgba(0, 157, 201, 0.15)" }}
          />
          {/* MD3 indicator with rounded caps */}
          <CircularProgress
            size={48}
            thickness={4}
            sx={{
              color: colors.primary,
              position: "absolute",
              left: 0,
              "& .MuiCircularProgress-circle": {
                strokeLinecap: "round",
              },
            }}
          />
        </Box>
      </Box>
    );
  }

  // RENDER HOME PAGE (PRINTER SELECTION)
  if (showingPrinterSelection) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 }, pt: isPreviewMode ? { xs: "calc(2rem + 36px)", sm: "calc(2.5rem + 36px)", md: "calc(3.5rem + 36px)" } : undefined }}>
        {previewBanner}
        <Container maxWidth="md">
          {/* Header */}
          <Stack spacing={2} sx={{ mb: { xs: 5, sm: 6, md: 8 }, textAlign: "center" }}>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: "2.25rem", sm: "2.75rem", md: "3.5rem" },
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: colors.text,
              }}
            >
              {data.homepageTitle || "Printing Guide"}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "1rem", sm: "1.125rem" },
                color: colors.lightText,
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              {data.homepageDescription || "Step-by-step guidance for achieving perfect prints with every paper type."}
            </Typography>
          </Stack>

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Empty State */}
          {!error && !hasPrinters && (
            <Alert severity="info">No printers available yet. Add your first printer in Admin.</Alert>
          )}

          {/* Printer Selection Grid */}
          {!error && hasPrinters && (
            <Box>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: "0.95rem", sm: "1.05rem" },
                  color: colors.text,
                  mb: { xs: 3, sm: 4 },
                  fontWeight: 500,
                  textAlign: "center",
                  letterSpacing: "0.01em",
                }}
              >
                {data.sectionSettings?.printers?.subtitle || "Select a printer to begin:"}
              </Typography>

              <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                {data.printers
                  .filter((printer) => isPreviewMode || printer.published !== false)
                  .map((printer) => (
                  <Grid item xs={12} sm={6} md={4} key={printer.id}>
                    <Card
                      onClick={() => selectPrinter(printer.id)}
                      sx={{
                        cursor: "pointer",
                        height: "100%",
                        borderRadius: "8px",
                        border: isPreviewMode && printer.published === false ? "2px solid #E65100" : "none",
                        backgroundColor: colors.cardBg,
                        boxShadow: colors.cardShadow,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": {
                          boxShadow: colors.cardShadowHover,
                          transform: "translateY(-4px)",
                        },
                        "&:active": {
                          transform: "translateY(-2px)",
                        },
                      }}
                    >
                      {/* Image */}
                      <Box
                        sx={{
                          position: "relative",
                          width: "100%",
                          paddingBottom: "66.67%",
                          overflow: "hidden",
                          bgcolor: "#f5f5f5",
                        }}
                      >
                        {printer.thumbnailDataUrl ? (
                          <Image
                            src={printer.thumbnailDataUrl}
                            alt={printer.name}
                            fill
                            style={{ objectFit: "cover" }}
                            sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                          />
                        ) : (
                          <Box
                            sx={{
                              position: "absolute",
                              inset: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: "#e8f4f8",
                            }}
                          >
                            <ImageIcon sx={{ color: "#b0c4cc", fontSize: 40 }} />
                          </Box>
                        )}
                      </Box>

                      {/* Content */}
                      <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Typography
                            variant="h6"
                            sx={{
                              fontSize: { xs: "1rem", sm: "1.1rem" },
                              fontWeight: 600,
                              color: colors.text,
                              flex: 1,
                              lineHeight: 1.4,
                            }}
                          >
                            {printer.name}
                          </Typography>
                          {printer.description && (
                            <Tooltip title={printer.description} arrow placement="top">
                              <IconButton
                                size="small"
                                sx={{
                                  color: colors.primary,
                                  width: 24,
                                  height: 24,
                                  "&:hover": { bgcolor: `rgba(0, 157, 201, 0.1)` },
                                }}
                              >
                                <InfoIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Container>
      </Box>
    );
  }

  // RENDER PAPER SELECTION PAGE
  if (showingPaperSelection) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 }, pt: isPreviewMode ? { xs: "calc(2rem + 36px)", sm: "calc(2.5rem + 36px)", md: "calc(3.5rem + 36px)" } : undefined }}>
        {previewBanner}
        <Container maxWidth="md">
          {/* Top Navigation */}
          <Stack direction="row" spacing={1.5} sx={{ mb: { xs: 4, sm: 5 }, alignItems: "center" }}>
            <IconButton
              onClick={backOneLevel}
              sx={{
                color: colors.text,
                border: `1px solid ${colors.lightBorder}`,
                borderRadius: "6px",
                transition: "all 0.2s ease",
                "&:hover": { bgcolor: colors.lightBorder },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="body2"
              sx={{
                fontSize: { xs: "0.85rem", sm: "0.95rem" },
                fontWeight: 500,
                color: colors.lightText,
                flex: 1,
                textAlign: "center",
              }}
            >
              {selectedPrinter?.name}
            </Typography>
            <IconButton
              onClick={resetToHome}
              sx={{
                color: colors.text,
                border: `1px solid ${colors.lightBorder}`,
                borderRadius: "6px",
                transition: "all 0.2s ease",
                "&:hover": { bgcolor: colors.lightBorder },
              }}
            >
              <HomeIcon />
            </IconButton>
          </Stack>

          {/* Header */}
          <Stack spacing={2} sx={{ mb: { xs: 4, sm: 5 }, textAlign: "center" }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: colors.text,
              }}
            >
              {data.sectionSettings?.papers?.title || "Paper Selection"}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                color: colors.lightText,
                lineHeight: 1.5,
              }}
            >
              {data.sectionSettings?.papers?.subtitle || "Choose your paper type to continue:"}
            </Typography>
          </Stack>

          {/* Empty State */}
          {!hasPapers && (
            <Alert severity="info">No papers yet for this printer. Add first paper in Admin.</Alert>
          )}

          {/* Paper Selection Grid */}
          {hasPapers && (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {selectedPrinter?.papers
                .filter((paper) => isPreviewMode || paper.published !== false)
                .map((paper) => (
                <Grid item xs={12} sm={6} md={4} key={paper.id}>
                  <Card
                    onClick={() => selectPaper(paper.id)}
                    sx={{
                      cursor: "pointer",
                      height: "100%",
                      borderRadius: "8px",
                      border: isPreviewMode && paper.published === false ? "2px solid #E65100" : "none",
                      backgroundColor: colors.cardBg,
                      boxShadow: colors.cardShadow,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        boxShadow: colors.cardShadowHover,
                        transform: "translateY(-4px)",
                      },
                      "&:active": {
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    {/* Image */}
                    <Box
                      sx={{
                        position: "relative",
                        width: "100%",
                        paddingBottom: "66.67%",
                        overflow: "hidden",
                        bgcolor: "#f5f5f5",
                      }}
                    >
                      {paper.thumbnailDataUrl ? (
                        <Image
                          src={paper.thumbnailDataUrl}
                          alt={paper.name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                        />
                      ) : (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "#e8f4f8",
                          }}
                        >
                          <ImageIcon sx={{ color: "#b0c4cc", fontSize: 40 }} />
                        </Box>
                      )}
                    </Box>

                    {/* Content */}
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Typography
                          variant="h6"
                          sx={{
                            fontSize: { xs: "1rem", sm: "1.1rem" },
                            fontWeight: 600,
                            color: colors.text,
                            flex: 1,
                            lineHeight: 1.4,
                          }}
                        >
                          {paper.name}
                        </Typography>
                        {paper.description && (
                          <Tooltip title={paper.description} arrow placement="top">
                            <IconButton
                              size="small"
                              sx={{
                                color: colors.primary,
                                width: 24,
                                height: 24,
                                "&:hover": { bgcolor: `rgba(0, 157, 201, 0.1)` },
                              }}
                            >
                              <InfoIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>
    );
  }

  // RENDER COLOUR MANAGEMENT PAGE
  if (showingColourSelection) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 }, pt: isPreviewMode ? { xs: "calc(2rem + 36px)", sm: "calc(2.5rem + 36px)", md: "calc(3.5rem + 36px)" } : undefined }}>
        {previewBanner}
        <Container maxWidth="md">
          {/* Top Navigation */}
          <Stack direction="row" spacing={1.5} sx={{ mb: { xs: 4, sm: 5 }, alignItems: "center" }}>
            <IconButton
              onClick={backOneLevel}
              sx={{
                color: colors.text,
                border: `1px solid ${colors.lightBorder}`,
                borderRadius: "6px",
                transition: "all 0.2s ease",
                "&:hover": { bgcolor: colors.lightBorder },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Stack spacing={0.25} sx={{ flex: 1, textAlign: "center" }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: { xs: "0.85rem", sm: "0.95rem" },
                  fontWeight: 500,
                  color: colors.lightText,
                }}
              >
                {selectedPrinter?.name}
              </Typography>
              {selectedPaper && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: { xs: "0.75rem", sm: "0.8rem" },
                    fontWeight: 600,
                    color: colors.primary,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {selectedPaper.name}
                </Typography>
              )}
            </Stack>
            <IconButton
              onClick={resetToHome}
              sx={{
                color: colors.text,
                border: `1px solid ${colors.lightBorder}`,
                borderRadius: "6px",
                transition: "all 0.2s ease",
                "&:hover": { bgcolor: colors.lightBorder },
              }}
            >
              <HomeIcon />
            </IconButton>
          </Stack>

          {/* Header */}
          <Stack spacing={2} sx={{ mb: { xs: 4, sm: 5 }, textAlign: "center" }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: colors.text,
              }}
            >
              {data.sectionSettings?.colours?.title || "Colour Management"}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                color: colors.lightText,
                lineHeight: 1.5,
              }}
            >
              {data.sectionSettings?.colours?.subtitle || "I want to preserve:"}
            </Typography>
          </Stack>

          {/* Empty State */}
          {!hasColours && (
            <Alert severity="info">No colours yet for this paper. Add first colour in Admin.</Alert>
          )}

          {/* Colour Selection Grid */}
          {hasColours && (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {selectedPaper?.colours
                .filter((colour) => isPreviewMode || colour.published !== false)
                .map((colour) => (
                <Grid item xs={12} sm={6} md={4} key={colour.id}>
                  <Card
                    onClick={() => selectColour(colour.id)}
                    sx={{
                      cursor: "pointer",
                      height: "100%",
                      borderRadius: "8px",
                      border: isPreviewMode && colour.published === false ? "2px solid #E65100" : "none",
                      backgroundColor: colors.cardBg,
                      boxShadow: colors.cardShadow,
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        boxShadow: colors.cardShadowHover,
                        transform: "translateY(-4px)",
                      },
                      "&:active": {
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    {/* Image */}
                    <Box
                      sx={{
                        position: "relative",
                        width: "100%",
                        paddingBottom: "66.67%",
                        overflow: "hidden",
                        bgcolor: "#f5f5f5",
                      }}
                    >
                      {colour.thumbnailDataUrl ? (
                        <Image
                          src={colour.thumbnailDataUrl}
                          alt={colour.name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                        />
                      ) : (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "#e8f4f8",
                          }}
                        >
                          <ImageIcon sx={{ color: "#b0c4cc", fontSize: 40 }} />
                        </Box>
                      )}
                    </Box>

                    {/* Content */}
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Stack spacing={1.5}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontSize: { xs: "1rem", sm: "1.1rem" },
                            fontWeight: 600,
                            color: colors.text,
                            lineHeight: 1.4,
                          }}
                        >
                          {colour.name}
                        </Typography>
                        {colour.description && (
                          <Box
                            component="ul"
                            sx={{
                              m: 0,
                              pl: 2,
                              fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              color: colors.lightText,
                              lineHeight: 1.4,
                            }}
                          >
                            {colour.description.split("\n").filter(Boolean).map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>
    );
  }

  // RENDER STEPS DISPLAY PAGE
  if (showingSteps && steps.length > 0) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg }}>
        {previewBanner}
        {/* Blue Border Accent at Top */}
        <Box sx={{ height: 3, bgcolor: colors.primary, mt: isPreviewMode ? "36px" : 0 }} />

        <Box sx={{ py: { xs: 4, sm: 5, md: 7 } }}>
          <Container maxWidth="md">
            {/* Top Navigation — scrolls off screen */}
            <Stack direction="row" spacing={1.5} sx={{ mb: { xs: 4, sm: 5 }, alignItems: "center" }}>
              <IconButton
                onClick={backOneLevel}
                sx={{
                  color: colors.text,
                  border: `1px solid ${colors.lightBorder}`,
                  borderRadius: "6px",
                  transition: "all 0.2s ease",
                  "&:hover": { bgcolor: colors.lightBorder },
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <Stack spacing={0.25} sx={{ flex: 1, textAlign: "center" }}>
                <Typography
                  variant="body2"
                  sx={{ fontSize: { xs: "0.85rem", sm: "0.95rem" }, fontWeight: 500, color: colors.lightText }}
                >
                  {selectedPrinter?.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ fontSize: { xs: "0.75rem", sm: "0.8rem" }, fontWeight: 600, color: colors.primary, letterSpacing: "0.05em", textTransform: "uppercase" }}
                >
                  {selectedPaper?.name}
                </Typography>
              </Stack>
              <IconButton
                onClick={resetToHome}
                sx={{ color: colors.text, border: `1px solid ${colors.lightBorder}`, borderRadius: "6px", transition: "all 0.2s ease", "&:hover": { bgcolor: colors.lightBorder } }}
              >
                <HomeIcon />
              </IconButton>
            </Stack>

            {/* Sticky header: Colour Name + Step Counter */}
            <Box
              sx={{
                position: "sticky",
                top: isPreviewMode ? "36px" : 0,
                zIndex: 10,
                bgcolor: colors.lightBg,
                pb: 2,
                pt: 1,
                mb: { xs: 2, sm: 3 },
                textAlign: "center",
              }}
            >
              <Typography
                variant="h2"
                sx={{ fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" }, fontWeight: 800, letterSpacing: "-0.02em", color: colors.text, mb: 1 }}
              >
                {selectedColour?.name}
              </Typography>
              <Typography
                variant="body1"
                sx={{ fontSize: { xs: "0.9rem", sm: "1rem" }, fontWeight: 600, color: colors.text, letterSpacing: "0.05em" }}
              >
                STEP {steps.length === 0 ? 0 : activeStepIndex + 1} OF {steps.length}
              </Typography>
            </Box>

            {/* All Step Cards */}
            <Stack spacing={{ xs: 3, sm: 4 }} sx={{ pb: { xs: 6, sm: 8 } }}>
              {steps.map((step, index) => (
                <Card
                  key={step.id}
                  ref={(el) => { stepCardRefs.current[index] = el; }}
                  data-step-index={index}
                  sx={{ borderRadius: "8px", border: "none", backgroundColor: colors.cardBg, boxShadow: colors.cardShadow, overflow: "hidden" }}
                >
                  <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                    {/* Step Number and Title */}
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: { xs: 2, sm: 2.5 } }}>
                      <Box
                        sx={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 40, height: 40, bgcolor: colors.darkBg, color: colors.lightBg,
                          fontWeight: 700, borderRadius: 1, fontSize: "1.1rem", flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </Box>
                      {step.title && (
                        <Typography variant="h6" sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, fontWeight: 600, color: colors.primary }}>
                          {step.title}
                        </Typography>
                      )}
                    </Stack>

                    {/* Step Content */}
                    {step.contentHtml && (
                      <Box
                        sx={{
                          fontSize: { xs: "0.95rem", sm: "1rem" }, color: colors.text, lineHeight: 1.6,
                          mb: { xs: 2, sm: 3 }, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          "& p": { mb: 1 }, "& ul, & ol": { pl: 2, mb: 1 }, "& li": { mb: 0.5 },
                          "& strong, & b": { fontWeight: 700 }, "& em, & i": { fontStyle: "italic" },
                          "& a": { color: colors.primary, textDecoration: "underline", "&:hover": { opacity: 0.8 } },
                        }}
                        dangerouslySetInnerHTML={{ __html: sanitizeStepHtml(step.contentHtml) }}
                      />
                    )}

                    {/* Step Media */}
                    {step.videoUrl && getVideoEmbedUrl(step.videoUrl) ? (
                      /\.(mp4|webm|ogg)(\?.*)?$/i.test(step.videoUrl) ? (
                        <Box component="video" controls sx={{ width: "100%", borderRadius: 1 }}>
                          <source src={step.videoUrl} />
                        </Box>
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
                      )
                    ) : step.imageDataUrl ? (
                      <Box
                        onClick={() => setEnlargedStepImageUrl(step.imageDataUrl)}
                        sx={{
                          position: "relative", width: "100%", paddingBottom: "60%",
                          overflow: "hidden", borderRadius: 1, bgcolor: "#f5f5f5",
                          cursor: "pointer", transition: "all 0.2s ease",
                          "&:hover": { boxShadow: colors.cardShadowHover },
                        }}
                      >
                        <Image
                          src={step.imageDataUrl}
                          alt={step.title || step.name}
                          fill
                          style={{ objectFit: "contain" }}
                          sizes="(max-width: 600px) 100vw, (max-width: 960px) 90vw, 800px"
                        />
                      </Box>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </Stack>

            {/* Shared Image Enlarge Modal */}
            <Modal
              open={!!enlargedStepImageUrl}
              onClose={() => { setEnlargedStepImageUrl(null); setImgZoom(1); }}
              sx={{ display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0, 0, 0, 0.85)" }}
            >
              <Box sx={{ outline: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                {/* Scrollable image */}
                <Box sx={{ overflow: "auto", maxWidth: "90vw", maxHeight: "80vh", borderRadius: "8px", bgcolor: "#111", lineHeight: 0 }}>
                  {enlargedStepImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={enlargedStepImageUrl}
                      alt="Step image"
                      style={{ display: "block", width: `${imgZoom * 100}%`, height: "auto", cursor: imgZoom > 1 ? "zoom-out" : "zoom-in" }}
                      onClick={() => setImgZoom(z => z > 1 ? 1 : 1.5)}
                    />
                  )}
                </Box>
                {/* Zoom controls */}
                <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: "rgba(0,0,0,0.6)", borderRadius: 2, px: 1.5, py: 0.5 }}>
                  <IconButton size="small" onClick={() => setImgZoom(z => Math.max(1, z - 0.5))} disabled={imgZoom <= 1} sx={{ color: "white" }}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="caption" sx={{ color: "white", minWidth: 36, textAlign: "center" }}>
                    {Math.round(imgZoom * 100)}%
                  </Typography>
                  <IconButton size="small" onClick={() => setImgZoom(z => Math.min(1.5, z + 0.5))} disabled={imgZoom >= 1.5} sx={{ color: "white" }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Modal>
          </Container>
        </Box>

        {/* Back to Top FAB */}
        {showBackToTop && (
          <Fab
            size="small"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            sx={{
              position: "fixed", bottom: 72, right: 24, zIndex: 20,
              bgcolor: colors.primary, color: "#ffffff",
              "&:hover": { bgcolor: colors.darkBg },
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          >
            <KeyboardArrowUpIcon />
          </Fab>
        )}
      </Box>
    );
  }

  // PLACEHOLDER FOR EMPTY STATE
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography>No content to display</Typography>
    </Box>
  );
}
