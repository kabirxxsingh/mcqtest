const formatTime = (remainingSeconds) => {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const QuizRunner = ({
  setData,
  attempt,
  questionsById,
  remainingSeconds,
  onSelectAnswer,
  onGoToQuestion,
  onSubmit,
  onBackToSets,
}) => {
  const totalQuestions = attempt.questionIds.length
  const currentIndex = attempt.currentIndex ?? 0
  const currentQuestionId = attempt.questionIds[currentIndex]
  const currentQuestion = questionsById[currentQuestionId]

  const answeredCount = attempt.questionIds.reduce(
    (count, questionId) =>
      Number.isInteger(attempt.answers[questionId]) ? count + 1 : count,
    0,
  )

  const completionPercent = Number(((answeredCount / totalQuestions) * 100).toFixed(1))

  if (!currentQuestion) {
    return (
      <section className="quiz-panel">
        <h2>Question not found</h2>
        <p>The selected question could not be loaded.</p>
        <button type="button" onClick={onBackToSets}>
          Back to Sets
        </button>
      </section>
    )
  }

  return (
    <section className="quiz-panel fade-in">
      <header className="quiz-header">
        <div>
          <p className="set-tag">Set {setData.setId}</p>
          <h2>{setData.title}</h2>
          <p className="meta-line">
            Mode: {attempt.mode === 'wrong-only' ? 'Wrong Only' : 'Full Set'}
          </p>
        </div>

        <div className="timer-pill" aria-live="polite">
          {formatTime(remainingSeconds)}
        </div>
      </header>

      <div className="progress-wrap" aria-label="Progress">
        <div className="progress-bar" style={{ width: `${completionPercent}%` }} />
      </div>

      <p className="meta-line">
        Answered {answeredCount}/{totalQuestions} • Question {currentIndex + 1} of{' '}
        {totalQuestions}
      </p>

      <article className="question-card pop-in">
        <p className="question-topic">
          {currentQuestion.topic} • {currentQuestion.subtopic} • {currentQuestion.difficulty}
        </p>
        <h3>{currentQuestion.question}</h3>

        <div className="options-list">
          {currentQuestion.options.map((option, index) => {
            const isSelected = attempt.answers[currentQuestion.id] === index
            return (
              <button
                key={`${currentQuestion.id}-option-${index}`}
                type="button"
                className={`option-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectAnswer(currentQuestion.id, index)}
              >
                <span>{String.fromCharCode(65 + index)}.</span> {option}
              </button>
            )
          })}
        </div>
      </article>

      <nav className="question-nav" aria-label="Question navigation">
        {attempt.questionIds.map((questionId, index) => {
          const answered = Number.isInteger(attempt.answers[questionId])
          const isCurrent = index === currentIndex
          return (
            <button
              key={questionId}
              type="button"
              className={`nav-dot ${answered ? 'answered' : ''} ${isCurrent ? 'current' : ''}`}
              onClick={() => onGoToQuestion(index)}
              aria-label={`Go to question ${index + 1}`}
            >
              {index + 1}
            </button>
          )
        })}
      </nav>

      <footer className="quiz-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => onGoToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          Previous
        </button>

        <button
          type="button"
          className="ghost"
          onClick={() => onGoToQuestion(currentIndex + 1)}
          disabled={currentIndex === totalQuestions - 1}
        >
          Next
        </button>

        <button type="button" onClick={onSubmit}>
          Submit Set
        </button>

        <button type="button" className="ghost" onClick={onBackToSets}>
          Exit to Sets
        </button>
      </footer>
    </section>
  )
}

export default QuizRunner
