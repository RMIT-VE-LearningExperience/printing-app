"use client";

import Image from "next/image";
import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Grid,
  Stack,
  Modal,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeIcon from "@mui/icons-material/Home";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

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

type TutorialState = {
  printers: Printer[];
};

const emptyState: TutorialState = { printers: [] };
const PROGRESS_KEY = "printing_guide_progress_v1";

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

  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedColourId, setSelectedColourId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

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
      setActiveStepIndex(Number.isFinite(parsed.stepIndex) ? Math.max(0, parsed.stepIndex ?? 0) : 0);
    } catch {
      window.localStorage.removeItem(PROGRESS_KEY);
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/tutorial", { cache: "no-store" });
        const result = (await response.json()) as { state: TutorialState } | { error: string };

        if (!response.ok || ("error" in result)) {
          setError("Could not load guide data.");
          return;
        }

        setData(result.state);
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
  const activeStep = steps[activeStepIndex] ?? null;

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
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        printerId: selectedPrinterId,
        paperId: selectedPaperId,
        colourId: selectedColourId,
        stepIndex: activeStepIndex,
      }),
    );
  }, [activeStepIndex, selectedColourId, selectedPaperId, selectedPrinterId]);

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

  function goPrevStep() {
    setActiveStepIndex((value) => Math.max(0, value - 1));
  }

  function goNextStep() {
    setActiveStepIndex((value) => Math.min(steps.length - 1, value + 1));
  }

  function handleStepTouchStart(event: TouchEvent<HTMLElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleStepTouchEnd(event: TouchEvent<HTMLElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;

    if (startX === null || endX === null) {
      return;
    }

    const deltaX = startX - endX;
    if (Math.abs(deltaX) < 50) {
      return;
    }

    if (deltaX > 0) {
      goNextStep();
      return;
    }

    goPrevStep();
  }

  const showingPrinterSelection = !selectedPrinter;
  const showingPaperSelection = !!selectedPrinter && !selectedPaper;
  const showingColourSelection = !!selectedPaper && !selectedColour;
  const showingSteps = !!selectedColour;

  const hasPrinters = data.printers.length > 0;
  const hasPapers = (selectedPrinter?.papers.length ?? 0) > 0;
  const hasColours = (selectedPaper?.colours.length ?? 0) > 0;
  const hasSteps = steps.length > 0;

  useEffect(() => {
    if (!showingSteps || !hasSteps) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveStepIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveStepIndex((value) => Math.min(steps.length - 1, value + 1));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showingSteps, hasSteps, steps.length]);

  // RENDER HOME PAGE (PRINTER SELECTION)
  if (showingPrinterSelection) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 } }}>
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

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress sx={{ color: colors.primary }} />
            </Box>
          )}

          {/* Error State */}
          {error && !loading && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Empty State */}
          {!loading && !error && !hasPrinters && (
            <Alert severity="info">No printers available yet. Add your first printer in Admin.</Alert>
          )}

          {/* Printer Selection Grid */}
          {!loading && !error && hasPrinters && (
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
                Select a printer to begin:
              </Typography>

              <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                {data.printers
                  .filter((printer) => printer.published !== false)
                  .map((printer) => (
                  <Grid item xs={12} sm={6} md={4} key={printer.id}>
                    <Card
                      onClick={() => selectPrinter(printer.id)}
                      sx={{
                        cursor: "pointer",
                        height: "100%",
                        borderRadius: "8px",
                        border: "none",
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
                      {printer.thumbnailDataUrl && (
                        <Box
                          sx={{
                            position: "relative",
                            width: "100%",
                            paddingBottom: "66.67%",
                            overflow: "hidden",
                            bgcolor: "#f5f5f5",
                          }}
                        >
                          <Image
                            src={printer.thumbnailDataUrl}
                            alt={printer.name}
                            fill
                            style={{ objectFit: "cover" }}
                            sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                          />
                        </Box>
                      )}

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
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 } }}>
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
              Paper Selection
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                color: colors.lightText,
                lineHeight: 1.5,
              }}
            >
              Choose your paper type to continue:
            </Typography>
          </Stack>

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress sx={{ color: colors.primary }} />
            </Box>
          )}

          {/* Empty State */}
          {!loading && !hasPapers && (
            <Alert severity="info">No papers yet for this printer. Add first paper in Admin.</Alert>
          )}

          {/* Paper Selection Grid */}
          {!loading && hasPapers && (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {selectedPrinter?.papers
                .filter((paper) => paper.published !== false)
                .map((paper) => (
                <Grid item xs={12} sm={6} md={4} key={paper.id}>
                  <Card
                    onClick={() => selectPaper(paper.id)}
                    sx={{
                      cursor: "pointer",
                      height: "100%",
                      borderRadius: "8px",
                      border: "none",
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
                    {paper.thumbnailDataUrl && (
                      <Box
                        sx={{
                          position: "relative",
                          width: "100%",
                          paddingBottom: "66.67%",
                          overflow: "hidden",
                          bgcolor: "#f5f5f5",
                        }}
                      >
                        <Image
                          src={paper.thumbnailDataUrl}
                          alt={paper.name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                        />
                      </Box>
                    )}

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
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg, py: { xs: 4, sm: 5, md: 7 } }}>
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
              Colour Management
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.95rem", sm: "1.05rem" },
                color: colors.lightText,
                lineHeight: 1.5,
              }}
            >
              I want to preserve:
            </Typography>
          </Stack>

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress sx={{ color: colors.primary }} />
            </Box>
          )}

          {/* Empty State */}
          {!loading && !hasColours && (
            <Alert severity="info">No colours yet for this paper. Add first colour in Admin.</Alert>
          )}

          {/* Colour Selection Grid */}
          {!loading && hasColours && (
            <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
              {selectedPaper?.colours
                .filter((colour) => colour.published !== false)
                .map((colour) => (
                <Grid item xs={12} sm={6} md={4} key={colour.id}>
                  <Card
                    onClick={() => selectColour(colour.id)}
                    sx={{
                      cursor: "pointer",
                      height: "100%",
                      borderRadius: "8px",
                      border: "none",
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
                    {colour.thumbnailDataUrl && (
                      <Box
                        sx={{
                          position: "relative",
                          width: "100%",
                          paddingBottom: "66.67%",
                          overflow: "hidden",
                          bgcolor: "#f5f5f5",
                        }}
                      >
                        <Image
                          src={colour.thumbnailDataUrl}
                          alt={colour.name}
                          fill
                          style={{ objectFit: "cover" }}
                          sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 33vw"
                        />
                      </Box>
                    )}

                    {/* Content */}
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Stack spacing={1.5}>
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
                            {colour.name}
                          </Typography>
                          {colour.description && (
                            <Tooltip title={colour.description} arrow placement="top">
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
                        {colour.description && (
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: { xs: "0.85rem", sm: "0.9rem" },
                              color: colors.lightText,
                              lineHeight: 1.4,
                            }}
                          >
                            {colour.description}
                          </Typography>
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
  if (showingSteps && activeStep) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: colors.lightBg }}>
        {/* Blue Border Accent at Top */}
        <Box sx={{ height: 3, bgcolor: colors.primary }} />

        <Box sx={{ py: { xs: 4, sm: 5, md: 7 } }}>
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
                  {selectedPaper?.name}
                </Typography>
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

            {/* Colour Name as Title */}
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "1.75rem", sm: "2.25rem", md: "2.5rem" },
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: colors.text,
                mb: { xs: 4, sm: 5 },
                textAlign: "center",
              }}
            >
              {selectedColour?.name}
            </Typography>

            {/* Progress Indicator */}
            <Stack
              direction="column"
              spacing={{ xs: 1.5, sm: 2 }}
              sx={{
                mb: { xs: 3, sm: 4 },
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  fontWeight: 600,
                  color: colors.text,
                  letterSpacing: "0.05em",
                }}
              >
                STEP {steps.length === 0 ? 0 : activeStepIndex + 1} OF {steps.length}
              </Typography>

              {/* Progress Dots */}
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {steps.map((step, index) => (
                  <Box
                    key={step.id}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: index === activeStepIndex ? colors.primary : colors.lightBorder,
                      transition: "all 0.2s ease",
                    }}
                  />
                ))}
              </Stack>
            </Stack>

            {/* Step Card */}
            <Card
              sx={{
                borderRadius: "8px",
                border: "none",
                backgroundColor: colors.cardBg,
                boxShadow: colors.cardShadow,
                mb: { xs: 4, sm: 5 },
                overflow: "hidden",
              }}
              onTouchStart={handleStepTouchStart}
              onTouchEnd={handleStepTouchEnd}
            >
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                {/* Step Number and Title */}
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: { xs: 2, sm: 2.5 } }}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 40,
                      height: 40,
                      bgcolor: colors.darkBg,
                      color: colors.lightBg,
                      fontWeight: 700,
                      borderRadius: 1,
                      fontSize: "1.1rem",
                      flexShrink: 0,
                    }}
                  >
                    {activeStepIndex + 1}
                  </Box>

                  {/* Step Title */}
                  {activeStep.title && (
                    <Typography
                      variant="h6"
                      sx={{
                        fontSize: { xs: "1rem", sm: "1.1rem" },
                        fontWeight: 600,
                        color: colors.primary,
                      }}
                    >
                      {activeStep.title}
                    </Typography>
                  )}
                </Stack>

                {/* Step Content */}
                {activeStep.contentHtml && (
                  <Box
                    sx={{
                      fontSize: { xs: "0.95rem", sm: "1rem" },
                      color: colors.text,
                      lineHeight: 1.6,
                      mb: { xs: 2, sm: 3 },
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      "& p": { mb: 1 },
                      "& ul, & ol": { pl: 2, mb: 1 },
                      "& li": { mb: 0.5 },
                      "& strong, & b": { fontWeight: 700 },
                      "& em, & i": { fontStyle: "italic" },
                      "& a": {
                        color: colors.primary,
                        textDecoration: "underline",
                        "&:hover": { opacity: 0.8 },
                      },
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitizeStepHtml(activeStep.contentHtml) }}
                  />
                )}

                {/* Step Image */}
                {activeStep.imageDataUrl && (
                  <>
                    <Box
                      onClick={() => setIsImageEnlarged(true)}
                      sx={{
                        position: "relative",
                        width: "100%",
                        paddingBottom: "60%",
                        overflow: "hidden",
                        borderRadius: 1,
                        bgcolor: "#f5f5f5",
                        mb: { xs: 2, sm: 3 },
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          boxShadow: colors.cardShadowHover,
                        },
                      }}
                    >
                      <Image
                        src={activeStep.imageDataUrl}
                        alt={activeStep.title || activeStep.name}
                        fill
                        style={{ objectFit: "contain" }}
                        sizes="(max-width: 600px) 100vw, (max-width: 960px) 90vw, 800px"
                      />
                    </Box>

                    {/* Image Modal */}
                    <Modal
                      open={isImageEnlarged}
                      onClose={() => setIsImageEnlarged(false)}
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
                        <Image
                          src={activeStep.imageDataUrl}
                          alt={activeStep.title || activeStep.name}
                          width={900}
                          height={600}
                          style={{
                            width: "100%",
                            height: "auto",
                            objectFit: "contain",
                          }}
                        />
                      </Box>
                    </Modal>
                  </>
                )}

                {/* Navigation Chevrons */}
                <Stack direction="row" spacing={2} sx={{ mt: { xs: 3, sm: 4 }, justifyContent: "center" }}>
                  <IconButton
                    onClick={goPrevStep}
                    disabled={activeStepIndex === 0}
                    sx={{
                      color: activeStepIndex === 0 ? colors.lightText : colors.text,
                      border: `1px solid ${colors.lightBorder}`,
                      borderRadius: "6px",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        borderColor: activeStepIndex === 0 ? colors.lightBorder : colors.primary,
                        bgcolor: activeStepIndex === 0 ? "transparent" : colors.primary,
                        color: activeStepIndex === 0 ? colors.lightText : "white",
                      },
                      "&:disabled": {
                        color: colors.lightText,
                        borderColor: colors.lightBorder,
                      },
                    }}
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                  <IconButton
                    onClick={goNextStep}
                    disabled={activeStepIndex >= steps.length - 1}
                    sx={{
                      color: activeStepIndex >= steps.length - 1 ? colors.lightText : colors.text,
                      border: `1px solid ${colors.lightBorder}`,
                      borderRadius: "6px",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        borderColor: activeStepIndex >= steps.length - 1 ? colors.lightBorder : colors.primary,
                        bgcolor: activeStepIndex >= steps.length - 1 ? "transparent" : colors.primary,
                        color: activeStepIndex >= steps.length - 1 ? colors.lightText : "white",
                      },
                      "&:disabled": {
                        color: colors.lightText,
                        borderColor: colors.lightBorder,
                      },
                    }}
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>

            {/* Hint for Touch Gestures */}
            <Typography
              variant="caption"
              sx={{
                display: { xs: "block", sm: "none" },
                textAlign: "center",
                color: colors.lightText,
                fontSize: "0.8rem",
              }}
            >
              Swipe left or right to navigate steps
            </Typography>
          </Container>
        </Box>
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
