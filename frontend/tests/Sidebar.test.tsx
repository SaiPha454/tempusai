import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Sidebar from '../src/components/Sidebar'

afterEach(() => {
  cleanup()
})

describe('Sidebar', () => {
  it('renders the brand name', () => {
    render(<Sidebar activePage="chat" setActivePage={vi.fn()} />)
    expect(screen.getByText('Academic Scheduling')).toBeInTheDocument()
  })

  it('renders all navigation items', () => {
    render(<Sidebar activePage="chat" setActivePage={vi.fn()} />)
    expect(screen.getByText('AI Assistant')).toBeInTheDocument()
    expect(screen.getByText('Schedule Manager')).toBeInTheDocument()
    expect(screen.getByText('My Timetable')).toBeInTheDocument()
    expect(screen.getByText('Exam Schedule')).toBeInTheDocument()
    expect(screen.getByText('Campus Events')).toBeInTheDocument()
    expect(screen.getByText('Change Requests')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders the user profile', () => {
    render(<Sidebar activePage="chat" setActivePage={vi.fn()} />)
    expect(screen.getByText('Dr. Aris Chandra')).toBeInTheDocument()
    expect(screen.getByText('Coordinator')).toBeInTheDocument()
  })
})
