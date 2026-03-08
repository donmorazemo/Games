# Use official Python runtime
FROM python:3.14-slim

# set work directory
WORKDIR /app

# copy project
COPY . /app

# install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# expose port
EXPOSE 5000

# start the server
CMD ["python", "app.py"]
