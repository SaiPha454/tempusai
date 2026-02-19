import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './notfound'

describe('NotFound', () => {
  it('renders the 404 message and home link', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/sorry, the page you are looking for does not exist/i),
    ).toBeInTheDocument()

    const link = screen.getByRole('link', { name: /go back to home/i })
    expect(link).toHaveAttribute('href', '/')
  })
})
