export const validateQuestionBank = (
  questionBank,
  { expectedSetCount = 10, expectedQuestionsPerSet = 20 } = {},
) => {
  const errors = []

  if (!questionBank || !Array.isArray(questionBank.sets)) {
    return {
      isValid: false,
      errors: ['Question bank is missing a valid "sets" array.'],
    }
  }

  if (questionBank.sets.length !== expectedSetCount) {
    errors.push(
      `Expected ${expectedSetCount} sets but found ${questionBank.sets.length}.`,
    )
  }

  const idSet = new Set()
  const questionTextSet = new Set()

  questionBank.sets.forEach((set) => {
    if (!Array.isArray(set.questions)) {
      errors.push(`Set ${set.setId} is missing a questions array.`)
      return
    }

    if (set.questions.length !== expectedQuestionsPerSet) {
      errors.push(
        `Set ${set.setId} expected ${expectedQuestionsPerSet} questions, found ${set.questions.length}.`,
      )
    }

    set.questions.forEach((question) => {
      if (!question.id) {
        errors.push(`A question in set ${set.setId} is missing an id.`)
      }

      if (idSet.has(question.id)) {
        errors.push(`Duplicate question id detected: ${question.id}.`)
      }
      idSet.add(question.id)

      const normalizedQuestion = question.question?.trim().toLowerCase()
      if (!normalizedQuestion) {
        errors.push(`Question ${question.id} has empty question text.`)
      } else if (questionTextSet.has(normalizedQuestion)) {
        errors.push(`Duplicate question text detected for ${question.id}.`)
      }
      questionTextSet.add(normalizedQuestion)

      if (!Array.isArray(question.options) || question.options.length !== 4) {
        errors.push(`Question ${question.id} must have exactly 4 options.`)
      } else {
        const uniqueOptions = new Set(question.options)
        if (uniqueOptions.size !== 4) {
          errors.push(`Question ${question.id} contains duplicate options.`)
        }
      }

      if (
        !Number.isInteger(question.answerIndex) ||
        question.answerIndex < 0 ||
        question.answerIndex > 3
      ) {
        errors.push(`Question ${question.id} has invalid answerIndex.`)
      }

      if (!question.explanation || question.explanation.trim().length < 12) {
        errors.push(`Question ${question.id} needs a stronger explanation.`)
      }
    })
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}
