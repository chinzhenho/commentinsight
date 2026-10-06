/**
 * HistoryPage - Display saved analysis records and full saved results.
 * Refactored carefully:
 * - CSV format keeps the original createCsv() and createCombinedCsv() structure.
 * - Design and colors remain controlled by HistoryPage.css.
 * - HTML templates are stored in HistoryPage.html.
 * - JavaScript handles logic, Firebase, events, charts, CSV, and data updates.
 */

let state = {
  historyRecords: [],
  selectedRecord: null,
  selectedDownloadIds: new Set(),
  loading: true,
  error: '',
  deleteMode: 'single',
};

const modelLabels = {
  SVM: 'SVM',
  LR: 'Logistic Regression',
  NB: 'Naive Bayes',
};

const MODEL_ORDER = ['SVM', 'LR', 'NB'];

const sentimentCharts = {};
let vaderDoughnutChart = null;

/* =========================
   Setup
========================= */

async function initializePage() {
  setupEventListeners();
  await loadHistoryRecords();
}

function setupEventListeners() {
  document.getElementById('cancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', handleConfirmDelete);
  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
  document.querySelector('.delete-modal-backdrop').addEventListener('click', closeDeleteModal);

  document.getElementById('closeHistoryDetailsModal').addEventListener('click', closeHistoryDetailsModal);
  document.getElementById('historyDetailsBackdrop').addEventListener('click', closeHistoryDetailsModal);

  document.getElementById('closeCommentDetailsModal').addEventListener('click', closeCommentDetailsModal);
  document.getElementById('commentDetailsBackdrop').addEventListener('click', closeCommentDetailsModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCommentDetailsModal();
      closeHistoryDetailsModal();
      closeDeleteModal();
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

/* =========================
   Data Loading / Normalization
========================= */

async function loadHistoryRecords() {
  state.loading = true;
  state.error = '';
  renderHistoryRecords();

  if (!window.CommentInsightFirebase) {
    state.historyRecords = [];
    state.loading = false;
    renderHistoryRecords();
    return;
  }

  try {
    const records = await window.CommentInsightFirebase.getAnalysisHistory();

    state.historyRecords = Array.isArray(records) ? records : [];
    normalizeHistoryRecords();

    state.loading = false;
    renderHistoryRecords();
  } catch (error) {
    state.historyRecords = [];
    state.loading = false;
    state.error = error.message || 'Unable to load Firebase history';

    renderHistoryRecords();
    showToast(state.error, 'error');
  }
}

function normalizeHistoryRecords() {
  state.historyRecords = state.historyRecords.map((record) => {
    const normalized = { ...record };

    normalized.comments = Array.isArray(normalized.comments) ? normalized.comments : [];
    normalized.models = Array.isArray(normalized.models) ? normalized.models : [];

    // Do not generate fake local analysis.
    // Only use modelResults that were really saved from Analyze page / Firebase.
    normalized.modelResults = Array.isArray(normalized.modelResults)
      ? sortModelResults(normalized.modelResults)
      : [];

    normalized.totalComments = Number(normalized.totalComments || normalized.comments.length || 0);

    normalized.summary = normalized.modelResults.length
      ? getSentimentCounts(normalized.modelResults[0].comments || [])
      : { positive: 0, neutral: 0, negative: 0 };

    return normalized;
  });
}

/* =========================
   Helper Functions
========================= */

function sortModelResults(modelResults) {
  return [...modelResults].sort((a, b) => {
    const aIndex = MODEL_ORDER.indexOf(a.modelName);
    const bIndex = MODEL_ORDER.indexOf(b.modelName);

    const safeAIndex = aIndex === -1 ? MODEL_ORDER.length : aIndex;
    const safeBIndex = bIndex === -1 ? MODEL_ORDER.length : bIndex;

    return safeAIndex - safeBIndex;
  });
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

function getAnalysisDisplayName(record) {
  if (record.analysisNumber) {
    return `Analysis Record ${record.analysisNumber}`;
  }

  return 'Analysis Record';
}

function formatModelName(model) {
  const value = String(model || '').toUpperCase();

  if (value === 'SVM') return 'SVM';
  if (value === 'LR') return 'Logistic Regression';
  if (value === 'NB') return 'Naive Bayes';

  return String(model || '');
}

function getVaderLabel(vader = {}) {
  if (vader.label) return vader.label;

  const compound = Number(vader.compound ?? 0);
  if (compound >= 0.05) return 'Positive';
  if (compound <= -0.05) return 'Negative';
  return 'Neutral';
}

function getTextBlobLabel(textblob = {}) {
  if (textblob.label) return textblob.label;
  return getPolarityLabel(Number(textblob.polarity ?? 0));
}

function toFixedScore(value) {
  return Number(value ?? 0).toFixed(3);
}

function getPolarityLabel(value) {
  if (value > 0.1) return 'Positive';
  if (value < -0.1) return 'Negative';
  return 'Neutral';
}

function getSubjectivityLabel(value) {
  return value >= 0.5 ? 'Subjective' : 'Objective';
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/* =========================
   Main History Rendering
========================= */

function renderHistoryRecords() {
  const container = document.getElementById('historyContainer');
  clearElement(container);

  if (state.loading) {
    renderHistoryLoading();
    return;
  }

  if (state.error) {
    renderHistoryError(state.error);
    return;
  }

  if (state.historyRecords.length === 0) {
    renderEmptyState();
    return;
  }

  container.appendChild(createBulkDownloadToolbar());
  container.appendChild(createHistoryTable());
  container.appendChild(createHistoryFooter());
}

function renderHistoryLoading() {
  const container = document.getElementById('historyContainer');
  container.appendChild(getTemplateContent('historyLoadingTemplate'));
}

function renderHistoryError(message) {
  const container = document.getElementById('historyContainer');
  const errorCard = getTemplateContent('historyErrorTemplate');
  const errorMessage = errorCard.querySelector('.history-error-message');
  const retryButton = errorCard.querySelector('.retry-load-history-btn');

  errorMessage.textContent = message;

  retryButton.addEventListener('click', loadHistoryRecords);

  container.appendChild(errorCard);
}

function renderEmptyState() {
  const container = document.getElementById('historyContainer');
  const emptyState = getTemplateContent('historyEmptyTemplate');
  const button = emptyState.querySelector('.empty-action');

  button.addEventListener('click', () => {
    window.location.href = '/analyze';
  });

  container.appendChild(emptyState);
}

/* =========================
   Bulk Toolbar
========================= */

function createBulkDownloadToolbar() {
  const toolbar = getTemplateContent('bulkToolbarTemplate');

  const selectedCount = state.selectedDownloadIds.size;
  const allSelected =
    state.historyRecords.length > 0 &&
    state.historyRecords.every((record) => state.selectedDownloadIds.has(record.id));

  const selectAllCheckbox = toolbar.querySelector('#selectAllHistoryRecords');
  const selectedCountText = toolbar.querySelector('.selected-count');
  const downloadSelectedButton = toolbar.querySelector('#downloadSelectedCsvBtn');
  const deleteSelectedButton = toolbar.querySelector('#deleteSelectedBtn');
  const clearSelectionButton = toolbar.querySelector('#clearSelectedHistoryBtn');

  selectAllCheckbox.checked = allSelected;
  selectedCountText.textContent = `${selectedCount} selected`;

  downloadSelectedButton.disabled = selectedCount === 0;
  deleteSelectedButton.disabled = selectedCount === 0;
  clearSelectionButton.disabled = selectedCount === 0;

  selectAllCheckbox.addEventListener('change', (event) => {
    if (event.target.checked) {
      state.historyRecords.forEach((record) => state.selectedDownloadIds.add(record.id));
    } else {
      state.selectedDownloadIds.clear();
    }

    renderHistoryRecords();
  });

  downloadSelectedButton.addEventListener('click', handleDownloadSelectedCSV);
  deleteSelectedButton.addEventListener('click', handleDeleteSelectedRecords);

  clearSelectionButton.addEventListener('click', () => {
    state.selectedDownloadIds.clear();
    renderHistoryRecords();
  });

  return toolbar;
}

/* =========================
   History Table
========================= */

function createHistoryTable() {
  const tableCard = getTemplateContent('historyTableTemplate');
  const body = tableCard.querySelector('#historyTableBody');
  const selectAllCheckbox = tableCard.querySelector('#selectAllTableCheckbox');

  selectAllCheckbox.checked =
    state.historyRecords.length > 0 &&
    state.selectedDownloadIds.size === state.historyRecords.length;

  state.historyRecords.forEach((record) => {
    body.appendChild(createHistoryTableRow(record));
  });

  selectAllCheckbox.addEventListener('change', () => {
    if (selectAllCheckbox.checked) {
      state.historyRecords.forEach((record) => {
        state.selectedDownloadIds.add(record.id);
      });
    } else {
      state.selectedDownloadIds.clear();
    }

    renderHistoryRecords();
  });

  return tableCard;
}

function createHistoryTableRow(record) {
  const row = getTemplateContent('historyTableRowTemplate');

  const summary = record.summary || { positive: 0, neutral: 0, negative: 0 };
  const isSelected = state.selectedDownloadIds.has(record.id);

  const checkbox = row.querySelector('.record-select-checkbox');
  const analysisTitle = row.querySelector('.analysis-title');
  const historyDate = row.querySelector('.history-date');
  const historyTime = row.querySelector('.history-time');
  const modelTags = row.querySelector('.model-tags');
  const totalComments = row.querySelector('.comments-col strong');
  const positiveCount = row.querySelector('.summary-positive-count');
  const neutralCount = row.querySelector('.summary-neutral-count');
  const negativeCount = row.querySelector('.summary-negative-count');
  const viewButton = row.querySelector('.view-btn');
  const downloadButton = row.querySelector('.download-btn');
  const deleteButton = row.querySelector('.delete-btn');

  checkbox.checked = isSelected;
  analysisTitle.textContent = getAnalysisDisplayName(record);
  historyDate.textContent = record.date || '-';
  historyTime.textContent = record.time || '-';
  totalComments.textContent = record.totalComments || 0;

  positiveCount.textContent = summary.positive || 0;
  neutralCount.textContent = summary.neutral || 0;
  negativeCount.textContent = summary.negative || 0;

  (record.models || []).forEach((model) => {
    modelTags.appendChild(createModelPill(model, formatModelName(model)));
  });

  checkbox.addEventListener('change', (event) => {
    if (event.target.checked) {
      state.selectedDownloadIds.add(record.id);
    } else {
      state.selectedDownloadIds.delete(record.id);
    }

    renderHistoryRecords();
  });

  viewButton.addEventListener('click', () => {
    handleViewDetails(record.id);
  });

  downloadButton.addEventListener('click', () => {
    handleDownloadCSV(record.id);
  });

  deleteButton.addEventListener('click', () => {
    confirmDelete(record.id);
  });

  return row;
}

function createHistoryFooter() {
  const footer = getTemplateContent('historyFooterTemplate');
  const footerText = footer.querySelector('.history-footer-text');

  footerText.textContent = `Showing ${state.historyRecords.length} of ${state.historyRecords.length} analyses`;

  return footer;
}

function createModelPill(model, labelText) {
  const pill = getTemplateContent('modelPillTemplate');

  pill.classList.add(`model-pill-${String(model).toLowerCase()}`);
  pill.textContent = labelText || formatModelName(model);

  return pill;
}

/* =========================
   History Details Modal
========================= */

function handleViewDetails(id) {
  const record = state.historyRecords.find((item) => item.id === id);

  if (!record) {
    showToast('Analysis record not found', 'error');
    return;
  }

  const title = document.getElementById('historyDetailsTitle');
  const meta = document.getElementById('historyDetailsMeta');
  const content = document.getElementById('historyDetailsContent');

  clearElement(content);

  title.textContent = `${getAnalysisDisplayName(record)} Details`;
  meta.textContent = `${record.date || '-'} at ${record.time || '-'} • ${record.totalComments || 0} comments analyzed`;

  const summaryCard = getTemplateContent('historyDetailsSummaryTemplate');
  const totalComments = summaryCard.querySelector('.history-details-total-comments');
  const modelTags = summaryCard.querySelector('.model-tags');

  totalComments.textContent = record.totalComments || 0;

  (record.models || []).forEach((model) => {
    modelTags.appendChild(createModelPill(model, formatModelName(model)));
  });

  const modelList = getTemplateContent('historyModelDetailsListTemplate');

  (record.modelResults || []).forEach((modelResult, index) => {
    modelList.appendChild(createHistoryModelDetailCard(modelResult, index));
  });

  content.appendChild(summaryCard);
  content.appendChild(modelList);

  openHistoryDetailsModal();

  setTimeout(() => {
    (record.modelResults || []).forEach((modelResult) => {
      const canvasId = `historyChart-${modelResult.modelName}`;
      renderHistorySentimentChart(canvasId, modelResult.distribution);
    });
  }, 0);
}

function createHistoryModelDetailCard(modelResult, index) {
  const card = getTemplateContent('historyModelDetailCardTemplate');

  const sentimentCounts = getSentimentCounts(modelResult.comments || []);
  const canvasId = `historyChart-${modelResult.modelName}`;
  const isPrimary = index === 0;

  const title = card.querySelector('.history-model-title-wrap h3');
  const typePill = card.querySelector('.history-model-type-pill');
  const positiveSummary = card.querySelector('.summary-positive');
  const neutralSummary = card.querySelector('.summary-neutral');
  const negativeSummary = card.querySelector('.summary-negative');
  const canvas = card.querySelector('canvas');
  const tableBody = card.querySelector('.history-comment-table-body');

  title.textContent = `${formatModelName(modelResult.modelName)} Results`;
  typePill.textContent = isPrimary ? 'Primary' : 'Compared';

  positiveSummary.textContent = `Positive ${sentimentCounts.positive}`;
  neutralSummary.textContent = `Neutral ${sentimentCounts.neutral}`;
  negativeSummary.textContent = `Negative ${sentimentCounts.negative}`;

  canvas.id = canvasId;
  canvas.setAttribute('aria-label', `${modelResult.modelName} sentiment chart`);

  (modelResult.comments || []).forEach((comment) => {
    tableBody.appendChild(createHistoryCommentRow(comment, modelResult.modelName));
  });

  return card;
}

function createHistoryCommentRow(comment, modelName) {
  const row = getTemplateContent('historyCommentRowTemplate');

  const index = row.querySelector('.history-comment-index');
  const text = row.querySelector('.history-comment-text');
  const sentiment = row.querySelector('.history-comment-sentiment');
  const button = row.querySelector('.history-extra-score-btn');

  index.textContent = comment.id || '';
  text.textContent = comment.text || '';
  sentiment.appendChild(createSentimentBadge(comment.sentiment));

  button.addEventListener('click', () => {
    openCommentDetails(comment, comment.id, modelName);
  });

  return row;
}

function openHistoryDetailsModal() {
  document.getElementById('historyDetailsModal').classList.remove('hidden');
}

function closeHistoryDetailsModal() {
  document.getElementById('historyDetailsModal').classList.add('hidden');
  clearElement(document.getElementById('historyDetailsContent'));
  destroySentimentCharts();
}

/* =========================
   Charts
========================= */

function renderHistorySentimentChart(canvasId, distribution) {
  const canvas = document.getElementById(canvasId);

  if (!canvas || typeof Chart === 'undefined') return;

  const labels = ['Positive', 'Neutral', 'Negative'];
  const counts = labels.map((label) => Number(distribution?.[label] || 0));

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
          backgroundColor: ['#22c55e', '#64748b', '#ef4444'],
          borderColor: ['#16a34a', '#475569', '#dc2626'],
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 48,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#334155',
            font: { weight: '700' },
          },
        },
        y: {
          beginAtZero: true,
          min: 0,
          max: 5,
          ticks: {
            stepSize: 1,
            color: '#64748b',
            callback: (value) => Number.isInteger(value) ? value : '',
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.22)',
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

/* =========================
   Sentiment Badge
========================= */

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

/* =========================
   Comment Extra Scores Modal
========================= */

function openCommentDetails(comment, commentIndex, modelName) {
  const vader = comment.vader || {};
  const textblob = comment.textblob || {};

  const polarity = Number(textblob.polarity ?? 0);
  const subjectivity = Number(textblob.subjectivity ?? 0);
  const compound = Number(vader.compound ?? 0);

  const polarityPosition = ((polarity + 1) / 2) * 100;
  const subjectivityPosition = subjectivity * 100;
  const compoundPosition = ((compound + 1) / 2) * 100;

  const modalBadge = document.getElementById('modalSentimentBadge');
  const compoundPointer = document.getElementById('compoundPointer');
  const polarityPointer = document.getElementById('polarityPointer');
  const subjectivityPointer = document.getElementById('subjectivityPointer');

  document.getElementById('commentDetailsTitle').textContent = 'Extra Scores';
  document.getElementById('modalCommentText').textContent = comment.text || '';

  clearElement(modalBadge);
  modalBadge.appendChild(createSentimentBadge(comment.sentiment));

  renderVaderDoughnutChart(vader);

  document.getElementById('vaderPositive').textContent = toFixedScore(vader.pos);
  document.getElementById('vaderNeutral').textContent = toFixedScore(vader.neu);
  document.getElementById('vaderNegative').textContent = toFixedScore(vader.neg);
  document.getElementById('vaderCompound').textContent = toFixedScore(vader.compound);

  if (compoundPointer) {
    compoundPointer.style.setProperty('--compound-left', `${compoundPosition}%`);
  }

  document.getElementById('polarityValue').textContent = toFixedScore(polarity);
  document.getElementById('subjectivityValue').textContent = toFixedScore(subjectivity);

  if (polarityPointer) {
    polarityPointer.style.setProperty('--pointer-left', `${polarityPosition}%`);
  }

  if (subjectivityPointer) {
    subjectivityPointer.style.setProperty('--pointer-left', `${subjectivityPosition}%`);
  }

  document.getElementById('commentDetailsModal').classList.remove('hidden');
}

function closeCommentDetailsModal() {
  document.getElementById('commentDetailsModal').classList.add('hidden');
  destroyVaderDoughnutChart();
}

function renderVaderDoughnutChart(vaderScores = {}) {
  const canvas = document.getElementById('vaderDoughnutChart');

  if (!canvas || typeof Chart === 'undefined') return;

  destroyVaderDoughnutChart();

  vaderDoughnutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [
        {
          data: [
            Number(vaderScores.pos ?? 0),
            Number(vaderScores.neu ?? 0),
            Number(vaderScores.neg ?? 0),
          ],
          backgroundColor: ['#22c55e', '#64748b', '#ef4444'],
          borderColor: '#ffffff',
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
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#ffffff',
          bodyColor: '#e2e8f0',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context) => `${context.label}: ${Number(context.raw || 0).toFixed(3)}`,
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
   CSV Download
   Kept same structure as your original code
========================= */

function handleDownloadCSV(id) {
  const record = state.historyRecords.find((item) => item.id === id);
  if (!record) return;

  const csv = createCsv(record);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;

  const displayName = getAnalysisDisplayName(record)
    .toLowerCase()
    .replace(/\s+/g, '-');

  link.download = `CommentInsight-${displayName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast(`${getAnalysisDisplayName(record)} downloaded as CSV`, 'success');
}

function handleDownloadSelectedCSV() {
  const selectedRecords = state.historyRecords.filter((record) =>
    state.selectedDownloadIds.has(record.id)
  );

  if (selectedRecords.length === 0) {
    showToast('Please select at least one history record to download', 'error');
    return;
  }

  const csv = createCombinedCsv(selectedRecords);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `CommentInsight-selected-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast(`${selectedRecords.length} selected analyses downloaded as one CSV`, 'success');
}

function createCsv(record) {
  const summaryHeaders = [
    'model_name',
    'total_positive',
    'total_neutral',
    'total_negative',
  ];

  const summaryRows = sortModelResults(record.modelResults || []).map((modelResult) => {
    const counts = getSentimentCounts(modelResult.comments || []);

    return [
      modelResult.modelName,
      counts.positive || 0,
      counts.neutral || 0,
      counts.negative || 0,
    ];
  });

  const detailHeaders = [
    'analysis_name',
    'analysis_date',
    'analysis_time',
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

  const detailRows = sortModelResults(record.modelResults || []).flatMap((modelResult) =>
    (modelResult.comments || []).map((comment) => [
      getAnalysisDisplayName(record),
      record.date || '',
      record.time || '',
      comment.id,
      comment.text,
      modelResult.modelName,
      comment.sentiment,
      getVaderLabel(comment.vader),
      toFixedScore(comment.vader?.pos),
      toFixedScore(comment.vader?.neu),
      toFixedScore(comment.vader?.neg),
      toFixedScore(comment.vader?.compound),
      getTextBlobLabel(comment.textblob),
      toFixedScore(comment.textblob?.polarity),
      toFixedScore(comment.textblob?.subjectivity),
    ])
  );

  const csvRows = [
    ['SUMMARY'],
    summaryHeaders,
    ...summaryRows,
    [],
    ['DETAILS'],
    detailHeaders,
    ...detailRows,
  ];

  return csvRows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
}

function createCombinedCsv(records) {
  const modelTotals = {};

  records.forEach((record) => {
    sortModelResults(record.modelResults || []).forEach((modelResult) => {
      const modelName = modelResult.modelName;
      const counts = getSentimentCounts(modelResult.comments || []);

      if (!modelTotals[modelName]) {
        modelTotals[modelName] = {
          positive: 0,
          neutral: 0,
          negative: 0,
        };
      }

      modelTotals[modelName].positive += counts.positive || 0;
      modelTotals[modelName].neutral += counts.neutral || 0;
      modelTotals[modelName].negative += counts.negative || 0;
    });
  });

  const summaryHeaders = [
    'model_name',
    'total_positive',
    'total_neutral',
    'total_negative',
  ];

  const modelOrder = ['SVM', 'Logistic Regression', 'Naive Bayes', 'LR', 'NB'];

  const summaryRows = Object.keys(modelTotals)
    .sort((a, b) => {
      const aIndex = modelOrder.indexOf(a);
      const bIndex = modelOrder.indexOf(b);

      if (aIndex === -1 && bIndex === -1) {
        return a.localeCompare(b);
      }

      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    })
    .map((modelName) => [
      modelName,
      modelTotals[modelName].positive,
      modelTotals[modelName].neutral,
      modelTotals[modelName].negative,
    ]);

  const detailHeaders = [
    'analysis_name',
    'analysis_date',
    'analysis_time',
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

  const detailRows = records.flatMap((record) =>
    sortModelResults(record.modelResults || []).flatMap((modelResult) =>
      (modelResult.comments || []).map((comment) => [
        getAnalysisDisplayName(record),
        record.date || '',
        record.time || '',
        comment.id,
        comment.text,
        modelResult.modelName,
        comment.sentiment,
        getVaderLabel(comment.vader),
        toFixedScore(comment.vader?.pos),
        toFixedScore(comment.vader?.neu),
        toFixedScore(comment.vader?.neg),
        toFixedScore(comment.vader?.compound),
        getTextBlobLabel(comment.textblob),
        toFixedScore(comment.textblob?.polarity),
        toFixedScore(comment.textblob?.subjectivity),
      ])
    )
  );

  const csvRows = [
    ['SUMMARY'],
    summaryHeaders,
    ...summaryRows,
    [],
    ['DETAILS'],
    detailHeaders,
    ...detailRows,
  ];

  return csvRows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
}

/* =========================
   Delete Records
========================= */

function handleDeleteSelectedRecords() {
  const selectedCount = state.selectedDownloadIds.size;

  if (selectedCount === 0) {
    showToast('Please select at least one history record to delete', 'error');
    return;
  }

  state.deleteMode = 'multiple';
  state.selectedRecord = null;

  document.getElementById('deleteModalTitle').textContent = 'Delete Selected Analyses';

  const deleteMessage = document.getElementById('deleteMessage');
  clearElement(deleteMessage);

  deleteMessage.appendChild(document.createTextNode('Are you sure you want to delete '));

  const strong = document.createElement('strong');
  strong.textContent = `${selectedCount} selected analysis record(s)`;

  deleteMessage.appendChild(strong);
  deleteMessage.appendChild(
    document.createTextNode(
      '? This action cannot be undone and the records will be permanently removed from Firebase.'
    )
  );

  openDeleteModal();
}

function confirmDelete(id) {
  state.deleteMode = 'single';
  state.selectedRecord = id;

  const record = state.historyRecords.find((item) => item.id === id);
  const deleteName = record ? getAnalysisDisplayName(record) : 'this analysis record';

  document.getElementById('deleteModalTitle').textContent = 'Delete Analysis';

  const deleteMessage = document.getElementById('deleteMessage');
  clearElement(deleteMessage);

  deleteMessage.appendChild(document.createTextNode('Are you sure you want to delete '));

  const strong = document.createElement('strong');
  strong.textContent = deleteName;

  deleteMessage.appendChild(strong);
  deleteMessage.appendChild(
    document.createTextNode(
      '? This action cannot be undone and the record will be permanently removed from Firebase.'
    )
  );

  openDeleteModal();
}

function openDeleteModal() {
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
  state.selectedRecord = null;
  state.deleteMode = 'single';
}

async function handleConfirmDelete() {
  try {
    if (state.deleteMode === 'multiple') {
      const selectedIds = Array.from(state.selectedDownloadIds);

      if (selectedIds.length === 0) {
        closeDeleteModal();
        return;
      }

      if (window.CommentInsightFirebase) {
        await Promise.all(
          selectedIds.map((id) => window.CommentInsightFirebase.deleteAnalysis(id))
        );
      }

      state.historyRecords = state.historyRecords.filter(
        (record) => !state.selectedDownloadIds.has(record.id)
      );

      const deletedCount = selectedIds.length;
      state.selectedDownloadIds.clear();

      showToast(`${deletedCount} selected analysis record(s) deleted`, 'success');
      renderHistoryRecords();
      closeDeleteModal();
      return;
    }

    if (state.deleteMode === 'single' && state.selectedRecord) {
      if (window.CommentInsightFirebase) {
        await window.CommentInsightFirebase.deleteAnalysis(state.selectedRecord);
      }

      const deletedRecord = state.historyRecords.find(
        (record) => record.id === state.selectedRecord
      );

      const deletedName = deletedRecord
        ? getAnalysisDisplayName(deletedRecord)
        : 'Analysis record';

      state.historyRecords = state.historyRecords.filter(
        (record) => record.id !== state.selectedRecord
      );

      state.selectedDownloadIds.delete(state.selectedRecord);

      showToast(`${deletedName} deleted from Firebase`, 'success');
      renderHistoryRecords();
      closeDeleteModal();
    }
  } catch (error) {
    showToast(error.message || 'Unable to delete analysis record(s)', 'error');
  }
}

/* =========================
   Toast / Logout / Init
========================= */

function showToast(message, type = 'success') {
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

    showToast('Logged out successfully', 'success');

    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (error) {
    showToast(error.message || 'Logout failed', 'error');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  initializePage();
  window.CommentInsightNavbar.init('/history', { onLogout: handleLogout });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializePage,
    renderHistoryRecords,
    handleViewDetails,
    handleDownloadCSV,
    confirmDelete,
    handleConfirmDelete,
    handleLogout,
  };
}