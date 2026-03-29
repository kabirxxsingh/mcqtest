const formatDateTime = (isoDate) =>
  new Date(isoDate).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const ResultsPanel = ({
  result,
  setData,
  questionsById,
  onBackToSets,
  onRetryFull,
  onRetryWrongOnly,
}) => {
  const reviewedQuestions = result.questionResults.map((resultItem) => ({
    ...resultItem,
    question: questionsById[resultItem.questionId],
  }))

  return (
    <section className="result-panel fade-in">
      <header>
        <p className="set-tag">{setData.domain ?? 'Web/UI'} • Set {setData.setId} Result</p>
        <h2>{setData.title}</h2>
        <p className="meta-line">
          Completed on {formatDateTime(result.finishedAt)} • Mode: {result.mode}
        </p>
      </header>

      <div className="result-grid">
        <article>
          <h3>{result.scorePercent}%</h3>
          <p>Score</p>
        </article>
        <article>
          <h3>
            {result.correctCount}/{result.totalQuestions}
          </h3>
          <p>Correct Answers</p>
        </article>
        <article>
          <h3>{result.incorrectCount}</h3>
          <p>Incorrect</p>
        </article>
        <article>
          <h3>{result.unansweredCount}</h3>
          <p>Unanswered</p>
        </article>
      </div>

      <section className="topic-breakdown">
        <h3>Topic Breakdown</h3>
        <div className="topic-table">
          {Object.entries(result.topicBreakdown).map(([topic, bucket]) => (
            <div key={topic} className="topic-row">
              <strong>{topic}</strong>
              <span>
                {bucket.correct}/{bucket.total} correct
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="review-section">
        <h3>Answer Review</h3>
        <div className="review-list">
          {reviewedQuestions.map((item) => {
            if (!item.question) {
              return null
            }

            const selectedText =
              item.selectedIndex === null
                ? 'Not answered'
                : item.question.options[item.selectedIndex]
            const correctText = item.question.options[item.correctIndex]

            return (
              <article
                key={item.questionId}
                className={`review-item ${item.isCorrect ? 'ok' : 'miss'}`}
              >
                <p className="review-meta">
                  {item.question.topic} • {item.question.subtopic}
                </p>
                <h4>{item.question.question}</h4>
                <p>
                  <strong>Your answer:</strong> {selectedText}
                </p>
                <p>
                  <strong>Correct answer:</strong> {correctText}
                </p>
                <p className="review-note">{item.question.explanation}</p>
              </article>
            )
          })}
        </div>
      </section>

      <footer className="result-actions">
        <button type="button" onClick={onRetryFull}>
          Retry Full Set
        </button>
        <button
          type="button"
          className="ghost"
          onClick={onRetryWrongOnly}
          disabled={result.wrongQuestionIds.length === 0}
        >
          Retry Wrong Only
        </button>
        <button type="button" className="ghost" onClick={onBackToSets}>
          Back to Sets
        </button>
      </footer>
    </section>
  )
}

export default ResultsPanel
