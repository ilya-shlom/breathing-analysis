from webapp import app, socketio


if __name__ == '__main__':       
    socketio.run(host='0.0.0.0', debug=True, port=8080)