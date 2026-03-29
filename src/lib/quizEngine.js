export const DEFAULT_SECONDS_PER_QUESTION = 45

const createAttemptId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const entropy = Math.random().toString(36).slice(2, 10)
  return `attempt-${Date.now()}-${entropy}`
}

export const buildQuestionIndex = (sets) => {
  const questionIndex = {}

  sets.forEach((set) => {
    set.questions.forEach((question) => {
      questionIndex[question.id] = question
    })
  })

  return questionIndex
}

export const createAttempt = ({
  setId,
  mode,
  questionIds,
  durationSeconds,
}) => ({
  attemptId: createAttemptId(),
  setId,
  mode,
  questionIds,
  answers: {},
  startedAt: new Date().toISOString(),
  durationSeconds,
})

export const getRemainingSeconds = (attempt, nowMs = Date.now()) => {
  if (!attempt) {
    return 0
  }

  const startedAtMs = new Date(attempt.startedAt).getTime()
  if (!Number.isFinite(startedAtMs)) {
    return 0
  }

  if (!Number.isFinite(attempt.durationSeconds) || attempt.durationSeconds <= 0) {
    return 0
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))

  return Math.max(0, attempt.durationSeconds - elapsedSeconds)
}

export const evaluateAttempt = ({
  attempt,
  questionsById,
  submissionReason = 'manual',
}) => {
  const topicBreakdown = {}
  const questionResults = []

  let correctCount = 0
  let incorrectCount = 0
  let unansweredCount = 0

  attempt.questionIds.forEach((questionId) => {
    const question = questionsById[questionId]
    if (!question) {
      return
    }

    const selectedIndex = Number.isInteger(attempt.answers[questionId])
      ? attempt.answers[questionId]
      : null

    const isAnswered = selectedIndex !== null
    const isCorrect = isAnswered && selectedIndex === question.answerIndex

    if (isCorrect) {
      correctCount += 1
    } else if (isAnswered) {
      incorrectCount += 1
    } else {
      unansweredCount += 1
    }

    const topicKey = question.topic
    const bucket =
      topicBreakdown[topicKey] ??
      {
        total: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
      }

    bucket.total += 1
    if (isCorrect) {
      bucket.correct += 1
    } else if (isAnswered) {
      bucket.incorrect += 1
    } else {
      bucket.unanswered += 1
    }

    topicBreakdown[topicKey] = bucket

    questionResults.push({
      questionId,
      selectedIndex,
      correctIndex: question.answerIndex,
      isCorrect,
      topic: question.topic,
      subtopic: question.subtopic,
    })
  })

  const totalQuestions = questionResults.length
  const answeredCount = correctCount + incorrectCount
  const wrongQuestionIds = questionResults
    .filter((result) => result.selectedIndex !== null && !result.isCorrect)
    .map((result) => result.questionId)

  const finishedAt = new Date().toISOString()
  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (new Date(finishedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000,
    ),
  )

  const scorePercent =
    totalQuestions === 0
      ? 0
      : Number(((correctCount / totalQuestions) * 100).toFixed(2))

  return {
    attemptId: attempt.attemptId,
    setId: attempt.setId,
    mode: attempt.mode,
    startedAt: attempt.startedAt,
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
  }
}

export const mergeWeakAreas = (existingWeakAreas, questionResults) => {
  const nextWeakAreas = { ...existingWeakAreas }
  const nowIso = new Date().toISOString()

  questionResults.forEach((result) => {
    const key = `${result.topic} • ${result.subtopic}`

    const current =
      nextWeakAreas[key] ??
      {
        topic: result.topic,
        subtopic: result.subtopic,
        seen: 0,
        misses: 0,
        lastUpdatedAt: nowIso,
      }

    current.seen += 1
    if (!result.isCorrect) {
      current.misses += 1
    }
    current.lastUpdatedAt = nowIso

    nextWeakAreas[key] = current
  })

  return nextWeakAreas
}
