from __future__ import annotations

from app.services.utils import to_slug


class TestServiceUtils:
    """Validate slug normalization helper used by service layer."""

    def test_to_slug_normalizes_spaces_symbols_and_case(self):
        # Arrange / Act
        result = to_slug("  Software Engineering!! 2026  ")

        # Assert
        assert result == "software-engineering-2026"

    def test_to_slug_collapses_multiple_hyphens_and_trims_edges(self):
        # Arrange / Act
        result = to_slug("---Data   Science---")

        # Assert
        assert result == "data-science"
