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

## Deployment

You can publish the game using any Python web host.  Here are two common approaches:

1. **Docker** (works on any container platform):

   ```dockerfile
   # Use the supplied Dockerfile
   docker build -t tictactoe-web .
   docker run -p 5000:5000 tictactoe-web
   ```

   The server will listen on port 5000 inside the container.

2. **Heroku** (free/deprecated, but illustrative):

   - Create a `Procfile` with `web: python app.py`.
   - Push the repo to a Heroku app:
     ```bash
     heroku create your-app-name
     git push heroku master
     heroku open
     ```

   - Ensure `requirements.txt` exists (already present).  Optionally add `runtime.txt` (`python-3.14.0`).

Alternatively you may deploy to PythonAnywhere, AWS Elastic Beanstalk, or any other host that
supports Flask.  Just point the web server to run `python app.py` in the project root.
