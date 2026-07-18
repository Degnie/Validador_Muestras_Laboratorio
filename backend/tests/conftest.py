import pandas as pd
import pytest


@pytest.fixture
def tmp_xlsx(tmp_path):
    """Writes a DataFrame to a temp .xlsx and returns its path."""

    def _make(filename: str, df: pd.DataFrame):
        path = tmp_path / filename
        df.to_excel(path, index=False)
        return path

    return _make
