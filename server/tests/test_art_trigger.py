"""Art card keyword trigger tests."""

from art_trigger import should_include_art_card


def test_art_trigger_positive() -> None:
    assert should_include_art_card("How is he doing?")
    assert should_include_art_card("how's Harvey feeling")
    assert should_include_art_card("Is he okay right now?")
    assert should_include_art_card("How are you doing out there?")


def test_art_trigger_negative() -> None:
    assert not should_include_art_card("What mile is he on?")
    assert not should_include_art_card("When is the next crew stop?")
    assert not should_include_art_card(None)
    assert not should_include_art_card("")
