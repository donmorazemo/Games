# top-level Dockerfile for CI/CD tools (e.g. fly.io) that inspect the repository root

FROM python:3.14-slim
WORKDIR /app

# copy the actual application contained in the TicTacToe subdirectory
COPY TicTacToe/ /app

# install requirements
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 5000
CMD ["python", "app.py"]
