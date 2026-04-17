from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return "Backend is running!"

@app.route("/api/generate-tasks", methods=["POST"])
def test():
    print("API HIT")
    return {"message": "working"}

if __name__ == "__main__":
    print("SERVER STARTING...")
    app.run(debug=True, host="0.0.0.0", port=5000)
