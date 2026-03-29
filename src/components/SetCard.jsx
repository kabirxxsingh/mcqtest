const formatPercent = (value) => `${Number(value ?? 0).toFixed(1)}%`

const SetCard = ({ setData, latestAttempt, onStartFull, onStartWrongOnly }) => {
  const canRetryWrongOnly =
    latestAttempt &&
    Array.isArray(latestAttempt.wrongQuestionIds) &&
    latestAttempt.wrongQuestionIds.length > 0

  return (
    <article className="set-card glow-slide">
      <header>
        <p className="set-tag">Set {setData.setId}</p>
        <h3>{setData.title}</h3>
      </header>

      <p className="set-description">{setData.description}</p>

      <div className="set-meta">
        <span>{setData.questions.length} questions</span>
        <span>{setData.domain ?? 'Web/UI'}</span>
        <span>{setData.topic}</span>
      </div>

      <div className="set-actions">
        <button type="button" onClick={onStartFull}>
          Start Full Set
        </button>
        <button
          type="button"
          className="ghost"
          onClick={onStartWrongOnly}
          disabled={!canRetryWrongOnly}
        >
          Retry Wrong Only
        </button>
      </div>

      <footer>
        {latestAttempt ? (
          <>
            <span>Last Score: {formatPercent(latestAttempt.scorePercent)}</span>
            <span>
              Correct: {latestAttempt.correctCount}/{latestAttempt.totalQuestions}
            </span>
          </>
        ) : (
          <span>No attempts yet</span>
        )}
      </footer>
    </article>
  )
}

export default SetCard
