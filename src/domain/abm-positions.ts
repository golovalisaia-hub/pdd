export const ABM_TICKETS = 40
export const ABM_QUESTIONS_PER_TICKET = 20
export const ABM_QUESTION_COUNT = ABM_TICKETS * ABM_QUESTIONS_PER_TICKET

export function abmQuestionId(ticket: number, position: number) {
  return `abm-${String(ticket).padStart(2, '0')}-${String(position).padStart(2, '0')}`
}
