import type { PageContent } from '../../../../types/page-content.ts'
import { createLearningQuiz } from '../../../../navigation/learning-quiz.ts'

export const learningPageContent: PageContent = {
  title: 'Обучение: Компьютерные сети',
  blocks: [
    {
      kind: 'custom',
      render: createLearningQuiz,
    },
  ],
}
