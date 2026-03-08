import pytest
from app import app
from tic_tac_toe.game import Game


@pytest.fixture

def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_start_page(client):
    # when no player info is set, start page should be accessible
    rv = client.get("/start")
    assert rv.status_code == 200
    assert b"Your name" in rv.data


def test_service_running(client):
    # basic sanity: after setup the index page loads successfully
    client.post("/start", data={"name": "Eve", "symbol": "X"})
    response = client.get("/")
    assert response.status_code == 200
    assert b"Tic Tac Toe" in response.data
    # ensure clickable tiles do not render numeric labels in anchors
    for digit in range(1, 10):
        assert f">{digit}<".encode() not in response.data


def test_mobile_layout(client):
    client.post("/start", data={"name": "Mobi", "symbol": "X"})
    # simulate a mobile user agent
    rv = client.get("/", headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X)"})
    assert b'class="mobile"' in rv.data
    # viewport meta should exist
    assert b"viewport" in rv.data
    # web font link should appear
    assert b"fonts.googleapis.com" in rv.data


def test_setup_mobile_layout(client):
    # an unauthenticated request shows the setup page
    rv = client.get("/start", headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"})
    assert rv.status_code == 200
    # mobile styling flag should be set so body class toggles
    assert b'class="mobile"' in rv.data
    # viewport and font import should be present
    assert b"viewport" in rv.data
    assert b"fonts.googleapis.com" in rv.data


def test_index_page(client):
    # simulate setup first
    client.post("/start", data={"name": "Alice", "symbol": "X"})
    rv = client.get("/")
    assert b"Tic Tac Toe" in rv.data
    assert b"Player: Alice" in rv.data


def test_change_settings(client):
    # choose initial settings
    client.post("/start", data={"name": "Frank", "symbol": "X"})
    rv = client.get("/")
    assert b"Player: Frank" in rv.data
    # now clear settings
    rv = client.get("/settings")
    # should redirect to start (setup) page
    assert rv.status_code == 302
    rv2 = client.get("/start")
    assert b"Your name" in rv2.data


def test_make_move_and_computer(client):
    client.post("/start", data={"name": "Bob", "symbol": "X"})
    client.get("/reset")
    # player moves at cell 0
    client.get("/move/0")
    rv = client.get("/")
    assert b"X" in rv.data
    # after computer moves there should be the opposite symbol
    assert b"O" in rv.data


def test_win_counts(client):
    # play two quick games controlling session to simulate wins
    client.post("/start", data={"name": "Gina", "symbol": "X"})
    with client.session_transaction() as sess:
        g = Game()
        g.board = ["X","X","X"," "," "," "," "," "," "]
        sess["game"] = g.to_dict()
    # visiting index should show player win and increment counter
    rv = client.get("/")
    assert b"Wins: 1" in rv.data
    # trigger another player win
    with client.session_transaction() as sess:
        g = Game()
        g.board = ["X"," "," ","X"," "," ","X"," "," "]
        sess["game"] = g.to_dict()
    rv = client.get("/")
    assert b"Wins: 2" in rv.data

    # now simulate a computer win
    with client.session_transaction() as sess:
        g = Game()
        g.board = ["O","O","O"," "," "," "," "," "," "]
        sess["game"] = g.to_dict()
    rv = client.get("/")
    assert b"Computer: O - Wins: 1" in rv.data


def test_settings_clears_counters(client):
    client.post("/start", data={"name": "Hal", "symbol": "X"})
    # hit settings and follow redirect to start
    rv = client.get("/settings", follow_redirects=True)
    assert b"Your name" in rv.data


def test_make_move_computer_second(client):
    # test scenario where user chooses O and computer is X
    client.post("/start", data={"name": "Carol", "symbol": "O"})
    client.get("/reset")
    rv = client.get("/")
    # computer should have played first as X
    assert b"X" in rv.data
    # now human can play
    client.get("/move/1")
    rv = client.get("/")
    assert b"O" in rv.data


def test_full_game_draw(client):
    # simulate a draw by controlling session directly
    with client.session_transaction() as sess:
        sess["player_name"] = "Dave"
        sess["player_symbol"] = "X"
        sess["computer_symbol"] = "O"
        g = Game()
        g.board = ["X","O","X","X","O","X","O","X","O"]
        sess["game"] = g.to_dict()
    rv = client.get("/")
    assert b"draw" in rv.data.lower()
