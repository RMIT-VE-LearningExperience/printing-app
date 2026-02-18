"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

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

function stripHtml(content: string): string {
  return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function HomePage() {
  const [data, setData] = useState<TutorialState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedColourId, setSelectedColourId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

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
            {showingPrinterSelection ? (
              <div className={styles.cardList}>
                {data.printers.map((printer, index) => (
                  <button
                    key={printer.id}
                    type="button"
                    className={`${styles.selectCard} ${index === 0 ? styles.activeCard : ""}`}
                    onClick={() => selectPrinter(printer.id)}
                  >
                    <Image
                      src={printer.thumbnailDataUrl || "/vercel.svg"}
                      alt={printer.name}
                      width={280}
                      height={190}
                      className={styles.cardImage}
                      unoptimized
                    />
                    <div className={styles.cardContent}>
                      <h3 className={styles.cardTitle}>{printer.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {showingPaperSelection ? (
              <div className={styles.cardList}>
                {selectedPrinter?.papers.map((paper, index) => (
                  <button
                    key={paper.id}
                    type="button"
                    className={`${styles.selectCard} ${index === 0 ? styles.activeCard : ""}`}
                    onClick={() => selectPaper(paper.id)}
                  >
                    <Image
                      src={paper.thumbnailDataUrl || "/vercel.svg"}
                      alt={paper.name}
                      width={280}
                      height={220}
                      className={styles.cardImage}
                      unoptimized
                    />
                    <div className={styles.cardContent}>
                      <h3 className={styles.cardTitle}>{paper.name}</h3>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {showingColourSelection ? (
              <div className={styles.cardList}>
                {selectedPaper?.colours.map((colour, index) => {
                  const firstStep = colour.steps[0];
                  return (
                    <button
                      key={colour.id}
                      type="button"
                      className={`${styles.selectCard} ${index === 0 ? styles.activeCard : ""}`}
                      onClick={() => selectColour(colour.id)}
                    >
                      <Image
                        src={colour.thumbnailDataUrl || firstStep?.imageDataUrl || "/vercel.svg"}
                        alt={colour.name}
                        width={280}
                        height={220}
                        className={styles.cardImage}
                        unoptimized
                      />
                      <div className={styles.cardContent}>
                        <h3 className={styles.cardTitle}>{colour.name}</h3>
                        {firstStep?.contentHtml ? (
                          <p className={styles.cardText}>{stripHtml(firstStep.contentHtml).slice(0, 120)}</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {showingSteps && activeStep ? (
              <div className={styles.stepDesktop}>
                <article key={activeStep.id} className={styles.stepCard}>
                  <div className={styles.stepIndex}>{activeStepIndex + 1}</div>
                  <h3 className={styles.stepName}>{activeStep.name}</h3>

                  <div className={styles.itemBlock}>
                    <p className={styles.itemTitle}>{activeStep.title}</p>
                    <div className={styles.itemHtml} dangerouslySetInnerHTML={{ __html: activeStep.contentHtml }} />
                    <Image
                      src={activeStep.imageDataUrl || "/vercel.svg"}
                      alt={activeStep.title || activeStep.name}
                      width={900}
                      height={520}
                      className={styles.itemImage}
                      unoptimized
                    />
                  </div>

                  <div className={styles.stepControls}>
                    <button
                      type="button"
                      className={styles.navButton}
                      onClick={() => setActiveStepIndex((value) => Math.max(0, value - 1))}
                      disabled={activeStepIndex === 0}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className={styles.navButton}
                      onClick={() => setActiveStepIndex((value) => Math.min(steps.length - 1, value + 1))}
                      disabled={activeStepIndex >= steps.length - 1}
                    >
                      Next
                    </button>
                  </div>
                </article>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {!showingPrinterSelection ? (
        <button type="button" onClick={resetToHome} className={styles.footerHome}>
          <span className={styles.footerHomeIcon}>⌂</span>
          HOME
        </button>
      ) : null}
    </main>
  );
}
