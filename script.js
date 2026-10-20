const timerCard = document.querySelector(".timer-card");
const display = document.querySelector("#timer-display");
const phaseLabel = document.querySelector("#phase-label");
const nextLabel = document.querySelector("#next-label");
const progressTrack = document.querySelector("#progress-track");
const progressFill = document.querySelector("#progress-fill");
const startButton = document.querySelector("#start-button");
const startButtonText = startButton.querySelector("span");
const resetButton = document.querySelector("#reset-button");
const soundButton = document.querySelector("#sound-button");
const currentRoundText = document.querySelector("#current-round");
const roundTotalText = document.querySelector("#round-total");
const durationBadge = document.querySelector("#duration-badge");

const settings = { work: 20, rest: 10, rounds: 8 };
const limits = { work: [5, 300], rest: [0, 300], rounds: [1, 30] };
const values = {
  work: document.querySelector("#work-value"),
  rest: document.querySelector("#rest-value"),
  rounds: document.querySelector("#rounds-value"),
};

let phase = "ready";
let round = 1;
let remaining = settings.work;
let phaseDuration = settings.work;
let endsAt = 0;
let ticker = null;
let soundEnabled = true;
let audioContext;
let lastCountdownCue = 0;

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function totalDuration() {
  return settings.rounds * settings.work + Math.max(0, settings.rounds - 1) * settings.rest;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes} min ${String(remainder).padStart(2, "0")}` : `${remainder} sec`;
}

function updateSettingsView() {
  for (const name of Object.keys(settings)) values[name].textContent = settings[name];
  roundTotalText.textContent = settings.rounds;
  durationBadge.textContent = formatDuration(totalDuration());
  updateStepperAvailability();
  render();
}

function updateStepperAvailability() {
  document.querySelectorAll(".stepper button").forEach((button) => {
    const name = button.dataset.setting;
    const nextValue = settings[name] + Number(button.dataset.delta);
    const [minimum, maximum] = limits[name];
    button.disabled = (phase !== "ready" && phase !== "done") || nextValue < minimum || nextValue > maximum;
  });
}

function render() {
  display.textContent = formatTime(remaining);
  currentRoundText.textContent = Math.min(round, settings.rounds);
  timerCard.dataset.phase = phase;

  if (phase === "ready") {
    phaseLabel.textContent = "PRÊT·E ?";
    nextLabel.textContent = "Configurez votre séance puis appuyez sur démarrer";
    progressFill.style.width = "0%";
    progressTrack.setAttribute("aria-valuenow", "0");
    startButtonText.textContent = "Démarrer";
  } else if (phase === "work") {
    phaseLabel.textContent = "EFFORT";
    nextLabel.textContent = round < settings.rounds ? "La récupération arrive juste après" : "Dernier effort, donnez tout !";
    startButtonText.textContent = "Pause";
    updateProgress();
  } else if (phase === "rest") {
    phaseLabel.textContent = "RÉCUPÉRATION";
    nextLabel.textContent = `Prochain effort · tour ${round + 1}`;
    startButtonText.textContent = "Pause";
    updateProgress();
  } else if (phase === "paused") {
    phaseLabel.textContent = "EN PAUSE";
    nextLabel.textContent = "Reprenez quand vous êtes prêt·e";
    startButtonText.textContent = "Reprendre";
  } else {
    phaseLabel.textContent = "SÉANCE TERMINÉE";
    nextLabel.textContent = "Bien joué. Vous l’avez fait !";
    display.textContent = "BRAVO !";
    startButtonText.textContent = "Recommencer";
    progressFill.style.width = "100%";
    progressTrack.setAttribute("aria-valuenow", "100");
  }

  updateStepperAvailability();
}

function updateProgress() {
  const progress = Math.min(100, Math.max(0, ((phaseDuration - remaining) / phaseDuration) * 100));
  progressFill.style.width = `${progress}%`;
  progressTrack.setAttribute("aria-valuenow", String(Math.round(progress)));
}

function playBeep(frequency = 660, duration = 0.14) {
  if (!soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = "sine";
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function beginPhase(nextPhase, nextRound, duration) {
  phase = nextPhase;
  round = nextRound;
  remaining = duration;
  phaseDuration = duration;
  endsAt = Date.now() + duration * 1000;
  lastCountdownCue = 0;
  render();
  playBeep(nextPhase === "work" ? 880 : 520);
}

function finishSession() {
  clearInterval(ticker);
  ticker = null;
  phase = "done";
  remaining = 0;
  render();
  playBeep(990, 0.4);
}

function tick() {
  remaining = Math.max(0, (endsAt - Date.now()) / 1000);
  const countdownSecond = Math.ceil(remaining);
  if (countdownSecond > 0 && countdownSecond <= 3 && countdownSecond !== lastCountdownCue) {
    lastCountdownCue = countdownSecond;
    playBeep(440 + (4 - countdownSecond) * 110);
  }

  if (remaining <= 0) {
    if (phase === "work" && round < settings.rounds && settings.rest > 0) {
      beginPhase("rest", round, settings.rest);
    } else if (phase === "rest") {
      beginPhase("work", round + 1, settings.work);
    } else if (phase === "work" && round < settings.rounds) {
      beginPhase("work", round + 1, settings.work);
    } else {
      finishSession();
      return;
    }
  } else {
    render();
  }
}

function startSession() {
  beginPhase("work", 1, settings.work);
  ticker = window.setInterval(tick, 100);
}

function toggleTimer() {
  if (phase === "ready" || phase === "done") {
    startSession();
  } else if (phase === "paused") {
    phase = pausedPhase;
    endsAt = Date.now() + remaining * 1000;
    ticker = window.setInterval(tick, 100);
    render();
  } else {
    pausedPhase = phase;
    remaining = Math.max(0, (endsAt - Date.now()) / 1000);
    clearInterval(ticker);
    ticker = null;
    phase = "paused";
    render();
  }
}

let pausedPhase = "work";

document.querySelectorAll(".stepper button").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.setting;
    const [minimum, maximum] = limits[name];
    if (phase === "done") {
      phase = "ready";
      round = 1;
    }
    settings[name] = Math.min(maximum, Math.max(minimum, settings[name] + Number(button.dataset.delta)));
    if (name === "work" && phase === "ready") {
      remaining = settings.work;
      phaseDuration = settings.work;
    }
    updateSettingsView();
  });
});

startButton.addEventListener("click", toggleTimer);
resetButton.addEventListener("click", () => {
  clearInterval(ticker);
  ticker = null;
  phase = "ready";
  round = 1;
  remaining = settings.work;
  phaseDuration = settings.work;
  render();
});
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
  soundButton.setAttribute("aria-label", soundEnabled ? "Désactiver les sons" : "Activer les sons");
  soundButton.classList.toggle("is-muted", !soundEnabled);
});

updateSettingsView();
