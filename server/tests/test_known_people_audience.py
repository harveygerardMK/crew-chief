"""Known-people default audience hints."""

from known_people import default_audience_for_name, lookup_known_person


def test_amanda_default_audience_on_course() -> None:
    assert default_audience_for_name("Amanda Schaefer") == "on_course"
    person = lookup_known_person("amanda")
    assert person is not None
    assert person.get("default_audience") == "on_course"


def test_unknown_name_no_default() -> None:
    assert default_audience_for_name("Random Person") is None
