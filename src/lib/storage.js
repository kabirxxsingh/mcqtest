const STORAGE_KEYS = {
  history: 'vquest:history',
  weakAreas: 'vquest:weak-areas',
  currentAttempt: 'vquest:current-attempt',
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

const isSafeKey = (key) => typeof key === 'string' && !FORBIDDEN_KEYS.has(key)

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeAttemptSummary = (attempt) => {
  if (!isPlainObject(attempt)) {
    return null
  }

  const {
    setId,
    attemptId,
    mode,
    startedAt,
    finishedAt,
    elapsedSeconds,
    submissionReason,
    totalQuestions,
    answeredCount,
    correctCount,
    incorrectCount,
    unansweredCount,
    scorePercent,
    topicBreakdown,
    wrongQuestionIds,
    questionResults,
  } = attempt

  if (
    !Number.isInteger(setId) ||
    typeof attemptId !== 'string' ||
    typeof mode !== 'string' ||
    typeof startedAt !== 'string' ||
    typeof finishedAt !== 'string' ||
    !Number.isFinite(elapsedSeconds) ||
    !Number.isFinite(totalQuestions) ||
    !Number.isFinite(answeredCount) ||
    !Number.isFinite(correctCount) ||
    !Number.isFinite(incorrectCount) ||
    !Number.isFinite(unansweredCount) ||
    !Number.isFinite(scorePercent) ||
    !Array.isArray(wrongQuestionIds) ||
    !Array.isArray(questionResults) ||
    !isPlainObject(topicBreakdown)
  ) {
    return null
  }

  return {
    setId,
    attemptId,
    mode,
    startedAt,
    finishedAt,
    elapsedSeconds,
    submissionReason: typeof submissionReason === 'string' ? submissionReason : 'manual',
    totalQuestions,
    answeredCount,
    correctCount,
    incorrectCount,
    unansweredCount,
    scorePercent,
    topicBreakdown,
    wrongQuestionIds,
    questionResults,
  }
}

const normalizeHistory = (rawHistory) => {
  if (!isPlainObject(rawHistory)) {
    return Object.create(null)
  }

  const nextHistory = Object.create(null)
  Object.entries(rawHistory).forEach(([setIdKey, attempts]) => {
    if (!isSafeKey(setIdKey)) {
      return
    }

    if (!Array.isArray(attempts)) {
      return
    }

    const normalizedAttempts = attempts
      .map(normalizeAttemptSummary)
      .filter(Boolean)
      .slice(0, 20)

    if (normalizedAttempts.length > 0) {
      nextHistory[setIdKey] = normalizedAttempts
    }
  })

  return nextHistory
}

const normalizeWeakArea = (rawArea) => {
  if (!isPlainObject(rawArea)) {
    return null
  }

  const { topic, subtopic, seen, misses, lastUpdatedAt } = rawArea
  if (
    typeof topic !== 'string' ||
    typeof subtopic !== 'string' ||
    !Number.isFinite(seen) ||
    !Number.isFinite(misses)
  ) {
    return null
  }

  return {
    topic,
    subtopic,
    seen: Math.max(1, Math.floor(seen)),
    misses: Math.max(0, Math.floor(misses)),
    lastUpdatedAt:
      typeof lastUpdatedAt === 'string' ? lastUpdatedAt : new Date().toISOString(),
  }
}

const normalizeWeakAreas = (rawWeakAreas) => {
  if (!isPlainObject(rawWeakAreas)) {
    return Object.create(null)
  }

  const nextWeakAreas = Object.create(null)
  Object.entries(rawWeakAreas).forEach(([key, rawArea]) => {
    if (!isSafeKey(key)) {
      return
    }

    const normalized = normalizeWeakArea(rawArea)
    if (normalized) {
      nextWeakAreas[key] = normalized
    }
  })

  return nextWeakAreas
}

const normalizeCurrentAttempt = (attempt) => {
  if (!isPlainObject(attempt)) {
    return null
  }

  const { attemptId, setId, mode, questionIds, answers, startedAt, durationSeconds, currentIndex } =
    attempt

  if (
    typeof attemptId !== 'string' ||
    !Number.isInteger(setId) ||
    typeof mode !== 'string' ||
    !Array.isArray(questionIds) ||
    questionIds.length === 0 ||
    !isPlainObject(answers) ||
    typeof startedAt !== 'string' ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null
  }

  const startedAtMs = new Date(startedAt).getTime()
  if (!Number.isFinite(startedAtMs)) {
    return null
  }

  const normalizedAnswers = Object.create(null)
  Object.entries(answers).forEach(([questionId, answerIndex]) => {
    if (!isSafeKey(questionId)) {
      return
    }

    if (Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex <= 3) {
      normalizedAnswers[questionId] = answerIndex
    }
  })

  return {
    attemptId,
    setId,
    mode,
    questionIds,
    answers: normalizedAnswers,
    startedAt,
    durationSeconds: Math.floor(durationSeconds),
    currentIndex: Number.isInteger(currentIndex) ? currentIndex : 0,
  }
}

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch (error) {
    console.error('localStorage is unavailable in this environment.', error)
    return null
  }
}

const readJson = (key, fallbackValue) => {
  const storage = getStorage()
  if (!storage) {
    return fallbackValue
  }

  const raw = storage.getItem(key)
  if (!raw) {
    return fallbackValue
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error(`Could not parse JSON from key "${key}".`, error)
    return fallbackValue
  }
}

const writeJson = (key, value) => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Could not save JSON to key "${key}".`, error)
  }
}

const removeItem = (key) => {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(key)
  } catch (error) {
    console.error(`Could not remove key "${key}".`, error)
  }
}

export const loadHistory = () => {
  const raw = readJson(STORAGE_KEYS.history, {})
  const normalized = normalizeHistory(raw)
  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    writeJson(STORAGE_KEYS.history, normalized)
  }
  return normalized
}

export const saveHistory = (history) => writeJson(STORAGE_KEYS.history, history)

export const loadWeakAreas = () =>
  (() => {
    const raw = readJson(STORAGE_KEYS.weakAreas, {})
    const normalized = normalizeWeakAreas(raw)
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
      writeJson(STORAGE_KEYS.weakAreas, normalized)
    }
    return normalized
  })()

export const saveWeakAreas = (weakAreas) => writeJson(STORAGE_KEYS.weakAreas, weakAreas)

export const loadCurrentAttempt = () =>
  (() => {
    const raw = readJson(STORAGE_KEYS.currentAttempt, null)
    const normalized = normalizeCurrentAttempt(raw)
    if (!normalized && raw) {
      removeItem(STORAGE_KEYS.currentAttempt)
    }
    return normalized
  })()

export const saveCurrentAttempt = (attempt) => writeJson(STORAGE_KEYS.currentAttempt, attempt)

export const clearCurrentAttempt = () => removeItem(STORAGE_KEYS.currentAttempt)

export { STORAGE_KEYS }
