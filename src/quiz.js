// Quiz mode state: which contribution cards are covered/revealed. Pure state,
// no DOM -- same style as rules.js/momentum.js/automorphism.js.

let quizMode = false;
let isExample = false;
const revealed = new Set();

export function isQuizMode() {
  return quizMode;
}

export function setQuizMode(on) {
  quizMode = on;
  revealed.clear();
}

export function setExampleMode(on) {
  isExample = on;
}

export function coverAll() {
  revealed.clear();
}

export function reveal(id) {
  revealed.add(id);
}

export function isRevealed(id) {
  return isExample || !quizMode || revealed.has(id);
}
