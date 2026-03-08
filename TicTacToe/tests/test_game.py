import pytest
from tic_tac_toe.game import Game


def test_initial_board():
    game = Game()
    assert game.board == [" "] * 9
    assert game.current == "X"


def test_win_conditions():
    game = Game()
    game.board = ["X","X","X"," "," "," "," "," "," "]
    assert game.check_win("X")
    game.board = [" "," "," ","O","O","O"," "," "," "]
    assert game.check_win("O")


def test_draw():
    game = Game()
    game.board = ["X","O","X","X","O","X","O","X","O"]
    assert game.is_draw()


def test_not_draw():
    game = Game()
    game.board = ["X","O"," ","X","O","X","O","X","O"]
    assert not game.is_draw()


def test_available_and_make_move():
    game = Game()
    assert game.available_moves() == list(range(9))
    assert game.make_move(0, "X")
    assert game.board[0] == "X"
    assert game.current == "O"  # turn should switch
    assert not game.make_move(0, "O")  # occupied


def test_computer_move_and_serialization():
    game = Game()
    # force some spots taken
    game.board = ["X","O","X","O"," "," "," "," "," "]
    prev = game.available_moves().copy()
    idx = game.computer_move()
    assert idx in prev
    assert game.board[idx] == "O"

    data = game.to_dict()
    newg = Game.from_dict(data)
    assert newg.board == game.board
    assert newg.current == game.current


def test_early_draw_detection():
    # board has no winning line available for either player
    game = Game()
    game.board = ["X","O","X",
                  "X","O","O",
                  "O","X"," "]
    # only one empty cell but every possible win line contains both X and O
    assert game.is_draw()


def test_ai_blocks_and_wins(monkeypatch):
    # force randomness to avoid mistakes during this test
    monkeypatch.setattr(__import__('random'), 'random', lambda: 1.0)

    # scenario: computer is O, human X; AI should block X's imminent win
    game = Game()
    game.board = ["X","X"," ",
                  " ","O"," ",
                  " "," "," "]
    move = game.computer_move("O")
    # must play at index 2 to block
    assert move == 2
    assert game.board[2] == "O"

    # reset for winning opportunity
    game = Game()
    game.board = ["O","O"," ",
                  " ","X"," ",
                  " "," "," "]
    move = game.computer_move("O")
    # should win by placing at 2
    assert move == 2
    assert game.check_win("O")
