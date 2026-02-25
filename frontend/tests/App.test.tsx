import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../src/App'

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('renders the AI Scheduling Assistant header', () => {
    render(<App />)
    expect(
      screen.getByText('AI Scheduling Assistant'),
    ).toBeInTheDocument()
  })

  it('renders the semester badge', () => {
    render(<App />)
    expect(
      screen.getByText('Semester 2 · 2025'),
    ).toBeInTheDocument()
  })

  it('renders the sidebar navigation items', () => {
    render(<App />)
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    expect(screen.getByText('Schedule Manager')).toBeInTheDocument()
  })
})
