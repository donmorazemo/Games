import random

class Game:
    def __init__(self):
        # board is a list of 9 cells, 0-indexed
        self.board = [" "] * 9
        # X is always the human player; O is the computer
        self.current = "X"

    # legacy CLI support left for backwards compatibility
    def play(self):
        print("Welcome to Tic Tac Toe!")
        while True:
            self.print_board()
            move = input(f"Player {self.current}, choose a cell (1-9): ")
            if not move.isdigit() or not (1 <= int(move) <= 9):
                print("Invalid input. Try again.")
                continue
            idx = int(move) - 1
            if self.board[idx] != " ":
                print("Cell already taken. Try again.")
                continue
            self.board[idx] = self.current
            if self.check_win(self.current):
                self.print_board()
                print(f"Player {self.current} wins!")
                break
            if self.is_draw():
                self.print_board()
                print("It's a draw!")
                break
            self.current = "O" if self.current == "X" else "X"

    def print_board(self):
        b = self.board
        print(f"{b[0]}|{b[1]}|{b[2]}")
        print("-+-+-")
        print(f"{b[3]}|{b[4]}|{b[5]}")
        print("-+-+-")
        print(f"{b[6]}|{b[7]}|{b[8]}")

    def check_win(self, player):
        b = self.board
        wins = [
            (0,1,2), (3,4,5), (6,7,8),
            (0,3,6), (1,4,7), (2,5,8),
            (0,4,8), (2,4,6)
        ]
        # check any winning tuple for the specified player
        # use distinct variable names to avoid shadowing
        return any(b[i] == b[j] == b[k] == player for i, j, k in wins)

    def is_draw(self):
        # A draw occurs when either the board is full or no winning line
        # remains possible (early draw detection).
        if all(cell != " " for cell in self.board):
            return True
        wins = [
            (0,1,2), (3,4,5), (6,7,8),
            (0,3,6), (1,4,7), (2,5,8),
            (0,4,8), (2,4,6)
        ]
        # if every potential winning line contains both X and O, nobody
        # can ever complete it, so the game is effectively a draw
        for i,j,k in wins:
            line = [self.board[i], self.board[j], self.board[k]]
            if not ("X" in line and "O" in line):
                return False
        return True

    # --- new helpers for web/computer play ---
    def available_moves(self):
        """Return a list of empty-cell indices."""
        return [i for i, cell in enumerate(self.board) if cell == " "]

    def make_move(self, idx: int, player: str) -> bool:
        """Attempt to place `player` at `idx`. Return True if successful."""
        if 0 <= idx < 9 and self.board[idx] == " ":
            self.board[idx] = player
            # switch current only if game is still ongoing
            if not self.check_win(player) and not self.is_draw():
                self.current = "O" if player == "X" else "X"
            return True
        return False

    def _minimax(self, player: str, opponent: str) -> int:
        # recursive minimax evaluation from current board state;
        # result is 1 if `player` can force a win, -1 if `player` will lose,
        # 0 for draw under optimal play
        if self.check_win(player):
            return 1
        if self.check_win(opponent):
            return -1
        if self.is_draw():
            return 0
        best = -2
        for move in self.available_moves():
            self.board[move] = player
            score = -self._minimax(opponent, player)
            self.board[move] = " "
            if score > best:
                best = score
            if best == 1:
                break
        return best

    def computer_move(self, symbol: str = "O"):
        """AI: use minimax to pick the strongest move for `symbol`.

        To keep things interesting the computer will make a deliberately poor
        choice about 30% of the time (i.e. simply pick a random available
        square instead of the optimal one). This makes the opponent beatable.
        """
        moves = self.available_moves()
        if not moves:
            return None

        # introduce randomness: 30% chance of a blunder
        if random.random() < 0.3:
            idx = random.choice(moves)
            self.make_move(idx, symbol)
            return idx

        opponent = "O" if symbol == "X" else "X"
        best_score = -2
        best_move = None
        for m in moves:
            self.board[m] = symbol
            score = -self._minimax(opponent, symbol)
            self.board[m] = " "
            if score > best_score:
                best_score = score
                best_move = m
        # fallback to random if something went wrong
        if best_move is None:
            best_move = random.choice(moves)
        self.make_move(best_move, symbol)
        return best_move

    def to_dict(self):
        return {"board": self.board.copy(), "current": self.current}

    @classmethod
    def from_dict(cls, d):
        g = cls()
        g.board = d.get("board", [" "] * 9)
        g.current = d.get("current", "X")
        return g
