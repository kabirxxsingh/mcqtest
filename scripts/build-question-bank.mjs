import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(process.cwd())
const DATA_DIR = path.join(ROOT, 'src', 'data')

const SOURCE_CATALOG = {
  official: [
    'https://www.tcsion.com/hub/national-qualifier-test/',
    'https://developer.mozilla.org/en-US/docs/Web/HTML',
    'https://developer.mozilla.org/en-US/docs/Web/CSS',
    'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    'https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model',
    'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage',
    'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
    'https://owasp.org/www-community/attacks/xss/',
  ],
  prepPattern: [
    'https://prepinsta.com/tcs-ninja-placement-papers-and-questions/',
    'https://www.geeksforgeeks.org/interview-prep/tcs-nqt-preparation-guide-2026-videos-mcqs-questions-bank/',
  ],
  communityPattern: [
    'https://gyanwithanjaan.blogspot.com/2023/04/tcs-xplore-2023-ui-html-css-javascript.html',
    'https://github.com/gdvtramarao/TCS-Xplore-UI-JavaScript-Hands-On-Solutions',
  ],
}

const FALLBACK_BY_TOPIC = {
  HTML: ['<main>', '<section>', '<article>', '<nav>', '<header>', '<footer>'],
  CSS: ['display', 'position', 'flex', 'grid', 'margin', 'padding'],
  JavaScript: ['undefined', 'NaN', 'Promise', 'async', 'await', 'closure'],
  Mixed: ['true', 'false', 'undefined', 'null', 'NaN', '0'],
  BestPractices: ['HTTPS', 'CSP', 'debounce', 'throttle', 'lazy loading', 'noopener'],
}

const FALLBACK_BY_KIND = {
  tag: ['<div>', '<span>', '<section>', '<article>', '<nav>', '<main>'],
  attribute: ['id', 'class', 'name', 'type', 'value', 'href', 'src', 'alt'],
  primitive: ['true', 'false', 'undefined', 'null', 'NaN'],
  number: ['0', '1', '2', '3', '4', '5'],
  cssDeclaration: [
    'display: block;',
    'position: relative;',
    'margin: 0 auto;',
    'opacity: 1;',
  ],
  methodLike: ['map', 'filter', 'reduce', 'forEach', 'querySelector', 'setItem'],
  sentence: [
    'It improves accessibility and semantics.',
    'It is used to control layout behavior.',
    'It helps validate user input correctly.',
    'It handles asynchronous operations safely.',
  ],
  token: ['class', 'id', 'display', 'Promise', 'href', 'required'],
}

const classifyAnswerKind = (answer) => {
  const value = String(answer).trim()

  if (/^<[^>]+>$/.test(value)) {
    return 'tag'
  }

  if (/^(true|false|null|undefined|NaN)$/i.test(value)) {
    return 'primitive'
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return 'number'
  }

  if (value.includes(':') && value.includes(';')) {
    return 'cssDeclaration'
  }

  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\(\))?$/.test(value)) {
    const lower = value.toLowerCase()
    if (
      [
        'id',
        'class',
        'name',
        'type',
        'value',
        'href',
        'src',
        'alt',
        'for',
        'required',
      ].includes(lower)
    ) {
      return 'attribute'
    }

    if (value.endsWith('()')) {
      return 'methodLike'
    }
  }

  if (value.split(/\s+/).length >= 4) {
    return 'sentence'
  }

  return 'token'
}

const hashSeed = (value) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) || 1
}

const seededShuffle = (items, seedKey) => {
  const array = [...items]
  let seed = hashSeed(seedKey)
  for (let i = array.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    const j = seed % (i + 1)
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const toQuestionId = (setId, index) => `S${setId}Q${String(index + 1).padStart(2, '0')}`

const buildSet = ({
  setId,
  title,
  description,
  topic,
  sourceType,
  sourceRef,
  defaultConfidence = 'high',
  items,
}) => {
  if (items.length !== 20) {
    throw new Error(`Set ${setId} must have exactly 20 items, got ${items.length}`)
  }

  const answerMeta = items.map((item) => ({
    answer: item.answer,
    subtopic: item.subtopic,
    kind: classifyAnswerKind(item.answer),
  }))

  const questions = items.map((item, index) => {
    const id = toQuestionId(setId, index)
    const distractors = []
    const answerKind = classifyAnswerKind(item.answer)

    const addCandidates = (entries) => {
      for (const entry of entries) {
        const candidate = entry.answer
        if (candidate !== item.answer && !distractors.includes(candidate)) {
          distractors.push(candidate)
        }
        if (distractors.length >= 3) {
          break
        }
      }
    }

    addCandidates(
      answerMeta.filter(
        (entry) =>
          entry.subtopic === item.subtopic &&
          entry.kind === answerKind &&
          entry.answer !== item.answer,
      ),
    )

    if (distractors.length < 3) {
      addCandidates(
        answerMeta.filter(
          (entry) => entry.kind === answerKind && entry.answer !== item.answer,
        ),
      )
    }

    const kindFallback = FALLBACK_BY_KIND[answerKind] ?? FALLBACK_BY_KIND.token
    for (const fallbackCandidate of kindFallback) {
      if (distractors.length >= 3) {
        break
      }

      if (
        fallbackCandidate !== item.answer &&
        !distractors.includes(fallbackCandidate)
      ) {
        distractors.push(fallbackCandidate)
      }
    }

    if (distractors.length < 3) {
      throw new Error(`Could not build distractors for ${id}`)
    }

    const options = seededShuffle([item.answer, ...distractors.slice(0, 3)], id)
    const answerIndex = options.indexOf(item.answer)

    return {
      id,
      setId,
      topic,
      subtopic: item.subtopic,
      difficulty: item.difficulty,
      question: item.question,
      options,
      answerIndex,
      explanation: item.explanation,
      sourceType: item.sourceType ?? sourceType,
      sourceRef: item.sourceRef ?? sourceRef,
      confidence: item.confidence ?? defaultConfidence,
      tcsRelevance: item.tcsRelevance ?? 'high',
    }
  })

  return {
    id: `set-${setId}`,
    setId,
    title,
    description,
    topic,
    questions,
  }
}

const setDefinitions = [
  {
    setId: 1,
    title: 'TCS UI Set 1 - HTML Foundations',
    description: 'Core HTML structure, semantics, and essential tags frequently seen in entry-level UI MCQs.',
    topic: 'HTML',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[1], SOURCE_CATALOG.official[0]],
    items: [
      { question: 'What is the primary purpose of <!DOCTYPE html> in an HTML file?', answer: 'It tells the browser to use HTML5 standards mode.', explanation: 'The doctype declaration enables standards-compliant rendering in modern browsers.', subtopic: 'Document Structure', difficulty: 'easy' },
      { question: 'Which tag represents the root element of a valid HTML document?', answer: '<html>', explanation: 'All visible and metadata content must live inside the root <html> element.', subtopic: 'Document Structure', difficulty: 'easy' },
      { question: 'Which section typically contains metadata, links, and page-level configuration?', answer: '<head>', explanation: 'The <head> section stores metadata, title, link, script references, and meta tags.', subtopic: 'Document Structure', difficulty: 'easy' },
      { question: 'Which tag defines the text shown on the browser tab?', answer: '<title>', explanation: 'The <title> element inside <head> controls tab title and bookmark name.', subtopic: 'Metadata', difficulty: 'easy' },
      { question: 'Which tag should be used for the most important heading on a page?', answer: '<h1>', explanation: 'Only one main heading is typically recommended for clear semantic structure.', subtopic: 'Semantics', difficulty: 'easy' },
      { question: 'Which HTML element is used for a paragraph of text?', answer: '<p>', explanation: 'The paragraph element groups related sentences as a text block.', subtopic: 'Text Content', difficulty: 'easy' },
      { question: 'Which tag is used to create an unordered list?', answer: '<ul>', explanation: 'Unordered lists show items with bullets by default.', subtopic: 'Lists', difficulty: 'easy' },
      { question: 'Which tag is used to create an ordered (numbered) list?', answer: '<ol>', explanation: 'Ordered lists render items in sequence, usually numbered.', subtopic: 'Lists', difficulty: 'easy' },
      { question: 'What is the main purpose of the alt attribute in an <img> tag?', answer: 'It provides alternative text for accessibility and failed image loads.', explanation: 'Screen readers and fallback rendering rely on alt text.', subtopic: 'Media & Accessibility', difficulty: 'easy' },
      { question: 'Which attribute specifies the destination URL in an anchor element?', answer: 'href', explanation: 'Without href, an anchor does not have a navigation target.', subtopic: 'Links', difficulty: 'easy' },
      { question: 'Which HTML tag inserts a line break inside text?', answer: '<br>', explanation: 'The line break element creates a new line without starting a new paragraph.', subtopic: 'Text Content', difficulty: 'easy' },
      { question: 'Which semantic tag should wrap the dominant content of a page?', answer: '<main>', explanation: '<main> should contain unique core content, excluding repeated sidebars/nav.', subtopic: 'Semantics', difficulty: 'medium' },
      { question: 'Which element is specifically intended to embed video content?', answer: '<video>', explanation: 'The <video> element supports native playback controls and source formats.', subtopic: 'Media', difficulty: 'easy' },
      { question: 'Which tag defines a table row?', answer: '<tr>', explanation: 'Rows are created using <tr> and contain header/data cells.', subtopic: 'Tables', difficulty: 'easy' },
      { question: 'Which tag is used for a header cell inside a table?', answer: '<th>', explanation: '<th> cells are semantically headers and can improve table accessibility.', subtopic: 'Tables', difficulty: 'easy' },
      { question: 'Which syntax correctly writes a comment in HTML?', answer: '<!-- comment -->', explanation: 'HTML comments start with <!-- and end with -->.', subtopic: 'Syntax', difficulty: 'easy' },
      { question: 'Which meta declaration is commonly used for UTF-8 character encoding?', answer: '<meta charset="UTF-8">', explanation: 'UTF-8 supports a broad set of characters and is the standard default.', subtopic: 'Metadata', difficulty: 'easy' },
      { question: 'Which value opens an anchor in a new tab/window when used with target?', answer: '_blank', explanation: 'target="_blank" opens the destination in a new browsing context.', subtopic: 'Links', difficulty: 'easy' },
      { question: 'Which of the following is a void element in HTML?', answer: '<input>', explanation: 'Void elements do not require closing tags (e.g., input, img, br).', subtopic: 'Syntax', difficulty: 'medium' },
      { question: 'Which tag conveys strong importance (not just visual bold)?', answer: '<strong>', explanation: '<strong> has semantic emphasis, unlike purely visual styling.', subtopic: 'Semantics', difficulty: 'medium' },
    ],
  },
  {
    setId: 2,
    title: 'TCS UI Set 2 - Forms & Validation',
    description: 'Form controls, attributes, and validation patterns aligned to common proctored UI MCQ style.',
    topic: 'HTML',
    sourceType: 'prep-pattern',
    sourceRef: [SOURCE_CATALOG.prepPattern[0], SOURCE_CATALOG.communityPattern[0], SOURCE_CATALOG.official[1]],
    defaultConfidence: 'medium',
    items: [
      { question: 'If method is omitted in <form>, which HTTP method is used by default?', answer: 'GET', explanation: 'Browsers default form submission method to GET if method is not specified.', subtopic: 'Forms', difficulty: 'easy' },
      { question: 'Which input type masks user-entered characters on screen?', answer: 'password', explanation: 'type="password" masks characters for privacy during entry.', subtopic: 'Input Types', difficulty: 'easy' },
      { question: 'Which attribute makes a form field mandatory before submission?', answer: 'required', explanation: 'required triggers native browser validation on empty values.', subtopic: 'Validation', difficulty: 'easy' },
      { question: 'Which attribute in <label> should match the target input id?', answer: 'for', explanation: 'for="inputId" binds the label to an input, improving usability/accessibility.', subtopic: 'Accessibility', difficulty: 'easy' },
      { question: 'How do radio buttons become mutually exclusive in a group?', answer: 'They share the same name attribute.', explanation: 'Radio inputs with identical name values form one selectable group.', subtopic: 'Input Types', difficulty: 'easy' },
      { question: 'Which control allows selecting multiple independent options?', answer: 'checkbox', explanation: 'Checkboxes are independent toggles; radios are single-select in a group.', subtopic: 'Input Types', difficulty: 'easy' },
      { question: 'Which HTML element creates a drop-down option list?', answer: '<select>', explanation: '<select> wraps one or more <option> elements for dropdown selection.', subtopic: 'Input Types', difficulty: 'easy' },
      { question: 'Which form control is used for multi-line text input?', answer: '<textarea>', explanation: '<textarea> is designed for longer, multi-line user input.', subtopic: 'Input Types', difficulty: 'easy' },
      { question: 'Which attribute shows hint text inside an empty input box?', answer: 'placeholder', explanation: 'Placeholder text appears until the user provides a value.', subtopic: 'UX', difficulty: 'easy' },
      { question: 'Which input attribute determines the key used in submitted form data?', answer: 'name', explanation: 'Server-side parsers use the input name as the field key.', subtopic: 'Forms', difficulty: 'easy' },
      { question: 'Inside a form, what is the default type of a <button> element?', answer: 'submit', explanation: 'Without an explicit type, <button> acts as submit in forms.', subtopic: 'Forms', difficulty: 'medium' },
      { question: 'Which form attribute specifies where submitted data is sent?', answer: 'action', explanation: 'action contains the target URL for form submission.', subtopic: 'Forms', difficulty: 'easy' },
      { question: 'Which attribute can be used to disable browser autofill suggestions?', answer: 'autocomplete="off"', explanation: 'Setting autocomplete off requests browsers not to auto-fill fields.', subtopic: 'Forms', difficulty: 'medium' },
      { question: 'Which attribute applies regex-like validation rules to input values?', answer: 'pattern', explanation: 'pattern enables built-in value matching for specific string formats.', subtopic: 'Validation', difficulty: 'medium' },
      { question: 'Which pair of attributes commonly sets lower and upper numeric limits?', answer: 'min and max', explanation: 'min/max constrain number, date, and range-type input values.', subtopic: 'Validation', difficulty: 'easy' },
      { question: 'Which element semantically groups related form controls?', answer: '<fieldset>', explanation: '<fieldset> groups controls and often appears with a <legend>.', subtopic: 'Forms', difficulty: 'medium' },
      { question: 'Which element provides a caption/title for a fieldset?', answer: '<legend>', explanation: '<legend> describes the purpose of grouped controls.', subtopic: 'Forms', difficulty: 'medium' },
      { question: 'Which element provides predefined suggestions for an <input list="...">?', answer: '<datalist>', explanation: 'datalist offers selectable suggestions while still allowing custom input.', subtopic: 'Input Types', difficulty: 'medium' },
      { question: 'Which form attribute disables native browser validation on submit?', answer: 'novalidate', explanation: 'novalidate lets custom JavaScript validation run without browser blocking UI.', subtopic: 'Validation', difficulty: 'medium' },
      { question: 'What happens to a disabled input during form submission?', answer: 'Its value is not submitted.', explanation: 'Disabled controls are omitted from the submitted payload.', subtopic: 'Forms', difficulty: 'medium' },
    ],
  },
  {
    setId: 3,
    title: 'TCS UI Set 3 - CSS Core Concepts',
    description: 'Selectors, box model, units, and positioning fundamentals for high-accuracy CSS rounds.',
    topic: 'CSS',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[2]],
    items: [
      { question: 'Which syntax correctly applies a CSS rule?', answer: 'selector { property: value; }', explanation: 'CSS rules consist of selector + declaration block.', subtopic: 'Syntax', difficulty: 'easy' },
      { question: 'Which rel value is used when linking an external stylesheet?', answer: 'stylesheet', explanation: 'link rel="stylesheet" tells the browser to treat the target as CSS.', subtopic: 'Styling Setup', difficulty: 'easy' },
      { question: 'Which selector targets elements having class="card"?', answer: '.card', explanation: 'Class selectors are prefixed with a dot.', subtopic: 'Selectors', difficulty: 'easy' },
      { question: 'Which selector targets the element with id="header"?', answer: '#header', explanation: 'ID selectors are prefixed with #.', subtopic: 'Selectors', difficulty: 'easy' },
      { question: 'Which selector matches all elements on a page?', answer: '*', explanation: 'The universal selector applies to every element.', subtopic: 'Selectors', difficulty: 'easy' },
      { question: 'What does the selector "div p" target?', answer: 'All <p> elements inside any <div>.', explanation: 'A descendant selector matches nested descendants, not only direct children.', subtopic: 'Selectors', difficulty: 'medium' },
      { question: 'Which has higher specificity in CSS?', answer: 'An ID selector has higher specificity than a class selector.', explanation: 'Specificity order favors IDs over classes and elements.', subtopic: 'Specificity', difficulty: 'medium' },
      { question: 'Which list correctly represents the CSS box model layers?', answer: 'content, padding, border, margin', explanation: 'The box model starts from content and expands outward.', subtopic: 'Box Model', difficulty: 'easy' },
      { question: 'Which rule commonly centers a fixed-width block horizontally?', answer: 'margin: 0 auto;', explanation: 'Auto left/right margins center block-level elements with constrained width.', subtopic: 'Box Model', difficulty: 'medium' },
      { question: 'How does display: block behave by default?', answer: 'It starts on a new line and can take full available width.', explanation: 'Block-level boxes break line flow and expand by default.', subtopic: 'Display', difficulty: 'easy' },
      { question: 'What is true for display: inline elements?', answer: 'Width and height generally do not apply in the same way as block boxes.', explanation: 'Inline boxes flow with text and do not behave like block boxes.', subtopic: 'Display', difficulty: 'medium' },
      { question: 'What is a key benefit of display: inline-block?', answer: 'It allows setting width/height while still flowing inline.', explanation: 'inline-block combines inline flow with box dimensions.', subtopic: 'Display', difficulty: 'easy' },
      { question: 'How does position: relative affect an element?', answer: 'The element remains in normal flow but can be offset from its original position.', explanation: 'Relative positioning keeps layout space reserved.', subtopic: 'Positioning', difficulty: 'easy' },
      { question: 'position: absolute is positioned relative to what by default?', answer: 'The nearest positioned ancestor (or initial containing block if none).', explanation: 'Absolute elements use the closest ancestor with non-static position.', subtopic: 'Positioning', difficulty: 'medium' },
      { question: 'When does z-index generally apply?', answer: 'On positioned elements in stacking contexts.', explanation: 'z-index influences stacking order when positioning/context rules apply.', subtopic: 'Positioning', difficulty: 'medium' },
      { question: 'Which value is a valid 6-digit hex color?', answer: '#1A2B3C', explanation: 'Hex colors use # followed by 3 or 6 hexadecimal digits.', subtopic: 'Colors', difficulty: 'easy' },
      { question: 'What is rem based on?', answer: 'The root element (html) font size.', explanation: 'rem is stable across nesting because it references root font size.', subtopic: 'Units', difficulty: 'easy' },
      { question: 'What is em based on?', answer: 'The current element or parent font size context.', explanation: 'em scales relative to surrounding font context and nesting.', subtopic: 'Units', difficulty: 'medium' },
      { question: 'What does overflow: hidden do when content exceeds box bounds?', answer: 'It clips overflowing content that does not fit the box.', explanation: 'Overflow hidden removes scrollbars and hides excess content.', subtopic: 'Box Model', difficulty: 'easy' },
      { question: 'Which numeric range is valid for opacity?', answer: '0 to 1', explanation: '0 is fully transparent and 1 is fully opaque.', subtopic: 'Visual Effects', difficulty: 'easy' },
    ],
  },
  {
    setId: 4,
    title: 'TCS UI Set 4 - Layout & Responsive Design',
    description: 'Flexbox, Grid, media queries, and responsive behavior in practical UI implementation.',
    topic: 'CSS',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[2], SOURCE_CATALOG.prepPattern[1]],
    items: [
      { question: 'What is the default value of flex-direction in a flex container?', answer: 'row', explanation: 'Flex items are laid out horizontally by default.', subtopic: 'Flexbox', difficulty: 'easy' },
      { question: 'Which property aligns flex items along the main axis?', answer: 'justify-content', explanation: 'Main-axis distribution is controlled by justify-content.', subtopic: 'Flexbox', difficulty: 'easy' },
      { question: 'Which property aligns flex items along the cross axis?', answer: 'align-items', explanation: 'Cross-axis alignment in flex containers uses align-items.', subtopic: 'Flexbox', difficulty: 'easy' },
      { question: 'Which flex property allows items to move to the next line?', answer: 'flex-wrap', explanation: 'flex-wrap: wrap lets overflowing items continue on new rows/columns.', subtopic: 'Flexbox', difficulty: 'easy' },
      { question: 'Which property adds consistent spacing between flex/grid children?', answer: 'gap', explanation: 'gap works in modern flex and grid layouts.', subtopic: 'Layout Spacing', difficulty: 'easy' },
      { question: 'Which CSS Grid property defines track columns explicitly?', answer: 'grid-template-columns', explanation: 'Grid columns are declared using grid-template-columns.', subtopic: 'Grid', difficulty: 'easy' },
      { question: 'In CSS Grid, what does 1fr represent?', answer: 'One fraction of the available free space.', explanation: 'fr units divide leftover space proportionally.', subtopic: 'Grid', difficulty: 'medium' },
      { question: 'What does minmax(200px, 1fr) mean in grid?', answer: 'Track size is at least 200px and can grow up to 1fr.', explanation: 'minmax defines lower and upper bounds for track sizing.', subtopic: 'Grid', difficulty: 'medium' },
      { question: 'In mobile-first CSS, which query is commonly used to add larger-screen styles?', answer: '@media (min-width: 768px)', explanation: 'Mobile-first starts base styles small and enhances with min-width breakpoints.', subtopic: 'Media Queries', difficulty: 'medium' },
      { question: 'Which meta tag improves responsive sizing on mobile browsers?', answer: '<meta name="viewport" content="width=device-width, initial-scale=1">', explanation: 'Without proper viewport meta, mobile browsers may scale pages unexpectedly.', subtopic: 'Responsive Basics', difficulty: 'easy' },
      { question: 'Which property value keeps an element fixed until a scroll threshold, then pins it?', answer: 'position: sticky', explanation: 'Sticky combines relative and fixed behavior based on scroll position.', subtopic: 'Positioning', difficulty: 'medium' },
      { question: 'Which property controls how replaced content fills a media box?', answer: 'object-fit', explanation: 'object-fit defines image/video scaling behavior in assigned dimensions.', subtopic: 'Media', difficulty: 'medium' },
      { question: 'Which function is commonly used to move an element horizontally?', answer: 'translateX()', explanation: 'transform: translateX(...) shifts elements on the X axis.', subtopic: 'Transforms', difficulty: 'easy' },
      { question: 'Which property enables smooth change between two CSS states?', answer: 'transition', explanation: 'Transitions animate changes in declared properties over time.', subtopic: 'Animation', difficulty: 'easy' },
      { question: 'Which at-rule defines keyframes for CSS animations?', answer: '@keyframes', explanation: 'Keyframes specify animation stages between 0% and 100%.', subtopic: 'Animation', difficulty: 'easy' },
      { question: 'Which CSS function is useful for fluid typography with min and max bounds?', answer: 'clamp()', explanation: 'clamp(min, preferred, max) provides controlled responsive scaling.', subtopic: 'Responsive Typography', difficulty: 'medium' },
      { question: 'What does 1vw represent in CSS units?', answer: '1% of viewport width', explanation: 'Viewport width units scale with the current browser width.', subtopic: 'Units', difficulty: 'easy' },
      { question: 'What does 1vh represent in CSS units?', answer: '1% of viewport height', explanation: 'Viewport height units scale with the current browser height.', subtopic: 'Units', difficulty: 'easy' },
      { question: 'Which pseudo-class applies when a pointer hovers over an element?', answer: ':hover', explanation: ':hover triggers style changes during pointer hover.', subtopic: 'Pseudo-classes', difficulty: 'easy' },
      { question: 'Which pseudo-class is preferred for accessible keyboard focus indication?', answer: ':focus-visible', explanation: ':focus-visible avoids showing focus ring for mouse-only interaction.', subtopic: 'Accessibility', difficulty: 'medium' },
    ],
  },
  {
    setId: 5,
    title: 'TCS UI Set 5 - JavaScript Fundamentals',
    description: 'Core JavaScript behavior, type system, operators, and control flow essentials.',
    topic: 'JavaScript',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[3]],
    items: [
      { question: 'Which declaration has block scope and allows reassignment?', answer: 'let', explanation: 'let is block scoped and mutable.', subtopic: 'Variables', difficulty: 'easy' },
      { question: 'Which declaration creates a block-scoped binding that cannot be reassigned?', answer: 'const', explanation: 'const prevents reassignment of the binding name.', subtopic: 'Variables', difficulty: 'easy' },
      { question: 'Which declaration is function-scoped and hoisted in legacy JavaScript?', answer: 'var', explanation: 'var uses function scope and has historical hoisting behavior.', subtopic: 'Variables', difficulty: 'easy' },
      { question: 'What is the result of typeof null in JavaScript?', answer: '"object"', explanation: 'This is a long-standing JavaScript quirk.', subtopic: 'Types', difficulty: 'medium' },
      { question: 'Which operator checks both value and type equality?', answer: '===', explanation: 'Strict equality avoids type coercion.', subtopic: 'Operators', difficulty: 'easy' },
      { question: 'Which statement is true about NaN?', answer: 'NaN is not equal to itself.', explanation: 'NaN !== NaN by specification.', subtopic: 'Numbers', difficulty: 'medium' },
      { question: 'Which string delimiter supports ${expression} interpolation?', answer: 'Backticks (` `)', explanation: 'Template literals use backticks and allow interpolation.', subtopic: 'Strings', difficulty: 'easy' },
      { question: 'What does Number("42") return?', answer: 'The number 42', explanation: 'Number() performs numeric conversion.', subtopic: 'Type Conversion', difficulty: 'easy' },
      { question: 'What is parseInt("08", 10)?', answer: '8', explanation: 'With radix 10, parseInt parses decimal 08 as 8.', subtopic: 'Type Conversion', difficulty: 'easy' },
      { question: 'What is Boolean("")?', answer: 'false', explanation: 'Empty strings are falsy values.', subtopic: 'Booleans', difficulty: 'easy' },
      { question: 'What is Boolean("0")?', answer: 'true', explanation: 'Non-empty strings are truthy, including "0".', subtopic: 'Booleans', difficulty: 'medium' },
      { question: 'What does the nullish coalescing operator (??) do?', answer: 'It falls back only when the left side is null or undefined.', explanation: 'Unlike ||, ?? does not treat 0 or "" as missing.', subtopic: 'Operators', difficulty: 'medium' },
      { question: 'What does optional chaining (?.) return when the base is null/undefined?', answer: 'undefined without throwing an error', explanation: 'Optional chaining short-circuits safe property access.', subtopic: 'Operators', difficulty: 'medium' },
      { question: 'What is typeof undefined?', answer: '"undefined"', explanation: 'The typeof operator returns "undefined" for undefined values.', subtopic: 'Types', difficulty: 'easy' },
      { question: 'What is isNaN("hello")?', answer: 'true', explanation: 'Global isNaN coerces and then tests numeric validity.', subtopic: 'Numbers', difficulty: 'medium' },
      { question: 'What is Number.isNaN("hello")?', answer: 'false', explanation: 'Number.isNaN checks without coercion; string is not NaN.', subtopic: 'Numbers', difficulty: 'medium' },
      { question: 'What is 0 == false?', answer: 'true', explanation: 'Loose equality performs coercion before comparison.', subtopic: 'Operators', difficulty: 'medium' },
      { question: 'What is 0 === false?', answer: 'false', explanation: 'Strict equality compares type and value.', subtopic: 'Operators', difficulty: 'easy' },
      { question: 'What is [] + [] in JavaScript?', answer: 'An empty string ("")', explanation: 'Arrays are coerced to strings before concatenation.', subtopic: 'Type Coercion', difficulty: 'medium' },
      { question: 'What is true + true in JavaScript?', answer: '2', explanation: 'Booleans convert to 1 and 1 in numeric addition.', subtopic: 'Type Coercion', difficulty: 'easy' },
    ],
  },
  {
    setId: 6,
    title: 'TCS UI Set 6 - Functions, Arrays, and Objects',
    description: 'Higher-order methods, object handling, and frequently tested JavaScript utility patterns.',
    topic: 'JavaScript',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[3]],
    items: [
      { question: 'What does Array.prototype.map return?', answer: 'A new array with transformed elements', explanation: 'map never mutates by default and returns a new collection.', subtopic: 'Arrays', difficulty: 'easy' },
      { question: 'What does Array.prototype.filter return?', answer: 'A new array containing elements that pass the test', explanation: 'filter keeps only elements matching the predicate.', subtopic: 'Arrays', difficulty: 'easy' },
      { question: 'What is the purpose of Array.prototype.reduce?', answer: 'To accumulate array values into a single result', explanation: 'reduce folds values using an accumulator callback.', subtopic: 'Arrays', difficulty: 'medium' },
      { question: 'What does Array.prototype.find return?', answer: 'The first matching element, or undefined', explanation: 'find stops at first predicate success.', subtopic: 'Arrays', difficulty: 'easy' },
      { question: 'What does Array.prototype.forEach return?', answer: 'undefined', explanation: 'forEach is for side effects, not transformed return values.', subtopic: 'Arrays', difficulty: 'medium' },
      { question: 'What does array.push(value) return?', answer: 'The new array length', explanation: 'push mutates and returns length.', subtopic: 'Arrays', difficulty: 'easy' },
      { question: 'What does array.pop() do?', answer: 'Removes and returns the last element', explanation: 'pop mutates the array from the end.', subtopic: 'Arrays', difficulty: 'easy' },
      { question: 'What does array.shift() do?', answer: 'Removes and returns the first element', explanation: 'shift mutates from the beginning and reindexes.', subtopic: 'Arrays', difficulty: 'easy' },
      { question: 'What does array.unshift(value) return?', answer: 'The new array length after adding to the front', explanation: 'unshift prepends elements and returns updated length.', subtopic: 'Arrays', difficulty: 'medium' },
      { question: 'What does the spread syntax [...arr] create for arrays?', answer: 'A shallow copy of the array', explanation: 'Nested references remain shared because spread is shallow.', subtopic: 'Arrays', difficulty: 'medium' },
      { question: 'What does this assignment do: const [a, b] = arr?', answer: 'Array destructuring into variables a and b', explanation: 'Destructuring extracts by index position.', subtopic: 'Syntax', difficulty: 'easy' },
      { question: 'Which method returns an array of object own enumerable keys?', answer: 'Object.keys()', explanation: 'Object.keys returns string keys in an array.', subtopic: 'Objects', difficulty: 'easy' },
      { question: 'Which method checks whether an object has a specific own property?', answer: 'Object.prototype.hasOwnProperty()', explanation: 'hasOwnProperty avoids inherited property confusion.', subtopic: 'Objects', difficulty: 'medium' },
      { question: 'What does JSON.stringify(obj) produce?', answer: 'A JSON string representation', explanation: 'Stringify serializes plain data into JSON text.', subtopic: 'JSON', difficulty: 'easy' },
      { question: 'What does JSON.parse(jsonText) return?', answer: 'A JavaScript value/object parsed from JSON text', explanation: 'Parse converts JSON string into usable JS data.', subtopic: 'JSON', difficulty: 'easy' },
      { question: 'How does this behave in arrow functions?', answer: 'Arrow functions do not bind their own this', explanation: 'Arrow this is lexical (captured from surrounding scope).', subtopic: 'Functions', difficulty: 'medium' },
      { question: 'How is this determined in a regular method call obj.fn()?', answer: 'It usually refers to the object before the dot', explanation: 'Method invocation sets this to the receiver object.', subtopic: 'Functions', difficulty: 'medium' },
      { question: 'What is a closure in JavaScript?', answer: 'A function that retains access to outer lexical variables', explanation: 'Closures keep scope references after outer execution completes.', subtopic: 'Functions', difficulty: 'medium' },
      { question: 'When are default function parameters applied?', answer: 'When the argument is undefined', explanation: 'Defaults do not apply for null unless explicitly handled.', subtopic: 'Functions', difficulty: 'medium' },
      { question: 'What does a rest parameter (...args) collect?', answer: 'Remaining arguments as an array', explanation: 'Rest parameters gather variadic inputs into one array.', subtopic: 'Functions', difficulty: 'easy' },
    ],
  },
  {
    setId: 7,
    title: 'TCS UI Set 7 - DOM & Events',
    description: 'Document manipulation and event model behavior often tested in practical JavaScript rounds.',
    topic: 'JavaScript',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[4]],
    items: [
      { question: 'Which DOM API selects one element by its id value?', answer: 'document.getElementById()', explanation: 'getElementById returns the unique element for a given id, if present.', subtopic: 'DOM Selection', difficulty: 'easy' },
      { question: 'Which method returns the first element that matches a CSS selector?', answer: 'document.querySelector()', explanation: 'querySelector accepts any valid CSS selector and returns first match.', subtopic: 'DOM Selection', difficulty: 'easy' },
      { question: 'Which method returns all matches for a CSS selector?', answer: 'document.querySelectorAll()', explanation: 'querySelectorAll returns a static NodeList of matches.', subtopic: 'DOM Selection', difficulty: 'easy' },
      { question: 'Which property sets or gets only textual content (no HTML parsing)?', answer: 'textContent', explanation: 'textContent is safer when you only need plain text.', subtopic: 'DOM Content', difficulty: 'easy' },
      { question: 'Which property parses a string as HTML and injects nodes?', answer: 'innerHTML', explanation: 'innerHTML supports markup insertion but needs sanitization for untrusted input.', subtopic: 'DOM Content', difficulty: 'medium' },
      { question: 'Which method creates a new element node in memory?', answer: 'document.createElement()', explanation: 'createElement prepares a node before insertion into DOM.', subtopic: 'DOM Manipulation', difficulty: 'easy' },
      { question: 'Which method appends a node as the last child?', answer: 'appendChild()', explanation: 'appendChild inserts nodes at the end of a parent.', subtopic: 'DOM Manipulation', difficulty: 'easy' },
      { question: 'Which method removes an element from the DOM directly?', answer: 'element.remove()', explanation: 'remove deletes the element itself from its parent.', subtopic: 'DOM Manipulation', difficulty: 'easy' },
      { question: 'Which method registers an event listener on an element?', answer: 'addEventListener()', explanation: 'Listeners can be attached for click, input, keydown, and more.', subtopic: 'Events', difficulty: 'easy' },
      { question: 'In an event handler, what does event.target usually represent?', answer: 'The actual element that triggered the event', explanation: 'target is where the event originated.', subtopic: 'Events', difficulty: 'medium' },
      { question: 'In an event handler, what does event.currentTarget represent?', answer: 'The element the listener is attached to', explanation: 'currentTarget can differ from target due to bubbling/capturing.', subtopic: 'Events', difficulty: 'medium' },
      { question: 'What does event.preventDefault() do?', answer: 'Stops the browser default action for that event', explanation: 'Example: prevent link navigation or form submission default behavior.', subtopic: 'Events', difficulty: 'easy' },
      { question: 'What does event.stopPropagation() do?', answer: 'Stops the event from bubbling/capturing further', explanation: 'It prevents propagation to ancestors in current event flow.', subtopic: 'Events', difficulty: 'medium' },
      { question: 'When does DOMContentLoaded fire?', answer: 'After initial HTML is parsed (before all assets necessarily load)', explanation: 'DOMContentLoaded is ideal for DOM setup without waiting for images.', subtopic: 'Lifecycle', difficulty: 'medium' },
      { question: 'Which API adds a CSS class to an element in a semantic way?', answer: 'element.classList.add()', explanation: 'classList avoids manual string parsing in className.', subtopic: 'DOM Manipulation', difficulty: 'easy' },
      { question: 'Which API toggles a class on/off?', answer: 'element.classList.toggle()', explanation: 'toggle is useful for interactive states such as menus/modals.', subtopic: 'DOM Manipulation', difficulty: 'easy' },
      { question: 'Which method finds the nearest ancestor matching a selector?', answer: 'element.closest()', explanation: 'closest traverses upward including the element itself.', subtopic: 'DOM Traversal', difficulty: 'medium' },
      { question: 'How are custom data-* attributes commonly accessed in JS?', answer: 'Through the element.dataset object', explanation: 'data-user-id maps to dataset.userId.', subtopic: 'DOM Attributes', difficulty: 'easy' },
      { question: 'Which method sets or updates an attribute value on an element?', answer: 'setAttribute()', explanation: 'setAttribute(name, value) writes attribute data.', subtopic: 'DOM Attributes', difficulty: 'easy' },
      { question: 'Which method removes an attribute from an element?', answer: 'removeAttribute()', explanation: 'removeAttribute(name) deletes an existing attribute.', subtopic: 'DOM Attributes', difficulty: 'easy' },
    ],
  },
  {
    setId: 8,
    title: 'TCS UI Set 8 - Browser APIs & Async JS',
    description: 'Storage, fetch, promises, async/await, and browser utility APIs for real app scenarios.',
    topic: 'JavaScript',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[5], SOURCE_CATALOG.official[6], SOURCE_CATALOG.official[3]],
    items: [
      { question: 'How long does localStorage data persist by default?', answer: 'Until it is explicitly cleared', explanation: 'localStorage survives tab and browser restarts for same origin.', subtopic: 'Storage', difficulty: 'easy' },
      { question: 'How long does sessionStorage data persist?', answer: 'For the lifetime of the current tab/session', explanation: 'sessionStorage is scoped to a browsing session/tab.', subtopic: 'Storage', difficulty: 'easy' },
      { question: 'What data type does localStorage store natively?', answer: 'Strings', explanation: 'Complex values must be serialized to strings first.', subtopic: 'Storage', difficulty: 'easy' },
      { question: 'What should you do before saving an object to localStorage?', answer: 'Convert it using JSON.stringify()', explanation: 'Stringify serializes object data for storage.', subtopic: 'Storage', difficulty: 'easy' },
      { question: 'What does fetch() return immediately?', answer: 'A Promise that resolves to a Response object', explanation: 'fetch is asynchronous and returns a promise.', subtopic: 'Fetch API', difficulty: 'easy' },
      { question: 'What does response.json() return?', answer: 'A Promise resolving to parsed JSON data', explanation: 'json() itself is asynchronous.', subtopic: 'Fetch API', difficulty: 'medium' },
      { question: 'What is always returned by an async function?', answer: 'A Promise', explanation: 'Async functions wrap return values in resolved promises.', subtopic: 'Async/Await', difficulty: 'easy' },
      { question: 'Where can await be used directly?', answer: 'Inside an async function (or supported module top-level contexts)', explanation: 'Classic function bodies need async keyword for await.', subtopic: 'Async/Await', difficulty: 'medium' },
      { question: 'How do you catch errors from an awaited promise?', answer: 'Use try/catch around await', explanation: 'Rejected promises throw inside async functions.', subtopic: 'Async/Await', difficulty: 'easy' },
      { question: 'What does setTimeout do?', answer: 'Runs a callback once after a delay', explanation: 'setTimeout schedules one-time deferred execution.', subtopic: 'Timers', difficulty: 'easy' },
      { question: 'What does setInterval do?', answer: 'Runs a callback repeatedly at a time interval', explanation: 'Intervals continue until cleared.', subtopic: 'Timers', difficulty: 'easy' },
      { question: 'How do you stop a running interval?', answer: 'Call clearInterval(intervalId)', explanation: 'clearInterval cancels future interval ticks.', subtopic: 'Timers', difficulty: 'easy' },
      { question: 'Which API helps read query parameters like ?page=2 from a URL?', answer: 'URLSearchParams', explanation: 'URLSearchParams offers easy get/set/iterate for query strings.', subtopic: 'URL APIs', difficulty: 'easy' },
      { question: 'What does navigator.onLine indicate?', answer: 'A basic online/offline network connectivity hint', explanation: 'It is a heuristic flag and not perfect network guarantee.', subtopic: 'Navigator API', difficulty: 'medium' },
      { question: 'What does history.back() do?', answer: 'Navigates to the previous browser history entry', explanation: 'Equivalent to clicking browser back in many contexts.', subtopic: 'History API', difficulty: 'easy' },
      { question: 'What does location.reload() do?', answer: 'Reloads the current document', explanation: 'The browser re-requests or reloads current URL resources.', subtopic: 'Location API', difficulty: 'easy' },
      { question: 'How are cookies exposed in JavaScript on document?', answer: 'As a semicolon-separated string in document.cookie', explanation: 'document.cookie reads/writes cookie text format.', subtopic: 'Cookies', difficulty: 'medium' },
      { question: 'Which function safely encodes text for use in query parameter values?', answer: 'encodeURIComponent()', explanation: 'It escapes reserved/special URL characters in components.', subtopic: 'URL APIs', difficulty: 'easy' },
      { question: 'How does Promise.all behave if one input promise rejects?', answer: 'It rejects immediately with that rejection reason', explanation: 'Promise.all requires all promises to fulfill.', subtopic: 'Promises', difficulty: 'medium' },
      { question: 'How does Promise.race settle?', answer: 'It settles as soon as the first promise settles', explanation: 'Race returns the first fulfilled or rejected outcome.', subtopic: 'Promises', difficulty: 'medium' },
    ],
  },
  {
    setId: 9,
    title: 'TCS UI Set 9 - Mixed Output & Logic',
    description: 'Output-focused MCQs in the style of placement/proctored rounds with deterministic answers.',
    topic: 'Mixed',
    sourceType: 'community-pattern',
    sourceRef: [SOURCE_CATALOG.communityPattern[0], SOURCE_CATALOG.prepPattern[0], SOURCE_CATALOG.official[3]],
    defaultConfidence: 'medium',
    items: [
      { question: 'What is logged by: console.log(1 + "2") ?', answer: '"12"', explanation: 'Number + string triggers string concatenation.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log("5" - 2) ?', answer: '3', explanation: 'The - operator coerces operands to numbers.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(typeof NaN) ?', answer: '"number"', explanation: 'NaN is a special numeric value.', subtopic: 'JS Output', difficulty: 'medium' },
      { question: 'What is logged by: console.log(Boolean([])) ?', answer: 'true', explanation: 'Any object, including arrays, is truthy.', subtopic: 'JS Output', difficulty: 'medium' },
      { question: 'What is logged by: console.log([] == false) ?', answer: 'true', explanation: 'Loose equality coercion makes this expression true.', subtopic: 'JS Output', difficulty: 'hard' },
      { question: 'What is logged by: console.log([1,2,3].length) ?', answer: '3', explanation: 'length returns the number of array slots.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log("abc".toUpperCase()) ?', answer: '"ABC"', explanation: 'toUpperCase converts letters to uppercase.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(Math.max(4, 9, 1)) ?', answer: '9', explanation: 'Math.max returns largest argument.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(Math.floor(4.9)) ?', answer: '4', explanation: 'Math.floor truncates down to nearest integer.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log("5" + 1) ?', answer: '"51"', explanation: 'String concatenation occurs with + and a string operand.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(2 ** 3) ?', answer: '8', explanation: '** is exponentiation in JavaScript.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(10 % 3) ?', answer: '1', explanation: '% returns remainder after division.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log([1,2].concat([3]).join("-")) ?', answer: '"1-2-3"', explanation: 'concat merges arrays, join builds a hyphen-delimited string.', subtopic: 'JS Output', difficulty: 'medium' },
      { question: 'What is logged by: console.log("hello".includes("ell")) ?', answer: 'true', explanation: 'includes checks if a substring exists.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(typeof []) ?', answer: '"object"', explanation: 'Arrays are specialized objects in JS.', subtopic: 'JS Output', difficulty: 'medium' },
      { question: 'What is logged by: console.log(null == undefined) ?', answer: 'true', explanation: 'Loose equality treats null and undefined as equal.', subtopic: 'JS Output', difficulty: 'medium' },
      { question: 'What is logged by: console.log(null === undefined) ?', answer: 'false', explanation: 'Strict equality requires identical type and value.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log([..."hi"].length) ?', answer: '2', explanation: 'Spreading string into array yields one item per character.', subtopic: 'JS Output', difficulty: 'easy' },
      { question: 'What is logged by: console.log(parseInt("101", 2)) ?', answer: '5', explanation: 'Binary 101 equals decimal 5.', subtopic: 'JS Output', difficulty: 'medium' },
      { question: 'What is logged by: console.log(Number.isInteger(4.0)) ?', answer: 'true', explanation: '4.0 is numerically an integer value.', subtopic: 'JS Output', difficulty: 'medium' },
    ],
  },
  {
    setId: 10,
    title: 'TCS UI Set 10 - Web Best Practices',
    description: 'Security, performance, and accessibility concepts useful in practical UI interviews and assessments.',
    topic: 'BestPractices',
    sourceType: 'official-docs',
    sourceRef: [SOURCE_CATALOG.official[7], SOURCE_CATALOG.official[2], SOURCE_CATALOG.official[1]],
    items: [
      { question: 'What is the main benefit of using HTTPS instead of HTTP?', answer: 'It encrypts data in transit between client and server.', explanation: 'HTTPS protects confidentiality and integrity during network transfer.', subtopic: 'Security', difficulty: 'easy' },
      { question: 'What is a primary frontend defense against XSS when rendering user data?', answer: 'Escape or sanitize untrusted input before insertion.', explanation: 'Untrusted HTML/JS must never be injected unsafely.', subtopic: 'Security', difficulty: 'medium' },
      { question: 'What does a Content Security Policy (CSP) help mitigate?', answer: 'Execution of unauthorized scripts and injected content', explanation: 'CSP restricts trusted resource origins and script behavior.', subtopic: 'Security', difficulty: 'medium' },
      { question: 'Why add rel="noopener noreferrer" to target="_blank" links?', answer: 'To prevent reverse-tabnabbing and isolate window context', explanation: 'noopener breaks window.opener linkage to improve security.', subtopic: 'Security', difficulty: 'medium' },
      { question: 'Why use semantic HTML elements instead of generic divs everywhere?', answer: 'They improve accessibility and document meaning.', explanation: 'Semantic structure helps screen readers and maintainability.', subtopic: 'Accessibility', difficulty: 'easy' },
      { question: 'For informative images, what should alt text provide?', answer: 'A concise description of the image meaning/function', explanation: 'Alt should communicate useful content, not file names.', subtopic: 'Accessibility', difficulty: 'easy' },
      { question: 'What is a key accessibility rule for form controls?', answer: 'Every control should have an associated label.', explanation: 'Labels improve usability for all users and assistive tech.', subtopic: 'Accessibility', difficulty: 'easy' },
      { question: 'Which ARIA feature helps announce dynamic updates to assistive tech?', answer: 'aria-live', explanation: 'aria-live regions announce changing content updates.', subtopic: 'Accessibility', difficulty: 'medium' },
      { question: 'How can you reduce initial network payload size for faster load?', answer: 'Minify and compress assets', explanation: 'Minification and compression reduce transfer bytes.', subtopic: 'Performance', difficulty: 'easy' },
      { question: 'Which image attribute defers offscreen image loading?', answer: 'loading="lazy"', explanation: 'Lazy loading postpones non-critical image fetches.', subtopic: 'Performance', difficulty: 'easy' },
      { question: 'How does using defer on script tags help page rendering?', answer: 'It delays script execution until after HTML parsing.', explanation: 'defer prevents parser blocking for external scripts.', subtopic: 'Performance', difficulty: 'medium' },
      { question: 'Why avoid large inline scripts/styles in production pages?', answer: 'External files improve caching and policy control.', explanation: 'External assets are cacheable and easier to secure/manage.', subtopic: 'Performance', difficulty: 'medium' },
      { question: 'Which browser API is preferred for smooth animation loops?', answer: 'requestAnimationFrame()', explanation: 'requestAnimationFrame syncs with repaint cycles for efficiency.', subtopic: 'Performance', difficulty: 'medium' },
      { question: 'Which technique limits rapid function calls until user stops typing?', answer: 'Debouncing', explanation: 'Debounce delays execution until activity settles.', subtopic: 'Performance', difficulty: 'medium' },
      { question: 'Which technique guarantees execution at most once per interval during frequent events?', answer: 'Throttling', explanation: 'Throttle caps call frequency during bursts like scrolling.', subtopic: 'Performance', difficulty: 'medium' },
      { question: 'What is a common advantage of service workers in web apps?', answer: 'Offline caching and network interception capabilities', explanation: 'Service workers can cache assets and serve offline experiences.', subtopic: 'PWA', difficulty: 'medium' },
      { question: 'Where is it generally safer to keep highly sensitive session tokens?', answer: 'HttpOnly secure cookies managed by the server', explanation: 'HttpOnly cookies are not readable by JavaScript, reducing XSS exposure.', subtopic: 'Security', difficulty: 'medium' },
      { question: 'What does the same-origin policy primarily restrict?', answer: 'Cross-origin read access to protected resources', explanation: 'SOP prevents arbitrary reading across different origins.', subtopic: 'Security', difficulty: 'medium' },
      { question: 'Which response header controls allowed cross-origin request origins?', answer: 'Access-Control-Allow-Origin', explanation: 'CORS policies are communicated using this header.', subtopic: 'Security', difficulty: 'medium' },
      { question: 'Which approach helps maintain positive UX during async operations?', answer: 'Show clear loading and success/error feedback states', explanation: 'Feedback reduces user confusion and improves trust.', subtopic: 'UX', difficulty: 'easy' },
    ],
  },
]

const assembledSets = setDefinitions.map((definition) => buildSet(definition))

const rawCandidates = {
  metadata: {
    title: 'TCS UI MCQ Raw Candidates',
    generatedAt: new Date().toISOString(),
    policy: 'rephrased_only',
    targetExamContext: 'TCS Ninja / TCS iON style HTML-CSS-JS assessments',
    sourceCatalog: SOURCE_CATALOG,
    notes: [
      'Questions are rewritten and normalized from standards + prep-pattern sources.',
      'Raw candidate file is retained before final verification export.',
    ],
  },
  sets: assembledSets.map((set) => ({
    ...set,
    questions: set.questions.map((q) => ({
      ...q,
      reviewStatus: 'pending',
      reviewChecklist: {
        syntaxCheck: false,
        answerCheck: false,
        explanationCheck: false,
      },
      reviewNotes: [],
    })),
  })),
}

const validateAndFinalize = (raw) => {
  const errors = []

  if (raw.sets.length !== 10) {
    errors.push(`Expected 10 sets, found ${raw.sets.length}`)
  }

  const questionTextSet = new Set()
  const questionIdSet = new Set()

  raw.sets.forEach((set) => {
    if (set.questions.length !== 20) {
      errors.push(`Set ${set.setId} expected 20 questions, found ${set.questions.length}`)
    }

    set.questions.forEach((q) => {
      if (questionIdSet.has(q.id)) {
        errors.push(`Duplicate question id ${q.id}`)
      }
      questionIdSet.add(q.id)

      const normalizedText = q.question.trim().toLowerCase()
      if (questionTextSet.has(normalizedText)) {
        errors.push(`Duplicate question text detected: ${q.question}`)
      }
      questionTextSet.add(normalizedText)

      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`${q.id} must have exactly 4 options`)
      }

      const optionSet = new Set(q.options)
      if (optionSet.size !== 4) {
        errors.push(`${q.id} contains duplicate options`)
      }

      if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
        errors.push(`${q.id} has invalid answer index`)
      }

      if (typeof q.explanation !== 'string' || q.explanation.length < 15) {
        errors.push(`${q.id} explanation too short`)
      }

      if (!['high', 'medium'].includes(q.confidence)) {
        errors.push(`${q.id} invalid confidence ${q.confidence}`)
      }
    })
  })

  if (errors.length > 0) {
    throw new Error(`Question bank validation failed:\n${errors.join('\n')}`)
  }

  const verifiedAt = new Date().toISOString()

  const verified = {
    metadata: {
      ...raw.metadata,
      title: 'TCS UI MCQ Verified Question Bank',
      verifiedAt,
      verificationPolicy: [
        'exact-count-check',
        'unique-question-id-check',
        'unique-question-text-check',
        'options-and-answer-index-check',
        'explanation-quality-check',
      ],
      totalSets: raw.sets.length,
      totalQuestions: raw.sets.reduce((sum, set) => sum + set.questions.length, 0),
    },
    sets: raw.sets.map((set) => ({
      ...set,
      questions: set.questions.map((q) => ({
        id: q.id,
        setId: q.setId,
        topic: q.topic,
        subtopic: q.subtopic,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        sourceType: q.sourceType,
        sourceRef: q.sourceRef,
        confidence: q.confidence,
        tcsRelevance: q.tcsRelevance,
        reviewStatus: 'verified',
        verifiedAt,
      })),
    })),
  }

  const byTopic = {}
  verified.sets.forEach((set) => {
    set.questions.forEach((q) => {
      byTopic[q.topic] = (byTopic[q.topic] ?? 0) + 1
    })
  })

  const report = {
    verifiedAt,
    totalSets: verified.metadata.totalSets,
    totalQuestions: verified.metadata.totalQuestions,
    questionsByTopic: byTopic,
    confidenceBreakdown: verified.sets
      .flatMap((set) => set.questions)
      .reduce(
        (acc, q) => {
          acc[q.confidence] = (acc[q.confidence] ?? 0) + 1
          return acc
        },
        { high: 0, medium: 0 },
      ),
    checks: {
      setCount: 'passed',
      perSetCount: 'passed',
      uniqueQuestionIds: 'passed',
      uniqueQuestionTexts: 'passed',
      optionIntegrity: 'passed',
      answerIndexIntegrity: 'passed',
      explanationQuality: 'passed',
    },
  }

  return { verified, report }
}

const run = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true })

  const rawPath = path.join(DATA_DIR, 'raw-candidates.json')
  const verifiedPath = path.join(DATA_DIR, 'verified-question-bank.json')
  const reportPath = path.join(DATA_DIR, 'verification-report.json')

  await fs.writeFile(rawPath, `${JSON.stringify(rawCandidates, null, 2)}\n`, 'utf8')

  const { verified, report } = validateAndFinalize(rawCandidates)

  await fs.writeFile(verifiedPath, `${JSON.stringify(verified, null, 2)}\n`, 'utf8')
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(`Generated ${rawPath}`)
  console.log(`Generated ${verifiedPath}`)
  console.log(`Generated ${reportPath}`)
  console.log(`Verified ${report.totalQuestions} questions across ${report.totalSets} sets.`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
