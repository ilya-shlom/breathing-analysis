FROM tiangolo/uwsgi-nginx:python3.11


RUN apt update && apt upgrade

RUN apt add --no-cache \
    python3-dev \
    musl-dev \
    openssl-dev \
    libffi-dev \
    make \
    gcc \
    g++ \
    && pip3 install --upgrade pip
    
RUN pip install setuptools

RUN apt install python3-pyaudio

COPY requirements.txt /app

RUN pip install -r /app/requirements.txt

RUN pip install -i https://test.pypi.org/simple/ PyBreathTranscript==0.2.0 

COPY ./app /app

EXPOSE 8080