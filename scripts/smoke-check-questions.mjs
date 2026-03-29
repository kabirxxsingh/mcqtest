import fs from 'node:fs/promises'
import path from 'node:path'

const bankPath = path.resolve(
  process.cwd(),
  'src/data/verified-question-bank.json',
)

const data = JSON.parse(await fs.readFile(bankPath, 'utf8'))

const kindOf = (value) => {
  const text = String(value).trim()

  if (/^<[^>]+>$/.test(text)) return 'tag'
  if (/^(true|false|null|undefined|NaN)$/i.test(text)) return 'primitive'
  if (/^-?\d+(\.\d+)?$/.test(text)) return 'number'
  if (text.includes(':') && text.includes(';')) return 'cssDeclaration'
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\(\))?$/.test(text)) return 'token'
  if (text.split(/\s+/).length >= 4) return 'sentence'

  return 'token'
}

const issues = []

for (const set of data.sets) {
  for (const q of set.questions) {
    const answer = q.options[q.answerIndex]
    const answerKind = kindOf(answer)

    q.options.forEach((opt, idx) => {
      if (idx === q.answerIndex) return

      const optionKind = kindOf(opt)
      const sameKind = optionKind === answerKind
      const compatibleToken = answerKind === 'token' && optionKind === 'token'
      const compatibleSentence = answerKind === 'sentence' && optionKind === 'sentence'

      if (!sameKind && !compatibleToken && !compatibleSentence) {
        issues.push({
          questionId: q.id,
          answer,
          distractor: opt,
          answerKind,
          distractorKind: optionKind,
        })
      }
    })
  }
}

if (issues.length > 0) {
  console.error(`Found ${issues.length} potentially mismatched distractors.`)
  console.error(JSON.stringify(issues.slice(0, 20), null, 2))
  process.exit(1)
}

console.log('Distractor smoke-check passed.')
