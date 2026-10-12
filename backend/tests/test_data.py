from __future__ import annotations


def test_csv_loads_with_expected_shape(store):
    assert store.frame.shape == (1163, 21)


def test_required_dates_are_parsed_and_postal_code_is_string(store):
    assert str(store.frame["Order Date"].dtype).startswith("datetime64")
    assert str(store.frame["Ship Date"].dtype).startswith("datetime64")
    assert str(store.frame["Postal Code"].dtype) == "string"


def test_repeated_order_ids_are_preserved(store):
    counts = store.frame.groupby("Order ID").size()
    assert len(store.frame) == 1163
    assert counts[counts > 1].size == 295
    assert counts.max() == 9


def test_dataset_has_no_exact_duplicate_rows(store):
    assert store.frame.duplicated().sum() == 0
