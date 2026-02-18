export type StepItem = {
  id: number;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  createdAt: string;
};

export type Step = {
  id: number;
  name: string;
  items: StepItem[];
};

export type Colour = {
  id: number;
  name: string;
  steps: Step[];
};

export type Paper = {
  id: number;
  name: string;
  colours: Colour[];
};

export type Printer = {
  id: number;
  name: string;
  papers: Paper[];
};

type State = {
  printers: Printer[];
};

const state: State = {
  printers: [],
};

let nextId = 1;

function cloneState(): State {
  return JSON.parse(JSON.stringify(state)) as State;
}

function createId(): number {
  const id = nextId;
  nextId += 1;
  return id;
}

function normalizeName(value: string, label: string): string {
  const result = value.trim();

  if (result.length < 2) {
    throw new Error(`${label} must be at least 2 characters long.`);
  }

  if (result.length > 100) {
    throw new Error(`${label} must be 100 characters or less.`);
  }

  return result;
}

function findPrinter(printerId: number): Printer {
  const printer = state.printers.find((entry) => entry.id === printerId);

  if (!printer) {
    throw new Error("Printer not found.");
  }

  return printer;
}

function findPaper(printer: Printer, paperId: number): Paper {
  const paper = printer.papers.find((entry) => entry.id === paperId);

  if (!paper) {
    throw new Error("Paper not found.");
  }

  return paper;
}

function findColour(paper: Paper, colourId: number): Colour {
  const colour = paper.colours.find((entry) => entry.id === colourId);

  if (!colour) {
    throw new Error("Colour not found.");
  }

  return colour;
}

function findStep(colour: Colour, stepId: number): Step {
  const step = colour.steps.find((entry) => entry.id === stepId);

  if (!step) {
    throw new Error("Step not found.");
  }

  return step;
}

export function getTutorialState(): State {
  return cloneState();
}

export function addPrinter(name: string): State {
  state.printers.push({
    id: createId(),
    name: normalizeName(name, "Printer name"),
    papers: [],
  });

  return cloneState();
}

export function addPaper(printerId: number, name: string): State {
  const printer = findPrinter(printerId);

  printer.papers.push({
    id: createId(),
    name: normalizeName(name, "Paper name"),
    colours: [],
  });

  return cloneState();
}

export function addColour(printerId: number, paperId: number, name: string): State {
  const printer = findPrinter(printerId);
  const paper = findPaper(printer, paperId);

  paper.colours.push({
    id: createId(),
    name: normalizeName(name, "Colour name"),
    steps: [],
  });

  return cloneState();
}

export function addStep(
  printerId: number,
  paperId: number,
  colourId: number,
  name: string,
): State {
  const printer = findPrinter(printerId);
  const paper = findPaper(printer, paperId);
  const colour = findColour(paper, colourId);

  colour.steps.push({
    id: createId(),
    name: normalizeName(name, "Step name"),
    items: [],
  });

  return cloneState();
}

type AddStepItemInput = {
  printerId: number;
  paperId: number;
  colourId: number;
  stepId: number;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
};

export function addStepItem(input: AddStepItemInput): State {
  const printer = findPrinter(input.printerId);
  const paper = findPaper(printer, input.paperId);
  const colour = findColour(paper, input.colourId);
  const step = findStep(colour, input.stepId);

  const title = normalizeName(input.title, "Item title");
  const contentHtml = input.contentHtml.trim();
  const imageDataUrl = input.imageDataUrl.trim();

  if (!contentHtml) {
    throw new Error("Item content is required.");
  }

  if (!imageDataUrl.startsWith("data:image/")) {
    throw new Error("A valid uploaded image is required.");
  }

  step.items.push({
    id: createId(),
    title,
    contentHtml,
    imageDataUrl,
    createdAt: new Date().toISOString(),
  });

  return cloneState();
}
