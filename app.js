const TEST_LENGTH = 35;

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

let allQuestions = [];
let testQuestions = [];
let missedQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function showScreen(screen) {
  homeScreen.hidden = screen !== homeScreen;
  quizScreen.hidden = screen !== quizScreen;
  resultsScreen.hidden = screen !== resultsScreen;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startTest() {
  testQuestions = shuffle(allQuestions).slice(0, TEST_LENGTH);
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
  scoreSummary.textContent = `${score} correct, ${TEST_LENGTH - score} missed.`;
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

async function loadQuestionBank() {
  try {
    const response = await fetch("data/questions.json");
    if (!response.ok) throw new Error("The question pool could not be loaded.");
    const bank = await response.json();
    if (!Array.isArray(bank.questions) || bank.questions.length < TEST_LENGTH) {
      throw new Error("The question pool is incomplete.");
    }
    allQuestions = bank.questions;
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