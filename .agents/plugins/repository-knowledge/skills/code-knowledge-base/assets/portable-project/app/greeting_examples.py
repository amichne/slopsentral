"""Independent examples for the documented greeting contract."""

import unittest

from greeting import greeting


class GreetingTest(unittest.TestCase):
    def test_named_reader(self) -> None:
        self.assertEqual(greeting("Ada"), "Hello, Ada.")

    def test_literal_input(self) -> None:
        self.assertEqual(greeting("$HOME"), "Hello, $HOME.")


if __name__ == "__main__":
    unittest.main()
