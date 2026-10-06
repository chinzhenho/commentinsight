from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
from pathlib import Path
import re
import string
import nltk

from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from textblob import TextBlob



def ensure_nltk_resource(resource_paths, package_name):
    for resource_path in resource_paths:
        try:
            nltk.data.find(resource_path)
            return
        except LookupError:
            pass

    nltk.download(package_name, quiet=True)


ensure_nltk_resource(["corpora/stopwords"], "stopwords")
ensure_nltk_resource(["corpora/wordnet", "corpora/wordnet.zip"], "wordnet")
ensure_nltk_resource(["corpora/omw-1.4", "corpora/omw-1.4.zip"], "omw-1.4")
ensure_nltk_resource(["sentiment/vader_lexicon.zip", "sentiment/vader_lexicon"], "vader_lexicon")

app = Flask(__name__)
CORS(app)
BASE_DIR = Path(__file__).resolve().parent


# =========================
# LOAD SAVED MODELS
# =========================

svm_model = joblib.load(BASE_DIR / "svm_model.pkl")
lr_model = joblib.load(BASE_DIR / "lr_model.pkl")
nb_model = joblib.load(BASE_DIR / "nb_model.pkl")
vectorizer = joblib.load(BASE_DIR / "tfidf_vectorizer.pkl")


# =========================
# TEXT PREPROCESSING
# =========================

stop_words = set(stopwords.words("english"))
lemmatizer = WordNetLemmatizer()
vader_analyzer = SentimentIntensityAnalyzer()

def clean_text(text):
    text = str(text)
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"#", "", text)
    text = re.sub(r"[^\x00-\x7F]+", "", text)
    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"[^a-zA-Z\s]", " ", text)

    words = text.split()
    words = [
        lemmatizer.lemmatize(word)
        for word in words
        if word not in stop_words
    ]

    return " ".join(words)

# =========================
# VADER AND TEXTBLOB ANALYSIS
# =========================

def get_vader_result(text):
    scores = vader_analyzer.polarity_scores(text)
    compound = scores["compound"]

    if compound >= 0.05:
        label = "positive"
    elif compound <= -0.05:
        label = "negative"
    else:
        label = "neutral"

    return {
        "pos": scores["pos"],
        "neu": scores["neu"],
        "neg": scores["neg"],
        "compound": compound,
        "label": label
    }


def get_textblob_result(text):
    sentiment = TextBlob(str(text)).sentiment
    polarity = sentiment.polarity
    subjectivity = sentiment.subjectivity

    if polarity > 0:
        label = "positive"
    elif polarity < 0:
        label = "negative"
    else:
        label = "neutral"

    return {
        "polarity": polarity,
        "subjectivity": subjectivity,
        "label": label
    }

# =========================
# API ROUTES
# =========================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Sentiment Analysis Flask Backend is running"
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    if data is None:
        return jsonify({
            "error": "Invalid JSON request"
        }), 400

    text = str(data.get("text", ""))

    if text.strip() == "":
        return jsonify({
            "error": "Text input is empty"
        }), 400

    cleaned_text = clean_text(text)
    text_vector = vectorizer.transform([cleaned_text])

    svm_prediction = svm_model.predict(text_vector)[0]
    lr_prediction = lr_model.predict(text_vector)[0]
    nb_prediction = nb_model.predict(text_vector)[0]

    vader_result = get_vader_result(text)
    textblob_result = get_textblob_result(text)


    predictions = [
        {
            "model": "SVM",
            "model_name": "SVM",
            "prediction": svm_prediction
        },
        {
            "model": "LR",
            "model_name": "Logistic Regression",
            "prediction": lr_prediction
        },
        {
            "model": "NB",
            "model_name": "Naive Bayes",
            "prediction": nb_prediction
        }
    ]

    summary = {}

    for item in predictions:
        sentiment = item["prediction"]
        summary[sentiment] = summary.get(sentiment, 0) + 1

    return jsonify({
        "original_text": text,
        "cleaned_text": cleaned_text,
        "labeling_method": "TextBlob training labels",
        "feature_extraction": "TF-IDF Unigram",
        "training_method": "SMOTE",
        "predictions": predictions,
        "summary": summary,
        "vader": vader_result,
        "textblob": textblob_result
    })


if __name__ == "__main__":
    app.run(debug=True)
