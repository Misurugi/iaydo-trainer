const WEAK_KEY = 'iaydo_weak';

async function loadQuestions() {
  const r = await fetch('/data/questions.json');
  return r.json();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns shuffled array of terms for a given exam level
function getTermsForLevel(level, all) {
  const result = [];
  // 15 from own level
  result.push(...shuffle(all.filter(t => t.level === level)).slice(0, 15));
  // 5 from each higher (easier) level already passed
  for (let lv = level + 1; lv <= 5; lv++) {
    result.push(...shuffle(all.filter(t => t.level === lv)).slice(0, 5));
  }
  return shuffle(result);
}

// Generate a training question (4 options) for one term
function makeQuestion(term, all) {
  const termFirst = Math.random() > 0.5;
  if (termFirst) {
    const wrong = shuffle(all.filter(t => t.term !== term.term)).slice(0, 3).map(t => t.definition);
    return {
      text: `Что означает термин «${term.term}»?`,
      correct: term.definition,
      options: shuffle([term.definition, ...wrong]),
      termRef: term,
    };
  } else {
    const wrong = shuffle(all.filter(t => t.term !== term.term)).slice(0, 3).map(t => t.term);
    return {
      text: `Как называется: «${term.definition}»?`,
      correct: term.term,
      options: shuffle([term.term, ...wrong]),
      termRef: term,
    };
  }
}

// Generate an open test question for one term
function makeOpenQuestion(term) {
  const termFirst = Math.random() > 0.5;
  if (termFirst) {
    return { text: `Что означает термин «${term.term}»?`, correct: term.definition, termRef: term };
  } else {
    return { text: `Как называется: «${term.definition}»?`, correct: term.term, termRef: term };
  }
}

// ── Weak spots ──────────────────────────────────────────────────────────────

function getWeakSpots() {
  try { return JSON.parse(localStorage.getItem(WEAK_KEY) || '{}'); }
  catch { return {}; }
}

function recordAnswer(termName, correct) {
  const s = getWeakSpots();
  if (!correct) {
    s[termName] = (s[termName] || 0) + 1;
  } else if (s[termName]) {
    s[termName]--;
    if (!s[termName]) delete s[termName];
  }
  localStorage.setItem(WEAK_KEY, JSON.stringify(s));
}

function getWeakTerms(all) {
  const s = getWeakSpots();
  return all.filter(t => s[t.term] > 0);
}

function weakCount() {
  return Object.keys(getWeakSpots()).length;
}
