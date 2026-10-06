/**
 * AnalyzePage - Sentiment Analysis Application
 * Flask backend connected version.
 * Refactored version:
 * - HTML structure is stored in AnalyzePage.html templates.
 * - CSS styling is stored in AnalyzePage.css.
 * - JavaScript handles logic, events, API calls, Firebase, and data updates.
 */

const state = {
  comments: ['', '', '', '', ''],
  selectedModel: 'SVM',
  compareModels: { SVM: false, LR: false, NB: false },
  loading: false,
  results: null,
  error: '',
};

const MODELS = [
  { id: 'SVM', label: 'SVM (Support Vector Machine)' },
  { id: 'LR', label: 'Logistic Regression' },
  { id: 'NB', label: 'Naive Bayes' },
];

const MODEL_ORDER = ['SVM', 'LR', 'NB'];

const PREDICT_API_URL = 'http://127.0.0.1:5000/predict';

const sentimentCharts = {};
let vaderDoughnutChart = null;

function initializeApp() {
  setupEventListeners();
  renderComments();
  renderModelSelection();
  updateUI();
}

function setupEventListeners() {
  document.getElementById('analyzeBtn').addEventListener('click', analyzeComments);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('closeDetailsModal').addEventListener('click', closeDetailsModal);
  document.getElementById('detailsModalBackdrop').addEventListener('click', closeDetailsModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDetailsModal();
    }
  });
}

function getTemplateContent(templateId) {
  const template = document.getElementById(templateId);

  if (!template) {
    throw new Error(`Missing HTML template: ${templateId}`);
  }

  return template.content.firstElementChild.cloneNode(true);
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function getCssVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* =========================
   Comment Input
========================= */

function renderComments() {
  const container = document.getElementById('commentsContainer');
  clearElement(container);

  state.comments.forEach((comment, index) => {
    const commentItem = getTemplateContent('commentInputTemplate');
    const label = commentItem.querySelector('label');
    const textarea = commentItem.querySelector('textarea');
    const charCount = commentItem.querySelector('.comment-char-count');
    const limitMessage = commentItem.querySelector('.comment-limit-message');

    const commentNumber = index + 1;
    const textareaId = `comment-${commentNumber}`;

    label.setAttribute('for', textareaId);
    label.textContent = `Comment ${commentNumber}`;

    textarea.id = textareaId;
    textarea.placeholder = `Enter comment ${commentNumber}...`;
    textarea.value = comment;

    updateCommentLimitUI(textarea, charCount, limitMessage, comment.length);

    textarea.addEventListener('input', (event) => {
      const value = event.target.value.slice(0, 500);
      event.target.value = value;

      updateComment(index, value);
      updateCommentLimitUI(textarea, charCount, limitMessage, value.length);
    });

    container.appendChild(commentItem);
  });
}

function updateCommentLimitUI(textarea, charCount, limitMessage, length) {
  charCount.textContent = `${length} / 500`;

  if (length >= 500) {
    charCount.classList.add('limit-reached');
    textarea.classList.add('textarea-limit-reached');
    limitMessage.classList.remove('hidden');
  } else {
    charCount.classList.remove('limit-reached');
    textarea.classList.remove('textarea-limit-reached');
    limitMessage.classList.add('hidden');
  }
}

function updateComment(index, value) {
  state.comments[index] = String(value || '').slice(0, 500);

  if (state.error) {
    clearError();
  }
}

/* =========================
   Model Selection
========================= */

function renderModelSelection() {
  renderDefaultModelRadios();
  renderCompareModelCheckboxes();
}

function renderDefaultModelRadios() {
  const container = document.getElementById('defaultModelGroup');
  clearElement(container);

  const primaryModel = getTemplateContent('primaryModelTemplate');
  container.appendChild(primaryModel);

  state.selectedModel = 'SVM';
}

function renderCompareModelCheckboxes() {
  const container = document.getElementById('compareModelsGroup');
  clearElement(container);

  const compareModels = [
    {
      id: 'LR',
      shortName: 'LR',
      fullName: 'Logistic Regression',
      description: 'Strong alternative model for comparison.',
    },
    {
      id: 'NB',
      shortName: 'NB',
      fullName: 'Naive Bayes',
      description: 'Additional comparison model with lower overall performance.',
    },
  ];

  compareModels.forEach((model) => {
    const checkboxItem = getTemplateContent('compareModelTemplate');
    const label = checkboxItem.querySelector('label');
    const checkbox = checkboxItem.querySelector('input');
    const pill = checkboxItem.querySelector('.model-pill');
    const fullName = checkboxItem.querySelector('.model-full-name');
    const description = checkboxItem.querySelector('.model-description');

    const checkboxId = `compare-${model.id}`;

    label.setAttribute('for', checkboxId);
    checkbox.id = checkboxId;
    checkbox.checked = Boolean(state.compareModels[model.id]);

    pill.classList.add(`model-pill-${model.id.toLowerCase()}`);
    pill.textContent = model.shortName;

    fullName.textContent = model.fullName;
    description.textContent = model.description;

    checkbox.addEventListener('change', () => {
      state.compareModels[model.id] = checkbox.checked;
    });

    container.appendChild(checkboxItem);
  });
}

function getSelectedModels() {
  const models = [state.selectedModel];

  MODELS.forEach((model) => {
    if (model.id !== state.selectedModel && state.compareModels[model.id]) {
      models.push(model.id);
    }
  });

  return sortModelNames(models);
}

function sortModelNames(modelNames) {
  return [...modelNames].sort((a, b) => {
    const aIndex = MODEL_ORDER.indexOf(a);
    const bIndex = MODEL_ORDER.indexOf(b);
    const safeAIndex = aIndex === -1 ? MODEL_ORDER.length : aIndex;
    const safeBIndex = bIndex === -1 ? MODEL_ORDER.length : bIndex;

    return safeAIndex - safeBIndex;
  });
}

function sortModelResults(modelResults) {
  return [...modelResults].sort((a, b) => {
    const aIndex = MODEL_ORDER.indexOf(a.modelName);
    const bIndex = MODEL_ORDER.indexOf(b.modelName);
    const safeAIndex = aIndex === -1 ? MODEL_ORDER.length : aIndex;
    const safeBIndex = bIndex === -1 ? MODEL_ORDER.length : bIndex;

    return safeAIndex - safeBIndex;
  });
}

/* =========================
   Error Message
========================= */

function showError(message) {
  state.error = message;
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function clearError() {
  state.error = '';
  const errorEl = document.getElementById('errorMessage');
  errorEl.textContent = '';
  errorEl.classList.add('hidden');
}

/* =========================
   Analysis Flow
========================= */

async function analyzeComments() {
  const filledComments = state.comments.filter((comment) => comment.trim());

  if (filledComments.length === 0) {
    showError('Please enter at least one comment to analyze');
    return;
  }

  clearError();
  state.loading = true;
  updateUI();

  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('resetBtn').disabled = true;

  const selectedModels = getSelectedModels();

  try {
    state.results = await generateAnalysisResults(filledComments, selectedModels);

    await saveCurrentAnalysisToFirebase(filledComments, selectedModels);

    state.loading = false;
    updateUI();
    showToast('Analysis complete and saved!', 'success');
  } catch (error) {
    state.loading = false;
    updateUI();
    showError(error.message || 'Unable to analyze comments. Please make sure the Flask backend is running.');
    showToast('Analysis failed', 'error');
  } finally {
    document.getElementById('analyzeBtn').disabled = false;
    document.getElementById('resetBtn').disabled = false;
  }
}

async function saveCurrentAnalysisToFirebase(comments, selectedModels) {
  if (!window.CommentInsightFirebase || !state.results) {
    return;
  }

  try {
    await window.CommentInsightFirebase.saveAnalysis({
      comments,
      models: selectedModels,
      modelResults: state.results.modelResults,
      totalComments: state.results.totalComments,
      summary: getSentimentCounts(state.results.modelResults[0].comments),
    });
  } catch (error) {
    throw new Error(error.message || 'Analysis completed, but saving to Firebase failed');
  }
}

async function generateAnalysisResults(comments, selectedModels) {
  const backendResults = await Promise.all(comments.map(predictSentiment));

  return {
    totalComments: comments.length,
    modelResults: sortModelNames(selectedModels).map((modelName) => {
      const analyzedComments = backendResults.map((prediction, index) =>
        createAnalyzedCommentFromBackend(prediction, index, modelName)
      );

      return {
        modelName,
        distribution: getDistribution(analyzedComments),
        comments: analyzedComments,
      };
    }),
  };
}

async function predictSentiment(text) {
  const response = await fetch(PREDICT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.details || 'Unable to get prediction from Flask backend.');
  }

  return data;
}

function createAnalyzedCommentFromBackend(prediction, index, modelName) {
  const modelPrediction = Array.isArray(prediction.predictions)
    ? prediction.predictions.find((item) => item.model === modelName)
    : null;

  const rawSentiment = modelPrediction
    ? modelPrediction.prediction
    : prediction.sentiment;

  const sentiment = formatSentimentLabel(rawSentiment);

  const vader = prediction.vader || {};
  const textblob = prediction.textblob || {};

  return {
    id: index + 1,
    text: prediction.original_text || '',
    cleanedText: prediction.cleaned_text || '',
    sentiment,
    vader: {
      pos: Number(vader.pos ?? 0),
      neu: Number(vader.neu ?? 0),
      neg: Number(vader.neg ?? 0),
      compound: Number(vader.compound ?? 0),
      label: formatSentimentLabel(vader.label),
    },
    textblob: {
      polarity: Number(textblob.polarity ?? 0),
      subjectivity: Number(textblob.subjectivity ?? 0),
      label: formatSentimentLabel(textblob.label),
    },
  };
}

function formatSentimentLabel(sentiment) {
  const value = String(sentiment || '').toLowerCase();

  if (value === 'positive') return 'Positive';
  if (value === 'negative') return 'Negative';
  return 'Neutral';
}

function getDistribution(comments) {
  return comments.reduce(
    (totals, comment) => {
      totals[comment.sentiment] += 1;
      return totals;
    },
    { Positive: 0, Neutral: 0, Negative: 0 }
  );
}

function getSentimentCounts(predictions) {
  return predictions.reduce(
    (counts, prediction) => {
      const sentiment = typeof prediction === 'string' ? prediction : prediction.sentiment;
      const key = sentiment ? sentiment.toLowerCase() : '';

      if (key === 'positive' || key === 'neutral' || key === 'negative') {
        counts[key] += 1;
      }

      return counts;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );
}

/* =========================
   UI Rendering
========================= */

function updateUI() {
  const resultsContainer = document.getElementById('resultsContainer');
  clearElement(resultsContainer);

  if (state.loading) {
    destroySentimentCharts();
    resultsContainer.appendChild(getTemplateContent('loadingStateTemplate'));
    return;
  }

  if (state.results) {
    renderResults(state.results);
    return;
  }

  destroySentimentCharts();
  renderEmptyState();
}

function renderResults(results) {
  const resultsContainer = document.getElementById('resultsContainer');
  destroySentimentCharts();
  clearElement(resultsContainer);

  const sortedModelResults = sortModelResults(results.modelResults);

  const summaryCard = getTemplateContent('summaryCardTemplate');
  const totalComments = summaryCard.querySelector('.summary-number');
  const selectedModelPills = summaryCard.querySelector('.selected-model-pills');
  const summaryChartGrid = summaryCard.querySelector('.summary-chart-grid');

  totalComments.textContent = results.totalComments;

  sortedModelResults.forEach((modelResult) => {
    const pill = createModelPill(modelResult.modelName);
    selectedModelPills.appendChild(pill);
  });

  sortedModelResults.forEach((modelResult) => {
    const chartCard = createSummaryChartCard(modelResult);
    summaryChartGrid.appendChild(chartCard);
  });

  resultsContainer.appendChild(summaryCard);

  sortedModelResults.forEach((modelResult) => {
    renderSentimentChart(`summarySentimentChart-${modelResult.modelName}`, modelResult.distribution);
  });

  sortedModelResults.forEach((modelResult) => {
    resultsContainer.appendChild(renderModelResultCard(modelResult));
  });

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.className = 'download-csv-btn';
  downloadButton.textContent = 'Download Results as CSV';
  downloadButton.addEventListener('click', downloadResultsAsCsv);
  resultsContainer.appendChild(downloadButton);
}

function createModelPill(modelName) {
  const pill = getTemplateContent('modelPillTemplate');

  pill.classList.add(`model-pill-${modelName.toLowerCase()}`);
  pill.textContent = modelName;

  return pill;
}

function createSummaryChartCard(modelResult) {
  const chartCard = getTemplateContent('summaryChartCardTemplate');
  const modelTitle = chartCard.querySelector('.summary-model-title-block h3');
  const modelType = chartCard.querySelector('.summary-model-title-block p');
  const countValues = chartCard.querySelectorAll('.summary-count-value');
  const countContainer = chartCard.querySelector('.summary-mini-counts');
  const canvas = chartCard.querySelector('canvas');
  const fallback = chartCard.querySelector('.chart-fallback');
  const counts = getSentimentCounts(modelResult.comments);
  const chartId = `summarySentimentChart-${modelResult.modelName}`;

  modelTitle.textContent = modelResult.modelName;
  modelType.textContent = modelResult.modelName === 'SVM' ? '(Primary)' : '(Compared)';

  countValues[0].textContent = counts.positive;
  countValues[1].textContent = counts.neutral;
  countValues[2].textContent = counts.negative;

  countContainer.setAttribute('aria-label', `${modelResult.modelName} sentiment counts`);

  canvas.id = chartId;
  canvas.setAttribute('aria-label', `${modelResult.modelName} sentiment distribution chart`);

  fallback.id = `${chartId}-fallback`;

  return chartCard;
}

function renderModelResultCard(modelResult) {
  const modelCard = getTemplateContent('modelResultCardTemplate');
  const sentimentCounts = getSentimentCounts(modelResult.comments);

  const modelNameLower = modelResult.modelName.toLowerCase();
  const modelDot = modelCard.querySelector('.model-dot');
  const modelTitle = modelCard.querySelector('.model-result-title');
  const positiveCount = modelCard.querySelector('.summary-positive');
  const neutralCount = modelCard.querySelector('.summary-neutral');
  const negativeCount = modelCard.querySelector('.summary-negative');
  const list = modelCard.querySelector('.per-comment-list');

  modelCard.classList.add(`model-${modelNameLower}`);
  modelDot.classList.add(`model-dot-${modelNameLower}`);
  modelTitle.textContent = `${modelResult.modelName} Results`;

  positiveCount.textContent = `Positive ${sentimentCounts.positive}`;
  neutralCount.textContent = `Neutral ${sentimentCounts.neutral}`;
  negativeCount.textContent = `Negative ${sentimentCounts.negative}`;

  modelResult.comments.forEach((comment) => {
    list.appendChild(createResultCard(comment));
  });

  return modelCard;
}

function renderSentimentChart(canvasId, distribution) {
  const canvas = document.getElementById(canvasId);
  const fallback = document.getElementById(`${canvasId}-fallback`);

  if (!canvas) return;

  const labels = ['Positive', 'Neutral', 'Negative'];
  const counts = labels.map((label) => distribution[label] || 0);

  if (typeof Chart === 'undefined') {
    if (fallback) {
      fallback.classList.remove('hidden');
      fallback.textContent = `Positive: ${counts[0]} | Neutral: ${counts[1]} | Negative: ${counts[2]}`;
    }
    return;
  }

  if (sentimentCharts[canvasId]) {
    sentimentCharts[canvasId].destroy();
  }

  sentimentCharts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Comments',
          data: counts,
          backgroundColor: [
            getCssVariable('--chart-positive'),
            getCssVariable('--chart-neutral'),
            getCssVariable('--chart-negative'),
          ],
          borderColor: [
            getCssVariable('--chart-positive-border'),
            getCssVariable('--chart-neutral-border'),
            getCssVariable('--chart-negative-border'),
          ],
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 52,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} comment${context.parsed.y === 1 ? '' : 's'}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: getCssVariable('--chart-dark'),
            font: { weight: '700' },
          },
        },
        y: {
          beginAtZero: true,
          min: 0,
          max: 5,
          ticks: {
            stepSize: 1,
            precision: 0,
            color: getCssVariable('--chart-neutral'),
            callback: function (value) {
              return Number.isInteger(value) ? value : '';
            },
          },
          grid: {
            color: getCssVariable('--chart-grid'),
          },
        },
      },
    },
  });
}

function destroySentimentCharts() {
  Object.values(sentimentCharts).forEach((chart) => chart.destroy());
  Object.keys(sentimentCharts).forEach((canvasId) => {
    delete sentimentCharts[canvasId];
  });
}

function createResultCard(comment) {
  const row = getTemplateContent('resultRowTemplate');
  const index = row.querySelector('.result-row-index');
  const commentPreview = row.querySelector('.comment-preview');
  const sentimentContainer = row.querySelector('.result-row-sentiment');
  const supportingButton = row.querySelector('.supporting-btn');

  index.textContent = comment.id;
  commentPreview.textContent = comment.text;
  sentimentContainer.appendChild(createSentimentBadge(comment.sentiment));

  supportingButton.addEventListener('click', () => {
    openDetailsModal(comment);
  });

  return row;
}

function createSentimentBadge(sentiment) {
  const config = getSentimentBadgeConfig(sentiment);
  const badge = getTemplateContent('sentimentBadgeTemplate');
  const icon = badge.querySelector('.sentiment-badge-icon');
  const label = badge.querySelector('.sentiment-badge-label');

  badge.classList.add(`sentiment-${config.className}`);
  icon.textContent = config.icon;
  label.textContent = config.label;

  return badge;
}

function getSentimentBadgeConfig(sentiment) {
  const badges = {
    Positive: { icon: '😊', label: 'Positive', className: 'positive' },
    Neutral: { icon: '😐', label: 'Neutral', className: 'neutral' },
    Negative: { icon: '☹', label: 'Negative', className: 'negative' },
  };

  return badges[sentiment] || { icon: '•', label: sentiment, className: 'neutral' };
}

function renderEmptyState() {
  const resultsContainer = document.getElementById('resultsContainer');
  clearElement(resultsContainer);
  resultsContainer.appendChild(getTemplateContent('emptyStateTemplate'));
}

/* =========================
   Details Modal
========================= */

function openDetailsModal(comment) {
  const modal = document.getElementById('detailsModal');
  const polarityPosition = ((comment.textblob.polarity + 1) / 2) * 100;
  const subjectivityPosition = comment.textblob.subjectivity * 100;
  const compoundPosition = ((comment.vader.compound + 1) / 2) * 100;

  const modalBadge = document.getElementById('modalSentimentBadge');
  const compoundPointer = document.getElementById('compoundPointer');
  const polarityPointer = document.getElementById('polarityPointer');
  const subjectivityPointer = document.getElementById('subjectivityPointer');

  document.getElementById('detailsModalTitle').textContent = 'Extra Scores';
  document.getElementById('modalCommentText').textContent = comment.text;

  clearElement(modalBadge);
  modalBadge.appendChild(createSentimentBadge(comment.sentiment));

  renderVaderDoughnutChart(comment.vader);

  document.getElementById('vaderPositive').textContent = comment.vader.pos.toFixed(3);
  document.getElementById('vaderNeutral').textContent = comment.vader.neu.toFixed(3);
  document.getElementById('vaderNegative').textContent = comment.vader.neg.toFixed(3);
  document.getElementById('vaderCompound').textContent = comment.vader.compound.toFixed(3);

  if (compoundPointer) {
    compoundPointer.style.setProperty('--compound-left', `${compoundPosition}%`);
  }

  document.getElementById('polarityValue').textContent = comment.textblob.polarity.toFixed(3);
  document.getElementById('subjectivityValue').textContent = comment.textblob.subjectivity.toFixed(3);

  if (polarityPointer) {
    polarityPointer.style.setProperty('--pointer-left', `${polarityPosition}%`);
  }

  if (subjectivityPointer) {
    subjectivityPointer.style.setProperty('--pointer-left', `${subjectivityPosition}%`);
  }

  modal.classList.remove('hidden');
}

function closeDetailsModal() {
  document.getElementById('detailsModal').classList.add('hidden');
  destroyVaderDoughnutChart();
}

function renderVaderDoughnutChart(vaderScores) {
  const canvas = document.getElementById('vaderDoughnutChart');

  if (!canvas || typeof Chart === 'undefined') return;

  destroyVaderDoughnutChart();

  vaderDoughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [
        {
          data: [vaderScores.pos, vaderScores.neu, vaderScores.neg],
          backgroundColor: [
            getCssVariable('--chart-positive'),
            getCssVariable('--chart-neutral'),
            getCssVariable('--chart-negative'),
          ],
          borderColor: getCssVariable('--chart-white'),
          borderWidth: 4,
          hoverOffset: 8,
          spacing: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: {
        animateRotate: true,
        duration: 450,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: getCssVariable('--chart-dark'),
          titleColor: getCssVariable('--chart-white'),
          bodyColor: getCssVariable('--chart-light-text'),
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: (context) => {
              const value = Number(context.raw || 0).toFixed(3);
              return `${context.label}: ${value}`;
            },
          },
        },
      },
    },
  });
}

function destroyVaderDoughnutChart() {
  if (vaderDoughnutChart) {
    vaderDoughnutChart.destroy();
    vaderDoughnutChart = null;
  }
}

/* =========================
   CSV Export
========================= */

function getPolarityLabel(value) {
  if (value > 0.1) return 'Positive';
  if (value < -0.1) return 'Negative';
  return 'Neutral';
}

function getSubjectivityLabel(value) {
  return value >= 0.5 ? 'Subjective' : 'Objective';
}

function downloadResultsAsCsv() {
  if (!state.results || !state.results.modelResults.length) {
    showToast('No results available to export', 'error');
    return;
  }

  const headers = [
    'comment_index',
    'comment_text',
    'model_name',
    'predicted_sentiment',
    'vader_label',
    'vader_positive',
    'vader_neutral',
    'vader_negative',
    'vader_compound',
    'textblob_label',
    'textblob_polarity',
    'textblob_subjectivity',
  ];

  const rows = sortModelResults(state.results.modelResults).flatMap((modelResult) =>
    (modelResult.comments || []).map((comment) => [
      comment.id,
      comment.text,
      modelResult.modelName,
      comment.sentiment,
      comment.vader?.label || getPolarityLabel(Number(comment.vader?.compound ?? 0)),
      Number(comment.vader?.pos ?? 0).toFixed(3),
      Number(comment.vader?.neu ?? 0).toFixed(3),
      Number(comment.vader?.neg ?? 0).toFixed(3),
      Number(comment.vader?.compound ?? 0).toFixed(3),
      comment.textblob?.label || getPolarityLabel(Number(comment.textblob?.polarity ?? 0)),
      Number(comment.textblob?.polarity ?? 0).toFixed(3),
      Number(comment.textblob?.subjectivity ?? 0).toFixed(3),
    ])
  );

  const csv = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `CommentInsight-analysis-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast('CSV downloaded successfully', 'success');
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/* =========================
   Reset / Toast / Logout
========================= */

function resetAll() {
  state.comments = ['', '', '', '', ''];
  state.results = null;
  state.error = '';
  state.selectedModel = 'SVM';
  state.compareModels = { SVM: false, LR: false, NB: false };

  closeDetailsModal();
  destroyVaderDoughnutChart();
  destroySentimentCharts();
  renderComments();
  renderModelSelection();
  updateUI();
  clearError();
  showToast('Form reset', 'info');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = getTemplateContent('toastTemplate');

  toast.classList.add(type);
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
  }, 2600);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

async function handleLogout() {
  try {
    if (window.CommentInsightFirebase) {
      await window.CommentInsightFirebase.logoutUser();
    }

    showToast('Logged out successfully', 'info');

    setTimeout(() => {
      window.location.href = 'LandingPage.html';
    }, 1000);
  } catch (error) {
    showToast(error.message || 'Logout failed', 'error');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initializeApp();
  window.CommentInsightNavbar.init('/analyze', { onLogout: handleLogout });
});