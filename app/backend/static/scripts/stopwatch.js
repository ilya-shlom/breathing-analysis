let timer;
let startTime;
let elapsedTime = 0;
let running = false;

function updateDisplay() {
    let time = elapsedTime;
    let hours = Math.floor(time / 3600000);
    let minutes = Math.floor((time % 3600000) / 60000);
    let seconds = Math.floor((time % 60000) / 1000);
    let milliseconds = time % 1000;
    document.querySelector('.stopwatch').innerText =
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(milliseconds).padStart(3, '0')}`;
}

function startStopwatch() {
    if (!running) {
        startTime = Date.now() - elapsedTime;
        timer = setInterval(() => {
            elapsedTime = Date.now() - startTime;
            updateDisplay();
        }, 10);
        running = true;
    }
}

function stopStopwatch() {
    clearInterval(timer);
    running = false;
}

function resetStopwatch() {
    clearInterval(timer);
    running = false;
    elapsedTime = 0;
    updateDisplay();
}