const TEST_LENGTH = 35;
const EXAM_DISTRIBUTION = {
  T1: 6,
  T2: 3,
  T3: 3,
  T4: 2,
  T5: 4,
  T6: 4,
  T7: 4,
  T8: 4,
  T9: 2,
  T0: 3,
};
const STUDY_PROGRESS_KEY = "technician-study-progress-v1";
const MASTERED_STREAK = 2;

const homeScreen = document.querySelector("#home-screen");
const quizScreen = document.querySelector("#quiz-screen");
const resultsScreen = document.querySelector("#results-screen");
const startButton = document.querySelector("#start-button");
const restartButton = document.querySelector("#restart-button");
const exitButton = document.querySelector("#exit-button");
const nextButton = document.querySelector("#next-button");
const questionNumber = document.querySelector("#question-number");
const groupLabel = document.querySelector("#group-label");
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.querySelector("#progress-fill");
const questionTitle = document.querySelector("#question-title");
const questionFigure = document.querySelector("#question-figure");
const figureImage = document.querySelector("#figure-image");
const figureCaption = document.querySelector("#figure-caption");
const answerList = document.querySelector("#answer-list");
const answerFeedback = document.querySelector("#answer-feedback");
const scoreValue = document.querySelector("#score-value");
const scoreSummary = document.querySelector("#score-summary");
const missedCount = document.querySelector("#missed-count");
const missedList = document.querySelector("#missed-list");
const reviewDetails = document.querySelector("#review-details");
const loadError = document.querySelector("#load-error");
const studyProgressSummary = document.querySelector("#study-progress-summary");
const resetProgressButton = document.querySelector("#reset-progress-button");

let allQuestions = [];
let testQuestions = [];
let missedQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let studyProgress = loadStudyProgress();
let testComposition = { newCount: 0, reviewCount: 0, refreshCount: 0 };

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createEmptyStudyProgress() {
  return { version: 1, testsStarted: 0, questions: {} };
}

function loadStudyProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY));
    if (
      stored?.version !== 1 ||
      !Number.isInteger(stored.testsStarted) ||
      !stored.questions ||
      typeof stored.questions !== "object" ||
      Array.isArray(stored.questions)
    ) {
      return createEmptyStudyProgress();
    }
    return stored;
  } catch {
    return createEmptyStudyProgress();
  }
}

function saveStudyProgress() {
  try {
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(studyProgress));
  } catch {
    // Keep the current session usable if browser storage is unavailable.
  }
}

function getQuestionProgress(questionId) {
  return studyProgress.questions[questionId] ?? null;
}

function ensureQuestionProgress(questionId) {
  studyProgress.questions[questionId] ??= {
    seenCount: 0,
    attemptCount: 0,
    correctCount: 0,
    wrongCount: 0,
    correctStreak: 0,
    lastSeenTest: 0,
    reviewAfterTest: null,
  };
  return studyProgress.questions[questionId];
}

function isDueForReview(question) {
  const progress = getQuestionProgress(question.id);
  if (!progress) return false;
  if (progress.attemptCount === 0 && progress.seenCount > 0) return true;
  return (
    progress.wrongCount > 0 &&
    progress.correctStreak < MASTERED_STREAK &&
    progress.reviewAfterTest <= studyProgress.testsStarted
  );
}

function isInReviewQueue(question) {
  const progress = getQuestionProgress(question.id);
  return Boolean(
    progress &&
      ((progress.attemptCount === 0 && progress.seenCount > 0) ||
        (progress.wrongCount > 0 && progress.correctStreak < MASTERED_STREAK)),
  );
}

function weightedSample(items, count, getWeight) {
  const remaining = [...items];
  const selected = [];

  while (selected.length < count && remaining.length > 0) {
    const weights = remaining.map((item) => Math.max(0.001, getWeight(item)));
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    let selection = Math.random() * totalWeight;
    let selectedIndex = weights.findIndex((weight) => {
      selection -= weight;
      return selection < 0;
    });
    if (selectedIndex === -1) selectedIndex = remaining.length - 1;
    selected.push(remaining.splice(selectedIndex, 1)[0]);
  }

  return selected;
}

function selectTestQuestions() {
  const selectedQuestions = [];
  const composition = { newCount: 0, reviewCount: 0, refreshCount: 0 };

  for (const [subelement, quota] of Object.entries(EXAM_DISTRIBUTION)) {
    const pool = allQuestions.filter((question) => question.id.startsWith(subelement));
    const unseen = pool.filter((question) => !getQuestionProgress(question.id));
    const dueForReview = pool.filter(isDueForReview);
    const selected = [];
    const selectedIds = new Set();

    const addSample = (candidates, count, category, getWeight) => {
      const available = candidates.filter((question) => !selectedIds.has(question.id));
      const sample = weightedSample(available, count, getWeight);
      for (const question of sample) {
        selected.push(question);
        selectedIds.add(question.id);
        composition[category] += 1;
      }
    };

    const newTarget = Math.min(quota, Math.round((quota * 2) / 3), unseen.length);
    addSample(unseen, newTarget, "newCount", () => 1);

    const reviewWeight = (question) => {
      const progress = getQuestionProgress(question.id);
      const wrongBoost = Math.min(1 + progress.wrongCount, 4);
      const testsSinceSeen = Math.max(0, studyProgress.testsStarted - progress.lastSeenTest);
      return wrongBoost * (1 + Math.min(testsSinceSeen, 6) / 6);
    };
    addSample(dueForReview, quota - selected.length, "reviewCount", reviewWeight);

    addSample(unseen, quota - selected.length, "newCount", () => 1);
    addSample(dueForReview, quota - selected.length, "reviewCount", reviewWeight);

    const refreshWeight = (question) => {
      const progress = getQuestionProgress(question.id);
      const difficultyBoost = (1 + Math.min(progress.wrongCount, 3)) / (1 + Math.min(progress.correctCount, 3));
      const testsSinceSeen = Math.max(0, studyProgress.testsStarted - progress.lastSeenTest);
      return difficultyBoost * (1 + Math.min(testsSinceSeen, 8) / 8);
    };
    addSample(pool, quota - selected.length, "refreshCount", refreshWeight);

    if (selected.length !== quota) {
      throw new Error(`Subelement ${subelement} has fewer than ${quota} available questions.`);
    }
    selectedQuestions.push(...selected);
  }

  return { questions: shuffle(selectedQuestions), composition };
}

function refreshStudyProgressSummary() {
  if (!allQuestions.length) return;
  const seenCount = Object.values(studyProgress.questions).filter((progress) => progress.seenCount > 0).length;
  const reviewCount = allQuestions.filter(isInReviewQueue).length;
  studyProgressSummary.textContent = `${seenCount} of ${allQuestions.length} seen · ${reviewCount} to review`;
  resetProgressButton.disabled = seenCount === 0 && studyProgress.testsStarted === 0;
}

function recordQuestionSeen(question) {
  const progress = ensureQuestionProgress(question.id);
  if (progress.lastSeenTest === studyProgress.testsStarted) return;
  progress.seenCount += 1;
  progress.lastSeenTest = studyProgress.testsStarted;
  saveStudyProgress();
  refreshStudyProgressSummary();
}

function recordQuestionAnswer(question, correct) {
  const progress = ensureQuestionProgress(question.id);
  progress.attemptCount += 1;
  if (correct) {
    progress.correctCount += 1;
    progress.correctStreak += 1;
    if (progress.correctStreak >= MASTERED_STREAK) progress.reviewAfterTest = null;
  } else {
    progress.wrongCount += 1;
    progress.correctStreak = 0;
    progress.reviewAfterTest = studyProgress.testsStarted + 1;
  }
  saveStudyProgress();
  refreshStudyProgressSummary();
}

function showScreen(screen) {
  homeScreen.hidden = screen !== homeScreen;
  quizScreen.hidden = screen !== quizScreen;
  resultsScreen.hidden = screen !== resultsScreen;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTest() {
  studyProgress.testsStarted += 1;
  const selection = selectTestQuestions();
  testQuestions = selection.questions;
  testComposition = selection.composition;
  saveStudyProgress();
  refreshStudyProgressSummary();
  missedQuestions = [];
  currentIndex = 0;
  score = 0;
  reviewDetails.open = false;
  showScreen(quizScreen);
  renderQuestion();
}

function renderQuestion() {
  const question = testQuestions[currentIndex];
  answered = false;
  questionNumber.textContent = String(currentIndex + 1).padStart(2, "0");
  groupLabel.textContent = question.group;
  questionTitle.textContent = question.question;
  recordQuestionSeen(question);
  const figureMatch = question.question.match(/\bfigure\s+(T-\d+)\b/i);
  questionFigure.hidden = !figureMatch;
  if (figureMatch) {
    const figureId = figureMatch[1].toUpperCase();
    figureImage.src = `data/figures/${figureId}.jpeg`;
    figureImage.alt = `Electrical schematic ${figureId} with numbered components`;
    figureCaption.textContent = `Figure ${figureId}`;
  } else {
    figureImage.removeAttribute("src");
    figureImage.alt = "";
    figureCaption.textContent = "";
  }
  answerList.replaceChildren();
  answerFeedback.hidden = true;
  answerFeedback.textContent = "";
  nextButton.hidden = true;
  nextButton.textContent = currentIndex === TEST_LENGTH - 1 ? "See results" : "Next question";

  const progress = currentIndex + 1;
  progressTrack.setAttribute("aria-valuenow", String(progress));
  progressFill.style.width = `${(progress / TEST_LENGTH) * 100}%`;

  for (const choice of question.choices) {
    const option = document.createElement("button");
    option.className = "answer-option";
    option.type = "button";
    option.setAttribute("aria-pressed", "false");

    const letter = document.createElement("span");
    letter.className = "answer-letter";
    letter.textContent = choice.letter;

    const text = document.createElement("span");
    text.className = "answer-text";
    text.textContent = choice.text;

    option.append(letter, text);
    option.addEventListener("click", () => selectAnswer(choice.letter));
    answerList.append(option);
  }

  questionTitle.focus({ preventScroll: true });
}

function selectAnswer(selectedLetter) {
  if (answered) return;
  answered = true;

  const question = testQuestions[currentIndex];
  const correct = selectedLetter === question.answer;
  const correctChoice = question.choices.find((choice) => choice.letter === question.answer);
  recordQuestionAnswer(question, correct);

  if (correct) {
    score += 1;
  } else {
    missedQuestions.push({ question, selectedLetter });
  }

  for (const option of answerList.children) {
    const letter = option.querySelector(".answer-letter").textContent;
    option.disabled = true;
    if (letter === question.answer) option.dataset.state = "correct";
    if (letter === selectedLetter && !correct) option.dataset.state = "incorrect";
    option.setAttribute("aria-pressed", String(letter === selectedLetter));
  }

  answerFeedback.dataset.correct = String(correct);
  answerFeedback.textContent = correct ? "Correct. " : "Not quite. Correct answer: ";
  const answerText = document.createElement("strong");
  answerText.textContent = `${correctChoice.letter}. ${correctChoice.text}`;
  answerFeedback.append(answerText);
  answerFeedback.hidden = false;
  nextButton.hidden = false;
}

function showResults() {
  scoreValue.textContent = String(score);
  scoreSummary.textContent = `${score} correct, ${TEST_LENGTH - score} missed. ${testComposition.newCount} new · ${testComposition.reviewCount} review · ${testComposition.refreshCount} repeat.`;
  missedCount.textContent = `${missedQuestions.length}`;
  missedList.replaceChildren();

  for (const { question, selectedLetter } of missedQuestions) {
    const item = document.createElement("article");
    item.className = "missed-item";

    const id = document.createElement("p");
    id.className = "missed-id";
    id.textContent = `${question.id} / YOUR ANSWER ${selectedLetter}`;

    const prompt = document.createElement("p");
    prompt.className = "missed-question";
    prompt.textContent = question.question;

    const correctChoice = question.choices.find((choice) => choice.letter === question.answer);
    const correct = document.createElement("p");
    correct.className = "missed-answer";
    correct.textContent = `Correct answer: ${correctChoice.letter}. ${correctChoice.text}`;

    item.append(id, prompt, correct);
    missedList.append(item);
  }

  if (missedQuestions.length === 0) {
    const message = document.createElement("p");
    message.className = "missed-item";
    message.textContent = "No missed questions.";
    missedList.append(message);
  }

  showScreen(resultsScreen);
}

nextButton.addEventListener("click", () => {
  if (currentIndex === TEST_LENGTH - 1) {
    showResults();
    return;
  }
  currentIndex += 1;
  renderQuestion();
});

startButton.addEventListener("click", startTest);
restartButton.addEventListener("click", startTest);
exitButton.addEventListener("click", () => showScreen(homeScreen));
resetProgressButton.addEventListener("click", () => {
  if (!window.confirm("Clear all study history saved on this browser?")) return;
  studyProgress = createEmptyStudyProgress();
  saveStudyProgress();
  refreshStudyProgressSummary();
});

async function loadQuestionBank() {
  try {
    const response = await fetch("data/questions.json");
    if (!response.ok) throw new Error("The question pool could not be loaded.");
    const bank = await response.json();
    if (!Array.isArray(bank.questions) || bank.questions.length < TEST_LENGTH) {
      throw new Error("The question pool is incomplete.");
    }
    allQuestions = bank.questions;
    refreshStudyProgressSummary();
    startButton.disabled = false;
    startButton.textContent = "Begin practice test";
  } catch {
    startButton.hidden = true;
    loadError.hidden = false;
    loadError.textContent = "The question pool could not be loaded. Open this app through a web server and try again.";
  }
}

loadQuestionBank();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}