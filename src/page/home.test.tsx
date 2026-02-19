import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Home from './home'

describe('Home', () => {
  it('renders the welcome headline and subtitle', () => {
    render(<Home />)

    expect(
      screen.getByRole('heading', { name: /welcome to tempusai/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/your intelligent scheduling assistant/i),
    ).toBeInTheDocument()
  })
})
