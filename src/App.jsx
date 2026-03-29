import { useCallback, useEffect, useMemo, useState } from 'react'
import questionBank from './data/verified-question-bank.json'
import verificationReport from './data/verification-report.json'
import './App.css'
import SetCard from './components/SetCard'
import QuizRunner from './components/QuizRunner'
import ResultsPanel from './components/ResultsPanel'
import {
  DEFAULT_SECONDS_PER_QUESTION,
  buildQuestionIndex,
  createAttempt,
  evaluateAttempt,
  getRemainingSeconds,
  mergeWeakAreas,
} from './lib/quizEngine'
import { validateQuestionBank } from './lib/questionValidation'
import {
  clearCurrentAttempt,
  loadCurrentAttempt,
  loadHistory,
  loadWeakAreas,
  saveCurrentAttempt,
  saveHistory,
  saveWeakAreas,
} from './lib/storage'

const validation = validateQuestionBank(questionBank)

const DOMAIN_ORDER = ['Web/UI', 'SQL', 'PL/SQL']

const DOMAIN_LABELS = {
  'Web/UI': 'Web/UI',
  SQL: 'SQL',
  'PL/SQL': 'PL/SQL',
}

const normalizeHistoryForSet = (history, setId) => {
  const rawAttempts = history[setId]
  if (!Array.isArray(rawAttempts)) {
    return []
  }

  return rawAttempts.filter(
    (item) =>
      item &&
      Number.isFinite(item.scorePercent) &&
      Number.isFinite(item.correctCount) &&
      Number.isFinite(item.totalQuestions),
  )
}

const getLatestAttempt = (history, setId) => {
  const attempts = normalizeHistoryForSet(history, setId)
  return Array.isArray(attempts) && attempts.length > 0 ? attempts[0] : null
}

const getRecoverableAttempt = (sets) => {
  const cachedAttempt = loadCurrentAttempt()
  if (!cachedAttempt) {
    return {
      attempt: null,
      activeSetId: null,
      view: 'sets',
      statusMessage: '',
    }
  }

  const setExists = sets.some((set) => set.setId === cachedAttempt.setId)
  const hasQuestions =
    Array.isArray(cachedAttempt.questionIds) && cachedAttempt.questionIds.length > 0
  const remaining = getRemainingSeconds(cachedAttempt)

  if (!setExists || !hasQuestions || remaining <= 0) {
    return {
      attempt: null,
      activeSetId: null,
      view: 'sets',
      statusMessage: '',
    }
  }

  return {
    attempt: cachedAttempt,
    activeSetId: cachedAttempt.setId,
    view: 'quiz',
    statusMessage: 'Recovered your previous unfinished attempt from localStorage.',
  }
}

function App() {
  const [recoveredState] = useState(() => getRecoverableAttempt(questionBank.sets))
  const [history, setHistory] = useState(() => loadHistory())
  const [weakAreas, setWeakAreas] = useState(() => loadWeakAreas())
  const [attempt, setAttempt] = useState(recoveredState.attempt)
  const [activeSetId, setActiveSetId] = useState(recoveredState.activeSetId)
  const [result, setResult] = useState(null)
  const [view, setView] = useState(recoveredState.view)
  const [, setClockTick] = useState(0)
  const [statusMessage, setStatusMessage] = useState(recoveredState.statusMessage)
  const [selectedDomain, setSelectedDomain] = useState('Web/UI')

  const sets = questionBank.sets

  const domains = useMemo(() => {
    const present = new Set(sets.map((set) => set.domain ?? 'Web/UI'))
    return DOMAIN_ORDER.filter((domain) => present.has(domain))
  }, [sets])

  const effectiveSelectedDomain = domains.includes(selectedDomain)
    ? selectedDomain
    : (domains[0] ?? 'Web/UI')

  const visibleSets = useMemo(
    () => sets.filter((set) => (set.domain ?? 'Web/UI') === effectiveSelectedDomain),
    [sets, effectiveSelectedDomain],
  )

  const questionsById = useMemo(() => buildQuestionIndex(sets), [sets])

  const activeSet = useMemo(
    () => sets.find((set) => set.setId === activeSetId) ?? null,
    [sets, activeSetId],
  )

  const remainingSeconds = attempt
    ? getRemainingSeconds(attempt)
    : DEFAULT_SECONDS_PER_QUESTION * 20

  const topWeakAreas = useMemo(() => {
    return Object.values(weakAreas)
      .filter((area) => area.misses > 0)
      .map((area) => ({
        ...area,
        missRate: Number(((area.misses / area.seen) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.missRate - a.missRate || b.misses - a.misses)
      .slice(0, 6)
  }, [weakAreas])

  const totalAttemptCount = useMemo(() => {
    return Object.values(history).reduce((sum, attempts) => sum + attempts.length, 0)
  }, [history])

  const averageScore = useMemo(() => {
    const allScores = Object.values(history)
      .flat()
      .map((attemptItem) => attemptItem.scorePercent)

    if (allScores.length === 0) {
      return 0
    }

    const total = allScores.reduce((sum, score) => sum + score, 0)
    return Number((total / allScores.length).toFixed(1))
  }, [history])

  const submitAttempt = useCallback(
    (submissionReason) => {
      if (!attempt) {
        return
      }

      const evaluation = evaluateAttempt({
        attempt,
        questionsById,
        submissionReason,
      })

      setResult(evaluation)
      setView('result')
      setAttempt(null)
      setStatusMessage(
        submissionReason === 'time-up'
          ? 'Time ended. Your set was auto-submitted.'
          : 'Set submitted successfully.',
      )

      clearCurrentAttempt()

      setHistory((previousHistory) => {
        const setAttempts = normalizeHistoryForSet(previousHistory, evaluation.setId)
        const nextSetAttempts = [evaluation, ...setAttempts].slice(0, 20)

        const nextHistory = {
          ...previousHistory,
          [evaluation.setId]: nextSetAttempts,
        }

        saveHistory(nextHistory)
        return nextHistory
      })

      setWeakAreas((previousWeakAreas) => {
        const nextWeakAreas = mergeWeakAreas(
          previousWeakAreas,
          evaluation.questionResults,
        )

        saveWeakAreas(nextWeakAreas)
        return nextWeakAreas
      })
    },
    [attempt, questionsById],
  )

  useEffect(() => {
    if (view !== 'quiz' || !attempt) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      const remaining = getRemainingSeconds(attempt)
      if (remaining <= 0) {
        submitAttempt('time-up')
        return
      }

      setClockTick((tick) => tick + 1)
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [view, attempt, submitAttempt])

  const startAttempt = (setId, mode = 'full', basedOnResult = null) => {
    const selectedSet = sets.find((set) => set.setId === setId)
    if (!selectedSet) {
      setStatusMessage('Could not start: selected set was not found.')
      return
    }

    let questionIds = selectedSet.questions.map((question) => question.id)

    if (mode === 'wrong-only' && basedOnResult?.wrongQuestionIds?.length > 0) {
      const validIds = basedOnResult.wrongQuestionIds.filter((id) => questionsById[id])
      if (validIds.length > 0) {
        questionIds = validIds
      }
    }

    const nextAttempt = {
      ...createAttempt({
        setId,
        mode,
        questionIds,
        durationSeconds: questionIds.length * DEFAULT_SECONDS_PER_QUESTION,
      }),
      currentIndex: 0,
    }

    setAttempt(nextAttempt)
    setResult(null)
    setActiveSetId(setId)
    setView('quiz')
    setClockTick((tick) => tick + 1)
    setStatusMessage(
      mode === 'wrong-only'
        ? `Started wrong-only retry for Set ${setId}.`
        : `Started Set ${setId}. All the best!`,
    )

    saveCurrentAttempt(nextAttempt)
  }

  const updateAttempt = (updater) => {
    setAttempt((previousAttempt) => {
      if (!previousAttempt) {
        return previousAttempt
      }

      const nextAttempt = updater(previousAttempt)
      saveCurrentAttempt(nextAttempt)
      return nextAttempt
    })
  }

  const handleSelectAnswer = (questionId, answerIndex) => {
    updateAttempt((previousAttempt) => ({
      ...previousAttempt,
      answers: {
        ...previousAttempt.answers,
        [questionId]: answerIndex,
      },
    }))
  }

  const handleGoToQuestion = (nextIndex) => {
    updateAttempt((previousAttempt) => {
      const boundedIndex = Math.max(
        0,
        Math.min(nextIndex, previousAttempt.questionIds.length - 1),
      )

      return {
        ...previousAttempt,
        currentIndex: boundedIndex,
      }
    })
  }

  const handleBackToSets = () => {
    setView('sets')
    setStatusMessage('Choose any set to continue your practice.')
  }

  if (!validation.isValid) {
    return (
      <main className="app-shell error-shell">
        <h1>Question Bank Validation Failed</h1>
        <p>
          The quiz cannot start because the question dataset is invalid. Fix these
          issues first.
        </p>
        <ul>
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-panel glow-slide">
        <div>
          <p className="tag">TCS Ninja Multi-Domain Prep</p>
          <h1>VQuest - Web/UI, SQL, and PL/SQL MCQ Arena</h1>
          <p className="hero-description">
            Verified multi-domain sets, rephrased questions, confidence-tagged sources, and
            localStorage-powered progress tracking.
          </p>
        </div>

        <div className="hero-stats">
          <article>
            <h2>{verificationReport.totalQuestions}</h2>
            <p>Verified Questions</p>
          </article>
          <article>
            <h2>{verificationReport.totalSets}</h2>
            <p>Exam Sets</p>
          </article>
          <article>
            <h2>{totalAttemptCount}</h2>
            <p>Your Attempts</p>
          </article>
          <article>
            <h2>{averageScore}%</h2>
            <p>Average Score</p>
          </article>
        </div>
      </section>

      {statusMessage ? <p className="status-chip">{statusMessage}</p> : null}

      {view === 'sets' ? (
        <>
          <section className="domain-tabs" aria-label="Domain selection">
            {domains.map((domain) => {
              const isActive = domain === effectiveSelectedDomain
              return (
                <button
                  key={domain}
                  type="button"
                  className={`domain-tab ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedDomain(domain)}
                  aria-pressed={isActive}
                >
                  {DOMAIN_LABELS[domain] ?? domain}
                </button>
              )
            })}
          </section>

          <section className="set-grid">
            {visibleSets.map((set) => (
              <SetCard
                key={set.id}
                setData={set}
                latestAttempt={getLatestAttempt(history, set.setId)}
                onStartFull={() => startAttempt(set.setId, 'full')}
                onStartWrongOnly={() =>
                  startAttempt(set.setId, 'wrong-only', getLatestAttempt(history, set.setId))
                }
              />
            ))}
          </section>

          <section className="insights-grid">
            <article className="insight-card">
              <h3>Source Confidence Snapshot</h3>
              <p>
                High confidence: {verificationReport.confidenceBreakdown.high} • Medium
                confidence: {verificationReport.confidenceBreakdown.medium}
              </p>
              <p className="insight-note">
                Policy: <strong>{questionBank.metadata.policy}</strong> with strict
                validation checks and explanation review.
              </p>
            </article>

            <article className="insight-card">
              <h3>Weak Topic Radar</h3>
              {topWeakAreas.length === 0 ? (
                <p>You have no weak areas yet. Finish a set to unlock performance insights.</p>
              ) : (
                <div className="weak-list">
                  {topWeakAreas.map((area) => (
                    <div key={`${area.topic}-${area.subtopic}`} className="weak-row">
                      <div>
                        <strong>{area.topic}</strong>
                        <span>{area.subtopic}</span>
                      </div>
                      <span>{area.missRate}% miss</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      ) : null}

      {view === 'quiz' && activeSet && attempt ? (
        <QuizRunner
          key={attempt.attemptId}
          setData={activeSet}
          attempt={attempt}
          questionsById={questionsById}
          remainingSeconds={remainingSeconds}
          onSelectAnswer={handleSelectAnswer}
          onGoToQuestion={handleGoToQuestion}
          onSubmit={() => submitAttempt('manual')}
          onBackToSets={handleBackToSets}
        />
      ) : null}

      {view === 'result' && result && activeSet ? (
        <ResultsPanel
          result={result}
          setData={activeSet}
          questionsById={questionsById}
          onBackToSets={handleBackToSets}
          onRetryFull={() => startAttempt(result.setId, 'full')}
          onRetryWrongOnly={() => startAttempt(result.setId, 'wrong-only', result)}
        />
      ) : null}
    </main>
  )
}

export default App
