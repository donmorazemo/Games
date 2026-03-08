from flask import Flask, session, redirect, url_for, render_template, request
from tic_tac_toe.game import Game

app = Flask(__name__)
# NOTE: in production, use a secure random key
app.secret_key = "dev_secret_key"

# increment this value whenever the code is updated/deployed;
# it will display on every page so you can verify the running version
BUILD_NUMBER = 1


def get_game():
    # ensure a game object exists in session
    if "game" not in session:
        session["game"] = Game().to_dict()
    return Game.from_dict(session["game"])


def save_game(game: Game):
    session["game"] = game.to_dict()


@app.route("/")
def index():
    # if player hasn't been configured, show setup page
    if "player_name" not in session or "player_symbol" not in session:
        return redirect(url_for("start"))

    game = get_game()
    # if board changed since last view, clear processed flag so new wins count
    last = session.get("last_board")
    if last != game.board:
        session.pop("winner_processed", None)
        session["last_board"] = game.board.copy()

    winner = None
    if game.check_win("X"):
        winner = "X"
    elif game.check_win("O"):
        winner = "O"

    # detect mobile user agent so template can adjust layout
    mobile = False
    ua = request.user_agent
    # flask user agent parser may not mark every phone; also check for common indicators
    low = ua.string or ""
    if (hasattr(ua, "is_mobile") and ua.is_mobile) or any(keyword in low for keyword in ["Mobile", "iPhone", "Android", "iPad"]):
        mobile = True

    # if board no longer has a winner, clear the processed flag so next win counts
    if not winner and "winner_processed" in session:
        session.pop("winner_processed")

    # if a win has just occurred and we haven't updated counts yet
    if winner and session.get("winner_processed") != winner:
        if winner == session.get("player_symbol"):
            session["player_wins"] = session.get("player_wins", 0) + 1
        else:
            session["computer_wins"] = session.get("computer_wins", 0) + 1
        session["winner_processed"] = winner

    return render_template(
        "index.html",
        board=game.board,
        current=game.current,
        winner=winner,
        draw=(not winner and game.is_draw()),
        player_name=session.get("player_name"),
        player_symbol=session.get("player_symbol"),
        computer_symbol=session.get("computer_symbol"),
        player_wins=session.get("player_wins", 0),
        computer_wins=session.get("computer_wins", 0),
        mobile=mobile,        build=BUILD_NUMBER,    )


@app.route("/move/<int:idx>")
def move(idx: int):
    game = get_game()
    human = session.get("player_symbol", "X")
    comp = session.get("computer_symbol", "O")
    # only allow move if cell empty and game not over
    if game.board[idx] == " " and not game.check_win("X") and not game.check_win("O"):
        game.make_move(idx, human)
        # after player move, computer plays if game continues
        if not game.check_win(human) and not game.is_draw():
            game.computer_move(comp)
    save_game(game)
    return redirect(url_for("index"))


@app.route("/reset")
def reset():
    # clear the current board but preserve player info so name/symbol stay
    session.pop("game", None)
    session.pop("winner_processed", None)
    # if human starts as O, let computer make first move
    if session.get("player_symbol") == "O":
        game = Game()
        game.computer_move(session.get("computer_symbol", "X"))
        save_game(game)
    return redirect(url_for("index"))


@app.route("/settings")
def settings():
    # allow the user to clear name/symbol choices and start over
    session.pop("player_name", None)
    session.pop("player_symbol", None)
    session.pop("computer_symbol", None)
    session.pop("game", None)
    session.pop("player_wins", None)
    session.pop("computer_wins", None)
    return redirect(url_for("start"))


@app.route("/start", methods=["GET", "POST"])
def start():
    if session.get("player_name") and session.get("player_symbol"):
        # already configured; redirect to index
        return redirect(url_for("index"))

    if request.method == "POST":
        name = request.form.get("name", "")
        symbol = request.form.get("symbol", "X")
        if symbol not in ("X", "O"):
            symbol = "X"
        session["player_name"] = name or "Player"
        session["player_symbol"] = symbol
        session["computer_symbol"] = "O" if symbol == "X" else "X"
        # initialize game and possibly let computer start
        game = Game()
        if symbol == "O":
            game.computer_move(session["computer_symbol"])
        save_game(game)
        return redirect(url_for("index"))
    # GET - before showing the form, detect mobile user agent
    mobile = False
    ua = request.user_agent
    low = ua.string or ""
    if (hasattr(ua, "is_mobile") and ua.is_mobile) or any(keyword in low for keyword in ["Mobile", "iPhone", "Android", "iPad"]):
        mobile = True
    return render_template("setup.html", mobile=mobile, build=BUILD_NUMBER)


if __name__ == "__main__":
    # run development server
    # listen on all interfaces and respect provided PORT (e.g. from fly.io)
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
