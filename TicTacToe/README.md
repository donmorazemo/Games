# TicTacToe

Simple Tic Tac Toe game project.

## Structure

- `main.py` – CLI entry point
- `app.py` – Flask web server for browser-based game (includes medieval-themed interface)
- `static/` – assets such as parchment background
- `templates/` – HTML templates used by Flask
- `tic_tac_toe/` – game logic module
- `tests/` – unit tests (including web tests)

## Features

- Medieval-styled web interface with parchment background and antique font
- AI opponent powered by minimax for smart play (blocks and finishes wins) but intentionally makes a mistake about 30% of the time to keep the game winnable
