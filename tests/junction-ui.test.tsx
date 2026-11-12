// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JunctionsPage from '../src/features/junctions/JunctionsPage'

afterEach(cleanup)

describe('Тренажёр перекрёстков', () => {
  it('синхронизирует выбор на схеме, сохраняет ответ и позволяет начать заново', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    render(<JunctionsPage completedIds={new Set()} onAttempt={onAttempt} onRule={vi.fn()} />)

    const board = screen.getByRole('group', { name: 'Схема перекрёстка' })
    const answer = screen.getByRole('group', { name: 'Варианты ответа' })
    const check = screen.getByRole('button', { name: 'Проверить ответ' })
    expect(check).toBeDisabled()

    const actor = within(board).getByRole('button', { name: 'Оранжевый автомобиль' })
    actor.focus()
    await user.keyboard('{Enter}')

    const option = within(answer).getByRole('button', { name: /Оранжевый автомобиль/ })
    expect(option).toHaveAttribute('aria-pressed', 'true')
    await user.click(check)
    expect(onAttempt).toHaveBeenCalledExactlyOnceWith('right-hand-cross', true)
    expect(screen.getByRole('status')).toHaveTextContent('Верно')

    await user.click(screen.getByRole('button', { name: 'Решить заново' }))
    expect(option).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Проверить ответ' })).toBeDisabled()
  })

  it('открывает следующую задачу с пустым ответом после разбора', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    render(<JunctionsPage completedIds={new Set()} onAttempt={onAttempt} onRule={vi.fn()} />)

    const scenario = screen.getByRole('combobox', { name: 'Задача' })
    const firstId = (scenario as HTMLSelectElement).value
    const choices = screen.getByRole('group', { name: 'Варианты ответа' })

    await user.click(within(choices).getByRole('button', { name: /Синий автомобиль/ }))
    await user.click(screen.getByRole('button', { name: 'Проверить ответ' }))
    expect(onAttempt).toHaveBeenCalledExactlyOnceWith('right-hand-cross', false)
    expect(screen.getByRole('status')).toHaveTextContent('Есть ошибка')

    await user.click(screen.getByRole('button', { name: 'Следующая ситуация' }))
    expect(scenario).not.toHaveValue(firstId)
    expect(screen.getByRole('button', { name: 'Проверить ответ' })).toBeDisabled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('разрешает поставить совместимые манёвры в один шаг', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    render(<JunctionsPage completedIds={new Set()} onAttempt={onAttempt} onRule={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Задача' }), 'opposing-right-turns')
    const choices = screen.getByRole('group', { name: 'Варианты ответа' })
    await user.click(within(choices).getByRole('button', { name: /Синий автомобиль/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Добавить следующего участника в тот же шаг' }))
    await user.click(within(choices).getByRole('button', { name: /Оранжевый автомобиль/ }))

    expect(within(choices).getByRole('button', { name: /Синий автомобиль.*Шаг 1/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(choices).getByRole('button', { name: /Оранжевый автомобиль.*Шаг 1/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Проверить ответ' }))
    expect(onAttempt).toHaveBeenCalledExactlyOnceWith('opposing-right-turns', true)
  })

  it('показывает решение без записи попытки', async () => {
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    render(<JunctionsPage completedIds={new Set()} onAttempt={onAttempt} onRule={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Показать решение' }))
    expect(screen.getByRole('status')).toHaveTextContent('Решение')
    expect(screen.getByRole('button', { name: 'Повторить анимацию' })).toBeVisible()
    expect(onAttempt).not.toHaveBeenCalled()
  })
})
