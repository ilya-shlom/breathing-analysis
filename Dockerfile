FROM python:3.11-slim@sha256:82c07f2f6e35255b92eb16f38dbd22679d5e8fb523064138d7c6468e7bf0c15b


RUN apt update && apt upgrade -y

RUN apt install -y \
    python3-dev \
    musl-dev \
    # openssl-dev \
    libffi-dev \
    make \
    gcc \
    g++ \
    && pip3 install --upgrade pip
    
RUN pip install setuptools

RUN apt install python3-pyaudio -y

COPY requirements.txt /app

RUN pip install -r requirements.txt

RUN pip install -i https://test.pypi.org/simple/ PyBreathTranscript==0.2.1

COPY ./app /app

EXPOSE 8080

CMD ["python3", "main.py"]
