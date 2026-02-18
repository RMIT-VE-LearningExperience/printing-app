"use client";

import Image from "next/image";
import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

import styles from "./page.module.css";

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

const emptyState: TutorialState = { printers: [] };
const PROGRESS_KEY = "printing_guide_progress_v1";

function stripHtml(content: string): string {
  return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

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
  const [selectionView, setSelectionView] = useState<"cards" | "list">("cards");
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
        const payload = (await response.json()) as TutorialState | { error: string };

        if (!response.ok || !("printers" in payload)) {
          setError("Could not load guide data.");
          return;
        }

        setData(payload);
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
  const showingSelectionLists =
    showingPrinterSelection || showingPaperSelection || showingColourSelection;

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

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {showingPrinterSelection ? (
          <header className={styles.hero}>
            <h1 className={styles.title}>Printing Guide</h1>
            <p className={styles.subtitle}>
              A step-by-step guide to a clean print according to the paper used.
            </p>
            <p className={styles.prompt}>Select printer to begin:</p>
          </header>
        ) : (
          <>
            <div className={styles.topRow}>
              <div className={styles.contextPill}>
                <button type="button" onClick={backOneLevel} className={styles.backButton}>
                  ←
                </button>
                <div className={styles.pillText}>
                  <span className={styles.pillPrimary}>{selectedPrinter?.name}</span>
                  {selectedPaper ? <span className={styles.pillSecondary}>{selectedPaper.name}</span> : null}
                </div>
              </div>
            </div>

            {showingPaperSelection ? (
              <>
                <h2 className={styles.sectionTitle}>Paper Selection</h2>
                <p className={styles.sectionSub}>Choose paper type:</p>
              </>
            ) : null}

            {showingColourSelection ? (
              <>
                <h2 className={styles.sectionTitle}>Colour Management</h2>
                <p className={styles.sectionSub}>I want to preserve the:</p>
              </>
            ) : null}

            {showingSteps ? (
              <>
                <h2 className={styles.sectionTitle}>{selectedColour?.name}</h2>
                <div className={styles.progressWrap}>
                  <div className={styles.stepMeta}>
                    STEP {steps.length === 0 ? 0 : activeStepIndex + 1} OF {steps.length}
                  </div>
                  <div className={styles.dots}>
                    {steps.map((step, index) => (
                      <span key={step.id} className={index === activeStepIndex ? styles.dotActive : styles.dot} />
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}

        {loading ? <div className={styles.statusBox}>Loading guide…</div> : null}
        {error ? <div className={styles.statusBox}>{error}</div> : null}

        {!loading && !error ? (
          <section className={styles.content}>
            {showingSelectionLists ? (
              <div className={styles.viewToggleBar}>
                <span className={styles.viewToggleLabel}>View</span>
                <div className={styles.viewToggleWrap}>
                <button
                  type="button"
                  className={`${styles.viewToggleButton} ${selectionView === "cards" ? styles.viewToggleButtonActive : ""}`}
                  onClick={() => setSelectionView("cards")}
                >
                  Cards
                </button>
                <button
                  type="button"
                  className={`${styles.viewToggleButton} ${selectionView === "list" ? styles.viewToggleButtonActive : ""}`}
                  onClick={() => setSelectionView("list")}
                >
                  List
                </button>
                </div>
              </div>
            ) : null}

            {showingPrinterSelection ? (
              <div className={`${styles.cardList} ${selectionView === "list" ? styles.listView : ""}`}>
                {data.printers.map((printer, index) => (
                  <button
                    key={printer.id}
                    type="button"
                    className={`${styles.selectCard} ${index === 0 ? styles.activeCard : ""} ${selectionView === "list" ? styles.selectListItem : ""}`}
                    onClick={() => selectPrinter(printer.id)}
                  >
                    <Image
                      src={printer.thumbnailDataUrl || "/vercel.svg"}
                      alt={printer.name}
                      width={280}
                      height={190}
                      className={styles.cardImage}
                      sizes="(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw"
                      loading="lazy"
                    />
                    <div className={styles.cardContent}>
                      <h3 className={styles.cardTitle}>{printer.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {showingPrinterSelection && !hasPrinters ? (
              <div className={styles.statusBox}>No printers available yet. Add your first printer in Admin.</div>
            ) : null}

            {showingPaperSelection ? (
              <div className={`${styles.cardList} ${selectionView === "list" ? styles.listView : ""}`}>
                {selectedPrinter?.papers.map((paper, index) => (
                  <button
                    key={paper.id}
                    type="button"
                    className={`${styles.selectCard} ${index === 0 ? styles.activeCard : ""} ${selectionView === "list" ? styles.selectListItem : ""}`}
                    onClick={() => selectPaper(paper.id)}
                  >
                    <Image
                      src={paper.thumbnailDataUrl || "/vercel.svg"}
                      alt={paper.name}
                      width={280}
                      height={220}
                      className={styles.cardImage}
                      sizes="(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw"
                      loading="lazy"
                    />
                    <div className={styles.cardContent}>
                      <h3 className={styles.cardTitle}>{paper.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {showingPaperSelection && !hasPapers ? (
              <div className={styles.statusBox}>No papers yet for this printer. Add first paper in Admin.</div>
            ) : null}

            {showingColourSelection ? (
              <div className={`${styles.cardList} ${selectionView === "list" ? styles.listView : ""}`}>
                {selectedPaper?.colours.map((colour, index) => {
                  const firstStep = colour.steps[0];
                  const firstStepSummary = stripHtml(firstStep?.contentHtml ?? "");
                  return (
                    <button
                      key={colour.id}
                      type="button"
                      className={`${styles.selectCard} ${index === 0 ? styles.activeCard : ""} ${selectionView === "list" ? styles.selectListItem : ""}`}
                      onClick={() => selectColour(colour.id)}
                    >
                      <Image
                        src={colour.thumbnailDataUrl || firstStep?.imageDataUrl || "/vercel.svg"}
                        alt={colour.name}
                        width={280}
                        height={220}
                        className={styles.cardImage}
                        sizes="(max-width: 700px) 100vw, (max-width: 980px) 50vw, 33vw"
                        loading="lazy"
                      />
                      <div className={styles.cardContent}>
                        <h3 className={styles.cardTitle}>{colour.name}</h3>
                        {firstStepSummary.length > 0 ? (
                          <p className={styles.cardText}>{firstStepSummary.slice(0, 120)}</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {showingColourSelection && !hasColours ? (
              <div className={styles.statusBox}>No colours yet for this paper. Add first colour in Admin.</div>
            ) : null}

            {showingSteps && activeStep ? (
              <div className={styles.stepDesktop}>
                <article
                  key={activeStep.id}
                  className={styles.stepCard}
                  onTouchStart={handleStepTouchStart}
                  onTouchEnd={handleStepTouchEnd}
                >
                  <div className={styles.stepIndex}>{activeStepIndex + 1}</div>
                  <h3 className={styles.stepName}>{activeStep.name}</h3>

                  <div className={styles.itemBlock}>
                    <p className={styles.itemTitle}>{activeStep.title}</p>
                    <div
                      className={styles.itemRich}
                      dangerouslySetInnerHTML={{ __html: sanitizeStepHtml(activeStep.contentHtml ?? "") }}
                    />
                    <Image
                      src={activeStep.imageDataUrl || "/vercel.svg"}
                      alt={activeStep.title || activeStep.name}
                      width={900}
                      height={520}
                      className={styles.itemImage}
                      sizes="(max-width: 980px) 100vw, 860px"
                      loading="lazy"
                    />
                  </div>

                  <div className={styles.stepControls}>
                    <button
                      type="button"
                      className={styles.navButton}
                      onClick={goPrevStep}
                      disabled={activeStepIndex === 0}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className={styles.navButton}
                      onClick={goNextStep}
                      disabled={activeStepIndex >= steps.length - 1}
                    >
                      Next
                    </button>
                  </div>
                </article>
              </div>
            ) : null}
            {showingSteps && !hasSteps ? (
              <div className={styles.statusBox}>No steps yet for this colour. Add Step 1 in Admin.</div>
            ) : null}
          </section>
        ) : null}
      </div>

      {showingSteps && hasSteps ? (
        <div className={styles.stickyStepNav}>
          <button
            type="button"
            className={styles.navButton}
            onClick={goPrevStep}
            disabled={activeStepIndex === 0}
          >
            Previous
          </button>
          <span className={styles.stickyStepMeta}>
            Step {activeStepIndex + 1} / {steps.length}
          </span>
          <button
            type="button"
            className={styles.navButton}
            onClick={goNextStep}
            disabled={activeStepIndex >= steps.length - 1}
          >
            Next
          </button>
        </div>
      ) : null}

      {!showingPrinterSelection ? (
        <button type="button" onClick={resetToHome} className={styles.footerHome}>
          <span className={styles.footerHomeIcon}>⌂</span>
          HOME
        </button>
      ) : null}
    </main>
  );
}
