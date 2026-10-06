import pandas as pd
import re
import string
import nltk
import joblib
from pathlib import Path

from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from textblob import TextBlob

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB

from imblearn.over_sampling import SMOTE


BASE_DIR = Path(__file__).resolve().parent


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


# =========================
# LOAD DATASET
# =========================

df = pd.read_csv(BASE_DIR / "chatgpt1.csv")
df = df[["Text"]]

df = df.dropna()
df = df.drop_duplicates()


# =========================
# TEXT PREPROCESSING
# =========================

stop_words = set(stopwords.words("english"))
lemmatizer = WordNetLemmatizer()


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


df["clean_text"] = df["Text"].apply(clean_text)
df = df[df["clean_text"].str.strip() != ""]


# =========================
# TEXTBLOB LABELING
# =========================

def textblob_label(text):
    polarity = TextBlob(str(text)).sentiment.polarity

    if polarity > 0:
        return "positive"
    elif polarity < 0:
        return "negative"
    else:
        return "neutral"


df["label"] = df["clean_text"].apply(textblob_label)


print("Label distribution:")
print(df["label"].value_counts())


# =========================
# TF-IDF UNIGRAM
# =========================

tfidf = TfidfVectorizer(
    max_features=5000,
    ngram_range=(1, 1)
)

X = tfidf.fit_transform(df["clean_text"])
y = df["label"]


# =========================
# TRAIN TEST SPLIT
# =========================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    stratify=y,
    random_state=42
)


# =========================
# SMOTE
# =========================

smote = SMOTE(random_state=42)
X_train_smote, y_train_smote = smote.fit_resample(X_train, y_train)


print("\nBefore SMOTE:")
print(y_train.value_counts())

print("\nAfter SMOTE:")
print(pd.Series(y_train_smote).value_counts())


# =========================
# TRAIN 3 MODELS
# =========================

svm_model = LinearSVC(random_state=42)

lr_model = LogisticRegression(
    max_iter=1000,
    random_state=42
)

nb_model = MultinomialNB()


svm_model.fit(X_train_smote, y_train_smote)
lr_model.fit(X_train_smote, y_train_smote)
nb_model.fit(X_train_smote, y_train_smote)


# =========================
# SAVE MODELS
# =========================

joblib.dump(svm_model, BASE_DIR / "svm_model.pkl")
joblib.dump(lr_model, BASE_DIR / "lr_model.pkl")
joblib.dump(nb_model, BASE_DIR / "nb_model.pkl")
joblib.dump(tfidf, BASE_DIR / "tfidf_vectorizer.pkl")


print("\nModels saved successfully:")
print("svm_model.pkl")
print("lr_model.pkl")
print("nb_model.pkl")
print("tfidf_vectorizer.pkl")
