(function () {
  const firebaseConfig = window.CommentInsightFirebaseConfig;

  if (typeof firebase === "undefined") {
    console.error("Firebase SDK scripts must be loaded before FirebaseConfig.js");
    return;
  }

  if (!firebaseConfig) {
    console.error("Missing FirebaseKeys.js. Copy FirebaseKeys.example.js to FirebaseKeys.js and fill in your Firebase config.");
    return;
  }

  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const ANALYSIS_COLLECTION = "analysisRecords";
  const LEGACY_ANALYSIS_COLLECTION = "analyses";

  if (firebase.analytics && window.location.protocol !== "file:") {
    try {
      firebase.analytics();
    } catch (error) {
      console.warn("Firebase Analytics was not started:", error.message);
    }
  }

  function waitForAuthUser() {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  async function requireUser() {
    const user = auth.currentUser || await waitForAuthUser();

    if (!user) {
      throw new Error("Please log in before using this feature.");
    }

    return user;
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatTime(date) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRecordDate(data) {
    const timestamp = data.timestamp || data.createdAt;

    if (timestamp && timestamp.toDate) {
      return timestamp.toDate();
    }

    return new Date(timestamp || Date.now());
  }

  function getDistributionCounts(distribution) {
    return {
      positive: Number(distribution && (distribution.positiveCount ?? distribution.Positive) || 0),
      neutral: Number(distribution && (distribution.neutralCount ?? distribution.Neutral) || 0),
      negative: Number(distribution && (distribution.negativeCount ?? distribution.Negative) || 0),
    };
  }

  function getCountsFromModel(modelResult) {
    if (modelResult && modelResult.distribution) {
      return getDistributionCounts(modelResult.distribution);
    }

    const comments = modelResult && Array.isArray(modelResult.comments)
      ? modelResult.comments
      : modelResult && Array.isArray(modelResult.commentResults)
        ? modelResult.commentResults
        : [];

    return comments.reduce(
      (counts, comment) => {
        const sentiment = comment.sentiment || comment.sentimentLabel;
        const key = String(sentiment || "").toLowerCase();

        if (key === "positive" || key === "neutral" || key === "negative") {
          counts[key] += 1;
        }

        return counts;
      },
      { positive: 0, neutral: 0, negative: 0 }
    );
  }

  function toStoredDistribution(distribution) {
    return {
      positiveCount: Number(distribution && (distribution.Positive ?? distribution.positiveCount) || 0),
      neutralCount: Number(distribution && (distribution.Neutral ?? distribution.neutralCount) || 0),
      negativeCount: Number(distribution && (distribution.Negative ?? distribution.negativeCount) || 0),
    };
  }

  function toUiDistribution(distribution) {
    return {
      Positive: Number(distribution && (distribution.positiveCount ?? distribution.Positive) || 0),
      Neutral: Number(distribution && (distribution.neutralCount ?? distribution.Neutral) || 0),
      Negative: Number(distribution && (distribution.negativeCount ?? distribution.Negative) || 0),
    };
  }

  function toStoredCommentResult(comment) {
    const vader = comment.vader || comment.vaderScore || {};
    const textblob = comment.textblob || {};

    return {
      commentText: String(comment.commentText ?? comment.text ?? ""),
      sentimentLabel: String(comment.sentimentLabel ?? comment.sentiment ?? "Neutral"),
      vaderScore: {
        positive: Number(vader.positive ?? vader.pos ?? 0),
        neutral: Number(vader.neutral ?? vader.neu ?? 0),
        negative: Number(vader.negative ?? vader.neg ?? 0),
        compound: Number(vader.compound ?? 0),
        label: String(vader.label ?? ""),
      },
      textBlobLabel: String(comment.textBlobLabel ?? textblob.label ?? ""),
      textBlobPolarity: Number(comment.textBlobPolarity ?? textblob.polarity ?? 0),
      textBlobSubjectivity: Number(comment.textBlobSubjectivity ?? textblob.subjectivity ?? 0),
    };
  }

  function toUiCommentResult(comment, index) {
    const vader = comment.vaderScore || comment.vader || {};
    const textblob = comment.textblob || {};

    return {
      id: index + 1,
      text: String(comment.commentText ?? comment.text ?? ""),
      sentiment: String(comment.sentimentLabel ?? comment.sentiment ?? "Neutral"),
      vader: {
        pos: Number(vader.positive ?? vader.pos ?? 0),
        neu: Number(vader.neutral ?? vader.neu ?? 0),
        neg: Number(vader.negative ?? vader.neg ?? 0),
        compound: Number(vader.compound ?? 0),
        label: String(vader.label ?? ""),
      },
      textblob: {
        polarity: Number(comment.textBlobPolarity ?? textblob.polarity ?? 0),
        subjectivity: Number(comment.textBlobSubjectivity ?? textblob.subjectivity ?? 0),
        label: String(comment.textBlobLabel ?? textblob.label ?? ""),
      },
    };
  }

  function toStoredModelResult(modelResult) {
    const comments = Array.isArray(modelResult.commentResults)
      ? modelResult.commentResults
      : Array.isArray(modelResult.comments)
        ? modelResult.comments
        : [];

    return {
      modelName: String(modelResult.modelName || ""),
      commentResults: comments.map(toStoredCommentResult),
      distribution: toStoredDistribution(modelResult.distribution),
    };
  }

  function toUiModelResult(modelName, modelResult) {
    const commentResults = Array.isArray(modelResult.commentResults)
      ? modelResult.commentResults
      : Array.isArray(modelResult.comments)
        ? modelResult.comments
        : [];

    return {
      modelName: modelResult.modelName || modelName,
      distribution: toUiDistribution(modelResult.distribution),
      comments: commentResults.map(toUiCommentResult),
    };
  }

  function toResultsByModel(modelResults) {
    return modelResults.reduce((resultsByModel, modelResult) => {
      const storedModelResult = toStoredModelResult(modelResult);
      if (storedModelResult.modelName) {
        resultsByModel[storedModelResult.modelName] = storedModelResult;
      }
      return resultsByModel;
    }, {});
  }

  function toUiModelResults(data) {
    if (data.resultsByModel && typeof data.resultsByModel === "object" && !Array.isArray(data.resultsByModel)) {
      return Object.entries(data.resultsByModel).map(([modelName, modelResult]) =>
        toUiModelResult(modelName, modelResult)
      );
    }

    if (Array.isArray(data.modelResults)) {
      return data.modelResults.map((modelResult) =>
        toUiModelResult(modelResult.modelName, modelResult)
      );
    }

    return [];
  }

  function toStoredAnalysisRecord(record, user, analysisId) {
    const selectedModels = Array.isArray(record.selectedModels)
      ? record.selectedModels
      : Array.isArray(record.models)
        ? record.models
        : [];

    const modelResults = Array.isArray(record.modelResults)
      ? record.modelResults
      : Object.values(record.resultsByModel || {});

    return {
      analysisId,
      analysisNumber: Number(record.analysisNumber || 0),
      userId: user.uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      comments: Array.isArray(record.comments) ? record.comments.map(String) : [],
      selectedModels,
      resultsByModel: toResultsByModel(modelResults),
    };
  }

  function normalizeAnalysisDoc(doc) {
    const data = doc.data();
    const recordDate = getRecordDate(data);
    const modelResults = toUiModelResults(data);
    const selectedModels = Array.isArray(data.selectedModels)
      ? data.selectedModels
      : Array.isArray(data.models)
        ? data.models
        : modelResults.map((modelResult) => modelResult.modelName);

    return {
      id: data.analysisId || doc.id,
      analysisNumber: Number(data.analysisNumber || 0),
      date: data.date || formatDate(recordDate),
      time: data.time || formatTime(recordDate),
      models: selectedModels,
      comments: Array.isArray(data.comments) ? data.comments : [],
      modelResults,
      totalComments: Array.isArray(data.comments) ? data.comments.length : 0,
      summary: modelResults.length
        ? getCountsFromModel(modelResults[0])
        : { positive: 0, neutral: 0, negative: 0 },
    };
  }

  async function registerUser(name, email, password) {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName: name });

    await db.collection("users").doc(credential.user.uid).set({
      userId: credential.user.uid,
      fullName: name,
      email,
    }, { merge: true });

    return credential.user;
  }

  async function loginUser(email, password) {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    return credential.user;
  }

  async function logoutUser() {
    await auth.signOut();
  }

  async function sendPasswordReset(email) {
    await auth.sendPasswordResetEmail(email);
  }

  async function getUserProfile() {
    const user = await requireUser();
    const profileRef = db.collection("users").doc(user.uid);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      const fallbackProfile = {
        userId: user.uid,
        fullName: user.displayName || "",
        email: user.email || "",
      };
      await profileRef.set(fallbackProfile, { merge: true });
      return {
        name: fallbackProfile.fullName,
        email: fallbackProfile.email,
      };
    }

    const profile = profileDoc.data();
    return {
      name: profile.fullName || profile.name || user.displayName || "",
      email: profile.email || user.email || "",
    };
  }

  async function updateUserName(name) {
    const user = await requireUser();
    await user.updateProfile({ displayName: name });
    await db.collection("users").doc(user.uid).set({
      userId: user.uid,
      fullName: name,
      email: user.email || "",
    }, { merge: true });
  }

  async function updateUserPassword(currentPassword, newPassword) {
    const user = await requireUser();
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  }

  async function getNextAnalysisNumber(userRef) {
  const snapshot = await userRef
    .collection(ANALYSIS_COLLECTION)
    .orderBy("analysisNumber", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return 1;
  }

  const latestNumber = Number(snapshot.docs[0].data().analysisNumber || 0);
  return latestNumber + 1;
}

async function saveAnalysis(record) {
  const user = await requireUser();
  const userRef = db.collection("users").doc(user.uid);

  const docRef = userRef
    .collection(ANALYSIS_COLLECTION)
    .doc();

  const analysisNumber = await getNextAnalysisNumber(userRef);

  await docRef.set(
    toStoredAnalysisRecord(
      {
        ...record,
        analysisNumber,
      },
      user,
      docRef.id
    )
  );

  return docRef.id;
}

  async function getAnalysisHistory() {
    const user = await requireUser();
    const userRef = db.collection("users").doc(user.uid);
    const snapshot = await userRef
      .collection(ANALYSIS_COLLECTION)
      .orderBy("timestamp", "desc")
      .get();

    const records = snapshot.docs.map(normalizeAnalysisDoc);

    if (records.length > 0) {
      return records;
    }

    const legacySnapshot = await userRef
      .collection(LEGACY_ANALYSIS_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    return legacySnapshot.docs.map(normalizeAnalysisDoc);
  }

  async function deleteAnalysis(id) {
    const user = await requireUser();
    const userRef = db.collection("users").doc(user.uid);

    await userRef
      .collection(ANALYSIS_COLLECTION)
      .doc(id)
      .delete();

    await userRef
      .collection(LEGACY_ANALYSIS_COLLECTION)
      .doc(id)
      .delete()
      .catch(() => {});
  }

  window.CommentInsightFirebase = {
    app,
    auth,
    db,
    waitForAuthUser,
    requireUser,
    registerUser,
    loginUser,
    logoutUser,
    sendPasswordReset,
    getUserProfile,
    updateUserName,
    updateUserPassword,
    saveAnalysis,
    getAnalysisHistory,
    deleteAnalysis,
  };
})();
